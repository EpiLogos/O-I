import type {RefObject} from 'react'
import type {NativeEditorBasis, NativeEditorChange, NativeEditorController, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import {NativeDeviceEditors} from './NativeDeviceEditors'
import {deviceCatalogue} from './nativeDeviceCatalogue.ts'
import {sceneFaceView} from './nativeSceneFaceViews.tsx'
import {OPEN_STUDIO_EVENT, type OpenDeviceRequest} from './nativeDrag'
import './NativeDevicePool.css'

export type DeviceRequest = OpenDeviceRequest & {nonce: number}

/** Every device change from the Browser goes through the retained owner: one apply on its current reading basis.
 * Refusals come back as data; nothing here writes shell storage. */
export async function applyDeviceChanges(workspace: {editor: NativeEditorController | null; editorReading: NativeEditorReading | null},
  changes: readonly NativeEditorChange[], basis?: NativeEditorBasis): Promise<NativeEditorReply> {
  const editor = workspace.editor, reading = workspace.editorReading
  if (!editor || !reading) return {ok: false, error: 'Open a native Expression to edit its devices.'}
  if (reading.standing.pending) return {ok: false, error: 'Waiting for the native owner to acknowledge the last change.'}
  // A caller that has just received a reply passes that reply's basis: the workspace reading may not have re-rendered yet.
  try {return await editor.request({operation: 'apply', basis: basis ?? reading.basis, changes: [...changes]})}
  catch (cause) {return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}}
}

export interface NativeDevicePoolViewProps {
  reading: NativeEditorReading | null
  request: (operation: NativeEditorRequest) => Promise<NativeEditorReply>
  requested: DeviceRequest
  isPresented: () => boolean
  busy: boolean
  error: string | null
  onAdd: (family: string) => void
  onClose: () => void
  onSelectEntity?: (id: string) => void
  rootRef?: RefObject<HTMLElement>
}

/** The expanded device: the whole panel of one device, its rack state and the studio hand-off. Pure apart from the studio event. */
export function NativeDevicePoolView({reading, request, requested, isPresented, busy, error, onAdd, onClose, onSelectEntity, rootRef}: NativeDevicePoolViewProps) {
  // The family's registry scope decides the panel, not the scope the request carried. An unknown family keeps the request's scope.
  const entry = deviceCatalogue().find(row => row.family === requested.family) ?? null
  const scope: 'field' | 'entity' | 'scene' = entry?.scope ?? (requested.scope === 'entity' ? 'entity' : 'field')
  const device = scope === 'entity' ? null : entry
  const title = entry?.name ?? (scope === 'entity' ? 'Force' : requested.family)
  const onRack = !!device && !!reading?.devices.some(row => row.family === requested.family)
  // A scene family hosts its own whole panel; every other family keeps the Field and entity editors.
  const ScenePanelView = scope === 'scene' ? sceneFaceView(requested.family) : null
  const applyScene = (changes: readonly NativeEditorChange[]): Promise<NativeEditorReply> => {
    if (!reading) return Promise.resolve({ok: false, error: 'Open a native Expression to edit its devices.'})
    if (reading.standing.pending) return Promise.resolve({ok: false, error: 'Waiting for the native owner to acknowledge the last change.'})
    return request({operation: 'apply', basis: reading.basis, changes: [...changes]})
  }
  return <section ref={rootRef} className="native-device-pool" role="region" aria-label={`${title} panel`}
    onKeyDown={event => {if (event.key === 'Escape' && !event.defaultPrevented) {event.preventDefault(); onClose()}}}>
    <header className="native-device-pool-head">
      <strong className="native-device-pool-title" title={scope === 'entity' ? 'Force of the selected object' : `${title} · ${scope === 'scene' ? 'scene' : 'field'} device`}>{title}</strong>
      {device && <button type="button" className="native-device-pool-add" disabled={!reading || busy || onRack} onClick={() => onAdd(requested.family)}
        title={onRack ? `${title} is already on the rack` : `Add ${title} to the rack as one device`}>{onRack ? 'On rack ✓' : 'Add to rack'}</button>}
      {device?.studio && <button type="button" className="native-device-pool-studio" disabled={!reading}
        title={reading ? `Show the full ${title} panel in the Expressions Studio (${device.studio})` : 'Open a native Expression to show this panel in the Expressions Studio'}
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_STUDIO_EVENT, {detail: {section: device.studio}}))}>Open in studio ↗</button>}
      <button type="button" className="native-device-pool-close" aria-label="Close device panel" title="Close (Esc)" onClick={onClose}><span aria-hidden="true">✕</span></button>
    </header>
    {error && <p className="native-device-pool-error" role="alert">{error}</p>}
    <div className="native-device-pool-body">
      {ScenePanelView
        ? reading ? <ScenePanelView key={device?.family} reading={reading} request={request} disabled={busy || reading.standing.pending} apply={applyScene}/>
          : <p className="native-empty">Open a native Expression to see this device.</p>
        : <NativeDeviceEditors pooled reading={reading} request={request} onSelectEntity={onSelectEntity} isPresented={isPresented}
          requested={{...requested, scope: scope === 'entity' ? 'entity' : 'field'}}/>}
    </div>
  </section>
}
