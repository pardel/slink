# Slink

A URL shortener on Cloudflare Workers: a public redirect host plus an
Access-protected admin dashboard with per-link and account-wide analytics.

## Commands

```bash
npm run dev              # wrangler dev (Worker + dashboard at :8787)
npm test                 # vitest (Workers pool): backend tests
npm run typecheck        # tsc --noEmit (worker)
npm run build:dashboard  # vite build -> dashboard/dist
npm run deploy           # build dashboard + wrangler deploy
npx tsc --noEmit -p dashboard/tsconfig.json   # typecheck the React dashboard
```

## Architecture

- **One Worker, two hosts** (dispatched by hostname in `src/index.ts`):
  - `example.com` (`PUBLIC_HOST`) serves ONLY the public side: short-link redirects
    (`GET /:slug`), a no-redirect preview (`GET /:slug+`, logs no click), and the page
    at `/` listing the newest listed links, pinned first (10 by default,
    `PUBLIC_LINKS` to change, max 50) (`src/landing.ts`, no JS).
    Optional `OWNER_NAME` / `OWNER_URL` vars add a "Links by ..." line to that page.
  - `admin.example.com` serves the React dashboard (SPA from the `ASSETS` binding) and the
    `/api/*` JSON API.
- **Auth**: `admin.example.com` is behind a Cloudflare Access app; `/api/*` is re-verified
  in-Worker (`src/middleware/access.ts`) against `ACCESS_TEAM_DOMAIN` + `ACCESS_AUD`.
  `example.com` is intentionally public. Setup steps: README, "Cloudflare Access".
- **Data**: D1 (`DB` binding): `links` and `clicks` tables (`src/db/schema.ts`).
  Clicks are logged fire-and-forget on redirect; a daily cron prunes clicks older
  than `CLICKS_RETENTION_DAYS`.
- **Dashboard** (`dashboard/`): React + Vite + Tailwind, History-API router
  (`router.ts`, no router dep). Routes: `/` (list), `/analytics`, `/links/:slug`.
  Fonts self-hosted via `@fontsource` so the strict `'self'` CSP needs no exception.

## API (all `/api/*` is admin-only, Access-guarded)

- `GET  /api/config` → `{ shortBase, email }` (email from the Access JWT header)
- `GET  /api/links` → links **with aggregate `clicks` + unique `visitors` counts**
  (one grouped `LEFT JOIN clicks`), newest first
- `POST /api/links` `{ slug, targetUrl, title?, pinned?, listed? }` → 201 (409 on duplicate slug)
- `PATCH /api/links/:id` `{ slug?, targetUrl?, title?, pinned?, listed? }` → partial update / rename
  (re-validates slug + target; 409 on slug collision). `pinned` / `listed` are JSON
  booleans stored as 0/1: pinned links lead the public page, unlisted ones never
  appear on it but still redirect. New links default to listed, unpinned.
- `POST /api/links/:id/archive` · `POST /api/links/:id/unarchive` · `DELETE /api/links/:id`

### Analytics endpoints

Both accept an optional time window via query params: **`?from=<epoch-ms inclusive>&to=<epoch-ms exclusive>`** (either bound omittable; absent = all time).

- `GET /api/links/:id/stats` → per-link analytics:
  `{ total, unique, byCountry[], byBrowser[], byDevice[], byReferrer[], series[] }`
  (`series` is `{ day, n }` where `day = ts / 86_400_000`, the UTC epoch-day bucket).
- `GET /api/stats` → **account-wide overview across all links**: the same fields as
  above, plus `{ links, activeLinks, topLinks[] }` where `topLinks` is the busiest
  links by clicks (`{ id, slug, targetUrl, clicks }`). Link counts are NOT
  time-filtered (inventory, not click-based).

Implementation: `src/routes/stats.ts`. The window is applied as `ts >= from AND ts < to`.
For the overview's `topLinks`, the ts filter lives in the **`JOIN ... ON` clause**, not a
`WHERE`, so links with zero in-window clicks still appear with `clicks: 0` (a `WHERE`
would collapse the `LEFT JOIN`). The dashboard's shared `PeriodControl` (7d / 30d /
all / custom range) drives both views.

## Conventions / gotchas

- **`ASSETS.fetch()` responses have immutable headers**: the `app.all("*")` handler
  returns `new Response(res.body, res)` so `secureHeaders` middleware can attach CSP
  without throwing. Regression test in `test/security-headers.test.ts`.
- **CSP is `'self'`-only** (`src/index.ts`): no third-party scripts/fonts/styles. QR
  codes and favicons are generated/derived client-side, never fetched.
- Slug validation lives in `src/lib/url.ts` (`isValidSlug`, `isReservedSlug`);
  duplicate slugs map a D1 `UNIQUE` error to 409, not 500.
- `wrangler.jsonc` holds real production IDs locally but is kept OUT of git commits
  (the repo otherwise uses `REPLACE_*` placeholders).
- Backend tests authenticate via the `x-test-auth` header (gated behind `TEST_AUTH_KEY`,
  absent in production). The vitest config wires `DB` + an `ASSETS` fixture binding.
- **Dependency pins.** `vitest` stays on 4 until `@cloudflare/vitest-pool-workers`
  supports 5 (0.22.0 declares `vitest: ^4.1.0`). The `sharp` entry in `overrides`
  lifts the copy nested under the pool's own pinned wrangler to a patched release;
  drop it once the pool ships a wrangler with sharp >= 0.35.4.
