/** Verbatim attribution on a current native Wiki edge. Provider authority is
 * not epistemic standing; no classification or evidence is inferred here. */
export interface WikiRelationMetadata {
 standing?:string; evidence?:Record<string,unknown>[]; evidence_refs?:string[];
 provenance?:Record<string,unknown>[]; uncertainty?:string;
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function wikiRelationMetadata(source:Record<string,unknown>):WikiRelationMetadata {
 const declaration=source['aikit.constellation-relation/v1'];
 if(declaration!==undefined&&!object(declaration))throw Error('The native relation attribution is malformed.');
 const meta=object(declaration)?declaration:source;
 const result:WikiRelationMetadata={};
 for(const key of ['standing','uncertainty'] as const){const value=meta[key];if(value==null)continue;if(typeof value!=='string')throw Error('The native relation attribution is malformed.');result[key]=value;}
 for(const [key,value] of [['evidence',meta.evidence],['provenance',source.provenance]] as const){
  if(value===undefined)continue;
  if(!Array.isArray(value)||value.some(row=>!object(row)||typeof row.source_ref!=='string'||!row.source_ref))throw Error('The native relation provenance is malformed.');
  result[key]=structuredClone(value);
 }
 if(result.evidence)result.evidence_refs=[...new Set(result.evidence.map(row=>row.source_ref as string))];
 return result;
}
