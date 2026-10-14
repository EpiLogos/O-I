// The Earth projection's admission into the shell (T-ATLAS-HOST): one centre panel for the lens bar, and the atlas as the
// `projection.earth` and `projection.constellation` pane kinds through the cradle's module door
// (desktop/cradle/src/surface/projectionModules.ts). Called once from App.tsx.
//
// Follow and pin (manual §10.2, FOUNDATION F2; the mockup's `follow`, which turns the Earth to the subject): a pane of either
// kind follows the selection and turns the atlas to it, unless the pane is pinned — a pinned pane turns to its pinned subject
// and keeps it while the selection moves elsewhere. The atlas turns by its own navigation (the manifestation of the
// occurrence whose owner ref is the subject); a subject the atlas does not draw turns nothing, and says nothing it cannot back.

import {registerPanel} from '../../shell/panels'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {registerProjectionModule, type PaneSubject, type ProjectionModuleContext, type ProjectionModuleHandle} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {AtlasEarthPane, atlasHandle, attachAtlas, type AtlasAttachment, type AtlasView} from './AtlasProjectionPanel'
import type {Model} from './src/data/model'
import type {AppState} from './src/state/store'
import type {Occurrence} from './src/types/field'

export const ATLAS_PANEL_ID = 'projection.earth'
export const ATLAS_MODULE_ID = 'atlas-earth'

let registered = false

export function registerAtlasHost(): void {
  if (registered) return
  registered = true
  registerPanel({
    id: ATLAS_PANEL_ID,
    title: 'Earth',
    slot: 'center',
    component: AtlasEarthPane,
    navigation: false,
    order: 30,
    note: 'The Archetypal-Earth atlas: the globe and the graph over the World\'s corpus',
  })
  registerProjectionModule({id: ATLAS_MODULE_ID, kind: 'projection.earth', follows: true, create: context => mountKind(context, 'earth')})
  registerProjectionModule({id: ATLAS_MODULE_ID, kind: 'projection.constellation', follows: true, create: context => mountKind(context, 'graph')})
}

/** The module door's mount: the same atlas, in a pane of its kind, with the kind's fixed view. */
async function mountKind(context: ProjectionModuleContext, view: AtlasView): Promise<ProjectionModuleHandle> {
  // The pane element is the atlas host (atlasHost.css): its containment keeps the ported atlas's fixed #globe and ~30 fixed
  // overlays inside the pane. Without it the globe stood 1440×900 over the whole window and took the pointer from the
  // transport (seen headless by the transport lane, 14 Oct).
  context.element.classList?.add('atlas-host')
  const attachment = await attachAtlas({element: context.element, transport: detectTransport(), follow: false, view})
  const turning = turnWithSubject(context.subject, attachment)
  return {
    setVisible: visible => { attachment.setVisible(visible); turning.visible(visible) },
    unmount: () => { turning.stop(); attachment.unmount() },
  }
}

// ── turning the atlas to the pane's subject ──────────────────────────────

/** The occurrence the atlas draws for a subject ref: the one whose owner ref (`subject_ref`, the native identity the encounter
 * spine addresses) or reading basis names it, else the one whose atlas id it is. Null when the atlas draws nothing for it. */
export function occurrenceOfSubject(occurrences: readonly Pick<Occurrence, 'id' | 'subject_ref' | 'basis'>[], ref: string): string | null {
  const hit = occurrences.find(item => item.subject_ref === ref) ?? occurrences.find(item => item.basis?.ref === ref) ?? occurrences.find(item => item.id === ref)
  return hit ? hit.id : null
}

/** The state that turns the atlas to a subject: the manifestation of its occurrence under the occurrence's family, in the view
 * the atlas is in (the graph stays the graph). Null when the atlas draws nothing for the subject, or the sky stands (a view
 * the person went into; the selection does not leave it). */
export function stateForSubject(model: Pick<Model, 'occ' | 'occIndex'>, ref: string, current: Pick<AppState, 'graph' | 'sky'>): AppState | null {
  if (current.sky) return null
  const id = occurrenceOfSubject(model.occ, ref)
  const index = id === null ? undefined : model.occIndex.get(id)
  if (id === null || index === undefined) return null
  return {view: {kind: 'manifest', occId: id, context: {type: 'family', id: model.occ[index].familyId}}, deep: false, ...(current.graph ? {graph: true as const} : {})}
}

/** Follow the pane's subject with the atlas this pane holds. A following pane is left where the person has it until the
 * selection moves; a pinned pane turns to its pin when the pin is set (and at mount, if it was pinned then). A concealed
 * pane turns when it is shown again. A pane that does not hold the atlas (another pane has it) turns nothing. */
export function turnWithSubject(subject: PaneSubject | undefined, attachment: Pick<AtlasAttachment, 'held'>): {visible(next: boolean): void; stop(): void} {
  if (!subject) return {visible: () => {}, stop: () => {}}
  // The selection already standing when a following pane mounts is not turned to: the atlas opens where the person left it.
  let turnedTo: string | undefined = subject.pinned() === undefined ? subject.shown() : undefined
  let visible = true
  let stopped = false
  const turn = () => {
    if (stopped || !visible || attachment.held !== null) return
    const ref = subject.shown()
    if (ref === undefined || ref === turnedTo) return
    const handle = atlasHandle()
    if (!handle) return
    turnedTo = ref
    const next = stateForSubject(handle.model, ref, handle.ctl.state)
    if (next) handle.ctl.navigate(next)
  }
  const release = subject.subscribe(turn)
  turn()
  return {
    visible(next) { visible = next; if (next) turn() },
    stop() { stopped = true; release() },
  }
}
