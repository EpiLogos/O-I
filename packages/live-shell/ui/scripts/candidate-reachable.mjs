#!/usr/bin/env node
/**
 * Is this file part of the product? The product is the candidate shell: everything reachable by import (static or
 * dynamic) from packages/live-shell/ui/src/main.tsx, plus the hosted Expressions frame (desktop/cradle/expressions-app),
 * which the candidate carries as its own payload. desktop/cradle/src is shared engine code — a file there is product
 * only if the candidate actually imports it. Legacy-only files (the everyday desktop's own frame, e.g.
 * desktop/cradle/src/CradleFrame.tsx) are not targets: a change there does not reach the app being built.
 *
 *   node packages/live-shell/ui/scripts/candidate-reachable.mjs <file> [<file> …]   → exit 1 if any is not reachable
 *   node packages/live-shell/ui/scripts/candidate-reachable.mjs --list               → every reachable source file
 *   import {reachable, repo} from './candidate-reachable.mjs'                         → the same set, for other scripts
 *
 * Builders run it on a file before editing it; the lead runs it over a builder's diff before committing.
 */
import {createRequire} from 'node:module'
import {existsSync, readFileSync} from 'node:fs'
import {dirname, relative, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const ui = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repo = resolve(ui, '../../..')
const ts = createRequire(import.meta.url)(resolve(repo, 'desktop/cradle/node_modules/typescript'))
const ENTRY = resolve(ui, 'src/main.tsx')
const FRAME = resolve(repo, 'desktop/cradle/expressions-app') + '/'
const SOURCE = /\.(?:tsx?|mts|mjs|js|jsx)$/

const options = {
  module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true,
  allowImportingTsExtensions: true, jsx: ts.JsxEmit.ReactJSX, resolveJsonModule: true,
}
const host = ts.createCompilerHost(options)

/** Every module specifier a file names: static imports, re-exports, dynamic import(), require(). */
function specifiers(file) {
  const info = ts.preProcessFile(readFileSync(file, 'utf8'), true, true)
  return info.importedFiles.map(entry => entry.fileName)
}

function resolveFrom(specifier, from) {
  const found = ts.resolveModuleName(specifier, from, options, host).resolvedModule?.resolvedFileName
  if (found && !found.includes('/node_modules/')) return resolve(found)
  // Vite resolves relative specifiers the TS host may not (".js" naming a ".ts", extensionless ".tsx").
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(from), specifier)
  for (const candidate of [base, base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'), `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && SOURCE.test(candidate)) return candidate
  }
  return null
}

/** Absolute paths of every source file the candidate entry imports, transitively. */
export function reachable() {
  const seen = new Set([ENTRY])
  const queue = [ENTRY]
  while (queue.length) {
    const file = queue.pop()
    for (const specifier of specifiers(file)) {
      const target = resolveFrom(specifier, file)
      if (target && SOURCE.test(target) && !seen.has(target)) { seen.add(target); queue.push(target) }
    }
  }
  return seen
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (invoked) main()

function main() {
  const args = process.argv.slice(2)
  if (!args.length) {
    console.error('usage: candidate-reachable.mjs <file> [<file> …] | --list')
    process.exit(2)
  }
  const set = reachable()
  if (args[0] === '--list') {
    for (const file of [...set].sort()) console.log(relative(repo, file))
    process.exit(0)
  }
  let missing = 0
  for (const arg of args) {
    const file = resolve(process.cwd(), arg)
    const inFrame = file.startsWith(FRAME)
    const inProduct = inFrame || set.has(file)
    const why = inFrame ? 'the hosted Expressions frame (candidate payload)' : inProduct ? 'imported from the candidate entry' : 'NOT reachable from the candidate (packages/live-shell/ui/src/main.tsx): a change here does not reach the app being built'
    console.log(`${inProduct ? 'product ' : 'NOT    '} ${relative(repo, file)} — ${why}`)
    if (!inProduct) missing++
  }
  process.exit(missing ? 1 : 0)
}
