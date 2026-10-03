import type {NativeCurrentReading} from '../../../src/nara/nativeCurrent';
/** Personal depth inside the existing Expression application. The native
 * document and engine remain with the host; no private readings enter a
 * Journey, localStorage, export, or a second presentation runtime. */
import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {readRecoverySizeDiagnostic,recoveryFailureMessage} from './recoverySizeDiagnostic.js';
import {kernelExpressionsAvailable,naraInstrumentRequest,nativeExpressionRequest} from './kernelExpressions.js';
import type {KernelConversion} from './kernelDocumentBridge.js';
import type {IdentityReading,IdentitySource,NaraIdentityResult,SavedIdentity,ReportKey,PersonalCurrentReading} from '../../../src/nara/identity/types';
import {REPORTS,OFFICE_NAMES,newDraft,draftFromProfile,profileFromDraft,changeReportRoute} from '../../../src/nara/identity/profileDraft';
import type {IdentityDraft} from '../../../src/nara/identity/profileDraft';
import {ReportFields} from '../../../src/nara/identity/ReportFields';
import type {NaraInstrumentRequest,NaraInstrumentState,InstrumentIdentity} from '../../../src/nara/instrumentProtocol';
import {nativeTextRuns} from '../../../src/nara/nativeTranscript';
import {EpiiReview} from './EpiiReview';
import {CoordinateAtlas} from './CoordinateAtlas';
import {IdentityMatrix} from './IdentityMatrix';
import {IdentityComposition} from './IdentityComposition';
import {NaraCurrentSky} from './NaraCurrentSky';
import {NaraM3} from './NaraM3';
import type {NativeM3Reading} from '../../../src/nara/nativeM3';
import {NaraVoiceTools,NaraAnswerReturnTools,NaraKeptAnswerTools,type NaraVoiceHandle} from './naraConversationTools';
import {NaraExpressiveActTools,type NaraActHandle} from './NaraExpressiveActTools';
import './naraInstrument.css';
import {personalContextKey,personalContextBasisKey,personalCurrentKey,type EvidencePresentation,type NaraPersonalContext} from './naraEvidenceField';
import type {NatalEvidenceChannel} from '../../../src/nara/identity/evidencePartition';
import {preparePersonalBodyBindings} from './naraPersonalBody';
import {validateCoordinateExpression} from '../../../src/nara/coordinateExpression';
import type {ExpressionResult} from '../../../src/expression/types';
import type {ChakraId} from '../../src/engine/semantics/chakraSemantics';

