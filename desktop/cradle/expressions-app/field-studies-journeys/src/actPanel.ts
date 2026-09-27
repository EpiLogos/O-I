/** Acts & reusable material in the Expressions app (FX-B4; contract
 * docs/contracts/EXPRESSION-ACT-MATERIAL-V1.md).
 *
 *  Roles     assign a role (`sender`, `goal`, `caption`…) to the selected
 *            object or a text layer of the current Scene — an ordinary,
 *            undoable authoring edit.
 *  Save      "Save as reusable": kind, states/gestures named from Scenes,
 *            entry Scene, playback order and associations → the working
 *            Expression is forked (it keeps no `reuse`), the fork gets
 *            `reuse_set` and is `save_as`'d into the material register.
 *  Material  browse the register (`material_list`), choose a Scene or state,
 *            bind roles to characters/labels/text → `act_open` + `act_select`
 *            performs it into the current native Expression.
 *            A saved Expression can be played whole (`act_play`).
 *  Act       the act's sequence as a timeline: select a point (`act_seek`),
 *            or play it through, stepping forward one passage at a time with
 *            each passage's transition duration and easing.
 *
 * The panel stands beside the app's own saved-scene playback; it owns no
 * store — the kernel document and act are the state. */
import type {Journey,Scene} from './model';
import type {KernelConversion} from './kernelDocumentBridge.js';
import {REUSE_KINDS,STANDARD_ROLES,setRole,roleSlots,buildReuse,remapReuse,materialExpressionRef,parseList,materialFileName,actBindings,actTimeline,nextStep,validName,type ReuseKind,type ReuseForm,type BindingInput,type PlaybackStep,type RoleAccepts,type PassageLike} from './reuse.js';
import {worldRequest,worldAvailable} from './worldChannel.js';

export interface ActPanelHost {
 journey():Journey;
 scene():Scene;
 selected():string[];
 /** An ordinary undoable authoring edit of the working draft. */
 changed(fn:()=>void):void;
 nativeView():KernelConversion|undefined;
 /** Flush the draft natively, then apply changes computed from that view. */
 nativeEdit(changes:(view:KernelConversion)=>Record<string,unknown>[]):Promise<void>;
 expressionRequest(request:Record<string,unknown>):Promise<unknown>;
 /** Follow the native Expression to the owner's newer revision (false: local work kept). */
 advance():Promise<boolean>;
 /** Crossfade the frame over the next performed state (seconds, engine easing). */
 transition(seconds:number,easing?:string):void;
 toast(message:string,ms?:number):void;
}

interface Listing {file_ref:string;revision:string;title:string;kind:ReuseKind;roles:{role:string;accepts:RoleAccepts}[];states:Record<string,string>;gestures:Record<string,unknown>;playback:string[];entry_scene_ref?:string|null;preview_state?:string|null}
interface ListResult {materials:Listing[];folders:Partial<Record<ReuseKind,unknown>>;unreadable:{error:string}[]}
interface ActReading {act_ref:string;expression_ref:string;phase:string;mode:string;position?:number;revision:number;sequence:PassageLike[];summary:string}

const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const ACTOR='human:expressions-app';
const tail=(r:string)=>r.split(':').pop()??r;

