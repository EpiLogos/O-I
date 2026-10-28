// World (manual §17.2): the Earth under its star, and the same material as a graph. Live's nearest: Simpler — one display whose
// picture changes with the mode (Space or Graph), a handle on its axis, a few columns round it. Space draws the body by the atlas's
// own laws: an orthographic globe, the terminator from the Sun's subsolar point, each place by the precision grammar, and the deep-time
// window (data/time.ts timeVisibility) that fades a place in as the cursor reaches its year. Graph draws the constellation by its four
// forces (graph/forces.ts) over a real neighbourhood of the Archetypal Earth field.
//
// Owners. The Earth ⇄ Graph switch, the whole-field choice and the deep-time clock are the atlas's own, written through
// shell.setAtlasView, shell.setAtlasWholeField and shell.setAtlasCursor / AllTime / Play / Cumulative (inhabitants/ql/devices/
// atlasDevices.ts:34-51). The graph's steps, forces, relations, kinds, occurrences and sky anchors are the graph-tools rows (same file,
// :35-44). The scale is the camera's: a reading (projections/atlas/places/placesModel.ts atlasScaleOf). Aperture and View as have no
// owner yet; the panel keeps them, off, with the owner's reason (PlacesPlate.tsx:153-156). What the atlas drew over the globe stands here,
// the pane holding the material alone (O-I #762; manual §16.3 Full, "No controls"): the subject in focus with its line and its acts, the
// closes of the reading cards (Space, Focus) and the graph's display (Graph, Display), each the atlas's own control, pressed through
// `pane.press` (projections/atlas/paneChrome.ts; catalogue/panels/paneControls.tsx).
//
// Bindable: the material the picture shows is value keys, never a constant here. `places` is the JSON list of the field's occurrences,
// {id, name, lat, lon, year, precision: 'exact' | 'region', relation, what, own?}, where `own: true` marks a place that the scope names
// as its own; `sky` is the JSON {at, lon}: the instant of the snapshot and each body's ecliptic longitude by name; `graph` is the JSON
// {nodes, edges}: a node is [id, name, kind ('a' archetype, 'f' form of the field), steps from the subject, occurrences] and an edge is
// [from, to, basis ('jung', 'inferred' or 'site')]; `subject` is the id of the node the graph is drawn from. The sample readings sit
// in the defaults below. A reading that the owner does not report is never drawn: the well names it ("No reading of the places"). The
// filters that only narrow the globe (scope, whole field, relation) narrow when they are reported and leave it whole when they are not.
import {useMemo} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {WORLD_BODY_GENERATOR, WORLD_BODY_GENERATOR_VERSION, bodyDisc, isWorldBody, parseWorldBody, shoreOf, type BodyLook, type WorldBodyRecord} from '../../../projections/atlas/src/globe/body'
import {discPngUrl} from '../../../projections/atlas/body/discPng'
import {providerLabels} from '../../../projections/atlas/src/data/labels'
import {PaneControls, paneControlsOf, paneReadings, paneTitle} from './paneControls'
import './atlas-earth__globe-engine.css'

type V = ViewProps['v']
type Put = ViewProps['set']
type Stands = ViewProps['standing']
type Size = 'tile' | 'compact' | 'whole' | 'big'

// ---------------------------------------------------------------- the deep-time scale (data/time.ts createTimeScale)

/** The field's years (field.json meta.yearMin and yearMax) and the scale's knots: ancient years squeezed, 0 to 1959 stretched. */
const YEAR_MIN = -10000, YEAR_MAX = 1959
const KNOTS: readonly (readonly [number, number])[] = [[YEAR_MIN, 0], [-1000, .1], [0, .26], [500, .4], [1000, .55], [1500, .75], [YEAR_MAX, 1]]
const toU = (year: number): number => {
  if (year <= YEAR_MIN) return 0
  if (year >= YEAR_MAX) return 1
  let i = 1
  while (i < KNOTS.length - 1 && year > KNOTS[i]![0]) i++
  const [x0, u0] = KNOTS[i - 1]!, [x1, u1] = KNOTS[i]!
  return u0 + (u1 - u0) * (year - x0) / (x1 - x0)
}
const fromU = (u: number): number => {
  if (u <= 0) return YEAR_MIN
  if (u >= 1) return YEAR_MAX
  let i = 1
  while (i < KNOTS.length - 1 && u > KNOTS[i]![1]) i++
  const [x0, u0] = KNOTS[i - 1]!, [x1, u1] = KNOTS[i]!
  return x0 + (x1 - x0) * (u - u0) / (u1 - u0)
}
const yearText = (year: number) => (year < 0 ? `−${Math.round(-year)}` : `${Math.round(year)}`)
const uText = (u: number) => yearText(fromU(u))

const RAMP = .022, TRAIL = .17, TRAIL_CUMULATIVE = 3
const sstep = (a: number, b: number, x: number) => { const t = clampTo(0, 1, (x - a) / (b - a)); return t * t * (3 - 2 * t) }
/** How present a place at slider position u is for a cursor: it appears as the cursor reaches it and fades over the trailing window. */
const timeVisibility = (u: number, cursor: number, trail: number) => { const d = cursor - u; return sstep(0, RAMP, d) * (1 - sstep(trail * .55, trail, d)) }

/** What the window shows, as the owner reports it: all time, or the year at the cursor with its trailing window. Undefined when the
 * owner does not report the clock (the picture then names the missing reading and draws no place). */
type Occasion = {readonly all: true} | {readonly all: false; readonly cursor: number; readonly trail: number}
function occasionOf(v: V): Occasion | undefined {
  const all = boolOf(v, 'allTime'), cursor = numOf(v, 'cursor'), cumulative = boolOf(v, 'cumulative')
  if (all === true) return {all: true}
  return all === false && cursor !== undefined && cumulative !== undefined ? {all: false, cursor, trail: cumulative ? TRAIL_CUMULATIVE : TRAIL} : undefined
}
/** The year or "all time" the window stands at, or undefined when it is not reported. */
function whenOf(v: V): string | undefined {
  const all = boolOf(v, 'allTime'), cursor = numOf(v, 'cursor')
  return all === true ? 'all time' : all === false && cursor !== undefined ? yearText(fromU(cursor)) : undefined
}
const cornerOf = (v: V) => { const when = whenOf(v); return when === undefined ? NONE : when === 'all time' ? when : `year ${when}` }

// ---------------------------------------------------------------- places: real occurrences of the Archetypal Earth field

interface Place {readonly id: string; readonly name: string; readonly lat: number; readonly lon: number; readonly year: number; readonly precision: 'exact' | 'region'; readonly relation: string | null; readonly what: string; readonly own: boolean}
/** The places the owner reports (field.json occurrences: the place, its position, its year and the precision the field states; the
 * relation is the owner's, where the field's locus type gives one; `own` marks the places that a scope names as its own), or undefined
 * when it reports none. A record that cannot be read is left out. */
function placesOf(v: V): readonly Place[] | undefined {
  const raw = json<unknown>(v, 'places', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((item: unknown): Place[] => {
    if (!item || typeof item !== 'object') return []
    const o = item as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.lat !== 'number' || typeof o.lon !== 'number' || typeof o.year !== 'number') return []
    if (![o.lat, o.lon, o.year].every(Number.isFinite)) return []
    return [{id: o.id, name: o.name, lat: o.lat, lon: o.lon, year: o.year, precision: o.precision === 'region' ? 'region' : 'exact', relation: typeof o.relation === 'string' ? o.relation : null,
      what: typeof o.what === 'string' ? o.what : '', own: o.own === true}]
  })
}
/** world.ts GEOGRAPHY_RELATIONS and suiteReading.ts locusOfRelation: the narrowing a relation gives. */
const FACTUAL = ['OCCURRED_AT', 'LOCATED_IN', 'OPERATED_IN', 'TRAVELLED_TO', 'MYTH_LOCATED_AT']
const locusOf = (relation: string | null) => (relation === 'MYTH_LOCATED_AT' ? 'myth' : relation && relation !== 'LOCATED_IN' && FACTUAL.includes(relation) ? 'event' : 'placed')
const RELATIONS = [{value: 'all', label: 'All'}, {value: 'OCCURRED_AT', label: 'OCCURRED_AT'}, {value: 'LOCATED_IN', label: 'LOCATED_IN'}, {value: 'MYTH_LOCATED_AT', label: 'MYTH_LOCATED_AT'}] as const

/** How present a place is: the window, then the scope, then the relation filter — the engine's own order (engine.ts composeFilter).
 * Undefined while the window is not reported. */
function presenceOf(v: V, occasion: Occasion | undefined, place: Place): number | undefined {
  if (!occasion) return undefined
  let a = occasion.all ? 1 : timeVisibility(toU(place.year), occasion.cursor, occasion.trail)
  if (strOf(v, 'scope')) a *= place.own ? 1 : boolOf(v, 'wholeField') === true ? .07 : 0
  const relation = strOf(v, 'relation')
  if (relation !== undefined && relation !== 'all' && locusOf(place.relation) !== locusOf(relation)) a = 0
  return a
}

// ---------------------------------------------------------------- the sky: the Sun's subsolar point (sky/luminaries.ts subsolarPoint)

