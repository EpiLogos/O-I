/** Inspection and normal editor navigation over the application's actual
 * automation links/registry/shared settings. No driver evaluator, timer or
 * modulation recipe is created here. */
import {clone} from './model';
import {automationGroups,resolvedAutomation,validateAutomationLinks} from './automationLinks';
import {automationTarget} from './nativeParameters';
import {controlCapabilities} from './proceduralControls';
import {nativeControlTarget} from './proceduralNativeControls';
import {retention,addressKey,type StageAddress} from './proceduralRetention';
import {sharedControlCapabilities,studioBasis,type StudioSnapshot} from './proceduralStudio';
import {isShared,effectiveScene} from './sharedSettings';
import {nativeSceneMaterial} from './kernelDocumentBridge';
import {mapSceneOccurrences} from './sceneCorrespondence';

export interface StageDriverTarget {lane_ref:string;native_lane_ref:string|null;loaded:boolean;address:StageAddress|null;target:string;label:string;units:string;minimum:number;maximum:number;base:number;low:number;high:number;blend:'replace'|'add'|'multiply';order:number;enabled:boolean;shared:boolean;shared_command:number|null;takeover_lifetime:'gesture'|'persistent'|null;dormant_lanes:number;dormant_tracks:number;native_control:{state:'available';parameter:string}|{state:'unavailable';reason:string}}
export interface StageDriverGroup {scene_ref:string;scene_title:string;group_ref:string;native_group_ref:string|null;clock_ref:string|null;enabled:boolean;driver:'lfo'|'ramp';wave:string;easing:string|null;rate:number;phase:number;duration:number;delay:number;loop:string;targets:StageDriverTarget[]}
export interface StageDriverEditorIntent {expression_ref:string;expected_revision:number;scene_ref:string;group_ref:string|null}

/** Uses the accepted converter's exact preferred IDs and original lane order.
 * An uncommitted local edit is not labelled the accepted driver's value. */
