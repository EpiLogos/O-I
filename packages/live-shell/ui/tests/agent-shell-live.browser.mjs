/**
 * F2 live fidelity harness — the REAL native.agent shell against the F1
 * oracle (new-shell/agent-shell-fidelity.json).
 *
 * Modes:
 *   --live                        page runs the real app; its readShellConfig()
 *                                 gets kernel_bridge from this harness's
 *                                 /api/config and drives REAL kernel ops over
 *                                 the bridge (OI_KERNEL_BRIDGE, default the
 *                                 walk-bridge http://127.0.0.1:4179).
 *   --cut                         same page, bridge forced to a closed port
 *                                 (http://127.0.0.1:9): asserts the shell's
 *                                 honest refusal states, records which
 *                                 native-required checks cannot hold, exit 0.
 *   --fixture                     offline disclosure checks against the
 *                                 repurposed refusal fixture (no kernel).
 *   --expect-live-red-when-cut    runs the FULL live battery against the dead
 *                                 bridge and REQUIRES the suite to go red.
 *                                 Any native-dependent (native:true) check
 *                                 that passes against a dead bridge is a fake
 *                                 assertion → exit 1.
 *   (no flag)                     --live when OI_KERNEL_BRIDGE answers
 *                                 agency_read, else --cut.
 *
 * Live entry: the real App root (src/App.tsx) under the real providers, the
 * same tree main.tsx mounts — WorkspaceProvider + NativeFoundation resolve
 * the transport from the served /api/config and attach it to the workspace;
 * the centre panel native.agent (AgentShellCentre), AgentShellTransport,
 * StatusBar, AgentShellBrowser and AgentShellDeviceDetail are the shipped
 * components over the real kernelOp path. No stub providers.
 *
 * Env: OI_KERNEL_BRIDGE, OI_AGENT_SHELL_ORACLE, OI_FIDELITY_EVIDENCE,
 *      OI_STATUS_INFO_SELECTOR (status-bar info node for the hover law;
 *      default '[data-region="status-bar"] .statusbar-info'),
 *      OI_CHROME, OI_BROWSER_RUNTIME.
 * Receipt: <evidence>/receipt.json, schema oi.agent-shell-fidelity-f2/v2.
 */

import assert from 'node:assert/strict'
import {join} from 'node:path'
import {
  ui, loadOracle, ensureEvidenceDir, bundleEntry, shellHtml, serveShellPage,
  launchShell, makeChecker, writeReceipt, summarize,
  agencyReadViaBridge, spendViaBridge, rosterViaBridge, probeBridge, postOp,
  runFixtureHarness, EVIDENCE_LIVE_DEFAULT, BRIDGE_DEFAULT, CUT_BRIDGE, STATUS_INFO_SELECTOR, AGENCY_PROJECT,
} from './support/agentShellHarness.mjs'

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const evidenceArg = flag('--evidence') ? args[args.indexOf('--evidence') + 1] : null

