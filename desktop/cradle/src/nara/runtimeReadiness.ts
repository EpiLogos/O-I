/** Native, on-demand observations. These rows confer no effect authority. */
export interface RuntimeReadiness {
 schema:'oi.nara-runtime-readiness/v1';context_ref:string;expression_ref:string;expression_revision:string;
 observed_at_unix_ms:number;authority_granted:false;provider_started:false;standing:string;
 faculties:{id:string;label:string;capability_refs:string[];native_owners:string[];source_standing:string;
  readings:{aspect:string;owner:string;status:'observed'|'disclosed'|'not-observed'|'unavailable';basis:unknown;reason:string|null}[]}[];
}
export function validateRuntimeReadiness(value:unknown):RuntimeReadiness {
 const r=value as RuntimeReadiness;
 if(r?.schema!=='oi.nara-runtime-readiness/v1'||!r.context_ref||!r.expression_ref||!r.expression_revision
   ||r.authority_granted!==false||r.provider_started!==false||!Number.isSafeInteger(r.observed_at_unix_ms)
   ||!Array.isArray(r.faculties)||r.faculties.length!==6)throw Error('The native owner returned an incomplete runtime disclosure.');
 const ids=new Set(r.faculties.map(row=>row.id));
 if(['S0′','S1′','S2′','S3′','S4′','S5′'].some(id=>!ids.has(id)))throw Error('The native runtime disclosure changed its faculty identities.');
 for(const f of r.faculties)if(!f.label||!Array.isArray(f.readings)||f.readings.some(row=>!row.aspect||!row.owner||!['observed','disclosed','not-observed','unavailable'].includes(row.status)))throw Error('The native runtime disclosure contains an invalid owner observation.');
 return r;
}
