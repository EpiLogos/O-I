// The Beings (manual §18.1): a Central page about a person or an agent, tied to its world, its subject, its offices, its sources and
// its places. Live's nearest: a device that draws its material, as Simpler draws its sample. The picture is the page as the Beings
// template draws it (desktop/cradle/documents/oi-beings.html): the same 12-column grid, the mark at the right (Portrait) or at the
// left (Editorial), the paper or ink tokens, the Expression block between the opening and the sections, the side list In relation.
// The ties are the `bindings` of its oi.page/v1 island (desktop/cradle/src/personal/page.mjs validatePage): worldRef, subjectRef,
// categories (the offices C1–C4, at least one, default C2), expressionRef and sources (each a ref at a revision). Layout and Ground are
// its `appearance.layout` and `appearance.tone`, the same two settings that the Document device sets (central__document.tsx).
// Everything the page holds is a value. The owner's lists are value keys, each a JSON list of names or of {value, label}: `worlds`,
// `subjects` (each with its `kind`, person or agent), `expressions`, `places`, and `anchors` (each with `lat`, `lon` and `precision`).
// The page's own material is `title`, `template`, the counts `sections` and `links`, and `sources` (a JSON list of {name, ref, rev}: the
// files the page rests on, each at the digest of its revision). The sample readings in `defaults` are real: the agents are those of
// Control/self/agents, the sources are files at their sha-256 digests, the anchors are occurrences of the Archetypal Earth field
// (atlas-earth__globe-engine.tsx PLACES; field.json). A key the owner does not report is absent: the picture then names the missing
// reading in words, and every control and reading draws "—". Adding a source and dropping one are actions of their own
// (`addSource`, and `dropSource` with the ref of the source); the owner's standing for each key decides whether it can act.
import {useEffect, useRef, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {KindMark} from '../../sdk/marks'
import {NONE, boolOf, cradleDocuments, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary

const KINDS = [
  {value: 'person', label: 'Person', does: 'A person in your work.'},
  {value: 'agent', label: 'Agent', does: 'An agent you work with. The page reads its card from Agent identity.'},
] as const
/** The subject offices (PERSONAL-WEB.md: C1 Form, C2 Entity, C3 Process, C4 Type). The page keeps at least one. */
const OFFICES = [{n: 1, name: 'Form'}, {n: 2, name: 'Entity'}, {n: 3, name: 'Process'}, {n: 4, name: 'Type'}] as const
const LAYOUTS = [
  {value: 'portrait', label: 'Portrait', does: 'The mark stands at the right.'},
  {value: 'editorial', label: 'Editorial', does: 'The mark stands at the left.'},
] as const
const GROUNDS = [
  {value: 'paper', label: 'Paper', does: 'Dark ink on light paper.'},
  {value: 'ink', label: 'Ink', does: 'Light ink on dark ground.'},
] as const

/** The tokens of the template, light (`paper`) and dark (`ink`): body[data-tone] in oi-beings.html. */
const PAPER = {
  paper: {bg: '#EFEFED', field: '#FAFAF8', ink: '#000000', mid: '#6E6E6A', faint: '#A3A39E', rule: '#C9C9C4'},
  ink: {bg: '#20231f', field: '#282c26', ink: '#eeeee8', mid: '#b2b7aa', faint: '#8e9688', rule: '#555e50'},
} as const

// ---------------------------------------------------------------- readings, from the values

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)
/** A name cut to a width, or "—" when the key is absent. */
const tag = (name: string | undefined, n: number) => (name === undefined ? NONE : short(name, n))

/** One entry of a list the owner reports: a name, or {value, label} with what the list adds (a subject's `kind`, an anchor's place). */
interface Offer {
  readonly value: string
  readonly label: string
  readonly kind?: string
  readonly lat?: number
  readonly lon?: number
  readonly precision?: string
}
const isObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const finite = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
/** A list the owner reports under a key: its readable entries, or undefined when the key is absent or does not hold a list. */
function offersOf(v: V, key: string): readonly Offer[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  if (!Array.isArray(raw)) return undefined
  const out: Offer[] = []
  for (const x of raw) {
    if (typeof x === 'string') out.push({value: x, label: x})
    else if (isObject(x) && typeof x.value === 'string') {
      out.push({value: x.value, label: typeof x.label === 'string' ? x.label : x.value, kind: typeof x.kind === 'string' ? x.kind : undefined,
        lat: finite(x.lat), lon: finite(x.lon), precision: typeof x.precision === 'string' ? x.precision : undefined})
    }
  }
  return out
}

/** A source the page rests on: the file's name, its ref and the revision read. */
interface Source {
  readonly name: string
  readonly ref: string
  readonly rev: string
}
function sourcesOf(v: V): readonly Source[] | undefined {
  const raw = json<unknown>(v, 'sources', undefined)
  if (!Array.isArray(raw)) return undefined
  const out: Source[] = []
  for (const x of raw) {
    if (isObject(x) && typeof x.ref === 'string') {
      out.push({ref: x.ref, name: typeof x.name === 'string' ? x.name : x.ref.split(':').pop() ?? x.ref, rev: typeof x.rev === 'string' ? x.rev : ''})
    }
  }
  return out
}

/** What a key names: undefined when the key is absent, `none` when it holds nothing, otherwise the label the owner's list gives it
 * (the value itself when the list does not hold it: the value is the reading, the label only a name for it). */
function named(v: V, key: string, list: string, none: string): string | undefined {
  const value = strOf(v, key)
  if (value === undefined) return undefined
  if (value === '') return none
  return offersOf(v, list)?.find(o => o.value === value)?.label ?? value
}
const worldName = (v: V, none = 'No world') => named(v, 'world', 'worlds', none)
const subjectName = (v: V) => named(v, 'subject', 'subjects', 'No subject')
const placeName = (v: V, none = 'No place') => named(v, 'place', 'places', none)
const anchorOf = (v: V) => { const key = strOf(v, 'anchor'); return key ? offersOf(v, 'anchors')?.find(a => a.value === key) : undefined }
const titleOf = (v: V) => strOf(v, 'title')?.trim()
/** The title as a short tag: "—" when absent, "Untitled" when the page has none. */
const titleTag = (v: V, n: number) => { const t = titleOf(v); return t === undefined ? NONE : short(t || 'Untitled', n) }
const layoutOf = (v: V) => LAYOUTS.find(l => l.value === strOf(v, 'layout'))?.value
const groundOf = (v: V) => GROUNDS.find(g => g.value === strOf(v, 'ground'))?.value
const officesOn = (v: V) => OFFICES.filter(o => boolOf(v, `o${o.n}`) === true)
const degrees = (x: number, plus: string, minus: string) => `${Math.abs(x).toFixed(2)}° ${x >= 0 ? plus : minus}`
const latOf = (v: V) => { const a = anchorOf(v); return a?.lat === undefined ? undefined : degrees(a.lat, 'N', 'S') }
const lonOf = (v: V) => { const a = anchorOf(v); return a?.lon === undefined ? undefined : degrees(a.lon, 'E', 'W') }

/** A line of words broken at a width, to at most `max` lines. */
function wrap(text: string, n: number, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && `${line} ${word}`.length > n) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out.length > max ? [...out.slice(0, max - 1), `${out[max - 1]!.slice(0, Math.max(1, n - 1))}…`] : out
}

