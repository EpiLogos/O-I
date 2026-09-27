/** Per-object sound: the optional `sound` block of an authored Entity.
 *
 * Sound is part of an object's expressive material (a character carries it
 * through its states; a Scene keeps it with the entity through
 * `scene_material_set`). It is a small voice per present entity — never a
 * second clock and never the native M2 PCM owner (`controller.ts`), which
 * stays authoritative for native domain audio.
 *
 *   {enabled, frequencyHz?, followCymatic?, gain, waveform, attack, release, pan}
 *
 * `followCymatic` sounds the entity's cymatic/template frequency (or the
 * Scene's field frequency) instead of a fixed `frequencyHz`. The kernel
 * validates the same shape (`expression_profile::sound`).
 */
export type EntitySoundWaveform='sine'|'triangle'|'square'|'sawtooth';
export interface EntitySound {
 enabled:boolean;
 /** Fixed pitch; ignored while `followCymatic` is true. */
 frequencyHz?:number;
 /** Sound the entity's cymatic/template frequency (else the Scene field frequency). */
 followCymatic?:boolean;
 /** Linear gain 0..1. */
 gain?:number;
 waveform?:EntitySoundWaveform;
 /** Seconds to reach gain when the entity becomes present. */
 attack?:number;
 /** Seconds to fall silent when the entity leaves or the sound is disabled. */
 release?:number;
 /** Stereo position -1..1. */
 pan?:number;
}
export const SOUND_FIELDS=['enabled','frequencyHz','followCymatic','gain','waveform','attack','release','pan'] as const;
export const SOUND_WAVEFORMS:readonly EntitySoundWaveform[]=['sine','triangle','square','sawtooth'];
export const DEFAULT_ENTITY_SOUND:Readonly<Required<Omit<EntitySound,'frequencyHz'>>&{frequencyHz:number}>=Object.freeze({
 enabled:false,frequencyHz:220,followCymatic:true,gain:.2,waveform:'sine',attack:.08,release:.8,pan:0,
});
const finite=(value:unknown,low:number,high:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high;

/** Refuse anything the kernel would refuse; absent is legitimate (no sound). */
export function validateEntitySound(value:unknown):EntitySound|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid entity sound: expected an object');
 const sound=value as Record<string,unknown>;
 const unknown=Object.keys(sound).find(key=>!(SOUND_FIELDS as readonly string[]).includes(key));
 if(unknown)throw new Error(`Invalid entity sound: unsupported field ${unknown}`);
 if(typeof sound.enabled!=='boolean')throw new Error('Invalid entity sound: enabled must be a boolean');
 if(sound.followCymatic!==undefined&&typeof sound.followCymatic!=='boolean')throw new Error('Invalid entity sound: followCymatic must be a boolean');
 for(const [key,low,high] of [['frequencyHz',1,20000],['gain',0,1],['attack',0,10],['release',0,30],['pan',-1,1]] as const){
  if(sound[key]!==undefined&&!finite(sound[key],low,high))throw new Error(`Invalid entity sound: ${key} must sit inside [${low}, ${high}]`);
 }
 if(sound.waveform!==undefined&&!SOUND_WAVEFORMS.includes(sound.waveform as EntitySoundWaveform))throw new Error('Invalid entity sound: unsupported waveform');
 return value as EntitySound;
}

/** The minimal entity/scene shape the planner reads (model.ts Entity/Scene). */
interface SoundingEntity {id:string;enabled?:boolean;kind?:string;templateFrequency?:number;sound?:EntitySound}
interface SoundingScene {entities:readonly SoundingEntity[];field?:{params?:Record<string,number>}}
export interface EntityVoice {entityId:string;frequencyHz:number;gain:number;waveform:EntitySoundWaveform;attack:number;release:number;pan:number}

/** Pure plan: which voices a Scene sounds now. An entity sounds when it is
 * present (not disabled), its sound is enabled and, when an `active` set is
 * given (e.g. the entities a performed state/gesture addresses), it is in it. */
/** Which entities are "active" for sound: in a travelling-focus composition
 * only the focused entity (and, while the focus blends onward, the next one)
 * sounds; in a parallel composition every present entity does (undefined).
 * The engine's composition telemetry (`PointCloudField.getCompositionTelemetry`)
 * is the source of that focus — the same one that drives the focus tint. */
export function activeFromFocus(focus:{entityId:string;nextEntityId?:string;blend?:number}|null|undefined):ReadonlySet<string>|undefined{
 if(!focus)return undefined;
 const active=new Set([focus.entityId]);
 if(focus.nextEntityId&&(focus.blend??0)>.5)active.add(focus.nextEntityId);
 return active;
}
/** Shared, per-page object-sound mute, so every sound bank and the Sound
 * control agree. Default: sounding (audio still waits for a user gesture). */
const muteListeners=new Set<(muted:boolean)=>void>();
let objectSoundMuted=false;
export function objectSoundIsMuted(){return objectSoundMuted;}
export function setObjectSoundMuted(muted:boolean){objectSoundMuted=muted;for(const listener of [...muteListeners])listener(muted);}
export function onObjectSoundMuted(listener:(muted:boolean)=>void){muteListeners.add(listener);return()=>{muteListeners.delete(listener);};}

