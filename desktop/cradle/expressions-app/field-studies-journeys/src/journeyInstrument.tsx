import type {ReactElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {KernelConversion} from './kernelDocumentBridge';
import type {TechneReading} from '../../../src/techne/contract';
import type {JourneyModel,JourneyBeat} from '../../../src/techne/m0m5/journey/beats';
import {journeyInstrumentBasis,sameJourneyInstrumentBasis,readJourneyInstrument,prepareJourneyBeatFocus,type JourneyBeatFocus,type JourneyInstrumentBasis} from './journeyInstrumentModel';
import './journeyInstrument.css';

export interface JourneyInstrumentHost {
 nativeView:()=>KernelConversion|undefined;sceneId:()=>string;
 read:(basis:JourneyInstrumentBasis)=>Promise<unknown>;
 /** The retained native Scene focus operation, with this captured source
  * basis verified again by its receiver. No array-index selection. */
 focusScene:(input:JourneyBeatFocus)=>Promise<unknown>;
}
export function JourneyBeatPanel({reading,model,view,basis,onFocus,onRefresh,busy}:{
 reading:TechneReading;model:JourneyModel;view:KernelConversion;basis:JourneyInstrumentBasis;
 onFocus:(beat:JourneyBeat)=>void;onRefresh:()=>void;busy:boolean;
}):ReactElement{
 return <section className="journey-beat-panel" aria-label="Reading-derived Journey">
  <header><h3>Journey</h3><button type="button" disabled={busy} onClick={onRefresh}>Refresh reading</button></header>
  {!model.beats.length?<p role="status">{model.unavailableReason}</p>:<ol className="journey-reading-beats">{model.beats.map((beat,index)=>{
   const scene=beat.expression_ref===view.document.expression_ref?view.document.scenes.find(item=>item.scene_ref===beat.scene_ref):undefined;
   const navigable=!!scene&&beat.revision===String(basis.revision);
   return <li key={`${beat.expression_ref}\0${beat.scene_ref}\0${index}`} data-expression-ref={beat.expression_ref} data-scene-ref={beat.scene_ref}>
    <button type="button" className="journey-beat-card" disabled={busy||!navigable} aria-current={basis.scene_ref===beat.scene_ref?'step':undefined}
     onClick={()=>onFocus(beat)} title={navigable?'Open this native Scene':'Open the bound native Expression at its disclosed revision first'}>
     <span aria-hidden="true" className="journey-beat-number">{index+1}</span><strong>{scene?.title||beat.title}</strong>
    </button>
    <details><summary>Source and frame</summary><p>{beat.frame.subject_ref}</p><p>{beat.expression_ref} · {beat.scene_ref}</p>
     {beat.frame.temporal.map((facet,i)=><p key={`time:${i}`}>{facet.kind} · {JSON.stringify(facet)}</p>)}
     {beat.frame.places.map((place,i)=><p key={`place:${i}`}>{place.names.join(' · ')||place.place_ref} · {place.precision}</p>)}
     {beat.frame.sources.map((source,i)=><p key={`source:${i}`}>{source.source_ref}{source.source_revision?` · ${source.source_revision}`:''}{source.selector?` · ${JSON.stringify(source.selector)}`:''}</p>)}
    </details>
   </li>;
  })}</ol>}
  <p className="journey-reading-source">{reading.subject.subject_ref}</p>
 </section>;
}

/** Reading-derived beats beside the existing saved Scene strip. This is a
 * presentation of the source's own bindings, with no second Journey store,
 * proposed timing, playback clock or undisclosed native operations. */
export function installJourneyInstrument(host:JourneyInstrumentHost,home:HTMLElement){
 const mount=document.createElement('section'),status=document.createElement('p');
 mount.className='journey-reading-workspace';mount.hidden=true;status.setAttribute('role','status');status.hidden=true;home.append(status,mount);
 let root:Root|null=null,epoch=0,open=false,destroyed=false;
 const current=(basis:JourneyInstrumentBasis,generation:number)=>!destroyed&&open&&epoch===generation&&sameJourneyInstrumentBasis(basis,host.nativeView(),host.sceneId());
 const message=(text:string)=>{status.textContent=text;};
 async function load(){
  const generation=++epoch;
  try{
   const view=host.nativeView(),sceneId=host.sceneId(),basis=journeyInstrumentBasis(view,sceneId);
   message('Reading Journey…');
   const raw=await host.read(basis);
   if(destroyed||!open||generation!==epoch)return;
   if(!current(basis,generation))throw Error('The selected native Journey changed while its reading was returning');
   const {reading,model}=readJourneyInstrument(raw,view!,sceneId);
   root??=createRoot(mount);
   let busy=false;
   const draw=()=>{if(!current(basis,generation))return;root!.render(<JourneyBeatPanel reading={reading} model={model} view={view!} basis={basis} busy={busy} onRefresh={()=>void load()} onFocus={beat=>{
    if(busy)return;
    try{
     const input=prepareJourneyBeatFocus(beat,basis,host.nativeView(),host.sceneId());busy=true;draw();
     void host.focusScene(input).then(()=>{
      if(destroyed||!open||generation!==epoch)return;
      const adopted=host.nativeView();
      if(!adopted||adopted.document.expression_ref!==input.expression_ref||adopted.bindings[host.sceneId()]?.scene_ref!==input.target_scene_ref)throw Error('The native owner did not adopt the requested Journey Scene');
      void load();
     }).catch(error=>{if(!destroyed&&open&&generation===epoch){message(error instanceof Error?error.message:String(error));busy=false;draw();}});
    }catch(error){message(error instanceof Error?error.message:String(error));}
   }}/>);};
   draw();message(model.unavailableReason??`${model.beats.length} native Scene bindings`);
  }catch(error){if(!destroyed&&open&&generation===epoch){root?.unmount();root=null;message(error instanceof Error?error.message:String(error));}}
 }
 return {
  async open(){if(destroyed)throw Error('Journey instrument is closed');open=true;mount.hidden=false;status.hidden=false;await load();},
  close(){epoch++;open=false;mount.hidden=true;status.hidden=true;root?.unmount();root=null;},
  async refresh(){if(open)await load();},
  destroy(){epoch++;open=false;destroyed=true;root?.unmount();root=null;mount.remove();status.remove();},
  active(){return open;},
 };
}
