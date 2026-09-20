import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
// @ts-ignore — the instrument's actual icon vocabulary is shared, not redrawn.
import { icon } from '@epilogos/oi-design-system/expressions-engine/shell/icons.mjs';
import { safeUrl, type LibraryEntry } from './model.mjs';
export function Icon({name}:{name:string}) {return <span className="library-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon(name)}}/>;}
export function Tool({name,label,...props}:{name:string;label:string}&ButtonHTMLAttributes<HTMLButtonElement>){return <button type="button" className="reader-tool" title={label} aria-label={label} {...props}><Icon name={name}/></button>;}
/** Adapted from Point-Cloud-Demo expressions.ts compositionCover. Static,
 * labelled first-configuration thumbnail; never substitutes for the live GPU. */
export function Cover({entry}:{entry:LibraryEntry}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current!;const observer=new IntersectionObserver(records=>{if(!records.some(r=>r.isIntersecting))return;observer.disconnect();
  const ctx=canvas.getContext('2d');if(!ctx)return;const w=560,h=350;ctx.fillStyle='#f4f2ec';ctx.fillRect(0,0,w,h);
  let seed=7134;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d',{willReadFrequently:true});if(!m)return;
  for(const g of entry.cover??[]){m.clearRect(0,0,w,h);m.fillStyle='#111';m.textAlign='center';m.textBaseline='middle';m.font=`500 ${Math.max(20,g.scale*210)}px Arial`;m.fillText(g.glyph,w*.51+g.x/400*140,h*.48-g.y/400*140);const pixels=m.getImageData(0,0,w,h).data;ctx.fillStyle='#171818';for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const px=x+random()*2,py=y+random()*2;if(pixels[(Math.floor(py)*w+Math.floor(px))*4+3]<50||random()>.75)continue;ctx.globalAlpha=.48+random()*.52;ctx.beginPath();ctx.arc(px,py,.4+random()*.52,0,Math.PI*2);ctx.fill();}}
  ctx.globalAlpha=1;
 },{rootMargin:'120px'});observer.observe(canvas);return()=>observer.disconnect();},[entry]);
 return <canvas ref={ref} width={560} height={350} role="img" aria-label={`Static composition preview of ${entry.title}`}/>;
}
function inline(text:string):ReactNode[]{
 return text.split(/(\[[^\]]+\]\([^)]*\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part,i)=>{
  const link=part.match(/^\[([^\]]+)\]\(([^)]*)\)$/);if(link){const url=safeUrl(link[2],location.href);return url?<a key={i} href={url} target={url.startsWith(location.origin)?undefined:'_blank'} rel="noreferrer">{link[1]}</a>:link[1];}
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
  if(part.startsWith('*')&&part.endsWith('*'))return <em key={i}>{part.slice(1,-1)}</em>;
  return part;
 });
}
/** Safe text renderer: published source cannot execute markup or scripts. */
export function SourceText({body}:{body:string}) {return <div className="source-prose">{body.split(/\n\s*\n/).filter(Boolean).map((p,i)=>{
 if(/^#{1,4} /.test(p))return <h3 key={i}>{inline(p.replace(/^#{1,4} /,''))}</h3>;
 if(p.split('\n').every(s=>s.startsWith('- ')))return <ul key={i}>{p.split('\n').map((s,j)=><li key={j}>{inline(s.slice(2))}</li>)}</ul>;
 return <p key={i}>{inline(p)}</p>;
 })}</div>;}
