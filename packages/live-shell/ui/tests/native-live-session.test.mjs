import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production sources in memory, same loader as the sibling native tests: .ts/.tsx
// is transpiled, .css is a non-executing stub. The bar model and its controls are
// driven with a fake clock, a fake frame and a fake owner; no server or engine is simulated.
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


const {createLiveSession, LIVE_INTERVAL_MS} = await import('../src/components/nativeBarSession.ts')

/** A fake clock: timers run only when the test advances time. */
function clockAt() {
  let t = 0, next = 1; const timers = new Map()
  return {now: () => t, after: (ms, run) => {const id = next++; timers.set(id, {at: t + ms, run}); return id}, clear: id => timers.delete(id),
    advance(ms) {t += ms; for (const [id, timer] of [...timers]) if (timer.at <= t) {timers.delete(id); timer.run()}}, pending: () => timers.size}
}
/** One gesture's observable world: the frame sees stage commands, the owner sees committed writes, in one ordered log. */
function world({automated = false, run = true, applyOk = true, holdOk = true} = {}) {
  const log = [], clock = clockAt(), state = {automated}
  const frame = async command => {log.push(['frame', command]); return command.action === 'hold' && !holdOk ? {ok: false, error: 'refused'} : {ok: true}}
  const apply = async value => {log.push(['owner', value]); return applyOk}
  const session = createLiveSession('field.timeScale', () => ({run: run ? frame : null, apply, automated: state.automated}), clock)
  return {log, clock, session, state}
}
const sets = log => log.filter(([who, c]) => who === 'frame' && c.action === 'set').map(([, c]) => c.value)
const shape = log => log.map(([who, c]) => who === 'owner' ? `owner:${c}` : `frame:${c.action}`)

test('a drag streams at about 20 Hz with a trailing flush, and writes no document', async () => {
  const {log, clock, session} = world()
  session.live(0.1)                       // first move goes out at once
  clock.advance(10); session.live(0.2); clock.advance(10); session.live(0.3)
  assert.deepEqual(sets(log), [0.1], 'moves inside one interval are held back')
  clock.advance(LIVE_INTERVAL_MS)         // the trailing timer sends only the latest
  assert.deepEqual(sets(log), [0.1, 0.3])
  assert.equal(log.filter(([who]) => who === 'owner').length, 0, 'streaming never writes the owner')
  assert.equal(clock.pending(), 0)
})

test('the committed value equals the last streamed value, in a fixed order: stream, write, release', async () => {
  const {log, clock, session} = world()
  session.live(0.2); clock.advance(LIVE_INTERVAL_MS); session.live(0.5); clock.advance(LIVE_INTERVAL_MS); session.live(0.9)
  const ok = await session.commit(0.9)
  assert.equal(ok, true)
  const streamed = sets(log), written = log.filter(([who]) => who === 'owner').map(([, v]) => v)
  assert.deepEqual(written, [0.9], 'exactly one committed write')
  assert.equal(streamed.at(-1), written[0], 'what the engine last showed is what the document receives')
  assert.deepEqual(shape(log).slice(-3), ['frame:set', 'owner:0.9', 'frame:release'], 'the override is released only after the write settles')
  assert.equal(clock.pending(), 0, 'no stray timer survives the gesture')
})

test('a commit whose value was never streamed still streams it first, so the last frame matches the write', async () => {
  const {log, session} = world()
  await session.commit(2)                 // typed value, no drag
  assert.deepEqual(shape(log), ['frame:set', 'owner:2', 'frame:release'])
  assert.equal(sets(log).at(-1), 2)
})

test('a commit repeating the last streamed value does not send it twice', async () => {
  const {log, clock, session} = world()
  session.live(0.4); clock.advance(5)
  await session.commit(0.4)
  assert.deepEqual(sets(log), [0.4])
})

test('Escape restores: a cancelled drag releases the override and writes nothing', async () => {
  const {log, clock, session} = world()
  session.live(0.7); clock.advance(5); session.live(0.8)
  session.cancel()
  await Promise.resolve()
  assert.equal(clock.pending(), 0, 'the trailing flush is cancelled')
  assert.deepEqual(shape(log), ['frame:set', 'frame:release'])
  assert.equal(log.some(([who]) => who === 'owner'), false)
  clock.advance(1000)
  assert.deepEqual(shape(log), ['frame:set', 'frame:release'], 'nothing is sent after the cancel')
})

test('a cancel before anything was streamed sends nothing', async () => {
  const {log, session} = world()
  session.cancel(); await Promise.resolve()
  assert.deepEqual(log, [])
})

test('a refused write releases the override and reports failure, so the engine returns to the document value', async () => {
  const {log, session} = world({applyOk: false})
  const ok = await session.commit(1.5)
  assert.equal(ok, false)
  assert.deepEqual(shape(log), ['frame:set', 'owner:1.5', 'frame:release'])
})

test('an automated parameter is held in the frame and never written as a document', async () => {
  const {log, clock, session} = world({automated: true})
  session.live(0.3); clock.advance(LIVE_INTERVAL_MS); session.live(0.6)
  const ok = await session.commit(0.6)
  assert.equal(ok, true)
  assert.equal(log.some(([who]) => who === 'owner'), false, 'manual takeover bypasses the shared-write path by design: the boundary admits none')
  const last = log.at(-1)[1]
  assert.deepEqual([last.command, last.action, last.target, last.value], ['live', 'hold', 'field.timeScale', 0.6])
  assert.equal(sets(log).at(-1), 0.6, 'the hold carries the last streamed value')
})

test('a refused hold reports failure and releases the override', async () => {
  const {log, session} = world({automated: true, holdOk: false})
  const ok = await session.commit(0.6)
  assert.equal(ok, false)
  assert.equal(log.some(([who]) => who === 'owner'), false)
  assert.deepEqual(shape(log), ['frame:set', 'frame:hold', 'frame:release'])
})

test('after a successful hold a later cancel releases nothing: the frame owns the value', async () => {
  const {log, session} = world({automated: true})
  await session.commit(0.6)
  const before = log.length
  session.cancel(); await Promise.resolve()
  assert.equal(log.length, before)
})

test('with no frame mounted, the committed write still goes through and nothing is streamed', async () => {
  const {log, session} = world({run: false})
  session.live(0.2)
  const ok = await session.commit(0.2)
  assert.equal(ok, true)
  assert.deepEqual(log, [['owner', 0.2]])
})

test('the session reads its dependencies at each call, so a re-render mid-drag does not strand the gesture', async () => {
  const {log, clock, session, state} = world()
  session.live(0.2); clock.advance(5)
  state.automated = true                  // automation switched on while dragging
  await session.commit(0.2)
  assert.equal(log.at(-1)[1].action, 'hold')
})
