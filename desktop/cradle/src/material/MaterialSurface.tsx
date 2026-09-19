import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Loading} from "../shared/Loading";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {acquireFileReading,acquireFileBytes} from "../files/resources";
import {FileSurface} from "../files/FileSurface";
import type {MaterialFormat} from "./detect";
import {renderMarkdown} from "./markdown";
import "./material.css";
import pageContextScript from "../context/page-context.js?raw";
import {useMaterialContext} from "../context/PageContext";
import {EditorButton,EditorFrame} from "../editor/EditorChrome";
// @ts-ignore -- Personal Web ql-doc parser is the canonical JS document contract.
import {readPage} from "../personal/page.mjs";
import {PageExpression,type PageExpressionHostedState} from "../personal/PageExpression";
import {Glyph} from "../workspace/Glyph";
import {useSuspensionDisclosure,useMaterialReadiness,materialViewKey,parseMaterialViewPrefs,encodeMaterialViewPrefs,MATERIAL_ZOOM_STEPS,type MaterialView} from "./lifecycle";

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
 * same CAS/history/read-only path — never a second, divergent reader).
 *
 * Continuity law (workspace-continuity §6, C24/C25): suspension here is
 * disclosure, never destruction. The frame — HTML, Markdown, PDF — and the
 * image keep their exact node and revision-bound source while the surface is
 * off screen; nothing in the render below may depend on `suspended`. The
 * frame's identity proof is the SAME `<iframe>` DOM node carrying the SAME
 * inner document across conceal→reveal, so the frame remounts ONLY on a
 * committed replacement (`key={generation}`: an explicit Reload/Retry, or a
 * new acquisition generation). Acquisitions go through the shared broker
 * (`files/resources`), so the open path's read and this renderer's join into
 * one owner round trip. */
