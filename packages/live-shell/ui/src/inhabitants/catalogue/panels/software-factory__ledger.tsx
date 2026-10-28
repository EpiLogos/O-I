// The Ledger (manual §19.13, software-factory:ledger): the record of what an agent session did and what came of it. Live's nearest: an
// Audio Effect Rack's chain list, a list whose rows each carry a reading. A monitor (manual §16.3): it stands on the rail and in a
// pane, and has two views. The tile is the last receipts, each line a task and its outcome, beside the receipts shown, those waiting and
// the turns; a line pressed there opens its receipt in Full. Full's head carries the receipts shown, those made today, those waiting,
// the turns, the tokens and the spend, with Period, Order, Outcome, Agent and Open log; its body is the list of tasks with the receipt
// open beside it.
//
// Where the owner stands.
// - A receipt is a Central source change: ctrl/src/source_horizon.rs:118 SourceChange (change_ref, source_path, kind added | modified |
//   removed, before_revision, after_revision, observed_at, actor, actor_kind, agent_session_ref), read by `projectcentral.change.horizon`.
// - An outcome is the state of the write. A direct write is Landed. A proposal that waits is Waiting (source_return.rs:246 status
//   pending); one a person accepted is Approved (source_return.rs:598, with accepted_by_ref); one a person rejected is Refused
//   (source_return.rs:411). Commented has no owner operation yet: Approvals' "Changes" needs a comment on a return.
// - The task is the shell's task clip (agent/agentRunModel.ts:22 TaskClip, read by owners/readers.ts:42 `encounter_task_read`).
// - Turns and tokens come from the same task record where it discloses them (agent/useAgentMetrics.ts:10-32). Spend has no writer:
//   agentParamAddresses.ts:75 says spend_ledger has none in O-I, so the Ledger draws "—" for it until one exists.
//
// Value keys. The shell holds:  period (run · today · all), agent (all, or one agent's name), outcome (all · landed · waiting ·
//   approved · commented · refused), order (newest · agent · task), task (the receipt you read). Each action sets its own key: openLog.
// The owner reports:  light (lit · dark), today (the civil day, YYYY-MM-DD), run (the run the track holds), used, cap (turns),
//   tokensIn, tokensOut, spend (USD), and receipts, JSON: rows of {ref, n?, name, agent, outcome, run, day, time, by, files}. A file is
//   {path, kind, from, to}. A receipt is keyed by its ref: a change's change_ref, a return's return_ref; `task` and Open log carry it. `n`
//   is the owner's own number where it gives one (the change horizon's cursor); a return has none and draws none. A row with no ref is no
//   receipt. A reading the owner does not have is left out of the row. A key it has not reported arrives absent, and the views draw "—"
//   and name the missing reading.
// - A receipt's `cond` is the condition the agent worked under, as Factory retains it with the run: {method, revision, body, context}.
//   method and revision are the Method-classified Skill the work ran under; body is the body conditions that carried it, each a short
//   name; context is the context it resolved in (factory/src/journey_praxis.rs:55 JourneyPraxisReturn method_ref, method_revision,
//   body_condition_refs, context_resolution_ref; the run's PraxisCondition, project_development.rs:118, adds model_ref and harness_ref).
//   `factory development field operative` records the operative refs (development_field.rs:99 praxisConditionRef); no CLI route and no
//   kernel op reads the condition back, so it arrives absent and the receipt's line draws "—".
import {Action, Chooser, Radio, Readout, Rows, Tile, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, json, numOf, railAndPane, st, strOf, type ViewProps} from './design'
import {MonitorHead, MonitorPane} from './monitor'
import './software-factory__ledger.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

