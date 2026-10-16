// The Ledger (manual §19.15 and §23.9, software-factory:ledger): the record of what an agent session did and what came of it. Live's
// nearest: an Audio Effect Rack's chain list, a list whose rows each carry a reading. The picture is the list itself: one line for
// each receipt, its outcome as a coloured tick, and the selected receipt marked. The Full view opens the receipt beside the list.
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
//   tokensIn, tokensOut, spend (USD), and receipts, JSON: rows of {n, name, agent, outcome, run, day, time, by, files}. A file is
//   {path, kind, from, to}. A reading the owner does not have is left out of the row. A key it has not reported arrives absent, and
//   the views draw "—" and name the missing reading.
import {type KeyboardEvent} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
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
const FILL: Readonly<Record<Outcome, string>> = {landed: 'var(--dp-on)', waiting: 'var(--stall)', approved: 'var(--green)', commented: 'var(--dp-value)', refused: 'var(--text-faint)'}
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
  {value: 'task', label: 'Task', does: 'Receipts in the order of the task numbers.'},
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
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const tail = (path: string) => path.split('/').filter(Boolean).pop() ?? path

interface File {readonly path: string; readonly kind?: Kind; readonly from?: string; readonly to?: string}
interface Receipt {
  readonly n: number
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
}

/** The receipts the owner reports; undefined when it reports none (not the same as an empty list). */
function receiptsOf(v: V): Receipt[] | undefined {
  const raw = json<unknown>(v, 'receipts', undefined)
  if (!Array.isArray(raw)) return undefined
  const list: Receipt[] = []
  for (const o of objects(raw)) {
    const n = finite(o.n)
    if (n === undefined) continue
    const files = Array.isArray(o.files) ? objects(o.files).flatMap((f): File[] => { const path = word(f.path); return path ? [{path, kind: KINDS.find(k => k === f.kind), from: word(f.from), to: word(f.to)}] : [] }) : undefined
    list.push({n, name: word(o.name), agent: word(o.agent), outcome: OUTCOMES.find(x => x === o.outcome), run: word(o.run), day: word(o.day), time: word(o.time), by: word(o.by), files})
  }
  return list
}

const stamp = (r: Receipt) => `${r.day ?? ''} ${r.time ?? ''}`
const newest = (a: Receipt, b: Receipt) => (stamp(a) < stamp(b) ? 1 : stamp(a) > stamp(b) ? -1 : b.n - a.n)

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
  const rows = order === 'task' ? [...kept].sort((a, b) => a.n - b.n)
    : order === 'agent' ? [...kept].sort((a, b) => (a.agent ?? '￿').localeCompare(b.agent ?? '￿') || newest(a, b))
      : [...kept].sort(newest)
  return {all, rows, gap}
}

/** The receipt you read, from all the receipts (a filter may hide it from the list, not from the receipt). */
const currentOf = (v: V): Receipt | undefined => { const n = numOf(v, 'task'); return n === undefined ? undefined : receiptsOf(v)?.find(r => r.n === n) }
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
const head = (p: ViewProps) => ({light: light(p), lightWhy: 'The Ledger only reads. Nothing turns it on or off.', onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the controls shared by the views

const periodRadio = (p: ViewProps) => <Radio {...st(p, 'period')} label="Period" does={SAYS.period} value={strOf(p.v, 'period') ?? ''} options={PERIODS} stack onChange={x => p.set('period', x)} />
const orderRadio = (p: ViewProps) => <Radio {...st(p, 'order')} label="Order" does={SAYS.order} value={strOf(p.v, 'order') ?? ''} options={ORDERS} stack onChange={x => p.set('order', x)} />
const outcomeChooser = (p: ViewProps, wide = false) => <Chooser {...st(p, 'outcome')} label="Outcome" does={SAYS.outcome} wide={wide} value={strOf(p.v, 'outcome') ?? ''} options={OUTCOME_OPTIONS} onChange={x => p.set('outcome', x)} />
const agentChooser = (p: ViewProps, wide = false) => <Chooser {...st(p, 'agent')} label="Agent" does={SAYS.agent} wide={wide} value={strOf(p.v, 'agent') ?? ''}
  options={[{value: 'all', label: 'All'}, ...agentsOf(p.v).map(a => ({value: a, label: a}))]} onChange={x => p.set('agent', x)} />

// ---------------------------------------------------------------- the picture: the receipts as a list

const TOP = 19, PITCH = 16, LEFT = 21

/** Pressing a line chooses its receipt; Enter and Space press it. */
const press = (act: () => void) => ({
  className: 'sfl-hit', role: 'button', tabIndex: 0, onClick: act,
  onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } },
})

