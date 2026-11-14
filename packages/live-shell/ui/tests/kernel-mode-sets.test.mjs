import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// Each mode's Set in the kernel, as the window holds it and draws it (O-I #1004; docs/architecture/world-shell.md §9.2 layer 4): the store
// that asks the kernel for a mode's Set by `set_subscribe` and asks again on each newer `set_changed` (owners/modeSets.ts), and the one
// projection every mode's Set is drawn through (frame/tracks/kernelSet.ts), which knows no mode.
//
// Channels (each claim below is carried by exactly one):
// - FIXTURE: Sets in the shape the kernel answers `set_subscribe` with (kernel mode_set.rs `ModeSet`, oi.mode-set/v1;
//   tests/support/modeSetFixture.mjs); the Set's content is the kernel's, built from the World Model's slices and tested there.
// - SCRIPTED: a send that answers the store's asks as the kernel would, recording each; a runner that records each Action an act hands it.
// No owner, no kernel and no computer-use pass here.
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

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}, documentElement: {}}
const sets = await import('../src/owners/modeSets.ts')
const {kernelSetTracks, attendedOf} = await import('../src/frame/tracks/kernelSet.ts')
const {modeSetOf, setTrack, setClip, setAnswerOf} = await import('./support/modeSetFixture.mjs')

const bridge = {kind: 'bridge', url: 'http://kernel.test'}
const changed = (mode, version) => ({event: 'set_changed', mode, version})

// ---------------------------------------------------------------------------------------------------------------- the store

test('a set_changed notice is read only as the contract says it: a known mode at a version of at least 1', () => {
  assert.deepEqual(sets.setChangedOf(changed('factory', 3)), {mode: 'factory', version: 3})
  for (const mode of ['central', 'expressions', 'techne', 'live']) assert.equal(sets.setChangedOf(changed(mode, 1))?.mode, mode)
  assert.equal(sets.setChangedOf(changed('base', 1)), null, 'the frame\'s mode word is not a Set\'s')
  assert.equal(sets.setChangedOf(changed('factory', 0)), null)
  assert.equal(sets.setChangedOf(changed('factory', 1.5)), null)
  assert.equal(sets.setChangedOf({event: 'model_changed', slice: 'factory', version: 2}), null, 'another notice is not a Set\'s')
})

test('an answer is a Set only when the kernel says so: anything else is the words for why there is none, never an empty Set', () => {
  const answer = setAnswerOf('central', modeSetOf(), 4)
  assert.deepEqual(sets.modeSetOf({result: 'mode_set', data: answer.data}, undefined, 'central'), {state: 'held', answer: answer.data})
  assert.deepEqual(sets.modeSetOf(null, 'The kernel carrier is unavailable', 'central'), {state: 'unavailable', reason: 'The kernel carrier is unavailable'})
  assert.equal(sets.modeSetOf({result: 'model_reading', data: {}}, undefined, 'central').reason, 'The kernel answered model_reading, not central\'s Set.')
  assert.equal(sets.modeSetOf({result: 'mode_set', data: {...answer.data, mode: 'factory'}}, undefined, 'central').reason, 'The kernel\'s answer for central\'s Set is not a Set.')
  assert.equal(sets.modeSetOf({result: 'mode_set', data: {...answer.data, schema: 'oi.mode-set/v0'}}, undefined, 'central').state, 'unavailable')
})

/** A send scripted as the kernel answers `set_subscribe`: each ask recorded, answered from the version the test holds. */
function scriptedSend() {
  const asked = []
  const kernel = {version: 1, refuse: null, asked, pending: []}
  kernel.send = (transport, mode) => {
    asked.push(mode)
    return new Promise(resolve => kernel.pending.push(() => resolve(kernel.refuse ? {outcome: null, error: kernel.refuse}
      : {outcome: setAnswerOf(mode, modeSetOf({owner: `${mode} at ${kernel.version}`}), kernel.version)})))
  }
  kernel.answer = async () => { while (kernel.pending.length) kernel.pending.shift()(); await new Promise(resolve => setTimeout(resolve, 0)) }
  return kernel
}
const writes = () => {
  const listeners = []
  return {onWrite: listener => { listeners.push(listener); return () => {} }, wrote: () => listeners.forEach(listener => listener())}
}

