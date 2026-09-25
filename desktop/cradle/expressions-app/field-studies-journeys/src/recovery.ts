import {Journey,validateJourney} from './model';
import {hostedRecovery,nativeRead,nativeWrite,nativeList,nativeFind,nativeRemove} from './nativeRecovery.js';
import {Camera} from './camera';
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
export async function writeDraft(j:Journey){const value=validateJourney(j);if(hostedRecovery())return nativeWrite('draft',j.id,value);const database=await db();return new Promise<void>((resolve,reject)=>{const tx=database.transaction('drafts','readwrite');tx.objectStore('drafts').put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Draft backup was interrupted.'));});}
export async function readDraft(id:string){if(hostedRecovery()){const row=await nativeRead('draft',id);return row?validateJourney(row.value):undefined;}const database=await db();return new Promise<Journey|undefined>((resolve,reject)=>{const request=database.transaction('drafts').objectStore('drafts').get(id);request.onsuccess=()=>{try{resolve(request.result?validateJourney(request.result):undefined);}catch(e){reject(e);}};request.onerror=()=>reject(request.error);});}
export async function readDrafts(){if(hostedRecovery()){const rows=await nativeList('draft');const values:Journey[]=[];for(const row of rows){const draft=await readDraft(row.id);if(draft)values.push(draft);}return values;}const database=await db();return new Promise<Journey[]>((resolve,reject)=>{const request=database.transaction('drafts').objectStore('drafts').getAll();request.onsuccess=()=>resolve(request.result.flatMap(v=>{try{return [validateJourney(v)];}catch{return [];}}));request.onerror=()=>reject(request.error);});}
export async function removeDraft(id:string){if(hostedRecovery())return nativeRemove('draft',id);const database=await db();return new Promise<void>((resolve,reject)=>{const tx=database.transaction('drafts','readwrite');tx.objectStore('drafts').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}

/** Desktop checkpoints live with the native recovery owner; standalone
 * artifacts share their existing browser draft database.
 * It is not part of the exportable Journey, Library or publication payload.
 * Canonical documents remain in the native kernel/files; this retains only
 * the last acknowledged basis and an interrupted operation for this draft. */
export async function writeWorkingCheckpoint(id:string,value:unknown,scope="expressions"):Promise<void>{
 if(!['expressions','techne'].includes(scope))throw new Error('Unknown working aperture');
 if(!id||id.length>160)throw new Error('Invalid working draft identity');
 if(hostedRecovery())return nativeWrite('checkpoint',id,value,scope as 'expressions'|'techne');
 const database=await db();
 return new Promise((resolve,reject)=>{
  const tx=database.transaction('nativeWorking','readwrite');
  tx.objectStore('nativeWorking').put({id:'native-work:'+scope+':'+id,schema:'oi.native-working-checkpoint/v1',value});
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error('Native working checkpoint was interrupted'));
 });
}
export async function readWorkingCheckpoint(id:string,scope="expressions"):Promise<unknown>{
 if(!['expressions','techne'].includes(scope))throw new Error('Unknown working aperture');
 if(hostedRecovery())return (await nativeRead('checkpoint',id,scope as 'expressions'|'techne'))?.value;
 const database=await db();
 return new Promise((resolve,reject)=>{
  const request=database.transaction('nativeWorking').objectStore('nativeWorking').get('native-work:'+scope+':'+id);
  request.onsuccess=()=>{const row=request.result;resolve(row?.schema==='oi.native-working-checkpoint/v1'?row.value:undefined);};
  request.onerror=()=>reject(request.error);
 });
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
 const database=await db();
 const rows=await new Promise<any[]>((resolve,reject)=>{
  const request=database.transaction('nativeWorking').objectStore('nativeWorking').getAll(undefined,257);
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 if(rows.length>256)throw new Error('Native draft recovery exceeds its bounded inventory; choose the saved file');
 const matches=rows.filter(row=>row?.schema==='oi.native-working-checkpoint/v1'&&row.id?.startsWith('native-work:'+scope+':')&&row.value?.view?.document?.expression_ref===reference);
 if(matches.length>1)throw new Error('Several working drafts address this Expression; choose the draft to recover');
 const record=matches[0]?.value;if(!record)return;
 // The acknowledged view is retained even if no later autosave completed.
 const journey=await readDraft(record.draft_id)??validateJourney(record.view.journey);
 return {record,journey};
}
