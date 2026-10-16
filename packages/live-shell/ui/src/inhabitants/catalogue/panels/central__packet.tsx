// The Packet (manual §18.3; its widget §23.12): what an agent reads from you, gathered from documents and shown whole, with its size,
// before anything is sent. Live's nearest: Limiter — a level meter with a ceiling that you drag, here over a list of items.
// The owner of the list is AIKit's prepared context (aikit.prepared-context/v1, read through desktop/cradle/src/context/nativeContext.ts):
// read, add a selection, remove one, clear, and send it with the reviewed packet (the send empties it). The owner discloses no token
// count, so the size is the characters of the selected text, as the Packet widget and the transport's Key slot show it
// (widgets/PacketWidget.tsx packetRows, shell/transports/transportReadings.ts packetReadouts). The owner holds at most 32 items
// (nativeContext.ts assertPreparedContext) and 1 MiB (ai-kit crates/aikit-store/src/encounter_context.rs).
// The picture is the packet by its own law: a meter of characters (each step to the right is ten times more), the items laid along it
// in order, and the Limit as the ceiling. An item that does not fit under the Limit waits, drawn dashed past the ceiling.
//
// Everything the packet holds is a value. `packet` is a JSON list of items, the same key and shape as the Document device's
// (panels/central__document.tsx): {entry, scope, text}, with three optional fields that the Document ignores: `by` (the entry's
// author, C or F), `chars` (the size of the whole entry when `text` is only how it opens) and `stale` (the item's source moved).
// `flow` is the name of the Flow the packet is gathered from. The other readings: `scope` (session, or project when no Agent
// conversation stands), `question` (written, or none, in the Agent's composer), `selection` (a passage stands selected on the page),
// `hasPage` (the selection's journal page can be captured whole) and `sent` (the head of the last send). The parameters are `add`,
// `limit` and `keep`; `rowsPage` is the page of the list. A key the owner does not report is absent, and the view draws "—" for it,
// naming the missing reading in the well. The sample readings in `defaults` are the Factory flow of Control/user/flows
// (flow-2026-10-03-1432.html) and a packet of three items, the same three the Document device holds, so both say "3 items · 106 chars"
// as central/documentPayload.ts packetHead does.
// The actions set their own keys: `capture`, `clear`, `answer`, and `takeOut` (the id of the item to take out).
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, toUnit, type LightState, type RowItem, type Scale, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__packet.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Kind = 'selection' | 'entry' | 'page'

/** The owner's cap: at most 32 items in a prepared context. */
const CAP = 32
/** The meter, in characters. Each step to the right is ten times more. */
const AXIS: Scale = {min: 10, max: 1_000_000, log: true}
/** The Limit, in characters. Off sits at the top: only the owner's own cap stands. */
const LIMIT: Scale = {min: 1000, max: 1_000_000, log: true}
const OFF = LIMIT.max
const STALE_WHY = 'The source revision changed. Reselect it or review the captured snapshot.'

const ADDS = [
  {value: 'selection', label: 'Selection', does: 'Capture takes the passage that you selected.'},
  {value: 'entry', label: 'Entry', does: 'Capture takes the whole entry that holds the selection.'},
  {value: 'page', label: 'Page', does: 'Capture takes the whole journal page that holds the selection.'},
] as const

// ---------------------------------------------------------------- what the packet holds, from the values

