import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// O-I #747 round 885, found walking the scene launch's Quantize in a running frame: in Expressions, Session view and Arrangement view
// are views of the open work (manual §10.2: "two views of the mode's one set of tracks"; its scenes stand on the grid as clips), so
// the frame under them is still the work you act on. The host's presented gate read the frame's own box only: under the set's views
// the frame is hidden, and every launch on the grid was refused ("Open one native Expression Scene before capturing its target").
// The open work is presented while its frame shows, or while a set view stands whose tracks are the open Expression's own sources
// (the mode's registration, shell/modeFrames.ts MODE_TRACK_SOURCES 'native': Expressions), never by a branch on the mode's name
// (switchboard-tripwire); in another mode's set view, or in Pane view with the frame hidden, it is not. And the launch's receipt said "The scene plays." while the clip waited for its bar: a launch
// the frame holds is answered as the clip's note says it, when it lands. SCRIPTED: the pure law, the panel's use of it and the
// launch's answer over a FIXTURE owner reply; the screen pass is the lane's walk.
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

const view = await import('../src/shell/mainView.ts')
const {MODE_TRACK_SOURCES} = await import('../src/shell/modeFrames.ts')
const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')

test('r885: the open Expression is presented while its frame shows, or while a set view of its own sources stands', () => {
  assert.equal(typeof view.workPresented, 'function')
  for (const set of ['session', 'arrangement']) {
    assert.equal(view.workPresented(false, 'native', set), true, `${set} view of the open Expression's sources: its scenes are the grid's clips; a launch reaches the frame`)
    assert.equal(view.workPresented(false, 'world', set), false, `${set} view of the World cut (Central, Factory, Technē): another set stands over the frame`)
    assert.equal(view.workPresented(false, 'set', set), false, `${set} view of Live's open set, not the Expression's`)
  }
  assert.equal(view.workPresented(false, 'native', 'pane'), false, 'Pane view with the frame hidden: not presented')
  for (const tracks of ['native', 'world', 'set']) assert.equal(view.workPresented(true, tracks, 'pane'), true, `${tracks}: the frame shows`)
  // Read through each mode's registration: only Expressions' set views present the open work.
  for (const mode of SURF_MODES) assert.equal(view.workPresented(false, MODE_TRACK_SOURCES[mode], 'session'), mode === 'expressions', mode)
})

test('r885: the view as it stands is the default, so the panel reads it when its gate is asked', () => {
  view.showMainView('pane')
  assert.equal(view.workPresented(false, 'native'), false)
  view.showMainView('session')
  assert.equal(view.workPresented(false, 'native'), true)
  view.showMainView('arrangement')
  assert.equal(view.workPresented(false, 'native'), true)
  view.showMainView('pane')
})

test('r885: the Expressions panel\'s presented gate is that law over its mode\'s registration, its frame\'s box the frame-shows half', async () => {
  const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
  assert.match(panel, /const presented = \(\) => workPresented\(!!target\.getClientRects\(\)\.length && !target\.closest\('\[hidden\],\[inert\]'\), MODE_TRACK_SOURCES\[modeRef\.current\]\)/)
})

test('r885: a launch the frame holds for its Quantize is answered when it lands, as its clip\'s note says; one that plays at once, so', async () => {
  /** FIXTURE: the owner's reply to play-scene, its reading's playback as the frame reports it after the launch. */
  const reply = pending => ({ok: true, reading: {playback: {scene_ref: 's1', scene_playing: true, launch_pending: pending}}})
  const answer = async pending => {
    const source = {isPresented: () => true, content: {playback: {saved_sequence_playing: false}, scenes: {}},
      actions: {scene: async action => { assert.deepEqual(action, {action: 'play-scene', scene_ref: 's2'}); return reply(pending) }}}
    return expressionsControls(source, {state: null, run: null}).playScene.run('expression:w', 's2')
  }
  assert.deepEqual(await answer({scene_ref: 's2', at_seconds: 2.5}), {ok: true, note: 'Launched: it lands at 2.50 s of the playing scene, on its Quantize.'})
  assert.deepEqual(await answer(null), {ok: true, note: 'The scene plays.'}, 'nothing held: it plays now')
  assert.deepEqual(await answer({scene_ref: 's3', at_seconds: 2.5}), {ok: true, note: 'The scene plays.'}, 'another scene\'s hold is not this launch')
})
