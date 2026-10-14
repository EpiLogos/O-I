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
 * keeps both sides. A clean exit offers nothing. */
import {Journey,clone,uid,validateJourney} from './model.js';
import {mergeTake,type PropertyTrack} from './propertyTracks.js';
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
export type RecoveryOffer={offer:true;draftId:string;draftAt:string;savedAt:string;diff:RecoveryDiff}|{offer:false;reason:string};
/** Offer only after an unclean exit, when the draft differs from the saved copy of the same expression and is strictly newer than it.
 * The content comparison decides whether there is a difference; the order of the two copies only decides whether the draft is newer. */
export function recoveryOffer(input:{draft?:Journey;saved?:Journey;uncleanExit:boolean}):RecoveryOffer{
 if(!input.uncleanExit)return {offer:false,reason:'The last session closed cleanly.'};
 const {draft,saved}=input;
 if(!draft||!saved)return {offer:false,reason:'There is no draft and saved copy to compare.'};
 if(draft.id!==saved.id)return {offer:false,reason:'The draft and the saved copy are different expressions.'};
 if(material(draft)===material(saved))return {offer:false,reason:'The draft matches the saved copy.'};
 const draftAt=Date.parse(draft.updatedAt),savedAt=Date.parse(saved.updatedAt);
 if(!(draftAt>savedAt))return {offer:false,reason:draftAt<savedAt?'The saved copy is newer than the draft.':'The draft is not newer than the saved copy.'};
 return {offer:true,draftId:draft.id,draftAt:draft.updatedAt,savedAt:saved.updatedAt,diff:recoveryDiff(draft,saved)};
}
/** E19: a draft that differs from the saved copy and is not newer than it. The saved copy is the basis and the draft is superseded:
 * it is never offered and never adopted silently, and the owner keeps it in quarantine, verbatim, so nothing is overwritten. */
export function supersededDraft(input:{draft?:Journey;saved?:Journey}):boolean{
 const {draft,saved}=input;
 if(!draft||!saved||draft.id!==saved.id)return false;
 if(material(draft)===material(saved))return false;
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
 try{journey=validateJourney(JSON.parse(recordText(raw)));}
 catch(error){throw new Error(`This quarantined draft cannot be restored: ${error instanceof Error?error.message:String(error)}`);}
 return namedCopy(journey,at,'restored draft');
}
/** The name a quarantined draft is listed under; a record that cannot be read is listed by its key. */
export function quarantinedName(raw:string,fallback:string):string{
 try{const value=JSON.parse(recordText(raw)) as {name?:unknown};return typeof value.name==='string'&&value.name.trim()?value.name:fallback;}
 catch{return fallback;}
}
/** E19 (hosted): what a native draft becomes against its checkpoint, the saved basis. The owners are injected by nativeWorkspace, so every
 * branch is testable. `draft` means the draft is adopted as found; `checkpoint` means the saved basis is adopted and the draft has left the owner. */
export type HostedDraftSettlement={kind:'draft'}|{kind:'checkpoint';journey:Journey};
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
 /** Keeps the draft verbatim (quarantine), then removes its local copy as the plan says. Rejects when the draft cannot be kept. */
 keepDraft:(plan:RecoveryPlan,draft:Journey)=>Promise<void>;
 /** Removes the native draft row, with its scope. */
 removeNativeDraft:()=>Promise<void>;
}
/** A draft that is not newer than its checkpoint is never adopted, after a clean or an unclean exit. It is kept verbatim in quarantine
 * before its native copy leaves, and a failure to keep it holds the draft and names it: nothing is removed or adopted. A newer draft is
 * offered on an unclean exit exactly as before, and the owner's choice keeps both sides. */
export async function settleHostedDraft(draftId:string,draft:Journey,saved:Journey|undefined,owners:HostedDraftOwners):Promise<HostedDraftSettlement>{
 if(!owners.hosted||!saved||owners.settled.has(draftId))return {kind:'draft'};
 if(supersededDraft({draft,saved})){
  try{await owners.keepDraft({open:saved,quarantineDraft:true,removeDraft:true,quarantineReason:'Not newer than the saved copy, so the saved copy was opened. The draft is kept here verbatim.'},draft);}
  catch(error){throw new Error(`The draft "${draft.name}" could not be kept in quarantine, so it was neither removed nor opened. It stays held for the next open. ${error instanceof Error?error.message:String(error)}`);}
  owners.requireAdoption();
  await owners.removeNativeDraft();
  owners.settled.add(draftId);
  return {kind:'checkpoint',journey:saved};
 }
 if(!owners.uncleanBoot)return {kind:'draft'};
 const offer=recoveryOffer({draft,saved,uncleanExit:true});
 if(!offer.offer)return {kind:'draft'};
 const choice:RecoveryChoice=owners.chooseRecovery?await owners.chooseRecovery({draft,saved,offer,revision:owners.revision}):'keep-both';
 owners.requireAdoption();
 if(choice==='restore-draft'){owners.settled.add(draftId);return {kind:'draft'};}
 const plan=planRecoveryChoice(choice,draft,saved,new Date());
 await owners.keepDraft(plan,draft);
 owners.requireAdoption();
 if(plan.removeDraft)await owners.removeNativeDraft();
 owners.settled.add(draftId);
 return {kind:'checkpoint',journey:saved};
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
