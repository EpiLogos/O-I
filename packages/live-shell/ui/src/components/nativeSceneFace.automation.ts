import type {NativeAutomationChange, NativeAutomationLaneValues, NativeEditorReading, Scene} from '../../../../expressions-boundary/src/editor'
import {NATIVE_AUTOMATION_LANE_LIMIT, NATIVE_AUTOMATION_RANGES, NATIVE_AUTOMATION_WAVES} from '../../../../expressions-boundary/src/nativeAutomationEdits'
import {NATIVE_BINDINGS, automationTarget, entityTargets} from '../../../../expressions-boundary/src/parameters'
import {automationGroups, resolvedAutomation} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/automationLinks'
import {ease, waveform, type LaneRuntime} from '../../../../../desktop/cradle/expressions-app/src/engine/automation'
import {short} from './nativeFieldFaceValues.ts'
import type {SceneFaceModel} from './nativeSceneFaceModel.ts'

// Automation device: the Scene's lanes (Scene.automation) as one panel. Pure facts, pure geometry and typed change builders; no React, no commits.
// Every write is one NativeAutomationChange admitted by expressions-boundary nativeAutomationEdits.ts. Not built here by design: fire/restart and
// manual takeover (they change the document outside native history) and deleting a whole group (automation-remove scope 'lane' on a led group).

export type Lane = Scene['automation'][number]
type Wave = (typeof NATIVE_AUTOMATION_WAVES)[number]
export type LaneRole = 'leader' | 'follower' | 'independent'
/** The in-diagram handles: each drives one real lane field. */
export type LaneHandle = 'min' | 'max' | 'phase' | 'delay' | 'duration'
/** Every numeric lane field the panel edits exactly. */
export type LaneNumber = LaneHandle | 'rate'
type Bounds = {hardMin: number; hardMax: number}
type EngineWave = Parameters<typeof waveform>[0]

/** Lane fields a group target takes from its leader (automationLinks.ts resolvedAutomation). Enabled, blend and the range stay its own. */
export const INHERITED_LANE_FIELDS = ['type', 'wave', 'rate', 'phase', 'duration', 'delay', 'loop', 'easing'] as const

// Labels follow automationEditor.ts (the app's own option text).
export const WAVE_LABELS: Record<Wave, string> = {
  sine: 'Sine', triangle: 'Triangle', square: 'Square', saw: 'Saw', steps: 'Random step', smooth: 'Smooth random', morph: 'Morph drive · toroidal / poloidal',
}
export const TYPE_LABELS: Record<'lfo' | 'ramp', string> = {lfo: 'Oscillator', ramp: 'One-shot / repeating ramp'}
export const BLEND_LABELS: Record<'replace' | 'add' | 'multiply', string> = {replace: 'Replace', add: 'Add to base', multiply: 'Multiply base'}
export const LOOP_LABELS: Record<'once' | 'loop' | 'pingpong', string> = {once: 'Once', loop: 'Loop (restart)', pingpong: 'Ping-pong'}
export const EASING_LABELS: Record<'linear' | 'smooth' | 'easeIn' | 'easeOut' | 'elastic' | 'bounce', string> = {
  linear: 'Linear', smooth: 'Smooth', easeIn: 'Ease in', easeOut: 'Ease out', elastic: 'Elastic', bounce: 'Bounce',
}

/** The engine's own wave names (nativeBridge.ts `waves`: steps is randomStep, smooth is smoothRandom). Morph has no lane-only shape. */
const ENGINE_WAVE: Record<Exclude<Wave, 'morph'>, EngineWave> = {sine: 'sine', triangle: 'triangle', square: 'square', saw: 'saw', steps: 'randomStep', smooth: 'smoothRandom'}
const RANDOM_WAVES: readonly Wave[] = ['steps', 'smooth']
/** Random waves hold one value per whole cycle, so the curve shows this many cycles, drawn from seed 0. */
const RANDOM_CYCLES = 4
const SAMPLES = 128
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const clamp01 = (value: number) => clamp(value, 0, 1)
/** Round to a step, free of binary noise. A step that is not positive returns the value unchanged. */
export const roundTo = (value: number, step: number) => step > 0 ? Number((Math.round(value / step) * step).toFixed(6)) : value

// ---- Groups, roles and effective settings --------------------------------------

/** A led group: its leader (a lane with no sync) and the targets that follow it, in engine order. */
export interface LaneGroup {leader: Lane; followers: Lane[]}

