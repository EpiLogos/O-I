import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx transpiled, CSS stubbed, and the
// app's .js specifiers resolved to their .ts sources. The owner reading comes from the retained editor over a minimal
// native document. No server, store engine or browser is simulated beyond that.
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
const shell = new URL('packages/live-shell/ui/src/', root)
const [C, NT, CMD, COL, GUIDE, App, Model, Store, Retained, Bridge] = await Promise.all([
  import(new URL('shell/nativeContent.ts', shell)),
  import(new URL('components/NativeTransportBar.tsx', shell)),
  import(new URL('components/nativeExpressionCommands.ts', shell)),
  import(new URL('components/NativeExpressionCollections.tsx', shell)),
  import(new URL('components/NativeExpressionGuide.tsx', shell)),
  import(new URL('expressions.ts', author)),
  import(new URL('model.ts', author)),
  import(new URL('store.ts', author)),
  import(new URL('hostEditor.ts', author)),
  import(new URL('kernelDocumentBridge.ts', author)),
])
const read = name => readFile(new URL(name, shell), 'utf8')
const shellApp = await readFile(new URL('shell.ts', author), 'utf8')
const appExpressions = await readFile(new URL('expressions.ts', author), 'utf8')
const escapeHtml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

const SCENE = 'expression:whole:scene:main'
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
  const owner = Retained.createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => selection, nativeView: () => view,
    nativeSelect: blocked, commit: blocked, change: mutate => store.change(mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => ({scene_playing: false, saved_sequence_playing: false, scene_elapsed_seconds: 0, expression_time_seconds: 0,
      scene_ref: SCENE, field_paused: false, track_preview: false, intent_epoch: 0}), recording: () => false, transitionPending: () => false,
      focus: blocked, transport: blocked, seek: blocked, snapshot: blocked}})
  return owner.read()
}

/** A transport source over a reading. The standing override is a copy: the real owner computes dirty from its draft. */
function transportSource(reading, standing = reading.standing) {
  const shown = {...reading, standing}
  const content = C.readNativeExpressionsContent(shown)
  const actions = C.createNativeContentActions(content, {request: async () => ({ok: true, reading: shown})})
  return {owner: 'expressions', content, actions, isPresented: () => true, currentReading: () => shown, revealDetail: () => {}}
}

test('save is offered only for an attached, clean-or-dirty, idle Expression, with the reason when it is not', () => {
  assert.deepEqual(CMD.saveState({attached: false, busy: false, standing: null}),
    {disabled: true, reason: 'No native Expression is open to save.'})
  assert.equal(CMD.saveState({attached: true, busy: false, standing: {dirty: true, pending: true}}).disabled, true)
  assert.match(CMD.saveState({attached: true, busy: false, standing: {dirty: true, pending: true}}).reason, /still answering/)
  assert.equal(CMD.saveState({attached: true, busy: true, standing: {dirty: true, pending: false}}).disabled, true)
  assert.deepEqual(CMD.saveState({attached: true, busy: false, standing: {dirty: false, pending: false}}),
    {disabled: true, reason: 'Nothing to save: this Expression matches the native owner.'})
  assert.deepEqual(CMD.saveState({attached: true, busy: false, standing: {dirty: true, pending: false}}), {disabled: false, reason: null})
})

test('a save reply says saved only when the owner reading is clean', () => {
  const clean = ownerReading()
  assert.equal(CMD.saveNotice({ok: true, reading: {...clean, standing: {...clean.standing, dirty: false}}}), 'Saved to the native Expression.')
  const dirty = CMD.saveNotice({ok: true, reading: {...clean, standing: {...clean.standing, dirty: true}}})
  assert.match(dirty, /Nothing is marked saved/)
  assert.doesNotMatch(dirty, /^Saved/)
})

test('save is the owner save request on the captured basis, and nothing else', async () => {
  const reading = ownerReading()
  const content = C.readNativeExpressionsContent(reading)
  const sent = []
  const actions = C.createNativeContentActions(content, {request: async request => {sent.push(request); return {ok: true, reading}}})
  await actions.history('save')
  assert.deepEqual(sent, [{operation: 'save', basis: content.basis}])
})

