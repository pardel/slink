import { useEffect, useState } from "react";
import { api, type Overview } from "../api";
import { onLinkClick } from "../router";
import { Breakdown, SeriesChart } from "./charts";
import { PeriodControl, periodRange, DEFAULT_PERIOD, type Period } from "./PeriodControl";
import { formatCount } from "../lib";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="kicker">{label}</div>
      <div className="mt-1 text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums">{formatCount(value)}</div>
    </div>
  );
}

export function Analytics({ shortBase }: { shortBase: string }) {
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);

  useEffect(() => {
    const { from, to } = periodRange(period);
    setLoading(true);
    api.overview(from, to)
      .then((d) => { setO(d); setErr(false); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
  }, [period.mode, period.customFrom, period.customTo]);

  const base = shortBase || location.origin;
  const maxTop = Math.max(1, ...(o?.topLinks ?? []).map((t) => t.clicks));

  return (
    <div>
      <header className="border-b border-line px-6 py-5 sm:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Analytics</h1>
        <p className="mt-0.5 text-sm text-muted">Combined performance across all your links.</p>
      </header>

      <div className="px-6 py-6 sm:px-8">
        <div className="mb-5 flex justify-end">
          <PeriodControl value={period} onChange={setPeriod} loading={loading && !!o} />
        </div>

        {err ? (
          <p className="font-mono text-[13px] text-accent">Couldn’t load analytics. Try again.</p>
        ) : !o ? (
          <p className="font-mono text-[13px] text-muted">Loading…</p>
        ) : (
          <div className={"space-y-5 transition-opacity " + (loading ? "opacity-60" : "opacity-100")}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Total clicks" value={o.total} />
              <Tile label="Unique visitors" value={o.unique} />
              <Tile label="Active links" value={o.activeLinks} />
              <Tile label="Total links" value={o.links} />
            </div>

            <div className="card flex flex-wrap gap-8 p-5">
              <Breakdown title="By country" rows={o.byCountry.map((c) => ({ key: c.country ?? "?", n: c.n }))} />
              <Breakdown title="By device" rows={o.byDevice.map((d) => ({ key: d.device ?? "?", n: d.n }))} />
              <Breakdown title="By browser" rows={o.byBrowser.map((b) => ({ key: b.browser ?? "?", n: b.n }))} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card p-5">
                <div className="kicker mb-3">Top links</div>
                {o.topLinks.length === 0 || maxTop === 0 ? (
                  <p className="font-mono text-[13px] text-muted/70">No clicks in this period.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {o.topLinks.map((t) => {
                      const href = `/links/${encodeURIComponent(t.slug)}`;
                      return (
                        <li key={t.id} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <a
                              href={href}
                              onClick={onLinkClick(href)}
                              className="truncate font-mono text-[13px] text-ink transition hover:text-accent"
                            >
                              {base.replace(/^https?:\/\//, "")}/{t.slug}
                            </a>
                            <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted">{formatCount(t.clicks)}</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full origin-left animate-grow rounded-full bg-accent"
                              style={{ width: `${Math.round((t.clicks / maxTop) * 100)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {o.byReferrer.length > 0 && (
                <div className="card p-5">
                  <Breakdown title="Top referrers" rows={o.byReferrer.map((r) => ({ key: r.referrer ?? "direct", n: r.n }))} />
                </div>
              )}
            </div>

            <div className="card p-5">
              <div className="kicker mb-3">Clicks over time</div>
              <SeriesChart series={o.series} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
