/** Nara's application binding to the EXISTING AIKit addressed encounter.
 * No Agent/Agency/AgentSession is created here. Provider events and delivery
 * cursors, not UI timers or transcript placeholders, establish a response.
 */
import type {EncounterRequest, EncounterReading, JournalPage, SendReceipt} from "../encounter/client";
import {validateDialogueContext, type NaraDialogueContext} from "./dialogueContext";
import {validateSpeechConstitution, type SpeechConstitutionFacts} from "./constitution";
import {exactKeys, noSecretMaterialKeys, wireText} from "./support";

export interface NativeDialogueBinding {
  project:string; space:string; agent_session:string; provider:string;
  sender:string; expected_binding_revision:string; expected_task?:unknown;
}
export interface SpeechRoute {
  endpoint:string; model:string; provider_ref:string; source_ref:string; revision:string;
}
export interface CascadeRoutes {
  kind:"http-stt-text-tts";
  stt:SpeechRoute;
  tts:SpeechRoute & {voice:string};
}
/** An O:I attachment is a selection of native documents, NOT their owner.
 * Kept in protected Central source, never in a public corpus or localStorage.
 * Refuse dirty/unversioned source at the loading boundary in NaraSurface.
 */
export interface NaraAttachment {
  schema:"oi.nara-attachment/v1";
  context:NaraDialogueContext;
  constitution:SpeechConstitutionFacts;
  dialogue:NativeDialogueBinding;
  epii?:NativeDialogueBinding & {agent_ref:string};
  speech?:CascadeRoutes;
}
export type EncounterCall = <T>(binding:NativeDialogueBinding, request:EncounterRequest)=>Promise<T>;
export interface NativeTurnResult {delivery_ref:string; agent_session:string; text:string; first_cursor:number; terminal_cursor:number}
export class NativeTurnError extends Error {
  readonly delivery_ref:string;
  readonly terminal:boolean;
  readonly cause:unknown;
  constructor(message:string, delivery:string, terminal=false, cause?:unknown) {super(message);this.name="NativeTurnError";this.delivery_ref=delivery;this.terminal=terminal;this.cause=cause;}
}
export function abortCheck(signal:AbortSignal):void {if(signal.aborted)throw new DOMException("Operation interrupted", "AbortError");}
export function pause(ms:number, signal:AbortSignal):Promise<void> {
  return new Promise((resolve,reject)=>{
    abortCheck(signal);
    const stop=()=>{clearTimeout(timer);signal.removeEventListener("abort",stop);reject(new DOMException("Operation interrupted","AbortError"));};
    const timer=setTimeout(()=>{signal.removeEventListener("abort",stop);resolve();},ms);
    signal.addEventListener("abort",stop,{once:true});
  });
}
export function localSpeechEndpoint(value:string):string {
  const u=new URL(wireText(value,"speech endpoint"));
  if(!["http:","https:"].includes(u.protocol)||!["127.0.0.1","localhost","[::1]"].includes(u.hostname)||u.username||u.password||u.search||u.hash)
    throw new Error("This HTTP cascade adapter accepts credential-free loopback endpoints only; remote/realtime bodies require their admitted transport adapter");
  return u.href;
}
function nativeBinding(value:NativeDialogueBinding):NativeDialogueBinding {
  for(const key of ["project","space","agent_session","provider","sender","expected_binding_revision"] as const)wireText(value[key],key);
  if(!value.agent_session.startsWith("agent-session/"))throw new Error("A native AgentSession reference is required, not a renderer-created identity");
  return value;
}
export function validateAttachment(input:unknown):NaraAttachment {
  const a=structuredClone(exactKeys(input,["schema","context","constitution","dialogue","epii","speech"],"Nara attachment")) as unknown as NaraAttachment;
  if(a.schema!=="oi.nara-attachment/v1")throw new Error("Unsupported Nara attachment");
  noSecretMaterialKeys(a,"Nara attachment");
  validateDialogueContext(a.context);validateSpeechConstitution(a.constitution);nativeBinding(a.dialogue);
  if(a.context.agent_session_ref!==a.dialogue.agent_session||a.constitution.agent_session_ref!==a.dialogue.agent_session)
    throw new Error("Native dialogue, QL context and speech constitution must name the same AgentSession");
  if(a.epii){nativeBinding(a.epii);wireText(a.epii.agent_ref,"Epii AgentRef");
    if(a.epii.agent_ref===a.constitution.agent_ref||a.epii.agent_session===a.dialogue.agent_session)throw new Error("Epii is a distinct Agent and AgentSession");}
  if(a.speech){
    if(a.speech.kind!=="http-stt-text-tts")throw new Error("No executable transport adapter is bound for this speech body");
    for(const route of [a.speech.stt,a.speech.tts]){
      localSpeechEndpoint(route.endpoint);
      for(const k of ["model","provider_ref","source_ref","revision"] as const)wireText(route[k],k);
    }
    wireText(a.speech.tts.voice,"voice");
    if(!a.constitution.input_modalities.some(x=>x==="audio"||x==="speech")||!a.constitution.output_modalities.some(x=>x==="audio"||x==="speech"))
      throw new Error("The constituted body does not disclose both acoustic directions");
    if(a.constitution.conditions?.some(c=>c.condition==="unavailable"))throw new Error("The constituted speech body is unavailable");
  }
  return a;
}
export function sameEncounter(a:NaraAttachment,b:NaraAttachment):boolean {
  return a.context.nara_ref===b.context.nara_ref&&a.context.subject_ref===b.context.subject_ref&&a.context.expression_ref===b.context.expression_ref&&
    a.dialogue.project===b.dialogue.project&&a.dialogue.space===b.dialogue.space&&a.dialogue.agent_session===b.dialogue.agent_session&&
    a.constitution.agent_ref===b.constitution.agent_ref&&a.constitution.agency_ref===b.constitution.agency_ref&&a.constitution.world_binding_ref===b.constitution.world_binding_ref;
}
export async function readNativeSession(call:EncounterCall,binding:NativeDialogueBinding):Promise<EncounterReading> {
  const view=await call<EncounterReading>(binding,{action:"view",agent_session:binding.agent_session});
  if(view.agent_session!==binding.agent_session||view.schema!=="aikit.encounter-view/v1")throw new Error("Native encounter returned a different or unsupported session reading");
  if(view.connection?.resident&&view.connection.provider?.id!==binding.provider)throw new Error("Native session has another provider binding");
  return view;
}
export async function requireNativeReady(call:EncounterCall,binding:NativeDialogueBinding):Promise<EncounterReading> {
  const view=await readNativeSession(call,binding);
  if(view.connection?.resident!==true||view.connection.state!=="Resident"||view.connection.error)
    throw new Error(`Native session is not ready (${view.connection?.state??"unknown"}); reconnect the existing session explicitly`);
  return view;
}
/** Only the *explicitly permitted* context enters an addressed packet.
 * Pointer/selection may name a subject; it never causes a source body read.
 */