const D2R = Math.PI / 180
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const
type Body = (typeof BODIES)[number]
/** Mean distance from the Sun in au (the Moon from the Earth, the Sun from the Earth). */
const AU: Record<Body, number> = {Sun: 1, Moon: .00257, Mercury: .387, Venus: .723, Mars: 1.524, Jupiter: 5.203, Saturn: 9.537, Uranus: 19.19, Neptune: 30.07, Pluto: 39.48}
/** The sky the owner reports: the instant (ms) and each body's ecliptic longitude. The Sun's is required, for the terminator. */
interface Sky {readonly at: number; readonly sun: number; readonly lon: Readonly<Partial<Record<Body, number>>>}
function skyOf(v: V): Sky | undefined {
  const raw = json<unknown>(v, 'sky', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const {at, lon} = raw as {at?: unknown; lon?: unknown}
  const ms = typeof at === 'string' ? Date.parse(at) : NaN
  if (!Number.isFinite(ms) || !lon || typeof lon !== 'object') return undefined
  const out: Partial<Record<Body, number>> = {}
  for (const b of BODIES) { const x = (lon as Record<string, unknown>)[b]; if (typeof x === 'number' && Number.isFinite(x)) out[b] = x }
  return out.Sun === undefined ? undefined : {at: ms, sun: out.Sun, lon: out}
}
const gmst = (ms: number) => { const d = ms / 864e5 + 2440587.5 - 2451545; return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360 }
const obliquity = (ms: number) => { const T = (ms / 864e5 + 2440587.5 - 2451545) / 36525; return 23.439279444 - .013010214 * T }
const wrap180 = (x: number) => (((x + 180) % 360) + 360) % 360 - 180
function subsolar(sky: Sky): {lat: number; lon: number} {
  const e = obliquity(sky.at) * D2R, l = sky.sun * D2R
  return {lat: Math.asin(Math.sin(e) * Math.sin(l)) / D2R, lon: wrap180(Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / D2R - gmst(sky.at))}
}
/** Whether the Sun is read for the window: true when all time shows the sky the owner reports; false when a year stands in the window
 * (no sky is read for a year); undefined when that is not reported (no clock, or all time with no sky). */
function sunRead(v: V): boolean | undefined {
  const all = boolOf(v, 'allTime')
  return all === false ? false : all === true ? (skyOf(v) ? true : undefined) : undefined
}

// ---------------------------------------------------------------- the globe

const CAM = {lat0: 25, lon0: 55}
/** Orthographic: x right, y up, z toward the viewer, on the unit sphere seen from (lat0, lon0). */
function ortho(lat: number, lon: number) {
  const p = lat * D2R, l = (lon - CAM.lon0) * D2R, p0 = CAM.lat0 * D2R
  return {x: Math.cos(p) * Math.sin(l), y: Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l), z: Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)}
}
const f1 = (x: number) => x.toFixed(1)

function graticule(cx: number, cy: number, R: number): string {
  let d = ''
  const line = (points: readonly (readonly [number, number])[]) => {
    let pen = false
    for (const [lat, lon] of points) {
      const q = ortho(lat, lon)
      if (q.z > 0) { d += `${pen ? 'L' : 'M'}${f1(cx + R * q.x)} ${f1(cy - R * q.y)}`; pen = true } else pen = false
    }
  }
  for (const lat of [-60, -30, 0, 30, 60]) line(Array.from({length: 61}, (_, i) => [lat, -180 + i * 6] as const))
  for (let lon = -180; lon < 180; lon += 30) line(Array.from({length: 31}, (_, i) => [-90 + i * 6, lon] as const))
  return d
}

/** The night side: cells of the disc whose point lies away from the Sun. */
function nightRects(sun: {lat: number; lon: number}, cx: number, cy: number, R: number, w: number, h: number, step: number) {
  const s = ortho(sun.lat, sun.lon), out: ReactRect[] = []
  for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(h, cy + R); y += step) {
    const ym = -(y + step / 2 - cy) / R
    let start: number | null = null
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(w, Math.ceil(cx + R)) + step; x += step) {
      const xm = (x + step / 2 - cx) / R, r2 = xm * xm + ym * ym
      const dark = r2 < 1 && xm * s.x + ym * s.y + Math.sqrt(1 - r2) * s.z < 0
      if (dark && start === null) start = x
      if (!dark && start !== null) { out.push({x: start, y, w: Math.min(w, x) - start, h: step}); start = null }
    }
  }
  return out
}
interface ReactRect {x: number; y: number; w: number; h: number}

const SIZES: Record<Size, {step: number; names: boolean; font: number}> = {tile: {step: 2, names: false, font: 8}, compact: {step: 2, names: false, font: 8}, whole: {step: 2, names: true, font: 8.5}, big: {step: 3, names: true, font: 10}}

/** The ruler for the scale on the left edge: region above, body between, system below. */
const SCALE_ORDER = ['region', 'body', 'system'] as const
const scaleOf = (v: V): (typeof SCALE_ORDER)[number] | undefined => { const s = strOf(v, 'scale'); return SCALE_ORDER.find(x => x === s) }
const rulerY = (h: number, scale: (typeof SCALE_ORDER)[number]) => 22 + (h - 22 - 46) * SCALE_ORDER.indexOf(scale) / 2

