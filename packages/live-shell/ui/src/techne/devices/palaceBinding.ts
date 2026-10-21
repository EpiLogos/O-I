// The Palace (manual §17.7, techne:palace) on its owner: the palace you stand in, as the palace session holds it
// (projections/atlas/palaces/palaceSession.ts — "One store the M5 Palace / Integral Whole plate and the atlas's floor plan both read,
// and every act on the palace, each through its owner"). Ported, not recreated: every reading is the session's, every write one of
// its acts — the rooms (roomsNow :187), the walk (walkOf :193, focusedRoom :201, moveWalk :325), the board (held positions,
// moveRooms :414, setSnap :435), the path and the guide (setPath :440, setGuide :444), the bookmarks (bookmarkHere :370), the Return
// (proposeReturn :579, acceptReturn :594, refuseReturn :587) and Leave (leavePalace :288). The design's sample is never a reading.
//
// The design's keys and their owners:
//   light       lit inside a palace, dark outside it; absent while entering
//   palace      the palace's title (PalaceRow.title)
//   rooms       roomsNow, in the owner's Scene order: {key, name, short, kind, members (four titles at most), more, holds}; a room the
//               owner calls a plain 'scene' has no kind the design names, so its kind stays absent
//   x<i>, y<i>  where the owner's floor stands room i (palacesModel.ts floorRooms: its held point, PalaceInside.held, else the board's
//               own default, board.ts boardPositions)
//   floor       'board': the owner's composition is a board (PalaceInside.held, PalaceFloor.tsx draws its board); no owner holds the
//               fixed floor of loci, so Floor stands disabled with that operation
//   lines       the owner's floor draws the path's line between the rooms' doors exactly while the path is guided (PalaceFloor.tsx,
//               techneWells.tsx usePalaceWell): a reading of the path, never set alone
//   path, guide, snap   the session's own (PalaceInside.path, guide, snap)
//   at          the room the walk stands in (focusedRoom), as its place in the rooms' order
//   bookmarks   the session's bookmarks, `name~roomkey;…`, each at the room its step stands in
//   route       the governed route the Return goes to: the proposal's receipt once proposed, else the first governed-write action the
//               palace's reading names ('' when it names none); absent while the reading has not come
//   proposal    none · routed · unrouted · accepted · refused, from the session's proposal and acceptance
//   gone        whether a region's one Expression is gone from the kernel's list (liveRefs); absent until the list is known
//   draft       the bookmark's name, held by the hand until Keep
//   order, audience     no owner operation: absent, and their controls stand disabled naming it
import type {DesignBinding, Value, ValueChange, Values} from '../../frame/devices/designed'
import {palaceReturnAction} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/return'
import {palaceBookmarkLabel} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/bookmarks'
import {defaultBoardPoint, type BoardPoint} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/board'
import {floorRooms, roomOfStep, type PalaceRoom} from '../../projections/atlas/palaces/palacesModel'
import {
  acceptReturn, bookmarkHere, focusedRoom, leavePalace, liveRefs, moveRooms, moveWalk, palaceState, proposeReturn, refuseReturn, roomsNow, setGuide, setPath,
  setSnap, walkOf, type PalaceInside, type PalaceState,
} from '../../projections/atlas/palaces/palaceSession'
import {PALACE_DESIGN, disabled, handsFor, missing, put, refusal} from './designDevices'

export const PALACE_ID = PALACE_DESIGN

/** The keys no owner operation takes: each stands disabled with the operation it waits for. */
export const PALACE_REFUSE = {
  order: missing('Order', 'a spatial walk order held by the palace (palaceSession walks the whole\'s own path only)', 'Technē palace'),
  floor: missing('Floor', 'the fixed floor of six rooms with four places (method of loci); the owner draws its free board only', 'Technē palace'),
  audience: missing('Audience', 'an audience view of the palace — who sees which room (no owner discloses how the field or the public sees it)', 'Technē palace'),
  lines: 'The floor draws the path\'s line exactly while the path is guided (PalaceFloor.tsx): set Path to show or hide it; no owner operation draws it alone.',
} as const

export const NOT_INSIDE = 'No palace is entered. Choose a palace in Palaces and press Enter, or select one on the World and choose Enter (manual §17.7).'
const ENTERING = 'The palace is being entered: its rooms stand when its owner answers.'
/** The keys that act on the palace you stand in: disabled with NOT_INSIDE outside it. */
const ACTS = ['path', 'guide', 'snap', 'at', 'keep', 'propose', 'accept', 'refuse', 'leave'] as const
export const PALACE_LOCAL = ['draft'] as const

