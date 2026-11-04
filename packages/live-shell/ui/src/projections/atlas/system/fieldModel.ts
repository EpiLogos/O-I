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

/** How far you look (manual §17.2 Aperture). */
export type Aperture = 'world' | 'local' | 'shared' | 'federated'
export const APERTURES: readonly Aperture[] = ['world', 'local', 'shared', 'federated']

/** Who you look as (manual §17.2 View as; the Palace's Audience, §17.7). */
export type Audience = 'me' | 'field' | 'public'
export const AUDIENCES: readonly Audience[] = ['me', 'field', 'public']

/** To whom a part was shown: you alone (unshown), the worlds gathered at a star, the field, or the public. */
export type ShownTo = 'me' | 'star' | 'field' | 'public'

const REACH: Readonly<Record<Exclude<ShownTo, 'star'>, number>> = {me: 0, field: 1, public: 2}

/** Whether a part shown to `shownTo` lies under cloud for `audience`: never for you; for the field and the public, unless it was shown
 * to them or wider. A part shown at a star is shown there alone. */
export function cloudedFor(shownTo: ShownTo, audience: Audience): boolean {
  if (audience === 'me') return false
  if (shownTo === 'star') return true
  return REACH[shownTo] < REACH[audience]
}

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

/** What a star's day records (O-I #858, SF04): a world lit it, asked to come, came, was let in, showed something there or took it back,
 * left, or was turned away by its lighter. */
export type StarDayWhat = 'lit' | 'asked' | 'came' | 'let-in' | 'showed' | 'took-back' | 'left' | 'turned-away'
const STAR_DAY_WHATS: readonly StarDayWhat[] = ['lit', 'asked', 'came', 'let-in', 'showed', 'took-back', 'left', 'turned-away']
/** One entry of a star's day, in the order the field gives: the kind of what was shown, never what it was. */
export interface FieldDayEntry {
  readonly star_ref: string
  readonly world_ref: string
  readonly what: StarDayWhat
  readonly kind: string | null
}

/** The field as the window last read it. `days` is each star's day as you may read it, or null with `dayWhy` when the field's service
 * keeps none. */
export type HeldField =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly worlds: readonly FieldWorld[]; readonly clearings: readonly FieldClearing[]; readonly stars: readonly FieldStar[]; readonly gatherings: readonly FieldGathering[]
    readonly days: readonly FieldDayEntry[] | null; readonly dayWhy: string | null}

const NO_READING = 'The shared field gave no reading of its worlds.'
const NO_DAY = 'This field’s service does not keep a star’s day yet.'
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
  }
}

/** Each star's day as the snapshot carries it, or the field's words when its service keeps none. */
function daysOf(data: Record<string, unknown>): {days: readonly FieldDayEntry[] | null; dayWhy: string | null} {
  const kept = data.star_day
  if (!rec(kept) || kept.state !== 'held') return {days: null, dayWhy: rec(kept) && text(kept.detail) ? kept.detail : NO_DAY}
  return {
    days: rows(data.star_days, row => text(row.star_ref) && text(row.world_ref) && (STAR_DAY_WHATS as readonly unknown[]).includes(row.what)
      ? {star_ref: row.star_ref, world_ref: row.world_ref, what: row.what as StarDayWhat, kind: text(row.kind) ? row.kind : null} : null),
    dayWhy: null,
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
const NOT_YOURS_YET = 'Your world is not in the field, or your own body is not read yet.'
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

function sceneStar(field: Extract<HeldField, {state: 'read'}>, star: FieldStar, yours: string | null): SceneStar {
  const at = field.gatherings.filter(gathering => gathering.star_ref === star.star_ref)
  const asking = at.filter(gathering => gathering.state === 'asked').map(gathering => gathering.world_ref)
  const own = yourFieldWorld(field, yours)
  return {
    ref: star.star_ref, name: star.name, gathers: star.gathers, comes: star.comes, mine: star.mine, within: star.within ?? null,
    gathered: at.filter(gathering => gathering.state === 'gathered').map(gathering => gathering.world_ref),
    waiting: asking.length, asking,
    yoursAt: (own === null ? undefined : at.find(gathering => gathering.world_ref === own)?.state) ?? null,
    day: field.days === null ? null : field.days.filter(entry => entry.star_ref === star.star_ref),
  }
}

const DAY_WORDS: Readonly<Record<StarDayWhat, string>> = {
  lit: 'lit the star', asked: 'asked to come', came: 'came', 'let-in': 'was let in', showed: 'showed', 'took-back': 'took back', left: 'left',
  'turned-away': 'was turned away',
}
/** One entry of a star's day in words: the world, and what it did there. */
export function starDayLine(entry: FieldDayEntry): string {
  const who = entry.world_ref.split(':').pop() ?? entry.world_ref
  const what = DAY_WORDS[entry.what]
  return entry.what === 'showed' || entry.what === 'took-back' ? `${who} ${what} ${entry.kind ? `a ${entry.kind}` : 'something'}` : `${who} ${what}`
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
  const held = heldFieldOf({...field, world_field: {state: 'held'}, star_day: kept, star_days: field.days})
  return held.state === 'read' ? fieldScene(held, view, yours) : null
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

/** Your world in the field: the one of yours whose body is your own body, or null. */
export function yourFieldWorld(field: Extract<HeldField, {state: 'read'}>, yours: string | null): string | null {
  if (yours === null) return null
  return field.worlds.find(world => world.mine && bodyRefOf(world.body) === yours)?.world_ref ?? null
}

const NO_STAR = 'Choose a star first.'
const NOT_IN_FIELD = 'That star is not in the field you see.'
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
    default: return 'The field took it.'
  }
}
