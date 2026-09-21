import {useEffect,useRef} from "react";
import type {RefObject} from "react";
import {registerPageObservation,releaseObservation} from "./ComponentSelection";
import type {SelectionCandidate} from "./selectionModel";

/** Native DOM text selection for authored host content (Flow entries, etc.).
 * A rendered Range is an observation, never an offset into the backing HTML.
 * CodeMirror and sandboxed iframe selections retain their existing adapters. */
export function useHostSelection(root:RefObject<HTMLElement>):()=>boolean {
 const chosen=useRef<SelectionCandidate>();
 useEffect(()=>{
  const element=root.current;if(!element)return;
  const documentId=crypto.randomUUID();const owned=new Set<string>();let frame=0;
  const excluded=".cm-editor,input,textarea,select,.editor-command-line,.editor-footer,.document-returns,.shared-field-material,.document-contributions,.source-history,.source-conflict";
  const clear=()=>{if(chosen.current){chosen.current=undefined;element.dispatchEvent(new CustomEvent("oi:selection-anchor",{detail:{selected:false}}));window.dispatchEvent(new CustomEvent("oi:selection-preview",{detail:undefined}));}};
  const read=()=>{
   const selected=window.getSelection();
   if(!selected||selected.rangeCount!==1||selected.isCollapsed){clear();return;}
   const range=selected.getRangeAt(0),parent=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE?range.commonAncestorContainer as Element:range.commonAncestorContainer.parentElement;
   if(!parent||!element.contains(parent)||!parent.closest(".editor-content")||parent.closest(excluded)||range.cloneContents().querySelector(excluded)){clear();return;}
   const bindingId=element.closest<HTMLElement>("[data-binding-id]")?.dataset.bindingId;if(!bindingId)return;
   const text=range.toString();if(!text.trim())return;
   const retained=range.cloneRange(),basis=parent.textContent;
   const identity=parent.closest<HTMLElement>("[data-source-ref],[data-node-ref],[data-flow-entry],[data-fixture-id]");
   const selector=identity?.dataset.flowEntry?`[data-flow-entry=${JSON.stringify(identity.dataset.flowEntry)}]`:identity?.dataset.fixtureId?`[data-fixture-id=${JSON.stringify(identity.dataset.fixtureId)}]`:parent.tagName.toLowerCase();
   const observationKey=registerPageObservation(text,async()=>parent.isConnected&&element.contains(parent)&&parent.textContent===basis&&retained.toString()===text,enabled=>{
    const css=CSS as typeof CSS&{highlights?:Map<string,unknown>};
    const Highlight=(window as unknown as {Highlight?:new(...ranges:Range[])=>unknown}).Highlight;
    if(!css.highlights||!Highlight)return;
    if(enabled)activeRanges.set(observationKey,retained);else activeRanges.delete(observationKey);
    css.highlights.set("oi-host-context",new Highlight(...activeRanges.values()));
   });
   owned.add(observationKey);if(owned.size>64){const oldest=owned.values().next().value!;owned.delete(oldest);releaseObservation(oldest);}
   const bounds=range.getBoundingClientRect();
   chosen.current={bindingId,kind:"element",text,observationKey,documentId:element.dataset.documentId??documentId,selector,role:"text",nodeRef:identity?.dataset.sourceRef??identity?.dataset.nodeRef??identity?.dataset.flowEntry??identity?.dataset.fixtureId,revision:element.dataset.sourceRevision,sourceRef:element.dataset.sourceRef,workingCopy:element.dataset.workingCopy==="true"};
   window.dispatchEvent(new CustomEvent("oi:selection-preview",{detail:chosen.current}));
   element.dispatchEvent(new CustomEvent("oi:selection-anchor",{detail:{selected:true,bounds:{x:bounds.x,y:bounds.bottom}}}));
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(read);};
  const key=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.shiftKey&&event.code==="Digit2"&&chosen.current){event.preventDefault();window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:chosen.current}));}};
  element.addEventListener("pointerup",schedule);element.addEventListener("keyup",schedule);element.addEventListener("keydown",key);
  document.addEventListener("selectionchange",schedule);
  return()=>{cancelAnimationFrame(frame);element.removeEventListener("pointerup",schedule);element.removeEventListener("keyup",schedule);element.removeEventListener("keydown",key);document.removeEventListener("selectionchange",schedule);for(const key of owned)releaseObservation(key);chosen.current=undefined;};
 },[root]);
 return ()=>{if(!chosen.current)return false;window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:chosen.current}));return true;};
}
const activeRanges=new Map<string,Range>();
