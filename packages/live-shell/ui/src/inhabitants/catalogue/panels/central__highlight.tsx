// The Highlight (manual §18.7): an effect on a Central document's chain, after Text. Live's nearest: Utility — a small effect with a few
// states and one picture. It marks a passage and leaves the passage whole: a highlight is a <mark> span round the words, and the words
// stay as they were (desktop/cradle/documents/ql-flow.html:1074 act('hl') wraps the selection; ql-daily-die.html:649 does the same in a
// Day field). The selection tool is the template's own bar (ql-flow.html:1063): Highlight, Note, To packet, Answer this; a Day's bar has
// the first three (ql-daily-die.html:643). The document reads its highlights back as passages with the entry that holds each
// (central/documentPayload.ts markedPassages :99, entryPlace :117 — "C3"). The readings are the Factory flow in Control/user/flows
// (flow-2026-10-03-1432.html, entries 3 and 8); the page marks only the passages it shows. The templates keep one marker colour, yellow
// (--hl, #FFE97A); Colour, Show, Pen and the tool's Off switch are the operations that the templates take on (manual §18.7).
import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react'
import {Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {on, str, type DesignedDevice, type ViewProps} from './design'
import './central__highlight.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type ColourId = 'yellow' | 'green' | 'blue' | 'pink'

/** The four marker colours. Yellow is the template's own mark; the others are the same pale value in other hues. */
const COLOURS: readonly {readonly value: ColourId; readonly label: string; readonly ch: string; readonly css: string; readonly does: string}[] = [
  {value: 'yellow', label: 'Yellow', ch: 'y', css: '#FFE97A', does: 'The next highlight is yellow, the template\'s own mark.'},
  {value: 'green', label: 'Green', ch: 'g', css: '#B5EBA3', does: 'The next highlight is green.'},
  {value: 'blue', label: 'Blue', ch: 'b', css: '#A6D8FF', does: 'The next highlight is blue.'},
  {value: 'pink', label: 'Pink', ch: 'p', css: '#FFB8D6', does: 'The next highlight is pink.'},
]
const SWATCHES = {'--hl-yellow': COLOURS[0]!.css, '--hl-green': COLOURS[1]!.css, '--hl-blue': COLOURS[2]!.css, '--hl-pink': COLOURS[3]!.css} as CSSProperties
const SHOWS = [
  {value: 'all', label: 'All', does: 'Every word shows.'},
  {value: 'marks', label: 'Highlights', does: 'Only the highlights show. The other words fade.'},
] as const
const colourOf = (v: V) => COLOURS.find(c => c.value === str(v, 'colour')) ?? COLOURS[0]!
const byChar = (ch: string) => COLOURS.find(c => c.ch === ch)

/** The page that the Highlight holds: two entries of the Factory flow (flow-2026-10-03-1432), each a run of words. */
const PAGE = [
  {n: 3, by: 'C', text: 'The original development Run remains incomplete. Its last native reading at 16:30 UTC retained seven required units and no worker attempts or completed legs.'},
  {n: 8, by: 'C', text: 'The first worker can retain its coordinator. The installed Factory owner was reread at 21:52 UTC: zero attempts and zero completed required units out of seven.'},
] as const
const WORDS: readonly (readonly string[])[] = PAGE.map(p => p.text.split(' '))
/** The passage that the picture holds selected: "retain its coordinator." in entry 8. */
const PASSAGE = {e: 1, a: 4, b: 7} as const
const FLOW_TAB = 'Flow · flow-2026-10-03-1432'
const FLOW_TITLE = 'Factory original development Run — execution and continuation'

// ---------------------------------------------------------------- the marks: one letter for each word ("." none)

type Mark = readonly [entry: number, from: number, to: number, colour: ColourId]
/** The marks as the value keeps them: for each entry, one character for each word — a colour's letter, or "." — joined by "|". */
function pack(marks: readonly Mark[]): string {
  return PAGE.map((_, e) => {
    const cells = WORDS[e]!.map(() => '.')
    for (const [at, from, to, colour] of marks) if (at === e) for (let k = from; k < to; k++) cells[k] = COLOURS.find(c => c.value === colour)!.ch
    return cells.join('')
  }).join('|')
}
const grid = (v: V): string[][] => {
  const rows = str(v, 'marks').split('|')
  return PAGE.map((_, e) => WORDS[e]!.map((_w, k) => rows[e]?.[k] ?? '.'))
}

interface Run {readonly e: number; readonly a: number; readonly b: number; readonly ch: string}
/** The highlights: each unbroken run of one colour is one passage. */
function runsOf(v: V): Run[] {
  const out: Run[] = []
  grid(v).forEach((cells, e) => {
    let k = 0
    while (k < cells.length) {
      const ch = cells[k]!
      if (ch === '.') { k++; continue }
      let j = k
      while (j < cells.length && cells[j] === ch) j++
      out.push({e, a: k, b: j, ch})
      k = j
    }
  })
  return out
}
const passageOf = (r: Run) => WORDS[r.e]!.slice(r.a, r.b).join(' ')
const anchorOf = (r: Run) => `${PAGE[r.e]!.by}${PAGE[r.e]!.n}`
const countOf = (v: V) => runsOf(v).length
const colourCount = (v: V) => new Set(runsOf(v).map(r => r.ch)).size

/** Choose Highlight on a passage: every word already marked → the marks come off; otherwise the chosen colour goes on. */
function toggled(v: V, e: number, a: number, b: number): string {
  const cells = grid(v), row = cells[e]!, all = row.slice(a, b).every(c => c !== '.'), ch = colourOf(v).ch
  for (let k = a; k < b; k++) row[k] = all ? '.' : ch
  return cells.map(r => r.join('')).join('|')
}
const marked = (v: V, e: number, a: number, b: number) => grid(v)[e]!.slice(a, b).every(c => c !== '.')

const countWords = (n: number) => (n === 0 ? 'none' : `${n} highlight${n === 1 ? '' : 's'}`)

// ---------------------------------------------------------------- the display: the page as words

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}
const PAPER = {bg: '#EFEFED', ink: '#1a1a18', mid: '#6E6E6A', faint: '#A3A39E'}
const TOOL = [
  {label: 'Highlight', does: 'Marks the passage in the chosen colour.'},
  {label: 'Note', does: 'Opens a note anchored to the passage.'},
  {label: 'To packet', does: 'Adds the passage to the packet.'},
  {label: 'Answer this', does: 'Sends the packet to the agent and asks about the passage.'},
] as const

