// The environs of four process devices, read from the value keys each device's design already reads (manual §25.6 "Process types, read in
// time"; face-rig CREATURE-SPEC.md 24): the Gateway is a river (a stream with no done, §19.2), the Seat a succession (one lane after another
// on the same ground, §19.17), the NOWs the seasons (a field's cycle: a clearing active, quiescent, closed, archived, §23.6), Ground hygiene
// erosion (the effect of many runs on the ground: drift, worn paths, §18.5). Each reader takes the design's own values and answers the
// environ's reading, or why there is none in words: a key the owner did not report stays absent, never a sample, and nothing here moves
// on its own. Pure.

type V = Readonly<Record<string, unknown>>

/** No reading for the environ, and why. */
export interface EnvironAbsent { readonly absent: string }
export const isAbsent = (reading: object): reading is EnvironAbsent => 'absent' in reading

const num = (v: V, key: string): number | null => (typeof v[key] === 'number' && Number.isFinite(v[key]) ? v[key] as number : null)
const text = (v: V, key: string): string | null => (typeof v[key] === 'string' && v[key] !== '' ? v[key] as string : null)
const list = (v: V, key: string): unknown[] | null => {
  const raw = v[key]
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return null
  try { const parsed = JSON.parse(raw) as unknown; return Array.isArray(parsed) ? parsed : null } catch { return null }
}
const object = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? x as Record<string, unknown> : null)
const count = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null)

// ---------------------------------------------------------------- the river: the Gateway (§19.2)

/** The river's flow: water moving while the way in is open and checking in; still where no check-in came within Stall after (a stall
 * does not breathe); a dry bed while nothing can come in (Connect off, not admitted, or refused). */
export type RiverFlow = 'flowing' | 'still' | 'dry'
export interface RiverReading {
  readonly flow: RiverFlow
  /** Why the river stands as it does, in the owner's words where it gave them. */
  readonly why: string
  /** The sessions coming in (its currents): the turns running, else the distinct sessions of the frames; null where neither is reported. */
  readonly sessions: number | null
  /** Frames in flight (carried on the current); null where unreported. */
  readonly inflight: number | null
  /** Seconds since the last check-in and the threshold past which it is a stall; null where unreported. */
  readonly beatAge: number | null
  readonly stallAfter: number | null
  readonly harness: string | null
}

export function riverOf(v: V): RiverReading | EnvironAbsent {
  const refused = text(v, 'refused'), light = text(v, 'light'), connect = typeof v.connect === 'boolean' ? v.connect : null
  const readiness = text(v, 'readiness'), harness = text(v, 'harness')
  const beatAge = num(v, 'beatAge'), stallAfter = num(v, 'stallAfter'), running = num(v, 'running'), inflight = num(v, 'inflight')
  const frames = list(v, 'frames')
  const framed = frames ? new Set(frames.flatMap(row => { const s = object(row)?.session; return typeof s === 'string' && s ? [s] : [] })).size : null
  const sessions = running ?? (framed && framed > 0 ? framed : null)
  const base = {sessions, inflight, beatAge: beatAge !== null && beatAge >= 0 ? beatAge : null, stallAfter, harness}
  if (refused) return {flow: 'dry', why: refused, ...base}
  if (connect === false) return {flow: 'dry', why: 'Connect is off: nothing comes in through this gateway.', ...base}
  if (light === 'dark') return {flow: 'dry', why: 'The gateway is not admitted: nothing comes in.', ...base}
  if (light === null && connect === null && readiness === null) return {absent: 'The gateway has not reported its state yet.'}
  if (base.beatAge !== null && stallAfter !== null && base.beatAge > stallAfter) return {flow: 'still', why: `No check-in for ${Math.round(base.beatAge)} s: past Stall after (${stallAfter} s).`, ...base}
  return {flow: 'flowing', why: readiness ? `The harness says ${readiness}.` : 'The way in is open.', ...base}
}

// ---------------------------------------------------------------- the seasons: the NOWs (§23.6)

