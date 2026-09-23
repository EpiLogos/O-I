import {reviewedContext,nativeContext,announceContext,clearSnapshotApprovals} from "../context/nativeContext";
import {unknownDispatch,failedDispatch,admissionRefusal,settledPhase,mayStartDispatch} from "./deliveryOutcome";
/**
 * One observer per encounter session.
 *
 * An encounter can be on screen in more than one place at once — a centre tab
 * showing the conversation while the accompanying panel shows Activity /
 * Context / Inspect for the same session (Factory mode relocates the
 * conversation exactly this way). Every presenter of one session shares ONE
 * store entry, keyed `${project}:${agent_session ref}`:
 *
 *   - one poll loop while at least one subscriber is mounted (the 750 ms
 *     cadence and the hidden-document pause are unchanged);
 *   - one canonical draft / compare-and-swap state machine, so typing in
 *     either place is the same AIKit-owned draft and is never lost;
 *   - one shared reading / status / providers / task / dispatch / group /
 *     resume / A2A state, and one set of action functions.
 *
 * Nothing here is a desktop session store: the transcript, the draft and every
 * accepted edit stay AIKit-owned. This holds only the ephemeral input buffer
 * and the last observation, exactly what each EncounterSurface instance held
 * on its own before.
 *
 * An entry outlives its last subscriber (the loop stops; the last observation
 * and any unsaved typing stay) so that closing and reopening a conversation
 * never drops typing the owner has not accepted yet.
 */
import {NativeModelController,connectionLabel,type NativeModelState} from "./nativeModel";
import {useEffect,useMemo,useSyncExternalStore} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import {encounter,mintDeliveryRef,taskRead,type A2aDifference,type A2aPeerFields,type AddressedPacket,type AddressedTurn,type DeliveryRecord,type Draft,type EncounterReading,type EncounterRequest,type EncounterStatus,type EncounterTaskReading,type GroupReceipt,type GroupRecipient,type JournalPage,type PermissionDecision,type SendReceipt} from "./client";
import {createA2aBinding,createA2aPresence} from "../../../../shared-field/a2a.mjs";
import {ACTIVE_PHASES,type AddressedFields,type DeliveryHistoryEntry,type DispatchState,type GroupState} from "./AddressedComposer";

/** Baked by vite.config.ts: true under `vite serve` and `WALK=1` bundles only. */
declare const __CRADLE_WALK__: boolean;

export interface EncounterSessionBinding {project:string;ref:string;space?:string}
export const encounterSessionKey=(binding:{project:string;ref:string})=>`${binding.project}:${binding.ref}`;

export interface EncounterA2aState {seed?:string;busy:boolean;difference?:A2aDifference;error?:string}
export interface EncounterServiceState {running:boolean;pid?:number;detail?:string}

/** The shared observation of one session. Every field is the owner's answer or
 * the ephemeral input buffer; nothing is derived into a claim of its own. */
export interface EncounterSessionState {
 key:string;project:string;agentSession:string;space?:string;
 reading?:EncounterReading;status?:EncounterStatus;
 providers:{id:string;label:string}[];
 model:NativeModelState;
 /** The composer text: the canonical draft, or the person's unsaved typing. */
 draft:string;
 /** An owner operation this window started is in flight. */
 pending:boolean;
 /** `pending`, or typing that is unsaved / saving / sending / held after a failed save. */
 busy:boolean;
 /** A draft save failed: the typing is held and "Apply my typing…" is offered. */
 draftFailed:boolean;
 error?:string;
 /** Pagination: the block id the visible page ends before. Absent = latest page. */
 before?:number;
 /** `undefined` = not read (or the read was refused); `null` = honest absence. */
 task?:EncounterTaskReading|null;
 dispatch:DispatchState;
 deliveries:DeliveryHistoryEntry[];
 group?:GroupState;
 service?:EncounterServiceState;
 resume?:{provider:string};
 reconnected?:string;
 a2a:EncounterA2aState;
}

