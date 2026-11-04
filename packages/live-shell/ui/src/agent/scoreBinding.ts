// A Factory task's score (O-I #843; manual §19.1 "The score", Clip view's Notes, Vāk and Tools): the song the task's Run performs, as
// Factory reads it (`factory workflow score <state> <run>`, factory.workflow-score/v1, through the kernel's factory_owner
// `workflow-score-read`) — its units with their compositions, each unit's row (who does it), its joins and its waves, and its check —
// drawn on the rows of the track's Agent rack: the agents and agent sets the rack holds, then the agents and agent sets the song names
// that the rack does not. This task's own note is the unit its latest attempt names (wavePlan.ts planTargetOf).
//   - Allocate (a note dragged to another row, or Transform's Allocate), Connect and Thread form are the person's edits of the song's
//     file, written by Factory (`factory workflow edit <state> <run> -`, factory.workflow-edit/v1, factory_owner `workflow-edit`) at the
//     byte revision Factory read; Factory compiles the edit before the file changes and refuses what it cannot write, in its words. The
//     Run keeps performing the edition it was commissioned with. A song branches only by allocation: no tool writes a condition.
//   - The join where stacked units meet is the Central agent set's, set on the Agent rack (O-I #684; Factory keeps it with the Run): the
//     song holds none, so Transform's Join stands refused with that reason.
//   - Fill heads asks AIKit's elected decision model for the selected unit's open heads, among the labels QL's Vāk-block instrument holds
//     (`aikit decide invoke --instrument vak-block`, aikit.instrument-fill-request/v1 → aikit.instrument-fill/v1, aikit_write
//     `decide-fill`), the ask kept against the session. A unit with no open head is not asked (zero heads, zero calls). AIKit's picks are
//     evidence: they stand dashed on the unit until Accept writes them into its composition through Factory, or Discard drops them.
//   - QL's word on each unit: a unit's seven heads are a cell of QL's Vāk-block instrument, and QL's engine checks every cell of the score
//     in one ask (`ql context-frame team-space check vak-block -`, ql.instrument-cells/v1 → ql.instrument-cell-check/v1, the kernel's
//     ql_read `instrument-check`): each chosen label held to its head and the instrument's constraints, an open head an abstention it
//     names. One unit refused refuses the score (`score.check`), in QL's words. A proposal's picks, with the unit's heads, are a cell of
//     their own: QL's word on it is the engine's word on the proposal (`gen.status`).
//   - Compose (a song from the task's Intent) is Anima's act as an agent: it stands refused, naming what it waits for.
//   - A unit that is a song's clip dropped on the track (O-I #844, songClips.ts; Factory marks it `form: canon`, its `songClip`, and draws
//     the clip's score inside it as `song`) stands as one note with the thread form canon (CFP5), the song's notes small inside it; a
//     double-click opens it (`score.open`) and Back returns. Its song is the clip's render, never edited here.
// The tools reshape the score; nothing here writes the task's log. Pure, apart from the hook at the end.
import {useEffect, useMemo, useState} from 'react'
import {onOwnerChanged} from '../owners/notices'
import type {Value} from '../frame/devices/designed'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {aikitWriteOp, factoryOwnerWrite, ownerRouteWrite, refusalWords} from './devices/ownerRoutes'
import type {AgentSessionTrack} from './agentRunModel'
import {STATE_WORD as WAVE_STATE_WORD, type PlanCall, type PlanTarget} from './wavePlan'

/** Factory's score of a song, the edit it takes and its receipt (Factory workflow_score.rs). */
export const SCORE_READING = 'factory.workflow-score/v1'
export const EDIT_REQUEST = 'factory.workflow-edit/v1'
/** AIKit's fill of an instrument's open heads (ai-kit decide_instrument.rs), and QL's instrument it fills. */
export const FILL_REQUEST = 'aikit.instrument-fill-request/v1'
export const FILL_READING = 'aikit.instrument-fill/v1'
export const VAK_BLOCK = 'vak-block'
/** QL's check of an instrument's cells, the cells it takes and its answer (ql-mef team_space.rs check_cells). */
export const INSTRUMENT_CELLS = 'ql.instrument-cells/v1'
export const INSTRUMENT_CELL_CHECK = 'ql.instrument-cell-check/v1'
const QL_CHECK = '`ql context-frame team-space check vak-block`'
/** The cell of a unit's proposal: the unit's heads with the decision model's picks. */
const PROPOSED = '#proposed'

