import { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsWorkspace } from './SettingsWorkspace'
import { createDevelopmentSettingsAdapter, developmentDrafts, scenarioNames, specimenProject } from './development'
import type { DevelopmentScenario } from './development'
import '../styles.css'
import { SettingsEntry } from './SettingsEntry'
import type { SettingsRequest } from './adapter'

function Preview() {
  const [scenario,setScenario]=useState<DevelopmentScenario>('ready')
  const [inSettings,setInSettings]=useState(false)
  const [entrySequence,setEntrySequence]=useState(0)
  const [context,setContext]=useState<SettingsRequest|null>(null)
  const opener=useRef<HTMLButtonElement>(null)
  const [workDraft,setWorkDraft]=useState('Retained conversation draft')
  const adapter=useMemo(()=>createDevelopmentSettingsAdapter(scenario),[scenario])
  const initialDrafts=useMemo(()=>developmentDrafts(scenario),[scenario])
  const open=(request?:SettingsRequest)=>{setContext(request??null);setEntrySequence(n=>n+1);setInSettings(true)}
  const back=()=>{setInSettings(false);requestAnimationFrame(()=>opener.current?.focus())}
  return <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'var(--bg-1)',color:'var(--text)',font:'12px system-ui'}}><div className="settings-development-tools"><strong>Settings contribution · development only</strong><label>Scenario <select aria-label="Development scenario" value={scenario} onChange={e=>{setScenario(e.target.value as DevelopmentScenario);open()}}>{scenarioNames.map(s=><option key={s}>{s}</option>)}</select></label><button onClick={()=>inSettings?back():open()}>{inSettings?'Show retained work':'Open settings'}</button></div><div hidden={inSettings} style={{padding:24}}><h2>Agent setup · contextual entry specimen</h2><label>Conversation draft <input aria-label="Conversation draft" value={workDraft} onChange={e=>setWorkDraft(e.target.value)} style={{display:'block',width:'min(360px,100%)',margin:'12px 0'}}/></label><p>Selection: specimen agent · project settings-specimen</p><SettingsEntry buttonRef={opener} setting_ref="ai-kit:skills:skills.capabilities" scope={specimenProject} returnLabel="Agent setup" onOpen={open}>Configure this agent’s capabilities…</SettingsEntry><p>This entry uses <code>ai-kit:skills:skills.capabilities</code> at the exact project scope. The work and settings stay mounted.</p></div><div hidden={!inSettings} style={{flex:1,minHeight:0}}><SettingsWorkspace key={scenario} adapter={adapter} initialDrafts={initialDrafts} active={inSettings} request={initialDrafts[0]?{requestId:`preview-${scenario}-${entrySequence}`,setting_ref:initialDrafts[0].setting_ref,scope:initialDrafts[0].scope,returnLabel:'Agent setup'}:context} onReturn={back} /></div></div>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview/>)
else document.getElementById('root')!.textContent='Development preview is unavailable in production.'
