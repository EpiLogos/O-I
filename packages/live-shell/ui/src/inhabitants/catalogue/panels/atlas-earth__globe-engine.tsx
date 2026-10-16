// World (manual §17.1): the Earth under its star, and the same material as a graph. Live's nearest: Simpler — one display whose
// picture changes with the mode (Space or Graph), a handle on its axis, a few columns round it. Space draws the body by the atlas's
// own laws: an orthographic globe, the terminator from the Sun's subsolar point, each place by the precision grammar, and the deep-time
// window (data/time.ts timeVisibility) that fades a place in as the cursor reaches its year. Graph draws the constellation by its four
// forces (graph/forces.ts) over a real neighbourhood of the Archetypal Earth field.
//
// Owners. The Earth ⇄ Graph switch, the whole-field choice and the deep-time clock are the atlas's own, written through
// shell.setAtlasView, shell.setAtlasWholeField and shell.setAtlasCursor / AllTime / Play / Cumulative (inhabitants/ql/devices/
// atlasDevices.ts:34-51). The graph's steps, forces, relations, kinds, occurrences and sky anchors are the graph-tools rows (same file,
// :35-44). The scale is the camera's: a reading (projections/atlas/places/placesModel.ts atlasScaleOf). Aperture and View as have no
// owner yet; the panel keeps them, off, with the owner's reason (PlacesPlate.tsx:153-156).
import {useMemo} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type Value, type ViewProps} from './design'
import './atlas-earth__globe-engine.css'

type V = ViewProps['v']
type Put = ViewProps['set']
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

// ---------------------------------------------------------------- places: real occurrences of the Archetypal Earth field

interface Presence {readonly id: string; readonly name: string; readonly lat: number; readonly lon: number; readonly year: number; readonly precision: 'exact' | 'region'; readonly relation: string | null; readonly what: string}
/** field.json occurrences: the place, its position, its year and the precision the field states. The relation is the owner's, where the field's locus type gives one. */
const PLACES: readonly Presence[] = [
  {id: 'giza', name: 'Giza', lat: 30.0273, lon: 31.2076, year: -2530, precision: 'exact', relation: 'OCCURRED_AT', what: 'A king’s daughter buried in a gilded wooden cow'},
  {id: 'athens', name: 'Athens', lat: 37.947, lon: 23.7406, year: -385, precision: 'exact', relation: null, what: 'Plato’s round primordial man'},
  {id: 'jerusalem', name: 'Jerusalem', lat: 31.7534, lon: 35.1301, year: 30, precision: 'exact', relation: 'MYTH_LOCATED_AT', what: 'The angel who stirs the pool of Bethesda'},
  {id: 'eleusis', name: 'Eleusis', lat: 38.0659, lon: 23.4693, year: 390, precision: 'exact', relation: null, what: 'The hieros gamos of hierophant and priestess'},
  {id: 'palenque', name: 'Palenque', lat: 17.552, lon: -92.0459, year: 690, precision: 'exact', relation: 'LOCATED_IN', what: 'The Palenque Cross with a child offering'},
  {id: 'chartres', name: 'Chartres', lat: 48.9317, lon: 2.3696, year: 1150, precision: 'exact', relation: null, what: 'Anima mundi as the Holy Ghost'},
  {id: 'zurich', name: 'Zürich', lat: 47.3015, lon: 8.6075, year: 1910, precision: 'exact', relation: null, what: 'Understanding the language of birds'},
  {id: 'taos', name: 'Taos', lat: 36.4786, lon: -105.5844, year: 1925, precision: 'exact', relation: null, what: 'All life is coming from the mountain'},
  {id: 'australia', name: 'Central Australia', lat: -24.5508, lon: 133.4689, year: 1932, precision: 'region', relation: null, what: 'The ancestral fire-sparks seeking wombs'},
]
/** The places a scope names as its own (a mode’s set; the rest are set aside). */
const OWN = ['athens', 'eleusis', 'jerusalem']
/** world.ts GEOGRAPHY_RELATIONS and suiteReading.ts locusOfRelation: the narrowing a relation gives. */
const FACTUAL = ['OCCURRED_AT', 'LOCATED_IN', 'OPERATED_IN', 'TRAVELLED_TO', 'MYTH_LOCATED_AT']
const locusOf = (relation: string | null) => (relation === 'MYTH_LOCATED_AT' ? 'myth' : relation && relation !== 'LOCATED_IN' && FACTUAL.includes(relation) ? 'event' : 'placed')
const RELATIONS = [{value: 'all', label: 'All'}, {value: 'OCCURRED_AT', label: 'OCCURRED_AT'}, {value: 'LOCATED_IN', label: 'LOCATED_IN'}, {value: 'MYTH_LOCATED_AT', label: 'MYTH_LOCATED_AT'}] as const

