// The Packet (manual §18.9; its widget §23.12): what an agent reads from you, gathered from documents and shown whole, with its size,
// before anything is sent. Live's nearest: Limiter — a level meter with a ceiling that you drag, here over a list of items.
// The owner of the list is AIKit's prepared context (aikit.prepared-context/v1, read through desktop/cradle/src/context/nativeContext.ts):
// read, add a selection, remove one, clear, and send it with the reviewed packet (the send empties it). The owner discloses no token
// count, so the size is the characters of the selected text, as the Packet widget and the transport's Key slot show it
// (widgets/PacketWidget.tsx packetRows, shell/transports/transportReadings.ts packetReadouts). The owner holds at most 32 items
// (nativeContext.ts assertPreparedContext) and 1 MiB (ai-kit crates/aikit-store/src/encounter_context.rs).
// The readings are the Factory flow of Control/user/flows (flow-2026-10-03-1432.html) and a packet of three items, the same three that
// the Document device holds (panels/central__document.tsx), so both say "3 items · 106 chars" as central/documentPayload.ts packetHead does.
// The picture is the packet by its own law: a meter of characters (each step to the right is ten times more), the items laid along it
// in order, and the Limit as the ceiling. An item that does not fit under the Limit waits, drawn dashed past the ceiling.
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, toUnit, type LightState, type RowItem, type Scale} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
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
const FLOW = 'Factory original development Run'
const STALE_WHY = 'The source revision changed. Reselect it or review the captured snapshot.'

const ADDS = [
  {value: 'selection', label: 'Selection', does: 'Capture takes the passage that you selected.'},
  {value: 'entry', label: 'Entry', does: 'Capture takes the whole entry that holds the selection.'},
  {value: 'page', label: 'Page', does: 'Capture takes the whole journal page that holds the selection.'},
] as const

// ---------------------------------------------------------------- what the packet holds, from the values

const chars = (text: string) => [...text].length
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const list = (text: string) => text.split(',').filter(Boolean)
const limitText = (x: number) => (x >= OFF ? 'Off' : x >= 10_000 ? `${Math.round(x / 1000)}k` : x >= 1000 ? `${(x / 1000).toFixed(1)}k` : `${Math.round(x)}`)

interface Item {readonly id: string; readonly entry: number; readonly by: 'C' | 'F'; readonly kind: Kind; readonly text: string; readonly chars: number}
/** The packet's three items: the words the agent would read, as the Document device holds them (ql-flow.html `D.packet`). */
const BASE: readonly Item[] = ([
  {id: '3s', entry: 3, by: 'C', kind: 'selection', text: 'The original development Run remains incomplete'},
  {id: '6e', entry: 6, by: 'C', kind: 'entry', text: 'The original Run remains incomplete'},
  {id: '9s', entry: 9, by: 'F', kind: 'selection', text: 'Which unit starts first?'},
] as const).map(item => ({...item, chars: chars(item.text)}))

/** The passages that Capture can still take. `whole` is the size of the whole entry in the flow file; `lead` is how that entry opens. */
const PASSAGES = [
  {entry: 4, by: 'C', head: 'The requested two-machine development Run remains incomplete', whole: 1343,
    lead: 'The requested two-machine development Run remains incomplete. The latest native owner reading at 17:57 UTC retained seven required units and no worker attempts or completed legs. A startup failure has not been counted as a worker result.'},
  {entry: 7, by: 'C', head: 'The development Run has not started its workers', whole: 1175,
    lead: 'The development Run has not started its workers. The installed Factory owner was checked again at 20:54 UTC: zero attempts, zero completed required units out of seven, and no independent verification or human decision recorded.'},
  {entry: 8, by: 'C', head: 'The first worker can retain its coordinator', whole: 1134,
    lead: 'The first worker can retain its coordinator. The installed Factory owner was reread at 21:52 UTC: zero attempts and zero completed required units out of seven. The same development Run remains open.'},
  {entry: 5, by: 'C', head: 'The original development Run still has seven required units', whole: 1012,
    lead: 'The original development Run still has seven required units and no worker attempts or completed legs in a fresh native owner reading. It remains incomplete.'},
] as const

