import {EDITOR_CHANNEL, sameEditorBasis, type NativeDeviceChange, type NativeEditorReading, type NativeEditorReply, type NativeEditorRequest, type NativeGlyphChange, type NativeChosenControlChange, type NativeDeviceWidgetChange, type NativeAutomationChange, type NativeFormationChange, type NativeObjectChange, type NativeTrackChange} from '../../../../../packages/expressions-boundary/src/editor';
import {applyNativeFormationChanges, applyNativeObjectChanges, validateFormationGlyph} from '../../../../../packages/expressions-boundary/src/nativeFormations';
import {readNativeChosenControls, applyNativeChosenControlChanges} from '../../../../../packages/expressions-boundary/src/chosenControls';
import {readNativeDeviceWidgets, applyNativeDeviceWidgetChanges} from '../../../../../packages/expressions-boundary/src/nativeDeviceWidgets';
import {applyNativeDeviceChanges, readNativeDeviceEffectiveValues} from '../../../../../packages/expressions-boundary/src/nativeDeviceEdits';
import {applyNativeRackChanges} from '../../../../../packages/expressions-boundary/src/nativeRacks';
import {readSharedFieldTargets} from '../../../../../packages/expressions-boundary/src/nativeSharedSettings';
import {NativeMaterialRefusal} from '../../../../../packages/expressions-boundary/src/nativeMaterials';
import {applyNativeSceneTextChanges, type NativeSceneTextChange} from '../../../../../packages/expressions-boundary/src/sceneMaterialEdits';
import {applyNativeAutomationChanges} from '../../../../../packages/expressions-boundary/src/nativeAutomationEdits';
import {applyNativeTrackChanges} from '../../../../../packages/expressions-boundary/src/nativeTrackEdits';
import {applyNativeStateFoldChanges, readNativeFoldTargets} from '../../../../../packages/expressions-boundary/src/nativeStateFold';
import type {NativeFoldChange} from '../../../../../packages/expressions-boundary/src/editor';
import type {NativeRackChange, NativeRackTarget} from '../../../../../packages/expressions-boundary/src/nativeRackSchema';
import {clone, uid, validateJourney, type Journey} from './model';
import {appendFormationState} from './formationAuthoring';
import {capturedStepState, refitEntityForGlyph, refitStepForGlyph, refitStepForText, refitStepForSource, refitFormationForFont} from './stateSizing';
import {preserveLayerStates, setStateSource, useStateShape} from './sourceState';
import {applyGlyph} from './nativeFeatures';
import {syncHeldState} from './workspacePreferences';
import type {DocumentStore} from './store';
import type {KernelConversion} from './kernelDocumentBridge';
import {prepareCompositionEdit} from './kernelComposition.js';
import {effectiveScene, writeShared} from './sharedSettings';
import {blueprintMember} from './blueprintGeometry';
import {projectNativeScenes} from '../../../../../packages/expressions-boundary/src/scenes';
import {nativeSceneTransportMaterial} from './sceneTransport';
import {validateBlueprintIntent} from '../../../../../packages/expressions-boundary/src/nativeBlueprintEdits';
import {blueprintTransformIntent} from './blueprintHUD';
import {prepareBlueprintEdit, type BlueprintIntent} from './nativeBlueprint';
import {readSceneBlueprint} from './kernelExpressions';
import {loadExpressionsFamilies} from '../../../../../packages/expressions-boundary/src/expressionsFamilies';

loadExpressionsFamilies();

