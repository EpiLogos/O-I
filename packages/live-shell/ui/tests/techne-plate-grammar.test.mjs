// lane E (ticket E, 15 Oct): the plate grammar every device stands on — sections side by side at the widths their controls take, folded to
// their titles when the row is too narrow, never a scroller; no box inside a box; controls visual first (dials, switches, rows that page) —
// and the Technē instruments' Compact presentation: a well drawn from the owners' readings and the four macros each instrument's manual
// entry names (docs/dlw/DLW.md §16.1, §17.1–§17.6 Presentations; docs/dlw/DEVICE-UI.md §1–§3). Rendered server-side with the production
// modules in memory (the loader of atlas-places-plate.test.mjs).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

globalThis.__CRADLE_WALK__ = false
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const Plate = await import('../src/frame/devices/InstrumentPlate.tsx')
const Fit = await import('../src/frame/devices/plateFit.ts')
const {InstrumentCompact} = await import('../src/inhabitants/ql/devices/techneCompacts.tsx')
const {TECHNE_INSTRUMENTS} = await import('../src/inhabitants/sdk/semantics.ts')
const {readFile} = await import('node:fs/promises')

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()
adoptRows.adoptVerifiedRows()

const html = element => renderToStaticMarkup(element)
const css = async path => readFile(new URL(path, import.meta.url), 'utf8')
const presentation = {family: 'techne', faceId: 'techne:m9', title: 'Probe', icon: 'techne', owner: 'probe'}

test('a plate fits itself: past its first section, a section folds to its title rather than scroll; a section the host folds is the host\'s', () => {
  const out = html(createElement(Plate.InstrumentPlate, {presentation, sections: [
    {id: 'a', title: 'First', children: 'a'}, {id: 'b', title: 'Second', children: 'b'}, {id: 'c', title: 'Third', children: 'c'},
  ]}))
  assert.match(out, /<h5 class="inst-section-head"><span>First<\/span><\/h5>/, 'the first section never folds for room')
  for (const title of ['Second', 'Third']) assert.match(out, new RegExp(`aria-label="Fold ${title} to its title"`), `${title} can fold: the plate's own fit holds it`)
  assert.match(out, /class="inst-plate" data-studio-fit=":[^"]+:"/, 'the plate marks its own row for its fit')
  const held = html(createElement(Plate.InstrumentPlate, {presentation, sections: [{id: 'a', title: 'First', children: 'a'}, {id: 'b', title: 'Second', children: 'b', folded: true, onFold() {}}]}))
  assert.match(held, /data-section="b" data-folded="true"/, 'a fold the host decides stands')
  assert.doesNotMatch(held, /Fold First/, 'with one free section there is nothing to fit')
})

test('the fold law: the person\'s folds first, then as few of the order as bring the row within its width; a column the person opened stays open', () => {
  const widths = new Map([['a', 200], ['b', 300], ['c', 300]]), none = new Set()
  const fit = over => [...Fit.foldsToFit({columns: ['a', 'b', 'c'], widths, strip: 26, available: 600, folded: none, opened: none, order: ['c', 'b'], ...over})]
  assert.deepEqual(fit(), ['c'], 'the last folds first')
  assert.deepEqual(fit({available: 300}), ['c', 'b'], 'then the one before it')
  assert.deepEqual(fit({opened: new Set(['c'])}), ['b'], 'an opened column holds; the next folds instead')
  assert.deepEqual(fit({available: 900}), [], 'room enough: nothing folds')
})

test('the head carries the device\'s own acts before its marks (the mockup\'s Studio head: Save)', () => {
  const out = html(createElement(Plate.InstrumentPlate, {presentation, head: createElement('button', {type: 'button'}, 'Save'), actions: [{icon: 'cmd', label: 'Configure'}],
    sections: [{id: 'a', title: 'A', children: 'a'}]}))
  assert.match(out, /<span class="dp-head-acts"><button type="button">Save<\/button><\/span><span class="dp-head-x"><button type="button" class="dp-full" data-plate-mark="cmd" title="Configure"/, 'the acts, then the marks (the kit\'s head)')
})

test('the sheets: the row and its sections never scroll, a hairline between sections, no box framed inside a section, shell tokens only', async () => {
  const plate = await css('../src/frame/devices/instrumentPlate.css'), controls = await css('../src/frame/devices/plateControls.css')
  assert.match(plate, /\.inst-sections \{[^}]*overflow: hidden/, 'the row never scrolls')
  assert.match(plate, /\.inst-section-body \{[^}]*overflow: hidden/, 'a section never scrolls: its lists page')
  assert.match(plate, /\.inst-section \{[^}]*border-right: 1px solid var\(--line\)/, 'one hairline between sections, as Live draws')
  assert.match(plate, /\.inst-section-head \{[^}]*height: 13px;[^}]*font-size: 9px;[^}]*text-transform: uppercase/, 'named in 9 px small capitals, 13 high (DEVICE-UI §3)')
  const sheets = [plate, controls, await css('../src/projections/atlas/places/placesPlate.css'), await css('../src/components/expressions/studio/frameChrome.css'),
    await css('../src/inhabitants/ql/devices/techneDevices.css'), await css('../src/projections/atlas/palaces/palaces.css')]
  for (const sheet of sheets) {
    assert.doesNotMatch(sheet, /overflow(-[xy])?: (auto|scroll)|overflow: hidden auto/, 'no scroller in a plate\'s sheet')
    assert.doesNotMatch(sheet.replace(/var\([^;]*\)/g, ''), /#[0-9a-fA-F]{3,8}\b/, 'no raw colour: the shell\'s tokens only')
  }
  assert.doesNotMatch(controls, /\.plate-row[^{]*\{[^}]*background: var\(--bg-1\)/, 'a row is a line with a hairline under it, never a framed box')
})

