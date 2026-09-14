import {useEffect,useRef,useState} from "react";
import {Loading} from "../shared/Loading";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {readFile,readFileBytes} from "../files/client";
import {FileSurface} from "../files/FileSurface";
import type {MaterialFormat} from "./detect";
import {renderMarkdown} from "./markdown";
import "./material.css";
import pageContextScript from "../context/page-context.js?raw";
import {useMaterialContext} from "../context/PageContext";
import {EditorButton,EditorFrame} from "../editor/EditorChrome";

/** One material path segment, percent-encoded whole (mirrors
 * `ctrl/src/files.rs::escape` closely enough for URL transport — the
 * owner is always the final authority; this only has to survive the
 * round trip through the protocol/bridge decoder). An empty `relative`
 * keeps a trailing slash: it addresses the location's own directory, and
 * anything that resolves a further relative reference against this URL
 * (an HTML `<base href>`) must see it as a directory, not a filename to
 * replace. */
function materialPath(location: CentralLocation, relative: string): string {
  const encodedLocation = encodeURIComponent(JSON.stringify(location));
  const segments = relative.split("/").filter(Boolean).map(encodeURIComponent);
  return [encodedLocation, ...segments].join("/") + (segments.length === 0 ? "/" : "");
}

/** The material URL for `location`'s directory-relative `relative` path
 * (empty string = the location itself), under whichever transport is
 * live: the real `oi-material://` protocol under Tauri, or the dev-only
 * walk-bridge mirror in the browser. Absent when no transport can serve
 * material at all (the caller shows an honest absence instead). */
function materialUrl(transport: KernelTransportStatus, location: CentralLocation, relative = ""): string | undefined {
  if (transport.kind === "tauri") return `oi-material://localhost/${materialPath(location, relative)}`;
  if (transport.kind === "bridge") return `${transport.url}/material/${materialPath(location, relative)}`;
  return undefined;
}

/** Suspend rich content (FND-04 "View disposal"/"Rich content") when this
 * surface is not actually on screen: the OS window is hidden
 * (`document.visibilityState`), or an ancestor pane is `display:none`
 * (maximize hides every other pane while keeping its content mounted —
 * `Workbench.tsx`'s `GroupPane` does exactly this). A tab switch instead
 * fully unmounts this component (`Workbench.tsx`'s `SurfaceBody` only
 * renders the active tab), which already releases everything on its own. */
function useSuspend(view: string): { containerRef: React.RefObject<HTMLDivElement>; suspended: boolean } {
  const containerRef = useRef<HTMLDivElement>(null);
  const [intersecting, setIntersecting] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[entries.length - 1];
      if (entry) setIntersecting(entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [view]);
  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return { containerRef, suspended: !intersecting || !documentVisible };
}

interface Disposition { byte_len: number; mime_hint: string | null }

/** Extension fallback for a `data:` URL's mime type when the owner
 * disclosed no hint — mirrors `ctrl/src/files.rs::sniff_mime`'s small
 * extension table closely enough for a browser-transport image preview. */
function imageMimeFor(path: string, mimeHint: string | null): string {
  if (mimeHint) return mimeHint;
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg": case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    default: return "image/png";
  }
}

/** FND-04 general canvas material host. `FileSurface` delegates here for
 * every non-text format it detects; the "Rendered | Source" toggle for
 * HTML/Markdown mounts the real `FileSurface` editor for Source (the
 * same CAS/history/read-only path — never a second, divergent reader). */
