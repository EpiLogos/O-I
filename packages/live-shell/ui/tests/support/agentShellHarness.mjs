/**
 * Shared harness for the agent-shell F2 fidelity suites.
 *
 * Owns the machine-bound plumbing so no suite hardcodes it:
 *   - oracle and evidence paths (env: OI_AGENT_SHELL_ORACLE, OI_FIDELITY_EVIDENCE)
 *   - esbuild bundling of a real ui entry (the same bundle the vite dev server serves)
 *   - a throwaway HTTP server that plays the axum config host: it answers
 *     `/api/config` with `kernel_bridge` so the page's readShellConfig()
 *     resolves a {kind:'bridge', url} transport — the exact dev-mode path,
 *     no stubs (env: OI_KERNEL_BRIDGE)
 *   - Playwright launch (cradle's copy; env: OI_BROWSER_RUNTIME, OI_CHROME)
 *   - kernel bridge calls from Node ({POST url}/op) used to cross-check what
 *     the page renders against what the same bridge actually discloses
 *
 * The fixture refusal battery (runFixtureHarness) is shared by
 * agent-shell-fidelity.browser.mjs and the --fixture mode of
 * agent-shell-live.browser.mjs.
 */

import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFile, mkdir, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export const ui = resolve(fileURLToPath(new URL('../..', import.meta.url)))
export const root = resolve(ui, '../../..')

export const ORACLE_DEFAULT = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/agent-shell-fidelity.json'
export const EVIDENCE_LIVE_DEFAULT = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/agent-shell-f2-live-20261008'
export const EVIDENCE_FIXTURE_DEFAULT = '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/agent-shell-fixture-refusal-20261008'
export const BRIDGE_DEFAULT = process.env.OI_KERNEL_BRIDGE ?? 'http://127.0.0.1:4179'
/** The agency project name the shell reads (AgentSessionsProvider PROJECT).
 * Override to align the harness with Central's world map when it moves. */
export const AGENCY_PROJECT = process.env.OI_AGENCY_PROJECT ?? 'O-I'
/** A port that refuses connections: the cut harness points the page here. */
export const CUT_BRIDGE = 'http://127.0.0.1:9'
/** The status-bar node the hover law must speak through (mockup: #info).
 * The real shell feeds it via the delegated mouseover in
 * src/agent/statusInfo.ts and renders it as StatusBar's
 * `[data-region="agent-status-info"]` (label + function). Override with
 * OI_STATUS_INFO_SELECTOR if that node moves. */
export const STATUS_INFO_SELECTOR = process.env.OI_STATUS_INFO_SELECTOR ?? '[data-region="agent-status-info"]'

const require = createRequire(join(root, 'desktop/cradle/package.json'))
const esbuild = require('esbuild')
const playwrightRuntime = process.env.OI_BROWSER_RUNTIME || 'playwright'

export function playwright() {
  return require(playwrightRuntime)
}

export async function loadOracle(path = process.env.OI_AGENT_SHELL_ORACLE ?? ORACLE_DEFAULT) {
  return JSON.parse(await readFile(path, 'utf8'))
}

export async function ensureEvidenceDir(dir) {
  await mkdir(dir, {recursive: true})
  return dir
}

// ---------------------------------------------------------------------------
// bundling — the real entry, the same module graph vite serves

