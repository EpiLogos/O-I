// Text (manual §18.6): an effect on a document's chain that sets how the words of a page are set — the style of the paragraph, the
// emphasis of the selected words and the size of the type you read in — and leaves every word whole. Live's nearest: Utility, a small
// effect whose meaning is plain at a glance.
// The owner is the page. A Flow keeps each entry as HTML in an editable body: desktop/cradle/documents/ql-flow.html `clean()` (:848)
// keeps tags and drops inline `style`, so a style and an emphasis are tags in the page (`p`, `blockquote`, `h2`, `ul`; `b`, `i`, `s`),
// and a size is never in the page. The body's own rules are `.body p`, `.body blockquote` (:89, :97) and its type is 17 px, or 20 px
// on a Flow or Journal page (:85, :126, :143): 20 px is 15 pt, the default. The selection reading is `currentSel()` (:1064) and the
// write it would use is the one Highlight already makes: wrap the range, set `e.html = body.innerHTML`, `touch()` (:1073).
// The picture is the page's own paragraph, set by that law. The readings are the Factory flow's entries (flow-2026-10-03-1432.html).
import {useRef, type ReactNode} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {clampTo, num, str, type DesignedDevice, type ViewProps} from './design'
import './central__text.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type StyleId = 'body' | 'head' | 'quote' | 'list'
type Flag = 'b' | 'i' | 's'

const STYLES: readonly {readonly value: StyleId; readonly label: string; readonly does: string}[] = [
  {value: 'body', label: 'Body', does: 'A plain paragraph, as the page sets it.'},
  {value: 'head', label: 'Head', does: 'The paragraph as a heading, larger than the body.'},
  {value: 'quote', label: 'Quote', does: 'A pull quote, with a rule at the left.'},
  {value: 'list', label: 'List', does: 'The paragraph as a list item.'},
]
const FLAGS: readonly {readonly flag: Flag; readonly label: string; readonly does: string}[] = [
  {flag: 'b', label: 'Bold', does: 'Bold the selected words. It combines with Italic and Strike.'},
  {flag: 'i', label: 'Italic', does: 'Italicise the selected words. It combines with Bold and Strike.'},
  {flag: 's', label: 'Strike', does: 'Strike the selected words out. It combines with Bold and Italic.'},
]

/** The size in points: the page sets its type in pixels, and 20 px is 15 pt (ql-flow.html :126, :143). 13 pt is the entry body, 17 px (:85). */
const SIZE = {min: 13, max: 22, step: 1}
const SIZE_DEFAULT = 15
const PX = 4 / 3
const pt = (x: number) => `${Math.round(x)} pt`

/** The Factory flow's entries (flow-2026-10-03-1432.html): `C` the Factory coordinator, `F` the person. */
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
/** The entry that the picture shows when nothing is selected. */
const SAMPLE = 6

// ---------------------------------------------------------------- what the page holds, from the values

/** The page keeps each paragraph's style and each word's emphasis. The values are text, so both are kept as JSON. */
const record = (v: V, key: string): Record<string, string> => {
  try { const x: unknown = JSON.parse(str(v, key)); return x && typeof x === 'object' ? x as Record<string, string> : {} } catch { return {} }
}
const wordsOf = (entry: number) => ENTRIES[entry - 1]!.head.split(' ')

/** The selection the owner reports: the entry and the words in it. Entry 0 is no selection. */
function selection(v: V) {
  const entry = num(v, 'entry')
  if (!Number.isInteger(entry) || entry < 1 || entry > ENTRIES.length) return {entry: 0, from: 0, to: -1}
  const last = wordsOf(entry).length - 1, a = clampTo(0, last, num(v, 'from')), b = clampTo(0, last, num(v, 'to'))
  return {entry, from: Math.min(a, b), to: Math.max(a, b)}
}
const styleOf = (v: V, entry: number): StyleId => (record(v, 'styles')[entry] ?? 'body') as StyleId
const flagsOf = (v: V, entry: number, word: number) => record(v, 'marks')[`${entry}:${word}`] ?? ''
/** A flag reads on when every selected word carries it, as the browser's own query does. */
function flagOn(v: V, flag: Flag) {
  const s = selection(v)
  if (!s.entry) return false
  for (let w = s.from; w <= s.to; w++) if (!flagsOf(v, s.entry, w).includes(flag)) return false
  return true
}
const sizeOf = (v: V) => clampTo(SIZE.min, SIZE.max, Math.round(num(v, 'size')))
const countWords = (v: V) => { const s = selection(v); return s.entry ? s.to - s.from + 1 : undefined }
const reading = (v: V) => { const s = selection(v), n = countWords(v); return s.entry ? `entry ${s.entry} · ${n} word${n === 1 ? '' : 's'}` : 'No selection' }

