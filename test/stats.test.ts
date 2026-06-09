import { env, createExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";

let linkId: number;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM clicks");
  await env.DB.exec("DELETE FROM links");
  const r = await env.DB.prepare(
    "INSERT INTO links (slug, target_url, created_at, archived) VALUES ('t','https://e.com',0,0) RETURNING id"
  ).first<{ id: number }>();
  linkId = r!.id;
  const ins = "INSERT INTO clicks (link_id, ts, country, ua_device, ua_browser, visitor_hash) VALUES (?,?,?,?,?,?)";
  await env.DB.prepare(ins).bind(linkId, 1000, "GB", "desktop", "Chrome", "h1").run();
  await env.DB.prepare(ins).bind(linkId, 2000, "GB", "mobile", "Safari", "h1").run(); // same visitor
  await env.DB.prepare(ins).bind(linkId, 3000, "US", "desktop", "Chrome", "h2").run();
});

describe("GET /api/links/:id/stats", () => {
  it("returns total, unique, and breakdowns", async () => {
    const res = await worker.fetch(
      new Request(`https://slink.test/api/links/${linkId}/stats`, { headers: { "x-test-auth": "ok" } }),
      env,
      createExecutionContext()
    );
    expect(res.status).toBe(200);
    const stats = (await res.json()) as {
      total: number; unique: number;
      byCountry: { country: string; n: number }[];
      byBrowser: { browser: string; n: number }[];
    };
    expect(stats.total).toBe(3);
    expect(stats.unique).toBe(2);
    expect(stats.byCountry.find((x) => x.country === "GB")?.n).toBe(2);
    expect(stats.byBrowser.find((x) => x.browser === "Chrome")?.n).toBe(2);
  });

  it("buckets the daily series by UTC day, collapses same-day clicks, and orders ascending", async () => {
    // beforeEach already seeded 3 clicks at ts 1000/2000/3000 -> all in day bucket 0.
    // Add 2 more two days later to prove bucketing, same-day collapse, and ordering.
    const ins = "INSERT INTO clicks (link_id, ts, country, ua_device, ua_browser, visitor_hash) VALUES (?,?,?,?,?,?)";
    await env.DB.prepare(ins).bind(linkId, 2 * 86_400_000, "GB", "desktop", "Chrome", "h3").run();
    await env.DB.prepare(ins).bind(linkId, 2 * 86_400_000 + 500, "US", "mobile", "Safari", "h4").run();

    const res = await worker.fetch(
      new Request(`https://slink.test/api/links/${linkId}/stats`, { headers: { "x-test-auth": "ok" } }),
      env,
      createExecutionContext()
    );
    const { series } = (await res.json()) as { series: { day: number; n: number }[] };
    expect(series).toEqual([
      { day: 0, n: 3 },
      { day: 2, n: 2 },
    ]);
  });

  it("aggregates clicks across all links at GET /api/stats with a top-links ranking", async () => {
    // beforeEach: link 't' has 3 clicks / 2 unique. Add a second link with 1 click.
    const r2 = await env.DB.prepare(
      "INSERT INTO links (slug, target_url, created_at, archived) VALUES ('u','https://e2.com',0,0) RETURNING id"
    ).first<{ id: number }>();
    await env.DB.prepare(
      "INSERT INTO clicks (link_id, ts, country, ua_device, ua_browser, visitor_hash) VALUES (?,?,?,?,?,?)"
    ).bind(r2!.id, 4000, "US", "desktop", "Chrome", "h9").run();

    const res = await worker.fetch(
      new Request("https://slink.test/api/stats", { headers: { "x-test-auth": "ok" } }),
      env,
      createExecutionContext()
    );
    expect(res.status).toBe(200);
    const o = (await res.json()) as {
      total: number; unique: number; links: number; activeLinks: number;
      topLinks: { slug: string; clicks: number }[];
    };
    expect(o.total).toBe(4); // 3 + 1 across both links
    expect(o.unique).toBe(3); // h1, h2, h9
    expect(o.links).toBe(2);
    expect(o.activeLinks).toBe(2);
    expect(o.topLinks[0]).toMatchObject({ slug: "t", clicks: 3 }); // busiest first
    expect(o.topLinks.find((t) => t.slug === "u")?.clicks).toBe(1);
  });

  it("filters overview analytics by a from/to ts window", async () => {
    // beforeEach seeded 3 clicks at ts 1000/2000/3000 (day 0). Add one at day 10.
    const t10 = 10 * 86_400_000;
    await env.DB.prepare(
      "INSERT INTO clicks (link_id, ts, country, ua_device, ua_browser, visitor_hash) VALUES (?,?,?,?,?,?)"
    ).bind(linkId, t10 + 5, "US", "desktop", "Chrome", "hz").run();

    const get = async (qs: string) => {
      const res = await worker.fetch(
        new Request(`https://slink.test/api/stats${qs}`, { headers: { "x-test-auth": "ok" } }),
        env,
        createExecutionContext()
      );
      return (await res.json()) as { total: number; unique: number; topLinks: { slug: string; clicks: number }[] };
    };

    // from one day in: only the day-10 click.
    const recent = await get(`?from=${86_400_000}`);
    expect(recent.total).toBe(1);
    expect(recent.unique).toBe(1);

    // to one day in: only the three seeded day-0 clicks (exclusive upper bound).
    const early = await get(`?to=${86_400_000}`);
    expect(early.total).toBe(3);

    // a window covering nothing: zero clicks, but the link still appears (0 count)
    // because the ts filter is in the JOIN's ON clause, not a WHERE.
    const empty = await get(`?from=${t10 + 100}&to=${t10 + 200}`);
    expect(empty.total).toBe(0);
    expect(empty.topLinks.find((t) => t.slug === "t")?.clicks).toBe(0);
  });

  it("filters per-link stats by a from/to ts window", async () => {
    // beforeEach seeded 3 clicks at ts 1000/2000/3000 (day 0). Add one at day 10.
    await env.DB.prepare(
      "INSERT INTO clicks (link_id, ts, country, ua_device, ua_browser, visitor_hash) VALUES (?,?,?,?,?,?)"
    ).bind(linkId, 10 * 86_400_000, "US", "desktop", "Chrome", "hz").run();

    const get = async (qs: string) => {
      const res = await worker.fetch(
        new Request(`https://slink.test/api/links/${linkId}/stats${qs}`, { headers: { "x-test-auth": "ok" } }),
        env,
        createExecutionContext()
      );
      return (await res.json()) as { total: number };
    };

    expect((await get(`?from=${86_400_000}`)).total).toBe(1); // only the day-10 click
    expect((await get(`?to=${86_400_000}`)).total).toBe(3); // only the seeded day-0 clicks
    expect((await get("")).total).toBe(4); // unbounded
  });

  it("rejects a non-numeric id with 400", async () => {
    const res = await worker.fetch(
      new Request("https://slink.test/api/links/abc/stats", { headers: { "x-test-auth": "ok" } }),
      env,
      createExecutionContext()
    );
    expect(res.status).toBe(400);
  });

  it("returns device and referrer breakdowns (collected data the design promised)", async () => {
    // beforeEach seeded 3 clicks: devices desktop/mobile/desktop, no referrer.
    const ins = "INSERT INTO clicks (link_id, ts, ua_device, referrer, visitor_hash) VALUES (?,?,?,?,?)";
    await env.DB.prepare(ins).bind(linkId, 4000, "tablet", "https://x.com", "h5").run();
    await env.DB.prepare(ins).bind(linkId, 5000, "desktop", "https://x.com", "h6").run();

    const res = await worker.fetch(
      new Request(`https://slink.test/api/links/${linkId}/stats`, { headers: { "x-test-auth": "ok" } }),
      env,
      createExecutionContext()
    );
    const s = (await res.json()) as {
      byDevice: { device: string | null; n: number }[];
      byReferrer: { referrer: string | null; n: number }[];
    };
    expect(s.byDevice.find((d) => d.device === "desktop")?.n).toBe(3);
    expect(s.byDevice.find((d) => d.device === "tablet")?.n).toBe(1);
    expect(s.byReferrer.find((r) => r.referrer === "https://x.com")?.n).toBe(2);
  });
});
