// The Field scale (manual §17.2 "The five scales", "Aperture and view as"; O-I #858): the one system of everyone's worlds as the
// window's held SharedField shows it to you. A pure model: the held snapshot's world part in (shared-field/spacetimedb/field-lib.ts
// `worldReading`, read through the kernel's `shared_field` op), the scene the World draws out. No DOM, no React, no transport.
//
// Laws kept:
//   - The field decides what you may see: a row the field did not show you is not here, and nothing is inferred about it. Another
//     world is drawn as its owner showed it, clear in its clearings and under one even cloud elsewhere, at every View as.
//   - View as is your world's: you as you know it (no cloud), as the field sees it (what is shown to the field or the public), as the
//     public sees it (what is shown to the public). What is shown only at a star is not shown to the field. A world with Link off is
//     not among the others. The even cloud tells nobody what lies beneath it or how much: nothing here counts what is unshown.
//   - Aperture filters the one system and takes you nowhere: World (your world alone), Local (your world and the worlds it holds),
//     Shared (the worlds and stars you are gathered with), Federated (everything the field shows). What lies just past the edge is
//     counted and offered with the aperture that would show it.
//   - Your world is the one of yours whose body is your own body (the body record's ref): nothing names a world yours by its ref.
//
// The Palace's cloud is this cloud (palaces/palacesModel.ts underCloud): a private room is shown to you alone.

import {cloudedFor} from './systemStore'

/** How far you look (manual §17.2 Aperture). */
export type Aperture = 'world' | 'local' | 'shared' | 'federated'
export const APERTURES: readonly Aperture[] = ['world', 'local', 'shared', 'federated']

/** Who you look as (manual §17.2 View as; the Palace's Audience, §17.7). */
export type Audience = 'me' | 'field' | 'public'
export const AUDIENCES: readonly Audience[] = ['me', 'field', 'public']
export const APERTURE_LABEL: Readonly<Record<Aperture, string>> = {world: 'World', local: 'Local', shared: 'Shared', federated: 'Federated'}
export const AUDIENCE_LABEL: Readonly<Record<Audience, string>> = {me: 'Me', field: 'Field', public: 'Public'}

/** To whom a part was shown: you alone (unshown), the worlds gathered at a star, the field, or the public. */
export type ShownTo = 'me' | 'star' | 'field' | 'public'


/** The even cloud's one law (whether a part shown to `shownTo` lies under cloud for `audience`) is kept in system/systemStore.ts, which
 * the window's first load carries for the Palace's cloud, so that load does not carry this whole model (O-I #858; round 30b). */
export {cloudedFor}

// ── the held field's world part, as the client answers it ───────────────────────────────────────────────────────────────

export interface FieldWorld {
  readonly world_ref: string
  readonly body: unknown
  readonly linked: boolean
  readonly mine: boolean
  /** whether it answers (SF11; manual §2): while a window of its owner's stands, and since when; away once the last is gone, since when.
   * Null where the field keeps answers and has no word of this world answering; absent where the field's service keeps none. */
  readonly answer?: {readonly answering: boolean; readonly since: number | null} | null
}
export interface FieldClearing {
  readonly world_ref: string
  readonly part_ref: string
  readonly star_ref: string | null
  readonly audience: 'public' | 'field' | 'star'
  readonly shown: {readonly kind: string; readonly label: string}
  /** when it was last shown, ms since the epoch, where the row says */
  readonly at?: number | null
}
export interface FieldStar {
  readonly star_ref: string
  readonly name: string
  readonly gathers: string
  readonly comes: string
  readonly lit_by: string
  readonly mine: boolean
  readonly within?: string
}
export interface FieldGathering {
  readonly star_ref: string
  readonly world_ref: string
  readonly state: 'asked' | 'gathered'
}

/** What a star's day records (O-I #858, SF04, SF06, SF12, SF13): a world lit it, asked to come, came, was let in, showed something there
 * or took it back, said something there or unsaid it, offered a task there, revoked it, took one up or brought back what was made, left,
 * or was turned away by its lighter. */
export type StarDayWhat = 'lit' | 'asked' | 'came' | 'let-in' | 'showed' | 'took-back' | 'said' | 'unsaid' | 'offered' | 'revoked' | 'took' | 'brought-back' | 'left' | 'turned-away'
const STAR_DAY_WHATS: readonly StarDayWhat[] = ['lit', 'asked', 'came', 'let-in', 'showed', 'took-back', 'said', 'unsaid', 'offered', 'revoked', 'took', 'brought-back', 'left', 'turned-away']
/** One entry of a star's day, in the order the field gives: the kind of what was shown or said, never what it was; when it happened (ms
 * since the epoch), or null where the field gave no time. */
export interface FieldDayEntry {
  readonly star_ref: string
  readonly world_ref: string
  readonly what: StarDayWhat
  readonly kind: string | null
  readonly at: number | null
}

/** What is said at a star (SF06, the grammar of SF07): a question, a finding, a correction or a reproduction. */
export type SayingWhat = 'question' | 'finding' | 'correction' | 'reproduction'
export const SAYING_WHATS: readonly SayingWhat[] = ['question', 'finding', 'correction', 'reproduction']
/** One thing said at a star, as the field serves it: who said what, to something shown there (its part named only while you may see it)
 * or to something said there before, and when. */
export interface FieldSaying {
  readonly saying_ref: string
  readonly star_ref: string
  readonly world_ref: string
  readonly to_world_ref: string | null
  readonly to_part_ref: string | null
  readonly to_saying_ref: string | null
  readonly what: SayingWhat
  readonly words: string
  readonly at: number
}

/** How a world's agent is asked at a star (SF10; manual §2 "The agent that keeps that world is there to talk to"): by its name, by its role
 * (the Position its world keeps), or as the exact instance running. */
export type AgentBy = 'name' | 'role' | 'instance'
export const AGENT_BYS: readonly AgentBy[] = ['name', 'role', 'instance']
/** One thing a world asked another world's agent at a star, as the field serves it to the two worlds alone, and the agent's answer once it
 * answered: which agent, its words, the parts of its world it answered from (a part named only while you may see it) and the task its
 * world offers there it points to. */
export interface FieldAgentAsk {
  readonly ask_ref: string
  readonly star_ref: string
  readonly world_ref: string
  readonly to_world_ref: string
  readonly by: AgentBy
  readonly address: string
  readonly words: string
  readonly at: number | null
  readonly answer: {
    readonly agent: {readonly name: string; readonly role: string | null; readonly instance: string | null}
    readonly words: string
    readonly cites: readonly {readonly part_ref: string | null; readonly star_ref: string | null}[]
    readonly offer_ref: string | null
    readonly at: number | null
  } | null
}

/** A piece of work a world shows at a star (SF12), as the field serves it: Software Factory's `factory.shown-work/v1` of one Run, live
 * while the Run is open and its source answers, and as it was kept once it closed. */
export interface FieldWork {
  readonly star_ref: string
  readonly world_ref: string
  readonly work_ref: string
  readonly standing: string
  readonly revision: number
  readonly shown: Readonly<Record<string, unknown>>
  /** whether the window that showed it still answers for it (manual §17.2); null when the field's service keeps no answers */
  readonly answering?: boolean | null
  /** when it was last shown, ms since the epoch, as the field keeps it */
  readonly updated_at?: number | null
}
/** Where a task offered at a star stands (SF13). */
export type OfferState = 'open' | 'taken' | 'returned' | 'accepted' | 'revoked'
const OFFER_STATES: readonly OfferState[] = ['open', 'taken', 'returned', 'accepted', 'revoked']
/** A task offered at a star, as the field serves it: Software Factory's `factory.task-offer/v1` under its grant, the world that took it,
 * and what came back (`factory.task-offer-return/v1`, served to its offerer and its taker alone). */
export interface FieldOffer {
  readonly offer_ref: string
  readonly star_ref: string
  readonly world_ref: string
  readonly state: OfferState
  readonly taker_world_ref: string | null
  readonly offer: Readonly<Record<string, unknown>>
  readonly returned: Readonly<Record<string, unknown>> | null
  /** when its grant lapses, ms since the epoch */
  readonly lapses_at: number
  /** when it last moved (offered, taken, brought back, accepted or revoked), ms since the epoch, as the field keeps it */
  readonly moved_at: number | null
}

/** Where a world withdrew something from (SF14): the public (narrowed to the field, or withdrawn), the field, a star, or the world
 * itself, taken out of the field. */
export type WithdrawReach = 'public' | 'field' | 'star' | 'world'
const WITHDRAW_REACHES: readonly WithdrawReach[] = ['public', 'field', 'star', 'world']
/** What a world withdrew, as the field tells whoever read it (O-I #858, SF14): whose world, from what reach (and at which star), of what
 * kind and when; never which part, nor what it showed. */
export interface FieldWithdrawal {
  readonly world_ref: string
  readonly star_ref: string | null
  readonly reach: WithdrawReach
  readonly kind: string | null
  /** when, ms since the epoch */
  readonly at: number | null
}

/** What a contribution to another world is (SF07): what can be said at a star, or a claim that what it stands on is the same work as a
 * part its contributor's world shows (SF09, `same`). */
export type ContributionWhat = SayingWhat | 'same'
export const CONTRIBUTION_WHATS: readonly ContributionWhat[] = [...SAYING_WHATS, 'same']
/** The part a claim of the same work sets beside what it stands on (SF09): its contributor's, named while you may read it there. */
export interface ContributionBeside {readonly world_ref: string; readonly part_ref: string | null; readonly star_ref: string | null}
/** Where a contribution to another world stands (O-I #858, SF07): waiting for that world's owner, accepted into it, or refused. */
export type ContributionState = 'waiting' | 'accepted' | 'refused'
/** What a contribution stands on: a part a world shows (named while you may read it there), or a contribution above it. */
export type ContributionTo = {readonly world_ref: string; readonly part_ref: string | null; readonly star_ref: string | null} | {readonly contribution_ref: string}
/** A contribution as the field serves it: whose world it came from and the world it waits or stands in, what it stands on, what it is and
 * its words, where it stands and, under your own once answered, the owner's words. */
export interface FieldContribution {
  readonly contribution_ref: string
  readonly world_ref: string
  readonly from_world_ref: string
  readonly to: ContributionTo
  readonly what: ContributionWhat
  /** a claim of the same work's part beside it (SF09); null for every other contribution */
  readonly beside: ContributionBeside | null
  readonly words: string
  readonly state: ContributionState
  readonly answer: string | null
  /** when it came or was accepted, ms since the epoch */
  readonly at: number | null
}

/** A part of another world this window read that is no longer shown here, with nothing the field still keeps to say why (SF14): whose
 * world, the reach it was shown at (and at which star) and its kind; never which part, nor what it showed. */
export interface FieldGone {
  readonly world_ref: string
  readonly star_ref: string | null
  readonly reach: Exclude<WithdrawReach, 'world'>
  readonly kind: string | null
}

/** A watch a world of yours holds on another world (DLW build ruling 2026-11-06, from manual §2 "from someone you watch" and §17.2): yours
 * alone, the watched world never told and nothing counting who watches whom; since when. */
export interface FieldWatch {
  readonly world_ref: string
  readonly watched_world_ref: string
  readonly at: number | null
}

/** The field as the window last read it. `days` is each star's day as you may read it, or null with `dayWhy` when the field's service
 * keeps none; `sayings` what was said at each star, or null with `sayWhy` likewise; `works` and `offers` what is shown and offered at
 * each star, or null with `workWhy` likewise. */
