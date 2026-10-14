// One device in three sizes (manual §10.4: "Every device comes in three sizes, and all three show the same live settings";
// FOUNDATION F5). Compact on the rack: its live picture and up to four controls, macros first. Whole in the pool: every
// setting, grouped. Full in a pane: the device at full size. The SDK's plate and controls draw it (inhabitants/sdk/
// controls.tsx, the renderer it was written to be); a row with no write path is a reading; a light is a reading, dark when
// unknown; a value someone else holds shows who, and the hand-back light gives it back.
import {Fragment, useEffect, type ReactNode} from 'react'
import {BoolParam, EnumParam, FacePlate, ReadingRow, ScalarParam, useFaceDrafts} from '../../inhabitants/sdk/controls'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import {compactRows, groupRows, heldRows, lightOf, type DeviceInstance, type DeviceSize, type ParamValue} from './deviceRuntime'
import './devices.css'

export interface DeviceViewProps {
  device: DeviceInstance
  size: DeviceSize
  /** The device's own live picture (the torus, the die, the field): small on the rack, full in a pane. */
  picture?: ReactNode
  /** Plate actions the place offers (fold, open whole, open full, remove from the rack). */
  actions?: readonly {icon: 'detail' | 'pane' | 'back' | 'cmd' | 'plus'; label: string; onPress: () => void}[]
  /** The host's own wrap for a control (Live maps a macro to a key or a MIDI control through it). */
  wrapRow?: (row: SdkParamRow, control: ReactNode) => ReactNode
}

export function DeviceView({device, size, picture, actions, wrapRow}: DeviceViewProps) {
  const drafts = useFaceDrafts(async changes => { if (!device.submit) throw Error('This device has no owner write'); await device.submit(changes) })
  const {adopt} = drafts
  useEffect(() => { adopt(device.values as Record<string, ParamValue>) }, [device.values, adopt])
  const rows = size === 'compact' ? compactRows(device.rows) : device.rows
  const held = heldRows(device)
  const presentation = {family: device.family, faceId: device.face.id, title: device.face.title, icon: device.face.icon,
    owner: held.length ? `${device.family} · held by ${[...new Set(held.map(key => device.heldBy![key]))].join(', ')}` : device.family}
  const control = (row: SdkParamRow) => {
    const node = <DeviceRow key={row.key} row={row} drafts={drafts} disabled={!device.submit || !row.writePath} heldBy={device.heldBy?.[row.key]}
      handBack={device.handBack ? () => void device.handBack!(row.key) : undefined} compact={size === 'compact'} />
    return wrapRow ? <Fragment key={row.key}>{wrapRow(row, node)}</Fragment> : node
  }
  return <div className={`device device--${size}`} data-device={device.id} data-device-size={size} data-device-light={lightOf(device)}>
    <FacePlate presentation={presentation} power={lightOf(device)} actions={actions?.map(action => ({...action}))}>
      {picture && <div className="device-picture">{picture}</div>}
      {size === 'compact'
        ? <div className="device-controls">{rows.map(control)}</div>
        : groupRows(rows, device.face.title).map(group => <fieldset key={group.group} className="device-group"><legend>{group.group}</legend>{group.rows.map(control)}</fieldset>)}
      {drafts.dirtyKeys().length > 0 && <div className="device-commit" role="group" aria-label="Unsent changes">
        <button type="button" onClick={() => void drafts.commit()}>Send</button>
        <button type="button" onClick={() => drafts.cancel()}>Cancel</button>
        {drafts.standing === 'refused' && <span role="alert">{drafts.refusal ? `${drafts.refusal} Your values are kept.` : 'The owner refused the change; your values are kept.'}</span>}
      </div>}
    </FacePlate>
  </div>
}

type Drafts = ReturnType<typeof useFaceDrafts>

function DeviceRow({row, drafts, disabled, heldBy, handBack, compact}: {row: SdkParamRow; drafts: Drafts; disabled: boolean; heldBy?: string; handBack?: () => void; compact: boolean}) {
  const base = drafts.base[row.key], draft = drafts.drafts[row.key]
  const common = {param: row, onCommit: () => void drafts.commit(), onCancel: () => drafts.cancel(row.key), disabled}
  const body = !row.writePath
    ? <ReadingRow param={row} value={base} />
    : row.type === 'boolean'
      ? <BoolParam {...common} base={typeof base === 'boolean' ? base : undefined} draft={typeof draft === 'boolean' ? draft : undefined} onDraft={value => drafts.setDraft(row.key, value)} />
      : row.type === 'enumerated'
        ? <EnumParam {...common} base={typeof base === 'string' ? base : undefined} draft={typeof draft === 'string' ? draft : undefined} onDraft={value => drafts.setDraft(row.key, value)} />
        : <ScalarParam {...common} base={typeof base === 'number' ? base : undefined} draft={typeof draft === 'number' ? draft : undefined} onDraft={value => drafts.setDraft(row.key, value)} presentation={compact ? 'knob' : 'fader'} />
  return <div className="device-row" data-param={row.key} data-held-by={heldBy}>
    {body}
    {heldBy && <button type="button" className="device-handback" title={`${heldBy} holds this value. Give it back`} aria-label={`Give ${row.title} back to ${heldBy}`} disabled={!handBack} onClick={handBack}>↺</button>}
  </div>
}
