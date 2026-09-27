// Public landing page for PUBLIC_HOST (example.com). Shown at the root and as the
// fallback for any path that isn't a live short link, instead of a bare 404.
// Self-contained HTML (inline <style>, no JS, no external fonts) so it works under
// the strict 'self' + 'unsafe-inline'-styles CSP with no extra requests.

const REPO_URL = "https://github.com/pardel/slink";

// The Slink logo (assets/logo.svg, dashboard/public/favicon.svg): the page's mark
// and, URL-encoded so its own double-quotes don't terminate the href="" attribute,
// its data-URI favicon.
const LOGO_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
  `<rect width="512" height="512" rx="112" fill="#0f172a"/>` +
  `<g transform="translate(88 88) scale(14)" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" stroke="#818cf8"/>` +
  `<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" stroke="#e2e8f0"/>` +
  `</g></svg>`;
const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

// The newest live links, shown above the private-instance notice on the root page.
export interface LatestLink {
  slug: string;
  title: string | null;
  targetUrl: string;
}

// Titles are free text entered in the dashboard, so everything interpolated into
// the page is escaped.
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function label(link: LatestLink): string {
  if (link.title) return link.title;
  try {
    return new URL(link.targetUrl).hostname;
  } catch {
    return link.targetUrl;
  }
}

function latestList(latest: LatestLink[]): string {
  if (latest.length === 0) return "";
  const items = latest
    .map(
      (l) =>
        `<li><a href="/${esc(l.slug)}"><span class="slug">/${esc(l.slug)}</span><span class="label">${esc(label(l))}</span></a></li>`
    )
    .join("");
  return `<section class="latest" aria-labelledby="latest-h"><h2 id="latest-h">Latest links</h2><ul>${items}</ul></section>`;
}

export function landingHtml(latest: LatestLink[] = []): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#171A21" />
<title>Slink</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}" />
<style>
  :root {
    --canvas: #F3F4F7; --ink: #171A21; --muted: #6B7280; --line: #E8EAEF; --accent: #4F46E5;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    background: var(--canvas);
    color: var(--ink);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: grid; place-items: center; padding: 24px;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 100%; max-width: 460px; background: #fff; border: 1px solid var(--line);
    border-radius: 16px; padding: 40px 36px;
    box-shadow: 0 1px 0 0 rgba(23,26,33,.04), 0 24px 60px -32px rgba(23,26,33,.30);
    text-align: center;
  }
  .mark { width: 56px; height: 56px; margin: 0 auto 20px; display: block; }
  h1 { font-size: 30px; letter-spacing: -.02em; margin: 0 0 8px; }
  h1 .dot { color: var(--accent); }
  p { color: var(--muted); line-height: 1.6; margin: 0 auto 8px; max-width: 36ch; }
  .lede { color: var(--ink); font-size: 17px; }
  .cta {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 24px;
    background: var(--ink); color: #fff; text-decoration: none;
    padding: 11px 18px; border-radius: 10px; font-weight: 500; font-size: 15px;
    transition: background .15s ease;
  }
  .cta:hover { background: var(--accent); }
  .foot { margin-top: 22px; font-size: 13px; color: var(--muted); }
  .foot code { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .latest { margin: 24px 0 20px; text-align: left; }
  .latest h2 {
    font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 8px;
  }
  .latest ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
  .latest li { border-bottom: 1px solid var(--line); }
  .latest a {
    display: flex; align-items: baseline; gap: 12px; padding: 10px 2px;
    color: var(--ink); text-decoration: none;
  }
  .latest a:hover .slug { color: var(--accent); }
  .latest .slug { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 14px; flex: none; }
  .latest .label {
    color: var(--muted); font-size: 14px; margin-left: auto;
    min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
</style>
</head>
<body>
  <main class="card">
    ${LOGO_SVG.replace("<svg ", '<svg class="mark" aria-hidden="true" ')}
    <h1>Slink<span class="dot">.</span></h1>
    <p class="lede">A minimal, self-hosted URL shortener running on Cloudflare Workers.</p>
    ${latestList(latest)}
    <p>This is a private instance. Short links are created by its owner. Build your own with the open-source code.</p>
    <a class="cta" href="${REPO_URL}" target="_blank" rel="noreferrer">
      View source on GitHub
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>
      </svg>
    </a>
    <p class="foot">Open source · MIT</p>
  </main>
</body>
</html>`;
}

// Static variant for 404 fallbacks: no list, so a miss never costs a second query.
export const LANDING_HTML = landingHtml();
