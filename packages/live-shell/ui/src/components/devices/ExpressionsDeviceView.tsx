// The Expressions field devices, drawn through the device runtime in all three sizes (FOUNDATION F5; manual §10.4):
// compact on the rack the person adds to (`ExpressionsRackDevice`, mounted by components/NativeDeviceRack.tsx), whole in the
// browser's pool (`ExpressionsFieldWhole`), full in a pane (frame/devices/devicePane.tsx reads the device this module publishes
// to the door). All three are `DeviceView` over the one `DeviceInstance` that `expressionsFieldDevice` builds from the retained
// editor's reading with the Studio of the kernel's Set laid over it, and all three write through the Studio's one act (O-I ticket
// 1008; fieldDeviceSend.ts studioApply) — so a change in any size is the same change.
import {useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
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
import {expressionsDeviceId, expressionsFieldDevice, expressionsFieldEntry, inCompactOrder, studioReading, type FieldDeviceDrag, type FieldDeviceSend} from './expressionsDevice'
import {fieldDeviceSend, studioApply, studioDrag, studioHolds, type StudioDrag, type WorkStudio} from './fieldDeviceSend'
import {Workspace} from '../../shell/workspaceContext'
import {useModeSet} from '../../owners/modeSets'
import {runAct, setActRunner} from '../../frame/tracks/kernelSet'
import {ExpressionsPicture, hasPicture} from './ExpressionsPicture'
import {ModulationLine} from './ModulationLine'
import {PHYSICS_KEYS, physicsDesignBinding, type PhysicsPress} from './physicsBinding'
import {bodySourceOf, fieldDesignBinding as familyDesignBinding, isFieldDesignFamily, resonanceBodyRows, withAutomationLanes, type FieldLanes} from './fieldDesignBinding'
import type {DesignBinding, Value} from '../../frame/devices/designed'
import {dispatchNativeEngineCommand, engineCommandReason, readNativeEngineMounted} from '../../native/engineCommand'
import './expressionsDevices.css'
import type {FrameInstrumentCondition} from '@epilogos/expressions-boundary'
import {useBodyTable, useCoordinateName, type BodyTable, type CoordinateName} from '../../inhabitants/ql/devices/qlCoordinateName'
import {useHolds} from '../../techne/devices/designDevices'
import {useHostedChrome} from '../../projections/expressionsPaneHost'

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
    // A field device's Full never covers the field it edits (round 896, item 0.1): beside it when the field is the target pane's front.
    openInstrument(DEVICE_PANE_KIND, 'beside-field', {ref: expressionsDeviceId(family), title})
    return null
  } catch (cause) {
    return messageOf(cause)
  }
}

/** The device for a host: only readings while the work is busy or waiting on the owner's acknowledgement, else the device that writes. */
export function hostedFieldDevice(family: string, host: Pick<FieldHost, 'reading' | 'locked'>, send: FieldDeviceSend, drag: FieldDeviceDrag | null = null): DeviceInstance | null {
  return expressionsFieldDevice(host.reading, family, host.locked ? null : send, drag)
}

/** The Studio the kernel's Expressions Set gives a work (O-I ticket 1008): its track's Studio (the values and settings of the Scene it has
 * selected, and the act that writes them), whether a take records on that Scene, the track's Re-enable, and the runner of its acts. Null
 * while the Set holds no Studio of the work: then nothing of the field devices writes. */
export function useWorkStudio(expressionRef: string | null): WorkStudio | null {
  const transport = useContext(Workspace)?.transport ?? null
  const set = useModeSet(transport, 'expressions')
  const runner = useMemo(() => transport ? setActRunner(transport) : null, [transport])
  return useMemo(() => {
    if (!expressionRef || !runner || set.state !== 'held') return null
    const track = set.answer.set.tracks.find(row => row.id === expressionRef)
    const studio = track?.studio
    if (!studio) return null
    const recording = set.answer.set.clips.some(clip => clip.track === expressionRef && clip.id === studio.scene_ref && clip.status === 'recording')
    return {expression_ref: expressionRef, studio, recording, reenable: track.acts?.reenable ?? null, runner}
  }, [expressionRef, runner, set])
}

/** A host's reading with its work's Studio laid over it, and the write each change is: what the Studio takes through its act, the rest
 * through the host's own apply (fieldDeviceSend.ts studioApply). Read at each press, so a new reading or Set never strands a write. */
