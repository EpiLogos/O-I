import type {AgentAccompanying} from './AgentLayer'
export interface AgentReceiverScope {
  project?: string
  sourceWorldRef?: string
  accompanying?: AgentAccompanying
  mode: string
  plane: string
  transport: unknown
  mounted: boolean
  visible: boolean
  current: boolean
}
export function agentReceiverKey(scope: AgentReceiverScope): string {
  return JSON.stringify([scope.transport, scope.project ?? null, scope.sourceWorldRef ?? null, scope.accompanying ?? null, scope.mode, scope.plane])
}
export function captureAgentReceiver(read: () => AgentReceiverScope): () => boolean {
  const captured = agentReceiverKey(read())
  return () => {
    const latest = read()
    return latest.mounted && latest.visible && latest.current && agentReceiverKey(latest) === captured
  }
}
export function assertAgentSessionPage(value: unknown, session: string): void {
  const page = value as {agent_session?: unknown; events?: unknown; next_cursor?: unknown; more?: unknown} | undefined
  if (!page || page.agent_session !== session || !Array.isArray(page.events) || !Number.isSafeInteger(page.next_cursor)
    || (page.next_cursor as number) < 0 || typeof page.more !== 'boolean') throw new Error('The native journal reading does not belong to the selected conversation.')
}
export function journalReceiverKey(transport:unknown,binding:{project:string;ref:string;sourceWorldRef?:string}):string {
  return JSON.stringify([transport,binding.sourceWorldRef??null,binding.project,binding.ref])
}
/** Native agent_definition Session independently rereads the source and
 * acceptance. A desired roster selection cannot rename another session. */
export function readNativeSessionProfile(value:unknown,binding:AgentAccompanying):{ref:string;name?:string;purpose?:string;revision:string}|undefined {
  const row=value as {session?:{schema?:unknown;agent_session?:unknown;space?:unknown;profile_ref?:unknown;profile_revision?:unknown;agent_ref?:unknown;provider_started?:unknown;execution_authority_granted?:unknown};source_state?:unknown;reason?:unknown;profile?:{ref?:unknown;revision?:unknown;agent_ref?:unknown;name?:unknown;purpose?:unknown}}|undefined
  if(!row||row.session===undefined)throw new Error('The native Agent session reading is unavailable.')
  if(row.session===null)return undefined
  const session=row.session
  if(session.schema!=='aikit.direct-agent-session/v1'||session.agent_session!==binding.ref||session.space!==binding.space
    ||session.provider_started!==false||session.execution_authority_granted!==false
    ||typeof session.profile_ref!=='string'||!session.profile_ref||typeof session.profile_revision!=='string'||!session.profile_revision
    ||typeof session.agent_ref!=='string'||!session.agent_ref)throw new Error('The Agent source reading belongs to another native session or authority scope.')
  if(row.source_state!=='current'){
    if(!['changed','revoked','unavailable'].includes(row.source_state as string))throw new Error('The native Agent source reading has no qualified currentness standing.')
    throw new Error(typeof row.reason==='string'&&row.reason.trim()?row.reason:`The native Agent session source is ${row.source_state}. Its original source and session have been retained; inspect them before choosing again.`)
  }
  if(!row.profile)throw new Error('The current native Agent source reading has no definition material.')
  const profile=row.profile
  if(typeof profile.agent_ref!=='string'||!profile.agent_ref||profile.agent_ref!==session.agent_ref||profile.ref!==session.profile_ref
    ||typeof profile.revision!=='string'||profile.revision!==session.profile_revision||(profile.name!==undefined&&typeof profile.name!=='string')
    ||(profile.purpose!==undefined&&typeof profile.purpose!=='string'))throw new Error('The native Agent definition does not match this session source.')
  return {ref:profile.agent_ref,revision:profile.revision,...(typeof profile.name==='string'?{name:profile.name}:{}),...(typeof profile.purpose==='string'?{purpose:profile.purpose}:{})}
}