/** What a picture names in its well where a reading it needs is not reported ("No reading of the places"): up to four lines. */
const gapLines = (gaps: readonly string[]) => (gaps.length > 4 ? [...gaps.slice(0, 3).map(g => `No reading of ${g}`), `and ${gaps.length - 3} more`] : gaps.map(g => `No reading of ${g}`))
function Gaps({gaps, x, y, centred, size}: {gaps: readonly string[]; x: number; y: number; centred: boolean; size: Size}) {
  if (gaps.length === 0) return null
  const lines = gapLines(gaps), top = centred ? y - (lines.length - 1) * 5.5 : y - (lines.length - 1) * 10
  return <g aria-label="Readings that are missing">
    {lines.map((t, i) => <text key={i} x={x} y={top + i * (centred ? 11 : 10)} textAnchor={centred ? 'middle' : 'start'} className="dp-ink-dim"
      style={{fontSize: size === 'tile' || size === 'compact' ? 7.5 : 8.5, paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{t}</text>)}
  </g>
}

/** A handle's words, with the host's reason where its key stands disabled. */
const said = (does: string, stand: Standing) => [does, stand.disabled].filter(Boolean).join(' ')

function SpaceArt({v, set, standing, w, h, size}: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) {
  const cfg = SIZES[size], track = size !== 'tile', usable = h - (track ? 26 : 0), cx = w / 2 + (size === 'big' ? 0 : 3), cy = usable / 2 + 2
  // while your own world's body is the one the globe shows, the binding hands its record and look and this picture is that body, drawn by the globe's own generator (the Earth's
  // places and its Sun's terminator are the Earth's, not the body's: they are not drawn over it)
  const handed = bodyOf(v, true), disc = useDisc(handed, size === 'big' ? 96 : size === 'whole' ? 64 : 40, numOf(v, 'bodyTime'))
  const scale = size === 'tile' ? 'body' : scaleOf(v), occasion = occasionOf(v), cursor = numOf(v, 'cursor'), places = placesOf(v), sky = skyOf(v), sun = sunRead(v)
  const R = scale === 'region' ? Math.min(w, usable) * 1.18 : Math.min(w, usable) * .43
  const x0 = 12, x1 = w - 12, ty = h - 17, tx = (u: number) => x0 + u * (x1 - x0)
  const toCursor = (x: number) => clampTo(0, 1, (x - x0) / (x1 - x0))
  const sel = strOf(v, 'selected'), own = (key: string): Standing => standing?.[key] ?? {}
  const gaps = [...(scale === undefined ? ['the scale'] : []), ...(occasion === undefined ? ['the year'] : []), ...(places === undefined ? ['the places'] : []),
    ...(boolOf(v, 'allTime') === true && !sky ? ['the sky'] : [])]
  const marks = scale !== undefined && scale !== 'system' && places && !disc ? places.flatMap(pl => {
    const q = ortho(pl.lat, pl.lon), a = presenceOf(v, occasion, pl)
    return a === undefined || q.z <= .03 || a < .03 ? [] : [{pl, q, a, x: cx + R * q.x, y: cy - R * q.y}]
  }) : []
  const taken: {x: number; y: number}[] = []
  const labelY = (x: number, y: number) => { let ly = y - 4; for (let i = 0; i < 6 && taken.some(t => Math.abs(t.x - x) < 70 && Math.abs(t.y - ly) < 10); i++) ly += 10; taken.push({x, y: ly}); return ly }
  const bodyAt = (b: Body, lon: number) => { const r = 8 + (Math.min(w, usable) * .46 - 8) * Math.sqrt(AU[b] / 40), a = lon * D2R; return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const }
  const night = scale !== undefined && scale !== 'system' && sky && sun === true && !disc ? nightRects(subsolar(sky), cx, cy, R, w, usable, cfg.step) : []
  const yearStand = own('cursor'), scaleStand = own('scale')
  return <>
    {scale === 'system'
      ? <g>
        {sky && sun === true && [1, 5, 10, 30].map(au => <circle key={au} cx={cx} cy={cy} r={8 + (Math.min(w, usable) * .46 - 8) * Math.sqrt(au / 40)} className="dp-faint" opacity={.5} strokeDasharray="2 3" />)}
        <circle cx={cx} cy={cy} r={size === 'big' ? 5 : 3} className="dp-fill" stroke="var(--dp-value)" />
        {sky && sun === true && BODIES.flatMap(b => {
          const lon = sky.lon[b]
          if (lon === undefined) return []
          const [x, y] = bodyAt(b, lon)
          return [<g key={b}>
            <circle cx={x} cy={y} r={b === 'Sun' ? 3.4 : 2} fill={b === 'Sun' ? 'var(--dp-on)' : 'var(--dp-value)'} />
            {cfg.names && <text x={x + 5} y={y + 3} className="dp-axis">{b}</text>}</g>]
        })}
        {sun === false && <text x={cx} y={cy - 6} textAnchor="middle" className="dp-ink-dim">No sky is read for this year.</text>}
        <text x={5} y={12} className="dp-axis">{size === 'tile' ? '' : 'from the Earth'}</text>
      </g>
      : scale !== undefined && <g>
        {disc ? <image href={disc} x={cx - R} y={cy - R} width={2 * R} height={2 * R} preserveAspectRatio="none" /> : <circle cx={cx} cy={cy} r={R} className="dp-fill" />}
        {night.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--dp-well)" opacity={.62} />)}
        <path d={graticule(cx, cy, R)} className="dp-faint" opacity={.55} />
        <circle cx={cx} cy={cy} r={R} className="dp-faint" />
        {marks.map(({pl, q, a, x, y}) => {
          const named = (size === 'big' && R > 40) || (size === 'whole' && sel === pl.id), ly = named ? labelY(x, y) : 0
          return <g key={pl.id} opacity={clampTo(.15, 1, a) * clampTo(.35, 1, q.z * 1.6)}>
            {pl.precision === 'region' ? <circle cx={x} cy={y} r={size === 'big' ? 9 : 5.5} fill="none" stroke="var(--dp-value)" strokeWidth={1.2} strokeDasharray="2 2" />
              : <circle cx={x} cy={y} r={size === 'big' ? 3.6 : 2.4} fill="var(--dp-value)" />}
            {sel === pl.id && <circle cx={x} cy={y} r={size === 'big' ? 8 : 5.5} fill="none" stroke="var(--dp-on)" strokeWidth={1.3} />}
            {named && <text x={x + 6} y={ly} className="dp-ink-dim" style={{fontSize: cfg.font}}>{pl.name}</text>}
          </g>
        })}
        {sun === false && size !== 'tile' && <text x={w - 5} y={usable - 5} textAnchor="end" className="dp-axis">no Sun read</text>}
      </g>}
    {track && <g>
      <path d={`M${x0} ${ty}H${x1}`} className="dp-faint" />
      {occasion?.all === true && <rect x={x0} y={ty - 3} width={x1 - x0} height={6} className="dp-fill" />}
      {occasion && !occasion.all && <rect x={tx(Math.max(0, occasion.cursor - occasion.trail))} y={ty - 3} width={tx(occasion.cursor) - tx(Math.max(0, occasion.cursor - occasion.trail))} height={6} className="dp-fill" />}
      {KNOTS.slice(1, -1).filter((_, i) => size !== 'compact' || i % 2 === 1).map(([year, u]) => <g key={year}>
        <path d={`M${f1(tx(u))} ${ty + 2}v3`} className="dp-faint" />
        {size !== 'compact' && [-1000, 0, 1000].includes(year) && <text x={tx(u)} y={ty + 11} textAnchor="middle" className="dp-axis" style={{fontSize: size === 'big' ? 9 : 7.5}}>{yearText(year)}</text>}</g>)}
      {places?.map(pl => <circle key={pl.id} cx={tx(toU(pl.year))} cy={ty} r={1.5} fill="var(--dp-value)" opacity={(presenceOf(v, occasion, pl) ?? 0) > .03 ? 1 : .35} />)}
      {cursor !== undefined && (set
        ? <Handle n={1} shape="ring" x={tx(cursor)} y={ty} label="Year" does={said('Drag along the line: the year in the window. Double-click to show all time.', yearStand)}
          onDrag={yearStand.disabled ? undefined : x => { set('cursor', Math.round(toCursor(x) * 1000) / 1000); set('allTime', false) }}
          onReset={yearStand.disabled ? undefined : () => { set('allTime', true); set('cursor', 1) }} />
        : <circle cx={tx(cursor)} cy={ty} r={4} fill="none" stroke="var(--dp-on)" strokeWidth={1.4} />)}
    </g>}
    {set && size === 'whole' && <g>
      <path d={`M10 22V${h - 46}`} className="dp-faint" />
      {SCALE_ORDER.map(s => <path key={s} d={`M7 ${f1(rulerY(h, s))}h6`} className="dp-faint" />)}
      {scale !== undefined && <Handle n={2} shape="square" x={10} y={rulerY(h, scale)} label="Scale" does={said('Drag along the line: region, body or system.', scaleStand)}
        onDrag={scaleStand.disabled ? undefined : (_, y) => set('scale', SCALE_ORDER[Math.round(clampTo(0, 2, (y - 22) / (h - 22 - 46) * 2))]!)} />}
    </g>}
    <Gaps gaps={gaps} size={size} centred={scale === undefined} x={scale === undefined ? cx : 5} y={scale === undefined ? usable / 2 : usable - 4} />
  </>
}

// ---------------------------------------------------------------- the graph: the neighbourhood of the subject in the field

type GNode = readonly [string, string, 'a' | 'f', number, number]
type GEdge = readonly [string, string, 'jung' | 'inferred' | 'site']
const isBasis = (x: unknown): x is GEdge[2] => x === 'jung' || x === 'inferred' || x === 'site'
/** The graph the owner reports: its forms (the kind, the steps from the subject, the occurrences) and its ties, or undefined when it
 * reports none. A node or an edge that cannot be read is left out. */
function graphOf(v: V): {nodes: GNode[]; edges: GEdge[]} | undefined {
  const raw = json<unknown>(v, 'graph', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const {nodes, edges} = raw as {nodes?: unknown; edges?: unknown}
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return undefined
  return {
    nodes: nodes.flatMap((n: unknown): GNode[] => Array.isArray(n) && typeof n[0] === 'string' && typeof n[1] === 'string' && (n[2] === 'a' || n[2] === 'f') && Number.isFinite(n[3])
      ? [[n[0], n[1], n[2], n[3] as number, Number.isFinite(n[4]) ? n[4] as number : 0]] : []),
    edges: edges.flatMap((e: unknown): GEdge[] => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string' && isBasis(e[2]) ? [[e[0], e[1], e[2]]] : []),
  }
}

const SKY_NODES = {sun: 'Sun', moon: 'Moon', saturn: 'Saturn'} as const
const DEF_FORCES = {centre: .8, repel: .8, link: 1, distance: 1.25}
const FORCE_ROWS = [
  {key: 'centre', label: 'Centre', min: .2, max: 6, does: 'How strongly the field is drawn to its heart. More gathers it together.'},
  {key: 'repel', label: 'Repel', min: .3, max: 2, does: 'How hard the forms push each other apart. More spreads the field out.'},
  {key: 'link', label: 'Link force', min: .3, max: 2.5, does: 'How hard each tie holds its two forms. More draws linked forms closer.'},
  {key: 'distance', label: 'Distance', min: .7, max: 1.8, does: 'How far apart each tie holds its two ends. More lengthens every link.'},
] as const
const TIE_WEIGHT = {jung: 1, inferred: .75, site: .5} as const
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return ((h >>> 0) % 1000) / 1000 }

type Pos = readonly [number, number]
/** The four forces of graph/forces.ts, in miniature: the pull to the heart, the push between forms, the pull along each tie and the length of a tie. */
function simulate(nodes: readonly GNode[], edges: readonly GEdge[], f: typeof DEF_FORCES, local: boolean, pinned: ReadonlyMap<string, Pos>): Map<string, Pos> {
  const p = new Map<string, [number, number]>(), vel = new Map<string, [number, number]>()
  nodes.forEach(n => {
    const a = hash(n[0]) * 6.283, r = 14 + 30 * n[3], pin = pinned.get(n[0])
    p.set(n[0], pin ? [pin[0], pin[1]] : [Math.cos(a) * r, Math.sin(a) * r]); vel.set(n[0], [0, 0])
  })
  const g = (local ? .004 : .018) * f.centre * 60, q = 90 * f.repel, k = .12 * f.link, rest = 17 * f.distance
  for (let it = 0; it < 160; it++) {
    const al = Math.max(.04, 1 - it / 160)
    for (let i = 0; i < nodes.length; i++) {
      const a = p.get(nodes[i]![0])!, va = vel.get(nodes[i]![0])!
      va[0] -= a[0] * g * al; va[1] -= a[1] * g * al
      for (let j = i + 1; j < nodes.length; j++) {
        const b = p.get(nodes[j]![0])!, vb = vel.get(nodes[j]![0])!
        const dx = a[0] - b[0], dy = a[1] - b[1], d2 = Math.max(dx * dx + dy * dy, 25), push = q / d2 * al
        va[0] += dx * push; va[1] += dy * push; vb[0] -= dx * push; vb[1] -= dy * push
      }
    }
    for (const [a, b, basis] of edges) {
      const pa = p.get(a), pb = p.get(b)
      if (!pa || !pb) continue
      const va = vel.get(a)!, vb = vel.get(b)!, dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.max(Math.hypot(dx, dy), 1), pull = (d - rest) * k * TIE_WEIGHT[basis] * al
      va[0] += dx / d * pull; va[1] += dy / d * pull; vb[0] -= dx / d * pull; vb[1] -= dy / d * pull
    }
    for (const n of nodes) {
      const a = p.get(n[0])!, va = vel.get(n[0])!, pin = pinned.get(n[0])
      if (pin) { a[0] = pin[0]; a[1] = pin[1]; va[0] = 0; va[1] = 0; continue }
      a[0] += va[0] * .6; a[1] += va[1] * .6; va[0] *= .5; va[1] *= .5
    }
  }
  return p
}

const rimL = 62
interface GraphView {
  readonly nodes: readonly GNode[]; readonly edges: readonly GEdge[]; readonly local: boolean; readonly subject: string | undefined
  readonly forces: typeof DEF_FORCES; readonly anchors: boolean; readonly dust: boolean; readonly pinned: ReadonlyMap<string, Pos>
}
/** What the graph shows: the subject's steps (when local), the kinds that are on, the ties that are on, held to the sky when it is.
 * The picture needs every reading it is laid out by; `gaps` names the ones the owner does not report (then there is no `view`). */
function readGraph(v: V): {view: GraphView | undefined; gaps: string[]} {
  const all = graphOf(v), local = boolOf(v, 'local'), depth = numOf(v, 'depth'), subject = strOf(v, 'subject'), sky = skyOf(v)
  const archetypes = boolOf(v, 'kindArchetype'), families = boolOf(v, 'kindFamily'), anchors = boolOf(v, 'skyAnchors')
  const ties = {jung: boolOf(v, 'tieJung'), inferred: boolOf(v, 'tieInferred'), site: boolOf(v, 'tieSite')}
  const centre = numOf(v, 'centre'), repel = numOf(v, 'repel'), link = numOf(v, 'link'), distance = numOf(v, 'distance')
  const gaps = [
    ...(all ? [] : ['the graph']), ...(local === undefined ? ['the neighbourhood'] : []), ...(local === true && subject === undefined ? ['the subject'] : []),
    ...(local === true && depth === undefined ? ['the steps'] : []), ...(archetypes === undefined || families === undefined ? ['the kinds'] : []),
    ...(Object.values(ties).some(t => t === undefined) ? ['the ties'] : []), ...([centre, repel, link, distance].some(x => x === undefined) ? ['the forces'] : []),
    ...(anchors === undefined ? ['the sky anchors'] : []), ...(anchors === true && !sky ? ['the sky'] : []),
  ]
  // Past the gap check every reading below is reported.
  if (gaps.length > 0 || !all) return {view: undefined, gaps}
  const tiers = {a: archetypes === true, f: families === true}, on = {jung: ties.jung === true, inferred: ties.inferred === true, site: ties.site === true}
  const nodes = all.nodes.filter(n => n[0] === subject || ((local !== true || n[3] <= depth!) && tiers[n[2]]))
  const ids = new Set(nodes.map(n => n[0]))
  const pinned = new Map<string, Pos>()
  if (anchors === true && sky) for (const [id, body] of Object.entries(SKY_NODES)) {
    const lon = sky.lon[body]
    if (lon !== undefined && ids.has(id)) { const a = lon * D2R; pinned.set(id, [rimL * Math.cos(a), -rimL * Math.sin(a)]) }
  }
  return {gaps, view: {nodes, edges: all.edges.filter(e => ids.has(e[0]) && ids.has(e[1]) && on[e[2]]), local: local === true, subject, forces: {centre: centre!, repel: repel!, link: link!, distance: distance!},
    anchors: anchors === true, dust: boolOf(v, 'occurrences') === true, pinned}}
}

function GraphArt({v, set, standing, w, h, size}: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) {
  const cfg = SIZES[size], k = Math.min(w / 186, h / 146)
  const {view, gaps} = readGraph(v), depth = numOf(v, 'depth'), stepsStand = standing?.['depth'] ?? {}
  const key = view ? [view.nodes.map(n => n[0]).join(), view.edges.map(e => `${e[0]}>${e[1]}`).join(), Object.values(view.forces).join(), view.local,
    [...view.pinned].map(([id, [x, y]]) => `${id}:${f1(x)}:${f1(y)}`).join()].join('|') : ''
  const pos = useMemo(() => (view ? simulate(view.nodes, view.edges, view.forces, view.local, view.pinned) : new Map<string, Pos>()), [key])  // eslint-disable-line react-hooks/exhaustive-deps
  let mx = 1, my = 1
  pos.forEach(([x, y]) => { mx = Math.max(mx, Math.abs(x)); my = Math.max(my, Math.abs(y)) })
  const fit = Math.min(1, (w / 2 - (size === 'big' ? 96 : 18)) / (mx * k), (h / 2 - (size === 'big' ? 22 : 14)) / (my * k)), s = k * fit, cx = w / 2 + (size === 'big' ? 0 : 6), cy = h / 2
  const at = (id: string): readonly [number, number] => { const p = pos.get(id); return p ? [cx + p[0] * s, cy + p[1] * s] : [cx, cy] }
  const r = (n: GNode) => (n[0] === view?.subject ? 4.2 : n[2] === 'a' ? 3.4 : 2.4) * (size === 'big' ? 1.7 : 1)
  const stepsY = (d: number) => 22 + (h - 22 - 30) * (d - 1) / 2
  const stepsWhy = stepsStand.disabled ?? gate(v)
  return <>
    {view && <>
      {view.anchors && <circle cx={cx} cy={cy} r={rimL * s} className="dp-faint" opacity={.5} strokeDasharray="2 3" />}
      {view.edges.map(([a, b, basis]) => { const [x1, y1] = at(a), [x2, y2] = at(b)
        return <path key={`${a}|${b}`} d={`M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`} className="dp-curve" strokeWidth={basis === 'jung' ? 1.2 : .9} opacity={basis === 'jung' ? .85 : basis === 'inferred' ? .6 : .32} strokeDasharray={basis === 'inferred' ? '3 2' : undefined} /> })}
      {view.dust && view.nodes.map(n => { const [x, y] = at(n[0]); return n[4] > 0 ? Array.from({length: Math.min(n[4], 6)}, (_, i) => { const a = (hash(n[0]) + i / 6) * 6.283
        return <circle key={`${n[0]}${i}`} cx={x + Math.cos(a) * (r(n) + 3)} cy={y + Math.sin(a) * (r(n) + 3)} r={.8} fill="var(--dp-value)" opacity={.55} /> }) : null })}
      {view.nodes.map(n => { const [x, y] = at(n[0]), pin = view.pinned.has(n[0]), subject = n[0] === view.subject
        return <g key={n[0]}>
          <circle cx={x} cy={y} r={r(n)} fill={n[2] === 'a' ? 'var(--dp-on)' : 'var(--dp-value)'} stroke={subject || pin ? 'var(--text)' : undefined} strokeWidth={1.2} />
          {(size === 'big' || (size === 'whole' && subject)) && <text x={x + r(n) + 3} y={y + 3} className="dp-ink-dim" style={{fontSize: cfg.font}}>{n[1]}</text>}
        </g> })}
      {view.anchors && Object.keys(SKY_NODES).every(id => !view.pinned.has(id)) && <text x={5} y={h - 5} className="dp-axis">no sky node in view</text>}
    </>}
    {set && size !== 'tile' && <g>
      <path d={`M10 22V${h - 30}`} className="dp-faint" />
      {[1, 2, 3].map(d => <path key={d} d={`M7 ${f1(stepsY(d))}h6`} className="dp-faint" />)}
      {depth !== undefined && <Handle n={1} shape="ring" x={10} y={stepsY(clampTo(1, 3, depth))} label="Steps" does={said('Drag along the line: how many steps from the subject the graph reaches.', {disabled: stepsWhy})}
        onDrag={stepsWhy ? undefined : (_, y) => set('depth', Math.round(clampTo(1, 3, 1 + (y - 22) / (h - 22 - 30) * 2)))} />}
    </g>}
    {view && <text x={5} y={12} className="dp-axis">{size === 'compact' || size === 'tile' ? '' : view.local ? `from ${view.nodes.find(n => n[0] === view.subject)?.[1] ?? NONE}` : 'whole field'}</text>}
    <Gaps gaps={gaps} size={size} centred x={cx} y={h / 2} />
  </>
}

// ---------------------------------------------------------------- the controls

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const NO_SCOPE = 'No mode’s set is set aside on the globe, so there is no whole-field choice to make.'
const NO_SCOPE_READ = 'No reading of the mode’s set yet.'
const NOT_LOCAL = 'Steps count from a subject, so they apply in a local graph.'
const NOT_GRAPH = 'The Graph is not a scale of the Earth.'
const NOT_OPENED = 'The constellation has not been opened in this session. Its controls stand when the Graph view is first shown.'
const NO_SUBJECT = 'Choose a subject on the Earth first: a place is declared by a subject.'
const NO_APERTURE = 'No owner opens the shared or federated field to the atlas yet.'
const NO_VIEW_AS = 'No owner discloses how the field or the public sees your world yet.'

const SCALES = [{value: 'system', label: 'System', does: 'The sky: the Earth among the Sun, the Moon and the planets.'}, {value: 'body', label: 'Body', does: 'The Earth whole.'}, {value: 'region', label: 'Region', does: 'A close view over a coast.'}] as const
const VIEWS = [{value: 'earth', label: 'Space', does: 'The bodies in space.'}, {value: 'graph', label: 'Graph', does: 'The same material, laid out by connection.'}] as const
const gate = (v: V) => (boolOf(v, 'graphOpen') === false ? NOT_OPENED : undefined)
const stepsText = (x: number) => `${x} step${x === 1 ? '' : 's'}`
const depthText = (v: V) => { const d = numOf(v, 'depth'); return d === undefined ? NONE : stepsText(d) }

/** A control's standing: the host's for its key, with this device's own reason first where it has one. */
const stand = (p: ViewProps, key: string, why?: string): Standing => ({...st(p, key), disabled: why ?? st(p, key).disabled})

/** A toggle drawn from its key: hollow when the owner has not reported it. `unknown` also hollows it where the device holds it so. */
const toggle = (p: ViewProps, key: string, label: string, does: string, extra: {why?: string; unknown?: boolean; onChange?: (on: boolean) => void} = {}) => {
  const now = boolOf(p.v, key)
  return <Toggle key={key} {...stand(p, key, extra.why)} label={label} does={does} on={now === true} unknown={extra.unknown === true || now === undefined} onChange={extra.onChange ?? (x => p.set(key, x))} />
}

const viewRadio = (p: ViewProps, stack = true) => <Radio {...stand(p, 'view')} label="View" does="Space or Graph: the same material, drawn as bodies or by connection." value={strOf(p.v, 'view') ?? ''} options={VIEWS} stack={stack} onChange={x => p.set('view', x)} />
const scaleChooser = (p: ViewProps) => <Chooser {...stand(p, 'scale', strOf(p.v, 'view') === 'graph' ? NOT_GRAPH : undefined)} label="Scale" does="How close you look: system, body or region. The camera sets it." value={strOf(p.v, 'scale') ?? ''} options={SCALES}
  onChange={x => p.set('scale', x)} />
const scaleRadio = (p: ViewProps) => <Radio {...stand(p, 'scale', strOf(p.v, 'view') === 'graph' ? NOT_GRAPH : undefined)} label="Scale" does="How close you look: system, body or region. The camera sets it." value={strOf(p.v, 'scale') ?? ''} options={SCALES} stack
  onChange={x => p.set('scale', x)} />
const timeDial = (p: ViewProps) => {
  const own = st(p, 'cursor'), clock = boolOf(p.v, 'playing') === true
  return <Dial {...own} label="Year" does="The year in the window. The globe shows the places that stand in it." value={numOf(p.v, 'cursor') ?? NaN} def={1} scale={{min: 0, max: 1}} format={uText}
    heldBy={clock ? 'the clock' : own.heldBy} onHandBack={clock ? () => p.set('playing', false) : own.onHandBack} onChange={x => { p.set('cursor', x); p.set('allTime', false) }} />
}
const allTimeToggle = (p: ViewProps) => toggle(p, 'allTime', 'All time', 'Show every place, with no window.')
const playToggle = (p: ViewProps) => toggle(p, 'playing', 'Play', 'Move the window through the years. A full sweep takes 42 seconds.', {onChange: x => { p.set('playing', x); if (x) p.set('allTime', false) }})
const cumulativeToggle = (p: ViewProps) => toggle(p, 'cumulative', 'Cumulative', 'Keep every place that the window has passed.')
const wholeToggle = (p: ViewProps) => {
  const scope = strOf(p.v, 'scope')
  return toggle(p, 'wholeField', 'Whole field', scope ? `Draw the whole field, not only ${scope}.` : 'Draw the whole field, not only the mode’s set.',
    {why: scope ? undefined : scope === undefined ? NO_SCOPE_READ : NO_SCOPE, unknown: !scope})
}

const depthDial = (p: ViewProps) => <Dial {...stand(p, 'depth', gate(p.v) ?? (boolOf(p.v, 'local') === false ? NOT_LOCAL : undefined))} label="Steps" does="How many steps from the subject the graph reaches. Three at most."
  value={numOf(p.v, 'depth') ?? NaN} def={1} scale={{min: 1, max: 3, step: 1}} format={stepsText} onChange={x => p.set('depth', x)} />
const forceDial = (p: ViewProps, row: (typeof FORCE_ROWS)[number]) => <Dial {...stand(p, row.key, gate(p.v))} key={row.key} label={row.label} does={row.does} value={numOf(p.v, row.key) ?? NaN} def={DEF_FORCES[row.key]}
  scale={{min: row.min, max: row.max}} format={x => `${(x / DEF_FORCES[row.key]).toFixed(2)}×`} onChange={x => p.set(row.key, Math.round(x * 100) / 100)} />
const flag = (p: ViewProps, key: string, label: string, does: string) => toggle(p, key, label, does, {why: gate(p.v)})

/** The places the Earth draws: shown of all the field holds, or undefined while there is no list or no clock. */
const shownCount = (v: V): string | undefined => {
  const places = placesOf(v), occasion = occasionOf(v)
  return places && occasion ? `${places.filter(pl => (presenceOf(v, occasion, pl) ?? 0) > .03).length}/${places.length}` : undefined
}
/** Lit by the Sun the sky reports, or evenly lit where no Sun is read; undefined while that is not reported. */
const dayNight = (v: V) => { const sun = sunRead(v); return sun === undefined ? undefined : sun ? 'lit' : 'even' }
/** One row for each place, its light the window's reading of it (hollow while the window is not reported). */
const placeRows = (v: V): RowItem[] => {
  const places = placesOf(v), occasion = occasionOf(v)
  if (!places) return [{id: 'none', name: 'No reading of the places', light: 'unknown'}]
  return places.map(pl => { const a = presenceOf(v, occasion, pl); return {id: pl.id, name: pl.name, light: a === undefined ? 'unknown' : a > .03 ? 'lit' : 'dark', tone: 'value', note: yearText(pl.year)} })
}

// ---------------------------------------------------------------- displays

function SpaceDisplay({v, set, standing, w, h, size}: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="The World" corner={cornerOf(v)}
    does="The Earth under its Sun. Each place stands at its position, lit or in shade. Drag handle 1 for the year and handle 2 for the scale.">
    <SpaceArt v={v} set={set} standing={standing} w={w} h={h} size={size} />
  </Display>
}
function GraphDisplay({v, set, standing, w, h, size}: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) {
  const nodes = readGraph(v).view?.nodes.length
  return <Display w={w} h={h} label="The graph" corner={nodes === undefined ? NONE : `${nodes} nodes`}
    does="The same material laid out by connection, by the four forces. Drag handle 1 for the steps from the subject.">
    <GraphArt v={v} set={set} standing={standing} w={w} h={h} size={size} />
  </Display>
}
const WorldDisplay = (props: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) => (strOf(props.v, 'view') === 'graph' ? <GraphDisplay {...props} /> : <SpaceDisplay {...props} />)

// ---------------------------------------------------------------- the body you build (manual §17.2 "Build a planet", "Your system")
//
// Owner, to be built (T-WORLDS §5): a body record per world, `aikit.world-body/v1` on the register's root space, written as a wiki-facts
// BodySet with CAS (ai-kit knowledge_wiki_facts.rs beside PlaceSet; kernel construction.rs dispatch), drawn by a pure generator through
// the Earth's texture seam (projections/atlas/src/globe/body.ts). Until it reads, the host stands these controls disabled with that reason.
// Value keys: `body` ('own' | 'earth' | 'other'), `bodyName`, `seed` (u32), `seaLevel`, `continents`, `relief`, `coast`, `warmth`,
// `moisture`, `iceCaps`, `atmosphere`, `clouds` (0–1 each but continents 0.6–3.6), `tilt` (degrees), `placeKind`, `locations` (JSON
// {id, name, lat, lon, kind}), and the act `reroll`. The picture is the globe's own body, drawn small by the globe's own generator (globe/body.ts
// bodyDisc): from `bodyRecord` and `bodyLook` (JSON: the record the globe draws and the look it draws it with, handed by the binding while your
// own world's body is the one shown), else from the settings on this page, so a person sees what each control does. `generationNote` is a line the
// binding hands when the body was built by an older generator. There is no second generator here.

const BODY_CHOICES = [{value: 'own', label: 'Your world'}, {value: 'earth', label: 'Earth'}, {value: 'other', label: 'Another world'}] as const
const COASTS = [{value: 'smooth', label: 'Smooth'}, {value: 'fjord', label: 'Fjord'}, {value: 'archipelago', label: 'Archipelago'}] as const
const PLACE_KINDS = [{value: 'place', label: 'Place'}, {value: 'palace', label: 'Palace'}, {value: 'portal', label: 'Portal'}, {value: 'route', label: 'Route'}] as const
const GIVEN = 'Earth is given: you place things on it, and its land stays as it is.'
const READ_ONLY = 'Another world’s body is its owner’s: you see what they show.'

/** The body the device draws: the record the binding hands it (values.bodyRecord, JSON) with the look it is drawn with (values.bodyLook), else, unless only a handed one will do, the record
 * these settings make (generator version current). The pictures are the globe's own generator's (bodyDisc, shoreOf): the same record gives the same body here and on the globe. */
function bodyOf(v: V, handed = false): {record: WorldBodyRecord; look: BodyLook} | undefined {
  const given = json<unknown>(v, 'bodyRecord', undefined)
  if (given !== undefined) {
    const parsed = parseWorldBody(given)
    if (isWorldBody(parsed)) return {record: parsed, look: json<BodyLook>(v, 'bodyLook', {})}
  }
  if (handed) return undefined
  const seed = numOf(v, 'seed'), sea = numOf(v, 'seaLevel'), continents = numOf(v, 'continents'), relief = numOf(v, 'relief'), coast = strOf(v, 'coast')
  const warmth = numOf(v, 'warmth'), moisture = numOf(v, 'moisture'), ice = numOf(v, 'iceCaps'), atmosphere = numOf(v, 'atmosphere'), clouds = numOf(v, 'clouds'), tilt = numOf(v, 'tilt')
  if ([seed, sea, continents, relief, warmth, moisture, ice, atmosphere, clouds, tilt].some(x => x === undefined) || !coast) return undefined
  const record = parseWorldBody({body_ref: 'body:design', seed, generator: {id: WORLD_BODY_GENERATOR, version: WORLD_BODY_GENERATOR_VERSION}, landmass: {sea_level: sea, continents, relief, coast},
    climate: {warmth, moisture, ice_caps: ice}, sky: {atmosphere, clouds, axial_tilt_deg: tilt}})
  return isWorldBody(record) ? {record, look: json<BodyLook>(v, 'bodyLook', {})} : undefined
}
/** The body's disc as a picture an SVG shows (`size` pixels across), at an occasion if there is one; kept while the record, look, size and time are the same. */
function useDisc(body: {record: WorldBodyRecord; look: BodyLook} | undefined, size: number, timeMs: number | undefined): string | undefined {
  const key = body ? JSON.stringify([body.record, body.look, size, timeMs]) : ''
  return useMemo(() => (body ? discPngUrl(bodyDisc(body.record, size, body.look, timeMs)) : undefined), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

interface Location {readonly id: string; readonly name: string; readonly lat: number; readonly lon: number; readonly kind?: string}
const locationsOf = (v: V): readonly Location[] | undefined => json<Location[] | undefined>(v, 'locations', undefined)
const unit = (lat: number, lon: number) => ({x: Math.cos(lat * D2R) * Math.cos(lon * D2R), y: Math.sin(lat * D2R), z: Math.cos(lat * D2R) * Math.sin(lon * D2R)})
function BodyArt({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const body = bodyOf(v), which = strOf(v, 'body'), cx = w / 2, cy = h / 2, R = Math.min(w, h) * .42
  const disc = useDisc(which === 'earth' ? undefined : body, size === 'big' ? 96 : size === 'whole' ? 64 : 40, numOf(v, 'bodyTime'))
  if (which === 'earth') return <text x={cx} y={cy} textAnchor="middle" className="dp-ink-dim">Earth is given: see Space</text>
  if (!body || !disc) return <Gaps gaps={['the body']} x={cx} y={cy} centred size={size} />
  const {record} = body, tilt = record.sky.axial_tilt_deg * D2R
  const locations = locationsOf(v) ?? [], pin = (lat: number, lon: number) => {
    const q = unit(lat, lon), xm = q.x * Math.cos(tilt) - q.y * Math.sin(tilt), ym = q.x * Math.sin(tilt) + q.y * Math.cos(tilt)
    return q.z > 0 ? {x: cx + R * xm, y: cy - R * ym} : undefined
  }
  const axis = {dx: Math.sin(tilt) * (R + 8), dy: Math.cos(tilt) * (R + 8)}, note = strOf(v, 'generationNote')
  return <g>
    <image href={disc} x={cx - R} y={cy - R} width={2 * R} height={2 * R} preserveAspectRatio="none" />
    <line x1={cx - axis.dx} y1={cy + axis.dy} x2={cx + axis.dx} y2={cy - axis.dy} className="dp-faint" strokeDasharray="2 3" />
    {locations.map(at => { const d = shoreOf(record, at.lat, at.lon), p = pin(d.lat, d.lon); return p && <g key={at.id}>
      <circle cx={p.x} cy={p.y} r={2.4} fill={d.shore ? 'none' : 'var(--accent)'} stroke="var(--accent)" strokeWidth={1} />
      {size !== 'compact' && size !== 'tile' && <text x={p.x > cx ? p.x - 4 : p.x + 4} y={p.y + 3} textAnchor={p.x > cx ? 'end' : 'start'} className="dp-ink"
        style={{fontSize: SIZES[size].font, paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{at.name}{d.shore ? ' · shore' : ''}</text>}
    </g> })}
    {note && size !== 'compact' && size !== 'tile' && <text x={6} y={h - 5} className="dp-ink-dim" style={{fontSize: SIZES[size].font - 1}}>{note}</text>}
  </g>
}

function BodyDisplay({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="Your body" corner={strOf(v, 'bodyName') ?? NONE}
    does="Your planet from its settings and its seed. A location keeps its position; where that spot is now sea it is drawn on the nearest shore, hollow.">
    <BodyArt v={v} w={w} h={h} size={size} />
  </Display>
}

/** A body control's standing: Earth's land and another world's are not yours to change. */
const bodyWhy = (v: V): string | undefined => (strOf(v, 'body') === 'earth' ? GIVEN : strOf(v, 'body') === 'other' ? READ_ONLY : undefined)
const pct = (x: number) => `${Math.round(x * 100)} %`
const bodyDial = (p: ViewProps, key: string, label: string, does: string, def: number, scale = {min: 0, max: 1}, format: (x: number) => string = pct) =>
  <Dial {...stand(p, key, bodyWhy(p.v))} key={key} label={label} does={does} value={numOf(p.v, key) ?? NaN} def={def} scale={scale} format={format} onChange={x => p.set(key, Math.round(x * 100) / 100)} />
const locationRows = (v: V): RowItem[] => {
  const all = locationsOf(v), body = bodyOf(v)
  if (!all) return [{id: 'none', name: 'No reading of the locations', light: 'unknown'}]
  return all.map(at => { const d = body ? shoreOf(body.record, at.lat, at.lon) : undefined; return {id: at.id, name: at.name, light: d ? (d.shore ? 'dark' : 'lit') : 'unknown', tone: 'value', note: d?.shore ? 'shore' : at.kind ?? 'place'} })
}

// ---------------------------------------------------------------- what the pane drew over the globe, here (O-I #762)

/** The subject in focus, its line and its acts — the way out, its ties, where it hangs in the sky, Follow the thread, Reading — and the
 * closes of the reading cards: the atlas's own, as the pane drew them before it stood them down. */
function focusSection(p: ViewProps) {
  const controls = paneControlsOf(p.v, ['focus', 'closes'])
  const line = paneReadings(controls ?? []).find(text => text !== paneTitle(p.v))
  return <Section label="Focus" grow>
    <Readout label="subject" does="The subject the Earth has in focus, and the line it reads it by." value={controls ? paneTitle(p.v) ?? 'none' : undefined} />
    {line && <Readout label="line" does="The subject's line, as the Earth reads it." value={line} />}
    {controls ? <PaneControls p={p} controls={controls} /> : <Readout label="acts" does="The acts on the subject in focus stand here once the Earth is open." value={undefined} />}
  </Section>
}

/** How the graph is drawn — node size, link width, text fade, Reset: the graph's own settings, as the pane drew them. */
function displaySection(p: ViewProps) {
  const controls = paneControlsOf(p.v, ['graph'])
  return <Section label="Display" grow>
    {controls?.length ? <PaneControls p={p} controls={controls} />
      : <Readout label="display" does="How the graph is drawn: its settings stand here once the Graph view has been shown." value={undefined} />}
  </Section>
}

// ---------------------------------------------------------------- the pane: the material itself

const MARK = {exact: 'solid', region: 'outline'} as const
const TABLE_ROWS = 10
function FullWorld({v}: {v: V}) {
  const graph = strOf(v, 'view') === 'graph', places = placesOf(v), occasion = occasionOf(v), sky = skyOf(v), sun = sunRead(v)
  const ns = (x: number) => `${Math.abs(x).toFixed(1)}° ${x < 0 ? 'S' : 'N'}`, ew = (x: number) => `${Math.abs(x).toFixed(1)}° ${x < 0 ? 'W' : 'E'}`
  const over = sun === true && sky ? subsolar(sky) : undefined
  return <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label={graph ? 'The graph' : 'The World'}>
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        {graph ? <>
          <GraphArt v={v} w={760} h={420} size="big" />
          <text x={14} y={392} className="dp-axis">{`Ties: ${providerLabels().basisOwn} solid, inferred dashed, site faint.`}</text>
          <text x={14} y={404} className="dp-axis">Amber: an archetype. Teal: a form of the field.</text>
        </> : <>
          <SpaceArt v={v} w={520} h={420} size="big" />
          <text x={548} y={34} className="dp-axis">place</text><text x={662} y={34} className="dp-axis">year</text><text x={716} y={34} className="dp-axis">mark</text>
          <path d="M548 42H748" className="dp-faint" />
          {places
            ? <>
              {places.slice(0, TABLE_ROWS).map((pl, i) => <g key={pl.id} opacity={(presenceOf(v, occasion, pl) ?? 1) > .03 ? 1 : .4}>
                <text x={548} y={60 + i * 20} className="dp-ink">{pl.name}</text><text x={662} y={60 + i * 20} className="dp-ink-dim">{yearText(pl.year)}</text><text x={716} y={60 + i * 20} className="dp-ink-dim">{MARK[pl.precision]}</text>
              </g>)}
              {places.length > TABLE_ROWS && <text x={548} y={60 + TABLE_ROWS * 20} className="dp-ink-dim">{`and ${places.length - TABLE_ROWS} more`}</text>}
            </>
            : <text x={548} y={60} className="dp-ink-dim">No reading of the places</text>}
          <text x={548} y={272} className="dp-ink-dim">{`${shown(v, 'scale')} scale · ${whenOf(v) ?? NONE}`}</text>
          <text x={548} y={288} className="dp-ink-dim">{over ? `Sun over ${ns(over.lat)}, ${ew(over.lon)}` : sun === false ? 'No Sun is read for this year.' : 'No reading of the Sun'}</text>
          <text x={548} y={304} className="dp-ink-dim">{`${shownCount(v) ?? NONE} places shown · imagery ${shown(v, 'baseKind')}`}</text>
          <text x={548} y={344} className="dp-axis">Imagery: NASA Blue Marble, offline.</text>
          <text x={548} y={358} className="dp-axis">Sharper tiles from NASA GIBS close in.</text>
          <text x={548} y={372} className="dp-axis">Solid: exact. Halo: approximate. Outline: region.</text>
          <text x={548} y={386} className="dp-axis">A place with no coordinate is listed, not drawn.</text>
          <text x={548} y={400} className="dp-axis">The idle body is still.</text>
        </>}
      </g>
    </svg>
  </div>
}

// ---------------------------------------------------------------- the design

export const design: DesignedDevice = {
  id: 'atlas-earth:globe-engine',
  title: 'World',
  kind: 'instrument',
  firstPage: 'space',
  defaults: {
    light: 'lit', view: 'earth', scale: 'body', cursor: 1, allTime: true, playing: false, cumulative: false,
    scope: '', wholeField: false, relation: 'all', selected: 'eleusis', placeArmed: false, placePage: 0, baseKind: '2k',
    graphOpen: true, local: true, depth: 1, centre: .8, repel: .8, link: 1, distance: 1.25,
    tieJung: true, tieInferred: true, tieSite: true, kindArchetype: true, kindTheoretic: true, kindFamily: true, occurrences: true, skyAnchors: false,
    // The material. places: field.json occurrences, `own` the three a scope names as its own. sky: fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json,
    // ecliptic longitudes at the instant given. graph: the neighbourhood of Quaternity in the field (a node is [id, name, kind, steps, occurrences]).
    places: JSON.stringify([
      {id: 'giza', name: 'Giza', lat: 30.0273, lon: 31.2076, year: -2530, precision: 'exact', relation: 'OCCURRED_AT', what: 'A king’s daughter buried in a gilded wooden cow'},
      {id: 'athens', name: 'Athens', lat: 37.947, lon: 23.7406, year: -385, precision: 'exact', relation: null, what: 'Plato’s round primordial man', own: true},
      {id: 'jerusalem', name: 'Jerusalem', lat: 31.7534, lon: 35.1301, year: 30, precision: 'exact', relation: 'MYTH_LOCATED_AT', what: 'The angel who stirs the pool of Bethesda', own: true},
      {id: 'eleusis', name: 'Eleusis', lat: 38.0659, lon: 23.4693, year: 390, precision: 'exact', relation: null, what: 'The hieros gamos of hierophant and priestess', own: true},
      {id: 'palenque', name: 'Palenque', lat: 17.552, lon: -92.0459, year: 690, precision: 'exact', relation: 'LOCATED_IN', what: 'The Palenque Cross with a child offering'},
      {id: 'chartres', name: 'Chartres', lat: 48.9317, lon: 2.3696, year: 1150, precision: 'exact', relation: null, what: 'Anima mundi as the Holy Ghost'},
      {id: 'zurich', name: 'Zürich', lat: 47.3015, lon: 8.6075, year: 1910, precision: 'exact', relation: null, what: 'Understanding the language of birds'},
      {id: 'taos', name: 'Taos', lat: 36.4786, lon: -105.5844, year: 1925, precision: 'exact', relation: null, what: 'All life is coming from the mountain'},
      {id: 'australia', name: 'Central Australia', lat: -24.5508, lon: 133.4689, year: 1932, precision: 'region', relation: null, what: 'The ancestral fire-sparks seeking wombs'},
    ]),
    sky: JSON.stringify({at: '2026-09-28T12:00:00Z', lon: {Sun: 185.3841, Moon: 28.4415, Mercury: 207.3048, Venus: 218.0566, Mars: 120.2251, Jupiter: 139.1394, Saturn: 11.7737, Uranus: 65.5651, Neptune: 2.9311, Pluto: 303.1411}}),
    graph: JSON.stringify({
      nodes: [
        ['quaternity', 'Quaternity', 'f', 0, 48], ['feeling', 'Feeling', 'f', 1, 6], ['four', 'Four', 'a', 1, 0],
        ['intuition', 'Intuition', 'f', 1, 5], ['self', 'The Self', 'a', 1, 0], ['sensation', 'Sensation', 'f', 1, 5],
        ['thinking', 'Thinking', 'f', 1, 5], ['air', 'Air', 'f', 1, 7], ['citrinitas', 'Citrinitas', 'f', 1, 3],
        ['earth-element', 'Earth', 'f', 1, 5], ['eight', 'Eight', 'a', 2, 0], ['mandala', 'Mandala', 'f', 2, 124],
        ['melothesia', 'Melothesia', 'f', 2, 1], ['abraxas', 'Abraxas', 'f', 2, 1], ['ahasuerus', 'Ahasuerus', 'f', 2, 2],
        ['aion', 'Aion', 'f', 2, 2], ['aquarius', 'Aquarius', 'f', 2, 3], ['gemini', 'Gemini', 'f', 2, 3],
        ['libra', 'Libra', 'f', 2, 3], ['albedo', 'Albedo', 'f', 2, 1], ['rubedo', 'Rubedo', 'f', 2, 2],
        ['sun', 'Sun', 'f', 2, 33], ['nigredo', 'Nigredo', 'f', 2, 14], ['capricorn', 'Capricorn', 'f', 2, 3],
        ['great-mother', 'Great Mother', 'a', 2, 0], ['nine', 'Nine', 'a', 3, 0], ['seven', 'Seven', 'a', 3, 0],
        ['shadow', 'Shadow', 'a', 3, 0], ['trickster', 'Trickster', 'a', 3, 0], ['decan-aquarius-1', 'Aquarius · first decan', 'f', 3, 1],
        ['decan-aquarius-2', 'Aquarius · second decan', 'f', 3, 1], ['child', 'Child', 'a', 3, 0], ['decan-gemini-1', 'Gemini · first decan', 'f', 3, 1],
        ['anima', 'Anima', 'a', 3, 0], ['aries', 'Aries', 'f', 3, 3], ['moon', 'Moon', 'f', 3, 23],
        ['water', 'Water', 'f', 3, 35], ['decan-aries-2', 'Aries · second decan', 'f', 3, 1], ['decan-capricorn-3', 'Capricorn · third decan', 'f', 3, 1],
        ['prima-materia', 'Prima materia', 'f', 3, 22], ['saturn', 'Saturn', 'f', 3, 0], ['goat', 'Goat', 'f', 3, 1],
        ['cancer', 'Cancer', 'f', 3, 3], ['dual-mother', 'Dual mother', 'f', 3, 9], ['mother-goddess', 'Mother goddess', 'f', 3, 78],
      ],
      edges: [
        ['abraxas', 'self', 'jung'], ['abraxas', 'shadow', 'inferred'], ['abraxas', 'trickster', 'site'], ['ahasuerus', 'self', 'jung'],
        ['aion', 'self', 'jung'], ['air', 'aquarius', 'jung'], ['air', 'citrinitas', 'inferred'], ['air', 'four', 'inferred'],
        ['air', 'gemini', 'jung'], ['air', 'libra', 'jung'], ['air', 'quaternity', 'inferred'], ['air', 'thinking', 'jung'],
        ['albedo', 'citrinitas', 'jung'], ['albedo', 'moon', 'jung'], ['albedo', 'nigredo', 'jung'], ['albedo', 'self', 'jung'],
        ['albedo', 'water', 'inferred'], ['anima', 'libra', 'site'], ['aquarius', 'decan-aquarius-1', 'site'], ['aquarius', 'decan-aquarius-2', 'site'],
        ['aries', 'libra', 'site'], ['cancer', 'capricorn', 'site'], ['capricorn', 'earth-element', 'site'], ['capricorn', 'goat', 'jung'],
        ['child', 'gemini', 'site'], ['citrinitas', 'quaternity', 'inferred'], ['citrinitas', 'rubedo', 'jung'], ['citrinitas', 'self', 'inferred'],
        ['citrinitas', 'sun', 'inferred'], ['decan-aries-2', 'sun', 'site'], ['decan-capricorn-3', 'sun', 'site'], ['decan-gemini-1', 'gemini', 'site'],
        ['dual-mother', 'great-mother', 'jung'], ['earth-element', 'four', 'inferred'], ['earth-element', 'great-mother', 'site'], ['earth-element', 'nigredo', 'jung'],
        ['earth-element', 'quaternity', 'inferred'], ['eight', 'four', 'jung'], ['eight', 'nine', 'jung'], ['eight', 'seven', 'jung'],
        ['feeling', 'four', 'inferred'], ['feeling', 'quaternity', 'jung'], ['feeling', 'thinking', 'jung'], ['four', 'intuition', 'inferred'],
        ['four', 'mandala', 'jung'], ['four', 'melothesia', 'jung'], ['four', 'quaternity', 'jung'], ['four', 'sensation', 'inferred'],
        ['four', 'thinking', 'inferred'], ['great-mother', 'mother-goddess', 'jung'], ['intuition', 'quaternity', 'jung'], ['intuition', 'sensation', 'jung'],
        ['mandala', 'self', 'jung'], ['melothesia', 'self', 'jung'], ['moon', 'rubedo', 'jung'], ['nigredo', 'prima-materia', 'jung'],
        ['nigredo', 'saturn', 'inferred'], ['nigredo', 'shadow', 'jung'], ['nigredo', 'sun', 'jung'], ['quaternity', 'self', 'jung'],
        ['quaternity', 'sensation', 'jung'], ['quaternity', 'thinking', 'jung'], ['rubedo', 'self', 'jung'], ['rubedo', 'sun', 'jung'],
        ['self', 'sun', 'jung'],
      ],
    }),
    subject: 'quaternity',
    // The body you build (the design's own sample: no owner keeps one yet).
    body: 'own', bodyName: 'Teraphim', seed: 20261018, seaLevel: .5, continents: 1.7, relief: .55, coast: 'smooth', warmth: .58, moisture: .6, iceCaps: .3,
    atmosphere: .6, clouds: .35, tilt: 18, placeKind: 'place',
    locations: JSON.stringify([
      {id: 'study', name: 'The study', lat: 22, lon: 10, kind: 'place'}, {id: 'book', name: 'The book', lat: -8, lon: 34, kind: 'palace'},
      {id: 'oi', name: 'O:I', lat: 38, lon: -18, kind: 'place'}, {id: 'mara', name: 'To Mara’s world', lat: -30, lon: -6, kind: 'portal'},
    ]),
    // What the pane drew over the globe (O-I #762): Quaternity in focus with its line and acts, as the atlas's focus label reads
    // (ui/focus-label.ts), and the graph's display settings (graph/settings.ts DISPLAY_ROWS).
    'pane.title': 'Quaternity',
    'pane.controls': JSON.stringify([
      {id: 'focus/Quaternity', region: 'focus', kind: 'reading', label: 'Quaternity', value: 'Quaternity'},
      {id: 'focus/A form of the field, in 48 instances', region: 'focus', kind: 'reading', label: 'A form of the field, in 48 instances', value: 'A form of the field, in 48 instances'},
      {id: 'focus/‹ the whole field', region: 'focus', kind: 'button', label: '‹ the whole field'},
      {id: 'focus/Four', region: 'focus', kind: 'button', label: 'Four'},
      {id: 'focus/Follow the thread', region: 'focus', kind: 'button', label: 'Follow the thread'},
      {id: 'focus/See in sky (the Sun)', region: 'focus', kind: 'button', label: 'See in sky (the Sun)'},
      {id: 'focus/Reading', region: 'focus', kind: 'button', label: 'Reading'},
      ...[['size', 'Node size', .5, 2, 'How large every node is drawn. The layout does not move.'], ['links', 'Link width', .4, 2.5, 'How thick every relation is drawn. The layout does not move.'],
        ['text', 'Text fade', .5, 2, 'How soon the names of smaller forms appear as you come close. More names them sooner.']].map(([, label, min, max, tip]) =>
        ({id: `graph/${label}: ${tip}`, region: 'graph', kind: 'number', label: `${label}: ${tip}`, title: tip, value: '1', min, max, step: .05})),
      {id: 'graph/Reset', region: 'graph', kind: 'button', label: 'Reset', title: 'Restore the drawing as it was'},
    ]),
  },
  fixtures: {
    'Whole Earth, all time': {},
    'Year 450 in the window': {allTime: false, cursor: toU(450)},
    'Region, one scope': {scale: 'region', scope: 'this reading', selected: 'athens'},
    'Graph, three steps': {view: 'graph', depth: 3, skyAnchors: true},
    'A wetter, rougher body': {seed: 7, seaLevel: .38, continents: 3.1, relief: .9, coast: 'fjord', moisture: .85, warmth: .4, iceCaps: .55, clouds: .6, tilt: 32},
    'Earth chosen': {body: 'earth'},
    'Nothing in focus': {'pane.title': undefined, 'pane.controls': JSON.stringify([])},
    'No readings': Object.fromEntries(['light', 'view', 'scale', 'cursor', 'allTime', 'playing', 'cumulative', 'scope', 'wholeField', 'relation', 'selected', 'placeArmed', 'placePage', 'baseKind',
      'graphOpen', 'local', 'depth', 'centre', 'repel', 'link', 'distance', 'tieJung', 'tieInferred', 'tieSite', 'kindArchetype', 'kindTheoretic', 'kindFamily', 'occurrences', 'skyAnchors',
      'places', 'sky', 'graph', 'subject', 'body', 'bodyName', 'seed', 'seaLevel', 'continents', 'relief', 'coast', 'warmth', 'moisture', 'iceCaps', 'atmosphere', 'clouds', 'tilt',
      'placeKind', 'locations', 'bodyRecord', 'bodyLook', 'bodyTime', 'generationNote', 'pane.title', 'pane.controls'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="World" light={light(p)} readings={strOf(p.v, 'view') === 'graph' ? ['graph', depthText(p.v)] : [shown(p.v, 'scale'), whenOf(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="World" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><WorldDisplay v={p.v} set={p.set} standing={p.standing} w={140} h={146} size="compact" /></Section>
    <Section label="Macros" cols={2}>
      {strOf(p.v, 'view') === 'graph' ? <>
        {viewRadio(p)}
        {depthDial(p)}
        {forceDial(p, FORCE_ROWS[0])}
        {forceDial(p, FORCE_ROWS[1])}
      </> : <>
        {timeDial(p)}
        {scaleChooser(p)}
        {viewRadio(p)}
        {allTimeToggle(p)}
      </>}
    </Section>
  </Panel>,

  whole: p => <Panel title="World" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'space', label: 'Space'}, {id: 'body', label: 'Body'}, {id: 'graph', label: 'Graph'}]} page={p.page === 'graph' || p.page === 'body' ? p.page : 'space'} onPage={p.setPage}>
    {p.page === 'body' ? <>
      <Band>
        <Section width={198}><BodyDisplay v={p.v} w={186} h={146} size="whole" /></Section>
        <Section label="Body" width={96}>
          <Chooser {...st(p, 'body')} wide label="Body" does="The body to show and build: your world, Earth, or a world you visit." value={strOf(p.v, 'body') ?? ''} options={BODY_CHOICES} onChange={x => p.set('body', x)} />
          <Readout label="seed" value={numOf(p.v, 'seed')} does="The seed your body grows from. The same seed and settings give the same body." />
          <Action {...stand(p, 'reroll', bodyWhy(p.v))} label="Reroll" does="A new body from the same settings. Every location keeps its name and its position." onPress={() => p.set('reroll', Date.now())} />
        </Section>
        <Section label="Landmass" cols={2} grow>
          {bodyDial(p, 'seaLevel', 'Sea level', 'How much of the body lies under the sea.', .5)}
          {bodyDial(p, 'continents', 'Continents', 'How many land masses: fewer and larger, or more and smaller.', 1.7, {min: .6, max: 3.6}, x => `${x.toFixed(1)}×`)}
          {bodyDial(p, 'relief', 'Relief', 'How rugged the land rises.', .55)}
          <Radio {...stand(p, 'coast', bodyWhy(p.v))} label="Coast" does="How the coast runs." value={strOf(p.v, 'coast') ?? ''} options={COASTS} stack onChange={x => p.set('coast', x)} />
        </Section>
      </Band>
      <Band>
        <Section label="Climate" width={150} cols={3}>
          {bodyDial(p, 'warmth', 'Warmth', 'How warm the body runs: dry and gold, or green.', .58)}
          {bodyDial(p, 'moisture', 'Moisture', 'How wet the land is.', .6)}
          {bodyDial(p, 'iceCaps', 'Ice caps', 'How far the ice reaches from the poles.', .3)}
        </Section>
        <Section label="Sky" width={150} cols={3}>
          {bodyDial(p, 'atmosphere', 'Atmosphere', 'How thick the air shows at the rim.', .6)}
          {bodyDial(p, 'clouds', 'Clouds', 'How much cloud covers the body.', .35)}
          {bodyDial(p, 'tilt', 'Tilt', 'How far the axis leans.', 18, {min: 0, max: 45}, x => `${Math.round(x)}°`)}
        </Section>
        <Section label="Locations" grow>
          <Radio {...st(p, 'placeKind')} label="Place kind" does="What the next click on the body places." value={strOf(p.v, 'placeKind') ?? ''} options={PLACE_KINDS} onChange={x => p.set('placeKind', x)} />
          <Rows does="Your locations. A dim light means its spot is sea on this body, so it is drawn on the nearest shore." size={3} items={locationRows(p.v)} />
        </Section>
      </Band>
    </> : p.page !== 'graph' ? <>
      <Band>
        <Section width={198}><SpaceDisplay v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        <Section label="Look" width={70}>
          {viewRadio(p)}
          {scaleRadio(p)}
        </Section>
        <Section label="Occasion" cols={2} grow>
          {timeDial(p)}
          {allTimeToggle(p)}
          {playToggle(p)}
          {cumulativeToggle(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Globe" width={72}>
          {wholeToggle(p)}
          <Readout label="shown" value={shownCount(p.v)} does="The places the Earth draws now, of all the field holds." />
        </Section>
        <Section label="Places" width={150}>
          <Chooser {...st(p, 'relation')} wide label="Relations" does="Draw only the places of one relation. All draws every relation." value={strOf(p.v, 'relation') ?? ''} options={RELATIONS} onChange={x => p.set('relation', x)} />
          {toggle(p, 'placeArmed', '✎ Place', 'Arm the Place tool. The next click on the Earth offers a point for the selected subject to its editor.', {why: strOf(p.v, 'selected') ? undefined : NO_SUBJECT})}
          <Rows does="The places of the field. A dim light means the Earth does not draw the place now." size={3} page={numOf(p.v, 'placePage') ?? 0}
            onPage={st(p, 'placePage').disabled ? undefined : x => p.set('placePage', x)} items={placeRows(p.v)} />
        </Section>
        <Section label="Earth" width={64}>
          <Readout label="imagery" value={strOf(p.v, 'baseKind')} does="The sharpness of the base picture, as the globe holds it." />
          <Readout label="day, night" value={dayNight(p.v)} does="Lit by the Sun that the sky reports. Evenly lit when no Sun is read." />
        </Section>
        <Section label="Reach" grow>
          <Chooser wide label="Aperture" does="How far you look: world, local, shared or federated." value="" options={[{value: 'world', label: 'World'}, {value: 'local', label: 'Local'}, {value: 'shared', label: 'Shared'}, {value: 'federated', label: 'Federated'}]} disabled={NO_APERTURE} />
          <Chooser wide label="View as" does="Who you look as: me, the field or the public." value="" options={[{value: 'me', label: 'Me'}, {value: 'field', label: 'Field'}, {value: 'public', label: 'Public'}]} disabled={NO_VIEW_AS} />
        </Section>
      </Band>
      <Band>{focusSection(p)}</Band>
    </> : <>
      <Band>
        <Section width={198}><GraphDisplay v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        <Section label="Steps" width={58}>
          {depthDial(p)}
        </Section>
        <Section label="Forces" cols={2} grow>
          {FORCE_ROWS.map(row => forceDial(p, row))}
        </Section>
      </Band>
      <Band>
        <Section label="Ties" width={76}>
          {flag(p, 'tieJung', providerLabels().basisOwn, `Follow the links the field's own source makes: ${providerLabels().basisOwn}.`)}
          {flag(p, 'tieInferred', 'Inferred', 'Follow the links that the field infers.')}
          {flag(p, 'tieSite', 'Site', 'Follow the links that a site makes.')}
        </Section>
        <Section label="Kinds" width={82}>
          {flag(p, 'kindArchetype', 'Archetypes', 'Draw the archetypes.')}
          {flag(p, 'kindTheoretic', 'Theoretics', 'Draw the theoretic terms.')}
          {flag(p, 'kindFamily', 'Families', 'Draw the families of symbols.')}
        </Section>
        <Section label="Show" grow>
          {flag(p, 'occurrences', 'Occurrences', 'Draw the occurrences as dust around each form.')}
          {flag(p, 'skyAnchors', 'Sky anchors', 'Hold the Sun, the Moon and the planets to their places in the sky.')}
          <Readout label="sky" value={boolOf(p.v, 'skyAnchors') === undefined ? undefined : boolOf(p.v, 'skyAnchors') ? 'on' : 'off'} does="The sky layer of the graph: off, loading, on or unavailable." />
        </Section>
        {displaySection(p)}
      </Band>
    </>}
  </Panel>,

  full: p => <FullWorld v={p.v} />,

  widget: p => <Tile title="World" light={light(p)} span={2} onFull={p.nav.full}>
    <SpaceDisplay v={p.v} w={112} h={104} size="tile" />
    <div className="ref-tile-side">
      <Readout label="scale" value={strOf(p.v, 'view') === 'graph' ? 'graph' : strOf(p.v, 'scale')} does="How close you look." />
      <Readout label="occasion" value={whenOf(p.v)} does="The year in the window, or all time." />
      <Readout label="shown" value={shownCount(p.v)} does="The places the Earth draws now." />
    </div>
  </Tile>,
}
