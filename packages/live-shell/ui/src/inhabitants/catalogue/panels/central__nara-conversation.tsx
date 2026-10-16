// The Answer (manual §18.10, central:nara-conversation): the agent that answers in a Central workspace, last on a document's chain.
// Live's nearest: Operator or Simpler — an instrument with a well that draws what it does and a short row of macros. The well
// draws the exchange by the owner's own law: the turn against the native budget of 256 KiB (desktop/cradle/src/nara/nativeDialogue.ts:232),
// the question and the answer in the conversation, and where the answer lands in the page (nara/nativeReturn.ts: a new entry through
// appendEntry, a quotation proposed for review, or a revision-checked write into the Flow). The binding is the owner's reading
// (oi.nara-dialogue-binding/v1): it lights the activator. Its Full view is the exchange itself, with the composer.
// Everything the exchange holds is a value. The owner reports:
//   agents   JSON [{id, name, does?, role?}]            the roster; `role` is the dialogue role the owner binds (nara, epii).
//   thread   JSON [{who, kind, text, tool?, state?, parts?}]   the Agent device's thread rows. kind: you (the question), agent (the
//            answer; `parts` [{t, s?}] splits it into claims, `s` the number of the source of a claim), proposal (what waits in the
//            page: `text` where it lands, `tool` the document, `state` waits or declined), receipt (what was written: `text`, `tool`
//            with the revision). The line you just sent (`sent`) follows when the thread does not hold it yet.
//   packet   JSON [{entry, scope, text, label?, bytes?}]   Document's packet items; `label` names an item that is no entry, `bytes`
//            is its size when `text` shows only the start of it (else the size of `text`).
//   sources  JSON [{n, name, tag, at, lines: [{n, t, hit?}]}]   what the answer cites, each with the lines around its line.
//   document, entry, state (idle · reading · answering), context (bytes of identity and Expression the turn carries), resume.
// The actions set their own keys: `sent` (the composer), `accept` and `decline` (the proposal). A key the owner does not report is
// absent; the views then draw "—" and name the missing reading in words.
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, type LightState, type Option} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {NONE, boolOf, clampTo, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__nara-conversation.css'

type V = ViewProps['v']

/** The shell's four effort steps (agent/AgentShellContext.tsx:28). */
const EFFORTS = ['low', 'medium', 'high', 'max'] as const
const WRITES = ['off', 'propose', 'write'] as const
const WRITES_LABEL: Readonly<Record<string, string>> = {off: 'Off', propose: 'Propose', write: 'Write'}
/** The native turn budget: a turn above 256 KiB is refused (nara/nativeDialogue.ts:232). */
const BUDGET = 256 * 1024
const kb = (bytes: number) => `${bytes < 10240 ? (bytes / 1024).toFixed(1) : Math.round(bytes / 1024)} KB`
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)

const ANSWER_AS: readonly Option<string>[] = [
  {value: 'new', label: 'New', does: 'The answer joins as a new entry after the last entry.'},
  {value: 'replace', label: 'Replace', does: 'The answer takes the place of the selected entry.'},
]
const WRITE_OPTIONS: readonly Option<string>[] = [
  {value: 'off', label: 'Off', does: 'The answer shows in the conversation only.'},
  {value: 'propose', label: 'Propose', does: 'The answer waits in the page for you to accept it.'},
  {value: 'write', label: 'Write', does: 'The answer goes into the page at once, with a receipt.'},
]

const SAYS = {
  agent: 'Who answers: Nara, Epii, or an agent from your roster.',
  answerAs: 'New entry adds the answer after the last entry. Replace puts it in place of the selected entry.',
  writes: 'Off: the answer stays in the conversation. Propose: it waits in the page for you. Write: it goes in with a receipt.',
  effort: 'How hard the agent thinks on each answer. Drag handle 1 across the rungs.',
}

// ---------------------------------------------------------------- the sample material (the gallery's fixtures)
// The views never read these: the owner's lists arrive on `agents`, `packet`, `thread` and `sources`, and a list that is missing
// draws as a missing reading.

