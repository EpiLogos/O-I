import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {join} from 'node:path'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Expressions' Clip side (DEVICE-SEMANTICS-LOCK §9.1: a scene is a clip; manual §3: "Clip view shows the thing itself, with
// everything you can do to it"; FOUNDATION F4/F7). The selection of a scene clip reaches the Expressions owner as one scene
// focus; Save keeps its Ctrl or ⌘ S chord; the Expressions bar is the one bar. R2 (T-REALIGN): a scene's Clip view is the one clip
// host's, drawing clip:expressions on components/expressions/clip/clipBinding.ts — the Scene's column (SceneControls, SceneStrip)
// and the Sequence column of NativeWorldDetail.tsx are retired. Production modules in memory, as
// scene-sequence-editor.test.mjs loads them; the owner's reading comes from the retained editor over a minimal native document.
const root = new URL('../../../../', import.meta.url)
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

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis
globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop

const ui = new URL('../', import.meta.url)
const src = path => new URL(`src/${path}`, ui)
const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const read = async path => readFile(src(path), 'utf8')
const [SCLIP, CALLS, STATE, KEEP, SC, C, TRACKS, Retained, Bridge, Model, Store, KEYMAP, Timeline, WS, Detail] = await Promise.all([
  import(src('components/expressions/clip/sceneClip.ts').href),
  import(src('components/expressions/clip/sceneCalls.ts').href),
  import(src('components/expressions/clip/sceneState.ts').href),
  import(src('components/expressions/clip/sceneKeepers.ts').href),
  import(src('components/expressions/clip/clipBinding.ts').href),
  import(src('shell/nativeContent.ts').href),
  import(src('frame/tracks/modeTracks.ts').href),
  import(new URL('hostEditor.ts', author).href),
  import(new URL('kernelDocumentBridge.ts', author).href),
  import(new URL('model.ts', author).href),
  import(new URL('store.ts', author).href),
  import(src('frame/keys/keyMap.ts').href),
  import(src('projections/timelinePaneHost.ts').href),
  import(src('shell/workspaceContext.tsx').href),
  import(src('components/NativeWorldDetail.tsx').href),
])

const SCENE = 'expression:whole:scene:main'
const TWO = 'expression:whole:scene:two'
const THREE = 'expression:whole:scene:three'
const blocked = () => {throw Error('This test does not dispatch the owner effect')}

/** The owner's reading of one Expression with a single Scene, as the retained editor publishes it. */
function ownerReading() {
  const journey = Model.blankJourney()
  journey.name = 'A working inquiry'
  journey.scenes[0].name = 'First'
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:whole', revision: 1, title: journey.name,
    scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: []}], entities: {}, relations: {},
    selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  const view = Bridge.kernelDocumentToJourney(document, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}})
  const store = new Store.DocumentStore(view.journey)
  const scene = store.document.scenes.find(value => value.id === view.startSceneId) ?? store.document.scenes[0]
  const selection = {entity_ids: [], step_id: null}
  return Retained.createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => selection, nativeView: () => view,
    nativeSelect: blocked, commit: blocked, change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => ({scene_playing: false, saved_sequence_playing: false, scene_elapsed_seconds: 0, expression_time_seconds: 0,
      scene_ref: SCENE, field_paused: false, track_preview: false, intent_epoch: 0}), recording: () => false, transitionPending: () => false,
      focus: blocked, transport: blocked, seek: blocked, snapshot: blocked}}).read()
}

/** Three Scenes in the owner's inventory (the third has no authored material), the owner focused on the first. Refs hold colons. */
function threeScenes(standing) {
  const reading = ownerReading()
  const base = C.readNativeExpressionsContent({...reading, standing: standing ?? reading.standing})
  const row = base.scenes.scenes[0]
  const make = (scene_ref, title, available) => ({...row, scene_ref, title, native_title: title,
    material: {available, reason: available ? null : 'No authored native Scene material is disclosed'}, working: {duration: 8, transition: 1}})
  const content = {...base, scenes: {...base.scenes, scenes: [make(SCENE, 'Main', true), make(TWO, 'Second', true), make(THREE, 'Third', false)]}}
  return {reading, content}
}

