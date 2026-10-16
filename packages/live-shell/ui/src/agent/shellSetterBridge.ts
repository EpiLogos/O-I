/** The shell setters' honest wiring — ligament 4 (WO-0.4) for lane
 * zcode:agent-native-p0, 2026-10-11.
 *
 * The audit's finding 4: `shell.setEffort/setSteer/setHeartbeat/
 * setWriteArm` armed presentation state only — the values provably reached
 * no harness, and the rows' COVERED status was true at the grammar and
 * misleading at the world level. This bridge closes that honestly, value
 * by value, each traced to its ACTUAL destination:
 *
 * - effort → the armed session's harness, through the value-carrying
 *   harness control (`configure {effort}` — the kernel patch). The harness
 *   answer or refusal comes back as the receipt. Until the carrier lands,
 *   the kernel's own unknown-variant refusal IS the honest state, verbatim.
 * - input (steer vs queue) → the same carrier, `{input_mode}`.
 * - quantize → the carrier, `{quantize}`; its consumption (stop/steer
 *   reading the armed timing) is WO-A5 and stays owner-named.
 * - heartbeat → NO dispatch: its owner is the cron stratum (§15.3 /
 *   WO-A3), a cadence the gateway owns — a shell toggle scheduling
 *   check-ins would be a family scheduler, which §15 forbids. The value
 *   stays presentation-state and the dispatch refuses naming that owner.
 * - write arm → NO dispatch: no shell write flow reads it yet; its owner
 *   is the device apply path gating proposals vs direct-with-receipt
 *   (WO-SF2, Factory receiving). Presentation-state, refusal names it.
 *
 * The order is the owner's first (lock §0.4, manual §10.4): the dispatch
 * runs, and only a fired receipt — the owner accepted — moves the shell's
 * flag and is recorded for the Factory devices to read (devices/
 * ownerAccepted.ts). A refusal moves nothing: the flag a control shows is
 * never ahead of the owner, and a refused heartbeat or write arm never
 * flips (the flag used to flip first, so a light read it while the receipt
 * said "refused"). A setter the grammar cannot resolve moves nothing either.
 *
 * The registration runs where the agent shell mounts its transport (the
 * hook below); tests register the same dispatchers directly. Registry
 * shape and receipt vocabulary are the SDK's (`sdk/shellSetters.ts`) —
 * no second grammar. */

import {useEffect, useRef, useState} from 'react'
import type {DispatchReceipt} from '../inhabitants/sdk/shellSetters.ts'
import {registerShellSetter} from '../inhabitants/sdk/shellSetters.ts'
import {fireHarnessControlByKey, familyParamRows} from './agentNativeDispatch.ts'
import {recordOwnerAccepted} from './devices/ownerAccepted.ts'
import {AGENT_P0_ROWS} from './devices/designBindings.ts'
import {agentAddress} from '../inhabitants/agentParamAddresses.ts'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {AgentShellState} from './AgentShellContext.tsx'
import {atlasHandle, presentAtlasView} from '../projections/atlas/AtlasProjectionPanel.tsx'
import type {AtlasHandle} from '../projections/atlas/mount.ts'
import {formatYear} from '../projections/atlas/src/data/time.ts'
import {FORCE_ROWS, type Forces} from '../projections/atlas/src/graph/forces.ts'
import {
  allTime, DEPTH_RANGE, KIND_NAMES, playOrPause, scrubClock, setForce, stepDepth, TIE_BASE_IDS, toggleCumulative, toggleKind,
  toggleOccurrences, toggleSky, toggleTie, setWholeField,
} from '../inhabitants/atlasFaceActions.ts'
// [T-KNOWLEDGE-GRAPH-DEVICE] the knowledge graph's writers (the block at the end of this file) drive the open surface's handle.
import {knowledgeGraphSurface} from '../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle.ts'
import type {KnowledgeGraphSurface} from '../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle.ts'
import {
  DEPTH_RANGE as KNOWLEDGE_DEPTH_RANGE, KNOWLEDGE_CONTEXTS, KNOWLEDGE_DIRECTIONS, KNOWLEDGE_KINDS, KNOWLEDGE_LABELS,
  KNOWLEDGE_RELATIONS, KNOWLEDGE_SCOPES, TEXT_LIMIT, ZOOM_RANGE, setFilters, setZoom as setKnowledgeZoom,
} from '../inhabitants/knowledgeGraphFaceActions.ts'

