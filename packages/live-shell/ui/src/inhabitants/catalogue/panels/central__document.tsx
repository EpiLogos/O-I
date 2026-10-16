// The Document (manual §17.7): any Central page, drawn by its template, in a pane. Live's nearest: a device whose panel follows its
// mode, as Simpler's Classic, One-Shot and Slice do — the page kind decides the picture and which controls are live.
// The picture is the page's own structure, drawn from the values: a Flow as its entries or as one page or as its journal
// (documents/ql-flow.html `meta.view`), a Day as the die's net (ql-daily-die.html), a Being or a Thing as its oi.page/v1 sheet with
// its `appearance.layout` and `appearance.tone` (oi-beings.html). Source shows the keys of the `ql-doc` island that each template
// keeps. The readings are the Factory flow in Control/user/flows (flow-2026-10-03-1432.html), with a packet of three items, and
// the blank pages that the templates start from. The packet's head reads as the shell reads it (central/documentPayload.ts packetHead).
import {useEffect, useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type RowItem, type Tone} from '../../sdk/panel'
import {num, on, str, type DesignedDevice, type ViewProps} from './design'
import './central__document.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type KindId = 'day' | 'flow' | 'being' | 'thing'

/** The templates a person can start a page from (desktop/cradle/documents/forms.json) and the file each draws the page from. */
const KINDS: Readonly<Record<KindId, {readonly label: string; readonly file: string; readonly version: string}>> = {
  day: {label: 'Day', file: 'ql-daily-die.html', version: 'v0.3'},
  flow: {label: 'Flow', file: 'ql-flow.html', version: 'v0.4'},
  being: {label: 'Being', file: 'oi-beings.html', version: 'v0.1.0'},
  thing: {label: 'Thing', file: 'oi-things.html', version: 'v0.1.0'},
}
const TEMPLATES = (Object.keys(KINDS) as KindId[]).map(id => ({value: id, label: `${KINDS[id].label} ${KINDS[id].version}`}))

/** The faces of the Day die, in the template's own order (ql-daily-die.html; the Day device draws the same net). */
const FACES = ['Ground', 'Definition', 'Operation', 'Pattern', 'Context', 'Synthesis'] as const
const AT: Record<number, [number, number]> = {2: [1, 0], 4: [0, 1], 0: [1, 1], 1: [2, 1], 5: [3, 1], 3: [1, 2]}

/** The paper of a page: the oi.page/v1 tokens, light (`paper`) and dark (`ink`) — body[data-tone] in oi-beings.html. */
const PAPER = {
  paper: {bg: '#EFEFED', ink: '#1a1a18', mid: '#6E6E6A', faint: '#A3A39E', rule: '#C9C9C4'},
  ink: {bg: '#20231f', ink: '#eeeee8', mid: '#b2b7aa', faint: '#8e9688', rule: '#555e50'},
} as const

const FLOW_TITLE = 'Factory original development Run — execution and continuation'
/** The Factory flow's entries (flow-2026-10-03-1432.html): `C` the Factory coordinator, `F` the person. Highlights and a note sit on
 * entries 3, 8 and 4; the packet holds three items. */
interface Ent {readonly by: 'C' | 'F'; readonly head: string; readonly hl?: boolean; readonly note?: boolean}
const ENTRIES: readonly Ent[] = [
  {by: 'C', head: 'This is the continuation Flow for the existing Factory development Run'},
  {by: 'C', head: 'The repaired startup image has been installed on Omarchy'},
  {by: 'C', head: 'The original development Run remains incomplete', hl: true},
  {by: 'C', head: 'The requested two-machine development Run remains incomplete', note: true},
  {by: 'C', head: 'The original development Run still has seven required units'},
  {by: 'C', head: 'The original Run remains incomplete'},
  {by: 'C', head: 'The development Run has not started its workers'},
  {by: 'C', head: 'The first worker can retain its coordinator', hl: true},
  {by: 'F', head: 'Which unit starts first?'},
  {by: 'F', head: 'What if the repaired image fails?'},
  {by: 'C', head: 'Then the Run stops at the first unit.'},
  {by: 'F', head: 'I meant the second machine.'},
  {by: 'C', head: 'Both lines end at the first unit.'},
]
/** The packet: each item is the words the agent would read, with the scope it was added under (ql-flow.html `D.packet`). */
const PACKET = [
  {entry: 3, scope: 'selection', text: 'The original development Run remains incomplete'},
  {entry: 6, scope: 'whole entry', text: 'The original Run remains incomplete'},
  {entry: 9, scope: 'selection', text: 'Which unit starts first?'},
] as const
const JOURNAL_PAGES = ['Mon 13 Oct', 'Tue 14 Oct', 'Wed 15 Oct']

