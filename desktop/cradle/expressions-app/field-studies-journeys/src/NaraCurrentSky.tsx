import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
import React,{useEffect,useRef,useState} from 'react';
import {naraInstrumentRequest} from './kernelExpressions';
import type {InstrumentBasis,InstrumentIdentity} from '../../../src/nara/instrumentProtocol';
import type {PersonalCurrentReading,SkyRequest} from '../../../src/nara/identity/types';

/** Dated sky is a separate native calculation. Birth data never changes when
 * the person explores another occasion. All quaternion arithmetic stays in QL. */
export function NaraCurrentSky({identity,basis,reading,onReading,onNativeReading,disabled}:{
 identity:InstrumentIdentity|null;reading:PersonalCurrentReading|null;
 basis:InstrumentBasis|null;onNativeReading:(value:NativeCurrentReading|null)=>void;
 onReading:(reading:PersonalCurrentReading|null)=>void;disabled:boolean;
}){
 const [epoch,setEpoch]=useState(()=>new Date().toISOString().slice(0,19));
 const [backend,setBackend]=useState<SkyRequest['backend_policy']>('allow-moshier');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),pending=useRef(false);
 const sourceKey=JSON.stringify(basis);
 useEffect(()=>{generation.current++;setError('');setBusy(false);return()=>{generation.current++;};},[sourceKey]);
 useEffect(()=>{
  if(!basis||!identity){onReading(null);onNativeReading(null);return;}
  const at=generation.current;
  void naraInstrumentRequest({operation:'current_read',basis,role:'nara'}).then(result=>{
   if(at!==generation.current)return;
   if(result.schema!=='oi.nara-personal-current-context/v1'||result.expression_ref!==basis.expression_ref||result.nara_ref!==identity.reading.nara_ref)throw Error('The native occasion belongs to another encounter.');
   onReading(result.reading);onNativeReading(result);
  }).catch(failure=>{if(at===generation.current){onReading(null);onNativeReading(null);setError(failure instanceof Error?failure.message:String(failure));}});
 },[sourceKey]);
 const calculate=async(current:boolean)=>{
  if(pending.current||disabled||!identity||!basis)return;
  pending.current=true;setBusy(true);setError('');const at=++generation.current;
  try{
   const entered=current?new Date().toISOString().slice(0,19):epoch;
   // datetime-local omits the seconds component when it is exactly zero.
   const instant=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(entered)?entered+':00':entered;
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(instant))throw Error('Enter the date and time in UTC, including seconds.');
   const request:SkyRequest={schema:'ql.sky-request/v1',epoch:instant+'Z',timezone:'UTC',mode:current?'current':'historical',perspective:'Apparent Geocentric',zodiac:'Tropical',ayanamsha:null,observer:null,max_age_seconds:300,backend_policy:backend};
   const result=await naraInstrumentRequest({operation:'current_pin',basis,role:'nara',sky_request:request});
   if(at!==generation.current)return;
   if(result.schema!=='oi.nara-personal-current-context/v1'||result.expression_ref!==basis.expression_ref||result.nara_ref!==identity.reading.nara_ref||!result.reading||result.reading.identity.input_revision!==identity.reading.input_revision)throw Error('The native field returned a different saved identity basis.');
   setEpoch(instant);onReading(result.reading);onNativeReading(result);
  }catch(failure){if(at===generation.current)setError(failure instanceof Error?failure.message:String(failure));}
  finally{pending.current=false;if(at===generation.current)setBusy(false);}
 };
  const q=(value:PersonalCurrentReading['q_identity'])=>value?(['w','x','y','z'] as const).map(key=>value[key].toFixed(6)).join(' · '):'Unavailable';
 return <section aria-label="Current sky and identity"><h3>The sky at this occasion</h3><p>Compare a dated sky with the saved identity. The natal chart keeps its original birth circumstances.</p>
  <fieldset disabled={disabled||busy||!identity||!basis}>
   <label className="nara-personal-input"><span>Date and time · UTC</span><input aria-label="Sky date and time UTC" type="datetime-local" step="1" value={epoch} onChange={event=>{setEpoch(event.target.value);}}/></label>
   <label className="nara-personal-input"><span>Ephemeris policy</span><select value={backend} onChange={event=>{setBackend(event.target.value as SkyRequest['backend_policy']);}}><option value="allow-moshier">Allow the analytic fallback if Swiss files are unavailable</option><option value="require-swiss-files">Require Swiss ephemeris files</option></select></label>
   <div className="nara-personal-actions"><button type="button" onClick={()=>void calculate(false)}>Read this dated sky</button><button type="button" onClick={()=>void calculate(true)}>Read the current sky</button></div>
  </fieldset>
  {busy&&<p role="status">Calculating the actual sky and personal baseline…</p>}{error&&<p role="alert">{error}</p>}
  {reading&&<><p>{reading.transit.sky ? `Sky at ${reading.transit.sky.request.epoch}.` : 'The dated sky is unavailable.'} {reading.baseline_available?'The selected identity and transit baseline is available.':'Select the core identity inputs and policy to calculate their combined baseline.'}</p>
   <div className="nara-table-scroll"><table><thead><tr><th>Planet</th><th>Longitude</th><th>Motion</th></tr></thead><tbody>{reading.transit.sky?.bodies.map(body=><tr key={body.body}><th scope="row">{body.body}</th><td>{body.longitude_degrees.toFixed(4)}°</td><td>{body.retrograde?'Retrograde':'Direct'}</td></tr>)}</tbody></table></div>
   <details className="nara-personal-depth"><summary>Identity, transit and activity remain distinct</summary><dl><dt>Identity · EFWA</dt><dd>{q(reading.q_identity)}</dd><dt>Transit · EFWA</dt><dd>{q(reading.transit.q_transit)}</dd><dt>Identity × transit baseline</dt><dd>{q(reading.q_identity_transit)}</dd>{reading.resonance&&<><dt>Identity and transit alignment</dt><dd>{(reading.resonance.score*100).toFixed(1)}%</dd></>}<dt>Activity</dt><dd>{reading.activity_status} · {q(reading.q_activity)}</dd><dt>Identity × transit × activity</dt><dd>{q(reading.q_composed)}</dd></dl><p>{reading.standing}</p><pre>{JSON.stringify({source:reading.transit.source,provider:reading.transit.sky?.provider,event:reading.transit.sky?.snapshot_ref,activity:reading.activity},null,2)}</pre></details>
  </>}
 </section>;
}
