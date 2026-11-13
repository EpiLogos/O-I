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
import {COASTS, WORLD_BODY_GENERATOR_VERSION, type BodyLook, type WorldBodyRecord} from '../../../projections/atlas/src/globe/body'
import {
  BODY_CHOICES, NO_OTHER, READ_ONLY, WORLD_BODY_SETTINGS, baseBody, bodyChoice, bodyWriteRefusal, bodyWriter, chooseBody, worldBodyState,
  type BodyChoice, type WorldBodyState,
} from '../../../projections/atlas/body/worldBody'
import {leaveWorld, otherBody, visitedWorld, visitWorld} from '../../../projections/atlas/system/enteredWorld'
import {suiteStanding} from '../../../projections/atlas/provider/suiteStanding'
import {DAY_ENTRY_CANDIDATE} from '../../../central/devices/dayBinding'
import {oneLineText} from '../../../central/plainParts'
import {chooseFieldView, chooseStarHand, dayEntries, factoryAtStar, fieldView, heldField, noteRelay, noteTakenRelay, relayOf, starHand, systemActs, systemReading, takenRelayOf, type FieldView, type StarHand, type WorldSearch} from '../../../projections/atlas/system/systemStore'
import {AGENT_BYS, APERTURES, AUDIENCES, CONTRIBUTION_WHATS, DAY_ENTRY_UNBROUGHT, FIELD_BEING_READ, GRANT_DAYS, NOT_IN_FIELD, NOT_YOURS_YET, NO_STAR, NO_WORKS, SAYING_WHATS, SHOW_TOS, nameKey, STAR_COMES, heldFieldWhy, isMine, leftWords, liveWork, nameForFactory, passingFailure, shownId, shownLoad, starRequest, takesToTell, textsOf, whoOf,
  visitable, visitedBody, worldLeft, yourFieldWorld, yourRequest, yourShown, besideLine, contributionLine, reachedRows,
  type AgentBy, type Aperture, type Audience, type ContributionWhat, type FieldContribution, type ReachedRow, type FieldOffer, type HeldField, type SayingWhat, type ShowTo, type StarAct, type StarComes, type YourAct, type YourPart} from '../../../projections/atlas/system/fieldModel'
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
  /** Your world's body as its owner last answered, and the body the view chose (projections/atlas/body/worldBody.ts); and, while another
   * world is the body, the one drawn (system/enteredWorld.ts otherBody: a world of your set entered, or another's visited in the field,
   * O-I #858 SF11), null while none is */
  readonly body: {readonly state: WorldBodyState; readonly choice: BodyChoice; readonly other?: OtherBody | null
    /** a world visited whose body is not read now, and why (O-I #858 TX14) */
    readonly otherWhy?: {readonly ref: string; readonly why: string} | null}
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
  const choice = bodyChoice()
  const other = choice === 'other' ? otherBody() : null
  // a world visited whose body is not drawn now (the field lost, or it no longer shows its body there), and why, in the field's words, read
  // as the visit reads it (visitWorld below): the visit stands, so the body comes back with the field (O-I #858 TX14)
  const visiting = choice === 'other' && !other ? visitedWorld() : null, lost = visiting ? visitedBody(heldField(), visiting) : null
  const body = {state: worldBodyState(), choice, other, otherWhy: visiting && lost && 'refusal' in lost ? {ref: visiting, why: lost.refusal} : null}
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
    const {worlds, clearings, stars, gatherings, days, dayWhy, sayings, sayWhy, works, offers, workWhy, withdrawals, withdrawWhy, scope, gone, watches, watchWhy, contributions, asks, askWhy,
      handOns, handOnWhy} = reading.held
    // the claims of the same work (SF09) ride with the scene, which draws each work claimed in two worlds once; and every contribution read,
    // which crosses the gap between the worlds the scene draws (TO10)
    const sames = contributions ? contributions.filter(row => row.what === 'same') : null
    values.field = JSON.stringify({worlds, clearings, stars, gatherings, days, dayWhy, sayings, sayWhy, works: works ?? null, offers: offers ?? null, workWhy: workWhy ?? null,
      withdrawals: withdrawals ?? null, withdrawWhy: withdrawWhy ?? null, scope: scope ?? null, gone: gone ?? [], watches: watches ?? null, watchWhy: watchWhy ?? null, sames, contributed: contributions ?? null,
      asks: asks ?? null, askWhy: askWhy ?? null, handOns: handOns ?? null, handOnWhy: handOnWhy ?? null})
    if (reading.yours) values.fieldYours = reading.yours
    values.reached = JSON.stringify(reachedRows(reading.held, (reading.hand ?? NO_HAND).searches))
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
 * hear; and [SF13.3c] for a task of yours, a take your Factory refused to hear or a taker it keeps that the field does not show. [601d] A
 * taker your Factory keeps that the field does not show comes first, and a refusal that means something for the same task stays beneath
 * it, on a line of its own, so neither hides the other (a failure that passes is forgotten once Factory keeps a taker: systemStore
 * forgetKeptPassing). By offer ref; none for a task that stands whole. */
