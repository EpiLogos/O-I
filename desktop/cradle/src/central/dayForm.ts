/** The supplied form is material, not a privileged host. Only an explicit
 * host Save consumes a requested snapshot and invokes native field operations. */
export interface DayDocumentField {id:string;label?:string;template_pointer?:string}
export interface FormBasis {sourceRef:string;documentId:string;revision:string;payload:unknown;fields:DayDocumentField[]}
export interface FieldEdit {id:string;pointer:string;before:unknown;value:unknown}
export type FieldWriter=(input:{source_ref:string;document_id:string;expected_revision:string;request_id:string;field_id:string;value:unknown})=>Promise<unknown>;
export const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const clone=<T,>(v:T):T=>v===undefined?v:JSON.parse(JSON.stringify(v)) as T;
const equal=(a:unknown,b:unknown):boolean=>JSON.stringify(a)===JSON.stringify(b);
export function pointerValue(payload:unknown,pointer:string):unknown {
 if(!pointer.startsWith("/"))throw new Error("Native field needs a non-root template pointer");
 let current:unknown=payload;
 for(const part of pointer.slice(1).split("/")) {
  if(/~(?![01])/u.test(part))throw new Error("Invalid native JSON pointer escape");
  const key=part.replace(/~1/g,"/").replace(/~0/g,"~");
  if(!isObject(current)&&!Array.isArray(current))return undefined;
  if(!Object.prototype.hasOwnProperty.call(current,key))return undefined;
  current=(current as Record<string,unknown>)[key];
 }
 return current;
}
function replacePointer(payload:unknown,pointer:string,value:unknown):void {
 const parts=pointer.slice(1).split("/").map(p=>p.replace(/~1/g,"/").replace(/~0/g,"~"));
 let object=payload as Record<string,unknown>;
 for(const part of parts.slice(0,-1))object=object[part] as Record<string,unknown>;
 const key=parts[parts.length-1]!;
 if(["__proto__","prototype","constructor"].includes(key))throw new Error("Unsafe template member");
 object[key]=clone(value);
}
/** Apply only changed object leaves after explicit review. Aggregate native
 * fields must not erase a concurrently changed sibling when the person edited
 * one member. Arrays remain one reviewed value (their order has meaning). */
