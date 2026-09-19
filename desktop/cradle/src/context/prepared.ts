import {readFile} from "../files/client";
import {parseInstance,htmlToText} from "../flow/instance";
import type {KernelTransportStatus} from "../kernel/types";
import {readDraft} from "../workspace/drafts";
import type {SurfaceBinding} from "../surface/types";
import {observationIsCurrent} from "./ComponentSelection";

/**
 * Prepared context (owner direction 2026-09-19): a selection becomes a
 * prepared context item directly — no modal between the gesture and the
 * material. Items are device-session presentation staging in the right
 * region's Context plane; they carry the EXACT identity the selection had
 * (canonical ref, selection-time revision or the attributable unsaved
 * snapshot, exact source range or the bounded observation) so a later
 * include can be revalidated and delivered through the native owners.
 * This is not a source store, conversation, or agent memory: nothing here
 * is semantic ground, and delivery still happens only through AIKit's own
 * draft/addressed operations.
 */

export type PreparedBounds = {x:number;y:number;width:number;height:number};

/** The wire shape of `oi:context-candidate` as every adapter dispatches it
 * (editor text, flow/terminal text, component and page observations). */
export interface ContextCandidateDetail {
  bindingId:string;
  kind:string;
  text:string;
  title?:string;
  sourceRef?:string;
  location?:SurfaceBinding["location"];
  start?:number;
  end?:number;
  observationKey?:string;
  selector?:string;
  role?:string;
  bounds?:PreparedBounds;
  revision?:string;
  workingCopy?:boolean;
}

export interface PreparedItem {
  id:string;
  bindingId:string;
  kind:"text"|"element"|"terminal";
  text:string;
  title:string;
  sourceRef?:string;
  location?:SurfaceBinding["location"];
  start?:number;
  end?:number;
  revision?:string;
  workingCopy:boolean;
  observationKey?:string;
  selector?:string;
  role?:string;
  bounds?:PreparedBounds;
  origin:string;
  createdAt:number;
  instruction?:string;
  /** Set when the item was actually included into a conversation's shared
   * draft through the native owner — never claims provider disclosure. */
  delivered?:{ref:string;project:string;at:number};
}

export interface ValidationContext {
  transport:KernelTransportStatus;
  buffers:Record<string,{content:string;base_revision:string;dirty:boolean}>;
  bindings:Record<string,SurfaceBinding>;
}

function matches(candidate:{start?:number;end?:number;text:string},content:string){
  return candidate.start!==undefined&&candidate.end!==undefined
    ?content.slice(candidate.start,candidate.end)===candidate.text
    :content.includes(candidate.text);
}

/**
 * Admission: the exact currency validation the tray performed when a
 * candidate arrived, run before an item may be staged. Throws the same
 * refusals — a stale selection never becomes a prepared item.
 */
export async function admitCandidate(ctx:ValidationContext,candidate:ContextCandidateDetail):Promise<PreparedItem> {
  if(!candidate.text.trim()||!candidate.bindingId)throw new Error("The selection is empty.");
  const binding=ctx.bindings[candidate.bindingId];
  if(!binding)throw new Error("Open a source to include this selection.");
  const kind:PreparedItem["kind"]=candidate.kind==="element"?"element":candidate.kind==="terminal"?"terminal":"text";
  const base={id:crypto.randomUUID(),bindingId:candidate.bindingId,kind,text:candidate.text,
    title:binding.title,observationKey:candidate.observationKey,selector:candidate.selector,
    role:candidate.role,bounds:candidate.bounds,start:candidate.start,end:candidate.end,
    revision:candidate.revision,workingCopy:!!candidate.workingCopy,createdAt:Date.now()};
  if(kind==="element")return {...base,sourceRef:binding.ref??candidate.sourceRef??binding.browser?.url,origin:binding.ref??candidate.sourceRef??binding.browser?.url??binding.title};
  if(binding.kind==="source"&&binding.ref){
    const buffer=ctx.buffers[binding.ref];
    if(!buffer||!matches(candidate,buffer.content))throw new Error("The selected source is no longer available. Select it again.");
    return {...base,sourceRef:binding.ref,revision:buffer.base_revision,workingCopy:buffer.dirty,origin:binding.ref};
  }
  if(binding.location){
    const draft=binding.ref?readDraft(binding.ref):undefined;
    if(draft&&matches(candidate,draft.content))return {...base,sourceRef:binding.ref,revision:draft.base_revision,workingCopy:draft.content!==draft.saved_content,origin:binding.ref??binding.title};
    const read=await readFile(ctx.transport,binding.location);
    if(!matches(candidate,read.content))throw new Error("The selected file changed before its revision could be recorded. Select it again.");
    return {...base,sourceRef:binding.ref,revision:read.revision,workingCopy:false,origin:binding.ref??binding.title};
  }
  return {...base,sourceRef:candidate.sourceRef??binding.ref,origin:candidate.sourceRef??binding.terminal?.cwd??binding.browser?.url??binding.title};
}

