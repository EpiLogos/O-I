// The Document (manual §17.8): any Central page, drawn by its template, in a pane. Live's nearest: a device whose panel follows its
// mode, as Simpler's Classic, One-Shot and Slice do — the page kind decides the picture and which controls are live.
// The picture is the page's own structure, drawn from the values: a Flow as its entries or as one page or as its journal
// (documents/ql-flow.html `meta.view`), a Day as the die's net (ql-daily-die.html), a Being or a Thing as its oi.page/v1 sheet with
// its `appearance.layout` and `appearance.tone` (oi-beings.html). Source shows the keys of the `ql-doc` island that each template
// keeps. The sample readings in `defaults` are the Factory flow in Control/user/flows (flow-2026-10-03-1432.html), with a packet of
// three items; the Thing fixture is the blank page that its template starts from. The packet's head reads as the shell reads it
// (central/documentPayload.ts packetHead).
// Everything the page holds is a value: `entries` (a JSON list), `packet` (a JSON list), `journal` (a JSON list of page names),
// `island` (a JSON map of what the other keys of the island hold). A key the owner does not report is absent; the picture then says
// which reading is missing in words, and every control and reading draws "—".
// The actions set their own keys: `save`, `reread`. The save router's outcome is the reading `outcome`.
// Page (manual §17.8, the Page group): Template, View, Flow view, Paper and Pin. Paper (`ground`: template | paper | ink) is the page's
// paper tone: the template's own, light or dark. A Being's or a Thing's `layout` is the page's own appearance, a reading drawn here.
// How an agent's entries arrive is Scope's and Arm's (§16.1), what Answer this reads is the Packet's (§18.3), and whether an answer
// joins or replaces is the transport's Overdub: the Document keeps none of them, and shows the packet only by its size.
// Selection (manual §17.8, the Selection group): `selection` is the passage selected in the page, {entry, text} (the shell's
// selection in the drawn page; absent while nothing is selected). `selectionAct` is what a plain selection does (highlight | note |
// packet | remember | answer); the shell holds it. The five
// passage acts, each on its own key as Central's Clip view writes them: act.highlight and act.note (the page's own island, through
// the save router), act.topacket (the packet, ql-doc `packet`), act.remember (`central.remember` for a page of your own world,
// `projectcentral.remember` for a project's: the passage word for word with its source ref, a proposal that stays unrecognised
// until you recognise it; the kernel's invoke_action reaches both) and act.answerthis (the packet and the passage to the agent on
// the world's chain; the answer arrives as a new entry with its sources). All five owners exist.
// The Thought page (manual §17.8 The Thought page) is Contemplate, for a page that is a Flow: one explicit reading of the Flow by an
// agent, which never runs by itself. Its owner is AIKit's Flow cognition, reached by the kernel's `action:contemplate-flow`: asked bare,
// it answers the preflight (what would be read and touched, by which agent, model and harness; it records nothing); asked with that
// preflight record, it runs once, re-checking the preflight and refusing drift. Changed since is the kernel's flow_changed_since.
//   preflight  {state: 'ready' | 'unavailable', reason?, invocation, model, harness, agent?, focus, changed: [{title, basis?, observed?}],
//              affected: [{title, freshness}]}
//   thought    {state: 'cognition' | 'unavailable' | 'refused', reason?, at, cursor, tensions, candidates, proposals, intents}  the last
//              thought (aikit.flow-cognition/v1); JSON null when the Flow has not been contemplated
//   since      {state: 'available' | 'empty' | 'unavailable', reason?, changed, affected, open: [{kind, reference, state?}]}
//              (aikit.flow-changed-since/v1)
// Acts: preflightRead (ask again), contemplate (the preflight's invocation ref; held: one explicit run), sinceRead. A thought's
// tensions, candidates and proposals wait for you: nothing here applies them. (The Thought page and its parts are the Flow's own,
// central__flow-document.tsx, carried here as the manual now places Contemplate.)
import {useEffect, useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, boolOf, cradleDocuments, has, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
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
const KIND_IDS = Object.keys(KINDS) as KindId[]
const TEMPLATES = KIND_IDS.map(id => ({value: id, label: `${KINDS[id].label} ${KINDS[id].version}`}))
/** The keys of the `ql-doc` island that each template keeps (the forms' own names). What each holds is a reading. */
const ISLAND: Readonly<Record<KindId, readonly string[]>> = {
  flow: ['meta', 'entries', 'notes', 'packet', 'media', 'journal'],
  day: ['meta', 'fields', 'capture', 'sessions', 'completed', 'media', 'notes', 'packet', 'contributions'],
  being: ['profile', 'meta', 'bindings', 'appearance', 'page', 'notes', 'extensions'],
  thing: ['profile', 'meta', 'bindings', 'appearance', 'page', 'notes', 'extensions'],
}

/** The faces of the Day die, in the template's own order (ql-daily-die.html; the Day device draws the same net). */
const FACES = ['Ground', 'Definition', 'Operation', 'Pattern', 'Context', 'Synthesis'] as const
const AT: Record<number, [number, number]> = {2: [1, 0], 4: [0, 1], 0: [1, 1], 1: [2, 1], 5: [3, 1], 3: [1, 2]}

/** The paper of a page, light (`paper`) and dark (`ink`): the shell's paper family (styles.css :root), which the templates draw in
 * too. The tone is the drawing's `data-paper` (styles.css `[data-paper="ink"]`), so each tone names the same tokens. */
const TOKENS = {bg: 'var(--paper)', ink: 'var(--ink)', mid: 'var(--pmid)', faint: 'var(--pfaint)', rule: 'var(--prule)'} as const
const PAPER = {paper: TOKENS, ink: TOKENS} as const

const SELECTION_ACTS = [
  {value: 'highlight', label: 'Highlight', does: 'A plain selection marks the passage and leaves it whole.'},
  {value: 'note', label: 'Note', does: 'A plain selection opens a note on the passage.'},
  {value: 'packet', label: 'To packet', does: 'A plain selection adds the passage to the packet.'},
  {value: 'remember', label: 'Remember', does: 'A plain selection keeps the passage in your ground, as a proposal.'},
  {value: 'answer', label: 'Answer this', does: 'A plain selection sends the packet and the passage to the agent.'},
] as const
const PASSAGE_ACTS = [
  {key: 'act.highlight', label: 'Highlight', does: 'Marks the passage and leaves it whole.'},
  {key: 'act.note', label: 'Note', does: 'Attaches a note to the passage. A note is not a source.'},
  {key: 'act.topacket', label: 'To packet', does: 'Adds the passage to the packet.'},
  {key: 'act.remember', label: 'Remember', does: 'Keeps the passage word for word, with where it came from, as a proposal in your ground. It stays unrecognised until you recognise it.'},
  {key: 'act.answerthis', label: 'Answer this', does: 'Sends the packet and the passage to the agent. The answer arrives as a new entry, with its sources.'},
] as const

const FLOW_VIEWS = [
  {value: 'dialogue', label: 'Dialogue', does: 'The entries in order, as a conversation.'},
  {value: 'flow', label: 'Flow', does: 'One entry at a time as a full page.'},
  {value: 'journal', label: 'Journal', does: 'One person, one page at a time.'},
] as const
const VIEWS = [{value: 'page', label: 'Page', does: 'The page as its template draws it.'}, {value: 'source', label: 'Source', does: 'The text that the page keeps.'}] as const
/** Paper (manual §17.8): the page's paper tone, the template's own, light or dark. Kept on `ground` (paper | ink, or template). */
const PAPERS = [{value: 'template', label: 'Template default', does: 'The paper the template draws.'}, {value: 'paper', label: 'Light', does: 'Dark ink on light paper.'},
  {value: 'ink', label: 'Dark', does: 'Light ink on dark ground.'}] as const
/** The paper a page is drawn on: Light or Dark where you set it, else the template's own (light), or a Being's or Thing's own tone. */
const toneOf = (v: V): 'paper' | 'ink' => (strOf(v, 'ground') === 'ink' ? 'ink' : 'paper')

// ---------------------------------------------------------------- what the page holds, from the values

/** An entry of a Flow (ql-flow.html `D.entries`): `by` is `C` (the coordinator) or `F` (the person); highlights and notes sit on it. */
interface Ent {readonly by: string; readonly head: string; readonly hl?: boolean; readonly note?: boolean}
/** An item of the packet: the words the agent would read, with the scope it was added under (ql-flow.html `D.packet`). */
interface Item {readonly entry: number; readonly scope: string; readonly text: string}

const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const isEnt = (x: unknown): x is Ent => obj(x) && typeof x.by === 'string' && typeof x.head === 'string'
const isItem = (x: unknown): x is Item => obj(x) && typeof x.entry === 'number' && typeof x.scope === 'string' && typeof x.text === 'string'
const isText = (x: unknown): x is string => typeof x === 'string'
/** A list carried as JSON in a key: its readable members, or undefined when the key is absent or does not hold a list. */
function listOf<T>(v: V, key: string, ok: (x: unknown) => x is T): readonly T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.filter(ok) : undefined
}
const entriesOf = (v: V) => listOf(v, 'entries', isEnt)
const packetOf = (v: V) => listOf(v, 'packet', isItem)
const pagesOf = (v: V) => listOf(v, 'journal', isText)

