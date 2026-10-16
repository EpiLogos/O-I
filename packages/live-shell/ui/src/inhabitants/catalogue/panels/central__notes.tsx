// Notes (manual §18.8): your own thoughts kept against a passage of a document. Live's nearest: the Locators of the Arrangement view — a
// mark with words, kept at a place and listed in order — at the size of Utility. The picture is the document and its notes: one bar for
// each entry of the page, each note as a card beside it, and a line from the card to the place it stands on (a passage, an entry or the
// whole document). A card with a solid edge was written during the reading, a hollow edge after it. A note keeps the form's own fields
// (documents/ql-flow.html :935 noteEl, :1075 act('note'); ql-daily-die.html :403, :650): the entry or Day field, the quoted passage
// (`anchor`, null for a whole entry), `timing` (during or after), the time (`at`), the words and the replies. A note whose passage is no
// longer in its entry says "anchor not found, review" (ql-flow.html :935). The shell reads the same notes for the Clip view's Notes
// column (central/documentPayload.ts PayloadNote; central/CentralClipDetail.tsx :132): the place as the author's initial and the entry's
// number ("C4"), a dash for a note that names none.
// Everything the page holds is a value: `entries` (a JSON list of {by, head}, the shape the Document device's `entries` carries), `notes`
// (a JSON list of notes, which the pane edits), `title` and `tabTitle` (as the Document device names them) and `name` (the document's
// short name). The sample readings in `defaults` are the Factory flow (Control/user/flows/flow-2026-10-03-1432.html), whose entries the
// Document device reads too; the notes are a fixture, because that flow holds none. A key the owner does not report is absent: the
// picture then says which reading is missing in words, and every control and reading draws "—". The pane's edits (New note, Reply,
// Remove, the timing and the words) write the `notes` list, so they stand with the standing of `notes`.
import {useEffect, useRef, useState, type ReactNode} from 'react'
import {Band, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__notes.css'

type V = ViewProps['v']
type Timing = 'during' | 'after'
type AnchorTo = 'selection' | 'entry' | 'document'
type ShowId = 'all' | 'open' | 'off'
type OrderId = 'place' | 'time'

/** An entry of the page (the Document device's `entries`): `by` is `C` (the Factory coordinator) or `F` (the person). */
interface Ent {
  readonly by: string
  readonly head: string
}

/** A note, as the form keeps it. `entry` is the entry's number (1 to the last), null for a note on the whole document; `anchor` is the
 * quoted passage, null for a note on the whole entry. */
interface Note {
  readonly id: string
  readonly entry: number | null
  readonly anchor: string | null
  readonly text: string
  readonly timing: Timing
  readonly at: string
  readonly replies: readonly string[]
}

const TIMINGS: readonly Option<Timing>[] = [
  {value: 'during', label: 'During', does: 'The next note is written while you read.'},
  {value: 'after', label: 'After', does: 'The next note is written after you read.'},
]
const ANCHORS: readonly Option<AnchorTo>[] = [
  {value: 'selection', label: 'Selection', does: 'The next note stands on the words you select.'},
  {value: 'entry', label: 'Entry', does: 'The next note stands on the open entry.'},
  {value: 'document', label: 'Document', does: 'The next note stands on the whole document.'},
]
const SHOWS: readonly Option<ShowId>[] = [
  {value: 'all', label: 'All', does: 'Every note stands beside the document.'},
  {value: 'open', label: 'Open', does: 'Only the notes of the open entry stand beside it.'},
  {value: 'off', label: 'Off', does: 'No note stands beside the document.'},
]
const ORDERS: readonly Option<OrderId>[] = [
  {value: 'place', label: 'Place', does: 'The list runs by the place of each note in the page.'},
  {value: 'time', label: 'Time', does: 'The list runs by the time you wrote each note.'},
]
const SHOW_WORDS: Record<ShowId, string> = {all: 'All notes', open: 'Open entry', off: 'Off'}
const ORDER_WORDS: Record<OrderId, string> = {place: 'by place', time: 'by time'}

// ---------------------------------------------------------------- what the page holds, from the values

const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const isText = (x: unknown): x is string => typeof x === 'string'
const isEnt = (x: unknown): x is Ent => obj(x) && typeof x.by === 'string' && typeof x.head === 'string'
const isNote = (x: unknown): x is Note => obj(x) && typeof x.id === 'string' && (x.entry === null || typeof x.entry === 'number') && (x.anchor === null || typeof x.anchor === 'string')
  && typeof x.text === 'string' && (x.timing === 'during' || x.timing === 'after') && typeof x.at === 'string' && Array.isArray(x.replies) && x.replies.every(isText)
/** A list carried as JSON in a key: its readable members, or undefined when the key is absent or does not hold a list. */
function listOf<T>(v: V, key: string, ok: (x: unknown) => x is T): readonly T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.filter(ok) : undefined
}
/** One of the options, when the key holds one of them; undefined when the key is absent or holds anything else. */
const choice = <T extends string>(v: V, key: string, options: readonly Option<T>[]): T | undefined => options.find(o => o.value === strOf(v, key))?.value

