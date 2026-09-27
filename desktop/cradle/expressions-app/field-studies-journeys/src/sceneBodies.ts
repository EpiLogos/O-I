/** ES1A/ES1B scene-body and scene-trigger presentation (O:I #352, wayfinder
 * §§10,17,29,36). The active native Scene's own body — an ImageMedia,
 * TextSource or other admitted carrier — is real readable material laid
 * over the live field, not another particle-sampled entity. An unsupported
 * or degraded carrier gets an honest "Open" card carrying its real native
 * open Action; nothing is silently dropped. Presentation-only state (which
 * body is selected in this viewer) never enters the native document.
 */
import './sceneBodies.css';
import {esc} from './icons.js';
import type {KernelConversion,KernelSceneBody,KernelSceneTrigger} from './kernelDocumentBridge.js';
import {nativeSubjectTextRequest,nativeSubjectBytesRequest} from './kernelExpressions.js';

export interface SceneBodiesHost {
 /** The current native working view, if any native Expression is open. */
 nativeView:()=>KernelConversion|undefined;
 /** The app's own current scene id (view-space), to find its native binding. */
 sceneId:()=>string;
 /** Open a native subject through the app's existing "open this native
  * ref" affordance (the same summon('source',...) app.ts already uses for
  * research-card and relation sources). The real native open Action for a
  * degraded/unsupported carrier, never a fabricated one. */
 open:(subjectRef:string)=>void;
 /** Honour a `Navigate` trigger by moving the app to that native Scene, the
  * same way the scene strip does. Absent when the target scene has no view
  * binding here (native-only Scenes outside this budget). */
 jumpToScene:(sceneRef:string)=>void;
}
type Resolved={kind:'text';content:string}|{kind:'image';dataUrl:string};
const cache=new Map<string,Resolved>();
/** Exported for testing without a DOM: the identity a resolved reading is
 * cached under, and invalidated by (carrier, exact subject/revision, span). */
export function cacheKey(body:KernelSceneBody):string{
 return [body.carrier,body.subject_ref,body.reading.revision,body.span?`${body.span.start}-${body.span.end}`:''].join('\0');
}
/** Exported for testing without a DOM: honour a `text_source` body's
 * selected span (code-point offsets), or the whole text when absent. */
export function spanned(content:string,span:KernelSceneBody['span']):string{
 if(!span)return content;
 const chars=[...content];
 return chars.slice(Math.max(0,span.start),Math.min(chars.length,span.end)).join('');
}
const RENDERABLE=new Set(['text_source','image_media']);
/** Exported for testing without a DOM: what `apply()` would show for a
 * body, before any native read runs — the same decision the render path
 * makes, as pure data. `resolve` means an admitted carrier that a native
 * read will fill in; `degraded`/`unavailable` carry their honest reason. */
export type BodyPlan={kind:'resolve'}|{kind:'degraded';reason:string}|{kind:'unavailable';reason:string};
export function planBody(body:KernelSceneBody):BodyPlan{
 if(body.capability.state==='unavailable')return {kind:'unavailable',reason:body.capability.reason};
 if(body.capability.state==='degrades_to_thing')return {kind:'degraded',reason:body.capability.reason};
 if(!RENDERABLE.has(body.carrier))return {kind:'degraded',reason:`No live renderer for ${body.carrier} bodies here yet`};
 return {kind:'resolve'};
}
/** Exported for testing without a DOM: the Navigate triggers a "Jump to…"
 * chip strip would offer, in the order the Scene declares them. */