test('collection sections map the app groups to Featured, Starters and Built-in presets, with a disabled open on every row', () => {
  const items = [
    {id: 'f1', name: 'Mark', description: 'The mark', group: 'Featured'},
    {id: 's1', name: 'Material scene', description: 'Starter material', group: 'Material'},
    {id: 's2', name: 'Corpus study', description: 'Source study', group: 'Source studies'},
    {id: 'p1', name: 'Chakra body', description: 'Composition', group: 'Composition'},
    {id: 'p2', name: 'Factory config', description: 'Native', group: 'Native'},
  ]
  const sections = CMD.collectionSections(items, '')
  assert.deepEqual(sections.map(section => [section.id, section.title, section.rows.map(row => row.id)]), [
    ['featured', 'Featured', ['f1']], ['starters', 'Starters', ['s1', 's2']], ['presets', 'Built-in presets', ['p1', 'p2']]])
  for (const row of sections.flatMap(section => section.rows)) assert.deepEqual(row.open, {disabled: true, reason: CMD.FORK_REASON})
  assert.match(CMD.FORK_REASON, /save_as owner operation/)
  assert.deepEqual(CMD.collectionSections(items, 'chakra').map(section => section.rows.length), [0, 0, 1])
  assert.deepEqual(CMD.collectionSections(items, '  CORPUS ').map(section => section.rows.length), [0, 1, 0])
})

test('the collection rows are the app own collections: featured, starters and built-in presets, derived from expressions.ts', () => {
  const items = COL.appCollectionItems()
  const featured = App.featuredExpressions()
  const starting = App.startingPoints()
  const rows = (group) => items.filter(item => item.group === group)
  assert.deepEqual(rows('Featured').map(item => [item.id, item.name]), featured.map(expression => [expression.id, expression.name]))
  const starters = starting.filter(point => point.group === 'Material' || point.group === 'Source studies')
  const presets = starting.filter(point => point.group === 'Composition' || point.group === 'Native')
  assert.deepEqual(items.filter(item => item.group === 'Material' || item.group === 'Source studies').map(item => item.id), starters.map(point => point.id))
  assert.deepEqual(items.filter(item => item.group === 'Composition' || item.group === 'Native').map(item => item.id), presets.map(point => point.id))
  assert.ok(featured.length >= 1 && presets.length >= 1 && starters.length >= 1, 'the app ships collections in every section')
  assert.equal(COL.appCollectionItems(), items, 'the app collections are read once')
})

test('the collections render read-only, with each action disabled and its reason on the page', () => {
  const markup = renderToStaticMarkup(createElement(COL.NativeExpressionCollections, {query: ''}))
  for (const title of ['Featured', 'Starters', 'Built-in presets']) assert.match(markup, new RegExp(`aria-label="${title}"`))
  const first = App.featuredExpressions()[0]
  assert.match(markup, new RegExp(escapeHtml(first.name)))
  assert.equal((markup.match(/<button[^>]*disabled=""[^>]*>Open<\/button>/g) ?? []).length, COL.appCollectionItems().length)
  assert.doesNotMatch(markup, /<button(?![^>]*disabled)[^>]*>Open</)
  assert.ok(markup.includes(escapeHtml(CMD.FORK_REASON)), 'the reason is shown, not only in a title')
  assert.match(markup, /Fork as variation and Remove saved copy need native owner operations/)
  assert.match(renderToStaticMarkup(createElement(COL.NativeExpressionCollections, {query: 'zz-no-such-collection'})), /No collections match this search\./)
})

test('the guide shows the app quick guide, About and the shortcuts the shell binds', () => {
  const markup = renderToStaticMarkup(createElement(GUIDE.NativeExpressionGuide, {onClose: () => {}}))
  assert.match(markup, /aria-label="Expressions guide"/)
  for (const heading of ['Quick guide', 'Shortcuts', 'About']) assert.match(markup, new RegExp(`>${heading}<`))
  for (const item of CMD.QUICK_GUIDE) assert.ok(markup.includes(escapeHtml(item.heading)))
  for (const row of CMD.BOUND_SHORTCUTS) assert.ok(markup.includes(escapeHtml(row.action)), row.action)
  assert.ok(markup.includes(escapeHtml(CMD.ABOUT.title)) || markup.includes(escapeHtml(CMD.ABOUT.lede)))
})

