import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {InstrumentBasis} from '../../../src/nara/instrumentProtocol';
import type {M3Gesture,M3Operation,NativeM3Reading} from '../../../src/nara/nativeM3';
import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
import {naraInstrumentRequest} from './kernelExpressions';
import {createTarotScoreClient,decodeToken,refusalReason,type FieldScoreBasis,type FieldScoreReply,
 type TarotScoreReading,type TokenPresentation} from './tarotScoreClient';

/** The selected subject's Tarot score as a reading of its own. The score is
 * resolved through the live field's own exchange and held with its basis
 * revision; the card bodies move through the native M3 gestures the resident
 * form already answers. Every card, codon, pose and clock fact shown is read
 * from a native reply, and a refusal from the score owner is shown in its own
 * words. */
export function TarotScore({basis,selectionKey,current,disabled,onPresent,presented,fieldBasis,fieldScore}:{
 basis:InstrumentBasis|null;selectionKey:string;current:NativeCurrentReading|null;disabled:boolean;
 onPresent:(reading:NativeM3Reading|null)=>void;presented:boolean;
 fieldBasis?:()=>FieldScoreBasis|null;fieldScore?:(command:unknown)=>Promise<FieldScoreReply>;
}){
 const [score,setScore]=useState<TarotScoreReading|null>(null),[standing,setStanding]=useState<{current:boolean;resolvedEventRef:string}|null>(null);
 const [refusal,setRefusal]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [fieldIdentity,setFieldIdentity]=useState<FieldScoreBasis|null>(null);
 const [selected,setSelected]=useState<number|null>(null),[mode,setMode]=useState<'view'|'author'|'determinant'>('view');
 const [form,setForm]=useState<NativeM3Reading|null>(null),[receipt,setReceipt]=useState<string|null>(null);
 const [annotation,setAnnotation]=useState(''),[annotations,setAnnotations]=useState<{id:number;tokenRef:string|null;origin:'interpretation'|'authored assignment';text:string}[]>([]);
 const [clockSteps,setClockSteps]=useState('1'),[manualAddress,setManualAddress]=useState('');
 const epoch=useRef(0),pending=useRef(false),live=useRef(true),formRef=useRef<NativeM3Reading|null>(null),readSeq=useRef(0);
 const event=current?.context?.event_ref??null,key=JSON.stringify([selectionKey,event]);
 const client=useMemo(()=>fieldBasis&&fieldScore?createTarotScoreClient({fieldBasis,fieldScore}):null,[fieldBasis,fieldScore]);
 useEffect(()=>{live.current=true;epoch.current++;setScore(null);setStanding(null);setRefusal(null);setError('');setBusy(false);
  setSelected(null);setForm(null);formRef.current=null;setReceipt(null);setAnnotations([]);setAnnotation('');setManualAddress('');
  return()=>{live.current=false;epoch.current++;};},[key]);
 /** One score read through the field's exchange: `resolve` holds a score over
  * the field's current basis, `state` answers the held one with its
  * currentness. A refusal is kept as the reading, in the owner's words. */
 const read=async(kind:'resolve'|'state')=>{
  if(!client)return;
  const at=++readSeq.current;
  setBusy(true);setError('');
  try{
   setFieldIdentity(fieldBasis?.()??null);
   const reply=kind==='resolve'?await client.resolve():await client.state();
   if(!live.current||at!==readSeq.current)return;
   if(reply.refused){setRefusal(refusalReason(reply));if(kind==='resolve'){setScore(null);setStanding(null);}}
   else{setRefusal(null);setScore(reply.score);setStanding({current:reply.current,resolvedEventRef:reply.resolved_event_ref});}
  }catch(e){if(live.current&&at===readSeq.current)setError(e instanceof Error?e.message:String(e));}
  finally{if(live.current&&at===readSeq.current)setBusy(false);}
 };
 useEffect(()=>{void read('resolve');},[client,key]);
 const integer=(value:string,label:string)=>{
  if(!/^\d+$/.test(value))throw Error(`Enter ${label}.`);
  const n=Number(value);if(!Number.isSafeInteger(n))throw Error(`Enter a valid ${label}.`);return n;
 };
 /** The native M3 gesture path the Form and clock view uses: read the form,
  * then apply through the one transactional owner. */
 const gesture=async(operations:M3Operation[])=>{
  if(!basis||pending.current||disabled)return null;
  pending.current=true;setBusy(true);setError('');const at=epoch.current;
  const send=async(request:M3Gesture)=>{
   const result=await naraInstrumentRequest({operation:'m3',basis,role:'nara',request});
   if(!live.current||at!==epoch.current)return null;
   if(result.schema!=='oi.m3-reception-context/v1'||result.expression_ref!==basis.expression_ref||result.identity_revision!==basis.source.revision||result.event_ref!==event)throw Error('The native form belongs to another occasion.');
   formRef.current=result;setForm(result);
   return result;
  };
  try{
   let held=formRef.current;
   if(!held||held.status!=='available'||!held.state){
    held=await send({operation:'read'});
    if(!live.current||at!==epoch.current)return null;
    if(held?.status!=='available'||!held?.state)throw Error('No native form is open for this occasion. Open one in Form and clock first.');
   }
   const result=await send({operation:'apply',expected_generation:held.state.identity.profile_generation,operations});
   if(!live.current||at!==epoch.current)return null;
   if(result?.status==='available'&&result.state)setReceipt(`${result.receipts?.at(-1)?.status??'applied'} · generation ${result.state.identity.profile_generation}`);
   if(presented&&result)onPresent(result.status==='available'?result:null);
   return result;
  }catch(e){if(live.current&&at===epoch.current)setError(e instanceof Error?e.message:String(e));return null;}
  finally{pending.current=false;if(live.current&&at===epoch.current)setBusy(false);}
 };
 const decoded=useMemo(()=>{try{return{tokens:score?score.tokens.map(decodeToken):[],error:''};}catch(e){return{tokens:[] as TokenPresentation[],error:e instanceof Error?e.message:String(e)};}},[score]);
 const tokens=decoded.tokens;
 const selectedToken=selected!=null?tokens[selected]??null:null;
 const clock=score?.clock;
 const clockMoved=!!(clock&&fieldIdentity&&Number.isSafeInteger(clock.steps)&&clock.steps!==fieldIdentity.clock_steps);
 const cardOperations=(token:TokenPresentation):M3Operation[]=>token.pose.lawfullyAdmitted
  ?[{operation:'select-form',address:token.hexagramAddress},{operation:'set-pose',pose:token.pose.activeState}]
  :[{operation:'select-form',address:token.hexagramAddress}];
 const selectToken=(token:TokenPresentation,index:number)=>{
  setSelected(index);
  if(mode==='determinant'&&basis&&event)void gesture(cardOperations(token));
 };
 const attempt=(act:()=>void)=>{try{act();}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const recordAnnotation=(origin:'interpretation'|'authored assignment')=>{
  if(!annotation.trim())throw Error('Write the annotation first.');
  setAnnotations(list=>[...list,{id:list.length+1,tokenRef:selectedToken?.tokenRef??null,origin,text:annotation.trim()}]);
  setAnnotation('');
 };
 const authoredCount=annotations.filter(a=>a.origin==='authored assignment').length,interpretedCount=annotations.length-authoredCount;
 const sheet=clock?Math.floor(Number(clock.degree720)/360)+1:null;
 const cardTitle=(token:TokenPresentation)=>token.cardAlias?`${token.cardName} (${token.cardAlias})`:token.cardName;
 return <section aria-label="Tarot score"><h2>Tarot score</h2>
  <p>The cards this person's occasion deals, read from the live field. Choose a card to see its codons, pose and anchor; in Change determinant, choosing a card moves the form to it.</p>
  {!fieldScore&&<p>Open the live field in this window to read the score.</p>}
  {client&&<div className="nara-personal-actions"><button type="button" disabled={busy} onClick={()=>void read('resolve')}>Read the score again</button><button type="button" disabled={busy||!score} onClick={()=>void read('state')}>Check it is current</button></div>}
  {client&&busy&&<p role="status">Reading the score…</p>}
  {(error||decoded.error)&&<p role="alert">{error||decoded.error}</p>}
  {refusal&&<div className="nara-tarot-refusal" role="alert"><strong>The field did not give a score.</strong><p>{refusal}</p><p>Nothing in the field changed. Open the field on a dated sky, or select an identity, and read the score again.</p></div>}
  {score&&<>
   <div className="nara-tarot-layout">
    <div className="nara-tarot-tokens">
     <p className="nara-personal-caption">Score {score.schema} · basis {score.basis_revision.slice(0,16)}… · score revision {score.score_revision}</p>
     {clock&&<dl className="nara-tarot-clock">
      <dt>Clock the score was read at</dt><dd>{clock.steps} steps · {clock.degree360}° · sheet {sheet} · layer {String(clock.layer)} · {clock.completed_double_covers} completed double covers</dd>
      {clockMoved&&<dd className="nara-tarot-stale">The field clock has moved to {fieldIdentity?.clock_steps} steps since this reading. Read the score again to follow it.</dd>}
     </dl>}
     {standing&&<p className={standing.current?'nara-personal-muted':'nara-tarot-stale'} role="status">{standing.current?'This score is current for the field.':`This score was read for event ${standing.resolvedEventRef||'—'}; the field has moved to another event. Read the score again to follow it.`}</p>}
     <ol className="nara-tarot-cards">{tokens.map((token,index)=>
      <li key={token.tokenRef+index}>
       <button type="button" className="nara-tarot-card" aria-pressed={selected===index} onClick={()=>selectToken(token,index)}>
        <span className="nara-tarot-card-name">{token.cardName}</span>
        <span className="nara-tarot-card-role">{token.role}</span>
        <span className={`nara-tarot-origin nara-tarot-origin-${token.origin}`}>{token.originLabel}</span>
        {token.cardAlias&&<span className="nara-tarot-badge">also {token.cardAlias} of {token.suit}</span>}
        <span className="nara-tarot-badge nara-tarot-codons">{token.dualCourt?`codons ${token.codons.join(' + ')}`:`codon ${token.codons[0]}`}</span>
        <span className="nara-tarot-badge">{token.pose.lawfullyAdmitted?`lawfully admitted · state ${token.pose.activeState}/${token.pose.stateCount}`:`outside the lawful set · state ${token.pose.activeState}/${token.pose.stateCount}`}</span>
       </button>
      </li>)}</ol>
     <p className="nara-personal-muted">{tokens.length} card{tokens.length===1?'':'s'} in the score's order. A card that appears in two roles is shown twice.</p>
    </div>
    <aside className="nara-tarot-inspector" aria-label="Card inspector">
     {selectedToken?<><h3>{cardTitle(selectedToken)}</h3>
      <dl className="nara-tarot-facts">
       <dt>Role</dt><dd>{selectedToken.role}</dd>
       <dt>Origin</dt><dd><span className={`nara-tarot-origin nara-tarot-origin-${selectedToken.origin}`}>{selectedToken.originLabel}</span>{selectedToken.originRef?` · ${selectedToken.originRef}`:''}</dd>
       <dt>Card</dt><dd className="nara-tarot-ref">{selectedToken.cardRef}</dd>
       <dt>Codons</dt><dd>{selectedToken.codons.join(selectedToken.dualCourt?' + ':'')}{selectedToken.dualCourt?' (both court codons, kernel order)':''}</dd>
       <dt>Form address</dt><dd>{selectedToken.hexagramAddress}</dd>
       <dt>Four charge (pp, mm, mp, pm)</dt><dd>{selectedToken.fourChargeRaw.join(' · ')}</dd>
       <dt>Four charge, normalised</dt><dd>{selectedToken.fourChargeNormalised.map(v=>v.toFixed(4)).join(' · ')}</dd>
       <dt>Pose</dt><dd>state {selectedToken.pose.activeState} of {selectedToken.pose.stateCount} · {selectedToken.pose.lawfullyAdmitted?'lawfully admitted':'outside the lawful set'}{selectedToken.pose.collapsedNonDual?' · collapsed non-dual':''}</dd>
       <dt>Pose registers</dt><dd>torus tick {selectedToken.pose.torusTick12} · element ring {selectedToken.pose.elementRingPosition} · matrix {selectedToken.pose.matrixFamily||'—'} · rotation {selectedToken.pose.phaseRotationDegrees}°</dd>
       <dt>Inscription</dt><dd>{[selectedToken.inscription.decanName,selectedToken.inscription.decanRef,selectedToken.inscription.pipCardRef,selectedToken.inscription.reflectionRef].filter(Boolean).join(' · ')||'—'}</dd>
       <dt>Anchor</dt><dd>{selectedToken.anchorKind}{selectedToken.anchorBody?` · body ${selectedToken.anchorBody}`:''}{selectedToken.anchorLongitude!=null?` · ${selectedToken.anchorLongitude.toFixed(4)}°`:''}</dd>
      </dl>
      {mode==='determinant'&&<div className="nara-personal-actions">
       <button type="button" disabled={disabled||busy||!basis||!event} onClick={()=>void gesture(cardOperations(selectedToken))}>Move the form to this card</button>
       <button type="button" disabled={disabled||busy||!basis||!event||!presented} onClick={()=>onPresent(formRef.current)}>Show the form in the field</button>
      </div>}
      {mode==='determinant'&&<fieldset className="nara-tarot-traversal" disabled={disabled||busy||!basis||!event}>
       <legend>Move through the card's phases</legend>
       <div className="nara-personal-actions">
        <button type="button" disabled={!selectedToken.pose.lawfullyAdmitted||selectedToken.pose.activeState<=0} onClick={()=>void gesture([{operation:'set-pose',pose:selectedToken.pose.activeState-1}])}>Pose −1</button>
        <button type="button" disabled={!selectedToken.pose.lawfullyAdmitted||selectedToken.pose.activeState>=selectedToken.pose.stateCount-1} onClick={()=>void gesture([{operation:'set-pose',pose:selectedToken.pose.activeState+1}])}>Pose +1</button>
       </div>
       <label className="nara-personal-input"><span>Advance the clock by steps</span><input type="number" min="0" step="1" value={clockSteps} onChange={e=>setClockSteps(e.target.value)}/></label>
       <div className="nara-personal-actions">
        <button type="button" onClick={()=>attempt(()=>void gesture([{operation:'advance-clock',steps:integer(clockSteps,'clock step count')}]))}>Advance clock</button>
        <button type="button" onClick={()=>void gesture([{operation:'advance-clock',steps:720}])}>720° Return</button>
       </div>
       <label className="nara-personal-input"><span>Form address (0–63)</span><input inputMode="numeric" value={manualAddress} placeholder="0–63" onChange={e=>setManualAddress(e.target.value)}/></label>
       <button type="button" onClick={()=>attempt(()=>void gesture([{operation:'select-form',address:integer(manualAddress,'form address')}]))}>Select address</button>
      </fieldset>}
      {annotations.filter(a=>a.tokenRef===selectedToken.tokenRef).map(a=><p key={a.id} className="nara-tarot-note"><em>{a.origin}</em> · {a.text}</p>)}
     </>:<p className="nara-personal-muted">Choose a card to read it here, beside the moving form.</p>}
    </aside>
   </div>
   <div className="nara-tarot-modes" role="group" aria-label="Reading modes">
    {([['view','Change view'],['author','Author score'],['determinant','Change determinant']] as const).map(([value,label])=>
     <button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}</button>)}
   </div>
   {mode==='view'&&<p className="nara-personal-muted">Choosing cards here changes only what you see. The field does not move.</p>}
   {mode==='author'&&<div className="nara-tarot-author">
    <label className="nara-personal-input"><span>{selectedToken?`Note on ${selectedToken.cardName}`:'Note on the reading'}</span><textarea rows={3} value={annotation} onChange={e=>setAnnotation(e.target.value)}/></label>
    <div className="nara-personal-actions">
     <button type="button" onClick={()=>attempt(()=>recordAnnotation('interpretation'))}>Keep as interpretation</button>
     <button type="button" onClick={()=>attempt(()=>recordAnnotation('authored assignment'))}>Keep as authored assignment</button>
    </div>
    <p className="nara-personal-muted">{interpretedCount} interpretation{interpretedCount===1?'':'s'} and {authoredCount} authored assignment{authoredCount===1?'':'s'} for this session. Notes stay here; they are not written to the field.</p>
   </div>}
   {mode==='determinant'&&!basis&&<p className="nara-personal-muted">Save and select an identity, and open its form in Form and clock, to move the form from here.</p>}
   {receipt&&<p role="status">{receipt}</p>}
   {form&&<details className="nara-personal-depth"><summary>Form replies</summary><pre>{JSON.stringify(form,null,2)}</pre></details>}
  </>}
 </section>;
}
