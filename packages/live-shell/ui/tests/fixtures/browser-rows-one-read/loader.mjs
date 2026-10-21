// The module loader of tests/browser-rows-one-read.test.mjs: the shell's TypeScript, transpiled as the other suites do
// (tests/browser-rows-ssr.test.mjs), with two things those suites do not need.
//
//   - ONE React. Files under desktop/cradle/src resolve `react` to the cradle's own copy; a second React breaks hooks, so every
//     `react` and `react-dom` specifier resolves from the suite's own location.
//   - A WINDOW OPENED AGAIN. A specifier that names a source file with `?g=<n>` loads that module, and every source module it
//     imports, as generation n: a fresh copy, with its own module state (the owner readings registry, the kept answers read at
//     start). Node's modules stay shared. This is how the suite relaunches the window in one process.

import {readFile} from 'node:fs/promises'

let ts = null
let reactFrom = null

export async function initialize(data) {
  ts = (await import(data.compiler)).default
  reactFrom = data.reactFrom
}

const GENERATION = /[?&]g=(\d+)/
const bare = url => url.replace(/[?#].*$/, '')
const isReact = specifier => specifier === 'react' || specifier.startsWith('react/') || specifier === 'react-dom' || specifier.startsWith('react-dom/')

async function probe(specifier, context, next) {
  try { return await next(specifier, context) } catch (error) {
    if (!specifier.startsWith('.')) throw error
    const stem = specifier.replace(/[?#].*$/, '')
    if (stem.endsWith('.js')) { try { return await next(stem.slice(0, -3) + '.ts', context) } catch { /* try the next spelling */ } }
    for (const extension of ['.ts', '.tsx']) { try { return await next(stem + extension, context) } catch { /* try the next spelling */ } }
    for (const extension of ['/index.ts', '/index.tsx']) { try { return await next(stem + extension, context) } catch { /* try the next spelling */ } }
    throw error
  }
}

export async function resolve(specifier, context, next) {
  if (isReact(specifier)) return next(specifier, {...context, parentURL: reactFrom})
  const generation = GENERATION.exec(context.parentURL ?? '')?.[1] ?? null
  const parentURL = context.parentURL ? bare(context.parentURL) : context.parentURL
  const found = await probe(specifier, {...context, parentURL}, next)
  if (!generation || !found.url.startsWith('file:') || found.url.includes('/node_modules/') || /[?#]/.test(found.url)) return found
  return {...found, url: `${found.url}?g=${generation}`}
}

export async function load(url, context, next) {
  const path = bare(url)
  if (path.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'}
  if (url.includes('?raw') || path.endsWith('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'}
  if (path.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(path), 'utf8')}
  if (!path.endsWith('.ts') && !path.endsWith('.tsx')) return next(url, context)
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(path), 'utf8'), {fileName: new URL(path).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText}
}
