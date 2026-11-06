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
}
export interface FieldClearing {
  readonly world_ref: string
  readonly part_ref: string
  readonly star_ref: string | null
  readonly audience: 'public' | 'field' | 'star'
  readonly shown: {readonly kind: string; readonly label: string}
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

/** The field as the window last read it. `days` is each star's day as you may read it, or null with `dayWhy` when the field's service
 * keeps none; `sayings` what was said at each star, or null with `sayWhy` likewise; `works` and `offers` what is shown and offered at
 * each star, or null with `workWhy` likewise. */
export type HeldField =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly worlds: readonly FieldWorld[]; readonly clearings: readonly FieldClearing[]; readonly stars: readonly FieldStar[]; readonly gatherings: readonly FieldGathering[]
    readonly days: readonly FieldDayEntry[] | null; readonly dayWhy: string | null; readonly sayings: readonly FieldSaying[] | null; readonly sayWhy: string | null
    readonly works?: readonly FieldWork[] | null; readonly offers?: readonly FieldOffer[] | null; readonly workWhy?: string | null}

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
      ? {world_ref: row.world_ref, body: row.body, linked: row.linked, mine: row.mine} : null),
    clearings: rows(data.clearings, row => text(row.world_ref) && text(row.part_ref) && (row.audience === 'public' || row.audience === 'field' || row.audience === 'star')
      && rec(row.shown) && text(row.shown.kind) && text(row.shown.label)
      ? {world_ref: row.world_ref, part_ref: row.part_ref, star_ref: text(row.star_ref) ? row.star_ref : null, audience: row.audience, shown: {kind: row.shown.kind, label: row.shown.label}} : null),
    stars: rows(data.stars, row => text(row.star_ref) && text(row.name) && text(row.gathers) && text(row.comes) && text(row.lit_by) && typeof row.mine === 'boolean'
      ? {star_ref: row.star_ref, name: row.name, gathers: row.gathers, comes: row.comes, lit_by: row.lit_by, mine: row.mine, ...(text(row.within) ? {within: row.within} : {})} : null),
    gatherings: rows(data.gatherings, row => text(row.star_ref) && text(row.world_ref) && (row.state === 'asked' || row.state === 'gathered')
      ? {star_ref: row.star_ref, world_ref: row.world_ref, state: row.state} : null),
    ...daysOf(data),
    ...sayingsOf(data),
    ...worksOf(data),
  }
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
}

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
  }
}

/** A world as a person reads its name: the last part of its ref. */
const whoOf = (ref: string): string => ref.split(':').pop() || ref
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
  }
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

const SAID_VERB: Readonly<Record<SayingWhat, string>> = {question: 'asks about', finding: 'has a finding on', correction: 'corrects', reproduction: 'reproduces'}
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
export function starWhen(at: number, now: number): string {
  const when = new Date(at), today = new Date(now)
  const sameDay = when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth() && when.getDate() === today.getDate()
  return sameDay ? `${two(when.getHours())}:${two(when.getMinutes())}` : `${when.getDate()} ${MONTHS[when.getMonth()]}`
}

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
  return {
    aperture: view.aperture, viewAs: view.viewAs,
    worlds: here.worlds.map(world => sceneWorld(field, world, view.viewAs, yours)),
    stars: here.stars.map(star => sceneStar(field, star, yours)),
    beyond, note,
  }
}

/** The scene from the values a device is handed (the binding's `field`, the held field's world part, and `fieldYours`), or null when
 * no field was read: the design draws what the binding read, at the aperture and audience the view chose. */
export function fieldSceneOf(field: unknown, view: {readonly aperture: Aperture; readonly viewAs: Audience}, yours: string | null): FieldScene | null {
  if (!rec(field)) return null
  const kept = Array.isArray(field.days) ? {state: 'held'} : {state: 'unavailable', detail: text(field.dayWhy) ? field.dayWhy : NO_DAY}
  const said = Array.isArray(field.sayings) ? {state: 'held'} : {state: 'unavailable', detail: text(field.sayWhy) ? field.sayWhy : NO_SAYINGS}
  const work = Array.isArray(field.works) ? {state: 'held'} : {state: 'unavailable', detail: text(field.workWhy) ? field.workWhy : NO_WORKS}
  const held = heldFieldOf({...field, world_field: {state: 'held'}, star_day: kept, star_days: field.days, star_saying: said, star_sayings: field.sayings,
    star_work: work, star_works: field.works, star_offers: field.offers})
  return held.state === 'read' ? fieldScene(held, view, yours) : null
}

// ── the Graph side (manual §17.2; TO10: "Turned to its graph, each star is a node with its worlds and each contribution an edge") ──
//
// The same scene laid out by connection: it holds no data of its own, so Aperture and View as filter it as they filter the Field scale,
// and what lies under the cloud is in no node, edge or count of it. What a world shows is a node tied to it, and to the star it is shown
// at; a contribution is an edge from its sayer's world to what it was said to, and one said to something taken back or unsaid ties
// nothing. What your world says at a star is said to the worlds gathered there, so the field and the public do not see it.

/** What a node of the field's graph is: a world, a star, or something a world shows. */
export type FieldNodeKind = 'world' | 'star' | 'shown'
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
 * shown at a star, or a contribution said to something. */
export type FieldTie = 'gathered' | 'asks' | 'within' | 'shows' | 'at' | 'said'
export interface FieldGraphEdge {
  readonly from: string
  readonly to: string
  readonly tie: FieldTie
}
export interface FieldGraph {
  readonly nodes: readonly FieldGraphNode[]
  readonly edges: readonly FieldGraphEdge[]
}

/** The scene laid out by connection: its worlds, its stars and what each world shows as nodes, tied by gathering, showing and
 * contribution, each edge between two of its nodes. Pure. */
export function fieldGraph(scene: FieldScene): FieldGraph {
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

/** Your world in the field: the one of yours whose body is your own body, or null. */
export function yourFieldWorld(field: Extract<HeldField, {state: 'read'}>, yours: string | null): string | null {
  if (yours === null) return null
  return field.worlds.find(world => world.mine && bodyRefOf(world.body) === yours)?.world_ref ?? null
}

export const NO_STAR = 'Choose a star first.'
const NOTHING_TO_UNSAY = 'Choose something your world said, in what was said here.'
/** A new saying's ref, from the world that says it and a nonce (the moment it is said): the field names a saying saying:<name>, once. */
const sayingRefOf = (world: string, nonce: number): string => `saying:${world.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(-120)}:${Math.abs(Math.trunc(nonce)).toString(36)}`
export const NOT_IN_FIELD = 'That star is not in the field you see.'
/** A new star's ref, from its name and a nonce (the moment it is lit): the field names a star star:<name>, once. */
const starRefOf = (name: string, nonce: number): string => {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `star:${slug || 'star'}-${Math.abs(Math.trunc(nonce)).toString(36)}`
}

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
    case 'unsay': {
      if (field.sayings === null) return {refusal: field.sayWhy ?? NO_SAYINGS}
      const said = act.saying ? field.sayings.find(row => row.saying_ref === act.saying && row.star_ref === star.star_ref) : undefined
      if (!said) return {refusal: NOTHING_TO_UNSAY}
      if (!field.worlds.find(row => row.world_ref === said.world_ref)?.mine) return {refusal: 'Only the one who said it unsays it.'}
      return {request: {kind: 'star-unsay', saying_ref: said.saying_ref}}
    }
  }
}

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
    default: return 'The field took it.'
  }
}
