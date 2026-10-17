// The Palace (manual §17.7): a place on the World that you enter. Its rooms each hold a part of one register's wiki, a path leads
// through them, and a guide says why each room stands where it does. Live's nearest: a device with a map in its well (Hybrid Reverb)
// and sections ruled off beside it. The picture is the owner's own floor (projections/atlas/palaces/PalaceFloor.tsx): rooms of
// 220 × 150 board units at the board's own default points (palacesModel / board.ts defaultBoardPoint: three to a row, a 300 stride),
// the path between the rooms' doors, the room the walk stands in, objects in each room (four at most, as the owner shows them) and a
// region's one Expression as a door. The controls front palaceSession.ts: Path (:440), Guide (:444), Snap (:435), the walk (:325,
// :340, :334), bookmarks (:370, :382), the Return (:579, :594, :587) and Leave (:288). Floor, Order, Lines and Audience have no owner
// operation yet (PalacePlate.tsx:139-180); the fixed floor takes the owner's own shape, three rooms across and two down with four
// places in each (composition.ts PALACE_ROOMS, PALACE_LOCI_PER_ROOM).
//
// Everything the picture shows is a value. `rooms` is a JSON list, in the owner's Scene order (the overview, the constellations of the
// register's wiki, the hand-made regions): each room is {key, name, short, kind, members, more, holds?, private?}. Where a room stands
// on the board is held in `x<i>` and `y<i>`, i the room's place in that list; a room with no held point stands at the board's own
// default. `bookmarks` is `name~roomkey;…`, `path` guided or free, `route` the Return's first governed route. A key the owner has
// not reported stays absent: the well says what it lacks in words, the kit draws "—". The sample (defaults) is Central's own
// palace: its overview Scene and the constellations of its wiki (wikiExpression.ts; Control/agents/wiki/wiki.json child spaces), and
// one hand-made region that holds the Archetypal-Earth Expression as a door.
import type {ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, shown, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Kind = 'overview' | 'constellation' | 'region'
type Pt = {x: number; y: number}

const KINDS: readonly Kind[] = ['overview', 'constellation', 'region']

interface Room {
  readonly key: string; readonly name: string; readonly short: string; readonly kind?: Kind
  /** The subjects the room holds, at most four shown; `more` counts the rest. */
  readonly members: readonly string[]; readonly more: number
  /** A region's one contained Expression: a door out of the palace. */
  readonly holds?: string
  readonly private?: boolean
}

/** What each kind of room is, in the guide's words (PalaceFloor.tsx ROOM_WORDS), and the form every room here rests on (whole.ts regionArchaeology). */
const WORDS: Record<Kind, string> = {
  overview: "The register's overview: the wholes of its constellations stand here.",
  constellation: 'A constellation of the register: one of its curated sections, holding the subjects it gathers.',
  region: 'A region composed by hand: it holds one Expression, a door to another palace.',
}
const FORM = 'free mnemonic composition: no warranted QL structure stands behind this form'
const RETURN_WORDS: Record<string, string> = {none: 'none', routed: 'proposed', unrouted: 'no route', accepted: 'sent', refused: 'refused'}
/** The same states in a widget's big readout, four letters at most. */
const RETURN_SHORT: Record<string, string> = {none: '—', routed: 'wait', unrouted: 'void', accepted: 'sent', refused: '—'}
const NO_ROOM = 'No reading of your room.'
const NO_RETURN = 'No reading of the Return.'

// ---------------------------------------------------------------- the rooms the owner lists

/** One room of the list, or nothing when the entry is not a room (it needs a key and a name). */
function roomOf(x: unknown): Room[] {
  if (!x || typeof x !== 'object') return []
  const r = x as Record<string, unknown>
  if (typeof r.key !== 'string' || typeof r.name !== 'string') return []
  return [{
    key: r.key, name: r.name, short: typeof r.short === 'string' ? r.short : r.name, kind: KINDS.find(k => k === r.kind),
    members: Array.isArray(r.members) ? r.members.filter((m): m is string => typeof m === 'string') : [],
    more: typeof r.more === 'number' && r.more > 0 ? Math.floor(r.more) : 0,
    holds: typeof r.holds === 'string' ? r.holds : undefined, private: r.private === true,
  }]
}

/** The list as read, by the string it came from: a view asks for it many times in one draw. */
const read = new Map<string, readonly Room[] | undefined>()
/** The rooms the owner lists, or undefined when it has not reported them (or the key does not read as a list). */
function rooms(v: V): readonly Room[] | undefined {
  const raw = strOf(v, 'rooms')
  if (raw === undefined) return undefined
  if (!read.has(raw)) {
    if (read.size > 24) read.clear()
    const list = json<unknown>(v, 'rooms', undefined)
    read.set(raw, Array.isArray(list) ? list.flatMap(roomOf) : undefined)
  }
  return read.get(raw)
}
const roomsIn = (v: V): readonly Room[] => rooms(v) ?? []
/** What the picture lacks when there is nothing to draw, in words. */
const roomsWhy = (v: V): string | undefined => { const list = rooms(v); return list === undefined ? 'No reading of the rooms.' : list.length === 0 ? 'The palace has no rooms.' : undefined }

// ---------------------------------------------------------------- the board, in the owner's units

/** A room on the board (palacesModel.ts ROOM_SIZE), the board's grid and its snap reach (board.ts BOARD_GRID, BOARD_SNAP_REACH). */
const RW = 220, RH = 150, GRID = 100, REACH = 25
/** The frame every well draws the board in: a fixed extent for the rooms the palace has, so a dragged room never moves the frame
 * under the pointer. Six rooms, three across and two down, fill 940 × 570; a longer list adds rows. */
const extOf = (n: number) => ({x: 40, y: 40, w: 940, h: Math.max(570, 100 + (Math.ceil(n / 3) - 1) * 300 + RH + 60 - 40)})
type Ext = ReturnType<typeof extOf>

/** Room i's default point on the board (board.ts defaultBoardPoint): three to a row, a 300 stride. On the fixed floor it is the room's place. */
const home = (i: number): Pt => ({x: 100 + (i % 3) * 300, y: 100 + Math.floor(i / 3) * 300})
const held = (v: V, i: number): Pt => {
  const x = numOf(v, `x${i}`), y = numOf(v, `y${i}`)
  return x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y) ? {x, y} : home(i)
}
/** The floor the owner reports: the free board, the fixed floor, or undefined when it has not said. */
const floorOf = (v: V): 'board' | 'loci' | undefined => { const f = strOf(v, 'floor'); return f === 'board' || f === 'loci' ? f : undefined }
const loci = (v: V) => floorOf(v) === 'loci'
const guidedOn = (v: V) => strOf(v, 'path') === 'guided'
/** Where room i stands: on the fixed floor, its place there; on the board, the point it was dragged to. */
const placed = (v: V, i: number): Pt => (loci(v) ? home(i) : held(v, i))
const door = (p: Pt): Pt => ({x: p.x + RW - 14, y: p.y + RH - 14})
const snap = (p: Pt): Pt => {
  const near = (n: number) => { const g = Math.round(n / GRID) * GRID; return Math.abs(n - g) <= REACH ? g : n }
  return {x: near(p.x), y: near(p.y)}
}

