// Prompt pads (manual §19.22, software-factory:prompt-pads): the asks you make of agents again and again, kept as pads, the way a
// Drum Rack keeps sounds. Live's nearest: the Drum Rack's sixteen pads, pad 1 at the bottom left, with the selected pad's chain beside
// them. An instrument on Factory's Main track: press a pad and its task starts on the session it names, now. No pad keeps a time: a pad
// that should run by itself is a routine in Settings, Automations (§10.10), and the pad shows when the routine runs it and how each run
// went. Make routine opens Automations on a new routine for the pad you read.
//
// The owner of the bank is Factory (factory/src/prompt_pads.rs; Factory main 09c3354): sixteen slots for each project, each empty or a
// pad, and the record of every run. Factory keeps them and never runs a pad. The reading is `factory development pads <state>
// <project-ref>` (factory.prompt-pads-reading/v1: revision, scheduled_count, slots[{index, pad, next_at_unix_ms, running, last}]). A pad
// is {name, prompt, session: {kind: new} | {kind: session, session_ref}, agent_ref, scope_ref, seat, runs_at: {kind: off} | {kind: daily,
// time, days?} | {kind: every, hours 1–168}, choke: null | 1–8} (prompt_pads.rs:466-555). A run is {run_ref, state, trigger press |
// schedule, begun_at_unix_ms, ended_at_unix_ms, task_ref, session_ref, reason}; state running, or its end done | stalled | stopped |
// refused, and a stalled or refused end names its reason (:904-925, :1512-1528).
//
// Keys. The owner reports, and the binding passes in the person's civil time:
// - `pads`: sixteen rows of {index, pad, next?, running?, last?}: pad null for an empty slot, else {name, prompt, session, agent, scope,
//   seat, choke} as below; next the next run ('Thu 08:00'); running true while a run has begun and not
//   ended; nextIn the minutes until that run, which orders the tile; last {end, at, reason?, task?}; routine, where a routine runs the pad,
//   {state, unattended?, when?}: the AIKit Routine that carries it, state draft | enabled | disabled | stale-proof, and its schedule `when`
//   as a reading (`aikit routine list`, kernel op `routine` list and show). Factory's pad still carries runs_at (prompt_pads.rs); the
//   device reads when a pad runs from its routine and sets no time.
//   stale-proof is the pressure to prove the Method again before it runs alone (Factory reads the same state as
//   JourneyRoutineObservation.proof_revalidation_required, factory/src/journey_praxis.rs:99).
// - `revision`: the bank's revision, which every write must name (pads-write compare-and-swap).
// - `projects`, `sessions`, `agents`, `scopes`, `seats`: rows of {id, name} the choosers offer. A seat is `<env>/<product>`: the
//   workcell's seat the task works in.
// The shell holds `project` (the bank shown) and `pad` (the slot you read, 0–15).
// The selected pad's settings, each written alone through `pads-write` (a person only, on the bank's revision): `name`, `prompt`,
// `session` ('new' or a session id), `agent` ('project' or an agent id), `scope` ('session' or a scope id), `seat` ('session' or a
// seat), `choke` (0 for Off, or 1–8). `press` runs the selected pad now: the launch goes through the gateway as any launch does, and
// Factory records its begin (`pads-run`, trigger press) and its end (`pads-record`). `clear` empties the slot. `makeRoutine` (the pad's
// index) opens Settings, Automations on a new routine for the pad: the shell's own act, which writes nothing here.
// No kernel op reaches `factory development pads*` yet: the binding stands every write disabled with that reason until one does.
import {Action, Band, Chooser, Display, Folded, Panel, Readout, Rows, Section, TextField, Tile, ValueBox, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, grown, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__prompt-pads.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the owner's rows, read safely

const ENDS = ['done', 'stalled', 'stopped', 'refused'] as const
type End = (typeof ENDS)[number]
const END_WORD: Readonly<Record<End, string>> = {done: 'done', stalled: 'stalled', stopped: 'stopped', refused: 'refused'}
const END_SAYS: Readonly<Record<End, string>> = {
  done: 'The task finished.', stalled: 'The task stopped giving output and waits.', stopped: 'Someone stopped the task.', refused: 'The task did not start: the owner refused it.',
}
const END_INK: Readonly<Record<End, string>> = {done: 'var(--green)', stalled: 'var(--stall)', stopped: 'var(--text-dim)', refused: 'var(--text-faint)'}
const END_TONE: Readonly<Record<End, Tone | undefined>> = {done: 'green', stalled: 'stall', stopped: undefined, refused: undefined}
const ROUTINE_WORD: Readonly<Record<string, string>> = {draft: 'draft', enabled: 'enabled', disabled: 'disabled', 'stale-proof': 'proof stale'}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const object = (raw: unknown): Record<string, unknown> | undefined => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : undefined)
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)

