import type {ReactNode} from "react";
import {Glyph} from "../../workspace/Glyph";

/**
 * The panel's ONE top row (10-SIDEBARS §4.1, amendment A3): the avatar menu,
 * the tabs, then ⤢ (full, ⌘⌥J) and ✕ (collapse, ⌘⇧B). No title band, no
 * "Situated in …". Tabs are plain text with an ink underline; a tab can carry
 * a dot (new activity) or ! (needs you). There is no "More" overflow.
 */
export interface PanelTab {id:string;label:string;mark?:"dot"|"attention"}
export function PanelTop({avatar,tabs,current,onSelect,full,onFull,onCollapse,extra}:{avatar:ReactNode;tabs:PanelTab[];current:string;onSelect:(id:string)=>void;full:boolean;onFull:()=>void;onCollapse?:()=>void;extra?:ReactNode}) {
 return <div className="panel-top">
  {avatar}
  <nav className="panel-tabs" aria-label="Right region planes">
   {tabs.map(tab=><button key={tab.id} type="button" id={`panel-tab-${tab.id}`} aria-current={tab.id===current?"page":undefined} data-plane-tab={tab.id} data-mark={tab.mark} className="panel-tab" onClick={()=>onSelect(tab.id)}>
    <span>{tab.label}</span>
    {tab.mark==="dot"&&<span className="panel-tab-dot" aria-label="new activity"/>}
    {tab.mark==="attention"&&<span className="panel-tab-attention" aria-label="needs you">!</span>}
   </button>)}
  </nav>
  <div className="panel-controls">
   {extra}
   <button type="button" className="oi-tool panel-full" aria-label={full?"Leave full screen":"Full screen conversation"} aria-pressed={full} title={full?"Back to the panel (⌘⌥J)":"Full screen (⌘⌥J)"} onClick={onFull}><Glyph name={full?"restore":"expand"} size={13}/></button>
   {onCollapse&&<button type="button" className="oi-tool panel-collapse" aria-label="Collapse the panel" title="Collapse (⌘⇧B)" onClick={onCollapse}><Glyph name="close" size={13}/></button>}
  </div>
 </div>;
}
