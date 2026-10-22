// Agent identity (DLW §19.4, central:agent-identity) on its owners (lane BC3): who an agent is, read from your own roster, before the
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

/** Why Changed since stands absent: Actuation compares two realised receipts of one acting condition (`actuation realised continuity`, the
 * kernel's actuation_read {realised-continuity}), and the shell holds no realised receipt of the agent, so there is no second to compare. */
export const NO_SECOND_RECEIPT = 'Changed since: Actuation compares two realised receipts of the agent (`actuation realised continuity`, the kernel\'s actuation_read {realised-continuity}); no reading here holds a realised receipt of this agent, so no second receipt exists to compare with.'

export const IDENTITY_WIRING: DesignWiring = {
  design: IDENTITY_DESIGN,
  keys: ['light', 'agent', 'proposed', 'world', 'read', 'fault', 'marks', 'roster', 'card', 'worlds', 'types', 'continuity'],
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
    types: 'Central\'s profile names no type yet: an agent\'s type is set on the Agent device\'s Type page and held with the agent, and no reading of it reaches this chain.',
    // D7, Changed since (§19.4): what moved in the agent's body and identity between two realised receipts is Actuation's
    // `realised continuity` (the kernel's actuation_read {realised-continuity}, lane K0; EpiLogos/Actuation#143).
    continuity: NO_SECOND_RECEIPT,
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
  /** Two realised receipts of the agent the shell holds (actuation.realised/v1, earlier and later), and Actuation's continuity of them
   * (`actuation realised continuity`): the answer, or its refusal in Actuation's words. Absent: the shell holds no two receipts. */
  readonly realised?: {readonly previous: unknown; readonly next: unknown; readonly status: 'reading' | 'answered' | 'refused'; readonly value: unknown; readonly error: string | null} | null
}

/** Actuation's delta (actuation.realised-continuity/v1 `delta`) as the design reads Changed since (central__agent-identity.tsx `continuity`
 * {since, body: [{field, from, to}], identity: [{field, from, to}]}): each part Actuation says changed, with its value in each receipt —
 * the body's harness, session, process, model condition and material binding and the loop's recurrence; who the agent is (agent, agency,
 * world binding, actuation). `since` is the earlier receipt's ref. Null when the answer is not that reading. Pure. */
export function continuityOf(previous: unknown, next: unknown, answer: unknown): {since: string; body: {field: string; from?: string; to?: string}[]; identity: {field: string; from?: string; to?: string}[]} | null {
  if (!obj(answer) || answer.schema !== 'actuation.realised-continuity/v1' || !obj(answer.delta)) return null
  const delta = answer.delta
  const before = obj(previous) ? previous : {}, after = obj(next) ? next : {}
  const at = (receipt: Obj, path: readonly string[]): string | undefined => {
    let here: unknown = receipt
    for (const step of path) here = obj(here) ? here[step] : undefined
    return str(here)
  }
  const change = (field: string, path: readonly string[]) => ({field, ...(at(before, path) ? {from: at(before, path)} : {}), ...(at(after, path) ? {to: at(after, path)} : {})})
  const BODY: readonly [string, string, readonly string[]][] = [['harness_changed', 'harness', ['body', 'harness_ref']], ['session_changed', 'session', ['body', 'session_ref']],
    ['process_changed', 'process', ['body', 'process_ref']], ['model_condition_changed', 'model condition', ['body', 'model_condition_ref']],
    ['material_binding_changed', 'material binding', ['body', 'material_binding_ref']], ['recurrence_changed', 'recurrence', ['loop', 'recurrence']]]
  const IDENTITY: readonly [string, string, readonly string[]][] = [['same_agent', 'agent', ['agent_ref']], ['same_agency', 'agency', ['agency_ref']],
    ['same_world_binding', 'world binding', ['world_binding_ref']], ['same_actuation', 'actuation', ['actuation_ref']]]
  return {
    since: str(answer.previous_realised_ref) ?? at(before, ['realised_ref']) ?? 'the earlier receipt',
    body: BODY.filter(([key]) => delta[key] === true).map(([, field, path]) => change(field, path)),
    identity: IDENTITY.filter(([key]) => delta[key] === false).map(([, field, path]) => change(field, path)),
  }
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
  // Changed since: Actuation's continuity of the two realised receipts held (whatever the roster answered).
  const realised = input.realised?.status === 'answered' ? continuityOf(input.realised.previous, input.realised.next, input.realised.value) : null
  if (realised) values.continuity = JSON.stringify(realised)
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
  const values = identityValues(id, input)
  // Changed since: Actuation's continuity of the two receipts held, else why it stands absent (no second receipt; Actuation's refusal).
  const continuityWhy = 'continuity' in values ? null : input.realised?.status === 'refused' ? input.realised.error ?? 'Actuation refused the continuity.'
    : input.realised?.status === 'reading' ? 'Actuation has not answered the continuity of the two receipts yet (`actuation realised continuity`).'
      : input.realised?.status === 'answered' ? 'Actuation answered the continuity in a form the device does not read (actuation.realised-continuity/v1 expected).' : NO_SECOND_RECEIPT
  const base = pageBinding(id, IDENTITY_WIRING, values, {})
  const binding = continuityWhy ? {...base, standing: {...base.standing, continuity: {disabled: continuityWhy}}} : base
  const agent = identityAgentOf(id, input)
  const refused = input.card?.error && input.card.agent === agent ? input.card.error : undefined
  return refused ? {...binding, standing: {...binding.standing, agent: {...binding.standing?.agent, refused: `The card did not answer: ${refused}`}}} : binding
}
