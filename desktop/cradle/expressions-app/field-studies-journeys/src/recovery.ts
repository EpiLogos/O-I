import {Journey,validateJourney} from './model';
import {hostedRecovery,nativeRead,nativeWrite,nativeList,nativeFind,nativeRemove,recoveryScope,draftRecoveryAddress,acceptRecoveryDraft,validateNativeRecoveryBasis,acceptNativeRecoveryBasis} from './nativeRecovery.js';
import type {RecoveryBinding,RecoveryScope} from './nativeRecovery.js';
import {Camera} from './camera';
import {validateWorkingRecord} from './nativeWorking.js';
import {sameSceneData} from './sceneCorrespondence.js';
import {preserveRecoveryLibraryCopies} from './recoveryLibrary.js';
import type {RecoveryRecord} from '../../../src/expressions/recoveryTypes';
import {TransportState,validateTransport} from '../../src/engine/transportState';
import {validateWorkingTransport,type WorkingTransport} from './transport';
// lane-3 E18/E19: the standalone draft records, their quarantine and the boot choice.
import {readLibrary,saveToLibrary,setLibraryQuarantine} from './store.js';
import {type KeyStore,type RecordLayout,type RecoveryPlan,type DraftBasis,DRAFT_BASIS_SCHEMA,draftValue,splitDraftValue,loadRecord,loadRecords,writeRecord,removeRecord,quarantine,listQuarantine,readPair,quarantinedCopy,quarantinedName,offerClock} from './draftStorage.js';
export const SESSION_KEY='oi.expression-session.v1';
export interface SessionState {version:1;journeyId:string;sceneId:string;selected:string[];stepIndex:number;sceneElapsed:number;simTime:number;playing:boolean;journeyPlaying:boolean;camera:Camera;transport?:TransportState;workingTransport?:WorkingTransport;scenePlaying?:boolean;fieldPaused?:boolean}
export function validateSession(value:unknown,j:Journey):SessionState|undefined{
 const s=value as SessionState;if(!s||s.version!==1||s.journeyId!==j.id||!j.scenes.some(v=>v.id===s.sceneId))return;
 const c=s.camera;if(!c||!['2d','3d'].includes(c.mode)||!['XY','XZ','YZ'].includes(c.plane)||![c.yaw,c.pitch,c.zoom,c.panX,c.panY,c.depth].every(n=>Number.isFinite(n)&&Math.abs(n)<1e7)||typeof c.grid!=='boolean'||typeof c.snap!=='boolean'||c.zoom<=0||c.zoom>100||![s.sceneElapsed,s.simTime,s.stepIndex].every(n=>Number.isFinite(n)&&n>=0)||s.sceneElapsed>3600||s.simTime>1e12||!Number.isInteger(s.stepIndex)||s.stepIndex>31||!Array.isArray(s.selected)||s.selected.length>32||!s.selected.every(id=>typeof id==='string')||typeof s.playing!=='boolean'||typeof s.journeyPlaying!=='boolean'||s.scenePlaying!==undefined&&typeof s.scenePlaying!=='boolean'||s.fieldPaused!==undefined&&typeof s.fieldPaused!=='boolean')return;
 // lane-3 E24: the working-view transport is a sibling of the engine's automation transport; a malformed value is dropped, never the session.
 const working=validateWorkingTransport(s.workingTransport);
 try{return {...s,workingTransport:working,transport:s.transport?validateTransport(s.transport):undefined};}catch{return {...s,workingTransport:working,transport:undefined};}
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{
 let failed=false;
 const request=indexedDB.open('oi.expression-recovery',3);
 request.onupgradeneeded=()=>{
  if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts',{keyPath:'id'});
  // Same recovery owner, keyed direct reads; listing browser drafts must not
  // deserialize every native baseline/operation checkpoint.
  if(!request.result.objectStoreNames.contains('nativeWorking'))request.result.createObjectStore('nativeWorking',{keyPath:'id'});
  // lane-3 E18: damaged or invalid draft material, kept verbatim with its reason.
  if(!request.result.objectStoreNames.contains('quarantine'))request.result.createObjectStore('quarantine',{keyPath:'id'});
 };
 request.onsuccess=()=>{if(failed){request.result.close();return;}request.result.onversionchange=()=>{request.result.close();database=undefined;};resolve(request.result);};
 request.onerror=()=>{failed=true;reject(request.error);};
 request.onblocked=()=>{failed=true;reject(new Error('Recovery storage is blocked by another tab. Close or reload its older application before retrying.'));};
}).catch(error=>{database=undefined;throw error;});}
/** The recovery stores, IndexedDB-first. IndexedDB is denied in private
 * browsing and embedded opaque origins; the same record shapes then fall back
 * to origin-localStorage, so drafts and interrupted operations still survive
 * a reload instead of failing every open and save. */