function finite(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw Error(`${label} must be between ${min} and ${max}`);
  return value;
}
/** Named edits over the complete native authoring schema. No reduced reserialisation. */
export function applyNativeGlyphChanges(document: Journey, sceneId: string, changes: readonly NativeGlyphChange[]): Journey {
  const next = clone(document), scene = next.scenes.find(s => s.id === sceneId);
  if (!scene) throw Error('The captured scene no longer exists');
  for (const change of changes) {
    if (change.kind === 'field-font') {
      const values = change.values;
      if (!values || !Object.keys(values).length || Object.keys(values).some(key => !['fontFamily','fontWeight'].includes(key))) throw Error('Unsupported Field font setting');
      if (values.fontFamily !== undefined && (typeof values.fontFamily !== 'string' || !values.fontFamily.trim() || values.fontFamily.length > 200 || /[\u0000-\u001f;{}]/.test(values.fontFamily))) throw Error('Choose a valid Field font stack');
      if (values.fontWeight !== undefined && (!Number.isInteger(values.fontWeight) || values.fontWeight < 1 || values.fontWeight > 1000)) throw Error('Field font weight must be an integer between 1 and 1000');
      const previous = next.scenes.map(source => {
        const engine = effectiveScene(next,source).engine;
        return {fontFamily:engine.fontFamily,fontWeight:engine.fontWeight};
      });
      for (const key of ['fontFamily','fontWeight'] as const) {
        const value = values[key];
        if (value !== undefined && !writeShared(next,scene,`engine.${key}`,value)) Object.assign(scene.engine,{[key]:value});
      }
      // Shared Field settings affect every inheriting Scene. Reuse the native
      // glyph metrics/refit law, preserving locked and sampled-source geometry.
      next.scenes.forEach((source,index) => {
        const effective = effectiveScene(next,source), engine = effective.engine;
        const font = {fontFamily:engine.fontFamily,fontWeight:engine.fontWeight};
        if (effective.engine.autoFitSizes === false || previous[index].fontFamily === font.fontFamily && previous[index].fontWeight === font.fontWeight) return;
        for (const entity of source.entities) if (entity.kind === 'formation' && !entity.locked) refitFormationForFont(entity,previous[index],font);
      });
      continue;
    }
    if (change.kind === 'formation-glyph') {
      // The app's native-glyph base edit (app.ts case 'native-glyph', base): the formation's own glyph, mirrored onto its only state.
      const {entity: base, text} = validateFormationGlyph(scene, change);
      const font = {fontFamily: scene.engine.fontFamily, fontWeight: scene.engine.fontWeight};
      useStateShape(base, 0); base.layers = []; setStateSource(base, 0, undefined); applyGlyph(base, null, text);
      if (scene.engine.autoFitSizes !== false) {
        refitEntityForGlyph(base, text, font);
        if (base.sequence.steps.length === 1) refitStepForGlyph(base, 0, text, font);
      }
      continue;
    }
    const e = scene.entities.find(entity => entity.id === change.entity_id);
    if (!e || e.kind !== 'formation') throw Error('The sequence target is not a formation in this scene');
    if (e.locked) throw Error('Unlock this formation before editing its sequence');
    if (new Set(e.sequence.steps.map(step => step.id)).size !== e.sequence.steps.length) throw Error('This sequence contains ambiguous state identities; repair its source before editing');
    const index = 'step_id' in change ? e.sequence.steps.findIndex(k => k.id === change.step_id) : -1;
    const step = index >= 0 ? e.sequence.steps[index] : undefined;
    if ('step_id' in change && !step) throw Error('The captured sequence state no longer exists');
    switch (change.kind) {
      case 'sequence-settings': {
        const v = change.values;
        const keys = new Set(['enabled','clock','manual','hold','transition','order','easing','jitter','impulse','rateMul','phaseOffset']);
        if (Object.keys(v).some(key => !keys.has(key))) throw Error('Unsupported sequence setting');
        for (const key of ['enabled','manual'] as const) if (v[key] !== undefined && typeof v[key] !== 'boolean') throw Error('Invalid sequence switch');
        if (v.clock !== undefined && !['seconds','morph'].includes(v.clock)) throw Error('Unknown sequence clock');
        if (v.order !== undefined && !['loop','pingpong','random'].includes(v.order)) throw Error('Unknown sequence order');
        if (v.easing !== undefined && !['linear','smoothstep','kineticSnap','whip'].includes(v.easing)) throw Error('Unknown native easing');
        for (const key of ['hold','transition'] as const) if (v[key] !== undefined) finite(v[key]!,0,3600,key);
        if (v.jitter !== undefined) finite(v.jitter,0,1,'Jitter');
        if (v.impulse !== undefined) finite(v.impulse,0,2,'Impulse');
        if (v.rateMul !== undefined) finite(v.rateMul,-100,100,'Rate');
        if (v.phaseOffset !== undefined) finite(v.phaseOffset,-1000,1000,'Phase');
        Object.assign(e.sequence,v);
        if (v.manual === true) {
          if (!writeShared(next,scene,'engine.autoOscillate',false)) scene.engine.autoOscillate = false;
          if (!writeShared(next,scene,'engine.morphEnabled',true)) scene.engine.morphEnabled = true;
        }
        break;
      }
      case 'step-timing':
        if (change.hold !== undefined) {step!.hold = finite(change.hold,0,3600,'Hold'); step!.holdOverride = true}
        if (change.transition !== undefined) {step!.transition = finite(change.transition,0,3600,'Transition'); step!.transitionOverride = true}
        break;
      case 'step-source': {
        if (!['text','ring','disc','square','triangle','yantra','cymatic'].includes(change.shape)) throw Error('Unknown native glyph shape');
        const old = step!.text;
        useStateShape(e,index); step!.shape = change.shape;
        if (change.text !== undefined) {if (!change.text.trim()) throw Error('A glyph state needs content'); step!.text = change.text}
        setStateSource(e,index,change.source);
        if (scene.engine.autoFitSizes !== false) {
          if (change.source) refitStepForSource(e,index);
          else if (change.shape === 'text') refitStepForText(e,index,old,step!.text,{fontFamily: scene.engine.fontFamily, fontWeight: scene.engine.fontWeight});
        }
        break;
      }
      case 'step-position':
        if (change.position) for (const v of Object.values(change.position)) finite(v,-100,100,'State offset');
        step!.position = clone(change.position); break;
      case 'step-overrides':
        if (change.operation === 'release') delete step!.objectState;
        else if (change.operation === 'capture') step!.objectState = change.values ? clone(change.values) : capturedStepState(e,index);
        else throw Error('Unknown state override operation');
        break;
      case 'step-layers':
        if (change.layers.length > 6 || new Set(change.layers.map(l => l.id)).size !== change.layers.length) throw Error('A state supports six uniquely identified layers');
        preserveLayerStates(e); step!.layers = clone(change.layers); break;
      case 'step-insert': {
        const after = change.after_step_id === null ? -1 : e.sequence.steps.findIndex(k => k.id === change.after_step_id);
        if (change.after_step_id !== null && after < 0) throw Error('The insertion destination no longer exists');
        const added = appendFormationState(e,change.text ?? e.text,change.source,{fontFamily: scene.engine.fontFamily,fontWeight: scene.engine.fontWeight},scene.engine.autoFitSizes !== false);
        const [item] = e.sequence.steps.splice(added,1); item.shape = change.shape ?? 'text';
        e.sequence.steps.splice(after+1,0,item); break;
      }
      case 'step-duplicate': {
        if (e.sequence.steps.length >= 32) throw Error('A formation supports 32 states');
        const copy = clone(step!); copy.id = uid('step');
        // A native link identity belongs to its original occurrence.
        delete copy.native; copy.layers = copy.layers?.map(layer => ({...layer,id: uid('layer')}));
        e.sequence.steps.splice(index+1,0,copy); break;
      }
      case 'step-remove': {
        const ids = new Set(change.step_ids);
        if (!ids.size || change.step_ids.some(id => !e.sequence.steps.some(k => k.id === id))) throw Error('Choose existing sequence states');
        if (e.sequence.steps.length <= ids.size) throw Error('Keep at least one state in this formation');
        e.sequence.steps = e.sequence.steps.filter(k => !ids.has(k.id)); break;
      }
      case 'step-order': {
        const ids = change.step_ids;
        if (ids.length !== e.sequence.steps.length || new Set(ids).size !== ids.length || ids.some(id => !e.sequence.steps.some(k => k.id === id))) throw Error('Reordering must retain every stable state once');
        const byId = new Map(e.sequence.steps.map(k => [k.id,k])); e.sequence.steps = ids.map(id => byId.get(id)!); break;
      }
      default: throw Error('Unsupported native glyph edit');
    }
    if (step) syncHeldState(e,Math.max(0,e.sequence.steps.findIndex(k => k.id === step.id)));
  }
  // Existing validation detects unsupported/invalid payloads before store adoption.
  validateJourney(next);
  return next;
}

