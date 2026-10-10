import {Journey,validateJourney} from './model';
import {hostedRecovery,nativeRead,nativeWrite,nativeList,nativeFind,nativeRemove,recoveryScope,recoveryBindingForDraft,acceptRecoveryDraft,validateNativeRecoveryBasis,acceptNativeRecoveryBasis} from './nativeRecovery.js';
import type {RecoveryBinding,RecoveryScope} from './nativeRecovery.js';
import {Camera} from './camera';
import {validateWorkingRecord} from './nativeWorking.js';
import {sameSceneData} from './sceneCorrespondence.js';
import {preserveRecoveryLibraryCopies} from './recoveryLibrary.js';
import type {RecoveryRecord} from '../../../src/expressions/recoveryTypes';
import {TransportState,validateTransport} from '../../src/engine/transportState';
export const SESSION_KEY='oi.expression-session.v1';
export interface SessionState {version:1;journeyId:string;sceneId:string;selected:string[];stepIndex:number;sceneElapsed:number;simTime:number;playing:boolean;journeyPlaying:boolean;camera:Camera;transport?:TransportState;scenePlaying?:boolean;fieldPaused?:boolean}
export function validateSession(value:unknown,j:Journey):SessionState|undefined{
 const s=value as SessionState;if(!s||s.version!==1||s.journeyId!==j.id||!j.scenes.some(v=>v.id===s.sceneId))return;
 const c=s.camera;if(!c||!['2d','3d'].includes(c.mode)||!['XY','XZ','YZ'].includes(c.plane)||![c.yaw,c.pitch,c.zoom,c.panX,c.panY,c.depth].every(n=>Number.isFinite(n)&&Math.abs(n)<1e7)||typeof c.grid!=='boolean'||typeof c.snap!=='boolean'||c.zoom<=0||c.zoom>100||![s.sceneElapsed,s.simTime,s.stepIndex].every(n=>Number.isFinite(n)&&n>=0)||s.sceneElapsed>3600||s.simTime>1e12||!Number.isInteger(s.stepIndex)||s.stepIndex>31||!Array.isArray(s.selected)||s.selected.length>32||!s.selected.every(id=>typeof id==='string')||typeof s.playing!=='boolean'||typeof s.journeyPlaying!=='boolean'||s.scenePlaying!==undefined&&typeof s.scenePlaying!=='boolean'||s.fieldPaused!==undefined&&typeof s.fieldPaused!=='boolean')return;
 try{return {...s,transport:s.transport?validateTransport(s.transport):undefined};}catch{return {...s,transport:undefined};}
}
let database:Promise<IDBDatabase>|undefined;
function db(){return database??=new Promise<IDBDatabase>((resolve,reject)=>{
 let failed=false;
 const request=indexedDB.open('oi.expression-recovery',2);
 request.onupgradeneeded=()=>{
  if(!request.result.objectStoreNames.contains('drafts'))request.result.createObjectStore('drafts',{keyPath:'id'});
  // Same recovery owner, keyed direct reads; listing browser drafts must not
  // deserialize every native baseline/operation checkpoint.
  if(!request.result.objectStoreNames.contains('nativeWorking'))request.result.createObjectStore('nativeWorking',{keyPath:'id'});
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
export async function writeDraft(j:Journey,scope?:RecoveryScope){const value=validateJourney(j);if(hostedRecovery())return nativeWrite('draft',j.id,value,scope??recoveryBindingForDraft(j.id).scope);await (await recoveryStore('drafts')).put(j.id,value);}
export async function readDraft(id:string,scope?:RecoveryScope){if(hostedRecovery()){const row=await nativeRead('draft',id,scope??recoveryBindingForDraft(id).scope);return row?validateJourney(row.value):undefined;}const row=await (await recoveryStore('drafts')).get(id);return row?validateJourney(row):undefined;}
export async function readDrafts(scope?:RecoveryScope){if(hostedRecovery()){const rows=await nativeList('draft',scope??recoveryScope());const values:Journey[]=[];for(const row of rows){const draft=await readDraft(row.id,row.scope);if(draft)values.push(draft);}return values;}const rows=await (await recoveryStore('drafts')).all();return rows.flatMap(value=>{try{return [validateJourney(value)];}catch{return [];}});}
export async function removeDraft(id:string,scope?:RecoveryScope){if(hostedRecovery())return nativeRemove('draft',id,scope??recoveryBindingForDraft(id).scope);await (await recoveryStore('drafts')).delete(id);}

/** Read only the host-selected checkpoint address. A same-ref duplicate is
 * not permission to choose another scope, revision or authoring draft. */
export async function readBoundWorkingDraft(binding:RecoveryBinding){
 if(!hostedRecovery())throw new Error('The selected recovery address requires its native host');
 const row=await nativeRead('checkpoint',binding.checkpoint_id,binding.scope);
 if(!row)throw new Error('The selected native working checkpoint is absent');
 const draftId=acceptRecoveryDraft(binding,row),raw=row.value as import('./nativeWorking').NativeWorkingRecord;
 const draft=await nativeRead('draft',draftId,binding.scope);
 const journey=draft?validateJourney(draft.value):validateJourney(raw.view!.journey);
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
  const journey=draft?validateJourney(draft.value):validateJourney(raw.view!.journey);
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
