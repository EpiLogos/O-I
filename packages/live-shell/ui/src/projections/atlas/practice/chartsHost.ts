// The Astrology lens's chart, held from your identity (manual §24.6: "Your natal sky comes from your identity. The shell does not compute a
// second chart"; "Your identity is kept in your ground. Practice, journeys and answers never write it").
//
// The lens (src/lenses/astrology.ts) and the controller's birth sky (src/app/controller.ts applyNatal) read your chart from the practice
// store's chart collection (src/astro/charts.ts localChart), and draw a held chart as it is (chartOf): the port computes none for it. The
// seam is the store's own binding (src/practice/store.ts setPracticeStorage), as the dream journal's (practice/dreamsHost.ts): this module
// hands it a Storage whose chart collection (`aae.practice.v1.charts`) is your saved identity's natal — opened at its revision through the
// identity owner and calculated by QL from exactly that profile (desktop/cradle/src/nara/beingIdentity.ts readYourNatal) — mapped to the
// atlas's chart contract (SidecarChart, checked by the port's own sky/sidecar.ts chartProblems), and every other collection to the store
// it was bound to before. A chart is never kept from the lens: saving, changing, deleting or wiping it is refused in words, and nothing
// moves; your birth is given, or corrected, in the identity of the Studio's Nara chain (§24.6).
//
// The lens's material ('astrology', read through the provider's published door, src/data/published.ts) is published here too, corpus-
// neutral: the ten bodies the walk climbs (Moon to the Sun, the lens's own order) with no quotation, no curated person and no gazetteer,
// and where your chart comes from (`yours`), so the lens offers no form of its own. It is answered once your chart is read, so the lens
// reads both together.
import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import {readYourNatal} from '../../../../../../../desktop/cradle/src/nara/beingIdentity'
import type {PublishedSource} from '../src/data/published'
import type {BirthData} from '../src/astro/natal'
import {chartProblems} from '../src/sky/sidecar'
import {SIGNS} from '../src/sky/frames'
import type {BodyKey, ChartPoint, SidecarChart} from '../src/types/sky'

/** The chart collection's key in the store (src/practice/store.ts PREFIX + 'charts'); your chart's id there (src/astro/charts.ts YOU). */
export const CHARTS_KEY = 'aae.practice.v1.charts'
const YOU = 'you'

/** What the binding says when the lens would keep, change or delete a chart. */
export const CHART_IS_YOURS = 'Your chart is your saved identity’s, as QL calculated it: give your birth, or correct it, in the identity of the Studio’s Nara chain. The lens keeps no chart of its own, and nothing was kept.'
/** QL's reason for no chart, in words: it imputes no birth time. */
export const UNKNOWN_TIME = 'QL calculates no chart for an unknown birth time (its reason: unknown-birth-time): give your birth time in the identity of the Studio’s Nara chain.'
/** Where your chart comes from, in the lens's own place for it. */
export const YOURS_LINE = 'Your chart is your saved identity’s, calculated by QL from your birth: the lens computes none of its own. To give your birth, or to correct it, open the identity of the Studio’s Nara chain.'

export type HeldChart = SidecarChart & {timeKnown: boolean}
export interface YourChart {
  readonly label: string
  readonly birth: BirthData
  readonly chart: HeldChart
  readonly source: {readonly source_ref: string; readonly revision: string}
}
export type YourChartReading = {readonly ok: true; readonly chart: YourChart} | {readonly ok: false; readonly reason: string}

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.map(record).filter((r): r is Record<string, unknown> => r !== null) : [])

/** The ten bodies of a chart, by QL's names (`Sun` … `Pluto`) as the port's keys. */
const CHART_KEYS: readonly BodyKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
const keyOf = (name: unknown): BodyKey | null => {
  const key = typeof name === 'string' ? name.toLowerCase() : ''
  return (CHART_KEYS as readonly string[]).includes(key) ? key as BodyKey : null
}

/** A longitude as the contract states it: its sign and its degree in the sign, which must agree with it (sky/sidecar.ts chartProblems). */
function pointAt(lon: number, retrograde: boolean, house: string | null = null): ChartPoint {
  // QL's longitude as it is: only one outside a turn is brought into it
  const l = lon >= 0 && lon < 360 ? lon : ((lon % 360) + 360) % 360
  const signIndex = Math.min(11, Math.floor(l / 30))
  return {lon: l, sign: SIGNS[signIndex]!, signIndex, degree: l - signIndex * 30, retrograde, house}
}

/** QL's natal (`ql.nara-natal/v1`, as `nara calculate` returns it) as the atlas's chart contract, with the birth it was calculated from;
 * or why there is none. Every place is QL's: the bodies (its sky), the angles, the houses and the aspects; nothing is computed but each
 * place's sign and degree, which restate its longitude. A chart that fails the port's own contract check is refused, never drawn. Pure. */
