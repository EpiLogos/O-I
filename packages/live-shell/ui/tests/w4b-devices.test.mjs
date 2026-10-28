import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-WORLDS W4, the face side, on the devices: the Sitting on its binding (Play rings the bell through the torus's own strike, the transport
// times it, Stop keeps the time sat, the record is a page), Clip view's Answer this and Entry, Speak as in a Circle, and the Sky drawing
// your birth sky. Fixture owners stand in for the instrument, Central and the kernel. The Sitting's design and face were retired in the 22
// Oct manual rewrite (#725; §24.3: a sitting is a clip of the practice world's track); its binding of its owners is checked on its own.
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
  if(url.includes('.html?raw')){const path=new URL(url.slice(0,url.indexOf('?'))).pathname;return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(path,'utf8'))};}
  if(url.endsWith('.json')&&!url.startsWith('data:'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url).pathname,'utf8')};
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
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const h = React.createElement
const sittingMod = await import('../src/inhabitants/ql/devices/qlSitting.ts')
const skyMod = await import('../src/inhabitants/ql/devices/qlSky.ts')
const techne = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const manifests = await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')
const {HostedDevice} = await import('../src/frame/devices/deviceHost.tsx')
const {designKey} = await import('../src/frame/devices/designs.ts')
const skyDesign = (await import('../src/inhabitants/catalogue/panels/quaternal-logic__sky.tsx')).design
const clip = await import('../src/central/clipBinding.ts')
const writes = await import('../src/central/devices/centralDeviceWrites.ts')
const holds = await import('../src/frame/detail/clipBinding.ts')
const instance = await import('../../../../desktop/cradle/src/flow/instance.ts')
const plural = await import('../../../../desktop/cradle/src/flow/plural.ts')
const VIEWS = ['folded', 'compact', 'whole', 'full', 'widget']

/** A clock the test turns by hand, and the instrument's strikes and Central's records as they arrive. */
function fixtureOwners() {
  let now = Date.UTC(2026, 9, 19, 6, 40)
  const pending = []
  const rung = [], kept = [], opened = []
  const owners = {
    ring: async pitch => { rung.push(pitch); return {ok: true} },
    keep: async record => { kept.push(record); return {location: {schema: 'central.path-ref/v1', ref: 'ref:sitting', root: 'R', path: 'Work/personal/ProjectCentral/user/flow-sitting.html'}, title: 'Sitting'} },
    today: async () => [],
    open: location => opened.push(location.path),
    now: () => now,
    later: (run, ms) => { const timer = {at: now + ms, run}; pending.push(timer); return timer },
    cancel: timer => { const at = pending.indexOf(timer); if (at >= 0) pending.splice(at, 1) },
  }
  const advance = async ms => {
    const until = now + ms
    for (;;) {
      pending.sort((a, b) => a.at - b.at)
      const next = pending[0]
      if (!next || next.at > until) break
      pending.shift(); now = next.at; next.run()
      await new Promise(resolve => setImmediate(resolve))
    }
    now = until
    await new Promise(resolve => setImmediate(resolve))
  }
  return {owners, rung, kept, opened, advance}
}

test('the Sitting: Play rings the torus\'s note and begins; it rings at each interval and at the end; the bell\'s end keeps the full length', async () => {
  const fixture = fixtureOwners()
  sittingMod.resetQlSitting({owners: fixture.owners})
  let binding = sittingMod.qlSittingBinding(sittingMod.qlSittingState())
  assert.equal(binding.writes('playing'), true)
  assert.equal(binding.writes('length'), false, 'what you set is the view\'s own')
  binding.local.length(10); binding.local.intervals('5'); binding.local.bell('D'); binding.local.after('write')
  binding = sittingMod.qlSittingBinding(sittingMod.qlSittingState())
  assert.equal(binding.values.length, 10)
  assert.ok(binding.standing.centres.disabled, 'today\'s centres are the scene\'s: absent, named')
  await binding.write([{key: 'playing', value: true}])
  assert.deepEqual(fixture.rung, [2], 'the bell is the torus\'s own strike of D')
  assert.equal(sittingMod.qlSittingValues(sittingMod.qlSittingState()).playing, true)
  assert.ok(sittingMod.qlSittingBinding(sittingMod.qlSittingState()).standing.length.disabled, 'what you set holds while it plays')
  await fixture.advance(5 * 60_000)
  assert.deepEqual(fixture.rung, [2, 2], 'the interval bell')
  assert.equal(sittingMod.qlSittingState().elapsed, 300, 'the transport\'s time, read while it plays')
  await fixture.advance(5 * 60_000)
  assert.deepEqual(fixture.rung, [2, 2, 2], 'the end bell')
  assert.equal(sittingMod.qlSittingState().sitting, null)
  assert.equal(fixture.kept.length, 1)
  assert.equal(fixture.kept[0].sat_seconds, 600)
  assert.equal(fixture.kept[0].ended_by, 'bell')
  assert.deepEqual(fixture.opened, ['Work/personal/ProjectCentral/user/flow-sitting.html'], 'After: Write a line opens the record for the line')
  assert.equal(sittingMod.qlSittingState().kept.title, 'Sitting')
})