/** One office turns on or off. The page keeps at least one: the last one that is on stays. */
function setOffice(p: ViewProps, n: number, next: boolean) {
  if (!next && boolOf(p.v, `o${n}`) === true && officesOn(p.v).length <= 1) return
  p.set(`o${n}`, next)
}
/** A new kind changes which beings the Subject lists: a subject the new kind does not list is let go. */
function setKind(p: ViewProps, kind: string) {
  p.set('kind', kind)
  const now = strOf(p.v, 'subject'), subjects = offersOf(p.v, 'subjects')
  if (now && subjects && !st(p, 'subject').disabled && !subjects.some(s => s.value === now && (s.kind === undefined || s.kind === kind))) p.set('subject', '')
}

/** The choices of a Chooser: None, then the owner's list (for a subject, the beings of the open kind). A value that the list does not
 * hold stays a choice, so the Chooser shows what the owner reports. No list from the owner: no choice but the value. */
function optionsFor(offers: readonly Offer[] | undefined, value: string | undefined, kind?: string): Option<string>[] {
  if (!offers) return value ? [{value, label: value}] : []
  const options: Option<string>[] = [{value: '', label: 'None'},
    ...offers.filter(o => kind === undefined || o.kind === undefined || o.kind === kind).map(o => ({value: o.value, label: o.label}))]
  if (value && !options.some(o => o.value === value)) options.push({value, label: offers.find(o => o.value === value)?.label ?? value})
  return options
}

