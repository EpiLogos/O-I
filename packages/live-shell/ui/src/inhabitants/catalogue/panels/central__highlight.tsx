// The Highlight (manual §18.1): an effect on a Central document's chain, after Text. Live's nearest: Utility — a small effect with a few
// states and one picture. It marks a passage and leaves the passage whole: a highlight is a <mark> span round the words, and the words
// stay as they were (desktop/cradle/documents/ql-flow.html:1074 act('hl') wraps the selection; ql-daily-die.html:649 does the same in a
// Day field). The selection tool is the template's own bar (ql-flow.html:1063): Highlight, Note, To packet, Answer this; a Day's bar has
// the first three (ql-daily-die.html:643). The document reads its highlights back as passages with the entry that holds each
// (central/documentPayload.ts markedPassages :99, entryPlace :117 — "C3"). The templates keep one marker colour, yellow
// (--hl, #FFE97A); Colour, Show, Pen and the tool's Off switch are the operations that the templates take on (manual §18.1).
//
// Bindable: the page's material is value keys, never a constant here. `entries` is a JSON list of {n, by, text} (an entry's number,
// its author's letter, its words); `marks` keeps one character for each word of each entry — a colour's letter, or "." — with the
// entries joined by "|"; `passage` is the JSON {e, a, b} of the passage the document holds selected (entry index, first word, end
// word); `flow` and `flowTitle` name the open document. The sample readings sit in the defaults and the fixtures below.
import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react'
import {Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, has, json, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__highlight.css'

type V = ViewProps['v']
type ColourId = 'yellow' | 'green' | 'blue' | 'pink'

/** The four marker colours. Yellow is the template's own mark; the others are the same pale value in other hues. */
const COLOURS: readonly {readonly value: ColourId; readonly label: string; readonly ch: string; readonly css: string; readonly does: string}[] = [
  {value: 'yellow', label: 'Yellow', ch: 'y', css: '#FFE97A', does: 'The next highlight is yellow, the template\'s own mark.'},
  {value: 'green', label: 'Green', ch: 'g', css: '#B5EBA3', does: 'The next highlight is green.'},
  {value: 'blue', label: 'Blue', ch: 'b', css: '#A6D8FF', does: 'The next highlight is blue.'},
  {value: 'pink', label: 'Pink', ch: 'p', css: '#FFB8D6', does: 'The next highlight is pink.'},
]
type Colour = (typeof COLOURS)[number]
const SWATCHES = {'--hl-yellow': COLOURS[0]!.css, '--hl-green': COLOURS[1]!.css, '--hl-blue': COLOURS[2]!.css, '--hl-pink': COLOURS[3]!.css} as CSSProperties
const SHOWS = [
  {value: 'all', label: 'All', does: 'Every word shows.'},
  {value: 'marks', label: 'Highlights', does: 'Only the highlights show. The other words fade.'},
] as const
const colourOf = (v: V): Colour | undefined => COLOURS.find(c => c.value === strOf(v, 'colour'))
const byChar = (ch: string) => COLOURS.find(c => c.ch === ch)

const NO_ENTRIES = 'No reading of the entries'
const NO_MARKS = 'No reading of the highlights'

// ---------------------------------------------------------------- the readings: entries, marks, the held passage

interface Entry {readonly n: string; readonly by: string; readonly text: string; readonly words: readonly string[]}
/** The entries of the open document, or undefined when the owner reports none (or what it reports cannot be read). */
function entriesOf(v: V): Entry[] | undefined {
  const raw = json<unknown>(v, 'entries', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((item: unknown): Entry[] => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>
    const text = typeof o.text === 'string' ? o.text : ''
    return [{n: o.n === undefined || o.n === null ? '' : String(o.n), by: typeof o.by === 'string' ? o.by : '', text, words: text.split(/\s+/).filter(Boolean)}]
  })
}

/** One character for each word of each entry — a colour's letter or "." — or undefined when the marks or the entries are not reported. */
function cellsOf(v: V, entries: readonly Entry[] | undefined): string[][] | undefined {
  const raw = strOf(v, 'marks')
  if (raw === undefined || !entries) return undefined
  const rows = raw.split('|')
  return entries.map((en, e) => en.words.map((_w, k) => { const ch = rows[e]?.[k]; return ch && byChar(ch) ? ch : '.' }))
}

interface Run {readonly e: number; readonly a: number; readonly b: number; readonly ch: string}
/** The highlights: each unbroken run of one colour is one passage. */
function runsOf(cells: readonly (readonly string[])[]): Run[] {
  const out: Run[] = []
  cells.forEach((row, e) => {
    let k = 0
    while (k < row.length) {
      const ch = row[k]!
      if (ch === '.') { k++; continue }
      let j = k
      while (j < row.length && row[j] === ch) j++
      out.push({e, a: k, b: j, ch})
      k = j
    }
  })
  return out
}

interface Read {
  readonly entries: readonly Entry[] | undefined
  readonly cells: string[][] | undefined
  /** The highlights; undefined when the owner reports no marks or no entries to read them against. */
  readonly runs: Run[] | undefined
  readonly colour: Colour | undefined
}
function readOf(v: V): Read {
  const entries = entriesOf(v), cells = cellsOf(v, entries)
  return {entries, cells, runs: cells && runsOf(cells), colour: colourOf(v)}
}

interface Passage {readonly e: number; readonly a: number; readonly b: number}
/** The passage the document holds selected, when it is reported and lies inside the entries. */
function heldPassage(v: V, entries: readonly Entry[] | undefined): Passage | undefined {
  const raw = json<unknown>(v, 'passage', undefined)
  if (!raw || typeof raw !== 'object' || !entries) return undefined
  const {e, a, b} = raw as Record<string, unknown>
  if (typeof e !== 'number' || typeof a !== 'number' || typeof b !== 'number' || !Number.isInteger(e) || !Number.isInteger(a) || !Number.isInteger(b)) return undefined
  const n = entries[e]?.words.length
  return n !== undefined && a >= 0 && b > a && b <= n ? {e, a, b} : undefined
}

const wordsOf = (rd: Read, r: Run) => rd.entries?.[r.e]?.words.slice(r.a, r.b).join(' ') || NONE
const anchorOf = (en: Entry | undefined) => (en ? `${en.by}${en.n}` || NONE : NONE)
const placeOf = (en: Entry | undefined) => `entry ${en?.n || NONE} (${en?.by || NONE})`
const countWords = (n: number | undefined) => (n === undefined ? NONE : n === 0 ? 'none' : `${n} highlight${n === 1 ? '' : 's'}`)
const colourCount = (rd: Read) => (rd.runs ? new Set(rd.runs.map(r => r.ch)).size : undefined)

/** Choose Highlight on a passage: every word already marked → the marks come off; otherwise the chosen colour goes on. Undefined when
 * the marks would need a colour that is not chosen. */
function toggled(cells: readonly (readonly string[])[], colour: Colour | undefined, at: Passage): string | undefined {
  const rows = cells.map(r => [...r]), row = rows[at.e]
  if (!row) return undefined
  const all = row.slice(at.a, at.b).every(c => c !== '.')
  if (!all && !colour) return undefined
  for (let k = at.a; k < at.b; k++) row[k] = all ? '.' : colour!.ch
  return rows.map(r => r.join('')).join('|')
}
const marked = (cells: readonly (readonly string[])[], at: Passage) => !!cells[at.e] && cells[at.e]!.slice(at.a, at.b).every(c => c !== '.')

/** Why Highlight cannot act on this passage now, or undefined when it can. */
function markWhy(p: ViewProps, rd: Read, at: Passage | undefined): string | undefined {
  const own = st(p, 'marks').disabled
  if (own) return own
  if (!rd.cells) return 'No reading of the highlights yet.'
  if (!at) return 'No passage is selected.'
  if (!rd.colour && !marked(rd.cells, at)) return 'Choose a colour first.'
  return undefined
}
function toggleMarks(p: ViewProps, rd: Read, at: Passage) {
  if (markWhy(p, rd, at) || !rd.cells) return
  const next = toggled(rd.cells, rd.colour, at)
  if (next !== undefined) p.set('marks', next)
}

/** The selection tool's four acts, each on its own key. */
const TOOL = [
  {label: 'Highlight', key: 'marks', does: 'Marks the passage in the chosen colour.'},
  {label: 'Note', key: 'note', does: 'Opens a note anchored to the passage.'},
  {label: 'To packet', key: 'toPacket', does: 'Adds the passage to the packet.'},
  {label: 'Answer this', key: 'answer', does: 'Sends the packet to the agent and asks about the passage.'},
] as const
/** Why tool act `i` cannot act now. */
const toolWhy = (p: ViewProps, rd: Read, at: Passage | undefined, i: number) => (i === 0 ? markWhy(p, rd, at) : st(p, TOOL[i]!.key).disabled)
const said = (does: string, why?: string) => (why ? `${does} ${why}` : does)

// ---------------------------------------------------------------- the display: the page as words

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}
const PAPER = {bg: 'var(--paper)', ink: 'var(--ink)', mid: 'var(--pmid)', faint: 'var(--pfaint)'}

