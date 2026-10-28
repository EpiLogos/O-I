// The palace drawn inside: the atlas's palace scale (T-PALACES-ONTO-ATLAS; lock §2.5, World / Places: "scales system · body · region · palace", §7.1
// "Sky = a scale of the globe … System · Body · Region · Palace scales"; the mockup's palace interior, world-shell-mockup.html:1222-1249
// palaceSVG — rooms, the guided path numbered through them, the objects each room holds, the portals out — and its View list
// "Palace — Inside Bollingen Tower", :1518).
//
// Archetypal-Earth holds no palace code of its own (Work/Archetypal-Earth at 4faf013 names none); its modes are the worked foundation
// (lock §8.2), and the frame's Palace lens was the palace's only face. So this is the frame's board (field-studies-journeys/src/
// palaceBoardView.tsx at fdc302870 — free arrangement, its connections from the guided path, the walk's focus, Open per card),
// drawn here as the floor plan the mockup draws instead of the Research Canvas's cards: the arrangement law and the edges are the
// owner seam's (m0m5/palace/board.ts, whole.ts), the drawing is the floor's. It is the pane's picture, the way the globe is: rooms you
// drag, objects you open, the floor you pan and zoom. No button and no setting stands here — the palace's controls are the M5 plate's
// and the transport's (owner, 14 Oct: "controls live in device UI, never as chrome inside a pane").
//
// Gestures, each the frame board's own (palaceBoardView.tsx:43-107): drag a room to place it (one gesture, one save — presence only);
// shift-drag the floor to select rooms with a marquee; drag the floor to pan, wheel to zoom (the viewport saved once settled);
// double-click a room to open it (a region opens its one contained Expression, any other room its own Scene); click an object to open
// it through its owner. Every room says why it is there in the Info view's hover (the guide's words, T18).
//
// O-I 761 (manual §17.7): a private room draws under cloud for the Field and Public audiences — its wall and a cloud, never its name,
// its objects or its door, and it does not open; to you it is clear. Method of loci draws the fixed floor instead of the board: six rooms
// of four places, three across and two down (palacesModel.ts lociFloor, composition.ts's bounded space), the palace's rooms laid in path
// order and their objects in their places; nothing on it is dragged, since the floor is fixed.

import {useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent} from 'react'
import {palaceWholeView, type PalaceStandingView} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/whole'
import {floorBounds, floorEdges, floorRooms, lociFloor, ROOM_SIZE, underCloud, type FloorRoom, type LociRoom, type PalaceRoom} from './palacesModel'
import {focusedRoom, liveRefs, moveRooms, openMember, openRoom, palaceState, roomsNow, selectRooms, setViewport, subscribePalace, type PalaceInside} from './palaceSession'

/** What each kind of room is, in the guide's words. */
export const ROOM_WORDS: Readonly<Record<PalaceRoom['kind'], string>> = {
  overview: 'The register\'s overview: the wholes of its constellations stand here.',
  constellation: 'A constellation of the register: one of its curated sections, holding the subjects it gathers.',
  region: 'A region composed by hand: it holds one Expression, a door to another palace.',
  scene: 'A Scene of the palace\'s Expression.',
}

/** The guide's words for a room: what kind of room it is, and the standing the owner's reading gives the rooms (T18). */
export function roomWhy(room: PalaceRoom, standing: PalaceStandingView | null): string {
  return [ROOM_WORDS[room.kind], standing ? `Its form: ${standing.line}.` : null, room.saved ? null : 'Not saved yet: the next Save writes it as a Scene.']
    .filter(Boolean).join(' ')
}

const MEMBER_ROWS = 4
const ZOOM = {min: 0.3, max: 3}

type Point = {x: number; y: number}
type Gesture =
  /** a room grabbed: where the pointer took it (board units), where the room stood then, where it stands now */
  | {kind: 'room'; key: string; grab: Point; start: Point; at: Point; moved: boolean; shift: boolean}
  /** the floor dragged: the pointer's client point at the grab, the pan then, the pan now */
  | {kind: 'pan'; grab: Point; start: Point; at: Point}
  | {kind: 'marquee'; from: Point; to: Point}