export interface EncounterSessionActions {
 allowed(name:string):boolean;
 change(text:string):void;
 send():Promise<void>;
 /** After a failed save: re-read the canonical draft and apply the held typing to it. */
 recover():Promise<void>;
 readModel():Promise<void>;
 selectModel(model:string,effort?:string):Promise<void>;
 refreshProviders():Promise<void>;
 connect(provider:string):Promise<void>;
 reconnect(provider:string):Promise<void>;
 cancel():void;
 permission(requestId:string,decision:PermissionDecision):Promise<void>;
 earlier():void;
 latest():void;
 readJournal(after:number):Promise<JournalPage>;
 sendAddressed(turn:AddressedTurn,fields:AddressedFields):Promise<void>;
 reconcileAddressed():Promise<void>;
 sendGroup(sender:string,recipients:GroupRecipient[],packet:AddressedPacket):Promise<void>;
 seedA2a(seed:string):void;
 sendA2a(seed:string,fields:A2aPeerFields):Promise<void>;
}
export interface EncounterSessionHandle {state:EncounterSessionState;actions:EncounterSessionActions}

const hidden=()=>document.visibilityState!=="visible";

class EncounterSession implements EncounterSessionActions {
 private state:EncounterSessionState;
 private models:NativeModelController;
 private listeners=new Set<()=>void>();
 private subscribers=0;
 private stopTimer?:ReturnType<typeof setTimeout>;
 private timer?:ReturnType<typeof setTimeout>;
 /** Generation of the observing run (start…stop) and of the poll chain inside it. */
 private run=0;private chain=0;private observing=false;
 /** The draft CAS machine — the same five refs each surface used to hold. */
 private canonical:Draft={revision:0,text:""};private input="";private dirty=false;private saving=false;private sending=false;private failed=false;
 private operations=0;
 /** Resting-cadence relaxation: how many consecutive polls returned exactly
  * the same reading, and what the last reading looked like. Every read is a
  * process spawn through the shared kernel seam, so an unchanged session
  * must not hold that seam busy; any change returns the loop to live pace. */
 private quietReads=0;
 private lastFingerprint="";
 /** Census for the single-observer law (dev/walk only reads it). */
 polls=0;

 constructor(private transport:KernelTransportStatus,binding:EncounterSessionBinding) {
  this.state={key:encounterSessionKey(binding),project:binding.project,agentSession:binding.ref,space:binding.space,providers:[],model:{phase:"unread"},draft:"",pending:false,busy:false,draftFailed:false,dispatch:{kind:"idle"},deliveries:[],a2a:{busy:false}};
  this.models=new NativeModelController(binding.ref,request=>this.call(request),model=>this.set({model}));
 }
 // --- store plumbing ---------------------------------------------------
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 snapshot=()=>this.state;
 get loops(){return this.observing?1:0;}
 get subscriberCount(){return this.subscribers;}
 private set(patch:Partial<EncounterSessionState>) {
  const next={...this.state,...patch};
  next.pending=this.operations>0;
  next.draftFailed=this.failed;
  next.busy=next.pending||this.dirty||this.saving||this.sending||this.failed;
  this.state=next;
  for(const listener of [...this.listeners])listener();
 }
 private begin(){this.operations++;this.set({});}
 private end(){this.operations=Math.max(0,this.operations-1);this.set({});}
 bind(transport:KernelTransportStatus,space?:string){this.transport=transport;if(space&&space!==this.state.space)this.set({space});}
 /** Reference-counted observation. Release is deferred one task so a remount
  * in the same commit (StrictMode, a plane or mode change that swaps which
  * component presents the session) never tears the observer down. */
 retain(){this.subscribers++;clearTimeout(this.stopTimer);if(!this.observing)this.start();}
 release(){this.subscribers=Math.max(0,this.subscribers-1);if(this.subscribers>0)return;clearTimeout(this.stopTimer);this.stopTimer=setTimeout(()=>{if(this.subscribers===0)this.stop();},0);}

 private call<T,>(request:EncounterRequest){return encounter<T>(this.transport,this.state.project,request);}
 private read(){return this.call<EncounterReading>({action:"view",agent_session:this.state.agentSession,before:this.state.before});}
 allowed=(name:string)=>this.state.reading?.actions?.some(action=>action.ref===`aikit.encounter.${name}`&&action.enabled===true)===true;

