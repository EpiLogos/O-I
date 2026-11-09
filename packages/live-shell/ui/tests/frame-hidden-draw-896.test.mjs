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

// O-I #747 round 896 1V, F1 and F3 (DLW build ruling 2026-11-09, review of 24b62a75 F1 and F3): a hidden field keeps playing, and only its
// drawing stops. The engine advanced inside its render, and the render waited on a drawn step, so under a Session or Arrangement view the
// field's physics, its automation ramps and the contacts behind "Collisions strike" stood still while the transport went on (in WebKit, new
// with item 3; in Chromium, since the clock first stepped on a timer). And a film being recorded drew hidden only where the engine ran an
// animation frame for a hidden frame (WebKit), stalling in Chromium.
// Channel: LAID OUT, in Chromium and WebKit, as above: the shell's page, the frame mounted by the boundary's own mount (REAL) at its own
// origin, the frame's native channel (channel.ts, REAL) telling it hidden and shown, its clock (controller.ts frameClock, REAL, with the
// film's `filming`), the step's rule (controller.ts fieldStep, REAL, which app.ts tick asks: pinned in janko-keys-853) and the field's
// engine (production.ts ProductionAdapter over PointCloudField, REAL, WebGL: SwiftShader in Chromium) with a ramp fired and Collisions
// strike On. Counted on the engine itself: its steps (PointCloudField.advance), its draws (its present), its time, the ramp's progress and
// the contacts it read back; and on its WebGL context, the draws it queues, while the fences it polls can be made to read as unpassed.
const FIELD_FRAME = `
import {NativeChannel} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/channel'
import {fieldStep, frameClock} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/controller'
import {ProductionAdapter} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/production'
import {blankJourney, chakraEntities} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model'
import {defaultCamera} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/camera'
const canvas = document.createElement('canvas'); document.body.append(canvas)
const scene = blankJourney().scenes[0]
scene.entities = chakraEntities()
scene.field.params.count = 2048
scene.engine.pairwiseEnabled = true
scene.composition.collisionsStrike = true
scene.automation = [{id: 'ramp', enabled: true, target: 'field.size', type: 'ramp', wave: 'smooth', min: .5, max: 2, rate: .1, phase: 0,
  blend: 'replace', duration: 60, delay: 0, loop: 'once', firedAt: null}]
const engine = new ProductionAdapter(canvas) as any
engine.resize(160, 120, 1)
const at = (delta: number) => ({scene, simTime: 0, delta, params: scene.field.params, camera: defaultCamera(), pointer: {active: false, world: {x: 0, y: 0, z: 0}}, selectedIds: []})
const counts = {stepped: 0, advanced: 0, presented: 0, gpuWork: 0, simTime: 0, ramp: -1, contactsBack: 0, contactsRead: 0, caughtUp: -1,
  errors: [] as string[]}
// The field's time when the GPU caught up, until the first step after it moves the field: that step's move is then counted (caughtUp).
let releasedAt: number | null = null
engine.render(at(0))
// The engine's own context, made by its first render (getContext hands back the one three.js made). Its draws are the GPU work it
// queues; while busy, every fence the engine polls reads as not yet passed, as on a GPU still at work on the steps queued before.
const gl = canvas.getContext('webgl2') as any
let busy = false
const polled = gl.clientWaitSync.bind(gl)
gl.clientWaitSync = (sync: unknown, flags: number, timeout: number) => busy ? gl.TIMEOUT_EXPIRED : polled(sync, flags, timeout)
for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
  const queue = gl[name].bind(gl); gl[name] = (...args: unknown[]) => { counts.gpuWork++; return queue(...args) }
}
engine.command({type: 'fire-automation', id: 'ramp'})
const field = engine.engine
const advance = field.advance.bind(field), present = field.presentScene.bind(field)
field.advance = (delta: number, draw?: boolean) => { counts.advanced++; return advance(delta, draw) }
field.presentScene = () => { counts.presented++; return present() }
let surfaceShown = true, filming = false, last = performance.now()
const channel = new NativeChannel()
const clock = frameClock({shown: () => surfaceShown && !document.hidden, filming: () => filming, now: () => performance.now(),
  frame: step => requestAnimationFrame(step), cancelFrame: id => cancelAnimationFrame(id), timer: (step, ms) => window.setTimeout(step, ms),
  cancelTimer: id => clearTimeout(id)}, (now, drawn) => {
  counts.stepped++
  const delta = Math.min(Math.max(0, (now - last) / 1000), .05); last = now
  try {
    // As app.ts tick: a draw while the surface is hidden (a film's) is taken undrawn while the GPU is still on the last step.
    const does = fieldStep({due: true, drawn: drawn && !(!surfaceShown && engine.gpuBehind()), paced: true, moving: delta > 0})
    if (does) engine.render(at(delta), does === 'draw')
    const taken = engine.takeContacts()
    if (taken) { counts.contactsBack = taken.counts.back; counts.contactsRead = taken.counts.read }
    const telemetry = engine.telemetry()
    counts.simTime = telemetry?.simTime ?? 0
    if (releasedAt !== null && counts.simTime > releasedAt) { counts.caughtUp = counts.simTime - releasedAt; releasedAt = null }
    counts.ramp = telemetry?.live?.find((lane: {id: string}) => lane.id === 'ramp')?.phase ?? -1
  } catch (error) { if (counts.errors.length < 3) counts.errors.push(String(error)) }
})
channel.onVisibility = shown => { if (surfaceShown === shown) return; surfaceShown = shown; clock.moved() }
clock.start()
window.addEventListener('message', event => {
  if (event.source !== window.parent) return
  if (event.data?.kind === 'film') { filming = event.data.on === true; clock.moved(); return }
  if (event.data?.kind === 'gpu') { busy = event.data.busy === true; if (!busy) releasedAt = counts.simTime; return }
  if (event.data?.kind !== 'draw-read') return
  window.parent.postMessage({kind: 'draw-count', ...counts, errors: counts.errors.slice()}, '*')
})
`

