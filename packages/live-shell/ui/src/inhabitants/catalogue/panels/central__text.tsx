// Text (manual §18.1): an effect on a document's chain that sets how the words of a page are set — the style of the paragraph, the
// emphasis of the selected words and the size of the type you read in — and leaves every word whole. Live's nearest: Utility, a small
// effect whose meaning is plain at a glance.
// The owner is the page. A Flow keeps each entry as HTML in an editable body: desktop/cradle/documents/ql-flow.html `clean()` (:848)
// keeps tags and drops inline `style`, so a style and an emphasis are tags in the page (`p`, `blockquote`, `h2`, `ul`; `b`, `i`, `s`),
// and a size is never in the page. The body's own rules are `.body p`, `.body blockquote` (:89, :97) and its type is 17 px, or 20 px
// on a Flow or Journal page (:85, :126, :143): 20 px is 15 pt, the default. The selection reading is `currentSel()` (:1064) and the
// write it would use is the one Highlight already makes: wrap the range, set `e.html = body.innerHTML`, `touch()` (:1073).
// The picture is the page's own paragraph, set by that law. The page's material is the `entries` key (a JSON list of {by, head}) and
// its name the `document` key; the sample in `defaults` is the Factory flow's entries (flow-2026-10-03-1432.html). Every reading may be
// absent: the device then draws "—" and names the missing reading in the well, and a control that needs it is disabled with the reason.
import {useRef, type ReactNode} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {NONE, clampTo, has, json, numOf, shown, strOf, type DesignedDevice, type ViewProps} from './design'
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
/** The entry that the picture shows when nothing is selected: the sixth, or the last of a shorter page. */
const SAMPLE = 6

// ---------------------------------------------------------------- what the page holds, from the values

interface Entry {readonly by: string; readonly head: string}

/** A reading kept as JSON, parsed once for as long as its text is the same: the pane draws every word of a long document from it.
 * Undefined when the key is absent or its text is not what `make` accepts. */
const parsed = new Map<string, {readonly raw: string; readonly value: unknown}>()
function readJson<T>(v: V, key: string, make: (x: unknown) => T | undefined): T | undefined {
  if (!has(v, key)) return undefined
  const raw = String(v[key]), hit = parsed.get(key)
  if (hit && hit.raw === raw) return hit.value as T | undefined
  const value = make(json<unknown>(v, key, undefined))
  parsed.set(key, {raw, value})
  return value
}

/** The page's entries, each as `{by, head}` (`by`: `C` the coordinator, `F` the person), or undefined when the owner reports none.
 * An entry that is not an object keeps its place, empty, so the numbers on the page stay true. */
const entriesOf = (v: V): readonly Entry[] | undefined => readJson(v, 'entries', x => Array.isArray(x)
  ? x.map((e): Entry => { const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>; return {by: typeof o.by === 'string' ? o.by : '', head: typeof o.head === 'string' ? o.head : ''} })
  : undefined)

/** The page keeps each paragraph's style and each word's emphasis. The values are text, so both are kept as JSON. Undefined when unread. */
const recordOf = (v: V, key: string): Readonly<Record<string, string>> | undefined => readJson(v, key, x => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).filter((kv): kv is [string, string] => typeof kv[1] === 'string'))
  : undefined)

const wordsOf = (list: readonly Entry[], entry: number): readonly string[] => list[entry - 1]?.head.split(' ') ?? []
const finiteOf = (v: V, key: string) => { const x = numOf(v, key); return x !== undefined && Number.isFinite(x) ? x : undefined }

interface Selection {
  /** False when the owner reports no entry at all: the selection is unread. */
  readonly known: boolean
  /** The entry (from 1) that holds the selection; 0 is no selection. */
  readonly entry: number
  /** The selected words, when the owner reports them. */
  readonly range?: {readonly from: number; readonly to: number}
}

