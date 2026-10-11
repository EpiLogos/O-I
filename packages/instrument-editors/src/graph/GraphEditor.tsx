import {useEffect,useMemo,useRef,useState} from 'react';
import {KernelApiProvider} from '../../../../desktop/cradle/src/kernel/KernelContext';
import type {KernelApi} from '../../../../desktop/cradle/src/kernel/KernelProvider';
import type {KnowledgeReading} from '../../../../desktop/cradle/src/kernel/types';
import type {SurfaceBinding} from '../../../../desktop/cradle/src/surface/types';
import {GraphCanvas} from '../../../../desktop/cradle/src/knowledge/GraphCanvas';
import {GraphFilters} from '../../../../desktop/cradle/src/knowledge/GraphFilters';
import {filterGraph,restoreGraphFilters,type GraphFilters as FilterState,type SavedGraphView} from '../../../../desktop/cradle/src/knowledge/filters';
import {useEditorLayout} from './useEditorLayout';
import {loadGraph} from '../../../../desktop/cradle/src/knowledge/graphProgress';
import {subjects,neighbourhood} from '../../../../desktop/cradle/src/knowledge/focus';
import {graphAddress,isHostedNode,readGraph,type GraphNode,type GraphReading} from '../../../../desktop/cradle/src/knowledge/graph';
import {knowledge} from '../../../../desktop/cradle/src/knowledge/client';
import {sharedField,type SharedFieldReading} from '../../../../desktop/cradle/src/knowledge/shared-field';
import {NodeDetails,type OpenKnowledge} from '../../../../desktop/cradle/src/knowledge/NodeDetails';
import {openSubjectInTechne} from '../../../../desktop/cradle/src/knowledge/techneHandoff';
import {WikiConstructionPanel,type ConstructionCheckpoint} from '../../../../desktop/cradle/src/knowledge/WikiConstructionPanel';
import {WikiFactsProvider} from '../../../../desktop/cradle/src/knowledge/WikiFactsEditor';
import {restoreFactsCheckpoints,retainFactsCheckpoint,factsChanges,type FactsCheckpoint} from '../../../../desktop/cradle/src/knowledge/wikiFacts';
import {selectedPassage,type WikiPassage} from '../../../../desktop/cradle/src/knowledge/selection';
import {useDetailGeometry} from '../../../../desktop/cradle/src/knowledge/detailGeometry';
import {restoreConstructionCheckpoint} from '../../../../desktop/cradle/src/knowledge/constructionCheckpoint';
import {restoreSavedGraphViews} from '../../../../desktop/cradle/src/knowledge/filters';
import type {InstrumentPresentation} from '../frame/presentation';
import '../../../../desktop/cradle/src/knowledge/knowledge.css';
import '../../../../desktop/cradle/src/knowledge/filters.css';
import './graph.css';
export interface GraphEditorProps {api:KernelApi;binding:SurfaceBinding;depth:'compact'|'full';visible?:boolean;presentation:InstrumentPresentation;onOpen:OpenKnowledge;revision?:number|string}
/** Both depths compose the SAME native graph, selection, filters and drafts.
 * Native source editing, constellation gathering and receipts are adopted
 * from the existing knowledge components, not reimplemented here. */
