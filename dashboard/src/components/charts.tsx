// Shared analytics visuals, used by both the per-link stats and the global
// Analytics overview so the two render identically.

// One breakdown column (country / device / browser / referrer): label, count, and a
// thin proportional bar so the distribution reads at a glance.
export function Breakdown({ title, rows }: { title: string; rows: { key: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="min-w-0 flex-1">
      <div className="kicker mb-2">{title}</div>
      {rows.length === 0 ? (
        <p className="font-mono text-[13px] text-muted/70">No data</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 font-mono text-[13px]">
                <span className="truncate text-ink">{r.key}</span>
                <span className="tabular-nums text-muted">{r.n}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full origin-left animate-grow rounded-full bg-ink/70"
                  style={{ width: `${Math.round((r.n / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Horizontal bar chart of clicks per epoch-day bucket.
export function SeriesChart({ series }: { series: { day: number; n: number }[] }) {
  const maxN = Math.max(1, ...series.map((d) => d.n));
  if (series.length === 0) return <p className="font-mono text-[13px] text-muted/70">No clicks yet.</p>;
  return (
    <ul className="space-y-1.5">
      {series.map((d) => (
        <li key={d.day} className="flex items-center gap-3">
          <span className="w-24 shrink-0 font-mono text-[12px] text-muted">
            {new Date(d.day * 86_400_000).toISOString().slice(0, 10)}
          </span>
          <span className="flex h-3 flex-1 items-center">
            <span
              className="h-full origin-left animate-grow rounded-sm bg-accent"
              style={{ width: `${Math.max(2, Math.round((d.n / maxN) * 100))}%` }}
              aria-hidden
            />
          </span>
          <span className="w-10 shrink-0 text-right font-mono text-[13px] tabular-nums">{d.n}</span>
        </li>
      ))}
    </ul>
  );
}
