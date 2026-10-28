#!/usr/bin/env node
/**
 * Is this file part of the product? The product is the candidate shell: every file the pages it ships and opens load at
 * runtime, through imports that survive the build. Those pages (ENTRIES) are the shell's own index.html and the hosted
 * Expressions frame's index.html and library.html, which the candidate carries as its payload. desktop/cradle/src is
 * shared engine code — a file there is product only if one of those pages actually loads it. Legacy-only files (the
 * everyday desktop's own frame, e.g. desktop/cradle/src/CradleFrame.tsx) are not targets: a change there does not reach
 * the app being built.
 *
 * Only imports the build keeps reach. Vite (esbuild) and TypeScript's isolated transpile erase `import type`, an import
 * whose every name carries `type`, and an import whose names are used only as types; such a module is named by the
 * product's types but never runs in it. Each file is transpiled as the build transpiles it and its surviving imports are
 * followed. --types counts type-only imports as reaching (the measure before 15 Oct), to show what only types name.
 *
 *   candidate-reachable.mjs <file> [<file> …]      → a verdict per file; exit 1 if any is not reachable (a types module
 *                                                     the product's types name passes: it is the product's contract)
 *   candidate-reachable.mjs --list                 → every reachable file (source; CSS, JSON and raw assets as leaves)
 *   candidate-reachable.mjs --unreached [<dir> …]  → every source and CSS file under the dirs (default
 *                                                     packages/live-shell/ui/src) that nothing reaches; a file only a
 *                                                     dev page loads is marked with the page, a file only types name is
 *                                                     marked, and a types module (it never runs) is marked as one
 *   candidate-reachable.mjs --entries              → the pages taken as roots, and the shipped pages nothing opens
 *   add --types to any of these to let type-only imports reach
 *   import {reachable, repo} from './candidate-reachable.mjs'   → the same set, for other scripts
 *
 * Builders run it on a file before editing it; the lead runs it over a builder's diff before committing. FOUNDATION §7:
 * --unreached against the tree names the code to delete.
 */
