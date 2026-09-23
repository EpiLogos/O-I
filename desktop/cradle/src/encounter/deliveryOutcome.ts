/** A transport failure is not evidence that an addressed effect was refused.
 * These helpers are used by the canonical production session, not test mocks. */
export function unknownDispatch(ref: string, error: unknown) {
 return {kind:"unknown" as const,ref,error:`Outcome unknown; inspect the original delivery without replay. ${String(error)}`};
}
/** The owner's own pre-effect admission refusals (ai-kit encounter_agency.rs:
 * preflight_addressed, native_admission, send_group). Each is answered before
 * any delivery is reserved or any transport effect exists, so it IS evidence
 * that this turn was refused — and the owner's code is shown verbatim. The
 * kernel carries it as `message [code]`. Any other failure (transport loss,
 * storage, runtime, an uncoded or unlisted code) stays unknown. */
const ADMISSION_REFUSALS=new Set(["encounter.agency_required","encounter.binding_changed","encounter.disclosure_denied","encounter.group_audience","encounter.delivery_conflict","encounter.participant_withdrawn","encounter.agency_changed","encounter.action_denied"]);
export function admissionRefusal(error: unknown): string|undefined {
 const code=/\[(encounter\.[a-z_]+)\]\s*$/.exec(String(error))?.[1];
 return code&&ADMISSION_REFUSALS.has(code)?code:undefined;
}
/** A failed send: the owner's admission refusal is `refused`; everything else is `unknown`. */
export function failedDispatch(ref: string, error: unknown) {
 return admissionRefusal(error)?{kind:"refused" as const,ref,error:String(error)}:unknownDispatch(ref,error);
}
export function settledPhase(phase: string): boolean {
 return ["returned","failed","cancelled","reconciled-no-replay"].includes(phase);
}
export function mayStartDispatch(state: {kind:string}, group?: {rows:{phase?:string}[]}): boolean {
 return !["running","unknown"].includes(state.kind) && !group?.rows.some(row=>row.phase!==undefined&&!settledPhase(row.phase));
}
