import type {NativeEditorChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {sceneFaceModel} from './nativeSceneFace.scene.ts'
import {textFaceModel} from './nativeSceneFace.text.ts'
import {automationFaceModel} from './nativeSceneFace.automation.ts'
import {arrangeFaceModel} from './nativeSceneFace.arrange.ts'
import {bodyFaceModel} from './nativeSceneFace.body.ts'
import {blueprintFaceModel} from './nativeSceneFace.blueprint.ts'
// @scene-entry:arrange and @scene-import:arrange are reserved for the Arrange device.

/** One compact action on a scene device's rack widget. `disabled` names the reason, or null when it can run. */
export interface SceneCompactAction {label: string; title: string; changes: readonly NativeEditorChange[]; disabled: string | null}

/** Pure per-family facts for one SCENE device. A scene device acts on the presented Scene or Expression, not on registry parameters,
 * so it has no `paths`, no slider and no numeric controls. No React, no commits. */
export interface SceneFaceModel {
  name: string
  /** The panel's section titles in app order. The Browser description joins these titles. */
  groups: readonly {title: string}[]
  summary: (reading: NativeEditorReading) => string
  /** Scene devices have no enable operation, so this is always undefined (hollow light). */
  enabled: (reading: NativeEditorReading) => boolean | undefined
  /** At most four compact actions for the rack widget. Absent means the widget shows its summary only. */
  compactActions?: (reading: NativeEditorReading) => readonly SceneCompactAction[]
  /** The Expressions Studio section id the full panel opens in (studioSections.ts). */
  studio?: string
}

// @scene-entry:scene
// @scene-entry:text
// @scene-entry:automation
// @scene-entry:arrange
export const SCENE_FACE_MODELS = {
  scene: sceneFaceModel,
  text: textFaceModel,
  automation: automationFaceModel,
  blueprint: blueprintFaceModel,
  arrange: arrangeFaceModel,
  body: bodyFaceModel,
} as const satisfies Record<string, SceneFaceModel>
