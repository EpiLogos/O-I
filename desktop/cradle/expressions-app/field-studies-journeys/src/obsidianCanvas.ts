/** lane-1 B2 — Obsidian `.canvas` interchange. The format is the documented
 * JSON Canvas that Obsidian reads and writes: nodes {id, type text|file|link|
 * group, x, y, width, height, …}, edges {id, fromNode, toNode, fromSide,
 * toSide, …}. Extra keys are preserved by Obsidian and carry the native
 * identity this export adds. Pure: no DOM, no store, no native write. The
 * caller performs the one import through the existing material actions. */
import {embedUrlRecord} from './canvasEmbeds.js';

export type ObsidianSide='top'|'right'|'bottom'|'left';
export type ObsidianNodeType='text'|'file'|'link'|'group';
export interface ObsidianCanvasNode {id:string;type:ObsidianNodeType;x:number;y:number;width:number;height:number;text?:string;file?:string;url?:string;label?:string;[extra:string]:unknown}
/** `oi.relation` is the native relation's identity: every edge that stands for a semantic relation carries it. */
export interface ObsidianCanvasEdge {id:string;fromNode:string;toNode:string;fromSide?:ObsidianSide;toSide?:ObsidianSide;label?:string;oi?:{relation:string;kind?:string};[extra:string]:unknown}
/** The export header: what the Canvas held that a `.canvas` file cannot carry. */
export interface ObsidianExportHeader {format:'oi.canvas-export/v1';note:string;dropped:string[]}
export interface ObsidianCanvasDocument {nodes:ObsidianCanvasNode[];edges:ObsidianCanvasEdge[];oi?:ObsidianExportHeader;[extra:string]:unknown}

const SIDES:readonly string[]=['top','right','bottom','left'];
const NODE_TYPES:readonly string[]=['text','file','link','group'];
const MAX_BYTES=4*1024*1024;
const MAX_NODES=1000;
const FRAME_PADDING=24;

/** The one refusal shape for a `.canvas` that cannot be read: the message always names the file format. */
export class ObsidianCanvasError extends Error {
 constructor(reason:string){super(`Invalid .canvas file: ${reason}`);this.name='ObsidianCanvasError';}
}

/** What the lens hands the exporter: its rendered cards, its native relations and its frames. Plain data only. */
export interface CanvasExportNode {id:string;kind:'note'|'image'|'embed'|'media'|'sticky'|'shape'|'text'|'resource'|'other';title:string;text?:string;url?:string;file?:string;x:number;y:number;width:number;height:number}
export interface CanvasExportEdge {id:string;fromNode:string;toNode:string;fromSide?:ObsidianSide;toSide?:ObsidianSide;relationKind?:string}
export interface CanvasExportFrame {id:string;label:string;title?:string;memberIds:string[]}
export interface CanvasExportInput {nodes:CanvasExportNode[];edges:CanvasExportEdge[];frames:CanvasExportFrame[]}

function uniqueId(id:string,taken:Set<string>):string{
 let next=id||'node';let n=2;
 while(taken.has(next))next=`${id}-${n++}`;
 taken.add(next);return next;
}

/** Export the composed scene as one `.canvas` document. Every degradation is
 * named once in the header's `dropped` list, so nothing is lost silently. */
