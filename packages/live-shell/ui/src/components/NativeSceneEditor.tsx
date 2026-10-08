import {useEffect, useRef, useState} from 'react';
import {sameEditorBasis, type NativeEditorReading, type NativeEditorReply, type NativeEditorRequest} from '@epilogos/expressions-boundary/editor';
import type {NativeSceneEditIntent} from '@epilogos/expressions-boundary/scene-edits';
import {SCENE_LIMIT, SCENE_REF_MIME, addSceneBlock, addSceneIntent, dropSlotTarget, reorderScenes, sceneStanding} from './nativeSceneList';
import {loopBlock, loopIntent} from './nativeScenePlayback';
import './NativeSceneEditor.css';

type Reading = NativeEditorReading & {playback: NonNullable<NativeEditorReading['playback']>; nativeSelection: NonNullable<NativeEditorReading['nativeSelection']>};
type Draft = {value: string; reading: Reading; field: 'title' | 'duration' | 'transition'};
/** A row being dragged, and the insertion slot (0..n, before row slot) under the pointer. */
type Drag = {ref: string; slot: number | null};

/** Scene material stays in its native owner. Input drafts keep the exact basis
 * on which typing began, including while another Scene is presented. */
export function NativeSceneEditor({reading, request}: {reading: NativeEditorReading | null; request: (request: NativeEditorRequest) => Promise<NativeEditorReply>}) {
  const drafts=useRef(new Map<string,Draft>()),submitting=useRef(new Map<Draft,Promise<boolean>>());
  const latest=useRef(reading);latest.current=reading;
  const alive=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
  const [,redraw]=useState(0),[fault,setFault]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const [drag,setDrag]=useState<Drag|null>(null);
  const dragRef=useRef<Drag|null>(null),listRef=useRef<HTMLOListElement>(null),focusRef=useRef<string|null>(null);
  // A keyboard or drag reorder keeps focus on the moved row after the owner's reading lands.
  useEffect(()=>{
    const ref=focusRef.current;if(!ref)return;focusRef.current=null;
    const moved=Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-scene-ref]')??[]).find(element=>element.dataset.sceneRef===ref);
    moved?.querySelector<HTMLElement>('.native-scene-row-title')?.focus();
  });
  if(!reading?.scenes||!reading.playback)return <div className="glyph-empty">The native Scene owner has not disclosed its material.</div>;
  const row=reading.scenes.scenes.find(row=>row.scene_ref===reading.basis.scene_ref);
  if(!row)return null;
  const r=reading,scenes=reading.scenes,focused=r.nativeSelection?.scene_ref===r.basis.scene_ref&&!r.nativeSelection.relation_ref;
  const ready=!!r.nativeSelection&&focused&&!r.standing.pending&&!busy&&row.material.available;
  const current=(captured: NativeEditorReading,reply: NativeEditorReply)=>alive.current&&latest.current?.basis.expression_ref===captured.basis.expression_ref
    && (sameEditorBasis(captured.basis,latest.current.basis)||reply.ok&&sameEditorBasis(reply.reading.basis,latest.current.basis));
  async function send(operation: NativeEditorRequest, captured=r):Promise<boolean> {
    setBusy(true);setFault(null);
    try {const reply=await request(operation);if(current(captured,reply))setFault(reply.ok?null:reply.error);return reply.ok}
    catch(cause){if(current(captured,{ok:false,error:''}))setFault(cause instanceof Error?cause.message:String(cause));return false}
    finally{if(alive.current)setBusy(false)}
  }
  const edit=(intent:NativeSceneEditIntent,captured=r)=>captured.playback&&captured.nativeSelection
    ?send({operation:'scene-edit',basis:{...captured.basis},intent_epoch:captured.playback.intent_epoch,native_selection:structuredClone(captured.nativeSelection),intent},captured):Promise.resolve(false);
  const commit=(key:string)=>{
    const draft=drafts.current.get(key);if(!draft)return;
    if(submitting.current.has(draft))return;
    const value=Number(draft.value),intent:NativeSceneEditIntent=draft.field==='title'?{operation:'rename',scene_ref:draft.reading.basis.scene_ref,title:draft.value}
      :{operation:'pacing',scene_ref:draft.reading.basis.scene_ref,[draft.field]:value};
    if(!draft.value.trim()||draft.field!=='title'&&!Number.isFinite(value)){setFault('Enter a complete Scene value');return}
    const promise=edit(intent,draft.reading);submitting.current.set(draft,promise);
    void promise.then(ok=>{submitting.current.delete(draft);if(ok&&drafts.current.get(key)===draft){drafts.current.delete(key);if(alive.current)redraw(v=>v+1)}});
  };
  const input=(field:Draft['field'],label:string,value:string,min?:number,max?:number)=>{
    const key=JSON.stringify([r.basis.expression_ref,r.basis.scene_ref,field]),draft=drafts.current.get(key);
    return <label><span>{label}</span><input aria-label={label} type={field==='title'?'text':'number'} value={draft?.value??value} min={min} max={max} step={field==='duration'?'.1':'.01'} maxLength={field==='title'?160:undefined} disabled={!ready}
      onChange={event=>{const captured=draft?.reading??r as Reading;drafts.current.set(key,{value:event.target.value,reading:captured,field});redraw(v=>v+1)}}
      onBlur={()=>commit(key)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();commit(key)}if(event.key==='Escape'){drafts.current.delete(key);redraw(v=>v+1);event.currentTarget.blur()}}}/></label>;
  };
  const order=scenes.working_order.filter((ref):ref is string=>ref!==null),index=order.indexOf(row.scene_ref);
  const byRef=new Map(scenes.scenes.map(scene=>[scene.scene_ref,scene]));
  const complete=scenes.completeness.order,reorderReady=ready&&complete;
  // Every reorder is one request carrying the full ordered ref array.
  const reorderTo=(ref:string,to:number)=>{const next=reorderScenes(order,order.indexOf(ref),to);if(!next||!reorderReady)return;focusRef.current=ref;void edit({operation:'reorder',scene_refs:next}).then(ok=>{if(!ok&&focusRef.current===ref)focusRef.current=null})};
  const endDrag=()=>{dragRef.current=null;setDrag(null)};
  const snapshot=(action:'save-snapshot'|'restore-snapshot',next=false)=>void send({operation:'scene',basis:{...r.basis},intent_epoch:r.playback!.intent_epoch,...(action==='save-snapshot'?{action,name:row.title,next}:{action})});
  const standing=sceneStanding(row),nextBlock=scenes.working_order.length>=SCENE_LIMIT?'An expression can contain up to 64 Scenes':null;
  const addBlock=addSceneBlock(order.length,complete),loopReason=loopBlock({ready,savedAvailable:scenes.timing.saved.available});
  return <div className="native-scene-editor" aria-label="Scene clip details">
    <section className="native-scene-properties"><header><strong>Scene</strong><span title={standing.title}>{standing.label}</span></header>
      {input('title','Scene name',row.title)}{input('duration','Duration · s',String(row.working?.duration??''),1,3600)}{input('transition','Transition · s',String(row.working?.transition??''),0,30)}
      <div className="native-scene-detail-actions">
        <button disabled={!ready||!row.membership.complete} title="Capture this Scene in place" onClick={()=>snapshot('save-snapshot')}>Capture</button>
        <button disabled={!ready||!row.membership.complete||!complete||!!nextBlock} title={nextBlock??'Capture and move to the next Scene'} aria-label="Save & next: capture and move to the next Scene" onClick={()=>snapshot('save-snapshot',true)}>Save &amp; next</button>
        <button disabled={!ready||!row.membership.complete||row.snapshot.availability!=='present'} title="Restore this Scene from its saved snapshot" onClick={()=>snapshot('restore-snapshot')}>Restore</button>
      </div>
      <div className="native-scene-detail-actions"><button role="switch" aria-checked={scenes.loop} className="native-scene-loop" disabled={!!loopReason} title={loopReason??'Loop the saved Scene sequence back to its first Scene at the end'} onClick={()=>void edit(loopIntent(!scenes.loop))}>Loop saved sequence</button></div>
      {!focused&&<button disabled={r.standing.pending||busy||!row.material.available} onClick={()=>void send({operation:'scene',basis:{...r.basis},intent_epoch:r.playback!.intent_epoch,action:'focus',scene_ref:row.scene_ref})}>Focus Scene</button>}
      <small>{row.member_refs.length} native members{!row.membership.complete?' · membership incomplete':''}</small>
      {fault&&<p role="alert">{fault}</p>}
    </section>
    <section className="native-scene-list" aria-label="Scene order"><header><strong>Scenes</strong><span>{index+1} / {order.length}</span></header>
      <div className="native-scene-detail-actions">
        <button disabled={!ready||!!addBlock} title={addBlock??'Add a blank Scene after this one'} onClick={()=>void edit(addSceneIntent())}>+ Scene</button>
        <button disabled={!ready||!row.membership.complete||!complete||order.length>=SCENE_LIMIT} title="Duplicate this Scene after itself" onClick={()=>void edit({operation:'duplicate',scene_ref:row.scene_ref})}>Duplicate</button>
        <button disabled={!ready||!complete||order.length<=1} title="Remove this Scene from the expression" onClick={()=>void edit({operation:'remove',scene_ref:row.scene_ref})}>Remove</button>
      </div>
      <ol className="native-scene-rows" ref={listRef} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setDrag(value=>value&&{...value,slot:null})}}>
        {scenes.working_order.map((ref,position)=>{
          const scene=ref===null?undefined:byRef.get(ref);
          if(ref===null||!scene)return <li key={`local-${position}`} className="native-scene-row is-local" title="Local draft: it has no native Scene identity yet">Local draft</li>;
          const at=order.indexOf(ref),presented=ref===r.basis.scene_ref,item=sceneStanding(scene);
          const slot=drag?.slot??null,from=drag?order.indexOf(drag.ref):-1;
          const showLine=slot!==null&&from>=0&&dropSlotTarget(from,slot)!==from;
          const marker=showLine?(slot===position?'before':slot===position+1?'after':undefined):undefined;
          return <li key={ref} className={`native-scene-row${presented?' is-presented':''}`} data-scene-ref={ref} data-drop={marker} aria-label={`Scene ${position+1}: ${scene.title}, ${item.label}`} aria-current={presented?'true':undefined}
            draggable={reorderReady}
            onDragStart={event=>{if(!reorderReady){event.preventDefault();return}const next={ref,slot:null};dragRef.current=next;setDrag(next);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(SCENE_REF_MIME,ref)}}
            onDragOver={event=>{const from=dragRef.current;if(!from||!reorderReady||!event.dataTransfer.types.includes(SCENE_REF_MIME))return;event.preventDefault();event.dataTransfer.dropEffect='move';const box=event.currentTarget.getBoundingClientRect(),slot=event.clientY<box.top+box.height/2?position:position+1;if(from.slot!==slot){const next={...from,slot};dragRef.current=next;setDrag(next)}}}
            onDrop={event=>{event.preventDefault();const from=dragRef.current;endDrag();if(!from||from.slot===null)return;reorderTo(from.ref,dropSlotTarget(order.indexOf(from.ref),from.slot))}}
            onDragEnd={endDrag}
            onKeyDown={event=>{if(!event.altKey||(event.key!=='ArrowUp'&&event.key!=='ArrowDown'))return;event.preventDefault();reorderTo(ref,at+(event.key==='ArrowUp'?-1:1))}}>
            <span className="native-scene-grip" aria-hidden="true">⋮⋮</span>
            <button className="native-scene-row-title" disabled={presented||!scene.material.available||!r.nativeSelection||r.standing.pending||busy} title={presented?'The presented Scene':scene.material.reason??'Focus this Scene'}
              onClick={()=>void send({operation:'scene',basis:{...r.basis},intent_epoch:r.playback!.intent_epoch,action:'focus',scene_ref:ref})}>{scene.title}</button>
            <small className="native-standing" data-tone={item.tone} title={item.title}>{item.label}</small>
            <button className="native-scene-move" aria-label={`Move ${scene.title} earlier`} disabled={!reorderReady||at<=0} onClick={()=>reorderTo(ref,at-1)}>▲</button>
            <button className="native-scene-move" aria-label={`Move ${scene.title} later`} disabled={!reorderReady||at<0||at>=order.length-1} onClick={()=>reorderTo(ref,at+1)}>▼</button>
          </li>;
        })}
      </ol>
      <small>Drag a row, or focus it and press Alt+↑ or Alt+↓. Each move is one reorder.</small>
    </section>
    <section className="native-scene-members"><header><strong>Objects</strong><span>{row.members.filter(member=>member.state==='loaded').length} loaded</span></header>{r.scene.entities.map(entity=><button key={entity.id} disabled={busy||r.standing.pending||!r.entityOccurrences[entity.id]} onClick={()=>void send({operation:'select',basis:{...r.basis},entity_id:entity.id})}>{entity.name}<small>{entity.kind==='formation'?`${entity.sequence.steps.length} states`:'Force'}</small></button>)}</section>
  </div>;
}
