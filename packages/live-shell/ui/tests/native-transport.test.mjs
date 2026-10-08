import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests. The
// reading comes from the retained owner over a minimal native document; no
// store, server or native engine is simulated beyond that.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)

const root = new URL('../../../../', import.meta.url)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const [P, C, NT, AT, NSE, Scenes, Host, Retained, Bridge, Model, Store] = await Promise.all([
  import('../src/components/nativeScenePlayback.ts'),
  import('../src/shell/nativeContent.ts'),
  import('../src/components/NativeTransportBar.tsx'),
  import('../src/components/nativeArrangementTimeline.tsx'),
  import('../src/components/NativeSceneEditor.tsx'),
  import(new URL('scenes.ts', boundary)),
  import(new URL('editorHost.ts', boundary)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
  import(new URL('model.ts', author)),
  import(new URL('store.ts', author)),
])

const SCENE = 'expression:whole:scene:main'
const PLAYBACK = {scene_ref: SCENE, scene_elapsed_seconds: 0, expression_time_seconds: 0, scene_playing: false,
  saved_sequence_playing: false, field_paused: false, track_preview: false}
const blocked = () => {throw Error('This test does not dispatch the owner effect')}

/** The owner's reading of one Expression with a single Scene, Journey loop as given. */
function ownerReading(loop) {
  const journey = Model.blankJourney()
  journey.name = 'A working inquiry'
  journey.scenes[0].name = 'First'
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:whole', revision: 1, title: journey.name,
    scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
    selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  const view = Bridge.kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}})
  view.journey.loop = loop
  const store = new Store.DocumentStore(view.journey)
  const scene = store.document.scenes.find(value => value.id === view.startSceneId) ?? store.document.scenes[0]
  const selection = {entity_ids: [], step_id: null}
  const owner = Retained.createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => selection, nativeView: () => view,
    nativeSelect: blocked, commit: blocked, change: mutate => store.change(mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => ({...PLAYBACK, intent_epoch: 0}), recording: () => false, transitionPending: () => false,
      focus: blocked, transport: blocked, seek: blocked, snapshot: blocked}})
  return owner.read()
}

const idle = {scene_playing: false, saved_sequence_playing: false, scene_elapsed_seconds: 0, scene_ref: SCENE, field_paused: false}
const row = (scene_ref, available) => ({scene_ref, available})
function model(overrides = {}) {
  return P.sceneTransportModel({ready: true, focused: true,
    scene: {scene_ref: SCENE, available: true, reason: null, duration: 8}, rows: [row(SCENE, true)],
    playback: idle, savedAvailable: true, loop: false, ...overrides})
}

test('the owner reading carries the Journey loop flag and the validator normalises it', () => {
  assert.equal(ownerReading(true).scenes.loop, true)
  assert.equal(ownerReading(false).scenes.loop, false)
  const wire = JSON.parse(JSON.stringify(ownerReading(true)))
  assert.equal(Host.reading(wire), true, 'the owner reading is admitted as a whole')
  assert.equal(wire.scenes.loop, true)
  const older = JSON.parse(JSON.stringify(ownerReading(true)))
  delete older.scenes.loop
  assert.equal(Host.reading(older), true)
  assert.equal(older.scenes.loop, false, 'an absent flag is an older reading that is not looping')
  const invalid = JSON.parse(JSON.stringify(ownerReading(true)))
  invalid.scenes.loop = 'yes'
  assert.equal(Host.reading(invalid), false, 'a non-boolean loop flag is refused')
})

test('play toggles with the playing state and says why it cannot', () => {
  const stopped = model()
  assert.deepEqual([stopped.play.action, stopped.play.label, stopped.play.disabled, stopped.play.reason], ['play', 'Play Scene', false, null])
  const playing = model({playback: {...idle, scene_playing: true, scene_elapsed_seconds: 2}})
  assert.deepEqual([playing.play.action, playing.play.label], ['pause', 'Pause Scene'])
  const busy = model({ready: false})
  assert.equal(busy.play.disabled, true)
  assert.match(busy.play.reason, /Finish the current Scene operation/)
  const empty = model({scene: {scene_ref: SCENE, available: false, reason: 'No authored native Scene material is disclosed', duration: null}})
  assert.equal(empty.play.disabled, true)
  assert.equal(empty.play.reason, 'No authored native Scene material is disclosed')
})

test('stop is one working seek to zero, and says why there is nothing to stop', () => {
  assert.equal(model().stop.disabled, true, 'idle at zero has nothing to stop')
  assert.match(model().stop.reason, /idle at its start/)
  const playing = model({playback: {...idle, scene_playing: true, scene_elapsed_seconds: 2}})
  assert.deepEqual(playing.stop.request, {action: 'seek', scene_ref: SCENE, seconds: 0, sequence: 'working'})
  assert.equal(playing.stop.disabled, false)
  const saved = model({playback: {...idle, saved_sequence_playing: true}})
  assert.ok(saved.stop.request, 'saved playback also stops through the same seek')
  const noDuration = model({scene: {scene_ref: SCENE, available: true, reason: null, duration: null}, playback: {...idle, scene_playing: true}})
  assert.match(noDuration.stop.reason, /no authored working duration/)
})

