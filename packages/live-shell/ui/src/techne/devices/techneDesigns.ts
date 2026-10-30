// Where the catalogue designs of Technē and the knowledge graph stand, and the bindings they are hosted on (T-COVERAGE §1.4).
//
// The place, from the manual: §16.2 "Technē | A reading. | The instrument it plays through, then the Lens and the other effects that read
// it"; §17.1 "Device view below shows the instrument the track plays through, then its effects: the Lens"; §17 "Drag one into any pane, in
// any mode, and it brings its own controls to Device view". The candidate's Device view for Technē is the instruments rack, which stands
// open the focused pane's instrument (inhabitants/ql/devices/TechneDevices.tsx): so each instrument's design stands at the head of its open
// plate, and the effects after it — the Lens after every instrument a reading plays through (§17.11 "A reading's chain, after its
// instrument"). Each is published on the door with its binding, so its band (Whole), its pane (Full), its window (Pop-out) and its tile
// (Widget) draw the same device (frame/devices/deviceDoor.ts publishDevice). Every design here declares all six views (none narrows
// `views`): an instrument stands on a chain and full in a pane and keeps a tile; an effect stands on a chain, and the manual gives the Lens
// a Full and a Widget too (§17.11 Views). The 22 Oct manual rewrite retired the Timeline as a device of its own: the timeline is Technē's
// Arrangement view (§17.5).
import {useEffect, useMemo, useReducer, useState, useSyncExternalStore} from 'react'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {InhabitantFaceDeclaration} from '../../inhabitants/manifest'
import type {IconName} from '../../inhabitants/sdk/icons'
import type {KnowledgeGraphSurface} from '../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {disclosureSession} from '../../../../../../desktop/cradle/src/techne/session'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {useOptionalContinuity} from '../../continuity/workspace'
import {readFilesLeg, readNowLeg} from '../../central/devices/groundDevices'
import {useReceiptsMove} from '../../central/devices/useCentralReadings'
import {receiptMovesNow} from '../../owners/notices'
import type {ImpactSubject} from '../../inhabitants/centralImpactModel'
import {useHostedChrome} from '../../projections/expressionsPaneHost'
import {palaceState, subscribePalace} from '../../projections/atlas/palaces/palaceSession'
import {readPalaces, usePalaces} from '../../projections/atlas/palaces/palacesWorld'
import {useAtlasHandle, useSuiteStanding} from '../../projections/atlas/AtlasProjectionPanel'
import {turnAtlasTo} from '../../projections/atlas/places/placesHost'
import {writeThroughOwner} from '../../inhabitants/ql/devices/ownerWrite'
import {setFilters} from '../../inhabitants/knowledgeGraphFaceActions'
import {CANVAS_DESIGN, GRAPH_DESIGN, JOURNEY_DESIGN, LENS_DESIGN, PALACE_DESIGN, designDevice, handsFor, heldFor, useHolds} from './designDevices'
import {SESSION_ACTS, palaceBinding, type PalaceWorld} from './palaceBinding'
import {canvasBinding, journeyBinding, promotionState, subscribePromotion, type CanvasPromoter, type FrameReadings} from './frameBindings'
import {relateSceneConstellation} from '../../../../../../desktop/cradle/src/techne/sceneConstellationRelation'
import {graphBinding, readGraphReach, surfaceRead, GRAPH_READ_NODES, type GraphReach, type GraphWrites} from './graphBinding'
import {useGraphRead} from './graphRead'
import {lensBinding} from './effectBindings'
import {canvasCarryingForm, formState, readForm, subscribeForm, FORM_LOCAL, type FormFocus, type FormOwners} from './formBinding'
import {useConstellationFocus} from '../../frame/browser/constellationFocus'
import {constellationNamed, useConstellations} from '../../owners/constellations'
import {getWikiProjectionState, refreshWikiProjectionReading, subscribeWikiProjection, wikiReadingOf}
  from '../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {WikiRegister} from '../../../../../../desktop/cradle/src/techne/wikiExpression'
import {useLivingPlan} from './livingPlan'
import {useLensRegistry} from './lensRegistry'
import {usePaneChrome} from '../../projections/atlas/paneChrome'

/** Each instrument's chain on the rack: the design that is the instrument (where the instrument is not the holder's own plate, the
 * World of the Project and of World / Places, or the Timeline since its design was retired), then its effects, left to right. The Timeline's
 * design (its head) was retired as a device of its own in the 22 Oct manual rewrite: the timeline is Technē's Arrangement view. */
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

/** The knowledge graph's writes: its armed setters, and the panel's own filter change for a coloured group. */
const GRAPH_WRITES: GraphWrites = {setter: writeThroughOwner, patch: setFilters}

/** The selections the graph's reach reads (§17.3 "Select a folder, a note or a Day"): the book's one selection, as the browser's Days and
 * Files rows set it (App.tsx centralSubject: its ref is the subject's Central-relative path). */