/** A clearing's season (CREATURE-SPEC.md 25.1): active is in growth, quiescent dormant, closed harvested, archived in the record. */
export type Season = 'growth' | 'dormant' | 'harvested' | 'record'
const SEASON_OF: Readonly<Record<string, Season>> = {active: 'growth', quiescent: 'dormant', closed: 'harvested', archived: 'record'}
export interface SeasonsReading {
  /** The clearings standing in the field, oldest first (active and quiescent), each by its own words. */
  readonly standing: readonly {readonly ref: string; readonly purpose: string; readonly season: 'growth' | 'dormant'}[]
  /** How many clearings stand in each season (archived ones too, where the ground's listing counts them). */
  readonly counts: Readonly<Record<Season, number | null>>
}

export function seasonsOf(v: V): SeasonsReading | EnvironAbsent {
  const rows = list(v, 'nows')
  if (!rows) return {absent: text(v, 'reason') ?? 'The ground has not listed its NOW clearings yet.'}
  const clearings = rows.flatMap(row => {
    const r = object(row)
    const season = r && typeof r.lifecycle === 'string' ? SEASON_OF[r.lifecycle] : undefined
    return r && season && typeof r.now_ref === 'string' ? [{ref: r.now_ref, purpose: typeof r.purpose === 'string' ? r.purpose : r.now_ref, season,
      created: typeof r.created_at_unix_seconds === 'number' ? r.created_at_unix_seconds : 0}] : []
  })
  const standing = clearings.filter((c): c is typeof c & {season: 'growth' | 'dormant'} => c.season === 'growth' || c.season === 'dormant')
    .sort((a, b) => a.created - b.created).map(({ref, purpose, season}) => ({ref, purpose, season}))
  // The full year where the listing's own counts are carried (`seasons`, archived included); else what `nows` holds, and the record unread.
  const told = object(typeof v.seasons === 'string' ? (() => { try { return JSON.parse(v.seasons as string) as unknown } catch { return null } })() : v.seasons)
  const tally = (season: Season) => clearings.filter(c => c.season === season).length
  const counts: Record<Season, number | null> = told
    ? {growth: count(told.active), dormant: count(told.quiescent), harvested: count(told.closed), record: count(told.archived)}
    : {growth: tally('growth'), dormant: tally('dormant'), harvested: tally('harvested'), record: null}
  return {standing, counts}
}

// ---------------------------------------------------------------- the succession: the Seat (§19.17)

/** One seat's ground: free (cleared, ready for the next lane), held by a lane, held by a foreign lane, or unread. */
export interface SeatPlot {
  readonly seat: string
  readonly state: 'free' | 'held' | 'foreign' | 'unknown'
  /** The lane that holds it (its branch), where one does. */
  readonly lane: string | null
  /** The lane's growth on the ground: commits main does not hold; null where unreported. */
  readonly ahead: number | null
  /** Main moved on under the lane: commits on main the lane does not hold; null where unreported. */
  readonly behind: number | null
  /** Ground turned and not yet laid down: changes not committed (tracked and untracked); null where unreported. */
  readonly loose: number | null
  /** Who works the lane: the actors with zones on it (at least the claimant). */
  readonly workers: number
  readonly drift: boolean
}
export interface SuccessionReading { readonly product: string; readonly plots: readonly SeatPlot[] }

export function successionOf(v: V): SuccessionReading | EnvironAbsent {
  const rows = list(v, 'seats')
  if (!rows) return {absent: text(v, 'reason') ?? 'The seat instrument has not answered (seat status).'}
  const seats = rows.flatMap(row => { const r = object(row); return r && typeof r.workcell === 'string' && typeof r.product === 'string' ? [r] : [] })
  const product = text(v, 'product') ?? (typeof seats[0]?.product === 'string' ? seats[0].product as string : null)
  if (!product) return {absent: 'The seat instrument lists no product.'}
  const plots = seats.filter(r => r.product === product).map((r): SeatPlot => {
    const state = r.state === 'free' ? 'free' : r.state === 'claimed' ? 'held' : r.state === 'occupied-foreign-lane' ? 'foreign' : 'unknown'
    const dirty = count(r.dirty), untracked = count(r.untracked)
    const actors = new Set((Array.isArray(r.zones) ? r.zones : []).flatMap(zone => { const a = object(zone)?.actor; return typeof a === 'string' ? [a] : [] }))
    if (typeof r.claimedBy === 'string' && r.claimedBy) actors.add(r.claimedBy)
    return {seat: r.workcell as string, state, lane: state === 'free' ? null : typeof r.branch === 'string' && r.branch ? r.branch : null,
      ahead: count(r.ahead), behind: count(r.behind), loose: dirty === null && untracked === null ? null : (dirty ?? 0) + (untracked ?? 0),
      workers: state === 'free' ? 0 : Math.max(1, actors.size), drift: !!r.drift && r.drift !== 'none'}
  }).sort((a, b) => a.seat.localeCompare(b.seat))
  if (!plots.length) return {absent: `The seat instrument lists no seat of ${product}.`}
  return {product, plots}
}

