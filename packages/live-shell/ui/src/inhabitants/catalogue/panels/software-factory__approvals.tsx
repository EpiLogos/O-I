// Approvals (manual §19.14, software-factory:approvals): one place to answer what waits for you — the changes agents propose, the
// questions an owner or an agent asks you to decide, the attempt you chose to stand, and the run whose return you have read. Nothing in it
// lands until you answer. Live's nearest: Utility with a small display, as Custody is.
//
// The well draws the queue as a lake: its level is the backlog (face-rig CREATURE-SPEC.md 24, the lake), a dry bed an empty queue, a lake at
// its brim eight items or more. Each item floats on the surface at how long it has waited (a log scale, 1 min to 24 h): a square for a
// proposal, a ring for a request, a diamond for a review or a recognition. An amber line marks the wait the Agent sets (§19.4 Wait): a
// request that floats past it turns orange, because it counts as unanswered; an urgent request is red. Agents and owners ask into the lake
// at the left bank, and your answers drain it at the right. How long a request waits and what happens then are the Agent's Wait and On no
// answer, and the default answer is the Gateway's Approvals (§19.2): Approvals shows them and never sets them.
//
// Keys. The shell holds: `show` (all · proposals · requests · reviews · recognitions · urgent), `order` (oldest · agent · risk), `follow`
// (the newest item at the top), `pick` (the item chosen). Readings: `light`; `wait` (seconds) and `noAnswer` (hold · deny), the Agent's;
// `desktop` (shown · refused: whether your computer shows a notice when an item arrives); `messages` (the agents that wait for you in
// Messages); and `queue`, a JSON list of rows {id, kind proposal | request | review | recognition, who, text, where (a file or a tool),
// session, age (seconds), flag (the owner's reason, for By risk), urgent, diff (lines, for a proposal), state ("denied" once declined), by,
// opened, review, recognition}. A review carries the attempt's return set against what it was for (Factory's attempt reading and build
// view): {criteria: [{text, state satisfied | unsatisfied | indeterminate}], claims: [{statement, evidence}], requests: [{question}],
// artefacts, evidence, receipt (Central linked a receipt to the Return), outputs}. A recognition carries the Run's return:
// {run, course, summary, recognised?: {at}} (the journey reading's returns and recognitions).
// Answers, each its own key set to the item's id, by kind:
//   a proposal: approve (Central's projectcentral.source.return_accept, held), changes (projectcentral.source.return_comment), reject
//     (Deny; no owner operation declines a return yet, held);
//   a request: allowOnce (Approve: the harness's consent, allow once, held), deny (reject once, held), open (where it belongs: a run in
//     Factory, a Day in Central, an agent in Messages);
//   a review: confirm (factory_owner AttemptReceiving, held), reviewChanges (Changes), collect (Workcell's collect, which no kernel route
//     reaches yet);
//   a recognition: recognise (factory_owner Recognise), close (factory_owner RunClose, held; it follows a Recognition), continue
//     (ContinueCommission, whose route the kernel issues only for a Recognition).
// Every item takes open, which marks it opened here and tells its owner nothing. A key the owner does not report arrives absent, and the
// views draw "—" and say what is missing.
import {useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__approvals.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (the settings' words, not the owner's data)

const SHOWS: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'Every item that waits.'},
  {value: 'proposals', label: 'Proposals', does: 'The changes agents propose.'},
  {value: 'requests', label: 'Requests', does: 'The questions an owner or an agent asks you to decide.'},
  {value: 'reviews', label: 'Reviews', does: 'The attempts you chose to stand.'},
  {value: 'recognitions', label: 'Recognitions', does: 'The runs that have returned.'},
  {value: 'urgent', label: 'Urgent', does: 'The urgent requests.'},
]
const ORDERS: readonly Option<string>[] = [
  {value: 'oldest', label: 'Oldest first', does: 'The item that has waited longest comes first.'},
  {value: 'agent', label: 'By agent', does: 'The items of one author stand together.'},
  {value: 'risk', label: 'By risk', does: 'The items their owner flagged come first.'},
]
const SAYS = {
  show: 'Which items the queue holds.',
  order: 'The order of the queue. By risk puts first the items their owner flagged.',
  follow: 'Keeps the newest item at the top.',
}
/** The lake's scale, from 1 minute to 24 hours (seconds). */
const SCALE = {min: 60, max: 86400} as const
/** The ticks of the scale in the well. */
const TICKS: readonly (readonly [number, string])[] = [[60, '1m'], [600, '10m'], [3600, '1h'], [86400, '24h']]

