// The Earth projection in the shell: one atlas instance, mounted into one pane.
//
// The host leg of T-ATLAS-HOST (DEVICE-SEMANTICS-LOCK §8.1, §8.4). The atlas is the ported Archetypal-Earth code and is
// mounted with mountAtlas; its own Earth ⇄ Graph switch is driven through its controller (toggleMode). Nothing of the
// atlas is reimplemented here. What the host adds: the corpus provider is registered from the World (the suite provider,
// provider/suiteProvider.ts: Central's owners, never an old corpus), the atlas's three memories are bound to the workspace's
// storage namespace, the pane says how many of the owners' subjects the Earth cannot place and which owner input did not answer
// (the suite standing), and the pane's
// lifecycle is the shell's: the atlas mounts on first view, pauses while concealed (the hidden-inhabitant law: the
// instance survives), and is destroyed with its pane — or moves to a held pane on screen while its own pane is concealed
// (the claim, below).
//
// The view (Earth or Graph) has no home in the spine: the spine holds no presentation (projectionModules.ts). It is held
// here as a mirror of the atlas controller's own mode, which the atlas writes to body[data-mode] (graph/switch.ts). The
// atlas owns the state; the Earth ⇄ Graph device and the plates' View read the mirror.

import {useEffect, useRef, useState, useSyncExternalStore} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useContinuity} from '../../continuity/workspace'
import {useWorkspace} from '../../shell/workspace'
import type {AionEpochJump} from './aionTimeline'
import type {History} from './src/types/history'
import type {AtlasHandle} from './mount'
import {createSunFollower, type SunFollower} from './sunFollow'
import {later} from './src/ui/lifetime'
import type {DatedSubsolarState, ShownInstant} from '../../inhabitants/qlSkyEarthAdapter'
import {disclosureSession} from '../../../../../../desktop/cradle/src/techne/session'
import {sunStanding} from '../../inhabitants/qlSkyEarthAdapter'
import {bindSharedTimeClock, windowYear} from './sharedClock'
import {SUITE_PROVIDER_ID, describeProgress, describeStanding, subscribeSuiteStanding, suiteStanding, type SuiteStanding} from './provider/suiteStanding'
import {bindPlaces, selectLocation, type PlacesBinding} from './places/placesHost'
import {notePlaceTool} from './places/placeTool'
import type {DreamJournalBinding} from './practice/dreamsHost'
import type {YourChartBinding} from './practice/chartsHost'
import {bindPalaces, type PalacesBinding} from './palaces/palacesHost'
import {bindWorldBody, chooseBody, kernelWorldBodyOwner} from './body/worldBody'
import {bindBodyDraw} from './system/bodyDraw'
import {followAnchor, pressLocation} from './system/bodyLocations'
import {enterWorld} from './system/enteredWorld'
import type {SystemOverlayBinding} from './system/systemOverlay'
import {bindSystemClock} from './system/systemClock'
import {watchPaneChrome} from './paneChrome'
import './atlasHost.css'

/** The year the Earth shows, from the shared window: null while no window is in force (all time). */
function shownYearNow(): number | null {
  const year = windowYear(disclosureSession.get()?.time_window ?? null)
  return year === null ? null : Math.round(year)
}

/** The globe's own gestures, in plain words (the stage carries no buttons; T-PLACES-ONTO-ATLAS). */
export const GLOBE_GESTURES = 'Drag to turn it (north stays up); wheel or pinch to come in; double-click to dive; G turns it to its graph. With Place armed on the M4 plate, a click is a point offered to its subject\'s editor.'

/** What the Earth says of itself, in the Info view's hover (the globe's `data-i`, "Earth|…") rather than over the globe (owner, 14 Oct:
 * nothing drawn in the pane as chrome; the lead's native pass at 11475cc3d saw the standing paragraph over the globe): the world's
 * standing — how many of the owners' subjects it does not draw, and every owner input that did not answer, in the owner's own words
 * (provider/suiteStanding.ts) — then the Sun's words, then its gestures. The M4 plate says the same (places/PlacesPlate.tsx). */
export interface EarthWords {
  standing(text: string | null): void
  sun(text: string | null): void
  /** the globe's whole `data-i`, as written last */
  readonly said: string
}

export function earthWords(globe: Pick<HTMLElement, 'setAttribute'>): EarthWords {
  let standing: string | null = null, sun: string | null = null, said = ''
  const write = () => {
    said = `Earth|${[standing, sun, GLOBE_GESTURES].filter((text): text is string => !!text).join(' ')}`
    globe.setAttribute('data-i', said)
  }
  write()
  return {
    standing(text) { standing = text || null; write() },
    sun(text) { sun = text; write() },
    get said() { return said },
  }
}

export type AtlasView = 'earth' | 'graph'

/** The standing of the world the Earth reads, as a hook: the pane's progress while the owners are read, and the Places browser's rows. */
export function useSuiteStanding(): SuiteStanding {
  return useSyncExternalStore(subscribeSuiteStanding, suiteStanding, suiteStanding)
}

