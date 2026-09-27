import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { type Link, type LinkUpdate } from "../api";
import { navigate, onLinkClick } from "../router";
import { LinkStats } from "./LinkStats";

// Dedicated page for one link: header (QR, short URL, target, actions) + full analytics.
// Reached via /links/:slug. `link` is undefined until the parent's list loads, and
// stays undefined (not found) when no link matches the slug in the URL.
export function LinkDetail({ link, slug, shortBase, ready, onSave, onArchive, onUnarchive, onDelete }: {
  link: Link | undefined;
  slug: string;
  shortBase: string;
  ready: boolean; // the link list has finished loading at least once
  onSave: (id: number, body: LinkUpdate) => Promise<Link>;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formSlug, setFormSlug] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const base = shortBase || location.origin;
  const shortUrl = `${base}/${slug}`;
  const shortLabel = `${base.replace(/^https?:\/\//, "")}/${slug}`;

  useEffect(() => {
    QRCode.toDataURL(shortUrl, { width: 192 }).then(setQr).catch(() => {});
  }, [shortUrl]);

  const copy = () => {
    navigator.clipboard.writeText(shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const startEdit = (l: Link) => {
    setFormSlug(l.slug);
    setFormTarget(l.targetUrl);
    setSaveErr("");
    setEditing(true);
  };

  // Public-page switches save immediately; the list refresh brings the new state back.
  const toggle = (l: Link, body: LinkUpdate) => {
    setSaveErr("");
    onSave(l.id, body).catch(() => setSaveErr("Could not update the public page setting."));
  };

  const save = (l: Link) => {
    setSaveErr("");
    const next: { slug?: string; targetUrl?: string } = {};
    const s = formSlug.trim();
    const t = formTarget.trim();
    if (s !== l.slug) next.slug = s;
    if (t !== l.targetUrl) next.targetUrl = t;
    if (Object.keys(next).length === 0) { setEditing(false); return; }
    setSaving(true);
    onSave(l.id, next)
      .then((updated) => {
        setEditing(false);
        // The old /links/<oldslug> no longer resolves; move to the new URL.
        if (updated.slug !== slug) navigate(`/links/${encodeURIComponent(updated.slug)}`);
      })
      .catch((e) => setSaveErr(String(e).includes("409") ? "That slug is taken." : "Could not save changes."))
      .finally(() => setSaving(false));
  };

  const back = (
    <a href="/" onClick={onLinkClick("/")} className="act inline-block">← All links</a>
  );

  if (!link) {
    return (
      <div className="animate-rise space-y-5">
        {back}
        <p className="font-mono text-[13px] text-muted">{ready ? `No link found for /${slug}.` : "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-8">
      {back}
      <div className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        <div className="shrink-0 self-start rounded-[10px] border border-line bg-white p-2.5">
          {qr ? (
            <img src={qr} alt={`QR for ${link.slug}`} className="block h-28 w-28" />
          ) : (
            <div className="h-28 w-28" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); save(link); }} className="space-y-3">
              <label className="block space-y-1.5">
                <span className="kicker">Slug</span>
                <input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} className="field" autoFocus />
              </label>
              <label className="block space-y-1.5">
                <span className="kicker">Target URL</span>
                <input value={formTarget} onChange={(e) => setFormTarget(e.target.value)} className="field" />
              </label>
              {formSlug.trim() !== link.slug && (
                <p className="font-mono text-[12px] text-accent">
                  Changing the slug breaks existing links and QR codes for /{link.slug}.
                </p>
              )}
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="btn btn-ink">{saving ? "Saving…" : "Save"}</button>
                <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost">Cancel</button>
                {saveErr && <span className="font-mono text-[13px] text-accent">{saveErr}</span>}
              </div>
            </form>
          ) : (
            <div className="space-y-2">
              <a
                href={shortUrl}
                target="_blank"
                rel="noreferrer"
                className="block break-all font-mono text-xl text-ink transition hover:text-accent"
              >
                {shortLabel}
              </a>
              <p className="break-all font-mono text-[13px] text-muted">→ {link.targetUrl}</p>
              <div className="flex flex-wrap items-center gap-5 pt-2">
                <button onClick={copy} className="act w-12 text-left">{copied ? "Copied" : "Copy"}</button>
                {qr && <a href={qr} download={`${link.slug}.png`} className="act">Download QR</a>}
                <button onClick={() => startEdit(link)} className="act">Edit</button>
                {link.archived ? (
                  <>
                    <button onClick={() => onUnarchive(link.id)} className="act">Unarchive</button>
                    <button
                      onClick={() => { if (confirm(`Delete /${link.slug} and its analytics? This cannot be undone.`)) { onDelete(link.id); navigate("/"); } }}
                      className="act hover:text-accent! hover:decoration-accent!"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button onClick={() => { onArchive(link.id); navigate("/"); }} className="act">Archive</button>
                )}
              </div>
              {!link.archived && (
                <div className="flex flex-wrap items-center gap-5 pt-1">
                  <span className="kicker">Public page</span>
                  <span className="text-[13px] text-muted">
                    {link.listed === 0 ? "Hidden" : link.pinned ? "Pinned to the top" : "Listed"}
                  </span>
                  {link.listed !== 0 && (
                    <button onClick={() => toggle(link, { pinned: !link.pinned })} className="act">
                      {link.pinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                  <button onClick={() => toggle(link, { listed: link.listed === 0 })} className="act">
                    {link.listed === 0 ? "Show" : "Hide"}
                  </button>
                </div>
              )}
              {saveErr && !editing && <p className="text-[13px] text-accent">{saveErr}</p>}
            </div>
          )}
        </div>
      </div>
      <LinkStats id={link.id} />
    </div>
  );
}
