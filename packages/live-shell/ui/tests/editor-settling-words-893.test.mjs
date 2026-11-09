// O-I #747 round 893 (walk 892, captures-13/10-split.png): ⌘E pressed within about 0.7 s of selecting a scene was refused with "Read the
// current native editor before applying an operation" — words for a program, not a person. The shell's editor had not yet read the
// Expression since it took the selected scene, so its act stood on the scene shown before; each act keeps the basis it was shown on and
// is never silently moved to a newer one (shell/nativeContent.ts), so the act is refused — now in plain words that say what to do. A
// basis older than the Expression's is said plainly too. The frame's own receiver says the first the same way.
// Channels: SCRIPTED — the boundary's editor client over a host whose presented scene the shell has not read yet. CODE-READING — the
// basis check and the frame's receiver.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
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



const {createNativeEditorClient} = await import('../../../expressions-boundary/src/editorHost.ts')

const scene = {expression_ref: 'expression:dawn', scene_ref: 'expression:dawn:scene:s3', revision: 6}
function host() {
  const posted = []
  return {posted, origin: 'http://frame.test', frame: {contentWindow: {postMessage: data => posted.push(data)}, addEventListener() {}, removeEventListener() {}},
    captureTarget: () => ({bindingId: 'world.expressions', epoch: 1, scene}), tellShown: () => {}, readOutcomeTarget: () => null}
}
const NOT_YET = 'The Expression has not caught up with the scene you selected yet: try again in a moment. Nothing was changed.'

test('an act asked before the shell has read the scene just selected is refused in plain words, and nothing is sent', async () => {
  const h = host(), client = createNativeEditorClient(h, new EventTarget())
  const reply = await client.request({operation: 'scene-edit', basis: {expression_ref: scene.expression_ref, scene_ref: 'expression:dawn:scene:s1', revision: 6, authored_revision: 3},
    intent_epoch: 0, native_selection: {scene_ref: 'expression:dawn:scene:s1', entity_ref: null}, intent: {operation: 'split', scene_ref: 'expression:dawn:scene:s3', at: 4}})
  assert.deepEqual(reply, {ok: false, error: NOT_YET})
  assert.deepEqual(h.posted, [], 'nothing reached the frame')
  client.dispose?.()
})

test('CODE-READING: an act on an older basis than the Expression\'s is said plainly; the frame\'s receiver says the first the same way', async () => {
  const boundary = await readFile(new URL('../../../expressions-boundary/src/editorHost.ts', import.meta.url), 'utf8')
  assert.match(boundary, /throw Error\(NOT_CAUGHT_UP\)/)
  assert.match(boundary, /\|\| request\.basis\.revision !== target\.scene\.revision\) throw Error\('The Expression changed after this was shown here: try again on what it shows now\. Nothing was changed\.'\);/)
  assert.doesNotMatch(boundary, /Read the current native editor before applying an operation/)
  const frame = await readFile(new URL('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts', import.meta.url), 'utf8')
  assert.match(frame, /if \(request\.operation !== 'read'\) throw Error\('The Expression has not caught up with the scene you selected yet: try again in a moment\. Nothing was changed\.'\);/)
  // Walk 893 (captures-893a 54): ⌘E pressed at once met the frame still taking the selection itself, and was refused with "A native editor
  // operation is awaiting acknowledgement". Every such refusal of the frame's editor is said plainly now.
  assert.doesNotMatch(frame, /A native editor operation is awaiting acknowledgement/)
  assert.match(frame, /const STILL_TAKING = 'The Expression is still taking your last change: try again in a moment\. Nothing was changed\.'/)
  assert.match(frame, /if \(busy\) throw Error\(STILL_TAKING\);/)
})