/** Groups in engine order: each group sits where its earliest lane sits. A link the app cannot resolve is named, never guessed. */
export function laneGroups(lanes: readonly Lane[]): {groups: LaneGroup[]; problem: string | null} {
  try {
    const order = new Map(lanes.map((lane, index) => [lane.id, index] as const))
    const groups = automationGroups([...lanes]).map(({leader, targets}) => ({leader, followers: targets.filter(lane => lane.id !== leader.id)}))
    const first = (group: LaneGroup) => Math.min(order.get(group.leader.id) ?? Infinity, ...group.followers.map(lane => order.get(lane.id) ?? Infinity))
    return {groups: groups.sort((a, b) => first(a) - first(b)), problem: null}
  } catch {
    return {groups: [], problem: 'These automations link to one another in a way this panel cannot resolve. Read the Scene again.'}
  }
}

export function laneRole(lanes: readonly Lane[], lane: Lane): LaneRole {
  if (lane.syncWith) return 'follower'
  return lanes.some(other => other.syncWith === lane.id) ? 'leader' : 'independent'
}

/** The lane as the engine reads it: a follower takes the leader's shape (automationLinks.ts resolvedAutomation). Falls back to the lane itself. */
export function effectiveLane(lanes: readonly Lane[], lane: Lane): Lane {
  try {return resolvedAutomation([...lanes], lane)}
  catch {return lane}
}

/** Summary line for the rack widget and Browser: lanes and the enabled ones (a follower counts only when its leader runs). */
export function automationSummary(lanes: readonly Lane[] | undefined): string {
  if (!lanes) return 'Automation not disclosed'
  const enabled = lanes.filter(lane => effectiveLane(lanes, lane).enabled).length
  return `${lanes.length} lane${lanes.length === 1 ? '' : 's'} · ${enabled} enabled`
}

/** The one-line description of a lane's effective shape, for its row. */
export function laneLine(lane: Lane): string {
  const shape = lane.type === 'lfo' ? WAVE_LABELS[lane.wave] : EASING_LABELS[lane.easing ?? 'smooth']
  return `${TYPE_LABELS[lane.type]} · ${shape} · ${BLEND_LABELS[lane.blend]}`
}

/** A target's human label from the registry binding (field) or the entity's own name (entity). Never the raw path. */
export function targetLabel(scene: Scene, target: string): {label: string; unit: string | null; base: number | null} {
  const found = automationTarget(scene, target)
  return found ? {label: found.label, unit: found.unit ?? null, base: found.value} : {label: 'Target no longer in this Scene', unit: null, base: null}
}

// ---- Exact values and bounds -----------------------------------------------------

export function laneFieldLabel(key: LaneNumber, type: Lane['type']): string {
  if (key === 'rate') return 'Rate · Hz'
  if (key === 'phase') return 'Phase · cycles'
  if (key === 'delay') return 'Delay · seconds'
  if (key === 'duration') return 'Duration · seconds'
  if (key === 'min') return type === 'ramp' ? 'From' : 'Low'
  return type === 'ramp' ? 'To' : 'High'
}

/** The admitted range of one field: the boundary's option ranges, or the target's hard range for min and max. */
export function laneFieldBounds(key: LaneNumber, hard: Bounds): {min: number; max: number} {
  if (key === 'min' || key === 'max') return {min: hard.hardMin, max: hard.hardMax}
  const [min, max] = NATIVE_AUTOMATION_RANGES[key]
  return {min, max}
}

export function laneFieldStep(key: LaneNumber, hard: Bounds): number {
  if (key === 'min' || key === 'max') return (hard.hardMax - hard.hardMin) / 1000
  return key === 'rate' || key === 'phase' ? 0.001 : 0.01
}

export type ParsedNumber = {value: number; problem: null} | {value: null; problem: string}
/** One exact-value control's text. A value outside the admitted range never reaches a request. */
export function parseLaneNumber(raw: string, bounds: {min: number; max: number}, label: string): ParsedNumber {
  const text = raw.trim()
  const value = text === '' ? NaN : Number(text)
  if (!Number.isFinite(value)) return {value: null, problem: `${label} must be a number from ${bounds.min} to ${bounds.max}`}
  if (value < bounds.min || value > bounds.max) return {value: null, problem: `${label} must be from ${bounds.min} to ${bounds.max}`}
  return {value, problem: null}
}

// ---- Curves: the engine's own waveform and ease --------------------------------

