import {kernelOp} from "../kernel/bridge";
import type {KnowledgeAddress,KnowledgeReading,KnowledgeRelations,KernelTransportStatus} from "../kernel/types";
import type {Change,ExpressionDocument,ExpressionRequest,ExpressionResult,ReadingRef,SubjectBinding} from "../expression/types";
import {graphAddress,type GraphNode} from "./graph";
import {knowledge} from './client';
/** Native relation neighbourhood budget, not an arbitrary first-ten cut. The
 * Expression owner's separate material capacity is checked before editing. */
export const KNOWLEDGE_EXPRESSION_LIMIT=96;
export type ParticipationForm="constellation"|"pair"|"triad"|"whole"|"direct-conjugate";
export interface OwnerParticipation {contract:"ql-mef/wiki-participation/v1";participation_ref:string;revision:number;form:ParticipationForm;members:{role:"member"|"direct"|"conjugate";canonical_ref:string;source_identity:string}[];provenance:{source_ref:string;source_revision?:string}[]}
export interface LocalMember {initialPosition?:{x:number;y:number;z:number};frameReading?:ReadingRef;registerReading?:ReadingRef;node:GraphNode;reading:KnowledgeReading;sources?:ReadingRef[]}
export interface LocalWhole {locus:string;members:LocalMember[];edges:KnowledgeRelations["edges"];truncated:boolean;warnings:string[];pinned:string[];ownerRelations?:{from:string;to:string;relation:ReadingRef;provenance:ReadingRef[]}[];grammar:{state:"applied";participation:OwnerParticipation}|{state:"unavailable"|"stale";detail:string};relationBindingsUnavailable:number}
export type ProjectionOutcome={state:"ready";document:ExpressionDocument;whole:LocalWhole}|{state:"revision_conflict";whole:LocalWhole;result:ExpressionResult}|{state:"unavailable";whole?:LocalWhole;detail:string};
async function digest(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("").slice(0,32);}
export async function knowledgeExpressionRef(surface:string){return `expression:knowledge-${await digest(surface)}`;}
export async function knowledgeEntityRef(expressionRef:string,subjectRef:string){return `${expressionRef}:entity:k-${await digest(subjectRef)}`;}
function address(node:GraphNode):KnowledgeAddress|undefined {
 if(node.address)return node.address;
 if(node.kind==='knowledge-source')return {kind:'source',value:node.ref};
 if(node.kind==='wiki-object'||node.kind==='wiki-frame')return {kind:'wiki',value:node.ref};
 try{return graphAddress(node);}catch{return undefined;}
}
export function validateParticipation(participation:OwnerParticipation|undefined,members:LocalMember[]):LocalWhole["grammar"]{
 if(!participation)return {state:"unavailable",detail:"The current owner reading disclosed no QL participation grammar."};
 if(!Array.isArray(participation.members)||!Array.isArray(participation.provenance)||participation.members.some(m=>!m||typeof m.canonical_ref!=="string"||typeof m.source_identity!=="string")||participation.provenance.some(p=>!p||typeof p.source_ref!=="string"))return {state:"stale",detail:"Owner participation members or provenance are malformed."};
 if(participation.contract!=="ql-mef/wiki-participation/v1"||!Number.isInteger(participation.revision)||participation.revision<1||!(["constellation","pair","triad","whole","direct-conjugate"] as string[]).includes(participation.form)||participation.members.some(m=>!m.source_identity||!m.source_identity.includes(m.canonical_ref)||!/@[^@]+$/.test(m.source_identity)))return {state:"stale",detail:"Owner participation contract, revision, form, or source identity is invalid."};
 const refs=participation.members.map(m=>m.canonical_ref),unique=new Set(refs),actual=new Set(members.map(m=>m.node.ref));
 const cardinality=participation.form==="pair"||participation.form==="direct-conjugate"?refs.length===2:participation.form==="triad"?refs.length===3:participation.form==="constellation"?refs.length>=2:refs.length>=1;
 const roles=participation.form==="direct-conjugate"?participation.members.filter(m=>m.role==="direct").length===1&&participation.members.filter(m=>m.role==="conjugate").length===1:participation.members.every(m=>m.role==="member");
 const sources=participation.provenance.length>0&&participation.provenance.every(p=>p.source_ref&&p.source_revision&&members.some(m=>m.reading.resource===p.source_ref&&m.reading.revision===p.source_revision));
 return unique.size===refs.length&&unique.size===actual.size&&refs.every(ref=>actual.has(ref))&&cardinality&&roles&&sources?{state:"applied",participation}:{state:"stale",detail:"Owner participation does not match the exact unique members, roles, cardinality, and source revisions of this local whole."};
}
/** Pull the owner's bounded relations first, then read every admitted member. */
export async function readLocalWhole(transport:KernelTransportStatus,project:string|undefined,locus:GraphNode,pins:GraphNode[]=[],participation?:OwnerParticipation,rootAddress?:KnowledgeAddress):Promise<LocalWhole>{
 const root=rootAddress??address(locus);if(!root)throw new Error(`Native relations are unavailable for ${locus.kind}: ${locus.ref}`);
 const relations=await knowledge<KnowledgeRelations>(transport,project,{action:'relations',address:root});
 if(!Array.isArray(relations.nodes)||!Array.isArray(relations.edges))throw new Error('The native relation reading is malformed');
 const graphNodes=new Map([locus,...pins].map(node=>[node.ref,node]));
 for(const row of relations.nodes)if(!graphNodes.has(row.resource))graphNodes.set(row.resource,{ref:row.resource,label:row.label,kind:row.kind,address:row.address,native_owner:locus.native_owner,provenance:locus.provenance,actions:[]});
 const admitted=[...new Set([locus.ref,...pins.map(node=>node.ref),...relations.nodes.map(node=>node.resource)])];
 if(admitted.length>KNOWLEDGE_EXPRESSION_LIMIT)throw new Error(`This selection contains ${admitted.length} subjects; narrow or split the native neighbourhood before composing (budget ${KNOWLEDGE_EXPRESSION_LIMIT}). Nothing was truncated.`);
 const warnings=[...(relations.warnings??[])];
 // All independent reads enter the existing four-slot coordinator. Result
 // order follows the owner, not completion order; one unavailable neighbour
 // does not destroy the successfully read locus.
 const returned=await Promise.all(admitted.map(async ref=>{
  const node=graphNodes.get(ref),target=ref===locus.ref?root:node&&address(node);
  if(!node||!target){warnings.push(`No native readable address: ${ref}`);return undefined;}
  try{
   const reading=await knowledge<KnowledgeReading>(transport,project,{action:'read',address:target});
   if(reading.resource!==ref)throw new Error('Native read returned a different subject');
   const source=target.kind==='source'&&reading.revision?{ref:reading.resource,revision:reading.revision,availability:'available' as const}:undefined;
   return {node:{...node,address:target,native_owner:reading.provider??node.native_owner,provenance:{source:reading.authority,revision:reading.revision,detail:reading.evidence}},reading,...(source?{sources:[source]}:{})} as LocalMember;
  }catch(error){warnings.push(`${ref}: ${String(error)}`);return undefined;}
 }));
 const members=returned.filter((member):member is LocalMember=>member!==undefined),refs=new Set(members.map(member=>member.node.ref));
 if(!refs.has(locus.ref))throw new Error(`Native local whole did not return a readable locus: ${locus.ref}`);
 const edges=relations.edges.filter(edge=>refs.has(edge.from)&&refs.has(edge.to));
 const seen=new Set<string>();
 const ownerRelations=edges.flatMap(edge=>{
  if(!edge.reference||seen.has(edge.reference))return [];
  const revision=typeof edge.origin==='object'?edge.origin?.revision:undefined;
  if(!revision)return [];
  seen.add(edge.reference);
  const evidence=edge.authored_relation;
  const provenance:ReadingRef[]=evidence?.source_revision?[{ref:evidence.source_ref,revision:evidence.source_revision,availability:'available'}]:[];
  // A source edit after the relation reading must not present the old assertion
  // as a current relation over new bytes. Keep the tuple, disclose stale binding.
  if(evidence&&members.some(member=>member.reading.resource===evidence.source_ref&&member.reading.revision!==evidence.source_revision)){
   warnings.push(`Relation ${edge.reference} has a changed source basis; refresh before binding it.`);return [];
  }
  return [{from:edge.from,to:edge.to,relation:{ref:edge.reference,revision,availability:'available' as const},provenance}];
 });
 return {locus:locus.ref,members,edges,ownerRelations,truncated:relations.truncated||members.length!==admitted.length,warnings,pinned:pins.map(node=>node.ref).filter(ref=>refs.has(ref)),grammar:validateParticipation(participation,members),relationBindingsUnavailable:edges.length-ownerRelations.length};
}

