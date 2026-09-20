/** Application lifetime for one native Nara encounter. Presentation may unmount;
 * native identity and deliveries do not. This memory is private and never a
 * corpus, diagnostic payload, localStorage transcript or new session owner. */
import {
  abortCheck,dialoguePacket,nativeTurn,readDelivery,readNativeSession,requireNativeReady,sameEncounter,validateAttachment,
  NativeTurnError,type EncounterCall,type NaraAttachment,type NativeTurnResult,
} from "./nativeDialogue";
import type {CaptureHandle,SpeechAudio} from "./audio";
import {
  applyGate,buildEpiiDelegation,receiveEnrichment,validateDialogueContext,validateEpiiEnrichment,
  type EpiiDelegation,type EpiiEnrichment,type NaraDialogueContext,
} from "./dialogueContext";

export type NaraPhase="idle"|"checking"|"requesting-microphone"|"listening"|"transcribing"|"waiting"|"preparing-audio"|"speaking"|"interrupted"|"error"|"ended";
export interface DialogueRow {role:"person"|"nara"|"epii";text:string;delivery_ref?:string;complete:boolean}
export interface Inquiry {delegation:EpiiDelegation;delivery_ref:string;explanation:string;enrichment:EpiiEnrichment|null;decision:"pending"|"applying"|"partial"|"uncertain"|"rejected"|"accepted";error:string|null;context_basis:NaraDialogueContext}
export interface NaraRuntimeSnapshot {
  phase:NaraPhase;voice_enabled:boolean;draft:string;notice:string;rows:DialogueRow[];
  pending:{delivery_ref:string;target:"nara"|"epii"}|null;inquiries:Inquiry[];
}
export interface RuntimePorts {call:EncounterCall;audio:SpeechAudio;hold?:()=>Promise<void>;pollMs?:number;timeoutMs?:number}
const fresh=(kind:string)=>`${kind}/nara-${crypto.randomUUID()}`;
const interrupted=(error:unknown)=>error instanceof Error&&error.name==="AbortError";
// A context ref is an address, not proof that its disclosed revisions stayed
// unchanged. Compare the complete reviewed reading, independently of key order.
function contextKey(value:unknown):string {
  if(Array.isArray(value))return "["+value.map(contextKey).join(",")+"]";
  if(value&&typeof value==="object")return "{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+contextKey((value as Record<string,unknown>)[key])).join(",")+"}";
  return JSON.stringify(value);
}

