/** Temporal declarations belong to native Wiki objects and participations.
 * This transient read preserves their kind, precision and exact source basis. */
import {validateTemporalFacet,type TechneTemporalFacet,type TechneSourceProvenance} from './contract';
import {CONSTRUCTION,PARTICIPATION} from '../knowledge/construction';
import {knowledgeEntityRef} from '../knowledge/expressionProjection';
import type {ExpressionDocument,Scene} from '../expression/types';
const CONTRACT='aikit.techne-facet/v1';
export interface WikiTemporalSource {ref:string;revision:string;object:string;from_ref?:string;to_ref?:string;relation?:string;facets:TechneTemporalFacet[];frame?:{ref:string;revision:string;participation_ref:string}}
export type WikiTemporalReading={state:'available';sources:WikiTemporalSource[]}|{state:'unavailable';reason:string};
export interface SceneTemporalReading {temporal:TechneTemporalFacet[];provenance:TechneSourceProvenance[];reason?:string}
export function readWikiTemporal(content:string):WikiTemporalReading {
 try{
  const raw=JSON.parse(content),rows=Array.isArray(raw)?raw:raw.objects;
  if(!Array.isArray(rows))throw Error('The Wiki source has no native object collection');
  const sources:WikiTemporalSource[]=[];
  function declared(row:any,identity:Omit<WikiTemporalSource,'facets'>){
   const declaration=row?.[CONTRACT];if(declaration===undefined)return;
   if(declaration?.contract!==CONTRACT||!Array.isArray(declaration.temporal??[]))throw Error('A native temporal declaration has an unsupported contract');
   if(!(declaration.temporal??[]).length)return;
   if(typeof identity.ref!=='string'||!identity.ref||!identity.revision)throw Error('A dated Wiki object has no exact native identity/revision');
   for(const [index,facet] of declaration.temporal.entries()){
    const errors:string[]=[];validateTemporalFacet(facet,`${identity.ref}.temporal[${index}]`,errors);
    for(const instant of [facet.instant,facet.interval?.from,facet.interval?.to])if(instant!=null&&(!/^(?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(instant)||!Number.isFinite(Date.parse(instant))))errors.push('The native time carrier must be an RFC3339 instant');
    if(errors.length)throw Error(errors.join('; '));
   }
   sources.push({...identity,facets:declaration.temporal});
  }
  for(const row of rows){
   const revision=Number.isSafeInteger(row.revision)&&row.revision>0?String(row.revision):'';
   declared(row,{ref:row.ref,revision,object:row.object,from_ref:row.from_ref,to_ref:row.to_ref,relation:row.relation});
   if(row.object!=='frame'||!row[CONSTRUCTION])continue;
   for(const member of row.constellations?.[0]?.members??[]){
    if(member?.[CONTRACT]===undefined)continue;
    const participation_ref=member?.[PARTICIPATION]?.participation_ref;
    if(typeof participation_ref!=='string'||!participation_ref||typeof row.ref!=='string'||!row.ref||!revision)throw Error('A dated member has no exact native frame/participation basis');
    declared(member,{ref:member.ref,revision,object:'participation',frame:{ref:row.ref,revision,participation_ref}});
   }
  }
  return {state:'available',sources};
 }catch(error){return {state:'unavailable',reason:error instanceof Error?error.message:String(error)};}
}
/** Resolve the same production occurrence identity used by native projection.
 * No subject-title match can lend one participation's facts to another. */
export async function resolveSceneTemporalFacets(reading:WikiTemporalReading|undefined,document:ExpressionDocument,scene:Scene):Promise<SceneTemporalReading>{
 const occurrences=new Map<string,string>();
 if(reading?.state==='available')for(const source of reading.sources)if(source.frame)occurrences.set(source.frame.participation_ref,await knowledgeEntityRef(document.expression_ref,source.frame.participation_ref));
 return sceneTemporalFacets(reading,document,scene,occurrences);
}
/** Synchronous aperture over already resolved identities; without an explicit
 * participation map only top-level source declarations may enter this view. */
export function sceneTemporalFacets(reading:WikiTemporalReading|undefined,document:ExpressionDocument,scene:Scene,occurrences?:ReadonlyMap<string,string>):SceneTemporalReading {
 const temporal:TechneTemporalFacet[]=[],provenance:TechneSourceProvenance[]=[];
 if(!reading||reading.state==='unavailable')return {temporal,provenance,reason:reading?.reason};
 const members=new Set(scene.entity_refs),seen=new Set<string>();
 for(const source of reading.sources){
  if(source.frame){
   const entityRef=occurrences?.get(source.frame.participation_ref);if(!entityRef||!members.has(entityRef))continue;
   const subject=document.entities[entityRef]?.subject;
   if(subject?.subject_ref!==source.ref||!subject.readings.some(row=>row.ref===source.frame!.ref&&row.revision===source.frame!.revision&&row.availability==='available'))throw Error('A dated occurrence has changed source membership; refresh its live composition before reading the Timeline');
  }else if(source.object==='edge'){
   const bindings=Object.values(document.relations).filter(binding=>binding.native_owner!=='oi'&&binding.relation.ref===source.ref&&members.has(binding.from_entity_ref)&&members.has(binding.to_entity_ref));
   if(!bindings.length)continue;
   if(!bindings.some(binding=>binding.relation.availability==='available'&&binding.relation.revision===source.revision&&document.entities[binding.from_entity_ref]?.subject?.subject_ref===source.from_ref&&document.entities[binding.to_entity_ref]?.subject?.subject_ref===source.to_ref))throw Error('A dated source relation changed; refresh its native composition before reading the Timeline');
  }else{
   const subjects=scene.entity_refs.map(ref=>document.entities[ref]?.subject).filter(subject=>subject?.subject_ref===source.ref);
   if(!subjects.length)continue;
   if(!subjects.some(subject=>subject!.readings.some(row=>row.ref===source.ref&&row.revision===source.revision&&row.availability==='available')))throw Error('A dated source changed; refresh its live composition before reading the Timeline');
  }
  source.facets.forEach((facet,index)=>{
   // A generated address is presentation only. Navigation uses provenance.
   const facet_ref=facet.facet_ref??`${source.frame?.participation_ref??source.ref}@techne:temporal:${facet.kind}:${index}`;
   if(seen.has(facet_ref))throw Error('Two native temporal facts disclose the same facet identity');seen.add(facet_ref);
   temporal.push({...facet,facet_ref});
   provenance.push({source_ref:source.ref,source_revision:source.revision,native_owner:'wiki',selector:{unit:'other',kind:'techne-temporal-facet',value:facet_ref}});
  });
 }
 return {temporal,provenance};
}