const kindOf = (v: V): KindId | undefined => KIND_IDS.find(id => id === strOf(v, 'template'))
const titleOf = (v: V) => strOf(v, 'title')?.trim()
/** The page's name for a short line: its title; the template's name while it has none; "—" when the title is not reported. */
const nameOf = (v: V) => {
  const title = titleOf(v), kind = kindOf(v)
  return title === undefined ? NONE : title || (kind ? KINDS[kind].label : NONE)
}
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)
const chars = (text: string) => [...text].length

/** The highlights, the notes and the packet that the page holds; each is undefined where the owner reports none. */
function held(v: V) {
  const items = packetOf(v), entries = entriesOf(v)
  return {hl: numOf(v, 'highlights'), notes: numOf(v, 'notes'), items, size: items?.reduce((n, i) => n + chars(i.text), 0), agent: entries?.filter(e => e.by === 'C').length}
}
/** The packet's head in the shell's own words ("Packet · 3 items · 106 chars"). */
function packetWords(v: V) {
  const {items, size} = held(v)
  if (!items) return 'No reading of the packet'
  return items.length ? `Packet · ${items.length} item${items.length === 1 ? '' : 's'} · ${size} chars` : 'Packet · empty'
}

/** The save router's five names (central/documentDeviceModel.ts), and "edited" while the draft is not sent; undefined when neither
 * the outcome nor the draft is reported. */
function saveWords(v: V): string | undefined {
  const outcome = strOf(v, 'outcome')
  if (outcome === 'stale' || outcome === 'conflict' || outcome === 'refused') return outcome
  if (boolOf(v, 'dirty') === true) return 'edited'
  return outcome === 'unchanged' || outcome === 'saved' ? outcome : undefined
}
const saveTone = (words: string | undefined): Tone | undefined => (words === undefined ? undefined : words === 'saved' || words === 'unchanged' ? 'green' : words === 'edited' ? 'accent' : 'stall')
const blocked = (v: V) => ['stale', 'conflict', 'refused'].includes(strOf(v, 'outcome') ?? '')

/** The title on the pane's tab, as the shell names it (central/documents/centralDocuments.ts subjectOf). */
const tabTitle = (v: V) => shown(v, 'tabTitle')

/** The keys of the `ql-doc` island that the template keeps, each with what it holds now ("—" where nothing reports it). */
function sourceKeys(v: V): readonly (readonly [string, string])[] {
  const kind = kindOf(v)
  if (!kind) return []
  const n = held(v), entries = entriesOf(v), seen = json<unknown>(v, 'island', {}), flowView = strOf(v, 'flowView'), layout = strOf(v, 'layout'), ground = strOf(v, 'ground')
  const live: Record<string, string | undefined> = {
    notes: n.notes === undefined ? undefined : `[${n.notes}]`,
    packet: n.items ? `[${n.items.length}]` : undefined,
    ...(kind === 'flow' ? {meta: flowView ? `{view: ${flowView}}` : undefined, entries: entries ? `[${entries.length}]` : undefined} : {}),
    ...(kind === 'being' || kind === 'thing' ? {appearance: layout ? `{${layout}${ground && ground !== 'template' ? ` · ${ground}` : ''}}` : undefined} : {}),
  }
  const reading = (key: string) => { const x = obj(seen) ? seen[key] : undefined; return typeof x === 'string' ? x : NONE }
  return ISLAND[kind].map(key => [key, key in live ? live[key] ?? NONE : reading(key)] as const)
}