/** The session's acts this binding writes through (palaceSession.ts), injectable for the tests. */
export interface PalaceActs {
  readonly setPath: typeof setPath
  readonly setGuide: typeof setGuide
  readonly setSnap: typeof setSnap
  readonly moveWalk: typeof moveWalk
  readonly moveRooms: typeof moveRooms
  readonly bookmarkHere: typeof bookmarkHere
  readonly proposeReturn: typeof proposeReturn
  readonly acceptReturn: typeof acceptReturn
  readonly refuseReturn: typeof refuseReturn
  readonly leavePalace: typeof leavePalace
  /** The session's status line after an act (the owner's own words for a refusal). */
  readonly line: () => string | null
}
export const SESSION_ACTS: PalaceActs = {setPath, setGuide, setSnap, moveWalk, moveRooms, bookmarkHere, proposeReturn, acceptReturn, refuseReturn, leavePalace,
  line: () => palaceState().line ?? null}

/** The design's kinds of room; the owner's 'scene' is none of them. */
const KINDS: ReadonlySet<string> = new Set(['overview', 'constellation', 'region'])
/** The design's bookmark list joins name and room with `~` and entries with `;`: a name keeps its words, those two marks aside. */
const plain = (text: string) => text.replace(/[;~]/g, '·')

/** One room as the design lists it. */
function roomOf(room: PalaceRoom): Record<string, unknown> {
  return {key: room.key, name: room.name, short: room.name, ...(KINDS.has(room.kind) ? {kind: room.kind} : {}),
    members: room.members.slice(0, 4).map(member => member.title), more: Math.max(0, room.members.length - 4), ...(room.holds ? {holds: room.holds.title} : {})}
}

/** The Return's state in the design's words. */
function proposalOf(here: PalaceInside): string {
  if (here.acceptance) return here.acceptance.accepted ? 'accepted' : 'refused'
  if (!here.proposal) return 'none'
  return here.proposal.receipt?.routed ? 'routed' : 'unrouted'
}

/** The Palace's values: the palace session's readings, and the hand's draft. Outside a palace, only the light. */
export function palaceValues(state: PalaceState, held: Readonly<Record<string, Value>> = {}): Values {
  const values: Record<string, Value> = {}
  for (const key of PALACE_LOCAL) put(values, key, held[key])
  if (state.phase === 'outside') { values.light = 'dark'; return values }
  if (state.phase === 'entering') { put(values, 'palace', state.palace.title); return values }
  const here = state
  values.light = 'lit'
  values.palace = here.palace.title
  const rooms = roomsNow(here)
  values.rooms = JSON.stringify(rooms.map(roomOf))
  floorRooms(rooms, here.held, null, []).forEach((room, i) => { put(values, `x${i}`, room.x); put(values, `y${i}`, room.y) })
  values.floor = 'board'
  values.path = here.path
  values.lines = here.path === 'guided'
  values.guide = here.guide
  values.snap = here.snap
  const focus = focusedRoom(here)
  const at = rooms.findIndex(room => room.key === focus)
  if (at >= 0) values.at = at
  values.bookmarks = here.bookmarks.flatMap(bookmark => {
    const room = roomOfStep(rooms, bookmark.ref)
    return room ? [`${plain(palaceBookmarkLabel(bookmark))}~${room}`] : []
  }).join(';')
  if (here.proposal?.receipt?.routed) values.route = here.proposal.receipt.action_ref
  else if (here.reading) values.route = palaceReturnAction(here.reading)?.action_ref ?? ''
  values.proposal = proposalOf(here)
  const live = liveRefs(here)
  if (live) values.gone = rooms.some(room => room.holds !== null && !live.has(room.holds.expression_ref))
  return values
}

/** The reading keys of the design this binding reports, and why each is absent when it is (manual §16.11: a reading that has not come
 * names what it waits for). The writable keys keep their own standing; their absence is said here. */
export const PALACE_READINGS = ['light', 'palace', 'rooms', 'floor', 'lines', 'path', 'guide', 'snap', 'at', 'bookmarks', 'route', 'proposal', 'gone'] as const
export function palaceAbsent(state: PalaceState, key: string): string {
  if (state.phase === 'outside') return NOT_INSIDE
  if (state.phase === 'entering') return ENTERING
  if (key in PALACE_REFUSE) return PALACE_REFUSE[key as keyof typeof PALACE_REFUSE]
  if (key === 'route') return state.reading === null ? `The palace's reading was refused, so no route is read from it: ${state.readingReason ?? 'the owner gave no reason'}.` : 'The palace\'s reading has not come yet: the Return\'s route is read from it.'
  if (key === 'gone') return 'The kernel\'s list of Expressions has not come yet: whether a region\'s door is gone is read against it.'
  if (key === 'at') return 'The walk stands on no room yet: the integral whole has not come, or holds no step in a room.'
  if (/^[xy]\d+$/.test(key)) return 'No room stands at that place in the palace\'s rooms.'
  return `${key}: the palace session reports no such reading.`
}

