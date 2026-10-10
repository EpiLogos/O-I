import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
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
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const load = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const catalogue = await import('../src/inhabitants/agentDeviceCatalogue.ts')
const addresses = await import('../src/inhabitants/agentParamAddresses.ts')

test('the neutral door admits the five agent-shell families once and exposes declared surfaces each', () => {
  door.resetFamilyManifestsForTest()
  load.loadAgentShellFamilies()
  const ids = door.allFamilyManifests().map(m => m.id)
  assert.deepEqual(ids, ['actuation', 'ai-kit', 'central', 'software-factory', 'workcell'])
  for (const manifest of door.allFamilyManifests()) {
    assert.ok(manifest.browser.length >= 1, manifest.id)
    assert.ok(manifest.faces.length >= 1, manifest.id)
    assert.ok(manifest.params.grammar, manifest.id)
    assert.ok(manifest.projections.length >= 1, manifest.id)
    assert.ok(manifest.inspectors.length >= 1, manifest.id)
    assert.ok(manifest.time.consumes.length >= 1, manifest.id)
  }
})

test('face ids are unique across the admitted families', () => {
  door.resetFamilyManifestsForTest()
  load.loadAgentShellFamilies()
  const seen = new Map()
  for (const manifest of door.allFamilyManifests()) {
    for (const face of manifest.faces) {
      const owner = seen.get(face.id)
      assert.ok(!owner, `face id "${face.id}" declared by both ${owner} and ${manifest.id}`)
      seen.set(face.id, manifest.id)
    }
  }
})

test('pool device rows derive from the manifests: every composed face is admitted and the rows cover all five families', () => {
  door.resetFamilyManifestsForTest()
  load.loadAgentShellFamilies()
  const manifests = door.allFamilyManifests()
  const rows = catalogue.deriveAgentDeviceRows(manifests)
  assert.deepEqual(rows.map(row => row.id), ['gateway', 'agent', 'skillset', 'world', 'git'])
  for (const row of rows) {
    assert.ok(manifests.some(m => m.id === row.family), `${row.id}: primary family ${row.family} admitted`)
    for (const face of row.faces) {
      const manifest = door.familyManifest(face.family)
      assert.ok(manifest, `${row.id}: family ${face.family} admitted`)
      assert.ok(manifest.faces.some(f => f.id === face.faceId), `${row.id}: ${face.family} declares face ${face.faceId}`)
      for (const presentation of face.presentations) {
        assert.ok(['compact', 'expanded', 'full'].includes(presentation), `${face.faceId} presentation ${presentation}`)
      }
    }
  }
  const familiesOnTheChain = new Set(rows.flatMap(row => row.faces.map(face => face.family)))
  for (const manifest of manifests) {
    assert.ok(familiesOnTheChain.has(manifest.id), `chain composes ${manifest.id} somewhere`)
  }
})

test('unadmitted families drop their faces (and empty slots) from the derivation, without code change', async () => {
  door.resetFamilyManifestsForTest()
  const actuation = await import('../src/inhabitants/actuationFamilyManifest.ts')
  actuation.actuationFamilyManifest()
  const rows = catalogue.deriveAgentDeviceRows(door.allFamilyManifests())
  // The gateway slot survives whole; the agent slot keeps only its admitted
  // actuation face; skillset/world/git disappear with no admitted family.
  assert.deepEqual(rows.map(row => row.id), ['gateway', 'agent'])
  assert.deepEqual(rows[0].faces.map(face => face.faceId), ['gateway'])
  assert.deepEqual(rows[1].faces.map(face => `${face.family}:${face.faceId}`), ['actuation:harness-model'])
})

test('every chain slot with addresses has rows in the §14 table, and every table device renders', () => {
  door.resetFamilyManifestsForTest()
  load.loadAgentShellFamilies()
  const rows = catalogue.deriveAgentDeviceRows(door.allFamilyManifests())
  const chainIds = new Set(rows.map(row => row.id))
  const tableDevices = new Set(addresses.AGENT_SHELL_ADDRESS_TABLE.map(row => row.deviceInstance))
  for (const id of chainIds) {
    assert.ok(tableDevices.has(id), `chain slot ${id} has address rows`)
  }
  assert.deepEqual([...tableDevices].sort(), [...chainIds].sort())
})

test('a seventh family integrates through admission only (no core change)', () => {
  door.resetFamilyManifestsForTest()
  door.admitFamilyManifest({
    id: 'seventh-product-proof',
    browser: ['proof'],
    faces: [{id: 'proof-face', presentations: ['compact']}],
    params: {grammar: 'proof/v1'},
    projections: ['proof-projection'],
    inspectors: ['proof-inspector'],
    time: {consumes: ['transport'], contributes: []},
    telemetry: null,
  })
  assert.equal(door.familyManifest('seventh-product-proof')?.faces[0].id, 'proof-face')
})

test('family manifest modules do not import React views', async () => {
  for (const file of [
    'familyManifest.ts',
    'actuationFamilyManifest.ts',
    'aiKitFamilyManifest.ts',
    'centralFamilyManifest.ts',
    'softwareFactoryFamilyManifest.ts',
    'workcellFamilyManifest.ts',
    'loadAgentShellFamilies.ts',
    'agentDeviceCatalogue.ts',
    'agentParamAddresses.ts',
  ]) {
    const source = await readFile(new URL(`../src/inhabitants/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"].*\.tsx['"]/, file)
    assert.doesNotMatch(source, /react/i, file)
  }
})
