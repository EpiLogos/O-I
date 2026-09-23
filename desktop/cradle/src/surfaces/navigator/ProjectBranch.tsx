import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { ProjectMode, ProjectNavigation } from "../../workspace/store";
import { Glyph } from "../../workspace/Glyph";
import { ProjectMarkBadges } from "../../workspace/left/rows";
import type { ProjectMarks } from "../../workspace/left/sessionMarks";

/** How long after a wheel/key/touch gesture the scroll events it produces
 * still count as the owner's. Momentum and repeated ticks renew it. */
const GESTURE_WINDOW_MS=250;

export function ProjectModes({name, mode, current, onMode}: {name:string; mode:ProjectMode; current:boolean; onMode:(mode:ProjectMode)=>void}) {
  return <nav className="project-modes" aria-label={`${name} modes`}>
    {(["chats","files","wiki"] as const).map(value=><button key={value}
      aria-label={`${name}: ${value === "chats" ? "chats and tasks" : value}`}
      title={value === "chats" ? "Chats and tasks" : value === "files" ? "Files" : "Wiki"}
      /* Owner ruling 2026-09-18: only the row the reader is actually in may
       * light its mode icon — a row that merely defaults to chats is quiet. */
      aria-pressed={current && value===mode ? true : undefined} onClick={()=>onMode(value)}>
      <Glyph name={value === "chats" ? "chat" : value === "files" ? "file" : "wiki"} size={12}/>
    </button>)}
  </nav>;
}

/** Only view state and owner-disclosed content cross this presentation seam.
 * The row click is a pure disclosure toggle — one click opens, one click
 * closes, never an owner call in between; the workspace's project context
 * follows the work the reader actually opens, not the disclosure itself. */
export function ProjectBranch({name,path,selected,navigation,marks,onDisclosure,onMode,onScroll,children}: {
  name:string; path:string; selected:boolean; navigation:ProjectNavigation;
  /** §3.3: the aggregate of the project's conversations — ● working, ! needs you. */
  marks?: ProjectMarks;
  onDisclosure:(expanded:boolean)=>void;
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
  const markWords=marks?[marks.working?`${marks.working} working`:"",marks.needsYou?`${marks.needsYou} need${marks.needsYou===1?"s":""} you`:""].filter(Boolean).join(", "):"";
  return <li data-navigation-path={path} data-marks={marks&&(marks.working||marks.needsYou)?"true":undefined}>
    <button data-project-path={path} aria-current={selected ? "true" : undefined} aria-expanded={navigation.expanded} onClick={()=>onDisclosure(!navigation.expanded)} title={name} aria-label={markWords?`${name} — ${markWords}`:name}>
      <Glyph name="folder" size={13}/><span className="project-name">{name}</span>
      {marks&&<ProjectMarkBadges working={marks.working} needsYou={marks.needsYou}/>}
    </button>
    <ProjectModes name={name} mode={navigation.mode??"chats"} current={selected} onMode={onMode}/>
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