export function installActPanel(host:ActPanelHost){
 let open=false,tab:'roles'|'save'|'material'|'act'='roles',busy=false;
 let materials:Listing[]=[],characters:Listing[]=[],chosen:Listing|null=null,kindFilter:ReuseKind|''='';
 let actRef:string|null=null,act:ActReading|null=null,steps:PlaybackStep[]=[],playing=0;
 const panel=document.createElement('aside');panel.id='act-panel';panel.className='act-panel';panel.hidden=true;panel.setAttribute('aria-label','Acts and reusable material');
 const style=document.createElement('style');style.textContent=PANEL_CSS;
 document.head.append(style);document.body.append(panel);
 // Entry beside the app's own "Play saved scenes" transport control.
 const entry=document.createElement('button');entry.type='button';entry.className='act-panel-entry';entry.textContent='Acts';entry.title='Roles, reusable material and act playback';
 entry.addEventListener('click',()=>toggle());
 const anchor=document.getElementById('journey-play');anchor?.after(entry);

 const toggle=(force?:boolean)=>{open=force??!open;panel.hidden=!open;entry.setAttribute('aria-pressed',String(open));if(open)render();};
 const fail=(error:unknown)=>host.toast(error instanceof Error?error.message:String(error),7000);
 const task=async(fn:()=>Promise<void>)=>{if(busy)return;busy=true;render();try{await fn();}catch(e){fail(e);}finally{busy=false;render();}};
 const follow=async(what:string)=>{if(!(await host.advance()))host.toast(`${what} natively. Your newer local edits are kept in the draft; reopen the native Expression to see it.`,7000);};

 function render(){
  if(!open)return;
  const tabs=(['roles','save','material','act'] as const).map(t=>`<button type="button" data-act="tab" data-tab="${t}" aria-pressed="${t===tab}">${{roles:'Roles',save:'Save as reusable',material:'Reusable material',act:'Act'}[t]}</button>`).join('');
  panel.innerHTML=`<header><strong>Acts</strong><nav>${tabs}</nav><button type="button" data-act="close" aria-label="Close">×</button></header><div class="act-body" ${busy?'aria-busy="true"':''}>${
   tab==='roles'?rolesHTML():tab==='save'?saveHTML():tab==='material'?materialHTML():actHTML()}</div>`;
 }

 // --- roles ---------------------------------------------------------------
 function rolesHTML(){
  const s=host.scene(),id=host.selected()[0],entity=s.entities.find(e=>e.id===id);
  const options=`<datalist id="act-roles">${STANDARD_ROLES.map(r=>`<option value="${r}">`).join('')}</datalist>`;
  const slots=roleSlots(host.journey());
  const textRows=s.text.map(t=>`<label class="row"><span>Text “${esc((t.title||t.body||t.kicker||t.id).slice(0,40))}”</span><input data-role-for="${esc(t.id)}" list="act-roles" value="${esc(t.role??'')}" placeholder="no role"></label>`).join('');
  return `${options}<p class="hint">A role marks a placeholder in this Scene that performances bind to a participant, object or text.</p>
   ${entity?`<label class="row"><span>Object “${esc(entity.name)}”</span><input data-role-for="${esc(entity.id)}" list="act-roles" value="${esc(entity.role??'')}" placeholder="no role"></label>`:'<p class="hint">Select an object to give it a role.</p>'}
   ${textRows}<button type="button" data-act="roles-apply">Apply roles</button>
   <h4>Roles in this Expression</h4><ul class="slots">${slots.map(r=>`<li><b>${esc(r.role)}</b> · ${r.slot==='text'?'text':r.accepts} · ${esc(host.journey().scenes.find(x=>x.id===r.sceneId)?.name??'')}</li>`).join('')||'<li>None yet.</li>'}</ul>`;
 }
 function applyRoles(){
  const inputs=[...panel.querySelectorAll<HTMLInputElement>('[data-role-for]')];
  for(const input of inputs){const v=input.value.trim();if(v&&!validName(v))throw new Error(`"${v}" is not a role name (letters, digits, . - _).`);}
  host.changed(()=>{const s=host.scene();for(const input of inputs){const v=input.value.trim();setRole(s,input.dataset.roleFor!,v||null);}});
  host.toast('Roles applied to this Scene.');
 }

 // --- save as reusable ----------------------------------------------------
 function saveHTML(){
  const j=host.journey(),view=host.nativeView();
  const scenes=j.scenes.map(s=>`<tr><td>${esc(s.name)}</td><td><input data-state="${esc(s.id)}" placeholder="state name"></td><td><input data-gesture="${esc(s.id)}" placeholder="gesture name"></td><td><input data-gesture-role="${esc(s.id)}" placeholder="self" list="act-roles"></td><td><input type="checkbox" data-playback="${esc(s.id)}" checked></td></tr>`).join('');
  return `<datalist id="act-roles">${STANDARD_ROLES.map(r=>`<option value="${r}">`).join('')}</datalist>
   ${view?'':'<p class="warn">Save this Expression to a Central file first: reusable material names committed native refs.</p>'}
   <label class="row"><span>Kind</span><select name="kind">${REUSE_KINDS.map(k=>`<option>${k}</option>`).join('')}</select></label>
   <label class="row"><span>Title</span><input name="title" value="${esc(j.name)}" maxlength="256"></label>
   <table class="scenes"><thead><tr><th>Scene</th><th>State</th><th>Gesture</th><th>by role</th><th>Play</th></tr></thead><tbody>${scenes}</tbody></table>
   <label class="row"><span>Entry Scene</span><select name="entry"><option value="">—</option>${j.scenes.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label>
   <label class="row"><span>Preview state</span><input name="preview" placeholder="e.g. idle"></label>
   <fieldset><legend>Associations (comma-separated)</legend>
   ${(['workflow_keys','task_types','skill_set_refs','skill_refs','event_families'] as const).map(k=>`<label class="row"><span>${k.replace(/_/g,' ')}</span><input name="${k}"></label>`).join('')}</fieldset>
   <button type="button" data-act="save-reusable" ${view?'':'disabled'}>Save into the material register</button>`;
 }
 const field=(name:string)=>(panel.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`)?.value??'').trim();
 function readForm():ReuseForm{
  const states:ReuseForm['states']={},gestures:ReuseForm['gestures']={};
  panel.querySelectorAll<HTMLInputElement>('[data-state]').forEach(i=>{const v=i.value.trim();if(v){if(v in states)throw new Error(`State "${v}" is named twice.`);states[v]=i.dataset.state!;}});
  panel.querySelectorAll<HTMLInputElement>('[data-gesture]').forEach(i=>{const v=i.value.trim();if(!v)return;if(v in gestures)throw new Error(`Gesture "${v}" is named twice.`);
   const role=panel.querySelector<HTMLInputElement>(`[data-gesture-role="${CSS.escape(i.dataset.gesture!)}"]`)?.value.trim();gestures[v]={sceneId:i.dataset.gesture!,...(role?{role}:{})};});
  const playback=[...panel.querySelectorAll<HTMLInputElement>('[data-playback]')].filter(i=>i.checked).map(i=>i.dataset.playback!);
  return {kind:field('kind') as ReuseKind,title:field('title'),states,gestures,entrySceneId:field('entry')||undefined,playback,previewState:field('preview')||undefined,
   associations:{workflow_keys:parseList(field('workflow_keys')),task_types:parseList(field('task_types')),skill_set_refs:parseList(field('skill_set_refs')),skill_refs:parseList(field('skill_refs')),event_families:parseList(field('event_families'))},authoredBy:'person:expressions-app'};
 }
 async function saveReusable(){
  const form=readForm();
  await host.nativeEdit(()=>[]); // commit the working draft first
  const view=host.nativeView();if(!view)throw new Error('The native Expression closed before saving.');
  const reuse=buildReuse(host.journey(),form,{
   scene:id=>view.bindings[id]?.scene_ref,
   entity:(sceneId,entityId)=>view.bindings[sceneId]?.occurrences.find(o=>o.view_entity_id===entityId)?.entity_ref,
  });
  const listed=await worldRequest<ListResult>({operation:'material_list',kind:form.kind});
  const parent=listed.folders[form.kind];
  if(!parent)throw new Error(`The material register's ${form.kind} folder is unavailable: ${listed.unreadable.map(u=>u.error).join('; ')}`);
  // The working Expression stays an ordinary Expression: the reusable copy
  // is a native fork carrying the reuse block.
  const source=view.document.expression_ref,copy=materialExpressionRef(form.title,crypto.randomUUID());
  const forked=await host.expressionRequest({operation:'fork',expression_ref:source,expected_revision:view.document.revision,new_expression_ref:copy,actor:ACTOR}) as {state?:string;document?:{revision:number}};
  if(forked?.state!=='ready'||!forked.document)throw new Error(`The Expression could not be copied for reuse (${String(forked?.state)}).`);
  const marked=await host.expressionRequest({operation:'edit',expression_ref:copy,expected_revision:forked.document.revision,actor:ACTOR,changes:[{change:'reuse_set',reuse:remapReuse(reuse,source,copy)}]}) as {state?:string;document?:{revision:number}};
  if(marked?.state!=='ready'||!marked.document)throw new Error(`The reusable copy was not marked (${String(marked?.state)}).`);
  const saved=await host.expressionRequest({operation:'save_as',expression_ref:copy,expected_revision:marked.document.revision,parent,
   name:materialFileName(form.title),operation_ref:`operation:reusable:${crypto.randomUUID()}`,actor:ACTOR,actor_kind:'human'}) as {state?:string;file?:{location?:{path?:string}};data?:unknown};
  if(saved?.state!=='saved')throw new Error(`The register refused the save (${String(saved?.state)}). ${saved?.state==='save_refused'?'A file with this title may already exist; choose another title.':''}`);
  // The copy lives on as a file; free its open slot (a clean, just-saved document).
  const closed=await host.expressionRequest({operation:'close',expression_ref:copy,actor:ACTOR}).catch(()=>null) as {state?:string}|null;
  host.toast(`Saved reusable ${form.kind}: ${saved.file?.location?.path}${closed?.state==='closed'?'':' (its copy stays open in this session)'}`,6000);
 }

 // --- material browser -----------------------------------------------------
 function materialHTML(){
  const rows=materials.map((m,i)=>`<li><button type="button" data-act="choose" data-index="${i}" aria-pressed="${chosen?.file_ref===m.file_ref}"><b>${esc(m.title)}</b> <small>${m.kind} · ${Object.keys(m.states).join(', ')||`${m.playback.length} scenes`}</small></button></li>`).join('');
  return `<div class="row"><select name="kind-filter"><option value="">all kinds</option>${REUSE_KINDS.map(k=>`<option ${k===kindFilter?'selected':''}>${k}</option>`).join('')}</select><button type="button" data-act="list">Refresh</button></div>
   <ul class="materials">${rows||'<li class="hint">Refresh to read the material register.</li>'}</ul>${chosen?chosenHTML(chosen):''}`;
 }
 function chosenHTML(m:Listing){
  const sceneChoices=[...Object.keys(m.states).map(s=>`<option value="state:${esc(s)}">state · ${esc(s)}</option>`),...(m.playback.length?m.playback:m.entry_scene_ref?[m.entry_scene_ref]:[]).map(r=>`<option value="scene:${esc(r)}">scene · ${esc(tail(r))}</option>`)].join('');
  const charOptions=`<option value="">— authored placeholder —</option>${characters.map(c=>`<option value="${esc(c.file_ref)}">${esc(c.title)}</option>`).join('')}`;
  const roles=m.roles.map(r=>r.accepts==='text'?`<label class="row"><span>${esc(r.role)}</span><input data-bind-text="${esc(r.role)}" placeholder="text"></label>`
   :r.accepts==='value'?`<label class="row"><span>${esc(r.role)}</span><input type="number" step="any" data-bind-value="${esc(r.role)}"></label>`
   :`<div class="row bind" data-bind-role="${esc(r.role)}" data-accepts="${r.accepts}"><span>${esc(r.role)}</span><select data-bind-character>${charOptions}</select><input data-bind-state placeholder="state"><input data-bind-label placeholder="label"></div>`).join('');
  return `<section class="chosen"><h4>${esc(m.title)}</h4><label class="row"><span>Perform</span><select name="perform">${sceneChoices||'<option value="">entry Scene</option>'}</select></label>${roles||'<p class="hint">This material exposes no roles.</p>'}
   <div class="row"><button type="button" data-act="perform">Perform into this Expression</button>${m.playback.length||m.kind==='expression'?'<button type="button" data-act="play-material">Play whole</button>':''}</div></section>`;
 }
 async function list(){
  kindFilter=field('kind-filter') as ReuseKind|'';
  const [all,chars]=await Promise.all([worldRequest<ListResult>({operation:'material_list',...(kindFilter?{kind:kindFilter}:{})}),worldRequest<ListResult>({operation:'material_list',kind:'character'})]);
  materials=all.materials;characters=chars.materials;chosen=null;
  if(all.unreadable.length)host.toast(`${all.unreadable.length} register entr${all.unreadable.length===1?'y was':'ies were'} unreadable.`,5000);
 }
 async function ensureAct(target:string,summary:string){
  if(!actRef||act?.expression_ref!==target||act.phase==='completed'||act.phase==='cancelled')actRef=`act:expressions:${crypto.randomUUID()}`;
  const opened=await worldRequest<{state:string;act:ActReading}>({operation:'act_open',act_ref:actRef,expression_ref:target,mode:'expressions',actor:ACTOR,summary});
  act=opened.act;
 }
 function readBindings(){
  const rows:BindingInput[]=[];
  panel.querySelectorAll<HTMLElement>('[data-bind-role]').forEach(el=>rows.push({role:el.dataset.bindRole!,accepts:el.dataset.accepts as RoleAccepts,
   character_ref:el.querySelector<HTMLSelectElement>('[data-bind-character]')?.value,state:el.querySelector<HTMLInputElement>('[data-bind-state]')?.value,label:el.querySelector<HTMLInputElement>('[data-bind-label]')?.value}));
  panel.querySelectorAll<HTMLInputElement>('[data-bind-text]').forEach(el=>rows.push({role:el.dataset.bindText!,accepts:'text',text:el.value}));
  panel.querySelectorAll<HTMLInputElement>('[data-bind-value]').forEach(el=>{if(el.value!=='')rows.push({role:el.dataset.bindValue!,accepts:'value',value:Number(el.value)});});
  return actBindings(rows);
 }
 const refusal=(state:string)=>state==='material_revision_changed'?'The material changed since it was listed; refresh and choose again.'
  :state==='act_passage_limit'?'This act is full; a new act was needed — perform again to continue in a fresh act.':`The act was not performed (${state}).`;
 /** Play a saved Expression's playback order whole into the act. */
 async function playMaterial(){
  const m=chosen;if(!m)return;
  await host.nativeEdit(()=>[]);
  const view=host.nativeView();if(!view)throw new Error('Save this Expression to a Central file first: an act performs into a native Expression.');
  const {bindings,captions}=readBindings();
  await ensureAct(view.document.expression_ref,`Playing ${m.title}`);
  const out=await worldRequest<{state:string;act?:ActReading;passages?:PassageLike[]}>({operation:'act_play',act_ref:actRef,actor:ACTOR,material:{file_ref:m.file_ref,revision:m.revision},bindings,captions});
  if(out.state==='act_passage_limit'){actRef=null;}
  if(out.state!=='act_played')throw new Error(refusal(out.state));
  act=out.act??act;steps=actTimeline(act?.sequence??[]);tab='act';
  const last=out.passages?.at(-1);host.transition(last?.transition?.duration??1.5,last?.transition?.easing);
  await follow('Played');
  host.toast(`Played ${m.title}: ${out.passages?.length??0} Scenes. Choose a timeline point to reopen it.`);
 }
 async function perform(){
  const m=chosen;if(!m)return;
  await host.nativeEdit(()=>[]); // commit the working draft before performing over it
  const view=host.nativeView();if(!view)throw new Error('Save this Expression to a Central file first: an act performs into a native Expression.');
  const {bindings,captions}=readBindings();
  const choice=field('perform'),[kind,ref]=[choice.slice(0,choice.indexOf(':')),choice.slice(choice.indexOf(':')+1)];
  await ensureAct(view.document.expression_ref,`Performing ${m.title}`);
  const material={file_ref:m.file_ref,revision:m.revision,...(kind==='state'?{state:ref}:kind==='scene'?{scene_ref:ref}:{})};
  const out=await worldRequest<{state:string;act?:ActReading;[k:string]:unknown}>({operation:'act_select',act_ref:actRef,actor:ACTOR,material,bindings,captions});
  if(out.state==='act_passage_limit'){actRef=null;}
  if(out.state!=='act_performed')throw new Error(refusal(out.state));
  act=out.act??act;steps=actTimeline(act?.sequence??[]);
  host.transition(1.5,'smoothstep');
  await follow('Performed');
  host.toast(`Performed ${m.title}.`);
 }

 // --- act timeline -----------------------------------------------------------
 function actHTML(){
  const strip=steps.map(s=>`<button type="button" class="step ${s.performs?'':'mark'}" data-act="seek" data-position="${s.position}" aria-pressed="${act?.position===s.position}" title="${esc(s.kind)} · ${s.seconds}s">${s.position+1}. ${esc(s.label)}</button>`).join('');
  return `<div class="row"><button type="button" data-act="acts">Read acts of this Expression</button>${act?`<button type="button" data-act="${playing?'stop':'play'}">${playing?'Stop':'Play act'}</button>`:''}</div>
   ${act?`<p class="hint">${esc(act.summary)} · ${act.mode} · ${act.phase} · ${act.sequence.length} passages</p><div class="strip">${strip||'<span class="hint">No passages yet.</span>'}</div>`:'<p class="hint">Perform reusable material, or read this Expression’s acts, to see its timeline.</p>'}
   <ul class="acts">${actRows.map(a=>`<li><button type="button" data-act="inspect" data-ref="${esc(a.act_ref)}">${esc(a.summary)} <small>${a.mode} · ${a.phase} · ${a.passages}</small></button></li>`).join('')}</ul>`;
 }
 let actRows:{act_ref:string;summary:string;mode:string;phase:string;passages:number}[]=[];
 async function readActs(){
  const view=host.nativeView();if(!view)throw new Error('Open a native Expression to read its acts.');
  const listed=await worldRequest<{acts:typeof actRows}>({operation:'act_list',expression_ref:view.document.expression_ref});
  actRows=listed.acts;
 }
 async function inspect(ref:string){
  const read=await worldRequest<{state:string;act?:ActReading}>({operation:'act_inspect',act_ref:ref});
  if(read.state!=='act'||!read.act)throw new Error('That act is no longer known to the kernel.');
  act=read.act;actRef=act.act_ref;steps=actTimeline(act.sequence);
 }
 async function seek(position:number,step?:PlaybackStep){
  if(!actRef)return;
  const out=await worldRequest<{state:string;act?:ActReading}>({operation:'act_seek',act_ref:actRef,actor:ACTOR,position});
  if(out.state!=='act_sought')throw new Error(out.state==='material_revision_changed'?'That passage’s material has changed since it was performed; it cannot be replayed exactly.':`Seek refused (${out.state}).`);
  act=out.act??act;
  if(step)host.transition(step.seconds,step.easing);
  await follow('Moved the act');
 }
 function stop(){if(playing){clearTimeout(playing);playing=0;render();}}
 function play(){
  if(!act||!steps.length)return;
  const from=act.position===undefined||act.position>=steps.length-1?-1:act.position;
  const advance=async(position:number)=>{
   const step=nextStep(steps,position);
   if(!step){playing=0;render();return;}
   // One step forward: the kernel performs only the passages between.
   try{await seek(step.position,step);}catch(e){playing=0;fail(e);render();return;}
   render();
   playing=window.setTimeout(()=>void advance(step.position),Math.max(300,step.seconds*1000));
  };
  playing=window.setTimeout(()=>void advance(from),0);render();
 }

 panel.addEventListener('click',ev=>{
  const el=(ev.target as HTMLElement).closest<HTMLElement>('[data-act]');if(!el)return;
  ev.stopPropagation();
  switch(el.dataset.act){
   case 'close':toggle(false);break;
   case 'tab':tab=el.dataset.tab as typeof tab;render();break;
   case 'roles-apply':try{applyRoles();render();}catch(e){fail(e);}break;
   case 'save-reusable':void task(saveReusable);break;
   case 'list':void task(list);break;
   case 'choose':chosen=materials[Number(el.dataset.index)]??null;render();break;
   case 'perform':void task(perform);break;
   case 'play-material':void task(playMaterial);break;
   case 'acts':void task(readActs);break;
   case 'inspect':void task(()=>inspect(el.dataset.ref!));break;
   case 'seek':{stop();const position=Number(el.dataset.position);void task(()=>seek(position,steps.find(s=>s.position===position)));break;}
   case 'play':play();break;
   case 'stop':stop();break;
  }
 });
 return {toggle,render,available:worldAvailable};
}

