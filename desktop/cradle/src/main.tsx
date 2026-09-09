import React from "react";
import ReactDOM from "react-dom/client";
import "@epilogos/oi-design-system/tokens.css";
import "./rest.css";
import "./cradle.css";
import { Cradle } from "./Cradle";
const Study = React.lazy(() => ['chat', 'tiled'].includes(new URLSearchParams(location.search).get('study') || '') ? import('./study/WorkspaceStudy') : import('./study/Seed'));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('study') ? <React.Suspense fallback={null}><Study /></React.Suspense> : <Cradle />}
  </React.StrictMode>,
);