/** The rows the bridge's setters dispatch through — resolved from the kit
 * registries by (family, deviceInstance, key), so the dispatch always
 * carries the row's own declared writePath. The shell never adopts the
 * kit's rows at boot (only tests call adoptVerifiedRows / loadAgentNativeP0;
 * ql/devices/atlasDevices.ts:7-9), so where the registry holds none the
 * grammar checked is the declared one itself: the verified address table
 * (agentParamAddresses.ts) and the P0 rows the Agent design writes through
 * (devices/designBindings.ts AGENT_P0_ROWS, drift-tested against the batch). */
function agentRow(family: string, key: string): {readonly family: string; readonly key: string} | undefined {
  return familyParamRows(family).find(row => row.deviceInstance === 'agent' && row.key === key)
    ?? familyParamRows(family).find(row => row.key === key)
    ?? [agentAddress('agent', key), agentAddress('world', key), ...Object.values(AGENT_P0_ROWS)]
      .find(row => row !== undefined && row.family === family && row.key === key && !!row.writePath)
}

export interface ShellSetterBridgeConfig {
  /** Reads the CURRENT transport/binding at dispatch time (the harness the
   * value should reach), not a mount-time snapshot. */
  readonly transport: () => KernelTransportStatus
  readonly binding: () => string
  /** The agent shell state: the bridge moves a control's flag after the
   * owner accepts the value, and not before. */
  readonly shell: Pick<AgentShellState, 'setEffort' | 'setSteer' | 'setHeartbeat' | 'setWriteArm' | 'setQuantize'> & {
    quantize: AgentShellState['quantize']
  }
  /** Receipt sink — the transport's note line. */
  readonly onReceipt?: (receipt: DispatchReceipt) => void
  /** The kernel call, injectable (tests capture the payload here). */
  readonly invoke?: Parameters<typeof fireHarnessControlByKey>[2]['invoke']
}

/** Register the agent shell's setters into the SDK registry. Idempotent per
 * path (registration replaces); returns an unregister (tests use it). */
export function registerAgentShellSetters(config: ShellSetterBridgeConfig): () => void {
  const dispatchFor = async (family: string, key: string, presentation: () => void, value: unknown): Promise<DispatchReceipt> => {
    const row = agentRow(family, key)
    if (!row) {
      const receipt: DispatchReceipt = {
        kind: 'refused', channel: 'none', writePath: '(unresolved)',
        reason: `No §14 row for ${family}/agent/${key} — the setter refuses rather than dispatch past the grammar.`,
      }
      config.onReceipt?.(receipt)
      return receipt
    }
    // A registered setter IS the shell channel's terminal: dispatch the
    // harness-carrier semantics for its KEY directly — re-entering
    // fireWritePath would recurse through this very registry (the row's
    // writePath IS this setter). The key semantics are the dispatch's one
    // shared map, refusals included.
    const binding = config.binding()
    const receipt = await fireHarnessControlByKey(key, value, {transport: config.transport(), binding, ...(config.invoke ? {invoke: config.invoke} : {})})
    // The owner accepted: now the flag moves, and the Factory devices may read the value (an owner's acceptance is a reading).
    // Refused — by the kernel, by the harness's own document, or by the dispatcher naming a presentation-state — nothing moves.
    if (receipt.kind === 'fired') {
      presentation()
      recordOwnerAccepted(binding, key, value)
    }
    config.onReceipt?.(receipt)
    return receipt
  }
  registerShellSetter('shell.setEffort', value => dispatchFor('actuation', 'effort', () => config.shell.setEffort(value as never), value))
  // The shell holds steer as a boolean; the harness carrier's input mode is a word (harnessAgentControl.ts input_mode).
  registerShellSetter('shell.setSteer', value => dispatchFor('actuation', 'input', () => config.shell.setSteer(value as never), typeof value === 'boolean' ? (value ? 'steer' : 'queue') : value))
  registerShellSetter('shell.setQuantize', value => dispatchFor('actuation', 'interrupt-quantize', () => config.shell.setQuantize(value as never), value))
  registerShellSetter('shell.setHeartbeat', value => dispatchFor('actuation', 'heartbeat', () => config.shell.setHeartbeat(value as never), value))
  registerShellSetter('shell.setWriteArm', value => dispatchFor('software-factory', 'write-mode', () => config.shell.setWriteArm(value as never), value))
  return () => {}
}

