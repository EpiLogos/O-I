/**
 * The Expressions centre: the O:I Expressions application itself — the
 * Point-Cloud-Demo workspace (owner direction 2026-09-19), its own UI and
 * UX complete: the canvas-first workspace, its Studio, toolbelt, scenes,
 * capture and its Library — the Library the app's own library reading is
 * modelled on. Full-screen: the host owns the centre; the shell's chrome
 * (navigator, panel, footer) frames it without covering it.
 *
 * The bundle is served the only way rich material may reach a webview
 * (FND-04): through the owner's `oi-material://` file seam in the desktop
 * build, or the walk bridge's mirror under probes — every byte through the
 * owner's own file reads, no ambient filesystem or native-bridge authority.
 * In a plain browser (no owner transport) the host says so honestly rather
 * than hosting a copy that could drift from the owner's ground.
 *
 * The frame keeps same-origin within its own material origin: the
 * application autosaves its drafts to browser storage at boot, and an opaque
 * sandboxed origin would refuse storage and kill the boot — the material
 * protocol's own CSP remains the authority over what the frame may do.
 *
 * The M1–M3 body the application carries (engine, expression documents,
 * the accepted instruments) is the pre-parallel integration: the PCD
 * workspace ships its engine bundle and its expression corpus, and its
 * engine is the same intake the cradle stage runs (Point-Cloud-Demo @ the
 * #329 intake line). Deeper kernel joins (expression document sync with the
 * cradle's expression ops) are named in the landing record, not faked here.
 */
import {useEffect, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import type {CentralLocation, NativeFileEntry} from "../kernel/types";
import "./point-cloud-host.css";

/** The O:I Expressions application's entry, on Central's disclosed ground. */
const PCD_DIST = "Work/Point-Cloud-Demo/dist";
const PCD_ENTRY = "index.html";

/** The oi-material URL grammar (material_protocol.rs): the url-encoded
 * location JSON as the first segment, relative siblings after it. */
function materialUrl(location: CentralLocation, relative = ""): string {
  const encoded = encodeURIComponent(JSON.stringify(location));
  const segments = relative.split("/").filter(Boolean).map(encodeURIComponent);
  return `oi-material://localhost/${[encoded, ...segments].join("/")}${segments.length === 0 ? "/" : ""}`;
}

export function PointCloudHost() {
  const kernel = useKernel();
  const [entry, setEntry] = useState<NativeFileEntry | undefined>();
  const [state, setState] = useState<"reading" | "ready" | "refused">("reading");
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const directory = await listFiles(kernel.transport, PCD_DIST);
        const found = directory.entries.find(candidate => candidate.name === PCD_ENTRY);
        if (!found) throw new Error(`The Expressions application is not built at ${PCD_DIST} — run its build in Work/Point-Cloud-Demo`);
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

  return <div className="pcd-host" aria-label="O:I Expressions application" data-state={state}>
    {state === "reading" && <p className="oi-note" role="status">Opening the Expressions application…</p>}
    {state === "refused" && <div className="pcd-host-refusal" role="alert">
      <strong>The Expressions application is unavailable here</strong>
      <p>{reason}</p>
      {src === undefined && <p className="oi-note">This view serves through the owner's material seam in the desktop build; a plain browser window cannot host it.</p>}
    </div>}
    {src && <iframe
      src={src}
      title="O:I Expressions — the Point-Cloud-Demo workspace"
      className="pcd-host-frame"
      allow="fullscreen"
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-downloads allow-same-origin"/>}
  </div>;
}
