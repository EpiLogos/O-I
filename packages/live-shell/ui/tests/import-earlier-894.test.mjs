// O-I #747 round 894, the port ledger's import-legacy: the scenes an earlier version of the field kept in this computer's browser storage
// are imported through the field's own import of them (the app's import-legacy, app.ts: importDocuments into the field's Library, the
// browser key left as it was), asked from the browser's New section as Import earlier scenes: the stage command `import` with
// `source: 'earlier'`. With nothing kept, the field says so and imports nothing. The stage command is the frame's own grammar (exact keys);
// the frame's body and the browser row are read from their source, as the other stage-command suites read them; the walk proves it live.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

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
const app = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const shell = new URL('packages/live-shell/ui/src/', root)
const frame = await import(new URL('stageCommands.ts', app))
const bridge = await import(new URL('nativeBridge.ts', app))
const model = await import(new URL('model.ts', app))
const read = (base, name) => readFile(new URL(name, base), 'utf8')

test('import from the earlier storage is the frame\'s own stage command, exactly; no other source is admitted', () => {
  const command = {command: 'import', source: 'earlier'}
  const message = frame.stageRequestMessage(9, command)
  assert.deepEqual(frame.readStageRequest(message), {req: 9, command})
  assert.deepEqual(frame.readStageRequest(frame.stageRequestMessage(3, {command: 'import'})), {req: 3, command: {command: 'import'}}, 'the file import stands as it was')
  for (const source of ['file', 'library', '', 1, null]) assert.equal(frame.readStageRequest({v: 1, kind: 'host-command', req: 4, command: 'import', source}), null, String(source))
})

// O-I #747 round 895 (DLW build ruling 2026-11-09, 0b.5): the import itself, run on what an earlier version kept (the app's import-legacy reads
// that browser key and imports it with importDocuments, app.ts): each kept scene becomes a work that keeps its original payload, and a kept
// value the field cannot read is named by its place and imports nothing.
test('the field\'s import of earlier scenes runs on what an earlier version kept: each scene is a work keeping where it came from; a damaged one is named', () => {
  const kept = JSON.parse(JSON.stringify([bridge.nativeExport(model.blankScene('Dawn')), {schemaVersion: 1, id: 'broken'}]))
  const result = bridge.importDocuments(kept)
  assert.deepEqual(result.journeys.map(journey => [journey.name, journey.scenes.map(scene => scene.name)]), [['Dawn', ['Dawn']]])
  assert.ok(result.journeys[0].scenes[0].native?.original, 'the work keeps the payload it came from')
  assert.match(result.journeys[0].description, /Original payload retained/)
  assert.deepEqual(result.errors, [{index: 1, message: 'Not a recognised native configuration'}], 'the damaged value is named by its place')
})

test('the field\'s body: the app\'s own import-legacy, refused in words when nothing earlier is kept (code-reading)', async () => {
  const source = await read(app, 'app.ts')
  // The stage command's case (runStageCommand), not the app's data-action case of the same name.
  const at = source.indexOf("case 'import':", source.indexOf('async function runStageCommand'))
  const branch = source.slice(at, at + 700)
  assert.match(branch, /command\.source===?'earlier'/, 'the import branch reads the source')
  assert.match(branch, /hasLegacyLibrary\(\)/, 'it asks whether anything earlier is kept')
  assert.match(branch, /No earlier scenes are kept/, 'and says so when nothing is')
  assert.match(branch, /action\('import-legacy'/, 'it runs the app\'s own import-legacy')
})

test('the browser\'s New section offers Import earlier scenes through the mounted field (code-reading)', async () => {
  const commands = await import(new URL('native/stageCommands.ts', shell))
  assert.deepEqual(commands.STAGE_IMPORT_EARLIER, {command: 'import', source: 'earlier'})
  const browser = await read(shell, 'components/NativeExpressionCollections.tsx')
  assert.match(browser, /EARLIER_ROW/, 'a row of its own')
  assert.match(browser, /Import earlier scenes/)
  assert.match(browser, /runner\(STAGE_IMPORT_EARLIER\)/, 'run through the mounted field\'s one runner')
})
