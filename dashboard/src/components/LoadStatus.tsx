// Placeholder while something the view needs has not loaded yet: "Loading…", or
// the failure with a retry. Keeps a failed fetch from reading as an empty account.
export function LoadStatus({ error, onRetry, what = "your links" }: { error: boolean; onRetry: () => void; what?: string }) {
  if (!error) return <p className="font-mono text-[13px] text-muted" role="status">Loading…</p>;
  return (
    <div className="card flex flex-wrap items-center gap-4 px-5 py-4" role="alert">
      <p className="font-mono text-[13px] text-accent">Couldn’t load {what}.</p>
      <button onClick={onRetry} className="act">Retry</button>
    </div>
  );
}