/** The one choice that the picture shows with a handle: the Flow's view, or any other page's page or source. */
function stopsOf(kind: KindId) {
  if (kind === 'flow') return {key: 'flowView', def: 'dialogue', items: FLOW_VIEWS, label: 'Flow view', does: 'Drag along the line to choose Dialogue, Flow or Journal.'}
  return {key: 'view', def: 'page', items: VIEWS, label: 'View', does: 'Drag along the line to show the page or its source.'}
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

/** The paper that a Day or a Flow is drawn on: the template's own light paper, or the tone Paper sets. */
const Sheet = ({x, y, w, h}: Box) => <rect x={x} y={y} width={w} height={h} fill={PAPER.paper.bg} />

/** A missing reading, named in words in the middle of the box it would have filled. */
function Words({x, y, w, h, text, onPaper}: Box & {text: string; onPaper?: boolean}) {
  const lines = wrap(text, Math.max(8, Math.floor((w - 12) / 4.2)), 3), top = y + h / 2 - ((lines.length - 1) * 10) / 2 + 3
  return <g>
    {lines.map((line, i) => <text key={i} x={x + w / 2} y={top + i * 10} textAnchor="middle" className={onPaper ? undefined : 'dp-ink-dim'}
      fill={onPaper ? PAPER.paper.mid : undefined} style={{font: '8px var(--font-ui)'}}>{line}</text>)}
  </g>
}

/** A Flow in Dialogue: the last entries, one row each — the author's letter, then a bar as long as the words. */
function FlowDialogue({v, entries, x, y, w, h}: Box & {v: V; entries: readonly Ent[]}) {
  const pitch = h > 88 ? 10 : 11, fit = Math.max(1, Math.floor((h - 6) / pitch)), last = entries.slice(-fit), first = entries.length - last.length
  const picked = new Set<number>((packetOf(v) ?? []).map(i => i.entry))
  return <g>
    {last.map((e, i) => {
      const cy = y + 4 + i * pitch + pitch / 2, len = Math.min(w - 26, Math.max(18, e.head.length * 1.6)), n = first + i + 1
      return <g key={n}>
        <text x={x + 6} y={cy + 2.6} fill={PAPER.paper.ink} style={{font: '700 7px var(--font-ui)'}}>{e.by.slice(0, 1) || NONE}</text>
        <rect x={x + 15} y={cy - 1.4} width={len} height={2.8} fill={PAPER.paper.mid} opacity={e.by === 'F' ? .9 : .5} />
        {e.hl && <rect x={x + 15 + len * .35} y={cy - 2.8} width={len * .4} height={5.6} fill="var(--dp-on)" opacity={.75} />}
        {e.note && <rect x={x + w - 8} y={cy - 2.5} width={5} height={5} fill="none" stroke="var(--dp-value)" strokeWidth={1.2} />}
        {picked.has(n) && <rect x={x + 1.5} y={cy - pitch / 2 + 1.5} width={2} height={pitch - 3} fill="var(--dp-value)" />}
      </g>
    })}
  </g>
}

/** A Flow in Flow view: one entry as a page, with its place in the thread. */
function FlowPage({entries, x, y, w, h}: Box & {entries: readonly Ent[]}) {
  const at = entries.length, e = entries[at - 1], per = Math.max(10, Math.floor((w - 14) / 4.1))
  if (!e) return null
  return <g>
    <text x={x + 7} y={y + 12} fill={PAPER.paper.mid} style={{font: '7.5px var(--font-ui)'}}>{at} of {entries.length} · {e.by === 'F' ? 'You' : e.by === 'C' ? 'Coordinator' : NONE}</text>
    {wrap(e.head, per, 3).map((line, i) => <text key={i} x={x + 7} y={y + 28 + i * 12} fill={PAPER.paper.ink} style={{font: '9.5px var(--serif)'}}>{line}</text>)}
    {[0, 1, 2].map(i => <rect key={i} x={x + 7} y={y + 52 + i * 7} width={(w - 14) * (i === 2 ? .45 : .9)} height={1.6} fill={PAPER.paper.rule} />)}
    <text x={x + 7} y={y + h - 6} fill={PAPER.paper.mid} style={{font: '9px var(--font-ui)'}}>◂</text>
    <text x={x + w - 7} y={y + h - 6} textAnchor="end" fill={PAPER.paper.faint} style={{font: '9px var(--font-ui)'}}>▸</text>
  </g>
}

/** A Flow in Journal: one person's page for a day, and the run of days under it. */
function FlowJournal({pages, x, y, w, h}: Box & {pages: readonly string[]}) {
  const at = pages.length - 1
  return <g>
    <text x={x + 7} y={y + 12} fill={PAPER.paper.mid} style={{font: '7.5px var(--font-ui)'}}>You · {pages[at] ?? NONE}</text>
    {[0, 1, 2, 3, 4].map(i => <rect key={i} x={x + 7} y={y + 20 + i * 9} width={(w - 14) * [.92, .85, .9, .7, .4][i]!} height={1.8} fill={PAPER.paper.rule} />)}
    {pages.map((page, i) => <circle key={`${i}:${page}`} cx={x + w / 2 + (i - at / 2) * 9} cy={y + h - 7} r={2.2} fill={i === at ? 'var(--dp-on)' : PAPER.paper.rule} />)}
  </g>
}

/** A Flow, as the view it is set to reads it; the missing reading is named when the picture lacks one. */
function FlowPicture({v, ...box}: Box & {v: V}) {
  const view = strOf(v, 'flowView'), entries = entriesOf(v), pages = pagesOf(v)
  if (view === 'journal') return pages ? <FlowJournal pages={pages} {...box} /> : <Words {...box} text="No reading of the journal" onPaper />
  if (view !== 'flow' && view !== 'dialogue') return <Words {...box} text="No reading of the Flow view" onPaper />
  if (!entries) return <Words {...box} text="No reading of the entries" onPaper />
  if (!entries.length) return <Words {...box} text="The Flow has no entries" onPaper />
  return view === 'flow' ? <FlowPage entries={entries} {...box} /> : <FlowDialogue v={v} entries={entries} {...box} />
}

/** A Day: the die's net, the open face lit. Without a reading of the open face no face is lit, and the picture says so. */
function DayNet({v, x, y, w, h}: Box & {v: V}) {
  const open = numOf(v, 'face'), names = w > 150, lead = open === undefined ? 14 : 0
  const c = Math.min(Math.floor((w - 8) / 4), Math.floor((h - 6 - lead) / 3)), ox = x + (names ? 6 : (w - c * 4) / 2), oy = y + lead + (h - lead - c * 3) / 2
  return <g>
    {open === undefined && <text x={x + w / 2} y={y + 10} textAnchor="middle" fill={PAPER.paper.mid} style={{font: '7.5px var(--font-ui)'}}>No reading of the face</text>}
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
  const ground = toneOf(v), layout = strOf(v, 'layout')
  if (layout !== 'editorial' && layout !== 'portrait') return <g>
    <rect x={x} y={y} width={w} height={h} fill="none" className="dp-faint" />
    <Words x={x} y={y} w={w} h={h} text="No reading of the page's layout" />
  </g>
  const p = PAPER[ground], editorial = layout === 'editorial', pad = 7
  const rail = Math.round(w * .27), left = x + pad + (editorial ? 20 : 0), colW = x + w - pad - rail - 6 - left
  const markX = editorial ? x + pad + 7 : x + w - pad - 7, title = titleOf(v)
  return <g data-paper={ground}>
    <rect x={x} y={y} width={w} height={h} fill={p.bg} />
    <circle cx={markX} cy={y + pad + 7} r={6.5} fill="none" stroke={p.ink} strokeWidth={.8} />
    <circle cx={markX} cy={y + pad + 7} r={3} fill="none" stroke={p.ink} strokeWidth={.8} strokeDasharray="1 2" />
    <rect x={left} y={y + pad} width={22} height={1.6} fill={p.mid} />
    {title === undefined ? <text x={left} y={y + pad + 14} fill={p.faint} style={{font: '9.5px var(--font-ui)'}}>{NONE}</text>
      : title ? wrap(title, Math.max(8, Math.floor(colW / 5)), 2).map((line, i) => <text key={i} x={left} y={y + pad + 14 + i * 10} fill={p.ink} style={{font: '9.5px var(--serif)'}}>{line}</text>)
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

/** The line with a stop for each choice, and handle 1 on the one that is set. Arrow keys step to the next stop. No handle stands
 * while the choice is not reported: no stop is the set one. */
function Stops({v, set, w, kind}: {v: V; set?: SetFn; w: number; kind: KindId}) {
  const st = stopsOf(kind), n = st.items.length, xs = st.items.map((_, i) => 8 + (w - 16) * (i + .5) / n)
  const now = strOf(v, st.key), at = st.items.findIndex(item => item.value === now)
  const go = (i: number) => set?.(st.key, st.items[Math.min(n - 1, Math.max(0, i))]!.value)
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={8} x2={w - 8} y1={32} y2={32} className="dp-faint" />
    {st.items.map((item, i) => <g key={item.value} onClick={() => go(i)} style={{cursor: set ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - (w - 16) / n / 2} y={16} width={(w - 16) / n} height={20} fill="transparent" />
      <circle cx={xs[i]} cy={32} r={2} className="dp-faint" />
      <text x={xs[i]} y={25} textAnchor="middle" className={i === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8.5}}>{item.label}</text>
    </g>)}
    {set && at >= 0 && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(at + d) }
    }}>
      <Handle x={xs[at]!} y={32} n={1} shape="square" label={st.label} does={st.does} onDrag={px => go(near(px))} onReset={() => set(st.key, st.def)} />
    </g>}
  </g>
}

