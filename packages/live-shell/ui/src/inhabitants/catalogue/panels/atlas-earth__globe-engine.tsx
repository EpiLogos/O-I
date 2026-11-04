// World (manual §17.2): the Earth under its star, and the same material as a graph. Live's nearest: Simpler — one display whose
// picture changes with the mode (Space or Graph), a handle on its axis, a few columns round it. Space draws the body by the atlas's
// own laws: an orthographic globe, the terminator from the Sun's subsolar point, each place by the precision grammar, and the deep-time
// window (data/time.ts timeVisibility) that fades a place in as the cursor reaches its year. Graph draws the constellation by its four
// forces (graph/forces.ts) over a real neighbourhood of the Archetypal Earth field.
//
// Owners. The Earth ⇄ Graph switch, the whole-field choice and the deep-time clock are the atlas's own, written through
// shell.setAtlasView, shell.setAtlasWholeField and shell.setAtlasCursor / AllTime / Play / Cumulative (inhabitants/ql/devices/
// atlasDevices.ts:34-51). The graph's steps, forces, relations, kinds, occurrences and sky anchors are the graph-tools rows (same file,
// :35-44). The scale is the camera's: a reading (projections/atlas/places/placesModel.ts atlasScaleOf), but for the Field, the view's own
// choice with Aperture and View as (O-I #858): the Field draws the held field's worlds and stars (system/fieldModel.ts fieldSceneOf, from
// `field`, the binding's read of it, and `fieldYours`, your own body's ref); while the field holds no worlds, `fieldWhy` says why and
// Aperture and View as stand dimmed with those words. `cameraScale` is the camera's scale, kept while the Field is chosen: the Scale
// chooser takes the Field and that one scale back, and says the camera sets the others. At the Field, a star is acted on (manual §17.2
// items 9 and 10): `fieldStar` the star chosen, `fieldWaiting` (JSON refs) the worlds waiting at its edge, `fieldAdmit` the one chosen to
// let in, `starName`, `starGathers` and `starComes` the star to light, the view's own; the acts `starLight`, `starGather`, `starLeave`,
// `starAdmit` and `starClose` go to the held field, each standing dimmed with its reason when it cannot be done. Showing work and
// offering a task at a star (`starShow`, `starOffer`) are Software Factory's, which has not built them: they stand dimmed naming it.
// What the atlas drew over the globe stands here,
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
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type RowItem, type Standing, unreadRows} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {WORLD_BODY_GENERATOR, WORLD_BODY_GENERATOR_VERSION, bodyDisc, isWorldBody, parseWorldBody, shoreOf, type BodyLook, type WorldBodyRecord} from '../../../projections/atlas/src/globe/body'
import {discPngUrl} from '../../../projections/atlas/body/discPng'
import {providerLabels} from '../../../projections/atlas/src/data/labels'
import {PaneControls, paneControlsOf, paneReadings, paneTitle} from './paneControls'
import {fieldSceneOf, starDayLine, starSayingLine, starWhen, type Aperture, type Audience, type FieldScene, type SceneStar} from '../../../projections/atlas/system/fieldModel'
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

/** The ruler for the camera's scale on the left edge: place at the top, then region and body, system below. */
const SCALE_ORDER = ['place', 'region', 'body', 'system'] as const
const scaleOf = (v: V): (typeof SCALE_ORDER)[number] | undefined => { const s = strOf(v, 'scale'); return SCALE_ORDER.find(x => x === s) }
const rulerY = (h: number, scale: (typeof SCALE_ORDER)[number]) => 22 + (h - 22 - 46) * SCALE_ORDER.indexOf(scale) / (SCALE_ORDER.length - 1)

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
  const R = scale === 'region' || scale === 'place' ? Math.min(w, usable) * 1.18 : Math.min(w, usable) * .43
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
      {scale !== undefined && <Handle n={2} shape="square" x={10} y={rulerY(h, scale)} label="Scale" does={said('The camera’s scale: place, region, body or system. Come closer to the Earth or draw back from it to move it.', scaleStand)} />}
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
const NOT_FIELD = 'The field and its stars are read at the Field scale: choose Field first.'

const SCALES = [{value: 'field', label: 'Field', does: 'Every world in the system, clear where its owner has shown it, and the stars people have made.'},
  {value: 'system', label: 'System', does: 'The sky: the Earth among the Sun, the Moon and the planets.'}, {value: 'body', label: 'Body', does: 'The Earth whole.'}, {value: 'region', label: 'Region', does: 'A close view over a coast.'},
  {value: 'place', label: 'Place', does: 'One place with its exact position.'}] as const
const CAMERA_SETS = 'The camera sets this scale: come closer to the Earth or draw back from it.'
const NO_CAMERA = 'No Earth stands, so the camera stands at no scale.'
/** The scales to choose from: the Field, the view's own, and the one the camera stands at (the way back from the Field); the camera
 * sets the others. */
const scaleOptions = (v: V) => { const camera = strOf(v, 'cameraScale')
  return SCALES.map(option => (option.value === 'field' || option.value === camera ? option : {...option, why: camera ? CAMERA_SETS : NO_CAMERA})) }
const APERTURE_OPTIONS = [{value: 'world', label: 'World', does: 'Your world alone.'}, {value: 'local', label: 'Local', does: 'Your world and the worlds it holds.'},
  {value: 'shared', label: 'Shared', does: 'The worlds and stars you are gathered with.'}, {value: 'federated', label: 'Federated', does: 'Everything the field shows.'}] as const
