// Public page for PUBLIC_HOST (example.com). At the root it shows the newest listed
// links (pinned first) as the page itself, with Slink reduced to a one-line credit
// at the foot. /<slug>+ previews one link without following it, and any path that
// isn't a live short link says so, instead of a bare 404.
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

export interface LatestLink {
  slug: string;
  title: string | null;
  targetUrl: string;
  createdAt: number;
  pinned?: number;
}

export interface Owner {
  name: string;
  url?: string;
}

export interface LandingOptions {
  host: string; // the public host, shown as the page heading and in each short URL
  owner?: Owner; // optional "Links by ..." line under the heading
  latest?: LatestLink[]; // omitted when the lookup failed: show no list and claim nothing
  notFound?: boolean;
  preview?: LatestLink; // the /<slug>+ page for one link
  now?: number; // injectable clock, for the relative dates
}

// Titles are free text entered in the dashboard, so everything interpolated into
// the page is escaped.
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Each card's initial gets a gradient picked from the slug, so a link keeps its
// colour between visits without storing one; a card that would repeat the colour
// of the one above moves to the next.
const GRADIENTS = [
  ["#818cf8", "#6366f1"], ["#f472b6", "#db2777"], ["#34d399", "#059669"],
  ["#fbbf24", "#d97706"], ["#38bdf8", "#0284c7"], ["#a78bfa", "#7c3aed"],
  ["#fb7185", "#e11d48"], ["#2dd4bf", "#0d9488"],
];
function gradientIndex(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % GRADIENTS.length;
}
function gradients(slugs: string[]): string[] {
  let prev = -1;
  return slugs.map((slug) => {
    let i = gradientIndex(slug);
    if (i === prev) i = (i + 1) % GRADIENTS.length;
    prev = i;
    const [a, b] = GRADIENTS[i];
    return `linear-gradient(135deg, ${a}, ${b})`;
  });
}

// "3 days ago", with the full UTC date for the tooltip and the datetime attribute.
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const FULL_DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000], ["month", 30 * 86_400_000], ["week", 7 * 86_400_000],
  ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000],
];
function ago(ts: number, now: number): string {
  const diff = ts - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return RELATIVE.format(Math.round(diff / ms), unit);
  }
  return "just now";
}
function time(ts: number, now: number, prefix = ""): string {
  const d = new Date(ts);
  return `<time datetime="${d.toISOString()}" title="${FULL_DATE.format(d)}">${prefix}${ago(ts, now)}</time>`;
}

// "h301.dev" -> "h301" + ".dev", so the suffix can carry the accent like the
// "Slink." wordmark's dot.
function heading(host: string): string {
  const i = host.lastIndexOf(".");
  if (i <= 0) return esc(host);
  return `${esc(host.slice(0, i))}<span class="tld">${esc(host.slice(i))}</span>`;
}

function card(l: LatestLink, host: string, i: number, gradient: string, now: number): string {
  const name = l.title || l.slug;
  const initial = [...name.trim()][0]?.toUpperCase() ?? "?";
  // The tooltip carries the full destination: the card only has room for its host.
  return `<li style="--i:${i}"><a class="link" href="/${esc(l.slug)}" title="${esc(l.targetUrl)}">` +
    `<span class="initial" style="background:${gradient}" aria-hidden="true">${esc(initial)}</span>` +
    `<span class="text"><span class="name">${esc(name)}${l.pinned ? `<span class="pin">Pinned</span>` : ""}</span>` +
    `<span class="meta"><span class="short">${esc(host)}/${esc(l.slug)}</span><span class="to">→ ${esc(hostOf(l.targetUrl))}</span>` +
    `<span class="when">${time(l.createdAt, now)}</span></span></span>` +
    `<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>` +
    `</a></li>`;
}

function cards(latest: LatestLink[], host: string, now: number): string {
  const colours = gradients(latest.map((l) => l.slug));
  return latest.map((l, i) => card(l, host, i, colours[i], now)).join("");
}

function ownerLine(owner?: Owner): string {
  if (!owner?.name) return "";
  const name = owner.url
    ? `<a href="${esc(owner.url)}" rel="me noreferrer">${esc(owner.name)}</a>`
    : esc(owner.name);
  return `<p class="owner">Links by ${name}</p>`;
}

