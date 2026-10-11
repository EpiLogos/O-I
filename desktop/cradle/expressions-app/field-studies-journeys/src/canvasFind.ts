import type {InstrumentCanvas} from './researchInstrumentsData';
import {blockNoteSummary} from '../../vendor/research-canvas/packages/node-document/src/summary';
import type {ResearchFrame} from './researchMaterial';
export interface CanvasFindTarget {key:string;canvas_key:string;kind:'occurrence'|'frame';ref:string;label:string;text:string;node_ids:string[]}
const normalized=(text:string)=>text.normalize('NFKC').toLocaleLowerCase();
function noteText(content:string):string {
 try{const blocks:unknown=JSON.parse(content);if(!Array.isArray(blocks))return '';
  const text:string[]=[],visit=(rows:unknown[],depth:number)=>{if(depth>24)return;for(const row of rows){if(!row||typeof row!=='object')continue;text.push(blockNoteSummary(JSON.stringify([row]),65536));const children=(row as {children?:unknown}).children;if(Array.isArray(children))visit(children,depth+1);}};visit(blocks,0);return text.join('\n');
 }catch{return '';}
}
/** Search is a projection over actual occurrences and authored frame rows.
 * A frame never gains an entity ref; its exact surviving members are shown. */
export function canvasFindTargets(canvas:InstrumentCanvas,frames:Readonly<Record<string,ResearchFrame>>={}):CanvasFindTarget[]{
 const ids=new Set<string>(),nodes=canvas.nodes.filter(node=>{if(ids.has(node.id))throw Error('The native Canvas repeats an occurrence');ids.add(node.id);return canvas.occurrences.has(node.id);});
 const targets:CanvasFindTarget[]=nodes.map(node=>({key:`occurrence:${node.id}`,canvas_key:canvas.key,kind:'occurrence',ref:node.id,label:node.title,
  text:node.type==='note'?noteText(node.content):node.type==='image'?node.caption??'':'',node_ids:[node.id]}));
 const byOccurrence=new Map(nodes.map(node=>[canvas.occurrences.get(node.id)!,node.id]));
 for(const [ref,frame]of Object.entries(frames).sort((a,b)=>a[1].z-b[1].z||a[0].localeCompare(b[0]))){
  const members=frame.memberRefs.map(member=>byOccurrence.get(member)).filter((id):id is string=>!!id);
  // An absent or partial frame cannot silently retarget its old group.
  if(!members.length||members.length!==frame.memberRefs.length||new Set(members).size!==members.length)continue;
  targets.push({key:`frame:${ref}`,canvas_key:canvas.key,kind:'frame',ref,label:frame.label,text:'',node_ids:members});
 }
 return targets;
}
export function findCanvasTargets(targets:readonly CanvasFindTarget[],query:string):CanvasFindTarget[]{
 const words=normalized(query.trim()).split(/\s+/).filter(Boolean);if(!words.length)return [];
 return targets.filter(target=>{const text=normalized(target.label+'\n'+target.text);return words.every(word=>text.includes(word));});
}
export function cycleCanvasFindTarget(hits:readonly CanvasFindTarget[],currentKey:string|undefined,direction:1|-1):CanvasFindTarget|undefined {
 if(!hits.length)return;const index=hits.findIndex(hit=>hit.key===currentKey);
 return hits[index<0?(direction===1?0:hits.length-1):(index+direction+hits.length)%hits.length];
}
export function resolveCanvasFindTarget(target:CanvasFindTarget,canvas:InstrumentCanvas,frames:Readonly<Record<string,ResearchFrame>>={}):CanvasFindTarget|undefined {
 if(target.canvas_key!==canvas.key)return;
 const current=canvasFindTargets(canvas,frames).find(row=>row.key===target.key);
 return current&&current.ref===target.ref&&current.kind===target.kind&&current.label===target.label&&current.text===target.text&&JSON.stringify(current.node_ids)===JSON.stringify(target.node_ids)?current:undefined;
}
/** Uses current native card bounds, preserving the caller's actual zoom
 * unless fitting a whole authored frame requires a smaller value. */
export function canvasFindCamera(target:CanvasFindTarget,canvas:InstrumentCanvas,extent:{width:number;height:number},zoom:number){
 if(![extent.width,extent.height,zoom].every(Number.isFinite)||extent.width<=0||extent.height<=0||zoom<=0)throw Error('Read the actual Canvas viewport before finding its content');
 const members=target.node_ids.map(id=>canvas.nodes.find(node=>node.id===id));if(!members.length||members.some(node=>!node))throw Error('The searched native members changed');
 const left=Math.min(...members.map(node=>node!.position.x)),top=Math.min(...members.map(node=>node!.position.y)),right=Math.max(...members.map(node=>node!.position.x+node!.size.width)),bottom=Math.max(...members.map(node=>node!.position.y+node!.size.height));
 if(![left,top,right,bottom].every(Number.isFinite))throw Error('The searched native geometry is unavailable');
 const nextZoom=target.kind==='frame'?Math.min(zoom,Math.max(1,extent.width-48)/Math.max(1,right-left),Math.max(1,extent.height-48)/Math.max(1,bottom-top)):zoom;
 return {zoom:nextZoom,x:extent.width/2-(left+right)/2*nextZoom,y:extent.height/2-(top+bottom)/2*nextZoom};
}