export function dialoguePacket(text:string,context:NaraDialogueContext):{text:string;source_refs:string[]} {
  const c=validateDialogueContext(structuredClone(context));
  if(!text.trim()||text.length>16384)throw new Error("A bounded non-empty dialogue turn is required");
  const refs=new Set(c.disclosed.map(d=>d.ref_id));
  return {text:JSON.stringify({request:text,context:c}),source_refs:[...refs]};
}
/** Delivery-scoped stream fold. Raw provider thoughts/tool payloads never
 * become spoken text. A cursor is an event cursor, not a view block id.
 */
export class ResponseFold {
  cursor:number; text=""; ended=false;
  private readonly deliveryRef:string;
  constructor(firstCursor:number,deliveryRef:string){if(!Number.isSafeInteger(firstCursor)||firstCursor<0)throw new Error("Invalid delivery cursor");this.cursor=firstCursor;this.deliveryRef=wireText(deliveryRef,"delivery ref");}
  accept(page:JournalPage,session:string,terminal?:number|null):void {
    if(page.agent_session!==session)throw new Error("Journal belongs to another AgentSession");
    for(const item of page.events){
      if(this.ended)break;
      if(!Number.isSafeInteger(item.cursor)||item.cursor<=this.cursor)throw new Error("Non-monotonic delivery cursor");
      if(terminal!=null&&item.cursor>terminal)break;
      this.cursor=item.cursor;
      const event=item.event as {kind?:string;delivery_ref?:string;event?:{Signal?:{kind?:{kind?:string;text?:unknown}};TurnEnded?:unknown}};
      // Native attribution, not position/proximity in the journal, owns the turn.
      if(event?.kind!=="provider"||event.delivery_ref!==this.deliveryRef)continue;
      const part=event?.event?.Signal?.kind;
      if(part?.kind==="agent-message-chunk"){
        if(typeof part.text!=="string")throw new Error("Malformed native response chunk");
        if(this.text.length+part.text.length>262144)throw new Error("Native response exceeds the bounded dialogue limit");
        this.text+=part.text;
      }
      if(event?.event?.TurnEnded)this.ended=true;
    }
  }
}
/** Real native delivery. A lost ACK is uncertain; never replay a new turn.
 * Recovery reads this same delivery_ref through readDelivery, without send.
 */
