/** Drag protocol for the agent device chain (browser row → chain card, chain
 * card → slide). Pure: no React, no kernel imports — the views dispatch what
 * this model declares, and the tests read it as data.
 *
 * The aperture law, made data: every drop resolves to ONE declared owner
 * operation, or to a named missing op the drop refuses with. Nothing here
 * invents an operation: the two real drops ride operations that already exist
 * (the shell's own session selection; `harness_agent_control` on the gateway
 * binding), and every family without a chain-admission operation is declared
 * missing by name. A successful-looking flag is never evidence of a native
 * effect — so the refusal IS the model's answer, not a failure path.
 *
 * The chain's composition (gateway → agent → skillset → world → git) is the
 * declared order at the family door (`agentDeviceCatalogue` CHAIN_SLOTS,
 * AGENTIC-CONVERGENCE Rev 5). There is no order operation, so a slide refuses
 * honestly rather than keeping a shadow order store. */

/** One application MIME for the whole chain gesture channel; the payload
 * discriminates a browser-row drop from a card slide. */
export const AGENT_CHAIN_MIME = 'application/x-oi-agent-chain-item'

/** The browser families that may start a chain drag. Gateways and worlds
 * name slots in the zone's acceptance list but disclose no browser rows yet. */
export type AgentChainFamily = 'session' | 'agent' | 'skillset' | 'git'

/** The chain's semantic positions (mockup law: through → who → how → where →
 * lands). Mirrors the catalogue's declared order for naming where a drop
 * lands; it is not a store and never reorders anything. */
export type AgentChainSlotId = 'gateway' | 'agent' | 'skillset' | 'world' | 'git'
export const CHAIN_SLOTS: readonly AgentChainSlotId[] = ['gateway', 'agent', 'skillset', 'world', 'git']

/** A browser row's drag payload: the family it belongs to, the exact ref the
 * owner disclosed (session track key, agent ref, skill ref, workcell seat)
 * and the row's own label for the honest drag image. */
export interface AgentChainDrag {
  family: AgentChainFamily
  ref: string
  label: string
}

/** A card slide: which declared slot is being moved. */
export interface AgentChainReorder {
  id: AgentChainSlotId
  title: string
}

export type ActiveChainDrag =
  | {kind: 'chain-item'; drag: AgentChainDrag}
  | {kind: 'reorder'; reorder: AgentChainReorder}

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max

const FAMILIES: readonly AgentChainFamily[] = ['session', 'agent', 'skillset', 'git']
const SLOTS: readonly AgentChainSlotId[] = CHAIN_SLOTS

const isFamily = (value: unknown): value is AgentChainFamily =>
  typeof value === 'string' && (FAMILIES as readonly string[]).includes(value)

const isSlot = (value: unknown): value is AgentChainSlotId =>
  typeof value === 'string' && (SLOTS as readonly string[]).includes(value)

/** Validates a browser-row payload; anything malformed is refused. */
export function parseAgentChainDrag(raw: unknown): AgentChainDrag | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (!isFamily(row.family)) return null
  if (!text(row.ref, 400) || !text(row.label, 300)) return null
  return {family: row.family, ref: row.ref, label: row.label}
}

/** Validates a slide payload; unknown slots are refused. */
export function parseAgentChainReorder(raw: unknown): AgentChainReorder | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  if (!isSlot(row.id) || !text(row.title, 120)) return null
  return {id: row.id, title: row.title}
}

export function encodeChainDrag(drag: AgentChainDrag | AgentChainReorder): string {
  return JSON.stringify(drag)
}

/** Decodes a drop's payload: a browser-row drop, a card slide, or null for
 * anything that is not this protocol's bytes. */
export function decodeChainDrag(encoded: string): ActiveChainDrag | null {
  try {
    const parsed: unknown = JSON.parse(encoded)
    const drag = parseAgentChainDrag(parsed)
    if (drag) return {kind: 'chain-item', drag}
    const reorder = parseAgentChainReorder(parsed)
    if (reorder) return {kind: 'reorder', reorder}
    return null
  } catch {
    return null
  }
}