/** The seven heads of a unit's composition, in Factory's spelling, and the head of QL's Vāk-block instrument each is. */
const HEADS: readonly (readonly [string, string])[] = [['CPF', 'vak-cpf'], ['CT', 'vak-ct'], ['CP', 'vak-cp'], ['CF', 'vak-cf'], ['CFP', 'vak-cfp'],
  ['CS', 'vak-cs'], ['direction', 'vak-direction']]

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const texts = (value: unknown): string[] => list(value).map(text).filter((item): item is string => item !== null)

/** What Notes reads, or why nothing is read. */
export type ScoreReading = {readonly state: 'read'; readonly reading: Record<string, unknown>; readonly target: PlanTarget} | {readonly state: 'absent'; readonly why: string}

export const SCORE_NO_TAKE = 'No score is read: the task has no attempt that names its Run and workflow unit, so Factory is asked for none (a task\'s score is its Run\'s song).'
export const SCORE_READING_NOW = 'Factory is reading the score of the song the task\'s Run performs.'
export const SCORE_NOT_HERE = 'No score is read here: no sessions provider reads the session\'s attempts.'
const SCORE_ONE_TASK = 'The session\'s owner holds one bound task: the score is the first task\'s on the track, whose attempts name its Run and unit.'

/** One read of the song's score through the kernel: Factory's reading, or why there is none in Factory's words. */
export async function readScore(call: PlanCall, target: PlanTarget): Promise<ScoreReading> {
  const read = await call({op: 'factory_owner', request: {kind: 'workflow-score-read', state_path: target.statePath, run_ref: target.runRef}})
  if (read.error) return {state: 'absent', why: `Factory did not read the song's score: ${refusalWords(read.error)}`}
  const data = object(read.outcome?.result === 'factory_development_reading' ? read.outcome.data : null)
  if (data?.contract !== SCORE_READING) return {state: 'absent', why: `Factory answered no score (${SCORE_READING}): the Factory installed here may predate \`factory workflow score\`.`}
  return {state: 'read', reading: data, target}
}

/** The edit of the song's file through the kernel (factory_owner `workflow-edit`). */
export const scoreEditOp = (target: PlanTarget, request: SongEdit): KernelOp =>
  ({op: 'factory_owner', request: {kind: 'workflow-edit', state_path: target.statePath, run_ref: target.runRef, request}}) as KernelOp
/** The fill of the open heads through the kernel (aikit_write `decide-fill`), the ask kept against the session. */
export const fillOp = (request: FillRequest | Record<string, never>, agentSession: string | null): KernelOp =>
  aikitWriteOp({kind: 'decide-fill', instrument: VAK_BLOCK, request, ...(agentSession ? {agent_session: agentSession} : {})})

/** One row of the track's Agent rack: an agent its sessions run, or the agent set the group runs (◆). */
export interface RackRow {readonly id: string; readonly name: string; readonly kind: 'agent' | 'set'}

/** The track's Agent rack as score rows: a group's sessions' agents and the Central agent set its SessionSpace names; a lone session's own
 * agent (sessionChainBindings.ts agentsetMembers, the rack's chains). A session with no agent named stands no row. Pure. */
export function rackRowsOf(track: AgentSessionTrack | null, tracks: readonly AgentSessionTrack[]): RackRow[] {
  if (!track) return []
  const group = track.parentRef ? tracks.find(item => item.group && item.sessionRef === track.parentRef) ?? null : null
  const members = group ? tracks.filter(item => !item.group && item.parentRef === group.sessionRef) : [track]
  const rows: RackRow[] = []
  for (const member of members) {
    if (member.agentRef && !rows.some(row => row.id === member.agentRef)) rows.push({id: member.agentRef, name: member.agentName ?? member.purpose ?? member.agentRef, kind: 'agent'})
  }
  if (group?.agentSet) rows.push({id: group.agentSet.ref, name: group.spaceLabel ?? group.purpose ?? group.agentSet.ref, kind: 'set'})
  return rows
}

/** AIKit's picks for one unit, held by the view until Accept or Discard. */
export interface HeldPicks {readonly unit: string; readonly reading: Record<string, unknown>}

