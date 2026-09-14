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

/** All `FactoryAttemptRecord` fields are preserved. Nested native records stay
 * opaque here because Factory, not the desktop, owns their schemas. */
export interface FactoryAttemptRecord {
  attemptRef:string;
  taskRef:string;
  workflowUnitRef:string;
  reservedExecutionRef:string;
  executionRef?:string;
  disposition:unknown;
  dispatch?:unknown;
  observations:unknown[];
  verifications:unknown[];
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
  ownerTelemetryCorrelations:unknown[];
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

export async function listFactoryAttemptTasks(transport:KernelTransportStatus,statePath:string,runRef:string):Promise<FactoryAttemptTaskListReading> {
  const result=await kernelOp(transport,{op:"factory_attempt_task_list_read",state_path:statePath,run_ref:runRef});
  if(result.error||result.outcome?.result!=="factory_attempt_task_list_reading") throw new Error(result.error??"Factory attempt task list is unavailable");
  const value=result.outcome.data as Partial<FactoryAttemptTaskListReading>;
  if(value.contract!=="factory.attempt-task-list-reading/v1"||value.runRef!==runRef||typeof value.projectRef!=="string"||!Array.isArray(value.taskRefs)||value.totalTasks!==value.taskRefs.length) throw new Error("Factory returned an incompatible attempt task list");
  return value as FactoryAttemptTaskListReading;
}

export async function readFactoryAttemptTask(transport:KernelTransportStatus,statePath:string,runRef:string,taskRef:string):Promise<FactoryAttemptTaskReading> {
  const result=await kernelOp(transport,{op:"factory_attempt_task_read",state_path:statePath,run_ref:runRef,task_ref:taskRef});
  if(result.error||result.outcome?.result!=="factory_attempt_task_reading") throw new Error(result.error??"Factory attempt task reading is unavailable");
  const value=result.outcome.data as Partial<FactoryAttemptTaskReading>;
  if(value.contract!=="factory.attempt-task-reading/v1"||value.runRef!==runRef||value.taskRef!==taskRef||!Array.isArray(value.attempts)) throw new Error("Factory returned an incompatible task reading");
  return value as FactoryAttemptTaskReading;
}