/** What the page holds now: each reading is undefined where the owner reports none (or holds one that cannot be read). */
interface Read {
  readonly entries: readonly Ent[] | undefined
  readonly notes: readonly Note[] | undefined
  /** The open entry, from 1 to the last entry. */
  readonly open: number | undefined
  readonly timing: Timing | undefined
  readonly anchor: AnchorTo | undefined
  readonly show: ShowId | undefined
  readonly order: OrderId | undefined
}
function read(v: V): Read {
  const entries = listOf(v, 'entries', isEnt), at = numOf(v, 'open')
  return {
    entries, notes: listOf(v, 'notes', isNote),
    open: at === undefined || !Number.isFinite(at) || entries?.length === 0 ? undefined : Math.min(entries?.length ?? Infinity, Math.max(1, Math.round(at))),
    timing: choice(v, 'timing', TIMINGS), anchor: choice(v, 'anchor', ANCHORS), show: choice(v, 'show', SHOWS), order: choice(v, 'order', ORDERS),
  }
}

/** The words of an entry, or undefined where the page is not read or has no such entry. */
const textOf = (r: Read, entry: number) => r.entries?.[entry - 1]?.head
/** The form's own test: the quoted passage is no longer in its entry (ql-flow.html :935). Not claimed while the page is not read. */
const isStale = (r: Read, n: Note) => r.entries !== undefined && n.anchor !== null && n.entry !== null && !(textOf(r, n.entry) ?? '').includes(n.anchor)
/** The place as the shell reads it: the author's initial and the entry's number; a dash for a note that names no entry. */
const tagOf = (r: Read, n: Note) => (n.entry === null ? NONE : `${r.entries?.[n.entry - 1]?.by.slice(0, 1) || NONE}${n.entry}`)
const whereOf = (n: Note) => (n.entry === null ? 'On the whole document' : n.anchor === null ? 'On the whole entry' : 'On a passage')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const when = (at: string) => (STAMP.test(at) ? `${Number(at.slice(8, 10))} ${MONTHS[Number(at.slice(5, 7)) - 1] ?? NONE} ${at.slice(11, 16)}` : NONE)
const clockOf = (at: string) => (STAMP.test(at) ? at.slice(11, 16) : NONE)
const nowIso = () => {
  const d = new Date(), p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const placeKey = (r: Read, n: Note) => {
  if (n.entry === null) return 0
  if (n.anchor === null) return n.entry * 1000
  const at = textOf(r, n.entry)?.indexOf(n.anchor) ?? -1
  return n.entry * 1000 + (at < 0 ? 999 : 1 + at)
}
/** The list in the chosen order: by the note's place in the page (the whole document first), or by the time it was written. While
 * the order is not reported the list stays as the owner gave it. */
const sorted = (r: Read, notes: readonly Note[]) =>
  [...notes].sort(r.order === 'time' ? (a, b) => a.at.localeCompare(b.at) : r.order === 'place' ? (a, b) => placeKey(r, a) - placeKey(r, b) : () => 0)
/** The notes that stand beside the document, by Show; none while Show (or, for Open, the open entry) is not reported. */
const beside = (r: Read, notes: readonly Note[]) => (r.show === 'all' ? notes : r.show === 'open' && r.open !== undefined ? notes.filter(n => n.entry === r.open) : [])

function counts(r: Read) {
  const n = (keep: (x: Note) => boolean) => r.notes?.filter(keep).length
  return {
    notes: r.notes?.length,
    passages: n(x => x.anchor !== null),
    entries: n(x => x.entry !== null && x.anchor === null),
    document: n(x => x.entry === null),
    after: n(x => x.timing === 'after'),
    moved: r.entries ? n(x => isStale(r, x)) : undefined,
  }
}
const noun = (n: number) => `${n} note${n === 1 ? '' : 's'}`
const nounOf = (n: number | undefined) => (n === undefined ? NONE : noun(n))

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

// ---------------------------------------------------------------- the display: the page and its notes

/** A line with a stop for each choice, and a handle on the one that is set. Arrow keys step to the next stop. No handle stands while
 * the choice is not reported; with no `onGo` (the key is disabled) the handle stands still and says why. */
function Stops<T extends string>({x0, x1, y, items, value, n, label, does, def, onGo, why}: {
  readonly x0: number; readonly x1: number; readonly y: number; readonly items: readonly {readonly value: T; readonly label: string}[]
  readonly value: T | undefined; readonly n: number; readonly label: string; readonly does: string; readonly def: T; readonly onGo?: (value: T) => void; readonly why?: string
}) {
  const k = items.length, step = (x1 - x0) / k, xs = items.map((_, i) => x0 + step * (i + .5))
  const at = items.findIndex(item => item.value === value)
  const go = (i: number) => onGo?.(items[Math.min(k - 1, Math.max(0, i))]!.value)
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={x0 + 2} x2={x1 - 2} y1={y} y2={y} className="dp-faint" />
    {items.map((item, i) => <g key={item.value} onClick={() => go(i)} style={{cursor: onGo ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - step / 2} y={y - 14} width={step} height={22} fill="transparent" />
      <circle cx={xs[i]} cy={y} r={2} className="dp-faint" />
      <text x={xs[i]} y={y - 7} textAnchor="middle" className={i === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8}}>{item.label}</text>
    </g>)}
    {at >= 0 && <g onKeyDownCapture={onGo ? e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(at + d) }
    } : undefined}>
      <Handle x={xs[at]!} y={y} n={n} shape="square" label={label} does={[does, why].filter(Boolean).join(' ')}
        onDrag={onGo ? px => go(near(px)) : undefined} onReset={onGo ? () => onGo(def) : undefined} />
    </g>}
  </g>
}

