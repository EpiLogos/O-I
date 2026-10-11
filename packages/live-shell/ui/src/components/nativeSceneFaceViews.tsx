import type {ComponentType} from 'react'
import type {NativeEditorChange, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import type {SCENE_FACE_MODELS} from './nativeSceneFaceModel.ts'
import {ScenePanel} from './NativeSceneFace.scene.tsx'
import {TextPanel} from './NativeSceneFace.text.tsx'
import {AutomationFacePanel} from './NativeSceneFace.automation.tsx'
// @scene-import:automation
import {BodyPanel} from './NativeSceneFace.body.tsx'
import {BlueprintPanel} from './NativeSceneFace.blueprint.tsx'
import {ArrangePanel} from './NativeSceneFace.arrange.tsx'

/** What the pool hands every scene panel. `disabled` is set while the presented Expression cannot take a change. `apply` sends one
 * exact `apply` on the reading's basis; `request` is the editor channel the hosted Scene editor uses. */
export interface SceneFacePanelProps {
  reading: NativeEditorReading
  request: (request: NativeEditorRequest) => Promise<NativeEditorReply>
  disabled: boolean
  apply: (changes: readonly NativeEditorChange[]) => Promise<NativeEditorReply>
}
/** A scene device's whole expanded panel: one React component the Browser pool hosts. */
export type SceneFacePanel = ComponentType<SceneFacePanelProps>

export const SCENE_FACE_VIEWS: Record<keyof typeof SCENE_FACE_MODELS, SceneFacePanel> = {
  // @scene-view:scene
  scene: ScenePanel,
  // @scene-view:text
  text: TextPanel,
  // @scene-view:automation
  automation: AutomationFacePanel,
  body: BodyPanel,
  blueprint: BlueprintPanel,
  // @scene-view:arrange
  arrange: ArrangePanel,
}

/** The panel for a scene family, or null. An unknown family is never drawn. */
export function sceneFaceView(family: string): SceneFacePanel | null {
  return Object.prototype.hasOwnProperty.call(SCENE_FACE_VIEWS, family) ? SCENE_FACE_VIEWS[family as keyof typeof SCENE_FACE_VIEWS] : null
}
