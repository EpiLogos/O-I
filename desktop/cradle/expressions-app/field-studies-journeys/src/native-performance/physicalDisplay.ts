import type {KernelConversion} from '../kernelDocumentBridge.js';
import {counter,type NativePerformanceReading,type PerformanceScope} from './protocol.js';
export const PHYSICAL_DISPLAY_POLICY=Object.freeze({policy_ref:'policy:expressions/display/native-displacement/v1',standing:'declared-display-policy',initial:10000,minimum:1,maximum:100000});
export interface NativePhysicalRest extends PerformanceScope {source_generation:string;node_ids:string[];rest_metres:[number,number,number][]}
export interface NativePhysicalDisplayState {policy_ref:string;standing:string;magnification:number;minimum:number;maximum:number;rest_available:boolean;native_max_displacement_metres:number|null;samples_elapsed:string|null}
export interface NativePhysicalDisplayPort {snapshot():NativePhysicalDisplayState|null;setMagnification(value:number):Promise<NativePhysicalDisplayState>}
/** Read only the SAME actual C45-retained Scene basis. Rest positions cannot be
 * guessed from a displaced checkpoint, initial readback or authored renderer. */
export function currentNativePhysicalRest(view:KernelConversion|undefined,sceneId:string,reading:NativePerformanceReading):NativePhysicalRest {
 const sceneRef=view?.bindings[sceneId]?.scene_ref,scene=view?.document.scenes.find(s=>s.scene_ref===sceneRef),performance=scene?.performance as any,scope=reading.scope;
 if(!view||!scene||!performance||!Array.isArray(performance.bases)||!Array.isArray(performance.native_sources))throw Error('The actual native Scene has no retained physical rest basis.');
 const matches=performance.bases.filter((basis:any)=>basis.identity?.instance_ref===scope.instance_ref&&basis.identity?.event_ref===scope.event_ref&&basis.identity?.subject_ref===scope.subject_ref&&String(basis.identity?.m1_revision)===scope.m1_revision&&String(basis.identity?.m2_generation)===scope.m2_generation&&String(basis.identity?.m3_generation)===reading.physical.source_generation&&basis.prepared_body?.request?.preparation_ref===scope.preparation_ref&&basis.prepared_body?.request?.state_ref===scope.state_ref&&String(basis.prepared_body?.request?.body_revision)===scope.body_revision);
 if(matches.length!==1)throw Error('The current physical rest basis is absent or ambiguous.');
 const basis=matches[0],body=basis.prepared_body,assets=performance.native_sources.filter((source:any)=>source.basis_digest===basis.content_digest);
 // Multiple immutable M4 epochs may share this one musical/body basis.
 // Rest comes from the exact basis; no current acoustic epoch is inferred.
 if(assets.length<1||assets.some((asset:any)=>asset.schema!=='oi.expression-performance-source-asset/v1')||body.schema!=='ql.physical-body-preparation/v1'||body.contract!=='ql.physical-body/v1'||body.event_ref!==scope.event_ref||body.subject_ref!==scope.subject_ref||String(body.source_generation)!==reading.physical.source_generation)throw Error('The native body/rest source differs from this same admitted performance.');
 const nodes=body.request.geometry?.nodes;if(!Array.isArray(nodes)||nodes.length!==reading.physical.node_ids.length)throw Error('The actual native rest geometry is incomplete.');
 const node_ids=nodes.map((node:any)=>{if(typeof node.identity==='number'&&!Number.isSafeInteger(node.identity))throw Error('The native rest node ID lost exact integer custody.');const id=String(node.identity);counter(id);return id;});
 if(new Set(node_ids).size!==node_ids.length||node_ids.some((id:string,index:number)=>id!==reading.physical.node_ids[index]))throw Error('The native rest and callback node correspondence differs.');
 const rest_metres=nodes.map((node:any)=>{if(!Array.isArray(node.rest_metres)||node.rest_metres.length!==3||node.rest_metres.some((n:unknown)=>typeof n!=='number'||!Number.isFinite(n)))throw Error('The actual native rest position is not finite Vec3.');return node.rest_metres.slice() as [number,number,number];});
 return{...scope,source_generation:reading.physical.source_generation,node_ids,rest_metres};
}
