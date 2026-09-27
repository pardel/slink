import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";

beforeEach(async () => {
  await env.DB.exec("DELETE FROM clicks");
  await env.DB.exec("DELETE FROM links");
  await env.DB.prepare(
    "INSERT INTO links (slug, target_url, created_at, archived) VALUES (?, ?, ?, 0)"
  ).bind("talk", "https://example.com/deck", Date.now()).run();
});

describe("GET /:slug", () => {
  it("302-redirects to the target and logs one click", async () => {
    const req = new Request("https://example.test/talk?utm_source=slides", {
      headers: { "user-agent": "Chrome/120 Safari/537.36", "cf-connecting-ip": "9.9.9.9" },
    });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/deck?utm_source=slides");

    const { results } = await env.DB.prepare(
      "SELECT ua_device, ua_browser, visitor_hash, country FROM clicks"
    ).all<{ ua_device: string; ua_browser: string; visitor_hash: string; country: string | null }>();
    expect(results.length).toBe(1);
    expect(results[0].ua_device).toBe("desktop");
    expect(results[0].ua_browser).toBe("Chrome");
    expect(results[0].visitor_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(results[0].country).toBe(null); // no request.cf in the test runtime
  });

  it("returns 404 for an unknown slug", async () => {
    const res = await worker.fetch(new Request("https://example.test/nope"), env, createExecutionContext());
    expect(res.status).toBe(404);
  });

  it("redirects unknown slug to NOT_FOUND_URL when configured", async () => {
    const res = await worker.fetch(
      new Request("https://example.test/missing"),
      { ...env, NOT_FOUND_URL: "https://fallback.example/home" },
      createExecutionContext()
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://fallback.example/home");
  });

  it("does not redirect an archived link (404, or the fallback when configured)", async () => {
    await env.DB.prepare(
      "INSERT INTO links (slug, target_url, created_at, archived) VALUES (?, ?, ?, 1)"
    ).bind("gone", "https://example.com/old", Date.now()).run();

    const res404 = await worker.fetch(new Request("https://example.test/gone"), env, createExecutionContext());
    expect(res404.status).toBe(404);

    const resFallback = await worker.fetch(
      new Request("https://example.test/gone"),
      { ...env, NOT_FOUND_URL: "https://fallback.example/home" },
      createExecutionContext()
    );
    expect(resFallback.status).toBe(302);
    expect(resFallback.headers.get("location")).toBe("https://fallback.example/home");
  });

  it("404s a malformed (non-slug) path without a DB lookup or fallback redirect", async () => {
    // /favicon.ico, /robots.txt etc. are not slug-shaped; they should not hit D1
    // nor be 302'd to NOT_FOUND_URL; they are simply not found.
    const res = await worker.fetch(
      new Request("https://example.test/favicon.ico"),
      { ...env, NOT_FOUND_URL: "https://fallback.example/home" },
      createExecutionContext()
    );
    expect(res.status).toBe(404);
  });

  it("serves the public landing page at the root (200) pointing to the repo", async () => {
    const res = await worker.fetch(new Request("https://example.test/"), env, createExecutionContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body).toContain("github.com/pardel/slink");
    expect(body).toContain("Slink");
    // The data-URI favicon must be URL-encoded, else its quotes break the <link>
    // href and the SVG tail leaks as visible text at the top of the page.
    expect(body).toContain("data:image/svg+xml,%3Csvg");
    expect(body).not.toContain("data:image/svg+xml,<svg");
  });

  it("lists the newest live links on the root page, escaped, archived excluded", async () => {
    const now = Date.now();
    const insert = env.DB.prepare(
      "INSERT INTO links (slug, target_url, title, created_at, archived) VALUES (?, ?, ?, ?, ?)"
    );
    await env.DB.batch([
      insert.bind("older", "https://old.example/x", null, now - 2000, 0),
      insert.bind("newest", "https://new.example/y", "<b>New</b> & shiny", now + 1000, 0),
      insert.bind("hidden", "https://hidden.example/z", "Gone", now + 2000, 1),
    ]);
    const body = await (await worker.fetch(new Request("https://example.test/"), env, createExecutionContext())).text();
    expect(body).toContain("Latest links");
    expect(body).toContain('href="/newest"');
    expect(body).toContain("&#60;b&#62;New&#60;/b&#62; &#38; shiny");
    expect(body).not.toContain("<b>New</b>");
    expect(body).toContain("old.example"); // untitled links fall back to the target host
    expect(body).not.toContain("/hidden");
    expect(body.indexOf("/newest")).toBeLessThan(body.indexOf("/talk"));
    expect(body.indexOf("/talk")).toBeLessThan(body.indexOf("/older"));
    // The list sits above the private-instance notice.
    expect(body.indexOf("Latest links")).toBeLessThan(body.indexOf("This is a private instance"));
  });

  it("does not list links on the 404 fallback page", async () => {
    const res = await worker.fetch(new Request("https://example.test/nope"), env, createExecutionContext());
    expect(await res.text()).not.toContain("Latest links");
  });

  it("serves the landing page (not a bare 404) for an unknown slug", async () => {
    const res = await worker.fetch(new Request("https://example.test/nope"), env, createExecutionContext());
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("github.com/pardel/slink");
  });

  it("stores only the referrer's origin, dropping path and query (PII safety)", async () => {
    const req = new Request("https://example.test/talk", {
      // a real-world referrer carrying secrets in the query string
      headers: { referer: "https://mail.example.com/compose?to=alice@x.com&token=s3cr3t" },
    });
    const ctx = createExecutionContext();
    await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    const row = await env.DB.prepare("SELECT referrer FROM clicks").first<{ referrer: string | null }>();
    expect(row?.referrer).toBe("https://mail.example.com");
  });
});