interface Spot {readonly e: number; readonly k: number; readonly x: number; readonly y: number; readonly w: number}
/** Lay the words out: each word is a bar as long as its letters, wrapped at the sheet's edge. */
function lay(box: Box, charW: number, pitch: number) {
  const spots: Spot[] = [], heads: {e: number; y: number}[] = []
  const left = box.x + 15, right = box.x + box.w - 7
  let y = box.y + 7 + pitch / 2, lines = 0
  PAGE.forEach((_, e) => {
    let x = left
    heads.push({e, y})
    lines++
    WORDS[e]!.forEach((word, k) => {
      const w = Math.max(3, word.length * charW)
      if (x + w > right && x > left) { x = left; y += pitch; lines++ }
      spots.push({e, k, x, y, w})
      x += w + charW * 1.5
    })
    y += pitch + 5
  })
  return {spots, heads, lines}
}

/** The line with a stop for each choice, and a handle on the one that is set. The arrow keys step to the next stop. */
function Stops({xs, y, at, n, label, does, go, reset}: {xs: readonly number[]; y: number; at: number; n: number; label: string; does: string; go: (i: number) => void; reset: () => void}) {
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={xs[0]! - 10} x2={xs[xs.length - 1]! + 10} y1={y} y2={y} className="dp-faint" />
    {xs.map((cx, i) => <circle key={i} cx={cx} cy={y} r={2} className="dp-faint" />)}
    <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(Math.min(xs.length - 1, Math.max(0, at + d))) }
    }}>
      <Handle x={xs[at]!} y={y} n={n} shape="square" label={label} does={does} onDrag={px => go(near(px))} onReset={reset} />
    </g>
  </g>
}

