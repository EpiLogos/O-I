import type {Entity, NativeEditorReading, NativeEntitySettingChange, NativeObjectChange, Scene} from '../../../../expressions-boundary/src/editor'
import type {EntityFaceModel} from './nativeEntityFaceModel.ts'

/** Formation: the Objects panel's formation branch (desktop/cradle/expressions-app/field-studies-journeys/src/inspector.ts entityControls, the
 * Position, Width/Height, Scale, Rotation, Particle share and Stored tint rows). The Influence group (forces.*) belongs to the Force device and the
 * sequence rows to the Glyph Sequence editor, so neither is a path here. Pure: no React, no commits. */

/** Numeric parameters of the formation panel, in app order. Each suffix is an entityTargets key for a formation. */
export const FORMATION_PATHS = ['x', 'y', 'z', 'size.x', 'size.y', 'scale', 'rotation', 'share', 'tintWeight'] as const

/** Shape labels as the inspector names them (inspector.ts shapeOptions). The shape itself is edited in Glyph Sequence. */
export const FORMATION_SHAPE_LABELS: Record<Entity['shape'], string> = {
  text: 'Glyph or word', ring: 'Ring', disc: 'Disc', square: 'Plane', triangle: 'Triangle', yantra: 'Canonical yantra', cymatic: 'Authored cymatic template',
}

/** Name limit the boundary admits (nativeEntitySettings.ts ENTITY_SETTING_NAME_LIMIT). */
const NAME_LIMIT = 160

/** The denominator of the particle share: the sum over ENABLED formations, or 1 when that sum is zero (inspector.ts entityControls, `total ... || 1`).
 * The engine normalises the same way (nativeDeviceEdits.ts entity-setting branch: share is never touched). */
export function enabledShareTotal(entities: readonly Entity[]): number {
  return entities.reduce((sum, item) => item.kind === 'formation' && item.enabled !== false ? sum + item.share : sum, 0) || 1
}

export interface FormationShareRow {id: string; name: string; enabled: boolean; share: number; fraction: number | null}
/** One row per formation (pins own no share). fraction = share / enabledShareTotal for an enabled formation, null for a disabled one: a disabled
 * formation is excluded from the normalisation, so it has no fraction. Derived from the reading only. */
export function formationShareRows(entities: readonly Entity[]): FormationShareRow[] {
  const total = enabledShareTotal(entities)
  return entities.filter(item => item.kind === 'formation').map(item => {
    const enabled = item.enabled !== false
    return {id: item.id, name: item.name, enabled, share: item.share, fraction: enabled ? item.share / total : null}
  })
}

/** Blueprint membership as the reading marks it: the Scene's composition.blueprint members (blueprintGeometry.ts blueprintMember). */
export function isBlueprintMember(scene: Scene, entity: Entity): boolean {
  return scene.composition?.blueprint?.members.some(member => member.entity_ref === entity.id) ?? false
}

/** Suffixes this panel cannot change right now. A blueprint member's position is held by the Blueprint: the boundary refuses it
 * (nativeDeviceEdits.ts, `blueprintMember ... 'Use Blueprint to move this shape'`). */
export function formationFrozenPaths(scene: Scene, entity: Entity): readonly string[] {
  return isBlueprintMember(scene, entity) ? ['x', 'y', 'z'] : []
}

export interface FormationGate {name: boolean; enabled: boolean; lock: boolean; reason: string | null}
/** The lock law (nativeEntitySettings.ts ENTITY_SETTING_EXEMPT_FROM_LOCK): while an entity is locked only Lock is changeable.
 * `disabled` is the value the editor body passes (its own busy or read-only state OR the lock, see NativeDeviceEditors EntityFaceBody),
 * so the Lock row subtracts the lock to keep working on a locked entity. */
export function formationGate(entity: Entity, disabled: boolean): FormationGate {
  return {
    name: disabled || entity.locked,
    enabled: disabled || entity.locked,
    lock: disabled && !entity.locked,
    reason: entity.locked ? 'Locked: unlock to change the name or the enabled state. Lock itself stays available.' : null,
  }
}

