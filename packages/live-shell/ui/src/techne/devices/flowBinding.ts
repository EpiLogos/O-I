// The Canvas's Flow page on its owner (manual §17.4 "Map a workflow"; O-I 846): the workflow Factory's Notes draw in time (§19.1), drawn
// as a map, read from Factory and kept nowhere here.
//   - The workflows to choose from are the Runs the Factory tasks' latest attempts name (owners/attemptTakes.ts, agent/wavePlan.ts
//     planTargetOf): each task's workflow is the song its Run performs. The one drawn is the one chosen, else the selected Factory task's,
//     else the first. Nothing is read until the Canvas stands on its Flow page.
//   - The map is Factory's score of that song (`factory workflow score`, factory.workflow-score/v1, kernel factory_owner
//     `workflow-score-read`; agent/scoreBinding.ts useScore, the read Notes makes): each unit a task card, a unit that is a song's clip
//     (Factory's `form: canon`) a song card; each agent and agent set a unit's requirements name (or its row) a circle or a diamond, the
//     track's Agent rack naming them as Notes does; each join a bar; a solid line where a unit waits on another (through the join that
//     releases it), a dashed line from each agent or agent set to each unit it takes. Columns are the order of the work, left to right.
//   - The routine that starts it is AIKit's: Factory's run reading names the AIKit invocations that continued it into this Run
//     (`factory development run`, routineInvocationRefs; Factory routine_continuation.rs), AIKit's routine history names each invocation's
//     routine and its list the routine's name (kernel op `routine`: history, list). A Run no routine continued has none.
//   - Relate (`flow.draw`) draws a hand-off (a task waits on another) or an allocation (an agent or agent set takes a task); it stands amber
//     and dashed, held by the view (`flow.drawn`) for the workflow it was drawn on. Drawing a waiting line again takes it back.
//   - Promote sends every waiting line to Factory as one edit of the song's file at the byte revision Factory read (`factory workflow
//     edit`, factory.workflow-edit/v1: `connect` and `allocate`); Factory compiles the song with them and admits them or refuses in its
//     words, and the score is read again, where an admitted line stands solid (in Notes, a tie or a note on another row).
//   - Open is the shell's act (frame/openWhereItLives.ts): a task in Clip view (its own clip, else the task's whose Run performs the
//     workflow) with its note chosen, a song with its score opened, a routine in Settings, Automations.
// Pure, apart from the hook at the end.
import {useCallback, useContext, useEffect, useMemo, useReducer, useState} from 'react'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import {DetailContext} from '../../frame/detail/detailReading'
import {clipHostId} from '../../frame/detail/clipBinding'
import {useHostPage} from '../../frame/devices/deviceHost'
import {openWhereItLives, type NodeHome} from '../../frame/openWhereItLives'
import {useTimelineReading} from '../../projections/timelinePaneHost'
import {useAttemptTakes} from '../../owners/attemptTakes'
import {onOwnerChanged, tellOwnerChanged} from '../../owners/notices'
import type {FactoryTake} from '../../agent/factoryTakes'
import {planTargetOf} from '../../agent/wavePlan'
import {EDIT_REQUEST, rackRowsOf, scoreEditOp, useScore, type RackRow, type ScoreReading, type SongEdit} from '../../agent/scoreBinding'
import {factoryOwnerWrite} from '../../agent/devices/ownerRoutes'
import {developmentReading} from '../../agent/devices/runJourney'
import {trackKey, type AgentSessionTrack} from '../../agent/agentRunModel'
import {factoryTaskRef, parseFactoryTaskRef} from '../../timeline/factoryTrackAdapter'
import {routine as routineOp, routineList, type Invocation} from '../../../../../../desktop/cradle/src/contributions/automations/client'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {CANVAS_DESIGN, hold} from './designDevices'

type Obj = Record<string, unknown>
const object = (value: unknown): Obj | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)
const texts = (value: unknown): string[] => list(value).map(text).filter((item): item is string => item !== null)