export interface NativeEditorReceiver {
  read(): NativeEditorReading;
  transactionOpen(): boolean;
  apply(request: Extract<NativeEditorRequest,{operation:'apply'}>): Promise<void>;
  select(request: Extract<NativeEditorRequest,{operation:'select'}>, isCurrent?: () => boolean): Promise<void>;
  selectField(request: Extract<NativeEditorRequest,{operation:'select-field'}>, isCurrent?: () => boolean): Promise<void>;
  scene(request: Extract<NativeEditorRequest,{operation:'scene'}>, isCurrent?: () => boolean): Promise<void>;
  editScenes(request: Extract<NativeEditorRequest,{operation:'scene-edit'}>, isCurrent?: () => boolean): Promise<void>;
  sceneMaterial?(request: Extract<NativeEditorRequest,{operation:'scene-material'}>, isCurrent?: () => boolean): Promise<void>;
  blueprint?(request: Extract<NativeEditorRequest,{operation:'blueprint'}>, isCurrent?: () => boolean): Promise<void>;
  open(request: Extract<NativeEditorRequest,{operation:'open'}>, isCurrent?: () => boolean): Promise<void>;
  history(operation: 'undo' | 'redo'): Promise<void>;
  save(): Promise<void>;
  material?(request: Extract<NativeEditorRequest,{operation:'material'}>): Promise<import('../../../../../packages/expressions-boundary/src/materialEditor').NativeMaterialEditorResult>;
}
export class NativeSceneEditRefusal extends Error {
  constructor(message:string,readonly native_outcome:unknown){super(message);this.name='NativeSceneEditRefusal'}
}
interface RetainedEditorOptions {
  store: DocumentStore;
  sceneId(): string;
  selection(): NativeEditorReading['selection'];
  nativeView(): KernelConversion | undefined;
  nativeSelect(sceneId: string, entityId: string | null): Promise<'applied' | 'superseded' | 'invalidated' | 'failed'>;
  commit(): Promise<boolean | undefined>;
  change(mutate: () => void): void;
  afterHistory(): void;
  selectLocal(entityId: string | null, stepIndex: number): void;
  openEditor(editor: 'source' | 'layers' | 'placement', entityId: string, stepIndex: number): void;
  standing(): {busy: boolean; notice: string | null};
  telemetry(): {params?: Record<string, number>; config?: unknown; simTime?: number; sequences?: NativeEditorReading['observation'] extends infer O ? O extends {sequences?: infer S} ? S : never : never} | undefined;
  fieldPaused(): boolean;
  editScenes?(request: Extract<NativeEditorRequest,{operation:'scene-edit'}>, isCurrent: () => boolean): Promise<void>;
  /** Native body and jump-trigger owner: the host resolves a body reading and
   * runs prepareNativeSceneMaterialEdit inside nativeWorkspace.edit. */
  editSceneMaterial?(request: Extract<NativeEditorRequest,{operation:'scene-material'}>, isCurrent: () => boolean): Promise<void>;
  /** Native blueprint owner: receives one fully resolved, preflighted BlueprintIntent (nativeBlueprint.ts) and must submit it
   * through nativeWorkspace.blueprint, which keeps the captured revision CAS. Absent means the shell refuses honestly. */
  editBlueprint?(intent: BlueprintIntent, isCurrent: () => boolean): Promise<void>;
  sceneControls?: {
    read(): NonNullable<NativeEditorReading['playback']>;
    recording(): boolean;
    transitionPending?(): boolean;
    focus(sceneId: string): void;
    transport(action: 'play' | 'pause' | 'play-saved' | 'stop-saved'): void;
    seek(seconds: number): void;
    snapshot(input: {action: 'save-snapshot'; name: string; next: boolean} | {action: 'restore-snapshot'}): void;
  };
}
/** Joins the existing app owners; the shell supplies no second document. */
export function createRetainedNativeEditor(options: RetainedEditorOptions): NativeEditorReceiver {
  const current = () => {
    const scene=options.store.document.scenes.find(s=>s.id===options.sceneId()), view=options.nativeView();
    const binding=scene&&view?.bindings[scene.id];
    if(!scene||!view||!binding)throw Error('Open a native scene before using its editor');
    return {scene,view,binding};
  };
  const commit = async () => {if(!await options.commit())throw Error(options.standing().notice??'The native owner refused the edit; its working draft is retained')};
  const selectionBasis=(basis:NativeEditorReading['basis'],isCurrent:()=>boolean)=>{
    if(!isCurrent())throw Error('The selected editor lifetime changed; current human work was retained');
    if(options.store.transactionOpen)throw Error('Finish the current human gesture before changing native selection');
    const captured=read();
    if(captured.standing.pending)throw Error('A native editor operation is awaiting acknowledgement');
    if(!sameEditorBasis(basis,captured.basis))throw Error('The captured scene or authoring revision changed; your draft is retained');
  };
  const selectedTarget=(captured:ReturnType<typeof current>,revision:number,entityId:string|null,stepId:string|null,isCurrent:()=>boolean)=>{
    const next=current(),expected=entityId===null?null:captured.binding.occurrences.find(row=>row.view_entity_id===entityId)?.entity_ref;
    const occurrence=entityId===null?null:next.binding.occurrences.find(row=>row.view_entity_id===entityId)?.entity_ref;
    const nativeSelection=next.view.document.selection,entity=entityId===null?undefined:next.scene.entities.find(row=>row.id===entityId);
    const index=stepId?entity?.sequence.steps.findIndex(row=>row.id===stepId)??-1:0;
    if(!isCurrent()||options.store.transactionOpen||options.store.revision!==revision||next.scene.id!==captured.scene.id
      ||next.binding.scene_ref!==captured.binding.scene_ref||next.view.document.expression_ref!==captured.view.document.expression_ref
      ||expected===undefined||occurrence!==expected||nativeSelection?.scene_ref!==captured.binding.scene_ref
      ||nativeSelection.entity_ref!==expected||!!nativeSelection.relation_ref||entityId!==null&&(!entity||index<0))
      throw Error('The selected native target or editor lifetime changed; current human work was retained');
    return {entity,index};
  };
  const checkPosition = (entityId:string) => {
    const {scene,view,binding}=current(), occurrence=binding.occurrences.find(o=>o.view_entity_id===entityId);
    if(blueprintMember(scene,entityId))throw Error('Release the blueprint before editing a member position');
    if(occurrence&&(view.document.entities[occurrence.entity_ref] as {pinned?:boolean}).pinned)throw Error('Unpin the native occurrence before moving it');
  };
  const read = ():NativeEditorReading => {
    const {scene,view,binding}=current(), telemetry=options.telemetry(), standing=options.standing();
    const projected=effectiveScene(options.store.document,scene);
    const occurrences=Object.fromEntries(binding.occurrences.map(o=>[o.view_entity_id,o.entity_ref]));
    const effectiveValues=telemetry?readNativeDeviceEffectiveValues(projected,telemetry):undefined;
    let dirty=true;try{dirty=prepareCompositionEdit(view,options.store.document).changes.length>0}catch{/* conflicting local work remains dirty */}
    return {basis:{expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:binding.scene_ref,authored_revision:options.store.revision},
      scenes:projectNativeScenes(options.store.document,view),foldTargets:readNativeFoldTargets(options.store.document,scene.id),...(options.sceneControls?{playback:clone(options.sceneControls.read())}:{}),
      ...(view.document.selection?{nativeSelection:clone(view.document.selection)}:{}),
      scene:clone(projected), sharedTargets:readSharedFieldTargets(options.store.document,scene), entityOccurrences:occurrences,selection:clone(options.selection()),
      nativeScene:{scene_ref:binding.scene_ref,body:clone(binding.body),triggers:clone(binding.triggers),
        blueprint:clone(view.document.scenes.find(row=>row.scene_ref===binding.scene_ref)?.presentation?.scene.composition.blueprint??null)},
      devices:readNativeDeviceWidgets(options.store.document),
      chosenControls:readNativeChosenControls(options.store.document,scene,{entity_ids:options.selection().entity_ids,entityOccurrences:occurrences,effectiveValues,nativePinned:new Set(Object.values(view.document.entities).filter(e=>(e as {pinned?:boolean}).pinned).map(e=>e.entity_ref))}),
      history:{canUndo:options.store.undoStack.length>0,canRedo:options.store.redoStack.length>0},standing:{dirty,pending:standing.busy,notice:standing.notice},
      observation:{fieldPaused:options.fieldPaused(),simTime:telemetry?.simTime,effectiveValues,sequences:telemetry?.sequences}};
  };
  return {
    read, transactionOpen:()=>options.store.transactionOpen,
    async editScenes(request,isCurrent=()=>true) {
      if(!options.editScenes)throw Error('This retained editor has no Scene editing receiver');
      if(options.sceneControls?.recording())throw Error('Finish the current parameter recording before editing Scenes');
      if(options.sceneControls?.transitionPending?.())throw Error('The saved Scene focus is awaiting native acknowledgement');
      await options.editScenes(clone(request),isCurrent);
    },
    async sceneMaterial(request,isCurrent=()=>true) {
      // Same guards as Scene edits: the receiver already checked the captured basis and busy state.
      if(!options.editSceneMaterial)throw Error('This retained editor has no Scene material receiver');
      if(options.store.transactionOpen)throw Error('Finish the current human gesture before changing Scene material');
      if(options.sceneControls?.recording())throw Error('Finish the current parameter recording before editing Scene material');
      if(options.sceneControls?.transitionPending?.())throw Error('The saved Scene focus is awaiting native acknowledgement');
      await options.editSceneMaterial(clone(request),isCurrent);
    },
    async blueprint(request,isCurrent=()=>true) {
      // Same guards as Scene material. The receiver has checked the captured basis and busy state; the owner gets one resolved intent.
      if(!options.editBlueprint)throw Error('This retained editor has no Blueprint receiver');
      if(options.store.transactionOpen)throw Error('Finish the current human gesture before changing the blueprint');
      if(options.sceneControls?.recording())throw Error('Finish the current parameter recording before changing the blueprint');
      if(options.sceneControls?.transitionPending?.())throw Error('The saved Scene focus is awaiting native acknowledgement');
      const captured=read(),{view}=current(),sceneId=options.sceneId();
      if(captured.standing.pending)throw Error('A native editor operation is awaiting acknowledgement');
      if(!sameEditorBasis(request.basis,captured.basis)||!isCurrent())throw Error('The captured Scene or editor lifetime changed');
      const payload=validateBlueprintIntent(request.intent);
      const address={expression_ref:view.document.expression_ref,revision:view.document.revision,scene_ref:captured.basis.scene_ref};
      let intent:BlueprintIntent;
      if(payload.operation==='bind'){
        // The assigned native roles are read by the owner, never supplied by the shell (the blueprint HUD's bind law).
        const proposal=await readSceneBlueprint(address);
        if(!sameEditorBasis(request.basis,read().basis)||!isCurrent())throw Error('The native Scene changed while reading its roles; try again');
        intent={...address,operation:'bind',binding:proposal.binding};
      }
      else if(payload.operation==='release')intent={...address,operation:'release'};
      else intent=blueprintTransformIntent(view,sceneId,{translation:payload.translation,rotationDegrees:payload.rotation_degrees,size:payload.size});
      // Preflight the exact native edit law against the captured revision. Nothing is written here.
      prepareBlueprintEdit(view,intent);
      await options.editBlueprint(intent,isCurrent);
    },
    async scene(request,isCurrent=()=>true) {
      request=clone(request);
      const controls=options.sceneControls;
      if(!controls)throw Error('This retained editor has no Scene transport receiver');
      const extra=request.action==='focus'||request.action==='play-scene'?['scene_ref']:request.action==='focus-object'?['scene_ref','entity_ref']:request.action==='seek'?['scene_ref','seconds','sequence']:request.action==='save-snapshot'?['name','next']:[];
      const actions=['focus','focus-object','play-scene','play','pause','play-saved','stop-saved','seek','save-snapshot','restore-snapshot'];
      if(!actions.includes(request.action)||Object.keys(request).some(key=>!['operation','basis','action','intent_epoch',...extra].includes(key)))throw Error('Unsupported Scene operation or operands');
      if(options.store.transactionOpen)throw Error('Finish the current human gesture before changing Scenes');
      const captured=read(),{scene,view}=current(),playback=controls.read();
      if(!sameEditorBasis(request.basis,captured.basis)||!isCurrent())throw Error('The captured Scene or editor lifetime changed');
      if(captured.standing.pending)throw Error('A native editor operation is awaiting acknowledgement');
      if(!Number.isSafeInteger(request.intent_epoch)||request.intent_epoch!==playback.intent_epoch)throw Error('The Scene transport intent changed; read its current state');
      if(controls.recording())throw Error('Finish the current parameter recording before changing Scene transport or snapshots');
      if(controls.transitionPending?.())throw Error('The saved Scene focus is awaiting native acknowledgement');
      const authored=nativeSceneTransportMaterial(view);
      const rows=captured.scenes!;
      let target=scene;
      if(request.action==='play-saved'&&(!rows.timing.saved.available||!rows.timing.saved.extents.length))throw Error('Save an authored native Scene before playing the saved sequence');
      const savedTarget=request.action==='play-saved'&&!options.store.document.savedScenes?.[scene.id]&&rows.timing.saved.available?rows.timing.saved.extents[0].scene_ref:null;
      if(request.action==='focus'||request.action==='focus-object'||request.action==='play-scene'||request.action==='seek'||savedTarget) {
        const targetRef=request.action==='focus'||request.action==='focus-object'||request.action==='play-scene'||request.action==='seek'?request.scene_ref:savedTarget!;
        const row=rows.scenes.find(row=>row.scene_ref===targetRef);
        target=options.store.document.scenes.find(value=>value.id===row?.local_scene_id)!;
        if(!row||!target)throw Error('The requested native Scene is not loaded');
        if(request.action==='play-scene'&&!row.material.available)throw Error('The requested Scene has no authored native pacing');
        const member=request.action==='focus-object'?row.members.find(member=>member.entity_ref===request.entity_ref&&member.state==='loaded'):null;
        const entityId=member?.local_entity_id??null;
        if(request.action==='focus-object'&&(!entityId||!target.entities.some(entity=>entity.id===entityId)))throw Error('The requested native occurrence is not loaded in this exact Scene');
        if(request.action==='seek'&&(request.sequence!=='working'||!row.working||!Number.isFinite(request.seconds)||request.seconds<0||request.seconds>row.working.duration))throw Error('Seek requires a bounded authored working Scene time in seconds');
        const version=options.store.revision;
        if(await options.nativeSelect(target.id,entityId)!=='applied')throw Error('The native Scene focus was superseded or refused');
        const next=current(),selection=next.view.document.selection;
        if(!isCurrent()||options.store.transactionOpen||options.store.revision!==version||options.sceneId()!==scene.id
          ||controls.read().intent_epoch!==playback.intent_epoch||next.view.document.expression_ref!==view.document.expression_ref
          ||!options.store.document.scenes.some(value=>value.id===target.id)
          ||next.view.document.revision<view.document.revision||next.view.document.revision>view.document.revision+1
          ||selection?.scene_ref!==targetRef||selection.entity_ref!==(request.action==='focus-object'?request.entity_ref:null)||!!selection.relation_ref)
          throw Error('New work or transport arrived during native Scene focus; its current target is retained');
        controls.focus(target.id);
        if(request.action==='focus-object')options.selectLocal(entityId,0);
        if(request.action==='play-scene'){controls.seek(0);controls.transport('play')}
        if(request.action==='seek')controls.seek(request.seconds);
        else if(request.action==='play-saved')controls.transport('play-saved');
        return;
      }
      if(request.action==='save-snapshot'||request.action==='restore-snapshot') {
        if(rows.native_selected_scene_ref!==request.basis.scene_ref||view.document.selection?.relation_ref)throw Error('Acknowledge the exact native Scene focus before using its snapshot');
        const row=rows.scenes.find(value=>value.scene_ref===request.basis.scene_ref);
        if(!row?.material.available||!row.membership.complete)throw Error('Load complete authored working and saved Scene correspondence before capturing or restoring its snapshot');
        if(request.action==='restore-snapshot'&&row.snapshot.availability!=='present')throw Error('This native Scene has no saved snapshot');
        if(request.action==='save-snapshot'&&(typeof request.name!=='string'||!request.name.trim()||request.name.trim().length>160||typeof request.next!=='boolean'||request.next&&options.store.document.scenes.length>=64))throw Error('Supply a Scene name of 1–160 characters and an admitted next draft');
        controls.snapshot(request);await commit();return;
      }
      if(request.action==='play'&&(!authored||!authored.includes(scene.id)))throw Error('Native Scene pacing is not disclosed; compatibility material cannot establish playback');
      controls.transport(request.action);
    },
    async apply(request) {
      const {scene,binding}=current();
      for(const change of request.changes) {
        if(change.kind==='step-position')checkPosition(change.entity_id);
        if(change.kind==='parameter'&&change.target.startsWith('entity:')&&/:(x|y|z)$/.test(change.target))checkPosition(decodeURIComponent(change.target.slice(7,change.target.lastIndexOf(':'))));
      }
      let next=options.store.document;
      const deviceKinds=new Set(['parameter','force-mode','field-setting','morph-setting','colour-setting','colour-palette','colour-background','colour-preset','force-insert','panel-setting','route-order','entity-setting','entity-sound','entity-semantic','semantic-field-setting','field-material','ink-mode']);
      const family=(kind:string)=>kind.startsWith('device-')?'widget':kind.startsWith('chosen-')?'chosen':kind.startsWith('rack-')?'rack':kind.startsWith('automation-')?'automation':kind.startsWith('track-')?'track':kind.startsWith('text-layer-')?'text':kind==='formation-glyph'?'glyph':kind.startsWith('formation-')?'formation':kind==='entity-duplicate'||kind==='entity-remove'?'object':kind==='state-fold'?'fold':deviceKinds.has(kind)?'device':'glyph';
      const authorizeTarget=(target:NativeRackTarget)=>{
        if(target.kind==='entity'&&['x','y','z'].includes(target.path)) {
          const occurrence=binding.occurrences.find(o=>o.entity_ref===target.entity_ref);
          if(!occurrence)throw Error('The mapped native occurrence is not present');
          checkPosition(occurrence.view_entity_id);
        }
      };
      // Keep mixed-operation order; batch each contiguous family once.
      for(let first=0;first<request.changes.length;) {
        const type=family(request.changes[first].kind);let end=first+1;
        while(end<request.changes.length&&family(request.changes[end].kind)===type)end++;
        const changes=request.changes.slice(first,end);
        next=type==='widget'?applyNativeDeviceWidgetChanges(next,changes as NativeDeviceWidgetChange[]):type==='chosen'?applyNativeChosenControlChanges(next,scene.id,changes as NativeChosenControlChange[],options.selection().entity_ids,Object.fromEntries(binding.occurrences.map(o=>[o.view_entity_id,o.entity_ref]))):type==='device'?applyNativeDeviceChanges(next,scene.id,changes as NativeDeviceChange[],read().observation?.effectiveValues):type==='rack'?applyNativeRackChanges(next,scene.id,changes as NativeRackChange[],Object.fromEntries(binding.occurrences.map(o=>[o.view_entity_id,o.entity_ref])),read().observation?.effectiveValues,authorizeTarget):type==='automation'?applyNativeAutomationChanges(next,scene.id,changes as NativeAutomationChange[]):type==='track'?applyNativeTrackChanges(next,scene.id,changes as NativeTrackChange[]):type==='object'?applyNativeObjectChanges(next,scene.id,changes as NativeObjectChange[]):type==='formation'?applyNativeFormationChanges(next,scene.id,changes as NativeFormationChange[]):type==='text'?applyNativeSceneTextChanges(next,scene.id,changes as NativeSceneTextChange[]):type==='fold'?applyNativeStateFoldChanges(next,scene.id,changes as NativeFoldChange[]):applyNativeGlyphChanges(next,scene.id,changes as NativeGlyphChange[]);
        first=end;
      }
      options.change(()=>{options.store.document=next});await commit();
    },
    async selectField(request,isCurrent=()=>true) {
      if(Object.keys(request).some(key=>key!=='operation'&&key!=='basis'))throw Error('Field selection accepts only its operation and captured native basis');
      if(options.store.transactionOpen)throw Error('Finish the current human gesture before selecting the Field');
      const captured=read();
      if(captured.standing.pending)throw Error('A native editor operation is awaiting acknowledgement');
      if(!sameEditorBasis(request.basis,captured.basis))throw Error('The captured scene or authoring revision changed; your draft is retained');
      if(!isCurrent())throw Error('The selected editor lifetime changed; current human work was retained');
      const target=current(),{scene}=target,revision=options.store.revision;
      if(await options.nativeSelect(scene.id,null)!=='applied')throw Error('The native Field selection was superseded or refused');
      selectedTarget(target,revision,null,null,isCurrent);
      options.selectLocal(null,0);
    },
    async select(request,isCurrent=()=>true) {
      selectionBasis(request.basis,isCurrent);
      const target=current(),{scene}=target, entity=scene.entities.find(e=>e.id===request.entity_id);
      if(!entity)throw Error('This entity no longer belongs to the selected scene');
      const stepIndex=request.step_id?entity.sequence.steps.findIndex(s=>s.id===request.step_id):0;
      if(request.step_id&&stepIndex<0)throw Error('The selected stable state no longer exists');
      if(!target.binding.occurrences.some(row=>row.view_entity_id===entity.id))throw Error('The captured native occurrence is not present');
      const revision=options.store.revision;
      if(await options.nativeSelect(scene.id,entity.id)!=='applied')throw Error('The native selection was superseded or refused');
      const selected=selectedTarget(target,revision,entity.id,request.step_id??null,isCurrent);
      options.selectLocal(entity.id,selected.index);
      if(request.step_id&&!selected.entity!.sequence.enabled&&!selected.entity!.sequence.manual) {
        options.change(()=>syncHeldState(selected.entity!,selected.index));await commit();
      }
    },
    async open(request,isCurrent=()=>true) {
      selectionBasis(request.basis,isCurrent);
      if(!['source','layers','placement'].includes(request.editor))throw Error('Unsupported native editor surface');
      const target=current(),{scene}=target, entity=scene.entities.find(e=>e.id===request.entity_id), stepIndex=entity?.sequence.steps.findIndex(s=>s.id===request.step_id)??-1;
      if(!entity||stepIndex<0)throw Error('The editor target is no longer present');
      if(request.editor==='placement')checkPosition(entity.id);
      if(!target.binding.occurrences.some(row=>row.view_entity_id===entity.id))throw Error('The captured native occurrence is not present');
      const revision=options.store.revision;
      if(await options.nativeSelect(scene.id,entity.id)!=='applied')throw Error('The native editor selection was superseded or refused');
      const selected=selectedTarget(target,revision,entity.id,request.step_id,isCurrent);
      options.selectLocal(entity.id,selected.index);options.openEditor(request.editor,entity.id,selected.index);
    },
    async history(operation) {if(operation==='undo'?options.store.undo():options.store.redo()){options.afterHistory();await commit()}},
    save:commit,
  };
}
/** Receiving seam for the retained app. All effects stay with its existing owners. */
export function installNativeEditorReceiver(owner: NativeEditorReceiver, target: Window = window) {
  type Binding = {token: string; bindingId: string; epoch: number};
  let binding: Binding | null = null, busy = false, alive = true, generation = 0;
  const seen = new Set<string>();
  const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
  const sameBinding = (a: Binding, b: Binding) => a.token === b.token && a.bindingId === b.bindingId && a.epoch === b.epoch;
  const post = (address: Binding, data: object) => {
    if (!alive) return;
    try {target.parent.postMessage({schema:EDITOR_CHANNEL,...address,...data},target.location.origin)} catch {/* Failed delivery leaves the caller's outcome unresolved. */}
  };
  const publish = () => {
    if (alive && binding) {try {post(binding,{kind:'reading',reading:owner.read()})} catch {/* No native reading is invented. */}}
  };
  const receive = async (event: MessageEvent) => {
    const data = event.data;
    if (!alive || event.source !== target.parent || event.origin !== target.location.origin || !data
      || data.schema !== EDITOR_CHANNEL || data.kind !== 'request') return;
    if (!bounded(data.token,128) || !bounded(data.req,128) || !bounded(data.bindingId,1024)
      || !Number.isSafeInteger(data.epoch) || data.epoch < 0) return;
    const address: Binding = {token:data.token,bindingId:data.bindingId,epoch:data.epoch};
    const request = data.request as NativeEditorRequest;
    let requestGeneration = generation, reply: NativeEditorReply, material: import('../../../../../packages/expressions-boundary/src/materialEditor').NativeMaterialEditorResult | undefined;
    try {
      if (!request || !['read','apply','select','select-field','scene','scene-edit','scene-material','blueprint','open','undo','redo','save','material'].includes(request.operation)) throw Error('Unsupported native editor operation');
      if (!binding || !sameBinding(binding,address)) {
        if (request.operation !== 'read') throw Error('Read the current native editor before applying an operation');
        if (binding && binding.bindingId === address.bindingId && address.epoch < binding.epoch) throw Error('The editor binding belongs to a retired epoch');
        if (busy && (!binding || binding.bindingId !== address.bindingId || address.epoch <= binding.epoch)) throw Error('A native editor operation is awaiting acknowledgement');
        // A newer host epoch retires old replies, never cancels or fabricates the
        // existing owner's effect. While it runs, further mutations remain busy.
        binding = address;generation++;seen.clear();
      }
      requestGeneration = generation;
      const key = `${data.token}:${data.req}`;
      if (seen.has(key)) throw Error('This editor request was already handled; read its outcome before retrying');
      if (seen.size >= 65536) throw Error('Reopen the editor after its bounded request history');
      seen.add(key);
      if (request.operation !== 'read') {
        if (busy) throw Error('A native editor operation is awaiting acknowledgement');
        if (owner.transactionOpen()) throw Error('Finish the current human gesture before applying another edit');
        if (!sameEditorBasis(request.basis,owner.read().basis)) throw Error('The captured scene or authoring revision changed; your draft is retained');
        busy = true;
        try {
          if (request.operation === 'apply') {
            if (!Array.isArray(request.changes) || !request.changes.length || request.changes.length > 64) throw Error('Supply one bounded native edit transaction');
            await owner.apply(request);
          } else if (request.operation === 'select') await owner.select(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          else if (request.operation === 'select-field') await owner.selectField(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          else if (request.operation === 'scene') await owner.scene(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          else if (request.operation === 'scene-edit') await owner.editScenes(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          else if (request.operation === 'scene-material') {
            if (!owner.sceneMaterial) throw Error('This retained editor has no Scene material receiver');
            await owner.sceneMaterial(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          }
          else if (request.operation === 'blueprint') {
            if (!owner.blueprint) throw Error('This retained editor has no Blueprint receiver');
            await owner.blueprint(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          }
          else if (request.operation === 'open') await owner.open(request,()=>alive&&requestGeneration===generation&&!!binding&&sameBinding(binding,address));
          else if (request.operation === 'save') await owner.save();
          else if (request.operation === 'material') {
            if (!owner.material) throw Error('This retained editor has no native material receiver');
            material=await owner.material(request);
          }
          else await owner.history(request.operation);
        } finally {busy = false}
      }
      if (!alive || requestGeneration !== generation) return;
      reply = {ok:true,reading:owner.read(),...(material?{material}:{})};
    } catch (cause) {
      if (!alive || requestGeneration !== generation) return;
      reply = {ok:false,error:cause instanceof Error ? cause.message : String(cause)};
      if (cause instanceof NativeMaterialRefusal) {
        if (cause.outcome !== undefined) reply.native_outcome = cause.outcome;
        if (cause.retained_copy_ref) reply.retained_copy_ref = cause.retained_copy_ref;
      }
      if(cause instanceof NativeSceneEditRefusal)reply.native_outcome=cause.native_outcome;
      try {reply.reading=owner.read()} catch {/* Absent native work is explicit. */}
    }
    // A correlated refusal echoes the attempted address, not a different binding.
    if (alive && requestGeneration === generation) post(address,{kind:'result',req:data.req,reply});
  };
  const listener = (event: MessageEvent) => {void receive(event)};
  target.addEventListener('message',listener);
  return {publish,dispose:()=>{
    if (!alive) return;
    alive=false;generation++;target.removeEventListener('message',listener);binding=null;seen.clear();
  }};
}
