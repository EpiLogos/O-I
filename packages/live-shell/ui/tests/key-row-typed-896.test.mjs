// O-I #747 round 896, 0R-surface.5 and .7 (DLW build ruling 2026-11-09, on reviews 5 and 7).
//   .5: "Replace the regex pins with behavioural tests: … resonance-follow-transport-895:87-95: a typed key, root and scale reach the field's
//       parameter." Those pins read useExpressionsTransport.tsx as text; here the bar is drawn by the transport's own hook over the owner's
//       reading, a value is typed into each slot of the key row, and what reaches the owner is read: one `apply` of the field parameter the
//       Resonance's own dial sets (field.frequency, field.native_cymatics__baseFrequency, field.native_cymatics__modeCount).
//   .7: "Key clamps to 20–4000 Hz and root to 5–200 Hz, as Tempo clamps. Mode count rounds to a whole number in 1–64. The bar shows the
//       value it sent. The registry's soft bounds are the manual's. Its hard bounds stay as they are, for the other sources." Round 895
//       passed the registry's hard bounds to the bar (Drive Frequency 1–100000 Hz, Resonator f0 0.5–2000 Hz), so 5000 Hz went to the owner
//       as typed, Scale took 12.5, and a value the owner took read as the old one until the owner was read again.
// DRAWN: in Chromium, the transport's hook (shell/transports/useExpressionsTransport.tsx) over the retained editor's real reading of a
// one-scene Expression (hostEditor.ts createRetainedNativeEditor, as native-transport.test.mjs reads it) and the shell's content actions
// (shell/nativeContent.ts); each slot's control is drawn as the bar draws it (NativeBarControls.tsx BarValue), typed into and committed
// with Enter or stepped with the arrow keys. SCRIPTED: the owner's request channel, which records each request and answers with the same
// reading (so the bar shows what it sent, not a value read back). SCRIPTED (node): the registry's bounds against the manual's.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {fileURLToPath} from 'node:url'

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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {PARAM_REGISTRY} = await import('../../../../desktop/cradle/expressions-app/src/engine/paramRegistry.ts')
const R = await import('../src/components/resonanceTransport.ts')

test('the registry\'s soft bounds for the key row are the manual\'s, and its hard bounds stay its own, for the other sources', () => {
  const row = path => PARAM_REGISTRY.find(entry => entry.path === path)
  // DLW §20.14 Parameters: "Drive frequency | 20 to 4000 Hz", "Plate | … Base frequency 5 to 200 Hz", "Mode count | 1 to 64".
  const manual = {key: [20, 4000], root: [5, 200], scale: [1, 64]}
  for (const [slot, [min, max]] of Object.entries(manual)) {
    const entry = row(R.RESONANCE_SLOT_PATHS[slot])
    assert.deepEqual([entry.min, entry.max], [min, max], `${slot}: the manual's range is the registry's soft range`)
  }
  assert.deepEqual([row('cymatics.frequencyHz').hardMin, row('cymatics.frequencyHz').hardMax], [1, 100000])
  assert.deepEqual([row('cymatics.baseFrequency').hardMin, row('cymatics.baseFrequency').hardMax], [0.5, 2000])
  assert.deepEqual([row('cymatics.modeCount').hardMin, row('cymatics.modeCount').hardMax], [1, 64])
})

const STAGE = `
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'
import {createElement as h} from 'react'
import './src/styles.css'
import {useExpressionsTransport} from './src/shell/transports/useExpressionsTransport'
import {createNativeContentActions, readNativeExpressionsContent} from './src/shell/nativeContent'
import {createRetainedNativeEditor} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor'
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge'
import {blankJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model'
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store'
const SCENE = 'expression:tuned:scene:main'
const PLAYBACK = {scene_ref: SCENE, scene_elapsed_seconds: 0, expression_time_seconds: 0, scene_playing: false, saved_sequence_playing: false, field_paused: false, track_preview: false}
const blocked = () => {throw Error('This stage does not dispatch the owner effect')}
/** The owner's reading of one Expression with one Scene whose plate the transport tunes (the Resonance on, its Frequency driver Manual). */
function ownerReading() {
  const journey = blankJourney()
  const document = {schema: 'oi.expression/v1', expression_ref: 'expression:tuned', revision: 1, title: 'Tuned', scenes: [{scene_ref: SCENE, revision: 1, title: 'Main', entity_refs: []}],
    entities: {}, relations: {}, selection: {scene_ref: SCENE, entity_ref: null}, provenance: [], representations: [], refinements: []}
  const view = kernelDocumentToJourney(document as any, {identity: {expression: journey.id, scenes: {[SCENE]: journey.scenes[0].id}}} as any)
  const store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(value => value.id === view.startSceneId) ?? store.document.scenes[0]
  scene.engine.resonanceEnabled = true
  scene.composition.frequencyDriver = 'manual'
  const selection = {entity_ids: [], step_id: null}
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => selection, nativeView: () => view,
    nativeSelect: blocked, commit: blocked, change: (label: string, mutate: any) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => ({...PLAYBACK, intent_epoch: 0}), recording: () => false, transitionPending: () => false,
      focus: blocked, transport: blocked, seek: blocked, snapshot: blocked}} as any)
  return owner.read()
}
const w = window as any
w.__sent = []
const reading = ownerReading()
const content = readNativeExpressionsContent(reading as any)
const actions = createNativeContentActions(content as any, {request: async (request: any) => {w.__sent.push(request); return {ok: true, reading}}} as any)
const source = {owner: 'expressions', content, actions, isPresented: () => true, currentReading: () => reading, revealDetail: () => {}}
const SLOTS = ['tempo', 'key', 'root', 'scale']
function Bar() {
  const bindings: any = useExpressionsTransport({tempoBpm: null, nativeTransport: source} as any)
  return h('div', null, SLOTS.map(id => h('div', {key: id, 'data-slot': id, 'data-title': bindings[id]?.title ?? bindings[id]?.refused ?? ''}, bindings[id]?.control ?? null)))
}
flushSync(() => createRoot(document.getElementById('root')!).render(h(Bar)))
w.__bases = Object.fromEntries(['cymatics.frequencyHz', 'cymatics.baseFrequency', 'cymatics.modeCount', 'fluid.timeScale'].map(path => [path, null]))
w.__ready = true
`

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to draw the transport in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

