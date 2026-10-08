import type {SurfaceBinding} from '../../../../desktop/cradle/src/surface/types';
import {sameTarget,type EditorCheckpoint,type EditorPlacement,type EditorPresentationHost,type EditorTarget} from '../frame/presentation';
/** Ports close over the existing workspace and contribution owners. `detach`
 * is Workbench's admitted native window_detach path; `redock` waits for its
 * window-redock receipt. No new window, document or persistence owner. */
export interface InstrumentSurfaceOwner {
 workspaceId:string;
 binding:SurfaceBinding;
 /** Captures the current owner generation and exact binding; the returned
  * guard must reject retired access even while another workspace is active. */
 capture():()=>void;
 checkpoint(view:Readonly<EditorCheckpoint>):void;
 flushCheckpoint():Promise<void>;
 placement():EditorPlacement;
 present(placement:Exclude<EditorPlacement,'popout'>,view:Readonly<EditorCheckpoint>):Promise<void>;
 detach?(surfaceId:string):Promise<void>;
 redock?(surfaceId:string):Promise<void>;
 /** Must mean that DetachedFrame can mount THIS contributed editor and
  * restore its owner model/checkpoint, beyond transport.kind === tauri. */
 detachedContributionSupported:boolean;
 setVisible?(visible:boolean):void;
}
/** Exact receiving adapter for one admitted Surface and installed instance.
 * Readback belongs to the workspace owner; an unacknowledged presentation
 * is never reported as a successful transition. */
export function instrumentSurfaceOwner(owner:InstrumentSurfaceOwner,target:EditorTarget|(()=>EditorTarget)):EditorPresentationHost{
 if(!owner.workspaceId||!owner.binding.id)throw Error('An admitted workspace Surface is required.');
 const bindingId=owner.binding.id;
 let latest:Readonly<EditorCheckpoint>|undefined,transition:Readonly<EditorCheckpoint>|undefined;
 const assertTarget=(view:Readonly<EditorCheckpoint>)=>{const expected=typeof target==='function'?target():target;if(view.instanceRef!==expected.instanceRef||!sameTarget(view.target,expected))throw Error('The presentation addresses another installed native binding.');};
 return {
  checkpoint(view){assertTarget(view);owner.capture()();latest=structuredClone(view);owner.checkpoint(transition?{...view,placement:transition.placement,depth:transition.depth,returnTo:transition.returnTo,geometry:transition.geometry}:view);},
  setVisible(visible){try{owner.capture()();}catch{return;}owner.setVisible?.(visible);},
  async relocate(view){
   assertTarget(view);const current=owner.capture();current();const before=owner.placement();
   if(view.placement==='popout'&&(!owner.detachedContributionSupported||!owner.detach))throw Error('The native detached Surface receiver has not admitted this instrument editor.');
   if(before==='popout'&&view.placement!=='popout'&&!owner.redock)throw Error('The owner has not supplied its acknowledged native redock route.');
   // Flush pending editor input via the current workspace checkpoint before
   // a renderer/window can be relocated. The native work remains its own model.
   transition=structuredClone(view);
   try{owner.checkpoint(view);await owner.flushCheckpoint();current();
   if(before==='popout'&&view.placement!=='popout'){await owner.redock!(bindingId);current();}
   if(view.placement==='popout')await owner.detach!(bindingId);
   else await owner.present(view.placement,view);
   current();if(owner.placement()!==view.placement)throw Error('The workspace owner has not confirmed this presentation. Check the existing Surface before retrying.');
   }catch(error){
    // A renderer may retire while the acknowledged native operation is in
    // flight. Its refusal must never produce a rollback into the next owner.
    let live=true;try{current();}catch{live=false;}
    if(live&&latest)try{owner.checkpoint({...latest,placement:owner.placement()});}catch(rollback){throw new AggregateError([error,rollback],'Presentation failed and its current owner checkpoint could not be restored.');}
    throw error;
   }finally{transition=undefined;}
  }
 };
}