/** Refuse a write the session cannot take in its own words. */
const said = (acts: PalaceActs, fallback: string) => Error(acts.line() ?? fallback)

/** Send the design's changes through the session's acts, the board's two coordinates of a room together. */
export async function palaceWrite(state: PalaceState, changes: readonly ValueChange[], held: Readonly<Record<string, Value>>, acts: PalaceActs = SESSION_ACTS): Promise<void> {
  if (state.phase !== 'inside') { for (const {key} of changes) throw Error(key in PALACE_REFUSE ? PALACE_REFUSE[key as keyof typeof PALACE_REFUSE] : state.phase === 'entering' ? ENTERING : NOT_INSIDE); return }
  const here = state
  const rooms = roomsNow(here)
  const points: Record<string, BoardPoint> = {}
  for (const {key, value} of changes) {
    const board = /^([xy])(\d+)$/.exec(key)
    if (board) {
      const room = rooms[Number(board[2])]
      if (!room || typeof value !== 'number') throw Error(`${key}: no room stands at that place on the board.`)
      // The other coordinate: this gesture's, else the board's held point, else where the board stands the room by its own law.
      const now = points[room.key] ?? here.held[room.key] ?? defaultBoardPoint(Number(board[2]))
      points[room.key] = board[1] === 'x' ? {x: value, y: now.y} : {x: now.x, y: value}
      continue
    }
    switch (key) {
      case 'path': if (value !== 'guided' && value !== 'free') throw Error(`Path is guided or free, never ${String(value)}.`); acts.setPath(value); break
      case 'guide': acts.setGuide(value === true); break
      case 'snap': acts.setSnap(value === true); break
      case 'at': {
        const room = rooms[Number(value)]
        if (!room) throw Error('No room stands at that place on the walk.')
        const {steps} = walkOf(here)
        if (here.reading === undefined) throw Error('The walk waits for the palace\'s integral whole: its reading has not come yet.')
        const step = steps.findIndex(candidate => roomOfStep(rooms, candidate.ref) === room.key)
        if (step < 0) throw Error(`No step of the walk stands in ${room.name}: the integral whole holds none there.`)
        acts.moveWalk(step)
        break
      }
      case 'keep': {
        const name = String(held.draft ?? '').trim()
        if (!name) throw Error('Type a name first.')
        if (!acts.bookmarkHere(name)) throw said(acts, 'Not bookmarked: the walk stands on no step.')
        break
      }
      case 'propose':
        if (!here.reading) throw Error(here.readingReason ? `The palace has no reading to return: ${here.readingReason}` : 'The palace\'s reading has not come yet, so there is nothing to return.')
        acts.proposeReturn()
        break
      case 'accept': await acts.acceptReturn(); break
      case 'refuse': acts.refuseReturn(); break
      case 'leave': acts.leavePalace('Left the palace for the Earth.'); break
      default: throw refusal(PALACE_REFUSE, key)
    }
  }
  if (Object.keys(points).length) acts.moveRooms(points)
}

/** The Palace's binding on the palace session. */
export function palaceBinding(state: PalaceState, held: Readonly<Record<string, Value>> = {}, acts: PalaceActs = SESSION_ACTS): DesignBinding {
  const standing = disabled(PALACE_REFUSE)
  if (state.phase !== 'inside') for (const key of ACTS) standing[key] = {disabled: state.phase === 'entering' ? ENTERING : NOT_INSIDE}
  const values = palaceValues(state, held)
  // A reading that is not a control and has not come says why (a writable key keeps its own standing, so it can still be set).
  for (const key of PALACE_READINGS) if (!(key in values) && !(key in standing) && !(ACTS as readonly string[]).includes(key)) standing[key] = {disabled: palaceAbsent(state, key)}
  return {
    id: PALACE_ID,
    values,
    standing,
    ...(state.phase === 'entering' ? {waiting: true} : {}),
    local: handsFor(PALACE_ID, PALACE_LOCAL),
    writes: key => key in PALACE_REFUSE || (ACTS as readonly string[]).includes(key) || /^[xy]\d+$/.test(key),
    write: changes => palaceWrite(state, changes, held, acts),
  }
}
