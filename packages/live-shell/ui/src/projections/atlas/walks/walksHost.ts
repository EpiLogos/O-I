// What the atlas binds for the World's walk while it stands (O-I #760). Called once by the attach (AtlasProjectionPanel.tsx), released with it,
// beside the Places and palace bindings (places/placesHost.ts, palaces/palacesHost.ts) — the same seam, the same lifetime.
//
// - The walk's owner: the kernel's `expression` op over the attach's transport (the op the M0 instrument opens a register's Expression
//   through, techne/wikiNativeExpression.ts `expression`), answered or refused in the owner's words.
// - The World as the walk reads and moves it: the camera (globe/controls.ts CameraRig lat, lon, dist; none in the sky or the graph, which
//   frame no body), the place it stands on (the last place visited while the camera has not left it), the shared window
//   (techne/session.ts, written through sharedClock.ts writeSharedWindow), and a stop stood: the World turns to its place where the world
//   holds it (places/placesHost.ts turnAtlasTo, the one door), else flies to its camera (flyAtlasTo).
// - The atlas's own visits: a subject's occurrence the atlas opens (its manifest view, a click on the globe) is a place you visit, named by
//   the world's place there when it holds one (placesHost.ts turnToPlace's own match: the subject, at the same point).
// - The world the walk belongs to: the book's world (setWalkWorld, from the pane), read at each act; a change of world reads that world's walk.
// It adds no chrome to the pane: the walk's controls are the transport's, and its takes and views lie on Technē's ruler.

import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {ExpressionRequest} from '../../../../../../../desktop/cradle/src/expression/types'
import {kernelOp} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import type {AtlasHandle} from '../mount'
import {suitePlaces} from '../provider/suiteStanding'
import {flyAtlasTo, framingDistance, turnAtlasTo} from '../places/placesHost'
import {writeSharedWindow} from '../sharedClock'
import {lastWalkVisit, noteWalkVisit, walkSession, type WalkOwners, type WalkSession, type WalkWorld} from './walkSession'
import type {AtlasCamera} from './walkRecord'

/** The owner of the walk: the kernel's `expression` op. */
export function kernelWalkOwners(transport: KernelTransportStatus): WalkOwners {
  return {
    async expression(request: ExpressionRequest) {
      const call = await kernelOp(transport, {op: 'expression', request})
      if (call.error) throw Error(call.error)
      if (call.outcome?.result !== 'expression') throw Error('The Expression owner returned no Expression answer.')
      return call.outcome.data
    },
  }
}

// ── the world the walk belongs to ─────────────────────────────────────────

const WORLD_TITLES: Readonly<Record<string, string>> = {central: 'Central', 'epi-logos': 'Epi-Logos'}
let worldKey = 'central'
const worldListeners = new Set<() => void>()

/** The book's world (the pane keeps it current): the walk read and written is that world's. */
export function setWalkWorld(key: string | undefined): void {
  const next = key || 'central'
  if (next === worldKey) return
  worldKey = next
  for (const listener of [...worldListeners]) listener()
}

/** How near the camera must stand to a place for the World to stand on it, in degrees. */
const STANDS_ON_DEG = 0.5
const near = (a: AtlasCamera, b: AtlasCamera): boolean => Math.abs(a.lat - b.lat) <= STANDS_ON_DEG && Math.abs(((a.lon - b.lon + 540) % 360) - 180) <= STANDS_ON_DEG

/** The World over the mounted atlas, as the walk reads and moves it. */
export function atlasWalkWorld(handle: AtlasHandle): WalkWorld {
  return {
    get key() { return worldKey },
    get title() { return WORLD_TITLES[worldKey] ?? worldKey },
    here() {
      if (handle.ctl.state.sky || handle.ctl.state.graph) return null
      const {lat, lon, dist} = handle.engine.rig
      const camera = {lat, lon, dist}
      const visit = lastWalkVisit()
      return {camera, place: visit && near(visit.camera, camera) ? {ref: visit.placeRef, name: visit.name} : null}
    },
    window() {
      const window = disclosureSession.get()?.time_window
      return window ? {from: window.from ?? null, to: window.to ?? null} : null
    },
    go(target, ms) {
      const place = target.placeRef ? suitePlaces().find(row => row.ref === target.placeRef) : undefined
      if (place && turnAtlasTo(handle, place)) return
      flyAtlasTo(handle, target.camera.lat, target.camera.lon, target.camera.dist, undefined, ms)
    },
    setWindow: window => writeSharedWindow(disclosureSession, window),
  }
}

/** The occurrence the atlas has opened (its manifest view) as a visit: the world's place there when it holds one, else the occurrence itself,
 * framed as the atlas frames a place. None for an occurrence with no place on the Earth. */
export function visitOfManifest(handle: Pick<AtlasHandle, 'ctl' | 'model'>): Parameters<typeof noteWalkVisit>[0] | null {
  const view = handle.ctl.state.view
  if (view.kind !== 'manifest') return null
  const index = handle.model.occIndex.get(view.occId)
  const occ = index === undefined ? undefined : handle.model.occ[index]
  if (!occ || occ.geoPrecision === 'none') return null
  const place = occ.subject_ref ? suitePlaces().find(row => row.subject_ref === occ.subject_ref && row.located && !row.body_ref
    && Math.abs((row.lat ?? NaN) - occ.lat) < 1e-9 && Math.abs((row.lon ?? NaN) - occ.lon) < 1e-9) : undefined
  return {placeRef: place?.ref ?? null, name: place?.name ?? occ.label, camera: {lat: occ.lat, lon: occ.lon, dist: framingDistance(place?.precision ?? 'exact')}}
}

export interface WalksBinding {
  dispose(): void
}

/** Bind the World's walk to the mounted atlas: its owner, the World, the atlas's own visits, and a first read of the walk. */
export function bindWalks({handle, transport, session = walkSession}: {handle: AtlasHandle; transport: KernelTransportStatus; session?: WalkSession}): WalksBinding {
  let live = true
  const release = session.bind(kernelWalkOwners(transport), atlasWalkWorld(handle))
  void session.read()
  let opened: string | null = null
  // The controller's face notice (a state applied is one); read where the controller gives it, as the attach's own face calls are.
  const offFaces = handle.ctl.subscribeFaces?.(() => {
    if (!live) return
    const view = handle.ctl.state.view
    const occId = view.kind === 'manifest' ? view.occId : null
    if (occId === opened) return
    opened = occId
    const visit = visitOfManifest(handle)
    if (visit) noteWalkVisit(visit)
  })
  const reread = () => { if (live) void session.read() }
  worldListeners.add(reread)
  return {
    dispose() {
      if (!live) return
      live = false
      offFaces?.()
      worldListeners.delete(reread)
      release()
    },
  }
}