const DOC = 'Factory original development Run'
const QUESTION = 'What does this entry ask of me?'
/** The agents: the two roles the owner binds (nara/dialogueTypes.ts) and the agents of Central's roster (Control/self/agents). */
const SAMPLE_AGENTS = [
  {id: 'nara', name: 'Nara', does: 'Answers to this person in this Expression.', role: 'nara'},
  {id: 'epii', name: 'Epii', does: 'Investigates through the Epi-Logos sources.', role: 'epii'},
  {id: 'cairn', name: 'Cairn', does: 'A patient interpreter.'},
  {id: 'flint', name: 'Flint', does: 'A grounded investigator.'},
  {id: 'kite', name: 'Kite', does: 'An exploratory maker.'},
  {id: 'lilt', name: 'Lilt', does: 'An associative companion.'},
]
/** The packet: what the Packet device sent. Sizes are the bytes of each item (the document is Control/self/agents/relational-logos.md). */
const SAMPLE_PACKET = [
  {entry: 7, scope: 'selection', text: 'The development Run has not started its workers', bytes: 312},
  {entry: 8, scope: 'whole entry', text: 'The first worker can retain its coordinator', bytes: 428},
  {entry: 0, scope: 'document', label: 'relational-logos.md', text: 'I MUST inhabit one continuing identity through self-relation and other-relation.', bytes: 4618},
]
/** The answer in parts; a part with a source ends in its number. */
const SAMPLE_PARTS: readonly {readonly t: string; readonly s?: number}[] = [
  {t: 'The entry reports; it does not ask for anything.'},
  {t: 'It says the Run has not started its workers.', s: 2},
  {t: 'The next entry adds that the first worker can retain its coordinator.', s: 3},
  {t: 'So the wait is on the start, not on you. Receive it as a report.', s: 1},
]
const answerRow = (parts: readonly {readonly t: string; readonly s?: number}[]) => ({who: 'Nara', kind: 'agent', text: parts.map(x => x.t).join(' '), parts})
/** The thread: the question, the answer, and then what stands in the page (a proposal that waits, or the receipt of a write). */
const sampleThread = (end: 'proposal' | 'written', replace = false) => JSON.stringify([
  {who: 'you', kind: 'you', text: QUESTION},
  answerRow(SAMPLE_PARTS),
  end === 'proposal' ? {who: 'Nara', kind: 'proposal', text: replace ? 'replace entry 7' : 'add as entry 9', tool: DOC, state: 'waits'}
    : {who: 'Nara', kind: 'receipt', text: replace ? 'entry 7 replaced' : 'entry 9 added', tool: `${DOC} · revision 14 · 22:31`},
])
/** The answer as far as it has come, while the agent answers. */
const partialThread = () => JSON.stringify([{who: 'you', kind: 'you', text: QUESTION}, answerRow(SAMPLE_PARTS.slice(0, 2).map(x => ({t: x.t})))])
/** The sources, each with the line it came from: relational-logos.md at its revision, and two entries of the Flow. */
const SAMPLE_SOURCES = [
  {n: 1, name: 'relational-logos.md', tag: '454bfbd1e47a', at: 'line 7', lines: [
    {n: 5, t: 'I MUST inhabit one continuing identity through self-relation and other-relation.'},
    {n: 6, t: ''},
    {n: 7, t: 'The other initially reaches me through an expression or event. I MUST receive that expression within its movement of meaning.', hit: true},
    {n: 8, t: ''},
    {n: 9, t: '## 0/1 — The whole in determination'}]},
  {n: 2, name: 'Entry 7', tag: 'Flow', at: '21:02', lines: [
    {n: 6, t: '19:20  The original Run remains incomplete'},
    {n: 7, t: '21:02  The development Run has not started its workers', hit: true},
    {n: 8, t: '21:55  The first worker can retain its coordinator'}]},
  {n: 3, name: 'Entry 8', tag: 'Flow', at: '21:55', lines: [
    {n: 6, t: '19:20  The original Run remains incomplete'},
    {n: 7, t: '21:02  The development Run has not started its workers'},
    {n: 8, t: '21:55  The first worker can retain its coordinator', hit: true}]},
]

// ---------------------------------------------------------------- the owner's material, read safely

const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const text = (x: unknown) => (typeof x === 'string' ? x : undefined)
/** A list carried as JSON in a key: its readable members, or undefined when the key is absent or does not hold a list. */
function listOf<T>(v: V, key: string, read: (x: unknown) => T | undefined): T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.map(read).filter((x): x is T => x !== undefined) : undefined
}

interface Agent {readonly id: string; readonly name: string; readonly does?: string; readonly role?: string}
const readAgent = (x: unknown): Agent | undefined => (obj(x) && text(x.id) ? {id: x.id as string, name: text(x.name) || (x.id as string), does: text(x.does), role: text(x.role) || undefined} : undefined)
const agentsOf = (v: V) => listOf(v, 'agents', readAgent)
/** The selected agent's name; its id while the roster does not hold it; undefined when no agent is reported. */
const agentName = (v: V) => { const id = strOf(v, 'agent'); return id === undefined ? undefined : agentsOf(v)?.find(a => a.id === id)?.name ?? id }
/** The agents the chooser offers, with the agent the owner reports itself kept among them. */
function agentOptions(v: V): Option<string>[] {
  const list = agentsOf(v) ?? [], now = strOf(v, 'agent')
  const all = now !== undefined && now !== '' && !list.some(a => a.id === now) ? [...list, {id: now, name: now}] : list
  return all.map(a => ({value: a.id, label: a.name, does: a.does}))
}
/** The dialogue role the owner binds for the agent: its role, "none" for a roster agent without one, undefined when not read. */
const roleOf = (v: V) => { const id = strOf(v, 'agent'), a = id === undefined ? undefined : agentsOf(v)?.find(x => x.id === id); return a ? a.role ?? 'none' : undefined }

/** An item of the packet: the words the agent reads, the scope it was added under (Document's packet item). */
interface Item {readonly entry?: number; readonly scope?: string; readonly text: string; readonly label?: string; readonly bytes?: number}
const readItem = (x: unknown): Item | undefined => (!obj(x) || text(x.text) === undefined ? undefined
  : {entry: typeof x.entry === 'number' ? x.entry : undefined, scope: text(x.scope), text: x.text as string, label: text(x.label) || undefined, bytes: typeof x.bytes === 'number' && x.bytes >= 0 ? x.bytes : undefined})
const packetOf = (v: V) => listOf(v, 'packet', readItem)
const sizeOf = (i: Item) => i.bytes ?? new TextEncoder().encode(i.text).length
const itemName = (i: Item) => i.label ?? (i.entry === undefined ? NONE : `Entry ${i.entry}`)
const itemKind = (i: Item) => (i.scope === undefined ? NONE : i.scope === 'whole entry' ? 'entry' : i.scope)
const packetBytes = (v: V) => packetOf(v)?.reduce((n, i) => n + sizeOf(i), 0)

