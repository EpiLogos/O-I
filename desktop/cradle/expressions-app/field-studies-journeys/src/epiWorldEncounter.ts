import type {NativeAxisPhase,NativeSceneAxes} from './native-field/axis';
/** A small entrance and focused disclosure over the actual native world.
 * No coordinate adoption, domain computation or alternate scene store. */
import {esc} from './icons.js';
import {recoveryFailureMessage,recoveryFailureInspectHTML} from './recoverySizeDiagnostic.js';
import {naraInstrumentRequest} from './kernelExpressions.js';
import type {ExpressionDocument} from '../../../src/expression/types.js';
import type {BimbaSourceContent} from '../../../src/nara/coordinateExpression.js';
import type {EpiWorldRecord} from './epiWorldProduction.js';
import type {RegisterRole} from './epiWorldMaterial.js';
import './epiWorldEncounter.css';

export interface EpiEncounterHost {
 active:()=>boolean;document:()=>ExpressionDocument|null;record:()=>EpiWorldRecord|null;
 participant?:()=>{name:string;occasion_utc:string;observer_standing:'geocentric-location-independent';occasion_standing?:'saved-occasion';natal_place_label?:string}|null;
 scene:()=>string;selected:()=>string|null;identity:()=>void;ask:()=>Promise<void>;
 navigate:(sceneRef:string,entityRef?:string)=>Promise<void>;
 step:()=>Promise<void>;sound:(enabled:boolean)=>void;quiet:(enabled:boolean)=>void;
 save:()=>Promise<void>;reset:()=>Promise<void>;
 axes?:()=>NativeSceneAxes|null;setAxis?:(axis:0|1,phase:NativeAxisPhase)=>Promise<void>;form?:()=>void;
 damping:()=>number;setDamping:(perSecond:number)=>Promise<void>;
}
export function installEpiWorldEncounter(host:EpiEncounterHost){
 const bar=document.createElement('nav');bar.className='epi-world-entrance';bar.setAttribute('aria-label','Epi world');document.body.append(bar);
 const disclosure=document.createElement('dialog');disclosure.className='epi-source-dialog';disclosure.setAttribute('aria-label','Bimba source');document.body.append(disclosure);
 let busy=false,notice='',failure='',failureGeneration=0,sound=false,quiet=matchMedia('(prefers-reduced-motion: reduce)').matches,generation=0,operationGeneration=0;
 let shown:BimbaSourceContent|null=null,returnTo:{scene:string;entity:string|null}|null=null,query='';
 let register:{role:RegisterRole;entity_ref:string;title:string;index:number|null}|null=null;
 let skyBody:EpiWorldRecord['world']['scene']['bodies'][number]|null=null;
 const registerRoles:readonly RegisterRole[]=['degree','governor','decan','codon','skin','aperture'];
 const run=async(operation:()=>Promise<void>)=>{if(busy)return;const at=++operationGeneration;busy=true;failure='';failureGeneration++;render();try{await operation();}catch(e){if(at===operationGeneration){notice='';failure=e instanceof Error?e.message:String(e);failureGeneration++;}}finally{if(at===operationGeneration){busy=false;render();}}};
 function selectedContent(){
  const d=host.document(),r=host.record(),e=host.selected()?d?.entities[host.selected()!]:null;
  if(!e)return null;
  // A form process keeps changing source readings under one stable subject.
  const exact=(e.subject?.subject_ref.startsWith('ql:m-coordinate:')?e.subject.subject_ref:undefined)??e.subject?.readings.find(s=>s.ref.startsWith('ql:m-coordinate:'))?.ref
   ??e.subject?.sources.find(s=>s.ref.startsWith('ql:m-coordinate:'))?.ref;
  return{entity:e,ref:exact??e.subject?.subject_ref??r?.receiving.personal.canonical_locus};
 }
 async function read(ref:string){
  const at=++generation;
  const r=await naraInstrumentRequest({operation:'source',coordinate_ref:ref});
  if(at!==generation)return;
  if(r.schema!=='ql.bimba-coordinate-content/v1')throw Error('The selected object did not resolve to its actual full Bimba source.');
  const content=r as unknown as BimbaSourceContent;
  if(content.source_revision!==host.record()?.inventory[0]?.source_revision)throw Error('Bimba changed since this world was constructed. Rebuild its current material before using that source.');
  shown=content;renderSource();
 }
 function renderSource(){
  const r=host.record(),i=shown?.identity;
  const members=register?r?.register_members[register.role]:null,member=members&&register?.index!==null?members[register!.index!]:null;
  // Native # aliases resolve through the admitted M tree before raw graph
  // spelling. Distinct graph meta #0…#5 require their explicit full-source ref.
  const sourceRoute=(ref:string)=>r?.inventory.find(row=>[row.native_coordinate,row.ql_coordinate].includes(ref))
   ??r?.inventory.find(row=>[row.canonical_ref,row.full_source_ref,row.coordinate].includes(ref));
  const memberSources=member?[...(member.coordinate_ref?[{ref:member.coordinate_ref,revision:member.reading.revision,availability:member.reading.availability}]:[]),member.reading,...member.source_refs]:[];
  const matches=(r?.inventory??[]).filter(x=>!query||[x.coordinate,x.identity,...(Array.isArray(x.aliases)?x.aliases.map(String):[])].some(v=>v.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).slice(0,64);
  disclosure.innerHTML=`<header><div><small>Bimba · complete source</small><h2>${esc(register?register.title:i?.title??skyBody?.body??'Find a subject')}</h2></div><button type="button" data-epi-source="return">Return to the same field</button></header>
   ${skyBody?`<section class="epi-register-disclosure"><h3>${esc(skyBody.body)} · actual sky occurrence</h3><p>${esc(r!.world.scene.epoch_utc)} · ${skyBody.longitude_deg}° geocentric longitude${skyBody.retrograde?' · retrograde':''}</p><p>${skyBody.planet_ref?'Its canonical planetary subject is below.':'This admitted sky occurrence has no dedicated planetary Bimba coordinate.'} ${skyBody.voice?'Its voice is qualified by the native scene.':'No voice is allocated to this body in the native scene.'}</p><p>${esc(r!.world.snapshot_ref)}</p><details><summary>Exact native body and sky-source basis</summary><pre>${esc(JSON.stringify({body:skyBody,snapshot_ref:r!.world.snapshot_ref,request:r!.world.sky.request,provider:r!.world.sky.provider,source:r!.source_basis.scene},null,2))}</pre></details></section>`:''}
   ${members?`<section class="epi-register-disclosure"><p>${members.length} actual source members. Choose a mark to disclose its reading and source. The containing ring keeps its own subject.</p><div class="epi-register-members" aria-label="${esc(register!.role)} register members">${members.map((row,index)=>`<button type="button" data-epi-member="${index}" aria-pressed="${register!.index===index}"><strong>${esc(row.title)}</strong>${row.ground?`<small>${esc(row.ground.role==='fibonacci'?'Fibonacci ground':'Void ring')}</small>`:''}</button>`).join('')}</div>${member?`<article class="epi-register-reading"><h3>${esc(member.title)}</h3><p>${esc(member.standing.replaceAll('-',' '))}${member.display?` · displayed at ${member.display.angle_degrees}° (${esc(member.display.standing.replaceAll('-',' '))})`:''}</p><p>${esc(member.reading.ref)}</p><ul>${memberSources.map(reading=>{const route=sourceRoute(reading.ref);return`<li>${route?`<button type="button" data-epi-ref="${esc(String(route.canonical_ref??route.full_source_ref))}">${esc(route.identity)} · ${esc(route.coordinate)}</button>`:`<span>${esc(reading.ref)}</span>`}<small>${esc(reading.revision??'')} · ${esc(reading.availability)}</small></li>`;}).join('')}</ul><details><summary>Exact admitted register row</summary><pre>${esc(JSON.stringify(member,null,2))}</pre></details></article>`:''}</section>`:''}
   <label>Find a coordinate or subject<input type="search" value="${esc(query)}" data-epi-search aria-label="Find a Bimba subject"></label>
   <div class="epi-source-results">${matches.map(x=>`<button type="button" data-epi-ref="${esc(String(x.canonical_ref))}"><strong>${esc(x.identity)}</strong><small>${esc(x.coordinate)}</small></button>`).join('')}</div>
   ${shown?`<p>${esc(i!.coordinate)} · ${esc(i!.uuid??'source identity')}</p><details open><summary>Original properties and supporting text</summary><dl>${Object.entries(i!.properties??{}).map(([k,v])=>`<dt>${esc(k.replaceAll('_',' '))}</dt><dd>${esc(typeof v==='string'?v:JSON.stringify(v,null,2))}</dd>`).join('')}</dl></details>
   <details open><summary>Typed relations · ${shown.relations.length}</summary><ul>${shown.relations.map(e=>`<li><button type="button" data-epi-ref="${esc(e.from_coordinate===i!.coordinate?e.to_ref:e.from_ref)}">${esc(e.from_coordinate)} → ${esc(e.kind)} → ${esc(e.to_coordinate)}</button><details><summary>Qualification and direction</summary><pre>${esc(JSON.stringify(e.properties,null,2))}</pre><small>${esc(e.relation_ref)}</small></details></li>`).join('')}</ul></details>
   <details><summary>Exact source revision</summary><p>${esc(shown.source_revision)}</p><p>${esc(i!.full_source_ref)}</p><p>${esc(i!.full_properties_ref)}</p></details>`:''}`;
 }
 async function source(ref?:string){
  const record=host.record();if(!record)return;
  returnTo??={scene:host.scene(),entity:host.selected()};shown=null;query='';renderSource();
  const selected=selectedContent(),role=registerRoles.find(role=>host.selected()===`${record.world.instance_ref}:entity:world-register-${role}`);
  skyBody=record.world.scene.bodies.find(body=>host.selected()===`${record.world.instance_ref}:entity:world-planet-${body.body.toLowerCase()}`)??null;
  register=role?{role,entity_ref:host.selected()!,title:selected?.entity.title??`${role} register`,index:null}:null;renderSource();
  if(!disclosure.open)disclosure.showModal();
  if(skyBody&&!skyBody.planet_ref&&!ref){if(selected?.entity.subject?.subject_ref!==record.world.snapshot_ref)throw Error('The sky occurrence lost its exact native snapshot subject.');return;}
  if(ref??selectedContent()?.ref)await read((ref??selectedContent()!.ref)!);
 }
 function render(){
  const r=host.record(),d=host.document(),selected=selectedContent(),participant=host.participant?.(),axes=host.axes?.()??null;bar.hidden=!host.active()&&!r;
  const scenes=d?.scenes??[];
  const bodies=scenes.find(s=>s.scene_ref===host.scene())?.entity_refs.map(ref=>d!.entities[ref]).filter(Boolean)??[];
  const occasion=participant?.occasion_utc??(r?String((r.world.sky.request as {epoch?:string})?.epoch??r.world.event_ref):'');
  const identityTitle=participant?.natal_place_label?`Your saved identity · natal place: ${participant.natal_place_label}`:'Your saved personal identity';
  const missingCurrent='The saved native personal current has no protected checkpoint; explicitly use this saved identity to admit a new current';
  const missingCustody=failure===missingCurrent||failure===`Error: ${missingCurrent}`;
  const failureMessage=missingCustody?'Your saved personal reading is unavailable on this owner. Open Your identity, choose the saved profile, then Use saved identity to admit a new reading.':recoveryFailureMessage(failure,!!recoveryFailureInspectHTML(failure,esc));
  const failureInspect=missingCustody?`<details class="epi-native-refusal" data-native-personal-current-refusal><summary>Inspect native refusal</summary><pre>${esc(failure)}</pre></details>`:recoveryFailureInspectHTML(failure,esc);
  const playOpen=bar.querySelector<HTMLDetailsElement>('.epi-play')?.open??false;
  bar.innerHTML=`<div class="epi-world-row epi-world-heading"><div class="epi-world-location"><span class="epi-world-brand">Epi-Logos</span><strong>${esc(r?participant?.name??'Your world':'A cosmic field, situated with you')}</strong>${r?'<small>Earth observer · location-independent sky</small>':''}</div>
   ${r?`<div class="epi-world-scenes">${scenes.map(s=>`<button type="button" data-epi-scene="${esc(s.scene_ref)}" ${busy?'disabled':''} aria-current="${host.scene()===s.scene_ref?'page':'false'}">${esc(s.title)}</button>`).join('')}</div><time class="epi-world-occasion" datetime="${esc(occasion)}">${participant?.occasion_standing==='saved-occasion'?'Saved occasion · ':''}${esc(occasion.replace('T',' · ').replace('Z',' UTC'))}</time>`:`<button type="button" data-epi="identity" ${busy?'disabled':''}>Enter your world</button>`}</div>
   ${r?`<div class="epi-world-row epi-world-tools"><label class="epi-body-choice"><span>Choose a body</span><select data-epi-body aria-label="Choose a native body in this scene" ${busy?'disabled':''}><option value="">Choose a body…</option>${bodies.map(body=>`<option value="${esc(body.entity_ref)}" ${host.selected()===body.entity_ref?'selected':''}>${esc(body.title)}</option>`).join('')}</select></label><button type="button" data-epi="identity" ${busy?'disabled':''} title="${esc(identityTitle)}">Your identity</button><button type="button" data-epi="source" ${busy?'disabled':''} title="${esc(selected?'Open the full Bimba source of '+selected.entity.title:'Explore the complete Bimba source')}">${selected?'Source · '+esc(selected.entity.title):'Explore Bimba'}</button><button type="button" data-epi="ask" ${!selected||busy?'disabled':''}>With Nara / Epii</button>
   <details class="epi-play" ${playOpen?'open':''}><summary>Shape & play</summary><div><p>Advance one tick moves the M1/M3 source clocks by 30° and aligns Clock A with their new position. Its form may change or remain invariant. Clock B and the selected lens reading are retained.</p><label>Damping · decay (s⁻¹) <input type="number" min="0" max="1000000" step="any" data-epi-damping value="${esc(host.damping())}" ${busy?'disabled':''}></label><button type="button" data-epi="set-damping" ${busy?'disabled':''}>Apply damping</button><small>Declared material policy. Continues the resident voices without a strike or clock change.</small><fieldset data-epi-axis-controls ${busy||!axes||!host.setAxis?'disabled':''}><legend>Inscription & lensing</legend><p>Two continuous circles. Adjusting one keeps the other circle, person, sky, codon and static aperture. Use “Advance one tick” for the joined M1/M3 source clocks. These phases show the retained reading at rest and the presented native cursor during play.</p>${([['0','Clock A · inscription'],['1','Clock B · lensing']] as const).map(([axis,label])=>{const phase=axes?.[axis==='0'?'inscription':'lensing'];return `<label>${label} · whole turns <input type="text" spellcheck="false" inputmode="numeric" data-epi-axis-turns="${axis}" value="${esc(phase?.turns??'')}" aria-label="${label} whole turns"></label><label>Half-degrees (0–719) <input type="number" min="0" max="719" step="1" data-epi-axis-half="${axis}" value="${phase?phase.half_degrees:''}" aria-label="${label} half-degrees"></label><button type="button" data-epi="set-axis" data-epi-axis="${axis}">Apply ${axis==='0'?'inscription':'lensing'}</button>`;}).join('')}</fieldset><button type="button" data-epi="form" ${busy||!host.form?'disabled':''}>Personal form & static aperture</button><button type="button" data-epi="step" ${busy?'disabled':''}>Advance one tick</button><button type="button" data-epi="sound" ${busy?'disabled':''} aria-pressed="${sound}">${sound?'Mute':'Hear the field'}</button><button type="button" data-epi="quiet" aria-pressed="${quiet}">${quiet?'Resume motion':'Quiet reading'}</button><button type="button" data-epi="reset" ${busy?'disabled':''}>Return to opening</button><button type="button" data-epi="save" ${busy?'disabled':''}>Save this world</button></div></details>
   ${busy||notice?`<span role="status">${esc(busy?'Receiving the native operation…':notice)}</span>`:''}</div>`:''}${failure?`<span role="alert">${esc(failureMessage)}</span>${failureInspect}`:''}`;
 }
 bar.addEventListener('click',e=>{
  const target=(e.target as HTMLElement).closest<HTMLElement>('[data-epi],[data-epi-scene]');if(!target||busy)return;
  if(target.dataset.epiScene){void run(()=>host.navigate(target.dataset.epiScene!));return;}
  switch(target.dataset.epi){
   case 'identity':host.identity();break;
   case 'source':void run(()=>source());break;
   case 'ask':void run(host.ask);break;
   case 'set-axis':{
    const axis=Number(target.dataset.epiAxis),turns=bar.querySelector<HTMLInputElement>(`[data-epi-axis-turns="${axis}"]`)?.value.trim()??'',value=bar.querySelector<HTMLInputElement>(`[data-epi-axis-half="${axis}"]`)?.value.trim()??'';
    void run(async()=>{if(!host.setAxis)throw Error('This presentation has no admitted native axis owner.');if(axis!==0&&axis!==1)throw Error('Choose inscription or lensing.');await host.setAxis(axis,{turns,half_degrees:value?Number(value):NaN});});break;
   }
   case 'form':host.form?.();break;
   case 'step':void run(host.step);break;
   case 'set-damping':{const value=bar.querySelector<HTMLInputElement>('[data-epi-damping]')?.value.trim();const submitted=value?Number(value):NaN;void run(()=>host.setDamping(submitted));break;}
   case 'reset':void run(host.reset);break;
   case 'save':void run(host.save);break;
   case 'sound':try{host.sound(!sound);sound=!sound;render();}catch(e){failure=String(e);failureGeneration++;render();}break;
   case 'quiet':quiet=!quiet;host.quiet(quiet);render();break;
  }
 });
 bar.addEventListener('change',e=>{const select=e.target as HTMLSelectElement;if(!select.matches('[data-epi-body]')||!select.value||busy)return;const current=host.document()?.scenes.find(s=>s.scene_ref===host.scene());if(!current?.entity_refs.includes(select.value))return;void run(()=>host.navigate(host.scene(),select.value));});
 const returned=async()=>{generation++;disclosure.close();register=null;skyBody=null;const saved=returnTo;returnTo=null;if(saved)await host.navigate(saved.scene,saved.entity??undefined);};
 // A new source choice or Return supersedes a reversible disclosure read.
 // Available marks must respond immediately while their full source loads;
 // a late read or its finally block cannot overwrite the newer choice.
 const replaceDisclosureOperation=(operation:()=>Promise<void>)=>{generation++;operationGeneration++;busy=false;return run(operation);};
 const returnFromSource=()=>replaceDisclosureOperation(returned);
 disclosure.addEventListener('click',e=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-epi-ref],[data-epi-source],[data-epi-member]');if(t?.dataset.epiRef)void replaceDisclosureOperation(()=>read(t.dataset.epiRef!));else if(t?.dataset.epiMember!==undefined&&register)void replaceDisclosureOperation(async()=>{const index=Number(t.dataset.epiMember),member=host.record()?.register_members[register!.role][index];if(!Number.isSafeInteger(index)||!member)throw Error('The selected register member is absent from this native world.');register!.index=index;shown=null;renderSource();if(member.coordinate_ref)await read(member.coordinate_ref);});else if(t?.dataset.epiSource==='return')void returnFromSource();});
 disclosure.addEventListener('input',e=>{const t=e.target as HTMLInputElement;if(!t.matches('[data-epi-search]'))return;query=t.value;const position=t.selectionStart;renderSource();const input=disclosure.querySelector<HTMLInputElement>('[data-epi-search]');input?.focus();if(input?.type!=='search'&&position!==null)input?.setSelectionRange(position,position);});
 disclosure.addEventListener('cancel',e=>{e.preventDefault();void returnFromSource();});
 bar.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.matches('[data-epi-axis-turns],[data-epi-axis-half]')){const axis=input.dataset.epiAxisTurns??input.dataset.epiAxisHalf;for(const field of bar.querySelectorAll<HTMLInputElement>(`[data-epi-axis-turns="${axis}"],[data-epi-axis-half="${axis}"]`))field.dataset.edited='true';}});
 const phaseTimer=window.setInterval(()=>{if(busy||bar.hidden||document.hidden)return;const axes=host.axes?.(),controls=bar.querySelector<HTMLFieldSetElement>('[data-epi-axis-controls]');if(controls)controls.disabled=!axes||!host.setAxis;if(!axes)return;for(const axis of [0,1] as const){const phase=axes[axis===0?'inscription':'lensing'],turns=bar.querySelector<HTMLInputElement>(`[data-epi-axis-turns="${axis}"]`),half=bar.querySelector<HTMLInputElement>(`[data-epi-axis-half="${axis}"]`);if(turns&&half&&turns.dataset.edited!=='true'&&half.dataset.edited!=='true'){turns.value=phase.turns;half.value=String(phase.half_degrees);}}},250);
 if(quiet)host.quiet(true);render();return{refresh:render,source,status(text:string){notice=text;render();},
  // Capture, then acknowledge only the previous failure after the actual
  // native personal rebind/save and consumer admission. A later operation,
  // refusal or destruction invalidates this acknowledgement.
  personalAdmissionAcknowledgement(){const at=failureGeneration,operation=operationGeneration;return()=>{if(!busy&&at===failureGeneration&&operation===operationGeneration){failure='';failureGeneration++;render();}};},
  fail(text:string){notice='';failure=text;failureGeneration++;render();},destroy(){generation++;failureGeneration++;clearInterval(phaseTimer);bar.remove();disclosure.remove();}};
}
