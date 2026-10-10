import {useMemo,useRef,useState} from 'react';
import {useKernel} from '../../../desktop/cradle/src/kernel/KernelProvider';
import {readWikiSceneTechne} from '../../../desktop/cradle/src/techne/wikiReadingProvider';
import {publishWikiNativeRegisters,ensureWikiNativeExpression} from '../../../desktop/cradle/src/techne/wikiNativeExpression';
import {getWikiProjectionState} from '../../../desktop/cradle/src/techne/wikiProjectionStore';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge';
import type {ResearchInstrumentsHost} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments';
import {applyResearchMaterial} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchMaterial';
import {blueprintMember} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import {CanvasEditor} from '../src/canvas/CanvasEditor';
import {TimelineEditor,PlacesEditor} from '../src/research/ResearchEditor';
import {InstrumentFrame,createInstrumentPresentation} from '../src/frame/InstrumentFrame';
import {CANVAS,TIMELINE,PLACES} from '../src/definitions';
import {nativeWorkbench} from './nativeWorkbench';

export interface ResearchWorkbenchProps {
 work:Awaited<ReturnType<typeof nativeWorkbench>>;
 active:'canvas'|'timeline'|'places'|null;
 epoch:number;
 onSource:(value:unknown)=>void;
}

/** Receiving adapter over the same retained native document used by the other
 * dev instruments. Source facets are read at their real Wiki owner; a missing
 * disclosed register is a refusal, never a synthetic Techne reading. */
