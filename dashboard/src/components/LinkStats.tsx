import { useEffect, useState } from "react";
import { api, type Stats } from "../api";
import { Breakdown, SeriesChart } from "./charts";
import { PeriodControl, periodRange, DEFAULT_PERIOD, type Period } from "./PeriodControl";

export function LinkStats({ id }: { id: number }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(DEFAULT_PERIOD);
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-run the fetch

  useEffect(() => {
    const { from, to } = periodRange(period);
    setLoading(true);
    // A newer period (or link) supersedes this request; drop its late response so it
    // can't overwrite fresher data and leave the control out of step with the numbers.
    let stale = false;
    api.stats(id, from, to)
      .then((d) => { if (!stale) { setS(d); setErr(false); } })
      .catch(() => { if (!stale) setErr(true); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [id, period.mode, period.customFrom, period.customTo, attempt]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="kicker">Analytics</h2>
        <PeriodControl value={period} onChange={setPeriod} loading={loading && !!s} />
      </div>

      {err ? (
        <div className="flex flex-wrap items-center gap-4" role="alert">
          <p className="font-mono text-[13px] text-accent">Couldn’t load stats.</p>
          <button onClick={() => { setErr(false); setAttempt((n) => n + 1); }} className="act">Retry</button>
        </div>
      ) : !s ? (
        <p className="font-mono text-[13px] text-muted">Loading…</p>
      ) : (
        <div className={"space-y-5 transition-opacity " + (loading ? "opacity-60" : "opacity-100")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-5">
              <div className="kicker">Total clicks</div>
              <div className="mt-1 text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums">{s.total}</div>
            </div>
            <div className="card p-5">
              <div className="kicker">Unique visitors</div>
              <div className="mt-1 text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums">{s.unique}</div>
            </div>
          </div>

          <div className="card flex flex-wrap gap-8 p-5">
            <Breakdown title="By country" rows={s.byCountry.map((c) => ({ key: c.country ?? "?", n: c.n }))} />
            <Breakdown title="By device" rows={s.byDevice.map((d) => ({ key: d.device ?? "?", n: d.n }))} />
            <Breakdown title="By browser" rows={s.byBrowser.map((b) => ({ key: b.browser ?? "?", n: b.n }))} />
          </div>

          {s.byReferrer.length > 0 && (
            <div className="card p-5">
              <Breakdown title="Top referrers" rows={s.byReferrer.map((r) => ({ key: r.referrer ?? "direct", n: r.n }))} />
            </div>
          )}

          <div className="card p-5">
            <div className="kicker mb-3">Clicks over time</div>
            <SeriesChart series={s.series} />
          </div>
        </div>
      )}
    </div>
  );
}
