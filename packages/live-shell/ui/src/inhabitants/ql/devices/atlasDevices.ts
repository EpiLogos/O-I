// The atlas family's four faces as devices of the runtime (T-DEVICES-TECHNE; lock §0.1.3: the Technē 0 instrument, the Earth and
// solar system with its graph view, carries its full native controls on the Device side). Each device is read from the ONE
// mounted atlas (projections/atlas/AtlasProjectionPanel.tsx `atlasHandle`) and the view mirror (the Earth ⇄ Graph device's), and written through the
// owner's armed setters (agent/shellSetterBridge.ts `registerAtlasShellSetters`), which drive the same face actions the face
// bodies call. A control the owner cannot take now has no write path and says why, in the words the body uses; nothing is a default.
//
// The rows are the family's declared rows. They stand here, restated from inhabitants/agentNativeP0.ts (the atlas rows, the globe's
// with your world's body among them), because the shell never loads that batch (only the tests call `loadAgentNativeP0`) and loading
// it registers the Factory's transport bindings, which the mode bar reads; tests/techne-devices.test.mjs loads the batch and fails on
// any drift between the two.
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import type {AtlasHandle} from '../../../projections/atlas/mount'
import type {AtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
import {FORCE_ROWS} from '../../../projections/atlas/src/graph/forces'
import {DEFAULT_TIE_BASES} from '../../../projections/atlas/src/types/field'
import {CLOCK_DOMAIN, DEPTH_RANGE, KIND_NAMES, TIE_BASE_IDS} from '../../atlasFaceActions'
import {techneFaceDeclaration, techneDeviceId} from './faces'
import {memberKey, memberRows, type SetMember} from './rowSets'
import {submitThroughOwner, writeThroughOwner} from './ownerWrite'
import type {DesignBinding, Standing, ValueChange} from '../../../frame/devices/designed'
import {COASTS, WORLD_BODY_GENERATOR_VERSION, type BodyLook} from '../../../projections/atlas/src/globe/body'
import {
  BODY_CHOICES, NO_OTHER, WORLD_BODY_SETTINGS, baseBody, bodyChoice, bodyWriteRefusal, bodyWriter, chooseBody, worldBodyState,
  type BodyChoice, type WorldBodyState,
} from '../../../projections/atlas/body/worldBody'
import {suiteStanding} from '../../../projections/atlas/provider/suiteStanding'
import {chooseFieldView, chooseStarHand, factoryAtStar, fieldView, heldField, noteRelay, relayOf, starHand, systemActs, systemReading, type FieldView, type StarHand} from '../../../projections/atlas/system/systemStore'
import {APERTURES, AUDIENCES, FIELD_BEING_READ, GRANT_DAYS, NOT_IN_FIELD, NOT_YOURS_YET, NO_STAR, NO_WORKS, SAYING_WHATS, SHOW_TOS, STAR_COMES, heldFieldWhy, isMine, liveWork, shownId, shownLoad, starRequest, textsOf, whoOf,
  yourFieldWorld, yourRequest, yourShown,
  type Aperture, type Audience, type FieldOffer, type HeldField, type SayingWhat, type ShowTo, type StarAct, type StarComes, type YourAct, type YourPart} from '../../../projections/atlas/system/fieldModel'
import type {AtlasScale} from '../../../projections/atlas/places/placesModel'
import {yourLocations, type BodyLocation} from '../../../projections/atlas/system/bodyLocations'
import {PLACE_KINDS, choosePlaceKind, notePlaceTool, placeKindChoice, type PlaceKind} from '../../../projections/atlas/places/placeTool'
import {paneChrome, pressPane, type PaneChromeReading} from '../../../projections/atlas/paneChrome'

export const ATLAS_FAMILY = 'atlas-earth'

const decl = (deviceInstance: string, key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
  ({family: ATLAS_FAMILY, deviceInstance, key, title, type, ...rest}) as SdkParamRow

const FORCE_WRITERS: Readonly<Record<string, string>> = {
  centre: 'shell.setAtlasCentre', repel: 'shell.setAtlasRepel', link: 'shell.setAtlasLink', distance: 'shell.setAtlasDistance',
}
const FORCE_KEYS = ['centre', 'repel', 'link', 'distance'] as const

/** Your world's body on the globe (T-WORLDS §5 W3; manual §17.2 "Build a planet"): the body chosen (the view's own), its seed, its
 * settings and its coast. Each names the setter that writes it (agent/shellSetterBridge.ts registerWorldBodyShellSetters), which builds
 * the whole body from the owner's record and asks the owner for it as one BodySet (projections/atlas/body/worldBody.ts writeWorldBody:
 * the `aikit.wiki.facts.apply` Action, CAS on the root space's revision). Declared with the family's rows (agentNativeP0.ts, the globe). */
const BODY_ROWS: readonly SdkParamRow[] = [
  decl('globe-engine', 'body', 'Body', 'enumerated', {values: [...BODY_CHOICES], writePath: 'shell.setWorldBodyChoice'}),
  decl('globe-engine', 'seed', 'Seed', 'number', {writePath: bodyWriter('seed')}),
  ...WORLD_BODY_SETTINGS.map(setting => decl('globe-engine', setting.key, setting.title, 'number', {range: setting.range, writePath: bodyWriter(setting.key)})),
  decl('globe-engine', 'coast', 'Coast', 'enumerated', {values: [...COASTS], writePath: bodyWriter('coast')}),
]

/** The atlas family's declared rows, agentNativeP0.ts (depth, the four forces, relations, kinds, occurrences, sky anchors, the view,
 * the whole-field choice and your world's body, and the clock's four rows). */
export const ATLAS_DECLARED_ROWS: readonly SdkParamRow[] = [
  decl('graph-tools', 'depth', 'Steps from subject', 'number', {range: {min: DEPTH_RANGE.min, max: DEPTH_RANGE.max, unit: 'steps'}, writePath: 'shell.setAtlasDepth'}),
  ...FORCE_KEYS.map(key => {
    const spec = FORCE_ROWS.find(force => force.key === key)
    if (!spec) throw new Error(`the atlas has no force "${key}"`)
    return decl('graph-tools', key, spec.label, 'number', {range: {min: spec.min, max: spec.max}, writePath: FORCE_WRITERS[key]})
  }),
  decl('graph-tools', 'ties', 'Relations', 'enumerated', {values: [...TIE_BASE_IDS], writePath: 'shell.setAtlasTies'}),
  decl('graph-tools', 'kinds', 'Kinds drawn', 'enumerated', {values: [...KIND_NAMES], writePath: 'shell.setAtlasKinds'}),
  decl('graph-tools', 'occurrences', 'Occurrences', 'boolean', {writePath: 'shell.setAtlasOccurrences'}),
  decl('graph-tools', 'sky-anchors', 'Sky anchors', 'boolean', {writePath: 'shell.setAtlasSkyAnchors'}),
  decl('mode-switch', 'view', 'View', 'enumerated', {values: ['earth', 'graph'], writePath: 'shell.setAtlasView'}),
  decl('globe-engine', 'whole-field', 'Whole field', 'boolean', {writePath: 'shell.setAtlasWholeField'}),
  ...BODY_ROWS,
  decl('time-control', 'cursor', 'Deep time', 'number', {range: {min: CLOCK_DOMAIN.min, max: CLOCK_DOMAIN.max}, writePath: 'shell.setAtlasCursor'}),
  decl('time-control', 'all-time', 'All time', 'boolean', {writePath: 'shell.setAtlasAllTime'}),
  decl('time-control', 'play', 'Play', 'boolean', {writePath: 'shell.setAtlasPlay'}),
  decl('time-control', 'cumulative', 'Cumulative', 'boolean', {writePath: 'shell.setAtlasCumulative'}),
]

/** The tiers the graph draws, named as the graph's tool names them (atlasFaceBodies.tsx:94-98). */
const KIND_MEMBERS: readonly SetMember[] = [
  {id: 'archetype', label: 'Archetypes'}, {id: 'theoretic', label: 'Theoretics'}, {id: 'family', label: 'Families'},
]

// The owner's words for the states in which it cannot take a write: NOT_OPENED and NO_SCOPE are the body's, verbatim
// (inhabitants/atlasFaceBodies.tsx:114, :216); NOT_MOUNTED joins its two notes (:86, :109); the steps note is ours.
const NOT_MOUNTED = 'The Earth has not mounted in this session. Its controls stand with the Earth pane.'
const NOT_OPENED = 'The constellation has not been opened in this session. Its controls stand when the Graph view is first shown.'
const NOT_LOCAL = 'Steps count from a subject, so they apply in a local graph.'
const NO_SCOPE = 'No mode’s set is set aside on the globe, so there is no whole-field choice to make.'
const EARTH_LOCATIONS = 'Earth’s places stand on the Space page’s Places; these are the locations on your own body.'

/** What the shell reads of the one mounted atlas, taken once so a device and its picture agree. */
export interface AtlasReading {
  readonly mounted: boolean
  readonly view: AtlasView
  readonly graph: null | {
    readonly local: boolean
    readonly depth: number
    readonly dust: boolean
    readonly kinds: Readonly<Record<string, boolean>>
    readonly ties: readonly string[]
    readonly bases: readonly SetMember[]
    readonly forces: Readonly<Record<string, number>>
    readonly sky: 'off' | 'loading' | 'on' | 'unavailable'
  }
  readonly clock: null | {readonly mode: 'all' | 'cursor'; readonly cursorU: number; readonly playing: boolean; readonly cumulative: boolean}
  readonly globe: null | {readonly scopeLabel: string | null; readonly wholeField: boolean}
  /** Your world's body as its owner last answered, and the body the view chose (projections/atlas/body/worldBody.ts). */
  readonly body: {readonly state: WorldBodyState; readonly choice: BodyChoice}
  /** [T-WORLDS §5 W3] the locations on your own body, or why they are not read (system/bodyLocations.ts yourLocations); and the place
   * kind, the view's own */
  readonly locations: {readonly rows: readonly BodyLocation[]} | {readonly unread: string}
  readonly placeKind: PlaceKind
  /** [T-PROCEDURAL-BODY §6 item 5] the look your own world's body is drawn with, as your system reads it (system/maturity.ts): the globe draws
   * the same, so the device's pictures are the globe's own body; absent while your system is not read */
  readonly look?: BodyLook
  /** [#762] what the atlas drew over the globe that is the World's, stood down in the pane and read from it (projections/atlas/paneChrome.ts):
   * the focus label's name, line and acts, the reading cards' closes, the graph's display settings; absent where it is not read */
  readonly pane?: PaneChromeReading
  /** [O-I #858] the held field as the window last read it, the view's own choices at Field scale and at a star, and your own body's
   * ref (the world of yours whose body it is, is your world) */
  readonly field?: {readonly held: HeldField; readonly view: FieldView; readonly yours: string | null; readonly hand?: StarHand}
  /** [O-I #858] the scale the camera stands at (projections/atlas/places/placesHost.ts atlasScale): null while no Earth is mounted */
  readonly scale?: AtlasScale | null
}

/** Read the mounted atlas (null while none stands), the view the Earth ⇄ Graph device presents and the scale its camera stands at. */
export function atlasReading(handle: AtlasHandle | null, view: AtlasView, scale: AtlasScale | null = null): AtlasReading {
  const body = {state: worldBodyState(), choice: bodyChoice()}
  const standing = suiteStanding(), system = systemReading()
  const locations = yourLocations(body.state, standing.places, standing.phase === 'ready', system.state === 'read' ? system.bodies : null)
  const placeKind = placeKindChoice()
  const own = system.state === 'read' ? system.bodies.find(item => item.yours) : undefined
  const look = own ? {look: own.look} : {}
  const pane = paneChrome('world')
  const field = {held: heldField(), view: fieldView(), yours: system.state === 'read' ? system.bodies.find(item => item.yours)?.bodyRef ?? null : null, hand: starHand()}
  if (!handle) return {mounted: false, view, graph: null, clock: null, globe: null, body, locations, placeKind, pane, field, scale: null, ...look}
  const controls = handle.ctl.graphControls?.controls() ?? null
  const {scope, wholeField} = handle.ctl.globeScope
  return {
    mounted: true, view,
    graph: controls && {
      local: controls.local, depth: controls.depth, dust: controls.dust, kinds: {...controls.kinds}, ties: [...controls.ties],
      bases: controls.bases.map(basis => ({id: basis.id, label: basis.label})), forces: {...controls.forces}, sky: controls.sky,
    },
    clock: {mode: handle.time.mode, cursorU: handle.time.cursorU, playing: handle.time.playing, cumulative: handle.time.cumulative},
    globe: {scopeLabel: scope ? scope.label : null, wholeField},
    body, locations, placeKind, pane, field, scale, ...look,
  }
}

/** The Field scale's values and standing (manual §17.2; O-I #858): the scale chosen, the aperture and who you look as, the view's own;
 * the held field's worlds, clearings, stars and gatherings as read, and your own body's ref, from which the face draws the scene
 * (system/fieldModel.ts fieldSceneOf); and, while the field holds no worlds, Aperture and View as dimmed with its words. */
export function fieldValues(reading: NonNullable<AtlasReading['field']>): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const values: Record<string, ParamValue> = {aperture: reading.view.aperture, viewAs: reading.view.viewAs, fieldHeld: reading.held.state === 'read'}
  if (reading.view.field) values.scale = 'field'
  const standing: Record<string, Standing> = {}
  if (reading.held.state === 'read') {
    const {worlds, clearings, stars, gatherings, days, dayWhy, sayings, sayWhy, works, offers, workWhy, withdrawals, withdrawWhy, scope, gone} = reading.held
    values.field = JSON.stringify({worlds, clearings, stars, gatherings, days, dayWhy, sayings, sayWhy, works: works ?? null, offers: offers ?? null, workWhy: workWhy ?? null,
      withdrawals: withdrawals ?? null, withdrawWhy: withdrawWhy ?? null, scope: scope ?? null, gone: gone ?? []})
    if (reading.yours) values.fieldYours = reading.yours
  } else {
    const why = heldFieldWhy(reading.held) as string
    standing.aperture = {disabled: why}
    standing.viewAs = {disabled: why}
    values.fieldWhy = why
  }
  const stars = starValues(reading)
  return {values: {...values, ...stars.values}, standing: {...standing, ...stars.standing}}
}

// ── the acts at a star (manual §17.2 items 9 and 10; O-I #858 SF04, SF05, SF06) ──────────────────────────────────────────
//
// The star chosen, the waiting world chosen, the star to light and what to say there are the view's own hand (systemStore.ts StarHand); each act is one
// request of the held field for your own world (system/fieldModel.ts starRequest), standing dimmed with its reason when it cannot be
// asked. Showing work and offering a task at a star are Software Factory's (stories SF12, SF13): the Run chosen is one of the Runs this
// window's Factory states hold (systemStore.ts factoryAtStar); Factory answers what of it may be shown and makes, revokes, accepts and
// takes offers (the kernel's factory_owner work-show-read and task-offer-act), and then the field carries them (work-show, offer-put and
// the rest). A take goes to the field first, since the field decides which one gathered world takes a task.

// The refusals and the grant of the acts on work and tasks at a star live here, with the binding that asks them, and not in the field
// model the window's first load carries (O-I #858; round 30b). Software Factory owns the Run, the offer and its grant: it says what of a
// Run may be shown, makes, revokes and accepts offers and takes one up, and checks what was made against the grant. The field carries its
// documents between the worlds gathered at a star. Each act is asked of both for your own world and refused here in words where it
// cannot be done; the owners refuse the rest in theirs.

/** One act on work or tasks at a star. `run` is the chosen Run (the binding's key for it), `work` a work's ref, `offer` an offer's ref. */
export type WorkAct =
  | {readonly act: 'show'; readonly star: string | null; readonly run: string | null}
  | {readonly act: 'unshow'; readonly star: string | null; readonly work: string | null}
  | {readonly act: 'offer'; readonly star: string | null; readonly run: string | null; readonly unit: string | null; readonly reads: string; readonly touches: string; readonly days: number}
  | {readonly act: 'take' | 'accept' | 'revoke'; readonly star: string | null; readonly offer: string | null}
  | {readonly act: 'return'; readonly star: string | null; readonly offer: string | null; readonly made: string; readonly summary: string; readonly ref: string | null
    /** your Factory holds what it gave back to this task: the field is brought it, whatever the hand holds */
    readonly held?: boolean}

const DAY_MS = 86_400_000
const REF = /^[A-Za-z][A-Za-z0-9+._-]*:\S{1,500}$/
const refList = (words: string): string[] => words.split(/[\s,]+/).filter(Boolean)
/** What a grant lets be touched: the ref itself and what lies under it (Factory's and the field's rule). */
const covers = (granted: readonly string[], ref: string): boolean => granted.some(grant => ref === grant || ref.startsWith(`${grant}/`))
const touchesOf = (offer: FieldOffer): string[] => {
  const grant = offer.offer.grant
  return grant && typeof grant === 'object' && !Array.isArray(grant) ? textsOf((grant as Record<string, unknown>).touches) : []
}

/** The grant a task is offered under, from the person's words: what it may read (one ref or more) and touch, and the days it stands
 * from `now`; or why it cannot be. */
export function grantOf(reads: string, touches: string, days: number, now: number): {readonly grant: {readonly reads: string[]; readonly touches: string[]; readonly lapses_at: number}} | {readonly refusal: string} {
  const read = refList(reads), touch = refList(touches)
  if (!read.length) return {refusal: 'Name what the task may read: one ref or more, such as project:river/docs.'}
  if (read.length > 32 || touch.length > 32) return {refusal: 'A grant names at most 32 refs to read and 32 to touch.'}
  const bad = [...read, ...touch].find(ref => !REF.test(ref))
  if (bad) return {refusal: `Name what the task may read and touch as refs, such as project:river/maps: “${bad}” is none.`}
  if (!Number.isInteger(days) || days < GRANT_DAYS.min || days > GRANT_DAYS.max) return {refusal: 'A grant stands for one to thirty days.'}
  return {grant: {reads: read, touches: touch, lapses_at: now + days * DAY_MS}}
}

/** Why one act on work or tasks at a star cannot be asked for your own world, or undefined when it can. */
export function workActWhy(field: HeldField, yours: string | null, act: WorkAct): string | undefined {
  if (field.state === 'reading') return FIELD_BEING_READ
  if (field.state === 'unavailable') return field.reason
  if (field.works == null || field.offers == null) return field.workWhy ?? NO_WORKS
  if (!act.star) return NO_STAR
  const star = field.stars.find(row => row.star_ref === act.star)
  if (!star) return NOT_IN_FIELD
  const world = yourFieldWorld(field, yours)
  if (!world) return NOT_YOURS_YET
  const gathered = field.gatherings.some(row => row.star_ref === star.star_ref && row.world_ref === world && row.state === 'gathered')
  const linked = field.worlds.find(row => row.world_ref === world)?.linked === true
  const offer = 'offer' in act && act.offer ? field.offers.find(row => row.offer_ref === act.offer && row.star_ref === star.star_ref) : undefined
  switch (act.act) {
    case 'show':
    case 'offer': {
      if (!gathered) return `Your world ${act.act === 'show' ? 'shows work' : 'offers tasks'} at a star only while it is gathered there.`
      if (!linked) return `Link your world into the field before you ${act.act === 'show' ? 'show work' : 'offer a task'} at a star.`
      if (!act.run) return 'Choose a Run of Software Factory’s first.'
      if (act.act === 'show') return undefined
      if (!act.unit) return 'Choose the task to offer: a unit of the Run.'
      const made = grantOf(act.reads, act.touches, act.days, 0)
      return 'refusal' in made ? made.refusal : undefined
    }
    case 'unshow':
      return act.work && field.works.some(row => row.star_ref === star.star_ref && row.world_ref === world && row.work_ref === act.work) ? undefined : 'Choose a work your world shows here.'
    case 'take': {
      if (!offer) return 'Choose a task offered here first.'
      if (isMine(field, offer.world_ref)) return 'This task is your own: another world takes it up.'
      // A task the field holds taken by your own world may be taken again: a take whose Factory half did not land is finished so, for
      // the field answers your world's repeat at once and Factory answers it with the receipt it gave
      const yoursTook = offer.state === 'taken' && offer.taker_world_ref === world
      if (offer.state !== 'open' && !yoursTook) return offer.state === 'revoked' ? 'Its offerer revoked it.' : 'This task was taken already.'
      if (offer.lapses_at <= Date.now()) return 'Its grant has lapsed.'
      if (!gathered && !yoursTook) return 'Your world takes up a task at a star only while it is gathered there.'
      return undefined
    }
    case 'return': {
      if (!offer) return 'Choose a task offered here first.'
      if (offer.taker_world_ref !== world) return 'Only the world that took a task brings back what was made.'
      if (offer.state === 'revoked') return 'Its offerer revoked it: nothing comes back to it.'
      if (offer.state !== 'taken') return 'Something came back to it already.'
      if (offer.lapses_at <= Date.now()) return 'Its grant has lapsed: nothing comes back to it.'
      // what your Factory gave back already is brought to the field as it gave it: nothing in the hand is asked for
      if (act.held) return undefined
      if (!act.made.trim()) return 'Name what was made.'
      if (!act.summary.trim()) return 'Say in a line what was made.'
      if (act.ref && !covers(touchesOf(offer), act.ref)) return `The grant does not let the task touch ${act.ref}.`
      return undefined
    }
    case 'accept':
    case 'revoke': {
      if (!offer) return 'Choose a task offered here first.'
      if (!isMine(field, offer.world_ref)) return `Only the one who offered a task ${act.act === 'accept' ? 'accepts what came back' : 'revokes it'}.`
      if (offer.state === 'accepted') return act.act === 'accept' ? 'What came back is accepted already.' : 'What came back is accepted: the offer stands.'
      if (offer.state === 'revoked') return 'It was revoked already.'
      if (act.act === 'accept' && offer.state !== 'returned') return 'Nothing has come back to this task yet.'
      return undefined
    }
  }
}

/** The line under each task offered at a star that one of your acts left half done or could not finish: a take the field holds for your
 * world that your Factory has not taken up, what your Factory gave back that the field has not heard, a revocation your Factory refused to
 * hear. By offer ref; none for a task that stands whole. */
function offerNotesOf(held: HeldField, yours: string | null): Record<string, string> {
  const notes: Record<string, string> = {}
  if (held.state !== 'read' || !held.offers) return notes
  const world = yourFieldWorld(held, yours), factory = factoryAtStar()
  const taken = factory.state === 'read' ? factory.taken ?? null : null
  for (const offer of held.offers) {
    const relay = relayOf(offer.offer_ref)
    if (relay?.state === 'refused') notes[offer.offer_ref] = `Your Factory was told it was revoked, and refused: ${relay.why}`
    else if (world && offer.state === 'taken' && offer.taker_world_ref === world) {
      const there = taken ? taken[offer.offer_ref] : undefined
      if (taken && !there) notes[offer.offer_ref] = 'Taken in the field; your Factory has not taken it up yet. Take finishes it there.'
      else if (!taken) notes[offer.offer_ref] = 'Taken in the field. If your Factory did not take it up, Take finishes it there.'
      else if (there === 'returned') notes[offer.offer_ref] = 'What was made went back from your Factory; the field has not heard it. Return brings it there.'
    }
  }
  return notes
}

/** [SF13] Tell the Factory state of this window that took a task up that its offerer revoked it in the field, so its agents' grant ends
 * there too (`offer-revoked`; Factory's `offer-check` allows nothing after). Narrowing reach waits for no one: it is never held (DLW build
 * ruling 2026-11-06, from manual §16.10 "How a control moves": only raising a scope's reach waits for you). Each offer is told once,
 * read after read, and a refusal stays under the task in Factory's words. */
export async function relayRevoked(): Promise<void> {
  const held = heldField(), factory = factoryAtStar(), ask = systemActs()?.factory
  if (held.state !== 'read' || !held.offers || factory.state !== 'read' || !factory.taken || !ask) return
  for (const offer of held.offers) {
    const statePath = factory.takenAt?.[offer.offer_ref] ?? factory.takerState
    if (offer.state !== 'revoked' || factory.taken[offer.offer_ref] !== 'taken' || !statePath || relayOf(offer.offer_ref)) continue
    noteRelay(offer.offer_ref, {state: 'telling'})
    try {
      await ask({kind: 'task-offer-act', state_path: statePath, verb: 'offer-revoked', request: {offer_ref: offer.offer_ref, revoked_at: offer.moved_at ?? Date.now()}})
      noteRelay(offer.offer_ref, {state: 'told'})
    } catch (cause) {
      noteRelay(offer.offer_ref, {state: 'refused', why: cause instanceof Error ? cause.message : String(cause)})
    }
  }
}

/** [§17.2] The works being shown again, by work: the reading and answer each was shown for, so one showing is asked at a time and one
 * the field or Factory refused is not asked again until the work or its Run moves. */
const keeping = new Map<string, string>()
/** [SF12; manual §17.2: a run of work shown in the field "is live while its source answers"] A live work a world of yours shows at a
 * star answers on this window's connection to the field while this window reads its Run in its own Factory. As the Run moves (Factory
 * reads it at a revision newer than the one shown), or when the field says the work answers no more (this window was reloaded, or its
 * connection to the field was made again), the window shows it again: Factory's reading as it stands, forward only. A Run this window
 * does not locate is not its to answer for, and a kept work stands as it was kept. Like relayRevoked, never held: it shows nothing the
 * field does not hold already. */
export async function keepShownWorks(): Promise<void> {
  const held = heldField(), factory = factoryAtStar(), acts = systemActs(), ask = acts?.factory
  if (held.state !== 'read' || !held.works || factory.state !== 'read' || !acts || !ask) return
  const mine = new Set(held.worlds.filter(world => world.mine).map(world => world.world_ref))
  for (const work of held.works) {
    const key = JSON.stringify([work.star_ref, work.world_ref, work.work_ref])
    const run = factory.runs.find(row => row.runRef === work.work_ref)
    const moved = run?.revision != null && run.revision > work.revision
    if (!run || !mine.has(work.world_ref) || !liveWork(work) || (!moved && work.answering !== false)) { keeping.delete(key); continue }
    const at = JSON.stringify([work.revision, run.revision ?? null, work.answering ?? null])
    if (keeping.get(key) === at) continue
    keeping.set(key, at)
    try {
      const shown = await ask({kind: 'work-show-read', state_path: run.statePath, run_ref: run.runRef}) as Record<string, unknown> | null
      if (!shown || typeof shown !== 'object' || typeof shown.revision !== 'number' || shown.revision < work.revision) continue
      await acts.fieldAct({kind: 'work-show', star_ref: work.star_ref, world_ref: work.world_ref, shown})
    } catch {
      // refused (the Run or the field moved under it): asked again once the work or its Run moves
    }
  }
}

/** The acts at a star, by the World's value key. */
export const STAR_ACT_KEYS = ['starLight', 'starGather', 'starLeave', 'starAdmit', 'starClose', 'starSay', 'starUnsay'] as const
type StarActKey = (typeof STAR_ACT_KEYS)[number]
const isStarAct = (key: string): key is StarActKey => (STAR_ACT_KEYS as readonly string[]).includes(key)
/** Software Factory's acts at a star (SF12, SF13), by the World's value key. */
export const WORK_ACT_KEYS = ['starShow', 'starUnshow', 'starOffer', 'offerTake', 'offerReturn', 'offerAccept', 'offerRevoke'] as const
type WorkActKey = (typeof WORK_ACT_KEYS)[number]
const isWorkAct = (key: string): key is WorkActKey => (WORK_ACT_KEYS as readonly string[]).includes(key)
const NOT_REACHED = 'The shared field is not reached from this window.'
const NO_FACTORY = 'Software Factory is not reached from this window.'
const NO_TAKER = 'No Factory state of this window keeps the tasks your world takes up.'
const NO_OFFERER = 'No Factory state of this window holds the Run this task was offered from.'
const NO_HAND: StarHand = {star: null, admit: null, name: '', gathers: '', comes: 'anyone', to: null, what: 'question', words: '', dayPage: null, saidPage: null,
  run: null, unit: null, work: null, offer: null, reads: '', touches: '', days: 7, made: '', summary: '', madeRef: null, taker: null,
  worldName: '', showPart: null, showTo: null, shownPart: null}

/** What your Factory gave back to an offer it took and the field still holds taken: Factory's own return, to bring to the field. */
function heldReturnOf(offerRef: string | null): Readonly<Record<string, unknown>> | null {
  const factory = factoryAtStar(), held = heldField()
  if (!offerRef || factory.state !== 'read' || factory.taken?.[offerRef] !== 'returned' || held.state !== 'read') return null
  return held.offers?.find(offer => offer.offer_ref === offerRef)?.state === 'taken' ? factory.returns?.[offerRef] ?? null : null
}
/** The state that took an offer up (where a Return or a revocation goes), else the state a take goes to now. */
function takenStateOf(offerRef: string): string | null {
  const factory = factoryAtStar()
  return factory.state !== 'read' ? null : factory.takenAt?.[offerRef] ?? factory.takerState
}

/** The act on work or tasks a key names, from the view's hand. */
function workActOf(key: WorkActKey, hand: StarHand): WorkAct {
  switch (key) {
    case 'starShow': return {act: 'show', star: hand.star, run: hand.run}
    case 'starUnshow': return {act: 'unshow', star: hand.star, work: hand.work}
    case 'starOffer': return {act: 'offer', star: hand.star, run: hand.run, unit: hand.unit, reads: hand.reads, touches: hand.touches, days: hand.days}
    case 'offerTake': return {act: 'take', star: hand.star, offer: hand.offer}
    case 'offerReturn': return {act: 'return', star: hand.star, offer: hand.offer, made: hand.made, summary: hand.summary, ref: hand.madeRef, held: !!heldReturnOf(hand.offer)}
    case 'offerAccept': return {act: 'accept', star: hand.star, offer: hand.offer}
    case 'offerRevoke': return {act: 'revoke', star: hand.star, offer: hand.offer}
  }
}

/** The Runs of Software Factory's to choose at a star and the units of the one chosen, the grant and what was made as the hand holds
 * them, and the choices that still stand (a Run no longer read, a work no longer shown, an offer no longer at the star is not chosen). */
function factoryValues(held: HeldField, hand: StarHand, star: string | null, yours: string | null): {values: Record<string, ParamValue>; standing: Record<string, Standing>; hand: StarHand} {
  const factory = factoryAtStar(), values: Record<string, ParamValue> = {}, standing: Record<string, Standing> = {}
  const runs = factory.state === 'read' ? factory.runs : []
  values.factoryRuns = JSON.stringify(runs.map(run => ({value: run.key, label: run.name, does: `A Run of ${run.project ? `${run.project}’s` : 'Central’s'} Software Factory, ${run.standing}.`})))
  if (factory.state !== 'read') standing.factoryRun = {disabled: factory.state === 'reading' ? 'Software Factory’s Runs are being read.' : factory.reason}
  else if (!runs.length) standing.factoryRun = {disabled: 'Software Factory holds no Run in this window’s states.'}
  const run = hand.run && runs.some(row => row.key === hand.run) ? hand.run : null
  if (run) values.factoryRun = run
  const units = factory.state === 'read' && run && factory.units?.run === run ? factory.units : null
  if (units && 'units' in units) values.factoryUnits = JSON.stringify(units.units.map(unit => ({value: unit.ref, label: unit.key})))
  else standing.factoryUnit = {disabled: !run ? 'Choose a Run first.' : units && 'why' in units ? units.why : 'The Run’s tasks are being read.'}
  const unit = units && 'units' in units && hand.unit && units.units.some(row => row.ref === hand.unit) ? hand.unit : null
  if (unit) values.factoryUnit = unit
  const read = held.state === 'read' ? held : null
  const work = read && star && hand.work && read.works?.some(row => row.star_ref === star && row.work_ref === hand.work) ? hand.work : null
  if (work) values.fieldWork = work
  const offer = read && star && hand.offer ? read.offers?.find(row => row.star_ref === star && row.offer_ref === hand.offer) ?? null : null
  if (offer) values.fieldOffer = offer.offer_ref
  values.grantReads = hand.reads
  values.grantTouches = hand.touches
  values.grantDays = hand.days
  values.madeLabel = hand.made
  values.madeSummary = hand.summary
  if (hand.madeRef) values.madeRef = hand.madeRef
  values.offerNotes = JSON.stringify(offerNotesOf(held, yours))
  // the Factory state a take goes to: each located state by its project (Central's own when it keeps none), the one chosen standing
  const takers = factory.state === 'read' ? factory.takers ?? [] : []
  values.factoryTakers = JSON.stringify(takers.map(taker => ({value: taker.statePath, label: taker.project ?? 'Central',
    does: `Take a task up in ${taker.project ? `${taker.project}’s` : 'Central’s'} Software Factory: what it makes comes back from there.`})))
  if (factory.state === 'read' && factory.takerState) values.factoryTaker = factory.takerState
  if (factory.state !== 'read') standing.factoryTaker = {disabled: factory.state === 'reading' ? 'Software Factory’s states are being read.' : factory.reason}
  else if (!takers.length) standing.factoryTaker = {disabled: NO_TAKER}
  // a take your Factory holds is whole: nothing is left to finish
  const taken = factory.state === 'read' ? factory.taken ?? null : null
  const world = read ? yourFieldWorld(read, yours) : null
  if (offer && world && offer.state === 'taken' && offer.taker_world_ref === world && taken?.[offer.offer_ref]) standing.offerTake = {disabled: 'Your world took this task up: your Factory holds it.'}
  return {values, standing, hand: {...hand, star, run, unit, work, offer: offer?.offer_ref ?? null}}
}

/** Ask Software Factory and then the field for one act on work or tasks at a star, for your own world. Factory's refusal comes back in
 * its words and nothing reaches the field. */
async function workAtStar(key: WorkActKey, reading: NonNullable<AtlasReading['field']>): Promise<void> {
  const held = heldField(), hand = starHand(), acts = systemActs(), factory = factoryAtStar()
  const why = workActWhy(held, reading.yours, workActOf(key, hand))
  if (why) throw Error(why)
  if (!acts) throw Error(NOT_REACHED)
  if (held.state !== 'read' || !hand.star) throw Error(heldFieldWhy(held) ?? 'Choose a star first.')
  const world = yourFieldWorld(held, reading.yours)
  if (!world) throw Error('Your world is not in the field, or your own body is not read yet.')
  if (key === 'starUnshow') {
    await acts.fieldAct({kind: 'work-unshow', star_ref: hand.star, world_ref: world, work_ref: hand.work})
    chooseStarHand({work: null})
    return
  }
  const ask = acts.factory
  if (!ask) throw Error(NO_FACTORY)
  const runs = factory.state === 'read' ? factory.runs : []
  const run = runs.find(row => row.key === hand.run)
  const offer = held.offers?.find(row => row.offer_ref === hand.offer && row.star_ref === hand.star)
  const act = (statePath: string, verb: string, request: Record<string, unknown>) => ask({kind: 'task-offer-act', state_path: statePath, verb, request})
  const doc = (value: unknown, what: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`Software Factory answered no ${what}.`)
    return value as Record<string, unknown>
  }
  const offererState = () => {
    const runRef = (offer?.offer.programme as {run_ref?: unknown} | undefined)?.run_ref
    const state = runs.find(row => row.runRef === runRef)?.statePath
    if (!state) throw Error(NO_OFFERER)
    return state
  }
  const takerState = () => {
    const state = factory.state === 'read' ? factory.takerState : null
    if (!state) throw Error(NO_TAKER)
    return state
  }
  switch (key) {
    case 'starShow': {
      if (!run) throw Error('Choose a Run of Software Factory’s first.')
      const shown = doc(await ask({kind: 'work-show-read', state_path: run.statePath, run_ref: run.runRef}), 'shown work')
      await acts.fieldAct({kind: 'work-show', star_ref: hand.star, world_ref: world, shown})
      chooseStarHand({work: run.runRef})
      return
    }
    case 'starOffer': {
      if (!run) throw Error('Choose a Run of Software Factory’s first.')
      const grant = grantOf(hand.reads, hand.touches, hand.days, Date.now())
      if ('refusal' in grant) throw Error(grant.refusal)
      const receipt = doc(await act(run.statePath, 'offer-make', {run_ref: run.runRef, workflow_unit_ref: hand.unit, star_ref: hand.star, grant: grant.grant}), 'receipt for the offer')
      const made = doc(receipt.offer, 'offer')
      await acts.fieldAct({kind: 'offer-put', star_ref: hand.star, world_ref: world, offer: made})
      chooseStarHand({offer: typeof made.offer_ref === 'string' ? made.offer_ref : null, unit: null})
      return
    }
    case 'offerTake': {
      const state = takerState()
      await acts.fieldAct({kind: 'offer-take', offer_ref: offer!.offer_ref, world_ref: world})
      await act(state, 'offer-take', {offer: offer!.offer, by: {world_ref: world, name: world.split(':').pop() || world}})
      return
    }
    case 'offerReturn': {
      // what your Factory gave back already goes to the field as Factory gave it (the hand may be empty after a reload); else Factory
      // gives it back first, in the state that took the task up
      const back = heldReturnOf(offer!.offer_ref) ?? doc(await act(takenStateOf(offer!.offer_ref) ?? takerState(), 'offer-return', {offer_ref: offer!.offer_ref,
        made: {label: hand.made.trim(), summary: hand.summary.trim(), refs: hand.madeRef ? [hand.madeRef] : []}}), 'return')
      await acts.fieldAct({kind: 'offer-return', offer_ref: offer!.offer_ref, return: back})
      chooseStarHand({made: '', summary: '', madeRef: null})
      return
    }
    case 'offerAccept': {
      const state = offererState()
      await act(state, 'offer-receive', {return: offer!.returned})
      await act(state, 'offer-accept', {offer_ref: offer!.offer_ref})
      await acts.fieldAct({kind: 'offer-accept', offer_ref: offer!.offer_ref})
      return
    }
    case 'offerRevoke': {
      await act(offererState(), 'offer-revoke', {offer_ref: offer!.offer_ref})
      await acts.fieldAct({kind: 'offer-revoke', offer_ref: offer!.offer_ref})
      return
    }
  }
}

