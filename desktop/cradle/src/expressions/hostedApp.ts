import {hostedCompositionFile} from "./hostedComposition";
import {relayNativeChannel} from "./nativeChannel";
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

/** The desktop shell's window-corner cutout geometry as the HOST sees it
 * (shell.css [data-window-corner-left] geometry): `width`/`height` are the
 * traffic-lights corner (the shell's window reserve — which follows the live
 * lights-visible condition — minus the left side region, over the pane tab
 * bar); `right` is the far corner's open icon space (shell.css
 * --window-cutout-right: the 52.5px icon reserve — keep in step with that
 * rule — minus the right side region). Null when the frame does not sit
 * inside the desktop shell's corner. */
export function shellCutout(from: HTMLElement): {width: number; height: number; right: number} | null {
  const corner = from.closest("[data-window-corner]");
  if (!corner) return null;
  const shell = corner.closest(".desktop-shell") ?? corner;
  const read = (element: Element, name: string, fallback: number) => {
    const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name).trim());
    return Number.isFinite(value) ? value : fallback;
  };
  const reserve = read(shell, "--shell-window-reserve", 42);
  const left = read(shell, "--desktop-left-width", 0);
  const right = Math.max(0, 52.5 - read(shell, "--desktop-right-width", 0));
  return {width: Math.max(0, reserve - left), height: read(corner, "--oi-shell-tabbar", 32), right};
}

/** Align a hosted application frame with the shell's corner cutout (owner
 * addendum 2026-09-19; right-side accommodation and the lights watcher
 * 2026-09-20, gated by tests/window-lights-contract.test.mjs): post the live
 * geometry whenever the shell moves — side regions open and close, the
 * window resizes, the frame reloads, AND the lights-visible condition flips
 * (fullscreen transitions change the window reserve; data-window-lights is
 * the attribute that carries it). The application turns the message into its
 * masthead height, its first-icon inset and its far-end inset, so the
 * shell's cut corners and the app's header row read as one continuous
 * aligned edge. */