// The real entry: what main.tsx mounts, without the detached/close hosts.
// NativeFoundation reads /api/config from the harness server and attaches
// the resulting bridge transport to the workspace — the real dev path.
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
Object.assign(window, {__agentShellLive: true})
`

// Quote-insensitive: Chrome serialises custom-property string tokens with
// double quotes where the oracle authors single ones (--mono). Text compares
// use typographic apostrophes, which this leaves alone.
const normalise = value => String(value ?? '').replace(/\s+/g, ' ').replace(/['"]/g, '').trim().toLowerCase()

/** The full battery, declared. Every check claiming native liveness carries
 * kind:'live' and asserts the Node-side bridge reading succeeded FIRST —
 * a dead bridge can never green-light it. kind:'fidelity' checks are the
 * oracle-fidelity claims (tokens, geometry, hover law); kind:'structural'
 * and kind:'disclosure' hold regardless of the bridge. */
function declareBattery({page, oracle, checker, reads, statusInfoSelector}) {
  return [
    {
      name: 'live app mounted', kind: 'structural',
      run: async () => {
        assert.equal(await page.evaluate(() => window.__agentShellLive === true), true)
      },
    },
    {
      name: 'agent shell opens from the Agent nav control', kind: 'structural',
      run: async () => {
        await page.waitForSelector('button[aria-label="Agent"]', {timeout: 45000})
        await page.click('button[aria-label="Agent"]')
        await page.waitForSelector('.frame.agent-shell-frame[data-agent-shell="true"]', {timeout: 15000})
        await page.waitForSelector('[data-region="transport"] #play', {timeout: 15000})
        const centreShown = () => page.waitForFunction(() => {
          const shown = [...document.querySelectorAll('main.center .inhabitant')].filter(el => !el.hidden)
          return shown.length > 0 && shown.every(el =>
            !!el.querySelector('.agent-shell-centre, .view-empty, .agent-arr'))
        }, undefined, {timeout: 3000}).then(() => true).catch(() => false)
        if (!await centreShown()) {
          // The centre resident presents only once the shell has left the
          // audio working surface (openCenterPanel switches mode for every
          // other panel; named to the integrator): enter it the way a user
          // does, then re-enter the agent shell.
          await page.click('button[aria-label="Expressions"]')
          await page.waitForTimeout(200)
          await page.click('button[aria-label="Agent"]')
          await page.waitForSelector('.frame.agent-shell-frame[data-agent-shell="true"]', {timeout: 15000})
          await page.waitForFunction(() => {
            const shown = [...document.querySelectorAll('main.center .inhabitant')].filter(el => !el.hidden)
            return shown.length > 0 && shown.every(el =>
              !!el.querySelector('.agent-shell-centre, .view-empty, .agent-arr'))
          }, undefined, {timeout: 15000})
        }
      },
    },
    {
      name: 'the six oracle regions are present', kind: 'fidelity',
      run: async () => {
        for (const region of oracle.regions) {
          assert.ok(await page.locator(`[data-region="${region}"]`).count() >= 1, `missing [data-region="${region}"]`)
        }
      },
    },
    {
      name: 'all 18 transport orderHint ids present in oracle order', kind: 'fidelity',
      run: async () => {
        const order = await page.evaluate(wanted => {
          const set = new Set(wanted)
          return [...document.querySelectorAll('[data-region="transport"] [id]')]
            .map(el => el.id).filter(id => set.has(id))
        }, oracle.transport.orderHint)
        assert.deepEqual(order, oracle.transport.orderHint)
      },
    },
    {
      name: 'transport controls carry the oracle label|function hooks', kind: 'fidelity',
      run: async () => {
        const expected = new Map(oracle.controls
          .filter(control => control.id && control.hook === 'data-i')
          .map(control => [control.id, `${control.label}|${control.function}`]))
        for (const id of oracle.transport.orderHint) {
          const want = expected.get(id)
          if (!want) continue
          const have = await page.locator(`#${id}`).getAttribute('data-i')
          assert.equal(normalise(have), normalise(want), `#${id} data-i`)
        }
      },
    },
    {
      name: 'frame fills the 1920x1200 viewport', kind: 'structural',
      run: async () => {
        const box = await page.locator('.frame.agent-shell-frame').boundingBox()
        assert.ok(box, 'no agent-shell-frame box')
        assert.ok(Math.abs(box.width - 1920) < 2, `width ${box.width}`)
        assert.ok(Math.abs(box.height - 1200) < 2, `height ${box.height}`)
      },
    },
    {
      name: 'frame grid matches oracle geometry', kind: 'fidelity',
      run: async () => {
        const styles = await page.evaluate(() => {
          const computed = getComputedStyle(document.querySelector('.frame.agent-shell-frame'))
          return {
            columns: computed.gridTemplateColumns.split(' ').filter(Boolean),
            rows: computed.gridTemplateRows.split(' ').filter(Boolean),
            dock: computed.getPropertyValue('--dock-w').trim(),
            transport: computed.getPropertyValue('--transport-h').trim(),
            detail: computed.getPropertyValue('--detail-h').trim(),
          }
        })
        assert.equal(styles.columns[0], '400px', `browser column ${styles.columns[0]}`)
        assert.equal(styles.columns[2], '300px', `dock column ${styles.columns[2]}`)
        assert.equal(styles.rows[0], '64px', `transport row ${styles.rows[0]}`)
        assert.equal(styles.rows[2], '300px', `detail row ${styles.rows[2]}`)
        assert.equal(styles.rows[3], '28px', `status row ${styles.rows[3]}`)
        assert.equal(styles.dock, '300px', '--dock-w')
        assert.equal(styles.transport, '64px', '--transport-h')
        assert.equal(styles.detail, '300px', '--detail-h')
      },
    },
    {
      name: 'oracle tokens hold on the agent frame surface', kind: 'live',
      run: async () => {
        // The oracle's :root tokens are the mockup's frame scope. In the real
        // app the agent frame is the scoped surface (the token block on
        // .frame.agent-shell-frame in agentShell.css; styles.css globals stay
        // for the rest of the shell — the logged deviation). Token equality
        // must hold with the agent shell OPEN: a missing frame element, or one
        // without the class, is a fault, not a skip.
        const actual = await page.evaluate(names => {
          const el = document.querySelector('[data-agent-shell="true"]')
            ?? document.querySelector('.frame.agent-shell-frame')
          if (!el) return {fault: 'no element carries [data-agent-shell="true"] (fallback .frame.agent-shell-frame)'}
          if (!el.classList.contains('agent-shell-frame')) {
            return {fault: `frame element lacks the agent-shell-frame class (${String(el.className)})`}
          }
          const computed = getComputedStyle(el)
          return {tokens: Object.fromEntries(names.map(name => [name, computed.getPropertyValue(name)]))}
        }, Object.keys(oracle.tokens))
        if (actual.fault) throw new Error(actual.fault)
        const mismatches = Object.keys(oracle.tokens)
          .filter(name => normalise(actual.tokens[name]) !== normalise(oracle.tokens[name]))
          .map(name => `${name}: want ${oracle.tokens[name]}, have ${actual.tokens[name] || '(unset)'}`)
        assert.deepEqual(mismatches, [])
      },
    },
    {
      name: 'hover law: control data-i lands in the status bar info', kind: 'fidelity',
      run: async () => {
        const control = oracle.controls.find(row => row.id === 'tap')
        assert.ok(control, 'oracle has #tap')
        await page.hover('#tap')
        await page.waitForTimeout(150)
        const info = await page.locator(statusInfoSelector).first().innerText()
        assert.ok(normalise(info).includes(normalise(control.label)), `info lacks label "${control.label}": "${info}"`)
        assert.ok(normalise(info).includes(normalise(control.function)), 'info lacks function text')
      },
    },
    {
      name: `live: agency_read answered the kernel bridge (${reads.bridge})`, kind: 'live', native: true,
      run: async () => {
        assert.equal(reads.node.ok, true, `agency_read via ${reads.bridge}: ${reads.node.error ?? 'refused'}`)
      },
    },
    {
      name: 'live: rendered session tracks equal the run model over agency_read', kind: 'live', native: true,
      run: async () => {
        assert.equal(reads.node.ok, true, 'agency_read did not answer the bridge')
        // agentRunModel.buildTracks: one group container per SessionSpace,
        // one track per session row, plus the Main section (excluded here).
        const expectedTracks = new Set(reads.node.rows.map(row => row.spaceRef)).size + reads.node.rows.length
        await page.waitForFunction(target =>
          document.querySelectorAll('.agent-track:not(.session-main)').length === target,
        expectedTracks, {timeout: 240000})
        const rendered = await page.locator('.agent-track:not(.session-main)').count()
        assert.equal(rendered, expectedTracks, `rendered ${rendered}, run model over agency_read expects ${expectedTracks}`)
      },
    },
    {
      name: 'live: browser session rows equal agency_read rows', kind: 'live', native: true,
      run: async () => {
        assert.equal(reads.node.ok, true, 'agency_read did not answer the bridge')
        // The browser reads the same bridge through its own poll; a cold read
        // queues behind the kernel's serial owner calls, so wait for the two
        // views of one source to converge rather than snapshotting once.
        await page.waitForFunction(
          expected => document.querySelectorAll('.agent-shell-browser .browser-results .browser-item').length === expected,
          reads.node.rows.length, {timeout: 240000},
        )
        const rendered = await page.locator('.agent-shell-browser .browser-results .browser-item').count()
        assert.equal(rendered, reads.node.rows.length, `browser shows ${rendered}, bridge disclosed ${reads.node.rows.length}`)
      },
    },
    {
      name: 'live: spend meter matches the bridge spend source or discloses absence', kind: 'live', native: true,
      run: async () => {
        assert.equal(reads.node.ok, true, 'agency_read did not answer the bridge')
        const fill = await page.evaluate(() =>
          getComputedStyle(document.querySelector('[data-region="transport"] .cpu-meter')).getPropertyValue('--fill').trim())
        if (!reads.metrics?.ok || reads.metrics.spend === null) {
          assert.equal(fill, '', `bridge disclosed no spend source but the meter carries fill "${fill}"`)
        } else {
          assert.equal(fill, `${Math.round(reads.metrics.spend * 100)}%`, 'spend fill does not match the bridge reading')
        }
      },
    },
    {
      name: 'live: a named roster refusal is disclosed, never swallowed', kind: 'live', native: true,
      run: async () => {
        assert.equal(reads.node.ok, true, 'agency_read did not answer the bridge')
        if (!reads.roster.refusal) return // the bridge served the roster; nothing to disclose
        const text = await page.evaluate(() => document.body.innerText)
        const code = reads.roster.refusal.split(':')[0].trim()
        assert.ok(code.length > 3 && text.includes(code),
          `bridge refused the roster (${reads.roster.refusal}) but the shell discloses no such line; body tail: ${JSON.stringify(text.slice(-400))}; disclosure el: ${await page.evaluate(() => { const el = document.querySelector('[data-region="agent-disclosures"]'); return el ? el.innerText.slice(0, 120) : 'ABSENT' })}`)
      },
    },
    {
      name: 'no fabricated rows (no Porting, no Honey)', kind: 'disclosure',
      run: async () => {
        const text = await page.evaluate(() => document.body.innerText)
        assert.ok(!text.includes('Porting'), 'fake "Porting" row present')
        assert.ok(!text.includes('Honey'), 'fake "Honey" row present')
      },
    },
    {
      name: 'no uncaught page errors', kind: 'structural',
      run: async () => {
        assert.deepEqual(reads.pageErrors, [], 'uncaught page errors')
      },
    },
    {
      name: 'compact 700x1200: browser column collapses to 0px', kind: 'structural',
      run: async () => {
        await page.setViewportSize({width: 700, height: 1200})
        await page.waitForTimeout(250)
        const columns = await page.evaluate(() =>
          getComputedStyle(document.querySelector('.frame.agent-shell-frame')).gridTemplateColumns)
        assert.ok(columns.startsWith('0px'), `first grid track at 700px is ${columns.split(' ')[0]}`)
      },
    },
    {
      name: 'compact 700x1200: browser column hidden', kind: 'structural',
      run: async () => {
        const display = await page.evaluate(() =>
          getComputedStyle(document.querySelector('.agent-shell-browser')).display)
        assert.equal(display, 'none')
      },
    },
  ]
}