// ---------------------------------------------------------------- the display: the page, as its template draws it

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}

/** The template's 12-column grid on a sheet. Portrait: the mark at columns 10–12, the sections at 1–8, the side list at 10–12.
 * Editorial: the mark at 1–2, the opening at 3–12, the sections at 3–9, the side list at 11–12. */
function grid(editorial: boolean, {x, y, w}: Box, small: boolean) {
  const pad = small ? 5 : 6, inner = w - pad * 2, gap = inner * 0.024, col = (inner - 11 * gap) / 12
  const colX = (i: number) => x + pad + (i - 1) * (col + gap), spanW = (n: number) => n * col + (n - 1) * gap
  const markW = Math.min(spanW(editorial ? 2 : 3), small ? 20 : 26), markX = colX(editorial ? 1 : 10), y0 = y + 5
  return {editorial, pad, inner, colX, spanW, markW, markX, y0, markCx: markX + markW / 2, markCy: y0 + 60 * (markW / 120)}
}

/** Where the sheet cannot be drawn: the reading it lacks, named in words inside a dashed outline. */
function Lack({x, y, w, h, words}: Box & {words: string}) {
  const lines = wrap(words, Math.max(8, Math.floor((w - 12) / 5.2)), 3)
  return <g>
    <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} className="dp-faint" strokeDasharray="2 3" />
    {lines.map((line, i) => <text key={i} x={x + w / 2} y={y + h / 2 - (lines.length - 1) * 5 + i * 10 + 3} textAnchor="middle" className="dp-ink-dim">{line}</text>)}
  </g>
}