interface Spot {readonly e: number; readonly k: number; readonly x: number; readonly y: number; readonly w: number}
/** Lay the words out: each word is a bar as long as its letters, wrapped at the sheet's edge. Words below the sheet are left out. */
function lay(entries: readonly Entry[], box: Box, charW: number, pitch: number) {
  const spots: Spot[] = [], heads: {e: number; y: number}[] = []
  const left = box.x + 15, right = box.x + box.w - 7, bottom = box.y + box.h - 2
  let y = box.y + 7 + pitch / 2, lines = 0
  entries.forEach((en, e) => {
    let x = left
    if (y <= bottom) heads.push({e, y})
    lines++
    en.words.forEach((word, k) => {
      const w = Math.max(3, word.length * charW)
      if (x + w > right && x > left) { x = left; y += pitch; lines++ }
      if (y <= bottom) spots.push({e, k, x, y, w})
      x += w + charW * 1.5
    })
    y += pitch + 5
  })
  return {spots, heads, lines}
}

/** The line with a stop for each choice, and a handle on the one that is set (none when the owner reports none). The arrow keys step to
 * the next stop. Without `go` the line is only read. */
function Stops({xs, y, at, n, label, does, go, reset}: {xs: readonly number[]; y: number; at: number | undefined; n: number; label: string; does: string; go?: (i: number) => void; reset?: () => void}) {
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={xs[0]! - 10} x2={xs[xs.length - 1]! + 10} y1={y} y2={y} className="dp-faint" />
    {xs.map((cx, i) => <circle key={i} cx={cx} cy={y} r={2} className="dp-faint" />)}
    {at !== undefined && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d && go) { e.preventDefault(); e.stopPropagation(); go(Math.min(xs.length - 1, Math.max(0, at + d))) }
    }}>
      <Handle x={xs[at]!} y={y} n={n} shape="square" label={label} does={does} onDrag={go ? px => go(near(px)) : undefined} onReset={go ? reset : undefined} />
    </g>}
  </g>
}

