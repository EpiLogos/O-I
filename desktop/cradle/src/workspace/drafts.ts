import type {CentralLocation} from '../kernel/types';
import type {FileResourceScope} from '../files/resources';
import {formEdits,projectDieDocument,type FormBasis} from '../central/dayForm';
import {islandSpan,readDocumentIdentity,serialiseQlDoc,type DocumentIdentity} from '../document/identity';

export interface HeldDraft {content:string;base_revision:string;saved_content:string}
/** A local working copy observed from the real document frame. It is neither
 * a source draft nor an admitted native source reading. Both variants share
 * the original v1 record and retain their independently observed bases. */
export interface HeldPageDraft {
 schema:'oi.cradle.page-working-copy/v1';
 location:CentralLocation;
 scope:FileResourceScope|null;
 base_revision:string;
 saved_content:string;
 frame_content:string;
 document:DocumentIdentity;
 island:{text:string;revision:number|null;documentId:string|null};
 acknowledged?:boolean;
}
type RecordValue=Record<string,unknown>;
const key=(ref:string)=>'oi-cradle.draft.v1:'+ref;
function record(ref:string):RecordValue {
 const raw=localStorage.getItem(key(ref));
 if(raw===null)return {};
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('The existing device draft record is unreadable; keep this view open.');
 return value as RecordValue;
}
function source(value:RecordValue):HeldDraft|null {
 return typeof value.content==='string'&&typeof value.base_revision==='string'&&typeof value.saved_content==='string'?{content:value.content,base_revision:value.base_revision,saved_content:value.saved_content}:null;
}
function put(ref:string,value:RecordValue):void {
 if(Object.keys(value).length===0){localStorage.removeItem(key(ref));return;}
 const encoded=JSON.stringify(value);
 localStorage.setItem(key(ref),encoded);
 if(localStorage.getItem(key(ref))!==encoded)throw Error('This device did not acknowledge the exact draft record; keep the view open.');
}
export function readDraft(ref:string):HeldDraft|null {try{return source(record(ref));}catch{return null;}}
/** Read/merge/write is synchronous in a presenter. WebStorage is not a
 * cross-window transaction and its acknowledgement is not physical fsync. */
