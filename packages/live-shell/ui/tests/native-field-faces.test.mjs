import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production face registry in memory, same loader as the sibling native tests.
// The reading is a minimal fixture; it is not a native owner or a saved receipt.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
const [{FIELD_FACE_MODELS}, {NATIVE_BINDINGS, bindValue}] = await Promise.all([
  import('../src/components/nativeFieldFaceModel.ts'),
  import(parameters),
])

const ENGINE = {mediumEnabled: false, resonanceEnabled: false, collisionEnabled: false, pairwiseEnabled: false, morphEnabled: false,
  colorEnabled: false, trajectory: 'toroidalHopf', driveShape: 'sine', colorMode: 'linearGradient', mediumPlane: 'vertical', autoOscillate: true}
function reading(engine = {}) {
  const scene = {name: 'Fixture', entities: [], engine: {...ENGINE, ...engine}, field: {background: '#ffffff', palette: ['#111111'], material: 'ink', params: {}}}
  return {
    basis: {expression_ref: 'expr:fixture', revision: 1, scene_ref: 'scene:fixture', authored_revision: 1},
    scene, entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []},
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending: false, notice: null},
  }
}
const readings = [reading(), reading({mediumEnabled: true, resonanceEnabled: true, collisionEnabled: true, pairwiseEnabled: true})]

test('registry keys are exactly the four Field families', () => {
  const ALLOWED = ['glyph', 'physics', 'pointer', 'relational', 'medium', 'contacts', 'morph', 'focus', 'colour', 'ink', 'depth', 'resonance', 'automation', 'formation', 'force', 'scene', 'flow', 'collision']
  for (const key of Object.keys(FIELD_FACE_MODELS)) assert.ok(ALLOWED.includes(key), `${key} is not a planned device family`)
  assert.ok(['medium', 'resonance'].every(key => key in FIELD_FACE_MODELS))
})

test('every face model has a name, resolvable controls and a resolvable slider path', () => {
  for (const [key, model] of Object.entries(FIELD_FACE_MODELS)) {
    assert.equal(typeof model.name, 'string', key)
    assert.ok(model.name.length > 0, `${key} name`)
    assert.ok(Array.isArray(model.paths) && model.paths.length > 0, `${key} paths`)
    for (const path of model.paths) assert.ok(NATIVE_BINDINGS.some(row => row.path === path), `${key} path ${path} does not resolve`)
    assert.ok(NATIVE_BINDINGS.some(row => row.path === model.controlPath), `${key} controlPath ${model.controlPath} does not resolve`)
  }
})

test('enable light is a boolean or undefined on every fixture reading', () => {
  for (const [key, model] of Object.entries(FIELD_FACE_MODELS)) {
    for (const r of readings) {
      const on = model.enabled(r)
      assert.ok(on === undefined || typeof on === 'boolean', `${key} enabled returned ${typeof on}`)
    }
  }
  assert.equal(FIELD_FACE_MODELS.physics.enabled(readings[0]), undefined)
})

test('strip summary is a non-empty string and toggle is null or a known activator', () => {
  for (const [key, model] of Object.entries(FIELD_FACE_MODELS)) {
    for (const r of readings) {
      const summary = model.strip.summary(r)
      assert.equal(typeof summary, 'string', key)
      assert.ok(summary.length > 0, `${key} summary`)
    }
    assert.ok(model.strip.toggle === null || ['field-setting', 'morph-setting', 'colour-setting', 'panel-setting'].includes(model.strip.toggle.kind), `${key} toggle`)
  }
})

test('the bound value written into the reading is what the summary shows', () => {
  const r = reading()
  bindValue(r.scene, NATIVE_BINDINGS.find(row => row.path === 'medium.pressure').bind, 0.37)
  assert.equal(FIELD_FACE_MODELS.medium.strip.summary(r).startsWith('pressure 0.37 ·'), true)
})

test('Medium switches keep Enabled and dimension, drop the plane select, and open Physics for the plane', async () => {
  const {createElement} = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {mediumFaceView} = await import('../src/components/NativeFieldFace.medium.tsx')
  const drag = await import('../src/components/nativeDrag.ts')
  const tree = mediumFaceView.switches({reading: reading(), disabled: false, apply: async () => ({ok: true})})
  const html = renderToStaticMarkup(createElement('div', null, tree))
  assert.match(html, />Enabled</)
  assert.match(html, /aria-label="Medium dimensions"/)
  assert.equal(html.includes('Physical medium plane'), false, 'the plane select belongs to Physics')
  assert.match(html, /Medium plane is set in Physics/)
  assert.match(html, /Open Physics/)
  // The link is the typed open request for the Physics panel, dispatched once.
  let button = null
  const visit = node => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    if (node.type === 'button' && node.props?.children === 'Open Physics') button = node
    visit(node.props?.children)
  }
  visit(tree)
  assert.ok(button, 'the Open Physics control exists')
  const target = new EventTarget(), seen = []
  target.addEventListener(drag.OPEN_DEVICE_EVENT, event => seen.push(event.detail))
  const previous = globalThis.window
  globalThis.window = target
  try {button.props.onClick()} finally {globalThis.window = previous}
  assert.deepEqual(seen, [{scope: 'field', family: 'physics'}])
})