function Picture({p, w, h, whole}: {p: ViewProps; w: number; h: number; whole?: boolean}) {
  const v = p.v, set = p.set, rd = readOf(v), {entries, cells, runs, colour} = rd
  const colourSt = st(p, 'colour'), showSt = st(p, 'show'), selSt = st(p, 'sel')
  const pen = boolOf(v, 'pen') === true, toolNow = boolOf(v, 'tool'), tool = toolNow === true
  const show = strOf(v, 'show'), only = show === 'marks' && !!cells
  const showAt = show === 'all' ? 0 : show === 'marks' ? 1 : undefined
  const xs = COLOURS.map((_, i) => 8 + (w - 16) * (i + .5) / COLOURS.length)
  const at = colour ? COLOURS.findIndex(c => c.value === colour.value) : undefined
  const chooseColour = colourSt.disabled ? undefined : (c: ColourId) => set('colour', c)

  // The sheet: the page's words, or the name of the reading that is missing.
  const sheet: Box = {x: 6, y: 42, w: w - 12, h: h - 42 - (whole ? 34 : 6) - (entries && !cells ? 10 : 0)}
  const charW = whole ? 1.9 : 1.6
  const list = entries ?? []
  const probe = lay(list, sheet, charW, 10)
  const pitch = Math.min(10, Math.max(7, (sheet.h - 12) / (probe.lines + 1)))
  const {spots, heads} = lay(list, sheet, charW, pitch)

  // The backdrop of each highlight on each line it crosses.
  const backs: {key: string; x: number; y: number; w: number; css: string}[] = []
  for (const r of runs ?? []) {
    const lines = new Map<number, Spot[]>()
    spots.filter(s => s.e === r.e && s.k >= r.a && s.k < r.b).forEach(s => lines.set(s.y, [...(lines.get(s.y) ?? []), s]))
    lines.forEach((row, y) => {
      const x0 = Math.min(...row.map(s => s.x)) - 1.6, x1 = Math.max(...row.map(s => s.x + s.w)) + 1.6
      backs.push({key: `${r.e}:${r.a}:${y}`, x: x0, y: y - pitch * .42, w: x1 - x0, css: byChar(r.ch)?.css ?? PAPER.faint})
    })
  }

  // The passage the document holds selected, when it reports one.
  const held = heldPassage(v, entries)
  const inPassage = held ? spots.filter(s => s.e === held.e && s.k >= held.a && s.k < held.b) : []
  const shownPassage = held && inPassage.length > 0 ? held : undefined
  const px0 = Math.min(...inPassage.map(s => s.x)) - 1.6, px1 = Math.max(...inPassage.map(s => s.x + s.w)) + 1.6
  const py = inPassage[0]?.y ?? 0, lastY = inPassage[inPassage.length - 1]?.y ?? 0
  const picked = !!shownPassage && boolOf(v, 'sel') === true
  const isMarked = !!cells && !!shownPassage && marked(cells, shownPassage)
  const press = () => {
    if (!shownPassage) return
    if (pen) toggleMarks(p, rd, shownPassage)
    else if (!selSt.disabled) set('sel', true)
  }

  // The selection tool stands above the selected passage, centred on it and kept inside the sheet.
  const wordy = w > 160, cellW = (t: string) => (wordy ? t.length * 3.3 + 9 : 15)
  const barW = TOOL.reduce((n, t) => n + cellW(t.label), 0) + 6
  const barX = Math.min(sheet.x + sheet.w - barW - 1, Math.max(sheet.x + 1, (px0 + px1) / 2 - barW / 2)), barY = py - pitch * .42 - 17
  const act = (i: number) => {
    if (toolWhy(p, rd, shownPassage, i) || !shownPassage) return
    if (i === 0) toggleMarks(p, rd, shownPassage)
    else set(TOOL[i]!.key, true)
    if (!selSt.disabled) set('sel', false)
  }
  let cx = barX + 3
  const markFill = colour?.css ?? PAPER.faint

  return <g>
    <text x={6} y={12} className="dp-axis">Colour</text>
    {COLOURS.map((c, i) => <g key={c.value} onClick={chooseColour && (() => chooseColour(c.value))} style={{cursor: chooseColour ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - 11} y={15} width={22} height={9} fill="transparent" />
      <rect x={xs[i]! - 10} y={17} width={20} height={6} fill={c.css} opacity={i === at ? 1 : .42} />
    </g>)}
    <Stops xs={xs} y={32} at={at} n={1} label="Colour" does={said('Drag along the line to choose Yellow, Green, Blue or Pink.', colourSt.disabled)}
      go={chooseColour && (i => chooseColour(COLOURS[i]!.value))} reset={() => set('colour', 'yellow')} />

    <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill={PAPER.bg} />
    {!entries && <text x={sheet.x + sheet.w / 2} y={sheet.y + sheet.h / 2 + 2} textAnchor="middle" fill={PAPER.mid} style={{font: '7px var(--font-ui)'}}>{NO_ENTRIES}</text>}
    {entries && !cells && <text x={sheet.x} y={sheet.y + sheet.h + 8} className="dp-axis" style={{fontSize: 6.5}}>{NO_MARKS}</text>}
    {heads.map(hd => <text key={hd.e} x={sheet.x + 4} y={hd.y + 2.4} fill={PAPER.faint} style={{font: '6.5px var(--font-ui)'}}>{entries?.[hd.e]?.n || NONE}</text>)}
    {backs.map(b => <rect key={b.key} x={b.x} y={b.y} width={b.w} height={pitch * .84} fill={b.css} />)}
    {picked && !pen && <rect x={px0} y={py - pitch * .42} width={px1 - px0} height={pitch * .84 + (lastY - py)} fill="var(--sel)" fillOpacity={.4} stroke="var(--sel)" strokeWidth={.6} />}
    {spots.map(s => <rect key={`${s.e}:${s.k}`} x={s.x} y={s.y - 1.3} width={s.w} height={2.6} fill={PAPER.ink} opacity={only && (cells?.[s.e]?.[s.k] ?? '.') === '.' ? .13 : .55} />)}
    {shownPassage && <rect x={px0} y={py - pitch * .42} width={px1 - px0} height={pitch * .84} fill="transparent"
      data-i={said(pen ? 'Passage|With Pen on, a drag marks a passage at once. Press to mark or unmark it.' : 'Passage|Press to select the passage. The selection tool stands above it.',
        pen ? markWhy(p, rd, shownPassage) : selSt.disabled)} onClick={press} style={{cursor: 'pointer'}} />}
    {shownPassage && pen && <path d={`M${px1 + 1} ${py - 1}l3.2-6.4 3 1.5-3.2 6.4z M${px1 + 1} ${py - 1}l-.4 2.8 2.4-1.3z`} fill={PAPER.ink} />}

    {picked && !pen && tool && <g>
      <rect x={barX} y={barY} width={barW} height={13} rx={2} fill={PAPER.ink} />
      {TOOL.map((t, i) => {
        const x = cx, cw = cellW(t.label), why = toolWhy(p, rd, shownPassage, i)
        cx += cw
        return <g key={t.label} onClick={why ? undefined : () => act(i)} style={{cursor: why ? 'default' : 'pointer'}} opacity={why ? .4 : 1} data-i={`${t.label}|${said(t.does, why)}`}>
          <rect x={x} y={barY + 1.5} width={cw} height={10} fill="transparent" />
          {wordy
            ? <text x={x + cw / 2} y={barY + 8.6} textAnchor="middle" fill="#fff" style={{font: '6.3px var(--font-ui)'}}>{t.label}</text>
            : i === 0 ? <rect x={x + cw / 2 - 3} y={barY + 3.5} width={6} height={6} fill={markFill} />
            : i === 1 ? <rect x={x + cw / 2 - 2.5} y={barY + 4} width={5} height={5} fill="none" stroke="#fff" strokeWidth={1} />
            : <text x={x + cw / 2} y={barY + 9} textAnchor="middle" fill="#fff" style={{font: '700 7px var(--font-ui)'}}>{i === 2 ? '+' : '?'}</text>}
          {wordy && i === 0 && <rect x={x + 3} y={barY + 10.4} width={cw - 6} height={1} fill={markFill} />}
        </g>
      })}
      <path d={`M${(barX + barW / 2) - 3} ${barY + 13}l3 3 3-3z`} fill={PAPER.ink} />
    </g>}
    {!isMarked && picked && !pen && toolNow === false && <text x={px0} y={py + pitch * .42 + 7} className="dp-axis" style={{fontSize: 6.5}}>tool off</text>}

    {whole && <g>
      <text x={8} y={h - 22} className="dp-axis">Show</text>
      <text x={w * .3} y={h - 22} textAnchor="middle" className={showAt === 0 ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8}}>All</text>
      <text x={w * .72} y={h - 22} textAnchor="middle" className={showAt === 1 ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8}}>Highlights</text>
      <Stops xs={[w * .3, w * .72]} y={h - 11} at={showAt} n={2} label="Show" does={said('Drag along the line to show every word, or only the highlights.', showSt.disabled)}
        go={showSt.disabled ? undefined : i => set('show', SHOWS[i]!.value)} reset={() => set('show', 'all')} />
    </g>}
  </g>
}

