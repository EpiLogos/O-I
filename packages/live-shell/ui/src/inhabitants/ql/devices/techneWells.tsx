// The live picture at the heart of each Technē instrument (ProjectCentral/docs/1-vision/dlw/DLW.md §16.9 "The picture comes first"; §7 the display: "Draw every
// mark from the device's values or readings, by the device's own law. Do not draw a likely picture. When a reading is missing, say which
// one in the well"), one well per instrument, drawn at any size: the Compact's on the rack (techneCompacts.tsx) and the open plate's display
// section (ProjectPlate.tsx, StageInstrumentPlate.tsx, PlacesPlate.tsx, PalacePlate.tsx). Each reads only what its owner reports:
//   the Project and World: the Earth — the mounted atlas's own state, drawn by the globe's own geometry: the body as the camera sees it (the camera's
//          axes, globe/engine.ts camera), its lit side from the sky's Sun (sky/layer.ts sunDir, as globe/engine.ts lights it), and every
//          located occurrence where the globe stands it (data/model.ts `dir`, `located`, `colour`) at the presence the deep-time clock
//          gives it (data/time.ts timeVisibility, the law the globe's shader runs); on its Graph side, the graph's own picture (graph/
//          view.ts draws it to its canvas; the well shows that canvas, scaled);
//   the Canvas — the frame's published zoom (presentedChrome.ts canvas:look) as the part of the board the pane shows, its Snap as the
//          grid, and the frame's selection (hostedApp.ts HostedAppState.selection); the board's items are not published, and the well
//          says so;
//   the Timeline — the ruler with the shared window's two edges (techne/session.ts time_window), the lens the frame stands in;
//   the Journey — the walk's stops as cells, the one it stands on lit (HostedAppState sceneIndex, sceneCount, sceneName,
//          journeyPlaying);
//   the Palace — the floor: the rooms where the board stands them, in path order, the path between their doors and the room the walk
//          stands in (palacesModel.ts floorRooms, floorBounds — the floor's own law, PalaceFloor.tsx).
// The picture moves only when its readings move: the atlas's own notices, the frame's announcements, the palace's session, and the camera
// read again only while it turns.
import {useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react'
import {Display} from '../../sdk/panel'
import {useAtlasHandle, useAtlasSun, useAtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
import type {AtlasHandle} from '../../../projections/atlas/mount'
import {atlasScale, subscribeAtlasScale} from '../../../projections/atlas/places/placesHost'
import {timeVisibility} from '../../../projections/atlas/src/data/time'
import {windowEdgeYear} from '../../../projections/atlas/sharedClock'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import {controlsAt, useFrameChrome, type FrameChromeView} from '../../../components/expressions/studio/frameChrome'
import {useHostedChrome} from '../../../projections/expressionsPaneHost'
import {focusedRoom, inside, palaceState, roomsNow, subscribePalace, walkOf} from '../../../projections/atlas/palaces/palaceSession'
import {floorBounds, floorRooms, ROOM_SIZE} from '../../../projections/atlas/palaces/palacesModel'
import {usePalaces} from '../../../projections/atlas/palaces/palacesWorld'

/** What a well draws: its picture, its one short reading at the top right, and what it shows (the status bar's words). */
export interface Well {
  readonly picture: ReactNode
  readonly corner?: string
  readonly label: string
}

/** The size a well is drawn at, in its own pixels. */
export interface WellSize {readonly w: number; readonly h: number}

/** Words in the well where a reading is missing (manual §16.12 "say which one in the well"), centred, a line each. */
export function Missing({lines, w, h}: {lines: readonly string[]; w: number; h: number}) {
  return <>{lines.map((line, index) => <text key={`${index}:${line}`} x={w / 2} y={h / 2 - (lines.length - 1) * 6 + index * 12} textAnchor="middle" className="dp-ink-dim">{line}</text>)}</>
}

const NOT_MOUNTED_LINES = ['the Earth', 'not mounted']

/** The mounted atlas, re-read on its own notices: the clock's and the controller's (the graph's controls, its first opening, the scope). */
export function useAtlasLive(): AtlasHandle | null {
  const handle = useAtlasHandle()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!handle) return
    const bump = () => setTick(n => n + 1)
    const offClock = handle.time.subscribe(bump)
    const offFaces = handle.ctl.subscribeFaces(bump)
    return () => { offClock(); offFaces() }
  }, [handle])
  return handle
}

