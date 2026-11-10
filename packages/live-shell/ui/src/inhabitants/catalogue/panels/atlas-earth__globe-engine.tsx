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
// `starAdmit` and `starClose` go to the held field, each standing dimmed with its reason when it cannot be done. Work and tasks at a star
// (O-I #858 SF12, SF13; the Work page) are Software Factory's and the field's: `factoryRuns` (JSON options) the Runs this window's Factory
// states hold and `factoryRun` the one chosen, `factoryUnits` and `factoryUnit` its task to offer, `grantReads`, `grantTouches` and
// `grantDays` the grant, `fieldWork` and `fieldOffer` a work and a task chosen at the star, `madeLabel`, `madeSummary` and `madeRef` what a
// taken task brings back, `factoryTakers` (JSON options) the Factory states a task is taken up in and `factoryTaker` the one chosen,
// `offerNotes` (JSON, by offer ref) the line for a task an act left half done; the acts `starShow`,
// `starUnshow`, `starOffer`, `offerTake`, `offerReturn`, `offerAccept` and `offerRevoke` go to Factory and then the field. By the hold
// law (manual §16.10) an act that cannot be undone is held and one that can is pressed: Show
// work, Take back and Offer a task are pressed (each has its undoing: Take back, Show work, Revoke); Take, Return, Accept and Revoke are
// held (no other world can take a task taken, what was brought back stands with its offerer, an acceptance enters the Run, a revocation
// is for good).
// Your world in the field (O-I #858 SF01, SF02, SF08, SF14; the Shown page): `fieldWorld` your world as the field holds it and `fieldLinked`
// whether it is linked, `worldName` the name it is to stand under until it is, `yourParts` (JSON {id, kind, label}, and `why` for one that
// cannot be shown) the parts of it that may be shown, `showPart` and `showTo` the one chosen and who is to see it (the field, the public, or the worlds at the star chosen),
// `yourShown` (JSON {id, part, label, kind, reach, star, starName}) what it shows and `shownPart` the one chosen to withdraw, `shownLoad` how much it
// shows in a line; what other worlds withdrew is read from `field` (its `withdrawals`) at the view's aperture; `reached` (JSON {id, name,
// note, does}) what has reached you from the field, who sent it and how it came (atlasDevices.reachedRows). The acts `fieldLink`,
// `fieldUnlink`, `partShow` and `partWithdraw` go to the held field, each dimmed with its reason when it cannot be done. By the hold law
// (DLW build ruling 2026-11-06, from manual §16.10) Link and Show raise your world's reach and are held, since what others saw cannot be
// unseen; Unlink and Withdraw narrow it and are pressed.
// Contributing to what another world shows (O-I #858 SF07; the Contribute page): `contributeTargets` (JSON options) what your world may
// contribute to — a part another world shows you, or a contribution that stands there — and `contributeTo` the one chosen, `contributeWhat`
// and `contributeWords` what it is and its words; `contributions` (JSON {id, name, note, does, mine, yours}) each contribution you read and
// `contribution` the one chosen, `answerWords` the words to answer it with; `contributeWhy` the field's words while its service keeps none.
// The acts `contribute`, `contributionAccept`, `contributionRefuse` and `contributionTakeBack` go to the held field. By the hold law (DLW
// build ruling 2026-11-06, from manual §16.10) Contribute, Accept and Refuse send words where they cannot be unread and are held; Take back
// narrows what stands and is pressed.
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
import {Fragment, useMemo, type CSSProperties} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type RowItem, type Standing, unreadRows} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {WORLD_BODY_GENERATOR, WORLD_BODY_GENERATOR_VERSION, bodyDisc, isWorldBody, parseWorldBody, shoreOf, type BodyLook, type WorldBodyRecord} from '../../../projections/atlas/src/globe/body'
import {discPngUrl} from '../../../projections/atlas/body/discPng'
import {providerLabels} from '../../../projections/atlas/src/data/labels'
import {PaneControls, paneControlsOf, paneReadings, paneTitle} from './paneControls'
import {APERTURE_LABEL, ASKS_TO_COME, GRANT_DAYS, dayAskWhys, NOT_AT_FIELD, NO_HAND_ONS, agentAnswerLine, agentAskLine, fieldGraph, fieldSceneOf, fieldVisitOf, fieldVisitableOf, handOnLine, nameKey, GONE_OLDER, SAID_VERB, sayingToText, goneLine, goneName, leftWords, shownKey, starAt, starDayLine, starSayingLine, starWhen, withdrawnLine, withdrawnName, type Aperture, type Audience, type FieldGraph, type FieldGraphNode, type FieldScene, type FieldTie,
  whoOf, type SceneAsk, type SceneOffer, type SceneStar, type WorldVisit, type YourShown} from '../../../projections/atlas/system/fieldModel'
import {oneLineText} from '../../../central/plainParts'
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
function simulate(nodes: readonly GNode[], edges: readonly (readonly [string, string, number])[], f: typeof DEF_FORCES, local: boolean, pinned: ReadonlyMap<string, Pos>): Map<string, Pos> {
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
    for (const [a, b, weight] of edges) {
      const pa = p.get(a), pb = p.get(b)
      if (!pa || !pb) continue
      const va = vel.get(a)!, vb = vel.get(b)!, dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.max(Math.hypot(dx, dy), 1), pull = (d - rest) * k * weight * al
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
  const pos = useMemo(() => (view ? simulate(view.nodes, view.edges.map(([a, b, basis]) => [a, b, TIE_WEIGHT[basis]] as const), view.forces, view.local, view.pinned) : new Map<string, Pos>()), [key])  // eslint-disable-line react-hooks/exhaustive-deps
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
        return <path key={`${a}|${b}`} d={`M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`} className="dp-curve" opacity={basis === 'jung' ? .85 : basis === 'inferred' ? .6 : .32} strokeDasharray={basis === 'inferred' ? '3 2' : undefined} style={{strokeWidth: basis === 'jung' ? 1.2 : .9}} /> })}
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
const NOT_FIELD = NOT_AT_FIELD

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
/** Aperture and View as: the view's own at Field scale, on its Space side and its Graph side alike (round 27, TO10), dimmed with the
 * field's words while it holds no worlds. */
const atFieldScale = (v: V) => strOf(v, 'scale') === 'field'
const atField = (v: V) => atFieldScale(v) && strOf(v, 'view') !== 'graph'
const atFieldGraph = (v: V) => atFieldScale(v) && strOf(v, 'view') === 'graph'
const reachWhy = (v: V) => strOf(v, 'fieldWhy') ?? (atFieldScale(v) ? undefined : NOT_FIELD)
/** At Field scale the Graph draws the field: the constellation's own controls shape its graph at the other scales. */
const NOT_CONSTELLATION = 'At Field scale the graph draws the field by connection. Steps, forces, ties and kinds shape the constellation’s graph at the other scales.'
const graphWhy = (v: V) => (atFieldScale(v) ? NOT_CONSTELLATION : gate(v))
const apertureChooser = (p: ViewProps) => <Chooser {...stand(p, 'aperture', reachWhy(p.v))} wide label="Aperture" does="How far you look: world, local, shared or federated. It filters the one system and takes you nowhere."
  value={strOf(p.v, 'aperture') ?? ''} options={APERTURE_OPTIONS} onChange={x => p.set('aperture', x)} />
const viewAsChooser = (p: ViewProps) => <Chooser {...stand(p, 'viewAs', reachWhy(p.v))} wide label="View as" does="Who you look as: your world as you know it, as the field sees it, or as the public sees it."
  value={strOf(p.v, 'viewAs') ?? ''} options={VIEW_AS_OPTIONS} onChange={x => p.set('viewAs', x)} />
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
const NO_STAR_HERE = 'No star stands in this aperture: widen it to Shared or Federated.'
/** A world by its name, as its owner gave it (fieldModel.ts whoOf). */
const tailOf = (ref: string) => whoOf(ref)
/** The star chosen, as the field shows it at every aperture (a star you chose stays chosen when the aperture narrows). */
const chosenStar = (v: V): SceneStar | undefined => {
  const ref = strOf(v, 'fieldStar')
  if (!ref) return undefined
  return fieldSceneOf(json<unknown>(v, 'field', null), {aperture: 'federated', viewAs: 'me'}, strOf(v, 'fieldYours') ?? null)?.stars.find(star => star.ref === ref)
}
const waitingOf = (v: V): readonly string[] => json<string[]>(v, 'fieldWaiting', [])
const comesText = (star: SceneStar) => (star.comes === 'anyone' ? 'Anyone gathers at once' : 'Its lighter lets worlds in')
const hereText = (star: SceneStar) => !star.whoRead ? 'Widen to read who is here' : `${star.gathered.length} gathered${star.waiting ? `, ${star.waiting} waiting` : ''}`
const yoursText = (star: SceneStar) => (star.yoursAt === 'gathered' ? 'Your world is gathered here' : star.yoursAt === 'asked' ? 'Your world waits at the edge' : 'Your world is not here')
/** How many characters a row holds whole at a width, name and note together (the kit's 10.5 px rows: 49 at 276 px, as measured). */
const rowRoom = (width: number) => Math.floor(width * 49 / 276)
const STAR_WIDTH = 164
/** The chosen star in lines: its lighter's words for what it gathers (short where they would not stand whole, whole to a reader), who may
 * come, who is there, and where your world stands. */
