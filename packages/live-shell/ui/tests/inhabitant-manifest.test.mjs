import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production modules in memory (same loader pattern as
// expressions-family-manifest.test.mjs): .ts/.tsx transpiled, CSS stubbed,
// and @epilogos/expressions-boundary/<name> resolved to the boundary source.
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
const five = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const qlogic = await import('../src/inhabitants/quaternalLogicFamilyManifest.ts')
const docModel = await import('../src/inhabitants/documentDeviceModel.ts')
const expressionsFamilies = await import(new URL('expressionsFamilies.ts', boundary))
const expressionsManifest = await import('../src/expressions/expressionsFamilyManifest.ts')

const FIVE = ['actuation', 'ai-kit', 'central', 'software-factory', 'workcell']
const SIX = ['actuation', 'ai-kit', 'central', 'software-factory', 'workcell', 'quaternal-logic']

// ---------------------------------------------------------------------------
// 1 — the compatibility proof: the five agent-shell manifests load through
// the generalised schema unchanged.

test('the five agent-shell manifests load through the generalised schema unchanged, and validate', () => {
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  assert.deepEqual(door.allFamilyManifests().map(m => m.id), FIVE)
  for (const id of FIVE) {
    const composed = schema.inhabitantManifest(id)
    const base = door.familyManifest(id)
    assert.ok(composed, id)
    // No extensions yet: the composed view IS the owner's base, byte-equal.
    assert.equal(JSON.stringify(composed), JSON.stringify(base), `${id}: composed === base before extensions`)
    // The generalised validators pass on the unmodified grammar.
    assert.deepEqual([...schema.validateInhabitantManifest(composed)], [], `${id}: valid`)
    // Every face the agent shell declared is a parameter face by default.
    for (const face of composed.faces) assert.equal(schema.faceKind(face), 'parameter', `${id}/${face.id}`)
  }
})

// ---------------------------------------------------------------------------
// 2 — the six world-shell families: quaternal-logic declares at the same
// door; the L2 extensions compose additively; the bases stay verbatim.

test('loadWorldShellFamilies admits the sixth family and composes the L2 extensions without rewriting any base', () => {
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  const basesBefore = Object.fromEntries(FIVE.map(id => [id, JSON.stringify(door.familyManifest(id))]))
  world.loadWorldShellFamilies()
  // The door now holds six; ids sorted.
  assert.deepEqual(door.allFamilyManifests().map(m => m.id), [...FIVE, 'quaternal-logic'].sort())
  // Every base manifest is byte-identical to before the extensions.
  for (const id of FIVE) {
    assert.equal(JSON.stringify(door.familyManifest(id)), basesBefore[id], `${id}: base unchanged by composition`)
  }
  // Central's composed manifest carries the L2 faces after its base's own.
  const central = schema.inhabitantManifest('central')
  assert.deepEqual(central.faces.map(face => face.id),
    ['context-world', 'agent-identity', 'ground-hygiene', 'impact', 'day-die', 'flow-document', 'nara-conversation'])
  // Software-factory's composed manifest carries attempt-review after its base's own.
  const factory = schema.inhabitantManifest('software-factory')
  assert.deepEqual(factory.faces.map(face => face.id),
    ['agent-custody', 'context-write-mode', 'ledger', 'approvals', 'run-device', 'attempt-review'])
  // Idempotent: a second load changes nothing.
  world.loadWorldShellFamilies()
  assert.equal(JSON.stringify(schema.inhabitantManifest('central')), JSON.stringify(central))
})

test('quaternal-logic: every face is declared waiting with a named owner; telemetry is an honest null; the family is the chronos contributor', () => {
  door.resetFamilyManifestsForTest()
  qlogic.quaternalLogicFamilyManifest()
  const manifest = schema.inhabitantManifest('quaternal-logic')
  assert.ok(manifest)
  assert.equal(manifest.faces.length, 6)
  for (const face of manifest.faces) {
    assert.equal(face.admission, 'waiting', `${face.id}: declared, waiting`)
    assert.ok(face.note && face.note.length > 40, `${face.id}: the note names what it waits for`)
    assert.equal(schema.faceKind(face), 'parameter', `${face.id}: declared faces carry no body until an owner lands`)
  }
  assert.deepEqual([...schema.validateInhabitantManifest(manifest)], [])
  assert.equal(manifest.telemetry, null)
  assert.deepEqual(manifest.time.contributes, ['chronos'])
  assert.deepEqual(manifest.time.consumes, [])
})

test('the L2 document and conversation faces carry §5.2/§5.3 bodies and pass the honesty validators', () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  const central = schema.inhabitantManifest('central')
  const die = central.faces.find(face => face.id === 'day-die')
  const flow = central.faces.find(face => face.id === 'flow-document')
  const nara = central.faces.find(face => face.id === 'nara-conversation')
  assert.equal(schema.faceKind(die), 'document')
  assert.equal(die.document.hosting, 'oi.document-frame/v1')
  assert.equal(die.document.file, 'ql-daily-die.html')
  assert.deepEqual(die.document.saveRouter, schema.SAVE_ROUTER_OUTCOMES)
  assert.deepEqual([...die.dock], ['dock', 'expand', 'pop-out'])
  assert.equal(schema.faceKind(flow), 'document')
  assert.equal(flow.document.file, 'ql-flow.html')
  assert.deepEqual(flow.document.saveRouter, schema.SAVE_ROUTER_OUTCOMES)
  assert.equal(schema.faceKind(nara), 'conversation')
  assert.equal(nara.conversation.binding, 'oi.nara-dialogue-binding/v1')
  // Central's pop-out faces require the family's detached kinds — the door declared them.
  assert.ok(central.detachedKinds.includes('flow') && central.detachedKinds.includes('encounter') && central.detachedKinds.includes('file'))
  // The whole world-shell set validates clean, composed state included.
  assert.equal(schema.validateAllInhabitantManifests().size, 0)
})