/** A source whose owner requests are captured; the owner answers ok on the basis it was asked with. */
function sourceOf({content, reading}, {presented = true, answer} = {}) {
  const sent = []
  const actions = C.createNativeContentActions(content, {request: async request => { sent.push(request); return answer ? answer(request) : {ok: true, reading} }})
  const source = {owner: 'expressions', content, actions, isPresented: () => presented, currentReading: () => reading, revealDetail: noop}
  return {source, sent, latest: () => source}
}
const clip = (ref, lane = 'visual') => SCLIP.sceneClipRef('expression:whole', ref, lane)
const reset = () => { STATE.markSeen(null); STATE.sayScene(null) }

// ——— the clip refs, and what a selection asks of the owner ———

test('a scene clip ref is read exactly as the Expressions tracks id it, in both lanes', () => {
  const {content} = threeScenes()
  const set = TRACKS.MODE_TRACKS.expressions({set: null, document: null, native: content, workName: 'Whole'})
  assert.equal(set.clips.length, 6, 'three scenes, each a clip on a visual and an audio lane')
  for (const item of set.clips) {
    const named = SCLIP.sceneOfClipRef(content, item.id)
    assert.ok(named, `${item.id} names a scene`)
    assert.equal(SCLIP.sceneClipRef(content.basis.expression_ref, named.sceneRef, named.lane), item.id, 'the ref round-trips')
    assert.ok(content.scenes.scenes.some(rowOf => rowOf.scene_ref === named.sceneRef))
  }
  assert.deepEqual(SCLIP.sceneOfClipRef(content, clip(TWO, 'audio')), {sceneRef: TWO, lane: 'audio'}, 'colons in the scene ref are kept whole')
  for (const ref of [null, undefined, '', `expression:whole:visual`, 'scene:another:expression:scene:main:visual', clip('expression:whole:scene:nowhere'),
    'als:/sets/demo.als#track/0/clip/0', `${clip(SCENE)}x`]) assert.equal(SCLIP.sceneOfClipRef(content, ref), null, `${ref} is not a scene of this Expression`)
  assert.equal(SCLIP.sceneOfClipRef({...content, scenes: null}, clip(SCENE)), null, 'no inventory, no scene')
  assert.equal(SCLIP.sceneLaneRef(content.basis.expression_ref, 'audio'), set.tracks.find(track => track.lane === 'audio').id, 'the lane ref is the track the adapter draws')
  assert.equal(SCLIP.sceneLaneRef(content.basis.expression_ref, 'visual'), set.tracks.find(track => track.lane === 'visual').id)
})

test('a selection asks the owner to focus the scene it names, once, and waits when it cannot decide', () => {
  const {content} = threeScenes()
  const follow = (selected, seen = null, ready = true, over = content) => SCLIP.selectionFollow({selected, seen, content: over, ready})
  assert.deepEqual(follow(clip(TWO)), {act: true, focus: TWO})
  assert.deepEqual(follow(clip(TWO, 'audio')), {act: true, focus: TWO}, 'either lane')
  assert.deepEqual(follow(clip(SCENE)), {act: true, focus: null}, 'the owner is already there: seen, nothing asked')
  assert.deepEqual(follow(clip(TWO), clip(TWO)), {act: false, focus: null}, 'the same selection is never asked twice')
  assert.deepEqual(follow(null), {act: false, focus: null}, 'nothing selected, nothing seen')
  assert.deepEqual(follow('als:/sets/demo.als#track/0/clip/0'), {act: true, focus: null}, 'another mode\'s ref is seen, not followed')
  assert.deepEqual(follow(clip(TWO), null, false), {act: false, focus: null}, 'the owner is answering: wait, mark nothing')
  assert.deepEqual(follow(clip(TWO), null, true, null), {act: false, focus: null}, 'no content yet: wait')
})

test('the selection\'s focus is one owner request on the captured basis, and marks the selection seen', async () => {
  reset()
  const world = threeScenes(), {source, sent, latest} = sourceOf(world)
  const selected = clip(TWO)
  const asked = KEEP.followSelection(source, selected, true, latest)
  assert.ok(asked, 'a request is on its way')
  assert.equal(await asked, true)
  assert.deepEqual(sent, [{operation: 'scene', action: 'focus', scene_ref: TWO, basis: world.content.basis, intent_epoch: world.content.playback.intent_epoch}],
    'scene focus, on the basis the owner was read with')
  assert.equal(STATE.seenSelection(), selected)
  assert.equal(KEEP.followSelection(source, selected, true, latest), null, 'asked once per selection')
  assert.equal(sent.length, 1)
  // Moving the owner's focus some other way is never fought by the older selection: the same selection stays unasked.
  assert.equal(KEEP.followSelection(sourceOf(threeScenes()).source, selected, true, latest), null)
  // Another scene is another selection.
  assert.ok(KEEP.followSelection(source, clip(TWO, 'audio'), true, latest), 'a new selection is a new request')
})

