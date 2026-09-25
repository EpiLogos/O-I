/** Return actual authoring work to the SAME native Expression. This is an
 * operation builder, not storage. Its captured document revision is the CAS
 * basis; callers must not replace it with a freshly inspected revision.
 */
import {clone, validateJourney, type Journey, type Scene} from './model.js';
import {kernelDocumentToJourney,nativeSceneMaterial, type KernelConversion, type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {mapSceneOccurrences, mergeScenePage, validateSceneData, sameSceneData} from './sceneCorrespondence.js';

export type CompositionChange =
  | {change:'rename';title:string}
  | {change:'composition_set';presentation:CompositionProperties}
  | {change:'scene_create';scene_ref:string;title:string}
  | {change:'scene_rename';scene_ref:string;title:string}
  | {change:'scene_remove';scene_ref:string}
  | {change:'scene_reorder';scene_refs:string[]}
  | {change:'scene_compose';scene_ref:string;entity_refs:string[]}
  | {change:'entity_add';scene_ref:string;entity_ref:string;title:string}
  | {change:'scene_material_set';scene_ref:string;presentation:{schema:'oi.journey-scene/v1';scene:Scene;saved?:Scene|null}}
  | {change:'focus';scene_ref:string;entity_ref:string|null};
export interface CompositionProperties {
  schema:'oi.journey-properties/v1';description:string;loop:boolean;shared?:Journey['shared'];
}
export interface CompositionEdit {
  operation:'edit';expression_ref:string;expected_revision:number;actor:string;
  changes:CompositionChange[];
}
const same = sameSceneData;

export function compositionProperties(journey:Journey):CompositionProperties {
  return {schema:'oi.journey-properties/v1',description:journey.description,loop:journey.loop,
    ...(journey.shared ? {shared:clone(journey.shared)} : {})};
}

function localRef(expression:string,kind:'scene'|'entity',id:string):string {
  // New view objects already have stable IDs from the existing DocumentStore.
  // Qualifying that ID once gives a native identity independent of source hash,
  // revision, lens or current rendering page. Native re-open returns its mapping.
  if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(id)) throw new Error('New authoring object has no safe stable identity');
  let suffix=id.replace(/_/g,'__').replace(/:/g,'_3a_');
  if(suffix.length>128){let a=2166136261,b=0x9e3779b9;for(const ch of id){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b^ch.charCodeAt(0),2246822519);}suffix=`view-${(a>>>0).toString(16)}-${(b>>>0).toString(16)}`;}
  return `${expression}:${kind}:${suffix}`;
}

/** Creates atomic, inspectable native operations for edited material. Native
 * subjects, typed relations, memberships and source revisions are not inferred
 * from a shape, proximity, text, a Scene deletion or a hidden formation.
 */
