import {useEffect,useMemo,useRef,useState} from "react";
import {DEFAULT_WELCOME_PHRASES,type WelcomePhrase,type WelcomePlacement} from "./welcomePhrases";
import "./welcome.css";

export interface WelcomePromptProps {
  phrases?: readonly WelcomePhrase[];
  intervalMs?: number;
  placement?: Exclude<WelcomePlacement,"either">;
  paused?: boolean;
}

/** A quiet, presentation-only welcome. It owns no draft or Flow operation.
 *
 * Length robustness: EVERY eligible phrase is rendered inside the invisible
 * reserve beneath the active heading, so the stage's row is always sized by
 * the tallest statement at the current width. Statements that wrap to two or
 * three lines are anticipated by construction — when the rotation lands on a
 * longer phrase, the box is already that tall and nothing beside or below
 * (the activity boxes, the composer, the pane) is displaced. */
export function WelcomePrompt({phrases=DEFAULT_WELCOME_PHRASES,intervalMs=7000,placement="opening",paused=false}:WelcomePromptProps) {
  const root=useRef<HTMLDivElement>(null);
  const eligible=useMemo(()=>phrases.filter(phrase=>phrase.placement==="either"||phrase.placement===placement),[phrases,placement]);
  const [index,setIndex]=useState(0);
  const [rotating,setRotating]=useState(false);

  useEffect(()=>setIndex(current=>eligible.length?current%eligible.length:0),[eligible.length]);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const surface=root.current?.closest<HTMLElement>(".fresh-surface")??root.current;
    let frame=0;
    const read=()=>setRotating(!paused&&eligible.length>1&&!document.hidden&&document.hasFocus()&&!media.matches&&!surface?.matches(":focus-within"));
    const defer=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(read);};
    read();
    document.addEventListener("visibilitychange",read);
    window.addEventListener("focus",read);window.addEventListener("blur",read);
    surface?.addEventListener("focusin",read);surface?.addEventListener("focusout",defer);
    media.addEventListener("change",read);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener("visibilitychange",read);window.removeEventListener("focus",read);window.removeEventListener("blur",read);surface?.removeEventListener("focusin",read);surface?.removeEventListener("focusout",defer);media.removeEventListener("change",read);};
  },[eligible.length,paused]);
  useEffect(()=>{
    if(!rotating)return;
    const timer=window.setTimeout(()=>setIndex(current=>(current+1)%eligible.length),Math.max(2000,intervalMs));
    return()=>window.clearTimeout(timer);
  },[eligible.length,index,intervalMs,rotating]);

  const phrase=eligible[index];
  if(!phrase)return null;
  return <div ref={root} className="welcome-prompt-roller" data-tone={phrase.tone} data-placement={placement} data-rotating={rotating}>
    <span className="welcome-prompt-reserve" aria-hidden="true">
      {eligible.map(item=><span key={item.id}>{item.text}</span>)}
    </span>
    <h2 key={phrase.id}>{phrase.text}</h2>
  </div>;
}
