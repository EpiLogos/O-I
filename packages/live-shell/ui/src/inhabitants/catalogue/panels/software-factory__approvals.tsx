// Approvals (manual §19.14 and §19.14, software-factory:approvals): the agents' proposals and requests that wait for you, with the
// settings that decide how long they wait and what happens when nobody answers. Live's nearest: Utility with a small display, as
// Custody is. It shares the Gateway's `approvals` key (agentParamAddresses.ts: the Gateway writes it through harness_agent_control
// `configure`; Hermes calls it approvals.mode) and the Thread's proposal cards (software-factory__thread.tsx: Approve, Changes, Diff).
// Custody's Review gate decides that a change waits; this device decides how long and what then.
//
// The well draws the device's own law: time. One lane for each item, a bar from the start of the scale to how long the item has
// waited (a log scale, 1 min to 24 h), a square for a proposal and a ring for a request. An amber line marks Wait; a bar that has
// crossed it turns orange, because that request counts as unanswered. Handle 1 moves Wait along the scale. A denied item stays as a
// dashed lane with a cross.
//
// Keys. Settings the owner writes: `approvals` (ask · session · always, the Gateway's), `wait` (seconds, Hermes approvals.timeout,
// default 300), `noAnswer` (hold · deny). Settings the shell holds: `show` (proposals · requests · both), `order` (oldest · agent ·
// risk), `pick` (the item chosen in the queue). Readings: `light`, and `queue`, a JSON list of rows {id, kind proposal|request, who,
// text, where (a file or a tool), session, age (seconds), flag (the harness's reason, for By risk), diff (lines, for a proposal),
// state ("denied" once the harness declined it), by}. Actions, each its own key, each set to the item's id: `approve`, `changes`
// (a proposal), `allowOnce`, `allowAlways`, `deny` (a request). A key the owner does not report arrives absent, and the views draw
// "—" and say what is missing.
import {useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__approvals.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (the settings' words, not the owner's data)

const SHOWS: readonly Option<string>[] = [
  {value: 'proposals', label: 'Proposals', does: 'List the changes the agents propose.'},
  {value: 'requests', label: 'Requests', does: 'List the requests that ask for a decision.'},
  {value: 'both', label: 'Both', does: 'List proposals and requests.'},
]
const ORDERS: readonly Option<string>[] = [
  {value: 'oldest', label: 'Oldest first', does: 'The item that has waited longest comes first.'},
  {value: 'agent', label: 'By agent', does: 'Items of one agent stand together.'},
  {value: 'risk', label: 'By risk', does: 'Items the harness flagged come first.'},
]
const ANSWERS: readonly Option<string>[] = [
  {value: 'ask', label: 'Ask', does: 'You answer each request.'},
  {value: 'session', label: 'Session', does: 'A request is allowed for this session.'},
  {value: 'always', label: 'Always', does: 'A request is allowed every time.'},
]
const NO_ANSWERS: readonly Option<string>[] = [
  {value: 'hold', label: 'Hold', does: 'The request stays in the queue. Nothing lands.'},
  {value: 'deny', label: 'Deny', does: 'The request is declined when Wait passes.'},
]
const SAYS = {
  show: 'Which items the queue lists: proposals, requests or both.',
  order: 'The order of the queue. By risk puts the items the harness flagged first.',
  answer: 'The default answer to a request. The Gateway holds the same setting. You always give Deny yourself.',
  wait: 'How long a request waits before it counts as unanswered. Drag handle 1 along the scale.',
  noAnswer: 'What happens when nobody answers in time. Hold keeps the request. Deny declines it.',
}
/** Wait runs from 1 minute to 24 hours (seconds); the owner's default is 5 minutes (Hermes approvals.timeout, tools/approval_context.py:239). */
const WAIT = {min: 60, max: 86400, log: true} as const
const WAIT_DEFAULT = 300
/** The ticks of the scale in the well. */
const TICKS: readonly (readonly [number, string])[] = [[60, '1m'], [600, '10m'], [3600, '1h'], [86400, '24h']]

const at = (list: readonly {value: string}[], x: string | undefined) => { const i = list.findIndex(o => o.value === x); return i < 0 ? undefined : i }
const trim = (x: number) => String(Math.round(x * 10) / 10)
/** A span in seconds as a short text: seconds under two minutes, minutes under two hours, then hours. */
const spanText = (s: number) => (s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${trim(s / 60)} min` : `${trim(s / 3600)} h`)
/** A value for Wait with two significant digits, inside the range, so a step of the dial always moves it. */
const nice = (s: number) => {
  const c = clampTo(WAIT.min, WAIT.max, s), mag = Math.pow(10, Math.floor(Math.log10(c)) - 1)
  return clampTo(WAIT.min, WAIT.max, Math.round(c / mag) * mag)
}

// ---------------------------------------------------------------- the owner's rows, read safely

type Kind = 'proposal' | 'request'
interface Item {
  readonly id: string
  readonly kind?: Kind
  readonly who?: string
  readonly text: string
  /** The file a proposal changes, or the tool a request wants to use. */
  readonly where?: string
  readonly session?: string
  /** Seconds the item has waited. */
  readonly age?: number
  /** The harness's reason for asking, when it flagged the item. */
  readonly flag?: string
  readonly diff?: readonly string[]
  readonly denied?: boolean
  readonly by?: string
}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)

/** The queue from `queue`: a row that is not an object is dropped, an unknown kind is left unread. Undefined when it is not a list. */
function queueOf(v: V): Item[] | undefined {
  if (!has(v, 'queue')) return undefined
  const raw = json<unknown>(v, 'queue', undefined)
  if (!Array.isArray(raw)) return undefined
  const rows: Item[] = []
  for (const [n, item] of raw.entries()) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    rows.push({id: word(o.id) ?? `item:${n}`, kind: o.kind === 'proposal' || o.kind === 'request' ? o.kind : undefined, who: word(o.who), text: typeof o.text === 'string' ? o.text : '',
      where: word(o.where), session: word(o.session), age: typeof o.age === 'number' && Number.isFinite(o.age) && o.age >= 0 ? o.age : undefined, flag: word(o.flag),
      diff: Array.isArray(o.diff) ? o.diff.filter((l): l is string => typeof l === 'string') : undefined, denied: o.state === 'denied', by: word(o.by)})
  }
  return rows
}

/** The items to list: the kinds Show names, in the order Order names, the declined ones last. Undefined when the queue is not read. */
function listOf(v: V): Item[] | undefined {
  const all = queueOf(v)
  if (!all) return undefined
  const show = strOf(v, 'show'), order = strOf(v, 'order')
  const kept = all.filter(i => (show === 'proposals' ? i.kind === 'proposal' : show === 'requests' ? i.kind === 'request' : true))
  const byAge = (a: Item, b: Item) => (b.age ?? -1) - (a.age ?? -1)
  const cmp = order === 'agent' ? (a: Item, b: Item) => (a.who ?? '￿').localeCompare(b.who ?? '￿') || byAge(a, b)
    : order === 'risk' ? (a: Item, b: Item) => Number(!!b.flag) - Number(!!a.flag) || byAge(a, b) : byAge
  return [...kept].sort((a, b) => Number(!!a.denied) - Number(!!b.denied) || cmp(a, b))
}
/** The count of items that wait; undefined when the owner reports no queue. */
const waitingCount = (v: V) => queueOf(v)?.filter(i => !i.denied).length
const countText = (v: V) => { const n = waitingCount(v); return n === undefined ? NONE : `${n} wait` }
const waitText = (v: V) => { const w = numOf(v, 'wait'); return w === undefined ? NONE : spanText(w) }
/** The item the queue has chosen: the one named by `pick`, else the first that waits. */
const pickedOf = (v: V, list: Item[] | undefined) => list?.find(i => i.id === strOf(v, 'pick')) ?? list?.find(i => !i.denied) ?? list?.[0]
/** A request that has waited as long as Wait counts as unanswered. A proposal has no deadline. */
const isPast = (i: Item, wait: number | undefined) => !i.denied && i.kind === 'request' && wait !== undefined && i.age !== undefined && i.age >= wait
const ink = (i: Item, wait: number | undefined) => (i.denied ? 'var(--text-faint)' : isPast(i, wait) ? 'var(--stall)' : 'var(--dp-value)')
const ageText = (i: Item) => (i.age === undefined ? NONE : spanText(i.age))
const kindWord = (k: Kind | undefined) => (k === 'proposal' ? 'proposal' : k === 'request' ? 'request' : NONE)
const itemName = (i: Item) => [i.who, i.where].filter(Boolean).join(' · ') || NONE

// The light reads the owner alone; hollow while it has not said.
const lightOf = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState

// ---------------------------------------------------------------- the marks

/** A square for a proposal, a ring for a request, a faint box for a kind that is not read. */
function Mark({kind, color}: {kind?: Kind; color: string}) {
  return <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden>
    {kind === 'request' ? <circle cx={5} cy={5} r={3.2} fill="none" stroke={color} strokeWidth={1.5} />
      : kind === 'proposal' ? <rect x={1.8} y={1.8} width={6.4} height={6.4} fill={color} />
      : <rect x={2.3} y={2.3} width={5.4} height={5.4} fill="none" stroke="var(--text-faint)" strokeWidth={1} />}
  </svg>
}

// ---------------------------------------------------------------- the well

/** The well: one lane for each item on a time scale, the Wait line across them. A reading the owner has not reported is left off the
 * picture and named in words; the handle shows only where Wait can be written. */
function QueueWell({v, set, standing, w, h, size}: {v: V; set?: ViewProps['set']; standing?: ViewProps['standing']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini'
  const list = listOf(v), all = queueOf(v), wait = numOf(v, 'wait'), picked = pickedOf(v, list)
  const x0 = mini ? 6 : 10, x1 = w - x0, laneTop = mini ? 8 : 22, axisY = h - (mini ? 8 : 18), pitch = mini ? 10 : 14
  const span = Math.log(WAIT.max / WAIT.min)
  const xOf = (sec: number) => x0 + (Math.log(clampTo(WAIT.min, WAIT.max, sec) / WAIT.min) / span) * (x1 - x0)
  const secOf = (x: number) => WAIT.min * Math.exp(clampTo(0, 1, (x - x0) / (x1 - x0)) * span)
  const room = Math.max(1, Math.floor((axisY - laneTop - 2) / pitch))
  const over = list !== undefined && list.length > room, lanes = list === undefined ? [] : over ? list.slice(0, room - 1) : list
  const laneY = (i: number) => laneTop + i * pitch + pitch / 2
  const handle = !!set && !mini && wait !== undefined && !standing?.wait?.disabled
  const noAnswer = strOf(v, 'noAnswer')
  const note = list === undefined ? (mini ? 'No reading' : 'No reading of the queue') : list.length === 0 ? (all && all.length > 0 ? 'None of this kind' : 'Nothing waits') : undefined
  return <Display w={w} h={h} label="Waits" does={mini ? 'The items that wait for you, and how long each has waited.' : 'One lane for each item: how long it has waited, on a scale from 1 minute to 24 hours. The amber line is Wait. An orange request lane has crossed it.'}
    corner={countText(v)}>
    {!mini && <text x={7} y={11} className="dp-axis">{wait === undefined ? `wait ${NONE}` : `wait ${spanText(wait)}${noAnswer ? ` → ${noAnswer}` : ''}`}</text>}
    {lanes.map((it, i) => {
      const y = laneY(i), c = ink(it, wait), xe = it.age === undefined ? x0 + 2 : Math.max(x0 + 4, xOf(it.age)), chosen = !mini && picked?.id === it.id
      const click = set && !mini ? () => set('pick', it.id) : undefined
      return <g key={it.id} onClick={click} style={click ? {cursor: 'pointer'} : undefined}>
        <title>{[itemName(it), kindWord(it.kind), it.age === undefined ? undefined : `waited ${spanText(it.age)}`, it.denied ? 'declined' : isPast(it, wait) ? 'unanswered' : undefined].filter(Boolean).join(' · ')}</title>
        {click && <rect x={x0 - 4} y={y - pitch / 2} width={x1 - x0 + 8} height={pitch} fill={chosen ? 'color-mix(in srgb, var(--sel, #7ec3e6) 20%, transparent)' : 'transparent'} />}
        <path d={`M${x0} ${y}H${it.kind === 'request' ? xe - 3.2 : xe}`} stroke={c} strokeWidth={mini ? 1.5 : 2} strokeDasharray={it.denied ? '2 2' : undefined} fill="none" />
        {it.kind === 'request' ? <circle cx={xe} cy={y} r={3.2} fill="none" stroke={c} strokeWidth={1.5} />
          : it.kind === 'proposal' ? <rect x={xe - 3} y={y - 3} width={6} height={6} fill={c} />
          : <rect x={xe - 2.5} y={y - 2.5} width={5} height={5} fill="none" stroke={c} strokeWidth={1} />}
        {it.denied && <path d={`M${xe - 2.2} ${y - 2.2}l4.4 4.4m0-4.4l-4.4 4.4`} stroke="var(--text-dim)" strokeWidth={1.2} fill="none" />}
      </g>
    })}
    {over && <text x={x0} y={laneY(room - 1) + 3} className="dp-axis">+{list!.length - room + 1} more</text>}
    {note && <text x={x0} y={mini ? 40 : laneTop + 22} className="dp-ink-dim">{note}</text>}
    <path d={`M${x0} ${axisY}H${x1}`} className="dp-faint" />
    {TICKS.map(([sec, label], i) => <g key={sec}>
      <path d={`M${xOf(sec)} ${axisY - 3}V${axisY + 3}`} className="dp-faint" />
      {!mini && <text x={xOf(sec)} y={h - 5} className="dp-axis" textAnchor={i === 0 ? 'start' : i === TICKS.length - 1 ? 'end' : 'middle'}>{label}</text>}
    </g>)}
    {wait !== undefined && <path d={`M${xOf(wait)} ${laneTop - (mini ? 4 : 6)}V${axisY}`} stroke="var(--dp-on)" strokeWidth={1.4} strokeDasharray="3 2" fill="none" />}
    {wait !== undefined && !handle && <circle cx={xOf(wait)} cy={axisY} r={3} fill="var(--dp-on)" />}
    {handle && <Handle n={1} shape="ring" x={xOf(wait!)} y={axisY} label="Wait" does={SAYS.wait} onDrag={x => set!('wait', nice(secOf(x)))} onReset={() => set!('wait', WAIT_DEFAULT)} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const showDial = (p: ViewProps) => <Dial {...st(p, 'show')} label="Show" does={SAYS.show} value={at(SHOWS, strOf(p.v, 'show')) ?? NaN} def={2} scale={{min: 0, max: 2, step: 1}}
  format={i => SHOWS[Math.round(i)]?.label ?? NONE} onChange={i => p.set('show', SHOWS[Math.round(i)]!.value)} />
const answerDial = (p: ViewProps) => <Dial {...st(p, 'approvals')} label="Default" does={SAYS.answer} value={at(ANSWERS, strOf(p.v, 'approvals')) ?? NaN} def={0} scale={{min: 0, max: 2, step: 1}}
  format={i => ANSWERS[Math.round(i)]?.label ?? NONE} onChange={i => p.set('approvals', ANSWERS[Math.round(i)]!.value)} />
const waitDial = (p: ViewProps) => <Dial {...st(p, 'wait')} label="Wait" does={SAYS.wait} value={numOf(p.v, 'wait') ?? NaN} def={WAIT_DEFAULT} scale={WAIT}
  format={spanText} onChange={x => p.set('wait', nice(x))} />
const noAnswerRadio = (p: ViewProps) => <Radio {...st(p, 'noAnswer')} label="No answer" does={SAYS.noAnswer} value={strOf(p.v, 'noAnswer') ?? ''} options={NO_ANSWERS} stack onChange={x => p.set('noAnswer', x)} />

/** The answers to one item, each an action on its own key set to the item's id. A proposal takes Approve, Changes and Open; a request
 * takes Allow once, Allow always and Deny (`short`: the tile's three, Allow once, Deny and Open). Open chooses the item and opens the pane. */
function answers(p: ViewProps, item: Item | undefined, short?: boolean): ReactNode {
  const why = item === undefined ? 'Choose an item in the queue.' : item.denied ? 'The harness declined it already.' : item.kind === undefined ? 'The kind of this item is not read.' : undefined
  const act = (key: string, label: string, does: string) => {
    const s = st(p, key)
    return <Action key={key} {...s} disabled={s.disabled ?? why} label={label} does={does} onPress={item ? () => p.set(key, item.id) : undefined} />
  }
  const open = <Action key="open" label="Open" does="Read the item in a pane, with its diff or its command." disabled={why}
    onPress={item ? () => { p.set('pick', item.id); p.nav.full?.() } : undefined} />
  if (item?.kind === 'request') {
    return short ? [act('allowOnce', 'Allow once', 'Let the agent do this once.'), act('deny', 'Deny', 'Decline the request. The agent is told.'), open]
      : [act('allowOnce', 'Allow once', 'Let the agent do this once.'), act('allowAlways', 'Allow always', 'Let the agent do this every time.'), act('deny', 'Deny', 'Decline the request. The agent is told.')]
  }
  return [act('approve', 'Approve', 'Let the agent write this change. The write carries a receipt.'), act('changes', 'Changes', 'Ask for a different result. Say what to change in the thread.'), open]
}

// ---------------------------------------------------------------- the whole view

function ApprovalsWhole({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const list = listOf(p.v), wait = numOf(p.v, 'wait'), picked = pickedOf(p.v, list), known = list !== undefined
  const rows: RowItem[] = (list ?? []).map(it => ({id: it.id, name: itemName(it), light: it.denied ? 'dark' : 'lit', note: ageText(it), does: it.text || itemName(it),
    why: it.denied ? 'The harness declined it.' : isPast(it, wait) ? 'Wait passed with no answer.' : it.flag, mark: <Mark kind={it.kind} color={ink(it, wait)} />}))
  return <Panel title="Approvals" view="whole" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={206}>
        <QueueWell v={p.v} set={p.set} standing={p.standing} w={194} h={146} size="whole" />
      </Section>
      <Section label="Default" width={78}>
        <Radio {...st(p, 'approvals')} does={SAYS.answer} value={strOf(p.v, 'approvals') ?? ''} options={ANSWERS} stack onChange={x => p.set('approvals', x)} />
      </Section>
      <Section label="Unanswered" grow>
        {waitDial(p)}
        {noAnswerRadio(p)}
      </Section>
    </Band>
    <Band>
      <Section width={170}>
        <Rows label={known ? 'Queue' : 'Queue · no reading'} does="The items that wait for you. A square is a proposal; a ring is a request. Press a name to choose it." items={rows} size={7}
          selected={picked?.id} onSelect={id => p.set('pick', id)} page={page} onPage={setPage} />
      </Section>
      <Section label="List" width={112}>
        <Chooser {...st(p, 'show')} label="Show" does={SAYS.show} value={strOf(p.v, 'show') ?? ''} options={SHOWS} onChange={x => p.set('show', x)} />
        <Chooser {...st(p, 'order')} label="Order" does={SAYS.order} value={strOf(p.v, 'order') ?? ''} options={ORDERS} onChange={x => p.set('order', x)} />
        <Readout big label="waiting" does="Proposals and requests that wait for you." value={waitingCount(p.v)} tone="accent" />
      </Section>
      <Section label="Answer" grow>
        {answers(p, picked)}
      </Section>
    </Band>
  </Panel>
}

// ---------------------------------------------------------------- the pane: the queue and the item chosen

/** A button on the item's detail: it sets its own key to the item's id, and stands as the host says for that key. */
const paneButton = (p: ViewProps, item: Item, key: string, label: string, does: string) => {
  const s = st(p, key), why = s.disabled ?? (item.denied ? 'The harness declined it already.' : undefined)
  return <button type="button" key={key} disabled={!!why} data-pending={s.pending || undefined} onClick={() => p.set(key, item.id)}
    data-i={`${label}|${[does, why].filter(Boolean).join(' ')}`}>{label}</button>
}

function ApprovalsPane({p}: {p: ViewProps}) {
  const v = p.v, list = listOf(v), wait = numOf(v, 'wait'), item = pickedOf(v, list)
  const left = item?.kind === 'request' && item.age !== undefined && wait !== undefined ? wait - item.age : undefined
  return <div className="ap-pane">
    <div className="ap-pane-head" aria-label="Approvals">
      <b>Approvals</b><span>{countText(v)}</span><span>wait {waitText(v)}</span><span>no answer {shown(v, 'noAnswer')}</span><span>default {shown(v, 'approvals')}</span>
      <span>show {shown(v, 'show')}</span><span>order {shown(v, 'order')}</span>
    </div>
    <div className="ap-body">
      <div className="ap-list" role="table" aria-label="Queue">
        <div className="ap-line ap-line--head" role="row"><span /><span>Agent</span><span>Item</span><span>Waited</span><span>Flag</span></div>
        {list === undefined && <p className="ap-empty">No reading of the queue.</p>}
        {list && list.length === 0 && <p className="ap-empty">Nothing waits.</p>}
        {(list ?? []).map(it => <button key={it.id} type="button" role="row" className="ap-line" aria-pressed={it.id === item?.id} data-state={it.denied ? 'denied' : isPast(it, wait) ? 'past' : undefined}
          onClick={() => p.set('pick', it.id)} data-i={`${itemName(it)}|${it.text || kindWord(it.kind)}`}>
          <Mark kind={it.kind} color={ink(it, wait)} /><span className="ap-who">{it.who ?? NONE}</span><span className="ap-text">{it.text || NONE}</span>
          <span className="ap-age">{it.denied ? 'declined' : ageText(it)}</span><span className="ap-flag">{it.flag ?? ''}</span>
        </button>)}
      </div>
      <div className="ap-detail">
        {item === undefined && <p className="ap-empty">{list === undefined ? 'No reading of the queue.' : 'Nothing to read.'}</p>}
        {item !== undefined && <>
          <div className="ap-detail-head"><Mark kind={item.kind} color={ink(item, wait)} /><b>{item.who ?? NONE}</b><span>{kindWord(item.kind)}</span>{item.session && <span>{item.session}</span>}</div>
          <div className="ap-detail-sub">
            {item.denied ? `declined${item.by ? ` · ${item.by}` : ''}` : left === undefined ? `waited ${ageText(item)}` : left >= 0 ? `waited ${ageText(item)} · Wait ends in ${spanText(left)}` : `waited ${ageText(item)} · Wait passed ${spanText(-left)} ago`}
          </div>
          <p className="ap-what">{item.kind === 'request' ? `${item.where ?? NONE} asks to run` : item.text || NONE}</p>
          {item.kind === 'request' && <pre className="ap-cmd" aria-label="Command">{item.text || NONE}</pre>}
          {item.kind === 'request' && <p className="ap-note" data-flagged={item.flag ? 'true' : undefined}>{item.flag ? `The harness flagged it: ${item.flag}.` : 'The harness did not flag it.'}</p>}
          {item.kind === 'proposal' && <pre className="ap-diff" aria-label="Diff">
            {item.diff === undefined ? 'No reading of the diff.' : item.diff.map((line, n) => <span key={n} data-d={line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : undefined}>{line || ' '}{'\n'}</span>)}
          </pre>}
          {item.kind === undefined && <p className="ap-note">The kind of this item is not read.</p>}
          <div className="ap-do">
            {item.kind === 'request' ? <>
              {paneButton(p, item, 'allowOnce', 'Allow once', 'Let the agent do this once.')}
              {paneButton(p, item, 'allowAlways', 'Allow always', 'Let the agent do this every time.')}
              {paneButton(p, item, 'deny', 'Deny', 'Decline the request. The agent is told.')}
            </> : item.kind === 'proposal' ? <>
              {paneButton(p, item, 'approve', 'Approve', 'Let the agent write this change. The write carries a receipt.')}
              {paneButton(p, item, 'changes', 'Changes', 'Ask for a different result. Say what to change in the thread.')}
            </> : null}
          </div>
        </>}
      </div>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

/** The sample material of the gallery's fixtures: the work of Flint and Kite on the Thread's sessions. The views never read these: the
 * owner's list arrives on `queue`. */
const sampleQueue = (declined?: boolean) => JSON.stringify([
  {id: 'req:tsc', kind: 'request', who: 'Flint', where: 'Bash', text: 'tsc --noEmit -p packages/live-shell/ui', session: 'tsc roots', age: 80},
  {id: 'prop:model', kind: 'proposal', who: 'Flint', where: 'agentParamAddresses.ts', text: 'Add the model row to the agent device', session: 'tsc roots', age: 150,
    diff: ['@@ AGENT_SHELL_ADDRESS_TABLE', "+  reading('actuation', 'agent', 'model', 'string', {disclosure: 'No shell writer yet.'}),"]},
  {id: 'prop:setModel', kind: 'proposal', who: 'Kite', where: 'agentParamAddresses.ts', text: "Name shell.setModel as the model row's write path", session: 'model row', age: 240,
    diff: ['@@ AGENT_SHELL_ADDRESS_TABLE', "-  reading('actuation', 'agent', 'model', 'string', {disclosure: 'No shell writer yet.'}),",
      "+  agentParamAddress({family: 'actuation', deviceInstance: 'agent', key: 'model', type: 'string', writePath: 'shell.setModel'}),"]},
  {id: 'req:rm', kind: 'request', who: 'Kite', where: 'Bash', text: 'rm -rf desktop/cradle/expressions-app/dist', session: 'app root', age: 620, flag: 'recursive delete',
    ...(declined ? {state: 'denied', by: 'no answer'} : {})},
])

export const design: DesignedDevice = {
  id: 'software-factory:approvals',
  title: 'Approvals',
  kind: 'effect',
  defaults: {light: 'lit', show: 'both', order: 'oldest', approvals: 'ask', wait: WAIT_DEFAULT, noAnswer: 'hold', queue: sampleQueue(), pick: 'prop:setModel'},
  fixtures: {
    'Four wait, one past Wait': {},
    'Declined at the end of Wait': {noAnswer: 'deny', queue: sampleQueue(true), pick: 'req:rm'},
    'No readings': Object.fromEntries(['light', 'show', 'order', 'approvals', 'wait', 'noAnswer', 'queue', 'pick'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Approvals" light={lightOf(p)} readings={[countText(p.v), waitText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Approvals" view="compact" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <QueueWell v={p.v} set={p.set} standing={p.standing} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2} width={124}>
      {showDial(p)}
      {answerDial(p)}
      {waitDial(p)}
      {noAnswerRadio(p)}
    </Section>
  </Panel>,

  whole: p => <ApprovalsWhole p={p} />,

  full: p => <ApprovalsPane p={p} />,

  widget: p => {
    const list = listOf(p.v), wait = numOf(p.v, 'wait'), cards = (list ?? []).filter(i => !i.denied).slice(0, 2)
    return <Tile title="Approvals" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <QueueWell v={p.v} standing={p.standing} w={76} h={100} size="mini" />
      <div className="ap-cards">
        {list === undefined && <p className="ap-empty">No reading of the queue.</p>}
        {list !== undefined && cards.length === 0 && <p className="ap-empty">Nothing waits.</p>}
        {cards.map(it => <div key={it.id} className="ap-card" data-state={isPast(it, wait) ? 'past' : undefined} data-i={`${itemName(it)}|${it.text || kindWord(it.kind)}`}>
          <div className="ap-card-line"><Mark kind={it.kind} color={ink(it, wait)} /><b>{it.who ?? NONE}</b><span>{it.text || NONE}</span></div>
          <div className="ap-card-do">{answers(p, it, true)}</div>
        </div>)}
      </div>
    </Tile>
  },
}