/** The Flow page's keys: its readings, the view's own choices, and its acts. */
export const FLOW_READINGS = ['flow', 'flow.workflows', 'flow.check', 'flow.checkWhy', 'flow.starts'] as const
export const FLOW_LOCAL = ['flow.workflow', 'flow.to'] as const
export const FLOW_ACTS = ['flow.draw', 'flow.promote', 'flow.open'] as const
/** The view's hold of the lines drawn and not yet admitted, with the workflow they were drawn on. */
export const DRAWN = 'flow.drawn'

export const FLOW_CLOSED = 'The Flow page reads Factory\'s workflow while it is open: turn the Canvas to its Flow page.'
export const NO_WORKFLOW = 'No workflow is read: no Factory task\'s latest attempt names its Run and workflow unit yet (a task\'s workflow is the song its Run performs, and Factory is asked for none until an attempt names it).'
export const NO_DETAIL = 'No workflow is read here: this window publishes no Factory tasks.'
const JOIN_LINE = 'A join is the agent set\'s: Factory combines the returns that meet there by the set\'s join, so no line is drawn to or from it (Software Factory, Central).'
const ROUTINE_LINE = 'The routine that starts the workflow is AIKit\'s: what it starts is set in Settings, Automations, never drawn here.'

/** A Factory task's clip: where a task of the workflow lives. */
export interface FlowClip {readonly ref: string; readonly title: string; readonly track: string}
/** A workflow to choose: the Run a task's latest attempt names, the song it performs. */
export interface FlowWorkflow {
  readonly run: string
  readonly statePath: string
  readonly unitRef: string
  readonly label: string
  readonly session: string
  /** The register the session was read in: '' the root register, else its project. */
  readonly project: string
  readonly clip: FlowClip | null
}
/** A routine that started the Run, as AIKit names it. */
export interface FlowRoutine {readonly ref: string; readonly name: string; readonly when?: string}
export type FlowStarts = {readonly state: 'read'; readonly routines: readonly FlowRoutine[]} | {readonly state: 'absent'; readonly why: string}

/** One node and one line as the design draws them (techne__canvas.tsx FlowNode, FlowLine). */
export type FlowKind = 'task' | 'song' | 'agent' | 'set' | 'join' | 'trigger'
export interface FlowNode {readonly id: string; readonly kind: FlowKind; readonly name: string; readonly col: number; readonly row: number; readonly says?: string}
export interface FlowLine {readonly from: string; readonly to: string; readonly kind: 'handoff' | 'allocation' | 'start'; readonly proposed?: boolean}
export interface FlowMap {readonly name: string; readonly nodes: readonly FlowNode[]; readonly lines: readonly FlowLine[]}
/** A line drawn and not yet admitted. */
export interface Proposal {readonly from: string; readonly to: string; readonly kind: 'handoff' | 'allocation'}

// ---------------------------------------------------------------------------------------------------------------- the workflows

/** A session track's own task clip: its first real task (the session's owner holds one bound task). Pure. */
export function clipOfTrack(track: AgentSessionTrack): FlowClip | null {
  const task = track.tasks.find(item => !item.softStop)
  if (!task) return null
  const id = trackKey(track)
  return {ref: factoryTaskRef(id, task.n), title: task.title ?? track.purpose ?? track.agentName ?? 'task', track: id}
}

/** The workflows the Factory tasks name, one per Run (the first task that names it is its home), and each unit's own clip: the task whose
 * latest attempt names that unit. Pure. */
export function workflowsOf(tracks: readonly AgentSessionTrack[], takesOf: (session: string) => readonly FactoryTake[] | null): {
  workflows: FlowWorkflow[]; units: Map<string, FlowClip>
} {
  const workflows: FlowWorkflow[] = [], units = new Map<string, FlowClip>()
  for (const track of tracks) {
    if (track.group) continue
    const target = planTargetOf(takesOf(track.sessionRef))
    const clip = clipOfTrack(track)
    if (!target) continue
    if (clip && !units.has(target.unitRef)) units.set(target.unitRef, clip)
    if (workflows.some(item => item.run === target.runRef)) continue
    workflows.push({run: target.runRef, statePath: target.statePath, unitRef: target.unitRef, session: track.sessionRef, project: track.project ?? '', clip,
      label: [track.agentName ?? track.purpose ?? track.sessionRef, clip?.title].filter(Boolean).join(' · ')})
  }
  return {workflows, units}
}