/** The list in the well: one line for each receipt, newest first as the order says. The tick is the outcome. The line you read stands
 * on a band, and handle 1 sits on it: drag it up or down to read another receipt. The window moves only when you pass its end. */
function List({p, w, h, handle}: {p: ViewProps; w: number; h: number; handle: boolean}) {
  const s = shownOf(p.v), sel = numOf(p.v, 'task')
  if (!s) return <text x={w / 2} y={h / 2 + 3} textAnchor="middle" className="dp-ink-dim">No reading of the receipts</text>
  const vis = Math.floor((h - TOP - 12) / PITCH), rows = s.rows
  const at = sel === undefined ? -1 : rows.findIndex(r => r.n === sel)
  const first = at >= vis ? at - vis + 1 : 0, show = rows.slice(first, first + vis)
  const chars = Math.max(6, Math.floor((w - LEFT - 52) / 4.9))
  return <g>
    <text x={LEFT} y={11} className="dp-axis">task</text>
    {rows.length === 0 && <>
      <text x={w / 2} y={h / 2 - 2} textAnchor="middle" className="dp-ink-dim">No receipt matches</text>
      {s.gap && <text x={w / 2} y={h / 2 + 11} textAnchor="middle" className="dp-axis">{s.gap}</text>}
    </>}
    {show.map((r, i) => {
      const y = TOP + i * PITCH, on = r.n === sel, fill = r.outcome ? FILL[r.outcome] : undefined
      return <g key={r.n} {...press(() => p.set('task', r.n))}
        data-i={`#${r.n} ${r.name ?? ''}|${r.outcome ? WORD[r.outcome] : 'The owner does not say how it ended'}${r.agent ? ` · ${r.agent}` : ''}. Press to read its receipt.`}>
        <rect x={0} y={y} width={w} height={PITCH} style={{fill: on ? 'color-mix(in srgb, var(--sel) 16%, transparent)' : 'transparent'}} />
        {on && <rect x={0} y={y} width={2} height={PITCH} fill="var(--sel)" />}
        {fill ? <rect x={LEFT - 6} y={y + 3} width={3} height={PITCH - 6} fill={fill} />
          : <rect x={LEFT - 5.5} y={y + 3.5} width={2} height={PITCH - 7} className="dp-faint" strokeDasharray="1 2" />}
        <text x={LEFT} y={y + 11} className="dp-ink-dim">#{r.n}</text>
        <text x={LEFT + 25} y={y + 11} className="dp-ink">{r.name === undefined ? NONE : clip(r.name, chars)}</text>
        <text x={w - 6} y={y + 11} textAnchor="end" className="dp-ink-dim">{r.files ? r.files.length : NONE}</text>
      </g>
    })}
    {first > 0 && <text x={w - 6} y={h - 4} textAnchor="end" className="dp-axis">{first} above</text>}
    {rows.length - (first + vis) > 0 && <text x={LEFT} y={h - 4} className="dp-axis">{rows.length - (first + vis)} more</text>}
    {handle && at >= first && at < first + vis && <Handle n={1} shape="square" x={8} y={TOP + (at - first) * PITCH + PITCH / 2} label="Receipt" does={SAYS.task}
      onDrag={(_x, y) => { const k = clampTo(0, show.length - 1, Math.round((y - TOP - PITCH / 2) / PITCH)); const r = show[k]; if (r) p.set('task', r.n) }} />}
  </g>
}

const cornerOf = (v: V) => { const s = shownOf(v); return s ? `${s.rows.length} of ${s.all.length}` : NONE }

// ---------------------------------------------------------------- readings of the receipt you read

