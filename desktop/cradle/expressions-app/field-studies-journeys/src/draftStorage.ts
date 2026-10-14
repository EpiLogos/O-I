/** lane-3 E18 and E19: the storage shape and the boot decision for drafts.
 *
 * E18. A browser draft is one record per expression. Where a store has no
 * atomic single-key write (the localStorage fallback), the record is a versioned
 * pair (slots `#a` and `#b`): each write goes to the slot that does not hold the
 * newest valid copy and is read back before it is acknowledged, so a torn write
 * leaves a damaged slot and the other slot still holds the previous good copy.
 * IndexedDB puts are already atomic and are written as single keys.
 * Damaged or invalid material is never dropped or adopted: it is kept verbatim
 * under a quarantine key with its reason, read back, and only then removed from
 * the live store.
 *
 * E19. After an unclean exit, a draft that differs from the saved copy of the
 * same expression and is not older than it is offered as a choice with both
 * timestamps: restore the draft, keep the saved version (the draft goes to
 * quarantine), or keep both (the draft becomes a Library copy). Each choice
 * keeps both sides. A clean exit offers nothing.
 * E19 (base). A hosted draft is ordered by the checkpoint revision it was edited FROM, recorded with the draft (DraftBasis), never by a
 * regenerated timestamp. A draft is superseded only when it carries no edits after its base and its base is at or behind the checkpoint,
 * or when the owner kept it. A draft with no recorded base is unknown: it is offered, never quarantined. */
import {Journey,clone,uid,validateJourney} from './model.js';
import {mergeTake,type PropertyTrack} from './propertyTracks.js';
import type {ExpressionRecoveryRequest} from '../../../src/expressions/recoveryTypes';
export const PAIR_SCHEMA='oi.draft-record/v1';
export const QUARANTINE_SCHEMA='oi.draft-quarantine/v1';
/** lane-3 E18: the envelope of one Library document (libraryStore.ts). */
export const LIBRARY_RECORD_SCHEMA='oi.library-record/v1';
/** Asynchronous raw-string store. IndexedDB and localStorage both adapt to it. */
export interface KeyStore{get(key:string):Promise<string|undefined>;put(key:string,raw:string):Promise<void>;delete(key:string):Promise<void>;keys(prefix:string):Promise<string[]>}
/** Integrity digest: two FNV-1a lanes and the length. It detects truncation and corruption; it is not a security hash. */
export function digest(text:string):string{
 let a=0x811c9dc5,b=0x5bd1e995;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,0x01000193);b=Math.imul(b^c,0x5bd1e995);}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+text.length.toString(16);
}
export type SlotReading={state:'absent'}|{state:'damaged';raw:string}|{state:'valid';seq:number;body:string};
/** lane-3 E18: one versioned record shape for every per-document store (drafts and the Library). */
export function readEnvelope(schema:string,raw:string|undefined):SlotReading{
 if(raw===undefined)return {state:'absent'};
 try{const v=JSON.parse(raw) as {schema?:unknown;seq?:unknown;body?:unknown;digest?:unknown};
  if(v&&v.schema===schema&&typeof v.seq==='number'&&Number.isSafeInteger(v.seq)&&v.seq>=1&&typeof v.body==='string'&&v.digest===digest(v.body))return {state:'valid',seq:v.seq,body:v.body};
 }catch{/* not a readable envelope: damaged below */}
 return {state:'damaged',raw};
}
export function readSlot(raw:string|undefined):SlotReading{return readEnvelope(PAIR_SCHEMA,raw);}
export function encodeEnvelope(schema:string,seq:number,body:string):string{return JSON.stringify({schema,seq,digest:digest(body),body});}
export function encodeSlot(seq:number,body:string):string{return encodeEnvelope(PAIR_SCHEMA,seq,body);}
export interface PairReading{
 /** The newest valid body; a pre-pair value at the bare key when no valid slot exists; otherwise undefined. */
 body:string|undefined;seq:number;legacy:boolean;
 /** Every copy that is present, verbatim, whether valid or damaged. A pre-pair value at the bare key is always one of them (T-REVIEW-6). */
 present:{slot:string;raw:string}[];
 /** Slots that are present but unreadable. */
 damaged:{slot:string;raw:string}[];
}
export async function readPair(store:KeyStore,key:string):Promise<PairReading>{
 const slots=[`${key}#a`,`${key}#b`];
 const found=await Promise.all(slots.map(async slot=>({slot,raw:await store.get(slot)})));
 const present=found.flatMap(({slot,raw})=>raw===undefined?[]:[{slot,raw}]);
 const readings=found.map(({slot,raw})=>({slot,reading:readSlot(raw)}));
 const damaged=readings.flatMap(({slot,reading})=>reading.state==='damaged'?[{slot,raw:reading.raw}]:[]);
 const valid=readings.flatMap(({reading})=>reading.state==='valid'?[reading]:[]);
 const legacy=await store.get(key);
 const copies=legacy===undefined?present:[...present,{slot:key,raw:legacy}];
 if(valid.length){const best=valid.reduce((x,y)=>y.seq>x.seq?y:x);return {body:best.body,seq:best.seq,legacy:false,present:copies,damaged};}
 return {body:legacy,seq:0,legacy:legacy!==undefined,present:copies,damaged};
}
/** Write one body as the next version. Every damaged slot is quarantined (by the callback) before it can be overwritten; if that throws, nothing is written.
 * A pre-pair bare value is retired only after the new version reads back, and its verbatim copy is kept first (retireBare). */