/** The hook the agent shell's transport mounts: registers the setters with
 * the live transport/binding readers and keeps the latest receipt for the
 * note line. */
export function useShellSetterBridge(
  shell: Pick<AgentShellState, 'setEffort' | 'setSteer' | 'setHeartbeat' | 'setWriteArm' | 'setQuantize' | 'quantize'>,
  transport: KernelTransportStatus,
  binding: string,
): {receipt: DispatchReceipt | null} {
  const [receipt, setReceipt] = useState<DispatchReceipt | null>(null)
  const latest = useRef({transport, binding, shell})
  latest.current = {transport, binding, shell}
  useEffect(() => {
    registerAgentShellSetters({
      transport: () => latest.current.transport,
      binding: () => latest.current.binding,
      shell: latest.current.shell,
      onReceipt: setReceipt,
    })
    registerAtlasShellSetters()
    registerKnowledgeShellSetters()
  }, [])
  return {receipt}
}

// ── the Earth's parameters: the mounted atlas's own face actions ───────────────────────────────────────────────────
//
// Each writer is registered under the shell.setAtlas* path its atlas-earth row names (agentNativeP0.ts). It reads the one
// mounted atlas at dispatch time (AtlasProjectionPanel's handle), validates its value against the domain the row declares,
// and then calls the SAME atlas face action the face body calls for that control (atlasFaceActions.ts): the state it moves is
// the state the body reads, and no writer keeps a copy. A value outside its domain, a malformed value, an atlas that has not
// mounted and a graph that has not been opened are each refused by name. Nothing is clamped, held or silently dropped.

const UNMOUNTED = 'the Earth has not mounted in this session, so the atlas it drives does not stand; the value is refused, not held'
const UNOPENED = 'the constellation has not been opened in this session, so its controls have no graph to drive (the Graph view is shown first)'

type AtlasOutcome = {readonly note: string} | {readonly refusal: string}
const done = (note: string): AtlasOutcome => ({note})
const refuse = (refusal: string): AtlasOutcome => ({refusal})

