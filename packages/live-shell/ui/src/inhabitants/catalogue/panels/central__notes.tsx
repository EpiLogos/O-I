// Notes (manual §18.8): your own thoughts kept against a passage of a document. Live's nearest: the Locators of the Arrangement view — a
// mark with words, kept at a place and listed in order — at the size of Utility. The picture is the document and its notes: one bar for
// each entry of the page, each note as a card beside it, and a line from the card to the place it stands on (a passage, an entry or the
// whole document). A card with a solid edge was written during the reading, a hollow edge after it. A note keeps the form's own fields
// (documents/ql-flow.html :935 noteEl, :1075 act('note'); ql-daily-die.html :403, :650): the entry or Day field, the quoted passage
// (`anchor`, null for a whole entry), `timing` (during or after), the time (`at`), the words and the replies. A note whose passage is no
// longer in its entry says "anchor not found, review" (ql-flow.html :935). The shell reads the same notes for the Clip view's Notes
// column (central/documentPayload.ts PayloadNote; central/CentralClipDetail.tsx :132): the place as the author's initial and the entry's
// number ("C4"), a dash for a note that names none. The entries are the Factory flow's (Control/user/flows/flow-2026-10-03-1432.html);
// the notes are a fixture, because that flow holds none.
import {useEffect, useRef, useState, type ReactNode} from 'react'
import {Band, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type Option, type RowItem} from '../../sdk/panel'
import {num, on, str, type DesignedDevice, type ViewProps} from './design'
import './central__notes.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Timing = 'during' | 'after'
type AnchorTo = 'selection' | 'entry' | 'document'
type ShowId = 'all' | 'open' | 'off'
type OrderId = 'place' | 'time'

/** The Factory flow's entries (flow-2026-10-03-1432.html), as central__document.tsx reads them: `C` the Factory coordinator, `F` the person. */
const ENTRIES: readonly {readonly by: 'C' | 'F'; readonly head: string}[] = [
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
]
const FLOW_TITLE = 'Factory original development Run — execution and continuation'
const FLOW_TAB = 'Flow · flow-2026-10-03-1432'
/** Entry 8 after someone rewrote it: the words that note 3 was made on are gone. */
const MOVED_8 = 'The first worker can keep its coordinator'

/** A note, as the form keeps it. `entry` is the entry's number (1 to 13), null for a note on the whole document; `anchor` is the quoted
 * passage, null for a note on the whole entry. */
interface Note {
  readonly id: string
  readonly entry: number | null
  readonly anchor: string | null
  readonly text: string
  readonly timing: Timing
  readonly at: string
  readonly replies: readonly string[]
}

const SEED: readonly Note[] = [
  {id: 'n1', entry: 3, anchor: 'remains incomplete', text: 'Seven units, none started. This is the line to chase.', timing: 'during', at: '2026-10-15T09:12', replies: []},
  {id: 'n2', entry: 4, anchor: null, text: 'Two machines. Check the repaired image on both.', timing: 'during', at: '2026-10-15T09:15', replies: ['Omarchy first.']},
  {id: 'n3', entry: 8, anchor: 'retain its coordinator', text: 'Why keep it? Ask before the first unit.', timing: 'during', at: '2026-10-15T09:05', replies: []},
  {id: 'n4', entry: 11, anchor: 'stops at the first unit', text: 'Same answer as entry 13. Fold the two.', timing: 'after', at: '2026-10-15T11:40', replies: []},
  {id: 'n5', entry: null, anchor: null, text: 'Read the whole flow again when the second image lands.', timing: 'after', at: '2026-10-15T11:52', replies: []},
]

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

