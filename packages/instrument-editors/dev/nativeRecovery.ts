import type {NativeWorking,NativeWorkingRecord} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking';
import type {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store';
import type {KernelExpressionDocument} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';

/** CAS belongs to the captured aperture, not the latest record discovered at
 * write time. A second aperture cannot overwrite another's retained proposal. */
export async function nativeWorkbenchJournal(ref:string,recovery:(request:Record<string,unknown>)=>Promise<any>){
 const saved=await recovery({operation:'read',scope:'expressions',kind:'checkpoint',id:ref});
 let revision:number|null=saved.record?.revision??null;
 return {value:saved.record?.value,checkpoint:async(id:string,value:unknown)=>{
  if(id!==ref)throw Error('The checkpoint belongs to another native work.');
  const reply=await recovery({operation:'write',scope:'expressions',kind:'checkpoint',id,expected_revision:revision,value});
  if(reply.state!=='written'||reply.record?.id!==id||!Number.isSafeInteger(reply.record.revision))throw Error('The native recovery owner refused the captured journal revision; another aperture’s input was retained.');
  revision=reply.record.revision;
 }};
}

/** The development receiver uses the native owner's journal and recovery law.
 * A saved proposal is retained as input; opening never retries its operation. */
export async function openNativeWorkbench(work:NativeWorking,ref:string,read:()=>Promise<unknown>,inspect:()=>Promise<KernelExpressionDocument>){
 const raw=await read();
 if(raw===null||raw===undefined)return work.adopt(await inspect());
 const record=raw as NativeWorkingRecord;
 if(record?.view?.document.expression_ref!==ref)throw Error('The saved native basis does not name this work; its journal was retained.');
 const pending=record.pending;
 const journey=pending&&(pending.kind==='edit'||pending.kind==='create')?pending.submitted.journey:record.view.journey;
 return work.reopenCheckpoint(raw,journey);
}

/** Publish a composition made by the native Palace owner through the SAME
 * retained owner. No new codec, persistence store, or synthetic acknowledgement. */
export async function acknowledgeWorkbenchComposition(work:NativeWorking,store:DocumentStore,document:KernelExpressionDocument){
 if(work.state?.view?.document.expression_ref!==document.expression_ref)throw Error('Composition returned for another native work.');
 const revision=store.revision,identity=store.document;
 const current=()=>store.document===identity&&store.revision===revision&&!store.transactionOpen;
 const advanced=await work.advanceClean(identity,current);
 if(!advanced)throw Error('The native composition returned while local input was pending; that input and the acknowledged basis were retained.');
 if(!current())throw Error('New local input arrived while the composition returned; that input was retained.');
 if(JSON.stringify(advanced.document)!==JSON.stringify(document))throw Error('The composition advanced again before its effective readback; its current native journal was retained.');
 store.acknowledge(advanced.journey);
 return advanced;
}