const REACH_KINDS: ReadonlySet<string> = new Set(['folder', 'note', 'day'])

/** What the browser's selected folder, note or Day reaches, read through Impact's legs (graphBinding.ts readGraphReach over groundDevices.ts
 * readFilesLeg and readNowLeg, through the kernel) when the selection changes, and its sessions again on a NOW receipt, as Impact read
 * them; only while the Knowledge graph stands on the rack (`active`). Null with nothing selected. */
function useGraphReach(active: boolean): GraphReach | null {
  const selection = useOptionalContinuity()?.current.context?.selection
  const kind = selection && REACH_KINDS.has(selection.kind) ? selection.kind as ImpactSubject['kind'] : null
  const path = kind ? selection?.ref ?? null : null
  const [reach, setReach] = useState<GraphReach | null>(null)
  const [moved, moveAgain] = useReducer((count: number) => count + 1, 0)
  useReceiptsMove(receiptMovesNow, moveAgain)
  useEffect(() => {
    if (!active || !kind || !path) { setReach(null); return }
    const subject: ImpactSubject = {kind, path}
    let alive = true
    setReach(was => ({...(was && was.subject.kind === kind && was.subject.path === path ? was : {subject}), reading: true}))
    const transport = detectTransport()
    void readGraphReach(subject, {files: at => readFilesLeg(transport, at), now: () => readNowLeg(transport)}).then(read => { if (alive) setReach(read) })
    return () => { alive = false }
  }, [active, kind, path, moved])
  return reach
}

/** One of the Wiki owner's shape commands through the kernel's aikit routes (owner_routes.rs): its reading, or its refusal in its words. */
async function shapeCommand(transport: KernelTransportStatus, op: KernelOp): Promise<unknown> {
  const call = await kernelOp(transport, op)
  if (call.error) throw Error(call.error)
  return (call.outcome as {data?: unknown} | undefined)?.data
}

/** The Form page's owners for one register: AIKit's `wiki-shape` over the register's wiki file (validate, the draft's check, declare and
 * its change of roles, compress, and the Wiki's projection of a constellation for QL), QL-MEF's `shape bind` and its Technē reading, and
 * the register read again through the projection store (the reading the browser's constellations are). */
export function kernelFormOwners(transport: KernelTransportStatus, register: WikiRegister): FormOwners {
  return {
    validate: file => shapeCommand(transport, {op: 'aikit_read', request: {kind: 'wiki-shape-validate', file}}),
    check: (file, frame, expected) => shapeCommand(transport, {op: 'aikit_read', request: {kind: 'wiki-shape-check', file, frame, expected_revision: expected}}),
    declare: (file, frameRef, frame, expected) => shapeCommand(transport, {op: 'aikit_write', request: {kind: 'wiki-shape-declare', file, frame_ref: frameRef, frame,
      expected_revision: expected}}),
    compress: (file, anchorRef) => shapeCommand(transport, {op: 'aikit_read', request: {kind: 'wiki-shape-compress', file, anchor_ref: anchorRef}}),
    bind: request => shapeCommand(transport, {op: 'ql_read', request: {kind: 'shape-bind', request}}),
    target: (file, anchorRef) => shapeCommand(transport, {op: 'aikit_read', request: {kind: 'wiki-shape-target', file, anchor_ref: anchorRef}}),
    reading: target => shapeCommand(transport, {op: 'ql_read', request: {kind: 'techne-reading', target}}),
    reread: async () => { await refreshWikiProjectionReading(register, transport) },
  }
}

/** The constellation the browser focuses (constellationFocus.ts), with its register's wiki file as the projection store read it. Null
 * with none focused, or while its register is not read. */
function useFormFocus(): {focus: FormFocus; register: WikiRegister} | null {
  const focus = useConstellationFocus()
  const reading = useConstellations()
  const projection = useSyncExternalStore(subscribeWikiProjection, getWikiProjectionState, getWikiProjectionState)
  return useMemo(() => {
    const constellation = constellationNamed(reading.rows, focus.ref)
    const register = constellation ? projection.registers.find(row => row.key === constellation.register) : undefined
    const basis = register ? wikiReadingOf(projection.standings[register.key])?.wikiBasis : undefined
    return constellation && register && basis ? {focus: {constellation, file: basis.path}, register} : null
  }, [focus.ref, reading.rows, projection])
}

/** The bindings of the designs, each on its owner, read where they stand. The kernel's graph is read only while the Knowledge graph
 * stands on the rack (`graph`), and so is what the browser's selection reaches. */
