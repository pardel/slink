import { env, createExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

describe("security headers", () => {
  it("sets hardening headers on responses", async () => {
    const res = await worker.fetch(new Request("https://slink.test/api/links"), env, createExecutionContext());
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBeTruthy();
    expect(res.headers.get("x-frame-options")).toBeTruthy();
    expect(res.headers.get("referrer-policy")).toBeTruthy();
  });

  // Regression: env.ASSETS.fetch() returns immutable headers. The secureHeaders
  // middleware mutates the response after the handler returns, so the asset path
  // must hand back a mutable copy; otherwise this 500s with "Can't modify
  // immutable headers" (the bug that took admin.example.com down).
  it("serves the dashboard asset on the admin host with hardening headers", async () => {
    const res = await worker.fetch(new Request("https://slink.test/"), env, createExecutionContext());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-security-policy")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("also sets headers on the public /:slug redirect", async () => {
    await env.DB.prepare(
      "INSERT INTO links (slug, target_url, created_at, archived) VALUES ('hdr','https://e.com',0,0)"
    ).run();
    const res = await worker.fetch(new Request("https://example.test/hdr"), env, createExecutionContext());
    expect(res.status).toBe(302);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });
});