function offerNotesOf(held: HeldField, yours: string | null): Record<string, string> {
  const notes: Record<string, string> = {}
  if (held.state !== 'read' || !held.offers) return notes
  const world = yourFieldWorld(held, yours), factory = factoryAtStar()
  const taken = factory.state === 'read' ? factory.taken ?? null : null
  for (const offer of held.offers) {
    const relay = relayOf(offer.offer_ref), told = takenRelayOf(offer.offer_ref)
    const kept = factory.state === 'read' ? factory.madeTaker?.[offer.offer_ref] ?? null : null
    const keptOther = kept && offer.taker_world_ref && kept !== offer.taker_world_ref && isMine(held, offer.world_ref) ? kept : null
    const refused = relay?.state === 'refused' ? `Your Factory was told it was revoked, and refused: ${relay.why}`
      : told?.state !== 'refused' ? null
      : told.passingAt === undefined ? `Your Factory was told who took it up, and refused: ${told.why}`
      : `Your Factory could not hear who took it up just now: ${told.why} It is told again as the field moves, at most once a minute.`
    if (keptOther && offer.taker_world_ref) {
      notes[offer.offer_ref] = [`Your Factory keeps ${whoOf(keptOther)} as the world that took it up; the field shows ${whoOf(offer.taker_world_ref)}. ${relay?.state === 'refused' || told?.state === 'refused' ? 'Nothing more is told.' : 'Nothing was told.'}`,
        ...(refused ? [refused] : [])].join('\n')
    }
    else if (refused) notes[offer.offer_ref] = refused
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

/** [SF13.3c] Tell the Factory state that made a task of yours which world took it up, as the field verified it, so that Factory serves
 * what the grant lets be read to that world alone, and takes back only what that world returns (`offer-taken --by`; Factory's
 * `offer-read --asker` and `offer-receive --by`; DLW build ruling 2026-11-09, Factory #313's F1).
 *  - The taker is the field row's `taker_world_ref`: the field's take_offer set it only for a caller holding that world (its
 *    requireOwnWorld), never from what a request names. It goes beside the document (`by`), never in it; the document carries only
 *    its name, the field's own for it (whoOf), and its moment, the field's (the row's moved_at: the take's while it stands taken, the
 *    return's once something came back, by which it was taken).
 *  - Only an offer the field shows one of your worlds made, while it stands taken or returned, to the state that made it: a take not
 *    told before its return is told then, so what came back can be received (fieldModel takesToTell). Its name goes in words Factory
 *    keeps (fieldModel nameForFactory).
 *  - Once per offer, across restarts: Factory's own record is kept. An offer whose taker that state keeps is never told again; one it
 *    refused for what the refusal means is told once in a window's life, and the refusal stays under the task in Factory's words.
 *    [SF13.3d M2] One that failed for a reason that passes (Factory busy or unable to read or write its record, Factory not reached) is
 *    told again on a move of the field a minute or more on, never in a loop: the window tells as the field moves (SystemReadings
 *    tellTakesDue), and `now` is that move's moment. [SF13.3e] Its note goes once a reading shows the taker kept (systemStore
 *    forgetKeptPassing). A taker Factory keeps that the field does not show is said there, and nothing is told.
 *  - Every take due is marked as being told before the first is asked, so a move of the field while they are told tells none twice. */
export async function relayTaken(now = Date.now()): Promise<void> {
  const held = heldField(), factory = factoryAtStar(), ask = systemActs()?.factory
  if (factory.state !== 'read' || !ask) return
  const due = takesToTell(held, factory, takenRelayOf, now)
  for (const {offer} of due) noteTakenRelay(offer.offer_ref, {state: 'telling'})
  for (const {offer, statePath, taker, takenAt} of due) {
    try {
      await ask({kind: 'task-offer-act', state_path: statePath, verb: 'offer-taken', by: taker,
        request: {offer_ref: offer.offer_ref, by: {name: nameForFactory(taker)}, taken_at: takenAt}})
      noteTakenRelay(offer.offer_ref, {state: 'told'})
    } catch (cause) {
      // [601d] a failure that passes is told again a minute after it came back, never a minute after the move that asked: a tell may run
      // to the kernel's limit first (DLW build ruling 2026-11-09)
      noteTakenRelay(offer.offer_ref, {state: 'refused', why: cause instanceof Error ? cause.message : String(cause), ...(passingFailure(cause) ? {passingAt: Date.now()} : {})})
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
export const STAR_ACT_KEYS = ['starLight', 'starGather', 'starLeave', 'starAdmit', 'starClose', 'starSay', 'starUnsay', 'agentAsk', 'agentUnask',
  'starRename', 'starHandOn', 'starKeep', 'starTakeOn'] as const
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
  askWorld: null, askBy: null, askAddress: '', askWords: '', ask: null, handTo: null,
  worldName: '', showPart: null, showTo: null, shownPart: null, contributeTo: null, contributeWhat: 'question', contributeWords: '', contributeBeside: null, contribution: null, answerWords: '', other: null, searchLine: '', searches: [], search: null}

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
  const act = (statePath: string, verb: string, request: Record<string, unknown>, by?: string) =>
    ask({kind: 'task-offer-act', state_path: statePath, verb, request, ...(by === undefined ? {} : {by})})
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
      await act(state, 'offer-take', {offer: offer!.offer, by: {world_ref: world, name: nameForFactory(world)}})
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
      // [SF13.3c] what came back is received as the world the field verified took the task brought it back (Factory #313's F2)
      const taker = offer!.taker_world_ref
      if (!taker) throw Error('The field names no world that took this task, so nothing comes back to it.')
      // [SF13.3d H1] a take your Factory's reading says it keeps no taker for (null; an unread one is not told), and this window has not
      // told, is told first, as the field verified it: a window that opens straight onto the return, or a task returned before the take
      // was told at all, still gets there
      const keepsNone = factory.state === 'read' && factory.madeTaker?.[offer!.offer_ref] === null
      if (keepsNone && takenRelayOf(offer!.offer_ref)?.state !== 'told') {
        await act(state, 'offer-taken', {offer_ref: offer!.offer_ref, by: {name: nameForFactory(taker)}, taken_at: offer!.moved_at ?? Date.now()}, taker)
        noteTakenRelay(offer!.offer_ref, {state: 'told'})
      }
      await act(state, 'offer-receive', {return: offer!.returned}, taker)
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
    case 'agentAsk': return {act: 'ask', star: hand.star, world: hand.askWorld, by: hand.askBy, address: hand.askAddress, words: hand.askWords}
    case 'agentUnask': return {act: 'unask', star: hand.star, ask: hand.ask}
    // [SF03] the star you hold renamed with the words to light one by, handed on to the world chosen or kept; one handed to you taken on
    case 'starRename': return {act: 'rename', star: hand.star, name: hand.name, gathers: hand.gathers, comes: hand.comes}
    case 'starHandOn': return {act: 'hand-on', star: hand.star, world: hand.handTo}
    case 'starKeep': return {act: 'keep', star: hand.star}
    case 'starTakeOn': return {act: 'take-on', star: hand.star}
  }
}

/** The star chosen and its waiting worlds, the star to light, what to say there, and each act's standing. */
function starValues(reading: NonNullable<AtlasReading['field']>): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const hand = reading.hand ?? NO_HAND, held = reading.held
  const values: Record<string, ParamValue> = {starName: hand.name, starGathers: hand.gathers, starComes: hand.comes, sayWhat: hand.what, sayWords: hand.words,
    askAddress: hand.askAddress, askWords: hand.askWords}
  if (hand.askBy) values.askBy = hand.askBy
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
    // [SF10] the world whose agent to ask stands chosen while it is gathered at the star; the ask chosen while it stands here
    if (hand.askWorld && held.gatherings.some(gathering => gathering.star_ref === hand.star && gathering.world_ref === hand.askWorld && gathering.state === 'gathered')) values.askWorld = hand.askWorld
    if (hand.ask && held.asks?.some(ask => ask.star_ref === hand.star && ask.ask_ref === hand.ask)) values.fieldAsk = hand.ask
    // [SF03] the world to hand the star on to stands chosen while it is gathered there
    if (hand.handTo && held.gatherings.some(gathering => gathering.star_ref === hand.star && gathering.world_ref === hand.handTo && gathering.state === 'gathered')) values.handTo = hand.handTo
    if (hand.dayPage !== null) values.dayPage = hand.dayPage
    if (hand.saidPage !== null) values.saidPage = hand.saidPage
  }
  const reached = systemActs() !== null
  for (const key of STAR_ACT_KEYS) {
    const made = starRequest(held, reading.yours, starActOf(key, {...hand, star: (values.fieldStar as string | undefined) ?? null, admit: (values.fieldAdmit as string | undefined) ?? null,
      to: (values.fieldSayTo as string | undefined) ?? null, askWorld: (values.askWorld as string | undefined) ?? null, ask: (values.fieldAsk as string | undefined) ?? null,
      handTo: (values.handTo as string | undefined) ?? null}), 0)
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
  else if (key === 'agentAsk') chooseStarHand({askWords: ''})
  else if (key === 'agentUnask') chooseStarHand({ask: null})
  else if (key === 'starRename') chooseStarHand({name: '', gathers: ''})
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
 * they are (none while your body's locations are not read); and the entries of today's Day, as the Day offers them (SF06): each is only
 * offered here, and Central names the part you show only when you press Show (actYours). An entry Central would refuse stands as a row
 * that says why. */
function yourParts(reading: AtlasReading): YourPart[] {
  const places = 'rows' in reading.locations ? reading.locations.rows.map(row => ({id: row.id, label: row.name, at: {lat: row.lat, lon: row.lon},
    kind: row.written !== undefined ? 'project' : (PLACE_KINDS as readonly string[]).includes(row.kind) ? row.kind : 'place'})) : []
  return [...places, ...(dayEntries()?.entries ?? []).map(({id, kind, label, why}) => ({id, kind, label, ...(why ? {why} : {})}))]
}
/** Said when the entry chosen is no longer among what today's Day offers (the Day moved, closed, or its device went). */
export const DAY_ENTRY_GONE = 'That entry is no longer offered by today’s Day: choose it again from what the Day offers now. Nothing reached the field.'
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
  values.yourParts = JSON.stringify(parts.map(({id, kind, label, why}) => ({id, kind, label, ...(why ? {why} : {})})))
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
    // a Day's entry as it is offered is brought on the press (actYours), so it stands as any other part does
    if ('refusal' in made && made.refusal !== DAY_ENTRY_UNBROUGHT) standing[key] = {disabled: made.refusal}
    else if (!reached) standing[key] = {disabled: NOT_REACHED}
  }
  return {values, standing}
}

/** Ask the field for one act on your world; the hand follows what was done (the name is the world's once linked, a part shown or
 * withdrawn is no longer chosen). */
async function actYours(key: YourActKey, reading: AtlasReading, field: NonNullable<AtlasReading['field']>): Promise<void> {
  const act = yourActOf(key, reading, starHand())
  // An entry of today's Day is brought by this press alone: Central names its part (an opaque ref, its kind and its label), and that part
  // is what the field receives; a refusal is Central's words, and nothing reaches the field (SF06). A candidate with no offer standing
  // for it is refused, never sent as it was offered (DLW build ruling 2026-11-09). A part is a Day entry by membership as well as by its
  // prefix: whatever the Day offers goes through the press, whatever its id.
  const day = dayEntries(), offered = (id: string): boolean => id.startsWith(DAY_ENTRY_CANDIDATE) || !!day?.entries.some(entry => entry.id === id)
  const entry = act.act === 'show' && !!act.part && offered(act.part.id)
  let made = yourRequest(heldField(), field.yours, act, Date.now())
  // every check of the field's is made before Central is asked; an entry as it was offered is the one refusal the press itself answers
  if ('refusal' in made && !(entry && made.refusal === DAY_ENTRY_UNBROUGHT)) throw Error(made.refusal)
  const acts = systemActs()
  if (!acts) throw Error(NOT_REACHED)
  if (act.act === 'show' && act.part && offered(act.part.id)) {
    const offer = day?.entries.find(entry => entry.id === act.part!.id)
    if (!day || !offer) throw Error(DAY_ENTRY_GONE)
    if (offer.why) throw Error(offer.why)
    const part = await day.bring(offer)
    if (offered(part.id)) throw Error(DAY_ENTRY_GONE)
    made = yourRequest(heldField(), field.yours, {...act, part}, Date.now())
  }
  if ('refusal' in made) throw Error(made.refusal)
  await acts.fieldAct(made.request)
  if (key === 'fieldLink') chooseStarHand({worldName: ''})
  else if (key === 'partShow') chooseStarHand({showPart: null})
  else if (key === 'partWithdraw') chooseStarHand({shownPart: null})
}

// ── contributing to what another world shows (O-I #858 SF07; manual §17.2 "Contribute") ──────────────────────────────────────────────
//
// The World's Contribute page. What to contribute to (a part another world shows, or a contribution there), what it is and its words,
// the contribution chosen to answer or take back and the words to answer it with are the view's own hand (systemStore.ts StarHand); each
// act is one request of the held field (contributionRequest). None of the keys is a declared row of the family: an agent sets none of them
// and no relay or default asks any of them; only the person's own press on the face does (DLW build ruling 2026-11-06, from manual §16.10
// "How a control moves"): Contribute sends your words into another's world, Accept makes another's words stand in yours and Refuse sends
// yours to its contributor, so each is held; Take back narrows what stands and is pressed.

/** The acts on contributions, by the World's value key. */
export const CONTRIBUTE_ACT_KEYS = ['contribute', 'contributionAccept', 'contributionRefuse', 'contributionTakeBack'] as const
type ContributeActKey = (typeof CONTRIBUTE_ACT_KEYS)[number]
const isContributeAct = (key: string): key is ContributeActKey => (CONTRIBUTE_ACT_KEYS as readonly string[]).includes(key)

/** One act on contributions: `to` names what to contribute to (a contributionTargets id), `contribution` a contribution's ref. */
export type ContributionAct =
  | {readonly act: 'contribute'; readonly to: string | null; readonly what: string; readonly words: string; readonly beside?: string | null}
  | {readonly act: 'accept' | 'refuse'; readonly contribution: string | null; readonly words: string}
  | {readonly act: 'take-back'; readonly contribution: string | null}
type ReadField = Extract<HeldField, {state: 'read'}>
/** Something your world may contribute to, as the face offers it, and what the field is asked to aim it at. */
export interface ContributionTarget {readonly id: string; readonly label: string; readonly does: string; readonly to: Readonly<Record<string, string>>
  /** a part's own name, for the match by name the face makes with yours (SF09); none for a contribution */
  readonly name?: string}

// What has reached you from the field (SF08) is the field model's (system/fieldModel.ts reachedRows): the World and the Day read it alike.
export {reachedRows, type ReachedRow}

/** What your world may contribute to: each part another world shows that you read (to the field, the public or at a star you are
 * gathered at), named as the World names a part, then whose world it is ("Mara’s plate · mara"); and each contribution you read that
 * stands in another world and was not refused, named by its line ("mara’s question on Mara’s plate"). Never your own world. */
export function contributionTargets(field: ReadField, yourNames: readonly string[] = []): ContributionTarget[] {
  // a part another shows by the name of one of yours is noted for you alone (SF09): matched in this window, nothing of it sent
  const names = new Set(yourNames.map(nameKey).filter(Boolean)), match = (label: string) => (names.has(nameKey(label)) ? ' You hold one by this name: claim it the same work to set yours beside it.' : '')
  // a part of a world whose owner's machine is off reads as it was last left (SF11): what you contribute waits for them all the same
  const leftOf = (ref: string) => { const world = field.worlds.find(one => one.world_ref === ref); return world ? worldLeft(world) : null }, now = Date.now()
  const shown = field.clearings.filter(row => !isMine(field, row.world_ref)).map(row => { const who = whoOf(row.world_ref), left = leftOf(row.world_ref)
    return {id: JSON.stringify([row.world_ref, row.part_ref, row.star_ref ?? '']), label: `${row.shown.label} · ${who}`, name: row.shown.label,
      does: `A ${row.shown.kind} ${who} shows ${row.star_ref ? 'at a star' : row.audience === 'public' ? 'to the public' : 'to the field'}.${left ? ` ${leftWords(who, row.shown.kind, left, now)}` : ''}${match(row.shown.label)}`,
      to: {world_ref: row.world_ref, part_ref: row.part_ref, ...(row.star_ref ? {star_ref: row.star_ref} : {})}} })
  const above = (field.contributions ?? []).filter(row => row.state !== 'refused' && !isMine(field, row.world_ref)).map(row => ({id: row.contribution_ref,
    label: contributionLine(field, row), does: row.words, to: {contribution_ref: row.contribution_ref}}))
  return [...shown, ...above]
}

const NO_CONTRIBUTIONS = 'This field’s service does not keep contributions to a world yet.'
/** The SharedField request for one act on contributions, or why it cannot be asked. */
export function contributionRequest(field: HeldField, yours: string | null, act: ContributionAct, nonce: number): {readonly request: Record<string, unknown>} | {readonly refusal: string} {
  if (field.state === 'reading') return {refusal: FIELD_BEING_READ}
  if (field.state === 'unavailable') return {refusal: field.reason}
  if (!field.contributions) return {refusal: field.contributeWhy ?? NO_CONTRIBUTIONS}
  const words = act.act === 'take-back' ? '' : act.words.trim()
  if ([...words].length > 1000) return {refusal: 'Say it in at most 1000 characters.'}
  if (act.act === 'contribute') {
    const ref = yourFieldWorld(field, yours)
    const world = ref === null ? undefined : field.worlds.find(row => row.world_ref === ref)
    if (!world?.linked) return {refusal: 'Link your world into the field before you contribute to another.'}
    if (!act.to) return {refusal: 'Choose what to contribute to first: something another world shows, or a contribution there.'}
    const target = contributionTargets(field).find(row => row.id === act.to)
    if (!target) return {refusal: 'That is no longer there to contribute to.'}
    if (!(CONTRIBUTION_WHATS as readonly string[]).includes(act.what)) return {refusal: 'Choose what it is: a question, a finding, a correction, a reproduction or the same work.'}
    // The ref carries the world's name as it is shown, as it stands (be2k ruling 7; DLW build ruling 2026-11-10): a name with nothing
    // visible left is `unnamed-world-<mark>` here, never its spelling, its ref or its nonce. It names a new record; none is altered.
    const name = whoOf(world.world_ref).replace(/[^A-Za-z0-9._-]+/g, '-') || 'world'
    const named = `contribution:${Math.abs(Math.trunc(nonce)).toString(36)}:${name}`
    if (act.what === 'same') {
      // a claim of the same work (SF09) stands on a part another shows, and sets a part your world shows beside it
      if (!('part_ref' in target.to)) return {refusal: 'A work is claimed the same as something a world shows, not as a contribution.'}
      if (!act.beside) return {refusal: 'Choose the part of yours it is the same work as.'}
      const beside = yourShown(field, yours).find(row => row.id === act.beside)
      if (!beside) return {refusal: 'That part of yours is no longer shown: show it first.'}
      if (!words) return {refusal: 'Say why they are one work.'}
      return {request: {kind: 'world-claim-same', contribution_ref: named, world_ref: world.world_ref, to: target.to, beside: {part_ref: beside.part, ...(beside.star ? {star_ref: beside.star} : {})}, words}}
    }
    if (!words) return {refusal: 'Say something first.'}
    return {request: {kind: 'world-contribute', contribution_ref: named, world_ref: world.world_ref, to: target.to, what: act.what, words}}
  }
  if (!act.contribution) return {refusal: 'Choose a contribution first.'}
  const chosen = field.contributions.find(row => row.contribution_ref === act.contribution)
  if (!chosen) return {refusal: 'That contribution is no longer there.'}
  if (act.act === 'take-back') return isMine(field, chosen.from_world_ref) ? {request: {kind: 'world-contribution-take-back', contribution_ref: chosen.contribution_ref}}
    : {refusal: 'Only the one who contributed it takes it back.'}
  if (!isMine(field, chosen.world_ref)) return {refusal: 'Only the owner of the world it was contributed to answers it.'}
  if (chosen.state !== 'waiting') return {refusal: chosen.state === 'accepted' ? 'It is accepted: it stands in your world.' : 'It was refused: it waits no more.'}
  if (act.act === 'refuse') return words ? {request: {kind: 'world-contribution-refuse', contribution_ref: chosen.contribution_ref, words}} : {refusal: 'Say why, in your own words.'}
  return {request: {kind: 'world-contribution-accept', contribution_ref: chosen.contribution_ref, ...(words ? {words} : {})}}
}

/** One contribution as the face lists it: who contributed what to what in a line, where it stands, its words (and the owner's under yours). */
export interface ContributionRow {readonly id: string; readonly name: string; readonly note: string; readonly does: string; readonly mine: boolean; readonly yours: boolean}
const STANDING_NOTE: Readonly<Record<FieldContribution['state'], string>> = {waiting: 'waiting', accepted: 'accepted', refused: 'refused'}
/** Each contribution you read, in the order it came: whose (yours, or another world's), what, and on what — a part by its label while you
 * read it, or the contribution above it; noted where it stands, and one waiting in your world as waiting for you. */
export function contributionRows(field: ReadField): ContributionRow[] {
  return (field.contributions ?? []).map(row => {
    const yours = isMine(field, row.world_ref), mine = isMine(field, row.from_world_ref)
    const answer = row.answer ? ` ${row.state === 'refused' ? 'Refused' : 'Accepted'} with: “${row.answer}”` : ''
    const beside = row.what === 'same' ? ` It sets ${besideLine(field, row)} beside it, as one work.` : ''
    return {id: row.contribution_ref, name: contributionLine(field, row), note: yours && row.state === 'waiting' ? 'waits for you' : STANDING_NOTE[row.state],
      does: `“${row.words}”${beside}${answer}`, mine, yours}
  })
}


/** The act a key names, from the view's hand. */
function contributeActOf(key: ContributeActKey, hand: StarHand): ContributionAct {
  switch (key) {
    case 'contribute': return {act: 'contribute', to: hand.contributeTo, what: hand.contributeWhat, words: hand.contributeWords, beside: hand.contributeBeside}
    case 'contributionAccept': return {act: 'accept', contribution: hand.contribution, words: hand.answerWords}
    case 'contributionRefuse': return {act: 'refuse', contribution: hand.contribution, words: hand.answerWords}
    case 'contributionTakeBack': return {act: 'take-back', contribution: hand.contribution}
  }
}

/** The contributions the Contribute page reads (what may be contributed to, and each contribution read), the choices that still stand, and
 * each act's standing; while the field's service keeps none, its words. */
function contributeValues(field: NonNullable<AtlasReading['field']>, yourNames: readonly string[] = []): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const hand = field.hand ?? NO_HAND, held = field.held
  const values: Record<string, ParamValue> = {contributeWhat: hand.contributeWhat, contributeWords: hand.contributeWords, answerWords: hand.answerWords}
  const standing: Record<string, Standing> = {}
  if (held.state === 'read' && held.contributions) {
    const targets = contributionTargets(held, yourNames)
    // the part of yours a claim of the same work sets beside its target (SF09), while your world still shows it
    if (hand.contributeBeside && yourShown(held, field.yours).some(row => row.id === hand.contributeBeside)) values.contributeBeside = hand.contributeBeside
    values.contributeTargets = JSON.stringify(targets.map(({id, label, does, name}) => ({value: id, label, does, ...(name === undefined ? {} : {name})})))
    if (hand.contributeTo && targets.some(row => row.id === hand.contributeTo)) values.contributeTo = hand.contributeTo
    values.contributions = JSON.stringify(contributionRows(held))
    if (hand.contribution && held.contributions.some(row => row.contribution_ref === hand.contribution)) values.contribution = hand.contribution
  } else if (held.state === 'read') values.contributeWhy = held.contributeWhy ?? NO_CONTRIBUTIONS
  const reached = systemActs() !== null
  const chosen = {...hand, contributeTo: (values.contributeTo as string | undefined) ?? null, contribution: (values.contribution as string | undefined) ?? null,
    contributeBeside: (values.contributeBeside as string | undefined) ?? null}
  for (const key of CONTRIBUTE_ACT_KEYS) {
    const made = contributionRequest(held, field.yours, contributeActOf(key, chosen), 0)
    if ('refusal' in made) standing[key] = {disabled: made.refusal}
    else if (!reached) standing[key] = {disabled: NOT_REACHED}
  }
  return {values, standing}
}

