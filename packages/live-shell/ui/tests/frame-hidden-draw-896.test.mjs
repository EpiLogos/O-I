// O-I #747 round 896, item 3 (DLW build ruling 2026-11-09): the frame stops drawing while it is not displayed. The host told the frame
// its surface was shown whenever the open work was presented (`isPresented`, the panel's workPresented), and a Session or Arrangement view
// of the work's own sources presents it while the frame's residence is shown none. Told shown there, the frame drew about 60 frames a
// second that no one saw in WebKit (the Mac's webview runs a hidden cross-origin frame's animation frames), and in Chromium, which runs
// none for it, the clock that waited on one stopped. Now the host says shown only while the frame itself is drawn on the page, and says
// so again when its box goes to none or comes back (host.ts `shown`, its box watch).
// Channel: LAID OUT, in Chromium and in WebKit: the shell's page at the shell's origin as Tauri serves it on Windows, the frame mounted
// by the boundary's own mount (host.ts mountExpressionsApplication, REAL) at an origin of its own, as the native host gives it; the
// frame's page runs the frame's own native channel (channel.ts NativeChannel, REAL) and clock (controller.ts frameClock, REAL), wired as
// the application wires them (app.ts sceneClock `shown` from the controller's surfaceShown, which its port's onVisibility sets, and
// onSurface → sceneClock.moved(): CODE-READING, pinned in transport.test.mjs). Counted: the clock's steps and the steps it drew.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'

const ui = fileURLToPath(new URL('..', import.meta.url))
const SHELL = 'http://tauri.localhost'
const FRAME_AT = 'http://oi-material.localhost/__application/expressions/index.html'

const STAGE = `
import {mountExpressionsApplication} from '../../expressions-boundary/src/host'
const w = window as any
w.__workPresented = true
w.__mount = (entry: string) => {
  w.__mounted = mountExpressionsApplication(document.getElementById('residence')!, entry + '?mode=expressions',
    {bindingId: 'world.expressions', owners: {channels: {}}, mode: 'expressions', isPresented: () => w.__workPresented, handshakeTimeoutMs: 600000})
}
// The frame's count, or null when no answer came within a second (an ask posted before the frame's page loaded is lost).
w.__read = () => new Promise(resolve => {
  const done = (value: unknown) => { clearTimeout(timer); window.removeEventListener('message', heard); resolve(value) }
  const heard = (event: MessageEvent) => { if (event.data?.kind === 'draw-count') done(event.data) }
  const timer = setTimeout(() => done(null), 1000)
  window.addEventListener('message', heard)
  w.__mounted.frame.contentWindow.postMessage({kind: 'draw-read'}, new URL(w.__mounted.frame.src).origin)
})
w.__ready = true
`
const FRAME = `
import {NativeChannel} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/channel'
import {frameClock} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/controller'
const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64; document.body.append(canvas)
const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
const counts = {stepped: 0, drawn: 0, told: [] as boolean[]}
let surfaceShown = true
const channel = new NativeChannel()
const clock = frameClock({shown: () => surfaceShown && !document.hidden, now: () => performance.now(), frame: step => requestAnimationFrame(step),
  cancelFrame: id => cancelAnimationFrame(id), timer: (step, ms) => window.setTimeout(step, ms), cancelTimer: id => clearTimeout(id)}, (_now, drawn) => {
  counts.stepped++
  if (!drawn) return
  counts.drawn++
  if (gl) { gl.clearColor(counts.drawn % 2, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT) }
})
channel.onVisibility = shown => { counts.told.push(shown); if (surfaceShown === shown) return; surfaceShown = shown; clock.moved() }
clock.start()
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data?.kind !== 'draw-read') return
  window.parent.postMessage({kind: 'draw-count', stepped: counts.stepped, drawn: counts.drawn, told: counts.told.slice()}, '*')
})
`