export async function writePair(store:KeyStore,key:string,body:string,quarantineDamaged:(slot:string,raw:string)=>Promise<void>,retireBare?:(raw:string)=>Promise<void>):Promise<number>{
 const current=await readPair(store,key);
 for(const {slot,raw} of current.damaged)await quarantineDamaged(slot,raw);
 const seq=current.seq+1,slot=`${key}#${seq%2===1?'a':'b'}`,encoded=encodeSlot(seq,body);
 await store.put(slot,encoded);
 const back=readSlot(await store.get(slot));
 if(back.state!=='valid'||back.seq!==seq||back.body!==body)throw new Error('The draft backup could not be verified. The previous copy is retained.');
 const bare=current.present.find(copy=>copy.slot===key);
 if(bare&&retireBare){await retireBare(bare.raw);await store.delete(key);}
 return seq;
}
/** Remove every slot and any legacy value of one record. */
export async function removePair(store:KeyStore,key:string):Promise<void>{await store.delete(`${key}#a`);await store.delete(`${key}#b`);await store.delete(key);}
export interface QuarantineRecord{id:string;source:string;key:string;reason:string;at:string;raw:string}
function parseQuarantine(id:string,raw:string|undefined):QuarantineRecord|undefined{
 if(raw===undefined)return undefined;
 try{const v=JSON.parse(raw) as Partial<QuarantineRecord>&{schema?:unknown};
  if(v.schema===QUARANTINE_SCHEMA&&typeof v.source==='string'&&typeof v.key==='string'&&typeof v.reason==='string'&&typeof v.at==='string'&&typeof v.raw==='string')return {id,source:v.source,key:v.key,reason:v.reason,at:v.at,raw:v.raw};
 }catch{/* reported as unreadable by listQuarantine */}
 return undefined;
}
/** Keep damaged material verbatim under a quarantine key, read it back, and only then return. The same material reuses its key. */
export async function quarantine(store:KeyStore,source:string,key:string,raw:string,reason:string,at:Date):Promise<string>{
 const id=`${source}|${key}|${digest(raw)}`;
 if(await store.get(id)===undefined)await store.put(id,JSON.stringify({schema:QUARANTINE_SCHEMA,source,key,reason,at:at.toISOString(),raw}));
 const back=parseQuarantine(id,await store.get(id));
 if(!back||back.raw!==raw)throw new Error('The damaged draft could not be kept in quarantine, so it was not removed.');
 return id;
}
/** Every quarantined record with its reason. Entries that cannot be read are listed by id, never hidden. */
export async function listQuarantine(store:KeyStore):Promise<{records:QuarantineRecord[];unreadable:string[]}>{
 const records:QuarantineRecord[]=[],unreadable:string[]=[];
 for(const id of await store.keys('')){const raw=await store.get(id);const parsed=parseQuarantine(id,raw);if(parsed)records.push(parsed);else if(raw!==undefined)unreadable.push(id);}
 return {records,unreadable};
}
/** Where one record family lives. `paired` selects the versioned-pair write (localStorage); IndexedDB keys are atomic and are used directly. */
export interface RecordLayout{store:KeyStore;quarantine:KeyStore;prefix:string;paired:boolean;source:string}
const SLOT_DAMAGE='The record was torn or damaged by an interrupted write. Its verbatim copy is kept here.';
const LEGACY_VALUE='A value from before the versioned record format, superseded by the record that replaces it. Its verbatim copy is kept here.';
const SUPERSEDED='Superseded by a newer draft. It did not validate, so it was never adopted. Its verbatim copy is kept here.';
function acceptable(raw:string,validate:(value:unknown)=>unknown):boolean{try{validate(JSON.parse(raw));return true;}catch{return false;}}
/** Write one record. Damaged slots are quarantined before any overwrite; a record that does not validate is kept verbatim before
 * a newer write replaces it (T-REVIEW-6); a failed read-back throws and keeps the previous copy. */
export async function writeRecord(layout:RecordLayout,key:string,body:string,at:Date,validate?:(value:unknown)=>unknown):Promise<void>{
 const full=layout.prefix+key;
 if(!layout.paired){
  const current=await layout.store.get(full);
  if(current!==undefined&&validate&&!acceptable(current,validate))await quarantine(layout.quarantine,layout.source,full,current,SUPERSEDED,at);
  await layout.store.put(full,body);return;
 }
 if(validate){
  const reading=await readPair(layout.store,full);
  if(reading.body!==undefined&&!acceptable(reading.body,validate))
   for(const copy of reading.present)if(!reading.damaged.some(d=>d.slot===copy.slot))await quarantine(layout.quarantine,layout.source,copy.slot,copy.raw,SUPERSEDED,at);
 }
 await writePair(layout.store,full,body,async(slot,raw)=>{await quarantine(layout.quarantine,layout.source,slot,raw,SLOT_DAMAGE,at);await layout.store.delete(slot);},async raw=>{await quarantine(layout.quarantine,layout.source,full,raw,LEGACY_VALUE,at);});
}
export interface LoadedRecord<T>{value?:T;quarantined:string[];/** Bytes that parse but do not validate: kept in place, reported, never adopted. */rejected?:string}
/** Read and validate one record. Only damaged bytes (unreadable slots, unparseable text) are quarantined. A record that parses but fails validation
 * stays where it is, is reported with its reason, and is never adopted (T-REVIEW-6). */