test('the guide text is the app own text: each quick-guide paragraph and About paragraph appears in the app sources', () => {
  for (const item of CMD.QUICK_GUIDE) assert.ok(shellApp.includes(item.text), `shell.ts guide text: ${item.heading}`)
  assert.ok(shellApp.includes(CMD.QUICK_GUIDE_STANDING))
  for (const sentence of [CMD.ABOUT.lede, CMD.ABOUT.living, CMD.ABOUT.editable, CMD.ABOUT.kept]) {
    assert.ok(appExpressions.includes(sentence), `expressions.ts About text: ${sentence.slice(0, 40)}`)
  }
  assert.ok(appExpressions.includes('A field to inhabit.') && appExpressions.includes('A space to compose.'))
})

test('every shortcut in the guide is bound by the handler it names', async () => {
  const transport = await read('components/NativeTransportBar.tsx'), app = await read('App.tsx'), browser = await read('components/WorldBrowser.tsx')
  const scrub = await read('components/nativeScenePlayback.ts')
  assert.match(transport, /event\.key\.toLowerCase\(\) === 's'/)
  assert.match(transport, /spaceTogglesPlayback/)
  assert.match(scrub, /case 'ArrowRight': case 'ArrowUp'/)
  assert.match(scrub, /case 'Home'/)
  assert.match(app, /event\.key === ','/)
  assert.match(app, /event\.key\.toLowerCase\(\) === 'l' && event\.metaKey && event\.altKey/)
  assert.match(app, /event\.key\.toLowerCase\(\) === 'b' && event\.metaKey && event\.altKey/)
  assert.match(app, /event\.key === 'Tab'/)
  assert.match(browser, /\['ArrowUp', 'ArrowDown', 'Home', 'End'\]\.includes\(event\.key\)/)
  assert.match(browser, /event\.key === 'Escape' && query/)
  assert.match(browser, /event\.key === ' '/)
  assert.match(browser, /<NativeExpressionCollections query=\{query\}\/>/)
})

test('the transport offers Save with its reason, and a Guide control, from the owner reading', () => {
  const clean = ownerReading()
  const cleanMarkup = renderToStaticMarkup(createElement(NT.NativeTransportBar, {source: transportSource(clean)}))
  const saveClean = cleanMarkup.match(/<button[^>]*aria-label="Save Expression"[^>]*>/)[0]
  assert.match(saveClean, /disabled=""/)
  assert.match(saveClean, /Nothing to save/)
  const guide = cleanMarkup.match(/<button[^>]*aria-label="Expressions guide"[^>]*>/)[0]
  assert.match(guide, /aria-expanded="false"/)
  assert.doesNotMatch(cleanMarkup, /role="dialog"/, 'the guide is closed until asked')

  const dirtyMarkup = renderToStaticMarkup(createElement(NT.NativeTransportBar, {source: transportSource(clean, {...clean.standing, dirty: true})}))
  const saveDirty = dirtyMarkup.match(/<button[^>]*aria-label="Save Expression"[^>]*>/)[0]
  assert.doesNotMatch(saveDirty, /disabled=""/)
  assert.match(saveDirty, /Ctrl or ⌘ S/)

  const pendingMarkup = renderToStaticMarkup(createElement(NT.NativeTransportBar, {source: transportSource(clean, {...clean.standing, dirty: true, pending: true})}))
  assert.match(pendingMarkup.match(/<button[^>]*aria-label="Save Expression"[^>]*>/)[0], /disabled=""/)
})

test('the transport source sends save through the same history channel the device toolbar uses', async () => {
  const transport = await read('components/NativeTransportBar.tsx'), devices = await read('components/NativeDeviceEditors.tsx')
  assert.match(transport, /actions\.history\('save'\)/)
  assert.match(devices, /invoke\(\{operation: 'save', basis: reading\.basis\}\)/)
})