type Mode = 'compact' | 'whole' | 'tile'

/** The document as a column of bars (one for each entry, as long as its words), its notes as cards beside it, and a line from each card
 * to the place its note stands on. Amber shows what the next note will stand on. A reading the picture needs and lacks is named in words
 * where it would stand. */
function Picture({p, w, h, mode}: {p: ViewProps; w: number; h: number; mode: Mode}) {
  const v = p.v, r = read(v), {entries, notes, open, show, anchor} = r
  const tile = mode === 'tile', whole = mode === 'whole'
  /** A choice the handle may set: nothing in the tile, nothing while the host holds the key disabled. */
  const act = <T extends string>(key: string) => (tile || st(p, key).disabled ? undefined : (x: T) => p.set(key, x))
  const list = notes ? beside(r, sorted(r, notes)) : []
  const top = tile ? 8 : 44, bottom = tile ? h - 8 : whole ? 116 : h - 14
  const px = tile ? 8 : 15, pw = tile ? 30 : whole ? 52 : 46, mx = tile ? 50 : whole ? 92 : 80, mw = w - mx - (tile ? 4 : 6)
  const count = entries?.length ?? 0
  const pitch = count ? (bottom - top) / count : 0, bh = Math.max(1.4, Math.min(2.8, pitch - 2.4))
  const yOf = (entry: number) => top + (entry - .5) * pitch
  const lenOf = (entry: number) => pw * (.3 + .7 * Math.min(1, (textOf(r, entry)?.length ?? 0) / 70))

  /** Where a note stands in the page: the end of its passage, of its bar, or the edge of the whole column. No place for an entry the page lacks. */
  const spot = (n: Note) => {
    if (n.entry === null) return {x: px + pw + 5, y: (top + bottom) / 2}
    const text = textOf(r, n.entry)
    if (text === undefined) return undefined
    const at = n.anchor === null ? -1 : text.indexOf(n.anchor), len = lenOf(n.entry)
    return {x: px + (at >= 0 && n.anchor !== null ? len * (at + n.anchor.length) / text.length : len + 2), y: yOf(n.entry)}
  }
  const maxCards = Math.max(1, Math.floor((bottom - top) / 9)), cards = list.slice(0, maxCards), more = list.length - cards.length
  const gap = 2, ch = Math.min(tile ? 15 : 17, ((bottom - top) - gap * (cards.length - 1)) / Math.max(1, cards.length))
  const cy = (k: number) => top + k * (ch + gap)
  const bracket = (x: number, y0: number, y1: number, dir: 1 | -1) => `M${x + dir * 2.5} ${y0}H${x}V${y1}H${x + dir * 2.5}`

  const chars = Math.max(6, Math.floor((mw - 2) / 4.6))
  const say = (text: string) => wrap(text, chars, 4)
  const message = notes === undefined ? say('No reading of the notes') : show === undefined ? say('No reading of Show') : notes.length === 0 ? ['No notes']
    : show === 'off' ? ['Notes off', `${notes.length} hidden`] : show === 'open' && open === undefined ? say('No reading of the open entry')
    : list.length === 0 ? [`None on`, `entry ${open ?? NONE}`] : []
  const lack = entries === undefined ? 'No reading of the entries' : count === 0 ? 'The page has no entries' : undefined
  const lackLines = lack ? wrap(lack, Math.max(6, Math.floor((mx - 12) / 4.6)), 4) : []
  const mid = (top + bottom) / 2 - 3
  const name = shown(v, 'name')

  // The amber reach of the next note: a span of the open entry, the open entry, or the whole column.
  const oy = open === undefined || !count ? 0 : yOf(open), ol = open === undefined || !count ? 0 : lenOf(open)
  const reach = !count || open === undefined || anchor === undefined ? null : anchor === 'selection'
    ? <rect x={px + ol * .3} y={oy - pitch / 2 + .5} width={Math.max(6, ol * .4)} height={pitch - 1} fill="none" stroke="var(--dp-on)" strokeWidth={1} strokeDasharray="2 1.5" />
    : <path d={bracket(px - 8, anchor === 'entry' ? oy - pitch / 2 + .5 : top, anchor === 'entry' ? oy + pitch / 2 - .5 : bottom, 1)} fill="none" stroke="var(--dp-on)" strokeWidth={1.5} />

  return <g>
    {!tile && <text x={6} y={12} className="dp-ink-dim">{whole ? `${name} · ${entries ? entries.length : NONE} entries` : name}</text>}
    {!tile && <Stops x0={8} x1={w - 8} y={32} items={ANCHORS} value={anchor} n={1} label="Anchor to" def="selection"
      does="Drag along the line to choose what the next note is about: a selection, the open entry or the whole document."
      onGo={act<AnchorTo>('anchor')} why={st(p, 'anchor').disabled} />}

    {entries?.map((e, i) => <rect key={i} x={px} y={yOf(i + 1) - bh / 2} width={lenOf(i + 1)} height={bh}
      fill={e.by === 'F' ? 'var(--text)' : 'var(--text-dim)'} opacity={i + 1 === open && !tile ? .95 : e.by === 'F' ? .7 : .4} />)}
    {lackLines.map((line, i) => <text key={i} x={(6 + mx - 4) / 2} y={mid - Math.max(0, lackLines.length - 2) * 5 + i * 10} textAnchor="middle" className="dp-axis">{line}</text>)}
    {!tile && count > 0 && open !== undefined && <path d={`M${px - 12} ${oy - 2.5}L${px - 9} ${oy}L${px - 12} ${oy + 2.5}Z`} fill="var(--dp-on)" />}
    {!tile && reach}

    {cards.map((n, k) => {
      const stale = isStale(r, n), colour = stale ? 'var(--stall)' : 'var(--dp-value)', a = count ? spot(n) : undefined, y = cy(k)
      const text = n.entry === null ? undefined : textOf(r, n.entry), at = text === undefined || n.anchor === null ? -1 : text.indexOf(n.anchor)
      const len = n.entry === null || text === undefined ? 0 : lenOf(n.entry)
      return <g key={n.id}>
        {count > 0 && (n.entry === null
          ? <path d={bracket(px + pw + 3, top, bottom, 1)} fill="none" stroke={colour} strokeWidth={1.1} opacity={.7} />
          : text === undefined ? null
          : n.anchor === null
            ? <path d={bracket(px - 2, yOf(n.entry) - pitch / 2 + .8, yOf(n.entry) + pitch / 2 - .8, -1)} fill="none" stroke={colour} strokeWidth={1.1} />
            : at >= 0
              ? <rect x={px + len * at / text.length} y={yOf(n.entry) - bh / 2 - .6} width={Math.max(3, len * n.anchor.length / text.length)} height={bh + 1.2} fill={colour} />
              : <text x={px + len + 3} y={yOf(n.entry) + 2.6} fill={colour} style={{fontSize: 7, fontWeight: 700}}>!</text>)}
        {a && <path d={`M${a.x} ${a.y}L${mx - 1} ${y + ch / 2}`} fill="none" stroke={colour} strokeWidth={.7} opacity={.5} strokeDasharray={stale ? '2 2' : undefined} />}
        <rect x={mx} y={y} width={mw} height={ch} fill="var(--text)" opacity={.07} />
        {n.timing === 'during' ? <rect x={mx} y={y} width={2.4} height={ch} fill={colour} />
          : <rect x={mx + .6} y={y + .6} width={1.8} height={ch - 1.2} fill="none" stroke={colour} strokeWidth={1} />}
        <text x={mx + 6} y={y + (ch >= 12 ? 7 : ch / 2 + 2.2)} fill={colour} style={{fontSize: 6.5, fontWeight: 600}}>{tagOf(r, n)}</text>
        {ch >= 12 && n.text && <rect x={mx + 6} y={y + ch - 5.5} width={Math.max(4, (mw - 11) * Math.min(1, n.text.length / 60))} height={1.5} fill="var(--text-dim)" opacity={.75} />}
      </g>
    })}
    {more > 0 && <text x={mx + mw / 2} y={bottom + 8} textAnchor="middle" className="dp-axis">+{more} more</text>}
    {message.map((line, i) => <text key={`${i}:${line}`} x={mx + mw / 2} y={mid - Math.max(0, message.length - 2) * 5 + i * 10} textAnchor="middle" className="dp-axis">{line}</text>)}

    {!tile && !whole && <text x={6} y={h - 4} className="dp-ink-dim" style={{fontSize: 8.5}}>{r.show ? SHOW_WORDS[r.show] : NONE} · {r.order ? ORDER_WORDS[r.order] : NONE}</text>}
    {whole && <>
      <Stops x0={8} x1={100} y={139} items={SHOWS} value={show} n={2} label="Show" def="all"
        does="Drag along the line to choose which notes stand beside the document: all, those of the open entry, or none."
        onGo={act<ShowId>('show')} why={st(p, 'show').disabled} />
      <Stops x0={108} x1={w - 8} y={139} items={ORDERS} value={r.order} n={3} label="Order" def="place"
        does="Drag along the line to order the list by the place of each note in the page, or by the time you wrote it."
        onGo={act<OrderId>('order')} why={st(p, 'order').disabled} />
    </>}
  </g>
}

