// Your system on the globe's sky (T-WORLDS §5 W3 phase B; manual §17.2 "Your system", the System scale: "Your planet under its star. The
// agents at work circle it, and what they have just made rides a wider ring. Nothing else is in orbit"). Bound by the atlas's attach
// (AtlasProjectionPanel.tsx) for as long as the Earth stands, released with it. It draws only in the System scale (the sky drawn, the camera at
// the system and no lens holding a planet), and only what system/systemStore.ts holds:
//   - your planet is the body the globe draws while you choose your world (the Earth's own mesh, drawing your world's body; while the
//     Earth is chosen the planet is the Earth, and your system stands down): its rings ride the sky layer's own disc of it
//     (sky/layer.ts screenDisc('terra'));
//   - each other world of today's set stands on the ring of worlds around your planet, at the place its ref keys, as a small disc of its
//     own body (globe/body.ts bodyDisc: the owner's record, or the body seeded from its ref; hollow while it is not read), drawn with the
//     look its world's readings give it and the weather of the shared occasion, in its colour, its axis leaned by its tilt, its name beneath;
//   - what each world holds rides its own two rings on PlanetOrbits (sky/orbits.ts), keyed in the orbits' world key space (never a
//     widened BodyKey): the agents at work inside, what they have just made outside, each at the place its subject keys, an artefact
//     drifting outward and fading as it ages. A press opens it through the act the readings bound.
// And at the Body and Region scales, while the globe draws your own body: the locations on it that were valid in the shared window
// (system/bodyLocations.ts — the places declared on your body and the worlds that land on it), each at its point, or hollow on the nearest shore
// where its spot is sea (globe/body.ts shoreOf: drawing only, its coordinate never changes), named, in the look its precision and its standing
// give it (the atlas's own presence style, globe/presences.ts and shaders.ts PRESENCE_FRAG: a core, a ring of uncertainty for an approximate
// place, a dotted ring for a mythic one), pressed to select it or, for a landed world, to enter it; and, where a location is anchored to a real
// place on Earth, its anchor line, pressed to follow it there.
// Screen-space and DOM, as PlanetOrbits is: it reads the sky layer's drawn disc each frame, so it follows the planet exactly.
import {PlanetOrbits, type OrbitAt, type OrbitDisc, type OrbitKey, type Satellite} from '../src/sky/orbits'
import {bodyDisc, shoreOf, type BodyLook, type WorldBodyRecord} from '../src/globe/body'
import {el} from '../src/ui/dom'
import {hostSize} from '../src/ui/hostSize'
import {dirFromLatLon} from '../src/data/geo'
import type {ScreenPoint} from '../src/globe/engine'
import type {AtlasHandle} from '../mount'
import {subscribeWorldBody, worldBodyState} from '../body/worldBody'
import {subscribeSuiteStanding, suiteStanding} from '../provider/suiteStanding'
import {systemActs, systemReading, subscribeSystem} from './systemStore'
import {occasionMs, occasionStep, shownWindow, subscribeWindow} from './bodyDraw'
import type {SystemBody} from './systemModel'
import {anchorsOf, yourBodyRef, yourLocations, type Anchor, type BodyLocation} from './bodyLocations'
import {precisionMarker} from '../../../../../../../desktop/cradle/src/techne/m0m5/place/project'
import './systemOverlay.css'

/** A location drawn on the body the globe shows: where it is drawn (its own point, or the nearest shore) and whether that is a shore. */
export interface DrawnLocation {
  readonly location: BodyLocation
  readonly lat: number
  readonly lon: number
  readonly shore: boolean
}

/** What a location's mark says of itself, in its words and its label: where it is drawn on a shore, and a world that is not landed yet says it
 * stands where its ref puts it until its person lands it. Pure. */
export function markWords(drawn: DrawnLocation): {readonly text: string; readonly label: string} {
  const {location, shore} = drawn
  const unwritten = location.written === false
  return {
    text: `${location.name}${shore ? ' · shore' : ''}${unwritten ? ' · not landed yet' : ''}`,
    label: [location.name, shore ? 'its spot is sea on this body, so it is drawn on the nearest shore' : '', unwritten ? 'not landed yet: it stands where its ref puts it until you land it' : '']
      .filter(Boolean).join(': '),
  }
}

/** Where each location of your body is drawn on that body: at its own point where that is land, else on the nearest shore, said so.
 * The location's coordinate is never changed (shoreOf). Pure. */
export function drawnLocations(record: WorldBodyRecord, locations: readonly BodyLocation[]): DrawnLocation[] {
  return locations.map(location => {
    const at = shoreOf(record, location.lat, location.lon)
    return {location, lat: at.lat, lon: at.lon, shore: at.shore}
  })
}