// ---------------------------------------------------------------- the pane: the open document as a page

type Pick = Passage & {readonly x: number; readonly y: number}

function Paper({p}: {p: ViewProps}) {
  const v = p.v, sheet = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Pick | null>(null)
  const rd = readOf(v), {entries, cells, colour} = rd
  const pen = boolOf(v, 'pen') === true

  /** The words that the selection runs over, in one entry, and where its first line stands in the sheet. */
  const read = (): Pick | null => {
    const s = window.getSelection(), root = sheet.current
    if (!s || !root || s.isCollapsed || !s.rangeCount) return null
    const r = s.getRangeAt(0)
    const token = (n: Node, dir: 1 | -1) => {
      const own = (n.nodeType === 1 ? n as Element : n.parentElement)?.closest<HTMLElement>('[data-t]')
      if (own) return own
      let at: Node | null = dir > 0 ? n.nextSibling : n.previousSibling
      while (at && !(at.nodeType === 1 && (at as HTMLElement).dataset.t !== undefined)) at = dir > 0 ? at.nextSibling : at.previousSibling
      return at as HTMLElement | null
    }
    const first = token(r.startContainer, 1), last = token(r.endContainer, -1)
    if (!first || !last || !root.contains(first) || !root.contains(last) || first.dataset.e !== last.dataset.e) return null
    const a = Math.min(Number(first.dataset.t), Number(last.dataset.t)) >> 1, b = (Math.max(Number(first.dataset.t), Number(last.dataset.t)) >> 1) + 1
    const box = r.getClientRects()[0] ?? r.getBoundingClientRect(), host = root.getBoundingClientRect()
    return {e: Number(first.dataset.e), a, b, x: box.left + box.width / 2 - host.left, y: box.top - host.top}
  }
  useEffect(() => {
    const gone = () => { if (!window.getSelection() || window.getSelection()!.isCollapsed) setTool(null) }
    document.addEventListener('selectionchange', gone)
    return () => document.removeEventListener('selectionchange', gone)
  }, [])

  const done = () => { window.getSelection()?.removeAllRanges(); setTool(null) }
  const up = () => {
    const pk = read()
    if (!pk) { setTool(null); return }
    if (pen) { toggleMarks(p, rd, pk); done() } else setTool(boolOf(v, 'tool') === true ? pk : null)
  }

  return <div className="hl-pane">
    <div className="hl-sheet" ref={sheet} data-show={cells ? strOf(v, 'show') : undefined} data-pen={pen ? 'true' : undefined} onMouseUp={up} style={SWATCHES}>
      <h3>{shown(v, 'flowTitle')}</h3>
      {!entries && <p className="hl-none">{NO_ENTRIES}</p>}
      {entries && !cells && <p className="hl-none">{NO_MARKS}</p>}
      {entries?.map((entry, e) => <section key={e} className="hl-entry">
        <small>{entry.n || NONE} ({entry.by || NONE})</small>
        <p>{entry.words.flatMap((word, k) => {
          const ch = cells?.[e]?.[k] ?? '.', next = cells?.[e]?.[k + 1], css = byChar(ch)?.css
          const style = css ? {'--c': css} as CSSProperties : undefined
          const joined = css && next === ch
          const out = [<span key={`w${k}`} className="hl-t" data-e={e} data-t={2 * k} data-c={css ? ch : undefined} style={style}>{word}</span>]
          if (k < entry.words.length - 1) out.push(<span key={`s${k}`} className="hl-t hl-sp" data-e={e} data-t={2 * k + 1} data-c={joined ? ch : undefined} style={joined ? style : undefined}>{' '}</span>)
          return out
        })}</p>
      </section>)}
      {tool && <div className="hl-tool" style={{left: tool.x, top: tool.y, ['--c' as string]: colour?.css ?? PAPER.faint} as CSSProperties} onMouseDown={e => e.preventDefault()}>
        {TOOL.map((t, i) => {
          const why = toolWhy(p, rd, tool, i)
          return <span key={t.label} data-i={`${t.label}|${said(t.does, why)}`}>
            <button type="button" data-act={i === 0 ? 'highlight' : undefined} disabled={!!why}
              onClick={() => { if (i === 0) toggleMarks(p, rd, tool); else p.set(t.key, true); done() }}>{t.label}</button>
          </span>
        })}
      </div>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>

function ColourRadio({p}: {p: ViewProps}) {
  return <div className="hl-colour" style={SWATCHES}>
    <Radio label="Colour" does="The colour of the next highlight: Yellow, Green, Blue or Pink." value={colourOf(p.v)?.value ?? ''} options={COLOURS} stack
      onChange={x => p.set('colour', x)} {...st(p, 'colour')} />
  </div>
}
function ShowRadio({p, stack}: {p: ViewProps; stack?: boolean}) {
  return <Radio label="Show" does="All words, or only the highlights. The other words fade." value={strOf(p.v, 'show') ?? ''} options={SHOWS} stack={stack}
    onChange={x => p.set('show', x)} {...st(p, 'show')} />
}
function PenToggle({p}: {p: ViewProps}) {
  const now = boolOf(p.v, 'pen')
  return <Toggle label="Pen" does="A drag over text makes a highlight at once. The Draw control turns it on too." on={now === true} unknown={now === undefined}
    onChange={x => p.set('pen', x)} {...st(p, 'pen')} />
}
function ToolToggle({p}: {p: ViewProps}) {
  const now = boolOf(p.v, 'tool')
  return <Toggle label="Selection tool" does="Show the actions above a selected passage." on={now === true} unknown={now === undefined}
    onChange={x => p.set('tool', x)} {...st(p, 'tool')} />
}

/** The highlights as rows: the colour, the words, the entry that holds them. */
function rowsOf(rd: Read): RowItem[] {
  if (!rd.runs) return [{id: 'none', name: NO_MARKS, light: 'unknown'}]
  if (!rd.runs.length) return [{id: 'none', name: 'No highlights', light: 'unknown'}]
  return rd.runs.map(r => ({
    id: `${r.e}:${r.a}`, name: wordsOf(rd, r), light: 'lit' as const, note: anchorOf(rd.entries?.[r.e]), does: `Marked in ${placeOf(rd.entries?.[r.e])}.`,
    mark: <span className="hl-dot" style={{'--c': byChar(r.ch)?.css} as CSSProperties} />,
  }))
}

export const design: DesignedDevice = {
  id: 'central:highlight',
  title: 'Highlight',
  kind: 'effect',
  defaults: {
    light: 'lit', colour: 'yellow', show: 'all', pen: false, tool: true,
    // Readings of the page: the document, the highlights it holds, and the passage that is selected.
    // The sample page: Control/user/flows/flow-2026-10-03-1432, entries 3 and 8; the passage held is "retain its coordinator." in entry 8.
    flow: 'flow-2026-10-03-1432', flowTitle: 'Factory original development Run — execution and continuation',
    entries: JSON.stringify([
      {n: 3, by: 'C', text: 'The original development Run remains incomplete. Its last native reading at 16:30 UTC retained seven required units and no worker attempts or completed legs.'},
      {n: 8, by: 'C', text: 'The first worker can retain its coordinator. The installed Factory owner was reread at 21:52 UTC: zero attempts and zero completed required units out of seven.'},
    ]),
    marks: '.............yyyyyyyy...|................yyyyyyy...', sel: true, passage: JSON.stringify({e: 1, a: 4, b: 7}),
  },
  fixtures: {
    Marked: {},
    'Two readings': {colour: 'pink', marks: '.............gggggggg...|................ppppppp...'},
    Unmarked: {marks: '........................|..........................'},
    'No readings': Object.fromEntries(['light', 'colour', 'show', 'pen', 'tool', 'flow', 'flowTitle', 'entries', 'marks', 'sel', 'passage'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Highlight" light={light(p)} readings={[colourOf(p.v)?.label ?? NONE, countWords(readOf(p.v).runs?.length)]} onUnfold={p.nav.unfold} />,

  compact: p => {
    const count = readOf(p.v).runs?.length
    return <Panel title="Highlight" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The page" does="The page as words. Each highlight stands behind its words. Drag handle 1 to choose the colour." corner={countWords(count)}>
          <Picture p={p} w={140} h={146} />
        </Display>
      </Section>
      <Section label="Macros" cols={2} width={128}>
        <ColourRadio p={p} />
        <ShowRadio p={p} stack />
        {span(2, <PenToggle p={p} />)}
        {span(2, <ToolToggle p={p} />)}
      </Section>
    </Panel>
  },

  whole: p => {
    const rd = readOf(p.v), count = rd.runs?.length
    return <Panel title="Highlight" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The page" does="The page as words. Each highlight stands behind its words. Drag handle 1 to choose the colour and handle 2 to choose what shows."
            corner={countWords(count)}>
            <Picture p={p} w={194} h={146} whole />
          </Display>
        </Section>
        <Section label="Colour" width={68}>
          <ColourRadio p={p} />
        </Section>
        <Section label="View" cols={2} grow>
          {span(2, <ShowRadio p={p} />)}
          {span(2, <ToolToggle p={p} />)}
        </Section>
      </Band>
      <Band>
        <Section label="Pen" cols={1}>
          <PenToggle p={p} />
        </Section>
        <Section label="Highlights" grow>
          <Rows items={rowsOf(rd)} size={4} does="The highlights in the document: the colour, the words and the entry that holds them." />
        </Section>
        <Section width={72}>
          <Readout big label="highlights" does="Highlights in the document." value={count} tone="value" />
          <Readout label="colours" does="Colours that the highlights use." value={colourCount(rd)} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{has(p.v, 'flow') ? `Flow · ${strOf(p.v, 'flow')}` : NONE}</button>
    </div>
    <Paper p={p} />
  </div>,

  widget: p => {
    const rd = readOf(p.v), runs = rd.runs
    return <Tile title={`Highlights · ${runs ? runs.length : NONE}`} light={light(p)} span={2} onFull={p.nav.full}>
      <div className="hl-wid" style={SWATCHES}>
        {runs?.length
          ? <ul className="hl-lines" aria-label="Highlights in the open document">
            {runs.slice(0, 5).map(r => <li key={`${r.e}:${r.a}`}>
              <button type="button" onClick={p.nav.full} data-i={`${wordsOf(rd, r)}|Go to this passage in ${placeOf(rd.entries?.[r.e])}.`}>
                <span className="hl-dot" style={{'--c': byChar(r.ch)?.css} as CSSProperties} /><span>{wordsOf(rd, r)}</span><small>{anchorOf(rd.entries?.[r.e])}</small>
              </button>
            </li>)}
          </ul>
          : <div className="hl-lines"><div className="hl-lines-empty">{runs ? 'No highlights' : NO_MARKS}</div></div>}
        <div className="hl-side">
          <Readout big label="highlights" does="Highlights in the document." value={runs?.length} tone="value" onPress={p.nav.full} />
          <Chooser label="Colour" does="The colour of the next highlight." value={colourOf(p.v)?.value ?? ''} options={COLOURS} onChange={x => p.set('colour', x)} {...st(p, 'colour')} />
          <PenToggle p={p} />
        </div>
      </div>
    </Tile>
  },
}
