import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// The Live document owner's transport choice (owner-service census, gate 4).
// With a kernel transport (here a dev walk bridge: the same KernelOp seam over
// HTTP) the device panels and the set reader ask the owner through kernelOp;
// with no kernel transport they keep the 8787 seam of the plain dev browser.
// The bridge's /op route is answered by a fixture owner that serves the
// contract shapes the kernel serves (kernel/src/live_set_owner.rs).
//
// Production sources in memory, same loader pattern as the sibling tests:
// .ts/.tsx transpiled, the cross-tree imports resolved to their .ts files.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, { parentURL: import.meta.url })

const BRIDGE = 'http://bridge.test'
const SET_PATH = '/music/x.als'
const REVISION = `sha256:${'a'.repeat(64)}`
const originalFetch = globalThis.fetch
const calls = []

/** Record every request and answer it from `respond`, as JSON. */
function installFetch(respond) {
  calls.length = 0
  globalThis.fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({url: String(url), method: init.method ?? 'GET', body})
    return new Response(JSON.stringify(respond(String(url), body)), {headers: {'content-type': 'application/json'}})
  }
}

/** The fixture owner behind the bridge: the kernel's own result shapes. */
function ownerAnswer(op) {
  switch (op.op) {
    case 'live_device_params_read':
      return {ok: true, outcome: {result: 'live_device_params_reading', reading: {params: [{id: 'Threshold', value: '0.5', min: '0', max: '2'}]}}}
    case 'live_device_param_write':
      if (op.value > 2) return {ok: false, error: `value ${op.value} out of range for ${op.param_id} (stored 0.0003..=1.9952)`}
      return {ok: true, outcome: {result: 'live_device_param_written', reading: {param: {id: op.param_id, value: String(op.value)}}}}
    case 'live_device_descriptors':
      return {ok: true, outcome: {result: 'live_device_descriptors_reading', descriptors: {Compressor2: [{id: 'Threshold', ui_name: 'Threshold', stored_min: 0.0003, stored_max: 1.9952, unit: '', kind: 'continuous', notes: ''}]}}}
    case 'live_set_read':
      return {ok: true, outcome: {result: 'live_set_reading', reading: {summary: {path: op.path, tempo_bpm: 131, scene_count: 1, arrangement_clips: 0, tracks: []}, document: {path: op.path, tempo: 131, tracks: [], scenes: 1}, revision: REVISION}}}
    default:
      return {ok: false, error: `unexpected op ${op.op}`}
  }
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
  delete globalThis.window
})

test('the device panels read and write through the kernel when a kernel transport exists', async () => {
  globalThis.window = {__OI_KERNEL_BRIDGE__: BRIDGE}
  installFetch((url, body) => (url === `${BRIDGE}/op` ? ownerAnswer(body) : {error: `unexpected route ${url}`}))
  const api = await import('../src/panels/devices/api.ts')

  const map = await api.fetchDeviceParams(SET_PATH, 'Master', 'Compressor2')
  assert.equal(map.Threshold.value, '0.5')
  assert.deepEqual(calls[0].body, {op: 'live_device_params_read', path: SET_PATH, track: 'Master', device: 'Compressor2'})

  const param = await api.postDeviceParam(SET_PATH, 'Master', 'Compressor2', 'Threshold', 0.25)
  assert.equal(param.value, '0.25')
  assert.deepEqual(calls[1].body, {op: 'live_device_param_write', path: SET_PATH, track: 'Master', device_name: 'Compressor2', param_id: 'Threshold', value: 0.25})

  await assert.rejects(api.postDeviceParam(SET_PATH, 'Master', 'Compressor2', 'Threshold', 3), /out of range for Threshold/)

  const descriptors = await api.deviceDescriptors()
  assert.equal(descriptors.Compressor2[0].id, 'Threshold')
  assert.deepEqual(calls.map(call => call.url), [`${BRIDGE}/op`, `${BRIDGE}/op`, `${BRIDGE}/op`, `${BRIDGE}/op`])
})

test('the plain dev browser keeps the 8787 seam when no kernel transport exists', async () => {
  installFetch((url, body) => {
    if (url.startsWith('/api/document/device-params?')) return {params: [{id: 'Threshold', value: '0.5'}]}
    if (url === '/api/document/device-param') return {param: {id: body.paramId, value: String(body.value)}}
    return {error: `unexpected route ${url}`}
  })
  const api = await import('../src/panels/devices/api.ts')

  const map = await api.fetchDeviceParams(SET_PATH, 'Master', 'Compressor2')
  assert.equal(map.Threshold.value, '0.5')
  assert.match(calls[0].url, /^\/api\/document\/device-params\?path=/)

  const param = await api.postDeviceParam(SET_PATH, 'Master', 'Compressor2', 'Threshold', 0.25)
  assert.equal(param.value, '0.25')
  assert.equal(calls[1].url, '/api/document/device-param')
  assert.deepEqual(calls[1].body, {path: SET_PATH, track: 'Master', deviceName: 'Compressor2', paramId: 'Threshold', value: 0.25})
  assert.ok(calls.every(call => !call.url.endsWith('/op')))
})

test('the set reader reads the kernel live_set_read op through a kernel transport', async () => {
  globalThis.window = {__OI_KERNEL_BRIDGE__: BRIDGE}
  installFetch((url, body) => {
    if (url === '/api/config') return {default_set: ''}
    if (url === `${BRIDGE}/op`) return ownerAnswer(body)
    return {error: `unexpected route ${url}`}
  })
  const app = await import('../src/native/application.ts')

  const reading = await app.readSet(SET_PATH)
  assert.equal(reading.revision, REVISION)
  assert.equal(reading.summary.path, SET_PATH)
  assert.deepEqual(calls.find(call => call.body?.op === 'live_set_read').body, {op: 'live_set_read', path: SET_PATH})
  assert.ok(calls.every(call => !call.url.startsWith('/api/set')))
})