export interface NaraInstrumentHost {
 enterWorld?:(identity:InstrumentIdentity)=>Promise<void>;
 personalContext?:()=>NaraPersonalContext|null|undefined;
 releasePersonalContext?:(explicitIdentityIntent?:boolean)=>boolean;
 acceptPersonalCurrent?:(current:NativeCurrentReading)=>void;
 nativeView:()=>KernelConversion|undefined;
 sceneId:()=>string;
 acceptNativeDocument:(document:unknown)=>Promise<void>|void;
 acceptKeptAnswer:(receipt:import('../../../src/nara/instrumentProtocol').NativeExpressionAnswerReceipt)=>Promise<void>;
 readKeptAnswer:(answer:import('../../../src/nara/nativeKeptAnswer').KeptAnswerReading)=>Promise<void>;
 presentEvidence?:(presentation:EvidencePresentation|null)=>void;
 presentForm?:(reading:NativeM3Reading|null)=>void;
 formPresentationCurrent?:(reading:NativeM3Reading)=>boolean;
}
type View='identity'|'matrix'|'composition'|'form'|'atlas'|'conversation';
function answerText(text:string){try{const value=JSON.parse(text);return value.schema==='ql.epii-enrichment/v1'&&typeof value.synthesis==='string'?value.synthesis:text;}catch{return text;}}
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
  <Input label="Source of these coordinates"><input value={draft.place.source} aria-describedby="nara-birthplace-source-help" onChange={e=>place('source',e.target.value)}/><small id="nara-birthplace-source-help">When you enter a birthplace, say where its coordinates came from, such as a map, an atlas or coordinates you confirmed yourself.</small></Input>
  {draft.precision!=='unknown'&&<details className="nara-personal-depth"><summary>Repeated clock time</summary><Input label="If the clock repeated this time"><select value={draft.fold} onChange={e=>set('fold',e.target.value)}><option value="">Resolve from the date and timezone</option><option value="0">First occurrence</option><option value="1">Second occurrence</option></select></Input></details>}
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
   {kind==='jungian'&&r.route==='self-report'?<><Input label="System"><select value={r.system} onChange={e=>set({...r,system:e.target.value,identity:''})}><option value="">Choose a system</option><option value="jungian">Jungian</option><option value="mbti">MBTI</option><option value="16-personalities">16-personalities</option></select></Input><Input label="Four-letter type"><input value={r.type} maxLength={4} onChange={e=>set({...r,type:e.target.value.toUpperCase()})}/></Input>{r.system==='16-personalities'&&<Input label="Identity"><select value={r.identity} onChange={e=>set({...r,identity:e.target.value})}><option value="">Not supplied</option><option value="A">Assertive</option><option value="T">Turbulent</option></select></Input>}</>:<ReportFields kind={kind} raw={r.data} onChange={data=>set({...r,data})}/>}
   <details className="nara-personal-depth"><summary>Attribution and method</summary>{([['source','Source'],['revision','Source revision'],['standing','Standing'],['method','Method']] as const).map(([key,label])=><Input key={key} label={label}><input value={r[key]} onChange={e=>set({...r,[key]:e.target.value})}/></Input>)}</details>
  </>}
 </section>;
}
function NaraInstrument({host,close,visible,requestedView,viewRevision,hostRevision}:{host:NaraInstrumentHost;close:()=>void;visible:boolean;requestedView?:View;viewRevision:number;hostRevision:number}){
 useEffect(()=>{if(requestedView)setView(requestedView);},[requestedView,viewRevision]);
 const [view,setView]=useState<View>('identity'),[draft,setDraft]=useState(newDraft),[reading,setReading]=useState<IdentityReading|null>(null),[source,setSource]=useState<IdentitySource|null>(null);
 const [profiles,setProfiles]=useState<SavedIdentity[]>([]),[selected,setSelected]=useState<InstrumentIdentity|null>(null),[state,setState]=useState<NaraInstrumentState|null>(null);
 const [editor,setEditor]=useState<'birth'|ReportKey>('birth'),[editing,setEditing]=useState(true),[ready,setReady]=useState(kernelExpressionsAvailable),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[question,setQuestion]=useState(''),[role,setRole]=useState<'nara'|'epii'>('nara');
 const active=useRef(false),mounted=useRef(true),epoch=useRef(0);
 // The initial editor is open but untouched. Only an explicit identity action
 // makes a draft pending and gives it precedence over saved-world hydration.
 const draftDirty=useRef(false),restoredContext=useRef<string|null>(null),restoredBasis=useRef<string|null>(null),releasedBasis=useRef<string|null>(null);
 const admittedCurrent=useRef<string>(personalCurrentKey(null));
 const voiceTools=useRef<NaraVoiceHandle>(null),stopPending=useRef(false);
 const expressiveActTools=useRef<NaraActHandle>(null);
 const [stopping,setStopping]=useState(false),[stopFailed,setStopFailed]=useState(false);
 const [voiceActive,setVoiceActive]=useState(false);
 const [evidenceChannel,setEvidenceChannel]=useState<NatalEvidenceChannel|null>(null);
 const [evidenceSound,setEvidenceSound]=useState(false);
 const [evidenceWaves,setEvidenceWaves]=useState(false);
 const [nativeCurrent,setNativeCurrent]=useState<NativeCurrentReading|null>(null);
 const [formReading,setFormReading]=useState<NativeM3Reading|null>(null);
 const formRef=useRef<NativeM3Reading|null>(null);
 const presentForm=(value:NativeM3Reading|null)=>{
  try{if(value&&(!selected||value.person_ref!==selected.reading.person_ref||value.identity_source_ref!==selected.source.source_ref||value.identity_revision!==selected.source.revision))throw Error('Select this form’s saved identity before presenting it.');host.presentForm?.(value);formRef.current=value;setFormReading(value);setError('');}
  catch(e){host.presentForm?.(null);formRef.current=null;setFormReading(null);setError(e instanceof Error?e.message:String(e));}
 };
 const [includeEarth,setIncludeEarth]=useState(true);
 const [personalCurrent,setPersonalCurrent]=useState<PersonalCurrentReading|null>(null);
 const clearPersonalPresentation=(explicitIdentityIntent=false)=>{
  if(explicitIdentityIntent)host.releasePersonalContext?.(true);
  host.presentEvidence?.(null);setEvidenceChannel(null);setEvidenceSound(false);setEvidenceWaves(false);
  admittedCurrent.current=personalCurrentKey(null);setPersonalCurrent(null);setNativeCurrent(null);
  presentForm(null);restoredContext.current=null;restoredBasis.current=null;
 };
 useEffect(()=>{
  if(!ready||active.current||draftDirty.current)return;
  const context=host.personalContext?.();
  if(context===undefined)return;
  if(!context){
   if(restoredContext.current){host.presentForm?.(null);formRef.current=null;setFormReading(null);restoredContext.current=null;restoredBasis.current=null;setDraft(newDraft());setEditing(true);setSelected(null);setState(null);setSource(null);setReading(null);setNativeCurrent(null);setPersonalCurrent(null);setEvidenceChannel(null);setEvidenceSound(false);setEvidenceWaves(false);setBefore(undefined);}
   return;
  }
  const key=personalContextKey(context),basisKey=personalContextBasisKey(context);
  if(key===restoredContext.current||basisKey===releasedBasis.current)return;
  if(basisKey!==restoredBasis.current){
   epoch.current++;host.presentForm?.(null);setDraft(draftFromProfile(context.identity.reading.profile));setSelected(context.identity);
   setReading(context.identity.reading);setSource(context.identity.source);setEditing(false);
   setState(null);setBefore(undefined);setQuestion('');formRef.current=null;setFormReading(null);
  }
  restoredContext.current=key;restoredBasis.current=basisKey;releasedBasis.current=null;
  admittedCurrent.current=personalCurrentKey(context.current);
  setNativeCurrent(context.current);setPersonalCurrent(context.current.reading);
  setEvidenceChannel(context.presentation?.channel??null);setEvidenceSound(!!context.presentation?.sound);setEvidenceWaves(!!context.presentation?.waves);
  setError('');
  // Restoration mirrors the host's already admitted private presentation. It
  // does not present/release it again or reset its resident modal history.
 },[host,hostRevision,visible,ready,busy]);
 useEffect(()=>{
  const released=(event:MessageEvent)=>{
   if(event.source!==window.parent||event.data?.v!==1||event.data?.kind!=='oi-nara-identity-released')return;
   if(host.releasePersonalContext?.()===false)return;
   releasedBasis.current=restoredBasis.current;clearPersonalPresentation();setSelected(null);setState(null);
  };
  window.addEventListener('message',released);return()=>window.removeEventListener('message',released);
 },[host]);
 const presentEvidence=(channel:NatalEvidenceChannel|null,sound=evidenceSound,waves=evidenceWaves)=>{
  try{if(channel&&!selected)throw Error('Save and select your identity first.');host.presentEvidence?.(channel&&selected?{identity:selected,channel,sound,waves,current:nativeCurrent}:null);admittedCurrent.current=personalCurrentKey(nativeCurrent);setEvidenceChannel(channel);setEvidenceSound(sound);setEvidenceWaves(!!channel&&waves);setError('');}
  catch(e){setError(e instanceof Error?e.message:String(e));}
 };
 useEffect(()=>{
  if(!evidenceChannel||!selected||!evidenceWaves||personalCurrentKey(nativeCurrent)===admittedCurrent.current)return;
  try{host.presentEvidence?.({identity:selected,channel:evidenceChannel,sound:evidenceSound,waves:true,current:nativeCurrent});admittedCurrent.current=personalCurrentKey(nativeCurrent);}
  catch(failure){host.presentEvidence?.(null);setEvidenceChannel(null);setEvidenceWaves(false);setError(failure instanceof Error?failure.message:String(failure));}
 },[nativeCurrent]);
 const receivePersonalCurrent=(value:NativeCurrentReading|null)=>{
  try{if(value)host.acceptPersonalCurrent?.(value);setNativeCurrent(value);setPersonalCurrent(value?.reading??null);}
  catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
 };
 const [before,setBefore]=useState<number>();
 const [profileErrors,setProfileErrors]=useState<{source_ref:string;error:string}[]>([]);
 useEffect(()=>{mounted.current=true;const announce=(e:MessageEvent)=>{if(e.source===window.parent&&e.data?.v===1&&e.data?.kind==='oi-kernel-channel')setReady(true);};window.addEventListener('message',announce);setReady(kernelExpressionsAvailable());if(window.parent!==window)window.parent.postMessage({v:1,kind:'oi-kernel-hello'},'*');return()=>{mounted.current=false;epoch.current++;window.removeEventListener('message',announce);};},[]);
 const act=async(label:string,operation:()=>Promise<void>)=>{if(active.current)return;active.current=true;setBusy(label);setError('');setNotice('');try{await operation();}catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}finally{active.current=false;if(mounted.current)setBusy('');}};
 const identity=async(request:Parameters<typeof naraInstrumentRequest>[0]&{operation:'identity'})=>{const r=await naraInstrumentRequest(request);if(r.schema!=='oi.nara-identity/v1')throw Error('The identity owner returned another reading.');return r;};
 const refreshProfiles=async()=>{const r=await identity({operation:'identity',request:{operation:'list'}});if(mounted.current){setProfiles(r.profiles??[]);setProfileErrors(r.errors??[]);}};
 useEffect(()=>{
  if(!selected||!evidenceChannel)return;
  let disposed=false,timer:number;
  const check=async()=>{
   try{
    const result=await identity({operation:'identity',request:{operation:'open',source_ref:selected.source.source_ref}});
    if(disposed)return;
    if(result.source?.revision!==selected.source.revision||result.reading?.input_revision!==selected.reading.input_revision)throw Error('Your identity changed. Reopen it to continue its live presentation.');
    if(evidenceWaves){
     const expression_ref=host.nativeView()?.document.expression_ref;
     if(!expression_ref)throw Error('The personal field no longer has its native Expression.');
     const current=await naraInstrumentRequest({operation:'current_read',basis:{expression_ref,source:selected.source},role:'nara'});
     if(disposed)return;
     if(current.schema!=='oi.nara-personal-current-context/v1'||!current.reading||!current.context)throw Error('The native occasion is no longer available. Read its sky again to continue.');
     if(current.context.reading_ref!==nativeCurrent?.context?.reading_ref){host.acceptPersonalCurrent?.(current);setNativeCurrent(current);setPersonalCurrent(current.reading);}
    }
   }catch(cause){
    if(disposed)return;
    host.presentEvidence?.(null);setEvidenceChannel(null);setSelected(null);setError(cause instanceof Error?cause.message:String(cause));return;
   }
   if(!disposed)timer=window.setTimeout(check,2000);
  };
  void check();return()=>{disposed=true;clearTimeout(timer);};
 },[selected,evidenceChannel,evidenceWaves,nativeCurrent?.context?.reading_ref,host]);
 const bindPersonalBody=()=>void act('Binding your seven centres',async()=>{
  if(!selected)throw Error('Save and select your identity first.');
  const at=epoch.current,current=host.nativeView(),material=current?.journey.scenes.find(scene=>scene.id===host.sceneId());
  const sceneBinding=current?.bindings[host.sceneId()];
  if(!current||!material||!sceneBinding)throw Error('Open and save the retained seven-centre Expression first.');
  const saved=await identity({operation:'identity',request:{operation:'open',source_ref:selected.source.source_ref}});
  if(saved.source?.revision!==selected.source.revision||saved.reading?.input_revision!==selected.reading.input_revision)throw Error('Your identity changed. Reopen it before binding the centres.');
  const calculated=await identity({operation:'identity',request:{operation:'calculate',profile:saved.reading.profile}});
  if(calculated.reading?.input_revision!==selected.reading.input_revision||calculated.reading.person_ref!==selected.reading.person_ref)throw Error('The calculated body does not match your selected identity.');
  const basis=(await nativeExpressionRequest({operation:'inspect',expression_ref:current.document.expression_ref}) as ExpressionResult).document;
  if(!basis||basis.revision!==current.document.revision)throw Error('The Expression changed. Reopen its current revision before binding.');
  const template_bindings=material.entities.filter(entity=>entity.native?.chakraId).map(entity=>{
   const occurrences=sceneBinding.occurrences.filter(occurrence=>occurrence.view_entity_id===entity.id);
   if(occurrences.length!==1)throw Error('A centre has no unique native occurrence.');
   return {entity_ref:occurrences[0].entity_ref,chakraId:entity.native!.chakraId as ChakraId};
  });
  const prepared=await preparePersonalBodyBindings(async request=>validateCoordinateExpression(await naraInstrumentRequest({operation:'coordinate',request})),{
   document:basis,scene_ref:sceneBinding.scene_ref,centre_evidence:calculated.reading.natal_composition?.centre_evidence??[],template_bindings,
   ...(includeEarth?{create_earth:{entity_ref:`${basis.expression_ref}:entity:occurrence-${crypto.randomUUID()}`}}:{}),
  });
  if(!mounted.current||epoch.current!==at||host.nativeView()?.document.expression_ref!==basis.expression_ref||host.sceneId()!==material.id)throw Error('The encounter changed while its sources were read. No bindings were applied.');
  const latest=await identity({operation:'identity',request:{operation:'open',source_ref:selected.source.source_ref}});
  if(latest.source?.revision!==selected.source.revision)throw Error('Your identity changed while its sources were read. No bindings were applied.');
  if(prepared.changes.length){
   const result=await nativeExpressionRequest({operation:'edit',expression_ref:basis.expression_ref,expected_revision:basis.revision,actor:'human:nara-personal-body',changes:prepared.changes}) as ExpressionResult;
   if(!result.document)throw Error('The Expression changed before its centres could be bound. Read its current revision and try again.');
   host.presentEvidence?.(null);setEvidenceChannel(null);
   await host.acceptNativeDocument(result.document);
  }
  setNotice(includeEarth?'Your seven centres and Earth grounding are bound to their native sources. Select a centre or relation in the field to work with Nara about it.':'Your seven centres are bound to their native body sources. Select a centre or relation in the field to work with Nara about it.');
 });
 useEffect(()=>{if(ready)void act('Reading saved profiles',refreshProfiles);},[ready]);
 const change=(next:IdentityDraft)=>{
  if(active.current){setError('Wait for the current operation, then apply this correction again.');return;}
  draftDirty.current=true;epoch.current++;clearPersonalPresentation(true);
  void naraInstrumentRequest({operation:'release_identity'}).catch(e=>{if(mounted.current)setError(String(e));});
  setDraft(next);setReading(null);setSelected(null);setState(null);setBefore(undefined);setNotice('');
 };
 const openProfile=(ref:string)=>void act('Opening your profile',async()=>{
  draftDirty.current=true;clearPersonalPresentation(true);
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
  draftDirty.current=true;clearPersonalPresentation(true);
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
  releasedBasis.current=null;setSelected(result.identity);setReading(result.identity.reading);setState(result);setNotice('Saved. This identity is selected for the Expression.');await refreshProfiles();await host.enterWorld?.(result.identity);if(current()){draftDirty.current=false;restoredContext.current=null;}
 });
 const basis=()=>{const expression_ref=host.nativeView()?.document.expression_ref;if(!selected||!expression_ref)throw Error('Select a saved identity and open its native Expression to continue.');return {expression_ref,source:selected.source};};
 const dialogue=async(operation:'read'|'send'|'reconnect',cursor?:number)=>{const at=epoch.current,request={operation:operation==='send'&&role==='epii'?'epii_delegate':operation,basis:basis(),role,...(operation==='send'?{question}:{}),...(cursor===undefined?{}:{before:cursor})} as NaraInstrumentRequest;const r=await naraInstrumentRequest(request);if(r.schema!=='oi.nara-instrument-state/v1')throw Error('The native conversation returned another reading.');if(mounted.current&&epoch.current===at)setState(r);return r;};
 const stopResponse=async()=>{
  expressiveActTools.current?.cancelPending();
  if(stopPending.current)return;stopPending.current=true;setStopping(true);setStopFailed(false);setError('');setNotice('');
  const at=epoch.current;
  // Local teardown begins synchronously, even while send/transcription/TTS is
  // awaiting its owner. Neither failure may prevent the other stop operation.
  const local=role==='nara'?voiceTools.current?.stopLocal()??Promise.resolve():Promise.resolve();
  let cancellationRequested=false;
  const nativeStop=(async()=>{
   const result=await naraInstrumentRequest({operation:'interrupt',basis:basis(),role});
   if(result.schema!=='oi.nara-instrument-interruption/v1')throw Error('The native stop operation was not acknowledged.');
   cancellationRequested=result.cancellation_requested;
  })();
  const results=await Promise.allSettled([local,nativeStop]);
  if(mounted.current){
   const failures=results.flatMap((result,index)=>result.status==='rejected'?[`${index===0?'Local audio stop':'Native stop'}: ${result.reason instanceof Error?result.reason.message:String(result.reason)}`]:[]);
   if(failures.length){setError((epoch.current===at?'':'Stopping the previous conversation failed. ')+failures.join(' '));setStopFailed(epoch.current===at);}
   else if(epoch.current===at)setNotice(cancellationRequested?(role==='nara'?'Local voice stopped. Native cancellation requested; the conversation will confirm its state.':'Native cancellation requested; the conversation will confirm its state.'):role==='nara'?'Voice stopped. No native response was in flight.':'No native response was in flight.');
  }
  stopPending.current=false;if(mounted.current)setStopping(false);
 };
 useEffect(()=>{if(!visible||view!=='conversation'||!selected||!ready||before!==undefined)return;let disposed=false;const current=epoch.current;let timer:number;const poll=async()=>{try{if(!active.current){const r=await naraInstrumentRequest({operation:'read',basis:basis(),role});if(!disposed&&epoch.current===current&&r.schema==='oi.nara-instrument-state/v1')setState(r);}}catch(e){if(!disposed)setError(e instanceof Error?e.message:String(e));}if(!disposed)timer=window.setTimeout(poll,1800);};void poll();return()=>{disposed=true;clearTimeout(timer);};},[visible,view,selected,role,ready,before]);
 const chooseRole=(next:'nara'|'epii')=>{if(role===next)return;epoch.current++;setRole(next);setState(null);setBefore(undefined);};
 const runs=nativeTextRuns(state?.conversation?.blocks??[]),native=state?.conversation?.connection;
 const hostDocument=host.nativeView()?.document;
 const toolBasis=selected&&hostDocument?{expression_ref:hostDocument.expression_ref,source:selected.source}:null;
 const toolSelectionKey=JSON.stringify([hostDocument?.expression_ref,hostDocument?.revision,hostDocument?.selection,selected?.source]);
 useEffect(()=>{
  if(!formReading||!toolBasis)return;
  let disposed=false,timer:number;
  const check=async()=>{
   const before=formRef.current;
   try{
    const result=await naraInstrumentRequest({operation:'m3',basis:toolBasis,role:'nara',request:{operation:'read'}});
   if(disposed)return;
   if(formRef.current!==before){timer=window.setTimeout(check,2000);return;}
    if(result.schema!=='oi.m3-reception-context/v1'||result.status!=='available'||result.event_ref!==nativeCurrent?.context?.event_ref)throw Error('The native form is no longer current for this encounter.');
    presentForm(result);
   }catch(e){if(!disposed){presentForm(null);setError(e instanceof Error?e.message:String(e));return;}}
   if(!disposed)timer=window.setTimeout(check,2000);
  };
  void check();return()=>{disposed=true;clearTimeout(timer);};
 },[!!formReading,toolSelectionKey,nativeCurrent?.context?.event_ref]);
 const completedAnswers=new Set(runs.filter((run,index)=>run.kind==='assistant'&&runs.slice(index+1).find(next=>['user','completed','cancelled','error'].includes(next.kind))?.kind==='completed').map(run=>run.id));
 const latestAnswer=[...completedAnswers].at(-1)??null;
 const nativeSelection=state?.expression?.selection,entity=nativeSelection?.entity_ref?state?.expression?.entities[nativeSelection.entity_ref]:null;
 const send=()=>void act('Sending to '+(role==='nara'?'Nara':'Epii'),async()=>{if(!question.trim())return;const submitted=question,at=epoch.current;await dialogue('send');if(mounted.current&&epoch.current===at){setBefore(undefined);setQuestion(current=>current===submitted?'':current);}});
 const recoveryFailure=error?readRecoverySizeDiagnostic(error):null;
 return <section className="nara-personal" aria-label="Nara Expression instrument">
  <header className="nara-personal-header"><div><p className="nara-personal-caption">Personal Expression</p><h1>{reading?.profile.name||'Nara'}</h1></div><div className="nara-personal-header-actions"><label><span className="nara-sr-only">Saved profiles</span><select aria-label="Saved profiles" value={source?.source_ref??''} disabled={!!busy||stopping||!ready} onChange={e=>openProfile(e.target.value)}><option value="">New identity</option>{profiles.map(p=><option value={p.source_ref} key={p.source_ref}>{p.name}</option>)}</select></label><button type="button" onClick={close} aria-label="Return to the Expression">Return to field</button></div></header>
  <nav className="nara-personal-nav" aria-label="Nara depth">{(['identity','matrix','composition','form','atlas','conversation'] as const).map(v=><button key={v} type="button" aria-current={view===v?'page':undefined} onClick={()=>setView(v)}>{v==='identity'?'Identity':v==='matrix'?'Identity matrix':v==='composition'?'Composition':v==='form'?'Form and clock':v==='atlas'?'Coordinate Atlas':'With Nara'}</button>)}</nav>
  {!ready&&<p className="nara-personal-status" role="status">Connecting to the native identity owner…</p>}{busy&&<p className="nara-personal-status" role="status">{busy}…</p>}{error&&<><p className="nara-personal-error" role="alert">{recoveryFailureMessage(error,!!recoveryFailure)}</p>{recoveryFailure&&<details className="nara-personal-depth" data-native-recovery-diagnostic><summary>Inspect failure</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:"16rem",overflow:"auto"}}>{error}</pre></details>}</>}{notice&&<p className="nara-personal-status" role="status">{notice}</p>}
  {profileErrors.length>0&&<details className="nara-personal-depth"><summary role="status">{profileErrors.length} saved {profileErrors.length===1?'profile could':'profiles could'} not be opened</summary>{profileErrors.map(p=><p key={p.source_ref}>{p.error}<br/><small>{p.source_ref}</small></p>)}</details>}
  <div className="nara-personal-content" aria-busy={!!busy}>
   {view==='identity'&&<div className="nara-identity-layout"><aside className="nara-identity-reading"><div className="nara-personal-heading"><h2>{editing?'Your identity material':'The person behind the reading'}</h2><p>{editing?'Begin with what you know. You can correct it later.':'Six distinct constituents, held together without losing their sources.'}</p></div>
    <div className="nara-constituents" aria-label="Identity constituents"><button aria-pressed={editor==='birth'} onClick={()=>{setEditor('birth');setEditing(true);}}>Birth details<span>{draft.date||'Not entered'}</span></button>{REPORTS.map(r=><button key={r.key} aria-pressed={editor===r.key} onClick={()=>{setEditor(r.key);setEditing(true);}}>{r.title}<span>{draft.reports[r.key].enabled?'Supplied':'Not supplied'}</span></button>)}</div>
    {editing?<fieldset disabled={!!busy||!ready}>{editor==='birth'?<BirthEditor draft={draft} change={change}/>:<ConstituentEditor key={editor} kind={editor} draft={draft} change={change} error={setError}/>}</fieldset>:<div className="nara-birth-summary"><p>{draft.date}</p><p>{draft.precision==='unknown'?'Birth time unknown':`${draft.time}${draft.precision==='approximate'?` ± ${draft.uncertainty} minutes`:''}`}</p><p>{draft.place.label}</p><p>{draft.place.timezone}</p>{reading&&<details className="nara-personal-depth"><summary>Full identity matrix</summary>{reading.matrix.map(row=><div className="nara-matrix-row" key={row.kind}><strong>{OFFICE_NAMES[row.kind]??row.kind}</strong><span>{row.available?row.route.replaceAll('-',' '):'Not supplied'}</span>{row.method&&<p>{row.method}</p>}</div>)}</details>}</div>}
    <div className="nara-personal-actions"><button className="nara-primary" type="button" disabled={!!busy||!ready} onClick={calculate}>{reading?'Recalculate chart':'Calculate and review'}</button><button type="button" disabled={!!busy||!reading||!ready} onClick={save}>Save and use identity</button></div>
   </aside><div className="nara-identity-sky"><Chart reading={reading}/></div></div>}
   {view==='matrix'&&<IdentityMatrix reading={reading} onShowNatal={()=>setView('identity')}/>}
   {view==='composition'&&<><NaraCurrentSky basis={toolBasis} identity={selected} reading={personalCurrent} onReading={setPersonalCurrent} onNativeReading={receivePersonalCurrent} disabled={!!busy||stopping}/><section aria-label="Natal evidence in the living field"><h2>Experience the natal contributions</h2><label><input type="checkbox" checked={includeEarth} disabled={!!busy||stopping} onChange={event=>setIncludeEarth(event.target.checked)}/> Include Earth grounding</label><button type="button" disabled={!!busy||stopping||!selected} onClick={bindPersonalBody}>Bind my seven centres</button><p>Use the computed share reaching each centre to shape its forces in this Expression. Choose one correspondence route; the original reading and authored field remain available.</p><label>Force presentation<select aria-label="Natal force presentation" value={evidenceChannel??''} disabled={!!busy||stopping||!selected||!host.presentEvidence} onChange={e=>presentEvidence((e.target.value||null) as NatalEvidenceChannel|null)}><option value="">Authored field</option><option value="direct-planetary-resonance">Direct planetary resonance</option><option value="decan-ruler-reception">Decan ruler reception</option></select></label><label><input type="checkbox" checked={evidenceSound} disabled={!evidenceChannel||!!busy||stopping} onChange={e=>presentEvidence(evidenceChannel,e.target.checked)}/> Sound the native planetary frequencies</label><label><input type="checkbox" checked={evidenceWaves} disabled={!evidenceChannel||!nativeCurrent?.reading?.baseline_available||!!busy||stopping} onChange={event=>presentEvidence(evidenceChannel,evidenceSound,event.target.checked)}/> Enter the current standing-wave field</label><p>The retained modal physics gives each centre its native planetary drive. The pinned identity and transit reading orients the wave fields around their fixed centres. When you enable the activity policy in Form and clock, its native composition participates too.</p><details><summary>Presentation rule and limits</summary><p>This selected presentation multiplies evaluated force strength and spin by each centre’s share of the original ten-planet total. Unrouted and unresolved shares remain unassigned. Zero-share emitters are absent. The standing-wave option keeps independent resident modes using the authored medium and this selected drive-share policy. It sums time-averaged vibration forces in the existing particle medium; it does not claim audio-rate phase, chakra activation, inter-oscillator energy transfer, or a canonical personal material law. Activity joins only through an explicitly selected native policy and source-bound successful operations.</p></details>{evidenceChannel&&<button onClick={close}>Return to the living field</button>}</section><IdentityComposition reading={reading} disabled={!!busy||stopping} onUsePolicy={policy=>{change({...draft,encoding_policy:policy});setEditing(true);setView('identity');}} onUseComposition={policy=>{change({...draft,composition_policy:policy});setEditing(true);setView('identity');}}/></>}
   {view==='form'&&<NaraM3 onPresent={presentForm} presented={!!formReading&&(host.formPresentationCurrent?.(formReading)??true)} basis={toolBasis} selectionKey={toolSelectionKey} current={nativeCurrent} disabled={!!busy||stopping||!ready} onCurrent={receivePersonalCurrent}/>}
   {view==='atlas'&&<CoordinateAtlas host={host} disabled={!!busy||stopping||!ready} identity={selected}/>}
   {view==='conversation'&&<div className="nara-conversation-layout"><aside><p className="nara-personal-caption">Here, in this Expression</p><h2>{selected?.reading.profile.name||'Choose your identity'}</h2><p>{entity?`Selected: ${entity.title}`:'No centre is selected.'}</p><p className="nara-personal-muted">{selected?'The conversation follows the saved person and actual selected subject.':'Calculate, review and save your identity to continue.'}</p><div className="nara-personal-actions"><button aria-pressed={role==='nara'} disabled={!!busy||stopping} onClick={()=>chooseRole('nara')}>Nara</button><button aria-pressed={role==='epii'} disabled={!!busy||stopping} onClick={()=>chooseRole('epii')}>Ask Epii</button></div></aside><section className="nara-conversation" aria-label={`${role==='nara'?'Nara':'Epii'} conversation`}>
    <p role="status">{native?.state==='TurnInFlight'?'Responding…':native?.state==='Resident'?'Connected':state?.dialogue?'Recorded conversation':'Conversation opens on first send'}</p>
    {state?.dialogue&&native?.state==='Disconnected'&&<button onClick={()=>void act('Reconnecting',async()=>{await dialogue('reconnect');})}>Reconnect this conversation</button>}
    <div className="nara-history-actions">{state?.conversation?.more&&<button disabled={!!busy} onClick={()=>void act('Reading earlier messages',async()=>{const cursor=Math.min(...state.conversation!.blocks.map(b=>b.id));await dialogue('read',cursor);setBefore(cursor);})}>Earlier messages</button>}{before!==undefined&&<button disabled={!!busy} onClick={()=>void act('Reading latest messages',async()=>{await dialogue('read');setBefore(undefined);})}>Latest messages</button>}</div>
    <ol>{runs.map(b=>b.kind==='user'||b.kind==='assistant'?<li key={b.id} className={b.kind==='user'?'from-person':'from-nara'}><span>{b.kind==='user'?'You':role==='nara'?'Nara':'Epii'}</span>{b.kind==='assistant'&&role==='epii'?<details><summary>Source Inspect</summary><pre>{b.text}</pre></details>:<p>{b.kind==='user'?questionText(b.text):answerText(b.text)}</p>}{completedAnswers.has(b.id)&&role==='epii'&&<EpiiReview basis={toolBasis} answerBlockId={b.id} selectionKey={toolSelectionKey} disabled={!!busy||stopping} acceptNativeDocument={host.acceptNativeDocument}/>}{completedAnswers.has(b.id)&&<NaraAnswerReturnTools basis={toolBasis} role={role} selectionKey={toolSelectionKey} visible={visible&&view==='conversation'} disabled={!!busy} answerBlockId={b.id} acceptKeptAnswer={host.acceptKeptAnswer}/>}</li>:b.kind==='error'||b.kind==='cancelled'?<li key={b.id} className="nara-turn-outcome" role={failureText(b.text)==='Cancelled'?'status':'alert'}>{failureText(b.text)==='Cancelled'?'You stopped this response.':failureText(b.text)}</li>:null)}</ol>
    {role==='epii'&&<p>Investigate the adopted coordinate with Epii. This sends the selected scene’s native subject and relation references for a source-bearing proposal; review any focus change before accepting it. Choose a profile in Coordinates first.</p>}<form onSubmit={e=>{e.preventDefault();if(!stopping)send();}}><label htmlFor="nara-instrument-question" className="nara-sr-only">Message {role==='nara'?'Nara':'Epii'}</label><textarea id="nara-instrument-question" value={question} onChange={e=>setQuestion(e.target.value)} placeholder={entity?`Ask about ${entity.title}`:'Ask about your identity or this Expression'} rows={3}/><div className="nara-personal-actions"><button className="nara-primary" disabled={!!busy||stopping||!selected||!question.trim()||native?.state==='TurnInFlight'}>{role==='epii'?'Request inquiry':'Send'}</button>{(voiceActive||native?.state==='TurnInFlight'||native?.state==='InterruptRequested'||busy.startsWith('Sending to')||stopping||stopFailed)&&<button type="button" disabled={stopping} onClick={()=>void stopResponse()}>{stopping?'Stopping…':stopFailed?'Retry stop':'Stop response'}</button>}</div></form>
    <NaraVoiceTools ref={voiceTools} basis={toolBasis} role={role} selectionKey={toolSelectionKey} visible={visible&&view==='conversation'} disabled={!!busy||stopping} running={native?.state==='TurnInFlight'} answerBlockId={latestAnswer} composerEmpty={!question.trim()} receiveTranscript={setQuestion} onActivityChange={setVoiceActive} onSpeechAdmitted={(block,response)=>expressiveActTools.current?.speechAdmitted(block,response)} onSpeechCompleted={async block=>{await expressiveActTools.current?.speechCompleted(block);}} onSpeechInterrupted={()=>expressiveActTools.current?.cancelPending()}/>
   </section></div>}
   <NaraKeptAnswerTools basis={toolBasis} role={role} selectionKey={toolSelectionKey} visible={visible&&view==='conversation'} disabled={!!busy||stopping} readKeptAnswer={async answer=>{await host.readKeptAnswer(answer);close();}}/>
   <NaraExpressiveActTools ref={expressiveActTools} basis={toolBasis} naraRef={selected?.reading.profile.nara_ref??null} answerBlockId={latestAnswer} selectionKey={toolSelectionKey} visible={visible&&view==='conversation'&&role==='nara'} disabled={!!busy||stopping||native?.state==='TurnInFlight'} acceptNativeDocument={host.acceptNativeDocument} stopSpeech={stopResponse}/>
  </div>
 </section>;
}

