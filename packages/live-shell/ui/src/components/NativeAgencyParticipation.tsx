import {useState,type ReactNode} from 'react'
import {AgentLayer,type AgentAccompanying,type AgentSubject} from '../../../../../desktop/cradle/src/agent/AgentLayer'
import type {WorkspaceMode} from '../../../../../desktop/cradle/src/workspace/mode'
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import type {EncounterRow} from '../../../../../desktop/cradle/src/encounter/EncounterList'
import {NativePreparedContext} from './NativePreparedContext'
import {preparedContextScopeKey,type NativePreparedContextScope} from '../native/preparedContextBinding'

/** Presentation over the canonical Agent panel/shared native session. The
 * parent owns retained layout, native admission, provisioning and source open. */
export interface NativeAgencyParticipationProps {
  scope: NativePreparedContextScope
  current: () => boolean
  subject?: AgentSubject
  mode?: WorkspaceMode
  onAccompanying: (value: AgentAccompanying | undefined) => void
  onProvision?: (project: string,preferredBodyRef?:string) => Promise<AgentAccompanying>
  onChoose?: (row:EncounterRow,current?:()=>boolean) => Promise<void>
  onOpenSubject?: (subject: AgentSubject) => void
  onError?: (message: string) => void
  onOpenConversation?: (value: AgentAccompanying) => void
  onBringBack?: (value: AgentAccompanying) => void
  resolveSurface?: (id: string) => SurfaceBinding | undefined
  preferredBodyRef?: string
  context?: ReactNode
  full?: boolean
  onFull?: () => void
  plane?: string
  onPlane?: (plane: string) => void
  conversation?: boolean
}
export function NativeAgencyParticipation(props: NativeAgencyParticipationProps) {
  let key: string
  try { key = preparedContextScopeKey(props.scope) }
  catch (error) { return <p className="native-error" role="alert">{String(error)}</p> }
  return <ScopedNativeAgency key={key} {...props}/>
}
function ScopedNativeAgency(props: NativeAgencyParticipationProps) {
  const [ownFull,setOwnFull]=useState(false)
  const {scope,current,onOpenSubject}=props
  const context=props.context??<NativePreparedContext scope={scope} current={current} onOpenSubject={onOpenSubject}/>
  return <AgentLayer project={scope.project} sourceWorldRef={scope.sourceWorldRef} current={current}
    subject={props.subject??{title:'Retained conversation'}} accompanying={scope.accompanying}
    onAccompanying={value=>{if(current())props.onAccompanying(value)}} onProvision={props.onProvision} onChoose={props.onChoose}
    full={props.full??ownFull} onFull={props.onFull??(()=>setOwnFull(value=>!value))}
    mode={props.mode??'base'} conversation={props.conversation??true} prepareAgents
    onError={props.onError} onOpenSubject={onOpenSubject} onOpenConversation={props.onOpenConversation}
    onBringBack={props.onBringBack} resolveSurface={props.resolveSurface} preferredBodyRef={props.preferredBodyRef}
    plane={props.plane} onPlane={props.onPlane} historyAvailable={false}
    extraPlanes={[{id:'context',label:'Context',body:context}]}/>
}