/** The horizontal window of a lane's curve: one cycle (four for the random waves), or the delay plus the ramp's own time (two durations when it repeats). */
export function curveWindow(lane: Lane): number {
  if (lane.type === 'ramp') return lane.delay + lane.duration * (lane.loop === 'once' ? 1 : 2)
  return RANDOM_WAVES.includes(lane.wave) ? RANDOM_CYCLES : 1
}

/** A ramp's value at `seconds` after the Scene starts this lane. Mirrors engine/automation.ts evaluateLane for one-shot ramps:
 * the delay holds `from` (the lane's min), loop is the engine's restart, pingpong runs forward and back, and the easing is the engine's ease. */
export function rampValue(lane: Lane, seconds: number): number {
  const elapsed = seconds - lane.delay
  if (elapsed < 0) return lane.min
  const duration = Math.max(0.001, lane.duration)
  let u: number
  if (lane.loop === 'loop') u = (elapsed % duration) / duration
  else if (lane.loop === 'pingpong') {const cycle = (elapsed / duration) % 2; u = cycle < 1 ? cycle : 2 - cycle}
  else u = Math.min(1, elapsed / duration)
  return lane.min + (lane.max - lane.min) * ease(lane.easing ?? 'smooth', u)
}

export interface LaneCurve {
  kind: 'cycle' | 'ramp' | 'drive'
  /** The horizontal extent: cycles for a cycle lane, seconds for a ramp. */
  xMax: number
  /** Values are in the target's own units (the lane's min and max are its band). */
  points: readonly {x: number; y: number}[]
  /** The engine's start point for a deterministic cycle lane: at t = 0 it reads the wave at the phase. Null for ramps and random waves. */
  start: {x: number; y: number} | null
  note: string
}

/** The authored shape of one lane, computed from its own settings with the engine's functions (engine/automation.ts waveform and ease).
 * Not a recording: the live output is not in the reading. */
export function laneCurve(lane: Lane, xMax: number = curveWindow(lane)): LaneCurve {
  const xs = Array.from({length: SAMPLES + 1}, (_, index) => index / SAMPLES * xMax)
  if (lane.type === 'ramp') {
    const repeat = lane.loop === 'loop' ? 'Restarts after each run.' : lane.loop === 'pingpong' ? 'Runs forward, then back.' : 'Runs once, then holds at To.'
    return {kind: 'ramp', xMax, points: xs.map(x => ({x, y: rampValue(lane, x)})), start: null,
      note: `${repeat} Delay ${short(lane.delay)} s, run ${short(lane.duration)} s.`}
  }
  const wave = lane.wave
  if (wave === 'morph') return {kind: 'drive', xMax, points: [], start: null,
    note: 'Morph drive follows the Morph page phases. Its shape is not computed from this lane, so none is drawn.'}
  const engine = ENGINE_WAVE[wave]
  const runtime: LaneRuntime = {startTime: 0, token: 0, randSeed: 0, lastStep: -1, lastValue: 0, nextValue: 0}
  const value = (cycle: number, state: LaneRuntime) => lane.min + (lane.max - lane.min) * (0.5 + 0.5 * waveform(engine, cycle, state))
  const points = xs.map(x => ({x, y: value(x, runtime)}))
  if (RANDOM_WAVES.includes(wave)) return {kind: 'cycle', xMax, points, start: null,
    note: 'Random wave: four cycles from seed 0. The engine seeds its random at each run, so the live sequence will differ.'}
  const rate = lane.rate
  const period = rate > 0 ? `One cycle lasts ${short(1 / rate)} s at ${short(rate)} Hz.` : 'Rate 0 holds the lane at its phase value.'
  return {kind: 'cycle', xMax, points, start: {x: lane.phase, y: value(lane.phase, {...runtime})}, note: `${period} The marker is the phase at t = 0.`}
}

/** Where a value sits on the target's hard range: top is the hard maximum. Clamped into the plot. */
export function valueFraction(value: number, hard: Bounds): number {
  return hard.hardMax === hard.hardMin ? 0.5 : clamp01((hard.hardMax - value) / (hard.hardMax - hard.hardMin))
}

// ---- Handles: geometry, drag values and keys -----------------------------------

export const HANDLE_EDGE = 0.965
export const HANDLE_PHASE_ROW = 0.12
export const HANDLE_TIME_ROW = 0.88
export interface HandleFrame extends Bounds {xMax: number}
/** The frame a gesture is measured against: the un-dragged window, so the axis does not move under the pointer. */
export const handleFrame = (lane: Lane, hard: Bounds): HandleFrame => ({xMax: curveWindow(lane), hardMin: hard.hardMin, hardMax: hard.hardMax})