import {createRequire} from 'node:module'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {dirname, join, relative, resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const ui = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const repo = resolve(ui, '../../..')
const ts = createRequire(import.meta.url)(resolve(repo, 'desktop/cradle/node_modules/typescript'))
const FRAME = resolve(repo, 'desktop/cradle/expressions-app')
const SOURCE = /\.(?:tsx?|mts|cts|mjs|cjs|js|jsx)$/
const TRANSPILED = /\.(?:tsx?|mts|cts)$/
const ASSET = /\.css$/
const DATA = /\.json$/
const DECLARATION = /\.d\.[cm]?ts$/

/**
 * The pages the candidate ships and opens. Each page's module scripts are roots.
 * - the shell: the payload's shell_entry, /app/index.html (packages/live-shell/package-payload.py:18).
 * - the hosted Expressions frame: the payload's expressions_entry, /__application/expressions/index.html
 *   (package-payload.py:19), mounted by src/panels/expressions.tsx and desktop/cradle/src/expressions/hostedApp.ts:36.
 * - the Library page: library.html beside the frame's index, opened by hostedLibraryUrl
 *   (desktop/cradle/src/expressions/hostedApp.ts:51) from desktop/cradle/src/library/LibraryHost.tsx.
 */
export const ENTRIES = [
  'packages/live-shell/ui/index.html',
  'desktop/cradle/expressions-app/index.html',
  'desktop/cradle/expressions-app/library.html',
]
/** Pages the frame's build also emits (expressions-app/vite.config.ts rollupOptions.input) and the payload copies with
 * the rest of dist/, which nothing in the candidate opens: the retired legacy workbench and the Physis renderer. */
export const UNOPENED = [
  'desktop/cradle/expressions-app/legacy.html',
  'desktop/cradle/expressions-app/render.html',
]

/** The frame's module aliases (expressions-app/vite.config.ts resolve.alias, tsconfig.json paths). */
const FRAME_ALIASES = {
  ...Object.fromEntries(['schema', 'domain', 'desktop-api', 'geography', 'viewers', 'node-document']
    .map(name => [`@research-canvas/${name}`, join(FRAME, `vendor/research-canvas/packages/${name}/src/index.ts`)])),
  '@research-canvas/exporter': join(FRAME, 'vendor/research-canvas/browserExporter.ts'),
}

const options = {
  module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, allowJs: true,
  allowImportingTsExtensions: true, jsx: ts.JsxEmit.ReactJSX, resolveJsonModule: true,
}
const host = ts.createCompilerHost(options)
/** As Vite's esbuild transform runs it: per file, no verbatimModuleSyntax, so imports used only as types are erased. */
const transpile = {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true,
  verbatimModuleSyntax: false, experimentalDecorators: true,
}

/** The module scripts a page loads, as absolute paths (a leading "/" is the page's own directory, Vite's root). */
export function pageScripts(page) {
  const html = readFileSync(page, 'utf8')
  const scripts = []
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/type\s*=\s*["']module["']/i.test(tag)) continue
    const src = tag.match(/src\s*=\s*["']([^"']+)["']/i)?.[1]
    if (src) scripts.push(resolve(dirname(page), src.replace(/^\//, '')))
  }
  return scripts
}

const specifierCache = new Map()
/** Every module specifier a file names and its build keeps: static imports, re-exports, import(), require(), and
 * `new URL('./x', import.meta.url)` (a worker or asset Vite bundles). With types, also the imports the build erases. */
export function specifiers(file, {types = false} = {}) {
  const key = `${types ? 'types' : 'runtime'}\u0000${file}`
  if (!specifierCache.has(key)) specifierCache.set(key, specifiersOf(file, types))
  return specifierCache.get(key)
}
function specifiersOf(file, types) {
  const text = readFileSync(file, 'utf8')
  if (ASSET.test(file)) return [...text.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g)].map(match => match[1])
  const code = !types && TRANSPILED.test(file) && !DECLARATION.test(file)
    ? ts.transpileModule(text, {compilerOptions: transpile, fileName: file, reportDiagnostics: false}).outputText
    : text
  const named = ts.preProcessFile(code, true, true).importedFiles.map(entry => entry.fileName)
  const urls = [...code.matchAll(/new\s+URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)].map(match => match[1])
  return [...named, ...urls, ...(code.includes('import.meta.glob') ? globbed(file, code) : [])]
}

/**
 * The files an `import.meta.glob` names, as relative specifiers: Vite expands each call at build time into one import per matched file
 * (lazy or eager, both bundled), so every match is loaded as surely as a static import. Patterns are string literals, alone or in an array;
 * a pattern starting `./` or `../` is the file's own directory, `/` the Vite root (the nearest folder above that holds a vite.config), and
 * a `!` pattern takes its matches out. A glob with a query (`{query: '?raw'}`, `{as: 'raw'}`) ships its files as text or URLs: they are
 * reached and not followed. An aliased pattern is not expanded (none stands in the product today).
 */
function globbed(file, code) {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.ES2022, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = []
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'glob'
      && ts.isMetaProperty(node.expression.expression) && node.expression.expression.name.text === 'meta') {
      const [first, second] = node.arguments
      const patterns = first && ts.isStringLiteralLike(first) ? [first.text]
        : first && ts.isArrayLiteralExpression(first) ? first.elements.filter(ts.isStringLiteralLike).map(element => element.text) : []
      const query = second && ts.isObjectLiteralExpression(second) ? globQuery(second) : ''
      found.push(...globFiles(file, patterns).map(match => `${match}${query}`))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** The query a glob's options give its imports (`query: '?raw'`, or the older `as: 'raw'`), or ''. */
function globQuery(options) {
  for (const property of options.properties) {
    if (!ts.isPropertyAssignment(property) || !property.initializer || !ts.isStringLiteralLike(property.initializer)) continue
    const key = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) ? property.name.text : ''
    if (key === 'query') return property.initializer.text.startsWith('?') ? property.initializer.text : `?${property.initializer.text}`
    if (key === 'as') return `?${property.initializer.text}`
  }
  return ''
}

/** A glob pattern as a regular expression over `/`-separated paths: `**` any depth, `*` and `?` within one segment, `{a,b}` either. */
function globRegExp(pattern) {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*') { out += pattern[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += pattern[i + 2] === '/' ? 2 : 1 }
    else if (c === '*') out += '[^/]*'
    else if (c === '?') out += '[^/]'
    else if (c === '{') { const end = pattern.indexOf('}', i); out += `(?:${pattern.slice(i + 1, end).split(',').map(part => part.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`; i = end }
    else out += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`)
}

/** The Vite root a `/` pattern names from this file: the nearest folder above it that holds a vite.config. */
function viteRoot(file) {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    if (readdirSync(dir).some(name => /^vite\.config\.[cm]?[jt]s$/.test(name))) return dir
  }
  return null
}

/** The files a glob call's patterns match, each as a specifier relative to the file. */
function globFiles(file, patterns) {
  const base = dirname(file)
  const absolute = pattern => {
    if (pattern.startsWith('./') || pattern.startsWith('../')) return resolve(base, pattern)
    if (pattern.startsWith('/')) { const root = viteRoot(file); return root ? join(root, pattern) : null }
    return null
  }
  const taken = new Set(), dropped = new Set()
  for (const raw of patterns) {
    const negated = raw.startsWith('!'), path = absolute(negated ? raw.slice(1) : raw)
    if (!path) continue
    const fixed = path.split('/').findIndex(segment => /[*?{]/.test(segment))
    const dir = fixed < 0 ? dirname(path) : path.split('/').slice(0, fixed).join('/')
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
    const matcher = globRegExp(path)
    for (const candidate of filesUnder(dir)) if (matcher.test(candidate)) (negated ? dropped : taken).add(candidate)
  }
  return [...taken].filter(match => !dropped.has(match)).sort().map(match => {
    const rel = relative(base, match)
    return rel.startsWith('.') ? rel : `./${rel}`
  })
}

/** A module that declares only types: its build output is empty (the transpile has already erased every import its types
 * needed; an import left in the output is code). Such a file is reached by the product's type-check, not its runtime; a types
 * module the product's types name is kept, never deleted. */
export function declaresOnlyTypes(file) {
  if (!TRANSPILED.test(file) || DECLARATION.test(file)) return false
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: transpile, fileName: file, reportDiagnostics: false}).outputText
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/^\s*export \{\};?\s*$/gm, '').trim() === ''
}

/** The file a specifier names from `from`, or null when it leaves the tree (a package) or names nothing. A specifier with a query
 * (`?raw`, `?url`) names any file the build carries as text or a URL — an HTML form, an SVG, Markdown — not only source. */
export function resolveFrom(specifier, from) {
  const path = specifier.split('?')[0]
  const query = specifier.includes('?')
  const aliased = from.startsWith(FRAME + '/') && FRAME_ALIASES[path] ? FRAME_ALIASES[path]
    : from.startsWith(FRAME + '/') && path.startsWith('@/') ? join(FRAME, path.slice(2)) : path
  if (aliased.startsWith('/')) return existsSync(aliased) ? aliased : null
  if (!ASSET.test(aliased)) {
    const found = ts.resolveModuleName(aliased, from, options, host).resolvedModule?.resolvedFileName
    if (found && !found.includes('/node_modules/')) {
      if (!DECLARATION.test(found)) return resolve(found)
      // A declaration describes the module the build loads beside it (x.d.mts → x.mjs).
      const runtime = found.replace(/\.d\.ts$/, '.js').replace(/\.d\.mts$/, '.mjs').replace(/\.d\.cts$/, '.cjs')
      if (existsSync(runtime)) return resolve(runtime)
    }
  }
  // Vite resolves relative specifiers the TS host may not (".js" naming a ".ts", extensionless ".tsx", a raw asset).
  if (!aliased.startsWith('.')) return null
  const base = resolve(dirname(from), aliased)
  for (const candidate of [base, base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'), `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && (query || SOURCE.test(candidate) || ASSET.test(candidate))) return candidate
  }
  return null
}

/**
 * Every file reachable from the roots, mapped to the first file that reached it (a root maps to its page). Source files
 * are followed; CSS is followed through @import; JSON is a leaf; a file named with a query (`?raw`, `?url`) is shipped as
 * text or a URL, so it is reached, whatever its kind (an HTML form, an SVG), but not followed.
 */
export function walk(roots, {types = false} = {}) {
  const reachedBy = new Map()
  const queue = []
  for (const [root, page] of roots) if (!reachedBy.has(root)) { reachedBy.set(root, page); queue.push(root) }
  while (queue.length) {
    const file = queue.pop()
    for (const specifier of specifiers(file, {types})) {
      const target = resolveFrom(specifier, file)
      // A query names a leaf the build carries whatever its kind (an HTML form imported ?raw); without one, only source, CSS and JSON.
      if (!target || reachedBy.has(target) || !(specifier.includes('?') || SOURCE.test(target) || ASSET.test(target) || DATA.test(target))) continue
      reachedBy.set(target, file)
      if (!specifier.includes('?') && !DATA.test(target)) queue.push(target)
    }
  }
  return reachedBy
}

/** The roots: each entry page's module scripts. */
export function roots(entries = ENTRIES) {
  return entries.flatMap(entry => {
    const page = resolve(repo, entry)
    return pageScripts(page).map(script => [script, page])
  })
}

/** Absolute paths of every file the candidate loads at runtime (with types: also every file only its types name). */
export function reachable({types = false} = {}) {
  return new Set(walk(roots(), {types}).keys())
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist' || name === 'build') return []
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

/** Source and CSS files under the dirs that the set does not hold (declarations and tests are never reached). */
export function unreachedUnder(dirs, set) {
  return dirs.flatMap(filesUnder)
    .filter(file => (SOURCE.test(file) || ASSET.test(file)) && !DECLARATION.test(file) && !/\.test\.[cm]?[jt]sx?$/.test(file))
    .filter(file => !set.has(file))
    .sort()
}

/** The development pages under the dirs (an HTML page with a module script that is not an entry): each file such a page
 * loads, mapped to the page. Development hosts are not the product; they are named so they are not taken for dead code. */
export function devPagesUnder(dirs) {
  const entries = new Set(ENTRIES.map(entry => resolve(repo, entry)))
  const pages = dirs.flatMap(filesUnder).filter(file => file.endsWith('.html') && !entries.has(file))
  const loadedBy = new Map()
  for (const page of pages) {
    for (const file of walk(pageScripts(page).map(script => [script, page])).keys()) if (!loadedBy.has(file)) loadedBy.set(file, page)
  }
  return loadedBy
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (invoked) main()

function main() {
  const flags = new Set(process.argv.slice(2).filter(arg => arg.startsWith('--')))
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
  const types = flags.has('--types')
  const known = ['--types', '--list', '--unreached', '--entries']
  if ([...flags].some(flag => !known.includes(flag)) || (!args.length && !flags.has('--list') && !flags.has('--unreached') && !flags.has('--entries'))) {
    console.error('usage: candidate-reachable.mjs [--types] <file> [<file> …] | --list | --unreached [<dir> …] | --entries')
    process.exit(2)
  }
  const show = file => relative(repo, file)
  if (flags.has('--entries')) {
    for (const [script, page] of roots()) console.log(`root      ${show(script)} — loaded by ${show(page)}`)
    for (const entry of UNOPENED) for (const script of pageScripts(resolve(repo, entry))) console.log(`unopened  ${show(script)} — ${entry} is built and shipped; nothing in the candidate opens it`)
    process.exit(0)
  }
  const reached = walk(roots(), {types})
  if (flags.has('--list')) {
    for (const file of [...reached.keys()].sort()) console.log(show(file))
    process.exit(0)
  }
  const named = types ? reached : walk(roots(), {types: true})
  if (flags.has('--unreached')) {
    const dirs = (args.length ? args : [join(ui, 'src')]).map(dir => resolve(process.cwd(), dir))
    const list = unreachedUnder(dirs, reached)
    const dev = devPagesUnder(dirs)
    // A dev page's own folder holds its host config too (a vite.config beside the page).
    const devFolders = new Set([...dev.values()].map(page => dirname(page)))
    const isDev = file => dev.has(file) || devFolders.has(dirname(file)) || /\/dev\//.test(file)
    let typeModules = 0, onDevPages = 0
    for (const file of list) {
      const typeModule = named.has(file) && declaresOnlyTypes(file)
      if (typeModule) typeModules++
      if (isDev(file)) onDevPages++
      const notes = [
        dev.has(file) ? `dev page ${show(dev.get(file))}` : isDev(file) ? 'dev' : '',
        typeModule ? `types module, named via ${show(named.get(file))}`
          : named.has(file) ? `only type imports reach it, via ${show(named.get(file))}` : '',
      ].filter(Boolean)
      console.log(`${show(file)}${notes.length ? `  [${notes.join('; ')}]` : ''}`)
    }
    console.error(`${list.length} unreached under ${dirs.map(show).join(', ')}: ${typeModules} types modules the product's types name, ${onDevPages} on dev pages`)
    process.exit(0)
  }
  let missing = 0
  for (const arg of args) {
    const file = resolve(process.cwd(), arg)
    const typeModule = !reached.has(file) && named.has(file) && declaresOnlyTypes(file)
    const inProduct = reached.has(file) || typeModule
    const why = reached.has(file) ? `loaded at runtime (reached from ${show(reached.get(file))})`
      : typeModule ? `a types module the product's types name (via ${show(named.get(file))}): it never runs, the product type-checks against it`
        : named.has(file) ? `NOT loaded at runtime: only type imports name it (from ${show(named.get(file))}), and the build erases them`
          : 'NOT reachable from the candidate (the pages in ENTRIES): a change here does not reach the app being built'
    console.log(`${inProduct ? 'product ' : 'NOT    '} ${show(file)} — ${why}`)
    if (!inProduct) missing++
  }
  process.exit(missing ? 1 : 0)
}
