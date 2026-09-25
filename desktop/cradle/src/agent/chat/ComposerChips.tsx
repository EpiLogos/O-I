import {kernelOp,detectTransport} from "../../kernel/bridge";
import {readModelRoster,modelRosterReason,type ModelRosterReading} from "./modelRoster";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {Glyph} from "../../workspace/Glyph";
import type {NativeModelActions} from "../../encounter/NativeModelControls";
import type {NativeModelState} from "../../encounter/nativeModel";
import {modelChoices,modelSelectionReason} from "./modelPresentation";
import {modeChipLabel,modeClass,modeLabel,orderedModes,type NativeModeState} from "../../encounter/nativeMode";
import {HarnessPicker,type HarnessPickerProps} from "./HarnessPicker";
import {harnessChip,harnessVariant,type ConnectionFacts} from "./harness";

/**
 * The composer's three chips (10-SIDEBARS §4.1): the permission MODE (A2),
 * the HARNESS and the MODEL (A1) — three different things, three menus.
 *
 *   Mode: Ask before acting · Accept edits · Plan only · Bypass permissions,
 *   only the modes the connected harness advertises; ABSENT (not disabled)
 *   when it offers none. Bypass is chosen deliberately behind one line that
 *   names what it allows, and stays marked. A change applies to the next action.
 *   Harness: the harness NAME, never the connection's label (HarnessPicker).
 *   Model: the session's real current model (model-read `current_model_id`);
 *   its menu lists only the harness's `available_models`.
 */
function useMenu(){
 const [open,setOpen]=useState(false);
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:MouseEvent)=>{if(!host.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);}};
  document.addEventListener("mousedown",outside);document.addEventListener("keydown",escape,true);
  return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape,true);};
 },[open]);
 return {open,setOpen,host};
}
function Chip({chip,label,title,open,onToggle,marked,children,icon}:{chip:string;label:string;title:string;open:boolean;onToggle:()=>void;marked?:boolean;children:ReactNode;icon?:ReactNode}) {
 return <>
  <button type="button" className="oi-chip chat-composer-chip" data-chip={chip} data-marked={marked?"true":undefined} aria-haspopup="menu" aria-expanded={open} title={title} onClick={onToggle}>{icon}<span className="chat-composer-chip-label">{label}</span><Glyph name="down" size={9}/></button>
  {open&&<div className="oi-menu chat-chip-menu" role="menu" aria-label={title}>{children}</div>}
 </>;
}

export function ModeChip({mode,agentName,onSelect,disabled,turnRunning}:{mode:NativeModeState;agentName:string;onSelect:(id:string)=>void;disabled?:boolean;
 /** The harness changes mode only between turns; the chip says so. */
 turnRunning?:boolean}) {
 const {open,setOpen,host}=useMenu();
 const [confirming,setConfirming]=useState<string>();
 const observation=mode.reading?.mode_observation;
 // Absent, not disabled, when the harness offers no modes (or none are read yet).
 if(!observation||!observation.available_modes.length)return null;
 const current=observation.available_modes.find(option=>option.id===observation.current_mode_id);
 const bypass=current?modeClass(current.id)==="bypass":false;
 const writable=mode.reading?.mode_controls?.mode_selection!==false;
 const choose=(id:string)=>{
  if(modeClass(id)==="bypass"&&id!==current?.id){setConfirming(id);return;}
  setOpen(false);setConfirming(undefined);if(id!==current?.id)onSelect(id);
 };
 return <div className="chat-chip-host" ref={host} data-chip-host="mode">
  <Chip chip="mode" label={current?modeChipLabel(current):"Permission mode"} title={`Permission mode — ${current?modeLabel(current):"Not disclosed"}${mode.phase==="selecting"?" (changing…)":""}`} open={open} onToggle={()=>{setConfirming(undefined);setOpen(value=>!value);}} marked={bypass} icon={bypass?<ShieldMark/>:undefined}>
   {confirming
    ?<div className="chat-bypass-confirm" role="alertdialog" aria-label="Turn on Bypass permissions">
      <p>Bypass permissions lets {agentName} edit files and run commands without asking you first, from its next action.</p>
      <div className="oi-action-group"><button type="button" className="oi-action" data-primary="true" onClick={()=>{const id=confirming;setConfirming(undefined);setOpen(false);onSelect(id);}}>Turn on Bypass</button><button type="button" className="oi-action" onClick={()=>setConfirming(undefined)}>Cancel</button></div>
     </div>
    :<>
      {orderedModes(observation.available_modes).map(option=><button key={option.id} type="button" role="menuitemradio" aria-checked={option.id===observation.current_mode_id} className="oi-menu-item chat-mode-item" disabled={disabled||turnRunning||!writable||mode.phase==="selecting"} onClick={()=>choose(option.id)}>
       <span className="chat-mode-name">{modeLabel(option)}{option.id===observation.current_mode_id&&<Glyph name="check" size={11}/>}</span>
       {option.description&&<span className="chat-mode-description">{option.description}</span>}
      </button>)}
      {!writable&&<p className="oi-note chat-chip-note">{mode.reading?.mode_controls?.reason??"This harness does not let its mode be changed here."}</p>}
      <p className="oi-note chat-chip-note">{turnRunning?"The mode can change when this turn ends.":"Applies to the next action."}</p>
     </>}
  </Chip>
  {mode.error&&mode.phase!=="unavailable"&&<span className="sr-only" role="alert">{mode.error}</span>}
 </div>;
}

