/**
 * The Library's canvas tab (owner direction 2026-09-25): the Expressions
 * application's ONE Library gallery, hosted as its own light page
 * (`library.html`) in an ordinary surface — the field engine is never
 * booted here. The host keeps the shell's laws: corner-cutout geometry and
 * the shell appearance ride `oi-shell-cutout` (the page follows the
 * light/dark theme through it), the kernel host channel is relayed so the
 * Library's kernel-held and native sections read live, and the page's own
 * host requests hand opening back to the instrument (workspace-mode) or
 * close this tab (close-library).
 */
import {useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {hostedLibraryUrl, relayKernelChannel, trackShellCutout, trackHostedAppState} from "../expressions/hostedApp";
import "../expressions/point-cloud-host.css";

export function LibraryHost() {
  const kernel = useKernel();
  const [src, setSrc] = useState<string | undefined>();
  const [state, setState] = useState<"reading" | "ready" | "refused">("reading");
  const [reason, setReason] = useState<string | undefined>();
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let alive = true;
    // One retry: a cold dev bridge (or a just-built dist) can fail the first
    // directory read; a permanent refusal must mean a real absence, not one
    // slow answer.
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) await new Promise(resolve => setTimeout(resolve, 1200));
        try {
          const url = await hostedLibraryUrl(kernel.transport);
          if (!alive) return;
          setSrc(url);
          return;
        } catch (error) {
          if (!alive) return;
          if (attempt === 1) { setState("refused"); setReason(String(error instanceof Error ? error.message : error)); }
        }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The corner cutout AND the shell appearance: the page keys its light/dark
  // palette on the appearance this channel carries.
  useEffect(() => {
    const node = frame.current;
    return node ? trackShellCutout(node) : undefined;
  }, [src]);

  // One boot handshake: the page announces oi-app-state once it rendered.
  useEffect(() => {
    const node = frame.current;
    return node ? trackHostedAppState(node, () => { setState("ready"); setReason(undefined); }) : undefined;
  }, [src]);

  // The kernel host channel: the Library's kernel-held and native sections
  // read through it — the same relay the instrument's host runs.
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    return relayKernelChannel(node, kernel.transport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, kernel.transport]);

  // The page's own host requests: opening a composition belongs to the
  // instrument (the Expressions mode carries it); closing belongs to this
  // tab. Nothing here opens a second UI.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as {v?: number; kind?: string; request?: string; mode?: string} | null;
      if (!data || data.v !== 1 || data.kind !== "host-request") return;
      if (event.source !== frame.current?.contentWindow) return;
      if (data.request === "workspace-mode" && data.mode === "expressions") {
        window.dispatchEvent(new CustomEvent("oi:host-workspace-mode", {detail: {mode: data.mode}}));
      }
      if (data.request === "close-library") window.dispatchEvent(new CustomEvent("oi:library-close"));
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return <div className="library-host" aria-label="O:I Expressions Library" data-state={state}>
    {state === "reading" && <p className="oi-note" role="status">Opening the Library…</p>}
    {state === "refused" && <div className="pcd-host-refusal" role="alert">
      <strong>The Library is unavailable here</strong>
      <p>{reason}</p>
      {src === undefined && <p className="oi-note">This view serves through the owner's material seam in the desktop build; a plain browser window cannot host it.</p>}
    </div>}
    {src && <iframe
      ref={frame}
      src={src}
      title="O:I Expressions — the Library"
      className="library-host-frame"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-downloads allow-same-origin"/>}
  </div>;
}
