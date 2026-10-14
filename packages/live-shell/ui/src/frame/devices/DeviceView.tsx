// One device in three sizes (manual §10.4: "Every device comes in three sizes, and all three show the same live settings";
// FOUNDATION F5). Compact on the chain: the mockup's plate (world-shell-mockup.html:331-347, `dev()` at :1410) — a head of
// power ring, name, owner, ▾ fold and ⤢ open full, then the picture box beside a two-column grid of up to four controls,
// macros first, at a fixed width the device's own rows give it. Whole in the pool and full in a pane: the same plate, larger,
// every row grouped under its heading; full gives the picture the pane's height. The SDK's plate and controls draw it
// (inhabitants/sdk/controls.tsx, the renderer it was written to be): a knob is a ring, a short choice and a switch are
// segmented toggles, a reading is its name over its value. A row with no write path is a reading; a light is a reading, dark
// when unknown, and the ring turns the device only through the owner's write; a value someone else holds shows who, and the
// hand-back light gives it back. Pressing a plate on the chain shows it whole in the pool (Live's device selection).
import {Fragment, useEffect, useState, type CSSProperties, type ReactNode} from 'react'
import {BoolParam, EnumParam, FacePlate, ReadingRow, ScalarParam, useFaceDrafts, type PlateMark} from '../../inhabitants/sdk/controls'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import {useSelectedDeviceId} from './deviceDoor'
import {compactRows, enumPresentation, groupRows, heldRows, lightOf, plateWidth, powerToggle, rowSpan, type DeviceInstance, type DeviceSize, type ParamValue} from './deviceRuntime'
import './devices.css'

export interface DeviceViewProps {
  device: DeviceInstance
  size: DeviceSize
  /** The device's own live picture (the torus, the die, the field): small on the rack, full in a pane. */
  picture?: ReactNode
  /** What the place offers the plate. `detail` (show every setting in the pool) is the press on the plate itself; `pane` (open
   * full size in a pane) is the head's ⤢; the rest stand on the head by their marks. */
  actions?: readonly {icon: 'detail' | 'pane' | 'back' | 'cmd' | 'plus'; label: string; onPress: () => void}[]
  /** The host's own wrap for a control (Live maps a macro to a key or a MIDI control through it). */
  wrapRow?: (row: SdkParamRow, control: ReactNode) => ReactNode
}

