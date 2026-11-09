/** A symbol's voice: the optional `sound` block of an authored Entity.
 *
 * "A symbol has a voice: the symbol translated into sound. It is the symbol's harmony, the chord whose figure on the torus is the symbol's
 * shape, and you hear it from where the symbol stands. The pulse sounds it, as it sounds everything. A name or a mode from M2′'s store of
 * sound (§22.1) can stand in for the translation" (DLW §20.2). The voice has no pitch of its own and no waveform, never its own oscillator
 * (owner, 20 Oct 2026): it takes its sound from the torus. With no `carry` it sounds the symbol's own harmony (symbolHarmony.ts: the classes
 * its form covers where it stands); a `carry` names what stands in for it out of the store, and symbolVoices.ts filters the torus's output
 * through the bands of the mode. Either way the result stands where the symbol stands.
 *
 *   {enabled, carry?: {kind: 'mode' | 'name', ref}, gain?, attack?, release?}
 *
 * `carry.kind` 'mode' names a row of the mode catalogue by the catalogue's own key (ql.music-modes/v1); 'name' names an entry of the
 * store that is not a mode (the divine names, the mantras, the Shem). A voice with no `carry` is the translation (NO_CARRY says so). The
 * kernel validates the same shape (`expression_profile::sound`), and refuses the fields the oscillator had.
 *
 * Saved documents written before 20 Oct carry `frequencyHz`, `followCymatic`, `waveform` and `pan`. `migrateEntitySound` drops them,
 * names each one it dropped, and gives the voice no `carry`: the frame makes up no mode from an old frequency, so the voice sounds its symbol.
 */
