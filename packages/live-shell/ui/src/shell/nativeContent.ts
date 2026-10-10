import type {Entity, NativeEditorBasis, NativeEditorChange, NativeEditorController, NativeEditorReading, NativeEditorReply, NativeGlyphChange, NativeSceneEditorRequest} from '../../../../expressions-boundary/src/editor';
import {toNativeEntity} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge';
import type {ActMaterialContract} from '../../../../expressions-boundary/src/nativeMaterials';
import {loopIntent, sceneFocused} from '../components/nativeScenePlayback';

/** Presentation identities are tuples, never invented native references. The
 * complete material stays with the retained Expressions document owner. */
export interface ExpressionsContentScope {
  owner: 'expressions';
  expression_ref: string;
  scene_ref: string;
}
export interface ExpressionsEntityScope extends ExpressionsContentScope {
  view_entity_id: string;
  entity_ref: string | null;
}
export interface NativeFormationTrack {
  owner: 'expressions';
  kind: 'formation' | 'force';
  id: string;
  name: string;
  scope: ExpressionsEntityScope;
  entity: Readonly<Entity>;
  clip_source_id: string | null;
  selected: boolean;
  capabilities: {select: boolean; glyphEdit: boolean};
}
export interface NativeFieldTrack {
  owner: 'expressions';
  kind: 'field';
  id: string;
  name: string;
  scope: ExpressionsContentScope;
  /** This is the one shared Field, not an extra processor instance. */
  selected: boolean;
}
export interface NativeGlyphClipSource {
  owner: 'expressions';
  kind: 'glyph-sequence';
  id: string;
  track_id: string;
  name: string;
  scope: ExpressionsEntityScope;
  /** Source material, not a time-positioned Arrangement occurrence. */
  sequence: Readonly<Entity['sequence']>;
  timing: NativeGlyphTiming;
  selected_step_id: string | null;
  capabilities: {select: boolean; edit: boolean; open: boolean};
}
export interface NativeSceneMaterialCell {
  owner: 'expressions';
  kind: 'scene-member';
  id: string;
  scene_ref: string;
  track_id: string;
  clip_source_id: string;
  /** Scene membership has no independent launch operation in editor/v1. */
  capabilities: {select: boolean};
}
export interface NativeExpressionsContent {
  owner: 'expressions';
  basis: NativeEditorBasis;
  scene: {id: string; scene_ref: string; name: string};
  tracks: readonly (NativeFormationTrack | NativeFieldTrack)[];
  clip_sources: readonly NativeGlyphClipSource[];
  scene_members: readonly NativeSceneMaterialCell[];
  scenes: NativeEditorReading['scenes'] | null;
  playback: NativeEditorReading['playback'] | null;
  /** The native selection the presented Scene was read with. Composition-level
   * edits (the loop flag) are addressed through it, as the Scene editor does. */
  native_selection?: NativeEditorReading['nativeSelection'] | null;
  history: NativeEditorReading['history'];
  standing: NativeEditorReading['standing'];
}
const identity =(scope: ExpressionsContentScope, component: string, entityId?: string) =>
  JSON.stringify(['expressions', scope.expression_ref, scope.scene_ref, component, entityId ?? null]);

export interface NativeGlyphTiming {
  clock: 'seconds' | 'morph';
  authored_duration_seconds: number;
  axis_duration: number;
  playback_axis: 'simulation-seconds' | 'field-morph-cycles';
  states: readonly {step_id: string; start_seconds: number; hold_seconds: number; transition_seconds: number; end_seconds: number;
    axis_start: number; axis_hold: number; axis_transition: number; axis_end: number}[];
}
/** Read authoring timing through the production bridge. Held playback has one
 * base link, so the projection exposes all authored links without enabling the
 * original entity. Morph timing follows resolveSequence's Field dwell clamp. */
export function readNativeGlyphTiming(entity: Entity, fieldDwell: number): NativeGlyphTiming {
  if (new Set(entity.sequence.steps.map(step => step.id)).size !== entity.sequence.steps.length) throw Error('Ambiguous native glyph state identity');
  const native = toNativeEntity({...entity, sequence: {...entity.sequence, enabled: true}});
  const morph = entity.sequence.clock === 'morph', dwell = Math.max(0, Math.min(.95, fieldDwell));
  if (!Number.isFinite(dwell)) throw Error('Native Field dwell is not finite');
  const states: NativeGlyphTiming['states'][number][] = [];
  let cursor = 0, axis = 0;
  for (const step of entity.sequence.steps) {
    const link = native.sequence.links.find(value => value.id === step.id);
    if (!link) throw Error('The native evaluator omitted this glyph state');
    const hold = link.hold ?? native.sequence.hold, transition = link.transition ?? native.sequence.transition;
    const end = cursor + hold + transition, axisHold = morph ? dwell : hold, axisTransition = morph ? 1 - dwell : transition;
    const axisEnd = axis + axisHold + axisTransition;
    states.push({step_id: step.id, start_seconds: cursor, hold_seconds: hold, transition_seconds: transition, end_seconds: end,
      axis_start: axis, axis_hold: axisHold, axis_transition: axisTransition, axis_end: axisEnd});
    cursor = end; axis = axisEnd;
  }
  return {clock: entity.sequence.clock, authored_duration_seconds: cursor, axis_duration: axis, states,
    playback_axis: morph ? 'field-morph-cycles' : 'simulation-seconds'};
}

