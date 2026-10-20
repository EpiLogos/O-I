// The atlas family's four faces as devices of the runtime (T-DEVICES-TECHNE; lock §0.1.3: the Technē 0 instrument, the Earth and
// solar system with its graph view, carries its full native controls on the Device side). Each device is read from the ONE
// mounted atlas (projections/atlas/AtlasProjectionPanel.tsx `atlasHandle`) and the lens bar's view mirror, and written through the
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
import {systemReading} from '../../../projections/atlas/system/systemStore'
import {yourLocations, type BodyLocation} from '../../../projections/atlas/system/bodyLocations'
import {PLACE_KINDS, choosePlaceKind, placeKindChoice, type PlaceKind} from '../../../projections/atlas/places/placeTool'

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
}

/** Read the mounted atlas (null while none stands) and the view the lens bar presents. */
export function atlasReading(handle: AtlasHandle | null, view: AtlasView): AtlasReading {
  const body = {state: worldBodyState(), choice: bodyChoice()}
  const standing = suiteStanding(), system = systemReading()
  const locations = yourLocations(body.state, standing.places, standing.phase === 'ready', system.state === 'read' ? system.bodies : null)
  const placeKind = placeKindChoice()
  const own = system.state === 'read' ? system.bodies.find(item => item.yours) : undefined
  const look = own ? {look: own.look} : {}
  if (!handle) return {mounted: false, view, graph: null, clock: null, globe: null, body, locations, placeKind, ...look}
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
    body, locations, placeKind, ...look,
  }
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
  const values: Record<string, ParamValue> = {...bodyValues(reading.body), view: reading.view, mounted: reading.mounted}
  if (reading.globe) {
    values.scope = reading.globe.scopeLabel ?? ''
    if (reading.globe.scopeLabel != null) values.wholeField = reading.globe.wholeField
  }
  const refusal = bodyRefusal(reading)
  const standing: Record<string, Standing> = {}
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
  if (reading.body.choice === 'earth') standing.locations = {disabled: EARTH_LOCATIONS}
  else if (reading.body.choice === 'other') standing.locations = {disabled: NO_OTHER}
  else if ('unread' in reading.locations) standing.locations = {disabled: reading.locations.unread}
  else values.locations = JSON.stringify(reading.locations.rows)
  if (!reading.mounted) standing.placeKind = {disabled: NOT_MOUNTED}
  if (refusal) for (const key of WORLD_BODY_KEYS) standing[key] = {disabled: refusal}
  if (!reading.mounted) standing.body = {disabled: NOT_MOUNTED}
  if (!reading.mounted) standing.wholeField = {disabled: NOT_MOUNTED}
  else if (reading.globe?.scopeLabel == null) standing.wholeField = {disabled: NO_SCOPE}
  const writable = (key: string) => key === 'wholeField' ? !standing.wholeField : WORLD_BODY_KEYS.includes(key) && !refusal
  return {
    id: techneDeviceId(ATLAS_FAMILY, 'globe-engine'), values, standing, enabledKey: 'mounted',
    writes: writable,
    write: async (changes: readonly ValueChange[]) => {
      const body: Record<string, unknown> = {}
      for (const change of changes) {
        if (change.key === 'wholeField') await writeThroughOwner('shell.setAtlasWholeField', change.value)
        else if (WORLD_BODY_KEYS.includes(change.key)) body[change.key] = change.value
        else throw Error(`${change.key} is not written from the World's own controls`)
      }
      // every body change of one gesture is one BodySet: the owner sees the whole body once, at the revision it was read at
      if (Object.keys(body).length) await writeThroughOwner('shell.setWorldBody', body)
    },
    local: {
      body: value => { if (value === 'own' || value === 'earth' || value === 'other') chooseBody(value) },
      placeKind: value => { if ((PLACE_KINDS as readonly unknown[]).includes(value)) choosePlaceKind(value as PlaceKind) },
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