test('saved scenes is a distinct toggle that names its unavailable reason', () => {
  assert.deepEqual([model().saved.action, model().saved.pressed], ['play-saved', false])
  assert.equal(model({savedAvailable: false}).saved.disabled, true)
  assert.equal(model({savedAvailable: false}).saved.reason, 'Save the Scene sequence before playing it.')
  const playingSaved = model({savedAvailable: false, playback: {...idle, saved_sequence_playing: true}})
  assert.deepEqual([playingSaved.saved.action, playingSaved.saved.pressed, playingSaved.saved.disabled], ['stop-saved', true, false],
    'a saved sequence that is playing can always be stopped')
  assert.equal(model({ready: false}).saved.disabled, true)
})

test('the scrubber is blocked during saved playback, with the reason named', () => {
  assert.equal(model().scrub.block, null)
  assert.match(model({playback: {...idle, saved_sequence_playing: true}}).scrub.block, /working Scene only/)
  assert.match(model({scene: {scene_ref: SCENE, available: true, reason: null, duration: null}}).scrub.block, /no authored working duration/)
  assert.match(model({ready: false}).scrub.block, /busy/)
})

test('loop shows the owner flag and needs a focused Scene and a saved sequence to change', () => {
  assert.deepEqual(model({loop: true}).loop, {on: true, reason: null})
  assert.equal(model({loop: false, savedAvailable: false}).loop.reason, 'Save the Scene sequence before looping it.')
  assert.equal(model({focused: false}).loop.reason, 'Focus a Scene before changing its loop.')
  assert.equal(model({ready: false}).loop.reason, 'Finish the current Scene operation first.')
})

test('physics is read-only; recording is the frame take control, not part of the transport model', () => {
  assert.deepEqual([model().physics.held, model().physics.label], [false, 'Physics running'])
  assert.deepEqual([model({playback: {...idle, field_paused: true}}).physics.held, model({playback: {...idle, field_paused: true}}).physics.label], [true, 'Physics held'])
  assert.match(model().physics.title, /set in the Studio/)
  assert.equal('record' in model(), false, 'the take control reads the frame link (frameTakes.ts), not this model')
})

test('neighbour Scenes skip those without material and stop at the ends', () => {
  const rows = [row('scene:a', true), row('scene:b', false), row('scene:c', true)]
  assert.equal(P.adjacentSceneRef(rows, 'scene:a', 1), 'scene:c')
  assert.equal(P.adjacentSceneRef(rows, 'scene:c', -1), 'scene:a')
  assert.equal(P.adjacentSceneRef(rows, 'scene:c', 1), null)
  assert.equal(P.adjacentSceneRef(rows, 'scene:x', 1), null)
})

test('Space toggles only with nothing focused and no modifier or repeat', () => {
  const base = {key: ' ', repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, focusIsBody: true}
  assert.equal(P.spaceTogglesPlayback(base), true)
  assert.equal(P.spaceTogglesPlayback({...base, focusIsBody: false}), false, 'a focused control or editor keeps Space')
  assert.equal(P.spaceTogglesPlayback({...base, repeat: true}), false)
  assert.equal(P.spaceTogglesPlayback({...base, shiftKey: true}), false)
  assert.equal(P.spaceTogglesPlayback({...base, metaKey: true}), false)
  assert.equal(P.spaceTogglesPlayback({...base, key: 'a'}), false)
})

test('the content adapter sends each transport control as one owner request on its basis', async () => {
  const reading = ownerReading(false)
  const content = C.readNativeExpressionsContent(reading)
  const sent = []
  const actions = C.createNativeContentActions(content, {request: async request => {sent.push(request); return {ok: true, reading}}})
  await actions.scene({action: 'play'})
  await actions.scene({action: 'pause'})
  await actions.scene({action: 'play-saved'})
  await actions.scene({action: 'stop-saved'})
  await actions.scene({action: 'seek', scene_ref: SCENE, seconds: 1.5, sequence: 'working'})
  const scene = sent.map(request => [request.operation, request.action, request.basis, request.intent_epoch])
  assert.deepEqual(scene.map(([op, action]) => [op, action]), [['scene', 'play'], ['scene', 'pause'], ['scene', 'play-saved'], ['scene', 'stop-saved'], ['scene', 'seek']])
  assert.ok(scene.every(([, , basis, epoch]) => JSON.stringify(basis) === JSON.stringify(content.basis) && epoch === 0))
  assert.deepEqual(sent[4].seconds, 1.5)
  // A Scene with no disclosed material is refused locally, with no request.
  const refused = await actions.scene({action: 'focus', scene_ref: SCENE})
  assert.equal(refused.ok, false)
  assert.equal(sent.length, 5)
})

