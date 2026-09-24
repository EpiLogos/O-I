import {useEffect,useRef,useState,type KeyboardEvent} from "react";
import {Glyph} from "../../workspace/Glyph";
import {FileTree} from "../../files/FileTree";
import {PreparedContextView} from "../../context/PreparedContextView";
import {SituationView} from "../../context/SituationView";
import {ActiveContext} from "../../expressions/ActiveContext";
import type {TaPaneOpens} from "../../expressions/TaOntaSide";
import type {CentralLocation} from "../../kernel/types";
// The canvas's own layout (pane room, Active Context strip) — loaded with the
// plane exactly as before, when the Ta-Onta side module carried it.
import "../../contributions/factory/sidebar/sidebar.css";

/**
 * The Context tab (10-SIDEBARS §4.6). PRESERVED: the panel's own pane canvas
 * — the real pane, its tab strip and +, and Active Context — into which
 * files, terminals and browser pages are inserted, exactly as it works
 * today. Only the empty state is new: the three-entry launcher
 * (File ⌘P · Terminal ⌃` · Browser page ⌘T), each opening the existing
 * insertion route — Terminal and Browser page through the canvas's own New
 * tab and its fresh-tab choice, File through the frame's open-into-the-panel
 * route. The conversation's prepared selections stay at the top.
 */
export function ContextCanvas({opens,dataPlane,project,session,onOpenSubject}:{opens?:TaPaneOpens;dataPlane:string;project?:string;session?:string;onOpenSubject?:(subject:{ref?:string;title:string;location?:CentralLocation})=>void}) {
 const tabs=opens?.sideTabs??[];
 const empty=tabs.length===0;
 const [picking,setPicking]=useState(false);
 const [expanded,setExpanded]=useState<string[]>([]);
 const [error,setError]=useState<string>();
 // A launcher choice waits for the canvas's New tab, then makes the fresh
 // tab's own choice for it — the same two steps a person takes by hand.
 const pending=useRef<{kind:"terminal"|"browser";before:Set<string>}>();
 useEffect(()=>{
  const ask=pending.current;if(!ask)return;
  const fresh=tabs.find(tab=>tab.kind==="blank"&&!ask.before.has(tab.id));
  if(!fresh)return;
  pending.current=undefined;
  window.dispatchEvent(new CustomEvent("oi:fresh-choice",{detail:{id:fresh.id,kind:ask.kind,project}}));
 },[tabs,project]);
 const insert=(kind:"terminal"|"browser")=>{
  setError(undefined);setPicking(false);
  pending.current={kind,before:new Set(tabs.map(tab=>tab.id))};
  window.dispatchEvent(new CustomEvent("oi:new-tab",{detail:{groupId:"side-panel"}}));
 };
 const insertFile=async(location:CentralLocation)=>{
  if(!opens?.insertFile){setError("Opening a file into this panel is not wired in this mode yet.");return;}
  try{await opens.insertFile(location);setPicking(false);}catch(reason){setError(String(reason instanceof Error?reason.message:reason));}
 };
 const host=useRef<HTMLDivElement>(null);
 // ⌘T is the frame's own key; inside this canvas the frame hands it here.
 useEffect(()=>{
  const take=(event:Event)=>{if(!host.current?.contains(document.activeElement))return;if((event as CustomEvent<{kind?:string}>).detail?.kind==="browser")insert("browser");};
  window.addEventListener("oi:context-insert",take);return()=>window.removeEventListener("oi:context-insert",take);
 });
 const keys=(event:KeyboardEvent)=>{
  const mod=event.metaKey||event.ctrlKey;
  if(mod&&!event.shiftKey&&!event.altKey&&event.key.toLowerCase()==="p"){event.preventDefault();setPicking(value=>!value);}
  else if(event.ctrlKey&&event.key==="`"){event.preventDefault();insert("terminal");}
  else if(mod&&!event.shiftKey&&event.key.toLowerCase()==="t"){event.preventDefault();event.stopPropagation();insert("browser");}
  else if(event.key==="Escape"&&picking){event.preventDefault();setPicking(false);}
 };
 return <div ref={host} className="desk-plane oi-side-plane ta-context-plane context-canvas" data-plane={dataPlane} data-empty={empty?"true":undefined} onKeyDown={keys}>
  <SituationView/>
  {project&&<PreparedContextView project={project} session={session} onOpenSubject={onOpenSubject}/>}
  {empty&&<div className="context-launcher" aria-label="Insert into context">
   <p className="context-launcher-line">Bring material into this conversation&apos;s context.</p>
   <button type="button" className="context-launch" aria-expanded={picking} onClick={()=>setPicking(value=>!value)}><Glyph name="file" size={14}/><span>File</span><kbd>⌘P</kbd></button>
   {picking&&<div className="context-file-picker" role="group" aria-label="Choose a file">
    <FileTree path={project?`Work/${project}`:""} onOpen={insertFile} refresh={0} expanded={expanded} onExpansion={setExpanded} onRootRef={()=>{}}/>
   </div>}
   <button type="button" className="context-launch" onClick={()=>insert("terminal")}><Glyph name="terminal" size={14}/><span>Terminal</span><kbd>⌃`</kbd></button>
   <button type="button" className="context-launch" onClick={()=>insert("browser")}><Glyph name="explore" size={14}/><span>Browser page</span><kbd>⌘T</kbd></button>
   {error&&<p className="oi-note" role="alert">{error}</p>}
  </div>}
  {opens?.sideHost??<p className="oi-empty">The pane host is not wired for this mode yet.</p>}
  <ActiveContext tabs={opens?.sideTabs} onActivate={opens?.activateTab}/>
 </div>;
}
