import {activateSurface, groupsOf, paneById, withoutPane, moveTab, nextId, openBinding} from "./engine";
import type {LayoutState, Pane, SurfaceBinding, TabGroupPane} from "./types";

export function centreGroup(state: LayoutState): string | null {
  const root=state.composition?withoutPane(state.root,state.composition.returnPaneId):state.root;
  const groups=groupsOf(root);
  return groups.find(group=>group.id===state.focusedGroupId)?.id??groups[0]?.id??null;
}
export function presentBinding(state:LayoutState,binding:SurfaceBinding,region:"centre"|"right"="centre"):LayoutState {
  const destination=region==="right"&&state.composition
    ? groupsOf(paneById(state.root,state.composition.returnPaneId))[0]?.id
    : centreGroup(state);
  let next={...state,closedStack:state.closedStack.filter(id=>id!==binding.id)};
  const existing=groupsOf(next.root).find(group=>group.tabs.includes(binding.id));
  if (existing) {
    if (destination && region==="right" && destination!==existing.id) next=moveTab(next,binding.id,destination);
    return activateSurface(next,binding.id);
  }
  return openBinding({...next,focusedGroupId:destination??next.focusedGroupId},binding);
}
export function selectCompositionCollection(state:LayoutState,bindingId:string,collectionRef?:string):LayoutState {
  const held=state.composition;
  if(!held||held.bindingId!==bindingId||held.collectionRef===collectionRef)return state;
  const returned=paneById(state.root,held.returnPaneId);
  const released=groupsOf(returned).flatMap(group=>group.tabs.filter(id=>!group.pinned.includes(id)));
  const clear=(pane:Pane):Pane=>pane.type==="group"?(()=>{
    const pinned=pane.tabs.filter(id=>pane.pinned.includes(id));
    return {...pane,tabs:pinned,pinned,active:pinned.includes(pane.active??"")?pane.active:pinned[0]??null,emptySlot:pinned.length?undefined:true};
  })():{...pane,children:pane.children.map(clear)};
  const replace=(pane:Pane):Pane=>pane.id===held.returnPaneId?clear(pane):pane.type==="split"?{...pane,children:pane.children.map(replace)}:pane;
  return {...state,root:state.root?replace(state.root):null,closedStack:[...state.closedStack.filter(id=>!released.includes(id)),...released],composition:{...held,collectionRef}};
}
export function enterComposition(state:LayoutState,binding:SurfaceBinding):LayoutState {
  if (state.composition) {
    const same=state.composition.bindingId===binding.id;
    const selected=same?state:selectCompositionCollection(state,state.composition.bindingId,undefined);
    return presentBinding({...selected,composition:{...selected.composition!,bindingId:binding.id}},binding);
  }
  const ordinary={root:state.root,focusedGroupId:state.focusedGroupId,maximizedGroupId:state.maximizedGroupId,rightDepth:state.rightDepth,leftWidth:state.leftWidth,rightWidth:state.rightWidth,agencyDepth:state.agencyDepth};
  const centre=presentBinding(state,binding);
  const group:TabGroupPane={type:"group",id:nextId(centre,"g"),tabs:[],pinned:[],active:null,emptySlot:true};
  const right:Pane={type:"split",id:nextId(centre,"p"),dir:"h",regionHost:true,children:[group]};
  const root:Pane={type:"split",id:nextId({...centre,root:right},"p"),dir:"h",children:[centre.root!,right]};
  return {...centre,root,composition:{bindingId:binding.id,returnPaneId:right.id,ordinary},maximizedGroupId:undefined,rightDepth:"panel",rightWidth:Math.max(400,state.rightWidth??0)};
}
/** Restore ordinary geometry/selection while retaining work opened since entry.
 * Explicitly closed/detached bindings stay closed/detached; no owner is restarted. */
export function leaveComposition(state:LayoutState):LayoutState {
  if (!state.composition) return state;
  const {ordinary}=state.composition;
  const open=new Set(groupsOf(state.root).flatMap(group=>group.tabs));
  const restore=(pane:Pane|null):Pane|null=>{
    if (!pane) return null;
    if (pane.type==="group") {
      const tabs=pane.tabs.filter(id=>open.has(id));
      return {...pane,tabs,pinned:pane.pinned.filter(id=>tabs.includes(id)),active:pane.active&&tabs.includes(pane.active)?pane.active:tabs[0]??null};
    }
    return {...pane,children:pane.children.map(child=>restore(child)!)};
  };
  let next:LayoutState={...state,...ordinary,root:restore(ordinary.root),composition:undefined};
  const restored=new Set(groupsOf(next.root).flatMap(group=>group.tabs));
  const additions=[...open].filter(id=>!restored.has(id));
  if (!next.root && additions.length) next={...next,root:{type:"group",id:nextId(state,"g"),tabs:[],pinned:[],active:null}};
  const destination=groupsOf(next.root).find(group=>group.id===ordinary.focusedGroupId)??groupsOf(next.root)[0];
  if (destination) {
    const append=(pane:Pane):Pane=>pane.type==="group" ? pane.id===destination.id?{...pane,tabs:[...pane.tabs,...additions],active:pane.active??additions[0]??null}:pane : {...pane,children:pane.children.map(append)};
    next={...next,root:append(next.root!),focusedGroupId:destination.id};
  }
  return next;
}

export {paneById,withoutPane} from "./engine";
