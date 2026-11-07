// O-I #747 round 884, XS15 ("I switch an Expression off, solo its sound and set its level and the level of all together"), settled by the
// manual (DLW build ruling 2026-11-06; DLW.md §20.1 The mixer row, The Main track): "Volume | The level of the Expression's sound";
// "Activator | The Expression plays, or it does not. Off, its scenes do not launch, and its track is dimmed"; the Main track's mixer row
// "sets the level of every Expression's sound together". The level and the Main level are the frame's sound command, kept by the frame
// and reported in its hosted state. SCRIPTED: no frame is mounted and no audio device is opened; the voices' gain rule is pure.
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
const {projectExpressionsWork, EXPRESSIONS_MAIN_TRACK_ID} = await import('../src/timeline/expressionsTrackAdapter.ts')
const {ArrangementRulerView} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const stage = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts')
const entitySound = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts')
const {readHostedState} = await import('../../../expressions-boundary/src/protocol.ts')

const noop = () => {}
const work = (over = {}) => {
  const calls = []
  const reading = {expressions: [{id: 'expression:a', name: 'Dawn', scenes: [{id: 's1', name: 'One', duration: 4}, {id: 's2', name: 'Two', duration: 4}]}],
    controls: {playScene: {op: 'play-scene', run: (e, s) => { calls.push(['play', e, s]); return {ok: true, note: 'The scene plays.'} }},
      playSaved: {op: 'play-saved', run: () => { calls.push(['saved']); return {ok: true, note: 'The saved sequence plays again.'} }},
      sound: {op: 'sound', muted: false, soloed: null, level: 0.5, main: 1, mute: (id, m) => calls.push(['mute', id, m]), solo: noop,
        setLevel: (id, gain) => { calls.push(['level', id, Math.round(gain * 1000) / 1000]); return {ok: true, note: 'set'} },
        setMain: gain => { calls.push(['main', Math.round(gain * 1000) / 1000]); return {ok: true, note: 'set'} }, ...over}}}
  return {calls, set: projectExpressionsWork(reading)}
}

test('XS15: each Expression has its Volume and the Main track its level, read from the frame and written through its sound command', async () => {
  const {calls, set} = work()
  assert.deepEqual(set.mixer.volume, {meaning: 'The level of the Expression\'s sound', range: {min: -70, max: 6, unit: 'dB'}})
  for (const track of set.tracks.filter(t => !t.main)) assert.equal(track.mix.volume, -6, `${track.id}: half gain is -6 dB`)
  const main = set.tracks.find(t => t.main)
  assert.equal(main?.id, EXPRESSIONS_MAIN_TRACK_ID)
  assert.deepEqual([main.name, main.mix.volume], ['Main', 0])
  await set.actions.mixer.volume.run('expression:expression:a:visual', -12)
  await set.actions.mixer.volume.run(EXPRESSIONS_MAIN_TRACK_ID, 6)
  assert.deepEqual(calls, [['level', 'expression:a', 0.251], ['main', 1.995]], 'each through the frame: the Expression\'s level, and Main\'s')
  assert.deepEqual(await set.actions.mixer.volume.run(EXPRESSIONS_MAIN_TRACK_ID, NaN), {ok: false, error: 'The volume takes a level in dB.'})
  assert.equal(work({level: null, main: null}).set.mixer.volume.disabled, undefined, 'the op stands even before the frame reports a level')
  assert.match(projectExpressionsWork({expressions: [{id: 'e', name: 'E', scenes: []}]}).mixer.volume.disabled, /missing op/)
})

test('XS15: an Expression switched off by its Activator refuses its launches in plain words, and its track is dimmed', async () => {
  assert.equal(work().set.mixer.activator.meaning, 'The Expression plays, or it does not. Off, its scenes do not launch, and its track is dimmed.')
  const {calls, set} = work({muted: true})
  const refusal = {ok: false, error: 'Dawn is switched off: switch its Activator on to launch its scenes.'}
  assert.deepEqual(await set.actions.launch.run('scene:expression:a:s1:visual'), refusal)
  assert.deepEqual(await set.actions.launchStop.run(set.columns[0].id), refusal)
  assert.deepEqual(await set.actions.backToArrangement.run(), refusal)
  assert.deepEqual(calls, [], 'nothing reached the owner')
  const view = ArrangementRulerView({set, selection: {select: noop}, receipt: null, onDismiss: noop, onPress: noop,
    view: {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 360}})
  const markup = renderToStaticMarkup(view)
  assert.match(markup, /data-track="expression:expression:a:visual"[^>]*data-off="true"/, 'the track is dimmed')
  assert.doesNotMatch(renderToStaticMarkup(ArrangementRulerView({set: work().set, selection: {select: noop}, receipt: null, onDismiss: noop, onPress: noop,
    view: {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 360}})), /data-off="true"/)
  const on = work()
  assert.deepEqual(await on.set.actions.launch.run('scene:expression:a:s1:visual'), {ok: true, note: 'The scene plays.'})
})

test('XS15: the frame takes level and Main in its sound command, keeps them, reports them, and the voices sound at gain × level × Main', async () => {
  const read = raw => stage.readStageRequest({v: 1, kind: 'host-command', req: 7, command: 'sound', ...raw})
  assert.deepEqual(read({level: 0.5}), {req: 7, command: {command: 'sound', level: 0.5}})
  assert.deepEqual(read({main: 2, muted: false}), {req: 7, command: {command: 'sound', muted: false, main: 2}})
  for (const bad of [{}, {level: 2.5}, {level: -0.1}, {main: 'loud'}, {level: NaN}, {level: 1, extra: 1}]) assert.equal(read(bad), null, JSON.stringify(bad))
  entitySound.setObjectSoundLevels({level: 0.5}); entitySound.setObjectSoundLevels({main: 0.5})
  assert.deepEqual(entitySound.objectSoundLevels(), {level: 0.5, main: 0.5})
  assert.throws(() => entitySound.setObjectSoundLevels({level: 3}), /A sound level runs from silence to \+6 dB/)
  assert.equal(entitySound.soundingGain(0.8, false, entitySound.objectSoundLevels()), 0.2)
  assert.equal(entitySound.soundingGain(0.8, true, entitySound.objectSoundLevels()), 0)
  entitySound.setObjectSoundLevels({level: 1, main: 1})
  const hosted = extra => readHostedState({hostMode: 'techne', sceneIndex: 0, sceneCount: 1, ...extra})
  assert.deepEqual([hosted({soundLevel: 0.5, soundMain: 2}).soundLevel, hosted({soundLevel: 0.5, soundMain: 2}).soundMain], [0.5, 2])
  assert.equal(hosted({soundLevel: 3}), null, 'a level past +6 dB is no reading')
  assert.equal(hosted({soundMain: 'full'}), null)
  sound.resetFrameSound()
  const sent = [], link = {state: {nativeScene: {expression_ref: 'expression:a'}, soundMuted: false, soundLevel: 0.5, soundMain: 1}, run: async c => { sent.push(c); return {ok: true} }}
  assert.deepEqual(sound.frameSoundReading(link), {muted: false, soloed: null, level: 0.5, main: 1})
  await sound.setExpressionLevel(link, 0.25); await sound.setMainLevel(link, 2)
  assert.deepEqual(sent, [{command: 'sound', level: 0.25}, {command: 'sound', main: 2}])
})
