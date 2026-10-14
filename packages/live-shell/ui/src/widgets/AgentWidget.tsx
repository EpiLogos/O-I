// The agent you are talking to (manual §10.6; FOUNDATION F8; world-shell-mockup.html `tileBody('convo')` 1628 over
// `compBody('base','Conversation')` 1549): the real conversation, compact, in the mode in front of you — Fizz, Anima or Epii
// (shell/ModeContextDock.tsx COMPANIONS).
//
// Nothing here is a second chat. The body mounts the candidate's one conversation surface — the canonical agent panel the
// Factory thread and the Workbench conversation pane mount (components/NativeAgencyParticipation.tsx → AgentLayer →
// AgentChat) — on the session the agency reading holds (agentConversation.ts). Its transcript, its composer and its Send
// are that surface's own: the composer edits the AIKit-owned shared draft and Send prompts through the shared encounter
// session (encounter/session.ts `send`, with the prepared context when the owner takes one). With no session standing it
// says why in the owner's words, and the same surface rests on its new-conversation state: the first Send provisions a
// conversation through the owner's `encounter_provision`, on the companion's own body when the roster holds it.
import {useMemo, useState} from 'react'
import {NativeAgencyParticipation} from '../components/NativeAgencyParticipation'
import {useWorkspace} from '../shell/workspaceContext'
import {useAgencySessions} from '../agent/useAgencySessions'
import {useAgentRoster} from '../../../../../desktop/cradle/src/agency/roster'
import {useEncounterSession} from '../../../../../desktop/cradle/src/encounter/session'
import type {AgentAccompanying} from '../../../../../desktop/cradle/src/agent/AgentLayer'
import type {WorkspaceMode} from '../../../../../desktop/cradle/src/workspace/mode'
import {COMPANIONS} from '../shell/ModeContextDock'
import type {WidgetBodyProps} from '../frame/widgets/widgets'
import {useGlance} from '../frame/widgets/useGlance'
import {useWidgetReading} from './widgetReading'
import {CONVERSATION_PROJECT, conversationAbsence, conversationGlance, conversationOf} from './agentConversation'

/** The companion's name in the mode in front of you: the agent widget's name in its head and its launcher cell. */
export function AgentWidgetName() {
  const reading = useWidgetReading()
  return <>{reading ? COMPANIONS[reading.mode].name : 'Agent'}</>
}

export function AgentWidget({subject, glance}: WidgetBodyProps) {
  const reading = useWidgetReading()
  const workspace = useWorkspace()
  const companion = reading ? COMPANIONS[reading.mode].name : 'Agent'
  const agency = useAgencySessions(workspace.transport)
  const found = conversationOf(agency.tracks, companion, subject)
  // A conversation this widget's first Send provisioned, until the agency reading lists it: the owner's own answer, held as
  // the surface's onAccompanying hands it (the Factory thread and the Workbench conversation pane hold theirs in the book).
  const [opened, setOpened] = useState<AgentAccompanying | null>(null)
  const track = found.track
  const accompanying = track ? {ref: track.sessionRef, project: CONVERSATION_PROJECT, space: track.spaceRef} : opened ?? undefined
  const roster = useAgentRoster(CONVERSATION_PROJECT, !accompanying)
  const body = roster.agents.find(agent => agent.name.trim().toLocaleLowerCase() === companion.toLocaleLowerCase())
  const session = useEncounterSession(accompanying)
  useGlance(glance, conversationGlance(session?.state.reading, companion))
  const ref = accompanying?.ref, space = accompanying?.space
  const scope = useMemo(() => ({
    workspaceId: workspace.workspaceId, accessEpoch: workspace.accessEpoch, project: CONVERSATION_PROJECT,
    ...(ref && space ? {accompanying: {ref, project: CONVERSATION_PROJECT, space}} : {}),
  }), [workspace.workspaceId, workspace.accessEpoch, ref, space])
  const by = found.by ?? (opened ? 'provisioned' : 'none')
  return <div className="widget-agent" data-conversation={accompanying ? 'bound' : 'unbound'} data-by={by} data-agent-session={ref}>
    {!accompanying && <p className="widget-agent-absence" role="status">{conversationAbsence(companion, {transport: workspace.transport, error: agency.error, loading: agency.loading})}</p>}
    {accompanying && found.by === 'selection' && track?.agentName && track.agentName.trim().toLocaleLowerCase() !== companion.toLocaleLowerCase()
      && <p className="widget-agent-absence" role="status">The selection names {track.agentName}'s session; {companion} answers when the selection leaves it.</p>}
    <NativeAgencyParticipation scope={scope} current={() => workspace.nativeAccessCurrent(workspace.accessEpoch)}
      subject={{title: track?.purpose ?? companion, ref: track?.agentRef ?? undefined}} mode={(reading?.mode ?? 'base') as WorkspaceMode}
      onAccompanying={value => setOpened(value ?? null)} preferredBodyRef={body?.ref} conversation plane="Chat"
      onError={message => console.warn(message)} />
  </div>
}
