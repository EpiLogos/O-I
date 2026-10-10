import type {Entity, Journey, Scene, SequenceStep, Vec3} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import type {NativeRackChange} from './nativeRackSchema';
import type {NativeMaterialEditorRequest, NativeMaterialEditorResult} from './materialEditor';
import type {NativeBinding} from './parameters';
import type {BeltEntry} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/workspacePreferences';
import type {NativeScenesReading, NativeScenePlaybackReading} from './scenes';
import type {NativeSceneEditIntent} from './sceneEdits';
import type {ColorDistributionMode} from '../../../desktop/cradle/expressions-app/src/engine/types';
import type {FieldPanelSettingKey, FieldPanelSettingValue} from './nativeFieldPanelSettings';
import type {NativeSceneMaterialRequest, NativeSceneTextChange} from './sceneMaterialEdits';
import type {NativeBlueprintRequest} from './nativeBlueprintEdits';
import type {SceneBlueprint} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import type {KernelSceneBody, KernelSceneTrigger} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import type {EntitySound} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts';
import type {SemanticBinding} from '../../../desktop/cradle/expressions-app/src/engine/semantics/semanticTypes.ts';

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
/** Device widgets: ordered identities in Journey.shared.devices (never toolbelt entries). */
export interface NativeDeviceWidget {id: string; family: string}
export type NativeDeviceWidgetChange =
  | {kind: 'device-add'; family: string; after_id?: string | null}
  | {kind: 'device-remove'; device_id: string}
  | {kind: 'device-order'; device_ids: string[]};
/** Scene automation lanes (Scene.automation; groups per automationLinks.ts). Every
 * value is validated by nativeAutomationEdits.ts. automation-fire (firedAt is the
 * engine trigger token) and manual takeover are not admitted. */
export type NativeAutomationLaneValues = Partial<Pick<Scene['automation'][number], 'enabled' | 'type' | 'wave' | 'rate' | 'phase' | 'min' | 'max' | 'blend' | 'duration' | 'delay' | 'loop' | 'easing'>>;
export type NativeAutomationChange =
  | {kind: 'automation-add'; target: string; group_id?: string}
  | {kind: 'automation-set'; lane_id: string; values: NativeAutomationLaneValues}
  | {kind: 'automation-link'; lane_id: string; leader_id: string | null}
  | {kind: 'automation-remove'; lane_id: string; scope: 'lane' | 'group-target'}
  | {kind: 'automation-order'; lane_ids: string[]};
/** Recorded property tracks (Scene.propertyTracks). Takes are recorded and previewed inside the
 * Expressions frame; the one document write is removing a named track (nativeTrackEdits.ts). */
export type NativeTrackChange = {kind: 'track-remove'; track_id: string};
/** Object-state fold (nativeStateFold.ts): copies one state of a formation in the presented Scene into a formation of an earlier Scene.
 * mode is the app's fold dialog choice (default seconds); remove_source removes that state from its own formation. */
export type NativeFoldChange = {kind: 'state-fold'; entity_id: string; step_id: string; target_entity_id: string; remove_source?: boolean; mode?: 'seconds' | 'morph' | 'manual'};
/** A formation the fold picker may offer: unlocked, under the state budget, in an earlier Scene. */
export interface NativeFoldTarget {scene_id: string; scene_title: string; entity_id: string; entity_name: string; steps: number}
/** Field material (Scene.field.material) and ink mode (Scene.engine.inkMode). Validated by nativeFieldStyle.ts. */
export type FieldMaterialChange = {kind: 'field-material'; value: 'ink' | 'print' | 'round'};
export type InkModeChange = {kind: 'ink-mode'; value: 'blackOnWhite' | 'whiteOnBlack'};

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
  /** The captured native body and jump triggers of the presented Scene
   * (kernelDocumentBridge SceneBinding). Read-only; changed by scene-material. */
  nativeScene?: {scene_ref: string; body: KernelSceneBody | null; triggers: KernelSceneTrigger[];
    /** The presented Scene's native blueprint: null when unbound, absent on an older reading (not disclosed). Changed by blueprint. */
    blueprint?: SceneBlueprint | null};
  scene: Scene;
  /** Field targets ('field.<key>') the Expression currently shares (Journey.shared.values). Absent on an older reading. */
  sharedTargets?: readonly string[];
  /** Formations of earlier Scenes a selected state may be folded into (nativeStateFold.ts). Absent on an older reading. */
  foldTargets?: readonly NativeFoldTarget[];
  entityOccurrences: Record<string, string>;
  chosenControls: NativeChosenControlsReading;
  devices: readonly NativeDeviceWidget[];
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
/** Existing shared Scene Morph fields; no occurrence or alternate solver. */
export type NativeMorphSettingChange =
  | {kind: 'morph-setting'; key: 'morphEnabled' | 'autoOscillate'; value: boolean}
  | {kind: 'morph-setting'; key: 'trajectory'; value: Scene['engine']['trajectory']}
  | {kind: 'morph-setting'; key: 'driveShape'; value: Scene['engine']['driveShape']}
  | {kind: 'morph-setting'; key: 'law'; value: Scene['morph']['law']};