const CUT_REFUSAL_CHECKS = page => [
  {
    name: 'cut: browser discloses the refused agency reading', kind: 'disclosure',
    run: async () => {
      await page.waitForFunction(() => {
        const el = document.querySelector('.agent-shell-browser .browser-results .native-error')
        return !!el && el.textContent.trim().length > 0
      }, undefined, {timeout: 15000})
    },
  },
  {
    name: 'cut: centre discloses the absent SessionSpace reading', kind: 'disclosure',
    run: async () => {
      await page.waitForFunction(() =>
        [...document.querySelectorAll('.view-empty')]
          .some(el => el.textContent.includes('No SessionSpace sessions disclosed')
            || el.textContent.includes('Native transport unavailable')),
      undefined, {timeout: 15000})
    },
  },
  {
    name: 'cut: telemetry reads honest absence', kind: 'disclosure',
    run: async () => {
      assert.equal((await page.locator('#tokIn').innerText()).trim(), '—')
      assert.equal((await page.locator('#tokOut').innerText()).trim(), '—')
      assert.equal((await page.locator('#budget').innerText()).trim(), '— / —')
    },
  },
  {
    name: 'cut: spend meter shows no fabricated fill', kind: 'disclosure',
    run: async () => {
      const fill = await page.evaluate(() =>
        getComputedStyle(document.querySelector('[data-region="transport"] .cpu-meter')).getPropertyValue('--fill').trim())
      assert.equal(fill, '', `dead bridge but the meter carries fill "${fill}"`)
    },
  },
]

