import type {NativeM3Reading} from '../../../src/nara/nativeM3';
import type {KernelConversion} from './kernelDocumentBridge';
import type {FormationGeometryProjection} from '../../src/engine/formationGeometryProjection';

/** Consume native hinge points verbatim. No codon→shape or ordinal→rotation
 * rule exists in this receiver. The selected formation supplies only its
 * existing placement, scale and particle allocation. */
export function naraFormGeometry(reading:NativeM3Reading,view:KernelConversion|undefined,sceneId:string):FormationGeometryProjection{
 if(!view||reading.schema!=='oi.nara-m3-context/v1'||reading.status!=='available'||!reading.state||!reading.revision
   ||reading.expression_ref!==view.document.expression_ref||reading.expression_revision!==view.document.revision
   ||reading.state.subject_ref!==reading.person_ref||reading.state.identity.event_ref!==reading.event_ref)
   throw Error('Read the native form for this current Expression before presenting it.');
 const selection=view.document.selection,selected=selection?.entity_ref,binding=view.bindings[sceneId];
 if(!selected||!selection||binding?.scene_ref!==selection.scene_ref)throw Error('Select a native formation in this Scene.');
 const occurrence=binding.occurrences.filter(o=>o.entity_ref===selected);
 const entity=occurrence.length===1?view.journey.scenes.find(s=>s.id===sceneId)?.entities.find(e=>e.id===occurrence[0].view_entity_id):null;
 if(!entity||entity.kind!=='formation'||!entity.enabled)throw Error('The selected native subject is not an enabled formation.');
 const geometry=reading.state.form.hinge_geometry;
 if(geometry?.schema!=='ql.m3-hinge-presentation/v1'||geometry.embedding!=='normalized-directed-unit-pair-hinge/v1'||geometry.shared_hinge!=='Y'
   ||geometry.points.length!==3||geometry.segments.length!==2)throw Error('The native form has no supported hinge geometry.');
 const ids=geometry.points.map(p=>p.id);
 if(ids.join(',')!=='X,Y,Z'||geometry.segments[0].from!=='X'||geometry.segments[0].to!=='Y'||geometry.segments[1].from!=='Y'||geometry.segments[1].to!=='Z')throw Error('The native hinge topology is incomplete.');
 return {entityId:entity.id,revision:reading.revision,points:geometry.points.map(p=>p.xyz),segments:geometry.segments.map(edge=>[ids.indexOf(edge.from),ids.indexOf(edge.to)] as const)};
}