/** Pure adapter over the actual current scene. It makes no SetSummary, MIDI
 * notes, tempo conversion, Session alternatives, or Arrangement occurrences. */
export function readNativeExpressionsContent(reading: NativeEditorReading): NativeExpressionsContent {
  const basis = {...reading.basis}, scope: ExpressionsContentScope = {
    owner: 'expressions', expression_ref: basis.expression_ref, scene_ref: basis.scene_ref,
  };
  if(reading.scenes && (reading.scenes.basis.expression_ref !== basis.expression_ref || reading.scenes.basis.revision !== basis.revision)) throw Error('The native Scene inventory does not match its captured editor basis');
  if(reading.playback && (reading.playback.scene_ref !== basis.scene_ref || !Number.isSafeInteger(reading.playback.intent_epoch) || reading.playback.intent_epoch < 0)) throw Error('The Scene transport does not match its captured native focus');
  const tracks: (NativeFormationTrack | NativeFieldTrack)[] = [];
  const clips: NativeGlyphClipSource[] = [];
  const members: NativeSceneMaterialCell[] = [];
  const entityIds = new Set<string>();
  for (const entity of reading.scene.entities) {
    if (entityIds.has(entity.id)) throw Error('Ambiguous native track identity');
    entityIds.add(entity.id);
    const entityScope: ExpressionsEntityScope = {...scope, view_entity_id: entity.id, entity_ref: reading.entityOccurrences[entity.id] ?? null};
    const bound = entityScope.entity_ref !== null;
    const id = identity(scope, 'track', entity.id);
    const clipId = entity.kind === 'formation' ? identity(scope, 'sequence', entity.id) : null;
    tracks.push({owner: 'expressions', kind: entity.kind === 'formation' ? 'formation' : 'force', id, name: entity.name,
      scope: entityScope, entity, clip_source_id: clipId, selected: reading.selection.entity_ids.includes(entity.id),
      capabilities: {select: bound, glyphEdit: bound && entity.kind === 'formation' && !entity.locked}});
    if (!clipId) continue;
    const selectedStep = tracks[tracks.length - 1].selected && entity.sequence.steps.some(step => step.id === reading.selection.step_id)
      ? reading.selection.step_id : null;
    clips.push({owner: 'expressions', kind: 'glyph-sequence', id: clipId, track_id: id, name: entity.name,
      scope: entityScope, sequence: entity.sequence,
      timing: readNativeGlyphTiming(entity, reading.scene.morph.dwell),
      selected_step_id: selectedStep, capabilities: {select: bound, edit: bound && !entity.locked, open: bound}});
    members.push({owner: 'expressions', kind: 'scene-member', id: identity(scope, 'member', entity.id), scene_ref: scope.scene_ref,
      track_id: id, clip_source_id: clipId, capabilities: {select: bound}});
  }
  tracks.push({owner: 'expressions', kind: 'field', id: identity(scope, 'field'), name: 'Field', scope,
    selected: reading.selection.entity_ids.length === 0});
  return {owner: 'expressions', basis, scene: {id: reading.scene.id, scene_ref: scope.scene_ref, name: reading.scene.name},
    tracks, clip_sources: clips, scene_members: members, scenes: reading.scenes ?? null, playback: reading.playback ?? null,
    native_selection: reading.nativeSelection ? structuredClone(reading.nativeSelection) : null, history: {...reading.history}, standing: {...reading.standing}};
}

type SceneAction<T> = T extends NativeSceneEditorRequest ? Omit<T, 'operation' | 'basis' | 'intent_epoch'> : never;
export type NativeSceneAction = SceneAction<NativeSceneEditorRequest>;

/** Each handler captures the displayed native basis. The receiver refuses a
 * stale action; a newer reading never silently retargets an existing gesture. */