/** A room that is private stays under cloud unless the audience is the owner. An audience not reported is not the owner. */
const hidden = (v: V) => strOf(v, 'audience') !== 'me'
/** The rooms this audience may see. A private room stays under cloud for Field and Public. */
const visible = (v: V): number[] => roomsIn(v).flatMap((room, i) => (room.private && hidden(v) ? [] : [i]))
/** Left to right, row by row: how the fixed floor orders its rooms (composition.ts locusOrder). */
const reading = (p: Pt) => Math.round(p.y / RH) * 100000 + p.x
/** The walk, as room indexes. Authored: the owner's Scene order. Spatial: the board read left to right, row by row. */
const order = (v: V): number[] => {
  const list = visible(v)
  return loci(v) || strOf(v, 'order') !== 'spatial' ? list : [...list].sort((a, b) => reading(held(v, a)) - reading(held(v, b)))
}
/** Where the walk stands, as a place in the order; undefined when the owner has not said, or there is no room to stand in. */
const at = (v: V): number | undefined => {
  const k = numOf(v, 'at'), n = order(v).length
  return k === undefined || !Number.isFinite(k) || n === 0 ? undefined : clampTo(0, n - 1, Math.round(k))
}
/** The room the walk stands in. */
const here = (v: V): number | undefined => { const k = at(v); return k === undefined ? undefined : order(v)[k] }
/** The reason a walk control cannot act, in words, or undefined when the walk can move. */
const walkWhy = (v: V): string | undefined => roomsWhy(v) ?? (order(v).length ? undefined : 'No room stands open to this audience.')

/** The host's standing for a key, with this view's own reason added when the host gives none. */
const stand = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return s.disabled || !why ? s : {...s, disabled: why} }
const writable = (p: ViewProps, key: string) => !st(p, key).disabled

/** Change values and keep you in the same room, whatever order the change gives the walk. */
function commit(p: ViewProps, patch: Record<string, Value>) {
  const room = here(p.v)
  for (const [key, value] of Object.entries(patch)) p.set(key, value)
  if (room !== undefined && writable(p, 'at')) p.set('at', Math.max(0, order({...p.v, ...patch}).indexOf(room)))
}
const enter = (v: V, set: SetFn, room: number) => { const k = order(v).indexOf(room); if (k >= 0) set('at', k) }

interface Mark {readonly name: string; readonly room: number}
/** The saved positions: a name and the room the walk stood in. Undefined when the owner reports no bookmarks or no rooms to find them in. */
const marks = (v: V): Mark[] | undefined => {
  const raw = strOf(v, 'bookmarks'), list = rooms(v)
  if (raw === undefined || list === undefined) return undefined
  return raw.split(';').filter(Boolean).flatMap(entry => {
    const [name, key] = entry.split('~'), room = list.findIndex(candidate => candidate.key === key)
    return name && room >= 0 ? [{name, room}] : []
  })
}
const markHere = (v: V) => { const room = here(v); return room === undefined ? undefined : marks(v)?.find(mark => mark.room === room) }

/** The edges of the path, room to room along the walk. A door to an Expression that is gone draws as broken (board.ts BoardEdge). */
const edges = (v: V) => {
  const ord = order(v), list = roomsIn(v), gone = boolOf(v, 'gone') === true
  return ord.slice(1).map((to, k) => ({from: ord[k]!, to, broken: list[to]?.holds !== undefined && gone}))
}
/** A door's colour: broken when its palace is gone, whole when it is not, faint when the owner has not said. */
const doorFill = (v: V) => { const gone = boolOf(v, 'gone'); return gone === true ? 'var(--stall)' : gone === false ? 'var(--dp-value)' : 'color-mix(in srgb, var(--text) 30%, transparent)' }
/** The room's own kind, as the guide says it. */
const kindWords = (room: Room) => (room.kind ? WORDS[room.kind] : 'No reading of what this room is.')

