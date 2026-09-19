import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Gallery } from './Gallery';
import { Reader } from './Reader';
import { parseRoute, routeHref, readIndex, readEdition, type LibraryEntry, type Edition, type Route } from './model.mjs';
import './library.css';

/** One native publication is held while its Library is browsed. Only view state
 * persists; neither an authoring store nor an Agent/runtime enters this host. */
export function LibraryApp(){
 const [route,setRoute]=useState(()=>parseRoute(location.hash));
 const [entries,setEntries]=useState<LibraryEntry[]>([]),[edition,setEdition]=useState<Edition|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 const lastReading=useRef<Route|null>(null),lastScroll=useRef(0),focusCard=useRef('');
 const cache=useRef(new Map<string,Edition>()),generation=useRef(0),latestRoute=useRef(route);latestRoute.current=route;
 const change=(patch:Partial<Route>,replace=false)=>{const next={...latestRoute.current,...patch};const href=routeHref(next);if(!replace&&next.id&&!latestRoute.current.id){lastScroll.current=window.scrollY;focusCard.current=next.id;}if(replace){history.replaceState(null,'',href);setRoute(next);}else location.hash=href;};
 useEffect(()=>{const changed=()=>setRoute(parseRoute(location.hash));window.addEventListener('hashchange',changed);window.addEventListener('popstate',changed);return()=>{window.removeEventListener('hashchange',changed);window.removeEventListener('popstate',changed);};},[]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');fetch('./data/library/index.json',{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`The Library could not be read (${r.status}).`);return r.json();}).then(readIndex).then(index=>{setEntries(index.entries);setLoading(false);}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setLoading(false);}});return()=>controller.abort();},[retry]);
 useEffect(()=>{
  if(!route.id||!entries.length)return;
  const version=++generation.current;const entry=entries.find(e=>e.id===route.id);
  if(!entry){setError('This work is not in the published collection. Its address has not been redirected to another work.');setLoading(false);return;}
  if(route.edition&&route.edition!==String(entry.revision)){setError('This link names an earlier edition. The publication has changed; choose explicitly whether to open the current one.');setLoading(false);return;}
  const key=entry.expression_ref+':'+entry.revision;const cached=cache.current.get(key);
  if(cached){setEdition(cached);setError('');setLoading(false);return;}
  const controller=new AbortController();setLoading(true);setError('');
  fetch(entry.url+'?revision='+entry.revision,{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`This published edition could not be read (${r.status}).`);return r.json();}).then(value=>readEdition(value,entry)).then(result=>{if(version!==generation.current)return;cache.current.set(key,result);if(cache.current.size>6)cache.current.delete(cache.current.keys().next().value!);setEdition(result);setLoading(false);}).catch(e=>{if(!controller.signal.aborted){setError(e.message);setLoading(false);}});
  return()=>controller.abort();
 },[route.id,route.edition,entries,retry]);
 useEffect(()=>{if(route.id&&edition&&route.id===edition.entry.id&&!error&&!loading){lastReading.current={...route,scene:route.scene||edition.entry.scenes[0].ref,edition:String(edition.entry.revision)};document.title=`${edition.entry.title} — O:I Expressions`;}else if(!route.id){document.title='Library — O:I';}},[route,edition,error,loading]);
 useLayoutEffect(()=>{if(!route.id){document.body.classList.remove('reading-open');requestAnimationFrame(()=>{window.scrollTo(0,lastScroll.current);if(focusCard.current)document.querySelector<HTMLElement>(`.expression-card[data-expression-ref="expression:oi:site:${focusCard.current}"] .expression-open`)?.focus({preventScroll:true});});}else{document.body.classList.add('reading-open');}return()=>document.body.classList.remove('reading-open');},[route.id]);
 useEffect(()=>{if(!loading)requestAnimationFrame(()=>{if(!route.id&&focusCard.current)return;document.getElementById('main-content')?.focus({preventScroll:true});});},[route.id,loading,error]);
 const open=(entry:LibraryEntry,scene=entry.scenes[0].ref)=>change({id:entry.id,scene,edition:String(entry.revision),face:'face',subject:''});
 const back=()=>{setError('');change({id:'',scene:'',edition:'',subject:'',face:'face'});if(!entries.length)setRetry(n=>n+1);};
 const currentEntry=entries.find(e=>e.id===route.id);
 const heldRoute=route.id?route:lastReading.current;
 const readerVisible=!!route.id&&!error&&!loading&&!!edition&&edition.entry.id===route.id;
 return <div className="library-host">
  {!route.id&&!loading&&!error&&<Gallery entries={entries} route={route} onChange={change} onOpen={open} readingTitle={edition?.entry.title} onReturn={lastReading.current&&edition?()=>change(lastReading.current!):undefined}/>}
  {edition&&heldRoute&&<Reader key={edition.entry.expression_ref+edition.entry.revision} edition={edition} route={heldRoute} visible={readerVisible} onChange={change} onLibrary={back}/>}
  {loading&&<main className="library-state" id="main-content"><a href="#/">{'{O:I}'}</a><p role="status">{route.id?'Opening the published edition…':'Opening the Library…'}</p><span className="loading-line"/></main>}
  {error&&<main className="library-state" id="main-content"><a href="#/">{'{O:I}'}</a><h1>A reading needs attention.</h1><p role="alert">{error}</p><div className="state-actions">{currentEntry&&route.edition&&route.edition!==String(currentEntry.revision)&&<button onClick={()=>open(currentEntry,currentEntry.scenes.some(s=>s.ref===route.scene)?route.scene:currentEntry.scenes[0].ref)}>Open the current edition</button>}<button onClick={()=>setRetry(retry+1)}>Try again</button><button onClick={back}>Return to Library</button></div></main>}
 </div>;
}