/** A unit's picks in Factory's head names: each head AIKit's decision model chose a label for. Pure. */
function picksOf(held: HeldPicks | null, unit: string): Record<string, string> | null {
  if (!held || held.unit !== unit) return null
  const picks = object(held.reading.picks) ?? {}
  const out: Record<string, string> = {}
  for (const [head, vak] of HEADS) { const label = text(object(picks[vak])?.label); if (label) out[head] = label }
  return Object.keys(out).length ? out : null
}

/** A cell of QL's Vāk-block instrument: a unit's chosen labels under QL's head ids. */
export interface VakCell {readonly key: string; readonly chosen: Record<string, readonly string[]>}
/** QL's word on one cell: admitted or refused, the heads it leaves open, in its words. */
export interface CellWord {readonly state: string; readonly why: string; readonly open: readonly string[]}
/** QL's word on the score's cells, or why there is none. */
export type QlWord = {readonly state: 'read'; readonly cells: ReadonlyMap<string, CellWord>} | {readonly state: 'absent'; readonly why: string}

export const QL_WORD_UNASKED = `QL's word on each unit is not read here: nothing carries the units' compositions to QL's engine (${QL_CHECK})`
export const QL_WORD_READING = `QL's engine is checking each unit's composition (${QL_CHECK})`

/** Factory's heads under QL's head ids: each head that holds a label. Pure. */
function chosenOf(heads: Record<string, unknown>): Record<string, string[]> {
  const chosen: Record<string, string[]> = {}
  for (const [head, vak] of HEADS) { const label = text(heads[head]); if (label) chosen[vak] = [label] }
  return chosen
}

const unitsOf = (reading: Record<string, unknown>): Record<string, unknown>[] =>
  list(reading.units).map(object).filter((unit): unit is Record<string, unknown> => unit !== null)

/** The score's cells QL checks: one for each unit, its heads as Factory reads them; and, while picks are held, the unit's heads with the
 * picks as the proposal's own cell. Pure. */
export function vakCellsOf(score: ScoreReading | null, picks: HeldPicks | null): VakCell[] {
  if (score?.state !== 'read') return []
  const units = unitsOf(score.reading)
  const cells: VakCell[] = units.map(unit => ({key: String(unit.key), chosen: chosenOf(object(unit.heads) ?? {})}))
  const held = picks ? picksOf(picks, picks.unit) : null
  const unit = held && picks ? units.find(item => item.key === picks.unit) : null
  if (held && unit && picks) cells.push({key: `${picks.unit}${PROPOSED}`, chosen: chosenOf({...(object(unit.heads) ?? {}), ...held})})
  return cells
}

/** One check of the score's cells by QL's engine through the kernel (ql_read `instrument-check`): its word on each, or why there is none
 * in QL's words. No cell, no ask. */
export async function readQlWord(call: PlanCall, cells: readonly VakCell[]): Promise<QlWord> {
  if (!cells.length) return {state: 'read', cells: new Map()}
  const read = await call({op: 'ql_read', request: {kind: 'instrument-check', instrument: VAK_BLOCK, request: {schema: INSTRUMENT_CELLS, cells}}})
  if (read.error) return {state: 'absent', why: `QL did not check the units' compositions: ${refusalWords(read.error)}`}
  const data = object(read.outcome?.result === 'owner_route_reading' ? read.outcome.data : null)
  if (data?.schema !== INSTRUMENT_CELL_CHECK) {
    return {state: 'absent', why: `QL answered no check of the units (${INSTRUMENT_CELL_CHECK}): the QL installed here may predate \`ql context-frame team-space check\`.`}
  }
  const words = new Map<string, CellWord>()
  for (const cell of list(data.cells).map(object)) {
    const key = text(cell?.key)
    if (key) words.set(key, {state: cell?.state === 'refused' ? 'refused' : 'admitted', why: text(cell?.why) ?? 'QL gave no reason', open: texts(cell?.open)})
  }
  return {state: 'read', cells: words}
}

/** QL's word on the score's own units: refused if it refuses one, in its words. Pure. */
function qlWordOn(units: readonly Record<string, unknown>[], word: QlWord | null | undefined): {refused: boolean; why: string} {
  if (!word) return {refused: false, why: QL_WORD_UNASKED}
  if (word.state === 'absent') return {refused: false, why: `QL's word on each unit is not read: ${word.why}`}
  const refusals: string[] = [], silent: string[] = []
  for (const unit of units) {
    const key = String(unit.key), cell = word.cells.get(key)
    if (!cell) silent.push(key)
    else if (cell.state === 'refused') refusals.push(`QL refuses ${key}: ${cell.why}`)
  }
  if (refusals.length) return {refused: true, why: refusals.join(' · ')}
  if (silent.length) return {refused: false, why: `QL gave no word on ${silent.join(', ')}`}
  return {refused: false, why: units.length ? 'QL admits every unit\'s composition' : 'QL has no unit to check'}
}