export type VoiceCarryKind='mode'|'name';
export interface VoiceCarry {
 kind:VoiceCarryKind;
 /** A mode: the catalogue row's key. A name: the store's own name for the entry. */
 ref:string;
}
export interface EntitySound {
 enabled:boolean;
 /** What stands in for the symbol's own harmony, out of the store. Absent: the voice sounds the symbol's own harmony. */
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
/** What a voice with no `carry` says: it is the symbol translated, and a name or a mode can stand in. */
export const NO_CARRY="This voice sounds the symbol's own harmony: the chord of the classes its form covers where it stands. A name or a mode can stand in for it on the Sound page";
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
/** What a migration did to one voice: each field it dropped, and whether a voice that was sounding now sounds its symbol instead. */
export interface SoundMigration {
 dropped:DroppedSoundField[];
 /** The voice was enabled and now has no `carry`: it sounded a pitch of its own before and sounds the symbol's own harmony now. */
 translated:boolean;
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
 const translated=sound.enabled&&!sound.carry;
 const names=dropped.map(item=>item.field).join(', ');
 return {sound,migration:{dropped,translated,
  words:`This voice was written for an oscillator. Dropped ${names}: a symbol's voice carries the torus's sound and has no pitch of its own. ${translated?`It sounded a pitch of its own and sounds its symbol now. ${NO_CARRY}.`:'It gained no name or mode.'}`}};
}

/** The minimal entity/scene shape the planner reads (model.ts Entity/Scene). */
interface SoundingEntity {id:string;enabled?:boolean;kind?:string;sound?:EntitySound}
interface SoundingScene {entities:readonly SoundingEntity[];composition?:{symbolVoices?:boolean}}
/** One voice the scene sounds now: a symbol's own envelope, and what it carries (null: the symbol's own harmony). */
export interface EntityVoice {entityId:string;carry:VoiceCarry|null;gain:number;attack:number;release:number}
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
/** Shared, per-page object-sound mute, so the voices and the Sound control agree. Default: sounding (audio still waits for a user gesture).
 * Round 885 (DLW build ruling 2026-11-06): this is what is heard here — the frame's "Mute all object sound here" and the Field's Sound
 * ("Lets the field sound. The picture stays when sound is off", DLW.md §20.2) — and never the Activator: it is not saved, and the
 * Expression still plays. Every change of what the Expression is heard at (this mute, another's Solo, its mixer) reaches these listeners. */
const muteListeners=new Set<(muted:boolean)=>void>();
let objectSoundMuted=false;
const heardChanged=()=>{for(const listener of [...muteListeners])listener(objectSoundMuted);};
export function objectSoundIsMuted(){return objectSoundMuted;}
export function setObjectSoundMuted(muted:boolean){objectSoundMuted=muted;heardChanged();}
export function onObjectSoundMuted(listener:(muted:boolean)=>void){muteListeners.add(listener);return()=>{muteListeners.delete(listener);};}
/** The field's own sound where it stands (native-field/controller.ts): its Sound — the presentation the session opens at, muted at the first
 * opening — and whether a session stands to hear it. */
export interface FieldSoundOwner{readonly reading:{readonly status?:unknown;readonly muted?:unknown;readonly reason?:unknown};/** The state of the field's own audio context, or null while none stands (controller.ts audioState). */readonly audioState?:string|null;setMuted(muted:boolean):void;chooseSound(muted:boolean):void}
/** The Field's Sound (DLW.md §20.2 "Sound | On · Off | On | Lets the field sound. The picture stays when sound is off"; O-I #747 round 893,
 * walk #857 XR): what is heard here, so the mute here and, where a field stands, the field's own Sound — the one Live's Sound sets (§20.2
 * "The field holds the one body of Live"). Before it, the Field's Sound was the voices' mute alone and the field stayed at its own: in an
 * Expressions window the field was never heard while the Field read On. Where no field stands (before the first opening, or in a rebind's
 * gap) the choice is kept for the next opening (controller.ts chooseSound; round 894): before it, a press there set only the mute here, and
 * the field opened again at the Sound it had. */
export function setFieldSound(owner:FieldSoundOwner|null|undefined,muted:boolean){
 setObjectSoundMuted(muted);
 owner?.chooseSound(muted);
}
/** What the Field's Sound reads: muted here, or the field's own Sound off — the Sound a standing field plays at, and where none stands the
 * one the next opening opens at (the controller keeps it across openings). Before round 894 it read the mute here alone where no field
 * stood, so it said On over a field that then opened, at Sound off: On before a reopen, Off after it, with nothing pressed. */
export function fieldSoundMuted(owner:FieldSoundOwner|null|undefined):boolean{
 return objectSoundMuted||(!!owner&&owner.reading.muted===true);
}
/** O-I #747 round 896, item 0.7 (DLW build ruling 2026-11-09: "have the Sound say it is closed, with one press to open it"): why the field
 * is not heard while the person's Sound is On, in words, or null. Walk 896h read Sound On over a field that was not heard: an opening the
 * owner did not acknowledge (unavailable, its context closed), and an opening again that let the field go and waited for a playing scene
 * to be still. The field's sound is closed when the field was opened here (`asked`) and now stands let go or unavailable, or follows with
 * its context suspended or closed; an opening or a hold is not a closing. Sound Off, or a field never opened here, says nothing. */
export function fieldSoundClosed(owner:FieldSoundOwner|null|undefined,asked:boolean):string|null{
 if(!owner||!asked||fieldSoundMuted(owner))return null;
 const status=owner.reading.status;
 if(status==='opening'||status==='held')return null;
 if(status==='following'){const audio=owner.audioState??null;return audio===null||audio==='running'?null:`The field's sound is closed: its audio is ${audio}.`;}
 const said=typeof owner.reading.reason==='string'?owner.reading.reason.replace(/^Error: /,'').trim():'';
 return `The field's sound is closed: ${said?said.replace(/[.\s]*$/,''):'the field is not open'}.`;
}
/** XS15 (DLW.md §20.1 The mixer row "Volume | The level of the Expression's sound"; The Main track "sets the level of every Expression's
 * sound together"; DLW build ruling 2026-11-06): the Expression's sound level and the Main level, as linear gain from 0 (silence) to 2
 * (+6 dB, Live's top). */
export const SOUND_LEVEL_MAX=2;
export const soundLevelValid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=SOUND_LEVEL_MAX;
/** The Expression's mixer, kept in its document as a Live Set keeps its mixer (round 885; DLW build ruling 2026-11-06): Volume (`level`),
 * the Main track's level (`main`), the Activator (`active`: "The Expression plays, or it does not", §20.1) and, since round 886, Solo
 * (`solo`: "Lets you hear only this Expression's sound"; a Live Set keeps its solo states, DLW build ruling 2026-11-06). Each optional;
 * absent, each reads as its default. Journey.mix holds it; composition_set carries it. An Expression's own Solo silences nothing of its
 * own: another's silences it here (`setSoloSilenced`, the shell's reading of the others). */
export interface ExpressionMix {level?:number;main?:number;active?:boolean;solo?:boolean}
export interface ExpressionMixReading {readonly level:number;readonly main:number;readonly active:boolean;readonly solo:boolean}
export const EXPRESSION_MIX_DEFAULT:ExpressionMixReading=Object.freeze({level:1,main:1,active:true,solo:false});
/** The mixer's law: closed keys, levels from silence to +6 dB, the Activator on or off. Null when sound, else the refusal in words. */
export function expressionMixRefusal(value:unknown):string|null{
 if(value===undefined)return null;
 if(!value||typeof value!=='object'||Array.isArray(value))return 'The Expression\'s mixer is a set of settings.';
 const mix=value as Record<string,unknown>;
 for(const key of Object.keys(mix))if(!['level','main','active','solo'].includes(key))return `The Expression's mixer has no ${key}.`;
 if(mix.level!==undefined&&!soundLevelValid(mix.level)||mix.main!==undefined&&!soundLevelValid(mix.main))return 'A sound level runs from silence to +6 dB.';
 if(mix.active!==undefined&&typeof mix.active!=='boolean')return 'The Expression plays or it does not (true or false).';
 if(mix.solo!==undefined&&typeof mix.solo!=='boolean')return 'Solo is on or off (true or false).';
 return null;
}
/** The mixer as it stands: the kept settings over the defaults. Pure. */
export const expressionMixOf=(mix:ExpressionMix|undefined):ExpressionMixReading=>({level:mix?.level??EXPRESSION_MIX_DEFAULT.level,
 main:mix?.main??EXPRESSION_MIX_DEFAULT.main,active:mix?.active??EXPRESSION_MIX_DEFAULT.active,solo:mix?.solo??EXPRESSION_MIX_DEFAULT.solo});
/** The open Expression's mixer, as its document keeps it (set on each load and change), and whether another Expression is soloed (the
 * `sound` stage command's `silenced`): what is heard here, as the mute is. */
let expressionMix:ExpressionMixReading=EXPRESSION_MIX_DEFAULT;
let soloSilenced=false;
export function expressionMixReading():ExpressionMixReading{return expressionMix;}
/** Take the document's mixer: null when taken (a mixer that is no change is heard by no one), else the refusal, and the mixer stands. */
export function setExpressionMix(mix:ExpressionMix|undefined):string|null{
 const refused=expressionMixRefusal(mix);if(refused)return refused;
 const next=expressionMixOf(mix);
 if(next.level===expressionMix.level&&next.main===expressionMix.main&&next.active===expressionMix.active&&next.solo===expressionMix.solo)return null;
 expressionMix=next;heardChanged();return null;
}
/** The Field's Level (DLW §20.2 Field, "Level | −60 to 0 dB | −12 dB | Sets the loudness of the whole field"; round 886): the scene's own
 * (Scene.composition.fieldLevel, dB), −12 dB where it keeps none. Everything the field sounds is heard under it: the voices' rule and the
 * Torus's mix stage, and so the one gain the desktop's engine takes with the Torus. */
export const FIELD_LEVEL_DB=Object.freeze({min:-60,max:0,default:-12});
export const fieldLevelValid=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=FIELD_LEVEL_DB.min&&value<=FIELD_LEVEL_DB.max;
/** The Level as a gain: 10^(dB/20), the default where none is kept. Pure. */
export const fieldLevelGain=(db:number|undefined):number=>10**((db??FIELD_LEVEL_DB.default)/20);
let fieldLevel:number=FIELD_LEVEL_DB.default;
export function fieldLevelReading():number{return fieldLevel;}
/** Take the playing scene's Level: null when taken (the same Level is no change), else the refusal, and the Level stands. */
export function setFieldLevel(db:number|undefined):string|null{
 if(db!==undefined&&!fieldLevelValid(db))return 'The Field\'s Level runs from −60 to 0 dB.';
 const next=db??FIELD_LEVEL_DB.default;if(next===fieldLevel)return null;
 fieldLevel=next;heardChanged();return null;
}
export function objectSoundLevels():{level:number;main:number;field:number}{return {level:expressionMix.level,main:expressionMix.main,field:fieldLevelGain(fieldLevel)};}
export function soloSilencedHere(){return soloSilenced;}
export function setSoloSilenced(silenced:boolean){if(silenced===soloSilenced)return;soloSilenced=silenced;heardChanged();}
/** XS04 slices 2 and 3 (O-I #747 round 889): the Expressions held over the presented one on this field (fieldLayers.ts), each with its own
 * mixer, as its document keeps it. Their symbols are named `<expression_ref>#<id>` in the one Scene the field sounds. */
let layerMixes:ReadonlyMap<string,ExpressionMixReading>=new Map();
const sameMixes=(a:ReadonlyMap<string,ExpressionMixReading>,b:ReadonlyMap<string,ExpressionMixReading>)=>a.size===b.size&&[...a].every(([ref,mix])=>{
 const other=b.get(ref);return !!other&&other.level===mix.level&&other.main===mix.main&&other.active===mix.active&&other.solo===mix.solo;});
/** Take the held Expressions' mixers (the frame tells them at each hold, launch, mix and release). */
export function setLayerMixes(mixes:ReadonlyMap<string,ExpressionMixReading>){if(sameMixes(mixes,layerMixes))return;layerMixes=new Map(mixes);heardChanged();}
/** Whether a Solo on this field leaves an Expression unheard: some Expression on the field is soloed and it is not. Pure. */
const soloedAway=(own:ExpressionMixReading,presented:ExpressionMixReading,layers:ReadonlyMap<string,ExpressionMixReading>)=>
 !own.solo&&(presented.solo||[...layers.values()].some(mix=>mix.solo));
/** What one voice on the field sounds at (DLW.md §20.1 The mixer row, The Main track; round 889): its own Expression's level — the held
 * Expression its symbol is named by, else the presented one — under the one Main level (the presented Expression's: the Main track sets
 * every Expression's level together) and the Field's Level; nothing when the field's sound is off here, another open Expression is soloed,
 * its own Expression is switched off, or another Expression on this field is soloed and its own is not. Pure. */
export function voiceMixOf(entityId:string,presented:ExpressionMixReading,layers:ReadonlyMap<string,ExpressionMixReading>,
 heard:{muted:boolean;silenced:boolean;field:number}):{muted:boolean;levels:{level:number;main:number;field:number}}{
 const at=entityId.indexOf('#'),held=at>0?layers.get(entityId.slice(0,at)):undefined;
 const own=held??presented;
 return {muted:heard.muted||heard.silenced||!own.active||soloedAway(own,presented,layers),levels:{level:own.level,main:presented.main,field:heard.field}};
}
/** One voice's mix on this field as it stands (production.ts hands it to the voices). */
export const fieldVoiceMix=(entityId:string)=>voiceMixOf(entityId,expressionMix,layerMixes,{muted:objectSoundMuted,silenced:soloSilenced,field:fieldLevelGain(fieldLevel)});
/** Whether nothing of the Expression is heard here: muted here, another soloed (an open Expression elsewhere, or one held over this field),
 * or switched off by its Activator. */
export function expressionSilencedHere(){return objectSoundMuted||soloSilenced||!expressionMix.active||soloedAway(expressionMix,expressionMix,layerMixes);}
/** What a voice sounds at: its own gain × the Expression's level × the Main level × the Field's Level (round 886; unity where none is
 * given), or nothing when muted. Pure. */
export const soundingGain=(gain:number,muted:boolean,levels:{level:number;main:number;field?:number}):number=>muted?0:gain*levels.level*levels.main*(levels.field??1);
/** What everything the Expression sounds is heard at — the Torus's mix stage (native-field/controller.ts setMix): level × Main × the
 * Field's Level, or nothing when switched off or silenced here. The voices' rule at unity gain. Pure. */
export const expressionGain=(mix:ExpressionMixReading,silenced:boolean,field=1):number=>soundingGain(1,silenced||!mix.active,{level:mix.level,main:mix.main,field});
/** The gain everything the Expression sounds is heard at here, told now and at each change (the Torus's mix stage listens). */
export function onExpressionGain(listener:(gain:number)=>void):()=>void{
 const tell=()=>listener(expressionGain(expressionMix,objectSoundMuted||soloSilenced||soloedAway(expressionMix,expressionMix,layerMixes),fieldLevelGain(fieldLevel)));
 tell();return onObjectSoundMuted(tell);
}

/** Pure plan: which voices a Scene sounds now, and which symbols have a voice that does not sound and why. A symbol sounds when it is
 * present (not disabled), its voice is enabled, the scene's Symbol voices are On (absent reads as On), and, when an `active` set is given
 * (e.g. the entities a performed state/gesture addresses), it is in it. It sounds what its `carry` names, or with none its own harmony.
 * Whether the carried name or mode has a sound, and what the harmony is, is symbolVoices.ts's reading, because it needs the catalogue,
 * the torus and where the symbol stands. */
export function entitySoundPlan(scene:SoundingScene,active?:ReadonlySet<string>):EntitySoundPlan{
 const voices:EntityVoice[]=[],silent:SilentVoice[]=[];
 const on=scene.composition?.symbolVoices!==false;
 for(const entity of scene.entities){
  const sound=entity.sound;
  if(!sound?.enabled||entity.enabled===false||active&&!active.has(entity.id))continue;
  if(!on){silent.push({entityId:entity.id,because:VOICES_OFF});continue;}
  const d=DEFAULT_ENTITY_SOUND;
  voices.push({entityId:entity.id,carry:sound.carry?{...sound.carry}:null,gain:sound.gain??d.gain,attack:sound.attack??d.attack,release:sound.release??d.release});
 }
 return {voices,silent};
}
export const entitySoundVoices=(scene:SoundingScene,active?:ReadonlySet<string>):EntityVoice[]=>entitySoundPlan(scene,active).voices;