/** How present a place is: the window, then the scope, then the relation filter — the engine’s own order (engine.ts composeFilter). */
function alphaOf(v: V, place: Presence): number {
  let a = on(v, 'allTime') ? 1 : timeVisibility(toU(place.year), num(v, 'cursor'), on(v, 'cumulative') ? TRAIL_CUMULATIVE : TRAIL)
  if (str(v, 'scope')) a *= OWN.includes(place.id) ? 1 : on(v, 'wholeField') ? .07 : 0
  if (str(v, 'relation') !== 'all' && locusOf(place.relation) !== locusOf(str(v, 'relation'))) a = 0
  return a
}

// ---------------------------------------------------------------- the sky: the Sun’s subsolar point (sky/luminaries.ts subsolarPoint)

const D2R = Math.PI / 180
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const
/** Mean distance from the Sun in au (the Moon from the Earth, the Sun from the Earth). */
const AU: Record<(typeof BODIES)[number], number> = {Sun: 1, Moon: .00257, Mercury: .387, Venus: .723, Mars: 1.524, Jupiter: 5.203, Saturn: 9.537, Uranus: 19.19, Neptune: 30.07, Pluto: 39.48}
/** fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json: ecliptic longitudes at 2026-09-28T12:00:00Z. */
const SKY_AT = '2026-09-28T12:00:00Z'
const SKY_LON: Record<(typeof BODIES)[number], number> = {Sun: 185.3841, Moon: 28.4415, Mercury: 207.3048, Venus: 218.0566, Mars: 120.2251, Jupiter: 139.1394, Saturn: 11.7737, Uranus: 65.5651, Neptune: 2.9311, Pluto: 303.1411}
const gmst = (ms: number) => { const d = ms / 864e5 + 2440587.5 - 2451545; return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360 }
const obliquity = (ms: number) => { const T = (ms / 864e5 + 2440587.5 - 2451545) / 36525; return 23.439279444 - .013010214 * T }
const wrap180 = (x: number) => (((x + 180) % 360) + 360) % 360 - 180
function subsolar(lonEcliptic: number, ms: number): {lat: number; lon: number} {
  const e = obliquity(ms) * D2R, l = lonEcliptic * D2R
  return {lat: Math.asin(Math.sin(e) * Math.sin(l)) / D2R, lon: wrap180(Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / D2R - gmst(ms))}
}
const SUBSOLAR = subsolar(SKY_LON.Sun, Date.parse(SKY_AT))
const skyRead = (v: V) => on(v, 'allTime')

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
function nightRects(cx: number, cy: number, R: number, w: number, h: number, step: number) {
  const s = ortho(SUBSOLAR.lat, SUBSOLAR.lon), out: ReactRect[] = []
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
const rulerY = (h: number, scale: string) => { const i = SCALE_ORDER.indexOf(scale as (typeof SCALE_ORDER)[number]); return 22 + (h - 22 - 46) * (i < 0 ? 1 : i) / 2 }

function SpaceArt({v, set, w, h, size}: {v: V; set?: Put; w: number; h: number; size: Size}) {
  const cfg = SIZES[size], track = size !== 'tile', usable = h - (track ? 26 : 0), cx = w / 2 + (size === 'big' ? 0 : 3), cy = usable / 2 + 2
  const scale = size === 'tile' ? 'body' : str(v, 'scale'), allTime = on(v, 'allTime'), cursor = num(v, 'cursor')
  const R = scale === 'region' ? Math.min(w, usable) * 1.18 : Math.min(w, usable) * .43
  const known = skyRead(v), x0 = 12, x1 = w - 12, ty = h - 17, tx = (u: number) => x0 + u * (x1 - x0)
  const trail = on(v, 'cumulative') ? TRAIL_CUMULATIVE : TRAIL
  const toCursor = (x: number) => clampTo(0, 1, (x - x0) / (x1 - x0))
  const sel = str(v, 'selected')
  const marks = PLACES.map(pl => { const q = ortho(pl.lat, pl.lon), a = alphaOf(v, pl); return q.z <= .03 || a < .03 ? null : {pl, q, a, x: cx + R * q.x, y: cy - R * q.y} }).flatMap(m => (m ? [m] : []))
  const taken: {x: number; y: number}[] = []
  const labelY = (x: number, y: number) => { let ly = y - 4; for (let i = 0; i < 6 && taken.some(t => Math.abs(t.x - x) < 70 && Math.abs(t.y - ly) < 10); i++) ly += 10; taken.push({x, y: ly}); return ly }
  const bodyAt = (b: (typeof BODIES)[number]) => { const r = 8 + (Math.min(w, usable) * .46 - 8) * Math.sqrt(AU[b] / 40), a = SKY_LON[b] * D2R; return [cx + r * Math.cos(a), cy - r * Math.sin(a), r] as const }
  return <>
    {scale === 'system'
      ? <g>
        {known && [1, 5, 10, 30].map(au => <circle key={au} cx={cx} cy={cy} r={8 + (Math.min(w, usable) * .46 - 8) * Math.sqrt(au / 40)} className="dp-faint" opacity={.5} strokeDasharray="2 3" />)}
        <circle cx={cx} cy={cy} r={size === 'big' ? 5 : 3} className="dp-fill" stroke="var(--dp-value)" />
        {known ? BODIES.map(b => { const [x, y] = bodyAt(b); return <g key={b}>
          <circle cx={x} cy={y} r={b === 'Sun' ? 3.4 : 2} fill={b === 'Sun' ? 'var(--dp-on)' : 'var(--dp-value)'} />
          {cfg.names && <text x={x + 5} y={y + 3} className="dp-axis">{b}</text>}</g> })
          : <text x={cx} y={cy - 6} textAnchor="middle" className="dp-ink-dim">No sky is read for this year.</text>}
        <text x={5} y={12} className="dp-axis">{size === 'tile' ? '' : 'from the Earth'}</text>
      </g>
      : <g>
        <circle cx={cx} cy={cy} r={R} className="dp-fill" />
        {known && nightRects(cx, cy, R, w, usable, cfg.step).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="var(--dp-well)" opacity={.62} />)}
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
        {!known && size !== 'tile' && <text x={w - 5} y={usable - 5} textAnchor="end" className="dp-axis">no Sun read</text>}
      </g>}
    {track && <g>
      <path d={`M${x0} ${ty}H${x1}`} className="dp-faint" />
      <rect x={allTime ? x0 : tx(Math.max(0, cursor - trail))} y={ty - 3} width={allTime ? x1 - x0 : tx(cursor) - tx(Math.max(0, cursor - trail))} height={6} className="dp-fill" />
      {KNOTS.slice(1, -1).filter((_, i) => size !== 'compact' || i % 2 === 1).map(([year, u]) => <g key={year}>
        <path d={`M${f1(tx(u))} ${ty + 2}v3`} className="dp-faint" />
        {size !== 'compact' && [-1000, 0, 1000].includes(year) && <text x={tx(u)} y={ty + 11} textAnchor="middle" className="dp-axis" style={{fontSize: size === 'big' ? 9 : 7.5}}>{yearText(year)}</text>}</g>)}
      {PLACES.map(pl => <circle key={pl.id} cx={tx(toU(pl.year))} cy={ty} r={1.5} fill="var(--dp-value)" opacity={alphaOf(v, pl) > .03 ? 1 : .35} />)}
      {set && <Handle n={1} shape="ring" x={tx(cursor)} y={ty} label="Year" does="Drag along the line: the year in the window. Double-click to show all time."
        onDrag={x => { set('cursor', Math.round(toCursor(x) * 1000) / 1000); set('allTime', false) }} onReset={() => { set('allTime', true); set('cursor', 1) }} />}
      {!set && <circle cx={tx(cursor)} cy={ty} r={4} fill="none" stroke="var(--dp-on)" strokeWidth={1.4} />}
    </g>}
    {set && size === 'whole' && <g>
      <path d={`M10 22V${h - 46}`} className="dp-faint" />
      {SCALE_ORDER.map(s => <path key={s} d={`M7 ${f1(rulerY(h, s))}h6`} className="dp-faint" />)}
      <Handle n={2} shape="square" x={10} y={rulerY(h, scale)} label="Scale" does="Drag along the line: region, body or system."
        onDrag={(_, y) => set('scale', SCALE_ORDER[Math.round(clampTo(0, 2, (y - 22) / (h - 22 - 46) * 2))]!)} />
    </g>}
  </>
}