interface SrcLine {readonly n: number; readonly t: string; readonly hit?: boolean}
interface Source {readonly n: number; readonly name: string; readonly tag: string; readonly at: string; readonly lines: readonly SrcLine[]}
const readSource = (x: unknown): Source | undefined => (!obj(x) || typeof x.n !== 'number' || text(x.name) === undefined ? undefined
  : {n: x.n, name: x.name as string, tag: text(x.tag) ?? '', at: text(x.at) ?? '', lines: Array.isArray(x.lines)
    ? x.lines.filter(obj).map(l => ({n: typeof l.n === 'number' ? l.n : 0, t: text(l.t) ?? '', hit: l.hit === true})) : []})
const sourcesOf = (v: V) => listOf(v, 'sources', readSource)

/** The thread's rows, as the Agent device's, with the claims of an answer. A row that is not an object is dropped; an unknown kind
 * draws as plain text. */
const KINDS = ['you', 'agent', 'proposal', 'receipt'] as const
interface Part {readonly t: string; readonly s?: number}
interface Row {readonly who: string; readonly kind: (typeof KINDS)[number] | 'text'; readonly text: string; readonly tool?: string; readonly state?: string; readonly parts?: readonly Part[]}
function rowsOf(v: V): Row[] | undefined {
  const raw = json<unknown>(v, 'thread', undefined)
  const sent = strOf(v, 'sent')?.trim()
  if (!Array.isArray(raw) && !sent) return undefined
  const rows: Row[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!obj(item)) continue
    const parts = Array.isArray(item.parts) ? item.parts.filter(obj).filter(x => text(x.t) !== undefined).map(x => ({t: x.t as string, s: typeof x.s === 'number' ? x.s : undefined})) : []
    rows.push({who: text(item.who) || NONE, kind: KINDS.find(k => k === item.kind) ?? 'text', text: text(item.text) ?? '', tool: text(item.tool) || undefined, state: text(item.state),
      parts: parts.length ? parts : undefined})
  }
  if (sent && !rows.some(r => r.text === sent)) rows.push({who: 'you', kind: 'you', text: sent})
  return rows
}

// ---------------------------------------------------------------- readings

type Phase = 'idle' | 'reading' | 'answering'
const PHASES: readonly Phase[] = ['idle', 'reading', 'answering']
/** The light the owner reports (lit, dark, or a word for "not read"); undefined when it reports none. It reads the owner alone. */
const lightOf = (p: ViewProps) => strOf(p.owner ?? p.v, 'light')
const lampOf = (p: ViewProps): LightState => { const x = lightOf(p); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const phase = (v: V): Phase | undefined => PHASES.find(x => x === strOf(v, 'state'))
const effortAt = (v: V) => { const i = EFFORTS.indexOf(strOf(v, 'effort') as (typeof EFFORTS)[number]); return i < 0 ? undefined : i }
const writesAt = (v: V) => { const i = WRITES.indexOf(strOf(v, 'writes') as (typeof WRITES)[number]); return i < 0 ? undefined : i }
const writesLabel = (v: V) => { const w = strOf(v, 'writes'); return w === undefined ? undefined : WRITES_LABEL[w] ?? w }
const stateWord = (p: ViewProps): string | undefined => {
  const l = lightOf(p)
  if (l === undefined) return undefined
  return l === 'dark' ? 'not bound' : l !== 'lit' ? 'not read' : phase(p.v)
}
const standingWord = (p: ViewProps): string | undefined => { const l = lightOf(p); return l === undefined ? undefined : l === 'lit' ? 'bound' : l === 'dark' ? 'no subject' : 'resolving' }
/** The bytes of identity and Expression the turn carries; undefined when the owner has not read them. */
const contextOf = (v: V) => { const n = numOf(v, 'context'); return n === undefined || n < 0 ? undefined : n }
/** The whole turn: the context and the packet. Undefined while either is not read. */
const turnBytes = (v: V) => { const c = contextOf(v), k = packetBytes(v); return c === undefined || k === undefined ? undefined : c + k }

/** Where the answer stands in the page, from the rows after the last answer: nowhere yet, in the conversation only, waiting for
 * you, kept, or declined. */
type Landing = 'none' | 'chat' | 'waits' | 'kept' | 'declined'
function landingOf(p: ViewProps, rows: readonly Row[] | undefined): Landing {
  if (lampOf(p) !== 'lit' || phase(p.v) !== 'idle') return 'none'
  const after = rows ? rows.slice(rows.map(r => r.kind).lastIndexOf('agent') + 1) : []
  const last = [...after].reverse().find(r => r.kind === 'proposal' || r.kind === 'receipt')
  if (last) return last.kind === 'receipt' ? 'kept' : last.state === 'declined' ? 'declined' : 'waits'
  return strOf(p.v, 'writes') === 'off' ? 'chat' : 'none'
}
const LANDING_WORD: Readonly<Record<Exclude<Landing, 'none'>, string>> = {chat: 'off', waits: 'waits', kept: 'kept', declined: 'declined'}
const landingWord = (where: Landing) => (where === 'none' ? undefined : LANDING_WORD[where])

const head = (p: ViewProps) => ({light: lampOf(p), onLight: st(p, 'light').disabled ? undefined : () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit'), onFold: p.nav.fold, onFull: p.nav.full})
const ask = (p: ViewProps, said: string) => {
  const t = said.trim()
  if (!t || lampOf(p) !== 'lit') return
  p.set('sent', t); p.set('draft', '')
}

// ---------------------------------------------------------------- the face

function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}
const EXPR: Readonly<Record<Phase, string>> = {idle: 'neutral', reading: 'focus', answering: 'speak'}
/** The agent's face as the shell draws it: at rest when idle, focused while it reads, speaking while it answers. */
const Face = memo(function Face({x, y, size, expr, dim}: {x: number; y: number; size: number; expr: string; dim: boolean}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic(expr, ink, ink, size, ground), [expr, ink, ground, size])
  return <g transform={`translate(${x} ${y})`} opacity={dim ? 0.4 : 1} dangerouslySetInnerHTML={{__html: html}} />
})
const Avatar = memo(function Avatar({expr, size = 18}: {expr: string; size?: number}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic(expr, ink, ink, size, ground), [expr, ink, ground, size])
  return <svg className="an-face" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><g dangerouslySetInnerHTML={{__html: html}} /></svg>
})

