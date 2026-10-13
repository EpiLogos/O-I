import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {register} from 'node:module'

// Production modules in memory (same loader pattern as inhabitant-manifest.test.mjs):
// .ts/.tsx transpiled, CSS stubbed, and @epilogos/expressions-boundary/<name>
// resolved to the boundary source.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c);
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const schema = await import('../src/inhabitants/manifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const homes = await import('../src/inhabitants/capabilityHomes.ts')

const matrix = JSON.parse(await readFile(new URL('suite/capability-matrix.json', root), 'utf8'))
const matrixRefs = new Set(matrix.records.map(record => record.id))
// The products the family door does not map: the gap this ticket closes.
const UNSCOPED_PRODUCTS = new Set(['O-I', 'Suite'])
const OPEN_STANDINGS = new Set(['partial', 'claimed-only'])

const loadFresh = () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
}

// Every ref declared as a family home, and the shell's refs: one list.
const declaredHomes = () => {
  const found = []
  for (const manifest of schema.allInhabitantManifests()) {
    for (const ref of manifest.capabilities ?? []) found.push({ref, home: manifest.id})
  }
  for (const ref of Object.keys(homes.SHELL_CAPABILITIES)) found.push({ref, home: 'shell'})
  return found
}

test('every O-I and Suite capability that is not landed has a home: a family declaration or the shell surface', () => {
  loadFresh()
  const declared = new Set(declaredHomes().map(entry => entry.ref))
  const gap = matrix.records.filter(record => UNSCOPED_PRODUCTS.has(record.product) && OPEN_STANDINGS.has(record.standing))
  assert.ok(gap.length > 0, 'the gap set is non-empty at the matrix')
  const unhomed = gap.map(record => record.id).filter(id => !declared.has(id))
  assert.deepEqual(unhomed, [], 'no unscoped capability is left without a home')
})

test('every declared home names a real capability ref in the matrix (no stale or misspelled refs)', () => {
  loadFresh()
  const stale = declaredHomes().map(entry => entry.ref).filter(ref => !matrixRefs.has(ref))
  assert.deepEqual(stale, [])
})

test('each capability has exactly one home: no ref is declared by two families, or by a family and the shell', () => {
  loadFresh()
  const seen = new Map()
  for (const {ref, home} of declaredHomes()) {
    assert.ok(!seen.has(ref), `${ref} is homed in both ${seen.get(ref)} and ${home}`)
    seen.set(ref, home)
  }
})

test('the homes follow the T-CAPABILITY-HOMES table: family refs land in their family, shell refs name a shell surface', () => {
  loadFresh()
  const byRef = new Map(declaredHomes().map(entry => [entry.ref, entry.home]))
  for (const home of homes.CAPABILITY_HOMES) {
    assert.equal(byRef.get(home.ref), home.family, `${home.ref} homes in ${home.family}`)
  }
  for (const [ref, surface] of Object.entries(homes.SHELL_CAPABILITIES)) {
    assert.equal(byRef.get(ref), 'shell', `${ref} homes in the shell`)
    assert.ok(surface.length > 0, `${ref} names its shell surface`)
  }
  assert.equal(byRef.get('cap.o-i.desktop-surface-host'), 'shell', 'the surface host is the shell itself (lock §4.2)')
})

test('a malformed capability ref is refused by validateInhabitantManifest; a well-formed one is not', () => {
  loadFresh()
  const central = schema.inhabitantManifest('central')
  const faults = schema.validateInhabitantManifest({...central, capabilities: ['cap.BAD REF', 'cap.o-i.flow-loop']})
  assert.ok(faults.some(fault => fault.includes('cap.BAD REF') && fault.includes('cap.<product>.<slug>')), faults.join('\n'))
  assert.ok(!faults.some(fault => fault.includes('cap.o-i.flow-loop')), 'a well-formed ref raises no fault')
})

test('a family refuses to home the same capability twice', () => {
  loadFresh()
  const central = schema.inhabitantManifest('central')
  const faults = schema.validateInhabitantManifest({...central, capabilities: ['cap.o-i.flow-loop', 'cap.o-i.flow-loop']})
  assert.ok(faults.some(fault => fault.includes('homed twice')), faults.join('\n'))
})

test('capability homes add no face and rewrite no base; the composed set still validates clean', () => {
  loadFresh()
  const extensions = homes.CAPABILITY_HOMES.map(home => home.family)
  for (const family of new Set(extensions)) {
    const ext = schema.familyExtensions(family).find(candidate => candidate.id === `${family}:capability-homes`)
    assert.ok(ext, `${family} carries its capability-homes extension`)
    assert.equal(ext.faces, undefined, `${family}: a home declares no face`)
    assert.ok(ext.note && ext.note.length > 0, `${family}: the note names each home's semantic`)
  }
  assert.equal(schema.validateAllInhabitantManifests().size, 0)
})

test('loading the families twice is idempotent: the capability homes compose the same', () => {
  loadFresh()
  const before = JSON.stringify(schema.inhabitantManifest('software-factory'))
  world.loadWorldShellFamilies()
  assert.equal(JSON.stringify(schema.inhabitantManifest('software-factory')), before)
})

test('devices:gaps joins every open O-I and Suite capability to a family or the shell, with no "no family scope" row', () => {
  const script = fileURLToPath(new URL('../scripts/device-gaps.mjs', import.meta.url))
  const report = JSON.parse(execFileSync(process.execPath, [script, '--json'], {encoding: 'utf8'}))
  const unscoped = report.rows.filter(row => row.family === '(no family scope)')
  assert.deepEqual(unscoped.map(row => row.id), [])
  for (const row of report.rows.filter(entry => UNSCOPED_PRODUCTS.has(entry.product))) {
    if (row.home === 'shell') assert.ok(row.shell_surface, `${row.id} names its shell surface`)
    else assert.equal(row.home, 'declared', `${row.id} is homed by its capability declaration`)
  }
})