export function GraphEditor(props:GraphEditorProps){return <KernelApiProvider value={props.api}><GraphBody key={`${props.binding.id}:${props.binding.project??'root'}:${props.presentation.snapshot().target.subjectRef}`} {...props}/></KernelApiProvider>;}
function GraphBody({api,binding,depth,visible=true,presentation,onOpen,revision}:GraphEditorProps){
 const retained=presentation.snapshot().view;
 const [input,setInput]=useState<'all'|'central_wiki'|'aikit_resolution'>(retained.input==='all'||retained.input==='aikit_resolution'?retained.input:'central_wiki');
 const [query,setQuery]=useState(typeof retained.query==='string'?retained.query:'');
 const [selected,setSelected]=useState<string|undefined>(typeof retained.selected==='string'?retained.selected:binding.ref);
 const [filters,setFilters]=useState<FilterState>(()=>restoreGraphFilters(retained.filters));
 const [saved,setSaved]=useState<SavedGraphView[]>(restoreSavedGraphViews(retained.saved));
 const [camera,setCamera]=useState(()=>{const c=retained.camera as {x:number;y:number;zoom:number}|undefined;return c&&[c.x,c.y,c.zoom].every(Number.isFinite)&&c.zoom>=.15&&c.zoom<=4?c:{x:0,y:0,zoom:.7};});
 const [facts,setFacts]=useState<Record<string,FactsCheckpoint>>(restoreFactsCheckpoints(retained.facts));
 const factsCurrent=useRef(facts);factsCurrent.current=facts;
 const [construction,setConstruction]=useState<ConstructionCheckpoint|undefined>(retained.construction?restoreConstructionCheckpoint(retained.construction):undefined);
 const [incoming,setIncoming]=useState<WikiPassage>();const [gather,setGather]=useState(false);
 const [model,setModel]=useState<GraphReading>();const [busy,setBusy]=useState(false);const [error,setError]=useState<string>();
 const [reading,setReading]=useState<KnowledgeReading>();const [hosted,setHosted]=useState<SharedFieldReading>();
 const [generation,setGeneration]=useState(0);const [detail,setDetail]=useState(true);const [techneBusy,setTechneBusy]=useState(false);
 const graph=useRef<HTMLDivElement>(null);const [extent,setExtent]=useState({width:800,height:520});
 const detailGeometry=useDetailGeometry(binding.id,extent);
 const basisKey=JSON.stringify([binding.id,binding.project,presentation.snapshot().target.subjectRef]);
 const [modelBasis,setModelBasis]=useState('');const loadGeneration=useRef(0);
 useEffect(()=>{let dirty=Boolean(construction&&(!construction.saved||construction.pending||construction.artifactSave));for(const value of Object.values(facts)){try{dirty ||= Boolean(value.pending)||factsChanges(value.basis.values,value.draft).length>0;}catch{dirty=true;}}presentation.setDraft(dirty);},[facts,construction,presentation]);
 useEffect(()=>{presentation.updateView({input,query,selected,filters,saved,camera,facts,construction});},[input,query,selected,filters,saved,camera,facts,construction,presentation]);
 useEffect(()=>{if(!visible)return;const controller=new AbortController();const token=++loadGeneration.current;setBusy(true);setError(undefined);
 const loading=input==='all'?loadGraph(api.transport,binding.project,query,result=>{if(controller.signal.aborted||token!==loadGeneration.current)return;setModel(result.reading);setModelBasis(basisKey);setBusy(result.pending.length>0);},{signal:controller.signal,fresh:true,shared:filters.shared}):readGraph(api.transport,binding.project,query,{input,fresh:true,max_nodes:4096,max_edges:16384}).then(reading=>{if(!controller.signal.aborted&&token===loadGeneration.current){setModel(reading);setModelBasis(basisKey);setBusy(false);}});void loading.catch(e=>{if(!controller.signal.aborted){setError(String(e));setBusy(false);}});return()=>controller.abort();
 },[api.transport,binding.project,query,generation,revision,visible,filters.shared,basisKey,input]);
 const nodes=useMemo(()=>subjects(modelBasis===basisKey?model:undefined).map(entry=>entry.node),[model,modelBasis,basisKey]);
 const canonical=useMemo(()=>modelBasis===basisKey&&model?{...model,nodes}:undefined,[model,nodes,modelBasis,basisKey]);
 const filtered=useMemo(()=>canonical?filterGraph(canonical,depth==='compact'&&selected?{...filters,scope:'local',depth:1}:filters,selected):undefined,[canonical,filters,selected,depth]);
 const displayed=useMemo(()=>canonical&&filtered?{...canonical,nodes:filtered.nodes,edges:filtered.edges}:undefined,[canonical,filtered]);
 const layout=useEditorLayout(canonical,visible);
 const positions=useMemo(()=>{const byRef=new Map(nodes.map((n,i)=>[n.ref,layout.points[i]]));return (filtered?.nodes??nodes).map(n=>byRef.get(n.ref)??{x:400,y:260});},[nodes,layout.points,filtered]);
 const node=nodes.find(n=>n.ref===selected);const address=node?graphAddress(node):undefined;
 useEffect(()=>{if(!visible||!node)return;let active=true;const controller=new AbortController();setReading(undefined);setHosted(undefined);
 const request=isHostedNode(node)?sharedField<SharedFieldReading>(api.transport,{kind:'read',ref:node.ref}).then(value=>{if(active)setHosted(value);}):address?knowledge<KnowledgeReading>(api.transport,binding.project,{action:'read',address},{signal:controller.signal,fresh:true}).then(value=>{if(active)setReading(value);}):Promise.resolve();
 void request.catch(e=>{if(active)setError(String(e));});return()=>{active=false;controller.abort();};
 },[api.transport,binding.project,selected,model,visible,generation]);
 useEffect(()=>{if(!graph.current)return;const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(width&&height)setExtent({width,height});});observer.observe(graph.current);return()=>observer.disconnect();},[]);
 const choose=(n:GraphNode)=>{setSelected(n.ref);setDetail(true);};
 const refresh=()=>setGeneration(n=>n+1);
 const techne=async(n:GraphNode)=>{setTechneBusy(true);setError(undefined);try{await openSubjectInTechne(api.transport,binding.project,n,model?.formations??[]);}catch(e){setError(String(e));}finally{setTechneBusy(false);}};
 const fit=()=>{if(!positions.length)return;const xs=positions.map(p=>p.x),ys=positions.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);const zoom=Math.max(.15,Math.min(2,(extent.width-80)/Math.max(1,right-left),(extent.height-80)/Math.max(1,bottom-top)));setCamera({zoom,x:(400-(left+right)/2)*zoom,y:(260-(top+bottom)/2)*zoom});};
 return <WikiFactsProvider transport={api.transport} project={binding.project} checkpoints={facts} onCheckpoint={(key,value)=>{const next=retainFactsCheckpoint(factsCurrent.current,key,value);factsCurrent.current=next;presentation.setDraft(true);presentation.updateView({...presentation.snapshot().view,facts:next});setFacts(next);}} onSaved={refresh}>
 <section className="instrument-graph" data-depth={depth} aria-label="Project / Graph editor" aria-busy={busy}>
 <form className="instrument-toolbar" onSubmit={event=>{event.preventDefault();refresh();}}><label>Source<select aria-label="Graph source" value={input} onChange={event=>setInput(event.target.value as typeof input)}><option value="central_wiki">Wiki</option><option value="aikit_resolution">Knowledge</option><option value="all">Available field</option></select></label><label>Query<input aria-label="Graph query" value={query} onChange={event=>setQuery(event.target.value)} maxLength={4096}/></label><button type="submit">Read</button><button type="button" onClick={fit}>Fit</button><button type="button" onClick={()=>setCamera(c=>({...c,zoom:Math.min(4,c.zoom*1.25)}))}>+</button><button type="button" onClick={()=>setCamera(c=>({...c,zoom:Math.max(.15,c.zoom/1.25)}))}>−</button>{depth==='full'&&<button type="button" onClick={()=>setGather(true)}>Gather constellation</button>}</form>
 {canonical&&<details className="graph-source-standing"><summary>Source reading</summary>{Object.entries(canonical.inputs).map(([name,value])=><p key={name}>{name==='central_wiki'?'Wiki':name==='aikit_resolution'?'Knowledge':name==='shared_field'?'Shared field':'Source links'} · {value.state} · {value.detail??value.owner_operation}</p>)}</details>}
 {error&&<p role="alert">{error}</p>}{layout.error&&<p role="alert">{layout.error}</p>}
 <div className="instrument-graph-field knowledge-graph" ref={graph}>
 {visible&&<GraphCanvas nodes={filtered?.nodes??nodes} model={displayed} positions={positions} camera={camera} selected={selected} focused={neighbourhood(displayed,selected)} contextual={filtered?.contextual} labels={filters.labels} arrows={filters.arrows} minZoom={.15} maxZoom={4} onCamera={setCamera} onDragNode={(ref,world)=>{if(ref&&world)layout.dragNode(ref,world.x,world.y);else layout.releaseNode();}} onOpen={choose} onClear={()=>setDetail(false)}/>}
 {depth==='full'&&canonical&&filtered&&<GraphFilters reading={canonical} filters={filters} result={filtered} selected={selected} camera={camera} onChange={setFilters} saved={saved} onSave={setSaved} onApply={view=>{setFilters(view.filters);if(view.camera)setCamera(view.camera);if(view.focus)setSelected(view.focus);}}/>}
 {depth==='full'&&node&&detail&&<NodeDetails node={node} reading={reading} hosted={hosted} error={error} project={binding.project} native={api.transport.kind!=='unavailable'} rect={detailGeometry.rect} extent={extent} onGeometry={detailGeometry.change} storageError={detailGeometry.storageError} disclosures={subjects(model).find(s=>s.node.ref===node.ref)?.disclosures??[node]} related={(model?.edges??[]).filter(e=>e.from_ref===node.ref||e.to_ref===node.ref).map(edge=>({edge,node:nodes.find(n=>n.ref===(edge.from_ref===node.ref?edge.to_ref:edge.from_ref))}))} onRelated={choose} transport={api.transport} onActionDispatched={refresh} onClose={()=>setDetail(false)} onPromote={()=>setDetail(false)} onOpen={onOpen} onTechne={techne} technePending={techneBusy} readingProps={{transport:api.transport,project:binding.project,binding,onNavigate:(address)=>{const found=nodes.find(n=>graphAddress(n)?.value===address.value);if(found)choose(found);else void onOpen(address,address.value,binding.project);},onSelectSource:(source,anchor,text)=>{setIncoming(selectedPassage(source,anchor,text,node.label));setGather(true);}}}/>}
 </div>
 <div className="instrument-toolbar"><span>{filtered?.nodes.length??0} subjects · {filtered?.edges.length??0} relations</span>{node&&<><span title={node.ref}>{node.label}</span>{address&&<button onClick={()=>void onOpen(address,node.label,binding.project)}>Source</button>}<button disabled={techneBusy} onClick={()=>void techne(node)}>Open in Canvas</button></>}{depth==='compact'&&<button onClick={()=>presentation.setDepth('full')}>Explore</button>}</div>
 {model?.unresolved_links?.length? <details><summary>{model.unresolved_links.length} unresolved source links</summary><ul>{model.unresolved_links.map((link,index)=><li key={index}><code>{JSON.stringify(link)}</code></li>)}</ul></details>:null}
 {gather&&<WikiConstructionPanel binding={binding} open={gather} incoming={incoming} checkpoint={construction} onCheckpoint={value=>{presentation.setDraft(Boolean(!value.saved||value.pending||value.artifactSave)||presentation.hasDraft);presentation.updateView({...presentation.snapshot().view,construction:value});setConstruction(value);}} onClose={()=>setGather(false)} onNavigate={(address,title)=>{void onOpen(address,title,binding.project);}} onSaved={refresh}/>}
 </section></WikiFactsProvider>;
}
