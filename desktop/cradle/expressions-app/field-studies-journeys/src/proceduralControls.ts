/** Procedural controls use the app's actual parameter registry, automation
 * links and property tracks. The returned Scene goes through the existing
 * native composition CAS; this module owns no clock or persistence. */
import {clone,type Scene,type AutomationLane} from './model';
import {automationTarget,automationTargets,bindValue,type AutomationTarget} from './nativeParameters';
import {automationGroups,removeGroupTarget,validateAutomationLinks} from './automationLinks';
import {validateTracks,type PropertyTrack} from './propertyTracks';
import {addressKey,addressCovers,retention,withRetention,validateAddress,type StageAddress,type ControlRetention,type ProceduralScene} from './proceduralRetention';

export interface ControlContext {expression_ref:string;scene_ref:string;occurrences:Record<string,string>}
export interface PropertyCapability {
 address:StageAddress;target:string;type:'scalar';units:string;owner:'expressions';
 min:number;max:number;native_factor:number;base:number;
 rate_class:'frame';operations:readonly ['set_base','takeover','release','record'];
}

export function propertyAddress(context:ControlContext,target:AutomationTarget):StageAddress {
 const entity=target.entityId?context.occurrences[target.entityId]:null;
 if(target.entityId&&!entity)throw Error('Property has no current native occurrence');
 const a:StageAddress={expression_ref:context.expression_ref,scene_ref:context.scene_ref,entity_ref:entity??null,component:'property',constituent_ref:null,property:null};
 if(target.entityId){
  const local=target.bind.startsWith('entity.')?target.bind.slice(7):target.key;
  if(local.startsWith('force.')){a.component='force';a.property=local.slice(6);}
  else if(local.startsWith('sequence.')){a.component='sequence';a.property=local.slice(9);}
  else{a.component='entity';a.property=local;}
 }else if(target.bind.startsWith('field.')){a.component='field';a.property=target.bind.slice(6);}
 else if(target.bind){a.property=target.bind;}
 else throw Error('Imported property needs an explicit native address and owning operation');
 return validateAddress(a);
}

export function controlCapabilities(scene:Readonly<Scene>,context:ControlContext):PropertyCapability[] {
 return automationTargets(scene as Scene).filter(t=>!!t.bind).map(t=>({address:propertyAddress(context,t),target:t.target,type:'scalar',units:t.unit??'dimensionless',owner:'expressions',min:t.hardMin,max:t.hardMax,native_factor:t.factor,base:t.value,rate_class:'frame',operations:['set_base','takeover','release','record']}));
}

function current(scene:Scene,target:string,value?:number):AutomationTarget {
 const t=automationTarget(scene,target);
 if(!t||!t.bind)throw Error('The owning parameter operation is unavailable');
 if(value!==undefined&&(!Number.isFinite(value)||value<t.hardMin||value>t.hardMax))throw Error(`Value is outside ${t.label}'s admitted ${t.unit??'dimensionless'} domain`);
 return t;
}
function write(scene:Scene,t:AutomationTarget,value:number){
 const root=t.entityId?scene.entities.find(e=>e.id===t.entityId):scene;
 if(!root)throw Error('Target occurrence disappeared');
 bindValue(root as Scene,t.entityId?t.bind.slice(7):t.bind,value);
}
function sameTrack(t:PropertyTrack,target:AutomationTarget){return t.bind===target.bind&&t.entityId===target.entityId;}

/** Editing a base is an explicit alternative to takeover: existing drivers
 * stay active and the actual normal combination rules still apply. */
export function setAuthoredBase(scene:Readonly<Scene>,target:string,value:number):Scene {
 const out:Scene=clone(scene);const t=current(out,target,value);write(out,t,value);return out;
}

