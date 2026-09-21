/** Current view correspondence, never a semantic graph or a subject matcher. */
import type {KernelConversion} from './kernelDocumentBridge.js';
import type {ConnectionBinding} from '../../../../../packages/oi-design-system/expressions-engine/oi/expressionBindings.mjs';
export function nativeConnections(view:KernelConversion|undefined):Record<string,ConnectionBinding[]> {
 if(!view)return {};
 return Object.fromEntries(Object.entries(view.bindings).map(([sceneId,binding])=>{
  const ids=new Map(binding.occurrences.map(o=>[o.entity_ref,o.view_entity_id]));
  return [sceneId,binding.relations.filter(r=>ids.has(r.from_entity_ref)&&ids.has(r.to_entity_ref)).map(r=>({
   ...r,expression_ref:view.document.expression_ref,scene_ref:binding.scene_ref,
   native_from_entity_ref:r.from_entity_ref,native_to_entity_ref:r.to_entity_ref,
   from_entity_ref:ids.get(r.from_entity_ref)!,to_entity_ref:ids.get(r.to_entity_ref)!,
  }))];
 }));
}
