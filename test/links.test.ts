import { env, createExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";

async function call(method: string, path: string, body?: unknown): Promise<Response> {
  const req = new Request(`https://slink.test${path}`, {
    method,
    headers: { "content-type": "application/json", "x-test-auth": "ok" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return worker.fetch(req, env, createExecutionContext());
}

beforeEach(async () => {
  await env.DB.exec("DELETE FROM clicks");
  await env.DB.exec("DELETE FROM links");
});

describe("link CRUD", () => {
  it("creates, lists, and archives a link", async () => {
    const created = await call("POST", "/api/links", { slug: "talk", targetUrl: "https://example.com" });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };

    const list = await call("GET", "/api/links");
    expect(((await list.json()) as unknown[]).length).toBe(1);

    const archived = await call("POST", `/api/links/${id}/archive`);
    expect(archived.status).toBe(200);
  });

  it("rejects an invalid slug with 400", async () => {
    const res = await call("POST", "/api/links", { slug: "Bad Slug", targetUrl: "https://example.com" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate slug with 409", async () => {
    await call("POST", "/api/links", { slug: "dup", targetUrl: "https://example.com" });
    const res = await call("POST", "/api/links", { slug: "dup", targetUrl: "https://other.com" });
    expect(res.status).toBe(409);
  });

  it("rejects a body missing targetUrl with 400", async () => {
    const res = await call("POST", "/api/links", { slug: "noturl" });
    expect(res.status).toBe(400);
  });

  it("rejects a body missing slug with 400", async () => {
    const res = await call("POST", "/api/links", { targetUrl: "https://example.com" });
    expect(res.status).toBe(400);
  });

  it("rejects a reserved slug ('api') with 400", async () => {
    const res = await call("POST", "/api/links", { slug: "api", targetUrl: "https://example.com" });
    expect(res.status).toBe(400);
  });

  it("rejects a non-http(s) target URL with 400", async () => {
    const res = await call("POST", "/api/links", { slug: "xss", targetUrl: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("rejects archiving a non-numeric id with 400", async () => {
    const res = await call("POST", "/api/links/abc/archive");
    expect(res.status).toBe(400);
  });

  it("returns 404 when archiving a nonexistent id", async () => {
    const res = await call("POST", "/api/links/999999/archive");
    expect(res.status).toBe(404);
  });

  it("unarchives a previously archived link", async () => {
    const created = await call("POST", "/api/links", { slug: "back", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };
    await call("POST", `/api/links/${id}/archive`);

    const un = await call("POST", `/api/links/${id}/unarchive`);
    expect(un.status).toBe(200);

    const list = await call("GET", "/api/links");
    const rows = (await list.json()) as { id: number; archived: number }[];
    expect(rows.find((r) => r.id === id)?.archived).toBe(0);
  });

  it("returns 404 when unarchiving a nonexistent id", async () => {
    const res = await call("POST", "/api/links/999999/unarchive");
    expect(res.status).toBe(404);
  });

  it("deletes a link and its clicks", async () => {
    const created = await call("POST", "/api/links", { slug: "del", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };
    await env.DB.prepare("INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)").bind(id, 1, "h").run();

    const del = await call("DELETE", `/api/links/${id}`);
    expect(del.status).toBe(200);

    const list = await call("GET", "/api/links");
    expect(((await list.json()) as unknown[]).length).toBe(0);
    const clicks = await env.DB.prepare("SELECT COUNT(*) AS n FROM clicks WHERE link_id = ?").bind(id).first<{ n: number }>();
    expect(clicks?.n).toBe(0);
  });

  it("returns 404 when deleting a nonexistent id", async () => {
    const res = await call("DELETE", "/api/links/999999");
    expect(res.status).toBe(404);
  });

  it("returns per-link click and unique-visitor counts in the list", async () => {
    const created = await call("POST", "/api/links", { slug: "counts", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };
    // 3 clicks from 2 distinct visitors.
    await env.DB.prepare("INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)").bind(id, 1, "a").run();
    await env.DB.prepare("INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)").bind(id, 2, "a").run();
    await env.DB.prepare("INSERT INTO clicks (link_id, ts, visitor_hash) VALUES (?,?,?)").bind(id, 3, "b").run();

    const list = await call("GET", "/api/links");
    const rows = (await list.json()) as { id: number; clicks: number; visitors: number; targetUrl: string }[];
    const row = rows.find((r) => r.id === id)!;
    expect(row.clicks).toBe(3);
    expect(row.visitors).toBe(2);
    expect(row.targetUrl).toBe("https://example.com"); // aliased to camelCase
  });

  it("reports zero counts for a link with no clicks", async () => {
    const created = await call("POST", "/api/links", { slug: "empty", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };
    const list = await call("GET", "/api/links");
    const row = ((await list.json()) as { id: number; clicks: number; visitors: number }[]).find((r) => r.id === id)!;
    expect(row.clicks).toBe(0);
    expect(row.visitors).toBe(0);
  });

  it("renames a slug and repoints the target via PATCH", async () => {
    const created = await call("POST", "/api/links", { slug: "old", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };

    const res = await call("PATCH", `/api/links/${id}`, { slug: "new", targetUrl: "https://changed.com" });
    expect(res.status).toBe(200);
    const row = (await res.json()) as { slug: string; targetUrl: string };
    expect(row.slug).toBe("new");
    expect(row.targetUrl).toBe("https://changed.com");
  });

  it("PATCH updates only the provided field", async () => {
    const created = await call("POST", "/api/links", { slug: "keep", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };

    const res = await call("PATCH", `/api/links/${id}`, { targetUrl: "https://only-target.com" });
    expect(res.status).toBe(200);
    const row = (await res.json()) as { slug: string; targetUrl: string };
    expect(row.slug).toBe("keep");
    expect(row.targetUrl).toBe("https://only-target.com");
  });

  it("PATCH rejects renaming to an existing slug with 409", async () => {
    await call("POST", "/api/links", { slug: "taken", targetUrl: "https://example.com" });
    const created = await call("POST", "/api/links", { slug: "mine", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };

    const res = await call("PATCH", `/api/links/${id}`, { slug: "taken" });
    expect(res.status).toBe(409);
  });

  it("PATCH rejects an invalid slug, reserved slug, and non-http target with 400", async () => {
    const created = await call("POST", "/api/links", { slug: "edit", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };

    expect((await call("PATCH", `/api/links/${id}`, { slug: "Bad Slug" })).status).toBe(400);
    expect((await call("PATCH", `/api/links/${id}`, { slug: "api" })).status).toBe(400);
    expect((await call("PATCH", `/api/links/${id}`, { targetUrl: "javascript:alert(1)" })).status).toBe(400);
    expect((await call("PATCH", `/api/links/${id}`, {})).status).toBe(400);
  });

  it("PATCH returns 404 for a nonexistent id", async () => {
    const res = await call("PATCH", "/api/links/999999", { targetUrl: "https://example.com" });
    expect(res.status).toBe(404);
  });

  it("creates links listed and unpinned by default, and PATCH toggles both", async () => {
    const created = await call("POST", "/api/links", { slug: "flags", targetUrl: "https://example.com" });
    const row = (await created.json()) as { id: number; pinned: number; listed: number };
    expect([row.pinned, row.listed]).toEqual([0, 1]);

    const patched = await call("PATCH", `/api/links/${row.id}`, { pinned: true, listed: false });
    expect(patched.status).toBe(200);
    const list = (await (await call("GET", "/api/links")).json()) as { pinned: number; listed: number }[];
    expect([list[0].pinned, list[0].listed]).toEqual([1, 0]);
  });

  it("rejects non-boolean pinned/listed with 400", async () => {
    const bad = await call("POST", "/api/links", { slug: "bad", targetUrl: "https://example.com", pinned: "yes" });
    expect(bad.status).toBe(400);
    const created = await call("POST", "/api/links", { slug: "ok", targetUrl: "https://example.com" });
    const { id } = (await created.json()) as { id: number };
    expect((await call("PATCH", `/api/links/${id}`, { listed: 1 })).status).toBe(400);
  });

  it("exposes the public short-link base at /api/config", async () => {
    const res = await call("GET", "/api/config");
    expect(res.status).toBe(200);
    const cfg = (await res.json()) as { shortBase: string };
    expect(cfg.shortBase).toBe("https://example.test");
  });
});
