import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// T-RECOVERY-FOR-OPENED-WORKS, the shell side. The panel's mount options sit inside a React effect, so they are read from the
// source text (code-reading). What selection does is proven in the boundary's own suite
// (packages/expressions-boundary/tests/opened-work-recovery.test.mjs).
const panel = await readFile(new URL('../src/panels/expressions.tsx', import.meta.url), 'utf8')
const mount = panel.slice(panel.indexOf('mounted = mountExpressionsApplication('))
const options = mount.slice(0, mount.indexOf('isPresented: presented'))

test('the panel lets the host select the address of every work it opens, configured saved works passed first', () => {
  assert.ok(mount.length < panel.length && options.length, 'the panel mounts the one application')
  assert.match(options, /recoveryBindings: continued\?\.works, initialRecoveryBinding: initial,/)
  assert.match(options, /selectOpenedWorks: true,/)
})

test('a book whose last work is no configured saved work still mounts: that work gets the selected address', () => {
  assert.doesNotMatch(panel, /has no configured native recovery address/)
})

// O-I #763: the panel survives a failed first listing. Before, the boot awaited the owner's `list` and a refusal threw out of
// the mount, so the frame never mounted and nothing asked again. The listing function is the panel's own, run unchanged
// (scripted, with a scripted list and clock); where the boot calls it is read from the source (code-reading).
const ts = (await import(new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href)).default
const source = ts.createSourceFile('expressions.tsx', panel, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const declared = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'listWorksUntilAnswered')
const listWorksUntilAnswered = declared && new Function(`${ts.transpileModule(declared.getText(source).replace(/^export /, ''),
  {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText}\nreturn listWorksUntilAnswered;`)()

test('a failed listing is named and asked again, 1 s and then twice as long each time up to 30 s, until the owner answers', async () => {
  assert.equal(typeof listWorksUntilAnswered, 'function', 'the panel lists the works through listWorksUntilAnswered')
  const works = [{expression_ref: 'expression:first', title: 'First', revision: 1}]
  let asked = 0
  const waits = [], named = []
  const list = async () => {asked++; if (asked < 8) throw Error(`owner busy ${asked}`); return works}
  const answer = await listWorksUntilAnswered(list, {current: () => true, wait: async ms => {waits.push(ms)}, failed: (cause, ms) => named.push([cause.message, ms])})
  assert.deepEqual(answer, works)
  assert.equal(asked, 8)
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 16000, 30000, 30000])
  assert.deepEqual(named.map(([message]) => message), ['owner busy 1', 'owner busy 2', 'owner busy 3', 'owner busy 4', 'owner busy 5', 'owner busy 6', 'owner busy 7'])
  // The boot's own failure is passed in: the next ask waits first, so a failure is never asked again at once.
  const after = [], order = []
  assert.deepEqual(await listWorksUntilAnswered(async () => {order.push('list'); return works}, {current: () => true,
    wait: async ms => {order.push(`wait ${ms}`)}, failed: (cause, ms) => after.push([cause.message, ms])}, {cause: Error('boot refused')}), works)
  assert.deepEqual(order, ['wait 1000', 'list'])
  assert.deepEqual(after, [['boot refused', 1000]])
  // A retired access stops asking: nothing is listed for it and nothing more is named.
  let live = true, calls = 0
  const stopped = await listWorksUntilAnswered(async () => {calls++; throw Error('down')}, {current: () => live,
    wait: async () => {live = false}, failed: () => {}})
  assert.equal(stopped, null)
  assert.equal(calls, 1)
})

test('code-reading: a failed boot listing leaves the frame to mount on no work; the listing is asked again and its first work opens', () => {
  const boot = panel.slice(panel.indexOf('let listedFor'), panel.indexOf('mounted = mountExpressionsApplication('))
  assert.doesNotMatch(boot, /const existing = knownRef \|\| initial \? \[\] : await enumerate\(\)/, 'the boot no longer throws out of the mount on a refused list')
  assert.match(boot, /enumerate\(\)\.then\(works => \(\{works\}\), cause => \(\{cause\}\)\)/, 'the boot listing is held as its answer or its refusal')
  const after = panel.slice(panel.indexOf('rebind()\n      if ('), panel.indexOf('flushPendingOpen()\n      // The boot deep link'))
  assert.match(after, /listWorksUntilAnswered\(enumerate, \{/, 'after mounting, the works are listed until the owner answers')
  assert.doesNotMatch(panel, /if \(knownRef \|\| initial\) void enumerate\(\)\.catch\(fail\)/, 'a known work\'s listing is asked again too')
  assert.match(after, /openNative\(first\)/, 'a late answer opens the first work, as a boot that listed would have')
})