export function MaterialSurface({ binding, format }: { binding: SurfaceBinding; format: MaterialFormat }) {
  const { transport } = useKernel();
  const viewKey = `oi-cradle.material-view:${binding.id}`;
  const [savedView] = useState(() => { try { return JSON.parse(localStorage.getItem(viewKey) ?? "null"); } catch { return null; } });
  // Source is a transient editing choice. A newly mounted document opens in
  // its faithful rendered form; only neutral preview zoom persists.
  const [view, setView] = useState<"rendered" | "source">("rendered");
  const { containerRef, suspended } = useSuspend(view);
  useMaterialContext(containerRef,binding,view);
  const [zoom, setZoom] = useState<number>([.5,.75,1,1.25,1.5,2].includes(savedView?.zoom) ? savedView.zoom : 1);
  const [generation, setGeneration] = useState(0);
  useEffect(() => { try { localStorage.setItem(viewKey, JSON.stringify({zoom})); } catch { /* Optional presentation state; never source authority. */ } }, [viewKey,zoom]);
  const [textContent, setTextContent] = useState<string>();
  const [disposition, setDisposition] = useState<Disposition>();
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(true);
  const [pdfFailed, setPdfFailed] = useState(false);
  const location = binding.location;

  useEffect(() => {
    let live = true;
    setPending(true);
    setError(undefined);
    setPdfFailed(false);
    if (!location) {
      setError("The saved file location is unavailable");
      setPending(false);
      return;
    }
    const run = async () => {
      if (format === "html" || format === "markdown") {
        const reading = await readFile(transport, location);
        if (live) setTextContent(reading.content);
      } else if (format === "unsupported") {
        const reading = await readFileBytes(transport, location);
        if (live) setDisposition({ byte_len: reading.byte_len, mime_hint: reading.mime_hint });
      } else if (format === "image" && transport.kind === "bridge") {
        // The dev-only bridge is plain HTTP: a `data:` URL avoids a second
        // origin/CORS surface for what is otherwise a walk-only transport.
        const reading = await readFileBytes(transport, location);
        if (live) setImageDataUrl(`data:${imageMimeFor(location.path, reading.mime_hint)};base64,${reading.content_base64}`);
      }
      // image/tauri and pdf/either transport need no separate read: their
      // element's `src` addresses the material URL directly.
    };
    void run().catch(error => { if (live) setError(String(error)); }).finally(() => { if (live) setPending(false); });
    return () => { live = false; };
  }, [transport, location, format, generation]);

  const showToggle = format === "html" || format === "markdown";
  const zoomable = ["html","markdown","image"].includes(format);
  const tools = view === "rendered" ? <div className="material-tools">
    {zoomable && <select aria-label="Preview zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[.5,.75,1,1.25,1.5,2].map(value=><option key={value} value={value}>{Math.round(value*100)}%</option>)}</select>}
    <button type="button" aria-label="Reload preview" title="Reload from the file owner" disabled={pending} onClick={()=>setGeneration(value=>value+1)}>↻</button>
  </div> : null;
  if (!location) return <p role="alert" className="source-note">The saved file location is unavailable</p>;
  if (view === "source") {
    return <FileSurface binding={binding} forceSource leadingTools={<MaterialToggle view={view} onChange={setView}/>}/>;
  }

  const resolveAsset = (relative: string) => materialUrl(transport, location, relative) ?? "";
  const baseUrl = materialUrl(transport, location);
  const imageSrc = transport.kind === "bridge" ? imageDataUrl : baseUrl;

  return <EditorFrame className="material-surface" label={`Material ${binding.title}`}
    toolbar={null} presentationTools={<>{showToggle&&<MaterialToggle view={view} onChange={setView}/>} {tools}</>}
    footer={<><span className="editor-path" title={`Central / ${location.path}`}>Central / {location.path}</span><span>{FORMAT_LABEL[format]}</span>{zoomable&&<span>{Math.round(zoom*100)}%</span>}<EditorButton disabled={pending} onClick={()=>setGeneration(value=>value+1)}>Reload</EditorButton></>}
  >
    <div ref={containerRef} className="material-rendered-content" aria-busy={pending}>
    {error && <p role="alert" className="source-note">{error} <button type="button" onClick={()=>setGeneration(value=>value+1)}>Retry</button></p>}
    {!error && pending && <Loading label="Reading material…" scope="surface"/>}
    {!error && !pending && format === "html" && <div className="material-viewport" data-preview-zoom={zoom}><div className="material-scaled" style={{width:`${100/zoom}%`,height:`${100/zoom}%`,transform:`scale(${zoom})`}}>{(
      // allow-downloads serves the document's own "Save HTML copy" — a
      // frame-local, network-free export the host must permit (Wayfinder
      // §3.3: the export is separate from native Save and overwrites
      // nothing). The frame stays opaque-origin with no bridge authority.
      transport.kind === "tauri"
        ? <iframe data-page-context className="material-frame" title={binding.title} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" key={generation} src={suspended ? "about:blank" : baseUrl} />
        : <iframe data-page-context className="material-frame" title={binding.title} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" key={generation} srcDoc={suspended ? undefined : injectBase(textContent ?? "", resolveAsset(""))} />
    )}</div></div>}
    {!error && !pending && format === "markdown" && <div className="material-viewport" data-preview-zoom={zoom}><div className="material-scaled" style={{width:`${100/zoom}%`,height:`${100/zoom}%`,transform:`scale(${zoom})`}}>
      <iframe data-page-context key={generation} className="material-frame" title={binding.title} sandbox="allow-scripts" srcDoc={suspended ? undefined : markdownDocument(textContent ?? "", resolveAsset)} />
    </div></div>}
    {!error && !pending && format === "image" && (
      <div className="material-image-frame">
        {imageSrc
          ? <img key={generation} className="material-image" alt={binding.title} src={suspended ? undefined : imageSrc} style={{transform:`scale(${zoom})`}} />
          : <p className="source-note">No transport can serve this image.</p>}
      </div>
    )}
    {!error && !pending && format === "pdf" && (
      pdfFailed || !baseUrl
        ? <p className="material-unavailable" role="alert">This PDF could not be displayed. Central still holds it read-only; no platform viewer was reachable here.</p>
        : <iframe key={generation} className="material-frame" title={binding.title} src={suspended ? "about:blank" : baseUrl} onError={() => setPdfFailed(true)} />
    )}
    {!error && !pending && format === "unsupported" && disposition && (
      <div className="material-disposition" role="note">
        <p className="material-disposition-name">{binding.title}</p>
        <dl>
          <dt>Kind</dt><dd>Unsupported</dd>
          <dt>Size</dt><dd>{disposition.byte_len.toLocaleString()} bytes</dd>
          <dt>Owner mime hint</dt><dd>{disposition.mime_hint ?? "none disclosed"}</dd>
        </dl>
        <p className="material-disposition-note">Central serves this file read-only; no renderer is available in the desktop.</p>
      </div>
    )}
    </div>
  </EditorFrame>;
}

// Finding 17 (chrome grammar): one 35px row per material surface, matching
// `.source-status`'s own grammar — path left (ellipsis), format meta right
// — for every format, not just the two with a Rendered/Source choice.
const FORMAT_LABEL: Record<MaterialFormat, string> = {
  html: "HTML", markdown: "Markdown", image: "Image", pdf: "PDF", text: "Text", unsupported: "Unsupported",
};

// Finding 16: a proper segmented control — the filled-block selection this
// used to draw sat 35px below the tab strip's own olive underline as a
// second, unrelated selection grammar. Reusing role=tab/aria-selected, the
// pill body now carries the selection instead.
function MaterialToggle({ view, onChange }: { view: "rendered" | "source"; onChange: (view: "rendered" | "source") => void }) {
  return <div className="material-toggle" role="tablist" aria-label="Rendered or source view">
    <button type="button" role="tab" aria-selected={view === "rendered"} onClick={() => onChange("rendered")}>Rendered</button>
    <button type="button" role="tab" aria-selected={view === "source"} onClick={() => onChange("source")}>Source</button>
  </div>;
}

/** For the browser-transport HTML rendered view: the already-fetched
 * UTF-8 source, unmodified, plus one injected `<base>` so its relative
 * assets/links resolve against the dev-only walk-bridge material route
 * instead of the app's own origin. Under Tauri, the iframe's `src` is
 * the `oi-material://` URL directly — the document never passes through
 * this function there. */
function injectBase(html: string, baseHref: string | undefined): string {
  const base = `${baseHref?`<base href="${baseHref.replace(/"/g, "&quot;")}">`:""}<script>${pageContextScript}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, match => `${match}${base}`);
  return `${base}${html}`;
}

