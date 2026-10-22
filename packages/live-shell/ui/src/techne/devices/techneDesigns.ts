// Where the catalogue designs of Technē and the knowledge graph stand, and the bindings they are hosted on (T-COVERAGE §1.4).
//
// The place, from the manual: §16.2 "Technē | A reading. | The instrument it plays through, then its lens and filter effects"; §17.1
// "Device view below shows the instrument the track plays through, then its effects: the Lens … and Light, which follows a reading's
// force across the Canvas"; §17 "Drag one into any pane, in any mode, and it brings its own controls to Device view". The candidate's
// Device view for Technē is the instruments rack, which stands open the focused pane's instrument (inhabitants/ql/devices/
// TechneDevices.tsx): so each instrument's design stands at the head of its open plate, and the effects after it — the Lens after every
// instrument a reading plays through (§17.11 "A reading's chain, after its instrument"), Light after the Canvas (§17.10 "A reading's
// chain, over the Canvas"). Each is published on the door with its binding, so its band (Whole), its pane (Full), its window (Pop-out)
// and its tile (Widget) draw the same device (frame/devices/deviceDoor.ts publishDevice). Every design here declares all six views
// (none narrows `views`): an instrument stands on a chain and full in a pane and keeps a tile; an effect stands on a chain, and the
// manual gives Light and the Lens a Full and a Widget too (§17.10, §17.11 Views).
import {useMemo, useSyncExternalStore} from 'react'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {InhabitantFaceDeclaration} from '../../inhabitants/manifest'
import type {IconName} from '../../inhabitants/sdk/icons'
import type {KnowledgeGraphSurface} from '../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {disclosureSession} from '../../../../../../desktop/cradle/src/techne/session'
import {instantOfYear, windowEdgeYear, writeSharedWindow} from '../../projections/atlas/sharedClock'
import {useHostedChrome} from '../../projections/expressionsPaneHost'
import {palaceState, subscribePalace} from '../../projections/atlas/palaces/palaceSession'
import {writeThroughOwner} from '../../inhabitants/ql/devices/ownerWrite'
import {setFilters} from '../../inhabitants/knowledgeGraphFaceActions'
import {CANVAS_DESIGN, GRAPH_DESIGN, JOURNEY_DESIGN, LENS_DESIGN, LIGHT_DESIGN, PALACE_DESIGN, TIMELINE_DESIGN, designDevice, heldFor, useHolds} from './designDevices'
import {palaceBinding} from './palaceBinding'
import {canvasBinding, journeyBinding, timelineBinding, type FrameReadings, type WindowLaw} from './frameBindings'
import {graphBinding, surfaceRead, GRAPH_READ_NODES, type GraphWrites} from './graphBinding'
import {useGraphRead} from './graphRead'
import {lensBinding, lightBinding} from './effectBindings'
import {useLivingPlan} from './livingPlan'
import {useLensRegistry} from './lensRegistry'

/** Each instrument's chain on the rack: the design that is the instrument (where the instrument is not the holder's own plate, the
 * World of M0′ and M4′), then its effects, left to right. The Timeline (M2′'s head) and Light were retired as devices of their own in
 * the 22 Oct manual rewrite: the timeline is Technē's Arrangement view, and Light is the Canvas's Light page; their bindings stay. */
export const TECHNE_CHAINS: Readonly<Record<string, {readonly head?: string; readonly effects: readonly string[]}>> = {
  'techne:m0': {effects: [LENS_DESIGN]},
  'techne:m1': {head: CANVAS_DESIGN, effects: [LENS_DESIGN]},
  'techne:m2': {effects: [LENS_DESIGN]},
  'techne:m3': {head: JOURNEY_DESIGN, effects: [LENS_DESIGN]},
  'techne:m4': {effects: [LENS_DESIGN]},
  'techne:m5': {head: PALACE_DESIGN, effects: [LENS_DESIGN]},
  'knowledge-graph': {head: GRAPH_DESIGN, effects: [LENS_DESIGN]},
}

/** The holders whose chain a design stands on. */
export const holdersOf = (design: string): string[] =>
  Object.entries(TECHNE_CHAINS).flatMap(([holder, chain]) => (chain.head === design || chain.effects.includes(design) ? [holder] : []))

interface DesignSpec {readonly design: string; readonly title: string; readonly icon: IconName; readonly effect?: boolean; readonly note: string}
export const TECHNE_DESIGNS: readonly DesignSpec[] = [
  {design: PALACE_DESIGN, title: 'Palace', icon: 'palace', note: 'The palace you stand in, as the palace session holds it (projections/atlas/palaces/palaceSession.ts): its rooms, its walk, its board, its bookmarks and its Return.'},
  {design: CANVAS_DESIGN, title: 'Canvas', icon: 'form', note: 'The research frame\'s board, as the frame announces it: its pointer mode, grid snap, zoom, save state and selection. Its items, lines and frames are not published.'},
  {design: JOURNEY_DESIGN, title: 'Journey', icon: 'journey', note: 'The research frame\'s walk, as the frame announces it: the stop it stands on, how many stops, that stop\'s name, and whether it walks.'},
  {design: LENS_DESIGN, title: 'Lens', icon: 'techne', effect: true, note: 'A reading through one of Quaternal Logic\'s lenses and a context frame. It draws QL\'s lenses with their sublenses, frames and provider operations, and holds the lens and sublens you choose; the reading and the frame reading wait for a target and a mapping that nothing in the shell supplies yet.'},
  {design: GRAPH_DESIGN, title: 'Knowledge graph', icon: 'search', note: 'The open graph\'s view state and its own reading (its handle); with no graph open, the kernel graph op\'s reading of the root register\'s wiki.'},
]

