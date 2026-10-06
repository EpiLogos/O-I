import React,{useEffect,useMemo,useRef,useState} from 'react';
import type {InstrumentBasis} from '../../../src/nara/instrumentProtocol';
import type {M3Gesture,M3Operation,NativeM3Reading} from '../../../src/nara/nativeM3';
import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
import {naraInstrumentRequest} from './kernelExpressions.js';
import {createTarotScoreClient,decodeToken,refusalReason,type FieldScoreBasis,type FieldScoreReply,
 type TarotScoreReading,type TokenPresentation} from './tarotScoreClient.js';

/** The selected subject's deterministic Tarot score as a first-class reading.
 * The score itself is resolved once through the live field's own exchange
 * transport and held with its basis revision; the card bodies move through the
 * existing native M3 gesture path — the same operations the resident form
 * already responds to. No local symbolic arithmetic: every card, codon, pose
 * and clock fact shown is read from a native reply, and a refusal from the
 * score owner is a named first-class state, never a generic error. */
export function TarotScore({basis,selectionKey,current,disabled,onPresent,presented,fieldBasis,fieldScore}:{
 basis:InstrumentBasis|null;selectionKey:string;current:NativeCurrentReading|null;disabled:boolean;
 onPresent:(reading:NativeM3Reading|null)=>void;presented:boolean;
 fieldBasis?:()=>FieldScoreBasis|null;fieldScore?:(command:unknown)=>Promise<FieldScoreReply>;
}){
 const [score,setScore]=useState<TarotScoreReading|null>(null),[scoreState,setScoreState]=useState<{current:boolean;resolvedEventRef:string;at:number}|null>(null);
 const [refusal,setRefusal]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [fieldIdentity,setFieldIdentity]=useState<FieldScoreBasis|null>(null);
 const [selected,setSelected]=useState<number|null>(null),[mode,setMode]=useState<'view'|'author'|'determinant'>('view');
 const [form,setForm]=useState<NativeM3Reading|null>(null),[receipt,setReceipt]=useState<string|null>(null);
 const [annotation,setAnnotation]=useState(''),[annotations,setAnnotations]=useState<{id:number;at:number;tokenRef:string|null;origin:'interpretation'|'authored assignment';text:string}[]>([]);
 const [clockSteps,setClockSteps]=useState('1'),[manualAddress,setManualAddress]=useState('');
 const epoch=useRef(0),pending=useRef(false),live=useRef(true),formRef=useRef<NativeM3Reading|null>(null),resolveSeq=useRef(0);
 const event=current?.context?.event_ref??null,key=JSON.stringify([selectionKey,event]);
 const client=useMemo(()=>fieldBasis&&fieldScore?createTarotScoreClient({fieldBasis,fieldScore}):null,[fieldBasis,fieldScore]);
 useEffect(()=>{live.current=true;epoch.current++;setScore(null);setScoreState(null);setRefusal(null);setError('');setBusy(false);
  setSelected(null);setForm(null);formRef.current=null;setReceipt(null);setAnnotations([]);setAnnotation('');setManualAddress('');
  return()=>{live.current=false;epoch.current++;};},[key]);
 /** The score rides the exchange transport: resolved once per selection/
  * encounter, held with its basis revision. A refusal is shown by name. */
 useEffect(()=>{
  if(!client)return;
  const at=++resolveSeq.current;
  setBusy(true);setError('');
  (async()=>{
   try{
    const basis=fieldBasis?.()??null;
    if(!live.current||at!==resolveSeq.current)return;
    setFieldIdentity(basis);
    const reply=await client.resolve();
    if(!live.current||at!==resolveSeq.current)return;
    if(reply.refused){setRefusal(refusalReason(reply));setScore(null);setScoreState(null);}
    else{setRefusal(null);setScore(reply.score);setScoreState({current:reply.current,resolvedEventRef:reply.resolved_event_ref,at:Date.now()});}
   }catch(e){if(live.current&&at===resolveSeq.current)setError(e instanceof Error?e.message:String(e));}
   finally{if(live.current&&at===resolveSeq.current)setBusy(false);}
  })();
 },[client,key]);
 const integer=(value:string,label:string)=>{
  if(!/^\d+$/.test(value))throw Error(`Enter ${label}.`);
  const n=Number(value);if(!Number.isSafeInteger(n))throw Error(`Enter a valid ${label}.`);return n;
 };
 /** The existing native M3 gesture path: read the form, then apply through the
  * one transactional owner. This is the same path the Form and clock view uses. */
 const gesture=async(operations:M3Operation[]=[],apply=false)=>{
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
   let form=formRef.current;
   if(!form||form.status!=='available'||!form.state){
    form=await send({operation:'read'});
    if(!live.current||at!==epoch.current)return null;
    if(form?.status!=='available'||!form?.state)throw Error('No native form is open for this encounter. Open one in Form and clock first.');
   }
   const result=apply?await send({operation:'apply',expected_generation:form.state.identity.profile_generation,operations}):await send({operation:'read'});
   if(!live.current||at!==epoch.current)return null;
   if(result?.status==='available'&&result.state)setReceipt(`${result.receipts?.at(-1)?.status??'applied'} · generation ${result.state.identity.profile_generation}`);
   if(presented&&result)onPresent(result.status==='available'?result:null);
   return result;
  }catch(e){if(live.current&&at===epoch.current)setError(e instanceof Error?e.message:String(e));return null;}
  finally{pending.current=false;if(live.current&&at===epoch.current)setBusy(false);}
 };
 const tokens=useMemo(()=>{try{return score?score.tokens.map(decodeToken):[];}catch(e){setError(e instanceof Error?e.message:String(e));return[];}},[score]);
 const selectedToken=selected!=null?tokens[selected]??null:null;
 const clockBasis=score?.clock;
 const clockMoved=!!(clockBasis&&fieldIdentity&&Number.isSafeInteger(clockBasis.steps)&&clockBasis.steps!==fieldIdentity.clock_steps);
 const selectToken=(presentation:TokenPresentation,index:number)=>{
  setSelected(index);
  if(mode!=='determinant'||!basis||!event)return;
  const operations=presentation.pose.lawfullyAdmitted
   ?[{operation:'select-form' as const,address:presentation.hexagramAddress},{operation:'set-pose' as const,pose:presentation.pose.activeState}]
   :[{operation:'select-form' as const,address:presentation.hexagramAddress}];
  void gesture(operations,true);
 };
 const recordAnnotation=(origin:'interpretation'|'authored assignment')=>{
  if(!annotation.trim())throw Error('Write the annotation first.');
  setAnnotations(list=>[...list,{id:list.length+1,at:Date.now(),tokenRef:selectedToken?.tokenRef??null,origin,text:annotation.trim()}]);
  setAnnotation('');
 };
 const authoredCount=annotations.filter(a=>a.origin==='authored assignment').length,interpretedCount=annotations.length-authoredCount;
 const sheet=clockBasis?Math.floor(Number(clockBasis.degree720)/360)+1:null;
 return <section aria-label="Tarot score"><h2>Tarot score</h2>
  <p>The selected subject's deterministic score, resolved once by the live field's own owner and held with its basis revision. Cards, codons, poses and the clock are read, never re-derived here; a token can move the resident form through the native operations the body already answers.</p>
  {!fieldScore&&<p>The live field is not wired in this shell: the score needs the native instrument's exchange transport.</p>}
  {client&&busy&&<p role="status">Reading the native score…</p>}
  {error&&<p role="alert">{error}</p>}
  {refusal&&<div className="nara-tarot-refusal" role="alert"><strong>The score owner refused this reading, by name.</strong><p>{refusal}</p><p>The field stands where it was; nothing was re-derived or retried. When the scene carries an admitted sky or an identity reading, the resolve admits; until then this refusal is the honest reading.</p></div>}
  {score&&<>
   <div className="nara-tarot-layout">
    <div className="nara-tarot-tokens">
     <p className="nara-personal-caption">Score {score.schema} · basis {score.basis_revision.slice(0,16)}… · score revision {score.score_revision}</p>
     {clockBasis&&<dl className="nara-tarot-clock">
      <dt>Score clock (the field's own basis)</dt><dd>{clockBasis.steps} steps · {clockBasis.degree360}° · sheet {sheet} · layer {String(clockBasis.layer)} · {clockBasis.completed_double_covers} completed double covers</dd>
      {clockMoved&&<dd className="nara-tarot-stale">The field clock has moved to {fieldIdentity?.clock_steps} steps since this resolve. The held reading keeps its basis; re-resolve explicitly to read the moved clock.</dd>}
     </dl>}
     {scoreState&&<p className={scoreState.current?'nara-personal-muted':'nara-tarot-stale'} role="status">{scoreState.current?'The held score answers as current for this field event.':`The held score is not current: it was resolved against event ${scoreState.resolvedEventRef||'—'}, and the field now answers another event. A stale basis is disclosed, never silently re-resolved.`}</p>}
     <ol className="nara-tarot-cards">{tokens.map((token,index)=>
      <li key={token.tokenRef+index}>
       <button type="button" className="nara-tarot-card" aria-pressed={selected===index} onClick={()=>selectToken(token,index)}>
        <span className="nara-tarot-card-name">{token.cardName}</span>
        <span className="nara-tarot-card-role">{token.role}</span>
        <span className={`nara-tarot-origin nara-tarot-origin-${token.origin}`}>{token.originLabel}</span>
        {token.dualCourt&&<span className="nara-tarot-badge">dual court · both codons</span>}
        <span className="nara-tarot-badge">{token.pose.lawfullyAdmitted?`lawfully admitted · state ${token.pose.activeState}/${token.pose.stateCount}`:`outside the lawful set · state ${token.pose.activeState}/${token.pose.stateCount}`}</span>
       </button>
      </li>)}</ol>
     <p className="nara-personal-muted">{tokens.length} token{tokens.length===1?'':'s'} in canonical order; a repeated card in another role stays its own token.{mode==='view'?' Choose the determinant mode to let a selection move the resident form.':''}</p>
    </div>
    <aside className="nara-tarot-inspector" aria-label="Card inspector">
     {selectedToken?<><h3>{selectedToken.cardName}</h3>
      <dl className="nara-tarot-facts">
       <dt>Role</dt><dd>{selectedToken.role}</dd>
       <dt>Origin</dt><dd><span className={`nara-tarot-origin nara-tarot-origin-${selectedToken.origin}`}>{selectedToken.originLabel}</span>{selectedToken.originRef?` · ${selectedToken.originRef}`:''}</dd>
       <dt>Card kernel</dt><dd className="nara-tarot-ref">{selectedToken.cardRef}</dd>
       <dt>Codons</dt><dd>{selectedToken.codons.join(selectedToken.dualCourt?' + ':'')} {selectedToken.dualCourt?'(both court codons, kernel order)':''}</dd>
       <dt>Hexagram address</dt><dd>{selectedToken.hexagramAddress}</dd>
       <dt>Four charge (raw pp, mm, mp, pm)</dt><dd>{selectedToken.fourChargeRaw.join(' · ')}</dd>
       <dt>Four charge (normalised)</dt><dd>{selectedToken.fourChargeNormalised.map(v=>v.toFixed(4)).join(' · ')}</dd>
       <dt>Pose</dt><dd>active state {selectedToken.pose.activeState} of {selectedToken.pose.stateCount} lawful · {selectedToken.pose.lawfullyAdmitted?'lawfully admitted':'outside the lawful surface'}{selectedToken.pose.collapsedNonDual?' · collapsed non-dual':''}</dd>
       <dt>Pose registers</dt><dd>torus tick {selectedToken.pose.torusTick12} · element ring {selectedToken.pose.elementRingPosition} · matrix {selectedToken.pose.matrixFamily||'—'} · phase {selectedToken.pose.phaseClockSteps} steps ({selectedToken.pose.phaseArgumentDegrees}° argument)</dd>
       <dt>Inscription</dt><dd>{[selectedToken.inscription.decanName,selectedToken.inscription.decanRef,selectedToken.inscription.pipCardRef,selectedToken.inscription.reflectionRef].filter(Boolean).join(' · ')||'—'}</dd>
       <dt>Anchor</dt><dd>{selectedToken.anchorKind}{selectedToken.anchorBody?` · body ${selectedToken.anchorBody}`:''}{selectedToken.anchorLongitude!=null?` · ${selectedToken.anchorLongitude.toFixed(4)}°`:''}</dd>
      </dl>
      {mode==='determinant'&&<div className="nara-personal-actions">
       <button type="button" disabled={disabled||busy||!basis||!event} onClick={()=>{const operations=selectedToken.pose.lawfullyAdmitted?[{operation:'select-form' as const,address:selectedToken.hexagramAddress},{operation:'set-pose' as const,pose:selectedToken.pose.activeState}]:[{operation:'select-form' as const,address:selectedToken.hexagramAddress}];void gesture(operations,true);}}>Select this card's form</button>
       <button type="button" disabled={disabled||busy||!basis||!event||!presented} onClick={()=>onPresent(formRef.current)}>Present native hinge</button>
       <p className="nara-personal-muted">Selection moves the resident form through the native M3 operations; presenting the native hinge lets the card's body answer on the selected formation.</p>
      </div>}
      {mode==='determinant'&&<fieldset className="nara-tarot-traversal" disabled={disabled||busy||!basis||!event}>
       <legend>Phase traversal</legend>
       <div className="nara-personal-actions">
        <button type="button" disabled={!selectedToken.pose.lawfullyAdmitted||selectedToken.pose.activeState<=0} onClick={()=>void gesture([{operation:'set-pose',pose:selectedToken.pose.activeState-1}],true)}>Pose −1</button>
        <button type="button" disabled={!selectedToken.pose.lawfullyAdmitted||selectedToken.pose.activeState>=selectedToken.pose.stateCount-1} onClick={()=>void gesture([{operation:'set-pose',pose:selectedToken.pose.activeState+1}],true)}>Pose +1</button>
       </div>
       <label className="nara-personal-input"><span>Advance the clock by steps</span><input type="number" min="0" step="1" value={clockSteps} onChange={e=>setClockSteps(e.target.value)}/></label>
       <div className="nara-personal-actions">
        <button type="button" onClick={()=>{try{void gesture([{operation:'advance-clock',steps:integer(clockSteps,'clock step count')}],true);}catch(e){setError(e instanceof Error?e.message:String(e));}}}>Advance clock</button>
        <button type="button" onClick={()=>void gesture([{operation:'advance-clock',steps:720}],true)}>720° Return</button>
       </div>
       <label className="nara-personal-input"><span>Manual form address · the explicit exploration route</span><input inputMode="numeric" value={manualAddress} placeholder="0–63" onChange={e=>setManualAddress(e.target.value)}/></label>
       <button type="button" onClick={()=>{try{void gesture([{operation:'select-form',address:integer(manualAddress,'form address')}],true);}catch(e){setError(e instanceof Error?e.message:String(e));}}}>Select address</button>
      </fieldset>}
      {annotations.filter(a=>a.tokenRef===selectedToken.tokenRef).map(a=><p key={a.id} className="nara-tarot-note"><em>{a.origin}</em> · {a.text}</p>)}
     </>:<p className="nara-personal-muted">Choose a token to read its card. The inspector stands beside the moving form, never over it.</p>}
    </aside>
   </div>
   <div className="nara-tarot-modes" role="group" aria-label="Reading modes">
    {([['view','Change view'],['author','Author score'],['determinant','Change determinant']] as const).map(([value,label])=>
     <button key={value} type="button" aria-pressed={mode===value} onClick={()=>setMode(value)}>{label}</button>)}
   </div>
   {mode==='view'&&<p className="nara-personal-muted">Change view: everything here is local component state. Nothing moves the field.</p>}
   {mode==='author'&&<div className="nara-tarot-author">
    <label className="nara-personal-input"><span>{selectedToken?`Annotation for ${selectedToken.cardName}`:'Annotation for the reading'}</span><textarea rows={3} value={annotation} onChange={e=>setAnnotation(e.target.value)}/></label>
    <div className="nara-personal-actions">
     <button type="button" onClick={()=>{try{recordAnnotation('interpretation');}catch(e){setError(e instanceof Error?e.message:String(e));}}}>Record as interpretation</button>
     <button type="button" onClick={()=>{try{recordAnnotation('authored assignment');}catch(e){setError(e instanceof Error?e.message:String(e));}}}>Record as authored assignment</button>
    </div>
    <p className="nara-personal-muted">Authoring is deliberate and session-only: {interpretedCount} interpretation{interpretedCount===1?'':'s'} and {authoredCount} authored assignment{authoredCount===1?'':'s'} held in this component, provenance-labelled, never written to the field or saved silently.</p>
   </div>}
   {mode==='determinant'&&!basis&&<p className="nara-personal-muted">The determinant path moves the resident form through the saved identity's native form. Save and select an identity, and read its form, to drive it from here.</p>}
   {receipt&&<p role="status">{receipt}</p>}
   {form&&<details className="nara-personal-depth"><summary>Native form receipts and the exact replies</summary><pre>{JSON.stringify(form,null,2)}</pre></details>}
  </>}
 </section>;
}