// ---------------------------------------------------------------- the picture

function frame(w: number, h: number, bottom: number, ext: Ext) {
  const aw = w - 8, ah = h - bottom - 6, s = Math.min(aw / ext.w, ah / ext.h)
  const ox = (w - ext.w * s) / 2, oy = 4 + (ah - ext.h * s) / 2
  return {s, X: (x: number) => ox + (x - ext.x) * s, Y: (y: number) => oy + (y - ext.y) * s, bx: (px: number) => (px - ox) / s + ext.x, by: (py: number) => (py - oy) / s + ext.y}
}

const cloud = (cx: number, cy: number, k: number) => <g transform={`translate(${cx} ${cy})`} style={{fill: 'color-mix(in srgb, var(--text) 30%, transparent)'}}>
  <circle cx={-3 * k} cy={k} r={2.4 * k} /><circle cx={0} cy={-k} r={3 * k} /><circle cx={3.2 * k} cy={k} r={2.2 * k} />
</g>

const wrap = (line: string, max: number): string[] => {
  const lines: string[] = []
  for (const word of line.split(' ')) {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}
/** What the well says where it has nothing to draw. */
const Note = ({x, y, lines}: {x: number; y: number; lines: readonly string[]}) =>
  <>{lines.map((t, i) => <text key={i} x={x} y={y + i * 11} className="dp-ink-dim" textAnchor="middle">{t}</text>)}</>

/** The palace's plan: rooms, the path between their doors, the room you stand in. Handle 1 puts you in a room; handle 2 places the room. */
function Plan({p, w, h, handles, text, names}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; text: boolean; names: boolean}) {
  const v = p.v, list = rooms(v)
  if (!list || !list.length) return <Note x={w / 2} y={h / 2 - 6} lines={wrap(roomsWhy(v) ?? '', Math.floor((w - 16) / 4.8))} />
  const floor = floorOf(v), guided = guidedOn(v), bottom = text ? 26 : 6
  const ext = extOf(list.length), f = frame(w, h, bottom, ext), ord = order(v), focus = here(v), k = at(v)
  const snapping = boolOf(v, 'snap') === true && floor === 'board', mk = marks(v) ?? []
  const setAt = writable(p, 'at') ? p.set : undefined
  const placeable = focus !== undefined && writable(p, `x${focus}`) && writable(p, `y${focus}`)
  const grid: Pt[] = []
  if (snapping && f.s * GRID > 8) for (let gx = Math.ceil(ext.x / GRID) * GRID; gx <= ext.x + ext.w; gx += GRID) for (let gy = Math.ceil(ext.y / GRID) * GRID; gy <= ext.y + ext.h; gy += GRID) grid.push({x: gx, y: gy})
  const nearest = (x: number, y: number) => {
    const open = visible(v), c = (j: number) => Math.hypot(f.X(placed(v, j).x + RW / 2) - x, f.Y(placed(v, j).y + RH / 2) - y)
    return open.length ? open.reduce((best, i) => (c(i) < c(best) ? i : best), open[0]!) : undefined
  }
  const d1 = focus === undefined ? undefined : door(placed(v, focus)), c2 = focus === undefined ? undefined : placed(v, focus)
  return <>
    {grid.map(g => <circle key={`${g.x}:${g.y}`} cx={f.X(g.x)} cy={f.Y(g.y)} r={.7} fill="var(--text-faint, #71767c)" opacity={.6} />)}
    {boolOf(v, 'lines') === true && edges(v).map(e => {
      const a = door(placed(v, e.from)), b = door(placed(v, e.to))
      return <path key={`${e.from}:${e.to}`} d={`M${f.X(a.x)} ${f.Y(a.y)}L${f.X(b.x)} ${f.Y(b.y)}`} className="dp-faint"
        style={e.broken ? {stroke: 'var(--stall)', strokeDasharray: '2 2'} : {strokeDasharray: '3 3'}} />
    })}
    {list.map((room, i) => {
      const pt = placed(v, i), x = f.X(pt.x), y = f.Y(pt.y), rw = RW * f.s, rh = RH * f.s
      const under = !!room.private && hidden(v), focused = i === focus && !under, step = ord.indexOf(i)
      const flagged = mk.some(mark => mark.room === i) && !under
      return <g key={room.key} style={{cursor: setAt && !under ? 'pointer' : undefined}} onClick={setAt && !under ? () => enter(v, setAt, i) : undefined}
        data-i={`${room.name}|${under ? 'A private room. It stays under cloud for this audience.' : `${kindWords(room)} Press to stand in it.`}`}>
        <rect x={x} y={y} width={rw} height={rh} rx={1.5} style={{fill: focused ? 'color-mix(in srgb, var(--dp-on) 14%, transparent)' : 'color-mix(in srgb, var(--text) 5%, transparent)'}} />
        <rect x={x} y={y} width={rw} height={rh} rx={1.5} className={focused ? (guided ? 'dp-curve-on' : 'dp-curve') : 'dp-faint'}
          style={{...(under ? {strokeDasharray: '2 2'} : {}), ...(!focused && !room.members.length && !room.holds ? {opacity: .6} : {})}} />
        {names && !under && <text x={x + 3} y={y + 8} className="dp-axis" style={{fontSize: 7}}>{room.short}</text>}
        {under && cloud(x + rw / 2, y + rh / 2, Math.min(2.2, f.s * 9))}
        {!under && floor === 'board' && room.members.slice(0, 4).map((_, j) => <rect key={j} x={x + rw * .12} y={y + rh * (names ? .38 : .3) + j * rh * .14} width={rw * .76} height={Math.max(1, rh * .06)} style={{fill: 'color-mix(in srgb, var(--text) 24%, transparent)'}} />)}
        {!under && floor === 'loci' && [0, 1, 2, 3].map(j => <circle key={j} cx={x + rw * (j % 2 ? .7 : .3)} cy={y + rh * (j < 2 ? .46 : .76)} r={Math.max(1.2, rw * .05)}
          style={j < room.members.length ? {fill: 'var(--dp-value)'} : {fill: 'none', stroke: 'color-mix(in srgb, var(--text) 30%, transparent)'}} />)}
        {room.holds && !under && <rect x={x + rw - 1.5} y={y + rh * .34} width={3} height={rh * .32} style={{fill: doorFill(v)}} />}
        {flagged && <path d={`M${x + rw - 6} ${y}L${x + rw} ${y}L${x + rw} ${y + 6}Z`} style={{fill: 'var(--sel)'}} />}
        {guided && !under && step >= 0 && <text x={x + rw - 3} y={y + rh - 2.5} textAnchor="end" className="dp-axis" style={{fontSize: 7, fill: focused ? 'var(--dp-on)' : undefined}}>{step + 1}</text>}
      </g>
    })}
    {text && (focus !== undefined && k !== undefined
      ? <text x={6} y={h - 15} className="dp-ink">{`${k + 1}  ${list[focus]?.short ?? NONE}`}</text>
      : <text x={6} y={h - 15} className="dp-ink-dim">{NO_ROOM}</text>)}
    {text && boolOf(v, 'guide') === true && focus !== undefined && <text x={6} y={h - 5} className="dp-axis">{`${list[focus]?.kind ?? NONE} · free form`}</text>}
    {setAt && handles >= 1 && d1 && <Handle n={1} shape="ring" x={clampTo(6, w - 6, f.X(d1.x))} y={clampTo(6, h - bottom, f.Y(d1.y))} label="You" does="Drag to a room: you stand in it."
      onDrag={(x, y) => { const room = nearest(x, y); if (room !== undefined) enter(v, setAt, room) }} onReset={() => setAt('at', 0)} />}
    {handles === 2 && floor === 'board' && focus !== undefined && c2 && <Handle n={2} x={clampTo(6, w - 6, f.X(c2.x + RW / 2))} y={clampTo(6, h - bottom, f.Y(c2.y + RH / 2))} label="Room" does="Drag: place the room on the board. The position is presentation."
      onDrag={placeable ? (x, y) => {
        const q = {x: clampTo(ext.x, ext.x + ext.w - RW, f.bx(x) - RW / 2), y: clampTo(ext.y, ext.y + ext.h - RH, f.by(y) - RH / 2)}, r = snapping ? snap(q) : q
        commit(p, {[`x${focus}`]: Math.round(r.x), [`y${focus}`]: Math.round(r.y)})
      } : undefined}
      onReset={placeable ? () => commit(p, {[`x${focus}`]: home(focus).x, [`y${focus}`]: home(focus).y}) : undefined} />}
  </>
}

