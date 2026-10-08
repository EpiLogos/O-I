import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production sources in memory, same loader as the sibling native composition suites.
// Formation add is one named edit over the retained owner; no native effect is simulated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)


// The starter builders (src/components/nativeStarters.ts) against the real retained owner: each batch goes through
// the same apply path the Browser uses, and the result is compared with the app's own helper run on a clone.
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [starters, features, model, {kernelDocumentToJourney}, {DocumentStore}, {createRetainedNativeEditor}, semanticPresets, engine] = await Promise.all([
  import(new URL('../src/components/nativeStarters.ts', import.meta.url)),
  import(new URL('nativeFeatures.ts', author)), import(new URL('model.ts', author)), import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('store.ts', author)), import(new URL('hostEditor.ts', author)),
  import(new URL('desktop/cradle/expressions-app/src/engine/semantics/chakraPresets.ts', root)),
  import(new URL('desktop/cradle/expressions-app/src/engine/compositionPresets.ts', root)),
])
const formations = await import(new URL('nativeFormations.ts', boundary))
const sizing = await import(new URL('stateSizing.ts', author))
const {captureObjectState} = await import(new URL('sourceState.ts', author))
const nativeDocument = JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack.json', import.meta.url), 'utf8'))
const blocked = () => {throw Error('Native effects are closed in starter verification')}

/** A retained owner over the fixture Scene, with the given formations as its entities and a selection the test names. */
function owner(entities, {selected = [], pending = false} = {}) {
  const view = kernelDocumentToJourney(structuredClone(nativeDocument)), store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(s => s.id === view.startSceneId) ?? store.document.scenes[0]
  scene.entities = entities
  scene.engine.autoFitSizes = true
  const selection = {entity_ids: selected, step_id: null}
  const retained = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => selection, nativeView: () => view,
    nativeSelect: blocked, commit: async () => true, change: mutate => store.change(mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
  const read = () => {const r = retained.read(); return pending ? {...r, standing: {...r.standing, pending: true}} : r}
  // The owner's apply resolves to nothing and throws on refusal; the Browser sees the same refusal as a reply.
  const request = async (changes, basis) => {
    try {await retained.apply({operation: 'apply', basis: basis ?? read().basis, changes}); return {ok: true, reading: read()}}
    catch (cause) {return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}}
  }
  return {retained, scene, read, request, sceneId: scene.id}
}
const glyphFormation = (name, text, x = 0) => model.entity(name, text, {x, y: 0, z: 0})
const round = n => Number(n.toFixed(9))
const boxOf = size => size ? {x: round(size.x), y: round(size.y)} : null
const sequenceView = e => ({
  name: e.name, kind: e.kind, shape: e.shape, text: e.text, locked: e.locked, size: boxOf(e.size),
  sequence: {enabled: e.sequence.enabled, clock: e.sequence.clock, order: e.sequence.order, hold: e.sequence.hold, transition: e.sequence.transition, easing: e.sequence.easing ?? null,
    steps: e.sequence.steps.map(s => ({text: s.text, shape: s.shape, hold: s.hold, transition: s.transition, position: s.position ?? null, source: s.source ?? null, layers: s.layers ?? [], box: boxOf(s.objectState?.size)}))},
})
/** The app's handler runs the helper, then refitFormationToGlyphs with the Scene font (app.ts native-chain / native-kundalini-sequence). */
const appResult = (entity, scene, helper) => {
  const expected = structuredClone(entity); helper(expected)
  sizing.refitFormationToGlyphs(expected, {fontFamily: scene.engine.fontFamily, fontWeight: scene.engine.fontWeight})
  return expected
}
/** Structural comparison: names, shapes, sizes, state counts, timings, sources, positions, settings and state boxes. */
const assertSequenceEqual = (actual, expected) => assert.deepEqual(sequenceView(actual), sequenceView(expected))

test('the kundalini rising sequence: two batches reproduce the app helper, placed by the reply ids', () => {
  const heart = glyphFormation('Heart', 'O'); heart.sequence.steps = [
    {id: 'old-a', text: 'A', shape: 'text', layers: [], hold: 2, transition: 1, position: null},
    {id: 'old-b', text: 'B', shape: 'text', layers: [], hold: 2, transition: 1, position: null}]
  const fixture = owner([heart], {selected: [heart.id]})
  const first = fixture.request(starters.kundaliniSequenceChanges(fixture.read(), heart.id).map(c => c))
  return first.then(async reply => {
    assert.equal(reply.ok, true, reply.error)
    const placed = await fixture.request(starters.kundaliniPlacementChanges(reply.reading, heart.id))
    assert.equal(placed.ok, true, placed.error)
    const actual = placed.reading.scene.entities.find(e => e.id === heart.id)
    assertSequenceEqual(actual, appResult(heart, fixture.scene, features.applyKundaliniSequence))
    assert.equal(placed.reading.scene.entities.length, 1)
    assert.equal(actual.sequence.steps.length, 7)
  })
})

