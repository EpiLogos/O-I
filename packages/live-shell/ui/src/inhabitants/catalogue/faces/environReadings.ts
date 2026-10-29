// The environs of the process devices, each read from the value keys its device already carries (manual §25.6 "Process types, read in
// time": an environ shows a process's course; environs are process faces, creatures agent faces). The Gateway is a river, a stream with no
// done (§19.2); the NOWs are the seasons, a field's cycle (§23.6); the Seat page of Git / landing is a succession, one lane after another
// on the same ground (§19.16); its Checkouts page and Docs are erosion, the effect of many runs on the ground (§19.16, §18.5). Each reader
// takes the device's own values and answers the environ's reading, or the reading it waits on, in words: a key the owner did not report
// stays absent, never a sample, and nothing here moves by itself. Pure.

type V = Readonly<Record<string, unknown>>

/** No reading for the environ: `waits` names the reading it waits on, in words that can stand in the picture. */
export interface EnvironAbsent { readonly absent: true; readonly waits: string }
export const isAbsent = (reading: object): reading is EnvironAbsent => 'absent' in reading && (reading as EnvironAbsent).absent === true
const waiting = (waits: string): EnvironAbsent => ({absent: true, waits})

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (v: V, key: string): number | null => (typeof v[key] === 'number' && Number.isFinite(v[key]) ? v[key] as number : null)
const text = (v: V, key: string): string | null => (typeof v[key] === 'string' && v[key] !== '' ? v[key] as string : null)
const count = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null)
const parsed = (raw: unknown): unknown => { if (typeof raw !== 'string') return raw; try { return JSON.parse(raw) as unknown } catch { return undefined } }
const list = (v: V, key: string): unknown[] | null => { const x = parsed(v[key]); return Array.isArray(x) ? x : null }
const rows = (v: V, key: string): Record<string, unknown>[] | null => list(v, key)?.filter(isObj) ?? null
/** "a, b and c" */
export const series = (words: readonly string[]): string => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`)

// ---------------------------------------------------------------- the river: the Gateway (§19.2)

/** The four link readings the river flows on (catalogue/panels/actuation__gateway.tsx: `beatAge`, `running`, `inflight`, `frames`). The
 * Gateway's binding carries them from AIKit's gateway, which names the binding's link (agent/devices/designBindings.ts gatewayLinkValues);
 * until all four stand, the river is still and says which it waits on. */
export const RIVER_READINGS = ['beatAge', 'running', 'inflight', 'frames'] as const
export type RiverKey = (typeof RIVER_READINGS)[number]
export const RIVER_WORDS: Readonly<Record<RiverKey, string>> = {beatAge: 'the time since the last check-in', running: 'the turns running', inflight: 'the frames in flight', frames: 'the frames'}

/** Flowing while the way in is open and every link reading stands, with a check-in inside Stall after; still while a reading is missing,
 * or past Stall after (a stall does not breathe); a dry bed while nothing can come in (Connect off, not admitted, or refused). */
export type RiverFlow = 'flowing' | 'still' | 'dry'
export interface RiverReading {
  readonly flow: RiverFlow
  /** Why it stands so, in the owner's words where it gave them. */
  readonly why: string
  /** The link readings the river waits on (empty when all four stand). */
  readonly waits: readonly RiverKey[]
  /** The sessions coming in (its currents): the turns running, else the distinct sessions of the frames. */
  readonly sessions: number | null
  /** Frames in flight, carried on the current. */
  readonly inflight: number | null
  readonly beatAge: number | null
  readonly stallAfter: number | null
}

export function riverOf(v: V): RiverReading | EnvironAbsent {
  const refused = text(v, 'refused'), light = text(v, 'light'), connect = typeof v.connect === 'boolean' ? v.connect : null
  const beatAge = num(v, 'beatAge'), stallAfter = num(v, 'stallAfter'), running = num(v, 'running'), inflight = num(v, 'inflight'), frames = rows(v, 'frames')
  const has: Record<RiverKey, boolean> = {beatAge: beatAge !== null, running: running !== null, inflight: inflight !== null, frames: frames !== null}
  const waits = RIVER_READINGS.filter(key => !has[key])
  const framed = frames ? new Set(frames.flatMap(row => (typeof row.session === 'string' && row.session ? [row.session] : []))).size : 0
  const base = {waits, sessions: running ?? (framed > 0 ? framed : null), inflight, beatAge, stallAfter}
  if (refused) return {flow: 'dry', why: refused, ...base}
  if (connect === false) return {flow: 'dry', why: 'Connect is off: nothing comes in through this gateway.', ...base}
  if (light === 'dark') return {flow: 'dry', why: 'The gateway is not admitted: nothing comes in.', ...base}
  if (light === null && connect === null && text(v, 'readiness') === null && waits.length === RIVER_READINGS.length) return waiting('Waits on the gateway: it has reported nothing yet.')
  if (waits.length) return {flow: 'still', why: `Waits on ${series(waits.map(key => RIVER_WORDS[key]))}.`, ...base}
  if (beatAge! < 0) return {flow: 'still', why: 'No check-in has come yet.', ...base}
  if (stallAfter !== null && beatAge! > stallAfter) return {flow: 'still', why: `No check-in for ${Math.round(beatAge!)} s: past Stall after (${stallAfter} s).`, ...base}
  return {flow: 'flowing', why: `Checked in ${Math.round(beatAge!)} s ago.`, ...base}
}

// ---------------------------------------------------------------- the seasons: the NOWs (§23.6)

/** A clearing's season: active is in growth, quiescent dormant, closed harvested, archived in the record. */
export type Season = 'growth' | 'dormant' | 'harvested' | 'record'
const SEASON_OF: Readonly<Record<string, Season>> = {active: 'growth', quiescent: 'dormant', closed: 'harvested', archived: 'record'}
export interface SeasonsReading {
  /** The clearings standing in the field (active and quiescent), oldest first, each by its own words. */
  readonly standing: readonly {readonly ref: string; readonly purpose: string; readonly season: 'growth' | 'dormant'}[]
  /** How many clearings stand in each season; the record is null where the listing's year was not counted (`seasons`). */
  readonly counts: Readonly<Record<Season, number | null>>
}

export function seasonsOf(v: V): SeasonsReading | EnvironAbsent {
  const listed = rows(v, 'nows')
  if (!listed) return waiting(text(v, 'reason') ? `Waits on the NOW listing: ${text(v, 'reason')}.` : 'Waits on the NOW listing (central.now.list).')
  const clearings = listed.flatMap(r => {
    const season = typeof r.lifecycle === 'string' ? SEASON_OF[r.lifecycle] : undefined
    return season && typeof r.now_ref === 'string' ? [{ref: r.now_ref, purpose: typeof r.purpose === 'string' && r.purpose ? r.purpose : r.now_ref, season,
      created: typeof r.created_at_unix_seconds === 'number' ? r.created_at_unix_seconds : 0}] : []
  })
  const standing = clearings.filter((c): c is typeof c & {season: 'growth' | 'dormant'} => c.season === 'growth' || c.season === 'dormant')
    .sort((a, b) => a.created - b.created).map(({ref, purpose, season}) => ({ref, purpose, season}))
  // The whole year where the binding counted it over the listing (`seasons`, the archived clearings too); else what `nows` holds, the
  // record unread (the rows leave the archived ones out).
  const told = parsed(v.seasons)
  const tally = (season: Season) => clearings.filter(c => c.season === season).length
  const counts: Record<Season, number | null> = isObj(told)
    ? {growth: count(told.active), dormant: count(told.quiescent), harvested: count(told.closed), record: count(told.archived)}
    : {growth: tally('growth'), dormant: tally('dormant'), harvested: tally('harvested'), record: null}
  return {standing, counts}
}

// ---------------------------------------------------------------- the succession: the Seat page of Git / landing (§19.16)

/** One seat's ground: cleared for the next lane, held by a lane, held by another lane's unmerged work, or unread. */
export interface SeatPlot {
  readonly seat: string
  readonly state: 'free' | 'held' | 'foreign' | 'unknown'
  /** The lane that holds it (its branch). */
  readonly lane: string | null
  /** The lane's growth: commits main does not hold. */
  readonly ahead: number | null
  /** Main moved on under the lane: commits on main the lane does not hold. */
  readonly behind: number | null
  /** Ground turned and not yet laid down: files with no commit, tracked and untracked. */
  readonly loose: number | null
  /** Who works the lane: the agents attached, else the claimant and the zones' actors. */
  readonly workers: number
  /** The register and the checkout disagree (the hygiene model's seat drift). */
  readonly drift: boolean
}
export interface SuccessionReading { readonly product: string; readonly plots: readonly SeatPlot[] }

export function successionOf(v: V): SuccessionReading | EnvironAbsent {
  const seats = rows(v, 'seats')?.filter(r => typeof r.workcell === 'string' && typeof r.product === 'string')
  if (!seats) return waiting('Waits on the seat instrument (seat status).')
  const product = text(v, 'product') ?? (seats[0]?.product as string | undefined) ?? null
  if (!product) return waiting('Waits on a product: the seat instrument lists none on this machine.')
  const plots = seats.filter(r => r.product === product).map((r): SeatPlot => {
    const state = r.state === 'free' ? 'free' : r.state === 'claimed' ? 'held' : r.state === 'occupied-foreign-lane' ? 'foreign' : 'unknown'
    const dirty = count(r.dirty), untracked = count(r.untracked)
    const named = Array.isArray(r.workers) ? r.workers.filter((x): x is string => typeof x === 'string') : []
    const actors = new Set(named.length ? named : (Array.isArray(r.zones) ? r.zones : []).flatMap(zone => (isObj(zone) && typeof zone.actor === 'string' ? [zone.actor] : [])))
    if (!named.length && typeof r.claimedBy === 'string' && r.claimedBy) actors.add(r.claimedBy)
    return {seat: r.workcell as string, state, lane: state === 'free' ? null : typeof r.branch === 'string' && r.branch ? r.branch : null,
      ahead: count(r.ahead), behind: count(r.behind), loose: dirty === null && untracked === null ? null : (dirty ?? 0) + (untracked ?? 0),
      workers: state === 'free' ? 0 : Math.max(1, actors.size), drift: typeof r.drift === 'string' ? r.drift !== '' && r.drift !== 'none' : r.drift === true}
  }).sort((a, b) => a.seat.localeCompare(b.seat))
  if (!plots.length) return waiting(`Waits on a seat of ${product}: the seat instrument lists none.`)
  return {product, plots}
}

// ---------------------------------------------------------------- the erosion: Checkouts (§19.16) and Docs (§18.5)

/** How deep the passage has worn: a print (read, no fault, or worn by passage), a groove (drift you can tend), a gully (a loss, a breach). */
export type WearDepth = 1 | 2 | 3
/** One kind of wear on a stretch, however often it came: one channel, as wide as it is frequent. */
export interface Wear { readonly kind: string; readonly label: string; readonly count: number; readonly depth: WearDepth; readonly tendable: boolean }
export interface ErosionStretch {
  readonly id: string
  readonly label: string
  /** worn: read, with wear; sound: read, no wear; unsurveyed: its read was refused or is missing; bare: nothing stands on it to wear. */
  readonly state: 'worn' | 'sound' | 'unsurveyed' | 'bare'
  readonly wear: readonly Wear[]
  /** Why it is unsurveyed or bare, or which of its reads was refused, in the owner's words where it gave them. */
  readonly why: string | null
}
export interface ErosionReading {
  readonly stretches: readonly ErosionStretch[]
  /** A reading of the whole ground not read, in the owner's words (Docs: Meaning, Moved since). */
  readonly unread: readonly string[]
}

const worn = (wear: Map<string, Wear>, kind: string, label: string, depth: WearDepth, n = 1, tendable = false) => {
  const was = wear.get(kind)
  wear.set(kind, {kind, label, depth, count: (was?.count ?? 0) + n, tendable: (was?.tendable ?? false) || tendable})
}
const stretch = (id: string, label: string, wear: Map<string, Wear>, why: string | null, bare = false): ErosionStretch => {
  const all = [...wear.values()].sort((a, b) => b.depth - a.depth || b.count - a.count)
  return {id, label, wear: all, why, state: all.length ? 'worn' : bare ? 'bare' : why !== null ? 'unsurveyed' : 'sound'}
}

/** The Checkouts page's rings, outside in, and which of a finding's kinds wears each (workcell__git-seat.tsx RING_OF). */
const RINGS = [{id: 'branches', label: 'branches', op: /for-each-ref|branch/}, {id: 'seats', label: 'seats', op: /seat status/}, {id: 'worktrees', label: 'worktrees', op: /worktree/}] as const
const RING_OF: Readonly<Record<string, (typeof RINGS)[number]['id']>> = {
  'seat-claimed': 'seats', 'seat-drift': 'seats', 'seat-floor-breach': 'seats', 'checkout-missing': 'seats', 'foreign-lane': 'seats', 'occupied-by-landed': 'seats',
  'stray-branch': 'branches', 'worktree-outside-register': 'worktrees', 'root-mixed': 'worktrees',
}
/** A finding that is no fault leaves a print; drift and strays a groove; a loss or a breach a gully. */
const DEPTH_OF: Readonly<Record<string, WearDepth>> = {
  'seat-claimed': 1, 'foreign-lane': 1,
  'seat-drift': 2, 'stray-branch': 2, 'worktree-outside-register': 2, 'occupied-by-landed': 2, 'root-mixed': 2,
  'seat-floor-breach': 3, 'checkout-missing': 3,
}
const KIND_WORD: Readonly<Record<string, string>> = {
  'seat-claimed': 'claimed', 'foreign-lane': 'foreign', 'seat-drift': 'drift', 'stray-branch': 'stray', 'worktree-outside-register': 'outside',
  'occupied-by-landed': 'landed', 'root-mixed': 'mixed', 'seat-floor-breach': 'disk', 'checkout-missing': 'missing',
}

/** The machine's checkouts as erosion: the Checkouts page's values (`co.` keys, scoped): its findings on each ring, a ring whose read
 * was refused or is missing left unsurveyed. */
export function checkoutErosionOf(v: V): ErosionReading | EnvironAbsent {
  const findings = rows(v, 'findings')
  const sources = rows(v, 'sources') ?? []
  if (!findings) {
    const refused = sources.find(s => typeof s.refusal === 'string' && s.refusal)
    return waiting(refused ? `Waits on the checkouts: ${refused.boundaryOp as string} refused (${refused.refusal as string}).` : 'Waits on the checkouts (seat status, git worktree list, git for-each-ref).')
  }
  const stretches = RINGS.map(ring => {
    const refusal = sources.find(s => typeof s.boundaryOp === 'string' && ring.op.test(s.boundaryOp) && typeof s.refusal === 'string' && s.refusal)
    const read = rows(v, ring.id) !== null
    const wear = new Map<string, Wear>()
    if (!refusal && read) for (const f of findings) {
      if (typeof f.kind !== 'string' || RING_OF[f.kind] !== ring.id) continue
      worn(wear, f.kind, KIND_WORD[f.kind] ?? f.kind, DEPTH_OF[f.kind] ?? 2, 1, typeof f.tenderId === 'string' && f.tenderId !== '')
    }
    return stretch(ring.id, ring.label, wear, refusal ? `${refusal.boundaryOp as string}: ${refusal.refusal as string}` : read ? null : `No reading of the ${ring.label}.`)
  })
  return {stretches, unread: []}
}

const TIER_LABEL = ['ground', 'experience', 'design', 'architecture', 'implementation', 'evidence'] as const
/** A meaning that does not hold: a groove where the code drifted from it, a gully where its implementation is missing. */
const MEANING: Readonly<Record<string, {depth: WearDepth; label: string}>> = {
  stale: {depth: 2, label: 'stale'}, 'wrong-relation': {depth: 2, label: 'wrong relation'}, duplicate: {depth: 2, label: 'twice'},
  'constitutive-flattening': {depth: 2, label: 'flattened'}, missing: {depth: 3, label: 'missing'},
}

/** The account as erosion: Docs' values (central__docs.tsx `sources`): each tier a stretch of ground, each change Central's horizon kept to
 * a source since its law last read it a print of passage, each meaning that does not hold a groove or a gully; a source that cannot be
 * read leaves its tier unsurveyed, and a tier no source holds stands bare. */
export function docsErosionOf(v: V): ErosionReading | EnvironAbsent {
  const sources = rows(v, 'sources')?.filter(s => typeof s.path === 'string')
  if (!sources) return waiting('Waits on the account (projectcentral.docs.inspect).')
  const stretches = TIER_LABEL.map((label, tier) => {
    const here = sources.filter(s => s.tier === tier), wear = new Map<string, Wear>()
    const refused = here.find(s => typeof s.refusal === 'string' && s.refusal)
    for (const s of here) {
      if (typeof s.refusal === 'string' && s.refusal) continue
      const moved = count(s.moved)
      if (moved) worn(wear, 'moved', 'moved', 1, moved)
      const m = typeof s.meaning === 'string' ? MEANING[s.meaning] : undefined
      if (m) worn(wear, s.meaning as string, m.label, m.depth)
    }
    const read = here.some(s => !(typeof s.refusal === 'string' && s.refusal) && (count(s.moved) !== null || typeof s.meaning === 'string'))
    const why = !here.length ? 'No source stands on this tier.' : refused ? `${refused.path as string}: ${refused.refusal as string}` : !read && !wear.size ? 'Nothing on this tier was read against the work.' : null
    return stretch(`tier-${tier}`, `${tier} ${label}`, wear, why, !here.length)
  })
  const unread = [['Meaning', text(v, 'refusal:meaning')], ['Moved since', text(v, 'refusal:moved')]].flatMap(([what, why]) => (why ? [`${what} is not read: ${why}`] : []))
  return {stretches, unread}
}