 // --- the one poll loop ------------------------------------------------
 private start() {
  const run=++this.run;this.observing=true;this.quietReads=0;this.lastFingerprint="";
  document.addEventListener("visibilitychange",this.onVisible);
  void this.call({action:"start"}).then(()=>{
   if(run!==this.run)return;
   void this.call<{id:string;label:string}[]>({action:"providers"}).then(rows=>{if(run===this.run)this.set({providers:rows});}).catch(error=>{if(run===this.run)this.set({error:String(error)});});
   this.restartChain();
  }).catch(error=>{if(run===this.run)this.set({error:String(error)});});
  // The session's actual task, if the owner bound one. Read once per
  // observing run through the owner's own `encounter-task-read`; null is
  // honest absence. The last observed task stays visible while a later run
  // re-reads it, and is dropped only when that read is refused.
  taskRead(this.transport,this.state.project,this.state.agentSession).then(value=>{if(run===this.run)this.set({task:value});}).catch(()=>{if(run===this.run)this.set({task:undefined});});
  void this.probe();
 }
 private stop() {
  this.run++;this.chain++;this.observing=false;clearTimeout(this.timer);
  document.removeEventListener("visibilitychange",this.onVisible);
 }
 /** Exactly one chain: a restart retires the previous one, whose in-flight
  * read is dropped when it lands instead of scheduling a second timer. */
 private restartChain(){const chain=++this.chain;clearTimeout(this.timer);void this.poll(chain);}
 private onVisible=()=>{if(this.observing&&!hidden()){void this.refreshProviders();this.restartChain();}};
 // Honesty law + SELF-OTHER-FIELD-UX "view disposal": a hidden document
 // (backgrounded app, minimized window) pauses network polling rather than
 // spending cycles on a transcript nobody can see. Structural pausing is the
 // subscriber count: no presenter mounted, no loop.
 private poll=async(chain:number)=>{
  if(chain!==this.chain)return;
  if(hidden()){this.timer=setTimeout(()=>void this.poll(chain),1000);return;}
  try{
   this.polls++;
   const next=await this.read();if(chain!==this.chain)return;
   const patch:Partial<EncounterSessionState>={reading:next};
   if(!this.dirty&&!this.saving&&!this.sending&&next.draft.revision>=this.canonical.revision){this.canonical=next.draft;this.input=next.draft.text;patch.draft=next.draft.text;}
   this.set(patch);
   const current=next.connection ?? await this.call<EncounterStatus>({action:"status",agent_session:this.state.agentSession}).catch(()=>undefined);
   if(chain===this.chain){this.models.observe(current);this.set({status:current});}
   const fingerprint=JSON.stringify([next,current]);
   this.quietReads=fingerprint===this.lastFingerprint?this.quietReads+1:0;
   this.lastFingerprint=fingerprint;
  }catch(error){if(chain===this.chain)this.set({error:String(error)});}
  // A running provider turn is read at a streaming cadence so the transcript
  // grows in small steps. A resting session relaxes stepwise — 750 ms while
  // it last moved, then 1.5 s and 3 s once the reading stops changing; a
  // turn starting, another window's activity or any change resets the pace.
  const inFlight=this.state.status?.state==="TurnInFlight"||this.state.status?.state==="InterruptRequested";
  if(chain===this.chain)this.timer=setTimeout(()=>void this.poll(chain),inFlight?300:this.quietReads===0?750:this.quietReads===1?1500:3000);
 };

 // --- the draft CAS machine (typing is never lost) -----------------------
 private async save() {
  if(!this.allowed("draft")||this.sending||this.saving||this.failed||!this.dirty)return;
  this.saving=true;this.begin();
  try{
   while(this.dirty){
    const text=this.input;
    const accepted=await this.call<Draft>({action:"draft",agent_session:this.state.agentSession,basis:this.canonical.revision,text});
    this.canonical=accepted;this.dirty=this.input!==text;
   }
  }catch(error){this.failed=true;this.set({error:`${String(error)} Your unsaved typing is still here.`});}
  finally{this.saving=false;this.end();}
 }
 change=(text:string)=>{if(!this.allowed("draft"))return;this.input=text;this.dirty=true;this.set({draft:text});void this.save();};
 send=async()=>{
  if(this.operations>0||!this.allowed("prompt")||this.dirty||this.saving||this.sending||this.failed)return;
  this.sending=true;const submitted=this.input;this.begin();this.set({error:undefined});
  try{
   const supportsContext=this.state.reading?.actions?.some(action=>action.ref==="aikit.encounter.context"&&action.enabled);
   const context=supportsContext?await reviewedContext(this.transport,this.state.project,this.state.agentSession):undefined;
   const response=await this.call<{draft:Draft}>(context?{action:"prompt-context",agent_session:this.state.agentSession,draft_revision:this.canonical.revision,context}:{action:"prompt",agent_session:this.state.agentSession,draft_revision:this.canonical.revision});
   clearSnapshotApprovals();
   if(context)void nativeContext(this.transport,this.state.project,this.state.agentSession).then(value=>announceContext(this.state.project,value)).catch(()=>{});
   this.canonical=response.draft;
   if(this.input===submitted){this.input=response.draft.text;this.set({draft:response.draft.text});}else{this.dirty=true;}
   this.set({status:await this.call<EncounterStatus>({action:"status",agent_session:this.state.agentSession})});
  }catch(error){this.set({error:String(error)});}
  finally{this.sending=false;this.end();void this.save();}
 };
 recover=async()=>{
  try{const next=await this.read();this.canonical=next.draft;this.failed=false;this.dirty=this.input!==next.draft.text;this.set({error:undefined});await this.save();}
  catch(error){this.set({error:String(error)});}
 };