/** A number on a closed domain, or the refusal that names the domain. */
function within(value: unknown, min: number, max: number, what: string): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${what} takes a number, and ${String(value)} is not one`
  if (value < min || value > max) return `${what} is ${value}; the atlas takes ${min} to ${max}, and the value is refused rather than clamped`
  return null
}

function booleanValue(value: unknown, what: string): string | null {
  return typeof value === 'boolean' ? null : `${what} takes true or false, and ${String(value)} is neither`
}

/** A set of named choices: a list, no repeats, every name one of the choices the row declares. */
function choiceSet(value: unknown, choices: readonly string[], what: string): {readonly set: Set<string>} | string {
  if (!Array.isArray(value)) return `${what} takes a list of ${choices.join(', ')}`
  for (const item of value) {
    if (typeof item !== 'string' || !choices.includes(item)) return `${what} names ${String(item)}, which is not one of ${choices.join(', ')}`
  }
  const set = new Set<string>(value as string[])
  if (set.size !== value.length) return `${what} names a choice twice`
  return {set}
}

/** Register one atlas writer under its path: refused by name while no atlas is mounted, otherwise the act's own outcome. */
function atlasWriter(path: string, act: (value: unknown, handle: AtlasHandle) => AtlasOutcome): void {
  registerShellSetter(path, async value => {
    const handle = atlasHandle()
    if (!handle) {
      const refused: DispatchReceipt = {kind: 'refused', channel: 'shell', writePath: path, reason: `${path} refuses — ${UNMOUNTED}.`}
      return refused
    }
    const outcome = act(value, handle)
    const receipt: DispatchReceipt = 'refusal' in outcome
      ? {kind: 'refused', channel: 'shell', writePath: path, reason: `${path} refuses — ${outcome.refusal}.`}
      : {kind: 'fired', channel: 'shell', writePath: path, note: outcome.note}
    return receipt
  })
}

const FORCE_WRITERS: readonly (readonly [keyof Forces, string])[] = [
  ['centre', 'shell.setAtlasCentre'],
  ['repel', 'shell.setAtlasRepel'],
  ['link', 'shell.setAtlasLink'],
  ['distance', 'shell.setAtlasDistance'],
]

/** Every shell.setAtlas* path the atlas-earth rows name. The bridge registers exactly these. */
export const ATLAS_SHELL_SETTERS: readonly string[] = [
  'shell.setAtlasDepth',
  ...FORCE_WRITERS.map(([, path]) => path),
  'shell.setAtlasTies', 'shell.setAtlasKinds', 'shell.setAtlasOccurrences', 'shell.setAtlasSkyAnchors',
  'shell.setAtlasView',
  'shell.setAtlasWholeField',
  'shell.setAtlasCursor', 'shell.setAtlasAllTime', 'shell.setAtlasPlay', 'shell.setAtlasCumulative',
]

/** Register the atlas's writers. Idempotent: a registration replaces by path. The shell's transport registers them on mount
 * (useShellSetterBridge); the tests register them directly. */
export function registerAtlasShellSetters(): void {
  // graph-tools: the constellation's own controls, through the graph the controller holds.
  atlasWriter('shell.setAtlasDepth', (value, handle) => {
    const bad = within(value, DEPTH_RANGE.min, DEPTH_RANGE.max, 'Steps from the subject')
    if (bad) return refuse(bad)
    if (!Number.isInteger(value)) return refuse(`Steps from the subject take a whole number, and ${String(value)} is not one`)
    const graph = handle.ctl.graphControls
    if (!graph) return refuse(UNOPENED)
    const target = value as number
    const from = graph.controls().depth
    for (let i = 0; i < Math.abs(target - from); i++) stepDepth(graph, target > from ? 1 : -1)
    return done(`Steps from the subject: ${graph.controls().depth}.`)
  })

  for (const [key, path] of FORCE_WRITERS) {
    const spec = FORCE_ROWS.find(force => force.key === key)
    if (!spec) throw new Error(`the atlas has no force "${key}"`)
    atlasWriter(path, (value, handle) => {
      const bad = within(value, spec.min, spec.max, spec.label)
      if (bad) return refuse(bad)
      const graph = handle.ctl.graphControls
      if (!graph) return refuse(UNOPENED)
      setForce(graph, key, value as number)
      return done(`${spec.label} is ${graph.controls().forces[key]}.`)
    })
  }

  atlasWriter('shell.setAtlasTies', (value, handle) => {
    const chosen = choiceSet(value, TIE_BASE_IDS, 'Relations drawn')
    if (typeof chosen === 'string') return refuse(chosen)
    const graph = handle.ctl.graphControls
    if (!graph) return refuse(UNOPENED)
    const declared = graph.controls().bases.map(basis => basis.id)
    for (const id of chosen.set) {
      if (!declared.some(basis => basis === id)) return refuse(`the graph does not declare the relation "${id}" (it declares ${declared.join(', ')})`)
    }
    for (const basis of declared) {
      if (chosen.set.has(basis) !== graph.controls().ties.includes(basis)) toggleTie(graph, basis)
    }
    return done(`Relations drawn: ${graph.controls().ties.join(', ') || 'none'}.`)
  })

  atlasWriter('shell.setAtlasKinds', (value, handle) => {
    const chosen = choiceSet(value, KIND_NAMES, 'Kinds drawn')
    if (typeof chosen === 'string') return refuse(chosen)
    const graph = handle.ctl.graphControls
    if (!graph) return refuse(UNOPENED)
    for (const kind of KIND_NAMES) {
      if (chosen.set.has(kind) !== graph.controls().kinds[kind]) toggleKind(graph, kind)
    }
    const kinds = graph.controls().kinds
    return done(`Kinds drawn: ${KIND_NAMES.filter(kind => kinds[kind]).join(', ') || 'none'}.`)
  })

  atlasWriter('shell.setAtlasOccurrences', (value, handle) => {
    const bad = booleanValue(value, 'Occurrences')
    if (bad) return refuse(bad)
    const graph = handle.ctl.graphControls
    if (!graph) return refuse(UNOPENED)
    if (graph.controls().dust !== value) toggleOccurrences(graph)
    return done(`Occurrences are ${graph.controls().dust ? 'drawn' : 'hidden'}.`)
  })

  atlasWriter('shell.setAtlasSkyAnchors', (value, handle) => {
    const bad = booleanValue(value, 'Sky anchors')
    if (bad) return refuse(bad)
    const graph = handle.ctl.graphControls
    if (!graph) return refuse(UNOPENED)
    // the face's own reading: loading counts as on, so asking for it while it loads is already so
    const standing = (sky: string) => sky === 'on' || sky === 'loading'
    if (standing(graph.controls().sky) !== value) toggleSky(graph)
    return done(`Sky anchors: ${graph.controls().sky}.`)
  })

  // mode-switch: the lens bar's own view mirror, which the Earth follows when it mounts. Like the face body, the choice
  // stands whether or not the Earth has mounted yet — the mirror is the shell's, not the atlas's.
  registerShellSetter('shell.setAtlasView', async value => {
    const receipt: DispatchReceipt = value !== 'earth' && value !== 'graph'
      ? {kind: 'refused', channel: 'shell', writePath: 'shell.setAtlasView', reason: `shell.setAtlasView refuses — the view is earth or graph, and ${String(value)} is neither.`}
      : (presentAtlasView(value), {kind: 'fired', channel: 'shell', writePath: 'shell.setAtlasView', note: `The Earth presents the ${value} view.`})
    return receipt
  })

  // globe-engine: the whole-field choice, offered only while a mode's own set stands aside on the globe (as the body).
  atlasWriter('shell.setAtlasWholeField', (value, handle) => {
    const bad = booleanValue(value, 'Whole field')
    if (bad) return refuse(bad)
    if (!handle.ctl.globeScope.scope) return refuse('no mode’s set is set aside on the globe, so there is no whole-field choice to make')
    setWholeField(handle.engine, value as boolean)
    return done(value ? 'The globe shows the whole field.' : `The globe shows ${handle.ctl.globeScope.scope.label}.`)
  })

  // time-control: the atlas's one deep-time clock, bound to the shell's shared time window (T-ATLAS-TIME): a scrub writes
  // the window once, and a refusal by the window is named here rather than reported as done.
  atlasWriter('shell.setAtlasCursor', (value, handle) => {
    const clock = handle.time
    const bad = within(value, clock.fromU, clock.toU, 'The cursor')
    if (bad) return refuse(bad)
    const refusal = scrubClock(handle.ctl, clock, value as number)
    if (refusal) return refuse(refusal)
    return done(`The cursor stands at ${formatYear(handle.model.scale.fromU(clock.cursorU))}.`)
  })

  atlasWriter('shell.setAtlasAllTime', (value, handle) => {
    if (value !== true) return refuse('all time is the clock’s resting state and is left by scrubbing the cursor, so false is not written directly')
    const refusal = allTime(handle.ctl, handle.time)
    if (refusal) return refuse(refusal)
    return done('The clock stands at all time.')
  })

  atlasWriter('shell.setAtlasPlay', (value, handle) => {
    const bad = booleanValue(value, 'Play')
    if (bad) return refuse(bad)
    if (handle.time.playing !== value) {
      const refusal = playOrPause(handle.ctl, handle.time)
      if (refusal) return refuse(refusal)
    }
    return done(value ? 'The clock plays.' : 'The clock is paused.')
  })

  atlasWriter('shell.setAtlasCumulative', (value, handle) => {
    const bad = booleanValue(value, 'Cumulative')
    if (bad) return refuse(bad)
    if (handle.time.cumulative !== value) toggleCumulative(handle.time)
    return done(`The trail is ${value ? 'cumulative' : 'single'}.`)
  })
}

// ── the knowledge graph's parameters: the open surface's own handle (T-KNOWLEDGE-GRAPH-DEVICE; lock §8.1) ─────────────────
//
// Each writer is registered under the shell.setKnowledge* path its row names (agentNativeP0.ts). It reads the open graph's
// handle at dispatch time, validates its value against the domain the row declares and the reading the graph holds, and
// then calls the SAME act the face body calls (knowledgeGraphFaceActions.ts), which the surface implements over its own
// filter state and camera. A value outside its domain, a malformed value, a reading the graph has not loaded and a graph
// that is not open are each refused by name. Nothing is clamped, held or silently dropped.

const KNOWLEDGE_UNOPENED = 'no knowledge graph is open in this session, so there is no graph to drive; the value is refused, not held'

type KnowledgeOutcome = {readonly note: string} | {readonly refusal: string}
const kdone = (note: string): KnowledgeOutcome => ({note})
const krefuse = (refusal: string): KnowledgeOutcome => ({refusal})

/** A list of choices as a reason names them: "a, b or c". */
function orList(choices: readonly string[]): string {
  return choices.length <= 1 ? choices.join('') : `${choices.slice(0, -1).join(', ')} or ${choices[choices.length - 1]}`
}

/** A number on a closed domain (whole, when asked), or the refusal that names the domain. */
function knowledgeNumber(value: unknown, min: number, max: number, what: string, whole = false): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${what} takes a number, and ${String(value)} is not one`
  if (value < min || value > max) return `${what} takes a number from ${min} to ${max}, and ${value} is outside it; the value is refused rather than clamped`
  if (whole && !Number.isInteger(value)) return `${what} takes a whole number, and ${value} is not one`
  return null
}

