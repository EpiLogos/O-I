// Palaces on the atlas, the readings (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4 "a palace is a place on the world you can enter";
// DLW manual §8 "The palace gives a whole subject a building to live in: rooms that each hold a part of it, a path through them, a
// guide who explains why each room is there … and doors out to other places and other people's worlds"; lock §8.2 "A Palace
// is a curated system over one corpus or project … its rooms are its curated sections; its path is its walks; its objects open at
// their revision and are owned by the corpus, never by the room; its portals lead to other palaces and places").
//
// Pure: owner readings in, rows out. No DOM, no React, no store, no transport.
//
// What a palace is here, read from the owners the candidate already runs:
//   - a palace is the native Expression of one Technē register — Central's root or one project's wiki, projected as one Expression
//     whose Scenes are the register's constellations and whose entities are its subjects (desktop/cradle/src/techne/wikiExpression.ts
//     WikiProjection, read through techne/wikiProjectionStore.ts, the store the subject door also reads). That is the curated system
//     of one corpus or project the lock names, and the Expressions the frame's Palace lens could read whole: its integral reading
//     (wikiReadingProvider.ts readWikiSceneTechne, scope "expression") answers only for an Expression bound to a Wiki register;
//   - its rooms are its Scenes, in the owner's Scene order, which is the guided path (the frame's law, composition.ts: "the guided path
//     is the Palace's own scene order"). A room is the register's overview, one of its constellations, a region a person composed by
//     hand (a Scene minted by composition.ts regionSceneRef, holding exactly one contained Expression — a door to another palace), or
//     another Scene of the Expression;
//   - a room holds the subjects its Scene's entities bind, verbatim; they open through their owners, never through the room;
//   - a palace stands on the world where its rooms' subjects are placed: a room is on the Earth at the places the suite reads for the
//     subjects it holds (provider/suiteStanding.ts SuitePlace, by `subject_ref`), and the palace's door is the first room on its path
//     that stands somewhere. A palace no room of which is placed is listed with that absence, never drawn at a made-up point.

import type {ExpressionDocument} from '../../../../../../../desktop/cradle/src/expression/types'
import type {RegisterStanding} from '../../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import type {WikiProjection, WikiRegister} from '../../../../../../../desktop/cradle/src/techne/wikiExpression'
import {regionSceneRef, type PalaceRegionSpec} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/composition'
import {palaceGuidedEdges} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/whole'
import {boardEdges, boardPositions, type BoardEdge, type BoardPositions} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/board'
import type {SuitePlace} from '../provider/suiteStanding'

// ── rooms ─────────────────────────────────────────────────────────────────

export type PalaceRoomKind = 'overview' | 'constellation' | 'region' | 'scene'

/** A subject a room holds: the entity that binds it in the Scene and the owner's subject ref, verbatim. */
export interface PalaceMember {
  readonly entity_ref: string
  readonly subject_ref: string
  readonly title: string
}

/** One room of a palace: a Scene of its Expression (or a region a draft composes, not saved yet). */
export interface PalaceRoom {
  /** the Scene ref (a draft region not yet saved: the ref its Save mints, composition.ts regionSceneRef) */
  readonly key: string
  readonly name: string
  readonly kind: PalaceRoomKind
  readonly members: readonly PalaceMember[]
  /** a hand-made region's one contained Expression, read from its Scene's own body; null while the region is empty or for any other room */
  readonly holds: {readonly expression_ref: string; readonly title: string} | null
  /** the owner's document carries this Scene */
  readonly saved: boolean
}

/** The Scene facts a room is read from (the kernel's ExpressionDocument, or the projection's). */
type RoomDocument = Pick<ExpressionDocument, 'expression_ref' | 'scenes' | 'entities'>

/** The region prefix composition.ts mints and discoverRegions reads back. */
const regionPrefix = (expressionRef: string) => `${expressionRef}:scene:region-`

/** A room's members: its Scene's entities that bind a subject, in the Scene's own order. */
function membersOf(doc: RoomDocument, entityRefs: readonly string[]): PalaceMember[] {
  return entityRefs.flatMap(ref => {
    const entity = doc.entities?.[ref]
    const subject = entity?.subject?.subject_ref
    return subject ? [{entity_ref: ref, subject_ref: subject, title: entity.title || subject}] : []
  })
}

