import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from "react";
import type {SurfaceBinding} from "../surface/types";
import "./editor.css";
import {createPortal} from "react-dom";
import {useHostSelection} from "../context/hostSelection";
import {observeComponent} from "../context/ComponentSelection";
import {EditorIcon} from "./EditorIcon";
import type {EditorHandle} from "./TextEditor";

export const EditorMode=createContext<"writing"|"context">("writing");
export const useEditorMode=()=>useContext(EditorMode);

export interface ContextCandidateDetail {
  bindingId:string;
  kind:"text";
  text:string;
  sourceRef?:string;
  location?:SurfaceBinding["location"];
  start?:number;
  end?:number;
}

export function dispatchTextCandidate(binding:SurfaceBinding,textarea:EditorHandle):boolean {
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

export function EditorFrame({children,className="",toolbar,footer,label,data,presentationTools}:{children:ReactNode;className?:string;toolbar:ReactNode;presentationTools?:ReactNode;footer:ReactNode;label:string;data?:Record<string,string|boolean|undefined>}) {
  const root=useRef<HTMLElement>(null);const attachHostSelection=useHostSelection(root);const focused=usePaneFocus(root);const [collapsed,setCollapsed]=useState(false);
  const [mode,setMode]=useState<"writing"|"context">("writing");const [selected,setSelected]=useState(false);
  const [selectionBox,setSelectionBox]=useState<{x:number;y:number}|null>(null);const pointerStart=useRef<{x:number;y:number}|null>(null);
  const [menu,setMenu]=useState<{x:number;y:number}|null>(null);const menuRoot=useRef<HTMLDivElement>(null);
  const [hover,setHover]=useState<{node:Element;box:DOMRect}|null>(null);
  useEffect(()=>{const node=root.current;if(!node)return;const selection=(event:Event)=>setSelected((event as CustomEvent).detail.selected);node.addEventListener("oi:editor-selection",selection);return()=>node.removeEventListener("oi:editor-selection",selection);},[]);
  useEffect(()=>{const node=root.current;if(!node)return;const anchor=(event:Event)=>{const value=(event as CustomEvent).detail;setSelected(!!value?.selected);setSelectionBox(value?.selected&&value?.bounds?{x:value.bounds.x,y:value.bounds.y}:null);};node.addEventListener("oi:selection-anchor",anchor);return()=>node.removeEventListener("oi:selection-anchor",anchor);},[]);
  useEffect(()=>{if(!menu)return;const close=(e:Event)=>{if(!menuRoot.current?.contains(e.target as Node))setMenu(null);};window.addEventListener('pointerdown',close,true);window.addEventListener('blur',close);return()=>{window.removeEventListener('pointerdown',close,true);window.removeEventListener('blur',close);};},[menu]);
  useLayoutEffect(()=>{const node=menuRoot.current;if(!node)return;const box=node.getBoundingClientRect();node.style.left=`${Math.max(4,Math.min(menu!.x,innerWidth-box.width-4))}px`;node.style.top=`${Math.max(4,Math.min(menu!.y,innerHeight-box.height-4))}px`;node.querySelectorAll('button,select').forEach(el=>el.setAttribute('role','menuitem'));node.querySelector<HTMLElement>('button:not(:disabled)')?.focus({preventScroll:true});},[menu]);
  const dataAttributes=Object.fromEntries(Object.entries(data??{}).filter(([,value])=>value!==undefined).map(([key,value])=>[`data-${key}`,String(value)]));
  const attach=()=>{if(attachHostSelection())return;root.current?.querySelector('.text-editor')?.dispatchEvent(new Event('oi:attach-selection'));root.current?.dispatchEvent(new Event('oi:page-attach-selection'));};
  // The tool strips under the document (returns, shared material, accepted
  // revisions) are interactive surface tooling, not document material: the
  // context-mode component picker must never arm on them or swallow their
  // clicks — a click there means the affordance it names, nothing else.
  const toolRegion=(node:Element|null|undefined)=>!!node?.closest(".document-returns,.shared-field-material,.document-contributions,.source-history,.source-conflict");
  const pick=(event:React.PointerEvent)=>{if(mode!=="context")return;if(toolRegion(event.target as Element)){setHover(null);return;}const node=(event.target as Element).closest('.cm-line,p,h1,h2,h3,li,button,img,svg,pre,table,[data-context-component]');if(node&&root.current?.contains(node)&&!node.closest('.editor-command-line,.editor-collapse'))setHover({node,box:node.getBoundingClientRect()});else setHover(null);};
  return <EditorMode.Provider value={mode}><section ref={root} className={`editor-frame ${className}`} data-editor-focused={focused} data-toolbar-collapsed={collapsed} data-editor-mode={mode} data-context-scope={mode==="context"?"components":"off"} aria-label={label} {...dataAttributes}>
    <header className="editor-command-line"><div className="editor-command-tools" role="toolbar" aria-label={`${label} modes`}>
      <button title="Write and interact normally" aria-label="Writing mode" aria-pressed={mode==="writing"} onClick={()=>{setMode("writing");setCollapsed(false);setHover(null);}}><EditorIcon name="file"/></button>
      <button title="Pick a component for context; text selection works without this tool" aria-label="Pick component for context" aria-pressed={mode==="context"} onClick={()=>{setMode(value=>value==="context"?"writing":"context");setCollapsed(false);}}><EditorIcon name="inspect"/></button>
      <div className="editor-mode-toolkit" onMouseDown={event=>{if((event.target as Element).closest('button'))event.preventDefault();}}>
        {toolbar}<button type="button" title="Add selection to context · Ctrl/⌘⇧2" aria-label="Add selection to context" disabled={!selected&&!root.current?.querySelector('iframe[data-page-context]')} onClick={attach}><EditorIcon name="context"/></button>
      </div>
      {presentationTools}
    </div></header>
    {focused&&<button type="button" className="editor-collapse" aria-label={collapsed?"Show editing tools":"Hide editing tools"} aria-expanded={!collapsed} title={collapsed?"Show editing tools":"Hide editing tools"} onClick={()=>setCollapsed(value=>!value)}>{collapsed?"⌄":"⌃"}</button>}
    <div className="editor-content" onScrollCapture={()=>{setHover(null);setSelectionBox(null);}} onPointerDownCapture={event=>{pointerStart.current={x:event.clientX,y:event.clientY};}} onPointerMove={pick} onPointerLeave={()=>setHover(null)} onClickCapture={event=>{if(mode!=="context"||!hover||toolRegion(event.target as Element))return;if(selected||window.getSelection()?.toString()||pointerStart.current&&Math.hypot(event.clientX-pointerStart.current.x,event.clientY-pointerStart.current.y)>4)return;event.preventDefault();event.stopPropagation();const id=root.current?.closest<HTMLElement>('[data-binding-id]')?.dataset.bindingId;if(id)window.dispatchEvent(new CustomEvent('oi:context-candidate',{detail:observeComponent(hover.node,id)}));setHover(null);}} onContextMenuCapture={event=>{if(mode!=="writing")return;event.preventDefault();event.stopPropagation();setMenu({x:event.clientX,y:event.clientY});}}>{children}</div>
    <footer className="editor-footer" tabIndex={0} aria-label="Document status and saving">{footer}</footer>
    {selected&&selectionBox&&!menu&&createPortal(<div className="editor-selection-actions" role="toolbar" aria-label="Selected text" style={{left:Math.max(6,Math.min(selectionBox.x,innerWidth-160)),top:Math.max(6,Math.min(selectionBox.y+8,innerHeight-42))}} onMouseDown={event=>event.preventDefault()}><button type="button" aria-label="Add selected text to context" title="Add to context · Ctrl/⌘⇧2" onClick={()=>{attach();setSelectionBox(null);}}><EditorIcon name="context"/>Add to context</button><button type="button" aria-label="Dismiss selection actions" onClick={()=>setSelectionBox(null)}><EditorIcon name="close"/></button></div>,document.body)}
    {hover&&mode==="context"&&createPortal(<div className="component-pick-bounds" style={{left:hover.box.x,top:hover.box.y,width:hover.box.width,height:hover.box.height}}><span>@ {hover.node.tagName.toLowerCase()}</span></div>,document.body)}
    {menu&&createPortal(<div ref={menuRoot} className="ctx-menu editor-writing-menu" role="menu" aria-label="Writing commands" style={{left:menu.x,top:menu.y}} onKeyDown={event=>{if(event.key==='Escape'){setMenu(null);return;}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const items=[...menuRoot.current!.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')];const index=items.indexOf(document.activeElement as HTMLElement);items[(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}}} onMouseDown={event=>{if((event.target as Element).closest('button'))event.preventDefault();}} onClick={event=>{if((event.target as Element).closest('button'))setMenu(null);}}><small className="ctx-menu-subject">Editing</small>{toolbar}<hr/><button disabled={!selected} onClick={attach}><EditorIcon name="context"/> Add to context</button><button onClick={()=>root.current?.querySelector('.text-editor')?.dispatchEvent(new CustomEvent('oi:editor-command',{detail:'copy'}))}>Copy</button><button onClick={()=>root.current?.querySelector('.text-editor')?.dispatchEvent(new CustomEvent('oi:editor-command',{detail:'cut'}))}>Cut</button>{['yellow','green','blue','rose'].map(color=><button key={color} onClick={()=>root.current?.querySelector('.text-editor')?.dispatchEvent(new CustomEvent('oi:editor-command',{detail:`highlight-${color}`}))}>Highlight {color}</button>)}<button onClick={()=>root.current?.querySelector('.text-editor')?.dispatchEvent(new CustomEvent('oi:editor-command',{detail:'highlight-clear'}))}>Remove highlight</button></div>,document.body)}
  </section></EditorMode.Provider>;
}

export function EditorButton(props:React.ButtonHTMLAttributes<HTMLButtonElement>){return <button type="button" {...props}/>;}

export function replaceSelection(textarea:EditorHandle,replacement:string,onChange:(value:string)=>void,selectOffset=0){
  const start=textarea.selectionStart,end=textarea.selectionEnd;
  textarea.setRangeText(replacement,start,end,"end");onChange(textarea.value);
  requestAnimationFrame(()=>{textarea.focus();const caret=start+replacement.length-selectOffset;textarea.setSelectionRange(caret,caret);});
}