const outcomeWord = (r?: Receipt) => (r?.outcome ? WORD[r.outcome] : undefined)
const filesRows = (r?: Receipt): RowItem[] => (r?.files ?? []).map(f => ({id: f.path, name: tail(f.path), light: f.kind === undefined ? 'unknown' : f.kind === 'removed' ? 'dark' : 'lit',
  tone: f.kind === 'added' ? 'green' : 'accent', note: f.kind ? KIND_WORD[f.kind] : NONE, does: `${f.path}${f.from || f.to ? ` · ${f.from ?? NONE} → ${f.to ?? NONE}` : ''}`}))

function Receipts({p, size, label}: {p: ViewProps; size: number; label?: string}) {
  const s = shownOf(p.v)
  const items: RowItem[] = (s?.rows ?? []).map(r => ({id: String(r.n), name: `#${r.n} ${r.name ?? NONE}`, light: r.outcome === undefined ? 'unknown' : r.outcome === 'refused' ? 'dark' : 'lit',
    tone: r.outcome ? TONE[r.outcome] : 'accent', note: r.outcome ? r.outcome : undefined, why: r.outcome === 'waiting' ? 'Waits for your answer.' : undefined,
    does: `${r.agent ?? 'The owner does not name the agent'}. Press to read the receipt.`}))
  const sel = numOf(p.v, 'task')
  return s
    ? <Rows label={label} does="The last receipts. The tick is the outcome. Press a line to read its receipt." items={items} size={size}
        selected={sel === undefined ? undefined : String(sel)} onSelect={id => { p.set('task', Number(id)); p.nav.full?.() }} />
    : <p className="sfl-none">No reading of the receipts.</p>
}

// ---------------------------------------------------------------- the pane: the list, and the receipt open beside it

function Pane({p}: {p: ViewProps}) {
  const s = shownOf(p.v), r = currentOf(p.v)
  const period = PERIODS.find(o => o.value === strOf(p.v, 'period'))?.label
  return <div className="sfl-pane">
    <div className="sfl-bar">
      <b>Ledger</b>
      <span>{period ?? NONE}</span>
      <span>{s ? `${s.rows.length} of ${s.all.length} receipts` : NONE}</span>
      <span>turns {turnsLine(p.v) ?? NONE}</span>
      <span>tokens in {tokensOf(p.v, 'tokensIn') ?? NONE} · out {tokensOf(p.v, 'tokensOut') ?? NONE}</span>
      <span>spend {spendLine(p.v) ?? NONE}</span>
    </div>
    <div className="sfl-main">
      <section className="sfl-list" aria-label="Receipts">
        <div className="sfl-cols"><span /><span>task</span><span>name</span><span>agent</span><span>when</span><span>files</span></div>
        {!s && <p className="sfl-none">No reading of the receipts.</p>}
        {s && s.rows.length === 0 && <p className="sfl-none">No receipt matches.{s.gap ? ` ${s.gap}.` : ''}</p>}
        <ol>
          {(s?.rows ?? []).map(x => <li key={x.n}>
            <button type="button" className="sfl-line" aria-pressed={x.n === r?.n} onClick={() => p.set('task', x.n)} data-outcome={x.outcome}
              data-i={`#${x.n} ${x.name ?? ''}|${x.outcome ? `${WORD[x.outcome]}. ${SAYS_OUTCOME[x.outcome]}` : 'The owner does not say how it ended.'}`}>
              <i /><span>#{x.n}</span><b>{x.name ?? NONE}</b><span>{x.agent ?? NONE}</span><span>{x.day && x.time ? `${x.day.slice(5)} ${x.time}` : NONE}</span><span>{x.files ? x.files.length : NONE}</span>
            </button>
          </li>)}
        </ol>
      </section>
      <aside className="sfl-receipt" aria-label="Receipt">
        {!r && <p className="sfl-none">{s ? 'Press a receipt to read it.' : 'No reading of the receipts.'}</p>}
        {r && <>
          <h3>#{r.n} <b>{r.name ?? NONE}</b></h3>
          <dl>
            <dt>Outcome</dt><dd data-outcome={r.outcome}>{outcomeWord(r) ?? NONE}</dd>
            <dt>Agent</dt><dd>{r.agent ?? NONE}</dd>
            <dt>Accepted by</dt><dd>{r.by ?? NONE}</dd>
            <dt>When</dt><dd>{r.day && r.time ? `${r.day} ${r.time}` : NONE}</dd>
            <dt>Run</dt><dd>{r.run ?? NONE}</dd>
          </dl>
          {r.outcome && <p className="sfl-says">{SAYS_OUTCOME[r.outcome]}</p>}
          <h4>Files changed</h4>
          {r.files === undefined && <p className="sfl-none">No reading of the files.</p>}
          {r.files?.length === 0 && <p className="sfl-none">The task changed no file.</p>}
          <ol className="sfl-files">
            {(r.files ?? []).map(f => <li key={f.path} data-kind={f.kind}>
              <i>{f.kind ? KIND_MARK[f.kind] : '?'}</i><code>{f.path}</code><small>{f.from ?? NONE} → {f.to ?? NONE}</small>
            </li>)}
          </ol>
        </>}
      </aside>
    </div>
  </div>
}

