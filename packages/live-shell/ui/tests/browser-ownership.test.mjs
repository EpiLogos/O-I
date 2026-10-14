// The browser and panel ownership law (WORLD-SHELL-DESIGN §12). A declared browser id that a mockup category or a row source
// reserves belongs to its owner family; two families declaring one id compose neither; an explicit mode composes only where
// the family's faces present in; two panel slot declarations claiming one panel id draw neither. Each refusal is composed
// nowhere and named at the door (validateAllInhabitantManifests). The mockup's categories stay an untouched prefix.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const manifests = await import('../src/inhabitants/manifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const modeGrammar = await import('../src/shell/modeGrammar.ts')
const panels = await import('../src/shell/panels.ts')
const modeBrowserSource = await readFile(new URL('../src/shell/ModeBrowser.tsx', import.meta.url), 'utf8')

const fresh = () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
}

// A synthetic family that exists only in this file: one probe face (with the modes the test gives it), and the declarations.
function fixture(id, {modes, browserEntries = [], panelSlots = []} = {}) {
  const product = `${id}-product`
  sdkDefine.admitFamily({
    id,
    owner: `${id} (test only)`,
    product,
    newProduct: {id: product, authority: 'SDK test fixture — a synthetic family that ships nowhere'},
    browser: [],
    paramsGrammar: `${id}/parameter-address/v1`,
    writers: [],
    writerAuthority: 'SDK test fixture — arms no writer',
    devices: [{id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'info', note: 'A fixture reading.', params: [], ...(modes ? {modes} : {})}],
  })
  if (browserEntries.length || panelSlots.length) {
    manifests.declareFamilyExtension(id, {
      id: `${id}:ownership`,
      by: 'browser-ownership test',
      browserEntries,
      panelSlots,
      note: 'Fixture declarations for the ownership law.',
    })
  }
}

const entry = (id, extra = {}) => ({id, label: id, group: 'To hand', mark: 'form', hint: `${id} hint`, state: 'waiting', ...extra})
const idsOf = categories => categories.map(category => category.id)
const faultsOf = family => manifests.validateAllInhabitantManifests().get(family) ?? []
const composedIn = mode => modeGrammar.composeModeBrowser(mode, manifests.allInhabitantBrowserEntries())

test('the reservations: a mockup category reserves its id for its family, a row source for its owner, and the rest are free', () => {
  fresh()
  assert.deepEqual(modeGrammar.browserIdReservation('central-days'), {reserved: true, owner: 'central'})
  assert.deepEqual(modeGrammar.browserIdReservation('techne-bodies'), {reserved: true, owner: 'quaternal-logic'})
  assert.deepEqual(modeGrammar.browserIdReservation('central-files'), {reserved: true, owner: null}, 'the shell\'s own listing')
  assert.deepEqual(modeGrammar.browserIdReservation('techne-sources'), {reserved: true, owner: null}, 'the shell\'s own work list')
  assert.deepEqual(modeGrammar.browserIdReservation('fixture-free-category'), {reserved: false})
})

test('every category id the row sources dispatch on is a reserved row source, and no other id is', () => {
  const dispatched = new Set([...modeBrowserSource.matchAll(/category\.id === '([a-z-]+)'/g)].map(match => match[1]))
  assert.deepEqual([...dispatched].sort(), [...modeGrammar.ROW_SOURCE_OWNERS.keys()].sort())
})

test('repro: a foreign family appending a row-owning id into another mode is not shown, and Central\'s row is not dispatched under a foreign label', () => {
  fresh()
  const foreign = entry('central-days', {family: 'other', modes: ['factory'], label: 'Evil days', group: 'Z', state: 'cut'})
  const factory = modeGrammar.composeModeBrowser('factory', [foreign])
  assert.deepEqual(idsOf(factory), idsOf(modeGrammar.MODE_GRAMMAR.factory.browser), 'factory is the mockup, unchanged')
  assert.equal(factory.some(category => category.id === 'central-days'), false, 'no central-days row in Factory')
})

