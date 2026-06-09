export async function visitorHash(ip: string, ua: string, salt: string, day: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${ua}|${salt}|${day}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function parseUserAgent(ua: string): { device: string; browser: string } {
  // Tablet checks run first: iPad Safari UAs also contain "Mobile", and Android
  // tablets carry "Android" but omit "Mobile" (Android phones include it), so a
  // generic mobile test would otherwise swallow both before "tablet" is reached.
  // (Modern iPadOS reports a desktop-class Mac UA and is a known unclassifiable gap.)
  const device =
    /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))
      ? "tablet"
      : /Mobile|iPhone|Android/i.test(ua)
        ? "mobile"
        : "desktop";
  let browser = "other";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";
  return { device, browser };
}
