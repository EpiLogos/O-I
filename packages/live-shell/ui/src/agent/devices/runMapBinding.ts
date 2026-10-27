// The Run map on its owner (lane W7; DLW §19.25, software-factory:run-map — "Kind: instrument · Chain: Factory's Main track"). It draws one
// Run of developmental work as Factory keeps it: the run reading's lifecycle and runMap (factory_development_read `run`,
// factory.run-reading/v1), the units' legs and barriers (factory_owner WorkflowInspect), the Journey and its Commission
// (factory_development_read `journey` and `commission-read`), the latest Return and its Recognition. Every one of those reads exists, and
// each takes the Run's state path and ref: the take lanes name a Run for each session's attempts (owners/attemptTakes.ts, through
// encounter_task_attempts_list and factory_attempt_read), but the Main track has no session, and the design no Run chooser — so no Run is
// named here and every reading of it stands absent with that reason (proposed to the design lane: a Run chooser on the device's head).
// The writes: Recognise (factory_owner Recognise) and Close (factory_owner RunClose) exist and take the Run's Journey, Return and
// Recognition, which no Run named here gives them. Retry is the attempt `retry` through factory_owner attempt-retry (lane K0;
// desktop/cradle/kernel/src/factory_retry.rs): it takes the Run and the unit you retry, and Factory decides — it retries only what its
// admission (`factory attempt admission`) admits from a desktop, under the host's grant, never one the desk names; given a Run
// (`RunMapRun`) and a carrier, Retry writes through it and Factory's refusal is the press's error. Continue is `factory development
// mutate` for ContinueCommission, which no kernel route carries yet (T-COVERAGE §1.2). The unit you read and Show are the shell's own
// holds. Pure, apart from the view holds.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'

export const RUN_MAP_DESIGN = 'software-factory:run-map'
export const RUN_MAP_ID = 'factory:main:run-map'

/** The Run map as a device of the runtime: Software Factory's `run-map` face, once the family admits it (softwareFactoryFamilyManifest.ts
 * does not yet: null until it does, and the Main track draws no plate for it). */
export const runMapDevice = (): DeviceInstance | null => familyFaceDevice(RUN_MAP_ID, 'software-factory', 'run-map', 'Run map', 'journey')

/** Why no Run is read here. */
export const NO_RUN = 'no Run is named on the Main track: the run reading (factory_development_read `run`), WorkflowInspect and the Journey reads each take a Run\'s state path and ref, the take lanes name one only for a session\'s attempts, and the Run map has no Run chooser'
/** Why a Run named here is not read yet: its readings are not wired to the Run map. */
export const RUN_NOT_READ = 'the Run map does not read the Run named to it yet: the run reading (factory_development_read `run`), WorkflowInspect and the Journey reads are not wired here'
const missing = (what: string, op: string) => `${what}: no owner operation carries it yet — missing op: ${op} (Software Factory).`

/** The Run's readings, each absent with why, and the acts, each disabled with what it takes and why it cannot have it. */
function reasons(why: string): {absent: Readonly<Record<string, string>>; refuse: Readonly<Record<string, string>>} {
  const unread = (what: string) => `${what}: no reading reaches it yet — ${why} (Software Factory).`
  return {
    absent: {
      light: unread('The Run map\'s light'),
      run: unread('The Run'),
      nodes: unread('The Run\'s units, barriers and decisions'),
      edges: unread('What each unit waits on'),
      ret: unread('The Run\'s latest Return'),
      recognition: unread('Your Recognition of it'),
      journey: unread('The Journey the Run belongs to'),
    },
    refuse: {
      recognise: `Recognise: factory_owner Recognise takes the Journey and the Return you recognise, and ${why}.`,
      close: `Close: factory_owner RunClose takes the Run and your Recognition of its Return, and ${why}.`,
      retry: `Retry: factory_owner attempt-retry (the attempt \`retry\` under the unit's retry grant) takes the Run and the unit you retry, and ${why}. Factory retries only what its admission admits from a desktop, under the host's grant, never one the desk names.`,
      continue: missing('Continue', '`factory development mutate` for ContinueCommission through the kernel (T-COVERAGE §1.2, Software Factory: "`development mutate` for ContinueCommission"; the kernel issues the mutation only for a Recognition)'),
    },
  }
}