const starRows = (star: SceneStar): RowItem[] => [
  {id: 'gathers', name: star.gathers.length <= rowRoom(STAR_WIDTH) - 2 ? star.gathers : 'What it gathers', said: star.gathers, light: 'lit', tone: 'value',
    does: `What the star gathers, in its lighter’s words: “${star.gathers}”.`},
  {id: 'comes', name: comesText(star), light: 'lit', does: 'Who may come: anyone at once, or each world its lighter lets in.'},
  {id: 'here', name: hereText(star), light: star.whoRead ? 'lit' : 'dark', does: star.whoRead ? 'The worlds gathered at the star, and those waiting at its edge.'
    : 'Who is at a star none of your worlds is gathered at is read at Federated: a narrower aperture reads your circle’s stars alone.'},
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
  return <Section label="Star" width={STAR_WIDTH}>
    {starChooser(p)}
    <Rows label="At this star" does="The chosen star: what it gathers, who may come, who is there and where your world stands." size={4}
      items={star ? starRows(star) : reachWhy(p.v) ? undefined : []} why={star ? undefined : reachWhy(p.v) ?? 'Choose a star first.'} empty="Choose a star first." />
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

const NO_WORLD_HERE = 'No other world stands in this aperture: widen it to Shared or Federated.'
/** Another's world to watch (DLW build ruling 2026-11-06, from manual §2 "from someone you watch" and §17.2): the worlds this aperture
 * shows that are not yours, and the one chosen wherever it stands. Watch and Unwatch are pressed: a watch shows nothing of yours and
 * raises no reach (§16.10). It is yours alone: the world watched is not told, and nothing counts who watches whom. */
function watchSection(p: ViewProps) {
  const scene = sceneOf(p.v), chosen = strOf(p.v, 'otherWorld')
  const options = (scene?.worlds ?? []).filter(world => !world.mine).map(world => ({value: world.ref, label: tailOf(world.ref),
    does: world.watched ? 'Your world watches it.' : 'Your world does not watch it.'}))
  // an act that would change nothing stands dimmed with its reason, in the binding's words (atlasDevices.ts watchRequest)
  const other = chosen ? scene?.worlds.find(world => world.ref === chosen && !world.mine) : undefined
  const missing = (key: 'worldWatch' | 'worldUnwatch') => !chosen ? 'Choose a world first.' : !other ? undefined
    : key === 'worldWatch' ? (other.watched ? `You watch ${tailOf(other.ref)} already.` : undefined) : (other.watched ? undefined : `You don’t watch ${tailOf(other.ref)}.`)
  return <Section label="Watch" width={104}>
    <Chooser {...stand(p, 'otherWorld', reachWhy(p.v) ?? (options.length || chosen ? undefined : NO_WORLD_HERE))} wide label="World" does="Another world, to watch or unwatch: the worlds this aperture shows."
      value={chosen ?? ''} options={chosen && !options.some(o => o.value === chosen) ? [...options, {value: chosen, label: tailOf(chosen), does: 'Not in this aperture.'}] : options}
      onChange={x => p.set('otherWorld', x)} />
    {workAct(p, 'worldWatch', 'Watch', 'Watch the chosen world: what it shows that you can already read reaches you. It is yours alone: that world is not told, and nothing counts who watches it.',
      workWhy(p, 'worldWatch', missing('worldWatch')))}
    {workAct(p, 'worldUnwatch', 'Unwatch', 'Stop watching the chosen world.', workWhy(p, 'worldUnwatch', missing('worldUnwatch')))}
  </Section>
}

function lightSection(p: ViewProps) {
  // Rename gives the star you hold new words (SF03, a derivation: a re-light by the holder's world that keeps where the star stands)
  const star = chosenStar(p.v)
  return <Section label="Light a star" width={150}>
    <TextField {...stand(p, 'starName', reachWhy(p.v))} wide label="Name" does="The star's name, as the field shows it." value={strOf(p.v, 'starName') ?? ''} placeholder="A star's name" onChange={x => p.set('starName', x)} />
    <TextField {...stand(p, 'starGathers', reachWhy(p.v))} wide label="Gathers" does="What the star gathers: the shared interest it stands for." value={strOf(p.v, 'starGathers') ?? ''} placeholder="What it gathers" onChange={x => p.set('starGathers', x)} />
    <Radio {...stand(p, 'starComes', reachWhy(p.v))} label="Who may come" does="Anyone, or the worlds you let in." value={strOf(p.v, 'starComes') ?? ''} options={COMES_OPTIONS} onChange={x => p.set('starComes', x)} />
    {starAct(p, 'starLight', 'Light a star', 'Light the star in the field with your world gathered at it first. It stays in your hands.')}
    {workAct(p, 'starRename', 'Rename', 'Give the chosen star these words: its name, what it gathers and who may come. It stays where it stands, with every world at it; rename it again to undo it.',
      workWhy(p, 'starRename', !star ? 'Choose a star first.' : star.mine ? undefined : 'Only the one who holds a star renames it.'))}
  </Section>
}

/** The chosen star's day, newest last, as the field lets you read it (SF04): who came, was let in, showed something and left; none
 * while no star is chosen (the list stands empty and says to choose one, or unread with the field's words while it holds no worlds). */
const dayRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.day === null) return unreadRows(json<{dayWhy?: string}>(v, 'field', {}).dayWhy ?? 'No reading of the star’s day.')
  const now = Date.now(), whys = dayAskWhys(star.day)
  return star.day.map((entry, i) => ({id: `${i}`, name: starDayLine(entry), light: entry.what === 'left' || entry.what === 'turned-away' || entry.what === 'took-back' || entry.what === 'unsaid' ? 'dark' : 'lit',
    tone: 'value', ...(entry.at === null ? {} : {note: starWhen(entry.at, now)}), ...(whys[i] ? {why: whys[i]} : {})}))
}
/** What a list of the chosen star says while it holds nothing: its own words, or that no star is chosen. */
const starEmpty = (v: V, words: string) => chosenStar(v) ? words : 'Choose a star first.'
/** A list's page: the one chosen, or the newest until one is. */
const pageOf = (v: V, key: string, rows: readonly RowItem[] | undefined, size: number) => numOf(v, key) ?? Math.max(0, Math.ceil((rows?.length ?? 0) / size) - 1)
function daySection(p: ViewProps, width = 150) {
  const rows = dayRows(p.v), unheld = reachWhy(p.v)
  return <Section label="Star’s day" width={width}>
    <Rows does={`The star’s day, as the field lets you read it: who came, who was let in, who showed or said something there and who left, each with when. What was shown or said stays with whoever showed or said it. ${ASKS_TO_COME}`}
      size={5} page={pageOf(p.v, 'dayPage', rows, 5)} onPage={unheld ? undefined : x => p.set('dayPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={starEmpty(p.v, 'Nothing in this star’s day yet.')} />
  </Section>
}

// ---------------------------------------------------------------- what was said to what at a star (O-I #858, SF06)

const SAY_KINDS = [{value: 'question', label: 'Question', does: 'Ask about it.'}, {value: 'finding', label: 'Finding', does: 'Say what you found in it.'},
  {value: 'correction', label: 'Correction', does: 'Say what is wrong in it.'}, {value: 'reproduction', label: 'Reproduction', does: 'Say that you made it again, and how.'}] as const
/** What a contribution to another world may be: what can be said at a star, or a claim of the same work (SF09). */
const CONTRIBUTE_KINDS = [...SAY_KINDS, {value: 'same', label: 'Same work',
  does: 'Claim it is the same work as a part your world shows: yours stands beside it, and the claim is a contribution others can dispute.'}] as const
/** Who is at the chosen star now and what each brought there: one line for each thing a world shows at the star, and one for a world
 * gathered there that shows nothing. None while no star is chosen. */
const hereRows = (star: SceneStar | undefined): RowItem[] | undefined => star && star.gathered.flatMap((world): RowItem[] => {
  // a world whose owner's machine is off (SF11): what it shows reads as it was left, saying when; its agent and anything live, away
  const brought = star.shown.filter(item => item.world === world), who = tailOf(world), left = star.left[world], now = Date.now()
  return brought.length ? brought.map(item => ({id: item.id, name: item.label, note: left ? `${who}, away` : who, light: left && LIVE_PARTS.has(item.kind) ? 'dark' as const : 'lit' as const,
    does: `A ${item.kind} ${who} shows at the star.${left ? ` ${leftWords(who, item.kind, left, now)}` : ''} Choose it to say something to it.`}))
    : [{id: `here:${world}`, name: who, note: left ? 'away' : undefined, light: 'dark' as const,
      does: left ? `${who} is gathered here and shows nothing at the star. ${leftWords(who, 'world', left, now)}` : `${who} is here and shows nothing at the star.`}]
})
const LIVE_PARTS = new Set(['agent', 'machine', 'work'])
/** What was said at the chosen star, each under what it answers, with when; unread with the field's words where its service keeps none. */
const saidRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.said === null) return unreadRows(json<{sayWhy?: string}>(v, 'field', {}).sayWhy ?? 'No reading of what was said at the star.')
  const now = Date.now()
  // each line whole where it stands whole in the list's width, else who said what to what, else who said what; whole to a reader
  return star.said.map(saying => ({id: saying.ref, said: starSayingLine(saying), note: starWhen(saying.at, now), light: 'lit', tone: saying.mine ? 'value' : undefined,
    name: fitted([starSayingLine(saying), `${saying.who} ${SAID_VERB[saying.what]} ${sayingToText(saying.to)}`, `${saying.who} ${SAID_VERB[saying.what]}`], SAID_WIDTH),
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
  return <Section label="Star" width={260}>
    {starChooser(p)}
    <Rows label="Here now" does="Who is at the star now and what each world brought there. Choose a thing to say something to it on the Said page." size={4}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={star ? 'Nothing is brought to this star yet.' : 'Choose a star first.'}
      selected={strOf(p.v, 'fieldSayTo')} onSelect={unheld ? undefined : id => choose(p, id)} />
  </Section>
}
function saidSection(p: ViewProps) {
  const rows = saidRows(p.v), unheld = reachWhy(p.v)
  // the star whose talk this is, chosen here as on the Star page (it is one choice)
  return <Section label="Said here" width={SAID_WIDTH}>
    {starChooser(p)}
    <Rows does="What was said at the star, to what, by whom and when: each answer under what it answers. A saying stays its sayer’s until they unsay it."
      size={4} page={pageOf(p.v, 'saidPage', rows, 4)} onPage={unheld ? undefined : x => p.set('saidPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={starEmpty(p.v, 'Nothing said here yet.')}
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
  return <Section label="Say" width={150}>
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

// ---------------------------------------------------------------- a world's agent asked at a star (O-I #858, SF10)
//
// Manual §2 and §17.2: "The agent that keeps that world is there to talk to." Your world, gathered at a star, asks the agent of another
// world gathered there by its name, its role or the exact instance running; the ask runs nothing, and waits for that agent's answer, which
// it gives from what its world shows at the star and nothing else. What was asked and answered is your two worlds' alone. Asking is
// pressed, as saying is; taking an ask back is held, as unsaying is.

const ASK_BYS = [{value: 'name', label: 'Name', does: 'Its name: the one word it answers to, without the @.'},
  {value: 'role', label: 'Role', does: 'Its role: the Position its world keeps, whoever holds it now.'},
  {value: 'instance', label: 'Instance', does: 'The exact instance running, as Actuation names it: never a later one in its place.'}] as const
const ASK_ADDRESS: Readonly<Record<string, {readonly label: string; readonly placeholder: string}>> = {
  name: {label: 'Name', placeholder: 'Its name'}, role: {label: 'Role', placeholder: 'Its role'}, instance: {label: 'Instance', placeholder: 'actuation:generation:…'}}
const ASKED_WIDTH = 380
/** The Said page's list of what was said, as wide as the list of what was asked (DLW build ruling 2026-11-06, r42: a fixed width, its
 * lines fitted to it, so the page stands within the expanded band). */
const SAID_WIDTH = 380
const NOT_GATHERED_TO_ASK = 'Your world asks at a star only while it is gathered there.'
/** The longest of a row's forms that stands whole at a width; the whole sentence to a reader. */
const fitted = (forms: readonly string[], width: number) => forms.find(form => [...form].length <= rowRoom(width)) ?? forms[forms.length - 1]!
/** What was asked of a world's agent at the chosen star and what it answered, the answer under each ask; unread with the field's words
 * where its service keeps none. */
const askRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.asks == null) return unreadRows(json<{askWhy?: string}>(v, 'field', {}).askWhy ?? 'No reading of what was asked of an agent at the star.')
  const now = Date.now()
  return star.asks.flatMap((ask): RowItem[] => {
    const asked = agentAskLine(ask), answered = agentAnswerLine(ask), [who] = asked.split(': '), whose = tailOf(ask.to)
    // settled by the window of the world asked (601c ruling 1): closed, in its words, and nothing waits for it
    if (!ask.answer && ask.settled) return [askRow(ask, asked, who!, now), {id: `answer:${ask.ref}`, name: fitted([answered, 'No answer will come'], ASKED_WIDTH), said: answered,
      ...(ask.settled.at === null ? {} : {note: starWhen(ask.settled.at, now)}), light: 'dark',
      does: 'Closed without an answer by the window of the world asked, in its words of why that agent’s answer cannot reach it.'}]
    // asked of a world that is away (SF11): its agent is away with it, and the ask waits until it is back
    if (!ask.answer && ask.left) return [askRow(ask, asked, who!, now), {id: `answer:${ask.ref}`, name: fitted([answered, `Waiting until ${whose} is back`], ASKED_WIDTH), said: answered,
      light: 'dark', does: `${leftWords(whose, 'agent', ask.left, now)} What your world asked waits until ${whose} is back.`}]
    return [
      askRow(ask, asked, who!, now),
      {id: `answer:${ask.ref}`, name: fitted(ask.answer ? [answered, `${ask.answer.agent}: ${ask.answer.words}`, `${ask.answer.agent} answered`] : [answered, 'Waiting for its answer'], ASKED_WIDTH),
        said: answered, ...(ask.answer?.at == null ? {} : {note: starWhen(ask.answer.at, now)}), light: ask.answer ? 'lit' : 'dark',
        does: ask.answer ? 'The agent’s answer, from what its world shows here: the parts it drew on are named while you may see them.' : 'No answer yet: the ask waits for that agent.'}]
  })
}
/** One ask as its row: who asked whom and what, with when. */
const askRow = (ask: SceneAsk, asked: string, who: string, now: number): RowItem => ({id: ask.ref, name: fitted([asked, who], ASKED_WIDTH), said: asked,
  ...(ask.at === null ? {} : {note: starWhen(ask.at, now)}), light: 'lit', tone: ask.mine ? 'value' : undefined,
  does: ask.mine ? 'What your world asked. Choose it to take it back.' : 'What was asked of your world’s agent: it answers from what your world shows here, and nothing else.'})
/** What the face says of asking a world that is away (SF11, in its words): its agent is away with it, and the ask waits. */
const awayToAsk = (who: string) => `${who} is away: nothing answers for it until ${who} is back, and what you ask waits until then.`
const chooseAsk = (p: ViewProps, id: string) => p.set('fieldAsk', id.startsWith('answer:') ? id.slice('answer:'.length) : id)
/** The worlds gathered at the chosen star whose agent your world may ask: every one but yours. */
const askableOf = (v: V, star: SceneStar | undefined): string[] => {
  if (!star) return []
  const all = fieldSceneOf(json<unknown>(v, 'field', null), {aperture: 'federated', viewAs: 'me'}, strOf(v, 'fieldYours') ?? null)
  return star.gathered.filter(ref => !all?.worlds.find(world => world.ref === ref)?.mine)
}
function askAgentSection(p: ViewProps) {
  const star = chosenStar(p.v), worlds = askableOf(p.v, star), by = strOf(p.v, 'askBy')
  const worldWhy = reachWhy(p.v) ?? (!star ? 'Choose a star first.' : star.yoursAt !== 'gathered' ? NOT_GATHERED_TO_ASK : worlds.length ? undefined : 'No other world is gathered at this star.')
  const address = ASK_ADDRESS[by ?? ''] ?? {label: 'Address', placeholder: 'Choose how first'}, chosen = strOf(p.v, 'askWorld'), left = chosen ? star?.left[chosen] : undefined
  // a world whose owner's machine is off is asked all the same (SF11): named away, its agent away with it, and the ask waits
  const away = chosen && left ? ` ${leftWords(tailOf(chosen), 'agent', left, Date.now())} What you ask waits until ${tailOf(chosen)} is back.` : ''
  return <Section label="Ask its agent" width={150}>
    <Chooser {...stand(p, 'askWorld', worldWhy)} wide label="World" does={`The world whose agent to ask: one gathered at the star with yours.${away}`} value={chosen ?? ''}
      options={worlds.map(ref => ({value: ref, label: star?.left[ref] ? `${tailOf(ref)}, away` : tailOf(ref)}))} onChange={x => p.set('askWorld', x)} />
    <Chooser {...stand(p, 'askBy', reachWhy(p.v))} wide label="By" does="How to address its agent: by its name, by its role, or as the exact instance running." value={by ?? ''}
      options={ASK_BYS} onChange={x => p.set('askBy', x)} />
    <TextField {...stand(p, 'askAddress', reachWhy(p.v) ?? (by ? undefined : 'Choose how to address it first.'))} wide label={address.label}
      does="Its name, its role or the instance running, as you chose." value={strOf(p.v, 'askAddress') ?? ''} placeholder={address.placeholder} onChange={x => p.set('askAddress', x)} />
  </Section>
}
function askSection(p: ViewProps) {
  const star = chosenStar(p.v)
  // Ask takes a world, a way to address its agent, its address and the words; Take back an ask of your world's: the face names why not
  // from what it reads, as the binding does
  const askWhy = reachWhy(p.v) ?? (!star ? 'Choose a star first.' : star.yoursAt !== 'gathered' ? NOT_GATHERED_TO_ASK : !strOf(p.v, 'askWorld') ? 'Choose the world whose agent to ask: one gathered at the star.'
    : !strOf(p.v, 'askBy') ? 'Ask its agent by its name, its role or the exact instance running.' : !(strOf(p.v, 'askAddress') ?? '').trim() ? 'Write how to address it first.'
    : !(strOf(p.v, 'askWords') ?? '').trim() ? 'Ask something first.' : undefined)
  const chosen = star?.asks?.find(ask => ask.ref === strOf(p.v, 'fieldAsk')), toAsk = strOf(p.v, 'askWorld'), away = toAsk && star?.left[toAsk] ? ` ${awayToAsk(tailOf(toAsk))}` : ''
  const unaskWhy = reachWhy(p.v) ?? (!chosen ? 'Choose something your world asked, in what was asked here.' : chosen.mine ? undefined : 'Only the world that asked takes an ask back.')
  return <Section label="Ask" width={150}>
    <TextField {...stand(p, 'askWords', reachWhy(p.v))} wide label="Words" does="What you ask its agent, in your own words: at most 1000 characters." value={strOf(p.v, 'askWords') ?? ''}
      placeholder="What you ask" onChange={x => p.set('askWords', x)} />
    <Action {...stand(p, 'agentAsk', askWhy)} label="Ask" does={`Ask that world’s agent at the star, under your world’s name. It runs nothing: it waits for the agent’s answer, and your two worlds alone read it.${away}`}
      onPress={() => p.set('agentAsk', Date.now())} />
    <Action {...stand(p, 'agentUnask', unaskWhy)} label="Take back" does="Take back what your world asked, chosen in what was asked here, answered or not." hold
      onPress={() => p.set('agentUnask', Date.now())} />
  </Section>
}
function askedSection(p: ViewProps) {
  const rows = askRows(p.v), unheld = reachWhy(p.v)
  return <Section label="Asked here" width={ASKED_WIDTH}>
    <Rows does="What your world asked another world’s agent here and what was asked of yours, each with the agent’s answer under it: your two worlds’ alone."
      size={4} items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={starEmpty(p.v, 'Nothing asked of an agent here yet.')}
      selected={strOf(p.v, 'fieldAsk')} onSelect={unheld ? undefined : id => chooseAsk(p, id)} />
  </Section>
}

// ---------------------------------------------------------------- a star handed on (O-I #858, SF03)

const HANDED_WIDTH = 350
/** Why the field reads no star handed on: its words, or that its service keeps none. */
const handOnsWhy = (v: V): string | undefined => {
  const field = json<{handOns?: unknown; handOnWhy?: string | null}>(v, 'field', {})
  return Array.isArray(field.handOns) ? undefined : field.handOnWhy ?? NO_HAND_ONS
}
const HOLDER_HANDS = 'Only the one who holds a star hands it on.'
/** Hand on, Keep and Take it on (SF03, DLW build ruling 2026-11-06; the acts' shape is a derivation): the one who holds a star hands it
 * on to a world gathered at it, and it is theirs once that world takes it on. Hand on and Keep undo each other and are pressed; Take it
 * on moves the star into your hands, which you cannot undo alone, and is held (§16.10). The face names why not from what it reads, in
 * the binding's words. */
function handOnSection(p: ViewProps) {
  const star = chosenStar(p.v), hand = star?.handOn ?? null, to = strOf(p.v, 'handTo'), worlds = askableOf(p.v, star)
  const read = !star ? 'Choose a star first.' : handOnsWhy(p.v)
  const toWhy = reachWhy(p.v) ?? read ?? (!star!.mine ? HOLDER_HANDS : worlds.length ? undefined : 'No other world is gathered at this star.')
  const handWhy = read ?? (!star!.mine ? HOLDER_HANDS : !to ? 'Choose a world gathered at the star to hand it on to.'
    : hand?.to === to ? `It is handed on to ${tailOf(to)} already: it waits for them to take it on.` : undefined)
  const keepWhy = read ?? (!star!.mine ? 'Only the one who holds a star keeps it.' : hand ? undefined : 'The star is not being handed on.')
  const takeWhy = read ?? (!hand?.toYou ? 'That star is not being handed on to your world.' : star!.gathered.includes(hand.to) ? undefined : 'Your world takes a star on only while it is gathered there.')
  return <Section label="Hand on" width={150}>
    <Chooser {...stand(p, 'handTo', toWhy)} wide label="Hand to" does="The world to hand the star on to: one gathered at it with yours." value={to ?? ''}
      options={worlds.map(ref => ({value: ref, label: tailOf(ref)}))} onChange={x => p.set('handTo', x)} />
    {workAct(p, 'starHandOn', 'Hand on', 'Hand the star on to the chosen world. It stays in your hands until that world takes it on; Keep takes it back.', workWhy(p, 'starHandOn', handWhy))}
    {workAct(p, 'starKeep', 'Keep', 'Keep the star you were handing on: it stays in your hands, and the world you chose can no longer take it on.', workWhy(p, 'starKeep', keepWhy))}
    {workAct(p, 'starTakeOn', 'Take it on', 'Hold to take on the star handed to your world: it is yours from then, to let worlds in, close or hand on; the one who held it cannot take it back.',
      workWhy(p, 'starTakeOn', takeWhy), true)}
  </Section>
}
/** The chosen star handed on, as a line: by your world, to it, or not at all (in the list's empty place). */
function handedSection(p: ViewProps) {
  const star = chosenStar(p.v), unheld = reachWhy(p.v), why = star ? handOnsWhy(p.v) : undefined, hand = star?.handOn ?? null, now = Date.now()
  const rows: RowItem[] | undefined = !star ? undefined : why ? unreadRows(why) : !hand ? [] : [{id: 'hand-on', said: handOnLine(star),
    name: fitted([handOnLine(star), hand.byYou ? `You are handing ${star.name} on to ${tailOf(hand.to)}` : `${tailOf(hand.from)} hands ${star.name} on to your world`], HANDED_WIDTH),
    light: 'lit', ...(hand.byYou ? {tone: 'value' as const} : {}), ...(hand.at === null ? {} : {note: starWhen(hand.at, now)}),
    does: hand.byYou ? 'Until it is taken on the star stays in your hands: Keep takes it back.' : 'Take it on and the star is yours: you let worlds in, close it and hand it on.'}]
  return <Section label="Handed on" width={HANDED_WIDTH}>
    <Rows does="The chosen star handed on by your world or to it, while it waits to be taken on: the two worlds alone read it." size={2}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={star ? handOnLine(star) : 'Choose a star first.'} />
  </Section>
}

// ---------------------------------------------------------------- work and tasks at a star (O-I #858, SF12, SF13)

const NO_RUN = 'Choose a Run of Software Factory’s first.'
const NO_TASK = 'Choose the task to offer: a unit of the Run.'
const NO_OFFER = 'Choose a task offered here.'
/** Why an act on work or a task at a star cannot be done: the field's words, then the binding's, then what the face sees is missing. */
const workWhy = (p: ViewProps, key: string, missing?: string) => reachWhy(p.v) ?? st(p, key).disabled ?? missing
const workAct = (p: ViewProps, key: string, label: string, does: string, why: string | undefined, hold = false) =>
  <Action {...stand(p, key, why)} key={key} label={label} does={does} hold={hold} onPress={() => p.set(key, Date.now())} />
/** The Run to show or offer from: the Runs this window's Factory states hold, by the names Factory shows them by. */
const runChooser = (p: ViewProps) => <Chooser {...stand(p, 'factoryRun', reachWhy(p.v))} wide label="Run" does="A Run of Software Factory’s, to show its work at the star or offer one of its tasks there."
  value={strOf(p.v, 'factoryRun') ?? ''} options={json<{value: string; label: string; does?: string}[]>(p.v, 'factoryRuns', [])} onChange={x => p.set('factoryRun', x)} />
// What can be undone is pressed, never held (manual §16.10): Take back undoes Show work, Show work undoes Take back, and Revoke
// withdraws a task offered until what came back to it is accepted
const showAct = (p: ViewProps) => workAct(p, 'starShow', 'Show work', 'Show the Run’s work at the star as Software Factory shows it: its agents at work and what they made, for the worlds gathered there. Take back undoes it.',
  workWhy(p, 'starShow', strOf(p.v, 'factoryRun') ? undefined : NO_RUN))
const unshowAct = (p: ViewProps) => workAct(p, 'starUnshow', 'Take back', 'Take the chosen work back from the star: it goes back under cloud. Show work shows it again.',
  workWhy(p, 'starUnshow', strOf(p.v, 'fieldWork') ? undefined : 'Choose a work your world shows here.'))
const offerAct = (p: ViewProps) => workAct(p, 'starOffer', 'Offer a task', 'Offer the Run’s task at the star under the grant you set, for another world’s agent to take up. Revoke withdraws it.',
  workWhy(p, 'starOffer', !strOf(p.v, 'factoryRun') ? NO_RUN : strOf(p.v, 'factoryUnit') ? undefined : NO_TASK))

function factorySection(p: ViewProps) {
  return <Section label="Factory" width={104}>
    {runChooser(p)}
    {showAct(p)}
    {offerAct(p)}
    <Action label="Work ›" does="The work shown at the star and the tasks offered there stand on the Work page, with taking a task up, bringing back what was made, accepting it and revoking it." onPress={() => p.setPage('work')} />
  </Section>
}

/** The task chosen at the chosen star, as the field shows it to you. */
const chosenOffer = (v: V): SceneOffer | undefined => {
  const ref = strOf(v, 'fieldOffer')
  return ref ? chosenStar(v)?.offers?.find(offer => offer.ref === ref) : undefined
}
const workUnread = (v: V) => unreadRows(json<{workWhy?: string}>(v, 'field', {}).workWhy ?? 'No reading of what is shown and offered at the star.')
/** The work each world shows at the chosen star: its name with whose it is, then its agents at work and what they made, as Factory
 * showed it. A live work whose window answers no more is away, as it was last shown (manual §17.2). A work your world shows is chosen
 * to take it back. */
const workRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.works === null) return workUnread(v)
  const now = Date.now()
  return star.works.flatMap((work): RowItem[] => [
    {id: work.workRef, name: work.name, note: work.away ? `${work.who}, away` : work.who, light: work.standing === 'live' && !work.away ? 'lit' : 'dark', tone: work.mine ? 'value' : undefined,
      does: `${work.mine ? 'Your world’s' : `${work.who}’s`} Run, ${work.away ? `as it was last shown${work.shownAt !== null ? ` ${starAt(work.shownAt, now)}` : ''}: the window that showed it answers no more`
        : work.standing === 'live' ? 'live while it is open and its window answers' : 'as it was kept once it closed'}.${work.mine ? ' Choose it to take it back.' : ''}`},
    // what an agent is doing and where what it made stands are Factory's words for another's Run: shown plain (be2k ruling 3)
    ...work.agents.map((agent, i): RowItem => ({id: `at:${work.workRef}:a${i}`, name: `${agent.agent} ${oneLineText(agent.at)}`, light: agent.at === 'runs' ? 'lit' : 'dark', does: 'An agent at work on the Run, and what it is doing.'})),
    ...work.made.map((made, i): RowItem => ({id: `at:${work.workRef}:m${i}`, name: `Made: ${made.label}`, note: oneLineText(made.standing), light: 'lit', does: 'Something the Run made, and where it stands.'}))])
}
/** Refs and paths a task's grant or what came back names, as a row says them: each on one line, plain, those with nothing visible left
 * out (be2k ruling 3); the offer keeps them as they were given, and the Touched chooser sends one of those. */
const plainList = (items: readonly string[]): string => items.map(oneLineText).filter(Boolean).join(', ')
const OFFER_NOTE: Readonly<Record<SceneOffer['state'], string>> = {open: 'open', taken: 'taken', returned: 'back', accepted: 'accepted', revoked: 'revoked'}
/** The tasks offered at the chosen star: what each asks, with where it stands, and under one you offered or took, what came back. A task
 * an act of yours left half done is marked on its own row, with the binding's line for it (what pressing again finishes, or what Factory
 * refused) as the row's reason: in its place in the list, never on a page apart from it. */
const offerRows = (v: V): RowItem[] | undefined => {
  const star = chosenStar(v)
  if (!star) return undefined
  if (star.offers === null) return workUnread(v)
  const now = Date.now(), notes = json<Record<string, string>>(v, 'offerNotes', {})
  return star.offers.flatMap((offer): RowItem[] => [
    {id: offer.ref, name: offer.asks, note: notes[offer.ref] ? (offer.state === 'revoked' ? 'refused' : 'finish') : offer.yoursTook ? 'yours' : OFFER_NOTE[offer.state],
      why: notes[offer.ref], light: offer.state === 'accepted' || offer.state === 'revoked' ? 'dark' : 'lit', tone: offer.mine ? 'value' : undefined,
      does: `${offer.mine ? 'Your world’s' : `${offer.who}’s`} task ${oneLineText(offer.key)}: it reads ${plainList(offer.reads) || 'nothing'} and touches ${plainList(offer.touches) || 'nothing'} until ${starWhen(offer.lapsesAt, now)}.${offer.taker ? ` ${offer.yoursTook ? 'Your world' : tailOf(offer.taker)} took it up.` : ''}`},
    ...(offer.returned ? [{id: `back:${offer.ref}`, name: `${offer.returned.by} brought back ${offer.returned.label}: ${offer.returned.summary}`, light: 'lit' as const,
      does: `What ${offer.returned.by} brought back to the task, under its maker’s name${plainList(offer.returned.refs) ? `: ${plainList(offer.returned.refs)}` : ''}.`}] : [])])
}
const chooseOffer = (p: ViewProps, id: string) => { if (!id.startsWith('back:')) p.set('fieldOffer', id) }
const chooseWork = (p: ViewProps, id: string) => { if (!id.startsWith('at:')) p.set('fieldWork', id) }

/** The Work page's star: the one chosen, the Run, and the work shown there. */
function shownSection(p: ViewProps) {
  const rows = workRows(p.v), unheld = reachWhy(p.v)
  return <Section label="Shown here" grow>
    <Rows does="The work each world shows at the star, as Software Factory showed it: the Run’s name and whose it is, its agents at work and what they made. Choose a work your world shows to take it back."
      size={5} page={pageOf(p.v, 'workPage', rows, 5)} onPage={unheld ? undefined : x => p.set('workPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={starEmpty(p.v, 'No work shown here yet.')}
      selected={strOf(p.v, 'fieldWork')} onSelect={unheld ? undefined : id => chooseWork(p, id)} />
  </Section>
}
function runSection(p: ViewProps) {
  return <Section label="Work" width={150}>
    {starChooser(p)}
    {runChooser(p)}
    {showAct(p)}
    {unshowAct(p)}
    {takerChooser(p)}
  </Section>
}
/** [SF13] The Software Factory a task your world takes up runs in: each state this window locates, by its project. It stands with the
 * Run, as the Factory side of the work at the star; Take, below, takes a task up in it. */
const takerChooser = (p: ViewProps) =>
  <Chooser {...stand(p, 'factoryTaker', reachWhy(p.v))} wide label="Factory" does="The Software Factory a task you take up runs in, on this machine: each state this window locates, by its project."
    value={strOf(p.v, 'factoryTaker') ?? ''} options={json<{value: string; label: string; does?: string}[]>(p.v, 'factoryTakers', [])} onChange={x => p.set('factoryTaker', x)} />
const daysDial = (p: ViewProps) => <Dial {...stand(p, 'grantDays', reachWhy(p.v))} label="Days" does="How many days the grant stands from the offer: thirty at most. It lapses then."
  value={numOf(p.v, 'grantDays') ?? NaN} def={7} scale={{min: GRANT_DAYS.min, max: GRANT_DAYS.max, step: 1}} format={x => `${Math.round(x)} d`} onChange={x => p.set('grantDays', Math.round(x))} />
function offerSection(p: ViewProps) {
  const run = strOf(p.v, 'factoryRun')
  return <Section label="Offer" width={150}>
    <Chooser {...stand(p, 'factoryUnit', reachWhy(p.v) ?? st(p, 'factoryUnit').disabled ?? (run ? undefined : 'Choose a Run first.'))} wide label="Task" does="The task to offer: a unit of the Run."
      value={strOf(p.v, 'factoryUnit') ?? ''} options={json<{value: string; label: string}[]>(p.v, 'factoryUnits', [])} onChange={x => p.set('factoryUnit', x)} />
    <TextField {...stand(p, 'grantReads', reachWhy(p.v))} wide label="Reads" does="What the task may read: refs, at least one, apart by commas." value={strOf(p.v, 'grantReads') ?? ''}
      placeholder="project:river/docs" onChange={x => p.set('grantReads', x)} />
    <TextField {...stand(p, 'grantTouches', reachWhy(p.v))} wide label="Touches" does="What the task may change: refs, apart by commas. What comes back names nothing else." value={strOf(p.v, 'grantTouches') ?? ''}
      placeholder="project:river/maps" onChange={x => p.set('grantTouches', x)} />
    {offerAct(p)}
  </Section>
}
function offeredSection(p: ViewProps) {
  const rows = offerRows(p.v), unheld = reachWhy(p.v)
  return <Section label="Offered here" grow>
    <Rows does="The tasks offered at the star: what each asks and where it stands, and under one you offered or took, what came back. Choose one to take it up, bring back what was made, accept it or revoke it."
      size={5} page={numOf(p.v, 'offerPage') ?? 0} onPage={unheld ? undefined : x => p.set('offerPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'Choose a star first.'} empty={starEmpty(p.v, 'No task offered here yet.')}
      selected={strOf(p.v, 'fieldOffer')} onSelect={unheld ? undefined : id => chooseOffer(p, id)} />
  </Section>
}
// What cannot be undone is held (manual §16.10): a task taken is no other world's to take and nothing hands it back; what was brought
// back stands with its offerer under your world's name; an acceptance enters the Run under its maker's name; a revocation is for good
function takeSection(p: ViewProps) {
  const offer = chosenOffer(p.v), chose = strOf(p.v, 'fieldOffer') ? undefined : NO_OFFER
  return <Section label="Take up" width={150}>
    {workAct(p, 'offerTake', 'Take', 'Hold to take it up for your world under its grant: no other world can take it then, and nothing hands it back.', workWhy(p, 'offerTake', chose), true)}
    <TextField {...stand(p, 'madeLabel', reachWhy(p.v))} wide label="Made" does="What the task made, by its name." value={strOf(p.v, 'madeLabel') ?? ''} placeholder="What was made" onChange={x => p.set('madeLabel', x)} />
    <TextField {...stand(p, 'madeSummary', reachWhy(p.v))} wide label="Summary" does="What was made, in a line." value={strOf(p.v, 'madeSummary') ?? ''} placeholder="In a line" onChange={x => p.set('madeSummary', x)} />
    <Chooser {...stand(p, 'madeRef', reachWhy(p.v) ?? (offer ? undefined : NO_OFFER))} wide label="Touched" does="What the task touched, of what its grant lets it touch."
      value={strOf(p.v, 'madeRef') ?? ''} options={(offer?.touches ?? []).map(ref => ({value: ref, label: tailOf(ref)}))} onChange={x => p.set('madeRef', x)} />
    {workAct(p, 'offerReturn', 'Return', 'Hold to bring back what was made: it stands with the task’s offerer under your world’s name, and nothing takes it back.', workWhy(p, 'offerReturn', chose), true)}
  </Section>
}
function yoursSection(p: ViewProps) {
  const chose = strOf(p.v, 'fieldOffer') ? undefined : NO_OFFER
  return <Section label="Yours" width={92}>
    {workAct(p, 'offerAccept', 'Accept', 'Hold to accept what came back to your task: it enters the Run under its maker’s name.', workWhy(p, 'offerAccept', chose), true)}
    {workAct(p, 'offerRevoke', 'Revoke', 'Hold to revoke your task for good: its grant ends, and nothing that comes back to it enters the work.', workWhy(p, 'offerRevoke', chose), true)}
  </Section>
}

// ---------------------------------------------------------------- contributing to what another world shows (O-I #858 SF07)

/** Each contribution you read, in the order it came, as the binding lines it: who contributed what to what, and where it stands. Unread
 * with the field's words while its service keeps none. */
const contributionItems = (v: V): RowItem[] | undefined => {
  const rows = json<{id: string; name: string; note: string; does: string; mine: boolean; yours: boolean}[] | undefined>(v, 'contributions', undefined)
  if (!rows) { const why = strOf(v, 'contributeWhy'); return why ? unreadRows(why) : undefined }
  return rows.map(row => ({id: row.id, name: row.name, note: row.note, light: row.note === 'refused' ? 'dark' : 'lit', tone: row.mine || row.yours ? 'value' : undefined,
    does: `${row.does}${row.yours && row.note === 'waits for you' ? ' Choose it to accept or refuse it.' : row.mine ? ' Choose it to take it back.' : ''}`}))
}
const contributeWhy = (v: V) => reachWhy(v) ?? strOf(v, 'contributeWhy')
function contributeSection(p: ViewProps) {
  const targets = json<{value: string; label: string; does?: string}[] | undefined>(p.v, 'contributeTargets', undefined)
  return <Section label="Contribute" width={220}>
    <Chooser {...stand(p, 'contributeTo', contributeWhy(p.v) ?? (targets?.length ? undefined : 'Nothing another world shows you yet.'))} wide label="To"
      does="What to contribute to: a part another world shows you, or a contribution that stands there." value={strOf(p.v, 'contributeTo') ?? ''} options={targets ?? []}
      onChange={x => p.set('contributeTo', x)} />
    <Chooser {...stand(p, 'contributeWhat', contributeWhy(p.v))} wide label="Kind" does="What it is: a question, a finding, a correction or a reproduction."
      value={strOf(p.v, 'contributeWhat') ?? ''} options={CONTRIBUTE_KINDS} onChange={x => p.set('contributeWhat', x)} />
    <TextField {...stand(p, 'contributeWords', contributeWhy(p.v))} wide label="Words" does="What you contribute, in your own words: at most 1000 characters."
      value={strOf(p.v, 'contributeWords') ?? ''} placeholder="What you contribute" onChange={x => p.set('contributeWords', x)} />
    <Action {...st(p, 'contribute')} label="Contribute" hold does="Hold to contribute it: it stands on what you chose under your world’s name and waits for that world’s owner, who reads it and cannot unread it. It stays yours until they accept it in their world."
      onPress={() => p.set('contribute', Date.now())} />
  </Section>
}
/** Why Accept, Refuse or Take back would change nothing on the contribution chosen, in the binding's words (atlasDevices.ts
 * contributionRequest): the field's words first, then the binding's, then what the face reads of the row chosen. */
function answerWhy(p: ViewProps, key: 'contributionAccept' | 'contributionRefuse' | 'contributionTakeBack'): string | undefined {
  const chosen = strOf(p.v, 'contribution'), rows = json<{id: string; note: string; mine: boolean; yours: boolean}[] | undefined>(p.v, 'contributions', undefined)
  const row = chosen ? rows?.find(one => one.id === chosen) : undefined
  const missing = !chosen ? 'Choose a contribution first.' : !row ? undefined
    : key === 'contributionTakeBack' ? (row.mine ? undefined : 'Only the one who contributed it takes it back.')
    : !row.yours ? 'Only the owner of the world it was contributed to answers it.'
    : row.note === 'accepted' ? 'It is accepted: it stands in your world.' : row.note === 'refused' ? 'It was refused: it waits no more.'
    : key === 'contributionRefuse' && !(strOf(p.v, 'answerWords') ?? '').trim() ? 'Say why, in your own words.' : undefined
  return contributeWhy(p.v) ?? st(p, key).disabled ?? missing
}
/** The part of yours a claim of the same work sets beside what you contribute to (SF09; STORIES SF09: two things with one name in two
 * worlds stay two until someone claims they are one): what your world shows, any part of it, those named as the target first. The match
 * by name is made in this window and sends nothing; a part you hold by that name but do not show is named to you alone, to show first. */
function besideSection(p: ViewProps) {
  const shown = json<{id: string; label: string; kind: string; reach: string}[]>(p.v, 'yourShown', [])
  const to = strOf(p.v, 'contributeTo'), target = json<{value: string; name?: string}[]>(p.v, 'contributeTargets', []).find(one => one.value === to)
  const named = target?.name ? nameKey(target.name) : ''
  const matches = (label: string) => named !== '' && nameKey(label) === named
  const options = [...shown].sort((a, b) => Number(matches(b.label)) - Number(matches(a.label))).map(row => ({value: row.id, label: row.label,
    does: `A ${row.kind} your world shows ${row.reach === 'star' ? 'at a star' : row.reach === 'public' ? 'to the public' : 'to the field'}.${matches(row.label) ? ' It bears the name of what you contribute to.' : ''}`}))
  const unshown = named !== '' && !shown.some(row => matches(row.label)) ? json<{label: string; why?: string}[]>(p.v, 'yourParts', []).find(part => !part.why && matches(part.label)) : undefined
  const why = contributeWhy(p.v) ?? st(p, 'contributeBeside').disabled ?? (strOf(p.v, 'contributeWhat') !== 'same' ? 'Choose Same work as the kind: only a claim of the same work sets a part of yours beside it.'
    : to && !to.startsWith('[') ? 'A work is claimed the same as something a world shows, not as a contribution.'
    : !shown.length ? 'Show a part of your world first: only a part you show stands beside another’s.' : undefined)
  return <Section label="Beside it" width={190}>
    <Chooser {...stand(p, 'contributeBeside', why)} wide label="Yours" value={strOf(p.v, 'contributeBeside') ?? ''} options={options} onChange={x => p.set('contributeBeside', x)}
      does={`The part of yours the claim sets beside what you contribute to, as one work: your reading beside theirs. It is named only to those who may read it.${unshown ? ` You hold ${unshown.label} by that name but do not show it: show it first to set it beside.` : ''}`} />
  </Section>
}
function answerSection(p: ViewProps) {
  return <Section label="Answer" width={150}>
    <TextField {...stand(p, 'answerWords', contributeWhy(p.v))} wide label="Words" does="Your words to its contributor: why you refuse it, or a word as you accept it."
      value={strOf(p.v, 'answerWords') ?? ''} placeholder="Your words" onChange={x => p.set('answerWords', x)} />
    <Action {...stand(p, 'contributionAccept', answerWhy(p, 'contributionAccept'))} label="Accept" hold does="Hold to accept it into your world: it stands on what it was contributed to, under its contributor’s name, for whoever reads that."
      onPress={() => p.set('contributionAccept', Date.now())} />
    <Action {...stand(p, 'contributionRefuse', answerWhy(p, 'contributionRefuse'))} label="Refuse" hold does="Hold to refuse it, in your words: they reach its contributor alone, and it enters no one’s world."
      onPress={() => p.set('contributionRefuse', Date.now())} />
    <Action {...stand(p, 'contributionTakeBack', answerWhy(p, 'contributionTakeBack'))} label="Take back" does="Take back a contribution of yours, waiting, accepted or refused: it stands nowhere after, for anyone."
      onPress={() => p.set('contributionTakeBack', Date.now())} />
  </Section>
}
function contributionsSection(p: ViewProps) {
  const rows = contributionItems(p.v), unheld = reachWhy(p.v)
  return <Section label="Contributions" grow>
    <Rows does="The contributions you read: who contributed what to what, and where each stands. One waiting in your world waits for you to accept or refuse it; your own you may take back."
      size={4} page={numOf(p.v, 'contributionPage') ?? 0} onPage={unheld ? undefined : x => p.set('contributionPage', x)}
      items={rows ?? (unheld ? undefined : [])} why={rows ? undefined : unheld ?? 'No reading of the contributions.'} empty="Nothing contributed where you read yet."
      selected={strOf(p.v, 'contribution')} onSelect={unheld ? undefined : id => p.set('contribution', id)} />
  </Section>
}

// ---------------------------------------------------------------- your world in the field: Link, Show, Withdraw (O-I #858 SF01, SF02, SF14)

const SHOW_TO_OPTIONS = [{value: 'field', label: 'Field', does: 'The worlds in the field.'}, {value: 'public', label: 'Public', does: 'Anyone who reads the field, in it or not.'},
  {value: 'star', label: 'Star', does: 'The worlds gathered at the star chosen, while yours is gathered there too.'}] as const
const REACH_TEXT: Readonly<Record<string, string>> = {public: 'to the public', field: 'to the field', star: 'at a star'}
/** Your world as the field holds it: the name it stands under while linked, out while not, not yet while it never was; unread while the
 * field holds no worlds. */
const inFieldText = (v: V): string | undefined => {
  if (boolOf(v, 'fieldHeld') !== true) return undefined
  const world = strOf(v, 'fieldWorld')
  return !world ? 'not yet' : boolOf(v, 'fieldLinked') ? tailOf(world) : 'out'
}
function yourFieldSection(p: ViewProps) {
  return <Section label="Your world" width={150}>
    <TextField {...st(p, 'worldName')} wide label="Name" does="The name your world stands in the field under, from when it is first linked." value={strOf(p.v, 'worldName') ?? ''}
      placeholder="Your world’s name" onChange={x => p.set('worldName', x)} />
    <Readout label="In the field" value={inFieldText(p.v)} tone={boolOf(p.v, 'fieldLinked') ? 'value' : undefined} does="Your world in the field: the name it stands under while it is linked, out while it is not." />
    <Action {...st(p, 'fieldLink')} label="Link" hold does="Hold to link your world into the field: the others see its planet, drawn from your own body, and nothing in it until you show it. What they see then cannot be unseen."
      onPress={() => p.set('fieldLink', Date.now())} />
    <Action {...st(p, 'fieldUnlink')} label="Unlink" does="Take your world out of the field. Everything in it stays as it was, and whoever read it reads that it left. Link brings it back."
      onPress={() => p.set('fieldUnlink', Date.now())} />
  </Section>
}
function yourShowSection(p: ViewProps) {
  const parts = json<{id: string; kind: string; label: string; why?: string}[]>(p.v, 'yourParts', [])
  return <Section label="Show a part" width={150}>
    <Chooser {...stand(p, 'showPart', parts.length ? undefined : 'No place stands on your own body yet: place one on the Body page.')} wide label="Part" does="A part of your world to show: a place on your own body, a world of yours that lands on it, or an entry of today's Day."
      value={strOf(p.v, 'showPart') ?? ''} options={parts.map(part => ({value: part.id, label: part.label, does: `A ${part.kind} of your world.`, ...(part.why ? {why: part.why} : {})}))} onChange={x => p.set('showPart', x)} />
    <Radio {...st(p, 'showTo')} label="To" does="Who sees it: the field, the public, or the worlds at the star chosen." value={strOf(p.v, 'showTo') ?? ''} options={SHOW_TO_OPTIONS} onChange={x => p.set('showTo', x)} />
    <Action {...st(p, 'partShow')} label="Show" hold does="Hold to show it to whom you chose: they see it in its clearing, and what they saw cannot be unseen. Withdraw puts it back under cloud."
      onPress={() => p.set('partShow', Date.now())} />
  </Section>
}
const SEARCHES_WIDTH = 180
/** Your searches over the shared field (DLW build ruling 2026-11-06, from manual §18.4 `@name = search` with its Reach): written as
 * `@name = words`, kept in this window, and what is newly shown, said, offered or contributed there that holds every word reaches you from
 * it. Keep and Forget are pressed: a search shows nothing of yours and raises no reach (§16.10). Each kept search stands whole: its name,
 * with its words beside it where they fit and whole to a reader. */
function searchesSection(p: ViewProps) {
  const kept = json<{name: string; words: string}[] | undefined>(p.v, 'fieldSearches', undefined), room = rowRoom(SEARCHES_WIDTH)
  const chosen = strOf(p.v, 'fieldSearch'), line = strOf(p.v, 'searchLine') ?? ''
  // Keep and Forget stand dimmed where they would change nothing, in the binding's words (atlasDevices.ts keptSearch, searchValues)
  const keepWhy = workWhy(p, 'searchKeep', line.trim() ? undefined : 'Type @name = the words to look for.')
  const forgetWhy = workWhy(p, 'searchForget', kept && !kept.length ? 'You keep no search yet: there is none to forget.' : kept && !kept.some(one => one.name === chosen) ? 'Choose a search first.' : undefined)
  const items = kept?.map((one): RowItem => ({id: one.name, name: `@${one.name}`, said: `@${one.name} = ${one.words}`, light: 'lit', tone: 'value',
    note: one.name.length + 1 + one.words.length <= room - 2 ? one.words : undefined, does: `Your search @${one.name}: what is newly shown, said, offered or contributed in the field that holds every word of “${one.words}” reaches you from it. Choose it to forget it.`}))
  return <Section label="Search the field" width={SEARCHES_WIDTH}>
    <TextField {...stand(p, 'searchLine', reachWhy(p.v))} wide label="Search" does="A search of your own over the shared field: @name = the words to look for. Plain words; a search with marks is Search’s to answer."
      value={strOf(p.v, 'searchLine') ?? ''} placeholder="@name = words" onChange={x => p.set('searchLine', x)} />
    <Action {...stand(p, 'searchKeep', keepWhy)} label="Keep" does="Keep the search in this window: what is newly shown in the field that holds every word reaches you from it. No owner keeps your searches yet: they go when the window closes."
      onPress={() => p.set('searchKeep', Date.now())} />
    <Rows label="Your searches" does="The searches this window keeps. Choose one to forget it." size={3} items={items} why={kept ? undefined : reachWhy(p.v) ?? 'No reading of your searches.'}
      empty="No search kept yet." selected={strOf(p.v, 'fieldSearch')} onSelect={st(p, 'fieldSearch').disabled ? undefined : id => p.set('fieldSearch', id)} />
    <Action {...stand(p, 'searchForget', forgetWhy)} label="Forget" does="Forget the search chosen: nothing more reaches you from it." onPress={() => p.set('searchForget', Date.now())} />
  </Section>
}
/** What your world shows, and to whom: choose one to withdraw it. */
const yourShownRows = (v: V): RowItem[] | undefined => json<YourShown[] | undefined>(v, 'yourShown', undefined)?.map(row => ({id: row.id, name: row.label,
  note: row.reach === 'star' ? row.starName ?? 'a star' : row.reach, light: 'lit', tone: 'value',
  does: `A ${row.kind} your world shows ${REACH_TEXT[row.reach] ?? ''}${row.reach === 'star' && row.starName ? ` (${row.starName})` : ''}. Choose it to withdraw it.`}))
function yourShownSection(p: ViewProps) {
  const rows = yourShownRows(p.v), load = strOf(p.v, 'shownLoad')
  return <Section label="Shown" grow>
    <Rows does={`What your world shows, and to whom${load ? `: ${load}` : ''}. Choose one to withdraw it.`} size={4} page={numOf(p.v, 'shownPage') ?? 0} onPage={x => p.set('shownPage', x)}
      items={rows} why={rows ? undefined : strOf(p.v, 'fieldWhy') ?? 'No reading of what your world shows.'} empty="Your world shows nothing yet." selected={strOf(p.v, 'shownPart')} onSelect={id => p.set('shownPart', id)} />
    <Action {...st(p, 'partWithdraw')} label="Withdraw" does="Put the chosen part back under cloud, everywhere at once. Whoever read it reads that it was withdrawn, never what it was. Show shows it again."
      onPress={() => p.set('partWithdraw', Date.now())} />
  </Section>
}
/** How much of your world it shows, by reach: counted from what the binding read it shows; unread while that is not read. */
function loadSection(p: ViewProps) {
  const rows = json<YourShown[] | undefined>(p.v, 'yourShown', undefined), load = strOf(p.v, 'shownLoad')
  const count = (reach: string) => rows?.filter(row => row.reach === reach).length
  const does = (where: string) => `How many parts of your world you show ${where}${load ? `. In all: ${load}` : ''}. The rest is under cloud.`
  return <Section label="Load" width={60}>
    <Readout label="Public" value={count('public')} does={does('to the public')} />
    <Readout label="Field" value={count('field')} does={does('to the field')} />
    <Readout label="Stars" value={count('star')} does={does('at stars')} />
  </Section>
}
const NARROW = 'At World and Local your own worlds stand alone: widen to Shared or Federated to read what others withdrew.'
/** What other worlds withdrew from where you read it, newest last: from the field or the public, at a star, and the worlds that left;
 * first, what you read that is no longer shown here, its why older than anything the field keeps. */
const withdrawnRows = (v: V): RowItem[] | undefined => {
  const scene = sceneOf(v)
  if (!scene) return undefined
  const read = json<{withdrawals?: unknown; withdrawWhy?: string}>(v, 'field', {})
  if (!Array.isArray(read.withdrawals)) return unreadRows(read.withdrawWhy ?? 'No reading of what the worlds withdrew.')
  const now = Date.now()
  const gone = scene.gone.map((entry, i): RowItem => ({id: `gone:${i}`, name: goneName(entry), said: goneLine(entry), light: 'dark', note: GONE_OLDER,
    does: `${goneLine(entry)}. The field keeps the last 64 things each world withdrew, and why this went is older than that, so no reason is given.`}))
  return [...gone, ...[...scene.worlds.flatMap(world => world.withdrawn), ...scene.stars.flatMap(star => star.withdrawn), ...scene.left].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
    .map((entry, i): RowItem => ({id: `${i}`, name: withdrawnName(entry), ...(withdrawnName(entry) === withdrawnLine(entry) ? {} : {said: withdrawnLine(entry)}), light: 'dark',
      ...(entry.at === null ? {} : {note: starWhen(entry.at, now)}),
      does: 'What another world withdrew from where you read it: whose, what kind and when. What it showed is back under cloud.'}))]
}
function withdrawnSection(p: ViewProps) {
  const rows = withdrawnRows(p.v), aperture = strOf(p.v, 'aperture')
  return <Section label="Withdrawn" width={276}>
    <Rows does="What other worlds withdrew from where you read it, in words: whose, what kind, from what reach and when; never what it showed." size={4}
      page={numOf(p.v, 'withdrawnPage') ?? Math.max(0, Math.ceil((rows?.length ?? 0) / 4) - 1)} onPage={x => p.set('withdrawnPage', x)}
      items={rows} why={rows ? (rows.length ? undefined : aperture === 'world' || aperture === 'local' ? NARROW : undefined) : strOf(p.v, 'fieldWhy') ?? 'No reading of the field.'}
      empty={aperture === 'world' || aperture === 'local' ? 'Widen to Shared to read these.' : 'Nothing withdrawn where you read.'} />
  </Section>
}
/** What has reached you from the field (SF08; manual §2, §17.2 Rules), as the binding reads it (atlasDevices.reachedRows), newest last and
 * opening on the newest: each names who sent it and how it came, to you or from the star it came from, in the order it came. */
function reachedSection(p: ViewProps) {
  const rows = json<{id: string; name: string; said: string; how: string; does: string; at: number | null}[] | undefined>(p.v, 'reached', undefined), now = Date.now()
  const items = rows?.map((row): RowItem => ({id: row.id, name: row.name, said: row.said, does: row.does, light: row.how === 'to you' ? 'lit' : 'dark',
    note: row.at === null ? row.how : `${row.how} · ${starWhen(row.at, now)}`}))
  return <Section label="Reached you" width={320}>
    <Rows does="What has reached you from the field: who sent it and how it came, addressed to you or from a star your world is gathered at, in the order it came. Nothing reaches you because of how many others looked at it." size={4}
      page={numOf(p.v, 'reachedPage') ?? Math.max(0, Math.ceil((rows?.length ?? 0) / 4) - 1)} onPage={x => p.set('reachedPage', x)}
      items={items} why={rows ? undefined : strOf(p.v, 'fieldWhy') ?? 'No reading of the field.'} empty="Nothing has reached you yet." />
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

const depthDial = (p: ViewProps) => <Dial {...stand(p, 'depth', graphWhy(p.v) ?? (boolOf(p.v, 'local') === false ? NOT_LOCAL : undefined))} label="Steps" does="How many steps from the subject the graph reaches. Three at most."
  value={numOf(p.v, 'depth') ?? NaN} def={1} scale={{min: 1, max: 3, step: 1}} format={stepsText} onChange={x => p.set('depth', x)} />
const forceDial = (p: ViewProps, row: (typeof FORCE_ROWS)[number]) => <Dial {...stand(p, row.key, graphWhy(p.v))} key={row.key} label={row.label} does={row.does} value={numOf(p.v, row.key) ?? NaN} def={DEF_FORCES[row.key]}
  scale={{min: row.min, max: row.max}} format={x => `${(x / DEF_FORCES[row.key]).toFixed(2)}×`} onChange={x => p.set(row.key, Math.round(x * 100) / 100)} />
const flag = (p: ViewProps, key: string, label: string, does: string) => toggle(p, key, label, does, {why: graphWhy(p.v)})

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

/** The Earth's key on the Field scale's map: it stands among the worlds and is none of them. */
const EARTH = 'earth:given'
/** A star's mark: four points round (x, y), k from it. */
const starPath = (x: number, y: number, k: number) =>
  `M${f1(x)} ${f1(y - k)}L${f1(x + k * .3)} ${f1(y - k * .3)}L${f1(x + k)} ${f1(y)}L${f1(x + k * .3)} ${f1(y + k * .3)}L${f1(x)} ${f1(y + k)}L${f1(x - k * .3)} ${f1(y + k * .3)}L${f1(x - k)} ${f1(y)}L${f1(x - k * .3)} ${f1(y - k * .3)}Z`

/** Where a name stands on the Field scale's map: its baseline, its anchor and its words. */
interface NamePlace { readonly x: number; readonly y: number; readonly anchor: 'start' | 'middle' | 'end'; readonly text: string }
type NameBox = readonly [number, number, number, number]
/** A name to stand by the map's law: its words, the mark it names (where, and how far the mark reaches) and the side it tries first. */
interface NameAsk { readonly ref: string; readonly text: string; readonly at: readonly [number, number]; readonly r: number; readonly first: 'below' | 'above' | 'right' | 'left' }
/** The law a map's names keep, the Field scale's little map and the Graph page's field graph alike: each name where it has room, off
 * its own mark, clear of every other name, every mark and what is written over the map (`marks`), and inside the map. The names are
 * placed in the order asked; each tries its usual side first and then the others. A crowded map leaves out a name that has no room:
 * none is ever drawn over another. A letter is taken as 0.58 of the type size wide, more than the face's letters take. */
function placeAll(asks: readonly NameAsk[], marks: readonly NameBox[], {w, font}: {w: number; font: number}): Map<string, NamePlace> {
  const boxOf = ({x, y, anchor, text}: NamePlace): NameBox => {
    const width = text.length * font * .58, left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2
    return [left - 1, y - font * .8, left + width + 1, y + font * .25]
  }
  const clear = (a: NameBox, b: NameBox) => a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1]
  const taken: NameBox[] = [...marks]
  const places = new Map<string, NamePlace>()
  const place = (ref: string, text: string, tries: readonly (readonly [number, number, NamePlace['anchor']])[]) => {
    for (const [x, y, anchor] of tries) {
      const spot = {x, y, anchor, text}, box = boxOf(spot)
      if (box[0] < 0 || box[2] > w || box[1] < 0 || !taken.every(other => clear(box, other))) continue
      taken.push(box); places.set(ref, spot); return
    }
  }
  // a side's places: beside the mark, then slid along it, then a line further out
  const sides = ([x, y]: readonly [number, number], r: number, first: NameAsk['first']) => {
    type Try = readonly [number, number, NamePlace['anchor']]
    const along = (bx: number, by: number, out: number): Try[] => [[bx, by, 'middle'], [x + r, by, 'end'], [x - r, by, 'start'], [bx, by + out, 'middle'], [bx, by + 2 * out, 'middle']]
    const beside = (bx: number, anchor: 'start' | 'end'): Try[] => [0, -.9, .9].map(dy => [bx, y + font * (.35 + dy), anchor] as const)
    const side = {below: along(x, y + r + font + 1, font), above: along(x, y - r - 3, -font), right: beside(x + r + 3, 'start'), left: beside(x - r - 3, 'end')}
    const across = first === 'below' || first === 'above' ? ['right', 'left'] as const : ['below', 'above'] as const
    const opposite = {below: 'above', above: 'below', right: 'left', left: 'right'} as const
    return [...side[first], ...side[opposite[first]], ...side[across[0]], ...side[across[1]]]
  }
  for (const ask of asks) place(ask.ref, ask.text, sides(ask.at, ask.r, ask.first))
  return places
}
/** The box a name stands in, as the law takes it (for a line drawn round the names). */
const nameBoxOf = (place: NamePlace, font: number, foot = font * .25): NameBox => {
  const wide = place.text.length * font * .58, x0 = place.anchor === 'start' ? place.x : place.anchor === 'end' ? place.x - wide : place.x - wide / 2
  return [x0, place.y - font * .8, x0 + wide, place.y + foot]
}
/** Each name on the Field scale's map where it has room, by the map's law (placeAll): clear of every world and star, the corner's count
 * and the note below. Your world is named first (below it), then the stars (away from the middle), then the other worlds (outward). */
function placeNames(scene: FieldScene, at: ReadonlyMap<string, readonly [number, number]>,
  {w, h, cx, cy, rw, k, font, corner, word}: {w: number; h: number; cx: number; cy: number; rw: number; k: number; font: number; corner: string | null; word: (world: FieldScene['worlds'][number]) => string}) {
  const earth = at.get(EARTH)
  const marks: NameBox[] = [
    ...scene.worlds.flatMap(world => { const p = at.get(world.ref); return p ? [[p[0] - rw - 1, p[1] - rw - 1, p[0] + rw + 1, p[1] + rw + 1] as NameBox] : [] }),
    ...(earth ? [[earth[0] - rw - 1, earth[1] - rw - 1, earth[0] + rw + 1, earth[1] + rw + 1] as NameBox] : []),
    ...scene.stars.flatMap(star => { const p = at.get(star.ref); return p ? [[p[0] - k - 1, p[1] - k - 1, p[0] + k + 1, p[1] + k + 1] as NameBox] : [] }),
    [0, h - 14, w, h],
    ...(corner ? [cornerBox(w, corner)] : [])]
  const asks: NameAsk[] = []
  const yours = scene.worlds.find(world => world.yours), yourSpot = yours && at.get(yours.ref)
  if (yours && yourSpot) asks.push({ref: yours.ref, text: word(yours), at: yourSpot, r: rw, first: 'below'})
  for (const star of scene.stars) { const p = at.get(star.ref); if (p) asks.push({ref: star.ref, text: star.name, at: p, r: k, first: p[1] > cy ? 'below' : 'above'}) }
  if (earth) asks.push({ref: EARTH, text: 'Earth', at: earth, r: rw, first: earth[0] < cx ? 'left' : 'right'})
  for (const world of scene.worlds) { const p = at.get(world.ref); if (p && world !== yours) asks.push({ref: world.ref, text: word(world), at: p, r: rw, first: p[0] < cx ? 'left' : 'right'}) }
  return placeAll(asks, marks, {w, font})
}
/** Where a Display's corner count stands over its well, as the law keeps names off it. */
const cornerBox = (w: number, corner: string): NameBox => [w - 12 - corner.length * 9.5 * .58, 0, w, 17]

/** How near a straight line from a to b passes to p. */
const segmentGap = ([ax, ay]: readonly [number, number], [bx, by]: readonly [number, number], [px, py]: readonly [number, number]): number => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(ax + t * dx - px, ay + t * dy - py)
}

function FieldArt({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const scene = sceneOf(v)
  const cx = w / 2, cy = (h - (size === 'tile' ? 0 : 12)) / 2, ring = Math.min(w, h) * .36, inner = ring * .5
  const named = size === 'whole' || size === 'big', rw = size === 'big' ? 13 : size === 'tile' ? 4 : 6
  if (!scene) return <Gaps gaps={strOf(v, 'fieldWhy') ? [] : ['the shared field']} size={size} centred x={cx} y={cy} />
  const centre = scene.worlds.find(world => world.yours)
  const others = scene.worlds.filter(world => world !== centre)
  const k = size === 'big' ? 6 : 4
  // what is written over the map: the corner's count (the Display's own, top right; none on the big map, which has no corner) and the
  // note below. No world or star stands under either: the rings turn, in small steps from their usual place, to the first turn that keeps
  // every mark clear of both (the same field turns the same way every time), and draw in a little nearer the middle when none does
  const corner = size === 'big' ? null : `${plural(scene.worlds.length, 'world')} · ${plural(scene.stars.length, 'star')}`
  const note = size === 'tile' ? undefined : scene.note ?? (size === 'big' ? beyondText(scene) : beyondShort(scene))
  const written: NameBox[] = [...(corner ? [cornerBox(w, corner)] : []),
    ...(note ? [[0, h - 14, 8 + note.length * 8.5 * .58, h] as NameBox] : [])]
  // the Earth stands on the worlds' ring among them (SF01; manual §17.2: "the one system that holds Earth and everyone else's worlds"):
  // given, no one's, so it is drawn as the Earth and counted as no one's world
  const otherRefs = others.map(world => world.ref).sort((a, b) => hash(a) - hash(b)), starRefs = [...scene.stars.map(star => star.ref)].sort((a, b) => hash(a) - hash(b))
  // the Earth's place among the others: by its key at first, else the next place round where every tie stands clear
  const earthAt = otherRefs.filter(ref => hash(ref) < hash(EARTH)).length
  const ringOf = (slot: number) => [...otherRefs.slice(0, slot), EARTH, ...otherRefs.slice(slot)]
  let worldRefs = ringOf(earthAt)
  const layout = (turn: number, shrink: number, starStep: number) => {
    const marks = new Map<string, readonly [number, number]>()
    if (centre) marks.set(centre.ref, [cx, cy])
    const around = (refs: readonly string[], r: number, from: number) => refs.forEach((ref, i) => {
      const a = from + i * 6.283 / refs.length; marks.set(ref, [cx + r * shrink * Math.cos(a), cy + r * shrink * Math.sin(a)])
    })
    // the stars stand part of a step round from the worlds (half, where every tie stands clear), so a star and its name never sit on a world
    around(worldRefs, ring, turn)
    around(starRefs, inner, turn + starStep * 6.283 / worldRefs.length)
    return marks
  }
  const underWords = (marks: ReadonlyMap<string, readonly [number, number]>) => [...marks].some(([ref, [x, y]]) => {
    const r = (starRefs.includes(ref) ? k : rw) + 1
    return written.some(box => x + r > box[0] && x - r < box[2] && y + r > box[1] && y - r < box[3])
  })
  // no world's tie to a star runs over a world it does not join (r41 walk: a lone other world stood opposite its star, so its tie
  // crossed your own world and read as a chain through it)
  const tiesOverWorlds = (marks: ReadonlyMap<string, readonly [number, number]>) => scene.stars.some(star => {
    const b = marks.get(star.ref)
    return !!b && star.gathered.some(ref => {
      const a = marks.get(ref)
      return !!a && [...scene.worlds.map(world => world.ref), EARTH].some(other => { const p = other === ref ? undefined : marks.get(other); return !!p && segmentGap(a, b, p) < rw + 1.5 })
    })
  })
  const step = 6.283 / worldRefs.length / 24
  let at = layout(2.4, 1, .5)
  turning: for (let e = 0; e <= otherRefs.length; e++) {
    worldRefs = ringOf((earthAt + e) % (otherRefs.length + 1))
    for (const starStep of [.5, .25, .375, 0]) for (const shrink of [1, .94, .88, .82]) for (let i = 0; i < 24; i++) {
      const tried = layout(2.4 + i * step, shrink, starStep)
      if (!underWords(tried) && !tiesOverWorlds(tried)) { at = tried; break turning }
    }
  }
  const tail = whoOf
  const names = named ? placeNames(scene, at, {w, h, cx, cy, rw, k, font: size === 'big' ? 10 : 8, corner,
    // a world whose owner's machine is off says so by its name alone (SF11): its marks stand as it was left, and nothing is drawn in their place
    word: world => (world.away ? `${tail(world.ref)} · Link off` : world.left ? `${tail(world.ref)} · away` : tail(world.ref))}) : new Map<string, NamePlace>()
  const name = (ref: string) => { const place = names.get(ref)
    // a name is haloed in the well's colour (as the globe's own labels are), so no line drawn under it runs through its letters
    return place && <text x={f1(place.x)} y={f1(place.y)} textAnchor={place.anchor} className="dp-ink-dim"
      style={{fontSize: size === 'big' ? 10 : 8, paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{place.text}</text> }
  return <>
    <circle cx={cx} cy={cy} r={ring} className="dp-faint" strokeDasharray="2 3" opacity={.5} />
    {scene.stars.flatMap(star => star.gathered.flatMap(ref => { const a = at.get(ref), b = at.get(star.ref); return a && b ? [<path key={`${star.ref}|${ref}`} d={`M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}`} className="dp-curve" opacity={.7} style={{strokeWidth: .9}} />] : [] }))}
    {/* your watch: dotted in your own colour from a world of yours to the world it watches, bowed so it never runs along a star's straight
        line; the field serves each its own watches alone */}
    {scene.watching.flatMap(watch => { const a = at.get(watch.from), b = at.get(watch.to); if (!a || !b) return []
      const font = size === 'big' ? 10 : 8
      const [mx, my] = watchBow(a, b, [...at].filter(([ref]) => ref !== watch.from && ref !== watch.to).map(([, xy]) => xy),
        [...names.values()].map(place => nameBoxOf(place, font, 2)), [w, h - 14])
      return [<path key={`watch|${watch.from}|${watch.to}`} data-watch={watch.to} d={`M${f1(a[0])} ${f1(a[1])}Q${f1(mx)} ${f1(my)} ${f1(b[0])} ${f1(b[1])}`}
        fill="none" stroke="var(--dp-value)" strokeWidth={1} strokeDasharray="1.5 2.5" opacity={.9} />] })}
    {crossingMarks(scene, at, size, rw)}
    {scene.worlds.map(world => { const [x, y] = at.get(world.ref)!
      return <g key={world.ref} data-world={world.ref}>
        <circle cx={x} cy={y} r={rw} fill={world.mine ? 'var(--dp-value-dim)' : 'color-mix(in srgb, var(--text, #d4d7da) 26%, transparent)'}
          stroke={world.mine ? 'var(--dp-value)' : 'var(--text-dim, #a3a8ad)'} strokeWidth={world.yours ? 1.4 : .8} strokeDasharray={world.away ? '2 2' : undefined} opacity={world.away ? .5 : 1} />
        {world.clouded && !world.away && <circle cx={x} cy={y} r={rw} fill="var(--text-dim, #a3a8ad)" opacity={.6} />}
        {world.clearings.map((clearing, i) => { const a = hash(`${world.ref}/${clearing.part}`) * 6.283 + i * .9
          return <circle key={clearing.part + (clearing.star ?? '')} cx={x + Math.cos(a) * rw * .55} cy={y + Math.sin(a) * rw * .55} r={size === 'big' ? 1.8 : 1.2} fill="var(--dp-value)" /> })}
        {name(world.ref)}
      </g> })}
    {(() => { const [x, y] = at.get(EARTH)!
      // the Earth: a globe's outline with its equator and a meridian, in the map's own ink, never a world's disc
      return <g data-earth="given">
        <circle cx={x} cy={y} r={rw} fill="var(--dp-well)" stroke="var(--dp-on)" strokeWidth={1} />
        <path d={`M${f1(x - rw)} ${f1(y)}H${f1(x + rw)}M${f1(x)} ${f1(y - rw)}A${f1(rw * .45)} ${f1(rw)} 0 0 0 ${f1(x)} ${f1(y + rw)}`} fill="none" stroke="var(--dp-on)" strokeWidth={.6} opacity={.8} />
        {name(EARTH)}
      </g> })()}
    {scene.stars.map(star => { const [x, y] = at.get(star.ref)!
      return <g key={star.ref}>
        <path d={starPath(x, y, k)} fill="var(--dp-on)" />
        {star.waiting > 0 && <path d={`M${f1(x + k)} ${f1(y + k)}l${k} ${k}`} className="dp-faint" strokeDasharray="2 2" />}
        {name(star.ref)}
      </g> })}
    {size !== 'tile' && <text x={5} y={h - 5} className="dp-axis">{scene.note ?? (size === 'big' ? beyondText(scene) : beyondShort(scene))}</text>}
  </>
}

/** The contributions crossing the gap (TO10; manual §17.2 "Contributions cross the gap as particles"): three particles to each, set out
 * from the world that gave it and going to the world it went to, spread along the gap. One that has crossed crosses once, when first
 * drawn, and stands spread; one the field reports still waiting for its world is fainter and goes on crossing, its standing the owner's
 * report (the kit's dp-particle: nothing loops but what the owner reports; under reduced motion all stand spread). Each keeps a lane a
 * little to the right of its way, so what crosses each way between two worlds passes side by side, and several the same way are staggered
 * along it, each standing in the open gap between the two discs. Drawn under the worlds, so a particle comes out of one disc and goes into
 * the other. */
function crossingMarks(scene: FieldScene, at: ReadonlyMap<string, readonly [number, number]>, size: Size, disc: number) {
  const lane = size === 'big' ? 3 : 2, r = size === 'big' ? 1.6 : 1.1, seen = new Map<string, number>()
  return scene.crossings.flatMap(crossing => {
    const a = at.get(crossing.from), b = at.get(crossing.to)
    if (!a || !b) return []
    const pair = `${crossing.from}>${crossing.to}`, j = seen.get(pair) ?? 0
    seen.set(pair, j + 1)
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ox = -dy / len * lane, oy = dx / len * lane
    // the open gap: from the edge of one disc to the edge of the other, with a particle's breadth to spare
    const t0 = (disc + r + 1) / len, t1 = 1 - t0
    if (!(t1 > t0)) return []
    return [0, 1, 2].map(i => {
      const f = t0 + (t1 - t0) * (((i + .5) / 3 + j * .11) % 1)
      return <circle key={`${crossing.ref}|${i}`} className="dp-particle" data-crossing={crossing.ref} data-from={crossing.from} data-to={crossing.to}
        data-standing={crossing.accepted ? undefined : 'waiting'}
        cx={f1(a[0] + ox + f * dx)} cy={f1(a[1] + oy + f * dy)} r={r} fill="var(--dp-on)" opacity={crossing.accepted ? .95 : .45}
        style={{'--x0': `${f1(-f * dx)}px`, '--y0': `${f1(-f * dy)}px`, '--x1': `${f1((1 - f) * dx)}px`, '--y1': `${f1((1 - f) * dy)}px`,
          animationDelay: crossing.accepted ? undefined : `${(-f * 2.4).toFixed(2)}s`} as CSSProperties} />
    })
  })
}

/** Where a watch line bows: the control point, on whichever side and at whichever depth lets the fewest points of the line fall on another
 * mark or a name (then keeps it furthest from them), inside the map, so it runs along no star's line and through as little writing as the
 * map's room allows. */
function watchBow(a: readonly [number, number], b: readonly [number, number], marks: readonly (readonly [number, number])[], words: readonly NameBox[],
  [w, h]: readonly [number, number]): readonly [number, number] {
  let best: readonly [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], score: readonly [number, number] = [Infinity, -Infinity]
  for (const k of [.25, -.25, .4, -.4, .55, -.55, .7, -.7]) {
    const c = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * k, (a[1] + b[1]) / 2 + (b[0] - a[0]) * k] as const
    let hits = 0, near = Infinity, inside = true
    for (let t = .1; t < .95; t += .05) {
      const x = (1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], y = (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]
      if (x < 4 || y < 4 || x > w - 4 || y > h - 4) { inside = false; break }
      const gap = Math.min(...marks.map(([mx, my]) => Math.hypot(x - mx, y - my) - 7),
        ...words.map(([x0, y0, x1, y1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1)) - 1), Infinity)
      if (gap <= 0) hits += 1
      near = Math.min(near, gap)
    }
    if (inside && (hits < score[0] || (hits === score[0] && near > score[1]))) { score = [hits, near]; best = c }
  }
  return best
}

/** Words broken into lines of at most `width` characters, a word never split. */
const wrapWords = (said: string, width: number): string[] => said.split(/\s+/).reduce<string[]>((lines, word) => {
  const last = lines[lines.length - 1]
  if (last !== undefined && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`
  else lines.push(word)
  return lines
}, [])

/** Why a page of the whole World keeps the field's map while Look is set to Graph (O-I #858 r43): each page shows its own content (DLW
 * build ruling 2026-11-06: only the Graph page draws the graph there), and the graph is drawn where Look draws it. Said first, so the status bar's
 * line, which cuts a long one, shows it. */
const KEPT_UNDER_GRAPH = 'Look is set to Graph: the Graph page draws this field by connection, and so does the World’s compact face; this page keeps the field as bodies, since each page of the World keeps its own.'
function FieldDisplay({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const scene = sceneOf(v), kept = size === 'whole' && strOf(v, 'view') === 'graph'
  return <Display w={w} h={h} label="The field" corner={scene ? `${plural(scene.worlds.length, 'world')} · ${plural(scene.stars.length, 'star')}` : NONE}
    does={`${kept ? `${KEPT_UNDER_GRAPH} ` : ''}Every world the aperture holds, clear where its owner has shown it and under one even cloud elsewhere, and the stars people have made, a line to each world gathered at them; dotted, the worlds you watch; and each contribution crossing the gap as particles, from the world that gave it to the world it went to.`}>
    <FieldArt v={v} w={w} h={h} size={size} />
    {!scene && strOf(v, 'fieldWhy') && wrapWords(strOf(v, 'fieldWhy')!, Math.floor((w - 12) / 4.8)).map((line, i, all) =>
      <text key={i} x={w / 2} y={h / 2 + (i - (all.length - 1) / 2) * 11} textAnchor="middle" className="dp-ink-dim">{line}</text>)}
  </Display>
}

// ---------------------------------------------------------------- the field's Graph side (manual §17.2; TO10; round 27)
//
// The scene the Field draws, laid out by connection by the same four forces as the constellation (fieldModel.ts fieldGraph): each star a
// node with the worlds gathered at it, what each world shows a dot tied to it and to the star it is shown at, each contribution an edge
// from its sayer to what it was said to. It holds no data of its own: Aperture and View as filter it as they filter the Field.

/** How hard each tie holds its two ends. */
const FIELD_TIE_WEIGHT: Readonly<Record<FieldTie, number>> = {gathered: 1, within: .75, shows: .75, asks: .5, at: .5, said: .5, same: 1, claimed: .75, match: .2, contributed: .2}
/** Where each node stands first: your world at the heart, the stars round it, the other worlds beyond, what is shown furthest out. */
const FIELD_STEP = (node: FieldGraphNode) => (node.yours ? 0 : node.kind === 'star' ? 1 : node.kind === 'world' ? 2 : 3)
/** The names of your own world's parts, shown or not, for the match the graph draws for you alone (SF09). */
const yourNames = (v: V): string[] => json<{label: string; why?: string}[]>(v, 'yourParts', []).filter(part => !part.why).map(part => part.label)
const fieldGraphOf = (v: V): FieldGraph | undefined => { const scene = sceneOf(v); return scene ? fieldGraph(scene, yourNames(v)) : undefined }

/** How far a node's mark reaches from its middle, as drawn. */
const fieldNodeReach = (node: FieldGraphNode, big: number) => (node.kind === 'star' ? 4 : node.kind === 'work' ? 3 : node.kind === 'world' ? (node.yours ? 4.2 : 3.4) : 1.4) * big

function FieldGraphArt({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const graph = fieldGraphOf(v)
  const key = graph ? [graph.nodes.map(node => node.id).join(), graph.edges.map(edge => `${edge.from}>${edge.to}:${edge.tie}`).join()].join('|') : ''
  const pos = useMemo(() => (graph ? simulate(graph.nodes.map(node => [node.id, node.label, node.kind === 'star' ? 'a' : 'f', FIELD_STEP(node), 0] as const),
    graph.edges.map(edge => [edge.from, edge.to, FIELD_TIE_WEIGHT[edge.tie]] as const), DEF_FORCES, false, new Map()) : new Map<string, Pos>()), [key])  // eslint-disable-line react-hooks/exhaustive-deps
  if (!graph) return <Gaps gaps={strOf(v, 'fieldWhy') ? [] : ['the shared field']} size={size} centred x={w / 2} y={(h - (size === 'tile' ? 0 : 12)) / 2} />
  const big = size === 'big' ? 1.7 : 1, font = size === 'big' ? 10 : 8, named = size === 'whole' || size === 'big'
  // the graph fills its well: the layout's own extent drawn out to the well's edges less a mark's reach, under the corner's count (the
  // Display's, on every size but the big pane's) and over the big pane's key below. One scale on both axes, but a layout flatter than
  // the well is drawn up to half as tall again, so a long row of worlds does not leave the well empty above and below it.
  const corner = size === 'big' ? null : `${plural(graph.nodes.filter(node => node.kind === 'world').length, 'world')} · ${plural(graph.nodes.filter(node => node.kind === 'star').length, 'star')}`
  const pad = 6 * big, top = corner ? 19 : pad, foot = size === 'big' ? h - 60 : h - pad, below = size === 'big' ? h - 58 : h
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  pos.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) })
  const sx = (w - 2 * pad) / Math.max(x1 - x0, 1e-6), sy = (foot - top) / Math.max(y1 - y0, 1e-6), s = Math.min(sx, sy)
  const ex = Math.min(sx, s * 1.5), ey = Math.min(sy, s * 1.5), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, cx = w / 2, cy = (top + foot) / 2
  const at = (id: string): readonly [number, number] => { const p = pos.get(id); return p ? [cx + (p[0] - mx) * ex, cy + (p[1] - my) * ey] : [cx, cy] }
  // each name by the little map's law (placeAll): your world first, then the stars, the other worlds, and on the big pane each work and
  // what each world shows; clear of every name, every node's mark and ring, the corner's count and the key below
  const marks: NameBox[] = [...graph.nodes.map(node => { const [x, y] = at(node.id), r = fieldNodeReach(node, big); return [x - r - 1, y - r - 1, x + r + 1, y + r + 1] as NameBox }),
    ...(corner ? [cornerBox(w, corner)] : []), [0, below, w, h + 40]]
  const side = (node: FieldGraphNode): NameAsk['first'] => { const [x, y] = at(node.id)
    return node.yours ? 'below' : node.kind === 'star' ? (y > cy ? 'below' : 'above') : x < cx ? 'left' : 'right' }
  const order = (node: FieldGraphNode) => (node.yours ? 0 : node.kind === 'star' ? 1 : node.kind === 'world' ? 2 : node.kind === 'work' ? 3 : 4)
  const asks = graph.nodes.filter(node => (node.kind === 'world' || node.kind === 'star' ? named : size === 'big'))
    .map(node => ({node, rank: order(node)})).sort((a, b) => a.rank - b.rank)
    .map(({node}): NameAsk => ({ref: node.id, text: node.label, at: at(node.id), r: fieldNodeReach(node, big), first: side(node)}))
  const names = placeAll(asks, marks, {w, font})
  const name = (id: string) => { const place = names.get(id)
    // haloed in the well's colour, as the little map's names are, so no tie drawn under a name runs through its letters
    return place && <text x={f1(place.x)} y={f1(place.y)} textAnchor={place.anchor} className="dp-ink-dim"
      style={{fontSize: font, paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{place.text}</text> }
  return <>
    {graph.edges.map(edge => { const [x1, y1] = at(edge.from), [x2, y2] = at(edge.to)
      // a part held as one work: solid once the claim is accepted, dashed while it waits; the match, yours alone, faint dots (SF09); a
      // contribution (SF07) in the colour of what is said, dashed while its world has not answered. The colour and the width stand in the
      // style: the kit's curve rule (.dp-display .dp-curve) would draw over an attribute.
      const held = edge.tie === 'same' || edge.tie === 'claimed', spoken = edge.tie === 'said' || edge.tie === 'contributed'
      return <path key={`${edge.from}|${edge.to}|${edge.tie}`} d={`M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`} className="dp-curve" data-tie={edge.tie}
        style={{strokeWidth: edge.tie === 'gathered' || held ? 1.2 : .9, ...(spoken ? {stroke: 'var(--dp-on)'} : {})}} opacity={edge.waiting ? .5 : edge.tie === 'gathered' || spoken || held ? .85 : edge.tie === 'shows' ? .6 : edge.tie === 'match' ? .5 : .35}
        strokeDasharray={edge.tie === 'asks' || edge.tie === 'within' || edge.tie === 'claimed' || edge.waiting ? '2 2' : edge.tie === 'at' ? '1 2' : edge.tie === 'match' ? '1 2.5' : undefined} /> })}
    {graph.nodes.map(node => { const [x, y] = at(node.id), r = fieldNodeReach(node, big)
      return <g key={node.id}>
        {node.kind === 'star' ? <path d={starPath(x, y, r)} fill="var(--dp-on)" />
          : node.kind === 'work' ? <circle cx={f1(x)} cy={f1(y)} r={r} fill="none" stroke="var(--dp-value)" strokeWidth={1.2} data-work={node.label} />
          : node.kind === 'world' ? <circle cx={f1(x)} cy={f1(y)} r={r} fill={node.mine ? 'var(--dp-value-dim)' : 'color-mix(in srgb, var(--text, #d4d7da) 26%, transparent)'}
            stroke={node.mine ? 'var(--dp-value)' : 'var(--text-dim, #a3a8ad)'} strokeWidth={node.yours ? 1.4 : .8} />
          : <circle cx={f1(x)} cy={f1(y)} r={r} fill="var(--dp-value)" />}
      </g> })}
    {graph.nodes.map(node => <Fragment key={`name|${node.id}`}>{name(node.id)}</Fragment>)}
  </>
}

function FieldGraphDisplay({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const scene = sceneOf(v), graph = scene && fieldGraph(scene)
  // the graph counts what it draws: a world the audience does not see is no node of it
  const count = (kind: FieldGraphNode['kind']) => graph ? graph.nodes.filter(node => node.kind === kind).length : 0
  return <Display w={w} h={h} label="The graph" corner={graph ? `${plural(count('world'), 'world')} · ${plural(count('star'), 'star')}` : NONE}
    does="The field laid out by connection: each star with the worlds gathered at it, what each world shows tied to it, and each contribution an edge from the world that gave it to what it was given to, dashed while it waits. A work claimed the same in two worlds stands once, a ring with each world’s part tied to it, dashed while the claim waits. Faint dots, yours alone: a part another world shows by the name of one of yours.">
    <FieldGraphArt v={v} w={w} h={h} size={size} />
    {!scene && strOf(v, 'fieldWhy') && wrapWords(strOf(v, 'fieldWhy')!, Math.floor((w - 12) / 4.8)).map((line, i, all) =>
      <text key={i} x={w / 2} y={h / 2 + (i - (all.length - 1) / 2) * 11} textAnchor="middle" className="dp-ink-dim">{line}</text>)}
  </Display>
}

/** The map a page of the whole view draws: the field's at the Field scale, the Earth's at the others, whatever Look says (the Graph page
 * draws the graph; Look chooses what the plate and the pane draw). */
const SpaceOrField = (props: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) => (atFieldScale(props.v) ? <FieldDisplay {...props} /> : <SpaceDisplay {...props} />)
/** The Graph side: the field's at Field scale, the constellation's at the others. */
const GraphSide = (props: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) => (atFieldScale(props.v) ? <FieldGraphDisplay {...props} /> : <GraphDisplay {...props} />)
const WorldDisplay = (props: {v: V; set?: Put; standing?: Stands; w: number; h: number; size: Size}) => (strOf(props.v, 'view') === 'graph' ? <GraphSide {...props} /> : <SpaceOrField {...props} />)

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
// binding hands when the body was built by an older generator. There is no second generator here. `visitWorld` is another person's world
// visited (O-I #858 SF11): its body is the one shown, a reading, drawn from what its owner gave the field, with what it shows you in place
// of your locations; nothing of yours is drawn on it.

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
/** Another person's world visited (SF11), as the field the binding read shows it; undefined while none is visited or the field no longer
 * shows it. */
const visitOf = (v: V): WorldVisit | undefined => {
  const ref = strOf(v, 'visitWorld')
  if (strOf(v, 'body') !== 'other' || !ref) return undefined
  const made = fieldVisitOf(json<unknown>(v, 'field', null), ref)
  return 'refusal' in made ? undefined : made
}
function BodyArt({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  // another world's body is drawn only from the record handed for it, never from the settings on this page
  const which = strOf(v, 'body'), body = bodyOf(v, which === 'other'), cx = w / 2, cy = h / 2, R = Math.min(w, h) * .42
  const disc = useDisc(which === 'earth' ? undefined : body, size === 'big' ? 96 : size === 'whole' ? 64 : 40, numOf(v, 'bodyTime'))
  if (which === 'earth') return <text x={cx} y={cy} textAnchor="middle" className="dp-ink-dim">Earth is given: see Space</text>
  // a world visited whose body is not read now (O-I #858 TX14): your own body meanwhile, handed for it, saying so; where none can be drawn,
  // why in the field's words, and the way back to yours; never an empty body
  const lost = which === 'other' ? strOf(v, 'visitWhy') : undefined
  if (lost && (!body || !disc)) return <>{wrapWords(`${lost} ${OWN_MEANWHILE}`, Math.floor((w - 12) / (size === 'big' ? 5.6 : 4.8))).map((line, i, all) =>
    <text key={i} x={cx} y={cy + (i - (all.length - 1) / 2) * 11} textAnchor="middle" className="dp-ink-dim" style={{fontSize: SIZES[size].font - 1}}>{line}</text>)}</>
  if (!body || !disc) return <Gaps gaps={['the body']} x={cx} y={cy} centred size={size} />
  const {record} = body, tilt = record.sky.axial_tilt_deg * D2R
  // another world's body carries nothing of yours: your locations stand on your own
  const locations = which === 'other' ? [] : locationsOf(v) ?? [], pin = (lat: number, lon: number) => {
    const q = unit(lat, lon), xm = q.x * Math.cos(tilt) - q.y * Math.sin(tilt), ym = q.x * Math.sin(tilt) + q.y * Math.cos(tilt)
    return q.z > 0 ? {x: cx + R * xm, y: cy - R * ym} : undefined
  }
  // a world visited whose owner is away says so, and since when (SF11)
  const visit = visitOf(v), away = visit?.left ? `${visit.who} is away${visit.left.since === null ? '' : ` since ${starWhen(visit.left.since, Date.now())}`}` : undefined
  const axis = {dx: Math.sin(tilt) * (R + 8), dy: Math.cos(tilt) * (R + 8)}
  const note = lost ? `${strOf(v, 'bodyName') ?? 'That world'} is out of reach: yours meanwhile` : which === 'other' ? away : strOf(v, 'generationNote')
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

/** What a lost visit's display says of your own body standing in its place (TX14). */
const OWN_MEANWHILE = 'Your own body stands here meanwhile: choose Your world in Body to stay with it.'
function BodyDisplay({v, w, h, size}: {v: V; w: number; h: number; size: Size}) {
  const other = strOf(v, 'body') === 'other', lost = other ? strOf(v, 'visitWhy') : undefined
  return <Display w={w} h={h} label={lost ? 'Your body, meanwhile' : other ? 'Another world’s body' : 'Your body'} corner={strOf(v, 'bodyName') ?? NONE}
    does={lost ? `${lost} ${OWN_MEANWHILE}` : other ? `${READ_ONLY} Nothing of yours is drawn on it.`
      : 'Your planet from its settings and its seed. A location keeps its position; where that spot is now sea it is drawn on the nearest shore, hollow.'}>
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

// Another person's world to visit (O-I #858 SF11; manual §2, §17.2 "Enter the place and you are on that world"): chosen from the others the
// field shows with a body; its body is drawn as its owner gave the field, and in place of your locations stands what it shows you, each at
// the reach it was shown (the field decides that reach: nothing here widens it). Away, it reads as its owner last left it, and anything live
// on it is away with them.
const NOT_VISITABLE = 'No other world in the field you read shows its body.'
const REACH_FIRST: Readonly<Record<string, number>> = {public: 0, field: 1, star: 2}
const visitChooser = (p: ViewProps) => {
  const chosen = strOf(p.v, 'visitWorld')
  const options = fieldVisitableOf(json<unknown>(p.v, 'field', null)).map(world => ({value: world.ref, label: world.left ? `${tailOf(world.ref)}, away` : tailOf(world.ref)}))
  // the world visited stays chosen while the field does not read it now (O-I #858 TX14), saying why
  const held = chosen && !options.some(option => option.value === chosen) ? [...options, {value: chosen, label: tailOf(chosen), does: strOf(p.v, 'visitWhy') ?? 'Not in the field you read now.'}] : options
  return <Chooser {...stand(p, 'visitWorld', strOf(p.v, 'fieldWhy') ?? (options.length || chosen ? undefined : NOT_VISITABLE))} wide label="Visit"
    does="Another person’s world to visit: its body as its owner gave the field, read-only, and what it shows you." value={chosen ?? ''} options={held} onChange={x => p.set('visitWorld', x)} />
}
const visitRows = (visit: WorldVisit): RowItem[] => {
  const now = Date.now()
  return [...visit.shown].sort((a, b) => (REACH_FIRST[a.reach] ?? 3) - (REACH_FIRST[b.reach] ?? 3)).map(row => ({
    id: JSON.stringify([row.part, row.star ?? '']), name: row.label,
    note: row.reach === 'star' ? row.starName ?? 'at a star' : `to the ${row.reach}`,
    light: visit.left && LIVE_PARTS.has(row.kind) ? 'dark' as const : 'lit' as const,
    does: `A ${row.kind} ${visit.who} shows ${row.reach === 'star' ? `at ${row.starName ?? 'a star'}, to the worlds gathered there` : `to the ${row.reach}`}.${visit.left ? ` ${leftWords(visit.who, row.kind, visit.left, now)}` : ''}`}))
}
const visitSection = (visit: WorldVisit) => <Section label="What it shows" grow>
  <Rows does={`What ${visit.who} shows you, each at the reach it was shown: to the public, to the field, or at a star your world is gathered at.`} size={3}
    items={visitRows(visit)} empty={`${visit.who} shows you nothing.`} />
</Section>

// ---------------------------------------------------------------- what the pane drew over the globe, here (O-I #762)

/** The subject in focus, its line and its acts — the way out, its ties, where it hangs in the sky, Follow the thread, Reading — and the
 * closes of the reading cards: the atlas's own, as the pane drew them before it stood them down. */
function focusSection(p: ViewProps) {
  const controls = paneControlsOf(p.v, ['focus', 'closes'])
  const line = paneReadings(controls ?? []).find(text => text !== paneTitle(p.v))
  // the subject and its line beside its acts, two to a row, so every act stands within the band's height
  return <>
    <Section label="Focus" grow>
      <Readout label="subject" does="The subject the Earth has in focus, and the line it reads it by." value={controls ? paneTitle(p.v) ?? 'none' : undefined} />
      {line && <Readout label="line" does="The subject's line, as the Earth reads it." value={line} />}
    </Section>
    {/* one to a row: an act's words stand whole, never run into the next (r41: two to a row ran "Follow the thread" into "See in sky") */}
    <Section label="Acts" grow>
      {controls ? <PaneControls p={p} controls={controls} /> : <Readout label="acts" does="The acts on the subject in focus stand here once the Earth is open." value={undefined} />}
    </Section>
  </>
}

/** How the graph is drawn — node size, link width, text fade, Reset: the graph's own settings, as the pane drew them. */
function displaySection(p: ViewProps) {
  const controls = paneControlsOf(p.v, ['graph'])
  // two to a row, so the graph's three dials and Reset stand within the band's height; 124, the room "Link width" needs in its column at
  // the kit's measure (panel.tsx nameWidth), which it cannot see through PaneControls
  return <Section label="Display" cols={2} width={124} grow>
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
  const tail = whoOf
  const worlds = scene.worlds.slice(0, 6), stars = scene.stars.slice(0, 4), top = 80 + worlds.length * 20 + 28
  return <>
    <text x={548} y={34} className="dp-axis">world</text><text x={662} y={34} className="dp-axis">shown</text>
    <path d="M548 42H748" className="dp-faint" />
    {/* the Earth first (SF01): given, everyone's to place things on */}
    <text x={548} y={60} className="dp-ink">Earth</text><text x={662} y={60} className="dp-ink-dim">given</text>
    {worlds.map((world, i) => <g key={world.ref} opacity={world.away ? .5 : 1}>
      <text x={548} y={80 + i * 20} className="dp-ink">{`${tail(world.ref)}${world.yours ? ' (yours)' : ''}`}</text>
      <text x={662} y={80 + i * 20} className="dp-ink-dim">{`${world.away ? 'Link off' : !world.clouded ? 'all' : world.clearings.length ? `${plural(world.clearings.length, 'clearing')}` : 'under cloud'}${world.left ? ', away' : ''}`}</text>
    </g>)}
    <text x={548} y={top - 8} className="dp-axis">star</text><text x={662} y={top - 8} className="dp-axis">gathered</text>
    {stars.map((star, i) => <g key={star.ref}>
      <text x={548} y={top + 12 + i * 20} className="dp-ink">{star.name}</text>
      <text x={662} y={top + 12 + i * 20} className="dp-ink-dim">{`${star.gathered.length}${star.waiting ? ` · ${star.waiting} waiting` : ''}`}</text>
    </g>)}
    <text x={548} y={372} className="dp-axis">{`${APERTURE_LABEL[scene.aperture]} aperture, as ${scene.viewAs === 'me' ? 'you know it' : scene.viewAs === 'field' ? 'the field sees it' : 'the public sees it'}.`}</text>
    <text x={548} y={386} className="dp-axis">Grey: under the one even cloud. Dots: clearings.</text>
    <text x={548} y={358} className="dp-axis">Dotted: a world you watch, yours alone.</text>
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
        {graph && atFieldScale(v) ? <>
          <FieldGraphArt v={v} w={760} h={420} size="big" />
          <text x={14} y={380} className="dp-axis">A solid line: gathered at the star. Dashed: asking at its edge. Faint: shown there.</text>
          <text x={14} y={392} className="dp-axis">Dots: what each world shows. Amber lines: contributions, to what they were said to.</text>
          <text x={14} y={404} className="dp-axis">A ring: one work claimed the same in two worlds, tied to each world’s part, dashed while the claim waits.</text>
        </> : graph ? <>
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

/** The Field (O-I #858): the design's own sample of the held field's world part, as atlasDevices.fieldValues hands it (see `field` below). */
const FIELD_SAMPLE = {
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
  // what a current service keeps besides, held and empty here: work shown and tasks offered, what was asked of an agent, a star handed on,
  // and what the worlds withdrew
  works: [], offers: [], asks: [], handOns: [], withdrawals: [], withdrawWhy: null, gone: [],
}

/** The design's own sample of what is shown and offered at the star (O-I #858, SF12, SF13), in the shapes atlasDevices.fieldValues hands
 * the face: your world shows a Run's work at your star, and Mara one whose window answers no more (§17.2: it reads as last shown); you offered two tasks there, one open and one Mara took and brought back; Mara
 * offered one, open, and another your world took up. Factory's documents in its own shapes (factory.shown-work/v1, factory.task-offer/v1,
 * factory.task-offer-return/v1). */
const SAMPLE_RUN = 'run:01ARZ3NDEKTSV4RRFFQ69G5FAA'
const SAMPLE_AT = Date.UTC(2026, 10, 6, 9)
/** [SF11] Mara's machine is off: her world answered until 09:41 and is away since, its parts as she left them, her agent at your star with
 * nothing answering for it; every other world answers. */
/** The design's own sample of a world you watch (DLW build ruling 2026-11-06): your world watches the stranger's, and what it shows reached you. */
/** [SF09] the same work in two worlds: mara shows a page by the name your world shows to the public, and your claim that they are one,
 * accepted, sets yours beside it; stranger shows a page by the name of a part of yours you do not show, which the graph ties to your
 * world for you alone. */
const FIELD_SAME = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [],
  clearings: [...FIELD_SAMPLE.clearings, {world_ref: 'world:mara', part_ref: 'page:maras-fourth', star_ref: null, audience: 'public', shown: {kind: 'page', label: 'A reading of the fourth plate'}},
    {world_ref: 'world:stranger', part_ref: 'palace:the-book', star_ref: null, audience: 'public', shown: {kind: 'palace', label: 'The book'}}],
  sames: [{contribution_ref: 'contribution:teraphim-same', world_ref: 'world:mara', from_world_ref: 'world:teraphim', to: {world_ref: 'world:mara', part_ref: 'page:maras-fourth', star_ref: null},
    what: 'same', beside: {world_ref: 'world:teraphim', part_ref: 'page:reading-of-plate-4', star_ref: null}, words: 'The same plate, read twice.', state: 'accepted', answer: null, at: SAMPLE_AT + 4_000_000}]}
/** [SF10] at your star, your world asked Mara's librarian and her agent Thoth answered from the reading she shows there; Mara asked your
 * agent Hermes by its name, and it has not answered yet. */
const FIELD_ASKED = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [], asks: [
  {ask_ref: 'ask:teraphim-librarian', star_ref: 'star:rosarium', world_ref: 'world:teraphim', to_world_ref: 'world:mara', by: 'role', address: 'librarian',
    words: 'Which plate shows the white rose?', at: SAMPLE_AT + 1_000_000,
    answer: {agent: {name: 'Thoth', role: 'librarian', instance: null}, words: 'The second, as my reading of it says.', cites: [{part_ref: 'page:maras-reading', star_ref: 'star:rosarium'}],
      offer_ref: null, at: SAMPLE_AT + 1_300_000}},
  {ask_ref: 'ask:mara-hermes', star_ref: 'star:rosarium', world_ref: 'world:mara', to_world_ref: 'world:teraphim', by: 'name', address: 'Hermes',
    words: 'Where does your circle open?', at: SAMPLE_AT + 2_000_000, answer: null}]}
/** [SF10 with SF11] the same, with Mara's machine off since 41 minutes past the sample hour: your world's ask of her librarian waits until
 * she is back. */
const FIELD_ASKED_AWAY = {...FIELD_ASKED, worlds: FIELD_SAMPLE.worlds.map(world => ({...world,
  answer: world.world_ref === 'world:mara' ? {answering: false, since: SAMPLE_AT + 41 * 60_000} : {answering: true, since: SAMPLE_AT - 86_400_000}})),
  asks: FIELD_ASKED.asks.map(ask => (ask.ask_ref === 'ask:teraphim-librarian' ? {...ask, answer: null} : ask))}
/** [SF03] your world hands your star on to Mara's, gathered at it, and she has not taken it on yet. */
const FIELD_HANDING = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [], handOnWhy: null,
  handOns: [{star_ref: 'star:rosarium', from_world_ref: 'world:teraphim', to_world_ref: 'world:mara', at: SAMPLE_AT + 3_600_000}]}
/** [SF03] the stranger hands Far on to your world, gathered there with it. */
const FIELD_HANDED = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [], handOnWhy: null,
  gatherings: [...FIELD_SAMPLE.gatherings, {star_ref: 'star:far', world_ref: 'world:teraphim', state: 'gathered'}],
  handOns: [{star_ref: 'star:far', from_world_ref: 'world:stranger', to_world_ref: 'world:teraphim', at: SAMPLE_AT + 3_600_000}]}
const FIELD_WATCHING = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [], watches: [{world_ref: 'world:teraphim', watched_world_ref: 'world:stranger', at: SAMPLE_AT + 3_000_000}]}
const FIELD_AWAY = {...FIELD_SAMPLE,
  worlds: FIELD_SAMPLE.worlds.map(world => ({...world, answer: world.world_ref === 'world:mara' ? {answering: false, since: SAMPLE_AT + 41 * 60_000} : {answering: true, since: SAMPLE_AT - 86_400_000}})),
  clearings: [...FIELD_SAMPLE.clearings, {world_ref: 'world:mara', part_ref: 'agent:plate-reader', star_ref: 'star:rosarium', audience: 'star', shown: {kind: 'agent', label: 'The plate reader'}}],
  withdrawals: [], withdrawWhy: null, gone: []}
/** A world visited (O-I #858 SF11): Mara's world with the body its owner gave the field, and what it shows you at each reach: a page to the
 * public, a place to the field, its agent at your star; and the same while Mara is away. */
const MARAS_BODY = {body_ref: 'body:mara', seed: 4180, generator: {id: WORLD_BODY_GENERATOR, version: WORLD_BODY_GENERATOR_VERSION},
  landmass: {sea_level: .62, continents: 2.4, relief: .7, coast: 'archipelago'}, climate: {warmth: .72, moisture: .45, ice_caps: .12}, sky: {atmosphere: .5, clouds: .5, axial_tilt_deg: 24}}
const FIELD_VISITED = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [],
  worlds: FIELD_SAMPLE.worlds.map(world => (world.world_ref === 'world:mara' ? {...world, body: MARAS_BODY} : world)),
  clearings: [...FIELD_SAMPLE.clearings.filter(row => row.part_ref !== 'page:maras-reading'),
    {world_ref: 'world:mara', part_ref: 'place:maras-garden', star_ref: null, audience: 'field', shown: {kind: 'place', label: 'Mara’s garden'}},
    {world_ref: 'world:mara', part_ref: 'agent:cartographer', star_ref: 'star:rosarium', audience: 'star', shown: {kind: 'agent', label: 'Cartographer'}}]}
const FIELD_VISITED_AWAY = {...FIELD_VISITED, worlds: FIELD_VISITED.worlds.map(world => ({...world,
  answer: world.world_ref === 'world:mara' ? {answering: false, since: SAMPLE_AT + 41 * 60_000} : {answering: true, since: SAMPLE_AT - 86_400_000}}))}
const VISITED = {body: 'other', visitWorld: 'world:mara', bodyName: 'mara', bodyRecord: JSON.stringify(MARAS_BODY), seed: 4180, seaLevel: .62, continents: 2.4, relief: .7,
  coast: 'archipelago', warmth: .72, moisture: .45, iceCaps: .12, atmosphere: .5, clouds: .5, tilt: 24}
/** The design's own sample of what other worlds withdrew (O-I #858, SF14), as atlasDevices.fieldValues hands it: Mara withdrew a page from
 * the field and took one back at your star; a world you read has left the field. */
const FIELD_WITHDRAWN = [
  {world_ref: 'world:mara', star_ref: null, reach: 'field', kind: 'page', at: SAMPLE_AT - 5_400_000},
  {world_ref: 'world:mara', star_ref: 'star:rosarium', reach: 'star', kind: 'page', at: SAMPLE_AT - 3_600_000},
  {world_ref: 'world:heron', star_ref: null, reach: 'world', kind: null, at: SAMPLE_AT - 1_200_000}]
/** A part read of Heron's world, no longer shown here with nothing the field keeps to say why. */
const FIELD_GONE = [{world_ref: 'world:heron', star_ref: null, reach: 'public', kind: 'page'}]
/** Your world as the binding reads it on the Shown page, from FIELD_SAMPLE: the parts of it to show and what it shows. */
const YOUR_SHOWN = FIELD_SAMPLE.clearings.filter(row => row.world_ref === 'world:teraphim')
  .map(row => ({id: shownKey(row.part_ref, row.star_ref), part: row.part_ref, label: row.shown.label, kind: row.shown.kind, reach: row.audience, star: row.star_ref,
    starName: FIELD_SAMPLE.stars.find(star => star.star_ref === row.star_ref)?.name ?? null}))
/** [SF07] the contributions the design's own sample reads, as atlasDevices.contributionRows lines them: Mara's question waiting on a page
 * you show, your question accepted on hers with her words, your finding she refused, and a stranger's reproduction under your question. */
const SAMPLE_CONTRIBUTIONS = [
  {id: 'contribution:mara-asks', name: 'mara’s question on A reading of the fourth plate', note: 'waits for you', does: '“Which rose is the fourth?”', mine: false, yours: true},
  {id: 'contribution:teraphim-asks', name: 'your question on Mara’s plate', note: 'accepted', does: '“Where is the white rose?” Accepted with: “On the left.”', mine: true, yours: false},
  {id: 'contribution:teraphim-finds', name: 'your finding on Mara’s plate', note: 'refused', does: '“The plate is the sixth.” Refused with: “It is the fourth.”', mine: true, yours: false},
  {id: 'contribution:stranger-repeats', name: 'stranger’s reproduction under your question', note: 'accepted', does: '“I found it there too.”', mine: false, yours: false},
]
/** [SF07, TO10] the contributions the design's Contributions sample reads, as atlasDevices.fieldValues hands them (`contributed`), the same
 * as SAMPLE_CONTRIBUTIONS lists: they cross the gap between the worlds on the Field's map. */
const contributedOf = (ref: string, from: string, into: string, to: {world_ref: string; part_ref: string | null; star_ref: string | null} | {contribution_ref: string}, what: string,
  words: string, state: string, answer: string | null, at: number) => ({contribution_ref: ref, world_ref: into, from_world_ref: from, to, what, beside: null, words, state, answer, at})
const FIELD_CONTRIBUTED = {...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: [], contributed: [
  contributedOf('contribution:mara-asks', 'world:mara', 'world:teraphim', {world_ref: 'world:teraphim', part_ref: 'page:reading-of-plate-4', star_ref: null}, 'question', 'Which rose is the fourth?', 'waiting', null, SAMPLE_AT + 1_000_000),
  contributedOf('contribution:teraphim-asks', 'world:teraphim', 'world:mara', {world_ref: 'world:mara', part_ref: 'page:maras-plate', star_ref: null}, 'question', 'Where is the white rose?', 'accepted', 'On the left.', SAMPLE_AT + 1_200_000),
  contributedOf('contribution:teraphim-finds', 'world:teraphim', 'world:mara', {world_ref: 'world:mara', part_ref: 'page:maras-plate', star_ref: null}, 'finding', 'The plate is the sixth.', 'refused', 'It is the fourth.', SAMPLE_AT + 1_300_000),
  contributedOf('contribution:stranger-repeats', 'world:stranger', 'world:mara', {contribution_ref: 'contribution:teraphim-asks'}, 'reproduction', 'I found it there too.', 'accepted', null, SAMPLE_AT + 1_500_000)]}
/** [SF08] what has reached you in the design's own sample, as atlasDevices.reachedRows lines it from FIELD_SAMPLE with SAMPLE_CONTRIBUTIONS
 * and FIELD_WORK: in the order it came, each naming who sent it, short, with its whole line, how it came and when. */
const reachedOf = (id: string, name: string, said: string, how: string, does: string, at: number) => ({id, name, said, how, does, at})
const AT_STAR = 'It reached you from The Rosarium plates, a star your world is gathered at.'
const SAMPLE_REACHED = [
  reachedOf('asks:star:rosarium:world:stranger', 'stranger asks to come', 'stranger asks to come to The Rosarium plates', 'to you', 'It reached you addressed to you: it asks at a star your world lit.',
    Date.UTC(2026, 10, 4, 7, 30)),
  reachedOf('saying:mara-q', 'mara asks about your page', 'mara asks about For the circle', 'to you',
    '“Where does the circle open on the fourth plate?” It reached you addressed to you: said to a part your world shows.', Date.UTC(2026, 10, 4, 7, 10)),
  reachedOf('work:star:rosarium:run:01ARZ3NDEKTSV4RRFFQ69G5FAB', 'mara shows a piece of work', 'mara shows a piece of work: The plate readings', 'The Rosarium plates', AT_STAR, SAMPLE_AT + 1_800_000),
  reachedOf('offer:maras-plates', 'mara offers a task', 'mara offers a task: Read the second plate against the first.', 'The Rosarium plates', AT_STAR, SAMPLE_AT + 2_400_000),
  reachedOf('offer:soundings', 'mara brought back your task', 'mara brought back North bank soundings, for your task', 'to you',
    '“Sounded the bank at forty points.” It reached you addressed to you: it brought back what a task you offered asked for.', SAMPLE_AT + 3_600_000),
  reachedOf('contribution:mara-asks', 'mara’s question on your page', 'mara’s question on A reading of the fourth plate', 'to you',
    '“Which rose is the fourth?” It reached you addressed to you: contributed to your world.', SAMPLE_AT + 4_200_000),
  reachedOf('answer:contribution:teraphim-asks', 'mara accepted your question', 'mara accepted your question on Mara’s plate', 'to you',
    '“On the left.” It reached you addressed to you: the answer to your contribution.', SAMPLE_AT + 4_800_000),
  reachedOf('contribution:stranger-repeats', 'stranger’s reproduction under yours', 'stranger’s reproduction under your question', 'to you',
    '“I found it there too.” It reached you addressed to you: contributed under your contribution.', SAMPLE_AT + 5_400_000),
].sort((a, b) => a.at - b.at)
const sampleOffer = (ref: string, world: string, state: string, taker: string | null, asks: string, returned?: Record<string, unknown>) => ({
  offer_ref: ref, star_ref: 'star:rosarium', world_ref: world, state, taker_world_ref: taker, lapses_at: SAMPLE_AT + 7 * 86_400_000, returned: returned ?? null,
  offer: {schema: 'factory.task-offer/v1', offer_ref: ref, star_ref: 'star:rosarium', programme: {run_ref: SAMPLE_RUN, workflow_unit_ref: 'workflow-unit:01ARZ3NDEKTSV4RRFFQ69G5FAY'},
    task: {key: 'inspect-source', asks, returns: 'factory.inspect-source/v1'}, grant: {reads: ['project:river/docs'], touches: ['project:river/maps'], lapses_at: SAMPLE_AT + 7 * 86_400_000},
    offered_at: SAMPLE_AT, automatic_agent_or_model_invocation: false}})
const FIELD_WORK = {
  works: [{star_ref: 'star:rosarium', world_ref: 'world:teraphim', work_ref: SAMPLE_RUN, standing: 'live', revision: 7,
    shown: {schema: 'factory.shown-work/v1', owner: 'factory', work_ref: SAMPLE_RUN, revision: 7, name: 'The river maps', standing: 'live', lifecycle: 'active',
      agents: [{agent: 'Cartographer', at: 'runs'}, {agent: 'Surveyor', at: 'waits'}], made: [{label: 'The delta chart', standing: 'candidate'}], tasks: {runs: 1, waits: 1}, withheld: 0},
    answering: true, updated_at: SAMPLE_AT},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', work_ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', standing: 'live', revision: 3, answering: false, updated_at: SAMPLE_AT + 1_800_000,
      shown: {schema: 'factory.shown-work/v1', owner: 'factory', work_ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAB', revision: 3, name: 'The plate readings', standing: 'live', lifecycle: 'active',
        agents: [], made: [], tasks: {waits: 0, runs: 0, stalls: 0, returned: 0, done: 0, failed: 0, stopped: 0, idle: 0}, withheld: 0}}],
  offers: [sampleOffer('offer:channels', 'world:teraphim', 'open', null, 'Chart the delta’s channels from the survey notes.'),
    sampleOffer('offer:soundings', 'world:teraphim', 'returned', 'world:mara', 'Take soundings along the north bank.',
      {schema: 'factory.task-offer-return/v1', offer_ref: 'offer:soundings', star_ref: 'star:rosarium', by: {world_ref: 'world:mara', name: 'mara'},
        made: {label: 'North bank soundings', summary: 'Sounded the bank at forty points.', refs: ['project:river/maps']}, returned_at: SAMPLE_AT + 3_600_000, automatic_agent_or_model_invocation: false}),
    sampleOffer('offer:maras-plates', 'world:mara', 'open', null, 'Read the second plate against the first.'),
    sampleOffer('offer:maras-index', 'world:mara', 'taken', 'world:teraphim', 'Index the plates by their figures.')],
  days: [...FIELD_SAMPLE.days,
    {star_ref: 'star:rosarium', world_ref: 'world:teraphim', what: 'showed', kind: 'work', at: SAMPLE_AT},
    {star_ref: 'star:rosarium', world_ref: 'world:teraphim', what: 'offered', kind: 'task', at: SAMPLE_AT + 60_000},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'took', kind: 'task', at: SAMPLE_AT + 120_000},
    {star_ref: 'star:rosarium', world_ref: 'world:mara', what: 'brought-back', kind: 'task', at: SAMPLE_AT + 3_600_000}],
}

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
    field: JSON.stringify(FIELD_SAMPLE),
    // and what the binding hands beside a held field: what your world shows, what reached you, the searches this window keeps
    yourShown: JSON.stringify(YOUR_SHOWN), reached: JSON.stringify(SAMPLE_REACHED), fieldSearches: JSON.stringify([]),
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
    'Work at a star': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify({...FIELD_SAMPLE, ...FIELD_WORK}),
      factoryRuns: JSON.stringify([{value: '["/ground/.factory/state.json","run:01ARZ3NDEKTSV4RRFFQ69G5FAA"]', label: 'The river maps', does: 'A Run of Central’s Software Factory, live.'}]),
      factoryRun: '["/ground/.factory/state.json","run:01ARZ3NDEKTSV4RRFFQ69G5FAA"]',
      factoryUnits: JSON.stringify([{value: 'workflow-unit:01ARZ3NDEKTSV4RRFFQ69G5FAY', label: 'inspect-source'}]), factoryUnit: 'workflow-unit:01ARZ3NDEKTSV4RRFFQ69G5FAY',
      grantReads: 'project:river/docs', grantTouches: 'project:river/maps', grantDays: 7, fieldWork: SAMPLE_RUN, fieldOffer: 'offer:maras-index',
      madeLabel: 'The plate index', madeSummary: 'Indexed the twenty plates by their figures.', madeRef: 'project:river/maps',
      factoryTakers: JSON.stringify([{value: '/ground/.factory/state.json', label: 'Central'}, {value: '/river/.factory/state.json', label: 'river'}]), factoryTaker: '/ground/.factory/state.json'},
    'Your world shown': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify({...FIELD_SAMPLE, withdrawals: FIELD_WITHDRAWN, withdrawWhy: null, gone: FIELD_GONE}),
      fieldWorld: 'world:teraphim', fieldLinked: true, worldName: '',
      yourParts: JSON.stringify([{id: 'study', kind: 'place', label: 'The study'}, {id: 'book', kind: 'palace', label: 'The book'}, {id: 'world:central:project:river', kind: 'project', label: 'river'}]),
      showPart: 'study', showTo: 'field', yourShown: JSON.stringify(YOUR_SHOWN), reached: JSON.stringify(SAMPLE_REACHED), shownLoad: '1 to the public, 1 to the field, 1 at a star', shownPart: YOUR_SHOWN[1]!.id,
      fieldSearches: JSON.stringify([])},
    'Contributions': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldWorld: 'world:teraphim', fieldLinked: true, field: JSON.stringify(FIELD_CONTRIBUTED),
      contributeTargets: JSON.stringify([{value: '["world:mara","page:maras-plate",""]', label: 'Mara’s plate · mara', does: 'A page mara shows to the public.'},
        {value: 'contribution:teraphim-asks', label: 'your question on Mara’s plate', does: 'Where is the white rose?'}]),
      contributeTo: '["world:mara","page:maras-plate",""]', contributeWhat: 'correction', contributeWords: 'The rose on this plate is white.',
      contributions: JSON.stringify(SAMPLE_CONTRIBUTIONS), contribution: 'contribution:mara-asks', answerWords: ''},
    'A world away': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify(FIELD_AWAY)},
    'An agent asked': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify(FIELD_ASKED),
      askWorld: 'world:mara', askBy: 'role', askAddress: 'librarian', askWords: 'And the red one?', fieldAsk: 'ask:teraphim-librarian'},
    'An agent away': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify(FIELD_ASKED_AWAY),
      askWorld: 'world:mara', askBy: 'role', askAddress: 'librarian', askWords: 'And the red one?', fieldAsk: 'ask:teraphim-librarian'},
    'A star handed on': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify(FIELD_HANDING), handTo: 'world:mara'},
    'A star handed to you': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:far', field: JSON.stringify(FIELD_HANDED)},
    'The same work': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify(FIELD_SAME),
      contributeTargets: JSON.stringify([{value: '["world:mara","page:maras-fourth",""]', label: 'A reading of the fourth plate · mara', name: 'A reading of the fourth plate',
        does: 'A page mara shows to the public. You hold one by this name: claim it the same work to set yours beside it.'},
        {value: '["world:stranger","palace:the-book",""]', label: 'The book · stranger', name: 'The book', does: 'A palace stranger shows to the public. You hold one by this name: claim it the same work to set yours beside it.'}]),
      contributeTo: '["world:mara","page:maras-fourth",""]', contributeWhat: 'same', contributeWords: 'The same plate, read twice.', contributeBeside: '["page:reading-of-plate-4",""]',
      contributions: JSON.stringify([{id: 'contribution:teraphim-same', name: 'your claim of the same work on A reading of the fourth plate', note: 'accepted',
        does: '“The same plate, read twice.” It sets your A reading of the fourth plate beside it, as one work.', mine: true, yours: false}]), contribution: 'contribution:teraphim-same', answerWords: ''},
    'A world you watch': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', otherWorld: 'world:stranger', field: JSON.stringify(FIELD_WATCHING),
      reached: JSON.stringify([...SAMPLE_REACHED, reachedOf('shown:["world:stranger","page:elsewhere",""]', 'stranger shows a page', 'stranger shows Elsewhere', 'you watch',
        'It reached you from stranger, a world you watch.', SAMPLE_AT + 5_700_000)].sort((a, b) => a.at - b.at))},
    'A search you made': {scale: 'field', aperture: 'federated', viewAs: 'me', fieldStar: 'star:rosarium', field: JSON.stringify({...FIELD_SAMPLE, withdrawals: [], withdrawWhy: null, gone: []}),
      searchLine: '@plates = second plate', fieldSearch: 'rose',
      fieldSearches: JSON.stringify([{name: 'rose', words: 'rosarium readings', at: SAMPLE_AT}, {name: 'circle', words: 'where the circle opens on the fourth plate', at: SAMPLE_AT}]),
      reached: JSON.stringify([...SAMPLE_REACHED, reachedOf('shown:["world:mara","page:maras-reading","star:rosarium"]', 'mara shows a page', 'mara shows Mara’s reading of the second plate',
        '@rose', 'It reached you from your search @rose: “rosarium readings”.', SAMPLE_AT + 5_800_000)].sort((a, b) => a.at - b.at))},
    'A world visited': {...VISITED, field: JSON.stringify(FIELD_VISITED)},
    'A world visited, away': {...VISITED, field: JSON.stringify(FIELD_VISITED_AWAY)},
    'Nothing in focus': {'pane.title': undefined, 'pane.controls': JSON.stringify([])},
    'No readings': Object.fromEntries(['light', 'view', 'scale', 'cursor', 'allTime', 'playing', 'cumulative', 'scope', 'wholeField', 'relation', 'selected', 'placeArmed', 'placePage', 'baseKind',
      'graphOpen', 'local', 'depth', 'centre', 'repel', 'link', 'distance', 'tieJung', 'tieInferred', 'tieSite', 'kindArchetype', 'kindTheoretic', 'kindFamily', 'occurrences', 'skyAnchors',
      'places', 'sky', 'graph', 'subject', 'body', 'bodyName', 'seed', 'seaLevel', 'continents', 'relief', 'coast', 'warmth', 'moisture', 'iceCaps', 'atmosphere', 'clouds', 'tilt',
      'placeKind', 'locations', 'bodyRecord', 'bodyLook', 'bodyTime', 'generationNote', 'pane.title', 'pane.controls',
      'aperture', 'viewAs', 'field', 'fieldYours', 'fieldHeld', 'fieldWhy', 'cameraScale', 'fieldStar', 'fieldWaiting', 'fieldAdmit', 'starName', 'starGathers', 'starComes',
      'fieldSayTo', 'sayWhat', 'sayWords', 'dayPage', 'saidPage', 'factoryRuns', 'factoryRun', 'factoryUnits', 'factoryUnit', 'grantReads', 'grantTouches', 'grantDays',
      'fieldWork', 'fieldOffer', 'madeLabel', 'madeSummary', 'madeRef', 'workPage', 'offerPage', 'offerNotes', 'factoryTakers', 'factoryTaker',
      'fieldWorld', 'fieldLinked', 'worldName', 'yourParts', 'showPart', 'showTo', 'yourShown', 'shownLoad', 'shownPart', 'shownPage', 'withdrawnPage', 'reached', 'reachedPage',
      'contributeTargets', 'contributeTo', 'contributeWhat', 'contributeWords', 'contributeBeside', 'contributions', 'contribution', 'answerWords', 'contributeWhy', 'contributionPage', 'otherWorld', 'searchLine', 'fieldSearches', 'fieldSearch',
      'askWorld', 'askBy', 'askAddress', 'askWords', 'fieldAsk', 'handTo', 'visitWorld', 'visitWhy'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="World" light={light(p)} readings={atFieldGraph(p.v) ? ['graph', shown(p.v, 'scale')] : strOf(p.v, 'view') === 'graph' ? ['graph', depthText(p.v)] : [shown(p.v, 'scale'), whenOf(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="World" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><WorldDisplay v={p.v} set={p.set} standing={p.standing} w={140} h={146} size="compact" /></Section>
    <Section label="Macros" cols={2}>
      {atFieldGraph(p.v) ? <>
        {viewRadio(p)}
        {apertureChooser(p)}
        {viewAsChooser(p)}
        {widenAction(p)}
      </> : strOf(p.v, 'view') === 'graph' ? <>
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
    pages={[{id: 'space', label: 'Space'}, {id: 'star', label: 'Star'}, {id: 'said', label: 'Said'}, {id: 'talk', label: 'Talk'}, {id: 'work', label: 'Work'}, {id: 'shown', label: 'Shown'},
      {id: 'contribute', label: 'Contribute'}, {id: 'body', label: 'Body'}, {id: 'graph', label: 'Graph'}]}
    page={p.page === 'graph' || p.page === 'body' || p.page === 'star' || p.page === 'said' || p.page === 'talk' || p.page === 'work' || p.page === 'shown' || p.page === 'contribute' ? p.page : 'space'} onPage={p.setPage}>
    {p.page === 'contribute' ? <>
      <Band>
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {contributeSection(p)}
        {besideSection(p)}
        {answerSection(p)}
      </Band>
      <Band>
        {contributionsSection(p)}
      </Band>
    </> : p.page === 'shown' ? <>
      <Band>
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {yourFieldSection(p)}
        {yourShowSection(p)}
        {searchesSection(p)}
      </Band>
      <Band>
        {yourShownSection(p)}
        {loadSection(p)}
        {withdrawnSection(p)}
        {reachedSection(p)}
      </Band>
    </> : p.page === 'work' ? <>
      <Band>
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {runSection(p)}
        {shownSection(p)}
      </Band>
      <Band>
        {offerSection(p)}
        <Section label="Lapses" width={58}>{daysDial(p)}</Section>
        {offeredSection(p)}
        {takeSection(p)}
        {yoursSection(p)}
      </Band>
    </> : p.page === 'star' ? <>
      {/* The World's star in three pages, each within the expanded band (DLW build ruling 2026-11-06, the lead's; the names are the manual
          §17.2's words, "The star keeps its own day, of who is here, what was brought and what was said to what"; "The agent that keeps that
          world is there to talk to"). Star: who is here and what each brought, the star's day, and whose hands it is in. Said: what was
          said to what there, and what you say. Talk: the agents of the worlds gathered there, asked. */}
      <Band>
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {hereSection(p)}
        {daySection(p, 190)}
      </Band>
      <Band>
        {handOnSection(p)}
        {handedSection(p)}
      </Band>
    </> : p.page === 'said' ? <>
      <Band>
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {saidSection(p)}
        {saySection(p)}
      </Band>
    </> : p.page === 'talk' ? <>
      <Band>
        <Section width={198}><SpaceOrField v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {askAgentSection(p)}
        {askSection(p)}
        {askedSection(p)}
      </Band>
    </> : p.page === 'body' ? <>
      <Band>
        <Section width={198}><BodyDisplay v={p.v} w={186} h={146} size="whole" /></Section>
        <Section label="Body" width={96}>
          <Chooser {...st(p, 'body')} wide label="Body" does="The body to show and build: your world, Earth, or a world you visit." value={strOf(p.v, 'body') ?? ''} options={BODY_CHOICES} onChange={x => p.set('body', x)} />
          {visitChooser(p)}
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
        {visitOf(p.v) ? visitSection(visitOf(p.v)!) : strOf(p.v, 'visitWhy') ? <Section label="What it shows" grow>
          <Rows does="What the world you visit shows you, once the field reads it again." size={3} items={undefined} why={strOf(p.v, 'visitWhy')} empty="" />
        </Section> : <Section label="Locations" grow>
          <Radio {...st(p, 'placeKind')} label="Place kind" does="What the next click on the body places." value={strOf(p.v, 'placeKind') ?? ''} options={PLACE_KINDS} onChange={x => p.set('placeKind', x)} />
          <Rows does="Your locations. A dim light means its spot is sea on this body, so it is drawn on the nearest shore." size={3} items={locationRows(p.v)} empty="No location placed yet." />
        </Section>}
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
      {atFieldScale(p.v) ? <Band>
        {starSection(p)}
        {atStarSection(p)}
        {lightSection(p)}
        {factorySection(p)}
        {watchSection(p)}
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
            onPage={st(p, 'placePage').disabled ? undefined : x => p.set('placePage', x)} items={placeRows(p.v)} empty="The field holds no places yet." />
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
        <Section width={198}><GraphSide v={p.v} set={p.set} standing={p.standing} w={186} h={146} size="whole" /></Section>
        {atFieldScale(p.v) && <Section label="Field" width={110}>
          {apertureChooser(p)}
          {viewAsChooser(p)}
          {widenAction(p)}
        </Section>}
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
