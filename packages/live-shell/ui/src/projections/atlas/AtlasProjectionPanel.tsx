// The Earth projection in the shell: one atlas instance, mounted into one pane.
//
// The host leg of T-ATLAS-HOST (DEVICE-SEMANTICS-LOCK §8.1, §8.4). The atlas is the ported Archetypal-Earth code and is
// mounted with mountAtlas; its own Earth ⇄ Graph switch is driven through its controller (toggleMode). Nothing of the
// atlas is reimplemented here. What the host adds: the corpus provider is registered from the World
// (archetypalEarthProvider), the atlas's three memories are bound to the workspace's storage namespace, and the pane's
// lifecycle is the shell's: the atlas mounts on first view, pauses while concealed (the hidden-inhabitant law: the
// instance survives), and is destroyed with its pane.
//
// The view (Earth or Graph) has no home in the spine: the spine holds no presentation (projectionModules.ts). It is held
// here as a mirror of the atlas controller's own mode, which the atlas writes to body[data-mode] (graph/switch.ts). The
// atlas owns the state; the lens bar reads the mirror.

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
import './atlasHost.css'

/** The year the Earth shows, from the shared window: null while no window is in force (all time). */
function shownYearNow(): number | null {
  const year = windowYear(disclosureSession.get()?.time_window ?? null)
  return year === null ? null : Math.round(year)
}

/** The Earth's own status line for the Sun: the existing `atlas-host-status` surface, one element per attachment. */
function sunLine(element: HTMLElement): (text: string | null) => void {
  let line: HTMLParagraphElement | null = null
  return text => {
    if (text === null) {
      line?.remove()
      line = null
      return
    }
    if (!line) {
      line = document.createElement('p')
      line.className = 'atlas-host-status'
      line.setAttribute('role', 'status')
      element.append(line)
    }
    line.textContent = text
  }
}

export type AtlasView = 'earth' | 'graph'

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

/** The view the centre atlas presents, read by the lens bar. */
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

/** What a held pane is handed when the claim frees: the atlas mounted into it, or the mount's own refusal. */
export type AtlasHandover = {readonly attachment: AtlasAttachment} | {readonly error: unknown}

/** What a pane that is not the atlas's holder says, in its own body. One atlas stands in a session (ui/lifetime.ts). */
export const ATLAS_HELD_MESSAGE = 'The Earth atlas is already open in another pane of this session. It is drawn once, in the pane that opened it first.'

export interface AtlasAttachOptions {
  /** the pane body the atlas fills */
  element: HTMLElement
  /** the kernel transport the corpus provider reads through */
  transport: KernelTransportStatus
  /** the centre atlas follows the view the lens bar presents; a projection-kind door holds its own fixed view */
  follow: boolean
  /** the fixed view when not following */
  view?: AtlasView
  /** A held pane waits for the claim to free. When it does, the first pane that asked mounts the atlas (one claim, one
   * owner); the other held panes stay held. Called once, with the handover's outcome, for the pane that mounts. */
  onHandover?: (outcome: AtlasHandover) => void
}

/** The one atlas this session holds: claimed from the first attach until its pane is unmounted, and the atlas disposed.
 * A second pane that asks while the claim stands is given the held state (heldBy), not a second atlas: the atlas's memories,
 * its document marks and its view mirror are one set per session (named OPEN in the lane report). */
let claimed = false

/** The held panes, in the order they asked. Released in that order: the first one mounts when the claim frees. */
const waiting: {readonly options: AtlasAttachOptions}[] = []

/** Free the claim, and hand it to the first waiting pane, which mounts the atlas (its attach takes the claim before its first
 * await, so the panes behind it keep waiting). */
function releaseClaim(): void {
  claimed = false
  const first = waiting.shift()
  if (!first) return
  attachAtlas(first.options).then(
    attachment => first.options.onHandover?.({attachment}),
    error => first.options.onHandover?.({error}),
  )
}

/** The pane that is not the holder: its body says the atlas is open elsewhere. Nothing is mounted and nothing is claimed; the
 * pane waits, and its attachment's unmount drops it from the waiting. */
