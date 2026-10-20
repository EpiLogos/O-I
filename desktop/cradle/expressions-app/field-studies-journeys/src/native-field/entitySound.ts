/** A symbol's voice: the optional `sound` block of an authored Entity.
 *
 * "A symbol's voice is a name or a mode carrying the torus's sound, never its own oscillator" (owner, 20 Oct 2026; DLW §20.2). The voice
 * has no pitch of its own and no waveform. It names what it carries out of M2′'s store of sound (DLW §22.1) and takes its sound from
 * the torus: symbolVoices.ts filters the torus's output through the bands of the mode and places the result where the symbol stands.
 *
 *   {enabled, carry?: {kind: 'mode' | 'name', ref}, gain?, attack?, release?}
 *
 * `carry.kind` 'mode' names a row of the mode catalogue by the catalogue's own key (ql.music-modes/v1); 'name' names an entry of the
 * store that is not a mode (the divine names, the mantras, the Shem). A voice with no `carry` is silent and says why (NO_CARRY). The
 * kernel validates the same shape (`expression_profile::sound`), and refuses the fields the oscillator had.
 *
 * Saved documents written before 20 Oct carry `frequencyHz`, `followCymatic`, `waveform` and `pan`. `migrateEntitySound` drops them,
 * names each one it dropped, and gives the voice no `carry`: the frame makes up no mode from an old frequency.
 */
export type VoiceCarryKind='mode'|'name';
export interface VoiceCarry {
 kind:VoiceCarryKind;
 /** A mode: the catalogue row's key. A name: the store's own name for the entry. */
 ref:string;
}
export interface EntitySound {
 enabled:boolean;
 /** What the voice carries of the torus's sound. Absent: the voice is silent and says so. */
 carry?:VoiceCarry;
 /** Linear gain 0..1. */
 gain?:number;
 /** Seconds to reach gain when the symbol becomes present. */
 attack?:number;
 /** Seconds to fall silent when the symbol leaves or the voice is disabled. */
 release?:number;
}
export const SOUND_FIELDS=['enabled','carry','gain','attack','release'] as const;
export const CARRY_KINDS:readonly VoiceCarryKind[]=['mode','name'];
/** The oscillator's fields, which are no longer a voice's. */
export const REMOVED_SOUND_FIELDS=['frequencyHz','followCymatic','waveform','pan'] as const;
export type RemovedSoundField=typeof REMOVED_SOUND_FIELDS[number];
/** Why each removed field is gone, in words. The kernel says the same (expression_profile.rs `REMOVED_SOUND_FIELDS`). */
export const REMOVED_SOUND_WORDS:Readonly<Record<RemovedSoundField,string>>=Object.freeze({
 frequencyHz:"a symbol's voice carries the torus's sound and has no pitch of its own: its pitches are the degrees of its mode over the torus's root",
 followCymatic:"a symbol's voice carries the torus's sound and does not follow a plate's frequency: its pitches are the degrees of its mode",
 waveform:"a symbol's voice has no oscillator, so it has no waveform: it is the torus's own sound",
 pan:"a symbol's voice stands where its symbol stands, so its stereo place is the symbol's place on the stage",
});
export const DEFAULT_ENTITY_SOUND:Readonly<{enabled:boolean;gain:number;attack:number;release:number}>=Object.freeze({
 enabled:false,gain:.2,attack:.08,release:.8,
});
/** What a voice with no `carry` says. */
export const NO_CARRY='This voice has no name or mode yet: choose one on the Sound page';
/** What the voices say while the scene's Symbol voices parameter is Off (DLW §20.2). */
export const VOICES_OFF='Symbol voices are off for this scene: no symbol carries the torus\'s sound';
const finite=(value:unknown,low:number,high:number)=>typeof value==='number'&&Number.isFinite(value)&&value>=low&&value<=high;
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Validate a voice's `carry`: a kind and a bounded reference, and nothing else. */
export function validateVoiceCarry(value:unknown):VoiceCarry{
 if(!plain(value))throw new Error('Invalid entity sound: carry must be {kind, ref}');
 const unknown=Object.keys(value).find(key=>key!=='kind'&&key!=='ref');
 if(unknown)throw new Error(`Invalid entity sound: unsupported carry field ${unknown}`);
 if(!CARRY_KINDS.includes(value.kind as VoiceCarryKind))throw new Error('Invalid entity sound: carry kind must be mode or name');
 if(typeof value.ref!=='string'||!value.ref||value.ref.length>200)throw new Error('Invalid entity sound: carry ref must be a name or a catalogue key of 1 to 200 characters');
 return {kind:value.kind as VoiceCarryKind,ref:value.ref};
}

/** Refuse anything the kernel would refuse; absent is legitimate (no voice). The oscillator's fields are refused in words, never ignored. */
export function validateEntitySound(value:unknown):EntitySound|undefined{
 if(value===undefined)return undefined;
 if(!plain(value))throw new Error('Invalid entity sound: expected an object');
 const sound=value;
 const removed=(REMOVED_SOUND_FIELDS as readonly string[]).find(key=>key in sound);
 if(removed)throw new Error(`Invalid entity sound: ${removed} was removed: ${REMOVED_SOUND_WORDS[removed as RemovedSoundField]}`);
 const unknown=Object.keys(sound).find(key=>!(SOUND_FIELDS as readonly string[]).includes(key));
 if(unknown)throw new Error(`Invalid entity sound: unsupported field ${unknown}`);
 if(typeof sound.enabled!=='boolean')throw new Error('Invalid entity sound: enabled must be a boolean');
 for(const [key,low,high] of [['gain',0,1],['attack',0,10],['release',0,30]] as const){
  if(sound[key]!==undefined&&!finite(sound[key],low,high))throw new Error(`Invalid entity sound: ${key} must sit inside [${low}, ${high}]`);
 }
 const out:EntitySound={enabled:sound.enabled};
 if(sound.carry!==undefined)out.carry=validateVoiceCarry(sound.carry);
 for(const key of ['gain','attack','release'] as const)if(sound[key]!==undefined)out[key]=sound[key] as number;
 return out;
}