 // --- connection, consent, stop ----------------------------------------
 readModel=()=>this.models.refresh();
 selectModel=async(model:string,effort?:string)=>{this.begin();try{await this.models.select(model,effort);}finally{this.end();}};
 refreshProviders=async()=>{
  try{const providers=await this.call<{id:string;label:string}[]>({action:"providers"});this.set({providers,error:undefined});}
  catch(error){this.set({error:String(error)});}
 };

 connect=async(provider:string)=>{
  if(!this.allowed("open"))return;
  this.begin();this.set({error:undefined});
  try{
   await this.call({action:"open",space:this.state.space??"",agent_session:this.state.agentSession,provider});
   this.set({status:await this.call<EncounterStatus>({action:"status",agent_session:this.state.agentSession})});
  }catch(error){
   // The owner's own law: a recorded native session exists, so a fresh open
   // is refused and only an explicit reconnect may resume it.
   if(String(error).includes("encounter.resume_required"))this.set({resume:{provider}});
   this.set({error:String(error)});
  }finally{this.end();}
 };
 // Reconnect resumes the actually recorded native session identity after an
 // owner restart; a plain open is refused first (`encounter.resume_required`)
 // and that refusal is what discloses the recorded session to this window.
 reconnect=async(provider:string)=>{
  this.begin();this.set({error:undefined});
  try{
   const opened=await this.call<{native_session_id?:string}>({action:"reconnect",space:this.state.space??"",agent_session:this.state.agentSession,provider});
   this.set({resume:undefined,reconnected:opened.native_session_id});
   this.set({status:await this.call<EncounterStatus>({action:"status",agent_session:this.state.agentSession})});
  }catch(error){this.set({error:String(error)});}finally{this.end();}
 };
 cancel=()=>{if(!this.allowed("cancel"))return;void this.call({action:"cancel",agent_session:this.state.agentSession,reason:"User stopped the encounter"}).catch(error=>this.set({error:String(error)}));};
 permission=async(request_id:string,decision:PermissionDecision)=>{
  if(!this.allowed("permission"))return;
  this.begin();this.set({error:undefined});
  try{await this.call({action:"permission",agent_session:this.state.agentSession,request_id,decision});const next=await this.read();this.set({reading:next,status:next.connection});}
  catch(error){this.set({error:String(error)});}finally{this.end();}
 };
 earlier=()=>{const first=this.state.reading?.blocks[0]?.id;this.set({before:first});if(this.observing)this.restartChain();};
 latest=()=>{if(this.state.before===undefined)return;this.set({before:undefined});if(this.observing)this.restartChain();};
 readJournal=(after:number)=>this.call<JournalPage>({action:"read",agent_session:this.state.agentSession,after,limit:32});