function PlanWell({p, w, h, handles, text = true, names = false}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; text?: boolean; names?: boolean}) {
  const v = p.v, k = at(v), floor = floorOf(v)
  return <Display w={w} h={h} label="The palace" corner={k !== undefined ? `${k + 1}/${order(v).length}` : NONE}
    does={`The rooms${floor === 'loci' ? ' on the fixed floor' : floor === 'board' ? ' on the board' : ''}, the path between their doors, and the room you stand in. Press a room to stand in it. Drag handle 1 to a room${handles === 2 ? '; drag handle 2 to place the room' : ''}.`}>
    <Plan p={p} w={w} h={h} handles={handles} text={text} names={names} />
  </Display>
}

// ---------------------------------------------------------------- the pane: the palace at full size

const PANE = {w: 760, h: 420}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const ink = (size: number, fill: string) => ({font: `${size}px var(--font-ui, sans-serif)`, fill})
const routeText = (v: V) => strOf(v, 'route') || NONE

/** The Return, in a line: what the owner says of it. */
function returned(v: V): string {
  const state = strOf(v, 'proposal'), route = routeText(v)
  return state === 'routed' ? `Return proposed to ${route}: it waits for you.` : state === 'unrouted' ? 'Return: the reading names no route. Nothing was sent.'
    : state === 'accepted' ? `Return sent to ${route}. The owner decides.` : state === 'refused' ? 'Return refused. Nothing was sent.' : state === 'none' ? 'Return: nothing proposed.' : NO_RETURN
}

