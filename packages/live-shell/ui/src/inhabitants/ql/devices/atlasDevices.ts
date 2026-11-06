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
  BODY_CHOICES, NO_OTHER, WORLD_BODY_SETTINGS, bodyChoice, bodyWriteRefusal, bodyWriter, chooseBody, worldBodyState,
  type BodyChoice, type WorldBodyState,
} from '../../../projections/atlas/body/worldBody'
import {suiteStanding} from '../../../projections/atlas/provider/suiteStanding'
import {chooseFieldView, chooseStarHand, fieldView, heldField, starHand, systemActs, systemReading, type FieldView, type StarHand} from '../../../projections/atlas/system/systemStore'
import {APERTURES, AUDIENCES, SAYING_WHATS, STAR_COMES, heldFieldWhy, shownId, starRequest, type Aperture, type Audience, type HeldField, type SayingWhat, type StarAct, type StarComes} from '../../../projections/atlas/system/fieldModel'
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
    const {worlds, clearings, stars, gatherings, days, dayWhy, sayings, sayWhy} = reading.held
    values.field = JSON.stringify({worlds, clearings, stars, gatherings, days, dayWhy, sayings, sayWhy})
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
// asked. Showing work and offering a task at a star are Software Factory's (stories SF12, SF13): Factory answers what of a Run may be
// shown and makes, revokes, accepts and takes offers (the kernel's factory_owner work-show-read and task-offer-act), and the field
// carries them (work-show, offer-put and the rest); this window has no Run to choose at a star yet, so they stand dimmed naming that.

/** The acts at a star, by the World's value key. */
export const STAR_ACT_KEYS = ['starLight', 'starGather', 'starLeave', 'starAdmit', 'starClose', 'starSay', 'starUnsay'] as const
type StarActKey = (typeof STAR_ACT_KEYS)[number]
const isStarAct = (key: string): key is StarActKey => (STAR_ACT_KEYS as readonly string[]).includes(key)
/** Software Factory's acts at a star (SF12, SF13), dimmed for what this window lacks: a Run to choose. */
export const FACTORY_AT_STAR: Readonly<Record<'starShow' | 'starOffer', string>> = {
  starShow: 'Showing a piece of work takes a Run of Software Factory’s, and this window has no Run to choose yet.',
  starOffer: 'Offering a task takes a task of a Run of Software Factory’s, and this window has no Run to choose yet.',
}
const NOT_REACHED = 'The shared field is not reached from this window.'
const NO_HAND: StarHand = {star: null, admit: null, name: '', gathers: '', comes: 'anyone', to: null, what: 'question', words: '', dayPage: null, saidPage: null}

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
  const standing: Record<string, Standing> = {starShow: {disabled: FACTORY_AT_STAR.starShow}, starOffer: {disabled: FACTORY_AT_STAR.starOffer}}
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

/** The view's own hand at Field scale: the scale, the aperture and who you look as. A value that is none of them is not taken. */
const FIELD_LOCAL: Readonly<Record<string, (value: ParamValue) => void>> = {
  scale: value => { if (typeof value === 'string') chooseFieldView({field: value === 'field'}) },
  aperture: value => { if ((APERTURES as readonly unknown[]).includes(value)) chooseFieldView({aperture: value as Aperture}) },
  viewAs: value => { if ((AUDIENCES as readonly unknown[]).includes(value)) chooseFieldView({viewAs: value as Audience}) },
  fieldStar: value => chooseStarHand({star: typeof value === 'string' && value ? value : null, admit: null, to: null, dayPage: null, saidPage: null}),
  fieldAdmit: value => chooseStarHand({admit: typeof value === 'string' && value ? value : null}),
  starName: value => { if (typeof value === 'string') chooseStarHand({name: value}) },
  starGathers: value => { if (typeof value === 'string') chooseStarHand({gathers: value}) },
  starComes: value => { if ((STAR_COMES as readonly unknown[]).includes(value)) chooseStarHand({comes: value as StarComes}) },
  fieldSayTo: value => chooseStarHand({to: typeof value === 'string' && value ? value : null}),
  sayWhat: value => { if ((SAYING_WHATS as readonly unknown[]).includes(value)) chooseStarHand({what: value as SayingWhat}) },
  sayWords: value => { if (typeof value === 'string') chooseStarHand({words: value}) },
  dayPage: value => { if (typeof value === 'number' && Number.isInteger(value) && value >= 0) chooseStarHand({dayPage: value}) },
  saidPage: value => { if (typeof value === 'number' && Number.isInteger(value) && value >= 0) chooseStarHand({saidPage: value}) },
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
  const values: Record<string, ParamValue> = {...bodyValues(reading.body), ...field.values, view: reading.view, mounted: reading.mounted}
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
  const standing: Record<string, Standing> = {...field.standing}
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
  const writable = (key: string) => key === 'wholeField' ? !standing.wholeField : isStarAct(key) ? !!reading.field && !standing[key] : WORLD_BODY_KEYS.includes(key) && !refusal
  return {
    id: techneDeviceId(ATLAS_FAMILY, 'globe-engine'), values, standing, enabledKey: 'mounted',
    writes: writable,
    write: async (changes: readonly ValueChange[]) => {
      const body: Record<string, unknown> = {}
      for (const change of changes) {
        if (change.key === 'wholeField') await writeThroughOwner('shell.setAtlasWholeField', change.value)
        else if (isStarAct(change.key) && reading.field) await actAtStar(change.key, reading.field)
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
