/** Minimal private presentation of an explicitly accepted native identity basis.
 * Source bodies, subject IDs and native records never enter the scene store. */
export const IDENTITY_PRESENTATION='oi.private-identity-presentation/v2';
export const IDENTITY_CHANNEL='oi.private-identity-channel/v1';
export type IdentityForm='yantra'|'cymatic';
export interface PrivateIdentityPattern {
  schema:typeof IDENTITY_PRESENTATION;
  fingerprint:{algorithm:'sha256-native-identity-basis/v1';value:string};
  orientation:{w:number;x:number;y:number;z:number};
  form:IdentityForm;
}
const obj=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid private identity source');return v as Record<string,unknown>;};
export function validateIdentityPattern(value:unknown):PrivateIdentityPattern{
  const v=obj(value),h=obj(v.fingerprint),q=obj(v.orientation);
  if(Object.keys(v).some(k=>!['schema','fingerprint','orientation','form'].includes(k))||Object.keys(h).some(k=>!['algorithm','value'].includes(k))||Object.keys(q).some(k=>!['w','x','y','z'].includes(k)))throw new Error('Private presentation may carry only a basis fingerprint, orientation and selected form; no personal content');
  if(v.schema!==IDENTITY_PRESENTATION||h.algorithm!=='sha256-native-identity-basis/v1'||typeof h.value!=='string'||! /^[0-9a-f]{64}$/.test(h.value)||!['yantra','cymatic'].includes(String(v.form)))throw new Error('Unsupported private identity presentation');
  const values=['w','x','y','z'].map(k=>q[k]);
  if(values.some(n=>typeof n!=='number'||!Number.isFinite(n))||Math.hypot(...values as number[])<1e-12||Math.hypot(...values as number[])>1e6)throw new Error('A finite, nonzero native orientation is required');
  return structuredClone(v) as unknown as PrivateIdentityPattern;
}
export function rotateIdentityPoint(point:{x:number;y:number;z:number},orientation:PrivateIdentityPattern['orientation']):{x:number;y:number;z:number}{
  const n=Math.hypot(orientation.w,orientation.x,orientation.y,orientation.z),w=orientation.w/n,x=orientation.x/n,y=orientation.y/n,z=orientation.z/n;
  const tx=2*(y*point.z-z*point.y),ty=2*(z*point.x-x*point.z),tz=2*(x*point.y-y*point.x);
  return {x:point.x+w*tx+y*tz-z*ty,y:point.y+w*ty+z*tx-x*tz,z:point.z+w*tz+x*ty-y*tx};
}
