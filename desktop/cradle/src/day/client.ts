import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
/** Central's own Day reading (`central.day.read`), carried verbatim. The
 * Day's source identity inside it is the owner's disclosure — the only ref
 * the desktop opens a Day document by. */
export interface DayReading {
  schema: "central.day-reading/v1";
  day_ref: string;
  source: {ref: string; path: string; roles?: string[]; treatment?: string; agent_retrieval_allowed?: boolean};
  revision: {revision: string};
  content: string;
  temporal: {day_ref: string; civil_date: string; lifecycle?: string} & Record<string, unknown>;
  today?: {day_ref: string; civil_date: string};
}
export async function dayRead(transport:KernelTransportStatus,dayRef?:string):Promise<DayReading> {
  const result=await kernelOp(transport,{op:"day_read",...(dayRef?{day_ref:dayRef}:{})});
  if(result.error || result.outcome?.result!=="day_reading")throw new Error(result.error??"Central's Day reading is unavailable");
  return result.outcome.data as DayReading;
}
