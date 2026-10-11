import {useEffect,useRef,useState} from 'react';
import {installResearchInstruments,type ResearchInstrumentsHost} from '../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments';
import type {TechneSourceProvenance} from '../../../../desktop/cradle/src/techne/contract';
import {assertCanvasBasis,canvasBasis,type CanvasBasis} from '../canvas/adapter';
import {researchOverview,temporalBand,type ResearchFacet} from './overview';
import {ResearchOperations,type ResearchOperation} from './operations';
import {receiveResearchHost} from './receiver';
import './research.css';
export interface ResearchEditorView {selectedFacet:string|null}
export interface ResearchEvidenceContext {basis:CanvasBasis;readingRef:string;facetRef:string|null}
export interface ResearchEditorProps {
 host:ResearchInstrumentsHost;sceneId:string;depth:'compact'|'full';visible?:boolean;revision?:number|string;
 onExpand?:()=>void;onSource?:()=>void;onVisibility?:(visible:boolean)=>void;onDraftChange?:(pending:boolean)=>void;
 /** Optional native source-reader support, preserving the selector/basis. */
 onOpenEvidence?:(source:TechneSourceProvenance,context:ResearchEvidenceContext)=>void|Promise<void>;
 view?:Partial<ResearchEditorView>;onViewChange?:(view:ResearchEditorView)=>void;
}
export function TimelineEditor(props:ResearchEditorProps){return <ResearchEditor {...props} instrument="m2" name="Timeline"/>;}
export function PlacesEditor(props:ResearchEditorProps){return <ResearchEditor {...props} instrument="m4" name="Places"/>;}
function ResearchEditor(props:ResearchEditorProps&{instrument:'m2'|'m4';name:string}){
 let key='unbound';try{const basis=canvasBasis(props.host,props.sceneId);key=`${basis.expressionRef}/${basis.sceneRef}`;}catch{}
 return <BoundResearchEditor key={`${props.instrument}/${key}/${props.sceneId}`} {...props}/>;
}
/** Compact/full resize the same native renderer. Filters, frame, walk,
 * camera and pending layout retries stay mounted through depth/visibility. */
