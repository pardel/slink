import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { type Link } from "../api";
import { onLinkClick } from "../router";
import { CopyIcon, ExternalIcon, KebabIcon, VisitorIcon, ClickIcon } from "../icons";
import { avatarTint, domainOf, monogram, formatDate, formatCount } from "../lib";

function Avatar({ targetUrl, slug }: { targetUrl: string; slug: string }) {
  const { bg, fg } = avatarTint(domainOf(targetUrl) || slug);
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
      style={{ backgroundColor: bg, color: fg }}
    >
      {monogram(targetUrl, slug)}
    </span>
  );
}

export function LinkList({ links, shortBase, onArchive, onUnarchive, onDelete }: {
  links: Link[];
  shortBase: string;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  // Keyed by the full short URL, not the link id: the public base arrives from
  // /api/config after the list may have rendered, and a slug can be renamed, so an
  // id-keyed cache would keep serving codes for the old URL.
  const [qr, setQr] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);

  const base = shortBase || location.origin;
  const shortUrl = (slug: string) => `${base}/${slug}`;
  const shortLabel = (slug: string) => `${base.replace(/^https?:\/\//, "")}/${slug}`;
  const detailHref = (slug: string) => `/links/${encodeURIComponent(slug)}`;

  useEffect(() => {
    links.forEach((l) => {
      const url = shortUrl(l.slug);
      if (!qr[url]) QRCode.toDataURL(url, { width: 256 }).then((d) => setQr((q) => ({ ...q, [url]: d }))).catch(() => {});
    });
  }, [links, base]);

  const copy = (l: Link) => {
    navigator.clipboard.writeText(shortUrl(l.slug)).then(() => {
      setCopied(l.id);
      setTimeout(() => setCopied((c) => (c === l.id ? null : c)), 1500);
    });
  };

  if (links.length === 0) {
    return (
      <div className="card grid place-items-center px-6 py-16 text-center">
        <p className="font-mono text-[13px] text-muted">No links here yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {links.map((l, i) => {
        const href = detailHref(l.slug);
        return (
          <li
            key={l.id}
            className="group animate-rise rounded-card border border-line bg-panel p-4 transition hover:border-ink/15 hover:shadow-card"
            style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
          >
            <div className="flex items-start gap-3">
              <a href={href} onClick={onLinkClick(href)} title="View details">
                <Avatar targetUrl={l.targetUrl} slug={l.slug} />
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <a
                    href={href}
                    onClick={onLinkClick(href)}
                    className="truncate font-mono text-[15px] font-medium text-ink transition hover:text-accent"
                    title="View details"
                  >
                    {shortLabel(l.slug)}
                  </a>
                  <button onClick={() => copy(l)} className="icon-btn" title="Copy short link"><CopyIcon className="h-4 w-4" /></button>
                  <a href={shortUrl(l.slug)} target="_blank" rel="noreferrer" className="icon-btn" title="Open short link"><ExternalIcon className="h-4 w-4" /></a>
                  {copied === l.id && <span className="text-[12px] font-medium text-accent">Copied</span>}
                  {!l.archived && l.listed === 0 && <span className="badge">Unlisted</span>}
                  {!l.archived && l.listed !== 0 && l.pinned ? <span className="badge badge-accent">Pinned</span> : null}
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[13px] text-muted">
                  <span className="text-muted/60">↳</span>
                  <span className="truncate">{l.targetUrl}</span>
                </p>
              </div>
              <div className="relative shrink-0">
                <button onClick={() => setMenuId((m) => (m === l.id ? null : l.id))} className="icon-btn" title="Actions">
                  <KebabIcon className="h-4 w-4" />
                </button>
                {menuId === l.id && (
                  <>
                    <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuId(null)} aria-label="Close menu" />
                    <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-[10px] border border-line bg-panel py-1 shadow-card">
                      <a href={href} onClick={(e) => { onLinkClick(href)(e); setMenuId(null); }} className="menu-item">Edit</a>
                      <a href={qr[shortUrl(l.slug)]} download={`${l.slug}.png`} onClick={() => setMenuId(null)} className="menu-item">Download QR</a>
                      {l.archived ? (
                        <>
                          <button onClick={() => { onUnarchive(l.id); setMenuId(null); }} className="menu-item">Unarchive</button>
                          <button
                            onClick={() => { setMenuId(null); if (confirm(`Delete /${l.slug} and its analytics? This cannot be undone.`)) onDelete(l.id); }}
                            className="menu-item text-accent"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { onArchive(l.id); setMenuId(null); }} className="menu-item">Archive</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line pt-3">
              <div className="flex flex-wrap gap-2">
                <span className="pill"><VisitorIcon className="h-3.5 w-3.5 text-muted" />{formatCount(l.visitors)} Visitors</span>
                <span className="pill"><ClickIcon className="h-3.5 w-3.5 text-muted" />{formatCount(l.clicks)} Clicks</span>
              </div>
              <span className="shrink-0 font-mono text-[12px] text-muted">{formatDate(l.createdAt)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
