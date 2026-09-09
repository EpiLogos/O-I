import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus, KnowledgeAddress} from "../kernel/types";

/** Mirrors C3's owner reading; geometry and navigation never enter this type. */
export interface GraphProvenance {source:string;revision?:string;detail?:string[]}
export interface GraphNode {ref:string;kind:"wiki-space"|"wiki-node"|"file"|"flow"|"skill"|"knowledge-subject";label:string;native_owner:string;provenance:GraphProvenance;actions:string[]}
export interface GraphEdge {relation:"space-child-space"|"space-node"|"node-space"|"node-source";from_ref:string;to_ref:string;provenance:GraphProvenance}
export type GraphInput = {state:"available";owner_operation:string;detail?:string}|{state:"unavailable"|"deferred";owner_operation:string;detail:string};
export interface GraphReading {schema:"oi.cradle.graph-reading/v1";nodes:GraphNode[];edges:GraphEdge[];inputs:Record<"central_wiki"|"aikit_resolution"|"shared_field",GraphInput>;counts:{spaces:number;wiki_nodes:number;knowledge_rows:number;nodes:number;edges:number}}
export async function readGraph(transport:KernelTransportStatus,project:string|undefined,query:string):Promise<GraphReading> {
  const response=await kernelOp(transport,{op:"graph",project,query});
  if(response.error||response.outcome?.result!=="graph_reading")throw new Error(response.error??"The graph reading is unavailable");
  if(response.outcome.reading.schema!=="oi.cradle.graph-reading/v1")throw new Error("Unsupported graph reading schema");
  return response.outcome.reading;
}
/** Only the existing address variants are admitted. No ref parsing or rewriting. */
export function graphAddress(node:GraphNode):KnowledgeAddress {
  if(node.kind==="wiki-space"||node.kind==="wiki-node"||node.kind==="flow"||node.kind==="knowledge-subject")return {kind:"wiki",value:node.ref};
  if(node.kind==="file")return {kind:"source",value:node.ref};
  throw new Error(`The existing kernel read path does not admit ${node.kind}: ${node.ref}`);
}
