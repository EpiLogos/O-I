// The Run map on its owner (lane W7; DLW §19.25, software-factory:run-map — "Kind: instrument · Chain: Factory's Main track"). It draws one
// Run of developmental work as Factory keeps it: the run reading's lifecycle and runMap (factory_development_read `run`,
// factory.run-reading/v1), the units' legs and barriers (factory_owner WorkflowInspect), the Journey and its Commission
// (factory_development_read `journey` and `commission-read`), the latest Return and its Recognition. Every one of those reads exists, and
// each takes the Run's state path and ref. "Run map shows the run of the selected work" (§19.25 To use, 1): the Run the selected
// session's newest take names (owners/attemptTakes.ts, through encounter_task_attempts_list and factory_attempt_read). Its chain is read
// by runJourney.ts (the Run, its Journey, the Journey's Runs: the work across runs and the sessions that ran them, O-I 844), and drawn
// here: the run, its map's nodes and lines, the Journey with this run's place in it, the latest Return of this run and your Recognition
// of it. Each unit's leg (its status and how many attempts Factory keeps) and each barrier's units still out are WorkflowInspect's, read
// beside the Run (runJourney.ts readRunInspection, O-I 745) and joined to the map's nodes by their workflow unit; where Factory refuses the
// inspection the map is drawn without them and Retry says why. A unit's custody and its retry grant's count are in neither reading, and
// are not given. No session selected, or one with no take, names no Run, and every reading stands absent with that reason.
// The writes: Recognise (factory_owner Recognise) and Close (factory_owner RunClose) exist and take the Run's Journey, Return and
// Recognition; they stand in Approvals (§19.25 Whole), so here they say so once the Run is read. Retry is the attempt `retry` through factory_owner attempt-retry (lane K0;
// desktop/cradle/kernel/src/factory_retry.rs): it takes the Run and the unit you retry, and Factory decides — it retries only what its
// admission (`factory attempt admission`) admits from a desktop, under the host's grant, never one the desk names; given a Run
// (`RunMapRun`) and a carrier, Retry writes through it and Factory's refusal is the press's error. Continue is `factory development
// mutate` for ContinueCommission, which no kernel route carries yet (T-COVERAGE §1.2). The unit you read and Show are the shell's own
// holds. Pure, apart from the view holds.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {journeyOf, type RunJourneyRead} from './runJourney'

export const RUN_MAP_DESIGN = 'software-factory:run-map'
export const RUN_MAP_ID = 'factory:main:run-map'

/** The Run map as a device of the runtime: Software Factory's `run-map` face, once the family admits it (softwareFactoryFamilyManifest.ts
 * does not yet: null until it does, and the Main track draws no plate for it). */
export const runMapDevice = (): DeviceInstance | null => familyFaceDevice(RUN_MAP_ID, 'software-factory', 'run-map', 'Run map', 'journey')

/** Why no Run is read here. */
export const NO_RUN = 'no Run is named on the Main track: the run reading (factory_development_read `run`), WorkflowInspect and the Journey reads each take a Run\'s state path and ref, the take lanes name one only for a session\'s attempts, and the Run map has no Run chooser'
/** Why a Run named here is not read yet: its readings are not wired to the Run map. */
export const RUN_NOT_READ = 'the Run named to the Run map is not read here: no chain of it (factory_development_read `run`, then `journey`) is handed to the map'
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