/** The admitted object-setting change for one key (the shape nativeEntitySettings.ts validates). */
export function formationSettingChange(entity: Entity, key: 'name', value: string): NativeEntitySettingChange
export function formationSettingChange(entity: Entity, key: 'locked' | 'enabled', value: boolean): NativeEntitySettingChange
export function formationSettingChange(entity: Entity, key: 'name' | 'locked' | 'enabled', value: string | boolean): NativeEntitySettingChange {
  return key === 'name'
    ? {kind: 'entity-setting', entity_id: entity.id, key, value: String(value)}
    : {kind: 'entity-setting', entity_id: entity.id, key, value: Boolean(value)}
}

/** The name change a typed draft would commit: the trimmed draft when it is a different, non-empty name within the limit; null otherwise. */
export function formationNameDraft(entity: Entity, draft: string): NativeEntitySettingChange | null {
  const next = draft.trim()
  if (!next || next === entity.name || next.length > NAME_LIMIT) return null
  return formationSettingChange(entity, 'name', next)
}

/** Scene budget for formations and pins (nativeFormations.ts FORMATION_SCENE_LIMIT). */
const SCENE_OBJECT_LIMIT = 32

export interface FormationObjectGate {duplicate: string | null; remove: string | null}
/** Duplicate and Delete (app.ts duplicateEntity and deleteEntities). A locked entity's `disabled` is the lock itself, so busy is read
 * only for an unlocked entity. Duplicate copies a locked entity, as the app does; Delete is refused while locked or a blueprint member. */
export function formationObjectGate(scene: Scene, entity: Entity, disabled: boolean): FormationObjectGate {
  const busy = disabled && !entity.locked
  return {
    duplicate: busy ? 'Wait for the current native edit to finish.' : scene.entities.length >= SCENE_OBJECT_LIMIT ? 'A Scene holds up to 32 formations and pins.' : null,
    remove: entity.locked ? 'Unlock this formation to remove it.'
      : isBlueprintMember(scene, entity) ? 'Release the blueprint before removing one of its members.'
        : busy ? 'Wait for the current native edit to finish.' : null,
  }
}
/** The admitted object change for one entity (editor.ts NativeObjectChange). */
export function formationObjectChange(kind: 'entity-duplicate' | 'entity-remove', entity: Entity): NativeObjectChange {
  return {kind, entity_id: entity.id}
}

export type PlanPlane = 'XY' | 'XZ' | 'YZ'
type PlanAxis = 'x' | 'y' | 'z'
/** Horizontal, vertical and depth axes of each composition plane (composition.plane, model.ts Scene.composition). */
const PLANE_AXES: Record<PlanPlane, {horizontal: PlanAxis; vertical: PlanAxis; depth: PlanAxis}> = {
  XY: {horizontal: 'x', vertical: 'y', depth: 'z'},
  XZ: {horizontal: 'x', vertical: 'z', depth: 'y'},
  YZ: {horizontal: 'y', vertical: 'z', depth: 'x'},
}

export interface PlanMark {
  id: string; name: string; kind: Entity['kind']; selected: boolean; enabled: boolean
  cx: number; cy: number; width: number; height: number; rotation: number
  /** Formation: share relative to the largest formation share; disabled formations are faint. Pins are rings only (0). */
  fillOpacity: number
  /** Depth shading: the depth axis value normalised over all objects; a higher value gives a stronger outline. */
  outlineOpacity: number
}
export interface PlanLayout {plane: PlanPlane; horizontal: PlanAxis; vertical: PlanAxis; depth: PlanAxis; marks: PlanMark[]}

/** A derived plan of every object, in SVG pixels. Positions are the stored position (stage units, the same values the controls read);
 * a mark is Width x Height in stage units (size.x, size.y, nativeBridge.ts extent) rotated by Rotation, scaled uniformly to fit. The
 * vertical axis is drawn upward. A configuration diagram, not the Stage: scale and the Stage projection are not drawn here. */