export function createNativeContentActions(content: NativeExpressionsContent, controller: Pick<NativeEditorController, 'request'>) {
  const basis = {...content.basis};
  const refuse = (error: string): Promise<NativeEditorReply> => Promise.resolve({ok: false, error});
  const clip = (id: string) => content.clip_sources.find(value => value.id === id);
  return {
    listActs(): Promise<NativeEditorReply> {
      return controller.request({operation:'material',basis,action:'list-acts'});
    },
    readNow(): Promise<NativeEditorReply> {
      return controller.request({operation:'material',basis,action:'list-acts'});
    },
    inspectAct(act_ref:string,material_contract?:ActMaterialContract): Promise<NativeEditorReply> {
      if(!act_ref.trim())return refuse('Choose an exact native performance');
      return controller.request({operation:'material',basis,action:'inspect',act_ref,...(material_contract?{material_contract}:{})});
    },
    seekAct(act_ref:string,expected_act_revision:number,position:number,material_contract?:ActMaterialContract): Promise<NativeEditorReply> {
      if(!act_ref.trim()||!Number.isSafeInteger(expected_act_revision)||expected_act_revision<1||!Number.isSafeInteger(position)||position<0)return refuse('Choose an exact native performance revision and passage');
      return controller.request({operation:'material',basis,action:'seek',input:{act_ref,expected_act_revision,position,...(material_contract?{material_contract}:{})}});
    },
    scene(action: NativeSceneAction): Promise<NativeEditorReply> {
      if (!content.scenes || !content.playback) return refuse('The native Scene transport is unavailable');
      if ((action.action === 'focus'||action.action==='focus-object'||action.action==='play-scene') && !content.scenes.scenes.some(row => row.scene_ref === action.scene_ref && row.material.available)) return refuse('This Scene has no disclosed authored material');
      if(action.action==='focus-object'&&!content.scenes.scenes.find(row=>row.scene_ref===action.scene_ref)?.members.some(member=>member.entity_ref===action.entity_ref&&member.state==='loaded'))return refuse('This native occurrence is not loaded in the captured Scene');
      return controller.request({...action, operation: 'scene', basis, intent_epoch: content.playback.intent_epoch});
    },
    /** The saved-sequence loop flag: the same scene-edit and loop intent the Scene
     * editor's switch sends, on the captured basis and native selection. */
    setSceneLoop(loop: boolean): Promise<NativeEditorReply> {
      if (!content.scenes || !content.playback) return refuse('The native Scene transport is unavailable');
      const selection = content.native_selection;
      if (!sceneFocused(selection, basis.scene_ref) || !selection) return refuse('Focus a Scene before changing its loop.');
      return controller.request({operation: 'scene-edit', basis, intent_epoch: content.playback.intent_epoch,
        native_selection: structuredClone(selection), intent: loopIntent(loop)});
    },
    selectField(): Promise<NativeEditorReply> {
      return controller.request({operation: 'select-field', basis});
    },
    selectTrack(trackId: string): Promise<NativeEditorReply> {
      const track = content.tracks.find(value => value.id === trackId);
      if (!track || track.kind === 'field' || !track.capabilities.select) return refuse('This track has no admitted native selection action');
      return controller.request({operation: 'select', basis, entity_id: track.scope.view_entity_id});
    },
    selectClip(sourceId: string, stepId?: string): Promise<NativeEditorReply> {
      const source = clip(sourceId);
      if (!source?.capabilities.select) return refuse('This clip source has no admitted native selection action');
      if (stepId !== undefined && !source.sequence.steps.some(step => step.id === stepId)) return refuse('This stable glyph state is not in the captured clip source');
      return controller.request({operation: 'select', basis, entity_id: source.scope.view_entity_id, ...(stepId === undefined ? {} : {step_id: stepId})});
    },
    editClip(sourceId: string, changes: readonly NativeGlyphChange[]): Promise<NativeEditorReply> {
      const source = clip(sourceId);
      if (!source?.capabilities.edit) return refuse('This clip source has no admitted native editing action');
      if (!changes.length || changes.length > 64 || changes.some(change => change.kind === 'field-font' || change.entity_id !== source.scope.view_entity_id)) return refuse('One clip transaction must address this captured native formation');
      return controller.request({operation: 'apply', basis, changes});
    },
    openClip(sourceId: string, stepId: string, editor: 'source' | 'layers' | 'placement'): Promise<NativeEditorReply> {
      const source = clip(sourceId);
      if (!source?.capabilities.open || !source.sequence.steps.some(step => step.id === stepId)) return refuse('This captured state has no native editor target');
      return controller.request({operation: 'open', basis, entity_id: source.scope.view_entity_id, step_id: stepId, editor});
    },
    /** Bar controls (Time Scale, pinned parameters, pointer and 3D switches): one admitted change transaction on the captured basis. */
    applyChanges(changes: readonly NativeEditorChange[], at: NativeEditorBasis = basis): Promise<NativeEditorReply> {
      if (!changes.length || changes.length > 64) return refuse('One bar gesture sends between one and 64 native changes');
      return controller.request({operation: 'apply', basis: at, changes: [...changes]});
    },
    history(operation: 'undo' | 'redo' | 'save'): Promise<NativeEditorReply> {
      return controller.request({operation, basis});
    },
  };
}

export type NativeContentActions = ReturnType<typeof createNativeContentActions>;
