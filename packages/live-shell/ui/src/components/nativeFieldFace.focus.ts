import type {NativeEditorReading, Scene} from '../../../../expressions-boundary/src/editor'
import {NATIVE_BINDINGS, baseValue} from '@epilogos/expressions-boundary/parameters'
import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import type {HandleGeometry} from './nativeFieldHandleModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Travelling focus: the Scene's formation route, its dwell and glide timing, and the two tint weights.
 * Every fact is read from the reading; the engine relations are cited where the view or summary uses them. */

/** The app panel's numeric parameters (inspector.ts:230-232, registry group Composition in paramRegistry.ts:182-185). */
export const FOCUS_PATHS = {
  dwell: 'composition.orchestration.dwell',
  glide: 'composition.orchestration.glide',
  focusTint: 'composition.orchestration.focusTintWeight',
  entityTint: 'composition.entityTintWeight',
} as const

export type FocusOrder = 'listed' | 'reverse' | 'pingpong'

/** Pure list move: the item at `from` lands at index `to`. Out-of-range or equal indices return an unchanged copy. */
export function reorder<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= next.length || to >= next.length || from === to) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved as T)
  return next
}

/** A drop before `insertion` (0..count) of the row at `from`, as the index it lands on once the row is removed. */
export function dropTarget(from: number, insertion: number, count: number): number {
  const to = insertion > from ? insertion - 1 : insertion
  return Math.min(count - 1, Math.max(0, to))
}

/** The engine's visiting order. listed loops the route; reverse loops it backwards (resolveFocus flips the index,
 * fieldModel.ts:425); pingpong runs out and back (orderedIndex, fieldModel.ts:299-302), so a route of n has 2(n-1) steps. */
export function visitOrder<T>(items: readonly T[], order: FocusOrder): T[] {
  const n = items.length
  if (order !== 'pingpong' || n <= 1) return order === 'reverse' ? [...items].reverse() : [...items]
  const period = (n - 1) * 2
  return Array.from({length: period}, (_, step) => items[step < n ? step : period - step] as T)
}

/** The engine step period: resolveFocus uses max(0.05, dwell + glide) (fieldModel.ts:420-421). */
export const focusPeriod = (dwell: number, glide: number) => Math.max(0.05, dwell + glide)

/** Seconds ruler span shown by the dwell and glide handles. */
export const RULER_SECONDS = 30

export interface FocusRouteRow {id: string; name: string; tint: string; number: number; enabled: boolean}
/** Every formation of the Scene in route order. The engine plays `enabled !== false` only (nativeBridge.ts:48 writes
 * the flag that PointCloudField.ts:371-373 filters on), so an absent flag counts as on. */
export function focusRoute(scene: Pick<Scene, 'entities'>): FocusRouteRow[] {
  return scene.entities.filter(entity => entity.kind === 'formation').map((entity, index) => ({
    id: entity.id, name: entity.name, tint: entity.tint, number: index + 1, enabled: entity.enabled !== false,
  }))
}

/** The complete ordered formation id list, the only shape the route-order admission accepts (nativeDeviceEdits.ts:61-68). */
export const routeOrderChange = (ids: readonly string[]) => ({kind: 'route-order' as const, entity_ids: [...ids]})

export function focusBinding(path: string) {
  const binding = NATIVE_BINDINGS.find(row => row.path === path)
  if (!binding) throw Error(`Travelling focus has no native binding for ${path}`)
  return binding
}
/** Current base value of a native path, from the same lookup the full editors use. */
export function focusValue(scene: Scene, path: string): number {
  return baseValue(scene, focusBinding(path).key)
}

/** Handle geometry for a linear binding laid on a fixed px-per-unit scale: the handle sits at originX + value * scale. */
export function rulerGeometry(binding: {min: number; max: number}, originX: number, y: number, scale: number): HandleGeometry {
  return {origin: {x: originX + binding.min * scale, y}, dir: {x: 1, y: 0}, length: (binding.max - binding.min) * scale}
}

export interface FocusLoop {steps: FocusRouteRow[]; period: number; cycleSeconds: number; parallel: boolean}
/** The loop the engine plays from this reading. Parallel means the route is not played; it is still shown as configured. */
export function focusLoop(scene: Scene): FocusLoop {
  const enabled = focusRoute(scene).filter(row => row.enabled)
  const period = focusPeriod(focusValue(scene, FOCUS_PATHS.dwell), focusValue(scene, FOCUS_PATHS.glide))
  const steps = visitOrder(enabled, scene.engine.focusOrder ?? 'listed')
  return {steps, period, cycleSeconds: steps.length * period, parallel: focusMode(scene) !== 'travelling'}
}

/** Focus is on when the composition mode is travelling: the engine gates the route on mode === 'focus' (fieldModel.ts:417),
 * with the mode written from Scene.composition.focus (nativeBridge.ts:85). The mode is a string, so there is no toggle. */
export const focusEnabled = (reading: Pick<NativeEditorReading, 'scene'>) => focusMode(reading.scene) === 'travelling'
/** Absent composition reads as parallel (the authored default, model.ts:85), so a partial reading never throws. */
const focusMode = (scene: Pick<Scene, 'composition'>) => scene.composition?.focus ?? 'parallel'

export const focusFaceModel: FieldFaceModel = {
  name: 'Travelling focus',
  paths: [FOCUS_PATHS.dwell, FOCUS_PATHS.glide, FOCUS_PATHS.focusTint, FOCUS_PATHS.entityTint],
  controlPath: FOCUS_PATHS.entityTint,
  enabled: focusEnabled,
  strip: {
    summary: ({scene}) => {
      const loop = focusLoop(scene)
      return `${loop.parallel ? 'parallel' : 'travelling'} · ${loop.steps.length} on route · dwell ${fieldValue(scene, FOCUS_PATHS.dwell)} s · glide ${fieldValue(scene, FOCUS_PATHS.glide)} s`
    },
    toggle: null,
  },
  groups: [
    {title: 'Timing and direction', paths: [FOCUS_PATHS.dwell, FOCUS_PATHS.glide], note: 'One step holds a formation for dwell, then travels for glide: period = dwell + glide.'},
    {title: 'Visible contributions', paths: [FOCUS_PATHS.entityTint, FOCUS_PATHS.focusTint], note: 'Focus contributes over local tint and the field palette. It never replaces the stored swatches.'},
  ],
  // A performer rides timing and how strongly the focus tints; the entity tint stays on the bottom slider (controlPath).
  compact: [FOCUS_PATHS.dwell, FOCUS_PATHS.glide, FOCUS_PATHS.focusTint],
  studio: 'focus',
}
