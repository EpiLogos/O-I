/** Research Canvas presentation of native owner readings. No repository or
 * semantic record is minted here. Layout coordinates belong to the view. */
import type {CanvasNode,CanvasEdge} from '@research-canvas/schema';
import type {PlacesRepository,LocatedGraphNode} from '@research-canvas/domain';
import type {TimelineRepository} from '@research-canvas/desktop-api';
import {bundleFromTechneReadings,type TechneReadingLite} from '../../vendor/research-canvas/packages/desktop-api/src/techneBundle';
import {createTechneTransport} from '../../vendor/research-canvas/packages/desktop-api/src/techneTransport';
import type {TimelineDataSource} from '../../vendor/research-canvas/components';
import type {ResearchMaterial} from './researchMaterial.js';
import type {KernelConversion} from './kernelDocumentBridge.js';

export const CANVAS_UNITS=400;
// These timestamps describe no owner event. RC requires timestamp carriers on
// presentation records; the native source remains in graph/subject bindings.
const NO_TIME_DISCLOSED='1970-01-01T00:00:00.000Z';
export interface InstrumentCanvas {key:string;nodes:CanvasNode[];edges:CanvasEdge[];sceneId?:string;occurrences:Map<string,string>;title:string;hiddenCount:number}
function note(id:string,canvasId:string,title:string,summary:string,x:number,y:number):CanvasNode {
 return {id,graphNodeId:id,canvasId,title,summary,type:'note',content:'',tags:[],sequenceCaption:null,sequenceViewport:null,position:{x,y},size:{width:240,height:160},createdAt:NO_TIME_DISCLOSED,updatedAt:NO_TIME_DISCLOSED};
}
function edge(id:string,canvasId:string,from:string,to:string,label:string):CanvasEdge {
 return {id,canvasId,sourceNodeId:from,targetNodeId:to,relationKind:label,directionality:'forward',label,note:'',style:{stroke:'var(--muted)',width:1.5,dashed:false},sequencing:false,sequencePriority:0,createdAt:NO_TIME_DISCLOSED,updatedAt:NO_TIME_DISCLOSED};
}
export interface NativeRelationDirectionReading {binding_ref:string;relation_ref:string;relation_revision:string;direction:'directed'|'undirected'|'bidirectional'}
export function nativeInstrumentCanvas(view:KernelConversion,sceneId:string,readings:readonly NativeRelationDirectionReading[]=[]):InstrumentCanvas {
 const scene=view.journey.scenes.find(s=>s.id===sceneId),binding=view.bindings[sceneId];
 if(!scene||!binding)throw new Error('The selected Scene has no native occurrence binding');
 const key=`${view.document.expression_ref}/${binding.scene_ref}`,occurrences=new Map(binding.occurrences.map(o=>[o.entity_ref,o.view_entity_id]));
 const byView=new Map(binding.occurrences.map(o=>[o.view_entity_id,o]));
 const nodes=scene.entities.map(entity=>{
  const occurrence=byView.get(entity.id);
  if(!occurrence)throw new Error('The current composition has unsaved entities; save it before opening the native canvas');
  const native=view.document.entities[occurrence.entity_ref];
  if(!native)throw new Error('The native entity is absent from this composition');
  const node=note(native.entity_ref,key,entity.name,'',entity.position.x*CANVAS_UNITS,-entity.position.y*CANVAS_UNITS);
  const card=scene.research?.cards[entity.id];
  node.size={width:entity.size.x*CANVAS_UNITS,height:entity.size.y*CANVAS_UNITS};
  Object.assign(node,{dotColour:card?.dotColour,bgColour:card?.bgColour,textColour:card?.textColour});
  if(entity.source?.kind==='image'&&entity.source.image.dataUrl)return {...node,type:'image',src:entity.source.image.dataUrl,caption:card?.caption??entity.name} as CanvasNode;
  if(occurrence.subject)return {...node,type:'resource',resourceKind:'binary',absolutePath:occurrence.subject.subject_ref,relativePath:occurrence.subject.subject_ref,mimeType:'application/vnd.oi.source-ref',fileFingerprint:occurrence.subject.subject_ref} as CanvasNode;
  if(node.type==='note')node.content=card?.content??JSON.stringify([{type:'paragraph',content:[{type:'text',text:entity.text,styles:{}}]}]);
  return node;
 });
 const visible=new Set(nodes.map(n=>n.id));
 const edges=binding.relations.filter(r=>visible.has(r.from_entity_ref)&&visible.has(r.to_entity_ref)).map(r=>{
  // O:I's connection authoring grammar carries its chosen kind after the
  // exact binding ref. A source-owned relation keeps its disclosed vocabulary.
  const provenance=Array.isArray(r.provenance)?r.provenance as {ref?:string}[]:[];
  const type=provenance.find(source=>source.ref?.startsWith('wiki:relation-type:'))?.ref?.slice('wiki:relation-type:'.length);
  // A record identity is available in the inspector; it is not an edge title.
  let label=type??'';
  if(r.native_owner==='oi')label=r.relation.ref;
  if(r.native_owner==='oi'&&label.startsWith(r.binding_ref+':')){try{label=decodeURIComponent(label.slice(r.binding_ref.length+1));}catch{/* retain the native ref if its label is not encoded correctly */}}
  const result=edge(r.binding_ref,key,r.from_entity_ref,r.to_entity_ref,label);
  if(r.native_owner!=='oi'){
   const reading=readings.find(row=>row.binding_ref===r.binding_ref&&row.relation_ref===r.relation.ref&&row.relation_revision===r.relation.revision);
   result.directionality=reading?.direction==='directed'?'forward':reading?.direction==='bidirectional'?'bidirectional':'none';
   if(!reading){result.note='Source direction is unavailable';result.style={...result.style,dashed:true};}
  }
  return result;
 });
 return {key,nodes,edges,sceneId,occurrences,title:scene.name,hiddenCount:binding.hidden_refs.length};
}
export function readInstrumentReading(raw:unknown):TechneReadingLite {
 const value=raw as TechneReadingLite;
 if(!value||value.contract!=='ql.techne/v1'||typeof value.reading_ref!=='string'||!value.reading_ref||!value.subject?.subject_ref||!value.subject.native_owner||!Array.isArray(value.disclosure?.instruments))throw new Error('The native host did not return a ql.techne/v1 reading');
 return value;
}
/** Labels are an aperture over actual Scene occurrences. The selected
 * occurrence wins when one source appears under several authored names. */