/** The act a key names, from the view's hand. */
function starActOf(key: StarActKey, hand: StarHand): StarAct {
  switch (key) {
    case 'starLight': return {act: 'light', name: hand.name, gathers: hand.gathers, comes: hand.comes}
    case 'starGather': return {act: 'gather', star: hand.star}
    case 'starLeave': return {act: 'leave', star: hand.star}
    case 'starAdmit': return {act: 'admit', star: hand.star, world: hand.admit}
    case 'starClose': return {act: 'close', star: hand.star}
    case 'starSay': return {act: 'say', star: hand.star, to: hand.to, what: hand.what, words: hand.words}
    case 'starUnsay': return {act: 'unsay', star: hand.star, saying: hand.to}
  }
}

/** The star chosen and its waiting worlds, the star to light, what to say there, and each act's standing. */
function starValues(reading: NonNullable<AtlasReading['field']>): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const hand = reading.hand ?? NO_HAND, held = reading.held
  const values: Record<string, ParamValue> = {starName: hand.name, starGathers: hand.gathers, starComes: hand.comes, sayWhat: hand.what, sayWords: hand.words}
  const standing: Record<string, Standing> = {}
  if (held.state === 'read' && hand.star && held.stars.some(star => star.star_ref === hand.star)) {
    values.fieldStar = hand.star
    const waiting = held.gatherings.filter(gathering => gathering.star_ref === hand.star && gathering.state === 'asked').map(gathering => gathering.world_ref)
    values.fieldWaiting = JSON.stringify(waiting)
    if (hand.admit && waiting.includes(hand.admit)) values.fieldAdmit = hand.admit
    // what something is said to stands chosen while it is still shown or said at the star
    const at = (ref: string) => held.sayings?.some(saying => saying.star_ref === hand.star && saying.saying_ref === ref)
      || held.clearings.some(clearing => clearing.audience === 'star' && clearing.star_ref === hand.star && shownId(clearing.world_ref, clearing.part_ref) === ref)
    if (hand.to && at(hand.to)) values.fieldSayTo = hand.to
    if (hand.dayPage !== null) values.dayPage = hand.dayPage
    if (hand.saidPage !== null) values.saidPage = hand.saidPage
  }
  const reached = systemActs() !== null
  for (const key of STAR_ACT_KEYS) {
    const made = starRequest(held, reading.yours, starActOf(key, {...hand, star: (values.fieldStar as string | undefined) ?? null, admit: (values.fieldAdmit as string | undefined) ?? null,
      to: (values.fieldSayTo as string | undefined) ?? null}), 0)
    if ('refusal' in made) standing[key] = {disabled: made.refusal}
    else if (!reached) standing[key] = {disabled: NOT_REACHED}
  }
  // Software Factory's acts at a star: the field reached and Factory reached first, then each act's own reason
  const work = factoryValues(held, hand, (values.fieldStar as string | undefined) ?? null, reading.yours)
  Object.assign(values, work.values)
  Object.assign(standing, work.standing)
  const factoryReached = systemActs()?.factory !== undefined
  for (const key of WORK_ACT_KEYS) {
    const why = !reached ? NOT_REACHED : key !== 'starUnshow' && !factoryReached ? NO_FACTORY : workActWhy(held, reading.yours, workActOf(key, work.hand)) ?? work.standing[key]?.disabled
    if (why) standing[key] = {disabled: why}
  }
  return {values, standing}
}

