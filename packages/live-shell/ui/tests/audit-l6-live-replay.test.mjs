/**
 * audit-l6-live-replay — lane zcode:native-actions-audit-l6, 2026-10-09.
 *
 * Part C of the native actions audit: ONE live replay attempt for the
 * transport family (ledger rows toggle-play/previous/next/choose-scene/
 * play-journey, EXPRESSIONS-PORT-STATUS.json) through the shell's own request
 * path against the REAL running stack — the walk-bridge kernel owner on
 * 127.0.0.1:4179 and the live-shell backend on 127.0.0.1:8788. Neither
 * process is started, stopped or restarted here.
 *
 * Method (the F2 harness pattern, tests/agent-shell-live.browser.mjs): bundle
 * the REAL App entry — the exact tree main.tsx mounts, real providers, no
 * stubs — serve it from a throwaway harness page whose /api/config names the
 * RUNNING bridge, and proxy every other path (the hosted Expressions
 * application at /__application/… ) to the RUNNING backend so the frame loads
 * from the same origin. The hosted frame owns no kernel transport by design
 * (kernelExpressions.ts: the host owns the kernel transport; the frame owns
 * none — no ambient authority), so the replay necessarily goes through the
 * shell's editor host relay — the request path the audit is about.
 *
 * Honesty bounds (commission):
 *   - Only non-mutating transport intents are replayed: play, pause and, when
 *     offered, Scene focus. A property-take START (row record-properties) is
 *     deliberately NOT fired: it records authored tracks into the open owner
 *     document — a write into another lane's live work. This receipt names
 *     that bound.
 *   - Every wire message between shell and hosted frame is recorded verbatim,
 *     so the receipt shows the exact boundary_op grammar and the owner's
 *     actual replies — never a UI flag alone.
 *   - If the owner discloses no openable work, or the transport never
 *     presents, the receipt records exactly that named impossibility and
 *     exits 0. A skipped or impossible replay is a valid outcome; a faked one
 *     is not.
 *
 * Evidence: <programme>/new-shell/evidence/native-actions-audit-l6-20261009/
 * (override with OI_AUDIT_L6_EVIDENCE).
 */

