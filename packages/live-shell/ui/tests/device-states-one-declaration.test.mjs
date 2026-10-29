// One declaration of a device's states (O-I #744; manual §16.3 "A device has one set of values and up to six views. It has the views of the
// places it stands in"). The kit's table (inhabitants/sdk/views.ts DEVICE_STATES) names every catalogue device's views; the designs take
// theirs from it (catalogue/panels/index.ts, design.ts RAIL_AND_PANE) and the manifests' presentations derive from it (statePresentations),
// so the two never disagree again, and the device gate (sdk/validate.ts deviceStateFaults) refuses a face that drifts. Where the manifests and
// the designs disagreed, the manual's states stand: Link, the Deck, the Chakra and the remote carrier have Whole, and Link its Full; the
// monitors (the Ledger, Messages) are Widget and Full only. No device loses a state its design granted before.
// Channels: SCRIPTED (the kit, the designs and the admitted manifests through the transpiling loader) and code-reading (the registry).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/') || s === 'react-dom' || s.startsWith('react-dom/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) { if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}; return r }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)
globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
globalThis.__CRADLE_DOCUMENTS__ = undefined

const views = await import('../src/inhabitants/sdk/views.ts')
const {loadWorldShellFamilies} = await import('../src/inhabitants/worldShellFamilies.ts')
const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const {allInhabitantManifests} = await import('../src/inhabitants/manifest.ts')
const {deviceStateFaults} = await import('../src/inhabitants/sdk/validate.ts')
const ALL = ['folded', 'compact', 'whole', 'full', 'popout', 'widget']
const dir = new URL('../src/inhabitants/catalogue/panels/', import.meta.url)
const designs = []
for (const file of [...readdirSync(dir).filter(f => /__.*\.tsx$/.test(f)), 'day.tsx', 'torus.tsx', 'physics.tsx', 'skills.tsx', 'member.tsx', 'scope.tsx']) {
  const mod = await import(new URL(file, dir).href)
  designs.push(mod.design ?? Object.values(mod).find(x => x && typeof x === 'object' && 'kind' in x && 'id' in x && 'full' in x))
}

test('the kit names every catalogue device\'s states; a design that writes views of its own writes the kit\'s', () => {
  assert.ok(designs.length >= 60)
  for (const design of designs) {
    const states = views.deviceStates(design.id)
    assert.ok(states, `${design.id}: its states are declared in the kit`)
    if (design.views) assert.deepEqual([...design.views], [...states], `${design.id}: its own views are the kit's`)
  }
  assert.deepEqual(Object.keys(views.DEVICE_STATES).sort(), designs.map(d => d.id).sort(), 'the table holds the catalogue\'s devices, and only them')
})

test('the registry hands every design its states from the kit: the reference devices and every module alike', () => {
  const index = readFileSync(new URL('index.ts', dir), 'utf8')
  assert.match(index, /DESIGNED[^=]*= Object\.fromEntries\(\[[^\]]*\]\.map\(d => \[d\.id, stated\(d\)\]\)\)/, 'the reference devices')
  assert.match(index, /return load \? stated\(\(await load\(\)\)\.design\) : undefined/, 'each module, as it loads')
  assert.match(readFileSync(new URL('design.ts', dir), 'utf8'), /RAIL_AND_PANE[^=]*= RAIL_AND_PANE_VIEWS/, 'a monitor\'s two views are the kit\'s')
})

test('the manual\'s states stand where the manifests and the designs disagreed; no device loses a state its design had', () => {
  for (const id of ['workcell:link', 'quaternal-logic:deck', 'quaternal-logic:chakra', 'workcell:remote-carrier']) assert.ok(views.deviceStates(id).includes('whole'), `${id}: Whole`)
  assert.ok(views.deviceStates('workcell:link').includes('full'), 'Link: Full')
  for (const id of ['software-factory:ledger', 'ai-kit:messages']) assert.deepEqual([...views.deviceStates(id)], ['widget', 'full'], `${id}: a monitor's Widget and Full`)
  const before = JSON.parse(readFileSync(new URL('./fixtures/device-states-before-744.json', import.meta.url), 'utf8'))
  for (const [id, had] of Object.entries(before)) for (const view of had) assert.ok(views.deviceStates(id).includes(view), `${id} keeps ${view}`)
})

test('the manifests\' presentations derive from the kit, and the device gate refuses a face that drifts', () => {
  assert.deepEqual(views.presentationsOf(ALL), ['compact', 'expanded', 'full'])
  assert.deepEqual(views.presentationsOf(['widget', 'full']), ['full'], 'a monitor: its Full')
  assert.deepEqual(views.presentationsOf(['whole', 'full', 'widget']), ['expanded', 'full'], 'Link')
  loadWorldShellFamilies(); loadAgentShellFamilies()
  const faces = allInhabitantManifests().flatMap(m => m.faces.map(f => [`${m.id}:${f.id}`, f.presentations]))
  const designed = faces.filter(([id]) => views.deviceStates(id))
  assert.ok(designed.length >= 28, `${designed.length} admitted faces are catalogue devices`)
  for (const [id, presentations] of designed) assert.deepEqual([...presentations], views.statePresentations(id), `${id}: its manifest says what the kit says`)
  assert.deepEqual(deviceStateFaults(allInhabitantManifests()), [], 'the admitted world passes')
  const drifted = [{id: 'workcell', faces: [{id: 'link', presentations: ['compact'], liveSemantic: 'link'}]}]
  assert.match(deviceStateFaults(drifted)[0], /workcell\/link: presentations compact; its states \(sdk\/views\.ts\) come to expanded · full/)
})