export function exportObsidianCanvas(input:CanvasExportInput):{document:ObsidianCanvasDocument;json:string;dropped:string[]} {
 const dropped=new Set<string>();
 const taken=new Set<string>();
 const nodeIds=new Map<string,string>();
 const nodes:ObsidianCanvasNode[]=[];
 const boxes=new Map<string,{x:number;y:number;width:number;height:number}>();
 for(const node of input.nodes){
  const id=uniqueId(node.id,taken);nodeIds.set(node.id,id);
  const box={x:node.x,y:node.y,width:node.width,height:node.height};boxes.set(node.id,box);
  const common={id,x:box.x,y:box.y,width:box.width,height:box.height};
  if(node.kind==='embed'&&node.url&&embedUrlRecord(node.url)!==null){nodes.push({...common,type:'link',url:node.url});continue;}
  if(node.kind==='media'&&node.file){nodes.push({...common,type:'file',file:node.file});continue;}
  if(node.kind==='image')dropped.add('image pixels are not carried: an image card is exported as a text node with its caption');
  if(node.kind==='media')dropped.add('a media card without a file path is exported as a text node');
  if(node.kind==='embed')dropped.add('a link card without a valid https address is exported as a text node');
  if(node.kind==='shape')dropped.add('shape geometry and fill are not carried: a shape is exported as a text node');
  if(node.kind==='sticky')dropped.add('sticky colour keys are not carried: a sticky is exported as a text node');
  if(node.kind==='resource')dropped.add('a native source is exported as a text node naming its path');
  const body=node.kind==='note'&&node.text?node.text:node.kind==='resource'&&node.file?`${node.title}\n\n${node.file}`:node.title;
  nodes.push({...common,type:'text',text:body||node.title||'Untitled'});
 }
 const groups:ObsidianCanvasNode[]=[];
 for(const frame of input.frames){
  const members=frame.memberIds.map(ref=>boxes.get(ref)).filter((box):box is {x:number;y:number;width:number;height:number}=>!!box);
  if(!members.length){dropped.add('a frame with no exported member is not exported');continue;}
  const left=Math.min(...members.map(b=>b.x))-FRAME_PADDING,top=Math.min(...members.map(b=>b.y))-FRAME_PADDING;
  const right=Math.max(...members.map(b=>b.x+b.width))+FRAME_PADDING,bottom=Math.max(...members.map(b=>b.y+b.height))+FRAME_PADDING;
  groups.push({id:uniqueId(`frame-${frame.id}`,taken),type:'group',x:left,y:top,width:right-left,height:bottom-top,label:frame.title?.trim()||frame.label});
 }
 const edges:ObsidianCanvasEdge[]=[];
 for(const edge of input.edges){
  const fromNode=nodeIds.get(edge.fromNode),toNode=nodeIds.get(edge.toNode);
  if(!fromNode||!toNode){dropped.add('a relation whose card is not exported is not exported');continue;}
  const out:ObsidianCanvasEdge={id:uniqueId(`edge-${edge.id}`,taken),fromNode,toNode,label:edge.relationKind?`${edge.relationKind} (${edge.id})`:edge.id,oi:{relation:edge.id,...(edge.relationKind?{kind:edge.relationKind}:{})}};
  if(edge.fromSide&&SIDES.includes(edge.fromSide))out.fromSide=edge.fromSide;
  if(edge.toSide&&SIDES.includes(edge.toSide))out.toSide=edge.toSide;
  edges.push(out);
 }
 const header:ObsidianExportHeader={format:'oi.canvas-export/v1',note:'Frames are group nodes. Each relation is an edge whose label names it and whose oi.relation is its native identity. Cards are text nodes, link cards are link nodes, media cards are file nodes.',dropped:[...dropped]};
 const document:ObsidianCanvasDocument={nodes:[...groups,...nodes],edges,oi:header};
 return {document,json:`${JSON.stringify(document,null,1)}\n`,dropped:header.dropped};
}

/** Read a `.canvas` file, refusing anything that is not a readable canvas with a named reason. */
export function parseObsidianCanvas(text:string):ObsidianCanvasDocument {
 if(typeof text!=='string')throw new ObsidianCanvasError('the file has no text');
 if(text.length>MAX_BYTES)throw new ObsidianCanvasError('the file is larger than 4 MiB');
 let value:unknown;
 try{value=JSON.parse(text);}catch(error){throw new ObsidianCanvasError(`the file is not valid JSON (${error instanceof Error?error.message:String(error)})`);}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ObsidianCanvasError('the top level must be an object');
 const doc=value as Record<string,unknown>;
 const nodes=doc.nodes??[],edges=doc.edges??[];
 if(!Array.isArray(nodes))throw new ObsidianCanvasError('"nodes" must be a list');
 if(!Array.isArray(edges))throw new ObsidianCanvasError('"edges" must be a list');
 if(nodes.length>MAX_NODES)throw new ObsidianCanvasError(`the canvas holds more than ${MAX_NODES} nodes`);
 const nodeIds=new Set<string>();
 nodes.forEach((raw,index)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ObsidianCanvasError(`node ${index+1} is not an object`);
  const node=raw as Record<string,unknown>;
  const id=node.id;
  if(typeof id!=='string'||!id)throw new ObsidianCanvasError(`node ${index+1} has no id`);
  if(nodeIds.has(id))throw new ObsidianCanvasError(`node id "${id}" is used twice`);
  nodeIds.add(id);
  if(typeof node.type!=='string'||!NODE_TYPES.includes(node.type))throw new ObsidianCanvasError(`node "${id}" has unknown type ${JSON.stringify(node.type)}`);
  for(const key of ['x','y']){const at=node[key];if(typeof at!=='number'||!Number.isFinite(at))throw new ObsidianCanvasError(`node "${id}" needs a numeric ${key}`);}
  for(const key of ['width','height']){const size=node[key];if(typeof size!=='number'||!Number.isFinite(size)||size<0)throw new ObsidianCanvasError(`node "${id}" needs a non-negative ${key}`);}
  if(node.type==='text'&&typeof node.text!=='string')throw new ObsidianCanvasError(`text node "${id}" needs its text`);
  if(node.type==='file'&&(typeof node.file!=='string'||!node.file))throw new ObsidianCanvasError(`file node "${id}" needs its file path`);
  if(node.type==='link'&&(typeof node.url!=='string'||!/^https?:\/\//i.test(node.url)))throw new ObsidianCanvasError(`link node "${id}" needs an http or https url`);
 });
 const edgeIds=new Set<string>();
 edges.forEach((raw,index)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ObsidianCanvasError(`edge ${index+1} is not an object`);
  const edge=raw as Record<string,unknown>;
  const id=edge.id;
  if(typeof id!=='string'||!id)throw new ObsidianCanvasError(`edge ${index+1} has no id`);
  if(edgeIds.has(id))throw new ObsidianCanvasError(`edge id "${id}" is used twice`);
  edgeIds.add(id);
  for(const key of ['fromNode','toNode']){const end=edge[key];if(typeof end!=='string'||!nodeIds.has(end))throw new ObsidianCanvasError(`edge "${id}" ends at ${key} ${JSON.stringify(end)}, which is not a node of this canvas`);}
  for(const key of ['fromSide','toSide']){const side=edge[key];if(side!==undefined&&(typeof side!=='string'||!SIDES.includes(side)))throw new ObsidianCanvasError(`edge "${id}" has an unknown ${key} ${JSON.stringify(side)}`);}
 });
 return {...doc,nodes:nodes as ObsidianCanvasNode[],edges:edges as ObsidianCanvasEdge[]};
}