interface Pad {
  readonly name: string
  readonly prompt?: string
  readonly session?: string
  readonly agent?: string
  readonly choke?: number
}
interface Slot {
  readonly index: number
  /** Undefined for an empty slot. */
  readonly pad?: Pad
  readonly next?: string
  /** Minutes until the next run, for the order of the tile. */
  readonly nextIn?: number
  readonly running: boolean
  readonly last?: {readonly end?: End; readonly at?: string; readonly reason?: string; readonly task?: string}
  readonly routine?: {readonly state?: string; readonly unattended?: boolean; readonly when?: string}
}

/** The sixteen slots, by index; undefined when the owner reports no bank. */
function slotsOf(v: V): Slot[] | undefined {
  const raw = json<unknown>(v, 'pads', undefined)
  if (!Array.isArray(raw)) return undefined
  const slots: Slot[] = Array.from({length: 16}, (_, index) => ({index, running: false}))
  for (const item of raw) {
    const o = object(item), index = count(o?.index)
    if (!o || index === undefined || index < 0 || index > 15) continue
    const p = object(o.pad), last = object(o.last), routine = object(o.routine)
    slots[index] = {index, running: o.running === true, next: word(o.next), nextIn: count(o.nextIn),
      pad: p ? {name: word(p.name) ?? 'Untitled pad', prompt: word(p.prompt), session: word(p.session), agent: word(p.agent), choke: count(p.choke)} : undefined,
      last: last ? {end: ENDS.find(e => e === last.end), at: word(last.at), reason: word(last.reason), task: word(last.task)} : undefined,
      routine: routine ? {state: word(routine.state), unattended: typeof routine.unattended === 'boolean' ? routine.unattended : undefined, when: word(routine.when)} : undefined}
  }
  return slots
}

/** When a routine runs the pad, as the routine reads it (a reading: the time is the routine's, set in Settings, Automations). */
const schedule = (slot: Slot | undefined): string | undefined => slot?.routine?.when
/** A pad that runs by itself: a routine carries it. */
const timedSlot = (slot: Slot) => !!slot.pad && slot.routine !== undefined

interface Reading {readonly slots: readonly Slot[] | undefined; readonly me: Slot | undefined}
const read = (v: V): Reading => { const slots = slotsOf(v), i = numOf(v, 'pad'); return {slots, me: i === undefined ? undefined : slots?.[i]} }
const scheduled = (r: Reading) => (r.slots ? r.slots.filter(timedSlot).length : undefined)
const running = (r: Reading) => (r.slots ? r.slots.filter(s => s.running).length : undefined)
const projectName = (v: V) => { const id = strOf(v, 'project'); return id === undefined ? undefined : word(json<{id?: string; name?: string}[]>(v, 'projects', []).find(x => x?.id === id)?.name) ?? id }

// ---------------------------------------------------------------- the pads, as a Drum Rack draws them

/** The sixteen pads, four by four, pad 1 at the bottom left as in a Drum Rack. A pad that holds a prompt is filled; an empty slot is
 * dashed. A pad lights while its task runs; its corner says how its last run ended; ↻ and the time stand on a pad that runs by itself; c
 * and a number name its choke group. Press a pad to read it; Run now starts the pad you read. */
