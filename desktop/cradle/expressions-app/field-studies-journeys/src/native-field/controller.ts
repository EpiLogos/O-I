import {InstrumentSession} from './ql/instrument-session.mjs';
import {NativeProjection} from './projection';
import type {NativePort} from './channel';
export interface NativeRenderer {
 retainedTargetPort():any;releaseRetainedField():void;
 onRetainedRecoveryRequired(listener:(state:'lost'|'restored')=>void):()=>void;
 checkpointRetainedField(binding:any):any;restoreRetainedField(binding:any,checkpoint:any):void;
 setNativeDomain(active:boolean):void;
}
export type NativeStatus='manual'|'opening'|'following'|'held'|'unavailable';
/** The QL driver schedules PCM/targets; the app remains the sole GPU stage.
 * The controller owns admission/lifetime only, never native math or a second clock.
 */
export class NativeFieldController {
 private session:InstrumentSession|null=null;private projection:NativeProjection|null=null;
 private context:AudioContext|null=null;private opened:any=null;private epoch=0;private dead=false;
 private recovery:(()=>void)|null=null;private checkpoint:any=null;private contextLost=false;
 private pending:Promise<unknown>=Promise.resolve();private muted=true;
 status:NativeStatus='manual';reason:string|null=null;
 onChange:()=>void=()=>{};
 constructor(private port:NativePort,private renderer:NativeRenderer,
  private audio:(rate:number)=>AudioContext=rate=>new AudioContext({sampleRate:rate})){
  port.onHold=reason=>{this.hold(reason);};
 }
 get reading(){return{schema:'oi.native-expression-reading/v1',status:this.status,reason:this.reason,
  source:this.opened?.source??null,lease:this.opened?.lease??null,
  presentation_mode:!this.projection?'manual':this.projection.scale===this.opened.presentation.units_per_metre?'domain-follow':'manual-presentation-override',
  presentation_units_per_metre:this.projection?.scale??null,
  native:this.session?.reading??null,muted:this.muted,
  checkpoint:this.checkpoint?{supported:true,scope:'same live GPU and unchanged native cursor',receipt:this.checkpoint.receipt}:null,
  exact_seek:false,restart:'explicit new native process; no implicit rewind',
  domain_owned:['M1/M2/M3 native targets','native PCM','native clock'],
  presentation_owned:['particle mechanics','camera','density','palette','presentation scale'],
  unavailable_consumers:['M3 transcription/glyph source not supplied by compact field transport','native material constitutive controls beyond the exposed modal owner'],
 } as const;}
 private changed(){this.onChange();}
 async connect(path:string,revision:string,sampleRate:number){
  if(this.dead||this.status==='opening'||this.session)throw new Error('release the current native owner before opening another');
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new Error('native binding must supply its actual sample rate');
  const epoch=++this.epoch;this.status='opening';this.reason=null;this.changed();
  try{
   // This is invoked directly by the Connect button; no microphone and no
   // autoplay on mode entry. A failed audio device prevents opening native work.
   const context=this.audio(sampleRate);this.context=context;await context.resume();
   if(epoch!==this.epoch||this.dead)return;
   if(context.sampleRate!==sampleRate||context.state!=='running')throw new Error('audio device/native rate or activation mismatch');
   const opened=await this.port.request({operation:'open',path,expected_revision:revision});
   if(epoch!==this.epoch||this.dead){await this.port.request({operation:'close',lease:opened.lease});return;}
   this.opened=opened;
   if(opened.schema!=='oi.native-expression-open/v1'||opened.receipt?.field?.sample_rate!==sampleRate)throw new Error('native open receipt/sample rate mismatch');
   const stage=this.renderer.retainedTargetPort();
   this.projection=new NativeProjection(stage,opened.receipt.field,opened.presentation);
   this.renderer.setNativeDomain(true);
   this.session=new InstrumentSession({context:this.context,owner:this.renderer,initialReceipt:opened.receipt,
    transport:{request:(request:any)=>this.port.request({operation:'exchange',lease:opened.lease,request}),close:()=>{}},fieldBinding:this.projection,muted:true});
   this.recovery=this.renderer.onRetainedRecoveryRequired(state=>{this.contextLost=state==='lost';this.hold(`GPU context ${state}; explicit same-state checkpoint recovery or disconnect required`);});
   this.status='following';this.session.start();this.changed();
  }catch(error){await this.release(false);this.status='unavailable';this.reason=String(error);this.changed();throw error;}
 }
 /** Called by the actual app frame. A hidden/paused app cannot leave audio running. */
 frame(delta:number,paused:boolean){
  if(paused&&this.session&&this.status==='following')this.hold('application paused or hidden');
  if(this.session){
   const reading=this.session.reading;
   if(!reading.available||reading.held){if(this.status==='following'){this.status=reading.available?'held':'unavailable';this.reason=reading.reason??'native/audio owner held';this.changed();}}
   if(this.status==='following'){try{this.session.present();}catch(error){this.hold(String(error));}}
  }
  return this.status==='manual'?delta:this.status==='following'?delta:0;
 }
 hold(reason='manual hold'){
  if(!this.session)return;
  this.session.hold(reason);this.status='held';this.reason=reason;this.changed();
 }
 private async idle(){const session=this.session;if(!session)throw new Error('native owner unavailable');
  const deadline=performance.now()+6500;while(session.reading.in_flight){if(performance.now()>deadline)throw new Error('native operation still in flight; not retried');await new Promise(r=>setTimeout(r,8));}
  return session;
 }
 private serial<T>(action:()=>Promise<T>):Promise<T>{
  const epoch=this.epoch;
  const result=this.pending.then(async()=>{if(epoch!==this.epoch||this.dead)throw new Error('native operation cancelled by lifetime change');return action();});
  this.pending=result.catch(()=>{});return result;
 }
 resume(){return this.serial(async()=>{
  if(this.contextLost)throw new Error('GPU context is unavailable');
  await this.context?.resume();const session=await this.idle();
  if(this.reason?.startsWith('GPU context'))throw new Error('restore a same-state GPU checkpoint before resuming, or disconnect');
  await session.recover('explicit native resume');this.checkpoint=null;this.status='following';this.reason=null;session.start();this.changed();
 });}
 operate(command:unknown){return this.serial(async()=>{
  this.hold('native operation');const session=await this.idle();
  try{await session.recover('native operation admission');const result=await session.operate(command);this.checkpoint=null;this.status='following';this.reason=null;session.start();this.changed();return result;}
  catch(error){this.hold(String(error));throw error;}
 });}
 inspectSources(){return this.serial(async()=>{
  this.hold('native source inspection');const session=await this.idle();
  try{await session.recover('native source inspection');return await session.inspect();}
  finally{this.hold('source inspection complete; resume explicitly');}
 });}
 setScale(scale:number){if(!this.projection)throw new Error('native presentation unavailable');this.projection.setScale(scale);this.changed();}
 followDomain(){this.setScale(this.opened?.presentation.units_per_metre);}
 setMuted(muted:boolean){if(!this.session)throw new Error('native audio unavailable');this.session.setMuted(muted);this.muted=muted;this.changed();}
 saveCheckpoint(){return this.serial(async()=>{
  this.hold('checkpoint hold');const session=await this.idle();await session.recover('checkpoint current cursor');this.hold('checkpoint hold');
  this.checkpoint=this.renderer.checkpointRetainedField(this.projection);this.changed();return {schema:this.checkpoint.schema,receipt:this.checkpoint.receipt,width:this.checkpoint.width,height:this.checkpoint.height};
 });}
 restoreCheckpoint(){return this.serial(async()=>{
  if(!this.checkpoint||this.contextLost)throw new Error('same-live-state checkpoint or restored GPU unavailable');
  await this.idle();this.renderer.restoreRetainedField(this.projection,this.checkpoint);this.reason='checkpoint restored; resume explicitly';this.status='held';this.changed();
 });}
 inspectTargets(){return this.projection?.inspect()??null;}
 async release(manual=true){
  ++this.epoch;this.session?.dispose();this.session=null;this.recovery?.();this.recovery=null;
  this.renderer.releaseRetainedField();this.renderer.setNativeDomain(false);this.projection?.dispose();this.projection=null;
  const context=this.context;this.context=null;const opened=this.opened;this.opened=null;this.checkpoint=null;this.contextLost=false;
  if(context&&context.state!=='closed')await context.close();
  if(opened)try{await this.port.request({operation:'close',lease:opened.lease});}catch(error){this.reason=`native release acknowledgement unknown: ${String(error)}`;}
  if(manual){this.status='manual';this.changed();}
 }
 async dispose(){if(this.dead)return;this.dead=true;await this.release();this.port.dispose();}
}
