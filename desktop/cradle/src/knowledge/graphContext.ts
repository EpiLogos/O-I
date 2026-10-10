import type {GraphNode} from './graph';
export interface GraphContextSource {ref:string;owner:string;revision?:string;source:string;address:string;actions:string}
export function captureGraphContext(node:GraphNode):GraphContextSource {
 return {ref:node.ref,owner:node.native_owner,revision:node.provenance.revision,source:node.provenance.source,address:JSON.stringify(node.address??null),actions:JSON.stringify(node.actions)};
}
/** A menu carries an exact native source basis, not a detached node copy. */
export function resolveGraphContext(basis:GraphContextSource,nodes:readonly GraphNode[]):GraphNode|undefined {
 const matches=nodes.filter(node=>node.ref===basis.ref);if(matches.length!==1)return;
 const node=matches[0],current=captureGraphContext(node);
 return current.owner===basis.owner&&current.revision===basis.revision&&current.source===basis.source&&current.address===basis.address&&current.actions===basis.actions?node:undefined;
}
