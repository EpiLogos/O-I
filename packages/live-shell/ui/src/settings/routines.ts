/** AIKit native authoring receipts remain opaque, owner-validated documents.
 * The fields match aikit routine create/enable; no proof is minted in the UI. */
export interface RoutineProof extends Readonly<Record<string, unknown>> { proof_ref: string; method: string; method_revision: string }
export interface RoutineAuthority extends Readonly<Record<string, unknown>> { authority_ref: string; granted: boolean; unattended: boolean; action_refs: readonly string[] }
export type RoutineTriggerDocument = {kind:'manual'} | {kind:'event';event_ref:string} | {kind:'external';trigger_ref:string} | {schema:'aikit.time-schedule/v1';schedule_ref:string;schedule:Readonly<Record<string,unknown>>;[key:string]:unknown}
export interface RoutineAuthoringOptions {
  proofs: {title:string;document:RoutineProof}[]
  authorities: {title:string;document:RoutineAuthority}[]
  /** Existing owner-validated schedules and admitted event/External producers. */
  triggers: {title:string;document:RoutineTriggerDocument}[]
  profiles: {title:string;ref:string}[]
  contextScopes: {title:string;ref:string}[]
  timePolicy?: {timezone:string;revision:string}
}
export type ScheduleShape = {kind:'daily';time:string}|{kind:'cron';expression:string}|{kind:'every';interval_ms:number}|{kind:'once';rfc3339:string}
export function scheduleFromInput(kind:ScheduleShape['kind'],raw:string):ScheduleShape {
  if(kind==='daily'){if(!/^\d{2}:\d{2}$/.test(raw)||Number(raw.slice(0,2))>23||Number(raw.slice(3))>59)throw new Error('Enter a 24-hour time from 00:00 to 23:59.');return {kind,time:raw}}
  if(kind==='cron'){if(raw.trim().split(/\s+/).length!==5)throw new Error('Use five cron fields: minute, hour, day, month and weekday.');return {kind,expression:raw.trim()}}
  if(kind==='every'){const parts=raw.split('.'),fraction=(parts[1]??'').replace(/0+$/,'');const ms=Number(parts[0])*1000+Number(fraction.padEnd(3,'0'));if(!/^\d+(?:\.\d+)?$/.test(raw)||fraction.length>3||!Number.isSafeInteger(ms)||ms<1)throw new Error('Enter a positive interval in seconds, with at most millisecond precision.');return {kind,interval_ms:ms}}
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)||Number(raw.slice(11,13))>23||!Number.isFinite(Date.parse(raw)))throw new Error('Enter an RFC 3339 timestamp with an explicit offset or Z and an hour from 00 to 23.');
  const year=Number(raw.slice(0,4)),month=Number(raw.slice(5,7)),day=Number(raw.slice(8,10)),days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1]
  if(month<1||month>12||day<1||day>days)throw new Error('The timestamp contains an invalid calendar date.')
  return {kind,rfc3339:raw}
}
export interface RoutineCreateInput {
  name:string;description:string;method:string;proof:RoutineProof;trigger:RoutineTriggerDocument
  authority:RoutineAuthority;agent_profile:string|null;context_scope:string[]
}
export interface RoutineAuthoringResult {status:'acknowledged'|'pending'|'refused'|'failed';message:string;routine_ref?:string}
export interface RoutineAuthoringSource {
  options(method:string,project?:string):Promise<RoutineAuthoringOptions>
  create(input:RoutineCreateInput,project?:string):Promise<RoutineAuthoringResult>
  /** Resolve a submitted operation without submitting it again. Bind only when
   * the native owner has a recoverable pending receipt; otherwise await the
   * synchronous CLI result before reporting a terminal outcome. */
  readResult?(pending:RoutineAuthoringResult,project?:string):Promise<RoutineAuthoringResult>
  enable(routine_ref:string,authority:RoutineAuthority,project?:string):Promise<RoutineAuthoringResult>
  /** Validate with AIKit/Central and allocate the native ScheduleRecord identity.
   * Preparation does not persist or enable a Routine. Create must recheck policy. */
  prepareSchedule?(shape:ScheduleShape,project?:string):Promise<Extract<RoutineTriggerDocument,{schema:string}>>
  reprove?(routine_ref:string,proof:RoutineProof,project?:string):Promise<RoutineAuthoringResult>
}
export function eligibleProofs(options:RoutineAuthoringOptions,method:string,revision?:string) {
  return options.proofs.filter(proof=>proof.document.method===method&&(!revision||proof.document.method_revision===revision))
}
export function authorityAllowsTrigger(authority:RoutineAuthority,trigger:RoutineTriggerDocument):boolean {
  return authority.granted&&('kind' in trigger&&trigger.kind==='manual'||authority.unattended)
}
/** Derived occurrence windows change on every read; they are not an edit basis. */
export function routineBasis(value:unknown):string {
  const row=value&&typeof value==='object'?value as Record<string,unknown>:{}
  return JSON.stringify([row.routine,row.revision,row.method,row.method_revision,row.state,row.trigger,row.proof,row.authority,row.scheduler])
}