/** A design's face declaration, for the rack's placement (its holders) and the plate's words. */
export function designFace(spec: DesignSpec): InhabitantFaceDeclaration {
  return {id: spec.design.split(':')[1]!, presentations: ['compact', 'expanded'], liveSemantic: spec.effect ? 'detail-device' : 'device-instrument',
    heldBy: holdersOf(spec.design), note: spec.note}
}

/** A design's device on the door. */
export const designDeviceOf = (spec: DesignSpec): DeviceInstance => designDevice(spec.design, {title: spec.title, icon: spec.icon, effect: spec.effect, heldBy: holdersOf(spec.design), note: spec.note})

/** One device and one face per design, made once: the door and the rack hold the same objects across readings. */
export const DESIGN_DEVICES: ReadonlyMap<string, DeviceInstance> = new Map(TECHNE_DESIGNS.map(spec => [spec.design, designDeviceOf(spec)]))
export const DESIGN_FACES: ReadonlyMap<string, InhabitantFaceDeclaration> = new Map(TECHNE_DESIGNS.map(spec => [spec.design, designFace(spec)]))

/** The designs that stand on any of these holders' chains, in the chains' order. */
export function designsOn(holders: readonly string[]): string[] {
  const out: string[] = []
  for (const holder of holders) {
    const chain = TECHNE_CHAINS[holder]
    if (!chain) continue
    for (const design of [...(chain.head ? [chain.head] : []), ...chain.effects]) if (!out.includes(design)) out.push(design)
  }
  return out
}

/** The shared clock's law over the session's one window (projections/atlas/sharedClock.ts). */
const WINDOW_LAW: WindowLaw = {yearOf: windowEdgeYear, instantOf: instantOfYear, write: window => writeSharedWindow(disclosureSession, window)}

/** The knowledge graph's writes: its armed setters, and the panel's own filter change for a coloured group. */
const GRAPH_WRITES: GraphWrites = {setter: writeThroughOwner, patch: setFilters}

const LIGHT = lightBinding()

/** The bindings of the designs, each on its owner, read where they stand. The kernel's graph is read only while the Knowledge graph
 * stands on the rack (`graph`). */
export function useTechneDesignBindings({graph, surface}: {graph: boolean; surface: KnowledgeGraphSurface | null}): Readonly<Record<string, DesignBinding>> {
  const palace = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  const holds = useHolds()
  const hosted = useHostedChrome()
  const session = useSyncExternalStore(disclosureSession.subscribe, () => disclosureSession.get(), () => null)
  const budget = Number(holds[GRAPH_DESIGN]?.budget ?? GRAPH_READ_NODES)
  // While a graph is open its own reading is the material (its handle publishes it); the root register is read here only while none is.
  const rootRead = useGraphRead(graph && !surface, Number.isSafeInteger(budget) && budget > 0 ? budget : GRAPH_READ_NODES, false)
  const read = useMemo(() => (surface ? surfaceRead(surface) : rootRead), [surface, rootRead])
  // The Aperture page: QL's living-wiki plan for the request the graph's design holds (livingPlan.ts).
  const plan = useLivingPlan(holds[GRAPH_DESIGN])
  // The Lens: QL's lens registry, frames and provider operations, read once (lensRegistry.ts).
  const lensLists = useLensRegistry()
  return useMemo(() => {
    const frame: FrameReadings = {state: hosted?.state ?? null, run: hosted?.run ?? null,
      window: session ? session.time_window ? {from: session.time_window.from, to: session.time_window.to} : null : undefined}
    return {
      [PALACE_DESIGN]: palaceBinding(palace, heldFor(PALACE_DESIGN)),
      [CANVAS_DESIGN]: canvasBinding(frame, heldFor(CANVAS_DESIGN)),
      [TIMELINE_DESIGN]: timelineBinding(frame, WINDOW_LAW, heldFor(TIMELINE_DESIGN)),
      [JOURNEY_DESIGN]: journeyBinding(frame),
      [LIGHT_DESIGN]: LIGHT,
      [LENS_DESIGN]: lensBinding(lensLists, heldFor(LENS_DESIGN)),
      [GRAPH_DESIGN]: graphBinding(surface, read, GRAPH_WRITES, heldFor(GRAPH_DESIGN), plan),
    }
  }, [palace, holds, hosted, session, read, surface, plan, lensLists])
}