// ---------------------------------------------------------------------------
// 3 — the admission discipline: owner authority, immutability, collision.

test('extension discipline: unknown family refuses, differing re-declaration refuses, identical re-declaration is idempotent, face collision refuses', async () => {
  door.resetFamilyManifestsForTest()
  world.loadWorldShellFamilies()
  assert.throws(() => schema.declareFamilyExtension('nowhere-admitted', {id: 'x', by: 'test'}),
    /owner-admitted base/)
  const extension = {id: 'probe:one', by: 'test', faces: [{id: 'probe-face', presentations: ['compact']}]}
  schema.declareFamilyExtension('actuation', extension)
  assert.deepEqual(schema.declareFamilyExtension('actuation', extension), extension)
  assert.throws(() => schema.declareFamilyExtension('actuation', {id: 'probe:one', by: 'test', faces: [{id: 'other-face', presentations: ['compact']}]}),
    /different contents/)
  assert.throws(() => schema.declareFamilyExtension('actuation', {id: 'probe:two', by: 'test', faces: [{id: 'gateway', presentations: ['compact']}]}),
    /collides/)
})

// ---------------------------------------------------------------------------
// 4 — the aperture law: a seventh product integrates through admission only.

test('a seventh family integrates with document faces and detached kinds through the unchanged door', () => {
  door.resetFamilyManifestsForTest()
  const manifest = {
    id: 'seventh-product-proof',
    browser: ['proof'],
    faces: [
      {id: 'proof-parameter', presentations: ['compact']},
      {
        id: 'proof-document', presentations: ['compact', 'expanded'], kind: 'document',
        document: {
          kind: 'proof-form', file: 'proof.html', hosting: 'oi.document-frame/v1',
          saveRouter: ['saved', 'unchanged', 'stale', 'conflict', 'refused'], messages: ['proof:ping'],
        },
        dock: ['dock', 'expand', 'pop-out'],
      },
    ],
    params: {grammar: 'proof/v1'},
    projections: ['proof-projection'],
    inspectors: ['proof-inspector'],
    time: {consumes: ['transport'], contributes: []},
    telemetry: null,
    detachedKinds: ['file'],
  }
  door.admitFamilyManifest(manifest)
  const read = schema.inhabitantManifest('seventh-product-proof')
  assert.equal(schema.faceKind(read.faces[1]), 'document')
  assert.deepEqual([...schema.validateInhabitantManifest(read)], [])
  // The core door module knows no product names — the neutrality check.
  return readFile(new URL('../src/inhabitants/familyManifest.ts', import.meta.url), 'utf8').then(source => {
    for (const product of ['central', 'factory', 'aikit', 'workcell', 'quaternal', 'expressions', 'seventh']) {
      assert.doesNotMatch(source, new RegExp(product, 'i'), `the neutral door never says "${product}"`)
    }
  })
})

// ---------------------------------------------------------------------------
// 5 — the honesty validators name their faults.

