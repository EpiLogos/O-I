import {useEffect,useRef,useState,type KeyboardEvent} from "react";
import {Glyph} from "../../workspace/Glyph";
import {FileTree} from "../../files/FileTree";
import type {TaPaneOpens} from "../../expressions/TaOntaSide";
import type {CentralLocation} from "../../kernel/types";
// The canvas's own layout (pane room, strip popovers) — loaded with the
// plane exactly as before, when the Ta-Onta side module carried it.
import "../../contributions/factory/sidebar/sidebar.css";

/**
 * The Context plane for the modes that keep a side pane canvas (Factory,
 * Expressions, Technè — 10-SIDEBARS §4.6). The pane host IS the plane: open
 * material fills the space beneath the strip, edge to edge (the approved
 * Factory study's material workspace). Selection and preparation live in the
 * strip's compact Context control (ContextPreparationButton); insertion in
 * the strip's + menu; neither stands between the person and the material.
 *
 * Central (base) mode does not mount this body: its Context plane is the
 * prepared-context view alone, because the pane canvas belongs in the middle
 * workspace there — not as a second copy in the right panel.
 */
export function ContextCanvas({opens,dataPlane,project}:{opens?:TaPaneOpens;dataPlane:string;project?:string;session?:string;onOpenSubject?:(subject:{ref?:string;title:string;location?:CentralLocation})=>void}) {
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
 // The strip's + menu and the canvas's own keys converge on the same native
 // opening routes (the one insertion law): both speak `oi:context-insert`.
 useEffect(()=>{
  const take=(event:Event)=>{
   const kind=(event as CustomEvent<{kind?:string}>).detail?.kind;
   if(kind==="terminal")insert("terminal");
   else if(kind==="browser")insert("browser");
   else if(kind==="file")setPicking(value=>!value);
  };
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
  {empty&&<div className="context-launcher" aria-label="Insert into context">
   <p className="context-launcher-line">Open material beside your work.</p>
   <button type="button" className="context-launch" aria-expanded={picking} onClick={()=>setPicking(value=>!value)}><Glyph name="file" size={14}/><span>File</span><kbd>⌘P</kbd></button>
   <button type="button" className="context-launch" onClick={()=>insert("terminal")}><Glyph name="terminal" size={14}/><span>Terminal</span><kbd>⌃`</kbd></button>
   <button type="button" className="context-launch" onClick={()=>insert("browser")}><Glyph name="explore" size={14}/><span>Browser page</span><kbd>⌘T</kbd></button>
   {error&&<p className="oi-note" role="alert">{error}</p>}
  </div>}
  {picking&&<div className="context-file-picker context-picker-pop" role="group" aria-label="Choose a file">
   <FileTree path={project?`Work/${project}`:""} onOpen={insertFile} refresh={0} expanded={expanded} onExpansion={setExpanded} onRootRef={()=>{}}/>
  </div>}
  {opens?.sideHost??<p className="oi-empty">The pane host is not wired for this mode yet.</p>}
 </div>;
}