function heldBy(options: AtlasAttachOptions): AtlasAttachment {
  const {element} = options
  element.replaceChildren()
  const line = document.createElement('p')
  line.className = 'atlas-host-status'
  line.setAttribute('role', 'status')
  line.textContent = ATLAS_HELD_MESSAGE
  element.append(line)
  const entry = {options}
  waiting.push(entry)
  return {
    held: ATLAS_HELD_MESSAGE,
    setVisible: () => {},
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
  const app = document.createElement('div')
  app.id = 'app'
  app.className = 'atlas-host-app'
  element.append(globe, app)

  // Graph settings and the landing flag read their store at each call, so they follow this binding. The practice store is
  // not so: practice/store.ts builds its singleton, and probes storage, when that module first evaluates. The import of
  // it below precedes setPracticeStorage, so the singleton stays in memory for the session. A rebinding seam is needed
  // in the port (OPEN: T-ATLAS-HOST, practice persistence).
  const [settings, landing, practice] = await Promise.all([
    import('./src/graph/settings'),
    import('./src/shell/landing'),
    import('./src/practice/store'),
  ])
  settings.setGraphSettingsStore(sharedStorage)
  landing.setLandingStore(sharedStorage)
  practice.setPracticeStorage(sharedStorage)
  const [{registerCorpusProvider}, {archetypalEarthProvider, ARCHETYPAL_EARTH_PROVIDER_ID}, {mountAtlas}] = await Promise.all([
    import('./provider/corpusProvider'),
    import('./provider/archetypalEarthProvider'),
    import('./mount'),
  ])
  // The corpus is read before the controller mounts, so an unavailable bundle fails while nothing is bound yet.
  const provider = archetypalEarthProvider(transport)
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
  const bundle = loaded
  registerCorpusProvider({...provider, load: async () => bundle}, {asDefault: true})
  // T-ATLAS-TIME: the clock is a face of the shell's one shared time window (the session the native owner also writes).
  const mounted: AtlasHandle = await mountAtlas({globe, app, provider: ARCHETYPAL_EARTH_PROVIDER_ID,
    clock: (time, scale) => bindSharedTimeClock({store: disclosureSession, time, scale})})

  // Everything the attach makes from here is named before it is made, so the one teardown below releases whatever stands
  // when the attach fails part way (T-ATLAS-DISPOSE). Each is null or inert until it is made.
  let visible = true
  let retired = false
  let follower: SunFollower<ShownInstant> | null = null
  let unsubscribeSun: () => void = () => {}
  let cancelReread: () => void = () => {}
  let observer: MutationObserver | null = null
  const setSunLine = sunLine(element)
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
    cancelReread()
    follower?.dispose()
    setSunLine(null)
    publishAtlasAionReading(null)
    publishAtlasHandle(null)
    observer?.disconnect()
    if (reconcileFollowed === reconcile) reconcileFollowed = null
    // the atlas is disposed: its frames and GPU resources, every listener, timer and observer it installed, and its marks on
    // the body. The pane is emptied, and the claim is released, so the next pane that asks mounts a fresh atlas, or the first
    // waiting pane takes it.
    mounted.dispose()
    element.replaceChildren()
    releaseClaim()
  }
  progress.teardown = unmount
  publishAtlasHandle(mounted)

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
  // The present sky is offered again each minute: the follower reads it only when its ten-minute bucket has moved, so a
  // Sun read long ago does not stand as the current sky (T-ATLAS-SUN, the present sky)
  const reread = () => {
    stateSun()
    cancelReread = later(reread, SUN_REREAD_TICK_MS)
  }
  cancelReread = later(reread, SUN_REREAD_TICK_MS)
  // The reading the atlas holds is the World's Aion source, by reference, from the moment it stands.
  publishAtlasAionReading(bundle.history ? {providerId: ARCHETYPAL_EARTH_PROVIDER_ID, history: bundle.history} : null)

  if (follow) {
    // A view asked before the atlas stood is honoured; otherwise the atlas's own state is adopted.
    if (!viewAsked) mirrorView(mounted.ctl.state.graph ? 'graph' : 'earth')
    viewAsked = false
    reconcileFollowed = reconcile
    observer = new MutationObserver(() => mirrorView(mounted.ctl.state.graph ? 'graph' : 'earth'))
    observer.observe(document.body, {attributes: true, attributeFilter: ['data-mode']})
  }
  reconcile()

  const setVisible = (next: boolean) => {
    if (retired) return
    visible = next
    // the globe is not seen while concealed, and the graph is the view while the graph is on
    mounted.engine.setPaused(!next || !!mounted.ctl.state.graph)
    if (next) reconcile()
  }
  return {held: null, setVisible, unmount}
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

  const text = phase.state === 'failed'
    ? `The Earth could not mount: ${phase.message ?? 'unknown error'}`
    : phase.state === 'reading' ? 'Reading the field…' : null
  return (
    <div ref={wrapper} className="atlas-host" data-atlas-phase={phase.state} data-projection-kind="projection.earth">
      <div ref={body} className="atlas-host-body" />
      {text && <p role={phase.state === 'failed' ? 'alert' : 'status'} className="atlas-host-status">{text}</p>}
    </div>
  )
}