/** The selection the owner reports: the entry and the words in it. An entry that is not on the page is no selection. */
function selection(v: V): Selection {
  const list = entriesOf(v), entry = finiteOf(v, 'entry')
  if (entry === undefined) return {known: false, entry: 0}
  if (!Number.isInteger(entry) || entry < 1 || (list && entry > list.length)) return {known: true, entry: 0}
  const from = finiteOf(v, 'from'), to = finiteOf(v, 'to')
  if (from === undefined || to === undefined) return {known: true, entry}
  const last = list ? Math.max(0, wordsOf(list, entry).length - 1) : Infinity
  const a = clampTo(0, last, Math.round(from)), b = clampTo(0, last, Math.round(to))
  return {known: true, entry, range: {from: Math.min(a, b), to: Math.max(a, b)}}
}
/** The style of an entry: undefined when the owner reports no styles; an entry the page holds no style for is a plain paragraph. */
function styleOf(v: V, entry: number): StyleId | undefined {
  const styles = recordOf(v, 'styles'), x = styles?.[entry]
  return styles ? (STYLES.some(s => s.value === x) ? x as StyleId : 'body') : undefined
}
/** The emphases a word carries (`b`, `i`, `s`); none when the owner reports none. */
const flagsOf = (v: V, entry: number, word: number) => recordOf(v, 'marks')?.[`${entry}:${word}`] ?? ''
/** A flag reads on when every selected word carries it, as the browser's own query does. Undefined when the owner does not say. */
function flagOn(v: V, flag: Flag): boolean | undefined {
  const s = selection(v), marks = recordOf(v, 'marks')
  if (!s.known) return undefined
  if (!s.entry) return false
  if (!marks || !s.range) return undefined
  for (let w = s.range.from; w <= s.range.to; w++) if (!(marks[`${s.entry}:${w}`] ?? '').includes(flag)) return false
  return true
}
/** The size in points the owner reports, or undefined. */
const sizeOf = (v: V) => { const x = finiteOf(v, 'size'); return x === undefined ? undefined : clampTo(SIZE.min, SIZE.max, Math.round(x)) }
const sizeText = (v: V) => { const x = sizeOf(v); return x === undefined ? NONE : pt(x) }
/** The size the paragraph is drawn at: the one reported, or, where none is, the page's own type (15 pt, 20 px) so the words still set. */
const typeSize = (v: V) => sizeOf(v) ?? SIZE_DEFAULT
const countWords = (v: V) => { const s = selection(v); return s.entry && s.range ? s.range.to - s.range.from + 1 : undefined }
const selectionText = (v: V, narrow?: boolean) => {
  const s = selection(v), n = countWords(v)
  if (!s.known) return narrow ? 'No selection reading' : 'No reading of the selection'
  return s.entry ? `entry ${s.entry} · ${n === undefined ? NONE : `${n} word${n === 1 ? '' : 's'}`}` : 'No selection'
}
/** What the well says where the page's entries are not there to draw. */
const noEntries = (v: V) => (entriesOf(v) === undefined ? 'No reading of the entries' : 'The page has no entries')

function setStyle(v: V, set: SetFn, style: StyleId) {
  const s = selection(v), styles = recordOf(v, 'styles')
  if (s.entry && styles) set('styles', JSON.stringify({...styles, [s.entry]: style}))
}
/** Press an emphasis: every selected word gains the flag, or loses it when all of them carry it (`e.html = innerHTML`, :1073). */
function toggleFlag(v: V, set: SetFn, flag: Flag) {
  const s = selection(v), held = recordOf(v, 'marks')
  if (!s.entry || !s.range || !held) return
  const marks = {...held}, off = flagOn(v, flag) === true
  for (let w = s.range.from; w <= s.range.to; w++) {
    const key = `${s.entry}:${w}`, flags = new Set((marks[key] ?? '').split('').filter(Boolean))
    if (off) flags.delete(flag); else flags.add(flag)
    if (flags.size) marks[key] = [...flags].join(''); else delete marks[key]
  }
  set('marks', JSON.stringify(marks))
}

// ---------------------------------------------------------------- the page's words, as the page sets them

/** The words of an entry, each with its emphasis and the selection's tint. `on` makes a word a place you can press. */
function Words({v, entry, on}: {v: V; entry: number; on?: {down: (i: number) => void; enter: (i: number) => void}}) {
  const list = entriesOf(v), s = selection(v), words = list ? wordsOf(list, entry) : []
  return <>{words.map((word, i) => {
    const flags = flagsOf(v, entry, i)
    return <span key={i} className="ctext-w" data-b={flags.includes('b')} data-i={flags.includes('i')} data-s={flags.includes('s')}
      data-sel={s.entry === entry && !!s.range && i >= s.range.from && i <= s.range.to} onPointerDown={on ? () => on.down(i) : undefined} onPointerEnter={on ? () => on.enter(i) : undefined}>
      {i < words.length - 1 ? `${word} ` : word}</span>
  })}</>
}

