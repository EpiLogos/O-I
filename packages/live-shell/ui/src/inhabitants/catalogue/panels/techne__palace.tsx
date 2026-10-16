// The Palace (manual §17.6): a place on the World that you enter. Its rooms each hold a part of one register's wiki, a path leads
// through them, and a guide says why each room stands where it does. Live's nearest: a device with a map in its well (Hybrid Reverb)
// and sections ruled off beside it. The picture is the owner's own floor (projections/atlas/palaces/PalaceFloor.tsx): rooms of
// 220 × 150 board units at the board's own default points (palacesModel / board.ts defaultBoardPoint: three to a row, a 300 stride),
// the path between the rooms' doors, the room the walk stands in, objects in each room (four at most, as the owner shows them) and a
// region's one Expression as a door. The controls front palaceSession.ts: Path (:440), Guide (:444), Snap (:435), the walk (:325,
// :340, :334), bookmarks (:370, :382) and the Return (:579, :594, :587). Floor, Order, Lines and Audience have no owner operation
// yet (PalacePlate.tsx:139-180); the fixed floor takes the owner's own shape, three rooms across and two down with four places in
// each (composition.ts PALACE_ROOMS, PALACE_LOCI_PER_ROOM). The fixture is Central's own palace: its overview Scene and the
// constellations of its wiki (wikiExpression.ts; Control/agents/wiki/wiki.json child spaces), the five nodes of its root space, and
// one hand-made region that holds the Archetypal-Earth Expression as a door.
import type {ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, TextField, Tile, Toggle, type LightState} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type Value, type ViewProps} from './design'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Kind = 'overview' | 'constellation' | 'region'
type Pt = {x: number; y: number}

interface Room {
  readonly key: string; readonly name: string; readonly short: string; readonly kind: Kind
  /** The subjects the room holds, at most four shown; `more` counts the rest. */
  readonly members: readonly string[]; readonly more: number
  /** A region's one contained Expression: a door out of the palace. */
  readonly holds?: string
  readonly private?: boolean
}

/** The rooms in the owner's Scene order: the overview, the constellations (child spaces of the wiki), then the hand-made region. */
const ROOMS: readonly Room[] = [
  {key: 'overview', name: 'Central — wiki overview', short: 'Overview', kind: 'overview', more: 1,
    members: ['User identity', 'You may propose', 'The beings, the thought stream, and who owns what', 'A place provider reconciles like the floor']},
  {key: 'actuation', name: 'Actuation', short: 'Actuation', kind: 'constellation', members: [], more: 0},
  {key: 'oi', name: 'O-I', short: 'O-I', kind: 'constellation', members: ['O-I'], more: 0},
  {key: 'aikit', name: 'ai-kit', short: 'ai-kit', kind: 'constellation', members: ['ai-kit'], more: 0},
  {key: 'personal', name: 'personal', short: 'personal', kind: 'constellation', members: [], more: 0, private: true},
  {key: 'earth', name: 'Earth', short: 'Earth', kind: 'region', members: [], more: 0, holds: 'Archetypal-Earth — wiki local whole'},
]

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

// ---------------------------------------------------------------- the board, in the owner's units

/** A room on the board (palacesModel.ts ROOM_SIZE), the board's grid and its snap reach (board.ts BOARD_GRID, BOARD_SNAP_REACH). */
const RW = 220, RH = 150, GRID = 100, REACH = 25
/** The frame every well draws the board in: a fixed extent, so a dragged room never moves the frame under the pointer. */
const EXT = {x: 40, y: 40, w: 940, h: 570}
const ROOM_AT = {x: [EXT.x, EXT.x + EXT.w - RW], y: [EXT.y, EXT.y + EXT.h - RH]} as const

