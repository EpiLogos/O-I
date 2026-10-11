import {useEffect,useMemo,useRef} from 'react';
import {GlyphSequenceEditor,type RetainedGlyphInput} from '../../../live-shell/ui/src/components/GlyphSequenceEditor';
import type {NativeEditorReading,NativeEditorReply,NativeEditorRequest} from '../../../expressions-boundary/src/editor';
import type {InstrumentPresentation} from '../frame/presentation';
export interface JourneyPhraseOwner {
 reading():NativeEditorReading|null;
 request(request:NativeEditorRequest):Promise<NativeEditorReply>;
 /** The existing Clip View/state owner's map, shared with its presentation. */
 drafts:Map<string,RetainedGlyphInput>;
}
/** Adopt the current Clip View component and its owner. The same retained
 * input map serves both views; no sequence reducer, clock or document copy. */
export function JourneyPhrase({owner,sceneRef,depth,presentation}:{owner:JourneyPhraseOwner;sceneRef:string;depth:'compact'|'full';presentation:InstrumentPresentation}){
 const drafts:Map<string,RetainedGlyphInput>=useMemo(()=>new Proxy(owner.drafts,{get(target,key){
  if(key==='set')return(id:string,value:RetainedGlyphInput)=>{target.set(id,value);presentation.setDraft(target.size>0,'journey-phrase-input');return drafts;};
  if(key==='delete')return(id:string)=>{const removed=target.delete(id);presentation.setDraft(target.size>0,'journey-phrase-input');return removed;};
  if(key==='clear')return()=>{target.clear();presentation.setDraft(false,'journey-phrase-input');};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }}),[owner.drafts,presentation]);
 useEffect(()=>{presentation.setDraft(drafts.size>0,'journey-phrase-input');},[drafts,presentation]);
 const latest=owner.reading(),held=useRef<NativeEditorReading|null>(null),textDraft=useRef<{value:string;entity_id:string;step_id:string}|null>(null);
 if(latest?.basis.scene_ref===sceneRef&&latest.basis.expression_ref===presentation.snapshot().target.subjectRef)held.current=latest;
 const onBasis=latest?.basis.scene_ref===sceneRef&&latest.basis.expression_ref===presentation.snapshot().target.subjectRef;
 const reading=onBasis?latest:held.current?{...held.current,standing:{...held.current.standing,pending:true}}:null;

 const request=async(request:NativeEditorRequest):Promise<NativeEditorReply>=>{
  if(request.operation!=='read'&&(request.basis.scene_ref!==sceneRef||request.basis.expression_ref!==presentation.snapshot().target.subjectRef))return {ok:false,error:'The phrase request addresses another bound native work.'};
  presentation.setDraft(true,'journey-phrase-operation');
  try{const result=await owner.request(request);
   if(result.ok&&request.operation==='apply'&&textDraft.current&&request.changes.some(change=>change.kind==='step-source'&&change.entity_id===textDraft.current!.entity_id&&change.step_id===textDraft.current!.step_id&&change.text===textDraft.current!.value)){
    textDraft.current=null;presentation.setDraft(false,'journey-phrase-text');
   }
   return result;
  }finally{presentation.setDraft(false,'journey-phrase-operation');}
 };
 return <div onChangeCapture={event=>{
  if(!(event.target instanceof HTMLTextAreaElement)||event.target.getAttribute('aria-label')!=='State glyph content'||!reading)return;
  // The adopted editor can select a state locally before native selection
  // is acknowledged. Its rendered active-state identity is the textarea's
  // basis; the asynchronous owner's selection must not relabel that draft.
  const editor=event.target.closest<HTMLElement>('[data-entity-id]');
  const entity=reading.scene.entities.find(value=>value.id===editor?.dataset.entityId&&value.kind==='formation');
  const activeId=editor?.querySelector<HTMLElement>('.glyph-actions span[title]')?.title;
  const step=entity?.sequence.steps.find(value=>value.id===activeId);
  presentation.setDraft(true,'journey-phrase-text');
  if(entity&&step){textDraft.current=textDraft.current?{...textDraft.current,value:event.target.value}:{value:event.target.value,entity_id:entity.id,step_id:step.id};presentation.setDraft(true,'journey-phrase-text');}
 }} onKeyUpCapture={event=>{if(event.key==='Escape'&&event.target instanceof HTMLTextAreaElement&&event.target.getAttribute('aria-label')==='State glyph content'){textDraft.current=null;presentation.setDraft(false,'journey-phrase-text');}}}>
 {!onBasis&&<p role="status">Select the pinned Scene in its native owner to continue its phrase. Pending input remains here on {sceneRef}.</p>}
 <GlyphSequenceEditor reading={reading} request={request} compact={depth==='compact'} onExpand={()=>presentation.setDepth('full')} drafts={drafts}/>
 </div>;
}
