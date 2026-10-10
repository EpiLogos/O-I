import {useRef, useState} from 'react'
import type {NativeEditorReply, NativeEditorRequest} from '../../../../expressions-boundary/src/editor'
import {useWorkspace} from '../shell/workspace'
import {deviceAddChange} from './nativeDeviceRackModel'
import {NativeDevicePoolView, applyDeviceChanges, type DeviceRequest} from './NativeDevicePoolView'

export type {DeviceRequest} from './NativeDevicePoolView'

/** Container: reads the same retained editor the rack and settings use. Presentation is the pool's own visibility. */
export function NativeDevicePool({request, onClose}: {request: DeviceRequest; onClose: () => void}) {
  const workspace = useWorkspace()
  const latest = useRef(workspace)
  latest.current = workspace
  const opened = useRef({workspaceId: workspace.workspaceId, accessEpoch: workspace.accessEpoch})
  const root = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  // Hidden residences stay mounted: an edit is refused unless this pool is laid out and still on the same workspace and access.
  const presented = () => {
    const now = latest.current, id = opened.current
    return now.workspaceId === id.workspaceId && now.accessEpoch === id.accessEpoch && now.mode !== 'audio'
      && now.nativeAccessCurrent(id.accessEpoch) && !!root.current?.getClientRects().length
  }
  const send = (operation: NativeEditorRequest): Promise<NativeEditorReply> => {
    const now = latest.current
    if (!presented() || !now.editor) return Promise.resolve({ok: false, error: 'The expanded device is no longer presented; current work was retained.'})
    return now.editor.request(operation)
  }
  const selectEntity = (id: string) => {
    const reading = latest.current.editorReading
    if (reading && presented()) void send({operation: 'select', basis: reading.basis, entity_id: id})
  }
  const add = async (family: string) => {
    if (busy || !presented()) return
    setBusy(true); setError(null)
    try {
      const reply = await applyDeviceChanges(latest.current, [deviceAddChange(family)])
      if (!reply.ok) setError(reply.error)
    } finally {setBusy(false)}
  }
  return <NativeDevicePoolView reading={workspace.editorReading} request={send} requested={request} isPresented={presented} busy={busy} error={error}
    onAdd={family => void add(family)} onClose={onClose} onSelectEntity={selectEntity} rootRef={root}/>
}
