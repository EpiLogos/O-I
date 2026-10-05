import type {Scene,Entity} from './model';
import {stateSource} from './sourceState';
import {entitySourceCoordinate,sequenceSourceCoordinate,layerSourceCoordinate,authoredSourceKey,validateAuthoredSourceCoordinate,type AuthoredSourceCoordinate} from '../../src/engine/authoredSourceCoordinates';
export interface AuthoredSourceRequest {entityId:string;linkId?:string;coordinate:AuthoredSourceCoordinate;source:NonNullable<Entity['source']>}
/** Full authored parents survive ordinary conversion; equal source values do not merge identity. */
export function authoredSourceRequests(scene:Scene):AuthoredSourceRequest[] {
  return scene.entities.filter(e=>e.kind==='formation').flatMap(e=>[
    ...(e.layers??[]).flatMap(l=>l.source?[{entityId:e.id,linkId:l.id,coordinate:layerSourceCoordinate(e.id,l.id,null),source:l.source}]:[]),
    ...(e.sequence.enabled||e.sequence.manual?e.sequence.steps.flatMap(k=>(k.layers??[]).flatMap(l=>l.source?[{entityId:e.id,linkId:l.id,coordinate:layerSourceCoordinate(e.id,l.id,k.id),source:l.source}]:[])):[]),
    ...(e.sequence.enabled||e.sequence.manual?e.sequence.steps.flatMap((k,i)=>{const source=stateSource(e,i);return source?[{entityId:e.id,linkId:k.id,coordinate:sequenceSourceCoordinate(e.id,k.id),source}]:[]}):e.source?[{entityId:e.id,coordinate:entitySourceCoordinate(e.id),source:e.source}]:[]),
  ]);
}
export function sourceCoordinateFromKey(key:string):AuthoredSourceCoordinate {
  const value=JSON.parse(key);if(!Array.isArray(value)||value.length!==4)throw new Error('Invalid authored source cache key');
  const [entity_ref,component,parent_ref,constituent_ref]=value;
  const c=validateAuthoredSourceCoordinate({entity_ref,component,parent_ref,constituent_ref});
  if(authoredSourceKey(c)!==key)throw new Error('Noncanonical authored source cache key');return c;
}
