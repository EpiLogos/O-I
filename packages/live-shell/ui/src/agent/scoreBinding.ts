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
//   - Compose (a song from the task's Intent, O-I 844) is Anima's act, under its own tenure, through its team (lead rulings, round 15).
//     The press sends one Communique to the session's orchestrator Position (`gateway_write send`, `aikit gateway send`) carrying the
//     Intent, the clip's Constellation and its sources, the song's identity and where the answer goes, and the desk keeps that
//     Communique's id (composeAskOf). Anima's body delegates through its own team tool (AIKit's team_operation; the desk is never an
//     occupant) and answers the person: `aikit gateway send --to @owner --propose --reply-to <the ask>`, a proposal Central's receiving
//     ledger holds from its Position, its body Factory's own edit (factory.workflow-edit/v1). The desk reads the ledger (`receiving`
//     List and Read) for the proposal from that Position that answers the ask; one for another ask, a second one, or one whose body is
//     no edit is not taken, and said so (composeAnswerOf). The proposal goes through QL's check of the heads it gives, then Factory's
//     admission (`factory workflow edit --check`, factory_owner `workflow-edit-check`); the person's Accept is one act, the proposal
//     accepted in Central's ledger and the edit applied by Factory, and Discard declines it in Central. Nothing is written to the song
//     before Accept, and each refusal is its owner's words. With no one occupying the orchestrator's Position the press is refused,
//     naming the Position and how its body starts (`aikit inhabit --position …`); nothing is queued.
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
import {receivingWire, type ReceivingRequest} from '../../../../../desktop/cradle/src/receiving/client'
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
/** The cell of a unit as Anima's composition proposes it: the unit's heads with the heads the proposal gives. */
const COMPOSED = '#composed'
/** Compose's ask (the machine block of its Communique) and Factory's answer to an edit it checks without writing it. */
export const COMPOSE_ASK = 'oi.compose-ask/v1'
export const EDIT_RECEIPT = 'factory.workflow-edit-receipt/v1'

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
export function scoreValuesOf(score: ScoreReading | null, rack: readonly RackRow[], picks: HeldPicks | null, word?: QlWord | null,
  compose?: ComposeState | null): Record<string, Value> {
  if (score?.state !== 'read') return {}
  const {reading, target} = score
  const units = list(reading.units).map(object).filter((unit): unit is Record<string, unknown> => unit !== null)
  const proposal = compose?.state === 'answered' ? compose.answer.proposal : null
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
      const composed = composedOn(proposal, String(unit.key))
      return {...scoreUnitOf(unit), ...(held || composed?.picks ? {picks: {...held, ...composed?.picks}} : {}), ...(composed ? {proposed: true} : {})}
    }),
    joins: list(reading.joins).map(object).map(join => ({key: String(join?.key), waits: texts(join?.waitsFor), releases: texts(join?.releases),
      join: join?.join === 'first' ? 'first' : 'all'})),
    waves: list(reading.waves).map(object).map(wave => ({id: String(wave?.wave), name: String(wave?.wave),
      ...(text(wave?.state) ? {state: WAVE_STATE_WORD[String(wave?.state)] ?? String(wave?.state)} : {})})),
  }
  const values: Record<string, Value> = {score: JSON.stringify(drawn), 'score.check': JSON.stringify(checkOf(reading, word))}
  const own = units.find(unit => unit.unitRef === target.unitRef)
  if (own) values['unit.own'] = String(own.key)
  const picked = picks && word?.state === 'read' ? word.cells.get(`${picks.unit}${PROPOSED}`) : undefined
  if (picks && picked) values['gen.status'] = JSON.stringify({state: picked.state, why: `${picks.unit}: ${picked.why}`})
  const composing = compose ? composeStatusOf(compose) : null
  if (composing) values['gen.status'] = JSON.stringify(composing)
  const asks = compose ? composeAsksOf(compose) : null
  if (asks) values['gen.asks'] = asks
  return values
}

