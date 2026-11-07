import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 893, seen walking ruling 1 (walk 893d, captures 57 and 58): a launch whose triggers took it on to another scene was
// answered "The scene plays." under the pressed scene's name. Dusk's Activated trigger jumped to Noon before Dusk's launch landed, so
// Dusk never played, yet the grid read "Launch Dusk — The scene plays." with Dawn running. The launch's answer is read off the owner's
// reading after the launch (modeTracks.ts launchAnswer): where another scene plays and the pressed one neither plays nor waits, it says
// which scene plays and why, in the scenes' own titles (DLW build ruling 2026-11-07).
// SCRIPTED: the shell's Expressions controls over a FIXTURE owner reply to play-scene, as expressions-session-launch-885 does.
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
  if(url.includes('?raw')||url.endsWith('.html'))return {format:'module',shortCircuit:true,source:'export default ""'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
const E = 'expression:w', DAWN = `${E}:scene:dawn`, NOON = `${E}:scene:noon`, DUSK = `${E}:scene:dusk`
const SCENES = {scenes: [{scene_ref: DAWN, title: 'Dawn'}, {scene_ref: NOON, title: 'Noon'}, {scene_ref: DUSK, title: 'Dusk'}]}

/** The answer to pressing `pressed`'s launch, the owner's reading after it naming the playing scene and any held launch (FIXTURE). */
async function answer(pressed, playing, pending = null) {
  const reading = {basis: {expression_ref: E, revision: 4, scene_ref: playing}, scenes: SCENES,
    playback: {scene_ref: playing, scene_playing: true, saved_sequence_playing: false, launch_pending: pending}}
  const source = {isPresented: () => true, content: {playback: {saved_sequence_playing: false}, scenes: {}},
    actions: {scene: async action => { assert.deepEqual(action, {action: 'play-scene', scene_ref: pressed}); return {ok: true, reading} }}}
  return expressionsControls(source, {state: null, run: null}).playScene.run(E, pressed)
}

test('a launch its triggers took on to another scene says which scene plays, never "The scene plays." under the pressed name', async () => {
  // Dusk activated → Jump to Noon, Noon enters → Jump to Dawn: Dusk never played (walk 893d, 58).
  assert.deepEqual(await answer(DUSK, DAWN), {ok: true, note: 'Dawn plays, not Dusk: the triggers this launch ran took it there.'})
  // Held on: the chain's last jump still waits on its Quantize, so what follows is said too.
  assert.deepEqual(await answer(DUSK, NOON, {scene_ref: DAWN, at_seconds: 1}),
    {ok: true, note: 'Noon plays, not Dusk: the triggers this launch ran took it there. Dawn follows at 1.00 s of the playing scene, on its Quantize.'})
})

test('a launch that plays while its own triggers hold another scene says what follows (walk 893d, 57: Dawn enters → Jump to Noon)', async () => {
  // A later launch takes a held one's place (app.ts placeLaunch), so a hold read after this press is its own chain's.
  assert.deepEqual(await answer(DAWN, DAWN, {scene_ref: NOON, at_seconds: 4}),
    {ok: true, note: 'The scene plays. Noon follows at 4.00 s of the playing scene, on its Quantize: the triggers this launch ran launched it.'})
})

test('a launch that plays, or waits for its Quantize, is answered as before', async () => {
  assert.deepEqual(await answer(DAWN, DAWN), {ok: true, note: 'The scene plays.'})
  assert.deepEqual(await answer(DAWN, NOON, {scene_ref: DAWN, at_seconds: 2.5}), {ok: true, note: 'Launched: it lands at 2.50 s of the playing scene, on its Quantize.', waits: true})
  // A reading that names no title for the scene that plays says nothing it cannot read.
  const source = {isPresented: () => true, content: {playback: {saved_sequence_playing: false}, scenes: {}},
    actions: {scene: async () => ({ok: true, reading: {basis: {expression_ref: E, revision: 4, scene_ref: 'x'}, playback: {scene_ref: 'x', scene_playing: true, launch_pending: null}}})}}
  assert.deepEqual(await expressionsControls(source, {state: null, run: null}).playScene.run(E, DUSK), {ok: true, note: 'The scene plays.'})
})