const trim = (x: number) => String(Math.round(x * 10) / 10)
/** A span in seconds as a short text: seconds under two minutes, minutes under two hours, then hours. */
const spanText = (s: number) => (s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${trim(s / 60)} min` : `${trim(s / 3600)} h`)

// ---------------------------------------------------------------- the owner's rows, read safely

type Kind = 'proposal' | 'request' | 'review' | 'recognition'
const KINDS: readonly Kind[] = ['proposal', 'request', 'review', 'recognition']
type Criterion = {readonly text: string; readonly state: 'satisfied' | 'unsatisfied' | 'indeterminate'}
interface Review {readonly criteria: readonly Criterion[]; readonly claims: readonly {statement: string; evidence: number}[]; readonly requests: readonly string[]
  readonly artefacts?: number; readonly evidence?: number; readonly receipt?: boolean; readonly outputs?: number}
interface Recognition {readonly run?: string; readonly course?: string; readonly summary?: string; readonly recognisedAt?: string}
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
  /** The owner's reason for asking, when it flagged the item. */
  readonly flag?: string
  readonly urgent?: boolean
  readonly diff?: readonly string[]
  readonly denied?: boolean
  readonly by?: string
  readonly opened?: boolean
  readonly review?: Review
  readonly recognition?: Recognition
}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
function reviewOf(x: unknown): Review | undefined {
  const r = rec(x)
  if (!r) return undefined
  const list = (y: unknown) => (Array.isArray(y) ? y.map(rec).filter((z): z is Record<string, unknown> => !!z) : [])
  return {criteria: list(r.criteria).flatMap(c => (word(c.text) ? [{text: c.text as string, state: c.state === 'satisfied' || c.state === 'unsatisfied' ? c.state : 'indeterminate' as const}] : [])),
    claims: list(r.claims).flatMap(c => (word(c.statement) ? [{statement: c.statement as string, evidence: count(c.evidence) ?? 0}] : [])),
    requests: list(r.requests).flatMap(c => (word(c.question) ? [c.question as string] : [])),
    artefacts: count(r.artefacts), evidence: count(r.evidence), receipt: typeof r.receipt === 'boolean' ? r.receipt : undefined, outputs: count(r.outputs)}
}
function recognitionOf(x: unknown): Recognition | undefined {
  const r = rec(x)
  return r ? {run: word(r.run), course: word(r.course), summary: word(r.summary), recognisedAt: word(rec(r.recognised)?.at)} : undefined
}

/** The queue from `queue`: a row that is not an object is dropped, an unknown kind is left unread. Undefined when it is not a list. */
function queueOf(v: V): Item[] | undefined {
  if (!has(v, 'queue')) return undefined
  const raw = json<unknown>(v, 'queue', undefined)
  if (!Array.isArray(raw)) return undefined
  const rows: Item[] = []
  for (const [n, item] of raw.entries()) {
    const o = rec(item)
    if (!o) continue
    rows.push({id: word(o.id) ?? `item:${n}`, kind: KINDS.includes(o.kind as Kind) ? o.kind as Kind : undefined, who: word(o.who), text: typeof o.text === 'string' ? o.text : '',
      where: word(o.where), session: word(o.session), age: typeof o.age === 'number' && Number.isFinite(o.age) && o.age >= 0 ? o.age : undefined, flag: word(o.flag), urgent: o.urgent === true,
      diff: Array.isArray(o.diff) ? o.diff.filter((l): l is string => typeof l === 'string') : undefined, denied: o.state === 'denied', by: word(o.by), opened: o.opened === true,
      review: reviewOf(o.review), recognition: recognitionOf(o.recognition)})
  }
  return rows
}

/** The items to list: those Show names, in the order Order names (Follow puts the newest first), the declined last. Undefined when the queue
 * is not read. */
function listOf(v: V): Item[] | undefined {
  const all = queueOf(v)
  if (!all) return undefined
  const show = strOf(v, 'show'), order = strOf(v, 'order'), follow = boolOf(v, 'follow') === true
  const kept = all.filter(i => (show === 'proposals' ? i.kind === 'proposal' : show === 'requests' ? i.kind === 'request' : show === 'reviews' ? i.kind === 'review'
    : show === 'recognitions' ? i.kind === 'recognition' : show === 'urgent' ? i.urgent === true : true))
  const byAge = (a: Item, b: Item) => (b.age ?? -1) - (a.age ?? -1)
  const cmp = order === 'agent' ? (a: Item, b: Item) => (a.who ?? '￿').localeCompare(b.who ?? '￿') || byAge(a, b)
    : order === 'risk' ? (a: Item, b: Item) => Number(!!b.flag || !!b.urgent) - Number(!!a.flag || !!a.urgent) || byAge(a, b) : byAge
  const sorted = [...kept].sort((a, b) => Number(!!a.denied) - Number(!!b.denied) || cmp(a, b))
  if (!follow) return sorted
  const newest = [...kept].filter(i => !i.denied && i.age !== undefined).sort((a, b) => a.age! - b.age!)[0]
  return newest ? [newest, ...sorted.filter(i => i !== newest)] : sorted
}
/** The count of items that wait; undefined when the owner reports no queue. */
const waitingCount = (v: V) => queueOf(v)?.filter(i => !i.denied).length
const countText = (v: V) => { const n = waitingCount(v); return n === undefined ? NONE : `${n} wait` }
/** The item the queue has chosen: the one named by `pick`, else the first that waits. */
const pickedOf = (v: V, list: Item[] | undefined) => list?.find(i => i.id === strOf(v, 'pick')) ?? list?.find(i => !i.denied) ?? list?.[0]
/** The review or recognition the Review page shows: the chosen item when it is one, else the first that waits. */
const reviewedOf = (v: V) => { const all = queueOf(v), chosen = all?.find(i => i.id === strOf(v, 'pick'))
  return chosen && (chosen.kind === 'review' || chosen.kind === 'recognition') ? chosen : all?.find(i => !i.denied && (i.kind === 'review' || i.kind === 'recognition')) }
/** A request that has waited as long as the Agent's Wait counts as unanswered. A proposal, a review and a recognition have no deadline. */
const isPast = (i: Item, wait: number | undefined) => !i.denied && i.kind === 'request' && wait !== undefined && i.age !== undefined && i.age >= wait
const ink = (i: Item, wait: number | undefined) => (i.denied ? 'var(--text-faint)' : i.urgent ? 'var(--rec)' : isPast(i, wait) ? 'var(--stall)' : 'var(--dp-value)')
const ageText = (i: Item) => (i.age === undefined ? NONE : spanText(i.age))
const KIND_WORD: Readonly<Record<Kind, string>> = {proposal: 'proposal', request: 'request', review: 'review', recognition: 'recognition'}
const kindWord = (k: Kind | undefined) => (k ? KIND_WORD[k] : NONE)
const itemName = (i: Item) => [i.who, i.where].filter(Boolean).join(' · ') || NONE

// The light reads the owner alone; hollow while it has not said.
const lightOf = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState

// ---------------------------------------------------------------- the marks

/** A square for a proposal, a ring for a request, a diamond for a review or a recognition, a faint box for a kind that is not read. */
function Shape({kind, x, y, color, open}: {kind?: Kind; x: number; y: number; color: string; open?: boolean}) {
  return kind === 'request' ? <circle cx={x} cy={y} r={3.2} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={open ? '2 2' : undefined} />
    : kind === 'proposal' ? <rect x={x - 3} y={y - 3} width={6} height={6} fill={open ? 'none' : color} stroke={open ? color : undefined} strokeWidth={open ? 1.2 : undefined} />
    : kind === 'review' || kind === 'recognition' ? <path d={`M${x} ${y - 4}l4 4l-4 4l-4 -4z`} fill={open || kind === 'recognition' ? 'none' : color} stroke={color} strokeWidth={1.2} />
    : <rect x={x - 2.5} y={y - 2.5} width={5} height={5} fill="none" stroke="var(--text-faint)" strokeWidth={1} />
}
function Mark({kind, color}: {kind?: Kind; color: string}) {
  return <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden><Shape kind={kind} x={5} y={5} color={color} /></svg>
}

// ---------------------------------------------------------------- the well

/** How many items fill the lake to its brim. The queue has no limit: a longer one overtops the scale and the lake stands full. */
const BRIM = 8

/** The well: the queue as a lake. The water rises with the number of items that wait; each item floats on the surface at the time it has
 * waited. The amber line is the Agent's Wait: a request that floats past it has crossed into unanswered and turns orange. A reading the owner
 * has not reported is left off the picture and named in words. */
function QueueWell({v, set, w, h, size}: {v: V; set?: ViewProps['set']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini'
  const list = listOf(v), all = queueOf(v), wait = numOf(v, 'wait'), picked = pickedOf(v, list)
  const x0 = mini ? 6 : 10, x1 = w - x0, top = mini ? 8 : 22, axisY = h - (mini ? 8 : 18)
  const span = Math.log(SCALE.max / SCALE.min)
  const xOf = (sec: number) => x0 + (Math.log(clampTo(SCALE.min, SCALE.max, sec) / SCALE.min) / span) * (x1 - x0)
  const level = all === undefined ? undefined : Math.min(1, all.filter(i => !i.denied).length / BRIM)
  const bed = axisY - 3, room = bed - top - 8, surface = level === undefined ? bed : bed - 6 - level * (room - 6)
  const noAnswer = strOf(v, 'noAnswer')
  const note = list === undefined ? (mini ? 'No reading' : 'No reading of the queue') : list.length === 0 ? (all && all.length > 0 ? 'None of this kind' : 'Nothing waits') : undefined
  const bank = (x: number, dir: 1 | -1) => `M${x} ${top + 4}C${x + dir * 3} ${bed - room * 0.3} ${x + dir * 6} ${bed - 3} ${x + dir * 18} ${bed}`
  const rows = Math.max(0, Math.floor((bed - surface) / 6))
  const ripple = (y: number, amp: number) => { const n = 12; let d = `M${x0 + 8} ${y}`; for (let i = 1; i <= n; i++) d += `L${(x0 + 8 + (x1 - x0 - 16) * i / n).toFixed(1)} ${(y + Math.sin(i * 1.7) * amp).toFixed(1)}`; return d }
  const floats = (list ?? []).slice(0, 14).map(it => ({it, x: it.age === undefined ? x0 + 6 : Math.max(x0 + 8, xOf(it.age))}))
  const placed: {it: Item; x: number; y: number}[] = []
  for (const f of floats) { let n = 0; for (const q of placed) if (Math.abs(q.x - f.x) < 9) n++; placed.push({it: f.it, x: f.x, y: surface - 5 - n * 7}) }
  return <Display w={w} h={h} label="Waits" does={mini ? 'The items that wait for you, on a lake whose level is how many.' : 'The queue as a lake: it rises with the number of items that wait. Each item floats at the time it has waited, from 1 minute to 24 hours: a square for a proposal, a ring for a request, a diamond for a review or a recognition. The amber line is the Agent\'s Wait. An orange request has floated past it; a red one is urgent.'}
    corner={countText(v)}>
    {!mini && <text x={7} y={11} className="dp-axis">{wait === undefined ? `wait ${NONE}` : `wait ${spanText(wait)}${noAnswer ? ` → ${noAnswer}` : ''}`}</text>}
    <path d={bank(x0, 1)} className="dp-faint" fill="none" />
    <path d={bank(x1, -1)} className="dp-faint" fill="none" />
    <path d={`M${x0 + 18} ${bed}H${x1 - 18}`} className="dp-faint" />
    {level !== undefined && level > 0 && <>
      <path d={`M${x0 + 4} ${surface}L${x1 - 4} ${surface}L${x1 - 18} ${bed}L${x0 + 18} ${bed}Z`} fill="var(--dp-value)" opacity={0.16} />
      {Array.from({length: Math.min(rows, 12)}, (_, i) => <path key={i} d={ripple(surface + 6 * (i + 1), 0.5)} fill="none" stroke="var(--dp-value)" strokeWidth={0.6} opacity={0.38 - i * 0.025} />)}
      <path d={ripple(surface, 1.1)} fill="none" stroke="var(--dp-value)" strokeWidth={1.4} />
    </>}
    {!mini && <>
      <path d={`M${x0 + 2} ${top + 4}l4 0l0 ${Math.max(2, surface - top - 4)}`} className="dp-faint" fill="none" strokeDasharray="1.5 2.5" />
      <path d={`M${x1 - 6} ${bed - 2}l8 0`} stroke="var(--dp-on)" strokeWidth={1.2} fill="none" />
      <path d={`M${x1 - 1} ${bed - 5}l3 3l-3 3`} stroke="var(--dp-on)" strokeWidth={1.2} fill="none" />
    </>}
    {placed.map(({it, x: xe, y}) => {
      const c = ink(it, wait), chosen = !mini && picked?.id === it.id
      const click = set && !mini ? () => set('pick', it.id) : undefined
      return <g key={it.id} onClick={click} style={click ? {cursor: 'pointer'} : undefined}>
        <title>{[itemName(it), kindWord(it.kind), it.age === undefined ? undefined : `waited ${spanText(it.age)}`, it.denied ? 'declined' : it.urgent ? 'urgent' : isPast(it, wait) ? 'unanswered' : undefined].filter(Boolean).join(' · ')}</title>
        {click && <circle cx={xe} cy={y} r={7} fill={chosen ? 'color-mix(in srgb, var(--sel, #7ec3e6) 28%, transparent)' : 'transparent'} />}
        <Shape kind={it.kind} x={xe} y={y} color={c} open={it.denied} />
        {it.denied && <path d={`M${xe - 2.2} ${y - 2.2}l4.4 4.4m0-4.4l-4.4 4.4`} stroke="var(--text-dim)" strokeWidth={1.2} fill="none" />}
      </g>
    })}
    {note && <text x={x0 + 20} y={mini ? 40 : top + 22} className="dp-ink-dim">{note}</text>}
    <path d={`M${x0} ${axisY}H${x1}`} className="dp-faint" />
    {TICKS.map(([sec, label], i) => <g key={sec}>
      <path d={`M${xOf(sec)} ${axisY - 3}V${axisY + 3}`} className="dp-faint" />
      {!mini && <text x={xOf(sec)} y={h - 5} className="dp-axis" textAnchor={i === 0 ? 'start' : i === TICKS.length - 1 ? 'end' : 'middle'}>{label}</text>}
    </g>)}
    {/* The Agent's Wait, read: Approvals sets no time of its own. */}
    {wait !== undefined && <path d={`M${xOf(wait)} ${top - (mini ? 4 : 6)}V${axisY}`} stroke="var(--dp-on)" strokeWidth={1.4} strokeDasharray="3 2" fill="none" />}
    {wait !== undefined && <circle cx={xOf(wait)} cy={axisY} r={3} fill="var(--dp-on)" />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const showChooser = (p: ViewProps, label = 'Show') => <Chooser {...st(p, 'show')} label={label} does={SAYS.show} value={strOf(p.v, 'show') ?? ''} options={SHOWS} onChange={x => p.set('show', x)} />
const orderRadio = (p: ViewProps) => <Radio {...st(p, 'order')} label="Order" does={SAYS.order} value={strOf(p.v, 'order') ?? ''} options={ORDERS} stack onChange={x => p.set('order', x)} />
const followToggle = (p: ViewProps) => { const now = boolOf(p.v, 'follow')
  return <Toggle {...st(p, 'follow')} label="Follow" does={SAYS.follow} on={now === true} unknown={now === undefined} onChange={x => p.set('follow', x)} /> }

/** The answers to one item, each an action on its own key set to the item's id (`short`: the tile's three). Open opens the item where it
 * belongs and marks it opened here. */
function answers(p: ViewProps, item: Item | undefined, short?: boolean): ReactNode {
  const why = item === undefined ? 'Choose an item in the queue.' : item.denied ? 'Its owner declined it already.' : item.kind === undefined ? 'The kind of this item is not read.' : undefined
  const act = (key: string, label: string, does: string, hold = false, extra?: string) => {
    const s = st(p, key)
    return <Action key={key} {...s} hold={hold} disabled={s.disabled ?? why ?? extra} label={label} does={does} onPress={item ? () => p.set(key, item.id) : undefined} />
  }
  const open = <Action key="open" {...st(p, 'open')} label="Open" does="Opens the item where it belongs: a run in Factory, a Day in Central, an agent in Messages. Marks it opened here; its owner is told nothing."
    disabled={st(p, 'open').disabled ?? why} onPress={item ? () => { p.set('pick', item.id); p.set('open', item.id) } : undefined} />
  if (item?.kind === 'request') return [act('allowOnce', 'Approve', 'Approves the request. Nothing else is allowed by it.', true), act('deny', 'Deny', 'Declines the request. Its author is told.', true), open]
  if (item?.kind === 'review') return short ? [open] : [act('confirm', 'Confirm', 'The attempt stands. Read the conditions and the claims first.', true), act('reviewChanges', 'Changes', 'Asks for another attempt. Say what to change in the thread.'), open]
  if (item?.kind === 'recognition') { const r = item.recognition?.recognisedAt
    return short ? [open] : [act('recognise', 'Recognise', 'Your word that what the run returned is what its commission asked for.', false, r ? 'You recognised it.' : undefined),
      act('close', 'Close', 'Factory finishes the run, or starts its next unit if one remains.', true, r ? undefined : 'Recognise the return first.'),
      act('continue', 'Continue', 'A new run continues the same course. This run stays on the record.')] }
  return short ? [act('approve', 'Approve', 'The change lands, with a receipt.', true), act('changes', 'Changes', 'Asks for a different result. Say what to change in the thread.'), open]
    : [act('approve', 'Approve', 'The change lands, with a receipt.', true), act('changes', 'Changes', 'Asks for a different result. Say what to change in the thread.'), act('reject', 'Deny', 'Declines the change. Nothing lands.', true)]
}

// ---------------------------------------------------------------- the whole view: Queue and Review

const desktopWord = (v: V) => { const d = strOf(v, 'desktop'); return d === 'shown' ? 'shown' : d === 'refused' ? 'refused' : d }

function QueueBands({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const list = listOf(p.v), wait = numOf(p.v, 'wait'), picked = pickedOf(p.v, list), known = list !== undefined
  const rows: RowItem[] = (list ?? []).map(it => ({id: it.id, name: itemName(it), light: it.denied ? 'dark' : 'lit', note: ageText(it), does: `${kindWord(it.kind)}: ${it.text || itemName(it)}${it.opened ? ' Opened here.' : ''}`,
    why: it.denied ? 'Its owner declined it.' : it.urgent ? 'Urgent.' : isPast(it, wait) ? 'The Agent\'s Wait passed with no answer.' : it.flag, mark: <Mark kind={it.kind} color={ink(it, wait)} />}))
  return <>
    <Band>
      <Section width={206}><QueueWell v={p.v} set={p.set} w={194} h={146} size="whole" /></Section>
      <Section label="Queue" grow>
        <Readout big label="wait" does="The items that wait for your answer." value={waitingCount(p.v)} tone="accent" />
        {followToggle(p)}
        <Readout label="desktop" does="Whether your computer shows a notice when an item arrives. Refused: allow notices in its settings." value={desktopWord(p.v)} tone={strOf(p.v, 'desktop') === 'refused' ? 'stall' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section width={170}>
        <Rows label={known ? 'Queue' : 'Queue · no reading'} does="The items that wait for you: a square is a proposal, a ring a request, a diamond a review or a recognition. Press a name to choose it."
          items={rows} size={7} selected={picked?.id} onSelect={id => p.set('pick', id)} page={page} onPage={setPage} />
      </Section>
      <Section label="List" width={112}>
        {showChooser(p)}
        <Chooser {...st(p, 'order')} label="Order" does={SAYS.order} value={strOf(p.v, 'order') ?? ''} options={ORDERS} onChange={x => p.set('order', x)} />
      </Section>
      <Section label="Answer" grow>{answers(p, picked)}</Section>
    </Band>
  </>
}

const CRITERION_FILL: Readonly<Record<Criterion['state'], string>> = {satisfied: 'var(--dp-value)', unsatisfied: 'none', indeterminate: 'none'}
/** The review: each success condition a box (filled where met, crossed where not, hollow where open), each claim a box (solid where it carries
 * evidence, dashed where it carries none), and the questions that wait on you. A recognition draws the run's return and whether you
 * recognised it. */
function ReviewWell({item, w, h}: {item: Item | undefined; w: number; h: number}) {
  if (!item) return <Display w={w} h={h} label="Review" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No review waits</text></Display>
  if (item.kind === 'recognition') { const r = item.recognition
    return <Display w={w} h={h} label="The run's return" corner={r?.recognisedAt ? 'recognised' : 'waits'} does="The run's return, and whether you recognised it.">
      <path d={`M${w / 2} 30l14 14l-14 14l-14 -14z`} fill={r?.recognisedAt ? 'var(--dp-value)' : 'none'} stroke="var(--dp-value)" strokeWidth={1.4} />
      <text x={w / 2} y={76} className="dp-ink" textAnchor="middle">{r?.run ?? NONE}</text>
      <text x={w / 2} y={90} className="dp-ink-dim" textAnchor="middle">{r?.course ?? NONE}</text>
      {(r?.summary ?? '').match(/.{1,34}(\s|$)/g)?.slice(0, 3).map((line, i) => <text key={i} x={w / 2} y={108 + i * 11} className="dp-axis" textAnchor="middle">{line.trim()}</text>)}
    </Display> }
  const rv = item.review, rowY = (i: number) => 32 + i * 14
  return <Display w={w} h={h} label="Review" corner={rv ? `${rv.criteria.filter(c => c.state === 'satisfied').length}/${rv.criteria.length} met` : NONE}
    does="Each success condition a box: filled where met, crossed where not, hollow where open. Each claim a box: solid with evidence, dashed without.">
    {!rv ? <text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the review</text> : <>
      <text x={8} y={18} className="dp-axis">conditions</text>
      {rv.criteria.slice(0, 7).map((c, i) => <g key={i} data-i={`${c.text}|${c.state === 'satisfied' ? 'Met.' : c.state === 'unsatisfied' ? 'Not met.' : 'Open.'}`}>
        <rect x={10} y={rowY(i) - 5} width={9} height={9} fill={CRITERION_FILL[c.state]} stroke={c.state === 'unsatisfied' ? 'var(--stall)' : 'var(--dp-value)'} strokeDasharray={c.state === 'indeterminate' ? '2 1.5' : undefined} />
        {c.state === 'unsatisfied' && <path d={`M11 ${rowY(i) - 4}l7 7m0 -7l-7 7`} stroke="var(--stall)" strokeWidth={1.1} />}
      </g>)}
      <text x={w / 2} y={18} className="dp-axis">claims</text>
      {rv.claims.slice(0, 14).map((c, i) => <rect key={i} x={w / 2 + 2 + (i % 7) * 12} y={rowY(Math.floor(i / 7)) - 5} width={9} height={9} data-i={`${c.statement}|${c.evidence ? `${c.evidence} pieces of evidence.` : 'No evidence.'}`}
        fill={c.evidence ? 'var(--dp-value)' : 'none'} stroke="var(--dp-value)" strokeDasharray={c.evidence ? undefined : '2 1.5'} />)}
      <text x={w / 2} y={rowY(3)} className="dp-axis">waits on you</text>
      {rv.requests.slice(0, 7).map((_, i) => <circle key={i} cx={w / 2 + 6 + i * 12} cy={rowY(4) - 1} r={3.4} fill="none" stroke="var(--dp-on)" strokeWidth={1.3} />)}
      {!rv.requests.length && <text x={w / 2 + 2} y={rowY(4) + 2} className="dp-ink-dim">nothing</text>}
    </>}
  </Display>
}

function ReviewBands({p}: {p: ViewProps}) {
  const item = reviewedOf(p.v), rv = item?.review, rg = item?.recognition, [page, setPage] = useState(0)
  const met = rv?.criteria.filter(c => c.state === 'satisfied').length, unmet = rv?.criteria.some(c => c.state === 'unsatisfied')
  const rows: RowItem[] = !item ? [{id: 'none', name: queueOf(p.v) ? 'No review or recognition waits' : 'No reading of the queue', light: 'unknown'}]
    : item.kind === 'recognition' ? [{id: 'ret', name: rg?.summary ?? NONE, light: 'lit', tone: 'value', note: 'return'}]
    : !rv ? [{id: 'none', name: 'No reading of the review', light: 'unknown'}]
    : [...rv.criteria.map((c, i) => ({id: `c${i}`, name: c.text, light: (c.state === 'satisfied' ? 'lit' : 'dark') as LightState, tone: c.state === 'unsatisfied' ? 'stall' as const : 'value' as const,
        note: c.state === 'satisfied' ? 'met' : c.state === 'unsatisfied' ? 'not met' : 'open'})),
      ...rv.claims.map((c, i) => ({id: `k${i}`, name: c.statement, light: (c.evidence ? 'lit' : 'dark') as LightState, tone: 'value' as const, note: c.evidence ? `${c.evidence} evidence` : 'no evidence'})),
      ...rv.requests.map((q, i) => ({id: `q${i}`, name: q, light: 'lit' as LightState, tone: 'accent' as const, note: 'waits on you'}))]
  return <>
    <Band>
      <Section width={206}><ReviewWell item={item} w={194} h={146} /></Section>
      {item?.kind === 'recognition'
        ? <Section label="Recognition" cols={2} grow>
            <Readout label="run" does="The run that returned." value={rg?.run} />
            <Readout label="course" does="The course the run belongs to." value={rg?.course} />
            <Readout label="recognised" does="When you recognised its return, or that it waits for you." value={rg ? rg.recognisedAt ?? 'not yet' : undefined} tone={rg?.recognisedAt ? 'green' : 'accent'} />
            <Readout label="author" does="Who returned it." value={item.who} />
          </Section>
        : <Section label="Review" cols={2} grow>
            <Readout label="intent" does="Across the success conditions: met, not met or open." value={rv ? (rv.criteria.length && met === rv.criteria.length ? 'met' : unmet ? 'not met' : 'open') : undefined}
              tone={rv && rv.criteria.length && met === rv.criteria.length ? 'green' : unmet ? 'stall' : undefined} />
            <Readout label="conditions" does="The conditions met, of all of them." value={rv ? `${met}/${rv.criteria.length}` : undefined} />
            <Readout label="claims" does="The claims that carry evidence, of all the claims. A claim with no evidence draws a dashed box." value={rv ? `${rv.claims.filter(c => c.evidence).length}/${rv.claims.length}` : undefined} />
            <Readout label="requests" does="The questions the run waits on you to answer." value={rv?.requests.length} tone="accent" />
            <Readout label="return" does="The artefacts and the evidence in the attempt's Return." value={rv?.artefacts === undefined ? undefined : `${rv.artefacts} · ${rv.evidence ?? NONE}`} />
            <Readout label="receipt" does="Whether Central has linked a receipt to the Return. A receipt is not your acceptance." value={rv?.receipt === undefined ? undefined : rv.receipt ? 'linked' : 'none'} />
          </Section>}
    </Band>
    <Band>
      <Section grow><Rows label={item ? `${kindWord(item.kind)} · ${item.who ?? NONE}` : 'Review'} does="The conditions, the claims and the questions that wait on you, or the run's return." items={rows} size={7} page={page} onPage={setPage} /></Section>
      <Section label={item?.kind === 'recognition' ? 'Answer' : 'Stand'} width={104}>
        {item?.kind !== 'recognition' && <Action {...st(p, 'collect')} label="Collect" does="Gathers the outputs where the run kept them." onPress={item ? () => p.set('collect', item.id) : undefined} disabled={st(p, 'collect').disabled ?? (item ? undefined : 'No review waits.')} />}
        {answers(p, item)}
      </Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- the pane: the queue and the item chosen

/** A button on the item's detail: it sets its own key to the item's id, and stands as the host says for that key. */
const paneButton = (p: ViewProps, item: Item, key: string, label: string, does: string) => {
  const s = st(p, key), why = s.disabled ?? (item.denied ? 'Its owner declined it already.' : undefined)
  return <button type="button" key={key} disabled={!!why} data-pending={s.pending || undefined} onClick={() => p.set(key, item.id)}
    data-i={`${label}|${[does, why].filter(Boolean).join(' ')}`}>{label}</button>
}

function ApprovalsPane({p}: {p: ViewProps}) {
  const v = p.v, list = listOf(v), wait = numOf(v, 'wait'), item = pickedOf(v, list)
  const left = item?.kind === 'request' && item.age !== undefined && wait !== undefined ? wait - item.age : undefined
  return <div className="ap-pane">
    <div className="ap-pane-head" aria-label="Approvals">
      <b>Approvals</b><span>{countText(v)}</span><span>show {shown(v, 'show')}</span><span>order {shown(v, 'order')}</span>
    </div>
    <div className="ap-lake" aria-label="The queue as a lake"><QueueWell v={v} set={p.set} w={Math.max(420, (p.room?.w ?? 760) - 20)} h={104} size="whole" /></div>
    <div className="ap-body">
      <div className="ap-list" role="table" aria-label="Queue">
        <div className="ap-line ap-line--head" role="row"><span /><span>Author</span><span>About</span><span>Came</span><span>Flag</span></div>
        {list === undefined && <p className="ap-empty">No reading of the queue.</p>}
        {list && list.length === 0 && <p className="ap-empty">Nothing waits.</p>}
        {(list ?? []).map(it => <button key={it.id} type="button" role="row" className="ap-line" aria-pressed={it.id === item?.id} data-state={it.denied ? 'denied' : isPast(it, wait) || it.urgent ? 'past' : undefined}
          onClick={() => p.set('pick', it.id)} data-i={`${itemName(it)}|${kindWord(it.kind)}: ${it.text || NONE}`}>
          <Mark kind={it.kind} color={ink(it, wait)} /><span className="ap-who">{it.who ?? NONE}</span><span className="ap-text">{it.text || NONE}</span>
          <span className="ap-age">{it.denied ? 'declined' : `${ageText(it)} ago`}</span><span className="ap-flag">{it.urgent ? 'urgent' : it.flag ?? ''}</span>
        </button>)}
      </div>
      <div className="ap-detail">
        {item === undefined && <p className="ap-empty">{list === undefined ? 'No reading of the queue.' : 'Nothing to read.'}</p>}
        {item !== undefined && <>
          <div className="ap-detail-head"><Mark kind={item.kind} color={ink(item, wait)} /><b>{item.who ?? NONE}</b><span>{kindWord(item.kind)}</span>{item.session && <span>{item.session}</span>}</div>
          <div className="ap-detail-sub">
            {item.denied ? `declined${item.by ? ` · ${item.by}` : ''}` : left === undefined ? `waited ${ageText(item)}` : left >= 0 ? `waited ${ageText(item)} · the Agent's Wait ends in ${spanText(left)}` : `waited ${ageText(item)} · the Agent's Wait passed ${spanText(-left)} ago`}
          </div>
          <p className="ap-what">{item.text || NONE}</p>
          {item.kind === 'request' && item.where && <pre className="ap-cmd" aria-label="What it asks">{item.where}</pre>}
          {item.kind === 'request' && <p className="ap-note" data-flagged={item.flag || item.urgent ? 'true' : undefined}>{item.urgent ? 'Urgent.' : item.flag ? `Flagged: ${item.flag}.` : 'Not flagged.'}</p>}
          {item.kind === 'proposal' && <pre className="ap-diff" aria-label="Diff">
            {item.diff === undefined ? 'No reading of the diff.' : item.diff.map((line, n) => <span key={n} data-d={line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : undefined}>{line || ' '}{'\n'}</span>)}
          </pre>}
          {item.kind === 'review' && (item.review ? <ul className="ap-review">
            {item.review.criteria.map((c, i) => <li key={`c${i}`} data-state={c.state}>{c.text}<span>{c.state === 'satisfied' ? 'met' : c.state === 'unsatisfied' ? 'not met' : 'open'}</span></li>)}
            {item.review.claims.map((c, i) => <li key={`k${i}`} data-state={c.evidence ? 'satisfied' : 'indeterminate'}>{c.statement}<span>{c.evidence ? `${c.evidence} evidence` : 'no evidence'}</span></li>)}
          </ul> : <p className="ap-note">No reading of the review.</p>)}
          {item.kind === 'recognition' && <p className="ap-note">{item.recognition?.summary ?? 'No reading of the return.'}</p>}
          {item.kind === undefined && <p className="ap-note">The kind of this item is not read.</p>}
          <div className="ap-do">
            {item.kind === 'request' ? <>
              {paneButton(p, item, 'allowOnce', 'Approve', 'Approves the request.')}
              {paneButton(p, item, 'deny', 'Deny', 'Declines the request. Its author is told.')}
              {paneButton(p, item, 'open', 'Open', 'Opens it where it belongs.')}
            </> : item.kind === 'proposal' ? <>
              {paneButton(p, item, 'approve', 'Approve', 'The change lands, with a receipt.')}
              {paneButton(p, item, 'changes', 'Changes', 'Asks for a different result. Say what to change in the thread.')}
              {paneButton(p, item, 'reject', 'Deny', 'Declines the change. Nothing lands.')}
            </> : item.kind === 'review' ? <>
              {paneButton(p, item, 'collect', 'Collect', 'Gathers the outputs where the run kept them.')}
              {paneButton(p, item, 'reviewChanges', 'Changes', 'Asks for another attempt.')}
            </> : item.kind === 'recognition' ? <>
              {paneButton(p, item, 'recognise', 'Recognise', 'Your word that the return is what the commission asked for.')}
              {paneButton(p, item, 'continue', 'Continue', 'A new run continues the same course.')}
            </> : null}
          </div>
        </>}
      </div>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

/** The sample material of the gallery's fixtures: the work of Flint and Kite on the Thread's sessions, an owner's urgent request, an attempt
 * you chose to stand and a run that returned. The views never read these: the owner's list arrives on `queue`. */
const REVIEW = {criteria: [{text: 'The three roots type-check', state: 'satisfied'}, {text: 'The device gate passes', state: 'satisfied'}, {text: 'The gallery draws every design', state: 'indeterminate'}],
  claims: [{statement: 'tsc exits 0 on the shell root', evidence: 2}, {statement: 'devices:validate passes', evidence: 1}, {statement: 'Every absent reading draws as a dash', evidence: 0}],
  requests: [{question: 'Keep the old Wait dial on the Agent?'}], artefacts: 3, evidence: 3, receipt: true, outputs: 2}
const sampleQueue = (declined?: boolean) => JSON.stringify([
  {id: 'req:tsc', kind: 'request', who: 'Flint', where: 'tsc --noEmit -p packages/live-shell/ui', text: 'Run the type-check on the shell root', session: 'tsc roots', age: 80},
  {id: 'prop:model', kind: 'proposal', who: 'Flint', where: 'agentParamAddresses.ts', text: 'Add the model row to the agent device', session: 'tsc roots', age: 150,
    diff: ['@@ AGENT_SHELL_ADDRESS_TABLE', "+  reading('actuation', 'agent', 'model', 'string', {disclosure: 'No shell writer yet.'}),"]},
  {id: 'prop:setModel', kind: 'proposal', who: 'Kite', where: 'agentParamAddresses.ts', text: "Name shell.setModel as the model row's write path", session: 'model row', age: 240,
    diff: ['@@ AGENT_SHELL_ADDRESS_TABLE', "-  reading('actuation', 'agent', 'model', 'string', {disclosure: 'No shell writer yet.'}),",
      "+  agentParamAddress({family: 'actuation', deviceInstance: 'agent', key: 'model', type: 'string', writePath: 'shell.setModel'}),"]},
  {id: 'req:deploy', kind: 'request', who: 'Workcell', where: 'deploy dlw-site to production', text: 'A deploy only you can allow', age: 900, urgent: true},
  {id: 'rev:attempt-3', kind: 'review', who: 'Flint', where: 'attempt 3', text: 'The attempt you chose to stand for the device reconcile', session: 'dlw reconcile', age: 1800, review: REVIEW},
  {id: 'rcg:run-12', kind: 'recognition', who: 'Factory', where: 'Run 12', text: 'Run 12 returned', age: 5400,
    recognition: {run: 'Run 12', course: 'The DLW catalogue', summary: 'Every device of the first half draws what its manual entry says.'}},
  {id: 'req:rm', kind: 'request', who: 'Kite', where: 'rm -rf desktop/cradle/expressions-app/dist', text: 'Delete the app\'s build output', session: 'app root', age: 20000, flag: 'recursive delete',
    ...(declined ? {state: 'denied', by: 'no answer'} : {})},
])

export const design: DesignedDevice = {
  id: 'software-factory:approvals',
  title: 'Approvals',
  kind: 'effect',
  firstPage: 'queue',
  defaults: {light: 'lit', show: 'all', order: 'oldest', follow: true, desktop: 'shown', wait: 14400, noAnswer: 'hold', messages: 2, queue: sampleQueue(), pick: 'prop:setModel'},
  fixtures: {
    'Seven wait': {},
    'A review chosen': {pick: 'rev:attempt-3'},
    'A run returned': {pick: 'rcg:run-12'},
    'Urgent only': {show: 'urgent', pick: 'req:deploy'},
    'Declined when nobody answered': {noAnswer: 'deny', queue: sampleQueue(true), pick: 'req:rm', desktop: 'refused'},
    'No readings': Object.fromEntries(['light', 'show', 'order', 'follow', 'desktop', 'wait', 'noAnswer', 'messages', 'queue', 'pick'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Approvals" light={lightOf(p)} readings={[countText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Approvals" view="compact" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <QueueWell v={p.v} set={p.set} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" width={112}>
      {showChooser(p)}
      {orderRadio(p)}
    </Section>
  </Panel>,

  whole: p => {
    const page = p.page === 'review' ? 'review' : 'queue', reviewed = reviewedOf(p.v)
    return <Panel title="Approvals" view="whole" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full} page={page} onPage={p.setPage}
      pages={[{id: 'queue', label: 'Queue'}, {id: 'review', label: 'Review', light: (queueOf(p.v) === undefined ? undefined : reviewed ? 'dark' : 'lit') as LightState | undefined}]}>
      {page === 'review' ? <ReviewBands p={p} /> : <QueueBands p={p} />}
    </Panel>
  },

  full: p => <ApprovalsPane p={p} />,

  widget: p => {
    const list = listOf(p.v), wait = numOf(p.v, 'wait'), cards = (list ?? []).filter(i => !i.denied).slice(0, 2), messages = numOf(p.v, 'messages')
    return <Tile title="Approvals" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <QueueWell v={p.v} w={76} h={100} size="mini" />
      <div className="ap-cards">
        {list === undefined && <p className="ap-empty">No reading of the queue.</p>}
        {list !== undefined && cards.length === 0 && <p className="ap-empty">Nothing waits.</p>}
        {cards.map(it => <div key={it.id} className="ap-card" data-state={isPast(it, wait) || it.urgent ? 'past' : undefined} data-i={`${itemName(it)}|${kindWord(it.kind)}: ${it.text || NONE}`}>
          <div className="ap-card-line"><Mark kind={it.kind} color={ink(it, wait)} /><b>{it.who ?? NONE}</b><span>{it.text || NONE}</span></div>
          <div className="ap-card-do">{answers(p, it, true)}</div>
        </div>)}
        <p className="ap-foot" data-i="Messages|The agents that wait for you in Messages.">{messages === undefined ? NONE : `${messages} wait in Messages`}</p>
      </div>
    </Tile>
  },
}