export type HeldField =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly worlds: readonly FieldWorld[]; readonly clearings: readonly FieldClearing[]; readonly stars: readonly FieldStar[]; readonly gatherings: readonly FieldGathering[]
    readonly days: readonly FieldDayEntry[] | null; readonly dayWhy: string | null; readonly sayings: readonly FieldSaying[] | null; readonly sayWhy: string | null
    readonly works?: readonly FieldWork[] | null; readonly offers?: readonly FieldOffer[] | null; readonly workWhy?: string | null
    /** what the worlds withdrew (SF14), in the order it happened, or null with `withdrawWhy` when the field's service keeps none */
    readonly withdrawals?: readonly FieldWithdrawal[] | null; readonly withdrawWhy?: string | null
    /** the contributions you may read (SF07), in the order they came, or null with `contributeWhy` when the field's service keeps none */
    readonly contributions?: readonly FieldContribution[] | null; readonly contributeWhy?: string | null
    /** the watches your worlds hold, or null with `watchWhy` when the field's service keeps none (DLW build ruling 2026-11-06) */
    readonly watches?: readonly FieldWatch[] | null; readonly watchWhy?: string | null
    /** what your worlds asked another world's agent at a star and what was asked of your own agents, with each answer (SF10), or null with
     * `askWhy` when the field's service keeps none */
    readonly asks?: readonly FieldAgentAsk[] | null; readonly askWhy?: string | null
    /** how much of the worlds the reading holds: the whole field (Federated) or your circle (World, Local, Shared), when it says */
    readonly scope?: 'whole' | 'circle' | null
    /** what this window read of others that is no longer shown here, the field keeping nothing that says why (readParts) */
    readonly gone?: readonly FieldGone[]}

const NO_READING = 'The shared field gave no reading of its worlds.'
export const FIELD_BEING_READ = 'The shared field is being read.'
/** Why the Field scale's choices (Aperture, View as) cannot act now, in the field's own words, or undefined once it is read. */
export const heldFieldWhy = (held: HeldField): string | undefined =>
  held.state === 'read' ? undefined : held.state === 'reading' ? FIELD_BEING_READ : held.reason
export const NOT_AT_FIELD = 'The field and its stars are read at the Field scale: choose Field first.'
/** Why Aperture and View as cannot act now on a surface beside the World's face (its plate, its Technē compact): the field's own
 * words while it is not read, else until the Field is the scale drawn; undefined when they act. */
export const fieldChoiceWhy = (held: HeldField, field: boolean): string | undefined => heldFieldWhy(held) ?? (field ? undefined : NOT_AT_FIELD)
const NO_DAY = 'This field’s service does not keep a star’s day yet.'
const NO_SAYINGS = 'This field’s service does not keep what is said at a star yet.'
export const NO_WORKS = 'This field’s service does not keep work shown or tasks offered at a star yet.'
const NO_WITHDRAWALS = 'This field’s service does not keep what a world withdrew yet.'
const NO_CONTRIBUTIONS = 'This field’s service does not keep contributions to a world yet.'
const NO_WATCHES = 'This field’s service does not keep the worlds you watch yet.'
const NO_ASKS = 'This field’s service does not keep what is asked of a world’s agent yet.'
/** A grant stands for one to thirty days (Factory's and the field's own bound): the World's Days dial reads it, and the binding's grant.
 * Here, not in the binding, so the face reads it without the binding's imports (round 30b). */
export const GRANT_DAYS = {min: 1, max: 30} as const
const rec = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0
const rows = <T>(value: unknown, row: (item: Record<string, unknown>) => T | null): T[] =>
  Array.isArray(value) ? value.flatMap(item => { const made = rec(item) ? row(item) : null; return made ? [made] : [] }) : []

/** The world part of the held snapshot (the `shared_field` op's `snapshot` answer), or the field's own words when it holds none: the
 * client unavailable, or a service that does not hold worlds yet. A row that is not the contract's is left out, never mended. */
export function heldFieldOf(data: unknown): HeldField {
  if (!rec(data)) return {state: 'unavailable', reason: NO_READING}
  if (data.state === 'unavailable') return {state: 'unavailable', reason: text(data.detail) ? data.detail : NO_READING}
  const held = data.world_field
  if (rec(held) && held.state === 'unavailable') return {state: 'unavailable', reason: text(held.detail) ? held.detail : NO_READING}
  if (!rec(held) || held.state !== 'held') return {state: 'unavailable', reason: NO_READING}
  return {
    state: 'read',
    worlds: rows(data.worlds, row => text(row.world_ref) && typeof row.linked === 'boolean' && typeof row.mine === 'boolean'
      ? {world_ref: row.world_ref, body: row.body, linked: row.linked, mine: row.mine, ...answerOf(row)} : null),
    clearings: rows(data.clearings, row => text(row.world_ref) && text(row.part_ref) && (row.audience === 'public' || row.audience === 'field' || row.audience === 'star')
      && rec(row.shown) && text(row.shown.kind) && text(row.shown.label)
      ? {world_ref: row.world_ref, part_ref: row.part_ref, star_ref: text(row.star_ref) ? row.star_ref : null, audience: row.audience, shown: {kind: row.shown.kind, label: row.shown.label},
        at: atOf(row.shown_at_micros, row.at)} : null),
    stars: rows(data.stars, row => text(row.star_ref) && text(row.name) && text(row.gathers) && text(row.comes) && text(row.lit_by) && typeof row.mine === 'boolean'
      ? {star_ref: row.star_ref, name: row.name, gathers: row.gathers, comes: row.comes, lit_by: row.lit_by, mine: row.mine, ...(text(row.within) ? {within: row.within} : {})} : null),
    gatherings: rows(data.gatherings, row => text(row.star_ref) && text(row.world_ref) && (row.state === 'asked' || row.state === 'gathered')
      ? {star_ref: row.star_ref, world_ref: row.world_ref, state: row.state} : null),
    ...daysOf(data),
    ...sayingsOf(data),
    ...worksOf(data),
    ...withdrawalsOf(data),
    ...contributionsOf(data),
    ...watchesOf(data),
    ...asksOf(data),
    scope: data.world_scope === 'whole' || data.world_scope === 'circle' ? data.world_scope : null,
    gone: rows(data.gone, row => text(row.world_ref) && (row.reach === 'public' || row.reach === 'field' || row.reach === 'star')
      ? {world_ref: row.world_ref, star_ref: text(row.star_ref) ? row.star_ref : null, reach: row.reach as FieldGone['reach'], kind: text(row.kind) ? row.kind : null} : null),
  }
}

/** Whether a world answers, as a world row carries it (SF11): `answer` with whether it answers and since when, null where the field keeps
 * answers and holds no word of this world, and no key at all where its service keeps none. An answer that is not the contract's is no word. */
function answerOf(row: Record<string, unknown>): {answer?: FieldWorld['answer']} {
  if (!('answer' in row)) return {}
  const answer = row.answer
  return {answer: rec(answer) && typeof answer.answering === 'boolean' ? {answering: answer.answering, since: atOf(answer.since_micros, answer.since)} : null}
}

/** When a row says it happened, in ms since the epoch: micros as the client writes them (a decimal string), or ms as the binding hands a
 * row on (`at`); null for anything else. */
const atOf = (micros: unknown, ms: unknown): number | null =>
  typeof micros === 'string' && /^\d{1,20}$/.test(micros) ? Math.floor(Number(micros) / 1000) : typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? ms : null

/** Each star's day as the snapshot carries it, or the field's words when its service keeps none. */
function daysOf(data: Record<string, unknown>): {days: readonly FieldDayEntry[] | null; dayWhy: string | null} {
  const kept = data.star_day
  if (!rec(kept) || kept.state !== 'held') return {days: null, dayWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_DAY}
  return {
    days: rows(data.star_days, row => text(row.star_ref) && text(row.world_ref) && (STAR_DAY_WHATS as readonly unknown[]).includes(row.what)
      ? {star_ref: row.star_ref, world_ref: row.world_ref, what: row.what as StarDayWhat, kind: text(row.kind) ? row.kind : null, at: atOf(row.at_micros, row.at)} : null),
    dayWhy: null,
  }
}

/** What was said at each star as the snapshot carries it, or the field's words when its service keeps none. A saying is said to one
 * thing: something shown (its world, and its part while you may see it) or something said. */
function sayingsOf(data: Record<string, unknown>): {sayings: readonly FieldSaying[] | null; sayWhy: string | null} {
  const kept = data.star_saying
  if (!rec(kept) || kept.state !== 'held') return {sayings: null, sayWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_SAYINGS}
  const ref = (value: unknown) => (text(value) ? value : null)
  return {
    sayings: rows(data.star_sayings, row => {
      const at = atOf(row.said_at_micros, row.at), toWorld = ref(row.to_world_ref), toPart = ref(row.to_part_ref), toSaying = ref(row.to_saying_ref)
      const one = toSaying ? !toWorld && !toPart : toWorld !== null
      return text(row.saying_ref) && text(row.star_ref) && text(row.world_ref) && (SAYING_WHATS as readonly unknown[]).includes(row.what) && text(row.words) && at !== null && one
        ? {saying_ref: row.saying_ref, star_ref: row.star_ref, world_ref: row.world_ref, to_world_ref: toWorld, to_part_ref: toPart, to_saying_ref: toSaying, what: row.what as SayingWhat, words: row.words, at} : null
    }),
    sayWhy: null,
  }
}

/** What was asked of a world's agent at each star as the snapshot carries it (SF10), or the field's words when its service keeps none. */
function asksOf(data: Record<string, unknown>): {asks: readonly FieldAgentAsk[] | null; askWhy: string | null} {
  const kept = data.agent_ask
  if (!rec(kept) || kept.state !== 'held') return {asks: null, askWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_ASKS}
  const ref = (value: unknown) => (text(value) ? value : null)
  const answerOf = (answer: unknown): FieldAgentAsk['answer'] | undefined => {
    if (answer === null) return null
    if (!rec(answer) || !rec(answer.agent) || !text(answer.agent.name) || !text(answer.words) || !Array.isArray(answer.cites)) return undefined
    return {agent: {name: answer.agent.name, role: ref(answer.agent.role), instance: ref(answer.agent.instance)}, words: answer.words,
      cites: rows(answer.cites, cite => ({part_ref: ref(cite.part_ref), star_ref: ref(cite.star_ref)})), offer_ref: ref(answer.offer_ref), at: atOf(answer.answered_at_micros, answer.at)}
  }
  return {
    asks: rows(data.agent_asks, row => {
      const answer = answerOf(row.answer)
      return text(row.ask_ref) && text(row.star_ref) && text(row.world_ref) && text(row.to_world_ref) && (AGENT_BYS as readonly unknown[]).includes(row.by) && text(row.address)
        && text(row.words) && answer !== undefined
        ? {ask_ref: row.ask_ref, star_ref: row.star_ref, world_ref: row.world_ref, to_world_ref: row.to_world_ref, by: row.by as AgentBy, address: row.address, words: row.words,
          at: atOf(row.asked_at_micros, row.at), answer} : null
    }),
    askWhy: null,
  }
}

/** What is shown and offered at each star as the snapshot carries it, or the field's words when its service keeps none. A row that is not
 * the contract's is left out: a work carries Factory's shown document, an offer Factory's offer document under its grant. */