export type NativeColourChange =
  | {kind: 'colour-setting'; key: 'colorEnabled'; value: boolean}
  | {kind: 'colour-setting'; key: 'colorMode'; value: ColorDistributionMode}
  | {kind: 'colour-palette'; colors: readonly string[]}
  | {kind: 'colour-background'; value: string}
  | {kind: 'colour-preset'; palette_id: string};
/** Non-numeric Field panel controls. Each key's value type is exact per key
 * (nativeFieldPanelSettings.ts), so a mismatched pair does not compile. */
export type NativeFieldPanelChange = {
  [K in FieldPanelSettingKey]: {kind: 'panel-setting'; key: K; value: FieldPanelSettingValue<K>};
}[FieldPanelSettingKey];
/** Per-object sound: the whole `sound` block of one authored entity (null removes
 * it). Bounds are the app validator's (native-field/entitySound.ts). The mute
 * control is page-global presentation and is never a change of this kind. */
export type NativeEntitySoundChange = {kind: 'entity-sound'; entity_id: string; sound: EntitySound | null};
/** Per-object meaning (inspector.ts semanticControls): the whole SemanticBinding that carries this object in Scene.semanticField, or null to remove it. nativeEntitySemantic.ts validates the shape. */
export type NativeEntitySemanticChange = {kind: 'entity-semantic'; entity_id: string; semantic: SemanticBinding | null};
/** Scene semantic field: the layer's enable flag and the global colour gain (inspector.ts L121, L161). */
export type NativeSemanticFieldChange =
  | {kind: 'semantic-field-setting'; key: 'enabled'; value: boolean}
  | {kind: 'semantic-field-setting'; key: 'globalColorGain'; value: number};
/** Object-level Name, Lock and Enabled (inspector.ts entityControls). Each key
 * has its own value type; nativeEntitySettings.ts validates the exact shape. */
export type NativeEntitySettingChange =
  | {kind: 'entity-setting'; entity_id: string; key: 'name'; value: string}
  | {kind: 'entity-setting'; entity_id: string; key: 'locked' | 'enabled'; value: boolean};
export type NativeDeviceChange =
  | NativeColourChange
  | NativeEntitySoundChange
  | NativeEntitySemanticChange
  | NativeSemanticFieldChange
  | NativeMorphSettingChange
  | NativeFieldPanelChange
  | NativeEntitySettingChange
  | {kind: 'route-order'; entity_ids: string[]}
  | {kind: 'parameter'; target: string; value: number}
  | {kind: 'force-mode'; entity_id: string; value: Entity['force']['kind']}
  | {kind: 'field-setting'; key: 'mediumEnabled' | 'mediumDimension' | 'mediumPlane' | 'resonanceEnabled' | 'collisionEnabled' | 'pairwiseEnabled' | 'collisionMode'; value: boolean | '2D' | '3D' | 'vertical' | 'horizontal' | 'obstacle' | 'vessel'}
  | {kind: 'shared-setting'; target: string; shared: boolean}
  | {kind: 'force-insert'; position: Vec3; name?: string}
  | FieldMaterialChange
  | InkModeChange;
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
/** Formation add (nativeFormations.ts). 'text' is Glyph or word; the add picker offers no yantra or cymatic. */
export type NativeFormationShape = 'text' | 'ring' | 'disc' | 'triangle' | 'square';
export type NativeFormationChange = {kind: 'formation-add'; title?: string; shape?: NativeFormationShape; text?: string; position?: Vec3} | {kind: 'formation-glyph'; entity_id: string; text: string};
/** Whole-object operations on one Scene entity (nativeFormations.ts applyNativeObjectChanges). Duplicate copies the app's duplicate; remove is the app's Delete, refused while locked or a blueprint member. */
export type NativeObjectChange = {kind: 'entity-duplicate'; entity_id: string} | {kind: 'entity-remove'; entity_id: string};
export type NativeEditorChange = NativeDeviceChange | NativeGlyphChange | NativeRackChange | NativeChosenControlChange | NativeDeviceWidgetChange | NativeSceneTextChange | NativeAutomationChange | NativeFoldChange | NativeFormationChange | NativeObjectChange | NativeTrackChange;
export type NativeEditorRequest =
  | NativeMaterialEditorRequest
  | NativeSceneEditorRequest
  | NativeSceneEditRequest
  | NativeSceneMaterialRequest
  | NativeBlueprintRequest
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