/** The macros each instrument's manual entry names for its Compact (DLW.md §17.1–§17.6 Presentations; M0′ stands on §17.2's grammar). */
const MACROS = {
  'techne:m0': ['Depth', 'Scope', 'Ghosts', 'Labels'], 'techne:m1': ['Tool', 'Snap', 'Relation', 'Standing'], 'techne:m2': ['Lens', 'Window', 'Floor', 'Readings'],
  'techne:m3': ['Pace', 'Arrival', 'Loop', 'Narration'], 'techne:m4': ['Scale', 'Aperture', 'View as', 'Occasion'], 'techne:m5': ['Path', 'Guide', 'Audience', 'Return'],
}

test('each Technē instrument has its Compact: a head that opens it on the focused pane, a well drawn from its owners, and its four named macros', () => {
  for (const holder of TECHNE_INSTRUMENTS) {
    const out = html(createElement(InstrumentCompact, {holder, mark: 'techne', light: 'unknown', onOpen() {}}))
    assert.match(out, new RegExp(`class="techne-compact" data-instrument="${holder.id}" data-expanded="compact" data-rack="compact"`), `${holder.id} stands compact on the rack`)
    assert.match(out, new RegExp(`<header class="dp-head dp-head--plate"[^>]*>.*?class="dp-title dp-title--press"[^>]*>${holder.title}<`), `${holder.id}: the kit's head; its name is the press that opens it`)
    assert.match(out, /<div class="dp-display" style="width:96px;height:96px"[^>]*><svg/, `${holder.id}: one well, the only inset surface`)
    const macros = out.slice(out.indexOf('class="techne-compact-macros"'))
    for (const name of MACROS[holder.id]) assert.match(macros, new RegExp(`(class="dp-label">|>)${name}<`), `${holder.id}: the macro ${name}`)
    assert.equal((macros.match(/class="dp-cell /g) ?? []).length, 4, `${holder.id}: four macros, no more`)
  }
})

test('with no owner reading, a Compact names what is missing in its well and lights no macro it cannot press', () => {
  const m4 = html(createElement(InstrumentCompact, {holder: TECHNE_INSTRUMENTS.find(holder => holder.id === 'techne:m4'), mark: 'placed', light: 'unknown', onOpen() {}}))
  assert.match(m4, /<text[^>]*>the Earth<\/text><text[^>]*>not mounted<\/text>/, 'the World names the missing Earth, never a likely planet')
  assert.match(m4, /aria-label="Aperture"[^>]*disabled=""/, 'Aperture waits: no owner opens the shared field yet')
  const m5 = html(createElement(InstrumentCompact, {holder: TECHNE_INSTRUMENTS.find(holder => holder.id === 'techne:m5'), mark: 'palace', light: 'unknown', onOpen() {}}))
  assert.match(m5, /data-i="Path\|[^"]*Enter a palace[^"]*" data-disabled="true"/, 'outside a palace its path waits, saying why')
  assert.doesNotMatch(m5, /aria-checked="true"/, 'nothing lit that no owner reads')
  const m1 = html(createElement(InstrumentCompact, {holder: TECHNE_INSTRUMENTS.find(holder => holder.id === 'techne:m1'), mark: 'form', light: 'unknown', onOpen() {}}))
  assert.match(m1, /No Expressions application is mounted\.|The stage has not reported its controls yet\./, 'the stage\'s instruments wait on the stage, in its words')
})

test('the rack stands an instrument Compact where the row has room, its fold elsewhere: one row, never a scroller (source reading)', async () => {
  const rack = await css('../src/inhabitants/ql/devices/TechneDevices.tsx')
  assert.match(rack, /rack\.shown\.has\(holder\.id\)\s*\? <InstrumentCompact[^\n]*onOpen=\{press\}/, 'a Compact where it fits, opening as the fold did')
  assert.match(rack, /: <InstrumentFold key=\{holder\.id\} holder=\{holder\} count=\{held\.length\} onOpen=\{press\} \/>/, 'its fold elsewhere, its press unchanged')
  assert.match(rack, /item\.classList\.contains\('inst-plate'\) \? Number\(item\.dataset\.naturalWidth\)/, 'the open plate first, at the width its sections ask')
  assert.match(rack, /'techne:m0': props => <ProjectPlate \{\.\.\.props\} \/>/, 'M0′ is one plate of its own (no boxed sub-devices)')
})

test('the focused instrument takes the whole device row: no strip that receives nothing ends it (source reading)', async () => {
  const host = await css('../src/frame/detail/DetailHost.tsx')
  const instrument = host.slice(host.indexOf("if (held === 'instrument')"), host.indexOf('\n', host.indexOf("if (held === 'instrument')")))
  assert.match(instrument, /<InstrumentDeviceDetail /)
  assert.doesNotMatch(instrument, /dropz/, 'the instrument row has no drop strip (it had no receiver)')
  assert.match(host, /<ChainEnd hint=\{table\.dropHint\} drop=\{table\.drop\} \/>/, 'a mode\'s own chain still ends where a device can be dropped')
})