// ── the Earth: the body as the camera sees it ──────────────────────────────────────────────────────────────────────────────────

/** The camera's axes, read again only while the camera moves (a light poll: the globe announces no camera notice). */
function useCameraAxes(handle: AtlasHandle | null): readonly number[] | null {
  const [axes, setAxes] = useState<readonly number[] | null>(null)
  useEffect(() => {
    if (!handle) { setAxes(null); return }
    let last = ''
    const read = () => {
      const camera = handle.engine.camera
      const e = camera.matrixWorld.elements
      const next = [e[0]!, e[1]!, e[2]!, e[4]!, e[5]!, e[6]!, e[8]!, e[9]!, e[10]!]
      const key = next.map(x => x.toFixed(3)).join(',')
      if (key !== last) { last = key; setAxes(next) }
    }
    read()
    const timer = setInterval(read, 250)
    return () => clearInterval(timer)
  }, [handle])
  return axes
}

/** The most located occurrences drawn in one well: past this the well draws every n-th, in the field's own order. */
const MOST_POINTS = 1500

/** The Earth as the pane looks at it: the disc, its lit side, and the located occurrences at their presence. */
export function useEarthWell(handle: AtlasHandle | null, {w, h}: WellSize): Well {
  const axes = useCameraAxes(handle)
  const sun = useAtlasSun()
  const scale = useSyncExternalStore(subscribeAtlasScale, atlasScale, atlasScale)
  const clock = handle?.time
  // the clock's own notices re-render this well through useAtlasLive's tick; the window it reads is the clock's now
  const windowKey = clock ? `${clock.mode}:${clock.cursorU.toFixed(4)}:${clock.on.toFixed(3)}:${clock.trail.toFixed(3)}` : ''
  const label = 'The Earth as the pane looks at it: its lit side from the sky\'s Sun, and each located occurrence where the globe stands it, at the presence the deep-time clock gives it.'
  const points = useMemo(() => {
    if (!handle || !axes) return null
    const {model} = handle
    const [rx, ry, rz, ux, uy, uz, zx, zy, zz] = axes as [number, number, number, number, number, number, number, number, number]
    const located: number[] = []
    for (let i = 0; i < model.occ.length; i++) if (model.located[i]) located.push(i)
    const stride = Math.max(1, Math.ceil(located.length / MOST_POINTS))
    const out: {x: number; y: number; vis: number; colour: string}[] = []
    const window = handle.time.window
    for (let k = 0; k < located.length; k += stride) {
      const i = located[k]!
      const d = model.dir[i]!
      const facing = d[0] * zx + d[1] * zy + d[2] * zz
      if (facing <= 0) continue
      const vis = timeVisibility(model.u[i]!, window)
      if (vis < 0.05) continue
      const c = model.colour[i] ?? [0.8, 0.8, 0.8]
      out.push({x: d[0] * rx + d[1] * ry + d[2] * rz, y: -(d[0] * ux + d[1] * uy + d[2] * uz), vis, colour: `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`})
    }
    return {out, total: located.length}
    // windowKey: the clock's window, read from the handle
  }, [handle, axes, windowKey])
  if (!handle) return {picture: <Missing lines={NOT_MOUNTED_LINES} w={w} h={h} />, label}
  const r = Math.min(w, h) / 2 - 9, cx = w / 2, cy = h / 2 + 3
  const sky = handle.engine.sky
  let phase: ReactNode = null
  if (axes && sky?.sunKnown) {
    const [rx, ry, rz, ux, uy, uz, zx, zy, zz] = axes as [number, number, number, number, number, number, number, number, number]
    const s = sky.sunDir
    const right = s.x * rx + s.y * ry + s.z * rz, up = s.x * ux + s.y * uy + s.z * uz, toward = s.x * zx + s.y * zy + s.z * zz
    const angle = (Math.atan2(-up, right) * 180) / Math.PI
    // the lit half toward the Sun, closed by the terminator: an ellipse whose width is the phase (globe/engine.ts lights the body so)
    phase = <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <path d={`M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r} A${Math.abs(toward) * r} ${r} 0 0 ${toward > 0 ? 1 : 0} ${cx} ${cy - r}Z`} className="dp-fill" />
    </g>
  }
  const picture = <>
    <circle cx={cx} cy={cy} r={r} className="dp-faint" />
    {phase}
    {points?.out.map((p, index) => <circle key={index} cx={cx + p.x * r} cy={cy + p.y * r} r={1.1} fill={p.colour} opacity={0.35 + 0.65 * p.vis} />)}
    {!sky?.sunKnown && <text x={4} y={h - 5} className="dp-axis">{sun?.placed ? 'sky not loaded' : 'no Sun placed'}</text>}
    {points && !points.total && <text x={4} y={12} className="dp-axis">no place located</text>}
  </>
  return {picture, corner: scale ?? undefined, label}
}