test('repro: a foreign family declaring a mockup id in its own mode does not fill or relabel it', () => {
  fresh()
  const declared = [entry('central-days', {family: 'other', modes: ['base'], hint: 'EVIL', state: 'waiting'})]
  const base = modeGrammar.composeModeBrowser('base', declared)
  assert.equal(base.filter(category => category.id === 'central-days').length, 1, 'one Days entry, never a duplicate')
  const days = base.find(category => category.id === 'central-days')
  assert.equal(days.family, 'central', 'the mockup entry keeps its owner')
  assert.equal(days.label, 'Days', 'and its label as drawn')
  assert.notEqual(days.hint, 'EVIL', 'and the foreign hint never reaches it')
})

test('the door names a foreign claim on a reserved id, and the shell\'s own categories, and composes neither', () => {
  fresh()
  fixture('fixture-squatter', {browserEntries: [entry('central-days', {modes: ['base']}), entry('techne-files', {modes: ['techne']})]})
  assert.match(faultsOf('fixture-squatter').join('\n'), /browser entry "central-days" belongs to the central family/, 'central-days named')
  assert.match(faultsOf('fixture-squatter').join('\n'), /browser entry "techne-files" is one of the shell's own categories/, 'techne-files named')
  const base = modeGrammar.composeModeBrowser('base', manifests.allInhabitantBrowserEntries())
  assert.equal(base.find(category => category.id === 'central-days').family, 'central')
  const techne = modeGrammar.composeModeBrowser('techne', manifests.allInhabitantBrowserEntries())
  assert.equal(techne.find(category => category.id === 'techne-files').family, undefined, 'the shell\'s own Files entry, unchanged')
})

test('two families declaring one new id: neither composes, and the door names each one', () => {
  fresh()
  fixture('fixture-alpha', {browserEntries: [entry('x-cat', {modes: ['factory'], label: 'A'})]})
  fixture('fixture-beta', {browserEntries: [entry('x-cat', {modes: ['factory'], label: 'B'})]})
  assert.equal(idsOf(composedIn('factory')).includes('x-cat'), false, 'the contested id is not shown')
  const message = /browser entry "x-cat" is declared 2 times \(by fixture-alpha, fixture-beta\); a category id has one owner/
  assert.match(faultsOf('fixture-alpha').join('\n'), message)
  assert.match(faultsOf('fixture-beta').join('\n'), message)
})

test('one family declaring one new id twice: neither composes, and the door names it', () => {
  fresh()
  fixture('fixture-twice', {browserEntries: [entry('fx-twice', {modes: ['factory']}), entry('fx-twice', {modes: ['factory']})]})
  assert.equal(idsOf(composedIn('factory')).includes('fx-twice'), false)
  assert.match(faultsOf('fixture-twice').join('\n'), /browser entry "fx-twice" is declared 2 times \(by fixture-twice\)/)
})

test('an explicit mode the family\'s faces do not present in is named at the door and composes nowhere; a mode they do present in composes', () => {
  fresh()
  fixture('fixture-modes', {
    modes: ['factory'],
    browserEntries: [entry('fx-mode', {modes: ['techne']}), entry('fx-placed', {modes: ['factory']})],
  })
  assert.match(faultsOf('fixture-modes').join('\n'), /browser entry "fx-mode" names mode "techne", which none of the fixture-modes family's faces presents in \(factory\)/)
  assert.equal(idsOf(composedIn('techne')).includes('fx-mode'), false, 'the out-of-family mode is not shown in Technē')
  assert.equal(idsOf(composedIn('factory')).includes('fx-mode'), false, 'nor in Factory')
  assert.equal(idsOf(composedIn('factory')).includes('fx-placed'), true, 'an entry in a mode its faces present in composes (positive control)')
})

test('a family\'s fill of its own mockup category may name only the modes the mockup draws it in', () => {
  fresh()
  manifests.declareFamilyExtension('quaternal-logic', {
    id: 'quaternal-logic:ownership-moved',
    by: 'browser-ownership test',
    browserEntries: [entry('techne-bodies', {modes: ['factory'], hint: 'MOVED'})],
    note: 'Fixture fill that names a mode the mockup does not draw the category in.',
  })
  assert.match(faultsOf('quaternal-logic').join('\n'), /browser entry "techne-bodies" names mode "factory", where the mockup does not draw it \(techne\)/)
  const techne = composedIn('techne').find(category => category.id === 'techne-bodies')
  assert.notEqual(techne.hint, 'MOVED', 'the moved fill composes nowhere')
  assert.equal(techne.family, 'quaternal-logic', 'the mockup entry keeps its owner')
})

test('a family\'s fill of its own mockup category with no modes named composes into the mockup\'s mode', () => {
  fresh()
  manifests.declareFamilyExtension('quaternal-logic', {
    id: 'quaternal-logic:ownership-filled',
    by: 'browser-ownership test',
    browserEntries: [entry('techne-bodies', {hint: 'FILLED', state: 'waiting'})],
    note: 'Fixture fill with no modes named: it takes the modes the mockup draws it in.',
  })
  const declared = manifests.allInhabitantBrowserEntries().find(declaration => declaration.id === 'techne-bodies')
  assert.deepEqual([...declared.modes], ['techne'], 'the default is the mockup\'s mode, not the family\'s faces\'')
  assert.deepEqual(faultsOf('quaternal-logic').filter(fault => fault.includes('techne-bodies')), [], 'and it is admitted')
  assert.equal(composedIn('techne').find(category => category.id === 'techne-bodies').hint, 'FILLED')
})

test('two slot declarations claiming one panel id draw neither, the door names each family, and the registry says so once', () => {
  fresh()
  fixture('fixture-alpha-p', {panelSlots: [{slot: 'right-dock', panel: 'fixture.shared'}]})
  fixture('fixture-beta-p', {panelSlots: [{slot: 'right-dock', panel: 'fixture.shared'}]})
  fixture('fixture-solo-p', {panelSlots: [{slot: 'right-dock', panel: 'fixture.solo'}]})
  const logged = []
  const original = console.error
  console.error = (...args) => logged.push(args.join(' '))
  let drawn
  try {
    drawn = panels.getPanels('right-dock').map(panel => panel.id)
  } finally {
    console.error = original
  }
  assert.equal(drawn.includes('fixture.shared'), false, 'the contested panel is not drawn')
  assert.equal(drawn.includes('fixture.solo'), true, 'an uncontested slot still composes (positive control)')
  assert.match(logged.join('\n'), /panel "fixture\.shared" is declared by fixture-alpha-p, fixture-beta-p/, 'named once in the registry')
  const message = /panel "fixture\.shared" is declared 2 times \(by fixture-alpha-p, fixture-beta-p\); a panel id has one owner/
  assert.match(faultsOf('fixture-alpha-p').join('\n'), message)
  assert.match(faultsOf('fixture-beta-p').join('\n'), message)
})

test('one family declaring one panel id twice draws neither, and the door names it', () => {
  fresh()
  fixture('fixture-gamma-p', {panelSlots: [{slot: 'right-dock', panel: 'fixture.twice'}, {slot: 'right-dock', panel: 'fixture.twice'}]})
  assert.equal(panels.getPanels('right-dock').some(panel => panel.id === 'fixture.twice'), false)
  assert.match(faultsOf('fixture-gamma-p').join('\n'), /panel "fixture\.twice" is declared 2 times \(by fixture-gamma-p\)/)
})

test('whatever the declarations, each mode\'s composed browser keeps the mockup as its untouched prefix', () => {
  fresh()
  fixture('fixture-prefix', {
    modes: ['factory'],
    browserEntries: [entry('central-days', {modes: ['base']}), entry('x-prefix', {modes: ['factory']}), entry('x-prefix', {modes: ['factory']})],
  })
  for (const mode of modeGrammar.SURF_MODES) {
    const floor = modeGrammar.browserCategoriesOf(mode)
    assert.deepEqual(idsOf(composedIn(mode)).slice(0, floor.length), idsOf(floor), `${mode}: the mockup's ids hold their positions`)
  }
})
