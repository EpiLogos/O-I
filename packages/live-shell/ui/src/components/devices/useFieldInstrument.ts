// The Field published on the door (manual §20.2, §20.3): built over the field devices the Studio already holds (useFieldDevices) and the
// frame's object sound, so the Studio's Full draws it at its place — its controls, then the Field, then each chain — and a pane, the
// pool and the rail draw the same Field on the same owners (fieldInstrument.ts). No reading, no Field: like its devices, it is the
// owner's reading of the open work, never a default.
import {useEffect, useMemo, useRef} from 'react'
import type {NativeEditorChange, NativeEditorReading} from '@epilogos/expressions-boundary/editor'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {frameSoundReading, setExpressionMuted} from '../../native/frameSound'
import {useFrameTakeLink} from '../../native/frameTakes'
import type {Apply} from '../nativeDeviceCustody'
import {claimDevice, type DeviceClaim} from './devicePublication'
import {FIELD_DEVICE, FIELD_DEVICE_ID, fieldBinding, fieldSoundWhy, type FieldDevices, type FieldSound} from './fieldInstrument'

/** The Field over the Studio's field devices and the editor's one apply, published while a native Expression is open. Returns its binding. */
export function useFieldInstrument(devices: readonly {readonly family: string; readonly device: DeviceInstance | null}[],
  host: {readonly reading: NativeEditorReading | null; readonly apply: Apply; readonly locked: boolean}) {
  const link = useFrameTakeLink()
  const {reading, apply, locked} = host
  const presented = link.state?.nativeScene?.expression_ref ?? null
  const muted = frameSoundReading(link).muted
  const sound: FieldSound = useMemo(() => {
    const why = fieldSoundWhy(link)
    return {muted, mute: why || !presented ? null : (next: boolean) => setExpressionMuted(link, presented, next), ...(why ? {why} : {})}
  }, [link, presented, muted])
  const held: FieldDevices = useMemo(() => Object.fromEntries(devices.map(entry => [entry.family, entry.device])), [devices])
  // The editor's apply is read at each press, as the field devices read it (useFieldDevices): the binding changes only with what it reads.
  const latest = useRef(apply)
  latest.current = apply
  const binding = useMemo(() => reading ? fieldBinding({reading, devices: held, sound,
    apply: locked ? null : (changes: NativeEditorChange[]) => latest.current(changes, reading.basis)}) : null, [reading, held, sound, locked])
  const claim = useRef<DeviceClaim | null>(null)
  useEffect(() => {
    const mine = claimDevice(FIELD_DEVICE_ID)
    claim.current = mine
    return () => { mine.release(); claim.current = null }
  }, [])
  useEffect(() => {
    if (binding) claim.current?.publish({device: FIELD_DEVICE, binding})
    else claim.current?.release()
  }, [binding])
  return binding
}