// ── the Earth's Graph side: the graph's own picture ───────────────────────────────────────────────────────────────────────────

/** The graph's own canvas, drawn into the well while the graph is shown: copied again while it moves, so the well is the graph. */
function GraphCopy({handle, w, h}: {handle: AtlasHandle; w: number; h: number}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const target = ref.current
    if (!target) return
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    target.width = Math.round(w * dpr)
    target.height = Math.round(h * dpr)
    const copy = () => {
      const graph = handle.ctl.graphControls
      const source = graph?.root.querySelector('canvas')
      const context = target.getContext('2d')
      if (!graph || !source || !context || !source.width || !source.height) return
      const k = Math.min(target.width / source.width, target.height / source.height)
      const dw = source.width * k, dh = source.height * k
      context.clearRect(0, 0, target.width, target.height)
      context.drawImage(source, (target.width - dw) / 2, (target.height - dh) / 2, dw, dh)
    }
    copy()
    // the graph draws on its own frames while its layout settles and while it is moved: the copy follows at a few frames a second, and
    // only while the graph is shown
    const timer = setInterval(() => { if (handle.ctl.graphControls?.isVisible) copy() }, 400)
    return () => clearInterval(timer)
  }, [handle, w, h])
  return <canvas ref={ref} style={{width: w, height: h, display: 'block'}} aria-hidden="true" />
}

export function useGraphWell(handle: AtlasHandle | null, {w, h}: WellSize): Well & {raw?: boolean} {
  const graph = handle?.ctl.graphControls ?? null
  const label = 'The graph as the pane draws it: the same material laid out by connection.'
  if (!handle) return {picture: <Missing lines={NOT_MOUNTED_LINES} w={w} h={h} />, label}
  if (!graph) return {picture: <Missing lines={['graph not', 'opened yet']} w={w} h={h} />, label}
  const c = graph.controls()
  const stats = graph.stats
  return {raw: true, picture: <GraphCopy handle={handle} w={w - 2} h={h - 2} />, label,
    corner: c.local ? `${c.depth} step${c.depth === 1 ? '' : 's'} · ${stats.nodes}` : `whole · ${stats.nodes}`}
}

/** The Project: the Earth, or its Graph side, as the atlas stands. */
export function useProjectWell(size: WellSize): Well & {raw?: boolean} {
  const handle = useAtlasLive()
  const view = useAtlasView()
  const earth = useEarthWell(view === 'earth' ? handle : null, size)
  const graph = useGraphWell(view === 'graph' ? handle : null, size)
  if (!handle) return earth
  return view === 'graph' ? graph : earth
}

/** World: the Earth. */
export function useWorldWell(size: WellSize): Well {
  const handle = useAtlasLive()
  return useEarthWell(handle, size)
}

// ── the stage's instruments: read from the frame's published state while the stage stands in their lens ──────────────────────────

