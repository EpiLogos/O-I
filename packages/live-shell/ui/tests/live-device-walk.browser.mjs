/**
 * Live-mode device walk — SCRIPTED browser capture (computer use is blocked
 * machine-wide; this driver is playwright, channel-labelled).
 *
 * The owed half of the UI round's verification recipe (integration map
 * §D.6): the round-1 walk proved the SDK face kit, but the LIVE-MODE walk
 * was still owed — it needs the real shell frame, the M3 device seam and a
 * set that carries the devices. This walk runs the real App root (the tree
 * main.tsx mounts) against a local fixture owner answering /api/set and
 * the three M3 endpoints (tests/support/liveDeviceFixture.mjs — Compressor2
 * + Overdrive + Redux2, the faces the round added).
 *
 * It walks: live mode stands (the audio cut's frame and browser pane), the
 * device detail opens from the status bar's Device toggle, the three faces
 * render their parameter rows (lossless stored values, the stored unit, a
 * row the set does not carry shown as its honest "not stored" state), one
 * parameter is edited through the real POST route (Overdrive Tone → 42)
 * and the round-trip is asserted both on the panel (persisted value +
 * saved mark) and from Node against the fixture owner's own state and POST
 * log.
 *
 * Run: node tests/live-device-walk.browser.mjs [--evidence <dir>]
 */
import assert from 'node:assert/strict'
import {mkdirSync, writeFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  ui, bundleEntry, shellHtml, serveShellPage, launchShell,
} from './support/agentShellHarness.mjs'
import {createDeviceFixtureOwner, FIXTURE_SET_PATH, FIXTURE_TRACK} from './support/liveDeviceFixture.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(here, 'artifacts', 'live-device-walk')
mkdirSync(join(evidence, 'captures'), {recursive: true})