/** Ask the field for one act on contributions; the hand follows what was done (what was contributed and what was answered or taken back are
 * no longer chosen). */
async function actContribution(key: ContributeActKey, field: NonNullable<AtlasReading['field']>): Promise<void> {
  const made = contributionRequest(heldField(), field.yours, contributeActOf(key, starHand()), Date.now())
  if ('refusal' in made) throw Error(made.refusal)
  const acts = systemActs()
  if (!acts) throw Error(NOT_REACHED)
  await acts.fieldAct(made.request)
  if (key === 'contribute') chooseStarHand({contributeTo: null, contributeWords: '', contributeBeside: null})
  else chooseStarHand({contribution: null, answerWords: ''})
}

// ── watching another world (DLW build ruling 2026-11-06, from manual §2 "from someone you watch" and §17.2 "watch") ───────────────────
//
// A watch is a relation your world holds to another world: yours alone, the watched world never told, and nothing anywhere counts who
// watches whom. The world chosen on the Space page is the view's own hand (systemStore.ts StarHand `other`); Watch and Unwatch are each one
// request of the held field for your own world. Neither shows anything of yours or raises a reach, so each is pressed, not held (§16.10).
// Neither key is a declared row of the family: an agent sets neither, and no relay or default asks either; only the person's press does.