const OUTCOMES = ['landed', 'waiting', 'approved', 'commented', 'refused'] as const
type Outcome = (typeof OUTCOMES)[number]
const KINDS = ['added', 'modified', 'removed'] as const
type Kind = (typeof KINDS)[number]
const WORD: Readonly<Record<Outcome, string>> = {landed: 'Landed', waiting: 'Waiting', approved: 'Approved', commented: 'Commented', refused: 'Refused'}
const SAYS_OUTCOME: Readonly<Record<Outcome, string>> = {
  landed: 'The agent wrote it directly, with a receipt.', waiting: 'The proposal waits for your answer.', approved: 'You accepted the proposal.',
  commented: 'A reviewer asked for a different result.', refused: 'You rejected the proposal.',
}
const TONE: Readonly<Record<Outcome, Tone>> = {landed: 'accent', waiting: 'stall', approved: 'green', commented: 'value', refused: 'accent'}
const KIND_WORD: Readonly<Record<Kind, string>> = {added: 'new', modified: 'edit', removed: 'gone'}
const KIND_MARK: Readonly<Record<Kind, string>> = {added: '+', modified: '~', removed: '−'}

const PERIODS: readonly Option<string>[] = [
  {value: 'run', label: 'This run', does: 'Receipts of the run that the track holds now.'},
  {value: 'today', label: 'Today', does: 'Receipts made on the Day.'},
  {value: 'all', label: 'All', does: 'Every receipt.'},
]
const ORDERS: readonly Option<string>[] = [
  {value: 'newest', label: 'Newest', does: 'The newest receipt first.'},
  {value: 'agent', label: 'Agent', does: 'Receipts grouped under the agent that made them.'},
  {value: 'task', label: 'Task', does: 'Receipts by their number, where the owner gives one; the proposals, which carry none, after them.'},
]
const OUTCOME_OPTIONS: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'Receipts with any outcome.'},
  ...OUTCOMES.map(o => ({value: o, label: WORD[o], does: SAYS_OUTCOME[o]})),
]

const SAYS = {
  period: 'The span of the list: this run, the Day, or all receipts.',
  agent: 'Shows the receipts of all agents, or of one agent.',
  outcome: 'Shows the receipts with one outcome.',
  order: 'The order of the list: newest first, grouped by agent, or by task number.',
  task: 'The receipt you read. Press a line of the list to choose it.',
  log: 'Open the log of the selected task in Clip view.',
}

// ---------------------------------------------------------------- the owner's rows, read safely

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const finite = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const objects = (raw: unknown): Record<string, unknown>[] => (Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [])

interface File {readonly path: string; readonly kind?: Kind; readonly from?: string; readonly to?: string}
/** The condition the agent worked under: the Method and its revision, the body conditions, the context it resolved in. */
interface Cond {readonly method?: string; readonly revision?: string; readonly body?: readonly string[]; readonly context?: string}
interface Receipt {
  /** The owner's ref for the receipt: the key the list, `task` and Open log go by. */
  readonly ref: string
  /** The owner's own number, where it gives one (the change horizon's cursor); a return carries none. */
  readonly n?: number
  readonly name?: string
  readonly agent?: string
  readonly outcome?: Outcome
  readonly run?: string
  readonly day?: string
  readonly time?: string
  /** Who accepted it, where a person did. */
  readonly by?: string
  /** The files the task changed; undefined when the owner does not say. */
  readonly files?: readonly File[]
  /** How the agent worked: undefined when the owner does not say. */
  readonly cond?: Cond
}

/** The receipts the owner reports; undefined when it reports none (not the same as an empty list). */
function receiptsOf(v: V): Receipt[] | undefined {
  const raw = json<unknown>(v, 'receipts', undefined)
  if (!Array.isArray(raw)) return undefined
  const list: Receipt[] = []
  for (const o of objects(raw)) {
    const ref = word(o.ref)
    if (ref === undefined) continue
    const files = Array.isArray(o.files) ? objects(o.files).flatMap((f): File[] => { const path = word(f.path); return path ? [{path, kind: KINDS.find(k => k === f.kind), from: word(f.from), to: word(f.to)}] : [] }) : undefined
    const c = o.cond && typeof o.cond === 'object' && !Array.isArray(o.cond) ? o.cond as Record<string, unknown> : undefined
    const cond = c ? {method: word(c.method), revision: word(c.revision), body: Array.isArray(c.body) ? c.body.filter((b): b is string => typeof b === 'string' && b.length > 0) : undefined, context: word(c.context)} : undefined
    list.push({ref, n: finite(o.n), name: word(o.name), agent: word(o.agent), outcome: OUTCOMES.find(x => x === o.outcome), run: word(o.run), day: word(o.day), time: word(o.time), by: word(o.by), files, cond})
  }
  return list
}

