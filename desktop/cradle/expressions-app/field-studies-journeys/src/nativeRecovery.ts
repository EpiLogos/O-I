import {nativeRecoveryRequest} from './kernelExpressions.js';
import type {RecoveryBinding,RecoveryKind,RecoveryRecord,RecoveryScope} from '../../../src/expressions/recoveryTypes';
export type {RecoveryBinding,RecoveryScope};

export const hostedRecovery=()=>typeof window!=='undefined'&&window.parent!==window&&
 (location.protocol==='oi-material:'||new URLSearchParams(location.search).has('mode'));
export function qualifyRecoveryBinding(raw:unknown):RecoveryBinding {
 const b=raw as Partial<RecoveryBinding>|null;
 if(!b||!['expressions','techne'].includes(b.scope??'')||typeof b.checkpoint_id!=='string'||!b.checkpoint_id.trim()
  ||b.checkpoint_id.length>160||/[\u0000-\u001f\u007f]/.test(b.checkpoint_id)
  ||typeof b.expression_ref!=='string'||!/^expression:[a-zA-Z0-9_.-]{1,128}$/.test(b.expression_ref))throw new Error('Choose an explicit native recovery address');
 return {scope:b.scope!,checkpoint_id:b.checkpoint_id,expression_ref:b.expression_ref};
}
const bindings=new Map<string,RecoveryBinding>();
const drafts=new Map<string,RecoveryBinding>();
let selected:RecoveryBinding|null=null;
export function bindNativeRecovery(raw:unknown):RecoveryBinding {
 const binding=qualifyRecoveryBinding(raw),old=bindings.get(binding.expression_ref);
 if(old&&(old.scope!==binding.scope||old.checkpoint_id!==binding.checkpoint_id))throw new Error('This Expression already has a different selected recovery address; reconcile it before switching');
 if(!old&&bindings.size>=256)throw new Error('The native recovery binding inventory is full');
 bindings.set(binding.expression_ref,binding);return binding;
}
export function recoveryBinding(reference:string,raw?:unknown):RecoveryBinding {
 const binding=raw===undefined?bindings.get(reference):bindNativeRecovery(raw);
 if(!binding||binding.expression_ref!==reference)throw new Error('The host has not selected a recovery address for this native work');
 return {...binding};
}
export function acceptRecoveryDraft(binding:RecoveryBinding,record:RecoveryRecord):string {
 const value=record.value as {schema?:unknown;draft_id?:unknown;view?:{document?:{expression_ref?:unknown}}}|null;
 if(record.scope!==binding.scope||record.kind!=='checkpoint'||record.id!==binding.checkpoint_id
  ||value?.schema!=='oi.native-working/v1'||typeof value.draft_id!=='string'||!value.draft_id||value.draft_id.length>160
  ||value.view?.document?.expression_ref!==binding.expression_ref)throw new Error('The native checkpoint does not acknowledge its selected recovery address');
 const old=drafts.get(value.draft_id);
 if(old&&(old.scope!==binding.scope||old.checkpoint_id!==binding.checkpoint_id))throw new Error('This draft has a different native recovery address; both records were retained');
 drafts.set(value.draft_id,{...binding});return value.draft_id;
}
export function selectNativeRecovery(binding:RecoveryBinding):void {selected=bindNativeRecovery(binding);}
export function recoveryBindingForDraft(id:string):RecoveryBinding {
 const binding=drafts.get(id);if(!binding)throw new Error('Read the selected native checkpoint before retaining this draft');return {...binding};
}
export const recoveryScope=():RecoveryScope=>{
 if(selected)return selected.scope;
 if(!hostedRecovery())return 'expressions';
 throw new Error('The host has not selected a native recovery address');
};
if(typeof location!=='undefined'){
 const query=new URLSearchParams(location.search),scope=query.get('recovery-scope'),checkpoint_id=query.get('recovery-checkpoint'),expression_ref=query.get('expression');
 if(scope||checkpoint_id)bindNativeRecovery({scope,checkpoint_id,expression_ref});
}
const revisions=new Map<string,number|null>();
const queues=new Map<string,Promise<unknown>>();
const key=(scope:RecoveryScope,kind:RecoveryKind,id:string)=>`${scope}:${kind}:${id}`;
type ReadBasis={scope:RecoveryScope;kind:RecoveryKind;id:string;revision:number;value:string};
const readReceipts=new WeakMap<RecoveryRecord,ReadBasis>();
const latestReadRevisions=new Map<string,number|null>();
function rememberReading(scope:RecoveryScope,kind:RecoveryKind,id:string,record:RecoveryRecord|null):void {
 const address=key(scope,kind,id);
 if(!record){latestReadRevisions.set(address,null);return;}
 if(record.scope!==scope||record.kind!==kind||record.id!==id||!Number.isSafeInteger(record.revision)||record.revision<1)throw new Error('The native recovery owner answered an invalid record basis');
 const value=JSON.stringify(record.value);
 if(value===undefined)throw new Error('The native recovery owner answered an invalid record body');
 readReceipts.set(record,{scope,kind,id,revision:record.revision,value});
 const latest=latestReadRevisions.get(address);
 latestReadRevisions.set(address,latest==null?record.revision:Math.max(latest,record.revision));
}
/** Collect only immutable actual-read receipts; never accept a caller's basis map. */
function collectNativeRecoveryBasis(records:readonly RecoveryRecord[],current:()=>boolean):Map<string,number> {
 if(!Array.isArray(records)||!records.length||records.length>2||typeof current!=='function'||!current())throw new Error('The selected recovery adoption is no longer current; all working copies were retained');
 const accepted=new Map<string,number>();
 for(const record of records){
  const receipt=readReceipts.get(record);
  if(!receipt||record.scope!==receipt.scope||record.kind!==receipt.kind||record.id!==receipt.id||record.revision!==receipt.revision)throw new Error('Accept only the exact native recovery record that was read for this adoption');
  if(JSON.stringify(record.value)!==receipt.value)throw new Error('The native recovery record body changed after reading; its owner basis was not adopted');
  const address=key(receipt.scope,receipt.kind,receipt.id);
  if(accepted.has(address))throw new Error('A recovery adoption must name each record only once');
  if(latestReadRevisions.get(address)!==receipt.revision)throw new Error('A newer recovery reading superseded this adoption; choose its current basis explicitly');
  if(queues.has(address))throw new Error('A recovery write is still returning; retain this adoption until its exact result is known');
  accepted.set(address,receipt.revision);
 }
 if(!current())throw new Error('The selected recovery adoption changed; all working copies were retained');
 return accepted;
}
/** Read-only preflight before durable retention. This does not refresh CAS. */
export function validateNativeRecoveryBasis(records:readonly RecoveryRecord[],current:()=>boolean):void {
 collectNativeRecoveryBasis(records,current);
}
/** Intentional recovery adoption only. Browsing never changes an open draft's
 * CAS basis, and a conflict never retries against a newer winning copy. The
 * caller validates and retains departing material before this receiving act. */