/** The acts on a watch, by the World's value key. */
export const WATCH_ACT_KEYS = ['worldWatch', 'worldUnwatch'] as const
type WatchActKey = (typeof WATCH_ACT_KEYS)[number]
const isWatchAct = (key: string): key is WatchActKey => (WATCH_ACT_KEYS as readonly string[]).includes(key)
/** One act on a watch: `world` the other world chosen. */
export interface WatchAct {readonly act: 'watch' | 'unwatch'; readonly world: string | null}
const NO_WATCHES = 'This field’s service does not keep the worlds you watch yet.'
/** Why Watch or Unwatch would change nothing on a world: the face says the same of the world it draws chosen. */
export const watchingAlready = (world: string): string => `You watch ${whoOf(world)} already.`
export const notWatching = (world: string): string => `You don’t watch ${whoOf(world)}.`

/** The SharedField request to watch or unwatch the world chosen from your own world, or why it cannot be asked. */
export function watchRequest(field: HeldField, yours: string | null, act: WatchAct): {readonly request: Record<string, unknown>} | {readonly refusal: string} {
  if (field.state === 'reading') return {refusal: FIELD_BEING_READ}
  if (field.state === 'unavailable') return {refusal: field.reason}
  if (!field.watches) return {refusal: field.watchWhy ?? NO_WATCHES}
  const own = yourFieldWorld(field, yours)
  if (own === null) return {refusal: 'Your world is not in the field yet: Link puts it there.'}
  if (!act.world) return {refusal: 'Choose a world first.'}
  if (!field.worlds.some(world => world.world_ref === act.world)) return {refusal: 'That world is no longer in the field you read.'}
  if (isMine(field, act.world)) return {refusal: 'That world is yours already: there is nothing to watch.'}
  const watching = field.watches.some(watch => watch.world_ref === own && watch.watched_world_ref === act.world)
  if (act.act === 'watch' && watching) return {refusal: watchingAlready(act.world)}
  if (act.act === 'unwatch' && !watching) return {refusal: notWatching(act.world)}
  return {request: {kind: act.act === 'watch' ? 'world-watch' : 'world-unwatch', world_ref: own, watched_world_ref: act.world}}
}

