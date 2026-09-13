/**
 * The expression intent producers (Global Expression Stage). This module
 * keeps the semantic knowledge the old overlay system accumulated —
 * layout-transition intents, resize gestures, source-save receipts — and
 * routes all of it into the stage as cues and form expressions. It owns
 * no renderer: the stage owns where expressions live and how they render.
 */
import {useEffect,useRef,type ReactNode} from "react";
import {gestureFor,type FormName} from "@epilogos/oi-design-system/expression";
import {surfaceExpressionChanges} from "../surface/engine";
import type {LayoutState} from "../surface/types";
import {useKernel} from "../kernel/KernelProvider";
import {emitExpressionCue} from "../stage/cues";
import {registerExpressionTarget} from "../stage/targets";
import {useExpressionStage} from "../stage/ExpressionStage";

/** Called by the accepting React handler, not inferred from a bubbling key.
 * The stage will still require changed, settled DOM geometry before expressing. */
export function requestResizeExpression(target:HTMLElement,before:DOMRect) {
 document.dispatchEvent(new CustomEvent('oi:resize-accepted',{detail:{target,before}}));
}

export function ExpressionLayout({layout}:{layout:LayoutState}) {
 const prior=useRef(layout),kernel=useKernel(),seen=useRef<number|null>(null);
 useEffect(()=>{
  const changes=surfaceExpressionChanges(prior.current,layout);prior.current=layout;
  // The committed facts are cued at once (surface.opened/closed/resized
  // at the group target); the gesture intents below still wait for the
  // geometry transitions to finish before they are claimed.
  for(const change of changes){
   emitExpressionCue({kind:change.intent==='open'?'surface.opened':change.intent==='close'?'surface.closed':'surface.resized',target:change.groupId});
  }
  const posts=changes.map(change=>{
   const element=document.querySelector<HTMLElement>(`[data-group-id="${CSS.escape(change.groupId)}"]`)??document.querySelector<HTMLElement>('.desktop-centre');
   if(!element)return()=>{};
   return afterExpressionTransition(element,()=>window.dispatchEvent(new CustomEvent('oi:expression-intent',{detail:{...change,disposition:gestureFor(change.intent)===null?'reserved':'active'}})));
  });
  return()=>posts.forEach(cancel=>cancel());
 },[layout]);
 useEffect(()=>{
  if(seen.current!==null)for(const receipt of kernel.receipts) {
   if(receipt.seq>seen.current&&receipt.event==='source_changed'){
    window.dispatchEvent(new CustomEvent('oi:expression-intent',{detail:{intent:'save',receiptSeq:receipt.seq,disposition:'reserved'}}));
    emitExpressionCue({kind:'source.saved'});
   }
  }
  seen.current=Math.max(seen.current??0,...kernel.receipts.map(receipt=>receipt.seq));
 },[kernel.receipts]);
 return null;
}

/** One stage per native or detached window; this provider contributes the
 * pointer-driven resize gestures to it. All subscriptions are presentation only. */
export function ExpressionProvider({children}:{children:ReactNode}) {
 const stage=useExpressionStage();
 useEffect(()=>{
  const pending=new Map<HTMLElement,()=>void>();
  let held:number|null=null,separator:HTMLElement|null=null,last:[number,number]|null=null;
  // Bubble after React's resize handler: its geometry lands before we read bounds.
  const move=(event:PointerEvent)=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('.region-resizer,.split-resizer'):null;
   if(!target?.hasPointerCapture(event.pointerId))return;
   const dir=last?[event.clientX-last[0],event.clientY-last[1]]:[1,0];last=[event.clientX,event.clientY];
   if(!dir.some(Boolean))return;
   if(separator!==target){stage.release(held);held=null;separator=target;}
   const options={rect:()=>target.isConnected?target.getBoundingClientRect():null,dir,hold:true};
   if(!stage.update(held,options))held=stage.express(gestureFor('resize')!,options);
  };
  const release=()=>{stage.release(held);held=null;separator=null;last=null;};
  const accepted=(event:Event)=>{
   if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const {target,before}=(event as CustomEvent<{target:HTMLElement;before:DOMRect}>).detail;
   if(!target?.matches('.region-resizer,.split-resizer'))return;
   pending.get(target)?.();
   let frame=0,stable=0,last=before;const start=performance.now();
   const stop=()=>{cancelAnimationFrame(frame);pending.delete(target);};
   const difference=(a:DOMRect,b:DOMRect)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs(a.width-b.width),Math.abs(a.height-b.height));
   const check=()=>{
    if(!target.isConnected||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){stop();return;}
    const rect=target.getBoundingClientRect(),changed=difference(rect,before)>.01;
    stable=difference(rect,last)<.01?stable+1:0;last=rect;
    if(changed&&stable>=2&&rect.width>0&&rect.height>0){
     stop();stage.express('edge',{rect:()=>target.isConnected?target.getBoundingClientRect():null,dir:[rect.x-before.x,rect.y-before.y]});return;
    }
    // Covers the shell's JS geometry loop as well as CSS/flex layouts. No
    // expression is claimed for clamped keys, interrupted work or timeout.
    if(performance.now()-start>=1000){stop();return;}
    frame=requestAnimationFrame(check);
   };
   pending.set(target,stop);frame=requestAnimationFrame(check);
  };
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);document.addEventListener('lostpointercapture',release);document.addEventListener('oi:resize-accepted',accepted);
  window.addEventListener('blur',release);
  return()=>{for(const stop of pending.values())stop();release();document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',release);document.removeEventListener('pointercancel',release);document.removeEventListener('lostpointercapture',release);document.removeEventListener('oi:resize-accepted',accepted);window.removeEventListener('blur',release);};
 },[stage]);
 return <>{children}</>;
}

/** Geometry transitions finish first. Instant layouts need only their commit frame.
 * The returned cancellation also bounds the listener when a target disappears. */
export function afterExpressionTransition(element:HTMLElement,post:()=>void) {
 let cancelled=false;
 const animations=element.getAnimations().filter(animation=>animation.playState==='running'&&animation.effect?.getComputedTiming().iterations!==Infinity);
 if(animations.length)void Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{if(!cancelled&&element.isConnected)post();});
 else queueMicrotask(()=>{if(!cancelled&&element.isConnected)post();});
 return()=>{cancelled=true;};
}

/** The agent's expression anchor: a stable presentation target plus the
 * listening-form vocabulary addressed at it. */
export function ExpressionAnchor({form}:{form:FormName}) {
 const stage=useExpressionStage(),anchor=useRef<HTMLSpanElement>(null),handle=useRef<number|null>(null),current=useRef(form);current.current=form;
 useEffect(()=>{
  const geometry=()=>{
   const el=anchor.current;
   return el&&el.isConnected&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'?el.getBoundingClientRect():null;
  };
  const stopTarget=registerExpressionTarget('agent.anchor',geometry);
  const refresh=()=>{
   if(!geometry())return;
   if(!stage.update(handle.current,{name:current.current,rect:geometry}))handle.current=stage.express(current.current,{rect:geometry,hold:true});
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