/** One of the declared choices, or the refusal that names them. */
function knowledgeChoice(value: unknown, choices: readonly string[], what: string): string | null {
  return typeof value === 'string' && choices.includes(value) ? null : `${what} takes ${orList(choices)}, and ${String(value)} is not one`
}

function knowledgeSwitch(value: unknown, what: string): string | null {
  return typeof value === 'boolean' ? null : `${what} takes true or false, and ${String(value)} is neither`
}

function knowledgeText(value: unknown, what: string): string | null {
  if (typeof value !== 'string') return `${what} takes text, and ${String(value)} is not text`
  if (value.length > TEXT_LIMIT) return `${what} keeps at most ${TEXT_LIMIT} characters, and this has ${value.length}`
  return null
}

/** A set of named choices: a list with no repeats, every name one of the declared choices, and every name held by the open
 * reading (null while the reading has not loaded: nothing can be checked against it, so the set is refused). */
function knowledgeSet(value: unknown, declared: readonly string[], held: readonly string[] | null, what: string, noun: string): {readonly set: string[]} | string {
  if (!Array.isArray(value)) return `${what} takes a list of ${orList(declared)}`
  for (const item of value) {
    if (typeof item !== 'string' || !declared.includes(item)) return `${what} names ${String(item)}, which is not one of ${declared.join(', ')}`
  }
  if (new Set(value).size !== value.length) return `${what} names a choice twice`
  if (held === null) return `the open graph has not loaded its reading, so ${what} has nothing to check against; the value is refused, not held`
  for (const item of value as string[]) {
    if (!held.includes(item)) return `${what} names ${item}, and the open graph holds no ${noun} ${item}`
  }
  return {set: [...(value as string[])]}
}