import {writeFileSync, mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {createRequire} from 'node:module'
import {createServer, request as httpRequest} from 'node:http'
import {bundleOptions, launchShell} from './support/agentShellHarness.mjs'

const UI = '/Users/admin/Central/worktrees/env-1/o-i/packages/live-shell/ui'
const CRADLE = '/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle'
const SHELL_BACKEND = process.env.OI_AUDIT_L6_BACKEND ?? 'http://127.0.0.1:8788'
const BRIDGE = process.env.OI_AUDIT_L6_BRIDGE ?? 'http://127.0.0.1:4179'
const EVIDENCE = process.env.OI_AUDIT_L6_EVIDENCE
  ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native-actions-audit-l6-20261009'
const EDITOR_CHANNEL = 'oi.native-editor/v1'

const summary = {ok: false, replayed: [], impossibility: null, faults: [], warmup: []}

/** The real entry — main.tsx's exact tree, plus the audit marker. */
const LIVE_ENTRY = `
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './styles.css'
import './panels'
import {loadAgentShellFamilies} from './inhabitants/loadAgentShellFamilies'
import {App} from './App'
import {WorkspaceProvider} from './shell/workspace'
import {ContinuityProvider} from './continuity/workspace'
import {NativeFoundation} from './native/Foundation'
loadAgentShellFamilies()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContinuityProvider><WorkspaceProvider><NativeFoundation><App /></NativeFoundation></WorkspaceProvider></ContinuityProvider>
  </StrictMode>,
)
Object.assign(window, {__auditL6Live: true})
`

/** Bundle the real entry. The seat is mid-flight: another lane's untracked
 * surface file (desktop/cradle/src/surface/projectionPane.tsx) imports
 * `isProjectionPaneKind` from projectionModules.ts, which imports the same
 * name from ./types without re-exporting it — so no whole-App build succeeds
 * in the seat as it stands. This loader appends exactly that missing
 * re-export (the owning module's own function, forwarded verbatim). The shim
 * is recorded in the receipt: it lands one re-export line; no editor,
 * transport or boundary path is touched. */
async function bundleRealEntry() {
  const requireFromCradle = createRequire(join(CRADLE, 'package.json'))
  const esbuild = requireFromCradle('esbuild')
  const shimPlugin = {
    name: 'audit-l6-projection-shim',
    setup(build) {
      build.onLoad({filter: /surface[/\\]projectionModules\.ts$/}, async args => {
        const original = await import('node:fs').then(fs => fs.promises.readFile(args.path, 'utf8'))
        return {contents: `${original}\n// audit-l6 loader shim (recorded): forward the re-export the owning lane has not landed yet.\nexport {isProjectionPaneKind} from './types';\n`, loader: 'ts'}
      })
    },
  }
  const options = bundleOptions()
  const result = await esbuild.build({
    ...options,
    plugins: [...(options.plugins ?? []), shimPlugin],
    stdin: {contents: LIVE_ENTRY, resolveDir: join(UI, 'src'), sourcefile: 'audit-l6-live-entry.tsx', loader: 'tsx'},
    outfile: 'audit-l6-live.mjs',
  })
  const js = result.outputFiles.find(file => file.path.endsWith('.mjs') || file.path.endsWith('.js')).text
  const css = result.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n')
  summary.bundleShim = {
    applied: true,
    file: 'desktop/cradle/src/surface/projectionModules.ts (loader-only append)',
    appended: "export {isProjectionPaneKind} from './types';",
    reason: "the untracked in-flight desktop/cradle/src/surface/projectionPane.tsx imports isProjectionPaneKind from projectionModules.ts, which imports it from ./types without re-exporting — no whole-App build succeeds in the seat as it stands",
    scope: 'one re-export line of the module\'s own import; no editor, transport or boundary path is touched',
  }
  return {js, css}
}

const kindOf = message => {
  if (!message || typeof message !== 'object') return null
  if (message.schema === EDITOR_CHANNEL) return `editor:${message.kind}`
  return typeof message.kind === 'string' ? message.kind : null
}

/** The owner op for a shell-less create (kernel expression.rs Request::Create:
 * {operation:'create', expression_ref, title, actor} — one blank Main Scene).
 * Precedent: the programme's own colour/morph native proof ran against the
 * live owner with a clearly-named scratch expression and left it standing.
 * The scratch is recorded in the receipt; it lists in saved works as scratch. */
const SCRATCH_REF = `expression:audit-l6-replay-scratch`
const SCRATCH_TITLE = 'audit-l6 replay scratch (native-actions audit lane, 2026-10-09)'
const SCRATCH_ACTOR = 'agent:zcode:native-actions-audit-l6'

async function bridgeOp(op, timeoutMs = 60000) {
  const response = await fetch(`${BRIDGE}/op`, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify(op), signal: AbortSignal.timeout(timeoutMs),
  })
  return response.json()
}

/** Ensure exactly one lane-owned scratch expression exists so the replay has
 * an Expression to open through the shell's own open path. */
async function ensureScratchExpression() {
  const list = await bridgeOp({op: 'expression', request: {operation: 'list'}}, 120000)
  summary.ownerListBefore = list?.outcome?.data ?? list
  const mine = (list?.outcome?.data?.expressions ?? []).find(row => row.expression_ref === SCRATCH_REF)
  if (mine) {summary.scratch = {created: false, ref: SCRATCH_REF, found: true}; return true}
  const created = await bridgeOp({op: 'expression', request: {operation: 'create', expression_ref: SCRATCH_REF, title: SCRATCH_TITLE, actor: SCRATCH_ACTOR}}, 120000)
  summary.scratch = {created: true, ref: SCRATCH_REF, title: SCRATCH_TITLE, actor: SCRATCH_ACTOR, reply: created}
  return !!created?.ok
}

/** Harness page server: the bundled shell at /, the RUNNING backend's real
 * /api/config (so the shell qualifies its native World/Workcell binding, with
 * the bridge pinned to the RUNNING bridge), and everything else proxied to
 * the RUNNING backend so the hosted Expressions frame loads same-origin,
 * byte-for-byte as the backend serves it. */
