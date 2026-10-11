import type {NativeEditorReading, NativeSceneEditRequest} from '../../../../expressions-boundary/src/editor'
import type {NativeSceneEditIntent} from '../../../../expressions-boundary/src/sceneEdits'
import {short} from './nativeFieldFaceValues.ts'
import type {SceneFaceModel} from './nativeSceneFaceModel.ts'

/** Expression title bounds: sceneEdits.ts title() keeps 1–160 characters once trimmed. */
export const EXPRESSION_TITLE_MAX = 160

/** The Expression title problem to show before any send, or null when the boundary will accept it. The boundary stays the authority. */
export function expressionTitleProblem(value: string): string | null {
  const trimmed = value.trim()
  return trimmed && trimmed.length <= EXPRESSION_TITLE_MAX ? null : `Give the Expression a name of 1–${EXPRESSION_TITLE_MAX} characters`
}

/** Expression description bound: sceneEdits.ts description() keeps at most 5000 characters; empty is a real value. */
export const EXPRESSION_DESCRIPTION_MAX = 5000

/** The description problem to show before any send, or null. Not trimmed: the boundary stores the text as written. */
export function expressionDescriptionProblem(value: string): string | null {
  return value.length <= EXPRESSION_DESCRIPTION_MAX ? null : `The description must be at most ${EXPRESSION_DESCRIPTION_MAX} characters`
}

/** Scene devices' summary line, as the brief fixes it: scene name, duration and transition in seconds. */
export const sceneSummary = (reading: NativeEditorReading) =>
  `${reading.scene?.name ?? 'Scene'} · ${short(reading.scene?.duration ?? NaN)}s · ${short(reading.scene?.transition ?? NaN)}s`

/** One Expression-level scene-edit request, built the way NativeSceneEditor builds its own: the presented Scene's exact basis,
 * the intent epoch and the native selection. Null when the owner has not disclosed the playback or selection it needs. */
export function expressionEditRequest(reading: NativeEditorReading,
  intent: Extract<NativeSceneEditIntent, {operation: 'expression-title' | 'expression-description'}>): NativeSceneEditRequest | null {
  if (!reading.playback || !reading.nativeSelection) return null
  return {operation: 'scene-edit', basis: structuredClone(reading.basis), intent_epoch: reading.playback.intent_epoch,
    native_selection: structuredClone(reading.nativeSelection), intent}
}

export const sceneFaceModel: SceneFaceModel = {
  name: 'Scene',
  groups: [{title: 'Scene settings'}, {title: 'Expression settings'}],
  summary: sceneSummary,
  enabled: () => undefined,
  studio: 'scene',
}
