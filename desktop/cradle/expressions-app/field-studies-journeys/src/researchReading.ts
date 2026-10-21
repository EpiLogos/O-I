/** The research instruments' state as the frame announces it to its host (DLW §17.4 Canvas, §17.5 Timeline, §17.6 Journey; lane
 * W4-Technē): the walk, the board and the ruler, each read from the frame's OWN state — the open Journey document (model.ts Journey,
 * Scene.duration / transition / transitionSpec / breakAtEnd / character, the one the playback path walks: journeyPath.ts walkJourney),
 * the Canvas the research instruments draw (researchInstrumentsData.ts nativeInstrumentCanvas, the Scene's research material:
 * frames and connector records, and the canvas view's camera, selection and pointer flags), and the reading the Timeline draws (its
 * temporal nodes and relationships, its projection and its camera). Nothing here is a second store: each builder copies what the frame
 * already holds, bounded, so the host's devices draw the material its pane draws.
 *
 * Pure: no DOM. The frame builds (app.ts announceHostState), the host boundary reads (packages/expressions-boundary protocol.ts
 * readHostedState → readFrameResearch), so the two cannot disagree. A part the frame does not hold is absent, never filled in. */
import {TRANSITION_KINDS, SWITCH_MODES, CURVE_TYPES, WIPE_DIRECTIONS, type TransitionKind, type SwitchMode, type CurveType, type WipeDirection, type TransitionSpec} from '../../src/engine/transitionMath';

// ---------------------------------------------------------------------------------------------------------------- the shapes

/** One stop of the walk: one Scene of the Journey, in the walk's order. `words` is the Scene's own character (its narration), `hold` its
 * duration, and the transition is the one the walk ENTERS this stop with (a blend is a fact of the scene it enters, journeyPath.ts). */
export interface FrameJourneyStop {
  name: string; words: string; hold: number; seconds: number; kind: TransitionKind; curve: CurveType; switch: SwitchMode
  /** A wipe's direction; present only for a wipe that names one. */
  direction?: WipeDirection
  /** A dip's colour point (a fraction of the transition); present only for a dip that names one. */
  at?: number
}
export interface FrameJourneyReading {
  name: string; loops: boolean
  /** The last Scene's exit is a loop exit: playback stops at its end instead of wrapping (Scene.breakAtEnd). */
  stopAtEnd: boolean
  /** The stop the walk stands on, the seconds into it, whether the saved scenes play, and whether a journey crossing stands (Enter). */
  at: number; local: number; playing: boolean; entered: boolean
  stops: FrameJourneyStop[]
}
export const CANVAS_ITEM_KINDS = ['card', 'sticky', 'shape', 'text'] as const
export type FrameCanvasItemKind = (typeof CANVAS_ITEM_KINDS)[number]
export const CANVAS_LINE_KINDS = ['straight', 'curved', 'elbow'] as const
export const CANVAS_SIDES = ['top', 'right', 'bottom', 'left'] as const
export interface FrameCanvasItem {id: string; kind: FrameCanvasItemKind; x: number; y: number; w: number; h: number; name: string}
export interface FrameCanvasLine {
  id: string; from: string; to: string
  /** The connector record (canvasConnectors.ts ResearchConnector): absent = the auto-routed curve the frame draws then. */
  kind?: (typeof CANVAS_LINE_KINDS)[number]; label?: string; fromSide?: (typeof CANVAS_SIDES)[number]; toSide?: (typeof CANVAS_SIDES)[number]
  /** The native edge's own directionality, as the design's two words. */
  direction?: 'directed' | 'undirected'
}
export interface FrameCanvasReading {
  items: FrameCanvasItem[]; lines: FrameCanvasLine[]; frames: {title: string; members: string[]}[]
  /** The board point at the pane's centre and the zoom in percent (the vendored Canvas's viewport over the pane's own size). */
  camera?: {cx: number; cy: number; zoom: number}
  selected: string[]; selectedLine?: string
  /** The pointer flags (researchInstruments.tsx :885-892): drawing, erasing, lasso, grid snap. */
  drawing: boolean; erasing: boolean; lasso: boolean; snap: boolean
}
export const TIMELINE_PROJECTIONS = ['chronology', 'field', 'relative'] as const
export interface FrameTimelineEvent {id: string; name: string; from: number; to: number; family?: string; historicity?: string}
export interface FrameTimelineReading {
  projection: (typeof TIMELINE_PROJECTIONS)[number]
  events: FrameTimelineEvent[]; edges: {id: string; from: string; to: string; kind: string; standing?: string}[]
  /** The years the dated events span (researchInstruments.tsx m2: first and last), absent with no dated event. */
  domain?: {from: number; to: number}
  /** The chronology's camera (TimelineViewState centerYear, pixelsPerYear). */
  centre?: number; zoom?: number
  views: {id: string; label: string}[]
}
export interface FrameResearchReading {journey?: FrameJourneyReading; canvas?: FrameCanvasReading; timeline?: FrameTimelineReading}