export function trackShellCutout(frame: HTMLIFrameElement): () => void {
  const post = () => {
    const cutout = shellCutout(frame);
    if (cutout) frame.contentWindow?.postMessage({type: "oi-shell-cutout", ...cutout}, "*");
  };
  frame.addEventListener("load", post);
  window.addEventListener("resize", post);
  const shell = frame.closest(".desktop-shell");
  const observer = shell ? new MutationObserver(post) : null;
  if (shell && observer) observer.observe(shell, {attributes: true, attributeFilter: ["style", "class", "data-native", "data-window-lights"]});
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
  const disposeNative = relayNativeChannel(frame, transport);
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
      if (operation !== "list" && operation !== "inspect" && operation !== "create" && operation !== "edit" && operation !== "open") {
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
    if (kind === "expression-file") {
      try { reply(`${kind}-result`, req, {ok: true, data: await hostedCompositionFile(transport, event.data.request)}); }
      catch (cause) { refuse(kind, req, cause instanceof Error ? cause.message : String(cause)); }
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
    disposeNative();
    window.removeEventListener("message", handler);
    frame.removeEventListener("load", announce);
  };
}

// ——— The host↔frame mode channel (the dual-mode cut, wayfinder §11–13) ——
// The Technē surface and the Expressions centre host the SAME application;
// the Technē cut asks the application to stand down its physics authoring
// chrome while its living canvas, current scene, selection and bottom scene
// transport remain. Two additive messages ride the same named, versioned
// grammar as the kernel channel — same-origin material frame, explicit kind
// discrimination, no ambient authority:
//
//   host → frame  `{v:1, kind:"host-mode", mode:"expressions"|"techne"}`
//     — the cut the hosting surface stands in. The application suppresses
//       its authoring chrome in the "techne" cut and restores it in
//       "expressions"; it answers every host-mode with a fresh app-state
//       announcement (the race-free initial read).
//   host → frame  `{v:1, kind:"host-command", command:"interact"|"select"}`
//     — the Technē HUD's direct-mode controls drive the application's own
//       rail tools; the application refuses unknown commands by name.
//   host → frame  `{v:1, kind:"host-command", command:"open-expression", ref}`
//     — open an existing native Expression in place (a constellation just
//       constructed in the Wiki, a Library subject, a returned composition).
//       The frame opens it through its own native workspace (kernel inspect),
//       no remount, buffering until its kernel channel is announced. Refs
//       only; the kernel document stays the store.
//   frame → host  `{v:1, kind:"oi-app-state", state:{...}}`
//     — the application's position announcement: current expression, scene
//       (index/count/name/save state), selection names and the honest
//       absence of anything it does not report.
//
//   frame → host  `{v:1, kind:"host-request", request:"summon",
//                  detail:{kind:"instrument", lens}}`
//     — the application's Lens Studio chooser summons the deep instruments
//       (owner direction 2026-09-23): the hosting Technē centre answers by
//       opening ITS OWN instrument HUD on that lens over the same field —
//       the one registered M0′–M5′ lens set, the one DisclosureSession, no
//       second renderer. Fire-and-forget like the other summons; a host
//       without the centre consumes nothing. `lens` is one of the six deep
//       instrument ids below; `expressions` is the conjugate 3:3 reading,
//       never a deep instrument, and is refused here by never matching.

/** The cut a hosting surface stands the application in. */
export type HostedAppMode = "expressions" | "techne";

const isHostedAppMode = (value: unknown): value is HostedAppMode => value === "expressions" || value === "techne";

/** The six deep instruments the hosted Lens Studio may summon, as the wire
 * carries them (the application's chooser vocabulary). This is the hostedApp
 * wire union, deliberately local to the channel grammar — `expressions` (the
 * conjugate 3:3 reading) is not summonable and `techneReading.ts`'s wider
 * disclosure vocabulary stays the techne layer's own. */
export type HostedTechneLens = "project" | "canvas" | "timeline" | "journey" | "place" | "palace";

export const isHostedTechneLens = (value: unknown): value is HostedTechneLens =>
  typeof value === "string" && (["project", "canvas", "timeline", "journey", "place", "palace"] as const).includes(value as HostedTechneLens);

/** Carry one mode into a hosted frame: posted immediately and re-posted on
 * every frame load (the trackShellCutout law — the frame may boot after the
 * ask). Returns the teardown. Call from an effect keyed on the mode so every
 * change re-posts. */
export function postHostMode(frame: HTMLIFrameElement | null, mode: HostedAppMode): () => void {
  if (!frame) return () => {};
  const post = () => {
    if (isHostedAppMode(mode)) frame.contentWindow?.postMessage({v: KERNEL_CHANNEL_VERSION, kind: "host-mode", mode}, "*");
  };
  frame.addEventListener("load", post);
  post();
  return () => { frame.removeEventListener("load", post); };
}

/** The application's position announcement, as the HUD's readout consumes it.
 * Every facet is what the application actually reported — an absent facet
 * stays absent (honest absence, never a guessed position). */
export interface HostedAppState {
  document?: {id?: string; name?: string};
  sceneIndex?: number;
  sceneCount?: number;
  sceneName?: string;
  sceneState?: string;
  selection?: {id: string; name?: string}[];
  /** The application's active rail tool ("interact" | "select" | …), as the
   * HUD's direct-mode buttons mirror it. */
  tool?: string;
  playing?: boolean;
  journeyPlaying?: boolean;
  fieldPaused?: boolean;
  libraryOpen?: boolean;
  hostMode?: HostedAppMode;
}

/** Follow one frame's oi-app-state announcements. Only envelopes from that
 * frame are accepted. Returns the teardown. */
export function trackHostedAppState(frame: HTMLIFrameElement | null, onState: (state: HostedAppState) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== frame?.contentWindow) return;
    const data = event.data as {v?: unknown; kind?: unknown; state?: unknown} | null;
    if (!data || typeof data !== "object" || data.v !== KERNEL_CHANNEL_VERSION || data.kind !== "oi-app-state") return;
    if (!data.state || typeof data.state !== "object") return;
    onState(data.state as HostedAppState);
  };
  window.addEventListener("message", handler);
  return () => { window.removeEventListener("message", handler); };
}

/** Post one host→frame message into a hosted frame — the host-command
 * grammar the Technē HUD's direct-mode controls ride. */
export function postMessageToFrame(frame: HTMLIFrameElement | null, message: {v: number; kind: string} & Record<string, unknown>) {
  frame?.contentWindow?.postMessage(message, "*");
}

/** Ask the hosted application to open an existing native Expression in place —
 * the host-command grammar's open-expression. The frame opens it through its
 * own native workspace (kernel inspect); it never remounts the frame and never
 * carries the document itself. Refs only, and a non-Expression ref is ignored
 * here rather than posted for the frame to refuse. */
export function postOpenExpression(frame: HTMLIFrameElement | null, expressionRef: string): void {
  if (!frame || typeof expressionRef !== "string" || !expressionRef.startsWith("expression:")) return;
  frame.contentWindow?.postMessage({v: KERNEL_CHANNEL_VERSION, kind: "host-command", command: "open-expression", ref: expressionRef}, "*");
}