const VIEW_AS_OPTIONS = [{value: 'me', label: 'Me', does: 'Your world as you know it.'}, {value: 'field', label: 'Field', does: 'Your world as the shared field sees it.'},
  {value: 'public', label: 'Public', does: 'Your world as the public sees it.'}] as const
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
const SCALE_DOES = 'How close you look: the field, the system, a body, a region or a place. The camera sets the closer four.'
const scaleChooser = (p: ViewProps) => <Chooser {...stand(p, 'scale', strOf(p.v, 'view') === 'graph' ? NOT_GRAPH : undefined)} label="Scale" does={SCALE_DOES} value={strOf(p.v, 'scale') ?? ''} options={scaleOptions(p.v)}
  onChange={x => p.set('scale', x)} />
const scaleRadio = (p: ViewProps) => <Radio {...stand(p, 'scale', strOf(p.v, 'view') === 'graph' ? NOT_GRAPH : undefined)} label="Scale" does={SCALE_DOES} value={strOf(p.v, 'scale') ?? ''} options={scaleOptions(p.v)} stack
  onChange={x => p.set('scale', x)} />
/** Aperture and View as: the view's own at Field scale, dimmed with the field's words while it holds no worlds. */
const atField = (v: V) => strOf(v, 'scale') === 'field' && strOf(v, 'view') !== 'graph'
const reachWhy = (v: V) => strOf(v, 'fieldWhy') ?? (atField(v) ? undefined : NOT_FIELD)
const apertureChooser = (p: ViewProps) => <Chooser {...stand(p, 'aperture', reachWhy(p.v))} wide label="Aperture" does="How far you look: world, local, shared or federated. It filters the one system and takes you nowhere."
  value={strOf(p.v, 'aperture') ?? ''} options={APERTURE_OPTIONS} onChange={x => p.set('aperture', x)} />
const viewAsChooser = (p: ViewProps) => <Chooser {...stand(p, 'viewAs', reachWhy(p.v))} wide label="View as" does="Who you look as: your world as you know it, as the field sees it, or as the public sees it."
  value={strOf(p.v, 'viewAs') ?? ''} options={VIEW_AS_OPTIONS} onChange={x => p.set('viewAs', x)} />
const APERTURE_LABEL: Readonly<Record<Aperture, string>> = {world: 'World', local: 'Local', shared: 'Shared', federated: 'Federated'}
/** The scene the Field draws, from the binding's read of the held field at the view's aperture and audience; undefined when none is read. */
const sceneOf = (v: V): FieldScene | undefined => {
  const aperture = (APERTURE_OPTIONS.find(x => x.value === strOf(v, 'aperture'))?.value ?? 'world') as Aperture
  const viewAs = (VIEW_AS_OPTIONS.find(x => x.value === strOf(v, 'viewAs'))?.value ?? 'me') as Audience
  return fieldSceneOf(json<unknown>(v, 'field', null), {aperture, viewAs}, strOf(v, 'fieldYours') ?? null) ?? undefined
}
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
/** What lies just past the edge, counted as one reading ("1 world and 1 star", never two that could echo the display's own count of
 * what is in view): short enough to stand beside the star sections (Widen names the aperture that shows it). */
const beyondText = (scene: FieldScene | undefined): string | undefined => {
  const past = scene?.beyond
  if (!scene) return undefined
  if (!past) return 'nothing'
  return [past.worlds ? plural(past.worlds, 'world') : '', past.stars ? plural(past.stars, 'star') : ''].filter(Boolean).join(' and ')
}
/** The same, short enough for the display's foot. */
const beyondShort = (scene: FieldScene): string => {
  const past = scene.beyond
  return past ? `${[past.worlds ? plural(past.worlds, 'world') : '', past.stars ? plural(past.stars, 'star') : ''].filter(Boolean).join(', ')} past the edge` : 'nothing past the edge'
}
const widenAction = (p: ViewProps) => {
  const past = sceneOf(p.v)?.beyond
  return <Action {...stand(p, 'aperture', reachWhy(p.v) ?? (past ? undefined : 'Nothing lies past the edge of this view.'))} label="Widen"
    does={past ? `Widen the aperture to ${APERTURE_LABEL[past.wider]}, which shows what lies just past the edge.` : 'Widen the aperture to what lies just past the edge.'}
    onPress={past ? () => p.set('aperture', past.wider) : undefined} />
}

// ---------------------------------------------------------------- at a star (manual §17.2 items 9 and 10; O-I #858)