export function bundleOptions() {
  return {
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    // vite resolves .ts before .tsx; keep the same precedence so the same
    // module graph is chosen (e.g. nativeEntityFace.sound.ts vs .tsx).
    resolveExtensions: ['.ts', '.tsx', '.jsx', '.js', '.css', '.json'],
    define: {'__CRADLE_WALK__': 'false', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production","BASE_URL":"/"}'},
    alias: {
      react: join(ui, 'node_modules/react'),
      'react-dom': join(ui, 'node_modules/react-dom'),
      '@tauri-apps/api': join(ui, 'node_modules/@tauri-apps/api'),
      '@epilogos/expressions-boundary/editor-host': join(root, 'packages/expressions-boundary/src/editorHost.ts'),
      '@epilogos/expressions-boundary/time-window': join(root, 'packages/expressions-boundary/src/timeWindow.ts'),
      '@epilogos/expressions-boundary': join(root, 'packages/expressions-boundary/src'),
    },
    loader: {'.svg': 'dataurl', '.png': 'dataurl', '.woff2': 'dataurl', '.html': 'text', '.md': 'text'},
    plugins: [{
      name: 'raw-assets',
      setup(build) {
        build.onResolve({filter: /\?raw$/}, args => ({path: resolve(args.resolveDir, args.path.replace(/\?raw$/, '')), namespace: 'raw'}))
        build.onLoad({filter: /.*/, namespace: 'raw'}, async args => ({contents: await readFile(args.path, 'utf8'), loader: 'text'}))
      },
    }],
  }
}

/** Bundle a stdin entry and return {js, css}. */
export async function bundleEntry({contents, resolveDir, sourcefile, outfile}) {
  const bundle = await esbuild.build({
    ...bundleOptions(),
    stdin: {contents, resolveDir, sourcefile, loader: 'tsx'},
    outfile,
  })
  const js = bundle.outputFiles.find(file => file.path.endsWith('.mjs')).text
  const css = bundle.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n')
  return {js, css}
}

export function shellHtml({js, css}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`
}

// ---------------------------------------------------------------------------
// the throwaway host — config the way the dev page reads it

function replyJson(response, status, body) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.statusCode = status
  response.end(JSON.stringify(body))
}

/**
 * Serve the bundled page and play the axum config host: `/api/config`
 * carries `kernel_bridge` so the page's readShellConfig() resolves a real
 * {kind:'bridge', url} transport. Set reads are refused — the harness
 * discloses no set document, exactly like an owner with nothing open.
 */
export async function serveShellPage({html, kernelBridge}) {
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0]
    if (path === '/' || path === '/index.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8')
      response.end(html)
      return
    }
    if (path === '/api/config') {
      replyJson(response, 200, {default_set: 'agent-shell-live-harness', kernel_bridge: kernelBridge})
      return
    }
    if (path.startsWith('/api/')) {
      replyJson(response, 404, {error: `The fidelity harness serves no ${path} reading`})
      return
    }
    replyJson(response, 404, {error: 'not found'})
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(done => {server.closeAllConnections?.(); server.close(done)}),
  }
}

// ---------------------------------------------------------------------------
// browser

/** Playwright's own executable resolution, with OI_CHROME as the override. */
export async function launchShell({width, height}) {
  const {chromium} = playwright()
  const headless = true
  let browser
  if (process.env.OI_CHROME) {
    browser = await chromium.launch({headless, executablePath: process.env.OI_CHROME})
  } else {
    try {
      browser = await chromium.launch({headless})
    } catch {
      browser = await chromium.launch({headless, channel: 'chrome'})
    }
  }
  const context = await browser.newContext({viewport: {width, height}})
  const page = await context.newPage()
  const browserErrors = []
  const pageErrors = []
  const probeLog = []
  page.on('console', message => {
    if (message.type() === 'error' && browserErrors.length < 200) browserErrors.push(message.text())
    if (message.text().includes('[agent-shell-probe]') && probeLog.length < 40) probeLog.push(message.text())
  })
  page.on('pageerror', error => {
    if (pageErrors.length < 50) pageErrors.push(String(error))
  })
  return {browser, context, page, browserErrors, pageErrors, probeLog}
}

// ---------------------------------------------------------------------------
// kernel bridge from Node — the same ops the page itself issues

export async function postOp(bridgeUrl, op, timeoutMs = 8000) {
  try {
    const response = await fetch(`${bridgeUrl}/op`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(op),
      signal: AbortSignal.timeout(timeoutMs),
    })
    return await response.json()
  } catch (error) {
    return {ok: false, error: `bridge ${bridgeUrl} unreachable: ${String(error)}`}
  }
}

export function probeBridge(bridgeUrl) {
  // A cold kernel discover of the project's SessionSpaces runs the AIKit
  // owner subprocess (tens of seconds on a large ground) — the probe mirrors
  // the real op and must wait for it, not outlive it.
  return postOp(bridgeUrl, {op: 'agency_read', project: AGENCY_PROJECT}, 180000).then(body =>
    !(typeof body.error === 'string' && /fetch failed|ECONNREFUSED|unreachable|abort/i.test(body.error)))
}

/** Project an agency_reading into rows exactly like
 * desktop/cradle/src/agency/agencySources.readAgency does. */
export async function agencyReadViaBridge(bridgeUrl, project = AGENCY_PROJECT) {
  // Same cold-discover law as probeBridge: the kernel may run the AIKit
  // owner subprocess for tens of seconds before its read cache warms.
  const body = await postOp(bridgeUrl, {op: 'agency_read', project}, 180000)
  if (!body || body.ok !== true || body.outcome?.result !== 'agency_reading') {
    return {ok: false, error: body?.error ?? 'agency_read refused or malformed', rows: []}
  }
  const rows = []
  for (const raw of body.outcome.spaces ?? []) {
    const space = raw ?? {}
    const spaceRef = space.definition?.id
    if (!spaceRef || !space.agent_sessions) continue
    for (const [sessionRef, attachment] of Object.entries(space.agent_sessions)) {
      rows.push({
        spaceRef,
        sessionRef,
        purpose: attachment?.purpose,
        agentRef: typeof attachment?.agent_ref === 'string' ? attachment.agent_ref : undefined,
      })
    }
  }
  return {ok: true, rows, error: null}
}

/** The spend reading behind the transport's cpu meter, the way
 * useAgentMetrics parses encounter_task_read. */
export async function spendViaBridge(bridgeUrl, sessionRef, project = AGENCY_PROJECT) {
  const body = await postOp(bridgeUrl, {op: 'encounter_task_read', project, agent_session: sessionRef})
  if (!body || body.ok !== true || body.outcome?.result !== 'encounter_task_reading' || !body.outcome.data) {
    return {ok: false, spend: null, error: body?.error ?? 'encounter_task_read refused or malformed'}
  }
  const data = body.outcome.data
  const usage = data.usage ?? {}
  const cap = usage.spend_cap ?? data.spend_cap
  const fill = usage.spend_fill ?? data.spend_fill
  const spend = typeof fill === 'number' ? fill : typeof cap === 'number' ? cap : null
  return {ok: true, spend, error: null}
}

/** Mirror the shell's roster read (nativeAgentClient): a NAMED refusal is an
 * expected outcome in live mode — the shell must disclose it, never swallow
 * it. Returns {ok, refusal, error}; refusal carries the kernel's error text. */
export async function rosterViaBridge(bridgeUrl) {
  // The roster read resolves the agent location through the kernel's own
  // owner chain; give it the same cold-read generosity as agency_read.
  const body = await postOp(bridgeUrl, {op: 'agent_definition', project: null, request: {action: 'roster'}}, 180000)
  if (!body || body.ok !== true || body.outcome?.result !== 'agent_definition_reading') {
    return {ok: false, refusal: body?.error ?? 'agent_definition refused or malformed', error: null}
  }
  return {ok: true, refusal: null, error: null}
}

// ---------------------------------------------------------------------------
// checks

export function makeChecker() {
  const observations = []
  const faults = []
  const withheld = []
  const check = async (name, run, tags = {}) => {
    try {
      await run()
      observations.push({name, ...tags})
    } catch (error) {
      faults.push({name, ...tags, error: error instanceof Error ? error.message : String(error)})
    }
  }
  const withhold = (name, reason, tags = {}) => withheld.push({name, reason, ...tags})
  return {observations, faults, withheld, check, withhold}
}

export async function writeReceipt(path, receipt) {
  await writeFile(path, JSON.stringify(receipt, null, 2))
}

export function summarize(name, {observations, faults, withheld, captures}) {
  return {name, observations: observations.length, faults: faults.length, withheld: withheld.length, captures}
}

// ---------------------------------------------------------------------------
// the fixture refusal battery — the only thing the fixture suite asserts

export const FIXTURE_REASON = 'kernel not attached — refusal harness'

export async function runFixtureHarness({evidence}) {
  await ensureEvidenceDir(evidence)
  const fixtureEntry = await bundleEntry({
    contents: `import ${JSON.stringify(join(ui, 'src/agent/agentShellFixture.tsx'))};\n`,
    resolveDir: join(ui, 'src/agent'),
    sourcefile: 'agent-shell-fixture-entry.tsx',
    outfile: 'agent-shell-fixture.mjs',
  })
  const {url, close} = await serveShellPage({html: shellHtml(fixtureEntry), kernelBridge: CUT_BRIDGE})
  const {browser, page, browserErrors, pageErrors} = await launchShell({width: 1920, height: 1200})
  const checker = makeChecker()
  const captures = []
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded'})
    await page.waitForSelector('#play', {timeout: 20000})

    await checker.check('fixture mounted', async () => {
      assert.equal(await page.evaluate(() => window.__agentShellFixture === true), true)
    })
    await checker.check('unavailable transport disclosed in the browser device pool', async () => {
      await page.waitForFunction(() => {
        const el = document.querySelector('.agent-device-pool .agent-disclosed')
        return !!el && el.textContent.includes('kernel not attached')
      }, undefined, {timeout: 8000})
    })
    await checker.check('unavailable transport disclosed in the context dock tile', async () => {
      await page.waitForFunction(() => {
        const el = document.querySelector('.native-context-panel .native-error')
        return !!el && el.textContent.includes('kernel not attached')
      }, undefined, {timeout: 8000})
    })
    await checker.check('session grid discloses the absent SessionSpace reading', async () => {
      const text = await page.locator('.view-empty').innerText()
      assert.ok(text.includes('No SessionSpace sessions disclosed'), text)
    })
    await checker.check('no fabricated session tracks', async () => {
      assert.equal(await page.locator('.agent-track').count(), 0)
    })
    await checker.check('no fabricated rows (no Porting, no Honey)', async () => {
      const text = await page.evaluate(() => document.body.innerText)
      assert.ok(!text.includes('Porting'), 'fake "Porting" row present')
      assert.ok(!text.includes('Honey'), 'fake "Honey" row present')
    })
    await checker.check('telemetry reads honest absence (tokens in)', async () => {
      assert.equal((await page.locator('#tokIn').innerText()).trim(), '—')
    })
    await checker.check('telemetry reads honest absence (tokens out)', async () => {
      assert.equal((await page.locator('#tokOut').innerText()).trim(), '—')
    })
    await checker.check('budget reads honest absence', async () => {
      assert.equal((await page.locator('#budget').innerText()).trim(), '— / —')
    })
    await checker.check('position reads honest absence', async () => {
      assert.equal((await page.locator('#position').innerText()).trim(), '— . — . —')
    })
    await checker.check('spend meter shows no fabricated fill', async () => {
      const fill = await page.evaluate(() => getComputedStyle(document.querySelector('.cpu-meter')).getPropertyValue('--fill').trim())
      assert.equal(fill, '', `cpu meter carries a fill: ${fill}`)
    })
    await checker.check('no uncaught page errors', async () => {
      assert.deepEqual(pageErrors, [])
    })

    const shot = join(evidence, 'fixture-refusal-1920x1200.png')
    await page.screenshot({path: shot, fullPage: true})
    captures.push('fixture-refusal-1920x1200.png')
  } finally {
    await writeReceipt(join(evidence, 'receipt.json'), {
      schema: 'oi.agent-shell-fidelity-f2/v2',
      mode: 'fixture',
      oracle: null,
      observations: checker.observations,
      faults: checker.faults,
      withheld: checker.withheld,
      captures,
      browserErrors,
      pageErrors,
      evidence,
      at: new Date().toISOString(),
    })
    await browser.close()
    await close()
  }
  return checker
}
