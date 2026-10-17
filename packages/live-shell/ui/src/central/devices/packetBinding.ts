// The Packet (DLW §18.3, central:packet) on its owner (lane BC3): exactly what the agent reads from you, on a document's chain after
// Notes. The owner is AIKit's prepared context (aikit.prepared-context/v1), read once for the shell by the reader the Packet widget and
// the transport's Key slot already share (shell/transports/useCentralTransport.tsx:47 usePacketReading — the conversation the Agent
// widget holds, else the project), so the device, the widget and the transport show the same items (§18.9 Rules). An item is taken out,
// or the packet emptied, through the owner's own edit (centralDeviceWrites.ts editPacket — op encounter context edit); Answer this is
// the Agent conversation's own Send with exactly this packet (encounter/session.ts send: prompt-context, the reviewed context — the
// Packet widget's press, widgets/PacketWidget.tsx), and the owner empties what a send submitted (ai-kit aikit-store/src/encounter.rs:348
// clear_submitted). Capture has no route here: the page's selection does not cross the host bridge. Pure: no React, no transport.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import type {PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import {heldOf, pageBinding, type DesignWiring, type PageActs} from './pageBindings'

export const PACKET_DESIGN = 'central:packet'

/** The Limit the design draws as Off: only the owner's own cap stands (central__packet.tsx LIMIT.max). */
export const PACKET_LIMIT_OFF = 1_000_000
/** How much of an item's words the value carries; `chars` keeps the whole size (the design's own rule for an item shown only as it
 * opens). A selection may hold 256 KiB (nativeContext.ts assertPreparedContext). */
export const PACKET_TEXT_SHOWN = 600

const NO_SELECTION = 'The page\'s selection does not cross the host bridge (desktop/cradle/src/document/frame.ts useDocumentHostRead reads the island only), and the shell mounts no selection tray (the cradle\'s ContextTray.tsx, whose capture adds through op encounter context edit, is not mounted here).'
const NO_CAPTURE = `Capture has no route from this chain: ${NO_SELECTION}`

export const PACKET_WIRING: DesignWiring = {
  design: PACKET_DESIGN,
  keys: ['light', 'add', 'limit', 'keep', 'flow', 'packet', 'scope', 'question', 'selection', 'hasPage', 'sent', 'rowsPage', 'capture', 'clear', 'answer', 'takeOut'],
  reads: {
    light: 'AIKit\'s prepared context answered (lit) or refused (dark): the read the Packet widget and the transport\'s Key slot share (useCentralTransport.tsx usePacketReading)',
    packet: 'the prepared context\'s items, in order: entry is the item\'s place in the packet (the owner holds no Flow entry numbers), scope its anchor (selection for a text anchor, observed element for an observation anchor — the owner\'s anchor.kind), text how it opens, chars its whole size in characters and bytes in UTF-8 (the Answer\'s size), label the selection\'s title',
    flow: 'the source the items were gathered from: their title, when every item shares one',
    scope: 'session when the context is prepared for a conversation (scope.agent_session), project when none stands',
    question: 'written while the Agent conversation\'s composer holds a question (its encounter session\'s draft), none when it is empty',
    limit: `Off (${PACKET_LIMIT_OFF}): AIKit holds no limit, only its cap of 32 items and 1 MiB (nativeContext.ts assertPreparedContext; ai-kit encounter_context.rs)`,
    keep: 'false: AIKit empties what a send submitted (ai-kit aikit-store/src/encounter.rs:348 clear_submitted)',
  },
  writes: {
    takeOut: 'the item taken out (op encounter context edit, mutation remove; centralDeviceWrites.ts editPacket, ported from PreparedContextView.tsx:39)',
    clear: 'the packet emptied (op encounter context edit, mutation clear; PreparedContextView.tsx:40)',
    answer: 'the Agent conversation\'s Send with exactly this packet (encounter/session.ts send, prompt-context with the reviewed context; PacketWidget.tsx Answer this)',
  },
  local: {rowsPage: 'the page of the list this device shows'},
  refused: {
    capture: NO_CAPTURE,
    add: `What Capture takes has no owner here: ${NO_CAPTURE}`,
    limit: 'AIKit\'s prepared context holds no limit to set: only its own cap of 32 items and 1 MiB stands.',
    keep: 'AIKit empties what a send submitted (aikit-store encounter.rs clear_submitted): no option keeps the packet.',
  },
  absent: {
    add: 'No capture reaches the owner from this chain, so nothing reports what it takes.',
    selection: NO_SELECTION,
    hasPage: NO_SELECTION,
    sent: 'The encounter\'s reading keeps the turn, not the size of the packet it carried: no owner reports the last send\'s head.',
  },
}