// ---------------------------------------------------------------- the gallery's readings (the owner's names and shapes, as the binding supplies them)

const SAMPLE_RECEIPTS = [
  {n: 214, name: 'drop old captures', agent: 'Kite', outcome: 'waiting', run: 'run:2', day: '2026-10-16', time: '10:48',
    files: [{path: 'Work/O-I/docs/dlw/DLW.md', kind: 'modified', from: 'b3:51d0aa', to: 'b3:7c2e19'}]},
  {n: 213, name: 'map field → plan', agent: 'Flint', outcome: 'approved', by: 'You', run: 'run:2', day: '2026-10-16', time: '10:05',
    files: [{path: 'packages/live-shell/ui/src/inhabitants/agentParamAddresses.ts', kind: 'modified', from: 'b3:2a90e4', to: 'b3:d18b36'}, {path: 'portPlan.ts', kind: 'added', to: 'b3:9f2c41'}]},
  {n: 212, name: 're-plan port', agent: 'Flint', outcome: 'landed', run: 'run:2', day: '2026-10-16', time: '09:12',
    files: [{path: 'portPlan.ts', kind: 'modified', from: 'b3:9f2c41', to: 'b3:41ae07'}]},
  {n: 211, name: 'survey the widget tree', agent: 'Cairn', outcome: 'refused', run: 'run:2', day: '2026-10-16', time: '08:30',
    files: [{path: 'Control/user/flows/flow-2026-10-03-1432.md', kind: 'modified', from: 'b3:6e07f3', to: 'b3:c4a5d2'}]},
  {n: 209, name: 'review #482 notes', agent: 'Cairn', outcome: 'commented', run: 'run:1', day: '2026-10-15', time: '17:52',
    files: [{path: 'Work/O-I/docs/dlw/DEVICE-UI.md', kind: 'modified', from: 'b3:08bb91', to: 'b3:e3f764'}]},
  {n: 205, name: 'generate fixtures', agent: 'Kite', outcome: 'landed', run: 'run:1', day: '2026-10-15', time: '16:10',
    files: [{path: 'fixtures/handoff.json', kind: 'added', to: 'b3:77d3a0'}, {path: 'fixtures/old-handoff.json', kind: 'removed', from: 'b3:31c8e5'}]},
]