function setStyle(v: V, set: SetFn, style: StyleId) {
  const s = selection(v)
  if (s.entry) set('styles', JSON.stringify({...record(v, 'styles'), [s.entry]: style}))
}
/** Press an emphasis: every selected word gains the flag, or loses it when all of them carry it (`e.html = innerHTML`, :1073). */
function toggleFlag(v: V, set: SetFn, flag: Flag) {
  const s = selection(v)
  if (!s.entry) return
  const marks = {...record(v, 'marks')}, off = flagOn(v, flag)
  for (let w = s.from; w <= s.to; w++) {
    const key = `${s.entry}:${w}`, held = new Set((marks[key] ?? '').split('').filter(Boolean))
    if (off) held.delete(flag); else held.add(flag)
    if (held.size) marks[key] = [...held].join(''); else delete marks[key]
  }
  set('marks', JSON.stringify(marks))
}

// ---------------------------------------------------------------- the page's words, as the page sets them

/** The words of an entry, each with its emphasis and the selection's tint. `on` makes a word a place you can press. */
function Words({v, entry, on}: {v: V; entry: number; on?: {down: (i: number) => void; enter: (i: number) => void}}) {
  const s = selection(v), words = wordsOf(entry)
  return <>{words.map((word, i) => {
    const flags = flagsOf(v, entry, i)
    return <span key={i} className="ctext-w" data-b={flags.includes('b')} data-i={flags.includes('i')} data-s={flags.includes('s')}
      data-sel={s.entry === entry && i >= s.from && i <= s.to} onPointerDown={on ? () => on.down(i) : undefined} onPointerEnter={on ? () => on.enter(i) : undefined}>
      {i < words.length - 1 ? `${word} ` : word}</span>
  })}</>
}

/** The paragraph in its style: the tag the page would keep. */
function Paragraph({v, entry, children}: {v: V; entry: number; children: ReactNode}) {
  const style = styleOf(v, entry)
  if (style === 'head') return <h2 className="ctext-head">{children}</h2>
  if (style === 'quote') return <blockquote className="ctext-quote">{children}</blockquote>
  if (style === 'list') return <ul className="ctext-list"><li>{children}</li></ul>
  return <p className="ctext-body">{children}</p>
}

// ---------------------------------------------------------------- the display: a paragraph of the page, with its two handles

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}

/** The paragraph set at the size you read in, scaled to the well (k): the same law as the pane. */
function Sheet({v, x, y, w, h, k}: Box & {v: V; k: number}) {
  const s = selection(v), entry = s.entry || SAMPLE
  return <foreignObject x={x} y={y} width={w} height={h}>
    <div className="ctext-sample" data-dim={s.entry ? undefined : true} style={{fontSize: sizeOf(v) * PX * k}}>
      <Paragraph v={v} entry={entry}><Words v={v} entry={entry} /></Paragraph>
    </div>
  </foreignObject>
}

/** Handle 1: the line with a stop for each style. Arrow keys step to the next stop. */
function StyleLine({v, set, w}: {v: V; set?: SetFn; w: number}) {
  const n = STYLES.length, step = (w - 38) / n, xs = STYLES.map((_, i) => 8 + step * (i + .5)), s = selection(v)
  const at = Math.max(0, STYLES.findIndex(style => style.value === styleOf(v, s.entry || SAMPLE)))
  const go = (i: number) => { if (set && s.entry) setStyle(v, set, STYLES[clampTo(0, n - 1, i)]!.value) }
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={8} x2={8 + step * n} y1={32} y2={32} className="dp-faint" />
    {STYLES.map((style, i) => <g key={style.value} onClick={() => go(i)} style={{cursor: set && s.entry ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - step / 2} y={16} width={step} height={20} fill="transparent" />
      <circle cx={xs[i]} cy={32} r={2} className="dp-faint" />
      <text x={xs[i]} y={25} textAnchor="middle" className={s.entry && i === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8.5}}>{style.label}</text>
    </g>)}
    {set && s.entry > 0 && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(at + d) }
    }}>
      <Handle x={xs[at]!} y={32} n={1} shape="square" label="Style" does="Drag along the line to choose Body, Head, Quote or List for the paragraph." onDrag={px => go(near(px))} onReset={() => setStyle(v, set, 'body')} />
    </g>}
  </g>
}

