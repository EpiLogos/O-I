import {projectNativeSources,editNativeBasis,NativeDomainReading,NativeBasisEdit} from './domain';
import {InstrumentSession} from './ql/instrument-session.mjs';
import {NativeProjection} from './projection';
import {COMPOSE_TIMEOUT_MS,type NativePort} from './channel';
import {applyPhysicalFormPose} from '../physicalFormActuator';
import {nativeActuatorStanding} from '../nativeActuatorStanding';
import {isScene,eventFromSources,readScene,editSceneEvent,sceneCausalTrace,type SceneActing,type SceneEdit} from './scene';
import {editEffectChain,editEffects,initialEffects,type EffectValue,type EffectsState,type PresentationEffect} from './effectsLaw';
import {PresentationEffects} from './presentationEffects';
import {voiceModeRef} from './torusPlay.mjs';
import {conditionReadingOf} from '../instrumentCondition';
import {TorusObject,type TorusView} from '../../../src/engine/torusObject';
import {formBodyRequest,FORM_SAMPLES_CONTRACT,type SamplePreparation} from '../../../src/engine/psg-form-sampler';
import {isStageSampleCursor,stageJournalLanding,STAGE_JOURNAL_ACTS_MAX,STAGE_JOURNAL_BYTES_MAX,STAGE_EDIT_AHEAD_SECONDS,STAGE_RENDER_FRAMES_MAX,STAGE_RENDER_ACTS_MAX,
 readStageTorusCheckpoint,readStageTorusSound,readStageSoundMoves,readStageTorusEngine,isStageSoundName,STAGE_TORUS_SOUND_NAME_MAX,type StageTorusEngine,type StageAudioClock,type StagePerformanceJournal,type StageKey,
 type StageTakeAct,type StageTakeRender,type StageTorusCheckpoint,type StageTorusSound,type StageSoundMove,type StageFormBody} from '../stageCommands';
import type {FieldScoreBasis,FieldScoreReply} from '../tarotScoreClient';
export interface NativeRenderer {
 retainedTargetPort():any;releaseRetainedField():void;
 retainedTopology?():{tex_width:number;tex_height:number;particle_count:number;slot_count:number}|null;
 onRetainedRecoveryRequired(listener:(state:'lost'|'restored')=>void):()=>void;
 checkpointRetainedField(binding:any):any;restoreRetainedField(binding:any,checkpoint:any):void;
 setNativeDomain(active:boolean):void;
}
export interface NativePlaybackPolicy {blockFrames:number;leadSeconds:number;lookaheadSeconds:number;}
export const EMBEDDED_NATIVE_PLAYBACK:Readonly<NativePlaybackPolicy>=Object.freeze({blockFrames:8192,leadSeconds:.5,lookaheadSeconds:.5});
export type NativeStatus='manual'|'opening'|'following'|'held'|'unavailable';
export type NativeSky='none'|'now'|{epoch:string};
/** A sky an opening stands on exactly: the owner's `ql.sky-snapshot/v1`, named by its ref. */
export type NativeSkySnapshot={schema:'ql.sky-snapshot/v1';snapshot_ref:string;[key:string]:unknown};
/** The most bytes one sky handed to an opening takes. */
const SKY_SNAPSHOT_BYTES_MAX=1024*1024;
/** A sky the field is handed to open on (O-I ticket 854): a saved occasion's, or the one the Sky shows (DLW §21.2 To use the Torus, step 6:
 * "Set Tuning to Sky. The voices take the planets of your sky"), as one bounded `ql.sky-snapshot/v1` owner reading with its ref, kept as
 * the field's own copy; null for none. Anything else is refused in words, `whose` naming it. Pure. */
export function readHandedSky(raw:unknown,whose='The handed sky'):NativeSkySnapshot|null{
 if(raw===null||raw===undefined)return null;
 const snapshot=raw as {schema?:unknown;snapshot_ref?:unknown};
 if(typeof raw!=='object'||Array.isArray(raw)||snapshot.schema!=='ql.sky-snapshot/v1'||typeof snapshot.snapshot_ref!=='string'||!snapshot.snapshot_ref
  ||JSON.stringify(raw).length>SKY_SNAPSHOT_BYTES_MAX)throw new Error(`${whose} is not one bounded ql.sky-snapshot/v1 owner reading`);
 return structuredClone(raw) as NativeSkySnapshot;
}
/** Whether the open field is bound again when the Sky hands it another sky (O-I ticket 854). `standing` is the ref of the sky the field
 * stands on (occasionSky), `before` the sky handed before and `next` the one handed now; null for none. A sky the field already stands on
 * asks nothing. None handed now (the Sky back on the shared sky of now) binds it again only while it stands on the sky the Sky handed, so
 * its own opening comes back; a field on its own sky is left. Pure. */
export function skyRebinds(standing:string|null,before:string|null,next:string|null):boolean{
 if(next===before)return false;
 if(next!==null)return next!==standing;
 return before!==null&&standing===before;
}
/** Presentation, not source: the M1 torus (|x|,|y| ≤ 25/9 m at QL's declared
 * 1 m per torus unit) spans ±333 engine units — 0.83 of the 400-unit stage
 * radius (WORLD_SCALE), leaving the body whole on stage with modal headroom. */
export const INSTRUMENT_PRESENTATION=Object.freeze({units_per_metre:120,
 standing:'presentation scale: ±25/9 m torus → ±333 engine units (0.83 of the 400-unit stage radius); not a source value'});
/** QL scene_field.rs `default_field`: the composed owner's device rate. */
export const SCENE_SAMPLE_RATE=48000;
/** Both source-cited tick rates; neither is fixed by the M1 contract (QL scene_field.rs). */
export const CADENCES=Object.freeze([
 Object.freeze({id:'world',ticks_per_second:1,label:'1 tick/s',source:'M3/M4′ world clock, 1 Hz'}),
 Object.freeze({id:'user',ticks_per_second:12,label:'12 ticks/s',source:'PPS user-facing tick, 12 per second'}),
]);
export const PRESENTATION_LEVEL=Object.freeze({min:0,max:4,initial:1,
 standing:'presentation gain after the native PCM (× the audio receiver\'s 0.1); not a source value'});
/** Owner busy, held mid-beat, or presentation capacity full: a skipped beat. */
/** The sheet a fold's body is prepared from: one sheet carrier of 12 × 12 samples, two stage units a side and a tenth deep, a quarter metre
 * a unit, as QL's own fold body is (QL-MEF tests/form_body.rs, tests/torus_host.rs `fold`). No source gives the scene's fold a size of its
 * own, so the frame asks for QL's; the preparation is named for this frame. */
const FOLD_BODY_SHEET:SamplePreparation={schema:FORM_SAMPLES_CONTRACT,prepRef:'oi:psg:m3-fold-body',treatment:'sheet-carrier',
 layers:[{layerRef:'form:sheet',restDepthW:0.5}],resolution:12,units:{extentUnits:2,depthUnits:0.1,metresPerUnit:0.25}};
const TRANSIENT=/owner busy|held before the event|presentation capacity|requires idle admitted owner/;
/** How often the Torus's session is read while the field follows (O-I #850): a human cadence, never a beat. */
const TORUS_READ_MS=1000;
/** Where the Torus is heard from (O-I 856): metres in the scene the owner draws its targets in, and how long a place the owner refused is
 * not asked again. */
type ReceiverPlace=readonly [number,number,number];
type ReceiverReading={schema:string;context:'world'|'personal'|'shared';gains:{mode_ref:string;gain:number}[];law:string;shared?:string;at_metres?:[number,number,number]};
/** The receiving contexts a Return goes back to (O-I #856, QL-MEF #289 packet N). */
type ReceivingContext='world'|'personal'|'shared';
const RECEIVER_RETRY_MS=1000;
/** The owner's operations a Torus sounding in the desktop's one engine follows without being handed over again (O-I #849): the reads
 * (instrument-session.mjs READ_OPERATIONS), the advance unless a setting landed in it, a release (no native state moves), the acts the
 * kernel tells the engine (keys, a touch, a singlet, a named strike) and the receiver (round 14), which moves only the gains the Torus is
 * heard by: the owner names each part of a block that reaches them (QL torus_heard), the kernel tells the engine, and it reaches them
 * over the same samples. */
const TORUS_FOLLOWS:ReadonlySet<string>=new Set(['read','inspect','influence','personal','receive-personal','stage-state','score-resolve','score-state',
 'torus-state','torus-checkpoint','torus-render','torus-native','advance','torus-play','strike-at','torus-singlet','torus-release','strike',
 'torus-receiver']);
/** Whether an acknowledged operation moved the owner's Torus past what the engine follows: a setting, a restore, a body, a determinant
 * event, or a setting landing inside an advance. */
export function torusMoved(command:unknown,reply:unknown):boolean{
 const op=(command as any)?.operation;
 if(typeof op!=='string')return false;
 if(op==='advance')return (reply as any)?.torus_set_landed!==undefined&&(reply as any)?.torus_set_landed!==null;
 return !TORUS_FOLLOWS.has(op);
}
const samePlace=(a:ReceiverPlace|null,b:ReceiverPlace|null)=>a===null||b===null?a===b:a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
type Cadence={rate:number;period:number;source:string;timer:ReturnType<typeof setInterval>;started:number;
 beats:number;issued:number;applied:number;skipped:number;suspended:number;inFlight:boolean;lastEventMs?:number;maxEventMs?:number;stopped?:string;stopped_at?:number};
/** Keys of the Jankó surface as the Torus's session takes them (instrument-session.mjs #keys: 1..32, row 0–5, column 0–65535), copied
 * to their two fields; null when any is not one. `min` 0 reads a receipt's made-way list, which may be empty. */
function torusKeys(keys:unknown,min=1):{row:number;column:number}[]|null{
 if(!Array.isArray(keys)||keys.length<min||keys.length>(min===0?64:32))return null;
 const read=keys.map((key:any)=>Number.isInteger(key?.row)&&key.row>=0&&key.row<=5&&Number.isInteger(key?.column)&&key.column>=0&&key.column<=65535?{row:key.row as number,column:key.column as number}:null);
 return read.every(key=>key!==null)?read as {row:number;column:number}[]:null;
}
/** The sample a played act landed at (O-I 855): `at` when it named one, else the cursor the owner acknowledged it at, where the owner's
 * render lands an act struck now (QL-MEF continuous.rs strike_when; cpp/src/field_worker.cpp strike). A played act renders no frames, so
 * that cursor is the one it was sent at; it is the cursor the session journals the act at (instrument-session.mjs #journal). */
function landedAt(session:InstrumentSession,at?:string):string{return at??String(session.reading.acknowledged.samples_elapsed);}
/** The QL driver schedules PCM/targets; the app remains the sole GPU stage.
 * The controller owns admission/lifetime only, never native math or a second clock.
 * Determinant events (M1 advance, a changed event) go to the same serial owner;
 * the cadence is a request rate, never a local oscillator or tick model.
 */