/** The named Run's chain as the window holds it (runJourney.ts useRunJourney): reading, Factory's answer, or its refusal in its words. */
export interface RunMapRead {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value: RunJourneyRead | null
  readonly error: string | null
}
/** Why the named Run's readings are not drawn yet, while Factory reads them. */
export const RUN_READING = 'Factory has not answered yet (factory_development_read `run`, then `journey`)'
/** Why a reading of a Run Factory answered for stands absent: its reading does not carry it. */
export const RUN_LACKS = 'Factory\'s reading of this Run does not carry it'
/** Why Recognise and Close are not pressed here once the Run is read (§19.25 Whole: "Recognise, Close and Continue stand in Approvals"). */
export const RUN_IN_APPROVALS = 'it is given in Approvals (§19.14), where you read the return first; the Run map reads only the return and whether you recognised it'
/** Why Retry cannot be pressed on a Run whose inspection was not asked: no unit's leg is known. */
export const NO_INSPECT = 'Retry: the units\' legs were not read with this Run (factory_owner workflow-inspect), so no unit is known to have failed or gone quiet (Software Factory).'
/** Why Retry cannot be pressed on a Run whose inspection Factory refused, in its words. */
export const inspectRefused = (words: string) => `Retry: Factory did not read this Run's units (factory_owner workflow-inspect), so no unit is known to have failed or gone quiet: ${words}`
export const NO_RETURN = 'The Run\'s latest Return: Factory\'s Journey names no Return of this Run yet (Software Factory).'
export const NO_JOURNEY = 'The Journey the Run belongs to: Factory names none for this Run (its reading\'s owningJourneyRefs is empty).'
const AT_WORK: readonly string[] = ['active', 'waiting_human', 'finishing']

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const word = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

/** The design's readings of the named Run (software-factory__run-map.tsx keys), from its chain: `run` {ref, lifecycle, revision},
 * `nodes` and `edges` from the run reading's runMap (a unit with its `leg` {status, attempts} and a barrier with its `waits`, the units
 * still out by their labels, where Factory's inspection was read), `journey` {ref, purpose, status, runs}, and this Run's latest Return (`ret`) with your
 * Recognition of it (`recognition`). A run reading names no Run name, so none is given; a Recognition carries no time here, so none is
 * given. `light` is lit while the Run is at work (Factory's lifecycle active, waiting for you, or finishing). Pure. */