export function nativeInstrumentTitles(view:KernelConversion,sceneId:string):ReadonlyMap<string,string> {
 const binding=view.bindings[sceneId],scene=view.document.scenes.find(row=>row.scene_ref===binding?.scene_ref),titles=new Map<string,string>();
 if(!binding||!scene)return titles;
 if(scene.title.trim())titles.set(scene.scene_ref,scene.title);
 const refs=[...binding.occurrences.map(row=>row.entity_ref),...scene.entity_refs];
 for(const ref of refs){const entity=view.document.entities[ref],subject=entity?.subject?.subject_ref;if(subject&&entity.title.trim()&&!titles.has(subject))titles.set(subject,entity.title);}
 const selected=view.document.selection?.scene_ref===scene.scene_ref?view.document.selection.entity_ref:null;
 const entity=selected&&scene.entity_refs.includes(selected)?view.document.entities[selected]:undefined;
 if(entity?.subject&&entity.title.trim())titles.set(entity.subject.subject_ref,entity.title);
 for(const relation of binding.relations){
  if(!scene.entity_refs.includes(relation.from_entity_ref)||!scene.entity_refs.includes(relation.to_entity_ref))continue;
  const from=view.document.entities[relation.from_entity_ref]?.title,to=view.document.entities[relation.to_entity_ref]?.title;
  if(from?.trim()&&to?.trim())titles.set(relation.relation.ref,`${from} · ${to}`);
 }
 return titles;
}
export interface NativeInstrumentPreview {body:string;summary:string}
/** Existing native Scene text only. This is occurrence material, never an
 * inferred source document body, synthetic summary or imported RC record. */