const PANEL_CSS=`
.act-panel-entry{font:inherit;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;margin-left:6px}
.act-panel-entry[aria-pressed="true"]{color:var(--paper,#f4f2eb);background:var(--ink,#252720)}
.act-panel{position:fixed;right:16px;bottom:88px;width:min(440px,calc(100vw - 32px));max-height:min(70vh,640px);overflow:auto;z-index:60;background:var(--paper,#f4f2eb);color:var(--ink,#252720);border:1px solid color-mix(in srgb,var(--ink,#252720) 25%,transparent);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);font:13px/1.4 system-ui,-apple-system,sans-serif}
.act-panel header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--ink,#252720) 15%,transparent);position:sticky;top:0;background:inherit}
.act-panel header nav{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.act-panel button{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,var(--ink,#252720) 30%,transparent);border-radius:6px;padding:3px 8px;cursor:pointer}
.act-panel button[aria-pressed="true"]{background:var(--ink,#252720);color:var(--paper,#f4f2eb)}
.act-panel button:disabled{opacity:.45;cursor:default}
.act-panel .act-body{padding:10px 12px;display:grid;gap:8px}.act-panel .act-body[aria-busy="true"]{opacity:.6;pointer-events:none}
.act-panel .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.act-panel .row>span{min-width:110px;opacity:.75}
.act-panel input,.act-panel select{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,var(--ink,#252720) 25%,transparent);border-radius:5px;padding:3px 6px;min-width:0;flex:1}
.act-panel table{border-collapse:collapse;width:100%}.act-panel td,.act-panel th{padding:2px 3px;text-align:left;font-weight:normal}.act-panel th{opacity:.6;font-size:11px}
.act-panel .hint{opacity:.65;margin:0}.act-panel .warn{margin:0;color:#a23b2a}
.act-panel ul{list-style:none;margin:0;padding:0;display:grid;gap:4px}.act-panel ul button{width:100%;text-align:left}
.act-panel .strip{display:flex;flex-wrap:wrap;gap:4px}.act-panel .step.mark{border-style:dashed;opacity:.7}
.act-panel fieldset{border:1px solid color-mix(in srgb,var(--ink,#252720) 15%,transparent);border-radius:8px;display:grid;gap:4px}
.act-panel h4{margin:4px 0 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;opacity:.7}
`;
