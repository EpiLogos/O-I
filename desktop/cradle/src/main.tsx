import React from "react";
import ReactDOM from "react-dom/client";
import "@epilogos/oi-design-system/tokens.css";
import "./rest.css";
import "./cradle.css";
import { Cradle } from "./Cradle";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Cradle />
  </React.StrictMode>,
);
