import {useEffect,useRef,useState,type ReactNode} from "react";
import type {SurfaceBinding} from "../surface/types";
import "./editor.css";

export interface ContextCandidateDetail {
  bindingId:string;
  kind:"text";
  text:string;
  sourceRef?:string;
  location?:SurfaceBinding["location"];
  start?:number;
  end?:number;
}

export function dispatchTextCandidate(binding:SurfaceBinding,textarea:HTMLTextAreaElement):boolean {
  const {selectionStart:start,selectionEnd:end}=textarea;
  const text=textarea.value.slice(start,end);
  if(!text)return false;
  window.dispatchEvent(new CustomEvent<ContextCandidateDetail>("oi:context-candidate",{detail:{
    bindingId:binding.id,kind:"text",text,sourceRef:binding.ref,location:binding.location,start,end,
  }}));
  return true;
}

function usePaneFocus(root:React.RefObject<HTMLElement>):boolean {
  const [focused,setFocused]=useState(true);
  useEffect(()=>{
    const node=root.current;if(!node)return;
    const pane=node.closest<HTMLElement>(".pane.group");
    if(!pane){setFocused(true);return;}
    const read=()=>setFocused(pane.dataset.focused==="true");read();
    const observer=new MutationObserver(read);observer.observe(pane,{attributes:true,attributeFilter:["data-focused","class"]});
    return()=>observer.disconnect();
  },[root]);
  return focused;
}

export function EditorFrame({children,className="",toolbar,footer,label,data}:{children:ReactNode;className?:string;toolbar:ReactNode;footer:ReactNode;label:string;data?:Record<string,string|boolean|undefined>}) {
  const root=useRef<HTMLElement>(null);const focused=usePaneFocus(root);const [collapsed,setCollapsed]=useState(false);
  const dataAttributes=Object.fromEntries(Object.entries(data??{}).filter(([,value])=>value!==undefined).map(([key,value])=>[`data-${key}`,String(value)]));
  return <section ref={root} className={`editor-frame ${className}`} data-editor-focused={focused} data-toolbar-collapsed={collapsed} aria-label={label} {...dataAttributes}>
    <header className="editor-command-line">
      <div className="editor-command-tools" role="toolbar" aria-label={`${label} tools`}>{toolbar}</div>
      {focused&&<button type="button" className="editor-collapse" aria-expanded={!collapsed} title={collapsed?"Show editing tools":"Hide editing tools"} onClick={()=>setCollapsed(value=>!value)}>{collapsed?"Tools":"Hide"}</button>}
    </header>
    <div className="editor-content">{children}</div>
    <footer className="editor-footer">{footer}</footer>
  </section>;
}

export function EditorButton(props:React.ButtonHTMLAttributes<HTMLButtonElement>){return <button type="button" {...props}/>;}

export function useTextContextMenu(binding:SurfaceBinding,textarea:React.RefObject<HTMLTextAreaElement>,writable:boolean,onChange?:(value:string)=>void,onAttach?:()=>void){
  const [menu,setMenu]=useState<{x:number;y:number;start:number;end:number}|null>(null);
  useEffect(()=>{const close=()=>setMenu(null);window.addEventListener("pointerdown",close);window.addEventListener("blur",close);return()=>{window.removeEventListener("pointerdown",close);window.removeEventListener("blur",close);};},[]);
  const onContextMenu=(event:React.MouseEvent<HTMLTextAreaElement>)=>{const el=event.currentTarget;if(el.selectionStart===el.selectionEnd)return;event.preventDefault();event.stopPropagation();setMenu({x:event.clientX,y:event.clientY,start:el.selectionStart,end:el.selectionEnd});};
  const menuNode=menu?<div className="editor-text-menu" role="menu" style={{left:menu.x,top:menu.y}} onPointerDown={event=>event.stopPropagation()}>
    <button role="menuitem" onClick={()=>{if(onAttach)onAttach();else {const el=textarea.current;if(el)dispatchTextCandidate(binding,el);}setMenu(null);}}>Add selection to context</button>
    <button role="menuitem" onClick={()=>void copy(false)}>Copy</button>
    {writable&&<button role="menuitem" onClick={()=>void copy(true)}>Cut</button>}
  </div>:null;
  async function copy(cut:boolean){const el=textarea.current;if(!el||!menu)return;const text=el.value.slice(menu.start,menu.end);try{await navigator.clipboard.writeText(text);}catch{el.focus();el.setSelectionRange(menu.start,menu.end);document.execCommand("copy");}if(cut&&writable){el.setSelectionRange(menu.start,menu.end);el.setRangeText("",menu.start,menu.end,"end");onChange?.(el.value);requestAnimationFrame(()=>el.focus());}setMenu(null);}
  return {onContextMenu,menuNode};
}

export function replaceSelection(textarea:HTMLTextAreaElement,replacement:string,onChange:(value:string)=>void,selectOffset=0){
  const start=textarea.selectionStart,end=textarea.selectionEnd;
  textarea.setRangeText(replacement,start,end,"end");onChange(textarea.value);
  requestAnimationFrame(()=>{textarea.focus();const caret=start+replacement.length-selectOffset;textarea.setSelectionRange(caret,caret);});
}