function Floor({v}: {v: V}) {
  const list = rooms(v), floor = floorOf(v), guided = guidedOn(v), focus = here(v), k = at(v), ord = order(v), path = strOf(v, 'path')
  const palace = has(v, 'palace') ? `${shown(v, 'palace')} — wiki local whole` : 'Wiki local whole'
  const walk = path === undefined ? NONE : guided ? (k === undefined ? NONE : `walk ${k + 1}/${ord.length}`) : 'free'
  const head = <>
    <text x={14} y={20} style={ink(11.5, 'var(--text)')}>{`${palace} · ${list ? `${ord.length} rooms` : NONE} · ${floor === undefined ? NONE : floor === 'loci' ? 'fixed floor' : 'board'} · ${walk}`}</text>
    <text x={PANE.w - 14} y={20} textAnchor="end" style={ink(10.5, strOf(v, 'proposal') === 'unrouted' ? 'var(--stall)' : 'var(--text-dim)')}>{returned(v)}</text>
  </>
  if (!list || !list.length) return <g>{head}<text x={PANE.w / 2} y={PANE.h / 2} textAnchor="middle" style={ink(13, 'var(--text-dim)')}>{roomsWhy(v)}</text></g>
  const pts = list.map((_, i) => placed(v, i))
  const L = Math.min(...pts.map(p => p.x)) - 30, R = Math.max(...pts.map(p => p.x)) + RW + 30, T = Math.min(...pts.map(p => p.y)) - 24, B = Math.max(...pts.map(p => p.y)) + RH + 24
  const area = {x: 14, y: 30, w: PANE.w - 28, h: 326}, s = Math.min(area.w / (R - L), area.h / (B - T))
  const X = (x: number) => area.x + (area.w - (R - L) * s) / 2 + (x - L) * s, Y = (y: number) => area.y + (area.h - (B - T) * s) / 2 + (y - T) * s
  const u = (n: number) => n * s
  const mk = marks(v) ?? [], gone = boolOf(v, 'gone') === true, room = focus === undefined ? undefined : list[focus]
  return <g>
    {head}
    {boolOf(v, 'lines') === true && edges(v).map(e => {
      const a = door(placed(v, e.from)), b = door(placed(v, e.to))
      return <path key={`${e.from}:${e.to}`} d={`M${X(a.x)} ${Y(a.y)}L${X(b.x)} ${Y(b.y)}`} className="dp-faint"
        style={e.broken ? {stroke: 'var(--stall)', strokeDasharray: '4 3', strokeWidth: 1.4} : {strokeDasharray: '5 4'}} />
    })}
    {list.map((r, i) => {
      const pt = placed(v, i), x = X(pt.x), y = Y(pt.y), rw = u(RW), rh = u(RH)
      const under = !!r.private && hidden(v), focused = i === focus && !under, mark = mk.find(m => m.room === i)
      return <g key={r.key} data-i={`${r.name}|${under ? 'A private room. It stays under cloud for this audience.' : kindWords(r)}`}>
        <rect x={x} y={y} width={rw} height={rh} rx={3} style={{fill: focused ? 'color-mix(in srgb, var(--dp-on) 9%, var(--dp-well))' : 'color-mix(in srgb, var(--text) 4%, var(--dp-well))',
          stroke: focused ? (guided ? 'var(--dp-on)' : 'var(--dp-value)') : 'color-mix(in srgb, var(--text) 24%, transparent)', strokeWidth: focused ? 2 : 1, strokeDasharray: under ? '4 3' : undefined}} />
        <text x={x + u(10)} y={y + u(24)} style={ink(10, under ? 'var(--text-faint)' : 'var(--text)')}>{clip(under ? 'Private room' : r.name, 24)}</text>
        {under && cloud(x + rw / 2, y + rh / 2 + 4, 2.4)}
        {!under && floor === 'board' && r.members.slice(0, 4).map((m, j) => <g key={`${j}:${m}`}>
          <rect x={x + u(10)} y={y + u(36) + j * u(24)} width={rw - u(20)} height={u(19)} style={{fill: 'color-mix(in srgb, var(--text) 8%, transparent)'}} />
          <text x={x + u(18)} y={y + u(49) + j * u(24)} style={ink(9, 'var(--text-dim)')}>{clip(m, 24)}</text>
        </g>)}
        {!under && floor === 'board' && r.more > 0 && <text x={x + u(10)} y={y + rh - u(8)} style={ink(8.5, 'var(--text-faint)')}>{`+${r.more} more`}</text>}
        {!under && floor === 'loci' && [0, 1, 2, 3].map(j => <g key={j}>
          <rect x={x + u(10) + (j % 2) * u(104)} y={y + u(38) + Math.floor(j / 2) * u(56)} width={u(96)} height={u(48)} style={{fill: 'none', stroke: 'color-mix(in srgb, var(--text) 24%, transparent)'}} />
          <text x={x + u(16) + (j % 2) * u(104)} y={y + u(66) + Math.floor(j / 2) * u(56)} style={ink(8.5, j < r.members.length ? 'var(--text-dim)' : 'var(--text-faint)')}>{j < r.members.length ? clip(r.members[j]!, 12) : NONE}</text>
        </g>)}
        {!under && floor === 'loci' && r.more > 0 && <text x={x + rw - u(10)} y={y + u(24)} textAnchor="end" style={ink(8.5, 'var(--text-faint)')}>{`+${r.more}`}</text>}
        {r.holds && !under && floor === 'board' && <text x={x + u(10)} y={y + u(49)} style={ink(9, gone ? 'var(--stall)' : 'var(--text-dim)')}>{`→ ${clip(r.holds, 21)}`}</text>}
        {r.holds && !under && <g>
          <rect x={x + rw - 4} y={y + rh * .36} width={8} height={rh * .3} rx={1} style={{fill: doorFill(v)}} />
          {gone && <text x={x + rw - u(10)} y={y + u(24)} textAnchor="end" style={ink(8.5, 'var(--stall)')}>gone</text>}
        </g>}
        {r.kind === 'region' && !r.holds && !under && floor === 'board' && <text x={x + u(10)} y={y + u(49)} style={ink(9, 'var(--text-faint)')}>no Expression yet</text>}
        {!under && floor === 'board' && r.more === 0 && <text x={x + u(10)} y={y + rh - u(8)} style={ink(8, 'var(--text-faint)')}>{`${r.kind ?? NONE} · free form`}</text>}
        {mark && !under && <g data-i={`Bookmark · ${mark.name}|The walk and the board are kept here.`}><path d={`M${x + rw - 11} ${y}L${x + rw - 2} ${y}L${x + rw - 2} ${y + 13}L${x + rw - 6.5} ${y + 9}L${x + rw - 11} ${y + 13}Z`} style={{fill: 'var(--sel)'}} /></g>}
      </g>
    })}
    {guided && ord.map((i, j) => {
      const d = door(placed(v, i)), on_ = i === focus
      return <g key={i}>
        <circle cx={X(d.x)} cy={Y(d.y)} r={8.5} style={{fill: on_ ? 'var(--dp-on)' : 'var(--dp-well)', stroke: on_ ? 'var(--dp-on)' : 'color-mix(in srgb, var(--text) 40%, transparent)'}} />
        <text x={X(d.x)} y={Y(d.y) + 3.4} textAnchor="middle" style={{font: '700 9.5px var(--font-ui, sans-serif)', fill: on_ ? 'var(--dp-on-text)' : 'var(--text-dim)'}}>{j + 1}</text>
      </g>
    })}
    {boolOf(v, 'guide') === true && (room
      ? <g>
        <text x={14} y={380} style={ink(10.5, 'var(--text)')}>{`${room.name} — ${kindWords(room)}`}</text>
        <text x={14} y={396} style={ink(10, 'var(--text-dim)')}>{`Its form: ${FORM}.`}</text>
      </g>
      : <text x={14} y={380} style={ink(10.5, 'var(--text-dim)')}>{NO_ROOM}</text>)}
  </g>
}