export function stageDriverGroups(snapshot:StudioSnapshot):StageDriverGroup[]{
 studioBasis(snapshot);const rows:StageDriverGroup[]=[];
 for(const native of snapshot.view.document.scenes){
  const bindings=Object.entries(snapshot.view.bindings).filter(([,binding])=>binding.scene_ref===native.scene_ref);if(bindings.length!==1)throw Error('The native driver Scene has no unique current converter binding');
  const [sceneId,binding]=bindings[0],loadedScene=snapshot.view.journey.scenes.find(row=>row.id===sceneId);if(!loadedScene)throw Error('The accepted driver Scene view is unavailable');
  const scene=mapSceneOccurrences(nativeSceneMaterial(snapshot.view.document,native),sceneId,new Map(Object.entries(snapshot.view.entity_ids)));
  const local={...snapshot,journey:snapshot.view.journey,sceneId,selected:[]},context={expression_ref:snapshot.view.document.expression_ref,scene_ref:native.scene_ref,occurrences:Object.fromEntries(native.entity_refs.map(ref=>[snapshot.view.entity_ids[ref],ref]))},capabilities=controlCapabilities(scene,context),saved=retention(scene);
  if(loadedScene.entities.some(entity=>{const matches=binding.occurrences.filter(row=>row.view_entity_id===entity.id);return matches.length!==1||!binding.loaded_refs.includes(matches[0].entity_ref)||!native.entity_refs.includes(matches[0].entity_ref);}))throw Error('The visible driver targets have disconnected native occurrence bindings');
  validateAutomationLinks(scene.automation);
  for(const group of automationGroups(scene.automation)){
   const leader=group.leader,driver=resolvedAutomation(scene.automation,leader),targets:StageDriverTarget[]=group.targets.map(lane=>{
    const parameter=automationTarget(scene,lane.target),capability=capabilities.find(row=>row.target===lane.target),loaded=!parameter?.entityId||binding.occurrences.some(o=>o.view_entity_id===parameter.entityId);
    if(!parameter)throw Error('An automation target is no longer reported by the actual native Registry; its original group is retained');
    if(!capability)return {lane_ref:lane.id,native_lane_ref:lane.nativeId??null,loaded,address:null,target:lane.target,label:parameter.label,units:parameter.unit??'native units',minimum:parameter.hardMin,maximum:parameter.hardMax,base:parameter.value,low:lane.min,high:lane.max,blend:lane.blend,order:scene.automation.findIndex(row=>row.id===lane.id),enabled:resolvedAutomation(scene.automation,lane).enabled,shared:false,shared_command:null,takeover_lifetime:null,dormant_lanes:0,dormant_tracks:0,native_control:{state:'unavailable' as const,reason:'This original imported native target has no paired Stage address/Parameter control mapping.'}};
    const active=resolvedAutomation(scene.automation,lane),control=saved.controls.find(row=>addressKey(row.address)===addressKey(capability.address)),shared=!parameter.entityId&&isShared(snapshot.view.journey,scene,parameter.bind),command=shared?automationTarget(effectiveScene(snapshot.view.journey,scene),lane.target)?.value:null,nativeTarget=loaded?nativeControlTarget(local,capability):{state:'unavailable' as const,reason:'The exact native target is outside the current disclosure page; no renderer consumer is admitted.'};
    return {lane_ref:lane.id,native_lane_ref:lane.nativeId??null,loaded,address:clone(capability.address),target:lane.target,label:parameter.label,units:capability.units,minimum:capability.min,maximum:capability.max,base:capability.base,low:lane.min,high:lane.max,blend:lane.blend,order:scene.automation.findIndex(row=>row.id===lane.id),enabled:active.enabled,shared,shared_command:typeof command==='number'?command:null,takeover_lifetime:control?.takeover?.lifetime??null,dormant_lanes:control?.dormant_lanes.length??0,dormant_tracks:control?.dormant_tracks.length??0,native_control:nativeTarget.state==='available'?{state:'available',parameter:nativeTarget.parameter}:nativeTarget};
   });
   rows.push({scene_ref:native.scene_ref,scene_title:native.title,group_ref:leader.id,native_group_ref:leader.nativeId??null,clock_ref:leader.clockId??null,enabled:driver.enabled,driver:driver.type,wave:driver.wave,easing:driver.easing??null,rate:driver.rate,phase:driver.phase,duration:driver.duration,delay:driver.delay,loop:driver.loop,targets});
  }
 }
 return rows;
}
export function validateStageDriverEditorIntent(snapshot:StudioSnapshot,raw:StageDriverEditorIntent):StageDriverEditorIntent {
 if(!raw||Object.keys(raw).some(key=>!['expression_ref','expected_revision','scene_ref','group_ref'].includes(key))||raw.expression_ref!==snapshot.view.document.expression_ref||raw.expected_revision!==snapshot.view.document.revision||!snapshot.view.document.scenes.some(row=>row.scene_ref===raw.scene_ref))throw Error('The original driver editor target differs from its actual native Scene/CAS');
 if(raw.group_ref!==null){const group=stageDriverGroups(snapshot).find(row=>row.scene_ref===raw.scene_ref&&row.group_ref===raw.group_ref);if(!group)throw Error('The exact original automation group is unavailable; editor intent remains retained');if(group.targets.some(target=>!target.loaded))throw Error('Admit the exact native target disclosure page before opening its existing group editor; no unavailable target was redirected.');}
 return clone(raw);
}

