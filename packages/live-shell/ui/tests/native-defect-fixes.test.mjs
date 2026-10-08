import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx
// is transpiled, .css is a non-executing stub. The bar model and its controls are
// exercised over the real native bridge; no store or engine is started.
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
const [Bridge, Model, Colour] = await Promise.all([
  import(new URL('nativeBridge.ts', author)),
  import(new URL('model.ts', author)),
  import('../src/components/nativeColourController.ts'),
])

test('a native configuration that names no depth override imports with none, so the engine derives it from the body law', () => {
  const config = Bridge.toNativeConfig(Model.blankScene('Depth'))
  assert.equal(config.fluid.vortex3d, undefined, 'the default configuration carries no explicit depth override (fieldDefaults.ts)')
  assert.equal(config.fluid.dispersion3d, undefined)
  const engine = Bridge.nativeSnapshotToJourney({schemaVersion: Bridge.CONFIG_SCHEMA_VERSION ?? 4, name: 'Depth', config}).scenes[0].engine
  assert.equal('vortex3d' in engine, false, 'import writes no explicit 0')
  assert.equal('dispersion3d' in engine, false)
})

test('importing an explicit depth override keeps it, including an explicit 0', () => {
  const config = Bridge.toNativeConfig(Model.blankScene('Depth'))
  config.fluid.vortex3d = 0; config.fluid.dispersion3d = 0.4
  const engine = Bridge.nativeSnapshotToJourney({schemaVersion: Bridge.CONFIG_SCHEMA_VERSION ?? 4, name: 'Depth', config}).scenes[0].engine
  assert.equal(engine.vortex3d, 0)
  assert.equal(engine.dispersion3d, 0.4)
})

test('an unset colorEnabled reads as on in the shell, matching the native export', () => {
  const scene = Model.blankScene('Colour')
  delete scene.engine.colorEnabled
  assert.equal(Bridge.toNativeConfig(scene).color.enabled, true, 'the engine renders colour when the flag is unset')
  const reading = {scene}
  const facts = Colour.NATIVE_COLOUR_FACTS ?? Colour.colourDeviceFacts ?? null
  const enabled = Object.values(Colour).find(value => value && typeof value === 'object' && typeof value.enabled === 'function')
  assert.ok(enabled, 'the colour device facts expose an enabled reading')
  assert.equal(enabled.enabled(reading), true)
  scene.engine.colorEnabled = false
  assert.equal(enabled.enabled(reading), false, 'an explicit false is still off')
  assert.equal(Bridge.toNativeConfig(scene).color.enabled, false)
})
