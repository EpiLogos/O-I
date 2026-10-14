// The Expressions field devices, drawn through the device runtime in all three sizes (FOUNDATION F5; manual §10.4):
// compact on the rack the person adds to (`ExpressionsRackDevice`, mounted by components/NativeDeviceRack.tsx), whole in the
// browser's pool (`ExpressionsFieldWhole`), full in a pane (frame/devices/devicePane.tsx reads the device this module publishes
// to the door). All three are `DeviceView` over the one `DeviceInstance` that `expressionsFieldDevice` builds from the retained
// editor's reading, and all three write through the one `apply` of the editor — so a change in any size is the same change.
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {sameEditorBasis, type NativeEditorBasis, type NativeEditorChange, type NativeEditorReading, type NativeEditorReply, type NativeEditorRequest} from '@epilogos/expressions-boundary/editor'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import type {DeviceInstance, DeviceSize} from '../../frame/devices/deviceRuntime'
import {DeviceView} from '../../frame/devices/DeviceView'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import {openInstrument} from '../../frame/instrumentDoor'
import {useNativeInputRetention} from '../../continuity/nativeInputContext'
import type {Apply, CaptureCurrent} from '../nativeDeviceCustody'
import {modulationOf, modulationView} from '../nativeModulation'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import {claimDevice, type DeviceClaim} from './devicePublication'
import {expressionsDeviceId, expressionsFieldDevice, expressionsFieldEntry, inCompactOrder, type FieldDeviceSend} from './expressionsDevice'
import {fieldDeviceSend} from './fieldDeviceSend'
import {ExpressionsPicture, hasPicture} from './ExpressionsPicture'
import {ModulationLine} from './ModulationLine'
import './expressionsDevices.css'

/** What a place that holds a field device gives it: the reading, the editor's one apply, and whether the work is taking edits now. */
export interface FieldHost {
  readonly reading: NativeEditorReading
  readonly apply: Apply
  readonly captureCurrent: CaptureCurrent
  /** The work is busy, or waiting on the owner's acknowledgement: every row is a reading until it answers. */
  readonly locked: boolean
}

const sceneKeyOf = (reading: NativeEditorReading): string => `${reading.basis.expression_ref}|${reading.basis.scene_ref}`
const messageOf = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

/** The target a row writes (`field.<key>`), for the rows that are native parameters; null for the device's switches. */
function targetOf(row: SdkParamRow): string | null {
  const found = NATIVE_BINDINGS.find(binding => binding.path === row.key)
  return found ? 'field.' + found.key : null
}

/** A row whose value something moves carries the line that says what (modulation honesty, WORLD-SHELL-DESIGN §14). */
export function modulationWrap(reading: NativeEditorReading) {
  return (row: SdkParamRow, control: ReactNode): ReactNode => {
    const target = targetOf(row)
    const modulation = target ? modulationOf(reading, target) : null
    return modulation && modulationView(modulation)
      ? <div className="expr-control" data-modulated="true">{control}<ModulationLine modulation={modulation} /></div>
      : control
  }
}

/** Open the device full size in a pane; the fault in words when no pane tree is mounted to open it in. */
export function openFieldDeviceFull(family: string, title: string): string | null {
  try {
    openInstrument(DEVICE_PANE_KIND, undefined, {ref: expressionsDeviceId(family), title})
    return null
  } catch (cause) {
    return messageOf(cause)
  }
}

/** The device for a host: only readings while the work is busy or waiting on the owner's acknowledgement, else the device that writes. */
export function hostedFieldDevice(family: string, host: Pick<FieldHost, 'reading' | 'locked'>, send: FieldDeviceSend): DeviceInstance | null {
  return expressionsFieldDevice(host.reading, family, host.locked ? null : send)
}

/** The device, its picture, and its place at the door. The device is rebuilt from the reading, never kept: nothing of the owner's is held here. */
export function useFieldDevice(family: string, host: FieldHost) {
  return useFieldDevices(useMemo(() => [family], [family]), host)[0]!
}

/** Several field devices over one host at once (the Studio's sections hold eleven): each built as `useFieldDevice` builds one — the
 * same send through the host's one apply, the same picture, the same claim at the door — so a device in the Studio is the device on
 * the rack, in the pool and in a pane. `families` is a fixed list for the life of the caller. */
export function useFieldDevices(families: readonly string[], host: Omit<FieldHost, 'reading'> & {readonly reading: NativeEditorReading | null}): {family: string; id: string; device: DeviceInstance | null; picture: (size: DeviceSize) => ReactNode}[] {
  const aperture = useNativeInputRetention()
  const latest = useRef({host, aperture})
  latest.current = {host, aperture}
  const key = families.join('|')
  const sends = useMemo(() => new Map(families.map(family => [family, fieldDeviceSend(family, {
    apply: (changes, basis) => latest.current.host.apply(changes, basis),
    captureCurrent: () => latest.current.host.captureCurrent(),
    aperture: () => latest.current.aperture,
  })])), [key])
  const pictures = useMemo(() => new Map(families.map(family => [family, (size: DeviceSize): ReactNode => {
    const now = latest.current
    // A picture is asked for only of a device that stands, and a device stands only over a reading.
    return now.host.reading ? <ExpressionsPicture family={family} size={size} reading={now.host.reading} apply={now.host.apply} captureCurrent={now.host.captureCurrent}
      disabled={now.host.locked} aperture={now.aperture} /> : null
  }])), [key])
  // No reading, no device: a field device is the owner's reading of the open work, never a default.
  const devices = useMemo(() => families.map(family => ({family, id: expressionsDeviceId(family),
    device: host.reading ? hostedFieldDevice(family, {reading: host.reading, locked: host.locked}, sends.get(family)!) : null, picture: pictures.get(family)!})),
  [host.reading, host.locked, sends, pictures])
  const claims = useRef(new Map<string, DeviceClaim>())
  useEffect(() => {
    const held = new Map(families.map(family => [family, claimDevice(expressionsDeviceId(family))]))
    claims.current = held
    return () => { for (const claim of held.values()) claim.release(); claims.current = new Map() }
  }, [key])
  useEffect(() => { for (const entry of devices) if (entry.device) claims.current.get(entry.family)?.publish({device: entry.device, picture: entry.picture}) }, [devices])
  return devices
}