/** What a private room says to an audience it is clouded from. */
const CLOUDED = 'Private room|A private room. It stays under cloud for this audience.'

/** A cloud over a clouded room: its mark, drawn from tokens (palaces.css). */
function Cloud({x, y}: {x: number; y: number}) {
  return <g className="palace-cloud" transform={`translate(${x} ${y})`}>
    <circle cx={-26} cy={6} r={18} /><circle cx={0} cy={-6} r={24} /><circle cx={28} cy={6} r={18} /><rect x={-44} y={6} width={90} height={18} rx={9} />
  </g>
}

/** A room under cloud: its wall and a cloud, at its place; nothing of it is named, shown or opened. */
function CloudedRoom({room, x, y, onPointerDown}: {room: PalaceRoom; x: number; y: number; onPointerDown: (event: ReactPointerEvent<SVGGElement>, key: string) => void}) {
  return <g className="palace-room palace-room--clouded" data-room={room.key} data-kind={room.kind} data-clouded="true" data-i={CLOUDED}
    onPointerDown={event => onPointerDown(event, room.key)}>
    <rect className="palace-room__wall" x={x} y={y} width={ROOM_SIZE.width} height={ROOM_SIZE.height} />
    <text className="palace-room__name" x={x + 10} y={y + 20}>Private room</text>
    <Cloud x={x + ROOM_SIZE.width / 2} y={y + ROOM_SIZE.height / 2 + 6} />
  </g>
}

/** One room of the fixed floor (Method of loci): its four places, two by two, each with the object that stands in it. */
function LociRoomView({loci, clouded, why, onPointerDown}: {loci: LociRoom; clouded: boolean; why: string; onPointerDown: (event: ReactPointerEvent<SVGGElement>, key: string) => void}) {
  const {room, x, y} = loci
  if (room && clouded) return <g data-loci-room={loci.index}><CloudedRoom room={room} x={x} y={y} onPointerDown={onPointerDown} />{loci.places.map((_, place) => <g key={place} data-place={place} />)}</g>
  const pw = (ROOM_SIZE.width - 30) / 2, ph = (ROOM_SIZE.height - 44) / 2
  return <g className={room ? 'palace-room palace-room--loci' : 'palace-room palace-room--loci palace-room--empty'} data-loci-room={loci.index} data-room={room?.key}
    data-kind={room?.kind} data-focused={loci.focused ? 'true' : undefined} data-i={room ? `${room.name}|${why}` : `Room ${loci.index + 1}|A room of the fixed floor that no room of the palace stands in yet.`}
    onPointerDown={room ? event => onPointerDown(event, room.key) : undefined} onDoubleClick={room ? () => openRoom(room.key) : undefined}>
    <rect className="palace-room__wall" x={x} y={y} width={ROOM_SIZE.width} height={ROOM_SIZE.height} />
    <text className="palace-room__name" x={x + 10} y={y + 20}>{room ? (room.name.length > 30 ? `${room.name.slice(0, 29)}…` : room.name) : `Room ${loci.index + 1}`}</text>
    {loci.places.map((object, place) => {
      const px = x + 10 + (place % 2) * (pw + 10), py = y + 30 + Math.floor(place / 2) * (ph + 4)
      return <g key={place} className="palace-place" data-place={place} data-held={object ? 'true' : undefined}>
        <rect x={px} y={py} width={pw} height={ph} />
        <text x={px + 6} y={py + ph / 2 + 4}>{object ? (object.length > 14 ? `${object.slice(0, 13)}…` : object) : '—'}</text>
      </g>
    })}
  </g>
}

