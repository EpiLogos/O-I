// Agent identity (DLW §18.15, central:agent-identity) on its owners (lane BC3): who an agent is, read from your own roster, before the
// agent on the track it works on — on Central's workspace track, before the Answer (§16.2, §18.10). The owners, each one the shell
// already reads:
//   - the roster: Central's agent profiles (central.agent-profile-roster/v1, op agent_definition roster), the window's one shared roster
//     answer (owners/readers.ts useRosterAgents for the list; useRosterAnswer for the profile fields the list drops: the ratified Worlds
//     and the authored self the review resolved);
//   - the card: oi.human-agent-card/v1 for the chosen agent in the chosen World (op agent_card — desktop/cradle/src/agency/
//     agentCardReading.ts readAgentCard, the read the native context panel makes).
// The device writes nothing (§18.15 Rules: "The roster is yours. The device reads it."): the agent, the World and Proposed choose what
// is read, and are the view's own. Pure: no React, no transport.
import type {DesignBinding, Value, Values} from '../../frame/devices/designed'
import type {RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import type {HumanAgentCard} from '../../../../../../desktop/cradle/src/agency/agentCardReading'
import {heldOf, pageBinding, type DesignWiring} from './pageBindings'

export const IDENTITY_DESIGN = 'central:agent-identity'

export const IDENTITY_WIRING: DesignWiring = {
  design: IDENTITY_DESIGN,
  keys: ['light', 'agent', 'proposed', 'world', 'read', 'fault', 'marks', 'roster', 'card', 'worlds'],
  reads: {
    light: 'the roster answered (lit) or refused (dark): op agent_definition roster, the window\'s shared roster answer',
    read: 'read when the roster answered, refused when it did not',
    fault: 'the roster\'s refusal, in its own words',
    roster: 'the roster as roster.ts reports it, one entry per profile: ref, name, role, revision, accepted',
    card: 'the chosen agent\'s card in the chosen World (op agent_card, oi.human-agent-card/v1): home, purpose, carries by practice kind, the profile\'s ratified Worlds, its authored self (the roster review\'s resolved self source) and whether it names a character',
    worlds: 'the Worlds the card can be read in: the profile\'s ratified Worlds and the other Worlds its card names',
  },
  writes: {},
  local: {
    agent: 'whose card is read: the agent you talk to (the Answer\'s), until you choose another',
    proposed: 'whether the roster shown holds the agents you have not accepted',
    world: 'the World the card is read in (Home: the profile\'s own)',
  },
  refused: {},
  absent: {
    marks: 'The mark set is the person\'s choice for the whole shell (Settings); no reading of it reaches this chain, so the blade stands.',
  },
}

type Obj = Record<string, unknown>
const obj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item) : [])

/** The profile fields the roster list drops, by agent ref: the ratified Worlds and the authored self, from the raw roster reading. */
export interface ProfileExtras {
  readonly ratified: readonly string[]
  readonly self: {readonly path: string; readonly digest?: string; readonly opening?: string} | null
}

/** The source path a Central source ref names (`central:source:<world>:<path>`, the world `control:root` or `project:<name>`). */
const pathOfSourceRef = (ref: string): string => ref.replace(/^central:source:(?:control:root|project:[^:]+):/, '')

/** The authored self's first paragraph of prose: its own words, verbatim (the review resolved the source and carries its text). */
export function openingOf(text: string): string | undefined {
  for (const block of text.split(/\n\s*\n/)) {
    const line = block.trim()
    if (line && !line.startsWith('#')) return line.replace(/\s*\n\s*/g, ' ')
  }
  return undefined
}

/** The extras of each profile in the raw roster reading (central.agent-profile-roster/v1 `profiles[]`). */
export function profileExtrasOf(raw: unknown): ReadonlyMap<string, ProfileExtras> {
  const out = new Map<string, ProfileExtras>()
  if (!obj(raw) || !Array.isArray(raw.profiles)) return out
  for (const entry of raw.profiles) {
    if (!obj(entry) || !obj(entry.profile)) continue
    const ref = str(entry.profile.agent_ref)
    if (!ref) continue
    const named = obj(entry.profile.self_definition) && obj(entry.profile.self_definition.source) ? entry.profile.self_definition.source : null
    const resolved = obj(entry.self_definition) && obj(entry.self_definition.source) ? entry.self_definition.source : null
    const reference = str(named?.reference) ?? str(resolved?.reference)
    const digest = str(named?.content_digest) ?? str(resolved?.content_digest)
    const text = resolved && resolved.resolved === true ? str(resolved.text) : undefined
    out.set(ref, {
      ratified: strings(entry.profile.ratified_world_refs),
      self: reference ? {path: pathOfSourceRef(reference), ...(digest ? {digest: (digest.split(':').pop() ?? digest).slice(0, 12)} : {}), ...(text && openingOf(text) ? {opening: openingOf(text)} : {})} : null,
    })
  }
  return out
}