/** The handle's position as fractions of the plot. Phase sits on the top row, delay and duration on the bottom row, min and max on the right edge. */
export function handlePosition(lane: Lane, handle: LaneHandle, frame: HandleFrame): {x: number; y: number} {
  const along = (seconds: number) => clamp01(seconds / frame.xMax)
  const level = (value: number) => valueFraction(value, frame)
  if (handle === 'min') return {x: HANDLE_EDGE, y: level(lane.min)}
  if (handle === 'max') return {x: HANDLE_EDGE, y: level(lane.max)}
  if (handle === 'phase') return {x: along(lane.phase), y: HANDLE_PHASE_ROW}
  if (handle === 'delay') return {x: along(lane.delay), y: HANDLE_TIME_ROW}
  return {x: along(lane.delay + lane.duration), y: HANDLE_TIME_ROW}
}

/** The admitted value under a pointer at fractions `point`. Clamped to the field's range and rounded to its precision. */
export function handleValue(handle: LaneHandle, point: {x: number; y: number}, lane: Lane, frame: HandleFrame): number {
  const seconds = clamp01(point.x) * frame.xMax
  if (handle === 'phase') return roundTo(clamp(seconds, 0, 1), 0.001)
  if (handle === 'delay') return roundTo(clamp(seconds, 0, 10), 0.01)
  if (handle === 'duration') return roundTo(clamp(seconds - lane.delay, 0.01, 30), 0.01)
  const span = frame.hardMax - frame.hardMin
  return roundTo(clamp(frame.hardMax - clamp01(point.y) * span, frame.hardMin, frame.hardMax), span / 1000)
}

/** One arrow step (Shift for the coarse step) from `value`, clamped to the field's range. */
export function handleStep(handle: LaneHandle, value: number, direction: 1 | -1, coarse: boolean, hard: Bounds): number {
  if (handle === 'phase') return roundTo(clamp(value + direction * (coarse ? 0.1 : 0.01), 0, 1), 0.001)
  if (handle === 'delay') return roundTo(clamp(value + direction * (coarse ? 1 : 0.1), 0, 10), 0.01)
  if (handle === 'duration') return roundTo(clamp(value + direction * (coarse ? 1 : 0.1), 0.01, 30), 0.01)
  const span = (hard.hardMax - hard.hardMin) / 200
  return roundTo(clamp(value + direction * span * (coarse ? 10 : 1), hard.hardMin, hard.hardMax), span / 10)
}

// ---- Change builders: the shapes NativeAutomationChange admits -----------------

export const addLaneChange = (target: string, groupId?: string): NativeAutomationChange =>
  groupId ? {kind: 'automation-add', target, group_id: groupId} : {kind: 'automation-add', target}
/** One automation-set carrying only the fields that differ from the lane; null when none differ. */
export function laneValuesChange(lane: Lane, values: NativeAutomationLaneValues): NativeAutomationChange | null {
  const current = lane as unknown as Record<string, unknown>, changed: Record<string, unknown> = {}
  for (const key of Object.keys(values) as (keyof NativeAutomationLaneValues)[]) if (current[key] !== values[key]) changed[key] = values[key]
  return Object.keys(changed).length ? {kind: 'automation-set', lane_id: lane.id, values: changed as NativeAutomationLaneValues} : null
}
export const linkLaneChange = (laneId: string, leaderId: string | null): NativeAutomationChange => ({kind: 'automation-link', lane_id: laneId, leader_id: leaderId})
/** 'lane' removes an independent lane; 'group-target' takes one target out of its group (a led group keeps the rest). */
export const removeLaneChange = (laneId: string, scope: 'lane' | 'group-target'): NativeAutomationChange => ({kind: 'automation-remove', lane_id: laneId, scope})
export const orderLanesChange = (laneIds: readonly string[]): NativeAutomationChange => ({kind: 'automation-order', lane_ids: [...laneIds]})

