import type {NativeModelOption} from "../../encounter/nativeModel";

interface RosterEntry {model:string;provider:string;variant:string;explanation:{eligible:boolean;failed_gates:string[]}}
interface RouteFact {model:string;provider:string;variant:string;harness?:string|null;availability:{state:string}}
export interface ModelRosterReading {schema:"aikit.model-roster-reading/v1";roster:{entries:RosterEntry[]};route_facts:RouteFact[]}
export function readModelRoster(value:unknown):ModelRosterReading|undefined {
 const row=value as ModelRosterReading|undefined;
 if(row?.schema!=="aikit.model-roster-reading/v1"||!Array.isArray(row.roster?.entries)||!Array.isArray(row.route_facts))return undefined;
 if(!row.roster.entries.every(entry=>typeof entry?.model==="string"&&typeof entry.provider==="string"&&typeof entry.variant==="string"&&typeof entry.explanation?.eligible==="boolean"&&Array.isArray(entry.explanation.failed_gates)&&entry.explanation.failed_gates.every(gate=>typeof gate==="string")))return undefined;
 if(!row.route_facts.every(route=>typeof route?.model==="string"&&typeof route.provider==="string"&&typeof route.variant==="string"&&typeof route.availability?.state==="string"))return undefined;
 return row;
}
const GATE_WORDS:Record<string,string>={available:"Route not observed",authorised:"Excluded by the model owner","provider-usable":"Credential or provider unavailable","policy-allowed":"Excluded by policy","contract-compatible":"Contract not supported","harness-compatible":"Harness does not support this provider"};
/** An exact native join only. The verdict informs; it never grants or
 * removes the session selector's separately observed authority. */
export function modelRosterReason(option:NativeModelOption,reading:ModelRosterReading|undefined):string|undefined {
 const identity=option.rosterIdentity;
 if(!reading||!identity?.harness_slug)return undefined;
 const routes=reading.route_facts.filter(route=>route.provider===identity.provider_ref&&route.variant===identity.provider_native_id&&route.harness===identity.harness_slug);
 if(routes.length!==1)return undefined;
 const route=routes[0];
 if(route.availability.state!=="observed")return "Project route has not been observed.";
 const entries=reading.roster.entries.filter(entry=>entry.model===route.model&&entry.provider===route.provider&&entry.variant===route.variant);
 if(entries.length!==1)return undefined;
 const explanation=entries[0].explanation;
 if(explanation.eligible)return "Eligible in this project's model roster.";
 return explanation.failed_gates.map(gate=>GATE_WORDS[gate]??gate.replace(/[_-]/g," ")).join(" · ")||"Not eligible in this project's model roster.";
}
