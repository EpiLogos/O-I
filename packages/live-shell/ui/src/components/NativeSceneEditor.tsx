import {useEffect, useRef, useState} from 'react';
import {sameEditorBasis, type NativeEditorReading, type NativeEditorReply, type NativeEditorRequest} from '@epilogos/expressions-boundary/editor';
import type {NativeSceneEditIntent} from '@epilogos/expressions-boundary/scene-edits';
import './NativeSceneEditor.css';

type Reading = NativeEditorReading & {playback: NonNullable<NativeEditorReading['playback']>; nativeSelection: NonNullable<NativeEditorReading['nativeSelection']>};
type Draft = {value: string; reading: Reading; field: 'title' | 'duration' | 'transition'};

/** Scene material stays in its native owner. Input drafts keep the exact basis
 * on which typing began, including while another Scene is presented. */
export function NativeSceneEditor({reading, request}: {reading: NativeEditorReading | null; request: (request: NativeEditorRequest) => Promise<NativeEditorReply>}) {
  const drafts=useRef(new Map<string,Draft>()),submitting=useRef(new Map<Draft,Promise<boolean>>());
  const latest=useRef(reading);latest.current=reading;
  const alive=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
  const [,redraw]=useState(0),[fault,setFault]=useState<string|null>(null),[busy,setBusy]=useState(false),[configure,setConfigure]=useState(false);
  if(!reading?.scenes||!reading.playback)return <div className="glyph-empty">The native Scene owner has not disclosed its material.</div>;
  const row=reading.scenes.scenes.find(row=>row.scene_ref===reading.basis.scene_ref);
  if(!row)return null;
  const r=reading,focused=r.nativeSelection?.scene_ref===r.basis.scene_ref&&!r.nativeSelection.relation_ref;
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
  const order=r.scenes!.working_order.filter((ref):ref is string=>ref!==null),index=order.indexOf(row.scene_ref);
  const move=(delta:number)=>{const next=[...order];[next[index],next[index+delta]]=[next[index+delta],next[index]];void edit({operation:'reorder',scene_refs:next})};
  const snapshot=(action:'save-snapshot'|'restore-snapshot')=>void send({operation:'scene',basis:{...r.basis},intent_epoch:r.playback!.intent_epoch,...(action==='save-snapshot'?{action,name:row.title,next:false}:{action})});
  return <div className="native-scene-editor" aria-label="Scene clip details">
    <section className="native-scene-properties"><header><strong>Scene</strong><span title={row.membership.reason??undefined}>{row.snapshot.standing??(row.snapshot.availability==='present'?'Snapshot present · partial membership':row.snapshot.availability==='absent'?'Working draft':'Snapshot unavailable')}</span></header>
      {input('title','Scene name',row.title)}{input('duration','Duration · s',String(row.working?.duration??''),1,3600)}{input('transition','Transition · s',String(row.working?.transition??''),0,30)}
      <div className="native-scene-detail-actions"><button disabled={!ready||!row.membership.complete} onClick={()=>snapshot('save-snapshot')}>Capture</button><button disabled={!ready||!row.membership.complete||row.snapshot.availability!=='present'} onClick={()=>snapshot('restore-snapshot')}>Restore</button><button aria-expanded={configure} onClick={()=>setConfigure(v=>!v)}>Configure</button></div>
      {!focused&&<button disabled={r.standing.pending||busy||!row.material.available} onClick={()=>void send({operation:'scene',basis:{...r.basis},intent_epoch:r.playback!.intent_epoch,action:'focus',scene_ref:row.scene_ref})}>Focus Scene</button>}
      {fault&&<p role="alert">{fault}</p>}
    </section>
    <section className="native-scene-structure" hidden={!configure}><header><strong>Scene order</strong><span>{index+1} / {order.length}</span></header>
      <div className="native-scene-detail-actions"><button disabled={!ready||!r.scenes!.completeness.order||index<=0} onClick={()=>move(-1)}>Move earlier</button><button disabled={!ready||!r.scenes!.completeness.order||index<0||index>=order.length-1} onClick={()=>move(1)}>Move later</button></div>
      <div className="native-scene-detail-actions"><button disabled={!ready||!row.membership.complete||order.length>=64} onClick={()=>void edit({operation:'duplicate',scene_ref:row.scene_ref})}>Duplicate</button><button disabled={!ready||order.length<=1} onClick={()=>void edit({operation:'remove',scene_ref:row.scene_ref})}>Remove</button></div>
      <small>{row.member_refs.length} native members{!row.membership.complete?' · membership incomplete':''}</small>
    </section>
    <section className="native-scene-members"><header><strong>Objects</strong><span>{row.members.filter(member=>member.state==='loaded').length} loaded</span></header>{r.scene.entities.map(entity=><button key={entity.id} disabled={busy||r.standing.pending||!r.entityOccurrences[entity.id]} onClick={()=>void send({operation:'select',basis:{...r.basis},entity_id:entity.id})}>{entity.name}<small>{entity.kind==='formation'?`${entity.sequence.steps.length} states`:'Force'}</small></button>)}</section>
  </div>;
}