/** The group leaders the legacy play-all and pause-all act on (app.ts automation-play and automation-pause: every automationGroups leader). A follower is never one. */
export const groupLeaders = (lanes: readonly Lane[]): Lane[] => lanes.filter(lane => laneRole(lanes, lane) !== 'follower')
/** Play-all's document step: enable every held group leader (app.ts automation-play). The fire itself is the stage command, not a document write. */
export function playAllChanges(lanes: readonly Lane[]): NativeAutomationChange[] {
  return groupLeaders(lanes).filter(lane => !lane.enabled).flatMap(lane => laneValuesChange(lane, {enabled: true}) ?? [])
}
/** Pause-all: hold every enabled group leader at its base (app.ts automation-pause). Each is one automation-set on its leader. */
export function pauseAllChanges(lanes: readonly Lane[]): NativeAutomationChange[] {
  return groupLeaders(lanes).filter(lane => lane.enabled).flatMap(lane => laneValuesChange(lane, {enabled: false}) ?? [])
}
/** Why the runtime automation commands (play, loop) cannot reach the application, or null. Names the first thing the user does. */
export function automationFrameReason(link: {run: unknown; state: {nativeScene?: unknown} | null}): string | null {
  if (!link.run) return 'No Expressions application is mounted.'
  if (!link.state) return 'The Expressions application has not reported its state yet.'
  if (!link.state.nativeScene) return 'Open a native Expression to run its automation.'
  return null
}
/** Play fires one-shot ramps only; a scene without a ramp leader has nothing to play. */
export const hasOneShotLeader = (lanes: readonly Lane[]): boolean => groupLeaders(lanes).some(lane => lane.type === 'ramp')

/** The full permutation after moving one lane by one place in engine order; null at either end. */
export function moveLaneIds(ids: readonly string[], laneId: string, delta: -1 | 1): string[] | null {
  const from = ids.indexOf(laneId), to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return null
  const next = [...ids]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}
/** The full permutation after dropping `from` onto `to`: `from` leaves its place and lands at `to`'s index. */
export function dragLaneIds(ids: readonly string[], from: string, to: string): string[] | null {
  const fromIndex = ids.indexOf(from), toIndex = ids.indexOf(to)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null
  const next = [...ids]
  next.splice(fromIndex, 1)
  next.splice(toIndex, 0, from)
  return next
}

/** Adding is refused once the Scene holds the lane limit. The boundary keeps the authority. */
export const addLaneProblem = (lanes: readonly Lane[]): string | null =>
  lanes.length >= NATIVE_AUTOMATION_LANE_LIMIT ? `This Scene already has its ${NATIVE_AUTOMATION_LANE_LIMIT} automations.` : null

/** The targets the add picker offers: every field binding and the selected object's entity targets, minus targets already automated. */
export interface PickerTarget {target: string; label: string; detail: string}
export function admittedTargets(scene: Scene, lanes: readonly Lane[], entityId: string | null, search: string): {field: PickerTarget[]; entity: PickerTarget[]} {
  const taken = new Set(lanes.map(lane => lane.target)), query = search.trim().toLowerCase()
  const keep = (item: PickerTarget) => !query || `${item.label} ${item.detail}`.toLowerCase().includes(query)
  const field = NATIVE_BINDINGS.filter(binding => !taken.has(`field.${binding.key}`))
    .map(binding => ({target: `field.${binding.key}`, label: binding.label, detail: binding.group}))
  const entity = entityId ? entityTargets(scene).filter(item => item.entityId === entityId && !taken.has(item.target))
    .map(item => ({target: item.target, label: item.label, detail: 'Selected object'})) : []
  return {field: field.filter(keep), entity: entity.filter(keep)}
}

/** Read-only facts the panel shows beside a lane: the reading's effective value when the engine reported it. */
/** Recent effective values of one automated target, as a trace. Only readings the owner gave are drawn; nothing is interpolated or predicted. */
export const MONITOR_TRACE_LIMIT = 120
export function monitorTrace(values: readonly number[], width = 240, height = 48): {path: string; min: number; max: number; last: number | null} {
  if (!values.length) return {path: '', min: 0, max: 0, last: null}
  const min = Math.min(...values), max = Math.max(...values), span = max - min
  const x = (index: number) => values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
  const y = (value: number) => span > 0 ? height - ((value - min) / span) * height : height / 2
  return {path: values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join(''), min, max, last: values[values.length - 1]}
}
export function effectiveReadout(reading: NativeEditorReading, target: string): number | null {
  const value = reading.observation?.effectiveValues?.[target]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Scene automation's registry entry. Summary and facts only; no activator, and no compact action (an add needs a target from the picker). */
export const automationFaceModel: SceneFaceModel = {
  name: 'Automation',
  groups: [{title: 'Lanes'}, {title: 'Selected lane'}],
  summary: reading => automationSummary(reading.scene?.automation),
  enabled: () => undefined,
  studio: 'automation',
}
