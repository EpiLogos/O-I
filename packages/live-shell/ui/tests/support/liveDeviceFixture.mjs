/**
 * The live-mode device walk's fixture owner — a minimal local stand-in for
 * the live-shell server's M3 device-edit seam (packages/live-shell/src/
 * main.rs routes over api.rs). It answers the three endpoints the device
 * panels build against, plus the /api/set reading the shell needs to open
 * a set:
 *
 *   GET  /api/set?path=...             {summary, document, revision}
 *   GET  /api/device-descriptors       { [element]: ParamDescJson[] }
 *   GET  /api/document/device-params   { params: ParamJson[] }
 *   POST /api/document/device-param    { param: ParamJson } | { error }
 *
 * Fixture data: the Compressor (document element `Compressor2`), Overdrive
 * and Redux (element `Redux2`) faces the UI round added. Rows are faithful
 * subsets of live-dynamics' own tables (packages/live-dynamics/src/
 * params.rs — COMPRESSOR / OVERDRIVE / REDUX): ids, ui names, stored
 * extents, units, kinds and the cited-preset readings; nothing is invented.
 * Writes are validated against the table's stored extent and answered with
 * the persisted reading, mirroring api.rs's law (out-of-range refused with
 * the law named; a row the fixture set does not carry refuses by name).
 */

import {createHash} from 'node:crypto'

/** The fixture set's identifier — opaque, like the .als path the real owner
 * reads. Clearly not a real file: nothing here touches disk. */
export const FIXTURE_SET_PATH = 'fixture:live-device-walk.als'
export const FIXTURE_TRACK = 'STIM'

/**
 * Descriptor tables — the live-dynamics row shape exactly as
 * `/api/device-descriptors` serializes it (api.rs `desc_json`): labels only
 * on discrete rows. The three faces' rows are the real tables' rows; the
 * other admitted elements the mounted panels reference (Glue/Echo/Reverb/
 * InstrumentVector) carry empty tables so those panels show their honest
 * "no … device in this set" hint instead of an eternal loading state.
 */
export const FIXTURE_TABLES = {
  Compressor2: [
    {id: 'On', ui_name: 'On', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle',
      notes: 'on/off, stored 0..1 (bool element in the preset XML); the cited preset stores true'},
    {id: 'Threshold', ui_name: 'Threshold', stored_min: 0.0003162277571, stored_max: 1.99526238, unit: '', kind: 'continuous',
      notes: 'amplitude-shaped stored extent (0.000316..1.995; the module\'s surface note claims no unit — the app displays dB); the cited preset stores 0.1791548878'},
    {id: 'Ratio', ui_name: 'Ratio', stored_min: 1, stored_max: 3.4028232635611926e38, unit: '', kind: 'continuous',
      notes: 'declared upper extent is the f32 sentinel (3.4028232635611926e38) — an unbounded stored extent, not a UI ratio; the cited preset stores 4'},
    {id: 'Attack', ui_name: 'Attack', stored_min: 0.009999999776, stored_max: 1000, unit: '', kind: 'continuous',
      notes: 'stored extent 0.009999999776..1000; the app displays ms — stored unit unresolved here; the cited preset stores 30'},
    {id: 'Release', ui_name: 'Release', stored_min: 1, stored_max: 3000, unit: '', kind: 'continuous',
      notes: 'stored extent 1..3000; the app displays ms — stored unit unresolved here; the cited preset stores 120'},
    {id: 'Gain', ui_name: 'Gain', stored_min: -36, stored_max: 36, unit: '', kind: 'continuous',
      notes: 'stored extent ±36; the app displays dB — stored unit unresolved here; the cited preset stores 3'},
    {id: 'DryWet', ui_name: 'Dry/Wet', stored_min: 0, stored_max: 1, unit: '', kind: 'continuous',
      notes: 'crossfade, not a sum; the cited preset stores 1'},
    {id: 'Model', ui_name: 'Model', stored_min: 0, stored_max: 0, unit: '', kind: 'discrete', labels: ['?'],
      notes: 'bare integer element — no menu structure or labels stored in the XML; only stored 0 observed across the cited evidence'},
  ],
  Overdrive: [
    {id: 'On', ui_name: 'On', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle',
      notes: 'on/off, stored 0..1 (bool element in the preset XML); the cited preset stores true'},
    {id: 'MidFreq', ui_name: 'Mid Freq', stored_min: 50, stored_max: 20000, unit: 'Hz', kind: 'continuous',
      notes: 'Hz by the crate name rule (the module\'s surface note); the cited preset stores 1596.93018'},
    {id: 'BandWidth', ui_name: 'Band Width', stored_min: 0.5, stored_max: 9, unit: '', kind: 'continuous',
      notes: 'stored extent 0.5..9; semantics unmeasured in this table; the cited preset stores 9'},
    {id: 'Drive', ui_name: 'Drive', stored_min: 0, stored_max: 100, unit: '', kind: 'continuous',
      notes: 'stored extent 0..100 (percent-shaped); the cited preset stores 100'},
    {id: 'DryWet', ui_name: 'Dry/Wet', stored_min: 0, stored_max: 100, unit: '', kind: 'continuous',
      notes: 'stored extent 0..100 (percent-shaped); the cited preset stores 100'},
    {id: 'Tone', ui_name: 'Tone', stored_min: 0, stored_max: 100, unit: '', kind: 'continuous',
      notes: 'stored extent 0..100 (percent-shaped); the cited preset stores 50'},
    {id: 'PreserveDynamics', ui_name: 'Preserve Dynamics', stored_min: 0, stored_max: 1, unit: '', kind: 'continuous',
      notes: 'stored extent 0..1 (declared MidiControllerRange); the module models a continuous amount; the cited preset stores 1'},
  ],
  Redux2: [
    {id: 'On', ui_name: 'On', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle',
      notes: 'on/off, stored 0..1 (bool element in the preset XML); the cited preset stores true'},
    {id: 'SampleRate', ui_name: 'Sample Rate', stored_min: 20, stored_max: 40000, unit: 'Hz', kind: 'continuous',
      notes: 'Hz by the crate name rule (the module\'s surface note); the cited preset stores 22491.3789'},
    {id: 'Jitter', ui_name: 'Jitter', stored_min: 0, stored_max: 1, unit: '', kind: 'continuous',
      notes: 'stored extent 0..1; the cited preset stores 0'},
    {id: 'BitDepth', ui_name: 'Bit Depth', stored_min: 1, stored_max: 16, unit: '', kind: 'continuous',
      notes: 'stored extent 1..16 — the extent corroborates bits; the cited preset stores 1'},
    {id: 'QuantizerShape', ui_name: 'Quantizer Shape', stored_min: 0, stored_max: 1, unit: '', kind: 'continuous',
      notes: 'stored extent 0..1; the cited preset stores 1'},
    {id: 'QuantizerDcShift', ui_name: 'Quantizer DC Shift', stored_min: 0, stored_max: 1, unit: '', kind: 'toggle',
      notes: 'on/off, stored 0..1 (bool element in the preset XML); the cited preset stores false'},
  ],
  GlueCompressor: [],
  Echo: [],
  Reverb: [],
  InstrumentVector: [],
}