const watchActOf = (key: WatchActKey, world: string | null): WatchAct => ({act: key === 'worldWatch' ? 'watch' : 'unwatch', world})

/** The world chosen to watch while it is another's the field still reads, and each act's standing. */
function watchValues(field: NonNullable<AtlasReading['field']>): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const hand = field.hand ?? NO_HAND, held = field.held
  const values: Record<string, ParamValue> = {}
  const standing: Record<string, Standing> = {}
  if (held.state === 'read' && hand.other && held.worlds.some(world => world.world_ref === hand.other && !world.mine)) values.otherWorld = hand.other
  const reached = systemActs() !== null
  for (const key of WATCH_ACT_KEYS) {
    const made = watchRequest(held, field.yours, watchActOf(key, (values.otherWorld as string | undefined) ?? null))
    if ('refusal' in made) standing[key] = {disabled: made.refusal}
    else if (!reached) standing[key] = {disabled: NOT_REACHED}
  }
  return {values, standing}
}

/** Ask the field to watch or unwatch the world chosen; it stays chosen, so the other act follows on it. */
async function actWatch(key: WatchActKey, field: NonNullable<AtlasReading['field']>): Promise<void> {
  const made = watchRequest(heldField(), field.yours, watchActOf(key, starHand().other))
  if ('refusal' in made) throw Error(made.refusal)
  const acts = systemActs()
  if (!acts) throw Error(NOT_REACHED)
  await acts.fieldAct(made.request)
}