/** The engine's word on the score: Factory's check of the song, whether the Run performs this edition, and QL's word on each unit. */
function checkOf(reading: Record<string, unknown>, word: QlWord | null | undefined): {state: string; why: string} {
  const check = object(reading.check) ?? {}, song = object(reading.song) ?? {}
  const refused = check.state === 'refused'
  const words: string[] = []
  if (refused) words.push(`factory workflow check refuses the song's file: ${text(object(check.diagnostic)?.message) ?? 'no reason given'}`)
  else if (check.edition === 'file') words.push('factory workflow check admits the song\'s file')
  else words.push('Factory reads the edition the Run retained')
  if (text(song.why)) words.push(text(song.why)!)
  if (song.edition === 'file' && song.performed === false) words.push('the file was edited: the Run performs the edition it was commissioned with, and the song\'s next Run performs this one')
  const ql = qlWordOn(unitsOf(reading), word)
  words.push(ql.why)
  return {state: refused || ql.refused ? 'refused' : 'admitted', why: words.join(' · ')}
}

const rowKindOf = (kind: unknown): string => kind === 'agent-set' ? 'set' : kind === 'agency' ? 'agency' : 'agent'

/** A clip's score as the design draws a song inside a note (clips/factory.tsx Score): its rows, its units on them with what they wait on,
 * its joins, and the songs inside its own units, as deep as Factory rendered them. Pure. */
export function songScoreOf(song: unknown, depth = 4): Record<string, unknown> | null {
  const score = object(song)
  if (!score || depth < 0) return null
  const rows = list(score.rows).map(object).flatMap(row => {
    const ref = text(row?.ref)
    return ref ? [{id: ref, name: ref.split(/[/:]/).pop() || ref, kind: rowKindOf(row?.kind)}] : []
  })
  return {
    name: text(score.workflowKey) ?? '—',
    rows,
    units: list(score.units).map(object).filter((unit): unit is Record<string, unknown> => unit !== null).map(unit => scoreUnitOf(unit, depth - 1)),
    joins: list(score.joins).map(object).map(join => ({key: String(join?.key), waits: texts(join?.waitsFor), releases: texts(join?.releases), join: 'all'})),
  }
}

/** A canon unit (Factory's `form: canon` in a score, a `songClip` inside a clip's render) stands with the thread form canon, its song
 * inside it, and how many takes Factory started from it (the score's `takes`: Repeat's, Loop's and a routine's Runs of the song,
 * O-I #844). Pure. */
function canonOf(unit: Record<string, unknown>, depth: number): Record<string, unknown> {
  if (unit.form !== 'canon' && !text(unit.songClip)) return {}
  const song = depth >= 0 ? songScoreOf(unit.song, depth) : null
  return {heads: {...(object(unit.heads) ?? {}), CFP: 'CFP5'}, ...(song ? {song} : {}), takes: list(unit.takes).length}
}

/** The score as the design draws it (clips/factory.tsx Score): rows, units, joins and waves in Factory's words, the held picks on their
 * unit; `unit.own` this task's unit; `score.check` the engine's word, Factory's and QL's; `gen.status` QL's word on the proposal. Empty
 * where nothing is read. Pure. */