const stamp = (r: Receipt) => `${r.day ?? ''} ${r.time ?? ''}`
/** The owner's number for ordering: a receipt with none after every one that has one. */
const numbered = (a: Receipt, b: Receipt) => (a.n === undefined ? (b.n === undefined ? 0 : 1) : b.n === undefined ? -1 : a.n - b.n)
const byRef = (a: Receipt, b: Receipt) => a.ref.localeCompare(b.ref)
const newest = (a: Receipt, b: Receipt) => (stamp(a) < stamp(b) ? 1 : stamp(a) > stamp(b) ? -1 : -numbered(a, b) || byRef(a, b))
/** A receipt's number as drawn: `#n` where the owner gives one, else nothing. */
const numberOf = (r: Receipt) => (r.n === undefined ? undefined : `#${r.n}`)
/** A receipt as one line: its number where it has one, and its name. */
const titleOf = (r: Receipt) => [numberOf(r), r.name ?? NONE].filter(Boolean).join(' ')

interface Shown {
  readonly all: readonly Receipt[]
  /** The receipts the filters let through, in the chosen order. */
  readonly rows: readonly Receipt[]
  /** A filter that could not apply, because its basis is not read. */
  readonly gap?: string
}

function shownOf(v: V): Shown | undefined {
  const all = receiptsOf(v)
  if (!all) return undefined
  const period = strOf(v, 'period'), today = strOf(v, 'today'), run = strOf(v, 'run'), agent = strOf(v, 'agent'), outcome = strOf(v, 'outcome'), order = strOf(v, 'order')
  const gap = period === 'today' && today === undefined ? 'No reading of the date' : period === 'run' && run === undefined ? 'No reading of the run' : undefined
  const kept = all.filter(r => (period === 'today' && today !== undefined ? r.day === today : period === 'run' && run !== undefined ? r.run === run : true)
    && (agent === undefined || agent === 'all' || r.agent === agent) && (outcome === undefined || outcome === 'all' || r.outcome === outcome))
  const rows = order === 'task' ? [...kept].sort((a, b) => numbered(a, b) || byRef(a, b))
    : order === 'agent' ? [...kept].sort((a, b) => (a.agent ?? '￿').localeCompare(b.agent ?? '￿') || newest(a, b))
      : [...kept].sort(newest)
  return {all, rows, gap}
}

/** The receipt you read, from all the receipts (a filter may hide it from the list, not from the receipt). */
const currentOf = (v: V): Receipt | undefined => { const ref = strOf(v, 'task'); return ref === undefined ? undefined : receiptsOf(v)?.find(r => r.ref === ref) }
const countOf = (s: Shown | undefined, o: Outcome): number | undefined => (s ? s.all.filter(r => r.outcome === o).length : undefined)
const agentsOf = (v: V): string[] => [...new Set((receiptsOf(v) ?? []).flatMap(r => (r.agent ? [r.agent] : [])))].sort()

// ---------------------------------------------------------------- the session's spend, absent where the owner does not disclose it