export function entitySoundVoices(scene:SoundingScene,active?:ReadonlySet<string>):EntityVoice[]{
 const fieldHz=scene.field?.params?.frequency;
 const voices:EntityVoice[]=[];
 for(const entity of scene.entities){
  const sound=entity.sound;
  if(!sound?.enabled||entity.enabled===false||active&&!active.has(entity.id))continue;
  const d=DEFAULT_ENTITY_SOUND;
  const follow=sound.followCymatic??(sound.frequencyHz===undefined);
  const hz=follow?(entity.templateFrequency??fieldHz??sound.frequencyHz??d.frequencyHz):(sound.frequencyHz??d.frequencyHz);
  voices.push({entityId:entity.id,frequencyHz:Math.min(20000,Math.max(1,hz)),gain:sound.gain??d.gain,waveform:sound.waveform??d.waveform,
   attack:sound.attack??d.attack,release:sound.release??d.release,pan:sound.pan??d.pan});
 }
 return voices;
}

interface HeldVoice {voice:EntityVoice;oscillator:OscillatorNode;amp:GainNode;panner:StereoPannerNode|null}
/** Keeps one small voice per sounding entity and follows Scene changes with
 * each voice's authored attack/release. The AudioContext is created lazily
 * and only runs after a user gesture (no autoplay); `muted` holds everything
 * at silence without discarding the plan. */
export class EntitySoundBank {
 private context:AudioContext|null=null;
 private voices=new Map<string,HeldVoice>();
 private muted=objectSoundIsMuted();
 private signature='';
 private gestureArmed=false;
 private release:()=>void;
 constructor(private createContext:()=>AudioContext|null=()=>typeof AudioContext==='function'?new AudioContext():null){
  this.release=onObjectSoundMuted(muted=>this.setMuted(muted));
 }
 /** Follow the current Scene (and optional active set). Cheap when unchanged. */
 sync(scene:SoundingScene,active?:ReadonlySet<string>):EntityVoice[]{
  const plan=entitySoundVoices(scene,active);
  const signature=JSON.stringify(plan);
  if(signature===this.signature)return plan;
  if(!plan.length&&!this.voices.size){this.signature=signature;return plan;}
  const context=this.ensureContext();
  // No audio device yet: keep the plan unrecorded so the next sync applies it.
  if(!context)return plan;
  this.signature=signature;
  const now=context.currentTime;
  const wanted=new Map(plan.map(voice=>[voice.entityId,voice]));
  for(const [id,held] of this.voices)if(!wanted.has(id)){
   held.amp.gain.cancelScheduledValues(now);held.amp.gain.setValueAtTime(held.amp.gain.value,now);
   held.amp.gain.linearRampToValueAtTime(0,now+held.voice.release);
   held.oscillator.stop(now+held.voice.release+.05);
   this.voices.delete(id);
  }
  for(const voice of plan){
   let held=this.voices.get(voice.entityId);
   if(!held){
    const oscillator=context.createOscillator(),amp=context.createGain();
    const panner=typeof context.createStereoPanner==='function'?context.createStereoPanner():null;
    amp.gain.setValueAtTime(0,now);
    oscillator.connect(amp);
    if(panner){amp.connect(panner);panner.connect(context.destination);}else amp.connect(context.destination);
    oscillator.start(now);
    held={voice,oscillator,amp,panner};this.voices.set(voice.entityId,held);
   }
   held.oscillator.type=voice.waveform;
   held.oscillator.frequency.setTargetAtTime(voice.frequencyHz,now,.02);
   held.panner?.pan.setTargetAtTime(voice.pan,now,.02);
   held.amp.gain.cancelScheduledValues(now);held.amp.gain.setValueAtTime(held.amp.gain.value,now);
   held.amp.gain.linearRampToValueAtTime(this.muted?0:voice.gain,now+Math.max(.005,voice.attack));
   held.voice=voice;
  }
  return plan;
 }
 setMuted(muted:boolean){
  this.muted=muted;
  const context=this.context;if(!context)return;
  const now=context.currentTime;
  for(const held of this.voices.values()){
   held.amp.gain.cancelScheduledValues(now);held.amp.gain.setValueAtTime(held.amp.gain.value,now);
   held.amp.gain.linearRampToValueAtTime(muted?0:held.voice.gain,now+(muted?held.voice.release:held.voice.attack)+.005);
  }
 }
 inspect(){return {muted:this.muted,state:this.context?.state??'unopened',voices:[...this.voices.values()].map(held=>({...held.voice}))};}
 dispose(){
  this.release();
  for(const held of this.voices.values()){try{held.oscillator.stop();}catch{/* already stopped */}}
  this.voices.clear();this.signature='';
  const context=this.context;this.context=null;
  if(context&&context.state!=='closed')void context.close().catch(()=>{});
 }
 private ensureContext():AudioContext|null{
  if(!this.context)this.context=this.createContext();
  const context=this.context;
  if(context&&context.state==='suspended'&&!this.gestureArmed&&typeof window!=='undefined'){
   // Browsers keep audio suspended until a gesture; resume on the next one.
   this.gestureArmed=true;
   const resume=()=>{window.removeEventListener('pointerdown',resume,true);window.removeEventListener('keydown',resume,true);this.gestureArmed=false;void context.resume().catch(()=>{});};
   window.addEventListener('pointerdown',resume,true);window.addEventListener('keydown',resume,true);
  }
  return context;
 }
}