export function scoreValuesOf(score: ScoreReading | null, rack: readonly RackRow[], picks: HeldPicks | null, word?: QlWord | null): Record<string, Value> {
  if (score?.state !== 'read') return {}
  const {reading, target} = score
  const units = list(reading.units).map(object).filter((unit): unit is Record<string, unknown> => unit !== null)
  const rows: {id: string; name: string; kind: string; rack: boolean}[] = rack.map(row => ({...row, rack: true}))
  for (const row of list(reading.rows).map(object)) {
    const ref = text(row?.ref)
    if (!ref || rows.some(item => item.id === ref)) continue
    rows.push({id: ref, name: ref.split(/[/:]/).pop() || ref, kind: row?.kind === 'agent-set' ? 'set' : row?.kind === 'agency' ? 'agency' : 'agent', rack: false})
  }
  const drawn = {
    name: text(object(reading.song)?.workflowKey) ?? '—',
    rows,
    units: units.map(unit => {
      const held = picksOf(picks, String(unit.key))
      return {...scoreUnitOf(unit), ...(held ? {picks: held} : {})}
    }),
    joins: list(reading.joins).map(object).map(join => ({key: String(join?.key), waits: texts(join?.waitsFor), releases: texts(join?.releases),
      join: join?.join === 'first' ? 'first' : 'all'})),
    waves: list(reading.waves).map(object).map(wave => ({id: String(wave?.wave), name: String(wave?.wave),
      ...(text(wave?.state) ? {state: WAVE_STATE_WORD[String(wave?.state)] ?? String(wave?.state)} : {})})),
  }
  const values: Record<string, Value> = {score: JSON.stringify(drawn), 'score.check': JSON.stringify(checkOf(reading, word))}
  const own = units.find(unit => unit.unitRef === target.unitRef)
  if (own) values['unit.own'] = String(own.key)
  const proposal = picks && word?.state === 'read' ? word.cells.get(`${picks.unit}${PROPOSED}`) : undefined
  if (picks && proposal) values['gen.status'] = JSON.stringify({state: proposal.state, why: `${picks.unit}: ${proposal.why}`})
  return values
}

/** The song's edit Factory takes (factory.workflow-edit/v1). */
export interface SongEdit {readonly contract: string; readonly expectedRevision: string; readonly edits: readonly Record<string, unknown>[]}
/** The fill AIKit takes (aikit.instrument-fill-request/v1): the unit's own words and the heads it has chosen. */
export interface FillRequest {readonly schema: string; readonly subject: Record<string, unknown>; readonly chosen: Record<string, readonly string[]>}

/** The score Notes reads and the owners' writes it goes through: Factory's edit of the song, AIKit's fill of the open heads, and the view's
 * drop of the picks it holds. */
export interface ScorePort {
  readonly reading: ScoreReading
  readonly rack: readonly RackRow[]
  readonly picks: HeldPicks | null
  /** QL's word on the score's cells, the proposal's among them; none where nothing asks QL. */
  readonly word?: QlWord | null
  /** Factory writes the edit and the score is read again, or Factory's refusal is thrown in its words. */
  readonly edit: (request: SongEdit) => Promise<void>
  /** AIKit asks the decision model and its picks are held for the unit, or AIKit's refusal is thrown in its words. */
  readonly fill: (unit: string, request: FillRequest) => Promise<void>
  readonly drop: () => void
}

/** The score's settings the view holds: the chosen note, how the rows fold and highlight, the song opened inside a note, Warp, and the
 * tools' choices before a press. */
const SCORE_VIEW: Readonly<Record<string, string>> = {
  unit: 'the note selected in the score', 'score.fold': 'Fold or Rack: which rows the score shows', 'score.highlight': 'the thread form whose notes are tinted',
  'score.open': 'the song opened inside a note', warp: 'Warp, which lays the log onto the score\'s ruler once the unit has returned',
  'tr.tool': 'Transform\'s tool', 'tr.form': 'the thread form Transform sets', 'tr.to': 'the agent or agent set Transform allocates to',
  'tr.on': 'the unit Transform ties from', 'tr.auto': 'whether Transform applies as you choose',
  'gen.tool': 'Generate\'s tool', 'gen.waves': 'how many waves Generate composes', 'gen.decider': 'the decision model Generate asks',
}
/** The join is the agent set's (O-I #684): Factory combines a stacked step's returns by its set's join, read from Central's agent set as
 * the Run starts; the song holds none. */
export const JOIN_IS_THE_SETS = 'The join is the agent set\'s join: Factory combines a stacked step\'s returns by it, read from Central\'s agent set as the Run starts. Set it on the Agent rack\'s Join; the song holds no join to write (Software Factory, Central).'
export const NO_COMPOSE = 'Compose: composing a song from the task\'s Intent is Anima\'s act as an agent — no operation proposes a workflow from an intent yet (Anima).'
export const GEN_STATUS_ABSENT = `The engine's word on the proposal: no score is read, so QL's engine has no unit to check with the decision model's picks (${QL_CHECK}); Factory checks the composition when you accept it (Quaternal Logic).`
const NOTHING_PROPOSED = `Nothing proposed waits: Fill heads asks the decision model for a unit's open heads, and QL's engine checks its picks with the unit's heads (${QL_CHECK}) (Quaternal Logic).`

