import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {icon} from './icons';
import {findCanvasTargets,cycleCanvasFindTarget,type CanvasFindTarget} from './canvasFind';
import './canvasFindOverlay.css';
export function CanvasFindOverlay({canvasKey,targets,tools,onChoose}:{canvasKey:string;targets:readonly CanvasFindTarget[];tools:HTMLElement;onChoose:(target:CanvasFindTarget)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[selected,setSelected]=useState<string>(),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const hits=useMemo(()=>findCanvasTargets(targets,query),[targets,query]),current=hits.find(hit=>hit.key===selected)??hits[0];
 const choose=(target:CanvasFindTarget)=>{try{onChoose(target);setSelected(target.key);setError('');}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}};
 useEffect(()=>{if(!open)return;dialog.current?.showModal();input.current?.focus();return()=>dialog.current?.close();},[open]);
 useEffect(()=>{setOpen(false);setQuery('');setSelected(undefined);setError('');},[canvasKey]);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{const focused=document.activeElement as HTMLElement|null;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='f'&&focused?.closest('.research-canvas')){event.preventDefault();setOpen(true);}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 return <>{createPortal(<button ref={trigger} aria-label="Find on Canvas" title="Find on Canvas" aria-expanded={open} onClick={()=>setOpen(true)}><span className="research-tool-icon" aria-hidden="true" dangerouslySetInnerHTML={{__html:icon('search')}}/></button>,tools)}
  {open&&<dialog ref={dialog} className="canvas-find-overlay" aria-label="Find on Canvas" onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>{
   if(event.nativeEvent.isComposing)return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
   if(event.key==='Enter'||event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();const next=event.key==='Enter'&&!selected?current:cycleCanvasFindTarget(hits,current?.key,event.key==='ArrowUp'||event.shiftKey?-1:1);if(next)choose(next);}
  }}><header><strong>Find on Canvas</strong><button type="button" aria-label="Close Find" onClick={close}>×</button></header>
   <input ref={input} aria-label="Find card text or frame title" placeholder="Card text or frame title" value={query} onChange={event=>{setQuery(event.target.value);setSelected(undefined);setError('');}}/>
   <p role="status">{query.trim()?hits.length?`${hits.length} ${hits.length===1?'match':'matches'} · Enter for next, Shift Enter for previous`:'No matches':'Find within the disclosed cards and frames'}</p>
   <div className="canvas-find-results" role="listbox" aria-label="Canvas matches">{hits.slice(0,100).map(hit=><button key={hit.key} type="button" role="option" aria-selected={hit.key===current?.key} data-canvas-occurrence={hit.kind==='occurrence'?hit.ref:undefined} data-canvas-frame={hit.kind==='frame'?hit.ref:undefined} onClick={()=>choose(hit)}><span>{hit.label}</span><small>{hit.kind==='frame'?'Frame':'Card'}</small></button>)}</div>
   {error&&<p role="alert">{error}</p>}
  </dialog>}
 </>;
}