export function navigableTriggers(triggers:KernelSceneTrigger[]):{trigger_ref:string;occasion:string;scene_ref:string}[]{
 return triggers.filter((t):t is KernelSceneTrigger&{target:{kind:'navigate';scene_ref:string}}=>t.target.kind==='navigate'&&!!t.target.scene_ref)
  .map(t=>({trigger_ref:t.trigger_ref,occasion:t.occasion,scene_ref:t.target.scene_ref}));
}
async function resolve(body:KernelSceneBody):Promise<Resolved>{
 const key=cacheKey(body);
 const cached=cache.get(key);if(cached)return cached;
 if(cache.size>48)cache.clear();
 if(body.carrier==='text_source'){
  const text=await nativeSubjectTextRequest(body.subject_ref);
  const entry:Resolved={kind:'text',content:spanned(text.content,body.span)};
  cache.set(key,entry);return entry;
 }
 if(body.carrier==='image_media'){
  const bytes=await nativeSubjectBytesRequest(body.subject_ref);
  const entry:Resolved={kind:'image',dataUrl:`data:${bytes.mime_hint||'application/octet-stream'};base64,${bytes.content_base64}`};
  cache.set(key,entry);return entry;
 }
 throw new Error(`No admitted renderer for carrier "${body.carrier}"`);
}
export interface SceneBodiesController {
 /** Re-read the active scene's body/triggers and update the overlay. Call
  * this from renderAll() — cheap when nothing changed, since resolution is
  * cached by carrier+subject_ref+revision+span. */
 refresh():void;
 /** True while a body is currently selected in this viewer. */
 selected():boolean;
}
export function installSceneBodies(host:SceneBodiesHost):SceneBodiesController{
 const el=document.createElement('div');
 el.id='scene-body';el.className='scene-body-layer';el.hidden=true;
 document.body.appendChild(el);
 let isSelected=false,activeKey='';
 const setSelected=(value:boolean)=>{isSelected=value;el.classList.toggle('selected',value);const card=el.querySelector('.scene-body-card');card?.setAttribute('aria-pressed',String(value));};
 el.addEventListener('click',event=>{
  const target=event.target as HTMLElement;
  const jump=target.closest<HTMLElement>('[data-scene-body-jump]');
  if(jump){host.jumpToScene(jump.dataset.sceneBodyJump!);return;}
  const open=target.closest('[data-scene-body-open]');
  const card=target.closest('.scene-body-card') as HTMLElement|null;
  if(open&&card?.dataset.subjectRef){host.open(card.dataset.subjectRef);return;}
  if(card){setSelected(!isSelected);return;}
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&isSelected&&!el.hidden){setSelected(false);}
 });
 function triggerChips(triggers:KernelSceneTrigger[]):string{
  const nav=navigableTriggers(triggers);
  if(!nav.length)return '';
  return `<div class="scene-body-triggers">${nav.map(t=>`<button type="button" class="scene-body-jump" data-scene-body-jump="${esc(t.scene_ref)}">${icon('branch')} Jump on ${esc(t.occasion.replace('_',' '))}</button>`).join('')}</div>`;
 }
 function icon(name:string):string{return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="${name==='branch'?'M6 3v13a4 4 0 0 0 8 0V9m-4 4 4-4 4 4M4 3h4':'M12 5v14M5 12h14'}"/></svg>`;}
 function renderCard(body:KernelSceneBody,inner:string,extraClass=''){
  el.className=`scene-body-layer ${body.presentation} ${extraClass}`.trim();
  el.hidden=false;
  el.innerHTML=`<div class="scene-body-card" role="button" tabindex="0" aria-pressed="${isSelected}" data-subject-ref="${esc(body.subject_ref)}">${inner}</div>`;
 }
 function renderDegraded(body:KernelSceneBody,reason:string){
  const openAction=body.actions[0];
  renderCard(body,`<p class="scene-body-kicker">${esc(body.carrier.replace('_',' '))}</p><p class="scene-body-reason">${esc(reason)}</p>${openAction?`<button type="button" class="secondary" data-scene-body-open>Open ${esc(openAction.action_ref)}</button>`:`<p class="scene-body-note">No native open Action is disclosed on this body.</p>`}`,'degraded');
 }
 function renderUnavailable(body:KernelSceneBody,reason:string){
  renderCard(body,`<p class="scene-body-kicker">${esc(body.carrier.replace('_',' '))}</p><p class="scene-body-reason">Unavailable · ${esc(reason)}</p>`,'unavailable');
 }
 function apply(body:KernelSceneBody,triggers:KernelSceneTrigger[]){
  const plan=planBody(body);
  if(plan.kind==='unavailable'){renderUnavailable(body,plan.reason);return;}
  if(plan.kind==='degraded'){renderDegraded(body,plan.reason);return;}
  const key=cacheKey(body);
  activeKey=key;
  resolve(body).then(resolved=>{
   if(activeKey!==key)return; // a newer body superseded this read
   if(resolved.kind==='image'){
    renderCard(body,`<img class="scene-body-image" src="${resolved.dataUrl}" alt="${esc(body.subject_ref)}">${triggerChips(triggers)}`,'image');
   }else{
    renderCard(body,`<div class="scene-body-text">${esc(resolved.content).replace(/\n/g,'<br>')}</div>${triggerChips(triggers)}`,'text');
   }
  }).catch(error=>{
   if(activeKey!==key)return;
   renderDegraded(body,error instanceof Error?error.message:String(error));
  });
  // Render an immediate honest placeholder while the read is in flight.
  renderCard(body,`<p class="scene-body-kicker">${esc(body.carrier.replace('_',' '))}</p><p class="scene-body-reason">Reading…</p>`,'loading');
 }
 function refresh(){
  const view=host.nativeView(),binding=view?.bindings[host.sceneId()];
  const body=binding?.body??null,triggers=binding?.triggers??[];
  if(!body){el.hidden=true;el.innerHTML='';activeKey='';if(isSelected)setSelected(false);return;}
  if(body.carrier==='engine_composition'){el.hidden=true;el.innerHTML='';activeKey='';if(isSelected)setSelected(false);return;} // the live field itself is the body
  apply(body,triggers);
 }
 return {refresh,selected:()=>isSelected};
}
