// Shared date-range control + range math, used by the per-link stats and the
// account-wide Analytics page so both filter identically.

const DAY = 86_400_000;
export type Mode = "7" | "30" | "all" | "custom";
export interface Period { mode: Mode; customFrom: string; customTo: string; }
export const DEFAULT_PERIOD: Period = { mode: "30", customFrom: "", customTo: "" };

// Resolve a Period to an epoch-ms window. `from` inclusive, `to` exclusive; null = open.
// Computed at call time (inside an effect) so "last N days" anchors at fetch, not render.
export function periodRange(p: Period): { from: number | null; to: number | null } {
  if (p.mode === "custom") {
    // <input type=date> is UTC midnight; add a day so the end date is fully included.
    return {
      from: p.customFrom ? Date.parse(p.customFrom) : null,
      to: p.customTo ? Date.parse(p.customTo) + DAY : null,
    };
  }
  if (p.mode === "all") return { from: null, to: null };
  return { from: Date.now() - (p.mode === "7" ? 7 : 30) * DAY, to: null };
}

export function PeriodControl({ value, onChange, loading }: {
  value: Period;
  onChange: (p: Period) => void;
  loading?: boolean;
}) {
  const preset = (key: Mode, label: string) => (
    <button
      onClick={() => onChange({ mode: key, customFrom: "", customTo: "" })}
      className={
        "rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition " +
        (value.mode === key ? "bg-ink text-white" : "text-muted hover:text-ink")
      }
    >
      {label}
    </button>
  );

  const dateInput = (key: "customFrom" | "customTo", label: string) => (
    <input
      type="date"
      aria-label={label}
      value={value[key]}
      onChange={(e) => onChange({ ...value, mode: "custom", [key]: e.target.value })}
      className="rounded-[10px] border border-line bg-panel px-2.5 py-1.5 font-mono text-[13px] text-ink transition focus:border-accent focus:outline-hidden focus:ring-2 focus:ring-accent/15"
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      {loading && <span className="font-mono text-[12px] text-muted">updating…</span>}
      <div className="flex gap-0.5 rounded-[10px] border border-line p-0.5">
        {preset("7", "7 days")}
        {preset("30", "30 days")}
        {preset("all", "All time")}
      </div>
      <div className="flex items-center gap-2">
        {dateInput("customFrom", "Start date")}
        <span className="text-sm text-muted">→</span>
        {dateInput("customTo", "End date")}
      </div>
    </div>
  );
}
