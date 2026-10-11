/**
 * Agent-native P0 ligaments — the headless capture walk (lane
 * zcode:agent-native-p0, 2026-10-11).
 *
 * The commission's evidence bar: a headless capture of a BOUND SLOT FIRING
 * and a REFUSAL, at both widths. The stage is the real agent-shell
 * transport (the Factory mode's own bar) with the family admission, the
 * verified-table adoption and the setter bridge mounted — the same modules
 * the shell runs. The local harness answers the kernel's
 * harness_agent_control with a canned owner outcome, so the fired capture
 * shows a real dispatch → receipt round trip; the heartbeat press shows the
 * honest refusal naming its owner op (the cron stratum, WO-A3) — a refusal
 * that needs no kernel at all, which is exactly its honesty.
 *
 * Run: node tests/agent-native-p0.browser.mjs [--evidence <dir>]
 */
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdirSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  bundleEntry, inlineModuleSafe, launchShell, writeReceipt,
} from './support/agentShellHarness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(here, 'artifacts', 'agent-native-p0')
mkdirSync(evidence, {recursive: true})

// The entry: the real transport over the real admission + adoption + the
// P0 batch, the setter bridge mounted by the transport itself.
const entry = await bundleEntry({
  contents: `
import {useState, type CSSProperties} from 'react'
import {createRoot} from 'react-dom/client'
import {StubWorkspaceProvider} from '../shell/workspaceContext'
import {AgentShellProvider} from './AgentShellContext'
import {AgentShellTransport} from './AgentShellTransport'
import {loadAgentShellFamilies} from '../inhabitants/loadAgentShellFamilies'
import {adoptVerifiedRows} from '../inhabitants/sdk/adoptVerifiedRows'
import {loadAgentNativeP0} from '../inhabitants/agentNativeP0'
import '../styles.css'
import './agentShell.css'

loadAgentShellFamilies()
adoptVerifiedRows()
loadAgentNativeP0()

const TRANSPORT = {kind: 'bridge', url: window.__KERNEL_BRIDGE__}

function Stage() {
  const [browser, setBrowser] = useState(false)
  const [detail, setDetail] = useState(true)
  const [dock, setDock] = useState(false)
  return (
    <div className="frame agent-shell-frame" style={{['--dock-w' as string]: '300px'} as CSSProperties} data-agent-shell="true">
      <AgentShellTransport
        title="Agent sessions — P0 ligaments harness"
        browser={browser}
        detail={detail}
        dock={dock}
        toggleBrowser={() => setBrowser(value => !value)}
        toggleDetail={() => setDetail(value => !value)}
        toggleDock={() => setDock(value => !value)}
        onCentreView={() => {}}
        centreView="session"
        transport={TRANSPORT}
      />
      <main style={{padding: 20, color: 'var(--text-dim)'}}>
        <p data-region="p0-harness-note">Press ‹› (factory tempo → effort), the heartbeat, the steer toggle, the write arm or the quantize — each dispatches through its binding and renders the owner's receipt or its named refusal on the transport note line.</p>
      </main>
    </div>
  )
}

window.__agentShellP0 = true
createRoot(document.getElementById('root')!).render(
  <StubWorkspaceProvider transport={{kind: 'bridge', url: window.__KERNEL_BRIDGE__}}>
    <AgentShellProvider>
      <Stage />
    </AgentShellProvider>
  </StubWorkspaceProvider>,
)
`,
  resolveDir: join(here, '..', 'src', 'agent'),
  sourcefile: 'agent-native-p0-entry.tsx',
  outfile: 'agent-native-p0.browser.mjs',
})

