// The live owners a palace on the atlas reads and writes through (T-PALACES-ONTO-ATLAS; lock §0 law 4 "Owners write; faces read").
// Bound by the atlas host while the Earth stands (palacesHost.ts), released with it.
//
// Every call is an owner the candidate already runs; none is new:
//   - the kernel Expression owner, through the same `kernel-expression` channel the frame's Palace lens called
//     (field-studies-journeys/src/kernelExpressions.ts:122 listKernelExpressions, :128 readKernelExpression, :460 nativeExpressionRequest
//     — the frame's edit at app.ts:2737), answered by the owner adapter the shell already builds for the hosted frame
//     (packages/expressions-boundary/src/cradle.ts createCradleOwners): `inspect`, `list`, the one CAS-gated `edit`, and the routed
//     Return's `invoke_action` (cradle.ts:124, the ke-invoke route: the owner re-reads the reading the proposal came from, decides,
//     and only then dispatches through the kernel's action seam);
//   - the owner's integral reading through the same adapter's `techne-reading` channel (cradle.ts `readWikiSceneTechne`, scope
//     "expression"), the reading the frame's Palace read at :629;
//   - the register's Expression opened by its own owner when the kernel does not hold it yet
//     (desktop/cradle/src/techne/wikiNativeExpression.ts:57 ensureWikiNativeExpression), after the registers are loaded the way the
//     subject door loads them (native/wikiSubjectStanding.ts liveWikiStandingSource);
//   - the presence store over the atlas's own workspace memory (AtlasProjectionPanel.tsx atlasMemoryStorage — the host-seam adaptation
//     of the frame's webview storage, as the atlas's other memories are bound: keys under the workspace book's namespace);
//   - the shared session (desktop/cradle/src/techne/session.ts disclosureSession) a trail step records on;
//   - the shell's own doors to open an object: the App's Expression door published with the World's tracks
//     (projections/timelinePaneHost.ts `journey.openExpression`, workspace.requestExpression), the owner's selection ask for a Scene
//     (techne/wikiProjectionStore.ts requestWikiSelection, then the stage presented — techne/subject/openSubject.ts presentStage, the
//     subject door's two acts), the subject door itself (openWorldSubject), the instrument door (frame/instrumentDoor.ts openInstrument,
//     the ref as the pane's subject), and the Graph and source surface (`oi:epi-open-knowledge`, panels/knowledge.tsx).