export function useStudioHost<H extends {readonly reading: NativeEditorReading | null; readonly apply: Apply}>(host: H): {reading: NativeEditorReading | null; apply: Apply; work: WorkStudio | null} {
  const work = useWorkStudio(host.reading?.basis.expression_ref ?? null)
  const reading = useMemo(() => host.reading ? studioReading(host.reading, work?.studio ?? null) : null, [host.reading, work])
  const latest = useRef({host, work})
  latest.current = {host, work}
  const apply = useMemo<Apply>(() => (changes, basis) =>
    studioApply({reading: latest.current.host.reading, apply: latest.current.host.apply}, latest.current.work, changes, basis ?? latest.current.host.reading?.basis ?? EMPTY_BASIS), [])
  return {reading, apply, work}
}
const EMPTY_BASIS = {expression_ref: '', revision: 0, scene_ref: '', authored_revision: 0} as NativeEditorBasis

/** The device, its picture, and its place at the door. The device is rebuilt from the reading, never kept: nothing of the owner's is held here. */
export function useFieldDevice(family: string, host: FieldHost) {
  return useFieldDevices(useMemo(() => [family], [family]), host)[0]!
}

/** Several field devices over one host at once (the Studio's sections hold eleven): each built as `useFieldDevice` builds one — the
 * same send through the host's one apply, the same picture, the same claim at the door — so a device in the Studio is the device on
 * the rack, in the pool and in a pane. `families` is a fixed list for the life of the caller. */
export function useFieldDevices(families: readonly string[], given: Omit<FieldHost, 'reading'> & {readonly reading: NativeEditorReading | null}): {family: string; id: string; device: DeviceInstance | null; picture: (size: DeviceSize) => ReactNode}[] {
  const aperture = useNativeInputRetention()
  // Each value a device shows is the Studio the kernel's Set gives its Scene, and each change one write of the Studio's act (O-I ticket 1008).
  const studio = useStudioHost(given)
  const host = useMemo(() => ({...given, reading: studio.reading}), [given, studio.reading])
  const chrome = useHostedChrome()
  const stageRun = chrome?.run ?? null
  const latest = useRef({host, aperture, studio, stageRun})
  latest.current = {host, aperture, studio, stageRun}
  const key = families.join('|')
  // A drag previews on the field and lands in a take that records; its release is the one write, through the send below.
  const drags = useMemo(() => new Map<string, StudioDrag>(families.map(family => [family, studioDrag(() => ({
    run: latest.current.stageRun, work: latest.current.studio.work,
    automated: target => { const lanes = latest.current.host.reading?.scene?.automation; return Array.isArray(lanes) && lanes.some(lane => lane.target === target && lane.enabled) },
    revision: () => latest.current.host.reading?.basis.revision ?? null,
  }))])), [key])
  const sends = useMemo(() => new Map(families.map(family => [family, fieldDeviceSend(family, {
    apply: (changes, basis) => { const reply = latest.current.studio.apply(changes, basis); drags.get(family)?.settled(reply); return reply },
    captureCurrent: () => latest.current.host.captureCurrent(),
    aperture: () => latest.current.aperture,
  })])), [key, drags])
  const pictures = useMemo(() => new Map(families.map(family => [family, (size: DeviceSize): ReactNode => {
    const now = latest.current
    // A picture is asked for only of a device that stands, and a device stands only over a reading.
    return now.host.reading ? <ExpressionsPicture family={family} size={size} reading={now.host.reading} apply={now.studio.apply} captureCurrent={now.host.captureCurrent}
      disabled={now.host.locked} aperture={now.aperture} /> : null
  }])), [key])
  // No reading, no device: a field device is the owner's reading of the open work, never a default. A family whose catalogue design
  // draws on value keys the engine reports publishes its binding with it (fieldDesignBinding), and the design draws in every place.
  // Resonance's tattva: the live scene's M2 condition the frame announces, and the map's name for its coordinate (qlCoordinateName.ts).
  const condition = chrome?.state?.instrumentCondition ?? null
  // The scene's lanes and the values the kernel holds off them (manual §20.1 Rules; the Set's Studio `held`): each value shows what moves
  // it, and its hand-back, the track's Re-enable of that one value. Keyed by what the Set says, so the same holds keep every binding.
  const work = studio.work
  const holdsKey = JSON.stringify(studioHolds(work, host.reading?.basis ?? null))
  const reenableAct = work?.reenable ?? null, runner = work?.runner ?? null
  const lanes = useMemo<FieldLanes>(() => ({run: stageRun, holds: JSON.parse(holdsKey) as FieldLanes['holds'],
    reenable: reenableAct && runner ? (target: string) => runAct(runner, reenableAct, target).then(receipt => { if (!receipt.ok) throw new Error(receipt.error) }) : null}),
  [stageRun, holdsKey, reenableAct, runner])
  const tattvaName = useCoordinateName(condition?.tattva_ref ?? null)
  // Resonance's Body source: M2's body constants (QL's table) and the hand's choice of source (fieldDesignBinding.ts resonanceBody).
  const bodyTable = useBodyTable()
  const holds = useHolds()
  const devices = useMemo(() => families.map(family => {
    const device = host.reading ? hostedFieldDevice(family, {reading: host.reading, locked: host.locked}, sends.get(family)!, drags.get(family)!) : null
    const binding = device ? fieldDesignBinding(family, device, host.reading, sends.get(family) ?? null,
      {condition, name: tattvaName, table: bodyTable, held: holds[expressionsDeviceId(family)] ?? {}}, lanes) : undefined
    return {family, id: expressionsDeviceId(family), device, picture: pictures.get(family)!, ...(binding ? {binding} : {})}
  }), [host.reading, host.locked, sends, pictures, condition, tattvaName, bodyTable, holds, lanes])
  // Under Tattva the plate follows the tattva: when the condition's fibre moves, its rows are written again (once per target).
  const followed = useRef('')
  useEffect(() => {
    const entry = devices.find(item => item.family === 'resonance')
    if (!entry?.device?.submit) return
    const rows = resonanceBodyRows(entry.device, condition, bodyTable, bodySourceOf(holds[entry.id] ?? {}))
    const target = JSON.stringify(rows)
    if (!rows.length) { followed.current = ''; return }
    if (target === followed.current) return
    followed.current = target
    void entry.device.submit(rows).catch(() => { followed.current = '' })
  }, [devices, condition, bodyTable, holds])
  const claims = useRef(new Map<string, DeviceClaim>())
  useEffect(() => {
    const held = new Map(families.map(family => [family, claimDevice(expressionsDeviceId(family))]))
    claims.current = held
    return () => { for (const claim of held.values()) claim.release(); claims.current = new Map() }
  }, [key])
  useEffect(() => { for (const entry of devices) if (entry.device) claims.current.get(entry.family)?.publish({device: entry.device, picture: entry.picture, ...(entry.binding ? {binding: entry.binding} : {})}) }, [devices])
  return devices
}

