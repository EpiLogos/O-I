/** Factory's public attempt/task read models, ported from the donor cut
 * (PR #292 `origin/cradle-factory-arrangement`). The contracts and the
 * validators below are the owner's own, carried verbatim — Factory, not the
 * desktop, owns these schemas.
 *
 * WIRED TO THE LIVE KERNEL: the two task-scoped attempt reads reach the
 * owner's own CLI through the kernel ops factory_attempt_task_list_read and
 * factory_attempt_task_read (desktop/cradle/kernel/src/lib.rs →
 * `factory attempt list|task`). The desktop carries state path, Run, task,
 * revision and cursor, validates the returned identity against the request,
 * and preserves the owner's failure semantics — it never manufactures a task
 * list, a reading, or a Factory state. */
import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";

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

/** Validates a retained or returned task-list response and binds it to the
 * exact Run it was requested for. */
export function isFactoryAttemptTaskListReading(value:unknown,runRef:string):value is FactoryAttemptTaskListReading {
  return isRecord(value)&&value.contract==="factory.attempt-task-list-reading/v1"&&value.runRef===runRef&&typeof value.projectRef==="string"&&isNonNegativeInteger(value.runRevision)&&strings(value.taskRefs)&&isNonNegativeInteger(value.totalTasks)&&value.totalTasks>=value.taskRefs.length&&(value.revision===undefined||isNonNegativeInteger(value.revision))&&(value.topologyRevision===undefined||isNonNegativeInteger(value.topologyRevision))&&(value.sourceCurrent===undefined||typeof value.sourceCurrent==="boolean");
}

// ---------------------------------------------------------------------------
// The owner reads, through the live kernel. Both carry the caller's state
// path/Run/task disclosure to the owner's own CLI and validate the returned
// identity before it reaches the desktop. A different Run or task, or an
// incompatible contract, refuses — it is never silently presented.
// ---------------------------------------------------------------------------

export async function listFactoryAttemptTasks(transport:KernelTransportStatus,{statePath,runRef}:{statePath:string;runRef:string}):Promise<FactoryAttemptTaskListReading> {
  const result=await kernelOp(transport,{op:"factory_attempt_task_list_read",state_path:statePath,run_ref:runRef});
  if(result.error||result.outcome?.result!=="factory_attempt_task_list_reading")throw new Error(result.error??"Factory attempt-task list reading is unavailable");
  const data=result.outcome.data;
  if(!isFactoryAttemptTaskListReading(data,runRef))throw new Error("Factory returned an attempt-task list for a different Run or an incompatible contract");
  return data;
}

export async function readFactoryAttemptTask(transport:KernelTransportStatus,{statePath,runRef,taskRef,limit,cursor}:{statePath:string;runRef:string;taskRef:string;limit?:number;cursor?:unknown}):Promise<FactoryAttemptTaskReading> {
  const result=await kernelOp(transport,{op:"factory_attempt_task_read",state_path:statePath,run_ref:runRef,task_ref:taskRef,limit,cursor});
  if(result.error||result.outcome?.result!=="factory_attempt_task_reading")throw new Error(result.error??"Factory attempt-task reading is unavailable");
  const data=result.outcome.data;
  if(!isFactoryAttemptTaskReading(data,runRef,taskRef))throw new Error("Factory returned an attempt-task reading for a different Run or task, or an incompatible contract");
  return data;
}
