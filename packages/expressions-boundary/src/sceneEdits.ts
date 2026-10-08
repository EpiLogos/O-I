/** Ref-addressed Scene operations over the retained Journey owners (SC-1–7).
 * Preparation is inert: the caller submits snapshot through NativeWorking's
 * existing commit/checkpoint/acknowledgement path. No store or clock lives here.
 */
import {clone, type Journey, type Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import type {KernelConversion, KernelExpressionDocument} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import {prepareCompositionEdit, type CompositionEdit} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelComposition';
import {nextSceneFrom} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow';
import type {NativeWorking, WorkingSnapshot} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking';
import type {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store';
import {sameEditorBasis, type NativeEditorBasis, type NativeEditorReading, type NativeSceneEditorRequest} from './editor';
import {projectNativeScenes} from './scenes';

export type NativeSceneEditIntent =
  | {operation: 'rename'; scene_ref: string; title: string}
  | {operation: 'pacing'; scene_ref: string; duration?: number; transition?: number}
  | {operation: 'reorder'; scene_refs: string[]}
  | {operation: 'duplicate'; scene_ref: string; title?: string}
  | {operation: 'remove'; scene_ref: string};
export type NativeSceneSnapshotIntent =
  | {operation: 'save-snapshot'; scene_ref: string; title?: string}
  | {operation: 'restore-snapshot'; scene_ref: string};

export interface PreparedNativeSceneEdit {
  label: string;
  basis: {expression_ref: string; revision: number};
  request: CompositionEdit;
  snapshot: WorkingSnapshot;
  affected_scene_refs: string[];
  selected_scene_ref: string;
  /** A duplicate's native ref is the actual scene_create input produced by
   * prepareCompositionEdit, not a second ref-minting implementation. */
  created_scene_ref: string | null;
}

function title(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 160)
    throw Error('Give this Scene a name of 1–160 characters');
  return value.trim();
}
function exactScene(view: KernelConversion, journey: Journey, scene_ref: string): Scene {
  const matches = Object.entries(view.bindings).filter(([, binding]) => binding.scene_ref === scene_ref);
  if (matches.length !== 1 || !view.document.scenes.some(scene => scene.scene_ref === scene_ref))
    throw Error('Choose one exact captured native Scene ref');
  const scene = journey.scenes.find(row => row.id === matches[0][0]);
  if (!scene) throw Error('The addressed native Scene is absent from this working Journey');
  return scene;
}
function refFor(view: KernelConversion, scene: Scene): string {
  const binding = view.bindings[scene.id];
  if (!binding) throw Error('Commit a newly authored Scene before addressing it by native ref');
  return binding.scene_ref;
}
function wholeMaterial(view: KernelConversion, scene: Scene): void {
  const binding = view.bindings[scene.id];
  if (!binding || binding.page_count !== 1 || binding.loaded_refs.length !== binding.member_refs.length || binding.hidden_refs.length)
    throw Error('This operation needs the whole native Scene; paged or hidden membership was retained and no partial snapshot was claimed');
}

/** Acquisition A: snapshots already have a guarded retained-editor receiver.
 * Prepare its existing request; never capture/restore a second snapshot here.
 * A different target must first receive an acknowledged native `focus` through
 * that receiver — local setScene alone is not a native focus receipt. */
export function prepareNativeSceneSnapshot(reading: NativeEditorReading, intent: NativeSceneSnapshotIntent): NativeSceneEditorRequest {
  if (reading.basis.scene_ref !== intent.scene_ref) throw Error('Focus the exact native Scene through its retained receiver before using its snapshot');
  if (reading.scenes?.native_selected_scene_ref !== intent.scene_ref) throw Error('The native owner has not acknowledged this Scene focus; local navigation cannot establish it');
  if (!reading.playback || !Number.isSafeInteger(reading.playback.intent_epoch)) throw Error('The retained Scene receiver has disclosed no current intent epoch');
  const row = reading.scenes?.scenes.find(scene => scene.scene_ref === intent.scene_ref);
  if (!row?.material.available || !row.membership.complete) throw Error('Load complete authored native Scene correspondence before using its snapshot');
  const base = {operation: 'scene' as const, basis: clone(reading.basis), intent_epoch: reading.playback.intent_epoch};
  if (intent.operation === 'save-snapshot') return {...base, action: 'save-snapshot', name: title(intent.title ?? row.title), next: false};
  if (intent.operation !== 'restore-snapshot' || row.snapshot.availability !== 'present') throw Error('This native Scene has no saved snapshot to restore');
  return {...base, action: 'restore-snapshot'};
}

/** One named gesture -> existing Journey operation -> one captured native edit
 * batch. This never adopts a reply, changes live selection or advances time.
 * Native focus is explicit in the generated request; local navigation alone
 * is not evidence that the kernel selection changed. */
export function prepareNativeSceneEdit(view: KernelConversion, working: Journey, intent: NativeSceneEditIntent): PreparedNativeSceneEdit {
  if (working.id !== view.journey.id) throw Error('The working Journey does not address this captured native Expression');
  if (new Set(working.scenes.map(scene => scene.id)).size !== working.scenes.length)
    throw Error('Working Scene identity is ambiguous');
  for (const scene of working.scenes) refFor(view, scene);
  // kernelComposition removes native Scenes missing from its supplied Journey.
  // A withheld local row must never become an implicit native deletion.
  if (!projectNativeScenes(working, view).completeness.order)
    throw Error('Load the complete captured native Scene inventory before editing its composition; absent local rows were not interpreted as removals');
  const journey = clone(working);
  const selectedRef = view.document.selection?.scene_ref;
  if (!selectedRef) throw Error('The native owner has disclosed no Scene selection');
  if (view.document.selection?.relation_ref) throw Error('The composition commit owner cannot carry relation-only focus; acknowledge an explicit Scene or occurrence focus first');
  let selected = exactScene(view, journey, selectedRef), selectedEntity = view.document.selection?.entity_ref ?? null;
  let entityId = selectedEntity ? view.entity_ids[selectedEntity] : null;
  if (selectedEntity && (!entityId || !selected.entities.some(entity => entity.id === entityId)))
    throw Error('The selected native occurrence is not loaded; its focus was not redirected');
  let affected: Scene[], created: Scene | null = null;
  const labels: Record<NativeSceneEditIntent['operation'], string> = {
    rename: 'Rename Scene', pacing: 'Set Scene pacing', reorder: 'Reorder Scenes', duplicate: 'Duplicate Scene',
    remove: 'Remove Scene',
  };
  if (intent.operation === 'reorder') {
    const refs = journey.scenes.map(scene => refFor(view, scene));
    if (intent.scene_refs.length !== refs.length || new Set(intent.scene_refs).size !== refs.length
      || intent.scene_refs.some(ref => !refs.includes(ref))) throw Error('Scene order must contain every captured working Scene ref exactly once');
    affected = intent.scene_refs.map(ref => exactScene(view, journey, ref));
    journey.scenes = affected;
  } else {
    const scene = exactScene(view, journey, intent.scene_ref); affected = [scene];
    if (intent.operation !== 'remove') {
      const material = projectNativeScenes(working, view).scenes.find(row => row.scene_ref === intent.scene_ref)?.material;
      if (!material?.available) throw Error('This operation needs authored native Scene material; compatibility defaults were not saved as authored work');
    }
    if (intent.operation === 'rename') scene.name = title(intent.title);
    else if (intent.operation === 'pacing') {
      if (intent.duration === undefined && intent.transition === undefined) throw Error('Supply a Scene duration or transition');
      if (intent.duration !== undefined) {
        if (!Number.isFinite(intent.duration) || intent.duration < 1 || intent.duration > 3600) throw Error('Scene duration must be 1–3600 seconds');
        scene.duration = intent.duration;
      }
      if (intent.transition !== undefined) {
        if (!Number.isFinite(intent.transition) || intent.transition < 0 || intent.transition > 30) throw Error('Scene transition must be 0–30 seconds');
        scene.transition = intent.transition;
      }
    } else if (intent.operation === 'duplicate') {
      wholeMaterial(view, scene);
      const native = view.document.scenes.find(row => row.scene_ref === intent.scene_ref)!;
      const unknown = Object.keys(native).filter(key => !['scene_ref', 'title', 'revision', 'entity_refs', 'presentation', 'body', 'triggers'].includes(key));
      if (native.body != null || (native.triggers?.length ?? 0) > 0 || unknown.length)
        throw Error('The existing Journey duplicate owner cannot copy an external Scene body, triggers or unsupported native Scene fields atomically; those bindings were retained');
      // The native helper creates a new draft after its source, preserving
      // object IDs and leaving the source's saved snapshot untouched.
      created = nextSceneFrom(journey, scene);
      if (intent.title !== undefined) created.name = title(intent.title);
      selected = created; selectedEntity = null; entityId = null; affected.push(created);
    } else if (intent.operation === 'remove') {
      if (journey.scenes.length <= 1) throw Error('Keep at least one Scene in the Expression');
      const index = journey.scenes.indexOf(scene);
      delete journey.savedScenes?.[scene.id]; journey.scenes.splice(index, 1);
      if (selected.id === scene.id) {selected = journey.scenes[Math.max(0, index - 1)]; selectedEntity = null; entityId = null;}
    } else throw Error('Unsupported Scene operation');
  }
  const snapshot: WorkingSnapshot = {journey, sceneId: selected.id, entityId: entityId ?? null};
  const request = prepareCompositionEdit(view, journey, {sceneId: selected.id, entityId: entityId ?? null});
  const create = created ? request.changes.find(change => change.change === 'scene_create') : undefined;
  const created_scene_ref = create?.change === 'scene_create' ? create.scene_ref : null;
  if (created && !created_scene_ref) throw Error('The existing composition owner did not prepare the duplicate Scene identity');
  const selected_scene_ref = selected === created ? created_scene_ref! : refFor(view, selected);
  return {label: labels[intent.operation], basis: {expression_ref: view.document.expression_ref, revision: view.document.revision},
    request, snapshot, affected_scene_refs: affected.map(scene => scene === created ? created_scene_ref! : refFor(view, scene)),
    selected_scene_ref, created_scene_ref};
}

/** NativeWorkspace supplies its actual working owner from inside mutate().
 * No private work reference needs to cross the shell's presentation boundary. */
export type NativeSceneSelection = NonNullable<KernelExpressionDocument['selection']>;
export type NativeSceneWorkingOwner = Pick<NativeWorking, 'state' | 'busy' | 'commit'>;
export interface NativeSceneEditCapture {
  basis: NativeEditorBasis;
  native_selection: NativeSceneSelection;
  intent_epoch: number;
}
export interface NativeSceneEditRequest extends NativeSceneEditCapture {
  operation: 'scene-edit';
  intent: NativeSceneEditIntent;
}
export interface NativeSceneEditSuccess {
  view: KernelConversion;
  label: string;
  intent: NativeSceneEditIntent;
  previous_scene_id: string;
  scene_id: string;
  entity_id: string | null;
  selection_changed: boolean;
}
export interface NativeSceneEditHandlerOptions {
  store: DocumentStore;
  /** Actual presented Scene identity, retained through the structural gesture.
   * Reading scenes[sceneIndex] after reorder is not a new focus intent. */
  sceneId(): string;
  intentEpoch(): number;
  /** The app/receiver's existing lifetime token, never an invented clock. */
  lifetime(): unknown;
  /** Synchronous presentation owner: resolve the new index from scene_id;
   * preserve clock/body position when selection_changed is false. */
  afterSuccess(input: NativeSceneEditSuccess): void;
}
export type NativeSceneEditResult =
  | {state: 'unchanged'; label: string; basis: NativeEditorBasis}
  | {state: 'applied'; label: string; local_adoption: 'adopted'; native_outcome: KernelExpressionDocument}
  | {state: 'native-acknowledged'; label: string; local_adoption: 'refused' | 'adopted'; error: string; native_outcome: KernelExpressionDocument};

const sameNativeSelection = (a: NativeSceneSelection | undefined, b: NativeSceneSelection | undefined) =>
  !!a && !!b && a.scene_ref === b.scene_ref && a.entity_ref === b.entity_ref && (a.relation_ref ?? null) === (b.relation_ref ?? null);
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function boundedSceneIntent(intent: NativeSceneEditIntent): void {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) throw Error('Supply one named native Scene intent');
  const allowed: Record<NativeSceneEditIntent['operation'], string[]> = {
    rename: ['operation', 'scene_ref', 'title'], pacing: ['operation', 'scene_ref', 'duration', 'transition'],
    reorder: ['operation', 'scene_refs'], duplicate: ['operation', 'scene_ref', 'title'], remove: ['operation', 'scene_ref'],
  };
  if (!Object.prototype.hasOwnProperty.call(allowed, intent.operation) || Object.keys(intent).some(key => !allowed[intent.operation].includes(key)))
    throw Error('Unsupported native Scene intent or operands');
  if (intent.operation === 'reorder' && (!Array.isArray(intent.scene_refs) || !intent.scene_refs.every(ref => typeof ref === 'string')))
    throw Error('Scene order requires exact native refs');
}