const WRITES = [
  {value: 'off', label: 'Off', does: 'The agent does not write.'},
  {value: 'propose', label: 'Propose', does: 'Each agent entry waits for you to accept it.'},
  {value: 'write', label: 'Write', does: 'Agent entries go in directly, each with a receipt.'},
] as const
const FLOW_VIEWS = [
  {value: 'dialogue', label: 'Dialogue', does: 'The entries in order, as a conversation.'},
  {value: 'flow', label: 'Flow', does: 'One entry at a time as a full page.'},
  {value: 'journal', label: 'Journal', does: 'One person, one page at a time.'},
] as const
const VIEWS = [{value: 'page', label: 'Page', does: 'The page as its template draws it.'}, {value: 'source', label: 'Source', does: 'The text that the page keeps.'}] as const
const GROUNDS = [{value: 'paper', label: 'Paper', does: 'Dark ink on light paper.'}, {value: 'ink', label: 'Ink', does: 'Light ink on dark ground.'}] as const
const LAYOUTS = [{value: 'portrait', label: 'Portrait', does: 'The mark stands at the right.'}, {value: 'editorial', label: 'Editorial', does: 'The mark stands at the left.'}] as const

// ---------------------------------------------------------------- what the page holds, from the values

const kindOf = (v: V): KindId => (str(v, 'template') in KINDS ? (str(v, 'template') as KindId) : 'flow')
const titleOf = (v: V) => str(v, 'title').trim()
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)
const chars = (text: string) => [...text].length

/** The highlights, the notes and the packet that the page holds. Only the Flow fixture holds any; a new page starts empty. */
function held(v: V) {
  if (kindOf(v) !== 'flow') return {hl: 0, notes: 0, items: [] as readonly (typeof PACKET)[number][], size: 0, agent: undefined as number | undefined}
  const items = on(v, 'packetOn') ? PACKET : []
  return {hl: ENTRIES.filter(e => e.hl).length, notes: ENTRIES.filter(e => e.note).length, items, size: items.reduce((n, i) => n + chars(i.text), 0), agent: ENTRIES.filter(e => e.by === 'C').length as number | undefined}
}
/** The packet's head in the shell's own words ("Packet · 3 items · 106 chars"). */
function packetWords(v: V) {
  const {items, size} = held(v)
  if (on(v, 'copied') && items.length) return 'Packet · copied as JSON'
  return items.length ? `Packet · ${items.length} item${items.length === 1 ? '' : 's'} · ${size} chars` : 'Packet · empty'
}

/** The save router's five names (central/documentDeviceModel.ts), and "edited" while the draft is not sent. */
function saveWords(v: V) {
  const outcome = str(v, 'save')
  if (outcome === 'stale' || outcome === 'conflict' || outcome === 'refused') return outcome
  return on(v, 'dirty') ? 'edited' : outcome === 'unchanged' ? 'unchanged' : 'saved'
}
const saveTone = (words: string): Tone => (words === 'saved' || words === 'unchanged' ? 'green' : words === 'edited' ? 'accent' : 'stall')
const blocked = (v: V) => ['stale', 'conflict', 'refused'].includes(str(v, 'save'))

