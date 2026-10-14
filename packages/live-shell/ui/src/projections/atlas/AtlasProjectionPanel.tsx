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
import type {DatedSubsolarState, ShownInstant} from '../../inhabitants/qlSkyEarthAdapter'
import {disclosureSession} from '../../../../../../desktop/cradle/src/techne/session'
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
  setVisible(visible: boolean): void
  unmount(): void
}

export interface AtlasAttachOptions {
  /** the pane body the atlas fills */
  element: HTMLElement
  /** the kernel transport the corpus provider reads through */
  transport: KernelTransportStatus
  /** the centre atlas follows the view the lens bar presents; a projection-kind door holds its own fixed view */
  follow: boolean
  /** the fixed view when not following */
  view?: AtlasView
}

/** The ported controller binds window and document listeners that its unmount does not retire (mount.ts, destroy). A
 * second instance would therefore stack on the first, so the atlas is mounted once per session, and a retired one is
 * not mounted again. */
let claimed = false

/** Mount the atlas into the element. Throws with the atlas's own honest message when it cannot mount. */
export async function attachAtlas(options: AtlasAttachOptions): Promise<AtlasAttachment> {
  if (claimed) throw Error('The Earth projection is already mounted in this session. Its controller keeps window listeners that cannot be retired, so it is not mounted again.')
  if (!scope) throw Error('No workspace is bound for the Earth projection, so its settings have nowhere to live.')
  claimed = true
  const progress = {controllerStarted: false}
  try {
    return await attachClaimed(options, progress)
  } catch (error) {
    // Everything before the controller mounts binds no window listener, so a failure there (an unlisted corpus, a
    // transient read) releases the claim and a later attempt may mount. Once mountAtlas has begun — including any failure
    // after it returned — its listeners may be bound, so the claim is kept.
    if (!progress.controllerStarted) claimed = false
    throw error
  }
}

async function attachClaimed(options: AtlasAttachOptions, progress: {controllerStarted: boolean}): Promise<AtlasAttachment> {
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
  const {admitDatedSubsolar, shownInstantOf, sunStanding, withoutSubsolar, QL_SKY_FAMILY, QL_SKY_FAMILY_ID, SUBSOLAR_OCCURRENCE_ID} = await import('../../inhabitants/qlSkyEarthAdapter')
  const readSun = (instant: ShownInstant): Promise<DatedSubsolarState> => admitDatedSubsolar(loaded.field, transport, instant)
    .catch((error: unknown): DatedSubsolarState => ({
      field: withoutSubsolar(loaded.field),
      placed: false,
      reason: `the dated sky did not answer: ${error instanceof Error ? error.message : String(error)}`,
      instant,
    }))
  const sun = await readSun(shownInstantOf(shownYearNow(), new Date()))
  const bundle = {...loaded, field: sun.field}
  registerCorpusProvider({...provider, load: async () => bundle}, {asDefault: true})
  progress.controllerStarted = true
  // T-ATLAS-TIME: the clock is a face of the shell's one shared time window (the session the native owner also writes).
  const mounted: AtlasHandle = await mountAtlas({globe, app, provider: ARCHETYPAL_EARTH_PROVIDER_ID,
    clock: (time, scale) => bindSharedTimeClock({store: disclosureSession, time, scale})})
  publishAtlasHandle(mounted)
  // The Sun follows the instant the Earth shows (T-ATLAS-SUN). The window's instant is offered on each change; the Sun is
  // read for it once the window has been still (sunFollow.ts), and each reading replaces the one Sun in place through the
  // atlas's seam. The status line states the Sun for the instant actually drawn, and that it is read for the instant shown
  // while the window is behind it.
  const setSunLine = sunLine(element)
  const instantKey = (instant: ShownInstant): string => (instant.present ? 'present' : `year:${instant.year}`)
  let drawn: DatedSubsolarState = sun
  const follower: SunFollower<ShownInstant> = createSunFollower<ShownInstant, DatedSubsolarState>({
    keyOf: instantKey,
    drawnKey: instantKey(sun.instant),
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
      setSunLine(sunStanding(drawn, shownYearNow(), follower.pending()))
    },
  })
  const stateSun = () => {
    const year = shownYearNow()
    follower.offer(shownInstantOf(year, new Date()))
    setSunLine(sunStanding(drawn, year, follower.pending()))
  }
  stateSun()
  const unsubscribeSun = disclosureSession.subscribe(stateSun)
  // The reading the atlas holds is the World's Aion source, by reference, from the moment it stands.
  publishAtlasAionReading(bundle.history ? {providerId: ARCHETYPAL_EARTH_PROVIDER_ID, history: bundle.history} : null)

  let visible = true
  let retired = false
  const reconcile = () => {
    if (retired || !visible) return
    const current: AtlasView = mounted.ctl.state.graph ? 'graph' : 'earth'
    if (current !== target()) mounted.ctl.toggleMode()
  }
  let observer: MutationObserver | null = null
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
  const unmount = () => {
    if (retired) return
    retired = true
    unsubscribeSun()
    follower.dispose()
    setSunLine(null)
    publishAtlasAionReading(null)
    publishAtlasHandle(null)
    observer?.disconnect()
    if (reconcileFollowed === reconcile) reconcileFollowed = null
    mounted.engine.setPaused(true)
    mounted.destroy()
  }
  return {setVisible, unmount}
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
  const [phase, setPhase] = useState<{state: 'waiting' | 'reading' | 'ready' | 'failed'; message?: string}>({state: 'waiting'})

  useEffect(() => {
    bindAtlasScope({namespace, workspaceId})
  }, [namespace, workspaceId])

  useEffect(() => {
    const element = wrapper.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    let alive = true
    const start = () => {
      if (started.current) return
      started.current = true
      setPhase({state: 'reading'})
      attachAtlas({element: body.current!, transport: transportRef.current, follow: true})
        .then(next => {
          if (!alive) {
            next.unmount()
            return
          }
          attachment.current = next
          next.setVisible(wantVisible.current)
          setPhase({state: 'ready'})
        })
        .catch((error: unknown) => {
          if (alive) setPhase({state: 'failed', message: error instanceof Error ? error.message : String(error)})
        })
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