/** Why a stage instrument's well has nothing of its own to draw: no frame, or the frame in another lens. */
export function stageWhy(view: FrameChromeView, lens: string): string | undefined {
  if (!view.reading) return view.reason ?? 'The stage has not reported its controls yet.'
  return view.reading.lens === lens ? view.reason ?? undefined : `The stage stands in its ${view.reading.lens} lens: open this instrument on the focused pane to play it.`
}

const elsewhereLines = (view: FrameChromeView): string[] => (view.reading ? ['the stage is', `in ${view.reading.lens} lens`] : ['no stage', 'reported yet'])

/** The Canvas: the board — the part the pane shows at the frame's zoom, the grid when Snap is on, the selection; the items are not published. */
export function useCanvasWell({w, h}: WellSize): Well {
  const view = useFrameChrome()
  const state = useHostedChrome()?.state ?? null
  const why = stageWhy(view, 'canvas')
  const label = 'The board: the part the pane shows at its zoom, the grid while Snap is on, and what is selected. The board\'s items are not published to the shell.'
  if (why && !(view.reading?.lens === 'canvas')) return {picture: <Missing lines={elsewhereLines(view)} w={w} h={h} />, label}
  const zoom = controlsAt(view.reading, 'canvas:look').find(control => control.kind === 'reading' && /%$/.test(control.label))
  const snap = controlsAt(view.reading, 'canvas:tools').find(control => control.label === 'Snap')
  const z = zoom ? Number.parseFloat(zoom.label) : NaN
  const pad = 8, bw = w - 2 * pad, bh = h - 2 * pad - 14
  const side = Number.isFinite(z) && z > 0 ? Math.min(1, 100 / z) : null
  const grid: [number, number][] = []
  if (snap?.pressed) for (let gx = pad + bw / 8; gx < pad + bw; gx += bw / 8) for (let gy = pad + bh / 6; gy < pad + bh; gy += bh / 6) grid.push([gx, gy])
  const selected = state?.selection ?? []
  const picture = <>
    <rect x={pad} y={pad} width={bw} height={bh} className="dp-faint" />
    {grid.map(([gx, gy]) => <circle key={`${gx}:${gy}`} cx={gx} cy={gy} r={0.8} fill="var(--text-faint)" />)}
    {side !== null
      ? <><rect x={w / 2 - (bw * side) / 2} y={pad + bh / 2 - (bh * side) / 2} width={bw * side} height={bh * side} className="dp-curve-on" />
          <rect x={w / 2 - (bw * side) / 2} y={pad + bh / 2 - (bh * side) / 2} width={bw * side} height={bh * side} className="dp-fill-on" /></>
      : <text x={w / 2} y={pad + bh / 2} textAnchor="middle" className="dp-ink-dim">zoom not published</text>}
    <text x={pad} y={h - 6} className="dp-axis">{selected.length ? `${selected.length} selected · ${selected[0]?.name ?? selected[0]?.id ?? ''}`.slice(0, 30) : 'items not published'}</text>
  </>
  return {picture, corner: zoom?.label, label}
}

function useWindowEdges(): {from: number | null; to: number | null} | null {
  const window = useSyncExternalStore(disclosureSession.subscribe, () => disclosureSession.get()?.time_window ?? null, () => null)
  return window ? {from: windowEdgeYear(window.from), to: windowEdgeYear(window.to)} : null
}

/** The shared window in words: its two edges, or all time. */
export function useWindowWords(): string {
  const edges = useWindowEdges()
  return edges ? `${edges.from ?? '…'} – ${edges.to ?? '…'}` : 'all time'
}

