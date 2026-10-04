import {currentNativePhysicalRest} from './physicalDisplay.js';
import type {KernelConversion} from '../kernelDocumentBridge.js';
import type {Scene} from '../model.js';
import {WORLD_SCALE} from '../nativeParameters.js';
import {INSTRUMENT_PRESENTATION,type NativeFieldController} from '../native-field/controller.js';
import type {PhysicalTargetMap} from './physicalSnapshotProjection.js';
import type {NativePerformanceReading} from './protocol.js';

const need=(ok:unknown,message:string):void=>{if(!ok)throw Error(message);};
/** Only presentation is authored here. The actual native prepare reply supplies
 * every scope, body token and P node. No geometry or source identity is inferred
 * from the displayed entity or imported into the current-source compiler. */
function receivingMap(entity:Scene['entities'][number],controller:NativeFieldController,reading:Pick<NativePerformanceReading,'scope'>&{physical:Pick<NativePerformanceReading['physical'],'node_ids'>}):PhysicalTargetMap{
 const ids=reading.physical.node_ids.slice();need(ids.length>0&&ids.length<=32&&new Set(ids).size===ids.length,'The original native P node domain is missing or duplicated.');
 const partition=controller.retainedPartition(),selected=partition.partitions.filter(item=>item.entity_ref===entity.id);
 need(selected.length===1&&selected[0].end-selected[0].start>=ids.length,'The selected renderer partition cannot receive the complete native body.');
 const length=selected[0].end-selected[0].start,lane=Array.from({length},(_,index)=>ids[Math.floor(index*ids.length/length)]);
 const scale=INSTRUMENT_PRESENTATION.units_per_metre*(entity.scale??1),angle=entity.rotation*Math.PI/180,c=Math.cos(angle)*scale,s=Math.sin(angle)*scale,pos=entity.position;
 return{schema:'oi.native-physical-target-map/v1',partition_signature:partition.partition_signature,entity_ref:entity.id,...reading.scope,
  native_node_ids:ids,metre_to_presentation:[c,s,0,0,-s,c,0,0,0,0,scale,0,pos.x*WORLD_SCALE,pos.y*WORLD_SCALE,pos.z*WORLD_SCALE,1],
  target_a_node_ids:lane,target_b_node_ids:lane.slice()};
}
/** Genuine ordinary-app caller for the CURRENT selected native occurrence.
 * Fresh work declares bounded policy only; native current owners reconstruct
 * source/context/reduction/form. Saved work reuses its complete retained native
 * edition and must pass the same native source/body re-admission. */
export async function prepareCurrentSceneInstrument(input:{
 view:KernelConversion;scene:Scene;selectedEntity:string;controller:NativeFieldController;current:()=>boolean;
}){
 const {view,scene,selectedEntity,controller,current}=input,doc=view.document,binding=view.bindings[scene.id];
 need(current()&&binding,'The current Scene changed before its instrument prepared.');
 const occurrence=binding.occurrences.find(item=>item.view_entity_id===selectedEntity);
 const entity=scene.entities.find(item=>item.id===selectedEntity&&item.kind==='formation'&&item.enabled!==false);
 need(occurrence&&entity,'Select a current native physical body in this Scene.');
 need(doc.selection?.scene_ref===binding.scene_ref&&doc.selection?.entity_ref===occurrence!.entity_ref,'The native owner has not acknowledged this selected body.');
 const nativeScene=doc.scenes.find(item=>item.scene_ref===binding.scene_ref),live=controller.reading,native=live.native,domain=live.domain;
 need(nativeScene&&live.lease&&native?.available&&domain&&controller.selectedSceneSourceCurrent({expression_ref:doc.expression_ref,document_revision:doc.revision,scene_ref:binding.scene_ref,scene_revision:nativeScene!.revision as number}),'The genuine current selected-Document source is not qualified for this body.');
 if(!nativeScene!.performance){
  const session=`performance:${crypto.randomUUID()}`;
  // These are declared controls. Prime face is separate from native Spanda
  // tick/phase; wrong current source/face remains a native refusal.
  const preparation={schema:'ql.current-source-performance-preparation/v1',policy_ref:'policy:expressions/physical-instrument/current-source-cf-degree-order',
   session_ref:session,receipt_ref:`${session}/return`,projection_ref:`${session}/receiving`,relation:{family:'A',pair_index:0,degree:1,expansion_side:null},
   source_face:1,physical_face:1,mechanical_policy:{policy:'declared-instrument-default'},source_choice:'retained-current-condition-cf-degree-order',columns:12,base_register:0,transpose:0};
  return controller.prepareCurrentPerformance(preparation,reading=>receivingMap(entity!,controller,reading),current);
 }
 throw Error('This saved Scene requires its actual retained native Act continuation, without fresh preparation or Begin.');
}

/** SAME restored native P through the selected ordinary renderer partition.
 * Rest/source/body correspondence comes from the full retained native Scene. */
export function retainedSceneReceivingMap(input:{view:KernelConversion;scene:Scene;selectedEntity:string;controller:NativeFieldController;current:()=>boolean},reading:NativePerformanceReading):PhysicalTargetMap{
 const {view,scene,selectedEntity,controller,current}=input,binding=view.bindings[scene.id];
 const occurrence=binding?.occurrences.find(row=>row.view_entity_id===selectedEntity),entity=scene.entities.find(row=>row.id===selectedEntity&&row.kind==='formation'&&row.enabled!==false);
 need(current()&&binding&&occurrence&&entity&&view.document.selection?.scene_ref===binding.scene_ref&&view.document.selection?.entity_ref===occurrence!.entity_ref,'The restored body is not the actual current selected native occurrence.');
 currentNativePhysicalRest(view,scene.id,reading);
 return receivingMap(entity!,controller,reading);
}