/** Register one knowledge writer under its path: refused by name while no graph is open, otherwise the act's own outcome. */
function knowledgeWriter(path: string, act: (value: unknown, surface: KnowledgeGraphSurface) => KnowledgeOutcome): void {
  registerShellSetter(path, async value => {
    const surface = knowledgeGraphSurface()
    if (!surface) {
      const refused: DispatchReceipt = {kind: 'refused', channel: 'shell', writePath: path, reason: `${path} refuses — ${KNOWLEDGE_UNOPENED}.`}
      return refused
    }
    const outcome = act(value, surface)
    const receipt: DispatchReceipt = 'refusal' in outcome
      ? {kind: 'refused', channel: 'shell', writePath: path, reason: `${path} refuses — ${outcome.refusal}.`}
      : {kind: 'fired', channel: 'shell', writePath: path, note: outcome.note}
    return receipt
  })
}

/** Every shell.setKnowledge* path the knowledge-graph rows name. The bridge registers exactly these. */
export const KNOWLEDGE_SHELL_SETTERS: readonly string[] = [
  'shell.setKnowledgeScope', 'shell.setKnowledgeDepth', 'shell.setKnowledgeDirection', 'shell.setKnowledgeShared',
  'shell.setKnowledgeGhosts', 'shell.setKnowledgeText', 'shell.setKnowledgeKinds', 'shell.setKnowledgeRelations',
  'shell.setKnowledgeIsolated', 'shell.setKnowledgeContext', 'shell.setKnowledgeLabels', 'shell.setKnowledgeArrows',
  'shell.setKnowledgeZoom',
]

