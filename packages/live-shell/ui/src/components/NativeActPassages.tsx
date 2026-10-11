import {useEffect,useRef,useState} from 'react';
import {sameEditorBasis,type NativeEditorReply} from '../../../../expressions-boundary/src/editor';
import type {ActMaterialContract,NativeActList,WorldAct} from '../../../../expressions-boundary/src/nativeMaterials';
import type {NativeCompositionViewSource} from '../shell/compositionViews';

/** Passages retain the native Act's index, edition and revision. They are not
 * time-positioned Arrangement clips and this face owns no playback clock. */
export function currentNativeActReply(captured:NativeCompositionViewSource,current:NativeCompositionViewSource,reply:NativeEditorReply,act_ref?:string):boolean {
  if(!captured.isPresented()||!current.isPresented()||!captured.content||!current.content)return false;
  const before=captured.content.basis,now=current.currentReading?.()?.basis??current.content.basis;
  if(!reply.ok||reply.material?.kind!=='performed')return sameEditorBasis(before,now)&&(!reply.ok||sameEditorBasis(reply.reading.basis,now));
  const receipt=reply.material.receipt,act=receipt.outcome.act;
  return !!act&&receipt.followed&&act.act_ref===act_ref&&act.expression_ref===captured.content.basis.expression_ref
    &&now.expression_ref===act.expression_ref&&reply.reading.basis.revision===act.basis_revision
    &&sameEditorBasis(reply.reading.basis,now);
}

export function NativeActPassages({source,close}:{source:NativeCompositionViewSource;close:()=>void}) {
  const latest=useRef(source);latest.current=source;
  const lifetime=useRef({mounted:false,epoch:0});
  const inFlight=useRef<symbol|null>(null);
  const [inventory,setInventory]=useState<NativeActList|null>(null),[act,setAct]=useState<WorldAct|null>(null);
  const [busy,setBusy]=useState(false),[fault,setFault]=useState<string|null>(null);
  const expression=source.content?.basis.expression_ref;
  useEffect(()=>{const own=++lifetime.current.epoch;lifetime.current.mounted=true;return()=>{if(lifetime.current.epoch===own){lifetime.current.mounted=false;lifetime.current.epoch++}}},[]);
  useEffect(()=>{setInventory(null);setAct(null);setFault(null)},[expression]);
  const receive=async(effect:()=>Promise<NativeEditorReply>,act_ref?:string)=>{
    if(inFlight.current||!source.isPresented()||!source.actions)return;
    const captured=source,epoch=lifetime.current.epoch;
    const request=Symbol('native-performance-request');inFlight.current=request;
    setBusy(true);setFault(null);
    try {
      const reply=await effect();
      if(!lifetime.current.mounted||epoch!==lifetime.current.epoch||!currentNativeActReply(captured,latest.current,reply,act_ref))return;
      if(!reply.ok){setFault(reply.error);return;}
      const result=reply.material;
      if(result?.kind==='acts')setInventory(result.reading);
      else if(result?.kind==='act')setAct(result.reading);
      else if(result?.kind==='performed'&&result.receipt.outcome.act)setAct(result.receipt.outcome.act);
      else setFault('The native owner did not return the requested performance reading.');
    }catch(cause){
      const error=cause instanceof Error?cause.message:String(cause);
      if(lifetime.current.mounted&&epoch===lifetime.current.epoch&&currentNativeActReply(captured,latest.current,{ok:false,error}))setFault(error);
    }finally{if(inFlight.current===request){inFlight.current=null;if(lifetime.current.mounted&&epoch===lifetime.current.epoch)setBusy(false)}}
  };
  const ready=!!source.actions&&!source.content?.standing.pending&&!busy;
  const readList=()=>void receive(()=>source.actions!.listActs());
  return <section className="native-act-passages" aria-label="Native performances">
    <header><strong>Performances</strong><button disabled={!ready} onClick={readList}>{inventory?'Refresh':'Read performances'}</button><button onClick={close}>Return</button></header>
    {busy&&<p role="status">Reading the native performance…</p>}
    {fault&&<p role="alert">{fault}</p>}
    {inventory&&<><p>{inventory.persistent?'Saved performances':'Native session performances'} · {inventory.acts.length}</p>
      {inventory.store_errors.length>0&&<p role="alert">{inventory.store_errors.join(' · ')}</p>}
      <nav aria-label="Performances">{inventory.acts.map(row=>{
        // Only use a contract actually disclosed by the register. Old native
        // registers omit it; their inspection refusal remains visible.
        const disclosed=(row as typeof row&{material_contract?:ActMaterialContract}).material_contract;
        return <button key={row.act_ref} disabled={!ready} aria-pressed={act?.act_ref===row.act_ref} title={row.act_ref}
          onClick={()=>void receive(()=>source.actions!.inspectAct(row.act_ref,disclosed),row.act_ref)}>{row.summary||row.act_ref} · {row.passages} passages</button>;
      })}</nav>
      {!inventory.acts.length&&<p>No performances have been saved for this Expression.</p>}
    </>}
    {act&&<div data-native-act={act.act_ref} data-native-act-revision={act.revision}>
      <p><strong>{act.summary||act.act_ref}</strong> · {act.phase} · {act.actor}</p>
      <ol aria-label="Performance passages">{act.sequence.map(passage=><li key={passage.index}>
        <button disabled={!ready||act.phase==='running'} aria-pressed={act.position===passage.index}
          title={act.phase==='running'?'Hold the running performance before returning to a passage':`Return to native passage ${passage.index+1}`}
          onClick={()=>void receive(()=>source.actions!.seekAct(act.act_ref,act.revision,passage.index,act.material_contract),act.act_ref)}>
          {passage.summary||passage.text||passage.gesture||passage.state||passage.kind}
        </button>
        <small>{passage.kind}{passage.performance_edition?` · saved edition r${passage.performance_edition.revision}`:''}</small>
      </li>)}</ol>
      {act.return_ref&&<p title={act.return_ref}>Return · {act.result||act.return_ref}</p>}
    </div>}
  </section>;
}
