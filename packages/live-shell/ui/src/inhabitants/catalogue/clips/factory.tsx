// Factory's clip (manual §19.1): a task on an agent session's track. Clip view puts how it launches and what follows it beside its
// log. The Clip panel holds its name, colour, state (Factory's reading, with the evidence it was read from and, once closed, the closure
// its custody carries: `state`, `state.why`, `state.retry`, `closure`), turns, output style and Loop (whether it repeats, §16.5: Off or On, with its stop
// condition `loop.until` and its cap `loop.cap`); Launch holds Live's launch modes (Trigger, Gate, Toggle, Repeat), Then (the follow
// action, on the clip's own track: Next task, Again, Stop) and Quantize. To hand the work to another session, the task is dragged onto
// that session's track: no follow action leaves the track. A task launched with Repeat is an experiment (§19.5): each run a take, and
// the Launch panel adds what varies between the runs (`repeat.variable`, `repeat.levels`, `repeat.repeats`, `repeat.stop`) and Compare
// (`compare`, the takes' own setting: None, a second take, or every take of the Repeat), with the takes it has made (`takes`, a
// reading). Envelopes set the Agent's Effort and Scope's Tool calls for this task only (the Agent's Autonomy is retired, §19.4, §19.12).
//
// The editor holds a task's two materials, as Live's Clip View holds a MIDI clip's notes or an audio clip's sample (caps 01, 23):
// - Notes: the score of the workflow the task is a unit of (manual §19.1 "The score"). Its rows are the agents and agent sets that
//   take parts, from the track's rack (◆ marks an agent set); a note
//   is a unit, its row is who does it, it starts the step after what it waits on, ties run from a note to the notes that wait on it,
//   a bar stands where stacked notes join, and a lane of waves runs over the rows. A note that is a song of its own draws its notes
//   small inside it; a double-click opens it (`score.open`), and Back returns. Fold keeps the rows that hold notes, Rack every row of
//   the track's rack, and Highlight tints the notes of one thread form, as Live folds and highlights a scale (caps 10–12).
// - Sample (tab id `log`, the shell's view default): the task's log, as a recording on the clock. Each tool the agent used lies on its
//   lane, the onsets of its events stand under the ruler as Live marks transients (cap 23), steers, stalls and the retrospective
//   readings are lines across the lanes, and the unit's start and return are warp markers (cap 24). Warp lays the recording onto the
//   score's ruler, start on the note's start and return on its end; it stands off while the unit has not returned.
// - Vāk: what each unit carries on its own, lane by lane, as Live's MPE tab carries each note's expression (cap 19): the seven heads of
//   its composition across the rows, and under them the chosen unit's words. An open head is dashed; a head the decision model picked
//   (`picks`) stands dashed with its label until you accept it.
// Tools (panel two) reshape the score, and only while the score shows (Live greys Transform under Envelopes, cap 13): Transform
// (a thread form, an allocation, a tie) and Generate (a score composed from the Intent, or the open heads filled by the decision model).
//
// The owner's material: `log` (JSON rows {at, kind, tool?, text, dur?, state?, heard?, reading?}; at and dur in seconds from the task's
// start; kind is tool | spawn | steer | say | stall | reading), `elapsed` (seconds to the last output), and each envelope's steps on
// `env.agent.effort` and `env.scope.toolCalls` (JSON [[second, step]…]; `env.retired` and `env.toolCalls.play` the owner's words). `score` (JSON {name, rows: [{id, name, kind: agent | set | agency, rack?}], units:
// [{key, row, deps?, len?, wave?, proposed?, heads?: {CPF, CT, CP, CF, CFP, CS, direction}, picks?: <heads the decision model picked>,
// concern?, returns?, sources?, success?, may?, stop?, escalate?, song?: <a score>}], joins: [{key, waits, releases, join}], waves: [{id,
// name, state}]}): Factory's score of the song the task's Run performs (`factory workflow score <state> <run>`), its units with their
// compositions, on the rows of the track's Agent rack and then the agents and agent sets the song names that the rack does not hold
// (`rack: false`), the waves from Factory's plan of record. `unit.own` is this clip's own unit; `score.check` is the engine's word on the
// score (`factory workflow check` admits or refuses the song's file; QL's word on each unit's composition waits for an operation that
// takes one). Positions are derived from the order, never kept: a unit starts the step after what it waits on; a unit whose thread form
// is CFP4 (drone) holds to the end of the song. A song branches only by allocation, never by a condition.
// Writes: a note dragged to another row (`score` rewritten) gives the unit to that agent or agent set; Transform's and Generate's presses
// (`tr.press`, `gen.press`, `gen.accept`, `gen.discard`). Allocate, Connect and Thread form are edits of the song's file that Factory
// writes (`factory workflow edit`), or refuses in its words; the join is the agent set's, set on the Agent rack, so `tr.join` stands
// refused. Fill heads asks the decision model for the selected unit's open heads (`aikit decide invoke --instrument vak-block`, among
// the labels QL's team space holds); its picks stand dashed until Accept writes them through Factory, or Discard drops them. A unit
// with no open head asks nothing. Composing a score from an Intent is an agent's act (Anima), with no operation of its own: it stands
// disabled with its reason. The view holds `unit` (the chosen note; a note of another unit selects that unit's clip in the shell),
// `score.fold`, `score.highlight`, `score.open`, `warp`, `tr.*` and `gen.*` settings.
//
// The Intent panel: what the task is for, bounded, and how you will know it was met. Factory keeps it for the task's Run and never
// copies its source. The required difference is the Development Field's (factory/src/development_field.rs:250 DevelopmentField
// requiredDifference; `factory development field read`, `field set`, which creates the Field with it). The bounded intent in Factory's
// project ledger keeps refs to the success conditions and their evaluation (factory/src/project_development.rs:37 BoundedIntentCondition
// intent_source_ref, success_condition_refs, constraint_refs, context_resolution_ref; :61 IntentCriterionEvaluation criterion_ref, state
// satisfied | unsatisfied | indeterminate, evidence_refs), which no CLI route reads or writes yet; the words of a condition typed here
// stay in the source they come from, the task's own settings on AIKit (`success`, O-I 795).
// Keys: `intent` (the required difference, in words), `intent.source` (the source it is read from, named), `criteria` (JSON rows {id,
// text, state?, evidence?}: state absent until the Run returns; evidence is the count of evidence refs), `constraints` (a count),
// `context` (the context it resolves in, named). The return across the criteria is the owner's own law (project_development.rs:392-433):
// one unsatisfied criterion makes it unsatisfied; else one indeterminate makes it indeterminate; else satisfied. A conclusive state
// carries its evidence (ConclusiveCriterionWithoutEvidence refuses one without).
// Writes: `intent` goes to `factory development field set`, which has no kernel op yet, so the binding stands it disabled with that
// reason. `criterion` (a new success condition, on Enter) is added to the task's settings on AIKit; the binding stands it disabled, saying
// why, where those are not read or while a set of takes runs under the conditions as they stood.
// The Plan panel (O-I #741, OpenRig's planning dial and wave SDLC, as Factory keeps them in its Run's plan of record: factory/src/
// wave_sdlc.rs, `factory development wave read`): `plan` (the unit's rung, P0–P4, the planner's: a reading here), `plan.asks` (what the rung
// asks), `plan.why` (the reason it was set with), `plan.territory` (the files the unit declares), `plan.needs` (the rounds the rung still
// needs before the plan locks) or `plan.locked` (its rung and who locked it), `plan.rounds` (JSON rows {id, name, note, does}: each round
// that returned), `wave` (the wave and its state), `wave.gate` and `wave.next` (what holds it and the next lawful step, Factory's words),
// `ladder` (JSON rows {id, name, value: yes | no | unknown, why}: plan locked, built, merged, reviewed). Lock (`plan.lock`) is the
// person's press; Factory refuses it while the rung's rounds have not returned.
// Under Return, what the run returned (O-I #759): `returned`, JSON rows {id, name, role, opens, why?} — each artifact and piece of
// evidence the task's returned attempts name, as Factory resolves it (`factory attempt artifacts`); `open` (a row's id) opens it beside
// you through Central's file route; a row that does not open carries Factory's reason. `returned.page` is the view's page of them.
import {Action, Chooser, Radio, Rows as List, TextField, Toggle, ValueBox, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, json, numOf, strOf} from '../panels/design'
import {COLOURS, EnvelopeEditor, Fact, Fields, LaneGrid, GrooveOf, GrooveReading, GrooveSwap, MadeOf, Press, RULER_H, grooved, Rows, Row, Rule, Said, Wide, choice, fit, flag, read, write, type Block, type Lane, type Mark, type Meet, type Point, type Tie} from './clipKit'
import type {ClipProps, DesignedClip} from './design'

interface Entry {readonly at: number; readonly kind: 'tool' | 'spawn' | 'steer' | 'say' | 'stall' | 'reading'; readonly tool?: string; readonly text: string; readonly dur?: number; readonly state?: 'runs' | 'waits'; readonly heard?: string; readonly reading?: string}
const logOf = (v: ClipProps['v']) => read<Entry[]>(v, 'log', []).filter(e => Number.isFinite(e.at)).sort((a, b) => a.at - b.at)

// ---------------------------------------------------------------- the score: the workflow the task is a unit of

type Form = 'CFP0' | 'CFP1' | 'CFP2' | 'CFP3' | 'CFP4' | 'CFP5'
interface Heads {readonly CPF?: string; readonly CT?: string; readonly CP?: string; readonly CF?: string; readonly CFP?: Form; readonly CS?: string; readonly direction?: string}
interface ScoreRow {readonly id: string; readonly name: string; readonly kind?: 'agent' | 'set' | 'agency'; readonly rack?: boolean}
interface Unit {
  readonly key: string; readonly row: string; readonly deps?: readonly string[]; readonly len?: number; readonly wave?: string; readonly proposed?: boolean
  readonly heads?: Heads; readonly picks?: Heads; readonly concern?: string; readonly returns?: string; readonly sources?: readonly string[]; readonly success?: readonly string[]
  readonly may?: readonly string[]; readonly stop?: string; readonly escalate?: string; readonly song?: Score
  /** A canon note's takes: the Runs Factory started from it. */
  readonly takes?: number
}
interface Join {readonly key: string; readonly waits: readonly string[]; readonly releases: readonly string[]; readonly join?: 'all' | 'first'}
interface Wave {readonly id: string; readonly name: string; readonly state?: string}
interface Score {readonly name: string; readonly rows: readonly ScoreRow[]; readonly units: readonly Unit[]; readonly joins?: readonly Join[]; readonly waves?: readonly Wave[]}

/** The thread forms, in the words of what each does with the notes it holds (QL's CFP0–5: single voice, chord, melody, fusion, drone,
 * canon; ql.vak-workflow-types/v1 ThreadMusicalRole). */