// ---------------------------------------------------------------- the erosion: Ground hygiene (§18.5)

export type HygienePage = 'checkouts' | 'ground' | 'material'
/** How deep the passage has worn: a print (read, no fault), a groove (drift the owner can tend), a gully (something lost or breached). */
export type WearDepth = 1 | 2 | 3
export interface Wear { readonly kind: string; readonly subject: string; readonly depth: WearDepth; readonly tendable: boolean }
export interface ErosionReading {
  readonly pages: readonly {readonly page: HygienePage; readonly wear: readonly Wear[]; readonly unsurveyed: readonly string[]}[]
}

const PAGE_OF: Readonly<Record<string, HygienePage>> = {
  'seat-claimed': 'checkouts', 'seat-drift': 'checkouts', 'seat-floor-breach': 'checkouts', 'checkout-missing': 'checkouts', 'stray-branch': 'checkouts',
  'worktree-outside-register': 'checkouts', 'foreign-lane': 'checkouts', 'occupied-by-landed': 'checkouts',
  'root-part-missing': 'ground', 'root-mixed': 'ground', 'scaffold-missing': 'ground', 'source-unrecognised': 'ground',
  'binding-drift': 'material', 'binding-lost': 'material', 'sandbox-orphan': 'material', 'sandbox-unproven': 'material',
}
/** A finding the owner classes as no fault leaves a print; drift and strays a groove; a loss, a breach or an orphan a gully. */
const DEPTH_OF: Readonly<Record<string, WearDepth>> = {
  'seat-claimed': 1, 'sandbox-unproven': 1, 'source-unrecognised': 1, 'foreign-lane': 1,
  'seat-drift': 2, 'stray-branch': 2, 'worktree-outside-register': 2, 'occupied-by-landed': 2, 'scaffold-missing': 2, 'binding-drift': 2, 'root-mixed': 2,
  'seat-floor-breach': 3, 'checkout-missing': 3, 'root-part-missing': 3, 'binding-lost': 3, 'sandbox-orphan': 3,
}
const PAGE_SOURCES: Readonly<Record<HygienePage, RegExp>> = {
  checkouts: /seat|worktree|for-each-ref|branch|disk/i, ground: /central\.|projectcentral\.|doctor|reproject|ground\.inspect/i, material: /material|workcell|sandbox/i,
}

export function erosionOf(v: V): ErosionReading | EnvironAbsent {
  const findings = list(v, 'findings')
  if (!findings) return {absent: text(v, 'reason') ?? 'Ground hygiene has not read the ground yet.'}
  const sources = (list(v, 'sources') ?? []).flatMap(row => { const r = object(row); return r && typeof r.boundaryOp === 'string' ? [r] : [] })
  const pages = (['checkouts', 'ground', 'material'] as const).map(page => ({
    page,
    wear: findings.flatMap((row): Wear[] => {
      const r = object(row)
      if (!r || typeof r.kind !== 'string' || PAGE_OF[r.kind] !== page) return []
      return [{kind: r.kind, subject: typeof r.subject === 'string' ? r.subject : r.kind, depth: DEPTH_OF[r.kind] ?? 2, tendable: typeof r.tenderId === 'string' && r.tenderId !== ''}]
    }),
    // A read the owner refused leaves its stretch of ground unsurveyed, in the owner's words.
    unsurveyed: sources.filter(r => typeof r.refusal === 'string' && r.refusal && PAGE_SOURCES[page].test(r.boundaryOp as string)).map(r => `${r.boundaryOp}: ${r.refusal}`),
  }))
  return {pages}
}
