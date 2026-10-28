// The family browser entries (WORLD-SHELL-DESIGN §12): each of the six products declares its browser categories as
// `browserEntries` at the one door, with the modes they belong to. A declaration with the id of a mockup category its
// own family owns FILLS that entry (state and hint); every other declaration is APPENDED after the mockup's entries in
// the modes it names. These tests hold the declarations to that composition, and name the bare ids that remain open.
import test from 'node:test'
import assert from 'node:assert/strict'
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
const modeGrammar = await import('../src/shell/modeGrammar.ts')

const SIX = ['central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic']

// The bare ids each family declared before this change, and the entry that carries each one. A fill keeps the mockup's
// own id (the entry the owner fills); an append carries the bare id's meaning under a new id.
const CARRIED = {
  central: {ground: 'central-ground', agents: 'central-beings'},
  actuation: {gateways: 'gateways'},
  // REPLACED (#804): software-factory's `tasks` and `runs`, carried by `tasks` and `factory-runs` — retired with the devices they listed: a
  // task is a clip on its session's track, a run that track in Arrangement view with its take lanes (§19.1). No entry carries them.
  workcell: {git: 'git'},
  'ai-kit': {skillsets: 'skillsets'},
}
// Bare ids still open: each overlaps a mockup entry owned by another family (ai-kit's agents and skills against
// software-factory's factory-agents and factory-knowledge). No owner has ruled whose they are, so they stay bare.
// quaternal-logic's `knowledge` (the retained instrument list, Technē) cannot be declared until the family records the
// modes its sky, torus and clock faces present in: the door validator refuses a Technē entry no face of the family presents in.
const OPEN_BARE = {
  'ai-kit': ['agents', 'skills'],
  'quaternal-logic': ['knowledge'],
}
// The mockup's categories whose rows ModeBrowser composes today (CategoryRows): a declared entry never claims one.
const COMPOSED_ROW_SOURCES = new Set(['central-days', 'central-files', 'techne-files', 'techne-sources'])

world.loadWorldShellFamilies()
const declaredAll = () => manifests.allInhabitantBrowserEntries()
const composed = mode => modeGrammar.composeModeBrowser(mode, declaredAll())
const statics = mode => modeGrammar.browserCategoriesOf(mode)
const modesOf = declaration => declaration.modes

test('every bare browser id of the six is carried by a declared entry of its own family, or is named open', () => {
  for (const familyId of SIX) {
    const manifest = manifests.inhabitantManifest(familyId)
    assert.ok(manifest, `${familyId} is admitted`)
    assert.deepEqual([...manifest.browser], OPEN_BARE[familyId] ?? [], `${familyId}: the bare list keeps only the open ids`)
    const declared = declaredAll().filter(entry => entry.family === familyId)
    for (const [bare, entryId] of Object.entries(CARRIED[familyId] ?? {})) {
      const entry = declared.find(candidate => candidate.id === entryId)
      assert.ok(entry, `${familyId}: bare "${bare}" is carried by an entry "${entryId}" the family declares`)
      assert.equal(entry.family, familyId, `${familyId}: the entry "${entryId}" is the declaring family's`)
    }
    assert.deepEqual(manifests.validateInhabitantManifest(manifest), [], `${familyId}: the door validator is clean`)
  }
})

test('the bare lists are gone where every id is carried, and the open remainder is exactly the named one', () => {
  for (const familyId of SIX) {
    const bareCount = (manifests.inhabitantManifest(familyId).browser ?? []).length
    const expected = (OPEN_BARE[familyId] ?? []).length
    assert.equal(bareCount, expected, `${familyId}: no bare id beyond the named open ones`)
  }
})