export class NaraRuntime {
  private attachment:NaraAttachment;
  private state:NaraRuntimeSnapshot={phase:"idle",voice_enabled:false,draft:"",notice:"",rows:[],pending:null,inquiries:[]};
  private snapshot:NaraRuntimeSnapshot=structuredClone(this.state);
  private listeners=new Set<()=>void>();
  private controller:AbortController|null=null;
  private capture:CaptureHandle|null=null;
  private generation=0;
  private holding:Promise<void>|null=null;
  private currentInquiry:string|null=null;
  private readonly ports:RuntimePorts;
  constructor(attachment:unknown,ports:RuntimePorts){this.attachment=validateAttachment(attachment);this.ports=ports;}
  get binding():NaraAttachment{return structuredClone(this.attachment);}
  getSnapshot=():NaraRuntimeSnapshot=>this.snapshot;
  subscribe=(listener:()=>void):(()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private emit():void {this.snapshot=structuredClone(this.state);for(const listener of this.listeners)listener();}
  setDraft(text:string):void {if(text.length>16384)throw new Error("Dialogue draft exceeds the bounded turn limit");this.state.draft=text;this.emit();}
  private setPhase(phase:NaraPhase,notice=""):void {this.state.phase=phase;this.state.notice=notice;this.emit();}
  private begin():{signal:AbortSignal;generation:number} {
    if(this.controller||this.holding||this.state.pending||this.state.inquiries.some(row=>row.decision==="applying"))throw new Error("Finish or recover the current native delivery before starting another turn");
    if(this.state.phase==="ended")throw new Error("This personal attachment was ended; attach explicitly to continue");
    this.controller=new AbortController();return {signal:this.controller.signal,generation:++this.generation};
  }
  private current(generation:number,signal:AbortSignal):void {abortCheck(signal);if(generation!==this.generation)throw new DOMException("Stale response", "AbortError");}
  private failed(error:unknown,generation:number):void {
    if(generation!==this.generation||interrupted(error))return;
    if(error instanceof NativeTurnError&&error.terminal&&this.state.pending?.delivery_ref===error.delivery_ref)this.state.pending=null;
    // Owner/provider strings can contain personal source or transcript text.
    // Keep failures local and bounded; never log or publish this state.
    this.setPhase("error",error instanceof Error?error.message.slice(0,512):"The operation failed; no success was inferred");
  }
  enableVoice():void {if(!this.attachment.speech)throw new Error("No executable speech adapter is attached");if(this.state.phase==="ended")throw new Error("The encounter is ended");this.state.voice_enabled=true;this.emit();}
  async disableVoice():Promise<void>{this.state.voice_enabled=false;await this.interrupt();}
  /** Readiness is native and checked BEFORE the first microphone request. */
  async startCapture():Promise<void> {
    if(!this.state.voice_enabled||!this.attachment.speech)throw new Error("Enable this speech route explicitly before using the microphone");
    const {signal,generation}=this.begin();this.setPhase("checking");
    try{await requireNativeReady(this.ports.call,this.attachment.dialogue);this.current(generation,signal);
      this.setPhase("requesting-microphone");const handle=await this.ports.audio.capture(signal,reason=>{if(generation===this.generation&&!signal.aborted){this.controller?.abort();this.controller=null;this.capture=null;this.setPhase("error",reason);}});
      if(signal.aborted||generation!==this.generation){handle.cancel();this.current(generation,signal);}
      this.capture=handle;this.setPhase("listening");
    }catch(error){this.failed(error,generation);if(this.generation===generation)this.controller=null;}
  }
  async finishCapture():Promise<void> {
    if(!this.capture){if(this.controller)await this.interrupt();return;}
    const controller=this.controller;if(!controller)return;
    const signal=controller.signal,generation=this.generation,handle=this.capture;this.capture=null;
    try{const wav=await handle.finish();this.current(generation,signal);this.setPhase("transcribing");
      const text=await this.ports.audio.transcribe(wav,this.attachment.speech!,signal);this.current(generation,signal);
      await this.deliver(text,signal,generation);
    }catch(error){this.failed(error,generation);}finally{if(this.generation===generation)this.controller=null;}
  }
  async sendText(text=this.state.draft):Promise<void> {
    // Validate before allocating an active controller or retiring the draft.
    dialoguePacket(text,this.attachment.context);
    const {signal,generation}=this.begin();
    try{await this.deliver(text,signal,generation);}catch(error){this.failed(error,generation);}finally{if(this.generation===generation)this.controller=null;}
  }
  private async deliver(text:string,signal:AbortSignal,generation:number):Promise<void> {
    const basis=structuredClone(this.attachment.context),packet=dialoguePacket(text,basis),delivery=fresh("delivery");
    this.setPhase("waiting");
    const result=await nativeTurn({call:this.ports.call,binding:this.attachment.dialogue,audience:this.attachment.constitution.agent_ref,
      ...packet,signal,delivery_ref:delivery,pollMs:this.ports.pollMs,timeoutMs:this.ports.timeoutMs,
      onDispatch:()=>{this.state.pending={delivery_ref:delivery,target:"nara"};this.addRow({role:"person",text,delivery_ref:delivery,complete:true});this.state.draft="";this.emit();},
      onText:response=>{if(!signal.aborted&&generation===this.generation)this.replaceResponse("nara",delivery,response,false);},
    });
    this.current(generation,signal);this.state.pending=null;
    this.replaceResponse("nara",delivery,result.text,true);
    await this.speak(result.text,signal,generation);
  }
  private addRow(row:DialogueRow):void {this.state.rows=[...this.state.rows,row].slice(-64);}
  private replaceResponse(role:"nara"|"epii",delivery:string,text:string,complete:boolean):void {
    if(!text)return;const existing=this.state.rows.find(row=>row.role===role&&row.delivery_ref===delivery);
    if(existing){existing.text=text;existing.complete=complete;}else this.addRow({role,text,delivery_ref:delivery,complete});this.emit();
  }
  private async speak(text:string,signal:AbortSignal,generation:number):Promise<void> {
    if(this.state.voice_enabled&&this.attachment.speech){
      this.setPhase("preparing-audio");const wav=await this.ports.audio.synthesize(text,this.attachment.speech,signal);this.current(generation,signal);
      await this.ports.audio.play(wav,signal,()=>{if(!signal.aborted&&generation===this.generation)this.setPhase("speaking");});
      this.current(generation,signal);
    }
    this.setPhase("idle");
  }
  /** Stops only effects this attachment actually owns. The existing native
   * cancel is session-wide, not delivery-correlated: do not race and cancel
   * another actor's next turn. Preserve the durable delivery for recovery. */
  async interrupt():Promise<void> {
    ++this.generation;this.controller?.abort();this.controller=null;this.capture?.cancel();this.capture=null;this.ports.audio.stop();
    const hold=Promise.resolve().then(()=>this.ports.hold?.());this.holding=hold;
    this.setPhase("interrupted",this.state.pending?"Local input/output stopped. Native cancellation is not confirmed; recover this exact delivery without replay.":"Local input/output stopped; the native encounter is retained.");
    try{await hold;}catch{this.state.notice="Local audio stopped; Expression hold could not be confirmed. Re-read its native state before continuing.";this.emit();}
    finally{if(this.holding===hold)this.holding=null;}
  }
  /** Explicit native readback, never resend; recovered material is NOT spoken
   * automatically and stale results never become pending choreography. */
  async recover():Promise<void> {
    if(this.controller||this.holding)throw new Error("Stop the current operation first");
    const pending=this.state.pending;if(!pending)throw new Error("There is no pending native delivery to recover");
    const target=pending.target==="epii"?this.attachment.epii:this.attachment.dialogue;
    if(!target)throw new Error("The original Epii binding is not attached");
    const controller=new AbortController(),generation=++this.generation;this.controller=controller;this.setPhase("waiting");
    try{const result=await readDelivery({call:this.ports.call,binding:target,delivery_ref:pending.delivery_ref,signal:controller.signal,pollMs:this.ports.pollMs,timeoutMs:this.ports.timeoutMs});
      this.current(generation,controller.signal);this.state.pending=null;
      if(pending.target==="epii")this.receiveInquiry(result);
      else this.replaceResponse("nara",result.delivery_ref,result.text,true);
      this.setPhase("idle","Recovered the original native result. Nothing was replayed, spoken or applied.");
    }catch(error){this.failed(error,generation);}finally{if(this.generation===generation)this.controller=null;}
  }
  async reconnect(nextInput?:unknown):Promise<void> {
    if(this.controller||this.holding||this.state.pending)throw new Error("Stop and recover the current delivery before reconnecting");
    const next=nextInput?validateAttachment(nextInput):this.attachment;
    if(!sameEncounter(this.attachment,next))throw new Error("Reconnect cannot change the Nara, personal subject, World, Expression or AgentSession");
    const {signal,generation}=this.begin();this.setPhase("checking");
    try{const reading=await readNativeSession(this.ports.call,next.dialogue);this.current(generation,signal);
      if(reading.connection?.state!=="Resident"||reading.connection.error){
        await this.ports.call(next.dialogue,{action:"reconnect",space:next.dialogue.space,agent_session:next.dialogue.agent_session,provider:next.dialogue.provider});
        this.current(generation,signal);await requireNativeReady(this.ports.call,next.dialogue);this.current(generation,signal);
      }
      const bodyChanged=JSON.stringify(next.speech)!==JSON.stringify(this.attachment.speech)||next.constitution.constitution_ref!==this.attachment.constitution.constitution_ref;
      next.context=structuredClone(this.attachment.context);
      this.attachment=next;if(bodyChanged)this.state.voice_enabled=false;
      this.setPhase("idle",bodyChanged?"Same Nara and AgentSession; body changed. Enable the new speech route explicitly.":"Same native Nara encounter. No provider acoustic-history restoration is inferred.");
    }catch(error){this.failed(error,generation);}finally{if(this.generation===generation)this.controller=null;}
  }
  updateContext(next:NaraDialogueContext,acceptanceRef?:string):void {
    const applying=this.state.inquiries.find(row=>row.decision==="applying");
    if(applying&&applying.delegation.delegation_ref!==acceptanceRef)throw new Error("Context is reserved by the current native acceptance");
    const validated=validateDialogueContext(structuredClone(next));
    if(validated.nara_ref!==this.attachment.context.nara_ref||validated.subject_ref!==this.attachment.context.subject_ref||validated.agent_session_ref!==this.attachment.dialogue.agent_session||validated.expression_ref!==this.attachment.context.expression_ref)throw new Error("Context cannot switch the personal encounter's identity");
    this.attachment.context=validated;this.emit();
  }
  async inquire(brief:string,scope:string[]):Promise<void> {
    const target=this.attachment.epii;if(!target)throw new Error("A distinct native Epii session must be selected");
    const delegation=buildEpiiDelegation({delegation_ref:fresh("delegation"),context:structuredClone(this.attachment.context),epii_session_ref:target.agent_session,brief,scope_candidates:scope,delegated_at_unix_ms:Date.now()});
    const {signal,generation}=this.begin(),delivery=fresh("delivery");
    const inquiry:Inquiry={delegation,delivery_ref:delivery,explanation:"",enrichment:null,decision:"pending",error:null,context_basis:structuredClone(this.attachment.context)};
    this.currentInquiry=delegation.delegation_ref;this.state.inquiries=[...this.state.inquiries,inquiry].slice(-16);
    this.setPhase("waiting");
    try{const result=await nativeTurn({call:this.ports.call,binding:target,audience:target.agent_ref,signal,delivery_ref:delivery,
      text:JSON.stringify({delegation,return_contract:"ql.epii-enrichment/v1",instruction:"Return a source-bearing explanation. Structured proposals must use the named QL contract and exact supplied basis; do not execute changes."}),
      source_refs:[...scope],pollMs:this.ports.pollMs,timeoutMs:this.ports.timeoutMs,
      onDispatch:()=>{this.state.pending={delivery_ref:delivery,target:"epii"};this.emit();},
    });this.current(generation,signal);this.state.pending=null;this.receiveInquiry(result);this.setPhase("idle","Epii returned material for review; no native or expressive change was applied.");
    }catch(error){this.failed(error,generation);}finally{if(this.generation===generation)this.controller=null;}
  }
  private receiveInquiry(result:NativeTurnResult):void {
    const row=this.state.inquiries.find(row=>row.delivery_ref===result.delivery_ref&&row.delegation.delegation_ref===this.currentInquiry);
    if(!row)throw new Error("Epii result has no retained matching delegation");row.explanation=result.text;
    try{const candidate=validateEpiiEnrichment(JSON.parse(result.text));row.delegation=receiveEnrichment(row.delegation,candidate);row.enrichment=candidate;}
    catch{row.error="The real reply is retained as explanation; no valid basis-bound QL proposal was returned.";}
    this.replaceResponse("epii",result.delivery_ref,result.text,true);
  }
  rejectInquiry(ref:string):void {const row=this.state.inquiries.find(row=>row.delegation.delegation_ref===ref);if(!row||row.decision!=="pending")throw new Error("No pending inquiry");row.decision="rejected";this.emit();}
  reviewInquiry(ref:string):{delegation:EpiiDelegation;enrichment:EpiiEnrichment} {
    const row=this.state.inquiries.find(row=>row.delegation.delegation_ref===ref);
    if(!row||row.decision!=="pending"||!row.enrichment)throw new Error("No pending structured enrichment");
    if(contextKey(row.context_basis)!==contextKey(this.attachment.context))throw new Error("The reviewed selection, source or occasion changed; request fresh Epii enrichment");
    applyGate(row.delegation,row.enrichment,this.attachment.context);
    return structuredClone({delegation:row.delegation,enrichment:row.enrichment});
  }
  /** Reserve the explicit human acceptance before crossing a native write.
   * Another presentation may not reject or apply the same proposal in flight. */
  beginInquiryAcceptance(ref:string):{delegation:EpiiDelegation;enrichment:EpiiEnrichment} {
    const proposal=this.reviewInquiry(ref);
    if(this.controller||this.holding||this.state.pending)throw new Error("Finish the current dialogue operation before accepting a proposal");
    const row=this.state.inquiries.find(row=>row.delegation.delegation_ref===ref)!;
    if(this.state.inquiries.some(item=>item.decision==="applying"))throw new Error("Another proposal is still being applied");
    row.decision="applying";this.emit();return proposal;
  }
  finishInquiryAcceptance(ref:string,outcome:"accepted"|"partial"|"uncertain"|"pending"):void {
    const row=this.state.inquiries.find(row=>row.delegation.delegation_ref===ref);
    if(!row||row.decision!=="applying")throw new Error("No reserved inquiry acceptance");
    row.decision=outcome;this.emit();
  }
  /** Explicit end forgets renderer-held personal content, never deletes the
   * owner's journal or claims a provider/session was destroyed. */
  async end():Promise<void>{await this.interrupt();if(this.state.inquiries.some(row=>row.decision==="applying"))throw new Error("Settle the interrupted native acceptance before forgetting this attachment");if(this.state.pending)throw new Error("Recover the outstanding native delivery before forgetting this attachment");this.state={phase:"ended",voice_enabled:false,draft:"",notice:"Detached. Native history and any pending delivery remain with their owner.",rows:[],pending:null,inquiries:[]};this.currentInquiry=null;this.emit();}
}