 // --- addressed dispatch: explicit machine turns, never the human draft ---
 private probe=async()=>{
  try{const health=await this.call<{protocol:string;pid:number}>({action:"health"});this.set({service:{running:true,pid:health.pid}});}
  catch(error){this.set({service:{running:false,detail:String(error)}});}
 };
 private settle(entry:DeliveryHistoryEntry){this.set({dispatch:{kind:"settled",ref:entry.ref,record:entry.record,duplicate:entry.duplicate},deliveries:[entry,...this.state.deliveries]});}
 private async track(ref:string,packet:AddressedPacket) {
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,900));
   if(hidden())continue;
   let record:DeliveryRecord|undefined;
   try{record=await this.call<DeliveryRecord>({action:"delivery",agent_session:this.state.agentSession,delivery_ref:ref});}catch{continue;}
   if(!record)return;
   this.set({dispatch:{kind:"running",ref,phase:record.phase}});
   if(settledPhase(record.phase)){this.settle({ref,record,duplicate:false,packet});return;}
  }
 }
 sendAddressed=async(turn:AddressedTurn,_fields:AddressedFields)=>{
  if(!mayStartDispatch(this.state.dispatch,this.state.group))return;
  const ref=mintDeliveryRef();
  this.set({dispatch:{kind:"running",ref,phase:"preparing"}});
  try{
   const receipt=await this.call<SendReceipt>({action:"send",agent_session:this.state.agentSession,turn:{...turn,delivery_ref:ref}});
   const record=receipt.delivery;
   if(settledPhase(record.phase)){this.settle({ref,record,duplicate:receipt.duplicate,packet:turn.packet});return;}
   this.set({dispatch:{kind:"running",ref,phase:record.phase}});
   await this.track(ref,turn.packet);
  }catch(error){this.set({dispatch:failedDispatch(ref,error)});void this.probe();}
 };
 // Explicitly reconcile existing native delivery identities. No send is
 // called here; absence, refusal and unreadable results stay unknown.
 reconcileAddressed=async()=>{
  const dispatch=this.state.dispatch;
  if(dispatch.kind==="unknown"||dispatch.kind==="running"){
   try{
    const record=await this.call<DeliveryRecord>({action:"delivery",agent_session:this.state.agentSession,delivery_ref:dispatch.ref});
    if(this.state.dispatch.kind!=="idle"&&this.state.dispatch.ref===dispatch.ref){
     if(!record||typeof record.phase!=="string")this.set({dispatch:unknownDispatch(dispatch.ref,"No native receipt yet")});
     else if(settledPhase(record.phase))this.settle({ref:dispatch.ref,record,duplicate:false});
     else this.set({dispatch:{kind:"running",ref:dispatch.ref,phase:record.phase}});
    }
   }catch(error){this.set({dispatch:unknownDispatch(dispatch.ref,error)});}
  }
  const group=this.state.group;
  if(group){
   const rows=await Promise.all(group.rows.map(async row=>{
    if(row.phase===undefined||settledPhase(row.phase))return row;
    try{const record=await this.call<DeliveryRecord>({action:"delivery",agent_session:row.agentSession,delivery_ref:group.ref});
     return record&&typeof record.phase==="string"?{...row,phase:record.phase,error:undefined}:{...row,phase:"unknown",error:"No native receipt yet"};
    }catch(error){return {...row,phase:"unknown",error:String(error)};}
   }));
   if(this.state.group?.ref===group.ref)this.set({group:{ref:group.ref,rows}});
  }
 };
 // Addressed group: one packet, explicit recipients, whole-group admission
 // owner-side, per-recipient durable results, non-atomic fanout.
 private async trackRecipient(ref:string,session:string,apply:(row:{phase?:string;duplicate?:boolean})=>void) {
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,900));
   if(hidden())continue;
   let record:DeliveryRecord|undefined;
   try{record=await this.call<DeliveryRecord>({action:"delivery",agent_session:session,delivery_ref:ref});}catch{continue;}
   if(!record)return;
   apply({phase:record.phase});
   if(!ACTIVE_PHASES.includes(record.phase))return;
  }
 }
 sendGroup=async(sender:string,recipients:GroupRecipient[],packet:AddressedPacket)=>{
  if(!mayStartDispatch(this.state.dispatch,this.state.group))return;
  const ref=mintDeliveryRef();
  this.set({group:{ref,rows:recipients.map(recipient=>({agentSession:recipient.agent_session,phase:"preparing"}))}});
  try{
   const receipt=await this.call<GroupReceipt>({action:"send-group",delivery_ref:ref,sender,packet,recipients});
   const bySession=new Map(receipt.recipients.map(entry=>[entry.agent_session,entry]));
   const rows=recipients.map(recipient=>{
    const entry=bySession.get(recipient.agent_session);
    if(!entry)return {agentSession:recipient.agent_session,phase:"unknown",error:"Missing recipient acknowledgement; inspect without replay"};
    if(entry.error){const error=`${entry.error.message} [${entry.error.code}]`;return admissionRefusal(error)?{agentSession:recipient.agent_session,error}:{agentSession:recipient.agent_session,phase:"unknown",error};}
    return {agentSession:recipient.agent_session,phase:entry.result!.delivery.phase,duplicate:entry.result!.duplicate};
   });
   this.set({group:{ref,rows}});
   // Still-active recipients are tracked through their own durable delivery
   // receipts — each recipient settles on its own, never as a group.
   await Promise.all(recipients.map(async(recipient,index)=>{
    const entry=bySession.get(recipient.agent_session);
    if(!entry?.result||!ACTIVE_PHASES.includes(entry.result.delivery.phase))return;
    await this.trackRecipient(ref,recipient.agent_session,row=>{
     const current=this.state.group;
     if(current)this.set({group:{...current,rows:current.rows.map((existing,existingIndex)=>existingIndex===index?{...existing,...row}:existing)}});
    });
   }));
  }catch(error){const refused=admissionRefusal(error);this.set({group:{ref,rows:recipients.map(recipient=>refused?{agentSession:recipient.agent_session,error:String(error)}:{agentSession:recipient.agent_session,phase:"unknown",error:String(error)})}});void this.probe();}
 };

 // --- A2A exchange: the resident's own reply is the bounded passage.
 // Binding, presence, exchange authority and the returned difference are the
 // owner floor's contracts, composed per send — nothing reaches the network
 // until the human's explicit send. The provenance names the encounter
 // session and the native session the passage actually came from. ---
 seedA2a=(seed:string)=>this.set({a2a:{seed,busy:false}});
 sendA2a=async(seed:string,fields:A2aPeerFields)=>{
  this.set({a2a:{seed,busy:true}});this.begin();
  try{
   const slug=fields.peerAgent.trim().replace(/[^a-z0-9]+/gi,"-").toLowerCase()||"peer";
   const nativeSession=this.state.status?.native_session_id;
   const ref=this.state.agentSession;
   const a2aBinding=createA2aBinding({
    binding_ref:`a2a-binding:agency-panel:${slug}`,
    field_ref:`field:encounter:${ref}`,
    participant_ref:`participant:a2a:${slug}`,
    agent_ref:fields.peerAgent.trim(),
    publisher_participant_ref:"participant:desktop-operator",
    publication_decision_ref:`decision:agency-panel-send:${Date.now().toString(36)}`,
    source_revision:nativeSession??"desktop-operator",
    published_at:new Date().toISOString(),
    endpoint_url:fields.peerEndpoint.trim(),
    agent_card_url:fields.peerCard.trim(),
    provenance:[{kind:"agency-panel-exchange",ref:`agent-session ${ref}${nativeSession?` · native ${nativeSession}`:""}`,source_system:"oi.cradle"}],
   });
   const a2aPresence=createA2aPresence({
    binding_ref:a2aBinding.binding_ref,field_ref:a2aBinding.field_ref,participant_ref:a2aBinding.participant_ref,
    sequence:1,observed_at:new Date().toISOString(),
    availability:fields.peerAvailability==="offline"?"offline":fields.peerAvailability==="degraded"?"degraded":"online",
    provenance:[{kind:"desktop-operator-observation",ref:"observation:agency-panel-peer",source_system:"oi.cradle"}],
   });
   // The exchange crosses the kernel seam like every other owner act: the
   // network I/O and the authority record live in the kernel's spawned
   // runner, and the person's send is the recorded exchange-authority
   // decision — no renderer fetch, no self-minted grant.
   const routed=await kernelOp(this.transport,{op:"a2a_exchange",request:{
    binding:a2aBinding,presence:a2aPresence,
    initiator_participant_ref:"participant:desktop-operator",
    message:{message_id:`a2a-agency-${Date.now().toString(36)}`,text:seed,purpose:"agency-panel-a2a-exchange"},
   }});
   if(routed.error||routed.outcome?.result!=="a2a_exchange_difference")throw new Error(routed.error??"The A2A exchange could not be routed through the kernel.");
   const difference=routed.outcome.data as unknown as A2aDifference;
   this.set({a2a:{seed,busy:false,difference}});
  }catch(err){this.set({a2a:{seed,busy:false,error:String(err)}});}
  finally{this.end();}
 };
}