/** The page sheet, drawn on that grid with the template's tokens. It needs the Layout and the Ground; without them it says so. */
function Sheet({v, x, y, w, h, small}: Box & {v: V; small?: boolean}) {
  const layout = layoutOf(v), tone = groundOf(v)
  if (!layout || !tone) return <Lack x={x} y={y} w={w} h={h} words={`No reading of the ${[!layout && 'layout', !tone && 'ground'].filter(Boolean).join(' and ')}`} />
  const p = PAPER[tone]
  const {editorial, pad, inner, colX, spanW, markW, markX, y0} = grid(layout === 'editorial', {x, y, w, h}, !!small)
  const introX = colX(editorial ? 3 : 1), introW = spanW(editorial ? 10 : 9)
  const title = titleOf(v), size = small ? 7.5 : 8.5, pitch = small ? 8.5 : 9.5
  const lines = title ? wrap(title, Math.max(6, Math.floor(introW / (size * 0.5))), 2) : []
  const subY = y0 + pitch * 2 + 5, mastBottom = y0 + (small ? 38 : 42)
  const expression = strOf(v, 'expression')
  const secX = colX(editorial ? 3 : 1), secW = spanW(editorial ? 7 : 8), railX = colX(editorial ? 11 : 10), railW = spanW(editorial ? 2 : 3)
  const top = mastBottom + (expression !== '' ? (small ? 13 : 14) : 5), room = y + h - top - 2
  const rowPitch = small ? 11 : 13
  const sections = numOf(v, 'sections'), links = numOf(v, 'links')
  const rows = sections === undefined ? 0 : Math.max(0, Math.min(Math.floor(room / rowPitch), Math.max(1, Math.round(sections))))
  const relations = links === undefined ? 0 : Math.max(0, Math.min(Math.floor((room - 6) / 6), Math.round(links)))
  const s = markW / 120
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={p.bg} />
    <rect x={introX} y={y0} width={introW * 0.34} height={1.2} fill={p.mid} />
    {title === undefined
      ? <text x={introX} y={y0 + 10} fill={p.mid} style={{font: `${size}px Charter, Georgia, serif`}}>{NONE}</text>
      : lines.length ? lines.map((line, i) => <text key={i} x={introX} y={y0 + 10 + i * pitch} fill={p.ink} style={{font: `${size}px Charter, Georgia, serif`}}>{line}</text>)
        : [0.6, 0.36].map((f, i) => <rect key={i} x={introX} y={y0 + 5 + i * 7} width={introW * f} height={3.6} fill={p.faint} opacity={0.6} />)}
    <rect x={introX} y={subY} width={introW * 0.5} height={1.8} fill={p.mid} opacity={0.8} />
    {[0.82, 0.6].map((f, i) => <rect key={i} x={introX} y={subY + 5 + i * 3.6} width={introW * f} height={1.2} fill={p.rule} />)}
    <g fill="none" stroke={p.ink} strokeWidth={1 / Math.max(s, 0.01) * 0.7} transform={`translate(${markX} ${y0}) scale(${s})`}>
      <circle cx={47} cy={60} r={35} />
      <circle cx={73} cy={60} r={35} strokeDasharray="1 4" />
    </g>
    <rect x={x + pad} y={mastBottom} width={inner} height={0.7} fill={p.rule} />
    {expression !== '' && <g>
      <rect x={x + pad} y={mastBottom + 3} width={inner} height={small ? 8 : 9} fill={p.field} />
      <text x={x + pad + inner / 2} y={mastBottom + (small ? 9.2 : 10.2)} textAnchor="middle" fill={p.mid} style={{font: `${small ? 5.5 : 6}px var(--font-ui)`}}>{expression ?? NONE}</text>
    </g>}
    {sections === undefined && <text x={secX} y={top + 6} fill={p.faint} style={{font: '7px var(--font-ui)'}}>{NONE}</text>}
    {Array.from({length: rows}, (_, i) => <g key={i}>
      <text x={secX} y={top + 5 + i * rowPitch} fill={p.faint} style={{font: '5px var(--font-ui)'}}>{String(i + 1).padStart(2, '0')}</text>
      <rect x={secX + 8} y={top + i * rowPitch + 1} width={secW * 0.42} height={2.4} fill={p.ink} opacity={0.7} />
      <rect x={secX + 8} y={top + i * rowPitch + 6} width={secW - 8} height={1.2} fill={p.rule} />
    </g>)}
    <rect x={railX} y={top + 1} width={railW * 0.62} height={1.6} fill={p.mid} />
    {links === undefined
      ? <text x={railX} y={top + 10} fill={p.faint} style={{font: '7px var(--font-ui)'}}>{NONE}</text>
      : relations
        ? Array.from({length: relations}, (_, i) => <g key={i}>
          <rect x={railX} y={top + 6 + i * 6} width={railW} height={0.6} fill={p.rule} />
          <rect x={railX} y={top + 8 + i * 6} width={railW * (i % 2 ? 0.6 : 0.8)} height={1.2} fill={p.mid} opacity={0.8} />
        </g>)
        : <rect x={railX} y={top + 7} width={railW * 0.7} height={1.2} fill={p.faint} opacity={0.7} />}
  </g>
}

/** The map pin that shows when the page has a place. */
const Pin = ({x, y, on: lit}: {x: number; y: number; on: boolean}) => <g transform={`translate(${x} ${y})`} fill={lit ? 'var(--dp-on)' : 'none'} stroke={lit ? 'none' : 'var(--text-faint)'}>
  <path d="M0 0L-3.2-5.2a3.7 3.7 0 1 1 6.4 0Z" />
  <circle cx={0} cy={-6.4} r={1.3} fill="var(--dp-well)" />
</g>

/** The four offices as cells under the sheet: click one to take the office up or lay it down. The last one that is on stays. A cell
 * whose office is not reported is dashed. */
function OfficeCells({p, x, y, cw}: {p: ViewProps; x: number; y: number; cw: number}) {
  const last = officesOn(p.v).length <= 1
  return <g role="group" aria-label="Offices">
    {OFFICES.map((o, i) => {
      const key = `o${o.n}`, state = boolOf(p.v, key), lit = state === true, unknown = state === undefined, keeps = lit && last, lock = st(p, key).disabled
      const act = lock ? undefined : () => setOffice(p, o.n, !lit)
      const why = lock ?? (keeps ? 'The page keeps at least one office.' : undefined)
      const cx = x + i * (cw + 3)
      return <g key={o.n} role="checkbox" aria-checked={unknown ? 'mixed' : lit} aria-label={`Office ${o.n}, ${o.name}`} tabIndex={act ? 0 : -1}
        data-i={`Office ${o.n} · ${o.name}|${why ?? (unknown ? 'No reading of this office yet. Press to take it up.' : lit ? 'Lay this office down.' : 'The page takes up this office.')}`}
        style={{cursor: act && !keeps ? 'pointer' : 'default'}} onClick={act}
        onKeyDown={e => { if (act && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); act() } }}>
        <rect x={cx + 0.5} y={y + 0.5} width={cw - 1} height={15} className={lit ? 'dp-fill-on' : 'dp-faint'}
          style={lit ? {stroke: 'var(--dp-on)', strokeWidth: 1} : unknown ? {strokeDasharray: '2 2'} : undefined} />
        <text x={cx + cw / 2} y={y + 11} textAnchor="middle" className={lit ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 9}}>{o.n}</text>
      </g>
    })}
  </g>
}

