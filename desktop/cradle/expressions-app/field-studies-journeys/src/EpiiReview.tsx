import React,{useEffect,useRef,useState} from 'react';
import {naraInstrumentRequest} from './kernelExpressions';
import type {InstrumentBasis} from '../../../src/nara/instrumentProtocol';
import type {NativeEpiiReview} from '../../../src/nara/epiiTypes';
/** A displayed return grants no authority. Accept sends only its original
 * native block and chosen exact reference for a fresh native validation. */
export function EpiiReview({basis,answerBlockId,selectionKey,disabled,acceptNativeDocument}:{
 basis:InstrumentBasis|null;answerBlockId:number;selectionKey:string;disabled:boolean;
 acceptNativeDocument:(document:unknown)=>Promise<void>|void;
}){
 const [review,setReview]=useState<NativeEpiiReview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const epoch=useRef(0),pending=useRef(false);
 useEffect(()=>{epoch.current++;setReview(null);setError('');setNotice('');setBusy(false);return()=>{epoch.current++;};},[selectionKey,answerBlockId]);
 const run=async(operation:()=>Promise<void>)=>{if(pending.current)return;pending.current=true;const at=epoch.current;setBusy(true);setError('');try{await operation();}catch(e){if(epoch.current===at)setError(e instanceof Error?e.message:String(e));}finally{pending.current=false;if(epoch.current===at)setBusy(false);}};
 const inspect=()=>void run(async()=>{
  if(!basis)throw Error('Select the saved identity and its native Expression.');
  const at=epoch.current,result=await naraInstrumentRequest({operation:'epii_inspect',basis,role:'epii',answer_block_id:answerBlockId});
  if(epoch.current!==at)return;
  if(result.schema!=='oi.nara-epii-review/v1')throw Error('The native owner returned another review.');
  setReview(result);setNotice('');
 });
 const accept=(focus_ref:string)=>void run(async()=>{
  if(!basis||!review?.apply_allowed)throw Error('Read a current native proposal before accepting.');
  const at=epoch.current,result=await naraInstrumentRequest({operation:'epii_accept',basis,role:'epii',answer_block_id:answerBlockId,focus_ref});
  if(result.schema!=='oi.nara-epii-accepted/v1'||!result.applied)throw Error('The native owner did not confirm this focus.');
  if(epoch.current!==at)return;
  await acceptNativeDocument(result.document);
  if(epoch.current===at){setReview(null);setNotice('Accepted. The native Expression now focuses the chosen subject.');}
 });
 return <section className="nara-personal-depth" aria-label="Epii proposal review">
  <button type="button" disabled={disabled||busy||!basis} onClick={inspect}>{busy?'Reading native review…':'Review Epii proposal'}</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {review&&<>
   <p>{review.enrichment.synthesis}</p><p>{review.enrichment.standing}</p>
   {!review.apply_allowed&&<p role="status">{review.reason??'This return remains available, but its original basis is no longer current.'}</p>}
   {review.enrichment.factory_commission_proposal&&<section aria-label="Proposed development work">
    <h4>Proposed development work</h4>
    <p>{review.enrichment.factory_commission_proposal.discrepancy}</p>
    <p>Proposed for Factory review. Retaining this return does not start the work.</p>
   </section>}
   {!!review.enrichment.continuing_questions.length&&<ul>{review.enrichment.continuing_questions.map((question,index)=><li key={index}>{question}</li>)}</ul>}
   <div className="nara-personal-actions">{review.focus_targets.map(target=><button type="button" key={target.ref} disabled={disabled||busy||!review.apply_allowed} onClick={()=>accept(target.ref)}>Accept focus: {target.label}</button>)}
    <button type="button" disabled={busy} onClick={()=>{setReview(null);setNotice('Proposal dismissed. The Expression was not changed; the original return remains in the conversation.');}}>Reject proposal</button>
   </div>
   <details><summary>Sources and proposed changes</summary>
    {(['source_refs','method_refs','evidence_refs','coordinate_refs'] as const).map(kind=><div key={kind}><h4>{kind.replaceAll('_',' ')}</h4>{review.enrichment[kind].length?<ul>{review.enrichment[kind].map(reference=><li key={reference}>{reference}</li>)}</ul>:<p>None supplied.</p>}</div>)}
    <p>{review.unsupported_proposals_standing}</p>
    <pre>{JSON.stringify({scene:review.enrichment.proposed_scene_change_refs,profile:review.enrichment.proposed_profile_variant_ref,expressive_acts:review.enrichment.proposed_expressive_act_refs,native_actions:review.enrichment.proposed_native_action_refs,factory:review.enrichment.factory_commission_proposal},null,2)}</pre>
   </details>
   <details><summary>Source Inspect</summary><pre>{JSON.stringify(review.provenance,null,2)}</pre></details>
  </>}
 </section>;
}
