/** Factory's public attempt/task read models, ported from the donor cut
 * (PR #292 `origin/cradle-factory-arrangement`). The contracts and the
 * validators below are the owner's own, carried verbatim — Factory, not the
 * desktop, owns these schemas.
 *
 * ADAPTED FOR THE LIVE KERNEL (desktop/cradle/kernel/src/factory.rs): the
 * donor reached these readings through two kernel ops this kernel cut does
 * NOT carry — `factory_attempt_task_list_read` and
 * `factory_attempt_task_read`. No native claim is invented in their place:
 * the read functions below refuse honestly, naming the missing ops, and the
 * handoff surface renders that refusal as its unavailable state. When the
 * kernel gains the ops, the bodies become kernelOp calls again and the
 * retained validators already hold the compatibility law. */

export interface FactoryReadableReturn {
  returnRef:string;
  summary:string;
  artifactRefs:string[];
  evidenceRefs:string[];
  receivingRef?:string;
  receivingSourceRevision?:string;
  archiveRefs:string[];
  regressionObservationRefs:string[];
}

export interface FactoryVerificationReceipt {
  verificationRef:string;
  ownerRef:string;
  sourceRevision:string;
  outcome:"passed"|"failed"|"unknown";
  obligations:string[];
  evidenceRefs:string[];
}

export interface FactoryOwnerTelemetryObservation {
  owner:"factory"|"central"|"actuation"|"aikit"|"workcell";
  ref:string;
  revision:string;
  standing:"observed"|"provider-reported"|"normalized-from-native"|"derived"|"estimated";
}

export interface FactoryOwnerTelemetryLink {
  owner:"actuation"|"workcell";
  availability:"available"|"unavailable"|"unsupported";
  observations:FactoryOwnerTelemetryObservation[];
  reason?:string;
}

/** Exact public Factory execution-correlation fields retained on an attempt.
 * Usage payloads remain with their Actuation or Workcell owner; this reading
 * exposes the validated observation identity and availability only. */
export interface FactoryOwnerTelemetryCorrelation {
  correlationRef:string;
  telemetryRef:string;
  runRef:string;
  workflowUnitRef:string;
  executionRef:string;
  agencyRef:string;
  modelUsage:FactoryOwnerTelemetryLink;
  materialUsage:FactoryOwnerTelemetryLink;
}

/** All other `FactoryAttemptRecord` fields remain opaque because Factory, not
 * the desktop, owns their schemas. The public verification and telemetry
 * records are typed because their exact individual fields are disclosed. */
export interface FactoryAttemptRecord {
  attemptRef:string;
  taskRef:string;
  workflowUnitRef:string;
  reservedExecutionRef:string;
  executionRef?:string;
  disposition:unknown;
  dispatch?:unknown;
  observations:unknown[];
  verifications:FactoryVerificationReceipt[];
  tracking:unknown[];
  reresolutions:unknown[];
  failureEvidenceRefs:string[];
  readableReturn?:FactoryReadableReturn;
}

export interface FactoryAttemptTaskView {
  standing:"current-attempt"|"historical-attempt";
  status:string|null;
  record:FactoryAttemptRecord;
  unresolvedOwnerOperations:Array<{ownerRef:string;operationRef:string;receiptRef:string}>;
  ownerTelemetryCorrelations:FactoryOwnerTelemetryCorrelation[];
  modelUsageStatus:"owner-observed"|"not-observed";
  materialUsageStatus:"owner-observed"|"not-observed";
  regressionObservationRefs:string[];
  receivingStanding:string;
  archiveStanding:string;
}

export interface FactoryAttemptTaskReading {
  contract:"factory.attempt-task-reading/v1";
  projectRef:string;
  runRef:string;
  taskRef:string;
  revision:number;
  runRevision:number;
  topologyRevision:number;
  sourceCurrent:boolean;
  workflowSourceRef:string;
  workflowSourceRevision:string;
  workflowSourceDigest:string;
  totalAttempts:number;
  attempts:FactoryAttemptTaskView[];
  nextCursor?:unknown;
}

export interface FactoryAttemptTaskListReading {
  contract:"factory.attempt-task-list-reading/v1";
  projectRef:string;
  runRef:string;
  runRevision:number;
  revision?:number;
  topologyRevision?:number;
  sourceCurrent?:boolean;
  taskRefs:string[];
  totalTasks:number;
}

const isRecord=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(item=>typeof item==="string");
const isOneOf=<T extends string>(value:unknown,values:readonly T[]):value is T=>typeof value==="string"&&values.includes(value as T);
const isNonNegativeInteger=(value:unknown):value is number=>typeof value==="number"&&Number.isInteger(value)&&value>=0;

function readableReturn(value:unknown):value is FactoryReadableReturn {
  return isRecord(value)&&typeof value.returnRef==="string"&&typeof value.summary==="string"&&strings(value.artifactRefs)&&strings(value.evidenceRefs)&&strings(value.archiveRefs)&&strings(value.regressionObservationRefs)&&(value.receivingRef===undefined||typeof value.receivingRef==="string")&&(value.receivingSourceRevision===undefined||typeof value.receivingSourceRevision==="string");
}