test('1V F1 and F3: hidden, the field\'s engine steps on (physics, a ramp, the contacts it reads back) and draws nothing; shown, it draws; a film draws hidden in both engines', {timeout: 600_000}, async t => {
  const harness = await import('./support/agentShellHarness.mjs')
  const shell = await harness.bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'field-hidden-stage.tsx', outfile: 'field-hidden-stage.mjs'})
  const frame = await harness.bundleEntry({contents: FIELD_FRAME, resolveDir: ui, sourcefile: 'field-hidden-frame.tsx', outfile: 'field-hidden-frame.mjs'})
  const page = js => `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">${harness.inlineModuleSafe(js)}</script></body></html>`
  const shellPage = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><main id="workbench"><div id="pane">
    <div id="residence" style="width:480px;height:320px"></div></div></main><script type="module">${harness.inlineModuleSafe(shell.js)}</script></body></html>`
  const read = {}
  for (const engine of ['chromium', 'webkit']) {
    let browser
    try {
      browser = await harness.playwright()[engine].launch(engine === 'chromium' ? {args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']} : {})
    } catch (error) {
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
      await tab.waitForFunction(async () => ((await window.__read())?.stepped ?? 0) > 5, null, {timeout: 120_000, polling: 500})
      const film = on => tab.evaluate(on => window.__mounted.frame.contentWindow.postMessage({kind: 'film', on}, new URL(window.__mounted.frame.src).origin), on)
      const span = async (ms = 2000) => {
        await tab.waitForTimeout(500)
        const before = await tab.evaluate(() => window.__read())
        await tab.waitForTimeout(ms)
        const after = await tab.evaluate(() => window.__read())
        assert.ok(before && after, `${engine}: the frame answered its count`)
        return {stepped: after.stepped - before.stepped, advanced: after.advanced - before.advanced, presented: after.presented - before.presented,
          gpuWork: after.gpuWork - before.gpuWork, caughtUp: after.caughtUp,
          simTime: after.simTime - before.simTime, ramp: [before.ramp, after.ramp], contactsBack: after.contactsBack - before.contactsBack,
          contactsRead: after.contactsRead - before.contactsRead, errors: after.errors}
      }
      const shown = await span()
      await tab.evaluate(() => { document.getElementById('workbench').style.display = 'none' })
      const hidden = await span()
      // The GPU still at work on the last step: hidden, the engine queues nothing more and its time is held; then the GPU catches up.
      const gpu = busy => tab.evaluate(busy => window.__mounted.frame.contentWindow.postMessage({kind: 'gpu', busy}, new URL(window.__mounted.frame.src).origin), busy)
      await gpu(true)
      const held = await span()
      await gpu(false)
      const caught = await span()
      await tab.evaluate(() => { document.getElementById('workbench').style.display = '' })
      const back = await span()
      await film(true)
      await tab.evaluate(() => { document.getElementById('workbench').style.display = 'none' })
      const filmed = await span()
      await gpu(true)
      const filmHeld = await span()
      await gpu(false)
      const filmCaught = await span()
      await film(false)
      const filmEnded = await span()
      await tab.evaluate(() => { document.getElementById('workbench').style.display = '' })
      console.log(engine, JSON.stringify({shown, hidden, held, caught, back, filmed, filmHeld, filmCaught, filmEnded}))
      read[engine] = {errors, shown, hidden, held, caught, back, filmed, filmHeld, filmCaught, filmEnded}
      await context.close()
    } finally { await browser.close() }
  }
  if (!Object.keys(read).length) { t.skip('no browser to mount the frame in'); return }
  for (const [engine, {errors, shown, hidden, held, caught, back, filmed, filmHeld, filmCaught, filmEnded}] of Object.entries(read)) {
    assert.deepEqual(errors, [], `${engine}: no page error`)
    assert.deepEqual(hidden.errors, [], `${engine}: the engine stepped without an error`)
    assert.ok(shown.presented >= 5 && shown.advanced >= 5, `${engine}: shown, the field steps and draws (${shown.advanced} steps, ${shown.presented} draws)`)
    // F1: hidden, the field plays on and nothing is drawn.
    assert.equal(hidden.presented, 0, `${engine}: hidden, nothing is drawn (${hidden.presented} draws in 2 s)`)
    assert.ok(hidden.advanced >= 10, `${engine}: hidden, the engine steps on (${hidden.advanced} steps in 2 s)`)
    assert.ok(hidden.simTime > .2, `${engine}: hidden, the field's time goes on (${hidden.simTime.toFixed(3)} s)`)
    assert.ok(hidden.ramp[0] >= 0 && hidden.ramp[1] > hidden.ramp[0], `${engine}: hidden, the ramp goes on (${hidden.ramp.join(' → ')})`)
    // Each read waits on the last one's fence, so SwiftShader (Chromium here) reads back about one step in eight; the Mac's GPU, each step.
    assert.ok(hidden.contactsBack >= 1, `${engine}: hidden, the contacts are read back (${hidden.contactsRead} read, ${hidden.contactsBack} back)`)
    // Paced by the GPU: an undrawn step whose last step is still on the GPU queues nothing and owes its time to the next. Unpaced, under
    // load the timer's steps queued work faster than SwiftShader ran it (Chromium), and shown again the page drew nothing while it drained.
    assert.ok(held.stepped >= 10, `${engine}: the GPU still at work, the clock steps on (${held.stepped})`)
    assert.equal(held.gpuWork, 0, `${engine}: the GPU still at work, a hidden step queues nothing more (${held.gpuWork} draws queued)`)
    assert.equal(held.simTime, 0, `${engine}: and the field's time is held (${held.simTime})`)
    assert.ok(caught.gpuWork > 0 && caught.simTime > .2, `${engine}: the GPU caught up, the field steps on (${caught.gpuWork} draws, ${caught.simTime.toFixed(3)} s)`)
    // Each of the frame's steps moves at most .05 s; the first step after the hold takes the time held too, up to the engine's .1 s.
    assert.ok(caught.caughtUp > .075, `${engine}: the first step after the hold takes the time held (${caught.caughtUp.toFixed(3)} s)`)
    assert.ok(back.presented >= 5, `${engine}: shown again, it draws again (${back.presented})`)
    // F3: a film being recorded draws hidden, by the animation frame (WebKit) or by the timer (Chromium); its end lets the drawing go.
    // On the timer each draw waits on the GPU (below), so SwiftShader under load draws a few a second; the Mac's GPU, each step.
    assert.ok(filmed.presented >= 3, `${engine}: hidden while a film is recorded, the field draws (${filmed.presented} in 2 s)`)
    // No animation frame paces a film's hidden draw on the timer: while the GPU is still on the last step, it draws and queues nothing.
    assert.ok(filmHeld.stepped >= 10, `${engine}: filming, the GPU still at work, the clock steps on (${filmHeld.stepped})`)
    assert.equal(filmHeld.presented, 0, `${engine}: filming, the GPU still at work, nothing is drawn (${filmHeld.presented})`)
    assert.equal(filmHeld.gpuWork, 0, `${engine}: and nothing more is queued (${filmHeld.gpuWork} draws)`)
    assert.ok(filmCaught.presented >= 3, `${engine}: filming, the GPU caught up, the field draws again (${filmCaught.presented})`)
    assert.equal(filmEnded.presented, 0, `${engine}: the film ended, hidden draws nothing again (${filmEnded.presented})`)
    assert.ok(filmEnded.advanced >= 10, `${engine}: and steps on (${filmEnded.advanced})`)
  }
})
