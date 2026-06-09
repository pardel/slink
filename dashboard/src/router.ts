import { useEffect, useState, type MouseEvent } from "react";

// Minimal History-API router, no dependency. The dashboard is a single-page app
// (wrangler `not_found_handling: single-page-application`), so deep links like
// /links/devtalks serve index.html and the client renders the right view by reading
// location.pathname.

export function navigate(path: string) {
  if (path === location.pathname) return;
  history.pushState(null, "", path);
  // pushState doesn't emit popstate; fire one so usePath() subscribers re-render.
  dispatchEvent(new PopStateEvent("popstate"));
}

// Subscribe a component to the current pathname; updates on back/forward and navigate().
export function usePath(): string {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  return path;
}

// onClick handler for an <a href>: intercept plain left-clicks for SPA navigation,
// but let modified clicks (cmd/ctrl/shift, middle-click) fall through to the browser
// so "open in new tab" still works.
export function onLinkClick(path: string) {
  return (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  };
}