/** Ask the field for one act at a star; the hand follows what was done (a star lit is chosen, its draft cleared). */
async function actAtStar(key: StarActKey, reading: NonNullable<AtlasReading['field']>): Promise<void> {
  const made = starRequest(heldField(), reading.yours, starActOf(key, starHand()), Date.now())
  if ('refusal' in made) throw Error(made.refusal)
  const acts = systemActs()
  if (!acts) throw Error(NOT_REACHED)
  await acts.fieldAct(made.request)
  if (key === 'starLight') chooseStarHand({star: String(made.request.star_ref), admit: null, name: '', gathers: '', to: null})
  else if (key === 'starAdmit') chooseStarHand({admit: null})
  else if (key === 'starClose') chooseStarHand({star: null, admit: null, to: null})
  else if (key === 'starSay') chooseStarHand({words: ''})
  else if (key === 'starUnsay') chooseStarHand({to: null})
}

// ── your world in the field: Link, Show and Withdraw (manual §17.2; O-I #858 SF01, SF02, SF14) ─────────────────────────────
//
// The World's Shown page. The name your world is to stand under, the part to show and who is to see it, and the thing shown to withdraw
// are the view's own hand (systemStore.ts StarHand), none chosen by default; each act is one request of the held field for your own world
// (system/fieldModel.ts yourRequest). None of the keys is a declared row of the family: an agent sets none of them and no relay or
// default asks any of them; only the person's own press on the face does (DLW build ruling 2026-11-06, from manual §16.10 "How a control
// moves": Link and Show raise your world's reach and are held, Unlink and Withdraw narrow it and are pressed).

