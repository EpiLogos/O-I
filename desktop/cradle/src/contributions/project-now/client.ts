import { receiving, type ReceivingPage } from "../../receiving/client";
import { nowReading } from "../../receiving/now";
import type { KernelTransportStatus } from "../../kernel/types";

/** ProjectCentral's handoff record is a bounded current-field relation. Its
 * foreign identities remain opaque unless their owning resolver discloses an
 * actual Surface, Encounter or file target. */
export interface ProjectNowItem {
  id:string; kind:string; subject:string; status:string; result:string; actor:string;
  schema?:"central.project-now.handoff/v1";
  run_ref?:string; session_ref?:string; focus_ref?:string; attributed_to?:string;
  source_refs?:string[]; evidence_refs?:string[]; preserve_refs?:string[];
  carried_from_days?:string[]; promoted_to?:string[];
}
export interface ProjectNowInspection {
  exists:boolean; active_items:ProjectNowItem[]; inactive_items:ProjectNowItem[]; day_records:string[]; human_scratch:unknown[]; open_questions:unknown[];
  project_root?:string; policy?:{schema?:string;carry_statuses?:string[];remove_statuses?:string[]}; boundaries?:string[]; [key:string]:unknown;
}
export async function inspectProjectNow(transport:KernelTransportStatus,project:string):Promise<ProjectNowInspection> {
  const reading=await nowReading<ProjectNowInspection>(transport,project,{kind:"project-inspect"});
  if(!Array.isArray(reading.active_items)||!reading.active_items.every(nowItem)||!Array.isArray(reading.inactive_items)||!reading.inactive_items.every(nowItem)||!Array.isArray(reading.day_records)||!reading.day_records.every(value=>typeof value==="string")||!Array.isArray(reading.human_scratch)||!Array.isArray(reading.open_questions))throw new Error("Central returned an invalid Project NOW inspection");
  return reading;
}
export async function inspectProjectInbox(transport:KernelTransportStatus,project:string):Promise<ReceivingPage> { return receiving<ReceivingPage>(transport,project,{kind:"list",limit:50}); }
function nowItem(value:unknown):value is ProjectNowItem {
  if(typeof value!=="object"||value===null)return false;
  const item=value as Record<string,unknown>;
  if(![item.id,item.kind,item.subject,item.status,item.result,item.actor].every(field=>typeof field==="string"))return false;
  return ["run_ref","session_ref","focus_ref","attributed_to"].every(key=>item[key]===undefined||typeof item[key]==="string")&&["source_refs","evidence_refs","preserve_refs","carried_from_days","promoted_to"].every(key=>item[key]===undefined||strings(item[key]));
}
function strings(value:unknown):value is string[] { return Array.isArray(value)&&value.every(item=>typeof item==="string"); }