/** The rooms of one palace document, in the owner's Scene order. `projection` names the register's overview and constellations. */
export function roomsOf(doc: RoomDocument, projection?: {readonly overviewSceneRef: string; readonly constellations: readonly {readonly sceneRef: string}[]} | null): PalaceRoom[] {
  const prefix = regionPrefix(doc.expression_ref)
  const constellations = new Set((projection?.constellations ?? []).map(row => row.sceneRef))
  return (doc.scenes ?? []).map(scene => {
    const region = scene.scene_ref.startsWith(prefix)
    const kind: PalaceRoomKind = region ? 'region' : scene.scene_ref === projection?.overviewSceneRef ? 'overview' : constellations.has(scene.scene_ref) ? 'constellation' : 'scene'
    const body = scene.body
    const holds = region && body?.carrier === 'expression_ref' && body.subject_ref ? {expression_ref: body.subject_ref, title: body.subject_ref} : null
    return {key: scene.scene_ref, name: scene.title || scene.scene_ref, kind, members: membersOf(doc, scene.entity_refs ?? []), holds, saved: true}
  })
}

/** The rooms a draft composes: every room that is not a region stays where the owner has it, then the draft's regions in the draft's
 * order — the order the Save's plan writes (composition.ts planRegions, its `desiredOrder`: the other Scenes in their relative order,
 * then the regions in the guided order). */
export function composedRooms(saved: readonly PalaceRoom[], expressionRef: string, regions: readonly PalaceRegionSpec[]): PalaceRoom[] {
  const savedKeys = new Set(saved.map(room => room.key))
  const drafted = regions.map((region): PalaceRoom => {
    const key = region.scene_ref ?? regionSceneRef(expressionRef, region.name)
    return {key, name: region.name, kind: 'region', members: [], saved: savedKeys.has(key),
      holds: region.member ? {expression_ref: region.member.expression_ref, title: region.member.title || region.member.expression_ref} : null}
  })
  return [...saved.filter(room => room.kind !== 'region'), ...drafted]
}

// ── the palaces the world holds ───────────────────────────────────────────

/** One palace of the world: a register's Expression, its rooms, and whether the kernel holds its document to enter. */
export interface PalaceRow {
  /** the register's key ("central" or the project's name) */
  readonly key: string
  readonly title: string
  readonly project: string | null
  readonly expression_ref: string | null
  readonly revision: number | null
  /** the kernel holds its Expression (the register's standing is ready or drifted); otherwise entering opens it first */
  readonly held: boolean
  /** where the register's reading stands, in plain words */
  readonly standing: string
  readonly rooms: readonly PalaceRoom[]
}

const STANDING_WORDS: Record<RegisterStanding['phase'], string> = {
  idle: 'not read yet', reading: 'being read', absent: 'this register has no wiki', unavailable: 'could not be read',
  projected: 'read; its Expression is not open in the kernel yet', opening: 'its Expression is opening', ready: 'open', drift: 'open, drifted from its wiki',
}

function projectionOf(standing: RegisterStanding | undefined): WikiProjection | undefined {
  return standing && 'projection' in standing ? standing.projection : undefined
}

/** The palaces of the world: one per Technē register, each with the rooms its Expression holds (the kernel's document where it stands,
 * else the projection the owner made). A register not read yet, or refused, is a row with its standing and no rooms. */
export function palaceRows(state: {readonly registers: readonly WikiRegister[]; readonly standings: Readonly<Record<string, RegisterStanding>>}): PalaceRow[] {
  return state.registers.map(register => {
    const standing = state.standings[register.key]
    const projection = projectionOf(standing)
    const document = standing && 'document' in standing ? standing.document : projection?.document
    const words = !standing ? STANDING_WORDS.idle : standing.phase === 'unavailable' ? `${STANDING_WORDS.unavailable}: ${standing.reason}` : standing.phase === 'drift' ? `${STANDING_WORDS.drift}: ${standing.reason}` : STANDING_WORDS[standing.phase]
    return {
      key: register.key, title: register.title, project: register.project ?? null,
      expression_ref: document?.expression_ref ?? null, revision: document && standing && 'document' in standing ? document.revision : null,
      held: !!standing && (standing.phase === 'ready' || standing.phase === 'drift'), standing: words,
      rooms: document ? roomsOf(document, projection) : [],
    }
  })
}

// ── where a palace stands ─────────────────────────────────────────────────

/** The places a room stands at: the located places the suite reads for the subjects it holds. */
export function roomPlaces(room: Pick<PalaceRoom, 'members'>, places: readonly SuitePlace[]): SuitePlace[] {
  const subjects = new Set(room.members.map(member => member.subject_ref))
  return places.filter(place => place.located && !!place.subject_ref && subjects.has(place.subject_ref))
}

/** The palace's door: the first room on its path that stands somewhere, at its first place. Null when no room is placed. */
export function palaceDoor(palace: Pick<PalaceRow, 'rooms'>, places: readonly SuitePlace[]): {room: PalaceRoom; place: SuitePlace} | null {
  for (const room of palace.rooms) {
    const place = roomPlaces(room, places)[0]
    if (place) return {room, place}
  }
  return null
}