/** The acts on your world in the field, by the World's value key. */
export const YOUR_ACT_KEYS = ['fieldLink', 'fieldUnlink', 'partShow', 'partWithdraw'] as const
type YourActKey = (typeof YOUR_ACT_KEYS)[number]
const isYourAct = (key: string): key is YourActKey => (YOUR_ACT_KEYS as readonly string[]).includes(key)

/** The parts of your world that may be shown: the places on your own body, and the worlds of yours that land on it, as the projects
 * they are. None while your body's locations are not read. */
function yourParts(reading: AtlasReading): YourPart[] {
  if (!('rows' in reading.locations)) return []
  return reading.locations.rows.map(row => ({id: row.id, label: row.name, at: {lat: row.lat, lon: row.lon},
    kind: row.written !== undefined ? 'project' : (PLACE_KINDS as readonly string[]).includes(row.kind) ? row.kind : 'place'}))
}
/** Your own body as its owner last answered it (the first body while the root space carries none), or null while it is not read. */
const yourBody = (reading: AtlasReading): unknown => (reading.body.state.state === 'read' ? baseBody(reading.body.state) : null)

/** The act a key names, from the view's hand. */
function yourActOf(key: YourActKey, reading: AtlasReading, hand: StarHand): YourAct {
  switch (key) {
    case 'fieldLink': return {act: 'link', name: hand.worldName, body: yourBody(reading)}
    case 'fieldUnlink': return {act: 'unlink'}
    case 'partShow': return {act: 'show', part: yourParts(reading).find(part => part.id === hand.showPart) ?? null, to: hand.showTo, star: hand.star}
    case 'partWithdraw': return {act: 'withdraw', shown: hand.shownPart}
  }
}

