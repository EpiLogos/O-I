// The Beings (manual §18.4): a Central page about a person or an agent, tied to its world, its subject, its offices, its sources and
// its places. Live's nearest: a device that draws its material, as Simpler draws its sample. The picture is the page as the Beings
// template draws it (desktop/cradle/documents/oi-beings.html): the same 12-column grid, the mark at the right (Portrait) or at the
// left (Editorial), the paper or ink tokens, the Expression block between the opening and the sections, the side list In relation.
// The ties are the `bindings` of its oi.page/v1 island (desktop/cradle/src/personal/page.mjs validatePage): worldRef, subjectRef,
// categories (the offices C1–C4, at least one, default C2), expressionRef and sources (each a ref at a revision). Layout and Ground are
// its `appearance.layout` and `appearance.tone`, the same two settings that the Document device sets (central__document.tsx).
// The readings are real: the agents are those of Control/self/agents, the sources are files at their sha-256 digests, the anchors are
// occurrences of the Archetypal Earth field (atlas-earth__globe-engine.tsx PLACES; field.json).
import {useEffect, useRef, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {KindMark} from '../../sdk/marks'
import {on, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type SetFn = ViewProps['set']

// ---------------------------------------------------------------- what the owner offers

/** The worlds a page can belong to: the personal Control tree and each project (central-ground-keeping: control:root, project:{id}). */
const WORLDS: readonly Option<string>[] = [
  {value: '', label: 'None'}, {value: 'control:root', label: 'Your world'}, {value: 'project:Archetypal-Earth', label: 'Archetypal-Earth'},
  {value: 'project:O-I', label: 'O-I'}, {value: 'project:face-rig', label: 'face-rig'}, {value: 'project:ai-kit', label: 'ai-kit'},
]
/** The agents of Central (Control/self/agents); the roster reads them (central.agent-profile-roster/v1). */
const AGENTS: readonly Option<string>[] = [
  {value: 'cairn', label: 'Cairn'}, {value: 'flint', label: 'Flint'}, {value: 'kite', label: 'Kite'}, {value: 'lilt', label: 'Lilt'},
]
const PEOPLE: readonly Option<string>[] = [{value: 'jung', label: 'C. G. Jung'}]
const KINDS = [
  {value: 'person', label: 'Person', does: 'A person in your work.'},
  {value: 'agent', label: 'Agent', does: 'An agent you work with. The page reads its card from Agent identity.'},
] as const
/** The subject offices (PERSONAL-WEB.md: C1 Form, C2 Entity, C3 Process, C4 Type). The page keeps at least one. */
const OFFICES = [{n: 1, name: 'Form'}, {n: 2, name: 'Entity'}, {n: 3, name: 'Process'}, {n: 4, name: 'Type'}] as const
const EXPRESSIONS: readonly Option<string>[] = [{value: '', label: 'None'}, {value: 'sf1-walk', label: 'sf1-walk'}]
/** The places of your world: every project becomes a place (manual §17.1). */
const PLACES: readonly Option<string>[] = [
  {value: '', label: 'None'}, {value: 'Archetypal-Earth', label: 'Archetypal-Earth'}, {value: 'O-I', label: 'O-I'},
  {value: 'face-rig', label: 'face-rig'}, {value: 'ai-kit', label: 'ai-kit'},
]
/** Places on Earth, from the Archetypal Earth field: each with the precision the field states. */
const ANCHORS = [
  {value: 'giza', label: 'Giza', lat: 30.0273, lon: 31.2076, precision: 'exact'},
  {value: 'athens', label: 'Athens', lat: 37.947, lon: 23.7406, precision: 'exact'},
  {value: 'jerusalem', label: 'Jerusalem', lat: 31.7534, lon: 35.1301, precision: 'exact'},
  {value: 'eleusis', label: 'Eleusis', lat: 38.0659, lon: 23.4693, precision: 'exact'},
  {value: 'palenque', label: 'Palenque', lat: 17.552, lon: -92.0459, precision: 'exact'},
  {value: 'chartres', label: 'Chartres', lat: 48.9317, lon: 2.3696, precision: 'exact'},
  {value: 'zurich', label: 'Zürich', lat: 47.3015, lon: 8.6075, precision: 'exact'},
  {value: 'taos', label: 'Taos', lat: 36.4786, lon: -105.5844, precision: 'exact'},
  {value: 'australia', label: 'Central Australia', lat: -24.5508, lon: 133.4689, precision: 'region'},
] as const
const ANCHOR_OPTIONS: readonly Option<string>[] = [{value: '', label: 'None'}, ...ANCHORS.map(a => ({value: a.value, label: a.label}))]
/** Files that a page can rest on, each as a source ref at the digest of its revision (central:source:<world>:<path>). */
const SOURCES = [
  {id: 's_readme', name: 'README.md', ref: 'central:source:project:Archetypal-Earth:README.md', rev: 'e3273bc0d9af'},
  {id: 's_agents', name: 'AGENTS.md', ref: 'central:source:project:Archetypal-Earth:AGENTS.md', rev: '129e7a05280c'},
  {id: 's_cairn', name: 'cairn/self.md', ref: 'central:source:control:root:Control/self/agents/cairn/self.md', rev: '6de8f15e4c97'},
  {id: 's_logos', name: 'relational-logos.md', ref: 'central:source:control:root:Control/self/agents/relational-logos.md', rev: '454bfbd1e47a'},
] as const
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

const light = (v: V) => str(v, 'light') as LightState
const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)

const subjectsOf = (kind: string): readonly Option<string>[] => [{value: '', label: 'None'}, ...(kind === 'agent' ? AGENTS : PEOPLE)]
const nameIn = (options: readonly Option<string>[], value: string) => options.find(o => o.value === value)?.label
const worldName = (v: V) => (str(v, 'world') ? nameIn(WORLDS, str(v, 'world')) : undefined)
const subjectName = (v: V) => (str(v, 'subject') ? nameIn(subjectsOf(str(v, 'kind')), str(v, 'subject')) : undefined)
const placeName = (v: V) => (str(v, 'place') ? str(v, 'place') : undefined)
const anchorOf = (v: V) => ANCHORS.find(a => a.value === str(v, 'anchor'))
const titleOf = (v: V) => str(v, 'title').trim()
const officesOn = (v: V) => OFFICES.filter(o => on(v, `o${o.n}`))
const sourcesOn = (v: V) => SOURCES.filter(s => on(v, s.id))
const degrees = (x: number, plus: string, minus: string) => `${Math.abs(x).toFixed(2)}° ${x >= 0 ? plus : minus}`

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
function setOffice(v: V, set: SetFn, n: number, next: boolean) {
  if (!next && on(v, `o${n}`) && officesOn(v).length <= 1) return
  set(`o${n}`, next)
}
function setKind(set: SetFn, kind: string) {
  set('kind', kind)
  set('subject', '')
}

// ---------------------------------------------------------------- the display: the page, as its template draws it

interface Box {readonly x: number; readonly y: number; readonly w: number; readonly h: number}

/** The template's 12-column grid on a sheet. Portrait: the mark at columns 10–12, the sections at 1–8, the side list at 10–12.
 * Editorial: the mark at 1–2, the opening at 3–12, the sections at 3–9, the side list at 11–12. */
function grid(v: V, {x, y, w}: Box, small: boolean) {
  const editorial = str(v, 'layout') === 'editorial'
  const pad = small ? 5 : 6, inner = w - pad * 2, gap = inner * 0.024, col = (inner - 11 * gap) / 12
  const colX = (i: number) => x + pad + (i - 1) * (col + gap), spanW = (n: number) => n * col + (n - 1) * gap
  const markW = Math.min(spanW(editorial ? 2 : 3), small ? 20 : 26), markX = colX(editorial ? 1 : 10), y0 = y + 5
  return {editorial, pad, inner, colX, spanW, markW, markX, y0, markCx: markX + markW / 2, markCy: y0 + 60 * (markW / 120)}
}

/** The page sheet, drawn on that grid with the template's tokens. */
function Sheet({v, x, y, w, h, small}: Box & {v: V; small?: boolean}) {
  const p = PAPER[str(v, 'ground') === 'ink' ? 'ink' : 'paper']
  const {editorial, pad, inner, colX, spanW, markW, markX, y0} = grid(v, {x, y, w, h}, !!small)
  const introX = colX(editorial ? 3 : 1), introW = spanW(editorial ? 10 : 9)
  const title = titleOf(v), size = small ? 7.5 : 8.5, pitch = small ? 8.5 : 9.5
  const lines = title ? wrap(title, Math.max(6, Math.floor(introW / (size * 0.5))), 2) : []
  const subY = y0 + pitch * 2 + 5, mastBottom = y0 + (small ? 38 : 42)
  const expression = str(v, 'expression') !== ''
  const secX = colX(editorial ? 3 : 1), secW = spanW(editorial ? 7 : 8), railX = colX(editorial ? 11 : 10), railW = spanW(editorial ? 2 : 3)
  const top = mastBottom + (expression ? (small ? 13 : 14) : 5), room = y + h - top - 2
  const rowPitch = small ? 11 : 13, rows = Math.max(0, Math.min(Math.floor(room / rowPitch), Math.max(1, Math.round(Number(v.sections) || 1))))
  const relations = Math.max(0, Math.min(Math.floor((room - 6) / 6), Math.round(Number(v.links) || 0)))
  const s = markW / 120
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={p.bg} />
    <rect x={introX} y={y0} width={introW * 0.34} height={1.2} fill={p.mid} />
    {lines.length ? lines.map((line, i) => <text key={i} x={introX} y={y0 + 10 + i * pitch} fill={p.ink} style={{font: `${size}px Charter, Georgia, serif`}}>{line}</text>)
      : [0.6, 0.36].map((f, i) => <rect key={i} x={introX} y={y0 + 5 + i * 7} width={introW * f} height={3.6} fill={p.faint} opacity={0.6} />)}
    <rect x={introX} y={subY} width={introW * 0.5} height={1.8} fill={p.mid} opacity={0.8} />
    {[0.82, 0.6].map((f, i) => <rect key={i} x={introX} y={subY + 5 + i * 3.6} width={introW * f} height={1.2} fill={p.rule} />)}
    <g fill="none" stroke={p.ink} strokeWidth={1 / Math.max(s, 0.01) * 0.7} transform={`translate(${markX} ${y0}) scale(${s})`}>
      <circle cx={47} cy={60} r={35} />
      <circle cx={73} cy={60} r={35} strokeDasharray="1 4" />
    </g>
    <rect x={x + pad} y={mastBottom} width={inner} height={0.7} fill={p.rule} />
    {expression && <g>
      <rect x={x + pad} y={mastBottom + 3} width={inner} height={small ? 8 : 9} fill={p.field} />
      <text x={x + pad + inner / 2} y={mastBottom + (small ? 9.2 : 10.2)} textAnchor="middle" fill={p.mid} style={{font: `${small ? 5.5 : 6}px var(--font-ui)`}}>{str(v, 'expression')}</text>
    </g>}
    {Array.from({length: rows}, (_, i) => <g key={i}>
      <text x={secX} y={top + 5 + i * rowPitch} fill={p.faint} style={{font: '5px var(--font-ui)'}}>{String(i + 1).padStart(2, '0')}</text>
      <rect x={secX + 8} y={top + i * rowPitch + 1} width={secW * 0.42} height={2.4} fill={p.ink} opacity={0.7} />
      <rect x={secX + 8} y={top + i * rowPitch + 6} width={secW - 8} height={1.2} fill={p.rule} />
    </g>)}
    <rect x={railX} y={top + 1} width={railW * 0.62} height={1.6} fill={p.mid} />
    {relations
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

/** The four offices as cells under the sheet: click one to take the office up or lay it down. The last one that is on stays. */
function OfficeCells({v, set, x, y, cw}: {v: V; set?: SetFn; x: number; y: number; cw: number}) {
  const last = officesOn(v).length <= 1
  return <g role="group" aria-label="Offices">
    {OFFICES.map((o, i) => {
      const cx = x + i * (cw + 3), lit = on(v, `o${o.n}`), keeps = lit && last
      return <g key={o.n} role="checkbox" aria-checked={lit} aria-label={`Office ${o.n}, ${o.name}`} tabIndex={set ? 0 : -1}
        data-i={`Office ${o.n} · ${o.name}|${keeps ? 'The page keeps at least one office.' : lit ? 'Lay this office down.' : 'The page takes up this office.'}`}
        style={{cursor: set && !keeps ? 'pointer' : 'default'}} onClick={() => set && setOffice(v, set, o.n, !lit)}
        onKeyDown={e => { if (set && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setOffice(v, set, o.n, !lit) } }}>
        <rect x={cx + 0.5} y={y + 0.5} width={cw - 1} height={15} className={lit ? 'dp-fill-on' : 'dp-faint'} style={lit ? {stroke: 'var(--dp-on)', strokeWidth: 1} : undefined} />
        <text x={cx + cw / 2} y={y + 11} textAnchor="middle" className={lit ? 'dp-ink' : 'dp-ink-dim'} style={{fontSize: 9}}>{o.n}</text>
      </g>
    })}
  </g>
}

/** The two swatches of Ground, with handle 2 on the one that is set. */
function GroundSwatches({v, set, x, y}: {v: V; set?: SetFn; x: number; y: number}) {
  const ink = str(v, 'ground') === 'ink', at = ink ? x + 15 : x
  return <g>
    {GROUNDS.map((g, i) => <g key={g.value} onClick={() => set?.('ground', g.value)} style={{cursor: set ? 'pointer' : 'default'}}>
      <rect x={x + i * 15 + 0.5} y={y + 0.5} width={11} height={9} fill={PAPER[g.value].bg} stroke={PAPER[g.value].rule} />
    </g>)}
    {set && <Handle x={at + 5.5} y={y + 5} n={2} shape="square" label="Ground" does="Drag to the paper or the ink swatch to set the ground."
      onDrag={px => set('ground', px < x + 13 ? 'paper' : 'ink')} onReset={() => set('ground', 'paper')} />}
  </g>
}

/** The well. Compact: the sheet and the offices, with the pin. Whole: the same, then the anchor and the ground. `tile`: the sheet alone. */
function Preview({v, set, w, h, whole, tile, onOpen}: {v: V; set?: SetFn; w: number; h: number; whole?: boolean; tile?: boolean; onOpen?: () => void}) {
  const box: Box = tile ? {x: 6, y: 6, w: w - 12, h: h - 12} : {x: 6, y: 16, w: w - 12, h: whole ? 88 : 94}
  const editorial = str(v, 'layout') === 'editorial', anchor = anchorOf(v), place = placeName(v)
  const mark = grid(v, box, !whole)
  const sheet = <g onClick={onOpen} style={{cursor: onOpen ? 'pointer' : undefined}}><Sheet v={v} {...box} small={!whole} /></g>
  const mid = box.x + box.w / 2
  return <g>
    {!tile && <text x={6} y={11} className={subjectName(v) ? 'dp-ink' : 'dp-ink-dim'}>{short(subjectName(v) ?? 'No subject', whole ? 24 : 12)}</text>}
    {sheet}
    {!tile && set && <Handle x={mark.markCx} y={mark.markCy} n={1} shape="ring" label="Layout" tone="accent"
      does={`Drag the mark to the ${editorial ? 'right for Portrait' : 'left for Editorial'}. The mark stands at the right in Portrait and at the left in Editorial.`}
      onDrag={px => set('layout', px < mid ? 'editorial' : 'portrait')} onReset={() => set('layout', 'portrait')} />}
    {!tile && <OfficeCells v={v} set={set} x={6} y={whole ? 110 : 116} cw={whole ? 24 : 22} />}
    {!tile && !whole && place && <g data-i={`Place · ${place}|The page stands at this place in your world.`}><Pin x={124} y={131} on /></g>}
    {!tile && whole && <g>
      {place
        ? <g data-i={`Place · ${place}|The page stands at this place in your world.`}><Pin x={118} y={124} on /><text x={125} y={122} className="dp-ink-dim">{short(place, 12)}</text></g>
        : <text x={112} y={122} className="dp-axis">No place</text>}
      <text x={6} y={139} className={anchor ? 'dp-ink-dim' : 'dp-axis'}>{anchor ? `${anchor.label} ${degrees(anchor.lat, 'N', 'S')} ${degrees(anchor.lon, 'E', 'W')}` : 'No anchor'}</text>
      <GroundSwatches v={v} set={set} x={160} y={134} />
    </g>}
  </g>
}

// ---------------------------------------------------------------- the pane: the real template page

/** The template's page, in a frame. The page takes the device's Layout and Ground as its own runtime does (body[data-layout],
 * body[data-tone]), and its title. A frame from another origin keeps the template as it was made. */
function BeingsPane({v}: {v: V}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const layout = str(v, 'layout'), ground = str(v, 'ground'), title = titleOf(v)
  const apply = () => {
    try {
      const doc = frame.current?.contentDocument
      if (!doc?.body) return
      doc.body.dataset.layout = layout
      doc.body.dataset.tone = ground
      const selects = {layout: doc.getElementById('page-layout'), tone: doc.getElementById('page-tone')}
      if (selects.layout instanceof HTMLSelectElement) selects.layout.value = layout
      if (selects.tone instanceof HTMLSelectElement) selects.tone.value = ground
      const heading = doc.querySelector<HTMLElement>('[data-field="title"]')
      if (heading && title) heading.textContent = title
    } catch { /* the template keeps its own look */ }
  }
  useEffect(apply, [layout, ground, title])
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Documents">
      <button type="button" role="tab" aria-selected="true">{title || 'Beings'}</button>
    </div>
    <iframe ref={frame} className="ref-pane-frame" title="The Beings page, as its template draws it" src={`${__CRADLE_DOCUMENTS__}/oi-beings.html`} onLoad={apply} />
  </div>
}

// ---------------------------------------------------------------- the controls

function KindRadio({p}: {p: ViewProps}) {
  return <Radio label="Kind" does="Person or agent. It sets which beings the Subject lists." value={str(p.v, 'kind')} options={KINDS} onChange={x => setKind(p.set, x)} />
}
function SubjectChooser({p}: {p: ViewProps}) {
  return <Chooser label="Subject" does="The being that the page is about." value={str(p.v, 'subject')} options={subjectsOf(str(p.v, 'kind'))} onChange={x => p.set('subject', x)} />
}
function PlaceChooser({p}: {p: ViewProps}) {
  return <Chooser label="Place" does="Where the being stands in your world. An empty place stays empty." value={str(p.v, 'place')} options={PLACES} onChange={x => p.set('place', x)} />
}
function LayoutRadio({p}: {p: ViewProps}) {
  return <Radio label="Layout" does="Where the mark stands: at the right, or at the left." value={str(p.v, 'layout')} options={LAYOUTS} stack onChange={x => p.set('layout', x)} />
}
function GroundRadio({p}: {p: ViewProps}) {
  return <Radio label="Ground" does="Dark ink on light paper, or light ink on dark ground." value={str(p.v, 'ground')} options={GROUNDS} stack onChange={x => p.set('ground', x)} />
}

/** The sources as rows: the file, and the short digest of the revision the page read. The square drops a source. */
function sourceRows(v: V): RowItem[] {
  const rows = sourcesOn(v)
  if (!rows.length) return [{id: 'none', name: 'No source yet', light: 'unknown', does: 'The page rests on no source. Add the file you select in the browser.'}]
  return rows.map(s => ({id: s.id, name: s.name, light: 'lit' as const, tone: 'value' as const, request: true, mark: <KindMark kind="source" size={11} />,
    note: `:${s.rev.slice(0, 7)}`, does: `${s.ref} at revision :${s.rev}. Press the square to drop it.`}))
}
function addSource(v: V, set: SetFn) {
  const next = SOURCES.find(s => !on(v, s.id))
  if (next) set(next.id, true)
}

export const design: DesignedDevice = {
  id: 'central:beings',
  title: 'Beings',
  kind: 'instrument',
  defaults: {
    light: 'lit', world: 'project:Archetypal-Earth', kind: 'person', subject: 'jung', o1: false, o2: true, o3: false, o4: true,
    expression: '', place: 'Archetypal-Earth', anchor: 'zurich', layout: 'portrait', ground: 'paper',
    s_readme: true, s_agents: true, s_cairn: false, s_logos: false,
    // Readings: what the page holds, never set from here.
    title: 'C. G. Jung', sections: 3, links: 2,
  },
  fixtures: {
    Person: {},
    Agent: {kind: 'agent', subject: 'cairn', world: 'control:root', title: 'Cairn', o4: false, place: '', anchor: '', s_readme: false, s_agents: false, s_cairn: true, s_logos: true, sections: 2, links: 1},
    'Blank page': {world: '', kind: 'person', subject: '', title: '', o4: false, place: '', anchor: '', s_readme: false, s_agents: false, sections: 1, links: 0},
    'Ink, editorial': {layout: 'editorial', ground: 'ink', expression: 'sf1-walk'},
  },

  folded: p => <Folded title="Beings" light={light(p.v)} readings={[short(titleOf(p.v) || 'Untitled', 9), short(worldName(p.v) ?? 'No world', 9)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Beings" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The page" corner={short(worldName(p.v) ?? 'No world', 11)}
        does="The page as its template draws it. Drag handle 1 to move the mark. Click an office to take it up or lay it down.">
        <Preview v={p.v} set={p.set} w={140} h={146} />
      </Display>
    </Section>
    <Section label="Macros" cols={2} width={128}>
      <LayoutRadio p={p} />
      <GroundRadio p={p} />
      {span(2, <PlaceChooser p={p} />)}
      {span(2, <SubjectChooser p={p} />)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Beings" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The page" corner={short(worldName(p.v) ?? 'No world', 16)}
          does="The page as its template draws it, with its offices, place and anchor. Drag handle 1 to move the mark and handle 2 to set the ground.">
          <Preview v={p.v} set={p.set} w={194} h={146} whole />
        </Display>
      </Section>
      <Section label="Page" cols={2} grow>
        {span(2, <Chooser label="World" does="The world that the page belongs to." value={str(p.v, 'world')} options={WORLDS} onChange={x => p.set('world', x)} />)}
        {span(2, <KindRadio p={p} />)}
        {span(2, <Readout label="template" does="The template that draws the page, at the version the page opened with." value="Beings v0.1.0" />)}
      </Section>
      <Section label="Look" width={62}>
        <LayoutRadio p={p} />
        <GroundRadio p={p} />
      </Section>
    </Band>
    <Band>
      <Section label="Ties" cols={2} width={112}>
        {span(2, <SubjectChooser p={p} />)}
        {OFFICES.map(o => <Toggle key={o.n} label={o.name} on={on(p.v, `o${o.n}`)} onChange={x => setOffice(p.v, p.set, o.n, x)} tone="value"
          does={`Office ${o.n}: the page takes up the ${o.name} office.`}
          disabled={on(p.v, `o${o.n}`) && officesOn(p.v).length <= 1 ? 'The page keeps at least one office.' : undefined} />)}
        {span(2, <Chooser label="Expression" does="The Expression that the page shows between its opening and its sections." value={str(p.v, 'expression')} options={EXPRESSIONS} onChange={x => p.set('expression', x)} />)}
      </Section>
      <Section label="Sources" width={158}>
        <Rows items={sourceRows(p.v)} size={3} does="The files that the page rests on, each at the revision you read."
          onRequest={(id, keep) => p.set(id, keep)} />
        <Action label="Add" does="Add the file that you select in the browser, at its present revision."
          onPress={() => addSource(p.v, p.set)} disabled={sourcesOn(p.v).length === SOURCES.length ? 'Every file offered is already a source.' : undefined} />
      </Section>
      <Section label="Place" cols={2} grow>
        {span(2, <PlaceChooser p={p} />)}
        {span(2, <Chooser label="Anchor" does="The real place on Earth that the page is tied to." value={str(p.v, 'anchor')} options={ANCHOR_OPTIONS} onChange={x => p.set('anchor', x)} />)}
        <Readout label="lat" does="The latitude of the anchor." value={anchorOf(p.v) ? degrees(anchorOf(p.v)!.lat, 'N', 'S') : undefined} />
        <Readout label="lon" does="The longitude of the anchor." value={anchorOf(p.v) ? degrees(anchorOf(p.v)!.lon, 'E', 'W') : undefined} />
        <Readout label="precision" does="How sure the place is, as its source states it: exact or region." value={anchorOf(p.v)?.precision} />
      </Section>
    </Band>
  </Panel>,

  full: p => <BeingsPane v={p.v} />,

  widget: p => <Tile title={`Beings · ${short(titleOf(p.v) || 'Untitled', 14)}`} light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The page" does="The page you hold. Click it to open the page.">
      <Preview v={p.v} w={112} h={104} tile onOpen={p.nav.full} />
    </Display>
    <div className="ref-tile-side">
      <Readout label="world" does="The world that the page belongs to. Click to open the page." value={worldName(p.v) ?? 'none'} onPress={p.nav.full} />
      <Readout label="place" does="Where the being stands in your world." value={placeName(p.v) ?? 'none'} />
      <Readout label="offices" does="The subject offices that the page takes up." value={officesOn(p.v).map(o => o.n).join(' · ')} tone="value" />
    </div>
  </Tile>,
}