/** The two swatches of Ground, with handle 2 on the one that is set (none while the ground is not reported). */
function GroundSwatches({p, x, y}: {p: ViewProps; x: number; y: number}) {
  const ground = groundOf(p.v), lock = st(p, 'ground').disabled, at = ground === 'ink' ? x + 15 : x
  return <g>
    {GROUNDS.map((g, i) => <g key={g.value} onClick={lock ? undefined : () => p.set('ground', g.value)} style={{cursor: lock ? 'default' : 'pointer'}}>
      <rect x={x + i * 15 + 0.5} y={y + 0.5} width={11} height={9} fill={PAPER[g.value].bg} stroke={PAPER[g.value].rule} />
    </g>)}
    {ground && <Handle x={at + 5.5} y={y + 5} n={2} shape="square" label="Ground" does={['Drag to the paper or the ink swatch to set the ground.', lock].filter(Boolean).join(' ')}
      onDrag={lock ? undefined : px => p.set('ground', px < x + 13 ? 'paper' : 'ink')} onReset={lock ? undefined : () => p.set('ground', 'paper')} />}
  </g>
}

/** The anchor as one line of the well: "—" when not reported, None when empty, the place and its position otherwise. */
function anchorLine(v: V): string {
  const key = strOf(v, 'anchor'), a = anchorOf(v)
  if (key === undefined) return NONE
  if (key === '') return 'No anchor'
  const where = [latOf(v), lonOf(v)].filter(Boolean).join(' ')
  return a ? [a.label, where].filter(Boolean).join(' ') : key
}

/** The well. Compact: the sheet and the offices, with the pin. Whole: the same, then the anchor and the ground. `tile`: the sheet alone. */
function Preview({p, w, h, whole, tile, onOpen}: {p: ViewProps; w: number; h: number; whole?: boolean; tile?: boolean; onOpen?: () => void}) {
  const v = p.v
  const box: Box = tile ? {x: 6, y: 6, w: w - 12, h: h - 12} : {x: 6, y: 16, w: w - 12, h: whole ? 88 : 94}
  const layout = layoutOf(v), place = strOf(v, 'place'), anchor = strOf(v, 'anchor')
  const mark = layout ? grid(layout === 'editorial', box, !whole) : undefined
  const lock = st(p, 'layout').disabled
  const sheet = <g onClick={onOpen} style={{cursor: onOpen ? 'pointer' : undefined}}><Sheet v={v} {...box} small={!whole} /></g>
  const mid = box.x + box.w / 2
  return <g>
    {!tile && <text x={6} y={11} className={strOf(v, 'subject') ? 'dp-ink' : 'dp-ink-dim'}>{tag(subjectName(v), whole ? 24 : 12)}</text>}
    {sheet}
    {!tile && mark && <Handle x={mark.markCx} y={mark.markCy} n={1} shape="ring" label="Layout" tone="accent"
      does={[`Drag the mark to the ${layout === 'editorial' ? 'right for Portrait' : 'left for Editorial'}. The mark stands at the right in Portrait and at the left in Editorial.`, lock].filter(Boolean).join(' ')}
      onDrag={lock ? undefined : px => p.set('layout', px < mid ? 'editorial' : 'portrait')} onReset={lock ? undefined : () => p.set('layout', 'portrait')} />}
    {!tile && <OfficeCells p={p} x={6} y={whole ? 110 : 116} cw={whole ? 24 : 22} />}
    {!tile && !whole && place && <g data-i={`Place · ${place}|The page stands at this place in your world.`}><Pin x={124} y={131} on /></g>}
    {!tile && whole && <g>
      {place === undefined
        ? <text x={112} y={122} className="dp-axis">{NONE}</text>
        : place
          ? <g data-i={`Place · ${place}|The page stands at this place in your world.`}><Pin x={118} y={124} on /><text x={125} y={122} className="dp-ink-dim">{short(placeName(v) ?? place, 12)}</text></g>
          : <text x={112} y={122} className="dp-axis">No place</text>}
      <text x={6} y={139} className={anchor ? 'dp-ink-dim' : 'dp-axis'}>{short(anchorLine(v), 30)}</text>
      <GroundSwatches p={p} x={160} y={134} />
    </g>}
  </g>
}