export async function nativeTurn(input:{call:EncounterCall;binding:NativeDialogueBinding;audience:string;text:string;source_refs:string[];signal:AbortSignal;delivery_ref:string;onDispatch?:()=>void;onText?:(text:string)=>void;timeoutMs?:number;pollMs?:number}):Promise<NativeTurnResult> {
  const {call,binding,signal,delivery_ref}=input;
  await requireNativeReady(call,binding);abortCheck(signal);
  let receipt:SendReceipt;
  input.onDispatch?.();
  try{receipt=await call<SendReceipt>(binding,{action:"send",agent_session:binding.agent_session,turn:{
    delivery_ref,sender:binding.sender,expected_binding_revision:binding.expected_binding_revision,...(binding.expected_task?{expected_task:binding.expected_task}:{}),
    packet:{text:input.text,source_refs:input.source_refs,audience:[input.audience]},
  }});}catch(cause){throw new NativeTurnError("Native delivery outcome is unknown; recover the same delivery before any retry",delivery_ref,false,cause);}
  abortCheck(signal);
  if(!receipt.delivery)throw new NativeTurnError("Native delivery returned no durable receipt",delivery_ref);
  return readDelivery({...input,initial:receipt.delivery});
}
export async function readDelivery(input:{call:EncounterCall;binding:NativeDialogueBinding;signal:AbortSignal;delivery_ref:string;initial?:SendReceipt["delivery"];onText?:(text:string)=>void;timeoutMs?:number;pollMs?:number}):Promise<NativeTurnResult> {
  const {call,binding,signal,delivery_ref}=input;
  const deadline=Date.now()+(input.timeoutMs??120000);
  let delivery=input.initial??await call<SendReceipt["delivery"]|null>(binding,{action:"delivery",agent_session:binding.agent_session,delivery_ref});
  if(!delivery)throw new NativeTurnError("No durable receipt was found; no request was replayed",delivery_ref);
  validateDelivery(delivery,binding,delivery_ref);
  const first=delivery.first_cursor, fold=new ResponseFold(first,delivery_ref);
  while(Date.now()<deadline){
    abortCheck(signal);
    if(["failed","cancelled","reconciled-no-replay"].includes(delivery.phase))throw new NativeTurnError(`Native delivery ${delivery.phase}; no speech was manufactured`,delivery_ref,true);
    const page=await call<JournalPage>(binding,{action:"read",agent_session:binding.agent_session,after:fold.cursor,limit:100});
    abortCheck(signal);fold.accept(page,binding.agent_session,delivery.terminal_cursor);input.onText?.(fold.text);
    if(delivery.phase==="returned"&&delivery.terminal_cursor!=null&&fold.ended&&fold.cursor===delivery.terminal_cursor){
      if(!fold.text.trim())throw new NativeTurnError("Provider completed without response text",delivery_ref,true);
      return {delivery_ref,agent_session:binding.agent_session,text:fold.text,first_cursor:first,terminal_cursor:delivery.terminal_cursor};
    }
    // A completed turn boundary prevents later sessions/turns contaminating
    // this response while its final receipt is still being committed.
    if(!page.more||fold.ended)await pause(input.pollMs??150,signal);
    delivery=await call<SendReceipt["delivery"]>(binding,{action:"delivery",agent_session:binding.agent_session,delivery_ref});
    if(!delivery||delivery.first_cursor!==first)throw new NativeTurnError("Delivery receipt changed identity",delivery_ref);
    validateDelivery(delivery,binding,delivery_ref);
  }
  throw new NativeTurnError("Native response timed out; outcome retained for explicit recovery, never replayed",delivery_ref);
}

function validateDelivery(value:SendReceipt["delivery"],binding:NativeDialogueBinding,ref:string):void {
  const d=value as SendReceipt["delivery"] & {agent_session?:string;delivery_ref?:string};
  if(d.agent_session!==binding.agent_session||d.delivery_ref!==ref||d.sender!==binding.sender)throw new NativeTurnError("Delivery receipt belongs to another participant or turn",ref);
  if(!Number.isSafeInteger(d.first_cursor)||d.first_cursor<0||(d.terminal_cursor!=null&&(!Number.isSafeInteger(d.terminal_cursor)||d.terminal_cursor<=d.first_cursor)))throw new NativeTurnError("Malformed native delivery cursor",ref);
}
