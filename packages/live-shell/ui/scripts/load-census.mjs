#!/usr/bin/env node
/**
 * What each window loads before it draws (MAP, the build lane's loading item: "the shell loads as one 6.2 MB script before it
 * draws anything — split it by mode and device"). The shell is built as the candidate builds it (vite, this package's config, not
 * written to disk), and for each window the script counts the JavaScript it must fetch before its frame can draw: the entry
 * chunk and every chunk it imports statically, then the frame's own chunk (App for the main window, Detached for a device's or
 * page's window) and its static imports. A chunk loaded later — a mode, a device's design, a page — is not counted.
 *
 *   load-census.mjs                    → per window: the bytes, the chunks, and what fills them most (by area and by module)
 *   load-census.mjs --budget <MB>      → exit 1 when the main window's first load is over the budget (minified, uncompressed)
 *   load-census.mjs --json             → the same as JSON
 *
 * Takes about a minute and a half: it is a production build. Run by hand around a split, not in the suite.
 */
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {gzipSync} from 'node:zlib'

const ui = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const budget = args.includes('--budget') ? Number(args[args.indexOf('--budget') + 1]) : null
const asJson = args.includes('--json')

const vite = await import(pathToFileURL(createRequire(join(ui, 'package.json')).resolve('vite')).href)

/** A module's area: an npm package, a shell directory, or a repository directory. */
function area(id) {
  const clean = id.replace(/\?.*$/, '')
  const npm = clean.lastIndexOf('node_modules/')
  if (npm >= 0) {
    const [scope, name] = clean.slice(npm + 13).split('/')
    return `npm:${scope.startsWith('@') ? `${scope}/${name}` : scope}`
  }
  const src = clean.indexOf('/packages/live-shell/ui/src/')
  if (src >= 0) return `shell:${clean.slice(src + 28).split('/').slice(0, 2).join('/')}`
  const repo = clean.indexOf('/o-i/')
  return `repo:${(repo >= 0 ? clean.slice(repo + 5) : clean).split('/').slice(0, 4).join('/')}`
}
const short = id => id.replace(/^.*\/o-i\//, '')

let windows = null
const census = {
  name: 'load-census',
  generateBundle(_options, bundle) {
    const chunks = new Map(Object.values(bundle).filter(item => item.type === 'chunk').map(chunk => [chunk.fileName, chunk]))
    const closure = (start, seen = new Set()) => {
      for (const name of start) {
        if (seen.has(name) || !chunks.has(name)) continue
        seen.add(name)
        closure(chunks.get(name).imports, seen)
      }
      return seen
    }
    const entry = [...chunks.values()].find(chunk => chunk.isEntry)
    const holding = suffix => [...chunks.values()].find(chunk => Object.keys(chunk.modules).some(id => id.endsWith(suffix)))
    const frames = {main: holding('/src/App.tsx'), window: holding('/src/native/Detached.tsx')}
    windows = Object.fromEntries(Object.entries(frames).map(([name, frame]) => {
      const loaded = closure([entry.fileName, ...(frame ? [frame.fileName] : [])])
      const list = [...loaded].map(file => chunks.get(file))
      const bytes = list.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0)
      const gzip = list.reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0)
      const modules = list.flatMap(chunk => Object.entries(chunk.modules).map(([id, info]) => ({id, size: info.renderedLength})))
      const byArea = new Map()
      for (const module of modules) byArea.set(area(module.id), (byArea.get(area(module.id)) ?? 0) + module.size)
      return [name, {
        bytes, gzip, chunks: list.map(chunk => ({file: chunk.fileName, bytes: Buffer.byteLength(chunk.code)})).sort((a, b) => b.bytes - a.bytes),
        areas: [...byArea].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, size]) => ({area: name, rendered: size})),
        modules: modules.sort((a, b) => b.size - a.size).slice(0, 15).map(module => ({module: short(module.id), rendered: module.size})),
      }]
    }))
    windows.all = {chunks: chunks.size, bytes: [...chunks.values()].reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0)}
  },
}

await vite.build({root: ui, configFile: join(ui, 'vite.config.ts'), logLevel: 'error', build: {write: false}, plugins: [census]})

if (asJson) console.log(JSON.stringify(windows, null, 2))
else {
  const mb = n => `${(n / 1e6).toFixed(2)} MB`
  console.log(`every chunk: ${windows.all.chunks}, ${mb(windows.all.bytes)}`)
  for (const name of ['main', 'window']) {
    const w = windows[name]
    console.log(`\n${name === 'main' ? 'the main window' : 'a device\'s or page\'s window'} loads ${mb(w.bytes)} (${mb(w.gzip)} gzip) in ${w.chunks.length} chunks before it draws`)
    for (const chunk of w.chunks.slice(0, 6)) console.log(`  ${mb(chunk.bytes).padStart(8)}  ${chunk.file}`)
    console.log('  most, by area (rendered, before minifying):')
    for (const row of w.areas.slice(0, 12)) console.log(`  ${`${(row.rendered / 1e3).toFixed(0)} kB`.padStart(8)}  ${row.area}`)
    console.log('  most, by module:')
    for (const row of w.modules.slice(0, 8)) console.log(`  ${`${(row.rendered / 1e3).toFixed(0)} kB`.padStart(8)}  ${row.module}`)
  }
}
if (budget !== null && windows.main.bytes > budget * 1e6) {
  console.error(`\nthe main window's first load is ${(windows.main.bytes / 1e6).toFixed(2)} MB, over the ${budget} MB budget`)
  process.exit(1)
}
