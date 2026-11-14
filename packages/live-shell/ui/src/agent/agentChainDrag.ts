/** Drag protocol for the agent device chain (browser row → chain card, chain
 * card → slide). Pure: no React, no kernel imports — the views dispatch what
 * this model declares, and the tests read it as data.
 *
 * The aperture law, made data: every drop resolves to ONE declared owner
 * operation, or to a named missing op the drop refuses with. Nothing here
 * invents an operation: every drop a browser row starts rides an operation
 * that exists (the shell's own session selection; AIKit's `aikit.gateway.agent`
 * on the gateway binding; AIKit's Sources placement; Central's
 * `agent-profile.chain-admit` for a SkillSet; the seat instrument's
 * `seat join` for a seat: O-I #743, DLW build ruling 2026-11-12), and a slot
 * no row is dragged to yet (the world, the gateway) is declared missing by name. A successful-looking flag is never evidence of a native
 * effect — so the refusal IS the model's answer, not a failure path.
 *
 * The chain's composition (gateway → agent → skillset → world → git) is the
 * declared order at the family door (`agentDeviceCatalogue` CHAIN_SLOTS,
 * agent-shell-mockup.html Rev 5; WORLD-SHELL-DESIGN §7.1). There is no order operation, so a slide refuses
 * honestly rather than keeping a shadow order store.
 *
 * Sources (§19.9; DLW build ruling 2026-11-05) stands before the Agent: dragged from the browser, it lands on the Sources slot, and AIKit
 * places it where it was dropped — ahead of the Agent rack, or inside the agent's own chain (factoryPlaces.ts sourcesPlacementOf). It is
 * no slot of the family door's composition: a device of its own, drawn by AIKit's design. */

/** One application MIME for the whole chain gesture channel; the payload
 * discriminates a browser-row drop from a card slide. */
export const AGENT_CHAIN_MIME = 'application/x-oi-agent-chain-item'

/** The browser families that may start a chain drag. Gateways and worlds
 * name slots in the zone's acceptance list but disclose no browser rows yet. */
export type AgentChainFamily = 'session' | 'agent' | 'skillset' | 'git' | 'sources'

/** The chain's semantic positions (mockup law: through → who → how → where →
 * lands). Mirrors the catalogue's declared order for naming where a drop
 * lands; it is not a store and never reorders anything. */
export type AgentChainSlotId = 'gateway' | 'sources' | 'agent' | 'skillset' | 'world' | 'git'
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