const sessions=new Map<string,EncounterSession>();
function acquire(transport:KernelTransportStatus,binding:EncounterSessionBinding):EncounterSession {
 const key=encounterSessionKey(binding);
 let session=sessions.get(key);
 if(!session){session=new EncounterSession(transport,binding);sessions.set(key,session);}
 session.bind(transport,binding.space);
 return session;
}
/** The single-observer census, for the walk harness only: per session key, how
 * many presenters subscribe, how many poll loops run (0 or 1) and how many
 * view reads that loop has issued. Mounted only in dev/walk bundles — a plain
 * production build drops this branch with the rest of the walk channel. */
if(__CRADLE_WALK__){
 const host=window as unknown as {__cradle?:Record<string,unknown>};
 host.__cradle={...(host.__cradle??{}),encounterObservers:()=>Object.fromEntries([...sessions].map(([key,session])=>[key,{subscribers:session.subscriberCount,loops:session.loops,polls:session.polls}]))};
}

const noSubscription=()=>()=>{};
const noSnapshot=()=>undefined;
/** Subscribe to the one shared observer of a session. Every caller with the
 * same project + ref receives the same state and the same actions; the poll
 * loop runs while at least one caller is mounted. */
export function useEncounterSession(binding:EncounterSessionBinding|undefined):EncounterSessionHandle|undefined {
 const kernel=useKernel();
 const project=binding?.project,ref=binding?.ref,space=binding?.space;
 const session=useMemo(()=>project!==undefined&&ref?acquire(kernel.transport,{project,ref,space}):undefined,[kernel.transport,project,ref]);
 useEffect(()=>{if(session&&space)session.bind(kernel.transport,space);},[session,space,kernel.transport]);
 useEffect(()=>{if(!session)return;session.retain();return()=>session.release();},[session]);
 const state=useSyncExternalStore<EncounterSessionState|undefined>(session?session.subscribe:noSubscription,session?session.snapshot:noSnapshot);
 return useMemo(()=>session&&state?{state,actions:session}:undefined,[session,state]);
}