/** The paragraph in its style: the tag the page would keep. A style that is not reported draws the plain paragraph. */
function Paragraph({style, children}: {style: StyleId | undefined; children: ReactNode}) {
  if (style === 'head') return <h2 className="ctext-head">{children}</h2>
  if (style === 'quote') return <blockquote className="ctext-quote">{children}</blockquote>
  if (style === 'list') return <ul className="ctext-list"><li>{children}</li></ul>
  return <p className="ctext-body">{children}</p>
}

// ---------------------------------------------------------------- the display: a paragraph of the page, with its two handles

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}

/** The paragraph set at the size you read in, scaled to the well (k): the same law as the pane. */
function Sheet({v, list, x, y, w, h, k}: Box & {v: V; list: readonly Entry[]; k: number}) {
  const s = selection(v), entry = s.entry || Math.min(SAMPLE, list.length)
  return <foreignObject x={x} y={y} width={w} height={h}>
    <div className="ctext-sample" data-dim={s.entry ? undefined : true} style={{fontSize: typeSize(v) * PX * k}}>
      <Paragraph style={styleOf(v, entry)}><Words v={v} entry={entry} /></Paragraph>
    </div>
  </foreignObject>
}

/** Where the paper would be, when the page has no entries to set: the missing reading, in words. */
function Blank({v, x, y, w, h}: Box & {v: V}) {
  return <foreignObject x={x} y={y} width={w} height={h}><p className="ctext-blank">{noEntries(v)}</p></foreignObject>
}

/** Handle 1: the line with a stop for each style. Arrow keys step to the next stop. */
function StyleLine({v, set, w}: {v: V; set?: SetFn; w: number}) {
  const n = STYLES.length, step = (w - 38) / n, xs = STYLES.map((_, i) => 8 + step * (i + .5)), s = selection(v)
  const style = s.entry ? styleOf(v, s.entry) : undefined
  const at = STYLES.findIndex(x => x.value === style), live = at >= 0 ? set : undefined
  const go = (i: number) => { if (live) setStyle(v, live, STYLES[clampTo(0, n - 1, i)]!.value) }
  const near = (px: number) => xs.reduce((best, cx, j) => (Math.abs(cx - px) < Math.abs(xs[best]! - px) ? j : best), 0)
  return <g>
    <line x1={8} x2={8 + step * n} y1={32} y2={32} className="dp-faint" />
    {STYLES.map((x, i) => <g key={x.value} onClick={() => go(i)} style={{cursor: live ? 'pointer' : 'default'}}>
      <rect x={xs[i]! - step / 2} y={16} width={step} height={20} fill="transparent" />
      <circle cx={xs[i]} cy={32} r={2} className="dp-faint" />
      <text x={xs[i]} y={25} textAnchor="middle" className={i === at ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 8.5}}>{x.label}</text>
    </g>)}
    {live && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(at + d) }
    }}>
      <Handle x={xs[at]!} y={32} n={1} shape="square" label="Style" does="Drag along the line to choose Body, Head, Quote or List for the paragraph." onDrag={px => go(near(px))} onReset={() => setStyle(v, live, 'body')} />
    </g>}
  </g>
}

/** Handle 2: the size ruler, one tick for each point from 13 at the foot to 22 at the top. Arrow keys move one point. With no size
 * reported the ruler is drawn without its mark and its handle. */
function SizeRuler({v, set, x, y0, y1}: {v: V; set?: SetFn; x: number; y0: number; y1: number}) {
  const size = sizeOf(v), span = SIZE.max - SIZE.min, at = (p: number) => y0 + (SIZE.max - p) / span * (y1 - y0)
  const go = (p: number) => set?.('size', clampTo(SIZE.min, SIZE.max, Math.round(p)))
  return <g>
    <line x1={x} x2={x} y1={y0} y2={y1} className="dp-faint" />
    {Array.from({length: span + 1}, (_, i) => SIZE.min + i).map(p => <line key={p} x1={x - (p === size ? 4 : 2)} x2={x + (p === size ? 4 : 2)} y1={at(p)} y2={at(p)} className={p === size ? 'dp-curve-on' : 'dp-faint'} />)}
    <text x={x} y={y0 - 7} textAnchor="middle" className="dp-axis">{SIZE.max}</text>
    <text x={x} y={y1 + 12} textAnchor="middle" className="dp-axis">{SIZE.min}</text>
    {set && size !== undefined && <g onKeyDownCapture={e => {
      const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
      if (d) { e.preventDefault(); e.stopPropagation(); go(size + d) }
    }}>
      <Handle x={x} y={at(size)} n={2} label="Size" does="Drag up the ruler to enlarge the type, down to reduce it." onDrag={(_, py) => go(SIZE.max - (py - y0) / (y1 - y0) * span)} onReset={() => go(SIZE_DEFAULT)} />
    </g>}
  </g>
}