test('the store asks the kernel once for a Set, shares the ask, and holds the answer at its version', async () => {
  const kernel = scriptedSend(), store = sets.createModeSetStore(kernel.send, writes().onWrite)
  assert.deepEqual(store.held(bridge, 'factory'), {state: 'reading'})
  const first = store.read(bridge, 'factory'), second = store.read(bridge, 'factory')
  await kernel.answer()
  assert.deepEqual(kernel.asked, ['factory'], 'two readers, one ask')
  assert.equal((await first).answer.version, 1)
  assert.equal(await second, await first)
  await store.read(bridge, 'factory')
  assert.deepEqual(kernel.asked, ['factory'], 'a current Set is not asked again')
  assert.equal(store.held(bridge, 'central').state, 'reading', 'each mode its own Set')
  const down = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
  assert.deepEqual(store.held(down, 'factory'), {state: 'unavailable', reason: down.reason}, 'no carrier: unread from the first look, never "arriving"')
  const heard = []
  store.listen(down, 'factory', () => heard.push('told'))
  assert.equal(await store.read(down, 'factory'), store.held(down, 'factory'), 'the same words, held as they were')
  assert.deepEqual(kernel.asked, ['factory'], 'no carrier: nothing is sent')
  assert.deepEqual(heard, [], 'and nothing changed to tell')
})

test('a newer set_changed asks again for a Set someone listens to; an older or equal one, or one nobody hears, does not', async () => {
  const kernel = scriptedSend(), store = sets.createModeSetStore(kernel.send, writes().onWrite)
  let heard = 0
  const stop = store.listen(bridge, 'factory', () => { heard += 1 })
  await kernel.answer()
  assert.equal(store.held(bridge, 'factory').answer.version, 1)
  store.receive([changed('factory', 1), changed('central', 9)])
  assert.deepEqual(kernel.asked, ['factory'], 'the version held, and a Set nobody here holds')
  kernel.version = 2
  store.receive([changed('factory', 2)])
  await kernel.answer()
  assert.deepEqual(kernel.asked, ['factory', 'factory'])
  assert.equal(store.held(bridge, 'factory').answer.version, 2)
  assert.ok(heard >= 2, 'each new reading is told')
  stop()
  kernel.version = 3
  store.receive([changed('factory', 3)])
  await kernel.answer()
  assert.deepEqual(kernel.asked, ['factory', 'factory'], 'no listener: the newer version waits for the next reader')
  assert.equal((await (async () => { const reading = store.read(bridge, 'factory'); await kernel.answer(); return reading })()).answer.version, 3)
})

test('an answer older than the one held never replaces it, and a notice that came during an ask is asked once more', async () => {
  const kernel = scriptedSend(), store = sets.createModeSetStore(kernel.send, writes().onWrite)
  store.listen(bridge, 'live', () => {})
  kernel.version = 5
  await kernel.answer()
  assert.equal(store.held(bridge, 'live').answer.version, 5)
  // A write this window completed: asked again; the kernel answers an older version (two asks crossing), and the newer stands.
  const {onWrite, wrote} = writes()
  const crossing = sets.createModeSetStore(kernel.send, onWrite)
  crossing.listen(bridge, 'live', () => {})
  await kernel.answer()
  wrote()
  kernel.version = 4
  await kernel.answer()
  assert.equal(crossing.held(bridge, 'live').answer.version, 5, 'never over a newer one already held')
  // A notice while an ask is in flight: that ask answers older than the notice, so the Set is asked once more.
  wrote()
  const before = kernel.asked.length
  crossing.receive([changed('live', 7)])
  assert.equal(kernel.asked.length, before, 'the ask in flight is shared, not doubled')
  kernel.version = 6
  await kernel.answer()
  assert.equal(crossing.held(bridge, 'live').answer.version, 6)
  assert.equal(kernel.asked.length, before + 1, 'held older than the notice: asked once more')
  kernel.version = 7
  await kernel.answer()
  assert.equal(crossing.held(bridge, 'live').answer.version, 7)
  await kernel.answer()
  assert.equal(kernel.asked.length, before + 1, 'current now: no further ask')
})