/** How many of each part one announcement carries at most: a board, a walk or a ruler past these is announced in part, never refused. */
export const RESEARCH_LIMITS = {stops: 512, items: 2000, lines: 4000, frames: 256, events: 4000, edges: 8000, views: 64, text: 512} as const

// ---------------------------------------------------------------------------------------------------------------- the builders

const clip = (text: unknown, max: number = RESEARCH_LIMITS.text): string => (typeof text === 'string' ? text.slice(0, max) : '')
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** The walk as the Journey document holds it, with where the walk stands (app.ts sceneIndex, sceneElapsed, journeyPlaying, crossingStands). */
export function journeyReadingOf(doc: {name: string; loop: boolean; scenes: readonly {name: string; character?: string; duration: number; transition: number; transitionSpec?: TransitionSpec; breakAtEnd?: boolean}[]},
  at: {index: number; local: number; playing: boolean; entered: boolean}): FrameJourneyReading {
  const scenes = doc.scenes.slice(0, RESEARCH_LIMITS.stops)
  const stops = scenes.map((scene): FrameJourneyStop => {
    const spec = scene.transitionSpec
    const kind = spec?.kind ?? 'crossfade'
    return {name: clip(scene.name), words: clip(scene.character ?? ''), hold: scene.duration, seconds: scene.transition, kind, curve: spec?.curve?.type ?? 'linear',
      switch: spec?.switchMode ?? 'immediate', ...(kind === 'wipe' && spec?.direction ? {direction: spec.direction} : {}), ...(kind === 'dip-to-colour' && finite(spec?.at) ? {at: spec!.at} : {})}
  })
  return {name: clip(doc.name), loops: doc.loop, stopAtEnd: doc.scenes.at(-1)?.breakAtEnd === true, at: Math.max(0, Math.min(scenes.length - 1, at.index)),
    local: Math.max(0, at.local), playing: at.playing, entered: at.entered, stops}
}

/** The board as the Canvas draws it: its nodes, its edges with their connector records, the Scene's frames, and the canvas view's camera,
 * selection and pointer flags. `kindOf` reads a node's research card kind (Scene.research.cards by the occurrence's view id). */
export function canvasReadingOf(canvas: {nodes: readonly {id: string; title?: string; position: {x: number; y: number}; size?: {width?: number; height?: number}}[];
  edges: readonly {id: string; sourceNodeId: string; targetNodeId: string; directionality?: string}[]},
material: {frames?: Readonly<Record<string, {label: string; title?: string; memberRefs: readonly string[]}>>; connectors?: Readonly<Record<string, {kind: string; label?: string; fromSide?: string; toSide?: string}>>} | undefined,
view: {viewport?: {x: number; y: number; zoom: number}; pane?: {width: number; height: number}; selected: readonly string[]; selectedLine?: string | null; drawing?: boolean; erasing?: boolean; lasso?: boolean; snap?: boolean},
kindOf: (nodeId: string) => string | undefined): FrameCanvasReading {
  const items = canvas.nodes.slice(0, RESEARCH_LIMITS.items).flatMap((node): FrameCanvasItem[] => {
    if (!finite(node.position?.x) || !finite(node.position?.y)) return []
    const card = kindOf(node.id)
    const kind: FrameCanvasItemKind = card === 'sticky' || card === 'shape' || card === 'text' ? card : 'card'
    return [{id: node.id, kind, x: node.position.x, y: node.position.y, w: finite(node.size?.width) ? node.size!.width! : 240, h: finite(node.size?.height) ? node.size!.height! : 160, name: clip(node.title)}]
  })
  const known = new Set(items.map(item => item.id))
  const lines = canvas.edges.slice(0, RESEARCH_LIMITS.lines).flatMap((edge): FrameCanvasLine[] => {
    if (!known.has(edge.sourceNodeId) || !known.has(edge.targetNodeId)) return []
    const connector = material?.connectors?.[edge.id]
    const direction = edge.directionality === 'forward' || edge.directionality === 'backward' ? 'directed' : edge.directionality === 'bidirectional' || edge.directionality === 'none' ? 'undirected' : undefined
    return [{id: edge.id, from: edge.sourceNodeId, to: edge.targetNodeId,
      ...(connector && (CANVAS_LINE_KINDS as readonly string[]).includes(connector.kind) ? {kind: connector.kind as FrameCanvasLine['kind']} : {}),
      ...(connector?.label ? {label: clip(connector.label)} : {}),
      ...(connector?.fromSide && (CANVAS_SIDES as readonly string[]).includes(connector.fromSide) ? {fromSide: connector.fromSide as FrameCanvasLine['fromSide']} : {}),
      ...(connector?.toSide && (CANVAS_SIDES as readonly string[]).includes(connector.toSide) ? {toSide: connector.toSide as FrameCanvasLine['toSide']} : {}),
      ...(direction ? {direction} : {})}]
  })
  const frames = Object.values(material?.frames ?? {}).slice(0, RESEARCH_LIMITS.frames).map(frame => ({title: clip(frame.title ?? frame.label), members: frame.memberRefs.filter(ref => known.has(ref))}))
  const pane = view.pane, viewport = view.viewport
  const camera = viewport && pane && finite(viewport.x) && finite(viewport.y) && finite(viewport.zoom) && viewport.zoom > 0 && pane.width > 0 && pane.height > 0
    ? {cx: (pane.width / 2 - viewport.x) / viewport.zoom, cy: (pane.height / 2 - viewport.y) / viewport.zoom, zoom: viewport.zoom * 100} : undefined
  return {items, lines, frames, ...(camera ? {camera} : {}), selected: view.selected.filter(id => known.has(id)),
    ...(view.selectedLine && lines.some(line => line.id === view.selectedLine) ? {selectedLine: view.selectedLine} : {}),
    drawing: view.drawing === true, erasing: view.erasing === true, lasso: view.lasso === true, snap: view.snap === true}
}