export function writeDraft(ref:string,draft:HeldDraft):void {put(ref,{...record(ref),...draft,acknowledged:true});}
export function clearSavedDraft(ref:string,content:string):void {
 const held=record(ref);if(source(held)?.content!==content)return;
 for(const field of ['content','base_revision','saved_content','acknowledged'])delete held[field];
 put(ref,held);
}
export function writeDraftIntent(ref:string,draft:HeldDraft):void {put(ref,{...record(ref),...draft,acknowledged:false});}
export function acknowledgeDraft(ref:string,draft:HeldDraft):void {
 const held=record(ref),current=source(held);
 // A delayed acknowledgement never replaces newer source typing or its basis.
 if(current&&JSON.stringify(current)!==JSON.stringify(draft))return;
 put(ref,{...held,...draft,acknowledged:true});
}
export function readDurableDraft(ref:string):{draft:HeldDraft;acknowledged:boolean}|null {
 try{const held=record(ref),draft=source(held);return draft?{draft,acknowledged:held.acknowledged!==false}:null;}catch{return null;}
}
export function samePageOwner(a:FileResourceScope|null,b:FileResourceScope|null):boolean {
 return a===null||b===null?a===b:a.owner===b.owner&&a.world===b.world&&a.workcell===b.workcell;
}
export function samePageLocation(a:CentralLocation,b:CentralLocation):boolean {return a.schema===b.schema&&a.ref===b.ref&&a.root===b.root&&a.path===b.path;}
function page(value:unknown):HeldPageDraft|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const held=value as HeldPageDraft;
 if(held.schema!=='oi.cradle.page-working-copy/v1'||held.location?.schema!=='central.path-ref/v1'||typeof held.location.ref!=='string'||typeof held.location.root!=='string'||typeof held.location.path!=='string'||typeof held.base_revision!=='string'||typeof held.saved_content!=='string'||typeof held.frame_content!=='string'||held.document?.payload!=='ql-doc'||typeof held.island?.text!=='string')return null;
 if(held.scope!==null&&(!held.scope||['owner','world','workcell','accessEpoch'].some(field=>typeof (held.scope as unknown as RecordValue)[field]!=='string')))return null;
 const identity=readDocumentIdentity(held.saved_content);
 if(identity?.payload!=='ql-doc'||identity.documentId!==held.document.documentId||identity.family!==held.document.family||identity.documentRevision!==held.document.documentRevision)return null;
 const frame=JSON.parse(held.island.text),meta=frame?.meta;
 const id=typeof meta?.documentId==='string'?meta.documentId:typeof meta?.uuid==='string'?meta.uuid:null;
 const revision=Number.isSafeInteger(meta?.revision)?meta.revision:null;
 if(id!==held.island.documentId||id!==identity.documentId||revision!==held.island.revision||!islandSpan(held.frame_content,'ql-doc'))return null;
 return held;
}
export function readPageDraft(ref:string):HeldPageDraft|null {try{return page(record(ref).page);}catch{return null;}}
export function writePageDraft(ref:string,draft:HeldPageDraft):void {
 if(!page(draft))throw Error('The observed page working copy does not match its native document identity and pinned basis. Keep this view open.');
 if(ref!==draft.location.ref)throw Error('The page working copy must name its exact native file ref.');
 const held=record(ref),existing=page(held.page),next={...draft,acknowledged:true};
 if(held.page!==undefined&&!existing)throw Error('This record retains a different or unreadable page working-copy variant; keep both views open.');
 if(existing&&(!samePageOwner(existing.scope,draft.scope)||!samePageLocation(existing.location,draft.location)))throw Error('This record retains page edits from a different native owner scope. Keep the new view open until both working copies can be reviewed.');
 if(JSON.stringify(held.page)===JSON.stringify(next))return;
 put(ref,{...held,page:next});
}
export function clearPageDraft(ref:string,islandText:string,location:CentralLocation,scope:FileResourceScope|null):void {
 const held=record(ref),copy=page(held.page);
 if(!copy||copy.island.text!==islandText||!samePageLocation(copy.location,location)||!samePageOwner(copy.scope,scope))return;
 delete held.page;put(ref,held);
}
/** Reconstruction uses only the observed payload and original frame source;
 * owner readback remains separate, and native Save still validates its basis. */
export function pageDraftHtml(draft:HeldPageDraft):string {
 if(!page(draft))throw Error('The retained page working copy is invalid.');
 const span=islandSpan(draft.frame_content,'ql-doc');
 if(!span)throw Error('The original page did not contain its declared payload.');
 return draft.frame_content.slice(0,span.start)+serialiseQlDoc(JSON.parse(draft.island.text))+draft.frame_content.slice(span.end);
}

/** Original Daily Die over an actual native field-document basis. The form
 * payload is local recovery material; only the existing field Save owns
 * mutation. It shares the v1 record with source typing and other page kinds. */
export interface HeldDayPageDraft {
 schema:'oi.cradle.native-day-working-copy/v1';scope:FileResourceScope|null;
 basis:FormBasis;template:{location:CentralLocation;revision:string;content:string};
 snapshot:unknown;acknowledged?:boolean;
}
function dayPage(value:unknown):HeldDayPageDraft|null {
 if(!value||typeof value!=='object')return null;
 const draft=value as HeldDayPageDraft;
 if(draft.schema!=='oi.cradle.native-day-working-copy/v1'||typeof draft.basis?.sourceRef!=='string'||typeof draft.basis.documentId!=='string'||typeof draft.basis.revision!=='string'||!Array.isArray(draft.basis.fields)||draft.template?.location?.schema!=='central.path-ref/v1'||typeof draft.template.location.ref!=='string'||typeof draft.template.location.root!=='string'||typeof draft.template.location.path!=='string'||typeof draft.template.revision!=='string'||typeof draft.template.content!=='string')return null;
 if(draft.scope!==null&&(!draft.scope||['owner','world','workcell','accessEpoch'].some(field=>typeof (draft.scope as unknown as RecordValue)[field]!=='string')))return null;
 formEdits(draft.basis,draft.snapshot);
 if(!projectDieDocument(draft.template.content,draft.snapshot))return null;
 return draft;
}
export function readDayPageDraft(sourceRef:string):HeldDayPageDraft|null {try{const draft=dayPage(record(sourceRef).page);return draft?.basis.sourceRef===sourceRef?draft:null;}catch{return null;}}
export function writeDayPageDraft(draft:HeldDayPageDraft):void {
 if(!dayPage(draft))throw Error('The original Day working copy lost its native source, document or supplied-form basis. Keep this view open.');
 const ref=draft.basis.sourceRef,held=record(ref),previous=dayPage(held.page);
 if(held.page!==undefined&&!previous)throw Error('This record retains another or unreadable page variant; keep the original Day view open.');
 if(previous&&(!samePageOwner(previous.scope,draft.scope)||previous.basis.documentId!==draft.basis.documentId||!samePageLocation(previous.template.location,draft.template.location)))throw Error('This record retains original Day edits from another owner/document/form scope.');
 put(ref,{...held,page:{...draft,acknowledged:true}});
}
export function clearDayPageDraft(sourceRef:string,snapshot:unknown,scope:FileResourceScope|null):void {
 const held=record(sourceRef),draft=dayPage(held.page);
 if(!draft||!samePageOwner(draft.scope,scope)||JSON.stringify(draft.snapshot)!==JSON.stringify(snapshot))return;
 delete held.page;put(sourceRef,held);
}