/** One field a migration dropped, with the value it held. */
export interface DroppedSoundField {field:RemovedSoundField;was:unknown}
/** What a migration did to one voice: each field it dropped, and whether that silences a voice that was sounding. */
export interface SoundMigration {
 dropped:DroppedSoundField[];
 /** The voice was enabled and now has no `carry`: it was heard before and is silent now. */
 silenced:boolean;
 words:string;
}
/** A migration receipt as a journey keeps it: which symbol of which scene, and what happened to its voice. */
export interface SoundMigrationReceipt extends SoundMigration {scene:string;entity:string;
 /** The voice was in the scene's saved version, not its working one. */
 saved?:boolean}

/** Bring a voice written before 20 Oct to the new shape. Keeps `enabled`, `gain`, `attack`, `release` (and a `carry`, if one is there);
 * drops the oscillator's four fields and names each; gives the voice no `carry` it did not have. A field that is neither old nor new is
 * refused, not dropped. A voice already in the new shape comes back unchanged with an empty receipt. */
export function migrateEntitySound(value:unknown):{sound:EntitySound|undefined;migration:SoundMigration|null}{
 if(value===undefined)return {sound:undefined,migration:null};
 if(!plain(value))throw new Error('Invalid entity sound: expected an object');
 // The receipt names the dropped fields in the table's order (REMOVED_SOUND_FIELDS), whatever order the document wrote them in.
 const dropped:DroppedSoundField[]=REMOVED_SOUND_FIELDS.filter(field=>field in value).map(field=>({field,was:value[field]}));
 const kept:Record<string,unknown>=Object.fromEntries(Object.entries(value).filter(([key])=>!(REMOVED_SOUND_FIELDS as readonly string[]).includes(key)));
 const sound=validateEntitySound(kept) as EntitySound;
 if(!dropped.length)return {sound,migration:null};
 const silenced=sound.enabled&&!sound.carry;
 const names=dropped.map(item=>item.field).join(', ');
 return {sound,migration:{dropped,silenced,
  words:`This voice was written for an oscillator. Dropped ${names}: a symbol's voice now carries a name or mode of the torus's sound. ${silenced?`It was sounding and is silent now. ${NO_CARRY}.`:'It gained no name or mode.'}`}};
}

/** The minimal entity/scene shape the planner reads (model.ts Entity/Scene). */
interface SoundingEntity {id:string;enabled?:boolean;kind?:string;sound?:EntitySound}
interface SoundingScene {entities:readonly SoundingEntity[];composition?:{symbolVoices?:boolean}}
/** One voice the scene sounds now: a symbol's own envelope, and what it carries. */
export interface EntityVoice {entityId:string;carry:VoiceCarry;gain:number;attack:number;release:number}
/** One symbol whose voice is on and does not sound, with the reason in words. */
export interface SilentVoice {entityId:string;because:string}
export interface EntitySoundPlan {voices:EntityVoice[];silent:SilentVoice[]}

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
/** Shared, per-page object-sound mute, so the voices and the Sound control agree. Default: sounding (audio still waits for a user gesture). */
const muteListeners=new Set<(muted:boolean)=>void>();
let objectSoundMuted=false;
export function objectSoundIsMuted(){return objectSoundMuted;}
export function setObjectSoundMuted(muted:boolean){objectSoundMuted=muted;for(const listener of [...muteListeners])listener(muted);}
export function onObjectSoundMuted(listener:(muted:boolean)=>void){muteListeners.add(listener);return()=>{muteListeners.delete(listener);};}

/** Pure plan: which voices a Scene sounds now, and which symbols have a voice that does not sound and why. A symbol sounds when it is
 * present (not disabled), its voice is enabled and carries something, the scene's Symbol voices are On (absent reads as On), and, when an
 * `active` set is given (e.g. the entities a performed state/gesture addresses), it is in it. Whether the carried name or mode has a
 * sound is symbolVoices.ts's reading, because it needs the catalogue and the torus. */
export function entitySoundPlan(scene:SoundingScene,active?:ReadonlySet<string>):EntitySoundPlan{
 const voices:EntityVoice[]=[],silent:SilentVoice[]=[];
 const on=scene.composition?.symbolVoices!==false;
 for(const entity of scene.entities){
  const sound=entity.sound;
  if(!sound?.enabled||entity.enabled===false||active&&!active.has(entity.id))continue;
  if(!on){silent.push({entityId:entity.id,because:VOICES_OFF});continue;}
  if(!sound.carry){silent.push({entityId:entity.id,because:NO_CARRY});continue;}
  const d=DEFAULT_ENTITY_SOUND;
  voices.push({entityId:entity.id,carry:{...sound.carry},gain:sound.gain??d.gain,attack:sound.attack??d.attack,release:sound.release??d.release});
 }
 return {voices,silent};
}
export const entitySoundVoices=(scene:SoundingScene,active?:ReadonlySet<string>):EntityVoice[]=>entitySoundPlan(scene,active).voices;