// ── the Sun's reading: its keys, its status line ─────────────────────────

/** The present sky is read again once its ten-minute bucket has moved (a stale Sun is not shown as current for long). */
export const SUN_REREAD_MS = 10 * 60_000
/** How often the Earth offers the present instant to the follower; a read happens only when the bucket moved. */
export const SUN_REREAD_TICK_MS = 60_000
/** The reason the Sun's first read is pending: the field is mounted without it, and the follower makes the first read. */
export const NOT_READ_REASON = 'the Sun has not been read yet'
/** The key of the state drawn before the first read: no instant has that key, so the first offer is read. */
const NOT_READ_KEY = 'not-read'

/** The key of an instant the Sun is read for: the present sky by its ten-minute bucket, a dated year as itself. */
export function sunInstantKey(instant: ShownInstant): string {
  return instant.present ? `present:${Math.floor(instant.at.getTime() / SUN_REREAD_MS)}` : `year:${instant.year}`
}

const utcStamp = (at: Date): string => `${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`

/** The Sun's status line: what sunStanding states, and, for a present-sky reading, the instant it is read for and that it is
 * read again every ten minutes. Null when nothing needs saying (the Sun is drawn for the instant shown). */
export function sunStatusText(drawn: DatedSubsolarState, shownYear: number | null, pending: boolean): string | null {
  const standing = sunStanding(drawn, shownYear, pending)
  if (!drawn.instant.present || drawn.reason === NOT_READ_REASON) return standing
  const read = `The present sky is read for ${utcStamp(drawn.instant.at)}, and is read again every ten minutes.`
  return standing === null ? read : `${standing} ${read}`
}

// ── the view ──────────────────────────────────────────────────────────────

let desiredView: AtlasView = 'earth'
let viewAsked = false
const viewListeners = new Set<() => void>()
let reconcileFollowed: (() => void) | null = null

function mirrorView(next: AtlasView): void {
  if (next === desiredView) return
  desiredView = next
  for (const listener of viewListeners) listener()
}

function subscribeView(listener: () => void): () => void {
  viewListeners.add(listener)
  return () => { viewListeners.delete(listener) }
}

/** The view the centre atlas presents, read by the Earth ⇄ Graph device and the plates' View. */
export function useAtlasView(): AtlasView {
  return useSyncExternalStore(subscribeView, () => desiredView, () => desiredView)
}

/** A lens asks for a view. The mounted atlas follows once it is presented; before its first mount the request waits. */
export function presentAtlasView(view: AtlasView): void {
  viewAsked = true
  mirrorView(view)
  reconcileFollowed?.()
}

// ── the workspace scope: the atlas's memories, per workspace id ───────────

export interface AtlasHostScope {
  /** the workspace book's storage namespace (continuity: storageNamespace.key) */
  namespace: string
  /** the active workspace id */
  workspaceId: string
}

let scope: AtlasHostScope | null = null

export function bindAtlasScope(next: AtlasHostScope): void {
  scope = next
}

