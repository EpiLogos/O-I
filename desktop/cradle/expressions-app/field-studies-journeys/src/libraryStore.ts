/** lane-3 E18: the standalone Library, one record per document.
 *
 * The Library was one JSON array rewritten wholesale on every save (`store.ts:34` before this file): one torn
 * write lost every document. Now each saved copy is a pair of slots (`#a`, `#b`): the draft layer's versioned
 * record (draftStorage.encodeEnvelope, a digest and a revision). A write goes into the slot that does not hold
 * the newest copy and is read back before it counts, so a torn write damages only the slot being written and the
 * newest copy is never the one overwritten. A pair, the order record, keeps the newest-first list of documents.
 *
 * Same expression, several definitions: the earlier array could hold several entries with one id (distinct
 * definitions, or identical copies). Each is its own record: the first at `<id>`, the others at `<id>@1`, `<id>@2`
 * in the order they were read, so every one stays readable and listed in its place.
 *
 * Damage: nothing is dropped. A damaged slot is held verbatim, read back, and only then replaced. Damaged and
 * held material is kept in place and reported until the sweep moves it, verbatim, into the one quarantine store
 * the drafts use (recovery.ts registers that store). The sweep removes an original only while it still holds the
 * same text after the quarantine read-back, so concurrent sweeps are safe.
 *
 * Migration: the earlier single array is split once into per-document records. Each record reads back before the
 * split is proven; an entry that does not validate is held verbatim. A split-proof record stores the digest of the
 * array it split, so the array is then ignored and not written. The array is retained read-only for one release, as
 * E18 directs; its quarantine is the next release's step. A failed split leaves no proof, so the array is read from
 * and split again on the next read.
 *
 * Storage is synchronous, because the Library's callers are (app.ts, library.ts, recoveryLibrary.ts). The backend
 * is localStorage, whose setItem is atomic per key, and read-back proves each write. The IndexedDB form of E18
 * needs those callers to become asynchronous; that is open and outside this module. */
import {Journey,clone,validateJourney} from './model.js';
import {digest,encodeEnvelope,readEnvelope,LIBRARY_RECORD_SCHEMA} from './draftStorage.js';

/** T22: where a library entry's document came from. A kernel-ref entry is the browser copy of the kernel Expression `ref`;
 * a local-draft entry is browser-local work the kernel has not recorded. The origin is stored beside the document, never in it:
 * a document read from the Library carries no origin, so its authored material and drafts compare exactly as before. */
export type LibraryOrigin={kind:'kernel-ref';ref:string}|{kind:'local-draft'};
const LOCAL_DRAFT:LibraryOrigin={kind:'local-draft'};
/** The origin a stored or supplied value reads as. Anything that is not a well-formed kernel ref is local-draft: an unknown origin is not kernel-bound. */
export function libraryOriginFrom(value:unknown):LibraryOrigin{
 const candidate=value as {kind?:unknown;ref?:unknown}|null;
 if(candidate&&typeof candidate==='object'&&candidate.kind==='kernel-ref'&&typeof candidate.ref==='string'&&candidate.ref.startsWith('expression:')&&candidate.ref.length<=512)
  return {kind:'kernel-ref',ref:candidate.ref};
 return {kind:'local-draft'};
}

/** The earlier single-array key. Retained read-only after its split is proven (see the module note). */
export const LEGACY_LIBRARY_KEY='oi.field-studies.journey-library.v1';
const PREFIX='oi.field-studies.journey-library.v2.';
const DOC_PREFIX=`${PREFIX}doc.`;
const HELD_PREFIX=`${PREFIX}held.`;
const ORDER_BASE=`${PREFIX}order`;
const PROOF_KEY=`${PREFIX}split`;
const HELD_SCHEMA='oi.library-held/v1';
const PROOF_SCHEMA='oi.library-split/v1';

