// A chat dropped on the rail (DLW §19.1: "Drag it onto the rail and its agent's tile opens with the chat, ready to talk"). The rail
// (frame/widgets/WidgetRail.tsx) is a column of tiles and takes no drop of its own; this is the drop it is given. The act is
// agent/factoryChatsReopen.ts dropChatOnRail — the owner reopens the chat, then the agent's tile opens and holds it — and these are the
// handlers that carry the gesture to it, and the hook that gives a rail its handlers and the words the act answered with.
//
// The handlers take a structural event so a harness can drive them; they accept only a chat in hand (agent/factoryChatsModel.ts
// activeChatDrag): a dragover cannot read the payload, and an agent or a skillset must not look droppable here.
import {useMemo, useState, type DragEvent} from 'react'
import {useWorkspace} from '../shell/workspaceContext'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {trackKey} from './agentRunModel'
import {AGENT_CHAIN_MIME} from './agentChainDrag'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {activeChatDrag, decodeChatDrag, setActiveChatDrag} from './factoryChatsModel'
import {dropChatOnRail, type ChatRail, type EncounterCall, type ReopenReceipt} from './factoryChatsReopen'

/** The slice of a drag event the handlers read. */
export interface RailDragEvent {
  readonly dataTransfer: {readonly types: readonly string[]; getData(type: string): string; dropEffect: string} | null
  preventDefault(): void
}

export interface ChatRailHandlerPorts {
  readonly transport: KernelTransportStatus
  readonly trackIds?: readonly string[]
  readonly rail: ChatRail
  /** What the act answered with, in words (the receipt). */
  readonly said: (receipt: ReopenReceipt) => void
  readonly call?: EncounterCall
}

export function chatRailHandlers(ports: ChatRailHandlerPorts) {
  return {
    onDragOver(event: RailDragEvent): void {
      if (!activeChatDrag() || !event.dataTransfer?.types.includes(AGENT_CHAIN_MIME)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    onDrop(event: RailDragEvent): void {
      const payload = event.dataTransfer?.getData(AGENT_CHAIN_MIME) ?? ''
      if (!decodeChatDrag(payload)) return
      event.preventDefault()
      setActiveChatDrag(null)
      void dropChatOnRail(payload, {transport: ports.transport, trackIds: ports.trackIds, rail: ports.rail, call: ports.call}).then(ports.said)
    },
  }
}

/** The rail's book, as far as a chat's drop needs it (frame/widgets/widgets.ts WidgetRailBook). */
export interface ChatRailBook {
  readonly rail: {readonly open: readonly string[]}
  toggle(id: string): void
  pin(id: string, ref: string | null): void
}

/** The handlers for a rail, over the window's transport and the sessions the shell draws, and the words the last drop answered with
 * (the owner's note, or its refusal). Called where the workspace and the sessions provider stand above (App.tsx). */
export function useChatRailDrop(book: ChatRailBook): {
  dropProps: {onDragOver(event: DragEvent<HTMLElement>): void; onDrop(event: DragEvent<HTMLElement>): void}
  note: string | null
} {
  const {transport} = useWorkspace()
  const sessions = useAgentSessionsOptional()
  const [receipt, said] = useState<ReopenReceipt | null>(null)
  const trackIds = useMemo(() => sessions?.tracks.filter(track => !track.group).map(trackKey), [sessions])
  const handlers = chatRailHandlers({transport, trackIds, said, rail: {isOpen: id => book.rail.open.includes(id), toggle: book.toggle, pin: book.pin}})
  return {dropProps: handlers, note: receipt ? (receipt.ok ? receipt.note : receipt.error) : null}
}
