import {kernelOp,detectTransport} from "../../kernel/bridge";
import {readModelRoster,modelRosterReason,type ModelRosterReading} from "./modelRoster";
import {modelDisplayName} from "./modelPresentation";
import type {EncounterStatus} from "../../encounter/client";
import {connectionLabel} from "../../encounter/nativeModel";
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

export function ModelChip({model,actions,disabled,project,route,onSetup}:{model:NativeModelState;actions:NativeModelActions;disabled?:boolean;project?:string;
 /** Footer slot for the connection's harness routes (the approved model-first
  * composer: one model control in the row; route switching folds in here). */
 route?:ReactNode;onSetup?:()=>void}) {
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
   {(route||onSetup)&&<div className="menu-rule" role="separator"/>}
   {route}
   {onSetup&&<button type="button" role="menuitem" className="oi-menu-item" onClick={onSetup}>Harness, model or credential setup…</button>}
  </Chip>
 </div>;
}

/** The held model choice for a conversation that does not exist yet: the
 * roster-backed intent the first send carries into provisioning and then
 * applies through the session's own native model-select route (A1). */
export interface ModelIntent {model:string;provider:string;variant:string;harness?:string;label:string;providerLabel?:string}
const MODEL_INTENT_KEY="oi-chat-model-intent";
export const readModelIntent=():ModelIntent|undefined=>{
 try{const raw=localStorage.getItem(MODEL_INTENT_KEY);if(!raw)return undefined;
  const value=JSON.parse(raw) as ModelIntent;
  return value&&typeof value.model==="string"&&typeof value.provider==="string"&&typeof value.variant==="string"&&typeof value.label==="string"?value:undefined;
 }catch{return undefined;}
};
export const writeModelIntent=(intent:ModelIntent|undefined)=>{try{if(intent)localStorage.setItem(MODEL_INTENT_KEY,JSON.stringify(intent));else localStorage.removeItem(MODEL_INTENT_KEY);}catch{/* per-viewer convenience only */}};

interface RosterCandidate extends ModelIntent {eligible:boolean;note?:string}

/** The fresh chat's model chip: real usable models from the native AIKit
 * roster and route facts, one deliberate choice, held until a conversation
 * can carry it. Setup lives behind its footer entry — never an inventory of
 * harness names in the composer (the approved study's model-first control). */