export function chartOfNatal(natalValue: unknown, profileValue: unknown): {chart: HeldChart; birth: BirthData} | {reason: string} {
  const natal = record(natalValue), profile = record(profileValue)
  if (!natal || natal.schema !== 'ql.nara-natal/v1') return {reason: 'Your identity carries no natal chart.'}
  const chart = record(natal.chart), sky = record(natal.sky), time = record(natal.time_resolution)
  if (natal.status !== 'available' || !chart || !sky || !time) {
    const why = str(natal.reason)
    return {reason: why === 'unknown-birth-time' ? UNKNOWN_TIME : `QL calculated no chart for your identity${why ? ` (its reason: ${why})` : ''}.`}
  }
  if (str(chart.zodiac)?.toLowerCase() !== 'tropical') return {reason: `QL calculated your chart in the ${str(chart.zodiac) ?? 'unnamed'} zodiac: the atlas draws only the tropical.`}
  const bodies: SidecarChart['bodies'] = {}
  for (const body of list(sky.bodies)) {
    const key = keyOf(body.body), lon = num(body.longitude_degrees)
    if (key && lon !== null) bodies[key] = pointAt(lon, body.retrograde === true)
  }
  const houseOf = new Map(list(chart.bodies).map(point => [keyOf(point.name), str(point.house)]))
  for (const key of CHART_KEYS) if (bodies[key]) bodies[key] = {...bodies[key]!, house: houseOf.get(key) ?? null}
  const angle = (name: string) => {
    const lon = num(list(chart.angles).find(point => point.name === name)?.abs_pos)
    return lon === null ? null : pointAt(lon, false)
  }
  const ascendant = angle('Ascendant'), midheaven = angle('Medium_Coeli')
  if (!ascendant || !midheaven) return {reason: 'QL’s chart for your identity names no Ascendant or Midheaven.'}
  const cusps = list(chart.houses).map(house => num(house.abs_pos)).filter((lon): lon is number => lon !== null)
  const system = str(chart.houses_system_name) ?? 'unnamed'
  const aspects: SidecarChart['aspects'] = list(chart.aspects).flatMap(aspect => {
    const a = keyOf(aspect.p1_name), b = keyOf(aspect.p2_name), type = str(aspect.aspect), orb = num(aspect.orbit)
    return a && b && type && orb !== null ? [{a, b, type, orb}] : []
  })
  const birth = record(profile?.birth), place = record(birth?.place)
  const offset = num(time.utc_offset_seconds), utc = str(natal.epoch_utc), date = str(birth?.date)
  const lat = num(place?.latitude_degrees), lon = num(place?.longitude_degrees)
  if (offset === null || !utc || !date || lat === null || lon === null) return {reason: 'QL’s chart for your identity does not say when and where it was cast.'}
  const precision = str(time.precision), uncertainty = num(time.uncertainty_minutes)
  const approximate = precision !== 'exact'
  const held: HeldChart = {
    input: {local: (str(time.local_datetime) ?? `${date}T${str(birth?.time) ?? ''}`).slice(0, 16), lat, lon, tz: str(time.timezone) ?? 'UTC', utcOffsetMinutes: offset / 60},
    utc: utc.replace(/\.\d+Z$/, 'Z'),
    jd: num(sky.julian_day_ut_argument) ?? Date.parse(utc) / 86_400_000 + 2_440_587.5,
    approximate,
    approximateReason: approximate ? `Your birth time is approximate${uncertainty !== null ? ` (±${uncertainty} minutes)` : ''}: QL casts the chart ${str(chart.uncertainty_policy) ?? 'at the time given'}.` : null,
    warnings: [],
    zodiac: 'tropical',
    bodies,
    angles: {ascendant, midheaven},
    houses: {requested: system, effective: system, cusps},
    aspects,
    // QL states no lunar phase and no sidereal time with a chart; nothing in the port reads a chart's sidereal time (its sky layer keeps
    // its own clock), and a chart without a phase draws none (sky/chart.ts).
    moon: null,
    gmst: Number.NaN,
    // QL casts no chart for an unknown birth time (no time is imputed), so a chart it returns always has its time.
    timeKnown: true,
  }
  const problems = chartProblems(held)
  if (problems.length) return {reason: `QL’s chart for your identity does not keep the chart contract the atlas draws: ${problems.join('; ')}.`}
  return {chart: held, birth: {date, time: str(birth?.time), offsetMinutes: offset / 60, lat, lon, place: str(place?.label) ?? ''}}
}