/** Your world in the field as the Shown page reads it (which world, and whether it is linked), the parts of it to show, what it shows and
 * how much, the choices that still stand, and each act's standing. */
function yourValues(reading: AtlasReading, field: NonNullable<AtlasReading['field']>): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const hand = field.hand ?? NO_HAND, held = field.held
  const values: Record<string, ParamValue> = {worldName: hand.worldName}, standing: Record<string, Standing> = {}
  const parts = yourParts(reading)
  values.yourParts = JSON.stringify(parts.map(({id, kind, label}) => ({id, kind, label})))
  if (hand.showPart && parts.some(part => part.id === hand.showPart)) values.showPart = hand.showPart
  if (hand.showTo) values.showTo = hand.showTo
  if (held.state === 'read') {
    const ref = yourFieldWorld(held, field.yours)
    const world = ref === null ? undefined : held.worlds.find(row => row.world_ref === ref)
    if (world) {
      values.fieldWorld = world.world_ref
      values.fieldLinked = world.linked
      standing.worldName = {disabled: `Your world stands in the field as ${whoOf(world.world_ref)}.`}
    }
    const shown = yourShown(held, field.yours)
    values.yourShown = JSON.stringify(shown)
    values.shownLoad = shownLoad(shown)
    if (hand.shownPart && shown.some(row => row.id === hand.shownPart)) values.shownPart = hand.shownPart
  }
  const reached = systemActs() !== null
  const chosen = {...hand, showPart: (values.showPart as string | undefined) ?? null, shownPart: (values.shownPart as string | undefined) ?? null}
  for (const key of YOUR_ACT_KEYS) {
    const made = yourRequest(held, field.yours, yourActOf(key, reading, chosen), 0)
    if ('refusal' in made) standing[key] = {disabled: made.refusal}
    else if (!reached) standing[key] = {disabled: NOT_REACHED}
  }
  return {values, standing}
}