// ── a search you made over the shared field (DLW build ruling 2026-11-06, from manual §18.4 "Your own aliases" and Reach) ─────────────────
//
// A search is a mark, `@name = words`, whose Reach is the shared field. No owner keeps one a client can read with its Reach: AIKit keeps
// `@name = expression` (aikit alias define; operative_alias.rs) with no Reach, no kernel op reads it, and the shell's Search keeps no alias
// (central/devices/searchBinding.ts). So the World keeps its own, in this window's hand (systemStore.ts StarHand `searches`), and matches
// them over the held field it already reads (reachedRows): nothing is asked of the field, and nothing of yours is shown. Keep and Forget
// are pressed; neither is a declared row of the family, and no relay or default asks either.

/** The acts on your searches, by the World's value key. */
export const SEARCH_ACT_KEYS = ['searchKeep', 'searchForget'] as const
type SearchActKey = (typeof SEARCH_ACT_KEYS)[number]
const isSearchAct = (key: string): key is SearchActKey => (SEARCH_ACT_KEYS as readonly string[]).includes(key)
const SEARCH_LINE = /^@([A-Za-z][\w-]{0,39})\s*=\s*(\S.*)$/
/** The marks of Search's language (manual §18.4): a search holding one is Search's to answer, not the World's plain match. */
const SEARCH_MARK = /^(?:@.*|[+\-x\/=()?]|#.*)$/
const SEARCHES_KEPT = 12
const NO_SEARCH_KEPT = 'You keep no search yet: there is none to forget.'
const NO_SEARCH_CHOSEN = 'Choose a search first.'
/** The search a line keeps, `@name = words` in plain words, or why it keeps none; one kept again under its name replaces it. */
export function keptSearch(line: string, kept: readonly WorldSearch[], now: number): {readonly search: WorldSearch} | {readonly refusal: string} {
  if (!line.trim()) return {refusal: 'Type @name = the words to look for.'}
  const m = SEARCH_LINE.exec(line.trim())
  if (!m) return {refusal: 'A search is kept as @name = words: its name, then the words to look for.'}
  // the words are kept as they are drawn and matched: on one line, plain (be2l ruling 7)
  const words = oneLineText(m[2]!)
  if (!words) return {refusal: 'Nothing in those words shows: type the words to look for.'}
  if (words.split(/\s+/).some(word => SEARCH_MARK.test(word))) return {refusal: 'The World matches plain words over the field: a search with marks (@, +, -, x, /, =, ( ), ?) is Search’s to answer.'}
  if ([...words].length > 200) return {refusal: 'Say it in at most 200 characters.'}
  if (!kept.some(one => one.name === m[1]) && kept.length >= SEARCHES_KEPT) return {refusal: `Keep at most ${SEARCHES_KEPT} searches: forget one first.`}
  return {search: {name: m[1]!, words, at: now}}
}

/** The line being written, the searches kept and the one chosen, and each act's standing. */
function searchValues(field: NonNullable<AtlasReading['field']>): {values: Record<string, ParamValue>; standing: Record<string, Standing>} {
  const hand = field.hand ?? NO_HAND
  const values: Record<string, ParamValue> = {searchLine: hand.searchLine, fieldSearches: JSON.stringify(hand.searches)}
  if (hand.search && hand.searches.some(one => one.name === hand.search)) values.fieldSearch = hand.search
  const standing: Record<string, Standing> = {}
  const kept = keptSearch(hand.searchLine, hand.searches, 0)
  if ('refusal' in kept) standing.searchKeep = {disabled: kept.refusal}
  if (values.fieldSearch === undefined) standing.searchForget = {disabled: hand.searches.length ? NO_SEARCH_CHOSEN : NO_SEARCH_KEPT}
  return {values, standing}
}

/** Keep the search the line names (the line is cleared), or forget the one chosen: the window's own hand, nothing asked of the field. */
function actSearch(key: SearchActKey): void {
  const hand = starHand()
  if (key === 'searchForget') {
    if (!hand.searches.length) throw Error(NO_SEARCH_KEPT)
    if (!hand.search || !hand.searches.some(one => one.name === hand.search)) throw Error(NO_SEARCH_CHOSEN)
    chooseStarHand({searches: hand.searches.filter(one => one.name !== hand.search), search: null})
    return
  }
  const kept = keptSearch(hand.searchLine, hand.searches, Date.now())
  if ('refusal' in kept) throw Error(kept.refusal)
  chooseStarHand({searches: [...hand.searches.filter(one => one.name !== kept.search.name), kept.search], searchLine: ''})
}

/** The view's own hand at Field scale: the scale, the aperture and who you look as. A value that is none of them is not taken. */
const FIELD_LOCAL: Readonly<Record<string, (value: ParamValue) => void>> = {
  scale: value => { if (typeof value === 'string') chooseFieldView({field: value === 'field'}) },
  aperture: value => { if ((APERTURES as readonly unknown[]).includes(value)) chooseFieldView({aperture: value as Aperture}) },
  viewAs: value => { if ((AUDIENCES as readonly unknown[]).includes(value)) chooseFieldView({viewAs: value as Audience}) },
  fieldStar: value => chooseStarHand({star: typeof value === 'string' && value ? value : null, admit: null, to: null, dayPage: null, saidPage: null, work: null, offer: null, askWorld: null, ask: null,
    handTo: null}),
  fieldAdmit: value => chooseStarHand({admit: typeof value === 'string' && value ? value : null}),
  starName: value => { if (typeof value === 'string') chooseStarHand({name: value}) },
  starGathers: value => { if (typeof value === 'string') chooseStarHand({gathers: value}) },
  starComes: value => { if ((STAR_COMES as readonly unknown[]).includes(value)) chooseStarHand({comes: value as StarComes}) },
  fieldSayTo: value => chooseStarHand({to: typeof value === 'string' && value ? value : null}),
  sayWhat: value => { if ((SAYING_WHATS as readonly unknown[]).includes(value)) chooseStarHand({what: value as SayingWhat}) },
  sayWords: value => { if (typeof value === 'string') chooseStarHand({words: value}) },
  // [SF10] the agent to ask at the star and what to ask it, and the ask to take back: the view's own until an act sends them
  askWorld: value => chooseStarHand({askWorld: typeof value === 'string' && value ? value : null}),
  askBy: value => { if ((AGENT_BYS as readonly unknown[]).includes(value)) chooseStarHand({askBy: value as AgentBy}) },
  askAddress: value => { if (typeof value === 'string') chooseStarHand({askAddress: value}) },
  askWords: value => { if (typeof value === 'string') chooseStarHand({askWords: value}) },
  fieldAsk: value => chooseStarHand({ask: typeof value === 'string' && value ? value : null}),
  // [SF03] the world to hand the star on to: the view's own until Hand on sends it
  handTo: value => chooseStarHand({handTo: typeof value === 'string' && value ? value : null}),
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
  // [SF07] what to contribute to, what it is and its words; the contribution chosen, and the words to answer it with
  contributeTo: value => chooseStarHand({contributeTo: typeof value === 'string' && value ? value : null}),
  contributeWhat: value => { if ((CONTRIBUTION_WHATS as readonly unknown[]).includes(value)) chooseStarHand({contributeWhat: value as ContributionWhat}) },
  contributeBeside: value => chooseStarHand({contributeBeside: typeof value === 'string' && value ? value : null}),
  contributeWords: value => { if (typeof value === 'string') chooseStarHand({contributeWords: value}) },
  contribution: value => chooseStarHand({contribution: typeof value === 'string' && value ? value : null}),
  answerWords: value => { if (typeof value === 'string') chooseStarHand({answerWords: value}) },
  // the other world chosen on the Space page, to watch or unwatch (DLW build ruling 2026-11-06)
  otherWorld: value => chooseStarHand({other: typeof value === 'string' && value ? value : null}),
  // a search being written, and the search chosen to forget (DLW build ruling 2026-11-06)
  searchLine: value => { if (typeof value === 'string') chooseStarHand({searchLine: value}) },
  fieldSearch: value => chooseStarHand({search: typeof value === 'string' && value ? value : null}),
}

// ── your world's body: the World device's Body page (T-WORLDS §5 W3; manual §17.2 "Build a planet") ─────────────────────────
//
// The body rows are among the family's declared rows above (BODY_ROWS, declared in agentNativeP0.ts with the globe): the body choice is
// the view's own (which body the World shows), every other row a setting of the owner's record.

/** Why there is no world to visit (SF11). */
const NOT_VISITABLE = 'No other world in the field you read shows its body.'

/** The globe's body rows, as the family declares them (ATLAS_DECLARED_ROWS). */
export const WORLD_BODY_ROWS: readonly SdkParamRow[] = BODY_ROWS
/** The keys of the body itself (every one goes to the owner as part of one BodySet), the act `reroll` among them. */
export const WORLD_BODY_KEYS: readonly string[] = ['seed', 'reroll', 'coast', ...WORLD_BODY_SETTINGS.map(setting => setting.key)]

/** Another world as the World draws it (system/enteredWorld.ts otherBody). */
export type OtherBody = NonNullable<ReturnType<typeof otherBody>>

/** The body page's readings: the body chosen, and the record of the body shown where it reads: your own, or another world's entered or
 * visited (SF11), which are readings only. */
export function bodyValues(body: AtlasReading['body']): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {body: body.choice}
  if (body.choice === 'other') {
    // a world visited whose body is not read now stays chosen, with why (O-I #858 TX14): never an empty "Another world"
    if (!body.other && body.otherWhy) return {...values, visitWorld: body.otherWhy.ref, bodyName: whoOf(body.otherWhy.ref), visitWhy: body.otherWhy.why}
    if (!body.other) return values
    values.bodyName = body.other.name
    if (body.other.visit) values.visitWorld = body.other.ref
    return {...values, ...settingValues(body.other.record)}
  }
  const state = body.state
  if (state.state !== 'read') return values
  values.bodyName = typeof state.reading.space.title === 'string' && state.reading.space.title ? state.reading.space.title : state.reading.space.ref
  return state.record ? {...values, ...settingValues(state.record)} : values
}

