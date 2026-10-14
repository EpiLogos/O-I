/**
 * Device-parameter API client for the device panels.
 *
 * The Live document owner answers through the kernel when a kernel transport
 * exists (the native host, or a dev walk bridge): live_device_descriptors,
 * live_device_params_read and live_device_param_write. The in-tree 8787 seam
 * (packages/live-shell/src/api.rs, the same contract) answers only the plain
 * dev browser, which has no kernel transport:
 * - GET  /api/device-descriptors      → { [elementName]: ParamDescJson[] }
 * - GET  /api/document/device-params  → stored values of one device
 * - POST /api/document/device-param   → validate + set + write the set back
 *
 * Error convention (the shell's stable contract): the owner answers { error }
 * and these helpers throw it as an Error; a kernel refusal is thrown the same way.
 */
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../desktop/cradle/src/kernel/bridge'

/** One row of a live-dynamics parameter table (the backend serializes it). */
export interface ParamDescJson {
  id: string
  ui_name: string
  stored_min: number
  stored_max: number
  unit: string
  kind: 'continuous' | 'discrete' | 'toggle'
  labels?: string[]
  notes: string
}

export type DescriptorMap = Record<string, ParamDescJson[]>

/** One stored parameter as the document carries it (lossless value string). */
export interface ParamValueJson {
  id: string
  value: string
  min?: string
  max?: string
}

async function unwrapError(body: unknown): Promise<never> {
  const msg =
    body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : 'device API request failed'
  throw new Error(msg)
}

/** The kernel transport, when the host or a dev walk bridge carries one. */
function kernelTransport() {
  const transport = detectTransport()
  return transport.kind === 'unavailable' ? null : transport
}

/** The kernel's named reading for one device op; any other answer, or a refusal, is an Error. */
function kernelReading(answer: KernelOpCall, result: string): Record<string, unknown> {
  if (answer.outcome == null) throw new Error(answer.error ?? 'device API request failed')
  const outcome = answer.outcome as {result?: string} & Record<string, unknown>
  if (outcome.result !== result) throw new Error(`the kernel answered \`${outcome.result ?? 'unknown'}\`, not \`${result}\``)
  return outcome
}

let descriptorsPromise: Promise<DescriptorMap> | null = null

/** The panel devices' parameter tables, fetched once per page load. */
export function deviceDescriptors(): Promise<DescriptorMap> {
  if (!descriptorsPromise) {
    const transport = kernelTransport()
    descriptorsPromise = transport
      ? kernelOp(transport, {op: 'live_device_descriptors'}).then(
          answer => kernelReading(answer, 'live_device_descriptors_reading').descriptors as DescriptorMap,
        )
      : fetch('/api/device-descriptors').then(async (res) => {
          const body = await res.json()
          if (body && typeof body === 'object' && 'error' in body) return unwrapError(body)
          return body as DescriptorMap
        })
  }
  return descriptorsPromise
}

export function fetchDeviceParams(
  path: string,
  track: string,
  device: string,
): Promise<Record<string, ParamValueJson>> {
  const toMap = (params: ParamValueJson[]) => {
    const map: Record<string, ParamValueJson> = {}
    for (const p of params) map[p.id] = p
    return map
  }
  const transport = kernelTransport()
  if (transport) {
    return kernelOp(transport, {op: 'live_device_params_read', path, track, device}).then(answer =>
      toMap((kernelReading(answer, 'live_device_params_reading').reading as {params: ParamValueJson[]}).params),
    )
  }
  const q = `path=${encodeURIComponent(path)}&track=${encodeURIComponent(track)}&device=${encodeURIComponent(device)}`
  return fetch(`/api/document/device-params?${q}`).then(async (res) => {
    const body = await res.json()
    if (body && typeof body === 'object' && 'error' in body) return unwrapError(body)
    return toMap((body as { params: ParamValueJson[] }).params)
  })
}

/** Set one parameter; resolves to the persisted stored value. */
export function postDeviceParam(
  path: string,
  track: string,
  deviceName: string,
  paramId: string,
  value: number | boolean,
): Promise<ParamValueJson> {
  const transport = kernelTransport()
  if (transport) {
    return kernelOp(transport, {
      op: 'live_device_param_write',
      path,
      track,
      device_name: deviceName,
      param_id: paramId,
      value,
    }).then(
      answer => (kernelReading(answer, 'live_device_param_written').reading as {param: ParamValueJson}).param,
    )
  }
  return fetch('/api/document/device-param', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path,
      track,
      deviceName,
      paramId,
      value,
    }),
  }).then(async (res) => {
    const body = await res.json()
    if (body && typeof body === 'object' && 'error' in body) return unwrapError(body)
    return (body as { param: ParamValueJson }).param
  })
}
