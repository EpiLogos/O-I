#!/usr/bin/env node
// Runs `node --test` over named test files and refuses to pass on nothing.
//
// `node --test` exits 0 when a glob matches no file, and when one literal path
// in a list is missing (Node 24.21 and 22: the others run, the missing one is
// never mentioned again). A renamed file or a moved folder would leave its gate
// green while running nothing. Here every pattern or path must name at least
// one test file, or the run fails before any test starts.
//
//   node scripts/node-test.mjs [--node-flag[=value]...] [--no-skips] PATTERN...
//
// Patterns resolve against the working directory (globs expanded here, so no
// shell matters; node_modules is never searched). Flags before the first
// pattern go to node itself, `--flag=value` form only. --no-skips is for lanes
// that exist to run tests a plain run skips: a skipped test fails the run.

import {spawn} from 'node:child_process'
import {existsSync, globSync, statSync} from 'node:fs'

const args = process.argv.slice(2)
const flags = [], patterns = []
let noSkips = false
for (const arg of args) {
  if (arg === '--no-skips') noSkips = true
  else if (arg.startsWith('--') && !patterns.length) flags.push(arg)
  else patterns.push(arg)
}
if (!patterns.length) {
  console.error('node-test: name at least one test file or pattern')
  process.exit(2)
}

const MAGIC = /[*?[\]{}]/
const inNodeModules = path => String(path?.name ?? path).split(/[\\/]/).includes('node_modules')
const files = new Set()
const empty = []
for (const pattern of patterns) {
  const found = MAGIC.test(pattern)
    ? globSync(pattern, {exclude: inNodeModules}).filter(file => statSync(file).isFile())
    : existsSync(pattern) && statSync(pattern).isFile() ? [pattern] : []
  if (!found.length) empty.push(pattern)
  for (const file of found.sort()) files.add(file)
}
if (empty.length) {
  for (const pattern of empty) console.error(`node-test: no test file matches "${pattern}" (from ${process.cwd()})`)
  process.exit(1)
}

const reporter = noSkips ? ['--test-reporter=tap'] : []
const child = spawn(process.execPath, [...flags, '--test', ...reporter, ...files],
  {stdio: ['inherit', noSkips ? 'pipe' : 'inherit', 'inherit']})
const skipped = []
if (noSkips) {
  let pending = ''
  child.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    const lines = (pending + chunk).split('\n')
    pending = lines.pop()
    for (const line of lines) if (/^\s*(not )?ok \d+ - .*# SKIP\b/.test(line)) skipped.push(line.trim())
  })
}
child.on('close', (code, signal) => {
  if (signal) { console.error(`node-test: node --test ended by ${signal}`); process.exit(1) }
  if (code === 0 && skipped.length) {
    console.error(`node-test: ${skipped.length} test(s) skipped in a run that may skip none:`)
    for (const line of skipped) console.error(`  ${line}`)
    process.exit(1)
  }
  process.exit(code ?? 1)
})