function previewMain(l: LatestLink, host: string, now: number): string {
  return `<p class="kicker">Link preview</p><h1 class="small">${esc(host)}/${esc(l.slug)}</h1>` +
    `<div class="panel">` +
    (l.title ? `<p class="ptitle">${esc(l.title)}</p>` : "") +
    `<p class="plabel">Goes to</p><p class="dest">${esc(l.targetUrl)}</p>` +
    `<p class="pwhen">${time(l.createdAt, now, "Added ")}</p>` +
    `</div>` +
    `<a class="go" href="/${esc(l.slug)}">Continue to ${esc(hostOf(l.targetUrl))} <span aria-hidden="true">→</span></a>`;
}

export function landingHtml({ host, owner, latest, notFound = false, preview, now = Date.now() }: LandingOptions): string {
  const main = preview
    ? previewMain(preview, host, now)
    : notFound
    ? `<p class="kicker">404</p><h1>No link here</h1>` +
      `<p class="lede">Nothing lives at this address on ${esc(host)}. It may have been mistyped, or retired.</p>` +
      `<a class="home" href="/">See the latest links <span aria-hidden="true">→</span></a>`
    : `<p class="kicker">Latest links</p><h1>${heading(host)}</h1>${ownerLine(owner)}` +
      (!latest
        ? ""
        : latest.length
          ? `<ul class="links">${cards(latest, host, now)}</ul>`
          : `<p class="lede">No public links yet.</p>`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<meta name="theme-color" content="#0b1020" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#f5f6fb" media="(prefers-color-scheme: light)" />
<title>${preview ? `Preview · ${esc(host)}/${esc(preview.slug)}` : notFound ? `Not found · ${esc(host)}` : esc(host)}</title>
<link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}" />
<style>
  :root {
    --bg: #0b1020; --glow-a: rgba(99,102,241,.32); --glow-b: rgba(236,72,153,.16);
    --grid: rgba(148,163,184,.07);
    --ink: #f1f5f9; --muted: #94a3b8; --faint: #64748b;
    --card: rgba(255,255,255,.035); --card-hover: rgba(255,255,255,.07);
    --line: rgba(255,255,255,.08); --line-hover: rgba(129,140,248,.55);
    --accent: #818cf8; --button: #6366f1;
    --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f5f6fb; --glow-a: rgba(99,102,241,.20); --glow-b: rgba(236,72,153,.10);
      --grid: rgba(15,23,42,.05);
      --ink: #0f172a; --muted: #475569; --faint: #94a3b8;
      --card: rgba(255,255,255,.75); --card-hover: #fff;
      --line: rgba(15,23,42,.08); --line-hover: rgba(99,102,241,.45);
      --accent: #4f46e5; --button: #4f46e5;
    }
  }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body {
    margin: 0; min-height: 100vh; min-height: 100dvh;
    display: flex; flex-direction: column;
    color: var(--ink); font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(60rem 36rem at 15% -10%, var(--glow-a), transparent 60%),
      radial-gradient(50rem 30rem at 95% 10%, var(--glow-b), transparent 60%),
      var(--bg);
  }
  /* A faint grid behind everything, fading out towards the bottom. */
  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(var(--grid) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid) 1px, transparent 1px);
    background-size: 48px 48px;
    -webkit-mask-image: linear-gradient(to bottom, #000 0%, transparent 75%);
            mask-image: linear-gradient(to bottom, #000 0%, transparent 75%);
  }
  main {
    position: relative; width: 100%; max-width: 860px;
    margin: 0 auto; padding: clamp(56px, 12vh, 120px) 20px 48px; flex: 1;
  }
  .kicker {
    margin: 0 0 14px; font: 600 12px/1 var(--mono);
    letter-spacing: .18em; text-transform: uppercase; color: var(--accent);
  }
  h1 {
    margin: 0 0 40px; font-size: clamp(44px, 9vw, 76px); line-height: 1;
    letter-spacing: -.045em; font-weight: 750;
  }
  h1 .tld { color: var(--accent); }
  h1.small { font-size: clamp(30px, 6vw, 48px); letter-spacing: -.03em; margin-bottom: 28px; overflow-wrap: anywhere; }
  .owner { margin: -24px 0 36px; color: var(--muted); font-size: 16px; }
  .owner a { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--line-hover); }
  .owner a:hover { color: var(--accent); }
  .lede { margin: -20px 0 32px; color: var(--muted); font-size: 18px; line-height: 1.6; max-width: 44ch; }
  .links { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .links li { animation: rise .6s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--i) * 70ms + 80ms); }
  .link {
    display: flex; align-items: center; gap: 18px;
    padding: 18px 20px; border-radius: 18px;
    background: var(--card); border: 1px solid var(--line);
    -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
    color: inherit; text-decoration: none;
    transition: background .2s ease, border-color .2s ease, transform .2s ease;
  }
  .link:hover, .link:focus-visible { background: var(--card-hover); border-color: var(--line-hover); transform: translateY(-2px); outline: none; }
  .initial {
    flex: none; width: 48px; height: 48px; border-radius: 14px;
    display: grid; place-items: center;
    color: #fff; font-weight: 700; font-size: 20px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.25), 0 8px 24px -12px rgba(0,0,0,.6);
  }
  .text { min-width: 0; flex: 1; display: grid; gap: 4px; }
  .name {
    font-size: 19px; font-weight: 650; letter-spacing: -.01em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .meta {
    display: flex; gap: 10px; min-width: 0;
    font: 13px/1.4 var(--mono); color: var(--muted);
  }
  .short { flex: none; }
  .when { flex: none; margin-left: auto; padding-left: 12px; color: var(--faint); }
  .pin {
    display: inline-block; vertical-align: 3px; margin-left: 10px; padding: 3px 8px;
    border-radius: 999px; border: 1px solid var(--line-hover); color: var(--accent);
    font: 600 10px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase;
  }
  .panel {
    display: grid; gap: 6px; padding: 24px; border-radius: 18px;
    background: var(--card); border: 1px solid var(--line);
    -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  }
  .panel p { margin: 0; }
  .ptitle { font-size: 22px; font-weight: 650; letter-spacing: -.01em; margin-bottom: 10px !important; }
  .plabel { font: 600 11px/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: var(--faint); }
  .dest { font: 15px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
  .pwhen { margin-top: 10px !important; color: var(--muted); font-size: 14px; }
  .go {
    display: inline-flex; align-items: center; gap: 10px; margin-top: 24px;
    padding: 13px 20px; border-radius: 12px; background: var(--button); color: #fff;
    font-weight: 600; text-decoration: none; transition: filter .15s ease, transform .15s ease;
  }
  .go:hover, .go:focus-visible { filter: brightness(1.1); transform: translateY(-1px); }
  .to { color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .arrow {
    flex: none; width: 22px; height: 22px; fill: none; stroke: var(--faint);
    stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    transition: transform .2s ease, stroke .2s ease;
  }
  .link:hover .arrow, .link:focus-visible .arrow { transform: translateX(4px); stroke: var(--accent); }
  .home {
    display: inline-flex; gap: 8px; color: var(--accent); text-decoration: none;
    font-weight: 600; font-size: 16px;
  }
  .home:hover { text-decoration: underline; text-underline-offset: 4px; }
  footer {
    position: relative; display: flex; justify-content: center; align-items: center; gap: 8px;
    padding: 28px 20px 32px; font-size: 13px; color: var(--faint);
  }
  footer svg { width: 18px; height: 18px; border-radius: 5px; }
  footer a {
    color: inherit; text-decoration: underline; text-decoration-color: var(--line);
    text-underline-offset: 3px; transition: color .15s, text-decoration-color .15s;
  }
  footer a:hover, footer a:focus-visible { color: var(--ink); text-decoration-color: currentColor; }
  /* The project link is the one to notice; the licence link stays quiet. */
  footer a.project {
    color: var(--accent); font-weight: 600;
    text-decoration-color: color-mix(in srgb, var(--accent) 45%, transparent); text-decoration-thickness: 1.5px;
  }
  footer a.project:hover, footer a.project:focus-visible { color: var(--accent); text-decoration-color: var(--accent); }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @media (max-width: 520px) {
    .link { padding: 14px; gap: 14px; }
    .initial { width: 40px; height: 40px; border-radius: 12px; font-size: 17px; }
    .name { font-size: 17px; }
    .to { display: none; }
    .when { padding-left: 8px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .links li { animation: none; }
    .link, .arrow { transition: none; }
  }
</style>
</head>
<body>
  <main>${main}</main>
  <footer>
    ${LOGO_SVG.replace("<svg ", '<svg aria-hidden="true" ')}
    <span>Powered by <a class="project" href="${REPO_URL}" target="_blank" rel="noreferrer">Slink</a> · <a href="${REPO_URL}/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT licence</a></span>
  </footer>
</body>
</html>`;
}
