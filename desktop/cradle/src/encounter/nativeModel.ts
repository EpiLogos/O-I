/** Harness-native configuration, not the AIKit roster and never execution authority. */
export interface NativeModelOption {modelId:string;name:string;description?:string}
export interface NativeEffort {configId:string;currentValue:string;options:{value:string;name:string;description?:string}[]}
export interface NativeModelObservation {native_provider?:string;current_model_id:string;available_models:NativeModelOption[];reasoning_effort?:NativeEffort;standing:string}
export interface NativeModelReading {
 agent_session:string;native_session_id:string;model_observation:NativeModelObservation|null;
 model_controls?:{model_selection:boolean;reasoning_effort_selection:boolean;reason?:string|null};
 pinned_model_id?:string|null;standing:string;
}
export type NativeModelRequest = {action:"model-read";agent_session:string} | {
 action:"model-select";agent_session:string;provider_model_id:string;provider_reasoning_effort?:string;
 expected_native_session_id:string;
};
export interface NativeModelState {
 phase:"unread"|"reading"|"ready"|"selecting"|"unknown"|"unavailable";
 reading?:NativeModelReading;error?:string;
 /** Selection confirmation is not proof that a model completed any work. */
 confirmed?:{modelId:string;effort?:string};
}
export interface ModelConnection {native_session_id?:string;state:string;error?:string|null;resident?:boolean}
export function connectionReady(status:ModelConnection|undefined):boolean {
 return status?.state==="Resident" && !!status.native_session_id && !status.error && status.resident!==false;
}
export function connectionLabel(status:ModelConnection|undefined):string {
 if(!status)return "Not yet read";
 if(status.error)return "Connection failed";
 switch(status.state){
  case "Resident":return status.native_session_id?"Connected":"Connection unconfirmed";
  case "TurnInFlight":return "Responding…";
  case "InterruptRequested":return "Stopping…";
  case "Disconnected":return "Disconnected";
  default:return `Connection ${status.state || "unknown"}`;
 }
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==="string"&&!!value.trim();
function requireValue(test:unknown,message:string):asserts test {if(!test)throw new Error(message);}
/** Decode the producer's real snake/camel-case contract; do not manufacture options. */
export function readNativeModel(value:unknown,session:string,native:string):NativeModelReading {
 requireValue(object(value)&&value.agent_session===session&&value.native_session_id===native,"Model reading belongs to a different session; read the current session again.");
 requireValue(text(value.standing),"Model reading has no provenance standing.");
 const observation=value.model_observation;
 if(observation!==null){
  requireValue(object(observation)&&text(observation.current_model_id)&&Array.isArray(observation.available_models)&&text(observation.standing),"Unreadable native model observation.");
  const ids=new Set<string>();
  for(const option of observation.available_models){
   requireValue(object(option)&&text(option.modelId)&&text(option.name)&&!ids.has(option.modelId),"Invalid or repeated native model option.");ids.add(option.modelId);
  }
  if(observation.reasoning_effort!==undefined){
   const effort=observation.reasoning_effort;
   requireValue(object(effort)&&effort.configId==="reasoning_effort"&&text(effort.currentValue)&&Array.isArray(effort.options),"Unreadable native reasoning control.");
   const values=new Set<string>();
   for(const option of effort.options){requireValue(object(option)&&text(option.value)&&text(option.name)&&!values.has(option.value),"Invalid native reasoning option.");values.add(option.value);}
   requireValue(values.has(effort.currentValue),"Native reasoning value is not advertised.");
  }
 }
 if(value.model_controls!==undefined){
  const controls=value.model_controls;
  requireValue(object(controls)&&typeof controls.model_selection==="boolean"&&typeof controls.reasoning_effort_selection==="boolean","Unreadable native model capabilities.");
  if(controls.model_selection){requireValue(object(observation)&&Array.isArray(observation.available_models)&&observation.available_models.some(option=>object(option)&&option.modelId===observation.current_model_id),"Writable selector must advertise its current model.");}
 }
 requireValue(value.pinned_model_id===undefined||value.pinned_model_id===null||text(value.pinned_model_id),"Unreadable native model policy pin.");
 return value as unknown as NativeModelReading;
}

/** One non-persistent controller per canonical session, shared by every presenter.
 * A stale read can never supply choices to a new native session. A lost write
 * acknowledgement is unknown, not success/refusal, and is never retried.
 */
export class NativeModelController {
 private call:(request:NativeModelRequest)=>Promise<unknown>;
 private session:string;private changed:(state:NativeModelState)=>void;
 private native?:string;private ready=false;private generation=0;private serial=0;
 private state:NativeModelState={phase:"unread"};
 constructor(session:string,call:(request:NativeModelRequest)=>Promise<unknown>,changed:(state:NativeModelState)=>void){this.session=session;this.call=call;this.changed=changed;}
 snapshot=()=>this.state;
 private set(state:NativeModelState){this.state=state;this.changed(state);}
 observe(status:ModelConnection|undefined){
  const native=status?.native_session_id;
  this.ready=connectionReady(status);
  if(native!==this.native){this.native=native;this.generation++;this.serial++;this.set({phase:"unread"});}
  if(!this.ready&&this.state.phase==="ready")this.set({...this.state,phase:"unavailable",error:"Model controls require a healthy idle native session."});
 }
 async refresh():Promise<void>{
  if(!this.native||!this.ready){this.set({phase:"unavailable",error:"Connect a supported harness and wait for the native session to be ready."});return;}
  if(this.state.phase==="selecting")return;
  const native=this.native,generation=this.generation,serial=++this.serial;
  this.set({...this.state,phase:"reading",error:undefined,confirmed:undefined});
  try{
   const reading=readNativeModel(await this.call({action:"model-read",agent_session:this.session}),this.session,native);
   if(generation!==this.generation||serial!==this.serial)return;
   this.set({phase:this.ready?"ready":"unavailable",reading});
  }catch(error){if(generation===this.generation&&serial===this.serial)this.set({phase:"unavailable",error:String(error)});}
 }
 async select(modelId:string,effort?:string):Promise<void>{
  const reading=this.state.reading,observation=reading?.model_observation;
  const reject=(error:string)=>{this.set({...this.state,error});};
  if(this.state.phase!=="ready"||!this.ready||!reading||reading.native_session_id!==this.native){reject("Read the current idle session before selecting a model.");return;}
  if(!reading.model_controls?.model_selection){reject(reading.model_controls?.reason??"This owner has not advertised a writable model selector.");return;}
  if(!observation?.available_models.some(option=>option.modelId===modelId)){reject("That model was not advertised by this harness.");return;}
  if(reading.pinned_model_id&&reading.pinned_model_id!==modelId){reject("This session's native model policy pins a different model. Change the policy through its owner.");return;}
  if(effort!==undefined&&(!reading.model_controls.reasoning_effort_selection||!observation.reasoning_effort?.options.some(option=>option.value===effort))){reject("That reasoning value was not advertised as writable by this harness.");return;}
  const generation=this.generation,native=reading.native_session_id;this.serial++;
  this.set({...this.state,phase:"selecting",error:undefined,confirmed:undefined});
  try{
   const receipt=await this.call({action:"model-select",agent_session:this.session,expected_native_session_id:native,provider_model_id:modelId,...(effort===undefined?{}:{provider_reasoning_effort:effort})});
   if(generation!==this.generation)return;
   requireValue(object(receipt)&&receipt.agent_session===this.session&&receipt.native_session_id===native&&receipt.selected===true&&receipt.inference_observed===false,"Native selection acknowledgement did not confirm this session.");
   const confirmed=readNativeModel({...receipt,model_controls:reading.model_controls,pinned_model_id:reading.pinned_model_id},this.session,native);
   requireValue(confirmed.model_observation?.current_model_id===modelId&&(effort===undefined||confirmed.model_observation.reasoning_effort?.currentValue===effort),"Native selection acknowledgement did not confirm the requested configuration.");
   this.set({phase:this.ready?"ready":"unavailable",reading:confirmed,confirmed:{modelId,effort}});
  }catch(error){
   if(generation!==this.generation)return;
   this.set({...this.state,phase:"unknown",error:`The configuration outcome is unconfirmed. Do not resend automatically. Read the native session to reconcile. ${String(error)}`});
  }
 }
}
