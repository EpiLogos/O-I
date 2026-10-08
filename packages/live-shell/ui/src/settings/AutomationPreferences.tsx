import { useEffect, useId, useRef, useState } from 'react'
import type { SettingsAdapter, ScopeAddress } from './adapter'
import { routineList, object, actionMessage, nextOccurrenceTimes } from '../../../../../desktop/cradle/src/contributions/automations/client'
import type { RoutineRequest, RoutineList, RoutineDetail, MethodRow, Invocation } from '../../../../../desktop/cradle/src/contributions/automations/client'
import { authorityAllowsTrigger, eligibleProofs, routineBasis, scheduleFromInput } from './routines'
import {ScheduleControl} from './ScheduleControl'
import type { RoutineAuthoringOptions, RoutineAuthoringResult, RoutineCreateInput, ScheduleShape } from './routines'

type View='mine'|'methods'|'history'|'timers'
type Form={name:string;description:string;method:string;proof:string;trigger:string;authority:string;profile:string;scopes:string[]}
const blank=():Form=>({name:'',description:'',method:'',proof:'',trigger:'',authority:'',profile:'',scopes:[]})
export function AutomationPreferences({adapter,scope,scopeRequestId}:{adapter:SettingsAdapter;scope?:ScopeAddress|null;scopeRequestId?:string}) {
  const id=useId(),epoch=useRef(0),adapterRef=useRef(adapter);adapterRef.current=adapter
  const [view,setView]=useState<View>('mine'),[project,setProject]=useState<string|undefined>(scope?.scope_kind==='project'?scope.scope_ref??undefined:undefined)
  const [reading,setReading]=useState<RoutineList|null>(null),[methods,setMethods]=useState<MethodRow[]|null>(null),[history,setHistory]=useState<Invocation[]|null>(null)
  const [selected,setSelected]=useState<string|null>(null),[detail,setDetail]=useState<RoutineDetail|null>(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<{status:RoutineAuthoringResult['status'];message:string}|null>(null),[revision,setRevision]=useState(0)
  const [form,setForm]=useState<Form|null>(null),[options,setOptions]=useState<RoutineAuthoringOptions|null>(null),[optionsError,setOptionsError]=useState<string|null>(null),[enableOptions,setEnableOptions]=useState<RoutineAuthoringOptions|null>(null),[enableAuthority,setEnableAuthority]=useState('')
  const ownerKey=JSON.stringify([adapter.ownerEpoch??adapter.kind,project??null])
  const [formOwner,setFormOwner]=useState<string|null>(null)
  const staleForm=!!form&&formOwner!==ownerKey
  const [scheduleKind,setScheduleKind]=useState<ScheduleShape['kind']>('daily'),[scheduleValue,setScheduleValue]=useState(''),[preparedSchedule,setPreparedSchedule]=useState(false),[reproof,setReproof]=useState('')
  const [pendingCreation,setPendingCreation]=useState<RoutineAuthoringResult|null>(null)
  const requestedScope=useRef(scopeRequestId??JSON.stringify(scope??null)),waitingScope=useRef<{key:string;project:string|undefined}|null>(null)
  const [review,setReview]=useState<RoutineCreateInput|null>(null),[confirmation,setConfirmation]=useState<'disable'|'run_now'|null>(null)
  const nameRef=useRef<HTMLInputElement>(null),newRef=useRef<HTMLButtonElement>(null)
  function current(captured:SettingsAdapter,at:number){return captured===adapterRef.current&&at===epoch.current}
  async function request(source:SettingsAdapter,request:RoutineRequest){if(!source.invoke)throw new Error('Automations have not been connected.');const result=await source.invoke({op:'routine',project,request});if(result.error||result.outcome?.result!=='routine')throw new Error('AIKit did not return this routine operation.');return result.outcome.data}
  useEffect(()=>{
    if(!scope)return
    const key=scopeRequestId??JSON.stringify(scope),next=scope.scope_kind==='project'?scope.scope_ref??undefined:undefined
    if(key===requestedScope.current&&!waitingScope.current)return
    if(form&&next!==project){waitingScope.current={key,project:next};setError('The requested work context differs from this unsaved routine. Finish or cancel the draft before changing its work context.');return}
    requestedScope.current=key;waitingScope.current=null;setProject(next)
  },[scope?.scope_kind,scope?.scope_ref,scopeRequestId,!!form])
  useEffect(()=>{const at=++epoch.current,source=adapter;setReading(null);setMethods(null);setHistory(null);setDetail(null);setSelected(null);setOptions(null);setEnableOptions(null);setReview(null);setConfirmation(null);setBusy(false);setError(null)
    if(source.invoke)void Promise.allSettled([request(source,{action:'list'}),request(source,{action:'methods'})]).then(([r,m])=>{if(!current(source,at))return
      try{if(r.status==='fulfilled')setReading(routineList(r.value));else throw r.reason
        if(m.status==='fulfilled'){const rows=object(m.value).methods;if(!Array.isArray(rows)||rows.some(row=>typeof row?.id!=='string'||typeof row?.name!=='string'))throw new Error();setMethods(rows as MethodRow[])}else throw m.reason
      }catch{setError('AIKit could not read routines or Methods. Retry; an unavailable read is not an empty list.')}
    });return()=>{++epoch.current}
  },[adapter,adapter.ownerEpoch,project,revision])
  useEffect(()=>{let live=true;setDetail(null);setEnableOptions(null);setEnableAuthority('');setConfirmation(null);if(!selected)return
    const source=adapter,at=epoch.current
    void request(source,{action:'show',routine_ref:selected}).then(async value=>{if(!live||!current(source,at))return;if(object(value).routine!==selected)throw new Error();const next=value as RoutineDetail;setDetail(next)
      if(source.routineAuthoring){const options=await source.routineAuthoring.options(next.method,project);if(live&&current(source,at))setEnableOptions(options)}
    }).catch(()=>{if(live&&current(source,at))setError('This routine could not be read. Retry before running or changing it.')});return()=>{live=false}
  },[selected,adapter,adapter.ownerEpoch,project])
  useEffect(()=>{if(view!=='history'||!adapter.invoke)return;let live=true;const source=adapter,at=epoch.current
    void request(source,{action:'history'}).then(value=>{if(!live||!current(source,at))return;if(!Array.isArray(value)||value.some(row=>typeof row?.invocation_ref!=='string'))throw new Error();setHistory(value as Invocation[])}).catch(()=>{if(live&&current(source,at))setError('Invocation history could not be read.')});return()=>{live=false}
  },[view,adapter,adapter.ownerEpoch,project,revision])
  useEffect(()=>{let live=true;setOptions(null);setOptionsError(null);setReview(null);if(!form?.method||!adapter.routineAuthoring)return
    const source=adapter,at=epoch.current;void source.routineAuthoring!.options(form.method,project).then(value=>{if(live&&current(source,at))setOptions(value)}).catch(()=>{if(live&&current(source,at))setOptionsError('Verified runs, schedules and authority could not be read. Your draft is retained.')});return()=>{live=false}
  },[form?.method,adapter,adapter.ownerEpoch,project,revision])
  useEffect(()=>{if(form)nameRef.current?.focus()},[form!==null])
  useEffect(()=>{const prevent=(event:BeforeUnloadEvent)=>{if(form){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)},[!!form])
  function edit(next:Partial<Form>){setForm(old=>old?{...old,...next}:old);setReview(null);setNotice(null)}
  async function reviewCreate(){if(!form||!options||staleForm||busy||pendingCreation)return
    const source=adapter,at=epoch.current,proof=eligibleProofs(options,form.method).find(row=>row.document.proof_ref===form.proof)?.document,authority=options.authorities.find(row=>row.document.authority_ref===form.authority)?.document
    let trigger=options.triggers.find(row=>triggerKey(row.document)===form.trigger)?.document
    if(!form.name.trim()||!proof||!authority||!trigger&&form.trigger!=='new-schedule'){setOptionsError('Choose a name, a verified Method run, a trigger and a native authority receipt.');return}
    setBusy(true);setOptionsError(null)
    try{
      if(form.trigger==='new-schedule'){
        if(!source.routineAuthoring?.prepareSchedule)throw new Error('The native schedule preparation operation is not connected.')
        trigger=await source.routineAuthoring.prepareSchedule(scheduleFromInput(scheduleKind,scheduleValue),project)
        if(!current(source,at))return
        if(trigger.schema!=='aikit.time-schedule/v1'||!trigger.schedule_ref)throw new Error('AIKit did not return a native schedule identity.')
      }
      setPreparedSchedule(form.trigger==='new-schedule');setReview({name:form.name.trim(),description:form.description,method:form.method,proof,trigger:trigger!,authority,agent_profile:form.profile||null,context_scope:form.scopes})
    }catch(failure){if(current(source,at))setOptionsError(failure instanceof Error?failure.message:'Schedule preparation was not acknowledged. Your draft is retained.')}
    finally{if(current(source,at))setBusy(false)}
  }

  async function create(){if(!review||!adapter.routineAuthoring||busy||staleForm||pendingCreation)return;const source=adapter,at=epoch.current,input=review;setBusy(true);setError(null);setNotice(null)
    try{const fresh=await source.routineAuthoring!.options(input.method,project);if(!current(source,at))return
      const proof=eligibleProofs(fresh,input.method).find(row=>row.document.proof_ref===input.proof.proof_ref)?.document,authority=fresh.authorities.find(row=>row.document.authority_ref===input.authority.authority_ref)?.document,trigger=fresh.triggers.find(row=>triggerKey(row.document)===triggerKey(input.trigger))?.document
      if(JSON.stringify(proof)!==JSON.stringify(input.proof)||JSON.stringify(authority)!==JSON.stringify(input.authority)||!preparedSchedule&&JSON.stringify(trigger)!==JSON.stringify(input.trigger)||input.agent_profile&&!fresh.profiles.some(row=>row.ref===input.agent_profile)||input.context_scope.some(ref=>!fresh.contextScopes.some(row=>row.ref===ref))){setReview(null);setOptionsError('The selected proof, trigger or authority changed. Choose from the current native reading and review again. Your draft is retained.');return}
      const result=await source.routineAuthoring!.create(input,project);if(!current(source,at))return;setNotice({status:result.status,message:`${result.status==='pending'?'Awaiting acknowledgement':result.status} · ${result.message}`})
      if(result.status==='pending')setPendingCreation(result)
      if(result.status==='acknowledged'){setPendingCreation(null);setForm(null);setReview(null);setRevision(value=>value+1)}
    }catch{if(current(source,at))setError('AIKit did not acknowledge creation. Your unsaved routine is retained. Read current routines before retrying.')}
    finally{if(current(source,at))setBusy(false)}
  }
  async function checkCreation(){
    if(!pendingCreation||!adapter.routineAuthoring?.readResult||busy||staleForm)return
    const source=adapter,at=epoch.current;setBusy(true);setError(null)
    try{
      const result=await source.routineAuthoring!.readResult!(pendingCreation,project);if(!current(source,at))return
      setNotice({status:result.status,message:`${result.status==='pending'?'Awaiting acknowledgement':result.status} · ${result.message}`})
      setPendingCreation(result.status==='pending'?result:null)
      if(result.status==='acknowledged'){setForm(null);setReview(null);setRevision(value=>value+1)}
    }catch{if(current(source,at))setError('The creation result could not be read. The submitted draft is kept; it has not been submitted again.')}
    finally{if(current(source,at))setBusy(false)}
  }
  async function act(action:'disable'|'run_now'|'enable'|'reprove'){if(!selected||!detail||busy)return;const source=adapter,at=epoch.current;setBusy(true);setError(null);setNotice(null)
    try{const fresh=await request(source,{action:'show',routine_ref:selected});if(!current(source,at))return
      if(routineBasis(fresh)!==routineBasis(detail)){setDetail(fresh as RoutineDetail);setConfirmation(null);setError('The routine changed after it was read. Review its current state before retrying.');return}
      if(action==='reprove'){
        if(!source.routineAuthoring?.reprove||!enableOptions)throw new Error();const options=await source.routineAuthoring.options(detail.method,project);if(!current(source,at))return;const proof=eligibleProofs(options,detail.method).find(row=>row.document.proof_ref===reproof)?.document,held=eligibleProofs(enableOptions,detail.method).find(row=>row.document.proof_ref===reproof)?.document
        if(!proof||JSON.stringify(proof)!==JSON.stringify(held)){setEnableOptions(options);setReproof('');setError('The verified run changed. Choose the current proof and retry.');return}
        const result=await source.routineAuthoring.reprove(selected,proof,project);if(!current(source,at))return;setNotice({status:result.status,message:`${result.status==='pending'?'Awaiting acknowledgement':result.status} · ${result.message}`});if(result.status!=='acknowledged')return
      }else if(action==='enable'){
        if(!source.routineAuthoring||!enableOptions)throw new Error();const held=enableOptions.authorities.find(row=>row.document.authority_ref===enableAuthority)?.document
        const options=await source.routineAuthoring.options(detail.method,project);if(!current(source,at))return;const latest=options.authorities.find(row=>row.document.authority_ref===enableAuthority)?.document
        const unattended=detail.trigger.kind!=='manual';if(!held||JSON.stringify(held)!==JSON.stringify(latest)||!held.granted||unattended&&!held.unattended){setEnableOptions(options);setEnableAuthority('');setError('The authority receipt changed or does not permit this trigger. Choose its current authority and retry.');return}
        const result=await source.routineAuthoring.enable(selected,held,project);if(!current(source,at))return;setNotice({status:result.status,message:`${result.status==='pending'?'Awaiting acknowledgement':result.status} · ${result.message}`});if(result.status!=='acknowledged')return
      }else {const value=await request(source,{action,routine_ref:selected});if(!current(source,at))return;setNotice({status:object(object(value).outcome).status==='failed'?'failed':object(object(value).outcome).status==='unreturned'?'pending':'acknowledged',message:actionMessage(value)})}
      const value=await request(source,{action:'show',routine_ref:selected});if(!current(source,at))return;setDetail(value as RoutineDetail);setConfirmation(null)
      const list=await request(source,{action:'list'});if(current(source,at))setReading(routineList(list))
    }catch{if(current(source,at))setError('AIKit did not acknowledge this operation. Read the current routine before retrying.')}
    finally{if(current(source,at))setBusy(false)}
  }
  const selectedAuthority=enableOptions?.authorities.find(row=>row.document.authority_ref===enableAuthority)?.document
  const canEnable=!!selectedAuthority&&selectedAuthority.granted&&(detail?.trigger.kind==='manual'||selectedAuthority.unattended)
  return <section className="owner-preferences" aria-label="Automations" tabIndex={-1}>
    <div className="automation-toolbar"><label>Work context <select aria-label="Automation work context" value={project??''} disabled={busy||!!form} onChange={event=>setProject(event.target.value||undefined)}><option value="">This AIKit home</option>{adapter.scopeChoices?.filter(choice=>choice.address.scope_kind==='project'&&choice.address.scope_ref).map(choice=><option key={choice.address.scope_ref} value={choice.address.scope_ref!}>{choice.title}</option>)}</select></label><button type="button" disabled={busy||!adapter.invoke} onClick={()=>setRevision(value=>value+1)}>Read again</button></div>
    <div className="automation-tabs" role="group" aria-label="Automation views">{(['mine','methods','history','timers'] as View[]).map(value=><button type="button" key={value} aria-pressed={view===value} onClick={()=>setView(value)}>{{mine:'My routines',methods:'Methods',history:'Run history',timers:'Harness timers'}[value]}</button>)}</div>
    {!adapter.invoke&&<p className="preference-connection-note">Automations are awaiting the native AIKit connection. No routines have been read or run.</p>}
    {error&&<p className="settings-alert" role="alert">{error}</p>}{notice&&<p className={notice.status==='acknowledged'?'settings-notice':'settings-alert'} role="status">{notice.message}</p>}
    <div hidden={view!=='mine'}>
      <div className="owner-actions"><button ref={newRef} type="button" disabled={!!form||busy} onClick={()=>{setForm(blank());setFormOwner(ownerKey);setPendingCreation(null);setOptionsError(null);setNotice(null)}}>Create routine…</button></div>
      {form&&<form className="machine-form" aria-label="Create routine" onSubmit={event=>{event.preventDefault();reviewCreate()}}>
        {staleForm&&<p className="settings-alert" role="alert">The work context or native connection changed. This routine remains a local draft.<button type="button" disabled={busy||!options||!!pendingCreation} onClick={()=>{setFormOwner(ownerKey);setReview(null)}}>Review draft in this context</button></p>}
        <div className="machine-field"><label htmlFor={`${id}-name`}>Name</label><input ref={nameRef} id={`${id}-name`} value={form.name} disabled={busy||!!pendingCreation} onChange={event=>edit({name:event.target.value})}/></div>
        <div className="machine-field"><label htmlFor={`${id}-method`}>Method</label><select id={`${id}-method`} disabled={busy||!!pendingCreation} value={form.method} onChange={event=>edit({method:event.target.value,proof:'',trigger:'',authority:'',profile:'',scopes:[]})}><option value="">Choose an active Method…</option>{methods?.filter(row=>row.active).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
        <div className="machine-field"><label htmlFor={`${id}-description`}>Purpose (optional)</label><input id={`${id}-description`} value={form.description} disabled={busy||!!pendingCreation} onChange={event=>edit({description:event.target.value})}/></div>
        {form.method&&<>
          <div className="machine-field"><label htmlFor={`${id}-proof`}>Verified run</label><select id={`${id}-proof`} disabled={busy||!options||!!pendingCreation} value={form.proof} onChange={event=>edit({proof:event.target.value})}><option value="">Choose a successful, verified run…</option>{options&&eligibleProofs(options,form.method).map(row=><option key={row.document.proof_ref} value={row.document.proof_ref}>{row.title}</option>)}</select><small>AIKit checks the exact Method revision and recorded verification. If no run is available, run and verify the Method in its working context.</small></div>
          <div className="machine-field"><label htmlFor={`${id}-trigger`}>When to run</label><select id={`${id}-trigger`} disabled={busy||!options||!!pendingCreation} value={form.trigger} onChange={event=>edit({trigger:event.target.value})}><option value="">Choose a native schedule or trigger…</option><option value="new-schedule">New schedule…</option>{options?.triggers.map(row=><option key={triggerKey(row.document)} value={triggerKey(row.document)}>{row.title}</option>)}</select><small>Schedules use Central’s civil-time policy. Event sources must be admitted by their connector.</small></div>
          {form.trigger==='new-schedule'&&<ScheduleControl kind={scheduleKind} value={scheduleValue} timezone={options?.timePolicy?.timezone} disabled={busy||!!pendingCreation} onChange={(kind,value)=>{setScheduleKind(kind);setScheduleValue(value);setReview(null)}}/>}
          <div className="machine-field"><label htmlFor={`${id}-authority`}>Allowed actions</label><select id={`${id}-authority`} disabled={busy||!options||!!pendingCreation} value={form.authority} onChange={event=>edit({authority:event.target.value})}><option value="">Choose a native authority receipt…</option>{options?.authorities.map(row=><option key={row.document.authority_ref} value={row.document.authority_ref}>{row.title}</option>)}</select></div>
          <details className="preference-inspection"><summary>Agent and context</summary><div className="machine-field"><label htmlFor={`${id}-profile`}>Agent profile</label><select id={`${id}-profile`} value={form.profile} disabled={busy||!options||!!pendingCreation} onChange={event=>edit({profile:event.target.value})}><option value="">No profile override</option>{options?.profiles.map(row=><option key={row.ref} value={row.ref}>{row.title}</option>)}</select></div><fieldset disabled={busy||!options||!!pendingCreation}><legend>Context scopes</legend>{options?.contextScopes.map(row=><label key={row.ref} className="settings-switch"><input type="checkbox" checked={form.scopes.includes(row.ref)} onChange={event=>edit({scopes:event.target.checked?[...form.scopes,row.ref]:form.scopes.filter(ref=>ref!==row.ref)})}/>{row.title}</label>)}</fieldset></details>
        </>}
        {!adapter.routineAuthoring&&<p className="owner-note">Create and Enable await the native verified-run and authority selection adapter. Your draft remains local.</p>}{optionsError&&<p role="alert" className="settings-field-error">{optionsError}</p>}
        <div className="owner-actions"><button type="submit" disabled={busy||!options||staleForm||!!pendingCreation}>Review creation</button><button type="button" disabled={busy} onClick={()=>{setForm(null);setReview(null);setPendingCreation(null);requestAnimationFrame(()=>newRef.current?.focus())}}>Cancel draft</button><span className="settings-muted">Unsaved routine · created routines start in Draft</span></div>
        {pendingCreation&&<p className="settings-alert" role="status">Creation is awaiting its result. This draft cannot be submitted again. Closing it does not cancel the native operation.{adapter.routineAuthoring?.readResult&&<button type="button" disabled={busy||staleForm} onClick={()=>void checkCreation()}>Check creation result</button>}</p>}
        {review&&<section className="settings-review" aria-label="Review routine creation"><h3>Create {review.name}</h3><p>{methods?.find(row=>row.id===review.method)?.name} · {options?.triggers.find(row=>triggerKey(row.document)===triggerKey(review.trigger))?.title}</p><p>This creates a Draft. Enabling unattended work is a separate action using a current authority receipt.</p><details><summary>Verification and allowed actions</summary><p>Verified revision: {review.proof.method_revision}</p><p>{review.authority.action_refs.join(', ')||'No actions granted'}</p><p>{authorityAllowsTrigger(review.authority,review.trigger)?'The receipt permits this trigger.':'This receipt does not yet permit enabling this trigger.'}</p></details><button type="button" disabled={busy||!!pendingCreation} onClick={()=>void create()}>{busy?'Creating…':'Create routine'}</button><button type="button" disabled={busy||!!pendingCreation} onClick={()=>setReview(null)}>Back to editing</button></section>}
      </form>}
      {adapter.invoke&&reading===null&&!error&&<p role="status">Reading routines…</p>}
      {reading?.routines.length===0&&<p className="owner-note">No routines in this AIKit home. Create one from a Method that has been run and verified.</p>}
      <div className="automation-columns"><nav aria-label="My routines">{reading?.routines.map(row=><button type="button" className="automation-row" key={row.routine} aria-current={selected===row.routine?'page':undefined} onClick={()=>{setSelected(row.routine);setNotice(null)}}><strong>{row.name}</strong><span>{row.state.replaceAll('-',' ')} · {row.trigger.kind}</span></button>)}</nav>{detail&&<section aria-label="Selected routine"><h3>{detail.name}</h3><p className="owner-note">{detail.state.replaceAll('-',' ')}{detail.scheduler?` · Scheduler ${detail.scheduler.observed_state}`:''}</p>{detail.state==='stale-proof'&&<><p className="settings-alert">The Method changed. Reprove its current revision, then explicitly enable again.</p><div className="machine-field"><label htmlFor={`${id}-reproof`}>Verified current run</label><select id={`${id}-reproof`} value={reproof} disabled={busy||!enableOptions} onChange={event=>setReproof(event.target.value)}><option value="">Choose a current verified run…</option>{enableOptions&&eligibleProofs(enableOptions,detail.method).map(row=><option key={row.document.proof_ref} value={row.document.proof_ref}>{row.title}</option>)}</select><button type="button" disabled={busy||!reproof||!adapter.routineAuthoring?.reprove} onClick={()=>void act('reprove')}>Reprove Method</button></div></>}<div className="owner-actions"><button type="button" disabled={busy||detail.state!=='enabled'} onClick={()=>setConfirmation('run_now')}>Run now…</button><button type="button" disabled={busy||detail.state==='disabled'} onClick={()=>setConfirmation('disable')}>Disable…</button></div>
        {detail.state!=='enabled'&&<div className="machine-field"><label htmlFor={`${id}-enable`}>Authority for enabling</label><select id={`${id}-enable`} disabled={busy||!enableOptions||detail.state==='stale-proof'} value={enableAuthority} onChange={event=>setEnableAuthority(event.target.value)}><option value="">Choose current allowed actions…</option>{enableOptions?.authorities.map(row=><option key={row.document.authority_ref} value={row.document.authority_ref}>{row.title}</option>)}</select><button type="button" disabled={busy||!canEnable||detail.state==='stale-proof'} onClick={()=>void act('enable')}>Enable routine</button>{!adapter.routineAuthoring&&<small>Native authority selection is awaiting connection.</small>}</div>}
        {detail.trigger.kind==='schedule'&&<div className="automation-occurrences"><strong>Next runs</strong>{detail.occurrence_error?<p role="status">The schedule could not be resolved.</p>:!Array.isArray(object(detail.next_occurrences).occurrences)?<p>Next runs have not been resolved.</p>:nextOccurrenceTimes(detail.next_occurrences).length?<ul>{nextOccurrenceTimes(detail.next_occurrences).slice(0,4).map(time=><li key={time}>{time}</li>)}</ul>:<p>No occurrence in the owner’s next 24-hour window.</p>}</div>}
        {confirmation&&<section className="settings-review" aria-label="Confirm routine action"><h3>{confirmation==='run_now'?'Run this routine now?':'Disable this routine?'}</h3><p>{confirmation==='run_now'?'Runs the verified Method with its native authority. It may perform the actions named by its receipt.':'Stops future admitted runs. It does not cancel an invocation already dispatched.'}</p><button type="button" disabled={busy} onClick={()=>void act(confirmation)}>{confirmation==='run_now'?'Run now':'Disable routine'}</button><button type="button" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button></section>}
        <details className="preference-inspection"><summary>Method, verification and allowed actions</summary><p>{methods?.find(row=>row.id===detail.method)?.payload??detail.method_body??'Method text was not disclosed.'}</p><dl><dt>Method</dt><dd>{detail.method}</dd><dt>Verified revision</dt><dd>{detail.method_revision}</dd><dt>Proof</dt><dd>{detail.proof?.proof_ref??'Not disclosed'}</dd><dt>Authority</dt><dd>{detail.authority?.granted?'Granted':'Not granted'}{detail.authority?.unattended?' · unattended':''}</dd></dl></details>
      </section>}</div>
    </div>
    <div hidden={view!=='methods'}>{methods?.map(row=><section className="machine-card" key={row.id}><h3>{row.name}</h3><p className="owner-note">{row.payload}</p><button type="button" disabled={!row.active||busy||!!form} onClick={()=>{setForm({...blank(),method:row.id});setFormOwner(ownerKey);setView('mine')}}>Use this Method…</button></section>)}</div>
    <div hidden={view!=='history'}>{adapter.invoke&&history===null&&!error&&<p role="status">Reading run history…</p>}{history?.length===0&&<p>No admitted invocations.</p>}{history?.map(row=><section className="machine-card" key={row.invocation_ref}><h3>{reading?.routines.find(routine=>routine.routine===row.routine_ref)?.name??'Routine invocation'}</h3><p className="owner-note">{row.trigger_observed_at}</p><p>{actionMessage({outcome:row.outcome})}</p><details className="preference-inspection"><summary>Invocation and deliveries</summary><p>{row.invocation_ref}</p><p>{row.method_ref}</p>{row.provider_deliveries?.map(delivery=><p key={delivery.delivery_ref}>{delivery.provider} · {delivery.delivery_ref}</p>)}</details></section>)}</div>
    <div hidden={view!=='timers'}><p className="owner-note">Harness timers remain with their provider until explicitly adopted with a proven Method. This page does not silently migrate or disable them.</p>{reading?.foreign_reconciliation.providers.map(provider=><section className="preference-group" key={provider.provider}><h3>{provider.provider}</h3>{!provider.jobs.length&&<p className="owner-note">No timers found.</p>}{provider.jobs.map(job=><section className="machine-card" key={job.job_id}><h3>{job.name??'Unnamed timer'}</h3><p className="owner-note">{job.active?'Active':'Inactive'} · {job.reconciled?'Adopted as a Routine':'Awaiting adoption'}</p>{job.reason&&<details className="preference-inspection"><summary>Adoption requirement</summary><p>{job.reason}</p></details>}</section>)}</section>)}</div>
  </section>
}
function triggerKey(value:unknown){const row=object(value);return typeof row.schedule_ref==='string'?row.schedule_ref:typeof row.event_ref==='string'?row.event_ref:typeof row.trigger_ref==='string'?row.trigger_ref:String(row.kind??'')}