test('the Sitting: Stop ends it now and keeps the time actually sat; the transport plays it only while it is in front of you', async () => {
  const fixture = fixtureOwners()
  sittingMod.resetQlSitting({owners: fixture.owners})
  assert.deepEqual(sittingMod.sittingTransport(sittingMod.qlSittingState()), {}, 'not armed: the mode\'s own transport stands')
  sittingMod.setQlSittingView({length: 20, after: 'nothing', bell: 'off'})
  let bar = sittingMod.sittingTransport(sittingMod.qlSittingState())
  assert.equal(bar.loop.lit, false, 'Loop shows the intervals: none')
  bar.play.press()
  assert.deepEqual(fixture.rung, [], 'the bell off: nothing is struck')
  await fixture.advance(7 * 60_000 + 15_000)
  bar = sittingMod.sittingTransport(sittingMod.qlSittingState())
  assert.equal(bar.play.lit, true)
  bar.stop.press()
  await fixture.advance(0)
  assert.equal(fixture.kept[0].sat_seconds, 435, 'Stop keeps the length actually sat')
  assert.equal(fixture.kept[0].ended_by, 'stop')
  assert.deepEqual(fixture.opened, [], 'After: Nothing opens nothing')
  assert.deepEqual(sittingMod.sittingTransport(sittingMod.qlSittingState()), {}, 'ended: the transport is the mode\'s again')
  // The record not kept is said, never dropped silently.
  sittingMod.resetQlSitting({owners: {...fixture.owners, keep: async () => { throw new Error('Central refused the page') }}})
  sittingMod.startSitting()
  await sittingMod.endSitting('stop')
  assert.match(sittingMod.qlSittingState().fault, /not kept: Central refused the page/)
})

// DELETED (#725): "Technē's chain draws the Sitting's design on its binding; the manifest admits it on its owner" — the manual removed the
// Sitting as a device (§24.3: "A sitting is a clip of the practice world's track (§24.1): its length, its bell and its intervals stand in its
// Clip panel, and Play rings the bell and begins"): Quaternal Logic declares no Sitting face, no rack stands it, and its design is retired.
// What stays is checked: the face is gone, and the binding that times, rings and keeps a sitting (the two tests above) still reads its length.
test('the Sitting is no device: Quaternal Logic declares no Sitting face, and no rack stands one; its binding still holds the sitting', () => {
  sittingMod.resetQlSitting({owners: fixtureOwners().owners})
  const faces = manifests.quaternalLogicFamilyManifest().faces
  assert.ok(!faces.some(f => f.id === 'sitting'), 'no Sitting face')
  const entries = techne.techneEntries([{id: 'quaternal-logic', faces}], {atlas: null, surface: null, torus: null, instrumentReading: null})
  assert.ok(!entries.some(entry => entry.device.id === sittingMod.QL_SITTING_DEVICE_ID), 'no Sitting on any rack')
  assert.equal(sittingMod.qlSittingBinding(sittingMod.qlSittingState()).values.length, 20, 'the sitting\'s own length, 20 minutes until you set another (§24.1)')
})

test('the Sky draws your birth sky as its natal ring once a launch gives it; no chart is computed here', () => {
  skyMod.resetQlSky({call: async () => ({outcome: null, error: 'none'})})
  skyMod.setQlSkyNatal({person_ref: 'person:frank', name: 'Frank', source: {source_ref: 'id:frank', revision: 'r7'},
    bodies: [{body: 'Sun', longitude_degrees: 169.38, retrograde: false}, {body: 'Moon', longitude_degrees: 284.8, retrograde: false}]})
  const binding = skyMod.qlSkyBinding(skyMod.qlSkyState())
  assert.equal(binding.values.natal, true)
  assert.equal(JSON.parse(binding.values.natalBodies).length, 2)
  const out = renderToStaticMarkup(h(HostedDevice, {designed: skyDesign, binding, view: 'full', nav: {}}))
  assert.match(out, /your birth sky/i)
  skyMod.resetQlSky()
})

