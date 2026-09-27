/** Personal depth inside the existing Expression application. The native
 * document and engine remain with the host; no private readings enter a
 * Journey, localStorage, export, or a second presentation runtime. */
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {kernelExpressionsAvailable,naraInstrumentRequest} from './kernelExpressions.js';
import type {KernelConversion} from './kernelDocumentBridge.js';
import type {IdentityReading,IdentitySource,NaraIdentityResult,SavedIdentity,ReportKey} from '../../../src/nara/identity/types';
import {REPORTS,OFFICE_NAMES,newDraft,draftFromProfile,profileFromDraft,changeReportRoute} from '../../../src/nara/identity/profileDraft';
import type {IdentityDraft} from '../../../src/nara/identity/profileDraft';
import {ReportFields} from '../../../src/nara/identity/ReportFields';
import type {NaraInstrumentRequest,NaraInstrumentState,InstrumentIdentity} from '../../../src/nara/instrumentProtocol';
import {nativeTextRuns} from '../../../src/nara/nativeTranscript';
import {IdentityMatrix} from './IdentityMatrix';
import {NaraVoiceTools,NaraAnswerReturnTools} from './naraConversationTools';
import './naraInstrument.css';

export interface NaraInstrumentHost {
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
}
type View='identity'|'matrix'|'composition'|'conversation';
const failureText=(text:string)=>{try{const value=JSON.parse(text);return typeof value==='string'?value:value?.Failed?.reason??text;}catch{return text;}};
function questionText(text:string){try{const value=JSON.parse(text);return value.schema==='oi.nara-dialogue-input/v1'?value.question:text;}catch{return /"(?:profile_ref|natal_composition|subject_ref|agent_session_ref)"\s*:/.test(text)?'Choose Earlier messages to read the complete recorded question.':text;}}
function Chart({reading}:{reading:IdentityReading|null}){
 const svg=reading?.natal?.chart?.svg;
 const [url,setUrl]=useState('');
 useEffect(()=>{if(!svg){setUrl('');return;}const next=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));setUrl(next);return()=>URL.revokeObjectURL(next);},[svg]);
 if(!url)return <div className="nara-chart-empty"><h2>Your sky, at birth.</h2><p>{reading?.natal?.reason??'Enter your birth details to calculate the actual natal chart. An unknown time stays unknown.'}</p></div>;
 return <figure className="nara-chart"><img src={url} alt={`Calculated natal chart for ${reading?.profile.name}`}/><figcaption>{reading?.natal?.chart?.conditional?'Conditional on the approximate birth time':'Calculated from the entered birth circumstances'}<span>{reading?.natal?.chart?.zodiac} · {reading?.natal?.chart?.houses_system_name}</span></figcaption></figure>;
}
function Input({label,children}:{label:string;children:React.ReactNode}){return <label className="nara-personal-input"><span>{label}</span>{children}</label>;}
function BirthEditor({draft,change}:{draft:IdentityDraft;change:(next:IdentityDraft)=>void}){
 const set=(key:keyof IdentityDraft,value:unknown)=>change({...draft,[key]:value});
 const place=(key:keyof IdentityDraft['place'],value:string)=>change({...draft,place:{...draft.place,[key]:value}});
 return <div className="nara-birth-editor">
  <Input label="Your name"><input value={draft.name} autoComplete="name" onChange={e=>set('name',e.target.value)}/></Input>
  <div className="nara-input-pair"><Input label="Birth date"><input type="date" value={draft.date} onChange={e=>set('date',e.target.value)}/></Input><Input label="Time precision"><select value={draft.precision} onChange={e=>set('precision',e.target.value)}><option value="unknown">Time unknown</option><option value="exact">Exact time</option><option value="approximate">Approximate time</option></select></Input></div>
  {draft.precision!=='unknown'&&<div className="nara-input-pair"><Input label="Local birth time"><input type="time" step="1" value={draft.time} onChange={e=>set('time',e.target.value)}/></Input>{draft.precision==='approximate'&&<Input label="Uncertainty, ± minutes"><input type="number" min="1" value={draft.uncertainty} onChange={e=>set('uncertainty',e.target.value)}/></Input>}</div>}
  <Input label="Birthplace"><input value={draft.place.label} autoComplete="off" onChange={e=>place('label',e.target.value)}/></Input>
  <div className="nara-input-pair"><Input label="Latitude"><input inputMode="decimal" value={draft.place.latitude} onChange={e=>place('latitude',e.target.value)}/></Input><Input label="Longitude"><input inputMode="decimal" value={draft.place.longitude} onChange={e=>place('longitude',e.target.value)}/></Input></div>
  <Input label="Birthplace timezone"><input value={draft.place.timezone} placeholder="Europe/London" onChange={e=>place('timezone',e.target.value)}/></Input>
  <details className="nara-personal-depth"><summary>Birth source and clock ambiguity</summary><Input label="Coordinate source"><input value={draft.place.source} onChange={e=>place('source',e.target.value)}/></Input>{draft.precision!=='unknown'&&<Input label="If the clock repeated this time"><select value={draft.fold} onChange={e=>set('fold',e.target.value)}><option value="">Resolve from the date and timezone</option><option value="0">First occurrence</option><option value="1">Second occurrence</option></select></Input>}</details>
 </div>;
}
function ConstituentEditor({kind,draft,change,error}:{kind:ReportKey;draft:IdentityDraft;change:(next:IdentityDraft)=>void;error:(message:string)=>void}){
 const r=draft.reports[kind],definition=REPORTS.find(v=>v.key===kind)!;
 const current=useRef(draft),alive=useRef(true);current.current=draft;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const set=(next:typeof r)=>change({...draft,reports:{...draft.reports,[kind]:next}});
 const importFile=async(file:File)=>{
  try{
   if(file.size>256*1024)throw Error('The report must be smaller than 256 KiB.');
   const at=draft,report=JSON.parse(await file.text());
   if(!alive.current)return;
   if(current.current!==at)throw Error('The identity changed while the file was being read. Choose the report again.');
   if(!report||report.route!=='import'||!report.source||typeof report.method!=='string'||!report.data||typeof report.data!=='object'||Array.isArray(report.data))throw Error('Choose an attributable report with source, method, route and data.');
   if(Object.keys(report).some(k=>!['source','method','route','data'].includes(k))||Object.keys(report.source).some(k=>!['source_ref','revision','standing_ref'].includes(k)))throw Error('The report contains unsupported attribution fields. Nothing was discarded.');
   if(['source_ref','revision','standing_ref'].some(k=>typeof report.source[k]!=='string'))throw Error('The report needs its source, revision and standing.');
   const next=draftFromProfile({...profileFromDraft(draft),[kind]:report});set(next.reports[kind]);error('');
  }catch(e){if(alive.current)error(e instanceof Error?e.message:String(e));}
 };
 return <section className="nara-constituent-editor"><h2>{definition.title}</h2><p>{definition.description}</p>
  <Input label="Import a report"><input type="file" accept="application/json,.json" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void importFile(f);}}/></Input>
  <label className="nara-personal-check"><input type="checkbox" checked={r.enabled} onChange={e=>set({...r,enabled:e.target.checked})}/> Include this material</label>
  {r.enabled&&<>
   {(kind==='jungian'||kind==='quintessence')&&<Input label="How this was supplied"><select value={r.route} onChange={e=>{try{set(changeReportRoute(kind,r,e.target.value as 'import'|'self-report'));}catch(e){error(String(e));}}}><option value="import">Imported report</option><option value="self-report">My own report</option></select></Input>}
   {kind==='jungian'&&r.route==='self-report'?<><Input label="System"><select value={r.system} onChange={e=>set({...r,system:e.target.value,identity:''})}><option value="">Choose a system</option><option value="jungian">Jungian</option><option value="mbti">MBTI</option><option value="16-personalities">16-personalities</option></select></Input><Input label="Four-letter type"><input value={r.type} maxLength={4} onChange={e=>set({...r,type:e.target.value.toUpperCase()})}/></Input>{r.system==='16-personalities'&&<Input label="Identity"><select value={r.identity} onChange={e=>set({...r,identity:e.target.value})}><option value="">Not supplied</option><option value="assertive">Assertive</option><option value="turbulent">Turbulent</option></select></Input>}</>:<ReportFields kind={kind} raw={r.data} onChange={data=>set({...r,data})}/>}
   <details className="nara-personal-depth"><summary>Attribution and method</summary>{([['source','Source'],['revision','Source revision'],['standing','Standing'],['method','Method']] as const).map(([key,label])=><Input key={key} label={label}><input value={r[key]} onChange={e=>set({...r,[key]:e.target.value})}/></Input>)}</details>
  </>}
 </section>;
}
function Composition({reading}:{reading:IdentityReading|null}){
 const c=reading?.natal_composition;
 if(!c)return <div className="nara-personal-empty"><h2>Understand the composition.</h2><p>Calculate the natal chart to inspect its actual elemental contributions. Other identity constituents retain their own source and route.</p></div>;
 return <article className="nara-composition-reading"><header><p className="nara-personal-caption">Natal composition</p><h2>What contributes to this reading</h2><p>This is the natal contribution. It is not yet the complete integrated identity.</p></header>
  <div className="nara-element-reading" aria-label="Calculated elemental proportions">{c.basis_order.map((name,i)=><div key={name}><div><span>{name}</span><strong>{c.elemental_balance_l1[i]>0&&c.elemental_balance_l1[i]<0.001?'<0.1':(c.elemental_balance_l1[i]*100).toFixed(1)}%</strong></div><meter min={0} max={1} value={c.elemental_balance_l1[i]} aria-label={`${name} natal proportion`}/></div>)}</div>
  <section><h3>Seven receiving centres</h3><p className="nara-personal-muted">Planetary evidence assigned by the native source. These are not live centre amplitudes.</p><div className="nara-centre-evidence">{c.centre_evidence.map(centre=><div key={centre.ordinal}><strong>{centre.label}</strong><section><span>{centre.planet_ids.map(id=>c.planetary_contributions.find(p=>p.native_planet_id===id)?.body??String(id)).join(', ')||'No assigned natal planet'}</span>{centre.natal_orientation&&<details><summary>Natal elemental direction</summary>{centre.natal_orientation.quaternion?<dl>{(['w','x','y','z'] as const).map(k=><React.Fragment key={k}><dt>{centre.natal_orientation!.derivation.mapping[k]}</dt><dd>{centre.natal_orientation!.quaternion![k].toFixed(6)}</dd></React.Fragment>)}</dl>:<p>{centre.natal_orientation.reason}</p>}<p>{centre.natal_orientation.role}</p></details>}</section></div>)}</div></section>
  <details className="nara-personal-depth"><summary>Weights and quaternion</summary><div className="nara-table-scroll"><table><thead><tr><th>Planet</th><th>Element</th><th>Weight</th><th>Dignity</th><th>Contribution</th></tr></thead><tbody>{c.planetary_contributions.map(p=><tr key={p.native_planet_id}><td>{p.body}</td><td>{p.element}</td><td>{p.keplerian_weight}</td><td>{p.dignity_multiplier}</td><td>{p.weighted_contribution}</td></tr>)}</tbody></table></div><p className="nara-math">q natal = ({c.q_natal.w}, {c.q_natal.x}, {c.q_natal.y}, {c.q_natal.z})</p><p>{c.quaternion_role}</p></details>
  <details className="nara-personal-depth"><summary>Source and calculation policy</summary><p>{c.policy_source.standing}</p><dl><dt>Policy</dt><dd>{c.policy}</dd><dt>Source</dt><dd>{c.policy_source.repository} / {c.policy_source.path}</dd><dt>Revision</dt><dd>{c.policy_source.revision}</dd></dl></details>
 </article>;
}
function NaraInstrument({host,close,visible}:{host:NaraInstrumentHost;close:()=>void;visible:boolean}){
 const [view,setView]=useState<View>('identity'),[draft,setDraft]=useState(newDraft),[reading,setReading]=useState<IdentityReading|null>(null),[source,setSource]=useState<IdentitySource|null>(null);
 const [profiles,setProfiles]=useState<SavedIdentity[]>([]),[selected,setSelected]=useState<InstrumentIdentity|null>(null),[state,setState]=useState<NaraInstrumentState|null>(null);
 const [editor,setEditor]=useState<'birth'|ReportKey>('birth'),[editing,setEditing]=useState(true),[ready,setReady]=useState(kernelExpressionsAvailable),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[question,setQuestion]=useState(''),[role,setRole]=useState<'nara'|'epii'>('nara');
 const active=useRef(false),mounted=useRef(true),epoch=useRef(0);
 const [before,setBefore]=useState<number>();
 const [profileErrors,setProfileErrors]=useState<{source_ref:string;error:string}[]>([]);
 useEffect(()=>{mounted.current=true;const announce=(e:MessageEvent)=>{if(e.source===window.parent&&e.data?.v===1&&e.data?.kind==='oi-kernel-channel')setReady(true);};window.addEventListener('message',announce);setReady(kernelExpressionsAvailable());if(window.parent!==window)window.parent.postMessage({v:1,kind:'oi-kernel-hello'},'*');return()=>{mounted.current=false;epoch.current++;window.removeEventListener('message',announce);};},[]);
 const act=async(label:string,operation:()=>Promise<void>)=>{if(active.current)return;active.current=true;setBusy(label);setError('');setNotice('');try{await operation();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}finally{active.current=false;if(mounted.current)setBusy('');}};
 const identity=async(request:Parameters<typeof naraInstrumentRequest>[0]&{operation:'identity'})=>{const r=await naraInstrumentRequest(request);if(r.schema!=='oi.nara-identity/v1')throw Error('The identity owner returned another reading.');return r;};
 const refreshProfiles=async()=>{const r=await identity({operation:'identity',request:{operation:'list'}});if(mounted.current){setProfiles(r.profiles??[]);setProfileErrors(r.errors??[]);}};
 useEffect(()=>{if(ready)void act('Reading saved profiles',refreshProfiles);},[ready]);
 const change=(next:IdentityDraft)=>{
  if(active.current){setError('Wait for the current operation, then apply this correction again.');return;}
  epoch.current++;
  if(selected)void naraInstrumentRequest({operation:'release_identity'}).catch(e=>{if(mounted.current)setError(String(e));});
  setDraft(next);setReading(null);setSelected(null);setState(null);setBefore(undefined);setNotice('');
 };
 const openProfile=(ref:string)=>void act('Opening your profile',async()=>{
  const at=++epoch.current,current=()=>mounted.current&&epoch.current===at;
  setSelected(null);setState(null);setBefore(undefined);setQuestion('');setSource(null);setReading(null);
  await naraInstrumentRequest({operation:'release_identity'});if(!current())return;
  if(!ref){setDraft(newDraft());setEditing(true);return;}
  const r=await identity({operation:'identity',request:{operation:'open',source_ref:ref}});if(!current())return;
  if(!r.reading||!r.source)throw Error('The saved profile was not returned.');
  setDraft(draftFromProfile(r.reading.profile));setReading(r.reading);setSource(r.source);setEditing(false);
  const calculated=await identity({operation:'identity',request:{operation:'calculate',profile:r.reading.profile}});if(!current())return;
  if(!calculated.reading)throw Error('The saved profile opened, but its calculation returned no reading.');
  setReading(calculated.reading);
 });
 const calculate=()=>void act('Calculating your natal chart',async()=>{
  const at=++epoch.current,current=()=>mounted.current&&epoch.current===at,profile=profileFromDraft(draft);
  setSelected(null);setState(null);setBefore(undefined);
  await naraInstrumentRequest({operation:'release_identity'});if(!current())return;
  const r=await identity({operation:'identity',request:{operation:'calculate',profile}});if(!current())return;
  if(!r.reading)throw Error('The calculation returned no identity reading.');
  setReading(r.reading);setEditing(false);
 });
 const save=()=>void act('Saving your profile',async()=>{
  if(!reading)throw Error('Calculate and review this identity before saving.');
  const at=epoch.current,current=()=>mounted.current&&epoch.current===at,profile=profileFromDraft(draft);
  const r=await identity({operation:'identity',request:{operation:'save',profile,source_ref:source?.source_ref??null,expected_revision:source?.revision??null}});if(!current())return;
  if(!r.source)throw Error(r.error??'The profile was not saved.');setSource(r.source);
  const result=await naraInstrumentRequest({operation:'select_identity',source:r.source,input_revision:reading.input_revision});if(!current())return;
  if(result.schema!=='oi.nara-instrument-state/v1'||!result.identity)throw Error('The saved identity was not selected.');
  setSelected(result.identity);setReading(result.identity.reading);setState(result);setNotice('Saved. This identity is selected for the Expression.');await refreshProfiles();
 });
 const basis=()=>{const expression_ref=host.nativeView()?.document.expression_ref;if(!selected||!expression_ref)throw Error('Select a saved identity and open its native Expression to continue.');return {expression_ref,source:selected.source};};
 const dialogue=async(operation:'read'|'send'|'reconnect'|'interrupt',cursor?:number)=>{const at=epoch.current,request={operation,basis:basis(),role,...(operation==='send'?{question}:{}),...(cursor===undefined?{}:{before:cursor})} as NaraInstrumentRequest;const r=await naraInstrumentRequest(request);if(r.schema!=='oi.nara-instrument-state/v1')throw Error('The native conversation returned another reading.');if(mounted.current&&epoch.current===at)setState(r);return r;};
 useEffect(()=>{if(!visible||view!=='conversation'||!selected||!ready||before!==undefined)return;let disposed=false;const current=epoch.current;let timer:number;const poll=async()=>{try{if(!active.current){const r=await naraInstrumentRequest({operation:'read',basis:basis(),role});if(!disposed&&epoch.current===current&&r.schema==='oi.nara-instrument-state/v1')setState(r);}}catch(e){if(!disposed)setError(e instanceof Error?e.message:String(e));}if(!disposed)timer=window.setTimeout(poll,1800);};void poll();return()=>{disposed=true;clearTimeout(timer);};},[visible,view,selected,role,ready,before]);
 const chooseRole=(next:'nara'|'epii')=>{if(role===next)return;epoch.current++;setRole(next);setState(null);setBefore(undefined);};
 const runs=nativeTextRuns(state?.conversation?.blocks??[]),native=state?.conversation?.connection;
 const hostDocument=host.nativeView()?.document;
 const toolBasis=selected&&hostDocument?{expression_ref:hostDocument.expression_ref,source:selected.source}:null;
 const toolSelectionKey=JSON.stringify([hostDocument?.expression_ref,hostDocument?.revision,hostDocument?.selection,selected?.source]);
 const completedAnswers=new Set(runs.filter((run,index)=>run.kind==='assistant'&&runs.slice(index+1).find(next=>['user','completed','cancelled','error'].includes(next.kind))?.kind==='completed').map(run=>run.id));
 const latestAnswer=[...completedAnswers].at(-1)??null;
 const nativeSelection=state?.expression?.selection,entity=nativeSelection?.entity_ref?state?.expression?.entities[nativeSelection.entity_ref]:null;
 const send=()=>void act('Sending to '+(role==='nara'?'Nara':'Epii'),async()=>{if(!question.trim())return;const submitted=question,at=epoch.current;await dialogue('send');if(mounted.current&&epoch.current===at){setBefore(undefined);setQuestion(current=>current===submitted?'':current);}});
 return <section className="nara-personal" aria-label="Nara Expression instrument">
  <header className="nara-personal-header"><div><p className="nara-personal-caption">Personal Expression</p><h1>{reading?.profile.name||'Nara'}</h1></div><div className="nara-personal-header-actions"><label><span className="nara-sr-only">Saved profiles</span><select aria-label="Saved profiles" value={source?.source_ref??''} disabled={!!busy||!ready} onChange={e=>openProfile(e.target.value)}><option value="">New identity</option>{profiles.map(p=><option value={p.source_ref} key={p.source_ref}>{p.name}</option>)}</select></label><button type="button" onClick={close} aria-label="Return to the Expression">Return to field</button></div></header>
  <nav className="nara-personal-nav" aria-label="Nara depth">{(['identity','matrix','composition','conversation'] as const).map(v=><button key={v} type="button" aria-current={view===v?'page':undefined} onClick={()=>setView(v)}>{v==='identity'?'Identity':v==='matrix'?'Identity matrix':v==='composition'?'Composition':'With Nara'}</button>)}</nav>
  {!ready&&<p className="nara-personal-status" role="status">Connecting to the native identity owner…</p>}{busy&&<p className="nara-personal-status" role="status">{busy}…</p>}{error&&<p className="nara-personal-error" role="alert">{error}</p>}{notice&&<p className="nara-personal-status" role="status">{notice}</p>}
  {profileErrors.length>0&&<details className="nara-personal-depth"><summary role="status">{profileErrors.length} saved {profileErrors.length===1?'profile could':'profiles could'} not be opened</summary>{profileErrors.map(p=><p key={p.source_ref}>{p.error}<br/><small>{p.source_ref}</small></p>)}</details>}
  <div className="nara-personal-content" aria-busy={!!busy}>
   {view==='identity'&&<div className="nara-identity-layout"><aside className="nara-identity-reading"><div className="nara-personal-heading"><h2>{editing?'Your identity material':'The person behind the reading'}</h2><p>{editing?'Begin with what you know. You can correct it later.':'Six distinct constituents, held together without losing their sources.'}</p></div>
    <div className="nara-constituents" aria-label="Identity constituents"><button aria-pressed={editor==='birth'} onClick={()=>{setEditor('birth');setEditing(true);}}>Birth details<span>{draft.date||'Not entered'}</span></button>{REPORTS.map(r=><button key={r.key} aria-pressed={editor===r.key} onClick={()=>{setEditor(r.key);setEditing(true);}}>{r.title}<span>{draft.reports[r.key].enabled?'Supplied':'Not supplied'}</span></button>)}</div>
    {editing?<fieldset disabled={!!busy||!ready}>{editor==='birth'?<BirthEditor draft={draft} change={change}/>:<ConstituentEditor key={editor} kind={editor} draft={draft} change={change} error={setError}/>}</fieldset>:<div className="nara-birth-summary"><p>{draft.date}</p><p>{draft.precision==='unknown'?'Birth time unknown':`${draft.time}${draft.precision==='approximate'?` ± ${draft.uncertainty} minutes`:''}`}</p><p>{draft.place.label}</p><p>{draft.place.timezone}</p>{reading&&<details className="nara-personal-depth"><summary>Full identity matrix</summary>{reading.matrix.map(row=><div className="nara-matrix-row" key={row.kind}><strong>{OFFICE_NAMES[row.kind]??row.kind}</strong><span>{row.available?row.route.replaceAll('-',' '):'Not supplied'}</span>{row.method&&<p>{row.method}</p>}</div>)}</details>}</div>}
    <div className="nara-personal-actions"><button className="nara-primary" type="button" disabled={!!busy||!ready} onClick={calculate}>{reading?'Recalculate chart':'Calculate and review'}</button><button type="button" disabled={!!busy||!reading||!ready} onClick={save}>Save and use identity</button></div>
   </aside><div className="nara-identity-sky"><Chart reading={reading}/></div></div>}
   {view==='matrix'&&<IdentityMatrix reading={reading} onShowNatal={()=>setView('identity')}/>}
   {view==='composition'&&<Composition reading={reading}/>}
   {view==='conversation'&&<div className="nara-conversation-layout"><aside><p className="nara-personal-caption">Here, in this Expression</p><h2>{selected?.reading.profile.name||'Choose your identity'}</h2><p>{entity?`Selected: ${entity.title}`:'No centre is selected.'}</p><p className="nara-personal-muted">{selected?'The conversation follows the saved person and actual selected subject.':'Calculate, review and save your identity to continue.'}</p><div className="nara-personal-actions"><button aria-pressed={role==='nara'} disabled={!!busy} onClick={()=>chooseRole('nara')}>Nara</button><button aria-pressed={role==='epii'} disabled={!!busy} onClick={()=>chooseRole('epii')}>Ask Epii</button></div></aside><section className="nara-conversation" aria-label={`${role==='nara'?'Nara':'Epii'} conversation`}>
    <p role="status">{native?.state==='TurnInFlight'?'Responding…':native?.state==='Resident'?'Connected':state?.dialogue?'Recorded conversation':'Conversation opens on first send'}</p>
    {state?.dialogue&&native?.state==='Disconnected'&&<button onClick={()=>void act('Reconnecting',async()=>{await dialogue('reconnect');})}>Reconnect this conversation</button>}
    <div className="nara-history-actions">{state?.conversation?.more&&<button disabled={!!busy} onClick={()=>void act('Reading earlier messages',async()=>{const cursor=Math.min(...state.conversation!.blocks.map(b=>b.id));await dialogue('read',cursor);setBefore(cursor);})}>Earlier messages</button>}{before!==undefined&&<button disabled={!!busy} onClick={()=>void act('Reading latest messages',async()=>{await dialogue('read');setBefore(undefined);})}>Latest messages</button>}</div>
    <ol>{runs.map(b=>b.kind==='user'||b.kind==='assistant'?<li key={b.id} className={b.kind==='user'?'from-person':'from-nara'}><span>{b.kind==='user'?'You':role==='nara'?'Nara':'Epii'}</span><p>{b.kind==='user'?questionText(b.text):b.text}</p>{completedAnswers.has(b.id)&&<NaraAnswerReturnTools basis={toolBasis} role={role} selectionKey={toolSelectionKey} visible={visible&&view==='conversation'} disabled={!!busy} answerBlockId={b.id}/>}</li>:b.kind==='error'||b.kind==='cancelled'?<li key={b.id} className="nara-turn-outcome" role={failureText(b.text)==='Cancelled'?'status':'alert'}>{failureText(b.text)==='Cancelled'?'You stopped this response.':failureText(b.text)}</li>:null)}</ol>
    <form onSubmit={e=>{e.preventDefault();send();}}><label htmlFor="nara-instrument-question" className="nara-sr-only">Message {role==='nara'?'Nara':'Epii'}</label><textarea id="nara-instrument-question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder={entity?`Ask about ${entity.title}`:'Ask about your identity or this Expression'} rows={3}/><div className="nara-personal-actions"><button className="nara-primary" disabled={!!busy||!selected||!question.trim()||native?.state==='TurnInFlight'}>Send</button>{native?.state==='TurnInFlight'&&<button type="button" onClick={()=>void act('Stopping the response',async()=>{await dialogue('interrupt');})}>Stop response</button>}</div></form>
    <NaraVoiceTools basis={toolBasis} role={role} selectionKey={toolSelectionKey} visible={visible&&view==='conversation'} disabled={!!busy} running={native?.state==='TurnInFlight'} answerBlockId={latestAnswer} composerEmpty={!question.trim()} receiveTranscript={setQuestion}/>
   </section></div>}
  </div>
 </section>;
}