/** The names a card field carries: its items, else its refs. */
const namesOf = (field: {readonly items?: readonly string[]; readonly refs?: readonly string[]} | null | undefined): string[] => strings(field?.items).length ? strings(field?.items) : strings(field?.refs)

/** The card as the design reads it (central__agent-identity.tsx cardOf). `runs_on` is left out: the card reports no program. */
export function identityCardOf(card: HumanAgentCard, extras: ProfileExtras | undefined): Record<string, Value | unknown> {
  const where = card.where_i_participate
  return {
    agent: card.identity.agent_ref,
    ...(str(where?.home_world_ref) ?? str(where?.world_ref) ? {home: str(where?.home_world_ref) ?? str(where?.world_ref)} : {}),
    ...(str(card.why_im_here?.text) ? {purpose: card.why_im_here.text} : {}),
    carries: {
      skill: namesOf(card.what_i_can_do), method: namesOf(card.how_i_work),
      ...(card.how_i_orient ? {methodology: namesOf(card.how_i_orient)} : {}),
      skillset: (card.what_i_carry?.skill_sets ?? []).map(set => set.ref),
    },
    ...(extras ? {ratified: extras.ratified, self: extras.self} : {}),
    character: !!card.character,
  }
}

export interface IdentityInput {
  /** The roster list, or its refusal; null while it reads. */
  readonly roster: {readonly agents: readonly Pick<RosterAgent, 'ref' | 'name' | 'role' | 'revision' | 'accepted'>[]} | {readonly error: string} | null
  /** The extras by agent ref (profileExtrasOf over the raw roster). */
  readonly extras: ReadonlyMap<string, ProfileExtras>
  /** The agent you talk to (the Answer's), when it reports one. */
  readonly talkingTo: string | null
  /** The card read for (agent, world): the card, or the owner's refusal; null while it reads. */
  readonly card: {readonly agent: string; readonly world: string | null; readonly card?: HumanAgentCard; readonly error?: string} | null
}

/** The agent whose card is read: the one you chose, else the one you talk to, else the roster's first accepted agent. */
export function identityAgentOf(id: string, input: Pick<IdentityInput, 'roster' | 'talkingTo'>): string | undefined {
  const chosen = heldOf(id).agent
  if (typeof chosen === 'string' && chosen) return chosen
  if (input.talkingTo) return input.talkingTo
  return input.roster && 'agents' in input.roster ? input.roster.agents.find(agent => agent.accepted)?.ref : undefined
}

/** The World the card is read in: null for Home (the profile's own). */
export function identityWorldOf(id: string): string | null {
  const world = heldOf(id).world
  return typeof world === 'string' && world && world !== 'home' ? world : null
}

/** Agent identity's readings (IDENTITY_WIRING). */
export function identityValues(id: string, input: IdentityInput): Values {
  const values: Record<string, Value> = {}
  const held = heldOf(id)
  values.proposed = held.proposed ?? false
  values.world = held.world ?? 'home'
  const agent = identityAgentOf(id, input)
  if (agent) values.agent = agent
  const roster = input.roster
  if (roster && 'error' in roster) {
    values.light = 'dark'; values.read = 'refused'; values.fault = roster.error
    return values
  }
  if (!roster) return values
  values.light = 'lit'
  values.read = 'read'
  values.roster = JSON.stringify(roster.agents.map(item => ({ref: item.ref, name: item.name, ...(item.role ? {role: item.role} : {}), ...(item.revision ? {revision: item.revision} : {}),
    accepted: item.accepted})))
  const extras = agent ? input.extras.get(agent) : undefined
  const card = input.card
  const world = identityWorldOf(id)
  if (card?.card && card.agent === agent && card.world === world) {
    values.card = JSON.stringify(identityCardOf(card.card, extras))
    const other = strings(card.card.where_i_participate?.other_worlds)
    values.worlds = JSON.stringify([...new Set([...(extras?.ratified ?? []), ...other])])
  } else if (extras) {
    values.worlds = JSON.stringify(extras.ratified)
  }
  return values
}

/** Agent identity's binding: readings only — the roster is yours and the device writes nothing; the agent, World and Proposed are
 * the view's own choices of what is read. A card the owner refused is said in its words on the Agent chooser. */
export function identityBinding(id: string, input: IdentityInput): DesignBinding {
  const binding = pageBinding(id, IDENTITY_WIRING, identityValues(id, input), {})
  const agent = identityAgentOf(id, input)
  const refused = input.card?.error && input.card.agent === agent ? input.card.error : undefined
  return refused ? {...binding, standing: {...binding.standing, agent: {...binding.standing?.agent, refused: `The card did not answer: ${refused}`}}} : binding
}
