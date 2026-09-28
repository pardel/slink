import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq } from "drizzle-orm";
import { links, clicks } from "../db/schema";
import { buildTarget, isValidSlug } from "../lib/url";
import { visitorHash, dayKey, parseUserAgent } from "../lib/visitor";
import { landingHtml } from "../landing";
import type { Env } from "../index";

export const redirect = new Hono<{ Bindings: Env }>();

// How many links the public page lists: PUBLIC_LINKS if set to a sane number,
// otherwise 10. Capped so a typo can't turn the page into a full index.
const DEFAULT_PUBLIC_LINKS = 10;
const MAX_PUBLIC_LINKS = 50;
const publicLinks = (env: Env) => {
  const n = Number(env.PUBLIC_LINKS);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_PUBLIC_LINKS) : DEFAULT_PUBLIC_LINKS;
};

// The page is headed with the host it was reached on, so it reads right on any
// instance without extra config.
const hostOf = (url: string) => new URL(url).host;
const notFound = (url: string) => landingHtml({ host: hostOf(url), notFound: true });
const ownerOf = (env: Env) => (env.OWNER_NAME ? { name: env.OWNER_NAME, url: env.OWNER_URL || undefined } : undefined);

// Public landing page instead of a bare 404, at the root and as the fallback for
// anything that isn't a live short link. The root lists the newest listed links,
// pinned first; a D1 failure degrades to the plain page rather than a 500.
redirect.get("/", async (c) => {
  try {
    const latest = await drizzle(c.env.DB)
      .select({ slug: links.slug, title: links.title, targetUrl: links.targetUrl, createdAt: links.createdAt, pinned: links.pinned })
      .from(links)
      .where(and(eq(links.archived, 0), eq(links.listed, 1)))
      .orderBy(desc(links.pinned), desc(links.createdAt), desc(links.id))
      .limit(publicLinks(c.env));
    return c.html(landingHtml({ host: hostOf(c.req.url), owner: ownerOf(c.env), latest }));
  } catch (e) {
    console.error("latest links query failed", e);
    return c.html(landingHtml({ host: hostOf(c.req.url), owner: ownerOf(c.env) }));
  }
});

redirect.get("/:slug", async (c) => {
  let slug = c.req.param("slug");
  // /<slug>+ previews the link instead of following it: no redirect, no click logged.
  // Unlisted links preview too; anyone holding the short link can already follow it.
  if (slug.endsWith("+")) {
    slug = slug.slice(0, -1);
    if (!isValidSlug(slug)) return c.html(notFound(c.req.url), 404);
    const row = (await drizzle(c.env.DB).select().from(links).where(eq(links.slug, slug)).limit(1))[0];
    if (!row || row.archived) return c.html(notFound(c.req.url), 404);
    return c.html(landingHtml({ host: hostOf(c.req.url), preview: row }));
  }
  // Not slug-shaped (e.g. /favicon.ico, /robots.txt): skip the D1 lookup and the
  // NOT_FOUND_URL fallback; these are browser/probe noise, not missing links.
  if (!isValidSlug(slug)) return c.html(notFound(c.req.url), 404);
  const db = drizzle(c.env.DB);
  const row = (await db.select().from(links).where(eq(links.slug, slug)).limit(1))[0];
  if (!row || row.archived) {
    if (c.env.NOT_FOUND_URL) return c.redirect(c.env.NOT_FOUND_URL, 302);
    return c.html(notFound(c.req.url), 404);
  }
  const target = buildTarget(row.targetUrl, new URL(c.req.url).searchParams);
  // Fire-and-forget the click write; the redirect never waits on or fails for it,
  // but log failures (e.g. D1 write-quota exhaustion) rather than swallowing them.
  // GET only: Hono routes HEAD through this handler, and a HEAD is a link checker
  // or crawler probing the redirect, not a visit.
  if (c.req.method === "GET") {
    c.executionCtx.waitUntil(
      logClick(c.env, c.req.raw, row.id).catch((e) => console.error("click log failed", e))
    );
  }
  return c.redirect(target, 302);
});

// Multi-segment paths or other methods on the public host: landing page, not a 404.
redirect.all("*", (c) => c.html(notFound(c.req.url), 404));

async function logClick(envBindings: Env, req: Request, linkId: number): Promise<void> {
  const cf = (req.cf ?? {}) as { country?: string; city?: string };
  const ua = req.headers.get("user-agent") ?? "";
  const ip = req.headers.get("cf-connecting-ip") ?? "";
  const ts = Date.now();
  const { device, browser } = parseUserAgent(ua);
  const vhash = await visitorHash(ip, ua, envBindings.HASH_SALT, dayKey(ts));
  const db = drizzle(envBindings.DB);
  await db.insert(clicks).values({
    linkId,
    ts,
    country: cf.country ?? null,
    city: cf.city ?? null,
    referrer: referrerOrigin(req.headers.get("referer")),
    uaDevice: device,
    uaBrowser: browser,
    visitorHash: vhash,
  });
}

// Store only the referrer's origin (scheme+host). Full referrer URLs routinely
// carry secrets/PII in the path or query (OAuth code/state, magic-login tokens,
// webmail compose?to=...); the origin alone is all the "top referrers" view needs.
function referrerOrigin(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
