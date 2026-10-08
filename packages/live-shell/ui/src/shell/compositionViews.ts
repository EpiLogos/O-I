import {sameEditorBasis, type NativeEditorReply, type NativeEditorBasis, type NativeGlyphChange, type NativeEditorReading} from '../../../../expressions-boundary/src/editor';
import type {SetSummary} from './useSet';
import type {SetDocument} from './document';
import type {NativeContentActions, NativeExpressionsContent, NativeGlyphClipSource, NativeGlyphTiming, NativeSceneMaterialCell, NativeSceneAction} from './nativeContent';

/** Presentation of an existing owner; no document, transport, or clock lives here. */
export type NativeDetailConfigurationFamily = 'controls' | 'device' | 'rack' | 'scene';
export interface NativeCompositionViewSource {
  owner: 'expressions';
  content: NativeExpressionsContent | null;
  actions: NativeContentActions | null;
  /** Actual visible cut and retained access lifetime; hiding retires callbacks. */
  isPresented: () => boolean;
  /** The owner's synchronous publication, qualified before a request settles. */
  currentReading?: () => NativeEditorReading | null;
  revealDetail: (mode: 'clip' | 'device', configuration?: NativeDetailConfigurationFamily, acknowledgedBasis?: NativeEditorBasis) => void;
  revealNativeEditor?: (editor:'source'|'layers'|'placement',acknowledgedBasis:NativeEditorBasis)=>void;
}
export type CompositionViewSource = {owner: 'live-set'; set: SetSummary | null; document: SetDocument | null} | NativeCompositionViewSource;
/** A successful native acknowledgement may advance its own basis. A later
 * human basis cannot be mistaken for that acknowledgement's presentation. */
export function currentCompositionReply(captured: NativeCompositionViewSource, current: NativeCompositionViewSource, reply: NativeEditorReply): boolean {
  if (!captured.isPresented()) return false;
  if (!captured.content || !current.content) return false;
  const before = captured.content.basis, now = current.content.basis;
  if (before.expression_ref !== now.expression_ref || before.scene_ref !== now.scene_ref) return false;
  if (reply.ok && (reply.reading.basis.expression_ref !== before.expression_ref || reply.reading.basis.scene_ref !== before.scene_ref)) return false;
  return sameEditorBasis(before, now) || (reply.ok && sameEditorBasis(reply.reading.basis, now));
}
/** Retire presentation only; an in-flight native effect still has its owner.
 * A new mount never revives an old mount's callback, even at the same basis. */
export function createNativeCompositionPresentationGuard() {
  let mounted = false, epoch = 0;
  return {
    mount() {
      mounted = true;
      const ownEpoch = ++epoch;
      return () => {if (epoch === ownEpoch) {mounted = false; epoch++}};
    },
    capture(captured: NativeCompositionViewSource) {
      const ownEpoch = epoch;
      return (current: NativeCompositionViewSource, reply: NativeEditorReply) =>
        mounted && epoch === ownEpoch && currentCompositionReply(captured, current, reply);
    },
    captureScene(captured: NativeCompositionViewSource, action:NativeSceneAction) {
      const ownEpoch=epoch;
      return (current: NativeCompositionViewSource, reply: NativeEditorReply)=>
        mounted&&epoch===ownEpoch&&currentNativeSceneReply(captured,current,reply,action);
    },
  };
}
export interface NativeSourceLane {
  source: NativeGlyphClipSource;
  member: NativeSceneMaterialCell;
  states: NativeGlyphTiming['states'];
}
export interface NativeSourceTimeline {
  clock: NativeGlyphTiming['clock'];
  unit: 'seconds' | 'Field morph cycles';
  duration: number;
  lanes: readonly NativeSourceLane[];
}

/** This relationship is disclosed by the content owner. A source and its
 * Scene occurrence must never be joined by label or list position. */
