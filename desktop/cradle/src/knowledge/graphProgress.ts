import {readGraph,type GraphInputName,type GraphReading,type GraphInput,type GraphReadOptions} from './graph';
import type {KernelTransportStatus} from '../kernel/types';

const names:GraphInputName[]=['central_wiki','aikit_resolution','shared_field'];
const operations:Record<GraphInputName,string>={central_wiki:'central.wiki.read',aikit_resolution:'aikit.knowledge.graph',shared_field:'shared-field.projection'};
export function emptyGraph():GraphReading {
  const input=(name:GraphInputName):GraphInput=>({state:'deferred',owner_operation:operations[name],detail:'Not requested'});
  return {schema:'oi.cradle.graph-reading/v1',nodes:[],edges:[],formations:[],inputs:{central_wiki:input('central_wiki'),aikit_resolution:input('aikit_resolution'),shared_field:input('shared_field')},counts:{spaces:0,wiki_nodes:0,knowledge_rows:0,hosted_rows:0,nodes:0,edges:0}};
}
/** Compose disclosed records, not a second graph index. Keep duplicate owner
 * node disclosures intact and collapse only exactly identical edge records. */
export function joinGraphInputs(parts:Partial<Record<GraphInputName,GraphReading>>,pending:GraphInputName[]):GraphReading {
  const result=emptyGraph(),seen=new Set<string>();
  for(const name of names){const part=parts[name];
    if(!part){if(pending.includes(name))result.inputs[name]={state:'deferred',owner_operation:operations[name],detail:'Loading'};continue;}
    result.inputs[name]=part.inputs[name];
    result.nodes.push(...part.nodes);
    for(const edge of part.edges){const key=JSON.stringify(edge);if(!seen.has(key)){seen.add(key);result.edges.push(edge);}}
    result.formations!.push(...(part.formations??[]));result.truncated ||= part.truncated===true;
  }
  result.counts={spaces:result.nodes.filter(n=>n.kind==='wiki-space').length,wiki_nodes:result.nodes.filter(n=>n.kind==='wiki-node').length,knowledge_rows:result.nodes.filter(n=>n.native_owner==='ai-kit').length,hosted_rows:result.nodes.filter(n=>n.native_owner==='shared-field').length,nodes:result.nodes.length,edges:result.edges.length};
  return result;
}
export interface GraphProgress {reading:GraphReading;pending:GraphInputName[]}
export type GraphRead = (options:GraphReadOptions)=>Promise<GraphReading>;
/** Local useful results publish before optional hosted work is submitted. This
 * also respects kernels which currently serialize native owner calls. Turning
 * shared discovery off neither queries nor waits for the remote provider. */
export async function progressiveGraph(read:GraphRead,publish:(value:GraphProgress)=>void,options:{shared?:boolean;fresh?:boolean;maxNodes?:number;signal?:AbortSignal}={}):Promise<void>{
  const parts:Partial<Record<GraphInputName,GraphReading>>={},pending:GraphInputName[]=['aikit_resolution','central_wiki'];
  if(options.shared)pending.push('shared_field');
  const emit=()=>{if(!options.signal?.aborted)publish({reading:joinGraphInputs(parts,pending),pending:[...pending]});};
  const load=async(name:GraphInputName)=>{
    if(options.signal?.aborted)return;
    try{parts[name]=await read({input:name,fresh:options.fresh,max_nodes:options.maxNodes??4096,max_edges:Math.min(100000,(options.maxNodes??4096)*4)});}
    catch(error){const part=emptyGraph();part.inputs[name]={state:'unavailable',owner_operation:operations[name],detail:error instanceof Error?error.message:String(error)};parts[name]=part;}
    const index=pending.indexOf(name);if(index>=0)pending.splice(index,1);emit();
  };
  emit();
  await Promise.all([load('aikit_resolution'),load('central_wiki')]);
  if(options.shared&&!options.signal?.aborted)await load('shared_field');
}
export function loadGraph(transport:KernelTransportStatus,project:string|undefined,query:string,publish:(value:GraphProgress)=>void,options:Parameters<typeof progressiveGraph>[2]={}):Promise<void>{
  return progressiveGraph(readOptions=>readGraph(transport,project,query,readOptions),publish,options);
}