export function ShieldMark({size=11}:{size?:number}) {
 return <svg className="shield-mark" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/></svg>;
}

export function HarnessChip({current,picker}:{current:ConnectionFacts;picker:Omit<HarnessPickerProps,"currentId">}) {
 const {open,setOpen,host}=useMenu();
 const name=harnessChip(current);
 const variant=harnessVariant(current);
 return <div className="chat-chip-host" ref={host} data-chip-host="harness">
  <Chip chip="harness" label={name} title={`Harness — ${name}${variant?` (${variant})`:""}`} open={open} onToggle={()=>setOpen(value=>!value)} icon={variant?<span className="chat-chip-badge">{variant}</span>:undefined}>
   <HarnessPicker {...picker} currentId={current.id} onChoose={id=>{setOpen(false);picker.onChoose(id);}} resume={picker.resume?{...picker.resume,onResume:()=>{setOpen(false);picker.resume!.onResume();}}:undefined}/>
  </Chip>
 </div>;
}

export function ModelChip({model,actions,disabled,project}:{model:NativeModelState;actions:NativeModelActions;disabled?:boolean;project?:string}) {
 const {open,setOpen,host}=useMenu();
 useEffect(()=>{if(model.phase==="unread")void actions.refresh();},[actions,model.phase]);
 const [roster,setRoster]=useState<ModelRosterReading>();
 useEffect(()=>{setRoster(undefined);if(!open)return;let current=true;void kernelOp(detectTransport(),{op:"model_roster",project}).then(result=>{if(current&&result.outcome?.result==="model_roster_reading")setRoster(readModelRoster(result.outcome.reading));});return()=>{current=false;};},[open,project]);
 const observation=model.reading?.model_observation;
 const options=modelChoices(observation?.available_models??[]);
 const current=options.find(option=>option.modelId===observation?.current_model_id);
 const reason=modelSelectionReason(model,disabled);
 const label=current?.name??"Model unavailable";
 const writable=model.phase==="ready"&&model.reading?.model_controls?.model_selection===true&&!disabled;
 const pinned=model.reading?.pinned_model_id;
 return <div className="chat-chip-host" ref={host} data-chip-host="model">
  <Chip chip="model" label={label} title={`Model — ${label}${reason?` · ${reason}`:""}${model.phase==="unknown"?" (change unconfirmed)":""}`} open={open} onToggle={()=>setOpen(value=>!value)} marked={model.phase==="unknown"}>
   {options.map(option=><button key={option.modelId} type="button" role="menuitemradio" aria-checked={option.modelId===observation?.current_model_id} className="oi-menu-item chat-model-item" disabled={!writable||(!!pinned&&option.modelId!==pinned)} title={option.description} onClick={()=>{setOpen(false);if(option.modelId!==observation?.current_model_id)void actions.select(option.modelId);}}>
    <span>{option.name}{modelRosterReason(option,roster)&&<small className="chat-mode-description">{modelRosterReason(option,roster)}</small>}</span>{option.modelId===observation?.current_model_id&&<Glyph name="check" size={11}/>}
   </button>)}
   {!options.length&&<p className="oi-note chat-chip-note">The harness lists no other models.</p>}
   {reason&&<p className="oi-note chat-chip-note">{reason}</p>}
   {model.error&&<p className="oi-refusal chat-chip-note" role="alert">{model.error}</p>}
   {(model.phase==="unknown"||model.phase==="unavailable")&&<button type="button" role="menuitem" className="oi-menu-item" onClick={()=>void actions.refresh()}>Read the session again</button>}
   {model.confirmed&&!model.error&&<p className="oi-note chat-chip-note" role="status">Set for this session. No model turn has run on it yet.</p>}
  </Chip>
 </div>;
}