export function prepareCompositionEdit(
  view:KernelConversion,
  raw:Journey,
  options:{sceneId?:string;entityId?:string|null;actor?:string}={},
):CompositionEdit {
  const edited=validateJourney(raw);
  if (edited.id!==view.journey.id) throw new Error('This work no longer addresses the captured native Expression');
  const doc=view.document;
  const changes:CompositionChange[]=[];
  const entityRefs=new Map<string,string>(Object.entries(view.entity_ids).map(([ref,id])=>[id,ref]));
  for (const binding of Object.values(view.bindings)) for (const occurrence of binding.occurrences) {
    const previous=entityRefs.get(occurrence.view_entity_id);
    if (previous && previous!==occurrence.entity_ref) throw new Error('Ambiguous native occurrence; no edit submitted');
    entityRefs.set(occurrence.view_entity_id,occurrence.entity_ref);
  }
  for(const scene of [...edited.scenes,...Object.values(edited.savedScenes??{})])for(const entity of scene.entities){if(!entityRefs.has(entity.id))entityRefs.set(entity.id,localRef(doc.expression_ref,'entity',entity.id));}
  const sceneRefs=new Map(edited.scenes.map(scene=>[scene.id,
    view.bindings[scene.id]?.scene_ref ?? localRef(doc.expression_ref,'scene',scene.id)]));
  const oldScenes=new Map(doc.scenes.map(scene=>[scene.scene_ref,scene]));
  const createdEntities=new Set<string>();
  if (edited.name!==view.journey.name) changes.push({change:'rename',title:edited.name});
  const properties=compositionProperties(edited);
  if (!same(properties,compositionProperties(view.journey))) {
    if(properties.shared)properties.shared.toolbelt=properties.shared.toolbelt.map(entry=>entry.entityId?{...entry,entityId:entityRefs.get(entry.entityId)??entry.entityId}:entry);
    changes.push({change:'composition_set',presentation:properties});
  }

  for (const scene of edited.scenes) {
    const sceneRef=sceneRefs.get(scene.id)!;
    const before=oldScenes.get(sceneRef);
    const binding=view.bindings[scene.id];
    const baseline=view.journey.scenes.find(value=>value.id===scene.id);
    if (!before) changes.push({change:'scene_create',scene_ref:sceneRef,title:scene.name});
    else if (baseline && scene.name!==baseline.name) changes.push({change:'scene_rename',scene_ref:sceneRef,title:scene.name});
    const saved=edited.savedScenes?.[scene.id];
    const participating=[...scene.entities,...(saved?.entities??[])];
    for (const entity of participating) {
      if (!entityRefs.has(entity.id)) entityRefs.set(entity.id,localRef(doc.expression_ref,'entity',entity.id));
      const ref=entityRefs.get(entity.id)!;
      if (!view.entity_ids[ref] && doc.entities[ref]) throw new Error('A new view object collides with an existing native identity');
      if (!doc.entities[ref] && !createdEntities.has(ref)) {
        createdEntities.add(ref);
        changes.push({change:'entity_add',scene_ref:sceneRef,entity_ref:ref,title:entity.name});
      }
    }
    const members=[...(before?.entity_refs??[])];
    for (const entity of participating) {
      const ref=entityRefs.get(entity.id)!;
      if (!members.includes(ref)) members.push(ref);
    }
    // Existing memberships are not a renderer diff. Explicit constellation
    // membership/retraction operations address those through the Wiki owner.
    if (!before || !same(members,before.entity_refs)) changes.push({change:'scene_compose',scene_ref:sceneRef,entity_refs:members});
    if (baseline && same(scene,baseline) && same(saved??null,view.journey.savedScenes?.[scene.id]??null)) continue;
    const addressed=mapSceneOccurrences(scene,sceneRef,entityRefs);
    const material=before && binding
      ? mergeScenePage(nativeSceneMaterial(doc,before),addressed,new Set(binding.loaded_refs))
      : addressed;
    validateSceneData(material);
    let savedMaterial:Scene|null=null;
    if(saved){
      const addressedSaved=mapSceneOccurrences(saved,sceneRef,entityRefs);
      const beforeSaved=before?(before.presentation?before.presentation.saved:nativeSceneMaterial(doc,before)):undefined;
      savedMaterial=beforeSaved&&binding?mergeScenePage(beforeSaved,addressedSaved,new Set(binding.loaded_refs)):addressedSaved;
      validateSceneData(savedMaterial);
    }
    changes.push({change:'scene_material_set',scene_ref:sceneRef,presentation:{schema:'oi.journey-scene/v1',scene:material,saved:savedMaterial}});
  }
  const newRefs=[...sceneRefs.values()];
  for (const original of doc.scenes) if (!newRefs.includes(original.scene_ref)) {
    changes.push({change:'scene_remove',scene_ref:original.scene_ref});
  }
  const afterCreateRemove=[...doc.scenes.map(scene=>scene.scene_ref).filter(ref=>newRefs.includes(ref)),...newRefs.filter(ref=>!oldScenes.has(ref))];
  if (!same(afterCreateRemove,newRefs)) changes.push({change:'scene_reorder',scene_refs:newRefs});
  if (options.sceneId!==undefined) {
    const sceneRef=sceneRefs.get(options.sceneId);
    const entityRef=options.entityId ? entityRefs.get(options.entityId) : null;
    const scene=edited.scenes.find(value=>value.id===options.sceneId);
    if (!sceneRef || !scene || options.entityId && (!entityRef || !scene.entities.some(entity=>entity.id===options.entityId))) {
      throw new Error('Select an exact occurrence within this Scene before returning focus');
    }
    if (doc.selection?.scene_ref!==sceneRef || doc.selection?.entity_ref!==(entityRef??null) || doc.selection?.relation_ref) {
      changes.push({change:'focus',scene_ref:sceneRef,entity_ref:entityRef??null});
    }
  }
  // The document's semantic bound matches the kernel (DOCUMENT_MEMBERS=2048);
  // one edit still carries at most 256 changes (the owner's operation guard).
  if (Object.keys(doc.entities).length+createdEntities.size>2048) {
    throw new Error('This native edit would exceed the document’s 2048-object bound; no work was truncated or submitted');
  }
  if (changes.length>256) {
    throw new Error('This native edit exceeds the 256-operation budget; no work was truncated or submitted');
  }
  return {operation:'edit',expression_ref:doc.expression_ref,expected_revision:doc.revision,
    actor:options.actor??'human:expressions-app',changes};
}