test('the kundalini starter runs as two steps through the runner and leaves no unplaced state', async () => {
  const heart = glyphFormation('Heart', 'O'); heart.sequence.steps = [{id: 'old', text: 'A', shape: 'text', layers: [], hold: 3, transition: 1, position: null}]
  const fixture = owner([heart], {selected: [heart.id]})
  const progress = []
  const result = await starters.runStarter([r => starters.kundaliniSequenceChanges(r, heart.id), r => starters.kundaliniPlacementChanges(r, heart.id)],
    fixture.read(), fixture.request, line => progress.push(line))
  assert.deepEqual(result, {ok: true})
  assert.equal(progress.length, 2)
  const after = fixture.read().scene.entities.find(e => e.id === heart.id)
  assert.ok(after.sequence.steps.every(s => s.position !== null), 'every new state is placed')
})

test('each chain preset reproduces the app applyChain on the selected formation in one batch', async () => {
  for (const preset of features.CHAIN_PRESETS) {
    const heart = glyphFormation('Heart', 'O'); heart.sequence.hold = 5; heart.sequence.transition = 4
    const fixture = owner([heart], {selected: [heart.id]})
    const changes = starters.chainStepChanges(fixture.read(), heart.id, preset.id)
    assert.equal(changes.filter(c => c.kind === 'step-insert').length, preset.chain.length, preset.id)
    const reply = await fixture.request(changes)
    assert.equal(reply.ok, true, `${preset.id}: ${reply.ok ? '' : reply.error}`)
    const actual = reply.reading.scene.entities.find(e => e.id === heart.id)
    assertSequenceEqual(actual, appResult(heart, fixture.scene, e => features.applyChain(e, preset.id)))
    assert.equal(reply.reading.scene.entities.length, 1, 'a chain adds no formation')
  }
})

test('the starters refuse with the reason before any batch: no selection, pin, lock, pending, state budget', () => {
  const heart = glyphFormation('Heart', 'O'), pin = glyphFormation('Pin', 'O'); pin.kind = 'pin'
  const locked = glyphFormation('Locked', 'O'); locked.locked = true
  const open = owner([heart, pin, locked], {selected: [heart.id]}).read()
  assert.throws(() => starters.kundaliniSequenceChanges(open, undefined), /Select a formation first/)
  assert.throws(() => starters.chainStepChanges(open, pin.id, 'platonic_polygons'), /pin carries no sequence/)
  assert.throws(() => starters.kundaliniSequenceChanges(open, locked.id), /Unlock this formation/)
  assert.throws(() => starters.chainStepChanges(open, heart.id, 'no-such-preset'), /Unknown native sequence preset/)
  assert.throws(() => starters.kundaliniSequenceChanges({...open, standing: {...open.standing, pending: true}}, heart.id), /acknowledge/)
  assert.throws(() => starters.kundaliniSequenceChanges(null, heart.id), /Open a native Expression/)
  // The state budget: 25 old states plus seven seed syllables is exactly 32; 26 is refused before sending.
  const crowded = glyphFormation('Crowded', 'O')
  const states = n => Array.from({length: n}, (_, i) => ({id: 's' + i, text: 'x', shape: 'text', layers: [], hold: 3, transition: 1, position: null}))
  crowded.sequence.steps = states(25)
  const fits = owner([crowded], {selected: [crowded.id]}).read()
  assert.equal(starters.kundaliniSequenceChanges(fits, crowded.id).filter(c => c.kind === 'step-insert').length, 7)
  crowded.sequence.steps = states(26)
  const over = owner([crowded], {selected: [crowded.id]}).read()
  assert.throws(() => starters.kundaliniSequenceChanges(over, crowded.id), /32 states/)
  assert.throws(() => starters.chainStepChanges(over, crowded.id, 'chakra_kundalini_ascent'), /32 states/)
})

test('a refused first step stops the runner; the reply error is returned as data and no second batch is sent', async () => {
  const heart = glyphFormation('Heart', 'O')
  const sent = []
  const request = async (changes, basis) => { sent.push(changes.length); return {ok: false, error: 'refused by the owner'} }
  const fixture = owner([heart], {selected: [heart.id]})
  const result = await starters.runStarter([r => starters.kundaliniSequenceChanges(r, heart.id), r => starters.kundaliniPlacementChanges(r, heart.id)], fixture.read(), request)
  assert.deepEqual(result, {ok: false, error: 'refused by the owner'})
  assert.equal(sent.length, 1)
})

test('the Semantic Chakra Body is not expressible: its centres are yantra formations the add form does not carry', () => {
  const open = owner([glyphFormation('Only', 'O')]).read()
  assert.throws(() => starters.chakraAddChanges(open), /yantra formations/)
  assert.throws(() => formations.validateFormationAdd({kind: 'formation-add', shape: 'yantra'}), /formation shape/)
  const full = owner(Array.from({length: 26}, (_, i) => glyphFormation('F' + i, 'O'))).read()
  assert.throws(() => starters.chakraAddChanges(full), /32 formations/)
})

