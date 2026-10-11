import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SurfaceBinding } from "../surface/types";
import { readDocumentIdentity, islandSpan, serialiseQlDoc, sameDocumentPayload, FAMILY_LABEL } from "./identity";
import { documentScripts, documentPayloadSource, useDocumentHostRead, registerDocumentCheckpoint, type FrameIsland } from "./frame";
import { useMaterialContext } from "../context/PageContext";
import "./document-host.css";
import {useKernel} from '../kernel/KernelProvider';
import {resolveFileLocation} from '../files/client';
import {captureFileResourceAccess,fileResourceHostGeneration,subscribeResources,type FileResourceScope} from '../files/resources';
import type {CentralLocation} from '../kernel/types';
import {readPageDraft,writePageDraft,clearPageDraft,pageDraftHtml,samePageOwner,samePageLocation,type HeldPageDraft} from '../workspace/drafts';

/**
 * The document host rendered view for SOURCE surfaces (DOCUMENT-SURFACE.md).
 *
 * A bound source whose content carries a crafted payload — a project vision
 * page, a mockup, a ql-doc family document — renders here as itself: the
 * sandboxed opaque-origin frame, the document's own art direction, the
 * host bar with identity and one save. It follows the Day die's law inside
 * SourceSurface: the rendered view is presentation over the canonical
 * buffer; a page save composes the page's own payload island into the
 * buffer and saves through the kernel's source CAS, so a stale basis meets
 * the existing structured conflict, never an overwrite. Selection runs on
 * the same page-context observation route as every material frame.
 */