/** Your chart, read through its owners: your saved identity opened at its revision, QL's calculation of exactly that profile, mapped. */
export function kernelYourChart(transport: KernelTransportStatus): () => Promise<YourChartReading> {
  return async () => {
    const natal = await readYourNatal(transport)
    if (!natal.ok) return {ok: false, reason: natal.reason === 'unknown-birth-time' ? UNKNOWN_TIME : natal.reason}
    const mapped = chartOfNatal(natal.natal, natal.profile)
    if ('reason' in mapped) return {ok: false, reason: mapped.reason}
    return {ok: true, chart: {label: natal.name ?? 'You', birth: mapped.birth, chart: mapped.chart, source: natal.source}}
  }
}

/** The walk's bodies, Moon to the Sun (the lens's own order: AE public/data/astrology.json `order.bodies`), by name. */
const WALK: readonly [BodyKey, string][] = [['moon', 'Moon'], ['mercury', 'Mercury'], ['venus', 'Venus'], ['mars', 'Mars'], ['jupiter', 'Jupiter'],
  ['saturn', 'Saturn'], ['uranus', 'Uranus'], ['neptune', 'Neptune'], ['pluto', 'Pluto'], ['sun', 'Sun']]

/** The lens's material with no corpus (src/lenses/astrology.ts AstrologyData): the bodies the walk climbs, no quotation, no curated person,
 * no gazetteer; and where your chart comes from, or why there is none. Pure. */
export function astrologyMaterial(yours: YourChartReading | null): Record<string, unknown> {
  return {
    version: 1,
    gazetteer: {source: {claim: 'No gazetteer is published: your birthplace is your identity’s.'}, places: []},
    frame: [],
    pillars: null,
    order: {bodies: WALK.map(([key]) => key), line: '', quote: null},
    bodies: Object.fromEntries(WALK.map(([key, name]) => [key, {key, name, line: '', quotes: [], ties: [], burt: []}])),
    signs: {},
    people: [],
    yours: {line: YOURS_LINE, none: !yours ? 'Your identity has not been read yet.' : yours.ok ? null : yours.reason},
  }
}

export interface YourChartBinding {
  /** The Storage the practice store is bound to. */
  readonly storage: Storage
  /** Settles once your chart is read (or found absent: `fault` says why). */
  readonly ready: Promise<void>
  /** Read your chart now, when the binding was made deferred. */
  start(): void
  /** The provider's published material with the lens's own ('astrology') answered here; every other name is `prior`'s. */
  published(prior: PublishedSource | null): PublishedSource
  /** Why no chart is held, when none is. */
  fault(): string | null
  dispose(): void
}

/** Bind the chart collection to your identity's chart, every other collection to `base`. */
export function bindYourChart(input: {base: Storage; read: () => Promise<YourChartReading>; said: (text: string) => void;
  /** Read your chart only once `start` is called, or once the chart or the lens's material is first asked for. */
  deferred?: boolean}): YourChartBinding {
  const {base, read, said} = input
  let held: YourChartReading | null = null
  let at = ''
  let disposed = false
  let begin!: () => void
  const started = new Promise<void>(resolve => { begin = resolve })
  let starting = false
  const start = () => { if (!starting) { starting = true; begin() } }
  const ready = started.then(async () => {
    try { held = await read() } catch (cause) { held = {ok: false, reason: `Your identity was not read: ${cause instanceof Error ? cause.message : String(cause)}`} }
    at = new Date().toISOString()
  })
  if (!input.deferred) start()
  const refuse = (): never => {
    said(CHART_IS_YOURS)
    throw new Error(CHART_IS_YOURS)
  }
  const stored = (): string => {
    if (disposed || !held?.ok) return '[]'
    const yours = held.chart
    return JSON.stringify([{id: YOU, createdAt: at, updatedAt: at, label: yours.label, birth: yours.birth, chart: yours.chart}])
  }
  const storage: Storage = {
    get length() { return base.length },
    key: index => base.key(index),
    getItem: key => {
      if (key !== CHARTS_KEY) return base.getItem(key)
      start()
      return stored()
    },
    setItem: (key, value) => {
      if (key !== CHARTS_KEY) { base.setItem(key, value); return }
      // The store writes the whole collection: writing back exactly what it holds keeps nothing new, so it is no change.
      if (value === stored()) return
      refuse()
    },
    removeItem: key => {
      if (key !== CHARTS_KEY) { base.removeItem(key); return }
      refuse()
    },
    clear: () => base.clear(),
  }
  return {
    storage,
    ready,
    start,
    published: prior => async name => {
      if (name !== 'astrology') return prior ? prior(name) : null
      start()
      await ready
      return new Response(JSON.stringify(astrologyMaterial(held)), {status: 200, headers: {'content-type': 'application/json'}})
    },
    fault: () => (held && !held.ok ? held.reason : null),
    dispose() { disposed = true },
  }
}
