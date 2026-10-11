import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Production model source in memory, same loader as the sibling native tests.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function load(url,context,next){if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};}`)}`, import.meta.url)
const P = await import('../src/components/nativeScenePlayback.ts')

const idle = {scene_playing: false, saved_sequence_playing: false, scene_elapsed_seconds: 0, scene_ref: 'scene:a'}
const playing = {...idle, scene_playing: true, scene_elapsed_seconds: 2.5}

test('sceneDuration accepts only a positive finite working length', () => {
  assert.equal(P.sceneDuration(8), 8)
  assert.equal(P.sceneDuration(0), null)
  assert.equal(P.sceneDuration(-1), null)
  assert.equal(P.sceneDuration(Number.NaN), null)
  assert.equal(P.sceneDuration(Infinity), null)
  assert.equal(P.sceneDuration(undefined), null)
  assert.equal(P.sceneDuration(null), null)
})

test('clampSeek rounds to two decimals and stays within [0, duration]', () => {
  assert.equal(P.clampSeek(-3, 8), 0)
  assert.equal(P.clampSeek(99, 8), 8)
  assert.equal(P.clampSeek(1.234, 8), 1.23)
  assert.equal(P.clampSeek(Number.NaN, 8), 0)
  assert.equal(P.clampSeek(3, 0), 0, 'no duration means no position')
})

test('scrubStep moves arrows by 0.1 s and Shift+arrows by 1 s with exact decimals', () => {
  assert.equal(P.scrubStep(0, 8, 'ArrowRight', false), 0.1)
  assert.equal(P.scrubStep(0.3, 8, 'ArrowRight', false), 0.4)
  assert.equal(P.scrubStep(0.3, 8, 'ArrowLeft', false), 0.2)
  assert.equal(P.scrubStep(2, 8, 'ArrowUp', true), 3)
  assert.equal(P.scrubStep(2, 8, 'ArrowDown', true), 1)
  assert.equal(P.scrubStep(0, 8, 'ArrowLeft', false), 0, 'clamped at zero')
  assert.equal(P.scrubStep(7.95, 8, 'ArrowRight', true), 8, 'clamped at the duration')
  assert.equal(P.scrubStep(3, 8, 'Home', false), 0)
  assert.equal(P.scrubStep(3, 8, 'End', false), 8)
  assert.equal(P.scrubStep(3, 8, 'a', false), null, 'other keys are not scrub steps')
})

test('scrubStep accumulates without float drift across repeated presses', () => {
  let value = 0
  for (let i = 0; i < 3; i++) value = P.scrubStep(value, 8, 'ArrowRight', false)
  assert.equal(value, 0.3)
})

test('scrubBlock names saved-sequence playback first, then material, then busy', () => {
  assert.match(P.scrubBlock({ready: true, materialAvailable: true, duration: 8, savedSequencePlaying: true}), /working Scene only/)
  assert.match(P.scrubBlock({ready: true, materialAvailable: false, duration: 8, savedSequencePlaying: false}), /no authored working duration/)
  assert.match(P.scrubBlock({ready: true, materialAvailable: true, duration: null, savedSequencePlaying: false}), /no authored working duration/)
  assert.match(P.scrubBlock({ready: false, materialAvailable: true, duration: 8, savedSequencePlaying: false}), /busy/)
  assert.equal(P.scrubBlock({ready: true, materialAvailable: true, duration: 8, savedSequencePlaying: false}), null)
})

test('scrubRequest commits one working-sequence seek on release and nothing when unmoved', () => {
  assert.equal(P.scrubRequest(null, 2, 'scene:a', 8), null, 'no draft, no request')
  assert.equal(P.scrubRequest(2, 2, 'scene:a', 8), null, 'a press that does not move sends nothing')
  assert.equal(P.scrubRequest(2.004, 2, 'scene:a', 8), null, 'sub-hundredth movement is not a gesture')
  assert.deepEqual(P.scrubRequest(4.567, 2, 'scene:a', 8), {action: 'seek', scene_ref: 'scene:a', seconds: 4.57, sequence: 'working'})
  assert.deepEqual(P.scrubRequest(99, 2, 'scene:a', 8), {action: 'seek', scene_ref: 'scene:a', seconds: 8, sequence: 'working'})
  assert.equal(P.scrubRequest(3, 2, 'scene:a', null), null, 'no duration, no seek')
})

test('stopRequest is one seek to zero, and nothing when the Scene is idle at zero', () => {
  assert.equal(P.stopRequest(idle, 'scene:a', 8), null)
  assert.deepEqual(P.stopRequest(playing, 'scene:a', 8), {action: 'seek', scene_ref: 'scene:a', seconds: 0, sequence: 'working'})
  assert.deepEqual(P.stopRequest({...idle, scene_elapsed_seconds: 1.2}, 'scene:a', 8),
    {action: 'seek', scene_ref: 'scene:a', seconds: 0, sequence: 'working'}, 'a paused position rewinds')
  assert.deepEqual(P.stopRequest({...idle, saved_sequence_playing: true}, 'scene:a', 8),
    {action: 'seek', scene_ref: 'scene:a', seconds: 0, sequence: 'working'}, 'saved playback also stops')
  assert.equal(P.stopRequest(playing, 'scene:a', null), null, 'no working duration, no stop request')
})

test('playingState marks the disclosed Scene only while a clock runs', () => {
  assert.deepEqual(P.playingState(playing), {playing: true, sceneRef: 'scene:a'})
  assert.deepEqual(P.playingState({...idle, scene_ref: 'scene:b'}), {playing: false, sceneRef: null})
  assert.deepEqual(P.playingState({...idle, saved_sequence_playing: true, scene_ref: 'scene:c'}), {playing: true, sceneRef: 'scene:c'})
})

test('loopIntent carries a boolean and loopBlock explains the blocked states', () => {
  assert.deepEqual(P.loopIntent(true), {operation: 'loop', loop: true})
  assert.deepEqual(P.loopIntent(false), {operation: 'loop', loop: false})
  assert.match(P.loopBlock({ready: true, savedAvailable: false}), /Save the Scene sequence/)
  assert.match(P.loopBlock({ready: false, savedAvailable: true}), /Finish the current/)
  assert.equal(P.loopBlock({ready: true, savedAvailable: true}), null)
})