// ---------------------------------------------------------------- the well

/** The well: the agent, the turn against its budget (the ruler), the chat and the page side by side — the question, the answer,
 * and where the answer lands — then the effort rungs (handle 1) and, whole, the writes line (handle 2) and the landing (handle 3). */
function AnswerWell({p, w, h, size}: {p: ViewProps; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const v = p.v, set = p.set
  const mini = size === 'mini', whole = size === 'whole'
  const lamp = lampOf(p), lit = lamp === 'lit', ph = phase(v), rows = rowsOf(v), where = landingOf(p, rows)
  const answerAs = strOf(v, 'answerAs'), replace = answerAs === 'replace', ctx = contextOf(v), packet = packetOf(v), turn = turnBytes(v)
  const effort = effortAt(v), writes = writesAt(v)
  const asked = !!rows?.some(r => r.kind === 'you'), answered = !!rows?.some(r => r.kind === 'agent')
  const canEffort = lit && !st(p, 'effort').disabled, canWrites = lit && !st(p, 'writes').disabled, canAnswerAs = lit && !st(p, 'answerAs').disabled
  // geometry: the chat column and the page column, side by side
  const g = mini ? {cx: 6, cw: 40, px: 58, pw: 40, dv: 52, ly: 38, r0: 44}
    : whole ? {cx: 7, cw: 83, px: 106, pw: 81, dv: 98, ly: 78, r0: 84}
    : {cx: 7, cw: 56, px: 78, pw: 55, dv: 70, ly: 73, r0: 79}
  const row = (i: number) => g.r0 + i * 8, bh = mini ? 2.4 : 3
  const fs = mini ? 20 : whole ? 30 : 26, nameX = (mini ? 6 : 7) + fs + 7
  // the ruler: the turn along the 256 KiB budget
  const rx = mini ? 6 : 7, rw = w - 2 * rx, ry = mini ? 83 : whole ? 56 : 53, rh = mini ? 5 : 8, per = rw / BUDGET
  let at = rx
  const segs: {x: number; w: number; packet: boolean; key: string}[] = []
  if (ctx !== undefined) { const sw = Math.max(2, ctx * per); segs.push({x: at, w: sw, packet: false, key: 'ctx'}); at += sw + 1 }
  packet?.forEach((item, i) => { const sw = Math.max(2, sizeOf(item) * per); segs.push({x: at, w: sw, packet: true, key: `item${i}`}); at += sw + 1 })
  const ruler = ctx === undefined && !packet ? 'turn · not read' : ctx === undefined ? 'turn · context not read' : !packet ? 'turn · packet not read' : 'turn'
  // effort rungs, the writes line
  const rungW = whole ? 16 : 12, rungGap = whole ? 4 : 3, baseY = whole ? 134 : 138, rungH = whole ? [6, 11, 16, 21] : [4, 8, 12, 16]
  const rungX = (i: number) => 7 + i * (rungW + rungGap)
  const wx0 = whole ? 114 : 84, wx1 = whole ? 180 : 128, wy = whole ? 130 : 129, wxs = [wx0, (wx0 + wx1) / 2, wx1]
  const tgt = replace ? 1 : 3, bar = (f: number) => g.pw * f
  const pageStatus = where === 'none' || !lit ? '' : LANDING_WORD[where]
  return <Display w={w} h={h} label="The answer"
    does={mini ? 'The agent, the turn against its budget, and where the answer lands.' : 'The agent, the turn against its 256 KB budget, the chat and the page, and the effort. Drag the handles to set them.'}
    corner={mini ? undefined : turn === undefined ? NONE : whole ? `${kb(turn)} / 256 KB` : kb(turn)}>
    <Face x={mini ? 6 : 7} y={mini ? 4 : 5} size={fs} expr={EXPR[ph ?? 'idle']} dim={!lit} />
    <text x={nameX} y={mini ? 13 : 17} className="dp-ink" style={{fontSize: mini ? 10.5 : 11.5, fontWeight: 600}}>{agentName(v) ?? NONE}</text>
    <text x={nameX} y={mini ? 24 : 30} className="dp-ink-dim" style={{fill: lit && ph && ph !== 'idle' ? 'var(--dp-value)' : undefined}}>{stateWord(p) ?? NONE}</text>

    {/* the turn: the identity and Expression context (dim), then each packet item, along the budget */}
    <text x={rx} y={ry - 3} className="dp-axis">{ruler}</text>
    {whole && <text x={w - rx} y={ry - 3} className="dp-axis" textAnchor="end">256 KB</text>}
    <rect x={rx + 0.5} y={ry} width={rw - 1} height={rh} className="dp-faint" />
    {segs.map(s => <rect key={s.key} x={s.x} y={ry + 1.5} width={s.w} height={rh - 3} fill={s.packet ? 'var(--dp-value)' : 'var(--text-faint)'} opacity={s.packet ? 1 : 0.55} />)}

    {/* the chat and the page */}
    <text x={g.cx} y={g.ly} className="dp-axis">chat</text>
    <text x={g.px} y={g.ly} className="dp-axis">page</text>
    {!mini && <text x={g.px + g.pw} y={g.ly} className="dp-axis" textAnchor="end" style={{fill: where === 'waits' ? 'var(--dp-on)' : where === 'kept' ? 'var(--green)' : undefined}}>{pageStatus}</text>}
    <path d={`M${g.dv} ${g.ly - 6}V${row(3) + 6}`} className="dp-faint" />
    {!lit ? <>
      <text x={g.cx} y={row(1) + 3} className="dp-axis">{lamp === 'unknown' ? 'binding' : 'no subject'}</text>
      <text x={g.cx} y={row(2) + 3} className="dp-axis">{lamp === 'unknown' ? 'not read' : 'selected'}</text>
    </> : !rows ? <>
      <text x={g.cx} y={row(1) + 3} className="dp-axis">thread</text>
      <text x={g.cx} y={row(2) + 3} className="dp-axis">not read</text>
    </> : <>
      {(asked || ph === 'reading' || ph === 'answering') && <rect x={g.cx} y={row(0)} width={g.cw * 0.62} height={bh} fill="var(--text-dim)" opacity={0.55} />}
      {ph === 'reading' && [0, 1, 2].map(i => <circle key={i} cx={g.cx + 3 + i * 7} cy={row(1) + bh / 2} r={1.6} fill="var(--dp-value)" />)}
      {ph !== 'reading' && (answered || ph === 'answering') && [0.92, 0.8, 0.42].map((f, i) => {
        if (ph === 'answering' && i === 2) return <rect key={i} x={g.cx} y={row(1 + i)} width={g.cw * 0.22} height={bh} fill="var(--dp-value)" opacity={0.5} />
        return <rect key={i} x={g.cx} y={row(1 + i)} width={g.cw * f} height={bh} fill="var(--dp-value)" opacity={0.5} />
      })}
      {ph === 'answering' && <rect x={g.cx + g.cw * 0.22 + 2} y={row(3) - 1.5} width={2} height={bh + 3} fill="var(--dp-on)" />}
    </>}
    {[0.8, 0.9, 0.7].map((f, i) => {
      const gone = where === 'kept' && replace && i === 1
      return gone ? null : <rect key={i} x={g.px} y={row(i)} width={bar(f)} height={bh} fill="var(--text-dim)" opacity={where === 'waits' && replace && i === 1 ? 0.3 : 0.55} />
    })}
    {lit && numOf(v, 'entry') !== undefined && <rect x={g.px - 2.5} y={row(1) - 2.5} width={bar(0.9) + 5} height={bh + 5} fill="none" stroke="var(--sel)" strokeWidth={1} opacity={0.85} />}
    {where === 'waits' && answerAs !== undefined && <rect x={g.px} y={row(tgt) - 1} width={bar(0.85)} height={bh + 2} fill="none" stroke="var(--dp-value)" strokeWidth={1} strokeDasharray="2 2" />}
    {where === 'kept' && answerAs !== undefined && <>
      <rect x={g.px} y={row(tgt)} width={bar(0.85)} height={bh} fill="var(--dp-value)" />
      <rect x={g.px + bar(0.85) + 3} y={row(tgt) - 0.5} width={4} height={4} fill="var(--green)" />
    </>}
    {whole && lit && answerAs !== undefined && <Handle n={3} shape="square" x={g.px + bar(0.85) + 13} y={row(tgt) + bh / 2} label="Answer as" does="Drag up or down: the answer takes the selected entry or joins as a new one."
      onDrag={canAnswerAs ? (_, y) => set('answerAs', y < (row(1) + row(3)) / 2 ? 'replace' : 'new') : undefined} onReset={canAnswerAs ? () => set('answerAs', 'new') : undefined} />}

    {/* effort: four rungs, lit up to the chosen one */}
    {!mini && <>
      <text x={7} y={whole ? 121 : 119} className="dp-axis">effort</text>
      {rungH.map((rh, i) => { const on = lit && effort !== undefined && i <= effort
        return <g key={i}>
          <rect x={rungX(i) + 0.5} y={baseY - rh} width={rungW - 1} height={rh} className={on ? undefined : 'dp-faint'} fill={on ? 'var(--dp-value)' : 'none'} opacity={on ? 0.45 + i * 0.18 : 1} />
          {whole && <text x={rungX(i) + rungW / 2} y={baseY + 9} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{['low', 'med', 'high', 'max'][i]}</text>}
        </g> })}
      {lit && effort !== undefined && <Handle n={1} shape="ring" x={rungX(effort) + rungW / 2} y={baseY - rungH[effort]! - 7} label="Effort" does="Drag across the rungs: how hard the agent thinks on each answer."
        onDrag={canEffort ? x => set('effort', EFFORTS[Math.round(clampTo(0, 3, (x - 7 - rungW / 2) / (rungW + rungGap)))]!) : undefined} onReset={canEffort ? () => set('effort', 'high') : undefined} />}

      {/* writes: where the answer goes, from the chat alone to the page */}
      <text x={g.px} y={whole ? 121 : 119} className="dp-axis">writes</text>
      <path d={`M${wx0} ${wy}H${wx1}`} className="dp-faint" />
      {wxs.map((x, i) => <g key={i}>
        <path d={`M${x} ${wy - 4}V${wy + 4}`} className="dp-faint" />
        <text x={x} y={wy + 11} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{whole ? WRITES[i] : ['off', 'prop', 'write'][i]}</text>
      </g>)}
      {writes !== undefined && <circle cx={wxs[writes]} cy={wy} r={3.5} fill="var(--dp-on)" />}
      {whole && lit && writes !== undefined && <Handle n={2} x={wxs[writes]!} y={wy} label="Agent writes" does="Drag along the line: the answer stays in the chat, waits in the page, or goes in."
        onDrag={canWrites ? x => set('writes', WRITES[Math.round(clampTo(0, 2, (x - wx0) / ((wx1 - wx0) / 2)))]!) : undefined} onReset={canWrites ? () => set('writes', 'propose') : undefined} />}
    </>}
  </Display>
}

// ---------------------------------------------------------------- the controls

const agentChooser = (p: ViewProps) => {
  const s = st(p, 'agent'), options = agentOptions(p.v)
  return <Chooser {...s} disabled={s.disabled ?? (options.length ? undefined : 'No reading of the agents.')} label="Agent" does={SAYS.agent} value={strOf(p.v, 'agent') ?? ''} options={options} onChange={x => p.set('agent', x)} />
}
const answerRadio = (p: ViewProps) => <Radio {...st(p, 'answerAs')} label="Answer as" does={SAYS.answerAs} value={strOf(p.v, 'answerAs') ?? ''} stack options={ANSWER_AS} onChange={x => p.set('answerAs', x)} />
const writesRadio = (p: ViewProps) => <Radio {...st(p, 'writes')} label="Agent writes" does={SAYS.writes} value={strOf(p.v, 'writes') ?? ''} stack options={WRITE_OPTIONS} onChange={x => p.set('writes', x)} />
const effortDial = (p: ViewProps) => {
  const s = st(p, 'effort'), lamp = lampOf(p)
  return <Dial {...s} disabled={s.disabled ?? (lamp === 'lit' ? undefined : lamp === 'dark' ? 'The conversation is not bound. Effort needs a session.' : 'The binding is not read.')}
    label="Effort" does={SAYS.effort} value={effortAt(p.v) ?? NaN} def={2} scale={{min: 0, max: 3, step: 1}} format={i => EFFORTS[Math.round(i)] ?? NONE}
    onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} />
}