/**
 * The fixture set's stored readings (the .als `Manual` values), with the
 * MidiControllerRange the document carries. `Model` is deliberately absent:
 * the cited set carries no Model element, so the Compressor panel renders
 * its honest "not stored in this document" row — the lossless-state law.
 */
const FIXTURE_STORED = {
  Compressor2: {
    On: {value: 'true'},
    Threshold: {value: '0.1791548878', min: '0.0003162277571', max: '1.99526238'},
    Ratio: {value: '4', min: '1', max: '3.4028232635611926e38'},
    Attack: {value: '30', min: '0.009999999776', max: '1000'},
    Release: {value: '120', min: '1', max: '3000'},
    Gain: {value: '3', min: '-36', max: '36'},
    DryWet: {value: '1', min: '0', max: '1'},
  },
  Overdrive: {
    On: {value: 'true'},
    MidFreq: {value: '1596.93018', min: '50', max: '20000'},
    BandWidth: {value: '9', min: '0.5', max: '9'},
    Drive: {value: '100', min: '0', max: '100'},
    DryWet: {value: '100', min: '0', max: '100'},
    Tone: {value: '50', min: '0', max: '100'},
    PreserveDynamics: {value: '1', min: '0', max: '1'},
  },
  Redux2: {
    On: {value: 'true'},
    SampleRate: {value: '22491.3789', min: '20', max: '40000'},
    Jitter: {value: '0', min: '0', max: '1'},
    BitDepth: {value: '16', min: '1', max: '16'},
    QuantizerShape: {value: '1', min: '0', max: '1'},
    QuantizerDcShift: {value: 'false'},
  },
}

const ELEMENTS = ['Compressor2', 'Overdrive', 'Redux2']

const summaryOf = () => ({
  path: FIXTURE_SET_PATH,
  tempo_bpm: 120,
  scene_count: 0,
  arrangement_clips: 0,
  tracks: [{kind: 'audio', name: FIXTURE_TRACK, devices: [...ELEMENTS]}],
})

const documentOf = (stored) => ({
  path: FIXTURE_SET_PATH,
  tempo: 120,
  scenes: 0,
  tracks: [{
    kind: 'audio',
    name: FIXTURE_TRACK,
    devices: ELEMENTS.map((element) => ({
      name: element,
      params: Object.entries(stored[element] ?? {}).map(([id, entry]) => ({
        id,
        value: entry.value,
        ...(entry.min !== undefined ? {min: entry.min} : {}),
        ...(entry.max !== undefined ? {max: entry.max} : {}),
      })),
    })),
    arrangementClips: [],
    sessionSlots: {},
  }],
})

function replyJson(response, status, body) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.statusCode = status
  response.end(JSON.stringify(body))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