/** The well: the title and the choice that the handle sets, then the page, then the packet's head. `tile` draws the page alone. */
function Preview({v, set, w, h, tile, onOpen}: {v: V; set?: SetFn; w: number; h: number; tile?: boolean; onOpen?: () => void}) {
  const kind = kindOf(v), source = strOf(v, 'view') === 'source'
  const box: Box = tile ? {x: 6, y: 6, w: w - 12, h: h - 12} : {x: 6, y: 38, w: w - 12, h: h - 62}
  const packet = !tile && <text x={6} y={h - 8} className="dp-ink-dim" style={{fontSize: 8.5}}>{packetWords(v)}</text>
  if (!kind) return <g>
    {!tile && <text x={6} y={12} className="dp-ink-dim">{NONE}</text>}
    <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" className="dp-faint" />
    <Words {...box} text="No reading of the template" />
    {packet}
  </g>
  const k = KINDS[kind], title = titleOf(v)
  const name = title || (kind === 'day' ? shown(v, 'date') : title === undefined ? NONE : 'Untitled')
  const headline = `${w > 160 ? `${k.label} ${k.version} · ` : ''}${name}`
  return <g>
    {!tile && <text x={6} y={12} className="dp-ink-dim" data-i={`${name}|The page's title, as its template heads it.`}>{short(headline, Math.floor((w - 44) / 4.5))}</text>}
    {!tile && <Stops v={v} set={set} w={w} kind={kind} />}
    <g onClick={onOpen} style={{cursor: onOpen ? 'pointer' : undefined}}>
      {source ? <SourceLines v={v} {...box} />
        : kind === 'day' ? <g data-paper={toneOf(v)}><Sheet {...box} /><DayNet v={v} {...box} /></g>
        : kind === 'flow' ? <g data-paper={toneOf(v)}><Sheet {...box} /><FlowPicture v={v} {...box} /></g>
        : <PageSheet v={v} {...box} />}
    </g>
    {packet}
  </g>
}

// ---------------------------------------------------------------- the pane: the real template page, or its source

/** The `ql-doc` island of a template, as readable text: what the page keeps. */
function islandText(html: string) {
  const match = html.match(/<script type="application\/json" id="ql-doc">([\s\S]*?)<\/script>/)
  if (!match) return 'This template holds no ql-doc island.'
  let text = match[1]!
  try { text = JSON.stringify(JSON.parse(text), null, 2) } catch { /* the island is shown as it is */ }
  return text.split('\n').slice(0, 400).map(line => (line.length > 160 ? `${line.slice(0, 160)}…` : line)).join('\n')
}