/** The reading at the top right of the well. */
const cornerOf = (r: Read) => (r.notes === undefined ? NONE : r.show === 'off' ? 'off'
  : r.show === 'open' ? `${r.open === undefined ? NONE : beside(r, r.notes).length} of ${r.notes.length}` : noun(r.notes.length))

// ---------------------------------------------------------------- the pane: the page and its notes, to read and to write

interface Pick { readonly entry: number; readonly text: string; readonly x: number; readonly y: number }

/** An entry's words with the passages of its visible notes marked. A passage that is no longer in the entry marks nothing. */
function Body({text, marks, focus, onMark}: {text: string; marks: readonly {readonly id: string; readonly anchor: string}[]; focus?: string; onMark: (id: string) => void}) {
  const found = marks.flatMap(m => { const from = text.indexOf(m.anchor); return from < 0 ? [] : [{id: m.id, from, to: from + m.anchor.length}] }).sort((a, b) => a.from - b.from)
  const out: ReactNode[] = []
  let at = 0
  for (const m of found) {
    if (m.from < at) continue
    out.push(text.slice(at, m.from))
    out.push(<span key={m.id} className="nts-anchor" data-on={focus === m.id ? 'true' : undefined} data-i="Note|A note stands on this passage. Press to go to it." onClick={() => onMark(m.id)}>{text.slice(m.from, m.to)}</span>)
    at = m.to
  }
  out.push(text.slice(at))
  return <>{out}</>
}