// ---------------------------------------------------------------- the pane: the real template page

/** The template's page, in a frame. The page takes the device's Layout and Ground as its own runtime does (body[data-layout],
 * body[data-tone]), and its title. A frame from another origin keeps the template as it was made. Where the shell draws the page
 * itself there is no template root, and no frame. */
function BeingsPane({v}: {v: V}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const layout = layoutOf(v), ground = groundOf(v), title = titleOf(v)
  const apply = () => {
    try {
      const doc = frame.current?.contentDocument
      if (!doc?.body) return
      if (layout) {
        doc.body.dataset.layout = layout
        const select = doc.getElementById('page-layout')
        if (select instanceof HTMLSelectElement) select.value = layout
      }
      if (ground) {
        doc.body.dataset.tone = ground
        const select = doc.getElementById('page-tone')
        if (select instanceof HTMLSelectElement) select.value = ground
      }
      const heading = doc.querySelector<HTMLElement>('[data-field="title"]')
      if (heading && title) heading.textContent = title
    } catch { /* the template keeps its own look */ }
  }
  useEffect(apply, [layout, ground, title])
  const root = cradleDocuments()
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{title === undefined ? NONE : title || 'Beings'}</button>
    </div>
    {root && <iframe ref={frame} className="ref-pane-frame" title="The Beings page, as its template draws it" src={`${root}/oi-beings.html`} onLoad={apply} />}
  </div>
}

// ---------------------------------------------------------------- the controls

function KindRadio({p}: {p: ViewProps}) {
  return <Radio {...st(p, 'kind')} label="Kind" does="Person or agent. It sets which beings the Subject lists." value={strOf(p.v, 'kind') ?? ''} options={KINDS} onChange={x => setKind(p, x)} />
}
function LayoutRadio({p}: {p: ViewProps}) {
  return <Radio {...st(p, 'layout')} label="Layout" does="Where the mark stands: at the right, or at the left." value={strOf(p.v, 'layout') ?? ''} options={LAYOUTS} stack onChange={x => p.set('layout', x)} />
}
function GroundRadio({p}: {p: ViewProps}) {
  return <Radio {...st(p, 'ground')} label="Ground" does="Dark ink on light paper, or light ink on dark ground." value={strOf(p.v, 'ground') ?? ''} options={GROUNDS} stack onChange={x => p.set('ground', x)} />
}

/** A Chooser on a key, with its choices from the owner's list under `list`. A key that is absent draws "—", not None. With no list
 * from the owner the Chooser stands disabled and says so. */
function Pick({p, k, list, label, does, noun, byKind}: {p: ViewProps; k: string; list: string; label: string; does: string; noun: string; byKind?: boolean}) {
  const offers = offersOf(p.v, list), value = strOf(p.v, k), stand = st(p, k)
  return <Chooser {...stand} {...(offers || stand.disabled ? {} : {disabled: `No reading of the ${noun}.`})} label={label} does={does}
    value={value ?? NONE} options={optionsFor(offers, value, byKind ? strOf(p.v, 'kind') : undefined)} onChange={x => p.set(k, x)} />
}
const SubjectChooser = ({p}: {p: ViewProps}) => <Pick p={p} k="subject" list="subjects" label="Subject" does="The being that the page is about." noun="subjects" byKind />
const PlaceChooser = ({p}: {p: ViewProps}) => <Pick p={p} k="place" list="places" label="Place" does="Where the being stands in your world. An empty place stays empty." noun="places" />

