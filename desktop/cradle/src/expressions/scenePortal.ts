/** Native Scene trigger admission. The hosted frame supplies pointers only;
 * placement and source identity are re-read from the native authored Scene. */
import type {KernelTransportStatus} from '../kernel/types';
import type {PortalPlacement} from '../expression/types';
import type {SurfaceBinding} from '../surface/types';
import {inspectWikiScene} from '../techne/wikiReadingProvider';
import {resolveHostedSource,type HostedSourceTarget} from './sourceHandoff';
import {worldOp} from '../expression/world';
export interface ScenePortalTarget {target:HostedSourceTarget;portal_ref:string;placement:PortalPlacement;current:()=>Promise<void>}
const record=(v:unknown):Record<string,unknown>|undefined=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:undefined;
export async function resolveScenePortal(transport:KernelTransportStatus,value:unknown):Promise<ScenePortalTarget>{
 const detail=record(value),subject=record(detail?.subject);
 if(typeof detail?.trigger_ref!=='string'||typeof subject?.ref!=='string'||typeof subject.sceneRef!=='string'||!Number.isSafeInteger(subject.revision))throw Error('Activate a portal from its current native Scene.');
 const basis={expression_ref:subject.ref,scene_ref:subject.sceneRef,revision:subject.revision};
 const {scene}=await inspectWikiScene(transport,basis);
 const trigger=scene.triggers?.find(row=>row.trigger_ref===detail.trigger_ref);
 if(!trigger||trigger.occasion!=='activate'||trigger.target.kind!=='portal')throw Error('This Scene has no matching explicit portal activation.');
 if(trigger.target.scene_ref&&trigger.target.scene_ref!==scene.scene_ref)throw Error('Open this portal from its own Scene.');
 const source={ref:trigger.target.subject_ref,subject};
 const target=await resolveHostedSource(transport,source);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([subject.ref,subject.sceneRef,trigger.target.subject_ref])));
 const portal_ref='portal:scene-source:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {target,portal_ref,placement:trigger.target.placement,current:async()=>{await inspectWikiScene(transport,basis);await resolveHostedSource(transport,source);}};
}
export async function associateScenePortal(transport:KernelTransportStatus,portal:ScenePortalTarget,binding:SurfaceBinding){
 if(!binding.ref||binding.pending)throw Error('The portal has no actual opened native Surface.');
 await portal.current();
 if(portal.placement==='re_dock')throw Error('Re-dock must use the existing detached-window owner.');
 const result=await worldOp(transport,{operation:'portal_open',portal_ref:portal.portal_ref,target_ref:binding.ref,surface_id:binding.id,surface_kind:binding.kind,placement:portal.placement,title:binding.title,actor:'human:scene-portal'}) as {state?:string;code?:string;message?:string};
 if(result.state!=='portal_open')throw Error(result.message??result.code??'The native portal owner did not acknowledge this Surface.');
}
export interface SceneSourceOpen {target:HostedSourceTarget;portal?:ScenePortalTarget;complete?:(error?:string)=>void}