function worksOf(data: Record<string, unknown>): {works: readonly FieldWork[] | null; offers: readonly FieldOffer[] | null; workWhy: string | null} {
  const kept = data.star_work
  if (!rec(kept) || kept.state !== 'held') return {works: null, offers: null, workWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_WORKS}
  return {
    works: rows(data.star_works, row => text(row.star_ref) && text(row.world_ref) && text(row.work_ref) && text(row.standing) && typeof row.revision === 'number' && rec(row.shown)
      ? {star_ref: row.star_ref, world_ref: row.world_ref, work_ref: row.work_ref, standing: row.standing, revision: row.revision, shown: row.shown,
        answering: typeof row.answering === 'boolean' ? row.answering : null, updated_at: atOf(row.updated_at_micros, row.updated_at)} : null),
    offers: rows(data.star_offers, row => {
      const lapses = atOf(row.lapses_at_micros, row.lapses_at)
      return text(row.offer_ref) && text(row.star_ref) && text(row.world_ref) && (OFFER_STATES as readonly unknown[]).includes(row.state) && rec(row.offer) && lapses !== null
        ? {offer_ref: row.offer_ref, star_ref: row.star_ref, world_ref: row.world_ref, state: row.state as OfferState, taker_world_ref: text(row.taker_world_ref) ? row.taker_world_ref : null,
          offer: row.offer, returned: rec(row.returned) ? row.returned : null, lapses_at: lapses, moved_at: atOf(row.moved_at_micros, row.moved_at)} : null
    }),
    workWhy: null,
  }
}

/** What the worlds withdrew as the snapshot carries it, or the field's words when its service keeps none. */
function withdrawalsOf(data: Record<string, unknown>): {withdrawals: readonly FieldWithdrawal[] | null; withdrawWhy: string | null} {
  const kept = data.world_withdrawal
  if (!rec(kept) || kept.state !== 'held') return {withdrawals: null, withdrawWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_WITHDRAWALS}
  return {
    withdrawals: rows(data.world_withdrawals, row => text(row.world_ref) && (WITHDRAW_REACHES as readonly unknown[]).includes(row.reach)
      ? {world_ref: row.world_ref, star_ref: text(row.star_ref) ? row.star_ref : null, reach: row.reach as WithdrawReach, kind: text(row.kind) ? row.kind : null,
        at: atOf(row.withdrawn_at_micros, row.at)} : null),
    withdrawWhy: null,
  }
}

/** The contributions as the snapshot carries them, or the field's words when its service keeps none. A row stands on one thing. */
function contributionsOf(data: Record<string, unknown>): {contributions: readonly FieldContribution[] | null; contributeWhy: string | null} {
  const kept = data.world_contribution
  if (!rec(kept) || kept.state !== 'held') return {contributions: null, contributeWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_CONTRIBUTIONS}
  const toOf = (to: unknown): ContributionTo | null => !rec(to) ? null : text(to.contribution_ref) ? {contribution_ref: to.contribution_ref}
    : text(to.world_ref) ? {world_ref: to.world_ref, part_ref: text(to.part_ref) ? to.part_ref : null, star_ref: text(to.star_ref) ? to.star_ref : null} : null
  const besideOf = (at: unknown): ContributionBeside | null => (rec(at) && text(at.world_ref)
    ? {world_ref: at.world_ref, part_ref: text(at.part_ref) ? at.part_ref : null, star_ref: text(at.star_ref) ? at.star_ref : null} : null)
  return {
    contributions: rows(data.world_contributions, row => {
      const to = toOf(row.to), beside = besideOf(row.beside)
      // a claim of the same work stands on a part shown, with a part beside it; no other contribution carries one
      const formed = row.what === 'same' ? beside !== null && 'world_ref' in (to ?? {}) : (SAYING_WHATS as readonly unknown[]).includes(row.what)
      return text(row.contribution_ref) && text(row.world_ref) && text(row.from_world_ref) && to && formed && text(row.words)
        && (row.state === 'waiting' || row.state === 'accepted' || row.state === 'refused')
        ? {contribution_ref: row.contribution_ref, world_ref: row.world_ref, from_world_ref: row.from_world_ref, to, what: row.what as ContributionWhat,
          beside: row.what === 'same' ? beside : null, words: row.words, state: row.state,
          answer: rec(row.answer) && text(row.answer.words) ? row.answer.words : null, at: atOf(row.at_micros, row.at)} : null
    }),
    contributeWhy: null,
  }
}

/** The watches your worlds hold as the snapshot carries them, or the field's words when its service keeps none. */
function watchesOf(data: Record<string, unknown>): {watches: readonly FieldWatch[] | null; watchWhy: string | null} {
  const kept = data.world_watch
  if (!rec(kept) || kept.state !== 'held') return {watches: null, watchWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_WATCHES}
  return {
    watches: rows(data.world_watches, row => text(row.world_ref) && text(row.watched_world_ref)
      ? {world_ref: row.world_ref, watched_world_ref: row.watched_world_ref, at: atOf(row.watched_at_micros, row.at)} : null),
    watchWhy: null,
  }
}

// ── the scene ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SceneClearing {
  readonly part: string
  readonly label: string
  readonly kind: string
  readonly shownTo: Exclude<ShownTo, 'me'>
  readonly star: string | null
}
export interface SceneWorld {
  readonly ref: string
  readonly mine: boolean
  /** your own world: yours, with your own body */
  readonly yours: boolean
  readonly linked: boolean
  readonly bodyRef: string | null
  /** under the even cloud outside its clearings */
  readonly clouded: boolean
  /** why the chosen audience does not see this world at all, or null */
  readonly away: string | null
  readonly clearings: readonly SceneClearing[]
  /** the stars it is gathered at */
  readonly stars: readonly string[]
  /** what another's world withdrew from the field or the public, in the order it happened (SF14): read in words, never silently gone;
   * none for a world of yours */
  readonly withdrawn: readonly FieldWithdrawal[]
  /** another's world whose owner's machine is off (SF11): away, reading as its owner last left it, since when (null: not known); null
   * while it answers, for a world of yours, and where the field keeps no word of who answers */
  readonly left: {readonly since: number | null} | null
  /** another's world a world of yours watches (DLW build ruling 2026-11-06): yours to know alone */
  readonly watched: boolean
}
export interface SceneStar {
  readonly ref: string
  readonly name: string
  readonly gathers: string
  readonly comes: string
  readonly mine: boolean
  readonly within: string | null
  /** the worlds gathered at it, in the order the field gives */
  readonly gathered: readonly string[]
  /** worlds waiting at its edge with their request (the field shows them to the star's owner alone) */
  readonly waiting: number
  /** the worlds waiting at its edge, by ref, as the field shows them to you (all of them at your own star; at another's, your own
   * request alone) */
  readonly asking: readonly string[]
  /** where your own world stands at it: gathered, waiting at its edge, or not there */
  readonly yoursAt: 'gathered' | 'asked' | null
  /** its day as you may read it, in the order it happened; null when the field's service keeps none */
  readonly day: readonly FieldDayEntry[] | null
  /** what each world gathered at it shows there, in the order the field gives: who brought what */
  readonly shown: readonly SceneShown[]
  /** what was said at it, each under what it answers, in the order it was said; null when the field's service keeps none */
  readonly said: readonly SceneSaying[] | null
  /** the work each world shows at it (SF12), in the order it was shown; null when the field's service keeps none */
  readonly works: readonly SceneWork[] | null
  /** the tasks offered at it (SF13), in the order they were offered; null when the field's service keeps none */
  readonly offers: readonly SceneOffer[] | null
  /** what another's world took back here (SF14), in the order it happened */
  readonly withdrawn: readonly FieldWithdrawal[]
  /** the worlds gathered here whose owners' machines are off (SF11), by ref: away, as each was last left, since when */
  readonly left: Readonly<Record<string, {readonly since: number | null}>>
  /** what your worlds asked another world's agent here and what was asked of your own agents here (SF10), in the order it was asked;
   * null when the field's service keeps none */
  readonly asks?: readonly SceneAsk[] | null
}
/** One thing asked of a world's agent at a star, as the star reads it (SF10): the two worlds' alone. */
export interface SceneAsk {
  readonly ref: string
  /** asked by a world of yours (else asked of your own world's agent) */
  readonly mine: boolean
  readonly from: string
  readonly to: string
  readonly by: AgentBy
  readonly address: string
  readonly words: string
  readonly at: number | null
  /** the agent's answer: its name, its words, what it answered from (each part's name, or null for a part no longer shown to you) and the
   * task its world offers here it points to (its key), once it answered */
  readonly answer: {readonly agent: string; readonly words: string; readonly from: readonly (string | null)[]; readonly task: string | null; readonly at: number | null} | null
}
/** A piece of work shown at a star, as Software Factory showed it: its name, where it stands, its agents at work and what they made. */
export interface SceneWork {
  readonly world: string
  readonly who: string
  /** shown by a world of yours */
  readonly mine: boolean
  readonly workRef: string
  readonly name: string
  /** live while its Run is open, kept once it closed */
  readonly standing: string
  /** a live work whose window answers no more (§17.2): it reads as it was last shown, `shownAt` */
  readonly away: boolean
  readonly shownAt: number | null
  readonly revision: number
  readonly agents: readonly {readonly agent: string; readonly at: string}[]
  readonly made: readonly {readonly label: string; readonly standing: string}[]
}
/** A task offered at a star: what it asks under its grant, who offered and who took it, and what came back, under its maker's name. */
export interface SceneOffer {
  readonly ref: string
  readonly world: string
  readonly who: string
  /** offered by a world of yours */
  readonly mine: boolean
  readonly state: OfferState
  readonly taker: string | null
  /** taken by your own world */
  readonly yoursTook: boolean
  readonly key: string
  readonly asks: string
  readonly reads: readonly string[]
  readonly touches: readonly string[]
  readonly lapsesAt: number
  readonly returned: {readonly label: string; readonly summary: string; readonly by: string; readonly refs: readonly string[]} | null
  /** Factory's offer document, as the field carries it (a taker's Factory takes it up from this) */
  readonly doc: Readonly<Record<string, unknown>>
  readonly runRef: string | null
}
/** One thing a world shows at a star. */
export interface SceneShown {
  /** the choice that names it as what something is said to (shownId) */
  readonly id: string
  readonly world: string
  readonly who: string
  readonly label: string
  readonly kind: string
}
/** What a saying was said to: something shown at the star, something said there, something since unsaid, or something its world has
 * taken back (it lies under the cloud now, and only whose it was is named). */
export type SayingTo =
  | {readonly kind: 'shown'; readonly id: string; readonly who: string; readonly label: string}
  | {readonly kind: 'said'; readonly ref: string; readonly who: string; readonly what: SayingWhat}
  | {readonly kind: 'unsaid'}
  | {readonly kind: 'gone'; readonly who: string}
