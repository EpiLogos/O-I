import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory, same loader as native-scene-faces.test.mjs: .ts/.tsx transpiled, CSS stubbed, and
// @epilogos/expressions-boundary/<name> resolved to the boundary source. No React view is loaded by the manifest.
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

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const [declaration, gate, widgets, manifest, catalogue, model] = await Promise.all([
  import(new URL('expressionsFamilies.ts', boundary)),
  import(new URL('familyAdmission.ts', boundary)),
  import(new URL('nativeDeviceWidgets.ts', boundary)),
  import('../src/expressions/expressionsFamilyManifest.ts'),
  import('../src/components/nativeDeviceCatalogue.ts'),
  import(new URL('model.ts', author)),
])
const {EXPRESSIONS_FAMILIES, loadExpressionsFamilies} = declaration
const {admitFamily, admittedFamily, isFamilyToken} = gate
const {applyNativeDeviceWidgetChanges} = widgets
const ids = EXPRESSIONS_FAMILIES.map(family => family.id)
const shared = {toolbelt: [], values: {}, pointer: {}}

test('the declaration names 22 families, each once, with the brief scopes, faced flags and repeatability', () => {
  assert.equal(EXPRESSIONS_FAMILIES.length, 22)
  assert.equal(new Set(ids).size, 22)
  const scoped = scope => EXPRESSIONS_FAMILIES.filter(family => family.scope === scope).map(family => family.id).sort()
  assert.deepEqual(scoped('field'), ['colour', 'contacts', 'depth', 'focus', 'glyph', 'ink', 'medium', 'morph', 'physics', 'pointer', 'relational', 'resonance'])
  assert.deepEqual(scoped('entity'), ['force', 'formation', 'meaning', 'sound'])
  assert.deepEqual(scoped('scene'), ['arrange', 'automation', 'blueprint', 'body', 'scene', 'text'])
  assert.deepEqual(EXPRESSIONS_FAMILIES.filter(family => !family.faced).map(family => family.id), ['glyph'])
  assert.deepEqual(EXPRESSIONS_FAMILIES.filter(family => family.repeatable).map(family => family.id), ['formation', 'force'])
})

test('family tokens follow the kernel grammar: lowercase letters, digits and hyphens, 1 to 64 characters', () => {
  for (const id of ['physics', 'a-b', '0', 'x'.repeat(64)]) assert.equal(isFamilyToken(id), true, id)
  for (const id of ['Physics', '', 'x'.repeat(65), 'a b', 'a_b', 'é', '__proto__', 42, null, undefined]) assert.equal(isFamilyToken(id), false, String(id))
})

test('loading the declaration admits every family once, and loading it again changes nothing', () => {
  const first = loadExpressionsFamilies()
  const second = loadExpressionsFamilies()
  assert.deepEqual(first.map(admission => admission.id), ids)
  assert.deepEqual(second, first)
  for (const family of EXPRESSIONS_FAMILIES) assert.equal(admittedFamily(family.id)?.repeatable, family.repeatable, family.id)
  assert.equal(admittedFamily('nothing-admitted-here'), undefined)
  assert.equal(admittedFamily('Physics'), undefined)
})

test('admission refuses a bad token, a non-boolean repeatability, and a second admission with a different repeatability', () => {
  assert.throws(() => admitFamily({id: 'Bad', repeatable: false}), /token/)
  assert.throws(() => admitFamily({id: 'delta', repeatable: 'yes'}), /repeat/)
  const delta = admitFamily({id: 'delta', repeatable: false})
  assert.deepEqual(admitFamily({id: 'delta', repeatable: false}), delta, 'the same declaration is idempotent')
  assert.throws(() => admitFamily({id: 'delta', repeatable: true}), /different repeatability/)
  assert.equal(admittedFamily('delta').repeatable, false)
})

test('neutrality: a seventh family admitted by declaration places through the unchanged gate and validator, and is refused a second time', async () => {
  admitFamily({id: 'seventh', repeatable: false})
  const journey = {...model.sevenCentres(), shared}
  const placed = applyNativeDeviceWidgetChanges(journey, [{kind: 'device-add', family: 'seventh'}])
  assert.deepEqual(placed.shared.devices, [{id: 'seventh-1', family: 'seventh'}])
  assert.throws(() => applyNativeDeviceWidgetChanges(placed, [{kind: 'device-add', family: 'seventh'}]), /already placed/)
  const sources = await Promise.all([readFile(new URL('familyAdmission.ts', boundary), 'utf8'), readFile(new URL('nativeDeviceWidgets.ts', boundary), 'utf8')])
  for (const source of sources) {
    assert.doesNotMatch(source, /seventh/)
    assert.doesNotMatch(source, /physics/)
  }
})

test('the manifest is one Expressions inhabitant, with one face per declared family, and it never imports a React view', async () => {
  const family = manifest.expressionsFamilyManifest()
  assert.equal(family.id, 'expressions')
  assert.deepEqual(family.browser, ['works', 'material', 'objects', 'properties', 'devices'])
  assert.deepEqual(family.faces.map(face => face.id), ids)
  assert.deepEqual(family.inspectors, ['rack', 'device-pool', 'GlyphSequenceEditor'])
  const source = await readFile(new URL('../src/expressions/expressionsFamilyManifest.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from 'react'/)
  assert.doesNotMatch(source, /\.tsx/)
})

test('every catalogued family matches its declared scope and paths; glyph is the one declared face with no catalogue entry', () => {
  const devices = catalogue.deviceCatalogue()
  const faces = manifest.expressionsFamilyManifest().faces
  for (const face of faces) {
    const device = devices.find(row => row.family === face.id)
    if (face.id === 'glyph') {
      assert.equal(device, undefined)
      assert.equal(face.faced, false)
      assert.deepEqual(face.paths, [])
      continue
    }
    assert.ok(device, `${face.id} is catalogued`)
    assert.equal(device.scope, face.scope, `${face.id} scope matches the declaration`)
    assert.deepEqual(face.paths, device.paths, `${face.id} paths are the catalogue paths`)
    assert.equal(face.studio, device.studio ?? null, `${face.id} studio`)
  }
  for (const device of devices) assert.ok(faces.some(face => face.id === device.family), `${device.family} is declared`)
})

test('faces name their registry: field, entity and scene registries, bespoke hosts for Morph, Colour and Force, and no registry for glyph', () => {
  const registry = Object.fromEntries(manifest.expressionsFamilyManifest().faces.map(face => [face.id, face.registry]))
  assert.equal(registry.physics, 'field')
  assert.equal(registry.morph, 'bespoke')
  assert.equal(registry.colour, 'bespoke')
  assert.equal(registry.force, 'bespoke')
  assert.equal(registry.formation, 'entity')
  assert.equal(registry.scene, 'scene')
  assert.equal(registry.glyph, null)
})

test('the family shares one parameter grammar, the track adapter, Transport time and observation telemetry', () => {
  const family = manifest.expressionsFamilyManifest()
  assert.equal(family.params.grammar, 'parameterAddress.ts')
  assert.deepEqual(family.projections, ['expressions-track-adapter'])
  assert.deepEqual(family.time, {consumes: 'Transport', contributes: ['scenes', 'automation', 'takes']})
  assert.equal(family.telemetry, 'observation.effectiveValues')
})
