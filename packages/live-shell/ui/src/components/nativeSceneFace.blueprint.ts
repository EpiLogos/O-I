import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {
  BLUEPRINT_BASE_SIZE, BLUEPRINT_POSITION_RANGE, BLUEPRINT_ROTATION_RANGE, BLUEPRINT_SIZE_RANGE, BLUEPRINT_WORLD_SCALE,
  blueprintDisplayOf, blueprintSitePoint, validateBlueprintIntent, type BlueprintDisplayTransform, type NativeBlueprintIntent,
  type NativeBlueprintRequest,
} from '../../../../expressions-boundary/src/nativeBlueprintEdits'
import type {SceneFaceModel} from './nativeSceneFaceModel.ts'

/** The presented Scene's native binding: a SceneBlueprint when bound, null when unbound, undefined when the reading does not disclose it. */
export type BlueprintBinding = NonNullable<NonNullable<NativeEditorReading['nativeScene']>['blueprint']>
export function bindingOf(reading: NativeEditorReading): BlueprintBinding | null | undefined {
  return reading.nativeScene ? reading.nativeScene.blueprint : undefined
}

/** The summary the rack widget and Browser show. An undisclosed binding is named as not in the reading, never as unbound. */
export function blueprintSummary(reading: NativeEditorReading): string {
  const binding = bindingOf(reading)
  if (binding === undefined) return 'Blueprint not in the reading'
  if (binding === null) return 'not bound'
  const count = binding.members.length
  return `bound ${count} member${count === 1 ? '' : 's'}`
}

export const blueprintFaceModel: SceneFaceModel = {
  name: 'Blueprint',
  groups: [{title: 'Sixfold roles'}, {title: 'Whole transform'}],
  summary: blueprintSummary,
  // The blueprint has no enable operation, so the activator is hollow.
  enabled: () => undefined,
  // No compact actions: the rack widget's actions are apply changes, and blueprint edits are their own request. The widget shows the summary.
  studio: 'blueprint',
}

// ---- Display values ------------------------------------------------------------

/** The committed transform in the panel's units, or null when the Scene is unbound or the reading does not disclose it. */
export function committedDisplay(binding: BlueprintBinding | null | undefined): BlueprintDisplayTransform | null {
  return binding ? blueprintDisplayOf(binding.transform) : null
}
/** Two decimals (the HUD's step), with negative zero normalised. */
const round2 = (value: number) => Math.round(value * 100) / 100 + 0
const clampTo = (value: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, value))
/** Round, then clamp: a rounded value can never leave the admitted range, even at its ends. */
const roundClamp = (value: number, range: readonly [number, number]) => clampTo(round2(value), range)

/** The one request for an intent, on the reading's captured basis. The intent is validated first, so an out-of-range value is never sent. */
export function blueprintRequest(reading: NativeEditorReading, intent: NativeBlueprintIntent): NativeBlueprintRequest {
  return {operation: 'blueprint', basis: structuredClone(reading.basis), intent: validateBlueprintIntent(intent)}
}
/** The whole-transform intent for a display transform, in the admitted units. */
export function transformIntent(value: BlueprintDisplayTransform): NativeBlueprintIntent {
  return {
    operation: 'transform',
    translation: [value.translation[0], value.translation[1], value.translation[2]],
    rotation_degrees: [value.rotationDegrees[0], value.rotationDegrees[1], value.rotationDegrees[2]],
    size: value.size,
  }
}
/** True when the draft differs from the committed transform in any field. */
export function sameDisplay(a: BlueprintDisplayTransform, b: BlueprintDisplayTransform): boolean {
  return a.translation.every((v, i) => v === b.translation[i]) && a.rotationDegrees.every((v, i) => v === b.rotationDegrees[i]) && a.size === b.size
}

// ---- Plan view -----------------------------------------------------------------

/** The plan view spans the admitted stage range (±4 units, the position bound), so nothing admitted falls outside the drawing. */
export const PLAN = {half: BLUEPRINT_POSITION_RANGE[1], px: 400} as const
export const PLAN_UNIT = PLAN.px / (2 * PLAN.half)
/** Stage units (x right, y up) to the SVG's pixel frame (y down). */
export function planPoint(x: number, y: number): {x: number; y: number} {
  return {x: PLAN.px / 2 + x * PLAN_UNIT, y: PLAN.px / 2 - y * PLAN_UNIT}
}
/** A pointer position in stage units, from the plan's bounding box. */
export function stageFromBox(box: {left: number; top: number; width: number; height: number}, clientX: number, clientY: number): {x: number; y: number} {
  if (!(box.width > 0) || !(box.height > 0)) return {x: 0, y: 0}
  return {x: (clientX - box.left) / box.width * 2 * PLAN.half - PLAN.half, y: PLAN.half - (clientY - box.top) / box.height * 2 * PLAN.half}
}