/** The engine's runtime action, run by the mounted Expressions panel as one engine command (native/engineCommand.ts); refused in words
 * while no native Expression is mounted. */
const enginePress: PhysicsPress = action => {
  const reason = engineCommandReason({mounted: readNativeEngineMounted(), busy: false})
  if (reason) throw new Error(reason)
  dispatchNativeEngineCommand(action === 'reset' ? {action: 'reset', confirmed: true} : {action})
}

/** The binding of a field family's catalogue design, where the design draws on the engine's own readings: Physics (lane BE), and every
 * other field family on its engine paths (fieldDesignBinding.ts, R5). The Field (`expressions:field`) is no family of the rack: it is the front
 * of these devices and the frame's object sound, published at the Studio's head by useFieldInstrument.ts (fieldInstrument.ts). */
export function fieldDesignBinding(family: string, device: DeviceInstance, reading: NativeEditorReading | null, send: FieldDeviceSend | null = null,
  tattva: {condition?: FrameInstrumentCondition | null; name?: CoordinateName | null; table?: BodyTable | null; held?: Readonly<Record<string, Value>>} = {},
  lanes: FieldLanes | null = null): DesignBinding | undefined {
  const binding = familyBinding(family, device, reading, send, tattva)
  // The lanes of the scene, where the frame is there to say what it holds (manual §20.1 Rules; withAutomationLanes).
  return binding && lanes ? withAutomationLanes(binding, device, reading, lanes, family === 'physics' ? PHYSICS_KEYS : null) : binding
}
function familyBinding(family: string, device: DeviceInstance, reading: NativeEditorReading | null, send: FieldDeviceSend | null,
  tattva: {condition?: FrameInstrumentCondition | null; name?: CoordinateName | null; table?: BodyTable | null; held?: Readonly<Record<string, Value>>}): DesignBinding | undefined {
  if (family === 'physics') return physicsDesignBinding(device, reading, enginePress)
  return isFieldDesignFamily(family) ? familyDesignBinding(family, device, reading, send, tattva) : undefined
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

