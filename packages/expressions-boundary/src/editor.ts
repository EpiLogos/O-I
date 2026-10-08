import type {Entity, Journey, Scene, SequenceStep, Vec3} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import type {NativeRackChange} from './nativeRackSchema';
import type {NativeMaterialEditorRequest, NativeMaterialEditorResult} from './materialEditor';
import type {NativeBinding} from './parameters';
import type {BeltEntry} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/workspacePreferences';
import type {NativeScenesReading, NativeScenePlaybackReading} from './scenes';
import type {NativeSceneEditIntent} from './sceneEdits';

export type {Entity, EntityLayer, Journey, Scene, SequenceStep, Vec3} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
export type {BeltEntry} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/workspacePreferences';

/** Exact retained order, with a current-scene resolution separate from the entry. */
export interface NativeChosenControlReading {
  entry_id: string;
  target: string | null;
  binding: NativeBinding | null;
  entity_id: string | null;
  native_ref: string | null;
  base_value: number | null;
  effective_value: number | null;
  locked: boolean;
  unavailable_reason: string | null;
}
export interface NativeChosenControlsReading {
  available: boolean;
  entries: BeltEntry[];
  controls: NativeChosenControlReading[];
}
export type NativeChosenControlChange =
  | {kind: 'chosen-add'; key: string; scope: BeltEntry['scope']; entity_id?: string}
  | {kind: 'chosen-remove'; entry_id: string}
  | {kind: 'chosen-order'; entry_ids: string[]}
  | {kind: 'chosen-scope'; entry_id: string; scope: 'selected' | 'named'; entity_id?: string};

/** An ephemeral reading of the existing authoring owner, never a shell document. */
export interface NativeEditorBasis {
  expression_ref: string;
  revision: number;
  scene_ref: string;
  authored_revision: number;
}
export interface NativeEditorReading {
  basis: NativeEditorBasis;
  scenes?: NativeScenesReading;
  playback?: NativeScenePlaybackReading & {intent_epoch: number};
  nativeSelection?: {scene_ref: string; entity_ref: string | null; relation_ref?: string | null};
  scene: Scene;
  entityOccurrences: Record<string, string>;
  chosenControls: NativeChosenControlsReading;
  selection: {entity_ids: string[]; step_id: string | null};
  history: {canUndo: boolean; canRedo: boolean};
  observation?: {
    fieldPaused?: boolean;
    simTime?: number;
    effectiveValues?: Record<string, number>;
    sequences?: {entityId: string; linkIndex: number; nextIndex?: number; progress: number}[];
  };
  standing: {dirty: boolean; pending: boolean; notice: string | null};
}
export type NativeDeviceChange =
  | {kind: 'parameter'; target: string; value: number}
  | {kind: 'force-mode'; entity_id: string; value: Entity['force']['kind']}
  | {kind: 'field-setting'; key: 'mediumEnabled' | 'mediumDimension' | 'mediumPlane' | 'resonanceEnabled' | 'collisionEnabled' | 'pairwiseEnabled' | 'collisionMode'; value: boolean | '2D' | '3D' | 'vertical' | 'horizontal' | 'obstacle' | 'vessel'}
  | {kind: 'force-insert'; position: Vec3; name?: string};
export type NativeSequenceSettings = Partial<Pick<Entity['sequence'], 'enabled' | 'clock' | 'manual' | 'hold' | 'transition' | 'order' | 'easing' | 'jitter' | 'impulse' | 'rateMul' | 'phaseOffset'>>;
export type NativeGlyphChange =
  | {kind: 'field-font'; values: {fontFamily?: string; fontWeight?: number}}
  | {kind: 'sequence-settings'; entity_id: string; step_id?: string; values: NativeSequenceSettings}
  | {kind: 'step-timing'; entity_id: string; step_id: string; hold?: number; transition?: number}
  | {kind: 'step-source'; entity_id: string; step_id: string; shape: SequenceStep['shape']; text?: string; source?: Entity['source']}
  | {kind: 'step-position'; entity_id: string; step_id: string; position: Vec3 | null}
  | {kind: 'step-overrides'; entity_id: string; step_id: string; operation: 'capture' | 'release'; values?: SequenceStep['objectState']}
  | {kind: 'step-layers'; entity_id: string; step_id: string; layers: NonNullable<Entity['layers']>}
  | {kind: 'step-insert'; entity_id: string; after_step_id: string | null; source?: Entity['source']; shape?: SequenceStep['shape']; text?: string}
  | {kind: 'step-duplicate'; entity_id: string; step_id: string}
  | {kind: 'step-remove'; entity_id: string; step_ids: string[]}
  | {kind: 'step-order'; entity_id: string; step_ids: string[]};
export type NativeEditorChange = NativeDeviceChange | NativeGlyphChange | NativeRackChange | NativeChosenControlChange;
export type NativeEditorRequest =
  | NativeMaterialEditorRequest
  | NativeSceneEditorRequest
  | NativeSceneEditRequest
  | {operation: 'read'}
  | {operation: 'apply'; basis: NativeEditorBasis; changes: readonly NativeEditorChange[]}
  | {operation: 'select'; basis: NativeEditorBasis; entity_id: string; step_id?: string}
  | {operation: 'select-field'; basis: NativeEditorBasis}
  | {operation: 'open'; basis: NativeEditorBasis; entity_id: string; step_id: string; editor: 'source' | 'layers' | 'placement'}
  | {operation: 'undo' | 'redo' | 'save'; basis: NativeEditorBasis};
export type NativeSceneEditorRequest = {operation: 'scene'; basis: NativeEditorBasis; intent_epoch: number} & (
  | {action: 'focus'; scene_ref: string}
  | {action: 'focus-object'; scene_ref: string; entity_ref: string}
  | {action: 'play-scene'; scene_ref: string}
  | {action: 'play' | 'pause' | 'play-saved' | 'stop-saved'}
  | {action: 'seek'; scene_ref: string; seconds: number; sequence: 'working'}
  | {action: 'save-snapshot'; name: string; next: boolean}
  | {action: 'restore-snapshot'}
);
export interface NativeSceneEditRequest {
  operation: 'scene-edit';
  basis: NativeEditorBasis;
  intent_epoch: number;
  native_selection: {scene_ref: string; entity_ref: string | null; relation_ref?: string | null};
  intent: NativeSceneEditIntent;
}
export type NativeEditorReply =
  | {ok: true; reading: NativeEditorReading; material?: NativeMaterialEditorResult}
  | {ok: false; error: string; reading?: NativeEditorReading;
      /** An acknowledged owner result can outlive a refused local adoption. */
      native_outcome?: unknown; retained_copy_ref?: string};
export interface NativeEditorController {
  request(request: NativeEditorRequest): Promise<NativeEditorReply>;
  subscribe(listener: (reading: NativeEditorReading | null) => void): () => void;
  dispose(): void;
}
export const EDITOR_CHANNEL = 'oi.native-editor/v1';

export function sameEditorBasis(a: NativeEditorBasis, b: NativeEditorBasis) {
  return a.expression_ref === b.expression_ref && a.revision === b.revision
    && a.scene_ref === b.scene_ref && a.authored_revision === b.authored_revision;
}
// Keep a type-level link to the complete authoring schema. Mutations are made
// by its existing DocumentStore and NativeWorkspace, not this boundary.
export type NativeEditorDocument = Journey;