/** Where each bound member sits: its QL site moved by the app's own transform law (blueprintSitePoint), in stage units. */
export function memberPoints(binding: BlueprintBinding, transform = binding.transform): {entity_ref: string; position: number; x: number; y: number}[] {
  return binding.members.map(member => {
    const [x, y] = blueprintSitePoint(member.position, transform)
    return {entity_ref: member.entity_ref, position: member.position, x: x / BLUEPRINT_WORLD_SCALE, y: y / BLUEPRINT_WORLD_SCALE}
  })
}
/** The name of a member's Scene entity, found through the reading's occurrence map. Null when the reading does not show it. */
export function memberName(reading: NativeEditorReading, entityRef: string): string | null {
  const viewId = Object.entries(reading.entityOccurrences).find(([, ref]) => ref === entityRef)?.[0]
  return reading.scene.entities.find(entity => entity.id === viewId)?.name || null
}

// ---- Handles -------------------------------------------------------------------

/** Drag or keyboard position for the centre handle: the pointer's stage point, clamped and rounded to the HUD's two decimals. */
export function centreFromPoint(point: {x: number; y: number}): [number, number] {
  return [roundClamp(point.x, BLUEPRINT_POSITION_RANGE), roundClamp(point.y, BLUEPRINT_POSITION_RANGE)]
}
/** The relative size that puts the outer handle under the pointer: the distance from the centre over the size-1 radius (BASE_SIZE / WORLD_SCALE). */
export function sizeFromPoint(translation: readonly [number, number, number], point: {x: number; y: number}): number {
  const radius = Math.hypot(point.x - translation[0], point.y - translation[1])
  return roundClamp(radius / (BLUEPRINT_BASE_SIZE / BLUEPRINT_WORLD_SCALE), BLUEPRINT_SIZE_RANGE)
}
/** The outer handle's stage position for a relative size, on the +X axis from the centre. */
export function sizeHandlePoint(translation: readonly [number, number, number], size: number): {x: number; y: number} {
  return {x: translation[0] + size * BLUEPRINT_BASE_SIZE / BLUEPRINT_WORLD_SCALE, y: translation[1]}
}

/** Keyboard steps: the HUD's own input steps (0.05), Shift for ten times that. Null for any other key. */
export function keyDelta(key: string, shift: boolean): {dx: number; dy: number; dsize: number} | null {
  const step = shift ? 0.5 : 0.05
  if (key === 'ArrowLeft') return {dx: -step, dy: 0, dsize: 0}
  if (key === 'ArrowRight') return {dx: step, dy: 0, dsize: 0}
  if (key === 'ArrowDown') return {dx: 0, dy: -step, dsize: 0}
  if (key === 'ArrowUp') return {dx: 0, dy: step, dsize: 0}
  return null
}
/** A keyboard move of the centre, clamped and rounded. */
export function movedCentre(value: BlueprintDisplayTransform, dx: number, dy: number): BlueprintDisplayTransform {
  const [x, y] = centreFromPoint({x: value.translation[0] + dx, y: value.translation[1] + dy})
  return {...value, translation: [x, y, value.translation[2]]}
}
/** A keyboard move of the relative size, clamped and rounded. */
export function resized(value: BlueprintDisplayTransform, delta: number): BlueprintDisplayTransform {
  return {...value, size: roundClamp(value.size + delta, BLUEPRINT_SIZE_RANGE)}
}

/** The exact-value fields the whole transform shows, in app order (HUD: position, rotation, relative size). */
export const FIELD_KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'size'] as const
export type FieldKey = typeof FIELD_KEYS[number]
export const FIELD_LABELS: Record<FieldKey, string> = {
  x: 'Position X', y: 'Position Y', z: 'Position Z',
  rx: 'Rotation X (°)', ry: 'Rotation Y (°)', rz: 'Rotation Z (°)',
  size: 'Relative size',
}
export const FIELD_RANGE: Record<FieldKey, readonly [number, number]> = {
  x: BLUEPRINT_POSITION_RANGE, y: BLUEPRINT_POSITION_RANGE, z: BLUEPRINT_POSITION_RANGE,
  rx: BLUEPRINT_ROTATION_RANGE, ry: BLUEPRINT_ROTATION_RANGE, rz: BLUEPRINT_ROTATION_RANGE,
  size: BLUEPRINT_SIZE_RANGE,
}
/** The display value a field shows for a transform. */
export function fieldValue(value: BlueprintDisplayTransform, key: FieldKey): number {
  if (key === 'size') return value.size
  const index = {x: 0, y: 1, z: 2, rx: 0, ry: 1, rz: 2}[key] as 0 | 1 | 2
  return key.startsWith('r') ? value.rotationDegrees[index] : value.translation[index]
}
/** A transform with one field replaced by a parsed value. */
export function withField(value: BlueprintDisplayTransform, key: FieldKey, next: number): BlueprintDisplayTransform {
  if (key === 'size') return {...value, size: next}
  const index = {x: 0, y: 1, z: 2, rx: 0, ry: 1, rz: 2}[key] as 0 | 1 | 2
  if (key.startsWith('r')) {const rotationDegrees = [...value.rotationDegrees] as [number, number, number]; rotationDegrees[index] = next; return {...value, rotationDegrees}}
  const translation = [...value.translation] as [number, number, number]; translation[index] = next
  return {...value, translation}
}