function Source({root, file}: {root: string; file: string}) {
  const [text, setText] = useState<string>()
  useEffect(() => {
    let alive = true
    setText(undefined)
    fetch(`${root}/${file}`).then(r => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then(html => { if (alive) setText(islandText(html)) }).catch(error => { if (alive) setText(`The template did not load (${String(error)}).`) })
    return () => { alive = false }
  }, [root, file])
  return <pre className="cdoc-source" aria-label="The text that the page keeps">{text ?? 'Reading the template…'}</pre>
}

/** The pane's body. The gallery serves the templates and draws the page here; the shell draws a template's Full itself, so with no
 * template root nothing but the tab stands. */
function DocumentPane({v}: {v: V}) {
  const kind = kindOf(v), root = cradleDocuments(), file = kind ? KINDS[kind].file : undefined
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{tabTitle(v)}</button>
    </div>
    {root && file && (strOf(v, 'view') === 'source'
      ? <Source root={root} file={file} />
      : <iframe className="ref-pane-frame" title="The page, as its template draws it" src={`${root}/${file}`} />)}
  </div>
}

// ---------------------------------------------------------------- the controls

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>

const NO_TEMPLATE = 'No reading of the template.'
/** The passage selected in the page, or undefined while nothing is (or the shell reports no selection). */
const passage = (v: V): {entry?: number; text: string} | undefined => {
  const s = json<unknown>(v, 'selection', null)
  return s && typeof s === 'object' && typeof (s as {text?: unknown}).text === 'string' && (s as {text: string}).text
    ? {entry: typeof (s as {entry?: unknown}).entry === 'number' ? (s as {entry: number}).entry : undefined, text: (s as {text: string}).text} : undefined
}
const flowOnly = (v: V) => { const k = kindOf(v); return k === 'flow' ? undefined : k ? `A ${KINDS[k].label} has no Flow view.` : NO_TEMPLATE }
const SOURCE_MOVED = 'The source moved after your draft. Re-read to review it.'

function FlowViewRadio({p}: {p: ViewProps}) {
  return <Radio label="Flow view" does="How a Flow reads: Dialogue, Flow or Journal." value={strOf(p.v, 'flowView') ?? ''} options={FLOW_VIEWS} stack onChange={x => p.set('flowView', x)} disabled={flowOnly(p.v)} />
}
function ViewRadio({p}: {p: ViewProps}) {
  return <Radio label="View" does="The drawn page, or the text that it keeps." value={strOf(p.v, 'view') ?? ''} options={VIEWS} stack onChange={x => p.set('view', x)} />
}
function SelectionActChooser({p}: {p: ViewProps}) {
  return <Chooser {...st(p, 'selectionAct')} label="Selection act" wide does="What a plain selection does: Highlight, Note, To packet, Remember or Answer this."
    value={strOf(p.v, 'selectionAct') ?? ''} options={SELECTION_ACTS} onChange={x => p.set('selectionAct', x)} />
}
function PinToggle({p}: {p: ViewProps}) {
  const now = boolOf(p.v, 'pinned')
  return <Toggle label="Pin" does="Keep this page in its pane while you select elsewhere." on={now === true} unknown={now === undefined} onChange={x => p.set('pinned', x)} />
}
function AutosaveToggle({p}: {p: ViewProps}) {
  const now = boolOf(p.v, 'autosave')
  return <Toggle label="Autosave" does="Save a short time after you stop. A moved source still keeps your draft." on={now === true} unknown={now === undefined} onChange={x => p.set('autosave', x)} />
}

// ---------------------------------------------------------------- Thought: Contemplate the Flow, and what changed since
// Carried from the Flow's design (central__flow-document.tsx), where these parts were drawn first.

const text = (x: unknown) => (typeof x === 'string' ? x : typeof x === 'number' && Number.isFinite(x) ? String(x) : '')
const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const record = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {})

type Fresh = 'basis-changed' | 'integration-pending' | 'basis-unavailable'
interface Moved {readonly title: string; readonly basis?: string; readonly observed?: string; readonly kind?: string}
interface Touched {readonly title: string; readonly freshness: Fresh}
interface Open {readonly kind: 'tension' | 'candidate' | 'human-source-proposal' | 'flow-mutation-intent'; readonly reference: string; readonly state?: string}
interface Preflight {readonly state: 'ready' | 'unavailable'; readonly reason?: string; readonly invocation?: string; readonly model?: string; readonly harness?: string
  readonly agent?: string; readonly focus: number; readonly changed: readonly Moved[]; readonly affected: readonly Touched[]}
interface Thought {readonly state: 'cognition' | 'unavailable' | 'refused'; readonly reason?: string; readonly at?: string; readonly cursor?: number; readonly tensions: number; readonly candidates: number
  readonly proposals: number; readonly intents: number}
interface Since {readonly state: 'available' | 'empty' | 'unavailable'; readonly reason?: string; readonly changed: readonly Moved[]; readonly affected: readonly Touched[]; readonly open: readonly Open[]}
const FRESH: readonly string[] = ['basis-changed', 'integration-pending', 'basis-unavailable']
const OPEN_KINDS: readonly string[] = ['tension', 'candidate', 'human-source-proposal', 'flow-mutation-intent']
const OPEN_WORD: Readonly<Record<Open['kind'], string>> = {tension: 'tension', candidate: 'candidate', 'human-source-proposal': 'proposal to your ground', 'flow-mutation-intent': 'change to the Flow'}
const FRESH_WORD: Readonly<Record<Fresh, string>> = {'basis-changed': 'source moved', 'integration-pending': 'waits to integrate', 'basis-unavailable': 'source gone'}
const movedOf = (x: unknown): Moved[] => (Array.isArray(x) ? x : []).flatMap(y => { const r = record(y); return text(r.title) ? [{title: text(r.title), basis: text(r.basis) || undefined, observed: text(r.observed) || undefined, kind: text(r.kind) || undefined}] : [] })
const touchedOf = (x: unknown): Touched[] => (Array.isArray(x) ? x : []).flatMap(y => { const r = record(y); return text(r.title) && FRESH.includes(text(r.freshness)) ? [{title: text(r.title), freshness: r.freshness as Fresh}] : [] })