/** Handle 2: the size ruler, one tick for each point from 13 at the foot to 22 at the top. Arrow keys move one point. */
function SizeRuler({v, set, x, y0, y1}: {v: V; set?: SetFn; x: number; y0: number; y1: number}) {
  const size = sizeOf(v), span = SIZE.max - SIZE.min, at = (p: number) => y0 + (SIZE.max - p) / span * (y1 - y0)
  const go = (p: number) => set?.('size', clampTo(SIZE.min, SIZE.max, Math.round(p)))
  return <g>
    <line x1={x} x2={x} y1={y0} y2={y1} className="dp-faint" />
    {Array.from({length: span + 1}, (_, i) => SIZE.min + i).map(p => <line key={p} x1={x - (p === size ? 4 : 2)} x2={x + (p === size ? 4 : 2)} y1={at(p)} y2={at(p)} className={p === size ? 'dp-curve-on' : 'dp-faint'} />)}
    <text x={x} y={y0 - 7} textAnchor="middle" className="dp-axis">{SIZE.max}</text>
    <text x={x} y={y1 + 12} textAnchor="middle" className="dp-axis">{SIZE.min}</text>
    {set && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(size + d) }
    }}>
      <Handle x={x} y={at(size)} n={2} label="Size" does="Drag up the ruler to enlarge the type, down to reduce it." onDrag={(_, py) => go(SIZE.max - (py - y0) / (y1 - y0) * span)} onReset={() => go(SIZE_DEFAULT)} />
    </g>}
  </g>
}

/** The well: what the selection is, the style line, the paragraph on its paper, and the size ruler. `tile` draws the paper alone. */
function Picture({v, set, w, h, tile}: {v: V; set?: SetFn; w: number; h: number; tile?: boolean}) {
  if (tile) return <Sheet v={v} x={6} y={6} w={w - 12} h={h - 12} k={.46} />
  return <g>
    <text x={6} y={12} className="dp-ink-dim">{reading(v)}</text>
    <StyleLine v={v} set={set} w={w} />
    <Sheet v={v} x={6} y={44} w={w - 34} h={h - 52} k={w > 160 ? .48 : .42} />
    <SizeRuler v={v} set={set} x={w - 14} y0={54} y1={h - 20} />
  </g>
}

// ---------------------------------------------------------------- the pane: the open document at full size

/** The document's entries as the Flow's Dialogue sets them. Press a word, or drag across words, to select a passage; press an
 * entry's number to select the paragraph. The empty entry at the end is yours to write in. */
function TextPane({v, set}: {v: V; set: SetFn}) {
  const drag = useRef<{entry: number; at: number} | null>(null)
  const s = selection(v)
  const pick = (entry: number, a: number, b: number) => { set('entry', entry); set('from', Math.min(a, b)); set('to', Math.max(a, b)) }
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">Flow · flow-2026-10-03-1432</button>
    </div>
    <div className="ctext-pane" style={{fontSize: sizeOf(v) * PX}} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}>
      <div className="ctext-doc">
        {ENTRIES.map((e, i) => {
          const n = i + 1
          return <div key={n} className="ctext-entry" data-selected={s.entry === n}>
            <button type="button" className="ctext-num" aria-label={`Select entry ${n}`} data-i={`Entry ${n}|Select the whole paragraph.`} onClick={() => pick(n, 0, wordsOf(n).length - 1)}>
              {n}<small>{e.by}</small>
            </button>
            <Paragraph v={v} entry={n}>
              <Words v={v} entry={n} on={{
                down: w => { drag.current = {entry: n, at: w}; pick(n, w, w) },
                enter: w => { if (drag.current?.entry === n) pick(n, drag.current.at, w) },
              }} />
            </Paragraph>
          </div>
        })}
        <div className="ctext-entry">
          <div className="ctext-new" contentEditable suppressContentEditableWarning role="textbox" aria-label="New entry" data-i="New entry|Write here. Text sets your words and does not change them."
            data-placeholder="Begin here. An empty entry is allowed." />
        </div>
      </div>
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})
const NOTHING = 'Nothing is selected in the open document.'
const off = (v: V) => (selection(v).entry ? undefined : NOTHING)

