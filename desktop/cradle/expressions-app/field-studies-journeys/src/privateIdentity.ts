/** Private identity is a temporary presentation on the EXISTING engine, never
 * a scene in DocumentStore, an autosave, a public edition or a second canvas. */
import {blankScene,type Scene} from './model';
import {fromNativeEntity} from './nativeBridge';
import {makeSemanticChakraEntities,makeChakraSemanticField} from '../../src/engine/semantics/chakraPresets';
import {defaultCamera} from './camera';
import type {FieldEngineAdapter,EngineFrame} from './engine';
import {IDENTITY_CHANNEL,rotateIdentityPoint,validateIdentityPattern,type PrivateIdentityPattern} from '../../../src/nara/identityPresentation';

export function identityScene(raw:unknown):Scene{
  const pattern=validateIdentityPattern(raw),scene=blankScene('Private accepted identity');
  // This is the app's native chakral form factory, including its existing
  // cymatic glyph templates. Historical shape frequencies are not receiving-
  // centre measurements or a mapping onto the resonator's physical stations.
  const native=makeSemanticChakraEntities(pattern.form);
  scene.id='private-identity-presentation';scene.text=[];scene.automation=[];scene.propertyTracks=[];
  scene.entities=native.map((e,index)=>{
    const value=parseInt(pattern.fingerprint.value.slice(index*8,index*8+8),16)/0xffffffff;
    const out=fromNativeEntity(e);
    out.position=rotateIdentityPoint({x:0,y:-.82+index*.274,z:0},pattern.orientation);
    out.size={x:.235,y:.235};out.scale=1;out.rotation=(value-.5)*40;
    // Hash selects a reproducible fine rotation of the authored form, never
    // a guessed amplitude, chakra health, psychological type or station.
    out.native=undefined;out.station=null;out.force={kind:'none',strength:0,radius:.27,spin:0};out.sequence.enabled=false;out.sequence.steps=[];
    return out;
  });
  scene.semanticField=makeChakraSemanticField(native,'constant');
  scene.engine={...scene.engine,resonanceEnabled:false,morphEnabled:false,autoSweep:false,mediumEnabled:false,pairwiseEnabled:false,relationalEnabled:false,pointerClick:'off',volumeEnabled:true};
  scene.composition={...scene.composition,focus:'parallel',carryStation:false,frequencyDriver:'manual'};
  scene.field.params.particleCount=12000;scene.view={...scene.view,mode:'3d',yaw:0,pitch:0};
  return scene;
}
export interface PrivateIdentityOptions {canPresent:()=>boolean;requestFrame:()=>void;onState?:(active:boolean)=>void}
/** No physical clock or retained native lease is replaced. The owner must
 * release/hold any competing material binding before choosing this view. */
