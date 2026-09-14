import {activateSurface,closeSurface,groupsOf} from "./engine";
import {centreGroup,presentBinding} from "./composition";
import type {LayoutState,Pane,SurfaceBinding} from "./types";

/** One native conversation, with a retained ordinary work destination. These
 * operations only move presentation; they do not open or reconnect a session. */
export function presentConversation(state:LayoutState,binding:SurfaceBinding):LayoutState {
  if(binding.kind!=="encounter"||!binding.ref||!binding.project||!binding.encounter)return state;
  const destination=groupsOf(state.root).find(group=>group.id===centreGroup(state));
  const alreadyVisible=groupsOf(state.root).some(group=>group.active===binding.id);
  const view=!state.composition&&!alreadyVisible
    ? {...binding.view,encounterReturnSurfaceId:destination?.active??undefined}
    : binding.view;
  const retained={...binding,view};
  return presentBinding({...state,surfaces:{...state.surfaces,[binding.id]:retained},
    accompanying:{ref:binding.ref,project:binding.project,space:binding.encounter.space}},retained);
}

export function returnConversationToSide(state:LayoutState,bindingId:string):LayoutState {
  if(state.composition)return state;
  const binding=state.surfaces[bindingId];
  if(binding?.kind!=="encounter"||binding.ref!==state.accompanying?.ref||binding.project!==state.accompanying?.project||binding.encounter?.space!==state.accompanying?.space)return state;
  const group=groupsOf(state.root).find(group=>group.tabs.includes(bindingId));
  if(!group)return state;
  const previous=binding.view?.encounterReturnSurfaceId;
  let next=state;
  if(group.pinned.includes(bindingId)) {
    const replacement=group.tabs.find(id=>id===previous)??group.tabs.find(id=>id!==bindingId)??null;
    const replace=(pane:Pane):Pane=>pane.type==="group"?(pane.id===group.id?{...pane,active:replacement}:pane):{...pane,children:pane.children.map(replace)};
    next={...state,root:state.root?replace(state.root):null};
  } else next=closeSurface(state,bindingId);
  if(previous&&groupsOf(next.root).some(item=>item.tabs.includes(previous)))next=activateSurface(next,previous);
  return {...next,rightDepth:"panel",surfaces:{...next.surfaces,[bindingId]:{...binding,view:{...binding.view,encounterReturnSurfaceId:undefined}}}};
}
