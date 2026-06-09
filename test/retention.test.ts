import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";

let linkId: number;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM clicks").run();
  await env.DB.prepare("DELETE FROM links").run();
  const r = await env.DB.prepare(
    "INSERT INTO links (slug, target_url, created_at, archived) VALUES ('t','https://e.com',0,0) RETURNING id"
  ).first<{ id: number }>();
  linkId = r!.id;
});

describe("scheduled() click retention", () => {
  it("prunes clicks older than the retention window and keeps recent ones", async () => {
    const now = Date.now();
    const ins = "INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)";
    await env.DB.prepare(ins).bind(linkId, now - 200 * 86_400_000, "old").run(); // 200 days old
    await env.DB.prepare(ins).bind(linkId, now - 10 * 86_400_000, "recent").run(); // 10 days old

    const ctx = createExecutionContext();
    await worker.scheduled({ scheduledTime: now, cron: "0 3 * * *", noRetry() {} } as never, env, ctx);
    await waitOnExecutionContext(ctx);

    const rows = await env.DB.prepare("SELECT visitor_hash FROM clicks").all<{ visitor_hash: string }>();
    expect(rows.results.map((x) => x.visitor_hash)).toEqual(["recent"]);
  });

  it("respects a custom CLICKS_RETENTION_DAYS window", async () => {
    const now = Date.now();
    const ins = "INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)";
    await env.DB.prepare(ins).bind(linkId, now - 60 * 86_400_000, "d60").run();
    await env.DB.prepare(ins).bind(linkId, now - 5 * 86_400_000, "d5").run();

    const ctx = createExecutionContext();
    await worker.scheduled(
      { scheduledTime: now, cron: "0 3 * * *", noRetry() {} } as never,
      { ...env, CLICKS_RETENTION_DAYS: "30" },
      ctx
    );
    await waitOnExecutionContext(ctx);

    const rows = await env.DB.prepare("SELECT visitor_hash FROM clicks").all<{ visitor_hash: string }>();
    expect(rows.results.map((x) => x.visitor_hash)).toEqual(["d5"]); // 60d pruned at a 30d window
  });

  it("falls back to 180 days for a non-finite retention value", async () => {
    const now = Date.now();
    const ins = "INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)";
    await env.DB.prepare(ins).bind(linkId, now - 200 * 86_400_000, "d200").run();
    await env.DB.prepare(ins).bind(linkId, now - 100 * 86_400_000, "d100").run();

    const ctx = createExecutionContext();
    await worker.scheduled(
      { scheduledTime: now, cron: "0 3 * * *", noRetry() {} } as never,
      { ...env, CLICKS_RETENTION_DAYS: "not-a-number" },
      ctx
    );
    await waitOnExecutionContext(ctx);

    const rows = await env.DB.prepare("SELECT visitor_hash FROM clicks").all<{ visitor_hash: string }>();
    expect(rows.results.map((x) => x.visitor_hash)).toEqual(["d100"]); // garbage -> default 180d
  });
});
