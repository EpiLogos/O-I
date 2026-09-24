/** Exact native presentation edit with deterministic expected readback. */
import {clone} from './model.js';
import {sameSceneData} from './sceneCorrespondence.js';
import {kernelDocumentToJourney,nativeSceneMaterial,type KernelConversion,type KernelExpressionDocument} from './kernelDocumentBridge.js';
import {validateBlueprint,blueprintPosition,type SceneBlueprint,type BlueprintTransform} from './blueprintGeometry.js';
export type BlueprintIntent={expression_ref:string;revision:number;scene_ref:string}&(
 {operation:'bind';binding:SceneBlueprint}|{operation:'transform';transform:BlueprintTransform}|{operation:'release'});
export interface BlueprintEdit {operation:'edit';expression_ref:string;expected_revision:number;actor:string;changes:Record<string,unknown>[]}
export function prepareBlueprintEdit(view:KernelConversion,intent:BlueprintIntent):{request:BlueprintEdit;expected:KernelExpressionDocument}{
 const before=view.document;
 if(before.expression_ref!==intent.expression_ref||before.revision!==intent.revision)throw Error('The native blueprint basis changed; inspect it before trying again');
 const expected=clone(before),scene=expected.scenes.find(s=>s.scene_ref===intent.scene_ref);
 if(!scene)throw Error('Blueprint Scene is absent');
 const changes:Record<string,unknown>[]=[];
 const existing=scene.presentation?.scene.composition.blueprint;
 let binding:SceneBlueprint|undefined;
 if(intent.operation==='bind'){
  if(existing)throw Error('Release the current blueprint before rebinding');
  if(!scene.presentation){scene.presentation={schema:'oi.journey-scene/v1',scene:nativeSceneMaterial(expected,scene)};changes.push({change:'scene_material_set',scene_ref:scene.scene_ref,presentation:clone(scene.presentation)});}
  binding=clone(intent.binding);changes.push({change:'scene_blueprint_bind',scene_ref:scene.scene_ref,binding});
 }else{
  if(!existing)throw Error('This Scene has no blueprint');
  if(intent.operation==='release'){changes.push({change:'scene_blueprint_release',scene_ref:scene.scene_ref});delete scene.presentation!.scene.composition.blueprint;}
  else{binding={...clone(existing),transform:clone(intent.transform)};changes.push({change:'scene_blueprint_transform',scene_ref:scene.scene_ref,transform:intent.transform});}
 }
 if(binding){
  validateBlueprint(binding);
  for(const member of binding.members){
   const entity=expected.entities[member.entity_ref];
   if(!scene.entity_refs.includes(member.entity_ref)||entity?.subject?.subject_ref!==member.subject_ref||!Array.isArray(entity.subject.readings)||!entity.subject.readings.some((r:unknown)=>sameSceneData(r,binding!.frame)))throw Error('Blueprint member no longer has its exact native source/frame basis');
   const point=blueprintPosition(binding,member.position);
   for(const [i,axis] of ['x','y','z'].entries()){
    if(!Number.isFinite(point[i])||Math.abs(point[i])>1600||entity.parameters[axis]?.automation)throw Error('Blueprint position is automated or outside native bounds');
    entity.parameters[axis]={value:point[i],automation:null};
    for(const other of expected.scenes){const body=other.presentation?.scene.entities.find(e=>e.id===member.entity_ref);if(body)body.position[axis as 'x'|'y'|'z']=point[i]/400;}
   }
  }
  scene.presentation!.scene.composition.blueprint=clone(binding);
 }
 if(!sameSceneData(before,expected)){
  expected.revision++;
  for(const [ref,entity]of Object.entries(expected.entities))if(!sameSceneData(before.entities[ref],entity))entity.revision=expected.revision;
  for(const scene of expected.scenes)if(!sameSceneData(before.scenes.find(s=>s.scene_ref===scene.scene_ref),scene))scene.revision=expected.revision;
 }
 return {request:{operation:'edit',expression_ref:before.expression_ref,expected_revision:before.revision,actor:'human:expressions-app',changes},expected};
}
export function blueprintReply(view:KernelConversion,intent:BlueprintIntent,document:KernelExpressionDocument):KernelConversion{
 const {expected}=prepareBlueprintEdit(view,intent),comparison=clone(document);
 const calculated=new Set(intent.operation==='release'?[]:expected.scenes.find(s=>s.scene_ref===intent.scene_ref)?.presentation?.scene.composition.blueprint?.members.map(m=>m.entity_ref)??[]);
 // Only the calculated XYZ may differ at floating-point rounding precision;
 // identity, source bindings, revisions and every other field stay exact.
 for(const [ref,entity]of Object.entries(expected.entities))if(calculated.has(ref))for(const axis of ['x','y','z']){
  const want=entity.parameters[axis]?.value,actual=comparison.entities[ref]?.parameters[axis]?.value;
  if(typeof want==='number'&&typeof actual==='number'&&Number.isFinite(actual)&&Math.abs(want-actual)<=1e-9)comparison.entities[ref].parameters[axis].value=want;
 }
 for(const scene of expected.scenes)for(const body of scene.presentation?.scene.entities??[]){
  if(!calculated.has(body.id))continue;
  const actual=comparison.scenes.find(s=>s.scene_ref===scene.scene_ref)?.presentation?.scene.entities.find(e=>e.id===body.id);
  if(actual)for(const axis of ['x','y','z']as const)if(Number.isFinite(actual.position[axis])&&Math.abs(actual.position[axis]-body.position[axis])<=1e-11)actual.position[axis]=body.position[axis];
 }
 if(!sameSceneData(expected,comparison))throw Error('revision_conflict: native blueprint result differs from the captured exact presentation edit');
 return kernelDocumentToJourney(document,{identity:{expression:view.journey.id,scenes:Object.fromEntries(Object.entries(view.bindings).map(([id,b])=>[b.scene_ref,id])),entities:view.entity_ids},pages:Object.fromEntries(Object.values(view.bindings).map(b=>[b.scene_ref,b.page]))});
}