// ---------------------------------------------------------------------------------------------------------------- the map

const rowKindOf = (kind: unknown): 'agent' | 'set' | null => (kind === 'agent' ? 'agent' : kind === 'agent-set' ? 'set' : null)

/** Who takes a unit: its row, then the agents and agent sets its requirements name. Pure. */
const takersOf = (unit: Obj): string[] => {
  const needs = object(unit.agentRequirements) ?? {}
  return [...new Set([text(unit.row), ...texts(needs.agentRefs), ...texts(needs.agentSetRefs)].filter((ref): ref is string => !!ref))]
}

/** Factory's score as the Flow page draws it: its units, the agents and agent sets that take them, its joins and the routines that start
 * it; the order of the work left to right. The names of the rows are the track's Agent rack's where it names them, as Notes names them.
 * Pure. */
export function flowOfScore(reading: Obj, rack: readonly RackRow[], routines: readonly FlowRoutine[]): FlowMap {
  const units = list(reading.units).map(object).filter((unit): unit is Obj => !!unit && !!text(unit.key))
  const joins = list(reading.joins).map(object).filter((join): join is Obj => !!join && !!text(join.key))
  const kinds = new Map<string, 'agent' | 'set'>()
  for (const row of rack) kinds.set(row.id, row.kind === 'set' ? 'set' : 'agent')
  for (const row of list(reading.rows).map(object)) { const ref = text(row?.ref), kind = rowKindOf(row?.kind); if (ref && kind) kinds.set(ref, kind) }
  // A unit released by a join waits on what the join waits for through it.
  const through = (unit: string, dep: string) => joins.some(join => texts(join.releases).includes(unit) && texts(join.waitsFor).includes(dep))
  const lines: FlowLine[] = []
  for (const join of joins) {
    const id = `join:${String(join.key)}`
    for (const dep of texts(join.waitsFor)) lines.push({from: dep, to: id, kind: 'handoff'})
    for (const unit of texts(join.releases)) lines.push({from: id, to: unit, kind: 'handoff'})
  }
  for (const unit of units) for (const dep of texts(unit.dependencies)) if (!through(String(unit.key), dep)) lines.push({from: dep, to: String(unit.key), kind: 'handoff'})
  const roots = units.filter(unit => !texts(unit.dependencies).length && !joins.some(join => texts(join.releases).includes(String(unit.key))))
  for (const routine of routines) for (const unit of roots) lines.push({from: routine.ref, to: String(unit.key), kind: 'start'})
  // The order of the work: each unit and join one column after the last thing it waits on.
  const base = routines.length ? 1 : 0
  const waits = new Map<string, string[]>()
  for (const line of lines) if (line.kind === 'handoff') waits.set(line.to, [...(waits.get(line.to) ?? []), line.from])
  const depth = new Map<string, number>()
  const colOf = (id: string, seen: Set<string> = new Set()): number => {
    const known = depth.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) return base
    seen.add(id)
    const before = (waits.get(id) ?? []).filter(dep => dep !== id)
    const col = before.length ? Math.max(...before.map(dep => colOf(dep, seen))) + 1 : base
    depth.set(id, col)
    return col
  }
  const work: {id: string; kind: FlowKind; name: string; says?: string}[] = [
    ...units.map(unit => ({id: String(unit.key), kind: (unit.form === 'canon' || text(unit.songClip) ? 'song' : 'task') as FlowKind, name: String(unit.key),
      ...(text(unit.concern) ? {says: text(unit.concern)!} : {})})),
    ...joins.map(join => ({id: `join:${String(join.key)}`, kind: 'join' as FlowKind, name: String(join.key)})),
  ]
  const columns = new Map<number, string[]>()
  for (const node of work) { const col = colOf(node.id); columns.set(col, [...(columns.get(col) ?? []), node.id]) }
  if (routines.length) columns.set(0, routines.map(routine => routine.ref))
  const tallest = Math.max(1, ...[...columns.values()].map(ids => ids.length))
  const rowIn = (col: number, id: string) => { const ids = columns.get(col) ?? [id]; return ids.indexOf(id) + (tallest - ids.length) / 2 }
  const nodes: FlowNode[] = [
    ...routines.map(routine => ({id: routine.ref, kind: 'trigger' as FlowKind, name: routine.when ? `${routine.name} · ${routine.when}` : routine.name, col: 0, row: rowIn(0, routine.ref),
      says: 'A routine in Settings, Automations'})),
    ...work.map(node => ({...node, col: colOf(node.id), row: rowIn(colOf(node.id), node.id)})),
  ]
  // Who takes each part, under the work: each under the middle of what it takes, kept apart.
  const takers: {id: string; kind: 'agent' | 'set'; col: number}[] = []
  for (const unit of units) {
    for (const ref of takersOf(unit)) {
      // Factory's rows name each agent and agent set the units name; an agency (no row of either kind) is not drawn.
      const kind = kinds.get(ref)
      if (!kind) continue
      lines.push({from: ref, to: String(unit.key), kind: 'allocation'})
      if (!takers.some(item => item.id === ref)) takers.push({id: ref, kind, col: 0})
    }
  }
  const named = new Map(rack.map(row => [row.id, row.name] as const))
  const placed = takers.map(taker => {
    const cols = lines.filter(line => line.kind === 'allocation' && line.from === taker.id).map(line => colOf(line.to))
    return {...taker, col: cols.reduce((sum, col) => sum + col, 0) / cols.length}
  }).sort((a, b) => a.col - b.col)
  for (let i = 1; i < placed.length; i++) if (placed[i]!.col - placed[i - 1]!.col < 0.5) placed[i] = {...placed[i]!, col: placed[i - 1]!.col + 0.5}
  // Two that stand closer than a column apart stand on two rows, so their names do not run into each other.
  const under = tallest - 1 + 1.5
  let last: {col: number; row: number} | null = null
  for (const taker of placed) {
    const row: number = last && taker.col - last.col < 1 && last.row === under ? under + 0.9 : under
    nodes.push({id: taker.id, kind: taker.kind, name: named.get(taker.id) ?? (taker.id.split(/[/:]/).pop() || taker.id), col: taker.col, row})
    last = {col: taker.col, row}
  }
  return {name: text(object(reading.song)?.workflowKey) ?? '—', nodes, lines}
}

