// The Run map on its owner (lane W7; DLW §19.25, software-factory:run-map — "Kind: instrument · Chain: Factory's Main track"). It draws one
// Run of developmental work as Factory keeps it: the run reading's lifecycle and runMap (factory_development_read `run`,
// factory.run-reading/v1), the units' legs and barriers (factory_owner WorkflowInspect), the Journey and its Commission
// (factory_development_read `journey` and `commission-read`), the latest Return and its Recognition. Every one of those reads exists, and
// each takes the Run's state path and ref: the take lanes name a Run for each session's attempts (owners/attemptTakes.ts, through
// encounter_task_attempts_list and factory_attempt_read), but the Main track has no session, and the design no Run chooser — so no Run is
// named here and every reading of it stands absent with that reason (proposed to the design lane: a Run chooser on the device's head).
// The writes: Recognise (factory_owner Recognise) and Close (factory_owner RunClose) exist and take the Run's Journey, Return and
// Recognition, which no Run named here gives them; Retry is the attempt `retry` and Continue is `factory development mutate` for
// ContinueCommission — T-COVERAGE §1.2's Software Factory row names both, and no kernel route carries either yet. The unit you read and
// Show are the shell's own holds. Pure, apart from the view holds.
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
const unread = (what: string) => `${what}: no reading reaches it yet — ${NO_RUN} (Software Factory).`
const missing = (what: string, op: string) => `${what}: no owner operation carries it yet — missing op: ${op} (Software Factory).`

/** The Run's readings, each absent with why. */
export const RUN_MAP_ABSENT: Readonly<Record<string, string>> = {
  light: unread('The Run map\'s light'),
  run: unread('The Run'),
  nodes: unread('The Run\'s units, barriers and decisions'),
  edges: unread('What each unit waits on'),
  ret: unread('The Run\'s latest Return'),
  recognition: unread('Your Recognition of it'),
  journey: unread('The Journey the Run belongs to'),
}

/** The acts, each disabled with the operation it lacks. */
export const RUN_MAP_REFUSE: Readonly<Record<string, string>> = {
  recognise: `Recognise: factory_owner Recognise takes the Journey and the Return you recognise, and ${NO_RUN}.`,
  close: `Close: factory_owner RunClose takes the Run and your Recognition of its Return, and ${NO_RUN}.`,
  retry: missing('Retry', 'the attempt `retry` under the unit\'s RetryGrant through the kernel (T-COVERAGE §1.2, Software Factory: "the attempt `retry`"; not routed yet)'),
  continue: missing('Continue', '`factory development mutate` for ContinueCommission through the kernel (T-COVERAGE §1.2, Software Factory: "`development mutate` for ContinueCommission"; the kernel issues the mutation only for a Recognition)'),
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

export function runMapBinding(holds: ChainHolds): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const [key, why] of Object.entries(RUN_MAP_ABSENT)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(RUN_MAP_REFUSE)) standing[key] = {disabled: why}
  return {
    id: RUN_MAP_ID,
    values: runMapValues(holds),
    standing,
    local: Object.fromEntries(RUN_MAP_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUN_MAP_ID, key, value)])),
    writes: key => key in RUN_MAP_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key} of changes) throw Error(RUN_MAP_REFUSE[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
    },
  }
}