function NotesPane({p}: {p: ViewProps}) {
  const {v, set} = p
  const r = read(v), {entries, notes, open, show} = r
  const list = notes ? sorted(r, beside(r, notes)) : []
  /** Why the pane may not edit the notes, in the host's words; the edits write the `notes` list. */
  const lock = st(p, 'notes').disabled
  const lockOpen = st(p, 'open').disabled
  const paneRef = useRef<HTMLDivElement>(null), pageRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<string>()
  const [fresh, setFresh] = useState<string>()
  const [pick, setPick] = useState<Pick | null>(null)

  useEffect(() => {
    if (!fresh) return
    paneRef.current?.querySelector<HTMLTextAreaElement>(`[data-note="${fresh}"] textarea`)?.focus()
    setFresh(undefined)
  }, [fresh, notes?.length])

  const commit = (next: readonly Note[]) => { if (!lock) set('notes', JSON.stringify(next)) }
  const patch = (id: string, change: Partial<Note>) => { if (notes) commit(notes.map(n => (n.id === id ? {...n, ...change} : n))) }
  const openEntry = (entry: number) => { if (!lockOpen) set('open', entry) }
  const add = (entry: number | null, anchor: string | null) => {
    if (!notes || !r.timing) return
    const note: Note = {id: `n${Date.now()}`, entry, anchor, text: '', timing: r.timing, at: nowIso(), replies: []}
    commit([...notes, note])
    if (entry !== null) openEntry(entry)
    setFocus(note.id)
    setFresh(note.id)
  }
  const goTo = (n: Note) => {
    setFocus(n.id)
    if (n.entry !== null) {
      openEntry(n.entry)
      pageRef.current?.querySelector(`[data-entry="${n.entry}"]`)?.scrollIntoView({block: 'nearest'})
    }
  }
  const focusNote = (id: string) => {
    setFocus(id)
    paneRef.current?.querySelector(`[data-note="${id}"]`)?.scrollIntoView({block: 'nearest'})
  }

  // The selection tool: the words you select in one entry, and the Note button above them.
  const grab = () => {
    const s = window.getSelection()
    if (!s || s.isCollapsed || !s.rangeCount) return setPick(null)
    const range = s.getRangeAt(0), node = range.commonAncestorContainer
    const body = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest('[data-entry]')
    const text = s.toString().replace(/\s+/g, ' ').trim()
    if (!body || !text || !pageRef.current?.contains(body) || !paneRef.current) return setPick(null)
    const box = range.getBoundingClientRect(), pane = paneRef.current.getBoundingClientRect()
    setPick({entry: Number(body.getAttribute('data-entry')), text: text.slice(0, 240), x: box.left + box.width / 2 - pane.left, y: Math.max(4, box.top - pane.top - 26)})
  }

  /** Why a note cannot be started at all, and then why not on what Anchor to names. */
  const blocked = lock ?? (notes === undefined ? 'No reading of the notes.' : r.timing === undefined ? 'No reading of Timing.' : show === undefined ? 'No reading of Show.'
    : show === 'off' ? 'Notes are off. Set Show to All or Open.' : undefined)
  const reason = blocked ?? (r.anchor === undefined ? 'No reading of Anchor to.' : r.anchor === 'selection' && !pick ? 'Select a passage first.'
    : r.anchor === 'entry' && open === undefined ? 'No reading of the open entry.' : undefined)
  const start = () => {
    if (reason) return
    if (r.anchor === 'selection' && pick) add(pick.entry, pick.text)
    else if (r.anchor === 'entry' && open !== undefined) add(open, null)
    else if (r.anchor === 'document') add(null, null)
  }
  const wholeDoc = list.filter(n => n.entry === null)
  const heading = notes === undefined || show === undefined ? `Notes · ${NONE}` : show === 'off' ? 'Notes · off' : show === 'open' ? `Notes · ${list.length} of ${notes.length}` : `Notes · ${notes.length}`

  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{shown(v, 'tabTitle')}</button>
    </div>
    <div className="nts-pane" ref={paneRef}>
      <div className="nts-page" ref={pageRef} onMouseDown={() => setPick(null)} onMouseUp={() => setTimeout(grab, 0)}>
        <h3 className="nts-title">{strOf(v, 'title')?.trim() || NONE}</h3>
        {wholeDoc.length > 0 && <button type="button" className="nts-docmark" data-i="Document|Notes stand on the whole document. Press to go to the first."
          onClick={() => focusNote(wholeDoc[0]!.id)}>{noun(wholeDoc.length)} on the whole document</button>}
        {entries === undefined && <p className="nts-empty">No reading of the entries.</p>}
        {entries?.length === 0 && <p className="nts-empty">The page has no entries.</p>}
        {entries?.map((e, i) => {
          const entry = i + 1, here = list.filter(n => n.entry === entry)
          return <article key={entry} className="nts-ent" data-open={entry === open ? 'true' : undefined} data-noted={here.some(n => n.anchor === null) ? 'true' : undefined}
            onClick={() => openEntry(entry)}>
            <div className="nts-lead"><b>{e.by.slice(0, 1) || NONE}</b>{entry}</div>
            <p className="nts-body" data-entry={entry}>
              <Body text={e.head} marks={here.flatMap(n => (n.anchor === null ? [] : [{id: n.id, anchor: n.anchor}]))} focus={focus} onMark={focusNote} />
            </p>
          </article>
        })}
      </div>
      <aside className="nts-col" aria-label="Notes">
        <div className="nts-col-head">
          <span>{heading}</span>
          <button type="button" className="nts-new" disabled={!!reason} onMouseDown={e => e.preventDefault()} onClick={start}
            data-i={`New note|${reason ?? (r.anchor === 'selection' ? 'Write a note on the selected passage.' : r.anchor === 'entry' ? `Write a note on entry ${open}.` : 'Write a note on the whole document.')}`}>New note</button>
        </div>
        {notes === undefined && <p className="nts-empty">No reading of the notes.</p>}
        {notes && show === undefined && <p className="nts-empty">No reading of Show.</p>}
        {notes?.length === 0 && <p className="nts-empty">No notes yet. Select a passage and press Note.</p>}
        {notes && notes.length > 0 && show === 'off' && <p className="nts-empty">Notes are off. {noun(notes.length)} hidden.</p>}
        {notes && notes.length > 0 && show === 'open' && open === undefined && <p className="nts-empty">No reading of the open entry.</p>}
        {notes && notes.length > 0 && show === 'open' && open !== undefined && list.length === 0 && <p className="nts-empty">No note stands on entry {open}.</p>}
        {list.map(n => {
          const stale = isStale(r, n)
          return <section key={n.id} className="nts-note" data-note={n.id} data-timing={n.timing} data-stale={stale ? 'true' : undefined} data-on={focus === n.id ? 'true' : undefined} onClick={() => goTo(n)}>
            <div className="nts-who">
              <b data-i="Place|The entry the note stands on, as the shell names it.">{tagOf(r, n)}</b>
              <button type="button" className="nts-timing" disabled={!!lock} data-i={`Timing|Press to switch this note between during reading and after reading.${lock ? ` ${lock}` : ''}`}
                onClick={e => { e.stopPropagation(); patch(n.id, {timing: n.timing === 'during' ? 'after' : 'during'}) }}>{n.timing}</button>
              <span>{whereOf(n)}</span>
              <time>{when(n.at)}</time>
            </div>
            {n.anchor !== null && <q className={stale ? 'stale' : undefined}>{n.anchor}</q>}
            <textarea className="nts-text" aria-label="The note" placeholder="Note…" rows={2} value={n.text} readOnly={!!lock} onChange={e => patch(n.id, {text: e.target.value})} />
            {n.replies.length > 0 && <div className="nts-replies">
              {n.replies.map((reply, k) => <input key={k} aria-label="Reply" value={reply} placeholder="Reply…" readOnly={!!lock}
                onChange={e => patch(n.id, {replies: n.replies.map((x, j) => (j === k ? e.target.value : x))})} />)}
            </div>}
            <div className="nts-acts">
              <button type="button" disabled={!!lock} data-i={`Reply|Add a reply under this note.${lock ? ` ${lock}` : ''}`} onClick={e => { e.stopPropagation(); patch(n.id, {replies: [...n.replies, '']}) }}>Reply</button>
              <button type="button" disabled={!!lock} data-i={`Remove|Take this note out of the document.${lock ? ` ${lock}` : ''}`}
                onClick={e => { e.stopPropagation(); if (notes) commit(notes.filter(x => x.id !== n.id)) }}>Remove</button>
            </div>
          </section>
        })}
      </aside>
      {pick && !blocked && <div className="nts-seltool" style={{left: pick.x, top: pick.y}}>
        <button type="button" data-i="Note|Attach a note to the selected passage." onMouseDown={e => e.preventDefault()} onClick={() => {
          add(pick.entry, pick.text)
          window.getSelection()?.removeAllRanges()
          setPick(null)
        }}>Note</button>
      </div>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

// The light reads the owner alone (manual §16.8): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})

const timingRadio = (p: ViewProps, r: Read) => <Radio {...st(p, 'timing')} label="Timing" does="When the next note is written: during the reading or after it." value={r.timing ?? ''} options={TIMINGS} stack onChange={x => p.set('timing', x)} />
const anchorRadio = (p: ViewProps, r: Read) => <Radio {...st(p, 'anchor')} label="Anchor to" does="What the next note is about when you start it with New note or a key. A note from a selection stands on the selection." value={r.anchor ?? ''} options={ANCHORS} stack onChange={x => p.set('anchor', x)} />
const showRadio = (p: ViewProps, r: Read) => <Radio {...st(p, 'show')} label="Show" does="Which notes stand beside the document: all, those of the open entry, or none." value={r.show ?? ''} options={SHOWS} stack onChange={x => p.set('show', x)} />
const orderRadio = (p: ViewProps, r: Read) => <Radio {...st(p, 'order')} label="Order" does="The order of the list of notes: by place in the page, or by time." value={r.order ?? ''} options={ORDERS} stack onChange={x => p.set('order', x)} />

function Macros({p}: {p: ViewProps}) {
  const r = read(p.v)
  return <>
    {timingRadio(p, r)}
    {anchorRadio(p, r)}
    {showRadio(p, r)}
    {orderRadio(p, r)}
  </>
}

/** The list whole: every note, in the chosen order, with its place and the time it was written. */
function listItems(r: Read): RowItem[] {
  if (r.notes === undefined) return [{id: 'none', name: 'No reading of the notes', light: 'unknown'}]
  if (!r.notes.length) return [{id: 'none', name: 'No notes yet', light: 'unknown'}]
  return sorted(r, r.notes).map(n => {
    const stale = isStale(r, n)
    return {
      id: n.id, name: n.text || 'Empty note', light: stale ? 'dark' as const : 'lit' as const, tone: 'value' as const,
      mark: <span className="nts-tag" data-stale={stale ? 'true' : undefined}>{tagOf(r, n)}</span>,
      meter: n.timing === 'after' ? <span className="nts-after">after</span> : undefined,
      why: stale ? 'Anchor not found. Review the note.' : undefined, note: clockOf(n.at), does: `${whereOf(n)}, ${when(n.at)}, written ${n.timing === 'after' ? 'after' : 'during'} reading.`,
    }
  })
}

const defaults = {
  light: 'lit', name: 'Factory flow', title: 'Factory original development Run — execution and continuation', tabTitle: 'Flow · flow-2026-10-03-1432',
  timing: 'during', anchor: 'selection', show: 'all', order: 'place',
  // The page and its notes: the open entry, the entries the page holds, the notes it keeps, the list's page.
  open: 4, listPage: 0,
  // The Factory flow's entries (flow-2026-10-03-1432.html), as the Document device reads them: `C` the Factory coordinator, `F` the person.
  entries: JSON.stringify([
    {by: 'C', head: 'This is the continuation Flow for the existing Factory development Run'},
    {by: 'C', head: 'The repaired startup image has been installed on Omarchy'},
    {by: 'C', head: 'The original development Run remains incomplete'},
    {by: 'C', head: 'The requested two-machine development Run remains incomplete'},
    {by: 'C', head: 'The original development Run still has seven required units'},
    {by: 'C', head: 'The original Run remains incomplete'},
    {by: 'C', head: 'The development Run has not started its workers'},
    {by: 'C', head: 'The first worker can retain its coordinator'},
    {by: 'F', head: 'Which unit starts first?'},
    {by: 'F', head: 'What if the repaired image fails?'},
    {by: 'C', head: 'Then the Run stops at the first unit.'},
    {by: 'F', head: 'I meant the second machine.'},
    {by: 'C', head: 'Both lines end at the first unit.'},
  ]),
  notes: JSON.stringify([
    {id: 'n1', entry: 3, anchor: 'remains incomplete', text: 'Seven units, none started. This is the line to chase.', timing: 'during', at: '2026-10-15T09:12', replies: []},
    {id: 'n2', entry: 4, anchor: null, text: 'Two machines. Check the repaired image on both.', timing: 'during', at: '2026-10-15T09:15', replies: ['Omarchy first.']},
    {id: 'n3', entry: 8, anchor: 'retain its coordinator', text: 'Why keep it? Ask before the first unit.', timing: 'during', at: '2026-10-15T09:05', replies: []},
    {id: 'n4', entry: 11, anchor: 'stops at the first unit', text: 'Same answer as entry 13. Fold the two.', timing: 'after', at: '2026-10-15T11:40', replies: []},
    {id: 'n5', entry: null, anchor: null, text: 'Read the whole flow again when the second image lands.', timing: 'after', at: '2026-10-15T11:52', replies: []},
  ]),
} as const

export const design: DesignedDevice = {
  id: 'central:notes',
  title: 'Notes',
  kind: 'effect',
  defaults,
  fixtures: {
    'Factory flow': {},
    // Entry 8 after someone rewrote it: the words that note 3 was made on are gone.
    'Passage moved': {entries: JSON.stringify((JSON.parse(defaults.entries) as Ent[]).map((e, i) => (i === 7 ? {...e, head: 'The first worker can keep its coordinator'} : e)))},
    'No notes': {notes: '[]'},
    'No readings': Object.fromEntries(Object.keys(defaults).map(key => [key, undefined])),
  },

  folded: p => {
    const r = read(p.v), c = counts(r)
    return <Folded title="Notes" light={light(p)} readings={[nounOf(c.notes), c.moved ? `${c.moved} moved` : r.show === 'all' ? (r.order ? ORDER_WORDS[r.order] : NONE) : r.show ? SHOW_WORDS[r.show] : NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Notes" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page and its notes" corner={cornerOf(read(p.v))}
        does="The page as a bar for each entry, and each note beside it. Drag handle 1 along the line to choose what the next note is about.">
        <Picture p={p} w={140} h={146} mode="compact" />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <Macros p={p} />
    </Section>
  </Panel>,

  whole: p => {
    const r = read(p.v), c = counts(r)
    return <Panel title="Notes" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The page and its notes" corner={cornerOf(r)}
            does="The page as a bar for each entry, and each note beside it with a line to its place. Handle 1 sets the anchor, handle 2 sets Show, handle 3 sets Order.">
            <Picture p={p} w={194} h={146} mode="whole" />
          </Display>
        </Section>
        <Section label="Notes" grow>
          <Rows items={listItems(r)} size={7} page={numOf(p.v, 'listPage')} onPage={x => p.set('listPage', x)}
            does="Every note of the page, in the chosen order. The mark is the entry the note stands on; after means written after reading." />
        </Section>
      </Band>
      <Band>
        <Section label="Write" width={64}>
          {timingRadio(p, r)}
        </Section>
        <Section label="Place" width={76}>
          {anchorRadio(p, r)}
        </Section>
        <Section label="View" width={68}>
          {showRadio(p, r)}
          {orderRadio(p, r)}
        </Section>
        <Section label="Readings" cols={3} grow>
          <Readout label="notes" does="Notes in the document." value={c.notes} tone="value" />
          <Readout label="passages" does="Notes that stand on a selection." value={c.passages} />
          <Readout label="entries" does="Notes that stand on a whole entry." value={c.entries} />
          <Readout label="document" does="Notes that stand on the whole document." value={c.document} />
          <Readout label="after" does="Notes written after reading." value={c.after} />
          <Readout label="moved" does="Notes whose passage is no longer in its entry. Review them." value={c.moved} tone={c.moved ? 'stall' : undefined} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <NotesPane p={p} />,

  widget: p => {
    const r = read(p.v), c = counts(r), top = r.notes ? sorted(r, r.notes).slice(0, 3) : []
    return <Tile title="Notes" light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={92} h={104} label="The page and its notes" does="The page with its notes beside it. Click it to open the notes.">
        <g onClick={p.nav.full} style={{cursor: 'pointer'}}><Picture p={p} w={92} h={104} mode="tile" /></g>
      </Display>
      <div className="nts-side">
        <div className="nts-side-top">
          <Readout big label="notes" does="Notes in the document." value={c.notes} tone="value" onPress={p.nav.full} />
          <Readout label="after" does="Notes written after reading." value={c.after} />
          <Readout label="moved" does="Notes whose passage is no longer in its entry." value={c.moved} tone={c.moved ? 'stall' : undefined} />
        </div>
        <ul className="nts-last">
          {r.notes === undefined && <li className="nts-last-empty">No reading of the notes</li>}
          {r.notes?.length === 0 && <li className="nts-last-empty">No notes yet</li>}
          {top.map(n => <li key={n.id}><button type="button" onClick={p.nav.full} data-i={`${tagOf(r, n)}|${whereOf(n)}. Press to open it in the pane.`}><b>{tagOf(r, n)}</b><span>{n.text || 'Empty note'}</span></button></li>)}
        </ul>
      </div>
    </Tile>
  },
}
