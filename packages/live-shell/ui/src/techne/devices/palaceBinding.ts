// The Palace (manual §17.7, techne:palace) on its owner: the palace you stand in, as the palace session holds it
// (projections/atlas/palaces/palaceSession.ts — "One store the M5 Palace / Integral Whole plate and the atlas's floor plan both read,
// and every act on the palace, each through its owner"). Ported, not recreated: every reading is the session's, every write one of
// its acts — the rooms (roomsNow :187), the walk (walkOf :193, focusedRoom :201, moveWalk :325, stepWalk :334), the board (held
// positions, moveRooms :414, setSnap :435), the path and the guide (setPath :440, setGuide :444), the bookmarks (bookmarkHere :370,
// renameBookmark :393, deleteBookmark :403), the composition (addTo :471, addAsNewRegion :480, addRegion :490, removeMember :497,
// moveRegion :503, removeRegion :514, revert :523, save :532), the Return (proposeReturn :579, refuseReturn :587, acceptReturn :594),
// the doors out (returnToGround :618, openEntry :645, openRoom :674), entering (enterPalace :241) and Leave (leavePalace :288). The
// design's sample is never a reading.
//
// The pages (O-I 757; the Palace plate's sections, PalacePlate.tsx, which the design now carries): Enter lists the world's palaces
// (palacesWorld.ts usePalaces, palacesModel.ts palaceLocationRows) and enters one; the Integral whole is the owner's whole of the
// reading (whole.ts palaceWholeView), each entry opened in its own instrument; Compose is the draft composition the one Save writes;
// Portals are the doors out — the Earth, each region's Expression, the places of the room the walk stands in. The world's palaces, the
// Earth's places and the turn to a place are the host's (the PalaceWorld it hands in); where it hands none, they stand absent saying so.
//
// The design's keys and their owners:
//   light       lit inside a palace, dark outside it; absent while entering
//   palace      the palace's title (PalaceRow.title)
//   rooms       roomsNow, in the owner's Scene order: {key, name, short, kind, members (four titles at most), more, holds}; kind is the
//               owner's own: overview, constellation, region or scene (palacesModel.ts PalaceRoomKind)
//   x<i>, y<i>  where the owner's floor stands room i (palacesModel.ts floorRooms: its held point, PalaceInside.held, else the board's
//               own default, board.ts boardPositions)
//   floor       'board': the owner's composition is a board (PalaceInside.held, PalaceFloor.tsx draws its board); no owner holds the
//               fixed floor of loci, so Floor stands disabled with that operation
//   lines       the owner's floor draws the path's line between the rooms' doors exactly while the path is guided (PalaceFloor.tsx,
//               techneWells.tsx usePalaceWell): a reading of the path, never set alone
//   path, guide, snap   the session's own (PalaceInside.path, guide, snap)
//   at          the room the walk stands in (focusedRoom), as its place in the rooms' order
//   locus, loci, office   the walk locus by locus (walkOf): the step it stands on, how many steps the whole holds, that step's office
//   warrant     the guide's words for where the walk stands: the line of the whole's region its step belongs to (whole.ts palaceStanding,
//               PalacePlate.tsx's guide line)
//   rests       what every room rests on: the standing of the whole's journey region, where the reading stands the rooms (PalaceFloor.tsx
//               "every room is a Scene of the palace: the reading stands them in its journey region"): warranted · owner · free
//   bookmarks   the session's bookmarks, `name~roomkey;…`, each at the room its step stands in
//   route       the governed route the Return goes to: the proposal's receipt once proposed, else the first governed-write action the
//               palace's reading names ('' when it names none); absent while the reading has not come
//   proposal    none · routed · unrouted · accepted · refused, from the session's proposal and acceptance
//   gone        whether a region's one Expression is gone from the kernel's list (liveRefs); absent until the list is known
//   palaces     the world's palaces [{key, name, rooms, line, door, here?}] (the host's PalaceWorld; palaceLocationRows)
//   whole       the integral whole [{key, name, standing, line, here?, entries: [{id, ref, label, note?, refused?, here?}]}]
//   regions     the draft's regions in path order [{name, holds?, ref?}]; removed: how many are staged for removal on Save
//   eligible    the kernel's Expressions a region may hold [{ref, title, revision, composed}]; absent until the list is known
//   revision, basedOn, busy   the owner's revision, the revision the draft began at (Save is gated on it), whether a Save runs
//   portals     the doors out [{id, name, kind (ground · leave · expression · place), note?}]; places: how many places the room has
//   draft, chosen, regionName, wholeRegion, regionPick   held by the hand: the bookmark's name, the palace chosen on Enter, a new
//               region's name, the region shown on the Integral whole, the region picked on Compose
//   order, audience     no owner operation: absent, and their controls stand disabled naming it
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import {palaceReturnAction, returnGroundInstrument} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/return'
import {palaceBookmarkLabel} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/bookmarks'
import {defaultBoardPoint, type BoardPoint} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/board'
import {PALACE_WIRED_INSTRUMENTS, palaceOpenRoute, palaceRegionName, palaceWholeView} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/whole'
import type {PalaceBookmark} from '../../../../../../desktop/cradle/src/techne/m0m5/palace/palace-state'
import type {SuitePlace} from '../../projections/atlas/provider/suiteStanding'
import {floorRooms, palaceLocationRows, roomOfStep, roomPlaces, type PalaceRoom, type PalaceRow} from '../../projections/atlas/palaces/palacesModel'
import {palacesWaiting, type PalacesLoad} from '../../projections/atlas/palaces/palacesWorld'
import {
  acceptReturn, addAsNewRegion, addRegion, addTo, bookmarkHere, deleteBookmark, enterPalace, focusedRoom, leavePalace, liveRefs, moveRegion, moveRooms,
  moveWalk, openEntry, openRoom, palaceState, proposeReturn, refuseReturn, removeMember, removeRegion, renameBookmark, returnToGround, revert, roomsNow, save,
  setGuide, setPath, setSnap, stepWalk, walkOf, type PalaceInside, type PalaceState,
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

export const NOT_INSIDE = 'No palace is entered. Choose a palace on the Enter page and press Enter, or select one on the World and choose Enter (manual §17.7).'
const ENTERING = 'The palace is being entered: its rooms stand when its owner answers.'
/** Where the host hands the Palace no world: the palaces to enter, the Earth's places and the turn to them are the host's. */
export const NO_WORLD = 'The world\'s palaces and the Earth\'s places are not handed to the Palace here (the host hands them from palacesWorld.ts usePalaces and the suite standing).'
/** The keys that act on the palace you stand in: disabled with NOT_INSIDE outside it. */
const ACTS = ['path', 'guide', 'snap', 'at', 'keep', 'propose', 'accept', 'refuse', 'leave',
  'step', 'rename', 'delete', 'open', 'region', 'add', 'earlier', 'later', 'empty', 'remove', 'save', 'revert', 'portal'] as const
/** The acts that stand anywhere: entering a palace, and turning the Earth to its door. */
const WORLD_ACTS = ['enter', 'door'] as const
/** The composition's acts: they wait while a Save runs. */
const COMPOSE_ACTS = ['region', 'add', 'earlier', 'later', 'empty', 'remove', 'save', 'revert'] as const
export const PALACE_LOCAL = ['draft', 'chosen', 'regionName', 'wholeRegion', 'regionPick'] as const

/** The world as the host reads it: the palaces of the world (palacesWorld.ts usePalaces), the Earth's places (the suite standing), and
 * the turn of the Earth to a place (places/placesHost.ts turnAtlasTo on the mounted atlas; absent while no atlas is mounted). */
export interface PalaceWorld {
  readonly rows: readonly PalaceRow[]
  readonly load: PalacesLoad
  readonly places: readonly SuitePlace[]
  readonly turn?: (place: SuitePlace) => void
}

/** The session's acts this binding writes through (palaceSession.ts), injectable for the tests. */
export interface PalaceActs {
  readonly setPath: typeof setPath
  readonly setGuide: typeof setGuide
  readonly setSnap: typeof setSnap
  readonly moveWalk: typeof moveWalk
  readonly stepWalk: typeof stepWalk
  readonly moveRooms: typeof moveRooms
  readonly bookmarkHere: typeof bookmarkHere
  readonly renameBookmark: typeof renameBookmark
  readonly deleteBookmark: typeof deleteBookmark
  readonly proposeReturn: typeof proposeReturn
  readonly acceptReturn: typeof acceptReturn
  readonly refuseReturn: typeof refuseReturn
  readonly leavePalace: typeof leavePalace
  readonly enterPalace: typeof enterPalace
  readonly openEntry: typeof openEntry
  readonly openRoom: typeof openRoom
  readonly returnToGround: typeof returnToGround
  readonly addRegion: typeof addRegion
  readonly addTo: typeof addTo
  readonly addAsNewRegion: typeof addAsNewRegion
  readonly moveRegion: typeof moveRegion
  readonly removeMember: typeof removeMember
  readonly removeRegion: typeof removeRegion
  readonly save: typeof save
  readonly revert: typeof revert
  /** The session's status line after an act (the owner's own words for a refusal). */
  readonly line: () => string | null
}
export const SESSION_ACTS: PalaceActs = {setPath, setGuide, setSnap, moveWalk, stepWalk, moveRooms, bookmarkHere, renameBookmark, deleteBookmark, proposeReturn,
  acceptReturn, refuseReturn, leavePalace, enterPalace, openEntry, openRoom, returnToGround, addRegion, addTo, addAsNewRegion, moveRegion, removeMember,
  removeRegion, save, revert, line: () => palaceState().line ?? null}

/** The design's bookmark list joins name and room with `~` and entries with `;`: a name keeps its words, those two marks aside. */
const plain = (text: string) => text.replace(/[;~]/g, '·')

/** One room as the design lists it, in the owner's kind. */
function roomOf(room: PalaceRoom): Record<string, unknown> {
  return {key: room.key, name: room.name, short: room.name, kind: room.kind,
    members: room.members.slice(0, 4).map(member => member.title), more: Math.max(0, room.members.length - 4), ...(room.holds ? {holds: room.holds.title} : {})}
}

/** The Return's state in the design's words. */
function proposalOf(here: PalaceInside): string {
  if (here.acceptance) return here.acceptance.accepted ? 'accepted' : 'refused'
  if (!here.proposal) return 'none'
  return here.proposal.receipt?.routed ? 'routed' : 'unrouted'
}

/** The bookmarks that stand in a room, in the session's order, each with its room. */
function marksOf(here: PalaceInside, rooms: readonly PalaceRoom[]): {bookmark: PalaceBookmark; room: string}[] {
  return here.bookmarks.flatMap(bookmark => { const room = roomOfStep(rooms, bookmark.ref); return room ? [{bookmark, room}] : [] })
}

/** The bookmark of the room the walk stands in: the first the session keeps there, as the design shows it (techne__palace.tsx markHere). */
function markHere(here: PalaceInside, rooms: readonly PalaceRoom[]): PalaceBookmark | null {
  const focus = focusedRoom(here)
  return focus === null ? null : marksOf(here, rooms).find(mark => mark.room === focus)?.bookmark ?? null
}

/** The integral whole's regions as the Integral whole page lists them; each entry keyed `region:index`. */
function wholeOf(here: PalaceInside) {
  const view = palaceWholeView(here.reading ?? null)
  const focus = walkOf(here).focus
  return view.regions.map(region => ({
    key: region.key, name: palaceRegionName(region), standing: region.standing.standing, line: region.standing.line,
    ...(focus?.region === region.key ? {here: true} : {}),
    entries: region.entries.map((entry, index) => {
      const route = palaceOpenRoute(entry, PALACE_WIRED_INSTRUMENTS)
      return {id: `${region.key}:${index}`, ref: entry.ref, label: entry.label, ...(entry.note ? {note: entry.note} : {}), ...(route.kind === 'refused' ? {refused: route.reason} : {}),
        ...(focus?.region === region.key && focus.ref === entry.ref ? {here: true} : {})}
    }),
  }))
}

/** The doors out of the palace: the Earth first (the ground where the reading discloses it, else plain leaving), each region's one
 * Expression, then the places of the room the walk stands in (PalacePlate.tsx PortalsSection). */
function portalsOf(here: PalaceInside, rooms: readonly PalaceRoom[], world: PalaceWorld | undefined) {
  const ground = !!here.reading && returnGroundInstrument(here.reading) !== null
  const focus = rooms.find(room => room.key === focusedRoom(here))
  const places = focus && world ? roomPlaces(focus, world.places) : []
  return {ground, places, rows: [
    {id: 'ground', name: 'the Earth', kind: ground ? 'ground' : 'leave', note: ground ? 'Return to the ground: the Earth.' : 'The reading does not disclose the ground: leave the palace for the Earth.'},
    ...rooms.filter(room => room.kind === 'region' && room.holds).map(room => ({id: `room:${room.key}`, name: room.holds!.title, kind: 'expression', note: `${room.name}: its one contained Expression.`})),
    ...places.map(place => ({id: `place:${place.ref}`, name: place.name, kind: 'place', note: `${focus!.name} stands at ${place.name} on the Earth.`})),
  ]}
}

/** The world's palaces as the Enter page lists them, the one you stand in marked. */
function palacesOf(world: PalaceWorld, state: PalaceState): string | undefined {
  const rows = palaceLocationRows(world.rows, world.places)
  if (!rows.length && world.load.phase !== 'read') return undefined
  const here = state.phase === 'outside' ? null : state.palace.key
  return JSON.stringify(rows.map(row => ({key: row.key, name: row.name, rooms: row.rooms, line: row.line, door: row.door !== null, ...(row.key === here ? {here: true} : {})})))
}

/** The Palace's values: the palace session's readings, the host's world, and the hand's holds. Outside a palace, the light and the world. */
export function palaceValues(state: PalaceState, held: Readonly<Record<string, Value>> = {}, world?: PalaceWorld): Values {
  const values: Record<string, Value> = {}
  for (const key of PALACE_LOCAL) put(values, key, held[key])
  if (world) put(values, 'palaces', palacesOf(world, state))
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
  // The walk locus by locus, and the guide's words for the locus it stands on.
  const walk = walkOf(here)
  if (here.reading) {
    values.loci = walk.steps.length
    if (walk.focus) { values.locus = walk.index; values.office = walk.focus.office }
  }
  const view = palaceWholeView(here.reading ?? null)
  if (view.available) {
    values.whole = JSON.stringify(wholeOf(here))
    put(values, 'warrant', walk.focus ? view.regions.find(region => region.key === walk.focus!.region)?.standing.line : undefined)
    put(values, 'rests', view.regions.find(region => region.key === 'journey')?.standing.standing)
  }
  values.bookmarks = marksOf(here, rooms).map(({bookmark, room}) => `${plain(palaceBookmarkLabel(bookmark))}~${room}`).join(';')
  if (here.proposal?.receipt?.routed) values.route = here.proposal.receipt.action_ref
  else if (here.reading) values.route = palaceReturnAction(here.reading)?.action_ref ?? ''
  values.proposal = proposalOf(here)
  const live = liveRefs(here)
  if (live) values.gone = rooms.some(room => room.holds !== null && !live.has(room.holds.expression_ref))
  // Compose: the draft and what the kernel lists for it.
  values.regions = JSON.stringify(here.regions.map(region => ({name: region.name, ...(region.member ? {holds: region.member.title || region.member.expression_ref, ref: region.member.expression_ref} : {})})))
  values.removed = here.removed.length
  if (here.eligibleKnown) {
    const contained = new Set(here.regions.flatMap(region => (region.member ? [region.member.expression_ref] : [])))
    values.eligible = JSON.stringify(here.eligible.map(entry => ({ref: entry.expression_ref, title: entry.title, revision: entry.revision, composed: contained.has(entry.expression_ref)})))
  }
  values.revision = here.doc.revision
  values.basedOn = here.draftDoc.revision
  values.busy = here.busy
  // Portals.
  const portals = portalsOf(here, rooms, world)
  values.portals = JSON.stringify(portals.rows)
  if (world) values.places = portals.places.length
  return values
}

/** The reading keys of the design this binding reports, and why each is absent when it is (manual §16.11: a reading that has not come
 * names what it waits for). The writable keys keep their own standing; their absence is said here. */
export const PALACE_READINGS = ['light', 'palace', 'rooms', 'floor', 'lines', 'path', 'guide', 'snap', 'at', 'bookmarks', 'route', 'proposal', 'gone',
  'locus', 'loci', 'office', 'warrant', 'rests', 'whole', 'regions', 'removed', 'eligible', 'revision', 'basedOn', 'busy', 'portals'] as const
export function palaceAbsent(state: PalaceState, key: string): string {
  if (state.phase === 'outside') return NOT_INSIDE
  if (state.phase === 'entering') return ENTERING
  if (key in PALACE_REFUSE) return PALACE_REFUSE[key as keyof typeof PALACE_REFUSE]
  const waits = 'The palace\'s integral whole has not come yet: the walk and the guide are read from it.'
  const refused = `The palace's integral whole was refused: ${state.readingReason ?? 'the owner gave no reason'}.`
  if (key === 'route') return state.reading === null ? `The palace's reading was refused, so no route is read from it: ${state.readingReason ?? 'the owner gave no reason'}.` : 'The palace\'s reading has not come yet: the Return\'s route is read from it.'
  if (key === 'gone') return 'The kernel\'s list of Expressions has not come yet: whether a region\'s door is gone is read against it.'
  if (key === 'at') return 'The walk stands on no room yet: the integral whole has not come, or holds no step in a room.'
  if (key === 'eligible') return 'The kernel\'s list of Expressions has not come yet: a region holds one of them.'
  if (['locus', 'loci', 'office', 'warrant', 'rests', 'whole'].includes(key) && state.reading === undefined) return waits
  if (['locus', 'loci', 'office', 'warrant', 'rests', 'whole'].includes(key) && state.reading === null) return refused
  if (key === 'whole') return `The integral whole is unavailable: ${palaceWholeView(state.reading ?? null).reason ?? 'the reading discloses no facet the whole can compose'}.`
  if (key === 'locus' || key === 'office') return 'Nothing stands in the integral whole, so the walk stands on no locus.'
  if (key === 'warrant') return 'The walk stands on no locus, so the guide has nothing to say of it.'
  if (key === 'rests') return 'The integral whole names no journey region, so no reading says what the rooms rest on.'
  if (/^[xy]\d+$/.test(key)) return 'No room stands at that place in the palace\'s rooms.'
  return `${key}: the palace session reports no such reading.`
}

/** Refuse a write the session cannot take in its own words. */
const said = (acts: PalaceActs, fallback: string) => Error(acts.line() ?? fallback)

/** The palace an Enter or Door write names: its key, or the hand's choice. */
function palaceNamed(world: PalaceWorld | undefined, value: Value, held: Readonly<Record<string, Value>>): PalaceRow {
  if (!world) throw Error(NO_WORLD)
  const key = typeof value === 'string' ? value : held.chosen
  if (typeof key !== 'string' || !key) throw Error('Choose a palace on the Enter page first.')
  const row = world.rows.find(candidate => candidate.key === key)
  if (!row) throw Error(`${key} is not among your world's palaces.`)
  return row
}

/** Send the design's changes through the session's acts, the board's two coordinates of a room together. */
export async function palaceWrite(state: PalaceState, changes: readonly ValueChange[], held: Readonly<Record<string, Value>>, acts: PalaceActs = SESSION_ACTS, world?: PalaceWorld): Promise<void> {
  const inner: ValueChange[] = []
  for (const change of changes) {
    if (change.key === 'enter') { void acts.enterPalace(palaceNamed(world, change.value, held)); continue }
    if (change.key === 'door') {
      const row = palaceNamed(world, change.value, held)
      const door = palaceLocationRows([row], world!.places)[0]?.door
      if (!door) throw Error(`No room of ${row.title} stands on the Earth: no subject it holds declares a place, so it has no door to turn to.`)
      if (!world!.turn) throw Error('The Earth is not open here, so it cannot be turned to the door.')
      world!.turn(door.place)
      continue
    }
    inner.push(change)
  }
  if (!inner.length) return
  if (state.phase !== 'inside') { for (const {key} of inner) throw Error(key in PALACE_REFUSE ? PALACE_REFUSE[key as keyof typeof PALACE_REFUSE] : state.phase === 'entering' ? ENTERING : NOT_INSIDE); return }
  const here = state
  const rooms = roomsNow(here)
  const points: Record<string, BoardPoint> = {}
  const region = (value: Value) => {
    const index = here.regions.findIndex(candidate => candidate.name === value)
    if (index < 0) throw Error(`${String(value)} is not a region of this palace's draft.`)
    return index
  }
  const bookmarked = (value: Value) => {
    const bookmark = markHere(here, rooms)
    if (!bookmark) throw Error('No bookmark stands in the room the walk stands in.')
    if (typeof value === 'string' && plain(palaceBookmarkLabel(bookmark)) !== value) throw Error('The bookmark moved since you chose it: choose it again.')
    return bookmark
  }
  for (const {key, value} of inner) {
    const board = /^([xy])(\d+)$/.exec(key)
    if (board) {
      const room = rooms[Number(board[2])]
      if (!room || typeof value !== 'number') throw Error(`${key}: no room stands at that place on the board.`)
      // The other coordinate: this gesture's, else the board's held point, else where the board stands the room by its own law.
      const now = points[room.key] ?? here.held[room.key] ?? defaultBoardPoint(Number(board[2]))
      points[room.key] = board[1] === 'x' ? {x: value, y: now.y} : {x: now.x, y: value}
      continue
    }
    if ((COMPOSE_ACTS as readonly string[]).includes(key) && here.busy) throw Error('The composition is being saved: wait for its answer.')
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
      case 'step': {
        if (value !== 1 && value !== -1) throw Error('The walk steps one locus at a time, forward or back.')
        if (!walkOf(here).steps.length) throw Error(here.reading === undefined ? 'The walk waits for the palace\'s integral whole: its reading has not come yet.' : 'Nothing stands in the integral whole, so the walk has no locus to step to.')
        acts.stepWalk(value)
        break
      }
      case 'keep': {
        const name = String(held.draft ?? '').trim()
        if (!name) throw Error('Type a name first.')
        if (!acts.bookmarkHere(name)) throw said(acts, 'Not bookmarked: the walk stands on no step.')
        break
      }
      case 'rename': {
        const bookmark = bookmarked(value)
        const name = String(held.draft ?? '').trim()
        if (!name) throw Error('Type the new name in Name first.')
        if (!acts.renameBookmark(bookmark.ref, name)) throw said(acts, 'Not renamed.')
        break
      }
      case 'delete': acts.deleteBookmark(bookmarked(value)); break
      case 'open': {
        const [regionKey, index] = String(value).split(':')
        const entry = palaceWholeView(here.reading ?? null).regions.find(candidate => candidate.key === regionKey)?.entries[Number(index)]
        if (!entry) throw Error('That entry is not in the integral whole the palace stands at.')
        acts.openEntry(entry)
        break
      }
      case 'region': {
        const name = String(held.regionName ?? '').trim()
        if (!name) throw Error('Name the region first.')
        if (!acts.addRegion(name)) throw Error(`A region named ${name} stands in the draft already.`)
        break
      }
      case 'add': {
        const entry = here.eligible.find(candidate => candidate.expression_ref === value)
        if (!entry) throw Error(`${String(value)} is not among the kernel's Expressions a region may hold.`)
        const open = here.regions.find(candidate => !candidate.member)
        if (open) acts.addTo(open.name, entry.expression_ref, entry.title)
        else acts.addAsNewRegion(entry.expression_ref, entry.title)
        break
      }
      case 'earlier': case 'later': {
        const index = region(value), by = key === 'earlier' ? -1 : 1
        if (index + by < 0) throw Error(`${String(value)} stands first on the path already.`)
        if (index + by >= here.regions.length) throw Error(`${String(value)} stands last on the path already.`)
        acts.moveRegion(String(value), by)
        break
      }
      case 'empty': region(value); acts.removeMember(String(value)); break
      case 'remove': region(value); acts.removeRegion(String(value)); break
      case 'save':
        if (here.doc.revision > here.draftDoc.revision) throw Error(`This draft began at revision ${here.draftDoc.revision}; the owner discloses ${here.doc.revision}. Revert first: the owner moved on.`)
        await acts.save()
        break
      case 'revert': acts.revert(); break
      case 'portal': {
        const id = String(value)
        const portals = portalsOf(here, rooms, world)
        if (id === 'ground') { if (portals.ground) acts.returnToGround(); else acts.leavePalace('Left the palace for the Earth.'); break }
        if (id.startsWith('room:') && portals.rows.some(row => row.id === id)) { acts.openRoom(id.slice('room:'.length)); break }
        const place = portals.places.find(candidate => `place:${candidate.ref}` === id)
        if (!place) throw Error(`${id} is no door out of the room the walk stands in.`)
        acts.leavePalace(`Left for ${place.name}.`)
        world?.turn?.(place)
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

/** The Palace's binding on the palace session, with the host's world where it hands one. */
export function palaceBinding(state: PalaceState, held: Readonly<Record<string, Value>> = {}, acts: PalaceActs = SESSION_ACTS, world?: PalaceWorld): DesignBinding {
  const standing: Record<string, Standing> = disabled(PALACE_REFUSE)
  if (state.phase !== 'inside') for (const key of ACTS) standing[key] = {disabled: state.phase === 'entering' ? ENTERING : NOT_INSIDE}
  else if (state.busy) for (const key of COMPOSE_ACTS) standing[key] = {disabled: 'The composition is being saved: wait for its answer.'}
  const values = palaceValues(state, held, world)
  // The world's acts and readings: the host's, or why they are not here.
  if (!world) for (const key of [...WORLD_ACTS, 'palaces', 'places']) standing[key] = {disabled: NO_WORLD}
  else {
    if (!('palaces' in values)) standing.palaces = {disabled: palacesWaiting(world.load, 0) ?? NO_WORLD}
    if (!world.turn) standing.door = {disabled: 'The Earth is not open here, so it cannot be turned to a palace\'s door.'}
    if (!('places' in values)) standing.places = {disabled: state.phase === 'entering' ? ENTERING : NOT_INSIDE}
  }
  // A reading that is not a control and has not come says why (a writable key keeps its own standing, so it can still be set).
  for (const key of PALACE_READINGS) if (!(key in values) && !(key in standing) && !(ACTS as readonly string[]).includes(key)) standing[key] = {disabled: palaceAbsent(state, key)}
  return {
    id: PALACE_ID,
    values,
    standing,
    ...(state.phase === 'entering' ? {waiting: true} : {}),
    local: handsFor(PALACE_ID, PALACE_LOCAL),
    writes: key => key in PALACE_REFUSE || (ACTS as readonly string[]).includes(key) || (WORLD_ACTS as readonly string[]).includes(key) || /^[xy]\d+$/.test(key),
    write: changes => palaceWrite(state, changes, held, acts, world),
  }
}