const COMES_OPTIONS = [{value: 'anyone', label: 'Anyone', does: 'Any world gathers at once.'}, {value: 'asked', label: 'Asked', does: 'Each world waits at its edge until you let it in.'}] as const
/** Software Factory's acts at a star, not built yet (stories SF12, SF13): dimmed with their owner named, whatever the host says. */
const FACTORY_SHOW = 'Software Factory shows a piece of work in the field for the people you let in; it has not built that yet.'
const FACTORY_OFFER = 'Software Factory offers a task at a star for another person’s agent to take up on their own machine; it has not built that yet.'
const NO_STAR_HERE = 'No star stands in this aperture: widen it to Shared or Federated.'
const tailOf = (ref: string) => ref.split(':').pop() ?? ref
/** The star chosen, as the field shows it at every aperture (a star you chose stays chosen when the aperture narrows). */
const chosenStar = (v: V): SceneStar | undefined => {
  const ref = strOf(v, 'fieldStar')
  if (!ref) return undefined
  return fieldSceneOf(json<unknown>(v, 'field', null), {aperture: 'federated', viewAs: 'me'}, strOf(v, 'fieldYours') ?? null)?.stars.find(star => star.ref === ref)
}
const waitingOf = (v: V): readonly string[] => json<string[]>(v, 'fieldWaiting', [])
const comesText = (star: SceneStar) => (star.comes === 'anyone' ? 'Anyone gathers at once' : 'Its lighter lets each world in')
const hereText = (star: SceneStar) => `${star.gathered.length} gathered${star.waiting ? `, ${star.waiting} waiting` : ''}`
const yoursText = (star: SceneStar) => (star.yoursAt === 'gathered' ? 'Your world is gathered here' : star.yoursAt === 'asked' ? 'Your world waits at the edge' : 'Your world is not here')
/** The chosen star in lines: its lighter's words for what it gathers, who may come, who is there, and where your world stands. */
const starRows = (star: SceneStar): RowItem[] => [
  {id: 'gathers', name: star.gathers, light: 'lit', tone: 'value', does: 'What the star gathers, in its lighter’s words.'},
  {id: 'comes', name: comesText(star), light: 'lit', does: 'Who may come: anyone at once, or each world its lighter lets in.'},
  {id: 'here', name: hereText(star), light: 'lit', does: 'The worlds gathered at the star, and those waiting at its edge.'},
  {id: 'yours', name: yoursText(star), light: star.yoursAt === 'gathered' ? 'lit' : 'dark', does: 'Where your world stands at the star.'}]
/** An act at the chosen star: a press goes to the field; dimmed with the field's words while the field holds no worlds. */
const starAct = (p: ViewProps, key: string, label: string, does: string, hold = false) =>
  <Action {...stand(p, key, reachWhy(p.v))} key={key} label={label} does={does} hold={hold} onPress={() => p.set(key, Date.now())} />

/** The star to act at: the stars this aperture shows, and the one chosen wherever it stands. */
function starChooser(p: ViewProps) {
  const scene = sceneOf(p.v), star = chosenStar(p.v), options = (scene?.stars ?? []).map(s => ({value: s.ref, label: s.name, does: s.gathers}))
  return <Chooser {...stand(p, 'fieldStar', reachWhy(p.v) ?? (options.length || star ? undefined : NO_STAR_HERE))} wide label="Star" does="The star to act at: the stars this aperture shows."
    value={strOf(p.v, 'fieldStar') ?? ''} options={star && !options.some(o => o.value === star.ref) ? [...options, {value: star.ref, label: star.name, does: star.gathers}] : options} onChange={x => p.set('fieldStar', x)} />
}

function starSection(p: ViewProps) {
  const star = chosenStar(p.v)
  return <Section label="Star" width={164}>
    {starChooser(p)}
    <Rows label="At this star" does="The chosen star: what it gathers, who may come, who is there and where your world stands." size={4}
      items={star ? starRows(star) : reachWhy(p.v) ? undefined : []} why={star ? undefined : reachWhy(p.v) ?? 'Choose a star first.'} />
    <Action label="Star’s day ›" does="The star’s day stands on the Star page, with who is there now and what was said: who came, was let in, showed or said something and left." onPress={() => p.setPage('star')} />
  </Section>
}

function atStarSection(p: ViewProps) {
  const star = chosenStar(p.v), waiting = waitingOf(p.v)
  const waitWhy = !star ? 'Choose a star first.' : !star.mine ? 'Only the one who lit a star sees who waits and lets them in.' : waiting.length ? undefined : 'No world waits at this star’s edge.'
  return <Section label="At the star" width={104}>
    {starAct(p, 'starGather', 'Gather', 'Bring your world to the star. Where its lighter lets each world in, yours waits at the edge with its request.')}
    {starAct(p, 'starLeave', 'Leave', 'Take your world back from the star, with what it showed there.')}
    <Chooser {...stand(p, 'fieldAdmit', reachWhy(p.v) ?? waitWhy)} wide label="Waiting" does="A world waiting at the edge of your star." value={strOf(p.v, 'fieldAdmit') ?? ''}
      options={waiting.map(ref => ({value: ref, label: tailOf(ref)}))} onChange={x => p.set('fieldAdmit', x)} />
    {starAct(p, 'starAdmit', 'Let in', 'Let the waiting world in. It reaches no further into your world than what you show at the star.')}
    {starAct(p, 'starClose', 'Close', 'Hold to close your star: every world goes back to its own orbit, and what was shown there goes back under cloud.', true)}
  </Section>
}

function lightSection(p: ViewProps) {
  return <Section label="Light a star" width={150}>
    <TextField {...stand(p, 'starName', reachWhy(p.v))} wide label="Name" does="The star's name, as the field shows it." value={strOf(p.v, 'starName') ?? ''} placeholder="A star's name" onChange={x => p.set('starName', x)} />
    <TextField {...stand(p, 'starGathers', reachWhy(p.v))} wide label="Gathers" does="What the star gathers: the shared interest it stands for." value={strOf(p.v, 'starGathers') ?? ''} placeholder="What it gathers" onChange={x => p.set('starGathers', x)} />
    <Radio {...stand(p, 'starComes', reachWhy(p.v))} label="Who may come" does="Anyone, or the worlds you let in." value={strOf(p.v, 'starComes') ?? ''} options={COMES_OPTIONS} onChange={x => p.set('starComes', x)} />
    {starAct(p, 'starLight', 'Light a star', 'Light the star in the field with your world gathered at it first. It stays in your hands.')}
  </Section>
}