/**
 * Delivery composition: the exact revalidation + provenance quoting the
 * tray performed at action time, run against the stored item before any
 * include/address/publish/remember act. Equal text elsewhere is refused.
 */
export async function composeValidated(ctx:ValidationContext,item:PreparedItem):Promise<{sourceRef:string;text:string;revision?:string;title:string}> {
  const binding=ctx.bindings[item.bindingId];
  if(!binding)throw new Error("Open a source to include this selection.");
  let revision=item.revision;let working=item.workingCopy;let canonical:string|undefined;
  if(item.kind==="element"){
    if(!item.observationKey||!await observationIsCurrent(item.observationKey))throw new Error("The selected component changed. Pick it again.");
  }else if(binding.kind==="flow"&&binding.location){
    const read=await readFile(ctx.transport,binding.location);
    const doc=parseInstance(read.content);
    canonical=doc.entries.map(e=>htmlToText(e.html)).join("\n\n");
    if(working){
      const draft=(JSON.parse(localStorage.getItem(`oi-flow-instance-draft:${binding.id}`)??"null")??undefined) as {text?:string}|undefined;
      if(!draft?.text||!matches(item,draft.text))throw new Error("The Flow draft changed since selection. Select the passage again.");
      canonical=draft.text;
    }
  }else if(binding.kind==="source"&&binding.ref){
    const buffer=ctx.buffers[binding.ref];
    if(!buffer||!revision||buffer.base_revision!==revision)throw new Error("The source changed since selection. Select it again.");
    canonical=buffer.content;working=buffer.dirty;
  }else if(binding.location){
    const read=await readFile(ctx.transport,binding.location);
    if(!revision||read.revision!==revision)throw new Error("The file changed since selection. Select the passage again.");
    if(working){
      const draft=binding.ref?readDraft(binding.ref):undefined;
      if(!draft||draft.base_revision!==revision)throw new Error("The file draft changed since selection. Select the passage again.");
      canonical=draft.content;
    }else canonical=read.content;
  }
  if(canonical!==undefined&&!matches(item,canonical))throw new Error("The selected material changed. Select it again before including it.");
  const origin=item.sourceRef??binding.terminal?.cwd??binding.browser?.url??binding.title;
  const metadata=[binding.title,origin,revision?`revision ${revision}`:item.kind==="element"?`observed ${item.role==="text"?"text":"component"} · ${item.selector} · role ${item.role??"element"}${item.bounds?` · viewport bounds x=${item.bounds.x}, y=${item.bounds.y}, width=${item.bounds.width}, height=${item.bounds.height} CSS px`:""}`:"observed excerpt",working?"working copy — unsaved":""].filter(Boolean).join(" · ");
  const quoted=item.text.split("\n").map(line=>`> ${line}`).join("\n");
  return {sourceRef:origin,text:`@context — ${metadata}\n${quoted}`,revision,title:binding.title};
}

// --- The staging store: module-level presentation state with subscribe. ---

let items:PreparedItem[]=[];
const listeners=new Set<()=>void>();
let generation=0;

function emit(){generation++;for(const listener of listeners)listener();}

export function preparedSnapshot():readonly PreparedItem[]{return items;}
export function preparedGeneration():number{return generation;}
export function preparedSubscribe(listener:()=>void):()=>void{listeners.add(listener);return()=>listeners.delete(listener);}

export function preparedAdd(item:PreparedItem){
  if(items.some(existing=>existing.id===item.id))return;
  items=[...items,item];
  emit();
}

export function preparedUpdate(id:string,patch:Partial<PreparedItem>){
  const at=items.findIndex(existing=>existing.id===id);
  if(at<0)return;
  items=[...items.slice(0,at),{...items[at],...patch,id},...items.slice(at+1)];
  emit();
}

export function preparedRemove(id:string){
  if(!items.some(existing=>existing.id===id))return;
  items=items.filter(existing=>existing.id!==id);
  emit();
}

export function preparedClear(){
  if(!items.length)return;
  items=[];
  emit();
}

/** First count, then read: the shell's quiet indication when the right
 * region (and Context plane) is hidden. */
export function preparedCount():number{return items.length;}