async function runNativeHarness({mode}) {
  const bridge = mode === 'live' ? BRIDGE_DEFAULT : CUT_BRIDGE
  const evidence = await ensureEvidenceDir(evidenceArg ?? EVIDENCE_LIVE_DEFAULT)
  const oracle = await loadOracle()
  const bundle = await bundleEntry({
    contents: LIVE_ENTRY,
    resolveDir: join(ui, 'src'),
    sourcefile: 'agent-shell-live-entry.tsx',
    outfile: 'agent-shell-live.mjs',
  })
  const {url, close} = await serveShellPage({html: shellHtml(bundle), kernelBridge: bridge})
  // Warm the kernel's owner paths before the page competes for them: the
  // bridge serialises ops behind the kernel and each first touch runs an
  // owner subprocess for tens of seconds. Same ops the page will issue,
  // sequenced and timed; the page's own reads then answer in seconds.
  const warmup = []
  if (mode === 'live') {
    for (const [name, op] of [
      ['agency_read', {op: 'agency_read', project: AGENCY_PROJECT}],
      ['harness_status', {op: 'harness_status'}],
      ['git_repository_read', {op: 'git_repository_read', project: AGENCY_PROJECT}],
      ['workcell_status_read', {op: 'workcell_status_read'}],
    ]) {
      const started = Date.now()
      try { await postOp(bridge, op, 180000); warmup.push(`${name}: ${Date.now() - started}ms`) }
      catch { warmup.push(`${name}: failed`) }
    }
  }
  const shell = await launchShell({width: 1920, height: 1200})
  const {page, browserErrors, pageErrors, probeLog} = shell
  const checker = makeChecker()
  const captures = []
  let roster = {ok: false, refusal: null, error: 'not read'}
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded'})
    await page.waitForSelector('body', {timeout: 20000})

    // Node reads the same ops the page is about to issue.
    const node = await agencyReadViaBridge(bridge, AGENCY_PROJECT)
    const firstSession = node.rows[0]?.sessionRef ?? null
    const metrics = firstSession ? await spendViaBridge(bridge, firstSession, AGENCY_PROJECT) : null
    roster = await rosterViaBridge(bridge)
    const reads = {bridge, node, metrics, roster, pageErrors}

    const battery = declareBattery({page, oracle, checker, reads, statusInfoSelector: STATUS_INFO_SELECTOR})
    const executable = mode === 'cut' ? new Set(['structural', 'disclosure']) : null
    for (const entry of battery) {
      if (executable && !executable.has(entry.kind)) {
        checker.withhold(entry.name, `not proven in --cut: requires a live kernel bridge (tried ${bridge})`, {kind: entry.kind})
        continue
      }
      await checker.check(entry.name, entry.run, {kind: entry.kind, ...(entry.native ? {native: true} : {})})
      if (entry.name === 'frame fills the 1920x1200 viewport') {
        await page.screenshot({path: join(evidence, 'desktop-1920x1200.png'), fullPage: true})
        captures.push('desktop-1920x1200.png')
      }
    }

    if (mode === 'cut') {
      for (const entry of CUT_REFUSAL_CHECKS(page)) await checker.check(entry.name, entry.run, {kind: entry.kind})
    }

    const compactShot = join(evidence, 'compact-700x1200.png')
    await page.screenshot({path: compactShot, fullPage: true})
    captures.push('compact-700x1200.png')
  } catch (error) {
    checker.faults.push({name: 'harness run', error: String(error)})
    await page.screenshot({path: join(evidence, 'failure.png'), fullPage: true}).catch(() => {})
  } finally {
    await writeReceipt(join(evidence, 'receipt.json'), {
      schema: 'oi.agent-shell-fidelity-f2/v2',
      mode,
      bridge,
      project: AGENCY_PROJECT,
      expectedRefusals: roster.refusal ? [{op: 'agent_definition roster', refusal: roster.refusal, disclosure: 'required'}] : [],
      oracle: {source: oracle.source, revision: oracle.revision},
      observations: checker.observations,
      warmup,
      faults: checker.faults,
      withheld: checker.withheld,
      captures,
      browserErrors,
      pageErrors,
      probeLog,
      evidence,
      at: new Date().toISOString(),
    })
    await shell.browser.close()
    await close()
  }
  return checker
}