/** The sources as rows: the file, and the short digest of the revision the page read. The square drops a source, when the owner can. */
function sourceRows(v: V, why: string | undefined): RowItem[] {
  const rows = sourcesOf(v)
  if (!rows) return [{id: 'absent', name: 'No reading', light: 'unknown', does: 'No reading of the sources the page rests on.'}]
  if (!rows.length) return [{id: 'none', name: 'No source yet', light: 'unknown', does: 'The page rests on no source. Add the file you select in the browser.'}]
  return rows.map(s => ({id: s.ref, name: s.name, light: 'lit' as const, tone: 'value' as const, request: true, mark: <KindMark kind="source" size={11} />,
    note: s.rev ? `:${s.rev.slice(0, 7)}` : undefined, does: `${s.ref}${s.rev ? ` at revision :${s.rev}` : ''}. ${why ?? 'Press the square to drop it.'}`}))
}

export const design: DesignedDevice = {
  id: 'central:beings',
  title: 'Beings',
  kind: 'instrument',
  defaults: {
    light: 'lit', world: 'project:Archetypal-Earth', kind: 'person', subject: 'jung', o1: false, o2: true, o3: false, o4: true,
    expression: '', place: 'Archetypal-Earth', anchor: 'zurich', layout: 'portrait', ground: 'paper',
    // The owner's lists.
    worlds: JSON.stringify([{value: 'control:root', label: 'Your world'}, {value: 'project:Archetypal-Earth', label: 'Archetypal-Earth'},
      {value: 'project:O-I', label: 'O-I'}, {value: 'project:face-rig', label: 'face-rig'}, {value: 'project:ai-kit', label: 'ai-kit'}]),
    subjects: JSON.stringify([{value: 'jung', label: 'C. G. Jung', kind: 'person'}, {value: 'cairn', label: 'Cairn', kind: 'agent'},
      {value: 'flint', label: 'Flint', kind: 'agent'}, {value: 'kite', label: 'Kite', kind: 'agent'}, {value: 'lilt', label: 'Lilt', kind: 'agent'}]),
    expressions: JSON.stringify(['sf1-walk']),
    places: JSON.stringify(['Archetypal-Earth', 'O-I', 'face-rig', 'ai-kit']),
    anchors: JSON.stringify([
      {value: 'giza', label: 'Giza', lat: 30.0273, lon: 31.2076, precision: 'exact'},
      {value: 'athens', label: 'Athens', lat: 37.947, lon: 23.7406, precision: 'exact'},
      {value: 'jerusalem', label: 'Jerusalem', lat: 31.7534, lon: 35.1301, precision: 'exact'},
      {value: 'eleusis', label: 'Eleusis', lat: 38.0659, lon: 23.4693, precision: 'exact'},
      {value: 'palenque', label: 'Palenque', lat: 17.552, lon: -92.0459, precision: 'exact'},
      {value: 'chartres', label: 'Chartres', lat: 48.9317, lon: 2.3696, precision: 'exact'},
      {value: 'zurich', label: 'Zürich', lat: 47.3015, lon: 8.6075, precision: 'exact'},
      {value: 'taos', label: 'Taos', lat: 36.4786, lon: -105.5844, precision: 'exact'},
      {value: 'australia', label: 'Central Australia', lat: -24.5508, lon: 133.4689, precision: 'region'},
    ]),
    // Readings: what the page holds, never set from here.
    title: 'C. G. Jung', sections: 3, links: 2, template: 'Beings v0.1.0',
    sources: JSON.stringify([
      {name: 'README.md', ref: 'central:source:project:Archetypal-Earth:README.md', rev: 'e3273bc0d9af'},
      {name: 'AGENTS.md', ref: 'central:source:project:Archetypal-Earth:AGENTS.md', rev: '129e7a05280c'},
    ]),
  },
  fixtures: {
    Person: {},
    Agent: {
      kind: 'agent', subject: 'cairn', world: 'control:root', title: 'Cairn', o4: false, place: '', anchor: '', sections: 2, links: 1,
      sources: JSON.stringify([
        {name: 'cairn/self.md', ref: 'central:source:control:root:Control/self/agents/cairn/self.md', rev: '6de8f15e4c97'},
        {name: 'relational-logos.md', ref: 'central:source:control:root:Control/self/agents/relational-logos.md', rev: '454bfbd1e47a'},
      ]),
    },
    'Blank page': {world: '', kind: 'person', subject: '', title: '', o4: false, place: '', anchor: '', sections: 1, links: 0, sources: JSON.stringify([])},
    'Ink, editorial': {layout: 'editorial', ground: 'ink', expression: 'sf1-walk'},
    'No readings': Object.fromEntries(['light', 'world', 'kind', 'subject', 'o1', 'o2', 'o3', 'o4', 'expression', 'place', 'anchor', 'layout', 'ground', 'worlds', 'subjects',
      'expressions', 'places', 'anchors', 'title', 'sections', 'links', 'template', 'sources'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Beings" light={light(p)} readings={[titleTag(p.v, 9), tag(worldName(p.v), 9)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Beings" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page" corner={tag(worldName(p.v), 11)}
        does="The page as its template draws it. Drag handle 1 to move the mark. Click an office to take it up or lay it down.">
        <Preview p={p} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <LayoutRadio p={p} />
      <GroundRadio p={p} />
      {span(2, <PlaceChooser p={p} />)}
      {span(2, <SubjectChooser p={p} />)}
    </Section>
  </Panel>,

  whole: p => {
    const drop = st(p, 'dropSource').disabled
    return <Panel title="Beings" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The page" corner={tag(worldName(p.v), 16)}
            does="The page as its template draws it, with its offices, place and anchor. Drag handle 1 to move the mark and handle 2 to set the ground.">
            <Preview p={p} w={194} h={146} whole />
          </Display>
        </Section>
        <Section label="Page" cols={2} grow>
          {span(2, <Pick p={p} k="world" list="worlds" label="World" does="The world that the page belongs to." noun="worlds" />)}
          {span(2, <KindRadio p={p} />)}
          {span(2, <Readout label="template" does="The template that draws the page, at the version the page opened with." value={strOf(p.v, 'template')} />)}
        </Section>
        <Section label="Look" width={62}>
          <LayoutRadio p={p} />
          <GroundRadio p={p} />
        </Section>
      </Band>
      <Band>
        <Section label="Ties" cols={2} width={112}>
          {span(2, <SubjectChooser p={p} />)}
          {OFFICES.map(o => {
            const key = `o${o.n}`, now = boolOf(p.v, key), stand = st(p, key)
            return <Toggle key={o.n} {...stand} label={o.name} on={now === true} unknown={now === undefined} onChange={x => setOffice(p, o.n, x)} tone="value"
              does={`Office ${o.n}: the page takes up the ${o.name} office.`}
              disabled={stand.disabled ?? (now === true && officesOn(p.v).length <= 1 ? 'The page keeps at least one office.' : undefined)} />
          })}
          {span(2, <Pick p={p} k="expression" list="expressions" label="Expression" does="The Expression that the page shows between its opening and its sections." noun="Expressions" />)}
        </Section>
        <Section label="Sources" width={158}>
          <Rows items={sourceRows(p.v, drop)} size={3} does="The files that the page rests on, each at the revision you read."
            onRequest={drop ? undefined : id => p.set('dropSource', id)} />
          <Action {...st(p, 'addSource')} label="Add" does="Add the file that you select in the browser, at its present revision." onPress={() => p.set('addSource', true)} />
        </Section>
        <Section label="Place" cols={2} grow>
          {span(2, <PlaceChooser p={p} />)}
          {span(2, <Pick p={p} k="anchor" list="anchors" label="Anchor" does="The real place on Earth that the page is tied to." noun="anchors" />)}
          <Readout label="lat" does="The latitude of the anchor." value={latOf(p.v)} />
          <Readout label="lon" does="The longitude of the anchor." value={lonOf(p.v)} />
          <Readout label="precision" does="How sure the place is, as its source states it: exact or region." value={anchorOf(p.v)?.precision} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <BeingsPane v={p.v} />,

  widget: p => {
    const known = OFFICES.some(o => boolOf(p.v, `o${o.n}`) !== undefined)
    return <Tile title={`Beings · ${titleTag(p.v, 14)}`} light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={112} h={104} label="The page" does="The page you hold. Click it to open the page.">
        <Preview p={p} w={112} h={104} tile onOpen={p.nav.full} />
      </Display>
      <div className="ref-tile-side">
        <Readout label="world" does="The world that the page belongs to. Click to open the page." value={worldName(p.v, 'none')} onPress={p.nav.full} />
        <Readout label="place" does="Where the being stands in your world." value={placeName(p.v, 'none')} />
        <Readout label="offices" does="The subject offices that the page takes up." value={known ? officesOn(p.v).map(o => o.n).join(' · ') || 'none' : undefined} tone="value" />
      </div>
    </Tile>
  },
}
