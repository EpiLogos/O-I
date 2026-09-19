/**
 * Shared hosting for the Expressions application — the vendored app at
 * desktop/cradle/expressions-app (owner ruling 2026-09-19: the application
 * is built INSIDE the expressions system, and its source lives in this
 * repo). Both surfaces that host the application share this module: the
 * Expressions centre (PointCloudHost) and the Technè M0 entry face.
 *
 * The bundle is served the only way rich material may reach a webview
 * (FND-04): through the owner's `oi-material://` file seam in the desktop
 * build, or the walk bridge's mirror under probes — every byte through the
 * owner's own file reads. The build law is one line (see the app's README):
 * `cd desktop/cradle/expressions-app && npm install && npm run build`.
 */
import type {CentralLocation} from "../kernel/types";

/** The vendored application's build, on Central's disclosed ground. The
 * cradle checkout sits inside Central, so the files seam resolves this
 * Central-relative path exactly as it resolved Work/Point-Cloud-Demo/dist
 * before the vendoring — no copy-sync, the in-repo dist IS the artefact. */
export const EXPRESSIONS_APP_DIST = "Work/O-I/desktop/cradle/expressions-app/dist";
export const EXPRESSIONS_APP_ENTRY = "index.html";

/** The oi-material URL grammar (material_protocol.rs): the url-encoded
 * location JSON as the first segment, relative siblings after it. A query
 * string survives — the protocol routes on the path alone. */
export function materialUrl(location: CentralLocation, relative = "", query = ""): string {
  const encoded = encodeURIComponent(JSON.stringify(location));
  const segments = relative.split("/").filter(Boolean).map(encodeURIComponent);
  return `oi-material://localhost/${[encoded, ...segments].join("/")}${segments.length === 0 ? "/" : ""}${query}`;
}

/** The desktop shell's traffic-lights corner cutout as the HOST sees it
 * (shell.css [data-window-corner] geometry): width is the shell's window
 * reserve minus the left side region; height is the pane tab bar. Null when
 * the frame does not sit inside the desktop shell's corner. */
export function shellCutout(from: HTMLElement): {width: number; height: number} | null {
  const corner = from.closest("[data-window-corner]");
  if (!corner) return null;
  const shell = corner.closest(".desktop-shell") ?? corner;
  const read = (element: Element, name: string, fallback: number) => {
    const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name).trim());
    return Number.isFinite(value) ? value : fallback;
  };
  const reserve = read(shell, "--shell-window-reserve", 42);
  const left = read(shell, "--desktop-left-width", 0);
  return {width: Math.max(0, reserve - left), height: read(corner, "--oi-shell-tabbar", 32)};
}

/** Align a hosted application frame with the shell's corner cutout (owner
 * addendum 2026-09-19): post the live geometry whenever the shell moves
 * (side regions open and close, the window resizes, the frame reloads). The
 * application turns the message into its masthead height and first-icon
 * inset, so the shell's cut corner and the app's header row read as one
 * continuous aligned edge. */
export function trackShellCutout(frame: HTMLIFrameElement): () => void {
  const post = () => {
    const cutout = shellCutout(frame);
    if (cutout) frame.contentWindow?.postMessage({type: "oi-shell-cutout", ...cutout}, "*");
  };
  frame.addEventListener("load", post);
  window.addEventListener("resize", post);
  const shell = frame.closest(".desktop-shell");
  const observer = shell ? new MutationObserver(post) : null;
  if (shell && observer) observer.observe(shell, {attributes: true, attributeFilter: ["style", "class", "data-native"]});
  post();
  return () => {
    frame.removeEventListener("load", post);
    window.removeEventListener("resize", post);
    observer?.disconnect();
  };
}
