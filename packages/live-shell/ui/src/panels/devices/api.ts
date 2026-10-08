/**
 * Device-parameter API client for the device panels.
 *
 * Endpoints (packages/live-shell/src/api.rs — the M3 editing surface):
 * - GET  /api/device-descriptors      → { [elementName]: ParamDescJson[] }
 * - GET  /api/document/device-params  → stored values of one device
 * - POST /api/document/device-param   → validate + set + write the set back
 *
 * Error convention (the shell's stable contract): the server answers
 * { error } and these helpers throw it as an Error.
 */

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

let descriptorsPromise: Promise<DescriptorMap> | null = null

/** The panel devices' parameter tables, fetched once per page load. */
export function deviceDescriptors(): Promise<DescriptorMap> {
  if (!descriptorsPromise) {
    descriptorsPromise = fetch('/api/device-descriptors').then(async (res) => {
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
  const q = `path=${encodeURIComponent(path)}&track=${encodeURIComponent(track)}&device=${encodeURIComponent(device)}`
  return fetch(`/api/document/device-params?${q}`).then(async (res) => {
    const body = await res.json()
    if (body && typeof body === 'object' && 'error' in body) return unwrapError(body)
    const map: Record<string, ParamValueJson> = {}
    for (const p of (body as { params: ParamValueJson[] }).params) map[p.id] = p
    return map
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