/** One private instrument aperture over the one existing live Expression. */
export function installNaraInstrument(host:NaraInstrumentHost){
 const container=document.createElement('div');container.className='nara-instrument-aperture';container.hidden=true;document.body.append(container);
 const trigger=document.createElement('button');trigger.type='button';trigger.className='text-button';trigger.textContent='Nara';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','nara-instrument');container.id='nara-instrument';document.querySelector('.header-actions')?.prepend(trigger);
 const root=createRoot(container);let visible=false;
 const app=document.getElementById('app'),wasInert=app?.inert??false;
 const render=()=>root.render(<NaraInstrument host={host} close={close} visible={visible}/>);
 const close=()=>{visible=false;container.hidden=true;if(app)app.inert=wasInert;trigger.setAttribute('aria-expanded','false');document.body.classList.remove('nara-depth-open');render();trigger.focus();};
 const open=()=>{visible=true;container.hidden=false;if(app)app.inert=true;trigger.setAttribute('aria-expanded','true');document.body.classList.add('nara-depth-open');render();requestAnimationFrame(()=>container.querySelector<HTMLElement>('select,button')?.focus());};
 render();trigger.addEventListener('click',()=>visible?close():open());
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&visible){e.preventDefault();e.stopPropagation();close();}};container.addEventListener('keydown',key);
 return {open,close,destroy(){root.unmount();if(app)app.inert=wasInert;container.remove();trigger.remove();document.body.classList.remove('nara-depth-open');}};
}
