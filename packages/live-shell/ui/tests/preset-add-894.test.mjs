// O-I #747 round 894, the port ledger's add-built-in and chakra-add: the browser's Objects category adds a built-in preset's objects to the
// open Scene, one native edit (the owner's formation-preset, expressions-boundary nativePresets.ts; the app's add-built-in and chakra-add).
// The retained editor takes it as one owner commit, and the composition edit carries each new object under a native identity of its own:
// the Semantic Chakra Body's seven yantra centres keep their yantra, tint and station, and their meanings ride the Scene's material.
// Production sources in memory, the loader of native-formations.test.mjs; no native effect is simulated.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const boundary = new URL('packages/expressions-boundary/src/', root)
const shell = new URL('packages/live-shell/ui/src/', root)
const [{kernelDocumentToJourney}, {prepareCompositionEdit}, {DocumentStore}, {createRetainedNativeEditor}, model] = await Promise.all([
  import(new URL('kernelDocumentBridge.ts', author)), import(new URL('kernelComposition.ts', author)), import(new URL('store.ts', author)),
  import(new URL('hostEditor.ts', author)), import(new URL('components/nativeBrowserModel.ts', shell)),
])
const nativeDocument = JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack.json', import.meta.url), 'utf8'))
const blocked = () => {throw Error('Native effects are closed in preset verification')}

function editor() {
  const view = kernelDocumentToJourney(structuredClone(nativeDocument)), store = new DocumentStore(view.journey)
  const scene = store.document.scenes.find(s => s.id === view.startSceneId) ?? store.document.scenes[0]
  let commits = 0
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: blocked, commit: async () => {commits++; return true}, change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false})
  return {view, store, scene, owner, commits: () => commits}
}
const apply = (r, changes) => r.owner.apply({operation: 'apply', basis: r.owner.read().basis, changes})
const sceneOf = (journey, id) => journey.scenes.find(s => s.id === id)

test('the Semantic Chakra Body is one owner commit; the composition edit carries seven new yantra centres and their meanings', async () => {
  const r = editor(), before = sceneOf(r.store.document, r.scene.id).entities.length
  await apply(r, [{kind: 'formation-preset', preset: 'chakra-body'}])
  assert.equal(r.commits(), 1)
  const scene = sceneOf(r.store.document, r.scene.id), added = scene.entities.slice(before)
  assert.equal(added.length, 7)
  const request = prepareCompositionEdit(r.view, r.store.document, {sceneId: r.scene.id})
  const adds = request.changes.filter(change => change.change === 'entity_add')
  assert.equal(adds.length, 7, 'seven new native identities')
  const material = request.changes.find(change => change.change === 'scene_material_set' && change.scene_ref === r.view.bindings[r.scene.id].scene_ref)
  assert.ok(material, 'the edited Scene\'s material')
  const rows = adds.map(add => material.presentation.scene.entities.find(entity => entity.id === add.entity_ref))
  assert.ok(rows.every(row => row?.shape === 'yantra' && row.yantraId), 'each centre is a yantra and keeps its yantra')
  assert.deepEqual(rows.map(row => row.yantraId), added.map(entity => entity.yantraId))
  const bindings = material.presentation.scene.semanticField?.bindings ?? []
  for (const add of adds) assert.ok(bindings.some(binding => binding.carriers.some(carrier => carrier.kind === 'entity' && carrier.id === add.entity_ref)),
    'each centre\'s meaning names it by its native identity')
})

test('a built-in preset adds the objects of its first scene as one commit; a full Scene refuses it and changes nothing', async () => {
  const r = editor(), before = sceneOf(r.store.document, r.scene.id).entities.length
  await apply(r, [{kind: 'formation-preset', preset: 'small-language'}])
  assert.equal(r.commits(), 1)
  assert.ok(sceneOf(r.store.document, r.scene.id).entities.length > before)
  const full = editor()
  const room = 32 - sceneOf(full.store.document, full.scene.id).entities.length
  await apply(full, Array.from({length: room}, () => ({kind: 'formation-add'})))
  const kept = structuredClone(full.store.document)
  await assert.rejects(apply(full, [{kind: 'formation-preset', preset: 'chakra-body'}]), /32 formations and pins/)
  assert.deepEqual(full.store.document, kept, 'nothing changes on a refusal')
})

test('the Objects category lists the presets with what each adds, and its add is the one formation-preset change', async () => {
  const rows = model.presetRows(null, '')
  assert.deepEqual(rows.map(row => row.preset), ['field-studies', 'small-language', 'seven-centres', 'chakra-body'])
  assert.deepEqual(model.presetRows(null, 'chakra').map(row => row.preset), ['chakra-body'], 'the search reaches them')
  assert.deepEqual(model.presetAddChange('chakra-body'), {kind: 'formation-preset', preset: 'chakra-body'})
  assert.match(rows.find(row => row.preset === 'chakra-body').summary, /not a live reading of a person/, 'manual §20.1: a starter diagram of seven centres is not a live reading of a person')
  const browser = await readFile(new URL('components/NativeObjectBrowser.tsx', shell), 'utf8')
  assert.match(browser, /aria-label="Presets"/, 'a Presets group in the Objects category')
  assert.match(browser, /presetAddChange\(row\.preset\)/, 'each row adds by the one change')
})
