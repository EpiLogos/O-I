import {counter,readReply,readPerformance,inspectAdmittedReadingImmutability,type NativePerformanceCommand,type NativePerformanceExchange,type NativePerformanceReading,type NativePerformanceReply,type NativeTransportAcknowledgement} from './protocol.js';
class NativeRefusalError extends Error {}
export interface PerformanceClientState {reading:NativePerformanceReading|null;reason:string|null;pending:number;pressed:ReadonlySet<string>}
/** One client of the existing serial owner. Only copied readbacks and bounded
 * input lifetimes live here. Lost/unknown acknowledgements are never retried. */
export class NativePerformanceClient {
 private reading:NativePerformanceReading|null=null;
 private reason:string|null=null;private pending=0;private dead=false;private input=0;
 private held=new Map<string,{cell:string;admitted:boolean}>();
 private pressurePending=new Map<string,{value:number;running:boolean}>();
 private parameterPending=new Map<string,{value:number;done:Promise<NativePerformanceReply>}>();
 private unsubscribe:()=>void;
 private lastTransport:NativeTransportAcknowledgement|null=null;
 private transportBaseline:NativePerformanceReading|null=null;private observedTransportBoundary:string|null=null;
 private listeners=new Set<()=>void>();
 constructor(private owner:NativePerformanceExchange){this.unsubscribe=owner.subscribe(update=>{
  if(this.dead)return;
  try{
   // The actual original Start may acknowledge an epoch before the first source
   // callback. Preserve its exact ACK internally, without displaying old P as
   // current or granting input while the owner's currentness remains false.
   const original=owner.transportObservation?.();
   if(original){
    counter(original.request_id);if(typeof original.lease!=='string'||!original.lease)throw Error('The original transport observation has no owned native lease.');
    const key=original.lease+'@'+original.request_id;
    if(key!==this.observedTransportBoundary){this.transportBaseline=readPerformance(original.reading,this.transportBaseline??this.reading??undefined,original.transport_transition);this.observedTransportBoundary=key;if(original.transport_transition)this.lastTransport=original.transport_transition;}
   }
   if(!owner.current){this.reason='The current native sound and body source is pending or held.';this.changed();return;}
   if(update.schema!=='ql.performance-management-update/v1')throw Error('Native performance readback stream schema differs.');
   const ack=update.transport_transition,duplicate=ack&&this.lastTransport&&JSON.stringify(ack)===JSON.stringify(this.lastTransport);
   this.reading=readPerformance(update.reading,this.transportBaseline??this.reading??undefined,duplicate?null:ack);this.transportBaseline=null;if(ack)this.lastTransport=ack;
   this.reason=this.reading.reason;this.changed();
  }catch(error){this.reason=error instanceof Error?error.message:String(error);owner.holdPerformance(this.reason);this.changed();}
 });}