function rr(member:LocalMember):ReadingRef{return {ref:member.reading.resource,revision:member.reading.revision??"revision-unavailable",availability:member.reading.revision?"available":"unavailable"};}
function source(ref:string):ReadingRef{return {ref,revision:"revision-unavailable",availability:"unavailable"};}
function binding(member:LocalMember):SubjectBinding{return {subject_ref:member.node.subject_ref??member.node.ref,native_owner:member.reading.provider??member.node.native_owner,presentation_role:"thing",sources:member.sources??(member.reading.evidence.length?member.reading.evidence.map(source):[source(member.reading.resource)]),readings:[rr(member),...(member.frameReading?[member.frameReading]:[]),...(member.registerReading?[member.registerReading]:[])],actions:[]};}
function glyph(member:LocalMember,whole:LocalWhole){if(whole.grammar.state==="applied"){const role=whole.grammar.participation.members.find(m=>m.canonical_ref===member.node.ref)?.role;if(role==="direct")return "◐";if(role==="conjugate")return "◑";return whole.grammar.participation.form==="pair"?"◒":whole.grammar.participation.form==="triad"?"△":whole.grammar.participation.form==="whole"?"◎":"✦";}return member.node.kind.startsWith("wiki")?"○":member.node.kind==="file"?"□":"·";}
// New managed members fit the native stage's 400-unit camera. One subject
// stays central; a bounded ring leaves space between multiple glyphs as the
// local whole grows. This is initial presentation only: existing parameters
// (including human layout and automation) are never rewritten on refresh.
export async function projectionChanges(document:ExpressionDocument,whole:LocalWhole){
 const expressionRef=document.expression_ref,sceneRef=`${expressionRef}:scene:knowledge`,prefix=`${expressionRef}:entity:k-`,ids=new Map<string,string>();for(const member of whole.members){const id=await knowledgeEntityRef(expressionRef,member.node.ref);if([...ids.values()].includes(id))throw new Error("Knowledge member identity collision");ids.set(member.node.ref,id);}
 const changes:Change[]=[];
 const relationPrefix=`${expressionRef}:relation:k-`;
 const ownerRelations=await Promise.all((whole.ownerRelations??[]).map(async relation=>({binding_ref:`${relationPrefix}${await digest(relation.relation.ref)}`,relation:relation.relation,from_entity_ref:ids.get(relation.from)!,to_entity_ref:ids.get(relation.to)!,provenance:relation.provenance})));
 if(ownerRelations.some(relation=>!relation.from_entity_ref||!relation.to_entity_ref)||new Set(ownerRelations.map(relation=>relation.binding_ref)).size!==ownerRelations.length)throw new Error("Owner relation identities or endpoints are not unique in the bounded whole");
 // Removals are authoritative only when the owner reading was complete — not
 // truncated by the bounded render window. A partial page never deletes an
 // unseen managed member or a relation it simply did not disclose (F07).
 const complete=whole.truncated===false;
 if(complete)for(const relation of Object.values(document.relations))if(relation.binding_ref.startsWith(relationPrefix)&&!ownerRelations.some(next=>next.binding_ref===relation.binding_ref))changes.push({change:"relation_remove",binding_ref:relation.binding_ref});
 const scene=document.scenes.find(s=>s.scene_ref===sceneRef);if(!scene)changes.push({change:"scene_create",scene_ref:sceneRef,title:"Knowledge"});const wanted=new Set(ids.values());if(complete)for(const entity of Object.values(document.entities))if(entity.entity_ref.startsWith(prefix)&&!wanted.has(entity.entity_ref)){if(document.scenes.some(s=>s.scene_ref!==sceneRef&&s.entity_refs.includes(entity.entity_ref)))throw new Error("Managed knowledge member is reused outside its bounded scene");changes.push({change:"entity_remove",entity_ref:entity.entity_ref});}
 whole.members.forEach((member,index)=>{const entity_ref=ids.get(member.node.ref)!,existing=document.entities[entity_ref];if(existing&&existing.subject?.subject_ref!==(member.node.subject_ref??member.node.ref))throw new Error("Managed knowledge member changed outside its source binding");if(!existing)changes.push({change:"entity_add",scene_ref:sceneRef,entity_ref,title:member.node.label});const next=binding(member);if(!existing||JSON.stringify(existing.subject)!==JSON.stringify(next))changes.push({change:"subject_bind",entity_ref,binding:next});const count=whole.members.length,angle=index*Math.PI*2/Math.max(1,count),radius=count===1?0:180,size=count===1?.85:Math.max(.05,Math.min(.5,Math.sin(Math.PI/count)*.5)),values={glyph:glyph(member,whole),x:member.initialPosition?.x??Math.cos(angle)*radius,y:member.initialPosition?.y??Math.sin(angle)*radius,z:member.initialPosition?.z??0,scale:size*(count>1&&member.node.ref===whole.locus?1.1:1),share:member.node.ref===whole.locus?1:.65};for(const [parameter,value] of Object.entries(values))if(!existing)changes.push({change:"parameter_set",entity_ref,parameter,value});});for(const binding of ownerRelations)if(JSON.stringify(document.relations[binding.binding_ref])!==JSON.stringify(binding))changes.push({change:"relation_bind",binding});const existingRefs=scene?.entity_refs??[];const disclosedRefs=whole.members.map(m=>ids.get(m.node.ref)!);
 // A complete reading composes the scene as the full disclosed set plus the
 // non-managed entities. A truncated one keeps the existing composition and
 // only appends genuinely new disclosed members, so unseen managed members
 // keep their place rather than being dropped from the scene (F07).
 const ordered=complete?[...disclosedRefs,...existingRefs.filter(ref=>!ref.startsWith(prefix))]:[...existingRefs,...disclosedRefs.filter(ref=>!existingRefs.includes(ref))];if(!scene||JSON.stringify(scene.entity_refs)!==JSON.stringify(ordered))changes.push({change:"scene_compose",scene_ref:sceneRef,entity_refs:ordered});const focus=ids.get(whole.locus)!;if(document.selection.scene_ref!==sceneRef||document.selection.entity_ref!==focus)changes.push({change:"focus",scene_ref:sceneRef,entity_ref:focus});return changes;
}
async function expression(transport:KernelTransportStatus,request:ExpressionRequest){const r=await kernelOp(transport,{op:"expression",request});if(r.error||r.outcome?.result!=="expression")throw new Error(r.error??"Expression application unavailable");return r.outcome.data;}
/** The one native signal that an expression has never been created. The kernel
 * inspect owner returns exactly this when the document is not open
 * (kernel/src/expression.rs document()). Only this explicit absence justifies
 * creation; any other inspect failure — denied, offline, incompatible — must
 * surface unchanged. */
