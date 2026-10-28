// #772: the Workcell rack's Left behind page (manual §19.23 "What a run leaves behind") carried at runtime, as Git / landing's Checkouts
// page is (§19.16): the census and pages Ground hygiene reads (groundBindings.ts hygieneBinding: Workcell's worlds with their bindings'
// presence, a named server's sandboxes, the findings, each source's refusal) laid under `left.`, its Recover the binding's own Reconcile
// (`workcell --receipt R reconcile --desired <binding>=present`), its Release orphans the binding's own. Both pages page their findings
// by the hand (`page:findings`).
// Channels: SCRIPTED — the census is hand-made in the model's shapes (centralHygieneModel.ts materialFindings, as stale-refusals-binding
// FIXTURE does); Workcell's writes go to a recording port, never to the owner; the publisher's composition is read from its source. Not a
// screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
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
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const host = await import('../src/frame/devices/deviceHost.tsx')
const pages = await import('../src/central/devices/pageBindings.ts')
const groundBind = await import('../src/central/devices/groundBindings.ts')
const hygieneModel = await import('../src/inhabitants/centralHygieneModel.ts')
const one = await import('../src/agent/devices/oneAgentBinding.ts')
const {design: workcellDesign} = await import('../src/inhabitants/catalogue/panels/workcell__workcell.tsx')
const {design: gitDesign} = await import('../src/inhabitants/catalogue/panels/workcell__git-seat.tsx')
const railSource = readFileSync(new URL('../src/agent/devices/AgentRailDevices.tsx', import.meta.url), 'utf8')

const OPS = {worlds: 'material: `workcell worlds` (op workcell_read worlds), each receipt read with op material_read', sandboxes: 'workcell sandboxes reconcile --server http://127.0.0.1:8090'}
const WORLDS = [{ref: 'world:a', receipt: '/state/worlds/a.json', bindings: [{ref: 'workspace:checkout', presence: 'stale'}, {ref: 'runtime:preview', presence: 'missing', persistence: 'ephemeral'},
  {ref: 'affordance:shell', presence: 'present'}]}]
const read = {census: {sources: [], worktrees: [], branches: [], seats: [], machineRef: 'workcell:mac'}, findings: [], at: Date.UTC(2026, 9, 28, 9),
  pages: {worlds: WORLDS, sources: [{boundaryOp: OPS.worlds, channel: 'kernel-op', at: 't'}], findings: hygieneModel.materialFindings({worlds: WORLDS, ops: OPS})}}

test('the Left behind page is Ground hygiene\'s census under left.: its findings read, Recover is the binding\'s Reconcile through Workcell', async () => {
  pages.resetHolds()
  const asked = []
  const hygiene = groundBind.hygieneBinding('central:ground-hygiene', read, Date.UTC(2026, 9, 28, 9), async () => {}, {workcell: async request => { asked.push(request); return {} }})
  assert.equal(one.LEFT_BEHIND_PAGE.prefix, 'left.')
  const rack = one.carryPages({id: 'factory:workcell', values: {name: 'env-2'}}, [{page: one.LEFT_BEHIND_PAGE, binding: hygiene}])
  assert.deepEqual(JSON.parse(rack.values['left.findings']).map(f => [f.kind, f.subject]), [['binding-drift', 'world:a#workspace:checkout'], ['binding-lost', 'world:a#runtime:preview']])
  assert.ok(rack.values['left.worlds'])
  // Recover (§19.23 "Brings missing and stale bindings back from the receipt") is the census's Reconcile, on its owner.
  assert.equal(rack.writes('left.recover'), true)
  assert.equal(rack.standing['left.recover'], undefined, 'a Workcell port stands: Recover is offered')
  await rack.write([{key: 'left.recover', value: 'world:a#workspace:checkout'}])
  assert.deepEqual(asked, [{kind: 'reconcile', receipt: '/state/worlds/a.json', desired: ['workspace:checkout=present']}])
  // Without the port, Recover stands disabled in the binding's words.
  const bare = one.carryPages({id: 'factory:workcell', values: {}}, [{page: one.LEFT_BEHIND_PAGE, binding: groundBind.hygieneBinding('central:ground-hygiene', read, 0, null)}])
  assert.equal(bare.standing['left.recover'].disabled, 'The kernel carrier is unavailable here, so Workcell cannot be asked.')
  // The design draws the page on it: the finding, not "No reading".
  host.setHostPage(rack.id, 'left')
  const markup = renderToStaticMarkup(createElement(host.HostedDevice, {designed: workcellDesign, binding: rack, view: 'whole', nav: {}}))
  host.resetHost(rack.id)
  assert.match(markup, /Binding not present|not present/)
})

test('a page\'s findings are paged by the hand on both pages that carry the census (left.page:findings, co.page:findings)', async () => {
  pages.resetHolds()
  const hygiene = groundBind.hygieneBinding('central:ground-hygiene', read, 0, null)
  for (const page of [one.LEFT_BEHIND_PAGE, one.CHECKOUTS_PAGE]) {
    const carried = one.carryPages({id: 'factory:carrier', values: {}}, [{page, binding: hygiene}])
    const key = `${page.prefix}page:findings`
    assert.ok(carried.local?.[key], `${key} is the hand's`)
    carried.local[key](2)
    const again = one.carryPages({id: 'factory:carrier', values: {}}, [{page, binding: groundBind.hygieneBinding('central:ground-hygiene', read, 0, null)}])
    assert.equal(again.values[key], 2, `${key} holds where the hand left it`)
    carried.local[key](undefined)
  }
})

test('the rail\'s workcell rack carries the Left behind page on the census it reads while the rack stands', () => {
  assert.match(railSource, /LEFT_BEHIND_PAGE/)
  assert.match(railSource, /useHygieneDevice\(transport, asked\)/)
  assert.match(railSource, /carryPages\(ownWorkcell, \[\{page: GATEWAYS_PAGE, binding: gateways\}, \{page: LEFT_BEHIND_PAGE, binding: leftBehind\}\]\)/)
})
