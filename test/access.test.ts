import { env, createExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

describe("Access guard on /api", () => {
  it("rejects requests without an Access assertion or test header", async () => {
    const res = await worker.fetch(new Request("https://slink.test/api/links"), env, createExecutionContext());
    expect(res.status).toBe(401);
  });
  it("allows the public redirect path without auth", async () => {
    const res = await worker.fetch(new Request("https://example.test/whatever"), env, createExecutionContext());
    expect(res.status).toBe(404); // reached the redirect route, not blocked by auth
  });
  it("404s /api on the public host (the API is admin-host-only)", async () => {
    const res = await worker.fetch(new Request("https://example.test/api/links"), env, createExecutionContext());
    expect(res.status).toBe(404); // host guard returns 404, not the 401 auth would give
  });
  it("rejects a malformed Access token with 401", async () => {
    const res = await worker.fetch(
      new Request("https://slink.test/api/links", { headers: { "cf-access-jwt-assertion": "not-a-jwt" } }),
      env,
      createExecutionContext()
    );
    expect(res.status).toBe(401);
  });
});
