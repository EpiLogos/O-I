import React from "react";
import ReactDOM from "react-dom/client";
import "@epilogos/oi-design-system/tokens.css";
import "@epilogos/oi-design-system/desktop.css";
import "./rest.css";
import "./cradle.css";
import { Cradle } from "./Cradle";
// Historical studies remain development references, never a production
// renderer selected by a URL parameter.
const Study = import.meta.env.DEV && new URLSearchParams(location.search).has('study')
  ? React.lazy(() => ['chat', 'tiled'].includes(new URLSearchParams(location.search).get('study') || '') ? import('./study/WorkspaceStudy') : import('./study/Seed'))
  : null;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {Study ? <React.Suspense fallback={null}><Study /></React.Suspense> : <Cradle />}
  </React.StrictMode>,
);
