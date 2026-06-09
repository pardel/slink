// The host of a target URL (e.g. "github.com"), or "" if it won't parse.
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// First letter for the monogram avatar, from the domain, falling back to the slug.
export function monogram(targetUrl: string, slug: string): string {
  return (domainOf(targetUrl) || slug || "?").charAt(0).toUpperCase();
}

// Deterministic avatar tint from a string, so each link keeps a stable color without
// loading any third-party favicons (which the strict 'self' CSP would block anyway).
const TINTS = [
  ["#EEF0FF", "#4F46E5"], ["#FDECEC", "#D8392F"], ["#E9F6EE", "#1E874B"],
  ["#FEF3E2", "#C2700B"], ["#EAF3FD", "#1F6FD6"], ["#F6EAFB", "#9333A8"],
  ["#E7F6F6", "#0E7C86"], ["#FCEAF3", "#C13C81"],
];
export function avatarTint(key: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const [bg, fg] = TINTS[h % TINTS.length];
  return { bg, fg };
}

// "Jan 15, 2024" from an epoch-ms timestamp.
export function formatDate(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatCount(n?: number): string {
  return (n ?? 0).toLocaleString("en-US");
}