// ---------------------------------------------------------------- the controls, each in one place

const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const span = (n: number, node: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{node}</div>

const roomDial = (p: ViewProps) => {
  const n = order(p.v).length
  return <Dial {...stand(p, 'at', walkWhy(p.v))} label="Room" does="Puts you in a room. Turn it to walk the rooms in order." value={at(p.v) ?? NaN} def={0}
    scale={{min: 0, max: Math.max(1, n - 1), step: 1}} format={k => `${k + 1}/${n}`} onChange={k => p.set('at', k)} />
}
const roomChooser = (p: ViewProps) => {
  const k = at(p.v), list = roomsIn(p.v)
  return <Chooser {...stand(p, 'at', walkWhy(p.v))} label="Room" does="Puts you in a room. The picture marks it with a ring." value={k === undefined ? '' : String(k)}
    options={order(p.v).map((room, j) => ({value: String(j), label: `${j + 1} · ${list[room]?.short ?? NONE}`}))} onChange={x => p.set('at', Number(x))} />
}
const pathRadio = (p: ViewProps) => <Radio {...st(p, 'path')} label="Path" does="Guided numbers the rooms and marks your room. Free shows neither: you enter any room." value={strOf(p.v, 'path') ?? ''}
  options={[{value: 'guided', label: 'Guided'}, {value: 'free', label: 'Free'}]} stack onChange={x => p.set('path', x)} />
const guideToggle = (p: ViewProps) => {
  const now = boolOf(p.v, 'guide')
  return <Toggle {...st(p, 'guide')} label="Guide" does="The guide says why the room you stand in is there, and the form it rests on." on={now === true} unknown={now === undefined} onChange={x => p.set('guide', x)} />
}
const orderRadio = (p: ViewProps) => <Radio {...stand(p, 'order', loci(p.v) ? 'The fixed floor is already in order.' : undefined)} label="Order"
  does="Authored walks the rooms in the order of the path. Spatial walks the board left to right, row by row."
  value={strOf(p.v, 'order') ?? ''} options={[{value: 'authored', label: 'Authored'}, {value: 'spatial', label: 'Spatial'}]} stack onChange={x => commit(p, {order: x})} />
const floorRadio = (p: ViewProps) => <Radio {...st(p, 'floor')} label="Floor" does="The free board, or the fixed floor of six rooms with four places in each: the method of loci." value={strOf(p.v, 'floor') ?? ''}
  options={[{value: 'board', label: 'Board'}, {value: 'loci', label: 'Loci'}]} stack onChange={x => commit(p, {floor: x})} />
const audienceRadio = (p: ViewProps) => <Radio {...st(p, 'audience')} label="Audience" does="Shows the palace as that audience sees it. A private room stays under cloud for Field and Public."
  value={strOf(p.v, 'audience') ?? ''} options={[{value: 'me', label: 'Me'}, {value: 'field', label: 'Field'}, {value: 'public', label: 'Public'}]} stack
  onChange={x => commit(p, {audience: x})} />
const snapToggle = (p: ViewProps) => {
  const now = boolOf(p.v, 'snap')
  return <Toggle {...stand(p, 'snap', loci(p.v) ? 'The fixed floor has no free rooms to place.' : undefined)} label="Snap" does="Aligns a dragged room to the grid. The position stays presentation."
    on={now === true} unknown={now === undefined} onChange={x => p.set('snap', x)} />
}
const linesToggle = (p: ViewProps) => {
  const now = boolOf(p.v, 'lines')
  return <Toggle {...st(p, 'lines')} label="Lines" does="Draws a line from each room to the next on the walk. A door to a gone palace draws as broken."
    on={now === true} unknown={now === undefined} onChange={x => p.set('lines', x)} />
}

const walkTo = (p: ViewProps, k: number) => { const n = order(p.v).length; if (n) p.set('at', ((k % n) + n) % n) }
/** Back and Next step from where you stand: with no reading of that, they cannot. */
const stepWhy = (v: V) => walkWhy(v) ?? (at(v) === undefined ? NO_ROOM : undefined)
const start = (p: ViewProps) => <Action {...stand(p, 'at', walkWhy(p.v))} label="Start" does="Goes to the first room of the path." onPress={() => p.set('at', 0)} />
const back = (p: ViewProps) => <Action {...stand(p, 'at', stepWhy(p.v))} label="‹ Back" does="Goes to the room before this one. The walk wraps at the start." onPress={() => walkTo(p, (at(p.v) ?? 0) - 1)} />
const next = (p: ViewProps) => <Action {...stand(p, 'at', stepWhy(p.v))} label="Next ›" does="Goes to the room after this one. The walk wraps at the end." onPress={() => walkTo(p, (at(p.v) ?? 0) + 1)} />

const bookmarkChooser = (p: ViewProps) => {
  const mk = marks(p.v), standing = here(p.v) !== undefined
  return <Chooser {...stand(p, 'at', mk === undefined ? 'No reading of the bookmarks.' : mk.length ? undefined : 'Keep a position first.')} label="Bookmark" does="Jumps to a saved position. It shows the bookmark of the room you stand in."
    value={markHere(p.v)?.name ?? ''} options={mk === undefined ? [] : [...(standing ? [{value: '', label: 'None'}] : []), ...mk.map(m => ({value: m.name, label: m.name}))]}
    onChange={x => { const m = mk?.find(candidate => candidate.name === x); if (m) enter(p.v, p.set, m.room) }} />
}
const markName = (p: ViewProps) => <TextField {...st(p, 'draft')} label="Name" does="Names the position you stand in. Press Enter to set the name." value={strOf(p.v, 'draft') ?? ''} placeholder="Name it" onChange={x => p.set('draft', x)} />
/** Keep sends its own key; the name it saves is the one in Name (`draft`). */
const keepMark = (p: ViewProps) => {
  const name = (strOf(p.v, 'draft') ?? '').trim(), mk = marks(p.v)
  const why = here(p.v) === undefined ? NO_ROOM : mk === undefined ? 'No reading of the bookmarks.' : !name ? 'Type a name first.' : markHere(p.v) ? 'This room has a bookmark.' : undefined
  return <Action {...stand(p, 'keep', why)} label="Keep" does="Saves the room you stand in under the name. One bookmark for each room." onPress={() => p.set('keep', true)} />
}

const propose = (p: ViewProps, label = 'Propose') => {
  const own = st(p, 'propose'), unrouted = strOf(p.v, 'proposal') === 'unrouted'
  return <Action {...own} refused={own.refused ?? (unrouted ? 'The reading names no route. Nothing was sent.' : undefined)} label={label}
    does="Shapes the objects, in the order you arranged them, as a proposal with your name. Nothing is written." onPress={() => p.set('propose', true)} />
}
const accept = (p: ViewProps) => {
  const state = strOf(p.v, 'proposal')
  return <Action {...stand(p, 'accept', state === undefined ? NO_RETURN : state === 'routed' ? undefined : 'Propose first. The reading must name a route.')} label="Accept"
    does="Sends the proposal to its route. The owner of the sources decides." onPress={() => p.set('accept', true)} />
}
const refuse = (p: ViewProps) => {
  const state = strOf(p.v, 'proposal')
  return <Action {...stand(p, 'refuse', state === undefined ? NO_RETURN : state === 'routed' ? undefined : 'No proposal waits.')} label="Refuse"
    does="Sets the proposal aside. Nothing is sent." onPress={() => p.set('refuse', true)} />
}
const leave = (p: ViewProps) => <Action {...st(p, 'leave')} label="Leave" does="Leaves the palace for the Earth." onPress={() => p.set('leave', true)} />

const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
/** The Return's state in the readout's words, or undefined when the owner has not reported it. */
const returnWord = (v: V, words: Record<string, string>) => { const state = strOf(v, 'proposal'); return state === undefined ? undefined : words[state] }
/** The room you stand in, by its short name, or "—" when the owner has not said. */
const roomShort = (v: V) => { const room = here(v); return room === undefined ? NONE : roomsIn(v)[room]?.short ?? NONE }
/** The room you stand in, as "k/n", or undefined when the owner has not said. */
const roomOfN = (v: V) => { const k = at(v); return k === undefined ? undefined : `${k + 1}/${order(v).length}` }

export const design: DesignedDevice = {
  id: 'techne:palace',
  title: 'Palace',
  kind: 'instrument',
  defaults: {
    light: 'lit', palace: 'Central',
    // The rooms in the owner's Scene order: the overview, the constellations (child spaces of the wiki), then the hand-made region.
    rooms: JSON.stringify([
      {key: 'overview', name: 'Central — wiki overview', short: 'Overview', kind: 'overview', more: 1,
        members: ['User identity', 'You may propose', 'The beings, the thought stream, and who owns what', 'A place provider reconciles like the floor']},
      {key: 'actuation', name: 'Actuation', short: 'Actuation', kind: 'constellation', members: [], more: 0},
      {key: 'oi', name: 'O-I', short: 'O-I', kind: 'constellation', members: ['O-I'], more: 0},
      {key: 'aikit', name: 'ai-kit', short: 'ai-kit', kind: 'constellation', members: ['ai-kit'], more: 0},
      {key: 'personal', name: 'personal', short: 'personal', kind: 'constellation', members: [], more: 0, private: true},
      {key: 'earth', name: 'Earth', short: 'Earth', kind: 'region', members: [], more: 0, holds: 'Archetypal-Earth — wiki local whole'},
    ]),
    floor: 'board', path: 'guided', order: 'authored', guide: true, snap: false, lines: true, audience: 'me',
    at: 0, draft: '', bookmarks: 'Start of the argument~overview',
    // The board's held points, by room: ai-kit and personal were swapped by hand; the rest stand where the board puts them.
    x0: 100, y0: 100, x1: 400, y1: 100, x2: 700, y2: 100, x3: 400, y3: 400, x4: 100, y4: 400, x5: 700, y5: 400,
    // Readings: what the owner reports, never set from here. The wiki reading names no governed-write route (wikiReadingProvider.ts:140).
    route: '', proposal: 'none', gone: false,
  },
  fixtures: {
    'The Central palace': {},
    'A routed Return': {route: 'aikit.wiki.stage', proposal: 'routed', at: 3},
    'The fixed floor': {floor: 'loci', at: 2, gone: true},
    'No readings': Object.fromEntries(['light', 'palace', 'rooms', 'floor', 'path', 'order', 'guide', 'snap', 'lines', 'audience', 'at', 'draft', 'bookmarks',
      'x0', 'y0', 'x1', 'y1', 'x2', 'y2', 'x3', 'y3', 'x4', 'y4', 'x5', 'y5', 'route', 'proposal', 'gone'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Palace" light={light(p)} readings={[shown(p.v, 'palace'), roomShort(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Palace" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><PlanWell p={p} w={140} h={146} handles={1} /></Section>
    <Section label="Macros" cols={2}>
      {roomDial(p)}{pathRadio(p)}{guideToggle(p)}{propose(p, 'Return')}
    </Section>
  </Panel>,

  whole: p => <Panel title="Palace" view="whole" {...head(p)}>
    <Band>
      <Section width={206}><PlanWell p={p} w={194} h={146} handles={2} names /></Section>
      <Section label="Walk" cols={3} grow>
        {span(3, roomChooser(p))}
        {pathRadio(p)}{orderRadio(p)}{guideToggle(p)}
        {start(p)}{back(p)}{next(p)}
      </Section>
    </Band>
    <Band>
      <Section label="Board" cols={2}>
        {floorRadio(p)}{audienceRadio(p)}{snapToggle(p)}{linesToggle(p)}
      </Section>
      <Section label="Bookmarks" cols={2}>
        {span(2, bookmarkChooser(p))}{span(2, markName(p))}{keepMark(p)}
        <Readout label="kept" does="The positions you saved." value={marks(p.v)?.length} />
      </Section>
      <Section label="Return" cols={3} grow>
        {span(3, <Readout label="route" does="Where the reading sends a Return. The first governed route it names." value={strOf(p.v, 'route') || undefined} />)}
        {propose(p)}{accept(p)}{refuse(p)}
        <Readout label="return" does="The state of the Return." value={returnWord(p.v, RETURN_WORDS)} tone={strOf(p.v, 'proposal') === 'unrouted' ? 'stall' : undefined} />
        {leave(p)}
      </Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox={`0 0 ${PANE.w} ${PANE.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The palace">
      <g className="dp-display" style={{background: 'none'}}><Floor v={p.v} /></g>
    </svg>
  </div>,

  widget: p => {
    const mk = marks(p.v), k = at(p.v), first = mk?.[0]
    const step = writable(p, 'at') && k !== undefined ? () => walkTo(p, k + 1) : undefined
    return <Tile title={`Palace · ${shown(p.v, 'palace')}`} light={light(p)} span={2} onFull={p.nav.full}>
      <PlanWell p={p} w={112} h={104} handles={0} text={false} />
      <div className="ref-tile-counts">
        <Readout big label="room" does="The room you stand in, of the rooms in the walk. Press for the next room." value={roomOfN(p.v)} onPress={step} />
        <Readout big label="kept" does="Saved positions. Press to jump to the first." value={mk?.length} tone="value"
          onPress={first && writable(p, 'at') ? () => enter(p.v, p.set, first.room) : undefined} />
        <Readout big label="return" does="The state of the Return. Wait: proposed. Void: the reading names no route. Sent: the owner has it." value={returnWord(p.v, RETURN_SHORT)} tone="accent" />
      </div>
    </Tile>
  },
}
