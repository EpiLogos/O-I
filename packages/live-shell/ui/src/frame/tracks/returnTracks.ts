// Return tracks (manual §16.2, §19.23; Live's return tracks, shown and hidden by ⌥⌘R): in Factory each workcell of the machine's
// register stands as a return track, its chain the road in and out — Gateway, Remote carrier, Git / landing with its Seat — and
// every track an agent works on names it in its In/Out section as Works in. A return track's id is `workcell:<name>`, the
// register's own name for it (env-1). Pure.

import type {WorldTrack, WorldTrackSet} from '../../timeline/worldTrackAdapter'

export const WORKCELL_TRACK_PREFIX = 'workcell:'

/** The return track of a workcell, by the register's name for it. */
export const workcellTrackId = (name: string): string => `${WORKCELL_TRACK_PREFIX}${name}`

/** The workcell a track id names, or null for a track that is no workcell. */
export const workcellOfTrack = (id: string | null | undefined): string | null =>
  id && id.startsWith(WORKCELL_TRACK_PREFIX) && id.length > WORKCELL_TRACK_PREFIX.length ? id.slice(WORKCELL_TRACK_PREFIX.length) : null


type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

/** The register's workcells (`seat status --json`, central.workcell-status/v1 `workcells[]`): each name with its seats. Empty while the
 * register is unread or not the instrument's reading. Pure. */
export function registerWorkcells(status: unknown): {name: string; seats: {product: string; state: string; branch?: string}[]}[] {
  const doc = typeof status === 'string' ? (() => { try { return JSON.parse(status) as unknown } catch { return null } })() : status
  if (!isObj(doc) || !Array.isArray(doc.workcells)) return []
  return doc.workcells.flatMap(cell => {
    if (!isObj(cell) || !text(cell.name)) return []
    const seats = (Array.isArray(cell.seats) ? cell.seats : []).flatMap(seat => isObj(seat) && text(seat.product) && text(seat.state)
      ? [{product: String(seat.product), state: String(seat.state), ...(text(seat.live_branch) ? {branch: String(seat.live_branch)} : {})}] : [])
    return [{name: String(cell.name), seats}]
  })
}

/** The workcells as return tracks, in the register's order (§19.23 "The DLW makes no workcell. It shows the workcells your machines'
 * register holds"). They hold no clips and take none of the set's actions. Pure. */
export function workcellReturns(status: unknown): WorldTrack[] {
  return registerWorkcells(status).map(cell => ({id: workcellTrackId(cell.name), name: cell.name, kind: 'workcell', returns: true as const, readOnly: true}))
}

/** The workcell a track of `project` works in (§19.23 Works in: "A new track takes the workcell that holds its project's seat for the
 * lane you are on"): the one workcell whose seat for the project is held; null, with the reason, when none or several hold it and
 * nothing names the track's lane. Pure. */
export function worksInOf(status: unknown, project: string): {workcell: string} | {workcell: null; why: string} {
  const cells = registerWorkcells(status)
  if (!cells.length) return {workcell: null, why: 'The seat register has not answered (seat status --json).'}
  const product = project.toLowerCase()
  const holding = cells.flatMap(cell => cell.seats.filter(seat => seat.product.toLowerCase() === product && seat.state !== 'free').map(seat => ({cell: cell.name, branch: seat.branch})))
  if (holding.length === 1) return {workcell: holding[0]!.cell}
  if (!holding.length) return {workcell: null, why: `No workcell holds ${project}'s seat: every seat for it is free.`}
  return {workcell: null, why: `${holding.length} workcells hold ${project}'s seat (${holding.map(h => `${h.cell}${h.branch ? ` on ${h.branch}` : ''}`).join(', ')}); nothing names the lane this track's agents are on.`}
}

/** A set with its return tracks after its own. Pure. */
export function withReturns(set: WorldTrackSet, returns: readonly WorldTrack[]): WorldTrackSet {
  return returns.length ? {...set, tracks: [...set.tracks.filter(track => !track.returns), ...returns]} : set
}

/** Works in's choice: no owner keeps a track's workcell yet. */
export const WORKS_IN_CHOICE = 'Choosing another workcell: no owner operation carries it yet — missing op: a track\'s workcell held with its session\'s settings (AIKit encounter-session-settings).'

/** A set whose tracks an agent works on, each naming its workcell in its In/Out section (§16.6, §19.23 Works in): the one workcell holding
 * its project's seat (`projectOf`; null for a track with no project), else unread. Where every unread track is unread for one reason,
 * the control says it. Without the register's reading, every Works in is unread with `refused` (or that it has not answered). Pure. */
export function withWorksIn(set: WorldTrackSet, register: unknown, projectOf: (track: WorldTrack) => string | null, refused: string | null = null): WorldTrackSet {
  if (!set.mixer) return set
  const reasons = new Set<string>()
  const tracks = set.tracks.map(track => {
    if (track.readOnly || track.returns || track.main) return track
    const project = projectOf(track)
    if (!project) return track
    const works = register == null ? {workcell: null, why: refused ?? 'The seat register has not answered (seat status --json, read once).'} : worksInOf(register, project)
    if (works.workcell === null) { reasons.add(works.why); return track }
    return {...track, mix: {...track.mix, works: works.workcell}}
  })
  const why = reasons.size === 1 ? ` ${[...reasons][0]}` : ''
  return {...set, tracks, mixer: {...set.mixer, works: {meaning: 'the workcell its agents work in: its gateway, machine, seat and landing (§19.23)', disabled: `${WORKS_IN_CHOICE}${why}`}}}
}
