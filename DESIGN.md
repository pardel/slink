# Slink: Design Spec

*The rationale behind the implementation. See the [README](./README.md) for setup and operations.*

## Objective

Slink is a self-hosted, open-source link shortener with click analytics,
built to replace a paid bitly subscription for tracking links used in
presentations. It runs entirely on Cloudflare's free tier (Workers + D1),
so it has zero recurring cost and never pauses, which means a QR code on a
slide keeps resolving long after the talk.

"Done" looks like: a single deployed Cloudflare Worker where the admin can sign
in (via Cloudflare Access), create short links with custom slugs, hand out
the resulting URL or QR code, and afterwards see per-link analytics
(clicks over time, countries, devices, referrers, unique vs total).

### In scope

- Custom-slug short links pointing at arbitrary target URLs.
- Fast redirects with UTM parameter preservation/merging.
- Per-click analytics: timestamp, country, city, referrer, device, browser.
- Unique-vs-total visitor counts, computed privacy-first.
- QR code generation for any link, downloadable for slides.
- Single-admin access gated by Cloudflare Access.
- One-command deploy via Wrangler; $0 hosting.

### Out of scope (non-goals)

- Multi-user accounts, public sign-up, per-user link spaces.
- Geo heat-maps, CSV export, A/B link splitting (revisit only if wanted).
- Link expiry/scheduling, password-protected links.
- A second backend service or any always-on server process.

## Architecture

One Cloudflare Worker (TypeScript) owns three concerns behind one
deployment, routed with Hono:

```
                         ┌──────────────────────────────┐
   public visitor  ───►  │  GET /:slug                  │ ──► 302 to target
                         │   (redirect hot path)        │     │
                         └──────────────────────────────┘     │ ctx.waitUntil
                                                               ▼
   Admin (Cloudflare     ┌──────────────────────────────┐   D1: insert click
   Access gate)    ───►  │  /api/*   link CRUD + stats   │ ◄──► D1 (SQLite)
                         │  /, /admin  React dashboard   │
                         └──────────────────────────────┘
```

### Request flows

**Redirect (the hot path).** `GET /:slug`:
1. Look up the slug in D1 (`links` table).
2. If found, build the target URL, merging any incoming UTM query params
   onto it, and return a **302** (never a 301: browsers cache 301s hard,
   so repeat clicks would never reach the Worker and counts would
   undercount).
3. `ctx.waitUntil(logClick(...))` records the click *after* the response is
   already on its way, so the visitor never waits on the analytics write.
4. If not found, return a 404 (optionally a configurable fallback URL).

**Admin + API.** `/admin` and `/api/*` sit behind Cloudflare Access. The
React dashboard calls the JSON API to create/list/archive links and to read
analytics. Cloudflare Access enforces identity at the edge before the
request reaches application code.

## Data model (D1 / SQLite)

```sql
CREATE TABLE links (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  target_url  TEXT NOT NULL,
  title       TEXT,
  created_at  INTEGER NOT NULL,   -- epoch ms
  archived    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE clicks (
  id            INTEGER PRIMARY KEY,
  link_id       INTEGER NOT NULL REFERENCES links(id),
  ts            INTEGER NOT NULL, -- epoch ms
  country       TEXT,             -- request.cf.country
  city          TEXT,             -- request.cf.city
  referrer      TEXT,
  ua_device     TEXT,             -- parsed from User-Agent
  ua_browser    TEXT,
  visitor_hash  TEXT              -- privacy-first unique key, see below
);

CREATE INDEX idx_clicks_link_ts ON clicks(link_id, ts);
```

Analytics are plain SQL aggregations over `clicks`: time-series via
`GROUP BY` on a truncated `ts`, top countries/devices via `GROUP BY`,
unique visitors via `COUNT(DISTINCT visitor_hash)`.

Geo (`country`, `city`) is read directly from `request.cf` on every Worker
request, so no IP-to-location dataset is bundled or queried.

## Auth: Cloudflare Access

`/admin` and `/api/*` are protected by a Cloudflare Access application
(Zero Trust free plan, up to 50 users). The admin authenticates with **Google**
as the identity provider and Access issues a signed JWT that Cloudflare
validates at the edge. The Worker optionally re-verifies the
`Cf-Access-Jwt-Assertion` header for defence in depth. `GET /:slug` is
explicitly left public.

This means there is no password storage, no session table, and no auth code
to maintain in the app itself.

## Privacy-first unique visitors

`visitor_hash = SHA-256(ip | user-agent | HASH_SALT | day)`, where `HASH_SALT`
is a **static** Worker secret and `day` is the UTC date.

- The raw IP is never stored, only the hash.
- Mixing the UTC `day` into the input means the same visitor hashes differently
  each day, so a hash cannot link a visitor across days.
- The hash de-identifies visitors against anyone holding the database **without**
  `HASH_SALT`. It is **not** irreversible against an adversary holding *both* the
  database and `HASH_SALT`: the IPv4 space (~2^32) is small enough to brute-force.
  Keep `HASH_SALT` stored separately from any database backup/export. (Note: the
  salt does not rotate; the daily component is the date, mixed into the hash
  input. An earlier draft of this doc described a "daily-rotating salt", which
  the implementation never did.)