/** One thing said at a star, as the star reads it. */
export interface SceneSaying {
  readonly ref: string
  readonly world: string
  readonly who: string
  /** said by a world of yours */
  readonly mine: boolean
  readonly what: SayingWhat
  readonly words: string
  readonly to: SayingTo
  /** how far it stands under what it answers: 0 for what was said to something shown */
  readonly depth: number
  /** when it was said, ms since the epoch */
  readonly at: number
}
export interface FieldScene {
  readonly aperture: Aperture
  readonly viewAs: Audience
  readonly worlds: readonly SceneWorld[]
  readonly stars: readonly SceneStar[]
  /** what lies just past the edge, with the aperture that shows it; null when nothing does */
  readonly beyond: {readonly worlds: number; readonly stars: number; readonly wider: Aperture} | null
  /** one line on the view, or null */
  readonly note: string | null
  /** the worlds of others that left the field since you read them (SF14), at Shared and Federated; none at World and Local */
  readonly left: readonly FieldWithdrawal[]
  /** what you read of others that is no longer shown here, with nothing the field still keeps to say why (SF14), at Shared and
   * Federated; none at World and Local */
  readonly gone: readonly FieldGone[]
  /** your watches, from a world of yours to the world it watches, where the aperture holds both: drawn on your map alone, since the field
   * serves each its own watches and never another's (DLW build ruling 2026-11-06) */
  readonly watching: readonly {readonly from: string; readonly to: string}[]
  /** the claims of the same work this view reads (SF09) between two parts it draws: what each stands on and the part set beside it
   * (shownId), whose claim it is, and whether it is accepted; one that waits is read by its two worlds alone, so the field and the
   * public see none */
  readonly sames: readonly SceneSame[]
}
export interface SceneSame {readonly ref: string; readonly from: string; readonly to: string; readonly beside: string; readonly accepted: boolean}

export const LINK_OFF = 'Link is off: the field does not see this world.'
export const NOT_YOURS_YET = 'Your world is not in the field, or your own body is not read yet.'
const NO_FEDERATION = 'No other system is joined to this field.'

const bodyRefOf = (body: unknown): string | null => (rec(body) && text(body.body_ref) ? body.body_ref : null)

/** What one aperture holds of the field: the worlds and the stars. */
function inView(field: Extract<HeldField, {state: 'read'}>, aperture: Aperture, yours: string | null): {worlds: FieldWorld[]; stars: FieldStar[]} {
  const mine = field.worlds.filter(world => world.mine)
  if (aperture === 'world') return {worlds: mine.filter(world => yours !== null && bodyRefOf(world.body) === yours), stars: []}
  if (aperture === 'local') return {worlds: mine, stars: []}
  if (aperture === 'federated') return {worlds: [...field.worlds], stars: [...field.stars]}
  const mineRefs = new Set(mine.map(world => world.world_ref))
  const gathered = field.gatherings.filter(gathering => gathering.state === 'gathered')
  const at = new Set(gathered.filter(gathering => mineRefs.has(gathering.world_ref)).map(gathering => gathering.star_ref))
  const withMe = new Set(gathered.filter(gathering => at.has(gathering.star_ref)).map(gathering => gathering.world_ref))
  return {worlds: field.worlds.filter(world => world.mine || withMe.has(world.world_ref)), stars: field.stars.filter(star => at.has(star.star_ref))}
}

/** One world as the chosen audience sees it. Your own world follows View as; another is as its owner showed it to you. */
function sceneWorld(field: Extract<HeldField, {state: 'read'}>, world: FieldWorld, viewAs: Audience, yours: string | null): SceneWorld {
  const bodyRef = bodyRefOf(world.body)
  const own = world.mine
  const away = own && viewAs !== 'me' && !world.linked ? LINK_OFF : null
  const shown = away ? [] : field.clearings.filter(clearing => clearing.world_ref === world.world_ref && (!own || !cloudedFor(clearing.audience, viewAs)))
  return {
    ref: world.world_ref, mine: own, yours: own && yours !== null && bodyRef === yours, linked: world.linked, bodyRef,
    clouded: !(own && viewAs === 'me'), away,
    clearings: shown.map(clearing => ({part: clearing.part_ref, label: clearing.shown.label, kind: clearing.shown.kind, shownTo: clearing.audience, star: clearing.star_ref})),
    stars: field.gatherings.filter(gathering => gathering.world_ref === world.world_ref && gathering.state === 'gathered').map(gathering => gathering.star_ref),
    withdrawn: own ? [] : (field.withdrawals ?? []).filter(row => row.world_ref === world.world_ref && (row.reach === 'field' || row.reach === 'public')),
    left: worldLeft(world),
    watched: !own && (field.watches ?? []).some(watch => watch.watched_world_ref === world.world_ref && isMine(field, watch.world_ref)),
  }
}

/** Whether another's world is away (SF11; manual §2): no window of its owner's answers, so it reads as its owner last left it, since when
 * (null when the field has no word of when). Null while it answers, for a world of yours, and where the field keeps no word of who answers. */
export function worldLeft(world: FieldWorld): {readonly since: number | null} | null {
  if (world.mine || world.answer === undefined) return null
  if (world.answer === null) return {since: null}
  return world.answer.answering ? null : {since: world.answer.since}
}

/** What another world shows, said while its owner is away (SF11; manual §2): it reads as its owner last left it, saying when; an agent,
 * a machine or a work — anything live — says it is away, and nothing answers in its place. */
const LIVE_PARTS = new Set(['agent', 'machine', 'work'])
export function leftWords(who: string, kind: string, left: {readonly since: number | null}, now: number): string {
  const when = left.since === null ? null : starWhen(left.since, now)
  return LIVE_PARTS.has(kind) ? `It is away${when ? ` since ${when}` : ''}, with ${who}: nothing answers for it until ${who} is back.`
    : `It reads as ${who} last left it${left.since === null ? '' : ` ${starAt(left.since, now)}`}: ${who} is away.`
}

/** A world as a person reads its name: the last part of its ref. */
export const whoOf = (ref: string): string => ref.split(':').pop() || ref
/** The choice that names one thing shown at a star as what something is said to. */
export const shownId = (world: string, part: string): string => JSON.stringify([world, part])

function sceneStar(field: Extract<HeldField, {state: 'read'}>, star: FieldStar, yours: string | null): SceneStar {
  const at = field.gatherings.filter(gathering => gathering.star_ref === star.star_ref)
  const asking = at.filter(gathering => gathering.state === 'asked').map(gathering => gathering.world_ref)
  const own = yourFieldWorld(field, yours)
  const shown = field.clearings.filter(clearing => clearing.audience === 'star' && clearing.star_ref === star.star_ref)
    .map(clearing => ({id: shownId(clearing.world_ref, clearing.part_ref), world: clearing.world_ref, who: whoOf(clearing.world_ref), label: clearing.shown.label, kind: clearing.shown.kind}))
  return {
    ref: star.star_ref, name: star.name, gathers: star.gathers, comes: star.comes, mine: star.mine, within: star.within ?? null,
    gathered: at.filter(gathering => gathering.state === 'gathered').map(gathering => gathering.world_ref),
    waiting: asking.length, asking,
    yoursAt: (own === null ? undefined : at.find(gathering => gathering.world_ref === own)?.state) ?? null,
    day: field.days === null ? null : field.days.filter(entry => entry.star_ref === star.star_ref),
    shown,
    said: field.sayings === null ? null : threadOf(field, field.sayings.filter(saying => saying.star_ref === star.star_ref), shown),
    works: field.works == null ? null : field.works.filter(work => work.star_ref === star.star_ref).map(work => sceneWork(field, work)),
    offers: field.offers == null ? null : field.offers.filter(offer => offer.star_ref === star.star_ref).map(offer => sceneOffer(field, offer, own)),
    withdrawn: (field.withdrawals ?? []).filter(row => row.reach === 'star' && row.star_ref === star.star_ref && !isMine(field, row.world_ref)),
    asks: field.asks == null ? null : field.asks.filter(ask => ask.star_ref === star.star_ref).map(ask => sceneAsk(field, ask)),
    left: Object.fromEntries(at.filter(gathering => gathering.state === 'gathered').flatMap(gathering => {
      const world = field.worlds.find(one => one.world_ref === gathering.world_ref), left = world ? worldLeft(world) : null
      return left ? [[gathering.world_ref, left]] : []
    })),
  }
}

/** One ask of a world's agent as the star reads it (SF10): a part its answer drew on is named while you may see it. */
function sceneAsk(field: Extract<HeldField, {state: 'read'}>, ask: FieldAgentAsk): SceneAsk {
  const answer = ask.answer
  return {ref: ask.ask_ref, mine: isMine(field, ask.world_ref), from: ask.world_ref, to: ask.to_world_ref, by: ask.by, address: ask.address, words: ask.words, at: ask.at,
    answer: answer && {agent: answer.agent.name, words: answer.words, at: answer.at,
      from: answer.cites.map(cite => (cite.part_ref === null ? null
        : field.clearings.find(row => row.world_ref === ask.to_world_ref && row.part_ref === cite.part_ref && row.star_ref === cite.star_ref)?.shown.label ?? null)),
      task: answer.offer_ref === null ? null : (() => { const task = field.offers?.find(offer => offer.offer_ref === answer.offer_ref)?.offer.task
        return rec(task) && text(task.key) ? task.key : 'a task' })()}}
}

/** Whether a work stands live: shown while its Run is open, so it reads as it was last shown once its window answers no more (§17.2).
 * The field's own word for a work's standing, not the app's Live mode. */
const LIVE_WORK = 'live'
export const liveWork = (work: {readonly standing: string}): boolean => work.standing === LIVE_WORK
export const textsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter(text) : [])
export const isMine = (field: Extract<HeldField, {state: 'read'}>, ref: string): boolean => field.worlds.some(world => world.world_ref === ref && world.mine)
function sceneWork(field: Extract<HeldField, {state: 'read'}>, work: FieldWork): SceneWork {
  const shown = work.shown
  return {world: work.world_ref, who: whoOf(work.world_ref), mine: isMine(field, work.world_ref), workRef: work.work_ref, name: text(shown.name) ? shown.name : work.work_ref,
    standing: work.standing, away: liveWork(work) && work.answering === false, shownAt: work.updated_at ?? null, revision: work.revision,
    agents: rows(shown.agents, row => (text(row.agent) && text(row.at) ? {agent: row.agent, at: row.at} : null)),
    made: rows(shown.made, row => (text(row.label) && text(row.standing) ? {label: row.label, standing: row.standing} : null))}
}
function sceneOffer(field: Extract<HeldField, {state: 'read'}>, row: FieldOffer, own: string | null): SceneOffer {
  const task = rec(row.offer.task) ? row.offer.task : {}, grant = rec(row.offer.grant) ? row.offer.grant : {}, programme = rec(row.offer.programme) ? row.offer.programme : {}
  const back = row.returned, made = back && rec(back.made) ? back.made : null, by = back && rec(back.by) ? back.by : null
  return {ref: row.offer_ref, world: row.world_ref, who: whoOf(row.world_ref), mine: isMine(field, row.world_ref), state: row.state, taker: row.taker_world_ref,
    yoursTook: own !== null && row.taker_world_ref === own, key: text(task.key) ? task.key : '', asks: text(task.asks) ? task.asks : '',
    reads: textsOf(grant.reads), touches: textsOf(grant.touches), lapsesAt: row.lapses_at,
    returned: made && text(made.label) ? {label: made.label, summary: text(made.summary) ? made.summary : '', by: by && text(by.name) ? by.name : whoOf(row.taker_world_ref ?? ''), refs: textsOf(made.refs)} : null,
    doc: row.offer, runRef: text(programme.run_ref) ? programme.run_ref : null}
}

/** What was said at one star, each under what it answers, in the order it was said: what was said to something shown (or to something
 * since unsaid) stands at the top, with what answers it under it, to any depth. */