/** Factory's word on the song's file: its check, whether the Run performs this edition. Pure. */
export function checkOfScore(reading: Obj): {check: 'admitted' | 'refused'; why: string} {
  const check = object(reading.check) ?? {}, song = object(reading.song) ?? {}
  if (check.state === 'refused') return {check: 'refused', why: `factory workflow check refuses the song's file: ${text(object(check.diagnostic)?.message) ?? 'no reason given'}`}
  const words = [check.edition === 'file' ? 'factory workflow check admits the song\'s file' : 'Factory reads the edition the Run retained']
  if (text(song.why)) words.push(text(song.why)!)
  if (song.edition === 'file' && song.performed === false) words.push('the file was edited: the Run performs the edition it was commissioned with, and the song\'s next Run performs this one')
  return {check: 'admitted', why: words.join(' · ')}
}

// ---------------------------------------------------------------------------------------------------------------- the lines drawn

/** The lines held for a workflow (the view's `flow.drawn`). Pure. */
export function proposalsOf(held: Readonly<Record<string, Value>>, run: string | null): Proposal[] {
  const raw = held[DRAWN]
  if (!run || typeof raw !== 'string') return []
  try {
    const parsed = object(JSON.parse(raw))
    if (parsed?.run !== run) return []
    return list(parsed.lines).map(object).flatMap((line): Proposal[] => line && text(line.from) && text(line.to) && (line.kind === 'handoff' || line.kind === 'allocation')
      ? [{from: String(line.from), to: String(line.to), kind: line.kind}] : [])
  } catch { return [] }
}

const isTask = (node: FlowNode | undefined) => node?.kind === 'task' || node?.kind === 'song'
const isTaker = (node: FlowNode | undefined) => node?.kind === 'agent' || node?.kind === 'set'

/** A line drawn with Relate, as Factory would take it: a hand-off from task to task, an allocation from an agent or agent set to a task
 * (drawn either way round). Throws why it is no line of the workflow. Pure. */
