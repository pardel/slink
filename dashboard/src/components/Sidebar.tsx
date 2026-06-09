import { onLinkClick } from "../router";
import { LinkIcon, ChartIcon } from "../icons";

// Left rail: brand, navigation, and the signed-in account at the foot. Hidden on
// small screens (the main header carries the brand there).
export function Sidebar({ email, path }: { email: string | null; path: string }) {
  const initial = (email ?? "?").charAt(0).toUpperCase();
  // /analytics is its own page; everything else (the list and /links/:slug detail
  // pages) belongs to the Links section.
  const onAnalytics = path === "/analytics";

  const item = (href: string, label: string, Icon: typeof LinkIcon, active: boolean) => (
    <a href={href} onClick={onLinkClick(href)} className={"navitem" + (active ? " navitem-active" : "")}>
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line p-4 md:flex">
      <a href="/" onClick={onLinkClick("/")} className="mb-8 mt-1 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink text-white">
          <LinkIcon className="h-4 w-4" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-ink">Slink</span>
      </a>

      <nav className="space-y-1">
        {item("/", "Links", LinkIcon, !onAnalytics)}
        {item("/analytics", "Analytics", ChartIcon, onAnalytics)}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 rounded-[10px] border border-line p-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#7C73F5] text-[13px] font-semibold text-white">
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
