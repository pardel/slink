import { createRoot } from "react-dom/client";
import { App } from "./App";
// Self-hosted fonts (bundled by Vite, served same-origin so the strict 'self' CSP
// needs no exception). IBM Plex Sans = UI/headings, IBM Plex Mono = link data.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./index.css";
createRoot(document.getElementById("root")!).render(<App />);
