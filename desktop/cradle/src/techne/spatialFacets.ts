/** Canonical native PlaceSet declarations remain Wiki-owned. Only exact
 * participating occurrences lend those declarations to a Scene instrument. */
import {validatePlaceFacet,type TechnePlaceFacet,type TechneSourceProvenance} from './contract';
import {CONSTRUCTION,PARTICIPATION} from '../knowledge/construction';
import {knowledgeEntityRef} from '../knowledge/expressionProjection';
import type {ExpressionDocument,Scene} from '../expression/types';
const CONTRACT='aikit.techne-facet/v1';
interface SpatialSource {ref:string;revision:string;facets:TechnePlaceFacet[];frame?:{ref:string;revision:string;participation_ref:string}}
export type WikiSpatialReading={state:'available';sources:SpatialSource[]}|{state:'unavailable';reason:string};
export interface SceneSpatialReading {spatial:TechnePlaceFacet[];provenance:TechneSourceProvenance[];reason?:string}
export function readWikiSpatial(content:string):WikiSpatialReading {
 try{
  const raw=JSON.parse(content),rows=Array.isArray(raw)?raw:raw.objects;
  if(!Array.isArray(rows))throw Error('The Wiki source has no native object collection');
  const sources:SpatialSource[]=[];
  function declared(row:any,identity:Omit<SpatialSource,'facets'>){
   const declaration=row?.[CONTRACT];if(declaration===undefined)return;
   if(declaration?.contract!==CONTRACT||!Array.isArray(declaration.spatial??[]))throw Error('A native place declaration has an unsupported contract');
   if(!(declaration.spatial??[]).length)return;
   if(typeof identity.ref!=='string'||!identity.ref||!identity.revision)throw Error('A declared place has no exact native source basis');
   for(const [index,facet] of declaration.spatial.entries()){const errors:string[]=[];validatePlaceFacet(facet,`${identity.ref}.spatial[${index}]`,errors);if(errors.length)throw Error(errors.join('; '));}
   sources.push({...identity,facets:declaration.spatial});
  }
  for(const row of rows){
   const revision=Number.isSafeInteger(row.revision)&&row.revision>0?String(row.revision):'';
   declared(row,{ref:row.ref,revision});
   if(row.object!=='frame'||!row[CONSTRUCTION])continue;
   for(const member of row.constellations?.[0]?.members??[]){
    const participation_ref=member?.[PARTICIPATION]?.participation_ref;
    if(member?.[CONTRACT]===undefined)continue;
    if(typeof participation_ref!=='string'||!participation_ref||!revision)throw Error('A placed member has no exact native frame/participation basis');
    declared(member,{ref:member.ref,revision,frame:{ref:row.ref,revision,participation_ref}});
   }
  }
  return {state:'available',sources};
 }catch(error){return {state:'unavailable',reason:error instanceof Error?error.message:String(error)};}
}
export async function sceneSpatialFacets(reading:WikiSpatialReading|undefined,document:ExpressionDocument,scene:Scene):Promise<SceneSpatialReading> {
 const spatial:TechnePlaceFacet[]=[],provenance:TechneSourceProvenance[]=[];
 if(!reading||reading.state==='unavailable')return {spatial,provenance,reason:reading?.reason};
 const byPlace=new Map<string,string>();
 for(const source of reading.sources){
  if(source.frame){
   const entityRef=await knowledgeEntityRef(document.expression_ref,source.frame.participation_ref);
   if(!scene.entity_refs.includes(entityRef))continue;
   const subject=document.entities[entityRef]?.subject;
   if(subject?.subject_ref!==source.ref||!subject.readings.some(row=>row.ref===source.frame!.ref&&row.revision===source.frame!.revision&&row.availability==='available'))throw Error('A placed occurrence has changed source membership; refresh its live composition before opening Places');
  }else{
   const subjects=scene.entity_refs.map(ref=>document.entities[ref]?.subject).filter(subject=>subject?.subject_ref===source.ref);
   if(!subjects.length)continue;
   if(!subjects.some(subject=>subject!.readings.some(row=>row.ref===source.ref&&row.revision===source.revision&&row.availability==='available')))throw Error('A placed source changed; refresh its live composition before opening Places');
  }
  for(const facet of source.facets){
   const previous=byPlace.get(facet.place_ref),signature=JSON.stringify(facet);
   if(previous&&previous!==signature)throw Error('This Scene discloses conflicting native readings of one place; resolve them in the source editor');
   if(previous)continue;byPlace.set(facet.place_ref,signature);spatial.push(facet);
   provenance.push({source_ref:source.ref,source_revision:source.revision,native_owner:'wiki',selector:{unit:'other',kind:'techne-spatial-facet',value:facet.place_ref}});
  }
 }
 return {spatial,provenance};
}