export interface StageDriverEditor {panel:HTMLElement;refresh():void;dispose():void}
export function installStageDriverEditor(host:{snapshot():StudioSnapshot|null;open?(intent:StageDriverEditorIntent):Promise<void>;report(message:string):void}):StageDriverEditor {
 const panel=document.createElement('details');panel.open=true;panel.className='stage-drivers';panel.setAttribute('aria-label','Shared field and automation groups');const title=document.createElement('summary');title.textContent='Shared field and automation groups';const facts=document.createElement('div'),shared=document.createElement('div'),note=document.createElement('p');note.className='control-note';note.textContent='The existing automation editor authors the same lanes, target ranges and blend operations. Named Source modifier/group authoring, Field takeover and shared-driver mapping await their native owner interface.';panel.append(title,note,shared,facts);
 const cards=new Map<string,{node:HTMLDetailsElement;heading:HTMLElement;summary:HTMLElement;targets:HTMLElement;button:HTMLButtonElement;row:StageDriverGroup}>();let disposed=false;
 function paragraph(text:string){const node=document.createElement('p');node.className='control-note';node.textContent=text;return node;}
 function refresh(){if(disposed)return;try{
  const snapshot=host.snapshot();if(!snapshot){note.textContent='Open the native Expression to inspect its accepted shared values and automation groups.';return;}
  const rows=stageDriverGroups(snapshot),keys=new Set(rows.map(row=>JSON.stringify([row.scene_ref,row.group_ref])));
  for(const [key,card]of cards)if(!keys.has(key)){card.node.remove();cards.delete(key);}
  for(const row of rows){const key=JSON.stringify([row.scene_ref,row.group_ref]);let card=cards.get(key);if(!card){const node=document.createElement('details'),heading=document.createElement('summary'),summary=document.createElement('p'),targets=document.createElement('div'),button=document.createElement('button');button.type='button';button.textContent='Edit this group in the existing Studio';card={node,heading,summary,targets,button,row};cards.set(key,card);node.append(heading,summary,targets,button);facts.append(node);button.addEventListener('click',()=>{const current=host.snapshot(),selected=cards.get(key);if(!current||!selected||!host.open){host.report('The existing native automation editor navigation port is unavailable.');return;}const intent={expression_ref:current.view.document.expression_ref,expected_revision:current.view.document.revision,scene_ref:selected.row.scene_ref,group_ref:selected.row.group_ref};void host.open(validateStageDriverEditorIntent(current,intent)).catch(error=>host.report(error instanceof Error?error.message:String(error)));});}
   card.row=row;card.heading.textContent=`${row.scene_title} · ${row.driver==='lfo'?'Cycle':'Ramp'} · ${row.group_ref}`;card.summary.textContent=[`Accepted ${row.enabled?'enabled':'disabled'} group`,row.clock_ref?`clock ${row.clock_ref}`:'No named clock retained',row.native_group_ref?`native lane ${row.native_group_ref}`:'Native lane identity unavailable',row.driver==='lfo'?`${row.wave} · ${row.rate} Hz · ${row.phase} cycles`:`${row.duration} s · delay ${row.delay} s · ${row.easing??'unspecified easing'} · ${row.loop}`].join(' · ');card.targets.replaceChildren(...row.targets.map(target=>paragraph(`${target.label} · ${target.address?.entity_ref??target.address?.scene_ref??'Imported native coordinate; Stage address unavailable'} · base ${target.base} ${target.units}; ${target.blend} ${target.low}…${target.high}; declared order ${target.order}; bounds ${target.minimum}…${target.maximum}; ${target.enabled?'enabled':'disabled'}${target.shared?`; Expression shared command ${target.shared_command??'unavailable'}; local base retained`:''}${target.takeover_lifetime?`; ${target.takeover_lifetime} takeover; ${target.dormant_lanes} dormant lanes / ${target.dormant_tracks} tracks`:''}. Native effective observation remains unobserved.${target.native_control.state==='unavailable'?` ${target.native_control.reason}`:''}`)));card.button.disabled=!host.open||row.targets.some(target=>!target.loaded);card.button.title=row.targets.some(target=>!target.loaded)?'One or more exact native targets are outside the current disclosure page; retain their original group.':host.open?'':'The existing native automation editor navigation port is unavailable.';
  }
  const basis=sharedControlCapabilities({...snapshot,journey:snapshot.view.journey});shared.replaceChildren(...basis.map(row=>paragraph(`Whole Expression · ${row.address.property} · accepted ${row.base} ${row.units} · bounds ${row.min}…${row.max}. Local Scene bases are retained. Native shared driver/modifier preparation is unavailable.`)));
  if(!rows.length)facts.replaceChildren(paragraph('No automation group is retained in the accepted native Document.'));
 }catch(error){host.report(error instanceof Error?error.message:String(error));}}
 const open=document.createElement('button');open.type='button';open.textContent='Author automation in the existing Studio';open.disabled=!host.open;open.title=host.open?'':'The existing native automation editor navigation port is unavailable.';open.addEventListener('click',()=>{const snapshot=host.snapshot();if(!snapshot||!host.open)return;const basis=studioBasis(snapshot),intent={expression_ref:basis.expression_ref,expected_revision:basis.document_revision,scene_ref:basis.scene_ref,group_ref:null};void host.open(validateStageDriverEditorIntent(snapshot,intent)).catch(error=>host.report(error instanceof Error?error.message:String(error)));});panel.append(open);refresh();
 return {panel,refresh,dispose(){disposed=true;cards.clear();}};
}