test('the selection waits while the owner answers or the cut is not presented, and neither marks it seen', async () => {
  reset()
  const world = threeScenes(), {source, sent, latest} = sourceOf(world)
  assert.equal(KEEP.followSelection(source, clip(TWO), false, latest), null, 'not ready')
  assert.equal(STATE.seenSelection(), null)
  const hidden = sourceOf(world, {presented: false})
  assert.equal(KEEP.followSelection(hidden.source, clip(TWO), true, hidden.latest), null, 'not presented')
  assert.equal(STATE.seenSelection(), null)
  assert.equal(sent.length + hidden.sent.length, 0, 'nothing was asked of the owner')
  assert.equal(KEEP.followSelection(null, clip(TWO), true, () => null), null, 'no source')
  assert.ok(KEEP.followSelection(source, clip(TWO), true, latest), 'ready and presented: now it is asked')
})

test('a selected scene the owner cannot focus is refused in its words, on the Scene\'s line', async () => {
  reset()
  const world = threeScenes(), {source, sent, latest} = sourceOf(world)
  assert.equal(await KEEP.followSelection(source, clip(THREE), true, latest), false)
  assert.equal(sent.length, 0, 'the adapter refuses locally: this Scene has no authored material, so no request is sent')
  assert.deepEqual(STATE.sceneLine(), {kind: 'fault', text: 'This Scene has no disclosed authored material'})
  reset()
  assert.equal(STATE.sceneLine(), null)
})

test('Scene ‹ ›: the owner\'s focus unchanged, and the pressed Scene becomes THE selection on the lane it was on, once', async () => {
  reset()
  const world = threeScenes(), {source, sent, latest} = sourceOf(world)
  const selects = []
  const door = {selectedRef: clip(SCENE, 'audio'), selectTrackItem: target => selects.push(target)}
  assert.equal(await CALLS.focusScene(source, latest, TWO, door), true)
  assert.deepEqual(sent.map(request => [request.operation, request.action, request.scene_ref]), [['scene', 'focus', TWO]])
  assert.deepEqual(selects, [{kind: 'clip', ref: clip(TWO, 'audio'), title: 'Second', track: SCLIP.sceneLaneRef('expression:whole', 'audio')}])
  assert.equal(STATE.seenSelection(), clip(TWO, 'audio'))
  assert.equal(KEEP.followSelection(source, clip(TWO, 'audio'), true, latest), null, 'the selection it made is not asked of the owner again')
  assert.equal(sent.length, 1)
  // With nothing of this Expression selected it selects the visual clip.
  const second = []
  await CALLS.focusScene(source, latest, TWO, {selectTrackItem: target => second.push(target)})
  assert.equal(second[0].ref, clip(TWO, 'visual'))
  assert.equal(second[0].track, SCLIP.sceneLaneRef('expression:whole', 'visual'))
  // The owner's refusal keeps THE selection where it was.
  const refusing = sourceOf(world, {answer: async () => ({ok: false, error: 'The owner refused this focus'})})
  const none = []
  assert.equal(await CALLS.focusScene(refusing.source, refusing.latest, TWO, {selectTrackItem: target => none.push(target)}), false)
  assert.deepEqual(none, [])
  assert.equal(await CALLS.focusScene(source, latest, TWO, null), true, 'no selection door: the owner\'s focus still stands')
  reset()
})

// ——— Save and its chord ———

const chord = (over = {}) => ({key: 's', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, repeat: false, ...over})