export function nativeSourceLanes(content: NativeExpressionsContent): NativeSourceLane[] {
  if (content.scene.scene_ref !== content.basis.scene_ref) throw Error('Native Scene does not match its captured composition basis');
  const tracks = new Map(content.tracks.map(track => [track.id, track]));
  const sources = new Map(content.clip_sources.map(source => [source.id, source]));
  if (tracks.size !== content.tracks.length || sources.size !== content.clip_sources.length) throw Error('Ambiguous native composition identity');
  const seen = new Set<string>();
  return content.scene_members.map(member => {
    const source = sources.get(member.clip_source_id), track = tracks.get(member.track_id);
    if (seen.has(member.id) || member.scene_ref !== content.basis.scene_ref || !source || !track || track.kind !== 'formation'
      || source.track_id !== track.id || track.clip_source_id !== source.id
      || source.scope.expression_ref !== content.basis.expression_ref || source.scope.scene_ref !== member.scene_ref
      || track.scope.expression_ref !== source.scope.expression_ref || track.scope.scene_ref !== source.scope.scene_ref
      || track.scope.view_entity_id !== source.scope.view_entity_id || track.scope.entity_ref !== source.scope.entity_ref) {
      throw Error('Native source does not belong to this exact track and Scene membership');
    }
    seen.add(member.id);
    return {source, member, states: source.timing.states};
  });
}
export function readNativeSourceTimeline(content: NativeExpressionsContent, clock: NativeGlyphTiming['clock']): NativeSourceTimeline {
  const lanes = nativeSourceLanes(content).filter(lane => lane.source.timing.clock === clock);
  return {clock, unit: clock === 'seconds' ? 'seconds' : 'Field morph cycles',
    duration: Math.max(0, ...lanes.map(lane => lane.source.timing.axis_duration)), lanes};
}
const refusal = (error: string): NativeEditorReply => ({ok: false, error});
export async function selectNativeSource(source: NativeCompositionViewSource, id: string, stepId?: string): Promise<NativeEditorReply> {
  if (!source.isPresented()) return refusal('The originating composition view is no longer presented');
  if (!source.content || !source.actions) return refusal('The native composition owner is unavailable');
  const clip = nativeSourceLanes(source.content).find(lane => lane.source.id === id)?.source;
  if (!clip) return refusal('This source is not in the captured Scene membership');
  return source.actions.selectClip(clip.id, stepId);
}
/** Timing edits address the source's authored stable state, not a newly
 * invented time-positioned clip. Morph dwell belongs to the shared Field. */
export async function editNativeSourceTiming(source: NativeCompositionViewSource, id: string, stepId: string, values: {hold?: number; transition?: number}): Promise<NativeEditorReply> {
  if (!source.isPresented()) return refusal('The originating composition view is no longer presented');
  if (!source.content || !source.actions) return refusal('The native composition owner is unavailable');
  const clip = nativeSourceLanes(source.content).find(lane => lane.source.id === id)?.source;
  if (!clip || !clip.sequence.steps.some(step => step.id === stepId)) return refusal('This stable state is not in the captured source');
  if (clip.timing.clock !== 'seconds') return refusal('Morph timing uses shared Field dwell; edit it in the existing Field device');
  if ((!Object.hasOwn(values, 'hold') && !Object.hasOwn(values, 'transition')) || Object.keys(values).some(key => !['hold', 'transition'].includes(key))
    || Object.values(values).some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 3600)) return refusal('Supply bounded authored hold or transition seconds');
  const change: NativeGlyphChange = {kind: 'step-timing', entity_id: clip.scope.view_entity_id, step_id: stepId, ...values};
  return source.actions.editClip(clip.id, [change]);
}

/** Scene focus can acknowledge a different exact Scene. Other source edits
 * still require their original Scene; this is not a generic retargeting rule. */
export function currentNativeSceneReply(captured: NativeCompositionViewSource, current: NativeCompositionViewSource, reply: NativeEditorReply, action: NativeSceneAction): boolean {
  if (!captured.isPresented() || !current.isPresented() || !captured.content || !current.content) return false;
  const before=captured.content.basis, now=current.content.basis;
  if(before.expression_ref!==now.expression_ref)return false;
  if(!reply.ok)return sameEditorBasis(before,now)&&captured.content.playback?.intent_epoch===current.content.playback?.intent_epoch;
  if(reply.reading.playback?.intent_epoch!==current.content.playback?.intent_epoch)return false;
  const acknowledged=reply.reading.basis;
  if(acknowledged.expression_ref!==before.expression_ref || !sameEditorBasis(acknowledged,now))return false;
  if(action.action==='focus'||action.action==='focus-object'||action.action==='play-scene'||action.action==='seek')return acknowledged.scene_ref===action.scene_ref
    && (action.action!=='focus-object'||reply.reading.nativeSelection?.entity_ref===action.entity_ref);
  if(action.action==='play-saved') {
    const rows=captured.content.scenes;
    const current=rows?.scenes.find(row=>row.scene_ref===before.scene_ref);
    const target=current?.snapshot.availability==='present'?before.scene_ref:rows?.timing.saved.available?rows.timing.saved.extents[0]?.scene_ref:undefined;
    return !!target&&acknowledged.scene_ref===target;
  }
  if(action.action==='save-snapshot' && action.next)return true;
  return acknowledged.scene_ref===before.scene_ref;
}
