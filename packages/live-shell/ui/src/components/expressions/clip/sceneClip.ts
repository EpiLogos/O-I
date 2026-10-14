// The Expressions Scene as a clip (lock §9.1: "Expressions are to scenes as Live's tracks are to clips"; manual §3: "Clip view
// shows the thing itself, with everything you can do to it"). What the Clip side needs to know about the clip refs the Session
// and Arrangement select, and what a change of THE selection asks of the owner. Pure TypeScript: no React, no owner call.
import type {NativeExpressionsContent} from '../../../shell/nativeContent'

export type SceneLane = 'visual' | 'audio'
const LANES: readonly SceneLane[] = ['visual', 'audio']

/** The clip a scene is on one of its Expression's two lanes, as timeline/expressionsTrackAdapter.ts ids it
 * (`scene:<expression>:<scene>:<lane>`). tests/expressions-clip.test.mjs holds the two to each other. */
export const sceneClipRef = (expressionRef: string, sceneRef: string, lane: SceneLane = 'visual'): string => `scene:${expressionRef}:${sceneRef}:${lane}`
/** The track a scene's clip sits on (`expression:<expression>:<lane>`). */
export const sceneLaneRef = (expressionRef: string, lane: SceneLane): string => `expression:${expressionRef}:${lane}`

type SceneFacts = Pick<NativeExpressionsContent, 'basis' | 'scenes'>

/** The scene a selected clip ref names in the open Expression, or null: another mode's ref, another Expression's scene, a
 * scene the owner's inventory does not list. The refs are read by their ends (the scene ref itself holds colons). */
export function sceneOfClipRef(content: SceneFacts | null | undefined, clipRef: string | null | undefined): {sceneRef: string; lane: SceneLane} | null {
  if (!content?.scenes || !clipRef) return null
  const prefix = `scene:${content.basis.expression_ref}:`
  if (!clipRef.startsWith(prefix)) return null
  const rest = clipRef.slice(prefix.length)
  for (const lane of LANES) {
    if (!rest.endsWith(`:${lane}`)) continue
    const sceneRef = rest.slice(0, -(lane.length + 1))
    return content.scenes.scenes.some(row => row.scene_ref === sceneRef) ? {sceneRef, lane} : null
  }
  return null
}

/** What a change of THE selection asks of the Expressions owner (F4: selecting a clip shows its editor): focus the scene the
 * selection names, once. `seen` is the selection the Scene last acted on, so a later move of the owner's focus (the Scene
 * selector, the stage) is never fought by an older selection. `act` false means nothing was decided yet or nothing changed:
 * the caller leaves `seen` alone and waits. */
export function selectionFollow(input: {selected: string | null; seen: string | null; content: SceneFacts | null; ready: boolean}): {act: boolean; focus: string | null} {
  if (!input.content?.scenes || !input.ready || input.selected === input.seen) return {act: false, focus: null}
  const named = sceneOfClipRef(input.content, input.selected)
  return {act: true, focus: named && named.sceneRef !== input.content.basis.scene_ref ? named.sceneRef : null}
}

/** The owner's standing in the Scene's own words (the mockup's `state` row: "edited since save"). A reading, never a claim. */
export function standingWord(standing: {dirty: boolean; pending: boolean}): string {
  return standing.pending ? 'owner answering' : standing.dirty ? 'edited since save' : 'saved'
}