// The real entry: what main.tsx mounts (the agent-shell-live suite's own
// entry, minus the detached/close hosts — neither is this walk's subject).
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
Object.assign(window, {__liveDeviceWalk: true})
`

const entry = await bundleEntry({
  contents: LIVE_ENTRY,
  resolveDir: join(ui, 'src'),
  sourcefile: 'live-device-walk-entry.tsx',
  outfile: 'live-device-walk.mjs',
})

// The fixture owner answers /api/set and the M3 endpoints; the harness's
// config host answers /api/config with the fixture set as the default set
// (no kernel_bridge — the fixture is not a kernel owner, and the shell
// discloses that absence honestly instead of failing fetches).
const owner = createDeviceFixtureOwner()
const {url, close} = await serveShellPage({html: shellHtml(entry), defaultSet: FIXTURE_SET_PATH, api: owner.handle})

const results = {schema: 'oi.device-live-walk/v1', recorded_at: new Date().toISOString(), channel: 'scripted-playwright (computer use blocked machine-wide)', url, steps: [], browserErrors: [], pageErrors: []}
const step = (name, detail) => {results.steps.push({name, ...detail}); console.log(`+ ${name}${detail.detail ? ` — ${detail.detail}` : ''}`)}

const {browser, page, browserErrors, pageErrors} = await launchShell({width: 1440, height: 900})
try {
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForSelector('.frame', {timeout: 20000})

  // 1 — live mode stands: the audio cut's frame and its browser pane.
  if (await page.locator('.frame.mode-audio').count() === 0) {
    await page.click('[data-mode="live"]')
    await page.waitForSelector('.frame.mode-audio', {timeout: 10000})
  }
  await page.waitForSelector('.browser-residence:not([hidden]) .browser', {timeout: 15000})
  step('live mode stands', {detail: 'frame mode-audio, audio BrowserPane resident'})

  // 2 — the device detail opens from the status bar's Device toggle; the
  // chain fills from the fixture set (one tile per stored device).
  await page.click('button[aria-label="Device"]')
  await page.waitForSelector('.chain[data-detail-density="device"]', {timeout: 10000})
  await page.waitForSelector('[data-device-tile="Compressor2"]', {timeout: 20000})
  const tiles = await page.locator('.device-tile').count()
  assert.equal(tiles, 3, `one device tile per stored device (got ${tiles})`)
  step('device detail opens', {detail: `detail-density=device, tiles=3 (Compressor2, Overdrive, Redux2)`})

  // 3 — the three faces render their parameter rows: one control per table
  // row, lossless stored values, the stored unit, and the honest state for
  // a row the set does not carry.
  const panelOf = (element) => page.locator('.devp-panel').filter({has: page.locator(`.devp-device-tag:text-is("${element}")`)})
  const rowOf = (panel, name) => panel.locator('.devp-row').filter({has: page.locator(`.devp-name:text-is("${name}")`)})
  for (const [element, rows] of [['Compressor2', 8], ['Overdrive', 7], ['Redux2', 6]]) {
    await panelOf(element).waitFor({timeout: 20000})
    await page.waitForFunction(([tag, count]) => {
      const panel = [...document.querySelectorAll('.devp-device-tag')].find(node => node.textContent === tag)?.closest('.devp-panel')
      return !!panel && panel.querySelectorAll('.devp-row').length === count
    }, [element, rows], {timeout: 15000})
  }
  assert.equal(await panelOf('Overdrive').locator('.devp-track-select').inputValue(), FIXTURE_TRACK, 'the bound track is named')
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.devp-row')].find(node => node.querySelector('.devp-name')?.textContent === 'Threshold')
    return !!row && row.querySelector('input.devp-value')?.value === '0.1791548878'
  }, undefined, {timeout: 15000})
  const midFreq = rowOf(panelOf('Overdrive'), 'Mid Freq')
  assert.equal((await midFreq.locator('.devp-unit').textContent()).trim(), 'Hz', 'the stored unit rides the row')
  const modelRow = rowOf(panelOf('Compressor2'), 'Model')
  assert.equal(await modelRow.locator('.devp-missing').count(), 1, 'a row the set does not carry shows its honest "not stored" state')
  step('device faces render rows', {detail: `rows 8+7+6 (Compressor2+Overdrive+Redux2); Threshold=0.1791548878; Mid Freq unit Hz; Model row honest "not stored"`})

  // 4 — the edit: Overdrive Tone 50 → 42 through the real POST route; the
  // panel shows the value the owner persisted, with the saved mark.
  const toneRow = rowOf(panelOf('Overdrive'), 'Tone')
  await toneRow.locator('input.devp-value').dblclick()
  const edit = toneRow.locator('input.devp-value-input')
  await edit.fill('42')
  await edit.press('Enter')
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.devp-row')].find(node => node.querySelector('.devp-name')?.textContent === 'Tone')
    return !!row && row.querySelector('input.devp-value')?.value === '42' && !!row.querySelector('.devp-status-saved')
  }, undefined, {timeout: 10000})
  step('param edit round-trips', {detail: 'Overdrive Tone 50 → 42: POST answered, persisted value shown, saved mark lit'})

  // 5 — the owner's own state: the POST crossed the wire and the set was
  // rewritten (Node-side re-read, not the panel's echo).
  const post = owner.posts.find(row => row.paramId === 'Tone' && row.deviceName === 'Overdrive')
  assert.ok(post, 'the POST reached the owner')
  assert.equal(post.track, FIXTURE_TRACK)
  assert.equal(post.value, 42)
  const readBack = await fetch(`${url}/api/document/device-params?path=${encodeURIComponent(FIXTURE_SET_PATH)}&track=${FIXTURE_TRACK}&device=Overdrive`).then(response => response.json())
  const tone = readBack.params.find(row => row.id === 'Tone')
  assert.equal(tone?.value, '42', `the owner's re-read carries the write (got ${tone?.value})`)
  step('owner persisted the write', {detail: `POST deviceName=Overdrive paramId=Tone value=42 (track ${FIXTURE_TRACK}); owner re-read Tone=${tone.value}`})

  // 6 — the captures: the live frame, and the device detail row itself.
  const chain = page.locator('.chain[data-detail-density="device"]')
  await chain.scrollIntoViewIfNeeded()
  await page.screenshot({path: join(evidence, 'captures', 'live-device-detail.png')})
  await chain.screenshot({path: join(evidence, 'captures', 'live-device-detail-row.png')})
  step('captures written', {detail: join(evidence, 'captures')})
} finally {
  results.browserErrors = browserErrors.slice(0, 20)
  results.pageErrors = pageErrors.slice(0, 20)
  writeFileSync(join(evidence, 'live-device-walk.json'), JSON.stringify(results, null, 2))
  await browser.close()
  await close()
}
// The fixture owner serves every request this walk makes (favicon included),
// so any browser or page error is a real finding.
if (pageErrors.length || browserErrors.length) {
  console.error('page/browser errors:', pageErrors, browserErrors)
  process.exit(1)
}
console.log(`live-device walk: PASS (${results.steps.length} steps) — evidence in ${evidence}`)