export function runMapReadings(read: RunJourneyRead): Values {
  const values: Record<string, Value> = {}
  const run = isObj(read.run) && read.run.contract === 'factory.run-reading/v1' ? read.run : null
  if (!run) return values
  const ref = word(run.runRef)
  const lifecycle = word(run.lifecycle)
  values.run = JSON.stringify({...(ref ? {ref} : {}), ...(lifecycle ? {lifecycle} : {}), ...(typeof run.revision === 'number' ? {revision: run.revision} : {})})
  values.light = lifecycle && AT_WORK.includes(lifecycle) ? 'lit' : 'dark'
  const map = isObj(run.runMap) ? run.runMap : null
  if (map) {
    const rows = (isObj(map.nodes) ? Object.values(map.nodes) : Array.isArray(map.nodes) ? map.nodes : []).filter(isObj)
    // Factory's inspection, joined by the workflow unit each work node stands for (its semanticRef) and by a barrier's key (its node
    // is `barrier-<key>`: Factory's workflow.rs). A unit still out is named as the map labels it, else by its ref.
    const inspected = read.inspection?.value
    const labelOf = new Map(rows.flatMap(node => { const unit = word(node.semanticRef), label = word(node.label); return unit && label ? [[unit, label] as const] : [] }))
    const waitsOf = new Map<string, readonly string[]>((inspected?.barriers ?? []).map(barrier => [`barrier-${barrier.key}`, barrier.notReturned.map(unit => labelOf.get(unit) ?? unit)]))
    const nodes = rows.flatMap(node => {
      const id = word(node.id), kind = word(node.kind)
      if (!id || !kind) return []
      const unit = word(node.semanticRef)
      const leg = kind === 'work' && unit ? inspected?.legs[unit] : undefined
      const waits = kind === 'gate' ? waitsOf.get(id) : undefined
      return [{id, kind, ...(word(node.label) ? {label: node.label} : {}), ...(word(node.state) ? {state: node.state} : {}), ...(leg ? {leg} : {}), ...(waits ? {waits} : {})}]
    })
    const edges = (Array.isArray(map.edges) ? map.edges : []).filter(isObj).flatMap(edge => {
      const from = word(edge.from), to = word(edge.to), relation = word(edge.relation)
      return from && to && relation ? [{from, to, relation}] : []
    })
    values.nodes = JSON.stringify(nodes)
    values.edges = JSON.stringify(edges)
  }
  const journey = journeyOf(read)
  if (journey && isObj(read.journey)) {
    const journeyRef = word(read.journey.journeyRef)
    values.journey = JSON.stringify({...(journeyRef ? {ref: journeyRef} : {}), ...journey})
    const returns = (Array.isArray(read.journey.returns) ? read.journey.returns : []).filter(isObj)
      .filter(row => ref && Array.isArray(row.run_refs) && row.run_refs.includes(ref))
    const latest = returns.at(-1)
    const returnRef = latest ? word(latest.return_ref) : undefined
    if (latest && returnRef) {
      values.ret = JSON.stringify({ref: returnRef, ...(word(latest.summary) ? {summary: latest.summary} : {})})
      const named = word(latest.recognition_ref) ?? (Array.isArray(read.journey.recognitions) ? read.journey.recognitions : []).filter(isObj)
        .map(link => (word(link.subject_ref) === returnRef ? word(link.recognition_ref) : undefined)).find(Boolean)
      if (named) values.recognition = JSON.stringify({ref: named})
    }
  }
  return values
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

/** The Run map's binding. With no Run (no session selected, or none of its takes names one) every reading stands absent and every act
 * disabled naming what it takes; given a Run, its chain (`read`) is drawn once Factory answers, what is not read stands absent saying
 * why, and with a carrier Retry writes through factory_owner attempt-retry. */
export function runMapBinding(holds: ChainHolds, run: RunMapRun | null = null, ports: RunMapPorts = {}, read: RunMapRead | null = null): DesignBinding {
  const standing: Record<string, Standing> = {}
  const why = !run ? NO_RUN : !read ? RUN_NOT_READ : read.status === 'reading' ? RUN_READING : read.status === 'refused' ? read.error ?? RUN_READING : null
  const {absent, refuse} = !run ? {absent: RUN_MAP_ABSENT, refuse: RUN_MAP_REFUSE}
    : why ? reasons(why) : {absent: reasons(RUN_LACKS).absent, refuse: reasons(RUN_IN_APPROVALS).refuse}
  for (const [key, why] of Object.entries(absent)) standing[key] = {disabled: why}
  for (const [key, why] of Object.entries(refuse)) standing[key] = {disabled: why}
  const owner = ports.owner
  if (run) {
    if (owner) delete standing.retry
    else standing.retry = {disabled: NO_CARRIER}
  }
  const drawn = run && read?.status === 'answered' && read.value ? runMapReadings(read.value) : {}
  for (const key of Object.keys(drawn)) delete standing[key]
  if (drawn.run) {
    // The run reading carries the map, and Factory's inspection each unit's leg and each barrier's units still out. Without the
    // inspection the nodes are drawn without them, and Retry, which the design offers on a failed or quiet unit, says why none is known.
    const inspection = read?.value?.inspection
    if (owner && !inspection?.value) standing.retry = {disabled: inspection?.error ? inspectRefused(inspection.error) : NO_INSPECT}
    if (!drawn.journey) standing.journey = {disabled: NO_JOURNEY}
    else if (!drawn.ret) standing.ret = {disabled: NO_RETURN}
    // With the Journey read, no Recognition is "not yet", not unread.
    if (drawn.journey) delete standing.recognition
  }
  return {
    id: RUN_MAP_ID,
    values: {...runMapValues(holds), ...drawn},
    standing,
    local: Object.fromEntries(RUN_MAP_LOCAL.map(key => [key, (value: Value | undefined) => holdView(RUN_MAP_ID, key, value)])),
    writes: key => key in RUN_MAP_REFUSE,
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'retry' && run && owner && !standing.retry?.disabled) { await retryUnit(run, owner, value); continue }
        throw Error(standing[key]?.disabled ?? refuse[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