// ── Clip view: Answer this, Entry and Speak as ──────────────────────────────────────────────────────────────────────────────────────────

const location = {schema: 'central.path-ref/v1', ref: 'ref:circle', root: 'R', path: 'Work/personal/ProjectCentral/user/flow-circle.html'}
function circleFlow() {
  let html = instance.mintBlankInstance([{initial: 'F', name: 'Frank', kind: 'person'}, {initial: 'A', name: 'Ann', kind: 'person'}], new Date(2026, 9, 19))
  const doc = instance.parseInstance(html)
  doc.meta.container = 'circle'
  html = instance.embedDocument(html, doc)
  html = instance.appendEntry(html, 'What is here now is the rain.', {kind: 'observe'}).html
  return html
}

test('in a Circle Speak as stands with the holder; Entry is the view\'s and written with the entry; each entry shows its kind', async () => {
  const html = circleFlow()
  const doc = instance.parseInstance(html)
  assert.equal(plural.circleHolder(doc).name, 'Ann', 'the word has passed round to Ann')
  const read = clip.fileReading(html, 'note')
  assert.equal(JSON.parse(read.values.entries)[0].kind, 'observe', 'the entry\'s kind is read')
  const binding = clip.centralClipBinding({ref: `subject:note:${location.path}`, values: read.values, location, island: read.island}, {write: async () => {}})
  assert.equal(binding.values.speakAs, 'Ann', 'Speak as defaults to the holder')
  assert.equal(binding.values.entryKind, 'observe', 'Entry: Observe by default, in a container')
  assert.equal(binding.standing.entryKind, undefined, 'no longer refused: the view holds it')
  binding.local.entryKind('interpret')
  assert.deepEqual(writes.composerOf(location), {kind: 'interpret'})
  // The composer writes the kind with the entry, as the holder.
  let written = null
  globalThis.fetch = async (_url, init) => {
    const op = JSON.parse(init.body)
    if (op.op === 'file_read') return {json: async () => ({ok: true, outcome: {result: 'file_read', reading: {location, revision: 'r1', content: html, source: null, project: null}}})}
    if (op.op === 'file_operation') { written = op.request.content; return {json: async () => ({ok: true, outcome: {result: 'file_operation', data: {outcome: 'written', revision: 'r2'}}})} }
    throw new Error(op.op)
  }
  const plain = {...location, path: 'Control/user/flows/flow-circle.html'}
  await writes.appendFlowEntry({kind: 'bridge', url: 'x'}, plain, {text: 'It means I can rest.', relation: null, kind: 'interpret'})
  const after = instance.parseInstance(written)
  assert.equal(after.entries.at(-1).kind, 'interpret')
  assert.equal(after.entries.at(-1).author, 'A', 'unnamed, the holder writes')
  holds.setViewHold(holds.clipHostId('central', `subject:note:${location.path}`), 'entryKind', undefined)
})

test('Answer this stands on a Flow: refused in words while no identity or Expression stands, the act when one does', async () => {
  const html = circleFlow()
  const read = clip.fileReading(html, 'note')
  const reading = {ref: 'subject:note:x', values: read.values, location, island: read.island}
  const refused = clip.centralClipBinding(reading, {write: async () => {}, answer: {refused: 'Nara answers the person a saved identity names, and none is chosen.'}})
  assert.match(refused.standing['act.answerthis'].disabled, /none is chosen/)
  const asked = []
  const ready = clip.centralClipBinding(reading, {write: async () => {}, answer: {ask: async entry => { asked.push(entry) }}})
  assert.equal(ready.standing['act.answerthis'], undefined)
  await assert.rejects(ready.write([{key: 'act.answerthis', value: 1}]), /Select an entry/)
  ready.local.selected(JSON.parse(read.values.entries)[0].id)
  const selected = clip.centralClipBinding(reading, {write: async () => {}, answer: {ask: async entry => { asked.push(entry) }}})
  await selected.write([{key: 'act.answerthis', value: 1}])
  assert.deepEqual(asked, [JSON.parse(read.values.entries)[0].id])
  const page = clip.centralClipBinding({...reading, values: {kind: 'being'}, island: {profile: 'oi.page/v1', meta: {family: 'beings'}, bindings: {}}}, {write: async () => {}, answer: {ask: async () => {}}})
  assert.ok(page.standing['act.answerthis'].disabled, 'a Being has no Answer this yet: the page family\'s words stand')
})