const SVG = 'http://www.w3.org/2000/svg'
/** The ring of worlds, as the orbits' own rings are seen: a little from above its plane, turned a little off the horizontal. */
const TILT = 0.38
const ROT = (-14 * Math.PI) / 180
/** Your planet's rings stand at least this far out (px), however small the planet is drawn at the system's distance. */
const YOUR_RING = 34
/** The ring of worlds stands outside your outer ring, at least this far (px) from your planet. */
const WORLDS_RING = 112
/** A world's disc, and its rings' least radius (px). A disc this size shows a moon and a planet apart (the look of its body, drawn at twice the size
 * for a sharp screen), and its rings stand clear of it. */
export const DISC = 40
const WORLD_RING = 34
/** The room a world's name takes under its disc (px): kept inside the pane. */
const NAME_ROOM = 22

/** `#rrggbb` as the `r g b` the orbits' stylesheet reads (`--core-rgb`). */
export function rgbOf(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return Number.isFinite(n) ? `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}` : '214 214 232'
}

/** Whether your system stands this frame: the sky drawn and not the Graph, the camera at the system (no lens holding a planet, no gaze
 * from the ground), a reading of today's worlds, and your own body drawn as the planet (while the globe draws the Earth, the planet in
 * the sky is the Earth, and your system is not hung on it). Pure. */
export function systemWanted(view: {readonly sky: boolean; readonly graph: boolean}, phase: string | undefined, read: boolean, yoursShown: boolean, skyStands = true): boolean {
  // The sky layer's camera phases speak only while that layer stands: with none (the port ships no sky grid, provider/skyProvider.ts),
  // the sky lens alone is the System.
  return read && yoursShown && view.sky && !view.graph && (!skyStands || phase === undefined || phase === 'system')
}

/** Your planet's disc from the globe's own (engine.globeDisc: its centre and radius on screen), as the orbits take a disc, for when no
 * sky layer stands to give it. A disc too small to hold rings holds none. Pure. */
export function globeTerra(disc: {readonly x: number; readonly y: number; readonly r: number}): OrbitDisc {
  const px = Math.max(0, disc.r * 2)
  return {x: disc.x, y: disc.y, px, held: px, on: disc.r >= 1}
}

/** A world's place on the ring of worlds around your planet, px from its centre: its keyed phase on the flattened, turned ring. Pure. */
export function worldPlace(phase: number, radius: number): {x: number; y: number; behind: boolean} {
  const ox = Math.cos(phase) * radius, oy = Math.sin(phase) * radius * TILT
  return {x: ox * Math.cos(ROT) - oy * Math.sin(ROT), y: ox * Math.sin(ROT) + oy * Math.cos(ROT), behind: Math.sin(phase) < 0}
}

/** A body's satellites as the orbits take them. A press reads the satellite from the latest reading by its key, so a ring that stands across
 * readings (below) never opens a stale one. */
const satellitesOf = (body: SystemBody, open: (key: string, id: string) => void): Satellite[] =>
  body.satellites.map(satellite => ({
    id: satellite.id, name: satellite.name, inner: satellite.ring === 'inner', phase: satellite.phase, title: satellite.hint, kind: satellite.kind, age: satellite.age,
    open: () => open(body.key, satellite.id),
  }))

/** One body's rings as last handed to its orbits: what rides them, and the satellites themselves. */
interface HeldRings {
  structure: string
  sats: Satellite[]
}

/** Hand a body's satellites to its orbits. The orbits rebuild their controls on a set, so a reading that moved only the ages (each minute, as
 * artefacts drift) leaves the rings standing and ages the satellites in place; one that moved what rides them sets them again. */
function setRings(orbits: PlanetOrbits, held: HeldRings, key: OrbitKey | null, body: SystemBody | undefined, open: (key: string, id: string) => void): void {
  const sats = body ? satellitesOf(body, open) : []
  const structure = JSON.stringify([key, sats.map(({id, name, inner, phase, title, kind}) => [id, name, inner, phase, title, kind])])
  if (structure === held.structure) {
    sats.forEach((sat, index) => { held.sats[index]!.age = sat.age })
    return
  }
  held.structure = structure
  held.sats = sats
  orbits.set(key, sats)
}

interface WorldMark {
  key: string
  root: HTMLElement
  canvas: HTMLCanvasElement
  name: HTMLElement
  axis: SVGLineElement
  orbits: PlanetOrbits
  rings: HeldRings
  drawn: string
}

