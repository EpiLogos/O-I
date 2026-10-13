// The WebStorage suites: the tests that exercise real durable Node WebStorage
// (device custody, input recovery, workspace continuity). Each asserts it runs
// with `--localstorage-file` on an OWNED OS temporary file, so a plain
// `node --test tests/*.test.mjs` reports them red by design. This runs each in
// its own fresh temporary directory, with the flags it requires, and removes
// the directory afterwards.
//
//   node scripts/test-webstorage.mjs            # all of them
//   node scripts/test-webstorage.mjs <file>...  # a subset (paths under tests/)

import {spawnSync} from 'node:child_process'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ui = join(dirname(fileURLToPath(import.meta.url)), '..')
export const WEBSTORAGE_SUITES = [
  'continuity-storage', 'native-bar-strip', 'native-colour-field', 'native-entity-sound',
  'native-force-gesture', 'native-glyph-input-custody', 'native-input-custody',
  'native-input-recovery', 'native-morph-drive',
].map(name => `tests/${name}.test.mjs`)

const suites = process.argv.slice(2).length ? process.argv.slice(2) : WEBSTORAGE_SUITES
let failed = 0
for (const suite of suites) {
  const dir = mkdtempSync(join(tmpdir(), 'oi-webstorage-'))
  try {
    const run = spawnSync(process.execPath, ['--experimental-webstorage', `--localstorage-file=${join(dir, 'storage.sqlite')}`, '--test', suite],
      {cwd: ui, encoding: 'utf8'})
    const counts = (run.stdout.match(/^ℹ (pass|fail) \d+$/gm) ?? []).join(' · ')
    console.log(`${run.status === 0 ? 'ok  ' : 'FAIL'} ${suite} — ${counts}`)
    if (run.status !== 0) { failed++; process.stdout.write(run.stdout.split('\n').filter(l => /✖|Error|assert/i.test(l)).slice(0, 12).join('\n') + '\n') }
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}
process.exit(failed ? 1 : 0)