test('a refusal is held as the kernel\'s words and waits for the next notice; a write this window made asks again', async () => {
  const kernel = scriptedSend(), {onWrite, wrote} = writes(), store = sets.createModeSetStore(kernel.send, onWrite)
  kernel.refuse = 'The World Model is not started in this kernel'
  store.listen(bridge, 'central', () => {})
  await kernel.answer()
  assert.deepEqual(store.held(bridge, 'central'), {state: 'unavailable', reason: 'The World Model is not started in this kernel'})
  assert.equal(kernel.asked.length, 1, 'a refusal is not asked again of itself')
  kernel.refuse = null
  wrote()
  await kernel.answer()
  assert.equal(store.held(bridge, 'central').state, 'held', 'the write moved what the kernel holds: the Set is asked again')
})

// ---------------------------------------------------------------------------------------------------------------- the projection

test('a Set\'s instants lie on its ruler: the minutes of one civil day, or the seconds from its origin to now', () => {
  const day = kernelSetTracks(modeSetOf({ruler: {kind: 'day', unit: 'minutes', date: '2026-11-13'}, rows: [{id: 'central:row:a', name: 'Morning'}],
    tracks: [setTrack('w', 'World')],
    clips: [setClip('p', 'w', 'central:row:a', 'Page', {at: {start_unix_ms: Date.UTC(2026, 10, 13, 9, 30), end_unix_ms: Date.UTC(2026, 10, 13, 10)}}),
      setClip('q', 'w', 'central:row:a', 'Yesterday\'s', {at: {start_unix_ms: Date.UTC(2026, 10, 12, 23)}})]}), {nowMs: Date.UTC(2026, 10, 13, 12)})
  assert.deepEqual(day.columns, [{id: 'central:row:a', name: 'Morning'}])
  assert.deepEqual(day.clips[0].at, {start: 570, end: 600})
  assert.equal(day.clips[1].at, undefined, 'an instant of another day has no place on this one')
  assert.equal(day.ruler.end, 1440)
  assert.equal(day.ruler.label(570), '11-13 09:30')
  const origin = Date.UTC(2026, 10, 13, 9), now = origin + 1_800_000
  const clock = kernelSetTracks(modeSetOf({ruler: {kind: 'clock', unit: 'seconds', origin_unix_ms: origin}, tracks: [setTrack('s', 'Session')],
    clips: [setClip('s#task/1', 's', 'batch:1', 'Task', {status: 'running', at: {start_unix_ms: origin + 600_000}})]}), {nowMs: now})
  assert.deepEqual(clock.clips[0].at, {start: 600}, 'a running clip keeps its open edge')
  assert.deepEqual([clock.ruler.end, clock.ruler.now], [1800, 1800], 'the ruler draws no future')
  const empty = kernelSetTracks(modeSetOf({ruler: {kind: 'clock', unit: 'seconds'}}), {nowMs: now})
  assert.equal(empty.ruler.end, 3600, 'a Set with no instant yet stands on the hour ending now')
  assert.equal(kernelSetTracks(modeSetOf(), {nowMs: now}).ruler, undefined, 'no ruler: its rows lie end to end')
})

test('a Set\'s tracks keep what the kernel says of them: why one holds nothing, its place, the Main and return tracks, the arm on its own', () => {
  const set = kernelSetTracks(modeSetOf({
    tracks: [setTrack('a', 'Agent sessions', {kind: 'agent sessions', absent: 'The Agent sessions are unread: AIKit is not installed'}),
      setTrack('g', 'Port', {kind: 'group', color: '#79b6ce'}), setTrack('s', 'lead', {kind: 'session', depth: 1, parent: 'g', works_in: 'env-1'}),
      setTrack('day', 'Today', {main: true}), setTrack('workcell:env-1', 'env-1', {returns: true, read_only: true})],
    main: {name: 'Main', chain: ['Gateways', 'Ledger']},
    acts: {arm: {action: 'shell.setWriteArm', takes: 'on', words: 'shell.setWriteArm — the shell\'s one write arm'}}}), {nowMs: 0, armOn: true})
  assert.equal(set.tracks[0].kind, 'agent sessions · The Agent sessions are unread: AIKit is not installed', 'a track that holds nothing says why')
  assert.deepEqual([set.tracks[1].color, set.tracks[2].depth, set.tracks[2].parentId], ['#79b6ce', 1, 'g'])
  assert.deepEqual(set.tracks[2].mix, {works: 'env-1', arm: true})
  assert.equal(set.tracks[3].main, true)
  assert.equal(set.tracks[3].mix, undefined, 'the Main track wears no arm of its own')
  assert.deepEqual([set.tracks[4].returns, set.tracks[4].readOnly, set.tracks[4].mix], [true, true, undefined])
  assert.deepEqual(set.main, {name: 'Main', chain: ['Gateways', 'Ledger']})
  assert.equal(set.actions.mixer.arm.op, 'shell.setWriteArm — the shell\'s one write arm')
  assert.equal(kernelSetTracks(modeSetOf({tracks: [setTrack('s', 's')]}), {nowMs: 0, armOn: true}).tracks[0].mix, undefined, 'no arm in the Set, none drawn')
})

