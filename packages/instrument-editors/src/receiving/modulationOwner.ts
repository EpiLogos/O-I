import {createRetainedNativeEditor} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor';
import {clone,validateJourney,type AutomationLane} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {automationTarget} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters';
import {sameEditorBasis,type NativeEditorBasis,type NativeEditorReply} from '../../../expressions-boundary/src/editor';
type Owner=Parameters<typeof createRetainedNativeEditor>[0];
const sourceKeys=new Set(['enabled','type','wave','rate','phase','duration','delay','loop','easing']);
const rangeKeys=new Set(['min','max','blend','enabled']);
/** A receiving function over the retained application's ACTUAL options. It
 * uses its DocumentStore transaction, validators, commit, history and native
 * recovery. It owns no store, grammar, engine or operation channel. */
export function modulationOwnerPort(owner:Owner){
 const receiver=createRetainedNativeEditor(owner);
 return async(basis:NativeEditorBasis,laneId:string,values:Partial<AutomationLane>):Promise<NativeEditorReply>=>{
  try{
   const current=receiver.read();if(!sameEditorBasis(current.basis,basis))throw Error('The captured modulation source changed; retain the input and reread its native basis.');
   if(owner.store.transactionOpen||current.standing.pending)throw Error('The native owner already has an active edit.');
   const next=clone(owner.store.document),scene=next.scenes.find(scene=>scene.id===owner.sceneId()),lane=scene?.automation.find(lane=>lane.id===laneId);
   if(!scene||!lane||!automationTarget(scene,lane.target))throw Error('The native modulation target is no longer admitted.');
   const keys=Object.keys(values);if(!keys.length||keys.some(key=>!(rangeKeys.has(key)||!lane.syncWith&&sourceKeys.has(key))))throw Error('This edit must name disclosed source or target controls. Following targets retain their group source.');
   Object.assign(lane,clone(values));validateJourney(next);
   owner.change(()=>{owner.store.document=next;});await receiver.save();
   const reading=receiver.read();if(reading.basis.expression_ref!==basis.expression_ref||reading.basis.scene_ref!==basis.scene_ref)throw Error('The native save completed on another presentation; the captured input remains available.');
   return {ok:true,reading};
  }catch(error){let reading;try{reading=receiver.read();}catch{/* no replacement reading */}return {ok:false,error:error instanceof Error?error.message:String(error),reading};}
 };
}