/** Why QL's word on the proposal is not on the clip, or null when it is. Pure. */
function proposalWhy(port: ScorePort): string | null {
  const held = port.picks
  if (!held || !picksOf(held, held.unit)) return NOTHING_PROPOSED
  const word = port.word
  if (!word) return `The engine's word on the proposal: ${QL_WORD_UNASKED} (Quaternal Logic).`
  if (word.state === 'absent') return `The engine's word on the proposal: ${word.why.replace(/\.$/, '')} (Quaternal Logic).`
  return word.cells.has(`${held.unit}${PROPOSED}`) ? null : `The engine's word on the proposal: QL gave no word on ${held.unit}'s picks (Quaternal Logic).`
}
const NO_BRANCH = 'A song branches only by allocation: Transform gives units a thread form, an agent or agent set, or a unit to wait on, never a condition.'
const SCORE_KEYS = ['score', 'unit.own', 'score.check'] as const
const SCORE_WRITES = ['score', 'tr.press', 'gen.press', 'gen.accept', 'gen.discard'] as const

/** Why the score is not on the clip, or null when it is. */
function scoreWhy(port: ScorePort | null): string | null {
  if (!port) return SCORE_NOT_HERE
  return port.reading.state === 'absent' ? port.reading.why : null
}

/** The score this task reads: the session's attempts are its bound task's, the first on its track. Pure. */
export function scorePortOf(task: {readonly n: number} | null, port: ScorePort | null): ScorePort | null {
  if (!port || !task || task.n === 1) return port
  return {...port, reading: {state: 'absent', why: SCORE_ONE_TASK}}
}

/** The score's wiring: its keys read from Factory, the person's edits and fills its acts, the tools' choices the view's. Where nothing is
 * read, every key stands absent and every write refused in the same words. `choice` reads the view's holds at the press. Pure. */
