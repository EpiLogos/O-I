/**
 * The expression intent producers (Global Expression Stage). This module
 * keeps the semantic knowledge the old overlay system accumulated —
 * layout-transition intents, resize gestures, source-save receipts — and
 * routes all of it into the stage as cues and form expressions. It owns
 * no renderer: the stage owns where expressions live and how they render.
 *
 * Owner ruling 2026-09-17: no motion expressions stand in the product yet.
 * The layout cue/gesture posts, the resize-gesture effects and the
 * save-receipt intent are held off (history: this file before this date);
 * the stage stays exclusively with real presentations — the opening field
 * and focused instruments. When a deliberate motion grammar is adopted it
 * returns here through the same seam, never as ambient flourishes.
 */
import {lazy,Suspense,useEffect,useRef,type ReactNode} from "react";
import {activeBindingId} from "../surface/engine";
import {useExpressionStage} from "../stage/ExpressionStage";
import {registerExpressionTarget} from "../stage/targets";
// K9's composition reaches the Nara adapter and the stage recipes (the
// engine's scene model): it loads with the first focused instrument
// binding, never at startup.
const FocusedInstrumentComposition=lazy(()=>import("../instrument/FocusedInstrumentComposition").then((module)=>({default:module.FocusedInstrumentComposition})));
import type {LayoutState} from "../surface/types";

export function ExpressionLayout({layout}:{layout:LayoutState}) {
 // K9 is a privileged composition of existing owners, not another shell or
 // renderer. The component portals only while an instrument binding is the
 // active surface; ordinary expression mode is therefore unchanged.
 const active=activeBindingId(layout),binding=active?layout.surfaces[active]:undefined;
 const instrument=!!binding&&binding.kind==="instrument"&&!!binding.ref;
 return instrument?<Suspense fallback={null}><FocusedInstrumentComposition layout={layout}/></Suspense>:null;
}

/** The React seam around the stage. It contributes no ambient effects: the
 * pointer-driven resize gestures and their accepted-resize edge expression
 * are held off under the owner ruling above. */
export function ExpressionProvider({children}:{children:ReactNode}) {
 return <>{children}</>;
}

/** The agent's expression anchor: a stable presentation target plus the
 * listening-form vocabulary addressed at it. */
export function ExpressionAnchor({form}:{form:import("@epilogos/oi-design-system/expression").FormName}) {
 const stage=useExpressionStage(),anchor=useRef<HTMLSpanElement>(null),handle=useRef<number|null>(null),current=useRef(form);current.current=form;
 useEffect(()=>{
  const geometry=()=>{
   const el=anchor.current;
   return el&&el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'?el.getBoundingClientRect():null;
  };
  const stopTarget=registerExpressionTarget('agent.anchor',geometry);
  const refresh=()=>{
   const updated=stage.update(handle.current,{name:current.current,rect:geometry});
   if(!updated&&geometry())handle.current=stage.express(current.current,{rect:geometry,hold:true});
  };
  refresh();const timer=window.setInterval(refresh,10000);
  const observer=new ResizeObserver(refresh);if(anchor.current)observer.observe(anchor.current);
  const visible=new IntersectionObserver(refresh);if(anchor.current)visible.observe(anchor.current);
  document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);observer.disconnect();visible.disconnect();document.removeEventListener('visibilitychange',refresh);stopTarget();stage.release(handle.current);handle.current=null;};
 },[stage]);
 useEffect(()=>{stage.update(handle.current,{name:form});},[stage,form]);
 return <span ref={anchor} className="oi-expression-anchor" aria-hidden="true"/>;
}