/** The Timeline: the ruler with the window you read over — its two edges, or all time — and the lens the frame stands in. */
export function useTimelineWell({w, h}: WellSize): Well {
  const view = useFrameChrome()
  const edges = useWindowEdges()
  const lit = view.reading?.lens === 'timeline' ? controlsAt(view.reading, 'timeline:lens').find(control => control.kind === 'toggle' && control.pressed) : undefined
  const label = 'The ruler and the window you read over: its two edges, or all time. The shared window is the one the transport\'s punch-in and punch-out read; the events are not published to the shell.'
  const pad = 9, axis = h - 34, x0 = edges ? pad + (w - 2 * pad) * 0.25 : pad, x1 = edges ? w - pad - (w - 2 * pad) * 0.25 : w - pad
  const ticks = Array.from({length: 9}, (_, i) => pad + (i * (w - 2 * pad)) / 8)
  const picture = <>
    <line x1={pad} y1={axis} x2={w - pad} y2={axis} className="dp-faint" />
    {ticks.map(x => <line key={x} x1={x} y1={axis - 3} x2={x} y2={axis + 3} className="dp-faint" />)}
    <rect x={x0} y={axis - 16} width={x1 - x0} height={12} className="dp-fill" />
    <line x1={x0} y1={axis - 10} x2={x1} y2={axis - 10} className="dp-curve" />
    {edges ? <><text x={x0} y={axis + 15} textAnchor="middle" className="dp-axis">{edges.from ?? '…'}</text><text x={x1} y={axis + 15} textAnchor="middle" className="dp-axis">{edges.to ?? '…'}</text></>
      : <text x={w / 2} y={axis + 15} textAnchor="middle" className="dp-axis">all time</text>}
    <text x={pad} y={h - 5} className="dp-axis">events not published</text>
  </>
  return {picture, corner: lit?.short ?? lit?.label ?? (view.reading?.lens === 'timeline' ? undefined : view.reading ? `${view.reading.lens} lens` : undefined), label}
}

/** The Journey: the walk's stops as cells in order, the one it stands on lit, a mark while it walks. */
export function useJourneyWell({w, h}: WellSize): Well {
  const state = useHostedChrome()?.state ?? null
  const label = 'The walk: its stops in order, the one it stands on lit; ▶ while it walks.'
  const count = state?.sceneCount, at = state?.sceneIndex
  if (!state || count === undefined || at === undefined) return {picture: <Missing lines={['no walk', 'reported yet']} w={w} h={h} />, label}
  if (!count) return {picture: <Missing lines={['the walk', 'has no stop']} w={w} h={h} />, label, corner: '0'}
  const pad = 8, perRow = Math.min(count, 8), rows = Math.ceil(count / perRow)
  const cw = (w - 2 * pad) / perRow, ch = Math.min(22, (h - 2 * pad - 20) / rows)
  const picture = <>
    {Array.from({length: count}, (_, index) => {
      const x = pad + (index % perRow) * cw, y = pad + 12 + Math.floor(index / perRow) * (ch + 4)
      return <rect key={index} x={x + 1} y={y} width={cw - 2} height={ch} className={index === at ? 'dp-curve-on' : 'dp-faint'} style={index === at ? {fill: 'color-mix(in srgb, var(--dp-on) 22%, transparent)'} : undefined} />
    })}
    {count > 1 && <path d={`M${pad + cw / 2} ${pad + 6}H${pad + (Math.min(count, perRow) - 0.5) * cw}`} className="dp-faint" strokeDasharray="2 3" />}
    {state.journeyPlaying && <text x={pad} y={pad + 6} className="dp-ink">▶</text>}
    {state.sceneName && <text x={pad} y={h - 6} className="dp-axis">{state.sceneName.slice(0, 26)}</text>}
  </>
  return {picture, corner: `${at + 1}/${count}`, label}
}

