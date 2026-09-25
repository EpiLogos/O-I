import type {KernelTransportStatus} from '../kernel/types';
import {readFile} from '../files/client';
import {validatePlaceFacet,validateTemporalFacet} from '../techne/contract';
import type {TimePlaceValues} from './ParticipationFacts';
import {ACTOR,invoke,newRef,object,readRegister,sourceBases,validReference,validRevision,type WikiRegister,type ApplyKernel} from './construction';

export interface FactsTarget {kind:'node'|'whole';ref:string}
export interface FactsBasis {target:FactsTarget;title:string;revision:number;source_ref:string;values:TimePlaceValues;operations:Record<string,unknown>}
export interface FactsRequest {schema:'aikit.wiki-facts-action/v1';target:FactsTarget;expected_revision:number;actor_ref:string;operation_ref:string;changes:Record<string,unknown>[]}
export interface FactsCheckpoint {basis:FactsBasis;draft:TimePlaceValues;pending?:FactsRequest}
const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):object(value)?Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,ordered(value[key])])):value;
const same=(a:unknown,b:unknown)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
// Native optional values serialize None as omission; only declared empty-list
// defaults (Place hierarchy/names) are equivalent to absence. Source strings,
// array order, coordinates and every authored value remain exact.
const facetValue=(value:unknown):unknown=>Array.isArray(value)?value.map(facetValue):object(value)?Object.fromEntries(Object.keys(value).filter(key=>value[key]!=null&&!(['hierarchy','names'].includes(key)&&Array.isArray(value[key])&&value[key].length===0)).map(key=>[key,facetValue(value[key])])):value;
const sameFacts=(a:unknown,b:unknown)=>same(facetValue(a),facetValue(b));
export const factsKey=(target:FactsTarget)=>`${target.kind}:${target.ref}`;
export function readFactsBasis(register:WikiRegister,reference:string):FactsBasis {
 const raw:unknown=JSON.parse(register.file.content),rows=Array.isArray(raw)?raw:object(raw)?raw.objects:undefined;
 if(!Array.isArray(rows))throw Error('The native Wiki register has no object collection.');
 const matches=rows.filter(row=>object(row)&&row.ref===reference);
 if(matches.length!==1)throw Error('The native register did not disclose one exact object for this selection.');
 const row=matches[0];
 if(!object(row)||!['node','frame'].includes(String(row.object))||!validRevision(row.revision))throw Error('Time and place can be edited here only for an existing native Wiki node or whole frame.');
 if(row.read_only===true||row.shared_projection_ref)throw Error('This is a read-only projection. Edit the native source instead.');
 const facet=row['aikit.techne-facet/v1'];
 if(facet!==undefined&&(!object(facet)||facet.contract!=='aikit.techne-facet/v1'))throw Error('The native time/place disclosure is malformed; its source has not been changed.');
 const values:TimePlaceValues={temporal:structuredClone(object(facet)&&Array.isArray(facet.temporal)?facet.temporal:[]),places:structuredClone(object(facet)&&Array.isArray(facet.spatial)?facet.spatial:[])};
 if(object(facet)&&((facet.temporal!==undefined&&!Array.isArray(facet.temporal))||(facet.spatial!==undefined&&!Array.isArray(facet.spatial))))throw Error('The native time/place disclosure is not a list.');
 const operations=row['aikit.wiki-facts-operations/v1'];
 return {target:{kind:row.object==='node'?'node':'whole',ref:reference},title:typeof row.title==='string'?row.title:object(row['aikit.constellation/v1'])&&typeof row['aikit.constellation/v1'].title==='string'?row['aikit.constellation/v1'].title:row.object==='node'?'Selected node':'Selected whole',revision:row.revision,source_ref:register.source_ref,values,operations:object(operations)?operations:{}};
}
export function factsChanges(basis:TimePlaceValues,draft:TimePlaceValues):Record<string,unknown>[] {
 const changes:Record<string,unknown>[]=[];
 for(const [field,change,validator]of [['temporal','temporal_set',validateTemporalFacet],['places','place_set',validatePlaceFacet]] as const){
  const values=draft[field]??[];
  if(sameFacts(values,basis[field]??[]))continue;
  const errors:string[]=[];
  if(values.length>256)throw Error('A target accepts at most 256 facts in each family.');
  values.forEach((fact,index)=>{validator(fact,`${field} ${index+1}`,errors);if(!fact.source_ref)errors.push('Choose and read an evidence source for each fact.');});
  if(errors.length)throw Error(errors.join('; '));
  changes.push({change,[field]:structuredClone(values)});
 }
 return changes;
}
export function prepareFacts(checkpoint:FactsCheckpoint):FactsRequest {
 if(checkpoint.pending)return checkpoint.pending;
 const changes=factsChanges(checkpoint.basis.values,checkpoint.draft);
 if(!changes.length)throw Error('These facts already match the saved revision.');
 sourceBases({changes},checkpoint.draft.facet_sources??[]);
 return {schema:'aikit.wiki-facts-action/v1',target:checkpoint.basis.target,expected_revision:checkpoint.basis.revision,actor_ref:ACTOR,operation_ref:newRef('operation:wiki-facts'),changes};
}
export function factsMatch(basis:FactsBasis,request:FactsRequest):boolean {
 return same(basis.target,request.target)&&request.changes.every(change=>change.change==='temporal_set'?sameFacts(basis.values.temporal??[],change.temporal):change.change==='place_set'&&sameFacts(basis.values.places??[],change.places));
}
function factsReceiptCandidate(basis:FactsBasis,request:FactsRequest):boolean {
 const record=basis.operations[request.operation_ref];
 return same(basis.target,request.target)&&object(record)&&record.actor_ref===request.actor_ref&&record.basis_revision===request.expected_revision&&record.result_revision===request.expected_revision+1&&basis.revision>=Number(record.result_revision);
}
/** Observational readback only; never sufficient to clear a pending save. */
export function factsRecorded(basis:FactsBasis,request:FactsRequest):boolean {
 return factsReceiptCandidate(basis,request)&&factsMatch(basis,request);
}
export async function inspectFacts(transport:KernelTransportStatus,project:string|undefined,reference:string):Promise<FactsBasis>{
 return readFactsBasis(await readRegister(transport,project),reference);
}
export async function saveFacts(transport:KernelTransportStatus,project:string|undefined,checkpoint:FactsCheckpoint,apply?:ApplyKernel):Promise<FactsBasis>{
 const request=checkpoint.pending;
 if(!request)throw Error('Retain the exact operation before saving.');
 const register=await readRegister(transport,project),current=readFactsBasis(register,request.target.ref);
 if(register.source_ref!==checkpoint.basis.source_ref||!same(current.target,request.target))throw Error('The selected native register or target changed. Inputs are retained.');
 // A matching receipt is only a candidate for idempotent replay. The owner
 // must compare the immutable request digest before any confirmation.
 if(current.revision!==request.expected_revision&&!factsReceiptCandidate(current,request))throw Error('The native object changed since these inputs were read. Inspect the current revision; your inputs are retained.');
 const files=checkpoint.draft.facet_sources??[],sources=sourceBases(request,files);
 for(const source of sources){const file=files.find(row=>row.source_ref===source.source_ref&&row.revision===source.revision);if(!file)throw Error('Read each fact’s evidence file before saving.');const fresh=await readFile(transport,file.location);if(fresh.revision!==source.revision||(fresh.source?.ref??fresh.location.ref)!==source.source_ref)throw Error('An evidence file changed. Read it again; these inputs are retained.');}
 const result=await invoke<Record<string,unknown>>(transport,project,'aikit.wiki.facts.apply',request.target.ref,{location:register.file.location,expected_file_revision:register.file.revision,request,sources:sources.map(source=>({...source,location:files.find(file=>file.source_ref===source.source_ref)!.location}))},apply);
 if(result.persisted!==true||!same(result.target,request.target)||result.operation_ref!==request.operation_ref||!['saved','unchanged'].includes(String(result.state)))throw Error('The owner did not confirm this exact save. Inspect before retrying.');
 const warnings=Array.isArray(result.continuity_warnings)?result.continuity_warnings.filter((value):value is string=>typeof value==='string'):[];
 if(result.continuity==='reconciliation_required'||warnings.length)throw Error(`The owner acknowledged that the facts were saved, but source continuity needs reconciliation. The exact pending operation is retained. ${warnings.join(' ')}`.trim());
 const confirmed=await inspectFacts(transport,project,request.target.ref);
 if(!factsRecorded(confirmed,request))throw Error('The saved facts did not independently read back at their recorded operation. Inspect before retrying.');
 return confirmed;
}
/** Draft retention is editor recovery only; all authority is reread natively. */
export function restoreFactsCheckpoints(value:unknown):Record<string,FactsCheckpoint>{
 if(value===undefined)return {};
 if(!object(value)||Object.keys(value).length>32||JSON.stringify(value).length>2*1024*1024)throw Error('Retained time/place drafts exceed their recovery budget.');
 for(const [key,checkpoint]of Object.entries(value)){
  if(!object(checkpoint)||!object(checkpoint.basis)||!object(checkpoint.draft))throw Error('A retained time/place draft is malformed.');
  const basis=checkpoint.basis,target=basis.target;
  if(!object(target)||!['node','whole'].includes(String(target.kind))||!validReference(target.ref)||key!==factsKey(target as unknown as FactsTarget)||!validRevision(basis.revision)||!validReference(basis.source_ref)||typeof basis.title!=='string'||basis.title.length>12000||!object(basis.values)||!object(basis.operations))throw Error('A retained time/place target is malformed.');
  for(const values of [basis.values,checkpoint.draft])for(const field of ['temporal','places','facet_sources'])if(values[field]!==undefined&&(!Array.isArray(values[field])||values[field].length>256||!values[field].every(object)))throw Error('A retained time/place input is malformed.');
  if(checkpoint.pending!==undefined){const pending=checkpoint.pending;if(!object(pending)||pending.schema!=='aikit.wiki-facts-action/v1'||!same(pending.target,target)||pending.expected_revision!==basis.revision||!validReference(pending.actor_ref)||!validReference(pending.operation_ref)||!Array.isArray(pending.changes)||pending.changes.length<1||pending.changes.length>2||pending.changes.some(change=>!object(change)||!['temporal_set','place_set'].includes(String(change.change))))throw Error('A retained time/place operation is malformed.');if(pending.actor_ref!==ACTOR||!same(pending.changes,factsChanges(basis.values as TimePlaceValues,checkpoint.draft as TimePlaceValues)))throw Error('The retained operation differs from its captured inputs.');}
 }
 return value as unknown as Record<string,FactsCheckpoint>;
}

/** Keep the active target and every actual draft/pending operation. Older
 * unchanged readings are safe to reread and cannot exhaust recovery forever. */
export function retainFactsCheckpoint(existing:Record<string,FactsCheckpoint>,key:string,value:FactsCheckpoint):Record<string,FactsCheckpoint>{
 const next={...existing,[key]:structuredClone(value)};
 for(const candidate of Object.keys(next)){
  if(Object.keys(next).length<=32&&JSON.stringify(next).length<=2*1024*1024)break;
  const checkpoint=next[candidate];
  if(candidate!==key&&!checkpoint.pending&&sameFacts(checkpoint.draft.temporal??[],checkpoint.basis.values.temporal??[])&&sameFacts(checkpoint.draft.places??[],checkpoint.basis.values.places??[])&&same(checkpoint.draft.facet_sources??[],checkpoint.basis.values.facet_sources??[]))delete next[candidate];
 }
 return restoreFactsCheckpoints(next);
}