/** One real DocumentStore gesture and one NativeWorking commit. Native success
 * is retained in the result even when later input/lifetime prevents adoption.
 * Revision conflicts keep the attempted local draft and its native checkpoint;
 * they are never retried or silently rolled back here. */
export function createNativeSceneEditHandler(options: NativeSceneEditHandlerOptions) {
  let inFlight = false;
  const read = (working: NativeSceneWorkingOwner): NativeSceneEditCapture => {
    const view = working.state?.view, id = options.sceneId(), binding = view?.bindings[id];
    if (!view || !binding || !view.document.selection || view.journey.id !== options.store.document.id
      || !options.store.document.scenes.some(scene => scene.id === id)) throw Error('The presented Scene has no exact native working basis');
    return {basis: {expression_ref: view.document.expression_ref, revision: view.document.revision,
      scene_ref: binding.scene_ref, authored_revision: options.store.revision},
      native_selection: clone(view.document.selection), intent_epoch: options.intentEpoch()};
  };
  return {
    read,
    async edit(input: NativeSceneEditRequest, owner: {working: NativeSceneWorkingOwner; isCurrent(): boolean}): Promise<NativeSceneEditResult> {
      const request = clone(input), working = owner.working;
      if (inFlight) throw Error('A native Scene edit is already awaiting acknowledgement');
      inFlight = true;
      try {
        if (request.operation !== 'scene-edit' || Object.keys(request).some(key => !['operation', 'basis', 'native_selection', 'intent_epoch', 'intent'].includes(key)))
          throw Error('Unsupported native Scene edit request');
        boundedSceneIntent(request.intent);
        if (options.store.transactionOpen) throw Error('Finish the current gesture before editing native Scenes');
        if (working.busy || working.state?.pending) throw Error('The native working owner has an unsettled operation');
        const captured = read(working), lifetime = options.lifetime(), sceneId = options.sceneId(), view = working.state!.view!;
        if (!owner.isCurrent() || !sameEditorBasis(request.basis, captured.basis)
          || !sameNativeSelection(request.native_selection, captured.native_selection)
          || captured.native_selection.scene_ref !== captured.basis.scene_ref
          || !Number.isSafeInteger(request.intent_epoch) || request.intent_epoch !== captured.intent_epoch)
          throw Error('The captured native Scene, selection, authored revision, lifetime or intent changed before its edit');
        const plan = prepareNativeSceneEdit(view, options.store.document, request.intent);
        // Preparation is synchronous but can be nontrivial. Verify the same
        // owner facts immediately before the sole write as well.
        const before = read(working);
        if (!owner.isCurrent() || options.lifetime() !== lifetime || options.sceneId() !== sceneId
          || options.store.transactionOpen || working.busy || working.state?.pending
          || !sameEditorBasis(captured.basis, before.basis) || !sameNativeSelection(captured.native_selection, before.native_selection)
          || options.intentEpoch() !== captured.intent_epoch) throw Error('New work arrived before the native Scene gesture; nothing was written');
        if (!plan.request.changes.length) return {state: 'unchanged', label: plan.label, basis: captured.basis};
        options.store.change(() => {options.store.document = clone(plan.snapshot.journey)});
        // finish() writes updatedAt. Commit the actual post-gesture document,
        // not the planner's earlier copy, and retain the exact captured focus.
        const submitted: WorkingSnapshot = {...plan.snapshot, journey: clone(options.store.document)};
        const authoredRevision = options.store.revision;
        const expectedFocus = plan.request.changes.find(change => change.change === 'focus');
        const expectedSelection: NativeSceneSelection = expectedFocus?.change === 'focus'
          ? {scene_ref: expectedFocus.scene_ref, entity_ref: expectedFocus.entity_ref}
          : captured.native_selection;
        const document = await working.commit(submitted);
        const native_outcome = clone(document);
        const refused = (error: string, adopted = false): NativeSceneEditResult => ({state: 'native-acknowledged', label: plan.label,
          local_adoption: adopted ? 'adopted' : 'refused', error, native_outcome});
        // Every post-await refusal still returns the actual acknowledgement.
        // No late receipt may replace newer local work or move its body/clock.
        let acknowledged: KernelConversion | undefined;
        try {
          acknowledged = working.state?.view;
          if (document.schema !== 'oi.expression/v1' || document.expression_ref !== captured.basis.expression_ref
            || document.revision !== captured.basis.revision + 1 || !sameNativeSelection(document.selection, expectedSelection))
            return refused('The owning acknowledgement differs from the captured Scene edit; inspect its native outcome');
          if (!owner.isCurrent() || options.lifetime() !== lifetime || options.sceneId() !== sceneId
            || options.intentEpoch() !== captured.intent_epoch || options.store.transactionOpen
            || options.store.revision !== authoredRevision || options.store.document.id !== submitted.journey.id
            || !sameValue(options.store.document, submitted.journey))
            return refused('The Scene edit succeeded natively; newer local work, lifetime or transport intent was retained without adopting that receipt');
          if (working.busy || working.state?.pending || !acknowledged || !sameValue(acknowledged.document, document))
            return refused('The Scene edit succeeded natively; its working owner moved before local adoption');
        } catch (error) {return refused(`The Scene edit succeeded natively; its receiving context is unavailable: ${error instanceof Error ? error.message : String(error)}`)}
        let adopted = false;
        try {
          options.store.acknowledge(acknowledged.journey); adopted = true;
          options.afterSuccess({view: clone(acknowledged), label: plan.label, intent: clone(request.intent),
            previous_scene_id: sceneId, scene_id: plan.snapshot.sceneId, entity_id: plan.snapshot.entityId,
            selection_changed: !sameNativeSelection(captured.native_selection, document.selection)});
        } catch (error) {return refused(`The Scene edit succeeded natively; ${adopted ? 'its presentation' : 'local adoption'} failed: ${error instanceof Error ? error.message : String(error)}`, adopted)}
        return {state: 'applied', label: plan.label, local_adoption: 'adopted', native_outcome};
      } finally {inFlight = false}
    },
  };
}