test('each mode\'s composed browser keeps the mockup list intact, in order, as its prefix', () => {
  for (const mode of modeGrammar.SURF_MODES) {
    const floor = statics(mode)
    const out = composed(mode)
    assert.deepEqual(out.slice(0, floor.length).map(category => category.id), floor.map(category => category.id),
      `${mode}: the mockup's ids hold their positions`)
    floor.forEach((category, index) => {
      const kept = out[index]
      assert.equal(kept.label, category.label, `${mode}.${category.id}: label as drawn`)
      assert.equal(kept.group, category.group, `${mode}.${category.id}: group as drawn`)
      assert.equal(kept.mark, category.mark, `${mode}.${category.id}: mark as drawn`)
    })
  }
})

test('an owner fill takes the entry\'s standing from its own family only, keeps the mockup\'s label, and never duplicates', () => {
  const fills = declaredAll().filter(entry => modeGrammar.MODE_GRAMMAR.base.browser.concat(
    modeGrammar.MODE_GRAMMAR.factory.browser, modeGrammar.MODE_GRAMMAR.techne.browser).some(category => category.id === entry.id))
  // REPLACED (#804): "the two owner fills" — factory-runs filled the retired Runs category (§19.1).
  assert.deepEqual(fills.map(entry => entry.id).sort(), ['central-beings'], 'the one owner fill, and only that')
  for (const declaration of fills) {
    const mode = modeGrammar.SURF_MODES.find(name => statics(name).some(category => category.id === declaration.id))
    const floor = statics(mode).find(category => category.id === declaration.id)
    assert.equal(floor.family, declaration.family, `${declaration.id}: the mockup entry is owned by the declaring family`)
    assert.ok(modesOf(declaration).includes(mode), `${declaration.id}: the fill names its mockup mode`)
    const out = composed(mode)
    const hits = out.filter(category => category.id === declaration.id)
    assert.equal(hits.length, 1, `${declaration.id}: one entry, never a duplicate`)
    assert.equal(out.indexOf(hits[0]), statics(mode).indexOf(floor), `${declaration.id}: the mockup position holds`)
    assert.equal(hits[0].label, floor.label, `${declaration.id}: the label stays as drawn`)
    assert.equal(hits[0].state, declaration.state, `${declaration.id}: the owner's state`)
    assert.equal(hits[0].hint, declaration.hint, `${declaration.id}: the owner's hint`)
  }
})

test('a declared entry appears only in the modes it declares', () => {
  for (const declaration of declaredAll()) {
    for (const mode of modeGrammar.SURF_MODES) {
      const out = composed(mode)
      const present = out.some(category => category.id === declaration.id && category.hint === declaration.hint)
      if (declaration.modes.includes(mode)) {
        assert.ok(present, `${declaration.family}.${declaration.id} composes into ${mode}`)
      } else {
        assert.equal(present, false, `${declaration.family}.${declaration.id} does not compose into ${mode}`)
      }
    }
  }
})

test('no two declarations across the families share an id, and every appended entry is waiting, naming what it waits for', () => {
  const ids = declaredAll().map(entry => entry.id)
  assert.equal(new Set(ids).size, ids.length, 'declared ids are unique across the door')
  for (const declaration of declaredAll()) {
    const isFill = modeGrammar.SURF_MODES.some(mode => statics(mode).some(category => category.id === declaration.id))
    if (isFill) continue
    assert.ok(!COMPOSED_ROW_SOURCES.has(declaration.id), `${declaration.id} claims no composed row source`)
    assert.equal(declaration.state, 'waiting', `${declaration.family}.${declaration.id}: no row source is composed here, so it waits`)
    assert.match(declaration.hint, /\bop\b|\bops\b|owner|read/, `${declaration.id} names the read or owner it waits for`)
  }
})

test('the composed browsers hold no mode\'s entry in another mode, and no family entry leaks into Live or Expressions', () => {
  assert.deepEqual(composed('live'), [], 'Live keeps its own browser')
  assert.deepEqual(composed('expressions'), [], 'Expressions keeps its own browser')
  for (const declaration of declaredAll()) {
    if (declaration.modes.includes('live') || declaration.modes.includes('expressions')) {
      assert.fail(`${declaration.family}.${declaration.id} declares a mode that composes no browser`)
    }
  }
})