/** The rooms of the world's palaces that hold one subject: the doors the Earth's selection stands at. */
export function palacesHolding(subjectRef: string | null, palaces: readonly PalaceRow[]): {palace: PalaceRow; room: PalaceRoom}[] {
  if (!subjectRef) return []
  return palaces.flatMap(palace => palace.rooms.filter(room => room.members.some(member => member.subject_ref === subjectRef)).map(room => ({palace, room})))
}

/** A palace as the M4 plate's Locations lists it under the kind `palace`: its name, its door, how many of its rooms stand on the Earth. */
export interface PalaceLocationRow {
  readonly key: string
  readonly name: string
  readonly door: {readonly room: string; readonly place: SuitePlace} | null
  readonly rooms: number
  readonly placed: number
  readonly line: string
}

export function palaceLocationRows(palaces: readonly PalaceRow[], places: readonly SuitePlace[]): PalaceLocationRow[] {
  return palaces.map(palace => {
    const door = palaceDoor(palace, places)
    const placed = palace.rooms.filter(room => roomPlaces(room, places).length > 0).length
    const rooms = palace.rooms.length
    const line = !rooms ? palace.standing
      : door ? `door at ${door.place.name} (${door.room.name}) · ${placed} of ${rooms} room${rooms === 1 ? '' : 's'} on the Earth`
        : `${rooms} room${rooms === 1 ? '' : 's'}, none placed on the Earth: no subject it holds declares a place`
    return {key: palace.key, name: palace.title, door: door ? {room: door.room.name, place: door.place} : null, rooms, placed, line}
  })
}

// ── the floor plan (the palace drawn inside, at the atlas's palace scale) ───

/** A room's size on the floor, in board units (the board's own stride is 300: a room leaves a corridor between its neighbours). */
export const ROOM_SIZE = {width: 220, height: 150} as const
const FLOOR_MARGIN = 60

/** One room on the floor: its place on the board (held, or its default in walk order) and the marks the walk and the selection give it. */
export interface FloorRoom {
  readonly room: PalaceRoom
  readonly x: number
  readonly y: number
  readonly focused: boolean
  readonly selected: boolean
}

/** The rooms on the floor, in path order, each at its held point (T15) or its default. Pure. */
export function floorRooms(rooms: readonly PalaceRoom[], held: BoardPositions, focusKey: string | null, selected: readonly string[]): FloorRoom[] {
  const points = boardPositions(rooms.map(room => room.key), held)
  const picked = new Set(selected)
  return rooms.map(room => ({room, x: points[room.key].x, y: points[room.key].y, focused: room.key === focusKey, selected: picked.has(room.key)}))
}

/** The path's segments between consecutive rooms (T16): a segment into a hand-made region carries the guided path's own honest kind
 * (whole.ts palaceGuidedEdges — gap, broken, self), every other segment is a plain path. Through boardEdges, never authored here. */
export function floorEdges(rooms: readonly PalaceRoom[], anchorRef: string, live: ReadonlySet<string> | null): BoardEdge[] {
  const guided = rooms.slice(1).map((room, index) => {
    const from = rooms[index]
    if (room.kind !== 'region') return {from: from.key, to: room.key, kind: 'path' as const, reason: `${room.name} stands on the guided path`}
    const [edge] = palaceGuidedEdges([{name: from.name, member_ref: from.key}, {name: room.name, member_ref: room.holds?.expression_ref ?? null, saved: room.saved}], anchorRef, live).edges
    return {from: from.key, to: room.key, kind: edge.kind, reason: edge.reason}
  })
  return boardEdges(guided, rooms.map(room => room.key))
}

/** The floor's extent: every room with a margin (the plan's viewBox before any zoom). */
export function floorBounds(rooms: readonly FloorRoom[]): {x: number; y: number; width: number; height: number} {
  if (!rooms.length) return {x: 0, y: 0, width: 800, height: 500}
  const left = Math.min(...rooms.map(room => room.x)) - FLOOR_MARGIN, top = Math.min(...rooms.map(room => room.y)) - FLOOR_MARGIN
  const right = Math.max(...rooms.map(room => room.x + ROOM_SIZE.width)) + FLOOR_MARGIN, bottom = Math.max(...rooms.map(room => room.y + ROOM_SIZE.height)) + FLOOR_MARGIN
  return {x: left, y: top, width: right - left, height: bottom - top}
}

/** The room a walk step stands in: a step whose ref is a room's own Scene (the reading's journey region), or a subject the room holds. */
export function roomOfStep(rooms: readonly PalaceRoom[], ref: string | null): string | null {
  if (!ref) return null
  return rooms.find(room => room.key === ref)?.key ?? rooms.find(room => room.members.some(member => member.subject_ref === ref))?.key ?? null
}