// --- read models derived from the shared state (pure) -----------------------

/** What the panel head's agent cue reads: the owner's state, this window's
 * pending operation, the newest completion and working-material block ids. */
export interface EncounterExpressionReading {agentSessionRef?:string;state?:string;pending:boolean;completed?:number;inputRevision?:number;latestOwnerActivity?:{blockId:number;kind:string}}
export function expressionReadingOf(state:EncounterSessionState|undefined):EncounterExpressionReading {
 if(!state)return {pending:false};
 const {reading,status,pending}=state;
 const activity=reading?.blocks.filter(block=>["thinking","tool","permission","completed"].includes(block.kind)).slice(-1)[0];
 return {agentSessionRef:reading?.agent_session,state:status?.state,pending,inputRevision:reading?.draft.revision,completed:reading?reading.blocks.filter(block=>block.kind==="completed").slice(-1)[0]?.id??-1:undefined,latestOwnerActivity:activity?{blockId:activity.id,kind:activity.kind}:undefined};
}
/** The owner's connection state as the one label every head shows. */
export function sessionStateLabel(status:EncounterStatus|undefined):string {return connectionLabel(status);}
/** Delivery identities dispatched from this window, with their settled phases. */
export function deliveriesOf(state:EncounterSessionState):{ref:string;phase:string}[] {
 return [...state.deliveries.map(entry=>({ref:entry.ref,phase:entry.record.phase})),...(state.group?[{ref:state.group.ref,phase:`group — ${state.group.rows.map(row=>row.error?"refused":row.phase??"in flight").join(", ")}`}]:[])];
}
/** NOW refs this session's own records name — an addressed dispatch receipt,
 * a task basis. Nothing is inferred from transcripts or bindings. */
export function nowRefsOf(state:EncounterSessionState):{ref:string;register:string|null}[] {
 const refs:{ref:string;register:string|null}[]=state.deliveries.flatMap(entry=>{const nowRef=(entry.record as {now_ref?:unknown}).now_ref;return typeof nowRef==="string"&&nowRef?[{ref:nowRef,register:null}]:[];});
 const allocated=state.task?.allocation?.allocation?.now_ref;
 if(allocated&&!refs.some(entry=>entry.ref===allocated))refs.push({ref:allocated,register:state.task?.request?.central?.project??null});
 return refs;
}
export const taskBasisWithoutNow=(state:EncounterSessionState)=>!!state.task&&!state.task.allocation?.allocation?.now_ref;