/** The chosen star's day, newest last, as the field lets you read it (SF04): who came, was let in, showed something and left; none
 * while no star is chosen (the list stands empty and says to choose one, or unread with the field's words while it holds no worlds). */
const dayRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.day === null) return unreadRows(json<{dayWhy?: string}>(v, 'field', {}).dayWhy ?? 'No reading of the star’s day.')
  const now = Date.now()
  return star.day.map((entry, i) => ({id: `${i}`, name: starDayLine(entry), light: entry.what === 'left' || entry.what === 'turned-away' || entry.what === 'took-back' || entry.what === 'unsaid' ? 'dark' : 'lit',
    tone: 'value', ...(entry.at === null ? {} : {note: starWhen(entry.at, now)})}))
}
/** A list's page: the one chosen, or the newest until one is. */
const pageOf = (v: V, key: string, rows: readonly RowItem[] | undefined, size: number) => numOf(v, key) ?? Math.max(0, Math.ceil((rows?.length ?? 0) / size) - 1)
function daySection(p: ViewProps, width = 150) {
  const rows = dayRows(p.v), unheld = reachWhy(p.v)
  return <Section label="Star’s day" width={width}>
    <Rows does="The star’s day, as the field lets you read it: who came, who was let in, who showed or said something there and who left, each with when. What was shown or said stays with whoever showed or said it."
      size={5} page={pageOf(p.v, 'dayPage', rows, 5)} onPage={unheld ? undefined : x => p.set('dayPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} />
  </Section>
}

// ---------------------------------------------------------------- what was said to what at a star (O-I #858, SF06)

const SAY_KINDS = [{value: 'question', label: 'Question', does: 'Ask about it.'}, {value: 'finding', label: 'Finding', does: 'Say what you found in it.'},
  {value: 'correction', label: 'Correction', does: 'Say what is wrong in it.'}, {value: 'reproduction', label: 'Reproduction', does: 'Say that you made it again, and how.'}] as const
/** Who is at the chosen star now and what each brought there: one line for each thing a world shows at the star, and one for a world
 * gathered there that shows nothing. None while no star is chosen. */
const hereRows = (star: SceneStar | undefined): RowItem[] | undefined => star && star.gathered.flatMap((world): RowItem[] => {
  const brought = star.shown.filter(item => item.world === world), who = tailOf(world)
  return brought.length ? brought.map(item => ({id: item.id, name: item.label, note: who, light: 'lit' as const, does: `A ${item.kind} ${who} shows at the star. Choose it to say something to it.`}))
    : [{id: `here:${world}`, name: who, light: 'dark' as const, does: `${who} is here and shows nothing at the star.`}]
})
/** What was said at the chosen star, each under what it answers, with when; unread with the field's words where its service keeps none. */
const saidRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.said === null) return unreadRows(json<{sayWhy?: string}>(v, 'field', {}).sayWhy ?? 'No reading of what was said at the star.')
  const now = Date.now()
  return star.said.map(saying => ({id: saying.ref, name: starSayingLine(saying), note: starWhen(saying.at, now), light: 'lit', tone: saying.mine ? 'value' : undefined,
    does: `${saying.depth ? 'An answer to what stands above it. ' : ''}Choose it to answer it${saying.mine ? ', or to unsay it' : ''}.`}))
}
/** What something can be said to at the chosen star: what is shown there, and what was said there. */
const sayToOptions = (star: SceneStar | undefined) => !star ? [] : [
  ...star.shown.map(item => ({value: item.id, label: `${item.label}, ${item.who}’s`, does: `A ${item.kind} ${item.who} shows at the star.`})),
  ...(star.said ?? []).map(saying => ({value: saying.ref, label: `${saying.who}’s ${saying.what}`, does: saying.words}))]
const choose = (p: ViewProps, id: string) => { if (!id.startsWith('here:')) p.set('fieldSayTo', id) }

