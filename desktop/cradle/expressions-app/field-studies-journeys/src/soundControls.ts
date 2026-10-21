/** Sound — the per-object voice control group for the selected object.
 *
 * A symbol's voice is a name or a mode carrying the torus's sound (native-field/entitySound.ts, symbolVoices.ts): there is no frequency,
 * no waveform and no pan to set. The group holds the voice's switch, what it carries (a mode of the catalogue, or a name of the store),
 * its gain, and its attack and release. A voice with nothing to carry says so, and so does a name the store gives no sound for.
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
import {DEFAULT_ENTITY_SOUND,NO_CARRY,objectSoundIsMuted,setObjectSoundMuted,validateEntitySound,type EntitySound} from './native-field/entitySound.js';
import {modeCatalogueReading,onModeCatalogue,type ModeStoreReading} from './native-field/modeStore.js';
import type {ModeRow} from './native-field/modeCatalogue.js';

export interface SoundControlAccess {
 /** The selected object, if exactly one is selected. */
 entity():Entity|undefined;
 /** The app's history-recording change path. */
 change(fn:()=>void):void;
}
export type SoundControlField='enabled'|'carry'|'gain'|'attack'|'release';

const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function number(label:string,field:SoundControlField,value:number,min:number,max:number,step:number,disabled=false){
 return `<label class="sound-field"><span>${label}</span><input type="number" data-sound="${field}" value="${value}" min="${min}" max="${max}" step="${step}" ${disabled?'disabled':''}></label>`;
}
function slider(label:string,field:SoundControlField,value:number,min:number,max:number,step:number,disabled=false){
 return `<label class="sound-field"><span>${label} <output>${value}</output></span><input type="range" data-sound="${field}" value="${value}" min="${min}" max="${max}" step="${step}" ${disabled?'disabled':''}></label>`;
}

/** A carry as one option value: `mode:<catalogue key>` or `name:<the store's name>`; the empty value is no carry. */
export const carryValue=(carry:EntitySound['carry'])=>carry?`${carry.kind}:${carry.ref}`:'';
export function carryFromValue(raw:string):EntitySound['carry']{
 if(!raw)return undefined;
 const at=raw.indexOf(':'),kind=raw.slice(0,at),ref=raw.slice(at+1);
 if(at<0||(kind!=='mode'&&kind!=='name'))throw new Error('Sound carry must be a mode or a name');
 return {kind,ref};
}

/** The voice choice: the catalogue's modes grouped as the catalogue groups them, then the store's names (each with its status). */
function carrySelect(sound:EntitySound|undefined,store:ModeStoreReading,off:boolean):string{
 const chosen=carryValue(sound?.carry);
 const option=(value:string,label:string,note=''):string=>`<option value="${esc(value)}" ${value===chosen?'selected':''}>${esc(label)}${note}</option>`;
 const groups=new Map<string,ModeRow[]>();
 for(const row of store.catalogue?.modes.values()??[])groups.set(row.group,[...(groups.get(row.group)??[]),row]);
 const modes=[...groups].map(([group,rows])=>`<optgroup label="${esc(group)}">${rows.map(row=>option(`mode:${row.key}`,row.label)).join('')}</optgroup>`).join('');
 const names=store.catalogue?[...store.catalogue.absent.values()].map(entry=>option(`name:${entry.name}`,`${entry.name} · ${entry.status}`)).join(''):'';
 // A carry the store does not list (or no catalogue yet) stays visible as what it is, so the control never shows a choice that is not there.
 const unlisted=chosen&&!(store.catalogue&&(sound?.carry?.kind==='mode'?store.catalogue.modes.has(sound.carry.ref):store.catalogue.absent.has(sound?.carry?.ref??'')))?option(chosen,`${sound!.carry!.ref} · not in the store`):'';
 return `<label class="sound-field"><span>Name or mode</span><select data-sound="carry" ${off?'disabled':''}>${option('','None yet')}${unlisted}${modes}${names?`<optgroup label="names of the store">${names}</optgroup>`:''}</select></label>`;
}

/** What the voice says about itself, in words: why it is silent, or what it carries. */
export function voiceNote(sound:EntitySound|undefined,store:ModeStoreReading):string{
 if(!sound?.enabled)return 'This object has no voice while this is off.';
 if(!sound.carry)return NO_CARRY;
 if(!store.catalogue)return store.why??'The mode catalogue is not read yet';
 if(sound.carry.kind==='name'){
  const entry=store.catalogue.absent.get(sound.carry.ref);
  return entry?`${entry.name} (${entry.status}): ${entry.reason}`:`The store names no "${sound.carry.ref}", so this voice has no sound to carry`;
 }
 const row=store.catalogue.modes.get(sound.carry.ref);
 return row?`Carries ${row.label} of the torus's sound, over the torus's root. Degrees: ${row.tuning}.`:`The mode catalogue has no mode "${sound.carry.ref}"`;
}

/** The group's markup for one object's sound (absent sound = off). */
export function soundControlsHTML(sound:EntitySound|undefined,locked=false,store:ModeStoreReading=modeCatalogueReading()):string{
 const d=DEFAULT_ENTITY_SOUND,s={...d,...sound};
 const off=locked||!s.enabled;
 return `<details class="control-group" data-detail="Sound" data-sound-group ${sound?.enabled?'open':''}><summary>Sound</summary><div class="group-content">`
  +`<label class="sound-toggle"><input type="checkbox" data-sound="enabled" ${s.enabled?'checked':''} ${locked?'disabled':''}> This object carries the torus's sound while present</label>`
  +carrySelect(sound,store,off)
  +`<p class="control-note" data-sound-note>${esc(voiceNote(sound,store))}</p>`
  +slider('Gain','gain',s.gain,0,1,.01,off)
  +number('Attack · s','attack',s.attack,0,10,.01,off)
  +number('Release · s','release',s.release,0,30,.01,off)
  +`<label class="sound-toggle"><input type="checkbox" data-sound-mute ${objectSoundIsMuted()?'checked':''}> Mute all object sound here</label>`
  +`</div></details>`;
}

/** Apply one control's value to a sound block; returns the validated block. */
export function applySoundControl(current:EntitySound|undefined,field:SoundControlField,raw:string|boolean):EntitySound{
 const next:EntitySound={...(current??{enabled:false})};
 if(field==='enabled')next.enabled=raw===true;
 else if(field==='carry'){
  const carry=carryFromValue(String(raw));
  if(carry)next.carry=carry;else delete next.carry;
 }else{
  const value=Number(raw);
  if(!Number.isFinite(value))throw new Error(`Sound ${field} must be a number`);
  next[field]=value;
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
 // The catalogue may arrive after the group is drawn: the note and the list follow it.
 const stop=onModeCatalogue(()=>{
  if(!group.isConnected){stop();return;}
  const live=access.entity();if(!live)return;
  const select=group.querySelector<HTMLSelectElement>('select[data-sound="carry"]');
  const fresh=document.createElement('div');fresh.innerHTML=soundControlsHTML(live.sound,live.locked);
  const next=fresh.querySelector<HTMLSelectElement>('select[data-sound="carry"]');
  if(select&&next)select.replaceChildren(...next.children);
  group.querySelector('[data-sound-note]')?.replaceChildren(fresh.querySelector('[data-sound-note]')?.textContent??'');
 });
 const onChange=(event:Event)=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement;
  if(el.matches('[data-sound-mute]')){setObjectSoundMuted((el as HTMLInputElement).checked);return;}
  const field=el.dataset.sound as SoundControlField|undefined;
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