function BoundResearchEditor({host,sceneId,depth,visible=true,revision,onExpand,onSource,onVisibility,onDraftChange,onOpenEvidence,view,onViewChange,instrument,name}:ResearchEditorProps&{instrument:'m2'|'m4';name:string}){
 const stage=useRef<HTMLElement>(null),container=useRef<HTMLDivElement>(null),tools=useRef<HTMLDivElement>(null),inspector=useRef<HTMLElement>(null),home=useRef<HTMLDivElement>(null);
 const installed=useRef<ReturnType<typeof installResearchInstruments>>();
 const opened=useRef(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[focus,setFocus]=useState(false);
 const [observed,setObserved]=useState<{overview:ReturnType<typeof researchOverview>;basis:CanvasBasis}>();
 const [selected,setSelected]=useState<string|null>(view?.selectedFacet??null);
 const [operations,setOperations]=useState<readonly ResearchOperation[]>([]);
 const source=useRef(host);source.current=host;
 const callbacks=useRef({onDraftChange,onViewChange,onVisibility});callbacks.current={onDraftChange,onViewChange,onVisibility};
 const tracker=useRef<ResearchOperations>();if(!tracker.current)tracker.current=new ResearchOperations(operations=>{callbacks.current.onDraftChange?.(operations.length>0);setOperations(operations);});
 let basis:CanvasBasis|undefined;try{basis=canvasBasis(host,sceneId);}catch{}
 useEffect(()=>{
  if(!container.current||!tools.current||!inspector.current||!home.current)return;
  let alive=true;setError('');setBusy(true);
  const live=new Proxy(host,{get:(_,key)=>Reflect.get(source.current,key)});
  try{
   const bound=receiveResearchHost(live,sceneId,{container:container.current,tools:tools.current,inspector:inspector.current,canvasHome:home.current,placesHome:home.current},tracker.current!, (overview,basis)=>{if(alive)setObserved({overview,basis});},message=>{if(alive)setError(message);});
   const instance=installResearchInstruments(bound);installed.current=instance;
   if(visible){opened.current=true;lastRevision.current=revision;void instance.open(instrument).catch(error=>{if(alive)setError(String(error));}).finally(()=>{if(alive)setBusy(false);});}else setBusy(false);
   return()=>{alive=false;instance.destroy();installed.current=undefined;};
  }catch(error){setError(String(error));setBusy(false);return()=>{alive=false;};}
 },[sceneId,instrument]);
 // Native refresh remounts the inner lens. Preserve its failed save retry.
 const lastRevision=useRef(revision);
 useEffect(()=>{if(visible&&opened.current&&operations.length===0&&lastRevision.current!==revision){lastRevision.current=revision;void installed.current?.refresh().catch(error=>setError(String(error)));}},[revision,visible,operations.length]);
 useEffect(()=>{const instance=installed.current;if(visible&&instance&&!opened.current){opened.current=true;lastRevision.current=revision;setBusy(true);void instance.open(instrument).catch(error=>{if(installed.current===instance)setError(String(error));}).finally(()=>{if(installed.current===instance)setBusy(false);});}callbacks.current.onVisibility?.(visible);},[visible]);
 const valid=observed&&basis&&observed.basis.expressionRef===basis.expressionRef&&observed.basis.sceneRef===basis.sceneRef&&observed.basis.revision===basis.revision;
 const overview=valid?observed.overview:undefined;
 const facets=instrument==='m2'?overview?.temporal??[]:overview?.spatial??[];
 const chosen=facets.find(facet=>facet.ref!==null&&facet.ref===selected);
 const choose=(ref:string|null)=>{setSelected(ref);callbacks.current.onViewChange?.({selectedFacet:ref});};
 const toggleFocus=()=>{stage.current?.focus();setFocus(value=>!value);};
 const safely=async(run:()=>void|Promise<void>)=>{try{if(!observed)throw Error('No current source reading is available.');assertCanvasBasis(source.current,observed.basis);await run();}catch(error){setError(String(error));}};
 const openSource=(ref:string)=>safely(()=>{if(source.current.sceneId()!==sceneId)throw Error('Select the pinned Scene in its native owner before opening its source.');source.current.openSubject(ref);});
 const refresh=()=>{if(tracker.current?.dirty){setError('Finish or retry the retained native operation before rereading.');return;}setBusy(true);void installed.current?.refresh().catch(error=>setError(String(error))).finally(()=>setBusy(false));};
 const editTarget=(target:EventTarget|null)=>target instanceof HTMLElement&&Boolean(target.closest('input,textarea,select,[contenteditable=true]'));
 return <section ref={stage} className="instrument-research" data-depth={depth} data-focus={focus} data-instrument={name} aria-label={`${name} editor`} aria-busy={busy} hidden={!visible} tabIndex={0} onKeyDown={event=>{if(editTarget(event.target))return;if(event.key==='Escape'&&focus){setFocus(false);event.preventDefault();}else if(event.key.toLowerCase()==='f'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){setFocus(value=>!value);event.preventDefault();}}}>
  <div className="instrument-toolbar research-header"><strong>{name}</strong><span title={basis?.sceneRef}>{basis?.sceneRef??'No native Scene binding'}</span>{basis&&<span>r{basis.revision}</span>}<button disabled={busy||operations.length>0} onClick={refresh}>Read source</button>{onSource&&<button onClick={onSource}>Source</button>}<button aria-pressed={focus} title="Focus stage (F), restore with Escape" onClick={toggleFocus}>Focus</button>{depth==='compact'&&onExpand&&<button onClick={onExpand}>Explore</button>}</div>
  {error&&<p role="alert">{error}</p>}
  {operations.some(operation=>operation.error)&&<p role="status">Native input retained: {operations.filter(operation=>operation.error).map(operation=>`${operation.key}: ${operation.error}`).join(' · ')}. Retry in the native editor.</p>}
  <div className="research-reading-basis" role="status">{overview?`${overview.reading.subject.subject_ref} · ${overview.reading.reading_ref} · ${overview.reading.snapshot?.revision??'reading revision not disclosed'} · ${facets.length} ${instrument==='m2'?'temporal':'spatial'} facets`:busy?'Reading the bound native source…':'No current source reading has returned.'}</div>
  {overview&&<div className="research-overview" aria-label={`${name} disclosed facets`}>
   {instrument==='m2'&&overview.domain&&<svg className="research-time-overview" viewBox="0 0 480 24" role="img" aria-label="Disclosed time extent, including precision bands"><path d="M0 12H480" stroke="currentColor"/>{facets.map((facet,index)=>{const band=facet.span?temporalBand(facet.span,overview.domain!,480):null;return band?<g key={index}><title>{facet.label} · {facet.precision}{facet.uncertainty?` · ${facet.uncertainty}`:''}</title><rect x={band.x} y={6+index%3*3} width={Math.max(.7,band.width)} height={6} fill="currentColor" opacity={facet.uncertainty ? .45 : .8}/>{band.openFrom&&<path d="M3 5L0 9L3 13" stroke="currentColor" fill="none"/>}{band.openTo&&<path d="M477 5L480 9L477 13" stroke="currentColor" fill="none"/>}</g>:null;})}</svg>}
   <label>{instrument==='m2'?'Date / continuity':'Disclosed place'}<select aria-label={`${name} facet`} value={chosen?.ref??''} onChange={event=>choose(event.target.value||null)}><option value="">{facets.length?'Choose a source facet…':instrument==='m2'?'No temporal facets disclosed':'No spatial facets disclosed'}</option>{facets.filter(facet=>facet.ref!==null).map(facet=><option key={facet.ref!} value={facet.ref!}>{facet.label} · {facet.precision}</option>)}</select></label>
   {chosen&&<><span className={`research-precision precision-${chosen.marker?.kind??'time'}`} title={chosen.marker?.note}>{chosen.precision}</span>{chosen.uncertainty&&<span>{chosen.uncertainty}</span>}{chosen.sourceRef&&<button onClick={()=>void openSource(chosen.sourceRef!)}>Open source</button>}</>}
   {facets.some(facet=>facet.ref===null)&&<span>{facets.filter(facet=>facet.ref===null).length} facets have no native facet ref; no selection ref is invented.</span>}
  </div>}
  <div className="instrument-research-tools" ref={tools}/>
  <div className="instrument-research-body"><div className="instrument-research-home" ref={home}/><div className="instrument-research-viewport" ref={container}/><aside ref={inspector}/></div>
  {depth==='full'&&overview&&<details className="research-provenance"><summary>Source and precision · {chosen?.label??'choose a facet'}</summary>{chosen?<FacetEvidence facet={chosen} onOpen={onOpenEvidence?provenance=>void safely(()=>onOpenEvidence(provenance,{basis:observed!.basis,readingRef:overview.reading.reading_ref,facetRef:chosen.ref})):undefined}/>:<p>Select a disclosed facet above to inspect its exact source basis.</p>}</details>}
 </section>;
}
function FacetEvidence({facet,onOpen}:{facet:ResearchFacet;onOpen?:(source:TechneSourceProvenance)=>void}){
 return <div><dl><dt>Native facet</dt><dd>{facet.ref??'No facet ref disclosed'}</dd><dt>Precision</dt><dd>{facet.precision}</dd>{facet.uncertainty&&<><dt>Uncertainty</dt><dd>{facet.uncertainty}</dd></>}</dl>{facet.provenance.length?facet.provenance.map((source,index)=><article key={index}><strong>{source.native_owner}</strong><code>{source.source_ref}</code><span>Revision {source.source_revision??'not disclosed'} · {source.standing??'standing not disclosed'}</span>{source.selector&&<pre>{JSON.stringify(source.selector,null,2)}</pre>}{onOpen&&source.selector&&<button onClick={()=>onOpen(source)}>Open evidence at anchor</button>}</article>):<p>No provenance disclosed for this facet.</p>}</div>;
}
