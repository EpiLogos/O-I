import {useEffect,useRef,useState} from "react";
import {DOCUMENT_FORMS,resolveDocumentForm} from "../flow/documentForms";
import {readFile} from "../files/client";
import {useKernel} from "../kernel/KernelProvider";
import {mutateField} from "./client";
import type {KernelTransportStatus} from "../kernel/types";
/** The supplied die shell, as the die itself carries its data: one embedded
 * JSON island the shell's own scripts read. The projection swaps ONLY the
 * island's content and appends one disclosed bridge script; the shell bytes
 * stay the owner's received file, read through Central's file route each
 * time the face mounts. */
const QL_DOC_SCRIPT=/<script type="application\/json" id="ql-doc">[\s\S]*?<\/script>/;
/** JSON is embedded inside a <script> element: a literal `</script` inside a
 * string would close the element early, so `<` is escaped the standard way. */
const embed=(payload:unknown)=>JSON.stringify(payload).replace(/</g,"\\u003c");
/** The edit bridge, appended to the PROJECTED copy only (the supplied file on
 * disk is never touched). The shell's own scripts already write every
 * authored-field input into their in-memory document; the bridge additionally
 * reports each `[data-field]` input to the host, which alone decides what is
 * wired to owner operations. The frame is sandboxed opaque-origin, so this
 * postMessage bridge is the only channel out — no host code can reach in. */
const BRIDGE=`<script data-oi-cradle="die-edit-bridge">(function(){
"use strict";
if(window.parent===window)return;
document.addEventListener("input",function(e){
  var f=e.target&&e.target.closest&&e.target.closest("[data-field]");
  if(!f)return;
  window.parent.postMessage({source:"oi-cradle-die-face",type:"field-input",field:f.getAttribute("data-field"),html:f.innerHTML},"*");
},true);
})();</script>`;
export function projectDieDocument(shell:string,payload:unknown):string|null{
  const match=shell.match(QL_DOC_SCRIPT);
  if(!match)return null;
  const projected=`${shell.slice(0,match.index)}<script type="application/json" id="ql-doc">${embed(payload)}</script>${shell.slice((match.index??0)+match[0].length)}`;
  // The bridge rides at the end of body, after the shell's own scripts have
  // bound their handlers — it only ever adds a listener.
  return projected.includes(BRIDGE.slice(0,60))?projected:projected.replace(/<\/body>/i,`${BRIDGE}</body>`);
}
/** One authored field's sync state against the owner. `refused` carries the
 * owner's message verbatim — never softened, never routed around. */
interface FieldSync{state:"saving"|"saved"|"refused";revision?:string;message?:string}
/** A mapped document field: the owner's own field list carries the id and the
 * template pointer that names the actual payload key it writes. */
export interface DayDocumentField{id:string;label?:string;template_pointer?:string}
/** The die face of a native Day document (Wave 6E/6F, edit wiring added in
 * the residue cell). The native document is the receiving substrate; its
 * template_payload IS the owner's ql-doc format. This face projects that
 * payload through the SUPPLIED die shell — and authored-field edits to the
 * document's mapped fields write through the owner's own
 * `central.document.mutate` `field.set` (human-only by owner law, CAS on the
 * exact revision, deduplicated by request id). The face never writes whole
 * bytes: the Source view's owner save stays the only whole-file route, and
 * the supplied file remains the portable original. Regions the owner has not
 * mapped are disclosed, never persisted. The face re-projects from the
 * owner's current bytes on every revision advance, and an unreadable shell
 * or payload is an honest unavailable state. */