type RetainedControl=ControlRetention&{suspended_lanes?:AutomationLane[]};
export function takeOver(scene:Readonly<Scene>,input:{context:ControlContext;target:string;value:number;actor:string;operation_ref:string;lifetime:'gesture'|'persistent'}):ProceduralScene {
 if(!input.actor||!input.operation_ref)throw Error('Manual intervention needs an attributable operation');
 const out:Scene=clone(scene);const t=current(out,input.target,input.value),a=propertyAddress(input.context,t),r=retention(out);
 let c=r.controls.find(c=>addressKey(c.address)===addressKey(a)) as RetainedControl|undefined;
 if(c&&!c.takeover)throw Error('Resolve the retained driver before replacing it');
 if(!c){
  const groups=automationGroups(out.automation).filter(g=>g.targets.some(l=>l.target===t.target));
  const dormant=groups.flatMap(g=>g.targets.map(clone));
  for(const lane of out.automation.filter(l=>l.target===t.target))out.automation=removeGroupTarget(out.automation,lane.id);
  const suspended=out.automation.filter(l=>dormant.some(d=>d.id===l.id)).map(clone);
  const tracks=(out.propertyTracks??[]).filter(track=>sameTrack(track,t));
  out.propertyTracks=(out.propertyTracks??[]).filter(track=>!sameTrack(track,t));
  c={address:a,target:t.target,authored_base:t.value,dormant_lanes:dormant,dormant_tracks:clone(tracks),suspended_lanes:suspended,takeover:null,source_basis:clone(r.source_basis),dormant_overrides:r.contributions.filter(v=>v.owned_addresses.some(owned=>addressCovers(owned,a))).map(v=>({contribution_ref:v.contribution_ref,overrides:clone(v.authored_overrides.filter(o=>addressKey(o.address)===addressKey(a))),takeover_overrides:[]}))};
  r.controls.push(c);
 }
 c.takeover={value:input.value,lifetime:input.lifetime,actor:input.actor,operation_ref:input.operation_ref};
 write(out,t,input.value);
 // A human intervention is reapplied to each owning contribution under the
 // same stable native target when its procedure regenerates.
 for(const contribution of r.contributions){
  if(!contribution.owned_addresses.some(owned=>addressCovers(owned,a)))continue;
  contribution.authored_overrides=contribution.authored_overrides.filter(o=>addressKey(o.address)!==addressKey(a));
  if(input.lifetime==='persistent')contribution.authored_overrides.push({address:clone(a),value:input.value,actor:input.actor});
  const prior=c.dormant_overrides?.find(v=>v.contribution_ref===contribution.contribution_ref);
  if(!prior)throw Error('Generated ownership changed during takeover; reconcile its retained intervention');
  prior.takeover_overrides=clone(contribution.authored_overrides.filter(o=>addressKey(o.address)===addressKey(a)));
 }
 validateAutomationLinks(out.automation);return withRetention(out,r);
}

/** Release rejoins the original clock identity at its current owner position.
 * Concurrent changes to that group are a conflict, never silently overwritten. */
export function releaseControl(scene:Readonly<Scene>,address:StageAddress):ProceduralScene {
 const out:Scene=clone(scene);const r=retention(out),index=r.controls.findIndex(c=>addressKey(c.address)===addressKey(address));
 if(index<0||!r.controls[index].takeover)throw Error('This target has no manual takeover');
 const c=r.controls[index] as RetainedControl,t=current(out,c.target);
 for(const expected of c.suspended_lanes??[]){
  const now=out.automation.find(l=>l.id===expected.id);
  if(JSON.stringify(now)!==JSON.stringify(expected))throw Error('The retained automation group changed during takeover; reconcile its driver before release');
 }
 if(out.automation.some(l=>l.target===c.target)||out.propertyTracks?.some(track=>sameTrack(track,t)))throw Error('A new driver owns this target; reconcile before release');
 const retainedIds=new Set(c.dormant_lanes.map(l=>l.id));
 out.automation=out.automation.filter(l=>!retainedIds.has(l.id)).concat(clone(c.dormant_lanes));
 out.propertyTracks=(out.propertyTracks??[]).concat(clone(c.dormant_tracks));
 if(typeof c.authored_base!=='number')throw Error('The retained scalar base is unavailable');
 write(out,current(out,c.target,c.authored_base),c.authored_base);
 validateAutomationLinks(out.automation);validateTracks(out.propertyTracks);
 for(const contribution of r.contributions){
  const prior=c.dormant_overrides?.find(v=>v.contribution_ref===contribution.contribution_ref);
  if(!contribution.owned_addresses.some(owned=>addressCovers(owned,address))&&!prior)continue;
  if(!prior||JSON.stringify(contribution.authored_overrides.filter(o=>addressKey(o.address)===addressKey(address)))!==JSON.stringify(prior.takeover_overrides))throw Error('The retained intervention changed during takeover; reconcile before release');
  contribution.authored_overrides=contribution.authored_overrides.filter(o=>addressKey(o.address)!==addressKey(address)).concat(clone(prior.overrides));
 }
 r.controls.splice(index,1);return withRetention(out,r);
}

export function recordControl(scene:Readonly<Scene>,input:{target:string;time:number;value:number;track_ref:string}):Scene {
 if(!Number.isFinite(input.time)||input.time<0||!input.track_ref)throw Error('Recording needs the admitted owner position and track identity');
 const out:Scene=clone(scene);const t=current(out,input.target,input.value);
 const tracks=out.propertyTracks??[],track=tracks.find(track=>sameTrack(track,t));
 if(track){track.points=track.points.filter(p=>p.time!==input.time).concat({time:input.time,value:input.value}).sort((a,b)=>a.time-b.time);}
 else tracks.push({id:input.track_ref,bind:t.bind,...(t.entityId?{entityId:t.entityId}:{}),points:[{time:input.time,value:input.value}]});
 out.propertyTracks=validateTracks(tracks);return out;
}