export function ResearchWorkbench({work,active,epoch,onSource}:ResearchWorkbenchProps){
 const api=useKernel(),[wikiWork,setWikiWork]=useState<ResearchWorkbenchProps['work']>(),[wikiEpoch,setWikiEpoch]=useState(0),[useWiki,setUseWiki]=useState(false),[wikiReadOnly,setWikiReadOnly]=useState(''),[opening,setOpening]=useState(false),[error,setError]=useState('');
 const openWiki=async()=>{
  if(wikiWork){setUseWiki(true);return;}
  setOpening(true);setError('');
  try{
   // The native register factory discloses Central alongside actual projects;
   // this isolated entrance reads only Central and never writes its Wiki.
   const register=publishWikiNativeRegisters([]).find(row=>row.key==='central');if(!register)throw Error('The native Central register is not disclosed.');
   const source=await ensureWikiNativeExpression(api.transport,register);
   const standing=getWikiProjectionState().standings[register.key];
   const reading=standing&&'reading'in standing?standing.reading:undefined;
   const basis=reading?.state==='ready'?`wiki:${reading.wikiBasis.path}`:null;
   const actual=source.document.provenance.filter(row=>row.ref===basis);
   const projected=source.projection.document.provenance.filter(row=>row.ref===basis);
   const unavailableConnections=source.drift==='Source connections were unavailable when this composition was opened. Retry their reading and review missing connections before restoring them.'
    &&reading?.state==='ready'&&reading.relations.state==='unavailable'&&actual.length>0&&projected.length>0
    &&[...actual,...projected].every(row=>row.availability==='available'&&row.revision===reading.wikiBasis.revision);
   if(source.drift&&!unavailableConnections)throw Error(source.drift);
   const readOnlyReason=unavailableConnections?`${source.drift} Source inspection only; native selection, placement and material writes are disabled. ${reading!.state==='ready'&&reading!.relations.state==='unavailable'?reading!.relations.reason:''}`:'';
   onSource({schema:'oi.development-research-standing/v1',register:register.key,phase:standing?.phase,source_expression:source.document.expression_ref,source_revision:source.document.revision,wiki_basis:reading?.state==='ready'?reading.wikiBasis:null,relations:reading?.state==='ready'?reading.relations:null,drift:source.drift,readOnly:!!readOnlyReason,notices:source.projection.notices});
   const ref='expression:research-editor-'+crypto.randomUUID();
   const reply=await kernelOp(api.transport,{op:'expression',request:{operation:'fork',expression_ref:source.document.expression_ref,expected_revision:source.document.revision,new_expression_ref:ref,actor:'agent:instrument-editor-development'}});
   if(reply.error||reply.outcome?.result!=='expression')throw Error(reply.error??'The native source fork returned no document.');
   const document=(reply.outcome.data as {document?:{expression_ref:string}}).document;
   if(document?.expression_ref!==ref)throw Error('The native fork did not acknowledge its exact new Expression.');
   const received=await nativeWorkbench(api.transport,ref,()=>setWikiEpoch(value=>value+1),onSource);
   setWikiReadOnly(readOnlyReason);setWikiWork(received);setUseWiki(true);
   onSource({schema:'oi.development-research-source/v1',source_expression:source.document.expression_ref,source_revision:source.document.revision,document:received.work.state?.view?.document,read_only_reason:readOnlyReason,source_standing:{phase:standing?.phase,wiki_basis:reading?.state==='ready'?reading.wikiBasis:null,relations:reading?.state==='ready'?reading.relations:null},disclosure:'Actual root Wiki reading, native projection, and controlled native fork. No source dates or places are invented.'});
  }catch(error){setError(String(error));}finally{setOpening(false);}
 };
 return <section data-research-receiver hidden={!active}>
  <div className="instrument-toolbar"><button disabled={opening} onClick={()=>void openWiki()}>{opening?'Opening actual Wiki source…':'Open actual Wiki research composition'}</button>{wikiWork&&<button onClick={()=>setUseWiki(value=>!value)}>{useWiki?'Show controlled modulation Scene':'Show actual Wiki composition'}</button>}</div>
  {error&&<p role="alert">{error}</p>}
  <BoundResearchWorkbench work={work} active={useWiki?null:active} epoch={epoch} onSource={onSource}/>
  {wikiWork&&<BoundResearchWorkbench readOnlyReason={wikiReadOnly} work={wikiWork} active={useWiki?active:null} epoch={wikiEpoch} onSource={onSource}/>}
 </section>;
}
type ReceivingResearchProps=ResearchWorkbenchProps&{readOnlyReason?:string};
function BoundResearchWorkbench({work,active,epoch,onSource,readOnlyReason}:ReceivingResearchProps){
 const binding=useMemo(()=>{const sceneId=work.sceneId(),native=work.work.state?.view;if(!sceneId||!native?.bindings[sceneId])return null;return {sceneId,expressionRef:native.document.expression_ref,sceneRef:native.bindings[sceneId].scene_ref};},[work]);
 return binding?<ReceivingResearchScene work={work} active={active} epoch={epoch} onSource={onSource} readOnlyReason={readOnlyReason} binding={binding}/>:<p role="status">No captured native Scene binding is available for these research instruments.</p>;
}
function ReceivingResearchScene({work,active,epoch,onSource,binding,readOnlyReason}:ReceivingResearchProps&{binding:{sceneId:string;expressionRef:string;sceneRef:string}}){
 const api=useKernel();
 const [root,setRoot]=useState<HTMLDivElement|null>(null),[notice,setNotice]=useState('');
 const source=useRef(onSource);source.current=onSource;
 const activeSurface=useRef(active);activeSurface.current=active;
 const {sceneId,expressionRef,sceneRef}=binding;
 const presentations=useMemo(()=>({canvas:createInstrumentPresentation(CANVAS,{ownerRef:'o-i',subjectRef:expressionRef,sceneRef,instanceRef:`instrument-editor:development:canvas:${expressionRef}:${sceneRef}`,label:'Controlled native Scene'}),timeline:createInstrumentPresentation(TIMELINE,{ownerRef:'o-i',subjectRef:expressionRef,sceneRef,instanceRef:`instrument-editor:development:timeline:${expressionRef}:${sceneRef}`,label:'Controlled native Scene'}),places:createInstrumentPresentation(PLACES,{ownerRef:'o-i',subjectRef:expressionRef,sceneRef,instanceRef:`instrument-editor:development:places:${expressionRef}:${sceneRef}`,label:'Controlled native Scene'})}),[work,expressionRef,sceneRef]);
 const host=useMemo<ResearchInstrumentsHost|undefined>(()=>{
  if(!root)return;
  let pending=false;
  const current=(requireSelected=true)=>{
   const view=work.work.state?.view;
   if(!view||view.document.expression_ref!==expressionRef||(requireSelected&&work.sceneId()!==sceneId)||view.bindings[sceneId]?.scene_ref!==sceneRef)throw Error('The captured native Expression and Scene changed; retained input was not transferred.');
   const scene=work.store.document.scenes.find(scene=>scene.id===sceneId);
   if(!scene)throw Error('The bound native Scene is absent.');
   return {view,scene};
  };
  const publish=async()=>{const reply=await work.request({operation:'read'});if(!reply.ok)throw Error(reply.error);};
  const save=async()=>{const reply=await work.request({operation:'save',basis:work.receiver.read().basis});if(!reply.ok)throw Error(reply.error);};
  const writable=()=>{if(readOnlyReason)throw Error(readOnlyReason);};
  const change=async(mutate:()=>void)=>{
   writable();
   const captured=current().view.document.revision;if(pending||work.work.busy||work.receiver.read().standing.pending)throw Error('Finish the retained native operation before another edit.');
   pending=true;
   const presentation=activeSurface.current?presentations[activeSurface.current]:undefined;
   presentation?.setDraft(true,'research-native-owner');
   try{work.store.change(mutate);await publish();if(current().view.document.revision!==captured)throw Error('The native revision advanced while this input was returning; the working draft was retained.');await save();presentation?.setDraft(false,'research-native-owner');}
   finally{pending=false;}
  };
  const moveMany:NonNullable<ResearchInstrumentsHost['moveMany']>=async(id,moves)=>{
   if(id!==sceneId)throw Error('Move belongs to another Scene.');
   const {view,scene}=current();
   if(new Set(moves.map(move=>move.entityId)).size!==moves.length)throw Error('A move may name each occurrence only once.');
   for(const move of moves){
    const occurrence=view.bindings[sceneId].occurrences.find(row=>row.view_entity_id===move.entityId);
    if(occurrence&&(view.document.entities[occurrence.entity_ref] as {pinned?:boolean})?.pinned)throw Error('This occurrence is pinned in place. Unpin it to move it.');
    if(blueprintMember(scene,move.entityId))throw Error('Use Blueprint to move the whole shape, or release it to edit individual positions.');
    const entity=scene.entities.find(row=>row.id===move.entityId);
    if(!entity||entity.locked)throw Error('This occurrence is locked or no longer present.');
    if(!Number.isFinite(move.position.x)||!Number.isFinite(move.position.y))throw Error('Position must be finite.');
   }
   await change(()=>{for(const move of moves){const item=scene.entities.find(row=>row.id===move.entityId)!;item.position.x=Math.max(-50,Math.min(50,move.position.x));item.position.y=Math.max(-50,Math.min(50,move.position.y));}});
  };
  const inspect=(ref:string,context?:unknown)=>{
   const {view}=current(),nativeScene=view.document.scenes.find(scene=>scene.scene_ref===sceneRef);
   const members=(nativeScene?.entity_refs??[]).flatMap(entityRef=>{const entity=view.document.entities[entityRef];return entity?.subject?.subject_ref===ref?[entity]:[];});
   if(!members.length)throw Error('This source is not a disclosed member of the captured native Scene.');
   source.current({schema:'oi.development-source-inspection/v1',basis:{expression_ref:expressionRef,revision:view.document.revision,scene_ref:sceneRef},subject_ref:ref,context,source:members});
  };
  return {
   container:root,tools:root,inspector:root,canvasHome:root,placesHome:root,
   nativeView:()=>work.work.state?.view,sceneId:()=>sceneId,
   sceneMaterial:id=>{if(id!==sceneId)throw Error('Material belongs to another Scene.');return current(false).scene;},
   material:async(id,action)=>{if(id!==sceneId)throw Error('Material belongs to another Scene.');const {scene}=current();await change(()=>applyResearchMaterial(scene,action));},
   move:(id,entityId,position)=>moveMany(id,[{entityId,position}]),moveMany,
   select:(id,entityId,bindingRef)=>{void(async()=>{
    if(id!==sceneId)throw Error('Selection belongs to another Scene.');writable();current();
    if(pending||work.work.busy||work.receiver.read().standing.pending||work.work.state?.pending)throw Error('Finish the retained native operation before selecting.');
    if(bindingRef)throw Error('This receiving owner needs a relation selection hook to synchronize local and native focus.');
    const basis=work.receiver.read().basis;
    const reply=await work.request(entityId===null?{operation:'select-field',basis}:{operation:'select',basis,entity_id:entityId});
    if(!reply.ok)throw Error(reply.error);
   })().catch(error=>setNotice(String(error)));},
   read:request=>{const {view}=current();if(request.expression_ref!==expressionRef||request.scene_ref!==sceneRef||request.revision!==view.document.revision)throw Error('Reading belongs to a different native basis.');return readWikiSceneTechne(api.transport,request);},
   inspectSubject:inspect,openSubject:ref=>inspect(ref),
  };
 },[work,root,api.transport,expressionRef,sceneRef,sceneId,presentations,readOnlyReason]);
 return <div ref={setRoot} data-research-workbench>
  {readOnlyReason&&<p role="status" data-research-readonly>{readOnlyReason}</p>}
  {notice&&<p role="alert">{notice}</p>}
  <p className="research-source-disclosure" hidden={!active}>Controlled native Expression · {expressionRef} · {sceneRef}. Wiki facets require their exact source binding. Native placement and material writes use the retained document owner.</p>
  {host&&(['canvas','timeline','places'] as const).map(kind=><div key={kind} className="editor-slot" hidden={active!==kind}><InstrumentFrame visible={active===kind} definition={kind==='canvas'?CANVAS:kind==='timeline'?TIMELINE:PLACES} presentation={presentations[kind]}>{(depth,visible)=>kind==='canvas'?<CanvasEditor host={host} depth={depth} target={{mode:'pin',sceneId}} ownerPending={!!work.work.state?.pending} revision={epoch} visible={visible&&active===kind} onDraftChange={value=>presentations[kind].setDraft(value)}/>:kind==='timeline'?<TimelineEditor host={host} sceneId={sceneId} depth={depth} revision={epoch} visible={visible&&active===kind} onDraftChange={value=>presentations[kind].setDraft(value)} onExpand={()=>presentations[kind].setDepth('full')}/>:<PlacesEditor host={host} sceneId={sceneId} depth={depth} revision={epoch} visible={visible&&active===kind} onDraftChange={value=>presentations[kind].setDraft(value)} onExpand={()=>presentations[kind].setDepth('full')}/>}</InstrumentFrame></div>)}
 </div>;
}
