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
