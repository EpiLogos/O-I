/** Native coordinate/profile reads and adoption over the existing Expression owner. */
import type {ExpressionDocument,ExpressionRequest,ExpressionResult,SubjectBinding,ReadingRef} from '../expression/types';
export type CoordinateFace='bimba'|'pratibimba';
export interface CoordinateRequest {coordinate_ref:string;face:CoordinateFace;source_only?:boolean;include_content?:boolean;related_coordinates?:string[];inventory?:{offset:number;limit:number}}
export interface CoordinateProfile extends Record<string,unknown> {profile_ref:string;revision:number;title:string;parent_profile_refs:string[];provenance:ReadingRef[]}
export interface CoordinateExpressionBinding {
 schema:'ql.coordinate-expression-binding/v1';coordinate_ref:string;coordinate_id:string;face:CoordinateFace;family:string;labels:string[];branch_path:string[];
 rooted_world:{registry_revision:string;selected_id:string;selected_source_ref:string;direct:{canonical_ref:string};conjugate:{canonical_ref:string};native_owner:{standing:string;bindings:{identity:string;module:string;disposition:string;readiness:string;evidence:string}[]}};
 grammar_sources:{source_ref:string;content_revision:string}[];
 inherited_profiles:{scope:string;profile_ref:string;profile_revision:number;content_revision:string;parent_profile_ref:string|null;basis_ref:string}[];
 resolved_profile_ref:string;profile_revision:number;binding_content_revision:string;
 property_sources:{registry_record_index:number;record:{record_index:number;property_keys:string[];payload_sha256:string};file:{path:string;git_blob:string;sha256:string};source_repository:string;source_revision:string}[];
 source_relations:{id:string;record:number;relation_ref:string;class:string;source_kind:string;from_ref:string|null;to_ref:string|null;orientation:string}[];
 declared_capabilities:Record<string,unknown>[];ta_onta_faculties:{id:string;label:string;standing:string;capability_refs:string[];native_owners:string[]}[];
 property_value_standing:string;capability_standing:string;authored_variant_refs:string[];encounter_overlay_standing:string;
}
export interface BimbaSourceIdentity {coordinate:string;native_coordinate:string|null;canonical_ref:string;uuid:string|null;title:string;aliases:string[];source_revision:string;registry_revision:string;full_source_ref:string;full_properties_ref:string;properties_sha256:string;properties?:Record<string,unknown>}
export interface BimbaSourceContent {schema:'ql.bimba-coordinate-content/v1';source_revision:string;registry_revision:string;identity:BimbaSourceIdentity;relations:{source_index:number;relation_ref:string;from_coordinate:string;to_coordinate:string;from_ref:string;to_ref:string;kind:string;orientation:'directed';properties:Record<string,unknown>;properties_sha256:string;source_revision:string}[];standing:string}
export interface BimbaSourceInventory {schema:'ql.bimba-inventory/v1';source_revision:string;registry_revision:string;source_ref:string;total:number;relations:number;offset:number;next_offset:number|null;items:BimbaSourceIdentity[]}
export interface CoordinateExpressionResult {schema:'oi.nara-coordinate/v1';binding:CoordinateExpressionBinding;profiles:CoordinateProfile[];subject_binding:SubjectBinding;source_content?:BimbaSourceContent;related_readings?:CoordinateExpressionResult[];source_inventory?:BimbaSourceInventory}
export type ExpressionOwner=(request:ExpressionRequest)=>Promise<ExpressionResult>;
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function validateCoordinateExpression(value:unknown):CoordinateExpressionResult {
 const r=value as CoordinateExpressionResult,b=r?.binding;
 if(r?.schema!=='oi.nara-coordinate/v1'||b?.schema!=='ql.coordinate-expression-binding/v1'||!Array.isArray(r.profiles)||!Array.isArray(b.inherited_profiles)||!r.subject_binding)throw Error('The native coordinate owner returned an unsupported reading.');
 if(!b.coordinate_ref||!b.resolved_profile_ref||!Number.isSafeInteger(b.profile_revision)||b.profile_revision<1||!['bimba','pratibimba'].includes(b.face))throw Error('The native coordinate reading is missing its exact basis.');
 if(r.subject_binding.native_owner!=='ql-mef'||r.subject_binding.sources[0]?.ref!==r.subject_binding.subject_ref||r.subject_binding.sources[0]?.revision!==b.rooted_world.registry_revision||r.subject_binding.sources[0]?.availability!=='available')throw Error('The native coordinate has no exact source binding.');
 if(r.subject_binding.subject_ref!==b.rooted_world[b.face==='bimba'?'direct':'conjugate'].canonical_ref)throw Error('The native subject does not match the resolved coordinate face.');
 if(r.profiles.length!==b.inherited_profiles.length||r.profiles.length<1||r.profiles.length>4)throw Error('The native profile lineage is incomplete.');
 for(let i=0;i<r.profiles.length;i++){
  const p=r.profiles[i],l=b.inherited_profiles[i];
  if(p.profile_ref!==l.profile_ref||p.revision!==l.profile_revision||stable(p.parent_profile_refs)!==stable(l.parent_profile_ref?[l.parent_profile_ref]:[]))throw Error('The native profile projection disagrees with its QL lineage.');
 }
 const final=r.profiles[r.profiles.length-1]!;
 if(final.profile_ref!==b.resolved_profile_ref||final.revision!==b.profile_revision)throw Error('The native resolved profile does not match its final layer.');
 return r;
}
/** The definition owner remains native. No inferred material, parameters or actions. */
export async function adoptCoordinateExpression(run:ExpressionOwner,reading:CoordinateExpressionResult,basis:ExpressionDocument,entityRef:string):Promise<ExpressionDocument> {
 validateCoordinateExpression(reading);
 if(basis.selection.entity_ref!==entityRef||!basis.entities[entityRef])throw Error('The selected centre changed. Read the Expression again before adopting its profile.');
 const verify=async()=>{
  const now=(await run({operation:'inspect',expression_ref:basis.expression_ref})).document;
  if(!now||now.revision!==basis.revision||now.selection.entity_ref!==entityRef||now.selection.scene_ref!==basis.selection.scene_ref)throw Error('The Expression changed. Read the coordinate again before adopting it.');
 };
 await verify();
 await ensureCoordinateProfiles(run,reading,'human:nara-coordinate');
 await verify();
 const result=await run({operation:'edit',expression_ref:basis.expression_ref,expected_revision:basis.revision,actor:'human:nara-coordinate',changes:[
  ...(basis.profiles??[]).filter(profile=>profile.profile_ref.startsWith('profile:epi-coordinate-')).map(profile=>({change:'profile_release' as const,profile_ref:profile.profile_ref})),
  {change:'profile_adopt',adoption:{profile_ref:reading.binding.resolved_profile_ref,revision:reading.binding.profile_revision,source_basis:reading.subject_binding.sources[0]}},
 ]});
 if(!result.document)throw Error('The native owner did not return the adopted Expression.');
 return result.document;
}