/** An item added by Capture, from its code: the entry number, then s (a selection) or e (a whole entry). */
function made(code: string): Item | undefined {
  const entry = Number(code.slice(0, -1)), passage = PASSAGES.find(p => p.entry === entry)
  if (!passage) return undefined
  return code.endsWith('e')
    ? {id: code, entry, by: passage.by, kind: 'entry', text: passage.lead, chars: passage.whole}
    : {id: code, entry, by: passage.by, kind: 'selection', text: passage.head, chars: chars(passage.head)}
}

const held = (v: V): Item[] => {
  const gone = new Set(list(str(v, 'gone')))
  return [...(on(v, 'cleared') ? [] : BASE), ...list(str(v, 'added')).map(made).filter((i): i is Item => !!i)].filter(i => !gone.has(i.id))
}
const stale = (v: V) => new Set(list(str(v, 'stale')))
const labelOf = (i: Item) => `entry ${i.entry} (${i.by})`
const KIND_WORD: Record<Kind, string> = {selection: 'a selection', entry: 'a whole entry', page: 'a whole page'}

/** What fits under the Limit, in the order added. An item that would pass it waits. */
function fit(v: V) {
  const limit = num(v, 'limit'), off = limit >= OFF
  const inn: Item[] = [], wait: Item[] = []
  let total = 0
  for (const item of held(v)) {
    if (off || total + item.chars <= limit) { inn.push(item); total += item.chars } else wait.push(item)
  }
  return {inn, wait, total, limit, off}
}
const headWords = (n: number, total: number) => `${plural(n, 'item')} · ${total} chars`