function threadOf(field: Extract<HeldField, {state: 'read'}>, sayings: readonly FieldSaying[], shown: readonly SceneShown[]): SceneSaying[] {
  const byRef = new Map(sayings.map(saying => [saying.saying_ref, saying]))
  const mine = new Set(field.worlds.filter(world => world.mine).map(world => world.world_ref))
  const toOf = (saying: FieldSaying): SayingTo => {
    if (saying.to_saying_ref !== null) {
      const said = byRef.get(saying.to_saying_ref)
      return said ? {kind: 'said', ref: said.saying_ref, who: whoOf(said.world_ref), what: said.what} : {kind: 'unsaid'}
    }
    const id = saying.to_part_ref === null ? null : shownId(saying.to_world_ref ?? '', saying.to_part_ref)
    const there = id === null ? undefined : shown.find(item => item.id === id)
    return there ? {kind: 'shown', id: there.id, who: there.who, label: there.label} : {kind: 'gone', who: whoOf(saying.to_world_ref ?? '')}
  }
  const order = [...sayings].sort((a, b) => a.at - b.at || (a.saying_ref < b.saying_ref ? -1 : 1))
  const under = new Map<string, FieldSaying[]>()
  const top: FieldSaying[] = []
  for (const saying of order) {
    const parent = saying.to_saying_ref !== null && byRef.has(saying.to_saying_ref) ? saying.to_saying_ref : null
    if (parent === null) top.push(saying)
    else under.set(parent, [...(under.get(parent) ?? []), saying])
  }
  const out: SceneSaying[] = []
  const walk = (saying: FieldSaying, depth: number) => {
    if (out.some(one => one.ref === saying.saying_ref)) return
    out.push({ref: saying.saying_ref, world: saying.world_ref, who: whoOf(saying.world_ref), mine: mine.has(saying.world_ref), what: saying.what, words: saying.words, to: toOf(saying), depth, at: saying.at})
    for (const reply of under.get(saying.saying_ref) ?? []) walk(reply, depth + 1)
  }
  for (const saying of top) walk(saying, 0)
  return out
}