function markdownDocument(source: string, resolveAsset: (path: string) => string): string {
  const body = renderMarkdown(source, { resolveAsset });
  return `<!doctype html><meta charset="utf-8"><style>${buildMarkdownStyle()}</style><body>${body}<script>${pageContextScript}</script></body>`;
}

/** Finding 17: this used to be a literal palette duplicating
 * `packages/oi-design-system/tokens.css`'s `.oi-desktop` values by hand —
 * DESKTOP-LANGUAGE forbids a second copy of the house palette in a
 * consumer, and a hand-copied one drifts the moment the source tokens
 * move. `document.body` carries the `.oi-desktop` class (see index.html),
 * so its computed style resolves every custom property the same way any
 * other component in the shell does; each read falls back to the same
 * literal value the previous static sheet used only when the token itself
 * is genuinely empty (e.g. this iframe's `srcdoc` document has no host
 * stylesheet of its own to inherit through until this string is built). */
function readShellToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function buildMarkdownStyle(): string {
  const canvas = readShellToken("--oi-canvas-ground", "#eef0e7");
  const ink = readShellToken("--oi-foreground", "#30372f");
  const accent = readShellToken("--oi-accent", "#657852");
  const wash = readShellToken("--oi-wash", "#e5e9dd");
  const sans = readShellToken("--oi-font-sans", "'Avenir Next',Avenir,'Helvetica Neue',Arial,sans-serif");
  const mono = readShellToken("--oi-font-mono", "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace");
  const prose = readShellToken("--oi-shell-type-prose", "13px");
  const heading = readShellToken("--oi-shell-type-heading", "18px");
  const body = readShellToken("--oi-shell-type-body", "12px");
  return `
body{margin:0;padding:16px 20px;font:${prose}/1.8 ${sans};color:${ink};background:${canvas};}
h1,h2{margin:1.2em 0 .4em;line-height:1.3;font-size:${heading};font-weight:600;}
h3,h4,h5,h6{margin:1.2em 0 .4em;line-height:1.3;font-size:${body};font-weight:600;}
p{margin:.6em 0;}
pre{background:${wash};padding:10px 12px;border-radius:4px;overflow:auto;}
code{font-family:${mono};background:${wash};padding:.1em .3em;border-radius:3px;}
pre code{background:none;padding:0;}
img{max-width:100%;}
a{color:${accent};}
ul,ol{padding-left:1.4em;}
`;
}
