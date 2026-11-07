import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 883 (content anchoring, DLW build ruling 2026-11-06): a roll or a slide that stops at a limit says so in plain words.
// The words are the owner's (sceneWorkflow CutResult.why → sceneEdits note); this suite carries them the rest of the way: the frame's
// editor receiver puts them on its reply, and the shell's Expressions controls say them in place of the plain receipt.
// Channels: SCRIPTED. The receiver runs with a fake owner (no native work); the controls run with a fake presented composition.
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const root = new URL('../../../../', import.meta.url)
const {installNativeEditorReceiver} = await import(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts', root))
const {EDITOR_CHANNEL} = await import(new URL('packages/expressions-boundary/src/editor.ts', root))
const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
const {answerOf} = await import('../src/frame/tracks/SessionGrid.tsx')

const STOPPED = 'The cut stops here: Scene 2 has no content before its own start.'
const ORIGIN = 'https://shell.test'
function receiverWith(editScenes) {
  const replies = []
  let listener = null
  const target = {location: {origin: ORIGIN}, addEventListener(type, fn) {if (type === 'message') listener = fn}, removeEventListener() {listener = null},
    parent: {postMessage(data) {replies.push(data)}}}
  const reading = {basis: {expression_ref: 'expression:e', revision: 1, scene_ref: 'expression:e:scene:1', authored_revision: 0}, scene: {}, entityOccurrences: {},
    chosenControls: {available: false, entries: [], controls: []}, devices: [], selection: {entity_ids: [], step_id: null},
    history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null}}
  const owner = {read: () => reading, transactionOpen: () => false, apply: async () => {}, select: async () => {}, selectField: async () => {},
    scene: async () => {}, editScenes, open: async () => {}, history: async () => {}, save: async () => {}}
  const receiver = installNativeEditorReceiver(owner, target)
  const send = async (req, request) => {
    listener({source: target.parent, origin: ORIGIN, data: {schema: EDITOR_CHANNEL, kind: 'request', token: 't', bindingId: 'b', epoch: 0, req, request}})
    await new Promise(resolve => setTimeout(resolve, 0))
    return replies.at(-1).reply
  }
  const edit = req => send(req, {operation: 'scene-edit', basis: reading.basis, native_selection: {scene_ref: reading.basis.scene_ref, entity_ref: null},
    intent_epoch: 1, intent: {operation: 'roll', scene_ref: reading.basis.scene_ref, seconds: -2}})
  return {send, edit, receiver}
}

test('the editor receiver puts the owner\'s words for a cut that stopped on its reply, and nothing when it went the whole way', async () => {
  const stopped = receiverWith(async () => ({note: STOPPED}))
  try {
    await stopped.send('read', {operation: 'read'})
    const reply = await stopped.edit('roll-1')
    assert.equal(reply.ok, true)
    assert.equal(reply.note, STOPPED)
  } finally {stopped.receiver.dispose()}
  const whole = receiverWith(async () => {})
  try {
    await whole.send('read', {operation: 'read'})
    const reply = await whole.edit('roll-2')
    assert.equal(reply.ok, true)
    assert.equal('note' in reply, false)
  } finally {whole.receiver.dispose()}
})

test('the Expressions controls say the owner\'s words for a cut that stopped, and the plain receipt otherwise', async () => {
  const replies = [{ok: true, reading: {}, note: STOPPED}, {ok: true, reading: {}}, {ok: false, error: 'The owner refused.'}]
  const source = {isPresented: () => true, content: {}, actions: {sceneEdit: async () => replies.shift()}}
  const {sceneEdit} = expressionsControls(source, {state: null, run: null})
  const intent = {operation: 'roll', scene_ref: 's1', seconds: -2}
  assert.deepEqual(await sceneEdit.run(intent), {ok: true, note: STOPPED})
  assert.deepEqual(await sceneEdit.run(intent), {ok: true, note: 'The Expression changed.'})
  assert.deepEqual(await sceneEdit.run(intent), {ok: false, error: 'The owner refused.'})
  assert.equal(typeof answerOf, 'function')
})