/** The Run's readings, each absent with why (no Run named). */
export const RUN_MAP_ABSENT: Readonly<Record<string, string>> = reasons(NO_RUN).absent
/** The acts, each disabled with the operation it lacks (no Run named). */
export const RUN_MAP_REFUSE: Readonly<Record<string, string>> = reasons(NO_RUN).refuse

/** A Run named to the Run map: Factory's state path and Run ref, and the workflow unit each work node stands for (the run reading's
 * runMap nodes carry it as `semanticRef`, Factory's workflow.rs topology_command). Nothing names one on the Main track yet. */
export interface RunMapRun {
  readonly statePath: string
  readonly runRef: string
  readonly units: Readonly<Record<string, string>>
}
/** The Run map's owner writes: Factory's own requests through the kernel's factory_owner (ownerRoutes.ts factoryOwnerWrite), answering
 * Factory's document. Absent: no carrier stands. */
export interface RunMapPorts {
  readonly owner?: (request: {kind: string; [field: string]: unknown}) => Promise<unknown>
}
const NO_CARRIER = 'Retry: the kernel carrier is unavailable here, so Factory cannot be asked (factory_owner attempt-retry).'

/** Retry one unit of the named Run through factory_owner attempt-retry. Factory's answer (desktop/cradle/kernel/src/factory_retry.rs,
 * oi.factory-attempt-retry/v1) stands when it retried; its refusal, or the driver's own named as such, is thrown in its words. */
async function retryUnit(run: RunMapRun, owner: NonNullable<RunMapPorts['owner']>, value: Value | undefined): Promise<void> {
  const node = typeof value === 'string' ? value : ''
  const unit = run.units[node]
  if (!unit) throw Error(`Retry: Factory's run reading names no unit for ${node ? `the node ${node}` : 'the press'}; choose a unit of this Run.`)
  const answer = await owner({kind: 'attempt-retry', state_path: run.statePath, run_ref: run.runRef, workflow_unit_ref: unit}) as
    {status?: unknown; refusal?: {message?: unknown} | null} | null
  if (answer?.status === 'retried' || answer?.status === 'already-retried') return
  const words = typeof answer?.refusal?.message === 'string' ? answer.refusal.message : 'Factory answered no retry.'
  throw Error(answer?.status === 'uncertain' ? `Factory did not answer and may have run: ${words} Read the Run again before retrying.` : words)
}

/** The shell's own holds and the manual's starting value of Show (§19.25: All). */
export const RUN_MAP_VIEW: Readonly<Record<string, Value>> = {show: 'all'}
const RUN_MAP_LOCAL = ['unit', 'show'] as const

export function runMapValues(holds: ChainHolds): Values {
  const values: Record<string, Value> = {}
  const view = viewHolds(holds, RUN_MAP_ID)
  for (const key of RUN_MAP_LOCAL) { const held = view[key] ?? RUN_MAP_VIEW[key]; if (held !== undefined) values[key] = held }
  return values
}

/** The Run map's binding. With no Run (the Main track today) every act stands disabled naming what it takes; given a Run and a carrier,
 * Retry writes through factory_owner attempt-retry. */
export function runMapBinding(holds: ChainHolds, run: RunMapRun | null = null, ports: RunMapPorts = {}): DesignBinding {
  const standing: Record<string, Standing> = {}
  const {absent, refuse} = run ? reasons(RUN_NOT_READ) : {absent: RUN_MAP_ABSENT, refuse: RUN_MAP_REFUSE}
  for (const [key, why] of Object.entries(absent)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(refuse)) standing[key] = {disabled: why}
  const owner = ports.owner
  if (run) {
    if (owner) delete standing.retry
    else standing.retry = {disabled: NO_CARRIER}
  }
  return {
    id: RUN_MAP_ID,
    values: runMapValues(holds),
    standing,
    local: Object.fromEntries(RUN_MAP_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUN_MAP_ID, key, value)])),
    writes: key => key in RUN_MAP_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'retry' && run && owner) { await retryUnit(run, owner, value); continue }
        throw Error(standing[key]?.disabled ?? refuse[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