// ── the Palace: the floor ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Palace: the floor — the rooms where the board stands them, the path between their doors, the room the walk stands in. */
export function usePalaceWell({w, h}: WellSize): Well {
  const state = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  const {rows} = usePalaces()
  const here = state.phase === 'inside' ? inside() : null
  const label = 'The floor: the rooms where the board stands them, the path between their doors, the room the walk stands in.'
  if (!here) return {picture: <Missing lines={state.phase === 'entering' ? ['entering…'] : rows.length ? ['no palace', 'entered'] : ['no palace', 'read yet']} w={w} h={h} />,
    corner: rows.length ? `${rows.length}` : undefined, label}
  const rooms = roomsNow(here)
  const guided = here.path === 'guided'
  const focus = guided ? focusedRoom(here) : null
  const floor = floorRooms(rooms, here.held, focus, here.selected)
  if (!floor.length) return {picture: <Missing lines={['the palace', 'has no room']} w={w} h={h} />, label}
  const bounds = floorBounds(floor)
  const k = Math.min((w - 8) / bounds.width, (h - 8) / bounds.height)
  const ox = (w - bounds.width * k) / 2 - bounds.x * k, oy = (h - bounds.height * k) / 2 - bounds.y * k
  const X = (x: number) => ox + x * k, Y = (y: number) => oy + y * k
  // the path runs between the rooms' doors, each room's lower inner corner (PalaceFloor.tsx `door`)
  const door = (room: {x: number; y: number}) => ({x: X(room.x + ROOM_SIZE.width - 14), y: Y(room.y + ROOM_SIZE.height - 14)})
  const {index, steps} = walkOf(here)
  const picture = <>
    {guided && floor.length > 1 && <polyline points={floor.map(room => { const p = door(room); return `${p.x},${p.y}` }).join(' ')} className="dp-curve" strokeDasharray="3 2" />}
    {floor.map((room, at) => <g key={room.room.key}>
      <rect x={X(room.x)} y={Y(room.y)} width={ROOM_SIZE.width * k} height={ROOM_SIZE.height * k} className={room.focused ? 'dp-curve-on' : 'dp-faint'} />
      {room.focused && <rect x={X(room.x)} y={Y(room.y)} width={ROOM_SIZE.width * k} height={ROOM_SIZE.height * k} className="dp-fill-on" />}
      {guided && <text x={X(room.x) + 3} y={Y(room.y) + 9} className="dp-axis">{at + 1}</text>}
    </g>)}
  </>
  return {picture, corner: steps.length ? `${index + 1}/${steps.length}` : here.palace.title.slice(0, 14), label}
}

// ── the well on a plate ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A plate's display: the well (the kit's Display), its reading at the top right, its words on the status bar. */
export function WellDisplay({well, w, h}: {well: Well & {raw?: boolean}; w: number; h: number}) {
  return <Display w={w} h={h} label={well.label.split(':')[0]} does={well.label} corner={well.corner} raw={well.raw}>{well.picture}</Display>
}

/** The measures of the well on an open plate (manual §16.9 "Display on a whole plate up to 194 × 146"). */
export const PLATE_WELL: WellSize = {w: 150, h: 146}
/** The display section's width: the well and the section's padding. */
export const PLATE_WELL_SECTION = PLATE_WELL.w + 14

function ProjectWellOn() { const well = useProjectWell(PLATE_WELL); return <WellDisplay well={well} {...PLATE_WELL} /> }
function WorldWellOn() { const well = useWorldWell(PLATE_WELL); return <WellDisplay well={well} {...PLATE_WELL} /> }
function CanvasWellOn() { const well = useCanvasWell(PLATE_WELL); return <WellDisplay well={well} {...PLATE_WELL} /> }
function TimelineWellOn() { const well = useTimelineWell(PLATE_WELL); return <WellDisplay well={well} {...PLATE_WELL} /> }
function JourneyWellOn() { const well = useJourneyWell(PLATE_WELL); return <WellDisplay well={well} {...PLATE_WELL} /> }
function PalaceWellOn() { const well = usePalaceWell(PLATE_WELL); return <WellDisplay well={well} {...PLATE_WELL} /> }

/** Each Technē instrument's well on its open plate, by holder (a registration, never a mode branch). */
const PLATE_WELLS: Readonly<Record<string, () => ReactNode>> = {
  'techne:m0': ProjectWellOn, 'techne:m1': CanvasWellOn, 'techne:m2': TimelineWellOn, 'techne:m3': JourneyWellOn, 'techne:m4': WorldWellOn, 'techne:m5': PalaceWellOn,
}

/** The display section of an instrument's open plate: its well, at the plate's left (InstrumentPlate.tsx `display`). */
export function wellSection(id: string): {id: string; title: string; display: true; width: number; children: ReactNode} | null {
  const Well = PLATE_WELLS[id]
  return Well ? {id: 'display', title: 'Display', display: true, width: PLATE_WELL_SECTION, children: <Well />} : null
}
