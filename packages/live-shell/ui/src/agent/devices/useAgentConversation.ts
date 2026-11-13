// The conversation with the agent open in Messages when it stands at no Position (§19.24: your roster, "it works where you seat it"):
// a direct conversation with that Agent through AIKit's encounter owner. Opening the agent asks the kernel's agent_conversation (one
// owner write: the SessionSpace, the agent session bound to the Agent, its Agency, the provider body — made once, reopened after); the
// thread is AIKit's own transcript view (`aikit session-space encounter view`), read again while the agent stays open; Send is the
// owner's draft at the view's revision, then the prompt of that revision. Every refusal is AIKit's own words. A conversation renewed after
// its owner restarted (a harness that cannot resume) keeps its history in its earlier sessions: their views are read once and stand first.
import {useCallback, useEffect, useRef, useState} from 'react'
import {agentConversation, encounter, type Draft, type EncounterReading} from '../../../../../../desktop/cradle/src/encounter/client'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'

/** How often the open conversation's transcript is read again (a provider turn lands in the resident body, not through this window). */
export const CHAT_READ_MS = 2000

export interface AgentChat {
  readonly agent: string
  readonly status: 'reading' | 'answered' | 'refused'
  readonly session?: string
  readonly view?: EncounterReading
  readonly error?: string
}

/** The open roster agent's conversation and the act that speaks to it. Null `agent` opens nothing. */
export function useAgentConversation(transport: KernelTransportStatus, agent: string | null): {chat: AgentChat | null; say: (words: string) => Promise<void>} {
  const [chat, setChat] = useState<AgentChat | null>(null)
  const session = useRef<string | null>(null)
  const earlier = useRef<EncounterReading['blocks']>([])
  const refresh = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    session.current = null
    earlier.current = []
    if (!agent || transport.kind === 'unavailable') { setChat(agent ? {agent, status: 'refused', error: transport.kind === 'unavailable' ? `the kernel carrier is unavailable: ${transport.reason}` : undefined} : null); return }
    let live = true
    setChat({agent, status: 'reading'})
    const read = async () => {
      const ref = session.current
      if (!ref || !live) return
      try {
        const view = await encounter<EncounterReading>(transport, '', {action: 'view', agent_session: ref})
        if (live) setChat({agent, status: 'answered', session: ref, view: earlier.current.length ? {...view, blocks: [...earlier.current, ...view.blocks]} : view})
      } catch (error) {
        if (live) setChat(previous => ({agent, status: previous?.view ? 'answered' : 'refused', session: ref, ...(previous?.view ? {view: previous.view} : {}), error: String(error instanceof Error ? error.message : error)}))
      }
    }
    refresh.current = read
    let timer: ReturnType<typeof setInterval> | undefined
    agentConversation(transport, agent).then(async opened => {
      if (!live) return
      const before = (opened.sessions ?? []).filter(ref => ref !== opened.agent_session)
      const pages = await Promise.all(before.map(ref => encounter<EncounterReading>(transport, '', {action: 'view', agent_session: ref}).then(view => view.blocks, () => [])))
      if (!live) return
      earlier.current = pages.flat()
      session.current = opened.agent_session
      void read()
      timer = setInterval(() => { void read() }, CHAT_READ_MS)
    }, error => { if (live) setChat({agent, status: 'refused', error: String(error instanceof Error ? error.message : error)}) })
    return () => { live = false; if (timer) clearInterval(timer) }
  }, [transport, agent])
  const say = useCallback(async (words: string) => {
    const ref = session.current
    if (!ref) throw Error('Send: the conversation with this agent is not open yet — AIKit has not answered opening it.')
    const view = await encounter<EncounterReading>(transport, '', {action: 'view', agent_session: ref})
    const draft = await encounter<Draft>(transport, '', {action: 'draft', agent_session: ref, basis: view.draft?.revision ?? 0, text: words})
    await encounter<unknown>(transport, '', {action: 'prompt', agent_session: ref, draft_revision: draft.revision})
    await refresh.current()
  }, [transport])
  return {chat, say}
}
