import type {Entity, NativeEditorChange, NativeEditorReading, Scene, Vec3} from '../../../../expressions-boundary/src/editor'
import type {SceneFaceModel} from './nativeSceneFaceModel.ts'

/** The Arrangement section of the app's Objects panel (inspector.ts objects(), group 'Arrangement'), in the app's button order. */
export const ARRANGE_LAYOUTS = ['line', 'column', 'ring', 'grid', 'spiral', 'align-x', 'align-y', 'distribute-x', 'distribute-y', 'laminate'] as const
export type ArrangeLayout = (typeof ARRANGE_LAYOUTS)[number]
/** The app's button text: `layout.replace('-', ' ')` (inspector.ts objects()). */
export const arrangeLabel = (layout: ArrangeLayout): string => layout.replace('-', ' ')

export type Plane = Scene['composition']['plane']
export const PLANES = ['XY', 'XZ', 'YZ'] as const satisfies readonly Plane[]
export type Axis = 'x' | 'y' | 'z'
/** The stage axes a plane draws, horizontal first (timeline.ts arrange: `axes`). */
export const planeAxes = (plane: Plane): [Axis, Axis] => plane === 'XY' ? ['x', 'y'] : plane === 'XZ' ? ['x', 'z'] : ['y', 'z']

/** The boundary admits 1 to 256 device changes in one gesture (nativeDeviceEdits.ts applyNativeDeviceChanges). */
export const ARRANGE_CHANGE_BUDGET = 256
/** The boundary's entity position target (parameters.ts entityTargets): `entity:<encoded id>:<axis>`, in stage units. */
export const entityAxisTarget = (entityId: string, axis: Axis): string => `entity:${encodeURIComponent(entityId)}:${axis}`
/** The layout plane as one admitted panel setting (nativeFieldPanelSettings.ts FIELD_PANEL_SETTINGS.plane). */
export const planeChange = (plane: Plane): NativeEditorChange => ({kind: 'panel-setting', key: 'plane', value: plane})

/** The Scene's blueprint members by entity id (blueprintGeometry.ts blueprintMember reads the same field). */
export const blueprintMemberIds = (scene: Pick<Scene, 'composition'>): ReadonlySet<string> =>
  new Set((scene.composition.blueprint?.members ?? []).map(member => member.entity_ref))

/** Whether arrange may move this centre, and the reason it may not. app.ts 'arrange' skips locked centres and refuses blueprint members. */
export function centreStatus(entity: Pick<Entity, 'id' | 'locked'>, blueprint: ReadonlySet<string>): {movable: boolean; reason: string | null} {
  if (entity.locked) return {movable: false, reason: 'Locked. Unlock this centre to arrange it; arrange skips locked centres.'}
  if (blueprint.has(entity.id)) return {movable: false, reason: 'Blueprint member. Release the Blueprint before moving this centre by itself.'}
  return {movable: true, reason: null}
}

export type QuickSelect = 'formations' | 'pins' | 'all' | 'none'
/** The checklist a quick select produces: only centres arrange can move. 'none' is empty. */
export function quickSelect(entities: readonly Entity[], which: QuickSelect, blueprint: ReadonlySet<string>): ReadonlySet<string> {
  const ids = entities.filter(entity => which !== 'none' && centreStatus(entity, blueprint).movable
    && (which === 'all' || (which === 'formations' ? entity.kind === 'formation' : entity.kind === 'pin'))).map(entity => entity.id)
  return new Set(ids)
}

export type Centre = {id: string; position: Vec3}
/** The positions one arrange mode produces for these centres, ported from timeline.ts arrange(). Pure: the input is not touched.
 * The app moves each centre in place; here the result is a copy so the same math serves the preview and the change batch. */
export function arrangedPositions(centres: readonly Centre[], layout: ArrangeLayout, plane: Plane): Centre[] {
  const TAU = Math.PI * 2
  const next: Centre[] = centres.map(centre => ({id: centre.id, position: {...centre.position}}))
  const n = next.length
  if (!n) return next
  const [horizontal, vertical] = planeAxes(plane)
  const byAxis = (axis: Axis) => [...next].sort((a, b) => a.position[axis] - b.position[axis])
  if (layout.startsWith('align-') || layout.startsWith('distribute-')) {
    const axis = layout.endsWith('x') ? horizontal : vertical
    const ordered = byAxis(axis)
    const lo = ordered[0].position[axis], hi = ordered[n - 1].position[axis]
    const mean = ordered.reduce((sum, centre) => sum + centre.position[axis], 0) / n
    ordered.forEach((centre, i) => {centre.position[axis] = layout.startsWith('align-') ? mean : lo + (hi - lo) * i / Math.max(1, n - 1)})
    return next
  }
  // laminate: stack the centres through depth, the plane's normal, centred on their mean, over the .6 pitch a grid row uses.
  if (layout === 'laminate') {
    const axis: Axis = plane === 'XY' ? 'z' : plane === 'XZ' ? 'y' : 'x'
    const ordered = byAxis(axis)
    const mean = ordered.reduce((sum, centre) => sum + centre.position[axis], 0) / n
    ordered.forEach((centre, i) => {centre.position[axis] = mean + (n > 1 ? (i / (n - 1) - .5) * .6 : 0)})
    return next
  }
  next.forEach((centre, i) => {
    let x = 0, y = 0
    const f = n === 1 ? .5 : i / (n - 1)
    if (layout === 'line') x = (f - .5) * 1.8
    else if (layout === 'column') y = (.5 - f) * 1.8
    else if (layout === 'ring') {const a = i / n * TAU; x = Math.cos(a) * .72; y = Math.sin(a) * .72}
    else if (layout === 'spiral') {const a = i / n * TAU * 1.5, r = .15 + f * .7; x = Math.cos(a) * r; y = Math.sin(a) * r}
    else if (layout === 'grid') {const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols); x = (i % cols - (cols - 1) / 2) * .6; y = ((rows - 1) / 2 - Math.floor(i / cols)) * .6}
    else return
    if (plane === 'XY') {centre.position.x = x; centre.position.y = y}
    else if (plane === 'XZ') {centre.position.x = x; centre.position.z = y}
    else {centre.position.y = x; centre.position.z = y}
  })
  return next
}