function serveWithProxy(html) {
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0]
    if (path === '/' || path === '/index.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(html)
      return
    }
    if (path === '/api/config') {
      httpRequest(`${SHELL_BACKEND}/api/config`, up => {
        let body = ''
        up.on('data', chunk => {body += chunk})
        up.on('end', () => {
          try {
            const config = JSON.parse(body)
            config.kernel_bridge = BRIDGE
            summary.configSource = 'the running backend /api/config, bridge pinned to the running bridge'
            body = JSON.stringify(config)
          } catch { summary.configSource = 'unparseable backend config — passed through verbatim' }
          response.writeHead(up.statusCode ?? 502, {'content-type': 'application/json; charset=utf-8'})
          response.end(body)
        })
      }).on('error', () => {response.writeHead(502); response.end('the running backend refused /api/config')}).end()
      return
    }
    const upstream = httpRequest(`${SHELL_BACKEND}${request.url}`, {method: request.method}, up => {
      response.writeHead(up.statusCode ?? 502, {'content-type': up.headers['content-type'] ?? 'application/octet-stream'})
      up.pipe(response)
    })
    upstream.on('error', () => {response.writeHead(502); response.end('the running backend refused this path')})
    request.pipe(upstream)
  })
  return new Promise(done => server.listen(0, '127.0.0.1', () => done({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(end => {server.closeAllConnections?.(); server.close(end)}),
  })))
}