/** The Star page's star: the one chosen, and who is there now with what each brought. */
function hereSection(p: ViewProps) {
  const star = chosenStar(p.v), unheld = reachWhy(p.v), rows = hereRows(star)
  return <Section label="Star" width={170}>
    {starChooser(p)}
    <Rows label="Here now" does="Who is at the star now and what each world brought there. Choose a thing to say something to it." size={4}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'}
      selected={strOf(p.v, 'fieldSayTo')} onSelect={unheld ? undefined : id => choose(p, id)} />
  </Section>
}
function saidSection(p: ViewProps) {
  const rows = saidRows(p.v), unheld = reachWhy(p.v)
  return <Section label="Said here" width={330}>
    <Rows does="What was said at the star, to what, by whom and when: each answer under what it answers. A saying stays its sayer’s until they unsay it."
      size={5} page={pageOf(p.v, 'saidPage', rows, 5)} onPage={unheld ? undefined : x => p.set('saidPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'}
      selected={strOf(p.v, 'fieldSayTo')} onSelect={unheld ? undefined : id => choose(p, id)} />
  </Section>
}
function saySection(p: ViewProps) {
  const star = chosenStar(p.v), options = sayToOptions(star)
  const toWhy = reachWhy(p.v) ?? (!star ? 'Choose a star first.' : options.length ? undefined : 'Nothing is shown or said at this star yet.')
  // Say takes a star, what it is said to and the words; Unsay what your world said: the face names why not from what it reads, as the
  // binding does
  const sayWhy = reachWhy(p.v) ?? (!star ? 'Choose a star first.' : !strOf(p.v, 'fieldSayTo') ? 'Choose what to say it to: something shown at the star, or something said there.'
    : !(strOf(p.v, 'sayWords') ?? '').trim() ? 'Say something first.' : undefined)
  const chosen = star?.said?.find(saying => saying.ref === strOf(p.v, 'fieldSayTo'))
  const unsayWhy = reachWhy(p.v) ?? (!chosen ? 'Choose something your world said, in what was said here.' : chosen.mine ? undefined : 'Only the one who said it unsays it.')
  return <Section label="Say" grow>
    <Chooser {...stand(p, 'fieldSayTo', toWhy)} wide label="To" does="What to say it to: something shown at the star, or something said there."
      value={strOf(p.v, 'fieldSayTo') ?? ''} options={options} onChange={x => p.set('fieldSayTo', x)} />
    <Chooser {...stand(p, 'sayWhat', reachWhy(p.v))} wide label="Kind" does="What you say: a question, a finding, a correction or a reproduction."
      value={strOf(p.v, 'sayWhat') ?? ''} options={SAY_KINDS} onChange={x => p.set('sayWhat', x)} />
    <TextField {...stand(p, 'sayWords', reachWhy(p.v))} wide label="Words" does="What you say, in your own words: at most 1000 characters." value={strOf(p.v, 'sayWords') ?? ''}
      placeholder="What you say" onChange={x => p.set('sayWords', x)} />
    <Action {...stand(p, 'starSay', sayWhy)} label="Say" does="Say it at the star, to what you chose, under your world’s name. It stays yours until you unsay it, and enters no one’s world."
      onPress={() => p.set('starSay', Date.now())} />
    <Action {...stand(p, 'starUnsay', unsayWhy)} label="Unsay" does="Unsay what your world said, chosen in what was said here. What answered it stands." hold
      onPress={() => p.set('starUnsay', Date.now())} />
  </Section>
}

function factorySection(p: ViewProps) {
  return <Section label="Factory" width={92}>
    <Action {...stand(p, 'starShow', st(p, 'starShow').disabled ?? FACTORY_SHOW)} label="Show work" does="Show a piece of work being made, for the people you let in at the star." />
    <Action {...stand(p, 'starOffer', st(p, 'starOffer').disabled ?? FACTORY_OFFER)} label="Offer a task" does="Offer a task at the star for another person's agent to take up." />
  </Section>
}
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
  if (!places) return unreadRows('No reading of the places.')
  return places.map(pl => { const a = presenceOf(v, occasion, pl); return {id: pl.id, name: pl.name, light: a === undefined ? 'unknown' : a > .03 ? 'lit' : 'dark', tone: 'value', note: yearText(pl.year)} })
}

// ---------------------------------------------------------------- displays

