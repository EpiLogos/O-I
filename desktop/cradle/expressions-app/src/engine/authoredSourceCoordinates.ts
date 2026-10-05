import type {Entity,EntityLayer,SequenceLink} from './fieldModel';

/** Authored material identity only. This is not a native Source/body grant. */
export interface AuthoredSourceCoordinate {
  entity_ref:string;
  component:'entity'|'sequence'|'layer';
  constituent_ref:string;
  parent_ref:string|null;
}
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
export function validateAuthoredSourceCoordinate(value:AuthoredSourceCoordinate):AuthoredSourceCoordinate {
  if(!value||Object.keys(value).length!==4||!id(value.entity_ref)||!id(value.constituent_ref)||!['entity','sequence','layer'].includes(value.component)||!(value.parent_ref===null||id(value.parent_ref))||(value.component!=='layer'&&value.parent_ref!==null)||(value.component==='entity'&&value.constituent_ref!==value.entity_ref))throw new Error('Invalid authored material source coordinate');
  return value;
}
export function authoredSourceKey(value:AuthoredSourceCoordinate):string {
  const c=validateAuthoredSourceCoordinate(value);
  return JSON.stringify([c.entity_ref,c.component,c.parent_ref,c.constituent_ref]);
}
export const entitySourceCoordinate=(entity_ref:string):AuthoredSourceCoordinate=>validateAuthoredSourceCoordinate({entity_ref,component:'entity',constituent_ref:entity_ref,parent_ref:null});
export const sequenceSourceCoordinate=(entity_ref:string,constituent_ref:string):AuthoredSourceCoordinate=>validateAuthoredSourceCoordinate({entity_ref,component:'sequence',constituent_ref,parent_ref:null});
export const layerSourceCoordinate=(entity_ref:string,constituent_ref:string,parent_ref:string|null):AuthoredSourceCoordinate=>validateAuthoredSourceCoordinate({entity_ref,component:'layer',constituent_ref,parent_ref});
export function linkSourceCoordinate(e:Entity,link:SequenceLink):AuthoredSourceCoordinate {
  const c=link.sourceCoordinate??sequenceSourceCoordinate(e.id,link.id);
  validateAuthoredSourceCoordinate(c);
  if(c.entity_ref!==e.id||(c.component==='sequence'&&c.constituent_ref!==link.id)||!['entity','sequence'].includes(c.component))throw new Error('Sequence source coordinate differs from its actual owner');
  return c;
}
export function effectiveLayerSourceCoordinate(e:Entity,link:SequenceLink|undefined,layer:EntityLayer):AuthoredSourceCoordinate {
  const parent=link?.layers!==undefined&&linkSourceCoordinate(e,link).component==='sequence'?link.id:null;
  const expected=layerSourceCoordinate(e.id,layer.id,parent),c=layer.sourceCoordinate??expected;
  if(authoredSourceKey(c)!==authoredSourceKey(expected))throw new Error('Layer source coordinate differs from its actual parent');
  return c;
}
export function authoredSourceUniverse(e:Entity):AuthoredSourceCoordinate[] {
  const rows=[entitySourceCoordinate(e.id),...(e.layers??[]).map(l=>effectiveLayerSourceCoordinate(e,undefined,l))];
  for(const link of e.sequence.links){rows.push(linkSourceCoordinate(e,link));for(const l of link.layers??[])rows.push(effectiveLayerSourceCoordinate(e,link,l));}
  return [...new Map(rows.map(c=>[authoredSourceKey(c),c])).values()];
}
/** Old missing-parent calls may name only one actual coordinate. Never select the first equal ID. */
export function resolveAuthoredSourceCoordinate(e:Entity,legacyId?:string,explicit?:AuthoredSourceCoordinate):AuthoredSourceCoordinate {
  const universe=authoredSourceUniverse(e);
  if(explicit){
    const key=authoredSourceKey(explicit);
    if(explicit.entity_ref!==e.id||(legacyId!==undefined&&explicit.constituent_ref!==legacyId)||!universe.some(c=>authoredSourceKey(c)===key))throw new Error('Authored source address is absent from this Entity');
    return explicit;
  }
  if(legacyId===undefined)return entitySourceCoordinate(e.id);
  const matches=universe.filter(c=>c.constituent_ref===legacyId);
  if(matches.length!==1)throw new Error(matches.length?'Legacy material source ID has ambiguous parents':'Legacy material source ID is absent');
  return matches[0];
}
export function authoredCandidatePool<T>(pools:ReadonlyMap<string,T>,e:Entity,coordinate:AuthoredSourceCoordinate):T|undefined {
  const current=pools.get(authoredSourceKey(coordinate));if(current!==undefined)return current;
  const legacy=coordinate.component==='entity'?e.id:e.id+':'+coordinate.constituent_ref;
  // A delimiter-bearing legacy key cannot establish full Entity/component identity.
  if(e.id.includes(':')||coordinate.constituent_ref.includes(':'))return undefined;
  const old=pools.get(legacy);if(old===undefined)return undefined;
  try{return authoredSourceKey(resolveAuthoredSourceCoordinate(e,coordinate.component==='entity'?undefined:coordinate.constituent_ref))===authoredSourceKey(coordinate)?old:undefined;}catch{return undefined;}
}
