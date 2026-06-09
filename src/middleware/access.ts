import { createMiddleware } from "hono/factory";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Env } from "../index";

// Fix 2: module-scoped JWKS singleton, rebuilt only when the team domain changes,
// not on every request.
let jwksCache: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksDomain: string | undefined;
function getJwks(teamDomain: string) {
  if (!jwksCache || jwksDomain !== teamDomain) {
    jwksCache = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksDomain = teamDomain;
  }
  return jwksCache;
}

// In production, verifies the Cloudflare Access JWT. In tests, a shared-secret
// header (x-test-auth) stands in for the edge-enforced identity.
// Fix 1: bypass is gated behind the TEST_AUTH_KEY env binding, absent in
// wrangler.jsonc, so this branch is unreachable in production.
export const requireAccess = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.env.TEST_AUTH_KEY && c.req.header("x-test-auth") === c.env.TEST_AUTH_KEY) return next();

  const token = c.req.header("cf-access-jwt-assertion");
  if (!token) return c.json({ error: "unauthorized" }, 401);

  try {
    const jwks = getJwks(c.env.ACCESS_TEAM_DOMAIN);
    await jwtVerify(token, jwks, {
      issuer: `https://${c.env.ACCESS_TEAM_DOMAIN}`,
      audience: c.env.ACCESS_AUD,
      algorithms: ["RS256"], // Cloudflare Access signs with RS256; pin it to block alg-confusion.
    });
    return next();
  } catch (err) {
    // Fix 3: log infra failures so a misconfigured domain is distinguishable
    // from a legitimately bad token.
    console.error("Access JWT verification failed", err);
    return c.json({ error: "unauthorized" }, 401);
  }
});