test('the validators name the faults: bodies on the wrong kind, wrong router order, waiting with a body, pop-out without a door', () => {
  const bad = {
    id: 'bad',
    browser: [],
    faces: [
      // document face without a body
      {id: 'docless', presentations: ['compact'], kind: 'document'},
      // parameter face carrying a body
      {id: 'bodyless-kind', presentations: ['compact'], document: {
        kind: 'x', file: 'x.html', hosting: 'oi.document-frame/v1',
        saveRouter: ['saved', 'unchanged', 'stale', 'conflict', 'refused'], messages: ['x'],
      }},
      // document face with a truncated router
      {id: 'short-router', presentations: ['compact'], kind: 'document', document: {
        kind: 'x', file: 'x.html', hosting: 'oi.document-frame/v1',
        saveRouter: ['saved', 'conflict'], messages: ['x'],
      }},
      // waiting face carrying a body
      {id: 'waiting-with-body', presentations: ['compact'], admission: 'waiting', note: 'waits for its owner', conversation: {binding: 'oi.nara-dialogue-binding/v1'}},
      // waiting face with no note
      {id: 'silent-waiter', presentations: ['compact'], admission: 'waiting'},
      // pop-out face with no family detach door
      {id: 'popout-nowhere', presentations: ['compact'], dock: ['dock', 'pop-out']},
    ],
    params: {grammar: 'bad/v1'},
    projections: [],
    inspectors: [],
    time: {consumes: [], contributes: []},
    telemetry: null,
  }
  const faults = schema.validateInhabitantManifest(bad)
  const byFace = Object.fromEntries(faults.map(fault => [fault.split(':')[0], fault]))
  assert.match(byFace['bad/docless'], /declares a body/)
  assert.match(byFace['bad/bodyless-kind'], /carries a document body/)
  assert.match(byFace['bad/short-router'], /all five outcomes/)
  assert.match(byFace['bad/waiting-with-body'], /no body/)
  assert.match(byFace['bad/silent-waiter'], /names the owner/)
  assert.match(byFace['bad/popout-nowhere'], /detachedKinds/)
})

// ---------------------------------------------------------------------------
// 6 — EXPRESSIONS_FAMILIES loads through the schema: the 22 device families
// compose into one valid inhabitant manifest, losslessly.

test('EXPRESSIONS_FAMILIES compose into a valid InhabitantManifest, and the landed expressions manifest validates through the schema', async () => {
  const declarations = expressionsFamilies.EXPRESSIONS_FAMILIES
  assert.equal(declarations.length, 22)
  // The compatibility adapter: a declaration's faced flag is its presentation
  // standing (the rack compact set and the panel view are the port's recorded
  // surfaces); scope and registry ride the note verbatim.
  const manifest = {
    id: 'expressions',
    browser: ['works', 'material', 'objects', 'properties', 'devices'],
    faces: declarations.map(declaration => ({
      id: declaration.id,
      presentations: declaration.faced ? ['compact', 'expanded'] : [],
      note: `scope ${declaration.scope}; repeatable ${String(declaration.repeatable)}`,
    })),
    params: {grammar: 'parameterAddress.ts'},
    projections: ['expressions-track-adapter'],
    inspectors: ['rack', 'device-pool', 'GlyphSequenceEditor'],
    time: {consumes: ['Transport'], contributes: ['scenes', 'automation', 'takes']},
    telemetry: 'observation.effectiveValues',
  }
  assert.deepEqual([...schema.validateInhabitantManifest(manifest)], [], 'the composed expressions family validates')
  // Losslessness: one face per declared family, order preserved, no invention.
  assert.deepEqual(manifest.faces.map(face => face.id), declarations.map(declaration => declaration.id))
  // The landed composed manifest (the boundary declaration + the real
  // registries) also passes the generalised validators.
  const landed = expressionsManifest.expressionsFamilyManifest()
  assert.deepEqual([...schema.validateInhabitantManifest(landed)], [], 'the landed expressions manifest validates through the schema')
})

// ---------------------------------------------------------------------------
// 7 — the save router model: named outcomes classified from the real paths.

test('the document save-router model classifies the real save paths onto the five named outcomes', () => {
  const outcomes = docModel.SAVE_ROUTER_OUTCOMES
  assert.deepEqual([...outcomes], ['saved', 'unchanged', 'stale', 'conflict', 'refused'])
  // The owner's "source changed; review its current revision" block → stale.
  assert.equal(docModel.classifySaveFailure(new Error('Native source changed; review its current revision before saving retained drafts.')).outcome, 'stale')
  // An unavailable owner → refused.
  assert.equal(docModel.classifySaveFailure(new Error('The native Day owner is unavailable.')).outcome, 'refused')
  // A contradictory acknowledgement → conflict.
  assert.equal(docModel.classifySaveFailure(new Error('Missing or contradictory native save acknowledgement; the effect is unknown')).outcome, 'conflict')
  // Named labels for the strip, one per outcome.
  for (const outcome of outcomes) {
    assert.match(docModel.outcomeLabel({outcome}), new RegExp(outcome))
  }
  assert.equal(docModel.outcomeLabel(undefined), null)
})

// ---------------------------------------------------------------------------
// 8 — the manifest modules stay pure: no React, no views.

test('the L2 manifest modules import no React view', async () => {
  for (const file of [
    'manifest.ts',
    'worldShellFamilies.ts',
    'quaternalLogicFamilyManifest.ts',
    'documentDeviceModel.ts',
  ]) {
    const source = await readFile(new URL(`../src/inhabitants/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /from ['"].*\.tsx['"]/, file)
    assert.doesNotMatch(source, /from ['"]react['"]/, file)
  }
})