function StyleRadio({p}: {p: ViewProps}) {
  const s = selection(p.v)
  return <Radio label="Style" does="The style of the selected paragraph: Body, Head, Quote or List." value={(s.entry ? styleOf(p.v, s.entry) : '') as StyleId} options={STYLES} stack
    onChange={x => setStyle(p.v, p.set, x)} disabled={off(p.v)} />
}
function EmphasisToggle({p, flag}: {p: ViewProps; flag: Flag}) {
  const f = FLAGS.find(x => x.flag === flag)!
  return <Toggle label={f.label} does={f.does} on={flagOn(p.v, flag)} onChange={() => toggleFlag(p.v, p.set, flag)} disabled={off(p.v)} />
}
function SizeDial({p}: {p: ViewProps}) {
  return <Dial label="Size" does="The type size in which you read the page. It does not change the page." value={sizeOf(p.v)} def={SIZE_DEFAULT} scale={SIZE} format={pt} onChange={x => p.set('size', x)} />
}

const styleWord = (v: V) => { const s = selection(v); return s.entry ? STYLES.find(x => x.value === styleOf(v, s.entry))!.label : '—' }

export const design: DesignedDevice = {
  id: 'central:text',
  title: 'Text',
  kind: 'effect',
  defaults: {
    light: 'lit', size: SIZE_DEFAULT,
    // The selection that the page reports, and what the page holds: the Head and Quote paragraphs and the bold words already set.
    entry: SAMPLE, from: 2, to: 3,
    styles: JSON.stringify({4: 'quote', 9: 'head'}), marks: JSON.stringify({'8:1': 'b', '8:2': 'b'}),
  },
  fixtures: {
    'Words selected': {},
    'Quote, bold': {entry: 11, from: 6, to: 7, size: 17, styles: JSON.stringify({4: 'quote', 9: 'head', 11: 'quote'}), marks: JSON.stringify({'8:1': 'b', '8:2': 'b', '11:6': 'b', '11:7': 'b'})},
    'Nothing selected': {entry: 0},
  },

  folded: p => <Folded title="Text" light={light(p.v)} readings={[styleWord(p.v), pt(sizeOf(p.v))]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Text" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The paragraph" does="A paragraph of the page, set in the style, emphasis and size you chose. Drag handle 1 along the line for the style and handle 2 up the ruler for the size." corner={pt(sizeOf(p.v))}>
        <Picture v={p.v} set={p.set} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <StyleRadio p={p} />
      <SizeDial p={p} />
      <EmphasisToggle p={p} flag="b" />
      <EmphasisToggle p={p} flag="i" />
    </Section>
  </Panel>,

  whole: p => <Panel title="Text" view="whole" {...head(p)}>
    <Band>
      <Section width={190}>
        <Display w={178} h={146} label="The paragraph" does="A paragraph of the page, set in the style, emphasis and size you chose. Drag handle 1 along the line for the style and handle 2 up the ruler for the size." corner={pt(sizeOf(p.v))}>
          <Picture v={p.v} set={p.set} w={178} h={146} />
        </Display>
      </Section>
      <Section label="Paragraph" width={80}>
        <StyleRadio p={p} />
        <Readout label="entry" does="The entry that holds the selection, of the entries on the page." value={selection(p.v).entry ? `${selection(p.v).entry}/${ENTRIES.length}` : undefined} tone="value" />
      </Section>
      <Section label="Words" width={58}>
        <EmphasisToggle p={p} flag="b" />
        <EmphasisToggle p={p} flag="i" />
        <EmphasisToggle p={p} flag="s" />
        <Readout label="words" does="The words in the selection." value={countWords(p.v)} tone="value" />
      </Section>
      <Section label="View" grow>
        <SizeDial p={p} />
        <Readout label="type" does="The same size in pixels, as the page sets its type." value={`${Math.round(sizeOf(p.v) * PX)} px`} />
      </Section>
    </Band>
  </Panel>,

  full: p => <TextPane v={p.v} set={p.set} />,

  widget: p => <Tile title="Text" light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The paragraph" does="A paragraph of the page, set as you chose.">
      <Picture v={p.v} w={112} h={104} tile />
    </Display>
    <div className="ref-tile-side">
      <Chooser wide label="Style" does="The style of the selected paragraph." value={(selection(p.v).entry ? styleOf(p.v, selection(p.v).entry) : '') as StyleId} options={STYLES}
        onChange={x => setStyle(p.v, p.set, x)} disabled={off(p.v)} />
      <div className="ref-pair">
        {FLAGS.map(f => <Toggle key={f.flag} label={f.label} does={f.does} on={flagOn(p.v, f.flag)} onChange={() => toggleFlag(p.v, p.set, f.flag)} disabled={off(p.v)} />)}
      </div>
      <ValueBox wide label="Size" does="The type size in which you read the page." value={sizeOf(p.v)} def={SIZE_DEFAULT} scale={SIZE} format={pt} onChange={x => p.set('size', x)} />
    </div>
  </Tile>,
}
