import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// Lane W3: the kernel tells the shell when an owner write it carried moved the owner's state. A NOW write, a Day write, a
// receiving act or a Factory Run act that finished records a receipt (kernel/src/owner_write.rs; events.rs `NowChanged`,
// `DayChanged`, `ReceivingChanged`, `FactoryRunChanged`), and the shell's readers of those owners read again on it — with no
// floor involved. The NOW receipt here is the kernel's own serialisation: the kernel test
// owner_write::tests::a_now_write_records_its_receipt_and_retires_the_temporal_answer asserts it equals this fixture.
// Channel: scripted (the poll and the Day observer driven over stubbed reads); the hooks' wiring in the live window is
// UNVERIFIED on screen.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (/[.]html([?].*)?$/.test(u)) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

// Reads that remember: every read-only kernel op the engine and the views make is answered from one held answer per op and
// transport (owners/ownerCall.ts installs the holder behind kernelRead), asked of the kernel once however many readers want it,
// retired by a completed write or the kernel's notice, and never holding a refusal. The kernel is a stubbed bridge (fetch) that
// counts the ops it is asked; the census is that count.
const {listFiles} = await import('../../../../desktop/cradle/src/files/client.ts')
const {kernelOp, kernelRead} = await import('../../../../desktop/cradle/src/kernel/bridge.ts')
const {heldCall, HELD_OP_MAX_AGE_MS, opKey} = await import('../src/owners/ownerCall.ts')
const {windowReadingsChanged} = await import('../src/owners/readingsChanged.ts')
const {ownerReadings} = await import('../src/owners/ownerReading.ts')

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }
function kernel(url) {
  const asked = []
  let refuse = null
  const original = globalThis.fetch
  globalThis.fetch = async (target, init) => {
    if (!String(target).startsWith(url)) return original(target, init)
    const op = JSON.parse(init.body)
    asked.push(op)
    await new Promise(resolve => setImmediate(resolve))
    if (refuse && refuse(op)) return {json: async () => ({ok: false, error: 'the owner refused'})}
    const outcome = op.op === 'files_list' ? {result: 'directory_read', directory: {path: op.path, entries: []}}
      : op.op === 'git_repository_read' ? {result: 'git_repository_reading', document: {repo_root: '/r'}}
      : op.op === 'invoke_action' ? {result: 'dispatch', outcome: 'done'} : {result: 'workcell_status_reading', data: {n: asked.length}}
    return {json: async () => ({ok: true, outcome})}
  }
  return {asked, refuseWhen: fn => { refuse = fn }, count: name => asked.filter(op => op.op === name).length}
}

test('a start-up render of many views asks the owner once per distinct read, not once per view', async () => {
  const transport = {kind: 'bridge', url: 'http://kernel.test/startup'}
  const k = kernel(transport.url)
  // The rail's Diff, the agent dock's Diff and Files, the chain's Git and the hygiene device each read the repository; the rail's
  // Wiki, the browser's Days and the tracks each list folders — all in the first render.
  await Promise.all([
    ...Array.from({length: 5}, () => kernelRead(transport, {op: 'git_repository_read', project: 'O-I'})),
    ...Array.from({length: 4}, () => listFiles(transport, 'Control/agents/wiki')),
    listFiles(transport, 'Control/user/day'),
    ...Array.from({length: 3}, () => kernelRead(transport, {op: 'workcell_status_read'})),
  ])
  assert.equal(k.count('git_repository_read'), 1)
  assert.equal(k.count('files_list'), 2, 'one per distinct folder')
  assert.equal(k.count('workcell_status_read'), 1)
  assert.equal(k.asked.length, 4, 'ten reads, four owner asks')
  // Later readers are served by the standing answers.
  await listFiles(transport, 'Control/agents/wiki'); await kernelRead(transport, {op: 'git_repository_read', project: 'O-I'})
  assert.equal(k.asked.length, 4)
})

test('the kernel\'s notice, an explicit fresh read and a completed write each retire the held answer; a refusal is never held', async () => {
  const transport = {kind: 'bridge', url: 'http://kernel.test/retire'}
  const k = kernel(transport.url)
  const git = () => kernelRead(transport, {op: 'git_repository_read', project: 'O-I'})
  await git(); await git()
  assert.equal(k.count('git_repository_read'), 1)
  await kernelRead(transport, {op: 'git_repository_read', project: 'O-I'}, {fresh: true})
  assert.equal(k.count('git_repository_read'), 2, 'fresh asks the owner again')
  await git()
  assert.equal(k.count('git_repository_read'), 2, 'and replaces the held answer')
  await ownerReadings.moved(); await git()
  assert.equal(k.count('git_repository_read'), 3, 'the kernel\'s notice retires it')
  await kernelOp(transport, {op: 'invoke_action', invocation: {action: 'central.files.write', target_ref: 'x', input: {}}})
  await git()
  assert.equal(k.count('git_repository_read'), 4, 'a completed write retires it at once')
  await kernelOp(transport, {op: 'workcell_status_read'})
  await git()
  assert.equal(k.count('git_repository_read'), 4, 'a read retires nothing')
  k.refuseWhen(op => op.op === 'files_list')
  const refused = await listFiles(transport, 'a').catch(error => error.message)
  assert.match(refused, /the owner refused/)
  k.refuseWhen(() => false)
  await listFiles(transport, 'a')
  assert.equal(k.count('files_list'), 2, 'a refusal is asked again, not remembered')
})

test('an answer nothing could have retired is read again after the bounded age', async () => {
  const transport = {kind: 'bridge', url: 'http://kernel.test/aged'}
  const k = kernel(transport.url)
  let now = 1_000_000
  const op = {op: 'workcell_status_read'}
  await heldCall(transport, op, {now: () => now})
  await heldCall(transport, op, {now: () => now + HELD_OP_MAX_AGE_MS - 1})
  assert.equal(k.asked.length, 1)
  await heldCall(transport, op, {now: () => Date.now() + HELD_OP_MAX_AGE_MS + 1})
  assert.equal(k.asked.length, 2, 'past the bound with no notice, the owner is asked again')
  assert.ok(opKey(transport, op).includes('workcell_status_read'))
})

test('file contents held for the window are never kept across a relaunch', async () => {
  const transport = {kind: 'bridge', url: 'http://kernel.test/volatile'}
  kernel(transport.url)
  await listFiles(transport, 'Control/user')
  const entry = ownerReadings.entries().find(held => held.key.includes('Control/user'))
  assert.ok(entry, 'the listing is held')
})