export function proposalOf(map: FlowMap, drawn: {from?: unknown; to?: unknown; kind?: unknown}): Proposal {
  const by = new Map(map.nodes.map(node => [node.id, node] as const))
  const from = by.get(String(drawn.from)), to = by.get(String(drawn.to))
  if (!from || !to) throw new Error('Relate joins two nodes of the workflow: choose the Node and the node it goes To.')
  if (from.id === to.id) throw new Error(`A line runs between two nodes: ${from.name} cannot hand on to itself.`)
  if (from.kind === 'join' || to.kind === 'join') throw new Error(JOIN_LINE)
  if (from.kind === 'trigger' || to.kind === 'trigger') throw new Error(ROUTINE_LINE)
  if (drawn.kind === 'allocation') {
    const [who, task] = isTaker(from) && isTask(to) ? [from, to] : isTaker(to) && isTask(from) ? [to, from] : [null, null]
    if (!who || !task) throw new Error('An allocation runs from an agent or an agent set to a task: choose one of each.')
    if (map.lines.some(line => line.kind === 'allocation' && line.from === who.id && line.to === task.id)) throw new Error(`${who.name} already takes ${task.name}.`)
    return {from: who.id, to: task.id, kind: 'allocation'}
  }
  if (!isTask(from) || !isTask(to)) throw new Error('A hand-off runs from a task to a task: choose Line Allocation to give a task to an agent or an agent set.')
  if (map.lines.some(line => line.kind === 'handoff' && line.from === from.id && line.to === to.id)) throw new Error(`${to.name} already waits on ${from.name}.`)
  return {from: from.id, to: to.id, kind: 'handoff'}
}

/** The edits Factory takes for the lines drawn (factory.workflow-edit/v1 `connect`, `allocate`). Pure. */
export function editsOf(map: FlowMap, proposals: readonly Proposal[]): Record<string, unknown>[] {
  const by = new Map(map.nodes.map(node => [node.id, node] as const))
  return proposals.map(line => line.kind === 'handoff' ? {op: 'connect', unit: line.to, waitsOn: line.from}
    : {op: 'allocate', units: [line.to], to: {kind: by.get(line.from)?.kind === 'set' ? 'agent-set' : 'agent', ref: line.from}})
}

// ---------------------------------------------------------------------------------------------------------------- what Factory said

/** Factory's word on the last Promote, for the workflow it was said of. */
export interface FlowSaid {readonly run: string; readonly check: 'admitted' | 'refused'; readonly why: string}
let said: FlowSaid | null = null
const saidListeners = new Set<() => void>()
export const flowSaidState = (): FlowSaid | null => said
export function subscribeFlowSaid(listener: () => void): () => void { saidListeners.add(listener); return () => { saidListeners.delete(listener) } }
const say = (next: FlowSaid | null) => { said = next; for (const listener of [...saidListeners]) listener() }
/** For the tests. */
export const resetFlowSaid = (): void => say(null)
const wordsOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

// ---------------------------------------------------------------------------------------------------------------- the binding

/** What the Flow page reads and the acts it goes through. */
export interface FlowPort {
  readonly workflows: readonly FlowWorkflow[]
  readonly chosen: FlowWorkflow | null
  /** Why no workflow is chosen, where none is. */
  readonly none?: string
  readonly score: ScoreReading
  readonly rack: readonly RackRow[]
  readonly starts: FlowStarts
  /** Each unit's own clip, by Factory's unit ref. */
  readonly units: ReadonlyMap<string, FlowClip>
  /** Factory edits the song's file and answers its receipt, or throws its refusal in its words. */
  readonly edit: (request: SongEdit) => Promise<unknown>
  /** The shell's act that opens a thing where it lives. */
  readonly open: (home: NodeHome) => void
}

/** The map now: Factory's score with the lines drawn on it, amber. Null where nothing is read. Pure. */
export function mapOf(port: FlowPort, held: Readonly<Record<string, Value>>): FlowMap | null {
  if (port.score.state !== 'read') return null
  const map = flowOfScore(port.score.reading, port.rack, port.starts.state === 'read' ? port.starts.routines : [])
  const drawn = proposalsOf(held, port.chosen?.run ?? null)
  return {...map, lines: [...map.lines, ...drawn.map(line => ({...line, proposed: true}))]}
}