const notesOf = (v: V): Note[] => {
  try {
    const x: unknown = JSON.parse(str(v, 'notes'))
    return Array.isArray(x) ? (x as Note[]) : []
  } catch { return [] }
}
const openEntry = (v: V) => Math.min(ENTRIES.length, Math.max(1, Math.round(num(v, 'open'))))
const entryText = (v: V, entry: number) => (entry === 8 && on(v, 'moved') ? MOVED_8 : ENTRIES[entry - 1]?.head ?? '')
/** The form's own test: the quoted passage is no longer in its entry (ql-flow.html :935). */
const isStale = (v: V, n: Note) => n.anchor !== null && n.entry !== null && !entryText(v, n.entry).includes(n.anchor)
/** The place as the shell reads it: the author's initial and the entry's number; a dash for a note that names no entry. */
const tagOf = (n: Note) => (n.entry === null ? '—' : `${ENTRIES[n.entry - 1]?.by ?? ''}${n.entry}`)
const whereOf = (n: Note) => (n.entry === null ? 'On the whole document' : n.anchor === null ? 'On the whole entry' : 'On a passage')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const when = (at: string) => `${Number(at.slice(8, 10))} ${MONTHS[Number(at.slice(5, 7)) - 1] ?? ''} ${at.slice(11, 16)}`
const nowIso = () => {
  const d = new Date(), p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const placeKey = (v: V, n: Note) => {
  if (n.entry === null) return 0
  if (n.anchor === null) return n.entry * 1000
  const at = entryText(v, n.entry).indexOf(n.anchor)
  return n.entry * 1000 + (at < 0 ? 999 : 1 + at)
}
/** The list in the chosen order: by the note's place in the page (the whole document first), or by the time it was written. */
const sorted = (v: V, notes: readonly Note[]) =>
  [...notes].sort(str(v, 'order') === 'time' ? (a, b) => a.at.localeCompare(b.at) : (a, b) => placeKey(v, a) - placeKey(v, b))
/** The notes that stand beside the document, by Show. */
const beside = (v: V, notes: readonly Note[]) => {
  const show = str(v, 'show') as ShowId
  return show === 'off' ? [] : show === 'open' ? notes.filter(n => n.entry === openEntry(v)) : notes
}

function counts(v: V, notes: readonly Note[]) {
  return {
    notes: notes.length,
    passages: notes.filter(n => n.anchor !== null).length,
    entries: notes.filter(n => n.entry !== null && n.anchor === null).length,
    document: notes.filter(n => n.entry === null).length,
    after: notes.filter(n => n.timing === 'after').length,
    moved: notes.filter(n => isStale(v, n)).length,
  }
}
const noun = (n: number) => `${n} note${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------- the display: the page and its notes

/** A line with a stop for each choice, and a handle on the one that is set. Arrow keys step to the next stop. */
function Stops<T extends string>({x0, x1, y, items, value, n, label, does, def, onGo}: {
  readonly x0: number; readonly x1: number; readonly y: number; readonly items: readonly {readonly value: T; readonly label: string}[]
  readonly value: T; readonly n: number; readonly label: string; readonly does: string; readonly def: T; readonly onGo?: (value: T) => void
}) {
  const k = items.length, step = (x1 - x0) / k, xs = items.map((_, i) => x0 + step * (i + .5))
  const at = Math.max(0, items.findIndex(item => item.value === value))
  const go = (i: number) => onGo?.(items[Math.min(k - 1, Math.max(0, i))]!.value)
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={x0 + 2} x2={x1 - 2} y1={y} y2={y} className="dp-faint" />
    {items.map((item, i) => <g key={item.value} onClick={() => go(i)} style={{cursor: onGo ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - step / 2} y={y - 14} width={step} height={22} fill="transparent" />
      <circle cx={xs[i]} cy={y} r={2} className="dp-faint" />
      <text x={xs[i]} y={y - 7} textAnchor="middle" className={i === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8}}>{item.label}</text>
    </g>)}
    {onGo && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(at + d) }
    }}>
      <Handle x={xs[at]!} y={y} n={n} shape="square" label={label} does={does} onDrag={px => go(near(px))} onReset={() => onGo(def)} />
    </g>}
  </g>
}

type Mode = 'compact' | 'whole' | 'tile'

/** The document as a column of bars (one for each entry, as long as its words), its notes as cards beside it, and a line from each card
 * to the place its note stands on. Amber shows what the next note will stand on. */
function Picture({v, set, w, h, mode}: {v: V; set?: SetFn; w: number; h: number; mode: Mode}) {
  const all = notesOf(v), list = beside(v, sorted(v, all)), show = str(v, 'show') as ShowId, anchor = str(v, 'anchor') as AnchorTo
  const tile = mode === 'tile', whole = mode === 'whole'
  const top = tile ? 8 : 44, bottom = tile ? h - 8 : whole ? 116 : h - 14
  const px = tile ? 8 : 15, pw = tile ? 30 : whole ? 52 : 46, mx = tile ? 50 : whole ? 92 : 80, mw = w - mx - (tile ? 4 : 6)
  const pitch = (bottom - top) / ENTRIES.length, bh = Math.max(1.4, Math.min(2.8, pitch - 2.4))
  const yOf = (entry: number) => top + (entry - .5) * pitch
  const lenOf = (entry: number) => pw * (.3 + .7 * Math.min(1, (ENTRIES[entry - 1]?.head.length ?? 0) / 70))
  const open = openEntry(v)

  /** Where a note stands in the page: the end of its passage, of its bar, or the edge of the whole column. */
  const spot = (n: Note) => {
    if (n.entry === null) return {x: px + pw + 5, y: (top + bottom) / 2}
    const text = entryText(v, n.entry), at = n.anchor === null ? -1 : text.indexOf(n.anchor), len = lenOf(n.entry)
    return {x: px + (at >= 0 && n.anchor !== null ? len * (at + n.anchor.length) / text.length : len + 2), y: yOf(n.entry)}
  }
  const maxCards = Math.max(1, Math.floor((bottom - top) / 9)), cards = list.slice(0, maxCards), more = list.length - cards.length
  const gap = 2, ch = Math.min(tile ? 15 : 17, ((bottom - top) - gap * (cards.length - 1)) / Math.max(1, cards.length))
  const cy = (k: number) => top + k * (ch + gap)
  const bracket = (x: number, y0: number, y1: number, dir: 1 | -1) => `M${x + dir * 2.5} ${y0}H${x}V${y1}H${x + dir * 2.5}`

  const message = all.length === 0 ? ['No notes'] : show === 'off' ? ['Notes off', `${all.length} hidden`] : list.length === 0 ? [`None on`, `entry ${open}`] : []

  // The amber reach of the next note: a span of the open entry, the open entry, or the whole column.
  const oy = yOf(open), ol = lenOf(open)
  const reach = anchor === 'selection'
    ? <rect x={px + ol * .3} y={oy - pitch / 2 + .5} width={Math.max(6, ol * .4)} height={pitch - 1} fill="none" stroke="var(--dp-on)" strokeWidth={1} strokeDasharray="2 1.5" />
    : <path d={bracket(px - 8, anchor === 'entry' ? oy - pitch / 2 + .5 : top, anchor === 'entry' ? oy + pitch / 2 - .5 : bottom, 1)} fill="none" stroke="var(--dp-on)" strokeWidth={1.5} />

  return <g>
    {!tile && <text x={6} y={12} className="dp-ink-dim">{whole ? `Factory flow · ${ENTRIES.length} entries` : 'Factory flow'}</text>}
    {!tile && <Stops x0={8} x1={w - 8} y={32} items={ANCHORS} value={anchor} n={1} label="Anchor to" def="selection"
      does="Drag along the line to choose what the next note is about: a selection, the open entry or the whole document."
      onGo={set ? x => set('anchor', x) : undefined} />}

    {ENTRIES.map((e, i) => <rect key={i} x={px} y={yOf(i + 1) - bh / 2} width={lenOf(i + 1)} height={bh}
      fill={e.by === 'F' ? 'var(--text)' : 'var(--text-dim)'} opacity={i + 1 === open && !tile ? .95 : e.by === 'F' ? .7 : .4} />)}
    {!tile && <path d={`M${px - 12} ${oy - 2.5}L${px - 9} ${oy}L${px - 12} ${oy + 2.5}Z`} fill="var(--dp-on)" />}
    {!tile && reach}

    {cards.map((n, k) => {
      const st = isStale(v, n), colour = st ? 'var(--stall)' : 'var(--dp-value)', a = spot(n), y = cy(k)
      const text = entryText(v, n.entry ?? 1), at = n.anchor === null ? -1 : text.indexOf(n.anchor), len = n.entry === null ? 0 : lenOf(n.entry)
      return <g key={n.id}>
        {n.entry === null
          ? <path d={bracket(px + pw + 3, top, bottom, 1)} fill="none" stroke={colour} strokeWidth={1.1} opacity={.7} />
          : n.anchor === null
            ? <path d={bracket(px - 2, yOf(n.entry) - pitch / 2 + .8, yOf(n.entry) + pitch / 2 - .8, -1)} fill="none" stroke={colour} strokeWidth={1.1} />
            : at >= 0
              ? <rect x={px + len * at / text.length} y={yOf(n.entry) - bh / 2 - .6} width={Math.max(3, len * n.anchor.length / text.length)} height={bh + 1.2} fill={colour} />
              : <text x={px + len + 3} y={yOf(n.entry) + 2.6} fill={colour} style={{fontSize: 7, fontWeight: 700}}>!</text>}
        <path d={`M${a.x} ${a.y}L${mx - 1} ${y + ch / 2}`} fill="none" stroke={colour} strokeWidth={.7} opacity={.5} strokeDasharray={st ? '2 2' : undefined} />
        <rect x={mx} y={y} width={mw} height={ch} fill="var(--text)" opacity={.07} />
        {n.timing === 'during' ? <rect x={mx} y={y} width={2.4} height={ch} fill={colour} />
          : <rect x={mx + .6} y={y + .6} width={1.8} height={ch - 1.2} fill="none" stroke={colour} strokeWidth={1} />}
        <text x={mx + 6} y={y + (ch >= 12 ? 7 : ch / 2 + 2.2)} fill={colour} style={{fontSize: 6.5, fontWeight: 600}}>{tagOf(n)}</text>
        {ch >= 12 && n.text && <rect x={mx + 6} y={y + ch - 5.5} width={Math.max(4, (mw - 11) * Math.min(1, n.text.length / 60))} height={1.5} fill="var(--text-dim)" opacity={.75} />}
      </g>
    })}
    {more > 0 && <text x={mx + mw / 2} y={bottom + 8} textAnchor="middle" className="dp-axis">+{more} more</text>}
    {message.map((line, i) => <text key={line} x={mx + mw / 2} y={(top + bottom) / 2 - 3 + i * 10} textAnchor="middle" className="dp-axis">{line}</text>)}

    {!tile && !whole && <text x={6} y={h - 4} className="dp-ink-dim" style={{fontSize: 8.5}}>{SHOW_WORDS[show]} · {ORDER_WORDS[str(v, 'order') as OrderId]}</text>}
    {whole && <>
      <Stops x0={8} x1={100} y={139} items={SHOWS} value={show} n={2} label="Show" def="all"
        does="Drag along the line to choose which notes stand beside the document: all, those of the open entry, or none."
        onGo={set ? x => set('show', x) : undefined} />
      <Stops x0={108} x1={w - 8} y={139} items={ORDERS} value={str(v, 'order') as OrderId} n={3} label="Order" def="place"
        does="Drag along the line to order the list by the place of each note in the page, or by the time you wrote it."
        onGo={set ? x => set('order', x) : undefined} />
    </>}
  </g>
}

/** The reading at the top right of the well. */
const cornerOf = (v: V) => {
  const all = notesOf(v), show = str(v, 'show') as ShowId
  return show === 'off' ? 'off' : show === 'open' ? `${beside(v, all).length} of ${all.length}` : noun(all.length)
}

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
  const all = notesOf(v), show = str(v, 'show') as ShowId, anchorTo = str(v, 'anchor') as AnchorTo, open = openEntry(v)
  const list = sorted(v, beside(v, all))
  const paneRef = useRef<HTMLDivElement>(null), pageRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<string>()
  const [fresh, setFresh] = useState<string>()
  const [pick, setPick] = useState<Pick | null>(null)

  useEffect(() => {
    if (!fresh) return
    paneRef.current?.querySelector<HTMLTextAreaElement>(`[data-note="${fresh}"] textarea`)?.focus()
    setFresh(undefined)
  }, [fresh, all.length])

  const commit = (next: readonly Note[]) => set('notes', JSON.stringify(next))
  const patch = (id: string, change: Partial<Note>) => commit(all.map(n => (n.id === id ? {...n, ...change} : n)))
  const add = (entry: number | null, anchor: string | null) => {
    const note: Note = {id: `n${Date.now()}`, entry, anchor, text: '', timing: str(v, 'timing') as Timing, at: nowIso(), replies: []}
    commit([...all, note])
    if (entry !== null) set('open', entry)
    setFocus(note.id)
    setFresh(note.id)
  }
  const goTo = (n: Note) => {
    setFocus(n.id)
    if (n.entry !== null) {
      set('open', n.entry)
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
    const r = s.getRangeAt(0), node = r.commonAncestorContainer
    const body = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest('[data-entry]')
    const text = s.toString().replace(/\s+/g, ' ').trim()
    if (!body || !text || !pageRef.current?.contains(body) || !paneRef.current) return setPick(null)
    const box = r.getBoundingClientRect(), pane = paneRef.current.getBoundingClientRect()
    setPick({entry: Number(body.getAttribute('data-entry')), text: text.slice(0, 240), x: box.left + box.width / 2 - pane.left, y: Math.max(4, box.top - pane.top - 26)})
  }

  const reason = show === 'off' ? 'Notes are off. Set Show to All or Open.' : anchorTo === 'selection' && !pick ? 'Select a passage first.' : undefined
  const start = () => {
    if (reason) return
    if (anchorTo === 'selection' && pick) add(pick.entry, pick.text)
    else if (anchorTo === 'entry') add(open, null)
    else add(null, null)
  }
  const wholeDoc = list.filter(n => n.entry === null)

  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{FLOW_TAB}</button>
    </div>
    <div className="nts-pane" ref={paneRef}>
      <div className="nts-page" ref={pageRef} onMouseDown={() => setPick(null)} onMouseUp={() => setTimeout(grab, 0)}>
        <h3 className="nts-title">{FLOW_TITLE}</h3>
        {wholeDoc.length > 0 && <button type="button" className="nts-docmark" data-i="Document|Notes stand on the whole document. Press to go to the first."
          onClick={() => focusNote(wholeDoc[0]!.id)}>{noun(wholeDoc.length)} on the whole document</button>}
        {ENTRIES.map((e, i) => {
          const entry = i + 1, here = list.filter(n => n.entry === entry)
          return <article key={entry} className="nts-ent" data-open={entry === open ? 'true' : undefined} data-noted={here.some(n => n.anchor === null) ? 'true' : undefined}
            onClick={() => set('open', entry)}>
            <div className="nts-lead"><b>{e.by}</b>{entry}</div>
            <p className="nts-body" data-entry={entry}>
              <Body text={entryText(v, entry)} marks={here.flatMap(n => (n.anchor === null ? [] : [{id: n.id, anchor: n.anchor}]))} focus={focus} onMark={focusNote} />
            </p>
          </article>
        })}
      </div>
      <aside className="nts-col" aria-label="Notes">
        <div className="nts-col-head">
          <span>{show === 'off' ? 'Notes · off' : show === 'open' ? `Notes · ${list.length} of ${all.length}` : `Notes · ${all.length}`}</span>
          <button type="button" className="nts-new" disabled={!!reason} onMouseDown={e => e.preventDefault()} onClick={start}
            data-i={`New note|${reason ?? (anchorTo === 'selection' ? 'Write a note on the selected passage.' : anchorTo === 'entry' ? `Write a note on entry ${open}.` : 'Write a note on the whole document.')}`}>New note</button>
        </div>
        {all.length === 0 && <p className="nts-empty">No notes yet. Select a passage and press Note.</p>}
        {all.length > 0 && show === 'off' && <p className="nts-empty">Notes are off. {noun(all.length)} hidden.</p>}
        {all.length > 0 && show === 'open' && list.length === 0 && <p className="nts-empty">No note stands on entry {open}.</p>}
        {list.map(n => {
          const st = isStale(v, n)
          return <section key={n.id} className="nts-note" data-note={n.id} data-timing={n.timing} data-stale={st ? 'true' : undefined} data-on={focus === n.id ? 'true' : undefined} onClick={() => goTo(n)}>
            <div className="nts-who">
              <b data-i="Place|The entry the note stands on, as the shell names it.">{tagOf(n)}</b>
              <button type="button" className="nts-timing" data-i="Timing|Press to switch this note between during reading and after reading."
                onClick={e => { e.stopPropagation(); patch(n.id, {timing: n.timing === 'during' ? 'after' : 'during'}) }}>{n.timing}</button>
              <span>{whereOf(n)}</span>
              <time>{when(n.at)}</time>
            </div>
            {n.anchor !== null && <q className={st ? 'stale' : undefined}>{n.anchor}</q>}
            <textarea className="nts-text" aria-label="The note" placeholder="Note…" rows={2} value={n.text} onChange={e => patch(n.id, {text: e.target.value})} />
            {n.replies.length > 0 && <div className="nts-replies">
              {n.replies.map((r, k) => <input key={k} aria-label="Reply" value={r} placeholder="Reply…" onChange={e => patch(n.id, {replies: n.replies.map((x, j) => (j === k ? e.target.value : x))})} />)}
            </div>}
            <div className="nts-acts">
              <button type="button" data-i="Reply|Add a reply under this note." onClick={e => { e.stopPropagation(); patch(n.id, {replies: [...n.replies, '']}) }}>Reply</button>
              <button type="button" data-i="Remove|Take this note out of the document." onClick={e => { e.stopPropagation(); commit(all.filter(x => x.id !== n.id)) }}>Remove</button>
            </div>
          </section>
        })}
      </aside>
      {pick && show !== 'off' && <div className="nts-seltool" style={{left: pick.x, top: pick.y}}>
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

const light = (v: V) => str(v, 'light') as 'lit' | 'dark' | 'unknown'
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

function Macros({p}: {p: ViewProps}) {
  return <>
    <Radio label="Timing" does="When the next note is written: during the reading or after it." value={str(p.v, 'timing') as Timing} options={TIMINGS} stack onChange={x => p.set('timing', x)} />
    <Radio label="Anchor to" does="What the next note is about when you start it with New note or a key. A note from a selection stands on the selection." value={str(p.v, 'anchor') as AnchorTo} options={ANCHORS} stack onChange={x => p.set('anchor', x)} />
    <Radio label="Show" does="Which notes stand beside the document: all, those of the open entry, or none." value={str(p.v, 'show') as ShowId} options={SHOWS} stack onChange={x => p.set('show', x)} />
    <Radio label="Order" does="The order of the list of notes: by place in the page, or by time." value={str(p.v, 'order') as OrderId} options={ORDERS} stack onChange={x => p.set('order', x)} />
  </>
}

/** The list whole: every note, in the chosen order, with its place and the time it was written. */
function listItems(v: V, all: readonly Note[]): RowItem[] {
  if (!all.length) return [{id: 'none', name: 'No notes yet', light: 'unknown'}]
  return sorted(v, all).map(n => {
    const st = isStale(v, n)
    return {
      id: n.id, name: n.text || 'Empty note', light: st ? 'dark' as const : 'lit' as const, tone: 'value' as const,
      mark: <span className="nts-tag" data-stale={st ? 'true' : undefined}>{tagOf(n)}</span>,
      meter: n.timing === 'after' ? <span className="nts-after">after</span> : undefined,
      why: st ? 'Anchor not found. Review the note.' : undefined, note: n.at.slice(11, 16), does: `${whereOf(n)}, ${when(n.at)}, written ${n.timing === 'after' ? 'after' : 'during'} reading.`,
    }
  })
}

export const design: DesignedDevice = {
  id: 'central:notes',
  title: 'Notes',
  kind: 'effect',
  defaults: {
    light: 'lit', timing: 'during', anchor: 'selection', show: 'all', order: 'place',
    // The page and its notes: the open entry, whether entry 8 was rewritten, the notes the page keeps, the list's page.
    open: 4, moved: false, notes: JSON.stringify(SEED), listPage: 0,
  },
  fixtures: {
    'Factory flow': {},
    'Passage moved': {moved: true},
    'No notes': {notes: '[]'},
  },

  folded: p => {
    const c = counts(p.v, notesOf(p.v)), show = str(p.v, 'show') as ShowId
    return <Folded title="Notes" light={light(p.v)} readings={[noun(c.notes), c.moved ? `${c.moved} moved` : show === 'all' ? ORDER_WORDS[str(p.v, 'order') as OrderId] : SHOW_WORDS[show]]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Notes" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page and its notes" corner={cornerOf(p.v)}
        does="The page as a bar for each entry, and each note beside it. Drag handle 1 along the line to choose what the next note is about.">
        <Picture v={p.v} set={p.set} w={140} h={146} mode="compact" />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <Macros p={p} />
    </Section>
  </Panel>,

  whole: p => {
    const all = notesOf(p.v), c = counts(p.v, all)
    return <Panel title="Notes" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The page and its notes" corner={cornerOf(p.v)}
            does="The page as a bar for each entry, and each note beside it with a line to its place. Handle 1 sets the anchor, handle 2 sets Show, handle 3 sets Order.">
            <Picture v={p.v} set={p.set} w={194} h={146} mode="whole" />
          </Display>
        </Section>
        <Section label="Notes" grow>
          <Rows items={listItems(p.v, all)} size={7} page={num(p.v, 'listPage')} onPage={x => p.set('listPage', x)}
            does="Every note of the page, in the chosen order. The mark is the entry the note stands on; after means written after reading." />
        </Section>
      </Band>
      <Band>
        <Section label="Write" width={64}>
          <Radio label="Timing" does="When the next note is written: during the reading or after it." value={str(p.v, 'timing') as Timing} options={TIMINGS} stack onChange={x => p.set('timing', x)} />
        </Section>
        <Section label="Place" width={76}>
          <Radio label="Anchor to" does="What the next note is about when you start it with New note or a key. A note from a selection stands on the selection." value={str(p.v, 'anchor') as AnchorTo} options={ANCHORS} stack onChange={x => p.set('anchor', x)} />
        </Section>
        <Section label="View" width={68}>
          <Radio label="Show" does="Which notes stand beside the document: all, those of the open entry, or none." value={str(p.v, 'show') as ShowId} options={SHOWS} stack onChange={x => p.set('show', x)} />
          <Radio label="Order" does="The order of the list of notes: by place in the page, or by time." value={str(p.v, 'order') as OrderId} options={ORDERS} stack onChange={x => p.set('order', x)} />
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
    const all = notesOf(p.v), c = counts(p.v, all), top = sorted(p.v, all).slice(0, 3)
    return <Tile title="Notes" light={light(p.v)} span={2} onFull={p.nav.full}>
      <Display w={92} h={104} label="The page and its notes" does="The page with its notes beside it. Click it to open the notes.">
        <g onClick={p.nav.full} style={{cursor: 'pointer'}}><Picture v={p.v} w={92} h={104} mode="tile" /></g>
      </Display>
      <div className="nts-side">
        <div className="nts-side-top">
          <Readout big label="notes" does="Notes in the document." value={c.notes} tone="value" onPress={p.nav.full} />
          <Readout label="after" does="Notes written after reading." value={c.after} />
          <Readout label="moved" does="Notes whose passage is no longer in its entry." value={c.moved} tone={c.moved ? 'stall' : undefined} />
        </div>
        <ul className="nts-last">
          {top.length === 0 && <li className="nts-last-empty">No notes yet</li>}
          {top.map(n => <li key={n.id}><button type="button" onClick={p.nav.full} data-i={`${tagOf(n)}|${whereOf(n)}. Press to open it in the pane.`}><b>{tagOf(n)}</b><span>{n.text || 'Empty note'}</span></button></li>)}
        </ul>
      </div>
    </Tile>
  },
}