interface RecoveryStore{get(key:string):Promise<any|undefined>;put(key:string,value:any):Promise<void>;delete(key:string):Promise<void>;all(limit?:number):Promise<any[]>;}
function localStorageBacked(name:string):RecoveryStore{
 const prefix=`oi.expression-recovery.${name}.`;
 return {
  async get(key:string){const raw=localStorage.getItem(prefix+key);if(raw===null)return undefined;try{return JSON.parse(raw);}catch{return undefined;}},
  async put(key:string,value:any){localStorage.setItem(prefix+key,JSON.stringify(value));},
  async delete(key:string){localStorage.removeItem(prefix+key);},
  async all(limit=512){const out:any[]=[];for(let i=0;i<localStorage.length&&out.length<limit;i++){const key=localStorage.key(i);if(key&&key.startsWith(prefix)){try{out.push(JSON.parse(localStorage.getItem(key)!));}catch{}}}return out;}
 };
}
function idbBacked(database:IDBDatabase,name:string):RecoveryStore{
 const get=(key:string)=>new Promise<any|undefined>((resolve,reject)=>{const r=database.transaction(name,'readonly').objectStore(name).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const all=(limit=512)=>new Promise<any[]>((resolve,reject)=>{const r=database.transaction(name,'readonly').objectStore(name).getAll(undefined,limit);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const put=(key:string,value:any)=>new Promise<void>((resolve,reject)=>{const tx=database.transaction(name,'readwrite');tx.objectStore(name).put({...value,id:key});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Draft backup was interrupted.'));});
 const remove=(key:string)=>new Promise<void>((resolve,reject)=>{const tx=database.transaction(name,'readwrite');tx.objectStore(name).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Draft backup was interrupted.'));});
 return {get,put,delete:remove,all};
}
let idbBroken=false;
function recoveryStore(name:string):Promise<RecoveryStore>{
 if(idbBroken)return Promise.resolve(localStorageBacked(name));
 return db().then(database=>idbBacked(database,name)).catch(()=>{idbBroken=true;return localStorageBacked(name);});
}
/** lane-3 E18: raw-string stores for standalone drafts. IndexedDB keys are atomic and hold the record directly; the localStorage fallback keeps a versioned pair per record. */
function localNamespace(namespace:string):KeyStore{
 const full=(key:string)=>namespace+key;
 return {
  async get(key){const raw=localStorage.getItem(full(key));return raw===null?undefined:raw;},
  async put(key,raw){localStorage.setItem(full(key),raw);},
  async delete(key){localStorage.removeItem(full(key));},
  async keys(prefix){const out:string[]=[];for(let i=0;i<localStorage.length;i++){const stored=localStorage.key(i);if(stored&&stored.startsWith(namespace+prefix))out.push(stored.slice(namespace.length));}return out;},
 };
}
function idbRecordStore(database:IDBDatabase,name:string,wrap:(key:string,raw:string)=>unknown,unwrap:(row:any)=>string):KeyStore{
 const get=(key:string)=>new Promise<any>((resolve,reject)=>{const r=database.transaction(name,'readonly').objectStore(name).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const write=(op:(store:IDBObjectStore)=>IDBRequest,)=>new Promise<void>((resolve,reject)=>{const tx=database.transaction(name,'readwrite');op(tx.objectStore(name));tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Draft backup was interrupted.'));});
 return {
  async get(key){const row=await get(key);return row===undefined?undefined:unwrap(row);},
  async put(key,raw){await write(store=>store.put(wrap(key,raw)));},
  async delete(key){await write(store=>store.delete(key));},
  async keys(prefix){return new Promise<string[]>((resolve,reject)=>{const r=database.transaction(name,'readonly').objectStore(name).getAllKeys();r.onsuccess=()=>resolve((r.result as IDBValidKey[]).map(String).filter(k=>k.startsWith(prefix)));r.onerror=()=>reject(r.error);});},
 };
}
async function idbDatabase():Promise<IDBDatabase|undefined>{if(idbBroken)return undefined;return db().catch(()=>{idbBroken=true;return undefined;});}
/** Drafts: IndexedDB rows are the journeys themselves (keyed by id); the fallback is a versioned localStorage pair. */
async function draftLayout():Promise<RecordLayout>{
 const database=await idbDatabase(),quarantineStore=await quarantineKV();
 if(database)return {store:idbRecordStore(database,'drafts',(key,raw)=>({...JSON.parse(raw),id:key}),row=>JSON.stringify(row)),quarantine:quarantineStore,prefix:'',paired:false,source:'draft'};
 return {store:localNamespace('oi.expression-recovery.drafts.'),quarantine:quarantineStore,prefix:'',paired:true,source:'draft'};
}
/** Quarantine material is never adopted and is never deleted by a read. */
async function quarantineKV():Promise<KeyStore>{
 const database=await idbDatabase();
 if(database)return idbRecordStore(database,'quarantine',(key,raw)=>({id:key,raw}),row=>row.raw);
 return localNamespace('oi.expression-recovery.quarantine.');
}
/** The verbatim stored text of one draft, or undefined when none is stored. */
async function draftRawText(layout:RecordLayout,id:string):Promise<string|undefined>{
 if(!layout.paired)return layout.store.get(id);
 return (await readPair(layout.store,id)).body;
}
/** The draft grammar stores the journey with its basis under one reserved key. Every read validates the journey alone. */
export function draftJourney(value:unknown):Journey{return validateJourney(splitDraftValue(value).journey);}
/** Every quarantined draft with its reason, for listing to the owner. */
export async function listQuarantinedDrafts(){return listQuarantine(await quarantineKV());}
// lane-3 E18: an unreadable Library entry is quarantined in this same store, so the Library section lists drafts and Library entries alike.
setLibraryQuarantine((key,raw,reason,at)=>quarantineKV().then(store=>quarantine(store,'library',key,raw,reason,at)).then(()=>undefined));
/** The Library's quarantine section (T-REVIEW-6): each readable entry with its name, reason and time, and every unreadable id, never hidden. */
export async function quarantineView(now:Date=new Date()){
 const {records,unreadable}=await listQuarantinedDrafts();
 return {rows:records.map(r=>({id:r.id,key:r.key,name:quarantinedName(r.raw,r.key),reason:r.reason,when:offerClock(r.at,now),raw:r.raw})),unreadable};
}
/** Restore one quarantined draft as a Library copy. The copy is written and read back; the quarantined record stays where it is. */
export async function restoreQuarantinedDraft(id:string):Promise<Journey>{
 const {records}=await listQuarantinedDrafts();const record=records.find(r=>r.id===id);
 if(!record)throw new Error('That quarantined draft is no longer stored.');
 const copy=quarantinedCopy(record.raw,new Date());
 saveToLibrary(copy);
 if(!readLibrary().some(row=>row.id===copy.id))throw new Error('The browser Library did not keep the restored copy. The quarantined draft was retained.');
 return copy;
}
/** Carry out one boot choice. A copy is saved and read back before the draft is removed; a quarantined draft is kept verbatim before removal. */
export async function applyRecoveryPlan(plan:RecoveryPlan,draft:Journey,verbatim?:string):Promise<void>{
 const at=new Date();
 if(plan.copy){saveToLibrary(plan.copy);if(!readLibrary().some(row=>row.id===plan.copy!.id))throw new Error('The browser Library did not keep the recovered copy. The draft was retained.');}
 const layout=await draftLayout();
 if(plan.quarantineDraft){
  // A hosted draft is kept from its own native text (verbatim), never from a webview copy that may be older.
  const raw=verbatim??(await draftRawText(layout,draft.id))??JSON.stringify(validateJourney(draft));
  await quarantine(layout.quarantine,'draft',draft.id,raw,plan.quarantineReason??'Superseded by the saved copy after an unclean exit. The draft is kept here verbatim.',at);
 }
 if(plan.removeDraft)await removeRecord(layout,draft.id,at,draftJourney);
}
/** E19 (base): a draft is written with the checkpoint revision it was edited from (`basis`), when the frame knows it. */
export async function writeDraft(j:Journey,scope?:RecoveryScope,basis?:DraftBasis){const stored=draftValue(validateJourney(j),basis);if(hostedRecovery())return nativeWrite('draft',j.id,stored,scope??draftRecoveryAddress(j.id).scope);await writeRecord(await draftLayout(),j.id,JSON.stringify(stored),new Date(),draftJourney);}
export async function readDraft(id:string,scope?:RecoveryScope){if(hostedRecovery()){const row=await nativeRead('draft',id,scope??draftRecoveryAddress(id).scope);return row?draftJourney(row.value):undefined;}return (await loadRecord(await draftLayout(),id,draftJourney,new Date())).value;}
export async function readDrafts(scope?:RecoveryScope){if(hostedRecovery()){const rows=await nativeList('draft',scope??recoveryScope());const values:Journey[]=[];for(const row of rows){const draft=await readDraft(row.id,row.scope);if(draft)values.push(draft);}return values;}const loaded=await loadRecords(await draftLayout(),draftJourney,new Date());for(const row of loaded.rejected)console.warn(`Draft ${row.key} is kept in place and was not adopted: ${row.reason}`);return loaded.values;}
export async function removeDraft(id:string,scope?:RecoveryScope){if(hostedRecovery())return nativeRemove('draft',id,scope??draftRecoveryAddress(id).scope);await removeRecord(await draftLayout(),id,new Date(),draftJourney);}
/** E19 (hosted): the native draft row exactly as the owner holds it (or null), read for the basis and the verbatim text. */
export function readDraftRow(id:string,scope?:RecoveryScope){return nativeRead('draft',id,scope??draftRecoveryAddress(id).scope);}
/** The basis a native draft row was written with; undefined when the row carries none (an unknown basis). */
export function draftRowBasis(row:{value?:unknown}):DraftBasis|undefined{return splitDraftValue(row.value).basis;}
/** The verbatim text of a native draft row, kept as it is when a choice quarantines it. */
export function draftRowText(row:{value?:unknown}):string{return JSON.stringify(row.value);}
/** E19 (hosted): the native draft row marked kept by the owner's choice. The row stays, so a later open keeps it again verbatim and never offers or adopts it. */
export async function markNativeDraftKept(journey:Journey,basis:DraftBasis|undefined,revision:number,scope?:RecoveryScope):Promise<void>{
 const kept:DraftBasis={schema:DRAFT_BASIS_SCHEMA,revision:basis?.revision??revision,edited:basis?.edited??true,superseded:true};
 await nativeWrite('draft',journey.id,draftValue(validateJourney(journey),kept),scope??draftRecoveryAddress(journey.id).scope);
}

/** Read only the host-selected checkpoint address. A same-ref duplicate is
 * not permission to choose another scope, revision or authoring draft. */
export async function readBoundWorkingDraft(binding:RecoveryBinding){
 if(!hostedRecovery())throw new Error('The selected recovery address requires its native host');
 const row=await nativeRead('checkpoint',binding.checkpoint_id,binding.scope);
 if(!row)throw new Error('The selected native working checkpoint is absent');
 const draftId=acceptRecoveryDraft(binding,row),raw=row.value as import('./nativeWorking').NativeWorkingRecord;
 const draft=await nativeRead('draft',draftId,binding.scope);
 const journey=draft?draftJourney(draft.value):validateJourney(raw.view!.journey);
 const record=validateWorkingRecord(raw,journey);
 return {record,journey,recoveryRecords:[row,...(draft?[draft]:[])]};
}
/** Content and revisions are one explicit receiving act. Browsing the records
 * does not authorise overwriting an open draft or the owner's newer copy. */
export function acceptWorkingRecoveryBasis(recovered:{record:unknown;journey:Journey;recoveryRecords?:RecoveryRecord[]},current:()=>boolean):void {
 const record=validateWorkingRecord(recovered.record,recovered.journey);
 if(recovered.recoveryRecords){
  const checkpoints=recovered.recoveryRecords.filter(row=>row.kind==='checkpoint'),drafts=recovered.recoveryRecords.filter(row=>row.kind==='draft');
  if(checkpoints.length!==1||drafts.length>1)throw new Error('Recover one exact checkpoint and its acknowledged draft');
  const checkpoint=checkpoints[0],raw=checkpoint.value as import('./nativeWorking').NativeWorkingRecord,draft=drafts[0];
  if(draft&&(draft.scope!==checkpoint.scope||draft.id!==raw.draft_id))throw new Error('The recovered draft does not belong to its exact checkpoint');
  const journey=draft?draftJourney(draft.value):validateJourney(raw.view!.journey);
  const acknowledged=validateWorkingRecord(raw,journey);
  // Conversion regenerates this projection timestamp; authored draft and
  // receipt bytes still compare exactly, including their own timestamps.
  if(record.view&&acknowledged.view)record.view.journey.updatedAt=acknowledged.view.journey.updatedAt;
  if(!sameSceneData(record,acknowledged)||!sameSceneData(recovered.journey,journey))throw new Error('The recovered working material differs from its actual owner reading; both copies were retained');
  if(typeof current!=='function'||!current())throw new Error('The selected recovery adoption is no longer current; all working copies were retained');
  validateNativeRecoveryBasis(recovered.recoveryRecords,current);
  preserveRecoveryLibraryCopies(recovered.journey);
  acceptNativeRecoveryBasis(recovered.recoveryRecords,current);
 }
}

/** Desktop checkpoints live with the native recovery owner; standalone
 * artifacts share their existing browser draft database.
 * It is not part of the exportable Journey, Library or publication payload.
 * Canonical documents remain in the native kernel/files; this retains only
 * the last acknowledged basis and an interrupted operation for this draft. */
export async function writeWorkingCheckpoint(id:string,value:unknown,scope="expressions"):Promise<void>{
 if(!['expressions','techne'].includes(scope))throw new Error('Unknown working aperture');
 if(!id||id.length>160)throw new Error('Invalid working draft identity');
 if(hostedRecovery())return nativeWrite('checkpoint',id,value,scope as 'expressions'|'techne');
 await (await recoveryStore('nativeWorking')).put('native-work:'+scope+':'+id,{schema:'oi.native-working-checkpoint/v1',value});
}
export async function readWorkingCheckpoint(id:string,scope="expressions"):Promise<unknown>{
 if(!['expressions','techne'].includes(scope))throw new Error('Unknown working aperture');
 if(hostedRecovery())return (await nativeRead('checkpoint',id,scope as 'expressions'|'techne'))?.value;
 const row=await (await recoveryStore('nativeWorking')).get('native-work:'+scope+':'+id);
 return row?.schema==='oi.native-working-checkpoint/v1'?row.value:undefined;
}

/** The host checkpoint is a native reference, which can differ from a compact
 * rendering ID. Resolve it inside this aperture's existing recovery store. */
export async function readWorkingDraft(reference:string,scope="expressions"){
 if(!['expressions','techne'].includes(scope))throw new Error('Unknown working aperture');
 if(hostedRecovery()){
  const row=await nativeFind(reference,scope as 'expressions'|'techne');
  const record=row?.value as import('./nativeWorking').NativeWorkingRecord|undefined;if(!record)return;
  const journey=await readDraft(record.draft_id)??validateJourney(record.view!.journey);
  return {record,journey};
 }
 const rows=await (await recoveryStore('nativeWorking')).all(257);
 if(rows.length>256)throw new Error('Native draft recovery exceeds its bounded inventory; choose the saved file');
 const matches=rows.filter(row=>row?.schema==='oi.native-working-checkpoint/v1'&&row.id?.startsWith('native-work:'+scope+':')&&row.value?.view?.document?.expression_ref===reference);
 if(matches.length>1)throw new Error('Several working drafts address this Expression; choose the draft to recover');
 const record=matches[0]?.value;if(!record)return;
 // The acknowledged view is retained even if no later autosave completed.
 const journey=await readDraft(record.draft_id)??validateJourney(record.view.journey);
 return {record,journey};
}