const FORMS: readonly (Option<string> & {readonly value: Form})[] = [
  {value: 'CFP0', label: 'Single voice', does: 'One agent does the unit alone.'},
  {value: 'CFP1', label: 'Chord', does: 'Units stand together at one step, each on its own row, and each return is kept as its own.'},
  {value: 'CFP2', label: 'Melody', does: 'Units run one after another, and each return is the next unit\'s material.'},
  {value: 'CFP3', label: 'Fusion', does: 'Units stand together, and a join keeps every return and brings them into one reading.'},
  {value: 'CFP4', label: 'Drone', does: 'The unit holds across the song and keeps going until its stop condition.'},
  {value: 'CFP5', label: 'Canon', does: 'The unit is a song of its own, standing as one note here. Double-click it to open it.'},
]
const formWord = (f?: string) => FORMS.find(x => x.value === f)?.label
/** The voice that holds each context frame (the team space's rows, CF1–CF7). */
const VOICE: Readonly<Record<string, string>> = {CF1: 'Nous', CF2: 'Logos', CF3: 'Eros', CF4: 'Mythos', CF5: 'Anima', CF6: 'Psyche', CF7: 'Sophia'}
const HEADS: readonly {readonly id: keyof Heads; readonly label: string; readonly does: string; readonly word?: (x: string) => string}[] = [
  {id: 'CPF', label: 'CPF', does: 'How the person takes part: in dialogue, or an undertaking that names its authority.', word: x => (x === 'authorised-undertaking' ? 'undertaking' : x)},
  {id: 'CT', label: 'CT', does: 'The kind of content the unit works on.'},
  {id: 'CP', label: 'CP', does: 'The position of that content: 4.0 ground to 4.5 integration.'},
  {id: 'CF', label: 'CF', does: 'The context frame the unit stands in, and the voice that holds it.', word: x => `${x} ${VOICE[x] ?? ''}`.trim()},
  {id: 'CFP', label: 'CFP', does: 'The thread form: how the unit stands with the others.', word: x => formWord(x) ?? x},
  {id: 'CS', label: 'CS', does: 'The context sequence: how far the passage goes, from the full traverse (CS0) to the direct synthesis (CS5).'},
  {id: 'direction', label: 'Direction', does: 'Forward, in the prospective pass; returning, in the retrospective pass.', word: x => (x === 'returning' ? 'Returning' : x === 'forward' ? 'Forward' : x)},
]