export async function loadRecord<T>(layout:RecordLayout,key:string,validate:(value:unknown)=>T,at:Date):Promise<LoadedRecord<T>>{
 const full=layout.prefix+key,quarantined:string[]=[];
 const reading:PairReading=layout.paired?await readPair(layout.store,full):{body:await layout.store.get(full),present:[],damaged:[],seq:0,legacy:false};
 for(const {slot,raw} of reading.damaged){await quarantine(layout.quarantine,layout.source,slot,raw,SLOT_DAMAGE,at);await layout.store.delete(slot);quarantined.push(slot);}
 if(reading.body===undefined)return {quarantined};
 let parsed:unknown;
 try{parsed=JSON.parse(reading.body);}
 catch(error){
  const reason=`Unreadable ${layout.source}: ${error instanceof Error?error.message:String(error)}`;
  // Every present copy is kept verbatim, so an older good slot is never lost with the damaged one.
  const copies=layout.paired&&reading.present.length?reading.present:[{slot:full,raw:reading.body}];
  for(const {slot,raw} of copies)await quarantine(layout.quarantine,layout.source,slot,raw,reason,at);
  if(layout.paired)await removePair(layout.store,full);else await layout.store.delete(full);
  return {quarantined:[...quarantined,...copies.map(c=>c.slot)]};
 }
 try{return {value:validate(parsed),quarantined};}
 catch(error){return {quarantined,rejected:error instanceof Error?error.message:String(error)};}
}
/** Load every record under the layout's prefix; the logical key is the id, with pair suffixes folded. Records that do not validate are reported by key. */
export async function loadRecords<T>(layout:RecordLayout,validate:(value:unknown)=>T,at:Date,limit=512):Promise<{values:T[];quarantined:string[];rejected:{key:string;reason:string}[]}>{
 const logical=[...new Set((await layout.store.keys(layout.prefix)).map(k=>k.slice(layout.prefix.length).replace(/#[ab]$/,'')).filter(k=>k.length>0))].slice(0,limit);
 const values:T[]=[],quarantined:string[]=[],rejected:{key:string;reason:string}[]=[];
 for(const key of logical){
  const one=await loadRecord(layout,key,validate,at);
  if(one.value!==undefined)values.push(one.value);
  quarantined.push(...one.quarantined);
  if(one.rejected!==undefined)rejected.push({key,reason:one.rejected});
 }
 return {values,quarantined,rejected};
}
const REMOVED='Removed with its saved copy. It did not validate, so it was never adopted. Its verbatim copy is kept here.';
/** Remove one record. Damaged slots, a pre-pair bare value and, when a validator is given, any copy that does not validate are quarantined
 * first, verbatim, so removal never drops material (T-REVIEW-6). */
export async function removeRecord(layout:RecordLayout,key:string,at:Date,validate?:(value:unknown)=>unknown):Promise<void>{
 const full=layout.prefix+key;
 if(!layout.paired){
  const current=await layout.store.get(full);
  if(current!==undefined&&validate&&!acceptable(current,validate))await quarantine(layout.quarantine,layout.source,full,current,REMOVED,at);
  await layout.store.delete(full);return;
 }
 const reading=await readPair(layout.store,full);
 for(const {slot,raw} of reading.present){
  if(slot===full)await quarantine(layout.quarantine,layout.source,slot,raw,LEGACY_VALUE,at);
  else if(reading.damaged.some(d=>d.slot===slot))await quarantine(layout.quarantine,layout.source,slot,raw,SLOT_DAMAGE,at);
  else if(validate&&!acceptable(recordText(raw),validate))await quarantine(layout.quarantine,layout.source,slot,raw,REMOVED,at);
 }
 await removePair(layout.store,full);
}
// ---- E19 ----
/** Stable text of a Journey's authored material: keys sorted, the top-level timestamp excluded. */
function material(journey:Journey):string{
 const copy=clone(journey) as Partial<Journey>;delete copy.updatedAt;
 return JSON.stringify(copy,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
}
/** E19: what the draft changes against the saved copy, counted per scene. Both sides are kept whichever the owner chooses; this only names the difference. */
export interface RecoveryDiff{scenesAdded:number;scenesRemoved:number;renamed:number;durations:number;transitions:number;contents:number;other:boolean}
/** Stable text of one scene's content: keys sorted; its id, name, duration and transition excluded (each is counted on its own). */
function sceneContentText(scene:Journey['scenes'][number]):string{
 const {id:_id,name:_name,duration:_duration,transition:_transition,...content}=scene;
 return JSON.stringify(content,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
}
export function recoveryDiff(draft:Journey,saved:Journey):RecoveryDiff{
 const before=new Map<string,Journey['scenes'][number]>(saved.scenes.map(scene=>[scene.id,scene]));
 const after=new Set(draft.scenes.map(scene=>scene.id));
 const diff:RecoveryDiff={scenesAdded:0,scenesRemoved:0,renamed:0,durations:0,transitions:0,contents:0,other:false};
 for(const scene of draft.scenes){
  const old=before.get(scene.id);
  if(!old){diff.scenesAdded++;continue;}
  if(old.name!==scene.name)diff.renamed++;
  if(old.duration!==scene.duration)diff.durations++;
  if(old.transition!==scene.transition)diff.transitions++;
  if(sceneContentText(old)!==sceneContentText(scene))diff.contents++;
 }
 diff.scenesRemoved=saved.scenes.filter(scene=>!after.has(scene.id)).length;
 const named=diff.scenesAdded+diff.scenesRemoved+diff.renamed+diff.durations+diff.transitions+diff.contents;
 diff.other=named===0&&material(draft)!==material(saved);
 return diff;
}
/** The diff as lines for the choice dialog and the status line. An empty list means the two are the same material. */
export function recoveryDiffLines(diff:RecoveryDiff):string[]{
 const count=(n:number,noun:string)=>`${n} ${noun}${n===1?'':'s'}`;
 const lines:string[]=[];
 if(diff.scenesAdded)lines.push(`${count(diff.scenesAdded,'scene')} added in the draft`);
 if(diff.scenesRemoved)lines.push(`${count(diff.scenesRemoved,'scene')} removed from the draft`);
 if(diff.durations)lines.push(`Durations changed in ${count(diff.durations,'scene')}`);
 if(diff.transitions)lines.push(`Transitions changed in ${count(diff.transitions,'scene')}`);
 if(diff.contents)lines.push(`Scene contents changed in ${count(diff.contents,'scene')}`);
 if(diff.renamed)lines.push(`${count(diff.renamed,'scene')} renamed`);
 if(diff.other)lines.push('Expression details changed');
 return lines;
}
/** E19 (base): the checkpoint revision a hosted draft was edited FROM, recorded when the draft is written. `edited` is whether the draft
 * carried edits after that revision. `superseded` is the owner's kept state: a choice kept the draft, so it is never offered or adopted again. */
export const DRAFT_BASIS_KEY='draftBasis';
export const DRAFT_BASIS_SCHEMA='oi.draft-basis/v1';
export interface DraftBasis{schema:typeof DRAFT_BASIS_SCHEMA;revision:number;edited:boolean;superseded?:boolean}
/** The basis a draft is written with: the checkpoint revision the frame stood on, and whether the draft differs from that checkpoint's material. */
export function draftBasis(draft:Journey,checkpoint:{revision:number;journey:Journey}):DraftBasis{
 return {schema:DRAFT_BASIS_SCHEMA,revision:checkpoint.revision,edited:material(draft)!==material(checkpoint.journey)};
}
/** The stored draft value: the journey with its basis under one reserved key (absent when no basis is known). The Journey itself never carries it. */
export function draftValue(journey:Journey,basis?:DraftBasis):Record<string,unknown>{
 const value=clone(journey) as unknown as Record<string,unknown>;
 if(basis)value[DRAFT_BASIS_KEY]=basis;
 return value;
}
/** Read a stored draft value: the journey without the reserved key, and the basis when it validates. A basis that does not validate is unknown. */
export function splitDraftValue(value:unknown):{journey:unknown;basis?:DraftBasis}{
 if(!value||typeof value!=='object'||Array.isArray(value))return {journey:value};
 const {[DRAFT_BASIS_KEY]:raw,...journey}=value as Record<string,unknown>;
 const b=raw as Partial<DraftBasis>|undefined;
 if(!b||b.schema!==DRAFT_BASIS_SCHEMA||typeof b.revision!=='number'||!Number.isSafeInteger(b.revision)||b.revision<0||typeof b.edited!=='boolean'||(b.superseded!==undefined&&typeof b.superseded!=='boolean'))return {journey};
 return {journey,basis:{schema:DRAFT_BASIS_SCHEMA,revision:b.revision,edited:b.edited,...(b.superseded?{superseded:true}:{})}};
}
/** E19 (base): a draft is superseded when the owner kept it, or when it carries no edits after its base and its base is at or behind the checkpoint.
 * An unknown basis (undefined) is never superseded. */
export function basisSuperseded(basis:DraftBasis|undefined,checkpointRevision:number):boolean{
 if(!basis)return false;
 if(basis.superseded)return true;
 return !basis.edited&&basis.revision<=checkpointRevision;
}
/** The checkpoint a hosted draft is ordered against: its revision and the draft's own basis. */
export interface CheckpointOrder{revision:number;basis?:DraftBasis}
export type RecoveryOffer={offer:true;draftId:string;draftAt:string;savedAt:string;diff:RecoveryDiff}|{offer:false;reason:string};
/** Offer only after an unclean exit, when the draft differs from the saved copy of the same expression and is strictly newer than it.
 * The content comparison decides whether there is a difference; the order of the two copies only decides whether the draft is newer. */
export function recoveryOffer(input:{draft?:Journey;saved?:Journey;uncleanExit:boolean;checkpoint?:CheckpointOrder}):RecoveryOffer{
 if(!input.uncleanExit)return {offer:false,reason:'The last session closed cleanly.'};
 const {draft,saved,checkpoint}=input;
 if(!draft||!saved)return {offer:false,reason:'There is no draft and saved copy to compare.'};
 if(draft.id!==saved.id)return {offer:false,reason:'The draft and the saved copy are different expressions.'};
 if(material(draft)===material(saved))return {offer:false,reason:'The draft matches the saved copy.'};
 if(checkpoint){
  // E19 (hosted): order by the draft's base revision. The checkpoint's regenerated time is never compared. An unknown base is offered.
  if(basisSuperseded(checkpoint.basis,checkpoint.revision))return {offer:false,reason:'The draft has no edits after its base, and its base is at or behind the saved copy.'};
 }else{
  // Browser only (no kernel): the saved side is the Library record, whose time is a real local time.
  const draftAt=Date.parse(draft.updatedAt),savedAt=Date.parse(saved.updatedAt);
  if(!(draftAt>savedAt))return {offer:false,reason:draftAt<savedAt?'The saved copy is newer than the draft.':'The draft is not newer than the saved copy.'};
 }
 return {offer:true,draftId:draft.id,draftAt:draft.updatedAt,savedAt:saved.updatedAt,diff:recoveryDiff(draft,saved)};
}
/** E19: a draft that differs from the saved copy and is not newer than it. The saved copy is the basis and the draft is superseded:
 * it is never offered and never adopted silently, and the owner keeps it in quarantine, verbatim, so nothing is overwritten. */
export function supersededDraft(input:{draft?:Journey;saved?:Journey;checkpoint?:CheckpointOrder}):boolean{
 const {draft,saved,checkpoint}=input;
 if(!draft||!saved||draft.id!==saved.id)return false;
 if(material(draft)===material(saved))return false;
 if(checkpoint)return basisSuperseded(checkpoint.basis,checkpoint.revision);
 return !(Date.parse(draft.updatedAt)>Date.parse(saved.updatedAt));
}
/** E17 (take): merge an armed take's samples into a copy of the document. The samples are new content, so the copy's time advances with
 * them: a draft that holds merged samples is newer than the saved copy it extends. Returns false when the take's scene is absent. */
export function mergeTakeIntoDraft(draft:Journey,take:{sceneId:string;start:number;elapsed:number;tracks:PropertyTrack[]},at:Date):boolean{
 const scene=draft.scenes.find(s=>s.id===take.sceneId);
 if(!scene)return false;
 const end=Math.min(3600,take.start+take.elapsed);
 scene.propertyTracks=mergeTake(scene.propertyTracks??[],take.tracks,take.start,end);
 scene.propertyTakeRange={start:take.start,end};
 scene.duration=Math.max(scene.duration,end);
 draft.updatedAt=at.toISOString();
 return true;
}
export type RecoveryChoice='restore-draft'|'keep-saved'|'keep-both';
export interface RecoveryPlan{open:Journey;copy?:Journey;quarantineDraft:boolean;removeDraft:boolean;/** The reason the quarantined draft is listed under; a default names the unclean exit. */quarantineReason?:string}
/** A Library copy with a new identity: the source's full material, and a name that says where it came from and when. */
function namedCopy(source:Journey,at:Date,label:string):Journey{
 const copy=clone(source);copy.id=uid('expression');
 const hh=String(at.getHours()).padStart(2,'0'),mm=String(at.getMinutes()).padStart(2,'0');
 const suffix=` · ${label} ${hh}:${mm}`;
 copy.name=(source.name.length+suffix.length>160?source.name.slice(0,160-suffix.length):source.name)+suffix;
 return validateJourney(copy);
}
/** The Library copy a kept draft becomes: a new identity, the draft's full material, and a name that says where it came from. */
export function draftCopy(draft:Journey,at:Date):Journey{return namedCopy(draft,at,'recovered draft');}
/** The Library copy the saved version becomes when the draft is restored: the saved side is kept before the draft replaces it (T-REVIEW-6). */
export function savedBeforeRecoveryCopy(saved:Journey,at:Date):Journey{return namedCopy(saved,at,'saved before recovery');}
/** What a choice does. Every side is kept: the draft is restored (the saved copy first preserved as a Library copy), moved to quarantine, or copied into the Library. */
export function planRecoveryChoice(choice:RecoveryChoice,draft:Journey,saved:Journey,at:Date):RecoveryPlan{
 if(choice==='restore-draft')return {open:clone(draft),copy:savedBeforeRecoveryCopy(saved,at),quarantineDraft:false,removeDraft:false};
 if(choice==='keep-saved')return {open:clone(saved),quarantineDraft:true,removeDraft:true};
 return {open:clone(saved),copy:draftCopy(draft,at),quarantineDraft:false,removeDraft:true};
}
/** The record's own text: a kept slot envelope is unwrapped, anything else is taken as it is. */
function recordText(raw:string):string{for(const schema of [PAIR_SCHEMA,LIBRARY_RECORD_SCHEMA]){const slot=readEnvelope(schema,raw);if(slot.state==='valid')return slot.body;}return raw;}
/** A quarantined draft as a Library copy. It must validate now; otherwise the refusal names the reason and nothing is made (T-REVIEW-6). */
export function quarantinedCopy(raw:string,at:Date):Journey{
 let journey:Journey;
 try{journey=validateJourney(splitDraftValue(JSON.parse(recordText(raw))).journey);}
 catch(error){throw new Error(`This quarantined draft cannot be restored: ${error instanceof Error?error.message:String(error)}`);}
 return namedCopy(journey,at,'restored draft');
}
/** The name a quarantined draft is listed under; a record that cannot be read is listed by its key. */
export function quarantinedName(raw:string,fallback:string):string{
 try{const value=JSON.parse(recordText(raw)) as {name?:unknown};return typeof value.name==='string'&&value.name.trim()?value.name:fallback;}
 catch{return fallback;}
}
/** E19 (hosted): what a native draft becomes against its checkpoint, the saved basis. The owners are injected by nativeWorkspace, so every
 * branch is testable. `draft` means the draft is adopted as found; `checkpoint` means the saved basis is adopted. `kept` is the notice the
 * frame shows when the draft was kept aside. `unkept` names a draft that could not be kept in any place: its native row is held, and the
 * frame never writes an edit over it. The open proceeds on the checkpoint in every case. */
export type HostedDraftSettlement={kind:'draft'}|{kind:'checkpoint';journey:Journey;kept?:string;unkept?:string};
/** The native draft row as found: its journey, its recorded basis (absent when unknown), and its verbatim text. */
export interface HostedDraftRow{journey:Journey;basis?:DraftBasis;text:string}
/** Where a kept draft now lives, always with its verbatim text read back. `owner`: the native owner's quarantine holds it. `browser`: the owner did
 * not keep it (`refusal` says why) and this browser's quarantine holds it. `note` names a Library copy that could not be written, which never
 * stops the keep: the verbatim copy is kept. */
export type KeptPlace={place:'owner';note?:string}|{place:'browser';refusal:string;note?:string};
export interface HostedDraftOwners{
 /** The hosted recovery store is in use. */
 hosted:boolean;
 /** This boot's own reading of the session mark. */
 uncleanBoot:boolean;
 /** Drafts already settled in this session; a settled draft is never offered again. */
 settled:Set<string>;
 /** The kernel revision of the checkpoint, named in the choice. */
 revision:number;
 chooseRecovery?:(request:{draft:Journey;saved:Journey;offer:{draftAt:string;savedAt:string};revision:number})=>Promise<RecoveryChoice>;
 /** Stops adoption when another open superseded this one. */
 requireAdoption:()=>void;
 /** Keeps the draft's verbatim native text: first in the owner's quarantine for its Expression, and when the owner does not keep it, in this
  * browser's quarantine. Resolves with where it is kept. Rejects only when neither place kept it; the native row is never removed. */
 keepDraft:(plan:RecoveryPlan,draft:Journey,text:string)=>Promise<KeptPlace>;
 /** Marks the native row kept by a choice. The row stays, so every later open keeps it again and never offers or adopts it. */
 markDraftKept:(draft:Journey,basis:DraftBasis|undefined)=>Promise<void>;
}
/** The notice a kept draft shows in the frame's status line: what happened, and where the kept copy is. */
export function quarantineNotice(reason:'superseded'|'chosen',hosted:boolean):string{
 const what=reason==='superseded'?'An older draft of this Expression was kept aside (not opened); the saved version opened.':'The draft was kept aside (not opened); the saved version opened.';
 return `${what} ${hosted?"The verbatim copy is in this Expression's quarantine in the native owner, and its draft record is kept too.":'A verbatim copy is in the Library quarantine of this browser.'}`;
}
// ---- E19 (owner quarantine): the native owner keeps each superseded draft of an Expression, verbatim, before the native row is marked kept.
// The owner's quarantine is one record per Expression (kernel expression_recovery.rs, kind draft_quarantine). Its operations travel the
// same channel as every recovery request; the transport is injected so the rules here are testable without the desktop host.
/** One request to the owner's recovery channel. The reply is the owner's answer; each reader checks its shape. */
export type QuarantineTransport=(request:ExpressionRecoveryRequest)=>Promise<unknown>;
export interface OwnerQuarantineEntry{id:string;draft_id:string;reason:string;kept_at_unix_ms:number;text:string}
/** `unreadable` names why the owner cannot read this Expression's kept drafts. Nothing is listed, removed or overwritten then. */
export interface OwnerQuarantineReading{revision:number|null;entries:OwnerQuarantineEntry[];unreadable?:string}
/** The owner's quarantine for this Expression holds its entry limit. Nothing was kept, removed or overwritten; the draft row stays as it is. */
export class OwnerQuarantineFullError extends Error{
 readonly limit:number;
 constructor(limit:number){super(`This Expression's kept drafts are full (${limit}).`);this.name='OwnerQuarantineFullError';this.limit=limit;}
}
export type OverSizeReason='record_bytes'|'scope_bytes'|'scope_records';
/** A kept draft would exceed a byte bound (or the record limit) of the owner's store. Nothing was kept, removed or overwritten. */
export class OwnerQuarantineOverSizeError extends Error{
 readonly reason:OverSizeReason;readonly limit:number;readonly kept:number;
 constructor(reason:OverSizeReason,limit:number,kept:number){super(`The owner refused to keep the draft: ${reason==='scope_records'?'the record limit is reached':'its size limit is reached'}.`);this.name='OwnerQuarantineOverSizeError';this.reason=reason;this.limit=limit;this.kept=kept;}
}
/** The owner holds kept drafts it cannot read. Nothing was kept, removed or overwritten; its bytes stay where they are. */
export class OwnerQuarantineUnreadableError extends Error{
 constructor(detail:string){super(`The native owner cannot read the kept drafts of this Expression. ${detail}`);this.name='OwnerQuarantineUnreadableError';}
}
/** The refusal of the owner, named for the person: what the owner refused and how its space is freed. Any other failure is named by its message. */
export function ownerRefusalText(error:unknown):string{
 if(error instanceof OwnerQuarantineFullError)return `The kept drafts of this Expression are full (${error.limit}). Remove a kept draft in the Library's kept drafts list to free a slot.`;
 if(error instanceof OwnerQuarantineOverSizeError){
  if(error.kept===0)return 'This draft is too large for the native owner to keep on its own.';
  return `The kept drafts of this Expression ${error.reason==='scope_records'?'are at their record limit':'are over their size limit'}. Remove a kept draft in the Library's kept drafts list to free space.`;
 }
 if(error instanceof OwnerQuarantineUnreadableError)return "The native owner could not read this Expression's kept drafts, so nothing was removed or overwritten.";
 return `The native owner did not keep the draft (${error instanceof Error?error.message:String(error)}).`;
}
/** The notice when this browser's quarantine holds a draft the owner did not keep: what happened, why the owner did not keep it, and where the verbatim copy is. */
export function browserKeptNotice(kind:'superseded'|'set-aside'|'copied',refusal:string):string{
 const what=kind==='superseded'?'An older draft of this Expression was kept aside (not opened); the saved version opened.':kind==='set-aside'?'The draft was kept aside (not opened); the saved version opened.':'The draft was copied to the Library (not opened); the saved version opened.';
 return `${what} ${refusal} Its verbatim copy is in this browser's Library quarantine.`;
}
/** The notice when a draft could not be kept in any place: it stays as it is, and no edit is written over it until a kept slot is freed. */
export function heldDraftNotice(name:string,cause:unknown):string{
 return `The draft "${name}" could not be kept, so it stays as it is and the saved version opened. Your edits will not replace it until a kept slot is freed and this Expression is opened again. ${cause instanceof Error?cause.message:String(cause)}`;
}
/** The authored material of a kept draft's verbatim text: its keys sorted, without the top-level timestamp and the reserved basis key.
 * The same draft kept again (its superseded flag set) has the same material, so it is one copy. */
export function draftMaterialKey(text:string):string{
 const value=JSON.parse(text) as Record<string,unknown>;delete value.updatedAt;delete value[DRAFT_BASIS_KEY];
 return JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item as Record<string,unknown>).sort().map(k=>[k,(item as Record<string,unknown>)[k]])):item);
}
/** The owner's quarantine for one Expression: its revision (null when none is kept yet) and every kept copy. A reading that does not validate throws;
 * a reading the owner names as unreadable is returned with `unreadable`, so the listing can say so and still open. */
export async function readOwnerQuarantine(send:QuarantineTransport,expressionRef:string,scope:'expressions'|'techne'):Promise<OwnerQuarantineReading>{
 const reply=await send({operation:'read',scope,kind:'draft_quarantine',id:expressionRef}) as {state?:unknown;detail?:unknown;record?:{revision?:unknown;value?:{entries?:unknown}}|null}|undefined;
 if(reply?.state==='quarantine_unreadable')return {revision:null,entries:[],unreadable:typeof reply.detail==='string'&&reply.detail?reply.detail:'The stored kept drafts cannot be read.'};
 if(reply?.state!=='ready')throw new Error('The native owner returned an invalid quarantine reading.');
 if(!reply.record)return {revision:null,entries:[]};
 const {revision}=reply.record,entries=reply.record.value?.entries;
 if(typeof revision!=='number'||!Array.isArray(entries))throw new Error('The native owner returned a quarantine record without its revision or entries.');
 return {revision,entries:entries.map(entry=>{
  const e=entry as Partial<OwnerQuarantineEntry>;
  if(typeof e.id!=='string'||typeof e.draft_id!=='string'||typeof e.reason!=='string'||typeof e.kept_at_unix_ms!=='number'||typeof e.text!=='string')throw new Error('The native owner holds a kept draft that does not validate.');
  return e as OwnerQuarantineEntry;
 })};
}
type KeepReply={state?:unknown;kept?:unknown;entry_id?:unknown;limit?:unknown;reason?:unknown;detail?:unknown};
/** Keep one draft's verbatim native text in the owner's quarantine. The owner's quarantine is read back BEFORE the caller does anything
 * else: a copy that is not there, or differs, throws and the draft stays held. Every named refusal throws its own error and keeps nothing:
 * a full quarantine (OwnerQuarantineFullError), a byte bound (OwnerQuarantineOverSizeError) and an unreadable quarantine
 * (OwnerQuarantineUnreadableError). A revision that moves between the reading and the keep is read again once, then named. The same material is kept once. */
export async function keepOwnerQuarantine(send:QuarantineTransport,kept:{expressionRef:string;scope:'expressions'|'techne';draftId:string;reason:string;text:string}):Promise<{entryId:string;kept:boolean}>{
 let reply:KeepReply|undefined;
 for(let attempt=1;;attempt++){
  const before=await readOwnerQuarantine(send,kept.expressionRef,kept.scope);
  if(before.unreadable!==undefined)throw new OwnerQuarantineUnreadableError(before.unreadable);
  reply=await send({operation:'keep_draft_quarantine',scope:kept.scope,expression_ref:kept.expressionRef,draft_id:kept.draftId,reason:kept.reason,text:kept.text,expected_revision:before.revision}) as KeepReply|undefined;
  if(reply?.state!=='revision_conflict')break;
  if(attempt===2)throw new Error('The owner quarantine of this Expression changed twice while the draft was being kept. Nothing was kept or removed.');
 }
 const answer=reply;
 if(answer?.state==='quarantine_full'){if(typeof answer.limit!=='number')throw new Error('The native owner named a full quarantine without its limit.');throw new OwnerQuarantineFullError(answer.limit);}
 if(answer?.state==='quarantine_over_size'){
  const {reason,limit}=answer,kept_count=answer.kept;
  if((reason!=='record_bytes'&&reason!=='scope_bytes'&&reason!=='scope_records')||typeof limit!=='number'||typeof kept_count!=='number')throw new Error('The native owner named an over-size quarantine without its bound.');
  throw new OwnerQuarantineOverSizeError(reason,limit,kept_count);
 }
 if(answer?.state==='quarantine_unreadable')throw new OwnerQuarantineUnreadableError(typeof answer.detail==='string'?answer.detail:'The stored kept drafts cannot be read.');
 if(answer?.state!=='quarantine_kept'||typeof answer.entry_id!=='string'||typeof answer.kept!=='boolean')throw new Error('The native owner did not acknowledge the kept draft. The draft stays held.');
 const entryId=answer.entry_id,wasKept=answer.kept;
 const after=await readOwnerQuarantine(send,kept.expressionRef,kept.scope);
 if(after.unreadable!==undefined)throw new OwnerQuarantineUnreadableError(after.unreadable);
 const entry=after.entries.find(row=>row.id===entryId);
 if(!entry)throw new Error('The kept draft is not in the native owner quarantine after keeping. The draft stays held.');
 const same=wasKept?entry.text===kept.text:draftMaterialKey(entry.text)===draftMaterialKey(kept.text);
 if(!same)throw new Error('The kept draft in the native owner quarantine differs from the draft. The draft stays held.');
 return {entryId,kept:wasKept};
}
/** Remove one kept draft by its entry identity. Only an explicit request calls this; no draft write, save or open does. The owner's current
 * revision is read at the call, so a listing taken earlier is never the basis of a removal. Entry identities are content digests, so the same
 * entry is removed whatever revision it was listed at. A revision that moves between that read and the remove is refused by name, and
 * nothing is removed. Returns the entries that remain. */
export async function removeOwnerQuarantineEntry(send:QuarantineTransport,expressionRef:string,scope:'expressions'|'techne',entryId:string):Promise<number>{
 const before=await readOwnerQuarantine(send,expressionRef,scope);
 if(before.unreadable!==undefined)throw new OwnerQuarantineUnreadableError(before.unreadable);
 if(before.revision===null)throw new Error('No kept drafts are quarantined for this Expression. Nothing was removed.');
 const reply=await send({operation:'remove_draft_quarantine',scope,expression_ref:expressionRef,entry_id:entryId,expected_revision:before.revision}) as {state?:unknown;remaining?:unknown;detail?:unknown}|undefined;
 if(reply?.state==='revision_conflict')throw new Error('The kept drafts of this Expression changed while they were being removed. Nothing was removed; read the list again and choose.');
 if(reply?.state==='quarantine_unreadable')throw new OwnerQuarantineUnreadableError(typeof reply.detail==='string'?reply.detail:'The stored kept drafts cannot be read.');
 if(reply?.state!=='quarantine_entry_removed'||typeof reply.remaining!=='number')throw new Error('The native owner did not remove the kept draft. Nothing was removed.');
 return reply.remaining;
}
/** The rows the owner's kept drafts are listed by: the draft's name, the owner's reason, the owner's time of keeping and the draft id. */
export function ownerQuarantineRows(entries:OwnerQuarantineEntry[],now:Date=new Date()):{id:string;name:string;reason:string;when:string;draftId:string}[]{
 return entries.map(entry=>({id:entry.id,name:quarantinedName(entry.text,entry.draft_id),reason:entry.reason,when:offerClock(new Date(entry.kept_at_unix_ms).toISOString(),now),draftId:entry.draft_id}));
}
/** The notice a kept draft shows: the owner's quarantine, or this browser's when the owner did not keep it. A Library copy's failure is named as a note. */
function keptNotice(kind:'superseded'|'set-aside'|'copied',place:KeptPlace):string|undefined{
 const note=place.note?` ${place.note}`:'';
 if(place.place==='browser')return browserKeptNotice(kind,place.refusal)+note;
 if(kind==='copied')return place.note;
 return quarantineNotice(kind==='superseded'?'superseded':'chosen',true)+note;
}
/** A draft that is not newer than its checkpoint is never adopted, after a clean or an unclean exit. It is kept verbatim before the saved
 * copy opens. Keeping never stops the open: when no place keeps the draft, the draft is held and named, the checkpoint opens, and the frame
 * writes no edit over the held row. A newer draft is offered on an unclean exit, and the owner's choice keeps both sides. The native row is
 * never removed: a choice marks it kept. Order is by the draft's base revision, not by any regenerated time. */
export async function settleHostedDraft(draftId:string,row:HostedDraftRow,saved:Journey|undefined,owners:HostedDraftOwners):Promise<HostedDraftSettlement>{
 const {journey:draft,basis,text}=row;
 if(!owners.hosted||!saved||owners.settled.has(draftId))return {kind:'draft'};
 const checkpoint:CheckpointOrder={revision:owners.revision,basis};
 const held=(cause:unknown):HostedDraftSettlement=>{const notice=heldDraftNotice(draft.name,cause);return {kind:'checkpoint',journey:saved,kept:notice,unkept:notice};};
 if(supersededDraft({draft,saved,checkpoint})){
  let place:KeptPlace;
  try{place=await owners.keepDraft({open:saved,quarantineDraft:true,removeDraft:false,quarantineReason:'No edits after its base, and its base is at or behind the saved copy, so the saved copy was opened. The draft is kept here verbatim.'},draft,text);}
  catch(error){owners.requireAdoption();return held(error);}
  owners.requireAdoption();
  owners.settled.add(draftId);
  return {kind:'checkpoint',journey:saved,kept:keptNotice('superseded',place)};
 }
 if(!owners.uncleanBoot)return {kind:'draft'};
 const offer=recoveryOffer({draft,saved,uncleanExit:true,checkpoint});
 if(!offer.offer)return {kind:'draft'};
 const choice:RecoveryChoice=owners.chooseRecovery?await owners.chooseRecovery({draft,saved,offer,revision:owners.revision}):'keep-both';
 owners.requireAdoption();
 if(choice==='restore-draft'){owners.settled.add(draftId);return {kind:'draft'};}
 const plan=planRecoveryChoice(choice,draft,saved,new Date());
 let place:KeptPlace;
 try{place=await owners.keepDraft({...plan,removeDraft:false},draft,text);}
 catch(error){return held(error);}
 owners.requireAdoption();
 const mark=await owners.markDraftKept(draft,basis).then(()=>undefined,(error:unknown)=>`The draft's native row could not be marked kept (${error instanceof Error?error.message:String(error)}); it will be offered again on the next unclean open, and its copy is kept.`);
 owners.settled.add(draftId);
 const notice=[keptNotice(choice==='keep-saved'?'set-aside':'copied',place),mark].filter((part):part is string=>!!part).join(' ');
 return {kind:'checkpoint',journey:saved,...(notice?{kept:notice}:{})};
}
export const SESSION_MARK_KEY='oi.field-studies.session.v1';
export const TAB_INSTANCE_KEY='oi.field-studies.tab.v1';
export interface SessionMarkStore{getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem?(key:string):void}
function browserTabStore():SessionMarkStore|undefined{try{return (globalThis as {sessionStorage?:SessionMarkStore}).sessionStorage;}catch{return undefined;}}
/** lane-3 E19b: one session mark per browser tab. The tab's id lives in its own sessionStorage: a reload of this tab keeps it,
 * and no other tab reads it. Where no tab store exists, every page shares one fixed id (the earlier origin-wide behaviour). */
export function tabInstance(tabStore:SessionMarkStore|undefined=browserTabStore()):string{
 try{
  const known=tabStore?.getItem(TAB_INSTANCE_KEY);
  if(known&&/^[A-Za-z0-9-]{8,64}$/.test(known))return known;
  if(!tabStore)return 'shared';
  const fresh=globalThis.crypto?.randomUUID?.()??`t${Date.now().toString(36)}${Math.random().toString(36).slice(2,12)}`;
  tabStore.setItem(TAB_INSTANCE_KEY,fresh);
  return fresh;
 }catch{return 'shared';}
}
const sessionMarkKey=(instance:string)=>`${SESSION_MARK_KEY}.${instance}`;
function markIsUnclean(raw:string):boolean{try{return (JSON.parse(raw) as {state?:unknown}).state!=='closed';}catch{return true;}}
/** True when this tab's previous page never reached its quit flush. A marker that cannot be read counts as unclean.
 * Another tab's mark is never read: a tab with no mark of its own is clean, except for one origin-wide mark left by an
 * earlier build, which the first tab to boot adopts (markSessionOpen retires it). */
export function readUncleanExit(store:SessionMarkStore,instance:string=tabInstance()):boolean{
 const own=store.getItem(sessionMarkKey(instance));
 if(own!==null)return markIsUnclean(own);
 const legacy=store.getItem(SESSION_MARK_KEY);
 return legacy!==null&&markIsUnclean(legacy);
}
export function markSessionOpen(store:SessionMarkStore,at:Date,instance:string=tabInstance()):void{
 store.setItem(sessionMarkKey(instance),JSON.stringify({state:'open',at:at.toISOString()}));
 // The earlier origin-wide mark is retired as soon as a tab owns its own, so no later tab adopts it.
 if(store.getItem(SESSION_MARK_KEY)!==null)store.setItem(SESSION_MARK_KEY,JSON.stringify({state:'closed',at:at.toISOString()}));
}
/** A clean exit removes this tab's mark, so closed tabs leave nothing behind. A store without removal keeps an explicit closed mark. */
export function markSessionClosed(store:SessionMarkStore,at:Date,instance:string=tabInstance()):void{
 if(store.removeItem)store.removeItem(sessionMarkKey(instance));
 else store.setItem(sessionMarkKey(instance),JSON.stringify({state:'closed',at:at.toISOString()}));
}
// lane-3 E19b: the boot's own reading of the session mark, taken before this page marks itself open. A hosted open
// after an unclean boot may offer the recovery choice; a clean boot never does.
let bootUnclean=false;
export function recordBootExit(unclean:boolean):void{bootUnclean=unclean;}
export function bootWasUnclean():boolean{return bootUnclean;}
/** Clock text for the offer: local hh:mm:ss, with the date when it is not today. */
export function offerClock(iso:string,now:Date):string{
 const at=new Date(iso);if(Number.isNaN(at.getTime()))return 'unknown time';
 const hms=`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}:${String(at.getSeconds()).padStart(2,'0')}`;
 if(at.toDateString()===now.toDateString())return hms;
 return `${at.getFullYear()}-${String(at.getMonth()+1).padStart(2,'0')}-${String(at.getDate()).padStart(2,'0')} ${hms}`;
}