test('Ctrl or ⌘ S is one owner save when Save is offered, and nothing otherwise', async () => {
  reset()
  const clean = threeScenes(), dirty = threeScenes({...ownerReading().standing, dirty: true, pending: false})
  const {source, sent, latest} = sourceOf(dirty)
  assert.equal(KEEP.pressSaveChord(chord(), source, latest, false), true)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(sent, [{operation: 'save', basis: dirty.content.basis}], 'the owner save request on the captured basis, and nothing else')
  assert.equal(KEEP.pressSaveChord(chord({metaKey: false, ctrlKey: true}), source, latest, false), true, 'Ctrl too')
  await new Promise(resolve => setTimeout(resolve, 0))
  const refused = [chord({key: 'a'}), chord({altKey: true}), chord({shiftKey: true}), chord({repeat: true}), chord({metaKey: false})]
  for (const event of refused) assert.equal(KEEP.pressSaveChord(event, source, latest, false), false, JSON.stringify(event))
  assert.equal(KEEP.pressSaveChord(chord(), source, latest, true), false, 'a typing field keeps its own keys')
  assert.equal(KEEP.pressSaveChord(chord(), null, latest, false), false, 'no Expression is open')
  const idle = sourceOf(clean)
  assert.equal(KEEP.pressSaveChord(chord(), idle.source, idle.latest, false), false, 'nothing to save: the chord is left to others')
  const pending = sourceOf(threeScenes({...ownerReading().standing, dirty: true, pending: true}))
  assert.equal(KEEP.pressSaveChord(chord(), pending.source, pending.latest, false), false, 'the owner is still answering')
  assert.equal(idle.sent.length + pending.sent.length, 0)
  await new Promise(resolve => setTimeout(resolve, 0))
  reset()
})

test('Save says "saved" only from the owner\'s own reading, and a refusal in its words', async () => {
  reset()
  const dirty = threeScenes({...ownerReading().standing, dirty: true, pending: false})
  const cleanReading = {...dirty.reading, standing: {...dirty.reading.standing, dirty: false}}
  const saved = sourceOf(dirty, {answer: async () => ({ok: true, reading: cleanReading})})
  assert.equal(await CALLS.sendSave(saved.source, saved.latest), true)
  assert.deepEqual(STATE.sceneLine(), {kind: 'notice', text: 'Saved to the native Expression.'})
  const stillDirty = sourceOf(dirty, {answer: async () => ({ok: true, reading: {...dirty.reading, standing: {...dirty.reading.standing, dirty: true}}})})
  await CALLS.sendSave(stillDirty.source, stillDirty.latest)
  assert.match(STATE.sceneLine().text, /Nothing is marked saved/)
  const refused = sourceOf(dirty, {answer: async () => ({ok: false, error: 'The owner refused this save'})})
  assert.equal(await CALLS.sendSave(refused.source, refused.latest), false)
  assert.deepEqual(STATE.sceneLine(), {kind: 'fault', text: 'The owner refused this save'})
  const hidden = sourceOf(dirty, {presented: false})
  assert.equal(await CALLS.sendSave(hidden.source, hidden.latest), false)
  assert.equal(hidden.sent.length, 0, 'a cut that is not presented sends nothing')
  reset()
})

test('one Scene request at a time, whichever door it came through', async () => {
  reset()
  assert.equal(STATE.sceneBusy(), false)
  let release
  const gate = new Promise(resolve => { release = resolve })
  const world = threeScenes(), {source, latest} = sourceOf(world, {answer: async () => { await gate; return {ok: true, reading: world.reading} }})
  const sending = CALLS.sendScene(source, latest, {action: 'play-saved'})
  assert.equal(STATE.sceneBusy(), true, 'in flight')
  release(); await sending
  assert.equal(STATE.sceneBusy(), false)
  reset()
})

// ——— the Clip side draws them; the bar does not ———

test('the scene\'s Clip view reads the owner\'s own scene: its name, duration and transition, and writes them as scene edits', async () => {
  const {reading} = threeScenes()
  const values = SC.expressionsClipValues(reading)
  const row = reading.scenes.scenes.find(item => item.scene_ref === reading.basis.scene_ref)
  assert.equal(values.name, row.title, 'the presented Scene\'s own title, as the Scene selector showed it')
  assert.equal(values.duration, row.working?.duration ?? reading.scene.duration)
  assert.deepEqual(JSON.parse(values.scenes).map(item => item.id), reading.scenes.scenes.map(item => item.scene_ref), 'the Expression\'s scenes, for Jump')
  const sent = []
  const binding = SC.expressionsClipBinding({reading, request: async operation => { sent.push(operation); return {ok: true, reading} }})
  await binding.write([{key: 'transition', value: 3}])
  assert.equal(sent[0].operation, 'scene-edit'); assert.deepEqual(sent[0].intent, {operation: 'pacing', scene_ref: reading.basis.scene_ref, transition: 3})
})

/** The detail's residence as the shell hands it: the workspace in Expressions, holding the owner's reading. */
function detailMarkup(props, reading) {
  const workspace = {workspaceId: 'expressions-clip-fixture', accessEpoch: 1, accessReady: true, nativeAccessCurrent: () => true, mode: 'expressions',
    editor: null, editorReading: reading, transport: {kind: 'unavailable', reason: 'a fixture'}}
  return renderToStaticMarkup(createElement(WS.Workspace.Provider, {value: workspace},
    createElement(Detail.NativeWorldDetail, {expand: noop, collapse: noop, presentMode: noop, ...props})))
}