export function MaterialSurface({ binding, format }: { binding: SurfaceBinding; format: MaterialFormat }) {
  const { transport } = useKernel();
  const viewKey = materialViewKey(binding.id);
  // The person's Rendered|Source choice and preview zoom persist per binding.
  // A first mount with nothing usable saved opens Rendered, the faithful
  // default; a saved choice is restored once, here at mount — never imposed
  // over the person's own newer toggle after that.
  const [savedView] = useState(() => parseMaterialViewPrefs(localStorage.getItem(viewKey)));
  const [view, setView] = useState<MaterialView>(savedView.view ?? "rendered");
  const { containerRef, suspended } = useSuspensionDisclosure(view);
  useMaterialContext(containerRef,binding,view);
  const [zoom, setZoom] = useState<number>(savedView.zoom ?? 1);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const log = (window as unknown as {__ms?: string[]}).__ms = (window as unknown as {__ms?: string[]}).__ms ?? [];
    log.push('MS-MOUNT ' + binding.id.slice(0, 6));
    return () => { log.push('MS-UNMOUNT ' + binding.id.slice(0, 6)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Readiness is generation-scoped and honest (C25): a load event or a late
  // message from a retired generation can neither clear this generation's
  // state nor claim a retired revision ready. A frame load is recorded
  // beside readiness, never instead of it — the host handshake below keeps
  // its own token/generation/revision validation.
  const {record: loadState, begin: beginLoad, observe: observeLoad, markFrameLoaded} = useMaterialReadiness(generation);
  const showing = loadState.readiness === "ready" && loadState.generation === generation;
  const loadError = loadState.readiness === "failed" && loadState.generation === generation ? loadState.error : undefined;
  const busy = loadState.readiness === "loading";
  useEffect(() => { try { localStorage.setItem(viewKey, encodeMaterialViewPrefs({view, zoom})); } catch { /* Optional presentation state; never source authority. */ } }, [viewKey,view,zoom]);
  const [textContent, setTextContent] = useState<string>();
  const [textRevision, setTextRevision] = useState<string>();
  const [disposition, setDisposition] = useState<Disposition>();
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [pdfFailedGeneration, setPdfFailedGeneration] = useState(-1);
  const htmlFrame = useRef<HTMLIFrameElement>(null);
  const [hostedExpression,setHostedExpression]=useState<PageExpressionHostedState>();
  const [pageExpressionInvalidated,setPageExpressionInvalidated]=useState(false);
  const location = binding.location;

  // The pure document strings are cached by their content/transport inputs
  // (§6: never reparse identical content on unrelated shell changes) — and
  // they are NOT a function of suspension, so a concealed frame's srcDoc
  // identity never flaps.
  const renderedBaseUrl = useMemo(() => (location ? materialUrl(transport, location) : undefined), [transport, location]);
  const bridgeBaseHref = useMemo(() => (location ? materialUrl(transport, location, "") ?? "" : ""), [transport, location]);
  const bridgeHtmlDocument = useMemo(() => (format === "html" && textContent !== undefined ? injectBase(textContent, bridgeBaseHref) : ""), [format, textContent, bridgeBaseHref]);
  const markdownHtmlDocument = useMemo(() => (format === "markdown" && textContent !== undefined ? markdownDocument(textContent, relative => location ? materialUrl(transport, location, relative) ?? "" : "") : ""), [format, textContent, transport, location]);

  useEffect(() => {
    let live = true;
    beginLoad(generation);
    setPdfFailedGeneration(-1);
    if (!location) {
      observeLoad(generation, {kind: "failed", error: "The saved file location is unavailable"});
      return;
    }
    const run = async () => {
      if (format === "html" || format === "markdown") {
        // Shared acquisition (WF2): the frame's open path acquires the same
        // subject through the same broker, so this joins the in-flight read —
        // one owner round trip total. On a committed refresh this acquires
        // again; an unchanged cached reading IS the same revision, so the
        // broker's cache hit is correctness, not staleness.
        const reading = await acquireFileReading(transport, location);
        if (live) {setTextContent(reading.content);setTextRevision(reading.revision);}
      } else if (format === "unsupported") {
        const reading = await acquireFileBytes(transport, location);
        if (live) setDisposition({ byte_len: reading.byte_len, mime_hint: reading.mime_hint });
      } else if (format === "image" && transport.kind === "bridge") {
        // The dev-only bridge is plain HTTP: a `data:` URL avoids a second
        // origin/CORS surface for what is otherwise a walk-only transport.
        const reading = await acquireFileBytes(transport, location);
        if (live) setImageDataUrl(`data:${imageMimeFor(location.path, reading.mime_hint)};base64,${reading.content_base64}`);
      }
      // image/tauri and pdf/either transport need no separate read: their
      // element's `src` addresses the material URL directly.
    };
    void run()
      .catch(error => { if (live) observeLoad(generation, {kind: "failed", error: String(error)}); })
      .finally(() => { if (live) observeLoad(generation, {kind: "ready"}); });
    return () => { live = false; };
  }, [transport, location, format, generation, beginLoad, observeLoad]);

  const showToggle = format === "html" || format === "markdown";
  const zoomable = ["html","markdown","image"].includes(format);
  const tools = view === "rendered" ? <div className="material-tools">
    {zoomable && <select aria-label="Preview zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{MATERIAL_ZOOM_STEPS.map(value=><option key={value} value={value}>{Math.round(value*100)}%</option>)}</select>}
    <button type="button" aria-label="Reload preview" title="Reload from the file owner" disabled={busy} onClick={()=>setGeneration(value=>value+1)}><Glyph name="refresh" size={12}/></button>
  </div> : null;
  if (!location) return <p role="alert" className="source-note">The saved file location is unavailable</p>;

  const baseUrl = renderedBaseUrl;
  const imageSrc = transport.kind === "bridge" ? imageDataUrl : baseUrl;
  const personalPage=useMemo(()=>{if(format!=="html"||!textContent||!textRevision)return undefined;try{const parsed=readPage(textContent);return parsed.page.expression?parsed:undefined;}catch{return undefined;}},[format,textContent,textRevision]);
  const receiveHostedState=useCallback((state:PageExpressionHostedState)=>setHostedExpression(state),[]);
  useEffect(()=>setPageExpressionInvalidated(false),[generation,textRevision]);
  useEffect(()=>{
    const frame=htmlFrame.current;
    if(format!=="html"||!frame||loadState.frameLoaded!==generation||!personalPage||!textRevision||!hostedExpression)return;
    const expression=personalPage.page.expression,frameGeneration=String(generation);
    const exact=hostedExpression.pageRef===(binding.ref??binding.id)&&hostedExpression.fileRevision===textRevision&&hostedExpression.documentId===(personalPage.meta.documentId??null)&&hostedExpression.documentRevision===personalPage.meta.revision&&hostedExpression.expressionRef===expression.expression_ref&&hostedExpression.expressionRevision===expression.expression_revision;
    const sourceExact=frame.dataset.fileRevision===textRevision&&frame.dataset.generation===frameGeneration&&(transport.kind==="tauri"?frame.getAttribute("src")===baseUrl:frame.hasAttribute("srcdoc"));
    if(!exact||!sourceExact)return;
    const token=crypto.randomUUID();let disposed=false;
    const receive=(event:MessageEvent)=>{const value=event.data;if(disposed||event.source!==frame.contentWindow||value?.token!==token||value.generation!==generation||value.page?.document_id!==hostedExpression.documentId||value.page?.revision!==hostedExpression.documentRevision||value.expression?.ref!==hostedExpression.expressionRef||value.expression?.revision!==hostedExpression.expressionRevision)return;if(value.type==="oi:page-expression-host-invalidated"){setPageExpressionInvalidated(true);return;}if(value.type!=="oi:page-expression-host-response")return;if(value.accepted!==true&&hostedExpression.live)setHostedExpression(previous=>previous&&{...previous,live:false});};
    window.addEventListener("message",receive);
    frame.contentWindow?.postMessage({type:"oi:page-expression-host",token,generation,live:hostedExpression.live,page:{document_id:hostedExpression.documentId,revision:hostedExpression.documentRevision},expression:{ref:hostedExpression.expressionRef,revision:hostedExpression.expressionRevision}},"*");
    return()=>{disposed=true;window.removeEventListener("message",receive);};
  },[format,loadState.frameLoaded,personalPage,textRevision,hostedExpression,generation,binding.ref,binding.id,transport.kind,baseUrl]);

  // The source view mounts the real FileSurface editor — AFTER every hook,
  // so toggling views never changes this component's hook count. (The early
  // return once stood above the hooks: the first Source toggle crashed the
  // subtree on the hook mismatch and the error boundary remounted it
  // straight back into the rendered view — the toggle could never stick.)
  if (view === "source") {
    return <FileSurface binding={binding} forceSource leadingTools={<MaterialToggle view={view} onChange={setView}/>}/>;
  }

  return <EditorFrame className="material-surface" label={`Material ${binding.title}`}
    toolbar={null} presentationTools={<>{showToggle&&<MaterialToggle view={view} onChange={setView}/>} {tools}</>}
    footer={<><span className="editor-path" title={`Central / ${location.path}`}>Central / {location.path}</span><span>{FORMAT_LABEL[format]}</span>{zoomable&&<span>{Math.round(zoom*100)}%</span>}<EditorButton disabled={busy} onClick={()=>setGeneration(value=>value+1)}>Reload</EditorButton></>}
  >
    <div ref={containerRef} className="material-rendered-content" data-suspended={suspended || undefined} aria-busy={!showing && !loadError}>
    {loadError && <p role="alert" className="source-note">{loadError} <button type="button" onClick={()=>setGeneration(value=>value+1)}>Retry</button></p>}
    {!loadError && !showing && <Loading label="Reading material…" scope="surface"/>}
    {!loadError && showing && format === "html" && <div className="material-viewport" data-preview-zoom={zoom}><div className="material-scaled" style={{width:`${100/zoom}%`,height:`${100/zoom}%`,transform:`scale(${zoom})`}}>{(
      // allow-downloads serves the document's own "Save HTML copy" — a
      // frame-local, network-free export the host must permit (Wayfinder
      // §3.3: the export is separate from native Save and overwrites
      // nothing). The frame stays opaque-origin with no bridge authority.
      // The source below is never a function of suspension: conceal keeps
      // this exact node and its stable revision-bound document; only
      // `key={generation}` — a committed replacement — ever remounts it.
      transport.kind === "tauri"
        ? <iframe ref={htmlFrame} onLoad={()=>markFrameLoaded(generation)} data-page-context data-file-revision={textRevision} data-generation={generation} className="material-frame" title={binding.title} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" key={generation} src={baseUrl} />
        : <iframe ref={htmlFrame} onLoad={()=>markFrameLoaded(generation)} data-page-context data-file-revision={textRevision} data-generation={generation} className="material-frame" title={binding.title} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" key={generation} srcDoc={bridgeHtmlDocument} />
    )}</div></div>}
    {!loadError&&showing&&personalPage&&textRevision&&!pageExpressionInvalidated&&<PageExpression page={personalPage} fileRevision={textRevision} pageRef={binding.ref??binding.id} onHostedState={receiveHostedState}/>}
    {!loadError && showing && format === "markdown" && <div className="material-viewport" data-preview-zoom={zoom}><div className="material-scaled" style={{width:`${100/zoom}%`,height:`${100/zoom}%`,transform:`scale(${zoom})`}}>
      <iframe data-page-context key={generation} className="material-frame" title={binding.title} sandbox="allow-scripts" srcDoc={markdownHtmlDocument} />
    </div></div>}
    {!loadError && showing && format === "image" && (
      <div className="material-image-frame">
        {imageSrc
          ? <img key={generation} className="material-image" alt={binding.title} src={imageSrc} style={{transform:`scale(${zoom})`}} />
          : <p className="source-note">No transport can serve this image.</p>}
      </div>
    )}
    {!loadError && showing && format === "pdf" && (
      // Same frame law as HTML: the pdf frame's src stays the material URL
      // through concealment; only a committed replacement remounts it. The
      // failure stamp is generation-guarded, so a dying frame of a retired
      // generation cannot fail the one that replaced it.
      pdfFailedGeneration === generation || !baseUrl
        ? <p className="material-unavailable" role="alert">This PDF could not be displayed. Central still holds it read-only; no platform viewer was reachable here.</p>
        : <iframe key={generation} className="material-frame" title={binding.title} src={baseUrl} onError={() => setPdfFailedGeneration(generation)} />
    )}
    {!loadError && showing && format === "unsupported" && disposition && (
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
 * other component in the shell does; each read falls back to a system
 * colour keyword (never a literal palette value) only when the token itself
 * is genuinely empty (e.g. this iframe's `srcdoc` document has no host
 * stylesheet of its own to inherit through until this string is built). */
function readShellToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function buildMarkdownStyle(): string {
  const canvas = readShellToken("--oi-canvas-ground", "Canvas");
  const ink = readShellToken("--oi-foreground", "CanvasText");
  const accent = readShellToken("--oi-accent", "CanvasText");
  const wash = readShellToken("--oi-wash", "color-mix(in srgb, CanvasText 8%, transparent)");
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
