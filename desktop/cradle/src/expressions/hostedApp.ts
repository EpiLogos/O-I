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
import {kernelOp} from "../kernel/bridge";
import {listFiles, readFile} from "../files/client";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";

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

// ——— The kernel host channel (expressions kernel bridge) ——————————————
// A named, versioned postMessage relay between the hosted application frame
// and the cradle, on exactly the trackShellCutout laws: the same-origin
// material frame, explicit kind discrimination, no ambient authority. The
// frame never receives transport objects or file handles — every request is
// answered from the host's own typed kernel seam with either data or a
// named error, and unknown kinds are refused by name, never with silence.
//
// Envelope (both directions): `{v:1, kind, req, ...}` — `req` is the
// caller's correlation id; replies carry the same `req` and exactly one of
// `data` / `error`. Request kinds:
//   {v:1, kind:"kernel-expression", req, request:{operation:"list"|"inspect"|"create"|"edit", ...}}
//     — the kernel's own expression ops. The kernel document IS the store:
//       there is no second copy anywhere on this channel.
//   {v:1, kind:"central-read", req, path:"<Central-relative file path>"}
//     — one Central file's UTF-8 content through the files seam
//       (listFiles + readFile), so collection bridges can ride the channel.
//   {v:1, kind:"oi-kernel-hello", req?}
//     — feature detection; answered with the `oi-kernel-channel` announce.
// The host also announces the channel unprompted on every frame load:
//   {v:1, kind:"oi-kernel-channel", channel:"kernel-expression"}.

/** The relay's envelope version. Bump only with a paired app-side change. */
export const KERNEL_CHANNEL_VERSION = 1;

interface ChannelEnvelope {
  v?: unknown;
  kind?: unknown;
  req?: unknown;
  request?: unknown;
  path?: unknown;
}

const isEnvelope = (data: unknown): data is ChannelEnvelope =>
  !!data && typeof data === "object" && (data as ChannelEnvelope).v === KERNEL_CHANNEL_VERSION;

/** Relay the kernel host channel into one hosted frame. Returns the
 * teardown, exactly like trackShellCutout. */
export function relayKernelChannel(frame: HTMLIFrameElement, transport: KernelTransportStatus): () => void {
  let live = true;
  const announce = () => {
    if (live) frame.contentWindow?.postMessage({v: KERNEL_CHANNEL_VERSION, kind: "oi-kernel-channel", channel: "kernel-expression"}, "*");
  };
  const reply = (kind: string, req: unknown, payload: Record<string, unknown>) => {
    if (live && typeof req === "number") frame.contentWindow?.postMessage({v: KERNEL_CHANNEL_VERSION, kind, req, ...payload}, "*");
  };
  const refuse = (kind: string, req: unknown, error: string) => reply(`${kind}-result`, req, {ok: false, error});

  const handler = async (event: MessageEvent) => {
    if (!live || event.source !== frame.contentWindow || !isEnvelope(event.data)) return;
    const {kind, req} = event.data;
    // The announce answers hello; anything else in the envelope grammar gets
    // exactly one reply — data or a named error, never silence.
    if (kind === "oi-kernel-hello") { announce(); return; }
    if (kind === "kernel-expression") {
      const request = event.data.request as {operation?: unknown} | undefined;
      const operation = request && typeof request === "object" ? request.operation : undefined;
      if (operation !== "list" && operation !== "inspect" && operation !== "create" && operation !== "edit") {
        refuse(kind, req, `unsupported kernel-expression operation: ${String(operation)}`);
        return;
      }
      try {
        const call = await kernelOp(transport, {op: "expression", request: request as never});
        if (call.error || !call.outcome) {
          refuse(kind, req, call.error ?? "the kernel did not answer the expression operation");
        } else if (call.outcome.result !== "expression") {
          refuse(kind, req, `the kernel answered ${call.outcome.result}, not an expression reading`);
        } else {
          reply(`${kind}-result`, req, {ok: true, data: call.outcome.data});
        }
      } catch (cause) {
        refuse(kind, req, cause instanceof Error ? cause.message : String(cause));
      }
      return;
    }
    if (kind === "central-read") {
      const path = event.data.path;
      if (typeof path !== "string" || !path.trim()) {
        refuse(kind, req, "central-read needs a Central-relative file path");
        return;
      }
      try {
        // Resolve the named file through its directory listing, then read it —
        // the same two typed seam calls every Central reader uses.
        const cut = path.replace(/\/+$/, "");
        const slash = cut.lastIndexOf("/");
        const directory = await listFiles(transport, slash > 0 ? cut.slice(0, slash) : ".");
        const entry = directory.entries.find(candidate => candidate.name === cut.slice(slash + 1));
        if (!entry) throw new Error(`Central holds no file ${path}`);
        if (!entry.retrieval_allowed) throw new Error(`Central withholds ${path} from retrieval`);
        const reading = await readFile(transport, entry.location);
        reply(`${kind}-result`, req, {ok: true, data: {path, revision: reading.revision, byte_len: reading.byte_len, content: reading.content}});
      } catch (cause) {
        refuse(kind, req, cause instanceof Error ? cause.message : String(cause));
      }
      return;
    }
    refuse(String(kind), req, `unknown host-channel kind: ${String(kind)}`);
  };
  window.addEventListener("message", handler);
  frame.addEventListener("load", announce);
  announce();
  return () => {
    live = false;
    window.removeEventListener("message", handler);
    frame.removeEventListener("load", announce);
  };
}
