import {useState} from 'react'
import type {NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {useWorkspace} from '../shell/workspace'
import {applyDeviceChanges} from './NativeDevicePoolView'
import type {DeviceRow} from './nativeBrowserModel'
import {deviceAddChange} from './nativeDeviceRackModel'
import {DEVICE_MIME, dispatchOpenDevice, encodeDeviceDrag, setDragChip} from './nativeDrag'
import './NativeDeviceBrowser.css'

/** The Browser's Devices category. Activating a row opens its whole panel in the pool and changes nothing on the rack.
 * Double-click, '+ Add' or Alt+Enter adds it to the rack as one device-add; a row also drags onto the rack. */
export function NativeDeviceBrowser({rows, reading, selected}: {rows: readonly DeviceRow[]; reading: NativeEditorReading | null; selected: string | null}) {
  const workspace = useWorkspace()
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const add = async (family: string) => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const reply = await applyDeviceChanges(workspace, [deviceAddChange(family)])
      if (!reply.ok) setError(reply.error)
    } finally {setBusy(false)}
  }
  return <section className="native-device-browser" aria-label="Native devices">
    {!rows.length && <p className="native-empty">No device matches this search.</p>}
    <ul className="native-device-rows">{rows.map(row => <li key={row.family} className="native-device-row-item">
      <button type="button" data-browser-row className={`native-device-row${selected === row.family ? ' selected' : ''}`} draggable aria-pressed={selected === row.family}
        title={`${row.name} · ${row.summary}. Enter opens its panel; double-click or Alt+Enter adds it to the rack; drag it onto the rack.`}
        onClick={() => dispatchOpenDevice({scope: row.scope, family: row.family})}
        onDoubleClick={() => void add(row.family)}
        onKeyDown={event => {if (event.altKey && event.key === 'Enter') {event.preventDefault(); void add(row.family)}}}
        onDragStart={event => {event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData(DEVICE_MIME, encodeDeviceDrag(row.family)); setDragChip(event.dataTransfer, row.name)}}>
        <span className="native-device-row-main"><span className="native-device-row-name">{row.name}</span>{row.onRack && <span className="native-device-row-mark">on rack</span>}</span>
        <span className="native-device-row-summary">{row.summary}</span>
      </button>
      <span className={`native-device-row-light${row.enabled === undefined ? ' is-unknown' : row.enabled ? '' : ' is-off'}`} role="img"
        aria-label={row.enabled === undefined ? `${row.name}: no enable operation disclosed` : row.enabled ? `${row.name}: enabled` : `${row.name}: disabled`} />
      <button type="button" className="native-device-add" disabled={row.onRack || busy || !reading} aria-label={`Add ${row.name} to the rack`}
        title={row.onRack ? `${row.name} is already on the rack` : `Add ${row.name} to the rack`} onClick={() => void add(row.family)}>+ Add</button>
    </li>)}</ul>
    {error && <p className="native-error" role="alert">{error}</p>}
  </section>
}
