import type {ReactNode} from "react";
import {IconTabStrip} from "../../workspace/primitives/IconTabStrip";
import {WindowFunctionsMenu} from "../../workspace/primitives/WindowFunctionsMenu";
import {planeIcon} from "../../workspace/planeRegistry";
export interface PanelTab {id:string;label:string;mark?:"dot"|"attention"}
export function PanelTop({avatar,tabs,current,onSelect,full,onFull,onPromote}:{avatar:ReactNode;tabs:PanelTab[];current:string;onSelect:(id:string)=>void;full:boolean;onFull:()=>void;onPromote?:()=>void}) {
 return <div className="panel-top">{avatar}
  <IconTabStrip aria-label="Right region planes" items={tabs.map(tab=>({...tab,icon:planeIcon(tab.id)}))} current={current} onSelect={onSelect}/>
  <WindowFunctionsMenu label="Panel window functions">
   <button className="oi-menu-item" onClick={onFull}>{full?"Leave full screen":"Full screen"}<kbd>⌘⌥J</kbd></button>
   {onPromote&&<button className="oi-menu-item" onClick={onPromote}>Open conversation in canvas</button>}
  </WindowFunctionsMenu>
 </div>;
}