const usedOf = (v: V) => { const n = numOf(v, 'used'); return n === undefined || n < 0 ? undefined : n }
const turnsLine = (v: V): string | undefined => { const u = usedOf(v), c = numOf(v, 'cap'); return u === undefined ? undefined : c === undefined ? `${u}` : `${u}/${c}` }
const fmtTokens = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 0 : 1)}k` : `${Math.round(x)}`)
const tokensOf = (v: V, key: string): string | undefined => { const n = numOf(v, key); return n === undefined ? undefined : fmtTokens(n) }
const spendLine = (v: V): string | undefined => { const n = numOf(v, 'spend'); return n === undefined ? undefined : `$${n.toFixed(2)}` }
const SPEND_DOES = 'What the session cost, in dollars. No owner writes spend yet, so it stays empty.'

/** The light the owner reports; hollow when it reports none. */
const light = (p: ViewProps): LightState => { const x = strOf(p.owner ?? p.v, 'light'); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const LIGHT_WHY = 'The Ledger only reads. Nothing turns it on or off.'

// ---------------------------------------------------------------- the controls shared by the views

const periodRadio = (p: ViewProps) => <Radio {...st(p, 'period')} label="Period" does={SAYS.period} value={strOf(p.v, 'period') ?? ''} options={PERIODS} onChange={x => p.set('period', x)} />
const orderRadio = (p: ViewProps) => <Radio {...st(p, 'order')} label="Order" does={SAYS.order} value={strOf(p.v, 'order') ?? ''} options={ORDERS} onChange={x => p.set('order', x)} />
const outcomeChooser = (p: ViewProps) => <Chooser {...st(p, 'outcome')} label="Outcome" does={SAYS.outcome} value={strOf(p.v, 'outcome') ?? ''} options={OUTCOME_OPTIONS} onChange={x => p.set('outcome', x)} />
const agentChooser = (p: ViewProps) => <Chooser {...st(p, 'agent')} label="Agent" does={SAYS.agent} value={strOf(p.v, 'agent') ?? ''}
  options={[{value: 'all', label: 'All'}, ...agentsOf(p.v).map(a => ({value: a, label: a}))]} onChange={x => p.set('agent', x)} />

// ---------------------------------------------------------------- readings of the receipt you read

const outcomeWord = (r?: Receipt) => (r?.outcome ? WORD[r.outcome] : undefined)
/** The condition as one line: the Method at its revision, the body, the context. Undefined when the owner reports none of it. */
const condLine = (c?: Cond): string | undefined => {
  if (!c) return undefined
  const parts = [c.method ? `${c.method}${c.revision ? ` r${c.revision}` : ''}` : undefined, c.body?.length ? c.body.join(', ') : undefined, c.context].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}
const COND_DOES = 'The Method the agent worked under, at its revision; the body it worked in; the context it resolved in. Factory keeps it with the run.'

function Receipts({p, size, label}: {p: ViewProps; size: number; label?: string}) {
  const s = shownOf(p.v)
  const items: RowItem[] = (s?.rows ?? []).map(r => ({id: r.ref, name: titleOf(r), light: r.outcome === undefined ? 'unknown' : r.outcome === 'refused' ? 'dark' : 'lit',
    tone: r.outcome ? TONE[r.outcome] : 'accent', note: r.outcome ? r.outcome : undefined, why: r.outcome === 'waiting' ? 'Waits for your answer.' : undefined,
    does: `${r.agent ?? 'The owner does not name the agent'}. Press to read the receipt.`}))
  return s
    ? <Rows label={label} does="The last receipts. The tick is the outcome. Press a line to read its receipt." items={items} size={size}
        selected={strOf(p.v, 'task')} onSelect={id => { p.set('task', id); p.nav.full?.() }} />
    : <p className="sfl-none">No reading of the receipts.</p>
}

// ---------------------------------------------------------------- the pane: the list, and the receipt open beside it

/** Full's head: the receipts shown, those made today and those waiting, the session's spend; every setting, and Open log for the receipt
 * you read. */
function Head({p}: {p: ViewProps}) {
  const s = shownOf(p.v), r = currentOf(p.v), today = strOf(p.v, 'today')
  return <MonitorHead title="Ledger" readings={[
    {label: 'shown', value: s ? `${s.rows.length} of ${s.all.length}` : undefined, does: 'The receipts that the filter lets through, of all the receipts.'},
    {label: 'today', value: s && today !== undefined ? s.all.filter(x => x.day === today).length : undefined, does: 'Receipts made on the Day, whatever the filter.'},
    {label: 'waiting', value: countOf(s, 'waiting'), does: 'Proposals that wait for your answer.', tone: 'stall'},
    {label: 'turns', value: turnsLine(p.v), does: 'The turns the session has used, of the turns it may use.'},
    {label: 'read', value: tokensOf(p.v, 'tokensIn'), does: 'Tokens the session read, where the task record discloses them.'},
    {label: 'wrote', value: tokensOf(p.v, 'tokensOut'), does: 'Tokens the session wrote, where the task record discloses them.'},
    {label: 'spend', value: spendLine(p.v), does: SPEND_DOES},
  ]} controls={<>
    {periodRadio(p)}
    {orderRadio(p)}
    {outcomeChooser(p)}
    {agentChooser(p)}
    <Action {...st(p, 'openLog')} label="Open log" does={r ? `${SAYS.log} ${titleOf(r)}.` : SAYS.log} onPress={r ? () => p.set('openLog', r.ref) : undefined} />
  </>} />
}

/** The body: the list of tasks, and the receipt you read open beside it. */
function Pane({p}: {p: ViewProps}) {
  const s = shownOf(p.v), r = currentOf(p.v)
  return <div className="sfl-main">
      <section className="sfl-list" aria-label="Receipts">
        <div className="sfl-cols"><span /><span>task</span><span>name</span><span>agent</span><span>when</span><span>files</span></div>
        {!s && <p className="sfl-none">No reading of the receipts.</p>}
        {s && s.rows.length === 0 && <p className="sfl-none">No receipt matches.{s.gap ? ` ${s.gap}.` : ''}</p>}
        <ol>
          {(s?.rows ?? []).map(x => <li key={x.ref}>
            <button type="button" className="sfl-line" aria-pressed={x.ref === r?.ref} onClick={() => p.set('task', x.ref)} data-outcome={x.outcome}
              data-i={`${titleOf(x)}|${x.outcome ? `${WORD[x.outcome]}. ${SAYS_OUTCOME[x.outcome]}` : 'The owner does not say how it ended.'}`}>
              <i /><span>{numberOf(x) ?? NONE}</span><b>{x.name ?? NONE}</b><span>{x.agent ?? NONE}</span><span>{x.day && x.time ? `${x.day.slice(5)} ${x.time}` : NONE}</span><span>{x.files ? x.files.length : NONE}</span>
            </button>
          </li>)}
        </ol>
      </section>
      <aside className="sfl-receipt" aria-label="Receipt">
        {!r && <p className="sfl-none">{s ? 'Press a receipt to read it.' : 'No reading of the receipts.'}</p>}
        {r && <>
          <h3>{numberOf(r) ? `${numberOf(r)} ` : ''}<b>{r.name ?? NONE}</b></h3>
          <dl>
            <dt>Ref</dt><dd className="sfl-ref">{r.ref}</dd>
            <dt>Outcome</dt><dd data-outcome={r.outcome}>{outcomeWord(r) ?? NONE}</dd>
            <dt>Agent</dt><dd>{r.agent ?? NONE}</dd>
            <dt>Accepted by</dt><dd>{r.by ?? NONE}</dd>
            <dt>When</dt><dd>{r.day && r.time ? `${r.day} ${r.time}` : NONE}</dd>
            <dt>Run</dt><dd>{r.run ?? NONE}</dd>
            <dt>Worked under</dt><dd className="sfl-cond" data-i={`Worked under|${COND_DOES}`}>{condLine(r.cond) ?? NONE}</dd>
          </dl>
          {r.outcome && <p className="sfl-says">{SAYS_OUTCOME[r.outcome]}</p>}
          <h4>Files changed{r.files ? ` · ${r.files.length}` : ''}</h4>
          {r.files === undefined && <p className="sfl-none">No reading of the files.</p>}
          {r.files?.length === 0 && <p className="sfl-none">The task changed no file.</p>}
          <ol className="sfl-files">
            {(r.files ?? []).map(f => <li key={f.path} data-kind={f.kind}>
              <i>{f.kind ? KIND_MARK[f.kind] : '?'}</i><code>{f.path}</code><small>{f.kind ? `${KIND_WORD[f.kind]} · ` : ''}{f.from ?? NONE} → {f.to ?? NONE}</small>
            </li>)}
          </ol>
        </>}
      </aside>
    </div>
}

// ---------------------------------------------------------------- the gallery's readings (the owner's names and shapes, as the binding supplies them)

// The landed receipts are the change horizon's (a change_ref and its cursor); the others are source returns (a return_ref, no number).
const SAMPLE_RECEIPTS = [
  {ref: 'central:return:project:o-i:1792144080000000000-4242', name: 'drop old captures', agent: 'Kite', outcome: 'waiting', run: 'run:2', day: '2026-10-16', time: '10:48',
    cond: {method: 'capture-pass', revision: '3', body: ['Haiku 4.5', 'env-2'], context: '9 sources'},
    files: [{path: 'Work/O-I/docs/dlw/DLW.md', kind: 'modified', from: 'b3:51d0aa', to: 'b3:7c2e19'}]},
  {ref: 'central:return:project:o-i:1792141500000000000-4242', name: 'map field → plan', agent: 'Flint', outcome: 'approved', by: 'You', run: 'run:2', day: '2026-10-16', time: '10:05',
    cond: {method: 'port-plan', revision: '7', body: ['Sonnet 4.6', 'env-1'], context: '14 sources'},
    files: [{path: 'packages/live-shell/ui/src/inhabitants/agentParamAddresses.ts', kind: 'modified', from: 'b3:2a90e4', to: 'b3:d18b36'}, {path: 'portPlan.ts', kind: 'added', to: 'b3:9f2c41'}]},
  {ref: 'central:change:project:O-I:212', n: 212, name: 're-plan port', agent: 'Flint', outcome: 'landed', run: 'run:2', day: '2026-10-16', time: '09:12',
    cond: {method: 'port-plan', revision: '7', body: ['Sonnet 4.6', 'env-1'], context: '11 sources'},
    files: [{path: 'portPlan.ts', kind: 'modified', from: 'b3:9f2c41', to: 'b3:41ae07'}]},
  {ref: 'central:return:project:o-i:1792135800000000000-4180', name: 'survey the widget tree', agent: 'Cairn', outcome: 'refused', run: 'run:2', day: '2026-10-16', time: '08:30',
    files: [{path: 'Control/user/flows/flow-2026-10-03-1432.md', kind: 'modified', from: 'b3:6e07f3', to: 'b3:c4a5d2'}]},
  {ref: 'central:return:project:o-i:1792083120000000000-3977', name: 'review #482 notes', agent: 'Cairn', outcome: 'commented', run: 'run:1', day: '2026-10-15', time: '17:52',
    files: [{path: 'Work/O-I/docs/dlw/DLW.md §16', kind: 'modified', from: 'b3:08bb91', to: 'b3:e3f764'}]},
  {ref: 'central:change:project:O-I:205', n: 205, name: 'generate fixtures', agent: 'Kite', outcome: 'landed', run: 'run:1', day: '2026-10-15', time: '16:10',
    files: [{path: 'fixtures/handoff.json', kind: 'added', to: 'b3:77d3a0'}, {path: 'fixtures/old-handoff.json', kind: 'removed', from: 'b3:31c8e5'}]},
]

export const design = railAndPane({
  id: 'software-factory:ledger',
  title: 'Ledger',
  kind: 'monitor',
  defaults: {
    light: 'lit', period: 'today', agent: 'all', outcome: 'all', order: 'newest', task: 'central:change:project:O-I:212', today: '2026-10-16', run: 'run:2',
    used: 5, cap: 12, tokensIn: 128400, tokensOut: 21300, receipts: JSON.stringify(SAMPLE_RECEIPTS),
  },
  fixtures: {
    'Today, on the lead session': {},
    'Waiting for you': {task: 'central:return:project:o-i:1792144080000000000-4242', outcome: 'waiting'},
    'No readings': {light: undefined, period: undefined, agent: undefined, outcome: undefined, order: undefined, task: undefined, today: undefined, run: undefined,
      used: undefined, cap: undefined, tokensIn: undefined, tokensOut: undefined, spend: undefined, receipts: undefined},
  },

  full: p => <MonitorPane label="Ledger" head={<Head p={p} />}><Pane p={p} /></MonitorPane>,

  widget: p => {
    const s = shownOf(p.v)
    return <Tile title="Ledger" light={light(p)} lightWhy={LIGHT_WHY} span={2} onFull={p.nav.full}>
      <div className="sfl-tile-list"><Receipts p={p} size={5} /></div>
      <div className="sfl-tile-side">
        <Readout big label="receipts" does="The receipts that the filter lets through." value={s ? s.rows.length : undefined} />
        <Readout big label="waiting" does="Proposals that wait for your answer." value={countOf(s, 'waiting')} tone="stall" />
        <Readout big label="turns" does="The turns the session has used, of the turns it may use." value={turnsLine(p.v)} />
      </div>
    </Tile>
  },
})