/** Register the knowledge graph's writers. Idempotent: a registration replaces by path. The shell's transport registers them
 * on mount (useShellSetterBridge); the tests register them directly. */
export function registerKnowledgeShellSetters(): void {
  // knowledge-scope: scope, depth, direction, the shared field, the unresolved markers.
  knowledgeWriter('shell.setKnowledgeScope', (value, surface) => {
    const bad = knowledgeChoice(value, KNOWLEDGE_SCOPES, 'Scope')
    if (bad) return krefuse(bad)
    setFilters(surface, {scope: value as 'field' | 'local'})
    return kdone(`Scope: ${value}.`)
  })
  knowledgeWriter('shell.setKnowledgeDepth', (value, surface) => {
    const bad = knowledgeNumber(value, KNOWLEDGE_DEPTH_RANGE.min, KNOWLEDGE_DEPTH_RANGE.max, 'Depth', true)
    if (bad) return krefuse(bad)
    // The depth input is disabled outside a local view (GraphFilters.tsx): the writer refuses the same, by name.
    if (surface.filters.scope !== 'local') return krefuse('Depth applies in a local view; the scope is the available field, so set the scope to the selected subject first, as the depth input does')
    setFilters(surface, {depth: value as number})
    return kdone(`Depth: ${value} ${value === 1 ? 'step' : 'steps'}.`)
  })
  knowledgeWriter('shell.setKnowledgeDirection', (value, surface) => {
    const bad = knowledgeChoice(value, KNOWLEDGE_DIRECTIONS, 'Relation direction')
    if (bad) return krefuse(bad)
    setFilters(surface, {direction: value as 'both' | 'outgoing' | 'incoming'})
    return kdone(`Relations followed: ${value}.`)
  })
  knowledgeWriter('shell.setKnowledgeShared', (value, surface) => {
    const bad = knowledgeSwitch(value, 'Shared field')
    if (bad) return krefuse(bad)
    setFilters(surface, {shared: value as boolean})
    return kdone(`Shared field: ${value ? 'included' : 'not included'}.`)
  })
  knowledgeWriter('shell.setKnowledgeGhosts', (value, surface) => {
    const bad = knowledgeSwitch(value, 'Unresolved link markers')
    if (bad) return krefuse(bad)
    setFilters(surface, {unresolved: value as boolean})
    return kdone(`Unresolved link markers: ${value ? 'shown' : 'hidden'}.`)
  })

  // knowledge-filters: find, kinds, relation types, the connected-only switch, the constellation context.
  knowledgeWriter('shell.setKnowledgeText', (value, surface) => {
    const bad = knowledgeText(value, 'Find')
    if (bad) return krefuse(bad)
    setFilters(surface, {text: value as string})
    return kdone(value ? `Find: ${value}.` : 'Find cleared.')
  })
  knowledgeWriter('shell.setKnowledgeKinds', (value, surface) => {
    const chosen = knowledgeSet(value, KNOWLEDGE_KINDS, surface.domains?.kinds ?? null, 'Subject kinds', 'subject of kind')
    if (typeof chosen === 'string') return krefuse(chosen)
    setFilters(surface, {kinds: chosen.set})
    return kdone(`Subject kinds: ${chosen.set.join(', ') || 'all'}.`)
  })
  knowledgeWriter('shell.setKnowledgeRelations', (value, surface) => {
    const chosen = knowledgeSet(value, KNOWLEDGE_RELATIONS, surface.domains?.relations ?? null, 'Relation types', 'relation')
    if (typeof chosen === 'string') return krefuse(chosen)
    setFilters(surface, {relations: chosen.set})
    return kdone(`Relation types: ${chosen.set.join(', ') || 'all'}.`)
  })
  knowledgeWriter('shell.setKnowledgeIsolated', (value, surface) => {
    const bad = knowledgeSwitch(value, 'Subjects with no disclosed relations')
    if (bad) return krefuse(bad)
    setFilters(surface, {isolated: value as boolean})
    return kdone(`Subjects with no disclosed relations: ${value ? 'included' : 'left out'}.`)
  })
  knowledgeWriter('shell.setKnowledgeContext', (value, surface) => {
    const bad = knowledgeChoice(value, KNOWLEDGE_CONTEXTS, 'Constellation context')
    if (bad) return krefuse(bad)
    setFilters(surface, {context: value as 'structure' | 'matches'})
    return kdone(`Constellation context: ${value}.`)
  })

  // knowledge-display: labels, relation arrows, zoom.
  knowledgeWriter('shell.setKnowledgeLabels', (value, surface) => {
    const bad = knowledgeChoice(value, KNOWLEDGE_LABELS, 'Labels')
    if (bad) return krefuse(bad)
    setFilters(surface, {labels: value as 'automatic' | 'all' | 'focus'})
    return kdone(`Labels: ${value}.`)
  })
  knowledgeWriter('shell.setKnowledgeArrows', (value, surface) => {
    const bad = knowledgeSwitch(value, 'Relation arrows')
    if (bad) return krefuse(bad)
    setFilters(surface, {arrows: value as boolean})
    return kdone(`Relation arrows: ${value ? 'shown' : 'hidden'}.`)
  })
  knowledgeWriter('shell.setKnowledgeZoom', (value, surface) => {
    const bad = knowledgeNumber(value, ZOOM_RANGE.min, ZOOM_RANGE.max, 'Zoom')
    if (bad) return krefuse(bad)
    setKnowledgeZoom(surface, value as number)
    return kdone(`Zoom: ${Math.round((value as number) * 100)}%.`)
  })
}
