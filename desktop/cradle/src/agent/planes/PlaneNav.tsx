import {useLayoutEffect,useRef,useState} from "react";
import {Glyph,type GlyphName} from "../../workspace/Glyph";

/** One leading glyph per plane — the sidebar reads as a glyph column and a
 * text column (navigator glyph law). Glyphs are aria-hidden SVGs, so every
 * button's accessible name stays exactly its label. */
const PLANE_GLYPH:Record<string,GlyphName>={
  Chat:"chat",Conversation:"chat",
  run:"activity",Run:"activity","ta-run":"activity",
  agents:"agent",Agents:"agent","ta-onta-agents":"agent",
  Context:"context","factory-context":"context","ta-onta-context":"context",
  Inspect:"inspect",Composition:"field",
};
const glyphOf=(id:string):GlyphName|undefined=>PLANE_GLYPH[id]??(id==="Activity"?"activity":undefined);

/** The panel's plane navigation with a measured overflow. A mode may offer
 * more views than a 240–320px panel can name in one row (Factory's desk:
 * Trajectory / Context / Skills & tools / Claims & evidence / Results /
 * Inspect): the row shows what fits, the rest are one "More" menu away, and
 * the current plane is always in the row. Nothing is dropped, nothing scrolls
 * sideways, and the strip never grows a second line. Measurement runs on
 * resize and when the entries change — no timers, no polling. */
export function PlaneNav({entries,current,onSelect}:{entries:{id:string;label:string}[];current:string;onSelect:(id:string)=>void}) {
  const host=useRef<HTMLElement>(null);const measure=useRef<HTMLDivElement>(null);
  const [fit,setFit]=useState(entries.length);const [open,setOpen]=useState(false);
  const signature=entries.map(entry=>entry.id).join("|");
  useLayoutEffect(()=>{
    const node=host.current,ruler=measure.current;if(!node||!ruler)return;
    const compute=()=>{
      const style=getComputedStyle(node);const gap=parseFloat(style.columnGap)||0;
      const room=node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
      const widths=Array.from(ruler.children).map(child=>(child as HTMLElement).offsetWidth);
      const total=widths.reduce((sum,width,index)=>sum+width+(index?gap:0),0);
      if(total<=room){setFit(entries.length);return;}
      const more=28+gap;let used=0,count=0;
      for(const width of widths){const next=used+width+(count?gap:0);if(next+more>room)break;used=next;count++;}
      setFit(Math.max(1,count));
    };
    compute();const observer=new ResizeObserver(compute);observer.observe(node);return()=>observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[signature]);
  useLayoutEffect(()=>{
    if(!open)return;
    const close=(event:Event)=>{if(event instanceof KeyboardEvent?event.key==="Escape":!host.current?.querySelector(".agent-planes-more")?.contains(event.target as Node))setOpen(false);};
    document.addEventListener("pointerdown",close);document.addEventListener("keydown",close);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",close);};
  },[open]);
  // The current plane always reads in the row: when it would overflow it takes the last visible place.
  const visible=entries.slice(0,fit);
  const at=entries.findIndex(entry=>entry.id===current);
  if(at>=fit&&at>=0)visible[visible.length-1]=entries[at];
  const hidden=entries.filter(entry=>!visible.includes(entry));
  return <nav ref={host} className="agent-planes oi-plane-nav" aria-label="Right region planes">
    {visible.map(entry=><button key={entry.id} aria-pressed={current===entry.id} onClick={()=>onSelect(entry.id)}>{glyphOf(entry.id)&&<Glyph name={glyphOf(entry.id)!} size={12}/>}<span>{entry.label}</span></button>)}
    {hidden.length>0&&<div className="agent-planes-more">
      <button className="oi-tool" aria-label={`More views (${hidden.length})`} aria-haspopup="true" aria-expanded={open} title="More views" onClick={()=>setOpen(value=>!value)}><Glyph name="more" size={13}/></button>
      {open&&<div className="oi-menu" role="group" aria-label="More views">{hidden.map(entry=><button key={entry.id} className="oi-menu-item" onClick={()=>{setOpen(false);onSelect(entry.id);}}>{glyphOf(entry.id)&&<Glyph name={glyphOf(entry.id)!} size={12}/>}<span>{entry.label}</span></button>)}</div>}
    </div>}
    <div ref={measure} className="agent-planes-ruler" aria-hidden="true">{entries.map(entry=><button key={entry.id} tabIndex={-1}>{entry.label}</button>)}</div>
  </nav>;
}
