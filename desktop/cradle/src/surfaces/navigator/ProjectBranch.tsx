import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { ProjectMode, ProjectNavigation } from "../../workspace/store";
import { Glyph } from "../../workspace/Glyph";

/** How long after a wheel/key/touch gesture the scroll events it produces
 * still count as the owner's. Momentum and repeated ticks renew it. */
const GESTURE_WINDOW_MS=250;

export function ProjectModes({name, mode, onMode}: {name:string; mode:ProjectMode; onMode:(mode:ProjectMode)=>void}) {
  return <nav className="project-modes" aria-label={`${name} modes`}>
    {(["chats","files","wiki"] as const).map(value=><button key={value}
      aria-label={`${name}: ${value === "chats" ? "chats and tasks" : value}`}
      title={value === "chats" ? "Chats and tasks" : value === "files" ? "Files" : "Wiki"}
      aria-pressed={value===mode} onClick={()=>onMode(value)}>
      <Glyph name={value === "chats" ? "chat" : value === "files" ? "file" : "wiki"} size={12}/>
    </button>)}
  </nav>;
}

/** Only view state and owner-disclosed content cross this presentation seam. */
export function ProjectBranch({name,path,selected,navigation,onBrowse,onDisclosure,onMode,onScroll,children}: {
  name:string; path:string; selected:boolean; navigation:ProjectNavigation;
  onBrowse:()=>void; onDisclosure:(expanded:boolean)=>void;
  onMode:(mode:ProjectMode)=>void; onScroll:(scroll:number)=>void; children:ReactNode;
}) {
  const body=useRef<HTMLElement>(null);
  // The persisted scroll is the owner's intent. Layout moves scrollTop
  // without any intent behind it — a listing still loading, a box not yet
  // sized (clientHeight 0), a viewport resize clamping to a shorter
  // content — and those moves are neither persisted nor allowed to displace
  // the intended position: whenever the section or its content resizes the
  // intended value is re-applied. Only a gesture on the section (wheel,
  // pointer, keyboard, touch, focus) makes a scroll position the owner's.
  // A restore that "completes" against a transient layout and then hands
  // control to the scroll handler was the source of the persisted position
  // silently drifting (spatial walk: 90 → 78 after reload, 90 → 38 after a
  // viewport resize).
  const intended=useRef(navigation.scroll);
  const gestureUntil=useRef(0);
  const pointerHeld=useRef(false);
  const gesturing=()=>pointerHeld.current||performance.now()<gestureUntil.current;
  const gesture=()=>{gestureUntil.current=performance.now()+GESTURE_WINDOW_MS;};
  const holdPointer=()=>{
    pointerHeld.current=true;
    const release=()=>{
      window.removeEventListener("pointerup",release);
      window.removeEventListener("pointercancel",release);
      pointerHeld.current=false;gesture();
    };
    window.addEventListener("pointerup",release);
    window.addEventListener("pointercancel",release);
  };
  useLayoutEffect(()=>{
    const element=body.current;
    if(!element)return;
    intended.current=navigation.scroll;
    const restore=()=>{if(!gesturing()&&element.scrollTop!==intended.current)element.scrollTop=intended.current;};
    restore();
    // The box resizes only up to its max-height; past that, content growth
    // (listings landing, folders opening) shows up as subtree mutations, not
    // as a resize — and the listing's first child is replaced once its
    // reading lands, so observing that node alone would go quiet.
    const resized=new ResizeObserver(restore);
    resized.observe(element);
    const mutated=new MutationObserver(restore);
    mutated.observe(element,{childList:true,subtree:true,attributes:true});
    return()=>{resized.disconnect();mutated.disconnect();};
  },[path,navigation.expanded,navigation.mode]);
  return <li data-navigation-path={path}>
    <button data-project-path={path} aria-current={selected ? "true" : undefined} onClick={onBrowse} title={name}>
      <span className="project-mark" aria-hidden="true"/><span className="project-name">{name}</span>
    </button>
    <button className="project-disclosure" aria-label={`${navigation.expanded ? "Collapse" : "Expand"} ${name}`}
      aria-expanded={navigation.expanded} onClick={()=>onDisclosure(!navigation.expanded)}>›</button>
    <ProjectModes name={name} mode={navigation.mode??"chats"} onMode={onMode}/>
    {navigation.expanded && <section ref={body} className="project-files" aria-label={`${name} navigation`}
      onWheel={gesture} onKeyDown={gesture} onTouchStart={gesture} onTouchMove={gesture} onFocus={gesture} onPointerDown={holdPointer}
      onScroll={event=>{
        const element=event.currentTarget;
        // A scroll with no gesture behind it is a layout displacement (a
        // clamp against a shorter transient listing): put the intended
        // position back as far as the content allows, and never persist it.
        if(!gesturing()){if(element.scrollTop!==intended.current)element.scrollTop=intended.current;return;}
        intended.current=element.scrollTop;onScroll(intended.current);
      }}>{children}</section>}
  </li>;
}