export interface SystemOverlayBinding {
  dispose(): void
}

/** The overlay's DOM, made the first time there is something to draw (a reading of your system, or a location on your body): an atlas
 * whose system is never read builds none of it. */
interface OverlayDom {
  readonly root: HTMLElement
  readonly svg: SVGSVGElement
  readonly ring: SVGEllipseElement
  readonly yourAxis: SVGLineElement
  readonly yours: PlanetOrbits
  readonly yourRings: HeldRings
  readonly places: HTMLElement
}

/** Bind your system to the mounted atlas: the overlay over its canvas, redrawn on each reading and placed on each frame. Each world's disc carries
 * the weather of the shared occasion, and the locations on your body are those valid in the shared window, as the body drawer reads it (system/
 * bodyDraw.ts shownWindow; none bound, all time). `press` is the person's press on a location's mark, `follow` a press on an anchor line. */
export function bindSystemOverlay({handle, said, press, follow}: {handle: AtlasHandle; said?: (text: string) => void; press?: (location: BodyLocation) => void; follow?: (anchor: Anchor) => void}): SystemOverlayBinding {
  const parent = handle.engine.renderer.domElement.parentElement ?? document.body
  let dom: OverlayDom | null = null
  const ensureDom = (): OverlayDom => {
    if (dom) return dom
    const svg = document.createElementNS(SVG, 'svg')
    svg.setAttribute('class', 'sys-svg')
    svg.setAttribute('aria-hidden', 'true')
    const ring = document.createElementNS(SVG, 'ellipse')
    ring.setAttribute('class', 'sys-ring')
    const yourAxis = document.createElementNS(SVG, 'line')
    yourAxis.setAttribute('class', 'sys-axis')
    svg.append(ring, yourAxis)
    const root = el('div', {class: 'sys', hidden: true, role: 'group', 'aria-label': 'Your system: the worlds of today’s set'})
    root.append(svg)
    parent.append(root)
    // the locations on your body (Body and Region scales), in a layer of their own
    const places = el('div', {class: 'sys-places', hidden: true, role: 'group', 'aria-label': 'Locations on your body'})
    parent.append(places)
    dom = {root, svg, ring, yourAxis, yours: new PlanetOrbits(parent, () => {}, {home: false, className: 'po-sys'}), yourRings: {structure: '', sats: []}, places}
    return dom
  }
  let placeMarks: {drawn: DrawnLocation; node: HTMLElement; dir: [number, number, number]}[] = []
  let placesKey = ''
  const syncPlaces = () => {
    // the marks are those of YOUR body: a globe drawing another world's body (you entered it) has none of yours on it
    const drawn = handle.engine.body
    const record = drawn && drawn.body_ref === yourBodyRef(worldBodyState()) ? drawn : null
    const standing = suiteStanding(), system = systemReading()
    const read = record ? yourLocations(worldBodyState(), standing.places, standing.phase === 'ready', system.state === 'read' ? system.bodies : null, shownWindow()) : null
    const rows = read && 'rows' in read ? read.rows : []
    const anchors = record && rows.length ? anchorsOf(standing.places, record.body_ref).filter(anchor => rows.some(row => row.id === anchor.location)) : []
    const key = record && rows.length ? JSON.stringify([record, rows, anchors]) : ''
    if (key === placesKey) return
    placesKey = key
    for (const mark of placeMarks) mark.node.remove()
    placeMarks = []
    if (!record || !rows.length) return
    const {places} = ensureDom()
    placeMarks = drawnLocations(record, rows).map(drawn => {
      const {location} = drawn
      const words = markWords(drawn)
      const anchor = anchors.find(entry => entry.location === location.id)
      // the mark is a wrapper placed at the location's point; its press and its anchor line are two buttons beside each other, so neither holds the other
      const node = el('div', {class: 'sys-mark'}, [
        el('button', {
          type: 'button',
          class: `sys-place${drawn.shore ? ' is-shore' : ''}${location.locus === 'myth-episode' ? ' is-mythic' : ''}${location.written === false ? ' is-unwritten' : ''}`,
          'aria-label': words.label, 'data-marker': location.precision ? precisionMarker(location.precision).kind : undefined,
          onclick: () => press?.(location),
        }, [el('span', {class: 'sys-place-dot'}), el('span', {class: 'sys-place-name', text: words.text})]),
        // the anchor line: a dashed stub to the real place on Earth, named; a press follows it there
        anchor && el('button', {type: 'button', class: 'sys-anchor', title: `${location.name} is anchored to ${anchor.to.name} on Earth: follow the line there`,
          'aria-label': `${location.name}: follow its anchor to ${anchor.to.name} on Earth`, onclick: () => follow?.(anchor)},
        [el('span', {class: 'sys-anchor-line'}), el('span', {text: `Earth · ${anchor.to.name}`})]),
      ])
      places.append(node)
      return {drawn, node, dir: dirFromLatLon(drawn.lat, drawn.lon) as [number, number, number]}
    })
  }
  const offBody = subscribeWorldBody(syncPlaces)
  const offStanding = subscribeSuiteStanding(syncPlaces)
  const screen: ScreenPoint = {x: 0, y: 0, facing: 0}
  let marks: WorldMark[] = []
  let bodies: readonly SystemBody[] = []
  let live = true

  const open = (key: string, id: string) => {
    const body = bodies.find(entry => entry.key === key)
    const satellite = body?.satellites.find(entry => entry.id === id)
    const acts = systemActs()
    if (!body || !satellite) return
    if (!acts) { said?.('Your system’s owners are not bound in this pane, so nothing in orbit opens from here.'); return }
    void acts.open(satellite, body).catch(error => said?.(error instanceof Error ? error.message : String(error)))
  }

  const draw = (canvas: HTMLCanvasElement, record: WorldBodyRecord | null, look: BodyLook, occasion: number | null) => {
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!record) return
    const image = bodyDisc(record, canvas.width, look, occasion)
    context.putImageData(new ImageData(image.data as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0)
  }

  const sync = () => {
    const reading = systemReading()
    bodies = reading.state === 'read' ? reading.bodies : []
    if (!bodies.length && !dom) return
    const {root, svg, yours, yourRings} = ensureDom()
    // the weather the discs are drawn at: the shared occasion, in steps (bodyDraw.ts OCCASION_STEP_MS), Now being none
    const occasion = occasionStep(occasionMs(shownWindow()))
    const own = bodies.find(body => body.yours)
    setRings(yours, yourRings, own ? own.key : null, own, open)
    if (own) yours.root.style.setProperty('--core-rgb', rgbOf(own.colour.core))
    const others = bodies.filter(body => !body.yours)
    for (const mark of marks) if (!others.some(body => body.key === mark.key)) { mark.root.remove(); mark.axis.remove(); mark.orbits.destroy() }
    marks = others.map(body => {
      const held = marks.find(mark => mark.key === body.key)
      const mark = held ?? (() => {
        const canvas = el('canvas', {class: 'sys-disc', width: String(DISC * 2), height: String(DISC * 2)}) as HTMLCanvasElement
        const name = el('span', {class: 'sys-name'})
        const markRoot = el('div', {class: 'sys-world', role: 'img'}, [canvas, name])
        root.append(markRoot)
        const axis = document.createElementNS(SVG, 'line')
        axis.setAttribute('class', 'sys-axis')
        svg.append(axis)
        return {key: body.key, root: markRoot, canvas, name, axis, orbits: new PlanetOrbits(parent, () => {}, {home: false, className: 'po-sys'}), rings: {structure: '', sats: []}, drawn: ''}
      })()
      const picture = body.record ? JSON.stringify([body.record, body.look, occasion]) : ''
      if (picture !== mark.drawn) { draw(mark.canvas, body.record, body.look, occasion); mark.drawn = picture }
      mark.name.textContent = body.world.name
      mark.root.dataset.state = body.state
      mark.root.style.setProperty('--core-rgb', rgbOf(body.colour.core))
      mark.root.setAttribute('aria-label', `${body.world.name}: ${body.standing}${body.landing ? `; it lands on your planet at ${body.landing.lat.toFixed(1)}, ${body.landing.lon.toFixed(1)}` : body.unlanded ? `; ${body.unlanded}` : ''}`)
      mark.root.title = mark.root.getAttribute('aria-label') ?? ''
      setRings(mark.orbits, mark.rings, body.key, body, open)
      mark.orbits.root.style.setProperty('--core-rgb', rgbOf(body.colour.core))
      return mark
    })
  }
  const offSystem = subscribeSystem(() => { sync(); syncPlaces() })
  const offWindow = subscribeWindow(() => { sync(); syncPlaces() })
  sync()
  syncPlaces()

  handle.engine.onFrame(dt => {
    if (!live) return
    // the locations on your body stand at the Body and Region scales, on the body the globe draws (the Earth draws its own places)
    syncPlaces()
    if (!dom) return
    const {root, ring, yourAxis, yours, places} = dom
    const onBody = !handle.ctl.state.sky && !handle.ctl.state.graph && !!handle.engine.body && placeMarks.length > 0
    places.hidden = !onBody
    if (onBody) {
      for (const mark of placeMarks) {
        handle.engine.project(mark.dir, screen, 1.002)
        const shown = screen.facing > 0.02
        mark.node.style.visibility = shown ? 'visible' : 'hidden'
        if (shown) mark.node.style.transform = `translate(${Math.round(screen.x)}px, ${Math.round(screen.y)}px)`
      }
    }
    const layer = handle.engine.sky ?? null
    const reading = systemReading()
    const wanted = systemWanted({sky: !!handle.ctl.state.sky, graph: !!handle.ctl.state.graph}, document.body.dataset.skyPhase, reading.state === 'read', !!handle.engine.body, !!layer)
    // your planet's disc: on the sky layer when it stands, else the globe's own (your system stands on your planet either way; r19)
    const terra = !wanted ? null : layer ? layer.screenDisc('terra') : (() => { const disc = {x: 0, y: 0, r: 0}; handle.engine.globeDisc(disc); return globeTerra(disc) })()
    const here = !!terra && terra.on
    root.hidden = !here
    const at: OrbitAt = {disc: here ? terra : null, wanted: here, minRing: YOUR_RING}
    yours.update(layer, dt, handle.engine.reduced, at)
    if (!here || !terra) {
      for (const mark of marks) mark.orbits.update(layer, dt, handle.engine.reduced, {disc: null, wanted: false})
      return
    }
    const {w, h} = hostSize(root)
    const R = Math.max(terra.held / 2, 2)
    // the ring of worlds stands outside your planet, but never wider than the pane has room for: a planet that fills the pane would push every world
    // to its corners, where their names clip
    const radius = Math.max(WORLDS_RING, Math.min(R * 2.9, Math.min(terra.x, w - terra.x) - DISC))
    ring.setAttribute('cx', terra.x.toFixed(1)); ring.setAttribute('cy', terra.y.toFixed(1))
    ring.setAttribute('rx', radius.toFixed(1)); ring.setAttribute('ry', (radius * TILT).toFixed(1))
    ring.setAttribute('transform', `rotate(${(ROT * 180) / Math.PI} ${terra.x.toFixed(1)} ${terra.y.toFixed(1)})`)
    ring.setAttribute('visibility', marks.length ? 'visible' : 'hidden')
    // your planet's axis, leaned by its tilt, where your own body is drawn (the Earth draws its own, so none is drawn for it)
    const shownTilt = handle.engine.body ? handle.engine.body.sky.axial_tilt_deg : null
    axisAt(yourAxis, terra.x, terra.y, Math.max(R, 8) + 6, shownTilt)
    for (const mark of marks) {
      const body = bodies.find(entry => entry.key === mark.key)
      if (!body) continue
      const place = worldPlace(body.phase, radius)
      const x = Math.min(w - DISC, Math.max(DISC, terra.x + place.x)), y = Math.min(h - DISC / 2 - NAME_ROOM, Math.max(DISC, terra.y + place.y))
      mark.root.style.transform = `translate(${Math.round(x - DISC / 2)}px, ${Math.round(y - DISC / 2)}px)`
      mark.root.style.opacity = place.behind ? '0.8' : '1'
      mark.root.style.zIndex = place.behind ? '1' : '2'
      axisAt(mark.axis, x, y, DISC / 2 + 5, body.record ? body.record.sky.axial_tilt_deg : null)
      mark.orbits.update(layer, dt, handle.engine.reduced, {disc: {x, y, px: DISC, held: DISC, on: true}, wanted: true, minRing: WORLD_RING})
    }
  })

  return {
    dispose() {
      if (!live) return
      live = false
      offSystem()
      offWindow()
      offBody()
      offStanding()
      for (const mark of marks) mark.orbits.destroy()
      if (dom) {
        dom.places.remove()
        dom.yours.destroy()
        dom.root.remove()
      }
    },
  }
}

/** A body's axis through its disc, leaned by its tilt from the ring's upright (none for a body whose tilt is not read). */
function axisAt(line: SVGLineElement, x: number, y: number, half: number, tiltDeg: number | null): void {
  if (tiltDeg === null) { line.setAttribute('visibility', 'hidden'); return }
  const a = (tiltDeg * Math.PI) / 180 + ROT, dx = Math.sin(a) * half, dy = Math.cos(a) * half
  line.setAttribute('x1', (x - dx).toFixed(1)); line.setAttribute('y1', (y + dy).toFixed(1))
  line.setAttribute('x2', (x + dx).toFixed(1)); line.setAttribute('y2', (y - dy).toFixed(1))
  line.setAttribute('visibility', 'visible')
}