/** Reuse immutable definitions; never replace a content-addressed profile. */
export async function ensureCoordinateProfiles(run:ExpressionOwner,reading:CoordinateExpressionResult,actor='system:nara-coordinate'):Promise<void> {
 validateCoordinateExpression(reading);
 for(const profile of reading.profiles){
  let existing:unknown;
  try{existing=(await run({operation:'profile_inspect',profile_ref:profile.profile_ref})).profile;}
  catch(error){if(!(error instanceof Error)||!error.message.includes('Profile is not defined'))throw error;}
  if(existing){if(stable(existing)!==stable(profile))throw Error(`The stored profile ${profile.profile_ref} differs from its native source. Adoption was refused.`);}
  else await run({operation:'profile_define',profile,actor});
 }
}
/** Reconstruct missing native definitions after reopening the saved Expression.
 * A changed source yields another ref and refuses; it never rebases adoption. */
export async function ensureNativeCoordinateProfile(run:ExpressionOwner,read:(request:CoordinateRequest)=>Promise<CoordinateExpressionResult>,document:ExpressionDocument):Promise<void> {
 const adopted=(document.profiles??[]).filter(profile=>profile.profile_ref.startsWith('profile:epi-coordinate-'));
 if(adopted.length>1)throw Error('This Expression has more than one coordinate profile. Explicitly choose the intended profile again.');
 const adoption=adopted[0];
 if(!adoption)return;
 const entity=document.selection.entity_ref?document.entities[document.selection.entity_ref]:null;
 const scene=document.scenes.find(scene=>scene.scene_ref===document.selection.scene_ref);
 const qlOwner=(owner:string|undefined)=>owner!==undefined&&['ql','ql-mef','QL-MEF'].includes(owner);
 const subject=qlOwner(entity?.subject?.native_owner)?entity!.subject:qlOwner(scene?.body?.native_owner)?scene!.body:null;
 const coordinate=adoption.source_basis?.ref??subject?.subject_ref;
 if(!coordinate)throw Error('The adopted coordinate profile has no retained native coordinate source.');
 const face:CoordinateFace=coordinate.startsWith('ql:m-coordinate:pratibimba:')?'pratibimba':'bimba';
 const reading=validateCoordinateExpression(await read({coordinate_ref:coordinate,face}));
 if(adoption.source_basis&&(adoption.source_basis.availability!=='available'||adoption.source_basis.revision!==reading.binding.rooted_world.registry_revision))throw Error('The adopted coordinate source revision changed. Review the current native reading before adopting it.');
 if(reading.binding.resolved_profile_ref!==adoption.profile_ref||reading.binding.profile_revision!==adoption.revision)throw Error('The adopted coordinate profile differs from the current native source. Review and explicitly adopt its new revision.');
 await ensureCoordinateProfiles(run,reading);
}
