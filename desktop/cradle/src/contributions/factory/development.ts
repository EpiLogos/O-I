import {kernelOp} from "../../kernel/bridge";
import type {KernelTransportStatus} from "../../kernel/types";
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
/** Workcell's own placement/status reading (`workcell status --json`). */
export interface WorkcellStatus {health:string;offers:number;providers:number;state_root:string;workcell_ref:string;ok?:boolean}
export async function workcellStatus(transport:KernelTransportStatus):Promise<WorkcellStatus> {
  const result=await kernelOp(transport,{op:"workcell_status_read"});
  if(result.error || result.outcome?.result!=="workcell_status_reading")throw new Error(result.error??"Workcell status is unavailable");
  return result.outcome.data as WorkcellStatus;
}
