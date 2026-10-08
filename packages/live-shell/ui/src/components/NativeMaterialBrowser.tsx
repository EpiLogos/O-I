import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {createCradleOwners} from '@epilogos/expressions-boundary/cradle'
import {listNativeMaterials, type BindingInput, type MaterialListing, type MaterialListResult} from '../../../../expressions-boundary/src/nativeMaterials'
import {useWorkspace} from '../shell/workspace'
import {materialCompatibility, materialRowVisible, selectionSlot} from './nativeBrowserModel'
import {sceneReuseForm} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/reuse'
import './NativeMaterialBrowser.css'

/** Browser definitions are discovered by the native material register. Perform
 * binds that source at the retained editor's captured native destination. */
export function NativeMaterialBrowser({query, detailHost, onCount}: {query: string; detailHost?: HTMLElement | null; onCount?: (count: number) => void}) {
  const workspace=useWorkspace(), current=useRef(workspace)
  current.current=workspace
  const [listing,setListing]=useState<MaterialListResult|null>(null)
  const [selected,setSelected]=useState<MaterialListing|null>(null)
  const selectedAccess=useRef<{workspaceId:string;epoch:number}|null>(null)
  const [kind,setKind]=useState('')
  const [state,setState]=useState('')
  const [bindings,setBindings]=useState<BindingInput[]>([])
  const [duration,setDuration]=useState('1.5')
  const [refresh,setRefresh]=useState(0)
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [fault,setFault]=useState<string|null>(null)
  const [notice,setNotice]=useState<string|null>(null)
  const [retainedOutcome,setRetainedOutcome]=useState<{copy?:string;outcome?:unknown}|null>(null)
  const [showAll,setShowAll]=useState(false)
  const [saveTitle,setSaveTitle]=useState('')
  const [saved,setSaved]=useState<{copy:string;location:string|null}|null>(null)
  const generation=useRef(0)
  const {transport,accessEpoch,accessReady,workspaceId}=workspace
  useEffect(()=>{
    const epoch=++generation.current, abort=new AbortController()
    setListing(null);setLoading(false);setFault(null)
    if(!accessReady||transport.kind==='unavailable')return
    const valid=()=>generation.current===epoch&&current.current.workspaceId===workspaceId&&current.current.nativeAccessCurrent(accessEpoch)
    const owners=createCradleOwners(transport,{project:'',isCurrent:valid})
    setLoading(true)
    void listNativeMaterials(request=>owners.channels['kernel-expression-world'](request,{mode:'expressions',bindingId:`material-browser:${workspaceId}`,epoch:accessEpoch,signal:abort.signal,state:current.current.reading,current:valid}))
      .then(value=>{if(valid())setListing(value)})
      .catch(error=>{if(valid())setFault(error instanceof Error?error.message:String(error))})
      .finally(()=>{if(valid())setLoading(false)})
    return()=>{++generation.current;abort.abort()}
  },[transport,accessReady,accessEpoch,workspaceId,refresh])
  const choose=(material:MaterialListing)=>{
    selectedAccess.current={workspaceId,epoch:accessEpoch}
    setSelected(material);setState(material.preview_state??'');setNotice(null);setFault(null);setRetainedOutcome(null)
    setBindings(material.roles.map(role=>({role:role.role,accepts:role.accepts})))
  }
  const editBinding=(index:number,values:Partial<BindingInput>)=>setBindings(rows=>rows.map((row,i)=>i===index?{...row,...values}:row))
  const sourceCurrent=!!selected&&selectedAccess.current?.workspaceId===workspaceId&&selectedAccess.current.epoch===accessEpoch&&!!listing?.materials.some(material=>material.file_ref===selected.file_ref&&material.revision===selected.revision)
  const admitted=sourceCurrent&&!!workspace.editor&&!!workspace.editorReading&&!workspace.editorReading.standing.pending&&workspace.nativeAccessCurrent(accessEpoch)
  async function perform(play:boolean) {
    if(!admitted||!selected||busy)return
    const editor=workspace.editor!,basis=structuredClone(workspace.editorReading!.basis),material=structuredClone(selected)
    const transition=Number(duration)
    if(!duration.trim()||!Number.isFinite(transition)||transition<0||transition>3600){setFault('Transition must be between 0 and 3600 seconds.');return}
    setBusy(true);setFault(null);setNotice(null)
    try {
      const input={material:{file_ref:material.file_ref,revision:material.revision,...(state?{state}:material.entry_scene_ref?{scene_ref:material.entry_scene_ref}:{})},bindings:structuredClone(bindings),transition:{duration:transition,easing:'smoothstep'}}
      const result=await editor.request({operation:'material',basis,action:play?'play':'perform',input})
      if(!result.ok){setRetainedOutcome({copy:result.retained_copy_ref,outcome:result.native_outcome});throw Error(result.error)}
      if(result.material?.kind!=='performed')throw Error('The native owner omitted its material performance receipt')
      const receipt=result.material.receipt
      setNotice(receipt.followed?'Performed into the native work.':'Native performance acknowledged; newer local work is retained. Refresh to follow when it is reconciled.')
    } catch(error){setFault(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }
  async function openSource() {
    if(!selected||!sourceCurrent||!accessReady||busy)return
    const material=selected,epoch=accessEpoch,id=workspaceId
    setBusy(true);setFault(null)
    try {
      const intent={workspaceId:id,viewId:workspace.prepareSource(material.location),generation:generation.current,
        isCurrent:()=>current.current.workspaceId===id&&current.current.nativeAccessCurrent(epoch)}
      const source=await workspace.resources.read(material.location,intent)
      if(source.location.ref!==material.file_ref||source.revision!==material.revision)throw Error('The material file advanced; refresh before opening this captured source')
      workspace.publishSource(source,intent)
    }catch(error){setFault(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }
  /** Save the open native Scene as reusable material: the same saveReusable owner as Perform, addressed by its native ref. */
  async function saveCurrent() {
    const editor=workspace.editor,reading=workspace.editorReading
    if(!editor||!reading||reading.standing.pending||busy)return
    setBusy(true);setFault(null);setSaved(null)
    try {
      const form=sceneReuseForm(saveTitle,reading.basis.scene_ref,reading.scenes?.scenes??[])
      const result=await editor.request({operation:'material',basis:structuredClone(reading.basis),action:'save-reusable',input:{form}})
      if(!result.ok){setRetainedOutcome({copy:result.retained_copy_ref,outcome:result.native_outcome});throw Error(result.error)}
      if(result.material?.kind!=='saved')throw Error('The native owner omitted its saved-material receipt')
      setSaved({copy:result.material.receipt.copy_ref,location:result.material.receipt.outcome.file?.location.path??null})
      setSaveTitle('');setRefresh(value=>value+1)
    } catch(error){setFault(error instanceof Error?error.message:String(error))}
    finally{setBusy(false)}
  }
  const needle=query.trim().toLocaleLowerCase()
  const slot=selectionSlot(workspace.editorReading)
  const compat=(material:MaterialListing)=>materialCompatibility(material.roles,slot)
  const materials=(listing?.materials??[]).filter(material=>(!kind||material.kind===kind)&&(!needle||`${material.title} ${material.kind}`.toLocaleLowerCase().includes(needle))&&materialRowVisible(compat(material),showAll,selected?.file_ref===material.file_ref))
  const report=useRef(onCount);report.current=onCount
  useEffect(()=>{report.current?.(materials.length)},[materials.length])
  const characters=(listing?.materials??[]).filter(material=>material.kind==='character')
  const preview = selected &&<div className="native-material-preview">
      <strong>{selected.title}</strong><span>{selected.kind}</span>
      <button type="button" disabled={busy||!sourceCurrent||!accessReady} onClick={()=>void openSource()}>Open source</button>
      {Object.keys(selected.states).length>0&&<label>State <select value={state} disabled={busy} onChange={event=>setState(event.target.value)}><option value="">Entry scene</option>{Object.keys(selected.states).map(value=><option key={value}>{value}</option>)}</select></label>}
      {bindings.map((row,index)=><fieldset key={row.role} disabled={busy}><legend>{row.role} · {row.accepts}</legend>
        {row.accepts==='text'?<label>Text <input value={row.text??''} onChange={event=>editBinding(index,{text:event.target.value})}/></label>
          :row.accepts==='value'?<label>Value <input type="number" value={row.value??''} onChange={event=>editBinding(index,{value:event.target.value===''?undefined:Number(event.target.value)})}/></label>
          :<><label>Character <select value={row.character_ref??''} onChange={event=>{const character=characters.find(value=>value.file_ref===event.target.value);editBinding(index,{character_ref:character?.file_ref,character_revision:character?.revision})}}><option value="">Authored body</option>{characters.map(character=><option key={character.file_ref} value={character.file_ref}>{character.title}</option>)}</select></label><label>Label <input value={row.label??''} onChange={event=>editBinding(index,{label:event.target.value})}/></label><label>Glyph <input value={row.glyph??''} onChange={event=>editBinding(index,{glyph:event.target.value})}/></label></>}
      </fieldset>)}
      <label>Transition (s) <input type="number" min="0" max="3600" step="0.1" value={duration} disabled={busy} onChange={event=>setDuration(event.target.value)}/></label>
      <div className="native-material-actions"><button type="button" disabled={busy||!admitted} onClick={()=>void perform(false)}>Perform</button>{selected.playback.length>0&&<button type="button" disabled={busy||!admitted} onClick={()=>void perform(true)}>Play passages</button>}</div>
      {!admitted&&<p className="native-empty">{sourceCurrent?'Open a native work to choose a destination.':'Choose the current source again to use this retained material draft.'}</p>}
    </div>;
  return <section className="native-material-browser" aria-label="Reusable native material">
    <header><h3>Material</h3><button type="button" disabled={loading||busy||!accessReady} aria-label="Refresh native material" onClick={()=>setRefresh(value=>value+1)}>↻</button></header>
    <div className="native-material-filter"><label className="native-material-kind">Kind <select value={kind} onChange={event=>setKind(event.target.value)}><option value="">All</option>{['character','scene','expression','gesture'].map(value=><option key={value}>{value}</option>)}</select></label>
      {slot&&<><small className="native-material-basis">Fits {slot.name} ({slot.slot})</small><button type="button" className="native-material-showall" aria-pressed={showAll} title="Show materials whose roles do not fit the selected object, marked" onClick={()=>setShowAll(value=>!value)}>Show all</button></>}</div>
    <details className="native-material-save"><summary>Save current Scene as reusable…</summary>
      <label>Name <input value={saveTitle} maxLength={256} disabled={busy} placeholder="Title" onChange={event=>setSaveTitle(event.target.value)}/></label>
      <button type="button" disabled={busy||!workspace.editor||!workspace.editorReading||workspace.editorReading.standing.pending||!saveTitle.trim()} onClick={()=>void saveCurrent()}>Save as reusable</button>
      {saved&&<p role="status">Saved <code>{saved.copy}</code>{saved.location?<> at <code>{saved.location}</code></>:null}</p>}
    </details>
    {loading&&<p role="status">Reading native material…</p>}
    {fault&&<p className="native-error" role="alert">{fault}</p>}
    {retainedOutcome&&(retainedOutcome.copy||retainedOutcome.outcome!==undefined)&&<details><summary>Retained native outcome</summary>{retainedOutcome.copy&&<p>Copy: <code>{retainedOutcome.copy}</code></p>}{retainedOutcome.outcome!==undefined&&<pre>{JSON.stringify(retainedOutcome.outcome,null,2)}</pre>}</details>}
    {notice&&<p role="status">{notice}</p>}
    <ul>{materials.map(material=>{const state=compat(material),reason=state.state==='incompatible'?state.reason:undefined;return <li key={material.file_ref}><button type="button" data-browser-row className={`world-file-row${selected?.file_ref===material.file_ref?' selected':''}${reason?' is-incompatible':''}`} disabled={busy} onClick={()=>choose(material)} onKeyDown={event=>{if(event.key===' '){event.preventDefault();choose(material)}}} onKeyUp={event=>{if(event.key===' ')event.preventDefault()}} title={`${material.kind} · ${material.file_ref} · ${material.revision}${reason?`\n${reason}`:''}`} aria-pressed={selected?.file_ref===material.file_ref}><span aria-hidden="true">◇</span><span>{material.title}</span>{reason&&<small className="native-material-mark">Incompatible</small>}</button></li>})}</ul>
    {listing&&!materials.length&&<p className="native-empty">No material matches.</p>}
    {!!listing?.unreadable.length&&<details><summary>{listing.unreadable.length} unreadable sources</summary>{listing.unreadable.map((item,i)=><p key={i}>{item.path??item.file_ref}: {item.error}</p>)}</details>}
    {listing?.truncated&&<p role="status">The native register disclosed a bounded page.</p>}
    {detailHost ? createPortal(preview, detailHost) : preview}
  </section>
}
