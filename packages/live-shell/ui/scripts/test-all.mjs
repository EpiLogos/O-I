#!/usr/bin/env node
// The candidate shell's whole Node suite, as CI runs it: every tests/*.test.mjs
// in one `node --test` run (TypeScript sources loaded with
// --experimental-strip-types), then the WebStorage suites through their own
// runner, which gives each a fresh owned storage file.
//
// Left out, by name and for a reason:
//   - the WebStorage suites (listed in scripts/test-webstorage.mjs): they run
//     second, each with --localstorage-file;
//   - tests/audit-l6-live-replay.test.mjs: an audit replay that needs the live
//     native stack (walk bridge and Vite on fixed ports), not a unit test.
//
//   node scripts/test-all.mjs

import {spawnSync} from 'node:child_process'
import {readFileSync, readdirSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const ui = join(dirname(fileURLToPath(import.meta.url)), '..')
const webstorageSource = readFileSync(join(ui, 'scripts/test-webstorage.mjs'), 'utf8')
const listed = webstorageSource.match(/WEBSTORAGE_SUITES = \[([\s\S]*?)\]/)
if (!listed) throw new Error('scripts/test-webstorage.mjs no longer declares WEBSTORAGE_SUITES')
const webstorage = new Set([...listed[1].matchAll(/'([^']+)'/g)].map(match => `${match[1]}.test.mjs`))
const needsLiveStack = new Set(['audit-l6-live-replay.test.mjs'])

const files = readdirSync(join(ui, 'tests'))
  .filter(name => name.endsWith('.test.mjs') && !webstorage.has(name) && !needsLiveStack.has(name))
  .sort()
  .map(name => join('tests', name))

const unit = spawnSync(process.execPath, ['--experimental-strip-types', '--test', '--test-concurrency=4', ...files],
  {cwd: ui, stdio: 'inherit'})
const storage = spawnSync(process.execPath, [join(ui, 'scripts/test-webstorage.mjs')], {cwd: ui, stdio: 'inherit'})
process.exit(unit.status === 0 && storage.status === 0 ? 0 : 1)