export const SAID_VERB: Readonly<Record<SayingWhat, string>> = {question: 'asks about', finding: 'has a finding on', correction: 'corrects', reproduction: 'reproduces'}
/** What a saying was said to, in words. */
export function sayingToText(to: SayingTo): string {
  switch (to.kind) {
    case 'shown': return to.label
    case 'said': return `${to.who}’s ${to.what}`
    case 'unsaid': return 'something since unsaid'
    case 'gone': return `something ${to.who} no longer shows here`
  }
}
/** One thing said at a star in words: who said what to what. */
export function starSayingLine(saying: SceneSaying): string {
  return `${saying.who} ${SAID_VERB[saying.what]} ${sayingToText(saying.to)}: ${saying.words}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')
/** When something happened at a star, short, in this machine's civil time: the clock on the day it is (`07:35`), the day otherwise
 * (`3 Nov`). */
/** Who an ask was put to, in words (SF10): another's agent by its name, its role or the instance running; yours, as it was addressed. */
function askedWho(ask: SceneAsk): string {
  const whose = ask.mine ? `${whoOf(ask.to)}’s` : 'your'
  return ask.by === 'name' ? `${ask.address}, ${whose} agent` : ask.by === 'role' ? `${whose} ${ask.address}` : `${whose} agent running as ${whoOf(ask.address)}`
}
/** One ask of a world's agent as a line (SF10): who asked whom, and what. */
export function agentAskLine(ask: SceneAsk): string {
  return `${ask.mine ? 'You' : whoOf(ask.from)} asked ${askedWho(ask)}: ${ask.words}`
}
/** Its answer as a line (SF10): which agent, its words, and what of its world it answered from, or that it has not answered yet. */
export function agentAnswerLine(ask: SceneAsk): string {
  if (!ask.answer) return ask.mine ? `Waiting for ${askedWho(ask)}.` : 'Waiting for your agent’s answer.'
  const from = ask.answer.from.map(label => label ?? 'a part no longer shown here')
  return `${ask.answer.agent} answered: ${ask.answer.words}${from.length ? ` From ${from.join(', ')}.` : ''}${ask.answer.task ? ` It points to the task ${ask.answer.task} offered here.` : ''}`
}

export function starWhen(at: number, now: number): string {
  const when = new Date(at), today = new Date(now)
  const sameDay = when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth() && when.getDate() === today.getDate()
  return sameDay ? `${two(when.getHours())}:${two(when.getMinutes())}` : `${when.getDate()} ${MONTHS[when.getMonth()]}`
}
/** The same in a sentence: `at 07:35` on the day it is, `on 3 Nov` otherwise. */
export const starAt = (at: number, now: number): string => { const when = starWhen(at, now); return when.includes(':') ? `at ${when}` : `on ${when}` }

const DAY_WORDS: Readonly<Record<StarDayWhat, string>> = {
  lit: 'lit the star', asked: 'asked to come', came: 'came', 'let-in': 'was let in', showed: 'showed', 'took-back': 'took back', said: 'said', unsaid: 'unsaid',
  offered: 'offered', revoked: 'revoked', took: 'took', 'brought-back': 'brought back', left: 'left', 'turned-away': 'was turned away',
}
/** A kind of thing shown or offered at a star, as a day line names it. */
const kindWords = (kind: string | null): string => (kind === 'work' ? 'a piece of work' : kind ? `a ${kind}` : 'something')
const SAID_DAY: Readonly<Record<SayingWhat, string>> = {question: 'asked a question', finding: 'shared a finding', correction: 'made a correction', reproduction: 'shared a reproduction'}
/** One entry of a star's day in words: the world, and what it did there. What was shown or said is named by its kind, never by what it
 * was. */
export function starDayLine(entry: FieldDayEntry): string {
  const who = whoOf(entry.world_ref)
  const what = DAY_WORDS[entry.what]
  const said = entry.kind !== null && (SAYING_WHATS as readonly string[]).includes(entry.kind) ? entry.kind as SayingWhat : null
  if (entry.what === 'said') return said ? `${who} ${SAID_DAY[said]}` : `${who} said something`
  if (entry.what === 'unsaid') return said ? `${who} unsaid a ${said}` : `${who} unsaid something`
  if (entry.what === 'offered' || entry.what === 'revoked' || entry.what === 'took' || entry.what === 'brought-back') return `${who} ${what} ${kindWords(entry.kind ?? 'task')}`
  return entry.what === 'showed' || entry.what === 'took-back' ? `${who} ${what} ${kindWords(entry.kind)}` : `${who} ${what}`
}

/** What a world withdrew, in words (SF14): whose, what kind and from what reach; never which part, nor what it showed. */
export function withdrawnLine(entry: FieldWithdrawal): string {
  const who = whoOf(entry.world_ref)
  switch (entry.reach) {
    case 'world': return `${who}’s world left the field: what it showed is back under cloud`
    case 'star': return `${who} took back ${kindWords(entry.kind)} shown here`
    default: return `${who} withdrew ${kindWords(entry.kind)} from the ${entry.reach}`
  }
}
/** What a world withdrew where a line is short (a row beside its time): a world that left the field says only that, its whole sentence
 * (`withdrawnLine`) kept for the row's reader; every other withdrawal is short already. */
export function withdrawnName(entry: FieldWithdrawal): string {
  return entry.reach === 'world' ? `${whoOf(entry.world_ref)}’s world: left the field` : withdrawnLine(entry)
}

// ── what you read that is no longer shown here (SF14; DLW build ruling 2026-11-06) ────────────────────────────────────────
//
// The field keeps the last 64 things each world withdrew (shared-field/spacetimedb/src/index.ts WORLD_WITHDRAWAL_LIMIT), so a part you
// read can go with nothing left that says why. The window keeps what it read of others' parts, by whose world, which part and where it
// was shown, between readings; a part that is no longer there is accounted for by a withdrawal the field kept since (whose world, from
// that reach, of that kind, at that star), or by the world having left the field; one that left your view (another scope read, your own
// world out of the field or off the star, another world out of your circle, a star closed) is not gone. Anything else is no longer
// shown here, said in words with whose it was and its kind, never which part nor what it showed, and no reason is given for it but that
// it is older than the field keeps.

/** One part of another's world as this window read it: `key` is which (world, part, star), held in this window only. */
interface ReadPart extends FieldGone { readonly key: string }
/** What this window read of others' parts at one scope, the withdrawals the field kept at that reading, and what is no longer shown
 * here. */
export interface ReadParts {
  readonly scope: 'whole' | 'circle' | null
  readonly parts: readonly ReadPart[]
  readonly records: readonly string[]
  readonly gone: readonly FieldGone[]
  readonly goneKeys: readonly string[]
}
/** The most that is said to be gone at once: the oldest goes first. */
const GONE_LIMIT = 64
const recordKey = (row: FieldWithdrawal): string => JSON.stringify([row.world_ref, row.star_ref, row.reach, row.kind, row.at])

/** What the window reads of others' parts now, from what it read before (null at first): a reading that does not keep withdrawals, or
 * reads another scope, starts again and says nothing is gone. */
export function readParts(before: ReadParts | null, field: HeldField): ReadParts | null {
  if (field.state !== 'read') return before
  const scope = field.scope ?? null
  const parts: ReadPart[] = field.clearings.filter(row => !isMine(field, row.world_ref))
    .map(row => ({key: JSON.stringify([row.world_ref, row.part_ref, row.star_ref ?? '']), world_ref: row.world_ref, star_ref: row.star_ref, reach: row.audience, kind: row.shown.kind}))
  const records = (field.withdrawals ?? []).map(recordKey)
  if (!before || field.withdrawals == null || before.scope !== scope) return {scope, parts, records, gone: [], goneKeys: []}
  const here = new Set(parts.map(part => part.key))
  // the withdrawals kept since the last reading, each accounting for one part at most
  const known = [...before.records], fresh: FieldWithdrawal[] = []
  for (const row of field.withdrawals) {
    const at = known.indexOf(recordKey(row))
    if (at >= 0) known.splice(at, 1)
    else fresh.push(row)
  }
  const mine = field.worlds.filter(world => world.mine && world.linked).map(world => world.world_ref)
  const gathered = (star: string, world: string) => field.gatherings.some(row => row.star_ref === star && row.world_ref === world && row.state === 'gathered')
  const letIn = (star: string) => field.stars.some(row => row.star_ref === star && (row.mine || mine.some(world => gathered(star, world))))
  const circle = new Set(field.stars.filter(row => letIn(row.star_ref)).map(row => row.star_ref))
  const inCircle = (world: string) => field.gatherings.some(row => row.world_ref === world && row.state === 'gathered' && circle.has(row.star_ref))
  const inView = (part: ReadPart) => (part.reach === 'field' ? mine.length > 0 : part.reach === 'star' ? part.star_ref !== null && letIn(part.star_ref) : true)
    && (scope !== 'circle' || inCircle(part.world_ref))
  const said = (part: ReadPart): boolean => {
    const at = fresh.findIndex(row => row.world_ref === part.world_ref && (row.reach === 'world'
      || (row.reach === part.reach && row.kind === part.kind && (part.reach !== 'star' || row.star_ref === part.star_ref))))
    if (at < 0) return false
    if (fresh[at].reach !== 'world') fresh.splice(at, 1)
    return true
  }
  const went = before.parts.filter(part => !here.has(part.key) && inView(part) && !said(part))
  const kept = before.goneKeys.map((key, i) => [key, before.gone[i]] as const).filter(([key]) => !here.has(key))
  const all = [...kept, ...went.map(part => [part.key, {world_ref: part.world_ref, star_ref: part.star_ref, reach: part.reach, kind: part.kind}] as const)].slice(-GONE_LIMIT)
  return {scope, parts, records, gone: all.map(([, gone]) => gone), goneKeys: all.map(([key]) => key)}
}

let partsRead: ReadParts | null = null
/** The field as read, with what you read of others that is no longer shown here: the window keeps what it read between readings (the
 * pane's readings publish each reading through this, system/SystemReadings.tsx). */
export function withGone(field: HeldField): HeldField {
  if (field.state !== 'read') return field
  partsRead = readParts(partsRead, field)
  return {...field, gone: partsRead?.gone ?? []}
}

/** A part you read that is no longer shown here, in words (SF14): whose and what kind; no reason is given but that it is older than the
 * field keeps. `goneName` is its first half, standing where a line is short, with `GONE_OLDER` beside it. */
export const goneName = (entry: FieldGone): string => `${whoOf(entry.world_ref)}’s ${entry.kind === 'work' ? 'piece of work' : entry.kind || 'part'}: no longer shown here`
export const GONE_OLDER = 'older than kept'
export function goneLine(entry: FieldGone): string {
  return `${goneName(entry).replace(/: no longer/, ' you read is no longer')}: why is older than the field keeps`
}

/** The Field scale's scene: the worlds and stars the aperture holds, each world as the audience sees it, what lies past the edge. */
export function fieldScene(field: Extract<HeldField, {state: 'read'}>, view: {readonly aperture: Aperture; readonly viewAs: Audience}, yours: string | null): FieldScene {
  const here = inView(field, view.aperture, yours)
  const seen = {worlds: new Set(here.worlds.map(world => world.world_ref)), stars: new Set(here.stars.map(star => star.star_ref))}
  let beyond: FieldScene['beyond'] = null
  for (const wider of APERTURES.slice(APERTURES.indexOf(view.aperture) + 1)) {
    const there = inView(field, wider, yours)
    const worlds = there.worlds.filter(world => !seen.worlds.has(world.world_ref)).length, stars = there.stars.filter(star => !seen.stars.has(star.star_ref)).length
    if (worlds + stars > 0) { beyond = {worlds, stars, wider}; break }
  }
  const note = view.aperture === 'federated' ? NO_FEDERATION : view.aperture === 'world' && here.worlds.length === 0 ? NOT_YOURS_YET : null
  const worlds = here.worlds.map(world => sceneWorld(field, world, view.viewAs, yours))
  return {
    aperture: view.aperture, viewAs: view.viewAs,
    worlds,
    stars: here.stars.map(star => sceneStar(field, star, yours)),
    beyond, note,
    left: view.aperture === 'shared' || view.aperture === 'federated' ? (field.withdrawals ?? []).filter(row => row.reach === 'world' && !isMine(field, row.world_ref)) : [],
    gone: view.aperture === 'shared' || view.aperture === 'federated' ? field.gone ?? [] : [],
    watching: (field.watches ?? []).filter(watch => isMine(field, watch.world_ref) && !isMine(field, watch.watched_world_ref)
      && seen.worlds.has(watch.world_ref) && seen.worlds.has(watch.watched_world_ref)).map(watch => ({from: watch.world_ref, to: watch.watched_world_ref})),
    sames: scenedSames(field, worlds, view.viewAs),
  }
}

/** The claims of the same work (SF09) between two parts the scene draws: refused ones stand nowhere; one still waiting is its two worlds'
 * alone, so only you, as yourself, read it; a part of yours shows only where the chosen audience reads it. */
function scenedSames(field: Extract<HeldField, {state: 'read'}>, worlds: readonly SceneWorld[], viewAs: Audience): SceneSame[] {
  const drawn = new Set(worlds.filter(world => !world.away).flatMap(world => world.clearings.map(clearing => shownId(world.ref, clearing.part))))
  return (field.contributions ?? []).flatMap(row => {
    if (row.what !== 'same' || row.state === 'refused' || !('world_ref' in row.to) || row.to.part_ref === null || !row.beside || row.beside.part_ref === null) return []
    if (row.state === 'waiting' && viewAs !== 'me') return []
    const to = shownId(row.to.world_ref, row.to.part_ref), beside = shownId(row.beside.world_ref, row.beside.part_ref)
    return drawn.has(to) && drawn.has(beside) ? [{ref: row.contribution_ref, from: row.from_world_ref, to, beside, accepted: row.state === 'accepted'}] : []
  })
}

/** The scene from the values a device is handed (the binding's `field`, the held field's world part, and `fieldYours`), or null when
 * no field was read: the design draws what the binding read, at the aperture and audience the view chose. */
export function fieldSceneOf(field: unknown, view: {readonly aperture: Aperture; readonly viewAs: Audience}, yours: string | null): FieldScene | null {
  if (!rec(field)) return null
  const kept = Array.isArray(field.days) ? {state: 'held'} : {state: 'unavailable', detail: text(field.dayWhy) ? field.dayWhy : NO_DAY}
  const said = Array.isArray(field.sayings) ? {state: 'held'} : {state: 'unavailable', detail: text(field.sayWhy) ? field.sayWhy : NO_SAYINGS}
  const work = Array.isArray(field.works) ? {state: 'held'} : {state: 'unavailable', detail: text(field.workWhy) ? field.workWhy : NO_WORKS}
  const gone = Array.isArray(field.withdrawals) ? {state: 'held'} : {state: 'unavailable', detail: text(field.withdrawWhy) ? field.withdrawWhy : NO_WITHDRAWALS}
  const watch = Array.isArray(field.watches) ? {state: 'held'} : {state: 'unavailable', detail: text(field.watchWhy) ? field.watchWhy : NO_WATCHES}
  const asked = Array.isArray(field.asks) ? {state: 'held'} : {state: 'unavailable', detail: text(field.askWhy) ? field.askWhy : NO_ASKS}
  // the claims of the same work the binding read (SF09), the only contributions the scene draws
  const sames = Array.isArray(field.sames) ? {state: 'held'} : {state: 'unavailable', detail: NO_CONTRIBUTIONS}
  const held = heldFieldOf({...field, world_field: {state: 'held'}, star_day: kept, star_days: field.days, star_saying: said, star_sayings: field.sayings,
    star_work: work, star_works: field.works, star_offers: field.offers, world_withdrawal: gone, world_withdrawals: field.withdrawals, world_scope: field.scope,
    world_watch: watch, world_watches: field.watches, world_contribution: sames, world_contributions: field.sames, agent_ask: asked, agent_asks: field.asks})
  return held.state === 'read' ? fieldScene(held, view, yours) : null
}

// ── the Graph side (manual §17.2; TO10: "Turned to its graph, each star is a node with its worlds and each contribution an edge") ──
//
// The same scene laid out by connection: it holds no data of its own, so Aperture and View as filter it as they filter the Field scale,
// and what lies under the cloud is in no node, edge or count of it. What a world shows is a node tied to it, and to the star it is shown
// at; a contribution is an edge from its sayer's world to what it was said to, and one said to something taken back or unsaid ties
// nothing. What your world says at a star is said to the worlds gathered there, so the field and the public do not see it.

/** What a node of the field's graph is: a world, a star, something a world shows, or a work claimed the same in more than one world. */
export type FieldNodeKind = 'world' | 'star' | 'shown' | 'work'
export interface FieldGraphNode {
  readonly id: string
  readonly kind: FieldNodeKind
  readonly label: string
  /** a world of yours, a star you lit, or something a world of yours shows */
  readonly mine: boolean
  /** your own world */
  readonly yours: boolean
}
/** How two nodes are tied: a world gathered at a star or asking at its edge, a star within a star, a world showing something, something
 * shown at a star, a contribution said to something; a part held as one work with another, by a claim accepted (`same`) or still waiting
 * (`claimed`); or, for you alone, your world to a part another shows that bears the name of one of yours (`match`, SF09). */
export type FieldTie = 'gathered' | 'asks' | 'within' | 'shows' | 'at' | 'said' | 'same' | 'claimed' | 'match'
export interface FieldGraphEdge {
  readonly from: string
  readonly to: string
  readonly tie: FieldTie
}
export interface FieldGraph {
  readonly nodes: readonly FieldGraphNode[]
  readonly edges: readonly FieldGraphEdge[]
}

/** A name as two names are matched (SF09): the same letters and digits in the same order, whatever the case, accents, spaces or marks. */
export const nameKey = (name: string): string => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** The scene laid out by connection: its worlds, its stars and what each world shows as nodes, tied by gathering, showing and
 * contribution, each edge between two of its nodes. A work claimed the same in more than one world (SF09) stands once, as its own node,
 * each world's part tied to it, so the readings stand side by side; parts with one name stay two until someone claims they are one.
 * `yourNames`: the names of your own world's parts, shown or not, for the match drawn for you alone while you look as yourself: a part
 * another world shows that bears one is tied to your world, and nothing of it leaves this window. Pure. */
export function fieldGraph(scene: FieldScene, yourNames: readonly string[] = []): FieldGraph {
  const nodes: FieldGraphNode[] = [], edges: FieldGraphEdge[] = []
  const worlds = new Set(scene.worlds.filter(world => !world.away).map(world => world.ref))
  for (const world of scene.worlds) if (worlds.has(world.ref)) nodes.push({id: world.ref, kind: 'world', label: whoOf(world.ref), mine: world.mine, yours: world.yours})
  for (const star of scene.stars) nodes.push({id: star.ref, kind: 'star', label: star.name, mine: star.mine, yours: false})
  const ids = new Set(nodes.map(node => node.id))
  for (const world of scene.worlds) {
    if (!worlds.has(world.ref)) continue
    for (const clearing of world.clearings) {
      const id = shownId(world.ref, clearing.part)
      if (!ids.has(id)) { nodes.push({id, kind: 'shown', label: clearing.label, mine: world.mine, yours: false}); ids.add(id); edges.push({from: world.ref, to: id, tie: 'shows'}) }
      if (clearing.star !== null && ids.has(clearing.star)) edges.push({from: id, to: clearing.star, tie: 'at'})
    }
  }
  const tie = (from: string, to: string, kind: FieldTie) => { if (ids.has(from) && ids.has(to)) edges.push({from, to, tie: kind}) }
  const mine = new Set(scene.worlds.filter(world => world.mine).map(world => world.ref))
  for (const star of scene.stars) {
    for (const world of star.gathered) tie(world, star.ref, 'gathered')
    for (const world of star.asking) tie(world, star.ref, 'asks')
    if (star.within !== null) tie(star.ref, star.within, 'within')
    for (const saying of star.said ?? []) {
      if (scene.viewAs !== 'me' && mine.has(saying.world)) continue
      const to = saying.to.kind === 'shown' ? saying.to.id : saying.to.kind === 'said' ? (star.said ?? []).find(said => said.ref === (saying.to as {ref: string}).ref)?.world : undefined
      if (to !== undefined) tie(saying.world, to, 'said')
    }
  }
  // the same work in two worlds (SF09): each set of parts claimed one stands once, a work node labelled as the first claim's target
  const root = new Map<string, string>(), find = (id: string): string => { let at = id; while (root.has(at) && root.get(at) !== at) at = root.get(at)!; return at }
  for (const same of scene.sames) {
    if (!ids.has(same.to) || !ids.has(same.beside)) continue
    for (const id of [same.to, same.beside]) if (!root.has(id)) root.set(id, id)
    const [a, b] = [find(same.to), find(same.beside)]
    if (a !== b) root.set(b, a)
  }
  const accepted = new Set(scene.sames.filter(same => same.accepted).flatMap(same => [same.to, same.beside]))
  const works = new Map<string, string>()
  for (const same of scene.sames) {
    if (!root.has(same.to)) continue
    const top = find(same.to)
    if (works.has(top)) continue
    const id = `work:${top}`, label = nodes.find(node => node.id === same.to)?.label ?? ''
    works.set(top, id)
    nodes.push({id, kind: 'work', label, mine: false, yours: false}); ids.add(id)
  }
  for (const id of root.keys()) edges.push({from: id, to: works.get(find(id))!, tie: accepted.has(id) ? 'same' : 'claimed'})
  // for you alone, as yourself: what another shows by the name of a part of yours, unless it is already held one work with yours
  const you = nodes.find(node => node.kind === 'world' && node.yours), names = new Set(yourNames.map(nameKey).filter(Boolean))
  if (you && scene.viewAs === 'me' && names.size) {
    const yoursHeld = new Set([...root.keys()].filter(id => nodes.find(node => node.id === id)?.mine).map(id => find(id)))
    for (const node of nodes) {
      if (node.kind === 'shown' && !node.mine && names.has(nameKey(node.label)) && !(root.has(node.id) && yoursHeld.has(find(node.id)))) edges.push({from: you.id, to: node.id, tie: 'match'})
    }
  }
  return {nodes, edges}
}

// ── the acts at a star (manual §17.2 items 9 and 10: Light a star, Gather, Leave; a world you have not let in waits at its edge) ─
//
// A star stays in the hands of whoever lit it, and a world gathered at a star stays its owner's: your world gathers, leaves and
// lights; at your own star you let a waiting world in and close it. Each act is one request of the held SharedField client (the
// kernel's `shared_field` op, shared-field/spacetimedb/field.ts worldAct), asked for your own world (the one of yours whose body is
// your own body), or the reason it cannot be asked, in words a person reads. The field decides in the end: a refusal it gives is
// passed on as it gave it.

/** Who may come to a star: anyone, or a world its lighter lets in. */
export type StarComes = 'anyone' | 'asked'
export const STAR_COMES: readonly StarComes[] = ['anyone', 'asked']

export type StarAct =
  | {readonly act: 'light'; readonly name: string; readonly gathers: string; readonly comes: StarComes}
  | {readonly act: 'gather' | 'leave' | 'close'; readonly star: string | null}
  | {readonly act: 'admit'; readonly star: string | null; readonly world: string | null}
  /** say something at the star to what `to` names (shownId, or a saying's ref) */
  | {readonly act: 'say'; readonly star: string | null; readonly to: string | null; readonly what: string; readonly words: string}
  | {readonly act: 'unsay'; readonly star: string | null; readonly saying: string | null}
  /** ask the agent of `world` (gathered at the star) by its name, its role or the exact instance running (SF10) */
  | {readonly act: 'ask'; readonly star: string | null; readonly world: string | null; readonly by: AgentBy | null; readonly address: string; readonly words: string}
  | {readonly act: 'unask'; readonly star: string | null; readonly ask: string | null}

/** Your world in the field: the one of yours whose body is your own body, or null. */
export function yourFieldWorld(field: Extract<HeldField, {state: 'read'}>, yours: string | null): string | null {
  if (yours === null) return null
  return field.worlds.find(world => world.mine && bodyRefOf(world.body) === yours)?.world_ref ?? null
}

export const NO_STAR = 'Choose a star first.'
const NOTHING_TO_UNSAY = 'Choose something your world said, in what was said here.'
/** How each way of asking a world's agent is spelled (SF10), as the field takes it: a name of one word (no @, which the gateway adds), a
 * role as its Position names it, or the instance running as Actuation names it. */
const AGENT_ADDRESS: Readonly<Record<AgentBy, RegExp>> = {name: /^[^\s@][^\s]{0,63}$/u, role: /^[a-z0-9][a-z0-9-]{0,63}$/, instance: /^actuation:generation:[A-Za-z0-9._:-]{1,200}$/}
const AGENT_ADDRESS_WORDS: Readonly<Record<AgentBy, string>> = {
  name: 'An agent’s name is one word of at most 64 characters, without the @.',
  role: 'An agent’s role is the name of its Position: lowercase letters, digits and dashes, at most 64.',
  instance: 'The exact instance running is named actuation:generation: and its id.',
}
const ADDRESS_FIRST: Readonly<Record<AgentBy, string>> = {name: 'Write the agent’s name first.', role: 'Write the agent’s role first.', instance: 'Write the instance running first.'}
/** A new ask's ref, from the world that asks and a nonce (the moment it is asked): the field names an ask ask:<name>, once. */
const askRefOf = (world: string, nonce: number): string => `ask:${world.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(-120)}:${Math.abs(Math.trunc(nonce)).toString(36)}`
/** A new saying's ref, from the world that says it and a nonce (the moment it is said): the field names a saying saying:<name>, once. */
const sayingRefOf = (world: string, nonce: number): string => `saying:${world.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(-120)}:${Math.abs(Math.trunc(nonce)).toString(36)}`
export const NOT_IN_FIELD = 'That star is not in the field you see.'
/** A name as a ref's last part: lower case, letters and digits, one hyphen between words, at most 60 characters. */
const slugOf = (name: string): string => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
/** A new star's ref, from its name and a nonce (the moment it is lit): the field names a star star:<name>, once. */
const starRefOf = (name: string, nonce: number): string => `star:${slugOf(name) || 'star'}-${Math.abs(Math.trunc(nonce)).toString(36)}`

/** The SharedField request for one act at a star, asked for your own world, or why it cannot be asked. */
export function starRequest(field: HeldField, yours: string | null, act: StarAct, nonce: number): {readonly request: Record<string, unknown>} | {readonly refusal: string} {
  if (field.state === 'reading') return {refusal: 'The shared field is being read.'}
  if (field.state === 'unavailable') return {refusal: field.reason}
  const world = yourFieldWorld(field, yours)
  if (act.act === 'light') {
    if (!world) return {refusal: NOT_YOURS_YET}
    if (!act.name.trim()) return {refusal: 'Name the star first.'}
    if ([...act.name].length > 120) return {refusal: 'A star is named in at most 120 characters.'}
    if (!act.gathers.trim()) return {refusal: 'Say what the star gathers first.'}
    if ([...act.gathers].length > 280) return {refusal: 'Say what the star gathers in at most 280 characters.'}
    if (!STAR_COMES.includes(act.comes)) return {refusal: 'A star lets anyone come, or asks you to let each world in.'}
    if (!field.worlds.find(row => row.world_ref === world)?.linked) return {refusal: 'Link your world into the field before you light a star.'}
    return {request: {kind: 'star-light', star_ref: starRefOf(act.name, nonce), world_ref: world, name: act.name.trim(), gathers: act.gathers.trim(), comes: act.comes}}
  }
  if (!act.star) return {refusal: NO_STAR}
  const star = field.stars.find(row => row.star_ref === act.star)
  if (!star) return {refusal: NOT_IN_FIELD}
  const at = (ref: string | null) => (ref ? field.gatherings.find(row => row.star_ref === star.star_ref && row.world_ref === ref)?.state ?? null : null)
  switch (act.act) {
    case 'gather': {
      if (!world) return {refusal: NOT_YOURS_YET}
      const now = at(world)
      if (now === 'gathered') return {refusal: 'Your world is already gathered at that star.'}
      if (now === 'asked') return {refusal: 'Your world already waits at that star’s edge for its lighter to let it in.'}
      if (!field.worlds.find(row => row.world_ref === world)?.linked) return {refusal: 'Link your world into the field before you gather at a star.'}
      return {request: {kind: 'star-gather', star_ref: star.star_ref, world_ref: world}}
    }
    case 'leave': {
      if (!world) return {refusal: NOT_YOURS_YET}
      if (!at(world)) return {refusal: 'Your world is not at that star.'}
      return {request: {kind: 'star-leave', star_ref: star.star_ref, world_ref: world}}
    }
    case 'admit': {
      if (!star.mine) return {refusal: 'Only the one who lit a star lets worlds in.'}
      if (!act.world) return {refusal: 'Choose a world waiting at the star’s edge first.'}
      if (at(act.world) !== 'asked') return {refusal: 'That world is not waiting at this star’s edge.'}
      return {request: {kind: 'star-admit', star_ref: star.star_ref, world_ref: act.world}}
    }
    case 'close': {
      if (!star.mine) return {refusal: 'Only the one who lit a star closes it.'}
      if (field.stars.some(row => row.within === star.star_ref)) return {refusal: 'Close the stars inside this one first.'}
      return {request: {kind: 'star-close', star_ref: star.star_ref}}
    }
    case 'say': {
      if (field.sayings === null) return {refusal: field.sayWhy ?? NO_SAYINGS}
      if (!world) return {refusal: NOT_YOURS_YET}
      if (at(world) !== 'gathered') return {refusal: 'Your world says things at a star only while it is gathered there.'}
      if (!field.worlds.find(row => row.world_ref === world)?.linked) return {refusal: 'Link your world into the field before you say anything at a star.'}
      if (!act.to) return {refusal: 'Choose what to say it to: something shown at the star, or something said there.'}
      const said = field.sayings.find(row => row.saying_ref === act.to && row.star_ref === star.star_ref)
      const shown = said ? undefined : field.clearings.find(row => row.audience === 'star' && row.star_ref === star.star_ref && shownId(row.world_ref, row.part_ref) === act.to)
      if (!said && !shown) return {refusal: 'That is no longer shown or said at this star.'}
      if (!(SAYING_WHATS as readonly string[]).includes(act.what)) return {refusal: 'Say a question, a finding, a correction or a reproduction.'}
      const words = act.words.trim()
      if (!words) return {refusal: 'Say something first.'}
      if ([...words].length > 1000) return {refusal: 'Say it in at most 1000 characters.'}
      return {request: {kind: 'star-say', saying_ref: sayingRefOf(world, nonce), star_ref: star.star_ref, world_ref: world,
        to: said ? {saying_ref: said.saying_ref} : {world_ref: shown!.world_ref, part_ref: shown!.part_ref}, what: act.what, words}}
    }
    case 'ask': {
      if (field.asks == null) return {refusal: field.askWhy ?? NO_ASKS}
      if (!world) return {refusal: NOT_YOURS_YET}
      if (at(world) !== 'gathered') return {refusal: 'Your world asks at a star only while it is gathered there.'}
      if (!field.worlds.find(row => row.world_ref === world)?.linked) return {refusal: 'Link your world into the field before you ask anything at a star.'}
      if (!act.world) return {refusal: 'Choose the world whose agent to ask: one gathered at the star.'}
      if (act.world === world) return {refusal: 'At a star your world asks another world’s agent; your own is asked at home.'}
      if (at(act.world) !== 'gathered') return {refusal: 'That world is not gathered at this star.'}
      if (!act.by || !AGENT_BYS.includes(act.by)) return {refusal: 'Ask its agent by its name, its role or the exact instance running.'}
      const address = act.address.trim()
      if (!address) return {refusal: ADDRESS_FIRST[act.by]}
      if (!AGENT_ADDRESS[act.by].test(address)) return {refusal: AGENT_ADDRESS_WORDS[act.by]}
      const words = act.words.trim()
      if (!words) return {refusal: 'Ask something first.'}
      if ([...words].length > 1000) return {refusal: 'Ask it in at most 1000 characters.'}
      return {request: {kind: 'world-agent-ask', ask_ref: askRefOf(world, nonce), star_ref: star.star_ref, world_ref: world, to_world_ref: act.world, by: act.by, address, words}}
    }
    case 'unask': {
      if (field.asks == null) return {refusal: field.askWhy ?? NO_ASKS}
      const asked = act.ask ? field.asks.find(row => row.ask_ref === act.ask && row.star_ref === star.star_ref) : undefined
      if (!asked) return {refusal: 'Choose something your world asked, in what was asked here.'}
      if (!isMine(field, asked.world_ref)) return {refusal: 'Only the world that asked takes an ask back.'}
      return {request: {kind: 'world-agent-unask', ask_ref: asked.ask_ref}}
    }
    case 'unsay': {
      if (field.sayings === null) return {refusal: field.sayWhy ?? NO_SAYINGS}
      const said = act.saying ? field.sayings.find(row => row.saying_ref === act.saying && row.star_ref === star.star_ref) : undefined
      if (!said) return {refusal: NOTHING_TO_UNSAY}
      if (!field.worlds.find(row => row.world_ref === said.world_ref)?.mine) return {refusal: 'Only the one who said it unsays it.'}
      return {request: {kind: 'star-unsay', saying_ref: said.saying_ref}}
    }
  }
}

// ── your world in the field: Link, Show and Withdraw (manual §17.2; O-I #858 SF01, SF02, SF14) ───────────────────────────
//
// Link puts your world into the field with your own body, the record every viewer draws the same planet from and nothing beside it; Show
// opens a clearing for one part of your world (a place on your body, or a world of yours that lands on it) at the reach you choose;
// Withdraw puts a clearing back under cloud everywhere at once, and Unlink takes your world out, leaving everything in it as it was. By
// the hold law (manual §16.10; DLW build ruling 2026-11-06) Link and Show raise your world's reach and are held; Unlink and Withdraw
// narrow it and are pressed. Each is one request of the held field, refused here in words where it cannot be asked.

/** Who is to see a part your world shows: the field, the public, or the worlds gathered at a star. */
export type ShowTo = Exclude<ShownTo, 'me'>
export const SHOW_TOS: readonly ShowTo[] = ['field', 'public', 'star']
/** A part of your world that may be shown: its ref, its kind as the field names kinds, its name, and where it stands on your body. */
export interface YourPart {
  readonly id: string
  readonly kind: string
  readonly label: string
  readonly at?: {readonly lat: number; readonly lon: number}
}
/** One act on your world in the field. `body` is your own body's record as its owner last answered it, or null while it is not read. */
export type YourAct =
  | {readonly act: 'link'; readonly name: string; readonly body: unknown}
  | {readonly act: 'unlink'}
  | {readonly act: 'show'; readonly part: YourPart | null; readonly to: ShowTo | null; readonly star: string | null}
  | {readonly act: 'withdraw'; readonly shown: string | null}

/** The choice that names one thing your world shows: its part, and the star it is shown at. */
export const shownKey = (part: string, star: string | null): string => JSON.stringify([part, star ?? ''])
/** One thing your world shows, and to whom. */
export interface YourShown {
  readonly id: string
  readonly part: string
  readonly label: string
  readonly kind: string
  readonly reach: ShowTo
  readonly star: string | null
}
/** What your world shows, in the order the field gives: nobody else's. */
export function yourShown(field: HeldField, yours: string | null): YourShown[] {
  if (field.state !== 'read') return []
  const world = yourFieldWorld(field, yours)
  return world === null ? [] : field.clearings.filter(clearing => clearing.world_ref === world)
    .map(clearing => ({id: shownKey(clearing.part_ref, clearing.star_ref), part: clearing.part_ref, label: clearing.shown.label, kind: clearing.shown.kind, reach: clearing.audience, star: clearing.star_ref}))
}
/** How much of your world you show, by reach, in a line. */
export function shownLoad(shown: readonly YourShown[]): string {
  const count = (reach: ShowTo) => shown.filter(row => row.reach === reach).length
  const parts = [[count('public'), 'to the public'], [count('field'), 'to the field'], [count('star'), 'at a star']] as const
  const said = parts.filter(([n]) => n > 0).map(([n, where]) => `${n} ${where}`)
  return said.length ? said.join(', ') : 'nothing: all of it is under cloud'
}

const num = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
/** A body record as the field takes it (`aikit.world-body/v1`, exactly): its own keys and nothing that rides along; null for what is no
 * body record. */
export function fieldBodyOf(body: unknown): Record<string, unknown> | null {
  if (!rec(body) || !text(body.body_ref) || !num(body.seed) || !rec(body.generator) || !rec(body.landmass) || !rec(body.climate) || !rec(body.sky)) return null
  const {generator: g, landmass: l, climate: c, sky: k, landing} = body
  return {
    body_ref: body.body_ref, seed: body.seed, generator: {id: g.id, version: g.version},
    landmass: {sea_level: l.sea_level, continents: l.continents, relief: l.relief, coast: l.coast},
    climate: {warmth: c.warmth, moisture: c.moisture, ice_caps: c.ice_caps},
    sky: {atmosphere: k.atmosphere, clouds: k.clouds, axial_tilt_deg: k.axial_tilt_deg},
    ...(rec(landing) ? {landing: {on_ref: landing.on_ref, lat: landing.lat, lon: landing.lon}} : {}),
  }
}

const NOT_IN_THE_FIELD = 'Your world is not in the field.'
const LINK_FIRST = 'Link your world into the field before you show anything.'
const BODY_UNREAD = 'Your own body is not read yet: it is what the field draws your world with.'
/** A new world's ref, from the name it is to stand under and a nonce (the moment it is linked): the field names a world world:<name>,
 * once, and reads its name as the last part of its ref. */
const worldRefOf = (name: string, nonce: number): string => `world:${Math.abs(Math.trunc(nonce)).toString(36)}:${slugOf(name) || 'world'}`

/** The SharedField request for one act on your world in the field, or why it cannot be asked. */
export function yourRequest(field: HeldField, yours: string | null, act: YourAct, nonce: number): {readonly request: Record<string, unknown>} | {readonly refusal: string} {
  if (field.state === 'reading') return {refusal: FIELD_BEING_READ}
  if (field.state === 'unavailable') return {refusal: field.reason}
  const ref = yourFieldWorld(field, yours)
  const world = ref === null ? undefined : field.worlds.find(row => row.world_ref === ref)
  switch (act.act) {
    case 'link': {
      if (world?.linked) return {refusal: 'Your world is in the field already.'}
      const own = yours !== null && rec(act.body) && act.body.body_ref === yours ? fieldBodyOf(act.body) : null
      if (world) {
        const body = own ?? fieldBodyOf(world.body)
        return body ? {request: {kind: 'world-put', world_ref: world.world_ref, body, linked: true}} : {refusal: BODY_UNREAD}
      }
      const name = act.name.trim()
      if (!name) return {refusal: 'Name your world as the field will show it first.'}
      if ([...name].length > 60) return {refusal: 'Name your world in at most 60 characters.'}
      if (!own) return {refusal: BODY_UNREAD}
      return {request: {kind: 'world-put', world_ref: worldRefOf(name, nonce), body: own, linked: true}}
    }
    case 'unlink': {
      const body = world?.linked ? fieldBodyOf(world.body) : null
      if (!world?.linked || !body) return {refusal: NOT_IN_THE_FIELD}
      return {request: {kind: 'world-put', world_ref: world.world_ref, body, linked: false}}
    }
    case 'show': {
      if (!world?.linked) return {refusal: LINK_FIRST}
      if (!act.part) return {refusal: 'Choose a part of your world to show first.'}
      if (!act.to || !SHOW_TOS.includes(act.to)) return {refusal: 'Choose who sees it first: the field, the public, or the worlds at the chosen star.'}
      const star = act.to === 'star' ? act.star : null
      if (act.to === 'star') {
        if (!star) return {refusal: NO_STAR}
        if (!field.stars.some(row => row.star_ref === star)) return {refusal: NOT_IN_FIELD}
        if (!field.gatherings.some(row => row.star_ref === star && row.world_ref === world.world_ref && row.state === 'gathered')) return {refusal: 'Your world shows things at a star only while it is gathered there.'}
      }
      const label = act.part.label.trim()
      if (!label || [...label].length > 160) return {refusal: 'A part is named in at most 160 characters.'}
      const shown = {kind: act.part.kind, label, ...(act.part.at ? {at: {lat: act.part.at.lat, lon: act.part.at.lon}} : {})}
      const now = field.clearings.find(row => row.world_ref === world.world_ref && row.part_ref === act.part!.id && row.star_ref === star)
      if (now && now.audience === act.to && now.shown.kind === shown.kind && now.shown.label === shown.label) return {refusal: 'It is shown so already.'}
      return {request: {kind: 'clearing-open', world_ref: world.world_ref, part_ref: act.part.id, audience: act.to, shown, ...(star ? {star_ref: star} : {})}}
    }
    case 'withdraw': {
      if (!world) return {refusal: NOT_IN_THE_FIELD}
      if (!act.shown) return {refusal: 'Choose something your world shows first.'}
      const shown = yourShown(field, yours).find(row => row.id === act.shown)
      if (!shown) return {refusal: 'That is no longer shown.'}
      return {request: {kind: 'clearing-withdraw', world_ref: world.world_ref, part_ref: shown.part, ...(shown.star ? {star_ref: shown.star} : {})}}
    }
  }
}

const REACH_WORDS: Readonly<Record<string, string>> = {public: 'the public', field: 'the field', star: 'the worlds gathered at the star'}

/** What the field did, in a line, from its answer to one act at a star. */
export function starNote(request: Record<string, unknown>, data: unknown): string {
  const answer = rec(data) ? data : {}
  switch (request.kind) {
    case 'star-light': return `${String(request.name)} is lit, and your world is gathered at it.`
    case 'star-gather': return answer.state === 'asked' ? 'Your world waits at the star’s edge until its lighter lets it in.' : 'Your world is gathered at the star.'
    case 'star-leave': return 'Your world has left the star and taken back what it showed there.'
    case 'star-admit': return 'The world is let in.'
    case 'star-close': return 'The star is closed: every world is back in its own orbit.'
    case 'star-say': return 'It is said at the star, under your world’s name.'
    case 'star-unsay': return 'It is unsaid: it no longer stands at the star.'
    case 'world-agent-ask': return 'It is asked: it waits for that agent’s answer, and your two worlds alone read it.'
    case 'world-agent-unask': return 'It is taken back: it stands nowhere now.'
    case 'world-put': return request.linked === true
      ? 'Your world is in the field: those in it see its planet, and what you show them.'
      : 'Your world is out of the field: those who read it read that it left, and everything in it stays as it was.'
    case 'clearing-open': return `It is shown to ${REACH_WORDS[String(request.audience)] ?? 'whom you chose'}.`
    case 'clearing-withdraw': return 'It is withdrawn: back under cloud, and whoever read it reads that it was withdrawn.'
    case 'world-contribute': return 'It stands on what you chose under your world’s name, and waits for that world’s owner.'
    case 'world-contribution-accept': return 'It is accepted: it stands in your world under its contributor’s name.'
    case 'world-contribution-refuse': return 'It is refused: your words reach its contributor alone.'
    case 'world-contribution-take-back': return 'It is taken back: it stands nowhere now.'
    case 'world-watch': return 'Your world watches it: what it shows that you read reaches you. It is yours alone: that world is not told.'
    case 'world-unwatch': return 'Your world no longer watches it.'
    default: return 'The field took it.'
  }
}
