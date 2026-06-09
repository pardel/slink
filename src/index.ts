import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { redirect } from "./routes/redirect";
import { linksApi } from "./routes/links";
import { statsApi, overviewApi } from "./routes/stats";
import { requireAccess } from "./middleware/access";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  HASH_SALT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  PUBLIC_HOST: string;
  SHORT_BASE_URL: string;
  NOT_FOUND_URL?: string;
  TEST_AUTH_KEY?: string;
  CLICKS_RETENTION_DAYS?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Defence-in-depth headers on every response. CSP allows the SPA's own bundle,
// inline style attributes (the analytics bar widths), and data: QR images.
app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
    referrerPolicy: "strict-origin-when-cross-origin",
  })
);

// Log unhandled errors (persisted via observability) and return a clean 500
// instead of Hono's bare default, e.g. an unexpected D1 failure on any route.
app.onError((err, c) => {
  console.error("Unhandled error", err);
  return c.json({ error: "internal error" }, 500);
});

// /api is admin-only (never served on the public redirect host) and is
// Access-guarded (re-verified here for defence in depth on top of edge Access).
app.use("/api/*", async (c, next) => {
  if (new URL(c.req.url).hostname === c.env.PUBLIC_HOST) return c.notFound();
  return next();
});
app.use("/api/*", requireAccess);
// The dashboard reads its public short-link base (e.g. https://example.com) from here.
// Cloudflare Access injects the verified user's email on every request to a guarded
// host; surface it so the dashboard can show who's signed in.
app.get("/api/config", (c) =>
  c.json({ shortBase: c.env.SHORT_BASE_URL, email: c.req.header("cf-access-authenticated-user-email") ?? null })
);
app.route("/api/links", linksApi);
app.route("/api/links", statsApi);
app.route("/api/stats", overviewApi);

// Host split. PUBLIC_HOST (example.com) serves ONLY short-link redirects; every
// other host (the admin domain admin.example.com, or localhost in dev) serves the
// dashboard SPA from the root.
app.all("*", async (c) => {
  if (new URL(c.req.url).hostname === c.env.PUBLIC_HOST) {
    return redirect.fetch(c.req.raw, c.env, c.executionCtx);
  }
  let res = await c.env.ASSETS.fetch(c.req.raw);
  if (res.status === 404) {
    // SPA fallback: unknown client-side routes serve index.html, not 404.
    res = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url).toString(), c.req.raw));
  }
  // ASSETS responses have immutable headers; copy into a fresh, mutable Response so
  // the secureHeaders middleware can attach CSP/referrer headers without throwing
  // "Can't modify immutable headers" (which onError would surface as a 500).
  return new Response(res.body, res);
});

// Retention: a daily Cron Trigger prunes clicks older than CLICKS_RETENTION_DAYS
// (default 180). Bounds storage growth and gives a concrete GDPR retention window.
async function scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
  const parsed = Number(env.CLICKS_RETENTION_DAYS ?? "180");
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : 180;
  const cutoff = Date.now() - days * 86_400_000;
  await env.DB.prepare("DELETE FROM clicks WHERE ts < ?").bind(cutoff).run();
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => app.fetch(request, env, ctx),
  scheduled,
};