// ---------------------------------------------------------------- the graph: the neighbourhood of Quaternity in the field

const GN: readonly (readonly [string, string, 'a' | 'f', number, number])[] = [
  ["quaternity", "Quaternity", 'f', 0, 48],
  ["feeling", "Feeling", 'f', 1, 6],
  ["four", "Four", 'a', 1, 0],
  ["intuition", "Intuition", 'f', 1, 5],
  ["self", "The Self", 'a', 1, 0],
  ["sensation", "Sensation", 'f', 1, 5],
  ["thinking", "Thinking", 'f', 1, 5],
  ["air", "Air", 'f', 1, 7],
  ["citrinitas", "Citrinitas", 'f', 1, 3],
  ["earth-element", "Earth", 'f', 1, 5],
  ["eight", "Eight", 'a', 2, 0],
  ["mandala", "Mandala", 'f', 2, 124],
  ["melothesia", "Melothesia", 'f', 2, 1],
  ["abraxas", "Abraxas", 'f', 2, 1],
  ["ahasuerus", "Ahasuerus", 'f', 2, 2],
  ["aion", "Aion", 'f', 2, 2],
  ["aquarius", "Aquarius", 'f', 2, 3],
  ["gemini", "Gemini", 'f', 2, 3],
  ["libra", "Libra", 'f', 2, 3],
  ["albedo", "Albedo", 'f', 2, 1],
  ["rubedo", "Rubedo", 'f', 2, 2],
  ["sun", "Sun", 'f', 2, 33],
  ["nigredo", "Nigredo", 'f', 2, 14],
  ["capricorn", "Capricorn", 'f', 2, 3],
  ["great-mother", "Great Mother", 'a', 2, 0],
  ["nine", "Nine", 'a', 3, 0],
  ["seven", "Seven", 'a', 3, 0],
  ["shadow", "Shadow", 'a', 3, 0],
  ["trickster", "Trickster", 'a', 3, 0],
  ["decan-aquarius-1", "Aquarius \u00b7 first decan", 'f', 3, 1],
  ["decan-aquarius-2", "Aquarius \u00b7 second decan", 'f', 3, 1],
  ["child", "Child", 'a', 3, 0],
  ["decan-gemini-1", "Gemini \u00b7 first decan", 'f', 3, 1],
  ["anima", "Anima", 'a', 3, 0],
  ["aries", "Aries", 'f', 3, 3],
  ["moon", "Moon", 'f', 3, 23],
  ["water", "Water", 'f', 3, 35],
  ["decan-aries-2", "Aries \u00b7 second decan", 'f', 3, 1],
  ["decan-capricorn-3", "Capricorn \u00b7 third decan", 'f', 3, 1],
  ["prima-materia", "Prima materia", 'f', 3, 22],
  ["saturn", "Saturn", 'f', 3, 0],
  ["goat", "Goat", 'f', 3, 1],
  ["cancer", "Cancer", 'f', 3, 3],
  ["dual-mother", "Dual mother", 'f', 3, 9],
  ["mother-goddess", "Mother goddess", 'f', 3, 78]
]
const GE: readonly (readonly [string, string, 'jung' | 'inferred' | 'site'])[] = [
  ["abraxas", "self", 'jung'],
  ["abraxas", "shadow", 'inferred'],
  ["abraxas", "trickster", 'site'],
  ["ahasuerus", "self", 'jung'],
  ["aion", "self", 'jung'],
  ["air", "aquarius", 'jung'],
  ["air", "citrinitas", 'inferred'],
  ["air", "four", 'inferred'],
  ["air", "gemini", 'jung'],
  ["air", "libra", 'jung'],
  ["air", "quaternity", 'inferred'],
  ["air", "thinking", 'jung'],
  ["albedo", "citrinitas", 'jung'],
  ["albedo", "moon", 'jung'],
  ["albedo", "nigredo", 'jung'],
  ["albedo", "self", 'jung'],
  ["albedo", "water", 'inferred'],
  ["anima", "libra", 'site'],
  ["aquarius", "decan-aquarius-1", 'site'],
  ["aquarius", "decan-aquarius-2", 'site'],
  ["aries", "libra", 'site'],
  ["cancer", "capricorn", 'site'],
  ["capricorn", "earth-element", 'site'],
  ["capricorn", "goat", 'jung'],
  ["child", "gemini", 'site'],
  ["citrinitas", "quaternity", 'inferred'],
  ["citrinitas", "rubedo", 'jung'],
  ["citrinitas", "self", 'inferred'],
  ["citrinitas", "sun", 'inferred'],
  ["decan-aries-2", "sun", 'site'],
  ["decan-capricorn-3", "sun", 'site'],
  ["decan-gemini-1", "gemini", 'site'],
  ["dual-mother", "great-mother", 'jung'],
  ["earth-element", "four", 'inferred'],
  ["earth-element", "great-mother", 'site'],
  ["earth-element", "nigredo", 'jung'],
  ["earth-element", "quaternity", 'inferred'],
  ["eight", "four", 'jung'],
  ["eight", "nine", 'jung'],
  ["eight", "seven", 'jung'],
  ["feeling", "four", 'inferred'],
  ["feeling", "quaternity", 'jung'],
  ["feeling", "thinking", 'jung'],
  ["four", "intuition", 'inferred'],
  ["four", "mandala", 'jung'],
  ["four", "melothesia", 'jung'],
  ["four", "quaternity", 'jung'],
  ["four", "sensation", 'inferred'],
  ["four", "thinking", 'inferred'],
  ["great-mother", "mother-goddess", 'jung'],
  ["intuition", "quaternity", 'jung'],
  ["intuition", "sensation", 'jung'],
  ["mandala", "self", 'jung'],
  ["melothesia", "self", 'jung'],
  ["moon", "rubedo", 'jung'],
  ["nigredo", "prima-materia", 'jung'],
  ["nigredo", "saturn", 'inferred'],
  ["nigredo", "shadow", 'jung'],
  ["nigredo", "sun", 'jung'],
  ["quaternity", "self", 'jung'],
  ["quaternity", "sensation", 'jung'],
  ["quaternity", "thinking", 'jung'],
  ["rubedo", "self", 'jung'],
  ["rubedo", "sun", 'jung'],
  ["self", "sun", 'jung']
]