function reviewedMerge(before:unknown,draft:unknown,current:unknown):unknown {
 if(equal(before,draft))return clone(current);
 if(isObject(before)&&isObject(draft)&&isObject(current)){
  const merged=clone(current);
  for(const key of new Set([...Object.keys(before),...Object.keys(draft)])){
   if(["__proto__","prototype","constructor"].includes(key))throw new Error("Unsafe template member");
   if(equal(before[key],draft[key]))continue;
   if(!Object.prototype.hasOwnProperty.call(draft,key))delete merged[key];
   else merged[key]=reviewedMerge(before[key],draft[key],current[key]);
  }
  return merged;
 }
 return clone(draft);
}
export function formEdits(basis:FormBasis,next:unknown):FieldEdit[] {
 if(!isObject(basis.payload)||!isObject(next)||!isObject(next.fields))throw new Error("Snapshot has no original field map");
 // The retained form link and the human Day's identity are not edits made by
 // a script's browser-clock initialization or a message from a document.
 if(!equal(next._oi_form_source,basis.payload._oi_form_source))throw new Error("Snapshot changed its retained source binding");
 if(isObject(basis.payload.meta)&&isObject(next.meta))for(const key of ["uuid","date","timezone","created"]){
  if(basis.payload.meta[key]!=null&&!equal(next.meta[key],basis.payload.meta[key]))throw new Error(`Snapshot changed Day ${key}`);
 }
 const seen=new Set<string>();
 const entries=basis.fields.filter(f=>typeof f.template_pointer==="string").map(f=>{
  if(seen.has(f.id))throw new Error("Duplicate native field identity");seen.add(f.id);
  const pointer=f.template_pointer!;
  if(pointer.includes("_oi_form_source")||pointer.split("/").some(p=>["__proto__","prototype","constructor"].includes(p)))throw new Error("Unsafe native field mapping");
  const before=pointerValue(basis.payload,pointer),value=pointerValue(next,pointer);
  if(before===undefined||value===undefined)throw new Error(`Snapshot lost native field ${f.id}`);
  return {id:f.id,pointer,before,value};
 }).filter(e=>!equal(e.before,e.value)).sort((a,b)=>a.pointer.length-b.pointer.length);
 // An aggregate native mapping (e.g. /fields) carries the typed lists and
 // individual fields atomically. Do not then replay its child mappings.
 return entries.filter((edit,i)=>!entries.slice(0,i).some(parent=>edit.pointer.startsWith(parent.pointer+"/")));
}
export function unmappedChanges(basis:FormBasis,next:unknown):string[] {
 if(!isObject(basis.payload)||!isObject(next))return ["unreadable payload"];
 const changed:string[]=[];
 const visit=(old:unknown,value:unknown,pointer:string)=>{
  if(equal(old,value)||basis.fields.some(f=>f.template_pointer===pointer))return;
  if(isObject(old)&&isObject(value))for(const key of new Set([...Object.keys(old),...Object.keys(value)]))visit(old[key],value[key],pointer+"/"+key.replace(/~/g,"~0").replace(/\//g,"~1"));
  else changed.push(pointer);
 };
 visit(basis.payload,next,"");return changed;
}
export function validateDocumentBasis(value:unknown,sourceRef:string,documentId:string):FormBasis {
 if(!isObject(value)||value.schema!=="central.document-reading/v1"||!isObject(value.source)||value.source.ref!==sourceRef||value.document_id!==documentId||!isObject(value.revision)||typeof value.revision.revision!=="string"||!isObject(value.document)||value.document.document_id!==documentId||value.document.kind!=="day"||!Array.isArray(value.document.fields)||!isObject(value.document.template_payload)||value.automatic_agent_or_model_invocation!==false)throw new Error("Native document reading does not match this Day/source");
 return {sourceRef,documentId,revision:value.revision.revision,payload:value.document.template_payload,fields:value.document.fields as DayDocumentField[]};
}
/** In-memory editing only, never an alternate source store. A sent operation
 * with a lost acknowledgement blocks replay until an explicit native review. */
export class DayFormSession {
 basis:FormBasis;
 draft:unknown|undefined;
 busy=false;
 blocked:string|undefined;
 active=true;
 saved=0;
 edited=false;
 constructor(basis:FormBasis){this.basis=clone(basis);}
 markDirty():void {this.edited=true;}
 stage(payload:unknown):void {formEdits(this.basis,payload);this.draft=clone(payload);this.edited=true;}
 changes():FieldEdit[]{return this.draft===undefined?[]:formEdits(this.basis,this.draft);}
 observe(next:FormBasis):void {
  if(next.sourceRef!==this.basis.sourceRef||next.documentId!==this.basis.documentId)throw new Error("Cannot replace this Day's native identity");
  if(next.revision===this.basis.revision)return;
  if(this.busy||this.edited||this.draft!==undefined){this.blocked="Native source changed; review its current revision before saving retained drafts.";return;}
  this.basis=clone(next);
 }
 reviewOnto(next:FormBasis):void {
  if(this.busy)throw new Error("An operation is still pending");
  if(next.sourceRef!==this.basis.sourceRef||next.documentId!==this.basis.documentId)throw new Error("Redirected Day review");
  const edits=this.changes();const draft=clone(next.payload);
  for(const edit of edits){
   const mapping=next.fields.find(f=>f.id===edit.id&&f.template_pointer===edit.pointer);
   if(!mapping||pointerValue(draft,edit.pointer)===undefined)throw new Error("Native field mappings changed; the draft needs manual review");
   replacePointer(draft,edit.pointer,reviewedMerge(edit.before,edit.value,pointerValue(draft,edit.pointer)));
  }
  this.basis=clone(next);this.draft=draft;this.blocked=undefined;
 }
 async save(write:FieldWriter):Promise<void> {
  if(!this.active||this.busy||this.blocked)throw new Error(this.blocked??"The Day is not ready to save");
  const snapshot=this.draft;if(snapshot===undefined)return;
  const edits=this.changes();this.busy=true;
  try {
   for(const edit of edits){
    if(!this.active||this.blocked)throw new Error("Day view or source changed; no further writes were sent");
    const expected=this.basis.revision;
    const response=await write({source_ref:this.basis.sourceRef,document_id:this.basis.documentId,expected_revision:expected,request_id:`req/desktop-${crypto.randomUUID()}`,field_id:edit.id,value:clone(edit.value)});
    const next=validateDocumentBasis(response,this.basis.sourceRef,this.basis.documentId);
    const receipt=isObject(response)?response.operation_receipt:undefined;
    if(!isObject(receipt)||receipt.status!=="committed"||receipt.previous_revision!==expected||receipt.revision!==next.revision||!equal(pointerValue(next.payload,edit.pointer),edit.value))throw new Error("Missing or contradictory native save acknowledgement; the effect is unknown");
    this.basis=next;this.saved++;
   }
   // An edit arriving while a save is pending remains a new unsaved draft.
   if(this.draft===snapshot){this.draft=undefined;this.edited=false;}
  } catch(error){this.blocked=String(error);throw error;}
  finally{this.busy=false;}
 }
}
const DATA=/<script\s+type="application\/json"\s+id="ql-doc">[\s\S]*?<\/script>/;
const embed=(v:unknown)=>JSON.stringify(v).replace(/</g,"\\u003c");
export function projectDieDocument(shell:string,payload:unknown):string|null {
 if(!DATA.test(shell))return null;
 // This is the supplied editor's existing closure/serialization seam. If its
 // contract changes we refuse rather than inventing a replacement form.
 const seam="/* ---------- go ---------- */";
 if(shell.split(seam).length!==2||!shell.includes("function touch(){ dirty=true;"))return null;
 const bridge=`\n/* Native host snapshot bridge: projection only, no source writes. */
window.addEventListener('message',function(e){
 if(e.source!==window.parent||!e.data||e.data.source!=='oi-day-host'||e.data.type!=='snapshot'||typeof e.data.nonce!=='string')return;
 try{derive();window.parent.postMessage({source:'oi-cradle-die-face',type:'snapshot',nonce:e.data.nonce,payload:JSON.parse(JSON.stringify(D))},'*');}
 catch(error){window.parent.postMessage({source:'oi-cradle-die-face',type:'snapshot-error',nonce:e.data.nonce,error:String(error)},'*');}
});\n`;
 let projected=shell.replace(DATA,()=>`<script type="application/json" id="ql-doc">${embed(payload)}</script>`).replace(seam,bridge+seam);
 projected=projected.replace("function touch(){ dirty=true;","function touch(){ dirty=true; if(window.parent!==window)window.parent.postMessage({source:'oi-cradle-die-face',type:'dirty'},'*');");
 // The frame is opaque-origin. No network, top navigation, bridge, or external
 // script is allowed; the original inline editor and explicit copy still work.
 const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">`;
 return projected.replace(/<head>/i,`<head>${csp}`);
}