/** The vendored Canvas's viewport that puts a board point at the pane's centre at a zoom in percent: the inverse of the camera above. */
export function viewportOf(camera: {cx: number; cy: number; zoom: number}, pane: {width: number; height: number}): {x: number; y: number; zoom: number} {
  const zoom = camera.zoom / 100
  return {x: pane.width / 2 - camera.cx * zoom, y: pane.height / 2 - camera.cy * zoom, zoom}
}

/** A dated value's year, as the Timeline reads it (researchInstruments.tsx m2: `/^(-?\d{1,6})(?:-|$)/`). */
export const yearOf = (value: unknown): number | undefined => {
  const match = typeof value === 'string' ? /^(-?\d{1,6})(?:-|$)/.exec(value) : null
  return match ? Number(match[1]) : undefined
}

/** The ruler as the Timeline draws it: the reading's dated nodes and its relationships between them, the projection and the camera. */
export function timelineReadingOf(bundle: {nodes: readonly {graphNodeId: string; title?: string; isTemporal?: boolean; validFrom?: unknown; validTo?: unknown; entityType?: unknown; historicity?: unknown}[];
  relationships: readonly {id: string; sourceGraphNodeId: string; targetGraphNodeId: string; relType: string; properties?: Readonly<Record<string, unknown>>}[]},
view: {projection?: string; camera?: {centerYear: number; pixelsPerYear: number}; views: readonly string[]}): FrameTimelineReading {
  const events = bundle.nodes.filter(node => node.isTemporal).slice(0, RESEARCH_LIMITS.events).flatMap((node): FrameTimelineEvent[] => {
    const from = yearOf(node.validFrom)
    if (from === undefined) return []
    const to = yearOf(node.validTo) ?? from
    return [{id: node.graphNodeId, name: clip(node.title), from: Math.min(from, to), to: Math.max(from, to),
      ...(typeof node.entityType === 'string' ? {family: clip(node.entityType, 64)} : {}), ...(typeof node.historicity === 'string' ? {historicity: clip(node.historicity, 64)} : {})}]
  })
  const dated = new Set(events.map(event => event.id))
  const edges = bundle.relationships.filter(row => dated.has(row.sourceGraphNodeId) && dated.has(row.targetGraphNodeId)).slice(0, RESEARCH_LIMITS.edges)
    .map(row => ({id: row.id, from: row.sourceGraphNodeId, to: row.targetGraphNodeId, kind: clip(row.relType, 64),
      ...(typeof row.properties?.standing === 'string' ? {standing: clip(row.properties.standing, 64)} : {})}))
  const years = events.flatMap(event => [event.from, event.to])
  const projection = (TIMELINE_PROJECTIONS as readonly string[]).includes(view.projection ?? '') ? view.projection as FrameTimelineReading['projection'] : 'chronology'
  return {projection, events, edges, ...(years.length ? {domain: {from: Math.min(...years), to: Math.max(...years)}} : {}),
    ...(view.camera && finite(view.camera.centerYear) && finite(view.camera.pixelsPerYear) ? {centre: view.camera.centerYear, zoom: view.camera.pixelsPerYear} : {}),
    views: view.views.slice(0, RESEARCH_LIMITS.views).map(name => ({id: clip(name, 128), label: clip(name, 128)}))}
}