/** What a proposal does to one unit: whether it names the unit, and the heads it gives it, in Factory's head names. Pure. */
function composedOn(proposal: SongEdit | null, unit: string): {picks?: Record<string, string>} | null {
  if (!proposal) return null
  const edits = proposal.edits.filter(edit => edit.unit === unit || texts(edit.units).includes(unit))
  if (!edits.length) return null
  const picks: Record<string, string> = {}
  for (const edit of edits) if (edit.op === 'heads') for (const [head, label] of Object.entries(object(edit.heads) ?? {})) if (text(label)) picks[head] = String(label)
  return Object.keys(picks).length ? {picks} : {}
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
  /** Factory writes the edit and the score is read again (its receipt answered), or Factory's refusal is thrown in its words. */
  readonly edit: (request: SongEdit) => Promise<unknown>
  /** AIKit asks the decision model and its picks are held for the unit, or AIKit's refusal is thrown in its words. */
  readonly fill: (unit: string, request: FillRequest) => Promise<void>
  readonly drop: () => void
  /** Compose: Anima's proposal for the song, asked, read in Central's ledger, judged by QL and Factory; none where nothing composes. */
  readonly compose?: ComposePort | null
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
// REPLACED (O-I 844, round 15): NO_COMPOSE, which refused Compose ("no operation proposes a workflow from an intent yet (Anima)").
// Compose asks the session's orchestrator, under its own tenure, and takes its proposal from Central's receiving ledger (useCompose).
export const COMPOSE_NOT_HERE = 'Compose: no team is read for this task here, so no one is asked to compose (Anima composes through the session\'s agent set).'
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
  // Where Compose cannot ask, its press says why before it is pressed: the address it would ask stands refused in the owners' words.
  const unasked = !port?.compose ? COMPOSE_NOT_HERE : port.compose.state.state === 'unaddressed' ? port.compose.state.why : null
  if (unasked) refused['gen.asks'] = unasked
  if (why || !port || port.reading.state !== 'read') {
    for (const key of SCORE_WRITES) refused[key] = why ?? SCORE_NOT_HERE
    return {reads: {}, absent: {...Object.fromEntries(SCORE_KEYS.map(key => [key, why ?? SCORE_NOT_HERE])), 'gen.status': GEN_STATUS_ABSENT, 'gen.asks': why ?? SCORE_NOT_HERE},
      acts: {}, view: SCORE_VIEW, refused}
  }
  const reading = port.reading.reading, target = port.reading.target
  const compose = port.compose ?? null
  const composing = compose ? composeStatusOf(compose.state) : null
  const status = composing ? null : proposalWhy(port)
  const tool = () => text(choice('gen.tool')) ?? 'compose'
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
      if (tool() !== 'heads') {
        if (!compose) throw new Error(COMPOSE_NOT_HERE)
        return compose.ask()
      }
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
      if (tool() !== 'heads') {
        if (!compose) throw new Error(COMPOSE_NOT_HERE)
        return compose.accept()
      }
      const held = port.picks, picks = held ? picksOf(held, held.unit) : null
      if (!held || !picks) throw new Error('Nothing proposed waits.')
      await edit([{op: 'heads', unit: held.unit, heads: picks}])
      port.drop()
    },
    'gen.discard': async () => {
      if (tool() !== 'heads') {
        if (!compose) throw new Error(COMPOSE_NOT_HERE)
        return compose.discard()
      }
      if (!port.picks) throw new Error('Nothing proposed waits.')
      port.drop()
    },
  }
  return {
    reads: {
      score: 'Factory\'s score of the song the task\'s Run performs (factory workflow score): its units with their compositions, who does each, its joins and waves, on the rows of the track\'s Agent rack — its agents and agent sets — then those the song names that the rack does not hold',
      'unit.own': 'the unit the task\'s latest attempt names, as Factory keys it',
      'score.check': `Factory's check of the song's file (factory workflow check), whether the Run performs it, and QL's word on each unit's composition, its seven heads a Vāk-block cell (${QL_CHECK})`,
      ...(status ? {} : {'gen.status': composing
        ? 'Compose\'s word: its ask to the session\'s orchestrator, the proposal Central\'s receiving ledger holds in answer, and QL\'s check of the heads it gives and Factory\'s admission of it (factory workflow edit --check)'
        : `QL's word on the proposal: the unit's heads with the decision model's picks, checked as a Vāk-block cell (${QL_CHECK})`}),
      ...(compose && compose.state.state !== 'unaddressed' ? {'gen.asks': 'where Compose asks: the Position the session\'s orchestrator occupies (aikit gateway who), from Central\'s agent set'} : {}),
    },
    absent: {...(status ? {'gen.status': status} : {}),
      ...(!compose ? {'gen.asks': COMPOSE_NOT_HERE} : compose.state.state === 'unaddressed' ? {'gen.asks': compose.state.why} : {})},
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

// ---------------------------------------------------------------------------------------------------------------- Compose

/** Where Compose asks: the Position the session's orchestrator occupies, its agent and the agent set it orchestrates. */
export interface ComposeAddress {readonly position: string; readonly agent: string; readonly set: string}
export type ComposeTo = {readonly state: 'addressed'; readonly address: ComposeAddress} | {readonly state: 'refused'; readonly why: string}
/** An owner's answer as the window holds it. */
export interface HeldAnswer {readonly status: string; readonly value?: unknown; readonly error?: string | null}
/** What Compose's address is read from: Central's agent set the group's space names (`central.agent-set.read`), and AIKit's population
 * (`aikit gateway who`). */
export interface ComposeGround {readonly set: HeldAnswer | null; readonly population: HeldAnswer | null}

/** Compose's address, or why it has none, in the owners' words. Pure. */
export function composeAddressOf(track: AgentSessionTrack | null, tracks: readonly AgentSessionTrack[], ground: ComposeGround): ComposeTo {
  const refused = (why: string): ComposeTo => ({state: 'refused', why: `Compose: ${why}`})
  if (!track) return refused('no task is selected.')
  const group = track.parentRef ? tracks.find(item => item.group && item.sessionRef === track.parentRef) ?? null : null
  const setRef = group?.agentSet?.ref
  if (!setRef) return refused('Anima composes through the session\'s team, and this session stands in no agent set (set one on the Agent rack).')
  const set = ground.set
  if (!set || set.status !== 'answered') {
    return refused(set?.status === 'refused' ? `Central did not read the agent set ${setRef}: ${set.error ?? 'no reason given'}` : `Central has not answered its agent set ${setRef} yet (\`central.agent-set.read\`).`)
  }
  const record = object(object(set.value)?.record) ?? object(set.value)
  const orchestrator = text(record?.orchestrator_agent_ref)
  if (!orchestrator) return refused(`the agent set ${setRef} names no orchestrator (central.agent-set/v1 orchestrator_agent_ref), so no one composes for its team.`)
  const population = ground.population
  if (!population || population.status !== 'answered') {
    return refused(population?.status === 'refused' ? `AIKit did not read who is here: ${population.error ?? 'no reason given'}` : 'AIKit has not answered who is here yet (`aikit gateway who`).')
  }
  const reading = object(population.value) ?? {}
  const positions = list(reading.positions).map(object).filter((row): row is Record<string, unknown> => row !== null)
  const agents = list(reading.agents).map(object).filter((row): row is Record<string, unknown> => row !== null)
  const held = [...new Set([
    ...positions.filter(row => object(row.occupancy)?.agent_ref === orchestrator).map(row => text(row.position_ref)).filter((ref): ref is string => !!ref),
    ...texts(agents.find(row => row.agent_ref === orchestrator)?.positions)])]
  if (!held.length) return refused(`${orchestrator}, the orchestrator of ${setRef}, holds no Position here (\`aikit gateway who\`), so nothing can be asked of it.`)
  const occupancyOf = (ref: string) => object(positions.find(row => row.position_ref === ref)?.occupancy)
  const occupied = held.find(ref => occupancyOf(ref)?.state === 'occupied' && occupancyOf(ref)?.agent_ref === orchestrator)
  if (!occupied) {
    return refused(`no one occupies ${held[0]}, where ${orchestrator} composes for ${setRef}: its body starts with \`aikit inhabit --position ${held[0]}\`, and nothing is asked until it does.`)
  }
  return {state: 'addressed', address: {position: occupied, agent: orchestrator, set: setRef}}
}

/** What Compose carries: the Intent (the task's Run's required difference), the clip's Constellation and its members' refs. */
export interface ComposeWords {readonly intent: string | null; readonly intentWhy?: string | null; readonly constellation: string | null; readonly sources: readonly string[]}
/** The ask the desk keeps: the Communique's id, the Position asked, the register its answer is read in, the song's revision it was asked
 * against, and when. */
export interface ComposeAsked {readonly communique: string; readonly position: string; readonly project: string | null; readonly revision: string; readonly at: number}

/** The Communique Compose sends: its words for Anima, then the ask as one JSON block (oi.compose-ask/v1). Pure. */
export function composeAskOf(address: ComposeAddress, words: ComposeWords, reading: Record<string, unknown>, target: PlanTarget, project: string | null): {body: string; revision: string} {
  const song = object(reading.song) ?? {}
  const revision = text(object(song.file)?.byteRevision)
  if (!revision) throw new Error(`Compose: Factory writes no edit of this song, so nothing can be composed into it: ${text(song.why) ?? 'no file under the project root holds it'}`)
  if (!words.intent) throw new Error(`Compose writes from the task's Intent, and it is not read: ${words.intentWhy ?? 'no intent is read here'}`)
  const name = text(song.workflowKey) ?? target.runRef
  const answer = ['aikit gateway send --to @owner --propose --reply-to <this Communique>', `--subject "Compose: ${name}"`,
    ...(project ? [`--project-world ${project}`] : []), '--body-file -'].join(' ')
  const ask = {schema: COMPOSE_ASK, intent: words.intent, constellation: words.constellation, sources: words.sources,
    song: {workflowKey: name, runRef: target.runRef, statePath: target.statePath, byteRevision: revision}, set: address.set,
    answer: {to: '@owner', propose: true, register: project, contract: EDIT_REQUEST, expectedRevision: revision}}
  const body = [`Compose a first score for the song ${name}, from the task's Intent, through your team (${address.set}).`, '',
    `Intent: ${words.intent}`,
    `Sources: ${words.constellation ?? 'no constellation'}${words.sources.length ? ` — ${words.sources.join(', ')}` : ''}`,
    `Song: ${name} (Run ${target.runRef}, its file at revision ${revision})`, '',
    `Answer the person with one proposal that replies to this Communique (\`${answer}\`), holding your score as one JSON block of ${EDIT_REQUEST} against revision ${revision}. Nothing is written to the song until QL and Factory admit it and the person accepts it.`,
    '', '```json', JSON.stringify(ask), '```'].join('\n')
  return {body, revision}
}

/** The one Communique Compose sends: to the orchestrator's Position, through AIKit's gateway (`aikit gateway send`, the kernel's
 * gateway_write send). It carries no sender: the desk is never an occupant. Pure. */
export const composeSendOp = (address: ComposeAddress, body: string, project: string | null): KernelOp =>
  ({op: 'gateway_write', request: {kind: 'send', ...(project ? {project} : {}), to: address.position, body}} as KernelOp)

/** The ask the desk keeps, from AIKit's answer to the send: the Communique it recorded (its reading's `communique`, by its ref, as
 * messagesBinding.ts communiqueRefOf reads it). Throws when the answer names none, since then no answer could be told from another. Pure. */
export function composeAskedOf(sent: unknown, address: ComposeAddress, project: string | null, revision: string, at: number): ComposeAsked {
  const communique = text(object(object(sent)?.communique)?.communique_ref)
  if (!communique) throw new Error('Compose: AIKit\'s send answered no Communique, so its answer could not be told from another.')
  return {communique, position: address.position, project, revision, at}
}

/** Anima's answer as the ledger holds it: waiting (with the proposals from the Position that answer something else), the proposal taken
 * with its Return and status, or why it is not taken. */
export type ComposeAnswer = {readonly state: 'waiting'; readonly others: number}
  | {readonly state: 'answered'; readonly returnRef: string; readonly revision: string; readonly status: string; readonly proposal: SongEdit; readonly later: number}
  | {readonly state: 'refused'; readonly returnRef: string; readonly revision: string; readonly status: string; readonly why: string; readonly later: number}

/** The receiving op of one register, in Central's own request (desktop/cradle/src/receiving/client.ts receivingWire). */
const receivingOp = (project: string | null, request: ReceivingRequest): KernelOp => ({op: 'receiving', project, request: receivingWire(request)} as KernelOp)
const receivingData = (call: {outcome?: {result?: string; data?: unknown} | null; error?: string}, asked: string): Record<string, unknown> => {
  if (call.error) throw new Error(`Central's receiving ledger did not answer ${asked}: ${refusalWords(call.error)}`)
  if (call.outcome?.result !== 'receiving_reading') throw new Error(`Central's receiving ledger answered ${asked} with no reading.`)
  return object(call.outcome.data) ?? {}
}
/** At most this many pages of a register are read for one answer. */
const LEDGER_PAGES = 10

/** Anima's answer to one ask, read from Central's receiving ledger: the proposals its Position made since the ask, each read for the
 * Communique it replies to. The first that replies to the ask is taken; a later one is not, nor one replying to another. */
export async function composeAnswerOf(call: PlanCall, asked: ComposeAsked): Promise<ComposeAnswer> {
  const since = Math.floor(asked.at / 1000) - 60
  const rows: Record<string, unknown>[] = []
  let after = 0
  for (let page = 0; page < LEDGER_PAGES; page++) {
    const data = receivingData(await call(receivingOp(asked.project, {kind: 'list', after, limit: 200})), 'the list of what it received')
    for (const row of list(data.returns).map(object)) {
      if (row && row.kind === 'request' && object(row.request)?.kind === 'proposal' && object(row.declared_producer)?.ref === asked.position
        && Number(row.received_at_unix_seconds ?? 0) >= since) rows.push(row)
    }
    if (data.more !== true || typeof data.next_after !== 'number') break
    after = data.next_after
  }
  const answers: Record<string, unknown>[] = []
  let others = 0
  for (const row of rows.sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))) {
    const reading = receivingData(await call(receivingOp(asked.project, {kind: 'read', return_ref: String(row.return_ref)})), String(row.return_ref))
    if (object(reading.record)?.reply_to === asked.communique) answers.push(reading)
    else others++
  }
  const first = answers[0]
  if (!first) return {state: 'waiting', others}
  const record = object(first.record) ?? {}
  const returnRef = String(first.return_ref), revision = String(first.revision), status = String(record.status)
  const later = answers.length - 1
  const request = object(record.request) ?? {}
  const body = text(request.body) ?? text(request.subject) ?? ''
  const blocks = [...body.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].map(match => match[1]!)
  const parsed = [...blocks, body].map(block => { try { return object(JSON.parse(block)) } catch { return null } })
  const proposal = parsed.find(value => value?.contract === EDIT_REQUEST)
  const refused = (why: string): ComposeAnswer => ({state: 'refused', returnRef, revision, status, why, later})
  if (!proposal) return refused(`Anima's proposal (${returnRef}) holds no ${EDIT_REQUEST}, so it is not taken: “${(text(request.subject) ?? '').slice(0, 160)}”`)
  if (proposal.expectedRevision !== asked.revision) {
    return refused(`Anima's proposal (${returnRef}) is against revision ${String(proposal.expectedRevision)}, and the song was asked at ${asked.revision}: discard it and ask again.`)
  }
  if (!list(proposal.edits).length) return refused(`Anima's proposal (${returnRef}) names no edit.`)
  return {state: 'answered', returnRef, revision, status, proposal: proposal as unknown as SongEdit, later}
}