test('the retained editor draws only the Studio: its Clip side is the clip host\'s, never a second column', () => {
  const {reading} = threeScenes()
  for (const mode of ['clip', 'device']) {
    const markup = detailMarkup({mode}, reading)
    for (const gone of [/scene-props/, /native-clip-view/, /native-clip-sequence/, /scene-strip/]) assert.doesNotMatch(markup, gone, `${mode}: no Scene column`)
  }
})

test('Expressions\' clip entry hosts its designed clip on the scene\'s binding; the Scene\'s old column is gone from the tree', async () => {
  // Expressions' clip body is its own module, loaded with Expressions (shell/details/expressions.tsx; O-I #740).
  const details = await read('shell/details/expressions.tsx')
  assert.match(details, /function ExpressionsClip\(\{place\}: \{place: ClipPlace\}\) \{ return <Hosted binding=\{useExpressionsClip\(\)\} place=\{place\}/)
  assert.match(await read('shell/modeDetails.tsx'), /const ExpressionsClip: ClipBody = loadWhenDrawn\('Expressions\\' clip', \(\) => import\('\.\/details\/expressions'\)/)
  const detail = await read('components/NativeWorldDetail.tsx')
  assert.doesNotMatch(detail, /SceneControls|SceneStrip|showSceneControls/)
  const {existsSync} = await import('node:fs')
  assert.equal(existsSync(src('components/expressions/clip/SceneControls.tsx')), false)
})

test('Expressions\' own bar is gone and the window has one Ctrl or ⌘ S, which the F9 keys layer does not double', async () => {
  const {existsSync} = await import('node:fs')
  assert.equal(existsSync(src('components/NativeTransportBar.tsx')), false)
  const holders = []
  const walk = async dir => { for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (/\.(ts|tsx)$/.test(entry.name) && /key\.toLowerCase\(\)\s*===\s*'s'/.test(await readFile(path, 'utf8'))) holders.push(path.slice(src('').pathname.length))
  } }
  await walk(src('').pathname)
  assert.deepEqual(holders, ['components/expressions/clip/sceneKeepers.ts'], 'exactly one listener for the chord')
  for (const meta of [true, false]) assert.equal(KEYMAP.intentOfKey({key: 's', metaKey: meta, ctrlKey: !meta}), null, 'F9 takes neither Ctrl S nor ⌘ S')
})

test('the Scene\'s selection and chord are mounted once, with Expressions\' bindings, and the pins say where Map pins to', async () => {
  const hook = await read('shell/transports/useExpressionsTransport.tsx')
  assert.equal((hook.match(/useSceneKeepers\(source\)/g) ?? []).length, 1)
  assert.match(hook, /'key-map': \{title: 'Map — pin mode:.*Clip side/)
  assert.doesNotMatch(await read('components/TransportBar.tsx'), /NativeTransportBar/)
  // The published timeline reading is what the follower reads THE selection from, and the door ‹ › selects through.
  assert.equal(typeof Timeline.useTimelineReading, 'function')
  assert.match(await read('components/expressions/clip/sceneKeepers.ts'), /useTimelineReading\(\)\?\.selectedRef/)
})

// ——— O-I #747: the scene's Sequence, its View and the pointer's Select are Clip view's (manual §20.1 "Where everything is") ———

const DESIGN = await import(src('inhabitants/catalogue/clips/expressions.tsx').href)
const tab = (id, v) => renderToStaticMarkup(createElement(() => DESIGN.clip.editor.find(item => item.id === id).draw({v, set: noop, size: 'whole', room: {w: 800, h: 320}})))
const panel = (id, v) => renderToStaticMarkup(createElement(() => DESIGN.clip.panel.find(item => item.id === id).draw({v, set: noop, size: 'whole', room: {w: 300, h: 600}})))
const toolMarkup = (id, v) => renderToStaticMarkup(createElement(() => DESIGN.clip.tools.find(item => item.id === id).draw({v, set: noop, size: 'whole', room: {w: 300, h: 600}})))

test('the scene\'s Sequence reads the owner\'s symbols: an empty scene says it has none, never that it is unread (walk 739, X2)', () => {
  // Run the owner: a new Expression's one scene, as the retained editor reads it — nothing placed.
  const reading = ownerReading()
  const values = SC.expressionsClipValues(reading)
  assert.equal(values.symbols, '[]', 'the owner\'s reading holds the scene\'s symbols, and there are none')
  const empty = tab('sequence', values)
  assert.doesNotMatch(empty, /No reading of the scene/, 'a reading of an empty scene is a reading')
  assert.match(empty, /The scene has no symbols yet/)
  assert.match(tab('sequence', {}), /No reading of the scene&#x27;s sequence yet/, 'only an absent reading says so')
  // A symbol the owner reads: its own lane, its steps from the owner's glyph timing (shell/nativeContent.ts readNativeGlyphTiming).
  const placed = {...reading, scene: {...reading.scene, entities: [Model.entity('Sun', 'S')]}}
  const withSymbol = SC.expressionsClipValues(placed)
  const symbols = JSON.parse(withSymbol.symbols)
  assert.deepEqual(symbols.map(item => item.name), ['Sun'])
  const said = withSymbol.sequenceUnread
  assert.ok(symbols[0].steps.length > 0 || typeof said === 'string', 'its steps, or why they could not be read')
  if (typeof said === 'string') assert.match(tab('sequence', withSymbol), /The scene&#x27;s steps could not be read/)
  else assert.match(tab('sequence', withSymbol), /data-lane="[^"]*"|Sun/)
})

test('the scene\'s View stands in its Clip panel: Kept or Not kept, with Keep and Restore through the field\'s own acts (manual §20.1)', async () => {
  const reading = ownerReading()
  assert.equal(SC.expressionsClipValues(reading).view, 'not kept', 'a scene that keeps no view of its own')
  // O-I #747 round two: the scene's explicit kept state, never "a framing other than the default".
  const turned = {...reading, scene: {...reading.scene, view: {...reading.scene.view, mode: '3d', yaw: 0.4, zoom: 1.6}}}
  assert.equal(SC.expressionsClipValues(turned).view, 'not kept', 'a turned camera is not a kept view')
  const kept = {...reading, scene: {...reading.scene, view: {...reading.scene.view, kept: true}}}
  assert.equal(SC.expressionsClipValues(kept).view, 'kept', 'Keep at the default framing is a kept view')
  const markup = panel('clip', SC.expressionsClipValues(kept))
  assert.match(markup, /View/); assert.match(markup, /Kept/); assert.match(markup, /Keep/); assert.match(markup, /Restore/); assert.match(markup, /Fit/)
  const ran = []
  const stage = {state: null, run: async command => { ran.push(command); return {ok: true} }}
  const binding = SC.expressionsClipBinding({reading: kept, request: async () => ({ok: true, reading: kept}), stage})
  await binding.write([{key: 'view.keep', value: 1}]); await binding.write([{key: 'view.restore', value: 2}]); await binding.write([{key: 'view.fit', value: 3}])
  assert.deepEqual(ran, [{command: 'view', action: 'keep-view'}, {command: 'view', action: 'restore-view'}, {command: 'view', action: 'fit-view'}])
  const frame = await readFile(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/app.ts', root), 'utf8')
  assert.match(frame, /case 'keep-view':changed\(\(\)=>\{scene\(\)\.view=\{\.\.\.scene\(\)\.view,kept:true,/, 'Keep writes the kept state with the framing')
})

test('the pointer\'s Select is the field\'s own Select, and ends a placement (the port ledger\'s cancel-placement home)', async () => {
  const reading = ownerReading()
  const ran = []
  const field = tool => ({stage: {mode: '2d', grid: false, snap: false, guides: true, tool}})
  const stage = {state: field('pin'), run: async command => { ran.push(command); return {ok: true} }}
  const binding = SC.expressionsClipBinding({reading, request: async () => ({ok: true, reading}), stage})
  assert.equal(binding.values.tool, undefined, 'the field\'s Pin is no pointer tool of Clip view')
  await binding.write([{key: 'tool', value: 'select'}])
  assert.deepEqual(ran, [{command: 'tool', tool: 'select'}])
  assert.equal(SC.expressionsClipBinding({reading, request: null, stage: {...stage, state: field('select')}}).values.tool, 'select', 'the field\'s reading of its tool')
  for (const tool of ['orbit', 'form', 'bind']) await assert.rejects(binding.write([{key: 'tool', value: tool}]), /./, `${tool} names why`)
  assert.match(toolMarkup('pointer', {tool: 'select'}), /Select/)
})
