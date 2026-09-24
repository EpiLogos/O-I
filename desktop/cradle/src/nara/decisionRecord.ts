/** A speech decision is not an effect. Its exact adjudicator attribution must
 * reach the kernel record before a caller dispatches the authorised action. */
import type {KernelOp,KernelOutcome} from "../kernel/types";
import type {SpeechToolDecision} from "./session";
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  if(value && typeof value==="object")return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value)??"null";
}
export function requireRecordedDecision(result:KernelOutcome|null,decision:SpeechToolDecision):void {
  if(!result || result.result!=="nara_decision_recorded")throw new Error("The tool decision was not recorded. No action was dispatched.");
  if(canonical(result.decision)!==canonical(decision))throw new Error("The recorded tool decision differs from the adjudicated decision. No action was dispatched.");
}
export async function recordToolDecision(apply:(op:KernelOp)=>Promise<KernelOutcome|null>,decision:SpeechToolDecision,lastError?:()=>string|null):Promise<void> {
  const result=await apply({op:"nara_decision_record",decision});
  if(!result && lastError?.())throw new Error(`The tool decision was not recorded: ${lastError()}. No action was dispatched.`);
  requireRecordedDecision(result,decision);
}