// ---- The gesture-held active drag ------------------------------------------
// dataTransfer is unreadable during dragover, so the active drag is also held
// here for the duration of one gesture (the parent protocol's pattern).

let active: ActiveChainDrag | null = null
export function setActiveChainDrag(value: ActiveChainDrag | null): void {active = value}
export function activeChainDrag(): ActiveChainDrag | null {return active}

// ---- The aperture law: drop → owner operation, or named missing op ---------

/** The two drops that land through declared operations. `select-session` is
 * the shell's own selection action (the chain's who slot reads the selected
 * session's task record); `harness-control` is the declared
 * `harness_agent_control` op on the gateway binding, receipted by the
 * owner's `harness_agent_outcome` document. */
export type ChainDropOperation =
  | {kind: 'select-session'}
  | {kind: 'harness-control'; control: 'new'}

/** The named missing operations. Each string is the exact op a refusal card
 * names — the family's chain-admission operation that no owner declares. */
export const MISSING_OPS = {
  skillset: 'agent-chain skillset admit',
  git: 'workcell git-seat attach',
  world: 'world scope setter',
  gateway: 'gateway transport attach',
  /** A slide: the composition is declared at the family door; nothing reorders it. */
  order: 'agent-chain order',
} as const

export type ChainDropDecision =
  | {kind: 'operation'; operation: ChainDropOperation; slot: AgentChainSlotId; via: string}
  | {kind: 'missing-op'; missingOp: string; slot: AgentChainSlotId; because: string}

/** Where each family lands on the chain (the semantic positions). Sessions
 * and agents both land on the who slot: the session the chain serves, and the
 * harness conversation that runs it. */
export function chainSlotFor(family: AgentChainFamily): AgentChainSlotId {
  switch (family) {
    case 'session':
    case 'agent':
      return 'agent'
    case 'skillset':
      return 'skillset'
    case 'git':
      return 'git'
  }
}

/** The aperture decision for one drop: the declared operation it dispatches,
 * or the named missing op it refuses with. The `because` lines are the
 * refusal card's own words — where the operation would live and who owns the
 * admission today. */
export function chainDropDecision(drag: AgentChainDrag): ChainDropDecision {
  const slot = chainSlotFor(drag.family)
  switch (drag.family) {
    case 'session':
      return {
        kind: 'operation',
        operation: {kind: 'select-session'},
        slot,
        via: 'the run model’s own selection — the who slot reads this session’s task record',
      }
    case 'agent':
      return {
        kind: 'operation',
        operation: {kind: 'harness-control', control: 'new'},
        slot,
        via: 'harness_agent_control (new) on the gateway binding',
      }
    case 'skillset':
      return {
        kind: 'missing-op',
        missingOp: MISSING_OPS.skillset,
        slot,
        because: 'the roster’s admission (agent_definition propose/accept) owns agent profiles, not chain seats',
      }
    case 'git':
      return {
        kind: 'missing-op',
        missingOp: MISSING_OPS.git,
        slot,
        because: 'workcell_status_read is the seat’s reading; no owner operation attaches a seat to the chain',
      }
  }
}

/** The drop zone's honest text while something is dragged: what is held, and
 * what the drop will actually do — including the refusals. Never a promise
 * the decision does not make. */
export function dropZoneLine(active: ActiveChainDrag): string {
  if (active.kind === 'reorder') {
    return `Slide «${active.reorder.title}» — release refuses: the composition is declared (missing op: ${MISSING_OPS.order})`
  }
  const decision = chainDropDecision(active.drag)
  if (decision.kind === 'operation') {
    return `Drop «${active.drag.label}» — ${decision.via}`
  }
  return `«${active.drag.label}» — no owner operation; the drop refuses (missing op: ${decision.missingOp})`
}

/** The insertion index among the chain cards (left-to-right rects) for a
 * pointer x: the cards whose midpoint lies left of it. Same rule as the
 * parent rack's deviceInsertIndex — one grammar across the shell. */
export function chainInsertIndex(x: number, cards: readonly {left: number; right: number}[]): number {
  let index = 0
  while (index < cards.length && x >= (cards[index].left + cards[index].right) / 2) index++
  return index
}
