/**
 * The Expressions centre: the O:I Expressions application itself — vendored
 * into this repo at desktop/cradle/expressions-app (owner direction
 * 2026-09-19: "we are building now INSIDE the expressions system, not
 * around it"), its own UI and UX complete: the canvas-first workspace, its
 * Studio, toolbelt, scenes, capture and its Library. Full-screen: the host
 * owns the centre; the shell's chrome (navigator, panel, footer) frames it
 * without covering it.
 *
 * The bundle is served the only way rich material may reach a webview
 * (FND-04): through the owner's `oi-material://` file seam in the desktop
 * build, or the walk bridge's mirror under probes — every byte through the
 * owner's own file reads, no ambient filesystem or native-bridge authority.
 * In a plain browser (no owner transport) the host says so honestly rather
 * than hosting a copy that could drift from the owner's ground.
 *
 * The served artefact is the VENDORED app's own dist (hostedApp.ts carries
 * the location): the cradle checkout sits on Central's disclosed ground, so
 * the files seam resolves it exactly as it resolved the outer workspace —
 * the source of record is now in-repo, Work/Point-Cloud-Demo is retired as
 * the app of record.
 *
 * The frame keeps same-origin within its own material origin: the
 * application autosaves its drafts to browser storage at boot, and an opaque
 * sandboxed origin would refuse storage and kill the boot — the material
 * protocol's own CSP remains the authority over what the frame may do.
 *
 * The app's masthead aligns with the shell's traffic-lights cutout (owner
 * addendum 2026-09-19): the host posts the live cutout geometry to the
 * frame while it stands (hostedApp.trackShellCutout).
 */
import {useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import type {NativeFileEntry} from "../kernel/types";
import {
  EXPRESSIONS_APP_DIST,
  EXPRESSIONS_APP_ENTRY,
  materialUrl,
  relayKernelChannel,
  trackShellCutout,
  postHostMode,
  type HostedAppMode,
} from "./hostedApp";
import "./point-cloud-host.css";

export function PointCloudHost({mode = "expressions"}: {mode?: HostedAppMode}) {
  const kernel = useKernel();
  const [entry, setEntry] = useState<NativeFileEntry | undefined>();
  const [state, setState] = useState<"reading" | "ready" | "refused">("reading");
  const [reason, setReason] = useState<string | undefined>();
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const directory = await listFiles(kernel.transport, EXPRESSIONS_APP_DIST);
        const found = directory.entries.find(candidate => candidate.name === EXPRESSIONS_APP_ENTRY);
        if (!found) throw new Error(`The Expressions application is not built at ${EXPRESSIONS_APP_DIST} — build it with the one law in desktop/cradle/expressions-app/README.md`);
        if (!alive) return;
        setEntry(found); setState("ready");
      } catch (error) {
        if (!alive) return;
        setState("refused"); setReason(String(error instanceof Error ? error.message : error));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const src = entry
    ? kernel.transport.kind === "tauri"
      ? materialUrl(entry.location)
      : kernel.transport.kind === "bridge"
        ? `${kernel.transport.url}/material/${encodeURIComponent(JSON.stringify(entry.location))}/`
        : undefined
    : undefined;

  // The shell's corner cutout and the app's header row read as one
  // continuous aligned edge: keep posting the live geometry to the frame.
  useEffect(() => {
    const node = frame.current;
    return node ? trackShellCutout(node) : undefined;
  }, [state]);

  // The kernel host channel: the application reaches the kernel's expression
  // ops and Central's file reads through this host — the kernel document is
  // the only store (hostedApp.relayKernelChannel, same laws as the cutout).
  useEffect(() => {
    const node = frame.current;
    if (!node || state !== "ready") return;
    return relayKernelChannel(node, kernel.transport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, kernel.transport]);

  // The operating cut (the cradle's own workspace modes carry it): the
  // binding's kind IS the cut — the Technē centre presents this application
  // in its deep state, the Expressions centre in its lived state. Each
  // centre's instance parks suspended in the warm park across switches.
  useEffect(() => {
    const node = frame.current;
    return node ? postHostMode(node, mode) : undefined;
  }, [mode, state]);

  // The deep cut's requests ride back through the host: a workspace-mode
  // switch goes to the shell's own mode pipeline (enterMode); a summon asks
  // for the verso account overlay. Nothing here opens a second UI — the
  // events land in the seams that already exist.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as {v?: number; kind?: string; request?: string; mode?: string; kind2?: string; detail?: {kind?: string}} | null;
      if (!data || data.v !== 1 || data.kind !== "host-request") return;
      if (event.source !== frame.current?.contentWindow) return;
      if (data.request === "workspace-mode" && (data.mode === "expressions" || data.mode === "techne")) {
        window.dispatchEvent(new CustomEvent("oi:host-workspace-mode", {detail: {mode: data.mode}}));
      }
      if (data.request === "summon" && data.detail?.kind) {
        window.dispatchEvent(new CustomEvent("oi:techne-summon", {detail: {kind: data.detail.kind}}));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return <div className="pcd-host" aria-label="O:I Expressions application" data-state={state}>
    {state === "reading" && <p className="oi-note" role="status">Opening the Expressions application…</p>}
    {state === "refused" && <div className="pcd-host-refusal" role="alert">
      <strong>The Expressions application is unavailable here</strong>
      <p>{reason}</p>
      {src === undefined && <p className="oi-note">This view serves through the owner's material seam in the desktop build; a plain browser window cannot host it.</p>}
    </div>}
    {src && <iframe
      ref={frame}
      src={src}
      title="O:I Expressions — the application, vendored into the repo"
      className="pcd-host-frame"
      allow="fullscreen"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-downloads allow-same-origin"/>}
  </div>;
}
