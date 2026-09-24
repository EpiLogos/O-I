/** Research Canvas presentation of native owner readings. No repository or
 * semantic record is minted here. Layout coordinates belong to the view. */
import type {CanvasNode,CanvasEdge} from '@research-canvas/schema';
import type {PlacesRepository,LocatedGraphNode} from '@research-canvas/domain';
import type {TimelineRepository} from '@research-canvas/desktop-api';
import {bundleFromTechneReadings,type TechneReadingLite} from '../../vendor/research-canvas/packages/desktop-api/src/techneBundle';
import {createTechneTransport} from '../../vendor/research-canvas/packages/desktop-api/src/techneTransport';
import type {TimelineDataSource} from '../../vendor/research-canvas/components';
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
export function nativeInstrumentCanvas(view:KernelConversion,sceneId:string):InstrumentCanvas {
 const scene=view.journey.scenes.find(s=>s.id===sceneId),binding=view.bindings[sceneId];
 if(!scene||!binding)throw new Error('The selected Scene has no native occurrence binding');
 const key=`${view.document.expression_ref}/${binding.scene_ref}`,occurrences=new Map(binding.occurrences.map(o=>[o.entity_ref,o.view_entity_id]));
 const byView=new Map(binding.occurrences.map(o=>[o.view_entity_id,o]));
 const nodes=scene.entities.map(entity=>{
  const occurrence=byView.get(entity.id);
  if(!occurrence)throw new Error('The current composition has unsaved entities; save it before opening the native canvas');
  const native=view.document.entities[occurrence.entity_ref];
  if(!native)throw new Error('The native entity is absent from this composition');
  const node=note(native.entity_ref,key,entity.name,occurrence.subject?.subject_ref??'',entity.position.x*CANVAS_UNITS,-entity.position.y*CANVAS_UNITS);
  if(node.type==='note')node.content=JSON.stringify([{type:'paragraph',content:[{type:'text',text:entity.text,styles:{}}]}]);
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
  return edge(r.binding_ref,key,r.from_entity_ref,r.to_entity_ref,label);
 });
 return {key,nodes,edges,sceneId,occurrences,title:scene.name,hiddenCount:binding.hidden_refs.length};
}
export function readInstrumentReading(raw:unknown):TechneReadingLite {
 const value=raw as TechneReadingLite;
 if(!value||value.contract!=='ql.techne/v1'||typeof value.reading_ref!=='string'||!value.reading_ref||!value.subject?.subject_ref||!value.subject.native_owner||!Array.isArray(value.disclosure?.instruments))throw new Error('The native host did not return a ql.techne/v1 reading');
 return value;
}
export async function readingInstruments(raw:unknown) {
 const reading=readInstrumentReading(raw),bundle=bundleFromTechneReadings([reading]),transport=createTechneTransport(bundle);
 const joined=await transport.loadCanvasView({canvasId:bundle.canvases[0].canvasId,lens:'canvas',databasePath:''});
 const canvas:InstrumentCanvas={key:joined.canvasId,title:reading.subject.subject_ref,occurrences:new Map(),hiddenCount:0,
  nodes:joined.nodes.map(({node,layout})=>({...note(node.graphNodeId,joined.canvasId,node.title,node.summary??'',layout.positionX,layout.positionY),graph:node})),
  edges:joined.edges.map(e=>edge(e.id,joined.canvasId,e.sourceGraphNodeId,e.targetGraphNodeId,e.relationKind))};
 const workspaceId=bundle.workspaceId;
 const dataSource:TimelineDataSource={
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
  async getGeographyEdges(scope){assertScope(scope);return [];},
  async getArchetypeExpressionsForPlace(scope,ref){assertScope(scope);if(!bundle.nodes.some(n=>n.graphNodeId===ref&&n.place))throw new Error('This place is absent from the reading');return [];},
  async getRelatedNodesForPlace(scope,ref){assertScope(scope);const result=await dataSource.expandNode!(ref);return result.neighbours;},
 };
 return {reading,bundle,canvas,dataSource,timeline,places};
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