/** The fixed floor's room i: three across, two down (composition.ts PALACE_ROOMS); also the board's default point (board.ts defaultBoardPoint). */
const home = (i: number): Pt => ({x: 100 + (i % 3) * 300, y: 100 + Math.floor(i / 3) * 300})
const held = (v: V, i: number): Pt => {
  const x = num(v, `x${i}`), y = num(v, `y${i}`)
  return Number.isFinite(x) && Number.isFinite(y) ? {x, y} : home(i)
}
const loci = (v: V) => str(v, 'floor') === 'loci'
/** Where room i stands: on the fixed floor, its place there; on the board, the point it was dragged to. */
const placed = (v: V, i: number): Pt => (loci(v) ? home(i) : held(v, i))
const door = (p: Pt): Pt => ({x: p.x + RW - 14, y: p.y + RH - 14})
const snap = (p: Pt): Pt => {
  const near = (n: number) => { const g = Math.round(n / GRID) * GRID; return Math.abs(n - g) <= REACH ? g : n }
  return {x: near(p.x), y: near(p.y)}
}

const hidden = (v: V) => str(v, 'audience') !== 'me'
/** The rooms this audience may see. A private room stays under cloud for Field and Public. */
const visible = (v: V): number[] => ROOMS.flatMap((room, i) => (room.private && hidden(v) ? [] : [i]))
/** Left to right, row by row: how the fixed floor orders its rooms (composition.ts locusOrder). */
const reading = (p: Pt) => Math.round(p.y / RH) * 100000 + p.x
/** The walk, as room indexes. Authored: the owner's Scene order. Spatial: the board read left to right, row by row. */
const order = (v: V): number[] => {
  const rooms = visible(v)
  return loci(v) || str(v, 'order') === 'authored' ? rooms : [...rooms].sort((a, b) => reading(held(v, a)) - reading(held(v, b)))
}
const at = (v: V) => clampTo(0, order(v).length - 1, Math.round(num(v, 'at')))
const here = (v: V) => order(v)[at(v)]!

/** Change values and keep you in the same room, whatever order the change gives the walk. */
function commit(v: V, set: SetFn, patch: Record<string, Value>) {
  const room = here(v)
  for (const [key, value] of Object.entries(patch)) set(key, value)
  set('at', Math.max(0, order({...v, ...patch}).indexOf(room)))
}
const enter = (v: V, set: SetFn, room: number) => { const k = order(v).indexOf(room); if (k >= 0) set('at', k) }

interface Mark {readonly name: string; readonly room: number}
/** The saved positions: a name and the room the walk stood in. */
const marks = (v: V): Mark[] => str(v, 'bookmarks').split(';').filter(Boolean).flatMap(entry => {
  const [name, key] = entry.split('~'), room = ROOMS.findIndex(candidate => candidate.key === key)
  return name && room >= 0 ? [{name, room}] : []
})
const markHere = (v: V) => marks(v).find(mark => mark.room === here(v))

/** The edges of the path, room to room along the walk. A door to an Expression that is gone draws as broken (board.ts BoardEdge). */
const edges = (v: V) => order(v).slice(1).map((to, k) => ({from: order(v)[k]!, to, broken: ROOMS[to]!.holds !== undefined && on(v, 'gone')}))

// ---------------------------------------------------------------- the picture

function frame(w: number, h: number, bottom: number) {
  const aw = w - 8, ah = h - bottom - 6, s = Math.min(aw / EXT.w, ah / EXT.h)
  const ox = (w - EXT.w * s) / 2, oy = 4 + (ah - EXT.h * s) / 2
  return {s, X: (x: number) => ox + (x - EXT.x) * s, Y: (y: number) => oy + (y - EXT.y) * s, bx: (px: number) => (px - ox) / s + EXT.x, by: (py: number) => (py - oy) / s + EXT.y}
}

const cloud = (cx: number, cy: number, k: number) => <g transform={`translate(${cx} ${cy})`} style={{fill: 'color-mix(in srgb, var(--text) 30%, transparent)'}}>
  <circle cx={-3 * k} cy={k} r={2.4 * k} /><circle cx={0} cy={-k} r={3 * k} /><circle cx={3.2 * k} cy={k} r={2.2 * k} />
</g>

