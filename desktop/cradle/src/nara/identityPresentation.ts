/** Private presentation input. The fingerprint describes selected source
 * revisions, not the whole person, a diagnosis, or a guessed natal chart.
 * Native identity hash/form refs and q_composed keep their distinct meanings. */
export const IDENTITY_PRESENTATION='oi.private-identity-presentation/v1';
export const IDENTITY_CHANNEL='oi.private-identity-channel/v1';
export type IdentityForm='yantra'|'cymatic';
export interface PrivateIdentityPattern {
  schema:typeof IDENTITY_PRESENTATION;
  fingerprint:{algorithm:'sha256-identity-source-basis/v1';value:string};
  orientation:{w:number;x:number;y:number;z:number};
  form:IdentityForm;
}
const kinds=['birthdate-name','natal-chart','jungian-assessment','gene-keys','human-design','archetypal-quintessence'];
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid private identity source');return v as Record<string,unknown>;};
function canonical(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  return JSON.stringify(value)??'null';
}
/** The same source basis yields the same individuation even when orientation,
 * body, session, ordering of JSON properties or presentation changes. */
export async function identityPattern(record:unknown,form:IdentityForm):Promise<PrivateIdentityPattern>{
  const r=obj(record),domain=obj(r.domain),identity=obj(domain.identity);
  if(r.schema!=='ql.nara-personal-record/v1'||r.private!==true||domain.schema!=='ql.nara-m4-domain/v1'||!Array.isArray(identity.slots)||identity.slots.length!==6)throw new Error('A private native six-layer identity reading is required');
  const slots=identity.slots.map(obj);
  if(new Set(slots.map(s=>s.kind)).size!==6||slots.some(s=>!kinds.includes(String(s.kind))))throw new Error('The native identity layer set is incomplete');
  if(!slots.some(s=>s.protected_value_ref&&s.source))throw new Error('Choose at least one identity source first. An empty stack is not a completed identity');
  const basis=slots.slice().sort((a,b)=>String(a.kind).localeCompare(String(b.kind))).map(s=>({kind:s.kind,source:s.source,protected_value_ref:s.protected_value_ref,absence_reason:s.absence_reason,standing:s.standing}));
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical({revision:identity.identity_revision,slots:basis})));
  const value=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
  return validateIdentityPattern({schema:IDENTITY_PRESENTATION,fingerprint:{algorithm:'sha256-identity-source-basis/v1',value},orientation:domain.q_composed,form});
}
export function validateIdentityPattern(value:unknown):PrivateIdentityPattern{
  const v=obj(value),h=obj(v.fingerprint),q=obj(v.orientation);
  if(Object.keys(v).some(k=>!['schema','fingerprint','orientation','form'].includes(k))||Object.keys(h).some(k=>!['algorithm','value'].includes(k))||Object.keys(q).some(k=>!['w','x','y','z'].includes(k)))throw new Error('Private presentation may carry only a basis fingerprint, orientation and selected form; no personal content');
  if(v.schema!==IDENTITY_PRESENTATION||h.algorithm!=='sha256-identity-source-basis/v1'||typeof h.value!=='string'||! /^[0-9a-f]{64}$/.test(h.value)||!['yantra','cymatic'].includes(String(v.form)))throw new Error('Unsupported private identity presentation');
  const values=['w','x','y','z'].map(k=>q[k]);
  if(values.some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.hypot(...values as number[])<1e-12||Math.hypot(...values as number[])>1e6)throw new Error('A finite, nonzero native orientation is required');
  return structuredClone(v) as unknown as PrivateIdentityPattern;
}
export function rotateIdentityPoint(point:{x:number;y:number;z:number},orientation:PrivateIdentityPattern['orientation']):{x:number;y:number;z:number}{
  const n=Math.hypot(orientation.w,orientation.x,orientation.y,orientation.z),w=orientation.w/n,x=orientation.x/n,y=orientation.y/n,z=orientation.z/n;
  const tx=2*(y*point.z-z*point.y),ty=2*(z*point.x-x*point.z),tz=2*(x*point.y-y*point.x);
  return {x:point.x+w*tx+y*tz-z*ty,y:point.y+w*ty+z*tx-x*tz,z:point.z+w*tz+x*ty-y*tx};
}