- No cookie is set, so no cookie-consent banner is required.
- Clicks are pruned after `CLICKS_RETENTION_DAYS` (default 180) by a daily Cron
  Trigger (`scheduled` handler), bounding how long pseudonymous data is retained.

Unique visitors for a link/period = `COUNT(DISTINCT visitor_hash)`; total =
`COUNT(*)`. This keeps the tool GDPR-light, which matters for UK use.

## Stack and tooling

| Concern | Choice | Why |
|---|---|---|
| Runtime | Cloudflare Workers (TypeScript) | $0, always-on, edge geo for free |
| Router | Hono | First-class Workers support, tiny, typed |
| Database | Cloudflare D1 (SQLite) | $0 free tier, SQL, same engine as local dev |
| ORM/migrations | Drizzle (D1 adapter) | Type-safe queries, owns schema migrations |
| Dashboard | Vite + React + Tailwind | Lightweight SPA, no router dependency |
| QR codes | client-side `qrcode` lib | Downloadable SVG/PNG for slides; keeps Worker lean |
| Dev/deploy | Wrangler | `wrangler dev` locally, `wrangler deploy` to ship |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` | Runs against the real Workers runtime and a local D1 |

The dashboard is served as Cloudflare Static Assets from the same Worker, so
there is a single artefact and a single deploy.

## Testing strategy

- **Redirect logic**: unit + integration tests asserting 302 status, correct
  target, UTM merge behaviour, and 404 on unknown slugs.
- **Click logging**: a known request produces exactly one `clicks` row with
  the expected geo/device fields; the redirect response does not block on it.
- **Analytics queries**: seeded `clicks` data returns correct time-series,
  top-N, and unique-vs-total numbers.
- **Auth**: requests to `/api/*` without a valid Access assertion are
  rejected; `/:slug` is reachable without auth.
- Tests run in `@cloudflare/vitest-pool-workers` so D1 and `request.cf`
  behave as they do in production.

## Deployment

1. `wrangler d1 create slink` and bind it in `wrangler.jsonc`.
2. `wrangler d1 migrations apply` to create the schema.
3. Configure a Cloudflare Access application over `/admin*` and `/api*`
   (path-prefix wildcards), with Google as the identity provider. Leave
   `/:slug` outside the policy so short links stay public.
4. `wrangler deploy`. Serves on two custom domains: `example.com` (public
   redirects) and `admin.example.com` (admin dashboard + API), bound via `routes` +
   `custom_domain` (provisions DNS); `workers_dev:false` disables `*.workers.dev`.
   Put a Cloudflare Access app over the whole `admin.example.com` host.

## Success criteria

- Creating a link via the dashboard yields a working short URL and a
  downloadable QR code.
- Following a short link 302-redirects to the target with UTM params merged.
- The dashboard shows, per link: total clicks, unique visitors, a clicks
  time-series, top countries, and top devices/browsers.
- `/api/*` and `/admin` are unreachable without Cloudflare Access; `/:slug`
  is reachable by anyone.
- The whole stack deploys with Wrangler and incurs no recurring cost.
- The test suite passes against the Workers runtime.

## Resolved decisions

- **Custom domains (split)**: `example.com` serves only public short-link redirects;
  `admin.example.com` serves the dashboard (at root) + API behind Cloudflare Access. Both
  are bound on one Worker via `routes` + `custom_domain`; the Worker dispatches by
  hostname (`PUBLIC_HOST`). `workers_dev:false` disables the `*.workers.dev` URL.
- **Cloudflare Access identity provider**: Google.

## Implementation notes (deviations from this spec)

Recorded 2026-06-07 after the build + review. This spec is the canonical intent;
the shipped code deviates from it in these load-bearing ways:

- **Host-split routing (2026-06-08, supersedes the single-host `/admin` design).**
  The Worker runs first (`run_worker_first: true`) and dispatches by hostname:
  `PUBLIC_HOST` (`example.com`) serves only `/:slug` redirects; every other host
  (`admin.example.com`, or `localhost` in dev) serves the dashboard SPA at the **root**
  plus the Access-gated `/api`. (An earlier iteration served the dashboard under
  an `/admin/` prefix on one host; the `admin.example.com` split replaced it.)
- **Access covers the whole admin host.** Cloudflare Access protects all of
  `admin.example.com`; `example.com` is fully public. The Worker additionally re-verifies the
  Access JWT on `/api/*` (RS256-pinned) and 404s `/api` on the public host, so no
  data is exposed even if edge Access is misconfigured.
- **Test-auth seam.** A `TEST_AUTH_KEY` env binding (set only in
  `vitest.config.ts`, absent from `wrangler.jsonc`) lets the in-runtime test suite
  bypass Access; the branch is unreachable in production.
- **`compatibility_date`** shipped as `2025-09-23`.
- **Review hardening (2026-06-07).** Creation rejects reserved slugs (`api`,
  `admin`) and non-http(s) target URLs; `:id` params are validated (400 on
  non-numeric, 404 on archiving a nonexistent link); the `/:slug` read path skips
  the D1 lookup for non-slug-shaped paths (`/favicon.ico` etc.).
