import type {KernelTransportStatus} from '../../../kernel/types';
import {attemptReturn,recognise} from './factoryReads';

export interface RunReturnTarget {statePath:string;projectRef:string;runRef:string;attemptRef:string}
export interface ReadableNativeReturn {
  returnRef:string;summary:string;artifactRefs:string[];evidenceRefs:string[];
  receivingRef?:string;receivingSourceRevision?:string;archiveRefs:string[];regressionObservationRefs:string[];
}
export interface NativeRunReturnReading {
  contract:'factory.attempt-return-reading/v1';projectRef:string;runRef:string;revision:number;
  sourceCurrent:boolean;workflowSourceRef:string;workflowSourceRevision:string;workflowSourceDigest:string;
  attempt:{standing:'current-attempt'|'historical-attempt';status:string|null;record:Record<string,unknown>&{attemptRef:string;readableReturn?:ReadableNativeReturn|null};
    receivingStanding:string;archiveStanding:string;unresolvedOwnerOperations:unknown[];regressionObservationRefs:string[]};
}
const record=(v:unknown):Record<string,unknown>|undefined=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:undefined;
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim();
const refs=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(text)&&new Set(v).size===v.length;
export function runReturnTargetKey(target:RunReturnTarget):string {
  if(!Object.values(target).every(text))throw Error('The native Return has no exact source, Project, Run or attempt address.');
  return JSON.stringify([target.statePath,target.projectRef,target.runRef,target.attemptRef]);
}
/** Consume the actual attempt_task::read_return envelope. Keep all extra
 * owner fields; a derived inspection summary cannot stand in for this read. */
export function readNativeRunReturn(value:unknown,target:RunReturnTarget):NativeRunReturnReading {
  runReturnTargetKey(target);
  const row=record(value),attempt=record(row?.attempt),body=record(attempt?.record);
  if(row?.contract!=='factory.attempt-return-reading/v1'||row.projectRef!==target.projectRef||row.runRef!==target.runRef
    ||!Number.isSafeInteger(row.revision)||(row.revision as number)<0||typeof row.sourceCurrent!=='boolean'
    ||![row.workflowSourceRef,row.workflowSourceRevision,row.workflowSourceDigest].every(text)
    ||!attempt||!body||body.attemptRef!==target.attemptRef
    ||!['current-attempt','historical-attempt'].includes(attempt.standing as string)
    ||(attempt.status!==null&&!text(attempt.status))||!text(attempt.receivingStanding)||!text(attempt.archiveStanding)
    ||!Array.isArray(attempt.unresolvedOwnerOperations)||!refs(attempt.regressionObservationRefs))throw Error('Factory did not return this exact native Run/attempt Return reading.');
  const returned=body.readableReturn;
  if(returned!==undefined&&returned!==null){
    const material=record(returned);
    if(!material||!text(material.returnRef)||typeof material.summary!=='string'
      ||!refs(material.artifactRefs)||!refs(material.evidenceRefs)||!refs(material.archiveRefs)||!refs(material.regressionObservationRefs)
      ||[material.receivingRef,material.receivingSourceRevision].some(v=>v!==undefined&&!text(v)))throw Error('The native Return material or retained links are malformed.');
  }
  return value as NativeRunReturnReading;
}
export async function readRunReturn(transport:KernelTransportStatus,target:RunReturnTarget,current:()=>boolean):Promise<NativeRunReturnReading> {
  const captured=Object.freeze({...target});runReturnTargetKey(captured);
  if(!current())throw Error('The originating Return presentation retired before its native read.');
  const answer=await attemptReturn(transport,captured.statePath,captured.runRef,captured.attemptRef);
  if(!current())throw Error('The original Return presentation changed while its native reading was pending.');
  return readNativeRunReturn(answer,captured);
}
export interface RecognitionTarget {statePath:string;journeyRef:string;subjectRef:string;basisRefs:readonly string[]}
export interface NativeRecognitionReceipt {contract:'factory.developmental-mutation-receipt/v1';status:'applied'|'already-applied';record:Record<string,unknown>}
/** A successful transport is insufficient: the native mutation record must
 * acknowledge this exact Journey, Return and selected evidence basis. */
export function readNativeRecognitionReceipt(value:unknown,target:RecognitionTarget):NativeRecognitionReceipt {
  const row=record(value),stored=record(row?.record),request=record(stored?.request),mutation=record(request?.mutation),recognition=record(mutation?.recognition);
  const basis=recognition?.basis_refs;
  if(row?.contract!=='factory.developmental-mutation-receipt/v1'||!['applied','already-applied'].includes(row.status as string)
    ||stored?.contract!=='factory.developmental-mutation-record/v1'||request?.contract!=='factory.developmental-mutation-request/v1'
    ||mutation?.kind!=='record-owner-recognition'||mutation.journeyRef!==target.journeyRef||recognition?.subject_ref!==target.subjectRef
    ||!text(recognition.recognition_ref)||!refs(basis)||!target.basisRefs.every(ref=>basis.includes(ref)))throw Error('Factory did not acknowledge this exact Journey/Return recognition and evidence basis.');
  return value as NativeRecognitionReceipt;
}
export async function recogniseRunReturn(transport:KernelTransportStatus,target:RecognitionTarget,current:()=>boolean):Promise<NativeRecognitionReceipt> {
  const captured={...target,basisRefs:[...target.basisRefs]};
  if(![captured.statePath,captured.journeyRef,captured.subjectRef].every(text)||!refs(captured.basisRefs))throw Error('Recognition requires the actual Journey, Return and evidence references.');
  if(!current())throw Error('The originating Recognition presentation retired; no request was sent.');
  const answer=await recognise(transport,captured.statePath,captured.journeyRef,captured.subjectRef,captured.basisRefs);
  // Actual owner effects are retained by the native owner even when presentation
  // retires. Never publish a late receipt onto another Run or replay it here.
  if(!current())throw Error('The original Recognition presentation changed. Inspect its native Journey before continuing.');
  return readNativeRecognitionReceipt(answer,captured);
}