function PadGrid({p, r, w, h, live, names}: {p: ViewProps; r: Reading; w: number; h: number; live: boolean; names: 'none' | 'short' | 'full'}) {
  const top = names === 'none' ? 4 : 16, gap = 4, pw = (w - 8 - gap * 3) / 4, ph = (h - top - 4 - gap * 3) / 4
  const pick = st(p, 'pad'), chars = Math.max(3, Math.floor((pw - 6) / 4.8))
  const choose = (i: number) => { if (live && !pick.disabled) p.set('pad', i) }
  const corner = r.me?.pad ? `${r.me.index + 1} · ${cut(r.me.pad.name, 14)}` : r.me ? `${r.me.index + 1} · empty` : undefined
  return <Display w={w} h={h} label="The pads" corner={names === 'none' ? undefined : corner}
    does="Sixteen pads, pad 1 at the bottom left. A lit pad runs; the corner says how its last run ended. Press a pad to read it.">
    {r.slots === undefined && <text x={6} y={h / 2} className="dp-axis">No reading of the pads</text>}
    {r.slots?.map(slot => {
      const col = slot.index % 4, row = 3 - Math.floor(slot.index / 4), x = 4 + col * (pw + gap), y = top + row * (ph + gap)
      const pad = slot.pad, me = slot.index === r.me?.index, end = slot.last?.end, sched = timedSlot(slot)
      const stale = slot.routine?.state === 'stale-proof'
      const said = pad ? `${slot.index + 1} · ${pad.name}|${[pad.prompt ? cut(pad.prompt, 80) : undefined, slot.running ? 'Its task runs now.' : end ? `Last run ${END_WORD[end]}${slot.last?.at ? ` ${slot.last.at}` : ''}.` : 'It has not run yet.',
        sched ? `A routine runs it${schedule(slot) ? ` ${schedule(slot)}` : ''}${slot.next ? `; next ${slot.next}` : ''}.` : undefined, stale ? 'Its routine needs its Method proved again before it runs alone.' : undefined].filter(Boolean).join(' ')}`
        : `${slot.index + 1}|An empty pad. Press it, then give it a prompt.`
      return <g key={slot.index} role="button" data-pad="read" tabIndex={live ? 0 : -1} aria-label={pad ? `Pad ${slot.index + 1}, ${pad.name}` : `Pad ${slot.index + 1}, empty`} aria-pressed={me}
        data-i={said} style={{cursor: live ? 'pointer' : undefined}} onClick={() => choose(slot.index)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(slot.index) } }}>
        <rect x={x + 0.5} y={y + 0.5} width={pw - 1} height={ph - 1} rx={2.5}
          className={slot.running ? 'dp-fill-on' : undefined} fill={slot.running ? undefined : pad ? 'color-mix(in srgb, var(--text) 9%, var(--dp-well))' : 'none'}
          stroke={slot.running ? 'var(--dp-on)' : me ? 'var(--sel, #7ec3e6)' : pad ? 'color-mix(in srgb, var(--text) 22%, transparent)' : 'color-mix(in srgb, var(--text) 16%, transparent)'}
          strokeWidth={slot.running || me ? 1.3 : 1} strokeDasharray={pad ? undefined : '2 2'} />
        {names !== 'none' && pad && <text x={x + 4} y={y + 10} className={slot.running ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: names === 'full' ? 9 : 8}}>{cut(pad.name, chars)}</text>}
        {names !== 'none' && !pad && <text x={x + pw / 2} y={y + ph / 2 + 3} textAnchor="middle" className="dp-axis">{slot.index + 1}</text>}
        {end && !slot.running && <circle cx={x + pw - 5} cy={y + 5} r={2.3} fill={end === 'refused' ? 'none' : END_INK[end]} stroke={END_INK[end]} strokeWidth={1} />}
        {slot.running && <circle cx={x + pw - 5} cy={y + 5} r={2.3} fill="var(--dp-on)" className="pp-run" />}
        {names !== 'none' && sched && ph >= 22 && <text x={x + 4} y={y + ph - 4} className="dp-axis" style={{fontSize: 7.5, fill: stale ? 'var(--stall)' : undefined}}>{names === 'full' ? `↻ ${slot.next ?? schedule(slot) ?? ''}` : '↻'}</text>}
        {names === 'none' && sched && <path d={`M${x + 3} ${y + ph - 3}h4`} stroke={stale ? 'var(--stall)' : 'var(--dp-value)'} strokeWidth={1.4} />}
        {names !== 'none' && pad?.choke ? <text x={x + pw - 3} y={y + ph - 4} textAnchor="end" className="dp-axis" style={{fontSize: 7.5}}>{`c${pad.choke}`}</text> : null}
      </g>
    })}
  </Display>
}