/** The title on the pane's tab, as the shell names it (central/documents/centralDocuments.ts subjectOf). */
function tabTitle(v: V) {
  const kind = kindOf(v)
  if (kind === 'day') return 'Day · 2026-10-15'
  if (kind === 'flow') return 'Flow · flow-2026-10-03-1432'
  return titleOf(v) || KINDS[kind].label
}

/** The keys of the `ql-doc` island that the template keeps, each with what it holds now. */
function sourceKeys(v: V): readonly (readonly [string, string])[] {
  const n = held(v), kind = kindOf(v)
  if (kind === 'flow') return [['meta', `{view: ${str(v, 'flowView')}}`], ['entries', `[${ENTRIES.length}]`], ['notes', `[${n.notes}]`], ['packet', `[${n.items.length}]`], ['media', '[0]'], ['journal', '[…]']]
  if (kind === 'day') return [['meta', '{daily}'], ['fields', '{17}'], ['capture', '[0]'], ['sessions', '[0]'], ['completed', '[0]'], ['media', '[…]'], ['notes', `[${n.notes}]`], ['packet', `[${n.items.length}]`], ['contributions', '[0]']]
  return [['profile', '"oi.page/v1"'], ['meta', '{…}'], ['bindings', '{…}'], ['appearance', `{${str(v, 'layout')} · ${str(v, 'ground')}}`], ['page', '{…}'], ['notes', `[${n.notes}]`], ['extensions', '{}']]
}

/** The one choice that the picture shows with a handle: the Flow's view, a page's layout, or a Day's page or source. */
function stopsOf(v: V) {
  const kind = kindOf(v)
  if (kind === 'flow') return {key: 'flowView', def: 'dialogue', items: FLOW_VIEWS, label: 'Flow view', does: 'Drag along the line to choose Dialogue, Flow or Journal.'}
  if (kind === 'day') return {key: 'view', def: 'page', items: VIEWS, label: 'View', does: 'Drag along the line to show the page or its source.'}
  return {key: 'layout', def: 'portrait', items: LAYOUTS, label: 'Layout', does: 'Drag along the line to set where the mark stands.'}
}

/** Break a line of words at a width, to at most `max` lines. */
function wrap(text: string, n: number, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && `${line} ${word}`.length > n) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out.length > max ? [...out.slice(0, max - 1), `${out[max - 1]!.slice(0, Math.max(1, n - 1))}…`] : out
}

// ---------------------------------------------------------------- the display: the page, as its template draws it

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}

/** The paper that a Day or a Flow is drawn on: light, in every mode. */
const Sheet = ({x, y, w, h}: Box) => <rect x={x} y={y} width={w} height={h} fill={PAPER.paper.bg} />

/** A Flow in Dialogue: the last entries, one row each — the author's letter, then a bar as long as the words. */
function FlowDialogue({v, x, y, w, h}: Box & {v: V}) {
  const pitch = h > 88 ? 10 : 11, fit = Math.max(1, Math.floor((h - 6) / pitch)), shown = ENTRIES.slice(-fit), first = ENTRIES.length - shown.length
  const picked = new Set<number>(on(v, 'packetOn') ? PACKET.map(i => i.entry) : [])
  return <g>
    {shown.map((e, i) => {
      const cy = y + 4 + i * pitch + pitch / 2, len = Math.min(w - 26, Math.max(18, e.head.length * 1.6)), n = first + i + 1
      return <g key={n}>
        <text x={x + 6} y={cy + 2.6} fill={PAPER.paper.ink} style={{font: '700 7px var(--font-ui)'}}>{e.by}</text>
        <rect x={x + 15} y={cy - 1.4} width={len} height={2.8} fill={PAPER.paper.mid} opacity={e.by === 'F' ? .9 : .5} />
        {e.hl && <rect x={x + 15 + len * .35} y={cy - 2.8} width={len * .4} height={5.6} fill="var(--dp-on)" opacity={.75} />}
        {e.note && <rect x={x + w - 8} y={cy - 2.5} width={5} height={5} fill="none" stroke="var(--dp-value)" strokeWidth={1.2} />}
        {picked.has(n) && <rect x={x + 1.5} y={cy - pitch / 2 + 1.5} width={2} height={pitch - 3} fill="var(--dp-value)" />}
      </g>
    })}
  </g>
}