/** Private exact editor input, sharing the original draft owner. These refs
 * are recovery-copy identities, never native file/Expression addresses. */
export type NativeInputJson = null|boolean|number|string|readonly NativeInputJson[]|{[key:string]:NativeInputJson};
export interface NativeInputScope {owner:string;world:string;workcell:string;accessEpoch:string;workspace_id:string;surface_id:string}
export interface NativeInputBasis {expression_ref:string;scene_ref:string;revision:number;authored_revision:number}
export interface NativeInputTarget {scope:'entity'|'field';entity_id:string|null;entity_ref:string|null;step_id:string|null;parameter:string|null;family:string|null;axis:'y'|'z'|null}
export type NativeInputValue = {kind:'text';text:string;initial:string}
 |{kind:'gesture';gesture:{[key:string]:NativeInputJson};changes:{[key:string]:NativeInputJson}[]};
export interface HeldPrivateNativeInput {
 schema:'oi.cradle.private-native-input/v1';writer_id:string;copy_id:string;
 scope:NativeInputScope;writer_scope:NativeInputScope;basis:NativeInputBasis;target:NativeInputTarget;input:NativeInputValue;refusal?:string;
}
export interface PrivateNativeInputReceipt {ref:string;copy:HeldPrivateNativeInput}
export interface PrivateNativeInputInventory {
 copies:PrivateNativeInputReceipt[];
 malformed:{ref:string;raw:string;reason:string}[];
 foreign:{ref:string;raw:string;reason:string}[];
}
const privateInputPrefix='private-native-input:';
const privateInputReceipts=new WeakMap<PrivateNativeInputReceipt,{ref:string;body:string}>();
const inputObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype;
const inputText=(value:unknown,max=4096):value is string=>typeof value==='string'&&!!value.length&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const inputId=(value:unknown):value is string=>inputText(value,128)&&/^[a-zA-Z0-9_.-]+$/.test(value);
const inputHasOwn=(value:object,field:string)=>Object.prototype.hasOwnProperty.call(value,field);
function inputFields(value:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]):void {
 if(required.some(field=>!inputHasOwn(value,field))||Object.keys(value).some(field=>!required.includes(field)&&!optional.includes(field)))throw Error('The private input record has unsupported or missing fields');
}
/** JSON acknowledgement must not omit executable/accessor/non-finite state. */
function inputJson(value:unknown,path=new Set<object>(),depth=0):void {
 if(depth>64)throw Error('The private input is too deeply nested; keep the editor open');
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value)||Object.is(value,-0))throw Error('The private input contains an unrepresentable number');return;}
 if(typeof value!=='object'||!value||!Array.isArray(value)&&!inputObject(value))throw Error('Private input must contain plain serializable values, never callbacks');
 if(path.has(value))throw Error('Private input must not contain cycles');
 if(Object.getOwnPropertySymbols(value).length)throw Error('Private input must not contain symbol fields');
 path.add(value);
 const names=Object.getOwnPropertyNames(value).filter(name=>!(Array.isArray(value)&&name==='length'));
 if(Array.isArray(value)&&(names.length!==value.length||names.some((name,index)=>name!==String(index))))throw Error('Private input arrays must not contain holes or extra fields');
 for(const name of names){const descriptor=Object.getOwnPropertyDescriptor(value,name)!;if(!descriptor.enumerable||!inputHasOwn(descriptor,'value'))throw Error('Private input must not contain hidden fields or accessors');inputJson(descriptor.value,path,depth+1);}
 path.delete(value);
}
export function validateNativeInputScope(raw:unknown):NativeInputScope {
 inputJson(raw);
 if(!inputObject(raw))throw Error('The private input requires the actual configured owner scope');
 inputFields(raw,['owner','world','workcell','accessEpoch','workspace_id','surface_id']);
 if(Object.values(raw).some(value=>!inputText(value)))throw Error('The private input scope is incomplete');
 return {...raw} as unknown as NativeInputScope;
}
/** Epoch is captured provenance, not permission to retarget another owner. */
export function sameNativeInputOwner(a:NativeInputScope,b:NativeInputScope):boolean {
 return a.owner===b.owner&&a.world===b.world&&a.workcell===b.workcell&&a.workspace_id===b.workspace_id&&a.surface_id===b.surface_id;
}
export function validatePrivateNativeInput(raw:unknown):HeldPrivateNativeInput {
 inputJson(raw);
 if(!inputObject(raw))throw Error('The private input record is invalid');
 inputFields(raw,['schema','writer_id','copy_id','scope','writer_scope','basis','target','input'],['refusal']);
 if(raw.schema!=='oi.cradle.private-native-input/v1'||!inputId(raw.writer_id)||!inputId(raw.copy_id))throw Error('The private input has no exact writer/copy identity');
 const scope=validateNativeInputScope(raw.scope),writerScope=validateNativeInputScope(raw.writer_scope);
 if(!sameNativeInputOwner(scope,writerScope))throw Error('The private input writer belongs to another owner/workspace/surface');
 if(!inputObject(raw.basis))throw Error('The private input has no captured native basis');
 inputFields(raw.basis,['expression_ref','scene_ref','revision','authored_revision']);
 if(!inputText(raw.basis.expression_ref,160)||!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(raw.basis.expression_ref)
  ||!inputText(raw.basis.scene_ref)||!Number.isSafeInteger(raw.basis.revision)||(raw.basis.revision as number)<0
  ||!Number.isSafeInteger(raw.basis.authored_revision)||(raw.basis.authored_revision as number)<0)throw Error('The private input native basis is invalid');
 if(!inputObject(raw.target))throw Error('The private input has no exact target');
 const inputTarget=raw.target;
 inputFields(inputTarget,['scope','entity_id','entity_ref','step_id','parameter','family','axis']);
 if(!['entity','field'].includes(String(inputTarget.scope))||!['y','z',null].includes(inputTarget.axis as 'y'|'z'|null)
  ||['entity_id','entity_ref','step_id','parameter','family'].some(field=>inputTarget[field]!==null&&!inputText(inputTarget[field])))throw Error('The private input target is invalid');
 if(inputTarget.scope==='field'&&(inputTarget.entity_id!==null||inputTarget.entity_ref!==null||inputTarget.step_id!==null)
  ||inputTarget.scope==='entity'&&inputTarget.entity_id===null)throw Error('The private input confuses shared Field and entity custody');
 if(!inputObject(raw.input))throw Error('The private input payload is invalid');
 if(raw.input.kind==='text'){
  inputFields(raw.input,['kind','text','initial']);if(typeof raw.input.text!=='string'||typeof raw.input.initial!=='string')throw Error('Retain the exact text and its initial value');
 }else if(raw.input.kind==='gesture'){
  inputFields(raw.input,['kind','gesture','changes']);if(!inputObject(raw.input.gesture)||!Array.isArray(raw.input.changes)||raw.input.changes.length>256||raw.input.changes.some(value=>!inputObject(value)))throw Error('Retain the complete serializable gesture and intended changes');
 }else throw Error('Unsupported private native input kind');
 if(raw.refusal!==undefined&&typeof raw.refusal!=='string')throw Error('The private input refusal must be exact text');
 const encoded=JSON.stringify(raw);if(encoded.length>16*1024*1024)throw Error('The private input exceeds the device recovery bound; keep the editor open');
 return JSON.parse(encoded) as HeldPrivateNativeInput;
}
export function privateNativeInputRef(copy:Pick<HeldPrivateNativeInput,'writer_id'|'copy_id'>):string {
 if(!inputId(copy.writer_id)||!inputId(copy.copy_id))throw Error('Choose an exact private writer/copy identity');
 return privateInputPrefix+copy.writer_id+':'+copy.copy_id;
}
function privateInputReceipt(ref:string,copy:HeldPrivateNativeInput):PrivateNativeInputReceipt {
 if(ref!==privateNativeInputRef(copy))throw Error('The private input ref differs from its writer/copy identity');
 const receipt={ref,copy};privateInputReceipts.set(receipt,{ref,body:JSON.stringify(copy)});return receipt;
}
export function readPrivateNativeInput(ref:string):PrivateNativeInputReceipt|null {
 if(!ref.startsWith(privateInputPrefix))throw Error('Read an exact private native input ref');
 const held=record(ref);if(held.native_input===undefined)return null;
 return privateInputReceipt(ref,validatePrivateNativeInput(held.native_input));
}
/** Qualification never refreshes the captured input or a native CAS basis. */
export function qualifyPrivateNativeInput(receipt:PrivateNativeInputReceipt):HeldPrivateNativeInput {
 const observed=privateInputReceipts.get(receipt);
 if(!observed||receipt.ref!==observed.ref||JSON.stringify(validatePrivateNativeInput(receipt.copy))!==observed.body)throw Error('Use the unchanged private input receipt actually read or retained');
 const held=readPrivateNativeInput(observed.ref);
 if(!held||JSON.stringify(held.copy)!==observed.body)throw Error('Newer private input replaced this receipt; every copy was retained');
 return validatePrivateNativeInput(receipt.copy);
}
export function readPrivateNativeInputs(scope:NativeInputScope):PrivateNativeInputInventory {
 const configured=validateNativeInputScope(scope),out:PrivateNativeInputInventory={copies:[],malformed:[],foreign:[]};
 const refs:string[]=[];for(let i=0;i<localStorage.length;i++){const name=localStorage.key(i);if(name?.startsWith(key(privateInputPrefix)))refs.push(name.slice('oi-cradle.draft.v1:'.length));}
 for(const ref of refs){const raw=localStorage.getItem(key(ref));if(raw===null)continue;
  try{const receipt=readPrivateNativeInput(ref);if(!receipt)throw Error('The private copy record has no native input variant');
   if(!sameNativeInputOwner(receipt.copy.scope,configured)){out.foreign.push({ref,raw,reason:'Another native owner/workspace/surface retains this private input'});continue;}
   out.copies.push(receipt);
  }catch(error){out.malformed.push({ref,raw,reason:error instanceof Error?error.message:String(error)});}
 }
 return out;
}
export function retainPrivateNativeInput(raw:HeldPrivateNativeInput,previous?:PrivateNativeInputReceipt):PrivateNativeInputReceipt {
 const copy=validatePrivateNativeInput(raw),ref=privateNativeInputRef(copy),held=record(ref);
 if(previous){
  const old=qualifyPrivateNativeInput(previous);
  if(previous.ref!==ref||JSON.stringify({...old,input:null,refusal:null})!==JSON.stringify({...copy,input:null,refusal:null}))throw Error('A retained copy cannot change its captured basis, scope or target; fork it explicitly');
 }else if(held.native_input!==undefined)throw Error('This private copy identity already holds input; its original was retained');
 put(ref,{...held,native_input:copy});
 const acknowledged=readPrivateNativeInput(ref);
 if(!acknowledged||JSON.stringify(acknowledged.copy)!==JSON.stringify(copy))throw Error('The exact private input was not acknowledged; keep the editor open');
 return acknowledged;
}
/** Only this writer's exact still-current copy may leave custody. */
export function clearPrivateNativeInput(receipt:PrivateNativeInputReceipt,writerId:string,current:()=>boolean):boolean {
 if(typeof current!=='function'||!current())return false;
 const copy=qualifyPrivateNativeInput(receipt);if(copy.writer_id!==writerId)return false;
 if(!current())return false;
 const held=record(receipt.ref);delete held.native_input;put(receipt.ref,held);
 if(record(receipt.ref).native_input!==undefined)throw Error('The private input removal was not acknowledged');
 return true;
}