/** The Agent conversation the packet goes with, as its one shared encounter observer reports it (agent/devices/EncounterObservers.tsx):
 * the composer's draft, whether a draft or a Send is in flight, and the owner's view (its actions say whether a prompt and a prepared
 * context are taken). */
export interface PacketConversation {
  readonly draft: string
  readonly busy: boolean
  readonly reading?: {readonly actions?: readonly {readonly ref: string; readonly enabled: boolean; readonly reason?: string | null}[]}
}

export interface PacketInput {
  /** usePacketReading's answer: the prepared context or the owner's refusal; null while it reads. */
  readonly reading: {readonly context?: PreparedContext; readonly error?: string} | null
  /** The companion whose conversation the packet goes with (shell/ModeContextDock.tsx COMPANIONS — Fizz in Central). */
  readonly companion: string
  /** Whether the agency reading holds that conversation (widgets/agentConversation.ts conversationOf). */
  readonly bound: boolean
  /** The conversation as observed; undefined while no observer serves it. */
  readonly conversation?: PacketConversation
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim()
const UTF8 = new TextEncoder()

/** One prepared item as the design's packet item ({entry, scope, text} — the Document's shape — with `chars`, `bytes` and `label`). */
export function packetItemOf(item: PreparedContext['items'][number], at: number): Record<string, Value> {
  const selection = item.selection
  const words = collapse(selection.text)
  return {
    entry: at + 1,
    // The owner's anchor (desktop/cradle/src/context/nativeContext.ts:8 `anchor.kind`): a text selection, or an element the page
    // observed. An observed element is no whole page (the design's `page` kind is a whole journal page), so its words say what it is.
    scope: selection.anchor.kind === 'text' ? 'selection' : 'observed element',
    text: words.length > PACKET_TEXT_SHOWN ? words.slice(0, PACKET_TEXT_SHOWN) : words,
    // The owner's own size of the selection (PacketWidget.tsx packetRows: `selection.text.length`), and its UTF-8 bytes — the size the
    // Answer weighs against the turn's native budget (central__nara-conversation.tsx sizeOf).
    chars: selection.text.length,
    bytes: UTF8.encode(selection.text).length,
    label: selection.title,
  }
}

/** The Packet's readings (PACKET_WIRING). */
export function packetValues(id: string, input: PacketInput): Values {
  const values: Record<string, Value> = {}
  const context = input.reading?.context
  if (context) values.light = 'lit'
  else if (input.reading?.error) values.light = 'dark'
  if (context) {
    values.packet = JSON.stringify(context.items.map(packetItemOf))
    const titles = [...new Set(context.items.map(item => item.selection.title))]
    if (titles.length === 1) values.flow = titles[0]!
    values.scope = context.scope.agent_session ? 'session' : 'project'
    values.limit = PACKET_LIMIT_OFF
    values.keep = false
  }
  if (input.conversation) values.question = input.conversation.draft.trim() ? 'written' : 'none'
  const held = heldOf(id)
  values.rowsPage = held.rowsPage ?? 0
  return values
}

/** What the Packet writes through: the owner's edit of the prepared context, and the conversation's Send. */
export interface PacketPorts {
  /** Edit the packet the reading holds (centralDeviceWrites.ts editPacket over that reading); null while none is read. */
  readonly edit: ((mutation: {readonly operation: 'remove'; readonly id: string} | {readonly operation: 'clear'}) => Promise<void>) | null
  /** The Agent conversation's Send (the encounter session's own); null while no conversation is observed. */
  readonly send: (() => Promise<void>) | null
}

const NO_PACKET = 'No reading of the packet: AIKit\'s prepared context has not answered yet.'

/** Why Answer this cannot press now, in the owners' words: ported unchanged from widgets/PacketWidget.tsx:37-48 `answerRefusal` (that
 * module loads the cradle's walk-instrumented encounter session at module scope, which this chain loads only lazily —
 * agent/devices/EncounterObservers.tsx). */
export function answerRefusal(input: {companion: string; bound: boolean; reading?: PacketConversation['reading']; draft: string; busy: boolean; items: number}): string | null {
  if (!input.bound) return `No ${input.companion} conversation stands, so nothing receives the packet yet.`
  if (!input.reading) return 'The conversation has not answered its first read yet.'
  const action = (ref: string) => input.reading?.actions?.find(entry => entry.ref === ref)
  const prompt = action('aikit.encounter.prompt')
  if (!prompt?.enabled) return `The conversation takes no prompt now${prompt?.reason ? `: ${prompt.reason}` : '.'}`
  if (!action('aikit.encounter.context')?.enabled) return 'The conversation takes no prepared context (aikit.encounter.context is not enabled), so a Send would go without the packet.'
  if (!input.items) return 'The packet is empty: put a selection in it first.'
  if (input.busy) return 'The conversation is busy with a draft or a Send.'
  if (!input.draft.trim()) return `Write the question in ${input.companion}'s composer: Answer this sends it with exactly this packet.`
  return null
}

/** Why Answer this cannot press now: the packet's own reading first, then the conversation's (answerRefusal). */
export function packetAnswerWhy(input: PacketInput): string | undefined {
  const context = input.reading?.context
  if (!context) return input.reading?.error ? `The prepared-context owner refused: ${input.reading.error}` : NO_PACKET
  const refusal = answerRefusal({companion: input.companion, bound: input.bound, reading: input.conversation?.reading,
    draft: input.conversation?.draft ?? '', busy: !!input.conversation?.busy, items: context.items.length})
  if (refusal) return refusal
  return input.conversation ? undefined : 'The conversation is not observed.'
}

/** The Packet's binding: its readings, the owner's edit for Take out and Clear now, the conversation's Send for Answer this. */
export function packetBinding(id: string, input: PacketInput, ports: PacketPorts): DesignBinding {
  const context = input.reading?.context
  const acts: PageActs = {
    takeOut: async value => {
      if (!context || !ports.edit) throw new Error(NO_PACKET)
      // The design names an item by its place and entry (`${at}:${entry}`, central__packet.tsx itemOf); the owner by its id.
      const at = Number(String(value ?? '').split(':')[0])
      const item = Number.isInteger(at) ? context.items[at] : undefined
      if (!item) throw new Error('That item is no longer in the packet: the owner\'s packet moved. Read it again.')
      await ports.edit({operation: 'remove', id: item.id})
    },
    clear: async value => {
      if (value === false) return
      if (!context || !ports.edit) throw new Error(NO_PACKET)
      await ports.edit({operation: 'clear'})
    },
    answer: async value => {
      if (value === false) return
      const why = packetAnswerWhy(input)
      if (why) throw new Error(why)
      if (!ports.send) throw new Error('The conversation is not observed.')
      await ports.send()
    },
  }
  const why: Record<string, string> = {}
  if (!context || !ports.edit) { why.takeOut = NO_PACKET; why.clear = NO_PACKET }
  else if (context.items.length === 0) { why.clear = 'The packet is empty.' }
  const answer = packetAnswerWhy(input) ?? (ports.send ? undefined : 'The conversation is not observed.')
  if (answer) why.answer = answer
  return pageBinding(id, PACKET_WIRING, packetValues(id, input), acts, why)
}