/** The palace's plan: rooms, the path between their doors, the room you stand in. Handle 1 puts you in a room; handle 2 places the room. */
function Plan({v, set, w, h, handles, text, names}: {v: V; set?: SetFn; w: number; h: number; handles: 0 | 1 | 2; text: boolean; names: boolean}) {
  const floor = loci(v), guided = str(v, 'path') === 'guided', bottom = text ? 26 : 6
  const f = frame(w, h, bottom), ord = order(v), focus = here(v), snapping = on(v, 'snap') && !floor
  const grid: Pt[] = []
  if (snapping && f.s * GRID > 8) for (let gx = Math.ceil(EXT.x / GRID) * GRID; gx <= EXT.x + EXT.w; gx += GRID) for (let gy = Math.ceil(EXT.y / GRID) * GRID; gy <= EXT.y + EXT.h; gy += GRID) grid.push({x: gx, y: gy})
  const nearest = (x: number, y: number) => visible(v).reduce((best, i) => {
    const c = (j: number) => Math.hypot(f.X(placed(v, j).x + RW / 2) - x, f.Y(placed(v, j).y + RH / 2) - y)
    return c(i) < c(best) ? i : best
  })
  const d1 = door(placed(v, focus)), c2 = placed(v, focus)
  return <>
    {grid.map(g => <circle key={`${g.x}:${g.y}`} cx={f.X(g.x)} cy={f.Y(g.y)} r={.7} fill="var(--text-faint, #71767c)" opacity={.6} />)}
    {on(v, 'lines') && edges(v).map(e => {
      const a = door(placed(v, e.from)), b = door(placed(v, e.to))
      return <path key={`${e.from}:${e.to}`} d={`M${f.X(a.x)} ${f.Y(a.y)}L${f.X(b.x)} ${f.Y(b.y)}`} className="dp-faint"
        style={e.broken ? {stroke: 'var(--stall)', strokeDasharray: '2 2'} : {strokeDasharray: '3 3'}} />
    })}
    {ROOMS.map((room, i) => {
      const p = placed(v, i), x = f.X(p.x), y = f.Y(p.y), rw = RW * f.s, rh = RH * f.s
      const under = !!room.private && hidden(v), focused = i === focus && !under, step = ord.indexOf(i)
      const flagged = marks(v).some(mark => mark.room === i) && !under
      return <g key={room.key} style={{cursor: set && !under ? 'pointer' : undefined}} onClick={set && !under ? () => enter(v, set, i) : undefined}
        data-i={`${room.name}|${under ? 'A private room. It stays under cloud for this audience.' : `${WORDS[room.kind]} Press to stand in it.`}`}>
        <rect x={x} y={y} width={rw} height={rh} rx={1.5} style={{fill: focused ? 'color-mix(in srgb, var(--dp-on) 14%, transparent)' : 'color-mix(in srgb, var(--text) 5%, transparent)'}} />
        <rect x={x} y={y} width={rw} height={rh} rx={1.5} className={focused ? (guided ? 'dp-curve-on' : 'dp-curve') : 'dp-faint'}
          style={{...(under ? {strokeDasharray: '2 2'} : {}), ...(!focused && !room.members.length && !room.holds ? {opacity: .6} : {})}} />
        {names && !under && <text x={x + 3} y={y + 8} className="dp-axis" style={{fontSize: 7}}>{room.short}</text>}
        {under && cloud(x + rw / 2, y + rh / 2, Math.min(2.2, f.s * 9))}
        {!under && !floor && room.members.slice(0, 4).map((_, k) => <rect key={k} x={x + rw * .12} y={y + rh * (names ? .38 : .3) + k * rh * .14} width={rw * .76} height={Math.max(1, rh * .06)} style={{fill: 'color-mix(in srgb, var(--text) 24%, transparent)'}} />)}
        {!under && floor && [0, 1, 2, 3].map(k => <circle key={k} cx={x + rw * (k % 2 ? .7 : .3)} cy={y + rh * (k < 2 ? .46 : .76)} r={Math.max(1.2, rw * .05)}
          style={k < room.members.length ? {fill: 'var(--dp-value)'} : {fill: 'none', stroke: 'color-mix(in srgb, var(--text) 30%, transparent)'}} />)}
        {room.holds && !under && <rect x={x + rw - 1.5} y={y + rh * .34} width={3} height={rh * .32} style={{fill: on(v, 'gone') ? 'var(--stall)' : 'var(--dp-value)'}} />}
        {flagged && <path d={`M${x + rw - 6} ${y}L${x + rw} ${y}L${x + rw} ${y + 6}Z`} style={{fill: 'var(--sel)'}} />}
        {guided && !under && step >= 0 && <text x={x + rw - 3} y={y + rh - 2.5} textAnchor="end" className="dp-axis" style={{fontSize: 7, fill: focused ? 'var(--dp-on)' : undefined}}>{step + 1}</text>}
      </g>
    })}
    {text && <>
      <text x={6} y={h - 15} className="dp-ink">{`${at(v) + 1}  ${ROOMS[focus]!.short}`}</text>
      {on(v, 'guide') && <text x={6} y={h - 5} className="dp-axis">{`${ROOMS[focus]!.kind} · free form`}</text>}
    </>}
    {set && handles >= 1 && <Handle n={1} shape="ring" x={clampTo(6, w - 6, f.X(d1.x))} y={clampTo(6, h - bottom, f.Y(d1.y))} label="You" does="Drag to a room: you stand in it."
      onDrag={(x, y) => enter(v, set, nearest(x, y))} onReset={() => set('at', 0)} />}
    {set && handles === 2 && !floor && <Handle n={2} x={clampTo(6, w - 6, f.X(c2.x + RW / 2))} y={clampTo(6, h - bottom, f.Y(c2.y + RH / 2))} label="Room" does="Drag: place the room on the board. The position is presentation."
      onDrag={(x, y) => {
        const q = {x: clampTo(ROOM_AT.x[0], ROOM_AT.x[1], f.bx(x) - RW / 2), y: clampTo(ROOM_AT.y[0], ROOM_AT.y[1], f.by(y) - RH / 2)}, r = snapping ? snap(q) : q
        commit(v, set, {[`x${focus}`]: Math.round(r.x), [`y${focus}`]: Math.round(r.y)})
      }}
      onReset={() => commit(v, set, {[`x${focus}`]: home(focus).x, [`y${focus}`]: home(focus).y})} />}
  </>
}