/** The cells QL checks of a proposal: each unit it gives heads, with the unit's own heads under them. Pure. */
export function composedCellsOf(score: ScoreReading | null, proposal: SongEdit): VakCell[] {
  const units = score?.state === 'read' ? unitsOf(score.reading) : []
  const given = new Map<string, Record<string, unknown>>()
  for (const edit of proposal.edits) {
    if (edit.op !== 'heads' || !text(edit.unit)) continue
    given.set(String(edit.unit), {...(given.get(String(edit.unit)) ?? {}), ...(object(edit.heads) ?? {})})
  }
  return [...given].map(([unit, heads]) => ({key: `${unit}${COMPOSED}`,
    chosen: chosenOf({...(object(units.find(item => item.key === unit)?.heads) ?? {}), ...heads})}))
}

/** The owners' word on a proposal: QL's check of the heads it gives, then Factory's admission of the edit, written nowhere. */
export async function judgeProposal(call: PlanCall, score: ScoreReading, proposal: SongEdit): Promise<{state: 'admitted' | 'refused'; why: string}> {
  if (score.state !== 'read') return {state: 'refused', why: score.why}
  const cells = composedCellsOf(score, proposal)
  if (cells.length) {
    const word = await readQlWord(call, cells)
    if (word.state === 'absent') return {state: 'refused', why: `QL's word on Anima's proposal is not read: ${word.why}`}
    const refusals = cells.flatMap(cell => {
      const said = word.cells.get(cell.key)
      return said?.state === 'refused' ? [`QL refuses ${cell.key.slice(0, -COMPOSED.length)}: ${said.why}`] : !said ? [`QL gave no word on ${cell.key.slice(0, -COMPOSED.length)}`] : []
    })
    if (refusals.length) return {state: 'refused', why: refusals.join(' · ')}
  }
  const target = score.target
  const checked = await call({op: 'factory_owner', request: {kind: 'workflow-edit-check', state_path: target.statePath, run_ref: target.runRef, request: proposal}})
  if (checked.error) return {state: 'refused', why: `Factory refuses Anima's proposal: ${refusalWords(checked.error)}`}
  const receipt = object(checked.outcome?.result === 'factory_development_reading' ? checked.outcome.data : null)
  if (receipt?.contract !== EDIT_RECEIPT || receipt.written !== false) {
    return {state: 'refused', why: `Factory answered no admission of the edit (${EDIT_RECEIPT}, written false): the Factory installed here may predate \`factory workflow edit --check\`.`}
  }
  const heads = cells.length ? 'QL admits the heads it gives' : 'it gives no heads for QL to check'
  return {state: 'admitted', why: `Anima's proposal: ${proposal.edits.length} edit${proposal.edits.length === 1 ? '' : 's'}; ${heads}, and Factory admits it (factory workflow edit --check). Accept writes it into the song.`}
}

