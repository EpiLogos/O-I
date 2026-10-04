import {nativeSceneAxes} from './native-field/axis';
/** The live instrument: the dated sky on the M1 torus clock as a person meets it. One native
 * owner supplies sound and targets; this surface shows what is acting and sends
 * determinant events to that owner. No sample session, fallback input, hidden
 * microphone, local oscillator or browser synthesis of native music. */
import {mountNativePerformance} from './native-performance/NativePerformanceSurface.js';
import {NativeDomainView} from './native-field/domainView';
import {NativeChannel} from './native-field/channel';
import {NativeFieldController,NativeRenderer,EMBEDDED_NATIVE_PLAYBACK,CADENCES,INSTRUMENT_PRESENTATION,PRESENTATION_LEVEL,type NativeSky} from './native-field/controller';
import {LENSES,CONTEXT_FRAMES,type SceneActing} from './native-field/scene';
import type {FieldEngineAdapter} from './engine';
/** scene_field.rs `PLANETS`, in scalar-degree order: the map's own names. */
const PLANET_NAMES=['Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars','Neptune','Pluto'];
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const when=(ms:number|null)=>ms==null?'—':new Date(ms).toISOString().replace('T',' ').replace(/\.\d+Z$/,' UTC');
export function installNativeField(engine:FieldEngineAdapter,onResumeApplication:()=>void,onNativeChanged?:()=>void,prepareMusical?:()=>Promise<unknown>){
 const port=new NativeChannel();
 const canRetain=typeof (engine as any).retainedTargetPort==='function';
 if(!canRetain){port.dispose();return null;}
 const controller=new NativeFieldController(port,engine as unknown as NativeRenderer,undefined,EMBEDDED_NATIVE_PLAYBACK);
 const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 // A Studio section's content: mounted into the Studio aside's "Live
 // instrument" section by the owning app shell, and never re-rendered via
 // innerHTML after creation — it owns live listeners for the session.
 const panel=document.createElement('div');panel.dataset.nativeField='';panel.className='native-field-panel';
 const musicPanel=document.createElement('aside');musicPanel.className='native-music-tray hud-panel chrome';musicPanel.hidden=true;musicPanel.setAttribute('aria-label','Physical musical instrument');
 const musicHeader=document.createElement('header'),musicTitle=document.createElement('h2'),musicClose=document.createElement('button'),musicBody=document.createElement('div');
 musicTitle.textContent='Physical musical instrument';musicClose.textContent='×';musicClose.setAttribute('aria-label','Close musical controls');musicHeader.append(musicTitle,musicClose);
 const sourceAuthorship=document.createElement('details'),sourceAuthorshipSummary=document.createElement('summary'),sourceAuthorshipBody=document.createElement('p');
 const sourceAuthorshipDepth=document.createElement('details'),sourceAuthorshipDepthTitle=document.createElement('summary'),sourceAuthorshipOriginal=document.createElement('pre');
 sourceAuthorshipDepthTitle.textContent='Native source details';sourceAuthorshipDepth.append(sourceAuthorshipDepthTitle,sourceAuthorshipOriginal);
 sourceAuthorship.dataset.performance='native-source-authorship';sourceAuthorship.hidden=true;sourceAuthorship.append(sourceAuthorshipSummary,sourceAuthorshipBody,sourceAuthorshipDepth);
 musicPanel.append(musicHeader,sourceAuthorship,musicBody);
 document.getElementById('app')!.append(musicPanel);
 const music=mountNativePerformance(musicBody,controller.performance,controller.score,controller.physicalDisplay,controller.physicalEdits,controller.acousticEdits,controller.takes);music.setVisible(false);
 const musicOpen=document.createElement('button');musicOpen.type='button';musicOpen.textContent='Prepare and play selected body';musicOpen.dataset.performance='prepare-current-scene';
 const showMusic=async()=>{musicOpen.disabled=true;try{if(!controller.musicalReading){if(!prepareMusical)throw Error('This application has no current native Scene preparation join.');await prepareMusical();}else controller.assertCurrentPerformance();musicPanel.hidden=false;music.setVisible(true);}catch(error){fail(error);}finally{musicOpen.disabled=false;}};
 musicOpen.addEventListener('click',()=>{void showMusic();});
 musicClose.addEventListener('click',()=>{music.setVisible(false);musicPanel.hidden=true;});
 const seg=(name:string,items:Array<{value:string;label:string;title?:string}>,label:string)=>`<div class="segmented ni-seg" role="group" aria-label="${esc(label)}" data-ni-group="${name}">${items.map(i=>`<button type="button" data-ni-set="${name}" data-value="${esc(i.value)}" aria-pressed="false"${i.title?` title="${esc(i.title)}"`:''}>${esc(i.label)}</button>`).join('')}</div>`;
 panel.innerHTML=`<div class="ni">
 <p class="control-note ni-lede">The dated sky on the clock: QL's native M1 torus sounding the planets of M2-5 at their just octave, each voice at its ecliptic degree. One native owner supplies sound, targets and clock; this field presents them.</p>
 <output class="ni-status" role="status" aria-live="polite" data-ni-v="status">Not open.</output>
 <div data-ni-closed>
  <button type="button" class="primary ni-open" data-ni="open">Open live instrument (dated sky now)</button>
  <p class="control-note">Opens muted. QL composes the event against the current sky; sound starts only when you turn it on.</p>
  <details class="control-group"><summary>Other openings</summary><div class="group-content">
   <button type="button" class="secondary" data-ni="open-default">Open without a dated sky (QL's default event)</button>
   <label class="control"><span>Dated sky at (UTC, RFC 3339)</span><input name="ni-epoch" type="text" spellcheck="false" placeholder="2026-09-27T12:00:00Z"></label>
   <button type="button" class="secondary" data-ni="open-dated">Open at this dated sky</button>
  </div></details>
 </div>
 <div data-ni-open hidden>
  <section class="ni-block" aria-label="What is acting">
   <h4>What is acting</h4>
   <dl class="ni-kv">
    <dt>Event</dt><dd data-ni-v="event">—</dd>
    <dt>Sky</dt><dd data-ni-v="sky">—</dd>
    <dt>M1</dt><dd data-ni-v="m1">—</dd>
    <dt>Lens</dt><dd data-ni-v="lens">—</dd>
    <dt>Context frame</dt><dd data-ni-v="cf">—</dd>
    <dt>Harmonic basis</dt><dd data-ni-v="harmonic">—</dd>
    <dt>Transcription</dt><dd data-ni-v="m3">—</dd>
    <dt>72-address</dt><dd data-ni-v="address">—</dd>
    <dt>Generation</dt><dd data-ni-v="generation">—</dd>
   </dl>
   <table class="ni-voices"><caption>The sky's nine voices (M2-5, just octave)</caption><thead><tr><th scope="col">Planet</th><th scope="col">λ</th><th scope="col">Hz</th><th scope="col">m×n</th></tr></thead>
   <tbody>${PLANET_NAMES.map((name,i)=>`<tr data-ni-voice="${i}"><th scope="row">${name}</th><td>—</td><td>—</td><td>—</td></tr>`).join('')}</tbody></table>
  </section>
  <section class="ni-block" aria-label="Play">
   <h4>Play</h4>
   <fieldset class="ni-block" data-ni-axis-controls><legend>Inscription & lensing</legend>
   <p class="control-note">Two continuous circles on this same owner. Each turns its attached native targets. These do not choose a codon or static aperture, or advance the M1/M3 source clocks.</p>
   ${([['0','Clock A · inscription'],['1','Clock B · lensing']] as const).map(([axis,label])=>`<div class="ni-row" data-ni-axis-row="${axis}"><label>${label} · whole turns <input type="text" inputmode="numeric" spellcheck="false" data-ni-axis-turns="${axis}" aria-label="${label} whole turns"></label><label>Half-degrees (0–719) <input type="number" min="0" max="719" step="1" data-ni-axis-half="${axis}" aria-label="${label} half-degrees"></label><button type="button" class="secondary" data-ni="set-axis" data-ni-axis="${axis}">Apply ${axis==='0'?'inscription':'lensing'}</button><output data-ni-axis-reading="${axis}"></output></div>`).join('')}
   <p class="ni-refusal" data-ni-axis-error role="alert" hidden></p>
   </fieldset>
   <div class="ni-row"><label>Damping · decay (s⁻¹) <input type="number" min="0" max="1000000" step="any" data-ni-damping aria-describedby="ni-damping-standing"></label><button type="button" class="secondary" data-ni="set-damping">Apply damping</button></div>
   <p class="control-note" id="ni-damping-standing">Declared material policy. Changes decay from the resident state; it does not strike the voices or turn either clock.</p>
   <div class="ni-row"><button type="button" class="secondary" data-ni="step">Step one tick</button><button type="button" class="secondary" data-ni="strike">Strike voices</button></div>
   ${seg('cadence',[{value:'hold',label:'Hold'},...CADENCES.map(c=>({value:String(c.ticks_per_second),label:c.label,title:c.source}))],'Tick cadence')}
   <p class="control-note" data-ni-v="cadence">Cadence held. 1 tick/s follows the M3/M4′ world clock; 12 ticks/s is PPS's user-facing tick.</p>
  </section>
  <section class="ni-block" aria-label="Change a determinant">
   <h4>Change a determinant</h4>
   <p class="ni-label" id="ni-lens-label">Lens</p>${seg('lens',LENSES.map(l=>({value:String(l.lens12),label:l.label})),'Lens')}
   <p class="ni-label">Context frame</p>${seg('cf',CONTEXT_FRAMES.map(c=>({value:String(c.context_frame),label:c.label})),'Context frame')}
   <p class="ni-label">Harmonic basis</p>${seg('harmonic',[...Array.from({length:8},(_,i)=>({value:String(i),label:`B${i+1}`})),{value:'row',label:'Row',title:'Selected M1 source row'}],'Harmonic basis')}
   <p class="ni-label">M3 transcription</p>${seg('rna',[{value:'false',label:'DNA'},{value:'true',label:'RNA'}],'M3 transcription')}
   <p class="ni-refusal" role="alert" data-ni-v="refusal" hidden></p>
  </section>
  <section class="ni-block" aria-label="See and hear">
   <h4>See and hear</h4>
   <div class="ni-row"><button type="button" class="secondary" data-ni="sound" aria-pressed="false">Sound on</button><span class="control-note" data-ni-v="sound">Muted.</span></div>
   <div class="range-control"><div class="range-label"><label for="ni-level">Level · presentation gain</label><output data-ni-v="level">1.00×</output></div><div class="range-track"><input id="ni-level" type="range" min="${PRESENTATION_LEVEL.min}" max="${PRESENTATION_LEVEL.max}" step="0.05" value="${PRESENTATION_LEVEL.initial}" data-ni-range="level"></div></div>
   <div class="range-control"><div class="range-label"><label for="ni-scale">Scale · presentation units per metre</label><output data-ni-v="scale">—</output></div><div class="range-track"><input id="ni-scale" type="range" min="40" max="400" step="5" value="${INSTRUMENT_PRESENTATION.units_per_metre}" data-ni-range="scale"></div></div>
   <button type="button" class="secondary" data-ni="follow-scale">Use the instrument's scale</button>
   <p class="control-note">Level and scale are presentation only; the native PCM, targets and material policy are unchanged. The cadence never starts by itself.${reducedMotion?' Reduced motion is on: the 12 ticks/s preset is withheld.':''}</p>
  </section>
  <section class="ni-block" aria-label="Return">
   <h4>Return</h4>
   <div class="ni-row"><button type="button" class="secondary" data-ni="restore-opening">Return to opening event</button></div>
   <div class="ni-row"><button type="button" class="secondary" data-ni="hold">Hold field</button><button type="button" class="secondary" data-ni="resume">Resume field</button></div>
   <div class="ni-row"><button type="button" class="secondary" data-ni="checkpoint">Hold and checkpoint</button><button type="button" class="secondary" data-ni="restore">Restore checkpoint</button></div>
   <button type="button" class="secondary" data-ni="close">Close instrument</button>
  </section>
  <details class="control-group ni-basis" data-ni-basis><summary>Inspect basis</summary><div class="group-content">
   <p class="control-note">What acts, through what, on which consumer, and on what warrant — the owner's influence reading.</p>
   <div class="ni-effects" data-ni-v="effects"></div>
   <p class="ni-policy" data-ni-v="policy"></p>
   <p class="control-note" data-ni-v="pose"></p>
   <details class="ni-raw"><summary>Raw readings (JSON)</summary><button type="button" class="secondary" data-ni="raw">Read now</button><pre data-ni-raw></pre></details>
  </div></details>
 </div>
 <details class="control-group ni-depth" data-ni-depth><summary>Inspect depth: native sources & binding</summary><div class="group-content native-field-depth">
  <p class="control-note">Current native sources, with an optional Central binding document for a supplied owner. Buffered native playback: 8,192 samples per block, 500 ms initial device lead, 500 ms lookahead ceiling.</p>
  <label class="control"><span>Central binding source</span><input name="native-path" type="text" spellcheck="false" placeholder="Work/…/native-binding.json"></label>
  <div class="ni-row"><button type="button" class="secondary" data-native="source">Read binding</button><button type="button" class="secondary" data-native="connect" disabled>Connect muted</button></div><output data-native-source>No source selected.</output>
  <div class="ni-row"><button type="button" class="secondary" data-native="hold">Hold</button><button type="button" class="secondary" data-native="resume">Resume</button></div>
  <div class="ni-row"><button type="button" class="secondary" data-native="mute">Unmute</button><button type="button" class="secondary" data-native="disconnect">Disconnect</button></div>
  <label class="control"><span>Presentation units per metre</span><input name="native-scale" type="number" min="0.000001" max="1000000" step="any" value="400"></label>
  <div class="ni-row"><button type="button" class="secondary" data-native="scale">Override presentation scale</button><button type="button" class="secondary" data-native="follow">Follow binding scale</button></div>
  <details><summary>Native domain controls</summary>
   <p class="control-note">The carrier, row, transcription and per-mode damping controls below replace a supplied owner’s complete basis and are disabled for a Scene owner. Source generations, continuous time and presentation remain separate.</p>
   <label class="control"><span>M1 carrier tick (0–11)</span><input name="native-tick" type="number" min="0" max="11" step="1" value="0"></label>
   <button type="button" class="secondary" data-native="tick">Apply native carrier tick</button>
   <label class="control"><span>M1 harmonic row (0–11)</span><input name="native-row" type="number" min="0" max="11" step="1" value="0"></label>
   <button type="button" class="secondary" data-native="row">Apply native harmonic row</button>
   <label class="control"><span>M3 transcription</span><select name="native-rna"><option value="false">DNA</option><option value="true">RNA</option></select></label>
   <button type="button" class="secondary" data-native="transcription">Apply native transcription</button>
   <label class="control"><span>M2 material mode</span><select name="native-mode"></select></label>
   <label class="control"><span>Damping (s⁻¹)</span><input name="native-damping" type="number" min="0" step="any" value="0"></label>
   <button type="button" class="secondary" data-native="damping">Apply native damping</button>
   <p class="control-note">Independent phase is available on either the Scene or supplied owner. Ordinary Scene Play also exposes both circles.</p>
   <label class="control"><span>Native clock axis</span><select name="native-axis"><option value="0">Inscription</option><option value="1">Lensing</option></select></label>
   <label class="control"><span>Exact whole turns</span><input name="native-turns" type="text" inputmode="numeric" value="0" spellcheck="false"></label>
   <label class="control"><span>Half-degrees (0–719)</span><input name="native-phase" type="number" min="0" max="719" step="1" value="0"></label>
   <button type="button" class="secondary" data-native="axis">Apply native phase</button>
  </details>
  <details><summary>Native operation and sources</summary>
   <p class="control-note">Verbatim native operation (set-axis, replace, m1-advance, replace-event) and the complete producer sources.</p>
   <label class="control"><span>Native operation JSON</span><textarea name="native-command" spellcheck="false" rows="5"></textarea></label>
   <div class="ni-row"><button type="button" class="secondary" data-native="operate">Apply native operation</button><button type="button" class="secondary" data-native="inspect">Inspect complete native sources</button></div>
   <pre data-native-sources></pre></details>
  <output role="status" data-native-status></output>
 </div></details>
 </div>`;
 // Local component styles in the app's Studio grammar: quiet, no animated
 // chrome, stable layout (fixed voice rows, fixed segmented groups).
 const style=document.createElement('style');style.textContent=`.native-field-panel{font:12px/1.5 var(--sans,system-ui)}.ni{display:grid;gap:4px}.ni h4{font:italic 16px/1.3 var(--serif,Georgia,serif);font-weight:400;margin:0 0 10px}.ni-block{border-top:1px solid var(--line);padding:14px 0 6px}.ni-status{display:block;font-size:10px;color:var(--muted);margin:0 0 12px;overflow-wrap:anywhere}.ni-open{width:100%;margin:4px 0 8px}.ni-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 12px;font-size:10px}.ni-kv dt{color:var(--muted)}.ni-kv dd{margin:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.ni-voices{width:100%;border-collapse:collapse;font-size:10px;font-variant-numeric:tabular-nums;margin-bottom:10px}.ni-voices caption{text-align:left;color:var(--muted);font-size:9px;padding-bottom:4px}.ni-voices th,.ni-voices td{text-align:right;padding:3px 4px;border-bottom:1px solid var(--line);font-weight:400}.ni-voices th:first-child,.ni-voices td:last-child{text-align:left}.ni-row{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.ni-row>button{flex:1}.ni-label{font-size:10px;margin:6px 0 6px}.ni-seg{flex-wrap:wrap;margin-bottom:10px}.ni-seg button{flex:1 0 auto;min-width:34px;font-variant-numeric:tabular-nums}.ni-seg button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}.ni-refusal{font-size:10px;line-height:1.6;border-left:2px solid var(--accent);padding:4px 8px;margin:4px 0 10px;background:var(--wash)}.ni-effects table{width:100%;border-collapse:collapse;font-size:9px;line-height:1.45}.ni-effects th,.ni-effects td{text-align:left;vertical-align:top;padding:5px 4px;border-bottom:1px solid var(--line);font-weight:400;overflow-wrap:anywhere}.ni-effects th{color:var(--muted)}.ni-effects tr.ni-declared td{background:var(--wash)}.ni-badge{display:inline-block;font-size:8px;letter-spacing:.06em;border:1px solid var(--line);border-radius:3px;padding:0 4px;margin-left:4px;color:var(--accent)}.ni-policy{font-size:10px;line-height:1.6;margin:10px 0}.ni pre,.native-field-depth pre{font:10px/1.4 monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto}.native-field-depth output{display:block;overflow-wrap:anywhere;font-size:10px}.ni [data-ni-v="level"],.ni [data-ni-v="scale"]{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums}`;
 panel.prepend(musicOpen);
 const domainView=new NativeDomainView();
 document.head.append(style);document.body.append(domainView.element);
 let axisError="",domainStamp="",effectsStamp="",busy=false,composing=false,source:{path:string;revision:string;sampleRate:number}|null=null,depthMuted=true;
 const query=<T extends HTMLElement>(selector:string)=>panel.querySelector<T>(selector)!;
 const setText=(key:string,text:string)=>{const node=query(`[data-ni-v="${key}"]`);if(node.textContent!==text)node.textContent=text;};
 const press=(group:string,value:string|null)=>{for(const b of panel.querySelectorAll<HTMLButtonElement>(`[data-ni-set="${group}"]`)){const on=String(b.dataset.value===value);if(b.getAttribute('aria-pressed')!==on)b.setAttribute('aria-pressed',on);}};
 const statusLine=(reading:any)=>{
  const s=reading.status,sound=reading.muted?'sound off':'sound on';
  if(s==='manual')return reading.reason??'Not open.';if(s==='opening')return 'Opening — composing the event with QL…';
  if(s==='following')return `Live · ${sound} · presented ${reading.native?.presented?.generation??'—'} / ${reading.native?.presented?.samples_elapsed??'—'} samples`;
  if(s==='held')return `Held — ${reading.reason??'explicit hold'}. Resume field to continue.`;
  return `Unavailable — ${reading.reason??'native owner unavailable'}`;
 };
 const acting=(a:SceneActing|null,instrument:any,reading:any)=>{
  if(!a)return;
  setText('event',`${a.event_ref} · ${a.subject_ref}`);
  setText('sky',a.sky.kind==='dated'?`${a.sky.label}${a.observations_unix_ms!=null?` · bodies at ${when(a.observations_unix_ms)}`:''}`:`No dated sky — the event's own world observations (${when(a.observations_unix_ms)})`);
  setText('m1',`tick ${a.m1.tick12} of 12 · cycle ${a.m1.cycle} · revision ${a.m1.revision}${instrument.sources_stale?` (owner now at revision ${a.influence_m1_revision??'—'})`:''}`);
  setText('lens',`${a.m1.lens} (${a.m1.lens12} of 0–11)`);
  setText('cf',`${a.m1.context} · ${a.m1.mode}`);
  const ratio=a.harmonic.ratio?`${a.harmonic.ratio[0]}:${a.harmonic.ratio[1]}`:'—';
  setText('harmonic',a.harmonic.source.selection==='canonical-basis'?`native basis ${a.harmonic.source.index+1} of 8 · ${ratio}`:`selected source row · ${ratio}`);
  setText('m3',`${a.m3.rna?'RNA':'DNA'} · ${a.m3.sequence} · ${a.m3.codon_ref}`);
  setText('address',a.address72==null?'—':`${a.address72} of 72`);
  setText('generation',`${a.generation??reading.native?.acknowledged?.generation??'—'} (native), M1 revision ${a.influence_m1_revision??a.m1.revision}`);
  a.voices.forEach((v,i)=>{const row=query(`[data-ni-voice="${i}"]`),cells=row.querySelectorAll('td'),values=[`${v.longitude_degrees.toFixed(1)}°`,v.frequency_hz.toFixed(2),`${v.m}×${v.n}`];values.forEach((t,j)=>{if(cells[j].textContent!==t)cells[j].textContent=t;});});
  press('lens',String(a.m1.lens12));press('cf',String(a.m1.context_frame));
  press('harmonic',a.harmonic.source.selection==='canonical-basis'?String(a.harmonic.source.index):'row');press('rna',String(a.m3.rna));
  if(a.ratio_basis.length===8)for(const b of panel.querySelectorAll<HTMLButtonElement>('[data-ni-set="harmonic"]')){const r=b.dataset.value==='row'?null:a.ratio_basis[Number(b.dataset.value)];if(r){const t=`${r[0]}:${r[1]}`;if(b.textContent!==t){b.textContent=t;b.title=`Native harmonic basis ${Number(b.dataset.value)+1} of 8 (${t})`;}}}
 };
 const effects=(trace:any,a:SceneActing|null)=>{
  const stamp=JSON.stringify([trace?.effects,a?.material]);if(stamp===effectsStamp)return;effectsStamp=stamp;
  const node=query('[data-ni-v="effects"]');
  if(!trace?.effects){node.textContent='The influence reading appears once the instrument is open.';return;}
  node.innerHTML=`<table><thead><tr><th scope="col">Determinant → through</th><th scope="col">Effect · units / range</th><th scope="col">Timing · consumer</th><th scope="col">Now</th><th scope="col">Warrant</th></tr></thead><tbody>${trace.effects.map((e:any)=>`<tr class="${e.declared_policy?'ni-declared':''}"><td>${esc(e.determinant)} → <code>${esc(e.through)}</code></td><td>${esc(e.effect)} · ${esc(e.units)} / ${esc(e.range)}</td><td>${esc(e.timing)} · ${esc(e.consumer)}; here: ${esc(e.oi_consumer)}${e.acting?'':' (not acting)'}</td><td>${esc(e.value??'—')}</td><td>${esc(e.warrant)}${e.declared_policy?'<span class="ni-badge">declared policy — not source</span>':''}</td></tr>`).join('')}</tbody></table>`;
  const m=a?.material;
  query('[data-ni-v="policy"]').innerHTML=m?`<strong>Material policy</strong><span class="ni-badge">declared policy — not source</span><br>damping ${esc(m.damping_per_second)}/s · strike ${esc(m.strike_metres)} m${m.strike_on_event?' on every event':''} · gain ${esc(m.audio_gain_per_metre)}/m · ${esc(m.metres_per_unit)} m per torus unit. ${esc(a?.material_standing??'')}`:'';
 };
 const update=()=>{
  const reading=controller.reading as any,instrument=reading.instrument,open=!!reading.lease||reading.status==='opening';
  const authoring=controller.sourceAuthorshipReading as any;
  sourceAuthorship.hidden=!authoring;
  if(authoring){
   sourceAuthorshipSummary.textContent=authoring.origin?.kind==='accepted_original'?'Source intent · saved original':authoring.origin?.kind==='commissioned_draft'?'Source intent · editable commissioned draft':'Source intent · unavailable';
   const authored=authoring.authorship,profile=authored?.profile;
   sourceAuthorshipBody.textContent=profile?`Participation: ${profile.participation}. Content: ${profile.content}. Position: ${profile.position}. Thread: ${profile.thread}. Sequence: ${profile.sequence}. Direction: ${profile.direction}. Actor: ${authored.actor_ref}.`:String(authoring.reason??'The native authoring intent is unavailable.');
   sourceAuthorshipOriginal.textContent=JSON.stringify(authoring,null,2);
  }else{sourceAuthorshipBody.textContent='';sourceAuthorshipOriginal.textContent='';sourceAuthorshipDepth.open=false;}
  panel.setAttribute('aria-busy',String(busy));
  setText('status',statusLine(reading));
  query('[data-ni-closed]').hidden=open;query('[data-ni-open]').hidden=!instrument&&!(composing&&reading.status==='opening');
  for(const b of panel.querySelectorAll<HTMLButtonElement>('[data-ni="open"],[data-ni="open-default"],[data-ni="open-dated"]'))b.disabled=busy||open;
  // The stage overlay is the supplied-owner reading; the scene surface reads here.
  domainView.update(instrument?null:reading.domain,reading.presented_clock,reading.status,reading.native?.presented?.generation);
  const live=!!instrument&&(reading.status==='following'||reading.status==='held');
  let axes:ReturnType<typeof nativeSceneAxes>|null=null;
  try{if(instrument?.influence&&!instrument.influence_stale&&reading.native?.available)axes=nativeSceneAxes(reading.presented_clock);}catch{/* No phase is invented for a refused reading. */}
  for(const axis of [0,1] as const){
   const phase=axes?.[axis===0?'inscription':'lensing'];
   const turns=query<HTMLInputElement>(`[data-ni-axis-turns="${axis}"]`),half=query<HTMLInputElement>(`[data-ni-axis-half="${axis}"]`);
   turns.disabled=half.disabled=busy||!live||!phase;
   if(query(`[data-ni-axis-row="${axis}"]`).dataset.edited!=='true'){turns.value=phase?.turns??'';half.value=phase?String(phase.half_degrees):'';}
   query(`[data-ni-axis-reading="${axis}"]`).textContent=phase?`${phase.turns} turns + ${phase.half_degrees}/2° · presented native cursor`:'Native phase unavailable.';
  }
  query('[data-ni-axis-error]').hidden=!axisError;query('[data-ni-axis-error]').textContent=axisError;
  const damping=query<HTMLInputElement>('[data-ni-damping]');damping.disabled=!live||busy;
  if(document.activeElement!==damping&&instrument?.influence?.material)damping.value=String(instrument.influence.material.damping_per_second);
  for(const b of panel.querySelectorAll<HTMLButtonElement>('[data-ni-set],[data-ni="step"],[data-ni="strike"],[data-ni="set-damping"],[data-ni="restore-opening"],[data-ni="set-axis"]'))b.disabled=!live||(busy&&b.dataset.niSet!=='cadence')||(reducedMotion&&b.dataset.niSet==='cadence'&&Number(b.dataset.value)>1);
  for(const b of panel.querySelectorAll<HTMLButtonElement>('[data-ni="sound"],[data-ni="hold"],[data-ni="resume"],[data-ni="checkpoint"],[data-ni="restore"],[data-ni="follow-scale"],[data-ni="raw"]'))b.disabled=!reading.lease||reading.status==='unavailable';
  for(const b of panel.querySelectorAll<HTMLButtonElement>('[data-ni="set-axis"]'))b.disabled||=!axes;
  query<HTMLButtonElement>('[data-ni="close"]').disabled=!reading.lease&&reading.status!=='unavailable';
  query<HTMLButtonElement>('[data-ni="restore-opening"]').disabled||=!instrument?.opening_event_available;
  if(instrument){
   acting(instrument.acting,instrument,reading);
   const c=instrument.cadence;
   press('cadence',c.playing?String(c.rate):'hold');
   setText('cadence',c.playing
    ?`Playing ${c.rate} tick${c.rate===1?'':'s'}/s (${c.source}). Achieved ${c.achieved_ticks_per_second.toFixed(2)}/s · ${c.applied} applied · ${c.skipped} skipped while the owner was busy${c.suspended?` · ${c.suspended} suspended while held`:''}.`
    :c.rate?`Cadence held${c.stopped&&c.stopped!=='held'?` (${c.stopped})`:''}. Last run: ${c.applied} ticks applied, ${c.skipped} skipped.`:'Cadence held. 1 tick/s follows the M3/M4′ world clock; 12 ticks/s is PPS\'s user-facing tick.');
   const refusal=query('[data-ni-v="refusal"]');refusal.hidden=!instrument.refusal;
   if(instrument.refusal)setText('refusal',`Refused (${instrument.refusal.operation}): ${instrument.refusal.reason}`);
   effects(reading.causal_trace,instrument.acting);
   const pose=reading.physical_form_actuator;
   setText('pose',`M3 physical form pose: not actuated — ${pose?.reason??'unavailable'}`);
  }
  const sound=query<HTMLButtonElement>('[data-ni="sound"]');sound.setAttribute('aria-pressed',String(!reading.muted));sound.textContent=reading.muted?'Sound on':'Sound off';
  const audio=reading.native?.audio;
  setText('sound',reading.muted?'Muted.':`Sounding · ${audio?.status??'—'} · device epoch ${audio?.device_epoch??'—'}`);
  setText('level',`${Number(reading.presentation_level.value).toFixed(2)}×`);
  setText('scale',reading.presentation_units_per_metre==null?'—':`${reading.presentation_units_per_metre} / m${reading.presentation_mode==='manual-presentation-override'?' (override)':''}`);
  // Inspect depth: the supplied-owner controls keep their verbatim readback.
  const stamp=JSON.stringify(reading.domain);
  if(reading.domain&&domainStamp!==stamp&&!busy){
   domainStamp=stamp;
   query<HTMLInputElement>('[name="native-row"]').value=String(reading.domain.m1.row12);
   query<HTMLInputElement>('[name="native-tick"]').value=String(reading.domain.m1.tick12);
   const modes=query<HTMLSelectElement>('[name="native-mode"]'),prior=modes.value;
   modes.replaceChildren(...reading.domain.m2.modes.map((mode:any)=>{const option=document.createElement('option');option.value=mode.ref;option.textContent=`${mode.ref} · ${mode.frequency_hz} Hz`;return option;}));
   if(reading.domain.m2.modes.some((mode:any)=>mode.ref===prior))modes.value=prior;
   query<HTMLInputElement>('[name="native-damping"]').value=String(reading.domain.m2.modes.find((mode:any)=>mode.ref===modes.value)?.damping_per_second??0);
   query<HTMLSelectElement>('[name="native-rna"]').value=String(reading.domain.m3.rna);
  }
  query('output[data-native-status]').textContent=reading.reason??`${reading.status} · ${reading.presentation_mode} · ${reading.native?.acknowledged?.generation??'—'} / ${reading.native?.acknowledged?.samples_elapsed??'—'}`;
  query<HTMLButtonElement>('[data-native="connect"]').disabled=busy||!source||!['manual','unavailable'].includes(reading.status)||!!reading.lease;
  for(const command of ['resume','mute','scale','follow','operate','inspect','row','tick','transcription','damping','axis'])query<HTMLButtonElement>(`[data-native="${command}"]`).disabled=busy||!reading.lease||reading.status==='unavailable';
  for(const input of panel.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('.native-field-depth input,.native-field-depth select,.native-field-depth textarea'))input.disabled=busy;
  if(instrument)for(const command of ['row','tick','transcription','damping'])query<HTMLButtonElement>(`[data-native="${command}"]`).disabled=true;
 };
 // Returned values replace the stage's status line, never a raw dump.
 const fail=(error:unknown)=>{
  const reading=controller.reading;
  // The uncertain native owner retains its literal refusal. UI cleanup must
  // not replace it with a differently formatted copy of the rejected Error.
  controller.reason=reading.status==='following'||reading.status==='held'||
   (reading.status==='unavailable'&&reading.native?.available===false)
   ?reading.reason:String(error instanceof Error?error.message:error);
 };
 const run=async(action:()=>Promise<unknown>|unknown)=>{if(busy)return;busy=true;update();try{await action();}catch(error){fail(error);}finally{busy=false;update();}};
 const open=(sky:NativeSky)=>run(async()=>{composing=true;try{await controller.compose({sky});onResumeApplication();}finally{composing=false;}});
 const click=async(event:Event)=>{
  const target=event.target as HTMLElement;
  const set=target.closest<HTMLButtonElement>('button[data-ni-set]');
  if(set){
   const group=set.dataset.niSet!,value=set.dataset.value!;
   if(group==='cadence'){try{if(value==='hold')controller.pause('held by you');else controller.play(Number(value));}catch(error){fail(error);}update();return;}
   if(set.getAttribute('aria-pressed')==='true')return;
   await run(()=>group==='lens'?controller.edit({kind:'lens',lens12:Number(value)})
    :group==='cf'?controller.edit({kind:'context-frame',context_frame:Number(value)})
    :group==='harmonic'?controller.edit({kind:'harmonic',source:value==='row'?{selection:'selected-source-row'}:{selection:'canonical-basis',index:Number(value)}})
    :controller.edit({kind:'transcription',rna:value==='true'}));
   return;
  }
  const button=target.closest<HTMLButtonElement>('button[data-ni]');
  if(button){
   const op=button.dataset.ni;
   // Stop/release remain operable while a native reply is pending.
   // A held field suspends the cadence; Resume field continues it.
   if(op==='hold'){controller.hold('held by you');update();return;}
   if(op==='close'){await controller.release();update();return;}
   if(op==='open')return open('now');
   if(op==='open-default')return open('none');
   if(op==='open-dated'){const epoch=query<HTMLInputElement>('[name="ni-epoch"]').value.trim();if(!epoch){controller.reason='Name a dated sky epoch first';update();return;}return open({epoch});}
   if(op==='set-axis'){
    const axis=Number(button.dataset.niAxis),turns=query<HTMLInputElement>(`[data-ni-axis-turns="${axis}"]`).value.trim(),value=query<HTMLInputElement>(`[data-ni-axis-half="${axis}"]`).value.trim();
    axisError='';return run(async()=>{try{await controller.setAxis(axis as 0|1,{turns,half_degrees:value?Number(value):NaN});query(`[data-ni-axis-row="${axis}"]`).dataset.edited='false';}catch(error){axisError=String(error instanceof Error?error.message:error);throw error;}});
   }
   if(op==='step')return run(()=>controller.m1Advance(1));
   if(op==='strike')return run(()=>controller.strike());
   if(op==='set-damping'){const value=query<HTMLInputElement>('[data-ni-damping]').value.trim();if(!value)return run(()=>Promise.reject(new Error('Enter a damping value first.')));const submitted=Number(value);return run(()=>controller.setDamping(submitted));}
   if(op==='restore-opening')return run(()=>controller.restoreOpening());
   if(op==='sound')return run(()=>controller.setMuted(!controller.reading.muted));
   if(op==='resume')return run(async()=>{await controller.resume();onResumeApplication();});
   if(op==='checkpoint')return run(()=>controller.saveCheckpoint());
   if(op==='restore')return run(()=>controller.restoreCheckpoint());
   if(op==='follow-scale')return run(()=>{controller.followDomain();query<HTMLInputElement>('[data-ni-range="scale"]').value=String(controller.reading.presentation_units_per_metre);});
   if(op==='raw')return run(async()=>{const r=controller.reading as any;query('pre[data-ni-raw]').textContent=JSON.stringify({influence:r.instrument?.influence??null,current_event:controller.currentEvent,reading:{...r,instrument:{...r.instrument,influence:'above'}}},null,2);});
   return;
  }
  const depth=target.closest<HTMLButtonElement>('button[data-native]');if(!depth)return;
  const operation=depth.dataset.native;
  if(operation==='disconnect'){await controller.release();update();return;}
  if(operation==='hold'){controller.hold();update();return;}
  if(busy)return;
  // Capture the person's input before any returned basis updates the form.
  const submitted=Object.fromEntries([...panel.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('[name]')].map(input=>[input.name,input.value]));
  await run(async()=>{
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
    await controller.connect(source.path,source.revision,source.sampleRate);depthMuted=true;query('[data-native="mute"]').textContent='Unmute';onResumeApplication();
   }else if(operation==='resume'){await controller.resume();onResumeApplication();}
   else if(operation==='mute'){depthMuted=!depthMuted;controller.setMuted(depthMuted);depth.textContent=depthMuted?'Unmute':'Mute';}
   else if(operation==='scale')controller.setScale(Number(submitted["native-scale"]));
   else if(operation==='follow'){controller.followDomain();query<HTMLInputElement>('[name="native-scale"]').value=String(controller.reading.presentation_units_per_metre);}
   else if(operation==='operate')await controller.operate(JSON.parse(submitted["native-command"]));
   else if(operation==='tick')await controller.editBasis({kind:'carrier-tick',tick12:Number(submitted["native-tick"])});
   else if(operation==='row')await controller.editBasis({kind:'harmonic-row',row12:Number(submitted["native-row"])});
   else if(operation==='transcription')await controller.editBasis({kind:'transcription',rna:submitted["native-rna"]==='true'});
   else if(operation==='damping')await controller.editBasis({kind:'damping',mode_ref:submitted["native-mode"],per_second:Number(submitted["native-damping"])});
   else if(operation==='axis'){
    const turns=submitted["native-turns"].trim(),value=submitted["native-phase"].trim();
    await controller.setAxis(Number(submitted["native-axis"]) as 0|1,{turns,half_degrees:value?Number(value):NaN});
   }
   else if(operation==='inspect')query('pre[data-native-sources]').textContent=JSON.stringify(await controller.inspectSources(),null,2);
  });
 };
 const range=(event:Event)=>{
  const axisRow=(event.target as HTMLElement).closest<HTMLElement>('[data-ni-axis-row]');if(axisRow)axisRow.dataset.edited='true';
  const input=(event.target as HTMLElement).closest<HTMLInputElement>('input[data-ni-range]');if(!input)return;
  try{if(input.dataset.niRange==='level')controller.setLevel(Number(input.value));else if(controller.reading.lease)controller.setScale(Number(input.value));}catch(error){fail(error);}update();
 };
 const modeChange=()=>{const reading=controller.reading,ref=query<HTMLSelectElement>('[name="native-mode"]').value;query<HTMLInputElement>('[name="native-damping"]').value=String(reading.domain?.m2.modes.find(mode=>mode.ref===ref)?.damping_per_second??0);};
 query('[name="native-mode"]').addEventListener('change',modeChange);
 panel.addEventListener('click',click);panel.addEventListener('input',range);
 controller.onChange=()=>{update();onNativeChanged?.();};
 const visibility=()=>{if(document.hidden)controller.hold('document hidden');};
 document.addEventListener('visibilitychange',visibility);
 const pagehide=()=>{void controller.dispose();};window.addEventListener('pagehide',pagehide);
 // Readback at human cadence; native scheduling stays in InstrumentSession.
 // A cadence-stale event basis is re-read here, never inside a beat.
 const timer=window.setInterval(()=>{void controller.refreshSources();update();},250);
 update();
 return {controller,panel,musicPanel,music,showMusic,dispose:async()=>{let panicFailure:unknown,closeFailure:unknown;try{await music.close();}catch(error){panicFailure=error;fail(error);}finally{musicPanel.remove();clearInterval(timer);panel.removeEventListener('click',click);panel.removeEventListener('input',range);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);panel.remove();domainView.dispose();style.remove();try{await controller.dispose();}catch(error){closeFailure=error;}}if(panicFailure&&closeFailure)throw new AggregateError([panicFailure,closeFailure],'Musical panic and exact owned native close both failed.');if(panicFailure)throw panicFailure;if(closeFailure)throw closeFailure;}};
}