export function SourceDocumentHost({ binding, text, savedContent, baseRevision, bufferDirty, conflicted, onComposeSave }: {
  binding: SurfaceBinding;
  /** The surface's current editor text (buffer mirrored + pending edits). */
  text: string;
  savedContent: string;
  baseRevision: string;
  bufferDirty: boolean;
  conflicted: boolean;
  /** Save one composed whole source through the surface's buffer CAS.
   * The host awaits it, so the save's own state follows the real act. */
  onComposeSave: (composed: string, isCurrent:()=>boolean) => void | Promise<void>;
}) {
  const {transport}=useKernel();
  const accessEpoch=useSyncExternalStore(subscribeResources,fileResourceHostGeneration,fileResourceHostGeneration);
  const subject=JSON.stringify([binding.ref,binding.location]);
  const latest=useRef({subject,text,savedContent,baseRevision});latest.current={subject,text,savedContent,baseRevision};
  type Basis={subject:string;inputText:string;content:string;savedContent:string;revision:string;location:CentralLocation;scope:FileResourceScope|null};
  const [basis,setBasis]=useState<Basis>();
  const held=useRef(basis);held.current=basis;
  const identity = useMemo(() => readDocumentIdentity(basis?.savedContent??savedContent), [basis?.savedContent,savedContent]);
  const frame = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readIsland = useDocumentHostRead(frame, true);
  const readTicket=useRef(0);
  const lastSecuredPage=useRef<string>();
  const [frameIsland, setFrameIsland] = useState<FrameIsland>();
  const [savePending, setSavePending] = useState(false);
  const [note, setNote] = useState<string>();
  const submitted=useRef<string>();
  useMaterialContext(containerRef, binding, "document-host");
  useEffect(()=>{
    if(held.current)return;
    let live=true;
    void(async()=>{
      const access=captureFileResourceAccess(transport),origin=latest.current;
      if(!binding.ref)throw Error('The source frame has no native source ref.');
      const location=binding.location??await resolveFileLocation(transport,binding.ref);
      if(!live||!access.current()||latest.current.subject!==origin.subject)return;
      const local=readPageDraft(location.ref),scope=access.access?.scope??null;
      const restored=local&&samePageLocation(local.location,location)&&samePageOwner(local.scope,scope);
      const next:Basis={subject:origin.subject,inputText:origin.text,content:restored?pageDraftHtml(local):origin.text,savedContent:restored?local.saved_content:origin.savedContent,revision:restored?local.base_revision:origin.baseRevision,location,scope};
      held.current=next;setBasis(next);
      if(restored){lastSecuredPage.current=local.island.text;setFrameIsland(local.island);setNote(origin.baseRevision===local.base_revision?'Unsaved page working copy restored from this device.':'The source advanced; page edits remain on their retained basis. Review both before saving.');}
      else if(local)setNote('A page working copy for another native owner scope remains retained separately.');
    })().catch(error=>{if(live)setNote(String(error));});
    return()=>{live=false;};
  },[subject,transport,accessEpoch]);
  const secure=useCallback((value:FrameIsland|null,origin:Basis,node:HTMLIFrameElement)=>{
    const current=held.current;
    if(!current||current!==origin||frame.current!==node||latest.current.subject!==origin.subject)throw Error('The originating source frame changed; keep its view open.');
    const document=readDocumentIdentity(origin.savedContent);
    if(!value||typeof value.text!=='string'||document?.payload!=='ql-doc'||value.documentId!==document.documentId)throw Error('The actual source frame did not disclose its pinned document identity; keep its view open.');
    setFrameIsland(value);
    if(sameDocumentPayload(value.text,islandSpan(origin.savedContent,'ql-doc')?.text)){clearPageDraft(origin.location.ref,lastSecuredPage.current??value.text,origin.location,origin.scope);lastSecuredPage.current=undefined;return;}
    const copy:HeldPageDraft={schema:'oi.cradle.page-working-copy/v1',location:origin.location,scope:origin.scope,base_revision:origin.revision,saved_content:origin.savedContent,frame_content:origin.content,document,island:{text:value.text,revision:value.revision,documentId:value.documentId}};
    writePageDraft(origin.location.ref,copy);lastSecuredPage.current=value.text;
  },[]);
  const checkpoint=useCallback(async()=>{
    const origin=held.current,node=frame.current;
    if(!origin||readDocumentIdentity(origin.savedContent)?.payload!=='ql-doc')return;
    if(!node)throw Error('The source frame is unavailable for its final local checkpoint.');
    const ticket=++readTicket.current,value=await readIsland();
    if(ticket!==readTicket.current)throw Error('The source page changed during its checkpoint; its view remains retained.');
    secure(value,origin,node);
  },[readIsland,secure]);
  useEffect(()=>basis&&identity?.payload==='ql-doc'?registerDocumentCheckpoint(binding.id,checkpoint):undefined,[basis,identity?.payload,binding.id,checkpoint]);
  useEffect(() => {
    if(!basis||identity?.payload!=='ql-doc')return;
    let live = true;
    const poll = () => { void checkpoint().catch(error=>{if(live)setNote(String(error));}); };
    const changed=(event:MessageEvent)=>{const node=frame.current,origin=held.current;if(!live||!node||!origin||event.source!==node.contentWindow||event.data?.type!=='oi:document-host-changed')return;++readTicket.current;try{secure(event.data.result,origin,node);}catch(error){setNote(String(error));}};
    poll();const timer = setInterval(poll, 2000);
    window.addEventListener('message',changed);window.addEventListener('pagehide',poll);
    const visibility=()=>{if(document.visibilityState==='hidden')poll();};document.addEventListener('visibilitychange',visibility);
    return () => { live = false; clearInterval(timer);window.removeEventListener('message',changed);window.removeEventListener('pagehide',poll);document.removeEventListener('visibilitychange',visibility); };
  }, [basis,identity?.payload,checkpoint,secure]);
  useEffect(()=>{
    const original=held.current,content=submitted.current;
    if(!original||!content||bufferDirty||savedContent!==content)return;
    const next={...original,inputText:content,savedContent,revision:baseRevision};
    held.current=next;setBasis(next);submitted.current=undefined;
    const span=islandSpan(content,'ql-doc');if(span)clearPageDraft(original.location.ref,span.text,original.location,original.scope);
  },[savedContent,baseRevision,bufferDirty]);
  const savedIslandText = identity?.payload === "ql-doc" ? islandSpan(basis?.savedContent??savedContent, "ql-doc")?.text ?? null : null;
  const pageDirty = identity?.payload === "ql-doc"
    && frameIsland?.text != null && savedIslandText != null && !sameDocumentPayload(frameIsland.text,savedIslandText);
  const save = async () => {
    if (savePending || conflicted || identity?.payload !== "ql-doc" || !basis) return;
    setSavePending(true);setNote(undefined);
    try {
      const access=captureFileResourceAccess(transport),origin=basis,node=frame.current;
      const current=()=>access.current()&&latest.current.subject===origin.subject&&samePageOwner(origin.scope,access.access?.scope??null);
      if(!current())throw Error('The retained source page belongs to another native owner scope.');
      const value=await readIsland();
      if(!current()||!node)throw Error('The originating native source retired before Save.');
      secure(value,origin,node);
      if(latest.current.baseRevision!==origin.revision||latest.current.savedContent!==origin.savedContent)throw Error('The native source advanced behind this retained page. Review its original basis before saving.');
      const islandText=value?.text;if(typeof islandText!=='string'||!islandText)throw Error('The actual page did not answer; nothing was saved.');
      const span=islandSpan(origin.content,'ql-doc');if(!span)throw Error('The pinned source has no declared payload.');
      const changed=!sameDocumentPayload(islandText,savedIslandText);
      if(changed&&latest.current.text!==origin.inputText)throw Error('Independent source typing and page edits are both retained. Review them before composing a source Save.');
      const composed=changed?origin.content.slice(0,span.start)+serialiseQlDoc(JSON.parse(islandText))+origin.content.slice(span.end):latest.current.text;
      submitted.current=composed;
      await onComposeSave(composed,current);
      if(!current())return;
    } catch (error) {submitted.current=undefined;setNote(String(error instanceof Error ? error.message : error));}
    finally {setSavePending(false);}
  };
  const state = conflicted
    ? { tone: "alert" as const, label: "The source changed behind this page — resolve it in Source view; nothing was overwritten" }
    : savePending
      ? { tone: "status" as const, label: "Saving…" }
      : note
        ? { tone: "alert" as const, label: note }
        : pageDirty
          ? { tone: "status" as const, label: "Unsaved on the page" }
          : bufferDirty
            ? { tone: "status" as const, label: "Source changes pending save" }
            : { tone: "status" as const, label: "Saved" };
  if (!identity) return null;
  if (!basis) return <p role='alert'>{note??'Resolving the native document basis…'}</p>;
  const savable = identity.payload === "ql-doc";
  return (
    <section className="document-host" data-document-host data-document-family={FAMILY_LABEL[identity.family] ?? identity.family}>
      <header className="document-host-bar">
        <span className="document-host-family">{FAMILY_LABEL[identity.family] ?? identity.label}</span>
        {identity.templateRef && <span className="document-host-template" title={`Template ${identity.templateRef}`}>{identity.templateRef}</span>}
        {identity.documentRevision != null && <span className="document-host-revision">r{identity.documentRevision}</span>}
        <span className="document-host-state" role={state.tone} data-document-state={state.label}>{state.label}</span>
        {savable && <button type="button" className="document-host-save" data-document-save disabled={savePending || conflicted || (!pageDirty && !bufferDirty)} onClick={() => void save()}>Save</button>}
      </header>
      {identity.relations && (identity.relations.design_refs.length > 0 || identity.relations.vision_refs.length > 0 || identity.relations.capability_refs.length > 0) && (
        <dl className="document-host-relations">
          {identity.relations.design_refs.length > 0 && <><dt>Design</dt><dd>{identity.relations.design_refs.join(", ")}</dd></>}
          {identity.relations.vision_refs.length > 0 && <><dt>Vision</dt><dd>{identity.relations.vision_refs.join(", ")}</dd></>}
          {identity.relations.capability_refs.length > 0 && <><dt>Capability</dt><dd>{identity.relations.capability_refs.join(", ")}</dd></>}
        </dl>
      )}
      <div ref={containerRef} className="document-host-body">
        <iframe
          ref={frame}
          className="document-frame"
          data-page-context
          title={binding.title}
          sandbox="allow-scripts allow-forms allow-downloads"
          referrerPolicy="no-referrer"
          srcDoc={documentFrameHtml(basis?.content??text)}
        />
      </div>
    </section>
  );
}

/** The whole source, unmodified except the injected observation + host
 * scripts (page-context and document-host). A document in the human ground
 * is self-contained by law, so no base href is needed; the frame keeps an
 * opaque origin either way. */
function documentFrameHtml(html: string): string {
  html=documentPayloadSource(html);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, match => `${match}${documentScripts}`);
  return `${documentScripts}${html}`;
}