/** Accept, one act: the proposal accepted in Central's ledger with the person's authority (`receiving` Review), then the edit applied
 * by Factory. A proposal Central already holds accepted is not reviewed again, so a Factory refusal after it is repeated by pressing
 * Accept again. */
export async function acceptComposed(call: PlanCall, project: string | null, answer: {returnRef: string; revision: string; status: string; proposal: SongEdit},
  edit: (request: SongEdit) => Promise<unknown>): Promise<void> {
  if (answer.status === 'rejected') throw new Error(`The person declined Anima's proposal in Central (${answer.returnRef}): ask again.`)
  if (answer.status !== 'accepted' && answer.status !== 'included') {
    receivingData(await call(receivingOp(project, {kind: 'review', return_ref: answer.returnRef, expected_return_revision: answer.revision, disposition: 'accepted',
      note: 'Accepted on the task\'s clip: Factory writes it into the song.'})), 'the acceptance')
  }
  try {
    await edit(answer.proposal)
  } catch (error) {
    throw new Error(`Central holds Anima's proposal accepted (${answer.returnRef}), and Factory did not write it: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Discard: the proposal declined in Central's ledger (`receiving` Review rejected). One Central already settled is only forgotten. */
export async function declineComposed(call: PlanCall, project: string | null, answer: {returnRef: string; revision: string; status: string}): Promise<void> {
  if (answer.status !== 'pending' && answer.status !== 'needs-review') return
  receivingData(await call(receivingOp(project, {kind: 'review', return_ref: answer.returnRef, expected_return_revision: answer.revision, disposition: 'rejected',
    note: 'Discarded on the task\'s clip.'})), 'the declining')
}

/** Compose as the clip reads it: unaddressed (why), ready to ask, asked and waiting, or answered with the owners' word. */
export type ComposeState = {readonly state: 'unaddressed'; readonly why: string} | {readonly state: 'ready'; readonly address: ComposeAddress}
  | {readonly state: 'asked'; readonly asked: ComposeAsked; readonly others: number; readonly why?: string}
  | {readonly state: 'answered'; readonly asked: ComposeAsked; readonly answer: Extract<ComposeAnswer, {state: 'answered'}>; readonly word: 'admitted' | 'refused' | 'checking'; readonly why: string}
  | {readonly state: 'refused'; readonly asked: ComposeAsked; readonly answer: Extract<ComposeAnswer, {state: 'refused'}>}

/** Compose's acts: Ask sends the Communique (or throws why not); Accept and Discard act on the proposal taken; Drop forgets the ask. */
export interface ComposePort {
  readonly state: ComposeState
  readonly ask: () => Promise<void>
  readonly accept: () => Promise<void>
  readonly discard: () => Promise<void>
}

const laterWords = (later: number) => later ? ` (${later} later proposal${later === 1 ? '' : 's'} answering the same ask ${later === 1 ? 'is' : 'are'} not taken)` : ''
const othersWords = (others: number) => others ? ` ${others} proposal${others === 1 ? '' : 's'} from it since then answer${others === 1 ? 's' : ''} another Communique and ${others === 1 ? 'is' : 'are'} not taken.` : ''

/** Compose's word on the clip (`gen.status`), in the owners' words. Pure. */
export function composeStatusOf(state: ComposeState): {state: string; why: string} | null {
  switch (state.state) {
    case 'asked': return {state: 'asked', why: state.why ?? `Compose asked ${state.asked.position} (${state.asked.communique}): no proposal in Central's receiving ledger answers it yet.${othersWords(state.others)}`}
    case 'answered': return state.word === 'checking'
      ? {state: 'asked', why: `Anima proposed (${state.answer.returnRef}): QL and Factory are checking it.`}
      : {state: state.word, why: `${state.why}${laterWords(state.answer.later)}`}
    case 'refused': return {state: 'refused', why: `${state.answer.why}${laterWords(state.answer.later)}`}
    default: return null
  }
}

/** Where Compose asks, on the clip (`gen.asks`). Pure. */
export function composeAsksOf(state: ComposeState): string | null {
  if (state.state === 'ready') return `${state.address.position} · ${state.address.agent}, the orchestrator of ${state.address.set}`
  return state.state === 'unaddressed' ? null : state.asked.position
}

/** The asks the desk keeps for the window, by the Run they compose for (a press while one waits is refused). */
const ASKS = new Map<string, ComposeAsked>()
const askKey = (target: PlanTarget) => JSON.stringify([target.statePath, target.runRef])
/** How often a waiting ask reads the ledger again. */
const COMPOSE_EVERY_MS = 5000

/** Compose for the task's song: the ask through AIKit's gateway, its answer read in Central's receiving ledger, the owners' word on it,
 * and the person's Accept or Discard. */
export function useCompose(transport: KernelTransportStatus, project: string | null, to: ComposeTo, words: ComposeWords, score: ScoreReading,
  edit: (request: SongEdit) => Promise<unknown>): ComposePort {
  const target = score.state === 'read' ? score.target : null
  const key = target ? askKey(target) : null
  const [epoch, setEpoch] = useState(0)
  const asked = key ? ASKS.get(key) ?? null : null
  const [answer, setAnswer] = useState<{communique: string; answer: ComposeAnswer | null; why?: string; word?: {state: 'admitted' | 'refused'; why: string}} | null>(null)
  const call = useMemo(() => carried(transport), [transport])
  const settled = answer?.communique === asked?.communique && answer?.answer && answer.answer.state !== 'waiting'
  // While an ask waits, the ledger is read again every few seconds; once a proposal is taken it is judged once.
  useEffect(() => {
    if (!asked || transport.kind === 'unavailable' || settled) return
    let live = true
    const read = async () => {
      let found: ComposeAnswer
      try { found = await composeAnswerOf(call, asked) } catch (error) {
        if (live) setAnswer({communique: asked.communique, answer: null, why: error instanceof Error ? error.message : String(error)})
        return
      }
      if (!live) return
      setAnswer({communique: asked.communique, answer: found})
      if (found.state === 'answered') {
        const word = await judgeProposal(call, score, found.proposal)
        if (live) setAnswer({communique: asked.communique, answer: found, word})
      }
    }
    void read()
    const every = setInterval(() => { void read() }, COMPOSE_EVERY_MS)
    return () => { live = false; clearInterval(every) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked?.communique, settled, epoch, JSON.stringify(transport)])
  const held = answer && asked && answer.communique === asked.communique ? answer : null
  const found = held?.answer ?? null
  const state: ComposeState = !asked ? (to.state === 'refused' ? {state: 'unaddressed', why: to.why} : {state: 'ready', address: to.address})
    : !found || found.state === 'waiting' ? {state: 'asked', asked, others: found?.state === 'waiting' ? found.others : 0,
      ...(held?.why ? {why: `Compose asked ${asked.position} (${asked.communique}), and its answer is not read: ${held.why}`} : {})}
      : found.state === 'refused' ? {state: 'refused', asked, answer: found}
        : {state: 'answered', asked, answer: found, word: held?.word?.state ?? 'checking', why: held?.word?.why ?? ''}
  const forget = () => { if (key) ASKS.delete(key); setAnswer(null); setEpoch(n => n + 1) }
  return useMemo((): ComposePort => ({
    state,
    ask: async () => {
      if (state.state === 'unaddressed') throw new Error(state.why)
      if (state.state !== 'ready') throw new Error(`Compose was asked in ${state.asked.communique}: Discard its answer before another ask is sent.`)
      if (score.state !== 'read' || !key) throw new Error(score.state === 'absent' ? score.why : SCORE_NOT_HERE)
      const {body, revision} = composeAskOf(state.address, words, score.reading, score.target, project)
      const sent = await ownerRouteWrite(transport, composeSendOp(state.address, body, project), '`aikit gateway send`')
      ASKS.set(key, composeAskedOf(sent.data, state.address, project, revision, Date.now()))
      setAnswer(null)
      setEpoch(n => n + 1)
    },
    accept: async () => {
      if (state.state !== 'answered') throw new Error(state.state === 'refused' ? state.answer.why : NOTHING_COMPOSED)
      if (state.word !== 'admitted') throw new Error(state.word === 'checking' ? `QL and Factory are still checking Anima's proposal (${state.answer.returnRef}).` : state.why)
      await acceptComposed(call, project, state.answer, edit)
      forget()
    },
    discard: async () => {
      if (state.state === 'answered' || state.state === 'refused') await declineComposed(call, project, state.answer)
      else if (state.state !== 'asked') throw new Error(NOTHING_COMPOSED)
      forget()
    },
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [JSON.stringify(state), JSON.stringify(words), key, project, JSON.stringify(transport), score, edit])
}
/** Nothing Compose asked waits on the clip. */
export const NOTHING_COMPOSED = 'Nothing composed waits: Compose asks the session\'s orchestrator, and its proposal stands here once Central\'s receiving ledger holds it.'

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