export function privateIdentityEngine(engine:FieldEngineAdapter,options:PrivateIdentityOptions){
  let privateScene:Scene|null=null,lastPublic:EngineFrame|null=null,revision=0,disposed=false,paintedPrivate=false;
  const unavailable=()=>{throw new Error('Private identity is not available to capture, export, checkpoints or generic diagnostics');};
  const publicFrame=()=>{if(lastPublic)engine.render({...lastPublic,delta:0});};
  function end(){
    if(!privateScene)return;
    if(paintedPrivate){
      // Replacing targets alone leaves private particles in the public image
      // during their transition. Restore public targets, reseed through the
      // existing owner, and redraw BEFORE re-enabling capture or diagnostics.
      if(!lastPublic||typeof engine.command!=='function')throw new Error('Native particle clearing is unavailable; private capture protection remains active');
      publicFrame();engine.command({type:'reset-field'});publicFrame();
    }
    paintedPrivate=false;privateScene=null;++revision;
    options.onState?.(false);options.requestFrame();
  }
  function begin(pattern:PrivateIdentityPattern){if(disposed||!options.canPresent())throw new Error('Finish recording and release any active native-field binding before showing this private pattern');privateScene=identityScene(pattern);++revision;options.onState?.(true);options.requestFrame();}
  const adapter=new Proxy(engine,{
    get(target,property){
      if(property==='render')return (frame:EngineFrame)=>{lastPublic=frame;if(privateScene){if(!options.canPresent()){end();return;}target.render({...frame,scene:privateScene,authoringRevision:-revision,camera:{...defaultCamera(),mode:'3d'},params:privateScene.field.params,selectedIds:[],pointer:{active:false,world:{x:0,y:0,z:0}},scaffold:'off'});paintedPrivate=true;}else target.render(frame);};
      if(property==='needsRender')return ()=>!!privateScene||target.needsRender?.()===true;
      if(property==='telemetry'||property==='inspect'||property==='stations')return (...args:unknown[])=>{
        if(privateScene)return property==='telemetry'?null:property==='stations'?[]:{private:true,standing:'private-presentation; native source not disclosed'};
        // Read optional capabilities once: a getter may change or disappear.
        // Preserve the native receiver without asserting a method exists.
        const method:unknown=Reflect.get(target,property);
        return typeof method==='function'?Reflect.apply(method,target,args):undefined;
      };
      if(['capture','withCleanFrame','transportState','restoreTransport','checkpointRetainedField','restoreRetainedField','command','setNativeDomain'].includes(String(property))){const value=Reflect.get(target,property);if(typeof value!=='function')return value;return (...args:unknown[])=>privateScene?unavailable():value.apply(target,args);}
      if(property==='dispose')return ()=>{privateScene=null;lastPublic=null;disposed=true;target.dispose();};
      const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
    }
  });
  return {engine:adapter,begin,end,get active(){return !!privateScene;}};
}
export function installPrivateIdentity(engine:FieldEngineAdapter,options:PrivateIdentityOptions):FieldEngineAdapter{
  const epoch=crypto.randomUUID(),root=document.getElementById('app'),toolbar=document.createElement('aside');
  toolbar.className='private-identity-notice';toolbar.hidden=true;toolbar.setAttribute('aria-label','Private identity presentation');
  toolbar.innerHTML='<span>Accepted native identity · private · not saved</span><button type="button">Return to my Expression</button>';
  const style=document.createElement('style');style.textContent='.private-identity-notice{position:fixed;z-index:1000;bottom:20px;left:50%;transform:translateX(-50%);max-width:90vw;padding:12px;display:flex;gap:12px;align-items:center;background:var(--paper);color:var(--ink);border:1px solid currentColor;font:13px/1.4 system-ui}.private-identity-notice[hidden]{display:none}.private-identity-notice button{font:inherit;background:transparent;color:inherit;border:1px solid currentColor;padding:6px;cursor:pointer}body[data-private-identity] #app>.chrome,body[data-private-identity] #text-layers,body[data-private-identity] #guides,body[data-private-identity] #transition-canvas{visibility:hidden!important}';
  document.head.append(style);document.body.append(toolbar);
  let priorInert=false,lastOrigin:string|null=null;
  const port=privateIdentityEngine(engine,{...options,onState:active=>{if(active&&!toolbar.hidden)return;if(active){priorInert=root?.inert??false;if(root)root.inert=true;document.body.dataset.privateIdentity='true';toolbar.hidden=false;toolbar.querySelector('button')?.focus();}else{if(root)root.inert=priorInert;delete document.body.dataset.privateIdentity;toolbar.hidden=true;options.onState?.(false);}}});
  const send=(origin:string,message:Record<string,unknown>)=>window.parent.postMessage({schema:IDENTITY_CHANNEL,epoch,...message},origin==='null'?'*':origin);
  const end=()=>{port.end();if(lastOrigin)send(lastOrigin,{operation:'ended'});};
  toolbar.querySelector('button')!.addEventListener('click',end);
  const key=(event:KeyboardEvent)=>{if(!port.active)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();end();}else if(event.key!=='Tab'&&event.target!==toolbar.querySelector('button')){event.preventDefault();event.stopImmediatePropagation();}};
  window.addEventListener('keydown',key,true);
  const receive=(event:MessageEvent)=>{
    if(event.source!==window.parent||window.parent===window)return;
    const value=event.data;
    if(value?.schema!==IDENTITY_CHANNEL){if(port.active)event.stopImmediatePropagation();return;}
    if(value.operation==='probe'){lastOrigin=event.origin;send(event.origin,{operation:'ready'});return;}
    if(value.epoch!==epoch||typeof value.request_id!=='string'||event.origin!==lastOrigin)return;
    try{if(value.operation==='present')port.begin(validateIdentityPattern(value.pattern));else if(value.operation==='end')end();else throw new Error('Unsupported private presentation operation');send(event.origin,{request_id:value.request_id,ok:true});}
    catch(error){send(event.origin,{request_id:value.request_id,ok:false,reason:error instanceof Error?error.message:'Private presentation refused'});}
  };
  window.addEventListener('message',receive,true);
  // An app loaded after the parent's initial probe still announces readiness;
  // no private content travels in this feature-detection message.
  if(window.parent!==window)window.parent.postMessage({schema:IDENTITY_CHANNEL,epoch,operation:'ready'},'*');
  const dispose=port.engine.dispose.bind(port.engine);
  return new Proxy(port.engine,{get(target,property){if(property==='dispose')return ()=>{try{end();}finally{window.removeEventListener('message',receive,true);window.removeEventListener('keydown',key,true);toolbar.remove();style.remove();dispose();}};return Reflect.get(target,property);}});
}