/** A Flow in Flow view: one entry as a page, with its place in the thread. */
function FlowPage({x, y, w, h}: Box) {
  const at = ENTRIES.length, e = ENTRIES[at - 1]!, per = Math.max(10, Math.floor((w - 14) / 4.1))
  return <g>
    <text x={x + 7} y={y + 12} fill={PAPER.paper.mid} style={{font: '7.5px var(--font-ui)'}}>{at} of {ENTRIES.length} · {e.by === 'F' ? 'You' : 'Coordinator'}</text>
    {wrap(e.head, per, 3).map((line, i) => <text key={i} x={x + 7} y={y + 28 + i * 12} fill={PAPER.paper.ink} style={{font: '9.5px Charter, Georgia, serif'}}>{line}</text>)}
    {[0, 1, 2].map(i => <rect key={i} x={x + 7} y={y + 52 + i * 7} width={(w - 14) * (i === 2 ? .45 : .9)} height={1.6} fill={PAPER.paper.rule} />)}
    <text x={x + 7} y={y + h - 6} fill={PAPER.paper.mid} style={{font: '9px var(--font-ui)'}}>◂</text>
    <text x={x + w - 7} y={y + h - 6} textAnchor="end" fill={PAPER.paper.faint} style={{font: '9px var(--font-ui)'}}>▸</text>
  </g>
}

/** A Flow in Journal: one person's page for a day, and the run of days under it. */
function FlowJournal({x, y, w, h}: Box) {
  const at = JOURNAL_PAGES.length - 1
  return <g>
    <text x={x + 7} y={y + 12} fill={PAPER.paper.mid} style={{font: '7.5px var(--font-ui)'}}>You · {JOURNAL_PAGES[at]}</text>
    {[0, 1, 2, 3, 4].map(i => <rect key={i} x={x + 7} y={y + 20 + i * 9} width={(w - 14) * [.92, .85, .9, .7, .4][i]!} height={1.8} fill={PAPER.paper.rule} />)}
    {JOURNAL_PAGES.map((page, i) => <circle key={page} cx={x + w / 2 + (i - at / 2) * 9} cy={y + h - 7} r={2.2} fill={i === at ? 'var(--dp-on)' : PAPER.paper.rule} />)}
  </g>
}

/** A Day: the die's net, the open face lit. */
function DayNet({v, x, y, w, h}: Box & {v: V}) {
  const names = w > 150, c = Math.min(Math.floor((w - 8) / 4), Math.floor((h - 6) / 3)), ox = x + (names ? 6 : (w - c * 4) / 2), oy = y + (h - c * 3) / 2, open = num(v, 'face')
  return <g>
    {[0, 1, 2, 3, 4, 5].map(f => {
      const [col, row] = AT[f]!, cx = ox + col * c, cy = oy + row * c
      return <g key={f}>
        <rect x={cx + .5} y={cy + .5} width={c - 1} height={c - 1} fill={f === open ? 'var(--dp-on)' : PAPER.paper.rule} fillOpacity={f === open ? .35 : .55} stroke={f === open ? 'var(--dp-on)' : PAPER.paper.faint} strokeWidth={f === open ? 1.3 : .8} />
        <text x={cx + c / 2} y={cy + c / 2 + 3} textAnchor="middle" fill={PAPER.paper.ink} style={{font: '9px var(--font-ui)'}}>{f}</text>
      </g>
    })}
    {names && FACES.map((name, f) => <text key={name} x={ox + c * 4 + 10} y={y + 16 + f * 12} fill={f === open ? PAPER.paper.ink : PAPER.paper.mid} style={{font: '8.5px var(--font-ui)'}}>{f} {name}</text>)}
  </g>
}

