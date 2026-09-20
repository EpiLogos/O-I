import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";
import type {FactoryBuildView} from "./types";
/** The owner's developmental reads (queue cell 3): every payload is the
 * Factory CLI's own (`factory.project-reading/v1`,
 * `factory.workflow-unit-list-reading/v1`, …), carried verbatim. The state
 * path is the caller's disclosure — the desktop never invents one. */
export type DevelopmentRead = "project"|"journey"|"run"|"workflow-units"|"workflow-unit"|"execution-telemetry"|"commission-read";
export async function developmentRead<T=unknown>(transport:KernelTransportStatus,statePath:string,read:DevelopmentRead,subject?:string,project?:string):Promise<T> {
  const result=await kernelOp(transport,{op:"factory_development_read",project,state_path:statePath,read,subject});
  if(result.error || result.outcome?.result!=="factory_development_reading")throw new Error(result.error??"Factory development reading is unavailable");
  return result.outcome.data as T;
}
/** The whole SSSF attempt reading (`factory attempt read <state> <run-ref>`
 * → `factory.attempt-reading/v1`): legs, attempts, verifications and the
 * readable Return, carried verbatim after the kernel verifies its contract.
 * This is the Run-in-Expressions evidence leg — the desktop reads it, it
 * never manufactures one. */
export async function attemptRead<T=unknown>(transport:KernelTransportStatus,statePath:string,runRef:string):Promise<T> {
  const result=await kernelOp(transport,{op:"factory_attempt_read",state_path:statePath,run_ref:runRef});
  if(result.error || result.outcome?.result!=="factory_attempt_reading")throw new Error(result.error??"Factory attempt reading is unavailable");
  return result.outcome.data as T;
}

/** Workcell's own placement/status reading (`workcell status --json`). */
export interface WorkcellStatus {health:string;offers:number;providers:number;state_root:string;workcell_ref:string;ok?:boolean}
export async function workcellStatus(transport:KernelTransportStatus):Promise<WorkcellStatus> {
  const result=await kernelOp(transport,{op:"workcell_status_read"});
  if(result.error || result.outcome?.result!=="workcell_status_reading")throw new Error(result.error??"Workcell status is unavailable");
  return result.outcome.data as WorkcellStatus;
}

/** The host checks the contract shape before handing the payload over: the
 * kernel carries the owner's snapshot document (contract + provenance + view)
 * and the board renders the view inside it — or a bare view served directly.
 * One check for every desk consumer. */
export function buildViewOf(value:unknown):FactoryBuildView|undefined {
  const isView=(candidate:unknown):candidate is FactoryBuildView=>{
    const view=candidate as Partial<FactoryBuildView>|null;
    return !!view&&typeof view==="object"&&!!view.project&&typeof view.project.projectRef==="string"&&
      !!view.run&&typeof view.run.runRef==="string"&&Array.isArray(view.claims)&&Array.isArray(view.candidates)&&
      Array.isArray(view.humanRequests)&&Array.isArray(view.trajectories);
  };
  if(isView(value))return value;
  const document=value as {view?:unknown}|undefined;
  return isView(document?.view)?document.view:undefined;
}

/** The re-pinned build view (queue cell B): the owner CLI reads it as
 * `factory build snapshot <state> <project-ref> <run-ref>` — the old
 * `build discover`/`--binding` grammar is gone from the installed cut. The
 * payload is the owner's own (`factory.build-view/v1`), carried verbatim
 * after the kernel verifies its contract schemas. */
export async function buildSnapshot<T=unknown>(transport:KernelTransportStatus,statePath:string,projectRef:string,runRef:string,project?:string):Promise<T> {
  const result=await kernelOp(transport,{op:"factory_build_snapshot",project,state_path:statePath,project_ref:projectRef,run_ref:runRef});
  if(result.error || result.outcome?.result!=="factory_development_reading")throw new Error(result.error??"The Factory build view is unavailable");
  return result.outcome.data as T;
}