// ---------------------------------------------------------------- the exchange, in the pane

/** The packet's items as chips, with the size of each in the turn. */
function Packet({v}: {v: V}) {
  const items = packetOf(v)
  if (!items || !items.length) return <ul className="an-packet" aria-label="Packet"><li>{items ? 'Nothing in the packet' : 'No reading of the packet'}</li></ul>
  return <ul className="an-packet" aria-label="Packet">
    {items.map((item, i) => <li key={i} data-i={`${itemName(item)}|${itemKind(item)}${item.text ? `: ${short(item.text, 60)}` : ''}. ${kb(sizeOf(item))} of the turn.`}>
      <b>{itemKind(item)}</b>{itemName(item)}<small>{kb(sizeOf(item))}</small></li>)}
  </ul>
}

const note = (key: string | number, words: string) => <div key={key} className="an-row an-row--note"><span className="an-av an-av--tool" aria-hidden="true" /><p className="an-note">{words}</p></div>

function AnswerPane({p}: {p: ViewProps}) {
  const {v, set} = p
  const lamp = lampOf(p), lit = lamp === 'lit', ph = phase(v), answering = ph === 'answering'
  const all = rowsOf(v), rows = all ?? [], packet = packetOf(v), turn = turnBytes(v), name = agentName(v), who = name ?? NONE
  const sources = sourcesOf(v), open = Number(strOf(v, 'source')) || 0, source = sources?.find(s => s.n === open)
  const where = landingOf(p, all)
  const lastAgent = rows.map(r => r.kind).lastIndexOf('agent'), firstYou = rows.findIndex(r => r.kind === 'you')
  const send = st(p, 'sent'), pick = st(p, 'source'), accept = st(p, 'accept'), decline = st(p, 'decline'), draft = strOf(v, 'draft') ?? ''
  const said = (does: string, why: string | undefined) => [does, why].filter(Boolean).join(' ')
  const cite = (n: number) => {
    const src = sources?.find(s => s.n === n)
    return <button type="button" className="an-cite" aria-pressed={open === n} disabled={!!pick.disabled}
      data-i={`Source ${n}|${said(src ? `Land on the line this claim comes from: ${src.name}, ${src.at}.` : 'No reading of this source.', pick.disabled)}`}
      onClick={() => set('source', open === n ? '' : String(n))}>{n}</button>
  }
  const line = (r: Row, i: number) => {
    if (r.kind === 'you') return <div key={i} className="an-row"><span className="an-av">Y</span>
      <div className="an-body"><span className="an-who">{r.who}</span><p className="an-text">{r.text || NONE}</p>{i === firstYou && <Packet v={v} />}</div></div>
    if (r.kind === 'agent') {
      const live = answering && i === rows.length - 1, done = i === lastAgent && !live
      return <div key={i} className="an-row"><span className="an-av" data-agent="true"><Avatar expr={live ? 'speak' : 'neutral'} /></span>
        <div className="an-body"><span className="an-who" data-agent="true">{r.who}</span>
          <p className="an-text">{r.parts ? r.parts.map((part, j) => <span key={j}>{part.t}{part.s !== undefined && sources && !live && cite(part.s)} </span>) : r.text || NONE}
            {live && <span className="an-caret" />}</p>
          {done && sources && sources.length > 0 && <ul className="an-sources" aria-label="Sources">
            {sources.map(s => <li key={s.n}><button type="button" aria-pressed={open === s.n} disabled={!!pick.disabled} onClick={() => set('source', open === s.n ? '' : String(s.n))}
              data-i={`Source ${s.n}|${said(`Follow it to the line it came from: ${s.name}, ${s.at}.`, pick.disabled)}`}><b>{s.n}</b>{s.name}<small>{s.at}</small></button></li>)}
          </ul>}
          {done && source && <div className="an-line-card" aria-label={`Source ${source.n}`}>
            <div><b>{source.name}</b><small>{source.tag}</small></div>
            {source.lines.map((l, j) => <p key={j} data-hit={l.hit || undefined}><i>{l.n}</i><span>{l.t || ' '}</span></p>)}
          </div>}
        </div></div>
    }
    if (r.kind === 'proposal') {
      if (r.state === 'declined') return note(i, 'Declined. The page is unchanged.')
      return <div key={i} className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card">
        <b>Proposal · {r.text || NONE}</b><small>{[r.tool ?? strOf(v, 'document'), 'waits for you'].filter(Boolean).join(' · ')}</small>
        <span className="an-card-do">
          <button type="button" disabled={!!accept.disabled} onClick={() => set('accept', true)} data-i={`Accept|${said('Put the answer into the page. The write carries a receipt.', accept.disabled)}`}>Accept</button>
          <button type="button" disabled={!!decline.disabled} onClick={() => set('decline', true)} data-i={`Decline|${said('Leave the page as it is. The answer stays in the conversation.', decline.disabled)}`}>Decline</button></span></div></div>
    }
    if (r.kind === 'receipt') return <div key={i} className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card" data-done="true">
      <b>Written · {r.text || NONE}</b><small>{[r.tool, 'receipt kept with the entry'].filter(Boolean).join(' · ')}</small></div></div>
    return note(i, r.text || NONE)
  }
  const working = (expr: string, words: string) => <div className="an-row"><span className="an-av" data-agent="true"><Avatar expr={expr} /></span>
    <div className="an-body"><span className="an-who" data-agent="true">{who}</span><p className="an-work"><i />{words}</p></div></div>
  const reads = `${who} reads the packet${packet ? ` · ${packet.length} item${packet.length === 1 ? '' : 's'} · ${kb(packetBytes(v) ?? 0)}` : ''}`
  return <div className="an-pane">
    <div className="an-pane-head" aria-label="The answering agent">
      <b>{who}</b><span>{shown(v, 'document')}</span><span>{standingWord(p) ?? NONE}</span><span>effort {shown(v, 'effort')}</span>
      <span>writes {writesLabel(v) ?? NONE}</span><span data-state={ph === undefined || ph === 'idle' ? undefined : 'busy'}>{stateWord(p) ?? NONE}</span>
    </div>
    <div className="an-stream" role="log" aria-label="Exchange">
      <div className="an-task"><span>Answer to entry {shown(v, 'entry')}</span><i /><small>{turn === undefined ? NONE : kb(turn)} of 256 KB</small></div>
      {lit && <>
        {firstYou < 0 && <div className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-body"><span className="an-who">packet</span><Packet v={v} /></div></div>}
        {all === undefined && note('thread', 'No reading of the thread.')}
        {all !== undefined && rows.length === 0 && note('empty', 'Nothing asked yet.')}
        {rows.flatMap((r, i) => [line(r, i), ...(i === lastAgent && where === 'chat' ? [note(`chat${i}`, 'Agent writes is Off. The answer stays in this conversation.')] : [])])}
        {ph === 'reading' && working('focus', reads)}
        {answering && rows[rows.length - 1]?.kind !== 'agent' && working('speak', `${who} is answering`)}
      </>}
      {!lit && note('unlit', lamp === 'unknown' ? 'The binding has not been read. The owner has not said.' : 'No subject is selected. The conversation binds once you select one.')}
    </div>
    <div className="an-composer">
      <input aria-label="Message" disabled={!lit || !!send.disabled} placeholder={!lit ? 'Bind a conversation to ask' : name ? `Ask ${name}` : 'Ask the agent'} value={draft}
        data-i={`Composer|${[said('Type a question and press Enter. The agent reads the packet and answers in this pane.', send.disabled), send.refused ? `The owner refused: ${send.refused}` : undefined].filter(Boolean).join(' ')}`}
        onChange={e => set('draft', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ask(p, draft) } }} />
      <small>ask</small>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

/** The widget's last line: the latest question or answer, as one short sentence. */
function Last({p}: {p: ViewProps}) {
  const lamp = lampOf(p), rows = rowsOf(p.v)
  if (lamp !== 'lit') return <>{lamp === 'unknown' ? 'The binding is not read.' : 'No subject is selected.'}</>
  if (phase(p.v) === 'reading') return <>{agentName(p.v) ?? 'The agent'} reads the packet.</>
  if (!rows) return <>No reading of the thread.</>
  const last = [...rows].reverse().find(r => r.kind === 'you' || r.kind === 'agent')
  return last ? <><b>{last.who}</b> {last.text || NONE}</> : <>Nothing asked yet.</>
}

export const design: DesignedDevice = {
  id: 'central:nara-conversation',
  title: 'Answer',
  kind: 'instrument',
  defaults: {
    light: 'lit', agent: 'nara', answerAs: 'new', writes: 'propose', effort: 'high', draft: '', source: '1',
    // Readings: what the owners report, never set from here. `context` is the bytes of identity and Expression the turn carries.
    state: 'idle', context: 38912, document: DOC, entry: 7, resume: false,
    // The owner's material: the roster, the packet, the exchange and what it cites (JSON).
    agents: JSON.stringify(SAMPLE_AGENTS), packet: JSON.stringify(SAMPLE_PACKET), thread: sampleThread('proposal'), sources: JSON.stringify(SAMPLE_SOURCES),
  },
  fixtures: {
    'Answered, waiting': {},
    Answering: {state: 'answering', thread: partialThread(), sources: undefined},
    'Replace and write': {answerAs: 'replace', writes: 'write', thread: sampleThread('written', true)},
    'Not bound': {light: 'dark', context: undefined},
    'No readings': Object.fromEntries(['light', 'agent', 'answerAs', 'writes', 'effort', 'draft', 'sent', 'source', 'state', 'context', 'document', 'entry', 'resume',
      'agents', 'packet', 'thread', 'sources'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Answer" light={lampOf(p)} readings={[agentName(p.v) ?? NONE, writesLabel(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Answer" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <AnswerWell p={p} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2} width={140}>
      {agentChooser(p)}
      {answerRadio(p)}
      {writesRadio(p)}
      {effortDial(p)}
    </Section>
  </Panel>,

  whole: p => {
    const where = landingOf(p, rowsOf(p.v)), ph = phase(p.v), resume = boolOf(p.v, 'resume'), turn = turnBytes(p.v), size = packetBytes(p.v), l = lightOf(p)
    return <Panel title="Answer" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <AnswerWell p={p} w={194} h={146} size="whole" />
        </Section>
        <Section label="Agent" cols={2}>
          {agentChooser(p)}
          {effortDial(p)}
          <Readout label="role" does="The role the owner binds for this agent. A roster agent has none yet." value={roleOf(p.v)} />
        </Section>
        <Section label="Answer" grow>
          {answerRadio(p)}
          <Readout label="sources" does="The places the answer cites. Follow one in the pane." value={sourcesOf(p.v)?.length} tone="value" />
        </Section>
      </Band>
      <Band>
        <Section label="Writes" cols={2} width={140}>
          {writesRadio(p)}
          <Readout label="page" does="Where the answer stands: off, waits for you, or kept with a receipt." value={landingWord(where)}
            tone={where === 'waits' ? 'accent' : where === 'kept' ? 'green' : undefined} />
        </Section>
        <Section label="Exchange" cols={3} width={140}>
          <Readout label="state" does="What the agent does now: idle, reading the packet, or answering." value={stateWord(p)} tone={ph === undefined || ph === 'idle' ? undefined : 'value'} />
          <Readout label="packet" does="The size of the packet the agent receives." value={size === undefined ? undefined : kb(size)} tone="value" />
          <Readout label="turn" does="The whole turn against the native budget of 256 KB: the packet and the identity context." value={turn === undefined ? undefined : kb(turn)} />
        </Section>
        <Section label="Binding" grow>
          <Readout label="standing" does="Whether the conversation is bound to a person and an Expression." value={standingWord(p)} tone={l === 'lit' ? 'green' : undefined} />
          <Readout label="resume" does="Whether the owner needs the session resumed before it answers." value={resume === undefined ? undefined : resume ? 'yes' : 'no'} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <AnswerPane p={p} />,

  widget: p => {
    const send = st(p, 'sent'), ph = phase(p.v), name = agentName(p.v), draft = strOf(p.v, 'draft') ?? '', says = 'Type a question and press Enter. The agent reads the packet and answers.'
    return <Tile title={`Answer · ${name ?? NONE}`} light={lampOf(p)} span={2} onFull={p.nav.full}>
      <AnswerWell p={p} w={104} h={100} size="mini" />
      <div className="an-tile-side">
        <p className="an-last" aria-live="polite"><Last p={p} /></p>
        <div className="an-tile-reads">
          <Readout label="state" does="What the agent does now." value={stateWord(p)} tone={ph === undefined || ph === 'idle' ? undefined : 'value'} />
          <Readout label="writes" does="Off, Propose or Write: how the answer reaches the page." value={writesLabel(p.v)} />
          <Readout label="effort" does="How hard the agent thinks on each answer." value={strOf(p.v, 'effort')} />
        </div>
        <input className="an-tile-composer" aria-label="Message" disabled={lampOf(p) !== 'lit' || !!send.disabled} placeholder={name ? `Ask ${name}` : 'Ask the agent'} value={draft}
          data-i={`Composer|${[says, send.disabled, send.refused ? `The owner refused: ${send.refused}` : undefined].filter(Boolean).join(' ')}`}
          onChange={e => p.set('draft', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(p, draft) }} />
      </div>
    </Tile>
  },
}