/** Ask the field for one act on your world; the hand follows what was done (the name is the world's once linked, a part shown or
 * withdrawn is no longer chosen). */
async function actYours(key: YourActKey, reading: AtlasReading, field: NonNullable<AtlasReading['field']>): Promise<void> {
  const made = yourRequest(heldField(), field.yours, yourActOf(key, reading, starHand()), Date.now())
  if ('refusal' in made) throw Error(made.refusal)
  const acts = systemActs()
  if (!acts) throw Error(NOT_REACHED)
  await acts.fieldAct(made.request)
  if (key === 'fieldLink') chooseStarHand({worldName: ''})
  else if (key === 'partShow') chooseStarHand({showPart: null})
  else if (key === 'partWithdraw') chooseStarHand({shownPart: null})
}

/** The view's own hand at Field scale: the scale, the aperture and who you look as. A value that is none of them is not taken. */
const FIELD_LOCAL: Readonly<Record<string, (value: ParamValue) => void>> = {
  scale: value => { if (typeof value === 'string') chooseFieldView({field: value === 'field'}) },
  aperture: value => { if ((APERTURES as readonly unknown[]).includes(value)) chooseFieldView({aperture: value as Aperture}) },
  viewAs: value => { if ((AUDIENCES as readonly unknown[]).includes(value)) chooseFieldView({viewAs: value as Audience}) },
  fieldStar: value => chooseStarHand({star: typeof value === 'string' && value ? value : null, admit: null, to: null, dayPage: null, saidPage: null, work: null, offer: null}),
  fieldAdmit: value => chooseStarHand({admit: typeof value === 'string' && value ? value : null}),
  starName: value => { if (typeof value === 'string') chooseStarHand({name: value}) },
  starGathers: value => { if (typeof value === 'string') chooseStarHand({gathers: value}) },
  starComes: value => { if ((STAR_COMES as readonly unknown[]).includes(value)) chooseStarHand({comes: value as StarComes}) },
  fieldSayTo: value => chooseStarHand({to: typeof value === 'string' && value ? value : null}),
  sayWhat: value => { if ((SAYING_WHATS as readonly unknown[]).includes(value)) chooseStarHand({what: value as SayingWhat}) },
  sayWords: value => { if (typeof value === 'string') chooseStarHand({words: value}) },
  dayPage: value => { if (typeof value === 'number' && Number.isInteger(value) && value >= 0) chooseStarHand({dayPage: value}) },
  saidPage: value => { if (typeof value === 'number' && Number.isInteger(value) && value >= 0) chooseStarHand({saidPage: value}) },
  // [SF12, SF13] the Run, its task, the grant and what was made: the view's own until an act sends them
  factoryRun: value => chooseStarHand({run: typeof value === 'string' && value ? value : null, unit: null}),
  factoryUnit: value => chooseStarHand({unit: typeof value === 'string' && value ? value : null}),
  factoryTaker: value => chooseStarHand({taker: typeof value === 'string' && value ? value : null}),
  fieldWork: value => chooseStarHand({work: typeof value === 'string' && value ? value : null}),
  fieldOffer: value => chooseStarHand({offer: typeof value === 'string' && value ? value : null, madeRef: null}),
  grantReads: value => { if (typeof value === 'string') chooseStarHand({reads: value}) },
  grantTouches: value => { if (typeof value === 'string') chooseStarHand({touches: value}) },
  grantDays: value => { if (typeof value === 'number' && Number.isInteger(value) && value >= GRANT_DAYS.min && value <= GRANT_DAYS.max) chooseStarHand({days: value}) },
  madeLabel: value => { if (typeof value === 'string') chooseStarHand({made: value}) },
  madeSummary: value => { if (typeof value === 'string') chooseStarHand({summary: value}) },
  madeRef: value => chooseStarHand({madeRef: typeof value === 'string' && value ? value : null}),
  // [SF01, SF02, SF14] the name your world is to stand under, the part to show and who is to see it, and the thing shown to withdraw
  worldName: value => { if (typeof value === 'string') chooseStarHand({worldName: value}) },
  showPart: value => chooseStarHand({showPart: typeof value === 'string' && value ? value : null}),
  showTo: value => { if ((SHOW_TOS as readonly unknown[]).includes(value)) chooseStarHand({showTo: value as ShowTo}) },
  shownPart: value => chooseStarHand({shownPart: typeof value === 'string' && value ? value : null}),
}

