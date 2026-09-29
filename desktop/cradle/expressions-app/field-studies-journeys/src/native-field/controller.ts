import {projectNativeSources,editNativeBasis,NativeDomainReading,NativeBasisEdit} from './domain';
import {InstrumentSession} from './ql/instrument-session.mjs';
import {NativeProjection} from './projection';
import type {NativePort} from './channel';
import {applyPhysicalFormPose} from '../physicalFormActuator';
import {nativeActuatorStanding} from '../nativeActuatorStanding';
import {isScene,eventFromSources,readScene,editSceneEvent,sceneCausalTrace,type SceneActing,type SceneEdit} from './scene';
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
const TRANSIENT=/owner busy|held before the event|presentation capacity|requires idle admitted owner/;
type Cadence={rate:number;period:number;source:string;timer:ReturnType<typeof setInterval>;started:number;
 beats:number;issued:number;applied:number;skipped:number;suspended:number;inFlight:boolean;lastEventMs?:number;maxEventMs?:number;stopped?:string;stopped_at?:number};
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
 private event:any=null;private opening:any=null;private sourcesStale=false;private influenceStale=false;private timing:any=null;private timingStart=0;private lastInspect=0;
 private operating=0;private cadence:Cadence|null=null;private lastCadence:Cadence|null=null;
 private refusal:{operation:string;reason:string;at:number}|null=null;
 private level:GainNode|null=null;private levelValue:number=PRESENTATION_LEVEL.initial;
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
  if(this.scene){this.event=eventFromSources(sources);this.acting=readScene(sources,this.influenceReading,this.opened?.source);}
  this.sourcesStale=false;this.lastInspect=performance.now();
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
  native:this.session?.reading??this.lastNative,muted:this.muted,
  domain:this.domain,source_currentness:this.domain?(this.sourcesStale?'inspected before the latest determinant event; influence is current':following?'inspected-native-basis; continuous cursor reported separately':'held-last-inspected-basis'):'unavailable',
  presented_clock:clock,
  instrument:this.scene?{schema:'oi.scene-instrument-reading/v1',acting:this.acting,influence:this.influenceReading,influence_stale:this.influenceStale,
   opening_event_available:!!this.opening,sources_stale:this.sourcesStale,cadence:this.cadenceReading(),refusal:this.refusal,
   presentation:INSTRUMENT_PRESENTATION}:null,
  checkpoint:this.checkpoint?{supported:true,scope:'same live GPU and unchanged native cursor',receipt:this.checkpoint.receipt}:null,
  exact_seek:false,restart:'explicit new native process; no implicit rewind',
  domain_owned:['M1/M2/M3 native targets','native PCM','native clock'],
  presentation_owned:['resident particle mechanics','camera','presentation scale','presentation level'],
  presentation_changes_requiring_rebind:['scene membership','target topology or density','authored scene configuration while leased'],
  unavailable_consumers:unavailable,
  causal_trace:trace,
  physical_form_actuator,
  actuator_standing:nativeActuatorStanding({status:this.status,domain:this.domain as any,instrument:this.scene?{voices:this.acting?.voices??null}:null}),
 } as const;}
 private changed(){this.onChange();}
 /** The instrument's primary opening: QL composes a scene binding (`ql scene binding`) for this stage's
  * own retained texture; the kernel supplies the dated sky. No path, no file. */
 async compose(options:{sky?:NativeSky;event?:unknown}={}){
  const topology=this.renderer.retainedTopology?.();
  if(!topology)throw new Error('The retained GPU field must be live before the instrument opens');
  const sky=options.sky??'now';
  if(!(sky==='none'||sky==='now'||(typeof sky==='object'&&typeof sky?.epoch==='string')))throw new Error('sky must be none, now or a dated epoch');
  const request={texture:[topology.tex_width,topology.tex_height],units_per_metre:INSTRUMENT_PRESENTATION.units_per_metre,sky,...(options.event!==undefined?{event:options.event}:{})};
  return this.admit(SCENE_SAMPLE_RATE,()=>this.port.request({operation:'compose',request}));
 }
 /** Inspect depth: an explicit Central binding document. */
 async connect(path:string,revision:string,sampleRate:number){
  return this.admit(sampleRate,()=>this.port.request({operation:'open',path,expected_revision:revision}));
 }
 private stage(context:AudioContext){
  // One presentation gain stage between the native receiver and the device.
  // The receiver keeps its own gain and clip law; nothing is synthesised here.
  const level=context.createGain();level.gain.value=this.levelValue;level.connect(context.destination);this.level=level;
  return new Proxy(context,{get:(target,key)=>{if(key==='destination')return level;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}) as AudioContext;
 }
 private async admit(sampleRate:number,open:()=>Promise<any>){
  if(this.dead||this.status==='opening'||this.session||this.closing||this.suspension)throw new Error('release the current native owner and instrument suspension before opening another');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('native binding must supply its actual sample rate');
  const epoch=++this.epoch;this.admitting=epoch;this.status='opening';this.reason=null;this.openingHold=null;this.lastNative=null;this.refusal=null;this.changed();
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
   this.renderer.setNativeDomain(true);
   this.session=new InstrumentSession({...this.playback,context:this.stage(context),owner:this.renderer,initialReceipt:opened.receipt,
    transport:{request:(request:any)=>this.port.request({operation:'exchange',lease:opened.lease,request}),close:()=>{void this.closeOwner(opened).catch(()=>{});}},fieldBinding:this.projection,muted:true});
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
 /** A refused determinant leaves the owner and its standing unchanged. */
 private refused(operation:string,error:unknown,session:InstrumentSession){
  if(!this.current(session)||!session.reading.available)return false;
  this.refusal={operation,reason:String(error instanceof Error?error.message:error),at:Date.now()};this.changed();return true;
 }
 /** A scene determinant event through the one serial owner. While following, the
  * re-read targets queue behind already scheduled sound (no hold, no rebase);
  * while held, the event commits and the owner stays held. */
 private determinant(operation:string,build:()=>any,needsEvent:boolean,cadence=false):Promise<void>{
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
     await session.operate(command);
     this.timing={fill_ms:sent-this.timingStart,operate_ms:performance.now()-sent};
     if(!this.current(session))return;
     // The owner acknowledged: the event happened. A busy follow-up read only
     // leaves the influence stale for the next refresh; it never un-counts it.
     this.checkpoint=null;this.sourcesStale=true;this.influenceStale=true;this.refusal=null;
     // The acknowledgement carried the new influence; take it without a
     // second exchange (the audio pump must not wait on another read).
     const carried=session.lastInfluence;
     if(carried&&carried.generation===session.reading.acknowledged?.generation)this.admitInfluence(carried);
     this.changed();
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
    await held.operate(build());
    this.refusal=null;
    await this.readSources(held);await this.readInfluence(held);
    await held.recover('native determinant readback admitted; rebase device only');
    this.reason=following?null:prior;
    this.finishCommand(held,following,revision,'determinant applied while held; resume explicitly');
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
 /** Human-cadence source refresh after determinant events; never while an event
  * is in flight, never while held. */
 async refreshSources(){
  const session=this.session;
  // A complete source read is large (the whole coupled basis); while a cadence
  // plays it yields to the ticks and runs at most every 5 s.
  if(session&&this.scene&&this.influenceStale&&this.status==='following'&&!this.suspension&&!this.operating&&!this.serialDepth){
   this.operating++;
   try{if(await this.waitIdle(session,100)&&this.status==='following'){await this.readInfluence(session);this.changed();}}
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
 /** Presentation level only; the native PCM and its receiver gain are unchanged. */
 setLevel(value:number){
  if(!Number.isFinite(value)||value<PRESENTATION_LEVEL.min||value>PRESENTATION_LEVEL.max)throw new Error(`level must be within ${PRESENTATION_LEVEL.min}–${PRESENTATION_LEVEL.max}`);
  this.levelValue=value;const gain=this.level?.gain,context=this.context;
  if(gain&&context&&typeof gain.setTargetAtTime==='function')gain.setTargetAtTime(value,context.currentTime,.02);else if(gain)gain.value=value;
  this.changed();
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
  this.scene=false;this.influenceReading=null;this.acting=null;this.event=null;this.opening=null;this.sourcesStale=false;this.level=null;
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