// ---------------------------------------------------------------- the controls of the pad you read

const SAYS = {
  project: 'The project whose bank of sixteen pads shows. Each project has its own.',
  name: 'The name on the pad. Its default is the prompt\'s first words.',
  prompt: 'What the task asks.',
  session: 'Where the task starts: a session of the project, or New, which opens a session with the pad\'s agent.',
  agent: 'Who works the task when the pad opens a session.',
  scope: 'What the task may read and write.',
  seat: 'The workcell seat the task runs in: its machine, its checkout and its landing.',
  makeRoutine: 'Opens Settings, Automations on a new routine for this pad. A pad runs by itself only through its routine, which is given its time there.',
  choke: 'Pads in one choke group never run at once: a pad waits while another in its group runs. Off, or a group from 1 to 8.',
  press: 'Start the pad\'s task now, through the gateway, under Scope and Arm.',
  clear: 'Empty the pad. Its record of runs stays.',
}

const lists = (v: V, key: string): Option<string>[] => json<{id?: string; name?: string}[]>(v, key, []).flatMap(o => (o && word(o.id) ? [{value: o.id!, label: word(o.name) ?? o.id!}] : []))
const withNow = (v: V, key: string, options: Option<string>[]) => { const now = strOf(v, key); return now !== undefined && !options.some(o => o.value === now) ? [...options, {value: now, label: now}] : options }
/** A setting of the pad you read: dark while the slot is empty, as Factory refuses a write to a pad that is not there. */
const gate = (p: ViewProps, r: Reading, key: string) => { const s = st(p, key); return r.me && !r.me.pad && !s.disabled ? {...s, disabled: 'The pad is empty. Write its prompt first.'} : s }
const chooser = (p: ViewProps, r: Reading, key: 'session' | 'agent' | 'scope' | 'seat', label: string, first: Option<string>, list: string) =>
  <Chooser {...gate(p, r, key)} label={label} does={SAYS[key]} wide value={strOf(p.v, key) ?? ''} options={withNow(p.v, key, [first, ...lists(p.v, list)])} onChange={x => p.set(key, x)} />
const sessionChooser = (p: ViewProps, r: Reading) => chooser(p, r, 'session', 'Session', {value: 'new', label: 'New', does: 'A new session, with the pad\'s agent.'}, 'sessions')
const agentChooser = (p: ViewProps, r: Reading) => chooser(p, r, 'agent', 'Agent', {value: 'project', label: 'The project\'s', does: 'The project\'s own agent.'}, 'agents')
const scopeChooser = (p: ViewProps, r: Reading) => chooser(p, r, 'scope', 'Scope', {value: 'session', label: 'The session\'s', does: 'The scope of the session the task starts on.'}, 'scopes')
const seatChooser = (p: ViewProps, r: Reading) => chooser(p, r, 'seat', 'Works in', {value: 'session', label: 'The session\'s', does: 'The workcell of the session the task starts on.'}, 'seats')
const chokeBox = (p: ViewProps, r: Reading) => <ValueBox {...gate(p, r, 'choke')} label="Choke" does={SAYS.choke} value={numOf(p.v, 'choke') ?? NaN} def={0}
  scale={{min: 0, max: 8, step: 1}} format={x => (x < 1 ? 'Off' : `${x}`)} onChange={x => p.set('choke', x)} />
