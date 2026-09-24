import {nativeRecoveryRequest} from './kernelExpressions.js';
import type {RecoveryKind,RecoveryRecord,RecoveryScope} from '../../../src/expressions/recoveryTypes';

export const hostedRecovery=()=>typeof window!=='undefined'&&window.parent!==window&&
 (location.protocol==='oi-material:'||new URLSearchParams(location.search).has('mode'));
export const recoveryScope=():RecoveryScope=>new URLSearchParams(location.search).get('mode')==='techne'?'techne':'expressions';
const revisions=new Map<string,number|null>();
const queues=new Map<string,Promise<unknown>>();
const key=(scope:RecoveryScope,kind:RecoveryKind,id:string)=>`${scope}:${kind}:${id}`;
export async function nativeRead(kind:RecoveryKind,id:string,scope=recoveryScope()):Promise<RecoveryRecord|null>{
 const result=await nativeRecoveryRequest({operation:'read',scope,kind,id});
 if(result.state!=='ready')throw new Error('The native recovery owner returned an invalid reading');
 const address=key(scope,kind,id);
 // Browsing a newer record is not acceptance of that basis for an open draft.
 if(!revisions.has(address))revisions.set(address,result.record?.revision??null);return result.record;
}
export async function nativeList(kind:RecoveryKind,scope=recoveryScope()){
 const result=await nativeRecoveryRequest({operation:'list',scope,kind});
 if(result.state!=='listed')throw new Error('The native recovery owner returned an invalid inventory');
 return result.records;
}
export async function nativeFind(reference:string,scope:RecoveryScope){
 const result=await nativeRecoveryRequest({operation:'find_checkpoint',scope,expression_ref:reference});
 if(result.state!=='ready')throw new Error('The native recovery owner returned an invalid checkpoint');
 if(result.record){const address=key(scope,'checkpoint',result.record.id);if(!revisions.has(address))revisions.set(address,result.record.revision);}
 return result.record;
}
function serial<T>(id:string,task:()=>Promise<T>):Promise<T>{
 const previous=queues.get(id)??Promise.resolve();
 const next=previous.catch(()=>{}).then(task);queues.set(id,next);
 void next.finally(()=>{if(queues.get(id)===next)queues.delete(id);}).catch(()=>{});return next;
}
export function nativeWrite(kind:RecoveryKind,id:string,value:unknown,scope=recoveryScope()):Promise<void>{
 const address=key(scope,kind,id);
 return serial(address,async()=>{
  if(!revisions.has(address))await nativeRead(kind,id,scope);
  const result=await nativeRecoveryRequest({operation:'write',scope,kind,id,expected_revision:revisions.get(address)!,value});
  if(result.state==='revision_conflict')throw new Error('Another window changed this recovery draft. Your current work remains open; export it before reloading to reconcile the newer copy.');
  if(result.state!=='written')throw new Error('The native recovery owner did not acknowledge the working copy');
  revisions.set(address,result.record.revision);
 });
}
export function nativeRemove(kind:RecoveryKind,id:string,scope=recoveryScope()):Promise<void>{
 const address=key(scope,kind,id);
 return serial(address,async()=>{
  if(!revisions.has(address))await nativeRead(kind,id,scope);
  const revision=revisions.get(address);if(revision==null)return;
  const result=await nativeRecoveryRequest({operation:'remove',scope,kind,id,expected_revision:revision});
  if(result.state==='revision_conflict')throw new Error('Another window changed this recovery draft; it was retained.');
  if(result.state!=='removed')throw new Error('The native recovery owner did not acknowledge removal');
  revisions.set(address,null);
 });
}
