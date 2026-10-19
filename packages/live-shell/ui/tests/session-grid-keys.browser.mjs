/**
 * The Session grid's track head takes its own keys, in WebKit as in Chromium (r20, 19 Oct): a head selected by a click and then
 * Delete takes the track out of the set. WebKit does not focus a button on a click (the native candidate is WebKit), so the key went
 * to no head at all, and WebKit's Backspace stepped the shell back a page instead. The head now takes focus as it is selected.
 *
 * The stage is the grid's own view (frame/tracks/SessionGrid.tsx SessionGridView), bundled as the shell bundles it (the agent-shell
 * harness's esbuild options), over a set of two worlds whose removal records what it was asked; a history entry stands before it, so
 * a key that steps back shows.
 *
 * Run: node tests/session-grid-keys.browser.mjs
 */
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {bundleOptions, inlineModuleSafe, playwright, root} from './support/agentShellHarness.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const contents = `
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import './styles.css'
import {SessionGridView} from './frame/tracks/SessionGrid'

const asked = (window as any).__asked = [] as string[]
const set = {columns: [{id: 'row:1', name: '1'}], clips: [],
  tracks: [{id: 'world:yours', name: 'Your world', kind: 'world'}, {id: 'world:oi', name: 'O-I', kind: 'world'}],
  actions: {removeTrack: {op: 'central.day.set', run: (id: string) => { asked.push(id) }}}} as any
function Stage() {
  const [ref, setRef] = useState<string | undefined>(undefined)
  return <SessionGridView set={set} selection={{ref, select: target => setRef(target.ref)}} folded={{}} onFold={() => {}} receipt={null}
    onPress={(_key, _what, run) => { run() }} onDismiss={() => {}} />
}
history.pushState({grid: true}, '', '#grid')
createRoot(document.getElementById('root')!).render(<Stage />)
;(window as any).__ready = true
`

const esbuild = createRequire(join(root, 'desktop/cradle/package.json'))('esbuild')
const options = bundleOptions()
const bundle = await esbuild.build({...options, stdin: {contents, resolveDir: join(here, '..', 'src'), sourcefile: 'session-grid-keys-entry.tsx', loader: 'tsx'},
  outfile: 'session-grid-keys.browser.mjs'})
const js = bundle.outputFiles.find(file => file.path.endsWith('.mjs')).text
const css = bundle.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n')

const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script type="module">${inlineModuleSafe(js)}</script></body></html>`)
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}/`

const faults = []
const engines = playwright()
try {
  for (const name of ['webkit', 'chromium']) {
    const browser = await engines[name].launch({headless: true, ...(name === 'webkit' && process.env.OI_WEBKIT_EXECUTABLE ? {executablePath: process.env.OI_WEBKIT_EXECUTABLE} : {})})
    try {
      const page = await browser.newPage({viewport: {width: 900, height: 500}})
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(url, {waitUntil: 'domcontentloaded'})
      await page.waitForFunction(() => window.__ready === true, undefined, {timeout: 20000})
      const head = page.locator('.thd', {hasText: 'O-I'})
      await head.click()
      await page.waitForSelector('.trk-remove', {timeout: 5000})
      for (const key of ['Backspace', 'Delete']) {
        await page.evaluate(() => { window.__asked.length = 0 })
        await page.keyboard.press(key)
        try {
          assert.deepEqual(await page.evaluate(() => window.__asked), ['world:oi'], `${name}: ${key} on the selected head takes O-I out of the set`)
          assert.equal(await page.evaluate(() => location.hash), '#grid', `${name}: ${key} does not step the shell back a page`)
        } catch (error) { faults.push(error.message) }
      }
      if (errors.length) faults.push(`${name}: page errors: ${errors.join('; ')}`)
    } finally { await browser.close() }
  }
} finally { server.close() }

if (faults.length) { console.error(JSON.stringify({ok: false, faults}, null, 2)); process.exit(1) }
console.log(JSON.stringify({ok: true, engines: ['webkit', 'chromium'], checks: 4}))