/** The synchronous key-value surface the Library uses. The browser's localStorage is the default; tests inject a fake. */
export interface LibraryBackend{get(key:string):string|null;set(key:string,value:string):void;remove(key:string):void;keys():string[]}
function browserBackend():LibraryBackend{
 return {
  get:key=>localStorage.getItem(key),
  set:(key,value)=>localStorage.setItem(key,value),
  remove:key=>localStorage.removeItem(key),
  keys:()=>{const out:string[]=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key!==null)out.push(key);}return out;},
 };
}
let backend:LibraryBackend|undefined;
/** Test seam: the storage behind the Library. Undefined restores the browser's localStorage. */
export function setLibraryBackend(next:LibraryBackend|undefined):void{backend=next;}
function store():LibraryBackend{return backend??browserBackend();}

/** Moves one unreadable record, verbatim, into the shared quarantine store. Resolves once that store has read it back. */
export type LibraryQuarantineSink=(key:string,raw:string,reason:string,at:Date)=>Promise<void>;
let sink:LibraryQuarantineSink|undefined;
/** Registered once by recovery.ts, so Library quarantine and draft quarantine are one store and one section. */
export function setLibraryQuarantine(next:LibraryQuarantineSink|undefined):void{sink=next;}

export interface LibraryRead{journeys:Journey[];errors:string[];raw:unknown[];blocked:boolean}
/** The Library read with each listed entry's origin, by document id (the newest listed copy wins). An id absent from `origins` is
 * local-draft: an entry saved before origins were recorded is not kernel-bound. The read shape itself is unchanged. */
export interface LibraryReadWithOrigins{read:LibraryRead;origins:Map<string,LibraryOrigin>}
const messageOf=(error:unknown):string=>error instanceof Error?error.message:String(error);

/** A record's place: its encoded id, with an ordinal for the second and later definitions of one id. */
const partOf=(id:string,ordinal=0):string=>encodeURIComponent(id)+(ordinal?`@${ordinal}`:'');
const idOf=(part:string):string=>decodeURIComponent(part.split('@')[0]);

/** A held record: material kept verbatim under a key until the sweep moves it to quarantine. */
function holdRecord(b:LibraryBackend,raw:string,reason:string,at:Date):void{
 const key=HELD_PREFIX+digest(raw),text=JSON.stringify({schema:HELD_SCHEMA,reason,at:at.toISOString(),raw});
 b.set(key,text);
 if(b.get(key)!==text)throw new Error('The damaged Library entry could not be kept, so it was not replaced.');
}
function heldRecord(text:string):{reason:string;raw:string}|undefined{
 try{const v=JSON.parse(text) as {schema?:unknown;reason?:unknown;raw?:unknown};
  if(v.schema===HELD_SCHEMA&&typeof v.reason==='string'&&typeof v.raw==='string')return {reason:v.reason,raw:v.raw};
 }catch{/* unreadable held record: quarantined as such by the sweep */}
 return undefined;
}

/** One copy in a pair: the slot it lives in, its revision and its body. */
interface Copy{slot:string;seq:number;body:string}
interface PairRead{newest?:Copy;damaged:{slot:string;raw:string}[]}
/** Reads both slots of a pair. The newest valid copy wins; every slot that is not a complete record is reported as damaged. */
function readPair(b:LibraryBackend,base:string):PairRead{
 const damaged:{slot:string;raw:string}[]=[];let newest:Copy|undefined;
 for(const slot of [`${base}#a`,`${base}#b`]){
  const raw=b.get(slot);if(raw===null)continue;
  const env=readEnvelope(LIBRARY_RECORD_SCHEMA,raw);
  if(env.state==='valid'){if(!newest||env.seq>newest.seq)newest={slot,seq:env.seq,body:env.body};}
  else damaged.push({slot,raw});
 }
 return {newest,damaged};
}
/** Writes the next version of a pair into the slot that does not hold the newest copy, and reads it back. Damaged slots are held
 * verbatim and removed first. A failed read-back restores only the slot being written: the newest copy is never at risk. */