/** Retain the selected reference while a reply is in flight. A receipt for a
 * different work/basis can never replace the user's current working model. */
export function acceptCompositionReply(
  request:Pick<CompositionEdit,'expression_ref'|'expected_revision'>,
  response:unknown,
):KernelExpressionDocument {
  const value=response as {state?:string;document?:KernelExpressionDocument;current_revision?:number}|null;
  if (value?.state==='revision_conflict') throw new Error(`revision_conflict: native revision ${value.current_revision}; preserve and reconcile this draft`);
  if (value?.state!=='ready' || value.document?.schema!=='oi.expression/v1'
    || value.document.expression_ref!==request.expression_ref
    || !Number.isSafeInteger(value.document.revision)
    || value.document.revision<request.expected_revision
    || value.document.revision>request.expected_revision+1) {
    throw new Error('The native edit did not return this Expression on its captured revision basis');
  }
  return clone(value.document);
}

/** Adopt a native acknowledgement without reminting the existing engine IDs.
 * The caller keeps any newer local edits; this rebases the acknowledged basis
 * only, so a late reply cannot reset the field or replace a newer human draft.
 */
export function rebaseCompositionView(view:KernelConversion,submitted:Journey,document:KernelExpressionDocument):KernelConversion {
  const identity={expression:view.journey.id,scenes:{} as Record<string,string>,entities:{...view.entity_ids}};
  const knownEntities=new Map(Object.entries(view.entity_ids).map(([ref,id])=>[id,ref]));
  for(const scene of submitted.scenes){
    identity.scenes[view.bindings[scene.id]?.scene_ref??localRef(document.expression_ref,'scene',scene.id)]=scene.id;
    for(const entity of [...scene.entities,...(submitted.savedScenes?.[scene.id]?.entities??[])])identity.entities[knownEntities.get(entity.id)??localRef(document.expression_ref,'entity',entity.id)]=entity.id;
  }
  const probe=kernelDocumentToJourney(document,{identity});
  const pages:Record<string,number>={};
  for(const binding of Object.values(probe.bindings)){
    const previous=Object.values(view.bindings).find(value=>value.scene_ref===binding.scene_ref);
    if(previous)pages[binding.scene_ref]=Math.min(previous.page,binding.page_count-1);
  }
  return kernelDocumentToJourney(document,{identity,pages});
}
