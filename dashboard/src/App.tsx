import { useEffect, useState } from "react";
import { api, type Link } from "./api";
import { LinkDetail } from "./components/LinkDetail";
import { Sidebar } from "./components/Sidebar";
import { ListView } from "./components/ListView";
import { Analytics } from "./components/Analytics";
import { usePath } from "./router";

export function App() {
  const [links, setLinks] = useState<Link[]>([]);
  const [ready, setReady] = useState(false);
  const [shortBase, setShortBase] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const path = usePath();
  const refresh = () => api.list().then((l) => { setLinks(l); setReady(true); });
  const fail = () => alert("That action failed. Please reload and try again.");
  useEffect(() => {
    // Short links live on a different host than this dashboard, so ask the API for
    // the public base (and the signed-in email) instead of assuming our own origin.
    api.config().then((c) => { setShortBase(c.shortBase); setEmail(c.email); }).catch(() => {});
    refresh();
  }, []);

  // Resolve with the updated link so the detail page can react to a slug change
  // (navigate to the new URL); errors propagate so it can show an inline message.
  const onSave = (id: number, body: { slug?: string; targetUrl?: string }) =>
    api.update(id, body).then((l) => { refresh(); return l; });
  const onArchive = (id: number) => api.archive(id).then(refresh).catch(fail);
  const onUnarchive = (id: number) => api.unarchive(id).then(refresh).catch(fail);
  const onDelete = (id: number) => api.remove(id).then(refresh).catch(fail);

  // /links/:slug renders the dedicated detail page; anything else is the list.
  const detail = path.match(/^\/links\/(.+)$/);
  const slug = detail ? decodeURIComponent(detail[1]) : null;

  return (
    <div className="min-h-screen bg-canvas sm:p-4">
      <div className="mx-auto flex min-h-screen max-w-[1120px] overflow-hidden border-line bg-panel sm:min-h-[calc(100vh-2rem)] sm:rounded-2xl sm:border sm:shadow-window">
        <Sidebar email={email} path={path} />
        <section className="min-w-0 flex-1">
          {slug !== null ? (
            <div className="px-6 py-7 sm:px-8 sm:py-8">
              <LinkDetail
                slug={slug}
                link={links.find((l) => l.slug === slug)}
                ready={ready}
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