function writePair(b:LibraryBackend,base:string,body:string,at:Date,why:string,label:string):void{
 const current=readPair(b,base);
 for(const damaged of current.damaged){holdRecord(b,damaged.raw,`${why} The damaged copy is kept here.`,at);b.remove(damaged.slot);}
 const seq=(current.newest?.seq??0)+1,slot=`${base}#${seq%2===1?'a':'b'}`;
 const older=b.get(slot),text=encodeEnvelope(LIBRARY_RECORD_SCHEMA,seq,body);
 b.set(slot,text);
 const back=readEnvelope(LIBRARY_RECORD_SCHEMA,b.get(slot)??undefined);
 if(back.state!=='valid'||back.seq!==seq||back.body!==body){
  if(older===null)b.remove(slot);else b.set(slot,older);
  throw new Error(`The ${label} could not be verified. The previous copy is retained.`);
 }
}
/** Removes the complete copies of a pair. Damaged slots are not touched: they are kept for the sweep. */
function removeValidCopies(b:LibraryBackend,base:string):void{
 for(const slot of [`${base}#a`,`${base}#b`]){const raw=b.get(slot);if(raw!==null&&readEnvelope(LIBRARY_RECORD_SCHEMA,raw).state==='valid')b.remove(slot);}
}

/** What a record's pair holds now. An unrecognised copy is complete but does not validate: it is kept in place, and held before a save replaces it. */
type DocState=
 |{state:'absent';damaged:boolean}
 |{state:'valid';seq:number;body:string;journey:Journey;origin:LibraryOrigin;damaged:boolean}
 |{state:'unrecognised';seq:number;raw:string;body:string;reason:string;damaged:boolean};
/** The stored body is the document with its origin beside it. The origin is taken out before the document is validated. */
function splitOrigin(parsed:unknown):{document:unknown;origin:LibraryOrigin}{
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {document:parsed,origin:LOCAL_DRAFT};
 const {origin,...document}=parsed as Record<string,unknown>;
 return {document,origin:libraryOriginFrom(origin)};
}
function docState(b:LibraryBackend,base:string):DocState{
 const pair=readPair(b,base),damaged=pair.damaged.length>0;
 if(!pair.newest)return {state:'absent',damaged};
 const raw=b.get(pair.newest.slot)??'',body=pair.newest.body;
 let parsed:unknown;
 try{parsed=JSON.parse(body);}
 catch(error){return {state:'unrecognised',seq:pair.newest.seq,raw,body,reason:`The saved copy is not a readable document: ${messageOf(error)}.`,damaged};}
 try{const split=splitOrigin(parsed);return {state:'valid',seq:pair.newest.seq,body,journey:validateJourney(split.document),origin:split.origin,damaged};}
 catch(error){return {state:'unrecognised',seq:pair.newest.seq,raw,body,reason:messageOf(error),damaged};}
}

