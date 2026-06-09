import { Hono } from "hono";
import type { Env } from "../index";

// Account-wide analytics across every link. Same breakdowns as the per-link view
// (minus the link_id filter), plus link totals and a top-links-by-clicks ranking.
export const overviewApi = new Hono<{ Bindings: Env }>();

overviewApi.get("/", async (c) => {
  const db = c.env.DB;

  // Optional ts window (epoch ms): ?from=<inclusive>&to=<exclusive>. Invalid/absent
  // values are treated as unbounded. Only click-based metrics are time-filtered;
  // link inventory counts are not.
  const url = new URL(c.req.url);
  const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const from = num(url.searchParams.get("from"));
  const to = num(url.searchParams.get("to"));
  const conds: string[] = [];
  const binds: number[] = [];
  if (from !== null) { conds.push("ts >= ?"); binds.push(from); }
  if (to !== null) { conds.push("ts < ?"); binds.push(to); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const andConds = conds.length ? `AND ${conds.join(" AND ")}` : ""; // for queries with an existing WHERE
  // For the LEFT JOIN, the ts filter must live in ON (not WHERE) so links with zero
  // in-window clicks survive the join with a 0 count instead of being dropped.
  const joinTs = conds.map((cnd) => `AND c.${cnd}`).join(" ");

  const totals = await db
    .prepare(`SELECT COUNT(*) AS total, COUNT(DISTINCT visitor_hash) AS unique_n FROM clicks ${where}`)
    .bind(...binds)
    .first<{ total: number; unique_n: number }>();

  const linkTotals = await db
    .prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) AS active FROM links")
    .first<{ total: number; active: number }>();

  const byCountry = await db
    .prepare(`SELECT country, COUNT(*) AS n FROM clicks ${where} GROUP BY country ORDER BY n DESC LIMIT 8`)
    .bind(...binds)
    .all<{ country: string; n: number }>();

  const byBrowser = await db
    .prepare(`SELECT ua_browser AS browser, COUNT(*) AS n FROM clicks ${where} GROUP BY ua_browser ORDER BY n DESC LIMIT 8`)
    .bind(...binds)
    .all<{ browser: string; n: number }>();

  const byDevice = await db
    .prepare(`SELECT ua_device AS device, COUNT(*) AS n FROM clicks ${where} GROUP BY ua_device ORDER BY n DESC`)
    .bind(...binds)
    .all<{ device: string; n: number }>();

  const byReferrer = await db
    .prepare(`SELECT referrer, COUNT(*) AS n FROM clicks WHERE referrer IS NOT NULL ${andConds} GROUP BY referrer ORDER BY n DESC LIMIT 8`)
    .bind(...binds)
    .all<{ referrer: string; n: number }>();

  const series = await db
    .prepare(`SELECT (ts/86400000) AS day, COUNT(*) AS n FROM clicks ${where} GROUP BY day ORDER BY day`)
    .bind(...binds)
    .all<{ day: number; n: number }>();

  const topLinks = await db
    .prepare(
      `SELECT l.id, l.slug, l.target_url AS targetUrl, COUNT(c.id) AS clicks
         FROM links l LEFT JOIN clicks c ON c.link_id = l.id ${joinTs}
        GROUP BY l.id ORDER BY clicks DESC, l.created_at DESC LIMIT 8`
    )
    .bind(...binds)
    .all<{ id: number; slug: string; targetUrl: string; clicks: number }>();

  return c.json({
    total: totals?.total ?? 0,
    unique: totals?.unique_n ?? 0,
    links: linkTotals?.total ?? 0,
    activeLinks: linkTotals?.active ?? 0,
    byCountry: byCountry.results,
    byBrowser: byBrowser.results,
    byDevice: byDevice.results,
    byReferrer: byReferrer.results,
    series: series.results,
    topLinks: topLinks.results,
  });
});

export const statsApi = new Hono<{ Bindings: Env }>();

statsApi.get("/:id/stats", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  const db = c.env.DB;

  // Optional ts window (epoch ms): ?from=<inclusive>&to=<exclusive>, same as the
  // account-wide overview. Every query already filters by link_id, so the window
  // is just additional AND conditions; binds are [id, ...windowBinds].
  const url = new URL(c.req.url);
  const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  const from = num(url.searchParams.get("from"));
  const to = num(url.searchParams.get("to"));
  const conds: string[] = [];
  const windowBinds: number[] = [];
  if (from !== null) { conds.push("ts >= ?"); windowBinds.push(from); }
  if (to !== null) { conds.push("ts < ?"); windowBinds.push(to); }
  const w = conds.length ? `AND ${conds.join(" AND ")}` : "";
  const binds = [id, ...windowBinds];

  const totals = await db
    .prepare(`SELECT COUNT(*) AS total, COUNT(DISTINCT visitor_hash) AS unique_n FROM clicks WHERE link_id = ? ${w}`)
    .bind(...binds)
    .first<{ total: number; unique_n: number }>();

  const byCountry = await db
    .prepare(`SELECT country, COUNT(*) AS n FROM clicks WHERE link_id = ? ${w} GROUP BY country ORDER BY n DESC`)
    .bind(...binds)
    .all<{ country: string; n: number }>();

  const byBrowser = await db
    .prepare(`SELECT ua_browser AS browser, COUNT(*) AS n FROM clicks WHERE link_id = ? ${w} GROUP BY ua_browser ORDER BY n DESC`)
    .bind(...binds)
    .all<{ browser: string; n: number }>();

  const byDevice = await db
    .prepare(`SELECT ua_device AS device, COUNT(*) AS n FROM clicks WHERE link_id = ? ${w} GROUP BY ua_device ORDER BY n DESC`)
    .bind(...binds)
    .all<{ device: string; n: number }>();

  const byReferrer = await db
    .prepare(`SELECT referrer, COUNT(*) AS n FROM clicks WHERE link_id = ? AND referrer IS NOT NULL ${w} GROUP BY referrer ORDER BY n DESC`)
    .bind(...binds)
    .all<{ referrer: string; n: number }>();

  const series = await db
    .prepare(`SELECT (ts/86400000) AS day, COUNT(*) AS n FROM clicks WHERE link_id = ? ${w} GROUP BY day ORDER BY day`)
    .bind(...binds)
    .all<{ day: number; n: number }>();

  return c.json({
    total: totals?.total ?? 0,
    unique: totals?.unique_n ?? 0,
    byCountry: byCountry.results,
    byBrowser: byBrowser.results,
    byDevice: byDevice.results,
    byReferrer: byReferrer.results,
    series: series.results,
  });
});
