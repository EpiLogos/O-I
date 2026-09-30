/** Native-reviewed references accompany actual playback. The native owner
 * retains the document checkpoint; this aperture keeps only session handles. */
import React,{forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {naraInstrumentRequest} from './kernelExpressions';
import {NativeExpressiveAct,type NativeActReview,type NativeActEffect} from '../../../src/nara/nativeExpressiveAct';
import type {InstrumentBasis} from '../../../src/nara/instrumentProtocol';

export interface NaraActHandle {
 cancelPending:()=>void;
 speechAdmitted:(answerBlockId:number,responseRef:string)=>void;
 speechCompleted:(answerBlockId:number)=>Promise<void>;
}
interface Props {
 basis:InstrumentBasis|null;naraRef:string|null;answerBlockId:number|null;
 selectionKey:string;visible:boolean;disabled:boolean;
 acceptNativeDocument:(document:unknown)=>Promise<void>|void;
 stopSpeech:()=>Promise<void>;
}
const message=(error:unknown)=>error instanceof Error?error.message:String(error);
export const NaraExpressiveActTools=forwardRef<NaraActHandle,Props>(function NaraExpressiveActTools(props,ref){
 const latest=useRef(props);latest.current=props;
 const [review,setReview]=useState<NativeActReview|null>(null),[target,setTarget]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [,redraw]=useState(0);const refresh=()=>redraw(value=>value+1);
 const generation=useRef(0),pending=useRef(false),mounted=useRef(false);
 const armed=useRef<{review:NativeActReview;target:string;basis:InstrumentBasis;naraRef:string}|null>(null);
 const controller=useRef<NativeExpressiveAct|null>(null);
 if(!controller.current)controller.current=new NativeExpressiveAct({
  request:async request=>{const result=await naraInstrumentRequest(request);if(result.schema!=='oi.nara-expressive-act-effect/v1')throw Error('The native owner returned another act result.');return result;},
  stopSpeech:()=>latest.current.stopSpeech(),
 });
 const cancelPending=()=>{armed.current=null;controller.current!.cancelPending();if(mounted.current)refresh();};
 const identityKey=JSON.stringify([props.basis,props.naraRef]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;generation.current++;cancelPending();};},[]);
 useEffect(()=>{generation.current++;cancelPending();setReview(null);setTarget('');setError('');setNotice('');},[props.selectionKey,props.answerBlockId,props.visible]);
 useEffect(()=>{
  // A different person or source can never inherit this private checkpoint.
  controller.current=null;
  controller.current=new NativeExpressiveAct({
   request:async request=>{const result=await naraInstrumentRequest(request);if(result.schema!=='oi.nara-expressive-act-effect/v1')throw Error('The native owner returned another act result.');return result;},
   stopSpeech:()=>latest.current.stopSpeech(),
  });refresh();
 },[identityKey]);
 useEffect(()=>{
  if(!props.visible||!props.basis||!props.naraRef)return;
  const current=controller.current!,held=current.read();
  if(held?.running||held?.state.phase==='active'||armed.current)return;
  const at=generation.current,basis=props.basis,naraRef=props.naraRef;
  let disposed=false;
  void naraInstrumentRequest({operation:'act_status',basis,role:'nara'}).then(result=>{
   if(disposed||!mounted.current||at!==generation.current||controller.current!==current||armed.current)return;
   const live=current.read();if(live?.running||live?.state.phase==='active')return;
   if(result.schema!=='oi.nara-expressive-act-status/v1')throw Error('The native owner returned another checkpoint reading.');
   current.recover(result,basis,naraRef);refresh();
  }).catch(failure=>{if(!disposed&&mounted.current&&at===generation.current)setError(message(failure));});
  return()=>{disposed=true;};
 },[identityKey,props.visible]);
 const sameBasis=(basis:InstrumentBasis|null,other:InstrumentBasis|null)=>!!basis&&!!other&&basis.expression_ref===other.expression_ref&&basis.source.source_ref===other.source.source_ref&&basis.source.revision===other.source.revision;
 const adopt=async(result:NativeActEffect,basis:InstrumentBasis|null)=>{
  if(!mounted.current||!sameBasis(basis,latest.current.basis)||result.expression_ref!==latest.current.basis?.expression_ref||result.nara_ref!==latest.current.naraRef)throw Error('The act finished in its original native Expression after the person or source changed. Reopen that encounter to inspect it.');
  if(result.effect_applied){if(!result.document)throw Error('The native act changed selection but returned no document.');await latest.current.acceptNativeDocument(result.document);}
 };
 useImperativeHandle(ref,()=>({cancelPending,
  speechAdmitted:(block,response)=>{
   const chosen=armed.current;armed.current=null;
   if(!chosen||!latest.current.visible||!chosen.review.answer_block_ids.includes(block)||!sameBasis(chosen.basis,latest.current.basis)||chosen.naraRef!==latest.current.naraRef)return;
   controller.current!.begin(chosen.review,chosen.basis,chosen.naraRef,chosen.target,response);refresh();
  },
  speechCompleted:async block=>{
   const current=controller.current!,basis=latest.current.basis;current.speechCompleted(block);
   const result=await current.advanceFocus();
   if(result)await adopt(result,basis);
   if(mounted.current){refresh();if(result)setNotice(result.effect_applied?'The answer finished and the Expression followed its chosen reference.':'That reference is already selected.');}
  },
 }));
 const run=async(operation:()=>Promise<void>)=>{
  if(pending.current)return;pending.current=true;setBusy(true);setError('');const at=generation.current;
  try{await operation();}catch(failure){if(mounted.current&&generation.current===at)setError(message(failure));}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 const inspect=()=>void run(async()=>{
  const {basis,answerBlockId}=latest.current;if(!basis||answerBlockId===null)throw Error('Choose a saved identity and a completed Nara answer.');
  const at=generation.current,result=await naraInstrumentRequest({operation:'act_inspect',basis,role:'nara',answer_block_id:answerBlockId});
  if(generation.current!==at)return;
  if(result.schema!=='oi.nara-expressive-act-review/v1')throw Error('The native owner returned another review.');
  setReview(result);setTarget('');setNotice(result.targets.length?'Choose a reference, then listen to this answer.':'This answer cites no actionable reference in the current Expression.');
 });
 const arm=()=>{
  if(!review||!props.basis||!props.naraRef||!review.targets.some(value=>value.ref===target))return;
  cancelPending();armed.current={review,target,basis:props.basis,naraRef:props.naraRef};
  setNotice('Ready. Listen to this answer; its chosen focus follows only after playback finishes. Stop cancels that movement.');refresh();
 };
 const restore=()=>void run(async()=>{cancelPending();const basis=latest.current.basis,result=await controller.current!.restore();await adopt(result,basis);if(mounted.current){refresh();setNotice('Returned to the selection before this act. The live simulation continues.');}});
 const state=controller.current.read();
 return <section className="nara-conversation-tool" aria-label="Follow Nara’s references" hidden={!props.visible}>
  <header><h3>Follow the answer</h3><p>Choose where the Expression should focus after Nara finishes speaking.</p></header>
  <div className="nara-personal-actions"><button type="button" disabled={props.disabled||busy||!props.basis||props.answerBlockId===null} onClick={inspect}>Review spoken references</button>
   {state?.checkpoint_available&&<button type="button" disabled={props.disabled||busy||state.running||state.state.phase==='active'} onClick={restore}>Return to before the act</button>}
  </div>
  {review&&review.targets.length>0&&<><label className="nara-personal-input"><span>Focus after playback</span><select aria-label="Focus after playback" value={target} disabled={props.disabled||busy} onChange={event=>{cancelPending();setTarget(event.target.value);}}><option value="">Choose a cited reference</option>{review.targets.map(value=><option key={value.ref} value={value.ref}>{value.label}{value.effect_required?'':' · already selected'}</option>)}</select></label><button type="button" disabled={props.disabled||busy||!target} onClick={arm}>Follow with next playback</button></>}
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {state&&<details><summary>Act and checkpoint</summary><p>{state.state.phase} · {state.pending} pending movement{state.pending===1?'':'s'}. Checkpoints restore authored selection at a new revision; they do not rewind particles or sound.</p></details>}
 </section>;
});