/** What an import will make of a parsed canvas, in the Scene's own vocabulary. Coordinates stay in the canvas's own units. */
export interface ImportCard {key:string;kind:'note'|'embed';title:string;text?:string;url?:string;x:number;y:number;width:number;height:number}
export interface ImportFrame {label:string;title?:string;memberKeys:string[]}
/** A connection between two imported cards. Its ends are card keys; sides are the canvas's own. */
export interface ImportEdge {key:string;fromKey:string;toKey:string;relationKind:string;fromSide?:ObsidianSide;toSide?:ObsidianSide}
export interface ImportPlan {cards:ImportCard[];frames:ImportFrame[];edges:ImportEdge[];skipped:string[]}

/** Plans the import: text and file nodes become note cards, link nodes become link cards, groups become frames over the cards inside them. */
export function planObsidianImport(doc:ObsidianCanvasDocument):ImportPlan {
 const cards:ImportCard[]=[],skipped=new Set<string>();
 const keys=new Set<string>();
 const groupIds=new Set(doc.nodes.filter(node=>node.type==='group').map(node=>node.id));
 const groups:ObsidianCanvasNode[]=[];
 for(const node of doc.nodes){
  if(node.type==='group'){groups.push(node);continue;}
  if(node.type==='link'){
   if(node.url&&embedUrlRecord(node.url)!==null){
    cards.push({key:node.id,kind:'embed',title:node.label||'Link',url:node.url,x:node.x,y:node.y,width:node.width,height:node.height});keys.add(node.id);
   }else skipped.add(`link "${node.url}" is not an address this canvas can hold as a link card`);
   continue;
  }
  const text=node.type==='text'?String(node.text??''):`File: ${node.file}`;
  if(node.type==='file')skipped.add('file nodes are imported as note cards naming their path (the file itself is not copied)');
  const first=text.split('\n').map(line=>line.trim()).find(Boolean)??'Note';
  cards.push({key:node.id,kind:'note',title:first.slice(0,120),text,x:node.x,y:node.y,width:node.width,height:node.height});keys.add(node.id);
 }
 const frames:ImportFrame[]=[];
 for(const group of groups){
  const inside=cards.filter(card=>card.x>=group.x&&card.y>=group.y&&card.x+card.width<=group.x+group.width&&card.y+card.height<=group.y+group.height).map(card=>card.key);
  if(!inside.length){skipped.add(`group "${group.label??group.id}" holds no card, so it is not imported as a frame`);continue;}
  frames.push({label:group.label?.trim()||'Imported group',title:group.label?.trim()||undefined,memberKeys:inside});
 }
 const edges:ImportEdge[]=[];
 for(const edge of doc.edges){
  const label=edge.label?.trim()||'connection';
  const named=`connection "${label.slice(0,60)}" from ${edge.fromNode} to ${edge.toNode}`;
  if(!keys.has(edge.fromNode)||!keys.has(edge.toNode)){
   const end=groupIds.has(edge.fromNode)||groupIds.has(edge.toNode)?'a frame is not a connection end':'an end is not an imported card';
   skipped.add(`${named} not imported: ${end}`);continue;
  }
  edges.push({key:edge.id,fromKey:edge.fromNode,toKey:edge.toNode,relationKind:label.slice(0,120),...(edge.fromSide?{fromSide:edge.fromSide}:{}),...(edge.toSide?{toSide:edge.toSide}:{})});
 }
 return {cards,frames,edges,skipped:[...skipped]};
}

/** A note's BlockNote content for imported text: one paragraph per line, the shape the Scene's note cards hold. */
export function noteBlocksFromText(text:string):string {
 return JSON.stringify(text.split('\n').slice(0,256).map(line=>({type:'paragraph',content:line.trim()?[{type:'text',text:line,styles:{}}]:[]})));
}
