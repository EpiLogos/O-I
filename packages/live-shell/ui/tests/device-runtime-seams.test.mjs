// The device runtime's seams, walked in Chromium by the suite (O-I #747 round 896, item 0.6): tests/device-runtime-seams.browser.mjs
// stood unrun after the pool it walked went (W1, 4a3258b93), and failed to bundle. It now walks the band that took the pool's
// place, and test-all runs it here: a design whose views throw, the Day's ↗ and its ⤢ on the chain, in its band and on the rail,
// the Agent's own Full act from its band and the rail, and Scope's Cancel. The walk's own receipt and captures go to a scratch
// folder; `npm run devices:seams` runs it alone.
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import test from 'node:test'

const ui = fileURLToPath(new URL('..', import.meta.url))

test('the device runtime\'s seams hold in a browser: a throwing design, the door\'s ↗, every ⤢ and Cancel', {timeout: 300_000}, async t => {
  const {playwright} = await import('./support/agentShellHarness.mjs')
  try { await (await playwright().chromium.launch()).close() } catch (error) {
    const why = `no Chromium to walk the seams in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return
  }
  const evidence = mkdtempSync(join(tmpdir(), 'device-runtime-seams-'))
  const walk = fileURLToPath(new URL('./device-runtime-seams.browser.mjs', import.meta.url))
  const run = await promisify(execFile)(process.execPath, [walk, '--evidence', evidence], {cwd: ui, maxBuffer: 16 << 20})
    .then(out => ({code: 0, ...out}), error => ({code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? String(error)}))
  assert.equal(run.code, 0, `the walk failed:\n${run.stdout}\n${run.stderr}`)
  assert.match(run.stdout, /\[device-runtime-seams\] observations: 10, faults: 0/)
  for (const seam of ['compact throws', 'Full throws', 'door\'s ↗', '⤢ on the chain', 'Day\'s ⤢ in its band', 'Day\'s ⤢ on the rail',
    'Agent\'s ⤢ in its band', 'Agent\'s ⤢ on the rail', 'Cancel on Scope', 'no uncaught page error']) {
    assert.ok(run.stdout.includes(seam), `the walk observed: ${seam}`)
  }
})