export interface ArrangePlan {
  /** The checked centres arrange can move, in the Scene's order. */
  movable: readonly string[]
  /** Where the chosen mode puts each movable centre. Empty when no mode is chosen. */
  ghost: readonly Centre[]
  /** The one batch Apply sends: one `parameter` change per coordinate that moves. Empty when nothing would move or a problem blocks it. */
  changes: readonly NativeEditorChange[]
  /** A refusal to show before any send, or null. */
  problem: string | null
}

/** The whole arrange gesture as data: which centres move, where they go, and the one batch that moves them. */
export function arrangePlan(entities: readonly Entity[], checked: ReadonlySet<string>, blueprint: ReadonlySet<string>,
  layout: ArrangeLayout | null, plane: Plane): ArrangePlan {
  if (!layout) return {movable: [], ghost: [], changes: [], problem: null}
  const moving = entities.filter(entity => checked.has(entity.id) && centreStatus(entity, blueprint).movable)
  if (!moving.length) return {movable: [], ghost: [], changes: [], problem: 'Check at least one unlocked centre to arrange.'}
  const ghost = arrangedPositions(moving, layout, plane)
  const changes: NativeEditorChange[] = []
  moving.forEach((entity, i) => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const value = ghost[i].position[axis]
      if (value !== entity.position[axis]) changes.push({kind: 'parameter', target: entityAxisTarget(entity.id, axis), value})
    }
  })
  const problem = changes.length > ARRANGE_CHANGE_BUDGET
    ? `This arrangement moves ${changes.length} coordinates; one change holds ${ARRANGE_CHANGE_BUDGET}. Check fewer centres.` : null
  return {movable: moving.map(entity => entity.id), ghost, changes: problem ? [] : changes, problem}
}

/** The coordinates each movable centre changes, for the readout: every axis that moves, including depth the plane does not draw. */
export function previewMoves(entities: readonly Entity[], plan: ArrangePlan): {id: string; name: string; text: string}[] {
  const fmt = (value: number) => String(Number(value.toFixed(3)))
  return plan.ghost.flatMap(to => {
    const entity = entities.find(item => item.id === to.id)
    if (!entity) return []
    const text = (['x', 'y', 'z'] as const).filter(axis => to.position[axis] !== entity.position[axis])
      .map(axis => `${axis.toUpperCase()} ${fmt(entity.position[axis])} to ${fmt(to.position[axis])}`).join(' · ')
    return text ? [{id: entity.id, name: entity.name, text}] : []
  })
}

export const PREVIEW_WIDTH = 360
export const PREVIEW_HEIGHT = 200
export interface PreviewMark {id: string; name: string; x: number; y: number}
/** Plane drawing: current centres and ghost centres in pixels, scaled to fit both. Up is +vertical axis, as the plane's labels say. */
export function previewGeometry(entities: readonly Entity[], ghost: readonly Centre[], plane: Plane):
  {axes: [Axis, Axis]; current: PreviewMark[]; ghost: PreviewMark[]} {
  const [horizontal, vertical] = planeAxes(plane)
  const names = new Map(entities.map(entity => [entity.id, entity.name]))
  const current = entities.map(entity => ({id: entity.id, name: entity.name, h: entity.position[horizontal], v: entity.position[vertical]}))
  const ghostMarks = ghost.map(centre => ({id: centre.id, name: names.get(centre.id) ?? centre.id, h: centre.position[horizontal], v: centre.position[vertical]}))
  const all = [...current, ...ghostMarks]
  const extentH = Math.max(1, all.reduce((max, mark) => Math.max(max, Math.abs(mark.h)), 0))
  const extentV = Math.max(1, all.reduce((max, mark) => Math.max(max, Math.abs(mark.v)), 0))
  const scale = Math.min((PREVIEW_WIDTH / 2 - 28) / extentH, (PREVIEW_HEIGHT / 2 - 22) / extentV)
  const place = (mark: {id: string; name: string; h: number; v: number}): PreviewMark =>
    ({id: mark.id, name: mark.name, x: PREVIEW_WIDTH / 2 + mark.h * scale, y: PREVIEW_HEIGHT / 2 - mark.v * scale})
  return {axes: [horizontal, vertical], current: current.map(place), ghost: ghostMarks.map(place)}
}

/** Summary the rack widget and Browser show: `N objects · plane XY`. An undisclosed list or plane is named as such, never as empty. */
export function arrangeSummary(reading: NativeEditorReading): string {
  const entities = reading.scene?.entities
  if (!Array.isArray(entities)) return 'Objects not disclosed'
  const count = entities.length
  return `${count} ${count === 1 ? 'object' : 'objects'} · plane ${reading.scene.composition?.plane ?? 'not disclosed'}`
}

export const arrangeFaceModel: SceneFaceModel = {
  name: 'Arrangement',
  groups: [{title: 'Objects'}, {title: 'Arrangement'}],
  summary: arrangeSummary,
  enabled: () => undefined,
  studio: 'layout',
}
