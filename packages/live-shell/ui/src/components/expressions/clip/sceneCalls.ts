// The Scene's two owner calls that more than one door makes, ported unchanged from the Expressions bar
// (components/NativeTransportBar.tsx, retired): one Scene request on the captured source, and Save. Each is one owner request
// on the captured basis; its reply is adopted only while the presentation it was sent from is still current, and its answer
// goes to the Scene's line in the owner's words (sceneState.ts). Nothing here keeps a document value.
import {currentCompositionReply, currentNativeSceneReply, type NativeCompositionViewSource} from '../../../shell/compositionViews'
import type {NativeSceneAction} from '../../../shell/nativeContent'
import {saveNotice} from '../../nativeExpressionCommands'
import {sceneClipRef, sceneLaneRef, sceneOfClipRef} from './sceneClip'
import {markSeen, sayScene, whileBusy} from './sceneState'

/** The source as the caller holds it now (a ref's current value), against which a reply is qualified. */
export type LatestSource = () => NativeCompositionViewSource | null

/** One Scene request (focus, play-saved, stop-saved, …). True when the owner accepted it. */
export async function sendScene(source: NativeCompositionViewSource, latest: LatestSource, action: NativeSceneAction): Promise<boolean> {
  if (!source.isPresented() || !source.actions) return false
  const actions = source.actions
  sayScene(null)
  return whileBusy(async () => {
    try {
      const reply = await actions.scene(action)
      const now = latest()
      if (now && currentNativeSceneReply(source, now, reply, action)) sayScene(reply.ok ? null : {kind: 'fault', text: reply.error})
      return reply.ok
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      const now = latest()
      if (now && currentNativeSceneReply(source, now, {ok: false, error}, action)) sayScene({kind: 'fault', text: error})
      return false
    }
  })
}

/** Save: the owner's save request on the captured basis. "Saved" is said only from the owner's own reply reading. */
export async function sendSave(source: NativeCompositionViewSource, latest: LatestSource): Promise<boolean> {
  if (!source.isPresented() || !source.actions) return false
  const actions = source.actions
  sayScene(null)
  return whileBusy(async () => {
    try {
      const reply = await actions.history('save')
      const now = latest()
      if (now && currentCompositionReply(source, now, reply)) sayScene(reply.ok ? {kind: 'notice', text: saveNotice(reply)} : {kind: 'fault', text: reply.error})
      return reply.ok
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      const now = latest()
      if (now && currentCompositionReply(source, now, {ok: false, error})) sayScene({kind: 'fault', text: error})
      return false
    }
  })
}

/** The door of THE selection: what the shared Session and Arrangement select through (projections/timelinePaneHost.ts). */
export interface SelectionDoor {
  selectedRef?: string
  selectTrackItem(target: {kind: 'clip' | 'track'; ref: string; title: string; track?: string}): void
}

/** Scene ‹ ›: focus the Scene (`scene focus`, unchanged); once the owner has accepted, the pressed Scene is also THE selection,
 * so the clip box, the Session and the editor name the same Scene. It keeps the lane the selection was on, and is marked seen
 * first: the selection's focus (sceneKeepers.ts) is then not asked of the owner a second time. */
export async function focusScene(source: NativeCompositionViewSource, latest: LatestSource, sceneRef: string, door: SelectionDoor | null): Promise<boolean> {
  if (!(await sendScene(source, latest, {action: 'focus', scene_ref: sceneRef}))) return false
  const content = source.content
  if (!door || !content?.scenes) return true
  const lane = sceneOfClipRef(content, door.selectedRef)?.lane ?? 'visual'
  const clip = sceneClipRef(content.basis.expression_ref, sceneRef, lane)
  markSeen(clip)
  door.selectTrackItem({kind: 'clip', ref: clip, title: content.scenes.scenes.find(row => row.scene_ref === sceneRef)?.title ?? sceneRef,
    track: sceneLaneRef(content.basis.expression_ref, lane)})
  return true
}