/** Every record place in storage, in no particular order. */
function partsIn(b:LibraryBackend):string[]{
 return [...new Set(b.keys().filter(key=>key.startsWith(DOC_PREFIX)).map(key=>key.slice(DOC_PREFIX.length).replace(/#[ab]$/,'')))];
}
/** The origin of another valid copy of the same document id, or local-draft when none is recorded. */
function originOfId(b:LibraryBackend,id:string,exclude:string):LibraryOrigin{
 for(const other of partsIn(b)){
  if(other===exclude||idOf(other)!==id)continue;
  const state=docState(b,DOC_PREFIX+other);
  if(state.state==='valid')return state.origin;
 }
 return LOCAL_DRAFT;
}
/** The newest-first order of records, or an empty list when there is none readable. */
function readOrder(b:LibraryBackend):string[]{
 const pair=readPair(b,ORDER_BASE);if(!pair.newest)return [];
 try{const parts:unknown=JSON.parse(pair.newest.body);if(Array.isArray(parts)&&parts.every(part=>typeof part==='string'))return parts as string[];}
 catch{/* not a list: the order is rebuilt from the records */}
 return [];
}
function writeOrder(b:LibraryBackend,parts:string[],at:Date):void{
 writePair(b,ORDER_BASE,JSON.stringify(parts),at,'The Library order was replaced by a newer order.','Library order');
}

/** The split-proof: the digest of the array the split read, so the array is not split again while it is unchanged. */
function readProof(b:LibraryBackend):string|undefined{
 const env=readEnvelope(LIBRARY_RECORD_SCHEMA,b.get(PROOF_KEY)??undefined);
 if(env.state!=='valid')return undefined;
 try{const v=JSON.parse(env.body) as {schema?:unknown;digest?:unknown};return v.schema===PROOF_SCHEMA&&typeof v.digest==='string'?v.digest:undefined;}
 catch{return undefined;}
}
function writeProof(b:LibraryBackend,proof:string,at:Date):void{
 const body=JSON.stringify({schema:PROOF_SCHEMA,digest:proof,at:at.toISOString()}),text=encodeEnvelope(LIBRARY_RECORD_SCHEMA,1,body);
 b.set(PROOF_KEY,text);
 if(b.get(PROOF_KEY)!==text)throw new Error('The Library split could not be verified. The earlier Library is read again next time.');
}

/** The earlier array's entries in order: each with its place, or the reason it does not validate. */
type LegacyEntry={index:number;part:string;journey?:Journey;error?:string;value:unknown};
function legacyEntries(parsed:unknown[]):LegacyEntry[]{
 const seen=new Map<string,number>();
 return parsed.map((value,index)=>{
  try{const journey=validateJourney(value);const ordinal=seen.get(journey.id)??0;seen.set(journey.id,ordinal+1);return {index,part:partOf(journey.id,ordinal),journey,value};}
  catch(error){return {index,part:'',error:messageOf(error),value};}
 });
}

/** Splits the earlier array into per-record places, once. A record already holding the same material is left alone; a different copy is
 * held rather than overwritten. The split is proven, and the array is not split again, only after every record reads back. */
function migrateLegacy(b:LibraryBackend,at:Date):void{
 const text=b.get(LEGACY_LIBRARY_KEY);if(text===null)return;
 const proof=digest(text);
 if(readProof(b)===proof)return;
 let parsed:unknown;
 try{parsed=JSON.parse(text);}
 catch(error){holdRecord(b,text,`The earlier Library could not be read (${messageOf(error)}). Its verbatim copy is kept here.`,at);writeProof(b,proof,at);return;}
 if(!Array.isArray(parsed)){holdRecord(b,text,'The earlier Library root is not an array. Its verbatim copy is kept here.',at);writeProof(b,proof,at);return;}
 const parts:string[]=[];
 for(const entry of legacyEntries(parsed)){
  if(!entry.journey){holdRecord(b,JSON.stringify(entry.value),`Entry ${entry.index+1} of the earlier Library did not validate: ${entry.error}. Its verbatim copy is kept here.`,at);continue;}
  // The entry's own value is stored, not its normalised copy: an earlier entry is retained byte-for-value, as it was.
  const base=DOC_PREFIX+entry.part,body=JSON.stringify(entry.value),state=docState(b,base);
  parts.push(entry.part);
  if(state.state==='valid'){
   if(state.body!==body)holdRecord(b,body,`Entry ${entry.index+1} of the earlier Library repeats a saved copy with different material. Its copy is kept here.`,at);
   continue;
  }
  if(state.state==='unrecognised')holdRecord(b,state.raw,`Replaced by the earlier Library's copy. ${state.reason}`,at);
  writePair(b,base,body,at,"Replaced by the earlier Library's copy.",'Library entry');
 }
 writeOrder(b,[...new Set([...parts,...readOrder(b)])],at);
 writeProof(b,proof,at);
}

/** Damaged or held material, each with the key it is kept under: what the sweep moves into quarantine. */
function damagedRecords(b:LibraryBackend):{key:string;stored:string;logical:string;raw:string;reason:string}[]{
 const out:{key:string;stored:string;logical:string;raw:string;reason:string}[]=[];
 for(const key of b.keys()){
  const stored=b.get(key);if(stored===null)continue;
  if(key.startsWith(HELD_PREFIX)){
   const logical=key.slice(HELD_PREFIX.length),held=heldRecord(stored);
   out.push(held?{key,stored,logical,raw:held.raw,reason:held.reason}:{key,stored,logical,raw:stored,reason:'A held Library record is unreadable.'});
  }else if(key.startsWith(DOC_PREFIX)||key.startsWith(ORDER_BASE)){
   const envelope=readEnvelope(LIBRARY_RECORD_SCHEMA,stored);
   const logical=key.startsWith(DOC_PREFIX)?key.slice(DOC_PREFIX.length):key.slice(PREFIX.length);
   if(envelope.state!=='valid')out.push({key,stored,logical,raw:stored,reason:'The saved copy is damaged: it does not read back as a complete record.'});
   else if(key.startsWith(ORDER_BASE)){try{if(!Array.isArray(JSON.parse(envelope.body)))throw new Error('not a list');}catch{out.push({key,stored,logical,raw:stored,reason:'The Library order record is not a list of saved copies.'});}}
  }
 }
 return out;
}

/** Moves held and damaged records, verbatim, into quarantine. A record leaves its key only after the quarantine store reads it back and
 * the key still holds the same text. A failure keeps the record in place. Concurrent sweeps are safe: quarantine is idempotent and removal
 * is conditional. Resolves with how many records moved. */
export function sweepLibraryDamage(at:Date=new Date()):Promise<number>{
 if(!sink)return Promise.resolve(0);
 const send=sink;
 return (async():Promise<number>=>{
  let moved=0;
  try{
   for(const item of damagedRecords(store())){
    try{await send(item.logical,item.raw,item.reason,at);}catch{continue;}
    if(store().get(item.key)===item.stored){store().remove(item.key);moved++;}
   }
  }catch{/* storage unavailable: nothing moved, nothing lost */}
  return moved;
 })();
}

/** The stored value of a copy: parsed when it is JSON, otherwise its text (the sweep quarantines it verbatim). */
function parseOrText(text:string):unknown{try{return JSON.parse(text);}catch{return text;}}

/** Reads every saved copy in newest-first order. A damaged or held record is reported and kept in place; the sweep then quarantines it. */
function readLibraryRecords(origins:Map<string,LibraryOrigin>):LibraryRead{
 const result:LibraryRead={journeys:[],errors:[],raw:[],blocked:false};
 let b:LibraryBackend;
 try{b=store();b.keys();}
 catch(error){result.blocked=true;result.errors.push(messageOf(error));return result;}
 try{migrateLegacy(b,new Date());}
 catch(error){result.errors.push(`The earlier Library could not be split yet, so its entries are read from it and kept in place: ${messageOf(error)}`);}
 let needsSweep=false;
 try{
  // Every readable place, valid or unrecognised, carries its stored value so that `raw` follows the same order as the list.
  const items:{part:string;journey?:Journey;origin?:LibraryOrigin;raw:unknown}[]=[];
  for(const part of partsIn(b)){
   const state=docState(b,DOC_PREFIX+part),id=idOf(part);
   if(state.damaged)needsSweep=true;
   if(state.state==='valid')items.push({part,journey:state.journey,origin:state.origin,raw:JSON.parse(state.body)});
   else if(state.state==='unrecognised'){result.errors.push(`Entry ${id}: ${state.reason}`);items.push({part,raw:parseOrText(state.body)});}
   else if(state.damaged)result.errors.push(`Entry ${id}: its saved copy is damaged and is kept for recovery.`);
  }
  for(const key of b.keys()){
   if(!key.startsWith(HELD_PREFIX))continue;
   const held=heldRecord(b.get(key)??'');
   result.errors.push(`Kept for recovery: ${held?.reason??'a held Library record is unreadable.'}`);needsSweep=true;
  }
  const order=readOrder(b),rank=new Map<string,number>();
  order.forEach((part,index)=>{if(!rank.has(part))rank.set(part,index);});
  const newest=(a:{journey?:Journey},c:{journey?:Journey})=>(c.journey?.updatedAt??'').localeCompare(a.journey?.updatedAt??'');
  // A saved copy with no order entry is the newest save whose order write did not land: it is listed first.
  const orphans=items.filter(item=>!rank.has(item.part)).sort(newest);
  const listed=items.filter(item=>rank.has(item.part)).sort((a,c)=>rank.get(a.part)!-rank.get(c.part)!);
  const ordered=[...orphans,...listed];
  result.raw=ordered.map(item=>item.raw);
  const journeys=ordered.flatMap(item=>item.journey?[item.journey]:[]);
  for(const item of ordered)if(item.journey&&item.origin&&!origins.has(item.journey.id))origins.set(item.journey.id,item.origin);
  // The earlier array is read from only while its split is unproven: a failed split must not hide any of its entries.
  const legacy=b.get(LEGACY_LIBRARY_KEY);
  if(legacy!==null&&readProof(b)!==digest(legacy)){
   let parsed:unknown;
   try{parsed=JSON.parse(legacy);}catch(error){result.errors.push(`The earlier Library could not be read and is kept in place: ${messageOf(error)}`);}
   if(Array.isArray(parsed))for(const entry of legacyEntries(parsed)){
    if(!entry.journey){result.errors.push(`Earlier Library entry ${entry.index+1}: ${entry.error}`);result.raw.push(entry.value);continue;}
    if(!items.some(item=>item.part===entry.part)){journeys.push(entry.journey);result.raw.push(entry.value);}
   }
   else if(parsed!==undefined)result.errors.push('The earlier Library root is not an array and is kept in place.');
  }
  result.journeys=journeys;
 }catch(error){result.errors.push(messageOf(error));}
 if(needsSweep)void sweepLibraryDamage(new Date());
 return result;
}
export function readLibraryDetailed():LibraryRead{return readLibraryRecords(new Map());}
/** The Library read together with each listed entry's origin (T22). */
export function readLibraryWithOrigins():LibraryReadWithOrigins{const origins=new Map<string,LibraryOrigin>();return {read:readLibraryRecords(origins),origins};}
export function readLibrary():Journey[]{return readLibraryDetailed().journeys;}

/** Saves one document, replacing every saved copy of the same expression. An unrecognised copy is held verbatim first; the new copy is read back before it is listed. */
export function saveToLibrary(journey:Journey,origin?:LibraryOrigin):Journey[]{
 const at=new Date();
 let b:LibraryBackend;
 try{b=store();b.keys();}
 catch{throw new Error('Existing library could not be read. It has not been overwritten. Export a file to keep this edit.');}
 migrateLegacy(b,at);
 const next=clone(validateJourney(journey)),part=partOf(next.id);
 const base=DOC_PREFIX+part,state=docState(b,base);
 // T22: a save that names no origin keeps the origin the entry already records (or a copy of the same id records), so backing up or
 // opening a document never flips it. Only a save that names the kernel ref records one.
 const recorded:LibraryOrigin=origin!==undefined?libraryOriginFrom(origin):state.state==='valid'?state.origin:originOfId(b,next.id,part);
 if(state.state==='unrecognised')holdRecord(b,state.raw,`Replaced by a newer save. ${state.reason}`,at);
 writePair(b,base,JSON.stringify({...next,origin:recorded}),at,'Replaced by a newer save.','Library entry');
 // The other valid definitions of this expression are replaced by this one, as before; unrecognised ones are kept.
 const replaced=partsIn(b).filter(other=>other!==part&&idOf(other)===next.id&&docState(b,DOC_PREFIX+other).state==='valid');
 for(const other of replaced)removeValidCopies(b,DOC_PREFIX+other);
 writeOrder(b,[part,...readOrder(b).filter(other=>other!==part&&!replaced.includes(other))],at);
 return readLibrary();
}

/** Deletes every understood saved copy of one expression. Damaged and unrecognised copies are retained verbatim: a removal never drops material. */
export function removeFromLibrary(id:string):void{
 let b:LibraryBackend;
 try{b=store();b.keys();}
 catch{throw new Error('The existing library could not be read; nothing was deleted.');}
 const at=new Date();
 migrateLegacy(b,at);
 for(const part of partsIn(b).filter(other=>idOf(other)===id))removeValidCopies(b,DOC_PREFIX+part);
 // The copies leave before the order does, so an interrupted removal can never bring one back.
 const present=new Set(partsIn(b)),order=readOrder(b);
 const kept=order.filter(part=>idOf(part)!==id||present.has(part));
 if(kept.length!==order.length)writeOrder(b,kept,at);
}