/** A body record's settings by the Body page's value keys. */
function settingValues(record: WorldBodyRecord): Record<string, ParamValue> {
  const values: Record<string, ParamValue> = {}
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

/** Why the body's settings cannot be written now, or null: the Earth not mounted, then the owner's own standing. Another world's body is
 * its owner's, and while none is drawn none is read. */
export function bodyRefusal(reading: AtlasReading): string | null {
  if (!reading.mounted) return NOT_MOUNTED
  if (reading.body.choice === 'other') return reading.body.other ? READ_ONLY : reading.body.otherWhy?.why ?? NO_OTHER
  return bodyWriteRefusal()
}

/** The World's Deep time: the design's four clock keys (Year, All time, Play, Cumulative), each written by the owner's own setter, the
 * setters the time-control face's rows name above (shell.setAtlasCursor, AllTime, Play, Cumulative). The design draws these controls, so
 * the World's binding carries the same reading (AtlasReading.clock) and the same writes: without them each drew "No reading from the owner
 * yet" and its press was refused as a reading. */
const CLOCK_WRITERS: Readonly<Record<string, string>> = {cursor: 'shell.setAtlasCursor', allTime: 'shell.setAtlasAllTime', playing: 'shell.setAtlasPlay', cumulative: 'shell.setAtlasCumulative'}

/** The World design's binding (inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx, the Body page and the globe's whole-field
 * choice): the owner's readings by the design's value keys, its writes through the owners' setters, and each value's standing. A body
 * change and a reroll go to the owner as one BodySet; the body choice is the view's own hand. Values no owner reads here (the places,
 * the sky, the graph, the locations on your body) are absent, never defaulted. */
export function atlasGlobeBinding(reading: AtlasReading): DesignBinding {
  // A reading that carries no field part (one made before the field was read into it) hands the face no field: the face then names it.
  const field = reading.field ? fieldValues(reading.field) : {values: {}, standing: {}}
  const yours = reading.field ? yourValues(reading, reading.field) : {values: {}, standing: {}}
  const contributing = reading.field ? contributeValues(reading.field, yourParts(reading).filter(part => !part.why).map(part => part.label)) : {values: {}, standing: {}}
  const watching = reading.field ? watchValues(reading.field) : {values: {}, standing: {}}
  const searching = reading.field ? searchValues(reading.field) : {values: {}, standing: {}}
  const values: Record<string, ParamValue> = {...bodyValues(reading.body), ...field.values, ...yours.values, ...contributing.values, ...watching.values, ...searching.values,
    view: reading.view, mounted: reading.mounted}
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
  const standing: Record<string, Standing> = {...field.standing, ...yours.standing, ...contributing.standing, ...watching.standing, ...searching.standing}
  // the locations on your own body: a reading (the places stand on it through their owners' PlaceSet, the landings through each world's
  // own BodySet); the place kind is the view's own choice of what the next click places
  values.placeKind = reading.placeKind
  // the clock the mounted atlas keeps: the year its window stands at, all time, play and cumulative (a stopped Earth has none)
  if (reading.clock) {
    values.cursor = reading.clock.cursorU
    values.allTime = reading.clock.mode === 'all'
    values.playing = reading.clock.playing
    values.cumulative = reading.clock.cumulative
  } else for (const key of Object.keys(CLOCK_WRITERS)) standing[key] = {disabled: NOT_MOUNTED}
  // the body the globe draws, for the design's pictures (the Compact, the Widget and the Body page draw the globe's own body, never a second one):
  // the record and the look it is drawn with; and, for a body built by an older generator, what its next change does (the ticket's rule: it draws
  // as it always did until it is changed, and the change rebuilds it)
  const shown = reading.body.state.state === 'read' && reading.body.choice === 'own' ? reading.body.state.record : null
  if (shown) {
    values.bodyRecord = JSON.stringify(shown)
    if (reading.look) values.bodyLook = JSON.stringify(reading.look)
    if (shown.generator.version < WORLD_BODY_GENERATOR_VERSION) values.generationNote = `This body was built by generator ${shown.generator.version}; the current generator is ${WORLD_BODY_GENERATOR_VERSION}. Its next change rebuilds it.`
  }
  // [SF11] another world drawn as the body, entered or visited: its record and, for one entered, its look; its next change is its owner's
  const other = reading.body.choice === 'other' ? reading.body.other ?? null : null
  if (other) {
    values.bodyRecord = JSON.stringify(other.record)
    if (other.look) values.bodyLook = JSON.stringify(other.look)
  }
  // [TX14] a world visited whose body cannot be read now: your own body stands in the display meanwhile (its settings unread, as the
  // visited world's are), and the visit comes back with the field
  const own = reading.body.state.state === 'read' ? baseBody(reading.body.state) : null
  if (reading.body.choice === 'other' && !other && reading.body.otherWhy && own) {
    values.bodyRecord = JSON.stringify(own)
    if (reading.look) values.bodyLook = JSON.stringify(reading.look)
  }
  // [SF11] the world to visit: one of the others the field shows with a body, the view's own hand
  const visits = reading.field ? visitable(reading.field.held) : []
  if (!reading.field || reading.field.held.state !== 'read') standing.visitWorld = {disabled: reading.field ? heldFieldWhy(reading.field.held) as string : NOT_VISITABLE}
  else if (!visits.length && !values.visitWorld) standing.visitWorld = {disabled: NOT_VISITABLE}
  // [#762] the focus label's acts, the closes of the reading cards and the graph's display, as the pane drew them before it stood them down
  // (the World design's Focus and Display, catalogue/panels/paneControls.tsx); a press is the atlas's own control pressed
  if (reading.mounted && reading.pane) {
    values['pane.controls'] = JSON.stringify(reading.pane.controls)
    if (reading.pane.title) values['pane.title'] = reading.pane.title
  } else standing['pane.press'] = {disabled: NOT_MOUNTED}
  if (reading.body.choice === 'earth') standing.locations = {disabled: EARTH_LOCATIONS}
  else if (reading.body.choice === 'other') standing.locations = {disabled: other ? READ_ONLY : reading.body.otherWhy?.why ?? NO_OTHER}
  else if ('unread' in reading.locations) standing.locations = {disabled: reading.locations.unread}
  else values.locations = JSON.stringify(reading.locations.rows)
  if (!reading.mounted) standing.placeKind = {disabled: NOT_MOUNTED}
  if (refusal) for (const key of WORLD_BODY_KEYS) standing[key] = {disabled: refusal}
  if (!reading.mounted) standing.body = {disabled: NOT_MOUNTED}
  if (!reading.mounted) standing.wholeField = {disabled: NOT_MOUNTED}
  else if (reading.globe?.scopeLabel == null) standing.wholeField = {disabled: NO_SCOPE}
  // [O-I #858 TO10] Space or Graph, at every scale the Field's too: the atlas's own View, through the Earth ⇄ Graph switch's setter, whose
  // choice stands whether or not the Earth has mounted yet (agent/shellSetterBridge.ts shell.setAtlasView)
  const writable = (key: string) => key === 'view' || (key === 'wholeField' ? !standing.wholeField : isStarAct(key) || isWorkAct(key) || isYourAct(key) || isContributeAct(key) || isWatchAct(key) || isSearchAct(key) ? !!reading.field && !standing[key] : key in CLOCK_WRITERS ? !!reading.clock : WORLD_BODY_KEYS.includes(key) && !refusal)
  return {
    id: techneDeviceId(ATLAS_FAMILY, 'globe-engine'), values, standing, enabledKey: 'mounted',
    // The clock moves the cursor while it plays: the value shows what moves it, as the time-control face says it
    ...(reading.clock?.playing ? {heldBy: {cursor: 'the clock, playing'}} : {}),
    writes: writable,
    write: async (changes: readonly ValueChange[]) => {
      const body: Record<string, unknown> = {}
      for (const change of changes) {
        if (change.key === 'wholeField') await writeThroughOwner('shell.setAtlasWholeField', change.value)
        else if (change.key === 'view') await writeThroughOwner('shell.setAtlasView', change.value)
        else if (isStarAct(change.key) && reading.field) await actAtStar(change.key, reading.field)
        else if (isWorkAct(change.key) && reading.field) await workAtStar(change.key, reading.field)
        else if (isYourAct(change.key) && reading.field) await actYours(change.key, reading, reading.field)
        else if (isContributeAct(change.key) && reading.field) await actContribution(change.key, reading.field)
        else if (isWatchAct(change.key) && reading.field) await actWatch(change.key, reading.field)
        else if (isSearchAct(change.key) && reading.field) actSearch(change.key)
        // Leaving all time is the cursor's or Play's own act (the owner refuses a direct false), and the design says it with the same gesture
        else if (change.key === 'allTime' && change.value === false && changes.some(other => other.key === 'cursor' || (other.key === 'playing' && other.value === true))) continue
        else if (change.key in CLOCK_WRITERS) await writeThroughOwner(CLOCK_WRITERS[change.key]!, change.value)
        else if (WORLD_BODY_KEYS.includes(change.key)) body[change.key] = change.value
        else throw Error(`${change.key} is not written from the World's own controls`)
      }
      // every body change of one gesture is one BodySet: the owner sees the whole body once, at the revision it was read at
      if (Object.keys(body).length) await writeThroughOwner('shell.setWorldBody', body)
    },
    local: {
      ...FIELD_LOCAL,
      body: value => { if (value === 'own' || value === 'earth' || value === 'other') chooseBody(value) },
      // [SF11] another's world to visit; its drop leaves it, back on your own
      visitWorld: value => { if (typeof value === 'string' && value) visitWorld(value, ref => visitedBody(heldField(), ref)); else if (value === undefined) leaveWorld() },
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
