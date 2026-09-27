import type {ReactNode} from "react";
import {Glyph} from "../../workspace/Glyph";
import {IconTabStrip} from "../../workspace/primitives/IconTabStrip";
import {WindowFunctionsMenu} from "../../workspace/primitives/WindowFunctionsMenu";
import {planeIcon} from "../../workspace/planeRegistry";
export interface PanelTab {id:string;label:string;mark?:"dot"|"attention"}
/** The panel's one top row (the approved Factory study's right head): tabs,
 * then the expand/restore control — the study's ⤢ — and the window-functions
 * menu. There is no close button: the shell's persistent sidebar icon in the
 * topbar is the single open/close control, in every layout. */
export function PanelTop({avatar,tabs,current,onSelect,full,onFull,onPromote}:{avatar:ReactNode;tabs:PanelTab[];current:string;onSelect:(id:string)=>void;full:boolean;onFull:()=>void;onPromote?:()=>void}) {
 return <div className="panel-top">{avatar}
  <IconTabStrip aria-label="Right region planes" items={tabs.map(tab=>({...tab,icon:planeIcon(tab.id)}))} current={current} onSelect={onSelect}/>
  <button type="button" className="oi-tool panel-expand" aria-pressed={full} aria-label={full?"Restore panel":"Expand panel"} title={full?"Restore the panel (⌘⌥J)":"Expand the panel over the centre (⌘⌥J)"} onClick={onFull}><Glyph name={full?"restore":"expand"} size={13}/></button>
  <WindowFunctionsMenu label="Panel window functions">
   <button className="oi-menu-item" onClick={onFull}>{full?"Leave full screen":"Full screen"}<kbd>⌘⌥J</kbd></button>
   {onPromote&&<button className="oi-menu-item" onClick={onPromote}>Open conversation in canvas</button>}
  </WindowFunctionsMenu>
 </div>;
}
