#!/usr/bin/env node
// The shared engine's tests, as the candidate needs them. desktop/cradle/src is
// both the frozen legacy desktop and the engine the candidate imports (pane
// engine, workspace store, kernel client, knowledge, Technē …). Its suite under
// desktop/cradle/tests covers both. This runs only the tests that reach a file
// the candidate imports (candidate-reachable.mjs), so a legacy-only test never
// gates the replacement and an engine test the candidate relies on always does.
//
//   node scripts/test-engine.mjs           run them
//   node scripts/test-engine.mjs --list    print the selection and what each test reaches

import {spawnSync} from 'node:child_process'
import {readFileSync, readdirSync} from 'node:fs'
import {dirname, join, relative, resolve} from 'node:path'
import {reachable, repo} from './candidate-reachable.mjs'

const cradle = join(repo, 'desktop/cradle')
const tests = join(cradle, 'tests')
const product = reachable()

// A test reaches a file through any relative specifier into src/ — an import,
// a dynamic import, or a source read.
const SPECIFIER = /['"`](\.\.?\/[^'"`\s]*?src\/[^'"`\s]+?)['"`]/g
function reaches(file) {
  const hits = new Set()
  for (const [, specifier] of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
    const base = resolve(dirname(file), specifier)
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'), `${base}/index.ts`]) {
      if (product.has(candidate)) { hits.add(relative(repo, candidate)); break }
    }
  }
  return hits
}

const selected = readdirSync(tests)
  .filter(name => name.endsWith('.test.mjs'))
  .sort()
  .map(name => ({name, hits: reaches(join(tests, name))}))
  .filter(test => test.hits.size)

if (process.argv.includes('--list')) {
  for (const test of selected) console.log(`${test.name}  ${[...test.hits].join(' ')}`)
  console.log(`${selected.length} engine tests`)
  process.exit(0)
}

const run = spawnSync(process.execPath,
  ['--experimental-strip-types', '--import', './tests/ts-register.mjs', '--test', '--test-concurrency=4',
    ...selected.map(test => join('tests', test.name))],
  {cwd: cradle, stdio: 'inherit'})
process.exit(run.status ?? 1)
