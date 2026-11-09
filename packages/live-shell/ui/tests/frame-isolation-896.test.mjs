// O-I #747 round 896, item 0.3 and 0R-authority.2 (DLW build ruling 2026-11-09, on the review of C99): the Expressions frame cannot
// reach the host's IPC. Review 2 found the frame mounted at the shell's own origin with no sandbox, so a script in it could call the
// parent's `__TAURI_INTERNALS__.invoke("kernel_press", …)`, and Tauri grants a command by webview label, not by frame. Now the native
// host gives the frame an origin of its own (native_shell.rs `expressions_entry`, the material protocol's), so the frame's script
// cannot read the shell's realm, and Tauri puts its internals and invoke key in the main frame alone. The isolation took one thing
// from the frame, its storage, which stood at the shell's origin: it is carried once through the boundary (storageCarry.ts).
// Channel: LAID OUT, in Chromium: the shell's page at the shell's origin as Tauri serves it on Windows (http://tauri.localhost), its
// IPC a SCRIPTED STUB put in the main frame alone (as Tauri's init scripts are, for_main_frame_only); the frame mounted by the
// boundary's own mount (host.ts mountExpressionsApplication) at the entry the native host gives (native_shell.rs, read from its
// source: CODE-READING), in its Windows form (http://oi-material.localhost) where Chromium has no custom scheme; the frame's page is
// the test's, running the boundary's own carry (REAL), against the shell's real storage (localStorage and the recovery database).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const ui = fileURLToPath(new URL('..', import.meta.url))
const native = readFileSync(new URL('../../../../desktop/cradle/src-tauri/src/native_shell.rs', import.meta.url), 'utf8')
const SHELL = 'http://tauri.localhost'

