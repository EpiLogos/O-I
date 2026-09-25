/** A pointer/keyboard gesture (drag, resize) fires many intermediate
 * callbacks from the vendored Canvas before it settles. Each of those
 * callbacks used to enter the native durable-write loop directly — one CAS
 * commit per pointer move. That is wrong: a gesture is one user intention
 * and must produce exactly one native write, at its end, carrying the final
 * value. This module holds no React, no native transport and no DOM
 * dependency beyond an injectable event target; it only turns a stream of
 * "preview" calls into a single "commit" call per node, per gesture. */

export interface GestureEventTarget {
 addEventListener(type:string,listener:EventListenerOrEventListenerObject,options?:AddEventListenerOptions|boolean):void;
 removeEventListener(type:string,listener:EventListenerOrEventListenerObject,options?:EventListenerOptions|boolean):void;
}

const GESTURE_END_EVENTS=['pointerup','pointercancel','mouseup'] as const;

export interface GestureTransactionOptions<T> {
 /** Called at most once per node per gesture, with the last previewed value. */
 commit:(nodeId:string,value:T)=>Promise<void>;
 /** Called whenever the set of pending previews changes (added or cleared),
  * so the host can re-render nodes with the preview overlay applied. */
 onChange:()=>void;
 /** A commit rejected; the preview for that node is already gone by the time
  * this fires (dropped before the commit was awaited). */
 onError?:(nodeId:string,error:unknown)=>void;
 /** Idle flush for gestures with no pointer event to end them (e.g. a
  * keyboard-driven move). Defaults to 300ms of no further preview() calls. */
 idleMs?:number;
 /** Defaults to the real `window`. Tests inject a fake EventTarget. */
 eventTarget?:GestureEventTarget;
 /** Defaults to `(fn) => setTimeout(fn, 0)` — a macrotask, so a synchronous
  * onNodeDragStop firing off the same native event lands its own preview()
  * call before the flush runs. Tests can inject a synchronous scheduler. */
 scheduleMacrotask?:(fn:()=>void)=>void;
 /** Defaults to real timers. Tests can inject a fake clock. */
 setTimer?:(fn:()=>void,ms:number)=>unknown;
 clearTimer?:(handle:unknown)=>void;
}

export interface GestureTransaction<T> {
 /** Record the latest value for a node during an in-progress gesture. Safe
  * to call any number of times; only the last value per node survives to
  * the eventual single commit. `held` marks a preview from a pointer the
  * person is still holding: it never arms the idle fallback, so a slow or
  * paused drag cannot commit mid-gesture; its end comes from the pointer. */
 preview(nodeId:string,value:T,held?:boolean):void;
 /** The node's current preview value, if a gesture is in progress for it. */
 previewValue(nodeId:string):T|undefined;
 /** Force an immediate flush, bypassing the idle timer and pointer wait.
  * Exposed for deterministic tests and for callers that know a gesture is
  * logically over without a DOM event to prove it. */
 flushNow():Promise<void>;
 /** Detach any armed listeners/timers without committing. */
 dispose():void;
}

function defaultEventTarget():GestureEventTarget|undefined{
 return typeof window==='undefined'?undefined:window;
}

export function createGestureTransaction<T>(options:GestureTransactionOptions<T>):GestureTransaction<T>{
 const idleMs=options.idleMs??300;
 const eventTarget=options.eventTarget??defaultEventTarget();
 const scheduleMacrotask=options.scheduleMacrotask??((fn:()=>void)=>setTimeout(fn,0));
 const setTimer=options.setTimer??((fn:()=>void,ms:number)=>setTimeout(fn,ms));
 const clearTimer=options.clearTimer??((handle:unknown)=>clearTimeout(handle as ReturnType<typeof setTimeout>));

 const pending=new Map<string,T>();
 let armed=false;
 let idleHandle:unknown=null;
 let endListener:((event:Event)=>void)|null=null;

 function clearIdle(){if(idleHandle!==null){clearTimer(idleHandle);idleHandle=null;}}

 function detachEndListener(){
  if(!endListener||!eventTarget)return;
  for(const type of GESTURE_END_EVENTS)eventTarget.removeEventListener(type,endListener,true);
  endListener=null;
 }

 async function flush():Promise<void>{
  detachEndListener();
  clearIdle();
  armed=false;
  if(!pending.size)return;
  const entries=[...pending.entries()];
  pending.clear();
  // Drop the previews and let the host re-render from native state before
  // the commits are even awaited: a failed commit must never leave a stale
  // preview on screen, and a successful one is superseded by the host's own
  // re-render once the native write lands.
  options.onChange();
  await Promise.all(entries.map(([nodeId,value])=>
   options.commit(nodeId,value).catch(error=>{options.onError?.(nodeId,error);})
  ));
 }

 function armEndListener(){
  if(armed||!eventTarget)return;
  armed=true;
  endListener=()=>{
   detachEndListener();
   // Macrotask, not microtask: the same native pointerup that reaches this
   // capture listener also drives the vendored Canvas's own drag-stop
   // handler (onNodeDragStop), which calls preview() once more with the
   // final position. That handler runs in the bubble phase, after this
   // capture-phase listener returns, so scheduling the flush a tick later
   // guarantees the final preview value is the one committed.
   scheduleMacrotask(()=>{void flush();});
  };
  for(const type of GESTURE_END_EVENTS)eventTarget.addEventListener(type,endListener,true);
 }

 function armIdleFallback(){
  clearIdle();
  idleHandle=setTimer(()=>{void flush();},idleMs);
 }

 return {
  preview(nodeId,value,held=false){
   pending.set(nodeId,value);
   options.onChange();
   armEndListener();
   if(held)clearIdle();else armIdleFallback();
  },
  previewValue(nodeId){return pending.get(nodeId);},
  flushNow(){return flush();},
  dispose(){detachEndListener();clearIdle();pending.clear();armed=false;},
 };
}

/** Pure helper: overlay any in-progress preview position/size onto the
 * committed node list for rendering. Never mutates `nodes` or the preview
 * map; the Canvas remains fully controlled by props. */
export function withGesturePreviews<N extends {id:string;position:{x:number;y:number};size:{width:number;height:number}}>(
 nodes:readonly N[],
 previewPosition:(nodeId:string)=>{x:number;y:number}|undefined,
 previewSize:(nodeId:string)=>{width:number;height:number}|undefined,
):N[]{
 return nodes.map(node=>{
  const position=previewPosition(node.id),size=previewSize(node.id);
  if(!position&&!size)return node;
  return {...node,...(position?{position}:{}),...(size?{size}:{})};
 });
}