function localArea(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** The one Storage the atlas's memories are bound to: keys under the book's namespace, one set per workspace id. The
 * atlas never names a key or an area itself. With no workspace bound, nothing is read and a write is refused, so the
 * atlas's own probe finds no storage and says so, rather than keeping something nowhere. */
function workspaceStorage(): Storage {
  const prefix = (): string | null => (scope ? `${scope.namespace}.atlas.${scope.workspaceId}::` : null)
  const owned = (): string[] => {
    const p = prefix()
    const area = localArea()
    if (!p || !area) return []
    const keys: string[] = []
    for (let i = 0; i < area.length; i++) {
      const key = area.key(i)
      if (key?.startsWith(p)) keys.push(key)
    }
    return keys
  }
  const store: Storage = {
    get length() {
      return owned().length
    },
    key(index) {
      const p = prefix()
      const key = owned()[index]
      return p && key ? key.slice(p.length) : null
    },
    getItem(key) {
      const p = prefix()
      const area = localArea()
      if (!p || !area) return null
      try {
        return area.getItem(p + key)
      } catch {
        return null
      }
    },
    setItem(key, value) {
      const p = prefix()
      const area = localArea()
      if (!p || !area) throw Error('No workspace is bound for the Earth projection memory')
      area.setItem(p + key, value)
    },
    removeItem(key) {
      const p = prefix()
      const area = localArea()
      if (p && area) area.removeItem(p + key)
    },
    clear() {
      const area = localArea()
      for (const key of owned()) area?.removeItem(key)
    },
  }
  return store
}

const sharedStorage = workspaceStorage()

/** The dream journal the practice store's dreams are bound to (practice/dreamsHost.ts), one per attach. */
let practiceDreams: DreamJournalBinding | null = null
/** Your chart, the practice store's charts bound to your saved identity (practice/chartsHost.ts), one per attach. */
let practiceCharts: YourChartBinding | null = null

/** The atlas's memory Storage, as the host binds it (exported for the host tests). */
export function atlasMemoryStorage(): Storage {
  return sharedStorage
}

// ── the mounted atlas, for the shell's face bodies (inhabitants/atlasFaceBodies.tsx) ──────────

let mountedAtlas: AtlasHandle | null = null
const handleListeners = new Set<() => void>()

function subscribeHandle(listener: () => void): () => void {
  handleListeners.add(listener)
  return () => { handleListeners.delete(listener) }
}

/** Publish (or withdraw, null) the mounted atlas. Called by the attachment; exported for the host tests. */
export function publishAtlasHandle(next: AtlasHandle | null): void {
  mountedAtlas = next;
  for (const listener of handleListeners) listener();
}

/** The mounted atlas, as a plain read: null until it mounts, and again once its pane is destroyed. */
export function atlasHandle(): AtlasHandle | null {
  return mountedAtlas;
}

/** The mounted atlas, as a hook: the face bodies re-read it when it mounts or is withdrawn. */
export function useAtlasHandle(): AtlasHandle | null {
  return useSyncExternalStore(subscribeHandle, () => mountedAtlas, () => mountedAtlas);
}

// ── the attachment: one atlas in one element ──────────────────────────────

export interface AtlasAttachment {
  /** The named state of a pane that does not hold the atlas: another pane of this session has it open. Null when this pane
   * holds the atlas. The pane body says the same in words (heldBy). */
  readonly held: string | null
  setVisible(visible: boolean): void
  unmount(): void
}

/** What a pane is handed when its attachment changes: the atlas mounted into it once the claim frees or comes to it, the mount's own
 * refusal, or (a concealed holder whose claim went to a pane on screen) the held state it now waits in. */
export type AtlasHandover = {readonly attachment: AtlasAttachment} | {readonly error: unknown}

/** What a pane that is not the atlas's holder says, in its own body. One atlas stands in a session (ui/lifetime.ts). */
export const ATLAS_HELD_MESSAGE = 'The Earth atlas is open in another pane on screen. It is drawn once, in the pane that opened it first, and comes here when that pane is out of sight or closed.'

export interface AtlasAttachOptions {
  /** the pane body the atlas fills */
  element: HTMLElement
  /** the kernel transport the corpus provider reads through */
  transport: KernelTransportStatus
  /** the centre atlas follows the view the devices present; a projection-kind door holds its own fixed view */
  follow: boolean
  /** the fixed view when not following */
  view?: AtlasView
  /** A held pane waits for the claim to free, or to come to it (below). When it does, the pane mounts the atlas (one claim, one
   * owner); the other held panes stay held. Called with each change of the pane's attachment: the atlas handed to it (or the
   * mount's refusal), and, for a holder concealed while a held pane is on screen, the held state it now waits in. A pane that
   * passes none is never moved: it cannot be told. */
  onHandover?: (outcome: AtlasHandover) => void
}

/** The one atlas this session holds: claimed from the first attach until its pane is unmounted, and the atlas disposed.
 * A second pane that asks while the claim stands is given the held state (heldBy), not a second atlas: the atlas's memories,
 * its document marks and its view mirror are one set per session (named OPEN in the lane report).
 *
 * The Earth goes where the person is looking (r23, 19 Oct). Panes of other modes' layouts stay mounted while concealed
 * (desktop/cradle/src/surface/projectionPaneSession.ts), so the first pane to attach can be one nobody sees. When a held pane is
 * shown while the holder is concealed, the claim moves: the holder tears its atlas down through its own teardown, which hands the
 * claim to the pane on screen (first in line), and the concealed pane becomes a held pane that waits. A holder on screen keeps the
 * Earth; of two panes on screen, the one that opened it first holds it. */
let claimed = false

/** The settled holder: its pane's last concealment notice, its options (to tell it, and to make it wait), and its teardown. Null
 * while no atlas stands, and while the claimed atlas is still mounting (nothing moves until it stands). */
let holding: {visible: boolean; readonly options: AtlasAttachOptions; readonly teardown: () => void} | null = null

/** The held panes, in the order they asked, each with its pane's last concealment notice (not shown until told). */
const waiting: {readonly options: AtlasAttachOptions; visible: boolean}[] = []

/** Free the claim, and hand it to the first waiting pane on screen, else the first in line, which mounts the atlas (its attach
 * takes the claim before its first await, so the panes behind it keep waiting). */
function releaseClaim(): void {
  claimed = false
  holding = null
  const shown = waiting.findIndex(entry => entry.visible)
  const [first] = waiting.splice(shown >= 0 ? shown : 0, 1)
  if (!first) return
  attachAtlas(first.options).then(
    attachment => first.options.onHandover?.({attachment}),
    error => first.options.onHandover?.({error}),
  )
}

/** Move the claim to a held pane on screen when the holder is concealed. Both panes must be able to be told (onHandover). */
function followSight(): void {
  const holder = holding
  if (!holder || holder.visible || !holder.options.onHandover) return
  const at = waiting.findIndex(entry => entry.visible && entry.options.onHandover)
  if (at < 0) return
  waiting.unshift(...waiting.splice(at, 1))
  // the holder's own teardown disposes its atlas, empties its pane and releases the claim to the pane on screen, first in line
  holder.teardown()
  holder.options.onHandover({attachment: heldBy(holder.options, false)})
}

/** The pane that is not the holder: its body says the atlas is open elsewhere. Nothing is mounted and nothing is claimed; the
 * pane waits, and its attachment's unmount drops it from the waiting. Shown while the holder is concealed, it takes the claim. */
function heldBy(options: AtlasAttachOptions, visible = false): AtlasAttachment {
  const {element} = options
  element.replaceChildren()
  const line = document.createElement('p')
  line.className = 'atlas-host-status'
  line.setAttribute('role', 'status')
  line.textContent = ATLAS_HELD_MESSAGE
  element.append(line)
  const entry = {options, visible}
  waiting.push(entry)
  return {
    held: ATLAS_HELD_MESSAGE,
    setVisible: next => {
      entry.visible = next
      if (next && waiting.includes(entry)) followSight()
    },
    unmount: () => {
      const at = waiting.indexOf(entry)
      if (at >= 0) waiting.splice(at, 1)
    },
  }
}

/** Mount the atlas into the element. A pane that asks while another holds the atlas is told so in its body (held), and waits
 * for the claim. Throws with the atlas's own honest message when it cannot mount. */
export async function attachAtlas(options: AtlasAttachOptions): Promise<AtlasAttachment> {
  if (claimed) return heldBy(options)
  if (!scope) throw Error('No workspace is bound for the Earth projection, so its settings have nowhere to live.')
  claimed = true
  const progress: {teardown: (() => void) | null} = {teardown: null}
  try {
    return await attachClaimed(options, progress)
  } catch (error) {
    // A failure releases what the attach made: whatever it had made is torn down (its teardown releases the claim); a failure
    // before anything stood releases the claim here.
    if (progress.teardown) progress.teardown()
    else releaseClaim()
    throw error
  }
}

async function attachClaimed(options: AtlasAttachOptions, progress: {teardown: (() => void) | null}): Promise<AtlasAttachment> {
  const {element, transport, follow} = options
  const fixedView: AtlasView = options.view ?? 'earth'
  const target = (): AtlasView => (follow ? desiredView : fixedView)
  element.replaceChildren()
  const globe = document.createElement('div')
  globe.id = 'globe'
  globe.className = 'atlas-host-globe'
  // What the Earth says of itself stands in the Info view's hover, never over the globe (earthWords, above)
  const words = earthWords(globe)
  const app = document.createElement('div')
  app.id = 'app'
  app.className = 'atlas-host-app'
  element.append(globe, app)

  // Graph settings read their store at each call, so they follow this binding (the landing's flag is left unbound, below). The practice store is
  // not so: practice/store.ts builds its singleton, and probes storage, when that module first evaluates. The import of
  // it below precedes setPracticeStorage, so the singleton stays in memory for the session. A rebinding seam is needed
  // in the port (OPEN: T-ATLAS-HOST, practice persistence).
  const [settings, landing, practice] = await Promise.all([
    import('./src/graph/settings'),
    import('./src/shell/landing'),
    import('./src/practice/store'),
  ])
  settings.setGraphSettingsStore(sharedStorage)
  // The found app's onboarding never stands over the shell's world (T-PLACES-ONTO-ATLAS; the lead saw it over the globe at 11475cc3d):
  // unbound, the landing counts as seen — the O:I shell is its own front door (src/shell/landing.ts, the port's own adaptation note).
  landing.setLandingStore(null)
  // Your dreams are kept in your dream journal (practice/dreamsHost.ts; T-WORLDS W4): the store's dream collection is that Flow's
  // entries, read through their owner once the Earth has mounted (the mount never waits on it: a dream asked for before the read lands
  // is refused in words, never kept in the window); every other collection stays the workspace's store. The lens's Amplify lays Source
  // entries from the mounted field's model.
  practiceDreams?.dispose()
  const {bindDreamJournal, kernelDreamOwners} = await import('./practice/dreamsHost')
  practiceDreams = bindDreamJournal({base: sharedStorage, owners: kernelDreamOwners(transport, notePlaceTool), model: () => mountedAtlas?.model ?? null, deferred: true})
  // Your chart is your saved identity's (manual §24.6, practice/chartsHost.ts): the store's charts are QL's calculation of your identity,
  // read through its owner, and the Astrology lens keeps none of its own; its material is published with it, corpus-neutral.
  practiceCharts?.dispose()
  const {bindYourChart, kernelYourChart} = await import('./practice/chartsHost')
  const yourChart = bindYourChart({base: practiceDreams.storage, read: kernelYourChart(transport), said: notePlaceTool, deferred: true})
  practiceCharts = yourChart
  practice.setPracticeStorage(yourChart.storage)
  const [{registerCorpusProvider}, {suiteProvider}, {mountAtlas}] = await Promise.all([
    import('./provider/corpusProvider'),
    import('./provider/suiteProvider'),
    import('./mount'),
  ])
  // The world is read before the controller mounts, so an unavailable owner input fails while nothing is bound yet, named with
  // its owner's own detail (the suite provider reads Central's wiki, the shared field and AIKit, one input at a time).
  const provider = suiteProvider(transport)
  const loaded = await provider.load()
  // T6: the QL family's adapter admits the owner's stated subsolar point for the instant the Earth shows (the shared
  // window's year; the present while no window is in force), read through the kernel before the Earth stands. A read that
  // fails is stated as an absent Sun with its reason, never thrown into the mount.
  const {admitDatedSubsolar, shownInstantOf, withoutSubsolar, QL_SKY_FAMILY, QL_SKY_FAMILY_ID, SUBSOLAR_OCCURRENCE_ID} = await import('../../inhabitants/qlSkyEarthAdapter')
  const readSun = (instant: ShownInstant): Promise<DatedSubsolarState> => admitDatedSubsolar(loaded.field, transport, instant)
    .catch((error: unknown): DatedSubsolarState => ({
      field: withoutSubsolar(loaded.field),
      placed: false,
      reason: `the dated sky did not answer: ${error instanceof Error ? error.message : String(error)}`,
      instant,
    }))
  // The Earth stands on the field as loaded: the QL Sun is not awaited before the mount, since the kernel's dated read can
  // stall for its whole deadline and a stalled sky would leave the Earth blank. The follower below makes the first read
  // through the same seam; until it answers, the status line states the Sun as not yet read.
  const bundle = {...loaded, published: yourChart.published(loaded.published ?? null)}
  registerCorpusProvider({...provider, load: async () => bundle}, {asDefault: true})
  // T-ATLAS-TIME: the clock is a face of the shell's one shared time window (the session the native owner also writes).
  const mounted: AtlasHandle = await mountAtlas({globe, app, provider: SUITE_PROVIDER_ID,
    clock: (time, scale) => bindSharedTimeClock({store: disclosureSession, time, scale})})

  // Everything the attach makes from here is named before it is made, so the one teardown below releases whatever stands
  // when the attach fails part way (T-ATLAS-DISPOSE). Each is null or inert until it is made.
  let visible = true
  let retired = false
  let follower: SunFollower<ShownInstant> | null = null
  let unsubscribeSun: () => void = () => {}
  let cancelReread: () => void = () => {}
  let observer: MutationObserver | null = null
  let unsubscribeStanding: () => void = () => {}
  let unsubscribeView: () => void = () => {}
  let withdrawReading: () => void = () => {}
  let places: PlacesBinding | null = null
  let palaces: PalacesBinding | null = null
  let body: {dispose(): void} | null = null
  let bodyDraw: {dispose(): void} | null = null
  let system: SystemOverlayBinding | null = null
  let systemClock: {dispose(): void} | null = null
  let chrome: {dispose(): void} | null = null
  // The Sun's words stand in the Info view's hover and on the M4 plate's Sky section (T-PLACES-ONTO-ATLAS), the same words in both.
  const setSunLine = (text: string | null) => {
    words.sun(text)
    publishAtlasSun({placed: drawn.placed, line: text})
  }
  // The standing is said on the Earth, where an unlocated subject is not drawn, and is silent on the Graph, which draws every one.
  const paintStanding = () => words.standing(target() === 'earth' ? describeStanding(suiteStanding()) : null)
  const reconcile = () => {
    if (retired || !visible) return
    const current: AtlasView = mounted.ctl.state.graph ? 'graph' : 'earth'
    if (current !== target()) mounted.ctl.toggleMode()
  }
  const unmount = () => {
    if (retired) return
    retired = true
    // the Sun follower stops (its pending read is cancelled, and a late reply is dropped), and its status line goes
    unsubscribeSun()
    unsubscribeStanding()
    unsubscribeView()
    withdrawReading()
    places?.dispose()
    palaces?.dispose()
    body?.dispose()
    bodyDraw?.dispose()
    system?.dispose()
    systemClock?.dispose()
    chrome?.dispose()
    practiceDreams?.dispose()
    practiceCharts?.dispose()
    cancelReread()
    follower?.dispose()
    // the words directly: a teardown may run before the Sun's first state is made
    words.sun(null)
    words.standing(null)
    publishAtlasSun(null)
    publishAtlasAionReading(null)
    publishAtlasHandle(null)
    observer?.disconnect()
    if (reconcileFollowed === reconcile) reconcileFollowed = null
    // the atlas is disposed: its frames and GPU resources, every listener, timer and observer it installed, and its marks on
    // the body. The pane is emptied, and the claim is released, so the next pane that asks mounts a fresh atlas, or a waiting
    // pane takes it (the first on screen, else the first that asked).
    mounted.dispose()
    element.replaceChildren()
    releaseClaim()
  }
  progress.teardown = unmount
  publishAtlasHandle(mounted)
  // The pane holds the material alone (#762; manual §16.3, §17.11): the atlas's chrome stands down in it (atlasHost.css) and is read here
  // as the atlas redraws it — the focus label's acts, the graph's display and the Field's closes for the World, a non-Field lens's title
  // and controls for the Lens (paneChrome.ts); a change tells the faces, so the World's reading is taken again.
  chrome = watchPaneChrome(app, () => mounted.ctl.facesChanged?.())
  // The Earth has mounted on its own owners' reads: your dream journal is read now (practice/dreamsHost.ts).
  practiceDreams?.start()
  // Places is the atlas (T-PLACES-ONTO-ATLAS): the shared spatial focus turns it, the M4 plate reads its scale, and the Place tool
  // reads the point under a click and offers it to the owner's editor (places/placesHost.ts).
  places = bindPlaces({handle: mounted, transport, session: disclosureSession})
  // Palaces live in the atlas (T-PALACES-ONTO-ATLAS; FOUNDATION §3 N4): a palace is a place on the world you enter, drawn inside this pane
  // at the atlas's palace scale; its owners read and write through this transport, and its presence through the atlas's workspace memory
  // (palaces/palacesHost.ts).
  palaces = bindPalaces({element, transport, storage: atlasMemoryStorage})
  // Your world's body (T-WORLDS §5 W3): read from its owner (the root register's space, AIKit's `aikit.world-body/v1`), and the view's choice of
  // which body to look at (body/worldBody.ts); the Earth stays given. It reads and draws nothing: one drawer draws the globe's body, with the look
  // its world's readings give it and the weather of the shared occasion (system/bodyDraw.ts; T-PROCEDURAL-BODY §6 item 3).
  body = bindWorldBody({engine: {}, owner: kernelWorldBodyOwner(transport), changed: () => mounted.ctl.facesChanged?.()})
  bodyDraw = bindBodyDraw({engine: mounted.engine, store: disclosureSession})
  // Your system (T-WORLDS §5 W3 phase B): today's worlds as bodies in the System scale, each with the agents at work and what they have just
  // made on its rings, drawn over the sky from the readings the pane holds (system/SystemReadings.tsx); what an act there answers is said on
  // the M4 plate. The instant it is drawn for moves once a minute, under this atlas's lifetime, so what an agent made drifts off as it ages.
  systemClock = bindSystemClock()
  // (loaded with the atlas's own modules, as the mount is: the shell's import of the panel stays light)
  // A press on a location's mark selects the place or enters the landed world it stands for; one on an anchor line follows it to its place on Earth.
  void import('./system/systemOverlay').then(overlay => {
    if (retired) return
    system = overlay.bindSystemOverlay({
      handle: mounted, said: notePlaceTool,
      press: location => { const refusal = pressLocation(location, {select: place => selectLocation(disclosureSession, place), enter: enterWorld}); if (refusal) notePlaceTool(refusal) },
      follow: anchor => followAnchor(anchor, {chooseBody, flyTo: (lat, lon, dist) => mounted.engine.rig.flyTo(lat, lon, dist)}),
    })
  })

  // The Sun follows the instant the Earth shows (T-ATLAS-SUN). The window's instant is offered on each change; the Sun is
  // read for it once the window has been still (sunFollow.ts), and each reading replaces the one Sun in place through the
  // atlas's seam. The status line states the Sun for the instant actually drawn, and that it is read for the instant shown
  // while the window is behind it.
  let drawn: DatedSubsolarState = {field: loaded.field, placed: false, reason: NOT_READ_REASON, instant: shownInstantOf(shownYearNow(), new Date())}
  const sunFollower: SunFollower<ShownInstant> = createSunFollower<ShownInstant, DatedSubsolarState>({
    keyOf: sunInstantKey,
    drawnKey: NOT_READ_KEY,
    read: readSun,
    apply: (next) => {
      const occ = next.placed ? next.field.occurrences.find(item => item.id === SUBSOLAR_OCCURRENCE_ID) ?? null : null
      const family = next.field.families.find(item => item.id === QL_SKY_FAMILY_ID) ?? QL_SKY_FAMILY
      try {
        mounted.replaceOccurrence(occ, SUBSOLAR_OCCURRENCE_ID, occ ? family : undefined)
      } catch (error) {
        // the seam refuses by name and leaves the drawn Sun as it was: the line says the reading was not drawn
        const reason = error instanceof Error ? error.message : String(error)
        setSunLine(`The Sun could not be redrawn for ${next.instant.present ? 'the present sky' : `the year ${next.instant.year}`}: ${reason}.`)
        return
      }
      drawn = next
      setSunLine(sunStatusText(drawn, shownYearNow(), sunFollower.pending()))
    },
  })
  follower = sunFollower
  const stateSun = () => {
    const year = shownYearNow()
    sunFollower.offer(shownInstantOf(year, new Date()))
    setSunLine(sunStatusText(drawn, year, sunFollower.pending()))
  }
  stateSun()
  unsubscribeSun = disclosureSession.subscribe(stateSun)
  // Your Beings and Things join the Earth once read (T-WORLDS §4 W2; central/pageOccurrences.ts): the mount never waits on them, as it
  // never waits on the Sun. Each is appended through the occurrence seam. The seam takes away only its last occurrence, and the Sun is
  // taken away when it is not placed, so a Sun already drawn steps off the tail while the pages join and is put back after them.
  void import('../../central/pageOccurrences')
    .then(({yourPagesForEarth}) => yourPagesForEarth(transport, mounted.model.field.meta.yearMax ?? new Date().getUTCFullYear(), notePlaceTool))
    .then(async pages => {
      if (retired) return
      const {joinPagesToEarth} = await import('../../central/pageOccurrences')
      joinPagesToEarth(mounted, pages, SUBSOLAR_OCCURRENCE_ID, notePlaceTool)
    })
    .catch((error: unknown) => notePlaceTool(`Your Beings and Things did not join the Earth: ${error instanceof Error ? error.message : String(error)}.`))
  // The present sky is offered again each minute: the follower reads it only when its ten-minute bucket has moved, so a
  // Sun read long ago does not stand as the current sky (T-ATLAS-SUN, the present sky)
  const reread = () => {
    stateSun()
    cancelReread = later(reread, SUN_REREAD_TICK_MS)
  }
  cancelReread = later(reread, SUN_REREAD_TICK_MS)
  // The reading the atlas holds is the World's Aion source, by reference, from the moment it stands.
  publishAtlasAionReading(bundle.history ? {providerId: SUITE_PROVIDER_ID, history: bundle.history} : null)
  unsubscribeStanding = subscribeSuiteStanding(paintStanding)
  unsubscribeView = subscribeView(paintStanding)
  // A page launched as Reading (central/launchOpening.ts) opens its occurrence's reading here: the manifestation of the occurrence
  // whose subject is the page, in its family, read deep (the atlas's own handle, mount.ts openReading).
  // As Walk, its family's walk from its own stop (mount.ts openWalk).
  void import('../../central/earthReading').then(({registerEarthReading, registerEarthWalk}) => {
    if (retired) return
    const reading = registerEarthReading(subjectRef => mounted.openReading(subjectRef)
      ? {ok: true} : {ok: false, why: 'the Earth holds no occurrence of this page yet'})
    const walk = registerEarthWalk(subjectRef => mounted.openWalk(subjectRef))
    withdrawReading = () => { reading(); walk() }
  })
  paintStanding()

  if (follow) {
    // A view asked before the atlas stood is honoured; otherwise the atlas's own state is adopted.
    if (!viewAsked) mirrorView(mounted.ctl.state.graph ? 'graph' : 'earth')
    viewAsked = false
    reconcileFollowed = reconcile
    observer = new MutationObserver(() => mirrorView(mounted.ctl.state.graph ? 'graph' : 'earth'))
    observer.observe(document.body, {attributes: true, attributeFilter: ['data-mode']})
  }
  reconcile()

  // The atlas stands: from here a held pane on screen can take the claim while this pane is concealed (followSight).
  const holder = {visible, options, teardown: unmount}
  holding = holder
  const setVisible = (next: boolean) => {
    if (retired) return
    visible = next
    holder.visible = next
    // the globe is not seen while concealed, and the graph is the view while the graph is on
    mounted.engine.setPaused(!next || !!mounted.ctl.state.graph)
    if (next) reconcile()
    else followSight()
  }
  return {held: null, setVisible, unmount}
}

// ── the Sun, as the M4 plate's Sky section reads it (T-PLACES-ONTO-ATLAS) ──

/** The Sun the Earth draws: whether the QL owner's stated point is placed, and the pane's own words about it (null when the Sun is
 * drawn for the instant shown and nothing needs saying). Null while no atlas stands. */
export interface AtlasSunReading {
  readonly placed: boolean
  readonly line: string | null
}

let sunReading: AtlasSunReading | null = null
const sunListeners = new Set<() => void>()

/** Publish (or withdraw, null) the Sun's reading. Called by the attach; exported for the host tests. */
export function publishAtlasSun(next: AtlasSunReading | null): void {
  if (next === sunReading || (next && sunReading && next.placed === sunReading.placed && next.line === sunReading.line)) return
  sunReading = next
  for (const listener of [...sunListeners]) listener()
}

export function atlasSun(): AtlasSunReading | null {
  return sunReading
}

export function useAtlasSun(): AtlasSunReading | null {
  return useSyncExternalStore(listener => { sunListeners.add(listener); return () => { sunListeners.delete(listener) } }, atlasSun, atlasSun)
}

// ── the Aion reading and the epoch jump (T-TIMELINE-WALKS leg 3) ──────────

/** The Aion history the mounted atlas holds. The World's Aion walks read it by reference through the family door; a
 * copy is never made. Null until the atlas has mounted, and again once its pane is destroyed (honest absence). */
export interface AtlasAionReading {
  providerId: string
  history: History
}

let aionReading: AtlasAionReading | null = null
const aionListeners = new Set<() => void>()

/** Publish (or withdraw, null) the reading the atlas mounted with. Called by the attachment; exported for the host tests. */
export function publishAtlasAionReading(next: AtlasAionReading | null): void {
  aionReading = next
  for (const listener of aionListeners) listener()
}

function subscribeAionReading(listener: () => void): () => void {
  aionListeners.add(listener)
  return () => { aionListeners.delete(listener) }
}

/** The Aion reading the mounted atlas holds, as a plain read (the World's hook subscribes through useAtlasAionReading). */
export function atlasAionReading(): AtlasAionReading | null {
  return aionReading
}

/** The Aion reading the mounted atlas holds, read by the World's temporal hook. */
export function useAtlasAionReading(): AtlasAionReading | null {
  return useSyncExternalStore(subscribeAionReading, () => aionReading, () => aionReading)
}

/** The encounter bridge's epoch jump for a stop of an atlas reading (a Timeline or Journey stop: the layer is the
 * reading, the stop id is the event). The atlas owns its camera: this writes the atlas's own linkable state, the
 * `#/aion/<reading>/epoch/<epoch>` grammar aionEpochJump names, and the atlas's hashchange listener moves its view. The
 * shell reads nothing back. Resolves to the jump, or null when the atlas holds no such event. */
export async function jumpAtlasToLayerStop(layerId: string, eventId: string): Promise<AionEpochJump | null> {
  const held = aionReading
  if (!held) return null
  const reading = held.history.readings.find((r) => r.id === layerId)
  const event = reading?.events.find((e) => e.id === eventId)
  const epoch = reading && event ? reading.epochs.find((e) => e.id === event.epochId) : undefined
  if (!reading || !epoch) return null
  const { aionEpochJump } = await import('./aionTimeline')
  const jump = aionEpochJump(reading, epoch, held.providerId)
  if (typeof location !== 'undefined' && location.hash !== jump.hash) location.hash = jump.hash
  return jump
}

// ── the centre pane ───────────────────────────────────────────────────────

/** The Earth centre panel: mounts the atlas on first view, then keeps it through concealment. */
export function AtlasEarthPane() {
  const {transport} = useWorkspace()
  const continuity = useContinuity()
  const namespace = continuity.storageNamespace.key
  const workspaceId = continuity.current.id
  const wrapper = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const attachment = useRef<AtlasAttachment | null>(null)
  const wantVisible = useRef(false)
  const started = useRef(false)
  const transportRef = useRef(transport)
  transportRef.current = transport
  const [phase, setPhase] = useState<{state: 'waiting' | 'reading' | 'ready' | 'failed' | 'held'; message?: string}>({state: 'waiting'})

  useEffect(() => {
    bindAtlasScope({namespace, workspaceId})
  }, [namespace, workspaceId])

  useEffect(() => {
    const element = wrapper.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    let alive = true
    // The pane's attachment, however it was given: a held pane's is replaced when the atlas is handed to it (onHandover).
    const adopt = (next: AtlasAttachment) => {
      if (!alive) {
        next.unmount()
        return
      }
      attachment.current?.unmount()
      attachment.current = next
      next.setVisible(wantVisible.current)
      // a pane that does not hold the atlas says so in its body (heldBy); the pane's phase names it too
      setPhase({state: next.held ? 'held' : 'ready'})
    }
    const fail = (error: unknown) => {
      if (alive) setPhase({state: 'failed', message: error instanceof Error ? error.message : String(error)})
    }
    const attach = () => {
      attachAtlas({
        element: body.current!,
        transport: transportRef.current,
        follow: true,
        onHandover: outcome => ('error' in outcome ? fail(outcome.error) : adopt(outcome.attachment)),
      }).then(adopt, fail)
    }
    const start = () => {
      if (started.current) return
      started.current = true
      setPhase({state: 'reading'})
      attach()
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        wantVisible.current = entry.isIntersecting
        if (entry.isIntersecting) start()
        attachment.current?.setVisible(entry.isIntersecting)
      }
    })
    observer.observe(element)
    return () => {
      alive = false
      observer.disconnect()
      attachment.current?.unmount()
      attachment.current = null
    }
  }, [])

  const standing = useSuiteStanding()
  const text = phase.state === 'failed'
    ? `The Earth could not mount: ${phase.message ?? 'unknown error'}`
    : phase.state === 'reading' ? (standing.phase === 'reading' ? describeProgress(standing) : 'Reading your world…') : null
  return (
    <div ref={wrapper} className="atlas-host" data-atlas-phase={phase.state} data-projection-kind="projection.earth">
      <div ref={body} className="atlas-host-body" />
      {text && <p role={phase.state === 'failed' ? 'alert' : 'status'} className="atlas-host-status">{text}</p>}
    </div>
  )
}
