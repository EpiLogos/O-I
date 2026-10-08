import { registerPanel } from '../shell/panels'
import { SettingsWorkspace } from '../settings/SettingsWorkspace'
import { useSettingsHost } from '../settings/host'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createDevelopmentSettingsAdapter, developmentDrafts, scenarioNames, type DevelopmentScenario } from '../settings/development'

/** Preferences have their own usable depth even when the retained instrument
 * detail occupies most of the frame. Hiding the contribution hides the window;
 * it does not unmount its local drafts. The parent still owns entry and return. */
function SettingsPanel() {
  const host = useSettingsHost()
  const anchor = useRef<HTMLSpanElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const restoreFrame=useRef<(()=>void)|null>(null)
  const [visible, setVisible] = useState(false)
  const [scenario,setScenario] = useState<DevelopmentScenario|null>(()=>{if(!import.meta.env.DEV)return null;const requested=new URLSearchParams(location.search).get('settings-scenario');return scenarioNames.includes(requested as DevelopmentScenario)?requested as DevelopmentScenario:null})
  const development = useMemo(()=>import.meta.env.DEV&&scenario?createDevelopmentSettingsAdapter(scenario):null,[scenario])
  useEffect(() => {
    const inhabitant = anchor.current?.closest<HTMLElement>('.inhabitant')
    if (!inhabitant) return
    const check = () => setVisible(!inhabitant.hidden)
    check()
    const observer = new MutationObserver(check)
    observer.observe(inhabitant, { attributes: true, attributeFilter: ['hidden'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (visible && !host.request) dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
  }, [visible])
  useEffect(()=>{
    if(!visible)return
    const frame=anchor.current?.closest<HTMLElement>('.frame')
    if(!frame)return
    const previous=frame.inert;frame.inert=true
    const restore=()=>{frame.inert=previous}
    restoreFrame.current=restore
    return()=>{restore();if(restoreFrame.current===restore)restoreFrame.current=null}
  },[visible])
  const returnToWork=()=>{restoreFrame.current?.();host.onReturn?.()}
  return <><span ref={anchor}/>{createPortal(<div className="settings-window-layer" hidden={!visible} onPointerDown={event => { if (event.target === event.currentTarget) returnToWork() }}>
    <div ref={dialog} className="settings-window" role="dialog" aria-modal="true" aria-label="Preferences" onKeyDown={event => {
      if (event.key === 'Tab') {
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]') ?? [])].filter(element => element.getClientRects().length)
        const first = controls[0]; const last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); returnToWork() }
    }}>{scenario&&import.meta.env.DEV&&<div className="settings-development-tools"><label>Development scenario <select aria-label="Development scenario" value={scenario} onChange={e=>setScenario(e.target.value as DevelopmentScenario)}>{scenarioNames.map(name=><option key={name}>{name}</option>)}</select></label><span>Explicit preview · no native writes</span></div>}<SettingsWorkspace key={scenario??'native'} {...host} onReturn={returnToWork} adapter={development??host.adapter} initialDrafts={import.meta.env.DEV&&scenario?developmentDrafts(scenario):undefined} active={visible}/></div>
  </div>, document.body)}</>
}
registerPanel({ id: 'world.settings', title: 'Settings', icon: 'settings', slot: 'center', component: SettingsPanel, order: 90, note: 'Native configuration, scope and working defaults' })
export { SettingsPanel }