const SUBJECT = 'quaternity'
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

type GNode = (typeof GN)[number]
type Pos = readonly [number, number]
/** The four forces of graph/forces.ts, in miniature: the pull to the heart, the push between forms, the pull along each tie and the length of a tie. */
function simulate(nodes: readonly GNode[], edges: readonly (typeof GE)[number][], f: typeof DEF_FORCES, local: boolean, pinned: ReadonlyMap<string, Pos>): Map<string, Pos> {
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

/** What the graph shows: the subject’s steps (when local), the tiers that are on, the ties that are on. */
function shown(v: V) {
  const local = v.local !== false, depth = num(v, 'depth')
  const tiers = {a: on(v, 'kindArchetype'), f: on(v, 'kindFamily')}
  const nodes = GN.filter(n => n[0] === SUBJECT || ((!local || n[3] <= depth) && tiers[n[2]]))
  const ids = new Set(nodes.map(n => n[0]))
  const ties = {jung: on(v, 'tieJung'), inferred: on(v, 'tieInferred'), site: on(v, 'tieSite')}
  return {nodes, edges: GE.filter(e => ids.has(e[0]) && ids.has(e[1]) && ties[e[2]]), local}
}
const skyAnchorsOn = (v: V) => on(v, 'skyAnchors')

function GraphArt({v, set, w, h, size}: {v: V; set?: Put; w: number; h: number; size: Size}) {
  const cfg = SIZES[size], k = Math.min(w / 186, h / 146), rimL = 62
  const {nodes, edges, local} = shown(v), anchors = skyAnchorsOn(v)
  const forces = {centre: num(v, 'centre'), repel: num(v, 'repel'), link: num(v, 'link'), distance: num(v, 'distance')}
  const pinned = new Map<string, Pos>()
  if (anchors) for (const [id, body] of Object.entries(SKY_NODES)) if (nodes.some(n => n[0] === id)) { const a = SKY_LON[body] * D2R; pinned.set(id, [rimL * Math.cos(a), -rimL * Math.sin(a)]) }
  const key = [nodes.map(n => n[0]).join(), edges.length, Object.values(forces).join(), local, [...pinned.keys()].join()].join('|')
  const pos = useMemo(() => simulate(nodes, edges, forces, local, pinned), [key])  // eslint-disable-line react-hooks/exhaustive-deps
  let mx = 1, my = 1
  pos.forEach(([x, y]) => { mx = Math.max(mx, Math.abs(x)); my = Math.max(my, Math.abs(y)) })
  const fit = Math.min(1, (w / 2 - (size === 'big' ? 96 : 18)) / (mx * k), (h / 2 - (size === 'big' ? 22 : 14)) / (my * k)), s = k * fit, cx = w / 2 + (size === 'big' ? 0 : 6), cy = h / 2
  const at = (id: string) => { const p = pos.get(id)!; return [cx + p[0] * s, cy + p[1] * s] as const }
  const r = (n: GNode) => (n[0] === SUBJECT ? 4.2 : n[2] === 'a' ? 3.4 : 2.4) * (size === 'big' ? 1.7 : 1)
  const dust = on(v, 'occurrences')
  const stepsY = (d: number) => 22 + (h - 22 - 30) * (d - 1) / 2
  return <>
    {anchors && <circle cx={cx} cy={cy} r={rimL * s} className="dp-faint" opacity={.5} strokeDasharray="2 3" />}
    {edges.map(([a, b, basis]) => { const [x1, y1] = at(a), [x2, y2] = at(b)
      return <path key={`${a}|${b}`} d={`M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`} className="dp-curve" strokeWidth={basis === 'jung' ? 1.2 : .9} opacity={basis === 'jung' ? .85 : basis === 'inferred' ? .6 : .32} strokeDasharray={basis === 'inferred' ? '3 2' : undefined} /> })}
    {dust && nodes.map(n => { const [x, y] = at(n[0]); return n[4] > 0 ? Array.from({length: Math.min(n[4], 6)}, (_, i) => { const a = (hash(n[0]) + i / 6) * 6.283
      return <circle key={`${n[0]}${i}`} cx={x + Math.cos(a) * (r(n) + 3)} cy={y + Math.sin(a) * (r(n) + 3)} r={.8} fill="var(--dp-value)" opacity={.55} /> }) : null })}
    {nodes.map(n => { const [x, y] = at(n[0]), pin = pinned.has(n[0])
      return <g key={n[0]}>
        <circle cx={x} cy={y} r={r(n)} fill={n[2] === 'a' ? 'var(--dp-on)' : 'var(--dp-value)'} stroke={n[0] === SUBJECT || pin ? 'var(--text)' : undefined} strokeWidth={1.2} />
        {(size === 'big' || (size === 'whole' && n[0] === SUBJECT)) && <text x={x + r(n) + 3} y={y + 3} className="dp-ink-dim" style={{fontSize: cfg.font}}>{n[1]}</text>}
      </g> })}
    {anchors && Object.keys(SKY_NODES).every(id => !pinned.has(id)) && <text x={5} y={h - 5} className="dp-axis">no sky node in view</text>}
    {set && size !== 'tile' && <g>
      <path d={`M10 22V${h - 30}`} className="dp-faint" />
      {[1, 2, 3].map(d => <path key={d} d={`M7 ${f1(stepsY(d))}h6`} className="dp-faint" />)}
      <Handle n={1} shape="ring" x={10} y={stepsY(clampTo(1, 3, num(v, 'depth')))} label="Steps" does="Drag along the line: how many steps from the subject the graph reaches."
        onDrag={(_, y) => set('depth', Math.round(clampTo(1, 3, 1 + (y - 22) / (h - 22 - 30) * 2)))} />
    </g>}
    <text x={5} y={12} className="dp-axis">{size === 'compact' || size === 'tile' ? '' : local ? `from ${nodes.find(n => n[0] === SUBJECT)?.[1] ?? ''}` : 'whole field'}</text>
  </>
}

// ---------------------------------------------------------------- the controls

const light = (v: V) => str(v, 'light') as LightState
const NO_SCOPE = 'No mode’s set is set aside on the globe, so there is no whole-field choice to make.'
const NOT_LOCAL = 'Steps count from a subject, so they apply in a local graph.'
const NOT_GRAPH = 'The Graph is not a scale of the Earth.'
const NOT_OPENED = 'The constellation has not been opened in this session. Its controls stand when the Graph view is first shown.'
const NO_SUBJECT = 'Choose a subject on the Earth first: a place is declared by a subject.'
const NO_APERTURE = 'No owner opens the shared or federated field to the atlas yet.'
const NO_VIEW_AS = 'No owner discloses how the field or the public sees your world yet.'

const SCALES = [{value: 'system', label: 'System', does: 'The sky: the Earth among the Sun, the Moon and the planets.'}, {value: 'body', label: 'Body', does: 'The Earth whole.'}, {value: 'region', label: 'Region', does: 'A close view over a coast.'}] as const
const VIEWS = [{value: 'earth', label: 'Space', does: 'The bodies in space.'}, {value: 'graph', label: 'Graph', does: 'The same material, laid out by connection.'}] as const
const gate = (v: V) => (v.graphOpen === false ? NOT_OPENED : undefined)
const when = (v: V) => (on(v, 'allTime') ? 'all time' : yearText(fromU(num(v, 'cursor'))))
const stepsText = (x: number) => `${x} step${x === 1 ? '' : 's'}`

const viewRadio = (p: ViewProps, stack = true) => <Radio label="View" does="Space or Graph: the same material, drawn as bodies or by connection." value={str(p.v, 'view')} options={VIEWS} stack={stack} onChange={x => p.set('view', x)} />
const scaleChooser = (p: ViewProps) => <Chooser label="Scale" does="How close you look: system, body or region. The camera sets it." value={str(p.v, 'scale')} options={SCALES}
  disabled={str(p.v, 'view') === 'graph' ? NOT_GRAPH : undefined} onChange={x => p.set('scale', x)} />
const scaleRadio = (p: ViewProps) => <Radio label="Scale" does="How close you look: system, body or region. The camera sets it." value={str(p.v, 'scale')} options={SCALES} stack
  disabled={str(p.v, 'view') === 'graph' ? NOT_GRAPH : undefined} onChange={x => p.set('scale', x)} />
const timeDial = (p: ViewProps) => <Dial label="Year" does="The year in the window. The globe shows the places that stand in it." value={num(p.v, 'cursor')} def={1} scale={{min: 0, max: 1}} format={uText}
  heldBy={on(p.v, 'playing') ? 'the clock' : undefined} onHandBack={() => p.set('playing', false)} onChange={x => { p.set('cursor', x); p.set('allTime', false) }} />
const allTimeToggle = (p: ViewProps) => <Toggle label="All time" does="Show every place, with no window." on={on(p.v, 'allTime')} onChange={x => p.set('allTime', x)} />
const playToggle = (p: ViewProps) => <Toggle label="Play" does="Move the window through the years. A full sweep takes 42 seconds." on={on(p.v, 'playing')} onChange={x => { p.set('playing', x); if (x) p.set('allTime', false) }} />
const cumulativeToggle = (p: ViewProps) => <Toggle label="Cumulative" does="Keep every place that the window has passed." on={on(p.v, 'cumulative')} onChange={x => p.set('cumulative', x)} />
const wholeToggle = (p: ViewProps) => <Toggle label="Whole field" does={str(p.v, 'scope') ? `Draw the whole field, not only ${str(p.v, 'scope')}.` : 'Draw the whole field, not only the mode’s set.'} on={on(p.v, 'wholeField')}
  unknown={!str(p.v, 'scope')} disabled={str(p.v, 'scope') ? undefined : NO_SCOPE} onChange={x => p.set('wholeField', x)} />

const depthDial = (p: ViewProps) => <Dial label="Steps" does="How many steps from the subject the graph reaches. Three at most." value={num(p.v, 'depth')} def={1} scale={{min: 1, max: 3, step: 1}} format={stepsText}
  disabled={gate(p.v) ?? (p.v.local === false ? NOT_LOCAL : undefined)} onChange={x => p.set('depth', x)} />
const forceDial = (p: ViewProps, row: (typeof FORCE_ROWS)[number]) => <Dial key={row.key} label={row.label} does={row.does} value={num(p.v, row.key)} def={DEF_FORCES[row.key]} scale={{min: row.min, max: row.max}}
  format={x => `${(x / DEF_FORCES[row.key]).toFixed(2)}×`} disabled={gate(p.v)} onChange={x => p.set(row.key, Math.round(x * 100) / 100)} />
const flag = (p: ViewProps, key: string, label: string, does: string) => <Toggle key={key} label={label} does={does} on={on(p.v, key)} disabled={gate(p.v)} onChange={x => p.set(key, x)} />

const shownCount = (v: V) => `${PLACES.filter(pl => alphaOf(v, pl) > .03).length}/${PLACES.length}`

// ---------------------------------------------------------------- displays

function SpaceDisplay({v, set, w, h, size}: {v: V; set?: Put; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="The World" corner={on(v, 'allTime') ? 'all time' : `year ${when(v)}`}
    does="The Earth under its Sun. Each place stands at its position, lit or in shade. Drag handle 1 for the year and handle 2 for the scale.">
    <SpaceArt v={v} set={set} w={w} h={h} size={size} />
  </Display>
}
function GraphDisplay({v, set, w, h, size}: {v: V; set?: Put; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="The graph" corner={`${shown(v).nodes.length} nodes`}
    does="The same material laid out by connection, by the four forces. Drag handle 1 for the steps from the subject.">
    <GraphArt v={v} set={set} w={w} h={h} size={size} />
  </Display>
}
const WorldDisplay = (props: {v: V; set?: Put; w: number; h: number; size: Size}) => (str(props.v, 'view') === 'graph' ? <GraphDisplay {...props} /> : <SpaceDisplay {...props} />)

// ---------------------------------------------------------------- the pane: the material itself

const MARK = {exact: 'solid', region: 'outline'} as const
function FullWorld({v}: {v: V}) {
  const graph = str(v, 'view') === 'graph', known = skyRead(v)
  const sun = SUBSOLAR, ns = (x: number) => `${Math.abs(x).toFixed(1)}° ${x < 0 ? 'S' : 'N'}`, ew = (x: number) => `${Math.abs(x).toFixed(1)}° ${x < 0 ? 'W' : 'E'}`
  return <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label={graph ? 'The graph' : 'The World'}>
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        {graph ? <>
          <GraphArt v={v} w={760} h={420} size="big" />
          <text x={14} y={392} className="dp-axis">Ties: Jung solid, inferred dashed, site faint.</text>
          <text x={14} y={404} className="dp-axis">Amber: an archetype. Teal: a form of the field.</text>
        </> : <>
          <SpaceArt v={v} w={520} h={420} size="big" />
          <text x={548} y={34} className="dp-axis">place</text><text x={662} y={34} className="dp-axis">year</text><text x={716} y={34} className="dp-axis">mark</text>
          <path d="M548 42H748" className="dp-faint" />
          {PLACES.map((pl, i) => <g key={pl.id} opacity={alphaOf(v, pl) > .03 ? 1 : .4}>
            <text x={548} y={60 + i * 20} className="dp-ink">{pl.name}</text><text x={662} y={60 + i * 20} className="dp-ink-dim">{yearText(pl.year)}</text><text x={716} y={60 + i * 20} className="dp-ink-dim">{MARK[pl.precision]}</text>
          </g>)}
          <text x={548} y={272} className="dp-ink-dim">{str(v, 'view') === 'earth' ? `${str(v, 'scale')} scale · ${when(v)}` : ''}</text>
          <text x={548} y={288} className="dp-ink-dim">{known ? `Sun over ${ns(sun.lat)}, ${ew(sun.lon)}` : 'No Sun is read for this year.'}</text>
          <text x={548} y={304} className="dp-ink-dim">{`${shownCount(v)} places shown · imagery ${str(v, 'baseKind')}`}</text>
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
  },
  fixtures: {
    'Whole Earth, all time': {},
    'Year 450 in the window': {allTime: false, cursor: toU(450)},
    'Region, one scope': {scale: 'region', scope: 'this reading', selected: 'athens'},
    'Graph, three steps': {view: 'graph', depth: 3, skyAnchors: true},
  } as Readonly<Record<string, Record<string, Value>>>,

  folded: p => <Folded title="World" light={light(p.v)} readings={str(p.v, 'view') === 'graph' ? ['graph', stepsText(num(p.v, 'depth'))] : [str(p.v, 'scale'), when(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="World" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><WorldDisplay v={p.v} set={p.set} w={140} h={146} size="compact" /></Section>
    <Section label="Macros" cols={2}>
      {str(p.v, 'view') === 'graph' ? <>
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

  whole: p => <Panel title="World" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'space', label: 'Space'}, {id: 'graph', label: 'Graph'}]} page={p.page === 'graph' ? 'graph' : 'space'} onPage={p.setPage}>
    {p.page !== 'graph' ? <>
      <Band>
        <Section width={198}><SpaceDisplay v={p.v} set={p.set} w={186} h={146} size="whole" /></Section>
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
          <Chooser wide label="Relations" does="Draw only the places of one relation. All draws every relation." value={str(p.v, 'relation')} options={RELATIONS} onChange={x => p.set('relation', x)} />
          <Toggle label="✎ Place" does="Arm the Place tool. The next click on the Earth offers a point for the selected subject to its editor." on={on(p.v, 'placeArmed')}
            disabled={str(p.v, 'selected') ? undefined : NO_SUBJECT} onChange={x => p.set('placeArmed', x)} />
          <Rows does="The places of the field. A dim light means the Earth does not draw the place now." size={3} page={num(p.v, 'placePage')} onPage={x => p.set('placePage', x)}
            items={PLACES.map(pl => ({id: pl.id, name: pl.name, light: alphaOf(p.v, pl) > .03 ? 'lit' : 'dark', tone: 'value', note: yearText(pl.year)}))} />
        </Section>
        <Section label="Earth" width={64}>
          <Readout label="imagery" value={str(p.v, 'baseKind')} does="The sharpness of the base picture, as the globe holds it." />
          <Readout label="day, night" value={skyRead(p.v) ? 'lit' : 'even'} does="Lit by the Sun that the sky reports. Evenly lit when no Sun is read." />
        </Section>
        <Section label="Reach" grow>
          <Chooser wide label="Aperture" does="How far you look: world, local, shared or federated." value="" options={[{value: 'world', label: 'World'}, {value: 'local', label: 'Local'}, {value: 'shared', label: 'Shared'}, {value: 'federated', label: 'Federated'}]} disabled={NO_APERTURE} />
          <Chooser wide label="View as" does="Who you look as: me, the field or the public." value="" options={[{value: 'me', label: 'Me'}, {value: 'field', label: 'Field'}, {value: 'public', label: 'Public'}]} disabled={NO_VIEW_AS} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={198}><GraphDisplay v={p.v} set={p.set} w={186} h={146} size="whole" /></Section>
        <Section label="Steps" width={58}>
          {depthDial(p)}
        </Section>
        <Section label="Forces" cols={2} grow>
          {FORCE_ROWS.map(row => forceDial(p, row))}
        </Section>
      </Band>
      <Band>
        <Section label="Ties" width={76}>
          {flag(p, 'tieJung', 'Jung', 'Follow the links that Jung makes himself.')}
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
          <Readout label="sky" value={skyAnchorsOn(p.v) ? 'on' : 'off'} does="The sky layer of the graph: off, loading, on or unavailable." />
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => <FullWorld v={p.v} />,

  widget: p => <Tile title="World" light={light(p.v)} span={2} onFull={p.nav.full}>
    <SpaceDisplay v={p.v} w={112} h={104} size="tile" />
    <div className="ref-tile-side">
      <Readout label="scale" value={str(p.v, 'view') === 'graph' ? 'graph' : str(p.v, 'scale')} does="How close you look." />
      <Readout label="occasion" value={when(p.v)} does="The year in the window, or all time." />
      <Readout label="shown" value={shownCount(p.v)} does="The places the Earth draws now." />
    </div>
  </Tile>,
}
