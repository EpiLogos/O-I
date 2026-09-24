/**
 * The Expressions centre: the O:I Expressions application itself — vendored
 * into this repo at desktop/cradle/expressions-app (owner direction
 * 2026-09-19: "we are building now INSIDE the expressions system, not
 * around it"), its own UI and UX complete: the canvas-first workspace, its
 * Studio, toolbelt, scenes, capture and its Library. Full-screen: the host
 * owns the centre; the shell's chrome (navigator, panel, footer) frames it
 * without covering it.
 *
 * Native candidates serve their own bundled application through the reserved oi-material application route;
 * explicit bridge walks serve owner-disclosed material. No native failure
 * falls back to another checkout. The existing application-state handshake
 * confirms that the requested code actually started.
 *
 * The frame keeps same-origin within its own material origin: the
 * application autosaves its drafts to browser storage at boot, and an opaque
 * sandboxed origin would refuse storage and kill the boot. The frame gets
 * owner operations only through the typed host message relay.
 *
 * The app's masthead aligns with the shell's traffic-lights cutout (owner
 * addendum 2026-09-19): the host posts the live cutout geometry to the
 * frame while it stands (hostedApp.trackShellCutout).
 */
import {useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {
  hostedAppUrl,
  relayKernelChannel,
  trackShellCutout,
  trackHostedAppState,
  watchHostedAppReady,
  postHostMode,
  postOpenExpression,
  type HostedAppMode,
  type HostedAppState,
} from "./hostedApp";
import {consumeTechneFieldOpen, peekTechneFieldOpen, peekTechneFieldRefresh, subscribeTechneFieldOpen} from "./fieldOpen";
import "./point-cloud-host.css";

export function PointCloudHost({mode = "expressions", deepLink, bindingId, onHostedState, readTechne, techneWorld}: {mode?: HostedAppMode; deepLink?: string; bindingId?: string; onHostedState?: (state: HostedAppState) => void; readTechne?: () => Promise<unknown>; techneWorld?: (request: unknown) => Promise<unknown>}) {
  const kernel = useKernel();
  const [src, setSrc] = useState<string | undefined>();
  const [state, setState] = useState<"reading" | "ready" | "refused">("reading");
  const [reason, setReason] = useState<string | undefined>();
  const frame = useRef<HTMLIFrameElement | null>(null);
  // The restart checkpoint's deep link (MODE-ENGINE-STATE-PERSISTENCE
  // §7.2), minted ONCE at mount: the checkpoint may keep changing while the
  // application is mounted, but the frame's URL must never change after
  // boot — reassigning an iframe's src re-navigates it, the exact defect
  // this track exists to prevent. A mount-time capture is a boot-time hint
  // only; the application applies it after its own boot recovery and is
  // free to ignore it.
  const [bootQuery] = useState(() => (`?mode=${mode}${deepLink ? `&expression=${encodeURIComponent(deepLink)}` : ""}`));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const url = await hostedAppUrl(kernel.transport, bootQuery);
        if (!alive) return;
        setSrc(url);
      } catch (error) {
        if (!alive) return;
        setState("refused"); setReason(String(error instanceof Error ? error.message : error));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // The shell's corner cutout and the app's header row read as one
  // continuous aligned edge: keep posting the live geometry to the frame.
  useEffect(() => {
    const node = frame.current;
    return node ? trackShellCutout(node) : undefined;
  }, [src]);

  useEffect(() => {
    const node = frame.current;
    return node ? watchHostedAppReady(node, mode, () => { setState("ready"); setReason(undefined); }, message => { setReason(message); setState("refused"); }) : undefined;
  }, [src, mode]);

  // The kernel host channel: the application reaches the kernel's expression
  // ops and Central's file reads through this host — the kernel document is
  // the only store (hostedApp.relayKernelChannel, same laws as the cutout).
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    return relayKernelChannel(node, kernel.transport, {readTechne, techneWorld});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, kernel.transport, readTechne, techneWorld]);

  // The checkpoint channel: the application's oi-app-state announcements
  // (current expression, scene, selection — its own position, in its own
  // grammar) reach the stage slot's checkpoint effect when one is mounted.
  useEffect(() => {
    const node = frame.current;
    if (!node || !onHostedState) return;
    return trackHostedAppState(node, onHostedState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, onHostedState]);

  // The operating cut (the cradle's own workspace modes carry it): the
  // binding's kind IS the cut — the Technē centre presents this application
  // in its deep state, the Expressions centre in its lived state. Each
  // centre's instance parks suspended in the warm park across switches.
  useEffect(() => {
    const node = frame.current;
    return node ? postHostMode(node, mode) : undefined;
  }, [mode, src]);

  // The Technē cut's summon answer: a constellation constructed in the Wiki
  // opens IN this same living field, not a second renderer and not the panel's
  // Composition plane. The composition root records the ref in the buffered
  // field-open store while the workspace stands in the Technē cut, and NAMES the
  // presented centre by its binding id; only the host whose id matches consumes
  // (`consumeTechneFieldOpen(bindingId)`), so a concealed Technē host that stayed
  // mounted leaves the ref for the presented one — "one consumer" is enforced.
  // A ref recorded before the frame was ready — the natural author-then-enter
  // sequence — is buffered and opened here on ready; later ones open live. The
  // app opens it through its own native workspace (kernel inspect, no iframe
  // reload); the field then stands on the opened subject's own view (a subject
  // change, §28), it does not keep the previous camera. Refs only; the kernel
  // document is the store. The Expressions cut keeps its own selection path.
  useEffect(() => {
    const node = frame.current;
    if (mode !== "techne" || !node || state !== "ready") return;
    const open = () => { const refresh = peekTechneFieldRefresh(); const ref = consumeTechneFieldOpen(bindingId ?? null); if (ref) postOpenExpression(node, ref, refresh); };
    open(); // a ref recorded before this host was ready
    return subscribeTechneFieldOpen(() => { if (peekTechneFieldOpen()) open(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, state, bindingId]);

  // The deep cut's requests ride back through the host: a workspace-mode
  // switch goes to the shell's own mode pipeline (enterMode); a summon asks
  // for the verso account overlay; an instrument summon asks for the ONE
  // deep-instrument HUD. Nothing here opens a second UI — the events land in
  // the seams that already exist.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as {v?: number; kind?: string; request?: string; mode?: string; kind2?: string; detail?: {kind?: string; lens?: string; ref?: unknown; subject?: unknown}} | null;
      if (!data || data.v !== 1 || data.kind !== "host-request") return;
      if (event.source !== frame.current?.contentWindow) return;
      if (data.request === "workspace-mode" && (data.mode === "expressions" || data.mode === "techne")) {
        window.dispatchEvent(new CustomEvent("oi:host-workspace-mode", {detail: {mode: data.mode}}));
      }
      if (data.request === "summon" && data.detail?.kind === "source") {
        const ref = data.detail.ref;
        if (typeof ref === "string" && ref.length > 0 && ref.length <= 2048 && !/[\u0000-\u001f]/.test(ref)) {
          window.dispatchEvent(new CustomEvent("oi:epi-open-knowledge", {detail: {ref}}));
        }
        return;
      }
      if (data.request === "summon" && data.detail?.kind) {
        // The application may carry the exact native work it is standing on
        // (a verso summon). It is untrusted frame data — a pointer only,
        // sanitised and validated through the owner where it is consumed.
        window.dispatchEvent(new CustomEvent("oi:techne-summon", {detail: {kind: data.detail.kind, subject: data.detail.subject}}));
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
