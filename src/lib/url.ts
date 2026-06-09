const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

// Slug-shaped names that collide with the Worker's own top-level routes
// (see src/index.ts: /api/*, /admin, /). They would be shadowed by those routes
// and never resolve as short links, so creation rejects them. Keep in sync with
// the routes registered in src/index.ts.
const RESERVED_SLUGS = new Set(["api", "admin"]);

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function buildTarget(targetUrl: string, incoming: URLSearchParams): string {
  const url = new URL(targetUrl);
  for (const key of UTM_KEYS) {
    const val = incoming.get(key);
    if (val !== null) url.searchParams.set(key, val);
  }
  return url.toString();
}
