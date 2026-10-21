/** The Ta-Onta procedural stage as the frame announces it to its host (DLW §21.2 the Torus's Stage page; lane W4-Technē): the scoped
 * disclosure the native field last read (native-field/controller.ts stageState → ql.stage-state/v1, kept on its reading as
 * `instrument.stage`, with `stage_stale` once a determinant landed after it): each owned slot's owner and revision, and each procedure
 * bound to the flow with its trigger, its evaluations and its standing — the same rows the Studio's Procedural stage block draws
 * (nativeField.ts renderStage). The frame announces what it last read; it reads nothing for the announcement.
 *
 * Pure: no DOM. The frame builds (app.ts announceHostState), the host boundary reads (protocol.ts readHostedState → readFrameStage). */

/** The stage's four owned slots (nativeField.ts STAGE_SLOTS; ql-mef continuous/stage.rs). */
export const STAGE_SLOT_NAMES = ['form', 'material.damping', 'clock.inscription', 'clock.lensing'] as const
export interface FrameStageSlot {slot: string; owner?: string; revision?: number}
export interface FrameStageBinding {procedure: string; revision?: number; trigger: string; evaluations: number; max: number; standing: string}
export interface FrameStageReading {
  subject?: string; generation?: number
  /** A determinant landed after the disclosure: the field's next human-cadence refresh re-reads it (controller.ts stageStale). */
  stale: boolean
  slots: FrameStageSlot[]; bindings: FrameStageBinding[]
}

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max = 512): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** The disclosure the native field holds, as the announcement carries it; undefined while it has read none. */
export function stageReadingOf(stage: unknown, stale: unknown): FrameStageReading | undefined {
  if (!plain(stage)) return undefined
  const held = plain(stage.slots) ? stage.slots : {}
  const slots = STAGE_SLOT_NAMES.map((slot): FrameStageSlot => {
    const row = held[slot]
    return {slot, ...(plain(row) && text(row.owner) ? {owner: row.owner} : {}), ...(plain(row) && count(row.revision) ? {revision: row.revision} : {})}
  })
  const bindings = (Array.isArray(stage.bindings) ? stage.bindings : []).slice(0, 64).flatMap((row): FrameStageBinding[] => {
    if (!plain(row) || !text(row.procedure_ref) || !count(row.evaluations) || !count(row.max_evaluations) || !text(row.standing, 64)) return []
    return [{procedure: row.procedure_ref, ...(count(row.revision) ? {revision: row.revision} : {}), trigger: text(row.determinant, 64) ? row.determinant : 'invocation',
      evaluations: row.evaluations, max: row.max_evaluations, standing: row.standing}]
  })
  return {...(text(stage.subject_ref) ? {subject: stage.subject_ref} : {}), ...(count(stage.generation) ? {generation: stage.generation} : {}), stale: stale === true, slots, bindings}
}

/** The disclosure as the frame announced it, exact or refused (null). */
export function readFrameStage(raw: unknown): FrameStageReading | null {
  if (!plain(raw) || !Object.keys(raw).every(key => ['subject', 'generation', 'stale', 'slots', 'bindings'].includes(key))) return null
  if (raw.subject !== undefined && !text(raw.subject) || raw.generation !== undefined && !count(raw.generation) || typeof raw.stale !== 'boolean') return null
  if (!Array.isArray(raw.slots) || raw.slots.length > 16 || !Array.isArray(raw.bindings) || raw.bindings.length > 64) return null
  for (const slot of raw.slots) {
    if (!plain(slot) || !Object.keys(slot).every(key => ['slot', 'owner', 'revision'].includes(key)) || !text(slot.slot, 64)) return null
    if (slot.owner !== undefined && !text(slot.owner) || slot.revision !== undefined && !count(slot.revision)) return null
  }
  for (const binding of raw.bindings) {
    if (!plain(binding) || !Object.keys(binding).every(key => ['procedure', 'revision', 'trigger', 'evaluations', 'max', 'standing'].includes(key))) return null
    if (!text(binding.procedure) || binding.revision !== undefined && !count(binding.revision) || !text(binding.trigger, 64) || !count(binding.evaluations) || !count(binding.max) || !text(binding.standing, 64)) return null
  }
  return raw as unknown as FrameStageReading
}