/** The Canvas with its Flow page on Factory: the map, the workflows, Factory's word and the starts as readings; the workflow and the node a
 * line goes To as the view's; Relate, Promote and Open as acts. With no port (the page is not open) the page's keys stand closed. Pure. */
export function canvasCarryingFlow(canvas: DesignBinding, port: FlowPort | null, held: Readonly<Record<string, Value>>,
  hands: Readonly<Record<string, (value: Value | undefined) => void>>, current: FlowSaid | null = said): DesignBinding {
  const values = {...canvas.values}, standing: Record<string, Standing> = {...(canvas.standing ?? {})}
  const local = {...(canvas.local ?? {}), ...Object.fromEntries(FLOW_LOCAL.map(key => [key, hands[key]!] as const))}
  for (const key of FLOW_LOCAL) if (held[key] !== undefined) values[key] = held[key]!
  const writes = (key: string) => ((FLOW_ACTS as readonly string[]).includes(key) ? true : canvas.writes ? canvas.writes(key) : !!canvas.write)
  if (!port) {
    for (const key of [...FLOW_READINGS, ...FLOW_ACTS]) standing[key] = {disabled: FLOW_CLOSED}
    return {...canvas, values, standing, local, writes, write: async changes => {
      const act = changes.find(change => (FLOW_ACTS as readonly string[]).includes(change.key))
      if (act) throw new Error(FLOW_CLOSED)
      if (!canvas.write) throw new Error(`${changes[0]?.key}: a reading — the frame reports it, and nothing here changes it.`)
      await canvas.write(changes)
    }}
  }
  const chosen = port.chosen, map = mapOf(port, held)
  const readName = port.score.state === 'read' ? text(object(port.score.reading.song)?.workflowKey) : null
  if (port.workflows.length) values['flow.workflows'] = JSON.stringify(port.workflows.map(item => ({value: item.run, label: item.run === chosen?.run && readName ? readName : item.label})))
  else standing['flow.workflows'] = {disabled: port.none ?? NO_WORKFLOW}
  if (chosen) values['flow.workflow'] = chosen.run
  const why = !chosen ? port.none ?? NO_WORKFLOW : port.score.state === 'absent' ? port.score.why : null
  if (map && port.score.state === 'read') {
    values.flow = JSON.stringify(map)
    const word = current && current.run === chosen?.run ? current : {run: chosen?.run ?? '', ...checkOfScore(port.score.reading)}
    values['flow.check'] = word.check
    values['flow.checkWhy'] = word.why
  } else for (const key of ['flow', 'flow.check', 'flow.checkWhy', 'flow.promote'] as const) standing[key] = {disabled: why ?? NO_WORKFLOW}
  if (port.starts.state === 'read') values['flow.starts'] = port.starts.routines.length
  else standing['flow.starts'] = {disabled: port.starts.why}
  const drawOne = (value: Value) => {
    if (!map || !chosen) throw new Error(why ?? NO_WORKFLOW)
    let asked: Obj
    try { asked = object(typeof value === 'string' ? JSON.parse(value) : value) ?? {} } catch { throw new Error('Relate draws a line between two nodes.') }
    const line = proposalOf({...map, lines: map.lines.filter(item => !item.proposed)}, asked)
    const drawn = proposalsOf(held, chosen.run)
    const same = (item: Proposal) => item.from === line.from && item.to === line.to && item.kind === line.kind
    // A waiting line drawn again is taken back.
    const next = drawn.some(same) ? drawn.filter(item => !same(item)) : [...drawn, line]
    hold(CANVAS_DESIGN, DRAWN, next.length ? JSON.stringify({run: chosen.run, lines: next}) : undefined)
  }
  const promote = async () => {
    if (!map || !chosen || port.score.state !== 'read') throw new Error(why ?? NO_WORKFLOW)
    const drawn = proposalsOf(held, chosen.run)
    if (!drawn.length) throw new Error('No line you drew waits.')
    const song = object(port.score.reading.song)
    const revision = text(object(song?.file)?.byteRevision)
    if (!revision) throw new Error(`Factory writes no edit of this song: ${text(song?.why) ?? 'no file under the project root holds it'}`)
    try {
      const receipt = object(await port.edit({contract: EDIT_REQUEST, expectedRevision: revision, edits: editsOf(map, drawn)})) ?? {}
      hold(CANVAS_DESIGN, DRAWN, undefined)
      const count = drawn.length === 1 ? 'the line you drew' : `the ${drawn.length} lines you drew`
      say({run: chosen.run, check: 'admitted', why: [`Factory admits ${count} into the song's file at ${text(receipt.revision) ?? 'its next revision'}`, text(receipt.performs)].filter(Boolean).join(' · ')})
    } catch (error) {
      say({run: chosen.run, check: 'refused', why: wordsOf(error)})
      throw error
    }
  }
  const openOne = (value: Value) => {
    const node = map?.nodes.find(item => item.id === value)
    if (!node || !chosen) throw new Error(map ? 'Choose a node first.' : why ?? NO_WORKFLOW)
    if (node.kind === 'trigger') {
      const routine = port.starts.state === 'read' ? port.starts.routines.find(item => item.ref === node.id) : undefined
      if (!routine) throw new Error('This routine is not read: AIKit\'s routine list does not name it.')
      port.open({kind: 'routine', routine: routine.ref, name: routine.name, project: chosen.project})
      return
    }
    if (!isTask(node)) throw new Error('Open takes a task, a song or a routine: an agent, an agent set or a join opens nowhere of its own.')
    const unit = port.score.state === 'read' ? list(port.score.reading.units).map(object).find(item => item?.key === node.id) : null
    const clip = (text(unit?.unitRef) ? port.units.get(String(unit!.unitRef)) : undefined) ?? chosen.clip
    if (!clip) throw new Error('No Factory task\'s clip holds this workflow: its Run names no task here.')
    port.open({kind: 'clip', mode: 'factory', clip: clip.ref, title: clip.title, track: clip.track,
      view: {id: clipHostId('factory', clip.ref), holds: {'view.editor': 'notes', unit: node.id, 'score.open': node.kind === 'song' ? node.id : undefined}}})
  }
  return {...canvas, values, standing, local, writes,
    write: async (changes: readonly ValueChange[]) => {
      const own: ValueChange[] = []
      for (const change of changes) {
        if (change.key === 'flow.draw') drawOne(change.value)
        else if (change.key === 'flow.promote') await promote()
        else if (change.key === 'flow.open') openOne(change.value)
        else own.push(change)
      }
      if (own.length) {
        if (!canvas.write) throw new Error(`${own[0]!.key}: a reading — the frame reports it, and nothing here changes it.`)
        await canvas.write(own)
      }
    }}
}

