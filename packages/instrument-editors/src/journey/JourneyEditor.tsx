import {useEffect,useRef,useState,type ReactNode} from 'react';
import {expressionTiming} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks';
import type {KernelConversion} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import type {InstrumentPresentation} from '../frame/presentation';
import './journey.css';
export interface JourneyBasis {expressionRef:string;revision:number;sceneRef:string}
/** Receiving functions are the existing shared editor's verbs. This component
 * never edits scenes[] or runs a second clip engine. Optional verbs are
 * advertised only when that owner has actually supplied them. */
export interface JourneyEditorHost {
 nativeView():KernelConversion|undefined;
 selectScene(sceneRef:string):Promise<void>;
 retimeScene?(basis:JourneyBasis,duration:number,transition:number):Promise<void>;
 reorderScenes?(basis:JourneyBasis,sceneRefs:readonly string[]):Promise<void>;
 createScene?(basis:JourneyBasis,title:string):Promise<void>;
 splitScene?(basis:JourneyBasis,localTime:number):Promise<void>;
 openSource?(sceneRef:string):Promise<void>;
 undo?():Promise<void>;redo?():Promise<void>;save?():Promise<void>;
 play?():void;hold?():void;seek?(seconds:number):void;
 readClock?():{globalTime:number;playing:boolean};
 /** The current Clip View/GlyphSequenceEditor, bound to the same native phrase. */
 renderPhrase(sceneRef:string,depth:'compact'|'full'):ReactNode;
 renderSceneTools?(sceneRef:string):ReactNode;
 renderBranches?(sceneRef:string):ReactNode;
}
export interface JourneyEditorProps {host:JourneyEditorHost;expressionRef:string;sceneRef:string;depth:'compact'|'full';visible?:boolean;revision?:number|string;presentation:InstrumentPresentation}
export function JourneyEditor(props:JourneyEditorProps){return <JourneyBody key={`${props.expressionRef}:${props.sceneRef}`} {...props}/>;}
function JourneyBody({host,expressionRef,sceneRef,depth,visible=true,revision,presentation}:JourneyEditorProps){
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const view=host.nativeView();const scene=view?.document.scenes.find(scene=>scene.scene_ref===sceneRef);
 const appId=Object.keys(view?.bindings??{}).find(id=>view!.bindings[id].scene_ref===sceneRef);const material=view?.journey.scenes.find(row=>row.id===appId);
 const timing=view?expressionTiming(view.journey,0,0):undefined;
 const retained=presentation.snapshot().view;const retainedBasis=retained.basis as JourneyBasis|undefined;if(retainedBasis&&(retainedBasis.expressionRef!==expressionRef||retainedBasis.sceneRef!==sceneRef||!Number.isSafeInteger(retainedBasis.revision)))throw Error('The retained Journey input has another or malformed native basis. Its checkpoint remains available for recovery.');
 const [duration,setDuration]=useState(typeof retained.duration==='string'?retained.duration:String(material?.duration??''));const [transition,setTransition]=useState(typeof retained.transition==='string'?retained.transition:String(material?.transition??''));
 const [dirty,setDirty]=useState(Boolean(retained.dirty));const [basis,setBasis]=useState<JourneyBasis|undefined>(retained.basis as JourneyBasis|undefined);
 const [title,setTitle]=useState(typeof retained.title==='string'?retained.title:'');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const [clock,setClock]=useState(host.readClock?.());
 const latest=useRef(host);latest.current=host;
 useEffect(()=>{if(!dirty&&view&&material){setBasis({expressionRef,revision:view.document.revision,sceneRef});setDuration(String(material.duration));setTransition(String(material.transition));}},[expressionRef,sceneRef,revision,view?.document.revision,dirty]);
 useEffect(()=>{presentation.setDraft(dirty||busy||Boolean(title));presentation.updateView({...presentation.snapshot().view,duration,transition,dirty,basis,title});},[duration,transition,dirty,basis,busy,title,presentation]);
 useEffect(()=>{if(!visible||!host.readClock)return;let token=0,live=true;const tick=()=>{if(!live)return;setClock(latest.current.readClock?.());token=requestAnimationFrame(tick);};token=requestAnimationFrame(tick);return()=>{live=false;cancelAnimationFrame(token);};},[visible,host.readClock]);
 if(!view||view.document.expression_ref!==expressionRef||!scene||!material||!basis||basis.expressionRef!==expressionRef||basis.sceneRef!==sceneRef)return <p role="status">This Journey has no current native binding for {sceneRef}. Open its native work before editing.</p>;
 const operation=async(run:()=>Promise<void>)=>{if(busy)return;presentation.setDraft(true);setBusy(true);setNotice('');try{await run();}catch(e){if(mounted.current)setNotice(String(e));}finally{if(mounted.current)setBusy(false);}};
 const verifyBasis=()=>{const now=host.nativeView();if(!now||now.document.expression_ref!==basis.expressionRef||now.document.revision!==basis.revision||!now.document.scenes.some(s=>s.scene_ref===basis.sceneRef))throw Error('The Journey changed elsewhere. Your timing input is retained; reread its current source before committing.');};
 const commitTiming=()=>operation(async()=>{if(!host.retimeScene)throw Error('The shared editor has not disclosed timing operations.');verifyBasis();if(!duration.trim()||!transition.trim())throw Error('Complete both timing values; empty input is retained.');const d=Number(duration),t=Number(transition);if(!Number.isFinite(d)||d<1||d>3600||!Number.isFinite(t)||t<0||t>30)throw Error('Duration must be 1–3600 s and transition 0–30 s.');await host.retimeScene(basis,d,t);const after=host.nativeView();const id=Object.keys(after?.bindings??{}).find(id=>after!.bindings[id].scene_ref===sceneRef);const actual=after?.journey.scenes.find(s=>s.id===id);if(!after||after.document.expression_ref!==expressionRef||actual?.duration!==d||actual.transition!==t)throw Error('The effective native timing differs; the input is retained.');if(!mounted.current)return;setDirty(false);setNotice('Native timing readback confirmed.');});
 const move=(ref:string,delta:number)=>operation(async()=>{if(!host.reorderScenes)throw Error('The shared editor has not disclosed sequence reorder.');verifyBasis();const refs=view.document.scenes.map(row=>row.scene_ref);const index=refs.indexOf(ref),to=index+delta;if(index<0||to<0||to>=refs.length)return;[refs[index],refs[to]]=[refs[to],refs[index]];await host.reorderScenes(basis,refs);const after=host.nativeView();const actual=after?.document.scenes.map(row=>row.scene_ref);if(after?.document.expression_ref!==expressionRef||JSON.stringify(actual)!==JSON.stringify(refs))throw Error('Native sequence order did not read back; inspect before repeating.');});
 const intervals=view.journey.scenes.map((s,index)=>{const ref=view.bindings[s.id]?.scene_ref;return {s,index,ref,start:view.journey.scenes.slice(0,index).reduce((sum,row)=>sum+row.duration,0)};});const total=timing?.total??intervals.reduce((sum,row)=>sum+row.s.duration,0);
 return <section className="instrument-journey" data-depth={depth} hidden={!visible} aria-label="Journey editor" aria-busy={busy}>
 <div className="instrument-toolbar"><strong>{view.document.title}</strong><span>{scene.title}</span><span>{total}s</span>{host.play&&<button onClick={host.play}>Play</button>}{host.hold&&<button onClick={host.hold}>Hold</button>}{host.undo&&<button disabled={busy} onClick={()=>void operation(()=>host.undo!())}>Undo</button>}{host.redo&&<button disabled={busy} onClick={()=>void operation(()=>host.redo!())}>Redo</button>}{host.save&&<button disabled={busy} onClick={()=>void operation(()=>host.save!())}>Save</button>}{depth==='compact'&&<button onClick={()=>presentation.setDepth('full')}>Compose</button>}</div>
 <div className="journey-track" role="group" aria-label="Native scene sequence">{intervals.map(({s,ref,start},index)=><div key={ref??s.id} className="journey-clip" data-selected={ref===sceneRef} style={{flexGrow:s.duration,minWidth:depth==='full'?80:28}}><button disabled={!ref||dirty||busy||Boolean(title)} title={`${s.name??scene.title} · ${s.duration}s · ${ref}`} onClick={()=>void operation(()=>host.selectScene(ref!))}>{index+1}. {s.name??view.document.scenes[index]?.title}</button><span>{s.duration}s · {s.transition}s seam</span>{depth==='full'&&host.reorderScenes&&<div><button disabled={index===0||busy||dirty} aria-label={`Move scene ${index+1} earlier`} onClick={()=>void move(ref!,-1)}>←</button><button disabled={index===intervals.length-1||busy||dirty} aria-label={`Move scene ${index+1} later`} onClick={()=>void move(ref!,1)}>→</button></div>}<button className="journey-seek" disabled={!host.seek} aria-label={`Seek to ${start} seconds`} onClick={()=>host.seek?.(start)}>{start}s</button></div>)}</div>
 {clock&&<div className="journey-clock"><progress aria-label="Journey playhead" value={clock.globalTime} max={Math.max(1,total)}/><output>{clock.globalTime.toFixed(2)}s · {clock.playing?'Playing':'Holding'}</output></div>}
 <div className="instrument-toolbar"><label>Duration<input aria-label="Scene duration" inputMode="decimal" value={duration} disabled={busy||!host.retimeScene} onChange={event=>{presentation.setDraft(true);setDuration(event.target.value);setDirty(true);}}/></label><label>Transition<input aria-label="Scene transition" inputMode="decimal" value={transition} disabled={busy||!host.retimeScene} onChange={event=>{presentation.setDraft(true);setTransition(event.target.value);setDirty(true);}}/></label>{host.retimeScene&&<button disabled={!dirty||busy} onClick={()=>void commitTiming()}>Apply timing</button>}{dirty&&<button disabled={busy} onClick={()=>{setDirty(false);setNotice('Timing draft cancelled; current source will be reread.');}}>Cancel timing</button>}{host.openSource&&<button onClick={()=>void operation(()=>host.openSource!(sceneRef))}>Source</button>}</div>
 {notice&&<p role="status">{notice}</p>}
 <div className="journey-phrase">{host.renderPhrase(sceneRef,depth)}</div>
 {depth==='full'&&(host.renderSceneTools||host.renderBranches||host.createScene||host.splitScene)&&<div className="journey-specialist"><section><h3>Scene tools</h3>{host.renderSceneTools?.(sceneRef)}{host.createScene&&<form onSubmit={event=>{event.preventDefault();void operation(async()=>{verifyBasis();await host.createScene!(basis,title);if(mounted.current)setTitle('');});}}><label>New scene<input value={title} disabled={busy} onChange={event=>{presentation.setDraft(true);setTitle(event.target.value);}} maxLength={120}/></label><button disabled={!title.trim()||busy||dirty}>Add scene</button></form>}{host.splitScene&&<button disabled={!clock||busy||dirty} onClick={()=>void operation(async()=>{verifyBasis();const index=intervals.findIndex(row=>row.ref===sceneRef);const local=(clock?.globalTime??0)-(intervals[index]?.start??0);if(local<=0||local>=material.duration)throw Error('Place the playhead strictly inside the selected Scene to split it.');await host.splitScene!(basis,local);})}>Split at playhead</button>}</section>{host.renderBranches&&<section><h3>Branches and passages</h3>{host.renderBranches(sceneRef)}</section>}</div>}
 </section>;
}