// ── your world's body: the World device's Body page (T-WORLDS §5 W3; manual §17.2 "Build a planet") ─────────────────────────
//
// The body rows are among the family's declared rows above (BODY_ROWS, declared in agentNativeP0.ts with the globe): the body choice is
// the view's own (which body the World shows), every other row a setting of the owner's record.

/** The globe's body rows, as the family declares them (ATLAS_DECLARED_ROWS). */
export const WORLD_BODY_ROWS: readonly SdkParamRow[] = BODY_ROWS
/** The keys of the body itself (every one goes to the owner as part of one BodySet), the act `reroll` among them. */
export const WORLD_BODY_KEYS: readonly string[] = ['seed', 'reroll', 'coast', ...WORLD_BODY_SETTINGS.map(setting => setting.key)]

/** The body page's readings: the body chosen, and your body's record where it reads (another world's body is not read here). */
export function bodyValues(body: AtlasReading['body']): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {body: body.choice}
  const state = body.state
  if (state.state !== 'read' || body.choice === 'other') return values
  values.bodyName = typeof state.reading.space.title === 'string' && state.reading.space.title ? state.reading.space.title : state.reading.space.ref
  const record = state.record
  if (!record) return values
  values.seed = record.seed
  values.seaLevel = record.landmass.sea_level
  values.continents = record.landmass.continents
  values.relief = record.landmass.relief
  values.coast = record.landmass.coast
  values.warmth = record.climate.warmth
  values.moisture = record.climate.moisture
  values.iceCaps = record.climate.ice_caps
  values.atmosphere = record.sky.atmosphere
  values.clouds = record.sky.clouds
  values.tilt = record.sky.axial_tilt_deg
  return values
}

/** Why the body's settings cannot be written now, or null: the Earth not mounted, then the owner's own standing. */
export function bodyRefusal(reading: AtlasReading): string | null {
  if (!reading.mounted) return NOT_MOUNTED
  if (reading.body.choice === 'other') return NO_OTHER
  return bodyWriteRefusal()
}

/** The World design's binding (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx, the Body page and the globe's whole-field
 * choice): the owner's readings by the design's value keys, its writes through the owners' setters, and each value's standing. A body
 * change and a reroll go to the owner as one BodySet; the body choice is the view's own hand. Values no owner reads here (the places,
 * the sky, the graph, the locations on your body) are absent, never defaulted. */
export function atlasGlobeBinding(reading: AtlasReading): DesignBinding {
  // A reading that carries no field part (one made before the field was read into it) hands the face no field: the face then names it.
  const field = reading.field ? fieldValues(reading.field) : {values: {}, standing: {}}
  const yours = reading.field ? yourValues(reading, reading.field) : {values: {}, standing: {}}
  const values: Record<string, ParamValue> = {...bodyValues(reading.body), ...field.values, ...yours.values, view: reading.view, mounted: reading.mounted}
  // [O-I #858] the scale the camera stands at, a reading: the World's scale unless the view chose the Field, and kept for the way back
  // from it (the Graph is not a scale of the Earth, and no Earth mounted stands at none)
  if (reading.scale && reading.scale !== 'graph') {
    values.cameraScale = reading.scale
    if (!reading.field?.view.field) values.scale = reading.scale
  }
  if (reading.globe) {
    values.scope = reading.globe.scopeLabel ?? ''
    if (reading.globe.scopeLabel != null) values.wholeField = reading.globe.wholeField
  }
  const refusal = bodyRefusal(reading)
  const standing: Record<string, Standing> = {...field.standing, ...yours.standing}
  // the locations on your own body: a reading (the places stand on it through their owners' PlaceSet, the landings through each world's
  // own BodySet); the place kind is the view's own choice of what the next click places
  values.placeKind = reading.placeKind
  // the body the globe draws, for the design's pictures (the Compact, the Widget and the Body page draw the globe's own body, never a second one):
  // the record and the look it is drawn with; and, for a body built by an older generator, what its next change does (the ticket's rule: it draws
  // as it always did until it is changed, and the change rebuilds it)
  const shown = reading.body.state.state === 'read' && reading.body.choice === 'own' ? reading.body.state.record : null
  if (shown) {
    values.bodyRecord = JSON.stringify(shown)
    if (reading.look) values.bodyLook = JSON.stringify(reading.look)
    if (shown.generator.version < WORLD_BODY_GENERATOR_VERSION) values.generationNote = `This body was built by generator ${shown.generator.version}; the current generator is ${WORLD_BODY_GENERATOR_VERSION}. Its next change rebuilds it.`
  }
  // [#762] the focus label's acts, the closes of the reading cards and the graph's display, as the pane drew them before it stood them down
  // (the World design's Focus and Display, catalogue/panels/paneControls.tsx); a press is the atlas's own control pressed
  if (reading.mounted && reading.pane) {
    values['pane.controls'] = JSON.stringify(reading.pane.controls)
    if (reading.pane.title) values['pane.title'] = reading.pane.title
  } else standing['pane.press'] = {disabled: NOT_MOUNTED}
  if (reading.body.choice === 'earth') standing.locations = {disabled: EARTH_LOCATIONS}
  else if (reading.body.choice === 'other') standing.locations = {disabled: NO_OTHER}
  else if ('unread' in reading.locations) standing.locations = {disabled: reading.locations.unread}
  else values.locations = JSON.stringify(reading.locations.rows)
  if (!reading.mounted) standing.placeKind = {disabled: NOT_MOUNTED}
  if (refusal) for (const key of WORLD_BODY_KEYS) standing[key] = {disabled: refusal}
  if (!reading.mounted) standing.body = {disabled: NOT_MOUNTED}
  if (!reading.mounted) standing.wholeField = {disabled: NOT_MOUNTED}
  else if (reading.globe?.scopeLabel == null) standing.wholeField = {disabled: NO_SCOPE}
  const writable = (key: string) => key === 'wholeField' ? !standing.wholeField : isStarAct(key) || isWorkAct(key) || isYourAct(key) ? !!reading.field && !standing[key] : WORLD_BODY_KEYS.includes(key) && !refusal
  return {
    id: techneDeviceId(ATLAS_FAMILY, 'globe-engine'), values, standing, enabledKey: 'mounted',
    writes: writable,
    write: async (changes: readonly ValueChange[]) => {
      const body: Record<string, unknown> = {}
      for (const change of changes) {
        if (change.key === 'wholeField') await writeThroughOwner('shell.setAtlasWholeField', change.value)
        else if (isStarAct(change.key) && reading.field) await actAtStar(change.key, reading.field)
        else if (isWorkAct(change.key) && reading.field) await workAtStar(change.key, reading.field)
        else if (isYourAct(change.key) && reading.field) await actYours(change.key, reading, reading.field)
        else if (WORLD_BODY_KEYS.includes(change.key)) body[change.key] = change.value
        else throw Error(`${change.key} is not written from the World's own controls`)
      }
      // every body change of one gesture is one BodySet: the owner sees the whole body once, at the revision it was read at
      if (Object.keys(body).length) await writeThroughOwner('shell.setWorldBody', body)
    },
    local: {
      ...FIELD_LOCAL,
      body: value => { if (value === 'own' || value === 'earth' || value === 'other') chooseBody(value) },
      placeKind: value => { if ((PLACE_KINDS as readonly unknown[]).includes(value)) choosePlaceKind(value as PlaceKind) },
      'pane.press': value => { if (value !== undefined) pressPane(value, notePlaceTool) },
    },
  }
}