/** The preflight `action:contemplate-flow` answers before anything runs: what Contemplate would read and touch. Undefined when not read. */
function preflightOf(v: V): Preflight | undefined {
  const raw = json<unknown>(v, 'preflight', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const r = record(raw)
  return {state: r.state === 'ready' ? 'ready' : 'unavailable', reason: text(r.reason) || undefined, invocation: text(r.invocation) || undefined, model: text(r.model) || undefined,
    harness: text(r.harness) || undefined, agent: text(r.agent) || undefined, focus: count(r.focus) ?? 0, changed: movedOf(r.changed), affected: touchedOf(r.affected)}
}
/** The last thought: one explicit Contemplate and what it returned, or its unavailable or refused reading. */
function thoughtOf(v: V): Thought | null | undefined {
  if (!has(v, 'thought')) return undefined
  const raw = json<unknown>(v, 'thought', undefined)
  if (raw === null) return null
  const r = record(raw)
  if (r.state !== 'cognition' && r.state !== 'unavailable' && r.state !== 'refused') return undefined
  return {state: r.state, reason: text(r.reason) || undefined, at: text(r.at) || undefined, cursor: count(r.cursor), tensions: count(r.tensions) ?? 0, candidates: count(r.candidates) ?? 0,
    proposals: count(r.proposals) ?? 0, intents: count(r.intents) ?? 0}
}
/** What changed relative to the thought: changed sources, the knowledge they affect, and the thought's returns still open. */
function sinceOf(v: V): Since | undefined {
  const raw = json<unknown>(v, 'since', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const r = record(raw)
  const open = (Array.isArray(r.open) ? r.open : []).flatMap((y): Open[] => { const o = record(y); return OPEN_KINDS.includes(text(o.kind)) && text(o.reference) ? [{kind: o.kind as Open['kind'], reference: text(o.reference), state: text(o.state) || undefined}] : [] })
  return {state: r.state === 'available' ? 'available' : r.state === 'empty' ? 'empty' : 'unavailable', reason: text(r.reason) || undefined, changed: movedOf(r.changed), affected: touchedOf(r.affected), open}
}
/** Contemplate reads a Flow: for any other page the Thought page stands closed and says why. */
const notFlow = (v: V): string | undefined => { const k = kindOf(v); return k === 'flow' ? undefined : k ? `Contemplate reads a Flow; this page is a ${KINDS[k].label}.` : NO_TEMPLATE }

/** The horizon: the thought as a diamond at the left, now at the right. Between them, on three lanes, what moved since — the sources, the
 * knowledge they affect, and the thought's returns still open. With no thought yet, the lanes hold what Contemplate's preflight would read. */
function Horizon({v, w, h}: {v: V; w: number; h: number}) {
  const pre = preflightOf(v), thought = thoughtOf(v), since = sinceOf(v), closed = notFlow(v)
  const tx = 62, nx = w - 10, lanes = [38, 74, 110], label = ['sources', 'knowledge', 'open'] as const
  const showSince = thought?.state === 'cognition' && since !== undefined
  const changed = showSince ? since!.changed : pre?.changed ?? [], affected = showSince ? since!.affected : pre?.affected ?? []
  const spread = (n: number, i: number) => tx + 10 + ((i + .5) * (nx - tx - 16)) / Math.max(1, n)
  const corner = closed ? NONE : showSince ? (thought!.cursor === undefined ? since!.state : `cursor ${thought!.cursor}`) : pre ? `preflight ${pre.state}` : NONE
  return <Display w={w} h={h} label="Thought" corner={corner}
    does="The last thought at the left, now at the right. Between them: the sources that moved since, the knowledge they affect, and the thought's returns still open. Before a thought, what the preflight would read.">
    {label.map((l, i) => <g key={l}><text x={6} y={lanes[i]! + 3} className="dp-axis">{l}</text><path d={`M${tx} ${lanes[i]}H${nx}`} className="dp-grid" /></g>)}
    <path d={`M${tx} 20V${h - 14}`} stroke={thought?.state === 'cognition' && !closed ? 'var(--dp-on)' : 'var(--text-faint)'} strokeDasharray="2 2" />
    <path d={`M${nx} 20V${h - 14}`} className="dp-faint" />
    {thought?.state === 'cognition' && !closed
      ? <path d={`M${tx} 13l5 5-5 5-5-5z`} fill="var(--dp-on)" />
      : <path d={`M${tx} 13l5 5-5 5-5-5z`} fill="none" stroke={thought && !closed ? 'var(--stall)' : 'var(--text-faint)'} />}
    <text x={tx} y={h - 4} className="dp-axis" textAnchor="middle">{closed ? 'no thought' : thought?.state === 'cognition' ? 'thought' : thought ? thought.state : 'no thought'}</text>
    <text x={nx} y={h - 4} className="dp-axis" textAnchor="end">now</text>
    {closed ? <text x={(tx + nx) / 2} y={lanes[1]! + 3} className="dp-ink-dim" textAnchor="middle">Contemplate reads a Flow</text> : <>
      <g opacity={showSince ? 1 : .55}>
        {changed.map((c, i) => <rect key={`c${i}`} x={spread(changed.length, i) - 3} y={lanes[0]! - 3} width={6} height={6} fill="var(--stall)" data-i={`${c.title}|Moved${c.basis && c.observed ? ` from ${c.basis} to ${c.observed}` : ''}.`} />)}
        {affected.map((a, i) => <circle key={`a${i}`} cx={spread(affected.length, i)} cy={lanes[1]} r={3.2} data-i={`${a.title}|${FRESH_WORD[a.freshness]}.`}
          fill={a.freshness === 'basis-changed' ? 'var(--dp-well)' : 'none'} stroke={a.freshness === 'basis-changed' ? 'var(--stall)' : a.freshness === 'integration-pending' ? 'var(--dp-value)' : 'var(--text-faint)'}
          strokeWidth={1.2} strokeDasharray={a.freshness === 'basis-changed' ? undefined : '1.5 1.5'} />)}
      </g>
      {showSince && since!.open.map((o, i) => <rect key={`o${i}`} x={tx + 6 + (i % 12) * 9} y={lanes[2]! - 3.5 + Math.floor(i / 12) * 9} width={7} height={7} fill="none" data-i={`${o.reference}|${OPEN_WORD[o.kind]}, still open.`}
        stroke={o.kind === 'tension' ? 'var(--stall)' : o.kind === 'human-source-proposal' ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.2} />)}
      {!pre && !thought && <text x={(tx + nx) / 2} y={lanes[1]! + 3} className="dp-ink-dim" textAnchor="middle">No reading of the preflight</text>}
      {showSince && since!.state !== 'available' && <text x={(tx + nx) / 2} y={lanes[1]! + 3} className="dp-ink-dim" textAnchor="middle">{since!.state === 'empty' ? 'Nothing changed since' : 'Changed since is unavailable'}</text>}
    </>}
  </Display>
}

function thoughtRows(v: V): RowItem[] {
  const pre = preflightOf(v), thought = thoughtOf(v), since = sinceOf(v), closed = notFlow(v)
  if (closed) return [{id: 'none', name: closed, light: 'unknown'}]
  if (thought?.state === 'cognition' && since) {
    if (since.state === 'unavailable') return [{id: 'u', name: 'Changed since is unavailable', light: 'dark', why: since.reason ?? 'The owner gave no reason.'}]
    const rows: RowItem[] = [
      ...since.changed.map((c, i) => ({id: `c${i}`, name: c.title, light: 'lit' as LightState, tone: 'stall' as const, note: c.basis && c.observed ? `${c.basis} → ${c.observed}` : c.kind ?? 'moved'})),
      ...since.affected.map((a, i) => ({id: `a${i}`, name: a.title, light: (a.freshness === 'basis-unavailable' ? 'dark' : 'lit') as LightState, tone: 'value' as const, note: FRESH_WORD[a.freshness]})),
      ...since.open.map((o, i) => ({id: `o${i}`, name: o.reference, light: 'lit' as LightState, tone: o.kind === 'tension' ? 'stall' as const : 'accent' as const, note: OPEN_WORD[o.kind], does: `Returned by the thought and still open${o.state ? `: ${o.state}` : ''}.`})),
    ]
    return rows.length ? rows : [{id: 'none', name: 'Nothing changed since the thought', light: 'lit', tone: 'green'}]
  }
  if (!pre) return [{id: 'none', name: 'No reading of the preflight', light: 'unknown'}]
  if (pre.state === 'unavailable') return [{id: 'u', name: 'Contemplate is unavailable', light: 'dark', why: pre.reason ?? 'The owner gave no reason.'}]
  return [
    {id: 'who', name: `${pre.agent ?? 'An agent'} on ${pre.model ?? NONE} through ${pre.harness ?? NONE}`, light: 'lit', tone: 'value', note: 'runs it'},
    {id: 'focus', name: `${pre.focus} entr${pre.focus === 1 ? 'y' : 'ies'} of the Flow`, light: 'lit', tone: 'value', note: 'reads'},
    ...pre.changed.map((c, i) => ({id: `c${i}`, name: c.title, light: 'lit' as LightState, tone: 'stall' as const, note: 'moved'})),
    ...pre.affected.map((a, i) => ({id: `a${i}`, name: a.title, light: 'lit' as LightState, tone: 'value' as const, note: FRESH_WORD[a.freshness]})),
  ]
}

/** The Thought page: the horizon, Contemplate with its preflight, what changed since, and what the preflight or the thought reads. */
function ThoughtBands({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const pre = preflightOf(p.v), thought = thoughtOf(p.v), since = sinceOf(p.v), closed = notFlow(p.v)
  const cognition = thought?.state === 'cognition' && !closed
  // The pool is 400 wide: the horizon and Contemplate stand in band one; what changed since and its rows in band two.
  return <>
    <Band>
      <Section width={206}><Horizon v={p.v} w={194} h={146} /></Section>
      <Section label="Contemplate" cols={2} grow>
        <Readout label="preflight" does="What the preflight answers: ready, or unavailable with the owner's reason. It records nothing." value={closed ? undefined : pre?.state} tone={pre?.state === 'ready' ? 'green' : pre ? 'stall' : undefined} />
        <Readout label="runs on" does="The model Contemplate would run on, named by the preflight." value={closed || pre?.model === undefined ? undefined : (m => (m.length > 14 ? `${m.slice(0, 13)}…` : m))(pre.model.replace('model:', '').replace('claude-', ''))} />
        {span(2, <Action {...st(p, 'preflightRead')} label="Preflight" does="Shows what Contemplate would read and touch. Nothing runs and nothing is recorded." onPress={() => p.set('preflightRead', true)}
          disabled={st(p, 'preflightRead').disabled ?? closed} />)}
        {span(2, <Action {...st(p, 'contemplate')} hold label="Contemplate" does="Runs the reading once, under the preflight you read. It never runs by itself."
          onPress={pre?.state === 'ready' && pre.invocation ? () => p.set('contemplate', pre.invocation) : undefined}
          disabled={st(p, 'contemplate').disabled ?? closed ?? (!pre ? 'Read the preflight first.' : pre.state !== 'ready' ? pre.reason ?? 'The preflight is unavailable.' : undefined)} />)}
      </Section>
    </Band>
    <Band>
      <Section label="Since" cols={2} width={128}>
        {span(2, <Readout label="thought" does="When the last thought was taken, or why it could not run." value={closed ? undefined : thought === null ? 'none' : thought ? (thought.state === 'cognition' ? thought.at : thought.state) : undefined}
          tone={thought && thought.state !== 'cognition' ? 'stall' : undefined} />)}
        <Readout label="open" does="What the thought returned that waits for you: tensions, candidates, proposals to your ground, changes to the Flow." value={cognition ? since?.open.length ?? thought!.tensions + thought!.candidates + thought!.proposals + thought!.intents : undefined} tone="accent" />
        <Readout label="moved" does="Sources that moved since the thought." value={since && cognition ? since.changed.length : undefined} tone="stall" />
        <Readout label="affected" does="Knowledge those sources affect." value={since && cognition ? since.affected.length : undefined} />
        <span />
        {span(2, <Action {...st(p, 'sinceRead')} label="Changed since" does="Shows what moved after the thought, and what it left open. Nothing runs and nothing is recorded."
          onPress={cognition ? () => p.set('sinceRead', true) : undefined} disabled={st(p, 'sinceRead').disabled ?? closed ?? (cognition ? undefined : 'There is no thought to read from.')} />)}
      </Section>
      <Section grow><Rows label={cognition && since ? `Since the thought · ${since.state}` : 'What the preflight would read'}
        does="Before a thought: who would run it and what it would read. After one: what moved since, what it affects, and what the thought left open." items={thoughtRows(p.v)} size={7} page={page} onPage={setPage} /></Section>
    </Band>
  </>
}

type PageId = 'page' | 'thought'
const PAGE_IDS: readonly {id: PageId; label: string}[] = [{id: 'page', label: 'Page'}, {id: 'thought', label: 'Thought'}]
const pageOf = (p: ViewProps): PageId => (p.page === 'thought' ? 'thought' : 'page')

// The Thought page's sample: the Factory flow's preflight, a thought taken on 15 Oct, and what changed since (the run's ledger and its
// continuation note moved; the unit list it named is affected; two tensions and a proposal remain open). The Flow's own sample.
const PREFLIGHT = {state: 'ready', invocation: 'flow-contemplate/b3:5e1c09a2', agent: 'Factory coordinator', model: 'model:claude-sonnet-4.6', harness: 'claude-code', focus: 13,
  changed: [{title: 'factory/runs/original-development.json', basis: 'r21', observed: 'r24'}],
  affected: [{title: 'wiki:Factory · original development Run', freshness: 'basis-changed'}, {title: 'Run units (7 required)', freshness: 'integration-pending'}]}
const THOUGHT = {state: 'cognition', at: '15 Oct 22:40', cursor: 3911, tensions: 2, candidates: 3, proposals: 1, intents: 1}
const SINCE = {state: 'available',
  changed: [{title: 'factory/runs/original-development.json', basis: 'r21', observed: 'r24'}, {title: 'Control/user/flows/flow-2026-10-03-1432.html', basis: 'r8', observed: 'r9'}],
  affected: [{title: 'wiki:Factory · original development Run', freshness: 'basis-changed'}, {title: 'Run units (7 required)', freshness: 'integration-pending'}, {title: 'omarchy startup image', freshness: 'basis-unavailable'}],
  open: [{kind: 'tension', reference: 'Two-machine Run vs. one-machine image', state: 'unresolved'}, {kind: 'tension', reference: 'Workers not started', state: 'unresolved'},
    {kind: 'human-source-proposal', reference: 'Control/user/factory-intent.md', state: 'basis-superseded'}, {kind: 'candidate', reference: 'Start the first worker on Omarchy', state: 'unresolved'}]}

const defaults = {
  light: 'lit', template: 'flow', title: 'Factory original development Run — execution and continuation', view: 'page', flowView: 'dialogue', ground: 'template', layout: 'portrait', pinned: false,
  autosave: true, selectionAct: 'highlight',
  selection: JSON.stringify({entry: 8, text: 'The first worker can retain its coordinator'}),
  // Readings and the state of the page: what the owner reports, and the draft.
  dirty: false, outcome: 'saved', face: 1, date: 'Wed 15 Oct', tabTitle: 'Flow · flow-2026-10-03-1432', highlights: 2, notes: 1,
  // The Factory flow's entries (flow-2026-10-03-1432.html): `C` the Factory coordinator, `F` the person. Highlights and a note sit on
  // entries 3, 8 and 4.
  entries: JSON.stringify([
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
  ]),
  // The packet: each item is the words the agent would read, with the scope it was added under (ql-flow.html `D.packet`). The Document
  // shows its size; the packet itself is the Packet's (§18.3).
  packet: JSON.stringify([
    {entry: 3, scope: 'selection', text: 'The original development Run remains incomplete'},
    {entry: 6, scope: 'whole entry', text: 'The original Run remains incomplete'},
    {entry: 9, scope: 'selection', text: 'Which unit starts first?'},
  ]),
  journal: JSON.stringify(['Mon 13 Oct', 'Tue 14 Oct', 'Wed 15 Oct']),
  // What the island's other keys hold, by key (the keys that the page's own readings fill are not listed).
  island: JSON.stringify({media: '[0]', journal: '[…]'}),
  // Thought: the preflight `action:contemplate-flow` answered, the last thought, and what changed since it (the kernel's flow_changed_since).
  preflight: JSON.stringify(PREFLIGHT), thought: JSON.stringify(THOUGHT), since: JSON.stringify(SINCE),
} as const

/** The Page page: the page and every parameter (Page), the passage and its acts (Selection), and the save (Save). */
function PageBands({p}: {p: ViewProps}) {
  return <>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The page" does="The page as its template draws it, or the keys of its source. Drag handle 1 along the line to choose how it reads."
          corner={saveWords(p.v) ?? NONE}>
          <Preview v={p.v} set={p.set} w={194} h={146} />
        </Display>
      </Section>
      <Section label="Page" cols={3} grow>
        {span(3, <Chooser label="Template" does="The template that draws the page. A page keeps its version until you change it." value={kindOf(p.v) ?? ''} options={TEMPLATES} onChange={x => p.set('template', x)} />)}
        {span(2, <Radio label="View" does="The drawn page, or the text that it keeps." value={strOf(p.v, 'view') ?? ''} options={VIEWS} onChange={x => p.set('view', x)} />)}
        <PinToggle p={p} />
        {span(3, <Radio label="Flow view" does="How a Flow reads: Dialogue, Flow or Journal." value={strOf(p.v, 'flowView') ?? ''} options={FLOW_VIEWS} onChange={x => p.set('flowView', x)} disabled={flowOnly(p.v)} />)}
        {span(3, <Radio {...st(p, 'ground')} label="Paper" does="The paper tone of the page: the template's own, light or dark." value={strOf(p.v, 'ground') ?? ''} options={PAPERS} onChange={x => p.set('ground', x)} />)}
      </Section>
    </Band>
    <Band>
      <Section label="Selection" cols={3} width={290}>
        {span(3, <SelectionActChooser p={p} />)}
        {span(3, <p className="cdoc-passage" data-i="Passage|The passage selected in the page. The acts beside it work on it.">{passage(p.v) ? <><b>{passage(p.v)!.entry === undefined ? '' : `${passage(p.v)!.entry} · `}</b>{passage(p.v)!.text}</>
          : <i>{has(p.v, 'selection') ? 'Select a passage in the page.' : NONE}</i>}</p>)}
        {PASSAGE_ACTS.map(a => <Action key={a.key} {...st(p, a.key)} label={a.label} does={a.does} onPress={() => p.set(a.key, Date.now())}
          disabled={st(p, a.key).disabled ?? (!passage(p.v) ? 'Select a passage first.' : undefined)} />)}
      </Section>
      <Section label="Save" grow>
        <AutosaveToggle p={p} />
        <Readout label="state" does="Saved, edited since save, or the save router's refusal: stale, conflict, refused." value={saveWords(p.v)} tone={saveTone(saveWords(p.v))} />
        <Action label="Save" does="Send the page to its owner." onPress={() => p.set('save', true)} disabled={blocked(p.v) ? SOURCE_MOVED : undefined} />
        <Action label="Re-read" does="Read the page again from its owner. Your draft goes." onPress={() => p.set('reread', true)} />
      </Section>
    </Band>
  </>
}

export const design: DesignedDevice = {
  id: 'central:document',
  title: 'Document',
  kind: 'instrument',
  defaults,
  firstPage: 'page',
  fixtures: {
    Flow: {},
    Thing: {
      template: 'thing', title: '', layout: 'editorial', tabTitle: 'Thing', highlights: 0, notes: 0, entries: undefined, journal: undefined, packet: JSON.stringify([]),
      island: JSON.stringify({profile: '"oi.page/v1"', meta: '{…}', bindings: '{…}', page: '{…}', extensions: '{}'}), ground: 'ink',
      preflight: undefined, thought: undefined, since: undefined,
    },
    'Stale save': {dirty: true, outcome: 'stale'},
    'Nothing selected': {selection: 'null', selectionAct: 'remember'},
    'Not contemplated yet': {thought: 'null', since: undefined},
    'Contemplate unavailable': {thought: 'null', since: undefined, preflight: JSON.stringify({state: 'unavailable', reason: 'No host executor: this suite has no model seam for Contemplate yet.', focus: 0, changed: [], affected: []})},
    'No readings': Object.fromEntries(Object.keys(defaults).map(key => [key, undefined])),
  },

  folded: p => <Folded title="Document" light={light(p)} readings={[short(nameOf(p.v), 9), saveWords(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Document" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page" does="The page as its template draws it, and the size of its packet. Drag handle 1 along the line to choose how it reads." corner={saveWords(p.v) ?? NONE}>
        <Preview v={p.v} set={p.set} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <ViewRadio p={p} />
      <FlowViewRadio p={p} />
      {span(2, <SelectionActChooser p={p} />)}
      {span(2, <AutosaveToggle p={p} />)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Document" view="whole" {...head(p)} pages={PAGE_IDS} page={pageOf(p)} onPage={p.setPage}>
    {pageOf(p) === 'thought' ? <ThoughtBands p={p} /> : <PageBands p={p} />}
  </Panel>,

  full: p => <DocumentPane v={p.v} />,

  widget: p => <Tile title={`Document · ${short(nameOf(p.v), 14)}`} light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The page" does="The page you hold. Click it to open the page.">
      <Preview v={p.v} w={112} h={104} tile onOpen={p.nav.full} />
    </Display>
    <div className="ref-tile-side">
      <Readout big label="packet" does="Passages in the packet." value={held(p.v).items?.length} tone="value" onPress={p.nav.full} />
      <Readout label="chars" does="The size of the packet." value={held(p.v).size} />
      <Readout label="state" does="Saved, or edited since save." value={saveWords(p.v)} tone={saveTone(saveWords(p.v))} />
    </div>
  </Tile>,
}