/** The frame's entry as the native host gives it (live_shell_config `expressions_entry`), in the form Chromium can serve. */
function nativeEntry() {
  const given = native.match(/"expressions_entry":(super::expressions_entry\(\)|"[^"]*")/)
  assert.ok(given, 'the native host gives the frame an entry')
  if (given[1].startsWith('"')) return JSON.parse(given[1])
  const body = native.slice(native.indexOf('pub(crate) fn expressions_entry()'), native.indexOf('\n}\n', native.indexOf('pub(crate) fn expressions_entry()')))
  const forms = [...body.matchAll(/"([^"]+:\/\/[^"]+)"/g)].map(match => match[1])
  assert.deepEqual(forms, ['http://oi-material.localhost/__application/expressions/index.html', 'oi-material://localhost/__application/expressions/index.html'])
  return forms[0]
}

const STAGE = `
import {mountExpressionsApplication} from '../../expressions-boundary/src/host'
const w = window as any
w.__reports = []
window.addEventListener('message', event => { if (event.data?.kind === 'isolation-report') w.__reports.push({origin: event.origin, report: event.data.report}) })
w.__mount = (entry: string, which: string) => {
  w.__mounted?.dispose()
  const mounted = mountExpressionsApplication(document.getElementById('root')!, entry + '?mode=expressions&case=' + which,
    {bindingId: 'center:world', owners: {channels: {}}, mode: 'expressions', isPresented: () => true, handshakeTimeoutMs: 120000})
  w.__mounted = mounted
  return mounted.frame.src
}
w.__ready = true
`
/** The frame's page: what its script can reach of the host, then (case=carry) the boundary's carry, then what its own storage holds. */
const FRAME = `
import {carryStorageFromHost} from '../../expressions-boundary/src/storageCarry'
const which = new URLSearchParams(location.search).get('case')
const refused = (error: unknown) => 'refused: ' + ((error as Error)?.name ?? String(error))
async function recovery(): Promise<unknown> {
  const listed = (await (indexedDB as any).databases?.()) ?? []
  if (!listed.some((row: {name?: string}) => row.name === 'oi.expression-recovery')) return null
  const database: IDBDatabase = await new Promise((resolve, reject) => { const r = indexedDB.open('oi.expression-recovery'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const out: Record<string, unknown> = {}
  for (const store of Array.from(database.objectStoreNames)) out[store] = await new Promise(resolve => { const r = database.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result) })
  database.close()
  return out
}
async function run() {
  const report: Record<string, unknown> = {origin: location.origin}
  try { report.parentInternals = typeof (window.parent as any).__TAURI_INTERNALS__ } catch (error) { report.parentInternals = refused(error) }
  try { await (window.parent as any).__TAURI_INTERNALS__.invoke('kernel_press', {op: {op: 'invoke_action', invocation: {action: 'central.day.move.record', target_ref: 'central:day:2026-11-09', input: {}}}}); report.called = true }
  catch (error) { report.called = false; report.callRefused = refused(error) }
  try { report.topInternals = typeof (window.top as any).__TAURI_INTERNALS__ } catch (error) { report.topInternals = refused(error) }
  report.ownInternals = typeof (window as any).__TAURI_INTERNALS__
  try { report.parentStorage = (window.parent as any).localStorage.length } catch (error) { report.parentStorage = refused(error) }
  if (which === 'seed') { localStorage.setItem('oi.workspace.v1', 'written here since'); localStorage.setItem('oi.expressions.storage-uncarried.v1', 'then') }
  if (which === 'carry' || which === 'seed') report.carry = await carryStorageFromHost({timeoutMs: 4000})
  report.local = Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]))
  report.recovery = await recovery()
  window.parent.postMessage({kind: 'isolation-report', report}, '*')
}
void run()
`

async function layoutBrowser(t, playwright) {
  try { return await playwright().chromium.launch() } catch (error) {
    const why = `no Chromium to mount the frame in: ${String(error?.message ?? error).split('\n')[0]}`
    if (process.env.CI) throw new Error(`${why} (CI installs it before this suite: desktop.yml)`)
    t.skip(why); return undefined
  }
}

/** The shell's page and the frame's, each served at its origin; the shell's IPC stub in its main frame alone. */
async function stage(browser, harness) {
  const shell = await harness.bundleEntry({contents: STAGE, resolveDir: ui, sourcefile: 'frame-isolation-stage.tsx', outfile: 'frame-isolation-stage.mjs'})
  const frame = await harness.bundleEntry({contents: FRAME, resolveDir: ui, sourcefile: 'frame-isolation-frame.tsx', outfile: 'frame-isolation-frame.mjs'})
  const context = await browser.newContext()
  await context.addInitScript(() => {
    if (window !== window.top) return
    window.__invoked = []
    Object.defineProperty(window, '__TAURI_INTERNALS__', {value: {invoke: async command => { window.__invoked.push(command); return null }, metadata: {currentWebview: {label: 'main'}}}})
  })
  const html = js => `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">${harness.inlineModuleSafe(js)}</script></body></html>`
  await context.route('http://*.localhost/**', route => {
    const url = new URL(route.request().url())
    if (url.origin === SHELL && url.pathname === '/app/index.html') return route.fulfill({contentType: 'text/html', body: harness.shellHtml(shell)})
    if (url.pathname === '/__application/expressions/index.html') return route.fulfill({contentType: 'text/html', body: html(frame.js)})
    return route.fulfill({status: 404, body: 'not here'})
  })
  const tab = await context.newPage()
  const errors = []
  tab.on('pageerror', error => errors.push(String(error).split('\n')[0]))
  await tab.goto(`${SHELL}/app/index.html`)
  await tab.waitForFunction(() => window.__ready, null, {timeout: 60_000})
  const mount = async which => {
    const before = await tab.evaluate(() => window.__reports.length)
    const src = await tab.evaluate(([entry, which]) => window.__mount(entry, which), [nativeEntry(), which])
    await tab.waitForFunction(count => window.__reports.length > count, before, {timeout: 60_000})
    return {src, ...(await tab.evaluate(() => window.__reports.at(-1)))}
  }
  return {context, tab, errors, mount}
}

test('0.3: the frame the native host mounts has an origin of its own, so its script cannot reach the host\'s invoke', {timeout: 300_000}, async t => {
  const harness = await import('./support/agentShellHarness.mjs')
  const browser = await layoutBrowser(t, harness.playwright)
  if (!browser) return
  try {
    const {context, tab, errors, mount} = await stage(browser, harness)
    const {src, origin, report} = await mount('reach')
    assert.deepEqual({invoked: await tab.evaluate(() => window.__invoked), called: report.called}, {invoked: [], called: false},
      'the frame could not call the host\'s invoke, and nothing reached the host')
    assert.match(String(report.parentInternals), /^refused: SecurityError$/, 'the shell\'s window is not readable from the frame')
    assert.match(String(report.topInternals), /^refused: SecurityError$/)
    assert.equal(report.ownInternals, 'undefined', 'the host\'s IPC is in the main frame alone')
    assert.match(String(report.parentStorage), /^refused: SecurityError$/, 'nor the shell\'s storage')
    assert.notEqual(new URL(src).origin, SHELL, `the frame is mounted at an origin of its own (${src})`)
    assert.equal(origin, new URL(src).origin)
    assert.deepEqual(errors, [])
    await context.close()
  } finally { await browser.close() }
})

test('0.3: what the person kept at the shell\'s origin is carried once to the frame\'s own, the newer standing', {timeout: 300_000}, async t => {
  const harness = await import('./support/agentShellHarness.mjs')
  const browser = await layoutBrowser(t, harness.playwright)
  if (!browser) return
  try {
    const {context, tab, errors, mount} = await stage(browser, harness)
    // The shell's origin holds what the frame kept while it was served there: its Library, its workspace, and a draft and a native
    // working record in its recovery database.
    await tab.evaluate(async () => {
      localStorage.setItem('oi.field-studies.journey-library.v2.p1', 'a library entry')
      localStorage.setItem('oi.workspace.v1', 'the workspace kept at the shell')
      localStorage.setItem('oi.recent-work.v1', '["j1"]')
      await new Promise((resolve, reject) => {
        const opening = indexedDB.open('oi.expression-recovery', 3)
        opening.onupgradeneeded = () => { for (const store of ['drafts', 'nativeWorking', 'quarantine']) opening.result.createObjectStore(store, {keyPath: 'id'}) }
        opening.onsuccess = () => {
          const tx = opening.result.transaction(['drafts', 'nativeWorking'], 'readwrite')
          tx.objectStore('drafts').put({id: 'j1', name: 'Dawn', scenes: []})
          tx.objectStore('nativeWorking').put({id: 'expression:dawn', revision: 4})
          tx.oncomplete = () => { opening.result.close(); resolve() }
          tx.onerror = () => reject(tx.error)
        }
        opening.onerror = () => reject(opening.error)
      })
    })
    const first = await mount('carry')
    assert.equal(first.report.carry.state, 'carried')
    assert.deepEqual(first.report.carry.failed, [])
    assert.deepEqual(first.report.carry.recovery, {drafts: 1, nativeWorking: 1})
    assert.equal(first.report.local['oi.field-studies.journey-library.v2.p1'], 'a library entry')
    assert.equal(first.report.local['oi.workspace.v1'], 'the workspace kept at the shell')
    assert.equal(first.report.local['oi.recent-work.v1'], '["j1"]')
    assert.equal(JSON.parse(first.report.local['oi.expressions.storage-carried.v1']).from, SHELL)
    assert.deepEqual(first.report.recovery, {drafts: [{id: 'j1', name: 'Dawn', scenes: []}], nativeWorking: [{id: 'expression:dawn', revision: 4}], quarantine: []})
    // The shell's storage is read, never moved.
    assert.equal(await tab.evaluate(() => localStorage.getItem('oi.workspace.v1')), 'the workspace kept at the shell')
    // Asked once: the next start finds its record and asks nothing.
    const again = await mount('carry')
    assert.equal(again.report.carry.state, 'kept')
    // Nothing the frame runs once booted is given the shell's storage: the host answers the ask only before the frame's first state.
    assert.deepEqual(errors, [])
    await context.close()
  } finally { await browser.close() }
})

test('0.3: a frame that ran here before its carry keeps what it wrote since; the carry adds only what it lacks', {timeout: 300_000}, async t => {
  const harness = await import('./support/agentShellHarness.mjs')
  const browser = await layoutBrowser(t, harness.playwright)
  if (!browser) return
  try {
    const {context, tab, errors, mount} = await stage(browser, harness)
    await tab.evaluate(() => {
      localStorage.setItem('oi.workspace.v1', 'the workspace kept at the shell')
      localStorage.setItem('oi.panel-sizes.v1', '{"studio":{"width":320,"height":200}}')
    })
    const seeded = await mount('seed')
    assert.equal(seeded.report.carry.state, 'carried')
    assert.equal(seeded.report.local['oi.workspace.v1'], 'written here since', 'what the frame wrote here stands over the older carry')
    assert.equal(seeded.report.local['oi.panel-sizes.v1'], '{"studio":{"width":320,"height":200}}', 'what it lacked is carried')
    assert.equal(seeded.report.recovery, null, 'no recovery database stood at the shell\'s origin, and none is made at the frame\'s')
    assert.equal(await tab.evaluate(async () => ((await indexedDB.databases()) ?? []).some(row => row.name === 'oi.expression-recovery')), false,
      'and the carry made none at the shell\'s')
    assert.deepEqual(errors, [])
    await context.close()
  } finally { await browser.close() }
})
