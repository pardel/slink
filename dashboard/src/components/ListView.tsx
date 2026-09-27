import { useState } from "react";
import { type Link } from "../api";
import { CreatePanel } from "./CreatePanel";
import { LinkList } from "./LinkList";
import { SearchIcon } from "../icons";

// The Links page: title bar + Create toggle, search + active/archived filter, then
// the card list. Filtering is purely client-side over the already-loaded links.
export function ListView({ links, shortBase, onCreated, onArchive, onUnarchive, onDelete }: {
  links: Link[];
  shortBase: string;
  onCreated: () => void;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");

  const activeCount = links.filter((l) => !l.archived).length;
  const archivedCount = links.length - activeCount;
  const needle = q.trim().toLowerCase();
  const shown = links
    .filter((l) => (tab === "archived" ? l.archived : !l.archived))
    .filter((l) => !needle || l.slug.toLowerCase().includes(needle) || l.targetUrl.toLowerCase().includes(needle));

  const tabBtn = (key: "active" | "archived", label: string, n: number) => (
    <button
      onClick={() => setTab(key)}
      className={
        "rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition " +
        (tab === key ? "bg-ink text-white" : "text-muted hover:text-ink")
      }
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <div>
      <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Links</h1>
          <p className="mt-0.5 text-sm text-muted">Manage, view and analyse your short links.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn btn-ink shrink-0">
          + Create New Link
        </button>
      </header>

      <div className="space-y-4 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for links"
              className="w-full rounded-[10px] border border-line bg-panel py-2 pl-9 pr-3 text-sm transition placeholder:text-muted/60 focus:border-accent focus:outline-hidden focus:ring-2 focus:ring-accent/15"
            />
          </div>
          <div className="flex shrink-0 gap-0.5 rounded-[10px] border border-line p-0.5">
            {tabBtn("active", "Active", activeCount)}
            {tabBtn("archived", "Archived", archivedCount)}
          </div>
        </div>

        <LinkList
          links={shown}
          shortBase={shortBase}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
        />
      </div>

      <CreatePanel
        open={creating}
        shortBase={shortBase}
        onClose={() => setCreating(false)}
        onCreated={() => { onCreated(); setCreating(false); }}
      />
    </div>
  );
}
