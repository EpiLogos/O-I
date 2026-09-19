import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { exactScene, routeHref, safeUrl, type Edition, type Route, type Reading, type NativeScene } from './model.mjs';
import type { Camera } from './native-player.mjs';
import { Icon, SourceText, Tool } from './ui';
const NativeStage=lazy(()=>import('./NativeStage').then(m=>({default:m.NativeStage})));
type Position={camera?:Partial<Camera>;scene:string;subject:string;revision:number};
const POSITION_KEY='oi.site.reader.v1';
function positions():Record<string,Position>{try{const saved=JSON.parse(sessionStorage.getItem(POSITION_KEY)||'{}');return saved&&typeof saved==='object'?saved:{};}catch{return {};}}
function cameraValue(value:Partial<Camera>|undefined){if(!value)return undefined;const result:Partial<Camera>={};for(const k of ['yaw','pitch','zoom','panX','panY'] as const){const n=value[k];if(typeof n==='number'&&Number.isFinite(n))result[k]=Math.max(k==='zoom'?.25:-10000,Math.min(k==='zoom'?5:10000,n));}return result;}

type ReaderProps={edition:Edition;route:Route;visible:boolean;onChange:(r:Partial<Route>,replace?:boolean)=>void;onLibrary:()=>void};
export function Reader(props:ReaderProps){
 let scene:NativeScene;try{scene=exactScene(props.edition,props.route.scene||props.edition.entry.scenes[0].ref);}catch(error){return props.visible?<main id="main-content" className="reader-unavailable" role="alert"><h1>This exact Scene is unavailable.</h1><p>{String(error)}</p><button onClick={()=>props.onChange({scene:props.edition.entry.scenes[0].ref,subject:'',face:'face'})}>Open this edition’s overview</button><button onClick={props.onLibrary}>Return to Library</button></main>:null;}
 return <ReaderBody {...props} scene={scene}/>;
}
function ReaderBody({edition,route,visible,onChange,onLibrary,scene}:ReaderProps&{scene:NativeScene}){
 const ref=edition.entry.expression_ref, saved=useRef(positions()[ref]);
 const selectedScene=route.scene||edition.entry.scenes[0].ref;
 const [motion,setMotion]=useState(()=>!matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [sequence,setSequence]=useState(false),[portal,setPortal]=useState<'beside'|'overlay'>('beside'),[hasStage,setHasStage]=useState(route.face==='face');
 const [message,setMessage]=useState('');
 const reader=useRef<HTMLDivElement>(null), sourceScroll=useRef<HTMLDivElement>(null), modal=useRef<HTMLDialogElement>(null);
 const scrollPositions=useRef(new Map<string,number>()),views=useRef(new Map<string,Partial<Camera>>());
 const elapsed=useRef(0),lastScene=useRef(selectedScene);
 const detached=useRef<Window|null>(null);

 const composition=edition.publication.composition;
 const selected=scene.entity_refs.find(r=>composition.entities[r].subject?.subject_ref===route.subject)||'';
 const subject=route.subject||composition.entities[scene.entity_refs[0]].subject?.subject_ref||edition.entry.source_ref;
 const reading=edition.readings[subject];
 const sourceKey=subject+':'+edition.entry.source_revision;
 const readingFace=route.face!=='face';
 const pendingRef=route.edition&&route.edition!==String(edition.entry.revision);
 const compatible=saved.current?.revision===edition.entry.revision&&saved.current.scene===selectedScene;
 const camera=views.current.get(selectedScene)??(compatible?cameraValue(saved.current?.camera):undefined);
 const persist=(cam?:Partial<Camera>)=>{
  if(cam)views.current.set(selectedScene,cam);
  const next:Position={camera:cam??views.current.get(selectedScene),scene:selectedScene,subject,revision:edition.entry.revision};
  try{const all=positions();all[ref]=next;sessionStorage.setItem(POSITION_KEY,JSON.stringify(Object.fromEntries(Object.entries(all).slice(-30))));}catch{/* Navigation remains available without storage. */}
 };
 useEffect(()=>{if(route.face==='face'&&visible)setHasStage(true);},[route.face,visible]);
 useEffect(()=>{if(!visible)setSequence(false);},[visible]);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const changed=()=>{if(m.matches){setMotion(false);setSequence(false);}};m.addEventListener('change',changed);return()=>m.removeEventListener('change',changed);},[]);
 useEffect(()=>{if(lastScene.current!==selectedScene){lastScene.current=selectedScene;elapsed.current=0;}persist();},[selectedScene,subject]);
 useLayoutEffect(()=>{if(sourceScroll.current)sourceScroll.current.scrollTop=scrollPositions.current.get(sourceKey)||0;},[sourceKey,route.face,portal]);
 useEffect(()=>{if(portal==='overlay'&&readingFace&&route.face==='verso'&&visible)modal.current?.showModal();else modal.current?.close();},[portal,readingFace,route.face,visible]);
 useEffect(()=>{const receive=(e:MessageEvent)=>{if(e.origin!==location.origin||e.source!==detached.current||e.data?.kind!=='oi:site:redock'||e.data?.expression_ref!==ref||e.data?.revision!==edition.entry.revision)return;detached.current?.close();detached.current=null;onChange({face:'verso'});};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);},[edition]);
 const openScene=(sceneRef:string)=>{elapsed.current=0;onChange({scene:sceneRef,subject:'',face:'face'});};
 const index=composition.scenes.findIndex(s=>s.scene_ref===selectedScene);
 const shift=(n:number)=>openScene(composition.scenes[(index+n+composition.scenes.length)%composition.scenes.length].scene_ref);
 const closeSource=()=>onChange({face:'face'});
 const selectedSource=(entityRef:string)=>{const e=composition.entities[entityRef];if(e.subject)onChange({subject:e.subject.subject_ref,face:'verso'});};
 const copy=async()=>{try{await navigator.clipboard.writeText(location.href);setMessage('Reading link copied.');}catch{setMessage('Copy the address from your browser to share this exact reading.');}};
 const detach=()=>{const url=new URL(location.href);url.hash=routeHref({...route,face:'detached'});detached.current=window.open(url.href,'oi-source-'+edition.entry.id,'popup,width=800,height=900');if(!detached.current)setMessage('The browser blocked the source window. Full reading remains available here.');};
 const sourceBody=(r:Reading|undefined)=><>
  <div className="source-eyebrow">{edition.entry.source_location} / {scene.title}</div><h2>{r?.title??'Source unavailable'}</h2>
  {r?<SourceText body={r.body}/>:<p>This exact subject has no disclosed text in this publication. No other source has been substituted.</p>}
  <section className="source-navigation"><h3>In this Expression</h3>{edition.entry.scenes.map(s=><button key={s.ref} aria-current={s.ref===selectedScene?'step':undefined} onClick={()=>openScene(s.ref)}>{s.title}<Icon name="arrowRight"/></button>)}</section>
  {selected&&<section className="source-navigation"><h3>Declared source relations</h3>{Object.values(composition.relations).filter(r=>r.from_entity_ref===selected||r.to_entity_ref===selected).map(r=>{const other=composition.entities[r.from_entity_ref===selected?r.to_entity_ref:r.from_entity_ref];return <button key={r.binding_ref} onClick={()=>onChange({subject:other.subject?.subject_ref??'',face:'verso'})}>{r.from_entity_ref===selected?'Contains section: ':'Section of: '}{other.title}<Icon name="arrowRight"/></button>;})}<p>These relations follow source heading membership, not spatial proximity.</p></section>}
  <details className="source-provenance"><summary>Source, edition and publication</summary><dl><dt>Subject</dt><dd>{subject}</dd><dt>Expression</dt><dd>{ref}</dd><dt>Scene</dt><dd>{selectedScene}</dd><dt>Edition</dt><dd>{edition.entry.revision}</dd><dt>Source</dt><dd>{r?.source_path} / {r?.source_heading}</dd><dt>Source revision</dt><dd>{r?.source_revision??edition.source_basis.revision}</dd></dl><p>{edition.standing}</p>{r?.source_url&&safeUrl(r.source_url)&&<a href={r.source_url} target="_blank" rel="noreferrer">Open the source file <Icon name="external"/></a>}<a href="./data/library/public-site.md" target="_blank" rel="noreferrer">Read the public-source snapshot</a><a href={edition.entry.url} download={`${edition.entry.id}-publication.json`}>Published edition · JSON</a></details>
 </>;
 const sourceHeader=<header className="source-toolbar"><span>Read & sources</span><Tool name="layers" label={portal==='beside'?'Read in overlay':'Read beside the field'} onClick={()=>setPortal(portal==='beside'?'overlay':'beside')}/><Tool name="expand" label="Full source reading" onClick={()=>onChange({face:'full'})}/><Tool name="external" label="Open source in a separate window" onClick={detach}/><Tool name="close" label="Return to the field" onClick={closeSource}/></header>;
 return <div className={`expression-reader ${readingFace?'is-reading':''} ${route.face==='full'||route.face==='detached'?'is-full-reading':''}`} ref={reader} id={visible?"main-content":undefined} role="main" tabIndex={-1} hidden={!visible} data-expression-ref={ref} data-edition={edition.entry.revision}>
  <header className="reader-header"><button className="reader-library" onClick={onLibrary}><Icon name="library"/><span>Library</span></button><div className="reader-heading"><strong>{edition.entry.title}</strong><span>{scene.title}</span></div><div className="reader-tools"><button className="read-source-action" aria-pressed={readingFace} onClick={()=>onChange({face:readingFace?'face':'verso'})}><Icon name="text"/><span>Read & sources</span></button><Tool name="external" label="Copy exact reading link" onClick={()=>void copy()}/><Tool name="expand" label="Toggle fullscreen" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void reader.current?.requestFullscreen?.().catch(()=>setMessage('Fullscreen is unavailable in this browser.'));}}/></div></header>
  <div className="reader-body">
   <div className="reader-field" hidden={route.face==='full'||route.face==='detached'}>
    <div className="field-caption"><span className="eyebrow">{edition.entry.standing} / {String(index).padStart(2,'0')}</span><p>{index===0?edition.entry.summary:reading?.title??scene.title}</p></div>
    {hasStage&&<Suspense fallback={<p className="field-loading" role="status">Loading the native field…</p>}><NativeStage edition={edition} scene={scene} active={visible&&!readingFace&&!pendingRef} playing={motion} selected={selected} onSelect={selectedSource} onScene={openScene} camera={camera} onCamera={persist} onTick={dt=>{if(sequence){elapsed.current+=dt;if(elapsed.current>=12){elapsed.current=0;shift(1);}}}}/></Suspense>}
    {!hasStage&&<button className="enter-field" onClick={closeSource}>Enter the live field <Icon name="arrowRight"/></button>}
    <p className="field-hint">Drag to orbit · Shift-drag to pan · Scroll to zoom · Select a formation to read</p>
   </div>
   {readingFace&&(portal==='beside'||route.face!=='verso')&&<aside className="source-panel" aria-label="Source reading">{route.face==='detached'?<header className="source-toolbar"><span>Detached source · {edition.entry.title}</span>{window.opener&&<button onClick={()=>{window.opener.postMessage({kind:'oi:site:redock',expression_ref:ref,revision:edition.entry.revision},location.origin);}}>Re-dock</button>}<Tool name="close" label="Return to field" onClick={closeSource}/></header>:sourceHeader}<div className="source-scroll" ref={sourceScroll} onScroll={e=>scrollPositions.current.set(sourceKey,e.currentTarget.scrollTop)}>{sourceBody(reading)}</div></aside>}
   <dialog className="source-overlay" ref={modal} aria-label="Read the source" onCancel={closeSource}>{portal==='overlay'&&route.face==='verso'&&<>{sourceHeader}<div className="source-scroll" ref={sourceScroll} onScroll={e=>scrollPositions.current.set(sourceKey,e.currentTarget.scrollTop)}>{sourceBody(reading)}</div></>}</dialog>
  </div>
  <footer className="scene-transport"><div className="transport-controls"><Tool name={motion?'pause':'play'} label={motion?'Pause field':'Play field'} aria-pressed={motion} onClick={()=>setMotion(!motion)}/><Tool name="arrowLeft" label="Previous Scene" onClick={()=>shift(-1)}/><Tool name="arrowRight" label="Next Scene" onClick={()=>shift(1)}/></div><nav className="reader-scenes" aria-label="Expression Scenes">{composition.scenes.map((s,i)=><button key={s.scene_ref} data-scene-ref={s.scene_ref} aria-current={selectedScene===s.scene_ref?'step':undefined} onClick={()=>openScene(s.scene_ref)}><span>{String(i).padStart(2,'0')}</span>{s.title}</button>)}</nav><Tool name="sequence" label={sequence?'Stop Scene sequence':'Play Scene sequence'} aria-pressed={sequence} onClick={()=>{setSequence(!sequence);if(!sequence){setMotion(true);closeSource();}}}/><span className="read-only-mark"><Icon name="lock"/> View only</span></footer>
  {message&&<div className="reader-message" role="status">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss message">×</button></div>}
 </div>;
}
