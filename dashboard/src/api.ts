export interface Link {
  id: number; slug: string; targetUrl: string; title: string | null; archived: number;
  pinned?: number; listed?: number; // public-page controls (0/1)
  createdAt?: number; clicks?: number; visitors?: number;
}
export interface Stats {
  total: number; unique: number;
  byCountry: { country: string | null; n: number }[];
  byBrowser: { browser: string; n: number }[];
  byDevice: { device: string | null; n: number }[];
  byReferrer: { referrer: string | null; n: number }[];
  series: { day: number; n: number }[];
}

// Account-wide analytics (all links combined) + a top-links ranking.
export interface Overview extends Stats {
  links: number;
  activeLinks: number;
  topLinks: { id: number; slug: string; targetUrl: string; clicks: number }[];
}

const json = (r: Response) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); };

// Build a ?from=&to= query string for the analytics endpoints (omits absent bounds).
const rangeQuery = (from?: number | null, to?: number | null): string => {
  const p = new URLSearchParams();
  if (from != null) p.set("from", String(Math.floor(from)));
  if (to != null) p.set("to", String(Math.floor(to)));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
};

export type LinkUpdate = { slug?: string; targetUrl?: string; title?: string; pinned?: boolean; listed?: boolean };

export const api = {
  config: (): Promise<{ shortBase: string; email: string | null }> => fetch("/api/config").then(json),
  list: (): Promise<Link[]> => fetch("/api/links").then(json),
  create: (slug: string, targetUrl: string, title?: string): Promise<Link> =>
    fetch("/api/links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, targetUrl, title }) }).then(json),
  update: (id: number, body: LinkUpdate): Promise<Link> =>
    fetch(`/api/links/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json),
  archive: (id: number): Promise<void> =>
    fetch(`/api/links/${id}/archive`, { method: "POST" }).then(json),
  unarchive: (id: number): Promise<void> =>
    fetch(`/api/links/${id}/unarchive`, { method: "POST" }).then(json),
  remove: (id: number): Promise<void> =>
    fetch(`/api/links/${id}`, { method: "DELETE" }).then(json),
  stats: (id: number, from?: number | null, to?: number | null): Promise<Stats> =>
    fetch(`/api/links/${id}/stats${rangeQuery(from, to)}`).then(json),
  overview: (from?: number | null, to?: number | null): Promise<Overview> =>
    fetch(`/api/stats${rangeQuery(from, to)}`).then(json),
};