 get state():PerformanceClientState{return{reading:this.reading,reason:this.reason,pending:this.pending,pressed:new Set([...this.held.values()].map(v=>v.cell))};}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
 private changed(){for(const listener of this.listeners)listener();}
 private async request(command:NativePerformanceCommand):Promise<NativePerformanceReply>{
  const originalPending=command.operation==='performance-panic'&&!this.owner.current?this.owner.transportObservation?.():null;
  if(this.dead||!this.owner.current&&(!originalPending||!this.transportBaseline))throw Error('The retained native performance lifetime is unavailable.');
  const critical=command.operation==='performance-panic'||command.operation==='performance-gesture'&&command.phase==='release'||command.operation==='performance-sustain'&&!command.down;
  if(this.pending>=(critical?192:64)){this.owner.holdPerformance('Native performance request admission bound exceeded.');throw Error('The bounded native request lane is full; input is held.');}
  const atSubmission=originalPending?this.transportBaseline:this.reading;
  this.pending++;this.changed();
  try{const reply=readReply(await this.owner.exchange(command),command,atSubmission??undefined);
   if(this.dead)throw Error('The native lifetime closed before acknowledgement.');
   if(!this.owner.current){
    const retained=this.owner.transportObservation?.();
    if(!originalPending||!retained||retained.lease!==originalPending.lease||retained.request_id!==originalPending.request_id)throw Error('The original pending native lifetime closed before protective acknowledgement.');
    // Genuine Panic acknowledged on the same pending owner; retain transport
    // history without displaying this observation as a current body.
    this.transportBaseline=reply.reading;this.reason=reply.accepted?'The original native programme still awaits its first current body callback.':reply.refusal!.reason;
    if(!reply.accepted)throw new NativeRefusalError(this.reason??'Native protective operation refused.');return reply;
   }const current=this.reading,next=reply.reading;if(!current||next.transport_epoch===current.transport_epoch&&BigInt(next.samples_elapsed)>=BigInt(current.samples_elapsed)&&BigInt(next.accepted_sequence)>=BigInt(current.accepted_sequence)||BigInt(next.transport_epoch)>BigInt(current.transport_epoch))this.reading=readPerformance(next,current??undefined,current?.transport_epoch===next.transport_epoch?null:reply.transport_transition);if(reply.transport_transition&&this.reading?.transport_epoch===next.transport_epoch)this.lastTransport=reply.transport_transition;this.reason=reply.accepted?this.reading?.reason??null:reply.refusal!.reason;if(!reply.accepted)throw new NativeRefusalError(this.reason??'Native operation refused.');return reply;}
  catch(error){this.reason=error instanceof Error?error.message:String(error);if(critical||!(error instanceof NativeRefusalError))this.owner.holdPerformance(this.reason);throw error;}
  finally{this.pending--;this.changed();}
 }
 verify_admitted_reading_immutability(){if(!this.reading)throw Error('No actual native reading has been admitted.');return inspectAdmittedReadingImmutability(this.reading);}
 async inspect(){return this.request({operation:'performance-inspect'});}
 supports(operation:NativePerformanceCommand['operation']){return!!this.reading?.available&&this.reading.capabilities.includes(operation)&&this.owner.supports(operation)&&this.owner.current&&!this.dead;}
 private require(operation:NativePerformanceCommand['operation']){if(!this.supports(operation))throw Error(this.reading?.reason??this.reason??'This operation is unavailable from the retained native owner.');}
 press(row:number,column:number,velocity=1):{input_ref:string;acknowledged:Promise<NativePerformanceReply>}{
  this.require('performance-gesture');if(this.reading?.device.state!=='running')throw Error('Start the admitted native audio output before playing.');if(this.held.size>=96)throw Error('The native instrument supports at most 96 independent touches.');
  const selected=this.reading?.keys.find(k=>k.row===row&&k.column===column);if(!Number.isFinite(velocity)||velocity<0||velocity>1||!selected)throw Error('Choose a current native key and bounded velocity.');if(!selected.available)throw Error(selected.reason??'This source has no pitch at the selected native address.');
  if(this.input>=Number.MAX_SAFE_INTEGER)throw Error('The input lifetime is exhausted; reopen the retained native view.');
  const input_ref=`input:${this.reading.session_ref}:${++this.input}`,cell=`${row}:${column}`;
  this.held.set(input_ref,{cell,admitted:false});this.changed();
  const acknowledged=this.request({operation:'performance-gesture',phase:'press',input_ref,row,column,velocity}).then(reply=>{if(reply.admission?.input_ref!==input_ref||!reply.admission.touch_ref||reply.admission.clock!=='native-output')throw Error('The native attack omitted its exact touch or output-clock admission.');const held=this.held.get(input_ref);if(held)held.admitted=true;return reply;}).catch(error=>{this.reason=error instanceof Error?error.message:String(error);if(!(error instanceof NativeRefusalError))this.owner.holdPerformance(this.reason);this.changed();throw error;});
  return{input_ref,acknowledged};
 }
 /** Release may be sent while the press acknowledgement is pending. The
  * native owner serializes both and retains the input→touch identity. */
 async release(input_ref:string){if(!this.held.has(input_ref))return;this.held.delete(input_ref);this.pressurePending.delete(input_ref);this.changed();return this.request({operation:'performance-gesture',phase:'release',input_ref});}
 async pressure(input_ref:string,pressure:number){if(!this.held.has(input_ref))return;if(!Number.isFinite(pressure)||pressure<0||pressure>1)throw Error('Pressure must be within 0..1.');const current=this.pressurePending.get(input_ref);if(current){current.value=pressure;return;}const slot={value:pressure,running:true};this.pressurePending.set(input_ref,slot);try{let sent:number;do{sent=slot.value;await this.request({operation:'performance-gesture',phase:'expression',input_ref,pressure:sent});}while(this.held.has(input_ref)&&this.pressurePending.get(input_ref)===slot&&sent!==slot.value);}finally{if(this.pressurePending.get(input_ref)===slot)this.pressurePending.delete(input_ref);}}
 async sustain(down:boolean){this.require('performance-sustain');return this.request({operation:'performance-sustain',down});}
 async panic(reason:string){this.held.clear();this.pressurePending.clear();this.changed();return this.request({operation:'performance-panic',reason});}
 async transpose(semitones:number){this.require('performance-transpose');if(!Number.isInteger(semitones)||semitones<0||semitones>11)throw Error('Choose one of the twelve native transpositions.');return this.request({operation:'performance-transpose',semitones});}
 async parameter(target_ref:string,action:'set'|'undo'|'clear'|'learn',value?:number):Promise<NativePerformanceReply>{this.require('performance-parameter');const target=this.reading?.parameters.find(p=>p.target_ref===target_ref);if(!target||!target.capabilities.includes(action)||target.unavailable_reason)throw Error(target?.unavailable_reason??'The native parameter action is unavailable.');const pending=this.parameterPending.get(target_ref);if(action==='set'){if(typeof value!=='number'||!Number.isFinite(value)||value<target.minimum||value>target.maximum)throw Error('The value exceeds the native parameter range.');if(pending){pending.value=value;return pending.done;}const slot={value,done:null as unknown as Promise<NativePerformanceReply>};slot.done=(async()=>{let reply:NativePerformanceReply,sent:number;do{sent=slot.value;reply=await this.request({operation:'performance-parameter',target_ref,action:'set',value:sent});}while(!this.dead&&this.parameterPending.get(target_ref)===slot&&sent!==slot.value);return reply;} )().finally(()=>{if(this.parameterPending.get(target_ref)===slot)this.parameterPending.delete(target_ref);});this.parameterPending.set(target_ref,slot);return slot.done;}if(pending)await pending.done;return this.request({operation:'performance-parameter',target_ref,action});}
 async device(command:Extract<NativePerformanceCommand,{operation:'performance-device-enumerate'|'performance-device-open'|'performance-device-start'|'performance-device-stop'|'performance-device-recover'|'performance-device-close'}>){this.require(command.operation);return this.request(command);}
 /** Owner release must await this result. Unknown panic acknowledgement is
  * retained as a failure; it cannot be presented as a safe completed close. */
 async close(reason='musical surface closed'){if(this.dead)return;try{if(this.held.size||this.reading?.sustain||this.reading?.active_touches||this.pending)await this.panic(reason);}finally{this.dead=true;this.unsubscribe();this.held.clear();this.changed();this.listeners.clear();}}
}
