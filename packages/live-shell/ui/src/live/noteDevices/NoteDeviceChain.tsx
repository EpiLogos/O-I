// The note devices in Live's device chain, before the torus (T-LIVE-MODE-SCALES item 3). Each device is a tile in the device-tile
// language; its power, reorder and remove act on the session hold (noteDeviceChain.ts). Every parameter shows on the device it moves.
// The Scale device's face says whether it folds or passes through, and why. Faces read; the pitch set is the owner's (the mode in force).

import type {ModeInForce} from '../modes'
import {useLiveModeInForce} from '../../native/liveModeCatalogue'
import {addNoteDevice, moveNoteDevice, removeNoteDevice, setNoteDevicePower, setScaleTie, useNoteDeviceChain} from './noteDeviceHold'
import {NOTE_DEVICE_LABEL, NOTE_DEVICES_WAITING, TIE_RULES, TIE_RULE_LABEL, scalePlan, type NoteDevice, type TieRule} from './noteDevices'
import './noteDevices.css'

/** The connected chain: the session hold, read with the set's mode in force. */
export function NoteDeviceChain() {
  const devices = useNoteDeviceChain()
  const {mode} = useLiveModeInForce()
  return (
    <div className="chain-side note-device-side" data-note-device-chain="note-devices">
      <NoteDeviceChainView devices={devices} mode={mode}/>
    </div>
  )
}

/** The chain's face. Pure over its props; the actions write the session hold. */
export function NoteDeviceChainView({devices, mode}: {devices: readonly NoteDevice[]; mode: ModeInForce}) {
  return (
    <section className="note-device-chain" aria-label="Note devices" data-note-devices={devices.length}>
      <header className="note-device-head">
        <span className="note-device-heading">Note devices</span>
        <span className="note-device-sub">before the torus · every played note, in chain order</span>
      </header>
      {devices.length === 0 && <p className="note-device-empty" data-note-devices-empty>No note devices. Played notes reach the torus unchanged.</p>}
      <ol className="note-device-row">
        {devices.map((device, index) => (
          <li key={device.id} className="note-device-slot">
            <NoteDeviceTile device={device} index={index} count={devices.length} mode={mode}/>
          </li>
        ))}
      </ol>
      <details className="note-device-add">
        <summary>Add note device</summary>
        <ul className="note-device-menu" aria-label="Note device kinds">
          <li><button type="button" onClick={() => addNoteDevice('scale')}>{NOTE_DEVICE_LABEL.scale}</button></li>
          {NOTE_DEVICES_WAITING.map(item => (
            <li key={item.label}><button type="button" disabled title={`${item.label} is ${item.waiting}; it is not offered yet`}>{`${item.label} — ${item.waiting}`}</button></li>
          ))}
        </ul>
      </details>
      <p className="note-device-persistence" data-note-device-persistence>
        Held for this session only: the set document has no owner write for a note-device chain yet.
      </p>
    </section>
  )
}

function NoteDeviceTile({device, index, count, mode}: {device: NoteDevice; index: number; count: number; mode: ModeInForce}) {
  const name = NOTE_DEVICE_LABEL[device.kind]
  const plan = device.kind === 'scale' ? scalePlan(mode) : null
  const reading = !device.enabled ? 'Bypassed: notes pass through unchanged.' : plan === null ? '' : plan.line
  return (
    <section className="device-tile note-device" data-note-device={device.kind} data-note-device-id={device.id}
      data-note-device-power={device.enabled ? 'on' : 'off'} data-note-device-reading={plan === null ? 'none' : plan.state} aria-label={`${name} note device`}>
      <div className="device-title note-device-title">
        <button type="button" className="note-device-power" aria-pressed={device.enabled} aria-label={`${name} power`}
          title={device.enabled ? `${name} is on: power off to bypass` : `${name} is bypassed: power on to use it`}
          onClick={() => setNoteDevicePower(device.id, !device.enabled)}>●</button>
        <span className="note-device-name">{name}</span>
        <span className="note-device-order">
          <button type="button" aria-label={`Move ${name} earlier`} disabled={index === 0} onClick={() => moveNoteDevice(device.id, -1)}>↑</button>
          <button type="button" aria-label={`Move ${name} later`} disabled={index === count - 1} onClick={() => moveNoteDevice(device.id, 1)}>↓</button>
          <button type="button" aria-label={`Remove ${name}`} onClick={() => removeNoteDevice(device.id)}>×</button>
        </span>
      </div>
      <div className="device-parameters">
        {device.kind === 'scale' && (
          <label className="device-parameter note-device-parameter">
            <span className="device-parameter-name">Tie: equal distance up or down</span>
            <select aria-label={`${name} tie rule`} value={device.params.tie} onChange={event => setScaleTie(device.id, event.target.value as TieRule)}>
              {TIE_RULES.map(tie => <option key={tie} value={tie}>{TIE_RULE_LABEL[tie]}</option>)}
            </select>
          </label>
        )}
        {reading !== '' && <p className="note-device-reading" data-note-device-line>{reading}</p>}
      </div>
    </section>
  )
}
