import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// The holders (DEVICE-SEMANTICS-LOCK §4.8, §4.9; ticket T-HOLDERS). Every face
// names the device that holds it (`heldBy`); the gate refuses a naming it cannot
// stand behind. Four gate rules: a known holder; an admitted Technē face held by a
// techne:* instrument; an Expressions face held by exactly one holder; an effect
// never held by a techne:* instrument.

// Production modules in memory (the house loader pattern, as live-semantics.test.mjs).
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
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const centralL7 = await import('../src/inhabitants/centralFamilyL7.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const semantics = await import('../src/inhabitants/sdk/semantics.ts')
const expressions = await import('../src/expressions/expressionsFamilyManifest.ts')

const faultsOf = (face, family) => semantics.validateFaceSemantic(face, {family})

// ---------------------------------------------------------------------------
// 0 — the standing world. Runs FIRST: the atlas family self-admits on import, and a
// door reset would clear it for later tests (as live-semantics.test.mjs does).

test('the standing world passes the holder rules: every door face names known holders and the Technē rule holds', () => {
  world.loadWorldShellFamilies()
  centralL7.declareCentralFamilyL7()
  const gate = sdkValidate.validateAdmittedWorld()
  assert.deepEqual([...gate.byFamily.entries()], [], 'no family faults in the standing world')
  assert.deepEqual(gate.cross, [], 'no cross-family faults in the standing world')
  const registry = sdkValidate.semanticRegistry()
  const find = (family, face) => registry.find(entry => entry.family === family && entry.face === face)
  assert.deepEqual(find('atlas-earth', 'globe-engine').heldBy, ['techne:m0', 'techne:m4'], 'the Earth is the 0 instrument (lock §0.1.3)')
  assert.deepEqual(find('atlas-earth', 'time-control').heldBy, ['techne:m2', 'techne:m0'], 'the Earth pane\'s clock is the 0 instrument\'s too')
  assert.deepEqual(find('quaternal-logic', 'torus').heldBy, ['studio:body'])
  assert.deepEqual(find('quaternal-logic', 'sky').heldBy, ['techne:m4', 'techne:m2'])
  assert.deepEqual(find('quaternal-logic', 'deck').heldBy, [], 'a waiting face with no named holder carries none')
  // The Studio table and the faces agree: a holder's non-Expressions references name it back.
  for (const holder of semantics.HOLDERS) {
    for (const reference of holder.holds ?? []) {
      if (reference.startsWith('expressions/')) continue
      const [family, id] = reference.split('/')
      const entry = find(family, id)
      assert.ok(entry, `${holder.id} holds "${reference}", which the world declares`)
      assert.ok(entry.heldBy.includes(holder.id), `${reference} names ${holder.id} as its holder`)
    }
  }
})

// ---------------------------------------------------------------------------
// 1 — the tables: the Studio chain, the Clip detail, the six Technē instruments.

test('the Studio is the Expressions device chain: eight sections, in the mockup order, and each section is a device', async () => {
  const mockup = await readFile(new URL('desktop/cradle/docs/world-shell/world-shell-mockup.html', root), 'utf8')
  const start = mockup.indexOf("instFrame('','Studio'")
  assert.ok(start > 0, 'the mockup carries the Expressions Studio block')
  const end = mockup.indexOf("$('#dth').innerHTML=head;$('#chain').innerHTML=html;return}", start)
  const titles = [...mockup.slice(start, end).matchAll(/\{h:'([^']+)'/g)].map(match => match[1])
  assert.equal(titles.length, 8, `the mockup's Studio has eight sections (${titles.join(' | ')})`)
  const ids = titles.map(title => semantics.STUDIO_SECTIONS.find(section => title.startsWith(section.title))?.id)
  assert.deepEqual(ids, semantics.STUDIO_SECTIONS.map(section => section.id), 'the Studio table follows the mockup order exactly')
  assert.deepEqual(semantics.STUDIO_SECTIONS.map(section => section.liveSemantic), [
    'device-audio-fx', 'device-audio-fx', 'device-audio-fx', 'device-audio-fx', 'device-audio-fx',
    'device-instrument', 'modulation', 'capture',
  ], 'the Studio sections carry the semantics of the table (Body is the instrument; Nara · M4 and Capture are designed)')
  assert.equal(semantics.STUDIO_SECTIONS.find(section => section.id === 'studio:body').provenance, 'M1+M2+M3')
})

test('every holder names a legal Live semantic and a unique id; the six Technē instruments are instruments, each with its M′ provenance', () => {
  const ids = semantics.HOLDERS.map(holder => holder.id)
  assert.equal(new Set(ids).size, ids.length, 'holder ids are unique')
  for (const holder of semantics.HOLDERS) {
    assert.ok(semantics.isLiveSemantic(holder.liveSemantic), `${holder.id} occupies "${holder.liveSemantic}"`)
  }
  assert.deepEqual(semantics.TECHNE_INSTRUMENTS.map(holder => holder.id), ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m4', 'techne:m5'])
  assert.deepEqual(semantics.TECHNE_INSTRUMENTS.map(holder => holder.provenance), ['M0′', 'M1′', 'M2′', 'M3′', 'M4′', 'M5′'])
  for (const instrument of semantics.TECHNE_INSTRUMENTS) {
    assert.equal(instrument.liveSemantic, 'device-instrument', `${instrument.id} is an instrument, never an effect`)
    assert.notEqual(instrument.title, instrument.provenance, 'the plain name is the name; the M′ address is provenance')
  }
  assert.equal(semantics.DETAIL_CLIP_HOLDER.liveSemantic, 'detail-clip')
  assert.equal(semantics.isHolder('detail:clip'), true)
  assert.equal(semantics.isHolder('studio:nowhere'), false)
})

test('the Clip detail holds the Expressions scene and its automation (a scene is a clip; lock §9.1, §9.4)', () => {
  assert.deepEqual(semantics.DETAIL_CLIP_HOLDER.holds, ['expressions/scene', 'expressions/automation'])
})

// ---------------------------------------------------------------------------
// 2 — every Expressions face appears in exactly one holder (lock §4.8).

test('every Expressions face is held by exactly one holder, and the Studio table names no face that does not exist', () => {
  const family = expressions.expressionsFamilyManifest()
  assert.equal(family.faces.length, 22, 'the Expressions family carries its 22 faces')
  const faceIds = new Set(family.faces.map(face => face.id))
  for (const face of family.faces) {
    const holders = semantics.HOLDERS.filter(holder => holder.holds?.includes(`expressions/${face.id}`))
    assert.equal(holders.length, 1, `${face.id} is held by exactly one holder (${holders.map(holder => holder.id).join(', ') || 'none'})`)
    assert.deepEqual(face.heldBy, [holders[0].id], `${face.id} names its holder`)
  }
  for (const holder of semantics.HOLDERS) {
    for (const reference of holder.holds ?? []) {
      if (!reference.startsWith('expressions/')) continue
      assert.ok(faceIds.has(reference.slice('expressions/'.length)), `${holder.id} holds "${reference}", which is an Expressions face`)
    }
  }
  const holderOf = Object.fromEntries(family.faces.map(face => [face.id, face.heldBy[0]]))
  assert.equal(holderOf.pointer, 'studio:tools')
  assert.equal(holderOf.physics, 'studio:body')
  assert.equal(holderOf.resonance, 'studio:body')
  assert.equal(holderOf.scene, 'detail:clip')
  assert.equal(holderOf.automation, 'detail:clip')
  assert.equal(holderOf.meaning, 'studio:selected')
})

// ---------------------------------------------------------------------------
// 3 — each refusal, at the gate. The fault names the law.

test('an unknown holder is refused, with the holders the gate knows', () => {
  const faults = faultsOf({id: 'probe', liveSemantic: 'info', heldBy: ['studio:nowhere']}, 'probe-world')
  assert.ok(faults.some(fault => /heldBy "studio:nowhere" is not a known holder/.test(fault)), faults.join(' | '))
  assert.deepEqual(faultsOf({id: 'probe', liveSemantic: 'info', heldBy: ['detail:clip']}, 'probe-world'), [], 'a known holder is admitted')
})

test('an admitted Technē face is held by a techne:* instrument; a waiting face is exempt until its owner lands', () => {
  const admitted = {id: 'probe', liveSemantic: 'device-instrument', invariant: {generates: 'kernel:receiving'}}
  const faults = faultsOf({...admitted, heldBy: ['studio:body']}, 'quaternal-logic')
  assert.ok(faults.some(fault => /is held by a techne:\* instrument/.test(fault)), faults.join(' | '))
  assert.deepEqual(faultsOf({...admitted, heldBy: ['techne:m1']}, 'quaternal-logic'), [], 'an admitted Technē face held by an instrument is admitted')
  const waiting = {id: 'probe', liveSemantic: 'device-instrument', admission: 'waiting', note: 'waits for its owner'}
  assert.deepEqual(faultsOf({...waiting, heldBy: ['studio:body']}, 'quaternal-logic'), [], 'a waiting face is exempt from the Technē rule')
  assert.deepEqual(faultsOf(waiting, 'quaternal-logic'), [], 'a waiting face with no holder declared yet is admitted')
})

test('an Expressions face held twice, or not at all, is refused at the family gate (lock §4.8)', () => {
  const pointer = {id: 'pointer', liveSemantic: 'device-audio-fx', invariant: {transforms: 'the field under the pointer'}}
  const none = semantics.validateHolderCoverage('expressions', [pointer])
  assert.ok(none.some(fault => /held by exactly one holder — heldBy names 0/.test(fault)), none.join(' | '))
  const twice = semantics.validateHolderCoverage('expressions', [{...pointer, heldBy: ['studio:tools', 'studio:selected']}])
  assert.ok(twice.some(fault => /held by exactly one holder — heldBy names 2/.test(fault)), twice.join(' | '))
  assert.deepEqual(semantics.validateHolderCoverage('expressions', [{...pointer, heldBy: ['studio:tools']}]), [], 'one holder is admitted')
  assert.deepEqual(semantics.validateHolderCoverage('probe-world', [pointer]), [], 'coverage is the Expressions family\'s law; other families are not held to it')
})

test('a hand-composed Expressions face with no holders passes the per-face gate; the family coverage refuses it', () => {
  // The compatibility adapter (inhabitant-manifest.test.mjs) composes Expressions faces by hand; the
  // per-face gate judges their semantics, and coverage is judged where the family's faces are composed.
  const handComposed = {id: 'pointer', liveSemantic: 'device-audio-fx', invariant: {transforms: 'x'}}
  assert.deepEqual(faultsOf(handComposed, 'expressions'), [])
  assert.equal(semantics.validateHolderCoverage('expressions', [handComposed]).length, 1)
})

test('an effect is never held by a techne:* instrument: a Technē chain device is an instrument', () => {
  const faults = faultsOf({id: 'probe', liveSemantic: 'device-audio-fx', invariant: {transforms: 'x'}, heldBy: ['techne:m1']}, 'probe-world')
  assert.ok(faults.some(fault => /an effect cannot be held by a techne:\* instrument/.test(fault)), faults.join(' | '))
})

// ---------------------------------------------------------------------------
// 4 — the door: the kit and the door refuse what the gate refuses; the kit's
// heldBy reaches the door's face.

test('the door refuses a family whose face names an unknown holder, and the kit carries a known holder onto the door', () => {
  door.resetFamilyManifestsForTest()
  const unknown = {
    id: 'probe-world', browser: ['probe'], faces: [{id: 'p', presentations: ['compact'], liveSemantic: 'info', heldBy: ['studio:nowhere']}],
    params: {grammar: 'probe/parameter-address/v1'}, projections: [], inspectors: [], time: {consumes: [], contributes: []}, telemetry: null,
  }
  assert.throws(() => door.admitFamilyManifest(unknown), /not a known holder/)
  assert.equal(door.familyManifest('probe-world'), undefined, 'a refused family never reaches the door')
  assert.throws(
    () => sdkDefine.admitFamily({
      id: 'acme', owner: 'Acme Instruments', browser: ['acme'], paramsGrammar: 'acme/parameter-address/v1',
      devices: [{id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'info', heldBy: ['studio:nowhere'], note: 'a probe'}],
    }),
    /not a known holder/,
  )
  sdkDefine.admitFamily({
    id: 'acme', owner: 'Acme Instruments', browser: ['acme'], paramsGrammar: 'acme/parameter-address/v1',
    devices: [{id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'info', heldBy: ['detail:clip'], note: 'a probe'}],
  })
  assert.deepEqual(door.familyManifest('acme').faces[0].heldBy, ['detail:clip'], 'the kit carries heldBy onto the door face')
  door.resetFamilyManifestsForTest()
})