export class NativeFieldController {
 private session:InstrumentSession|null=null;private projection:NativeProjection|null=null;
 private context:AudioContext|null=null;private opened:any=null;private epoch=0;private dead=false;
 private recovery:(()=>void)|null=null;private checkpoint:any=null;private contextLost=false;
 private pending:Promise<unknown>=Promise.resolve();private muted=true;private serialDepth=0;
 private sources:any=null;private domain:NativeDomainReading|null=null;
 private openingHold:string|null=null;private closing:Promise<void>|null=null;
 private lastNative:any=null;private holdRevision=0;
 private admitting:number|null=null;
 private suspension:{tokens:Set<symbol>;epoch:number;revision:number;restore:boolean;reason:string}|null=null;
 private restoring:{epoch:number;revision:number}|null=null;
 private scene=false;private influenceReading:any=null;private acting:SceneActing|null=null;
 private stageReading:any=null;private stageStale=false;
 /** The last stage act's standing: the owner's own receipt (applied) or its refusal in its words; null before any act. */
 private stageLast:{standing:'applied'|'refused';procedure_ref?:string;why?:string}|null=null;
 /** The Torus's M1′ session as the owner last gave it (QL's `torus-state` or a Torus act's reply, ql.m1-prime-session/v1; O-I #850), when
  * it was read, and the owner's refusal of the read (an owner that holds no session), which stops the human-cadence re-read. */
 private torus:any=null;private torusAt=0;private torusRefused:string|null=null;
 /** The name the kernel relayed the last Torus checkpoint under (its `value_sha256`, `torus_checkpoint_sha256`; O-I #852), with the sample
  * it was taken at, and each kept checkpoint's name: a sound is saved from, and opened against, a checkpoint by that name. */
 private relayed:{sha256:string;at:unknown}|null=null;private named=new WeakMap<object,string>();
 /** The Torus as an object of the scene (src/engine/torusObject.ts; DLW §21.2 "The Torus in the pane", O-I 851): it presents each
  * admitted frame on the shape the owner's figure law names, and offers the voices that sound as force points. One per lifetime. */
 private torusObject=new TorusObject();
 /** The View you keep (DLW §21.2, as the pane draws it): yours, so each Torus object this field makes draws it (setView). */
 private view:TorusView='surface';
 /** While the plate studies the modes under Manual, Focus or Automation the pulse is tuned to the drive (§20.14); the torus's own
  * rate is kept to give back. */
 private pulseTuning:{hz:number;before:unknown}|null=null;
 private event:any=null;private opening:any=null;private sourcesStale=false;
 /** The latest sample a Torus Fundamental sent ahead waits for (O-I 855): sources read before the owner's sound reaches it stay stale. */
 private fundamentalAt:bigint|null=null;private influenceStale=false;private timing:any=null;private timingStart=0;private lastInspect=0;
 private operating=0;private cadence:Cadence|null=null;private lastCadence:Cadence|null=null;
 private refusal:{operation:string;reason:string;at:number}|null=null;
 private played:{at:number;strikes:number;last_ms:number}|null=null;
 /** The voices the instrument was last struck on, for the plate to follow (torusPlay.mjs): a played note names its own voices, a
  * determinant event that strikes names every voice the owner tunes, and a strike at points of the surface names every voice the owner
  * tunes too, with the points it was struck at. The owner reports no per-voice amplitude, so the latest strike stands. */
 private struck:{at:number;source:'note'|'event'|'point';refs:string[];points?:{theta:number;phi:number}[]}|null=null;
 /** Where the Torus is heard from (DLW manual §21.2 View: "Receiver On makes your camera the place where the torus is heard"; Rules: "A
  * camera move does not change the sound, unless Receiver is On"; QL-MEF `torus-receiver`, O-I 856). On is the person's choice and outlives
  * a lifetime, as the level does. The place last asked for (the camera's eye) and the place the owner hears from (null: the world's
  * context) are this lifetime's and are never read out: the owner's answer names the context and the gain each voice is heard by, and a
  * refusal its words with the place it refused, which is not asked again within RECEIVER_RETRY_MS. One ask is in flight at a time. */
 private receiverOn=false;private wantedAt:ReceiverPlace|null=null;private heardAt:ReceiverPlace|null=null;private hearing:Promise<void>|null=null;
 private heardReply:ReceiverReading|null=null;private receiverRefusal:{why:string;place:ReceiverPlace|null;shared:string|null;at:number}|null=null;
 /** The reference where you stand is shared under while Receiver is On (O-I #856, QL-MEF #289 packet N), and the one the owner last heard it
  * under: null is the listener's own context. A shared place is disclosed with its reference, so its reference is read out. */
 private sharedAs:string|null=null;private heardShared:string|null=null;
 private level:GainNode|null=null;private levelValue:number=PRESENTATION_LEVEL.initial;
 /** The Torus heard in the desktop's one engine (O-I #849): handed over to it (torus-native, kept by the kernel under the lease), so this
  * frame's own sound of the torus is shut (`gate`, after the level and its voice tap: the symbols' voices still listen) and the part
  * sounds once, through the engine's mixer and Main. The engine follows the owner's acts and the receiver's moves as the kernel tells them;
  * whatever else moves the owner's Torus (torusMoved) has it handed over again. */
 private engine:{on:boolean;stale:boolean;handed:StageTorusEngine|null;refusal:string|null;again:boolean}={on:false,stale:false,handed:null,refusal:null,again:false};
 private gate:GainNode|null=null;
 /** The context time the frame's own sound of the Torus shuts at (round 13): when it plays the sample the owner handed the Torus over at. */
 private frameUntil:number|null=null;
 /** A unity node the symbols' voices listen to (symbolVoices.ts): the torus's sound after the presentation level and before its effects. */
 private tap:GainNode|null=null;
 /** The torus's four effects (manual §21.5): their state outlives an instrument's lifetime, as the level's does; their sound stands
  * only while an audio stage does. */
 private effects:EffectsState=initialEffects();private effectsGraph:PresentationEffects|null=null;
 private closeOwner(opened:any){
  if(!opened)return Promise.resolve();
  if(opened.closing)return opened.closing as Promise<void>;
  opened.closing=this.port.request({operation:'close',lease:opened.lease}).then(()=>{opened.closed=true;});
  // Keep the acknowledgement for release; a failed close is never reissued.
  opened.closing.catch(()=>{});return opened.closing as Promise<void>;
 }
 private async readSources(session:InstrumentSession){
  const sources=await session.inspect(),reading=session.reading;
  if(this.session!==session||this.dead)throw new Error('native source reply belongs to a released lifetime');
  const domain=projectNativeSources(sources,{event_ref:reading.event_ref,subject_ref:reading.subject_ref,generation:reading.acknowledged.generation});
  this.sources=sources;this.domain=domain;this.scene=isScene(sources);
  const modes=sources?.current?.m2?.resonator?.modes;
  this.torusObject.setModeRefs(Array.isArray(modes)?modes.map((mode:any)=>mode?.mode_ref):null);
  if(this.scene){this.event=eventFromSources(sources);this.acting=readScene(sources,this.influenceReading,this.opened?.source);}
  // A Fundamental sent ahead moves the scene's event where it lands: sources read before then are stale already (O-I 855).
  if(this.fundamentalAt!==null&&BigInt(reading.acknowledged.samples_elapsed)>=this.fundamentalAt)this.fundamentalAt=null;
  this.sourcesStale=this.fundamentalAt!==null;this.lastInspect=performance.now();
  return sources;
 }
 private async readInfluence(session:InstrumentSession){
  const influence=await session.influence();
  if(this.session!==session||this.dead)throw new Error('native influence reply belongs to a released lifetime');
  this.admitInfluence(influence);
  return influence;
 }
 private admitInfluence(influence:any){
  this.influenceReading=influence;this.influenceStale=false;
  this.torusObject.setBody(influence);this.projection?.refresh();
  if(this.sources)this.acting=readScene(this.sources,influence,this.opened?.source);
 }
 status:NativeStatus='manual';reason:string|null=null;
 onChange:()=>void=()=>{};
 constructor(private port:NativePort,private renderer:NativeRenderer,
  private audio:(rate:number)=>AudioContext=rate=>new AudioContext({sampleRate:rate}),
  private playback:NativePlaybackPolicy={blockFrames:512,leadSeconds:.04,lookaheadSeconds:.1}){
  this.playback=Object.freeze({...this.playback});
  port.onHold=reason=>{this.hold(reason);};
 }
 private cadenceReading(){
  const c=this.cadence??this.lastCadence;if(!c)return{playing:false,rate:null,source:null};
  const elapsed=((c.stopped_at??performance.now())-c.started)/1000;
  return{playing:!!this.cadence,rate:c.rate,source:c.source,beats:c.beats,issued:c.issued,applied:c.applied,skipped:c.skipped,suspended:c.suspended,
   achieved_ticks_per_second:elapsed>0?c.applied/elapsed:0,stopped:c.stopped??null,last_event_ms:c.lastEventMs??null,max_event_ms:c.maxEventMs??null,last_event_timing:this.timing,
   law:'serial m1-advance through the one native owner; a beat is skipped, never queued, while the owner is busy'};
 }
 get reading(){
  const physical=this.domain?.m3.physical_form;
  const following=this.status==='following';
  const physical_form_actuator=applyPhysicalFormPose(physical??null,following&&!!physical);
  const unavailable=[
   physical_form_actuator.applied?null:`M3 physical form pose: ${'reason' in physical_form_actuator?physical_form_actuator.reason:'unavailable'}`,
   'material model replacement beyond the existing modal owner requires a new binding'].filter((x):x is string=>!!x);
  const clock=this.projection?.inspect().native?.clock??null;
  const trace=this.scene&&this.influenceReading
   ?{...sceneCausalTrace(this.influenceReading,this.acting,{following,muted:this.muted,targetsConnected:!!this.projection,clock}),
     physical_form:physical_form_actuator}
   :this.domain?{
    schema:'oi.native-causal-trace/v1',
    layers:[
      {layer:'M1',source_ref:this.domain.m1.coordinate,generation:this.domain.m1.revision,target:'carrier quadrature / harmonic row',actuator:'native domain overlay + continuous topology',observable:'SVG carrier lines / retained topology'},
      {layer:'M2',source_ref:this.domain.m2.modes[0]?.ref??'—',generation:String(this.domain.m2.generation),target:'modal frequency / damping / PCM',actuator:'NativeAudioBinding + material modes',observable:'audio device + modal standing'},
      {layer:'M3',source_ref:this.domain.m3.codon_ref,generation:String(this.domain.m3.generation),target:'transcription + codon (entering the M2 Vimarśā reading)',actuator:'coupled composer; no physical-form pose consumer',observable:'transcription overlay; pose not actuated'},
    ],
    physical_form:physical_form_actuator,
   }:null;
  return{schema:'oi.native-expression-reading/v1',status:this.status,reason:this.reason,
  source:this.opened?.source??null,lease:this.opened?.lease??null,
  playback_policy:{...this.playback,owner:'QL InstrumentSession / explicit application buffering; no sample-rate change'},
  renderer_requirements:this.renderer.retainedTopology?.()??null,
  presentation_mode:!this.projection?'manual':this.projection.scale===this.opened.presentation.units_per_metre?'domain-follow':'manual-presentation-override',
  presentation_units_per_metre:this.projection?.scale??null,
  presentation_level:{value:this.levelValue,...PRESENTATION_LEVEL},
  // The Torus in the desktop's one engine (O-I #849): whether it sounds there, what it was handed over by, whether the owner's Torus moved
  // since, the refusal of the last hand-over, and the gain of this frame's own sound of it (0 while the engine sounds it).
  torus_engine:{on:this.engine.on,handed:this.engine.handed,stale:this.engine.stale,refusal:this.engine.refusal,frame_gain:this.gate?.gain.value??null,frame_until:this.engine.on?this.frameUntil:null},
  presentation_effects:this.effects,
  // Where the Torus is heard from: Receiver On or Off, the owner's context and gains, and its refusal; never the place (O-I 856).
  receiver:this.receiverReading(),
  native:this.session?.reading??this.lastNative,muted:this.muted,
  domain:this.domain,source_currentness:this.domain?(this.sourcesStale?'inspected before the latest determinant event; influence is current':following?'inspected-native-basis; continuous cursor reported separately':'held-last-inspected-basis'):'unavailable',
  presented_clock:clock,
  instrument:this.scene?{schema:'oi.scene-instrument-reading/v1',acting:this.acting,influence:this.influenceReading,influence_stale:this.influenceStale,
   opening_event_available:!!this.opening,sources_stale:this.sourcesStale,cadence:this.cadenceReading(),refusal:this.refusal,played:this.played,struck:this.struck,
   stage:this.stageReading,stage_stale:this.stageStale,stage_last:this.stageLast,
   // The Torus's M1′ session, verbatim from the owner's last reply (null until it is read).
   torus:this.torus,
   // The Torus as the pane shows it: its shape by the law, its passage, its voices and its four boundaries (O-I 851).
   torus_object:this.torusObject.reading(),
   // The live scene's M2 condition, verbatim from the sources last inspected (instrumentCondition.ts): announced, never derived here.
   condition:conditionReadingOf(this.sources)??null,
   presentation:INSTRUMENT_PRESENTATION}:null,
  checkpoint:this.checkpoint?{supported:true,scope:'same live GPU and unchanged native cursor',receipt:this.checkpoint.receipt}:null,
  exact_seek:false,restart:'explicit new native process; no implicit rewind',
  domain_owned:['M1/M2/M3 native targets','native PCM','native clock'],
  presentation_owned:['resident particle mechanics','camera','presentation scale','presentation level','presentation effects'],
  presentation_changes_requiring_rebind:['scene membership','target topology or density','authored scene configuration while leased'],
  unavailable_consumers:unavailable,
  causal_trace:trace,
  physical_form_actuator,
  actuator_standing:nativeActuatorStanding({status:this.status,domain:this.domain as any,instrument:this.scene?{voices:this.acting?.voices??null}:null}),
 } as const;}
 private changed(){this.onChange();}
 /** The instrument's primary opening: QL composes a scene binding (`ql scene binding`) for this stage's
  * own retained texture; the kernel supplies the dated sky. No path, no file.
  * A saved occasion re-opens on its own sky: `skySnapshot` is the exact
  * admitted `ql.sky-snapshot/v1` the saved composition carries, passed as the
  * kernel's `sky_snapshot`, so the kernel runs no ql-sky and the binding
  * stands on the sky the composition was saved with. The sky the Sky shows
  * opens the same way (O-I ticket 854; readHandedSky). */
 async compose(options:{sky?:NativeSky;skySnapshot?:unknown;event?:unknown}={}){
  const topology=this.renderer.retainedTopology?.();
  if(!topology)throw new Error('The retained GPU field must be live before the instrument opens');
  const base={texture:[topology.tex_width,topology.tex_height],units_per_metre:INSTRUMENT_PRESENTATION.units_per_metre};
  const event=options.event!==undefined?{event:options.event}:{};
  let request:Record<string,unknown>;
  if('skySnapshot' in options){
   const snapshot=readHandedSky(options.skySnapshot,'The sky to open on');
   if(!snapshot)throw new Error('The sky to open on is not one bounded ql.sky-snapshot/v1 owner reading');
   request={...base,sky_snapshot:snapshot,...event};
  }else{
   const sky=options.sky??'now';
   if(!(sky==='none'||sky==='now'||(typeof sky==='object'&&typeof sky?.epoch==='string')))throw new Error('sky must be none, now or a dated epoch');
   request={...base,sky,...event};
  }
  return this.admit(SCENE_SAMPLE_RATE,()=>this.port.request({operation:'compose',request},COMPOSE_TIMEOUT_MS));
 }
 /** Inspect depth: an explicit Central binding document. */
 async connect(path:string,revision:string,sampleRate:number){
  return this.admit(sampleRate,()=>this.port.request({operation:'open',path,expected_revision:revision}));
 }
 private stage(context:AudioContext){
  // One presentation gain stage between the native receiver and the device, then the torus's four effects (Filter, Dynamics,
  // Delay, Reverb; each passes its input unchanged while off). The receiver keeps its own gain and clip law; nothing is synthesised here.
  const level=context.createGain();level.gain.value=this.levelValue;
  const effects=new PresentationEffects(context,context.destination,this.effects);
  // The frame's own sound of the torus passes the engine gate: shut while the desktop's one engine sounds it (torusEngine).
  const gate=context.createGain();gate.gain.value=this.engine.on?0:1;level.connect(gate);gate.connect(effects.input);this.gate=gate;
  // The voice tap: the symbols' voices (DLW §20.2: "The voice carries part of the torus's sound to where the symbol stands") take their
  // input from this node, in this context. It listens; nothing is synthesised and nothing flows back into the torus's path.
  const tap=context.createGain();level.connect(tap);
  this.level=level;this.tap=tap;this.effectsGraph?.dispose();this.effectsGraph=effects;
  return new Proxy(context,{get:(target,key)=>{if(key==='destination')return level;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as AudioContext;
 }
 private async admit(sampleRate:number,open:()=>Promise<any>){
  if(this.dead||this.status==='opening'||this.session||this.closing||this.suspension)throw new Error('release the current native owner and instrument suspension before opening another');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('native binding must supply its actual sample rate');
  const epoch=++this.epoch;this.admitting=epoch;this.status='opening';this.reason=null;this.openingHold=null;this.lastNative=null;this.refusal=null;this.played=null;this.struck=null;this.changed();
  let context:AudioContext|null=null;
  try{
   // This is invoked directly by the person's open action; no microphone and no
   // autoplay on mode entry. A failed audio device prevents opening native work.
   context=this.audio(sampleRate);this.context=context;await context.resume();
   if(epoch!==this.epoch||this.dead){if(context.state!=='closed')await context.close();return;}
   if(context.sampleRate!==sampleRate||context.state!=='running')throw new Error('audio device/native rate or activation mismatch');
   const opened=await open();
   if(epoch!==this.epoch||this.dead){await this.closeOwner(opened);return;}
   this.opened=opened;
   if(opened.schema!=='oi.native-expression-open/v1'||opened.receipt?.field?.sample_rate!==sampleRate)throw new Error('native open receipt/sample rate mismatch');
   const stage=this.renderer.retainedTargetPort();
   this.projection=new NativeProjection(stage,opened.receipt.field,opened.presentation);
   this.torusObject=new TorusObject();this.torusObject.setView(this.view);this.torusObject.setSampleRate(sampleRate);this.projection.setPresenter(this.torusObject);
   this.renderer.setNativeDomain(true);
   this.session=new InstrumentSession({...this.playback,context:this.stage(context),owner:this.renderer,initialReceipt:opened.receipt,
    transport:{request:async(request:any)=>{
     const reply=await this.port.request({operation:'exchange',lease:opened.lease,request});
     // The kernel names each Torus checkpoint it relays (O-I #852); the session passes the checkpoint on without it.
     if(request?.command?.operation==='torus-checkpoint')this.relayed=typeof reply?.torus_checkpoint_sha256==='string'?{sha256:reply.torus_checkpoint_sha256,at:reply.torus_checkpoint?.taken_at_samples}:null;
     // The Torus the engine sounds is handed over again once anything but an act the engine follows moved it (O-I #849).
     if(this.engine.on&&reply?.status==='ok'&&torusMoved(request?.command,reply))this.engineMoved();
     return reply;
    },close:()=>{void this.closeOwner(opened).catch(()=>{});}},fieldBinding:this.projection,muted:true});
   this.recovery=this.renderer.onRetainedRecoveryRequired(state=>{this.contextLost=state==='lost';this.hold(`GPU context ${state}; explicit same-state checkpoint recovery or disconnect required`);});
   const sources=await this.readSources(this.session);
   if(this.scene){await this.readInfluence(this.session);this.opening=eventFromSources(sources);}
   await this.session.recover('complete native sources admitted; rebase device only');
   if(epoch!==this.epoch||this.dead)return;
   // Reassert an existing admission hold without issuing a new controller hold:
   // the suspension token must keep ownership of its captured hold revision.
   if(this.openingHold){this.session.hold(this.openingHold);this.status='held';this.reason=this.openingHold;}
   else{
    // Rebase once more immediately before the pump so inspect/open cost cannot
    // consume the whole audio lead on a slow GPU/main-thread admission path.
    await this.session.recover('pre-pump device rebase after source admission');
    if(epoch!==this.epoch||this.dead)return;
    if(this.openingHold){this.session.hold(this.openingHold);this.status='held';this.reason=this.openingHold;}
    else{this.status='following';this.session.start();}
   }
   this.changed();
  }catch(error){
   // A completion belonging to an old epoch may not close a newer owner.
   if(epoch!==this.epoch||this.dead){if(context&&context.state!=='closed')await context.close();return;}
   await this.release(false);this.status='unavailable';this.reason=String(error);this.changed();throw error;
  }finally{if(this.admitting===epoch)this.admitting=null;}
 }
 /** Called by the actual app frame. A hidden/paused app cannot leave audio running. */
 frame(delta:number,paused:boolean){
  if(paused&&!this.suspension&&this.status==='opening')this.hold('application paused during native admission');
  if(paused&&!this.suspension&&this.session&&this.status==='following')this.hold('application paused or hidden');
  if(this.session){
   const reading=this.session.reading;
   if(!reading.available&&this.status!=='unavailable'){this.status='unavailable';this.reason=reading.reason??'native acknowledgement unavailable';this.pause('owner unavailable');this.changed();}
   else if(reading.held&&this.status==='following'){this.status='held';this.reason=reading.reason??'native/audio owner held';this.changed();}
   if(this.status==='following'){try{this.session.present();}catch(error){this.hold(String(error));}}
  }
  return this.status==='manual'?delta:this.status==='following'?delta:0;
 }
 hold(reason='manual hold'){
  this.holdRevision++;
  // During admission the hold is recorded, not applied: the owner is not yet
  // pumping, its source reads must complete, and admission reasserts the hold.
  if(this.admitting===this.epoch){this.openingHold=reason;return;}
  if(!this.session)return;
  this.session.hold(reason);this.status='held';this.reason=reason;this.changed();
 }
 /** A temporary instrument hold owns only the state it actually suspended.
  * Other holds and native lifetimes can never be released by its token. */
 suspend(reason:string):symbol{
  if(!reason||reason.length>2048)throw new Error('invalid instrument suspension');
  const token=Symbol('native instrument suspension');
  if(this.suspension){this.suspension.tokens.add(token);return token;}
  const pending=this.restoring;
  const restore=this.status==='following'||(this.admitting===this.epoch&&!this.openingHold)
   ||!!(pending&&pending.epoch===this.epoch&&pending.revision===this.holdRevision);
  // A pre-existing manual/error hold keeps its reason and revision.
  if(restore)this.hold(reason);
  this.suspension={tokens:new Set([token]),epoch:this.epoch,revision:this.holdRevision,restore,reason};
  return token;
 }
 async releaseSuspension(token:symbol):Promise<void>{
  const suspension=this.suspension;
  if(!suspension?.tokens.delete(token)||suspension.tokens.size)return;
  this.suspension=null;
  if(!suspension.restore||suspension.epoch!==this.epoch||suspension.revision!==this.holdRevision||this.dead)return;
  if(this.admitting===this.epoch){this.openingHold=null;this.reason=null;return;}
  const restoring={epoch:suspension.epoch,revision:suspension.revision};this.restoring=restoring;
  try{await this.resumeAt(restoring.epoch,restoring.revision);}
  finally{if(this.restoring===restoring)this.restoring=null;}
 }
 private async idle(){const session=this.session;if(!session)throw new Error('native owner unavailable');
  const deadline=performance.now()+6500;while(session.reading.in_flight){if(performance.now()>deadline)throw new Error('native operation still in flight; not retried');await new Promise(r=>setTimeout(r,8));}
  return session;
 }
 /** Wait for the one serial owner to be between exchanges; never interrupt one. */
 private async waitIdle(session:InstrumentSession,ms:number){
  const deadline=performance.now()+ms;
  while(session.reading.in_flight){if(performance.now()>deadline||!this.current(session))return false;await new Promise(r=>setTimeout(r,4));}
  return this.current(session);
 }
 private serial<T>(action:()=>Promise<T>):Promise<T>{
  const epoch=this.epoch;this.serialDepth++;
  const result=this.pending.then(async()=>{if(epoch!==this.epoch||this.dead)throw new Error('native operation cancelled by lifetime change');return action();});
  const done=result.finally(()=>{this.serialDepth--;});
  this.pending=done.catch(()=>{});return done;
 }
 private current(session:InstrumentSession){return this.session===session&&!this.dead;}
 private finishCommand(session:InstrumentSession,following:boolean,revision:number,reason:string){
  if(!this.current(session))throw new Error('native operation belongs to a released lifetime');
  this.checkpoint=null;
  if(following&&revision===this.holdRevision&&!this.contextLost&&!this.suspension){this.status='following';this.reason=null;session.start();this.changed();}
  else{session.hold(this.reason??reason);this.status='held';this.reason??=reason;this.changed();}
 }
 resume(){return this.resumeAt(this.epoch,this.holdRevision);}
 private resumeAt(epoch:number,revision:number){return this.serial(async()=>{
  const permitted=()=>epoch===this.epoch&&revision===this.holdRevision&&!this.suspension&&!this.dead;
  if(!permitted())return;
  const session=this.session;if(!session)throw new Error('native owner unavailable');
  try{
   if(this.contextLost)throw new Error('GPU context is unavailable');
   if(this.reason?.startsWith('GPU context'))throw new Error('restore a same-state GPU checkpoint before resuming, or disconnect');
   await this.context?.resume();await this.idle();
   if(!this.current(session))throw new Error('native resume belongs to a released lifetime');
   if(!permitted())return;
   await session.recover('explicit native resume');
   this.finishCommand(session,true,revision,'resume interrupted by a newer hold');
  }catch(error){if(this.current(session))this.hold(String(error));throw error;}
 });}
 operate(command:unknown){return this.serial(async()=>{
  const following=this.status==='following';this.hold('native operation');const revision=this.holdRevision;
  const session=await this.idle();
  try{
   await session.recover('native operation admission');const result=await session.operate(command);
   await this.readSources(session);if(this.scene)await this.readInfluence(session);
   await session.recover('native operation readback admitted; rebase device only');
   this.finishCommand(session,following,revision,'native operation applied while held; resume explicitly');return result;
  }catch(error){if(this.current(session))this.hold(String(error));throw error;}
 });}
 /** A determinant event the owner acknowledged strikes every voice it tunes when the event says so (`replace-event` with strike) or when the
  * owner's own policy does (an M1 advance under `strike_on_event`). Anything else (a stage procedure, an event that does not strike) is not
  * recorded as a strike. */
 private noteEventStrike(command:any){
  const strikes=command?.operation==='replace-event'?command.strike===true
   :command?.operation==='m1-advance'?this.influenceReading?.material?.strike_on_event!==false:false;
  const refs=this.voiceRefs();
  if(strikes&&refs.length)this.struck={at:Date.now(),source:'event',refs};
 }
 /** The voices the owner tunes, by the owner's own mode refs (QL's influence `mode_ref`: `scene:planet/…` under Sky, `scene:logic/k`
  * under Logic, O-I #850); a voice that names only its planet is that planet's voice. */
 private voiceRefs():string[]{
  return (Array.isArray(this.influenceReading?.voices)?this.influenceReading.voices:[])
   .map((v:any)=>typeof v?.mode_ref==='string'&&v.mode_ref?v.mode_ref:typeof v?.planet_ref==='string'&&v.planet_ref?voiceModeRef(v.planet_ref):null)
   .filter((r:string|null):r is string=>r!==null);
 }
 /** A refused determinant leaves the owner and its standing unchanged. */
 private refused(operation:string,error:unknown,session:InstrumentSession){
  if(!this.current(session)||!session.reading.available)return false;
  this.refusal={operation,reason:String(error instanceof Error?error.message:error),at:Date.now()};this.changed();return true;
 }
 /** A scene determinant event through the one serial owner. While following, the
  * re-read targets queue behind already scheduled sound (no hold, no rebase);
  * while held, the event commits and the owner stays held. */
 /** Resolves with the sample the act landed at: the owner's cursor when it acknowledged the act (the journal's own; O-I 855). */
 private determinant(operation:string,build:()=>any,needsEvent:boolean,cadence=false,still=false):Promise<string>{
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: determinant events belong to a scene owner'));
  if(this.status==='following'&&!this.suspension){
   const live=async()=>{
    this.operating++;
    try{
     // A beat may wait for the pump's exchange to finish, never past its own
     // period: later beats are skipped meanwhile, never queued behind it.
     if(!(await this.waitIdle(session,cadence?Math.min(900,this.cadence?.period??250):5000)))throw new Error('native owner busy; the event was not sent');
     if(needsEvent&&this.sourcesStale){await this.readSources(session);if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy; the event was not sent');}
     if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the event was sent');
     this.timingStart=performance.now();
     // The event holds the one owner while sound waits: send it on a full
     // lookahead so its latency spends buffered sound, not an underrun.
     for(let block=0;block<8;block++){
      const before=session.reading.acknowledged?.samples_elapsed;
      await session.pump();
      if(session.reading.acknowledged?.samples_elapsed===before||this.status!=='following')break;
     }
     const command=build();
     const sent=performance.now();
     const landed=(await session.operate(command)).acknowledged.samples_elapsed as string;
     this.timing={fill_ms:sent-this.timingStart,operate_ms:performance.now()-sent};
     if(!this.current(session))return landed;
     // The owner acknowledged: the event happened. A busy follow-up read only
     // leaves the influence stale for the next refresh; it never un-counts it.
     // A still act (a Torus setting that moves no native state, O-I #850) leaves the sources, the stage and the checkpoint as they stood.
     // A determinant may move the pulse's figure (a tritone crossing shows the Klein bottle for one step): the session is read again on
     // the next refresh, not at the human cadence (O-I 851).
     if(!still){this.checkpoint=null;this.sourcesStale=true;this.influenceStale=true;this.stageStale=true;this.torusAt=0;}
     this.refusal=null;
     // The acknowledgement carried the new influence; take it without a
     // second exchange (the audio pump must not wait on another read).
     const carried=session.lastInfluence;
     if(carried&&carried.generation===session.reading.acknowledged?.generation)this.admitInfluence(carried);
     this.noteEventStrike(command);
     this.changed();
     return landed;
    }catch(error){if(!(cadence&&TRANSIENT.test(String(error))))this.refused(operation,error,session);throw error;}
    finally{this.operating--;}
   };
   return cadence?live():this.serial(live);
  }
  return this.serial(async()=>{
   const following=this.status==='following',prior=this.reason;this.hold('native determinant event');const revision=this.holdRevision;
   const held=await this.idle();
   this.operating++;
   try{
    await held.recover('native determinant admission');
    if(needsEvent&&this.sourcesStale)await this.readSources(held);
    const command=build();
    const landed=(await held.operate(command)).acknowledged.samples_elapsed as string;
    this.refusal=null;this.stageStale=true;
    await this.readSources(held);await this.readInfluence(held);
    this.noteEventStrike(command);
    await held.recover('native determinant readback admitted; rebase device only');
    this.reason=following?null:prior;
    this.finishCommand(held,following,revision,'determinant applied while held; resume explicitly');
    return landed;
   }catch(error){
    if(this.refused(operation,error,held)){held.hold(prior??'determinant refused');this.status='held';this.reason=prior??'determinant refused';this.changed();}
    else if(this.current(held))this.hold(String(error));
    throw error;
   }finally{this.operating--;}
  });
 }
 /** M1's own advance on the owner (M1Engine::advance), then the whole event re-read. */
 m1Advance(ticks=1){
  if(!Number.isInteger(ticks)||ticks<1||ticks>1_000_000)return Promise.reject(new Error('M1 advance must be 1..1000000 ticks'));
  return this.determinant('M1 advance',()=>({operation:'m1-advance',ticks}),false);
 }
 replaceEvent(event:unknown,strike:boolean){
  if(typeof strike!=='boolean')return Promise.reject(new Error('strike must be explicit'));
  return this.determinant('replace event',()=>({operation:'replace-event',event:structuredClone(event),strike}),false);
 }
 /** One determinant changed on the owner's current event. Strike follows the
  * owner's declared `strike_on_event` policy, as its own M1 advance does. */
 edit(edit:SceneEdit){
  const label=edit.kind==='lens'?'lens':edit.kind==='context-frame'?'Context Frame':edit.kind==='harmonic'?'harmonic basis':'transcription';
  try{if(this.event)editSceneEvent(this.event,edit);}catch(error){if(this.session)this.refusal={operation:label,reason:String(error instanceof Error?error.message:error),at:Date.now()};this.changed();return Promise.reject(error);}
  return this.determinant(label,()=>({operation:'replace-event',event:editSceneEvent(this.event,edit),strike:this.influenceReading?.material?.strike_on_event!==false}),true);
 }
 /** The owner's audio clock (O-I #809), for a player that schedules ahead on it: the sample cursor the owner's rendered sound stands at
  * (the session's acknowledged samples_elapsed), the field's sample rate, and the playback policy's lookahead and block. A strike at a
  * later sample lands there; one at or before this cursor is already rendered. Refused while no scene owner follows. */
 audioClock():StageAudioClock{
  const session=this.session;
  if(!session||!this.scene||!this.opened)throw new Error('Open the live instrument first: the audio clock belongs to a scene owner');
  if(this.status!=='following'||this.suspension)throw new Error('The field is not running: resume it, then play');
  return {samples_elapsed:session.reading.acknowledged.samples_elapsed,sample_rate:this.opened.receipt.field.sample_rate,
   lookahead_seconds:this.playback.lookaheadSeconds,block_frames:this.playback.blockFrames};
 }
 /** A played note: strike the named scene voices (native mode references taken from the
  * owner's own `played_addresses`) now, or at `at` — the owner's sample cursor the note lands at
  * (O-I #809; InstrumentSession.strike), so a player scheduling ahead on the audio clock places
  * each note at its sample. A performance act, not a determinant: no hold, no source or
  * influence re-read. Struck now, the body's sound queues behind sound already scheduled — the
  * latency is the presentation lookahead, reported, never hidden. */
 playVoices(modeRefs:string[],amplitude=0.35,at?:string){
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: a played strike belongs to a scene owner'));
  if(!Array.isArray(modeRefs)||modeRefs.length<1||modeRefs.length>64||modeRefs.some(r=>typeof r!=='string'||!r))return Promise.reject(new Error('a played strike names 1..64 voices'));
  if(!Number.isFinite(amplitude)||amplitude<=0||amplitude>1)return Promise.reject(new Error('strike amplitude must be in (0, 1] modal metres'));
  if(this.status!=='following'||this.suspension)return Promise.reject(new Error('The field is not running: resume it, then play'));
  const acts=modeRefs.map(mode_ref=>({mode_ref,amplitude:[amplitude,0] as [number,number]}));
  return this.serial(async()=>{
   if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the note was not sent');
   if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the note was sent');
   const sent=performance.now();
   try{await session.strike(acts,at===undefined?{}:{at_samples_elapsed:at});}
   catch(error){this.refused('played strike',error,session);throw error;}
   this.refusal=null;this.played={at:Date.now(),strikes:(this.played?.strikes??0)+1,last_ms:performance.now()-sent};this.struck={at:Date.now(),source:'note',refs:[...modeRefs]};this.changed();
  });
 }
 /** A played strike at points of the torus surface (DLW §21.2 "What strikes the Torus"; QL-MEF #342 `strike-at`): each point is the
  * torus's own angles, theta the tube and phi the ring, on the sheet [0, 2π), struck now at the same impulse. A chord is several points
  * in one act. The owner excites every standing voice by its own shape at each point (QL scene_field.rs ShapeBasis::strike_at), so the
  * torus plays every voice it tunes. A performance act like playVoices: no hold, no re-read, and the struck body sounds behind sound
  * already scheduled, or lands at `at`, the owner's sample cursor, as playVoices does. A point off the sheet is refused here, before the
  * owner sees it, as InstrumentSession.strikeAt refuses it. The answer names the sample the act landed at (O-I 855: landedAt). */
 playAt(points:{theta:number;phi:number}[],amplitude=0.35,at?:string):Promise<{landed_at_samples_elapsed:string}>{
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: a played strike belongs to a scene owner'));
  if(!Array.isArray(points)||points.length<1||points.length>64)return Promise.reject(new Error('a strike at points names 1..64 points of the torus'));
  if(points.some(p=>![p?.theta,p?.phi].every(angle=>typeof angle==='number'&&Number.isFinite(angle)&&angle>=0&&angle<2*Math.PI)))
   return Promise.reject(new Error('a struck point names theta and phi on the sheet of the torus, each in [0, 2π)'));
  if(!Number.isFinite(amplitude)||amplitude<=0||amplitude>1)return Promise.reject(new Error('strike amplitude must be in (0, 1] modal metres'));
  if(this.status!=='following'||this.suspension)return Promise.reject(new Error('The field is not running: resume it, then play'));
  const struck=points.map(({theta,phi})=>({theta,phi}));
  const acts=struck.map(point=>({...point,amplitude:[amplitude,0] as [number,number]}));
  return this.serial(async()=>{
   if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the strike was not sent');
   if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the strike was sent');
   const sent=performance.now();
   try{await session.strikeAt(acts,at===undefined?{}:{at_samples_elapsed:at});}
   catch(error){this.refused('strike at a point',error,session);throw error;}
   const refs=this.voiceRefs();
   this.refusal=null;this.played={at:Date.now(),strikes:(this.played?.strikes??0)+1,last_ms:performance.now()-sent};this.struck={at:Date.now(),source:'point',refs,points:struck};this.changed();
   return {landed_at_samples_elapsed:landedAt(session,at)};
  });
 }
 /** Keys of the Jankó surface struck on the Torus's M1′ session (QL-MEF `torus-play`; DLW §21.2 "What strikes the Torus": a key strikes
  * its place on its helix wherever the turning torus has carried it; O-I #853): one act of 1..32 keys, each a new note, at the same
  * impulse, now or at `at`, the owner's sample cursor, as playVoices lands a note. A performance act as playVoices is: through the one
  * serial owner, so a strike and the release after it keep their order; no hold, no source or influence re-read. The owner places each
  * key's point and counts the notes; past Polyphony the oldest make way, and so does a key struck again. The answer is the keys whose
  * notes made way, read from the owner's receipt (ql.torus-play/v1); the points it struck are what the plate follows, as for a touch. */
 torusPlay(keys:{row:number;column:number}[],amplitude=0.35,at?:string):Promise<{row:number;column:number}[]>{
  return this.torusPlayed(keys,amplitude,at).then(played=>played.made_way);
 }
 /** torusPlay's act, answered whole (O-I 855): the keys whose notes made way and the sample the act landed at (landedAt), which a take
  * keeps so it replays each note where it sounded. */
 torusPlayed(keys:{row:number;column:number}[],amplitude=0.35,at?:string):Promise<{made_way:{row:number;column:number}[];landed_at_samples_elapsed:string}>{
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: a played key belongs to a scene owner'));
  const acts=torusKeys(keys);
  if(!acts)return Promise.reject(new Error('a Torus act names 1 to 32 keys of the Jankó surface, each its row 0–5 and its column'));
  if(!Number.isFinite(amplitude)||amplitude<=0||amplitude>1)return Promise.reject(new Error('strike amplitude must be in (0, 1] modal metres'));
  if(this.status!=='following'||this.suspension)return Promise.reject(new Error('The field is not running: resume it, then play'));
  return this.serial(async()=>{
   if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the note was not sent');
   if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the note was sent');
   const sent=performance.now();
   try{await session.torusPlay(acts,{amplitude:[amplitude,0],...(at===undefined?{}:{at_samples_elapsed:at})});}
   catch(error){this.refused('played key',error,session);throw error;}
   const receipt=session.lastTorusPlay as any;
   const points=(Array.isArray(receipt?.notes)?receipt.notes:[]).map((note:any)=>note?.point)
    .filter((point:any)=>[point?.theta,point?.phi].every(angle=>typeof angle==='number'&&Number.isFinite(angle)))
    .map((point:any)=>({theta:point.theta as number,phi:point.phi as number}));
   this.refusal=null;this.played={at:Date.now(),strikes:(this.played?.strikes??0)+1,last_ms:performance.now()-sent};
   this.struck={at:Date.now(),source:'point',refs:this.voiceRefs(),points};this.changed();
   return {made_way:torusKeys((Array.isArray(receipt?.made_way)?receipt.made_way:[]).map((note:any)=>note?.key),0)??[],landed_at_samples_elapsed:landedAt(session,at)};
  });
 }
 /** A singlet struck on the Torus (QL-MEF `torus-singlet`; DLW §21.2 "What strikes the Torus": "A singlet | Its codon's place on the
  * ring"; O-I #771): an applied M3 event left the cell non-dual, and its codon strikes at the arc the ring reads it at (both arcs for a
  * nonet-collision codon), where the turning torus has carried it, now or at `at`. The codon alone is sent: its place and its point are
  * the owner's (scene_field.rs SINGLET_PLACE_LAW), and the points it struck are what the plate follows, as for a key. No note is
  * counted. A performance act as torusPlayed is, through the one serial owner. The answer names the sample the act landed at. */
 torusSinglet(codon:number,amplitude=0.35,at?:string):Promise<{landed_at_samples_elapsed:string}>{
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: a singlet strikes a scene owner'));
  if(!(typeof codon==='number'&&Number.isInteger(codon)&&codon>=0&&codon<64))return Promise.reject(new Error('a singlet\'s codon is 0 to 63'));
  if(!Number.isFinite(amplitude)||amplitude<=0||amplitude>1)return Promise.reject(new Error('strike amplitude must be in (0, 1] modal metres'));
  if(this.status!=='following'||this.suspension)return Promise.reject(new Error('The field is not running: resume it, then play'));
  return this.serial(async()=>{
   if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the singlet was not sent');
   if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the singlet was sent');
   const sent=performance.now();
   try{await session.torusSinglet(codon,{amplitude:[amplitude,0],...(at===undefined?{}:{at_samples_elapsed:at})});}
   catch(error){this.refused('singlet',error,session);throw error;}
   const receipt=session.lastTorusSinglet as any;
   const points=(Array.isArray(receipt?.points)?receipt.points:[])
    .filter((point:any)=>[point?.theta,point?.phi].every(angle=>typeof angle==='number'&&Number.isFinite(angle)))
    .map((point:any)=>({theta:point.theta as number,phi:point.phi as number}));
   this.refusal=null;this.played={at:Date.now(),strikes:(this.played?.strikes??0)+1,last_ms:performance.now()-sent};
   this.struck={at:Date.now(),source:'point',refs:this.voiceRefs(),points};this.changed();
   return {landed_at_samples_elapsed:landedAt(session,at)};
  });
 }
 /** Keys let go (QL-MEF `torus-release`): they leave the count of notes, and the body rings on (a released note keeps its own tail,
  * DLW §21.2 Rules), so no native state moves. Through the one serial owner, after the strikes sent before it. */
 torusRelease(keys:{row:number;column:number}[]):Promise<void>{
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: a released key belongs to a scene owner'));
  const acts=torusKeys(keys);
  if(!acts)return Promise.reject(new Error('a Torus act names 1 to 32 keys of the Jankó surface, each its row 0–5 and its column'));
  return this.serial(async()=>{
   if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the release was not sent');
   if(!this.current(session))throw new Error('instrument closed before the release was sent');
   try{await session.torusRelease(acts);}
   catch(error){this.refused('released key',error,session);throw error;}
  });
 }
 /** The performance journal of the current native lifetime (acts and aggregate advances). */
 journal(){return this.session?this.session.journal():null;}
 /** The owner's performance journal as the stage reads it (O-I 855; stageCommands.ts `performance-journal`): the session's own
  * `ql.instrument-performance-journal/v1`, and from `from` on, only the acts that land at or after that sample (stageJournalLanding).
  * The advances are aggregate ranges and stand whole. A read past STAGE_JOURNAL_ACTS_MAX acts or STAGE_JOURNAL_BYTES_MAX bytes is
  * refused in words naming its count, so the reader asks from a later sample: an answer is never cut. */
 performanceJournal(from?:string):StagePerformanceJournal{
  if(from!==undefined&&!isStageSampleCursor(from))throw new Error('the journal is read from an exact sample cursor');
  const session=this.session;
  if(!session)throw new Error('Open the live instrument first: the performance journal belongs to a scene owner');
  const whole=session.journal() as unknown as StagePerformanceJournal;
  const acts=from===undefined?[...whole.acts]:whole.acts.filter(act=>BigInt(stageJournalLanding(act))>=BigInt(from));
  const journal:StagePerformanceJournal={schema:whole.schema,instance_ref:whole.instance_ref,acts,advances:{...whole.advances}};
  const where=from===undefined?'':` from sample ${from}`;
  if(acts.length>STAGE_JOURNAL_ACTS_MAX)throw new Error(`The journal holds ${acts.length} acts${where}, more than one answer carries (${STAGE_JOURNAL_ACTS_MAX}): read it from a later sample`);
  const bytes=new TextEncoder().encode(JSON.stringify(journal)).length;
  if(bytes>STAGE_JOURNAL_BYTES_MAX)throw new Error(`The journal${where} takes ${bytes} bytes, more than one answer carries (${STAGE_JOURNAL_BYTES_MAX}): read it from a later sample`);
  return journal;
 }
 /** Re-excite the same voices from the declared strike amplitude. */
 strike(){return this.determinant('strike',()=>({operation:'replace-event',event:structuredClone(this.event),strike:true}),true);}
 /** The first admitted event, carried under the owner's next M1 revision so M1's
  * revision never runs backwards; M2/M3 generations are re-issued by the owner. */
 restoreOpening(){
  if(!this.opening)return Promise.reject(new Error('no opening event admitted'));
  return this.determinant('return to opening event',()=>{
   const event=structuredClone(this.opening),revision=this.influenceReading?.m1_revision??this.event?.m1?.revision;
   if(typeof revision!=='string'||!/^(0|[1-9][0-9]{0,19})$/.test(revision))throw new Error('current M1 revision unavailable');
   event.m1.revision=String(BigInt(revision)+1n);return{operation:'replace-event',event,strike:true};
  },true);
 }
 get currentEvent(){return this.event?structuredClone(this.event):null;}
 get openingEvent(){return this.opening?structuredClone(this.opening):null;}
 influence(){return this.serial(async()=>{
  const session=this.session;if(!session||!this.scene)throw new Error('influence belongs to a scene owner');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy');return this.readInfluence(session);}
  this.hold('native influence reading');const held=await this.idle();
  try{await held.recover('native influence reading');return await this.readInfluence(held);}
  finally{if(this.current(held))this.hold('influence reading complete; resume explicitly');}
 });}
 /** The Ta-Onta procedural stage's scoped disclosure (ql.stage-state/v1): the
  * live constituents, their effective values and each owned slot's procedure,
  * read from the one scene owner. A read: the field does not advance. */
 stageState(){return this.serial(async()=>{
  const session=this.session;if(!session||!this.scene)throw new Error('the procedural stage belongs to a scene owner');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy');return this.readStage(session);}
  this.hold('stage disclosure reading');const held=await this.idle();
  try{await held.recover('stage disclosure reading');return await this.readStage(held);}
  finally{if(this.current(held))this.hold('stage disclosure complete; resume explicitly');}
 });}
 /** The Torus's M1′ session (QL-MEF m1_prime.rs; the host's `torus-state`, O-I #850): every setting, the band beside the rate, the
  * figure the torus shows, the comma gathered since the Torus opened and the notes the owner counts. A read: the field does not advance. */
 torusState(){return this.serial(async()=>{
  const session=this.session;if(!session||!this.scene)throw new Error('the Torus belongs to a scene owner');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy');return this.readTorus(session);}
  this.hold('Torus session reading');const held=await this.idle();
  try{await held.recover('Torus session reading');return await this.readTorus(held);}
  finally{if(this.current(held))this.hold('Torus session reading complete; resume explicitly');}
 });}
 private async readTorus(session:InstrumentSession){
  const torus=await session.torusState();
  if(this.session!==session||this.dead)throw new Error('Torus session reply belongs to a released lifetime');
  this.admitTorus(torus);return torus;
 }
 private admitTorus(torus:any){
  this.torus=torus;this.torusAt=performance.now();this.torusRefused=null;this.torusObject.setSession(torus);this.projection?.refresh();this.changed();
 }
 /** One edit of the Torus's M1′ session through the one serial owner, as every determinant goes (QL's own `torus-set`: any of rate,
  * tempo_bpm, fundamental, carrier, shape, tuning and polyphony; O-I #850). The owner validates and refuses in its own words; the
  * session reading is taken from its reply, never set here. Only a Fundamental moves the owner (one modes continuation of the same
  * voices); every other setting is a still act: no hold, no source re-read. The reply's influence is admitted as a determinant's is. */
 torusSet(edit:unknown,at?:string):Promise<string>{
  if(!edit||typeof edit!=='object'||Array.isArray(edit)||!Object.keys(edit).length)return Promise.reject(new Error('a Torus edit names at least one setting'));
  if(at!==undefined)return this.torusSetAt(edit,at);
  const still=(edit as {fundamental?:unknown}).fundamental===undefined;
  return this.determinant('Torus',()=>({operation:'torus-set',edit:structuredClone(edit)}),false,false,still).then(landed=>{
   const torus=this.session?.lastTorus;
   if(torus)this.admitTorus(torus);
   return landed;
  });
 }
 /** A Torus setting sent ahead for sample `at` (QL-MEF `torus-set` with at_samples_elapsed; O-I 855). The owner makes it at that sample
  * inside the block that reaches it, as it lands a strike, so it goes now through the one serial owner, as a played act does, and never
  * waits for the cursor. It moves nothing until then; a Fundamental made there moves the scene's event, so the sources stand stale until
  * they are read past it (readSources). At the cursor's own sample it is made now. Resolves with the sample it lands at. */
 private torusSetAt(edit:object,at:string):Promise<string>{
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: the Torus belongs to a scene owner'));
  if(!isStageSampleCursor(at))return Promise.reject(new Error('a setting names the sample it lands at as an exact sample cursor'));
  if(this.status!=='following'||this.suspension)return Promise.reject(new Error('The field is not running: resume it, then play'));
  return this.serial(async()=>{
   if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the setting was not sent');
   if(this.status!=='following'||this.suspension||!this.current(session))throw new Error('instrument held before the setting was sent');
   const waits=BigInt(at)>BigInt(session.reading.acknowledged.samples_elapsed);
   try{await session.torusSet(structuredClone(edit) as Record<string,unknown>,{at_samples_elapsed:at});}
   catch(error){this.refused('Torus',error,session);throw error;}
   if((edit as {fundamental?:unknown}).fundamental!==undefined){
    if(waits&&(this.fundamentalAt===null||BigInt(at)>this.fundamentalAt))this.fundamentalAt=BigInt(at);
    this.checkpoint=null;this.sourcesStale=true;this.influenceStale=true;this.torusAt=0;
   }
   this.refusal=null;
   const torus=session.lastTorus;if(torus)this.admitTorus(torus);
   return at;
  });
 }
 /** The Torus as it rings, kept by its owner (QL-MEF `torus-checkpoint`, `ql.torus-checkpoint/v1`; O-I 855): the body's states, its form and
  * forces, the M1′ session's steps, comma and notes, the event and its seeds, at the owner's cursor. A read through the one serial owner, as
  * the session's reading is; acts already sent for later samples are not in it (the journal keeps them). */
 torusCheckpoint():Promise<StageTorusCheckpoint>{return this.serial(async()=>{
  const session=this.session;if(!session||!this.scene)throw new Error('Open the live instrument first: the Torus belongs to a scene owner');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy; the Torus was not kept');return this.keepTorus(session);}
  this.hold('Torus checkpoint');const held=await this.idle();
  try{await held.recover('Torus checkpoint');return await this.keepTorus(held);}
  finally{if(this.current(held))this.hold('Torus checkpoint complete; resume explicitly');}
 });}
 private async keepTorus(session:InstrumentSession):Promise<StageTorusCheckpoint>{
  const kept=readStageTorusCheckpoint(await session.torusCheckpoint()),relayed=this.relayed;this.relayed=null;
  if(this.session!==session||this.dead)throw new Error('Torus checkpoint belongs to a released lifetime');
  if(!kept)throw new Error('The owner kept the Torus in a checkpoint the stage cannot carry');
  if(relayed&&relayed.at===kept.taken_at_samples)this.named.set(kept,relayed.sha256);
  const torus=session.lastTorus;if(torus)this.admitTorus(torus);
  return kept;
 }
 /** The Torus set again from a checkpoint its owner gave (QL-MEF `torus-restore`): the event and the damping where they moved, then the body's
  * states and the session's steps, one owner act through the one serial owner as a determinant is. The owner refuses in its own words a
  * checkpoint that is not of this body. Resolves with the sample it rings again from. */
 torusRestore(checkpoint:unknown):Promise<string>{
  if(!readStageTorusCheckpoint(checkpoint))return Promise.reject(new Error('a Torus restore takes the owner\'s ql.torus-checkpoint/v1'));
  return this.determinant('Torus restore',()=>({operation:'torus-restore',checkpoint:structuredClone(checkpoint)}),false).then(landed=>{
   const torus=this.session?.lastTorus;
   if(torus)this.admitTorus(torus);
   return landed;
  });
 }
 /** What rings (QL-MEF `torus-body`, O-I #852; DLW manual §21.2 Body: "The body is what rings. It is the torus unless you choose a form"):
  * the scene's own M3 form made a body (formBody), or the torus given back (null). One body act on the owner at its cursor, through the one
  * serial owner as a determinant is: the owner prepares the form, rings it from rest and refuses in its words a body this scene cannot ring.
  * What rings is read back from its reply's session reading (its `body`), never set here. Resolves with the sample it rings from. */
 torusBody(choice:StageFormBody|null):Promise<string>{
  let body:Record<string,unknown>|null=null;
  try{if(choice!==null)body=this.formBody(choice);}catch(error){return Promise.reject(error);}
  return this.determinant('Torus body',()=>({operation:'torus-body',body:structuredClone(body)}),false).then(landed=>{
   const torus=this.session?.lastTorus;
   if(torus)this.admitTorus(torus);
   return landed;
  });
 }
 /** The scene's M3 form as QL's form owner is asked to prepare it (ql.form-body-request/v1, psg-form-sampler.ts formBodyRequest): its codon
  * folded at its own angles (the M3 state's `form`, domain.m3) on the sheet QL's fold body is prepared from (FOLD_BODY_SHEET), made of the
  * scene's M2 fibre (its condition, instrumentCondition.ts), struck by the owner's session Strike, ringing the modes and Q the hand chose,
  * for the scene's event, subject and rate. Whatever the scene has not disclosed is refused in words; nothing stands in for it. */
 private formBody(choice:StageFormBody):Record<string,unknown>{
  const m3=this.domain?.m3,session=this.session,rate=this.opened?.receipt?.field?.sample_rate;
  if(!m3||!session||typeof rate!=='number')throw new Error('The scene\'s M3 form is not read yet: open the live instrument, then choose A form.');
  const crease=m3.angles_deg10;
  if(crease.length!==3||!crease.every(angle=>Number.isInteger(angle)&&Math.abs(angle)<=1800))
   throw new Error(`The scene's M3 form stands at ${crease.join(', ')} tenths of a degree: a fold's crease is a whole number of tenths of a degree within 180° either way, so this form cannot be folded into a body.`);
  const condition=conditionReadingOf(this.sources);
  if(!condition?.material_fibre)throw new Error('The scene\'s M2 condition gives no material fibre: a form\'s body is made of one, so no form can ring here yet.');
  const strike=this.torus?.settings?.strike;
  if(typeof strike!=='number')throw new Error('The owner\'s Torus session states no Strike: a form\'s body is struck by the session\'s share of velocity, and none is read.');
  const sourceRef=choice.material==='tattva'?condition.tattva_ref:'declared';
  if(!sourceRef)throw new Error('Body source is Tattva, and the M2 condition stands on no tattva: set Body source to Declared.');
  return formBodyRequest({eventRef:session.reading.event_ref,subjectRef:session.reading.subject_ref,sourceGeneration:m3.generation,
   form:{kind:'fold',formRef:m3.codon_ref,sourceRef:`ql.m3-state/v1@${m3.generation}`},preparation:structuredClone(FOLD_BODY_SHEET),
   creaseDeg10:[crease[0]!,crease[1]!,crease[2]!],material:{fibre:condition.material_fibre,qFactor:choice.q_factor,strikeShare:strike,sourceRef},
   modes:choice.modes,sampleRate:rate});
 }
 /** A sound saved from the Torus as it rings (O-I #852, DLW §21.2; kernel `torus_sound`, `oi.torus-sound/v1`): the owner keeps a checkpoint
  * through the one serial owner, and the kernel seals the sound from the checkpoint by the name it relayed it under, under this lease. The
  * torus is its body. Resolves with the sealed sound. */
 async torusSound(name:string):Promise<StageTorusSound>{
  if(!isStageSoundName(name))throw new Error(`A sound is named in 1 to ${STAGE_TORUS_SOUND_NAME_MAX} characters with no control character`);
  const {lease,checkpoint_sha256}=await this.namedCheckpoint();
  const sound=readStageTorusSound(await this.port.request({operation:'torus_sound',lease,checkpoint_sha256,name}));
  if(!sound)throw new Error('The kernel answered the sound with no oi.torus-sound/v1 the stage can carry');
  return sound;
 }
 /** A kept sound opened (kernel `torus_sound_open`, `oi.torus-sound-opening/v1`): against a fresh checkpoint of the Torus as it stands now,
  * the kernel answers the owner's restore, which is the sound as saved, and what has moved since; the owner restores it as torusRestore
  * does. Resolves with the sample it rings again from and what has moved. */
 async openTorusSound(raw:unknown):Promise<{landed_at_samples_elapsed:string;moved:StageSoundMove[]}>{
  const sound=readStageTorusSound(raw);if(!sound)throw new Error('a sound opens from the kernel\'s oi.torus-sound/v1');
  const {lease,checkpoint_sha256}=await this.namedCheckpoint();
  const opening=await this.port.request({operation:'torus_sound_open',lease,sound,now_sha256:checkpoint_sha256});
  const moved=readStageSoundMoves(opening?.moved);
  if(opening?.schema!=='oi.torus-sound-opening/v1'||opening.sound_ref!==sound.sound_ref||opening.restore?.operation!=='torus-restore'||!moved)
   throw new Error('The kernel answered the opening with no oi.torus-sound-opening/v1 of this sound');
  return {landed_at_samples_elapsed:await this.torusRestore(opening.restore.checkpoint),moved};
 }
 /** A fresh checkpoint of the Torus, named as the kernel relayed it, and the lease it was given under. */
 private async namedCheckpoint():Promise<{lease:string;checkpoint_sha256:string}>{
  const kept=await this.torusCheckpoint(),checkpoint_sha256=this.named.get(kept),lease=this.opened?.lease;
  if(!checkpoint_sha256)throw new Error('The kernel relayed the Torus checkpoint unnamed: a sound is saved from, and opened against, a checkpoint the kernel names');
  if(typeof lease!=='string')throw new Error('the live instrument closed while the Torus was kept');
  return {lease,checkpoint_sha256};
 }
 /** A take rendered offline through the M1′ session for Export Audio (QL-MEF `torus-render`, `ql.torus-render/v1`; O-I 855): a second owner
  * of the same scene set to `checkpoint`, each act made at its sample, `frames` of its PCM. It renders a second of sound at a time (the first
  * part from the checkpoint, each next continuing the last), each part one read through the one serial owner, so the live owner's sound runs
  * on between parts and the live owner neither moves nor sounds for it. Each act goes in the part its sample falls in; a key's strength is the
  * owner's pair of metres, and so are a touch's and a singlet's, each made as the owner took it live (playAt: every point at the one impulse;
  * torusSinglet), so the kernel finds the acts it relayed in the render (O-I #855, kept whole). */
 renderTake(checkpoint:unknown,acts:readonly StageTakeAct[],frames:number):Promise<StageTakeRender>{
  const kept=readStageTorusCheckpoint(checkpoint);
  if(!kept)return Promise.reject(new Error('a take renders from the owner\'s ql.torus-checkpoint/v1'));
  if(!Number.isSafeInteger(frames)||frames<1||frames>STAGE_RENDER_FRAMES_MAX)return Promise.reject(new Error(`a take renders 1 to ${STAGE_RENDER_FRAMES_MAX} frames`));
  if(!Array.isArray(acts)||acts.length>STAGE_RENDER_ACTS_MAX)return Promise.reject(new Error(`a take renders at most ${STAGE_RENDER_ACTS_MAX} acts`));
  const session=this.session,rate=this.opened?.receipt?.field?.sample_rate;
  if(!session||!this.scene||!Number.isSafeInteger(rate))return Promise.reject(new Error('Open the live instrument first: a take renders on a second owner of its scene'));
  if(kept.sample_rate!==rate)return Promise.reject(new Error(`the take was kept at ${kept.sample_rate} Hz and this field runs at ${rate} Hz`));
  const from=BigInt(kept.taken_at_samples),end=from+BigInt(frames);
  let last=from;
  for(const act of acts){
   if(!isStageSampleCursor(act?.at_samples_elapsed))return Promise.reject(new Error('a take\'s act names the sample it landed at as an exact sample cursor'));
   const at=BigInt(act.at_samples_elapsed);
   if(at<last||at>=end)return Promise.reject(new Error('a take\'s acts lie within the take, in the order of their samples'));
   last=at;
  }
  const metres=(amplitude:number):[number,number]=>[amplitude,0];
  const owned=(act:StageTakeAct)=>act.action==='strike'||act.action==='singlet'?{...act,amplitude:metres(act.amplitude)}
   :act.action==='strike-at'?{action:act.action,at_samples_elapsed:act.at_samples_elapsed,points:act.points.map(({theta,phi})=>({theta,phi,amplitude:metres(act.amplitude)}))}:act;
  return (async()=>{
   const pcm=new Float32Array(frames),made_way:StageKey[][]=[];
   let continues:string|undefined,ended:StageTorusCheckpoint|null=null,done=0,next=0;
   while(done<frames){
    const part=Math.min(rate as number,frames-done),stop=from+BigInt(done+part);
    let count=0;while(next+count<acts.length&&BigInt(acts[next+count].at_samples_elapsed)<stop)count++;
    const take={...(continues===undefined?{checkpoint:kept}:{continues}),acts:acts.slice(next,next+count).map(owned),frames:part};
    const render=await this.serial(async()=>{
     if(this.session!==session||this.dead)throw new Error('the live instrument closed while the take rendered');
     if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy; the take was not rendered');return session.torusRender(take);}
     this.hold('take render');const held=await this.idle();
     try{await held.recover('take render');return await held.torusRender(take);}
     finally{if(this.current(held))this.hold('take render complete; resume explicitly');}
    });
    const audio=render?.audio;
    if(!Array.isArray(audio)||audio.length!==part)throw new Error('the owner rendered a part of the take that is not its length');
    pcm.set(audio,done);
    for(const way of Array.isArray(render.made_way)?render.made_way:[]){
     if(!Array.isArray(way)||!way.every((note:any)=>Number.isSafeInteger(note?.key?.row)&&Number.isSafeInteger(note?.key?.column)))throw new Error('the owner named a note that made way without its key');
     made_way.push(way.map((note:any)=>({row:note.key.row,column:note.key.column})));
    }
    ended=readStageTorusCheckpoint(render.checkpoint);continues=render.continues;
    if(!ended||typeof continues!=='string')throw new Error('the owner rendered a part of the take without where it ended');
    done+=part;next+=count;
   }
   return {from_samples_elapsed:kept.taken_at_samples,frames,sample_rate:rate as number,pcm,made_way,ended:ended as StageTorusCheckpoint};
  })();
 }
 /** Wait until the owner's sound has reached `at` (its acknowledged cursor at or past it; O-I 855), so an edit made then lands at the first
  * block the owner renders from there; the edit's answer names that sample. For a determinant or a damping edit: the owner makes those only
  * at its cursor (replace-event, m1-advance and set-damping take no sample), while a Torus setting is sent ahead (torusSetAt). A sample the owner has rendered is refused, as a strike behind
  * the cursor is, and one more than STAGE_EDIT_AHEAD_SECONDS ahead is refused rather than waited for. */
 async untilSample(at:string):Promise<void>{
  if(!isStageSampleCursor(at))throw new Error('an edit names the sample it lands at as an exact sample cursor');
  const session=this.session,rate=this.opened?.receipt?.field?.sample_rate;
  if(!session||!this.scene||!Number.isSafeInteger(rate))throw new Error('Open the live instrument first: an edit at a sample belongs to a scene owner');
  if(this.status!=='following'||this.suspension)throw new Error('The field is not running: resume it, then play');
  const cursor=BigInt(session.reading.acknowledged.samples_elapsed),target=BigInt(at);
  if(target<cursor)throw new Error(`an edit at sample ${at} is behind the owner's cursor ${cursor}: that sound is already rendered`);
  if(target-cursor>BigInt(rate as number)*BigInt(STAGE_EDIT_AHEAD_SECONDS))throw new Error(`an edit at sample ${at} is more than ${STAGE_EDIT_AHEAD_SECONDS} s ahead of the owner's cursor ${cursor}: send it nearer its sample`);
  while(BigInt(session.reading.acknowledged.samples_elapsed)<target){
   if(!this.current(session)||this.status!=='following'||this.suspension)throw new Error('The field stopped before the edit\'s sample: the edit was not made');
   await new Promise(resolve=>setTimeout(resolve,4));
  }
 }
 /** Tune the pulse to the plate's drive (DLW §20.14: under Manual, Focus and Automation "the pulse is tuned to the drive and rings the
  * plate"), through the owner's own torus-set; null gives the torus its own rate back. A drive within half a percent of the one asked is
  * not asked again. Nothing while no scene's Torus has been read. */
 async tunePulse(hz:number|null){
  if(!this.session||!this.scene||!this.torus)return;
  const drive=typeof hz==='number'&&Number.isFinite(hz)&&hz>0?hz:null;
  if(drive===null){
   if(!this.pulseTuning)return;
   const before=this.pulseTuning.before;this.pulseTuning=null;
   if(before&&typeof before==='object')await this.torusSet({rate:before});
   return;
  }
  if(this.pulseTuning&&Math.abs(drive-this.pulseTuning.hz)<=this.pulseTuning.hz*0.005)return;
  this.pulseTuning={hz:drive,before:this.pulseTuning?.before??structuredClone(this.torus.settings?.rate??null)};
  await this.torusSet({rate:{mode:'free',steps_per_second:drive}});
 }
 /** The plate laid flat (§20.14: the torus's modes laid flat) while the scene's Resonance studies them. */
 layFlat(on:boolean){if(this.torusObject.layFlat(on)){this.projection?.refresh();this.changed();}}
 /** How the stage draws the Torus (DLW §21.2 View): Surface, Wire or Both, as the pane draws it; the current frame is drawn again. */
 setView(view:TorusView){this.view=view;if(this.torusObject.setView(view)){this.projection?.refresh();this.changed();}}
 /** The torus's voices that sound now, as the engine's force points (presentation units). */
 torusVoicePoints(){return this.projection?this.torusObject.voicePoints(this.projection.scale):[];}
 /** The facts the Tarot score stands on, read from this scene: the field's
  * own subject and event, the M3 clock position of the last complete source
  * read, and the admitted `ql.sky-snapshot/v1` the event carries (null when it
  * carries none; `score-resolve` then refuses in the owner's words). Null when
  * no scene owner is open or the clock is not disclosed. */
 get scoreBasis():FieldScoreBasis|null{
  const session=this.session,event=this.event;
  if(!session||!this.scene||!event)return null;
  const reading=session.reading,steps=this.sources?.current?.m3?.clock?.steps;
  const clock=typeof steps==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(steps)?Number(steps):steps;
  if(typeof clock!=='number'||!Number.isSafeInteger(clock)||clock<0)return null;
  return {schema:'oi.field-score-basis/v1',subject_ref:reading.subject_ref,event_ref:reading.event_ref,
   clock_steps:clock,occasion_sky:this.occasionSky};
 }
 /** The admitted `ql.sky-snapshot/v1` the open scene's event carries, the sky
  * this field stands on; null with no scene or no sky receipt. */
 get occasionSky():{schema:'ql.sky-snapshot/v1';snapshot_ref:string;[key:string]:unknown}|null{
  const event=this.scene?this.event:null;
  const sky=(Array.isArray(event?.source_receipts)?event.source_receipts:[]).find((r:any)=>r?.schema==='ql.sky-snapshot/v1'&&typeof r.snapshot_ref==='string'&&r.snapshot_ref)??null;
  return sky?structuredClone(sky):null;
 }
 /** The selected subject's Tarot score through the one serial owner's own
  * exchange (a read: the field never advances). A refusal comes back as data
  * in the owner's words; it never holds the owner. */
 score(command:unknown):Promise<FieldScoreReply>{return this.serial(async()=>{
  const session=this.session;if(!session||!this.scene)throw new Error('the Tarot score belongs to an open scene owner');
  // A field whose last reply never came cannot be read again: say so, rather than the recovery's own refusal.
  if(!session.reading.available)throw new Error('The live field stopped answering, so the score cannot be read. Open the live instrument again.');
  if(this.status==='following'){if(!(await this.waitIdle(session,5000)))throw new Error('native owner busy; the score reading was not sent');return session.score(command) as Promise<FieldScoreReply>;}
  this.hold('Tarot score reading');const held=await this.idle();
  try{await held.recover('Tarot score reading');return await held.score(command) as FieldScoreReply;}
  finally{if(this.current(held))this.hold('Tarot score reading complete; resume explicitly');}
 });}
 private async readStage(session:InstrumentSession){
  const stage=await session.stageState();
  if(this.session!==session||this.dead)throw new Error('stage disclosure belongs to a released lifetime');
  this.stageReading=stage;this.stageStale=false;this.changed();return stage;
 }
 /** One invoked stage procedure through the one serial owner: the host compiles
  * it into its own admitted determinant applications and acknowledges with the
  * applied field and new influence; the ownership claims are read back from
  * stage state, never asserted locally. */
 stageEvaluate(procedure:unknown){
  return this.stageAct('stage evaluate',()=>({operation:'stage-evaluate',procedure:structuredClone(procedure)}));
 }
 /** Bind a determinant-triggered procedure to the live flow, within its evaluation budget (the host's own stage-bind). */
 stageBind(procedure:unknown,maxEvaluations?:number){
  return this.stageAct('stage bind',()=>({operation:'stage-bind',procedure:structuredClone(procedure),...(maxEvaluations!==undefined?{max_evaluations:maxEvaluations}:{})}));
 }
 /** Remove a binding; the receipt names its final standing (the host's own stage-unbind). */
 stageUnbind(procedureRef:string){
  return this.stageAct('stage unbind',()=>({operation:'stage-unbind',procedure_ref:procedureRef}));
 }
 /** Release one procedure's own slots; what it left stays as authored material (the host's own stage-retire). */
 stageRetire(procedureRef:string){
  return this.stageAct('stage retire',()=>({operation:'stage-retire',procedure_ref:procedureRef}));
 }
 /** One stage act through the one serial owner, as every determinant goes: the receipt it returns, or its refusal in the owner's words,
  * is kept as the stage's last standing. Ownership and bindings are read back from stage state, never asserted here. */
 private async stageAct(operation:string,build:()=>any):Promise<void>{
  try{await this.determinant(operation,build,false);}
  catch(error){this.stageLast={standing:'refused',why:String(error instanceof Error?error.message:error)};this.changed();throw error;}
  const receipt=this.session?.lastStageReceipt;
  this.stageLast={standing:receipt?.applied===false?'refused':'applied',...(typeof receipt?.procedure_ref==='string'?{procedure_ref:receipt.procedure_ref}:{})};
  this.changed();
 }
 /** Receiver On or Off (O-I 856; DLW manual §21.2 View and Rules), an explicit act of the owner's receiving context. While the instrument
  * follows, the owner is asked now (QL-MEF `torus-receiver`): from `place`, where the camera stands, when On, and the world's context when
  * Off. It resolves with the owner's answer (the context and the gain each voice is heard by), or rejects with its refusal in its words and
  * the choice stands as it was: a personal context the owner does not take is never shown. While no owner follows, the choice is kept,
  * nothing is asked, and it resolves null; the owner is asked once it follows (hear). */
 async setReceiver(on:boolean,place:ReceiverPlace|null=null,shared?:string):Promise<ReceiverReading|null>{
  // With `shared` (O-I #856), where you stand is shared under that reference, which the owner judges and refuses in its words; On alone is
  // the listener's own context again.
  const before=this.receiverOn,beforeShared=this.sharedAs;
  this.receiverOn=on;this.sharedAs=on&&shared!==undefined?shared:null;this.receiverRefusal=null;
  if(!on)this.wantedAt=null;else if(place)this.wantedAt=[place[0],place[1],place[2]];
  this.changed();
  if(!this.asks())return null;
  await this.hear(this.wantedAt);
  if(!samePlace(this.heardAt,this.receiverOn?this.wantedAt:null)||this.heardShared!==(this.receiverOn?this.sharedAs:null)){
   // The ask above set the refusal, if the owner refused (the narrowing from clearing it does not see that).
   const why=(this.receiverRefusal as {why:string}|null)?.why??'native owner busy: where the Torus is heard from was not set';
   this.receiverOn=before;this.sharedAs=beforeShared;this.changed();throw new Error(why);
  }
  return this.heardReply?structuredClone(this.heardReply):null;
 }
 /** Return to a receiving context where it last stood this session (O-I #856; QL-MEF `torus-receiver` `context`, #289 packet N): the
  * world's, where you stood, or the shared place. The owner is asked now and no place is sent; it resolves with the owner's answer, Receiver
  * On in the listener's own or the shared context and Off in the world's, or rejects with the owner's refusal in its words (a context never
  * entered) and the choice stands as it was. Only the owner keeps where each context last stood, so while none follows it is refused in
  * words. Until the camera moves, the owner hears from where the context last stood. */
 async returnReceiver(context:ReceivingContext):Promise<ReceiverReading>{
  const session=this.session;
  if(!session||!this.asks())throw new Error('No owner follows now, so no receiving context can be returned to: the owner keeps where each last stood.');
  const reply=await this.serial(async()=>{
   if(!(await this.waitIdle(session,1000))||!this.asks())throw new Error('native owner busy: the receiving context was not returned to');
   try{return await session.torusReceiverReturn(context) as ReceiverReading;}
   catch(error){
    if(this.current(session)){this.receiverRefusal={why:String(error instanceof Error?error.message:error),place:this.heardAt,shared:this.heardShared,at:performance.now()};this.changed();}
    throw error;
   }
  });
  if(!this.current(session))throw new Error('native operation cancelled by lifetime change');
  const at=reply.context==='shared'&&reply.at_metres?[reply.at_metres[0],reply.at_metres[1],reply.at_metres[2]] as const:null;
  this.receiverOn=reply.context!=='world';
  this.sharedAs=this.heardShared=reply.context==='shared'?reply.shared??null:null;
  if(reply.context==='world')this.wantedAt=null;else if(at)this.wantedAt=at;
  this.heardAt=reply.context==='world'?null:at??this.wantedAt;
  this.heardReply=reply;this.receiverRefusal=null;this.changed();
  return structuredClone(reply);
 }
 /** Where the camera stands now (O-I 856; null: not known this frame, and the last place stands): asked of the owner when Receiver is On
  * and it has moved. When Receiver is Off and the owner still hears from a place, the world's context is asked once; otherwise Off asks
  * nothing, wherever the camera moves. One ask at a time: moves made while one is in flight are asked once it lands, for the latest.
  * Resolves once the owner hears from where it was last asked, or at once when nothing is asked. */
 hear(place:ReceiverPlace|null):Promise<void>{
  if(place&&this.receiverOn)this.wantedAt=[place[0],place[1],place[2]];
  return this.hearing??this.sendHearing();
 }
 /** Whether the frame has anything to ask the owner about where it is heard from: Receiver is On, or the owner still hears from a place. */
 get receiving(){return this.receiverOn||this.heardAt!==null;}
 /** The presentation's units per metre the targets are drawn at, which carries the engine's eye into the owner's metres; null with no owner. */
 get unitsPerMetre(){return this.projection?.scale??null;}
 private asks(){return !!this.session&&this.scene&&this.torusRefused===null&&this.status==='following'&&!this.suspension;}
 private sendHearing():Promise<void>{
  const session=this.session,wanted=this.receiverOn?this.wantedAt:null,sharing=this.receiverOn?this.sharedAs:null,refused=this.receiverRefusal;
  if(!session||!this.asks()||(samePlace(wanted,this.heardAt)&&sharing===this.heardShared)
   ||(refused&&samePlace(wanted,refused.place)&&sharing===refused.shared&&performance.now()-refused.at<RECEIVER_RETRY_MS))return Promise.resolve();
  const asked=this.serial(async()=>{
   if(!(await this.waitIdle(session,1000))||!this.asks())return false;
   const place:ReceiverPlace|null=this.receiverOn&&this.wantedAt?[this.wantedAt[0],this.wantedAt[1],this.wantedAt[2]]:null;
   const shared=this.receiverOn?this.sharedAs:null;
   if(samePlace(place,this.heardAt)&&shared===this.heardShared)return false;
   const context=this.heardReply?.context??'world',standing=this.receiverRefusal?.why??null;
   try{
    // Shared (O-I #856): the place goes under its reference, which the owner judges; the client refuses a reference with no place in QL's words.
    const reply=await session.torusReceiver(place?[place[0],place[1],place[2]]:null,shared!==null?{shared}:undefined);
    if(!this.current(session))return false;
    this.heardAt=place;this.heardShared=shared;this.heardReply=reply;this.receiverRefusal=null;
   }catch(error){
    if(!this.current(session))return false;
    this.receiverRefusal={why:String(error instanceof Error?error.message:error),place,shared,at:performance.now()};
   }
   if((this.heardReply?.context??'world')!==context||(this.receiverRefusal?.why??null)!==standing)this.changed();
   return true;
  }).catch(()=>false);
  const hearing:Promise<void>=asked.then(landed=>{if(this.hearing===hearing)this.hearing=null;if(landed)return this.hearing??this.sendHearing();});
  this.hearing=hearing;return hearing;
 }
 private receiverReading(){
  const context=this.heardReply?.context??'world';
  return {on:this.receiverOn,context,...(context==='shared'&&this.heardShared!==null?{shared:this.heardShared}:{}),
   gains:this.heardReply?structuredClone(this.heardReply.gains):null,law:this.heardReply?.law??null,refusal:this.receiverRefusal?.why??null};
 }
 /** Human-cadence source refresh after determinant events; never while an event
  * is in flight, never while held. */
 async refreshSources(){
  const session=this.session;
  // The Torus's session rides the same human cadence, at most once a second: a cheap read, so the comma the owner gathers as the field
  // runs reaches the frame. An owner that refuses the read holds no session; it is not asked again in this lifetime.
  if(session&&this.scene&&this.torusRefused===null&&this.status==='following'&&!this.suspension&&!this.operating&&!this.serialDepth&&(this.torus===null||performance.now()-this.torusAt>=TORUS_READ_MS)){
   this.operating++;
   try{if(await this.waitIdle(session,100)&&this.status==='following')await this.readTorus(session);}
   catch(error){const why=String(error instanceof Error?error.message:error);if(!TRANSIENT.test(why)&&this.current(session))this.torusRefused=why;}
   finally{this.operating--;}
  }
  // A complete source read is large (the whole coupled basis); while a cadence
  // plays it yields to the ticks and runs at most every 5 s.
  if(session&&this.scene&&this.influenceStale&&this.status==='following'&&!this.suspension&&!this.operating&&!this.serialDepth){
   this.operating++;
   try{if(await this.waitIdle(session,100)&&this.status==='following'){await this.readInfluence(session);
    // A displayed stage disclosure rides the same human cadence after the
    // determinants that move its constituents; a cheap read, never a beat.
    if(this.stageStale&&this.stageReading)await this.readStage(session);this.changed();}}
   catch{}finally{this.operating--;}
  }
  if(!session||!this.scene||!this.sourcesStale||this.status!=='following'||this.suspension||this.operating||this.serialDepth||performance.now()-this.lastInspect<(this.cadence?5000:1500))return false;
  this.operating++;
  try{if(!(await this.waitIdle(session,100))||this.status!=='following')return false;await this.readSources(session);this.changed();return true;}
  catch{return false;}
  finally{this.operating--;}
 }
 /** Explicit cadence: serial m1-advance requests at a source-cited rate. A beat
  * is skipped while the owner is busy, suspended while held/hidden/unavailable,
  * and the cadence stops on release or refusal. */
 play(ticksPerSecond:number){
  if(!this.scene||!this.session)throw new Error('Open the live instrument first');
  if(!(Number.isFinite(ticksPerSecond)&&ticksPerSecond>0&&ticksPerSecond<=12))throw new Error('cadence must be within (0, 12] ticks per second');
  this.pause('rate changed');
  const period=1000/ticksPerSecond;
  const cadence:Cadence={rate:ticksPerSecond,period,source:CADENCES.find(c=>c.ticks_per_second===ticksPerSecond)?.source??'explicit rate',
   timer:setInterval(()=>{void this.beat(cadence);},period),started:performance.now(),beats:0,issued:0,applied:0,skipped:0,suspended:0,inFlight:false};
  this.cadence=cadence;this.changed();
 }
 pause(reason='held'){
  const cadence=this.cadence;if(!cadence)return;
  // The same record: a beat already in flight still counts when it lands.
  clearInterval(cadence.timer);this.cadence=null;cadence.stopped=reason;cadence.stopped_at=performance.now();this.lastCadence=cadence;this.changed();
 }
 private async beat(cadence:Cadence){
  if(this.cadence!==cadence)return;
  cadence.beats++;
  if(!this.session||this.status!=='following'||this.suspension||this.dead){cadence.suspended++;return;}
  if(cadence.inFlight||this.operating||this.serialDepth){cadence.skipped++;return;}
  cadence.inFlight=true;
  try{
   cadence.issued++;
   const t0=performance.now();
   await this.determinant('M1 advance (cadence)',()=>({operation:'m1-advance',ticks:1}),false,true);
   cadence.lastEventMs=performance.now()-t0;cadence.maxEventMs=Math.max(cadence.maxEventMs??0,cadence.lastEventMs);
   cadence.applied++;if(this.cadence!==cadence)this.changed();
  }catch(error){
   cadence.issued--;
   if(TRANSIENT.test(String(error)))cadence.skipped++;
   else if(this.cadence===cadence)this.pause(`refused: ${String(error instanceof Error?error.message:error)}`);
  }finally{cadence.inFlight=false;}
 }
 inspectSources(){return this.serial(async()=>{
  this.hold('native source inspection');const session=await this.idle();
  try{await session.recover('native source inspection');return await this.readSources(session);}
  finally{if(this.current(session))this.hold('source inspection complete; resume explicitly');}
 });}
 editBasis(edit:NativeBasisEdit){return this.serial(async()=>{
  const following=this.status==='following';this.hold('native basis edit');const revision=this.holdRevision;
  const session=await this.idle();
  try{
   await session.recover('native basis edit admission');await this.readSources(session);
   const basis=editNativeBasis(this.sources,edit);
   await session.recover('complete basis inspected; native edit admission');
   const result=await session.operate({operation:'replace',basis});await this.readSources(session);
   await session.recover('native basis readback admitted; rebase device only');
   this.finishCommand(session,following,revision,'native basis applied while held; resume explicitly');return result;
  }catch(error){if(this.current(session))this.hold(String(error));throw error;}
 });}
 setScale(scale:number){if(!this.projection)throw new Error('native presentation unavailable');this.projection.setScale(scale);this.changed();}
 followDomain(){this.setScale(this.opened?.presentation.units_per_metre);}
 setMuted(muted:boolean){if(!this.session)throw new Error('native audio unavailable');this.session.setMuted(muted);this.muted=muted;this.changed();}
 /** The Torus heard in the desktop's one engine, or in this frame again (the `torus-engine` stage command; O-I #849). On: through the one
  * serial owner, the owner hands the Torus over (`torus-native`; the kernel keeps it under the lease and relays its digest) and this frame's
  * own sound of it is shut, so the part sounds once, through the engine; the answer is what the engine takes it by. The frame shuts when it
  * plays the sample the Torus was handed over at, and the answer names when that is heard (round 13: the engine takes it then, so the part
  * sounds on from where the frame stops). While on, whatever moves the owner's Torus but an act the engine follows has it handed over again.
  * Off: the frame sounds it again at once; nothing is asked of the owner. */
 torusEngine(on:boolean):Promise<StageTorusEngine|null>{
  if(!on){
   const was=this.engine.on;this.engine={on:false,stale:false,handed:null,refusal:null,again:false};this.frameUntil=null;this.gateFrame();
   if(was)this.changed();return Promise.resolve(null);
  }
  const session=this.session;
  if(!session||!this.scene)return Promise.reject(new Error('Open the live instrument first: its scene owner hands the Torus over'));
  if(this.status!=='following'||this.suspension)return Promise.reject(new Error('The field is not running: resume it, then play'));
  return this.serial(async()=>{
   const was=this.engine.on,{handed,until}=await this.handOver(session);this.engine.on=true;
   // a hand-over while the engine already sounds it leaves the frame's gate as it stands
   if(!was){this.frameUntil=until;this.gateFrame(until);}
   this.changed();return handed;
  });
 }
 /** The owner hands the Torus over, in the serial owner's turn: what the engine takes it by, read exactly, with the context time this frame
  * plays the sample it was handed over at (null while it names none); or the refusal in words. */
 private async handOver(session:InstrumentSession):Promise<{handed:StageTorusEngine;until:number|null}>{
  if(!(await this.waitIdle(session,2000)))throw new Error('native owner busy; the Torus was not handed over');
  const lease=this.opened?.lease;
  if(!this.current(session)||typeof lease!=='string')throw new Error('the Torus belongs to a released lifetime');
  let digest:any;
  try{digest=await session.torusNative();}
  catch(error){this.engine.refusal=error instanceof Error?error.message:String(error);this.changed();throw error;}
  const read=readStageTorusEngine({lease,sha256:digest?.sha256,generation:digest?.generation,at_samples_elapsed:digest?.at_samples_elapsed});
  if(!read)throw new Error('The kernel relayed the Torus handed over without the digest the engine takes it by');
  const plays=this.playsAt(session,BigInt(read.at_samples_elapsed)),handed=plays?{...read,heard_at_ms:plays.heard_at_ms}:read;
  this.engine.handed=handed;this.engine.stale=false;this.engine.refusal=null;return {handed,until:plays?.context_seconds??null};
 }
 /** When this frame plays the owner's sample `s` (round 13): the context time its receiver schedules it for (native-audio.mjs, within its
  * device epoch: context_origin_seconds + (s − native_origin)/rate), and when that is heard, in the machine's wall clock (ms since the Unix
  * epoch), through the context's output timestamp when it gives one, else its output latency. Null while the receiver names no epoch. */
 private playsAt(session:InstrumentSession,s:bigint):{context_seconds:number;heard_at_ms:number}|null{
  const context=this.context,audio=session.reading?.audio;
  if(!context||!audio||!Number.isFinite(audio.context_origin_seconds)||!Number.isInteger(audio.device_sample_rate)||!/^(0|[1-9][0-9]*)$/.test(audio.native_origin??''))return null;
  const at=audio.context_origin_seconds+Number(s-BigInt(audio.native_origin))/audio.device_sample_rate;
  const stamp=typeof context.getOutputTimestamp==='function'?context.getOutputTimestamp():null;
  const fromNow=stamp&&Number.isFinite(stamp.contextTime)&&Number.isFinite(stamp.performanceTime)&&(stamp.performanceTime as number)>0
   ?(at-(stamp.contextTime as number))*1000-(performance.now()-(stamp.performanceTime as number))
   :(at-context.currentTime+(context.outputLatency||context.baseLatency||0))*1000;
  const heard_at_ms=Date.now()+fromNow;
  return Number.isFinite(at)&&Number.isFinite(heard_at_ms)&&heard_at_ms>0?{context_seconds:at,heard_at_ms}:null;
 }
 /** Something moved the owner's Torus while the engine sounds it: it is handed over again in the serial owner's next turn (once, however
  * many moved it before that turn). A refusal (a setting still waiting for its sample) stands in the reading, and the move that lands it
  * asks again. */
 private engineMoved(){
  this.engine.stale=true;const session=this.session;
  if(!session||this.engine.again)return;
  this.engine.again=true;this.changed();
  void this.serial(async()=>{this.engine.again=false;if(this.engine.on&&this.engine.stale)await this.handOver(session);})
   .then(()=>this.changed(),()=>{this.engine.again=false;this.changed();});
 }
 /** The frame's own sound of the Torus: shut while the engine sounds it — from `until`, the context time it plays the sample the Torus was
  * handed over at (round 13), when it was sounding it; else at once — and open again at once. */
 private gateFrame(until:number|null=null){
  const gain=this.gate?.gain;if(!gain)return;
  gain.cancelScheduledValues?.(0);
  if(this.engine.on&&until!==null&&typeof gain.setValueAtTime==='function')gain.setValueAtTime(0,until);
  else gain.value=this.engine.on?0:1;
 }
 /** The node the symbols' voices listen to, with the audio context it stands in; null while no instrument is open. Two audio contexts cannot
  * share a node, so a voice built on this is built in this context. */
 voiceTap():{context:AudioContext;input:GainNode}|null{return this.tap&&this.context?{context:this.context,input:this.tap}:null;}
 /** Presentation level only; the native PCM and its receiver gain are unchanged. */
 setLevel(value:number){
  if(!Number.isFinite(value)||value<PRESENTATION_LEVEL.min||value>PRESENTATION_LEVEL.max)throw new Error(`level must be within ${PRESENTATION_LEVEL.min}–${PRESENTATION_LEVEL.max}`);
  this.levelValue=value;const gain=this.level?.gain,context=this.context;
  if(gain&&context&&typeof gain.setTargetAtTime==='function')gain.setTargetAtTime(value,context.currentTime,.02);else if(gain)gain.value=value;
  this.changed();
 }
 /** One parameter of one of the torus's effects (effectsLaw.ts): refused in the owner's words outside its law. Presentation only; the
  * native PCM, its clock and the receiver's gain are unchanged. Taken while no instrument is open too: it sounds when one opens. */
 setEffect(effect:PresentationEffect,key:string,value:EffectValue){
  this.effects=editEffects(this.effects,effect,key,value);this.effectsGraph?.apply(this.effects);this.changed();
 }
 /** Which of the torus's effects stand after the level and in what order (the sound passes them left to right); refused in words for
  * an unknown or repeated effect. */
 setEffectChain(chain:readonly PresentationEffect[]){
  this.effects=editEffectChain(this.effects,chain);this.effectsGraph?.apply(this.effects);this.changed();
 }
 saveCheckpoint(){return this.serial(async()=>{
  this.hold('checkpoint hold');const session=await this.idle();await session.recover('checkpoint current cursor');this.hold('checkpoint hold');
  if(!this.current(session))throw new Error('checkpoint belongs to a released lifetime');
  this.checkpoint=this.renderer.checkpointRetainedField(this.projection);this.changed();return {schema:this.checkpoint.schema,receipt:this.checkpoint.receipt,width:this.checkpoint.width,height:this.checkpoint.height};
 });}
 restoreCheckpoint(){return this.serial(async()=>{
  if(!this.checkpoint||this.contextLost)throw new Error('same-live-state checkpoint or restored GPU unavailable');
  const session=await this.idle();if(!this.current(session))throw new Error('checkpoint belongs to a released lifetime');this.renderer.restoreRetainedField(this.projection,this.checkpoint);this.reason='checkpoint restored; resume explicitly';this.status='held';this.changed();
 });}
 inspectTargets(){return this.projection?.inspect()??null;}
 async release(manual=true){
  this.pause('released');
  const epoch=++this.epoch;const session=this.session;this.lastNative=session?.reading??this.lastNative;
  this.session=null;session?.dispose();this.recovery?.();this.recovery=null;
  this.renderer.releaseRetainedField();this.renderer.setNativeDomain(false);this.projection?.dispose();this.projection=null;
  const context=this.context;this.context=null;const opened=this.opened;this.opened=null;this.checkpoint=null;this.contextLost=false;
  this.sources=null;this.domain=null;this.openingHold=null;
  this.scene=false;this.influenceReading=null;this.acting=null;this.event=null;this.opening=null;this.sourcesStale=false;this.fundamentalAt=null;this.level=null;this.tap=null;this.effectsGraph?.dispose();this.effectsGraph=null;
  // The engine keeps sounding what was handed over; this owner hands nothing over again, and a new one sounds here until asked.
  this.gate=null;this.engine={on:false,stale:false,handed:null,refusal:null,again:false};
  this.stageReading=null;this.stageStale=false;this.stageLast=null;
  this.torus=null;this.torusAt=0;this.torusRefused=null;this.torusObject=new TorusObject();this.torusObject.setView(this.view);this.pulseTuning=null;
  // A new owner hears in the world's context until it is asked; Receiver itself is the person's and stays (O-I 856).
  this.wantedAt=null;this.heardAt=null;this.heardShared=null;this.heardReply=null;this.receiverRefusal=null;this.hearing=null;
  this.admitting=null;this.suspension=null;this.restoring=null;
  if(manual){this.status='manual';this.lastNative=null;this.reason=null;this.refusal=null;this.lastCadence=null;this.changed();}
  const close=async()=>{
   const results=await Promise.allSettled([context&&context.state!=='closed'?context.close():Promise.resolve(),this.closeOwner(opened)]);
   const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');
   if(failure&&epoch===this.epoch){this.reason=`native release acknowledgement unknown: ${String(failure.reason)}`;this.changed();}
  };
  const closing=close();this.closing=closing;
  try{await closing;}finally{if(this.closing===closing)this.closing=null;}
 }

 async dispose(){if(this.dead)return;this.dead=true;await this.release();this.port.dispose();}
}