export function DeviceView({device, size, picture, actions, wrapRow}: DeviceViewProps) {
  const drafts = useFaceDrafts(async changes => { if (!device.submit) throw Error('This device has no owner write'); await device.submit(changes) }, device.values)
  const {adopt} = drafts
  useEffect(() => { adopt(device.values as Record<string, ParamValue>) }, [device.values, adopt])
  const selected = useSelectedDeviceId()
  const [folded, setFolded] = useState(false)
  const [power, setPower] = useState<{pending: boolean; refusal: string | null}>({pending: false, refusal: null})
  const compact = size === 'compact'
  const rows = compact ? compactRows(device.rows) : device.rows
  const held = heldRows(device)
  const light = lightOf(device)
  const drawn = picture !== undefined && picture !== null && picture !== false
  const presentation = {family: device.family, faceId: device.face.id, title: device.face.title, icon: device.face.icon,
    owner: held.length ? `${device.family} · held by ${[...new Set(held.map(key => device.heldBy![key]))].join(', ')}` : device.family}
  // The plate's press: on the chain, choosing the device shows it whole in the pool; its head says so.
  const select = compact ? actions?.find(action => action.icon === 'detail') : undefined
  const marks = actions?.filter(action => action.icon !== 'detail')
    .map(action => ({icon: (action.icon === 'pane' ? 'full' : action.icon) as PlateMark, label: action.label, onPress: action.onPress}))
  // The ring turns the device only through the owner's write of the light's own row; it is inert while that write is in flight.
  const turn = powerToggle(device)
  const pressPower = turn && !power.pending ? () => {
    setPower({pending: true, refusal: null})
    device.submit!([turn]).then(
      () => setPower({pending: false, refusal: null}),
      cause => setPower({pending: false, refusal: cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'The owner refused the change.'}),
    )
  } : undefined
  const cell = (row: SdkParamRow) => {
    const node = <DeviceRow key={row.key} row={row} drafts={drafts} disabled={!device.submit || !row.writePath} heldBy={device.heldBy?.[row.key]}
      handBack={device.handBack ? () => void device.handBack!(row.key) : undefined} moved={wrapRow ? undefined : row.modulatedBy} />
    return <div key={row.key} className="device-cell" data-span={rowSpan(row)}>{wrapRow ? <Fragment>{wrapRow(row, node)}</Fragment> : node}</div>
  }
  const dirty = drafts.dirtyKeys().length > 0
  return <div className={`device device--${size}${compact && folded ? ' device--folded' : ''}`} data-device={device.id} data-device-size={size} data-device-light={light}
    style={compact ? {'--plate-w': `${plateWidth(rows, drawn, {title: presentation.title, owner: presentation.owner, marks: (marks?.length ?? 0) + 1})}px`} as CSSProperties : undefined}
    data-unsent={dirty ? 'true' : undefined}
    onPointerDownCapture={select ? () => select.onPress() : undefined} onFocusCapture={select ? () => select.onPress() : undefined}>
    <FacePlate presentation={presentation} power={light} onPower={pressPower} actions={marks} selected={compact && selected === device.id}
      hint={select?.label} folded={compact && folded} onFold={compact ? () => setFolded(was => !was) : undefined}>
      <div className="device-body" data-layout={compact && !rows.length ? 'picture' : 'beside'}>
        {drawn && <div className="device-picture">{picture}</div>}
        {compact
          ? rows.length > 0 && <div className="device-controls">{rows.map(cell)}</div>
          : <div className="device-groups">{groupRows(rows, device.face.title).map(group => <fieldset key={group.group} className="device-group"><legend>{group.group}</legend><div className="device-controls">{group.rows.map(cell)}</div></fieldset>)}</div>}
      </div>
      {power.refusal && <p className="device-refusal" role="alert">{power.refusal}</p>}
      {dirty && <div className="device-commit" role="group" aria-label="Unsent changes">
        <button type="button" onClick={() => void drafts.commit()}>Send</button>
        <button type="button" onClick={() => drafts.cancel()}>Cancel</button>
        {drafts.standing === 'refused' && <span role="alert">{drafts.refusal ? `${drafts.refusal} Your values are kept.` : 'The owner refused the change; your values are kept.'}</span>}
      </div>}
    </FacePlate>
  </div>
}

type Drafts = ReturnType<typeof useFaceDrafts>

/** One row in its cell. `moved` names what moves the value (a row's modulator) where the host does not draw its own line. */
function DeviceRow({row, drafts, disabled, heldBy, handBack, moved}: {row: SdkParamRow; drafts: Drafts; disabled: boolean; heldBy?: string; handBack?: () => void; moved?: string}) {
  const base = drafts.base[row.key], draft = drafts.drafts[row.key]
  const common = {param: row, onCommit: () => void drafts.commit(), onCancel: () => drafts.cancel(row.key), disabled}
  const body = !row.writePath
    ? <ReadingRow param={row} value={base} />
    : row.type === 'boolean'
      ? <BoolParam {...common} base={typeof base === 'boolean' ? base : undefined} draft={typeof draft === 'boolean' ? draft : undefined} onDraft={value => drafts.setDraft(row.key, value)} />
      : row.type === 'enumerated'
        ? <EnumParam {...common} base={typeof base === 'string' ? base : undefined} draft={typeof draft === 'string' ? draft : undefined} onDraft={value => drafts.setDraft(row.key, value)} presentation={enumPresentation(row)} />
        : <ScalarParam {...common} base={typeof base === 'number' ? base : undefined} draft={typeof draft === 'number' ? draft : undefined} onDraft={value => drafts.setDraft(row.key, value)} presentation="knob" />
  // Who moved it: the holder's name under the control, and the hand-back light (the specimen's `back` mark, lit in the stall
  // colour while someone else holds the value) that gives it back.
  return <div className="device-row" data-param={row.key} data-held-by={heldBy}>
    {body}
    {moved && <span className="device-moved" title={`${moved} moves this value`}>{moved}</span>}
    {heldBy && <span className="device-held">
      <button type="button" className="device-handback" title={`${heldBy} holds this value. Give it back`} aria-label={`Give ${row.title} back to ${heldBy}`} disabled={!handBack} onClick={handBack}><Icon name="back" size={10} /></button>
      <span className="device-holder" title={`${heldBy} holds this value`}>{heldBy}</span>
    </span>}
  </div>
}
