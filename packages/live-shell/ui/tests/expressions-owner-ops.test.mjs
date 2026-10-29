// Expressions' own owner ops on the shell's views: the Expression's sound on its mixer row (the frame's `sound` stage command and
// `soundMuted` reading, native/frameSound.ts), the Studio arm as the row's Arm, and the scene's clip settings (model.ts SceneClip,
// the `clip` scene edit; r2-clip-bindings drives the Clip view). Channels: SCRIPTED frame links in memory; the engine's stage
// command reader through r2-clip-bindings' loader.
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

const sound = await import('../src/native/frameSound.ts')
const {projectExpressionsWork} = await import('../src/timeline/expressionsTrackAdapter.ts')
const stage = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts')

const linkOf = (state, sent) => ({state, run: async command => { sent.push(command); return {ok: true} }})

test('the frame takes `sound` as a closed stage command, and nothing else under that name', () => {
  assert.deepEqual(stage.readStageRequest({v: 1, kind: 'host-command', req: 4, command: 'sound', muted: true}), {req: 4, command: {command: 'sound', muted: true}})
  assert.equal(stage.readStageRequest({v: 1, kind: 'host-command', req: 4, command: 'sound', muted: 'yes'}), null)
  assert.equal(stage.readStageRequest({v: 1, kind: 'host-command', req: 4, command: 'sound', muted: true, solo: true}), null)
  assert.ok(stage.STAGE_COMMANDS.includes('sound'))
})

test('the Activator is the person\'s mute; Solo silences the open Expression when another is soloed, and restores it after', async () => {
  sound.resetFrameSound()
  const sent = [], link = linkOf({nativeScene: {expression_ref: 'expression:a', revision: 1, scene_ref: 's'}, soundMuted: false}, sent)
  assert.deepEqual(sound.frameSoundReading(link), {muted: false, soloed: null}, 'the frame\'s own report stands until the person sets it')
  await sound.setExpressionMuted(link, 'expression:a', true)
  await sound.setExpressionSolo(link, 'expression:a', 'expression:b', true)
  await sound.setExpressionMuted(link, 'expression:a', false)
  await sound.setExpressionSolo(link, 'expression:a', 'expression:b', false)
  assert.deepEqual(sent.map(c => c.muted), [true, true, true, false], 'unmuted but another soloed stays silent; unsoloed, it sounds')
  assert.deepEqual(sound.frameSoundReading(link), {muted: false, soloed: null})
  assert.equal(sound.soundSilenced(false, 'expression:a', 'expression:a'), false, 'soloing the open Expression lets it sound')
  assert.deepEqual(await sound.setExpressionMuted({state: null, run: null}, 'x', true), {ok: false, error: 'No Expressions application is mounted.'})
  sound.resetFrameSound()
})

test('the mixer row reads the Expression\'s sound and the Studio arm, and its presses go to them', async () => {
  const calls = []
  const work = {expressions: [{id: 'expression:a', name: 'Dawn', scenes: [{id: 's1', name: 'One', duration: 4}]}],
    controls: {sound: {op: 'sound', muted: true, soloed: 'expression:a', mute: (id, muted) => calls.push(['mute', id, muted]), solo: (id, on) => calls.push(['solo', id, on])},
      arm: {op: 'arm', on: true, set: on => calls.push(['arm', on])}}}
  const set = projectExpressionsWork(work)
  for (const track of set.tracks) assert.deepEqual(track.mix, {activator: false, solo: true, arm: true}, track.id)
  assert.equal(set.mixer.activator.disabled, undefined); assert.equal(set.mixer.solo.disabled, undefined)
  assert.match(set.mixer.arm.grain, /one arm for the open Expression/)
  await set.actions.mixer.activator.run('expression:expression:a:audio', true)
  await set.actions.mixer.solo.run('expression:expression:a:visual', false)
  await set.actions.mixer.arm.run('expression:expression:a:audio', false)
  assert.deepEqual(calls, [['mute', 'expression:a', false], ['solo', 'expression:a', false], ['arm', false]])
  const unsounded = projectExpressionsWork({expressions: work.expressions})
  assert.match(unsounded.mixer.activator.disabled, /missing op/, 'no frame link: the row says what it lacks')
})

// O-I #747 round two (manual §20.1 The track: "Title … Description — A note about the Expression for a reader. An empty note is a real
// value"; its settings stand on the head): the description is the track head's info text, read and written through the owner.
test('the Expression\'s description stands on its track head: its info text, read from the owner and written through expression-description', async () => {
  const acts = await import('../src/frame/menu/objectActions.ts')
  const sent = []
  const edit = {op: 'expressions scene-edit', run: async intent => { sent.push(intent); return {ok: true, note: 'The Expression changed.'} }}
  const work = description => ({expressions: [{id: 'expression:a', name: 'Dawn', ...(description === undefined ? {} : {description}),
    scenes: [{id: 's1', name: 'One', duration: 4}]}], controls: {sceneEdit: edit}})
  const set = projectExpressionsWork(work('A note for a reader.'))
  for (const track of set.tracks) assert.equal(track.info, 'A note for a reader.', `${track.id}: the head's hover words carry it`)
  assert.equal(await set.actions.trackInfo.read('expression:expression:a:visual'), 'A note for a reader.')
  await set.actions.trackInfo.run('expression:expression:a:audio', '')
  assert.deepEqual(sent, [{operation: 'expression-description', description: ''}], 'an empty note is a real value, written as it is')
  // The track's menu: Edit info text asks where the track stands and writes the answer, its way back recorded.
  const asked = [], presses = []
  const context = {view: 'session', binding: null, press: (key, what, run) => { presses.push([key, what]); return run() }, rename: () => {},
    record: () => {}, ask: (target, field, done) => { asked.push(field); done('Rewritten.') }}
  const item = acts.objectMenu({kind: 'track', id: 'expression:expression:a:visual', name: 'Dawn: visual'}, set, context).find(entry => entry.id === 'info')
  assert.ok(item && !item.disabled, 'Edit info text stands on the Expression\'s track')
  item.onSelect(); await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(asked, [{label: 'Info text of Dawn: visual', value: 'A note for a reader.'}])
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(sent.at(-1), {operation: 'expression-description', description: 'Rewritten.'})
  // Unread, it is never offered as empty (which would write the note away): the menu says what it waits for.
  const unread = projectExpressionsWork(work(undefined))
  assert.equal(unread.actions.trackInfo, undefined)
  assert.equal(unread.tracks[0].info, undefined)
  const waiting = acts.objectMenu({kind: 'track', id: 'expression:expression:a:visual', name: 'Dawn: visual'}, unread, context).find(entry => entry.id === 'info')
  assert.ok(waiting.disabled); assert.match(waiting.why, /waits for the Expression's description in the tracks' reading/)
})
