import {IconTabStrip} from "../workspace/primitives/IconTabStrip";
import {readDraft} from "../workspace/drafts";
import {useCallback,useEffect,useMemo,useRef,useState,type RefObject} from "react";
import {Loading} from "../shared/Loading";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {acquireFileReading,acquireFileBytes} from "../files/resources";
import {FileSurface} from "../files/FileSurface";
import {materialCapabilities,type MaterialFormat} from "./detect";
import {renderMarkdown} from "./markdown";
import "./material.css";
import pageContextScript from "../context/page-context.js?raw";
import documentHostScript from "../context/document-host.js?raw";
import {useMaterialContext} from "../context/PageContext";
import {readDocumentIdentity,islandSpan,FAMILY_LABEL} from "../document/identity";
import {saveDocumentPayload,type DocumentSaveOutcome} from "../document/hostSave";
import {waitingReturnsForSource} from "../document/returns";
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

interface FrameIsland { text: string | null; revision: number | null; documentId: string | null }

/** The document host bridge read (DOCUMENT-SURFACE.md): one bounded
 * question to the rendered frame — what does the page's own payload
 * island hold right now. The page gains nothing; the host learns only
 * what the page already keeps in its own data island. */
function useDocumentHostRead(frame: RefObject<HTMLIFrameElement | null>, active: boolean) {
  const requests = useRef(new Map<string, {resolve: (value: FrameIsland | null) => void; timer: ReturnType<typeof setTimeout>}>());
  useEffect(() => {
    if (!active) return;
    const receive = (event: MessageEvent) => {
      const value = event.data;
      if (value?.type !== "oi:document-host-response") return;
      const pending = requests.current.get(value.request);
      if (!pending || !frame.current || event.source !== frame.current.contentWindow) return;
      requests.current.delete(value.request);
      clearTimeout(pending.timer);
      pending.resolve(value.result);
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      for (const pending of requests.current.values()) { clearTimeout(pending.timer); pending.resolve(null); }
      requests.current.clear();
    };
  }, [active, frame]);
  return useCallback(() => {
    const target = frame.current;
    if (!target?.contentWindow) return Promise.resolve(null);
    return new Promise<FrameIsland | null>(resolve => {
      const request = crypto.randomUUID();
      const timer = setTimeout(() => { requests.current.delete(request); resolve(null); }, 1500);
      requests.current.set(request, {resolve, timer});
      target.contentWindow?.postMessage({type: "oi:document-host-request", request, op: "read"}, "*");
    });
  }, [frame]);
}

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
  const [sourceVisited,setSourceVisited]=useState(view!=="rendered");
  useEffect(()=>{if(view!=="rendered")setSourceVisited(true);},[view]);
  const { containerRef, suspended, observed } = useSuspensionDisclosure(view);
  // First-presentation latch: the acquisition below waits for it. The
  // viewport observation is asynchronous by one frame, so a surface cannot
  // know at mount whether it is presented or a restart-restored inactive
  // tab; the latch turns on only from an actual observation of a presented
  // surface, and never turns off (concealment never defers a live surface).
  const [everPresented, setEverPresented] = useState(false);
  useEffect(() => {
    if (everPresented || !observed || suspended) return;
    setEverPresented(true);
  }, [everPresented, observed, suspended]);
  useMaterialContext(containerRef,binding,view);
  const [zoom, setZoom] = useState<number>(savedView.zoom ?? 1);
  const [generation, setGeneration] = useState(0);
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
  const [draftContent,setDraftContent]=useState<string>();
  const [draftBase,setDraftBase]=useState<string>();
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;
    const read=()=>{const draft=binding.ref?readDraft(binding.ref):undefined;setDraftContent(draft?.content);setDraftBase(draft?.base_revision);};
    const change=(event:Event)=>{if((event as CustomEvent).detail?.ref!==binding.ref)return;clearTimeout(timer);timer=setTimeout(read,150);};read();
    const acquired=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.ref!==binding.ref||typeof detail.reading?.content!=="string"||typeof detail.reading?.revision!=="string")return;setTextContent(detail.reading.content);setTextRevision(detail.reading.revision);read();};
    window.addEventListener("oi:file-draft-changed",change);window.addEventListener("oi:file-reading-changed",acquired);return()=>{clearTimeout(timer);window.removeEventListener("oi:file-draft-changed",change);window.removeEventListener("oi:file-reading-changed",acquired);};
  },[binding.ref]);
  const previewSource=draftContent!==undefined&&draftBase===textRevision?draftContent:textContent;
  const unsavedPreview=previewSource!==textContent;
  const [disposition, setDisposition] = useState<Disposition>();
  const [imageDataUrl, setImageDataUrl] = useState<string>();
  const [pdfFailedGeneration, setPdfFailedGeneration] = useState(-1);
  const htmlFrame = useRef<HTMLIFrameElement>(null);
  const [hostedExpression,setHostedExpression]=useState<PageExpressionHostedState>();
  const [pageExpressionInvalidated,setPageExpressionInvalidated]=useState(false);
  const location = binding.location;

  // Document identity (DOCUMENT-SURFACE.md): what the crafted document is,
  // from its own payload island — never from the filename.
  const identity = useMemo(() => (format === "html" ? readDocumentIdentity(previewSource) : undefined), [format, previewSource]);
  const savedIslandText = useMemo(() => {
    if (identity?.payload !== "ql-doc" || textContent === undefined) return undefined;
    return islandSpan(textContent, "ql-doc")?.text ?? null;
  }, [identity?.payload, textContent]);
  const [frameIsland, setFrameIsland] = useState<FrameIsland>();
  const [docSave, setDocSave] = useState<{busy: true} | {busy: false; outcome: DocumentSaveOutcome}>();
  // What the owner disclosed about the saved source at last acquisition:
  // whether it is a participating source (its own CAS route) and whether
  // ordinary write authority exists at all.
  const [readingMeta, setReadingMeta] = useState<{sourceRef: string | null; writeAvailable: boolean; writeReason: string | null}>();
  const readIsland = useDocumentHostRead(htmlFrame, identity?.payload === "ql-doc");
  // The page's own live payload, polled while the frame is up: the page
  // rewrites its island as the person edits, so the island text IS the
  // page's dirty state — no second editing model is invented here.
  useEffect(() => {
    if (identity?.payload !== "ql-doc" || loadState.frameLoaded !== generation) return;
    let live = true;
    const poll = () => { void readIsland().then(value => { if (live && value) setFrameIsland(value); }); };
    poll();
    const timer = setInterval(poll, 2500);
    return () => { live = false; clearInterval(timer); };
  }, [identity?.payload, loadState.frameLoaded, generation, readIsland]);
  const pageDirty = identity?.payload === "ql-doc"
    && frameIsland?.text != null && savedIslandText != null && frameIsland.text !== savedIslandText;
  const docWritable = !!location && textRevision !== undefined
    && (!!readingMeta?.sourceRef || readingMeta?.writeAvailable !== false);
  // Returns beside the document: what the native receiving field holds
  // against this exact source. Counting only — review stays in the Inbox.
  const [waitingReturns, setWaitingReturns] = useState<number>();
  useEffect(() => {
    const sourceRef = readingMeta?.sourceRef;
    if (!sourceRef) return;
    let live = true;
    const read = () => void waitingReturnsForSource(transport, binding.project ?? null, sourceRef).then(count => { if (live) setWaitingReturns(count); });
    read();
    const focus = () => { if (document.visibilityState === "visible") read(); };
    window.addEventListener("focus", focus);
    const timer = setInterval(focus, 60_000);
    return () => { live = false; window.removeEventListener("focus", focus); clearInterval(timer); };
  }, [transport, binding.project, readingMeta?.sourceRef]);
  const saveDocument = () => {
    if (docSave?.busy || !identity || identity.payload !== "ql-doc" || !location || textRevision === undefined) return;
    setDocSave({busy: true});
    void (async () => {
      try {
        const value = await readIsland();
        const islandText = typeof value?.text === "string" && value.text.length > 0 ? value.text : undefined;
        if (!islandText) throw new Error("This page did not answer the document host; nothing was saved.");
        const result = await saveDocumentPayload(transport, {
          location, project: binding.project, identity,
          basisFileRevision: textRevision, frameIslandText: islandText,
        });
        setDocSave({busy: false, outcome: result.outcome});
        if (result.outcome.state === "saved" && result.reading) {
          // The frame already holds what was saved; refresh the canonical
          // layer and revision stamps without remounting it.
          setTextContent(result.reading.content);
          setTextRevision(result.reading.revision);
        }
      } catch (error) {
        setDocSave({busy: false, outcome: {state: "refused", detail: String(error)}});
      }
    })();
  };

  // The pure document strings are cached by their content/transport inputs
  // (§6: never reparse identical content on unrelated shell changes) — and
  // they are NOT a function of suspension, so a concealed frame's srcDoc
  // identity never flaps.
  const renderedBaseUrl = useMemo(() => (location ? materialUrl(transport, location) : undefined), [transport, location]);
  const bridgeBaseHref = useMemo(() => (location ? materialUrl(transport, location, "") ?? "" : ""), [transport, location]);
  const bridgeHtmlDocument = useMemo(() => (format === "html" && previewSource !== undefined ? injectBase(previewSource, bridgeBaseHref) : ""), [format, previewSource, bridgeBaseHref]);
  const markdownHtmlDocument = useMemo(() => (format === "markdown" && previewSource !== undefined ? markdownDocument(previewSource, relative => location ? materialUrl(transport, location, relative) ?? "" : "") : ""), [format, previewSource, transport, location]);

  useEffect(() => {
    let live = true;
    // Inactive-tab deferral (WORKSPACE-CONTINUITY: inactive tabs remain
    // logically open without all being eagerly mounted, executed or read).
    // A surface that mounted CONCEALED — a restart-restored inactive tab —
    // holds its first owner acquisition until first presentation;
    // everPresented only ever turns on, so a live surface is never reset.
    if (!everPresented) return;
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
        if (live) {
          setTextContent(reading.content);
          setTextRevision(reading.revision);
          setReadingMeta({sourceRef: reading.source?.ref ?? null, writeAvailable: reading.operations?.write?.available !== false, writeReason: reading.operations?.write?.reason ?? null});
        }
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
  }, [transport, location, format, generation, beginLoad, observeLoad, everPresented]);

  const showToggle = materialCapabilities(format).split;
  const zoomable = ["html","markdown","image"].includes(format);
  const tools = view !== "source" ? <div className="material-tools">
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
  return <div className="material-composition" data-view={view}>
    {(sourceVisited||view!=="rendered")&&<div className="material-source-pane" hidden={view==="rendered"}><FileSurface binding={binding} forceSource leadingTools={<MaterialToggle view={view} onChange={setView}/>}/></div>}
    <div className="material-preview-pane" hidden={view==="source"}>
  <EditorFrame className="material-surface" label={`Material ${binding.title}`}
    toolbar={null} presentationTools={<>{showToggle&&<MaterialToggle view={view} onChange={setView}/>} {tools}</>}
    footer={<><span className="editor-path" title={`Central / ${location.path}`}>Central / {location.path}</span><span>{FORMAT_LABEL[format]}{unsavedPreview?" · unsaved preview":""}</span>{zoomable&&<span>{Math.round(zoom*100)}%</span>}{identity&&<span className="editor-path" title={identity.templateRef?`Template ${identity.templateRef}`:undefined}>{FAMILY_LABEL[identity.family]??identity.label}{identity.documentRevision!=null?` · r${identity.documentRevision}`:""}{pageDirty?" · unsaved on the page":""}</span>}{docSave&&!docSave.busy&&<span role={docSave.outcome.state==="saved"||docSave.outcome.state==="unchanged"?"status":"alert"}>{docSave.outcome.state==="saved"?"Saved":docSave.outcome.state==="unchanged"?"Already saved":docSave.outcome.detail}</span>}{waitingReturns?<span role="status" title="Material returned against this document is waiting in the Inbox">{waitingReturns} waiting return{waitingReturns===1?"":"s"}</span>:null}<EditorButton disabled={busy} onClick={()=>setGeneration(value=>value+1)}>Reload</EditorButton>{identity?.payload==="ql-doc"&&<EditorButton disabled={docSave?.busy===true||!docWritable} onClick={saveDocument} title={docWritable?undefined:readingMeta?.writeReason??"No write authority for this document"}>{docSave?.busy?"Saving…":"Save"}</EditorButton>}</>}
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
      transport.kind === "tauri" && !unsavedPreview
        ? <iframe ref={htmlFrame} onLoad={()=>markFrameLoaded(generation)} data-page-context data-file-revision={textRevision} data-generation={generation} className="material-frame" title={binding.title} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" key={generation} src={baseUrl} />
        : <iframe ref={htmlFrame} onLoad={()=>markFrameLoaded(generation)} data-page-context data-file-revision={textRevision} data-generation={generation} className="material-frame" title={binding.title} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" key={generation} srcDoc={bridgeHtmlDocument} />
    )}</div></div>}
    {!loadError&&showing&&personalPage&&textRevision&&!pageExpressionInvalidated&&<PageExpression page={personalPage} fileRevision={textRevision} pageRef={binding.ref??binding.id} onHostedState={receiveHostedState}/>}
    {!loadError && showing && format === "markdown" && <div className="material-viewport" data-preview-zoom={zoom}><div className="material-scaled" style={{width:`${100/zoom}%`,height:`${100/zoom}%`,transform:`scale(${zoom})`}}>
      <iframe data-page-context data-file-revision={textRevision} data-working-copy={unsavedPreview} key={generation} className="material-frame" title={binding.title} sandbox="allow-scripts" srcDoc={markdownHtmlDocument} />
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
  </EditorFrame></div></div>;
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
function MaterialToggle({ view, onChange }: { view: MaterialView; onChange: (view: MaterialView) => void }) {
  return <IconTabStrip aria-label="Document presentation" items={[{id:"rendered",label:"Rendered",icon:"file"},{id:"split",label:"Split",icon:"columns"},{id:"source",label:"Source",icon:"terminal"}]} current={view} onSelect={id=>onChange(id as MaterialView)}/>;
}

/** For the browser-transport HTML rendered view: the already-fetched
 * UTF-8 source, unmodified, plus one injected `<base>` so its relative
 * assets/links resolve against the dev-only walk-bridge material route
 * instead of the app's own origin. Under Tauri, the iframe's `src` is
 * the `oi-material://` URL directly — the document never passes through
 * this function there. */
function injectBase(html: string, baseHref: string | undefined): string {
  const base = `${baseHref?`<base href="${baseHref.replace(/"/g, "&quot;")}">`:""}<script>${pageContextScript}</script><script>${documentHostScript}</script>`;
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
table{border-collapse:collapse;width:100%;}th,td{border:1px solid ${wash};padding:6px 8px;text-align:left;}blockquote{border-left:2px solid ${accent};margin:1em 0;padding-left:1em;}
pre{background:${wash};padding:10px 12px;border-radius:4px;overflow:auto;}
code{font-family:${mono};background:${wash};padding:.1em .3em;border-radius:3px;}
pre code{background:none;padding:0;}
img{max-width:100%;}
a{color:${accent};}
ul,ol{padding-left:1.4em;}
`;
}
