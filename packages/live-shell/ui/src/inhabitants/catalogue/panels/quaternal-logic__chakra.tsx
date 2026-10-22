// Chakra (manual §22.5): the seven centres of the body and what the sky does to each, counted by route. Live's nearest: a rack's
// chain list, its picture its rows; here the seven centres stand as a column from the Root to the Crown with the Earth under the Root.
// The display law is the count: a centre's hits are its routes, each counted once — its own planets (the owner's planet-to-centre
// route), the decan rulers that reach it, the Sun (which reaches all seven), and the Earth (which grounds the Root). Each hit stands
// in its route's column; a disc is as bright as its hits. Turn a route off and its column and its hits go dark. No centre shows a
// value that has no route.
//
// Owners, keyed on their paths:
//   centres       Quaternal Logic's centres (`ql.scene/v1` `centres[7]`, `ql scene compose|world`, reaching the shell in the kernel's
//                 prepare_world): [{ordinal 1..7, ref '#2-5-0/1-n', name, element, mantra, petals, own: [bodies], decan: [bodies]}];
//                 own is `receiving`, the owner's planet_chakra_route (crates/ql-mef/src/m2.rs: Sun 7, Moon 6, Mercury 5, Venus 4,
//                 Mars 3, Jupiter 2, Saturn 1, Neptune 6, Pluto 7, Uranus none); decan the nara decan reception's
//                 decan_ruler_chakra_route; name, mantra and petals the M2 sky map (fixtures/kernel/m2-sky-v1.json).
//   natal.counts  the birth sky's spread over the centres (`ql.nara-natal-composition/v1`, kernel op nara_identity): seven counts. Private.
//   epoch         the date of the sky the routes follow (the Sky's).
// View, the routes shown, the colour source and the detail are the view's own. The entry's Privacy has no owner operation (the
// personal layer is the private Nara identity; nothing shares it), so it is not offered: the layer reads private.
//
// The Chakra is M4′'s face (manual §22.5, §16.16), so its Rack page holds M4′'s rack (the rack kit, map-rack.tsx, which
// the Torus, the Sky and the M3 clock carry too): the identity matrix at 0, Epii's integration at 5, and the four working parts between
// them, on the keys rack and rack.part.
import {Band, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {RACK_M4, RackBands} from './map-rack'
import './quaternal-logic__chakra.css'

type V = ViewProps['v']

const VS = '︎'
const GLYPH: Record<string, string> = {Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇'}
const ROUTES = [{key: 'route.own', label: 'Own planet', short: 'own', does: 'The planets whose own route reaches the centre.'},
  {key: 'route.decan', label: 'Decan ruler', short: 'decan', does: 'The planet that rules the part of the sky where a body stands.'},
  {key: 'route.sun', label: 'Sun reception', short: '☉', does: 'The Sun, which reaches all seven centres.'},
  {key: 'route.earth', label: 'Earth grounding', short: '⊕', does: 'The Earth, which grounds the Root.'}] as const
const VIEWS = [{value: 'rows', label: 'Seven rows', does: 'The seven centres as rows.'}, {value: 'figure', label: 'Body figure', does: 'The seven centres on the body.'}] as const
const COLOURS = [{value: 'element', label: 'Element', does: 'Element palette: colour each centre by its element.'}, {value: 'sky', label: 'Sky arc', does: 'Sky arc colour: colour each centre by its hits alone.'}] as const
/** The elements' own colours: a colour of the material, inside the display only. */
const ELEMENT_COLOUR: Record<string, string> = {Earth: '#b08d57', Water: '#4f8fbf', Fire: '#d9603b', Air: '#6fbf73', Space: '#7f8fd9', Beyond: '#9a7fd1', 'Beyond all': '#d6c9f0'}
const f1 = (x: number) => x.toFixed(1)

interface Centre {readonly ordinal: number; readonly name: string; readonly element: string; readonly mantra: string; readonly petals: number | undefined; readonly own: string[]; readonly decan: string[]}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const names = (x: unknown) => (Array.isArray(x) ? x.filter((b): b is string => typeof b === 'string') : [])
function centresOf(v: V): Centre[] | undefined {
  const raw = json<unknown>(v, 'centres', undefined)
  if (!Array.isArray(raw)) return undefined
  const out = raw.flatMap((e): Centre[] => rec(e) && Number.isInteger(e.ordinal) && (e.ordinal as number) >= 1 && (e.ordinal as number) <= 7
    ? [{ordinal: e.ordinal as number, name: String(e.name ?? ''), element: String(e.element ?? ''), mantra: String(e.mantra ?? ''), petals: Number.isInteger(e.petals) ? e.petals as number : undefined,
      own: names(e.own), decan: names(e.decan)}] : [])
  return out.length ? out.sort((a, b) => a.ordinal - b.ordinal) : undefined
}
const on = (v: V, key: string) => boolOf(v, key) !== false
/** A centre's hits: each route that is on, counted once for each source it brings. */
const hitsOf = (v: V, c: Centre) => (on(v, 'route.own') ? c.own.length : 0) + (on(v, 'route.decan') ? c.decan.length : 0) + (on(v, 'route.sun') ? 1 : 0) + (on(v, 'route.earth') && c.ordinal === 1 ? 1 : 0)
const natalOf = (v: V) => { const n = json<unknown>(v, 'natal.counts', undefined); return Array.isArray(n) && n.length === 7 && n.every(x => typeof x === 'number') ? n as number[] : undefined }
const colourOf = (v: V, c: Centre) => (strOf(v, 'colour') === 'sky' ? 'var(--dp-value)' : ELEMENT_COLOUR[c.element] ?? 'var(--dp-value)')

/** The centres: a column from the Root (foot) to the Crown (top), the Earth under the Root; the routes' hits in four columns to the right.
 * Handles 1 to 4 stand on the route columns: drag one down to hide its route, up to show it. */
function Centres({p, w, h, handles, big}: {p: ViewProps; w: number; h: number; handles: boolean; big: boolean}) {
  const v = p.v, cs = centresOf(v), figure = strOf(v, 'view') === 'figure', natal = boolOf(v, 'natal') === true ? natalOf(v) : undefined
  const top = handles ? 26 : big ? 22 : 12, earthH = big ? 26 : 14, step = (h - top - earthH - 4) / 7, cx = figure ? w / 2 : big ? 70 : 20
  const y = (ordinal: number) => top + (7 - ordinal + .5) * step, rMax = Math.min(step * .42, big ? 18 : 8)
  const colX = (k: number) => (big ? 240 : 40) + k * (big ? 70 : (w - 46) / 4)
  const max = cs ? Math.max(1, ...cs.map(c => hitsOf(v, c))) : 1
  if (!cs) return <g>
    {Array.from({length: 7}, (_, i) => <circle key={i} cx={cx} cy={y(i + 1)} r={rMax * .6} className="dp-faint" />)}
    <text x={figure ? w / 2 : cx + 18} y={h / 2} textAnchor={figure ? 'middle' : 'start'} className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the centres'}</text>
  </g>
  return <g>
    {figure && <g className="dp-faint">
      <circle cx={cx} cy={top + step * .6} r={step * .65} fill="none" />
      <path d={`M${f1(cx - step * .9)} ${f1(top + step * 1.6)}Q${f1(cx - step * 1.4)} ${f1(top + step * 4.5)} ${f1(cx - step * .8)} ${f1(top + step * 7)}H${f1(cx + step * .8)}Q${f1(cx + step * 1.4)} ${f1(top + step * 4.5)} ${f1(cx + step * .9)} ${f1(top + step * 1.6)}Z`} fill="none" />
    </g>}
    <path d={`M${cx} ${f1(y(7))}V${f1(y(1))}`} className="dp-faint" />
    {/* the Earth: under the Root, grounding it; not an eighth centre */}
    <path d={`M${f1(cx - rMax)} ${f1(y(1) + step * .5 + earthH * .5)}H${f1(cx + rMax)}`} stroke="var(--dp-value-dim)" strokeWidth={2} />
    {big && <text x={cx + rMax + 8} y={y(1) + step * .5 + earthH * .5 + 4} className="dp-axis">Earth</text>}
    {!figure && ROUTES.map((r, k) => <g key={r.key} opacity={on(v, r.key) ? 1 : .3}>
      <text x={colX(k)} y={handles ? 9 : top - 6} textAnchor="middle" className="dp-axis" style={{fontSize: big ? 11 : 7.5}}>{big ? r.label : r.short}</text>
      {handles && <Handle n={k + 1} shape="square" x={colX(k)} y={on(v, r.key) ? top - 9 : top - 3} label={`${r.label} route`}
        does={`Drag down to hide this route, up to show it. ${r.does}`} onDrag={st(p, r.key).disabled ? undefined : (_, yy) => { const show = yy < top - 6; if (show !== on(v, r.key)) p.set(r.key, show) }}
        onReset={() => p.set(r.key, true)} />}
    </g>)}
    {cs.map(c => { const hits = hitsOf(v, c), cy = y(c.ordinal), r = rMax * (.55 + .45 * hits / max), col = colourOf(v, c)
      const marks: {k: number; label: string}[] = !figure ? [
        ...(on(v, 'route.own') ? c.own.map(b => ({k: 0, label: GLYPH[b] ?? b})) : []), ...(on(v, 'route.decan') ? c.decan.map(b => ({k: 1, label: GLYPH[b] ?? b})) : []),
        ...(on(v, 'route.sun') ? [{k: 2, label: '☉'}] : []), ...(on(v, 'route.earth') && c.ordinal === 1 ? [{k: 3, label: '⊕'}] : [])] : []
      const perCol = [0, 0, 0, 0]
      return <g key={c.ordinal}>
        <circle cx={cx} cy={cy} r={r} fill={col} opacity={hits ? .25 + .75 * hits / max : .12} stroke={col} strokeWidth={1} />
        {natal && <circle cx={cx} cy={cy} r={rMax * (.5 + .5 * clampTo(0, 1, natal[c.ordinal - 1]! / Math.max(1, ...natal)))} fill="none" stroke="var(--dp-value)" strokeDasharray="2 2" />}
        <text x={cx} y={cy + (big ? 4 : 2.6)} textAnchor="middle" style={{fontSize: big ? 11 : 7, fill: 'var(--dp-well)', fontWeight: 600}}>{hits}</text>
        {big && <text x={cx + rMax + 10} y={cy - 2} className="dp-ink">{c.name}</text>}
        {big && <text x={cx + rMax + 10} y={cy + 11} className="dp-axis">{[boolOf(v, 'detail.element') !== false ? c.element : '', boolOf(v, 'detail.mantra') === true ? c.mantra : '',
          boolOf(v, 'detail.yantra') === true && c.petals !== undefined ? `${c.petals} petals` : ''].filter(Boolean).join(' · ')}</text>}
        {marks.map((m, i) => { const j = perCol[m.k]!++; return <text key={i} x={colX(m.k) + (j - .5 * ((m.k === 0 ? c.own.length : m.k === 1 ? c.decan.length : 1) - 1)) * (big ? 16 : 9)} y={cy + (big ? 5 : 3)}
          textAnchor="middle" className="dp-ink chakra-glyph" style={{fontSize: big ? 14 : 8.5}}>{m.label + VS}</text> })}
      </g> })}
  </g>
}

const LIGHT_WHY = 'The Chakra has no on or off. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const most = (v: V) => { const cs = centresOf(v); if (!cs) return undefined; return cs.reduce((a, b) => (hitsOf(v, b) > hitsOf(v, a) ? b : a)) }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateWord = (v: V) => { const t = Date.parse(strOf(v, 'epoch') ?? ''); if (!Number.isFinite(t)) return undefined; const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` }
const DISPLAY_DOES = 'The seven centres from the Root to the Crown, each as bright as its hits; the hits stand in the column of their route.'

function controls(p: ViewProps) {
  const v = p.v, figure = strOf(v, 'view') === 'figure'
  return {
    view: <Radio {...st(p, 'view')} label="View" does="The form of the reading." value={strOf(v, 'view') ?? ''} options={VIEWS} stack onChange={x => p.set('view', x)} />,
    colour: <Radio {...st(p, 'colour')} label="Colour source" does="Where the colour of a centre comes from: the element palette, or the sky arc." value={strOf(v, 'colour') ?? ''} options={COLOURS} stack onChange={x => p.set('colour', x)} />,
    natal: <Toggle {...st(p, 'natal')} label="Natal" does="Natal distribution: how your birth sky spreads over the centres, as dashed rings. Only you see it." on={boolOf(v, 'natal') === true} onChange={x => p.set('natal', x)}
      disabled={st(p, 'natal').disabled ?? (natalOf(v) ? undefined : 'No birth data is saved.')} />,
    route: (i: number) => { const r = ROUTES[i]!
      return <Toggle key={r.key} {...st(p, r.key)} label={r.label} tone="value" does={`Show this route and count its hits. ${r.does}`} on={on(v, r.key)} onChange={x => p.set(r.key, x)}
        disabled={st(p, r.key).disabled ?? (figure ? 'The body figure counts every route that is on; switch to Rows to see the columns.' : undefined)} /> },
    detail: (key: string, label: string, does: string) => <Toggle {...st(p, key)} label={label} does={does} on={key === 'detail.element' ? boolOf(v, key) !== false : boolOf(v, key) === true}
      onChange={x => p.set(key, x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'quaternal-logic:chakra',
  title: 'Chakra',
  kind: 'instrument',
  defaults: {
    view: 'rows', colour: 'element', natal: false, 'route.own': true, 'route.decan': true, 'route.sun': true, 'route.earth': true, 'detail.element': true, 'detail.mantra': false, 'detail.yantra': false,
    epoch: '2026-09-28T12:00:00Z',
    // The M2 sky map's centres (fixtures/kernel/m2-sky-v1.json) with the owner's own routes (planet_chakra_route); the decan rulers as the
    // decan reception would give them for the sky of 28 Sep 2026.
    centres: JSON.stringify([
      {ordinal: 1, ref: '#2-5-0/1-1', name: 'Mūlādhāra', element: 'Earth', mantra: 'LAM', petals: 4, own: ['Saturn'], decan: ['Mars']},
      {ordinal: 2, ref: '#2-5-0/1-2', name: 'Svādhiṣṭhāna', element: 'Water', mantra: 'VAM', petals: 6, own: ['Jupiter'], decan: []},
      {ordinal: 3, ref: '#2-5-0/1-3', name: 'Maṇipūra', element: 'Fire', mantra: 'RAM', petals: 10, own: ['Mars'], decan: ['Saturn', 'Jupiter']},
      {ordinal: 4, ref: '#2-5-0/1-4', name: 'Anāhata', element: 'Air', mantra: 'YAM', petals: 12, own: ['Venus'], decan: ['Venus']},
      {ordinal: 5, ref: '#2-5-0/1-5', name: 'Viśuddha', element: 'Space', mantra: 'HAM', petals: 16, own: ['Mercury'], decan: []},
      {ordinal: 6, ref: '#2-5-0/1-6', name: 'Ājñā', element: 'Beyond', mantra: 'OM', petals: 2, own: ['Moon', 'Neptune'], decan: ['Moon']},
      {ordinal: 7, ref: '#2-5-0/1-7', name: 'Sahasrāra', element: 'Beyond all', mantra: 'silence', petals: 1000, own: ['Sun', 'Pluto'], decan: ['Sun']}]),
    'natal.counts': JSON.stringify([2, 1, 3, 2, 1, 1, 2]),
    // M4′'s rack, read from the M registry at revision c211a781 with the ledger's rungs; the parts carried as §16.16 and §24 name them.
    rack: RACK_M4, 'rack.part': '1',
  },
  firstPage: 'centres',
  fixtures: {
    'The sky of 28 Sep 2026': {},
    'Own routes only, on the body': {'route.decan': false, 'route.sun': false, view: 'figure', natal: true},
    'Mantra and yantra': {'detail.mantra': true, 'detail.yantra': true, colour: 'sky'},
    'No reading': {centres: undefined, 'natal.counts': undefined, epoch: undefined, reason: 'No centres reach the shell', rack: undefined, 'rack.part': undefined},
  },

  folded: p => { const m = most(p.v)
    return <Folded title="Chakra" light="unknown" readings={[m ? m.name : NONE, m ? `${hitsOf(p.v, m)} hits` : NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p)
    return <Panel title="Chakra" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The centres" does={`${DISPLAY_DOES} Drag a handle down to hide its route.`}>
          <Centres p={p} w={140} h={146} handles big={false} />
        </Display>
      </Section>
      <Section label="Macros" cols={2} width={124}>{c.view}{c.colour}{c.route(1)}{c.natal}</Section>
    </Panel> },

  whole: p => { const c = controls(p), m = most(p.v), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 640, 300)) : 186, page = p.page === 'rack' ? 'rack' : 'centres'
    return <Panel title="Chakra" view="whole" {...head(p)} pages={[{id: 'centres', label: 'Centres'}, {id: 'rack', label: 'Rack'}]} page={page} onPage={p.setPage}>
      {page === 'rack' ? <RackBands p={p} /> : <>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The centres" does={`${DISPLAY_DOES} Drag handles 1 to 4 down to hide a route, up to show it.`}>
            <Centres p={p} w={w} h={146} handles big={false} />
          </Display>
        </Section>
        <Section label="Sky" width={88}>{[0, 1, 2, 3].map(c.route)}</Section>
        <Section grow>{c.view}{c.colour}</Section>
      </Band>
      <Band>
        <Section label="Detail" width={76}>
          {c.detail('detail.element', 'Element', 'Show each centre\'s element.')}{c.detail('detail.mantra', 'Mantra', 'Show each centre\'s mantra.')}{c.detail('detail.yantra', 'Yantra', 'Show each centre\'s yantra, by its petals.')}
        </Section>
        <Section label="Reading" cols={2} grow>
          <Readout big label={m ? `hits · ${m.name}` : 'hits'} does="The centre with the most hits, and how many." value={m ? hitsOf(p.v, m) : undefined} tone="value" />
          <Readout label="date" does="The sky that reaches the centres. It follows the Sky." value={dateWord(p.v)} />
          <Readout label="hits" does="How much each route counts: every route counts once. Routes are counted, not weighted." value="one per route" />
        </Section>
        <Section label="Personal" width={80}>{c.natal}<Readout label="layer" does="Your personal layer is your private Nara identity: nothing shares it." value="private" /></Section>
      </Band>
      </>}
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The seven centres">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Centres p={{...p, set: () => {}}} w={760} h={410} handles={false} big />
        <text x={742} y={404} textAnchor="end" className="dp-axis">{dateWord(p.v) ? `the sky of ${dateWord(p.v)} · each route counts once` : 'no sky'}</text>
      </g>
    </svg>
  </div>,

  widget: p => { const cs = centresOf(p.v)
    return <Tile title="Chakra" light="unknown" onFull={p.nav.full}>
      <Display w={124} h={100} label="The centres" does="The seven centres, Root at the left, each as bright as its hits, with its own planet under it. Press ▦ to open the Chakra in the pane that has focus.">
        {cs ? cs.map((c, i) => { const x = 10 + i * 17, hits = hitsOf(p.v, c), max = Math.max(1, ...cs.map(cc => hitsOf(p.v, cc)))
          return <g key={c.ordinal}>
            <circle cx={x + 2} cy={40} r={4 + 3.5 * hits / max} fill={colourOf(p.v, c)} opacity={.25 + .75 * hits / max} stroke={colourOf(p.v, c)} />
            <text x={x + 2} y={66} textAnchor="middle" className="dp-ink chakra-glyph" style={{fontSize: 10}}>{(GLYPH[c.own[0] ?? ''] ?? '·') + VS}</text>
            <text x={x + 2} y={80} textAnchor="middle" className="dp-axis">{hits}</text>
          </g> }) : <text x={62} y={52} textAnchor="middle" className="dp-ink-dim">{NONE}</text>}
      </Display>
    </Tile> },
}