test('a typed key, root and scale reach the field\'s parameter, clamped to the manual\'s range as Tempo is, Scale a whole number; the bar shows the value it sent', {timeout: 300_000}, async t => {
  const {bundleEntry, shellHtml, playwright} = await import('./support/agentShellHarness.mjs')
  const ui = fileURLToPath(new URL('..', import.meta.url))
  const {js, css} = await bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'key-row-typed.tsx', outfile: 'key-row-typed.mjs'})
  const browser = await layoutBrowser(t, playwright)
  if (!browser) return
  try {
    const tab = await browser.newPage({viewport: {width: 900, height: 400}})
    const errors = []
    tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
    await tab.setContent(shellHtml({js, css}), {waitUntil: 'load'})
    await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000}).catch(error => { throw Error(`${error.message} ${errors.join(' | ')}`) })
    const input = slot => tab.locator(`[data-slot="${slot}"] input`)
    const sentSince = async from => (await tab.evaluate(() => window.__sent)).slice(from)
    /** Type `text` into a slot and press Enter (or press `key`); the owner requests it sent, and what the slot shows after. */
    const press = async (slot, text, key = 'Enter') => {
      const from = (await tab.evaluate(() => window.__sent.length))
      if (text !== null) await input(slot).fill(text)
      await input(slot).press(key)
      await tab.waitForFunction(n => window.__sent.length > n, from, {timeout: 10_000}).catch(() => {})
      await tab.waitForTimeout(50)
      const sent = await sentSince(from)
      return {changes: sent.flatMap(request => request.operation === 'apply' ? request.changes : [{refused: request.operation}]), shows: await input(slot).inputValue()}
    }
    for (const slot of ['key', 'root', 'scale']) assert.equal(await input(slot).isDisabled(), false, `${slot} takes a value: the Frequency driver is Manual`)
    assert.equal(await input('key').inputValue(), '220', 'the plate\'s Drive frequency as the blank scene keeps it')

    // ☿ Resonance: the tone. Typed past the manual's 4000 Hz it sends 4000, and shows 4000; below 20 Hz it sends 20.
    assert.deepEqual(await press('key', '5000'), {changes: [{kind: 'parameter', target: 'field.frequency', value: 4000}], shows: '4000'})
    assert.deepEqual(await press('key', '7'), {changes: [{kind: 'parameter', target: 'field.frequency', value: 20}], shows: '20'})
    assert.deepEqual(await press('key', '528'), {changes: [{kind: 'parameter', target: 'field.frequency', value: 528}], shows: '528'})
    // Root: the base tone of the plate's modes, 5–200 Hz.
    assert.deepEqual(await press('root', '1000'), {changes: [{kind: 'parameter', target: 'field.native_cymatics__baseFrequency', value: 200}], shows: '200.0'})
    assert.deepEqual(await press('root', '1'), {changes: [{kind: 'parameter', target: 'field.native_cymatics__baseFrequency', value: 5}], shows: '5.0'})
    // Scale: how many modes take part, a whole number in 1–64.
    assert.deepEqual(await press('scale', '12.5'), {changes: [{kind: 'parameter', target: 'field.native_cymatics__modeCount', value: 13}], shows: '13'})
    assert.deepEqual(await press('scale', '99'), {changes: [{kind: 'parameter', target: 'field.native_cymatics__modeCount', value: 64}], shows: '64'})
    assert.deepEqual(await press('scale', '0.2'), {changes: [{kind: 'parameter', target: 'field.native_cymatics__modeCount', value: 1}], shows: '1'})
    // The arrow keys step from the value the bar shows, inside the same range.
    assert.deepEqual(await press('scale', null, 'ArrowUp'), {changes: [{kind: 'parameter', target: 'field.native_cymatics__modeCount', value: 2}], shows: '2'})
    await press('key', '4000')
    assert.deepEqual(await press('key', null, 'ArrowUp'), {changes: [], shows: '4000'}, 'at the top of its range, nothing more is sent')
    // Tempo clamps as it did (20–240), sending the time scale it sets, and shows what it sent.
    assert.deepEqual(await press('tempo', '300'), {changes: [{kind: 'parameter', target: 'field.timeScale', value: 2.5}], shows: '240.00'})
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
