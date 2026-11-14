#!/usr/bin/env node
// The foundation's two rules, checked on every landing (O-I #1000; docs/architecture/world-shell.md §9.2):
//   1. no device or view code calls an owner or a kernel read op directly ("direct-read");
//   2. no control writes except by an Action ("non-action-write").
//
// Device and view code is packages/live-shell/ui/src, tests apart. Every kernel op is named by its wire name (the KernelOp enum in
// desktop/cradle/kernel/src/lib.rs, snake_case unless renamed). Device and view code may name only the foundation's doors: the World
// Model's and the Sets' subscriptions (`model_subscribe`, `set_subscribe`) and the Action registry's (`act`, `act_describe`, and the
// two Action doors that came before it, `invoke_action` and `product_action_run`). Any other op it names is a violation: a read
// when the op only reads, else a write.
//
// Today's violations are the baseline (gates/foundation/lint-baseline.json), which may only shrink: a file whose count for a rule
// rises above its baseline fails, a file absent from it fails on its first violation, and `--update` rewrites the baseline downward
// only (it refuses to record a rise).
//
//   node gates/foundation/lint.mjs            check
//   node gates/foundation/lint.mjs --json     the counts, machine-read
//   node gates/foundation/lint.mjs --update   lower the baseline to today's counts
import {readFileSync, readdirSync, statSync, writeFileSync, existsSync} from 'node:fs'
import {join, relative, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const scanned = join(repo, 'packages/live-shell/ui/src')
const baselinePath = join(here, 'lint-baseline.json')
const kernelLib = join(repo, 'desktop/cradle/kernel/src/lib.rs')

const DOORS = new Set(['model_subscribe', 'set_subscribe', 'act', 'act_describe', 'invoke_action', 'product_action_run'])

/** The kernel's op wire names, read from the KernelOp enum itself. */
function kernelOps() {
  const source = readFileSync(kernelLib, 'utf8')
  const start = source.indexOf('pub enum KernelOp {')
  if (start < 0) throw new Error(`no KernelOp enum in ${kernelLib}`)
  let depth = 0
  let end = start
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) { end = i; break }
  }
  const body = source.slice(source.indexOf('{', start) + 1, end)
  const ops = new Set()
  let rename = null
  let level = 0
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (level === 0) {
      const renamed = trimmed.match(/^#\[serde\(.*rename\s*=\s*"([a-z_]+)"/)
      if (renamed) rename = renamed[1]
      const variant = trimmed.match(/^([A-Z][A-Za-z0-9]*)\s*(\{|\(|,|$)/)
      if (variant) {
        ops.add(rename ?? variant[1].replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
        rename = null
      }
    }
    for (const ch of trimmed.replace(/\/\/.*$/, '')) {
      if (ch === '{' || ch === '(') level++
      else if (ch === '}' || ch === ')') level--
    }
  }
  return ops
}

const READ = /(_read|_list|_status|_browse|_describe|_descriptors|_catalogue|_since|_impact|_snapshot|_reveal)$/
const READ_OPS = new Set(['world_read', 'page', 'files_list', 'file_read', 'file_resolve', 'state', 'knowledge', 'graph', 'routine'])
const ruleOf = op => (READ.test(op) || READ_OPS.has(op) ? 'direct-read' : 'non-action-write')

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'tests' || name === '__tests__') continue
      yield* files(path)
    } else if (/\.(ts|tsx|mts|js|mjs)$/.test(name) && !/\.(test|spec)\.[a-z]+$/.test(name)) {
      yield path
    }
  }
}

function count() {
  const ops = kernelOps()
  const found = {}
  const sites = {}
  const literal = /\bop\s*:\s*['"]([a-z_]+)['"]/g
  for (const path of files(scanned)) {
    const text = readFileSync(path, 'utf8')
    const file = relative(repo, path)
    let match
    while ((match = literal.exec(text))) {
      const op = match[1]
      if (!ops.has(op) || DOORS.has(op)) continue
      const rule = ruleOf(op)
      found[file] ??= {}
      found[file][rule] = (found[file][rule] ?? 0) + 1
      const line = text.slice(0, match.index).split('\n').length
      ;(sites[file] ??= []).push(`${line}:${op}:${rule}`)
    }
  }
  return {found, sites, ops: ops.size}
}

const args = new Set(process.argv.slice(2))
const {found, sites, ops} = count()
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')).files ?? {} : {}
const totals = rule => Object.values(found).reduce((sum, rules) => sum + (rules[rule] ?? 0), 0)
const baseTotals = rule => Object.values(baseline).reduce((sum, rules) => sum + (rules[rule] ?? 0), 0)

const rises = []
for (const [file, rules] of Object.entries(found)) {
  for (const [rule, n] of Object.entries(rules)) {
    const allowed = baseline[file]?.[rule] ?? 0
    if (n > allowed) rises.push({file, rule, count: n, baseline: allowed, sites: sites[file].filter(s => s.endsWith(`:${rule}`))})
  }
}

if (args.has('--update')) {
  // The first baseline records the day the rules were set (13 Nov 2026); every later update only lowers it.
  if (rises.length && existsSync(baselinePath)) {
    for (const rise of rises) console.error(`refused: ${rise.file} ${rise.rule} would rise ${rise.baseline} → ${rise.count}`)
    console.error('the baseline only shrinks: route these through the World Model or an Action first')
    process.exit(1)
  }
  const files = Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(baselinePath, JSON.stringify({
    schema: 'oi.foundation-lint-baseline/v1',
    rule: 'Counts of kernel ops named in device and view code (packages/live-shell/ui/src) other than the foundation doors. Each count may only fall.',
    totals: {'direct-read': totals('direct-read'), 'non-action-write': totals('non-action-write')},
    files,
  }, null, 2) + '\n')
  console.log(`foundation lint: baseline lowered to ${totals('direct-read')} direct reads and ${totals('non-action-write')} non-Action writes`)
  process.exit(0)
}

const report = {
  schema: 'oi.foundation-lint/v1',
  kernel_ops: ops,
  totals: {'direct-read': totals('direct-read'), 'non-action-write': totals('non-action-write')},
  baseline: {'direct-read': baseTotals('direct-read'), 'non-action-write': baseTotals('non-action-write')},
  rises,
  result: rises.length ? 'failed' : 'passed',
}
if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`foundation lint: ${report.totals['direct-read']} direct reads (baseline ${report.baseline['direct-read']}), ` +
    `${report.totals['non-action-write']} non-Action writes (baseline ${report.baseline['non-action-write']})`)
  for (const rise of rises) {
    console.error(`  ${rise.file}: ${rise.rule} ${rise.baseline} → ${rise.count}`)
    for (const site of rise.sites) console.error(`    line ${site}`)
  }
  if (rises.length) console.error('device and view code reads the World Model and writes by Actions (docs/architecture/world-shell.md §9.2)')
  else if (report.totals['direct-read'] < report.baseline['direct-read'] || report.totals['non-action-write'] < report.baseline['non-action-write']) {
    console.log('  the counts fell: lower the baseline with `node gates/foundation/lint.mjs --update`')
  }
}
process.exit(rises.length ? 1 : 0)
