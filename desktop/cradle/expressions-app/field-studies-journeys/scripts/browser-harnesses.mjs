#!/usr/bin/env node
// The frame's browser harnesses, as the candidate job's browser step runs them.
//
// Every tests/*_browser.py, *_browser.mjs and *_gpu.py runs, one at a time
// (each drives a software-WebGL Chromium), against what the builds already
// produced: the standalone page and harness bundle (npm run build:journeys)
// and the frame's production build (../dist, served here on a loopback port
// and named to each harness as OI_TEST_URL). Captures go to FIELD_EVIDENCE_DIR,
// by default desktop/cradle/tests/artifacts/field-studies-journeys.
//
// A run that finds no harness, misses a build, or has any harness fail exits 1.
//
//   node scripts/browser-harnesses.mjs [name-fragment...]

import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {existsSync, readdirSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {dirname, extname, join, resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'

const journeys = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tests = join(journeys, 'tests')
const dist = resolve(journeys, '../dist')
const evidence = process.env.FIELD_EVIDENCE_DIR || resolve(journeys, '../../tests/artifacts/field-studies-journeys')
const HARNESS = /_(browser\.(py|mjs)|gpu\.py)$/
const PER_HARNESS_MS = 10 * 60 * 1000

const only = process.argv.slice(2)
const harnesses = readdirSync(tests).filter(name => HARNESS.test(name)).sort()
  .filter(name => !only.length || only.some(fragment => name.includes(fragment)))
if (!harnesses.length) {
  console.error(`browser-harnesses: no harness matches tests/*_browser.{py,mjs} or tests/*_gpu.py${only.length ? ` and ${only.join(', ')}` : ''}`)
  process.exit(1)
}
const needed = [join(journeys, 'public/index.html'), join(journeys, 'build/native-harness.js'), join(dist, 'index.html')]
const missing = needed.filter(file => !existsSync(file))
if (missing.length) {
  console.error(`browser-harnesses: build the frame first (npm --prefix desktop/cradle/expressions-app run build); missing ${missing.join(', ')}`)
  process.exit(1)
}

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm'}
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
  const file = resolve(dist, '.' + (path.endsWith('/') ? path + 'index.html' : path))
  if (file !== dist && !file.startsWith(dist + sep)) { response.writeHead(403).end(); return }
  try {
    const body = await readFile(file)
    response.writeHead(200, {'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'}).end(body)
  } catch { response.writeHead(404).end() }
})
await new Promise(ready => server.listen(0, '127.0.0.1', ready))
const url = `http://127.0.0.1:${server.address().port}/`
console.log(`browser-harnesses: ${harnesses.length} harnesses; frame build at ${url}; evidence in ${evidence}`)

const python = process.env.PYTHON || 'python3'
const failed = []
for (const name of harnesses) {
  const started = Date.now()
  const command = name.endsWith('.py') ? python : process.execPath
  console.log(`\n── ${name}`)
  const code = await new Promise(done => {
    const child = spawn(command, [join(tests, name)], {cwd: journeys, stdio: 'inherit',
      env: {...process.env, OI_TEST_URL: url, FIELD_EVIDENCE_DIR: evidence}})
    const timer = setTimeout(() => { console.error(`browser-harnesses: ${name} exceeded ${PER_HARNESS_MS / 60000} minutes`); child.kill('SIGKILL') }, PER_HARNESS_MS)
    child.on('error', error => { clearTimeout(timer); console.error(`browser-harnesses: ${name}: ${error.message}`); done(1) })
    child.on('close', (status, signal) => { clearTimeout(timer); done(signal ? 1 : status) })
  })
  console.log(`── ${name}: ${code === 0 ? 'passed' : `FAILED (${code})`} in ${Math.round((Date.now() - started) / 1000)} s`)
  if (code !== 0) failed.push(name)
}
server.close()
if (failed.length) {
  console.error(`\nbrowser-harnesses: ${failed.length} of ${harnesses.length} failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`\nbrowser-harnesses: all ${harnesses.length} passed`)