function Picture({v, set, w, h, whole}: {v: V; set: SetFn; w: number; h: number; whole?: boolean}) {
  const colour = colourOf(v), pen = on(v, 'pen'), tool = on(v, 'tool'), only = str(v, 'show') === 'marks', picked = v.sel !== false
  const sheet: Box = {x: 6, y: 42, w: w - 12, h: h - 42 - (whole ? 34 : 6)}
  const charW = whole ? 1.9 : 1.6
  const probe = lay(sheet, charW, 10)
  const pitch = Math.min(10, Math.max(7, (sheet.h - 12) / (probe.lines + 1)))
  const {spots, heads} = lay(sheet, charW, pitch)
  const cells = grid(v)
  const xs = COLOURS.map((_, i) => 8 + (w - 16) * (i + .5) / COLOURS.length)
  const at = Math.max(0, COLOURS.findIndex(c => c.value === colour.value))

  // The backdrop of each highlight on each line it crosses.
  const backs: {key: string; x: number; y: number; w: number; css: string}[] = []
  for (const r of runsOf(v)) {
    const lines = new Map<number, Spot[]>()
    spots.filter(s => s.e === r.e && s.k >= r.a && s.k < r.b).forEach(s => lines.set(s.y, [...(lines.get(s.y) ?? []), s]))
    lines.forEach((row, y) => {
      const x0 = Math.min(...row.map(s => s.x)) - 1.6, x1 = Math.max(...row.map(s => s.x + s.w)) + 1.6
      backs.push({key: `${r.e}:${r.a}:${y}`, x: x0, y: y - pitch * .42, w: x1 - x0, css: byChar(r.ch)?.css ?? colour.css})
    })
  }
  const inPassage = spots.filter(s => s.e === PASSAGE.e && s.k >= PASSAGE.a && s.k < PASSAGE.b)
  const px0 = Math.min(...inPassage.map(s => s.x)) - 1.6, px1 = Math.max(...inPassage.map(s => s.x + s.w)) + 1.6
  const py = inPassage[0]!.y, lastY = inPassage[inPassage.length - 1]!.y
  const isMarked = marked(v, PASSAGE.e, PASSAGE.a, PASSAGE.b)
  const press = () => {
    if (pen) set('marks', toggled(v, PASSAGE.e, PASSAGE.a, PASSAGE.b))
    else set('sel', true)
  }

  // The selection tool stands above the selected passage, centred on it and kept inside the sheet.
  const wordy = w > 160, cellW = (t: string) => (wordy ? t.length * 3.3 + 9 : 15)
  const barW = TOOL.reduce((n, t) => n + cellW(t.label), 0) + 6
  const barX = Math.min(sheet.x + sheet.w - barW - 1, Math.max(sheet.x + 1, (px0 + px1) / 2 - barW / 2)), barY = py - pitch * .42 - 17
  const act = (i: number) => {
    if (i === 0) set('marks', toggled(v, PASSAGE.e, PASSAGE.a, PASSAGE.b))
    set('sel', false)
  }
  let cx = barX + 3

  return <g>
    <text x={6} y={12} className="dp-axis">Colour</text>
    {COLOURS.map((c, i) => <g key={c.value} onClick={() => set('colour', c.value)} style={{cursor: 'pointer'}}>
      <rect x={xs[i]! - 11} y={15} width={22} height={9} fill="transparent" />
      <rect x={xs[i]! - 10} y={17} width={20} height={6} fill={c.css} opacity={i === at ? 1 : .42} />
    </g>)}
    <Stops xs={xs} y={32} at={at} n={1} label="Colour" does="Drag along the line to choose Yellow, Green, Blue or Pink." go={i => set('colour', COLOURS[i]!.value)} reset={() => set('colour', 'yellow')} />

    <rect x={sheet.x} y={sheet.y} width={sheet.w} height={sheet.h} fill={PAPER.bg} />
    {heads.map(hd => <text key={hd.e} x={sheet.x + 4} y={hd.y + 2.4} fill={PAPER.faint} style={{font: '6.5px var(--font-ui)'}}>{PAGE[hd.e]!.n}</text>)}
    {backs.map(b => <rect key={b.key} x={b.x} y={b.y} width={b.w} height={pitch * .84} fill={b.css} />)}
    {picked && !pen && inPassage.length > 0 && <rect x={px0} y={py - pitch * .42} width={px1 - px0} height={pitch * .84 + (lastY - py)} fill="var(--sel)" fillOpacity={.4} stroke="var(--sel)" strokeWidth={.6} />}
    {spots.map(s => <rect key={`${s.e}:${s.k}`} x={s.x} y={s.y - 1.3} width={s.w} height={2.6} fill={PAPER.ink} opacity={only && (cells[s.e]![s.k] ?? '.') === '.' ? .13 : .55} />)}
    <rect x={px0} y={py - pitch * .42} width={px1 - px0} height={pitch * .84} fill="transparent" data-i={pen ? 'Passage|With Pen on, a drag marks a passage at once. Press to mark or unmark it.' : 'Passage|Press to select the passage. The selection tool stands above it.'} onClick={press} style={{cursor: 'pointer'}} />
    {pen && <path d={`M${px1 + 1} ${py - 1}l3.2-6.4 3 1.5-3.2 6.4z M${px1 + 1} ${py - 1}l-.4 2.8 2.4-1.3z`} fill={PAPER.ink} />}

    {picked && !pen && tool && <g>
      <rect x={barX} y={barY} width={barW} height={13} rx={2} fill={PAPER.ink} />
      {TOOL.map((t, i) => {
        const x = cx, cw = cellW(t.label)
        cx += cw
        return <g key={t.label} onClick={() => act(i)} style={{cursor: 'pointer'}} data-i={`${t.label}|${t.does}`}>
          <rect x={x} y={barY + 1.5} width={cw} height={10} fill="transparent" />
          {wordy
            ? <text x={x + cw / 2} y={barY + 8.6} textAnchor="middle" fill="#fff" style={{font: '6.3px var(--font-ui)'}}>{t.label}</text>
            : i === 0 ? <rect x={x + cw / 2 - 3} y={barY + 3.5} width={6} height={6} fill={colour.css} />
            : i === 1 ? <rect x={x + cw / 2 - 2.5} y={barY + 4} width={5} height={5} fill="none" stroke="#fff" strokeWidth={1} />
            : <text x={x + cw / 2} y={barY + 9} textAnchor="middle" fill="#fff" style={{font: '700 7px var(--font-ui)'}}>{i === 2 ? '+' : '?'}</text>}
          {wordy && i === 0 && <rect x={x + 3} y={barY + 10.4} width={cw - 6} height={1} fill={colour.css} />}
        </g>
      })}
      <path d={`M${(barX + barW / 2) - 3} ${barY + 13}l3 3 3-3z`} fill={PAPER.ink} />
    </g>}
    {!isMarked && picked && !pen && !tool && <text x={px0} y={py + pitch * .42 + 7} className="dp-axis" style={{fontSize: 6.5}}>tool off</text>}

    {whole && <g>
      <text x={8} y={h - 22} className="dp-axis">Show</text>
      <text x={w * .3} y={h - 22} textAnchor="middle" className={!only ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8}}>All</text>
      <text x={w * .72} y={h - 22} textAnchor="middle" className={only ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8}}>Highlights</text>
      <Stops xs={[w * .3, w * .72]} y={h - 11} at={only ? 1 : 0} n={2} label="Show" does="Drag along the line to show every word, or only the highlights." go={i => set('show', SHOWS[i]!.value)} reset={() => set('show', 'all')} />
    </g>}
  </g>
}

