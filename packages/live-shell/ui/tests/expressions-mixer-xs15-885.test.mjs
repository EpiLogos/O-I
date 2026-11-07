// O-I #747 round 885, XS15's limits (DLW build ruling 2026-11-06, the lead's), on the shell's side. The mixer row (DLW.md §20.1):
// "Volume | The level of the Expression's sound"; "Activator | The Expression plays, or it does not. Off, its scenes do not launch, and its
// track is dimmed"; "Solo | Lets you hear only this Expression's sound". Level, Main and the Activator are the Expression's own, kept in its
// document as a Live Set keeps its mixer: the row reads them from the scenes reading and writes them through the owner's `mix` scene edit.
// Solo and the Field's Sound (the frame's "Mute all object sound here") are what is heard: the frame's `sound` command carries them, and
// neither reads as the Activator. SCRIPTED: no frame is mounted and no audio device is opened.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const sound = await import('../src/native/frameSound.ts')
const {projectExpressionsWork} = await import('../src/timeline/expressionsTrackAdapter.ts')
const {expressionsControls} = await import('../src/frame/tracks/modeTracks.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')

const noop = () => {}
const linkOf = (state, sent) => ({state, run: async command => { sent.push(command); return {ok: true} }})
const frame = {nativeScene: {expression_ref: 'expression:a', revision: 1, scene_ref: 's'}}

test('r885: the Activator is the Expression\'s own; the frame\'s mute here never reads as it, and nothing reads as it unread', () => {
  sound.resetFrameSound()
  const link = linkOf({...frame, soundMuted: true}, [])
  // Round 886: Solo is the document's too (`solo`, read with the mixer), no longer a shell-held soloed Expression.
  assert.deepEqual(sound.frameSoundReading(link, undefined), {active: null, solo: null, level: null, main: null, muted: true},
    'no mixer read yet: no Activator, though the frame is muted here')
  assert.deepEqual(sound.frameSoundReading(link, {level: 0.5, main: 1, active: true}), {active: true, solo: false, level: 0.5, main: 1, muted: true})
  assert.deepEqual(sound.frameSoundReading({state: null, run: null}, {level: 1, main: 1, active: false}), {active: false, solo: false, level: 1, main: 1, muted: null})
})

test('r885: the Activator, Volume and Main are written to the Expression\'s document through its owner\'s `mix` edit, never to the frame', async () => {
  const intents = [], edit = async intent => { intents.push(intent); return {ok: true} }
  await sound.setExpressionActive(edit, false)
  await sound.setExpressionLevel(edit, 0.25)
  await sound.setMainLevel(edit, 2)
  assert.deepEqual(intents, [{operation: 'mix', set: {active: false}}, {operation: 'mix', set: {level: 0.25}}, {operation: 'mix', set: {main: 2}}])
  const refused = {ok: false, error: 'The open Expression\'s owner takes no mixer settings here.'}
  for (const write of [() => sound.setExpressionActive(null, true), () => sound.setExpressionLevel(null, 1), () => sound.setMainLevel(null, 1)])
    assert.deepEqual(await write(), refused)
})

test('r885: Solo and the Field\'s Sound are what is heard here: the frame\'s `sound` command says silenced or muted, and nothing else', async () => {
  // Round 886 (DLW build ruling 2026-11-06): Solo is kept in the document; what the frame hears of it is another open Expression's Solo
  // (tests/session-states-colour-solo-level-886.test.mjs). Here: the frame is told silenced, then the Field's Sound, and nothing else.
  sound.resetFrameSound()
  const sent = [], link = linkOf({...frame, soundMuted: false}, sent)
  sound.noteWorksSolo([{expression_ref: 'expression:a', open: true}, {expression_ref: 'expression:b', open: true, solo: true}])
  await sound.syncSoloSilenced(link)
  sound.noteSolo('expression:b', false)
  await sound.syncSoloSilenced(link)
  await sound.syncSoloSilenced(link)
  await sound.setFieldSoundMuted(link, true)
  assert.deepEqual(sent, [{command: 'sound', silenced: true}, {command: 'sound', silenced: false}, {command: 'sound', muted: true}])
  assert.deepEqual(await sound.setFieldSoundMuted({state: null, run: null}, true), {ok: false, error: 'No Expressions application is mounted.'})
  sound.resetFrameSound()
})

test('r885: the row reads the mixer from the scenes reading and presses the owner\'s `mix` edit; with no mixer disclosed it stands absent', async () => {
  sound.resetFrameSound()
  const intents = [], sent = []
  const source = mix => ({isPresented: () => true, content: {playback: {saved_sequence_playing: false}, scenes: mix === undefined ? {} : {mix}},
    actions: {scene: async () => ({ok: true}), sceneEdit: async intent => { intents.push(intent); return {ok: true} }}})
  const link = linkOf({...frame, soundMuted: true}, sent)
  const controls = expressionsControls(source({level: 0.5, main: 1, active: false}), link)
  assert.deepEqual([controls.sound.active, controls.sound.level, controls.sound.main], [false, 0.5, 1])
  assert.deepEqual(await controls.sound.activate('expression:a', true), {ok: true, note: 'The Expression plays again.'})
  await controls.sound.setLevel('expression:a', 0.25); await controls.sound.setMain(2)
  assert.deepEqual(intents, [{operation: 'mix', set: {active: true}}, {operation: 'mix', set: {level: 0.25}}, {operation: 'mix', set: {main: 2}}])
  assert.deepEqual(sent, [], 'none of them went to the frame')
  assert.equal(expressionsControls(source(undefined), link).sound, undefined, 'an owner that discloses no mixer: no row behind it')
  sound.resetFrameSound()
})

test('r885: an Expression whose Activator nobody read launches and is not dimmed, though the frame is muted here', async () => {
  const calls = []
  const reading = {expressions: [{id: 'expression:a', name: 'Dawn', scenes: [{id: 's1', name: 'One', duration: 4}]}],
    controls: {playScene: {op: 'play-scene', run: (e, s) => { calls.push(['play', e, s]); return {ok: true, note: 'The scene plays.'} }},
      sound: {op: 'sound', active: null, soloed: null, muted: true, activate: noop, solo: noop}}}
  const set = projectExpressionsWork(reading)
  for (const track of set.tracks) assert.equal('activator' in track.mix, false, `${track.id}: no Activator read`)
  assert.deepEqual(await set.actions.launch.run('scene:expression:a:s1:visual'), {ok: true, note: 'The scene plays.'})
  const markup = renderToStaticMarkup(ArrangementRulerView({set, selection: {select: noop}, receipt: null, onDismiss: noop, onPress: noop,
    view: {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 360}}))
  assert.doesNotMatch(markup, /data-off="true"/, 'not dimmed')
  assert.deepEqual(calls, [['play', 'expression:a', 's1']])
})