const chars = (text: string) => [...text].length
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const limitText = (x: number) => (x >= OFF ? 'Off' : x >= 10_000 ? `${Math.round(x / 1000)}k` : x >= 1000 ? `${(x / 1000).toFixed(1)}k` : `${Math.round(x)}`)
/** A reading that is a finite number, or undefined when it is absent or not a number. */
const numeric = (v: V, key: string): number | undefined => { const x = numOf(v, key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const limitWords = (v: V) => { const x = numeric(v, 'limit'); return x === undefined ? NONE : limitText(x) }
const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)

interface Item {
  /** Its place in the list and its entry: what a take-out names. */
  readonly id: string
  readonly entry: number
  /** `C` (the coordinator) or `F` (the person), when the owner says who wrote the entry. */
  readonly by: string | undefined
  readonly kind: Kind
  /** The scope it was added under, in the owner's words. */
  readonly scope: string
  readonly text: string
  readonly chars: number
  /** Its source moved after it was captured. */
  readonly stale: boolean
}
const kindOfScope = (scope: string): Kind => (/page/i.test(scope) ? 'page' : /entry/i.test(scope) ? 'entry' : 'selection')
function itemOf(x: unknown, at: number): Item | undefined {
  if (!obj(x) || typeof x.entry !== 'number' || typeof x.scope !== 'string' || typeof x.text !== 'string') return undefined
  const size = typeof x.chars === 'number' && Number.isFinite(x.chars) && x.chars >= 0 ? Math.round(x.chars) : chars(x.text)
  return {id: `${at}:${x.entry}`, entry: x.entry, by: typeof x.by === 'string' && x.by ? x.by : undefined, kind: kindOfScope(x.scope), scope: x.scope, text: x.text, chars: size, stale: x.stale === true}
}
/** The packet's items, in order; undefined when the owner reports no list (a member that is not an item is left out). */
function itemsOf(v: V): readonly Item[] | undefined {
  const raw = json<unknown>(v, 'packet', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((x, at) => { const item = itemOf(x, at); return item ? [item] : [] })
}
const labelOf = (i: Item) => `entry ${i.entry}${i.by ? ` (${i.by})` : ''}`
const KIND_WORD: Record<Kind, string> = {selection: 'a selection', entry: 'a whole entry', page: 'a whole page'}

interface Fit {
  readonly items: readonly Item[]
  readonly inn: readonly Item[]
  readonly wait: readonly Item[]
  readonly total: number
  /** The Limit, in characters; undefined when it is not reported (then nothing waits). */
  readonly limit: number | undefined
  readonly off: boolean
}
/** What fits under the Limit, in the order added. An item that would pass it waits. Undefined without a reading of the packet. */
function fit(v: V): Fit | undefined {
  const items = itemsOf(v)
  if (!items) return undefined
  const limit = numeric(v, 'limit'), off = limit !== undefined && limit >= OFF
  const inn: Item[] = [], wait: Item[] = []
  let total = 0
  for (const item of items) {
    if (limit === undefined || off || total + item.chars <= limit) { inn.push(item); total += item.chars } else wait.push(item)
  }
  return {items, inn, wait, total, limit, off}
}
/** By how many characters a waiting item passes the Limit. */
const overBy = (f: Fit, item: Item) => (f.limit === undefined ? undefined : f.total + item.chars - f.limit)
const headWords = (n: number, total: number) => `${plural(n, 'item')} · ${total} chars`
/** The items in the order drawn: those in the packet, then those that wait. */
const placed = (f: Fit | undefined) => (f ? [...f.inn.map(item => ({item, waits: false})), ...f.wait.map(item => ({item, waits: true}))] : [])

/** The standing of an action's key, with the reason that the packet's own state gives when the host gives none. */
const act = (p: ViewProps, key: string, own?: string): Standing => {
  const s = st(p, key)
  return s.disabled === undefined && own !== undefined ? {...s, disabled: own} : s
}
const takeOut = (p: ViewProps, id: string) => p.set('takeOut', id)
/** Why Capture cannot press now; undefined when it can. */
function captureRefusal(v: V): string | undefined {
  const add = strOf(v, 'add')
  if (add === undefined) return 'No reading of what Capture takes.'
  if (add === 'page') {
    const page = boolOf(v, 'hasPage')
    if (page === undefined) return 'No reading of the journal page.'
    if (!page) return 'This Flow holds no journal page.'
  }
  const selected = boolOf(v, 'selection')
  if (selected === undefined) return 'No reading of the selection.'
  return selected ? undefined : 'Nothing is selected.'
}
/** Why Clear now cannot press now; undefined when it can. */
function clearRefusal(v: V): string | undefined {
  const f = fit(v)
  return !f ? 'No reading of the packet.' : f.items.length ? undefined : 'The packet is empty.'
}
/** Why Answer this cannot press now, in the owners' words (widgets/PacketWidget.tsx answerRefusal); undefined when it can. */
function answerRefusal(v: V): string | undefined {
  const f = fit(v), scope = strOf(v, 'scope')
  if (!f) return 'No reading of the packet.'
  if (scope === undefined) return 'No reading of where the packet goes.'
  if (scope === 'project') return 'No Agent conversation stands, so nothing receives the packet yet.'
  if (!f.inn.length) return 'The packet is empty: put a selection in it first.'
  const question = strOf(v, 'question')
  if (question === undefined) return "No reading of the Agent's composer."
  if (question !== 'written') return "Write the question in the Agent's composer: Answer this sends it with exactly this packet."
  if (f.inn.some(i => i.stale)) return STALE_WHY
  return undefined
}

// ---------------------------------------------------------------- the display: the meter, and the items along it

const GLYPH: Record<Kind, string> = {
  selection: 'M3 1.5H1.5V8.5H3M7 1.5H8.5V8.5H7M3.5 5H6.5',
  entry: 'M1.5 1.5H8.5V8.5H1.5ZM3 4H7M3 6.5H7',
  page: 'M2 1H6L8 3V9H2ZM6 1V3H8',
}
type MarkState = 'in' | 'wait' | 'review'
const TONE: Record<MarkState, string> = {in: 'var(--dp-value)', wait: 'var(--text-faint)', review: 'var(--stall)'}

/** An item's kind mark: a passage in brackets, a whole entry, a page. Teal in the packet, dim when it waits, orange when its source moved. */
function Mark({kind, state}: {kind: Kind; state: MarkState}) {
  return <svg className="cpk-mark" viewBox="0 0 10 10" width={12} height={12} role="img" aria-label={kind} data-state={state}>
    <path d={GLYPH[kind]} fill="none" stroke="currentColor" strokeWidth={1} />
  </svg>
}

const sig2 = (x: number) => { const step = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / step) * step }

function Picture({v, set, why, w, h, tile}: {v: V; set?: SetFn; why?: string; w: number; h: number; tile?: boolean}) {
  const pk = fit(v), inn = pk?.inn ?? [], wait = pk?.wait ?? [], total = pk?.total ?? 0
  const limit = numeric(v, 'limit'), off = limit !== undefined && limit >= OFF
  const x0 = 8, x1 = w - 12, span = x1 - x0
  const at = (c: number) => x0 + toUnit(AXIS, Math.max(AXIS.min, c)) * span
  const my = tile ? 10 : 24, bh = 10, ty = my + bh + 11, top = ty + 7, pitch = tile ? 12 : 14
  const room = Math.max(1, Math.floor((h - top - 4) / pitch))
  const all = placed(pk)
  const drawn = all.length > room ? all.slice(0, room - 1) : all
  const hx = limit === undefined ? undefined : at(off ? OFF : limit)
  const limitAt = (x: number) => {
    const c = AXIS.min * Math.pow(AXIS.max / AXIS.min, clampTo(0, 1, (x - x0) / span))
    return c >= LIMIT.max * .93 ? OFF : sig2(Math.max(LIMIT.min, c))
  }
  let run = 0
  const waitEnd = Math.min(x1, at(total + wait.reduce((n, i) => n + i.chars, 0)))
  const bx = x0 + 15
  const sent = strOf(v, 'sent')
  const noPacket = w < 130 ? ['No reading', 'of the packet'] : ['No reading of the packet']
  return <g>
    {!tile && <text x={x0} y={12} className="dp-ink-dim">{w > 160 ? `Packet · ${pk ? headWords(inn.length, total) : NONE}` : pk ? `${plural(inn.length, 'item')} · ${total} ch` : `${NONE} items · ${NONE} ch`}</text>}
    <rect x={x0} y={my} width={span} height={bh} className="dp-faint" />
    {inn.map((item, k) => {
      const a = at(run), b = at(run + item.chars)
      run += item.chars
      return <rect key={`${item.id}`} x={a} y={my} width={Math.max(1, b - a - 1)} height={bh} fill={item.stale ? 'var(--stall)' : 'var(--dp-value)'} opacity={k % 2 ? .5 : .8} />
    })}
    {wait.length > 0 && waitEnd > at(total) && <rect x={at(total)} y={my} width={waitEnd - at(total)} height={bh} fill="none" stroke="var(--stall)" strokeDasharray="2 2" />}
    {[100, 1000, 10_000, 100_000].map(c => <g key={c}>
      <path d={`M${at(c)} ${my + bh}v3`} className="dp-faint" />
      {(!tile || c === 100 || c === 10_000) && <text x={at(c)} y={ty} className="dp-axis" textAnchor="middle">{c >= 1000 ? `${c / 1000}k` : c}</text>}
    </g>)}
    {hx !== undefined && (!tile || !off) && <path d={`M${hx} ${my - 5}V${my + bh + 5}`} className="dp-curve-on" />}
    {hx !== undefined && !tile && <Handle n={1} x={hx} y={my + bh / 2} label="Limit"
      does={`Drag along the meter: the size at which the packet stops. Drag to the right end for Off.${why ? ` ${why}` : ''}`}
      onDrag={set && (x => set('limit', limitAt(x)))} onReset={set && (() => set('limit', OFF))} />}
    {drawn.map(({item, waits}, k) => {
      const cy = top + k * pitch + pitch / 2
      const state: MarkState = waits ? 'wait' : item.stale ? 'review' : 'in'
      const len = Math.max(2, toUnit(AXIS, Math.max(AXIS.min, item.chars)) * (x1 - bx) * .8)
      const words = `${tile ? '' : `${labelOf(item)}${state === 'review' ? ' !' : ''}  `}${item.chars}`
      const inside = bx + len + 6 + words.length * 4 > w - 2
      return <g key={`${item.id}`}>
        <g transform={`translate(${x0} ${cy - 6}) scale(1.2)`}><path d={GLYPH[item.kind]} fill="none" stroke={TONE[state]} strokeWidth={.9} /></g>
        <rect x={bx} y={cy - 4} width={len} height={8} fill={waits ? 'none' : TONE[state]} fillOpacity={.28} stroke={TONE[state]} strokeDasharray={waits ? '2 2' : undefined} />
        <text x={inside ? bx + 3 : bx + len + 5} y={cy + 3} className="dp-ink"
          style={{fontSize: 8, fontVariantNumeric: 'tabular-nums', fill: waits ? 'var(--text-dim)' : undefined}}>{words}</text>
      </g>
    })}
    {all.length > drawn.length && <text x={x0} y={top + drawn.length * pitch + pitch / 2 + 3} className="dp-axis">+{all.length - drawn.length} more</text>}
    {pk && all.length === 0 && (sent ? (w < 130 ? ['Sent', sent] : [`Sent ${sent}`]) : ['Nothing in the packet']).map((line, i) =>
      <text key={line} x={x0} y={top + 12 + i * 11} className="dp-ink-dim">{line}</text>)}
    {!pk && noPacket.map((line, i) => <text key={line} x={x0} y={top + 12 + i * 11} className="dp-ink-dim">{line}</text>)}
  </g>
}

// ---------------------------------------------------------------- the controls

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
/** The well's handle drags the Limit unless the host says the Limit cannot be set. */
const limitSet = (p: ViewProps) => (st(p, 'limit').disabled ? undefined : p.set)

const AddRadio = ({p}: {p: ViewProps}) =>
  <Radio {...st(p, 'add')} label="Add" does="What Capture takes from the page: the selection, its whole entry, or its whole journal page." value={strOf(p.v, 'add') ?? ''} options={ADDS} stack onChange={x => p.set('add', x)} />
const LimitBox = ({p}: {p: ViewProps}) =>
  <ValueBox {...st(p, 'limit')} label="Limit" does="Stops the packet at this many characters. An item that does not fit waits. Off leaves only the owner's cap of 32 items."
    value={numeric(p.v, 'limit') ?? NaN} def={OFF} scale={LIMIT} format={limitText} onChange={x => p.set('limit', x)} />
const KeepToggle = ({p}: {p: ViewProps}) => {
  const now = boolOf(p.v, 'keep')
  return <Toggle {...st(p, 'keep')} label="Keep" does="Keep the packet after you send it, to ask again with the same material. Off empties it when you send." on={now === true} unknown={now === undefined} onChange={x => p.set('keep', x)} />
}
const CaptureAction = ({p}: {p: ViewProps}) =>
  <Action {...act(p, 'capture', captureRefusal(p.v))} label="Capture" does="Add the selection to the packet, as Add sets. Nothing is sent." onPress={() => p.set('capture', true)} />
const ClearNow = ({p}: {p: ViewProps}) =>
  <Action {...act(p, 'clear', clearRefusal(p.v))} label="Clear now" does="Take every item out of the packet." onPress={() => p.set('clear', true)} />
const AnswerThis = ({p}: {p: ViewProps}) =>
  <Action {...act(p, 'answer', answerRefusal(p.v))} label="Answer this" does="Send your question with exactly this packet. The answer arrives as an entry." onPress={() => p.set('answer', true)} />

function rowsOf(v: V, takeWhy: string | undefined): RowItem[] {
  const pk = fit(v)
  if (!pk) return [{id: 'none', name: 'No reading of the packet', light: 'unknown'}]
  const rows = placed(pk)
  if (!rows.length) return [{id: 'none', name: 'Nothing in the packet', light: 'unknown'}]
  return rows.map(({item, waits}) => {
    const review = !waits && item.stale, by = overBy(pk, item)
    return {
      id: item.id, name: labelOf(item), ...(takeWhy ? {} : {request: true}), light: waits || review ? 'dark' : 'lit', tone: 'value',
      mark: <Mark kind={item.kind} state={waits ? 'wait' : review ? 'review' : 'in'} />, note: `${item.chars}`,
      why: waits ? (by === undefined ? 'Passes the Limit.' : `Passes the Limit by ${by} characters.`) : review ? STALE_WHY : undefined,
      does: `Added as ${KIND_WORD[item.kind]}: ${item.text.slice(0, 60)}${item.text.length > 60 ? '…' : ''}${takeWhy ? ` ${takeWhy}` : ''}`,
    }
  })
}

// ---------------------------------------------------------------- the pane: the packet in full

function Pane({p}: {p: ViewProps}) {
  const pk = fit(p.v), rows = placed(pk), take = st(p, 'takeOut'), sent = strOf(p.v, 'sent'), scope = strOf(p.v, 'scope')
  return <div className="ref-pane-body cpk-pane">
    <div className="ref-pane-tabs" role="tablist" aria-label="Packet">
      <button type="button" role="tab" aria-selected="true">Packet · {pk ? plural(pk.inn.length, 'item') : NONE}</button>
    </div>
    <div className="cpk-sheet">
      <header className="cpk-head">
        <h3>Packet <small>{shown(p.v, 'flow')}</small></h3>
        <p>Exactly what the agent will read. Nothing else of yours goes with it.</p>
      </header>
      <div className="cpk-body">
        {!pk
        ? <p className="cpk-empty">No reading of the packet.</p>
        : rows.length === 0
        ? <p className="cpk-empty">{sent ? `Sent ${sent}. The packet is empty.` : 'Nothing in the packet yet. Select a passage, then press Capture.'}</p>
        : <ol className="cpk-list">
          {rows.map(({item, waits}) => {
            const review = !waits && item.stale, state: MarkState = waits ? 'wait' : review ? 'review' : 'in', by = overBy(pk, item)
            return <li key={item.id} className="cpk-item" data-state={state}>
              <div className="cpk-meta">
                <Mark kind={item.kind} state={state} />
                <b>{labelOf(item)}</b>
                <span>{item.scope}</span>
                <span className="cpk-size">{item.chars} chars</span>
                <button type="button" className="cpk-x" aria-label={`Take ${labelOf(item)} out of the packet`} data-i={`Take out|${take.disabled ?? 'Take this item out of the packet.'}`}
                  disabled={!!take.disabled} onClick={() => takeOut(p, item.id)}>×</button>
              </div>
              <p className="cpk-text">{item.text}{item.kind === 'entry' && item.chars > item.text.length ? ' …' : ''}</p>
              {waits && <p className="cpk-note">Waits. {by === undefined ? '' : `It passes the Limit by ${by} characters. `}Take it out, or raise the Limit.</p>}
              {review && <p className="cpk-note">{STALE_WHY}</p>}
            </li>
          })}
        </ol>}
      </div>
      <footer className="cpk-foot">
        <span><b>{pk ? pk.total : NONE}</b> characters</span>
        <span><b>{pk ? pk.inn.length : NONE}</b> of {CAP} items</span>
        <span>Limit <b>{limitWords(p.v)}</b></span>
        <span>For the <b>{scope === undefined ? NONE : scope === 'project' ? 'project' : 'conversation'}</b></span>
      </footer>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const defaults = {
  light: 'lit', add: 'selection', limit: OFF, keep: false,
  // Readings and the state of the packet: what the owner reports. The packet's items are the words the agent would read, as the
  // Document device holds them (ql-flow.html `D.packet`), each with the author of its entry.
  flow: 'Factory original development Run',
  packet: JSON.stringify([
    {entry: 3, scope: 'selection', by: 'C', text: 'The original development Run remains incomplete'},
    {entry: 6, scope: 'whole entry', by: 'C', text: 'The original Run remains incomplete'},
    {entry: 9, scope: 'selection', by: 'F', text: 'Which unit starts first?'},
  ]),
  scope: 'session', question: 'written', selection: true, hasPage: false, sent: '', rowsPage: 0,
} as const

/** The packet of the default fixture, as a list to lay other items over. */
const sample = (): Record<string, unknown>[] => JSON.parse(defaults.packet)

export const design: DesignedDevice = {
  id: 'central:packet',
  title: 'Packet',
  kind: 'effect',
  defaults,
  fixtures: {
    'Factory flow': {},
    // A whole entry of 1343 characters, captured after the three: past a Limit of 1.0k it waits (ql-flow.html entry 4).
    'Over the limit': {
      limit: 1000,
      packet: JSON.stringify([...sample(), {entry: 4, scope: 'whole entry', by: 'C', chars: 1343,
        text: 'The requested two-machine development Run remains incomplete. The latest native owner reading at 17:57 UTC retained seven required units and no worker attempts or completed legs. A startup failure has not been counted as a worker result.'}]),
    },
    'Source moved': {packet: JSON.stringify(sample().map(item => (item.entry === 6 ? {...item, stale: true} : item)))},
    // Sent with Keep off: the packet is empty, and the send is the one reading left of it.
    Sent: {packet: JSON.stringify([]), question: 'none', sent: '3 items · 106 chars'},
    'No readings': Object.fromEntries(Object.keys(defaults).map(key => [key, undefined])),
  },

  folded: p => {
    const pk = fit(p.v)
    return <Folded title="Packet" light={light(p)} readings={[pk ? plural(pk.inn.length, 'item') : `${NONE} items`, `${pk ? pk.total : NONE} ch`]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Packet" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The packet" does="The packet's size on a meter of characters, and its items along it. Drag handle 1 to set the Limit." corner={`limit ${limitWords(p.v)}`}>
        <Picture v={p.v} set={limitSet(p)} why={st(p, 'limit').disabled} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <AddRadio p={p} />
      <LimitBox p={p} />
      <KeepToggle p={p} />
      <ClearNow p={p} />
    </Section>
  </Panel>,

  whole: p => {
    const pk = fit(p.v), limit = numeric(p.v, 'limit'), question = strOf(p.v, 'question')
    const room = pk && limit !== undefined ? (pk.off ? 'no limit' : Math.max(0, limit - pk.total)) : undefined
    const waiting = pk && limit !== undefined ? pk.wait.length : undefined
    return <Panel title="Packet" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The packet" does="The packet's size on a meter of characters, and its items along it. Drag handle 1 to set the Limit." corner={`limit ${limitWords(p.v)}`}>
            <Picture v={p.v} set={limitSet(p)} why={st(p, 'limit').disabled} w={194} h={146} />
          </Display>
        </Section>
        <Section label="Add" width={74}>
          <AddRadio p={p} />
          <CaptureAction p={p} />
        </Section>
        <Section label="Limit" cols={2} grow>
          <Dial {...st(p, 'limit')} label="Limit" does="Stops the packet at this many characters. An item that does not fit waits. Off leaves only the owner's cap of 32 items."
            value={limit ?? NaN} def={OFF} scale={LIMIT} format={limitText} onChange={x => p.set('limit', x)} />
          <Readout label="room" does="Characters that still fit under the Limit." value={room} tone="value" />
          <Readout label="waiting" does="Items that pass the Limit. Each waits until you take it out or raise the Limit." value={waiting} tone={waiting ? 'stall' : undefined} />
        </Section>
      </Band>
      <Band>
        <Section label="Items" width={172}>
          <Rows does="Exactly what the agent receives. Press a square to take an item out." items={rowsOf(p.v, st(p, 'takeOut').disabled)} size={6} page={numeric(p.v, 'rowsPage') ?? 0}
            onPage={n => p.set('rowsPage', n)} onRequest={(id, now) => { if (!now) takeOut(p, id) }} />
        </Section>
        <Section label="Packet" width={62}>
          <Readout label="items" does={`Items that the agent will read. The owner holds at most ${CAP}.`} value={pk?.inn.length} tone="value" />
          <Readout label="size" does="The size of the text that the agent will read, in characters. The owner reports no token count." value={pk?.total} tone="value" />
          <Readout label="scope" does="Who receives the packet: the conversation, or the project when no conversation stands." value={strOf(p.v, 'scope')} />
        </Section>
        <Section label="Send" cols={2} grow>
          <KeepToggle p={p} />
          <Readout label="question" does="Whether your question stands in the agent's composer." value={question === undefined ? undefined : question === 'written' ? 'written' : 'none'} tone={question === 'written' ? 'green' : undefined} />
          <ClearNow p={p} />
          <AnswerThis p={p} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const pk = fit(p.v)
    return <Tile title="Packet" light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={112} h={104} label="The packet" does="The packet on its meter, with its first items. Click it to open the packet.">
        <Picture v={p.v} w={112} h={104} tile />
      </Display>
      <div className="ref-tile-side">
        <Readout big label="items" does="Items that the agent will read. Press to open the packet." value={pk?.inn.length} tone="value" onPress={p.nav.full} />
        <Readout label="size" does="The size of the text that the agent will read, in characters." value={pk?.total} />
        <AnswerThis p={p} />
      </div>
    </Tile>
  },
}