function SpaceDisplay({v, set, standing, w, h, size}: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="The World" corner={cornerOf(v)}
    does="The Earth under its Sun. Each place stands at its position, lit or in shade. Drag handle 1 for the year; handle 2 marks the camera’s scale.">
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
// ---------------------------------------------------------------- the Field scale (manual §17.2; O-I #858)
//
// Every world the field shows on one ring round yours, evenly spaced in an order keyed by each ref (so no two stand on one another, and
// the same field draws the same way every time); the stars likewise on a ring within it; a world under cloud is drawn under the one even cloud, its clearings bright on it; a world the audience does not see is a dashed
// ring that says why; each star stands nearer the middle, a line to every world gathered at it, and a dashed stub for those waiting at its edge.

function FieldArt({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const scene = sceneOf(v)
  const cx = w / 2, cy = (h - (size === 'tile' ? 0 : 12)) / 2, ring = Math.min(w, h) * .36, inner = ring * .5
  const named = size === 'whole' || size === 'big', rw = size === 'big' ? 13 : size === 'tile' ? 4 : 6
  if (!scene) return <Gaps gaps={strOf(v, 'fieldWhy') ? [] : ['the shared field']} size={size} centred x={cx} y={cy} />
  const centre = scene.worlds.find(world => world.yours)
  const others = scene.worlds.filter(world => world !== centre)
  const at = new Map<string, readonly [number, number]>()
  if (centre) at.set(centre.ref, [cx, cy])
  const around = (refs: readonly string[], r: number, turn: number) => [...refs].sort((a, b) => hash(a) - hash(b)).forEach((ref, i, all) => {
    const a = turn + i * 6.283 / all.length; at.set(ref, [cx + r * Math.cos(a), cy + r * Math.sin(a)])
  })
  // the stars stand half a step round from the worlds, so a star and its name never sit on a world
  around(others.map(world => world.ref), ring, 2.4)
  around(scene.stars.map(star => star.ref), inner, 2.4 + Math.PI / Math.max(others.length, 1))
  const tail = (ref: string) => ref.split(':').pop() ?? ref
  return <>
    <circle cx={cx} cy={cy} r={ring} className="dp-faint" strokeDasharray="2 3" opacity={.5} />
    {scene.stars.flatMap(star => star.gathered.flatMap(ref => { const a = at.get(ref), b = at.get(star.ref); return a && b ? [<path key={`${star.ref}|${ref}`} d={`M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`} className="dp-curve" strokeWidth={.9} opacity={.7} />] : [] }))}
    {scene.worlds.map(world => { const [x, y] = at.get(world.ref)!
      return <g key={world.ref}>
        <circle cx={x} cy={y} r={rw} fill={world.mine ? 'var(--dp-value-dim)' : 'color-mix(in srgb, var(--text, #d4d7da) 26%, transparent)'}
          stroke={world.mine ? 'var(--dp-value)' : 'var(--text-dim, #a3a8ad)'} strokeWidth={world.yours ? 1.4 : .8} strokeDasharray={world.away ? '2 2' : undefined} opacity={world.away ? .5 : 1} />
        {world.clouded && !world.away && <circle cx={x} cy={y} r={rw} fill="var(--text-dim, #a3a8ad)" opacity={.6} />}
        {world.clearings.map((clearing, i) => { const a = hash(`${world.ref}/${clearing.part}`) * 6.283 + i * .9
          return <circle key={clearing.part + (clearing.star ?? '')} cx={x + Math.cos(a) * rw * .55} cy={y + Math.sin(a) * rw * .55} r={size === 'big' ? 1.8 : 1.2} fill="var(--dp-value)" /> })}
        {named && <text x={world.yours ? x : x + rw + 3} y={world.yours ? y + rw + (size === 'big' ? 12 : 9) : y + 3} textAnchor={world.yours ? 'middle' : 'start'} className="dp-ink-dim"
          style={{fontSize: size === 'big' ? 10 : 8}}>{world.away ? `${tail(world.ref)} · Link off` : tail(world.ref)}</text>}
      </g> })}
    {scene.stars.map(star => { const [x, y] = at.get(star.ref)!, k = size === 'big' ? 6 : 4
      return <g key={star.ref}>
        <path d={`M${f1(x)} ${f1(y - k)}L${f1(x + k * .3)} ${f1(y - k * .3)}L${f1(x + k)} ${f1(y)}L${f1(x + k * .3)} ${f1(y + k * .3)}L${f1(x)} ${f1(y + k)}L${f1(x - k * .3)} ${f1(y + k * .3)}L${f1(x - k)} ${f1(y)}L${f1(x - k * .3)} ${f1(y - k * .3)}Z`} fill="var(--dp-on)" />
        {star.waiting > 0 && <path d={`M${f1(x + k)} ${f1(y + k)}l${k} ${k}`} className="dp-faint" strokeDasharray="2 2" />}
        {named && <text x={x} y={y > cy ? y + k + (size === 'big' ? 11 : 9) : y - k - 3} textAnchor="middle" className="dp-ink-dim" style={{fontSize: size === 'big' ? 10 : 8}}>{star.name}</text>}
      </g> })}
    {size !== 'tile' && <text x={5} y={h - 5} className="dp-axis">{scene.note ?? (size === 'big' ? beyondText(scene) : beyondShort(scene))}</text>}
  </>
}

/** Words broken into lines of at most `width` characters, a word never split. */
const wrapWords = (said: string, width: number): string[] => said.split(/\s+/).reduce<string[]>((lines, word) => {
  const last = lines[lines.length - 1]
  if (last !== undefined && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`
  else lines.push(word)
  return lines
}, [])

function FieldDisplay({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const scene = sceneOf(v)
  return <Display w={w} h={h} label="The field" corner={scene ? `${plural(scene.worlds.length, 'world')} · ${plural(scene.stars.length, 'star')}` : NONE}
    does="Every world the aperture holds, clear where its owner has shown it and under one even cloud elsewhere, and the stars people have made, a line to each world gathered at them.">
    <FieldArt v={v} w={w} h={h} size={size} />
    {!scene && strOf(v, 'fieldWhy') && wrapWords(strOf(v, 'fieldWhy')!, Math.floor((w - 12) / 4.8)).map((line, i, all) =>
      <text key={i} x={w / 2} y={h / 2 + (i - (all.length - 1) / 2) * 11} textAnchor="middle" className="dp-ink-dim">{line}</text>)}
  </Display>
}

const SpaceOrField = (props: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) => (atField(props.v) ? <FieldDisplay {...props} /> : <SpaceDisplay {...props} />)
const WorldDisplay = (props: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) => (strOf(props.v, 'view') === 'graph' ? <GraphDisplay {...props} /> : <SpaceOrField {...props} />)

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
  if (!all) return unreadRows('No reading of the locations.')
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
/** The Field's table beside it in the pane: each world with what you see of it, then each star with who has gathered. */
function FieldTable({v}: {v: V}) {
  const scene = sceneOf(v)
  if (!scene) return <text x={548} y={60} className="dp-ink-dim">{strOf(v, 'fieldWhy') ?? 'No reading of the shared field'}</text>
  const tail = (ref: string) => ref.split(':').pop() ?? ref
  const worlds = scene.worlds.slice(0, 7), stars = scene.stars.slice(0, 4), top = 60 + worlds.length * 20 + 28
  return <>
    <text x={548} y={34} className="dp-axis">world</text><text x={662} y={34} className="dp-axis">shown</text>
    <path d="M548 42H748" className="dp-faint" />
    {worlds.map((world, i) => <g key={world.ref} opacity={world.away ? .5 : 1}>
      <text x={548} y={60 + i * 20} className="dp-ink">{`${tail(world.ref)}${world.yours ? ' (yours)' : ''}`}</text>
      <text x={662} y={60 + i * 20} className="dp-ink-dim">{world.away ? 'Link off' : !world.clouded ? 'all' : world.clearings.length ? `${plural(world.clearings.length, 'clearing')}` : 'under cloud'}</text>
    </g>)}
    <text x={548} y={top - 8} className="dp-axis">star</text><text x={662} y={top - 8} className="dp-axis">gathered</text>
    {stars.map((star, i) => <g key={star.ref}>
      <text x={548} y={top + 12 + i * 20} className="dp-ink">{star.name}</text>
      <text x={662} y={top + 12 + i * 20} className="dp-ink-dim">{`${star.gathered.length}${star.waiting ? ` · ${star.waiting} waiting` : ''}`}</text>
    </g>)}
    <text x={548} y={372} className="dp-axis">{`${APERTURE_LABEL[scene.aperture]} aperture, as ${scene.viewAs === 'me' ? 'you know it' : scene.viewAs === 'field' ? 'the field sees it' : 'the public sees it'}.`}</text>
    <text x={548} y={386} className="dp-axis">Grey: under the one even cloud. Dots: clearings.</text>
    <text x={548} y={400} className="dp-axis">A line: gathered at the star. A stub: waiting.</text>
  </>
}
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
        </> : atField(v) ? <>
          <FieldArt v={v} w={520} h={420} size="big" />
          <FieldTable v={v} />
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
    // The Field (O-I #858): the design's own sample of the held field's world part, as atlasDevices.fieldValues hands it. Yours, with your
    // own body; a project world you hold; Mara's, gathered with yours at your star; a stranger's, waiting at its edge and gathered at another.
    // At your star, Mara asked about what you show there, you answered and corrected what she brought (SF06).
    aperture: 'world', viewAs: 'me', fieldHeld: true, fieldYours: 'body:own:teraphim', cameraScale: 'body',
    starName: '', starGathers: '', starComes: 'anyone', sayWhat: 'question', sayWords: '',
    field: JSON.stringify({
      worlds: [{world_ref: 'world:teraphim', body: {body_ref: 'body:own:teraphim'}, linked: true, mine: true}, {world_ref: 'world:teraphim:o-i', body: {body_ref: 'body:o-i'}, linked: true, mine: true},
        {world_ref: 'world:mara', body: {body_ref: 'body:mara'}, linked: true, mine: false}, {world_ref: 'world:stranger', body: {body_ref: 'body:stranger'}, linked: true, mine: false}],
      clearings: [{world_ref: 'world:teraphim', part_ref: 'page:reading-of-plate-4', star_ref: null, audience: 'public', shown: {kind: 'page', label: 'A reading of the fourth plate'}},
        {world_ref: 'world:teraphim', part_ref: 'place:rosarium-notes', star_ref: null, audience: 'field', shown: {kind: 'place', label: 'Rosarium notes'}},
        {world_ref: 'world:teraphim', part_ref: 'page:for-the-circle', star_ref: 'star:rosarium', audience: 'star', shown: {kind: 'page', label: 'For the circle'}},
        {world_ref: 'world:mara', part_ref: 'page:maras-reading', star_ref: 'star:rosarium', audience: 'star', shown: {kind: 'page', label: 'Mara’s reading of the second plate'}},
        {world_ref: 'world:mara', part_ref: 'page:maras-plate', star_ref: null, audience: 'public', shown: {kind: 'page', label: 'Mara’s plate'}},
        {world_ref: 'world:stranger', part_ref: 'page:elsewhere', star_ref: null, audience: 'public', shown: {kind: 'page', label: 'Elsewhere'}}],
      stars: [{star_ref: 'star:rosarium', name: 'The Rosarium plates', gathers: 'Readings of the Rosarium plates', comes: 'asked', lit_by: 'world:teraphim', mine: true},
        {star_ref: 'star:far', name: 'Far', gathers: 'Something else', comes: 'anyone', lit_by: 'world:stranger', mine: false}],
      gatherings: [{star_ref: 'star:rosarium', world_ref: 'world:teraphim', state: 'gathered'}, {star_ref: 'star:rosarium', world_ref: 'world:mara', state: 'gathered'},
        {star_ref: 'star:rosarium', world_ref: 'world:stranger', state: 'asked'}, {star_ref: 'star:far', world_ref: 'world:stranger', state: 'gathered'}],
      days: [{star_ref: 'star:rosarium', world_ref: 'world:teraphim', what: 'lit', at: Date.UTC(2026, 10, 3, 18, 2)},
        {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'asked', at: Date.UTC(2026, 10, 4, 6, 41)},
        {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'let-in', at: Date.UTC(2026, 10, 4, 6, 44)},
        {star_ref: 'star:rosarium', world_ref: 'world:teraphim', what: 'showed', kind: 'page', at: Date.UTC(2026, 10, 4, 6, 50)},
        {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'showed', kind: 'page', at: Date.UTC(2026, 10, 4, 7, 2)},
        {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'said', kind: 'question', at: Date.UTC(2026, 10, 4, 7, 10)},
        {star_ref: 'star:rosarium', world_ref: 'world:teraphim', what: 'said', kind: 'finding', at: Date.UTC(2026, 10, 4, 7, 18)},
        {star_ref: 'star:rosarium', world_ref: 'world:teraphim', what: 'said', kind: 'correction', at: Date.UTC(2026, 10, 4, 7, 21)},
        {star_ref: 'star:rosarium', world_ref: 'world:stranger', what: 'asked', at: Date.UTC(2026, 10, 4, 7, 30)}],
      sayings: [
        {saying_ref: 'saying:mara-q', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:teraphim', to_part_ref: 'page:for-the-circle', to_saying_ref: null,
          what: 'question', words: 'Where does the circle open on the fourth plate?', at: Date.UTC(2026, 10, 4, 7, 10)},
        {saying_ref: 'saying:teraphim-f', star_ref: 'star:rosarium', world_ref: 'world:teraphim', to_world_ref: null, to_part_ref: null, to_saying_ref: 'saying:mara-q',
          what: 'finding', words: 'At the rose, where the two lines cross.', at: Date.UTC(2026, 10, 4, 7, 18)},
        {saying_ref: 'saying:teraphim-c', star_ref: 'star:rosarium', world_ref: 'world:teraphim', to_world_ref: 'world:mara', to_part_ref: 'page:maras-reading', to_saying_ref: null,
          what: 'correction', words: 'The second plate is the white rose, not the red.', at: Date.UTC(2026, 10, 4, 7, 21)}],
    }),
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
    'Region, one scope': {scale: 'region', cameraScale: 'region', scope: 'this reading', selected: 'athens'},
    'Graph, three steps': {view: 'graph', depth: 3, skyAnchors: true},
    'A wetter, rougher body': {seed: 7, seaLevel: .38, continents: 3.1, relief: .9, coast: 'fjord', moisture: .85, warmth: .4, iceCaps: .55, clouds: .6, tilt: 32},
    'Earth chosen': {body: 'earth'},
    'Field scale': {scale: 'field', aperture: 'shared', viewAs: 'field'},
    'Field, everything': {scale: 'field', aperture: 'federated', viewAs: 'me'},
    'Field not held': {scale: 'field', field: undefined, fieldYours: undefined, fieldHeld: false, fieldWhy: 'This field’s service does not hold worlds yet'},
    'Field, a star chosen': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', fieldWaiting: JSON.stringify(['world:stranger']), fieldAdmit: 'world:stranger',
      starName: 'The Bestiary', starGathers: 'Readings of the medieval beasts', starComes: 'asked',
      fieldSayTo: 'saying:mara-q', sayWhat: 'finding', sayWords: 'It opens where the white rose meets the red.'},
    'Nothing in focus': {'pane.title': undefined, 'pane.controls': JSON.stringify([])},
    'No readings': Object.fromEntries(['light', 'view', 'scale', 'cursor', 'allTime', 'playing', 'cumulative', 'scope', 'wholeField', 'relation', 'selected', 'placeArmed', 'placePage', 'baseKind',
      'graphOpen', 'local', 'depth', 'centre', 'repel', 'link', 'distance', 'tieJung', 'tieInferred', 'tieSite', 'kindArchetype', 'kindTheoretic', 'kindFamily', 'occurrences', 'skyAnchors',
      'places', 'sky', 'graph', 'subject', 'body', 'bodyName', 'seed', 'seaLevel', 'continents', 'relief', 'coast', 'warmth', 'moisture', 'iceCaps', 'atmosphere', 'clouds', 'tilt',
      'placeKind', 'locations', 'bodyRecord', 'bodyLook', 'bodyTime', 'generationNote', 'pane.title', 'pane.controls',
      'aperture', 'viewAs', 'field', 'fieldYours', 'fieldHeld', 'fieldWhy', 'cameraScale', 'fieldStar', 'fieldWaiting', 'fieldAdmit', 'starName', 'starGathers', 'starComes',
      'fieldSayTo', 'sayWhat', 'sayWords', 'dayPage', 'saidPage'].map(k => [k, undefined])),
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
      </> : atField(p.v) ? <>
        {scaleChooser(p)}
        {viewRadio(p)}
        {apertureChooser(p)}
        {viewAsChooser(p)}
      </> : <>
        {timeDial(p)}
        {scaleChooser(p)}
        {viewRadio(p)}
        {allTimeToggle(p)}
      </>}
    </Section>
  </Panel>,

  whole: p => <Panel title="World" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'space', label: 'Space'}, {id: 'star', label: 'Star'}, {id: 'body', label: 'Body'}, {id: 'graph', label: 'Graph'}]}
    page={p.page === 'graph' || p.page === 'body' || p.page === 'star' ? p.page : 'space'} onPage={p.setPage}>
    {p.page === 'star' ? <Band>
      <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
      {hereSection(p)}
      {daySection(p, 190)}
      {saidSection(p)}
      {saySection(p)}
    </Band> : p.page === 'body' ? <>
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
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
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
      {atField(p.v) ? <Band>
        {starSection(p)}
        {atStarSection(p)}
        {lightSection(p)}
        {factorySection(p)}
        <Section label="Reach" grow>
          {apertureChooser(p)}
          {viewAsChooser(p)}
          <Readout label="past the edge" value={beyondText(sceneOf(p.v))} does="What lies just past the edge of the aperture, counted. Widen shows it." />
          {widenAction(p)}
        </Section>
      </Band> : <><Band>
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
          {apertureChooser(p)}
          {viewAsChooser(p)}
          <Readout label="past the edge" value={atField(p.v) ? beyondText(sceneOf(p.v)) : undefined} does="What lies just past the edge of the aperture, counted. Widen shows it." />
          {widenAction(p)}
        </Section>
      </Band>
      <Band>{focusSection(p)}</Band></>}
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
    <SpaceOrField v={p.v} w={112} h={104} size="tile" />
    <div className="ref-tile-side">
      <Readout label="scale" value={strOf(p.v, 'view') === 'graph' ? 'graph' : strOf(p.v, 'scale')} does="How close you look." />
      <Readout label="occasion" value={whenOf(p.v)} does="The year in the window, or all time." />
      <Readout label="shown" value={shownCount(p.v)} does="The places the Earth draws now." />
    </div>
  </Tile>,
}