test('the chakra meaning step binds the seven new centres to the starter meanings and field law', async () => {
  const centres = semanticPresets.makeSemanticChakraEntities('yantra'), source = semanticPresets.makeChakraSemanticField(centres, 'constant')
  // Drift check: the builder's source is the preset's own field, not a copy that could fall out of step.
  assert.deepEqual(engine.COMPOSITION_PRESETS.find(p => p.id === 'chakra_body').build().semanticField, source)
  // Stand-in centres: text formations at the starter positions, so the meaning step can be exercised on real ids.
  const texts = centres.map((c, i) => glyphFormation(c.name, '·', i * 0.2))
  const fixture = owner([], {selected: []})
  const added = await fixture.request(texts.map((t, i) => ({kind: 'formation-add', title: t.name, shape: 'text', text: '·', position: {x: i * 0.2, y: 0, z: 0}})))
  assert.equal(added.ok, true, added.error)
  const ids = added.reading.scene.entities.map(e => e.id)
  const bound = await fixture.request(starters.chakraBindChanges(added.reading, ids))
  assert.equal(bound.ok, true, bound.error)
  const field = bound.reading.scene.semanticField
  assert.equal(field.enabled, true)
  assert.deepEqual(field.profile, source.profile)
  assert.deepEqual(field.affinity, source.affinity)
  assert.equal(field.globalColorGain, source.globalColorGain)
  assert.equal(field.bindings.length, 7)
  const strip = b => ({semanticNodeId: b.semanticNodeId, enabled: b.enabled, color: b.color ?? null, resonance: b.resonance ?? null, modulations: b.modulations ?? null})
  assert.deepEqual(field.bindings.map(strip), source.bindings.map(strip))
  field.bindings.forEach((b, i) => assert.deepEqual(b.carriers, [{kind: 'entity', id: ids[i]}]))
  assert.equal(new Set(field.bindings.map(b => b.id)).size, 7, 'fresh binding identities')
})

test('replacing a formation with several states of its own still matches the app result, boxes included', async () => {
  const withStates = () => {
    const e = glyphFormation('Crown', 'O')
    const captured = captureObjectState(e).objectState
    e.sequence.steps = [
      {id: 'p0', text: 'a', shape: 'text', layers: [], hold: 2, transition: 1, position: {x: 0.1, y: 0.2, z: 0}, objectState: {...structuredClone(captured), size: {x: 0.3, y: 0.4}, normalized: true}},
      {id: 'p1', text: 'b', shape: 'text', layers: [], hold: 2, transition: 1, position: null},
      {id: 'p2', text: 'c', shape: 'text', layers: [], hold: 4, transition: 2, position: null, objectState: {...structuredClone(captured), size: {x: 0.9, y: 0.2}, normalized: true}}]
    e.sequence.enabled = true; e.sequence.hold = 2.5
    return e
  }
  const run = async (build, helper) => {
    const heart = withStates(), fixture = owner([heart], {selected: [heart.id]})
    const steps = build(heart.id)
    const result = await starters.runStarter(steps, fixture.read(), fixture.request)
    assert.deepEqual(result, {ok: true})
    const actual = fixture.read().scene.entities.find(e => e.id === heart.id)
    assertSequenceEqual(actual, appResult(withStates(), fixture.scene, helper))
  }
  await run(id => [r => starters.kundaliniSequenceChanges(r, id), r => starters.kundaliniPlacementChanges(r, id)], features.applyKundaliniSequence)
  await run(id => [r => starters.chainStepChanges(r, id, 'sacred_geometry')], e => features.applyChain(e, 'sacred_geometry'))
})

test('the Starters rows name the app presets and the kundalini sequence, and disable with the reason', async () => {
  const {createElement} = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const panel = await import(new URL('../src/components/NativeObjectBrowser.tsx', import.meta.url))
  const heart = glyphFormation('Heart', 'O'), pin = glyphFormation('Pin', 'O'); pin.kind = 'pin'
  const render = reading => renderToStaticMarkup(createElement(panel.NativeObjectBrowser, {rows: [], reading, request: async () => ({ok: true, reading})}))
  const selected = owner([heart], {selected: [heart.id]}).read()
  const html = render(selected)
  assert.match(html, /Kundalini sequence \(on selected formation\)/)
  for (const preset of features.CHAIN_PRESETS) assert.ok(html.includes(`Chain: ${preset.name}`.replace(/&/g, '&amp;')) || html.includes(`Chain: ${preset.name}`), preset.name)
  assert.doesNotMatch(html, /Semantic Chakra Body/, 'the chakra starter has no row: it is not expressible')
  assert.doesNotMatch(html, /role="alert"/)
  const none = render(owner([heart]).read())
  assert.match(none, /Select a formation first\./)
  const onPin = render(owner([pin], {selected: [pin.id]}).read())
  assert.match(onPin, /pin carries no sequence/)
  assert.match(render(null), /Open a native Expression to add a starter\./)
})
