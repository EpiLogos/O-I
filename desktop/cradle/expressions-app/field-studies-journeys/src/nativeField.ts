/** The actual imported application's native control depth. No sample session,
 * fallback input, hidden microphone or local imitation of a native producer. */
import {NativeChannel} from './native-field/channel';
import {NativeFieldController,NativeRenderer} from './native-field/controller';
import type {FieldEngineAdapter} from './engine';
export function installNativeField(engine:FieldEngineAdapter,onResumeApplication:()=>void){
 const port=new NativeChannel();
 const canRetain=typeof (engine as any).retainedTargetPort==='function';
 if(!canRetain){port.dispose();return null;}
 const controller=new NativeFieldController(port,engine as unknown as NativeRenderer);
 const panel=document.createElement('details');panel.dataset.nativeField='';panel.className='native-field-panel';
 panel.innerHTML=`<summary>Native M1–M3</summary><div class="native-field-depth">
 <p>Same Expressions body. Native topology, modal sound and clock; existing GPU particle mechanics.</p>
 <label>Central binding source <input name="native-path" type="text" spellcheck="false" placeholder="Work/…/native-binding.json"></label>
 <button type="button" data-native="source">Read binding</button><output data-native-source>No source selected.</output>
 <button type="button" data-native="connect" disabled>Connect muted</button>
 <div class="native-field-actions"><button type="button" data-native="hold">Hold</button><button type="button" data-native="resume">Resume</button><button type="button" data-native="mute">Unmute</button><button type="button" data-native="disconnect">Disconnect</button></div>
 <label>Presentation units per metre <input name="native-scale" type="number" min="0.000001" max="1000000" step="any" value="400"></label>
 <button type="button" data-native="scale">Override presentation scale</button><button type="button" data-native="follow">Follow binding scale</button>
 <details><summary>Native operation and sources</summary>
 <p>Only the existing native set-axis or replace operation. The complete producer basis is inspectable; refusals are not simulated.</p>
 <label>Native operation JSON<textarea name="native-command" spellcheck="false" rows="5"></textarea></label>
 <button type="button" data-native="operate">Apply native operation</button><button type="button" data-native="inspect">Inspect complete native sources</button>
 <pre data-native-sources></pre></details>
 <details><summary>Recovery</summary><p>A checkpoint covers this live GPU at an unchanged native cursor, not process restart or exact historical rewind.</p>
 <button type="button" data-native="checkpoint">Hold and checkpoint</button><button type="button" data-native="restore">Restore held checkpoint</button></details>
 <output role="status" aria-live="polite" data-native-status>Native owner unavailable until an explicit binding is connected.</output>
 <details><summary>Inspect owner readback</summary><pre data-native-reading></pre></details></div>`;
 // Local component styles, not a shared shell or palette rewrite.
 const style=document.createElement('style');style.textContent=`.native-field-panel{position:fixed;right:14px;top:58px;z-index:72;max-width:min(420px,calc(100vw - 28px));background:var(--paper,#f4f2eb);color:var(--ink,#222);border:1px solid currentColor;border-radius:6px;font:12px/1.4 system-ui}.native-field-panel>summary{padding:6px 10px;cursor:pointer}.native-field-depth{padding:10px;max-height:75vh;overflow:auto;display:grid;gap:8px}.native-field-depth label{display:grid;gap:4px}.native-field-depth input,.native-field-depth textarea{min-width:0;width:100%;box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid currentColor}.native-field-depth button{padding:5px 7px;border:1px solid currentColor;border-radius:3px;background:transparent;color:inherit;font:inherit;cursor:pointer}.native-field-depth button:disabled{opacity:.45;cursor:default}.native-field-actions{display:flex;gap:5px;flex-wrap:wrap}.native-field-depth pre{font:10px/1.4 monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}.native-field-depth output{display:block;overflow-wrap:anywhere}`;
 document.head.append(style);document.body.append(panel);
 let source:{path:string;revision:string;sampleRate:number}|null=null,muted=true,busy=false;
 const query=<T extends HTMLElement>(selector:string)=>panel.querySelector<T>(selector)!;
 const update=()=>{
  const reading=controller.reading;
  query('output[data-native-status]').textContent=reading.reason??`${reading.status} · ${reading.presentation_mode} · ${reading.native?.acknowledged?.generation??'—'} / ${reading.native?.acknowledged?.samples_elapsed??'—'}`;
  query('pre[data-native-reading]').textContent=JSON.stringify(reading,null,2);
  query<HTMLButtonElement>('[data-native="connect"]').disabled=busy||!source||!['manual','unavailable'].includes(reading.status);
  for(const command of ['hold','resume','mute','scale','follow','operate','inspect','checkpoint','restore'])query<HTMLButtonElement>(`[data-native="${command}"]`).disabled=busy||!reading.native;
 };
 controller.onChange=update;
 const click=async(event:Event)=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-native]');if(!button||busy)return;
  const operation=button.dataset.native;
  busy=true;update();
  try{
   if(operation==='source'){
    const path=query<HTMLInputElement>('[name="native-path"]').value.trim();
    const value=await port.request({operation:'source',path});const binding=JSON.parse(value.content);
    if(binding.schema!=='oi.native-expression-binding/v1')throw new Error('Source is not an oi.native-expression-binding/v1 document');
    const rate=binding.host?.field?.sample_rate;
    if(!Number.isInteger(rate))throw new Error('Binding does not supply a native sample_rate');
    source={path,revision:value.revision,sampleRate:rate};query('output[data-native-source]').textContent=`${path} · ${value.revision} · ${rate} Hz`;
    query<HTMLInputElement>('[name="native-scale"]').value=String(binding.presentation?.units_per_metre);
   }else if(operation==='connect'){
    if(!source||source.path!==query<HTMLInputElement>('[name="native-path"]').value.trim())throw new Error('Reread the selected binding source before connecting');
    await controller.connect(source.path,source.revision,source.sampleRate);muted=true;query('[data-native="mute"]').textContent='Unmute';onResumeApplication();
   }else if(operation==='hold')controller.hold();
   else if(operation==='resume'){await controller.resume();onResumeApplication();}
   else if(operation==='mute'){muted=!muted;controller.setMuted(muted);button.textContent=muted?'Unmute':'Mute';}
   else if(operation==='disconnect')await controller.release();
   else if(operation==='scale')controller.setScale(Number(query<HTMLInputElement>('[name="native-scale"]').value));
   else if(operation==='follow'){controller.followDomain();query<HTMLInputElement>('[name="native-scale"]').value=String(controller.reading.presentation_units_per_metre);}
   else if(operation==='operate')await controller.operate(JSON.parse(query<HTMLTextAreaElement>('[name="native-command"]').value));
   else if(operation==='inspect')query('pre[data-native-sources]').textContent=JSON.stringify(await controller.inspectSources(),null,2);
   else if(operation==='checkpoint')await controller.saveCheckpoint();
   else if(operation==='restore')await controller.restoreCheckpoint();
  }catch(error){controller.reason=String(error);}
  finally{busy=false;update();}
 };
 panel.addEventListener('click',click);
 const visibility=()=>{if(document.hidden)controller.hold('document hidden');};
 document.addEventListener('visibilitychange',visibility);
 const pagehide=()=>{void controller.dispose();};window.addEventListener('pagehide',pagehide);
 // Readback only at human cadence; native scheduling remains in InstrumentSession.
 const timer=window.setInterval(()=>{if(panel.open)update();},250);
 update();
 return {controller,dispose:()=>{clearInterval(timer);panel.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);panel.remove();style.remove();void controller.dispose();}};
}