test('the loop toggle is the Scene editor loop intent on the captured selection', async () => {
  const reading = ownerReading(false)
  const content = C.readNativeExpressionsContent(reading)
  const sent = []
  const actions = C.createNativeContentActions(content, {request: async request => {sent.push(request); return {ok: true, reading}}})
  await actions.setSceneLoop(true)
  assert.deepEqual(sent[0], {operation: 'scene-edit', basis: content.basis, intent_epoch: 0,
    native_selection: {scene_ref: SCENE, entity_ref: null}, intent: {operation: 'loop', loop: true}})
  // The Scene editor's switch builds the same request from its own captured reading.
  const editorShape = {operation: 'scene-edit', basis: {...reading.basis}, intent_epoch: reading.playback.intent_epoch,
    native_selection: structuredClone(reading.nativeSelection), intent: P.loopIntent(true)}
  assert.deepEqual(sent[0], editorShape)
  const unfocused = C.createNativeContentActions({...content, native_selection: null}, {request: async request => {sent.push(request); return {ok: true, reading}}})
  const refused = await unfocused.setSceneLoop(true)
  assert.deepEqual([refused.ok, refused.error], [false, 'Focus a Scene before changing its loop.'])
  assert.equal(sent.length, 1, 'an unfocused loop change sends nothing')
})

test('the transport renders its accessible controls, the record reason, and no hold button', () => {
  const reading = ownerReading(true)
  const content = C.readNativeExpressionsContent(reading)
  const actions = C.createNativeContentActions(content, {request: async () => ({ok: true, reading})})
  const markup = renderToStaticMarkup(createElement(NT.NativeTransportBar, {source: {owner: 'expressions', content, actions,
    isPresented: () => true, currentReading: () => reading, revealDetail: () => {}}}))
  assert.match(markup, /aria-label="Expressions transport"/)
  assert.match(markup, /aria-label="Play Scene"/)
  assert.match(markup, /aria-label="Stop Scene"/)
  assert.match(markup, />Saved scenes</)
  assert.match(markup, /aria-label="Scene position"/)
  assert.match(markup, /Scene time · working/)
  assert.match(markup, /Expression time · sequence/)
  assert.match(markup, /aria-label="Engine: Running"/, 'the engine light replaces the physics label')
  assert.match(markup, /aria-label="More transport controls"/)
  assert.match(markup, /aria-label="Stage tool"/)
  assert.match(markup, /aria-label="Time Scale"/)
  // No Expressions frame is linked in this render, so the take control is off and says why.
  // Arm automation does nothing alone: Play starts a take. The dot only lights, and stops the take, while one records.
  const arm = markup.match(/<button[^>]*aria-label="Arm automation recording"[^>]*>/)[0]
  assert.match(arm, /aria-pressed="false"/)
  const record = markup.match(/<button[^>]*aria-label="Property take"[^>]*>/)[0]
  assert.match(record, /disabled=""/, 'Record is never an immediate-record button')
  assert.match(record, /Arm automation, then press Play/)
  assert.doesNotMatch(markup, /aria-label="Re-enable automation"/, 'the orange button is hidden until something is held')
  assert.match(markup, /<select[^>]*aria-label="Take mode"/)
  assert.doesNotMatch(markup, /aria-label="Hold/)
  assert.doesNotMatch(markup, />Hold</)
})

test('the transport, Arrangement chip and Scene editor switch show the same loop value', () => {
  for (const loop of [true, false]) {
    const reading = ownerReading(loop)
    const content = C.readNativeExpressionsContent(reading)
    const actions = C.createNativeContentActions(content, {request: async () => ({ok: true, reading})})
    const source = {owner: 'expressions', content, actions, isPresented: () => true, currentReading: () => reading, revealDetail: () => {}}
    const transport = renderToStaticMarkup(createElement(NT.NativeTransportBar, {source}))
    const control = P.sceneLoopControl({loop: content.scenes.loop, ready: true, focused: P.sceneFocused(content.native_selection, content.basis.scene_ref),
      savedAvailable: content.scenes.timing.saved.available})
    const chip = renderToStaticMarkup(createElement(AT.NativeArrangementTimeline, {content, clock: 'seconds', unit: 'seconds', duration: 0,
      lanes: [], ready: true, perform: async () => {}, loop: {on: control.on, reason: control.reason, toggle: () => {}}}))
    const editor = renderToStaticMarkup(createElement(NSE.NativeSceneEditor, {reading, request: async () => ({ok: true, reading})}))
    const pressed = value => value === null ? null : value === 'true'
    const transportLoop = pressed(transport.match(/class="native-transport-loop"[^>]*aria-pressed="(true|false)"/)?.[1] ?? null)
    const chipLoop = pressed(chip.match(/class="nar-chip nar-loop"[^>]*aria-pressed="(true|false)"/)?.[1] ?? null)
    const switchLoop = pressed(editor.match(/role="switch" aria-checked="(true|false)"/)?.[1] ?? null)
    assert.deepEqual([transportLoop, chipLoop, switchLoop], [loop, loop, loop], `loop ${loop} is shown identically`)
  }
})