export function scoreWiring(port: ScorePort | null, choice: (key: string) => Value | undefined): {
  reads: Record<string, string>; absent: Record<string, string>; acts: Record<string, (value: Value) => Promise<void>>; view: Record<string, string>; refused: Record<string, string>
} {
  const why = scoreWhy(port)
  const refused: Record<string, string> = {'tr.join': JOIN_IS_THE_SETS}
  if (why || !port || port.reading.state !== 'read') {
    for (const key of SCORE_WRITES) refused[key] = why ?? SCORE_NOT_HERE
    return {reads: {}, absent: {...Object.fromEntries(SCORE_KEYS.map(key => [key, why ?? SCORE_NOT_HERE])), 'gen.status': GEN_STATUS_ABSENT}, acts: {}, view: SCORE_VIEW, refused}
  }
  const reading = port.reading.reading, target = port.reading.target
  const status = proposalWhy(port)
  const units = list(reading.units).map(object).filter((unit): unit is Record<string, unknown> => unit !== null)
  const own = text(units.find(unit => unit.unitRef === target.unitRef)?.key)
  const selected = (): Record<string, unknown> => {
    const key = text(choice('unit')) ?? own
    const unit = units.find(item => item.key === key)
    if (!unit) throw new Error(key ? `The score holds no unit ${key}.` : 'Select a note in the score: no unit is chosen.')
    return unit
  }
  const rows = new Map<string, string>([...port.rack.map(row => [row.id, row.kind] as const),
    ...list(reading.rows).map(object).map(row => [String(row?.ref), row?.kind === 'agent-set' ? 'set' : String(row?.kind)] as const)])
  const allocation = (ref: string) => {
    const kind = rows.get(ref)
    if (kind === 'agent') return {kind: 'agent', ref}
    if (kind === 'set') return {kind: 'agent-set', ref}
    throw new Error(kind === 'agency' ? `${ref} is an agency: Factory gives a unit to an agent or an agent set.` : `${ref} is no row of the score.`)
  }
  const edit = async (edits: Record<string, unknown>[]) => {
    const song = object(reading.song)
    const revision = text(object(song?.file)?.byteRevision)
    if (!revision) throw new Error(`Factory writes no edit of this song: ${text(song?.why) ?? 'no file under the project root holds it'}`)
    await port.edit({contract: EDIT_REQUEST, expectedRevision: revision, edits})
  }
  const acts: Record<string, (value: Value) => Promise<void>> = {
    // A note dragged to another row: the unit given to that row's agent or agent set. Only a row moves on the score.
    score: async value => {
      const moved = object(typeof value === 'string' ? JSON.parse(value) : value)
      const after = list(moved?.units).map(object)
      const edits: Record<string, unknown>[] = []
      for (const unit of units) {
        const now = after.find(item => item?.key === unit.key)
        if (!now) throw new Error(`The score's change drops ${String(unit.key)}: only a note's row moves on the score.`)
        const {row, ...rest} = now
        const was = scoreUnitOf(unit)
        if (JSON.stringify(sansRow(was)) !== JSON.stringify(sansPicks(rest))) throw new Error(`Only a note's row moves on the score: ${String(unit.key)} changed otherwise.`)
        if (row !== unit.row) edits.push({op: 'allocate', units: [unit.key], to: allocation(String(row))})
      }
      if (edits.length) await edit(edits)
    },
    'tr.press': async () => {
      const unit = selected(), key = unit.key
      const tool = text(choice('tr.tool')) ?? 'form'
      if (tool === 'allocate') {
        const to = text(choice('tr.to'))
        if (!to) throw new Error('Choose the agent or agent set Allocate gives the unit to.')
        return edit([{op: 'allocate', units: [key], to: allocation(to)}])
      }
      if (tool === 'connect') {
        const on = text(choice('tr.on'))
        if (!on) throw new Error('Choose the unit this one waits on.')
        return edit([{op: 'connect', unit: key, waitsOn: on}])
      }
      if (tool === 'form') return edit([{op: 'heads', unit: key, heads: {CFP: text(choice('tr.form')) ?? 'CFP3'}}])
      throw new Error(NO_BRANCH)
    },
    'gen.press': async () => {
      if ((text(choice('gen.tool')) ?? 'compose') !== 'heads') throw new Error(NO_COMPOSE)
      const unit = selected(), key = String(unit.key)
      const heads = object(unit.heads) ?? {}
      const chosen: Record<string, string[]> = {}
      for (const [head, vak] of HEADS) { const label = text(heads[head]); if (label) chosen[vak] = [label] }
      if (Object.keys(chosen).length === HEADS.length) throw new Error(`Every head of ${key} has its label: nothing is open, so the decision model is not asked (zero heads, zero calls).`)
      const subject: Record<string, unknown> = {key, unitRef: unit.unitRef, row: unit.row}
      for (const field of ['concern', 'requiredDifference', 'returns', 'success', 'sources'] as const) if (unit[field] !== undefined && unit[field] !== null) subject[field] = unit[field]
      await port.fill(key, {schema: FILL_REQUEST, subject, chosen})
    },
    'gen.accept': async () => {
      const held = port.picks, picks = held ? picksOf(held, held.unit) : null
      if (!held || !picks) throw new Error('Nothing proposed waits.')
      await edit([{op: 'heads', unit: held.unit, heads: picks}])
      port.drop()
    },
    'gen.discard': async () => {
      if (!port.picks) throw new Error('Nothing proposed waits.')
      port.drop()
    },
  }
  return {
    reads: {
      score: 'Factory\'s score of the song the task\'s Run performs (factory workflow score): its units with their compositions, who does each, its joins and waves, on the rows of the track\'s Agent rack — its agents and agent sets — then those the song names that the rack does not hold',
      'unit.own': 'the unit the task\'s latest attempt names, as Factory keys it',
      'score.check': `Factory's check of the song's file (factory workflow check), whether the Run performs it, and QL's word on each unit's composition, its seven heads a Vāk-block cell (${QL_CHECK})`,
      ...(status ? {} : {'gen.status': `QL's word on the proposal: the unit's heads with the decision model's picks, checked as a Vāk-block cell (${QL_CHECK})`}),
    },
    absent: status ? {'gen.status': status} : {},
    acts,
    view: SCORE_VIEW,
    refused,
  }
}

/** A unit as the design draws it (and as a moved score is compared with the one read): a canon with its song inside it. */
function scoreUnitOf(unit: Record<string, unknown>, depth = 4): Record<string, unknown> {
  const heads = object(unit.heads)
  return {key: String(unit.key), row: text(unit.row) ?? '', deps: texts(unit.dependencies), ...(text(unit.wave) ? {wave: text(unit.wave)} : {}), ...(heads ? {heads} : {}),
    concern: unit.concern, returns: unit.returns, sources: unit.sources, success: unit.success, may: unit.may, stop: unit.stop, escalate: unit.escalate,
    ...canonOf(unit, depth)}
}
const sansRow = ({row: _row, ...rest}: Record<string, unknown>) => rest
const sansPicks = ({picks: _picks, ...rest}: Record<string, unknown>) => JSON.parse(JSON.stringify(rest)) as Record<string, unknown>