function Room({floor, why, onPointerDown}: {floor: FloorRoom; why: string; onPointerDown: (event: ReactPointerEvent<SVGGElement>, key: string) => void}) {
  const {room, x, y} = floor
  const shown = room.members.slice(0, MEMBER_ROWS)
  const more = room.members.length - shown.length
  return <g className="palace-room" data-room={room.key} data-kind={room.kind} data-focused={floor.focused ? 'true' : undefined} data-selected={floor.selected ? 'true' : undefined}
    data-saved={room.saved ? 'true' : 'false'} data-i={`${room.name}|${why}`} onPointerDown={event => onPointerDown(event, room.key)} onDoubleClick={() => openRoom(room.key)}>
    <rect className="palace-room__wall" x={x} y={y} width={ROOM_SIZE.width} height={ROOM_SIZE.height} />
    <text className="palace-room__name" x={x + 10} y={y + 20}>{room.name.length > 30 ? `${room.name.slice(0, 29)}…` : room.name}</text>
    {room.holds
      ? <g className="palace-object palace-object--portal" data-i={`Portal · ${room.holds.title}|A region's one contained Expression: a door out of the palace. Double-click the room to open it in the stage.`}>
          <text x={x + 10} y={y + 44}>→ {room.holds.title.length > 28 ? `${room.holds.title.slice(0, 27)}…` : room.holds.title}</text>
        </g>
      : room.kind === 'region' ? <text className="palace-room__empty" x={x + 10} y={y + 44}>no Expression yet</text> : null}
    {shown.map((member, index) => <g key={member.entity_ref} className="palace-object" data-i={`${member.title}|A subject this room holds, owned by its wiki — never by the room. Click to open it in the Scene that carries it.`}
      onPointerDown={event => event.stopPropagation()} onClick={() => openMember(member)}>
      <rect x={x + 10} y={y + 32 + index * 24} width={ROOM_SIZE.width - 20} height={19} />
      <text x={x + 18} y={y + 45 + index * 24}>{member.title.length > 30 ? `${member.title.slice(0, 29)}…` : member.title}</text>
    </g>)}
    {more > 0 && <text className="palace-room__more" x={x + 10} y={y + ROOM_SIZE.height - 8}>+{more} more</text>}
  </g>
}

/** The floor plan of the palace stood in. Nothing while outside. */
export function PalaceFloor() {
  const state = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  if (state.phase === 'entering') return <div className="atlas-palace" data-palace-phase="entering"><p className="atlas-palace__line" role="status">{state.line}</p></div>
  if (state.phase !== 'inside') return null
  return <Floor inside={state} />
}