const FAMILIES: readonly AgentChainFamily[] = ['session', 'agent', 'skillset', 'git', 'sources']
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
 * session's task record); `harness-control` is AIKit's declared Action
 * `aikit.gateway.agent` on the gateway binding (the kernel's `act`), receipted
 * by the owner's own answer. */
export type ChainDropOperation =
  | {kind: 'select-session'}
  | {kind: 'harness-control'; control: 'new'}
  /** Sources placed on the session's chain where it was dropped: AIKit's encounter-session-settings `sources` (the agent's own chain) or
   * `rack_sources` (the shared reading ahead of the Agent rack), against the settings' revision (factoryPlaces.ts sourcesPlaceRequest). */
  | {kind: 'place-sources'}
  /** A SkillSet admitted to the agent's chain (O-I #743; DLW build ruling 2026-11-12): Central's agent-profile.chain-admit, on the profile
   * the chain is (§19.4), at its revision as read. Dropped on the Skillset rack that carries one already, it is the rack's Hot-swap
   * (agent-profile.chain-replace) instead: the view chooses by where it lands (sessionChainBindings.ts skillSetDropRequest). */
  | {kind: 'admit-skillset'}
  /** A seat joined for the chain's work (§19.16 The seat; O-I #743): the Seat's own Join, the seat instrument's `seat join` (the Action
   * workcell.seat.join, through the kernel's act), on the seat and the project Git / landing names, attributed to the desk's actor. */
  | {kind: 'join-seat'}

/** The named missing operations. Each string is the exact op a refusal card
 * names — the family's chain-admission operation that no owner declares. */
export const MISSING_OPS = {
  world: 'world scope setter',
  gateway: 'gateway transport attach',
} as const

/** A slide on a session's chain (BD r19: Central PR 318): the order of what the agent carries is Central's agent-profile.chain-order, on the
 * profile it keeps, the SkillSets inside the Skillset rack; the rack's own place between the Agent rack and the Agent is the chain's meaning
 * (inhabitants/sdk/chains.ts CHAIN_LAWS['factory-session']). */
export const CHAIN_ORDER_OP = 'agent-profile.chain-order'
/** A SkillSet dropped on a session's chain is admitted to the profile Central keeps for the agent (Central's agent-profile.chain-admit:
 * one more SkillSet after those it carries; O-I #743, DLW build ruling 2026-11-12). Named in words only: its sender is
 * sessionChainBindings.ts admitRequest. */
export const CHAIN_ADMIT_WORDS = 'Central\'s agent-profile.chain-admit'
/** What the chain's note says where the roster discloses no carried practice: where a SkillSet comes from and how the agent takes one. */
export const SKILLSETS_ARRIVE = 'the sets AIKit holds are listed in the browser\'s Skillsets: drag one onto the agent\'s chain, and Central\'s agent-profile.chain-admit adds it to what the agent carries'
/** A seat dropped on the chain is joined by the Seat's own Join (the seat instrument's `seat join`, the Action workcell.seat.join). */
export const SEAT_JOIN_WORDS = 'the seat instrument\'s `seat join` (the Action workcell.seat.join)'
export const SLIDE_PLACE = `the Skillset rack stands between the Agent rack and the Agent, which keep their places; the order of the SkillSets inside it is Central's (${CHAIN_ORDER_OP})`

// ---- Owners: who each binding waits on, and who owes each missing op -------

/** The owner bindings the chain's lights read in the native run (P0-R4):
 * each names the product that owns the reading and the reading's own op.
 * Owners follow the verified per-device family map
 * (`ProjectCentral/docs/3-architecture/world-shell/AGENT-DEVICE-OWNERSHIP.md:20-37`).
 * The gateway lamp shows `harness_agent_read`, the
 * AIKit agency gateway's harness-binding reading (:22) — the Gateway device's
 * transport face is Actuation's (:20), so the missing transport op is owed by
 * Actuation while the refused reading waits on AIKit. The skillset light reads
 * Central's roster (:37, accepted profiles' skill_refs) while the rack itself
 * is AIKit's (:27): a refused roster waits on Central, an empty rack on AIKit.
 * The browser's Skillsets rows are AIKit's sets themselves (`aikit set list`,
 * ticket 743), so a refused list waits on AIKit. Git is Workcell's seat (:30).
 * A reading, never a write. */
export type OwnerBindingId = 'roster' | 'gateway' | 'workcell' | 'skillset' | 'skillsets'
export interface OwnerBinding {
  /** The product's public name, as its catalogue surface names it. */
  readonly owner: string
  /** The owner reading whose answer admits the light. */
  readonly reading: string
}
export const OWNER_BINDINGS: Readonly<Record<OwnerBindingId, OwnerBinding>> = {
  roster: {owner: 'Central', reading: 'agent_definition roster'},
  gateway: {owner: 'AIKit', reading: 'harness_agent_read'},
  workcell: {owner: 'Workcell', reading: 'workcell_status_read'},
  skillset: {owner: 'AIKit', reading: 'agent_definition roster (accepted skill_refs)'},
  skillsets: {owner: 'AIKit', reading: 'agent_definition skillsets (`aikit set list`)'},
}

/** Who owes each missing op — the family that owns the face the op would
 * admit onto (same map: gateway transport :20). The chain's order, a SkillSet's
 * admission and a seat's join are no longer missing: Central writes the first
 * two on the agent profile the chain is (CHAIN_ORDER_OP, CHAIN_ADMIT_WORDS;
 * §19.4 "The chain is the profile Central keeps for the agent"), and the seat
 * instrument joins the seat (SEAT_JOIN_WORDS). `null` where no owner is named: the world face
 * is a Central + AIKit split. A null owner is disclosed as unnamed, never
 * guessed. */
export const MISSING_OP_OWNERS: Readonly<Record<keyof typeof MISSING_OPS, string | null>> = {
  world: null,
  gateway: 'Actuation',
}

/** The remedy for a missing op, in the ticket's own terms: the owner builds
 * it on its own seat, or declares it absent. With no owner named, the remedy
 * is naming one first. */
export function missingOpRemedy(op: keyof typeof MISSING_OPS): string {
  const owner = MISSING_OP_OWNERS[op]
  return owner
    ? `${owner} builds ${MISSING_OPS[op]} on its own seat, or declares it absent`
    : `no owner is named for ${MISSING_OPS[op]} yet — one must be named before it is built or declared absent`
}

/** A refused owner reading as one named line: the owner, the reading that
 * refused, and the owner's own words. No remedy is invented — the owner's
 * words carry one when the owner names it. `not-reached` is the shell's own
 * transport failing before the owner was asked: the owner is still named,
 * but the refusal is never put in its mouth. */
export function ownerRefusalLine(binding: OwnerBindingId, words: string, how: 'refused' | 'not-reached' = 'refused'): string {
  const {owner, reading} = OWNER_BINDINGS[binding]
  return `waiting on ${owner} — ${reading} ${how === 'refused' ? 'refused' : 'not reached'}: ${words}`.slice(0, 240)
}

export type ChainDropDecision =
  | {kind: 'operation'; operation: ChainDropOperation; slot: AgentChainSlotId; via: string}
  | {kind: 'missing-op'; missingOp: string; slot: AgentChainSlotId; because: string; owner: string | null; remedy: string}

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
    case 'sources':
      return 'sources'
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
        via: 'aikit.gateway.agent (new) on the gateway binding',
      }
    case 'skillset':
      return {
        kind: 'operation',
        operation: {kind: 'admit-skillset'},
        slot,
        via: `${CHAIN_ADMIT_WORDS} adds it to what the agent carries, after the SkillSets it carries already, where it lands inside the agent's own chain; on a Skillset rack that carries one, it stands where that one stood (the rack's Hot-swap)`,
      }
    case 'sources':
      return {
        kind: 'operation',
        operation: {kind: 'place-sources'},
        slot,
        via: 'AIKit\'s encounter-session-settings places it before the Agent: ahead of the Agent rack, the shared reading, or inside the agent\'s chain where it is dropped there',
      }
    case 'git':
      return {
        kind: 'operation',
        operation: {kind: 'join-seat'},
        slot,
        via: `${SEAT_JOIN_WORDS}: the Seat's Join, on the seat and the project Git / landing names`,
      }
  }
}

/** The drop zone's honest text while something is dragged: what is held, and
 * what the drop will actually do — including the refusals. Never a promise
 * the decision does not make. */
export function dropZoneLine(active: ActiveChainDrag): string {
  if (active.kind === 'reorder') {
    return `Slide «${active.reorder.title}» — release refuses: ${SLIDE_PLACE}`
  }
  const decision = chainDropDecision(active.drag)
  if (decision.kind === 'operation') {
    return `Drop «${active.drag.label}» — ${decision.via}`
  }
  return `«${active.drag.label}» — no owner operation; the drop refuses (missing op: ${decision.missingOp}${decision.owner ? ` · owed by ${decision.owner}` : ''})`
}

/** The insertion index among the chain cards (left-to-right rects) for a
 * pointer x: the cards whose midpoint lies left of it. Same rule as the
 * parent rack's deviceInsertIndex — one grammar across the shell. */
export function chainInsertIndex(x: number, cards: readonly {left: number; right: number}[]): number {
  let index = 0
  while (index < cards.length && x >= (cards[index].left + cards[index].right) / 2) index++
  return index
}
