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
export const PAIR_SCHEMA='oi.draft-record/v1';
export const QUARANTINE_SCHEMA='oi.draft-quarantine/v1';
/** Asynchronous raw-string store. IndexedDB and localStorage both adapt to it. */
export interface KeyStore{get(key:string):Promise<string|undefined>;put(key:string,raw:string):Promise<void>;delete(key:string):Promise<void>;keys(prefix:string):Promise<string[]>}
/** Integrity digest: two FNV-1a lanes and the length. It detects truncation and corruption; it is not a security hash. */
export function digest(text:string):string{
 let a=0x811c9dc5,b=0x5bd1e995;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,0x01000193);b=Math.imul(b^c,0x5bd1e995);}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+text.length.toString(16);
}
export type SlotReading={state:'absent'}|{state:'damaged';raw:string}|{state:'valid';seq:number;body:string};
export function readSlot(raw:string|undefined):SlotReading{
 if(raw===undefined)return {state:'absent'};
 try{const v=JSON.parse(raw) as {schema?:unknown;seq?:unknown;body?:unknown;digest?:unknown};
  if(v&&v.schema===PAIR_SCHEMA&&typeof v.seq==='number'&&Number.isSafeInteger(v.seq)&&v.seq>=1&&typeof v.body==='string'&&v.digest===digest(v.body))return {state:'valid',seq:v.seq,body:v.body};
 }catch{/* not a readable envelope: damaged below */}
 return {state:'damaged',raw};
}
export function encodeSlot(seq:number,body:string):string{return JSON.stringify({schema:PAIR_SCHEMA,seq,digest:digest(body),body});}
export interface PairReading{
 /** The newest valid body; a pre-pair value at the bare key when no valid slot exists; otherwise undefined. */
 body:string|undefined;seq:number;legacy:boolean;
 /** Every copy that is present, verbatim, whether valid or damaged. */
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
 if(valid.length){const best=valid.reduce((x,y)=>y.seq>x.seq?y:x);return {body:best.body,seq:best.seq,legacy:false,present,damaged};}
 const legacy=await store.get(key);
 return {body:legacy,seq:0,legacy:legacy!==undefined,present:legacy===undefined?present:[...present,{slot:key,raw:legacy}],damaged};
}
/** Write one body as the next version. Every damaged slot is quarantined (by the callback) before it can be overwritten; if that throws, nothing is written. */
export async function writePair(store:KeyStore,key:string,body:string,quarantineDamaged:(slot:string,raw:string)=>Promise<void>):Promise<number>{
 const current=await readPair(store,key);
 for(const {slot,raw} of current.damaged)await quarantineDamaged(slot,raw);
 const seq=current.seq+1,slot=`${key}#${seq%2===1?'a':'b'}`,encoded=encodeSlot(seq,body);
 await store.put(slot,encoded);
 const back=readSlot(await store.get(slot));
 if(back.state!=='valid'||back.seq!==seq||back.body!==body)throw new Error('The draft backup could not be verified. The previous copy is retained.');
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
/** Write one record. Damaged slots are quarantined before any overwrite; a failed read-back throws and keeps the previous copy. */
export async function writeRecord(layout:RecordLayout,key:string,body:string,at:Date):Promise<void>{
 const full=layout.prefix+key;
 if(!layout.paired){await layout.store.put(full,body);return;}
 await writePair(layout.store,full,body,async(slot,raw)=>{await quarantine(layout.quarantine,layout.source,slot,raw,SLOT_DAMAGE,at);await layout.store.delete(slot);});
}
export interface LoadedRecord<T>{value?:T;quarantined:string[]}
/** Read and validate one record. Damaged slots and records that fail validation are quarantined, never adopted and never silently dropped. */
export async function loadRecord<T>(layout:RecordLayout,key:string,validate:(value:unknown)=>T,at:Date):Promise<LoadedRecord<T>>{
 const full=layout.prefix+key,quarantined:string[]=[];
 const reading:PairReading=layout.paired?await readPair(layout.store,full):{body:await layout.store.get(full),present:[],damaged:[],seq:0,legacy:false};
 for(const {slot,raw} of reading.damaged){await quarantine(layout.quarantine,layout.source,slot,raw,SLOT_DAMAGE,at);await layout.store.delete(slot);quarantined.push(slot);}
 if(reading.body===undefined)return {quarantined};
 let value:T;
 try{value=validate(JSON.parse(reading.body));}
 catch(error){
  const reason=`Unreadable ${layout.source}: ${error instanceof Error?error.message:String(error)}`;
  // Every present copy is kept verbatim, so an older good slot is never lost with the bad one.
  const copies=layout.paired&&reading.present.length?reading.present:[{slot:full,raw:reading.body}];
  for(const {slot,raw} of copies)await quarantine(layout.quarantine,layout.source,slot,raw,reason,at);
  if(layout.paired)await removePair(layout.store,full);else await layout.store.delete(full);
  return {quarantined:[...quarantined,...copies.map(c=>c.slot)]};
 }
 return {value,quarantined};
}
/** Load every record under the layout's prefix; the logical key is the id, with pair suffixes folded. */
export async function loadRecords<T>(layout:RecordLayout,validate:(value:unknown)=>T,at:Date,limit=512):Promise<{values:T[];quarantined:string[]}>{
 const logical=[...new Set((await layout.store.keys(layout.prefix)).map(k=>k.slice(layout.prefix.length).replace(/#[ab]$/,'')).filter(k=>k.length>0))].slice(0,limit);
 const values:T[]=[],quarantined:string[]=[];
 for(const key of logical){const one=await loadRecord(layout,key,validate,at);if(one.value!==undefined)values.push(one.value);quarantined.push(...one.quarantined);}
 return {values,quarantined};
}
/** Remove one record. Damaged slots are quarantined first, so removal never drops material. */
export async function removeRecord(layout:RecordLayout,key:string,at:Date):Promise<void>{
 const full=layout.prefix+key;
 if(!layout.paired){await layout.store.delete(full);return;}
 const reading=await readPair(layout.store,full);
 for(const {slot,raw} of reading.damaged)await quarantine(layout.quarantine,layout.source,slot,raw,SLOT_DAMAGE,at);
 await removePair(layout.store,full);
}
// ---- E19 ----
/** Stable text of a Journey's authored material: keys sorted, the top-level timestamp excluded. */
function material(journey:Journey):string{
 const copy=clone(journey) as Partial<Journey>;delete copy.updatedAt;
 return JSON.stringify(copy,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
}
export type RecoveryOffer={offer:true;draftId:string;draftAt:string;savedAt:string}|{offer:false;reason:string};
/** Offer only after an unclean exit, when the draft differs from the saved copy of the same expression and is not older than it. */
export function recoveryOffer(input:{draft?:Journey;saved?:Journey;uncleanExit:boolean}):RecoveryOffer{
 if(!input.uncleanExit)return {offer:false,reason:'The last session closed cleanly.'};
 const {draft,saved}=input;
 if(!draft||!saved)return {offer:false,reason:'There is no draft and saved copy to compare.'};
 if(draft.id!==saved.id)return {offer:false,reason:'The draft and the saved copy are different expressions.'};
 if(material(draft)===material(saved))return {offer:false,reason:'The draft matches the saved copy.'};
 if(Date.parse(draft.updatedAt)<Date.parse(saved.updatedAt))return {offer:false,reason:'The saved copy is newer than the draft.'};
 return {offer:true,draftId:draft.id,draftAt:draft.updatedAt,savedAt:saved.updatedAt};
}
export type RecoveryChoice='restore-draft'|'keep-saved'|'keep-both';
export interface RecoveryPlan{open:Journey;copy?:Journey;quarantineDraft:boolean;removeDraft:boolean}
/** The Library copy a kept draft becomes: a new identity, the draft's full material, and a name that says where it came from. */
export function draftCopy(draft:Journey,at:Date):Journey{
 const copy=clone(draft);copy.id=uid('expression');
 const hh=String(at.getHours()).padStart(2,'0'),mm=String(at.getMinutes()).padStart(2,'0');
 const suffix=` · recovered draft ${hh}:${mm}`;
 copy.name=(draft.name.length+suffix.length>160?draft.name.slice(0,160-suffix.length):draft.name)+suffix;
 return validateJourney(copy);
}
/** What a choice does. Every side is kept: the draft is restored, moved to quarantine, or copied into the Library. */
export function planRecoveryChoice(choice:RecoveryChoice,draft:Journey,saved:Journey,at:Date):RecoveryPlan{
 if(choice==='restore-draft')return {open:clone(draft),quarantineDraft:false,removeDraft:false};
 if(choice==='keep-saved')return {open:clone(saved),quarantineDraft:true,removeDraft:true};
 return {open:clone(saved),copy:draftCopy(draft,at),quarantineDraft:false,removeDraft:true};
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
