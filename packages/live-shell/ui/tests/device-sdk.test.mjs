import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, rm, writeFile} from 'node:fs/promises'
import {register} from 'node:module'
import {spawnSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

// Production modules in memory (the house loader pattern: .ts/.tsx
// transpiled, CSS stubbed, expressions-boundary resolved to source).
const here = dirname(fileURLToPath(import.meta.url))
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', new URL('../../../../', import.meta.url)).href
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
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const icons = await import('../src/inhabitants/sdk/icons.ts')
const scaffold = await import('../src/inhabitants/sdk/scaffold.ts')

// ---------------------------------------------------------------------------
// 1 — the icon law: the module is the cut, byte-faithful.

test('every icon mark is a balanced inner-SVG fragment, and the wrapper is the specimen’s', () => {
  assert.ok(icons.ICON_NAMES.length >= 40, `the cut carries its marks (${icons.ICON_NAMES.length})`)
  for (const name of icons.ICON_NAMES) {
    const mark = icons.ICON_MARKS[name]
    assert.ok(mark.includes('<'), `${name}: a mark is markup`)
    assert.equal((mark.match(/</g) ?? []).length, (mark.match(/>/g) ?? []).length, `${name}: balanced tags`)
    assert.ok(!/<script/i.test(mark), `${name}: no scripts in a mark`)
  }
  assert.equal(
    icons.renderIcon('play', 16),
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + icons.ICON_MARKS.play + '</svg>',
    'the wrapper is the specimen’s svg() exactly',
  )
  assert.equal(icons.isIconName('play'), true)
  assert.equal(icons.isIconName('definitely-not-a-mark'), false)
})

test('the generated icon module has not drifted from icon-cut.html', () => {
  const check = spawnSync(process.execPath, [join(here, '..', 'scripts', 'sync-icons.mjs'), '--check'], {encoding: 'utf8'})
  assert.equal(check.status, 0, `sync-icons --check: ${check.stderr.trim() || check.stdout.trim()}`)
})

// ---------------------------------------------------------------------------
// 2 — the kit admits an honest family; the door shape stays verbatim.

const HONEST_FAMILY = {
  id: 'acme',
  owner: 'Acme Instruments',
  browser: ['acme'],
  paramsGrammar: 'acme/parameter-address/v1',
  devices: [
    {
      id: 'probe',
      title: 'Probe',
      icon: 'form',
      note: 'Readings over the probe owner (op acme_probe_read); the calibration writer waits.',
      params: [
        sdkDefine.reading({key: 'readiness', title: 'Readiness', type: 'string', disclosure: 'No owner reading wired yet.'}),
        sdkDefine.enumParam({key: 'mode', title: 'Mode', type: 'enumerated', values: ['slow', 'fast']}),
        sdkDefine.numberParam({key: 'gain', title: 'Gain', type: 'number', range: {min: 0, max: 2, unit: 'x'}, writePath: 'shell.setAcmeGain'}),
      ],
    },
  ],
}

test('an honest family admits through the kit, registers its plate and rows, and re-admits idempotently', () => {
  door.resetFamilyManifestsForTest()
  const admitted = sdkDefine.admitFamily(HONEST_FAMILY)
  assert.equal(door.familyManifest('acme').id, 'acme')
  // The door manifest matches the built shape.
  assert.deepEqual([...schema.validateInhabitantManifest(admitted.manifest)], [])
  // Presentations + rows registered.
  const plate = sdkDefine.facePresentation('acme', 'probe')
  assert.equal(plate.title, 'Probe')
  assert.equal(plate.icon, 'form')
  assert.equal(plate.owner, 'Acme Instruments')
  assert.equal(sdkDefine.sdkParamRows('acme').length, 3)
  // The write row and the readings are what they say they are.
  const gain = sdkDefine.sdkParamRows('acme').find(row => row.key === 'gain')
  assert.equal(gain.writePath, 'shell.setAcmeGain')
  assert.equal(gain.deviceInstance, 'probe')
  // Idempotent re-admission: rows do not duplicate.
  sdkDefine.admitFamily(HONEST_FAMILY)
  assert.equal(sdkDefine.sdkParamRows('acme').length, 3)
})

// ---------------------------------------------------------------------------
// 3 — the gate refuses dishonest declarations, naming the law.

test('the gate refuses: invented icons, fake writers, broken grammars, unreachable addresses', () => {
  door.resetFamilyManifestsForTest()
  const refusals = [
    [{...HONEST_FAMILY, devices: [{...HONEST_FAMILY.devices[0], icon: 'made-up-mark'}]}, 'icon'],
    [{...HONEST_FAMILY, devices: [{...HONEST_FAMILY.devices[0], params: [sdkDefine.reading({key: 'x', title: 'X', type: 'stream', writePath: 'shell.setX'})]}]}, 'reading by nature'],
    [{...HONEST_FAMILY, devices: [{...HONEST_FAMILY.devices[0], params: [sdkDefine.stringParam({key: 'x', title: 'X', type: 'string', writePath: 'make it up'})]}]}, 'owner path'],
    [{...HONEST_FAMILY, devices: [{...HONEST_FAMILY.devices[0], params: [sdkDefine.enumParam({key: 'x', title: 'X', type: 'enumerated', values: []})]}]}, 'values'],
    [{...HONEST_FAMILY, devices: [{...HONEST_FAMILY.devices[0], params: [{key: 'x', title: 'X', type: 'waveform'}]}]}, 'grammar'],
    [{...HONEST_FAMILY, devices: [{id: 'doc', title: 'Doc', icon: 'lib', kind: 'document', params: []}]}, 'declares a body'],
    [{
      ...HONEST_FAMILY,
      devices: [{id: 'wait', title: 'Wait', icon: 'form', admission: 'waiting', params: [sdkDefine.boolParam({key: 'x', title: 'X', type: 'boolean', writePath: 'shell.setX'})]}],
    }, 'waiting face carries no write path'],
  ]
  for (const [declaration, expected] of refusals) {
    assert.throws(() => sdkDefine.admitFamily(declaration), error => {
      assert.match(error.message, /refuses to admit/)
      assert.match(error.message, new RegExp(expected))
      return true
    }, `expected a refusal naming "${expected}"`)
  }
  // The door holds nothing the gate refused.
  assert.equal(door.familyManifest('acme'), undefined)
})

test('a param row that addresses an undeclared face faults the family check', () => {
  door.resetFamilyManifestsForTest()
  const built = sdkDefine.buildFamilyDeclaration(HONEST_FAMILY)
  const ghostRow = {...built.params[0], deviceInstance: 'ghost'}
  const faults = sdkValidate.validateDeclaredFamily(HONEST_FAMILY, built.manifest, [...built.params, ghostRow])
  assert.ok(faults.some(fault => fault.includes('ghost')), faults.join(' | '))
})

// ---------------------------------------------------------------------------
// 4 — the world gate over the REAL families: the six + extensions pass, and
// the verified address table stands against kit contradictions.

test('the real world-shell families pass the device gate', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const manifestFaults = schema.validateAllInhabitantManifests()
  assert.equal(manifestFaults.size, 0, `door validator: ${[...manifestFaults].map(([id, faults]) => `${id}: ${faults.join('; ')}`).join(' | ')}`)
  const gate = sdkValidate.validateAdmittedWorld()
  assert.equal(gate.byFamily.size, 0, `device gate: ${[...gate.byFamily].map(([id, faults]) => `${id}: ${faults.join('; ')}`).join(' | ')}`)
  assert.deepEqual(gate.cross, [])
})

