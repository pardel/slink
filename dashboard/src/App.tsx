import { useEffect, useRef, useState } from "react";
import { api, type Link, type LinkUpdate } from "./api";
import { LinkDetail } from "./components/LinkDetail";
import { MobileNav, Sidebar } from "./components/Sidebar";
import { ListView } from "./components/ListView";
import { Analytics } from "./components/Analytics";
import { LoadStatus } from "./components/LoadStatus";
import { usePath } from "./router";

export function App() {
  const [links, setLinks] = useState<Link[]>([]);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [shortBase, setShortBase] = useState(""); // "" until /api/config has loaded
  const [configErr, setConfigErr] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const path = usePath();
  // Never rejects: a failure sets loadErr, which shows as a Retry state before the
  // first load and as a "may be out of date" banner after it. Each call supersedes
  // any list request still in flight: a slow earlier response (fetched before the
  // latest save) is dropped instead of reverting the saved change.
  const listSeq = useRef(0);
  const refresh = () => {
    const seq = ++listSeq.current;
    return api.list().then(
      (l) => { if (seq === listSeq.current) { setLinks(l); setReady(true); setLoadErr(false); } },
      () => { if (seq === listSeq.current) setLoadErr(true); },
    );
  };
  const load = () => { setLoadErr(false); refresh(); };
  // Only for a mutation that itself failed; a failed refresh after a successful
  // mutation is the banner's job, not "that action failed".
  const fail = () => alert("That action failed. Please reload and try again.");
  // Short links live on a different host than this dashboard, so ask the API for
  // the public base (and the signed-in email). There is deliberately no fallback to
  // our own origin: that would put the admin host in copied links and QR codes, so
  // the views wait for the real base (see below).
  const loadConfig = () => {
    setConfigErr(false);
    api.config().then(
      (c) => { if (c.shortBase) { setShortBase(c.shortBase); setEmail(c.email); } else setConfigErr(true); },
      () => setConfigErr(true),
    );
  };
  useEffect(() => {
    loadConfig();
    load();
  }, []);

  // Resolve with the updated link so the detail page can react to a slug change
  // (navigate to the new URL); errors propagate so it can show an inline message.
  // The PATCH response is applied locally first, so a renamed link resolves at its
  // new URL even if the follow-up refresh fails. The merge keeps the list-only
  // click/visitor counts, which PATCH doesn't return.
  const onSave = (id: number, body: LinkUpdate) =>
    api.update(id, body).then((l) => {
      setLinks((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...l } : x)));
      refresh();
      return l;
    });
  const onArchive = (id: number) => api.archive(id).then(refresh, fail);
  const onUnarchive = (id: number) => api.unarchive(id).then(refresh, fail);
  const onDelete = (id: number) => api.remove(id).then(refresh, fail);

  // /links/:slug renders the dedicated detail page; anything else is the list.
  const detail = path.match(/^\/links\/(.+)$/);
  const slug = detail ? decodeSlug(detail[1]) : null;

  return (
    <div className="min-h-screen bg-canvas sm:p-4">
      <div className="mx-auto flex min-h-screen max-w-[1120px] overflow-hidden border-line bg-panel sm:min-h-[calc(100vh-2rem)] sm:rounded-2xl sm:border sm:shadow-window">
        <Sidebar email={email} path={path} />
        <section className="min-w-0 flex-1">
          <MobileNav path={path} />
          {ready && loadErr && (
            <div className="flex flex-wrap items-center gap-4 border-b border-line bg-accent-soft px-6 py-2.5 sm:px-8" role="alert">
              <p className="text-[13px] text-accent">Couldn’t refresh your links, so this view may be out of date.</p>
              <button onClick={load} className="act">Retry</button>
            </div>
          )}
          {!shortBase ? (
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <LoadStatus error={configErr} onRetry={loadConfig} what="the dashboard settings" />
            </div>
          ) : slug !== null ? (
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <LinkDetail
                slug={slug}
                link={links.find((l) => l.slug === slug)}
                ready={ready}
                loadError={loadErr}
                onRetry={load}
                shortBase={shortBase}
                onSave={onSave}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
              />
            </div>
          ) : path === "/analytics" ? (
            <Analytics shortBase={shortBase} />
          ) : (
            <ListView
              links={links}
              ready={ready}
              loadError={loadErr}
              onRetry={load}
              shortBase={shortBase}
              onCreated={refresh}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// decodeURIComponent throws on malformed escapes (/links/%), which would blank the
// whole dashboard. Fall back to the raw segment: no valid slug contains "%", so the
// detail page shows its normal "No link found" state.
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
