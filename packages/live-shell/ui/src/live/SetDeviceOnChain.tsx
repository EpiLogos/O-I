// A device of the opened set on Live's chain, through the device runtime (FOUNDATION F5): the selected track's own devices stand
// after the torus, one plate each (lock §2.1: "the instrument's chain"). A device with the owner's stored-parameter table keeps
// the reads and writes its panel made (panels/devices/DevicePanel.tsx: the descriptor table once, the stored values for this
// track, each change posted to the Live document owner and the persisted value shown); any other device — and a faced one while
// its table is read or refused — reads the deep document's parameters losslessly and read-only (was the chain's device tile,
// components/DeviceChainPanel.tsx). Pressing a plate shows it whole in the pool, every parameter there. Its well holds its stored
// values, each on its range (SetDevicePicture.tsx), in every place the device is drawn.
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {DeviceView} from '../frame/devices/DeviceView'
import {selectDevice} from '../frame/devices/deviceDoor'
import {deviceDescriptors, fetchDeviceParams, postDeviceParam, type ParamDescJson} from '../panels/devices/api'
import {displayDeviceName, type SetParameter} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import {trackDeviceFaceTitle} from './liveChain'
import {setDeviceFaced, setDeviceId, setDeviceReading} from './liveChainDevices'
import {usePublishedDevice} from './usePublishedDevice'
import {SetDevicePicture, setValueMarks} from './SetDevicePicture'

interface FacedReading {
  descriptors: readonly ParamDescJson[] | null
  stored: Record<string, string>
  /** The owner's words when its table or its stored values could not be read. */
  fault: string | null
  write: (paramId: string, value: number | boolean) => Promise<void>
}

/** DevicePanel's reads and its write, for one device on one track (its `boundTrack`): nothing is read for a device the shell
 * has no table for. */
function useFacedDevice(set: SetSummary, track: string, elementName: string, faced: boolean): FacedReading {
  const [table, setTable] = useState<{rows: readonly ParamDescJson[] | null; fault: string | null} | null>(null)
  const [stored, setStored] = useState<{values: Record<string, string>; fault: string | null}>({values: {}, fault: null})
  const load = useRef(0)
  useEffect(() => {
    if (!faced) return
    let live = true
    deviceDescriptors().then(
      descriptors => { if (live) setTable({rows: descriptors[elementName] ?? null, fault: null}) },
      (cause: unknown) => { if (live) setTable({rows: null, fault: `The parameter tables could not be read: ${cause instanceof Error ? cause.message : String(cause)}`}) },
    )
    return () => { live = false }
  }, [faced, elementName])
  useEffect(() => {
    if (!table?.rows) { setStored({values: {}, fault: null}); return }
    const id = ++load.current
    fetchDeviceParams(set.path, track, elementName).then(
      map => { if (load.current === id) setStored({values: Object.fromEntries(Object.entries(map).map(([key, param]) => [key, param.value])), fault: null}) },
      (cause: unknown) => { if (load.current === id) setStored({values: {}, fault: `The stored values could not be read: ${cause instanceof Error ? cause.message : String(cause)}`}) },
    )
  }, [table, set.path, track, elementName])
  const write = useCallback(async (paramId: string, value: number | boolean) => {
    const persisted = await postDeviceParam(set.path, track, elementName, paramId, value)
    setStored(previous => ({...previous, values: {...previous.values, [paramId]: persisted.value}}))
  }, [set.path, track, elementName])
  return {descriptors: table?.rows ?? null, stored: stored.values, fault: table?.fault ?? stored.fault, write}
}

export function SetDeviceOnChain({set, track, trackIndex, index, elementName, params}: {
  set: SetSummary; track: string; trackIndex: number; index: number; elementName: string; params: readonly SetParameter[] | undefined
}) {
  const faceTitle = trackDeviceFaceTitle(elementName)
  const title = faceTitle ?? displayDeviceName(elementName)
  const faced = useFacedDevice(set, track, elementName, faceTitle !== undefined)
  const id = setDeviceId(trackIndex, index)
  const device = useMemo(() => faced.descriptors
    ? setDeviceFaced({id, elementName, title, descriptors: faced.descriptors, stored: faced.stored, fault: faced.fault, write: faced.write})
    : setDeviceReading({id, elementName, title, params, fault: faced.fault}),
  [id, elementName, title, faced.descriptors, faced.stored, faced.fault, faced.write, params])
  const marks = useMemo(() => setValueMarks(device, params), [device, params])
  const picture = useCallback((size: 'compact' | 'whole' | 'full') => <SetDevicePicture marks={marks} size={size} />, [marks])
  usePublishedDevice(id, device, picture)
  return <div className="chain-side" data-chain-device={elementName} data-set-device={faced.descriptors ? 'owner-table' : 'reading'}>
    <DeviceView device={device} size="compact" picture={<SetDevicePicture marks={marks} size="compact" />}
      actions={[{icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(id)}]} />
  </div>
}