/** The well: what the selection is, the style line, the paragraph on its paper, and the size ruler. `tile` draws the paper alone. */
function Picture({v, set, w, h, tile}: {v: V; set?: SetFn; w: number; h: number; tile?: boolean}) {
  const list = entriesOf(v), box: Box = tile ? {x: 6, y: 6, w: w - 12, h: h - 12} : {x: 6, y: 44, w: w - 34, h: h - 52}
  const paper = list?.length ? <Sheet v={v} list={list} {...box} k={tile ? .46 : w > 160 ? .48 : .42} /> : <Blank v={v} {...box} />
  if (tile) return paper
  return <g>
    <text x={6} y={12} className="dp-ink-dim">{selectionText(v, w < 160)}</text>
    <StyleLine v={v} set={set} w={w} />
    {paper}
    <SizeRuler v={v} set={set} x={w - 14} y0={54} y1={h - 20} />
  </g>
}

// ---------------------------------------------------------------- the pane: the open document at full size

/** The document's entries as the Flow's Dialogue sets them. Press a word, or drag across words, to select a passage; press an
 * entry's number to select the paragraph. The empty entry at the end is yours to write in. */
function TextPane({v, set}: {v: V; set: SetFn}) {
  const drag = useRef<{entry: number; at: number} | null>(null)
  const list = entriesOf(v), s = selection(v)
  const pick = (entry: number, a: number, b: number) => { set('entry', entry); set('from', Math.min(a, b)); set('to', Math.max(a, b)) }
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{shown(v, 'document')}</button>
    </div>
    <div className="ctext-pane" style={{fontSize: typeSize(v) * PX}} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}>
      <div className="ctext-doc">
        {list?.map((e, i) => {
          const n = i + 1
          return <div key={n} className="ctext-entry" data-selected={s.entry === n}>
            <button type="button" className="ctext-num" aria-label={`Select entry ${n}`} data-i={`Entry ${n}|Select the whole paragraph.`} onClick={() => pick(n, 0, wordsOf(list, n).length - 1)}>
              {n}<small>{e.by || NONE}</small>
            </button>
            <Paragraph style={styleOf(v, n)}>
              <Words v={v} entry={n} on={{
                down: w => { drag.current = {entry: n, at: w}; pick(n, w, w) },
                enter: w => { if (drag.current?.entry === n) pick(n, drag.current.at, w) },
              }} />
            </Paragraph>
          </div>
        })}
        {list === undefined && <p className="ctext-blank ctext-blank--pane">{noEntries(v)}</p>}
        {list && <div className="ctext-entry">
          <div className="ctext-new" contentEditable suppressContentEditableWarning role="textbox" aria-label="New entry" data-i="New entry|Write here. Text sets your words and does not change them."
            data-placeholder="Begin here. An empty entry is allowed." />
        </div>}
      </div>
    </div>
  </div>
}

// ---------------------------------------------------------------- the controls

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const NOTHING = 'Nothing is selected in the open document.'
/** Why a control on the selection cannot act: the selection is unread, or empty. */
const noSelection = (v: V) => { const s = selection(v); return s.known ? (s.entry ? undefined : NOTHING) : 'No reading of the selection.' }
const noStyle = (v: V) => noSelection(v) ?? (recordOf(v, 'styles') ? undefined : 'No reading of the styles.')
const noFlag = (v: V) => noSelection(v) ?? (!recordOf(v, 'marks') ? 'No reading of the emphases.' : selection(v).range ? undefined : 'No reading of the selected words.')
/** The style of the selected paragraph, for a Radio or Chooser: none when nothing is selected or the style is unread. */
const styleValue = (v: V) => ((selection(v).entry ? styleOf(v, selection(v).entry) : undefined) ?? '') as StyleId

