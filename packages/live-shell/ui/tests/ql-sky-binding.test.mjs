import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane BL: QL's Sky on its producer. The catalogue's Sky design (quaternal-logic__sky.tsx, `quaternal-logic:sky`) draws on the dated
// sky the kernel reads through `nara_identity` / `transit` (qlSky.ts): the owner's bodies, epoch, scope and backend; the view's own
// date, overlays and shown bodies in its own hand; every key no owner keeps absent and disabled with its reason. The owner's answers
// here are the real read recorded from `oi ql nara transit` (tests/fixtures/ql-sky, scripted), handed to the reader as the kernel
// would answer — never a live kernel call. Loader as expressions-design-bindings.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText.split('import.meta.env').join('({BASE_URL: "/"})').split('import.meta.glob').join('(() => ({}))')};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [], documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const src = path => new URL(`../src/${path}`, import.meta.url).href
const sky = await import(src('inhabitants/ql/devices/qlSky.ts'))
const {design} = await import(src('inhabitants/catalogue/panels/quaternal-logic__sky.tsx'))
const {HostedDevice, flushDrafts, resetHost, setHosted} = await import(src('frame/devices/deviceHost.tsx'))
const {designKey} = await import(src('frame/devices/designs.ts'))
const {inhabitantManifest} = await import(src('inhabitants/manifest.ts'))
const {loadWorldShellFamilies} = await import(src('inhabitants/worldShellFamilies.ts'))
loadWorldShellFamilies()

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/ql-sky/${name}`, import.meta.url), 'utf8'))
const recorded = (await fixture('transit-2026-09-28.json')).transit
const refusedRead = (await fixture('transit-2500-refused.json')).stderr
/** The kernel's answer to nara_identity / transit, as kernel/src/nara_identity.rs:352-357 wraps QL's reading. */
const answered = transit => ({outcome: {result: 'nara_identity', data: {schema: 'oi.nara-identity/v1', transit}, receipts: []}})
const settle = ms => new Promise(resolve => setTimeout(resolve, ms))
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']
const face = inhabitantManifest('quaternal-logic').faces.find(item => item.id === 'sky')

test('the device is the design\'s: its family and face make the design\'s key', () => {
  assert.equal(sky.QL_SKY_DEVICE_ID, design.id)
  assert.equal(designKey(sky.QL_SKY_FAMILY, sky.QL_SKY_FACE), design.id)
  const device = sky.qlSkyDevice(face, {...sky.qlSkyState()})
  assert.equal(designKey(device.family, device.face.id), design.id)
})

test('the request is the one the Earth\'s Sun is read by; an instant outside the owner\'s range is refused before any call', () => {
  const at = new Date(Date.UTC(2026, 9, 16, 3, 0, 0))
  assert.deepEqual(sky.skyRequestFor({now: true}, at), {ok: true, request: {schema: 'ql.sky-request/v1', epoch: '2026-10-16T03:00:00Z', timezone: 'UTC', mode: 'current',
    perspective: 'Apparent Geocentric', zodiac: 'Tropical', ayanamsha: null, observer: null, max_age_seconds: 300, backend_policy: 'allow-moshier'}})
  assert.equal(sky.skyRequestFor({now: false, epochMs: Date.UTC(2026, 8, 28, 12)}, at).request.mode, 'historical')
  assert.deepEqual(sky.skyRequestFor({now: false, epochMs: Date.UTC(2500, 0, 1)}, at), {ok: false, reason: 'The dated sky answers only from 1800 to 2399.'})
})

test('the owner\'s recorded read becomes the design\'s keys: bodies shaped as the snapshot, its epoch, scope and backend — the rest absent', () => {
  const reading = sky.readSkyAnswer(answered(recorded))
  assert.equal(reading.ok, true)
  assert.equal(reading.sky.bodies.length, 10)
  const values = sky.qlSkyValues({...sky.qlSkyState(), reading, answered: {now: false, epochMs: Date.UTC(2026, 8, 28, 12)}, ask: {now: false, epochMs: Date.UTC(2026, 8, 28, 12)}})
  assert.equal(values.light, 'lit', 'the owner\'s transit stands available')
  assert.equal(values.epoch, '2026-09-28T12:00:00Z')
  assert.equal(values.observer, 'shared', 'shared-geocentric')
  assert.equal(values.backend, 'moshier')
  assert.deepEqual([values.year, values.day, values.time], [2026, 271, 720], 'the date asked, as the design keeps it')
  const bodies = JSON.parse(values.bodies)
  assert.deepEqual(Object.keys(bodies[0]), ['body', 'longitude_degrees', 'longitude_speed_degrees_per_day', 'retrograde'], 'the design\'s shape, the snapshot\'s own names')
  // The design's sample sky is fixtures/kernel/sky-snapshot-world-2026-09-28-v2.json; the owner's read for that instant agrees with it.
  const sample = JSON.parse(design.defaults.bodies)
  for (const [index, body] of bodies.entries()) {
    assert.equal(body.body, sample[index].body)
    assert.equal(Number(body.longitude_degrees.toFixed(4)), sample[index].longitude_degrees, `${body.body}: the owner's longitude`)
    assert.equal(body.retrograde, sample[index].retrograde)
  }
  for (const key of ['natalBodies', 'aspectList', 'moves', 'run', 'speed', 'havePlace', 'reason']) assert.ok(!(key in values), `${key} is absent: no owner reports it`)
  for (const key of ['natalBodies', 'aspectList', 'moves', 'run', 'speed', 'observer']) assert.ok(sky.QL_SKY_ABSENT[key], `${key}: why it is absent or not taken`)
})

