/**
 * Native session PERMISSION MODES (10-SIDEBARS §4.1, amendment A2): the modes
 * the connected harness itself advertises (ACP session modes — Claude Code's
 * default / acceptEdits / plan / bypassPermissions, Hermes' default /
 * accept_edits / dont_ask), read and set through the owner's `mode-read` /
 * `mode-select` exactly like model-read / model-select (nativeModel.ts).
 *
 * One non-persistent controller per session, shared by every presenter. A
 * stale read never supplies choices to a new native session; a lost write
 * acknowledgement is unknown — never success, never retried. A harness that
 * offers no modes reads `mode_observation: null`: the chip is absent.
 */
import {connectionReady,type ModelConnection} from "./nativeModel";

export interface NativeModeOption {id:string;name:string;description?:string|null}
export interface NativeModeObservation {current_mode_id:string;available_modes:NativeModeOption[]}
export interface NativeModeReading {agent_session:string;native_session_id:string;mode_observation:NativeModeObservation|null;mode_controls?:{mode_selection:boolean;reason?:string|null};standing:string}
export type NativeModeRequest = {action:"mode-read";agent_session:string} | {action:"mode-select";agent_session:string;provider_mode_id:string;expected_native_session_id:string};
export interface NativeModeState {
 phase:"unread"|"reading"|"ready"|"selecting"|"unknown"|"unavailable";
 reading?:NativeModeReading;error?:string;
 /** Confirmed for the next action — not proof any action ran under it. */
 confirmed?:string;
}

/** The chip's words for the modes the design names; any other mode keeps the harness's own name. */
export type PermissionModeClass = "ask"|"accept-edits"|"plan"|"bypass"|"other";
const CLASS_BY_ID:Record<string,PermissionModeClass>={
 default:"ask",ask:"ask",
 acceptedits:"accept-edits",accept_edits:"accept-edits","accept-edits":"accept-edits",
 plan:"plan",
 bypasspermissions:"bypass",bypass_permissions:"bypass","bypass-permissions":"bypass",bypass:"bypass",yolo:"bypass",
};
const LABEL:Record<Exclude<PermissionModeClass,"other">,string>={ask:"Ask before acting","accept-edits":"Accept edits",plan:"Plan only",bypass:"Bypass permissions"};
const SHORT:Record<Exclude<PermissionModeClass,"other">,string>={ask:"Ask","accept-edits":"Accept edits",plan:"Plan",bypass:"Bypass"};
export function modeClass(id:string):PermissionModeClass {return CLASS_BY_ID[id.toLowerCase()]??"other";}
export function modeLabel(option:NativeModeOption):string {const c=modeClass(option.id);return c==="other"?option.name:LABEL[c];}
export function modeChipLabel(option:NativeModeOption):string {const c=modeClass(option.id);return c==="other"?option.name:SHORT[c];}
/** The order the design lists them in; the harness's own others follow in its order. */
export function orderedModes(options:NativeModeOption[]):NativeModeOption[] {
 const rank=(option:NativeModeOption)=>["ask","accept-edits","plan","bypass","other"].indexOf(modeClass(option.id));
 return options.map((option,index)=>({option,index})).sort((a,b)=>rank(a.option)-rank(b.option)||a.index-b.index).map(entry=>entry.option);
}

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==="string"&&!!value.trim();
function requireValue(test:unknown,message:string):asserts test {if(!test)throw new Error(message);}
export function readNativeMode(value:unknown,session:string,native:string):NativeModeReading {
 requireValue(object(value)&&value.agent_session===session&&value.native_session_id===native,"Mode reading belongs to a different session; read the current session again.");
 const observation=value.mode_observation;
 if(observation!==null&&observation!==undefined){
  requireValue(object(observation)&&text(observation.current_mode_id)&&Array.isArray(observation.available_modes),"Unreadable native mode observation.");
  const ids=new Set<string>();
  for(const option of observation.available_modes){requireValue(object(option)&&text(option.id)&&text(option.name)&&!ids.has(option.id),"Invalid or repeated native mode option.");ids.add(option.id);}
  requireValue(ids.has(observation.current_mode_id),"The native session's current mode is not one it advertised.");
 }
 if(value.mode_controls!==undefined)requireValue(object(value.mode_controls)&&typeof value.mode_controls.mode_selection==="boolean","Unreadable native mode capabilities.");
 return {...(value as unknown as NativeModeReading),mode_observation:(observation??null) as NativeModeObservation|null};
}

export class NativeModeController {
 private native?:string;private ready=false;private generation=0;private serial=0;
 private state:NativeModeState={phase:"unread"};
 constructor(private session:string,private call:(request:NativeModeRequest)=>Promise<unknown>,private changed:(state:NativeModeState)=>void){}
 snapshot=()=>this.state;
 private set(state:NativeModeState){this.state=state;this.changed(state);}
 observe(status:ModelConnection|undefined){
  const native=status?.native_session_id;
  const wasReady=this.ready;this.ready=connectionReady(status);
  if(native!==this.native){this.native=native;this.generation++;this.serial++;this.set({phase:"unread"});}
  // Modes stay readable while a turn runs (the chip shows the session's
  // mode at a glance); a changed mode applies to the next action.
  if(this.ready&&!wasReady&&this.state.phase==="unread")void this.refresh();
 }
 async refresh():Promise<void>{
  if(!this.native){this.set({phase:"unavailable",error:"Connect a harness to read its permission modes."});return;}
  if(this.state.phase==="selecting")return;
  const native=this.native,generation=this.generation,serial=++this.serial;
  this.set({...this.state,phase:"reading",error:undefined});
  try{
   const reading=readNativeMode(await this.call({action:"mode-read",agent_session:this.session}),this.session,native);
   if(generation!==this.generation||serial!==this.serial)return;
   this.set({phase:"ready",reading,confirmed:this.state.confirmed});
  }catch(error){if(generation===this.generation&&serial===this.serial)this.set({phase:"unavailable",error:String(error)});}
 }
 async select(modeId:string):Promise<void>{
  const reading=this.state.reading,observation=reading?.mode_observation;
  const reject=(error:string)=>this.set({...this.state,error});
  if(this.state.phase!=="ready"||!reading||reading.native_session_id!==this.native){reject("Read the session's permission modes before changing them.");return;}
  if(reading.mode_controls&&!reading.mode_controls.mode_selection){reject(reading.mode_controls.reason??"This harness does not let its permission mode be changed here.");return;}
  if(!observation?.available_modes.some(option=>option.id===modeId)){reject("That mode was not offered by this harness.");return;}
  const generation=this.generation,native=reading.native_session_id;this.serial++;
  this.set({...this.state,phase:"selecting",error:undefined,confirmed:undefined});
  try{
   const receipt=await this.call({action:"mode-select",agent_session:this.session,provider_mode_id:modeId,expected_native_session_id:native});
   if(generation!==this.generation)return;
   requireValue(object(receipt)&&receipt.agent_session===this.session&&receipt.native_session_id===native&&receipt.selected===true,"The harness's acknowledgement did not confirm this session.");
   const confirmed=readNativeMode({...receipt,mode_controls:reading.mode_controls},this.session,native);
   requireValue(confirmed.mode_observation?.current_mode_id===modeId,"The harness's acknowledgement did not confirm the requested mode.");
   this.set({phase:"ready",reading:confirmed,confirmed:modeId});
  }catch(error){
   if(generation!==this.generation)return;
   this.set({...this.state,phase:"unknown",error:`Whether the mode changed is unconfirmed. It is not resent automatically; read the session again to reconcile. ${String(error)}`});
  }
 }
}
