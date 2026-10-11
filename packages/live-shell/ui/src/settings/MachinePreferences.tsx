import { useEffect, useId, useRef, useState } from 'react'
import type { SettingsAdapter } from './adapter'
import { connectionBasis, machineBasis, validateMachine } from './machines'
import type { MachineConnection, MachineOperationResult, RemoteMachineDeclaration } from './machines'

const empty = (): RemoteMachineDeclaration => ({label:'',endpoint:'',credential_ref:null,operations:[],note:null})
export function MachinePreferences({adapter,requestedScope}:{adapter:SettingsAdapter;requestedScope?:import('./adapter').ScopeAddress|null}) {
  const source=adapter.remoteMachines, id=useId()
  const [machines,setMachines]=useState<RemoteMachineDeclaration[]|null>(null),[connections,setConnections]=useState<MachineConnection[]|null>(null)
  const [draft,setDraft]=useState<RemoteMachineDeclaration|null>(null),[touched,setTouched]=useState(false)
  const ownerKey=JSON.stringify([adapter.ownerEpoch??adapter.kind,source?.scope??null])
  const [draftOwner,setDraftOwner]=useState<string|null>(null)
  const staleDraft=!!draft&&draftOwner!==ownerKey
  const wrongScope=!!source&&!!requestedScope&&(requestedScope.scope_kind!==source.scope.scope_kind||requestedScope.scope_ref!==source.scope.scope_ref)
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[result,setResult]=useState<MachineOperationResult|null>(null)
  const [confirm,setConfirm]=useState<{action:'disconnect'|'remove';label:string}|null>(null)
  const epoch=useRef(0),sourceRef=useRef(source);sourceRef.current=source
  const formRef=useRef<HTMLInputElement>(null),addRef=useRef<HTMLButtonElement>(null)
  const errors=draft?validateMachine(draft,source?.allowedOperations??[],machines??[]):{}
  useEffect(()=>{const current=++epoch.current;setMachines(null);setConnections(null);setBusy(null);setError(null);setResult(null);setConfirm(null)
    if(source)void Promise.allSettled([source.readMachines(),source.readConnections()]).then(([declared,receipts])=>{
      if(epoch.current!==current)return
      if(declared.status==='fulfilled')setMachines(declared.value)
      if(receipts.status==='fulfilled')setConnections(receipts.value)
      if(declared.status==='rejected'||receipts.status==='rejected')setError('Workcell could not read all machine setup and connection receipts. Retry the read; unknown state is not an empty list.')
    });return()=>{++epoch.current}
  },[source,adapter.ownerEpoch])
  useEffect(()=>{if(draft)formRef.current?.focus()},[draft!==null])
  useEffect(()=>{const prevent=(event:BeforeUnloadEvent)=>{if(draft){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)},[draft!==null])
  async function refresh(){if(!source||busy)return;const current=epoch.current;setBusy('read');setError(null)
    try{const [declared,receipts]=await Promise.all([source.readMachines(),source.readConnections()]);if(current!==epoch.current)return;setMachines(declared);setConnections(receipts)}
    catch{if(current===epoch.current)setError('Workcell could not read machine setup. Your local draft is retained.')}
    finally{if(current===epoch.current)setBusy(null)}
  }
  async function run(action:'add'|'connect'|'disconnect'|'remove',label?:string){if(!source||busy||machines===null||wrongScope||action==='add'&&staleDraft)return
    const held=source,current=epoch.current,submitted=draft?structuredClone(draft):null
    if(action==='add'&&(!submitted||Object.keys(validateMachine(submitted,held.allowedOperations,machines)).length)){setTouched(true);return}
    setBusy(action);setError(null);setResult(null)
    try{
      const [fresh,receipts]=await Promise.all([held.readMachines(),held.readConnections()]);if(current!==epoch.current||sourceRef.current!==held)return
      if(machineBasis(fresh)!==machineBasis(machines)||action==='disconnect'&&connectionBasis(receipts.find(row=>row.label===label))!==connectionBasis(connections?.find(row=>row.label===label))){
        setError('Machine setup changed after this page was read. Read again to accept the current setup, then retry. Your draft is retained.');return
      }
      const response=action==='add'?await held.add(submitted!):action==='connect'?await held.connect(label!):action==='disconnect'?await held.disconnect(label!):await held.remove(label!)
      if(current!==epoch.current||sourceRef.current!==held)return
      setResult(response);setConfirm(null)
      if(response.status==='acknowledged'){
        if(action==='add')setDraft(old=>old&&JSON.stringify(old)===JSON.stringify(submitted)?null:old)
        const [declared,latest]=await Promise.all([held.readMachines(),held.readConnections()]);if(current!==epoch.current)return;setMachines(declared);setConnections(latest)
      }
    }catch{if(current===epoch.current)setError('The operation or its follow-up read failed. Read Workcell’s current state before retrying. Any unacknowledged draft is retained.')}
    finally{if(current===epoch.current)setBusy(null)}
  }
  function field(name:'label'|'endpoint'|'credential_ref'|'note',title:string,hint?:string){return <div className="machine-field"><label htmlFor={`${id}-${name}`}>{title}</label><input ref={name==='label'?formRef:undefined} id={`${id}-${name}`} value={draft?.[name]??''} autoComplete="off" spellCheck={false} disabled={!!busy} aria-invalid={touched&&!!errors[name]} aria-describedby={hint||touched&&errors[name]?`${id}-${name}-help`:undefined} onBlur={()=>setTouched(true)} onChange={event=>setDraft(old=>old?{...old,[name]:name==='label'||name==='endpoint'?event.target.value:event.target.value||null}:old)}/>{(hint||touched&&errors[name])&&<small id={`${id}-${name}-help`} className={touched&&errors[name]?'settings-field-error':''}>{touched&&errors[name]?errors[name]:hint}</small>}</div>}
  return <section className="owner-preferences" aria-label="Remote machines" tabIndex={-1}>
    <h3 className="preference-group-title">Remote machines</h3>
    <p className="owner-note">Set up a Workcell to use when starting work. Connect uses its saved credential reference; it does not grant access on the remote machine.</p>
    {source&&<p className="owner-note">Applies to this Workcell{source.scope.scope_ref?` · ${source.scope.scope_ref}`:''}.</p>}
    {!source&&<p className="preference-connection-note">Remote-machine operations are awaiting the Workcell adapter. Setup can be drafted here; no machine is saved or contacted.</p>}
    {wrongScope&&<p className="settings-alert" role="alert">The requested Workcell differs from this connection. Machine changes require the adapter for that exact Workcell.</p>}
    <div className="owner-actions"><button ref={addRef} type="button" disabled={!!draft||!!busy||wrongScope} onClick={()=>{setDraft(empty());setDraftOwner(ownerKey);setTouched(false);setResult(null)}}>Add machine…</button><button type="button" disabled={!source||!!busy} onClick={()=>void refresh()}>{busy==='read'?'Reading…':'Read machines again'}</button></div>
    {draft&&<form className="machine-form" aria-label="Add remote machine" onSubmit={event=>{event.preventDefault();setTouched(true);void run('add')}}>
      {staleDraft&&<p className="settings-alert" role="alert">The Workcell connection changed. This setup is still a local draft.<button type="button" disabled={!!busy||wrongScope||!source} onClick={()=>setDraftOwner(ownerKey)}>Use draft with this Workcell</button></p>}
      {field('label','Label','A stable name for this machine.')}{field('endpoint','Control endpoint','HOST:PORT. Use brackets around an IPv6 host.')}{field('credential_ref','Credential reference','keychain:// or linux-secret-service://. Secret material stays in its credential store.')}
      <fieldset disabled={!!busy}><legend>Expected operations</legend><p className="owner-note">Records what you expect this machine to offer. Its remote grant determines actual access.</p>{source?.allowedOperations.map(operation=><label className="settings-switch" key={operation}><input type="checkbox" checked={draft.operations.includes(operation)} onChange={event=>setDraft(old=>old?{...old,operations:event.target.checked?[...old.operations,operation]:old.operations.filter(value=>value!==operation)}:old)}/>{operation}</label>)}{!source&&<small>The native operation catalogue has not been read.</small>}{touched&&errors.operations&&<p className="settings-field-error" role="alert">{errors.operations}</p>}</fieldset>
      {field('note','Note (optional)')}
      <div className="owner-actions"><button type="submit" disabled={!source||machines===null||!!busy||staleDraft||wrongScope}>{busy==='add'?'Saving…':'Save machine setup'}</button><button type="button" disabled={!!busy} onClick={()=>{setDraft(null);setTouched(false);requestAnimationFrame(()=>addRef.current?.focus())}}>Cancel draft</button><span className="settings-muted">Unsaved setup</span></div>
    </form>}
    {error&&<p className="settings-alert" role="alert">{error}</p>}{result&&<p className={result.status==='acknowledged'?'settings-notice':'settings-alert'} role="status">{result.status==='pending'?'Awaiting acknowledgement':result.status} · {result.message}</p>}
    {source&&machines===null&&!error&&<p role="status">Reading remote machines…</p>}{machines?.length===0&&<p className="owner-note">No remote machines are declared in this Workcell.</p>}
    {machines?.map(machine=>{const connection=connections?.find(row=>row.label===machine.label);return <section className="machine-card" key={machine.label} aria-label={`Machine ${machine.label}`}><div><h3>{machine.label}</h3><p className="owner-note">{machine.endpoint}</p></div><div className="owner-actions"><button type="button" disabled={!!busy||!source||wrongScope} onClick={()=>void run('connect',machine.label)}>{busy==='connect'?'Connecting…':connection?.state==='connected'?'Reconnect':'Connect'}</button>{connection?.state==='connected'&&<button type="button" disabled={!!busy} onClick={()=>setConfirm({action:'disconnect',label:machine.label})}>Disconnect…</button>}<button type="button" disabled={!!busy} onClick={()=>setConfirm({action:'remove',label:machine.label})}>Remove setup…</button></div>
      <p className="owner-note">{connection?`Last connection result: ${connection.state} · ${new Date(connection.last_reconciled_at_unix_ms).toLocaleString()}`:connections===null?'Connection receipts have not been read.':'No connection has been recorded.'}</p>{connection?.expires_at_unix_ms&&<p className="owner-note">Grant expiry {new Date(connection.expires_at_unix_ms).toLocaleString()}.</p>}
      <details className="preference-inspection"><summary>Setup and connection details</summary><dl><dt>Expected operations</dt><dd>{machine.operations.join(', ')||'None recorded'}</dd><dt>Granted operations</dt><dd>{connection?connection.granted_operations.join(', ')||'None granted':'Not read'}</dd><dt>Credential reference</dt><dd>{machine.credential_ref??'None saved'}</dd><dt>Note</dt><dd>{machine.note??'None'}</dd>{connection&&<><dt>Protocol</dt><dd>{connection.protocol}</dd><dt>Remote software</dt><dd>{connection.remote_software??'Not disclosed'}</dd></>}</dl><p>A connection receipt records the last handshake or reconciliation. Reconnect attempts a fresh handshake.</p></details>
      {confirm?.label===machine.label&&<section className="settings-review" aria-label="Confirm machine operation"><h3>{confirm.action==='remove'?'Remove machine setup?':'Disconnect this machine?'}</h3><p>{confirm.action==='remove'?'Removes this Workcell’s declaration. It does not revoke a remote grant or delete work.':'Marks the saved connection disconnected. The receipt is kept.'}</p><button type="button" disabled={!!busy} onClick={()=>void run(confirm.action,machine.label)}>{confirm.action==='remove'?'Remove setup':'Disconnect'}</button><button type="button" disabled={!!busy} onClick={()=>setConfirm(null)}>Cancel</button></section>}
    </section>})}
    {!!connections?.filter(row=>!machines?.some(machine=>machine.label===row.label)).length&&<details className="preference-inspection"><summary>Connections without a machine declaration</summary>{connections.filter(row=>!machines?.some(machine=>machine.label===row.label)).map(row=><p key={row.connection_ref}>{row.label} · {row.state} · {row.endpoint}</p>)}</details>}
  </section>
}
