import React,{useEffect,useRef,useState} from 'react';
import {nativeExpressionRequest,naraInstrumentRequest} from './kernelExpressions.js';
import type {NaraInstrumentHost} from './naraInstrument';
import type {InstrumentIdentity} from '../../../src/nara/instrumentProtocol';
import {validateRuntimeReadiness,type RuntimeReadiness} from '../../../src/nara/runtimeReadiness';
import type {ExpressionDocument,ExpressionRequest,ExpressionResult} from '../../../src/expression/types';
import {adoptCoordinateExpression,validateCoordinateExpression,type CoordinateExpressionResult,type CoordinateFace} from '../../../src/nara/coordinateExpression';

/** One native Atlas read, adopted only through the existing Expression owner. */
export function CoordinateAtlas({host,disabled,identity}:{host:NaraInstrumentHost;disabled:boolean;identity:InstrumentIdentity|null}){
 const [coordinate,setCoordinate]=useState(''),[face,setFace]=useState<CoordinateFace>('bimba');
 const [reading,setReading]=useState<CoordinateExpressionResult|null>(null),[basis,setBasis]=useState<ExpressionDocument|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [runtime,setRuntime]=useState<RuntimeReadiness|null>(null);
 const sequence=useRef(0),alive=useRef(true),operating=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 const run=async(request:ExpressionRequest)=>await nativeExpressionRequest(request as unknown as Record<string,unknown>) as ExpressionResult;
 const change=()=>{sequence.current++;setReading(null);setBasis(null);setNotice('');setError('');setRuntime(null);};
 const inspect=async()=>{
  if(operating.current)return;operating.current=true;setBusy(true);setError('');setNotice('');setReading(null);setBasis(null);
  const at=++sequence.current;
  try{
   const current=host.nativeView()?.document;
   if(!current)throw Error('Open a native Expression before reading its coordinate profile.');
   const document=(await run({operation:'inspect',expression_ref:current.expression_ref})).document;
   if(!document)throw Error('The native Expression could not be read.');
   const result=validateCoordinateExpression(await naraInstrumentRequest({operation:'coordinate',request:{coordinate_ref:coordinate.trim(),face}}));
   if(!alive.current||sequence.current!==at)return;
   setReading(result);setBasis(document);
  }catch(cause){if(alive.current&&sequence.current===at)setError(cause instanceof Error?cause.message:String(cause));}
  finally{operating.current=false;if(alive.current)setBusy(false);}
 };
 const adopt=async()=>{
  if(operating.current||!reading||!basis)return;
  operating.current=true;setBusy(true);setError('');setNotice('');setRuntime(null);const at=sequence.current;
  try{
   const current=host.nativeView()?.document;
   if(current?.expression_ref!==basis.expression_ref)throw Error('The current Expression changed. Read the coordinate again.');
   const selected=basis.selection.entity_ref;
   if(!selected)throw Error('Select a centre in the Expression, then read this coordinate again.');
   const document=await adoptCoordinateExpression(run,reading,basis,selected);
   await host.acceptNativeDocument(document);
   if(!alive.current||sequence.current!==at)return;
   setBasis(document);setNotice(`Adopted ${reading.binding.coordinate_ref} as the Expression profile. Centre identities are unchanged.`);
  }catch(cause){if(alive.current&&sequence.current===at)setError(cause instanceof Error?cause.message:String(cause));}
  finally{operating.current=false;if(alive.current)setBusy(false);}
 };
 const disclose=async()=>{
  if(operating.current||!identity)return;operating.current=true;setBusy(true);setError('');setRuntime(null);const at=++sequence.current;
  try{
   const selected=host.nativeView()?.document;if(!selected)throw Error('Open the native Expression first.');
   const current=(await run({operation:'inspect',expression_ref:selected.expression_ref})).document;if(!current)throw Error('The native Expression could not be read.');
   if(!(current.profiles??[]).some(p=>p.profile_ref.startsWith('profile:epi-coordinate-')))throw Error('Choose this Expression’s coordinate above and use its native profile before reading runtime readiness.');
   const result=validateRuntimeReadiness(await naraInstrumentRequest({operation:'readiness',basis:{expression_ref:current.expression_ref,source:identity.source},role:'nara'}));
   if(!alive.current||sequence.current!==at)return;setRuntime(result);
  }catch(cause){if(alive.current&&sequence.current===at)setError(cause instanceof Error?cause.message:String(cause));}
  finally{operating.current=false;if(alive.current)setBusy(false);}
 };
 useEffect(()=>{sequence.current++;setRuntime(null);},[identity?.source.source_ref,identity?.source.revision]);
 const b=reading?.binding,selected=basis?.selection.entity_ref,subject=reading?.subject_binding;
 return <section className="nara-coordinate-atlas" aria-label="Coordinate Atlas">
  <h2>Coordinate Atlas</h2><p>Read a native coordinate and its inherited profile. Adoption sets the profile for this Expression and keeps its centre identities.</p>
  <form onSubmit={event=>{event.preventDefault();void inspect();}}><fieldset disabled={disabled||busy}>
   <label className="nara-personal-input"><span>Coordinate reference</span><input aria-label="Coordinate reference" value={coordinate} onChange={event=>{change();setCoordinate(event.target.value);}} autoComplete="off"/></label>
   <label className="nara-personal-input"><span>Face</span><select aria-label="Coordinate face" value={face} onChange={event=>{change();setFace(event.target.value as CoordinateFace);}}><option value="bimba">Bimba</option><option value="pratibimba">Pratibimba</option></select></label>
   <button type="submit" disabled={!coordinate.trim()}>Read coordinate</button>
  </fieldset></form>
  {busy&&<p role="status">Reading or applying the native coordinate…</p>}{error&&<p className="nara-personal-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <section aria-label="Native runtime readiness"><h3>What can participate here</h3>
   <p>{identity?'Read the current native source, profile, session, speech and action standing. This does not start a provider.':'Select a saved identity in Identity before reading this personal encounter.'}</p>
   <button type="button" disabled={disabled||busy||!identity} onClick={()=>void disclose()}>Read runtime readiness</button>
   {runtime&&runtime.expression_revision!==String(host.nativeView()?.document?.revision)&&<p>The Expression changed. Read runtime readiness again.</p>}
   {runtime&&runtime.expression_revision===String(host.nativeView()?.document?.revision)&&<><p>{runtime.standing}</p>{runtime.faculties.map(faculty=><article key={faculty.id}><h4>{faculty.label}</h4><ul>{faculty.readings.map(row=><li key={row.aspect}><strong>{row.aspect}</strong> · {row.status}{row.reason&&<p>{row.reason}</p>}</li>)}</ul></article>)}<details><summary>Native readiness Inspect</summary><pre>{JSON.stringify(runtime,null,2)}</pre></details></>}
  </section>
  {b&&reading&&<>
   <h3>{b.labels.join(' · ')||b.coordinate_ref}</h3><p>{b.family} · {b.face==='bimba'?'Bimba':'Pratibimba'}</p>
   <ol aria-label="Inherited coordinate profiles">{b.inherited_profiles.map(layer=><li key={layer.profile_ref}>{{global:'Shared profile',family:'Family profile',branch:'Branch profile',coordinate:'Coordinate profile'}[layer.scope]??layer.scope}</li>)}</ol>
   <p>{selected&&basis?.entities[selected]?`Selected centre: ${basis.entities[selected].title}`:'No centre was selected when this reading was opened.'}</p>
   <button type="button" disabled={disabled||busy||!selected} onClick={()=>void adopt()}>Use profile for this Expression</button>
   <details className="nara-personal-depth"><summary>Source Inspect</summary><p>{b.coordinate_ref} · {b.branch_path.join(' → ')}</p><p>{b.property_value_standing}</p><p>{b.capability_standing}</p><ul>{b.inherited_profiles.map(layer=><li key={layer.profile_ref}>{layer.scope} · {layer.basis_ref}<br/><code>{layer.profile_ref}</code><br/><small>Revision {layer.profile_revision} · {layer.content_revision}</small></li>)}</ul><p>Source: {b.rooted_world.selected_source_ref}</p><p>Bimba: {b.rooted_world.direct.canonical_ref}</p><p>Pratibimba: {b.rooted_world.conjugate.canonical_ref}</p><p>Registry: {b.rooted_world.registry_revision}</p><ul>{b.grammar_sources.map(source=><li key={source.source_ref}>{source.source_ref}<br/><code>{source.content_revision}</code></li>)}</ul>{b.property_sources.map(source=><article key={source.registry_record_index}><strong>{source.file.path}</strong><p>{source.record.property_keys.join(', ')}</p><small>{source.source_repository} · {source.source_revision} · {source.record.payload_sha256}</small></article>)}</details>
   <details className="nara-personal-depth"><summary>Native relations and actions</summary><ul>{b.source_relations.map(relation=><li key={relation.relation_ref}>{relation.class}: {relation.from_ref??'Unspecified source'} → {relation.to_ref??'Unspecified target'}<br/><small>{relation.relation_ref} · {relation.orientation}</small></li>)}</ul><p>Native owner: {b.rooted_world.native_owner.standing}</p>{b.rooted_world.native_owner.bindings.map(binding=><p key={`${binding.identity}:${binding.module}`}>{binding.identity} · {binding.module} · {binding.disposition} · {binding.readiness}<br/><small>{binding.evidence}</small></p>)}{subject?.actions.length?<ul>{subject.actions.map(action=><li key={action.action_ref}>{action.action_ref} → {action.target_ref}<br/><small>{action.authority_requirement}</small></li>)}</ul>:<p>No executable actions are admitted by this subject binding.</p>}</details>
   <details className="nara-personal-depth"><summary>Capabilities and encounter standing</summary><p>{b.encounter_overlay_standing}</p>{b.ta_onta_faculties.map(faculty=><p key={faculty.id}>{faculty.label} · {faculty.standing}<br/><small>{faculty.native_owners.join(', ')}</small></p>)}<pre>{JSON.stringify(b.declared_capabilities,null,2)}</pre></details>
  </>}
 </section>;
}