test('a kit row that contradicts the verified address table faults the world gate', () => {
  door.resetFamilyManifestsForTest()
  // A kit declaration of actuation's gateway transport with contents that
  // differ from the verified ownership map — the gate names the collision.
  sdkDefine.admitFamily({
    ...HONEST_FAMILY,
    id: 'actuation',
    owner: 'Actuation',
    devices: [{
      id: 'gateway',
      title: 'Gateway · hermes',
      icon: 'link',
      params: [sdkDefine.enumParam({key: 'transport', title: 'Transport', type: 'enumerated', values: ['carrier-pigeon']})],
    }],
  })
  const gate = sdkValidate.validateAdmittedWorld()
  assert.ok(
    gate.cross.some(fault => fault.includes('contradicts the verified address table')),
    gate.cross.join(' | '),
  )
})

// ---------------------------------------------------------------------------
// 5 — the scaffolder: validated files that admit when placed.

test('the scaffolder refuses malformed input and generates a family that admits', async () => {
  assert.throws(() => scaffold.scaffoldFamilyFiles({family: 'Bad Id', owner: 'x', device: 'probe', deviceTitle: 'Probe'}))
  assert.throws(() => scaffold.scaffoldFamilyFiles({family: 'acme2', owner: 'x', device: 'probe', deviceTitle: 'Probe', icon: 'no-such-mark'}))

  const input = {family: 'scaffold-probe', owner: 'Scaffold Works', device: 'meter', deviceTitle: 'Meter'}
  const declared = scaffold.scaffoldDeclaration(input)
  assert.deepEqual(declared.faults, [], 'the declaration passes the gate pre-write')

  const files = scaffold.scaffoldFamilyFiles(input)
  assert.equal(files.length, 3)
  const written = []
  try {
    // The manifest module must live in src/inhabitants/ for its relative
    // import; the test file in tests/.
    for (const file of files) {
      const target = join(here, '..', file.path)
      await writeFile(target, file.contents)
      written.push(target)
    }
    const generated = await import('../src/inhabitants/ScaffoldProbeFamilyManifest.ts')
    door.resetFamilyManifestsForTest()
    generated.loadScaffoldProbeFamily()
    const manifest = door.familyManifest('scaffold-probe')
    assert.ok(manifest, 'the generated family admits')
    assert.deepEqual([...sdkValidate.validateAdmittedWorld().byFamily.get('scaffold-probe') ?? []], [])
    // Honesty: the scaffold carries no writePath — a starter never pretends a writer.
    for (const row of sdkDefine.sdkParamRows('scaffold-probe')) {
      assert.equal(row.writePath, undefined, `starter row ${row.key} is a reading`)
    }
  } finally {
    for (const target of written) await rm(target, {force: true})
  }
})
