import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { desc, eq } from "drizzle-orm";
import { links, clicks } from "../db/schema";
import { buildTarget, isValidSlug } from "../lib/url";
import { visitorHash, dayKey, parseUserAgent } from "../lib/visitor";
import { LANDING_HTML, landingHtml } from "../landing";
import type { Env } from "../index";

export const redirect = new Hono<{ Bindings: Env }>();

const LATEST_LIMIT = 5;

// Public landing page instead of a bare 404, at the root and as the fallback for
// anything that isn't a live short link. The root also lists the newest live links;
// a D1 failure degrades to the plain page rather than a 500.
redirect.get("/", async (c) => {
  try {
    const latest = await drizzle(c.env.DB)
      .select({ slug: links.slug, title: links.title, targetUrl: links.targetUrl })
      .from(links)
      .where(eq(links.archived, 0))
      .orderBy(desc(links.createdAt), desc(links.id))
      .limit(LATEST_LIMIT);
    return c.html(landingHtml(latest));
  } catch (e) {
    console.error("latest links query failed", e);
    return c.html(LANDING_HTML);
  }
});

redirect.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  // Not slug-shaped (e.g. /favicon.ico, /robots.txt): skip the D1 lookup and the
  // NOT_FOUND_URL fallback; these are browser/probe noise, not missing links.
  if (!isValidSlug(slug)) return c.html(LANDING_HTML, 404);
  const db = drizzle(c.env.DB);
  const row = (await db.select().from(links).where(eq(links.slug, slug)).limit(1))[0];
  if (!row || row.archived) {
    if (c.env.NOT_FOUND_URL) return c.redirect(c.env.NOT_FOUND_URL, 302);
    return c.html(LANDING_HTML, 404);
  }
  const target = buildTarget(row.targetUrl, new URL(c.req.url).searchParams);
  // Fire-and-forget the click write; the redirect never waits on or fails for it,
  // but log failures (e.g. D1 write-quota exhaustion) rather than swallowing them.
  c.executionCtx.waitUntil(
    logClick(c.env, c.req.raw, row.id).catch((e) => console.error("click log failed", e))
  );
  return c.redirect(target, 302);
});

// Multi-segment paths or other methods on the public host: landing page, not a 404.
redirect.all("*", (c) => c.html(LANDING_HTML, 404));

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