function isExpressionAbsent(error:unknown):boolean{return /expression is not open/i.test(error instanceof Error?error.message:String(error));}
export async function projectProvidedLocalWhole(transport:KernelTransportStatus,surface:string,title:string,whole:LocalWhole,signal?:AbortSignal):Promise<ProjectionOutcome>{
 try{
  signal?.throwIfAborted();
  const expression_ref=await knowledgeExpressionRef(surface);
  signal?.throwIfAborted();
  const capability=await expression(transport,{operation:'capabilities'});
  const budget=(capability.composition_budget as {scene_members?:number}|undefined)?.scene_members??10;
  if(whole.members.length>budget)return {state:'unavailable',whole,detail:`The installed Expression owner admits ${budget} scene members; this whole has ${whole.members.length}. Integrate the constructive Expression owner before composing it; no members were discarded.`};
  let result:ExpressionResult;
  try{result=await expression(transport,{operation:"inspect",expression_ref});}
  catch(inspectError){
   // Create only on the owner's explicit absence. A denied, offline or
   // incompatible inspect must surface, not enter a create path meant for a
   // document that has never existed (F08).
   if(!isExpressionAbsent(inspectError))throw inspectError;
   signal?.throwIfAborted();
   result=await expression(transport,{operation:"create",expression_ref,title:`Knowledge · ${title}`,actor:"human:knowledge-expression"});
  }
  signal?.throwIfAborted();
  if(!result.document)return {state:"unavailable",whole,detail:"Expression application returned no document."};
  const changes=await projectionChanges(result.document,whole);
  signal?.throwIfAborted();
  if(changes.length===0)return {state:"ready",document:result.document,whole};
  // Each native edit is bounded and revision checked. On a failed/lost response
  // return the real failure; do not replay earlier acknowledged edit batches.
  for(let offset=0;offset<changes.length;offset+=240){
   signal?.throwIfAborted();
   result=await expression(transport,{operation:'edit',expression_ref,expected_revision:result.document!.revision,actor:'human:knowledge-expression',changes:changes.slice(offset,offset+240)});
   if(result.state==='revision_conflict')return {state:'revision_conflict',whole,result};
   if(!result.document)return {state:'unavailable',whole,detail:'Expression edit did not return its acknowledged document. Reopen the working composition before continuing.'};
  }
  return result.document?{state:"ready",document:result.document,whole}:{state:"unavailable",whole,detail:`Expression projection refused: ${result.state??"no result"}`};
 }catch(error){return {state:"unavailable",whole,detail:String(error)};}
}
export async function projectLocalWhole(transport:KernelTransportStatus,project:string|undefined,surface:string,locus:GraphNode,pins:GraphNode[]=[],participation?:OwnerParticipation,rootAddress?:KnowledgeAddress):Promise<ProjectionOutcome>{let whole:LocalWhole;try{whole=await readLocalWhole(transport,project,locus,pins,participation,rootAddress);}catch(e){return {state:"unavailable",detail:String(e)};}return projectProvidedLocalWhole(transport,surface,locus.label,whole);}
