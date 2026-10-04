import type {NativePerformanceReading} from './protocol.js';
import type {NativeRecordingCas} from './sceneRecording.js';
export interface PhysicalProvenance {reference:string;revision:string;source_ref:string;standing:'source_authored'|'ratified'|'reference'|'agent_proposed'|'measured'}
export interface AuthoredPhysicalMaterial {provenance:PhysicalProvenance;young_modulus_pa:number;density_kg_per_m3:number;damping_alpha_per_second:number;damping_beta_seconds:number}
export interface AuthoredMetricRecipe {provenance:PhysicalProvenance;family:'axial_truss'|'prestressed_tension_network';frame_side_metres:number;site_separation_metres:number;section_by_element_m2:[number,number,number,number];intersite_section_m2:number;prestress_newtons:number}
export type AuthoredFormOperation=
 |{operation:'select-form';address:number}|{operation:'change-line';line:number}|{operation:'apply-matrix';family:number}
 |{operation:'set-pose';pose:number}|{operation:'set-aperture';aperture:number}|{operation:'reciprocal-aperture'}
 |{operation:'advance-clock';steps:number}|{operation:'spanda-advance';tick12:number;cycle:number}
 |{operation:'transcribe';rna:boolean}|{operation:'cast-creases';angles_deg10:[number,number,number];velocities_deg10:[number,number,number]};
export type AuthoredPhysicalEdit=
 |{kind:'form';actor_ref:string;cause_ref:string;occurrence_unix_ms:number;receipt_unix_ms:number;operations:AuthoredFormOperation[]}
 |{kind:'material';cause_ref:string;material:AuthoredPhysicalMaterial}
 |{kind:'metric-form';cause_ref:string;recipe:AuthoredMetricRecipe};
export interface PhysicalEditSnapshot {current:boolean;body_revision:string;material:AuthoredPhysicalMaterial;recipe:AuthoredMetricRecipe}
export interface NativePhysicalEditPort {snapshot():PhysicalEditSnapshot|null;apply(edit:AuthoredPhysicalEdit):Promise<unknown>;custody():unknown}
const need=(ok:unknown,reason:string):void=>{if(!ok)throw Error(reason);};
/** Read authoring baselines from the exact retained current physical basis.
 * This copied view grants no source, preparation or body transition. */
export function physicalEditSnapshot(document:any,cas:NativeRecordingCas,reading:NativePerformanceReading):PhysicalEditSnapshot{
 const scene=document.scenes.find((row:any)=>row.scene_ref===cas.scene_ref),performance=scene?.performance,scope=reading.scope;
 need(document.expression_ref===cas.expression_ref&&document.revision===cas.document_revision&&scene?.revision===cas.scene_revision&&Array.isArray(performance?.bases)&&Array.isArray(performance?.native_sources),'The current native physical authoring source is absent.');
 const bases=performance.bases.filter((basis:any)=>basis.identity?.instance_ref===scope.instance_ref&&basis.identity?.event_ref===scope.event_ref&&basis.identity?.subject_ref===scope.subject_ref&&basis.prepared_body?.request?.preparation_ref===scope.preparation_ref&&basis.prepared_body?.request?.state_ref===scope.state_ref&&String(basis.prepared_body?.request?.body_revision)===scope.body_revision&&String(basis.identity?.m3_generation)===reading.physical.source_generation);
 need(bases.length===1,'The current native body authoring basis is absent or ambiguous.');
 const sources=performance.native_sources.filter((source:any)=>source.basis_digest===bases[0].content_digest),config=sources[0]?.native_bundle?.configuration;
 // Acoustic source epochs can repeat the basis digest. Admit the physical
 // baseline only when every complete epoch agrees; never select first/latest
 // as current acoustic authority.
 need(sources.length>0&&config?.controls?.material&&config?.recipe&&sources.every((source:any)=>source.schema==='oi.expression-performance-source-asset/v1'&&samePhysicalJson(source.native_bundle?.configuration?.controls?.material,config.controls.material)&&samePhysicalJson(source.native_bundle?.configuration?.recipe,config.recipe)),'The exact current physical material and metric recipe are unavailable or disagree across retained source epochs.');
 return structuredClone({current:reading.available,body_revision:scope.body_revision,material:config.controls.material,recipe:config.recipe});
}
/** C53 returns the original QL source assets and native C-sealed basis. The
 * Return digest may be empty before sealing; never guess old index + 1. */
export function appliedPhysicalBasis(document:any,cas:NativeRecordingCas,result:any):number{
 need(result?.schema==='oi.native-physical-scene-edit-result/v1'&&result.accepted===true&&result.application_committed===true&&result.request?.expression_ref===cas.expression_ref&&result.request?.scene_ref===cas.scene_ref,'The original physical application and document custody are unavailable.');
 const artifact=result.original_application_reply?.result?.source_artifact,scene=document.scenes.find((row:any)=>row.scene_ref===cas.scene_ref),performance=scene?.performance;
 need(artifact?.source_assets&&artifact?.basis&&Array.isArray(performance?.native_sources)&&Array.isArray(performance?.bases),'The actual applied source Return or retained Scene basis is missing.');
 const sources=performance.native_sources.filter((source:any)=>samePhysicalJson(source.native_bundle,artifact.source_assets)&&samePhysicalJson(source.native_physical_source_history,artifact.native_physical_source_history)&&samePhysicalJson(source.native_acoustic_source_history,artifact.native_acoustic_source_history));
 need(sources.length===1,'The actual applied whole source differs from retained native Scene custody.');
 const indices=performance.bases.flatMap((basis:any,index:number)=>basis.content_digest===sources[0].basis_digest?[index]:[]);
 need(indices.length===1,'The applied native C-sealed basis is absent or ambiguous.');
 const basis=performance.bases[indices[0]];
 need(samePhysicalJson(basis.identity,artifact.basis.identity)&&samePhysicalJson(basis.prepared_body,artifact.basis.prepared_body),'The retained actual body or identity differs from the original native application.');
 return indices[0];
}
export function samePhysicalJson(a:any,b:any):boolean{
 if(a===b)return true;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>samePhysicalJson(value,b[index]));
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&samePhysicalJson(a[key],b[key]));
}