export function nativeInstrumentPreviews(view:KernelConversion,sceneId:string):ReadonlyMap<string,NativeInstrumentPreview>{
 const scene=view.journey.scenes.find(row=>row.id===sceneId),binding=view.bindings[sceneId],result=new Map<string,NativeInstrumentPreview>();
 if(!scene||!binding)return result;
 const nativeScene=view.document.scenes.find(row=>row.scene_ref===binding.scene_ref);
 const selected=view.document.selection?.scene_ref===binding.scene_ref?view.document.selection?.entity_ref:null;
 const occurrences=[...binding.occurrences].sort((a,b)=>Number(a.entity_ref===selected)-Number(b.entity_ref===selected));
 for(const occurrence of occurrences){
  if(!nativeScene?.entity_refs.includes(occurrence.entity_ref))continue;
  const entity=scene.entities.find(row=>row.id===occurrence.view_entity_id),native=view.document.entities[occurrence.entity_ref];
  if(!entity||!native?.subject||typeof entity.text!=='string'||!entity.text.trim())continue;
  result.set(native.subject.subject_ref,{body:entity.text,summary:entity.text.slice(0,512)});
 }
 return result;
}
function hasNativeReading(value:unknown,ref:unknown,revision:unknown):boolean{
 return Array.isArray(value)&&value.some(row=>row&&typeof row==='object'&&row.availability==='available'&&row.ref===ref&&row.revision===revision);
}
/** Validate the transient owner reading against this exact native Scene. */
export function nativeInstrumentNodeTags(raw:unknown,view:KernelConversion,sceneId:string):ReadonlyMap<string,readonly string[]> {
 const value=raw as {schema?:string;expression_ref?:string;revision?:number;scene_ref?:string;register?:{source_ref?:string;reading_ref?:string;revision?:string};node_readings?:{entity_ref:string;subject_ref:string;native_owner:string;subject_revision:string;tags:string[]}[]}|null;
 const binding=view.bindings[sceneId],scene=view.document.scenes.find(row=>row.scene_ref===binding?.scene_ref);
 if(!value||value.schema!=='oi.scene-node-readings/v1'||!binding||!scene||value.expression_ref!==view.document.expression_ref||value.revision!==view.document.revision||value.scene_ref!==binding.scene_ref||!value.register?.source_ref||!value.register.reading_ref||!value.register.revision||!Array.isArray(value.node_readings))throw Error('Node tags do not address the current native Scene and source revision.');
 const expected=scene.entity_refs.filter(ref=>view.document.entities[ref]?.subject),seen=new Set<string>(),result=new Map<string,readonly string[]>();
 if(value.node_readings.length!==expected.length)throw Error('The native node tag reading is incomplete.');
 for(const row of value.node_readings){
  const subject=row&&view.document.entities[row.entity_ref]?.subject;
  if(!row||!expected.includes(row.entity_ref)||seen.has(row.entity_ref)||!subject||row.subject_ref!==subject.subject_ref||row.native_owner!==subject.native_owner||!hasNativeReading(subject.readings,subject.subject_ref,row.subject_revision)||!hasNativeReading(subject.readings,value.register!.reading_ref,value.register!.revision)||!Array.isArray(row.tags)||row.tags.some(tag=>typeof tag!=='string'))throw Error('The native node tags changed or have no exact source binding.');
  const tags=[...new Set(row.tags)].sort(),prior=result.get(row.subject_ref);
  if(prior&&JSON.stringify(prior)!==JSON.stringify(tags))throw Error('Occurrences of one source returned conflicting native tags.');
  seen.add(row.entity_ref);result.set(row.subject_ref,tags);
 }
 return result;
}
export interface NativeSourceRelationReading {binding_ref:string;relation_ref:string;relation_revision:string;native_owner:string;from_entity_ref:string;to_entity_ref:string;from_subject_ref:string;to_subject_ref:string;relation:string}
export function nativeInstrumentSourceRelations(raw:unknown,view:KernelConversion,sceneId:string):readonly NativeSourceRelationReading[]{
 const packet=raw as {schema?:string;expression_ref?:string;revision?:number;scene_ref?:string;register?:{reading_ref?:string;revision?:string};relation_readings?:NativeSourceRelationReading[]}|null;
 const sceneRef=view.bindings[sceneId]?.scene_ref,scene=view.document.scenes.find(row=>row.scene_ref===sceneRef);
 if(!packet||packet.schema!=='oi.scene-source-relations/v1'||!scene||packet.expression_ref!==view.document.expression_ref||packet.revision!==view.document.revision||packet.scene_ref!==sceneRef||!packet.register?.reading_ref||!packet.register.revision||!Array.isArray(packet.relation_readings))throw Error('Source relations do not address the current native Scene.');
 const expected=Object.values(view.document.relations??{}).filter(row=>row.native_owner!=='oi'&&scene.entity_refs.includes(row.from_entity_ref)&&scene.entity_refs.includes(row.to_entity_ref)),seen=new Set<string>();
 if(packet.relation_readings.length!==expected.length)throw Error('The native Scene relation reading is incomplete.');
 for(const row of packet.relation_readings){
  const binding=row&&expected.find(binding=>binding.binding_ref===row.binding_ref),from=binding&&view.document.entities[binding.from_entity_ref]?.subject,to=binding&&view.document.entities[binding.to_entity_ref]?.subject;
  if(!binding||seen.has(row.binding_ref)||!from||!to||binding.native_owner!==row.native_owner||binding.relation.availability!=='available'||binding.relation.ref!==row.relation_ref||binding.relation.revision!==row.relation_revision||binding.from_entity_ref!==row.from_entity_ref||binding.to_entity_ref!==row.to_entity_ref||from.subject_ref!==row.from_subject_ref||to.subject_ref!==row.to_subject_ref||typeof row.relation!=='string'||!row.relation||[from,to].some(subject=>!hasNativeReading(subject.readings,packet.register!.reading_ref,packet.register!.revision)))throw Error('A returned native relation has changed identity, revision or endpoints.');
  seen.add(row.binding_ref);
 }
 return packet.relation_readings;
}
export async function readingInstruments(raw:unknown,titles:ReadonlyMap<string,string>=new Map(),previews:ReadonlyMap<string,NativeInstrumentPreview>=new Map(),tags:ReadonlyMap<string,readonly string[]>=new Map(),relations:readonly NativeSourceRelationReading[]=[] ) {
 const reading=readInstrumentReading(raw),bundle=bundleFromTechneReadings([reading]);
 for(const node of bundle.nodes){
  const title=titles.get(node.graphNodeId);if(title)node.title=title;
  const directTags=tags.get(node.graphNodeId);if(directTags)node.evidenceTags=[...directTags];
  const directPreview=previews.get(node.graphNodeId);if(directPreview){node.body=directPreview.body;node.summary=directPreview.summary;}
  const source=reading.provenance?.find(row=>{const selector=row.selector as {unit?:string;kind?:string;value?:string}|undefined;return selector?.unit==='other'&&['techne-temporal-facet','techne-spatial-facet'].includes(selector.kind??'')&&selector.value===node.graphNodeId;});
  if(source){
   node.sourceCoordinates=[source.source_ref];
   const sourceTags=tags.get(source.source_ref);if(sourceTags)node.evidenceTags=[...sourceTags];
   const preview=previews.get(source.source_ref);if(preview){node.body=preview.body;node.summary=preview.summary;}
   if((source.selector as {kind?:string})?.kind==='techne-spatial-facet'){const facet=reading.spatial?.find(row=>row.place_ref===node.graphNodeId);node.title=facet?.identity?.names?.[0]?.name??titles.get(source.source_ref)??'Location';continue;}
   const relation=(reading.whole?.relations??[]).find(row=>(row as typeof row&{relation_ref?:string}).relation_ref===source.source_ref);
   const nativeTitle=titles.get(source.source_ref)??(relation?[titles.get(relation.from_ref),relation.relation,titles.get(relation.to_ref)].filter(Boolean).join(' · '):undefined);
   node.title=nativeTitle??'Dated source';
  }
 }
 // Replace only ql whole relation projections with their complete native
 // binding reading. Dates and places remain separate presentation records.
 if(relations.length){
  bundle.relationships=bundle.relationships.filter(row=>!Object.prototype.hasOwnProperty.call(row.properties,'relation_origin'));
  for(const relation of relations){
   if(!bundle.nodes.some(node=>node.graphNodeId===relation.from_subject_ref)||!bundle.nodes.some(node=>node.graphNodeId===relation.to_subject_ref))throw Error('A native relation endpoint is absent from the current reading.');
   bundle.relationships.push({id:relation.binding_ref,sourceGraphNodeId:relation.from_subject_ref,targetGraphNodeId:relation.to_subject_ref,relType:relation.relation,properties:{native_relation_ref:relation.relation_ref,native_relation_revision:relation.relation_revision,native_owner:relation.native_owner,from_entity_ref:relation.from_entity_ref,to_entity_ref:relation.to_entity_ref}});
  }
  for(const canvas of bundle.canvases)canvas.relationshipIds=bundle.relationships.map(row=>row.id);
 }
 const transport=createTechneTransport(bundle);
 const joined=await transport.loadCanvasView({canvasId:bundle.canvases[0].canvasId,lens:'canvas',databasePath:''});
 const canvas:InstrumentCanvas={key:joined.canvasId,title:reading.subject.subject_ref,occurrences:new Map(),hiddenCount:0,
  nodes:joined.nodes.map(({node,layout})=>({...note(node.graphNodeId,joined.canvasId,node.title,node.summary??'',layout.positionX,layout.positionY),graph:node})),
  edges:joined.edges.map(e=>edge(e.id,joined.canvasId,e.sourceGraphNodeId,e.targetGraphNodeId,e.relationKind))};
 const workspaceId=bundle.workspaceId;
 const capabilities={geographyEdges:{available:false,reason:'This source does not disclose movement routes. Select a source with native route records.'},archetypalExpressions:{available:false,reason:'This source does not disclose dated archetype/place assertions.'}};
 const dataSource:TimelineDataSource={
  styleCapability:{available:false,reason:"Timeline colours have no native Scene write mapping; position and size remain editable."},
  archetypeCapability:{available:false,reason:"This native reading does not carry archetype classification or dated archetype/place assertions."},
  loadTimelineView:(range,filters)=>transport.loadTimelineView({workspaceId,range,filters}),
  loadNode:graphNodeId=>transport.readGraphNode({graphNodeId}),
  archetypalLighting:operatorGraphNodeId=>transport.archetypalLighting({operatorGraphNodeId}),
  resonancesForInstance:graphNodeId=>transport.resonancesForInstance({graphNodeId}),
  relationFieldForEvent:graphNodeId=>transport.loadTimelineRelationField!({workspaceId,graphNodeId}),
  expandNode:graphNodeId=>transport.expandTimelineNode({workspaceId,graphNodeId}),
  // No accept-and-hold layout or semantic writes: those require a real native owner.
 };
 const timeline:TimelineRepository={async getTimelineWalk(scope,range){
  if(scope!==reading.subject.subject_ref)throw new Error('Timeline request does not address this reading');
  const view=await dataSource.loadTimelineView(range);
  return {earthboundNodes:view.nodes.map(({node,anchor})=>({graphNodeId:node.graphNodeId,title:node.title,date:anchor.validFrom,precision:anchor.precision,entityType:node.entityType,placeName:null,x:Number(/^(-?\d+)/.exec(anchor.validFrom)?.[1]),colorTag:null})).filter(n=>Number.isFinite(n.x)),archetypeLayers:[]};
 }};
 const assertScope=(scope:string)=>{if(scope!==reading.subject.subject_ref)throw new Error('Place request does not address this reading');};
 const places:PlacesRepository={
  async getLocatedNodes(scope){assertScope(scope);return (await transport.listLocatedGraphNodes()).filter((n):n is LocatedGraphNode=>n.place!==null);},
  async getGeographyEdges(scope){assertScope(scope);if(!capabilities.geographyEdges.available)return [];throw new Error('A movement-route owner is required');},
  async getArchetypeExpressionsForPlace(scope,ref){assertScope(scope);if(!bundle.nodes.some(n=>n.graphNodeId===ref&&n.place))throw new Error('This place is absent from the reading');return [];},
  async getRelatedNodesForPlace(scope,ref){assertScope(scope);const result=await dataSource.expandNode!(ref);return result.neighbours;},
 };
 return {reading,bundle,canvas,dataSource,timeline,places,capabilities};
}

