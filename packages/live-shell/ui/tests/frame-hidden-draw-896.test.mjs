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
// A hidden wake's spread over tasks, as the frame recorded it (1T.2 item 22(c)); null when no answer came within two minutes.
w.__wake = () => new Promise(resolve => {
  const done = (value: unknown) => { clearTimeout(timer); window.removeEventListener('message', heard); resolve(value) }
  const heard = (event: MessageEvent) => { if (event.data?.kind === 'wake-count') done(event.data) }
  const timer = setTimeout(() => done(null), 120000)
  window.addEventListener('message', heard)
  w.__mounted.frame.contentWindow.postMessage({kind: 'wake'}, new URL(w.__mounted.frame.src).origin)
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
  window.parent.postMessage({kind: 'draw-count', stepped: counts.stepped, drawn: counts.drawn, told: counts.told.slice(), at: performance.now()}, '*')
})
`

test('item 3: the frame draws while it is shown, stops drawing while its residence is shown none, and its clock goes on', {timeout: 300_000}, async t => {
  const harness = await import('./support/agentShellHarness.mjs')
  const shell = await harness.bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'frame-hidden-stage.tsx', outfile: 'frame-hidden-stage.mjs'})
  const frame = await harness.bundleEntry({contents: FRAME, resolveDir: ui, sourcefile: 'frame-hidden-frame.tsx', outfile: 'frame-hidden-frame.mjs'})
  const page = js => `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">${harness.inlineModuleSafe(js)}</script></body></html>`
  const shellPage = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0"><main id="workbench"><div id="pane">
    <div id="residence" style="width:480px;height:320px"></div></div></main><script type="module">${harness.inlineModuleSafe(shell.js)}</script></body></html>`
  // What a span waits for, and what it is judged by: ten frames drawn, or ten steps of the clock.
  const draws = d => d.drawn >= 10, steps = d => d.stepped >= 10
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
      // Over a span, after the standing has settled: how many steps the clock took, and how many of them drew. A span counts for 1.5 s
      // and then until what it judges has come, within a bound (1T.0, the lead's #956 CI item 1): how many frames or timer fires a window
      // holds is a loaded runner's pace, not the frame's rule. A shown-none span draws nothing over all of it, however long it ran.
      const span = async (until, ms = 1500) => {
        await tab.waitForTimeout(400)
        const before = await tab.evaluate(() => window.__read())
        await tab.waitForTimeout(ms)
        let after = await tab.evaluate(() => window.__read())
        assert.ok(before && after, `${engine}: the frame answered its count`)
        const counted = () => ({stepped: after.stepped - before.stepped, drawn: after.drawn - before.drawn, told: after.told, ms: Math.round(after.at - before.at)})
        for (const end = Date.now() + 120_000; !until(counted()) && Date.now() < end;) {
          await tab.waitForTimeout(250)
          after = (await tab.evaluate(() => window.__read())) ?? after
        }
        return counted()
      }
      await tab.waitForFunction(async () => ((await window.__read())?.told.length ?? 0) > 0, null, {timeout: 60_000, polling: 200})
      const shown = await span(draws)
      // A Session view over Pane view: the panes stand shown none, while the open work stays presented for its acts (workPresented).
      await tab.evaluate(() => { document.getElementById('workbench').style.display = 'none' })
      const setView = await span(steps)
      await tab.evaluate(() => { document.getElementById('workbench').style.display = '' })
      const back = await span(draws)
      // A tab over the field: its residence hidden in the pane.
      await tab.evaluate(() => { document.getElementById('pane').hidden = true })
      const tabOver = await span(steps)
      await tab.evaluate(() => { document.getElementById('pane').hidden = false })
      const again = await span(draws)
      console.log(engine, JSON.stringify({shown, setView, back, tabOver, again}))
      read[engine] = {errors, shown, setView, back, tabOver, again}
      await context.close()
    } finally { await browser.close() }
  }
  if (!Object.keys(read).length) { t.skip('no browser to mount the frame in'); return }
  // Each engine read first, then judged: WebKit (the Mac's webview) and Chromium (Windows's) fail differently.
  for (const [engine, {errors, shown, setView, back, tabOver, again}] of Object.entries(read)) {
    assert.deepEqual(errors, [], `${engine}: no page error`)
    assert.ok(draws(shown), `${engine}: shown, the frame draws (${shown.drawn} in ${shown.ms} ms)`)
    for (const [name, hidden] of [['set view over the panes', setView], ['tab over the field', tabOver]]) {
      assert.equal(hidden.drawn, 0, `${engine}: ${name}: shown none, the frame draws nothing (${hidden.drawn} in ${hidden.ms} ms)`)
      assert.ok(steps(hidden), `${engine}: ${name}: and its clock goes on, on its timer (${hidden.stepped} steps in ${hidden.ms} ms)`)
    }
    assert.ok(draws(back) && draws(again), `${engine}: shown again, it draws again (${back.drawn} in ${back.ms} ms, ${again.drawn} in ${again.ms} ms)`)
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
// film's `filming`), the step's rule (controller.ts fieldStep, REAL, which app.ts tick asks: pinned in janko-keys-853), the shown-again
// watch (controller.ts shownAgainWatch, REAL, which app.ts tick calls: pinned in janko-keys-853; 1T.0 item 3) and the field's
// engine (production.ts ProductionAdapter over PointCloudField, REAL, WebGL: SwiftShader in Chromium) with a ramp fired and Collisions
// strike On. Counted on the engine itself: its steps (PointCloudField.advance), its draws (its present), its time, the ramp's progress and
// the contacts it read back; and on its WebGL context, the draws it queues, while the fences it polls can be made to read as unpassed.
// 1X (DLW build ruling 2026-11-09, #946 red on CI): an unpassed fence holds a step for GPU_WAIT_MS, doubled for each let go since one passed,
// to four at most; so while the fences read as unpassed the field steps at least once a second, each step its capped one. Counted on the
// engine too: the steps that moved its time and the longest one (`moved`, `leap`, since the last read), and the frame's time between reads.
// 1Z.2 (DLW build ruling 2026-11-09, #946's landing red on CI): and with the stub off, the step fences the engine polled and those its GPU
// had passed (`stepPolled`, `stepPassed`), so that the GPU is said to have caught up only where its own fences passed.
const FIELD_FRAME = `
import {NativeChannel} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/channel'
import {fieldStep, frameClock, hiddenFieldClock, shownAgainWatch} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/controller'
import {ProductionAdapter} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/production'
import {GPU_WAIT_MS, HIDDEN_OWED_MAX_S, HIDDEN_TASK_MS, HIDDEN_WAKE_MAX_S, STEP_MAX_S} from '../../../desktop/cradle/expressions-app/src/engine/PointCloudField'
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
const counts = {stepped: 0, advanced: 0, moved: 0, leap: 0, presented: 0, drawn: 0, copied: 0, gpuWork: 0, simTime: 0, ramp: -1, contactsBack: 0, contactsRead: 0,
  contactsWaited: 0, bound: GPU_WAIT_MS, at: 0, stepPolled: 0, stepPassed: 0, errors: [] as string[],
  // The hidden clock's (1T.0 item 2): the real time it was handed, what it owes, what it let go, its wakes and those the GPU gave back.
  handed: 0, owed: 0, letGo: 0, wakes: 0, gaveBack: 0, owedMax: HIDDEN_OWED_MAX_S, stepMax: STEP_MAX_S,
  // The trail of a draw counted in a hidden span (1T.2, gate 09 of 10 Nov: one in Chromium at a load of about 40, not explained): every
  // word the host said of the surface, with the frame's clock, and every draw step taken while told hidden with no film. The clock lets
  // its animation frame go when told hidden, so the second stays empty unless the browser ran a frame that was let go.
  told: [] as [number, boolean][], offDraws: [] as number[],
  // And the engine's (1T.0.1): what its wakes took on and have still to step, in the tasks after their own (PointCloudField stepWake).
  rest: 0, restMax: HIDDEN_WAKE_MAX_S}
