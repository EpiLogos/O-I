import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {encounter,mintDeliveryRef,type A2aDifference,type A2aPeerFields,type AddressedPacket,type AddressedTurn,type DeliveryRecord,type Draft,type EncounterReading,type EncounterStatus,type GroupReceipt,type GroupRecipient,type JournalPage,type PermissionDecision,type SendReceipt} from "./client";
import {createA2aBinding,createA2aPresence,performA2aExchange} from "../../../../shared-field/a2a.mjs";
import {AddressedComposer,ACTIVE_PHASES,type AddressedFields,type DispatchState,type DeliveryHistoryEntry,type GroupState} from "./AddressedComposer";
import {EncounterView} from "./EncounterView";
export interface EncounterExpressionReading {state?:string;pending:boolean;completed?:number;inputRevision?:number}
/** Ephemeral input buffering only. Every accepted edit and message is AIKit-owned. */
export function EncounterSurface({binding,onView,presentation="tab",onExpression,concealed=false}:{binding:SurfaceBinding;onView:(view:NonNullable<SurfaceBinding["view"]>)=>void;presentation?:"tab"|"side"|"full";onExpression?:(reading:EncounterExpressionReading)=>void;concealed?:boolean}) {
 const kernel=useKernel();
 const [reading,setReading]=useState<EncounterReading>();const [status,setStatus]=useState<EncounterStatus>();
 const [providers,setProviders]=useState<{id:string;label:string}[]>([]);const [draft,setDraft]=useState("");
 const [error,setError]=useState<string>();const [pending,setPending]=useState(false);
 const canonical=useRef<Draft>({revision:0,text:""});const input=useRef("");const dirty=useRef(false);const saving=useRef(false);const sending=useRef(false);const failed=useRef(false);
 const [before,setBefore]=useState<number>();
 const expression=useRef(onExpression);expression.current=onExpression;
 useEffect(()=>{expression.current?.({state:status?.state,pending,inputRevision:reading?.draft.revision,completed:reading?reading.blocks.filter(block=>block.kind==="completed").slice(-1)[0]?.id??-1:undefined});},[status,reading,pending]);
 const call=<T,>(request:Parameters<typeof encounter>[2])=>encounter<T>(kernel.transport,binding.project!,request);
 const read=()=>call<EncounterReading>({action:"view",agent_session:binding.ref!,before});
 const allowed=(name:string)=>reading?.actions?.some(action=>action.ref===`aikit.encounter.${name}`&&action.enabled===true)===true;
 useEffect(()=>{
  let live=true;let timer:ReturnType<typeof setTimeout>;
  // Honesty law + SELF-OTHER-FIELD-UX "view disposal": a hidden document
  // (backgrounded app, minimized window) pauses network polling rather than
  // spending cycles on a transcript nobody can see. Structural pausing for
  // "collapsed"/"inactive" is the caller's job — it simply does not mount
  // this component while the surface is not the active tab/plane.
  const hidden=()=>document.visibilityState!=="visible";
  const poll=async()=>{
   if(hidden()){if(live)timer=setTimeout(poll,1000);return;}
   try {
    const next=await read();if(!live)return;setReading(next);
    if(!dirty.current&&!saving.current&&!sending.current&&next.draft.revision>=canonical.current.revision){canonical.current=next.draft;input.current=next.draft.text;setDraft(next.draft.text);}
    const current=next.connection ?? await call<EncounterStatus>({action:"status",agent_session:binding.ref!}).catch(()=>undefined);
    if(live)setStatus(current);
   }catch(error){if(live)setError(String(error));}
   if(live)timer=setTimeout(poll,750);
  };
  void call({action:"start"}).then(()=>{if(live){void call<typeof providers>({action:"providers"}).then(rows=>{if(live)setProviders(rows);}).catch(error=>{if(live)setError(String(error));});void poll();}}).catch(error=>{if(live)setError(String(error));});
  const onVisible=()=>{if(live&&!hidden()){clearTimeout(timer);void poll();}};
  document.addEventListener("visibilitychange",onVisible);
  return()=>{live=false;clearTimeout(timer);document.removeEventListener("visibilitychange",onVisible);};
 },[binding.ref,binding.project,before]);
 async function save() {
  if(!allowed("draft")||sending.current||saving.current||failed.current||!dirty.current)return;
  saving.current=true;setPending(true);
  try {
   while(dirty.current) {
    const text=input.current;
    const accepted=await call<Draft>({action:"draft",agent_session:binding.ref!,basis:canonical.current.revision,text});
    canonical.current=accepted;dirty.current=input.current!==text;
   }
  }catch(error){failed.current=true;setError(`${String(error)} Your unsaved typing is still here.`);}
  finally{saving.current=false;setPending(false);}
 }
 const change=(text:string)=>{if(!allowed("draft"))return;input.current=text;dirty.current=true;setDraft(text);void save();};
 const connect=async(provider:string)=>{
  if(!allowed("open"))return;
  setPending(true);setError(undefined);
  try{await call({action:"open",space:binding.encounter!.space,agent_session:binding.ref!,provider});setStatus(await call<EncounterStatus>({action:"status",agent_session:binding.ref!}));}
  catch(error){
   // The owner's own law: a recorded native session exists, so a fresh open
   // is refused and only an explicit reconnect may resume it.
   if(alive.current&&String(error).includes("encounter.resume_required"))setResume({provider});
   if(alive.current)setError(String(error));
  }finally{setPending(false);}
 };
 const send=async()=>{
  if(!allowed("prompt")||dirty.current||saving.current||sending.current||failed.current)return;
  sending.current=true;const submitted=input.current;setPending(true);setError(undefined);
  try{const response=await call<{draft:Draft}>({action:"prompt",agent_session:binding.ref!,draft_revision:canonical.current.revision});canonical.current=response.draft;if(input.current===submitted){input.current=response.draft.text;setDraft(response.draft.text);}else{dirty.current=true;}setStatus(await call<EncounterStatus>({action:"status",agent_session:binding.ref!}));}
  catch(error){setError(String(error));}finally{sending.current=false;setPending(false);void save();}
 };
 const recover=async()=>{try{const next=await read();canonical.current=next.draft;failed.current=false;dirty.current=input.current!==next.draft.text;setError(undefined);await save();}catch(error){setError(String(error));}};
 const permission=async(request_id:string,decision:PermissionDecision)=>{if(!allowed("permission"))return;setPending(true);setError(undefined);try{await call({action:"permission",agent_session:binding.ref!,request_id,decision});const next=await read();setReading(next);setStatus(next.connection);}catch(error){setError(String(error));}finally{setPending(false);}};
 // --- Addressed dispatch (6B): explicit machine turns, never the human draft. ---
 const alive=useRef(true);useEffect(()=>()=>{alive.current=false;},[]);
 const [dispatch,setDispatch]=useState<DispatchState>({kind:"idle"});
 const [addressedHistory,setAddressedHistory]=useState<DeliveryHistoryEntry[]>([]);
 const [service,setService]=useState<{running:boolean;pid?:number;detail?:string}>();
 const probe=async()=>{try{const health=await call<{protocol:string;pid:number}>({action:"health"});if(alive.current)setService({running:true,pid:health.pid});}catch(error){if(alive.current)setService({running:false,detail:String(error)});}};
 useEffect(()=>{void probe();},[binding.ref,binding.project]);
 const track=async(ref:string)=>{
  const deadline=Date.now()+20000;
  while(alive.current&&Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,900));
   if(!alive.current||document.visibilityState!=="visible")continue;
   let record:DeliveryRecord|undefined;
   try{record=await call<DeliveryRecord>({action:"delivery",agent_session:binding.ref!,delivery_ref:ref});}catch{continue;}
   if(!record||!alive.current)return;
   setDispatch({kind:"running",ref,phase:record.phase});
   if(!ACTIVE_PHASES.includes(record.phase)){setDispatch({kind:"settled",ref,record,duplicate:false});setAddressedHistory(history=>[{ref,record,duplicate:false},...history]);return;}
  }
 };
 const sendAddressed=async(turn:AddressedTurn,_fields:AddressedFields)=>{
  const ref=mintDeliveryRef();
  setDispatch({kind:"running",ref,phase:"preparing"});
  try{
   const receipt=await call<SendReceipt>({action:"send",agent_session:binding.ref!,turn:{...turn,delivery_ref:ref}});
   const record=receipt.delivery;
   if(receipt.duplicate||!ACTIVE_PHASES.includes(record.phase)){
    if(alive.current){setDispatch({kind:"settled",ref,record,duplicate:receipt.duplicate});setAddressedHistory(history=>[{ref,record,duplicate:receipt.duplicate},...history]);}
    return;
   }
   setDispatch({kind:"running",ref,phase:record.phase});
   await track(ref);
  }catch(error){if(alive.current){setDispatch({kind:"refused",ref,error:String(error)});void probe();}}
 };
 // --- Addressed group (6B cut 2): one packet, explicit recipients, whole-group
 // admission owner-side, per-recipient durable results, non-atomic fanout. ---
 const [group,setGroup]=useState<GroupState>();
 const trackRecipient=async(ref:string,session:string,apply:(row:{phase?:string;duplicate?:boolean})=>void)=>{
  const deadline=Date.now()+20000;
  while(alive.current&&Date.now()<deadline){
   await new Promise(resolve=>setTimeout(resolve,900));
   if(!alive.current||document.visibilityState!=="visible")continue;
   let record:DeliveryRecord|undefined;
   try{record=await call<DeliveryRecord>({action:"delivery",agent_session:session,delivery_ref:ref});}catch{continue;}
   if(!record||!alive.current)return;
   apply({phase:record.phase});
   if(!ACTIVE_PHASES.includes(record.phase))return;
  }
 };
 const sendGroup=async(sender:string,recipients:GroupRecipient[],packet:AddressedPacket)=>{
  const ref=mintDeliveryRef();
  setGroup({ref,rows:recipients.map(recipient=>({agentSession:recipient.agent_session,phase:"preparing"}))});
  try{
   const receipt=await call<GroupReceipt>({action:"send-group",delivery_ref:ref,sender,packet,recipients});
   const bySession=new Map(receipt.recipients.map(entry=>[entry.agent_session,entry]));
   const rows=recipients.map(recipient=>{
    const entry=bySession.get(recipient.agent_session);
    if(!entry)return {agentSession:recipient.agent_session,phase:"preparing"};
    if(entry.error)return {agentSession:recipient.agent_session,error:`${entry.error.message} [${entry.error.code}]`};
    return {agentSession:recipient.agent_session,phase:entry.result!.delivery.phase,duplicate:entry.result!.duplicate};
   });
   if(alive.current)setGroup({ref,rows});
   // Still-active recipients are tracked through their own durable delivery
   // receipts — each recipient settles on its own, never as a group.
   await Promise.all(recipients.map(async(recipient,index)=>{
    const entry=bySession.get(recipient.agent_session);
    if(!entry?.result||!ACTIVE_PHASES.includes(entry.result.delivery.phase))return;
    await trackRecipient(ref,recipient.agent_session,row=>{
     if(!alive.current)return;
     setGroup(current=>current?{...current,rows:current.rows.map((existing,existingIndex)=>existingIndex===index?{...existing,...row}:existing)}:current);
    });
   }));
  }catch(error){if(alive.current)setGroup({ref,rows:recipients.map(recipient=>({agentSession:recipient.agent_session,error:String(error)}))});void probe();}
 };
 // --- Reconnect (6B cut 2): resume the actually recorded native session
 // identity after an owner restart; a plain open is refused first by the
 // owner (`encounter.resume_required`) and that refusal is what discloses
 // the recorded session's existence to this window. ---
 const [resume,setResume]=useState<{provider:string}>();
 const [reconnected,setReconnected]=useState<string>();
 const reconnect=async(provider:string)=>{
  setPending(true);setError(undefined);
  try{
   const opened=await call<{native_session_id?:string}>({action:"reconnect",space:binding.encounter!.space,agent_session:binding.ref!,provider});
   if(!alive.current)return;
   setResume(undefined);setReconnected(opened.native_session_id);
   setStatus(await call<EncounterStatus>({action:"status",agent_session:binding.ref!}));
  }catch(error){if(alive.current)setError(String(error));}finally{setPending(false);}
 };
 // --- A2A exchange (wave 7 → the agency panel): the resident's own reply is
 // the bounded passage. Binding, presence, exchange authority and the
 // returned difference are the owner floor's contracts, composed per send —
 // nothing reaches the network until the human's explicit send, exactly as
 // beside the documents. The provenance names the encounter session and the
 // native session the passage actually came from. ---
 const [a2a,setA2a]=useState<{seed?:string;busy:boolean;difference?:A2aDifference;error?:string}>({busy:false});
 const seedA2a=(seed:string)=>setA2a({seed,busy:false});
 const sendA2a=async(seed:string,fields:A2aPeerFields)=>{
  setA2a({seed,busy:true});setPending(true);
  try{
   const slug=fields.peerAgent.trim().replace(/[^a-z0-9]+/gi,"-").toLowerCase()||"peer";
   const nativeSession=status?.native_session_id;
   const a2aBinding=createA2aBinding({
    binding_ref:`a2a-binding:agency-panel:${slug}`,
    field_ref:`field:encounter:${binding.ref}`,
    participant_ref:`participant:a2a:${slug}`,
    agent_ref:fields.peerAgent.trim(),
    publisher_participant_ref:"participant:desktop-operator",
    publication_decision_ref:`decision:agency-panel-send:${Date.now().toString(36)}`,
    source_revision:nativeSession??"desktop-operator",
    published_at:new Date().toISOString(),
    endpoint_url:fields.peerEndpoint.trim(),
    agent_card_url:fields.peerCard.trim(),
    provenance:[{kind:"agency-panel-exchange",ref:`agent-session ${binding.ref}${nativeSession?` · native ${nativeSession}`:""}`,source_system:"oi.cradle"}],
   });
   const a2aPresence=createA2aPresence({
    binding_ref:a2aBinding.binding_ref,field_ref:a2aBinding.field_ref,participant_ref:a2aBinding.participant_ref,
    sequence:1,observed_at:new Date().toISOString(),
    availability:fields.peerAvailability==="offline"?"offline":fields.peerAvailability==="degraded"?"degraded":"online",
    provenance:[{kind:"desktop-operator-observation",ref:"observation:agency-panel-peer",source_system:"oi.cradle"}],
   });
   const difference=await performA2aExchange({
    binding:a2aBinding,presence:a2aPresence,
    initiator_participant_ref:"participant:desktop-operator",
    message:{message_id:`a2a-agency-${Date.now().toString(36)}`,text:seed,purpose:"agency-panel-a2a-exchange"},
    authorize_exchange:async(demand:{operation_id:string})=>({allowed:true,grant_ref:`exchange-grant:agency:${demand.operation_id}`}),
    fetch_impl:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,init),
   }) as unknown as A2aDifference;
   if(alive.current)setA2a({seed,busy:false,difference});
  }catch(err){if(alive.current)setA2a({seed,busy:false,error:String(err)});}
  finally{if(alive.current)setPending(false);}
 };
 return <><EncounterView concealed={concealed} presentation={presentation} plane={binding.view?.encounterPlane??"Conversation"} onPlane={encounterPlane=>onView({encounterPlane})} title={binding.title} onPermission={(id,decision)=>void permission(id,decision)} reading={reading} status={status} draft={draft} pending={pending||dirty.current||saving.current||sending.current||failed.current} error={error} providers={providers} onProvider={provider=>void connect(provider)} onDraft={change} onSend={()=>void send()} onCancel={()=>{if(!allowed("cancel"))return;void call({action:"cancel",agent_session:binding.ref!,reason:"User stopped the encounter"}).catch(error=>setError(String(error)));}} onEarlier={()=>setBefore(reading?.blocks[0]?.id)} onLatest={()=>setBefore(undefined)} readJournal={after=>call<JournalPage>({action:"read",agent_session:binding.ref!,after,limit:32})} space={binding.encounter?.space} deliveries={[...addressedHistory.map(h=>({ref:h.ref,phase:h.record.phase})),...(group?[{ref:group.ref,phase:`group — ${group.rows.map(row=>row.error?"refused":row.phase??"in flight").join(", ")}`}]:[])]}
  resume={resume} onReconnect={provider=>void reconnect(provider)}
  a2a={a2a} onA2aSeed={seedA2a} onA2aSend={(seed,fields)=>void sendA2a(seed,fields)}
  addressed={<AddressedComposer disabled={status?.state==="Disconnected"} dispatch={dispatch} history={addressedHistory} service={service} agentSession={binding.ref??undefined} group={group} onGroupSend={(sender,recipients,packet)=>void sendGroup(sender,recipients,packet)} onSend={(turn,fields)=>void sendAddressed(turn,fields)}/>}
 />{failed.current&&!concealed&&<button onClick={()=>void recover()}>Apply my typing to the current shared draft</button>}{reconnected&&!concealed&&<p className="encounter-reconnected" role="status">Reconnected to the recorded native session <code>{reconnected}</code> — nothing was replaced or silently created.</p>}</>;
}