/** A Being or a Thing: the sheet, with its mark where the layout puts it and its ground as the tone sets it. */
function PageSheet({v, x, y, w, h}: Box & {v: V}) {
  const p = PAPER[str(v, 'ground') === 'ink' ? 'ink' : 'paper'], editorial = str(v, 'layout') === 'editorial', pad = 7
  const rail = Math.round(w * .27), left = x + pad + (editorial ? 20 : 0), colW = x + w - pad - rail - 6 - left
  const markX = editorial ? x + pad + 7 : x + w - pad - 7, title = titleOf(v)
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={p.bg} />
    <circle cx={markX} cy={y + pad + 7} r={6.5} fill="none" stroke={p.ink} strokeWidth={.8} />
    <circle cx={markX} cy={y + pad + 7} r={3} fill="none" stroke={p.ink} strokeWidth={.8} strokeDasharray="1 2" />
    <rect x={left} y={y + pad} width={22} height={1.6} fill={p.mid} />
    {title ? wrap(title, Math.max(8, Math.floor(colW / 5)), 2).map((line, i) => <text key={i} x={left} y={y + pad + 14 + i * 10} fill={p.ink} style={{font: '9.5px Charter, Georgia, serif'}}>{line}</text>)
      : [.62, .4].map((f, i) => <rect key={i} x={left} y={y + pad + 6 + i * 8} width={(editorial ? colW : colW - 14) * f} height={4} fill={p.ink} opacity={.8} />)}
    <rect x={x + pad} y={y + pad + 25} width={w - pad * 2} height={.8} fill={p.rule} />
    {[0, 1].map(i => <g key={i}>
      <text x={left} y={y + pad + 41 + i * 17} fill={p.faint} style={{font: '6px var(--font-ui)'}}>{i + 1}</text>
      <rect x={left + 8} y={y + pad + 36 + i * 17} width={colW * .45} height={2.6} fill={p.ink} opacity={.7} />
      <rect x={left + 8} y={y + pad + 42 + i * 17} width={colW - 8} height={1.6} fill={p.rule} />
    </g>)}
    <rect x={x + w - pad - rail} y={y + pad + 31} width={rail * .6} height={1.8} fill={p.mid} />
    {[0, 1, 2].map(i => <rect key={i} x={x + w - pad - rail} y={y + pad + 38 + i * 8} width={rail * (i === 1 ? .8 : 1)} height={.8} fill={p.rule} />)}
  </g>
}

/** Source: the keys of the template's `ql-doc` island, each with what it holds now. */
function SourceLines({v, x, y, w, h}: Box & {v: V}) {
  const keys = sourceKeys(v), pitch = Math.min(11, (h - 6) / (keys.length + 1)), size = Math.min(8.5, pitch - .8)
  return <g>
    <rect x={x} y={y} width={w} height={h} fill="none" className="dp-faint" />
    <text x={x + 6} y={y + 4 + pitch} className="dp-axis" style={{fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: size}}>ql-doc</text>
    {keys.map(([key, value], i) => <g key={key} style={{fontFamily: 'var(--mono, ui-monospace, monospace)'}}>
      <text x={x + 12} y={y + 4 + pitch * (i + 2)} className="dp-ink" style={{fontSize: size}}>{key}</text>
      <text x={x + 12 + Math.min(70, w * .42)} y={y + 4 + pitch * (i + 2)} className="dp-ink-dim" style={{fontSize: size}}>{value}</text>
    </g>)}
  </g>
}