const declared = (faceId: string, key: string): SdkParamRow => {
  const found = ATLAS_DECLARED_ROWS.find(row => row.deviceInstance === faceId && row.key === key)
  if (!found) throw new Error(`the atlas family declares no row ${faceId}/${key}`)
  return found
}

/** The row with its write path taken away and the owner's reason in its place: the owner cannot take it now, so it is a reading. */
const readingOf = (row: SdkParamRow, why: string): SdkParamRow => {
  const {writePath: _writePath, ...rest} = row
  return {...rest, disclosure: why} as SdkParamRow
}

const placed = (row: SdkParamRow, group: string, compact = false): SdkParamRow => ({...row, group, ...(compact ? {compact: true} : {})}) as SdkParamRow

/** An integer domain drawn as a stepper over its choices (the controls' fader would draw fractions the owner refuses). */
const integerRow = (row: SdkParamRow): SdkParamRow => {
  const min = row.range?.min ?? 0, max = row.range?.max ?? 0
  return {...row, type: 'enumerated', values: Array.from({length: max - min + 1}, (_, i) => String(min + i))} as SdkParamRow
}

/** The steps stepper's label is the number the graph takes. */
const decode = (key: string, value: number | string | boolean): unknown => (key === 'depth' ? Number(value) : value)

/** One atlas face as a device over the atlas's current reading. */
export function atlasDevice(face: InhabitantFaceDeclaration, reading: AtlasReading): DeviceInstance {
  const faceId = face.id
  const values: Record<string, ParamValue> = {}
  const graph = reading.graph
  let rows: SdkParamRow[] = []
  let enabledKey: string | undefined
  let sets: Record<string, {order: readonly string[]; on: readonly string[]}> | undefined
  let heldBy: Record<string, string> | undefined

  if (faceId === 'graph-tools') {
    const why = !reading.mounted ? NOT_MOUNTED : graph === null ? NOT_OPENED : null
    const gate = (row: SdkParamRow): SdkParamRow => (why === null ? row : readingOf(row, why))
    const gateLocal = (row: SdkParamRow): SdkParamRow => (why !== null ? readingOf(row, why) : graph && !graph.local ? readingOf(row, NOT_LOCAL) : row)
    const bases: readonly SetMember[] = graph?.bases ?? DEFAULT_TIE_BASES.map(basis => ({id: basis.id, label: basis.label}))
    rows = [
      placed(integerRow(gateLocal(declared(faceId, 'depth'))), 'Steps', true),
      ...memberRows(gate(declared(faceId, 'kinds')), KIND_MEMBERS, 'Kinds'),
      placed(gate(declared(faceId, 'occurrences')), 'Kinds', true),
      ...memberRows(gate(declared(faceId, 'ties')), bases, 'Relations'),
      placed(gate(declared(faceId, 'sky-anchors')), 'Sky', true),
      ...FORCE_KEYS.map(key => placed(gate(declared(faceId, key)), 'Forces', key === 'centre')),
    ]
    if (graph) {
      if (graph.local) values.depth = String(graph.depth)
      for (const kind of KIND_MEMBERS) values[memberKey('kinds', kind.id)] = graph.kinds[kind.id] === true
      values.occurrences = graph.dust
      for (const basis of bases) values[memberKey('ties', basis.id)] = graph.ties.includes(basis.id)
      values['sky-anchors'] = graph.sky === 'on' || graph.sky === 'loading'
      for (const key of FORCE_KEYS) values[key] = graph.forces[key]!
    }
    values.open = graph !== null
    enabledKey = 'open'
    sets = {
      kinds: {order: KIND_MEMBERS.map(kind => kind.id), on: KIND_MEMBERS.filter(kind => graph?.kinds[kind.id]).map(kind => kind.id)},
      ties: {order: bases.map(basis => basis.id), on: graph?.ties ?? []},
    }
  } else if (faceId === 'mode-switch') {
    rows = [placed(declared(faceId, 'view'), 'View', true)]
    values.view = reading.view
    values.mounted = reading.mounted
    enabledKey = 'mounted'
  } else if (faceId === 'globe-engine') {
    const whole = !reading.mounted ? readingOf(declared(faceId, 'whole-field'), NOT_MOUNTED)
      : reading.globe?.scopeLabel == null ? readingOf(declared(faceId, 'whole-field'), NO_SCOPE) : declared(faceId, 'whole-field')
    // your world's body after the globe's own choice: the body chosen (the view's), then its settings, each written through its
    // setter while the owner can take it, else a reading with the owner's reason
    const refusal = bodyRefusal(reading)
    const bodyRows = WORLD_BODY_ROWS.map(row => row.key === 'body'
      ? placed(reading.mounted ? row : readingOf(row, NOT_MOUNTED), 'Body')
      : placed(refusal ? readingOf(row, refusal) : row, WORLD_BODY_SETTINGS.find(setting => setting.key === row.key)?.group ?? 'Body'))
    rows = [placed(whole, 'Globe', true), ...bodyRows]
    if (reading.globe && reading.globe.scopeLabel != null) values['whole-field'] = reading.globe.wholeField
    Object.assign(values, bodyValues(reading.body))
    delete values.bodyName
    values.mounted = reading.mounted
    enabledKey = 'mounted'
  } else if (faceId === 'time-control') {
    const gate = (row: SdkParamRow): SdkParamRow => (reading.mounted ? row : readingOf(row, NOT_MOUNTED))
    rows = ['cursor', 'all-time', 'play', 'cumulative'].map(key => placed(gate(declared(faceId, key)), 'Deep time', true))
    const clock = reading.clock
    if (clock) {
      values.cursor = clock.cursorU
      values['all-time'] = clock.mode === 'all'
      values.play = clock.playing
      values.cumulative = clock.cumulative
      // The clock moves the cursor while it plays: the value shows what moves it, and the hand-back light stops the clock.
      if (clock.playing) heldBy = {cursor: 'the clock, playing'}
    }
    values.mounted = reading.mounted
    enabledKey = 'mounted'
  } else {
    throw new Error(`${faceId} is not an atlas face`)
  }

  const writes = {declared: ATLAS_DECLARED_ROWS.filter(row => row.deviceInstance === faceId), sets, decode}
  return {
    id: techneDeviceId(ATLAS_FAMILY, faceId), family: ATLAS_FAMILY, face: techneFaceDeclaration(face), rows, values, enabledKey,
    ...(heldBy ? {heldBy} : {}),
    submit: changes => submitThroughOwner(writes, changes),
    handBack: faceId === 'time-control' ? async key => { if (key === 'cursor') await writeThroughOwner('shell.setAtlasPlay', false) } : undefined,
  }
}