function PlanWell({v, set, w, h, handles, text = true, names = false}: {v: V; set?: SetFn; w: number; h: number; handles: 0 | 1 | 2; text?: boolean; names?: boolean}) {
  return <Display w={w} h={h} label="The palace" corner={`${at(v) + 1}/${order(v).length}`}
    does={`The rooms${loci(v) ? ' on the fixed floor' : ' on the board'}, the path between their doors, and the room you stand in. Press a room to stand in it. Drag handle 1 to a room${handles === 2 ? '; drag handle 2 to place the room' : ''}.`}>
    <Plan v={v} set={set} w={w} h={h} handles={handles} text={text} names={names} />
  </Display>
}

// ---------------------------------------------------------------- the pane: the palace at full size

const PANE = {w: 760, h: 420}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const ink = (size: number, fill: string) => ({font: `${size}px var(--font-ui, sans-serif)`, fill})

function Floor({v}: {v: V}) {
  const floor = loci(v), guided = str(v, 'path') === 'guided', focus = here(v), ord = order(v)
  const pts = ROOMS.map((_, i) => placed(v, i))
  const L = Math.min(...pts.map(p => p.x)) - 30, R = Math.max(...pts.map(p => p.x)) + RW + 30, T = Math.min(...pts.map(p => p.y)) - 24, B = Math.max(...pts.map(p => p.y)) + RH + 24
  const area = {x: 14, y: 30, w: PANE.w - 28, h: 326}, s = Math.min(area.w / (R - L), area.h / (B - T))
  const X = (x: number) => area.x + (area.w - (R - L) * s) / 2 + (x - L) * s, Y = (y: number) => area.y + (area.h - (B - T) * s) / 2 + (y - T) * s
  const u = (n: number) => n * s
  const state = str(v, 'proposal'), route = str(v, 'route')
  const returned = state === 'routed' ? `Return proposed to ${route}: it waits for you.` : state === 'unrouted' ? 'Return: the reading names no route. Nothing was sent.'
    : state === 'accepted' ? `Return sent to ${route}. The owner decides.` : state === 'refused' ? 'Return refused. Nothing was sent.' : 'Return: nothing proposed.'
  const room = ROOMS[focus]!
  return <g>
    <text x={14} y={20} style={ink(11.5, 'var(--text)')}>{`Central — wiki local whole · ${ord.length} rooms · ${floor ? 'fixed floor' : 'board'} · ${guided ? `walk ${at(v) + 1}/${ord.length}` : 'free'}`}</text>
    <text x={PANE.w - 14} y={20} textAnchor="end" style={ink(10.5, state === 'unrouted' ? 'var(--stall)' : 'var(--text-dim)')}>{returned}</text>
    {on(v, 'lines') && edges(v).map(e => {
      const a = door(placed(v, e.from)), b = door(placed(v, e.to))
      return <path key={`${e.from}:${e.to}`} d={`M${X(a.x)} ${Y(a.y)}L${X(b.x)} ${Y(b.y)}`} className="dp-faint"
        style={e.broken ? {stroke: 'var(--stall)', strokeDasharray: '4 3', strokeWidth: 1.4} : {strokeDasharray: '5 4'}} />
    })}
    {ROOMS.map((r, i) => {
      const p = placed(v, i), x = X(p.x), y = Y(p.y), rw = u(RW), rh = u(RH)
      const under = !!r.private && hidden(v), focused = i === focus && !under, mark = marks(v).find(m => m.room === i)
      return <g key={r.key} data-i={`${r.name}|${under ? 'A private room. It stays under cloud for this audience.' : WORDS[r.kind]}`}>
        <rect x={x} y={y} width={rw} height={rh} rx={3} style={{fill: focused ? 'color-mix(in srgb, var(--dp-on) 9%, var(--dp-well))' : 'color-mix(in srgb, var(--text) 4%, var(--dp-well))',
          stroke: focused ? (guided ? 'var(--dp-on)' : 'var(--dp-value)') : 'color-mix(in srgb, var(--text) 24%, transparent)', strokeWidth: focused ? 2 : 1, strokeDasharray: under ? '4 3' : undefined}} />
        <text x={x + u(10)} y={y + u(24)} style={ink(10, under ? 'var(--text-faint)' : 'var(--text)')}>{clip(under ? 'Private room' : r.name, 24)}</text>
        {under && cloud(x + rw / 2, y + rh / 2 + 4, 2.4)}
        {!under && !floor && r.members.slice(0, 4).map((m, k) => <g key={m}>
          <rect x={x + u(10)} y={y + u(36) + k * u(24)} width={rw - u(20)} height={u(19)} style={{fill: 'color-mix(in srgb, var(--text) 8%, transparent)'}} />
          <text x={x + u(18)} y={y + u(49) + k * u(24)} style={ink(9, 'var(--text-dim)')}>{clip(m, 24)}</text>
        </g>)}
        {!under && !floor && r.more > 0 && <text x={x + u(10)} y={y + rh - u(8)} style={ink(8.5, 'var(--text-faint)')}>{`+${r.more} more`}</text>}
        {!under && floor && [0, 1, 2, 3].map(k => <g key={k}>
          <rect x={x + u(10) + (k % 2) * u(104)} y={y + u(38) + Math.floor(k / 2) * u(56)} width={u(96)} height={u(48)} style={{fill: 'none', stroke: 'color-mix(in srgb, var(--text) 24%, transparent)'}} />
          <text x={x + u(16) + (k % 2) * u(104)} y={y + u(66) + Math.floor(k / 2) * u(56)} style={ink(8.5, k < r.members.length ? 'var(--text-dim)' : 'var(--text-faint)')}>{k < r.members.length ? clip(r.members[k]!, 12) : '—'}</text>
        </g>)}
        {!under && floor && r.more > 0 && <text x={x + rw - u(10)} y={y + u(24)} textAnchor="end" style={ink(8.5, 'var(--text-faint)')}>{`+${r.more}`}</text>}
        {r.holds && !under && !floor && <text x={x + u(10)} y={y + u(49)} style={ink(9, on(v, 'gone') ? 'var(--stall)' : 'var(--text-dim)')}>{`→ ${clip(r.holds, 21)}`}</text>}
        {r.holds && !under && <g>
          <rect x={x + rw - 4} y={y + rh * .36} width={8} height={rh * .3} rx={1} style={{fill: on(v, 'gone') ? 'var(--stall)' : 'var(--dp-value)'}} />
          {on(v, 'gone') && <text x={x + rw - u(10)} y={y + u(24)} textAnchor="end" style={ink(8.5, 'var(--stall)')}>gone</text>}
        </g>}
        {r.kind === 'region' && !r.holds && !under && !floor && <text x={x + u(10)} y={y + u(49)} style={ink(9, 'var(--text-faint)')}>no Expression yet</text>}
        {!under && !floor && r.more === 0 && <text x={x + u(10)} y={y + rh - u(8)} style={ink(8, 'var(--text-faint)')}>{`${r.kind} · free form`}</text>}
        {mark && !under && <g data-i={`Bookmark · ${mark.name}|The walk and the board are kept here.`}><path d={`M${x + rw - 11} ${y}L${x + rw - 2} ${y}L${x + rw - 2} ${y + 13}L${x + rw - 6.5} ${y + 9}L${x + rw - 11} ${y + 13}Z`} style={{fill: 'var(--sel)'}} /></g>}
      </g>
    })}
    {ord.map((i, k) => {
      if (!guided) return null
      const d = door(placed(v, i)), on_ = i === focus
      return <g key={i}>
        <circle cx={X(d.x)} cy={Y(d.y)} r={8.5} style={{fill: on_ ? 'var(--dp-on)' : 'var(--dp-well)', stroke: on_ ? 'var(--dp-on)' : 'color-mix(in srgb, var(--text) 40%, transparent)'}} />
        <text x={X(d.x)} y={Y(d.y) + 3.4} textAnchor="middle" style={{font: '700 9.5px var(--font-ui, sans-serif)', fill: on_ ? 'var(--dp-on-text)' : 'var(--text-dim)'}}>{k + 1}</text>
      </g>
    })}
    {on(v, 'guide') && <g>
      <text x={14} y={380} style={ink(10.5, 'var(--text)')}>{`${room.name} — ${WORDS[room.kind]}`}</text>
      <text x={14} y={396} style={ink(10, 'var(--text-dim)')}>{`Its form: ${FORM}.`}</text>
    </g>}
  </g>
}

