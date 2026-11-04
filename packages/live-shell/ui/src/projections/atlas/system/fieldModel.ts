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

/** The field as the window last read it. */
export type HeldField =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly reason: string}
  | {readonly state: 'read'; readonly worlds: readonly FieldWorld[]; readonly clearings: readonly FieldClearing[]; readonly stars: readonly FieldStar[]; readonly gatherings: readonly FieldGathering[]}

const NO_READING = 'The shared field gave no reading of its worlds.'
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

function sceneStar(field: Extract<HeldField, {state: 'read'}>, star: FieldStar): SceneStar {
  const at = field.gatherings.filter(gathering => gathering.star_ref === star.star_ref)
  return {
    ref: star.star_ref, name: star.name, gathers: star.gathers, comes: star.comes, mine: star.mine, within: star.within ?? null,
    gathered: at.filter(gathering => gathering.state === 'gathered').map(gathering => gathering.world_ref),
    waiting: at.filter(gathering => gathering.state === 'asked').length,
  }
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
    stars: here.stars.map(star => sceneStar(field, star)),
    beyond, note,
  }
}

/** The scene from the values a device is handed (the binding's `field`, the held field's world part, and `fieldYours`), or null when
 * no field was read: the design draws what the binding read, at the aperture and audience the view chose. */
export function fieldSceneOf(field: unknown, view: {readonly aperture: Aperture; readonly viewAs: Audience}, yours: string | null): FieldScene | null {
  if (!rec(field)) return null
  const held = heldFieldOf({...field, world_field: {state: 'held'}})
  return held.state === 'read' ? fieldScene(held, view, yours) : null
}
