import React from "react";
import ReactDOM from "react-dom/client";
import "@epilogos/oi-design-system/tokens.css";
import "./rest.css";
import { Rest } from "./Rest";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Rest />
  </React.StrictMode>,
);