export function FreshModelChip({intent,onChoose,onSetup,disabled,project}:{intent?:ModelIntent;onChoose:(intent:ModelIntent)=>void;onSetup?:()=>void;disabled?:boolean;project?:string}) {
 const {open,setOpen,host}=useMenu();
 const [query,setQuery]=useState("");
 const [candidates,setCandidates]=useState<RosterCandidate[]>();
 const [error,setError]=useState<string>();
 useEffect(()=>{if(!open)return;let current=true;setQuery("");
  void kernelOp(detectTransport(),{op:"model_roster",project}).then(result=>{
   if(!current)return;
   if(result.outcome?.result!=="model_roster_reading"){setError("The model roster could not be read.");return;}
   const reading=readModelRoster(result.outcome.reading);
   if(!reading){setError("The model roster could not be read.");return;}
   const rows:RosterCandidate[]=[];
   for(const route of reading.route_facts){
    if(route.availability.state!=="observed")continue;
    const entries=reading.roster.entries.filter(entry=>entry.model===route.model&&entry.provider===route.provider&&entry.variant===route.variant);
    if(!entries.length)continue;
    const eligible=entries.some(entry=>entry.explanation.eligible);
    const note=eligible?undefined:entries.map(entry=>entry.explanation.failed_gates.join(" · ")).filter(Boolean).join(" · ")||undefined;
    rows.push({model:route.model,provider:route.provider,variant:route.variant,harness:route.harness??undefined,
     label:modelDisplayName(route.model)??route.model,providerLabel:modelDisplayName(route.provider)??route.provider,eligible,note});
   }
   const seen=new Set<string>();
   setCandidates(rows.filter(row=>{const key=`${row.model}\u0000${row.provider}\u0000${row.variant}`;if(seen.has(key))return false;seen.add(key);return true;}));
  }).catch(reason=>{if(current)setError(String(reason instanceof Error?reason.message:reason));});
  return()=>{current=false;};
 },[open,project]);
 const matches=candidates?.filter(row=>!query||`${row.label} ${row.providerLabel} ${row.harness??""}`.toLowerCase().includes(query.toLowerCase()))??[];
 return <div className="chat-chip-host" ref={host} data-chip-host="model" data-fresh="true">
  <Chip chip="model" label={intent?intent.label:"Model"} title={intent?`Model for the next conversation — ${intent.label} (${intent.providerLabel})`:"Model for the next conversation — choose from the project's model roster"} open={open} onToggle={()=>setOpen(value=>!value)}>
   <div className="chat-model-search"><Glyph name="search" size={11}/><input aria-label="Search models" placeholder="Choose a model…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
   {matches.map(row=><button key={`${row.model}/${row.provider}/${row.variant}`} type="button" role="menuitemradio" aria-checked={!!intent&&row.model===intent.model&&row.provider===intent.provider&&row.variant===intent.variant} className="oi-menu-item chat-model-item" disabled={disabled||!row.eligible} title={row.note??`${row.providerLabel}${row.harness?` · ${row.harness}`:""}`} onClick={()=>{setOpen(false);onChoose({model:row.model,provider:row.provider,variant:row.variant,harness:row.harness,label:row.label,providerLabel:row.providerLabel});}}>
    <span>{row.label}{row.note&&<small className="chat-mode-description">{row.note}</small>}</span>
    {intent&&row.model===intent.model&&row.provider===intent.provider&&row.variant===intent.variant
      ?<Glyph name="check" size={11}/>
      :<span className="chat-model-provider">{row.providerLabel}{row.harness?` · ${row.harness}`:""}</span>}
   </button>)}
   {candidates&&!matches.length&&<p className="oi-note chat-chip-note">No roster model matches.</p>}
   {!candidates&&!error&&<p className="oi-note chat-chip-note">Reading the model roster…</p>}
   {error&&<p className="oi-refusal chat-chip-note" role="alert">{error}</p>}
   {!candidates?.some(row=>row.eligible)&&candidates?.length?<p className="oi-note chat-chip-note">No model is eligible in this project's roster yet.</p>:null}
   <div className="menu-rule" role="separator"/>
   {onSetup&&<button type="button" role="menuitem" className="oi-menu-item" onClick={onSetup}>Harness, model or credential setup…</button>}
   <p className="oi-note chat-chip-note">{intent?"Held for the next conversation; it is selected on the conversation itself before your first message is sent.":"No model held — the conversation opens with the project's default."}</p>
  </Chip>
 </div>;
}

/** The connected conversation's route state in one control (disconnected or
 * mid-reconnect): the grouped harness routes, resume and setup — the compact
 * successor of the old standing "Connect with …" chip strip. */
export function ConnectionChip({status,providers,resume,onProvider,onReconnect,onSetup,disabled,reason}:{status?:EncounterStatus;providers:ConnectionFacts[];resume?:{provider:string};onProvider:(id:string)=>void;onReconnect:(provider:string)=>void;onSetup?:()=>void;disabled?:boolean;reason?:string}) {
 const {open,setOpen,host}=useMenu();
 return <div className="chat-chip-host" ref={host} data-chip-host="connection">
  <Chip chip="connection" label={resume?"Reconnect":"Not connected"} title="Connect this conversation's harness route" open={open} onToggle={()=>setOpen(value=>!value)} marked={!resume}>
   {status&&status.state!=="Disconnected"&&<p className="oi-note chat-chip-note">{connectionLabel(status)}</p>}
   <HarnessPicker connections={providers} currentId={undefined} onChoose={id=>{setOpen(false);onProvider(id);}} disabled={disabled} reason={reason}
    resume={resume?{provider:resume.provider,onResume:()=>{setOpen(false);onReconnect(resume.provider);}}:undefined}/>
   {onSetup&&<button type="button" role="menuitem" className="oi-menu-item" onClick={onSetup}>Harness, model or credential setup…</button>}
  </Chip>
 </div>;
}