function StyleRadio({p}: {p: ViewProps}) {
  return <Radio label="Style" does="The style of the selected paragraph: Body, Head, Quote or List." value={styleValue(p.v)} options={STYLES} stack
    onChange={x => setStyle(p.v, p.set, x)} disabled={noStyle(p.v)} />
}
function EmphasisToggle({p, flag}: {p: ViewProps; flag: Flag}) {
  const f = FLAGS.find(x => x.flag === flag)!, now = flagOn(p.v, flag)
  return <Toggle label={f.label} does={f.does} on={now === true} unknown={now === undefined} onChange={() => toggleFlag(p.v, p.set, flag)} disabled={noFlag(p.v)} />
}
function SizeDial({p}: {p: ViewProps}) {
  return <Dial label="Size" does="The type size in which you read the page. It does not change the page." value={sizeOf(p.v) ?? NaN} def={SIZE_DEFAULT} scale={SIZE} format={pt} onChange={x => p.set('size', x)} />
}

const styleWord = (v: V) => { const s = selection(v), style = s.entry ? styleOf(v, s.entry) : undefined; return STYLES.find(x => x.value === style)?.label ?? NONE }

export const design: DesignedDevice = {
  id: 'central:text',
  title: 'Text',
  kind: 'effect',
  defaults: {
    light: 'lit', size: SIZE_DEFAULT, document: 'Flow · flow-2026-10-03-1432',
    // The page's entries (the Factory flow's, `C` the coordinator and `F` the person), the selection that the page reports, and what the
    // page holds: the Head and Quote paragraphs and the bold words already set.
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
    entry: 6, from: 2, to: 3,
    styles: JSON.stringify({4: 'quote', 9: 'head'}), marks: JSON.stringify({'8:1': 'b', '8:2': 'b'}),
  },
  fixtures: {
    'Words selected': {},
    'Quote, bold': {entry: 11, from: 6, to: 7, size: 17, styles: JSON.stringify({4: 'quote', 9: 'head', 11: 'quote'}), marks: JSON.stringify({'8:1': 'b', '8:2': 'b', '11:6': 'b', '11:7': 'b'})},
    'Nothing selected': {entry: 0},
    'No readings': Object.fromEntries(['light', 'size', 'document', 'entries', 'entry', 'from', 'to', 'styles', 'marks'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Text" light={light(p)} readings={[styleWord(p.v), sizeText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Text" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The paragraph" does="A paragraph of the page, set in the style, emphasis and size you chose. Drag handle 1 along the line for the style and handle 2 up the ruler for the size." corner={sizeText(p.v)}>
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
        <Display w={178} h={146} label="The paragraph" does="A paragraph of the page, set in the style, emphasis and size you chose. Drag handle 1 along the line for the style and handle 2 up the ruler for the size." corner={sizeText(p.v)}>
          <Picture v={p.v} set={p.set} w={178} h={146} />
        </Display>
      </Section>
      <Section label="Paragraph" width={80}>
        <StyleRadio p={p} />
        <Readout label="entry" does="The entry that holds the selection, of the entries on the page." value={selection(p.v).entry ? `${selection(p.v).entry}/${entriesOf(p.v)?.length ?? NONE}` : undefined} tone="value" />
      </Section>
      <Section label="Words" width={58}>
        <EmphasisToggle p={p} flag="b" />
        <EmphasisToggle p={p} flag="i" />
        <EmphasisToggle p={p} flag="s" />
        <Readout label="words" does="The words in the selection." value={countWords(p.v)} tone="value" />
      </Section>
      <Section label="View" grow>
        <SizeDial p={p} />
        <Readout label="type" does="The same size in pixels, as the page sets its type." value={sizeOf(p.v) === undefined ? undefined : `${Math.round(sizeOf(p.v)! * PX)} px`} />
      </Section>
    </Band>
  </Panel>,

  full: p => <TextPane v={p.v} set={p.set} />,

  widget: p => <Tile title="Text" light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The paragraph" does="A paragraph of the page, set as you chose.">
      <Picture v={p.v} w={112} h={104} tile />
    </Display>
    <div className="ref-tile-side">
      <Chooser wide label="Style" does="The style of the selected paragraph." value={styleValue(p.v)} options={STYLES}
        onChange={x => setStyle(p.v, p.set, x)} disabled={noStyle(p.v)} />
      <div className="ref-pair">
        {FLAGS.map(f => <EmphasisToggle key={f.flag} p={p} flag={f.flag} />)}
      </div>
      <ValueBox wide label="Size" does="The type size in which you read the page." value={sizeOf(p.v) ?? NaN} def={SIZE_DEFAULT} scale={SIZE} format={pt} onChange={x => p.set('size', x)} />
    </div>
  </Tile>,
}
