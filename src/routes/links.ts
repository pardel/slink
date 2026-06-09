import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { links, clicks } from "../db/schema";
import { isValidSlug, isReservedSlug } from "../lib/url";
import type { Env } from "../index";

export const linksApi = new Hono<{ Bindings: Env }>();

linksApi.get("/", async (c) => {
  // Include aggregate click + unique-visitor counts per link (one grouped join,
  // not N per-row stats calls) so the list can show them on each card. Columns are
  // aliased to camelCase to match the JSON the dashboard already expects. Newest first.
  const rows = await c.env.DB.prepare(
    `SELECT l.id, l.slug, l.target_url AS targetUrl, l.title, l.created_at AS createdAt, l.archived,
            COUNT(c.id) AS clicks, COUNT(DISTINCT c.visitor_hash) AS visitors
       FROM links l
       LEFT JOIN clicks c ON c.link_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC`
  ).all();
  return c.json(rows.results);
});

linksApi.post("/", async (c) => {
  let body: { slug?: unknown; targetUrl?: unknown; title?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  if (typeof body.slug !== "string" || typeof body.targetUrl !== "string") {
    return c.json({ error: "slug and targetUrl are required" }, 400);
  }
  const slug = body.slug;
  const targetUrl = body.targetUrl;
  const title = typeof body.title === "string" ? body.title : null;
  if (!isValidSlug(slug)) return c.json({ error: "invalid slug" }, 400);
  if (isReservedSlug(slug)) return c.json({ error: "reserved slug" }, 400);
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return c.json({ error: "invalid targetUrl" }, 400);
  }
  // Only http(s) targets: `new URL` happily parses javascript:/data:/file: etc.,
  // which would make /:slug an open redirect to a script/data URI.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return c.json({ error: "targetUrl must be http or https" }, 400);
  }
  const db = drizzle(c.env.DB);
  try {
    const [row] = await db
      .insert(links)
      .values({ slug, targetUrl, title, createdAt: Date.now() })
      .returning();
    return c.json(row, 201);
  } catch (e) {
    const msg = String(e) + String((e as { cause?: unknown }).cause ?? "");
    if (msg.includes("UNIQUE")) return c.json({ error: "slug already exists" }, 409);
    throw e;
  }
});

// Partial update: rename the slug and/or repoint the target. Only the provided
// fields change. Slug and targetUrl are re-validated exactly like creation, and a
// slug collision maps to 409 (not a bare 500). Changing the slug breaks any links
// or QR codes that pointed at the old one; that's the caller's call to make.
linksApi.patch("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  let body: { slug?: unknown; targetUrl?: unknown; title?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const updates: { slug?: string; targetUrl?: string; title?: string | null } = {};
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string" || !isValidSlug(body.slug)) return c.json({ error: "invalid slug" }, 400);
    if (isReservedSlug(body.slug)) return c.json({ error: "reserved slug" }, 400);
    updates.slug = body.slug;
  }
  if (body.targetUrl !== undefined) {
    if (typeof body.targetUrl !== "string") return c.json({ error: "invalid targetUrl" }, 400);
    let parsed: URL;
    try {
      parsed = new URL(body.targetUrl);
    } catch {
      return c.json({ error: "invalid targetUrl" }, 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return c.json({ error: "targetUrl must be http or https" }, 400);
    }
    updates.targetUrl = body.targetUrl;
  }
  if (body.title !== undefined) updates.title = typeof body.title === "string" ? body.title : null;
  if (Object.keys(updates).length === 0) return c.json({ error: "no fields to update" }, 400);

  const db = drizzle(c.env.DB);
  try {
    const updated = await db.update(links).set(updates).where(eq(links.id, id)).returning();
    if (updated.length === 0) return c.json({ error: "not found" }, 404);
    return c.json(updated[0]);
  } catch (e) {
    const msg = String(e) + String((e as { cause?: unknown }).cause ?? "");
    if (msg.includes("UNIQUE")) return c.json({ error: "slug already exists" }, 409);
    throw e;
  }
});

linksApi.post("/:id/archive", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(links).set({ archived: 1 }).where(eq(links.id, id)).returning();
  if (updated.length === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

linksApi.post("/:id/unarchive", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  const db = drizzle(c.env.DB);
  const updated = await db.update(links).set({ archived: 0 }).where(eq(links.id, id)).returning();
  if (updated.length === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

linksApi.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  const db = drizzle(c.env.DB);
  // Delete the link's clicks first (explicit, so it holds even if D1 isn't
  // enforcing the ON DELETE CASCADE), then the link; empty return => 404.
  await db.delete(clicks).where(eq(clicks.linkId, id));
  const deleted = await db.delete(links).where(eq(links.id, id)).returning();
  if (deleted.length === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});
