import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../api";

// Right slide-over for creating a link: destination URL, a host-prefixed shorten key,
// and a live QR preview of the resulting short link. Closes on backdrop click or Esc.
export function CreatePanel({ open, shortBase, onClose, onCreated }: {
  open: boolean;
  shortBase: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState("");

  const base = shortBase; // App renders views only once this has loaded
  const hostLabel = base.replace(/^https?:\/\//, "");

  // Reset when the panel is opened.
  useEffect(() => {
    if (open) { setSlug(""); setUrl(""); setErr(""); setQr(""); }
  }, [open]);

  // Live QR of the short link as the slug changes.
  useEffect(() => {
    if (!slug.trim()) { setQr(""); return; }
    QRCode.toDataURL(`${base}/${slug.trim()}`, { width: 256 }).then(setQr).catch(() => setQr(""));
  }, [slug, base]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.create(slug.trim(), url.trim());
      onCreated();
    } catch (e) {
      setErr(String(e).includes("409") ? "That key is already taken." : "Could not create link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 animate-fade-in cursor-default bg-ink/25" onClick={onClose} aria-label="Close" />
      <form
        onSubmit={submit}
        className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in flex-col border-l border-line bg-panel shadow-window"
      >
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <button type="button" onClick={onClose} className="icon-btn" title="Close panel" aria-label="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M13 5l7 7-7 7" /><path d="M20 12H4" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Create New Link</h2>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">Destination URL</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="field"
              placeholder="https://example.com"
              type="url"
              required
              autoFocus
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-ink">Shorten key</span>
            <div className="flex overflow-hidden rounded-[10px] border border-line focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
              <span className="flex items-center whitespace-nowrap border-r border-line bg-canvas px-3 font-mono text-[13px] text-muted">
                {hostLabel}/
              </span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="min-w-0 flex-1 bg-panel px-3 py-2 font-mono text-[14px] text-ink placeholder:font-sans placeholder:text-muted/60 focus:outline-hidden"
                placeholder="my-link"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-ink">QR code</span>
            <div className="grid h-52 place-items-center rounded-card border border-line bg-canvas">
              {qr ? (
                <img src={qr} alt="QR preview" className="h-40 w-40 rounded-[6px] bg-white p-2" />
              ) : (
                <p className="px-6 text-center font-mono text-[12px] text-muted/70">
                  Enter a key to preview its QR code.
                </p>
              )}
            </div>
          </div>

          {(slug.trim() || url.trim()) && (
            <div className="text-sm">
              <span className="text-muted">Link preview: </span>
              <span className="font-mono text-ink">{hostLabel}/{slug.trim() || "…"}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          {err ? <span className="font-mono text-[13px] text-accent">{err}</span> : <span />}
          <button type="submit" disabled={busy} className="btn btn-ink">
            {busy ? "Creating…" : "Create New Link"}
          </button>
        </div>
      </form>
    </div>
  );
}
