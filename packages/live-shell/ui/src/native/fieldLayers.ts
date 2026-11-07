import type {FieldLayerMixSet, FieldLayerReading, StageCommand} from '@epilogos/expressions-boundary'
import type {FrameTakeLink} from './frameTakes'

/** XS04 (O-I #747 round 888; DLW build ruling 2026-11-06, the lane's structural proposal accepted): another Expression held over the
 * presented one on the one field, through the frame's `layer` stage command (field-studies-journeys fieldLayers.ts). Session view draws each
 * held Expression as a track of its own beside the presented one; a scene's ▶ on it launches that scene over the field, its Stop stops it,
 * and the browser's Layer holds an Expression over the field or lets it go. The frame reports what it holds (its hosted state's `layers`);
 * nothing is kept here. Pure apart from the frame's link. */

export type LayerAnswer = {ok: true; note: string} | {ok: false; error: string}
const NO_FRAME_WORDS = 'No Expressions application is mounted: open an Expression to layer another over its field.'
const NO_FRAME: LayerAnswer = {ok: false, error: NO_FRAME_WORDS}

/** The Expressions the frame holds over its field, as it last reported them. */
export const heldLayers = (link: FrameTakeLink): readonly FieldLayerReading[] => link.state?.layers ?? []

async function layerAct(link: FrameTakeLink, command: StageCommand, note: string): Promise<LayerAnswer> {
  if (!link.run) return NO_FRAME
  const result = await link.run(command)
  return result.ok ? {ok: true, note} : {ok: false, error: result.error}
}
export const holdLayer = (link: FrameTakeLink, ref: string, title: string) =>
  layerAct(link, {command: 'layer', action: 'hold', expression_ref: ref}, `${title} is held over the field: launch one of its scenes on its track.`)
export const releaseLayer = (link: FrameTakeLink, ref: string, title: string) =>
  layerAct(link, {command: 'layer', action: 'release', expression_ref: ref}, `${title} is let go from the field.`)
export const startLayer = (link: FrameTakeLink, ref: string, sceneRef: string, title: string) =>
  layerAct(link, {command: 'layer', action: 'start', expression_ref: ref, scene_ref: sceneRef}, `${title} plays over the field.`)
export const stopLayer = (link: FrameTakeLink, ref: string, title: string) =>
  layerAct(link, {command: 'layer', action: 'stop', expression_ref: ref}, `${title} stops: the field plays the presented Expression alone.`)
/** A held Expression's own mixer (round 889, XS04 slice 2): its Activator, Solo or Volume, written by the field through its owner. */
export const mixLayer = (link: FrameTakeLink, ref: string, set: FieldLayerMixSet, note: string) =>
  layerAct(link, {command: 'layer', action: 'mix', expression_ref: ref, set}, note)

/** The browser's Layer act for one saved work (the Expressions browser's works rows): hold it over the field, or let it go when it is held.
 * The presented Expression, or a frame that is not open, gives no act but its reason. */
export function layerRowAct(link: FrameTakeLink, work: {expression_ref: string; title: string}):
  {label: string; does: string; disabled?: string; run(): Promise<LayerAnswer>} {
  const held = heldLayers(link).some(layer => layer.expression_ref === work.expression_ref)
  const presented = link.state?.nativeScene?.expression_ref === work.expression_ref
  const disabled = !link.run ? NO_FRAME_WORDS
    : presented ? 'This Expression is the one presented: its scenes play on the field already.' : undefined
  return held
    ? {label: 'Let go', does: `Let ${work.title} go from the field: its track leaves Session view.`, run: () => releaseLayer(link, work.expression_ref, work.title)}
    : {label: 'Layer', does: `Hold ${work.title} over the field: its scenes stand on a track of their own in Session view, each launched over the presented Expression.`,
      ...(disabled ? {disabled} : {}), run: () => holdLayer(link, work.expression_ref, work.title)}
}