// ---------------------------------------------------------------------------------------------------------------- the reads

/** The routines that started a Run: Factory names the AIKit invocations that continued it, AIKit's history each invocation's routine and
 * its list the routine's name. Throws an owner's refusal in its words. */
export async function readStarts(transport: KernelTransportStatus, workflow: FlowWorkflow): Promise<FlowStarts> {
  const run = object(await developmentReading(transport, workflow.statePath, 'run', workflow.run)) ?? {}
  const invocations = texts(run.routineInvocationRefs)
  if (!invocations.length) return {state: 'read', routines: []}
  const project = workflow.project || undefined
  const history = await routineOp(transport, project, {action: 'history'})
  if (!Array.isArray(history)) throw new Error('AIKit\'s routine history could not be read.')
  const known = routineList(await routineOp(transport, project, {action: 'list'})).routines
  const routines: FlowRoutine[] = []
  for (const ref of invocations) {
    const invocation = (history as Invocation[]).find(row => row?.invocation_ref === ref)
    if (!invocation) return {state: 'absent', why: `Factory's Run names AIKit invocation ${ref}, which AIKit's routine history ${project ? `in ${project}` : 'in this home'} does not hold.`}
    if (routines.some(item => item.ref === invocation.routine_ref)) continue
    const summary = known.find(row => row.routine === invocation.routine_ref)
    routines.push({ref: invocation.routine_ref, name: summary?.name ?? invocation.routine_ref, ...(summary ? {when: summary.trigger.kind} : {})})
  }
  return {state: 'read', routines}
}

const UNAVAILABLE: KernelTransportStatus = {kind: 'unavailable', reason: 'No detail host publishes a kernel carrier here.'}
const STARTS_READING = 'Factory is reading which routine continued this Run.'

