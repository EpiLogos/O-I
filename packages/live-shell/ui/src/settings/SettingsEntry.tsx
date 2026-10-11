import type { Ref, ReactNode } from 'react'
import type { ScopeAddress, SettingsRequest } from './adapter'
import { openSettings } from './host'

/** Point-of-use entrance: the exact native identity and actual subject travel
 * together. The parent captures the focused origin and retains the work. */
export function SettingsEntry({setting_ref,scope,returnLabel,children='Defaults…',onOpen=openSettings,buttonRef}:{setting_ref:string;scope:ScopeAddress|null;returnLabel:string;children?:ReactNode;buttonRef?:Ref<HTMLButtonElement>;onOpen?:(request:SettingsRequest)=>void}) {
  return <button ref={buttonRef} type="button" className="settings-context-entry" disabled={!scope} title={!scope?'Select the actual subject before opening its settings.':undefined} onClick={()=>{if(scope)onOpen({requestId:crypto.randomUUID(),setting_ref,scope,returnLabel})}}>{children}</button>
}

/** Operations have a page identity, never a fabricated configuration key. */
export function SettingsPageEntry({page,scope,returnLabel,children,onOpen=openSettings}:{page:'machines'|'automations';scope:ScopeAddress|null;returnLabel:string;children:ReactNode;onOpen?:(request:SettingsRequest)=>void}) {
  return <button type="button" className="settings-context-entry" disabled={!scope} onClick={()=>{if(scope)onOpen({requestId:crypto.randomUUID(),page,scope,returnLabel})}}>{children}</button>
}