export function useTechneDesignBindings({graph, surface}: {graph: boolean; surface: KnowledgeGraphSurface | null}): Readonly<Record<string, DesignBinding>> {
  const palace = useSyncExternalStore(subscribePalace, palaceState, palaceState)
  // The Palace's world (its Enter page and its places as doors out): the world's palaces, read once as the Palace plate reads them
  // (palacesWorld.ts readPalaces), the Earth's places (the suite standing), and the turn to a place on the mounted atlas.
  const palaces = usePalaces()
  const suite = useSuiteStanding()
  const atlas = useAtlasHandle()
  useEffect(() => { readPalaces() }, [])
  const palaceWorld = useMemo((): PalaceWorld => ({rows: palaces.rows, load: palaces.load, places: suite.places,
    ...(atlas ? {turn: place => { turnAtlasTo(atlas, place) }} : {})}), [palaces.rows, palaces.load, suite.places, atlas])
  const holds = useHolds()
  const hosted = useHostedChrome()
  const session = useSyncExternalStore(disclosureSession.subscribe, () => disclosureSession.get(), () => null)
  const budget = Number(holds[GRAPH_DESIGN]?.budget ?? GRAPH_READ_NODES)
  // While a graph is open its own reading is the material (its handle publishes it); the root register is read here only while none is.
  const rootRead = useGraphRead(graph && !surface, Number.isSafeInteger(budget) && budget > 0 ? budget : GRAPH_READ_NODES, false)
  const read = useMemo(() => (surface ? surfaceRead(surface) : rootRead), [surface, rootRead])
  // The Aperture page: QL's living-wiki plan for the request the graph's design holds (livingPlan.ts).
  const plan = useLivingPlan(holds[GRAPH_DESIGN])
  // The Lens: QL's lens registry, frames and provider operations, read once (lensRegistry.ts); and a lens's own title and controls, as the
  // Earth pane drew them before it stood them down (projections/atlas/paneChrome.ts; O-I ticket 762).
  const lensLists = useLensRegistry()
  const lensPane = usePaneChrome('lens')
  // The graph's reach: what the browser's selected folder, note or Day reaches, through Impact's legs.
  const reach = useGraphReach(graph)
  // The Canvas's Form page: the constellation the browser focuses, on the Wiki owner's shape commands (formBinding.ts).
  const formFocus = useFormFocus()
  const form = useSyncExternalStore(subscribeForm, formState, formState)
  const promotion = useSyncExternalStore(subscribePromotion, promotionState, promotionState)
  // On focus, what the owner declares round the whole: the Form's roles are then the frame's (the browser lists a frame round a space's
  // whole as that whole, on the frame's roles: owners/constellations.ts withFrame).
  const focusedWhole = formFocus?.focus.constellation.ref
  useEffect(() => { if (formFocus) void readForm(formFocus.focus, kernelFormOwners(detectTransport(), formFocus.register)) }, [focusedWhole, formFocus?.focus.file])
  return useMemo(() => {
    const frame: FrameReadings = {state: hosted?.state ?? null, run: hosted?.run ?? null,
      window: session ? session.time_window ? {from: session.time_window.from, to: session.time_window.to} : null : undefined}
    const formOwners = formFocus ? kernelFormOwners(detectTransport(), formFocus.register) : null
    const canvas = canvasBinding(frame, heldFor(CANVAS_DESIGN), PROMOTER, promotion)
    return {
      [PALACE_DESIGN]: palaceBinding(palace, heldFor(PALACE_DESIGN), SESSION_ACTS, palaceWorld),
      [CANVAS_DESIGN]: formOwners ? canvasCarryingForm(canvas, formFocus!.focus, heldFor(CANVAS_DESIGN), handsFor(CANVAS_DESIGN, FORM_LOCAL), formOwners, form)
        : canvasCarryingForm(canvas, null, heldFor(CANVAS_DESIGN), handsFor(CANVAS_DESIGN, FORM_LOCAL), NO_OWNERS, form),
      [JOURNEY_DESIGN]: journeyBinding(frame),
      [LENS_DESIGN]: lensBinding(lensLists, heldFor(LENS_DESIGN), lensPane),
      [GRAPH_DESIGN]: graphBinding(surface, read, GRAPH_WRITES, heldFor(GRAPH_DESIGN), plan, reach),
    }
  }, [palace, palaceWorld, holds, hosted, session, read, surface, plan, lensLists, lensPane, reach, formFocus, form, promotion])
}

/** Promote's owner: the constellation's relate act over the line's two occurrences, through the kernel (frameBindings.ts CanvasPromoter). */
const PROMOTER: CanvasPromoter = {relate: input => relateSceneConstellation(detectTransport(), input)}

/** With no constellation focused the Form asks no owner (canvasCarryingForm then only says what it waits for). */
const unfocused = async (): Promise<never> => { throw Error('No constellation is focused.') }
const NO_OWNERS: FormOwners = {validate: unfocused, check: unfocused, declare: unfocused, compress: unfocused, bind: unfocused, target: unfocused, reading: unfocused,
  reread: async () => {}}
