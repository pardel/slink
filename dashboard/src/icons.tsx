// Minimal inline icon set: stroke icons sized by the parent's font-size (1em) and
// colored by currentColor. No icon dependency, so nothing extra to load behind Access.
type P = { className?: string };
const svg = (path: React.ReactNode) => ({ className }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" className={className ?? "h-[1em] w-[1em]"} aria-hidden>
    {path}
  </svg>
);

export const LinkIcon = svg(<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>);
export const CopyIcon = svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>);
export const ExternalIcon = svg(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>);
export const SearchIcon = svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-3.5-3.5" /></>);
export const VisitorIcon = svg(<><circle cx="12" cy="7" r="3.5" /><path d="M5 21a7 7 0 0 1 14 0" /></>);
export const ClickIcon = svg(<><path d="M5 3 19 11l-6 1.5L11 19 5 3Z" /></>);
export const KebabIcon = svg(<><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></>);
export const ChartIcon = svg(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>);
export const ChevronRight = svg(<path d="m9 6 6 6-6 6" />);
