// O-I #759, "Factory reads the artifacts a Return names, and the shell opens them". Manual §19.1 The Intent panel: "After the run
// returns, each condition carries its answer: met or not met with the evidence that shows it"; DLW.md:397-398 (Arrangement): "Under
// each thread run its messages, the files it touched, its terminal, the pages it read; click any of them and it opens beside you."
// The Factory clip lists, under the Intent panel's Return, every ref its task's returned attempts name, as Factory resolves it
// (`factory attempt artifacts`, factory.attempt-artifact-reading/v1, through the kernel's factory_owner `attempt-artifacts`, which adds
// where the Project's ground lies in Central's World). A resolved file opens through Central's own listing, a Central path through
// Central's resolver, each into the focused pane; a ref Factory cannot resolve stays named, with Factory's reason.
// Channels: the reading is the REAL Factory reading the kernel's route test replays (kernel/tests/fixtures/owner-routes/
// factory-attempt-artifacts-2026-10-28.json); SCRIPTED — the owner calls and the opener are recording ports, never the owners. Not a
// screen pass.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const factory = await import('../src/agent/clipBinding.ts')
const {loadClip} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')

const REAL = JSON.parse(await readFile(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/factory-attempt-artifacts-2026-10-28.json', import.meta.url), 'utf8'))
/** The kernel's answer: Factory's reading verbatim, and where its ground lies in Central's World. */
const answer = (ground = {state: 'placed', project: 'O-I', path: 'Work/O-I'}) =>
  ({contract: 'oi.factory-attempt-artifacts/v1', reading: {...REAL.reading, projectRoot: '/ground/Work/O-I'}, ground})
const FILE = 'central:source:control:root:docs/report.md'
const CENTRAL = 'central:path:/ground:docs/report.md'

const take = (extra = {}) => ({sessionRef: 'ses-214', attemptRef: 'attempt:z-old', runRef: REAL.reading.runRef, statePath: '/ground/Work/O-I/.factory/development-state.json',
  taskRef: 'task:t', unit: null, state: 'returned', startUnixMs: null, endUnixMs: null, summary: 'Readable test-only source report', receivingRef: null, ...extra})

test('every ref the Return names is listed once: a file opens through Central, the rest stay named with Factory\'s reason', () => {
  const files = factory.returnedFilesOf(answer())
  assert.equal(files.length, REAL.reading.artifacts.length, 'every ref Factory read, once')
  const file = files.find(item => item.ref === FILE)
  assert.deepEqual(file.opens, {via: 'listing', path: 'Work/O-I/docs/report.md'}, 'its path under Central\'s root: the ground\'s, then the file\'s')
  assert.equal(file.name, 'docs/report.md')
  assert.equal(file.why, null)
  assert.deepEqual(files.find(item => item.ref === CENTRAL).opens, {via: 'resolve', ref: CENTRAL}, 'Central\'s own path identity goes to Central\'s resolver')
  for (const row of REAL.reading.artifacts.filter(item => item.state === 'refused')) {
    const named = files.find(item => item.ref === row.ref)
    assert.equal(named.opens, null, row.ref)
    assert.equal(named.why, row.reason, `${row.ref}: Factory's reason, verbatim`)
    assert.equal(named.name, row.ref, 'a ref that does not open is named as it is')
  }
  // Central's own root is the ground itself.
  assert.deepEqual(factory.returnedFilesOf(answer({state: 'placed', project: null, path: ''})).find(item => item.ref === FILE).opens,
    {via: 'listing', path: 'docs/report.md'})
  // A ground Central does not disclose: the file Factory resolved does not open, and says why.
  const outside = factory.returnedFilesOf(answer({state: 'outside', why: 'Factory\'s Project root /x is not a root Central discloses'})).find(item => item.ref === FILE)
  assert.equal(outside.opens, null)
  assert.match(outside.why, /not a root Central discloses/)
})

test('a resolved file opens from Central\'s listing of its folder; a Central path from Central\'s resolver; a refused ref says why', async () => {
  const files = factory.returnedFilesOf(answer())
  const asked = [], opened = []
  const location = path => ({schema: 'central.path-ref/v1', ref: `central:path:/ground:${path}`, root: '/ground', path})
  const ports = {
    list: async path => { asked.push(['list', path]); return {location: location(path), entries: [
      {name: 'notes.md', location: location(`${path}/notes.md`), kind: 'file', byte_len: 1, retrieval_allowed: true},
      {name: 'report.md', location: location(`${path}/report.md`), kind: 'file', byte_len: 9, retrieval_allowed: true}]} },
    resolve: async ref => { asked.push(['resolve', ref]); return location('docs/report.md') },
    open: async entry => { opened.push(entry.location.ref) },
  }
  await factory.openReturnedFile(files.find(item => item.ref === FILE), ports)
  assert.deepEqual(asked, [['list', 'Work/O-I/docs']], 'one listing of the file\'s folder, by Central')
  assert.deepEqual(opened, ['central:path:/ground:Work/O-I/docs/report.md'], 'the location Central minted, never one built here')
  await factory.openReturnedFile(files.find(item => item.ref === CENTRAL), ports)
  assert.deepEqual(asked.at(-1), ['resolve', CENTRAL])
  assert.deepEqual(opened.at(-1), 'central:path:/ground:docs/report.md')
  const refused = files.find(item => item.ref === 'artifact:test')
  await assert.rejects(factory.openReturnedFile(refused, ports), error => error.message.includes(refused.why))
  // A file Central's listing does not hold does not open, and nothing is opened.
  const before = opened.length
  const gone = {...files.find(item => item.ref === FILE), opens: {via: 'listing', path: 'Work/O-I/docs/gone.md'}}
  await assert.rejects(factory.openReturnedFile(gone, ports), /holds no gone\.md/)
  assert.equal(opened.length, before)
})

test('the task\'s Return is read from its returned attempts only, and a refused read stays named in Factory\'s words', async () => {
  const asked = []
  const call = async item => {
    asked.push(item.attemptRef)
    if (item.attemptRef === 'attempt:moved') throw new Error('factory: attempt attempt:moved is not retained in run:x')
    return answer()
  }
  const reading = await factory.readReturnedFiles(call, [take(), take({attemptRef: 'attempt:running', state: 'running'}), take({attemptRef: 'attempt:moved'})])
  assert.deepEqual(asked, ['attempt:z-old', 'attempt:moved'], 'only a returned attempt has a Return to read')
  assert.equal(reading.state, 'read')
  const moved = reading.files.find(item => item.attemptRef === 'attempt:moved')
  assert.equal(moved.opens, null)
  assert.match(moved.why, /is not retained in run:x/)
  assert.deepEqual(await factory.readReturnedFiles(call, [take({state: 'running'})]), {state: 'read', files: []}, 'nothing returned yet')
})

const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true,
  spaceRef: 'space:lead', spaceLabel: null, depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: true,
  budget: {used: 3, max: 12}, disclosure: null, tasks: [
    {n: 1, title: 'correlate occurrences', state: 'done', startUnixMs: 1, lastActivityUnixMs: 2, softStop: false, disclosure: null},
    {n: 2, title: 'second', state: 'queued', startUnixMs: null, lastActivityUnixMs: null, softStop: false, disclosure: null}]}

test('the clip carries the rows on `returned`, opens one on `open`, and the design draws them under Return', async () => {
  resetViewHolds()
  const ref = `${trackKey(track)}#task/1`
  const files = factory.returnedFilesOf(answer())
  const opened = []
  const binding = factory.factoryClipBinding({ref, tracks: [track], events: [], returned: {reading: {state: 'read', files}, open: async file => { opened.push(file.ref) }}})
  const rows = JSON.parse(binding.values.returned)
  assert.equal(rows.length, files.length)
  assert.deepEqual(rows.find(row => row.id === FILE), {id: FILE, name: 'docs/report.md', role: 'artifact', opens: true})
  assert.equal(rows.find(row => row.id === 'artifact:test').why, files.find(item => item.ref === 'artifact:test').why)
  assert.ok(binding.writes('open'))
  await binding.write([{key: 'open', value: FILE}])
  assert.deepEqual(opened, [FILE])
  await assert.rejects(binding.write([{key: 'open', value: 'artifact:unnamed'}]), /names no artifact:unnamed/)
  // The design: the Intent panel lists them under Return, each that opens lit, each refused dark with Factory's reason.
  const design = await loadClip('factory')
  const intent = design.panel.find(tab => tab.id === 'intent')
  const draw = page => renderToStaticMarkup(createElement(intent.draw, {v: {...binding.values, 'returned.page': page}, set: noop, standing: binding.standing}))
  const first = draw(0)
  assert.match(first, /Returned/)
  assert.match(first, /artifact:test/)
  assert.match(first, /a record, with no file of its own/, 'a ref that does not open says Factory\'s reason')
  assert.match(draw(1), /docs\/report\.md/, 'the resolved file, by its path in the ground')
  // Another task on the track: the session's owner binds one task, so what its attempts returned is the first task's.
  const second = factory.factoryClipBinding({ref: `${trackKey(track)}#task/2`, tracks: [track], events: [], returned: {reading: {state: 'read', files}, open: async () => {}}})
  assert.equal('returned' in second.values, false)
  assert.match(factory.factoryWiring({sessionRef: 'ses-214', n: 2}, null, null).absent.returned, /first task's/)
  // Nothing read here: absent, with why; the open is refused in the same words.
  const unread = factory.factoryWiring({sessionRef: 'ses-214', n: 1}, null, null)
  assert.ok(unread.absent.returned)
  assert.equal(unread.refused.open, unread.absent.returned)
})
