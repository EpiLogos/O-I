/** A transport failure is not evidence that an addressed effect was refused.
 * These helpers are used by the canonical production session, not test mocks. */
export function unknownDispatch(ref: string, error: unknown) {
 return {kind:"unknown" as const,ref,error:`Outcome unknown; inspect the original delivery without replay. ${String(error)}`};
}
export function settledPhase(phase: string): boolean {
 return ["returned","failed","cancelled","reconciled-no-replay"].includes(phase);
}
export function mayStartDispatch(state: {kind:string}, group?: {rows:{phase?:string}[]}): boolean {
 return !["running","unknown"].includes(state.kind) && !group?.rows.some(row=>row.phase!==undefined&&!settledPhase(row.phase));
}
