/** Renderer observations disclose presentation only. They carry no writing,
 * draft, document body, command, browser URL or claim of authenticated identity. */
import type { Workspace } from "../workspace/store";
import type { Pane } from "../surface/types";
import type { VisualsSnapshot } from "./store";

const bounded = (value:string|undefined) => value && value.length<=256 ? value : undefined;
export function arrangementObservation(book:{active:string;workspaces:Workspace[]}) {
  const current=book.workspaces.find(workspace=>workspace.id===book.active);
  if (!current) return null;
  const layout=current.layout;
  let count=0;
  const pane=(node:Pane|null|undefined,depth=0):unknown=> {
    if (!node || depth>12 || ++count>64) return null;
    if(node.type==="group")return {type:node.type,id:bounded(node.id),tabs:node.tabs.slice(0,64).map(bounded),active:bounded(node.active??undefined),tabPresentation:node.tabPresentation};
    return {type:node.type,id:bounded(node.id),dir:node.dir,weights:node.weights?.slice(0,16),children:node.children.slice(0,16).map(child=>pane(child,depth+1))};
  };
  const observation = {
    active:bounded(book.active),workspace_ids:book.workspaces.slice(0,64).map(workspace=>bounded(workspace.id)),
    mode:layout.mode??"base",root:pane(layout.root),
    surfaces:Object.values(layout.surfaces).slice(0,64).map(surface=>({id:bounded(surface.id),kind:bounded(surface.kind),ref:bounded(surface.ref)})),
    focused_group:bounded(layout.focusedGroupId??undefined),focused_tab:bounded(layout.focusedTabId??undefined),
    maximized_group:bounded(layout.maximizedGroupId??undefined),left_width:layout.leftWidth,right_width:layout.rightWidth,
    agency_depth:layout.agencyDepth,right_depth:layout.rightDepth,
  };
  // Ref-rich arrangements can grow large. Bound the advisory reading without
  // touching the actual book or smuggling a truncated document body into it.
  if (new TextEncoder().encode(JSON.stringify(observation)).length > 32_000) return {active:bounded(book.active),mode:layout.mode??"base",truncated:true};
  return observation;
}
export function visualObservation(snapshot:VisualsSnapshot) {
  // Glyphs and saved recipe names may contain authored text; disclose only switches.
  return {enabled:snapshot.enabled,welcome_enabled:snapshot.welcomeEnabled};
}
let arrangement:ReturnType<typeof arrangementObservation>=null;
let serialized="null";
const listeners=new Set<()=>void>();
export function publishArrangement(book:Parameters<typeof arrangementObservation>[0]) {
  const next=arrangementObservation(book), json=JSON.stringify(next);
  if(json===serialized)return;
  arrangement=next;serialized=json;for(const listener of listeners)listener();
}
export const currentArrangement=()=>arrangement;
export function subscribeArrangement(listener:()=>void) {listeners.add(listener);return ()=>{listeners.delete(listener);};}