/** The red proof: the full live battery against the dead bridge. The suite
 * MUST go red, and every NATIVE-dependent check (native:true) must be among
 * the faults — a bridge-bound assertion that survives a dead bridge is a
 * fake. Bridge-independent live checks (e.g. the scoped token equality on
 * the agent frame) legitimately still pass; the proof does not count them. */
async function runRedProof() {
  const evidence = await ensureEvidenceDir(evidenceArg ?? EVIDENCE_LIVE_DEFAULT)
  const checker = await runNativeHarness({mode: 'red'})
  const nativeChecksRun = checker.observations.filter(row => row.native)
    .concat(checker.faults.filter(row => row.native))
  const passedNative = checker.observations.filter(row => row.native)
  const proved = checker.faults.length > 0 && nativeChecksRun.length > 0 && passedNative.length === 0
  const receipt = {
    schema: 'oi.agent-shell-fidelity-f2/red-proof/v1',
    deadBridge: CUT_BRIDGE,
    proved,
    nativeChecksRun: nativeChecksRun.length,
    faults: checker.faults,
    passedNativeChecks: passedNative,
    observations: checker.observations,
    withheld: checker.withheld,
    note: proved
      ? 'Every native-dependent check went red against the dead bridge; the live assertions are bound to the real kernel connection.'
      : 'NOT PROVED: the suite did not go red, or a native-dependent check passed against a dead bridge (a fake assertion).',
    at: new Date().toISOString(),
  }
  await writeReceipt(join(evidence, 'red-when-cut-receipt.json'), receipt)
  if (!proved) {
    console.error(JSON.stringify(receipt, null, 2))
    process.exit(1)
  }
  console.log(JSON.stringify({ok: true, redProof: 'proved', faults: checker.faults.length, nativeChecksRun: nativeChecksRun.length, evidence}, null, 2))
}

// ---------------------------------------------------------------------------

let mode = flag('--live') ? 'live'
  : flag('--cut') ? 'cut'
  : flag('--fixture') ? 'fixture'
  : flag('--expect-live-red-when-cut') ? 'red'
  : null

if (!mode) {
  const reachable = await probeBridge(BRIDGE_DEFAULT)
  mode = reachable ? 'live' : 'cut'
  console.error(`[agent-shell-live] no mode flag; OI_KERNEL_BRIDGE ${reachable ? '' : 'un'}reachable → --${mode}`)
}

let checker
let evidence
if (mode === 'fixture') {
  evidence = evidenceArg ?? EVIDENCE_LIVE_DEFAULT
  checker = await runFixtureHarness({evidence})
} else if (mode === 'red') {
  await runRedProof()
  process.exit(0)
} else {
  checker = await runNativeHarness({mode})
  evidence = evidenceArg ?? EVIDENCE_LIVE_DEFAULT
}

const summary = summarize(`agent-shell-f2 ${mode}`, checker)
if (checker.faults.length) {
  console.error(JSON.stringify({...summary, faults: checker.faults, withheld: checker.withheld}, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({...summary, ok: true, evidence}, null, 2))