/** api.rs `out_of_range` — the refusal names the law. */
function outOfRange(desc, value) {
  return desc.unit
    ? `value ${value} out of range for ${desc.id} (stored ${desc.stored_min}..=${desc.stored_max} ${desc.unit})`
    : `value ${value} out of range for ${desc.id} (stored ${desc.stored_min}..=${desc.stored_max})`
}

/**
 * The fixture owner. `handle(request, response, path)` returns true when it
 * answered (the shape `serveShellPage`'s `api` hook takes); it falls
 * through to the host's 404 for anything it does not own. `stored` is the
 * mutable set state, `posts` every POST body the route saw (the walk's
 * Node-side cross-check that the edit crossed the wire).
 */
export function createDeviceFixtureOwner() {
  const stored = structuredClone(FIXTURE_STORED)
  const posts = []
  const revision = () =>
    `sha256:${createHash('sha256').update(JSON.stringify([summaryOf(), documentOf(stored)])).digest('hex')}`

  const handle = async (request, response, path) => {
    if (path === '/favicon.ico') {
      response.statusCode = 204
      response.end()
      return true
    }
    const url = new URL(request.url ?? '/', 'http://fixture.local')
    const query = url.searchParams

    if (path === '/api/set' && request.method === 'GET') {
      const wanted = query.get('path')
      if (wanted !== FIXTURE_SET_PATH) {
        replyJson(response, 200, {error: `no set at "${wanted}"`})
        return true
      }
      replyJson(response, 200, {summary: summaryOf(), document: documentOf(stored), revision: revision()})
      return true
    }

    if (path === '/api/device-descriptors' && request.method === 'GET') {
      replyJson(response, 200, FIXTURE_TABLES)
      return true
    }

    if (path === '/api/document/device-params' && request.method === 'GET') {
      const wanted = query.get('path')
      const track = query.get('track')
      const device = query.get('device')
      if (wanted !== FIXTURE_SET_PATH) {
        replyJson(response, 200, {error: `no set at "${wanted}"`})
        return true
      }
      if (track !== FIXTURE_TRACK) {
        replyJson(response, 200, {error: `no track named "${track}" in the document`})
        return true
      }
      const table = FIXTURE_TABLES[device]
      if (!table || table.length === 0) {
        replyJson(response, 200, {error: `no parameter table for device element "${device}"`})
        return true
      }
      const params = []
      for (const desc of table) {
        const entry = stored[device]?.[desc.id]
        if (!entry) continue
        params.push({
          id: desc.id,
          value: entry.value,
          ...(entry.min !== undefined ? {min: entry.min} : {}),
          ...(entry.max !== undefined ? {max: entry.max} : {}),
        })
      }
      replyJson(response, 200, {params})
      return true
    }

    if (path === '/api/document/device-param' && request.method === 'POST') {
      let body
      try {
        body = JSON.parse(await readBody(request))
      } catch {
        replyJson(response, 200, {error: 'malformed device-param body'})
        return true
      }
      posts.push({...body, at: new Date().toISOString()})
      const {path: wanted, track, deviceName, paramId, value} = body ?? {}
      if (wanted !== FIXTURE_SET_PATH) {
        replyJson(response, 200, {error: `no set at "${wanted}"`})
        return true
      }
      if (track !== FIXTURE_TRACK) {
        replyJson(response, 200, {error: `no track named "${track}" in the document`})
        return true
      }
      const table = FIXTURE_TABLES[deviceName] ?? []
      const desc = table.find((row) => row.id === paramId)
      if (!desc) {
        replyJson(response, 200, {error: `${deviceName} has no stored parameter "${paramId}"`})
        return true
      }
      let persisted
      if (desc.kind === 'toggle') {
        if (typeof value !== 'boolean') {
          replyJson(response, 200, {error: `"${paramId}" is a toggle — value must be true or false`})
          return true
        }
        persisted = String(value)
      } else if (desc.kind === 'discrete') {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < desc.stored_min || value > desc.stored_max) {
          replyJson(response, 200, {error: typeof value === 'number' ? outOfRange(desc, value) : `"${paramId}" is a discrete menu — value must be a stored index`})
          return true
        }
        persisted = String(value)
      } else {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < desc.stored_min || value > desc.stored_max) {
          replyJson(response, 200, {error: typeof value === 'number' ? outOfRange(desc, value) : `"${paramId}" is continuous — value must be a number`})
          return true
        }
        persisted = String(value)
      }
      const entry = stored[deviceName]?.[paramId]
      if (!entry) {
        replyJson(response, 200, {error: `the set carries no "${paramId}" element under ${deviceName} on "${track}"`})
        return true
      }
      entry.value = persisted
      replyJson(response, 200, {
        param: {
          id: paramId,
          value: persisted,
          ...(entry.min !== undefined ? {min: entry.min} : {}),
          ...(entry.max !== undefined ? {max: entry.max} : {}),
        },
      })
      return true
    }

    return false
  }

  return {handle, posts, stored, summaryOf, documentOf: () => documentOf(stored), revision}
}