test('item 3: the frame draws while it is shown, stops drawing while its residence is shown none, and its clock goes on', {timeout: 300_000}, async t => {
  const harness = await import('./support/agentShellHarness.mjs')
  const shell = await harness.bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'frame-hidden-stage.tsx', outfile: 'frame-hidden-stage.mjs'})
  const frame = await harness.bundleEntry({contents: FRAME, resolveDir: ui, sourcefile: 'frame-hidden-frame.tsx', outfile: 'frame-hidden-frame.mjs'})
  const page = js => `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">${harness.inlineModuleSafe(js)}</script></body></html>`
  const shellPage = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><main id="workbench"><div id="pane">
    <div id="residence" style="width:480px;height:320px"></div></div></main><script type="module">${harness.inlineModuleSafe(shell.js)}</script></body></html>`
  const read = {}
  for (const engine of ['chromium', 'webkit']) {
    let browser
    try { browser = await harness.playwright()[engine].launch() } catch (error) {
      if (process.env.CI && engine === 'chromium') throw error
      console.log(`no ${engine}: ${String(error?.message ?? error).split('\n')[0]}`); continue
    }
    try {
      const context = await browser.newContext({viewport: {width: 900, height: 700}})
      await context.route('http://*.localhost/**', route => {
        const url = new URL(route.request().url())
        if (url.origin === SHELL && url.pathname === '/app/index.html') return route.fulfill({contentType: 'text/html', body: shellPage})
        if (url.pathname === '/__application/expressions/index.html') return route.fulfill({contentType: 'text/html', body: page(frame.js)})
        return route.fulfill({status: 404, body: 'not here'})
      })
      const tab = await context.newPage()
      const errors = []
      tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
      await tab.goto(`${SHELL}/app/index.html`)
      await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000})
      await tab.evaluate(entry => window.__mount(entry), FRAME_AT)
      await tab.waitForFunction(() => window.__mounted?.frame.contentWindow, null, {timeout: 60_000})
      // Over a span, after the standing has settled: how many steps the clock took, and how many of them drew.
      const span = async (ms = 1500) => {
        await tab.waitForTimeout(400)
        const before = await tab.evaluate(() => window.__read())
        await tab.waitForTimeout(ms)
        const after = await tab.evaluate(() => window.__read())
        assert.ok(before && after, `${engine}: the frame answered its count`)
        return {stepped: after.stepped - before.stepped, drawn: after.drawn - before.drawn, told: after.told}
      }
      await tab.waitForFunction(async () => ((await window.__read())?.told.length ?? 0) > 0, null, {timeout: 60_000, polling: 200})
      const shown = await span()
      // A Session view over Pane view: the panes stand shown none, while the open work stays presented for its acts (workPresented).
      await tab.evaluate(() => { document.getElementById('workbench').style.display = 'none' })
      const setView = await span()
      await tab.evaluate(() => { document.getElementById('workbench').style.display = '' })
      const back = await span()
      // A tab over the field: its residence hidden in the pane.
      await tab.evaluate(() => { document.getElementById('pane').hidden = true })
      const tabOver = await span()
      await tab.evaluate(() => { document.getElementById('pane').hidden = false })
      const again = await span()
      console.log(engine, JSON.stringify({shown, setView, back, tabOver, again}))
      read[engine] = {errors, shown, setView, back, tabOver, again}
      await context.close()
    } finally { await browser.close() }
  }
  if (!Object.keys(read).length) { t.skip('no browser to mount the frame in'); return }
  // Each engine read first, then judged: WebKit (the Mac's webview) and Chromium (Windows's) fail differently.
  for (const [engine, {errors, shown, setView, back, tabOver, again}] of Object.entries(read)) {
    assert.deepEqual(errors, [], `${engine}: no page error`)
    assert.ok(shown.drawn >= 10, `${engine}: shown, the frame draws (${shown.drawn} in 1.5 s)`)
    for (const [name, hidden] of [['set view over the panes', setView], ['tab over the field', tabOver]]) {
      assert.equal(hidden.drawn, 0, `${engine}: ${name}: shown none, the frame draws nothing (${hidden.drawn} in 1.5 s)`)
      assert.ok(hidden.stepped >= 10, `${engine}: ${name}: and its clock goes on, on its timer (${hidden.stepped} steps in 1.5 s)`)
    }
    assert.ok(back.drawn >= 10 && again.drawn >= 10, `${engine}: shown again, it draws again (${back.drawn}, ${again.drawn})`)
    assert.deepEqual(again.told.filter((v, i, all) => i === 0 || all[i - 1] !== v), [true, false, true, false, true],
      `${engine}: the host said each change once it happened: ${JSON.stringify(again.told)}`)
  }
})