async function main() {
  mkdirSync(EVIDENCE, {recursive: true})
  // The owner path first, so a present-but-empty home is distinguished from a
  // stack fault, and so the replay has a work to open (scratch, lane-owned).
  try { await ensureScratchExpression() }
  catch (error) { summary.faults.push(`bridge owner probe failed: ${String(error).slice(0, 300)}`) }
  const bundle = await bundleRealEntry()
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${bundle.css}</style></head><body><div id="root"></div><script type="module">${bundle.js.replace(/<\/script/g, '<\\/script')}</script></body></html>`
  const {url, close} = await serveWithProxy(html)
  const {browser, page} = await launchShell({width: 1920, height: 1200})
  const traffic = []
  await page.addInitScript(() => {
    window.__auditL6 = {messages: []}
    window.addEventListener('message', event => {
      const data = event.data
      if (data && typeof data === 'object' && (data.kind || data.schema)) {
        window.__auditL6.messages.push({at: Date.now(), direction: 'in', data})
        if (window.__auditL6.messages.length > 20000) window.__auditL6.messages.splice(0, 5000)
      }
    })
    const original = Window.prototype.postMessage
    Window.prototype.postMessage = function (message, ...rest) {
      try {
        if (message && typeof message === 'object') {
          window.__auditL6.messages.push({at: Date.now(), direction: 'out', data: message})
          if (window.__auditL6.messages.length > 20000) window.__auditL6.messages.splice(0, 5000)
        }
      } catch { /* the recorder must never break the shell */ }
      return original.call(this, message, ...rest)
    }
  })
  page.on('pageerror', error => summary.faults.push(`pageerror: ${String(error).slice(0, 300)}`))
  const consoleErrors = []
  page.on('console', message => {
    if (message.type() === 'error' && consoleErrors.length < 40) consoleErrors.push(message.text().slice(0, 300))
  })
  summary.consoleErrors = consoleErrors

  try {
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 30000})
    try {
      await page.waitForSelector('nav[aria-label="Working surface"]', {timeout: 60000})
    } catch {
      summary.impossibility = 'the real shell App never rendered its working-surface chrome in 60s over the running bridge'
      summary.pageText = await page.evaluate(() => document.body.innerText.slice(0, 600)).catch(() => '')
      await page.screenshot({path: join(EVIDENCE, 'live-replay-no-chrome.png'), fullPage: true})
      return
    }
    await page.screenshot({path: join(EVIDENCE, 'live-replay-0-shell.png'), fullPage: true})

    // Enter Expressions the way a user does.
    await page.locator('nav[aria-label="Working surface"] button[aria-label="Expressions"]').first().click()

    // Open a work if the owner disclosed saved works; the transport presents
    // only for an open Expression with a qualified native reading. The works
    // list arrives from the kernel after the panel mounts, so wait on the row
    // itself, not on the section.
    const row = page.locator('section[aria-label="Saved native works"] button[data-browser-row]').first()
    try {
      await row.waitFor({state: 'visible', timeout: 180000})
      const title = await row.getAttribute('title').catch(() => null)
      summary.opened = {row: title, at: new Date().toISOString()}
      await row.click()
    } catch {
      summary.noSavedWorksDisclosed = true
      summary.impossibility = 'the live owner disclosed no saved works within 180s (the browser shows no rows), so no Expression presented and the native Scene transport never mounted'
      summary.pageText = await page.evaluate(() => document.body.innerText.slice(0, 1200)).catch(() => '')
      await page.screenshot({path: join(EVIDENCE, 'live-replay-no-works.png'), fullPage: true})
      return
    }

    const transport = page.locator('section[aria-label="Expressions transport"]').first()
    let presented = true
    try {
      await transport.waitFor({state: 'visible', timeout: 180000})
    } catch {
      presented = false
      summary.impossibility = 'the Expressions transport never presented in 180s after opening a work (native replay unqualified, open refused, or the presented work has no qualified reading)'
      summary.pageText = await page.evaluate(() => document.body.innerText.slice(0, 1200)).catch(() => '')
      summary.frameState = await page.evaluate(() => {
        const frame = document.querySelector('iframe')
        const detail = document.body.innerText.match(/Native owner \([^)]*\)/)
        return {
          iframePresent: !!frame,
          iframeSrc: frame?.src ?? null,
          iframeVisible: frame ? frame.offsetWidth > 0 && frame.offsetHeight > 0 : false,
          nativeOwnerDetail: detail?.[0] ?? null,
          kernelChannelMessages: window.__auditL6.messages.filter(row => {
            const kind = row.data && (row.data.schema === 'oi.native-editor/v1' ? `editor:${row.data.kind}` : row.data.kind)
            return typeof kind === 'string' && (kind.startsWith('oi-kernel') || kind.startsWith('kernel-expression') || kind === 'host-command' || kind.startsWith('editor:'))
          }).slice(-40).map(row => ({direction: row.direction, kind: row.data.schema === 'oi.native-editor/v1' ? `editor:${row.data.kind}` : row.data.kind,
            operation: row.data.request?.operation ?? row.data.command ?? row.data.data?.operation ?? null,
            ref: row.data.request?.expression_ref ?? row.data.ref ?? null, ok: row.data.ok}))
        }
      })
      summary.wire = await page.evaluate(limit => window.__auditL6.messages.slice(-limit).map(row => ({
        at: row.at, direction: row.direction,
        kind: row.data && row.data.schema === 'oi.native-editor/v1' ? `editor:${row.data.kind}` : (row.data?.kind ?? null),
        data: row.data})), 200)
      await page.screenshot({path: join(EVIDENCE, 'live-replay-no-transport.png'), fullPage: true})
    }
    if (!presented) return

    const play = transport.locator('button[aria-label="Play Scene"], button[aria-label="Pause Scene"]').first()
    let enabled = false
    for (let waited = 0; waited < 120000; waited += 2000) {
      if (await play.count() > 0 && await play.isEnabled()) {enabled = true; break}
      await page.waitForTimeout(2000)
    }
    if (!enabled) {
      summary.impossibility = `the transport presented but its play control never enabled in 120s (title: ${JSON.stringify(await play.first().getAttribute('title').catch(() => null))})`
      await page.screenshot({path: join(EVIDENCE, 'live-replay-play-disabled.png'), fullPage: true})
      return
    }

    const snapshot = () => page.evaluate(() => {
      const section = document.querySelector('section[aria-label="Expressions transport"]')
      const play = section?.querySelector('button[aria-label="Play Scene"], button[aria-label="Pause Scene"]')
      const time = section?.querySelector('output[aria-label="Scene time"]')
      const name = section?.querySelector('output[aria-label="Native Scene"]')
      return {playLabel: play?.getAttribute('aria-label') ?? null, pressed: play?.getAttribute('aria-pressed') ?? null,
        sceneTime: time?.textContent ?? null, scene: name?.textContent ?? null, messages: window.__auditL6.messages.length}
    })
    const before = await snapshot()
    await page.screenshot({path: join(EVIDENCE, 'live-replay-1-before.png'), fullPage: true})
    const markAt = () => page.evaluate(() => window.__auditL6.messages.length)
    const wireSince = async mark => page.evaluate(at => window.__auditL6.messages.slice(at).map(row => row.data), mark)
    const interesting = wires => wires.filter(d => {
      const kind = d && (d.schema === EDITOR_CHANNEL ? `editor:${d.kind}` : d.kind)
      return kind === 'editor:request' || kind === 'editor:result' || kind === 'host-command' || kind === 'host-command-result'
    })

    // ── play ──
    const playMark = await markAt()
    await play.click()
    await page.waitForFunction(() =>
      !!document.querySelector('section[aria-label="Expressions transport"] button[aria-label="Pause Scene"]'),
    undefined, {timeout: 30000}).catch(() => {})
    await page.waitForTimeout(1500)
    const afterPlay = await snapshot()
    summary.replayed.push({step: 'play', before, after: afterPlay, wires: interesting(await wireSince(playMark)).slice(-12)})

    // ── pause ──
    const pause = transport.locator('button[aria-label="Pause Scene"]').first()
    if (await pause.count() > 0 && await pause.isEnabled()) {
      const pauseMark = await markAt()
      await pause.click()
      await page.waitForFunction(() =>
        !!document.querySelector('section[aria-label="Expressions transport"] button[aria-label="Play Scene"]'),
      undefined, {timeout: 30000}).catch(() => {})
      await page.waitForTimeout(1200)
      summary.replayed.push({step: 'pause', after: await snapshot(), wires: interesting(await wireSince(pauseMark)).slice(-12)})
    } else {
      summary.faults.push('pause control absent or disabled after play — the wire record above shows what actually answered')
    }
    await page.screenshot({path: join(EVIDENCE, 'live-replay-2-after.png'), fullPage: true})

    // ── Scene focus, only when a neighbour control is enabled (presentation-only selection) ──
    const more = transport.locator('button[aria-label="More transport controls"]').first()
    if (await more.count() > 0) {
      await more.click().catch(() => {})
      await page.waitForTimeout(300)
      const next = transport.locator('button[aria-label="Next Scene"]').first()
      if (await next.count() > 0 && await next.isEnabled()) {
        const focusMark = await markAt()
        await next.click()
        await page.waitForTimeout(2500)
        summary.replayed.push({step: 'focus-next', after: await snapshot(), wires: interesting(await wireSince(focusMark)).slice(-12)})
        const previous = transport.locator('button[aria-label="Previous Scene"]').first()
        if (await previous.count() > 0 && await previous.isEnabled()) {
          const backMark = await markAt()
          await previous.click()
          await page.waitForTimeout(2500)
          summary.replayed.push({step: 'focus-previous', wires: interesting(await wireSince(backMark)).slice(-12)})
        }
      } else {
        summary.replayed.push({step: 'focus-next', skipped: 'no enabled neighbour Scene control (single-Scene work or no material beside)'})
      }
    }

    // The last editor-channel traffic, capped, for the receipt.
    summary.wire = await page.evaluate(limit => window.__auditL6.messages.slice(-limit).map(row => ({
      at: row.at, direction: row.direction,
      kind: row.data && row.data.schema === 'oi.native-editor/v1' ? `editor:${row.data.kind}` : (row.data?.kind ?? null),
      data: row.data})), 300)
    summary.ok = summary.replayed.some(row => !row.skipped && (row.wires?.length ?? 0) > 0)
  } catch (error) {
    summary.faults.push(String(error && error.stack || error).slice(0, 2000))
    await page.screenshot({path: join(EVIDENCE, 'live-replay-fault.png'), fullPage: true}).catch(() => {})
  } finally {
    await browser.close().catch(() => {})
    await close().catch(() => {})
  }
}

function finish(code) {
  summary.at = new Date().toISOString()
  summary.stack = {shell_backend: SHELL_BACKEND, bridge: BRIDGE, note: 'walk-bridge 4179 and live-shell backend 8788 were already running; neither was restarted. The harness page is a throwaway server of this test process; the shell entry is the real App bundle.'}
  try {
    mkdirSync(EVIDENCE, {recursive: true})
    writeFileSync(join(EVIDENCE, 'live-replay-receipt.json'), JSON.stringify(summary, null, 2))
  } catch { /* the console copy below still records the outcome */ }
  console.log(JSON.stringify(summary, null, 2))
  process.exit(code)
}

// Playwright resolves from the cradle, exactly as the F2 support harness does.
try {
  const requireFromCradle = createRequire('/Users/admin/Central/worktrees/env-1/o-i/desktop/cradle/package.json')
  requireFromCradle(process.env.OI_BROWSER_RUNTIME || 'playwright')
} catch (error) {
  summary.impossibility = `playwright did not resolve from desktop/cradle: ${error}`
  finish(0)
}

main().then(() => finish(summary.faults.length && !summary.ok ? 1 : 0)).catch(error => {summary.faults.push(String(error).slice(0, 1000)); finish(1)})