test('a refusal is the owner\'s words: no bodies, no epoch, the light dark and the reason in the well', () => {
  const reading = sky.readSkyAnswer({outcome: null, error: refusedRead})
  assert.equal(reading.ok, false)
  assert.match(reading.reason, /epoch outside adapter range \[1800,2400\)/)
  const values = sky.qlSkyValues({...sky.qlSkyState(), reading})
  assert.equal(values.light, 'dark')
  assert.ok(!('bodies' in values) && !('epoch' in values))
  assert.match(values.reason, /epoch outside adapter range/)
  assert.match(sky.readSkyAnswer(answered({schema: 'ql.nara-transit/v1', status: 'unavailable', sky: null})).reason, /transit status: unavailable/)
  assert.match(sky.readSkyAnswer({outcome: {result: 'world_read', data: {}}}).reason, /not the dated sky/)
})

test('the design draws all five views on the owner\'s sky with nothing invented: no NaN, no undefined, the owner\'s places', () => {
  const reading = sky.readSkyAnswer(answered(recorded))
  const state = {...sky.qlSkyState(), reading, ask: {now: false, epochMs: Date.UTC(2026, 8, 28, 12)}, answered: {now: false, epochMs: Date.UTC(2026, 8, 28, 12)}}
  const binding = sky.qlSkyBinding(state)
  for (const view of VIEWS) {
    const markup = renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view, nav: {}}))
    assert.doesNotMatch(markup, /NaN|undefined/, `${view}: nothing drawn from a missing reading`)
    assert.doesNotMatch(markup, /data-device-fault/, `${view}: the design's own view draws`)
  }
  const folded = renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view: 'folded', nav: {}}))
  assert.match(folded, /28 Sep 2026/)
  assert.match(folded, /Sun 5° Lib/, 'the owner\'s Sun at 185.38°')
  const whole = renderToStaticMarkup(h(HostedDevice, {designed: design, binding, view: 'whole', nav: {}}))
  assert.match(whole, /Moshier/, 'the owner\'s ephemeris')
  assert.match(whole, /data-i="Run\|[^"]*No clock runs the sky here/, 'Run stands disabled with its reason')
  assert.match(whole, /data-i="Observer\|[^"]*no observer place reaches it/, 'the observer stands disabled with its reason')
  const moves = renderToStaticMarkup(h(HostedDevice, {designed: {...design, firstPage: 'moves'}, binding, view: 'whole', nav: {}}))
  assert.match(moves, /No reading of the moves\./, 'no compiled plan runs in the shell: the moves are not drawn from a fixture')
})

test('the view\'s keys are its own hand: the date asks the owner again once the hand settles, and only the newest answer stands', async () => {
  const calls = []
  let release
  const slow = new Promise(resolve => { release = resolve })
  sky.resetQlSky({call: async op => {
    calls.push(op)
    if (calls.length === 1) { await slow; return answered({...recorded, sky: {...recorded.sky, epoch_utc: '2026-01-01T00:00:00Z'}}) }
    return answered(recorded)
  }})
  resetHost(sky.QL_SKY_DEVICE_ID)
  sky.ensureQlSkyRead()
  assert.equal(calls.length, 1, 'the first view asks for the sky of this moment')
  assert.equal(calls[0].request.request.mode, 'current')
  // The Sun handle moves four keys together; none is a draft and none reaches a write: each goes to the view's hand.
  const binding = sky.qlSkyBinding(sky.qlSkyState())
  assert.equal(binding.write, undefined, 'the sky takes no change')
  for (const [key, value] of [['now', false], ['year', 2026], ['day', 271], ['time', 720]]) assert.equal(setHosted(binding, key, value), false, `${key} is the view's own`)
  assert.equal(await flushDrafts(binding), null, 'nothing waits on the owner')
  assert.equal(calls.length, 1, 'the owner is asked once the hand settles, not on every move')
  await settle(sky.SKY_SETTLE_MS + 30)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].request.request.epoch, '2026-09-28T12:00:00Z')
  assert.equal(calls[1].request.request.mode, 'historical')
  assert.equal(sky.qlSkyState().reading.sky.epochUtc, '2026-09-28T12:00:00Z')
  release()
  await settle(5)
  assert.equal(sky.qlSkyState().reading.sky.epochUtc, '2026-09-28T12:00:00Z', 'the slower, older answer never stands over the newer')
  // The drawing choices are kept by the view.
  sky.qlSkyHand('b:Moon', false)
  sky.qlSkyHand('aspects', true)
  const values = sky.qlSkyValues(sky.qlSkyState())
  assert.equal(values['b:Moon'], false)
  assert.equal(values['b:Sun'], true)
  assert.equal(values.aspects, true)
  sky.resetQlSky()
})

test('the generic plate that stands in for a view reads the owner\'s places; its one control asks for the sky of now', async () => {
  const calls = []
  sky.resetQlSky({call: async op => { calls.push(op); return answered(recorded) }})
  const reading = sky.readSkyAnswer(answered(recorded))
  const device = sky.qlSkyDevice(face, {...sky.qlSkyState(), reading})
  assert.equal(device.values.Sun, '5° Lib')
  assert.equal(device.values.Saturn, '11° Ari R', 'a body going backward says so')
  assert.equal(device.values.date, '2026-09-28 12:00')
  assert.deepEqual(device.rows.filter(row => row.writePath).map(row => row.key), ['now'])
  await assert.rejects(device.submit([{key: 'Sun', value: '0° Ari'}]), /the sky takes no change/)
  await device.submit([{key: 'now', value: true}])
  await settle(sky.SKY_SETTLE_MS + 30)
  assert.equal(calls.at(-1).request.request.mode, 'current')
  sky.resetQlSky()
})
