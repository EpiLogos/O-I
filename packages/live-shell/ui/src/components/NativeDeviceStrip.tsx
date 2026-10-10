import {useState} from 'react'
import type {Entity, NativeEditorChange} from '../../../../expressions-boundary/src/editor'
import type {StripDevice} from './nativeDeviceStripModel'
import './NativeDeviceStrip.css'

const FORCE_MODES: Entity['force']['kind'][] = ['none', 'attract', 'repel', 'vortex']

/** The contextual Force card of the selected object. It is entity-scoped, so it is never a rack widget and needs no entry in reading.devices.
 * Commits go through the rack's own in-flight lock (`send`); the card holds no request state of its own. */
export function ForceDeviceCard({device, entity, locked, send, onOpen}: {device: StripDevice; entity: Entity; locked: boolean;
  send: (changes: readonly NativeEditorChange[]) => void; onOpen: (device: {scope: 'entity' | 'field'; family: string}) => void}) {
  const [folded, setFolded] = useState(false)
  const state = device.on === undefined ? 'unknown' : device.on ? 'on' : 'off'
  return <article className={`native-chain-device is-force${folded ? ' is-folded' : ''}`} aria-label={device.name}>
    <header className="native-chain-head">
      {/* Force has no enable operation: the light reports the entity's state and is not a control. */}
      <span role="img" className={`native-chain-light is-${state}`} aria-label={`${device.name} ${state}`} title={`${device.name} is ${state}`} />
      <button type="button" className="native-chain-fold" aria-expanded={!folded} aria-label={`${folded ? 'Expand' : 'Fold'} ${device.name}`}
        onClick={() => setFolded(!folded)}><span aria-hidden="true">{folded ? '▸' : '▾'}</span></button>
      <button type="button" className="native-chain-title" title="Open settings" onClick={() => onOpen({scope: 'entity', family: 'force'})}>{device.name}</button>
    </header>
    {!folded && <div className="native-chain-body">
      <p className="native-chain-summary" title={device.summary}>{device.summary}</p>
      <div className="native-chain-modes" role="group" aria-label="Force mode">{FORCE_MODES.map(mode => <button key={mode} type="button" className="native-chain-mode"
        aria-pressed={entity.force.kind === mode} disabled={locked || entity.locked}
        onClick={() => send([{kind: 'force-mode', entity_id: entity.id, value: mode}])}>{mode}</button>)}</div>
    </div>}
  </article>
}