/** The packet is whole again: every item out, as the owner's clear does and as a send does. */
function clear(p: ViewProps) {
  p.set('cleared', true)
  p.set('added', '')
  p.set('gone', '')
}
function takeOut(p: ViewProps, id: string) {
  p.set('gone', [...list(str(p.v, 'gone')), id].join(','))
}
/** The next passage of the page that Capture would take, as Add sets it. */
function nextCode(v: V): string | undefined {
  const present = new Set(held(v).map(i => i.entry)), passage = PASSAGES.find(x => !present.has(x.entry))
  return passage ? `${passage.entry}${str(v, 'add') === 'entry' ? 'e' : 's'}` : undefined
}
const captureRefusal = (v: V): string | undefined => (str(v, 'add') === 'page' ? 'This Flow holds no journal page.' : nextCode(v) ? undefined : 'Nothing is selected.')
function capture(p: ViewProps) {
  const code = nextCode(p.v)
  if (!code) return
  p.set('gone', list(str(p.v, 'gone')).filter(x => x !== code).join(','))
  p.set('added', [...list(str(p.v, 'added')).filter(x => x !== code), code].join(','))
}
/** Why Answer this cannot press now, in the owners' words (widgets/PacketWidget.tsx answerRefusal); undefined when it can. */
function answerRefusal(v: V): string | undefined {
  const {inn} = fit(v)
  if (str(v, 'scope') === 'project') return 'No Agent conversation stands, so nothing receives the packet yet.'
  if (!inn.length) return 'The packet is empty: put a selection in it first.'
  if (str(v, 'question') !== 'written') return "Write the question in the Agent's composer: Answer this sends it with exactly this packet."
  if (inn.some(i => stale(v).has(i.id))) return STALE_WHY
  return undefined
}
function answer(p: ViewProps) {
  const {inn, total} = fit(p.v)
  p.set('sent', headWords(inn.length, total))
  p.set('question', 'none')
  if (!on(p.v, 'keep')) clear(p)
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

function Picture({v, set, w, h, tile}: {v: V; set?: SetFn; w: number; h: number; tile?: boolean}) {
  const {inn, wait, total, limit, off} = fit(v), moved = stale(v)
  const x0 = 8, x1 = w - 12, span = x1 - x0
  const at = (c: number) => x0 + toUnit(AXIS, Math.max(AXIS.min, c)) * span
  const my = tile ? 10 : 24, bh = 10, ty = my + bh + 11, top = ty + 7, pitch = tile ? 12 : 14
  const room = Math.max(1, Math.floor((h - top - 4) / pitch))
  const all = [...inn.map(item => ({item, waits: false})), ...wait.map(item => ({item, waits: true}))]
  const shown = all.length > room ? all.slice(0, room - 1) : all
  const hx = at(off ? OFF : limit)
  const limitAt = (x: number) => {
    const c = AXIS.min * Math.pow(AXIS.max / AXIS.min, clampTo(0, 1, (x - x0) / span))
    return c >= LIMIT.max * .93 ? OFF : sig2(Math.max(LIMIT.min, c))
  }
  let run = 0
  const waitEnd = Math.min(x1, at(total + wait.reduce((n, i) => n + i.chars, 0)))
  const bx = x0 + 15
  return <g>
    {!tile && <text x={x0} y={12} className="dp-ink-dim">{w > 160 ? `Packet · ${headWords(inn.length, total)}` : `${plural(inn.length, 'item')} · ${total} ch`}</text>}
    <rect x={x0} y={my} width={span} height={bh} className="dp-faint" />
    {inn.map((item, k) => {
      const a = at(run), b = at(run + item.chars)
      run += item.chars
      return <rect key={item.id} x={a} y={my} width={Math.max(1, b - a - 1)} height={bh} fill={moved.has(item.id) ? 'var(--stall)' : 'var(--dp-value)'} opacity={k % 2 ? .5 : .8} />
    })}
    {wait.length > 0 && waitEnd > at(total) && <rect x={at(total)} y={my} width={waitEnd - at(total)} height={bh} fill="none" stroke="var(--stall)" strokeDasharray="2 2" />}
    {[100, 1000, 10_000, 100_000].map(c => <g key={c}>
      <path d={`M${at(c)} ${my + bh}v3`} className="dp-faint" />
      {(!tile || c === 100 || c === 10_000) && <text x={at(c)} y={ty} className="dp-axis" textAnchor="middle">{c >= 1000 ? `${c / 1000}k` : c}</text>}
    </g>)}
    {(!tile || !off) && <path d={`M${hx} ${my - 5}V${my + bh + 5}`} className="dp-curve-on" />}
    {!tile && <Handle n={1} x={hx} y={my + bh / 2} label="Limit" does="Drag along the meter: the size at which the packet stops. Drag to the right end for Off."
      onDrag={set && (x => set('limit', limitAt(x)))} onReset={set && (() => set('limit', OFF))} />}
    {shown.map(({item, waits}, k) => {
      const cy = top + k * pitch + pitch / 2
      const state: MarkState = waits ? 'wait' : moved.has(item.id) ? 'review' : 'in'
      const len = Math.max(2, toUnit(AXIS, Math.max(AXIS.min, item.chars)) * (x1 - bx) * .8)
      const words = `${tile ? '' : `${labelOf(item)}${state === 'review' ? ' !' : ''}  `}${item.chars}`
      const inside = bx + len + 6 + words.length * 4 > w - 2
      return <g key={item.id}>
        <g transform={`translate(${x0} ${cy - 6}) scale(1.2)`}><path d={GLYPH[item.kind]} fill="none" stroke={TONE[state]} strokeWidth={.9} /></g>
        <rect x={bx} y={cy - 4} width={len} height={8} fill={waits ? 'none' : TONE[state]} fillOpacity={.28} stroke={TONE[state]} strokeDasharray={waits ? '2 2' : undefined} />
        <text x={inside ? bx + 3 : bx + len + 5} y={cy + 3} className="dp-ink"
          style={{fontSize: 8, fontVariantNumeric: 'tabular-nums', fill: waits ? 'var(--text-dim)' : undefined}}>{words}</text>
      </g>
    })}
    {all.length > shown.length && <text x={x0} y={top + shown.length * pitch + pitch / 2 + 3} className="dp-axis">+{all.length - shown.length} more</text>}
    {all.length === 0 && <text x={x0} y={top + 12} className="dp-ink-dim">{str(v, 'sent') ? `Sent ${str(v, 'sent')}` : 'Nothing in the packet'}</text>}
  </g>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

const AddRadio = ({p}: {p: ViewProps}) =>
  <Radio label="Add" does="What Capture takes from the page: the selection, its whole entry, or its whole journal page." value={str(p.v, 'add')} options={ADDS} stack onChange={x => p.set('add', x)} />
const LimitBox = ({p}: {p: ViewProps}) =>
  <ValueBox label="Limit" does="Stops the packet at this many characters. An item that does not fit waits. Off leaves only the owner's cap of 32 items."
    value={num(p.v, 'limit')} def={OFF} scale={LIMIT} format={limitText} onChange={x => p.set('limit', x)} />
const KeepToggle = ({p}: {p: ViewProps}) =>
  <Toggle label="Keep" does="Keep the packet after you send it, to ask again with the same material. Off empties it when you send." on={on(p.v, 'keep')} onChange={x => p.set('keep', x)} />
const ClearNow = ({p}: {p: ViewProps}) =>
  <Action label="Clear now" does="Take every item out of the packet." onPress={() => clear(p)} disabled={held(p.v).length ? undefined : 'The packet is empty.'} />
const AnswerThis = ({p}: {p: ViewProps}) =>
  <Action label="Answer this" does="Send your question with exactly this packet. The answer arrives as an entry." onPress={() => answer(p)} disabled={answerRefusal(p.v)} />

function rowsOf(v: V): RowItem[] {
  const {inn, wait, total, limit} = fit(v), moved = stale(v)
  const rows = [...inn.map(item => ({item, waits: false})), ...wait.map(item => ({item, waits: true}))]
  if (!rows.length) return [{id: 'none', name: 'Nothing in the packet', light: 'unknown'}]
  return rows.map(({item, waits}) => {
    const review = !waits && moved.has(item.id)
    return {
      id: item.id, name: labelOf(item), request: true, light: waits || review ? 'dark' : 'lit', tone: 'value',
      mark: <Mark kind={item.kind} state={waits ? 'wait' : review ? 'review' : 'in'} />, note: `${item.chars}`,
      why: waits ? `Passes the Limit by ${total + item.chars - limit} characters.` : review ? STALE_WHY : undefined,
      does: `Added as ${KIND_WORD[item.kind]}: ${item.text.slice(0, 60)}${item.text.length > 60 ? '…' : ''}`,
    }
  })
}

// ---------------------------------------------------------------- the pane: the packet in full

function Pane({p}: {p: ViewProps}) {
  const {inn, wait, total, limit, off} = fit(p.v), moved = stale(p.v)
  const rows = [...inn.map(item => ({item, waits: false})), ...wait.map(item => ({item, waits: true}))]
  return <div className="ref-pane-body cpk-pane">
    <div className="ref-pane-tabs" role="tablist" aria-label="Packet">
      <button type="button" role="tab" aria-selected="true">Packet · {plural(inn.length, 'item')}</button>
    </div>
    <div className="cpk-sheet">
      <header className="cpk-head">
        <h3>Packet <small>{FLOW}</small></h3>
        <p>Exactly what the agent will read. Nothing else of yours goes with it.</p>
      </header>
      <div className="cpk-body">
        {rows.length === 0
        ? <p className="cpk-empty">{str(p.v, 'sent') ? `Sent ${str(p.v, 'sent')}. The packet is empty.` : 'Nothing in the packet yet. Select a passage, then press Capture.'}</p>
        : <ol className="cpk-list">
          {rows.map(({item, waits}) => {
            const review = !waits && moved.has(item.id), state: MarkState = waits ? 'wait' : review ? 'review' : 'in'
            return <li key={item.id} className="cpk-item" data-state={state}>
              <div className="cpk-meta">
                <Mark kind={item.kind} state={state} />
                <b>{labelOf(item)}</b>
                <span>{item.kind === 'entry' ? 'whole entry' : item.kind}</span>
                <span className="cpk-size">{item.chars} chars</span>
                <button type="button" className="cpk-x" aria-label={`Take ${labelOf(item)} out of the packet`} data-i="Take out|Take this item out of the packet."
                  onClick={() => takeOut(p, item.id)}>×</button>
              </div>
              <p className="cpk-text">{item.text}{item.kind === 'entry' && item.chars > item.text.length ? ' …' : ''}</p>
              {waits && <p className="cpk-note">Waits. It passes the Limit by {total + item.chars - limit} characters. Take it out, or raise the Limit.</p>}
              {review && <p className="cpk-note">{STALE_WHY}</p>}
            </li>
          })}
        </ol>}
      </div>
      <footer className="cpk-foot">
        <span><b>{total}</b> characters</span>
        <span><b>{inn.length}</b> of {CAP} items</span>
        <span>Limit <b>{limitText(off ? OFF : limit)}</b></span>
        <span>For the <b>{str(p.v, 'scope') === 'project' ? 'project' : 'conversation'}</b></span>
      </footer>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'central:packet',
  title: 'Packet',
  kind: 'effect',
  defaults: {
    light: 'lit', add: 'selection', limit: OFF, keep: false,
    // Readings and the state of the packet: what the owner reports, and what Capture, Clear and a send have done.
    cleared: false, added: '', gone: '', stale: '', question: 'written', scope: 'session', sent: '', rowsPage: 0,
  },
  fixtures: {
    'Factory flow': {},
    'Over the limit': {limit: 1000, added: '4e'},
    'Source moved': {stale: '6e'},
  },

  folded: p => {
    const {inn, total} = fit(p.v)
    return <Folded title="Packet" light={light(p.v)} readings={[plural(inn.length, 'item'), `${total} ch`]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const {limit} = fit(p.v)
    return <Panel title="Packet" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The packet" does="The packet's size on a meter of characters, and its items along it. Drag handle 1 to set the Limit." corner={`limit ${limitText(limit)}`}>
          <Picture v={p.v} set={p.set} w={140} h={146} />
        </Display>
      </Section>
      <Section label="Macros" cols={2} width={128}>
        <AddRadio p={p} />
        <LimitBox p={p} />
        <KeepToggle p={p} />
        <ClearNow p={p} />
      </Section>
    </Panel>
  },

  whole: p => {
    const {inn, wait, total, limit, off} = fit(p.v)
    return <Panel title="Packet" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The packet" does="The packet's size on a meter of characters, and its items along it. Drag handle 1 to set the Limit." corner={`limit ${limitText(limit)}`}>
            <Picture v={p.v} set={p.set} w={194} h={146} />
          </Display>
        </Section>
        <Section label="Add" width={74}>
          <AddRadio p={p} />
          <Action label="Capture" does="Add the selection to the packet, as Add sets. Nothing is sent." onPress={() => capture(p)} disabled={captureRefusal(p.v)} />
        </Section>
        <Section label="Limit" cols={2} grow>
          <Dial label="Limit" does="Stops the packet at this many characters. An item that does not fit waits. Off leaves only the owner's cap of 32 items."
            value={limit} def={OFF} scale={LIMIT} format={limitText} onChange={x => p.set('limit', x)} />
          <Readout label="room" does="Characters that still fit under the Limit." value={off ? 'no limit' : Math.max(0, limit - total)} tone="value" />
          <Readout label="waiting" does="Items that pass the Limit. Each waits until you take it out or raise the Limit." value={wait.length} tone={wait.length ? 'stall' : undefined} />
        </Section>
      </Band>
      <Band>
        <Section label="Items" width={172}>
          <Rows does="Exactly what the agent receives. Press a square to take an item out." items={rowsOf(p.v)} size={6} page={num(p.v, 'rowsPage')}
            onPage={n => p.set('rowsPage', n)} onRequest={(id, now) => { if (!now) takeOut(p, id) }} />
        </Section>
        <Section label="Packet" width={62}>
          <Readout label="items" does={`Items that the agent will read. The owner holds at most ${CAP}.`} value={inn.length} tone="value" />
          <Readout label="size" does="The size of the text that the agent will read, in characters. The owner reports no token count." value={total} tone="value" />
          <Readout label="scope" does="Who receives the packet: the conversation, or the project when no conversation stands." value={str(p.v, 'scope')} />
        </Section>
        <Section label="Send" cols={2} grow>
          <KeepToggle p={p} />
          <Readout label="question" does="Whether your question stands in the agent's composer." value={str(p.v, 'question') === 'written' ? 'written' : 'none'} tone={str(p.v, 'question') === 'written' ? 'green' : undefined} />
          <ClearNow p={p} />
          <AnswerThis p={p} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const {inn, total} = fit(p.v)
    return <Tile title="Packet" light={light(p.v)} span={2} onFull={p.nav.full}>
      <Display w={112} h={104} label="The packet" does="The packet on its meter, with its first items. Click it to open the packet.">
        <Picture v={p.v} w={112} h={104} tile />
      </Display>
      <div className="ref-tile-side">
        <Readout big label="items" does="Items that the agent will read. Press to open the packet." value={inn.length} tone="value" onPress={p.nav.full} />
        <Readout label="size" does="The size of the text that the agent will read, in characters." value={total} />
        <AnswerThis p={p} />
      </div>
    </Tile>
  },
}
