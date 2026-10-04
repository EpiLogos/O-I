/** Source-owned takeover reaches the existing native Registry and pose consumer.
 * Saved addresses remain canonical; only the actual Kernel conversion maps
 * current visible occurrences into native rendering config IDs. */
import type {Scene} from './model';
import type {KernelConversion} from './kernelDocumentBridge';
import {retention} from './proceduralRetention';
import {automationTarget} from './nativeParameters';
import type {PointCloudConfig} from '../../src/engine/types';
import {validateNativeEntityControls,type NativeEntityControls,type NativeEntityControlParameter} from '../../src/engine/fieldModel';
const targets:Record<string,{parameter:NativeEntityControlParameter;component:string;property:string;suffix:string}>={
 'entity.force.strength':{parameter:'force_strength',component:'force',property:'strength',suffix:'forces.strength'},
 'entity.force.radius':{parameter:'force_radius',component:'force',property:'radius',suffix:'forces.radius'},
 'entity.force.spin':{parameter:'force_spin',component:'force',property:'spin',suffix:'forces.spin'},
 'entity.position.x':{parameter:'x',component:'entity',property:'position.x',suffix:'x'},
 'entity.position.y':{parameter:'y',component:'entity',property:'position.y',suffix:'y'},
 'entity.position.z':{parameter:'z',component:'entity',property:'position.z',suffix:'z'},
 'entity.scale':{parameter:'scale',component:'entity',property:'scale',suffix:'scale'},
 'entity.rotation':{parameter:'rotation',component:'entity',property:'rotation',suffix:'rotation'},
};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function currentProjection(scene:Readonly<Scene>,view?:KernelConversion){
 // Authored Field/other controls remain with their existing normal consumer.
 // The paired native facts distinguish a Source native Parameter takeover;
 // one missing fact is lost custody, never a legacy fallback or fresh grant.
 const active=retention(scene).controls.filter(c=>{
  if(!c.takeover)return false;
  const nativeBase=Object.prototype.hasOwnProperty.call(c,'native_base');
  const nativeValue=Object.prototype.hasOwnProperty.call(c.takeover,'native_value');
  if(nativeBase!==nativeValue)throw Error('Native control lost paired native base/value');
  return nativeBase;
 });
 const byEntity=new Map<string,NativeEntityControls>();
 if(!active.length)return {byEntity,key:''};
 if(!view)throw Error('Active native controls require actual current Kernel correspondence');
 const doc=view.document,binding=view.bindings[scene.id];
 const nativeScene=binding&&doc.scenes.find(s=>s.scene_ref===binding.scene_ref);
 if(!binding||!nativeScene||!nativeScene.presentation||!Number.isSafeInteger(doc.revision)||doc.revision<1||!same(binding.member_refs,nativeScene.entity_refs))throw Error('Native controls have a stale or absent native Scene binding');
 // Material paging does not classify omitted material members as hidden.
 // Every actually visible member still requires its exact loaded occurrence.
 for(const visible of scene.entities){
  const occurrences=binding.occurrences.filter(o=>o.expression_ref===doc.expression_ref&&o.scene_ref===binding.scene_ref&&o.view_entity_id===visible.id);
  if(occurrences.length!==1||!binding.loaded_refs.includes(occurrences[0].entity_ref)||binding.hidden_refs.includes(occurrences[0].entity_ref)||view.entity_ids[occurrences[0].entity_ref]!==visible.id)throw Error('Visible native member lacks its exact loaded occurrence');
 }
 const nativeControls=retention(nativeScene.presentation.scene).controls;
 for(const c of active){
  const a=c.address,takeover=c.takeover as NonNullable<typeof c.takeover>&{native_value?:unknown;revision?:unknown};
  if(a.expression_ref!==doc.expression_ref||a.scene_ref!==binding.scene_ref||!a.entity_ref||!nativeScene.entity_refs.includes(a.entity_ref)||a.constituent_ref!==null||a.parent_ref!==undefined||!nativeControls.some(current=>same(current,c)))throw Error('Native control address or retained source differs from actual Document');
  const key=Object.values(targets).find(t=>t.component===a.component&&t.property===a.property);
  if(!key||c.target!=='entity:'+encodeURIComponent(a.entity_ref)+':'+key.suffix)throw Error('Native control does not name the actual native Registry target');
  const actual=doc.entities[a.entity_ref]?.parameters[key.parameter];
  if(typeof takeover.native_value!=='number'||typeof takeover.revision!=='number'||takeover.revision>doc.revision||!actual||actual.value!==takeover.native_value||actual.automation!=null)throw Error('Native control lacks current manual native Parameter value, disposition or revision');
  const scalar={parameter:key.parameter,value:takeover.native_value,actor_ref:takeover.actor,operation_ref:takeover.operation_ref,document_revision:takeover.revision,lifetime:takeover.lifetime};
  validateNativeEntityControls({schema:'ql.native-entity-controls/v1',entity_ref:a.entity_ref,controls:[scalar]},a.entity_ref);
  const occurrence=binding.occurrences.filter(o=>o.expression_ref===doc.expression_ref&&o.scene_ref===binding.scene_ref&&o.entity_ref===a.entity_ref);
  const loaded=binding.loaded_refs.includes(a.entity_ref),hidden=binding.hidden_refs.includes(a.entity_ref);
  if((loaded&&hidden)||(!loaded&&occurrence.length)||occurrence.length>1)throw Error('Native control disclosure disagrees with actual occurrence binding');
  // Whole retained control/source rows survive disclosure paging. An unloaded
  // member has no current renderer consumer and is not projected into one.
  if(!loaded)continue;
  if(occurrence.length!==1||view.entity_ids[a.entity_ref]!==occurrence[0].view_entity_id)throw Error('Native control has no exact loaded native occurrence');
  const viewId=occurrence[0].view_entity_id;
  const target=automationTarget(scene as Scene,'entity:'+encodeURIComponent(viewId)+':'+key.suffix);
  if(!target||target.entityId!==viewId||targets[target.bind]?.parameter!==key.parameter)throw Error('Native control has no actual visible Registry consumer');
  let projection=byEntity.get(viewId);
  if(!projection){projection={schema:'ql.native-entity-controls/v1',entity_ref:viewId,controls:[]};byEntity.set(viewId,projection);}
  projection.controls.push({parameter:key.parameter,value:takeover.native_value,actor_ref:takeover.actor,operation_ref:takeover.operation_ref,document_revision:takeover.revision,lifetime:takeover.lifetime});
 }
 for(const [id,value] of byEntity)validateNativeEntityControls(value,id);
 return {byEntity,key:JSON.stringify({expression_ref:doc.expression_ref,revision:doc.revision,scene_ref:binding.scene_ref,page:binding.page,loaded_refs:binding.loaded_refs,hidden_refs:binding.hidden_refs,occurrences:binding.occurrences,controls:active})};
}
/** Validate before reusing any cached configuration, including a unchanged
 * authoring revision. This key is current owner data, not a grant of live ACK. */
export function nativeControlCorrespondenceKey(scene:Readonly<Scene>,view?:KernelConversion):string{return currentProjection(scene,view).key;}
export function projectNativeEntityControls(scene:Readonly<Scene>,config:PointCloudConfig,view?:KernelConversion):PointCloudConfig {
 const {byEntity}=currentProjection(scene,view);
 for(const id of byEntity.keys())if(!config.entities?.some(e=>e.id===id))throw Error('Native control entity is absent from actual config');
 return {...config,entities:config.entities?.map(entity=>{
  const {nativeControls:_old,...current}=entity;
  return {...current,...(byEntity.has(entity.id)?{nativeControls:byEntity.get(entity.id)}:{})};
 })};
}