test('each act runs its Action through the runner and answers in the Set\'s words; a moved revision, a refusal and no carrier say so', async () => {
  const ran = []
  let answer = {outcome: 'named'}
  const runner = {act: async (action, input, project) => { ran.push([action, input, project]); if (answer instanceof Error) throw answer; return answer },
    shell: async (action, value) => { ran.push([action, value]); return {ok: true, note: `${action} ${value}`} }}
  const rename = {action: 'central.world.name', input: {project: 'O-I', expected_revision: 'm-1'}, takes: 'name', project: 'O-I', words: 'Central\'s central.world.name: the world\'s own name'}
  const set = modeSetOf({tracks: [setTrack('w', 'O-I', {acts: {renameTrack: rename}})], acts: {arm: {action: 'shell.setWriteArm', takes: 'on', words: 'the write arm'}}})
  const a = kernelSetTracks(set, {nowMs: 0, runner}).actions
  assert.deepEqual(await a.renameTrack.run('w', 'Lyre'), {ok: true, note: 'Central\'s central.world.name answered.'}, 'no `done` words: the act\'s own name answered')
  assert.deepEqual(ran.at(-1), ['central.world.name', {project: 'O-I', expected_revision: 'm-1', name: 'Lyre'}, 'O-I'])
  answer = {outcome: 'conflict'}
  assert.match((await a.renameTrack.run('w', 'Lyre')).error, /^central\.world\.name: what it writes moved since the Set was read; the Set is read again/)
  answer = new Error('Central refused: the manifest moved')
  assert.deepEqual(await a.renameTrack.run('w', 'Lyre'), {ok: false, error: 'Central refused: the manifest moved'})
  assert.deepEqual(await a.mixer.arm.run('w', true), {ok: true, note: 'shell.setWriteArm true'}, 'the shell\'s own namespace is its setter')
  const bare = kernelSetTracks(set, {nowMs: 0}).actions
  assert.match((await bare.renameTrack.run('w', 'Lyre')).error, /^central\.world\.name: no kernel carrier reaches this pane, so nothing was run\.$/)
  assert.match((await bare.mixer.arm.run('w', true)).error, /^shell\.setWriteArm: no shell setter reaches this pane\.$/)
  assert.equal(bare.owner, 'the mode\'s owner')
})

test('a constellation dropped where the Set cannot make its clip yet is taken and refused in the Set\'s words, never lost in silence', async () => {
  const set = kernelSetTracks(modeSetOf({owner: 'Factory', tracks: [setTrack('s', 's')], waiting: {'clip.make': 'the session\'s task of a constellation dropped on it (O-I #1006)'}}), {nowMs: 0})
  assert.ok(set.actions.makeClip, 'the drop is taken')
  assert.deepEqual(set.actions.waiting, {'clip.make': 'the session\'s task of a constellation dropped on it (O-I #1006)'})
  assert.equal(kernelSetTracks(modeSetOf({tracks: [setTrack('s', 's')]}), {nowMs: 0}).actions.makeClip, undefined, 'a Set that waits for no maker takes no drop')
})

test('what you attend to, by the Set\'s own tracks: a soloed group holds what is beneath it, a soloed track the tracks above it', () => {
  const tracks = [{id: 'g'}, {id: 'a', parent: 'g'}, {id: 'b', parent: 'g'}, {id: 'h'}, {id: 'c', parent: 'h'}]
  assert.equal(attendedOf(tracks, new Set()), null, 'nothing soloed: everything')
  assert.deepEqual([...attendedOf(tracks, new Set(['a']))].sort(), ['a', 'g'])
  assert.deepEqual([...attendedOf(tracks, new Set(['g']))].sort(), ['a', 'b', 'g'])
  assert.equal(attendedOf(tracks, new Set(['gone'])), null, 'a solo of nothing here: everything')
})
