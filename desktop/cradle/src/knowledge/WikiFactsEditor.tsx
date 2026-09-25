import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import type {KernelTransportStatus} from '../kernel/types';
import {TimePlaceFields} from './ParticipationFacts';
import {factsKey,factsRecorded,inspectFacts,prepareFacts,saveFacts,type FactsBasis,type FactsCheckpoint} from './wikiFacts';
import './wikiConstruction.css';
const OpenFacts=createContext<((reference:string,onSaved?:()=>void)=>void)|undefined>(undefined);
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
export function WikiFactsButton({reference,disabled=false,onSaved}:{reference:string;disabled?:boolean;onSaved?:()=>void}){
 const open=useContext(OpenFacts);
 return open?<button type="button" className="oi-action" disabled={disabled} onClick={()=>open(reference,onSaved)}>Edit time and place</button>:null;
}
/** The existing knowledge surface retains drafts. Closing this panel only
 * releases its presentation, never the captured native operation or inputs. */
export function WikiFactsProvider({transport,project,checkpoints,onCheckpoint,onSaved,children}:{transport:KernelTransportStatus;project?:string;checkpoints:Record<string,FactsCheckpoint>;onCheckpoint:(key:string,value:FactsCheckpoint)=>void;onSaved:()=>void;children:ReactNode}){
 const [selected,setSelected]=useState<string>(),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[observed,setObserved]=useState<FactsBasis>();
 const current=useRef(checkpoints);current.current=checkpoints;
 const target=useRef<string>(),ticket=useRef(0),returnFocus=useRef<HTMLElement|null>(null),notify=useRef<(()=>void)|undefined>();
 const panel=useRef<HTMLElement|null>(null);
 const held=selected?checkpoints[selected]:undefined;
 useEffect(()=>{if(selected)panel.current?.querySelector<HTMLButtonElement>('[data-facts-close]')?.focus();},[selected]);
 useEffect(()=>()=>{ticket.current++;},[]);
 const close=()=>{ticket.current++;target.current=undefined;setSelected(undefined);setBusy('');setObserved(undefined);returnFocus.current?.isConnected&&returnFocus.current.focus();};
 const open=async(reference:string,callback?:()=>void)=>{
  const id=++ticket.current;target.current=reference;returnFocus.current=document.activeElement as HTMLElement|null;notify.current=callback;setError('');setNotice('');setObserved(undefined);
  const retained=Object.entries(current.current).find(([,item])=>item.basis.target.ref===reference);
  if(retained){setBusy('');setSelected(retained[0]);return;}
  setBusy('Reading native facts…');setSelected('loading');
  try{const basis=await inspectFacts(transport,project,reference);if(id!==ticket.current)return;const key=factsKey(basis.target);onCheckpoint(key,{basis,draft:structuredClone(basis.values)});setSelected(key);}
  catch(cause){if(id===ticket.current)setError(message(cause));}
  finally{if(id===ticket.current)setBusy('');}
 };
 const store=(value:FactsCheckpoint)=>{if(!selected||!held)return false;try{onCheckpoint(selected,value);return true;}catch(cause){setError(`Inputs could not be retained: ${message(cause)}`);return false;}};
 const confirm=(basis:FactsBasis)=>{
  if(!selected)return;onCheckpoint(selected,{basis,draft:structuredClone(basis.values)});setObserved(undefined);setNotice(`Saved and read back · revision ${basis.revision}.`);onSaved();notify.current?.();
 };
 const save=async()=>{
  if(!held||!selected)return;const id=++ticket.current;setBusy('Saving native facts…');setError('');setNotice('');
  try{const pending=structuredClone(prepareFacts(held)),checkpoint={...held,pending};onCheckpoint(selected,checkpoint);const basis=await saveFacts(transport,project,checkpoint);if(id===ticket.current)confirm(basis);}
  catch(cause){if(id===ticket.current)setError(message(cause));}
  finally{if(id===ticket.current)setBusy('');}
 };
 const inspect=async()=>{
  if(!held)return;const id=++ticket.current;setBusy('Reading saved state…');setError('');
  try{const fresh=await inspectFacts(transport,project,held.basis.target.ref);if(id!==ticket.current)return;if(fresh.source_ref!==held.basis.source_ref)throw Error('The native register identity changed; the retained inputs have not been rebased.');
   setObserved(fresh);
   setNotice(`Native revision ${fresh.revision}: ${fresh.values.temporal?.length??0} time facts and ${fresh.values.places?.length??0} place facts. ${held.pending?(factsRecorded(fresh,held.pending)?'A matching recorded result is visible. Retry the exact save so the owner can verify its operation identity and source continuity.':'The retained proposal is not confirmed.'):'Your inputs are retained.'}`);
  }catch(cause){if(id===ticket.current)setError(message(cause));}finally{if(id===ticket.current)setBusy('');}
 };
 const rebase=()=>{if(!held||!observed)return;if(!store({basis:observed,draft:held.draft}))return;setObserved(undefined);setNotice('Current native revision adopted explicitly. Your inputs are kept; saving creates a new operation.');};
 return <OpenFacts.Provider value={(reference,callback)=>void open(reference,callback)}>{children}{selected&&<section ref={panel} className="wiki-construction oi-sidecar" role="dialog" aria-modal="false" aria-label="Edit native time and place" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
  <header><h2>Time and place{held?held.basis.target.kind==='node'?' · this node':' · this whole constellation':''}</h2><button type="button" className="oi-tool" data-facts-close aria-label="Close time and place editor" onClick={close}>×</button></header>
  <p>Closing keeps these inputs and any pending save. Only Save changes the native Wiki.</p>
  {held&&<><p>{held.basis.title} · saved revision {held.basis.revision}</p><fieldset disabled={!!busy||!!held.pending}><TimePlaceFields identity={factsKey(held.basis.target)} value={held.draft} basis={held.basis.values} transport={transport} summary="Time and place values" description={held.basis.target.kind==='node'?'These facts belong to this native node wherever it is read. Participation facts remain separate.':'These facts belong to the whole native frame. They do not change its members or their participation facts.'} onChange={draft=>{if(store({...held,draft})){setError('');setNotice('');}}}/></fieldset>
   <div className="wiki-construction-toolbar"><button className="oi-action" disabled={!!busy} onClick={()=>void save()}>{held.pending?'Retry exact save':'Save time and place'}</button><button className="oi-action" disabled={!!busy} onClick={()=>void inspect()}>Inspect saved state</button></div>
   {held.pending&&<p>The exact pending operation is retained. Inspect before changing or retrying it.</p>}
   {observed&&(!held.pending||!observed.operations[held.pending.operation_ref])&&<button className="oi-action" disabled={!!busy} onClick={rebase}>Use current revision, keep my inputs</button>}
  </>}
  {busy&&<p role="status">{busy}</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 </section>}</OpenFacts.Provider>;
}
