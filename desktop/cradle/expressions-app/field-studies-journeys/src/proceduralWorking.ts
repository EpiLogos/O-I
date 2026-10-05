/** Procedural receipt validation for NativeWorking's existing recovery and
 * serial writer. This module owns no queue, document store or replay clock. */
import {clone} from './model.js';
import {kernelDocumentToJourney,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {validateEnvelope,validateOperation,sameNative,type ProceduralRequest,type Operation} from './proceduralProtocol.js';

export type MutatingProceduralRequest=Extract<ProceduralRequest,{operation:'prepare'}>|{operation:'commit'|'cancel';operation_ref:string};
export interface PendingProcedure {kind:'procedural';request:MutatingProceduralRequest;accepted_operation?:Operation}
export interface ProceduralReply {schema:string;state?:string;operation?:Operation;operation_ref?:string;document_receipt?:{state?:string;document?:KernelExpressionDocument};repeated?:boolean;restored?:boolean}
export const mutatesProcedure=(request:ProceduralRequest):request is MutatingProceduralRequest=>['prepare','commit','cancel'].includes(request.operation);
export const procedureReference=(request:MutatingProceduralRequest):string=>request.operation==='prepare'?request.envelope.operation_ref:request.operation_ref;
export function validatePendingProcedure(pending:PendingProcedure,view:KernelConversion):void {
 const request=pending.request;
 if(!mutatesProcedure(request))throw Error('Recovered procedure is not a native mutation');
 if(request.operation==='prepare'){
  const envelope=validateEnvelope(request.envelope);
  if(envelope.expression_ref!==view.document.expression_ref||envelope.expected_revision!==view.document.revision)throw Error('Recovered preparation has another native basis');
 }else{
  if(!pending.accepted_operation)throw Error('Recovered procedure action lacks its admitted identity');
  const op=validateOperation(pending.accepted_operation);
  if(op.envelope.expression_ref!==view.document.expression_ref||op.envelope.operation_ref!==request.operation_ref)throw Error('Recovered action has another native target');
 }
}
export function validateProceduralReply(raw:unknown,pending:PendingProcedure):ProceduralReply&{operation:Operation} {
 const reply=raw as ProceduralReply;
 if(reply?.state==='revision_conflict')throw Error('The native procedure basis changed; its original intent remains in recovery');
 if(reply?.schema!=='oi.expression-procedural/v1'||!reply.operation)throw Error('The native owner returned no attributable procedure receipt');
 const operation=validateOperation(reply.operation),request=pending.request;
 if(operation.envelope.operation_ref!==procedureReference(request))throw Error('Procedure receipt belongs to another operation');
 if(request.operation==='prepare'&&!sameNative(operation.envelope,request.envelope))throw Error('Native preparation differs from its complete submitted intent');
 if(pending.accepted_operation&&(!sameNative(operation.envelope,pending.accepted_operation.envelope)||operation.fingerprint!==pending.accepted_operation.fingerprint))throw Error('Native action changed its original admitted identity');
 return {...reply,operation};
}
/** Readback must contain the same actual typed journal identity. A newer
 * unrelated document is never adopted as proof of this particular action. */
export function proceduralReplyView(view:KernelConversion,reply:ProceduralReply&{operation:Operation},document:KernelExpressionDocument):KernelConversion {
 const operation=reply.operation;
 if(document.expression_ref!==view.document.expression_ref||document.expression_ref!==operation.envelope.expression_ref)throw Error('Procedural readback belongs to another Expression');
 const declared=reply.document_receipt?.document;
 if(declared&&!sameNative(document,declared))throw Error('The owner changed after the procedure receipt; preserve the draft for reconciliation');
 if(document.revision<view.document.revision||document.revision>view.document.revision+1)throw Error('Procedural readback has an unrelated revision');
 const journal=document.scenes.flatMap(scene=>{
  const value=scene.presentation?.scene as {procedural?:{operations?:unknown[]}}|undefined;
  return value?.procedural?.operations??[];
 }).filter(row=>(row as Operation)?.envelope?.operation_ref===operation.envelope.operation_ref);
 if(journal.length!==1)throw Error('Native readback lacks its unique retained procedure identity');
 const retained=validateOperation(journal[0]);
 if(!sameNative(retained,operation))throw Error('Native journal has a different prepared or applied standing, target set or owner observation');
 return kernelDocumentToJourney(document,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});
}
export function pendingProcedure(request:MutatingProceduralRequest,view:KernelConversion,accepted_operation?:Operation):PendingProcedure {
 const pending:PendingProcedure={kind:'procedural',request:clone(request),...(accepted_operation?{accepted_operation:clone(accepted_operation)}:{})};
 validatePendingProcedure(pending,view);return pending;
}

/** Resolve a lost Prepare reply from the original native journal before any
 * fresh-CAS preparation. This does not send another mutation or rebase intent.
 * A later unrelated edit requires explicit reconciliation of the saved draft. */
export function preparationRetryView(request:Extract<MutatingProceduralRequest,{operation:'prepare'}>,view:KernelConversion,raw:unknown,document:KernelExpressionDocument):{reply:ProceduralReply&{operation:Operation};view:KernelConversion} {
 const envelope=validateEnvelope(request.envelope);
 const pending:PendingProcedure={kind:'procedural',request:clone(request)};
 const reply=validateProceduralReply(raw,pending),operation=reply.operation;
 if(reply.restored===true||envelope.expression_ref!==view.document.expression_ref||operation.accepted_revision!==envelope.expected_revision+1
  ||document.revision!==operation.accepted_revision||operation.status!=='prepared')throw Error('The original preparation has later native activity; retain its full intent for reconciliation');
 return {reply:{...reply,repeated:true},view:proceduralReplyView(view,reply,document)};
}