export function acceptNativeRecoveryBasis(records:readonly RecoveryRecord[],current:()=>boolean):void {
 // Recheck every receipt and the live receiving guard after retention; a
 // successful preflight is not an admission token or permission to retry.
 const accepted=collectNativeRecoveryBasis(records,current);
 for(const [address,revision] of accepted)revisions.set(address,revision);
}
export async function nativeRead(kind:RecoveryKind,id:string,scope=recoveryScope()):Promise<RecoveryRecord|null>{
 const result=await nativeRecoveryRequest({operation:'read',scope,kind,id});
 if(result.state!=='ready')throw new Error('The native recovery owner returned an invalid reading');
 if(result.record&&(result.record.scope!==scope||result.record.kind!==kind||result.record.id!==id))throw new Error('The native recovery owner answered a different address');
 rememberReading(scope,kind,id,result.record);
 const address=key(scope,kind,id);
 // Browsing a newer record is not acceptance of that basis for an open draft.
 if(!revisions.has(address))revisions.set(address,result.record?.revision??null);return result.record;
}
export async function nativeList(kind:RecoveryKind,scope=recoveryScope()){
 const result=await nativeRecoveryRequest({operation:'list',scope,kind});
 if(result.state!=='listed')throw new Error('The native recovery owner returned an invalid inventory');
 if(result.records.some(row=>row.scope!==scope||row.kind!==kind))throw new Error('The native recovery owner mixed recovery addresses');
 return result.records;
}
export async function nativeFind(reference:string,scope:RecoveryScope){
 const result=await nativeRecoveryRequest({operation:'find_checkpoint',scope,expression_ref:reference});
 if(result.state!=='ready')throw new Error('The native recovery owner returned an invalid checkpoint');
 if(result.record&&(result.record.scope!==scope||result.record.kind!=='checkpoint'))throw new Error('The native recovery owner answered a different checkpoint scope');
 if(result.record){rememberReading(scope,'checkpoint',result.record.id,result.record);const address=key(scope,'checkpoint',result.record.id);if(!revisions.has(address))revisions.set(address,result.record.revision);}
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
  const expected=revisions.get(address)!,result=await nativeRecoveryRequest({operation:'write',scope,kind,id,expected_revision:expected,value});
  if(result.state==='revision_conflict')throw new Error(`The native recovery record changed at ${address} (expected ${expected??'absent'}, current ${result.current_revision??'absent'}). Your current work remains open; retain a copy before explicitly adopting the newer recovery basis.`);
  if(result.state!=='written')throw new Error('The native recovery owner did not acknowledge the working copy');
  if(result.record.scope!==scope||result.record.kind!==kind||result.record.id!==id)throw new Error('The native recovery owner acknowledged a different write address');
  revisions.set(address,result.record.revision);
  latestReadRevisions.set(address,result.record.revision);
 });
}
export function nativeRemove(kind:RecoveryKind,id:string,scope=recoveryScope()):Promise<void>{
 const address=key(scope,kind,id);
 return serial(address,async()=>{
  if(!revisions.has(address))await nativeRead(kind,id,scope);
  const revision=revisions.get(address);if(revision==null)return;
  const result=await nativeRecoveryRequest({operation:'remove',scope,kind,id,expected_revision:revision});
  if(result.state==='revision_conflict')throw new Error(`The native recovery record changed at ${address} (expected ${revision}, current ${result.current_revision??'absent'}); it was retained.`);
  if(result.state!=='removed')throw new Error('The native recovery owner did not acknowledge removal');
  if(result.id!==id)throw new Error('The native recovery owner acknowledged a different removal');
  revisions.set(address,null);
  latestReadRevisions.set(address,null);
 });
}