// The local kernel: answers harness_agent_control with a canned owner
// outcome (the fired capture's round trip); everything else refuses, named.
const server = createServer((request, response) => {
  if ((request.url ?? '/').split('?')[0] === '/op' && request.method === 'POST') {
    let body = ''
    request.on('data', chunk => { body += chunk })
    request.on('end', () => {
      const op = JSON.parse(body || '{}')
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (op.op === 'harness_agent_control' && op.control === 'configure') {
        response.end(JSON.stringify({
          ok: true,
          outcome: {result: 'harness_agent_outcome', binding: op.binding, control: 'configure', document: {state: 'configured', value: op.value ?? {}}},
        }))
      } else if (op.op === 'harness_agent_control') {
        response.end(JSON.stringify({
          ok: true,
          outcome: {result: 'harness_agent_outcome', binding: op.binding, control: op.control, document: {state: `${op.control} acknowledged`}},
        }))
      } else if (op.op === 'harness_status') {
        response.end(JSON.stringify({ok: true, outcome: {result: 'harness_status_reading', data: {harnesses: [{id: 'hermes', binding: 'cursor'}]}}}))
      } else {
        response.end(JSON.stringify({ok: false, error: `the P0 harness kernel carries no ${op.op}`}))
      }
    })
    return
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${entry.css}</style></head><body><div id="root"></div><script>window.__KERNEL_BRIDGE__=${JSON.stringify(`http://127.0.0.1:${request.socket.localPort}`)};</script><script type="module">${inlineModuleSafe(entry.js)}</script></body></html>`)
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}`

const observations = []
const faults = []
const captures = []
const receipts = {}

async function captureAt(width, height, label) {
  const {browser, page, pageErrors} = await launchShell({width, height})
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded'})
    await page.waitForSelector('#effUp', {timeout: 20000})
    assert.equal(await page.evaluate(() => window.__agentShellP0 === true), true)
    observations.push(`${label}: mounted`)

    // A BOUND SLOT FIRING: factory tempo → effort, ‹ › steps the armed
    // value; the bridge dispatches configure {effort} and the kernel's
    // canned outcome renders as the receipt note.
    await page.click('#effUp')
    await page.waitForFunction(() => {
      const note = document.querySelector('.agent-transport-note')
      return !!note && note.textContent.includes('configure')
    }, undefined, {timeout: 8000})
    const firedLine = (await page.locator('.agent-transport-note').innerText()).trim()
    receipts[`${label}-fired-effort`] = firedLine
    observations.push(`${label}: bound slot (factory/tempo → effort) FIRED — note: ${firedLine}`)
    await page.screenshot({path: join(evidence, `p0-fired-${label}.png`), fullPage: true})
    captures.push(`p0-fired-${label}.png`)

    // A REFUSAL: the heartbeat's owner op is the cron stratum (WO-A3) —
    // the refusal is local, named, and needs no kernel. This IS its
    // honesty: no carrier pretends a fire.
    await page.click('#hb')
    await page.waitForFunction(() => {
      const note = document.querySelector('.agent-transport-note')
      return !!note && note.textContent.includes('Refused')
    }, undefined, {timeout: 8000})
    const refusedLine = (await page.locator('.agent-transport-note').innerText()).trim()
    receipts[`${label}-refused-heartbeat`] = refusedLine
    observations.push(`${label}: heartbeat REFUSED with its owner op named — note: ${refusedLine}`)
    await page.screenshot({path: join(evidence, `p0-refused-${label}.png`), fullPage: true})
    captures.push(`p0-refused-${label}.png`)

    assert.deepEqual(pageErrors, [], `${label}: no uncaught page errors`)
    observations.push(`${label}: no uncaught page errors`)
  } catch (error) {
    faults.push({label, error: error instanceof Error ? error.message : String(error)})
  } finally {
    await browser.close()
  }
}

await captureAt(1920, 1200, '1920x1200')
await captureAt(700, 900, '700x900')

await server.closeAllConnections?.()
await new Promise(done => server.close(done))

await writeReceipt(join(evidence, 'receipt.json'), {
  schema: 'oi.agent-native-p0-captures/v1',
  lane: 'zcode:agent-native-p0',
  dispatched_by: 'zcode:world-shell-orchestrator',
  at: new Date().toISOString(),
  stage: 'the real AgentShellTransport over the real family admission + verified-table adoption + P0 batch; the setter bridge mounted; the local kernel answers harness_agent_control with a canned owner outcome',
  observations,
  faults,
  captures,
  receipts,
})
console.log(`[agent-native-p0] observations: ${observations.length}, faults: ${faults.length}`)
for (const fault of faults) console.error(`FAULT: ${fault.label}: ${fault.error}`)
process.exit(faults.length ? 1 : 0)