/** The line with a stop for each choice, and handle 1 on the one that is set. Arrow keys step to the next stop. */
function Stops({v, set, w}: {v: V; set?: SetFn; w: number}) {
  const st = stopsOf(v), n = st.items.length, xs = st.items.map((_, i) => 8 + (w - 16) * (i + .5) / n)
  const at = Math.max(0, st.items.findIndex(item => item.value === str(v, st.key)))
  const go = (i: number) => set?.(st.key, st.items[Math.min(n - 1, Math.max(0, i))]!.value)
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={8} x2={w - 8} y1={32} y2={32} className="dp-faint" />
    {st.items.map((item, i) => <g key={item.value} onClick={() => go(i)} style={{cursor: set ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - (w - 16) / n / 2} y={16} width={(w - 16) / n} height={20} fill="transparent" />
      <circle cx={xs[i]} cy={32} r={2} className="dp-faint" />
      <text x={xs[i]} y={25} textAnchor="middle" className={i === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8.5}}>{item.label}</text>
    </g>)}
    {set && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(at + d) }
    }}>
      <Handle x={xs[at]!} y={32} n={1} shape="square" label={st.label} does={st.does} onDrag={px => go(near(px))} onReset={() => set(st.key, st.def)} />
    </g>}
  </g>
}

/** The well: the title and the choice that the handle sets, then the page, then the packet's head. `tile` draws the page alone. */
function Preview({v, set, w, h, tile, onOpen}: {v: V; set?: SetFn; w: number; h: number; tile?: boolean; onOpen?: () => void}) {
  const kind = kindOf(v), k = KINDS[kind], source = str(v, 'view') === 'source'
  const box: Box = tile ? {x: 6, y: 6, w: w - 12, h: h - 12} : {x: 6, y: 38, w: w - 12, h: h - 62}
  const headline = `${w > 160 ? `${k.label} ${k.version} · ` : ''}${titleOf(v) || (kind === 'day' ? 'Wed 15 Oct' : 'Untitled')}`
  const flowView = str(v, 'flowView')
  return <g>
    {!tile && <text x={6} y={12} className="dp-ink-dim">{short(headline, Math.floor((w - 44) / 4.5))}</text>}
    {!tile && <Stops v={v} set={set} w={w} />}
    <g onClick={onOpen} style={{cursor: onOpen ? 'pointer' : undefined}}>
      {source ? <SourceLines v={v} {...box} />
        : kind === 'day' ? <><Sheet {...box} /><DayNet v={v} {...box} /></>
        : kind === 'flow' ? <><Sheet {...box} />{flowView === 'flow' ? <FlowPage {...box} /> : flowView === 'journal' ? <FlowJournal {...box} /> : <FlowDialogue v={v} {...box} />}</>
        : <PageSheet v={v} {...box} />}
    </g>
    {!tile && <text x={6} y={h - 8} className="dp-ink-dim" style={{fontSize: 8.5}}>{packetWords(v)}</text>}
  </g>
}

// ---------------------------------------------------------------- the pane: the real template page, or its source

/** The `ql-doc` island of a template, as readable text: what the page keeps. */
function island(html: string) {
  const match = html.match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)
  if (!match) return 'This template holds no ql-doc island.'
  let text = match[1]!
  try { text = JSON.stringify(JSON.parse(text), null, 2) } catch { /* the island is shown as it is */ }
  return text.split('\n').slice(0, 400).map(line => (line.length > 160 ? `${line.slice(0, 160)}…` : line)).join('\n')
}

