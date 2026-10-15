// The door trace (lanes S, W, lead): Technē › Locations › O-I on a real-ground stack, tracing kernel ops, the frame's reports, and at the end a frame probe and a shell probe (what the frame lays out; what paints over it). Ports: BRIDGE_PORT, VITE_PORT.
// Technē › browser › Locations › double-click O-I, then trace: the wiki projection request (posted / consumed), every kernel op on
// the bridge with its timing, the console, the frame's reported Expression, the stage element's presentation, and every fault.
// Usage: node door-trace.mjs <outDir> [seconds-after-dblclick] [subject-ref]
import {chromium} from '../../../../../node_modules/playwright/index.mjs'
import {mkdirSync, writeFileSync} from 'node:fs'
const out = process.argv[2]
const waitAfter = Number(process.argv[3] ?? 240)
const SUBJECT = process.argv[4] ?? 'central:wiki:project:O-I'
mkdirSync(out, {recursive: true})
const t0 = Date.now()
const at = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6)
const lines = []
const log = (...parts) => { const line = `${at()} ${parts.join(' ')}`; lines.push(line); console.log(line) }
// GPU on: under headless software GL the Earth's WebGL work holds the main thread for 15–68 s and overstates every Technē timing (lane D).
const browser = await chromium.launch({args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']})
const BRIDGE = `http://127.0.0.1:${process.env.BRIDGE_PORT ?? '4261'}`
const page = await browser.newPage({viewport: {width: 1440, height: 900}})
page.on('pageerror', e => log('PAGEERROR', String(e).slice(0, 400)))
page.on('console', m => { const text = m.text(); if (/\[vite\]|Download the React DevTools|GL Driver|\[frame-out\] state|\[frame-in\] (available|\{"schema)|host-mode/.test(text)) return; log(`console.${m.type()}`, text.slice(0, 500)) })
page.on('frameattached', frame => log('frame attached', frame.url().slice(0, 160)))
const opStart = new Map()
page.on('request', request => {
  if (!request.url().includes(`:${process.env.BRIDGE_PORT ?? '4261'}/`)) return
  let op = '?'
  try { const body = JSON.parse(request.postData() ?? '{}'), r = body.request ?? {}; op = body.op + (r.operation ? `:${r.operation}` : '') + (r.scope ? ` ${r.scope}` : '') + (r.kind ? `/${r.kind}` : '') + (r.id ? ` ${r.id}` : '') + (r.expression_ref ? ` ${r.expression_ref}` : '') + ('expected_revision' in r ? ` expected=${r.expected_revision}` : '') } catch {}
  if (op === '?' || op.startsWith('undefined')) return
  opStart.set(request, {op, t: Date.now()})
  if (!/^(poll|events)/.test(op)) log('op →', op)
})
const settle = async (request, failed) => {
  const started = opStart.get(request); if (!started) return
  opStart.delete(request)
  if (/^(poll|events)/.test(started.op)) return
  let note = ''
  if (!failed) { try { const json = await (await request.response())?.json(); note = json?.error ? `error: ${String(json.error).slice(0, 200)}` : `${json?.outcome?.result ?? ''}${json?.outcome?.data?.state ? ' ' + json.outcome.data.state : ''}` } catch {} }
  log('op ←', started.op, `${((Date.now() - started.t) / 1000).toFixed(1)} s`, failed ? `FAILED ${request.failure()?.errorText}` : note)
}
page.on('requestfinished', request => { void settle(request, false) })
page.on('requestfailed', request => { void settle(request, true) })
await page.exposeFunction('__laneS', (...parts) => log('page', ...parts))
await page.addInitScript(bridge => {
  performance.setResourceTimingBufferSize(20000)
  window.__OI_KERNEL_BRIDGE__ = bridge
  if (window.parent !== window) {
    // In the hosted frame: what the host sends down, and what the frame sends up (its state announcements summarised).
    window.addEventListener('message', event => {
      if (event.source !== window.parent) return
      const d = event.data
      if (d && (d.kind === 'host-command' || d.kind === 'host-mode' || d.kind === 'visibility' || d.kind === 'open-expression')) console.log('[frame-in]', JSON.stringify(d).slice(0, 300))
      else if (d && d.schema && d.kind && !/channel-result|result$/.test(String(d.kind))) console.log('[frame-in]', String(d.kind), JSON.stringify(d).slice(0, 160))
      else if (d && (d.kind === 'expression-recovery-result' || d.kind === 'kernel-expression-result')) console.log('[frame-in]', JSON.stringify({kind: d.kind, req: d.req, ok: d.ok, error: d.error, state: d.data?.state, record: d.data?.record === null ? null : d.data?.record?.revision}))
    }, true)
    const post = window.parent.postMessage.bind(window.parent)
    window.parent.postMessage = (data, ...rest) => {
      try {
        if (data?.kind === 'oi-app-state') console.log('[frame-out] state', JSON.stringify({hostMode: data.state?.hostMode, nativeScene: data.state?.nativeScene ?? null, doc: data.state?.document?.name ?? null}))
        else if (data?.kind && !/^channel/.test(String(data.kind))) console.log('[frame-out]', String(data.kind), JSON.stringify(data).slice(0, 200))
      } catch {}
      return post(data, ...rest)
    }
  }
}, BRIDGE)
await page.goto(`http://localhost:${process.env.VITE_PORT ?? '5241'}/app/`)
await page.waitForTimeout(6000)
// The page's own module instances (the URL the app loaded, ?t= included).
const hook = async () => page.evaluate(async () => {
  const find = part => performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes(part))
  const store = await import(find('/desktop/cradle/src/techne/wikiProjectionStore.ts'))
  let last = ''
  store.subscribeWikiProjection(() => {
    const state = store.getWikiProjectionState()
    const request = state.request ? `request seq=${state.request.seq} ${state.request.registerKey} ${state.request.sceneRef} entity=${state.request.entityRef} lens=${state.request.lens ?? '-'}` : 'request none'
    const phases = Object.entries(state.standings).map(([key, standing]) => `${key}:${standing.phase}${standing.readingInvalidated ? '*' : ''}`).join(' ')
    const line = `${request} | register=${state.registerKey} | sel=${state.selection.expressionRef ?? '-'} ${state.selection.sceneRef ?? '-'} | ${phases}`
    if (line !== last) { last = line; window.__laneS('wiki', line) }
  })
  return 'hooked'
})
log('hook', await hook().catch(e => 'not yet: ' + e))
await page.locator('.mode-rail-button[data-mode="techne"]').dispatchEvent("click", undefined, {timeout: 120000})
await page.waitForTimeout(2500)
await page.locator('.one-browser .world-category-list button', {hasText: /^Locations$/}).first().dispatchEvent("click", undefined, {timeout: 120000})
const row = page.locator(`[data-world-subject="${SUBJECT}"]`)
const waitRow = Date.now()
while (!(await row.count()) && Date.now() - waitRow < 300000) await page.waitForTimeout(2000)
log('row present:', await row.count())
if (!(await row.count())) { log('results:', (await page.locator('.one-browser .world-browser-results').innerText().catch(() => '')).slice(0, 800)); await page.screenshot({path: `${out}/no-row.png`, timeout: 60000}).catch(e => log("screenshot skipped", String(e).slice(0, 80))); await browser.close(); writeFileSync(`${out}/trace.log`, lines.join('\n')); process.exit(1) }
// Lane W: let the shell settle first — the Expressions frame mounted and reporting (data-empty set), then a quiet moment.
const settleFrom = Date.now()
while (Date.now() - settleFrom < 180000 && !(await page.evaluate(() => document.querySelector('.expressions-application')?.getAttribute('data-empty') != null))) await page.waitForTimeout(2000)
log('frame mounted:', await page.evaluate(() => document.querySelector('.expressions-application')?.getAttribute('data-empty')))
await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 20000))
// (no before screenshot: the loaded machine stalls ReadPixels)
await row.dispatchEvent("dblclick", undefined, {timeout: 120000})
log('dblclick')
// Lane W: on this loaded machine the wiki registers can take minutes to project, and a door asked before they are read settles
// absent. Then wait until none is still reading and ask again (the person's second double-click).
const registers = () => page.evaluate(async () => {
  const find = part => performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes(part))
  const store = await import(find('/desktop/cradle/src/techne/wikiProjectionStore.ts'))
  const phases = Object.values(store.getWikiProjectionState().standings).map(standing => standing.phase)
  return {total: phases.length, reading: phases.filter(phase => phase === 'reading').length}
}).catch(() => ({total: 0, reading: 0}))
const doorText = () => page.evaluate(async subject => {
  const find = part => performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes(part))
  const openings = await import(find('/techne/subject/subjectOpenings.ts'))
  const held = openings.subjectOpenings().get(subject)
  return held ? `${held.state} ${held.reason ?? ''}` : 'none'
}, SUBJECT).catch(() => 'none')
const firstAsk = Date.now()
while (Date.now() - firstAsk < 900000) {
  const door = await doorText()
  if (!/^(opening|none)/.test(door)) {
    if (/registers were not loaded/.test(door)) {
      while (Date.now() - firstAsk < 900000) { const r = await registers(); if (r.total && !r.reading) break; await page.waitForTimeout(3000) }
      log('registers projected; asking again', JSON.stringify(await registers()))
      await row.dispatchEvent("dblclick", undefined, {timeout: 120000}); log('dblclick (again)')
    }
    break
  }
  await page.waitForTimeout(2000)
}
const deadline = Date.now() + waitAfter * 1000
let previous = ''
while (Date.now() < deadline) {
  const snapshot = await page.evaluate(async subject => {
    const find = part => performance.getEntriesByType('resource').map(entry => entry.name).find(name => name.includes(part))
    const openings = await import(find('/techne/subject/subjectOpenings.ts'))
    const paneHost = await import(find('/projections/expressionsPaneHost.ts'))
    const held = openings.subjectOpenings().get(subject)
    const app = document.querySelector('.expressions-application')
    const residence = app?.closest('.inhabitant')
    const hidden = app?.closest('[hidden],[inert]')
    const reading = paneHost.hostedExpressions()
    const panes = [...document.querySelectorAll('[data-projection-kind]')].map(el => el.getAttribute('data-projection-kind'))
    return JSON.stringify({
      door: held ? (held.opened ? `${held.state} ${held.opened.scene_title} (${held.scenes.length})${held.reason ? ': ' + held.reason : ''}${held.expression_ref ? ' ' + held.expression_ref : ''}` : held.state === 'absent' ? `absent: ${held.reason}` : held.state) : 'none',
      row: document.querySelector(`[data-world-subject="${subject}"] .mode-browser-row-meta`)?.textContent ?? null,
      stagePanes: panes.filter(kind => kind === 'projection.expressions').length,
      app: app ? {rects: app.getClientRects().length, hiddenBy: hidden ? (hidden.className || hidden.tagName) : null, empty: app.getAttribute('data-empty'), display: app.style.display, residenceHidden: residence?.hidden ?? null} : null,
      frame: reading,
      waiting: [...document.querySelectorAll('.expressions-pane-waiting')].map(el => el.textContent),
      faults: [...document.querySelectorAll('.expressions-pane-body [role="alert"], .expressions-pane-fault')].map(el => el.textContent),
      mode: document.querySelector('.mode-rail-button[aria-pressed="true"], .mode-rail-button.active')?.getAttribute('data-mode') ?? null,
    })
  }, SUBJECT).catch(e => 'eval failed ' + e)
  if (snapshot !== previous) { previous = snapshot; log('state', snapshot) }
  await page.waitForTimeout(1500)
}
const frameProbe = async () => {
  const frame = page.frames().find(f => f.url().includes('__application/expressions'))
  if (!frame) return 'no frame'
  return frame.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 }
    const big = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 300 && r.height > 200 && vis(el) }).slice(0, 25).map(el => `${el.tagName.toLowerCase()}#${el.id}.${String(el.className).split(' ').slice(0, 3).join('.')} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`)
    return JSON.stringify({instrument: document.body.dataset.activeInstrument, bodyClass: document.body.className, stageInert: document.getElementById('stage')?.inert, big, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 900), toasts: [...document.querySelectorAll('[class*=toast]')].map(el => el.textContent).slice(0, 5)})
  }).catch(e => 'frame eval failed ' + e)
}
log('frame probe', await frameProbe())
const shellProbe = await page.evaluate(() => {
  const iframe = [...document.querySelectorAll('iframe')].find(f => (f.getAttribute('src') ?? '').includes('__application/expressions'))
  if (!iframe) return 'no iframe'
  const r = iframe.getBoundingClientRect()
  const chain = []
  for (let el = iframe; el && el !== document.documentElement; el = el.parentElement) {
    const cs = getComputedStyle(el), b = el.getBoundingClientRect()
    chain.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)} vis=${cs.visibility} op=${cs.opacity} disp=${cs.display} z=${cs.zIndex} pos=${cs.position}${el.hidden ? ' HIDDEN' : ''}${el.inert ? ' INERT' : ''}${cs.clipPath !== 'none' ? ' clip=' + cs.clipPath : ''}`)
  }
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2
  const top = document.elementsFromPoint(cx, cy).slice(0, 6).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')}`)
  return JSON.stringify({rect: [r.x, r.y, r.width, r.height].map(Math.round), chain, atCentre: top})
}).catch(e => 'shell probe failed ' + e)
log('shell probe', shellProbe)
await page.screenshot({path: `${out}/after.png`, timeout: 60000}).catch(e => log("screenshot skipped", String(e).slice(0, 80)))
writeFileSync(`${out}/trace.log`, lines.join('\n'))
await browser.close()