import type {KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {TechneInstrument} from '../../../../../../../desktop/cradle/src/techne/contract'
import {disclosureSession} from '../../../../../../../desktop/cradle/src/techne/session'
import {getWikiProjectionState, requestWikiSelection, wikiProjectionOf} from '../../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {ensureWikiNativeExpression} from '../../../../../../../desktop/cradle/src/techne/wikiNativeExpression'
import type {ChannelContext, ExpressionsOwners} from '@epilogos/expressions-boundary'
import {liveWikiStandingSource} from '../../../native/wikiSubjectStanding'
import {openInstrument} from '../../../frame/instrumentDoor'
import {timelineReading} from '../../timelinePaneHost'
import {openWorldSubject, presentStage} from '../../../techne/subject/openSubject'
import type {PresenceStorage} from '../../../../../../../desktop/cradle/src/techne/m0m5/journey/presence'
import type {PalaceListedExpression, PalaceOwners} from './palaceSession'

/** The pane payload each deep instrument opens through (frame/instruments.ts): the stage's lenses, the Graph for the M0′ ground, the
 * Earth for a place. A lens the shell has no pane for is refused by name. */
export const INSTRUMENT_PAYLOADS: Readonly<Partial<Record<TechneInstrument, string>>> = {
  canvas: 'projection.expressions#canvas', timeline: 'projection.expressions#timeline', journey: 'projection.expressions#journey',
  project: 'projection.constellation', place: 'projection.earth',
}

/** The kernel's Expressions as the owner lists them: the open ones (kernelExpressions.ts:124), by ref, title and revision. */
export function listedExpressions(data: unknown): PalaceListedExpression[] {
  const rows = (data as {expressions?: unknown} | null)?.expressions
  if (!Array.isArray(rows)) return []
  return rows.flatMap(row => {
    const entry = row as {expression_ref?: unknown; title?: unknown; revision?: unknown; open?: unknown}
    return entry.open !== false && typeof entry.expression_ref === 'string'
      ? [{expression_ref: entry.expression_ref, title: typeof entry.title === 'string' ? entry.title : entry.expression_ref, revision: Number(entry.revision) || 0}]
      : []
  })
}

/** The live owners over one kernel transport. `storage` is the atlas's workspace memory (the host binds it); `said` carries an owner's
 * late answer (a door that answers after the act) to the palace's line. */
export function livePalaceOwners({transport, storage, said, live}: {transport: KernelTransportStatus; storage: () => PresenceStorage | null; said: (line: string) => void; live: () => boolean}): PalaceOwners {
  // The owner adapter is loaded with its first call, as the Place tool loads the owner's editor (places/placesHost.ts): it carries the
  // hosted frame's whole owner family (the Nara facade, the Flow documents), which the atlas needs only once a palace is entered.
  let adapter: Promise<ExpressionsOwners> | null = null
  const owners = () => adapter ??= import('@epilogos/expressions-boundary/cradle').then(module => module.createCradleOwners(transport, {project: 'O-I', personal: false, isCurrent: live}))
  const channel = async (name: string) => {
    const loaded = await owners()
    const owner = loaded.channels[name]
    if (!owner) throw Error(loaded.unavailableReason ?? `The native owner answers no ${name} here`)
    return owner
  }
  const context = (): ChannelContext => ({mode: 'techne', bindingId: 'atlas:palace', epoch: 0, signal: new AbortController().signal, state: null, current: live})
  const expression = async (request: Record<string, unknown>) => (await channel('kernel-expression'))(request, context())
  return {
    inspect: async ref => {
      const data = await expression({operation: 'inspect', expression_ref: ref}) as {document?: unknown} | null
      if (!data?.document) throw Error(`The kernel returned no document for ${ref}`)
      return data.document
    },
    readWhole: async basis => (await channel('techne-reading'))({...basis, scope: 'expression'}, context()),
    list: async () => listedExpressions(await expression({operation: 'list'})),
    edit: request => expression(request),
    invoke: request => expression(request),
    hold: async key => {
      await liveWikiStandingSource.loadRegisters()
      const register = getWikiProjectionState().registers.find(row => row.key === key)
      if (!register) throw Error(`No register ${key} is disclosed by the World`)
      const held = await ensureWikiNativeExpression(transport, register)
      return held.document.expression_ref
    },
    projection: key => wikiProjectionOf(getWikiProjectionState().standings[key]),
    storage,
    session: disclosureSession,
    open: {
      expression: ref => {
        const door = timelineReading()?.journey?.openExpression
        if (!door) throw Error('the shell holds no door to open an Expression here: the World\'s tracks are not standing')
        door(ref)
        return `Opened ${ref} in the stage.`
      },
      scene: (palace, room) => {
        requestWikiSelection({registerKey: palace.key, sceneRef: room.key, entityRef: null, subjectRef: null, title: room.name, origin: 'external'})
        presentStage()
        return `Asked the stage to open ${room.name} of ${palace.title}; the stage opens it when Technē presents it.`
      },
      subject: (ref, title) => {
        void openWorldSubject({ref, title}).then(answer => { if (answer.state === 'absent') said(answer.reason) }, error => said(error instanceof Error ? error.message : String(error)))
        return `Asked the subject door for ${title}: it opens the Scene that carries it.`
      },
      instrument: (instrument, ref) => {
        const payload = INSTRUMENT_PAYLOADS[instrument]
        if (!payload) throw Error(`the ${instrument} instrument has no pane in this shell`)
        openInstrument(payload, undefined, {ref, title: ref})
        return `Asked the shell for the ${instrument} instrument with ${ref} as its subject. The instrument names any ref it cannot find.`
      },
      source: ref => {
        window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {title: ref, address: {kind: 'source', value: ref}, plane: 'page',
          complete: (error?: string) => { if (error) said(error) }}}))
        return `Asked Graph and source for ${ref}.`
      },
    },
  }
}