function Floor({inside}: {inside: PalaceInside}) {
  const svg = useRef<SVGSVGElement>(null)
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const all = useMemo(() => roomsNow(inside), [inside.savedRooms, inside.regions, inside.doc])
  // free exploration draws no path and no walk focus: the rooms stand to be entered in any order (the plate's Path)
  const guided = inside.path === 'guided'
  const focus = guided ? focusedRoom(inside) : null
  // Method of loci: the fixed floor, six rooms of four places; the palace's rooms past the sixth stand on no place of it
  const loci = useMemo(() => (inside.arrangement === 'loci' ? lociFloor(all, focus) : null), [inside.arrangement, all, focus])
  const rooms = loci ? loci.rooms.flatMap(entry => (entry.room ? [entry.room] : [])) : all
  const clouded = (room: PalaceRoom) => underCloud(room, inside.audience)
  // a room being dragged stands where the pointer has it (a preview: nothing is held until the release); the fixed floor holds its own
  const held = gesture?.kind === 'room' && gesture.moved ? {...inside.held, [gesture.key]: gesture.at} : inside.held
  const floor = loci ? loci.rooms.flatMap(entry => (entry.room ? [{room: entry.room, x: entry.x, y: entry.y, focused: entry.focused, selected: inside.selected.includes(entry.room.key)}] : []))
    : floorRooms(rooms, held, focus, inside.selected)
  const edges = floorEdges(rooms, inside.doc.expression_ref, liveRefs(inside))
  const whole = useMemo(() => palaceWholeView(inside.reading ?? null), [inside.reading])
  // every room is a Scene of the palace: the reading stands them in its journey region, whose standing the guide says (T18)
  const standing = whole.regions.find(region => region.key === 'journey')?.standing ?? null
  const bounds = useMemo(() => floorBounds(loci ? loci.rooms : floorRooms(rooms, inside.held, null, [])), [loci, rooms, inside.held])
  const zoom = inside.viewport?.zoom ?? 1
  const pan: Point = gesture?.kind === 'pan' ? gesture.at : {x: inside.viewport?.x ?? 0, y: inside.viewport?.y ?? 0}
  const box = {x: bounds.x - pan.x, y: bounds.y - pan.y, width: bounds.width / zoom, height: bounds.height / zoom}
  // the path runs between the rooms' doors, each room's lower inner corner (the mockup's palaceSVG `cen`, :1228): it numbers the rooms
  // without crossing what they hold
  const door = (room: FloorRoom): Point => ({x: room.x + ROOM_SIZE.width - 14, y: room.y + ROOM_SIZE.height - 14})
  const at = new Map(floor.map(room => [room.room.key, room]))

  /** A client point on the floor, in board units. */
  const point = (clientX: number, clientY: number): Point => {
    const element = svg.current, matrix = element?.getScreenCTM?.()
    if (!element || !matrix) return {x: clientX, y: clientY}
    const p = element.createSVGPoint()
    p.x = clientX; p.y = clientY
    const local = p.matrixTransform(matrix.inverse())
    return {x: local.x, y: local.y}
  }
  const grabRoom = (event: ReactPointerEvent<SVGGElement>, key: string) => {
    event.stopPropagation()
    const room = at.get(key)
    if (!room) return
    // the fixed floor's rooms stand where the floor stands them: a press selects, nothing is dragged
    if (loci) { selectRooms(event.shiftKey ? toggle(inside.selected, key) : [key]); return }
    const start = {x: room.x, y: room.y}
    setGesture({kind: 'room', key, grab: point(event.clientX, event.clientY), start, at: start, moved: false, shift: event.shiftKey})
  }
  const grabFloor = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.shiftKey) { svg.current?.setPointerCapture?.(event.pointerId); const from = point(event.clientX, event.clientY); setGesture({kind: 'marquee', from, to: from}); return }
    setGesture({kind: 'pan', grab: {x: event.clientX, y: event.clientY}, start: pan, at: pan})
  }
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!gesture) return
    if (gesture.kind === 'room') {
      const now = point(event.clientX, event.clientY), dx = now.x - gesture.grab.x, dy = now.y - gesture.grab.y
      if (!gesture.moved && Math.hypot(dx, dy) < 4) return
      // the drag is a drag only once it moves: a press that never moves stays a click (and a double-click opens the room)
      if (!gesture.moved) svg.current?.setPointerCapture?.(event.pointerId)
      setGesture({...gesture, moved: true, at: {x: gesture.start.x + dx, y: gesture.start.y + dy}})
    } else if (gesture.kind === 'pan') {
      if (gesture.at === gesture.start) svg.current?.setPointerCapture?.(event.pointerId)
      // board units per screen pixel: the viewBox's width over the plan's own width (the plan meets the pane)
      const scale = box.width / Math.max(svg.current?.clientWidth || 1, 1)
      setGesture({...gesture, at: {x: gesture.start.x + (event.clientX - gesture.grab.x) * scale, y: gesture.start.y + (event.clientY - gesture.grab.y) * scale}})
    } else {
      setGesture({...gesture, to: point(event.clientX, event.clientY)})
    }
  }
  const release = () => {
    const done = gesture
    setGesture(null)
    if (!done) return
    if (done.kind === 'room') {
      if (done.moved) moveRooms({[done.key]: done.at})
      else selectRooms(done.shift ? toggle(inside.selected, done.key) : [done.key])
    } else if (done.kind === 'pan') {
      if (done.at.x !== done.start.x || done.at.y !== done.start.y) setViewport({x: done.at.x, y: done.at.y, zoom})
    } else {
      const left = Math.min(done.from.x, done.to.x), right = Math.max(done.from.x, done.to.x)
      const top = Math.min(done.from.y, done.to.y), bottom = Math.max(done.from.y, done.to.y)
      selectRooms(floor.filter(room => room.x < right && room.x + ROOM_SIZE.width > left && room.y < bottom && room.y + ROOM_SIZE.height > top).map(room => room.room.key))
    }
  }
  const wheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    const next = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)))
    if (next !== zoom) setViewport({x: pan.x, y: pan.y, zoom: next})
  }

  return <div className="atlas-palace" data-palace-phase="inside" data-palace={inside.palace.key} data-arrangement={inside.arrangement} data-audience={inside.audience}
    data-i={`${inside.palace.title}|Inside the palace: ${all.length} room${all.length === 1 ? '' : 's'} along its path${loci ? ', laid on the fixed floor of six rooms with four places in each' : ''}. ${loci ? 'Press a room to select it' : 'Drag a room to place it'}; shift-drag to select rooms; drag the floor to pan, wheel to zoom; double-click a room to open it. Escape returns to the Earth.`}>
    {all.length === 0 && !loci && <p className="atlas-palace__line" role="status">This palace holds no room yet.</p>}
    {loci && loci.beyond > 0 && <p className="atlas-palace__line" role="status">{`The fixed floor holds six rooms: ${loci.beyond} more of this palace stand${loci.beyond === 1 ? 's' : ''} on the board.`}</p>}
    <svg ref={svg} className="atlas-palace__plan" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid meet"
      onPointerDown={grabFloor} onPointerMove={move} onPointerUp={release} onPointerCancel={() => setGesture(null)} onWheel={wheel}
      role="img" aria-label={`${inside.palace.title}: the palace's rooms and its path`}>
      {guided && <g className="palace-path">
        {edges.map(edge => {
          const from = at.get(edge.source), to = at.get(edge.target)
          if (!from || !to) return null
          const a = door(from), b = door(to)
          // a path into or out of a clouded room names neither it nor what it holds
          const hidden = clouded(from.room) || clouded(to.room)
          return <g key={edge.id} data-edge={edge.kind} data-i={`Path|${hidden ? 'The guided path runs through a private room.' : edge.reason}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {edge.label && !hidden && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6}>{edge.label}</text>}
          </g>
        })}
      </g>}
      {loci ? loci.rooms.map(entry => <LociRoomView key={entry.index} loci={entry} clouded={!!entry.room && clouded(entry.room)} why={entry.room ? roomWhy(entry.room, standing) : ''} onPointerDown={grabRoom} />)
        : floor.map(room => clouded(room.room) ? <CloudedRoom key={room.room.key} room={room.room} x={room.x} y={room.y} onPointerDown={grabRoom} />
          : <Room key={room.room.key} floor={room} why={roomWhy(room.room, standing)} onPointerDown={grabRoom} />)}
      {guided && <g className="palace-steps">
        {floor.map((room, index) => <g key={room.room.key} data-focused={room.focused ? 'true' : undefined}>
          <circle cx={door(room).x} cy={door(room).y} r={9} />
          <text x={door(room).x} y={door(room).y + 3.5}>{index + 1}</text>
        </g>)}
      </g>}
      {gesture?.kind === 'marquee' && <rect className="palace-marquee" x={Math.min(gesture.from.x, gesture.to.x)} y={Math.min(gesture.from.y, gesture.to.y)}
        width={Math.abs(gesture.to.x - gesture.from.x)} height={Math.abs(gesture.to.y - gesture.from.y)} />}
    </svg>
  </div>
}

function toggle(selected: readonly string[], key: string): string[] {
  return selected.includes(key) ? selected.filter(entry => entry !== key) : [...selected, key]
}
