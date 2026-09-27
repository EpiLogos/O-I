/** Sound — the per-object sound control group for the selected object.
 *
 * The inspector (inspector.ts, rendered by app.ts) builds its groups as HTML;
 * this module adds one more group beside "Influence" and owns its events, so
 * it never shares the app's `data-action`/`data-bind` vocabulary. Every edit
 * goes through the app's own `changed(fn)` path (history, dirty state, native
 * save through scene_material_set), exactly like tint or force.
 *
 * Mount (app.ts `renderInspector`, right after `content.innerHTML=inspectorHTML(ctx);`):
 *   mountSoundControls(content,{entity:()=>scene().entities.find(e=>e.id===selected[0]),change:fn=>changed(fn)});
 */
import type {Entity} from './model.js';
import {DEFAULT_ENTITY_SOUND,SOUND_WAVEFORMS,objectSoundIsMuted,setObjectSoundMuted,validateEntitySound,type EntitySound} from './native-field/entitySound.js';

export interface SoundControlAccess {
 /** The selected object, if exactly one is selected. */
 entity():Entity|undefined;
 /** The app's history-recording change path. */
 change(fn:()=>void):void;
}

const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function number(label:string,field:keyof EntitySound,value:number,min:number,max:number,step:number,disabled=false){
 return `<label class="sound-field"><span>${label}</span><input type="number" data-sound="${field}" value="${value}" min="${min}" max="${max}" step="${step}" ${disabled?'disabled':''}></label>`;
}
function slider(label:string,field:keyof EntitySound,value:number,min:number,max:number,step:number,disabled=false){
 return `<label class="sound-field"><span>${label} <output>${value}</output></span><input type="range" data-sound="${field}" value="${value}" min="${min}" max="${max}" step="${step}" ${disabled?'disabled':''}></label>`;
}

/** The group's markup for one object's sound (absent sound = off). */
export function soundControlsHTML(sound:EntitySound|undefined,locked=false):string{
 const d=DEFAULT_ENTITY_SOUND,s={...d,...sound};
 const follow=sound?.followCymatic??(sound?.frequencyHz===undefined);
 const off=locked||!s.enabled;
 return `<details class="control-group" data-detail="Sound" data-sound-group ${sound?.enabled?'open':''}><summary>Sound</summary><div class="group-content">`
  +`<label class="sound-toggle"><input type="checkbox" data-sound="enabled" ${s.enabled?'checked':''} ${locked?'disabled':''}> This object sounds while present</label>`
  +`<label class="sound-toggle"><input type="checkbox" data-sound="followCymatic" ${follow?'checked':''} ${off?'disabled':''}> Follow its cymatic frequency</label>`
  +number('Frequency · Hz','frequencyHz',s.frequencyHz,1,20000,1,off||follow)
  +slider('Gain','gain',s.gain,0,1,.01,off)
  +`<label class="sound-field"><span>Waveform</span><select data-sound="waveform" ${off?'disabled':''}>${SOUND_WAVEFORMS.map(w=>`<option value="${w}" ${w===s.waveform?'selected':''}>${esc(w[0].toUpperCase()+w.slice(1))}</option>`).join('')}</select></label>`
  +number('Attack · s','attack',s.attack,0,10,.01,off)
  +number('Release · s','release',s.release,0,30,.01,off)
  +slider('Pan','pan',s.pan,-1,1,.01,off)
  +`<label class="sound-toggle"><input type="checkbox" data-sound-mute ${objectSoundIsMuted()?'checked':''}> Mute all object sound here</label>`
  +`</div></details>`;
}

/** Apply one control's value to a sound block; returns the validated block. */
export function applySoundControl(current:EntitySound|undefined,field:keyof EntitySound,raw:string|boolean):EntitySound{
 const next:EntitySound={...(current??{enabled:false})};
 if(field==='enabled'||field==='followCymatic'){
  (next as unknown as Record<string,unknown>)[field]=raw===true;
  if(field==='followCymatic'&&raw!==true&&next.frequencyHz===undefined)next.frequencyHz=DEFAULT_ENTITY_SOUND.frequencyHz;
 }else if(field==='waveform')next.waveform=raw as EntitySound['waveform'];
 else{
  const value=Number(raw);
  if(!Number.isFinite(value))throw new Error(`Sound ${field} must be a number`);
  (next as unknown as Record<string,unknown>)[field]=value;
  if(field==='frequencyHz')next.followCymatic=false;
 }
 return validateEntitySound(next)!;
}

/** Insert the Sound group after "Influence" (or at the end) and handle it. */
export function mountSoundControls(root:HTMLElement,access:SoundControlAccess):void{
 const entity=access.entity();
 root.querySelector('[data-sound-group]')?.remove();
 if(!entity)return;
 const holder=document.createElement('div');holder.innerHTML=soundControlsHTML(entity.sound,entity.locked);
 const group=holder.firstElementChild as HTMLElement;
 const influence=root.querySelector('[data-detail="Influence"]');
 if(influence)influence.after(group);else root.append(group);
 const onChange=(event:Event)=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement;
  if(el.matches('[data-sound-mute]')){setObjectSoundMuted((el as HTMLInputElement).checked);return;}
  const field=el.dataset.sound as keyof EntitySound|undefined;
  const target=access.entity();
  if(!field||!target||target.locked)return;
  let next:EntitySound;
  try{next=applySoundControl(target.sound,field,el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:el.value);}
  catch(error){el.setCustomValidity(error instanceof Error?error.message:String(error));el.reportValidity();return;}
  access.change(()=>{const live=access.entity();if(live)live.sound=next;});
 };
 const onInput=(event:Event)=>{const el=event.target as HTMLInputElement;if(el.type==='range')el.closest('label')?.querySelector('output')?.replaceChildren(el.value);};
 group.addEventListener('change',onChange);group.addEventListener('input',onInput);
}
