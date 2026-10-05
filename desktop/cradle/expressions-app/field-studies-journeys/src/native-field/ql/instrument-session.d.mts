export interface NativeDefinitionIntent {
 readonly lease:string;readonly expression_ref:string;readonly document_revision:number;
 readonly source_producer_ref:string|null;
 readonly request:{readonly action:'install_prepared'}|{readonly action:'source_continue';readonly procedure_ref:string};
}
export interface NativeDefinitionRequest {
 readonly lease:string;readonly expression_ref:string;readonly document_revision:number;
 readonly source_producer_ref?:string;
 readonly request:{readonly schema:'ql.field-host-request/v1';readonly instance_ref:string;
  readonly event_ref:string;readonly subject_ref:string;readonly request_id:string;
  readonly expected_generation:string;readonly expected_samples_elapsed:string;
  readonly command:{readonly operation:'procedure';readonly request:NativeDefinitionIntent['request']}};
}
/** NativeChannel completion custody only; no exported value-to-token issuer. */
export type NativeDefinitionCompletion=unknown;
export interface NativeDefinitionOutcome extends Record<string,unknown> {
 readonly schema:'oi.native-procedural-definition/v1';readonly original_intent:NativeDefinitionRequest;
 readonly original_request:NativeDefinitionRequest['request'];readonly captured_producer_ref:string|null;
 readonly state:'definition_received'|'definition_qualification_refused'|'definition_channel_refused';
 readonly native_receipt:NativeDocumentPreflightReceipt;readonly native_source_channel:Record<string,unknown>;
 readonly source_current:boolean;readonly consumer_release:'unconfirmed';
}
export interface NativeDefinitionRecovery extends NativeDocumentTransactionResult {
 readonly schema:'oi.native-procedural-definition-recovery/v1';readonly original_intent:NativeDefinitionRequest;
 readonly found:true;readonly recovered:true;readonly replayed:false;readonly recovery_current:true;
 readonly recovery_currentness:null;readonly original_result:NativeDefinitionOutcome;
 readonly consumer_release:'unconfirmed';
}
export interface NativePendingDefinition {
 readonly schema:'ql.instrument-pending-native-definition/v1';readonly context:NativeDocumentTransactionContext;
 readonly original_request:NativeDefinitionRequest;readonly attempts:number;readonly max_attempts:4;
 readonly reason:string;readonly accounted:boolean;readonly standing:'original_native_definition_reply_unknown';
}
export function validateNativeDefinitionOutcome(result:unknown,originalRequest:NativeDefinitionRequest,
 context:NativeDocumentTransactionContext,native:Record<string,unknown>,maxBytes:number,recovery?:boolean):NativeDocumentPreflightReceipt;
export interface NativeStageCompilationIntent {
 readonly basis:{readonly expression_ref:string;readonly document_revision:number;readonly scene_ref:string};
 readonly operation_ref:string;readonly source:unknown;readonly profile:unknown;
 readonly authored:unknown;readonly choice:unknown;readonly scope:unknown;
 readonly action:'prepare'|'regenerate';
}
export interface NativePendingStageCompilation {
 readonly schema:'ql.instrument-pending-stage-compilation/v1';
 readonly context:NativeDocumentTransactionContext;readonly operation_ref:string;
 readonly basis:NativeStageCompilationIntent['basis'];readonly attempts:number;readonly max_attempts:4;
 readonly reason:string;readonly standing:'original_native_compilation_unknown';
}
/** Opaque runtime custody token issued only by the actual NativeChannel result
 * handler. There is no public value-to-token constructor. */