/** AIKit's fill reading, held only when it is one and the model answered: else AIKit's words, thrown. Pure. */
export function fillReadingOf(data: unknown): Record<string, unknown> {
  const reading = object(data)
  if (reading?.schema !== FILL_READING) throw new Error(`AIKit answered no fill of the open heads (${FILL_READING}): the AIKit installed here may predate \`aikit decide invoke --instrument\`.`)
  if (reading.outcome === 'failed') throw new Error(`AIKit's decision model did not fill the heads: ${text(reading.why) ?? 'it returned no answer'}`)
  if (reading.outcome === 'nothing-open') throw new Error('AIKit found no open head on the unit: nothing was asked (zero heads, zero calls).')
  return reading
}

/** The kernel op as the read calls it. */
const carried = (transport: KernelTransportStatus): PlanCall => op =>
  kernelOp(transport, op as Parameters<typeof kernelOp>[1]) as unknown as ReturnType<PlanCall>

/** The task's score, read once per Run and again after an edit; AIKit's picks held for one unit until Accept or Discard; and, where
 * `checked`, QL's word on its cells, asked again whenever they change. */
export function useScore(transport: KernelTransportStatus, target: PlanTarget | null, rack: readonly RackRow[], agentSession: string | null,
  checked = false): ScorePort {
  const key = target ? JSON.stringify([transport, target.statePath, target.runRef, target.unitRef]) : null
  const [epoch, setEpoch] = useState(0)
  const [answer, setAnswer] = useState<{key: string; reading: ScoreReading} | null>(null)
  const [picks, setPicks] = useState<{key: string; held: HeldPicks} | null>(null)
  // A song dropped on a track, or a Run act the kernel carried, may have changed the song's file: read it again (owners/notices.ts).
  useEffect(() => onOwnerChanged('temporal', () => setEpoch(n => n + 1)), [])
  useEffect(() => {
    if (!key || !target || transport.kind === 'unavailable') return
    let live = true
    void readScore(carried(transport), target).then(reading => { if (live) setAnswer({key, reading}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, epoch])
  const reading: ScoreReading = !target ? {state: 'absent', why: SCORE_NO_TAKE}
    : transport.kind === 'unavailable' ? {state: 'absent', why: `Factory is not reached: ${transport.reason ?? 'the shell has no kernel carrier'}.`}
      // The last answer stands until the next arrives, so the score never flickers to unread between reads.
      : answer?.key === key ? answer.reading : {state: 'absent', why: SCORE_READING_NOW}
  const held = picks && picks.key === key ? picks.held : null
  const cells = checked ? vakCellsOf(reading, held) : []
  const wordKey = JSON.stringify([key, cells])
  const [said, setSaid] = useState<{key: string; word: QlWord} | null>(null)
  useEffect(() => {
    if (!cells.length || transport.kind === 'unavailable') return
    let live = true
    void readQlWord(carried(transport), cells).then(word => { if (live) setSaid({key: wordKey, word}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordKey])
  const word: QlWord | null = !cells.length ? null
    : transport.kind === 'unavailable' ? {state: 'absent', why: `QL is not reached: ${transport.reason ?? 'the shell has no kernel carrier'}.`}
      : said?.key === wordKey ? said.word : {state: 'absent', why: QL_WORD_READING}
  const rackKey = JSON.stringify(rack)
  return useMemo((): ScorePort => ({
    reading,
    rack,
    picks: held,
    word,
    edit: async request => {
      if (!target) throw new Error(SCORE_NO_TAKE)
      await factoryOwnerWrite(transport, (scoreEditOp(target, request) as {request: {kind: string}}).request, '`factory workflow edit`')
      setEpoch(n => n + 1)
    },
    fill: async (unit, request) => {
      const answered = await ownerRouteWrite(transport, fillOp(request, agentSession), '`aikit decide invoke --instrument vak-block`')
      setPicks({key: key ?? '', held: {unit, reading: fillReadingOf(answered.data)}})
    },
    drop: () => setPicks(null),
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [reading, picks, key, rackKey, agentSession, word])
}