/** The field device on the rack: compact, with its summary line above and the modulation lines under the controls it moves. The card's
 * own head (light, fold, title, reorder, remove) is the device's title row there; the plate's head is hidden by expressionsDevices.css. */
export function ExpressionsRackDevice({family, summary, host}: {family: string; summary: string; host: FieldHost}) {
  const {device, picture} = useFieldDevice(family, host)
  const entry = expressionsFieldEntry(family)
  const compact = useMemo(() => device && entry ? inCompactOrder(device, entry) : null, [device, entry])
  const wrapRow = useMemo(() => modulationWrap(host.reading), [host.reading])
  if (!compact) return null
  return <div className="expr-device" data-expr-device={compact.id}>
    <p className="native-rack-summary" title={summary}>{summary}</p>
    <DeviceView key={sceneKeyOf(host.reading)} device={compact} size="compact" picture={hasPicture(family, 'compact') ? picture('compact') : undefined} wrapRow={wrapRow} />
  </div>
}

// ---------------------------------------------------------------------------
// the pool: the whole device, over the editor the pool is handed

/** The editor's one apply for a place that does not hold the rack: the same lock and the same capture of the basis the rack uses
 * (components/NativeDeviceRack.tsx lines 33-71), so a pool edit is refused and retained the way a rack edit is. */
export function useEditorApply(reading: NativeEditorReading | null, request: (request: NativeEditorRequest) => Promise<NativeEditorReply>) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false), mounted = useRef(true), live = useRef(reading)
  live.current = reading
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const apply: Apply = async (changes: readonly NativeEditorChange[], basis?: NativeEditorBasis): Promise<NativeEditorReply> => {
    const current = live.current
    if (!current) return {ok: false, error: 'Read the native work before editing it.'}
    if (inFlight.current) return {ok: false, error: 'Wait for the current native acknowledgement.'}
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const reply = await request({operation: 'apply', basis: basis ?? current.basis, changes})
      if (mounted.current && !reply.ok) setError(reply.error)
      return reply
    } catch (cause) {
      const message = messageOf(cause)
      if (mounted.current) setError(message)
      return {ok: false, error: message}
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const sameTarget = (a: NativeEditorBasis, b: NativeEditorBasis) => a.expression_ref === b.expression_ref && a.scene_ref === b.scene_ref
  const captureCurrent: CaptureCurrent = () => {
    const captured = live.current?.basis ?? null
    return reply => {
      const now = live.current?.basis
      if (!mounted.current || !captured || !now) return false
      if (reply === undefined) return sameEditorBasis(captured, now)
      if (!reply.ok) return sameTarget(captured, now)
      return sameTarget(captured, reply.reading.basis) && sameTarget(captured, now)
    }
  }
  return {apply, captureCurrent, locked: busy || !reading || reading.standing.pending, error}
}

function FieldWhole({reading, request, family}: {reading: NativeEditorReading; request: (request: NativeEditorRequest) => Promise<NativeEditorReply>; family: string}) {
  const editor = useEditorApply(reading, request)
  const [fault, setFault] = useState<string | null>(null)
  const {device, picture} = useFieldDevice(family, {reading, apply: editor.apply, captureCurrent: editor.captureCurrent, locked: editor.locked})
  const wrapRow = useMemo(() => modulationWrap(reading), [reading])
  if (!device) return <p className="native-empty">{family} is not a field device of this shell.</p>
  const title = device.face.title
  const shown = fault ?? editor.error
  return <div className="expr-whole" data-expr-whole={family}>
    {shown && <p className="native-rack-error" role="alert">{shown}</p>}
    <DeviceView key={sceneKeyOf(reading)} device={device} size="whole" picture={picture('whole')} wrapRow={wrapRow}
      actions={[{icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => setFault(openFieldDeviceFull(family, title))}]} />
  </div>
}

/** The field device whole, for the pool under the browser (manual §10.3: "Changes you make in the pool apply at once and do not add the
 * device to your rack"). It reads the same retained editor the rack reads and writes through its one apply. */
export function ExpressionsFieldWhole({reading, request, family}: {reading: NativeEditorReading | null; request: (request: NativeEditorRequest) => Promise<NativeEditorReply>; family: string}) {
  if (!reading) return <p className="native-empty">Open a native Expression to see this device.</p>
  return <FieldWhole reading={reading} request={request} family={family} />
}