export function planLayout(reading: NativeEditorReading, selectedId: string | null, width = 360, height = 180, pad = 24): PlanLayout {
  const plane: PlanPlane = reading.scene.composition?.plane && reading.scene.composition.plane in PLANE_AXES ? reading.scene.composition.plane : 'XY'
  const axes = PLANE_AXES[plane]
  const entities = reading.scene.entities
  if (!entities.length) return {plane, ...axes, marks: []}
  const radius = (item: Entity) => item.kind === 'formation' ? Math.hypot(item.size?.x ?? 0, item.size?.y ?? 0) / 2 : 0
  let minH = Infinity, maxH = -Infinity, minV = Infinity, maxV = -Infinity
  for (const item of entities) {
    const h = item.position[axes.horizontal], v = item.position[axes.vertical], r = radius(item)
    minH = Math.min(minH, h - r); maxH = Math.max(maxH, h + r); minV = Math.min(minV, v - r); maxV = Math.max(maxV, v + r)
  }
  // At least two stage units of span, so one object or coincident objects still get a readable scale.
  const spanH = Math.max(maxH - minH, 2), spanV = Math.max(maxV - minV, 2)
  const k = Math.min((width - 2 * pad) / spanH, (height - 2 * pad) / spanV)
  const centreH = (minH + maxH) / 2, centreV = (minV + maxV) / 2
  const shares = entities.filter(item => item.kind === 'formation').map(item => item.share)
  const maxShare = Math.max(0, ...shares)
  const depths = entities.map(item => item.position[axes.depth])
  const depthMin = Math.min(...depths), depthRange = Math.max(...depths) - depthMin
  return {plane, ...axes, marks: entities.map(item => {
    const formation = item.kind === 'formation', enabled = item.enabled !== false
    const depth01 = depthRange > 0 ? (item.position[axes.depth] - depthMin) / depthRange : 0.5
    const fill = !formation ? 0 : !enabled ? 0.1 : 0.2 + 0.8 * (maxShare > 0 ? item.share / maxShare : 0.5)
    return {
      id: item.id, name: item.name, kind: item.kind, selected: item.id === selectedId, enabled,
      cx: width / 2 + (item.position[axes.horizontal] - centreH) * k,
      cy: height / 2 - (item.position[axes.vertical] - centreV) * k,
      width: formation ? Math.max(item.size.x * k, 6) : 8, height: formation ? Math.max(item.size.y * k, 6) : 8,
      rotation: formation ? item.rotation : 0,
      fillOpacity: fill, outlineOpacity: 0.35 + 0.65 * depth01,
    }
  })}
}

/** The one line the strip and the rack show for this object: its derived particle fraction when it is enabled. */
function summaryOf(reading: NativeEditorReading, entity: Entity): string {
  if (entity.kind !== 'formation') return 'Pins have no formation panel'
  const shape = FORMATION_SHAPE_LABELS[entity.shape] ?? entity.shape
  const fraction = formationShareRows(reading.scene.entities).find(row => row.id === entity.id)?.fraction ?? null
  return fraction === null ? `Disabled · ${shape}` : `${Math.round(fraction * 100)}% of particles · ${shape}`
}

export const formationFaceModel: EntityFaceModel = {
  name: 'Formation',
  paths: FORMATION_PATHS,
  // App order: Position, Size and share, then the stored tint's contribution. Identity (Name, Lock, Enabled) is non-numeric and sits in the view.
  groups: [
    {title: 'Placement', paths: ['x', 'y', 'z']},
    {title: 'Size & share', paths: ['size.x', 'size.y', 'scale', 'rotation', 'share'], note: 'Particle share normalises over enabled formations (see below).'},
    {title: 'Appearance', paths: ['tintWeight'], note: 'Stored tint colour and the shape are disclosed below, read-only.'},
  ],
  // The four a performer moves most: where it is (x, y), how big it is (scale) and how much of the particles it takes (share).
  // Width, Height and Rotation are exact-value work for the expanded panel.
  compact: ['x', 'y', 'scale', 'share'],
  studio: 'formations',
  enabled: (_reading, entity) => entity.kind === 'formation' ? entity.enabled !== false : undefined,
  frozen: (reading, entity) => formationFrozenPaths(reading.scene, entity).length ? {paths: formationFrozenPaths(reading.scene, entity), reason: 'Held by Blueprint: use Blueprint to move this shape'} : null,
  strip: {summary: summaryOf, toggle: null},
}
