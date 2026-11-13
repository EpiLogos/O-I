// Your conversation with the agent open in Messages when it stands at no Position (§19.24: your roster, "it works where you seat it"):
// opened, or reopened, once by the kernel's agent_conversation — the one provision (O-I #1003): its SessionSpace, its session bound to
// that Agent, its Agency, its body with the census agent it is with. What it answers (its sessions, oldest first) is observed and sent
// in through the one encounter session (EncounterObservers.tsx), like an occupant's conversation: this hook neither reads the
// conversation nor sends. A refusal is the owner's own words.
import {useEffect, useState} from 'react'
import {agentConversation, type AgentConversation} from '../../../../../../desktop/cradle/src/encounter/client'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'

/** The open roster agent's conversation: being opened, opened (the kernel's answer), or refused in the owner's words. */
export type OpenedConversation = {readonly agent: string} & (
  | {readonly status: 'opening'}
  | {readonly status: 'opened'; readonly opened: AgentConversation}
  | {readonly status: 'refused'; readonly error: string})

/** Open the roster agent's conversation once per agent opened. Null `agent` opens nothing. */
export function useAgentConversation(transport: KernelTransportStatus, agent: string | null): OpenedConversation | null {
  const [opened, setOpened] = useState<OpenedConversation | null>(null)
  useEffect(() => {
    if (!agent) { setOpened(null); return }
    if (transport.kind === 'unavailable') { setOpened({agent, status: 'refused', error: `The kernel carrier is unavailable: ${transport.reason}`}); return }
    let live = true
    setOpened({agent, status: 'opening'})
    agentConversation(transport, agent).then(
      conversation => { if (live) setOpened({agent, status: 'opened', opened: conversation}) },
      error => { if (live) setOpened({agent, status: 'refused', error: String(error instanceof Error ? error.message : error)}) })
    return () => { live = false }
  }, [transport, agent])
  return opened && opened.agent === agent ? opened : null
}
