import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
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
  // The open actions menu and the button that opened it. It renders in a portal on
  // <body>: each card keeps the rise animation's transform, which makes the card a
  // stacking context (later cards paint over the menu) and the containing block for
  // `position: fixed` (the dismissal overlay would cover only the card).
  const [menu, setMenu] = useState<{ id: number; anchor: HTMLButtonElement } | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = (restoreFocus = false) => {
    if (restoreFocus) menu?.anchor.focus({ preventScroll: true });
    setMenu(null);
  };
  const toggleMenu = (id: number) => (e: MouseEvent<HTMLButtonElement>) => {
    const anchor = e.currentTarget;
    setMenu((m) => (m?.id === id ? null : { id, anchor }));
  };
  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []);

  // Place the menu before paint: below the button, or above it when it would run
  // past the bottom of the viewport (and there is room above).
  useLayoutEffect(() => {
    setMenuPos(null);
    if (!menu || !menuRef.current) return;
    const r = menu.anchor.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    const gap = 4, margin = 8;
    const fitsBelow = r.bottom + gap + h <= innerHeight - margin;
    const fitsAbove = r.top - gap - h >= margin;
    setMenuPos({ top: !fitsBelow && fitsAbove ? r.top - gap - h : r.bottom + gap, right: innerWidth - r.right });
  }, [menu]);
  // Once placed (a hidden element can't take focus), move focus to the first action
  // so keyboard users land in the menu rather than on the next card.
  useLayoutEffect(() => {
    if (menuPos) menuItems()[0]?.focus({ preventScroll: true });
  }, [menuPos]);

  // A fixed-position menu doesn't follow its button, so close it on scroll/resize,
  // handing focus back to the button if it was inside (else it drops to <body>).
  useEffect(() => {
    if (!menu) return;
    const close = () => closeMenu(!!menuRef.current?.contains(document.activeElement));
    addEventListener("scroll", close, true);
    addEventListener("resize", close);
    return () => {
      removeEventListener("scroll", close, true);
      removeEventListener("resize", close);
    };
  }, [menu]);

  // Keyboard inside the menu: arrows (and Home/End) move between actions, Escape closes and returns
  // to the button, and Tab behaves as if the menu sat right after its button:
  // leaving either end closes it and focus continues from the button.
  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); closeMenu(true); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      if (e.shiftKey && i === 0) { e.preventDefault(); closeMenu(true); }
      else if (!e.shiftKey && i === items.length - 1) closeMenu(true); // default Tab then moves on from the button
    }
  };

  const base = shortBase; // App renders views only once this has loaded
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
                <button onClick={toggleMenu(l.id)} className="icon-btn" title="Actions" aria-expanded={menu?.id === l.id}>
                  <KebabIcon className="h-4 w-4" />
                </button>
                {menu?.id === l.id && createPortal(
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" onClick={() => closeMenu()} aria-label="Close menu" tabIndex={-1} />
                    <div
                      ref={menuRef}
                      onKeyDown={onMenuKey}
                      className="fixed z-50 w-40 overflow-hidden rounded-[10px] border border-line bg-panel py-1 shadow-card"
                      // Unplaced for the one pre-paint pass in which it is measured.
                      style={menuPos ? { top: menuPos.top, right: menuPos.right } : { top: 0, right: 0, visibility: "hidden" }}
                    >
                      <a href={href} onClick={(e) => { onLinkClick(href)(e); closeMenu(); }} className="menu-item">Edit</a>
                      <a href={qr[shortUrl(l.slug)]} download={`${l.slug}.png`} onClick={() => closeMenu()} className="menu-item">Download QR</a>
                      {l.archived ? (
                        <>
                          <button onClick={() => { onUnarchive(l.id); closeMenu(); }} className="menu-item">Unarchive</button>
                          <button
                            onClick={() => { closeMenu(); if (confirm(`Delete /${l.slug} and its analytics? This cannot be undone.`)) onDelete(l.id); }}
                            className="menu-item text-accent"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { onArchive(l.id); closeMenu(); }} className="menu-item">Archive</button>
                      )}
                    </div>
                  </>,
                  document.body,
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