export const design: DesignedDevice = {
  id: 'software-factory:ledger',
  title: 'Ledger',
  kind: 'instrument',
  defaults: {
    light: 'lit', period: 'today', agent: 'all', outcome: 'all', order: 'newest', task: 212, today: '2026-10-16', run: 'run:2',
    used: 5, cap: 12, tokensIn: 128400, tokensOut: 21300, receipts: JSON.stringify(SAMPLE_RECEIPTS),
  },
  fixtures: {
    'Today, on the lead session': {},
    'Waiting for you': {task: 214, outcome: 'waiting'},
    'No readings': {light: undefined, period: undefined, agent: undefined, outcome: undefined, order: undefined, task: undefined, today: undefined, run: undefined,
      used: undefined, cap: undefined, tokensIn: undefined, tokensOut: undefined, spend: undefined, receipts: undefined},
  },

  folded: p => {
    const s = shownOf(p.v), today = strOf(p.v, 'today'), waiting = countOf(s, 'waiting')
    return <Folded title="Ledger" light={light(p)} onUnfold={p.nav.unfold}
      readings={[s && today !== undefined ? `${s.all.filter(r => r.day === today).length} today` : NONE, waiting === undefined ? NONE : `${waiting} wait`]} />
  },

  compact: p => <Panel title="Ledger" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Receipts" corner={cornerOf(p.v)}
        does="The receipts of the span, one line for each. The tick is the outcome. Press a line, or drag handle 1, to read another receipt.">
        <List p={p} w={140} h={146} handle />
      </Display>
    </Section>
    <Section label="Filter" cols={2}>
      {periodRadio(p)}
      {orderRadio(p)}
      {outcomeChooser(p)}
      {agentChooser(p)}
    </Section>
  </Panel>,

  whole: p => {
    const s = shownOf(p.v), r = currentOf(p.v)
    return <Panel title="Ledger" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="Receipts" corner={cornerOf(p.v)}
            does="The receipts of the span, one line for each. The tick is the outcome. Press a line, or drag handle 1, to read another receipt.">
            <List p={p} w={194} h={146} handle />
          </Display>
        </Section>
        <Section label="Filter" cols={3} grow>
          {periodRadio(p)}
          {orderRadio(p)}
          <Readout big label="shown" does="The receipts that the filter lets through, of all the receipts." value={s ? `${s.rows.length}/${s.all.length}` : undefined} />
          <div style={{gridColumn: 'span 3', width: '100%'}}>{outcomeChooser(p, true)}</div>
          <div style={{gridColumn: 'span 3', width: '100%'}}>{agentChooser(p, true)}</div>
        </Section>
      </Band>
      <Band>
        <Section label="Receipt" cols={3}>
          <Readout label="task" does="The number of the task that you read." value={r ? `#${r.n}` : undefined} />
          <Readout label="agent" does="The agent that made the receipt." value={r?.agent} />
          <Readout label="outcome" does="How the write ended." value={outcomeWord(r)} tone={r?.outcome ? TONE[r.outcome] : undefined} />
          <Readout label="files" does="The files that the task changed." value={r?.files ? r.files.length : undefined} />
          <Readout label="accepted" does="Who accepted it. A direct write has no one." value={r?.by} tone="green" />
          <Readout label="at" does="The time of the receipt, on the Day." value={r?.time} />
          <div style={{gridColumn: 'span 3', width: '100%'}}>
            <Action {...st(p, 'openLog')} label="Open log" does={SAYS.log} onPress={r ? () => p.set('openLog', r.n) : undefined} />
          </div>
        </Section>
        <Section label="Spent" cols={2}>
          <Readout label="turns" does="The turns the session has used, of the turns it may use." value={turnsLine(p.v)} />
          <Readout label="spend" does={SPEND_DOES} value={spendLine(p.v)} />
          <Readout label="read" does="Tokens the session read, where the task record discloses them." value={tokensOf(p.v, 'tokensIn')} />
          <Readout label="wrote" does="Tokens the session wrote, where the task record discloses them." value={tokensOf(p.v, 'tokensOut')} />
        </Section>
        <Section label="Files" grow>
          {r ? (r.files ? <Rows does="The files that the selected task changed. The note says how." items={filesRows(r)} size={6} />
            : <p className="sfl-none">No reading of the files.</p>) : <p className="sfl-none">{s ? 'No receipt chosen.' : 'No reading of the receipts.'}</p>}
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const s = shownOf(p.v)
    return <Tile title="Ledger" light={light(p)} span={2} onFull={p.nav.full}>
      <div className="sfl-tile-list"><Receipts p={p} size={5} /></div>
      <div className="sfl-tile-side">
        <Readout big label="receipts" does="The receipts that the filter lets through." value={s ? s.rows.length : undefined} />
        <Readout big label="waiting" does="Proposals that wait for your answer." value={countOf(s, 'waiting')} tone="stall" />
        <Readout big label="turns" does="The turns the session has used, of the turns it may use." value={turnsLine(p.v)} />
      </div>
    </Tile>
  },
}