// ---------------------------------------------------------------------------------------------------------------- the reader

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const closed = (raw: Record<string, unknown>, keys: readonly string[]) => Object.keys(raw).every(key => keys.includes(key))
const text = (value: unknown, max: number = RESEARCH_LIMITS.text): value is string => typeof value === 'string' && value.length <= max
const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === 'string' && (list as readonly string[]).includes(value)
const list = (value: unknown, max: number): value is unknown[] => Array.isArray(value) && value.length <= max

function readStop(raw: unknown): FrameJourneyStop | null {
  if (!plain(raw) || !closed(raw, ['name', 'words', 'hold', 'seconds', 'kind', 'curve', 'switch', 'direction', 'at'])) return null
  if (!text(raw.name) || !text(raw.words) || !finite(raw.hold) || raw.hold < 0 || !finite(raw.seconds) || raw.seconds < 0
    || !oneOf(TRANSITION_KINDS, raw.kind) || !oneOf(CURVE_TYPES, raw.curve) || !oneOf(SWITCH_MODES, raw.switch)) return null
  if (raw.direction !== undefined && !oneOf(WIPE_DIRECTIONS, raw.direction)) return null
  if (raw.at !== undefined && (!finite(raw.at) || raw.at < 0 || raw.at > 1)) return null
  return {name: raw.name, words: raw.words, hold: raw.hold, seconds: raw.seconds, kind: raw.kind, curve: raw.curve, switch: raw.switch,
    ...(raw.direction !== undefined ? {direction: raw.direction as WipeDirection} : {}), ...(raw.at !== undefined ? {at: raw.at as number} : {})}
}
function readJourney(raw: unknown): FrameJourneyReading | null {
  if (!plain(raw) || !closed(raw, ['name', 'loops', 'stopAtEnd', 'at', 'local', 'playing', 'entered', 'stops'])) return null
  if (!text(raw.name) || typeof raw.loops !== 'boolean' || typeof raw.stopAtEnd !== 'boolean' || !Number.isSafeInteger(raw.at) || (raw.at as number) < 0
    || !finite(raw.local) || raw.local < 0 || typeof raw.playing !== 'boolean' || typeof raw.entered !== 'boolean' || !list(raw.stops, RESEARCH_LIMITS.stops)) return null
  const stops = raw.stops.map(readStop)
  if (stops.some(stop => stop === null)) return null
  return {name: raw.name, loops: raw.loops, stopAtEnd: raw.stopAtEnd, at: raw.at as number, local: raw.local, playing: raw.playing, entered: raw.entered, stops: stops as FrameJourneyStop[]}
}
function readCanvas(raw: unknown): FrameCanvasReading | null {
  if (!plain(raw) || !closed(raw, ['items', 'lines', 'frames', 'camera', 'selected', 'selectedLine', 'drawing', 'erasing', 'lasso', 'snap'])) return null
  if (!list(raw.items, RESEARCH_LIMITS.items) || !list(raw.lines, RESEARCH_LIMITS.lines) || !list(raw.frames, RESEARCH_LIMITS.frames) || !list(raw.selected, RESEARCH_LIMITS.items)) return null
  for (const key of ['drawing', 'erasing', 'lasso', 'snap'] as const) if (typeof raw[key] !== 'boolean') return null
  const items: FrameCanvasItem[] = []
  for (const item of raw.items) {
    if (!plain(item) || !closed(item, ['id', 'kind', 'x', 'y', 'w', 'h', 'name']) || !text(item.id) || !item.id || !oneOf(CANVAS_ITEM_KINDS, item.kind) || !text(item.name)) return null
    if (![item.x, item.y, item.w, item.h].every(finite)) return null
    items.push({id: item.id, kind: item.kind, x: item.x as number, y: item.y as number, w: item.w as number, h: item.h as number, name: item.name})
  }
  const lines: FrameCanvasLine[] = []
  for (const line of raw.lines) {
    if (!plain(line) || !closed(line, ['id', 'from', 'to', 'kind', 'label', 'fromSide', 'toSide', 'direction']) || !text(line.id) || !text(line.from) || !text(line.to)) return null
    if (line.kind !== undefined && !oneOf(CANVAS_LINE_KINDS, line.kind) || line.label !== undefined && !text(line.label)) return null
    if (line.fromSide !== undefined && !oneOf(CANVAS_SIDES, line.fromSide) || line.toSide !== undefined && !oneOf(CANVAS_SIDES, line.toSide)) return null
    if (line.direction !== undefined && line.direction !== 'directed' && line.direction !== 'undirected') return null
    lines.push(line as unknown as FrameCanvasLine)
  }
  const frames: {title: string; members: string[]}[] = []
  for (const frame of raw.frames) {
    if (!plain(frame) || !closed(frame, ['title', 'members']) || !text(frame.title) || !list(frame.members, RESEARCH_LIMITS.items) || !frame.members.every(member => text(member))) return null
    frames.push({title: frame.title, members: frame.members as string[]})
  }
  if (!raw.selected.every(id => text(id))) return null
  let camera: FrameCanvasReading['camera']
  if (raw.camera !== undefined) {
    if (!plain(raw.camera) || !closed(raw.camera, ['cx', 'cy', 'zoom']) || !finite(raw.camera.cx) || !finite(raw.camera.cy) || !finite(raw.camera.zoom) || raw.camera.zoom <= 0) return null
    camera = {cx: raw.camera.cx, cy: raw.camera.cy, zoom: raw.camera.zoom}
  }
  if (raw.selectedLine !== undefined && !text(raw.selectedLine)) return null
  return {items, lines, frames, ...(camera ? {camera} : {}), selected: raw.selected as string[], ...(raw.selectedLine !== undefined ? {selectedLine: raw.selectedLine as string} : {}),
    drawing: raw.drawing as boolean, erasing: raw.erasing as boolean, lasso: raw.lasso as boolean, snap: raw.snap as boolean}
}
function readTimeline(raw: unknown): FrameTimelineReading | null {
  if (!plain(raw) || !closed(raw, ['projection', 'events', 'edges', 'domain', 'centre', 'zoom', 'views'])) return null
  if (!oneOf(TIMELINE_PROJECTIONS, raw.projection) || !list(raw.events, RESEARCH_LIMITS.events) || !list(raw.edges, RESEARCH_LIMITS.edges) || !list(raw.views, RESEARCH_LIMITS.views)) return null
  const events: FrameTimelineEvent[] = []
  for (const event of raw.events) {
    if (!plain(event) || !closed(event, ['id', 'name', 'from', 'to', 'family', 'historicity']) || !text(event.id) || !text(event.name) || !finite(event.from) || !finite(event.to)) return null
    if (event.family !== undefined && !text(event.family, 64) || event.historicity !== undefined && !text(event.historicity, 64)) return null
    events.push(event as unknown as FrameTimelineEvent)
  }
  for (const edge of raw.edges) {
    if (!plain(edge) || !closed(edge, ['id', 'from', 'to', 'kind', 'standing']) || !text(edge.id) || !text(edge.from) || !text(edge.to) || !text(edge.kind, 64)) return null
    if (edge.standing !== undefined && !text(edge.standing, 64)) return null
  }
  for (const view of raw.views) if (!plain(view) || !closed(view, ['id', 'label']) || !text(view.id, 128) || !text(view.label, 128)) return null
  if (raw.domain !== undefined && (!plain(raw.domain) || !closed(raw.domain, ['from', 'to']) || !finite(raw.domain.from) || !finite(raw.domain.to))) return null
  if (raw.centre !== undefined && !finite(raw.centre) || raw.zoom !== undefined && (!finite(raw.zoom) || raw.zoom <= 0)) return null
  return {projection: raw.projection, events, edges: raw.edges as FrameTimelineReading['edges'], ...(raw.domain !== undefined ? {domain: raw.domain as {from: number; to: number}} : {}),
    ...(raw.centre !== undefined ? {centre: raw.centre as number} : {}), ...(raw.zoom !== undefined ? {zoom: raw.zoom as number} : {}), views: raw.views as FrameTimelineReading['views']}
}

/** The research state as the frame announced it, exact or refused (null): every key is closed, every string and list bounded. */
export function readFrameResearch(raw: unknown): FrameResearchReading | null {
  if (!plain(raw) || !closed(raw, ['journey', 'canvas', 'timeline'])) return null
  const out: FrameResearchReading = {}
  if (raw.journey !== undefined) { const journey = readJourney(raw.journey); if (!journey) return null; out.journey = journey }
  if (raw.canvas !== undefined) { const canvas = readCanvas(raw.canvas); if (!canvas) return null; out.canvas = canvas }
  if (raw.timeline !== undefined) { const timeline = readTimeline(raw.timeline); if (!timeline) return null; out.timeline = timeline }
  return out
}