let fieldTime = 0
engine.render(at(0))
// The engine's own context, made by its first render (getContext hands back the one three.js made). Its draws are the GPU work it
// queues; while busy, every fence the engine polls reads as not yet passed, as on a GPU still at work on the steps queued before. Not
// busy, each poll of the step's fence (gpuBehind) is counted, and counted passed where the GPU had passed it.
const gl = canvas.getContext('webgl2') as any
let busy = false
const polled = gl.clientWaitSync.bind(gl)
gl.clientWaitSync = (sync: unknown, flags: number, timeout: number) => {
  if (busy) return gl.TIMEOUT_EXPIRED
  const status = polled(sync, flags, timeout)
  if (sync === engine.engine.stepFence) {
    counts.stepPolled++
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) counts.stepPassed++
  }
  return status
}
for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
  const queue = gl[name].bind(gl); gl[name] = (...args: unknown[]) => { counts.gpuWork++; return queue(...args) }
}
engine.command({type: 'fire-automation', id: 'ramp'})
const field = engine.engine
const advance = field.advance.bind(field), present = field.presentScene.bind(field)
// Each of the engine's steps is counted, and the longest (its cap); a clock step that moved the field's time is counted once (moved),
// however many of the engine's capped steps its wake took (1T.0 item 2: the GPU paces a wake, not each step in it).
field.advance = (delta: number, draw?: boolean) => {
  counts.advanced++
  const time = advance(delta, draw)
  if (time > fieldTime) counts.leap = Math.max(counts.leap, time - fieldTime)
  fieldTime = time
  return time
}
field.presentScene = () => { counts.presented++; return present() }
let surfaceShown = true, filming = false, last = performance.now()
// While a wake's spread is pinned (wakePin, below), the clock's steps stand by: the pin's wakes are the only ones.
let pinning = false
const fieldShownAgain = shownAgainWatch()
const hiddenField = hiddenFieldClock()
const channel = new NativeChannel()
const clock = frameClock({shown: () => surfaceShown && !document.hidden, filming: () => filming, now: () => performance.now(),
  frame: step => requestAnimationFrame(step), cancelFrame: id => cancelAnimationFrame(id), timer: (step, ms) => window.setTimeout(step, ms),
  cancelTimer: id => clearTimeout(id)}, (now, drawn) => {
  counts.stepped++
  if (pinning) return
  // As app.ts tick (1T.0 item 2; #956's CI): shown, a step's time is a frame's, clamped; not shown and on the timer, the hidden clock's
  // (controller.ts hiddenFieldClock, REAL): the time elapsed is owed, and a wake steps it in the engine's capped steps (stepHidden). The
  // document stays shown here, so the field under its hidden surface plays on whatever its sound.
  const elapsed = Math.max(0, (now - last) / 1000); last = now
  const fieldVisible = surfaceShown && !document.hidden, hiddenStep = !fieldVisible && !drawn
  if (fieldVisible) hiddenField.shown(elapsed - Math.min(elapsed, .05))
  const letGo = hiddenField.skipped, was = fieldTime
  const delta = hiddenStep ? hiddenField.step(elapsed, true) : Math.min(elapsed, .05)
  if (hiddenStep) counts.handed += elapsed
  try {
    // As app.ts tick, by its own watch: shown again, the field draws before it steps any time held while hidden (1T item 23; 1T.0 item 3).
    fieldShownAgain(fieldVisible, engine)
    // As app.ts tick: a draw while the surface is hidden (a film's) is taken undrawn while the GPU is still on the last step.
    const fieldDrawn = drawn && !(!surfaceShown && engine.gpuBehind())
    const does = fieldStep({due: true, drawn: fieldDrawn, paced: true, moving: delta > 0})
    if (does && hiddenStep && does === 'advance') {
      const stepped = engine.stepHidden(at(delta), delta)
      hiddenField.gaveBack(delta - stepped)
      counts.wakes++
      if (!(stepped > 0)) counts.gaveBack++
    } else if (does) engine.render(at(delta), does === 'draw')
    if (fieldTime > was) counts.moved++
    counts.owed = hiddenField.owed; counts.letGo += hiddenField.skipped - letGo; counts.rest = field.wakeRest ?? 0
    if (does === 'draw') counts.drawn++
    if (does === 'draw' && !surfaceShown && !filming && counts.offDraws.length < 40) counts.offDraws.push(Math.round(now))
    // As app.ts tick: a film takes its clean frame (which presents the scene again) only where the field was drawn (1W item 1).
    if (filming && fieldDrawn) engine.withCleanFrame(() => { counts.copied++ })
    const taken = engine.takeContacts()
    if (taken) { counts.contactsBack = taken.counts.back; counts.contactsRead = taken.counts.read; counts.contactsWaited = taken.counts.waited }
    const telemetry = engine.telemetry()
    counts.simTime = telemetry?.simTime ?? 0
    counts.ramp = telemetry?.live?.find((lane: {id: string}) => lane.id === 'ramp')?.phase ?? -1
  } catch (error) { if (counts.errors.length < 3) counts.errors.push(String(error)) }
})
channel.onVisibility = shown => {
  if (counts.told.length < 40) counts.told.push([Math.round(performance.now()), shown])
  if (surfaceShown === shown) return; surfaceShown = shown; clock.moved()
}
clock.start()
// 1T.2 item 22(c) (DLW build ruling 2026-11-10; review 956c N2): a wake's spread over tasks, on the browser's own GPU and event loop
// (janko-keys-853 pins it on a stand-in GPU and a logical clock). The frame's clock stands by (pinning) while a wake of the whole bound
// is stepped through the adapter, as the tick steps it. Each task that steps is recorded: what the engine's own clock read as each step
// was started (wallNow, which its budget reads), and the task's length. Each step is made to hold the thread WAKE_STEP_COST_MS, as a
// slower GPU's would, so the budget is reached within a task on any GPU and at any clock's resolution (WebKit's is 1 ms). The task the
// engine queues is held back once, so that a second wake comes while the first's rest is still to step: the bound says what it takes.
const WAKE_STEP_COST_MS = 2
const turn = (ms: number) => new Promise<void>(resolve => { window.setTimeout(resolve, ms) })
const until = async (done: () => boolean, ms: number) => {
  for (const end = performance.now() + ms; !done() && performance.now() < end;) await turn(4)
  return done()
}
async function wakePin() {
  type Task = {later: boolean, steps: number[], ms: number}
  const tasks: Task[] = []
  let open: Task | null = null, lastRead = 0, held: (() => void)[] | null = []
  const clockRead = field.wallNow, stepping = field.advance, posting = field.postTask
  const inTask = (later: boolean, run: () => void) => {
    const task: Task = {later, steps: [], ms: 0}
    tasks.push(task); open = task
    const from = performance.now()
    try { run() } finally { task.ms = performance.now() - from; open = null }
  }
  // The wakes before are stepped out, and the GPU has caught up or its fence has stood its wait: the wake is not given back.
  const steppedOut = () => until(() => !(field.wakeRest > 0) && !field.wakeQueued, 30000)
  const caughtUp = () => until(() => !field.gpuBehind(), 30000)
  pinning = true
  try {
    const settled = await steppedOut()
    gl.finish()
    await turn(0)
    const ready = await caughtUp()
    field.wallNow = () => (lastRead = clockRead())
    field.advance = (delta: number, draw?: boolean) => {
      open?.steps.push(lastRead)
      for (const from = performance.now(); performance.now() - from < WAKE_STEP_COST_MS;) { /* the step's cost */ }
      return stepping(delta, draw)
    }
    field.postTask = (run: () => void) => { const task = () => inTask(true, run); if (held) held.push(task); else posting.call(field, task) }
    const simFrom = field.simTime
    let taken = 0, again = 0
    inTask(false, () => { taken = engine.stepHidden(at(HIDDEN_WAKE_MAX_S), HIDDEN_WAKE_MAX_S) })
    const rest = field.wakeRest, queued = held.length
    // The second wake, the first's rest still queued.
    const readyAgain = await caughtUp()
    const restBefore = field.wakeRest
    inTask(false, () => { again = engine.stepHidden(at(HIDDEN_WAKE_MAX_S), HIDDEN_WAKE_MAX_S) })
    const restAfter = field.wakeRest, queuedAfter = held.length
    const waiting = held
    held = null
    for (const task of waiting) posting.call(field, task)
    const stepped = await steppedOut()
    return {settled, ready, readyAgain, stepped, taken, rest, queued, again, restBefore, restAfter, queuedAfter, left: field.wakeRest,
      simTime: field.simTime - simFrom, tasks: tasks.map(({later, steps, ms}) => ({later, ms, steps: steps.map(read => read - steps[0])})),
      budget: HIDDEN_TASK_MS, cost: WAKE_STEP_COST_MS, stepMax: STEP_MAX_S, wakeMax: HIDDEN_WAKE_MAX_S}
  } finally {
    field.wallNow = clockRead; field.advance = stepping; field.postTask = posting
    last = performance.now(); pinning = false
  }
}
window.addEventListener('message', event => {
  if (event.source !== window.parent) return
  if (event.data?.kind === 'film') { filming = event.data.on === true; clock.moved(); return }
  if (event.data?.kind === 'gpu') { busy = event.data.busy === true; return }
  if (event.data?.kind === 'wake') {
    wakePin().then(wake => window.parent.postMessage({kind: 'wake-count', ...wake}, '*'), error => window.parent.postMessage({kind: 'wake-count', failed: String(error)}, '*'))
    return
  }
  if (event.data?.kind !== 'draw-read') return
  window.parent.postMessage({kind: 'draw-count', ...counts, shown: surfaceShown, at: performance.now(), errors: counts.errors.slice()}, '*')
  counts.leap = 0
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
      const counted = (before, after, leap) => ({stepped: after.stepped - before.stepped, advanced: after.advanced - before.advanced,
        presented: after.presented - before.presented, drawn: after.drawn - before.drawn, copied: after.copied - before.copied,
        gpuWork: after.gpuWork - before.gpuWork, moved: after.moved - before.moved, leap, ms: after.at - before.at, bound: after.bound,
        from: Math.round(before.at), to: Math.round(after.at), told: after.told, offDraws: after.offDraws,
        simTime: after.simTime - before.simTime, ramp: [before.ramp, after.ramp], contactsBack: after.contactsBack - before.contactsBack,
        contactsRead: after.contactsRead - before.contactsRead, contactsWaited: after.contactsWaited - before.contactsWaited,
        stepPolled: after.stepPolled - before.stepPolled, stepPassed: after.stepPassed - before.stepPassed, errors: after.errors,
        handed: after.handed - before.handed, owedBefore: before.owed, owed: after.owed, letGo: after.letGo - before.letGo,
        wakes: after.wakes - before.wakes, gaveBack: after.gaveBack - before.gaveBack, owedMax: after.owedMax, stepMax: after.stepMax,
        restBefore: before.rest ?? 0, rest: after.rest ?? 0, restMax: after.restMax})
      // A span counts for 2 s and then until what it waits for has come (1T.0 item 8; review 956b: a 2 s window fails under load on any
      // engine, and on CI's SwiftShader runner the shown spans draw 6 or 7 frames in it). How much comes in a window is the GPU's pace
      // there, not the engine's rule, so a span ends on what it counts, within a bound no run that keeps the rule nears; the bounded
      // pace is judged on the span's own length. The longest step is the longest of every read's (each read starts it again).
      const span = async (until = () => true, ms = 2000) => {
        await tab.waitForTimeout(500)
        const before = await tab.evaluate(() => window.__read())
        await tab.waitForTimeout(ms)
        let after = await tab.evaluate(() => window.__read())
        assert.ok(before && after, `${engine}: the frame answered its count`)
        let leap = after.leap
        for (const end = Date.now() + 120_000; !until(counted(before, after, leap)) && Date.now() < end;) {
          await tab.waitForTimeout(250)
          const next = await tab.evaluate(() => window.__read())
          if (next) { after = next; leap = Math.max(leap, next.leap) }
        }
        return counted(before, after, leap)
      }
      // What each span waits for: what its judgement below counts.
      const drawsOn = d => d.presented >= 1
      const contactsAtCap = d => d.contactsBack >= 1 && d.contactsWaited >= 1 && d.presented >= 1
      // Hidden, a span waits for a second of the real time the hidden clock was handed, however few timer steps brought it (1T.0 item 2).
      const stepsOn = d => d.handed >= 1 && d.moved >= 1 && d.contactsBack >= 1 && d.ramp[1] > d.ramp[0]
      const boundedOn = d => d.stepped >= 10 && d.moved >= 1 && d.contactsRead >= 1 && d.contactsBack >= 1
      const caughtUp = d => d.moved >= 1 && d.gpuWork > 0
      const filmDraws = d => d.presented >= 1 && d.copied >= 1
      const filmBounded = d => d.stepped >= 10 && d.drawn >= 1 && d.contactsRead >= 1 && d.contactsBack >= 1
      const filmCaughtUp = d => d.drawn >= 1
      const stepsHidden = d => d.handed >= 1 && d.moved >= 1
      // Shown again, the span is timed from the first shown-again draw (the receipt's PROPOSE 2): that draw is an event, and how soon it
      // comes is the GPU's backlog under load, which item 23 does not judge here.
      const drawnAgain = async () => {
        const at = (await tab.evaluate(() => window.__read()))?.presented ?? 0
        await tab.waitForFunction(async at => ((await window.__read())?.presented ?? 0) > at, at, {timeout: 120_000, polling: 100})
      }
      // The GPU still at work on the last step, its fences never passing (the frame's stub).
      const gpu = busy => tab.evaluate(busy => window.__mounted.frame.contentWindow.postMessage({kind: 'gpu', busy}, new URL(window.__mounted.frame.src).origin), busy)
      // The workbench shown or hidden, and a span read only once the frame has been told so: under load the host's word can land after
      // the span's settle, and the span would count steps of the standing before (a draw in "hidden").
      const showing = async on => {
        await tab.evaluate(on => { document.getElementById('workbench').style.display = on ? '' : 'none' }, on)
        await tab.waitForFunction(async on => (await window.__read())?.shown === on, on, {timeout: 60_000, polling: 100})
      }
      const shown = await span(drawsOn)
      // 1Z.1 item 2: shown, the fences never passing.
      await gpu(true)
      const shownHeld = await span(contactsAtCap)
      await gpu(false)
      await showing(false)
      const hidden = await span(stepsOn)
      // The fences never passing: hidden, the engine steps on its bounded wait; then the GPU catches up.
      await gpu(true)
      const held = await span(boundedOn)
      await gpu(false)
      const caught = await span(caughtUp)
      await showing(true)
      await drawnAgain()
      const back = await span(drawsOn)
      await film(true)
      await showing(false)
      const filmed = await span(filmDraws)
      await gpu(true)
      const filmHeld = await span(filmBounded)
      await gpu(false)
      const filmCaught = await span(filmCaughtUp)
      await film(false)
      const filmEnded = await span(stepsHidden)
      // 1T.2 item 22(c): hidden still and no film, a wake of the whole bound and a second while its rest is queued, each task recorded.
      const wake = await tab.evaluate(() => window.__wake())
      await showing(true)
      console.log(engine, JSON.stringify({shown, shownHeld, hidden, held, caught, back, filmed, filmHeld, filmCaught, filmEnded}))
      console.log(engine, 'wake', JSON.stringify(wake))
      read[engine] = {errors, shown, shownHeld, hidden, held, caught, back, filmed, filmHeld, filmCaught, filmEnded, wake}
      await context.close()
    } finally { await browser.close() }
  }
  if (!Object.keys(read).length) { t.skip('no browser to mount the frame in'); return }
  for (const [engine, {errors, shown, shownHeld, hidden, held, caught, back, filmed, filmHeld, filmCaught, filmEnded, wake}] of Object.entries(read)) {
    assert.deepEqual(errors, [], `${engine}: no page error`)
    assert.deepEqual(hidden.errors, [], `${engine}: the engine stepped without an error`)
    // 1Z.2 (DLW build ruling 2026-11-09): shown, every step is drawn, and the animation frame's own pace decides how many come: on the Mac
    // about 100 in 2 s in Chromium and 60 in WebKit, 4 to 12 with Chromium's GPU process run a fifth of the time, 7 on #946's landing job.
    // No shown step waits on the GPU's fence, so none is polled: a shown field held to the bounded pace would poll them. (The frame counts
    // no fence of a shown step, so whether its GPU kept up cannot be read here, and no count of frames is asked for.)
    const framePaced = (span, what) => {
      assert.ok(span.presented >= 1 && span.presented === span.stepped,
        `${engine}: ${what}, every step drawn (${span.presented} draws of ${span.stepped} steps in ${Math.round(span.ms)} ms: the animation frame's pace)`)
      assert.equal(span.stepPolled, 0, `${engine}: ${what}, no step waiting on the GPU's fence (${span.stepPolled} polled)`)
    }
    framePaced(shown, 'shown, the field draws')
    // 1Z.1 item 2 (DLW build ruling 2026-11-09): shown, a read the GPU never lets back is taken once it has stood the cap (1 s,
    // PointCloudField GPU_WAIT_MAX_MS), so the collision strikes go on while the field is shown; the frame is paced by the animation
    // frame as before, and a GPU that never signals stalls it once a second at most.
    assert.ok(shownHeld.contactsBack >= 1 && shownHeld.contactsWaited >= 1,
      `${engine}: shown, the fences never passing, the contacts are read back within the cap (${shownHeld.contactsRead} read, ${shownHeld.contactsBack} back, ${shownHeld.contactsWaited} at the cap)`)
    // Its pace is the frame's: on the Mac, Chromium (SwiftShader) drew 120 frames in 2 s here before and after, WebKit 60; under eight
    // runs at once SwiftShader's own pace falls to a few frames in 2 s whatever the fences do, so this asks only that the field draws on.
    assert.ok(shownHeld.presented >= 1, `${engine}: and the field draws on (${shownHeld.presented} draws in 2 s, ${shown.presented} with the fences passing)`)
    // The hidden clock's account of a span (1T.0 item 2): the field's time it stepped, what it owes now less what it owed before, what the
    // engine's wakes have still to step less what they had (1T.0.1: a wake spread over tasks), and what it let go, come to the real time it
    // was handed, within one capped step (an undrawn step held before the span goes to its first); what it owes stays within its bound, and
    // what the wakes have still to step within a wake's; and each wake stepped the field or, the GPU still on the last, gave its time back.
    const keepsTime = (span, what) => {
      const kept = span.simTime + span.owed - span.owedBefore + span.rest - span.restBefore + span.letGo
      assert.ok(span.handed > 0 && Math.abs(kept - span.handed) <= span.stepMax + 1e-6,
        `${engine}: ${what}, keeping the real time it was handed (${span.handed.toFixed(3)} s in ${span.wakes} wakes of ${span.stepped} steps: ${span.simTime.toFixed(3)} s stepped, ${span.owed.toFixed(3)} s owed, ${span.owedBefore.toFixed(3)} s before, ${span.rest.toFixed(3)} s still to step, ${span.restBefore.toFixed(3)} s before, ${span.letGo.toFixed(3)} s let go)`)
      assert.ok(span.owed <= span.owedMax + 1e-9, `${engine}: ${what}, owing ${span.owedMax} s at most (${span.owed.toFixed(3)} s)`)
      assert.ok(span.rest <= span.restMax + 1e-9, `${engine}: ${what}, its wakes have ${span.restMax} s at most still to step (${span.rest.toFixed(3)} s)`)
      assert.equal(span.moved + span.gaveBack, span.wakes, `${engine}: ${what}, each wake stepped the field or gave its time back (${span.moved} stepped, ${span.gaveBack} gave back, of ${span.wakes})`)
    }
    // F1: hidden, the field plays on and nothing is drawn.
    // The message carries the trail: the span on the frame's clock, the host's words and when, and the draws taken while told hidden.
    assert.equal(hidden.presented, 0, `${engine}: hidden, nothing is drawn (${hidden.presented} draws in ${Math.round(hidden.ms)} ms, the span ${hidden.from} to ${hidden.to} ms on the frame's clock; the host's words ${JSON.stringify(hidden.told)}; draws taken while told hidden, no film: ${JSON.stringify(hidden.offDraws)})`)
    // 1T.0 item 2 (#956's CI: WebKit's timer came 7 times in 2.4 s on a loaded runner, and the field played 0.35 s of them): hidden, the
    // field keeps the real time its clock was handed, however few the timer's steps: what it has not stepped it owes, HIDDEN_OWED_MAX_S at
    // most, or let go and said. Engine time against the clock's own input, never a rate the runner's timer must give.
    keepsTime(hidden, 'hidden, the engine steps on')
    // At the GPU's pace, and at least once a second (1X): after a shown span, Linux's headless Chromium (SwiftShader) passed no fence for
    // more than the whole 2 s span, and the field's time stood at 0.000 s (#946); the Mac's GPU passes each step's.
    assert.ok(hidden.moved >= 1 && hidden.simTime > 0, `${engine}: hidden, the field's time goes on (${hidden.simTime.toFixed(3)} s, ${hidden.moved} steps)`)
    assert.ok(hidden.leap <= .1 + 1e-6, `${engine}: hidden, each step moves the field at most its capped .1 s (${hidden.leap.toFixed(3)} s)`)
    assert.ok(hidden.ramp[0] >= 0 && hidden.ramp[1] > hidden.ramp[0], `${engine}: hidden, the ramp goes on (${hidden.ramp.join(' → ')})`)
    // A read comes back once its fence passes, polled, or is taken where the step's fence is waited on once it has stood the step's bound
    // (1Z): hidden here, the steps that move the field read their contacts back.
    assert.ok(hidden.contactsBack >= 1, `${engine}: hidden, the contacts are read back (${hidden.contactsRead} read, ${hidden.contactsBack} back)`)
    // 1Z (DLW build ruling 2026-11-09, #946 red on CI): a read's fence stands the step's bound at most. On Linux's SwiftShader no fence
    // passed hidden and nothing was read back (0 read, 0 back) while the field's time moved; here every fence reads as unpassed (held), and
    // the contacts still come back, each read taken at its bound with the GPU waited for once (a hidden film's too, below).
    assert.ok(held.contactsRead >= 1 && held.contactsBack >= 1,
      `${engine}: the fences never passing, the contacts are still read back at the bound (${held.contactsRead} read, ${held.contactsBack} back)`)
    // Paced by the GPU: an undrawn step whose last step is still on the GPU queues nothing and owes its time to the next. Unpaced, under
    // load the timer's steps queued work faster than SwiftShader ran it (Chromium), and shown again the page drew nothing while it drained.
    // Bounded (1X): an unpassed fence holds a step for GPU_WAIT_MS, doubled for each let go since one passed, to four at most, so a GPU
    // that never passes one paces the field at least once a second and never stops it. The held time goes to that step, capped.
    assert.ok(held.stepped >= 10, `${engine}: the GPU still at work, the clock steps on (${held.stepped})`)
    const paced = span => Math.ceil(span.ms / span.bound) + 1
    assert.ok(held.moved >= 1 && held.moved <= paced(held),
      `${engine}: the fences never passing, the field steps on a bounded wait (${held.bound} ms, doubled to ${4 * held.bound} ms): ${held.moved} steps moved it in ${Math.round(held.ms)} ms, of ${held.stepped}`)
    assert.ok(held.simTime > 0 && held.leap <= .1 + 1e-6,
      `${engine}: and the field's time goes on, each step its capped .1 s at most, never one leap (${held.simTime.toFixed(3)} s, longest ${held.leap.toFixed(3)} s)`)
    // 1T.0 item 2: the time a held wake gave back is owed, and stepped once the GPU lets a wake through: not lost to the cap.
    keepsTime(held, 'the fences never passing')
    keepsTime(caught, 'the hold ended')
    // 1Z.2: after a hold, the GPU has caught up only where its own fences pass. Each that passes lets one step through, at the GPU's pace,
    // and the bound lets one through at most each GPU_WAIT_MS between; where none passes, the field steps on the bounded wait alone, as held.
    // A count of steps or draws over a span is the GPU's speed there, not the engine's rule: #946's landing job (Linux's SwiftShader, loaded)
    // drew a film 2 frames in 3 s after its hold, where its candidate job had drawn 3; with Chromium's GPU process run a fifth of the time
    // here, its fences passed a few times a span after the hold, and the field moved and drew as many times as they passed.
    const afterHold = (span, count, what) => span.stepPassed > 0
      ? assert.ok(count >= span.stepPassed && count <= span.stepPassed + paced(span),
        `${engine}: ${what}: the GPU caught up, its fences passing (${span.stepPassed} of ${span.stepPolled}): each let a step through, the bound the rest (${count} in ${Math.round(span.ms)} ms)`)
      : assert.ok(count >= 1 && count <= paced(span),
        `${engine}: ${what}: the GPU's fences never passing here (none of ${span.stepPolled}), on the bounded wait: ${count} in ${Math.round(span.ms)} ms, at most ${paced(span)}`)
    afterHold(caught, caught.moved, 'the hold ended, the field steps on')
    assert.ok(caught.gpuWork > 0 && caught.simTime > 0, `${engine}: the hold ended, the field's time goes on (${caught.gpuWork} draws, ${caught.simTime.toFixed(3)} s)`)
    assert.ok(caught.leap <= .1 + 1e-6, `${engine}: the steps after the hold take the time held, capped (${caught.leap.toFixed(3)} s)`)
    framePaced(back, 'shown again after the hidden spans, the field draws again')
    // F3: a film being recorded draws hidden, by the animation frame (WebKit) or by the timer (Chromium); its end lets the drawing go.
    // On the timer each draw waits on the GPU (below), so SwiftShader under load draws a few a second; the Mac's GPU, each step.
    assert.ok(filmed.presented >= 1, `${engine}: hidden while a film is recorded, the field draws (${filmed.presented} in 2 s)`)
    // The film takes its clean frame where the field was drawn and on no other step (1W item 1): its present is paced as the draw is.
    assert.ok(filmed.copied >= 1 && filmed.copied === filmed.drawn,
      `${engine}: and the film takes its frames, one on each draw (${filmed.copied} taken, ${filmed.drawn} drawn)`)
    // No animation frame paces a film's hidden draw on the timer: while the GPU is still on the last step, it draws and queues nothing,
    // for its bounded wait at most (1X): a film whose fences never pass draws at least once a second.
    assert.ok(filmHeld.stepped >= 10, `${engine}: filming, the GPU still at work, the clock steps on (${filmHeld.stepped})`)
    assert.ok(filmHeld.drawn >= 1 && filmHeld.drawn <= paced(filmHeld),
      `${engine}: filming, the fences never passing, the field draws on a bounded wait (${filmHeld.drawn} in ${Math.round(filmHeld.ms)} ms)`)
    assert.equal(filmHeld.copied, filmHeld.drawn, `${engine}: and the film presents its clean frame on those draws alone (${filmHeld.copied} taken)`)
    assert.ok(filmHeld.leap <= .1 + 1e-6, `${engine}: each of its steps capped (${filmHeld.leap.toFixed(3)} s)`)
    // 1Z: a film's draw hidden is not paced by the animation frame, so its read takes the step's bound too (gpuBehind).
    assert.ok(filmHeld.contactsRead >= 1 && filmHeld.contactsBack >= 1,
      `${engine}: filming, the fences never passing, the contacts are still read back at the bound (${filmHeld.contactsRead} read, ${filmHeld.contactsBack} back)`)
    afterHold(filmCaught, filmCaught.drawn, 'filming, the hold ended, the field draws again')
    assert.equal(filmEnded.presented, 0, `${engine}: the film ended, hidden draws nothing again (${filmEnded.presented})`)
    assert.equal(filmEnded.copied, 0, `${engine}: and takes nothing (${filmEnded.copied})`)
    keepsTime(filmEnded, 'the film ended, hidden, the engine steps on')
    // 1T.2 item 22(c) (DLW build ruling 2026-11-10; review 956c N2), judged: a hidden wake is spread over tasks in the browser as on
    // janko-keys-853's stand-in GPU. Each task starts steps for HIDDEN_TASK_MS at most, by the engine's own clock (each step made to cost
    // `cost` ms, so no task holds more than budget / cost of them); what a task leaves is queued as one task; a wake that comes while the
    // rest is still to step takes on only what the bound leaves and queues nothing more; and all of it is stepped, in the engine's capped
    // steps. Counts and the engine's own clock readings: no length of time is asked of the runner.
    assert.ok(wake && !wake.failed, `${engine}: the frame answered its wake (${wake ? wake.failed : 'no answer in two minutes'})`)
    {
      const near = (a, b) => Math.abs(a - b) <= 1e-6
      const said = wake.tasks.map(task => `${task.later ? 'later' : 'own'} ${task.steps.length} steps in ${task.ms.toFixed(1)} ms`).join('; ')
      assert.ok(wake.settled && wake.ready && wake.readyAgain, `${engine}: before each wake the last was stepped out and the GPU let a wake through (${wake.settled}, ${wake.ready}, ${wake.readyAgain})`)
      assert.ok(near(wake.taken, wake.wakeMax), `${engine}: a hidden wake of its whole bound is taken on whole (${wake.taken} s of ${wake.wakeMax} s)`)
      const most = Math.ceil(wake.budget / wake.cost)
      for (const [index, task] of wake.tasks.entries()) {
        assert.ok(task.steps.length >= 1 && task.steps.length <= most && task.steps.every(read => read < wake.budget),
          `${engine}: a hidden wake's task starts steps for ${wake.budget} ms at most, and the rest goes to the next task (task ${index + 1} of ${wake.tasks.length}: ${task.steps.length} steps, started ${task.steps.map(read => read.toFixed(1)).join(', ')} ms in, each made to cost ${wake.cost} ms, so ${most} at most; ${said})`)
      }
      const [own, second] = wake.tasks.filter(task => !task.later), later = wake.tasks.filter(task => task.later)
      assert.ok(own && second && later.length >= 2, `${engine}: the wake is stepped over its own task and those after (${said})`)
      assert.ok(wake.rest > 0 && near(own.steps.length * wake.stepMax + wake.rest, wake.taken) && wake.queued === 1,
        `${engine}: the wake's own task steps part of it and queues one task for the rest (${own.steps.length} steps, ${wake.rest.toFixed(3)} s left, ${wake.queued} queued)`)
      assert.ok(near(wake.restBefore, wake.rest) && near(wake.again, wake.wakeMax - wake.restBefore) && wake.restAfter <= wake.wakeMax + 1e-9,
        `${engine}: a wake that comes while the last one's rest is still to step takes on what the bound leaves (${wake.again.toFixed(3)} s taken with ${wake.restBefore.toFixed(3)} s of ${wake.wakeMax} s still to step; ${wake.restAfter.toFixed(3)} s to step after it)`)
      assert.equal(wake.queuedAfter, 1, `${engine}: and queues no second task while one is queued (${wake.queuedAfter} queued)`)
      const steps = wake.tasks.reduce((sum, task) => sum + task.steps.length, 0)
      assert.ok(wake.stepped && wake.left === 0 && steps === Math.round((wake.taken + wake.again) / wake.stepMax) && near(wake.simTime, wake.taken + wake.again),
        `${engine}: all the wakes took on is stepped, in the engine's capped steps (${steps} steps, ${wake.simTime.toFixed(3)} s of ${(wake.taken + wake.again).toFixed(3)} s, ${wake.left} s left; ${said})`)
    }
  }
})