// ---------------------------------------------------------------- the pane: the open document as a page

type Pick = {readonly e: number; readonly a: number; readonly b: number; readonly x: number; readonly y: number}

function Paper({v, set}: {v: V; set: SetFn}) {
  const sheet = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Pick | null>(null)
  const colour = colourOf(v), cells = grid(v)

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
  const mark = (p: Pick) => set('marks', toggled(v, p.e, p.a, p.b))
  const up = () => {
    const p = read()
    if (!p) { setTool(null); return }
    if (on(v, 'pen')) { mark(p); done() } else setTool(on(v, 'tool') ? p : null)
  }

  return <div className="hl-pane">
    <div className="hl-sheet" ref={sheet} data-show={str(v, 'show')} data-pen={on(v, 'pen') ? 'true' : undefined} onMouseUp={up} style={SWATCHES}>
      <h3>{FLOW_TITLE}</h3>
      {PAGE.map((entry, e) => <section key={entry.n} className="hl-entry">
        <small>{entry.n} ({entry.by})</small>
        <p>{WORDS[e]!.flatMap((word, k) => {
          const ch = cells[e]![k]!, next = cells[e]![k + 1], css = byChar(ch)?.css
          const style = css ? {'--c': css} as CSSProperties : undefined
          const joined = css && next === ch
          const out = [<span key={`w${k}`} className="hl-t" data-e={e} data-t={2 * k} data-c={css ? ch : undefined} style={style}>{word}</span>]
          if (k < WORDS[e]!.length - 1) out.push(<span key={`s${k}`} className="hl-t hl-sp" data-e={e} data-t={2 * k + 1} data-c={joined ? ch : undefined} style={joined ? style : undefined}>{' '}</span>)
          return out
        })}</p>
      </section>)}
      {tool && <div className="hl-tool" style={{left: tool.x, top: tool.y, ['--c' as string]: colour.css} as CSSProperties} onMouseDown={e => e.preventDefault()}>
        {TOOL.map((t, i) => <button key={t.label} type="button" data-act={i === 0 ? 'highlight' : undefined} data-i={`${t.label}|${t.does}`}
          onClick={() => { if (i === 0) mark(tool); done() }}>{t.label}</button>)}
      </div>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>

function ColourRadio({p}: {p: ViewProps}) {
  return <div className="hl-colour" style={SWATCHES}>
    <Radio label="Colour" does="The colour of the next highlight: Yellow, Green, Blue or Pink." value={colourOf(p.v).value} options={COLOURS} stack onChange={x => p.set('colour', x)} />
  </div>
}
function ShowRadio({p, stack}: {p: ViewProps; stack?: boolean}) {
  return <Radio label="Show" does="All words, or only the highlights. The other words fade." value={str(p.v, 'show') === 'marks' ? 'marks' : 'all'} options={SHOWS} stack={stack} onChange={x => p.set('show', x)} />
}
function PenToggle({p}: {p: ViewProps}) {
  return <Toggle label="Pen" does="A drag over text makes a highlight at once. The Draw control turns it on too." on={on(p.v, 'pen')} onChange={x => p.set('pen', x)} />
}
function ToolToggle({p}: {p: ViewProps}) {
  return <Toggle label="Selection tool" does="Show the actions above a selected passage." on={on(p.v, 'tool')} onChange={x => p.set('tool', x)} />
}

/** The highlights as rows: the colour, the words, the entry that holds them. */
function rowsOf(v: V): RowItem[] {
  const runs = runsOf(v)
  if (!runs.length) return [{id: 'none', name: 'No highlights', light: 'unknown'}]
  return runs.map(r => ({
    id: `${r.e}:${r.a}`, name: passageOf(r), light: 'lit' as const, note: anchorOf(r), does: `Marked in entry ${PAGE[r.e]!.n} (${PAGE[r.e]!.by}).`,
    mark: <span className="hl-dot" style={{'--c': byChar(r.ch)?.css} as CSSProperties} />,
  }))
}

export const design: DesignedDevice = {
  id: 'central:highlight',
  title: 'Highlight',
  kind: 'effect',
  defaults: {
    light: 'lit', colour: 'yellow', show: 'all', pen: false, tool: true,
    // Readings of the page: the highlights it holds, and whether the picture's passage is selected.
    marks: pack([[0, 13, 21, 'yellow'], [1, 16, 23, 'yellow']]), sel: true,
  },
  fixtures: {
    Marked: {},
    'Two readings': {colour: 'pink', marks: pack([[0, 13, 21, 'green'], [1, 16, 23, 'pink']])},
    Unmarked: {marks: pack([])},
  },

  folded: p => <Folded title="Highlight" light={light(p.v)} readings={[colourOf(p.v).label, countWords(countOf(p.v))]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Highlight" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page" does="The page as words. Each highlight stands behind its words. Drag handle 1 to choose the colour." corner={countWords(countOf(p.v))}>
        <Picture v={p.v} set={p.set} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <ColourRadio p={p} />
      <ShowRadio p={p} stack />
      {span(2, <PenToggle p={p} />)}
      {span(2, <ToolToggle p={p} />)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Highlight" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The page" does="The page as words. Each highlight stands behind its words. Drag handle 1 to choose the colour and handle 2 to choose what shows."
          corner={countWords(countOf(p.v))}>
          <Picture v={p.v} set={p.set} w={194} h={146} whole />
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
        <Rows items={rowsOf(p.v)} size={4} does="The highlights in the document: the colour, the words and the entry that holds them." />
      </Section>
      <Section width={72}>
        <Readout big label="highlights" does="Highlights in the document." value={countOf(p.v)} tone="value" />
        <Readout label="colours" does="Colours that the highlights use." value={colourCount(p.v)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{FLOW_TAB}</button>
    </div>
    <Paper v={p.v} set={p.set} />
  </div>,

  widget: p => {
    const runs = runsOf(p.v)
    return <Tile title={`Highlights · ${runs.length}`} light={light(p.v)} span={2} onFull={p.nav.full}>
      <div className="hl-wid" style={SWATCHES}>
        {runs.length
          ? <ul className="hl-lines" aria-label="Highlights in the open document">
            {runs.slice(0, 5).map(r => <li key={`${r.e}:${r.a}`}>
              <button type="button" onClick={p.nav.full} data-i={`${passageOf(r)}|Go to this passage in entry ${PAGE[r.e]!.n} (${PAGE[r.e]!.by}).`}>
                <span className="hl-dot" style={{'--c': byChar(r.ch)?.css} as CSSProperties} /><span>{passageOf(r)}</span><small>{anchorOf(r)}</small>
              </button>
            </li>)}
          </ul>
          : <div className="hl-lines"><div className="hl-lines-empty">No highlights</div></div>}
        <div className="hl-side">
          <Readout big label="highlights" does="Highlights in the document." value={runs.length} tone="value" onPress={p.nav.full} />
          <Chooser label="Colour" does="The colour of the next highlight." value={colourOf(p.v).value} options={COLOURS} onChange={x => p.set('colour', x)} />
          <PenToggle p={p} />
        </div>
      </div>
    </Tile>
  },
}