function Source({file}: {file: string}) {
  const [text, setText] = useState<string>()
  useEffect(() => {
    let alive = true
    setText(undefined)
    fetch(`${__CRADLE_DOCUMENTS__}/${file}`).then(r => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then(html => { if (alive) setText(island(html)) }).catch(error => { if (alive) setText(`The template did not load (${String(error)}).`) })
    return () => { alive = false }
  }, [file])
  return <pre className="cdoc-source" aria-label="The text that the page keeps">{text ?? 'Reading the template…'}</pre>
}

function DocumentPane({v}: {v: V}) {
  const file = KINDS[kindOf(v)].file
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{tabTitle(v)}</button>
    </div>
    {str(v, 'view') === 'source'
      ? <Source file={file} />
      : <iframe className="ref-pane-frame" title="The page, as its template draws it" src={`${__CRADLE_DOCUMENTS__}/${file}`} />}
  </div>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>

const flowOnly = (v: V) => (kindOf(v) === 'flow' ? undefined : `A ${KINDS[kindOf(v)].label} has no Flow view.`)
const pageOnly = (v: V) => (kindOf(v) === 'being' || kindOf(v) === 'thing' ? undefined : `A ${KINDS[kindOf(v)].label} keeps its template's paper.`)
const SOURCE_MOVED = 'The source moved after your draft. Re-read to review it.'

function FlowViewRadio({p}: {p: ViewProps}) {
  return <Radio label="Flow view" does="How a Flow reads: Dialogue, Flow or Journal." value={str(p.v, 'flowView')} options={FLOW_VIEWS} stack onChange={x => p.set('flowView', x)} disabled={flowOnly(p.v)} />
}
function AgentRadio({p}: {p: ViewProps}) {
  return <Radio label="Agent" does="How agent entries arrive: Off, Propose or Write." value={str(p.v, 'agentWrites')} options={WRITES} stack onChange={x => p.set('agentWrites', x)} />
}
function PinToggle({p}: {p: ViewProps}) {
  return <Toggle label="Pin" does="Keep this page in its pane while you select elsewhere." on={on(p.v, 'pinned')} onChange={x => p.set('pinned', x)} />
}
function AutosaveToggle({p}: {p: ViewProps}) {
  return <Toggle label="Autosave" does="Save a short time after you stop. A moved source still keeps your draft." on={on(p.v, 'autosave')} onChange={x => p.set('autosave', x)} />
}

/** Save and Re-read: the actions the browser's aperture holds for the page (inhabitants/DocumentFlowFace.tsx). */
function save(p: ViewProps) {
  p.set('save', on(p.v, 'dirty') ? 'saved' : 'unchanged')
  p.set('dirty', false)
}
function reread(p: ViewProps) {
  p.set('save', 'saved')
  p.set('dirty', false)
}

/** The packet whole: its items as rows, the scope each was added under at the right. */
function packetRows(v: V): RowItem[] {
  const {items} = held(v)
  if (!items.length) return [{id: 'none', name: 'Nothing in the packet', light: 'unknown'}]
  return items.map(i => ({id: String(i.entry), name: i.text, light: 'lit' as const, tone: 'value' as const, note: i.scope === 'whole entry' ? 'entry' : i.scope, does: `Entry ${i.entry}, added as ${i.scope}.`}))
}

export const design: DesignedDevice = {
  id: 'central:document',
  title: 'Document',
  kind: 'instrument',
  defaults: {
    light: 'lit', template: 'flow', title: FLOW_TITLE, view: 'page', flowView: 'dialogue', ground: 'paper', layout: 'portrait', pinned: false,
    agentWrites: 'propose', autosave: false,
    // Readings and the state of the page: what the owner reports, and the draft.
    packetOn: true, copied: false, dirty: false, save: 'saved', face: 1,
  },
  fixtures: {
    Flow: {},
    Thing: {template: 'thing', title: '', layout: 'editorial'},
    'Stale save': {dirty: true, save: 'stale'},
  },

  folded: p => <Folded title="Document" light={light(p.v)} readings={[short(titleOf(p.v) || KINDS[kindOf(p.v)].label, 9), saveWords(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Document" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page" does="The page as its template draws it. Drag handle 1 along the line to choose how it reads." corner={saveWords(p.v)}>
        <Preview v={p.v} set={p.set} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <FlowViewRadio p={p} />
      <AgentRadio p={p} />
      <PinToggle p={p} />
      <AutosaveToggle p={p} />
    </Section>
  </Panel>,

  whole: p => <Panel title="Document" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The page" does="The page as its template draws it, or the keys of its source. Drag handle 1 along the line to choose how it reads."
          corner={saveWords(p.v)}>
          <Preview v={p.v} set={p.set} w={194} h={146} />
        </Display>
      </Section>
      <Section label="Page" cols={3} grow>
        {span(3, <Chooser label="Template" does="The template that draws the page. A page keeps its version until you change it." value={kindOf(p.v)} options={TEMPLATES} onChange={x => p.set('template', x)} />)}
        {span(3, <TextField wide label="Title" does="The page's title. It heads the page." value={str(p.v, 'title')} placeholder="Untitled" onChange={x => {
          p.set('title', x)
          p.set('dirty', true)
          if (on(p.v, 'autosave')) setTimeout(() => { p.set('dirty', false); p.set('save', 'saved') }, 900)
        }} />)}
        {span(2, <Radio label="View" does="The drawn page, or the text that it keeps." value={str(p.v, 'view')} options={VIEWS} onChange={x => p.set('view', x)} />)}
        <PinToggle p={p} />
        {span(3, <Radio label="Flow view" does="How a Flow reads: Dialogue, Flow or Journal." value={str(p.v, 'flowView')} options={FLOW_VIEWS} onChange={x => p.set('flowView', x)} disabled={flowOnly(p.v)} />)}
      </Section>
    </Band>
    <Band>
      <Section label="Paper" width={84}>
        <Radio label="Ground" does="Dark ink on light paper, or light ink on dark ground." value={str(p.v, 'ground')} options={GROUNDS} stack onChange={x => p.set('ground', x)} disabled={pageOnly(p.v)} />
        <Radio label="Layout" does="Where the mark stands: at the right, or at the left." value={str(p.v, 'layout')} options={LAYOUTS} stack onChange={x => p.set('layout', x)} disabled={pageOnly(p.v)} />
      </Section>
      <Section label="Packet" width={160} cols={2}>
        {span(2, <Rows items={packetRows(p.v)} size={3} does="Exactly what the agent receives, with the scope that each item was added under." />)}
        <Readout label="items" does="Passages in the packet." value={held(p.v).items.length} tone="value" />
        <Readout label="chars" does="The size of the packet: the characters the agent would read." value={held(p.v).size} tone="value" />
        <Readout label="highlights" does="Highlights on the page." value={held(p.v).hl} />
        <Readout label="notes" does="Notes on the page. A note is not a source." value={held(p.v).notes} />
        <Action label="Copy" does="Copy the packet as JSON." onPress={() => p.set('copied', true)} disabled={held(p.v).items.length ? undefined : 'The packet is empty.'} />
        <Action label="Clear" does="Take every item out of the packet." onPress={() => { p.set('packetOn', false); p.set('copied', false); p.set('dirty', true) }} disabled={held(p.v).items.length ? undefined : 'The packet is empty.'} />
      </Section>
      <Section label="Agent" width={72}>
        <AgentRadio p={p} />
        <Readout label="by agent" does="Entries on the page that an agent wrote." value={held(p.v).agent} />
      </Section>
      <Section label="Save" grow>
        <AutosaveToggle p={p} />
        <Readout label="state" does="Saved, edited since save, or the save router's refusal: stale, conflict, refused." value={saveWords(p.v)} tone={saveTone(saveWords(p.v))} />
        <Action label="Save" does="Send the page to its owner." onPress={() => save(p)} disabled={blocked(p.v) ? SOURCE_MOVED : undefined} />
        <Action label="Re-read" does="Read the page again from its owner. Your draft goes." onPress={() => reread(p)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <DocumentPane v={p.v} />,

  widget: p => <Tile title={`Document · ${short(titleOf(p.v) || KINDS[kindOf(p.v)].label, 14)}`} light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The page" does="The page you hold. Click it to open the page.">
      <Preview v={p.v} w={112} h={104} tile onOpen={p.nav.full} />
    </Display>
    <div className="ref-tile-side">
      <Readout big label="packet" does="Passages in the packet." value={held(p.v).items.length} tone="value" onPress={p.nav.full} />
      <Readout label="chars" does="The size of the packet." value={held(p.v).size} />
      <Readout label="state" does="Saved, or edited since save." value={saveWords(p.v)} tone={saveTone(saveWords(p.v))} />
    </div>
  </Tile>,
}