/** One private instrument aperture over the one existing live Expression. */
export function installNaraInstrument(host:NaraInstrumentHost){
 const container=document.createElement('div');container.className='nara-instrument-aperture';container.hidden=true;document.body.append(container);
 const trigger=document.createElement('button');trigger.type='button';trigger.className='text-button nara-instrument-trigger';trigger.textContent='Nara';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','nara-instrument');container.id='nara-instrument';document.querySelector('#app .header-actions')?.prepend(trigger);
 const root=createRoot(container);let visible=false,requestedView:View|undefined,viewRevision=0,hostRevision=0,destroyed=false;
 const app=document.getElementById('app'),wasInert=app?.inert??false;
 const render=()=>root.render(<NaraInstrument host={host} close={close} visible={visible} requestedView={requestedView} viewRevision={viewRevision} hostRevision={hostRevision}/>);
 const close=()=>{visible=false;container.hidden=true;if(app)app.inert=wasInert;trigger.setAttribute('aria-expanded','false');document.body.classList.remove('nara-depth-open');render();trigger.focus();};
 const open=(view?:View)=>{if(view){requestedView=view;viewRevision++;}visible=true;container.hidden=false;if(app)app.inert=true;trigger.setAttribute('aria-expanded','true');document.body.classList.add('nara-depth-open');render();requestAnimationFrame(()=>container.querySelector<HTMLElement>('select,button')?.focus());};
 render();trigger.addEventListener('click',()=>visible?close():open());
 const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&visible){e.preventDefault();e.stopPropagation();close();}};container.addEventListener('keydown',key);
 return {open,close,refresh(){if(!destroyed){hostRevision++;render();}},destroy(){destroyed=true;root.unmount();host.presentEvidence?.(null);host.presentForm?.(null);if(app)app.inert=wasInert;container.remove();trigger.remove();document.body.classList.remove('nara-depth-open');}};
}