const pressAction = (p: ViewProps, r: Reading) => {
  const s = st(p, 'press')
  return <Action {...s} label="Run now" does={SAYS.press}
    disabled={s.disabled ?? (!r.me ? 'Choose a pad.' : !r.me.pad ? 'The pad is empty.' : r.me.running ? 'Its task runs now.' : undefined)} onPress={() => p.set('press', r.me?.index)} />
}
const makeRoutineAction = (p: ViewProps, r: Reading) => {
  const s = st(p, 'makeRoutine')
  return <Action {...s} label="Make routine" does={SAYS.makeRoutine} disabled={s.disabled ?? (!r.me?.pad ? 'The pad is empty.' : r.me.routine ? 'A routine runs this pad already: change it in Settings, Automations.' : undefined)}
    onPress={() => p.set('makeRoutine', r.me?.index)} />
}
const clearAction = (p: ViewProps, r: Reading) => {
  const s = st(p, 'clear')
  return <Action {...s} hold label="Clear" does={SAYS.clear} disabled={s.disabled ?? (!r.me?.pad ? 'The pad is empty.' : r.me.running ? 'Its task runs now.' : undefined)} onPress={() => p.set('clear', r.me?.index)} />
}
const projectChooser = (p: ViewProps) => <Chooser {...st(p, 'project')} does={SAYS.project} value={strOf(p.v, 'project') ?? ''} options={withNow(p.v, 'project', lists(p.v, 'projects'))} onChange={x => p.set('project', x)} />

