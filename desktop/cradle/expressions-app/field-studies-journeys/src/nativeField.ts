/** The actual imported application's native control depth. No sample session,
 * fallback input, hidden microphone or local imitation of a native producer. */
import {NativeDomainView} from './native-field/domainView';
import {NativeChannel} from './native-field/channel';
import {NativeFieldController,NativeRenderer,EMBEDDED_NATIVE_PLAYBACK} from './native-field/controller';
import type {FieldEngineAdapter} from './engine';
export function installNativeField(engine:FieldEngineAdapter,onResumeApplication:()=>void){
 const port=new NativeChannel();
 const canRetain=typeof (engine as any).retainedTargetPort==='function';
 if(!canRetain){port.dispose();return null;}
 const controller=new NativeFieldController(port,engine as unknown as NativeRenderer,undefined,EMBEDDED_NATIVE_PLAYBACK);
 // A Studio section's content, not a floating pill: mounted into the Studio
 // aside's "Native field" section (shell.ts studio-sections nav) by the
 // owning app shell, and never re-rendered via innerHTML after creation —
 // it owns live listeners for the life of the session.
 const panel=document.createElement('div');panel.dataset.nativeField='';panel.className='native-field-panel';
 panel.innerHTML=`<div class="native-field-depth">
 <p>Same Expressions body. Native topology, modal sound and clock; existing GPU particle mechanics.</p><p>Buffered native playback: 8,192 samples per block, 500 ms initial device lead, 500 ms lookahead ceiling. This pays for the complete native transfer; lateness holds rather than silently skipping samples. The chosen sample rate must fit this policy.</p>
 <label>Central binding source <input name="native-path" type="text" spellcheck="false" placeholder="Work/…/native-binding.json"></label>
 <button type="button" data-native="source">Read binding</button><output data-native-source>No source selected.</output>
 <button type="button" data-native="connect" disabled>Connect muted</button>
 <div class="native-field-actions"><button type="button" data-native="hold">Hold</button><button type="button" data-native="resume">Resume</button><button type="button" data-native="mute">Unmute</button><button type="button" data-native="disconnect">Disconnect</button></div>
 <label>Presentation units per metre <input name="native-scale" type="number" min="0.000001" max="1000000" step="any" value="400"></label>
 <button type="button" data-native="scale">Override presentation scale</button><button type="button" data-native="follow">Follow binding scale</button>
 <details><summary>Native domain controls</summary>
 <p>These change the existing producer. Source generations, continuous time and presentation remain separate.</p>
 <label>M1 carrier tick (0–11)<input name="native-tick" type="number" min="0" max="11" step="1" value="0"></label>
 <button type="button" data-native="tick">Apply native carrier tick</button>
 <label>M1 harmonic row (0–11)<input name="native-row" type="number" min="0" max="11" step="1" value="0"></label>
 <button type="button" data-native="row">Apply native harmonic row</button><p>Material harmonic selection remains the native basis: changing a row does not retune a separately selected canonical harmonic.</p>
 <label>M3 transcription<select name="native-rna"><option value="false">DNA</option><option value="true">RNA</option></select></label>
 <button type="button" data-native="transcription">Apply native transcription</button>
 <label>M2 material mode<select name="native-mode"></select></label>
 <label>Damping (s⁻¹)<input name="native-damping" type="number" min="0" step="any" value="0"></label>
 <button type="button" data-native="damping">Apply native damping</button>
 <label>Native clock axis<select name="native-axis"><option value="0">Inscription</option><option value="1">Lensing</option></select></label>
 <label>Exact whole turns<input name="native-turns" type="text" inputmode="numeric" value="0" spellcheck="false"></label>
 <label>Half-degrees (0–719)<input name="native-phase" type="number" min="0" max="719" step="1" value="0"></label>
 <button type="button" data-native="axis">Apply native phase</button>
 </details>
 <details><summary>Native operation and sources</summary>
 <p>Only the existing native set-axis or replace operation. The complete producer basis is inspectable; refusals are not simulated.</p>
 <label>Native operation JSON<textarea name="native-command" spellcheck="false" rows="5"></textarea></label>
 <button type="button" data-native="operate">Apply native operation</button><button type="button" data-native="inspect">Inspect complete native sources</button>
 <pre data-native-sources></pre></details>
 <details><summary>Causal trace</summary>
 <p>Source → producer → target → actuator → observable. Disconnect removes the physical consumer.</p>
 <pre data-native-causal></pre>
 <pre data-native-actuators></pre></details>
 <details><summary>Recovery</summary><p>A checkpoint covers this live GPU at an unchanged native cursor, not process restart or exact historical rewind.</p>
 <button type="button" data-native="checkpoint">Hold and checkpoint</button><button type="button" data-native="restore">Restore held checkpoint</button></details>
 <output role="status" aria-live="polite" data-native-status>Native owner unavailable until an explicit binding is connected.</output>
 <details><summary>Inspect owner readback</summary><pre data-native-reading></pre></details></div>`;
 // Local component styles, not a shared shell or palette rewrite. Laid out
 // as ordinary Studio-section content (font: 12px/1.4 system-ui text
 // scale — the panel is no longer a fixed floating pill, so it carries no
 // own position, background or border box; the Studio aside supplies both).
 const style=document.createElement('style');style.textContent=`.native-field-panel{font:12px/1.4 system-ui}.native-field-depth{display:grid;gap:8px}.native-field-depth label{display:grid;gap:4px}.native-field-depth input,.native-field-depth textarea,.native-field-depth select{min-width:0;width:100%;box-sizing:border-box;font:inherit;color:inherit;background:transparent;border:1px solid currentColor}.native-field-depth button{padding:5px 7px;border:1px solid currentColor;border-radius:3px;background:transparent;color:inherit;font:inherit;cursor:pointer}.native-field-depth button:disabled{opacity:.45;cursor:default}.native-field-actions{display:flex;gap:5px;flex-wrap:wrap}.native-field-depth pre{font:10px/1.4 monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}.native-field-depth output{display:block;overflow-wrap:anywhere}`;
 const domainView=new NativeDomainView();
 // The panel is mounted into the Studio "Native field" section by the app
 // shell when that section is active; it is not appended to <body> here.
 document.head.append(style);document.body.append(domainView.element);
 let domainStamp="";
 let source:{path:string;revision:string;sampleRate:number}|null=null,muted=true,busy=false;
 const query=<T extends HTMLElement>(selector:string)=>panel.querySelector<T>(selector)!;
 const update=()=>{
  const reading=controller.reading;
  panel.setAttribute("aria-busy",String(busy));
  for(const input of panel.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea"))input.disabled=busy;
  domainView.update(reading.domain,reading.presented_clock,reading.status,reading.native?.presented?.generation);
  const stamp=JSON.stringify(reading.domain);
  if(reading.domain&&domainStamp!==stamp&&!busy){
   domainStamp=stamp;
   query<HTMLInputElement>('[name="native-row"]').value=String(reading.domain.m1.row12);
   query<HTMLInputElement>('[name="native-tick"]').value=String(reading.domain.m1.tick12);
   const modes=query<HTMLSelectElement>('[name="native-mode"]'),prior=modes.value;
   modes.replaceChildren(...reading.domain.m2.modes.map(mode=>{const option=document.createElement('option');option.value=mode.ref;option.textContent=`${mode.ref} · ${mode.frequency_hz} Hz`;return option;}));
   if(reading.domain.m2.modes.some(mode=>mode.ref===prior))modes.value=prior;
   query<HTMLInputElement>('[name="native-damping"]').value=String(reading.domain.m2.modes.find(mode=>mode.ref===modes.value)?.damping_per_second??0);
   query<HTMLSelectElement>('[name="native-rna"]').value=String(reading.domain.m3.rna);
  }
  query('output[data-native-status]').textContent=reading.reason??`${reading.status} · ${reading.presentation_mode} · ${reading.native?.acknowledged?.generation??'—'} / ${reading.native?.acknowledged?.samples_elapsed??'—'}`;
  // Only pay for the JSON dumps while the "Native field" Studio section is
  // actually the one mounted and visible (panel.isConnected replaces the
  // former <details>.open gate now that this is Studio-section content).
  if(panel.isConnected){
   query('pre[data-native-reading]').textContent=JSON.stringify(reading,null,2);
   query('pre[data-native-causal]').textContent=JSON.stringify(reading.causal_trace??{status:'unavailable'},null,2);
   query('pre[data-native-actuators]').textContent=JSON.stringify({
    physical_form_actuator:(reading as any).physical_form_actuator??{applied:false,reason:'unavailable'},
    actuator_standing:(reading as any).actuator_standing??{connected:false},
   },null,2);
  }
  query<HTMLButtonElement>('[data-native="connect"]').disabled=busy||!source||!['manual','unavailable'].includes(reading.status)||!!reading.lease;
  for(const command of ['resume','mute','scale','follow','operate','inspect','checkpoint','restore','row','tick','transcription','damping','axis'])query<HTMLButtonElement>(`[data-native="${command}"]`).disabled=busy||!reading.lease||reading.status==='unavailable';
 };
 controller.onChange=update;
 const click=async(event:Event)=>{
  const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-native]');if(!button)return;
  const operation=button.dataset.native;
  // Stop/release remain operable while a native reply is pending. They do not
  // replay a write, and the controller's lifetime/hold fence rejects old work.
  if(operation==='hold'){controller.hold();update();return;}
  if(operation==='disconnect'){await controller.release();update();return;}
  if(busy)return;
  // Capture the person's input before any returned basis updates the form.
  const submitted=Object.fromEntries([...panel.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('[name]')].map(input=>[input.name,input.value]));
  busy=true;update();
  try{
   if(operation==='source'){
    const path=submitted["native-path"].trim();
    const value=await port.request({operation:'source',path});const binding=JSON.parse(value.content);
    if(binding.schema!=='oi.native-expression-binding/v1')throw new Error('Source is not an oi.native-expression-binding/v1 document');
    const rate=binding.host?.field?.sample_rate;
    if(!Number.isInteger(rate))throw new Error('Binding does not supply a native sample_rate');
    source={path,revision:value.revision,sampleRate:rate};query('output[data-native-source]').textContent=`${path} · ${value.revision} · ${rate} Hz`;
    query<HTMLInputElement>('[name="native-scale"]').value=String(binding.presentation?.units_per_metre);
   }else if(operation==='connect'){
    if(!source||source.path!==submitted["native-path"].trim())throw new Error('Reread the selected binding source before connecting');
    await controller.connect(source.path,source.revision,source.sampleRate);muted=true;query('[data-native="mute"]').textContent='Unmute';onResumeApplication();
   }else if(operation==='resume'){await controller.resume();onResumeApplication();}
   else if(operation==='mute'){muted=!muted;controller.setMuted(muted);button.textContent=muted?'Unmute':'Mute';}
   else if(operation==='scale')controller.setScale(Number(submitted["native-scale"]));
   else if(operation==='follow'){controller.followDomain();query<HTMLInputElement>('[name="native-scale"]').value=String(controller.reading.presentation_units_per_metre);}
   else if(operation==='operate')await controller.operate(JSON.parse(submitted["native-command"]));
   else if(operation==='tick')await controller.editBasis({kind:'carrier-tick',tick12:Number(submitted["native-tick"])});
   else if(operation==='row')await controller.editBasis({kind:'harmonic-row',row12:Number(submitted["native-row"])});
   else if(operation==='transcription')await controller.editBasis({kind:'transcription',rna:submitted["native-rna"]==='true'});
   else if(operation==='damping')await controller.editBasis({kind:'damping',mode_ref:submitted["native-mode"],per_second:Number(submitted["native-damping"])});
   else if(operation==='axis'){
    const turns=submitted["native-turns"].trim(),half_degrees=Number(submitted["native-phase"]);
    if(!/^(0|-?[1-9][0-9]*)$/.test(turns)||BigInt(turns)<-(1n<<63n)||BigInt(turns)>(1n<<63n)-1n||!Number.isInteger(half_degrees)||half_degrees<0||half_degrees>719)throw new Error('Native phase requires exact i64 turns and 0–719 half-degrees');
    await controller.operate({operation:'set-axis',axis:Number(submitted["native-axis"]),phase:{turns,half_degrees}});
   }
   else if(operation==='inspect')query('pre[data-native-sources]').textContent=JSON.stringify(await controller.inspectSources(),null,2);
   else if(operation==='checkpoint')await controller.saveCheckpoint();
   else if(operation==='restore')await controller.restoreCheckpoint();
  }catch(error){controller.reason=String(error);}
  finally{busy=false;update();}
 };
 const modeChange=()=>{const reading=controller.reading,ref=query<HTMLSelectElement>('[name="native-mode"]').value;query<HTMLInputElement>('[name="native-damping"]').value=String(reading.domain?.m2.modes.find(mode=>mode.ref===ref)?.damping_per_second??0);};
 query('[name="native-mode"]').addEventListener('change',modeChange);
 panel.addEventListener('click',click);
 const visibility=()=>{if(document.hidden)controller.hold('document hidden');};
 document.addEventListener('visibilitychange',visibility);
 const pagehide=()=>{void controller.dispose();};window.addEventListener('pagehide',pagehide);
 // Readback only at human cadence; native scheduling remains in InstrumentSession.
 const timer=window.setInterval(update,250);
 update();
 return {controller,panel,dispose:()=>{clearInterval(timer);panel.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);panel.remove();domainView.dispose();style.remove();void controller.dispose();}};
}