// ---------------------------------------------------------------- the controls, each in one place

const light = (v: V) => str(v, 'light') as LightState
const span = (n: number, node: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{node}</div>

const roomDial = (p: ViewProps) => <Dial label="Room" does="Puts you in a room. Turn it to walk the rooms in order." value={at(p.v)} def={0}
  scale={{min: 0, max: Math.max(1, order(p.v).length - 1), step: 1}} format={k => `${k + 1}/${order(p.v).length}`} onChange={k => p.set('at', k)} />
const roomChooser = (p: ViewProps) => <Chooser label="Room" does="Puts you in a room. The picture marks it with a ring." value={String(at(p.v))}
  options={order(p.v).map((room, k) => ({value: String(k), label: `${k + 1} · ${ROOMS[room]!.short}`}))} onChange={x => p.set('at', Number(x))} />
const pathRadio = (p: ViewProps) => <Radio label="Path" does="Guided numbers the rooms and marks your room. Free shows neither: you enter any room." value={str(p.v, 'path')}
  options={[{value: 'guided', label: 'Guided'}, {value: 'free', label: 'Free'}]} stack onChange={x => p.set('path', x)} />
const guideToggle = (p: ViewProps) => <Toggle label="Guide" does="The guide says why the room you stand in is there, and the form it rests on." on={on(p.v, 'guide')} onChange={x => p.set('guide', x)} />
const orderRadio = (p: ViewProps) => <Radio label="Order" does="Authored walks the rooms in the order of the path. Spatial walks the board left to right, row by row."
  value={str(p.v, 'order')} options={[{value: 'authored', label: 'Authored'}, {value: 'spatial', label: 'Spatial'}]} stack
  disabled={loci(p.v) ? 'The fixed floor is already in order.' : undefined} onChange={x => commit(p.v, p.set, {order: x})} />
const floorRadio = (p: ViewProps) => <Radio label="Floor" does="The free board, or the fixed floor of six rooms with four places in each: the method of loci." value={str(p.v, 'floor')}
  options={[{value: 'board', label: 'Board'}, {value: 'loci', label: 'Loci'}]} stack onChange={x => commit(p.v, p.set, {floor: x})} />
const audienceRadio = (p: ViewProps) => <Radio label="Audience" does="Shows the palace as that audience sees it. A private room stays under cloud for Field and Public."
  value={str(p.v, 'audience')} options={[{value: 'me', label: 'Me'}, {value: 'field', label: 'Field'}, {value: 'public', label: 'Public'}]} stack
  onChange={x => commit(p.v, p.set, {audience: x})} />
const snapToggle = (p: ViewProps) => <Toggle label="Snap" does="Aligns a dragged room to the grid. The position stays presentation."
  on={on(p.v, 'snap')} disabled={loci(p.v) ? 'The fixed floor has no free rooms to place.' : undefined} onChange={x => p.set('snap', x)} />
const linesToggle = (p: ViewProps) => <Toggle label="Lines" does="Draws a line from each room to the next on the walk. A door to a gone palace draws as broken."
  on={on(p.v, 'lines')} onChange={x => p.set('lines', x)} />

const walkTo = (p: ViewProps, k: number) => p.set('at', ((k % order(p.v).length) + order(p.v).length) % order(p.v).length)
const start = (p: ViewProps) => <Action label="Start" does="Goes to the first room of the path." onPress={() => p.set('at', 0)} />
const back = (p: ViewProps) => <Action label="‹ Back" does="Goes to the room before this one. The walk wraps at the start." onPress={() => walkTo(p, at(p.v) - 1)} />
const next = (p: ViewProps) => <Action label="Next ›" does="Goes to the room after this one. The walk wraps at the end." onPress={() => walkTo(p, at(p.v) + 1)} />

const bookmarkChooser = (p: ViewProps) => <Chooser label="Bookmark" does="Jumps to a saved position. It shows the bookmark of the room you stand in."
  value={markHere(p.v)?.name ?? ''} options={[{value: '', label: 'None'}, ...marks(p.v).map(m => ({value: m.name, label: m.name}))]}
  disabled={marks(p.v).length ? undefined : 'Keep a position first.'}
  onChange={x => { const m = marks(p.v).find(candidate => candidate.name === x); if (m) enter(p.v, p.set, m.room) }} />
const markName = (p: ViewProps) => <TextField label="Name" does="Names the position you stand in. Press Enter to set the name." value={str(p.v, 'draft')} placeholder="Name it" onChange={x => p.set('draft', x)} />
const keepMark = (p: ViewProps) => <Action label="Keep" does="Saves the room you stand in under the name. One bookmark for each room."
  disabled={!str(p.v, 'draft').trim() ? 'Type a name first.' : markHere(p.v) ? 'This room has a bookmark.' : undefined}
  onPress={() => {
    const name = str(p.v, 'draft').trim().replace(/[;~]/g, ' ')
    p.set('bookmarks', [...str(p.v, 'bookmarks').split(';').filter(Boolean), `${name}~${ROOMS[here(p.v)]!.key}`].join(';')); p.set('draft', '')
  }} />

const propose = (p: ViewProps, label = 'Propose') => <Action label={label} does="Shapes the objects, in the order you arranged them, as a proposal with your name. Nothing is written."
  refused={str(p.v, 'proposal') === 'unrouted' ? 'The reading names no route. Nothing was sent.' : undefined}
  onPress={() => p.set('proposal', str(p.v, 'route') ? 'routed' : 'unrouted')} />
const accept = (p: ViewProps) => <Action label="Accept" does="Sends the proposal to its route. The owner of the sources decides."
  disabled={str(p.v, 'proposal') === 'routed' ? undefined : 'Propose first. The reading must name a route.'} onPress={() => p.set('proposal', 'accepted')} />
const refuse = (p: ViewProps) => <Action label="Refuse" does="Sets the proposal aside. Nothing is sent."
  disabled={str(p.v, 'proposal') === 'routed' ? undefined : 'No proposal waits.'} onPress={() => p.set('proposal', 'refused')} />

const head = (p: ViewProps) => ({light: light(p.v), onFold: p.nav.fold, onFull: p.nav.full})

export const design: DesignedDevice = {
  id: 'techne:palace',
  title: 'Palace',
  kind: 'instrument',
  defaults: {
    light: 'lit', palace: 'Central',
    floor: 'board', path: 'guided', order: 'authored', guide: true, snap: false, lines: true, audience: 'me',
    at: 0, draft: '', bookmarks: 'Start of the argument~overview',
    // The board's held points: ai-kit and personal were swapped by hand; the rest stand where the board puts them.
    x0: 100, y0: 100, x1: 400, y1: 100, x2: 700, y2: 100, x3: 400, y3: 400, x4: 100, y4: 400, x5: 700, y5: 400,
    // Readings: what the owner reports, never set from here. The wiki reading names no governed-write route (wikiReadingProvider.ts:140).
    route: '', proposal: 'none', gone: false,
  },
  fixtures: {
    'The Central palace': {},
    'A routed Return': {route: 'aikit.wiki.stage', proposal: 'routed', at: 3},
    'The fixed floor': {floor: 'loci', at: 2, gone: true},
  },

  folded: p => <Folded title="Palace" light={light(p.v)} readings={[str(p.v, 'palace'), ROOMS[here(p.v)]!.short]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Palace" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><PlanWell v={p.v} set={p.set} w={140} h={146} handles={1} /></Section>
    <Section label="Macros" cols={2}>
      {roomDial(p)}{pathRadio(p)}{guideToggle(p)}{propose(p, 'Return')}
    </Section>
  </Panel>,

  whole: p => <Panel title="Palace" view="whole" {...head(p)}>
    <Band>
      <Section width={206}><PlanWell v={p.v} set={p.set} w={194} h={146} handles={2} names /></Section>
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
        <Readout label="kept" does="The positions you saved." value={marks(p.v).length} />
      </Section>
      <Section label="Return" cols={3} grow>
        {span(3, <Readout label="route" does="Where the reading sends a Return. The first governed route it names." value={str(p.v, 'route') || '—'} />)}
        {propose(p)}{accept(p)}{refuse(p)}
        <Readout label="return" does="The state of the Return." value={RETURN_WORDS[str(p.v, 'proposal')] ?? '—'} tone={str(p.v, 'proposal') === 'unrouted' ? 'stall' : undefined} />
        <Action label="Leave" does="Leaves the palace for the Earth." onPress={() => {}} />
      </Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox={`0 0 ${PANE.w} ${PANE.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The palace">
      <g className="dp-display" style={{background: 'none'}}><Floor v={p.v} /></g>
    </svg>
  </div>,

  widget: p => <Tile title={`Palace · ${str(p.v, 'palace')}`} light={light(p.v)} span={2} onFull={p.nav.full}>
    <PlanWell v={p.v} set={p.set} w={112} h={104} handles={0} text={false} />
    <div className="ref-tile-counts">
      <Readout big label="room" does="The room you stand in, of the rooms in the walk. Press for the next room." value={`${at(p.v) + 1}/${order(p.v).length}`} onPress={() => walkTo(p, at(p.v) + 1)} />
      <Readout big label="kept" does="Saved positions. Press to jump to the first." value={marks(p.v).length} tone="value"
        onPress={() => { const m = marks(p.v)[0]; if (m) enter(p.v, p.set, m.room) }} />
      <Readout big label="return" does="The state of the Return. Wait: proposed. Void: the reading names no route. Sent: the owner has it." value={RETURN_SHORT[str(p.v, 'proposal')] ?? '—'} tone="accent" />
    </div>
  </Tile>,
}
