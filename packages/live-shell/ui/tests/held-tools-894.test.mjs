// O-I #747 round 894, the port ledger's tool-text, tool-orbit, tool-formation and place-formation: the pointer tools of Clip view (manual §20.1
// Tools: "Select | Selects a symbol. Orbit | Turns the view of the field round its centre. Form | Draws a form in the field.") are modes the
// field holds. Orbit is the field's own orbit tool, held until another tool is chosen; Form is a placement the field holds until the next click
// in the field places a form there (the field's own place-formation); and Text is held while the field's text context stands, so the bar's
// Text reads pressed from the field's own reading. The Objects category places any formation shape the same way, beside its add.
// The stage grammar is the frame's own (exact keys); the frame's bodies are read from their source, as the stage-command suites read them.
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
const [frame, clip, bar, commands] = await Promise.all([
  import(new URL('stageCommands.ts', app)), import(new URL('components/expressions/clip/clipBinding.ts', shell)),
  import(new URL('components/nativeBarModel.ts', shell)), import(new URL('native/stageCommands.ts', shell)),
])
const read = (base, name) => readFile(new URL(name, base), 'utf8')
const round = command => frame.readStageRequest(frame.stageRequestMessage(5, command))?.command ?? null

test('the field admits Orbit as a tool it holds, and a placement of one formation shape at the next click (place)', () => {
  assert.deepEqual(round({command: 'tool', tool: 'orbit'}), {command: 'tool', tool: 'orbit'})
  for (const shape of ['text', 'ring', 'disc', 'triangle', 'square']) assert.deepEqual(round({command: 'place', shape}), {command: 'place', shape}, shape)
  assert.deepEqual(round({command: 'place', shape: 'text', text: 'Om'}), {command: 'place', shape: 'text', text: 'Om'})
  for (const bad of [{command: 'place', shape: 'yantra'}, {command: 'place', shape: 'ring', text: 'O'}, {command: 'place', shape: 'text', text: ''},
    {command: 'place', shape: 'text', text: 'x'.repeat(121)}, {command: 'place'}, {command: 'place', shape: 'disc', at: 1}])
    assert.equal(frame.readStageRequest({v: 1, kind: 'host-command', req: 2, ...bad}), null, JSON.stringify(bad))
})

test('Clip view\'s pointer tools are held modes of the field: Select, Orbit and Form each send the field its tool; Bind says why not', () => {
  assert.deepEqual(clip.pointerToolCommand('select'), {command: 'tool', tool: 'select'})
  assert.deepEqual(clip.pointerToolCommand('orbit'), {command: 'tool', tool: 'orbit'}, 'Orbit holds: a drag in the field turns the view')
  assert.deepEqual(clip.pointerToolCommand('form'), {command: 'place', shape: 'text', text: 'O'}, 'Form places a form at the next click in the field')
  assert.throws(() => clip.pointerToolCommand('bind'), /Bind/)
  assert.equal(clip.pointerToolOf({stage: {tool: 'orbit'}}), 'orbit')
  assert.equal(clip.pointerToolOf({stage: {tool: 'formation'}}), 'form', 'a placement the field holds is Form, pressed')
  assert.equal(clip.pointerToolOf({stage: {tool: 'select'}}), 'select')
  assert.equal(clip.pointerToolOf({stage: {tool: 'text'}}), undefined, 'Text is no pointer tool')
})

test('Text is held while the field holds its text context: the bar\'s Text is pressed by the field\'s own reading', async () => {
  const pressed = state => bar.barToolRail(state).find(item => item.tool === 'text').pressed
  assert.equal(pressed({stage: {tool: 'text'}}), true)
  assert.equal(pressed({stage: {tool: 'select'}}), false)
  const source = await read(app, 'app.ts')
  assert.match(source, /tool:contextKind==='text'&&tool!=='orbit'\?'text':tool/, 'the field announces Text while its text context stands')
  const toolCase = source.slice(source.indexOf("case 'tool':", source.indexOf('async function runStageCommand')), source.indexOf("case 'tool':", source.indexOf('async function runStageCommand')) + 500)
  assert.match(toolCase, /command\.tool==='orbit'\)\{toolTo\('orbit'\)/, 'Orbit is the field\'s own orbit tool, held')
  const at = source.indexOf("case 'place':", source.indexOf('async function runStageCommand'))
  assert.ok(at > 0, 'the field takes a placement')
  assert.match(source.slice(at, at + 600), /shapeChoice=command\.shape/)
  assert.match(source.slice(at, at + 600), /action\('place-formation'/, 'by its own place-formation: the next click places it')
})

test('a cursor tool chosen in the shell leaves the field\'s text context, so Select reads pressed after Text (the walk of round 894)', async () => {
  // Walked: Text, then Clip view's Select, left the field announcing Text (its text context still stood), so no pointer tool read pressed.
  const source = await read(app, 'app.ts')
  const start = source.indexOf("case 'tool':", source.indexOf('async function runStageCommand'))
  const toolCase = source.slice(start, start + 900)
  const leaves = toolCase.indexOf("if((command.tool==='select'||command.tool==='interact')&&contextKind==='text')contextKind='';")
  assert.ok(leaves > 0, 'Select or Interact from the shell closes the text context')
  assert.ok(leaves < toolCase.indexOf('activateRail(command.tool)'), 'before the rail takes the tool, so the field announces the tool chosen')
})

test('the Objects category places a formation at a click in the field, beside its add (click-to-place)', async () => {
  assert.deepEqual(commands.stagePlace('ring'), {command: 'place', shape: 'ring'})
  assert.deepEqual(commands.stagePlace('text', 'Om'), {command: 'place', shape: 'text', text: 'Om'})
  const browser = await read(shell, 'components/NativeObjectBrowser.tsx')
  assert.match(browser, /stagePlace\(row\.kind/, 'each formation row places its shape')
  assert.match(browser, /Place in the field/)
})