/** The Flow page's reads, made only while the Canvas stands on it: the Factory tasks' takes, the chosen workflow's score and its starts. */
export function useFlow(held: Readonly<Record<string, Value>>): FlowPort | null {
  const on = useHostPage(CANVAS_DESIGN) === 'flow'
  const detail = useContext(DetailContext)
  const selected = useTimelineReading()?.selectedRef ?? null
  const transport = detail?.transport ?? UNAVAILABLE
  const tracks = useMemo(() => (on ? detail?.factory.tracks ?? [] : []), [on, detail?.factory.tracks])
  const sessions = useMemo(() => tracks.filter(track => !track.group && clipOfTrack(track)), [tracks])
  const refs = useMemo(() => sessions.map(track => track.sessionRef), [sessions])
  const projectOf = useCallback((ref: string) => tracks.find(track => track.sessionRef === ref)?.project ?? '', [tracks])
  const takes = useAttemptTakes(transport, refs, projectOf)
  const found = useMemo(() => workflowsOf(sessions, ref => takes?.of(ref) ?? null), [sessions, takes])
  const picked = typeof held['flow.workflow'] === 'string' ? held['flow.workflow'] : null
  const selectedTrack = selected ? parseFactoryTaskRef(selected)?.trackId ?? null : null
  const selectedRun = selectedTrack ? found.workflows.find(item => item.clip?.track === selectedTrack)?.run ?? null : null
  const chosen = found.workflows.find(item => item.run === picked) ?? found.workflows.find(item => item.run === selectedRun) ?? found.workflows[0] ?? null
  const track = chosen ? sessions.find(item => item.sessionRef === chosen.session) ?? null : null
  const rack = useMemo(() => rackRowsOf(track, tracks), [track, tracks])
  const target = useMemo(() => (chosen ? {statePath: chosen.statePath, runRef: chosen.run, unitRef: chosen.unitRef} : null), [chosen?.statePath, chosen?.run, chosen?.unitRef]) // eslint-disable-line react-hooks/exhaustive-deps
  const scored = useScore(transport, target, rack, chosen?.session ?? null)
  const [again, readAgain] = useReducer((n: number) => n + 1, 0)
  useEffect(() => onOwnerChanged('temporal', () => readAgain()), [])
  const startsKey = chosen ? JSON.stringify([transport, chosen.statePath, chosen.run, chosen.project]) : null
  const [starts, setStarts] = useState<{key: string; value: FlowStarts} | null>(null)
  useEffect(() => {
    if (!chosen || !startsKey || transport.kind === 'unavailable') return
    let live = true
    void readStarts(transport, chosen).catch((error: unknown): FlowStarts => ({state: 'absent', why: wordsOf(error)}))
      .then(value => { if (live) setStarts({key: startsKey, value}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startsKey, again])
  const transportKey = JSON.stringify(transport)
  const edit = useCallback(async (request: SongEdit) => {
    if (!target) throw new Error(NO_WORKFLOW)
    const receipt = await factoryOwnerWrite(transport, (scoreEditOp(target, request) as {request: {kind: string}}).request, '`factory workflow edit`')
    tellOwnerChanged({topic: 'temporal', cause: 'the song\'s file was edited on the Canvas\'s Flow page'})
    return receipt
  }, [transportKey, target]) // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo((): FlowPort | null => {
    if (!on) return null
    const none = !detail ? NO_DETAIL : transport.kind === 'unavailable' ? `Factory is not reached: ${transport.reason ?? 'the shell has no kernel carrier'}.` : NO_WORKFLOW
    return {workflows: found.workflows, chosen, none, score: chosen ? scored.reading : {state: 'absent', why: none}, rack,
      starts: !chosen ? {state: 'absent', why: none} : transport.kind === 'unavailable' ? {state: 'absent', why: none}
        : starts?.key === startsKey ? starts!.value : {state: 'absent', why: STARTS_READING},
      units: found.units, edit, open: openWhereItLives}
  }, [on, detail, transportKey, found, chosen, scored.reading, rack, starts, startsKey, edit]) // eslint-disable-line react-hooks/exhaustive-deps
}
