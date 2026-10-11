/** Development host for the actual registered contribution. No backend stand-in. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsPanel } from '../panels/settings'
import { SettingsEntry, SettingsPageEntry } from './SettingsEntry'
import { unavailableSettingsAdapter, type SettingsRequest } from './adapter'
import { configureSettingsHost, openSettings } from './host'
import { specimenProject } from './development'
import '../styles.css'

function WindowPreview() {
  const requestedWidth=Number(new URLSearchParams(location.search).get('settings-width'))
  const developmentWidth=Number.isInteger(requestedWidth)&&requestedWidth>=320&&requestedWidth<=1024?requestedWidth:null
  const [visible, setVisible] = useState(false)
  const [draft, setDraft] = useState('Retained conversation draft')
  const origin = useRef<HTMLElement | null>(null)
  const adapter = useMemo(() => unavailableSettingsAdapter(), [])
  useEffect(() => {
    configureSettingsHost(adapter, () => {
      setVisible(false)
      requestAnimationFrame(() => origin.current?.focus())
    })
  }, [adapter])
  const open = (request: SettingsRequest | null) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openSettings(request)
    setVisible(true)
  }
  return <div className="frame" style={{display:'block',height:'100vh',padding:24,boxSizing:'border-box',overflow:'auto'}}>
    {developmentWidth&&<style>{`.settings-window{width:min(${developmentWidth}px,100%)}`}</style>}
    <h2>Preferences window · development check</h2>
    <p>This route mounts the actual <code>world.settings</code> contribution. The labelled scenario supplies non-secret specimens; no native writes occur.</p>
    <label>Conversation draft <input aria-label="Conversation draft" value={draft} onChange={event=>setDraft(event.target.value)} style={{display:'block',width:'min(360px,100%)',margin:'12px 0'}}/></label>
    <p>Selection: specimen agent · project settings-specimen</p>
    <div className="owner-actions"><button type="button" onClick={()=>open(null)}>Open Preferences</button><SettingsEntry setting_ref="ai-kit:skills:skills.capabilities" scope={specimenProject} returnLabel="Agent setup" onOpen={open}>Configure this agent’s capabilities…</SettingsEntry><SettingsPageEntry page="machines" scope={{scope_kind:'workcell',scope_ref:'workcell:settings-specimen'}} returnLabel="Start work" onOpen={open}>Remote machine setup…</SettingsPageEntry><SettingsPageEntry page="automations" scope={specimenProject} returnLabel="Agent activity" onOpen={open}>Manage automations…</SettingsPageEntry></div>
    <div className="inhabitant" hidden={!visible}><SettingsPanel/></div>
  </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<WindowPreview/>)
else document.getElementById('root')!.textContent='Development preview is unavailable in production.'