function scoreOf(v: ClipProps['v']): Score | undefined {
  const raw = read<unknown>(v, 'score', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const s = raw as Partial<Score>
  return Array.isArray(s.rows) && Array.isArray(s.units) ? {name: typeof s.name === 'string' ? s.name : '—', rows: s.rows, units: s.units, joins: s.joins ?? [], waves: s.waves ?? []} : undefined
}
/** The score shown: the song, or the song one of its notes holds when that note is open. */
const shownScore = (v: ClipProps['v']): {score: Score; inside?: Unit} | undefined => {
  const outer = scoreOf(v)
  const open = strOf(v, 'score.open'), inside = open ? outer?.units.find(u => u.key === open && u.song) : undefined
  return outer ? (inside?.song ? {score: inside.song, inside} : {score: outer}) : undefined
}

/** Where each note stands, read from the order alone: a unit starts the step after the last unit it waits on (directly, or through
 * the join that releases it) has returned, and is one step long unless it says otherwise; a drone holds to the end of the song. */
function laid(score: Score): {at: Map<string, {at: number; len: number}>; end: number; joins: Map<string, number>} {
  const byKey = new Map(score.units.map(u => [u.key, u])), at = new Map<string, {at: number; len: number}>(), joins = new Map<string, number>()
  const released = new Map<string, Join>()
  for (const j of score.joins ?? []) for (const k of j.releases) released.set(k, j)
  const place = (key: string, seen: Set<string>): {at: number; len: number} => {
    const known = at.get(key)
    if (known) return known
    const u = byKey.get(key)
    if (!u || seen.has(key)) return {at: 0, len: 1}
    seen.add(key)
    const ends = (u.deps ?? []).map(d => { const p = place(d, seen); return p.at + p.len })
    const j = released.get(key)
    if (j) {
      const meet = Math.max(0, ...j.waits.map(w => { const p = place(w, seen); return p.at + p.len }))
      joins.set(j.key, meet); ends.push(meet)
    }
    const p = {at: Math.max(0, ...ends), len: Math.max(0.5, u.len ?? 1)}
    at.set(key, p)
    return p
  }
  for (const u of score.units) if (u.heads?.CFP !== 'CFP4') place(u.key, new Set())
  const end = Math.max(1, ...[...at.values()].map(p => p.at + p.len))
  for (const u of score.units) if (u.heads?.CFP === 'CFP4') at.set(u.key, {at: Math.max(0, ...(u.deps ?? []).map(d => { const p = at.get(d); return p ? p.at + p.len : 0 })), len: 0})
  for (const u of score.units) if (u.heads?.CFP === 'CFP4') { const p = at.get(u.key)!; at.set(u.key, {at: p.at, len: Math.max(0.5, end - p.at)}) }
  for (const j of score.joins ?? []) if (!joins.has(j.key)) joins.set(j.key, Math.max(0, ...j.waits.map(w => { const p = at.get(w); return p ? p.at + p.len : 0 })))
  return {at, end, joins}
}
const stepLabel = (t: number) => (Math.abs(t - Math.round(t)) < 1e-6 ? String(Math.round(t) + 1) : '')
const WAVES = 'waves'
const WAVE_STATE_TONE = (s?: string) => (s === 'Sealed' ? 'green' : s === 'Fix round' ? 'stall' : 'value') as Tone

/** The rows the roll shows: Fold keeps the rows that hold notes; Rack shows every agent and agent set on the track's rack, used or not. */
function rowsShown(score: Score, fold: string): ScoreRow[] {
  const used = new Set(score.units.map(u => u.row))
  return score.rows.filter(r => (fold === 'rack' ? r.rack !== false || used.has(r.id) : used.has(r.id)))
}

function Notes(p: ClipProps) {
  const shown = shownScore(p.v)
  if (!shown) return <Said>No reading of the score: the workflow this task is a unit of.</Said>
  const {score, inside} = shown
  const fold = choice(p.v, 'score.fold', 'fold'), hl = choice(p.v, 'score.highlight', 'none')
  const {at, end, joins} = laid(score)
  const rows = rowsShown(score, fold)
  const lanes: Lane[] = [{id: WAVES, label: 'Waves', key: 'name'}, ...rows.map(r => ({id: r.id, label: `${r.kind === 'set' ? '◆ ' : ''}${r.name}`, key: 'name' as const,
    marked: r.rack === false}))]
  // This task's note stands in the clip's colour (§19.1 "This task's note is drawn in the clip's colour"), unless a form's tint is on it.
  const own = strOf(p.v, 'unit.own'), colour = strOf(p.v, 'colour')
  const unitBlocks: Block[] = score.units.map(u => {
    const pos = at.get(u.key) ?? {at: 0, len: 1}, f = u.heads?.CFP
    const inner = u.song ? (() => { const l = laid(u.song!), n = Math.max(1, u.song!.rows.length)
      return u.song!.units.map(x => { const q = l.at.get(x.key) ?? {at: 0, len: 1}; return [q.at / l.end, q.len / l.end, u.song!.rows.findIndex(r => r.id === x.row) / n] as const }) })() : undefined
    const takes = u.takes ? ` · ${u.takes} take${u.takes === 1 ? '' : 's'}` : ''
    const tone: Tone = hl !== 'none' && f === hl ? 'accent' : u.key === own && !inside ? 'green' : 'value'
    return {id: u.key, lane: u.row, at: pos.at, len: pos.len, label: `${u.key}${f && f !== 'CFP0' ? ` · ${formWord(f)?.toLowerCase()}` : ''}${takes}`,
      tone, ...(tone === 'green' && colour ? {colour} : {}), dashed: u.proposed, inner,
      does: [`${u.key}, by ${score.rows.find(r => r.id === u.row)?.name ?? u.row}`, u.concern, f ? `${formWord(f)}.` : undefined,
        u.takes ? `${u.takes} take${u.takes === 1 ? '' : 's'}: the Runs of the song Repeat, Loop or a routine started from it.` : undefined,
        u.proposed ? 'Proposed: it waits for you to accept it.' : undefined].filter(Boolean).join(' · ')}
  })
  const waveSpan = (w: Wave) => {
    const mine = score.units.filter(u => u.wave === w.id && u.heads?.CFP !== 'CFP4').map(u => at.get(u.key)).filter((q): q is {at: number; len: number} => !!q)
    return mine.length ? {at: Math.min(...mine.map(q => q.at)), len: Math.max(...mine.map(q => q.at + q.len)) - Math.min(...mine.map(q => q.at))} : undefined
  }
  const waveBlocks: Block[] = (score.waves ?? []).flatMap(w => { const s = waveSpan(w); return s ? [{id: `wave:${w.id}`, lane: WAVES, at: s.at, len: s.len,
    label: `${w.name}${w.state ? ` · ${w.state}` : ''}`, tone: WAVE_STATE_TONE(w.state), does: `The units built side by side in ${w.name}. In Session view it is a row: launch it and each unit starts on its track.`}] : [] })
  const released = new Set((score.joins ?? []).flatMap(j => j.releases.map(r => `${j.key}>${r}`)))
  const viaJoin = (u: Unit, d: string) => (score.joins ?? []).some(j => j.waits.includes(d) && released.has(`${j.key}>${u.key}`))
  const ties: Tie[] = score.units.flatMap(u => (u.deps ?? []).filter(d => !viaJoin(u, d)).map(d => ({from: d, to: u.key, does: `${u.key} waits on ${d}: it starts when ${d} returns, with its return as material.`})))
  const meets: Meet[] = (score.joins ?? []).map(j => ({at: joins.get(j.key) ?? 0, lanes: [...j.waits, ...j.releases].map(k => score.units.find(u => u.key === k)?.row).filter((r): r is string => !!r),
    label: j.join === 'first' ? 'First' : 'All', does: `${j.key}: ${j.join === 'first' ? 'the first acceptable return closes it' : 'it waits until every unit has returned'}; then ${j.releases.join(', ')} start.`}))
  const laneH = Math.max(14, Math.min(34, Math.floor((p.room.h - RULER_H - 20) / Math.max(1, lanes.length))))
  const move = (id: string, _at: number, lane: string) => {
    if (lane === WAVES || inside) return
    const outer = scoreOf(p.v)
    if (outer) write(p, 'score', {...outer, units: outer.units.map(u => (u.key === id ? {...u, row: lane} : u))})
  }
  const check = read<{state?: string; why?: string} | undefined>(p.v, 'score.check', undefined)
  return <LaneGrid lanes={lanes} blocks={[...waveBlocks, ...unitBlocks]} ties={ties} meets={meets} from={0} to={Math.ceil(end) + 1} major={1} minor={0.5} label={stepLabel}
    keyW={92} laneH={laneH} highlight selected={strOf(p.v, 'unit') ?? own} onSelect={id => { if (!id.startsWith('wave:')) p.set('unit', id) }}
    onMove={p.standing?.score?.disabled ? undefined : move} onOpen={id => { if (score.units.find(u => u.key === id)?.song) p.set('score.open', id) }}
    w={p.room.w} h={p.room.h} name="Notes"
    does="The score: each unit a note on the row of the agent or agent set that does it, ties to the units that wait on it, a bar where stacked notes join, the waves over the rows. Drag a note to another row to give it to that agent or agent set. Double-click a song to open it."
    under={<div className="clv-foot">
      {inside && <Action label={`Back to ${scoreOf(p.v)?.name ?? 'the song'}`} does="Returns to the song this one stands in." onPress={() => p.set('score.open', undefined)} />}
      <span className="clv-own" data-i={`Song|${inside ? `${inside.key}: a song standing as one note of ${scoreOf(p.v)?.name ?? 'its song'}.` : 'The workflow this task is a unit of.'}`}>
        <span>{score.name}</span><span>{score.units.length} units</span><span>{(score.joins ?? []).length} joins</span><span>{(score.waves ?? []).length} waves</span></span>
      <span className="clv-own" data-i={`Check|${check?.why ?? 'What the engine said of each unit\'s composition and of the source.'}`} style={{marginLeft: 'auto', color: check?.state === 'refused' ? 'var(--stall)' : check?.state === 'admitted' ? 'var(--green)' : undefined}}>
        {check ? `${check.state === 'refused' ? 'Refused' : check.state === 'admitted' ? 'Admitted' : 'Checking'}${check.why ? `: ${check.why}` : ''}` : 'No reading of the check'}</span>
    </div>} underH={20} />
}

const notesBar = (p: ClipProps) => <>
  <Toggle label="Fold" does="Keeps only the rows that hold notes." on={choice(p.v, 'score.fold', 'fold') === 'fold'} onChange={x => p.set('score.fold', x ? 'fold' : 'rack')} />
  <Toggle label="Rack" does="Shows every agent and agent set on the track's rack, as rows, whether the song gives them a part or not." tone="value"
    on={choice(p.v, 'score.fold', 'fold') === 'rack'} onChange={x => p.set('score.fold', x ? 'rack' : 'fold')} />
  <Chooser label="Highlight" does="Tints the notes of one thread form." value={choice(p.v, 'score.highlight', 'none')}
    options={[{value: 'none', label: 'Highlight: none'}, ...FORMS.map(f => ({value: f.value, label: f.label, does: f.does}))]} onChange={x => p.set('score.highlight', x)} />
</>

/** The Vāk tab: the score's rows on top, then one lane for each head of a unit's composition, each unit's value at its note; under
 * them, the chosen unit's own words (Live's MPE tab: each note's expression, lane by lane, cap 19). */
function Vak(p: ClipProps) {
  const shown = shownScore(p.v)
  if (!shown) return <Said>No reading of the score: the workflow this task is a unit of.</Said>
  const {score} = shown
  const {at, end} = laid(score)
  const rows = rowsShown(score, 'fold')
  const lanes: Lane[] = [...rows.map(r => ({id: r.id, label: r.name, key: 'name' as const})),
    ...HEADS.map(h => ({id: `h:${h.id}`, label: h.label, key: 'name' as const, marked: true}))]
  const chosen = score.units.find(u => u.key === (strOf(p.v, 'unit') ?? strOf(p.v, 'unit.own'))) ?? score.units[0]
  const blocks: Block[] = score.units.flatMap(u => {
    const pos = at.get(u.key) ?? {at: 0, len: 1}
    return [{id: u.key, lane: u.row, at: pos.at, len: pos.len, label: u.key, tone: 'value' as Tone, dashed: u.proposed, does: u.concern},
      // The chosen unit's heads stand lit with their labels; the others stand faint behind, unlabelled, so stacked units never write over
      // each other. A unit held across the song stands behind only while it is chosen, or it would cover every other.
      // A head the decision model picked stands dashed with its label, the model's pick, until you accept it.
      ...(u.key !== chosen?.key && u.heads?.CFP === 'CFP4' ? [] : HEADS.map(h => { const x = u.heads?.[h.id], pick = x ? undefined : u.picks?.[h.id], mine = u.key === chosen?.key
        const shown = x ?? pick
        return {id: `${u.key}:${h.id}`, lane: `h:${h.id}`, at: pos.at, len: pos.len, label: mine ? (shown ? (h.word ? h.word(shown) : shown) : 'open') : undefined,
          tone: (x ? 'value' : pick ? 'accent' : 'stall') as Tone, dashed: !x, faint: !mine,
          does: `${u.key} · ${h.label}: ${x ?? (pick ? `${pick}, the decision model's pick, dashed until you accept it.` : 'open: no label chosen yet.')} ${h.does}`} }))]
  })
  const words: [string, string | undefined][] = chosen ? [
    ['Concern', chosen.concern], ['Returns', chosen.returns], ['Sources', chosen.sources?.join(' · ')], ['Success', chosen.success?.join(' · ')],
    ['May', chosen.may?.join(' · ')], ['Stops when', chosen.stop], ['Escalates', chosen.escalate]] : []
  const listH = Math.max(60, Math.round(p.room.h * 0.34))
  const laneH = Math.max(12, Math.min(20, Math.floor((p.room.h - RULER_H - listH) / Math.max(1, lanes.length))))
  return <LaneGrid lanes={lanes} blocks={blocks} from={0} to={Math.ceil(end) + 1} major={1} minor={0.5} label={stepLabel} keyW={92} laneH={laneH} highlight
    selected={chosen?.key} onSelect={id => p.set('unit', id.split(':')[0]!)} w={p.room.w} h={p.room.h} name="Vāk"
    does="What each unit carries on its own: the seven heads of its composition, lane by lane, the selected unit's labels lit at its note and the others faint behind. An open head is dashed: no label is chosen yet; a head the decision model picked is dashed with its label until you accept it. Under the lanes, the selected unit's own words."
    under={<ul className="clv-list" aria-label={`What ${chosen?.key ?? 'the unit'} carries`}>
      {words.map(([name, text]) => <li key={name} data-i={`${name}|${text ?? 'No reading.'}`}>
        <span className="clv-at">{chosen?.key}</span><span className="clv-chip">{name}</span><span className="clv-text">{text ?? '—'}</span><span className="clv-tag" />
      </li>)}
    </ul>} underH={listH} />
}

// ---------------------------------------------------------------- Tools: they reshape the score, and only while it shows

const TR_TOOLS: readonly Option<string>[] = [
  {value: 'form', label: 'Thread form', does: 'Gives the selected units a thread form: how they stand with each other.'},
  {value: 'allocate', label: 'Allocate', does: 'Gives the selected units to another agent or agent set: their row in the score.'},
  {value: 'connect', label: 'Connect', does: 'Makes the selected unit wait on another: a tie from that unit\'s note to this one.'},
]
const JOINS: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'The join waits until every unit has returned, and an independent reviewer brings the returns into one.'},
  {value: 'first', label: 'First', does: 'The first acceptable return closes the join.'},
  {value: 'quorum', label: 'Quorum', does: 'Commits when enough units agree.', why: 'No owner joins this way: the song names no count of units that must agree, and Factory refuses to start a step on it.'},
  {value: 'weighted', label: 'Weighted', does: 'Each return counts by its strength.', why: 'No owner joins this way: no unit carries a weight, and Factory refuses to start a step on it.'},
]
const onScore = (p: ClipProps) => { const e = choice(p.v, 'view.editor', 'notes'); return e === 'notes' || e === 'vak' }
const NOT_ON_SCORE = 'Show Notes: the tools reshape the score.'

function Transform(p: ClipProps) {
  const tool = choice(p.v, 'tr.tool', 'form'), score = scoreOf(p.v), off = onScore(p) ? (score ? undefined : 'No reading of the score.') : NOT_ON_SCORE
  const unit = strOf(p.v, 'unit') ?? strOf(p.v, 'unit.own'), form = choice(p.v, 'tr.form', 'CFP3')
  return <>
    <Chooser label="Tool" does="The transform to apply to the selected units." value={tool} options={TR_TOOLS} onChange={x => p.set('tr.tool', x)} wide />
    <Said>{TR_TOOLS.find(t => t.value === tool)?.does}</Said>
    {tool === 'form' && <Fields>
      <Wide><Chooser label="Form" does="The thread form the selected units take." value={form} options={FORMS} onChange={x => p.set('tr.form', x)} disabled={off} /></Wide>
      <Wide><Chooser label="Join" does="Where stacked units meet: whether what comes after waits for all of them, or takes the first." value={choice(p.v, 'tr.join', 'all')} options={JOINS}
        onChange={x => p.set('tr.join', x)} disabled={off ?? p.standing?.['tr.join']?.disabled ?? (form === 'CFP1' || form === 'CFP3' ? undefined : 'Only stacked units meet at a join: choose Chord or Fusion.')} /></Wide>
    </Fields>}
    {tool === 'allocate' && <Wide><Chooser label="To" does="The agent or agent set on the track's rack that takes the selected units." value={choice(p.v, 'tr.to')}
      options={(score?.rows ?? []).map(r => ({value: r.id, label: r.name, why: r.rack === false ? 'Not on the track\'s rack: add it to the rack first.' : undefined}))} onChange={x => p.set('tr.to', x)} disabled={off} /></Wide>}
    {tool === 'connect' && <Wide><Chooser label="Waits on" does="The unit the selected one waits on. Its return becomes this unit's material." value={choice(p.v, 'tr.on')}
      options={(score?.units ?? []).filter(u => u.key !== unit).map(u => ({value: u.key, label: u.key}))} onChange={x => p.set('tr.on', x)} disabled={off} /></Wide>}
    <Rule />
    <Fields>
      <Toggle label="Auto" does="Applies the transform at once as you change it." on={flag(p.v, 'tr.auto') ?? false} onChange={x => p.set('tr.auto', x)} disabled={off} />
      <Press p={p} k="tr.press" label="Transform" does="Applies the transform to the selected units. Factory checks the song and admits or refuses it." why={p.standing?.['tr.press']?.disabled ?? off} />
    </Fields>
  </>
}

const GEN_TOOLS: readonly Option<string>[] = [
  {value: 'compose', label: 'Compose', does: 'Anima composes a score from the task\'s Intent and the spec it is written in: the units, who takes each part, and the order.'},
  {value: 'heads', label: 'Fill heads', does: 'The decision model fills the open heads of the selected units, among the labels Quaternal Logic allows, or leaves them open.'},
]
const NO_COMPOSE = 'Composing a score is Anima\'s act as an agent: no operation proposes a workflow from an intent yet.'
const NOTHING_OPEN = 'Every head of the unit has its label: nothing is open, so the decision model is not asked.'

function Generate(p: ClipProps) {
  const tool = choice(p.v, 'gen.tool', 'compose'), score = scoreOf(p.v), off = onScore(p) ? undefined : NOT_ON_SCORE
  const unit = score?.units.find(u => u.key === (strOf(p.v, 'unit') ?? strOf(p.v, 'unit.own')))
  const open = unit ? HEADS.filter(h => !unit.heads?.[h.id]).length : undefined
  const proposed = score?.units.filter(u => u.proposed || (u.picks && Object.keys(u.picks).length)).length ?? 0
  const status = read<{state?: string; why?: string} | undefined>(p.v, 'gen.status', undefined)
  return <>
    <Chooser label="Tool" does="The generator that writes into the score." value={tool} options={GEN_TOOLS} onChange={x => p.set('gen.tool', x)} wide />
    <Said>{GEN_TOOLS.find(t => t.value === tool)?.does}</Said>
    {tool === 'compose' ? <Rows>
      <Row label="From"><Fact label="From" does="The spec the score is composed from: the Intent panel's From." value={strOf(p.v, 'intent.source')} /></Row>
      <Row label="Rack"><Fact label="Rack" does="The agents and agent sets on the track's rack: the rows the score may give parts to." value={score ? `${score.rows.filter(r => r.rack !== false).length} rows` : undefined} /></Row>
      <Row label="Waves"><ValueBox label="Waves" does="The most waves the score may hold." value={numOf(p.v, 'gen.waves') ?? NaN} def={2} scale={{min: 1, max: 6, step: 1}} format={x => String(x)} onChange={x => p.set('gen.waves', x)} /></Row>
    </Rows> : <Rows>
      <Row label="Open"><Fact label="Open" does="The heads of the selected unit with no label chosen yet." value={open === undefined ? undefined : `${open} of 7 · ${unit!.key}`} /></Row>
      <Row label="Decides"><Fact label="Decides" does="The decision model that picks, and where it runs." value={strOf(p.v, 'gen.decider')} /></Row>
    </Rows>}
    <Rule />
    <Fields>
      <Wide><Press p={p} k="gen.press" label="Generate" does="Writes the proposal into the score, dashed, until you accept it." why={p.standing?.['gen.press']?.disabled ?? off ?? (tool === 'compose' ? NO_COMPOSE : open === 0 ? NOTHING_OPEN : undefined)} /></Wide>
      <Press p={p} k="gen.accept" label="Accept" does="Keeps the dashed notes in the score." why={off ?? (proposed ? undefined : 'Nothing proposed waits.')} />
      <Press p={p} k="gen.discard" label="Discard" does="Drops the dashed notes." why={off ?? (proposed ? undefined : 'Nothing proposed waits.')} />
    </Fields>
    <Fact label="Check" does="The engine's word on the proposal: it admits each composition, or refuses it and says why." value={status ? `${status.state === 'refused' ? 'Refused' : 'Admitted'}${status.why ? `: ${status.why}` : ''}` : undefined}
      tone={status?.state === 'refused' ? 'stall' : status ? 'green' : undefined} />
  </>
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const STATE_WORD: Readonly<Record<string, string>> = {queued: 'Queued', running: 'Running', stalled: 'Stalled', stopped: 'Stopped', done: 'Done'}
const STATE_TONE = {queued: 'accent', running: 'value', stalled: 'stall', stopped: undefined, done: 'green'} as const
/** Every tool lane a log can hold, in the order the log draws them unfolded. */
const TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'Web', 'Helpers', 'Messages'] as const
const laneOf = (e: Entry) => (e.kind === 'spawn' ? 'Helpers' : e.kind === 'say' ? 'Messages' : e.tool ?? 'Messages')

/** The unit's note in the score, where the task's log can be anchored: its start and its end, in steps. */
const noteOf = (v: ClipProps['v']): {at: number; len: number} | undefined => {
  const score = scoreOf(v), own = strOf(v, 'unit.own')
  return score && own ? laid(score).at.get(own) : undefined
}
/** Why the log cannot be laid on the score, or undefined when it can: the unit must have returned, and stand in the score. */
const warpWhy = (v: ClipProps['v']) => (strOf(v, 'state') !== 'done' ? 'The unit has not returned: its return has no place on the score yet.'
  : noteOf(v) ? undefined : 'No reading of the unit\'s note in the score.')

/** The Sample tab: the task's log, a recording on the clock. Warp lays it on the score's ruler, its start on the note's start and its
 * return on the note's end, as Live's warp markers pin a sample's moments to the beat (cap 24). */
function Log(p: ClipProps) {
  const log = logOf(p.v)
  if (!log.length) return <Said>No reading of the task's log yet.</Said>
  const elapsed = numOf(p.v, 'elapsed') ?? Math.max(...log.map(e => e.at + (e.dur ?? 0)))
  const note = noteOf(p.v), warped = p.v.warp === true && !warpWhy(p.v) && note !== undefined
  // On the clock, seconds; warped, steps of the score: the start at the note's start, the return at its end, evenly between.
  const t = (s: number) => (warped ? note!.at + (s / Math.max(1, elapsed)) * note!.len : s)
  // Warped, the ruler reaches a quarter step past the note at each end, so its edges and the two flags stand clear.
  const from = warped ? note!.at - 0.25 : 0, to = warped ? note!.at + note!.len + 0.25 : Math.max(60, Math.ceil((elapsed + 8) / 30) * 30)
  const used = new Set(log.filter(e => e.kind !== 'steer' && e.kind !== 'stall' && e.kind !== 'reading').map(laneOf))
  // A kind the owner names that is no tool of the design's stands as its own lane after them, so every row of the log is drawn.
  const kinds = [...TOOLS, ...[...used].filter(x => !(TOOLS as readonly string[]).includes(x))]
  const lanes: Lane[] = (p.v.fold === false ? kinds : kinds.filter(x => used.has(x))).map(x => ({id: x, label: x, key: 'name', marked: used.has(x)}))
  const state = strOf(p.v, 'state'), own = strOf(p.v, 'unit.own') ?? 'the unit'
  const blocks: Block[] = log.filter(e => e.kind === 'tool' || e.kind === 'spawn' || e.kind === 'say').map(e => {
    const i = log.indexOf(e)
    const running = e.state === 'runs' && state === 'running' && i === log.length - 1
    const len = Math.max(1, e.dur ?? 1.5)
    return {id: `e${e.at}-${i}`, lane: laneOf(e), at: t(e.at), len: running ? undefined : t(e.at + len) - t(e.at), label: e.text,
      tone: e.kind === 'spawn' ? 'green' : e.kind === 'say' ? 'accent' : e.state === 'waits' && state === 'stalled' ? 'stall' : 'value',
      striped: e.state === 'waits' && state === 'stalled', does: `${clock(e.at)} · ${e.tool ?? e.kind}: ${e.text}`}
  })
  const marks: Mark[] = log.filter(e => e.kind === 'steer' || e.kind === 'stall' || e.kind === 'reading').map(e => e.kind === 'steer'
    ? {at: t(e.at), label: `Steer: ${e.text}`, tone: 'accent', does: e.heard ?? 'Words you sent in the middle of the turn.'}
    : e.kind === 'reading' ? {at: t(e.at), label: `${e.reading ?? 'Reading'}: ${e.text}`, tone: 'value', does: 'What the retrospective pass read here, set against the score.'}
      : {at: t(e.at), label: `Stall: ${e.text}`, tone: 'stall', does: 'The output stopped here. The track lights a retry.'})
  if (state === 'running') marks.push({at: elapsed, label: 'Now', tone: 'value', does: 'The last output: the task runs on from here.'})
  marks.push({at: t(0), label: `Start · ${own}`, pin: true, tone: 'green', does: 'Where the unit started. Warped, it stands on its note\'s start in the score.'})
  if (state === 'done') marks.push({at: t(elapsed), label: `Return · ${own}`, pin: true, tone: 'green', does: 'Where the unit returned. Warped, it stands on its note\'s end in the score.'})
  const onsets = log.filter(e => e.kind === 'tool' || e.kind === 'spawn' || e.kind === 'say').map(e => t(e.at))
  const listH = Math.max(58, Math.round(p.room.h * 0.36))
  const laneH = Math.max(14, Math.min(24, Math.floor((p.room.h - 16 - listH) / Math.max(1, lanes.length))))
  const behind: Block[] = warped && note ? lanes.map(l => ({id: `note:${l.id}`, lane: l.id, at: note.at, len: note.len, faint: true, tone: 'green' as Tone, does: `${own}'s note in the score.`})) : []
  return <LaneGrid lanes={lanes} blocks={[...behind, ...blocks]} marks={marks} onsets={onsets} from={from} to={to} major={warped ? 1 : 30} minor={warped ? 0.25 : 5}
    label={warped ? stepLabel : clock} keyW={64} laneH={laneH}
    highlight={false} selected={strOf(p.v, 'event')} onSelect={id => { if (!id.startsWith('note:')) p.set('event', id) }} w={p.room.w} h={p.room.h}
    name="Sample" does="The task's log, as a recording: each tool the agent used on its lane, the onsets of its events under the ruler, lines for your steers, a stall and what the retrospective pass read, flags where the unit started and returned. Press a tool to select it."
    under={<ul className="clv-list" aria-label="Events">
      {log.map((e, i) => <li key={i} data-tone={e.kind === 'steer' ? 'accent' : e.kind === 'stall' ? 'stall' : undefined}
        data-i={`${e.kind === 'tool' ? e.tool ?? 'Tool' : e.kind === 'spawn' ? 'Helper' : e.kind === 'steer' ? 'Steer' : e.kind === 'stall' ? 'Stall' : e.kind === 'reading' ? e.reading ?? 'Reading' : 'Message'}|${e.text}`}>
        <span className="clv-at">{clock(e.at)}</span>
        <span className="clv-chip">{e.kind === 'tool' ? e.tool : e.kind === 'spawn' ? 'helper' : e.kind === 'reading' ? e.reading ?? 'reading' : e.kind}</span>
        <span className="clv-text">{e.text}</span>
        <span className="clv-tag">{e.kind === 'steer' ? e.heard ?? '' : e.dur !== undefined ? `${e.dur} s` : e.state === 'runs' ? 'runs' : e.state === 'waits' ? 'waits' : ''}</span>
      </li>)}
    </ul>} underH={listH} />
}

const EFFORT = ['Inherit', 'Low', 'Medium', 'High', 'Max'] as const
const TOOL_CALLS = ['Inherit', 'Ask', 'Session', 'Always'] as const
/** The Envelopes' choosers (§19.1 Envelopes): "The Device chooser holds the Agent and Scope; the Control chooser holds the Agent's Effort
 * and Scope's Tool calls" — each device's control under it, as Live's Control chooser lists the chosen device's parameters. */
const ENVELOPE_DEVICES: readonly Option<string>[] = [{value: 'agent', label: 'Agent'}, {value: 'scope', label: 'Scope'}]
const ENVELOPE_CONTROLS: Readonly<Record<'agent' | 'scope', readonly Option<string>[]>> = {
  agent: [{value: 'effort', label: 'Effort', does: 'How hard the agent thinks in each turn of this task.'}],
  scope: [{value: 'toolCalls', label: 'Tool calls', does: 'Which of the agent\'s tool calls wait for you in this task.'}],
}

function Envelopes(p: ClipProps) {
  const control = choice(p.v, 'env.control', 'effort') === 'toolCalls' ? 'toolCalls' : 'effort'
  const device = control === 'toolCalls' ? 'scope' : 'agent'
  const steps = control === 'effort' ? EFFORT : TOOL_CALLS
  const key = control === 'effort' ? 'env.agent.effort' : 'env.scope.toolCalls'
  const log = logOf(p.v), elapsed = numOf(p.v, 'elapsed') ?? 60
  const to = Math.max(60, Math.ceil((elapsed + 8) / 30) * 30)
  const mode = choice(p.v, 'env.mode', 'automation') as 'automation' | 'modulation'
  // What the owner left out in retired words, and what Tool calls did at its last answer to the harness, in the owner's words.
  const said = [strOf(p.v, 'env.retired'), device === 'scope' ? strOf(p.v, 'env.toolCalls.play') : undefined].filter((x): x is string => !!x)
  const saidH = said.length ? 18 * said.length + 6 : 0
  const editor = <EnvelopeEditor p={p} devices={ENVELOPE_DEVICES} device={device} onDevice={x => p.set('env.control', x === 'scope' ? 'toolCalls' : 'effort')}
    controls={ENVELOPE_CONTROLS[device]} control={control} onControl={x => p.set('env.control', x)} mode={mode} onMode={x => p.set('env.mode', x)}
    linked={p.v['env.linked'] !== false} onLinked={x => p.set('env.linked', x)} own={{start: 0, end: to, format: clock}}
    points={read<Point[]>(p.v, key, [])} onPoints={pts => write(p, key, pts)}
    min={0} max={steps.length - 1} steps={mode === 'modulation' ? ['−2', '−1', '0', '+1', '+2'] : steps} format={x => steps[Math.round(x)] ?? String(x)}
    from={0} to={to} major={30} minor={5} label={clock} w={p.room.w} h={p.room.h - saidH}
    behind={(w, h, keyW) => log.filter(e => e.kind === 'tool').map((e, i) => <rect key={i} className="clv-env-behind" x={keyW + e.at / to * (w - keyW)} width={Math.max(2, (e.dur ?? 1.5) / to * (w - keyW))} y={h - 10} height={4} />)} />
  return said.length ? <>{editor}{said.map(words => <Said key={words}>{words}</Said>)}</> : editor
}

// ---------------------------------------------------------------- the Intent panel

type Verdict = 'satisfied' | 'unsatisfied' | 'indeterminate'
const VERDICTS: readonly Verdict[] = ['satisfied', 'unsatisfied', 'indeterminate']
const VERDICT_WORD: Readonly<Record<Verdict, string>> = {satisfied: 'Met', unsatisfied: 'Not met', indeterminate: 'Open'}
const VERDICT_SAYS: Readonly<Record<Verdict, string>> = {
  satisfied: 'Met, with the evidence that shows it.', unsatisfied: 'Not met, with the evidence that shows it.', indeterminate: 'The run cannot tell yet.',
}
interface Criterion {readonly id: string; readonly text: string; readonly state?: Verdict; readonly evidence?: number}
function criteriaOf(v: ClipProps['v']): Criterion[] | undefined {
  const raw = json<unknown>(v, 'criteria', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((o, i): Criterion[] => {
    if (!o || typeof o !== 'object') return []
    const r = o as Record<string, unknown>, text = typeof r.text === 'string' && r.text ? r.text : undefined
    return text ? [{id: typeof r.id === 'string' ? r.id : `c${i}`, text, state: VERDICTS.find(x => x === r.state), evidence: typeof r.evidence === 'number' && r.evidence >= 0 ? r.evidence : undefined}] : []
  })
}
/** The return across the criteria, by the owner's law; undefined until every criterion has a state. */
const verdictOf = (list: readonly Criterion[] | undefined): Verdict | undefined => {
  if (!list?.length || list.some(c => !c.state)) return undefined
  return list.some(c => c.state === 'unsatisfied') ? 'unsatisfied' : list.some(c => c.state === 'indeterminate') ? 'indeterminate' : 'satisfied'
}
const VERDICT_TONE = {satisfied: 'green', unsatisfied: 'stall', indeterminate: undefined} as const

/** What the run returned (`returned`, JSON rows {id, name, role, opens, why?}): each artifact and piece of evidence its Return names, as
 * Factory resolved it. One that opens is lit and opens beside you (`open`, its id); one that does not is dark and says why. */
interface Returned {readonly id: string; readonly name: string; readonly role: string; readonly opens: boolean; readonly why?: string}
function returnedOf(v: ClipProps['v']): Returned[] | undefined {
  const raw = json<unknown>(v, 'returned', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((o): Returned[] => {
    if (!o || typeof o !== 'object') return []
    const r = o as Record<string, unknown>
    return typeof r.id === 'string' && typeof r.name === 'string' ? [{id: r.id, name: r.name, role: typeof r.role === 'string' ? r.role : '', opens: r.opens === true,
      ...(typeof r.why === 'string' ? {why: r.why} : {})}] : []
  })
}
function ReturnedRows({p}: {p: ClipProps}) {
  const list = returnedOf(p.v)
  if (list === undefined) return <Said>No reading of what the run returned.</Said>
  if (!list.length) return <Said>The run has returned nothing yet.</Said>
  const items: RowItem[] = list.map(item => ({id: item.id, name: item.name, light: item.opens ? 'lit' : 'dark', note: item.role || undefined,
    ...(item.opens ? {does: 'Opens beside you.'} : {why: item.why || 'It does not open.'})}))
  return <List label="Returned" does="What the run returned: its artifacts and the evidence that shows them. Click one to open it beside you; one that does not open says why."
    items={items} size={2} page={numOf(p.v, 'returned.page') ?? 0} onPage={n => p.set('returned.page', n)} onSelect={id => p.set('open', id)} />
}
// REPLACED (O-I 795, round 13): NO_CRITERION_OWNER, "No owner writes a success condition yet": Add writes the task's own settings on AIKit
// (agent/clipBinding.ts SETTING_OF criterion), and the binding says why where it cannot.

function IntentPanel(p: ClipProps) {
  const list = criteriaOf(p.v), verdict = verdictOf(list)
  const items: RowItem[] = (list ?? []).map(c => ({id: c.id, name: c.text, light: c.state === 'satisfied' ? 'lit' : c.state === 'unsatisfied' ? 'dark' : 'unknown',
    tone: c.state === 'satisfied' ? 'green' : undefined, note: c.state ? `${VERDICT_WORD[c.state]}${c.state !== 'indeterminate' && c.evidence !== undefined ? ` ·${c.evidence}` : ''}` : undefined,
    does: c.state ? `${VERDICT_SAYS[c.state]}${c.evidence !== undefined ? ` ${c.evidence} evidence.` : ''}` : 'No return yet.'}))
  return <Rows>
    <Row label="Intent"><TextField {...p.standing?.intent} label="Intent" does="The difference the task must make, in one line. Factory keeps it with the run; the words stay in their source." value={strOf(p.v, 'intent') ?? ''} placeholder={NONE} onChange={x => p.set('intent', x)} /></Row>
    <Row label="From"><Fact label="From" does="The source the intent is read from. Factory never copies it." value={strOf(p.v, 'intent.source')} /></Row>
    <Rule />
    {list === undefined ? <Said>No reading of the success conditions.</Said>
      : list.length === 0 ? <Said>No success condition set.</Said>
        : <List label="Success" does="The conditions that show the task made its difference. The light is the run's return: green met, dark not met, hollow open or not returned."
          items={items} size={3} page={numOf(p.v, 'criteria.page') ?? 0} onPage={n => p.set('criteria.page', n)} />}
    <Row label="Add"><TextField {...p.standing?.criterion} label="Add" does="A new success condition: how you will know the task made its difference. Press Enter to add it." value={strOf(p.v, 'criterion') ?? ''} placeholder="How you will know" onChange={x => p.set('criterion', x.trim() || undefined)} /></Row>
    <Rule />
    <Row label="Return"><Fact label="Return" does="Across the conditions: not met if one is not met, open if one is open, met when all are met." value={verdict ? VERDICT_WORD[verdict] : undefined} tone={verdict ? VERDICT_TONE[verdict] : undefined} /></Row>
    <ReturnedRows p={p} />
    <Row label="Context"><Fact label="Context" does="What the task may read for this intent, as AIKit resolved it, and the constraints it keeps." value={strOf(p.v, 'context') === undefined ? undefined : `${strOf(p.v, 'context')}${numOf(p.v, 'constraints') !== undefined ? ` · ${numOf(p.v, 'constraints')} limits` : ''}`} /></Row>
  </Rows>
}

// ---------------------------------------------------------------- the Plan panel

const RUNGS: readonly Option<string>[] = [
  {value: 'P0', label: 'P0', does: 'Pointers: a few outcomes and where to look. The builder works out the how. For simple, reversible work.'},
  {value: 'P1', label: 'P1', does: 'Spec: intent, mini-requirements, a failing-test-first proof contract and the files it may change.'},
  {value: 'P2', label: 'P2', does: 'Research: the spec, plus a research round that returns before the spec freezes.'},
  {value: 'P3', label: 'P3', does: 'Adversarial: plus an attack on the plan by someone who did not write it.'},
  {value: 'P4', label: 'P4', does: 'Blind design: plus a design made before reading the priors, then compared with them.'},
]
const WAVE_TONE = (wave: string | undefined) => wave?.endsWith('Sealed') ? 'green' : wave?.endsWith('Fix round') || wave?.endsWith('Unread') ? 'stall' : undefined
interface LadderRung {readonly id: string; readonly name: string; readonly value: string; readonly why: string}
interface PlanRound {readonly id: string; readonly name: string; readonly note?: string; readonly does?: string}

function PlanPanel(p: ClipProps) {
  const rounds = read<PlanRound[] | undefined>(p.v, 'plan.rounds', undefined)
  const ladder = read<LadderRung[] | undefined>(p.v, 'ladder', undefined)
  const locked = strOf(p.v, 'plan.locked'), wave = strOf(p.v, 'wave')
  return <Rows>
    <Wide><Radio {...p.standing?.plan} label="Planning" does="How much planning the task's unit gets, chosen for the piece: the planner sets the rung with its reason, and you lock the plan."
      value={choice(p.v, 'plan')} options={RUNGS} onChange={x => p.set('plan', x)} /></Wide>
    <Row label="Asks"><Fact label="Asks" does="What the rung asks of the plan." value={strOf(p.v, 'plan.asks')} /></Row>
    <Row label="Why"><Fact label="Why" does="Why the piece earns this rung: an unknown only research can close, or a failure its author cannot see." value={strOf(p.v, 'plan.why')} /></Row>
    <Row label="Files"><Fact label="Files" does="The files the unit may change. Units in one wave build side by side in files of their own." value={strOf(p.v, 'plan.territory')} /></Row>
    {locked !== undefined
      ? <Row label="Locked"><Fact label="Locked" does="The plan is locked: it takes no new rung and no further round." value={locked} tone="green" /></Row>
      : <Row label="Needs"><Fact label="Needs" does="The rounds the rung still needs before the plan locks." value={strOf(p.v, 'plan.needs')} /></Row>}
    <Row label="Lock"><Action {...p.standing?.['plan.lock']} label="Lock" does="Locks the plan as it stands. Factory refuses while the rung's rounds have not returned. A lock is never undone."
      onPress={() => p.set('plan.lock', Date.now())} /></Row>
    {rounds === undefined ? <Said>No reading of the plan's rounds.</Said> : rounds.length === 0 ? <Said>No round has returned.</Said>
      : <List label="Rounds" does="The planning rounds that returned, each with who ran it and what it returned."
        items={rounds.map(round => ({id: round.id, name: round.name, light: 'lit', note: round.note || undefined, does: round.does || undefined}))}
        size={2} page={numOf(p.v, 'plan.rounds.page') ?? 0} onPage={n => p.set('plan.rounds.page', n)} />}
    <Rule />
    <Row label="Wave"><Fact label="Wave" does="The wave the unit builds in, and how it stands. A wave seals when two reviewers who wrote none of it clear one revision." value={wave} tone={WAVE_TONE(wave)} /></Row>
    <Row label="Gate"><Fact label="Gate" does="What holds the wave where it stands." value={strOf(p.v, 'wave.gate')} /></Row>
    <Row label="Next"><Fact label="Next" does="The next step the wave can take." value={strOf(p.v, 'wave.next')} /></Row>
    {ladder === undefined ? <Said>No reading of the unit's ladder.</Said>
      : <List label="Ladder" does="How far the unit has come: its plan locked, a candidate built, merged, and its wave reviewed. Hollow: Factory cannot tell."
        items={ladder.map(rung => ({id: rung.id, name: rung.name, light: rung.value === 'yes' ? 'lit' : rung.value === 'no' ? 'dark' : 'unknown',
          tone: rung.value === 'yes' ? 'green' : undefined, does: rung.why || undefined}))} size={4} />}
  </Rows>
}

const LOOP_UNTIL: readonly Option<string>[] = [{value: 'done', label: 'Task done', does: 'The task stops looping when it is done.'}, {value: 'pass', label: 'Test pass', does: 'The task stops looping when its test passes.'}]

function ClipPanel(p: ClipProps) {
  const state = strOf(p.v, 'state')
  const used = numOf(p.v, 'turns.used'), cap = numOf(p.v, 'turns.cap')
  return <Rows>
    <Row label="Name"><TextField label="Name" does="The task's name. It comes from the first message until you change it." value={strOf(p.v, 'name') ?? ''} onChange={x => p.set('name', x)} /></Row>
    <Row label="Colour"><Chooser label="Colour" does="The colour of the clip on the grid and the ruler. A task takes its session's colour." value={choice(p.v, 'colour')} options={COLOURS} onChange={x => p.set('colour', x)} /></Row>
    <Row label="Constellation"><MadeOf p={p} what="the task" /></Row>
    <Row label="Groove"><GrooveOf p={p} /><GrooveSwap p={p} /></Row>
    {grooved(p.v) && <Row label="Reading"><GrooveReading p={p} /></Row>}
    <Row label="State"><Fact label="State" does="How the task stands, as Factory reads it from the session's evidence. A stalled task lights its track's retry."
      value={state ? `${STATE_WORD[state] ?? state}${p.v['state.retry'] === true ? ' · retry lit' : ''}` : undefined}
      tone={state ? STATE_TONE[state as keyof typeof STATE_TONE] : undefined} /></Row>
    <Row label="Why"><Fact label="Why" does="The evidence the state was read from: the check-in bound, the session's own state, a request that waits for you, or why nothing decides." value={strOf(p.v, 'state.why')} /></Row>
    {strOf(p.v, 'closure') !== undefined && <Row label="Closed"><Fact label="Closed" does="Why the task's work closed, as Factory keeps it: how it closed and the reason it names." value={strOf(p.v, 'closure')} /></Row>}
    <Row label="Turns"><Fact label="Turns" does="The turns the task has used of the turns the agent's budget allows. The transport's time signature shows the same reading."
      value={used !== undefined && cap !== undefined ? `${used} of ${cap}` : undefined} /></Row>
    <Rule />
    <Wide><Radio label="Output style" does="How the agent writes for this task: plain, warm or terse." value={choice(p.v, 'style.register')} onChange={x => p.set('style.register', x)}
      options={[{value: 'plain', label: 'Plain'}, {value: 'warm', label: 'Warm'}, {value: 'terse', label: 'Terse'}]} /></Wide>
    <Wide><Radio label="Output form" does="The shape of what the agent writes for this task: technical, narrative or a list." value={choice(p.v, 'style.form')} onChange={x => p.set('style.form', x)}
      options={[{value: 'technical', label: 'Technical'}, {value: 'narrative', label: 'Narrative'}, {value: 'list', label: 'List'}]} /></Wide>
    <Rule />
    <Wide><Radio {...p.standing?.loop} label="Loop" does="Runs the task again after each finish, until its stop condition or the cap." value={p.v.loop === true ? 'on' : p.v.loop === false ? 'off' : ''}
      onChange={x => p.set('loop', x === 'on')} options={[{value: 'off', label: 'Off'}, {value: 'on', label: 'On'}]} /></Wide>
    <Row label="Until"><Chooser {...p.standing?.['loop.until']} label="Until" does="The stop condition that ends the loop." value={choice(p.v, 'loop.until')} options={LOOP_UNTIL}
      onChange={x => p.set('loop.until', x)} disabled={p.standing?.['loop.until']?.disabled ?? (p.v.loop === true ? undefined : 'Loop is Off.')} /></Row>
    <Row label="Cap"><TextField {...p.standing?.['loop.cap']} label="Cap" does="The most runs the loop makes, whatever its stop condition says." value={numOf(p.v, 'loop.cap') === undefined ? '' : String(numOf(p.v, 'loop.cap'))}
      placeholder={NONE} onChange={x => { const n = Math.round(Number(x)); p.set('loop.cap', Number.isFinite(n) && n > 0 ? n : undefined) }}
      disabled={p.standing?.['loop.cap']?.disabled ?? (p.v.loop === true ? undefined : 'Loop is Off.')} /></Row>
    {strOf(p.v, 'loop.pass') !== undefined && <Row label="Last pass"><Fact label="Last pass" does="What Loop's last pass of a song made: the take Factory started and its Run, or why the loop stopped." value={strOf(p.v, 'loop.pass')} /></Row>}
  </Rows>
}

const LAUNCH_MODES: readonly Option<string>[] = [
  {value: 'trigger', label: 'Trigger', does: 'Starts the task when you press its launch.'},
  {value: 'gate', label: 'Gate', does: 'Runs the task only while you hold the launch.'},
  {value: 'toggle', label: 'Toggle', does: 'Starts the task with one press and stops it with the next.'},
  {value: 'repeat', label: 'Repeat', does: 'Launches the task again at each quantize step while you hold the launch, each run a take of its own.'},
]
const THENS: readonly Option<string>[] = [{value: 'next', label: 'Next task', does: 'The next task on this track starts.'}, {value: 'again', label: 'Again', does: 'The task runs again.'},
  {value: 'stop', label: 'Stop', does: 'The track stops after the task.'}]
const VARIABLES: readonly Option<string>[] = ['Condition', 'Model', 'Effort', 'Skillset', 'Budget', 'Tool calls'].map(x => ({value: x.toLowerCase().replace(' ', '_'), label: x,
  does: x === 'Condition' ? 'How the agent\'s loop recurs: classic, or one of Quaternal Logic\'s conditions.'
    : x === 'Tool calls' ? 'Which of the agent\'s tool calls wait for you changes from one run to the next.' : `The ${x.toLowerCase()} changes from one run to the next.`}))
const STOPS: readonly Option<string>[] = [{value: 'turns', label: 'Turn cap'}, {value: 'time', label: 'Time cap'}, {value: 'done', label: 'Task done'}, {value: 'pass', label: 'Test pass'}]
const COMPARES: readonly Option<string>[] = [{value: 'none', label: 'None'}, {value: 'second', label: 'A second take'}, {value: 'every', label: 'Every take'}]
/** The levels as you wrote them, one to three values. */
const levelsOf = (v: ClipProps['v']) => (strOf(v, 'repeat.levels') ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 3)

function LaunchPanel(p: ClipProps) {
  const repeat = choice(p.v, 'launch') === 'repeat', off = repeat ? undefined : 'Set Launch mode to Repeat first.'
  const levels = levelsOf(p.v), takes = numOf(p.v, 'takes'), runs = numOf(p.v, 'repeat.repeats')
  // Launch mode and Then across the panel; Quantize and what a Repeat varies two to a row, so the panel never scrolls. A task has no
  // legato and no launch velocity, so the panel holds neither.
  return <>
    <Fields cols={1}>
      <Wide><Radio {...p.standing?.launch} label="Launch mode" does="Live's launch modes: Trigger, Gate, Toggle, Repeat." value={choice(p.v, 'launch')} onChange={x => p.set('launch', x)} options={LAUNCH_MODES} /></Wide>
      <Wide><Radio {...p.standing?.then} label="Then" does="What follows the task, on the same session's track: its follow action. To hand the work to another session, drag the task onto that session's track."
        value={choice(p.v, 'then')} onChange={x => p.set('then', x)} options={THENS} /></Wide>
    </Fields>
    <Rule />
    {/* Repeat: what varies between the runs. Once the first run starts these stay; a change starts a new set of takes. */}
    <Fields>
      <Chooser {...p.standing?.quantize} label="Quantize" does="When a launch or a steer lands. Global follows the transport's Quantize." value={choice(p.v, 'quantize')} onChange={x => p.set('quantize', x)}
        options={[{value: 'global', label: 'Global'}, {value: 'now', label: 'Now'}, {value: 'next tool', label: 'Next tool'}, {value: 'next turn', label: 'Next turn'}]} />
      <Chooser {...p.standing?.['repeat.variable']} label="Variable" does="With Repeat: the setting that changes from one run to the next." value={choice(p.v, 'repeat.variable')} options={VARIABLES}
        onChange={x => p.set('repeat.variable', x)} disabled={p.standing?.['repeat.variable']?.disabled ?? off} />
      <TextField {...p.standing?.['repeat.levels']} label="Levels" does="With Repeat: the values the variable takes, one to three, separated by commas. Each value is one group of takes."
        value={strOf(p.v, 'repeat.levels') ?? ''} placeholder={NONE} onChange={x => p.set('repeat.levels', x)} disabled={p.standing?.['repeat.levels']?.disabled ?? off} />
      <Chooser {...p.standing?.['repeat.repeats']} label="Repeats" does="With Repeat: the number of runs for each level." value={runs === undefined ? '' : String(runs)}
        options={Array.from({length: 32}, (_, i) => ({value: String(i + 1), label: String(i + 1)}))} onChange={x => p.set('repeat.repeats', Number(x))} disabled={p.standing?.['repeat.repeats']?.disabled ?? off} />
      <Chooser {...p.standing?.['repeat.stop']} label="Stop when" does="With Repeat: the condition that ends each run." value={choice(p.v, 'repeat.stop')} options={STOPS}
        onChange={x => p.set('repeat.stop', x)} disabled={p.standing?.['repeat.stop']?.disabled ?? off} />
      <Chooser {...p.standing?.compare} label="Compare" does="With Repeat: draws the takes side by side, a line for each run and the readings as lanes. The takes' own setting, read in Arrangement view."
        value={choice(p.v, 'compare')} options={COMPARES} onChange={x => p.set('compare', x)} disabled={p.standing?.compare?.disabled ?? off} />
      <Fact label="Takes" does="The takes this Repeat has made, of the runs it will make: one group for each level." value={takes === undefined ? undefined
        : `${takes}${runs !== undefined && levels.length ? ` of ${runs * levels.length}` : ''}`} />
    </Fields>
  </>
}

const logBar = (p: ClipProps) => <>
  <Radio label="Lanes" does="Fold keeps only the lanes of the tools the agent used." value={p.v.fold === false ? 'all' : 'fold'} onChange={x => p.set('fold', x === 'fold')}
    options={[{value: 'fold', label: 'Fold', does: 'Only the tools the agent used.'}, {value: 'all', label: 'All tools', does: 'Every tool lane.'}]} />
  <Toggle label="Warp" does="Lays the log on the score's ruler: the unit's start on its note's start, its return on the note's end. Off, the log lies on the clock, as the run went."
    on={p.v.warp === true} onChange={x => p.set('warp', x)} disabled={p.standing?.warp?.disabled ?? warpWhy(p.v)} />
</>

const corner = (p: ClipProps) => {
  const editor = choice(p.v, 'view.editor', 'notes')
  if (editor === 'notes' || editor === 'vak') {
    const shown = shownScore(p.v), key = strOf(p.v, 'unit') ?? strOf(p.v, 'unit.own'), u = shown?.score.units.find(x => x.key === key)
    if (!shown || !u) return null
    const pos = laid(shown.score).at.get(u.key), row = shown.score.rows.find(r => r.id === u.row)?.name ?? u.row
    return <span className="clv-own" data-i={`Selected|${u.concern ?? u.key}`}>{fit(`${u.key} · ${row}${pos ? ` · steps ${stepLabel(pos.at)}–${Math.round(pos.at + pos.len) + 1}` : ''}`, 260)}</span>
  }
  const log = logOf(p.v), selected = strOf(p.v, 'event')
  const at = log.findIndex((e, i) => `e${e.at}-${i}` === selected)
  return at >= 0 ? <span className="clv-own" data-i={`Selected|${log[at]!.text}`}>{fit(`${clock(log[at]!.at)} ${log[at]!.tool ?? ''} ${log[at]!.text}`, 260)}</span> : null
}

const LOG = [
  {at: 0, kind: 'say', text: 'Write the hand-off fixtures for the bridge widgets.'},
  {at: 3, kind: 'tool', tool: 'Read', dur: 2, text: 'widgets/handoff.tsx · 214 lines'},
  {at: 6, kind: 'tool', tool: 'Grep', dur: 1, text: 'handoff fixtures · 9 files'},
  {at: 9, kind: 'tool', tool: 'Read', dur: 3, text: 'fixtures/README.md'},
  {at: 14, kind: 'tool', tool: 'Edit', dur: 4, text: 'fixtures/handoff.json · +42 −3'},
  {at: 21, kind: 'steer', text: 'Keep the old ids; only add new ones.', heard: 'heard at next tool'},
  {at: 23, kind: 'tool', tool: 'Edit', dur: 3, text: 'fixtures/handoff.json · ids kept'},
  {at: 29, kind: 'tool', tool: 'Bash', dur: 9, text: 'pnpm test bridge · 12 passed'},
  {at: 40, kind: 'spawn', dur: 14, text: 'test · full widget tests'},
  {at: 43, kind: 'say', text: 'Three beats: compose, settle, hand off.'},
  {at: 50, kind: 'steer', text: 'Also drop the old capture list from your reads.', heard: 'heard at next tool'},
  {at: 56, kind: 'tool', tool: 'Write', dur: 2, text: 'fixtures/capture.json'},
  {at: 61, kind: 'tool', tool: 'Bash', dur: 3, text: 'pnpm test bridge2 · 12 passed'},
  {at: 66, kind: 'tool', tool: 'Bash', state: 'runs', text: 'pnpm build widgets'},
]
const STALLED = [
  {at: 0, kind: 'say', text: 'Generate the fixtures for the widgets.'},
  {at: 2, kind: 'tool', tool: 'Read', dur: 2, text: 'scripts/gen-fixtures.ts'},
  {at: 5, kind: 'tool', tool: 'Bash', dur: 4, state: 'waits', text: 'gen-fixtures --widgets handoff · no output'},
  {at: 9, kind: 'stall', text: 'Waits for an answer: overwrite fixtures/handoff.json (y/N)'},
]

/** A returned run of the same task: the log to the return, with what the retrospective pass read against the score. */
const RETURNED = [
  ...LOG.slice(0, -1),
  {at: 31, kind: 'reading', reading: 'T3′ Anomaly', text: 'The first test run read the old capture list, which the score had given to Builder B'},
  {at: 66, kind: 'tool', tool: 'Bash', dur: 5, text: 'pnpm build widgets · built'},
  {at: 72, kind: 'reading', reading: 'T5′ Integration', text: 'Every widget has its fixture, and the old ids hold'},
]

// The song the task is a unit of: the bridge widgets' hand-off, from its plan, as Factory would read it. Rows are the agents and
// agent sets on the track's rack; Scribe is on the rack and has no part.
const C = (CPF: string, CT: string, CP: string, CF: string, CFP: Form, CS: string, direction = 'forward') => ({CPF, CT, CP, CF, CFP, CS, direction})
const GUARDIANS: Score = {
  name: 'release-check',
  rows: [{id: 'g-lead', name: 'Field guardian', kind: 'agent'}, ...['Central', 'AIKit', 'Actuation', 'Factory', 'Workcell', 'QL'].map(n => ({id: `g-${n.toLowerCase()}`, name: `${n} guardian`, kind: 'agent' as const}))],
  units: [
    {key: 'gather', row: 'g-lead', heads: C('dialogical', 'CT1', '4.1', 'CF2', 'CFP0', 'CS2')},
    ...['central', 'aikit', 'actuation', 'factory', 'workcell', 'ql'].map(n => ({key: `check-${n}`, row: `g-${n}`, deps: ['gather'], heads: C('dialogical', 'CT3', '4.3', 'CF4', 'CFP1', 'CS3')})),
    {key: 'report', row: 'g-lead', heads: C('dialogical', 'CT5', '4.5', 'CF7', 'CFP0', 'CS5', 'returning')},
  ],
  joins: [{key: 'agree', waits: ['central', 'aikit', 'actuation', 'factory', 'workcell', 'ql'].map(n => `check-${n}`), releases: ['report'], join: 'all'}],
  waves: [],
}
const SCORE: Score = {
  name: 'Bridge widget hand-off',
  rows: [
    {id: 'planner', name: 'Planner', kind: 'agent', rack: true}, {id: 'builder-a', name: 'Builder A', kind: 'agent', rack: true},
    {id: 'builder-b', name: 'Builder B', kind: 'agent', rack: true}, {id: 'reviewers', name: 'Reviewers', kind: 'set', rack: true},
    {id: 'guardians', name: 'Guardians', kind: 'set', rack: true}, {id: 'aletheia', name: 'Aletheia', kind: 'set', rack: true},
    {id: 'ci', name: 'CI watch', kind: 'agent', rack: true}, {id: 'scribe', name: 'Scribe', kind: 'agent', rack: true},
  ],
  units: [
    {key: 'plan-fixtures', row: 'planner', wave: 'w1', heads: C('dialogical', 'CT1', '4.1', 'CF2', 'CFP0', 'CS2'),
      concern: 'Say which fixtures each bridge widget needs, and where they live', returns: 'The fixture list, widget by widget', sources: ['Plan · widget hand-off'],
      success: ['Every bridge widget is named'], may: ['read widgets/'], stop: 'Stop when the plan names no widget', escalate: 'Escalate a widget the plan does not cover'},
    {key: 'write-fixtures', row: 'builder-a', deps: ['plan-fixtures'], len: 2, wave: 'w1', heads: C('authorised-undertaking', 'CT2', '4.2', 'CF3', 'CFP1', 'CS2'),
      concern: 'Write the hand-off fixtures for the bridge widgets', returns: 'The fixture files, and the test run that reads them',
      sources: ['Plan · widget hand-off', 'widgets/handoff.tsx'], success: ['Every widget has a hand-off fixture', 'Old fixture ids are kept', 'pnpm test bridge passes'],
      may: ['edit fixtures/'], stop: 'Stop when a widget has no hand-off to fix', escalate: 'Escalate a fixture id that must change'},
    {key: 'drop-capture', row: 'builder-b', deps: ['plan-fixtures'], wave: 'w1', heads: {CPF: 'authorised-undertaking', CT: 'CT2', CP: '4.2', CF: 'CF3', CFP: 'CFP1', direction: 'forward'},
      concern: 'Drop the old capture list from the reads', returns: 'The reads without the capture list', sources: ['fixtures/capture.json'],
      success: ['No read names the capture list'], may: ['edit fixtures/capture.json'], stop: 'Stop when nothing reads the list'},
    {key: 'review', row: 'reviewers', len: 2, wave: 'w2', heads: C('dialogical', 'CT3', '4.3', 'CF4', 'CFP3', 'CS3'),
      concern: 'Read the wave\'s structure and its claims, by two who wrote none of it', returns: 'One reading of the wave, with its findings', success: ['Both readers clear one revision']},
    {key: 'release-check', row: 'guardians', len: 2, wave: 'w2', heads: C('dialogical', 'CT3', '4.4', 'CF6', 'CFP5', 'CS4', 'returning'), song: GUARDIANS,
      concern: 'Check the suite agrees before the hand-off lands', returns: 'Each guardian\'s word, and where they disagree'},
    {key: 'return-handoff', row: 'aletheia', wave: 'w2', heads: C('authorised-undertaking', 'CT5', '4.5', 'CF7', 'CFP0', 'CS5', 'returning'),
      concern: 'Return the hand-off: what was meant, what came back, what was learned', returns: 'The Return, with its readings', may: ['write one Return to the NOW field']},
    {key: 'watch-ci', row: 'ci', wave: 'w1', heads: C('dialogical', 'CT0', '4.0', 'CF1', 'CFP4', 'CS1'),
      concern: 'Watch the bridge tests, and raise any that fails', returns: 'Each failure, as it comes', stop: 'Stop when the song returns'},
  ],
  joins: [
    {key: 'merged', waits: ['write-fixtures', 'drop-capture'], releases: ['review', 'release-check'], join: 'all'},
    {key: 'sealed', waits: ['review', 'release-check'], releases: ['return-handoff'], join: 'all'},
  ],
  waves: [{id: 'w1', name: 'w1', state: 'Building'}, {id: 'w2', name: 'w2', state: 'Waiting'}],
}
/** The same song as Anima proposed it from the Intent: the second wave dashed, until you accept it. */
const PROPOSED: Score = {...SCORE, units: SCORE.units.map(u => (u.wave === 'w2' ? {...u, proposed: true} : u))}

export const clip: DesignedClip = {
  id: 'clip:factory',
  mode: 'factory',
  title: 'A Factory task',
  head: {name: 'name', colour: 'colour', active: 'active'},
  defaults: {
    name: 'Write the hand-off fixtures', colour: 'var(--fizz)', active: true, state: 'running', 'state.why': 'Checked in 4 s ago, within the 90 s bound.', 'turns.used': 5, 'turns.cap': 12,
    madeOf: 'The hand-off', 'madeOf.ref': 'wiki:anchor:hand-off',
    'style.register': 'plain', 'style.form': 'technical', loop: false, 'loop.until': 'done', 'loop.cap': 5, launch: 'trigger', then: 'next', quantize: 'global',
    'repeat.variable': 'condition', 'repeat.levels': 'classic, 4.0, 5.0', 'repeat.repeats': 3, 'repeat.stop': 'done', compare: 'none',
    log: JSON.stringify(LOG), elapsed: 68, fold: true, event: 'e29-7',
    intent: 'Hand-off fixtures cover every bridge widget', 'intent.source': 'Plan · widget hand-off', context: '9 sources', constraints: 2,
    criteria: JSON.stringify([
      {id: 'c1', text: 'Every widget has a hand-off fixture'}, {id: 'c2', text: 'Old fixture ids are kept'}, {id: 'c3', text: 'pnpm test bridge passes'}]),
    'env.control': 'effort', 'env.mode': 'automation', 'env.linked': true,
    'env.agent.effort': JSON.stringify([[0, 2], [28, 3], [40, 1], [60, 3]]), 'env.scope.toolCalls': JSON.stringify([[0, 1], [50, 2]]),
    plan: 'P2', 'plan.asks': 'The spec, plus a research round that returns before the spec freezes.', 'plan.why': 'The fixture format is an unknown only research can close.',
    'plan.territory': 'fixtures/', 'plan.needs': 'Research', 'plan.rounds': JSON.stringify([]), wave: 'w1 · Planning',
    'wave.gate': 'write-fixtures\'s plan at P2 is not locked', 'wave.next': 'record write-fixtures\'s research round, then lock its plan',
    ladder: JSON.stringify([{id: 'locked', name: 'Plan locked', value: 'no', why: 'not locked; P2 still needs research'}, {id: 'built', name: 'Built', value: 'no', why: 'no candidate frozen'},
      {id: 'merged', name: 'Merged', value: 'no', why: 'no candidate to merge'}, {id: 'reviewed', name: 'Reviewed', value: 'no', why: 'wave w1 stands planning'}]),
    score: JSON.stringify(SCORE), 'unit.own': 'write-fixtures', 'score.fold': 'fold', 'score.highlight': 'none',
    'score.check': JSON.stringify({state: 'admitted', why: 'every composition admitted; the source compiles'}),
    warp: false, 'tr.tool': 'form', 'tr.form': 'CFP3', 'tr.join': 'all', 'tr.to': 'builder-b', 'tr.on': 'plan-fixtures', 'tr.auto': false,
    'gen.tool': 'compose', 'gen.waves': 2, 'gen.decider': 'Kev · this machine',
    'view.panel': 'launch', 'view.tools': 'transform', 'view.editor': 'notes',
  },
  fixtures: {
    'A running task': {},
    'A stalled task': {name: 'Generate the fixtures', colour: 'var(--stall)', state: 'stalled', 'state.retry': true, 'state.why': 'No check-in within the 90 s bound: the last was 412 s ago, with its task open.',
      'turns.used': 2, log: JSON.stringify(STALLED), elapsed: 9, then: 'again', loop: true, event: 'e5-2', 'view.panel': 'clip', 'view.editor': 'log'},
    'A closed task': {state: 'done', 'state.why': 'Closed: released superseded → task:fixtures-2.', closure: 'released superseded → task:fixtures-2', 'view.panel': 'clip', 'view.editor': 'log'},
    'An experiment with Repeat': {launch: 'repeat', 'repeat.variable': 'model', 'repeat.levels': 'opus, sonnet, haiku', 'repeat.repeats': 4, 'repeat.stop': 'pass', compare: 'every', takes: 7},
    'Its intent, returned': {'view.panel': 'intent', state: 'done', criteria: JSON.stringify([
      {id: 'c1', text: 'Every widget has a hand-off fixture', state: 'satisfied', evidence: 2}, {id: 'c2', text: 'Old fixture ids are kept', state: 'satisfied', evidence: 1},
      {id: 'c3', text: 'pnpm test bridge passes', state: 'indeterminate'}]),
      returned: JSON.stringify([{id: 'central:source:control:root:fixtures/handoff.json', name: 'fixtures/handoff.json', role: 'artifact', opens: true},
        {id: 'evidence:bridge-tests', name: 'evidence:bridge-tests', role: 'evidence', opens: false,
          why: 'the Return names evidence:bridge-tests, and no Factory record binds it to a file'}])},
    'Its plan, in a fix round': {'view.panel': 'plan', plan: 'P3', 'plan.asks': 'The spec and its research, plus an adversarial pass by someone who did not write the plan.',
      'plan.why': 'load-bearing: a wrong plan ships the failure it exists to stop', 'plan.territory': 'kernel/', 'plan.needs': undefined,
      'plan.locked': 'P3 · by central:position:project:O-I:planner',
      'plan.rounds': JSON.stringify([{id: 'r0', name: 'Research', note: 'central:position:project:O-I:planner', does: 'evidence:research:compiler'},
        {id: 'r1', name: 'Adversarial pass', note: 'central:position:project:O-I:critic', does: 'evidence:adversarial:compiler; amends: a failing test pins the empty-input refusal'}]),
      wave: 'w1 · Fix round', 'wave.gate': 'the claims leg found 1 finding at c2f40bdca',
      'wave.next': 'merge the forward fixes, then both legs review again at the round\'s final revision (main at c2f40bdca)',
      ladder: JSON.stringify([{id: 'locked', name: 'Plan locked', value: 'yes', why: 'locked at P3 by central:position:project:O-I:planner'},
        {id: 'built', name: 'Built', value: 'yes', why: 'candidate 595536f13 frozen by central:position:project:O-I:builder-b'},
        {id: 'merged', name: 'Merged', value: 'yes', why: '595536f13 is contained in main at c2f40bdca'},
        {id: 'reviewed', name: 'Reviewed', value: 'no', why: 'wave w1 stands fix-round: the claims leg found 1 finding at c2f40bdca'}])},
    'Its envelopes': {'view.editor': 'envelopes', 'env.mode': 'modulation', 'env.agent.effort': JSON.stringify([[0, 2], [30, 3], [45, 1]])},
    'No readings': {state: undefined, 'state.why': undefined, 'state.retry': undefined, closure: undefined, 'turns.used': undefined, 'turns.cap': undefined, log: undefined, elapsed: undefined, launch: undefined, then: undefined, quantize: undefined, loop: undefined,
      'loop.until': undefined, 'loop.cap': undefined, 'repeat.variable': undefined, 'repeat.levels': undefined, 'repeat.repeats': undefined, 'repeat.stop': undefined, compare: undefined, takes: undefined,
      intent: undefined, 'intent.source': undefined, criteria: undefined, context: undefined, constraints: undefined, returned: undefined,
      plan: undefined, 'plan.asks': undefined, 'plan.why': undefined, 'plan.territory': undefined, 'plan.needs': undefined, 'plan.rounds': undefined,
      wave: undefined, 'wave.gate': undefined, 'wave.next': undefined, ladder: undefined, score: undefined, 'unit.own': undefined, 'score.check': undefined, 'gen.decider': undefined},
    'Its log against the score': {'view.editor': 'log', 'view.panel': 'intent', state: 'done', 'state.why': 'Returned: the attempt closed with its Return.', warp: true,
      log: JSON.stringify(RETURNED), elapsed: 72, event: 'e29-7', criteria: JSON.stringify([
        {id: 'c1', text: 'Every widget has a hand-off fixture', state: 'satisfied', evidence: 2}, {id: 'c2', text: 'Old fixture ids are kept', state: 'satisfied', evidence: 1},
        {id: 'c3', text: 'pnpm test bridge passes', state: 'satisfied', evidence: 1}])},
    'What each unit carries': {'view.editor': 'vak', 'view.tools': 'generate', 'gen.tool': 'heads', unit: 'drop-capture'},
    'A score proposed from its intent': {score: JSON.stringify(PROPOSED), 'view.tools': 'generate', 'gen.tool': 'compose', 'view.panel': 'intent',
      'gen.status': JSON.stringify({state: 'refused', why: 'drop-capture has no CS'}),
      'score.check': JSON.stringify({state: 'refused', why: 'drop-capture has no CS: a composition holds all seven heads'})},
    'A song inside the score': {'score.open': 'release-check', unit: 'gather', 'view.panel': 'plan'},
    'Its thread forms, highlighted': {'score.highlight': 'CFP1', 'score.fold': 'rack', unit: 'drop-capture'},
  },
  panel: [
    {id: 'clip', label: 'Clip', does: 'The task\'s name, colour, state, turns, output style and loop.', draw: ClipPanel},
    {id: 'launch', label: 'Launch', does: 'How the task launches, when the launch lands, what follows it, and what a Repeat varies.', draw: LaunchPanel},
    {id: 'intent', label: 'Intent', does: 'What the task is for: the difference it must make, and the conditions that show it did.', draw: IntentPanel},
    {id: 'plan', label: 'Plan', does: 'How much planning the task gets, its rounds and its lock, and the wave it builds in.', draw: PlanPanel},
  ],
  tools: [
    {id: 'transform', label: 'Transform', does: 'Reshapes the selected units of the score: a thread form, an allocation, a tie.', draw: Transform},
    {id: 'generate', label: 'Generate', does: 'Writes into the score: a score composed from the Intent, or the open heads filled.', draw: Generate},
  ],
  editor: [
    {id: 'notes', label: 'Notes', does: 'The score: the workflow the task is a unit of, each unit a note on the row of the agent or agent set that does it.', draw: Notes, bar: notesBar},
    {id: 'log', label: 'Sample', does: 'The task\'s log as a recording: each tool the agent used along its time, your steers, where the output stopped, and where the unit started and returned.', draw: Log, bar: logBar},
    {id: 'envelopes', label: 'Envelopes', does: 'The Agent\'s Effort and Scope\'s Tool calls for this task only.', draw: Envelopes},
    {id: 'vak', label: 'Vāk', does: 'What each unit carries on its own, lane by lane: the seven heads of its composition, and its own words.', draw: Vak},
  ],
  corner,
}
