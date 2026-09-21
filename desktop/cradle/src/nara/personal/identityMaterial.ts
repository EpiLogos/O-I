import {validateIdentityPattern,IDENTITY_PRESENTATION,type IdentityForm,type PrivateIdentityPattern} from '../identityPresentation';
/** Native identity material is read, never recomputed by the renderer. Central
 * owns source currentness; QL owns its accepted identity basis and receipts. */
import type {CentralLocation, NativeFileReading} from '../../kernel/types';
import {readRecord, object, text, sameTarget, targetOf, type PersonalRecord, type PersonalTarget, type SourceBasis, type ProtectedSource} from './client';
export const IDENTITY_MATERIAL = 'ql.nara-identity-material/v1';
export const IDENTITY_ALGORITHM = 'sha256-native-identity-basis/v1';
export const IDENTITY_KINDS = ['birthdate-name','natal-chart','jungian-assessment','gene-keys','human-design','archetypal-quintessence'];
export interface NativeIdentityMaterial {
  schema:typeof IDENTITY_MATERIAL; algorithm:typeof IDENTITY_ALGORITHM; value:string;
  identity_hash_ref:ProtectedSource; target:PersonalTarget; record_revision:number;
  identity_revision:string; sealed:boolean; m3_form_address_ref:string|null;
  identity_quaternion_ref:ProtectedSource|null; q_composed:{w:number;x:number;y:number;z:number};
  event_ref:string; reception_generation:number; source_revisions:SourceBasis[];
  supplied_offices:string[]; private:true; public_export:false; standing:string;
}
function equal(a:unknown,b:unknown):boolean {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const x=a as Record<string,unknown>,y=b as Record<string,unknown>;
  return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.prototype.hasOwnProperty.call(y,k)&&equal(x[k],y[k]));
}
export function readIdentityMaterial(raw:unknown,record:PersonalRecord):NativeIdentityMaterial {
  const v=object(raw,'Native identity material'),hash=object(v.identity_hash_ref),identity=record.domain.identity;
  if(v.schema!==IDENTITY_MATERIAL||v.algorithm!==IDENTITY_ALGORITHM||v.private!==true||v.public_export!==false||typeof v.value!=='string'||! /^[0-9a-f]{64}$/.test(v.value))throw new Error('The selected native owner did not return supported private identity material');
  if(!sameTarget(targetOf(v.target),record.target)||v.record_revision!==record.revision||v.identity_revision!==identity.identity_revision||v.event_ref!==record.domain.event.event_ref||v.reception_generation!==record.domain.embodied.reception_generation)throw new Error('Identity material belongs to another or stale personal occasion');
  if(hash.ref_id!==`ql:nara-identity:sha256:${v.value}`||hash.revision!==v.value||hash.owner_ref!=='ql')throw new Error('Identity material lost its native protected reference');
  const slots=identity.slots.slice().sort((a,b)=>IDENTITY_KINDS.indexOf(a.kind)-IDENTITY_KINDS.indexOf(b.kind));
  if(slots.length!==6||new Set(slots.map(s=>s.kind)).size!==6||slots.some(s=>!IDENTITY_KINDS.includes(s.kind)))throw new Error('A complete native office set is required; offices may remain unprovided');
  const supplied=slots.filter(s=>s.protected_value_ref);
  if(!supplied.length||supplied.some(s=>!s.source)||!equal(v.supplied_offices,supplied.map(s=>s.kind))||!equal(v.source_revisions,supplied.map(s=>s.source)))throw new Error('Identity material does not carry the reviewed source basis');
  const q=object(v.q_composed),numbers=['w','x','y','z'].map(k=>q[k]);
  if(numbers.some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.hypot(...numbers as number[])<1e-12||!equal(q,record.domain.q_composed))throw new Error('Identity material has another or invalid current orientation');
  if(!equal(v.m3_form_address_ref,identity.m3_form_address_ref)||!equal(v.identity_quaternion_ref,identity.identity_quaternion_ref)||typeof v.sealed!=='boolean'||v.sealed!==equal(identity.identity_hash_ref,v.identity_hash_ref))throw new Error('Native identity acceptance or separate derivative references changed');
  text(v.standing,'Native identity standing');
  return structuredClone(v) as unknown as NativeIdentityMaterial;
}
function escape(value:string):string{return Array.from(new TextEncoder().encode(value),b=>((b>=48&&b<=57)||(b>=65&&b<=90)||(b>=97&&b<=122)||[47,45,95,46].includes(b))?String.fromCharCode(b):'%'+b.toString(16).toUpperCase().padStart(2,'0')).join('');}
/** Decode an existing owner address only, not a new path identity or search. */
export function identitySourceLocation(ref:string):CentralLocation {
  const match=/^central:path:([^:]+):([^:]+)$/.exec(text(ref));
  if(!match)throw new Error('This identity source needs its native owner reading; no substitute source was searched');
  let root:string,path:string;
  try{root=decodeURIComponent(match[1]);path=decodeURIComponent(match[2]);}catch{throw new Error('Malformed Central source address');}
  if(!root.startsWith('/')||path.startsWith('/')||!path||/[\\\u0000-\u001f\u007f]/.test(root+path)||path.split('/').some(p=>!p||p==='.'||p==='..')||ref!==`central:path:${escape(root)}:${escape(path)}`)throw new Error('Noncanonical Central identity source address');
  return {schema:'central.path-ref/v1',root,path,ref};
}
/** Used before review, seal and presentation. Source text is discarded and is
 * never sent to QL, Epii, the renderer or a model by this currentness check. */
export async function verifyIdentitySources(record:PersonalRecord,read:(location:CentralLocation)=>Promise<NativeFileReading>):Promise<void> {
  for(const slot of record.domain.identity.slots){
    if(!slot.protected_value_ref)continue;
    const ref=slot.protected_value_ref;
    if(ref.owner_ref!=='central'||!slot.source)throw new Error('Identity source ownership or provenance is unavailable');
    const location=identitySourceLocation(ref.ref_id),reading=await read(location);
    if(reading.schema!=='central.file-reading/v1'||reading.automatic_agent_or_model_invocation!==false||!equal(reading.location,location)||reading.revision!==ref.revision||reading.revision!==slot.source.revision)throw new Error('An identity source changed or was withheld. Reselect its current revision before acceptance or presentation');
  }
}

/** Only a sealed, exact native basis may become the private presentation.
 * No renderer hash, inferred chart, source body, identity ref or receipt crosses
 * into the hosted scene. Orientation is the current native reading, not bits. */
export async function identityPattern(record:unknown,form:IdentityForm,material:unknown):Promise<PrivateIdentityPattern>{
  const current=readRecord(record),native=readIdentityMaterial(material,current);
  if(!native.sealed)throw new Error('Review and accept this native identity basis before showing it');
  return validateIdentityPattern({schema:IDENTITY_PRESENTATION,fingerprint:{algorithm:IDENTITY_ALGORITHM,value:native.value},orientation:native.q_composed,form});
}
