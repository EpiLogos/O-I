/** Task controls adapted from retained Cradle VisualsView and CredentialsSection.
 * Native operation identities and acknowledgement types are reused verbatim.
 * Unbound controls never manufacture a saved value or credential presence. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { THEMES } from '../../../../oi-design-system/themes/index.mjs'
import type { SettingsAdapter } from './adapter'
import type { KernelOp, PresentationDocument, PresentationTheme } from '../../../../../desktop/cradle/src/kernel/types'

async function operation(adapter: SettingsAdapter, op: KernelOp, expected: string) {
  if (!adapter.invoke) throw new Error('The native owner operation is not connected.')
  const response = await adapter.invoke(op)
  if (response.error || response.outcome?.result !== expected) throw new Error(response.error ?? `The owner did not acknowledge ${op.op}.`)
  return response.outcome
}

export function AppearancePreferences({adapter}:{adapter:SettingsAdapter}) {
  const [reading,setReading]=useState<PresentationDocument|null>(null)
  const [draft,setDraft]=useState<PresentationTheme|null>(null)
  const draftBasis=useRef<{epoch?:string;theme:string}|null>(null)
  const [pending,setPending]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [message,setMessage]=useState<string|null>(null)
  const file=useRef<HTMLInputElement>(null)
  const generation=useRef(0)
  const current=useRef(adapter);current.current=adapter
  const read=async()=>{
    const epoch=++generation.current;const source=adapter
    setPending(true);setError(null)
    try{const answer=await operation(source,{op:'presentation_read'},'presentation_reading');if(epoch===generation.current&&current.current===source&&answer.result==='presentation_reading')setReading(answer.document)}
    catch(cause){if(epoch===generation.current)setError(cause instanceof Error?cause.message:String(cause))}
    finally{if(epoch===generation.current)setPending(false)}
  }
  useEffect(()=>{setReading(null);setError(null);setMessage(null);setPending(false);if(adapter.invoke)void read();return()=>{++generation.current}},[adapter,adapter.ownerEpoch])
  const apply=async(op:KernelOp)=>{
    const epoch=generation.current;const source=adapter
    setPending(true);setError(null);setMessage(null)
    try {
      if (op.op === 'theme_apply' && draft) {
        const heldBasis = draftBasis.current
        if (!heldBasis || heldBasis.epoch !== source.ownerEpoch) {
          throw new Error('The appearance owner changed. Keep the draft on the current reading before applying.')
        }
        const basis = await operation(source, {op: 'presentation_read'}, 'presentation_reading')
        if (epoch !== generation.current || current.current !== source) return
        if (basis.result === 'presentation_reading' && JSON.stringify(basis.document.theme) !== heldBasis.theme) {
          setReading(basis.document)
          throw new Error('The saved appearance changed. Your draft is retained; inspect and keep it on the current reading before applying.')
        }
      }
      const answer = await operation(source, op, 'presentation_reading')
      if (epoch !== generation.current || current.current !== source) return
      if (answer.result === 'presentation_reading') {
        setReading(answer.document)
        setDraft(null)
        setMessage('Acknowledged by the appearance owner. This window’s renderer observation remains a separate reading.')
      }
    }
    catch(cause){if(epoch===generation.current)setError(cause instanceof Error?cause.message:String(cause))}
    finally{if(epoch===generation.current)setPending(false)}
  }
  const library=[...(adapter.themeLibrary??THEMES),...(reading?.custom_themes??[])]
  const selected=draft??reading?.theme
  const propose=(theme:PresentationTheme)=>{if(!draft)draftBasis.current={epoch:adapter.ownerEpoch,theme:JSON.stringify(reading?.theme)};setDraft(theme);setMessage(null)}
  const stale=!!draft&&(draftBasis.current?.epoch!==adapter.ownerEpoch||draftBasis.current?.theme!==JSON.stringify(reading?.theme))
  const disabled=pending||!reading||!adapter.invoke
  return <section className="owner-preferences" aria-label="Appearance preferences">
    <section className="preference-group"><h3 className="preference-group-title">Appearance</h3>
      <div className="preference-row"><div className="preference-label"><h3>Appearance</h3><span className="preference-origin">This installation · native presentation owner</span></div><div className="preference-value"><select aria-label="Appearance" value={selected?.id? 'library':selected?.appearance??''} disabled={disabled} onChange={e=>propose({appearance:e.target.value as PresentationTheme['appearance'],id:null})}><option value="" disabled>Not read</option><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>{selected?.id&&<option value="library">Library theme</option>}</select></div></div>
      {library.length>0&&<div className="preference-theme-library" role="group" aria-label="Theme library">{library.map(theme=><button type="button" key={theme.id} disabled={disabled} aria-pressed={selected?.id===theme.id} onClick={()=>propose({id:theme.id,appearance:theme.appearance})}><span className="preference-theme-swatch" style={{background:theme.preview.ground,color:theme.preview.ink}}><b>Aa</b><i style={{background:theme.preview.accent}}/></span><span>{theme.name}</span></button>)}</div>}
      <div className="owner-actions">{draft&&<><button type="button" disabled={disabled} onClick={()=>void apply({op:'theme_apply',...draft})}>Apply appearance</button><button type="button" disabled={pending} onClick={()=>setDraft(null)}>Undo draft</button></>}<button type="button" disabled={disabled} onClick={()=>void apply({op:'theme_revert'})}>Follow system</button><button type="button" disabled={disabled||!adapter.importTheme} onClick={()=>file.current?.click()}>Import a theme file…</button><input ref={file} hidden type="file" accept=".json,.jsonc,application/json" aria-label="Import a theme file" onChange={async e=>{const picked=e.target.files?.[0];e.target.value='';const importTheme=adapter.importTheme;if(!picked||!importTheme)return;const source=adapter;const epoch=generation.current;setPending(true);setError(null);try{const document=await importTheme(await picked.text(),picked.name);if(epoch===generation.current&&current.current===source){setReading(document);setMessage('Theme import acknowledged by the appearance owner.')}}catch(cause){if(epoch===generation.current)setError(cause instanceof Error?cause.message:String(cause))}finally{if(epoch===generation.current)setPending(false)}}}/></div>
      {stale&&<div role="alert" className="settings-alert">The appearance basis changed; your local choice is retained.<button type="button" disabled={disabled} onClick={()=>{draftBasis.current={epoch:adapter.ownerEpoch,theme:JSON.stringify(reading?.theme)};setError(null);setMessage('Draft rebased on the current saved appearance. Review it before Apply.')}}>Keep draft on current reading</button></div>}
      {reading?.custom_themes.length? <details className="preference-inspection"><summary>Manage imported themes</summary>{reading.custom_themes.map(theme=><ImportedTheme key={theme.id} theme={theme} disabled={disabled} onRemove={()=>apply({op:'theme_remove',id:theme.id})}/>)}</details>:null}
      <p className="owner-note">Light, Dark and System use the retained presentation contract. Imported VS Code themes go through Cradle’s existing converter and validator.</p>
      {!adapter.invoke&&<p className="owner-note">Saved appearance has not been read. Connect <code>presentation_read</code> and the existing theme operations.</p>}
      {pending&&<p role="status" className="owner-note">Waiting for appearance owner…</p>}{error&&<div className="settings-alert" role="alert">{error}<button type="button" disabled={pending} onClick={()=>void read()}>Read again</button></div>}{message&&<p role="status" className="settings-notice">{message}</p>}
      <details className="preference-inspection"><summary>Saved appearance and renderer observations</summary><dl><dt>Saved preference</dt><dd>{reading?`${reading.theme.appearance}${reading.theme.id?` · ${reading.theme.id}`:''}`:'Not read'}</dd><dt>Proposed preference</dt><dd>{draft?`${draft.appearance}${draft.id?` · ${draft.id}`:''}`:'None'}</dd><dt>Native revision</dt><dd>{reading?.revision??'Not read'}</dd><dt>Observation</dt><dd>{reading?`${Object.keys(reading.observations).length} advisory renderer readings`:'Not read'}</dd><dt>Applies</dt><dd>After native acknowledgement and renderer projection.</dd></dl></details>
    </section>
    <OpeningPreferences adapter={adapter}/>
    <section className="preference-group"><h3 className="preference-group-title">Expressions</h3><p className="owner-note">Scene, glyph, material, physics and musical controls belong in their working editors.</p><button type="button" disabled={!adapter.navigate} onClick={()=>adapter.navigate?.({kind:'editor',native_ref:'expressions'})}>Open Expressions</button></section>
  </section>
}

function ImportedTheme({theme,disabled,onRemove}:{theme:{id:string;name:string};disabled:boolean;onRemove:()=>Promise<void>}) {
  const [confirm,setConfirm]=useState(false)
  return <div className="owner-actions"><span>{theme.name}</span>{confirm?<><span>Remove this imported theme through the native owner?</span><button type="button" disabled={disabled} onClick={()=>void onRemove().then(()=>setConfirm(false))}>Remove theme</button><button type="button" disabled={disabled} onClick={()=>setConfirm(false)}>Cancel</button></>:<button type="button" disabled={disabled} onClick={()=>setConfirm(true)}>Remove…</button>}</div>
}
const absentVisuals={enabled:false,welcomeEnabled:false}
const noVisualSubscription=()=>()=>{}
const noVisualSnapshot=()=>absentVisuals
function OpeningPreferences({adapter}:{adapter:SettingsAdapter}) {
  const store=adapter.visualPreferences
  const snapshot=useSyncExternalStore(store?.subscribe??noVisualSubscription,store?.getSnapshot??noVisualSnapshot)
  return <section className="preference-group"><h3 className="preference-group-title">Opening</h3>{[
    {key:'enabled' as const,title:'Visual layer',help:'Show the retained visual layer in this installation.',set:store?.setEnabled},
    {key:'welcomeEnabled' as const,title:'Welcome scene',help:'Show the retained welcome scene when opening the application.',set:store?.setWelcomeEnabled},
  ].map(row=><div className="preference-row" key={row.key}><div className="preference-label"><h3>{row.title}</h3><span className="preference-origin">{row.help}</span></div><div className="preference-value">{store?<label className="settings-toggle"><input type="checkbox" aria-label={row.title} checked={snapshot[row.key]} onChange={e=>row.set?.(e.target.checked)}/>{snapshot[row.key]?'On':'Off'}</label>:<span className="settings-muted">Not read</span>}</div></div>)}<p className="owner-note">These controls use Cradle’s existing renderer preference store. Changes apply immediately in subscribed renderers. {store?'':'The host has not connected that store.'}</p></section>
}

interface Credential { credential: string; provider: string; reference: string|null; revoked: boolean; verifiedAt: number|null }
/** Accept only metadata fields. Material and unknown payloads never enter UI state. */
export function credentialMetadata(value:unknown):Credential[] {
  if(!value||typeof value!=='object')throw new Error('The credential owner did not return metadata.')
  const rows=(value as {bindings?:unknown}).bindings
  if(!Array.isArray(rows))throw new Error('The credential metadata did not include its binding list.')
  return rows.flatMap(row=>{if(!row||typeof row!=='object')throw new Error('A credential metadata row is invalid.');const r=row as Record<string,unknown>;const credential=typeof r.credential_ref==='string'?r.credential_ref:typeof r.credential==='string'?r.credential:null;if(!credential)throw new Error('A credential binding has no native identity.');return [{credential,provider:typeof r.provider_ref==='string'?r.provider_ref:credential,reference:typeof r.declared_secret_ref==='string'?r.declared_secret_ref:null,revoked:r.revoked===true,verifiedAt:typeof r.last_verified_at_unix_seconds==='number'?r.last_verified_at_unix_seconds:null}]})
}
export function CredentialPreferences({adapter}:{adapter:SettingsAdapter}) {
  const [credentials,setCredentials]=useState<Credential[]>([])
  const [reading,setReading]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [target,setTarget]=useState('')
  const [discovery,setDiscovery]=useState<number|null>(null)
  const generation=useRef(0)
  const current=useRef(adapter);current.current=adapter
  const refresh=async()=>{const epoch=generation.current;const source=adapter;setReading(true);setError(null);try{const answer=await operation(source,{op:'credential_list'},'credential_reading');if(epoch===generation.current&&current.current===source&&answer.result==='credential_reading')setCredentials(credentialMetadata(answer.data))}catch(cause){if(epoch===generation.current)setError(cause instanceof Error?cause.message:String(cause))}finally{if(epoch===generation.current)setReading(false)}}
  useEffect(()=>{++generation.current;setCredentials([]);setDiscovery(null);setError(null);setReading(false);if(adapter.invoke)void refresh();return()=>{++generation.current}},[adapter,adapter.ownerEpoch])
  const discover=async()=>{const epoch=generation.current,source=adapter;setReading(true);setError(null);setDiscovery(null);try{const answer=await operation(source,{op:'credential_discover'},'credential_reading');if(epoch!==generation.current||source!==current.current)return;if(answer.result==='credential_reading'){const findings=(answer.data as {findings?:unknown})?.findings;if(!Array.isArray(findings))throw new Error('The credential owner did not return discovery findings.');setDiscovery(findings.length)}}catch{if(epoch===generation.current)setError('Credential discovery did not complete. Inspect the owner’s redacted diagnostic.')}finally{if(epoch===generation.current)setReading(false)}}
  return <section className="owner-preferences" aria-label="Credential connections"><h3 className="preference-group-title">Provider connections</h3><p className="owner-note">Stored references, presence and verification are separate from a running provider connection. Secret material is never displayed.</p>
    {!adapter.invoke&&<p className="owner-note">Credential metadata has not been read. The retained <code>credential_list</code>, setup, rotate, verify and revoke operations require the native owner.</p>}{reading&&<p role="status" className="owner-note">Reading credential metadata…</p>}{error&&<div className="settings-alert" role="alert">{error}<button type="button" disabled={reading} onClick={()=>void refresh()}>Retry</button></div>}
    <div className="owner-actions"><button type="button" disabled={!adapter.invoke||reading} onClick={()=>void discover()}>Discover credential references</button></div>{discovery!==null&&<p role="status" className="owner-note">Native discovery reports {discovery} findings. Choose the native binding or stored reference to configure; discovery changes no preference.</p>}
    {credentials.map(credential=><CredentialConnection key={credential.credential} adapter={adapter} credential={credential} onRefresh={refresh}/>)}
    {adapter.invoke&&!reading&&!error&&!credentials.length&&<p className="owner-note">The owner reports no configured credential bindings.</p>}
    <details className="preference-inspection"><summary>Add a native credential binding</summary><div className="owner-actions"><input aria-label="Native credential identity" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Native credential reference" disabled={!adapter.invoke}/></div>{target.trim()&&<CredentialConnection adapter={adapter} credential={{credential:target.trim(),provider:target.trim(),reference:null,revoked:false,verifiedAt:null}} newBinding onRefresh={refresh}/>}</details>
  </section>
}
function CredentialConnection({adapter,credential,newBinding=false,onRefresh}:{adapter:SettingsAdapter;credential:Credential;newBinding?:boolean;onRefresh:()=>Promise<void>}) {
  const [editing,setEditing]=useState(newBinding)
  const [materialEntry,setMaterialEntry]=useState(false)
  const [reference,setReference]=useState('')
  const [pending,setPending]=useState(false)
  const [confirmRevoke,setConfirmRevoke]=useState(false)
  const [result,setResult]=useState<string|null>(null)
  const field=useRef<HTMLInputElement>(null)
  const source=useRef(adapter);source.current=adapter
  useEffect(()=>{if(field.current)field.current.value='';setReference('');setMaterialEntry(false);setResult(null);setPending(false);setConfirmRevoke(false);setEditing(newBinding)},[adapter,adapter.ownerEpoch])
  const run=async(op:KernelOp,expected:string,done:string)=>{const origin=adapter;setPending(true);setResult(null);try{const answer=await operation(origin,op,expected);if(source.current!==origin)return;if(answer.result==='credential_verified'){const data=answer.data as {verdict?:unknown};setResult(['working','refused','unreachable'].includes(String(data?.verdict))?`Verification: ${data.verdict}`:'Verification acknowledged; verdict was not reported.')}else{setResult(done);setEditing(false);setReference('')}await onRefresh()}catch{if(source.current===origin)setResult('The native owner did not complete this credential operation. The entered secret is cleared; inspect the owner’s redacted diagnostic.')}finally{if(source.current===origin)setPending(false)}}
  return <section className="preference-connection" aria-label={credential.provider}><div className="preference-row"><div className="preference-label"><h3>{credential.provider}</h3><span className="preference-origin">{newBinding?'New binding':credential.revoked?'Revoked':'Configured'}{credential.reference?` · ${credential.reference}`:''}</span></div><div className="preference-value">{!newBinding&&<><button type="button" disabled={pending||!adapter.invoke} onClick={()=>void run({op:'credential_verify',credential:credential.credential},'credential_verified','')}>Verify</button><button type="button" disabled={pending||!adapter.invoke} onClick={()=>setEditing(on=>!on)}>Rotate…</button><button type="button" disabled={pending||!adapter.invoke} onClick={()=>setConfirmRevoke(true)}>Revoke…</button></>}</div></div>
    {editing&&<form className="owner-credential-form" onSubmit={e=>{e.preventDefault();const input=field.current;const material=input?.value??'';if(input)input.value='';const value=materialEntry?material:reference.trim();if(!value.trim())return;void run({op:newBinding?'credential_setup':'credential_rotate',credential:credential.credential,...(materialEntry?{material:value}:{reference:value})},'credential_changed','Native owner acknowledged the binding. Providers may require reconnect.')}}><label>Entry<select aria-label={`${credential.provider} entry method`} disabled={pending} value={materialEntry?'material':'reference'} onChange={e=>setMaterialEntry(e.target.value==='material')}><option value="reference">Stored secret reference</option><option value="material" disabled={!adapter.canEnterCredentialMaterial}>Write-only key{!adapter.canEnterCredentialMaterial?' · native capability required':''}</option></select></label>{materialEntry?<input ref={field} type="password" autoComplete="off" spellCheck={false} aria-label={`${credential.provider} write-only key`} placeholder="Key is cleared before submission"/>:<input value={reference} onChange={e=>setReference(e.target.value)} aria-label={`${credential.provider} stored secret reference`} autoComplete="off" spellCheck={false} placeholder="keychain:// · op:// · varlock:// · pass://"/>}<button type="submit" disabled={pending||!adapter.invoke}>Send to credential owner</button><button type="button" disabled={pending} onClick={()=>{if(field.current)field.current.value='';setEditing(false);setReference('')}}>Cancel</button></form>}
    {confirmRevoke&&<div className="owner-actions"><span>Revoke this binding? The stored secret is kept.</span><button type="button" disabled={pending} onClick={()=>{setConfirmRevoke(false);void run({op:'credential_revoke',credential:credential.credential},'credential_changed','Native owner acknowledged revocation.')}}>Revoke binding</button><button type="button" onClick={()=>setConfirmRevoke(false)}>Cancel</button></div>}
    {pending&&<p role="status" className="owner-note">Waiting for credential owner…</p>}{result&&<p role="status" className="owner-note">{result}</p>}<details className="preference-inspection"><summary>Connection details</summary><dl><dt>Native identity</dt><dd>{credential.credential}</dd><dt>Last verification</dt><dd>{credential.verifiedAt?new Date(credential.verifiedAt*1000).toLocaleString():'Not reported'}</dd><dt>Runtime connection</dt><dd>Read and reconnect at the conversation’s provider control.</dd></dl></details>
  </section>
}