export type NativeStageCompilationCompletion = unknown;
export function validateNativeStageCompilationOutcome(
 result:unknown,originalIntent:NativeStageCompilationIntent,retry:boolean,maxBytes:number
):NativeDocumentTransactionResult & Record<string,unknown>;
export interface NativePendingDocumentTransaction {
 readonly schema:'ql.instrument-pending-document-transaction/v1';
 readonly context:NativeDocumentTransactionContext;
 readonly attempts:number;readonly max_attempts:4;readonly reason:string;
 readonly standing:'original_selected_source_reply_unknown';
}
export interface NativeSelectedSceneSourceIntent {
 readonly selection: {readonly expression_ref:string;readonly document_revision:number;readonly scene_ref:string;readonly scene_revision:number};
 readonly lease:string; readonly actor:string;
}
export interface NativeSelectedSceneSourceRequest extends NativeSelectedSceneSourceIntent {
 readonly expected_request_id:string;readonly expected_generation:string;readonly expected_samples_elapsed:string;
}
export interface NativeSelectedSceneSourceRecoveryResult extends NativeDocumentTransactionResult {
 schema:'oi.native-expression-selected-scene-source/v1';
 original_request:NativeSelectedSceneSourceRequest;lease:string;
 recovered:true;replayed:false;recovery_current:true;recovery_currentness:null;
 native_ordered_receipt_pending:false;native_result:Record<string,unknown>;
 document_result:unknown;document_receipts:readonly unknown[];
}
export function validateSelectedSourceDocumentRecovery(
 result:unknown, originalRequest:NativeSelectedSceneSourceRequest,
 context:NativeDocumentTransactionContext, native:Record<string,unknown>, maxBytes:number
):NativeDocumentPreflightReceipt;
export interface NativeDocumentTransactionContext {
 readonly schema: 'ql.native-document-transaction/v1';
 readonly instance_ref: string;
 readonly event_ref: string;
 readonly subject_ref: string;
 readonly last_request_id: string;
 readonly next_request_id: string;
 readonly expected_generation: string;
 readonly expected_samples_elapsed: string;
}
export interface NativeDocumentPreflightReceipt {
 schema: 'ql.field-host-receipt/v1';
 instance_ref: string;
 request_id: string;
 last_request_id: string;
 available: true;
 status: 'ok' | 'refused';
 field: Record<string, unknown> & {event_ref:string;subject_ref:string;generation:string;samples_elapsed:string;audio:readonly []};
}
export interface NativeDocumentTransactionResult {
 native_procedural_receipts: readonly NativeDocumentPreflightReceipt[];
}
export interface NativePresentationPacketRef {
 readonly instance_ref: string;
 readonly request_id: string;
 readonly event_ref: string;
 readonly subject_ref: string;
 readonly generation: string;
 readonly samples_elapsed: string;
}
export interface NativePendingPresentation {
 readonly schema: 'ql.instrument-pending-presentation/v1';
 readonly packet_ref: NativePresentationPacketRef;
 readonly attempts: number;
 readonly max_attempts: number;
 readonly target_context_seconds: number;
 readonly reason: string;
}
export interface NativePresentationDelivery {
 readonly packet_ref: NativePresentationPacketRef;
 readonly status: 'field_binding_returned' | 'abandoned_by_explicit_hold';
 readonly attempts: number;
 readonly target_context_seconds: number;
}
export class InstrumentSession {
 constructor(options: any);
 readonly reading: any;
 start(periodMs?: number): void;
 hold(reason?: string): any;
 pump(): Promise<any>;
 present(): any;
 retryPresentation(): any;
 recover(reason: string): Promise<any>;
 operate(command: any): Promise<any>;
 performance(command:{operation:'performance-scene-prepare'|'performance-recording-begin'|'performance-save-cut';[key:string]:unknown}):Promise<{recording:any}>;
 performance(command:unknown):Promise<{performance:any;recording?:any}>;
 source(command:unknown):Promise<any>;
 procedure(request: Record<string, unknown>): Promise<Record<string, unknown>>;
 nativeDocumentTransaction<T extends NativeDocumentTransactionResult>(
  action: (context: NativeDocumentTransactionContext) => Promise<T>,
  selectedSourceIntent?:NativeSelectedSceneSourceIntent
 ): Promise<T>;
 recoverNativeDocumentTransaction<T extends NativeSelectedSceneSourceRecoveryResult>(
  action:(context:NativeDocumentTransactionContext,originalRequest:NativeSelectedSceneSourceRequest)=>Promise<T>
 ):Promise<T>;
 nativeStageCompilationTransaction<T extends NativeDocumentTransactionResult>(
  action:(context:NativeDocumentTransactionContext,originalIntent:NativeStageCompilationIntent)=>Promise<NativeStageCompilationCompletion>,
  originalIntent:NativeStageCompilationIntent
 ):Promise<T>;
 recoverNativeStageCompilation<T extends NativeDocumentTransactionResult>(
  action:(context:NativeDocumentTransactionContext,originalIntent:NativeStageCompilationIntent)=>Promise<NativeStageCompilationCompletion>
 ):Promise<T>;
 nativeDefinitionTransaction(
  action:(context:NativeDocumentTransactionContext,originalRequest:NativeDefinitionRequest)=>Promise<NativeDefinitionCompletion>,
  intent:NativeDefinitionIntent
 ):Promise<NativeDefinitionOutcome>;
 recoverNativeDefinitionTransaction(
  action:(context:NativeDocumentTransactionContext,originalRequest:NativeDefinitionRequest)=>Promise<NativeDefinitionCompletion>,
  context:NativeDocumentTransactionContext,originalRequest:NativeDefinitionRequest
 ):Promise<NativeDefinitionRecovery>;
 inspect(): Promise<any>;
 influence(): Promise<any>;
 readonly lastInfluence: any;
 personal(input?: any): Promise<any>;
 setMuted(muted: boolean): any;
 dispose(): void;
 physicalEdit(edit:unknown):Promise<{physical_edit:any;physical_cas:any}>;
 acousticEdit(configuration:unknown):Promise<{acoustic_edit:any;acoustic_cas:any}>;
 performance(command:{operation:'performance-continue-act'|'performance-playback'|'performance-edited-render';[key:string]:unknown}):Promise<{performance:any;recording:any}>;
}
