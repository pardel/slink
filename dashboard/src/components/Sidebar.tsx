import { onLinkClick } from "../router";
import { LinkIcon, ChartIcon } from "../icons";

// /analytics is its own page; everything else (the list and /links/:slug detail
// pages) belongs to the Links section.
const navItem = (path: string, href: string, label: string, Icon: typeof LinkIcon) => {
  const active = (href === "/analytics") === (path === "/analytics");
  return (
    <a
      href={href}
      onClick={onLinkClick(href)}
      aria-current={active ? "page" : undefined}
      className={"navitem" + (active ? " navitem-active" : "")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );
};

// Left rail: brand, navigation, and the signed-in account at the foot. Hidden on
// small screens, where MobileNav carries the brand and navigation instead.
export function Sidebar({ email, path }: { email: string | null; path: string }) {
  const initial = (email ?? "?").charAt(0).toUpperCase();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line p-4 md:flex">
      <a href="/" onClick={onLinkClick("/")} className="mb-8 mt-1 flex items-center gap-2.5 px-2">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <span className="text-[17px] font-semibold tracking-tight text-ink">Slink</span>
      </a>

      <nav className="space-y-1" aria-label="Main">
        {navItem(path, "/", "Links", LinkIcon)}
        {navItem(path, "/analytics", "Analytics", ChartIcon)}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 rounded-[10px] border border-line p-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-[#7C73F5] text-[13px] font-semibold text-white">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-ink">{email ?? "Signed in"}</div>
          <div className="text-[11px] text-muted">Cloudflare Access</div>
        </div>
      </div>
    </aside>
  );
}

// Top bar below the md breakpoint: brand plus the same two destinations, always
// visible. Two items don't need a hamburger, and plain links stay keyboard- and
// screen-reader-reachable without any toggle state.
export function MobileNav({ path }: { path: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:hidden">
      <a href="/" onClick={onLinkClick("/")} className="flex items-center gap-2">
        <img src="/favicon.svg" alt="" className="h-7 w-7" />
        <span className="text-[16px] font-semibold tracking-tight text-ink">Slink</span>
      </a>
      <nav className="flex gap-1" aria-label="Main">
        {navItem(path, "/", "Links", LinkIcon)}
        {navItem(path, "/analytics", "Analytics", ChartIcon)}
      </nav>
    </div>
  );
}