const light = (p: ViewProps): LightState => { const x = strOf(p.owner ?? p.v, 'light'); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const LIGHT_WHY = 'The pads are not turned on or off: a pad runs when you press it, or when its routine runs it.'
const head = (p: ViewProps) => ({light: light(p), lightWhy: LIGHT_WHY, busy: light(p) === 'lit' && (running(read(p.v)) ?? 0) > 0, onFold: p.nav.fold, onFull: p.nav.full, acts: projectChooser(p)})
const lastWord = (s?: Slot) => (s?.running ? 'running' : s?.last?.end ? `${END_WORD[s.last.end]}${s.last.at ? ` ${s.last.at}` : ''}` : s?.pad ? 'not yet' : undefined)

// ---------------------------------------------------------------- the pane: every pad, with its schedule and its record

function PadsPane({p}: {p: ViewProps}) {
  const v = p.v, r = read(v)
  return <div className="pp-pane">
    <header className="pp-head" aria-label="The bank">
      <b>{projectName(v) ?? NONE}</b><span>{r.slots ? `${r.slots.filter(s => s.pad).length} of 16 pads` : NONE}</span>
      <span>{scheduled(r) === undefined ? NONE : `${scheduled(r)} run by a routine`}</span><span>{running(r) === undefined ? NONE : `${running(r)} running`}</span>
    </header>
    <div className="pp-cols"><span>Pad</span><span>Prompt</span><span>Starts on</span><span>Routine</span><span>Next</span><span>Last run</span></div>
    <ol className="pp-list" aria-label="Pads">
      {r.slots === undefined && <li className="pp-none">No reading of the pads.</li>}
      {r.slots?.filter(s => s.pad).length === 0 && <li className="pp-none">The bank is empty. Press a pad and give it a prompt.</li>}
      {r.slots?.filter(s => s.pad).map(s => <li key={s.index}>
        <button type="button" className="pp-line" aria-pressed={s.index === r.me?.index} onClick={() => { if (!st(p, 'pad').disabled) p.set('pad', s.index) }}
          data-run={s.running || undefined} data-end={s.last?.end} data-i={`${s.index + 1} · ${s.pad!.name}|${s.last?.reason ?? (s.last?.end ? END_SAYS[s.last.end] : 'Press to read the pad.')}`}>
          <span className="pp-n">{s.index + 1}</span><b>{s.pad!.name}</b>
          <span className="pp-prompt">{s.pad!.prompt ?? NONE}</span>
          <span>{s.pad!.session === 'new' || s.pad!.session === undefined ? 'New session' : s.pad!.session}{s.pad!.choke ? ` · c${s.pad!.choke}` : ''}</span>
          <span data-stale={s.routine?.state === 'stale-proof' || undefined}>{s.routine ? schedule(s) ?? NONE : 'none'}{s.routine?.state === 'stale-proof' ? ' · proof stale' : ''}</span>
          <span>{s.next ?? (s.routine ? NONE : '')}</span>
          <span className="pp-last"><i />{lastWord(s) ?? NONE}</span>
        </button>
      </li>)}
    </ol>
  </div>
}

// ---------------------------------------------------------------- the device

// The sample material of the gallery: one project's morning bank. The views never read these constants.
const PROJECTS = JSON.stringify([{id: 'project:o-i', name: 'O-I'}, {id: 'project:central', name: 'Central'}, {id: 'project:factory', name: 'Factory'}])
const SESSIONS = JSON.stringify([{id: 'lead', name: 'lead · O-I widgets'}, {id: 'tests', name: 'tests · widget suite'}, {id: 'docs', name: 'docs · manual'}])
const AGENTS = JSON.stringify([{id: 'flint', name: 'Flint'}, {id: 'kite', name: 'Kite'}, {id: 'cairn', name: 'Cairn'}])
const SCOPES = JSON.stringify([{id: 'scope:read', name: 'Read the project'}, {id: 'scope:tests', name: 'Tests may write'}])
const SEATS = JSON.stringify([{id: 'env-1/o-i', name: 'env-1 · O-I'}, {id: 'env-2/o-i', name: 'env-2 · O-I'}, {id: 'env-3/o-i', name: 'env-3 · O-I'}])
type Row = {index: number; pad: Record<string, unknown> | null; next?: string; running?: boolean; last?: Record<string, unknown>; routine?: Record<string, unknown>}
const BANK = (over: Partial<Record<number, Partial<Row>>> = {}): string => JSON.stringify(([
  {index: 0, pad: {name: 'Run the checks', prompt: 'Run the three type-checks and the widget tests; report what fails, with the file.', session: 'tests', agent: 'kite', choke: 1},
    next: 'Thu 08:00', nextIn: 1080, last: {end: 'done', at: 'Wed 08:00'}, routine: {state: 'enabled', unattended: true, when: 'weekdays 08:00'}},
  {index: 1, pad: {name: 'Review the branch', prompt: 'Review the branch against main: what changed, what it risks, what it lacks.', session: 'new', agent: 'cairn', choke: 0},
    last: {end: 'done', at: 'Tue 16:40'}},
  {index: 2, pad: {name: 'Write up the week', prompt: 'Write up the week from the Ledger and the Day\'s faces: what landed, what stays open.', session: 'docs', agent: 'cairn', choke: 0},
    next: 'Fri 17:00', nextIn: 3060, last: {end: 'stopped', at: 'Fri 17:06'}, routine: {state: 'enabled', unattended: true, when: 'Fridays 17:00'}},
  {index: 3, pad: {name: 'Land the docs', prompt: 'Land the manual on main once its sweep is clean.', session: 'docs', agent: 'flint', choke: 1}, last: {end: 'refused', at: 'Mon 11:12', reason: 'Scope does not let the agent write main.'}},
  {index: 4, pad: {name: 'Refresh fixtures', prompt: 'Regenerate the hand-off fixtures and keep the old ids.', session: 'lead', agent: 'kite', choke: 2},
    next: '14:00', nextIn: 120, running: true, last: {end: 'done', at: '08:00'}, routine: {state: 'enabled', unattended: true, when: 'every 6 h'}},
  {index: 5, pad: {name: 'Sweep the manual', prompt: 'Render the manual and sweep every embed for page errors.', session: 'docs', agent: 'flint', choke: 2}, last: {end: 'stalled', at: 'Wed 10:20', reason: 'gen-fixtures waits for an answer: overwrite (y/N)'}},
  {index: 8, pad: {name: 'Morning NOWs', prompt: 'Read the day\'s NOWs and propose the three that matter.', session: 'new', agent: 'cairn', choke: 0},
    next: 'Thu 07:30', nextIn: 1050, routine: {state: 'stale-proof', unattended: true, when: 'weekdays 07:30'}},
] as Row[]).map(row => ({...row, ...(over[row.index] ?? {})})))
const SELECTED = {pad: 0, name: 'Run the checks', prompt: 'Run the three type-checks and the widget tests; report what fails, with the file.', session: 'tests', agent: 'kite', scope: 'scope:tests', seat: 'env-2/o-i',
  choke: 1}

export const design: DesignedDevice = {
  id: 'software-factory:prompt-pads',
  title: 'Prompt pads',
  kind: 'instrument',
  defaults: {
    light: 'lit', project: 'project:o-i', revision: 'blake3:9f2c41d07a', ...SELECTED,
    pads: BANK(), projects: PROJECTS, sessions: SESSIONS, agents: AGENTS, scopes: SCOPES, seats: SEATS,
  },
  fixtures: {
    'A morning bank': {},
    'A pad stalled': {pad: 5, name: 'Sweep the manual', prompt: 'Render the manual and sweep every embed for page errors.', session: 'docs', agent: 'flint', scope: 'session', seat: 'session', choke: 2},
    'Proof gone stale': {pad: 8, name: 'Morning NOWs', prompt: 'Read the day\'s NOWs and propose the three that matter.', session: 'new', agent: 'cairn', scope: 'scope:read', seat: 'session', choke: 0},
    'An empty pad': {pad: 15, name: undefined, prompt: undefined, session: undefined, agent: undefined, scope: undefined, seat: undefined, choke: undefined},
    'No readings': Object.fromEntries(['light', 'project', 'revision', 'pad', 'name', 'prompt', 'session', 'agent', 'scope', 'seat', 'choke',
      'pads', 'projects', 'sessions', 'agents', 'scopes', 'seats'].map(k => [k, undefined])),
  },

  folded: p => { const r = read(p.v), n = scheduled(r); return <Folded title="Prompt pads" light={light(p)} readings={[projectName(p.v) ?? NONE, n === undefined ? NONE : `${n} timed`]} onUnfold={p.nav.unfold} /> },

  compact: p => {
    const r = read(p.v)
    return <Panel title="Prompt pads" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><PadGrid p={p} r={r} w={140} h={146} live names="short" /></Section>
      <Section label="Macros" cols={2} width={124}>
        {pressAction(p, r)}
        {chokeBox(p, r)}
        <div style={{gridColumn: 'span 2', width: '100%'}}>{sessionChooser(p, r)}</div>
        <div style={{gridColumn: 'span 2', width: '100%'}}>{agentChooser(p, r)}</div>
      </Section>
    </Panel>
  },

  whole: p => {
    const r = read(p.v), me = r.me, stale = me?.routine?.state === 'stale-proof'
    // Expanded, the two bands stand side by side: the pads grow into what the four other sections leave, as a Drum Rack's pads do.
    const w = grown(p, 220, 180 + 140 + 150 + 150 + 5 * 12 + 40, 400)
    return <Panel title="Prompt pads" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><PadGrid p={p} r={r} w={w} h={146} live names="full" /></Section>
        <Section label="Pad" width={180}>
          <TextField {...gate(p, r, 'name')} label="Name" does={SAYS.name} wide value={strOf(p.v, 'name') ?? ''} placeholder={NONE} onChange={x => p.set('name', x)} />
          <TextField {...st(p, 'prompt')} label="Prompt" does={SAYS.prompt} wide value={strOf(p.v, 'prompt') ?? ''} placeholder="What the task asks" onChange={x => p.set('prompt', x)} />
          {sessionChooser(p, r)}
        </Section>
        <Section label="Works" width={140}>
          {agentChooser(p, r)}
          {scopeChooser(p, r)}
          {seatChooser(p, r)}
        </Section>
      </Band>
      <Band>
        <Section label="Alone" cols={2} width={150}>
          <Readout label="routine" does="The AIKit routine that runs the pad by itself: draft, enabled, disabled, or its proof gone stale." value={me?.pad ? (me.routine ? (me.routine.state ? ROUTINE_WORD[me.routine.state] ?? me.routine.state : undefined) : 'none') : undefined} tone={stale ? 'stall' : me?.routine?.state === 'enabled' ? 'green' : undefined} />
          <Readout label="unattended" does="Whether you granted the routine the right to run with nobody there." value={me?.routine?.unattended === undefined ? undefined : me.routine.unattended ? 'granted' : 'not granted'} />
          <Readout label="next" does="When the pad next runs by itself, as its routine has it." value={me?.next ?? (me?.pad && !me.routine ? 'none' : undefined)} />
          {makeRoutineAction(p, r)}
        </Section>
        <Section label="Play" cols={2} grow>
          {pressAction(p, r)}
          {chokeBox(p, r)}
          <Readout label="last run" does="How the pad's last run ended: done, stalled, stopped or refused, and when." value={lastWord(me)} tone={me?.last?.end ? END_TONE[me.last.end] : undefined} />
          {clearAction(p, r)}
        </Section>
      </Band>
    </Panel>
  },

  full: p => <PadsPane p={p} />,

  widget: p => {
    const r = read(p.v)
    const timed = (r.slots ?? []).filter(timedSlot).sort((a, b) => (a.nextIn ?? Infinity) - (b.nextIn ?? Infinity))
    const items: RowItem[] = timed.map(s => ({id: String(s.index), name: `${s.index + 1} ${s.pad!.name}`, light: s.running ? 'lit' : s.last?.end === 'done' ? 'lit' : s.last?.end ? 'dark' : 'unknown',
      tone: s.running ? 'accent' : s.last?.end ? (END_TONE[s.last.end] === 'green' ? 'green' : s.last.end === 'stalled' ? 'stall' : undefined) : undefined, busy: s.running,
      note: s.next ?? schedule(s), why: s.routine?.state === 'stale-proof' ? 'Its routine needs its Method proved again before it runs alone.' : undefined,
      does: `A routine runs it${schedule(s) ? ` ${schedule(s)}` : ''}. ${s.running ? 'Its task runs now.' : s.last?.end ? `Last run ${END_WORD[s.last.end]}.` : 'It has not run yet.'}`}))
    return <Tile title={`Prompt pads · ${projectName(p.v) ?? NONE}`} light={light(p)} lightWhy={LIGHT_WHY} busy={(running(r) ?? 0) > 0} span={2} onFull={p.nav.full}>
      <div className="pp-tile-list">
        {r.slots === undefined ? <p className="pp-none">No reading of the pads.</p>
          : items.length === 0 ? <p className="pp-none">No pad runs by itself.</p>
            : <Rows label="Next to run" does="The pads that run by themselves, in the order they next run." items={items} size={5}
              selected={has(p.v, 'pad') ? String(numOf(p.v, 'pad')) : undefined} onSelect={st(p, 'pad').disabled ? undefined : id => p.set('pad', Number(id))} />}
      </div>
      <div className="pp-tile-side">
        <Readout big label="timed" does="Pads that run by themselves." value={scheduled(r)} />
        <Readout big label="running" does="Pads whose task runs now." value={running(r)} tone="accent" />
      </div>
    </Tile>
  },
}