function verification(value:unknown):value is FactoryVerificationReceipt {
  return isRecord(value)&&typeof value.verificationRef==="string"&&typeof value.ownerRef==="string"&&typeof value.sourceRevision==="string"&&isOneOf(value.outcome,["passed","failed","unknown"] as const)&&strings(value.obligations)&&strings(value.evidenceRefs);
}

function telemetryObservation(value:unknown):value is FactoryOwnerTelemetryObservation {
  return isRecord(value)&&isOneOf(value.owner,["factory","central","actuation","aikit","workcell"] as const)&&typeof value.ref==="string"&&typeof value.revision==="string"&&isOneOf(value.standing,["observed","provider-reported","normalized-from-native","derived","estimated"] as const);
}

function telemetryLink(value:unknown):value is FactoryOwnerTelemetryLink {
  return isRecord(value)&&isOneOf(value.owner,["actuation","workcell"] as const)&&isOneOf(value.availability,["available","unavailable","unsupported"] as const)&&Array.isArray(value.observations)&&value.observations.every(telemetryObservation)&&(value.reason===undefined||typeof value.reason==="string");
}

function telemetryCorrelation(value:unknown):value is FactoryOwnerTelemetryCorrelation {
  return isRecord(value)&&[value.correlationRef,value.telemetryRef,value.runRef,value.workflowUnitRef,value.executionRef,value.agencyRef].every(item=>typeof item==="string")&&telemetryLink(value.modelUsage)&&telemetryLink(value.materialUsage);
}

function attemptView(value:unknown):value is FactoryAttemptTaskView {
  if(!isRecord(value)||!isRecord(value.record))return false;
  const record=value.record;
  return isOneOf(value.standing,["current-attempt","historical-attempt"] as const)&&(typeof value.status==="string"||value.status===null)&&[record.attemptRef,record.taskRef,record.workflowUnitRef,record.reservedExecutionRef].every(item=>typeof item==="string")&&(record.executionRef===undefined||typeof record.executionRef==="string")&&Array.isArray(record.observations)&&Array.isArray(record.tracking)&&Array.isArray(record.reresolutions)&&Array.isArray(record.verifications)&&record.verifications.every(verification)&&strings(record.failureEvidenceRefs)&&(record.readableReturn===undefined||readableReturn(record.readableReturn))&&Array.isArray(value.unresolvedOwnerOperations)&&value.unresolvedOwnerOperations.every(item=>isRecord(item)&&typeof item.ownerRef==="string"&&typeof item.operationRef==="string"&&typeof item.receiptRef==="string")&&Array.isArray(value.ownerTelemetryCorrelations)&&value.ownerTelemetryCorrelations.every(telemetryCorrelation)&&isOneOf(value.modelUsageStatus,["owner-observed","not-observed"] as const)&&isOneOf(value.materialUsageStatus,["owner-observed","not-observed"] as const)&&strings(value.regressionObservationRefs)&&typeof value.receivingStanding==="string"&&typeof value.archiveStanding==="string";
}

/** Validates a retained task response before a presentation snapshot reuses it. */
export function isFactoryAttemptTaskReading(value:unknown,runRef:string,taskRef:string):value is FactoryAttemptTaskReading {
  return isRecord(value)&&value.contract==="factory.attempt-task-reading/v1"&&value.runRef===runRef&&value.taskRef===taskRef&&typeof value.projectRef==="string"&&isNonNegativeInteger(value.revision)&&isNonNegativeInteger(value.runRevision)&&isNonNegativeInteger(value.topologyRevision)&&typeof value.sourceCurrent==="boolean"&&typeof value.workflowSourceRef==="string"&&typeof value.workflowSourceRevision==="string"&&typeof value.workflowSourceDigest==="string"&&isNonNegativeInteger(value.totalAttempts)&&Array.isArray(value.attempts)&&value.attempts.every(attemptView)&&value.totalAttempts>=value.attempts.length;
}

// ---------------------------------------------------------------------------
// The owner reads. The donor kernel carried two dedicated ops for these; the
// live kernel does not. The refusal names them rather than faking a reading.
// ---------------------------------------------------------------------------

/** The kernel op spellings the donor used; recorded so the gap (and its
 * future wiring) stays nameable from every consumer. */
export const FACTORY_ATTEMPT_TASK_LIST_OP = "factory_attempt_task_list_read";
export const FACTORY_ATTEMPT_TASK_READ_OP = "factory_attempt_task_read";

export function attemptTaskReadsUnavailable():string {
  return `Owner attempt-task reads are unavailable on this kernel cut: the kernel carries neither ${FACTORY_ATTEMPT_TASK_LIST_OP} nor ${FACTORY_ATTEMPT_TASK_READ_OP} (desktop/cradle/kernel/src/factory.rs). No attempt or task list is invented in their place.`;
}

export async function listFactoryAttemptTasks():Promise<FactoryAttemptTaskListReading> {
  throw new Error(attemptTaskReadsUnavailable());
}

export async function readFactoryAttemptTask():Promise<FactoryAttemptTaskReading> {
  throw new Error(attemptTaskReadsUnavailable());
}