export function DayDieFace({payload,revision,sourceRef,documentId,fields,project}:{payload:unknown;revision:string;sourceRef:string;documentId:string;fields:DayDocumentField[];project:string|null}){
  const kernel=useKernel();
  const [face,setFace]=useState<string>();
  const [failure,setFailure]=useState<string>();
  const [syncs,setSyncs]=useState<Record<string,FieldSync>>({});
  const [unmapped,setUnmapped]=useState<string[]>([]);
  const frameRef=useRef<HTMLIFrameElement>(null);
  // The revision this surface knows the owner to hold: seeded from the
  // buffer, advanced by each mutate receipt, re-anchored on re-projection.
  const knownRevision=useRef(revision);
  const queue=useRef<Promise<unknown>>(Promise.resolve());
  const timers=useRef<Map<string,number>>(new Map());
  // A ref, not state: the serialised mutate queue reads it from closures
  // that must see the unmount, not the render-time snapshot.
  const unmounted=useRef(false);
  useEffect(()=>{knownRevision.current=revision;},[revision]);
  useEffect(()=>()=>{unmounted.current=true;for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();},[]);
  useEffect(()=>{
    let alive=true;
    setFailure(undefined);
    (async()=>{
      try{
        const transport:KernelTransportStatus=kernel.transport;
        const projects=kernel.snapshot.navigator?.root?.work.projects;
        const location=await resolveDocumentForm(transport,DOCUMENT_FORMS[1],projects);
        const shell=await readFile(transport,location);
        const projected=projectDieDocument(shell.content,payload);
        if(!projected){setFailure("The supplied die shell no longer carries its ql-doc data island; the face cannot be projected honestly.");return;}
        if(alive)setFace(projected);
      }catch(reason){if(alive)setFailure(`The die face could not be projected from the supplied shell: ${String(reason)}`);}
    })();
    return()=>{alive=false;};
  },[kernel.transport,kernel.snapshot.navigator?.root,revision]);
  useEffect(()=>{
    // Snapshot the mapped fields per effect run: only fields the owner's
    // document actually maps (a template pointer into the payload) write.
    const mapped=new Set(fields.filter(field=>typeof field.template_pointer==="string").map(field=>field.id));
    const onMessage=(event:MessageEvent)=>{
      if(event.source!==frameRef.current?.contentWindow)return;
      const data=event.data as {source?:string;type?:string;field?:string;html?:string};
      if(data?.source!=="oi-cradle-die-face"||data.type!=="field-input"||typeof data.field!=="string"||typeof data.html!=="string")return;
      if(!mapped.has(data.field)){
        setUnmapped(previous=>previous.includes(data.field as string)?previous:[...previous,data.field as string]);
        return;
      }
      const fieldId=data.field;
      const pending=timers.current.get(fieldId);
      if(pending!==undefined)clearTimeout(pending);
      // The shell itself settles a field 900 ms after its last input before
      // bumping its revision — the host waits out the same settle before
      // composing one owner field operation per settled edit.
      timers.current.set(fieldId,window.setTimeout(()=>{
        timers.current.delete(fieldId);
        setSyncs(previous=>({...previous,[fieldId]:{state:"saving"}}));
        queue.current=queue.current.then(async()=>{
          if(unmounted.current)return;
          try{
            const reading=await mutateField(kernel.transport,project,{
              source_ref:sourceRef,document_id:documentId,
              expected_revision:knownRevision.current,field_id:fieldId,value:data.html as string,
            });
            const receiptRevision=reading?.operation_receipt?.revision;
            if(typeof receiptRevision==="string")knownRevision.current=receiptRevision;
            if(unmounted.current)return;
            setSyncs(previous=>({...previous,[fieldId]:{state:"saved",revision:receiptRevision}}));
            // The owner's authoritative readback: re-read the Day through its
            // own route so the buffer advances and the face re-projects from
            // the owner's bytes — never from this surface's optimism.
            await kernel.rereadSource(sourceRef);
          }catch(reason){
            if(unmounted.current)return;
            setSyncs(previous=>({...previous,[fieldId]:{state:"refused",message:String(reason instanceof Error?reason.message:reason)}}));
          }
        });
      },900));
    };
    window.addEventListener("message",onMessage);
    return()=>window.removeEventListener("message",onMessage);
  },[fields,sourceRef,documentId,project,kernel]);
  const savingFields=Object.entries(syncs).filter(([,sync])=>sync.state==="saving").map(([field])=>field);
  const refusedFields=Object.entries(syncs).filter(([,sync])=>sync.state==="refused");
  const savedCount=Object.values(syncs).filter(sync=>sync.state==="saved").length;
  if(failure)return <p className="die-face-unavailable" role="status">{failure}</p>;
  if(face===undefined)return <p className="die-face-loading" role="status" aria-busy="true">Projecting the die face from the supplied shell…</p>;
  return (
    <div className="die-face-host">
      <div className="die-face-sync" role="status" aria-live="polite">
        {savingFields.length>0&&<p className="die-face-sync-saving">Saving {savingFields.length} edited {savingFields.length===1?"field":"fields"} through the owner&apos;s field operation…</p>}
        {savedCount>0&&savingFields.length===0&&<p className="die-face-sync-saved">{savedCount} edited {savedCount===1?"field":"fields"} saved through the owner — the face re-projects the owner&apos;s bytes.</p>}
        {unmapped.length>0&&<p className="die-face-sync-unmapped">{unmapped.length} edited {unmapped.length===1?"region has":"regions have"} no owner field mapping — the supplied form records them in the frame only, and they do not persist.</p>}
        {refusedFields.map(([field,sync])=><p key={field} className="die-face-sync-refused" role="alert">The owner refused the edit to {field}: {sync.message}</p>)}
      </div>
      <iframe ref={frameRef} className="die-face" title="Day die — the document's supplied form, projected from its native payload" sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" srcDoc={face}/>
    </div>
  );
}