/** The Expression material is plain text. Rich note structures must not be
 * silently flattened into a glyph or mistaken for a source-body mutation. */
export function expressionTextFromNote(content:string):string {
 const blocks:unknown=JSON.parse(content);
 if(!Array.isArray(blocks))throw new Error('Expression text requires paragraph blocks');
 return blocks.map((raw:any)=>{
  if(!raw||raw.type!=='paragraph'||raw.children?.length||!Array.isArray(raw.content))throw new Error('This Expression accepts plain text paragraphs only');
  return raw.content.map((part:any)=>{if(part.type!=='text'||typeof part.text!=='string'||Object.keys(part.styles??{}).length)throw new Error('Rich text needs its source editor; the Expression was not changed');return part.text;}).join('');
 }).join('\n');
}

/** A host-wide reading cannot lend dates or places to unrelated construction. */
export function assertInstrumentReadingScope(raw:unknown,view:KernelConversion|undefined,sceneId:string):void {
 if(!view)return;
 const reading=readInstrumentReading(raw),binding=view.bindings[sceneId];
 if(!binding)throw new Error('The selected Scene has no native source binding');
 const selected=view.document.selection?.scene_ref===binding.scene_ref?view.document.selection.entity_ref:null;
 const refs=selected?[selected]:binding.member_refs;
 const subjects=new Set([view.document.expression_ref,...refs.map(ref=>view.document.entities[ref]?.subject?.subject_ref).filter((ref):ref is string=>!!ref)]);
 const bound=(reading.expressions??[]).some(entry=>entry.expression_ref===view.document.expression_ref&&entry.scene_ref===binding.scene_ref&&entry.revision===String(view.document.revision));
 if(!bound&&!subjects.has(reading.subject.subject_ref))throw new Error('No source reading is bound to this construction for this instrument');
}
