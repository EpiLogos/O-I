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
 * It walks: live mode stands (its frame, the one browser, the widget rail),
 * the Device side stands as a chain of plates (one per stored device, read
 * through the owner's table), each plate pressed shows whole in the pool
 * with its parameter rows (lossless stored values, the stored unit, a row
 * the set does not carry standing dark), one parameter is edited through
 * the real POST route (Overdrive Tone → 42), and the round-trip is asserted
 * both on the plate (persisted value) and from Node against the fixture
 * owner's own state and POST log.
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

  // 1 — live mode stands: Live's frame, the one browser, and the widget rail (the registration opens Live with its rail).
  if (await page.locator('.frame.mode-audio').count() === 0) {
    await page.click('.mode-rail-button[data-mode="live"]')
    await page.waitForSelector('.frame.mode-audio', {timeout: 10000})
  }
  await page.waitForSelector('.browser-residence:not([hidden]) .one-browser', {timeout: 15000})
  await page.waitForSelector('.frame.mode-audio.dock-open .dock-residence:not([hidden])', {timeout: 10000})
  step('live mode stands', {detail: 'frame mode-audio, the one browser and the widget rail resident'})

  // 2 — the set opens from the browser's Live sets (the configured default set's row), and Live's Device side fills from it:
  // one plate of the device runtime per stored device, each read through the owner's stored-parameter table
  // (live/SetDeviceOnChain.tsx).
  await page.waitForSelector('.detail-host[data-detail-side="device"]', {timeout: 10000})
  await page.locator('.world-category-list button', {hasText: 'Live sets'}).click()
  await page.locator(`.world-browser-results .browser-item[title="${FIXTURE_SET_PATH}"]`).click()
  await page.waitForSelector('[data-chain-device="Compressor2"][data-set-device="owner-table"]', {timeout: 20000})
  const plates = await page.locator('.detail-host [data-chain-device] > .device--compact').count()
  assert.equal(plates, 3, `one plate per stored device (got ${plates})`)
  assert.equal(await page.locator('.detail-host .detail-head').count(), 1, 'one head over the row')
  assert.equal(await page.locator('.detail-host .dropz').count(), 1, 'the chain ends in the drop zone')
  step('device side stands', {detail: 'plates=3 (Compressor2, Overdrive, Redux2), one head, the drop zone'})

  // 3 — a plate pressed shows whole in the pool: one control per table row, the lossless stored value, the stored unit, and
  // the honest state of a row the set does not carry.
  const plate = element => page.locator(`.detail-host [data-chain-device="${element}"] .sdk-face__head`)
  const pooled = page.locator('.device-pool .device--whole')
  for (const [element, rows] of [['Compressor2', 8], ['Overdrive', 7], ['Redux2', 6]]) {
    await plate(element).click()
    await page.waitForFunction(([title, count]) => {
      const whole = document.querySelector('.device-pool .device--whole')
      return !!whole && whole.querySelector('.sdk-face__title')?.textContent === title && whole.querySelectorAll('.device-row').length === count
    }, [{Compressor2: 'Compressor', Overdrive: 'Overdrive', Redux2: 'Redux'}[element], rows], {timeout: 15000})
  }
  await plate('Compressor2').click()
  await page.waitForFunction(() => document.querySelector('.device-pool [data-param="Threshold"] [role="slider"]')?.getAttribute('aria-valuenow') === '0.1791548878', undefined, {timeout: 15000})
  assert.equal(await pooled.locator('[data-param="Model"] .sdk-enum').isDisabled(), true, 'a row the set does not carry stands dark')
  await plate('Overdrive').click()
  await page.waitForFunction(() => /Hz$/.test(document.querySelector('.device-pool [data-param="MidFreq"] .sdk-scalar__value')?.textContent ?? ''), undefined, {timeout: 15000})
  step('the pool shows each device whole', {detail: 'rows 8+7+6 (Compressor2+Overdrive+Redux2); Threshold=0.1791548878; Mid Freq unit Hz; Model dark'})

  // 4 — the edit: Overdrive Tone 50 → 42, typed into the pool's knob; the owner's POST answers and the plate on the chain shows
  // the persisted value.
  await pooled.locator('[data-param="Tone"] .sdk-scalar__value').click()
  const edit = pooled.locator('[data-param="Tone"] .sdk-scalar__entry')
  await edit.fill('42')
  await edit.press('Enter')
  await page.waitForFunction(() => document.querySelector('.device-pool [data-param="Tone"] [role="slider"]')?.getAttribute('aria-valuenow') === '42', undefined, {timeout: 10000})
  step('param edit round-trips', {detail: 'Overdrive Tone 50 → 42: POST answered, the persisted value shown in the pool'})

  // 5 — the owner's own state: the POST crossed the wire and the set was rewritten (Node-side re-read, not the plate's echo).
  const post = owner.posts.find(row => row.paramId === 'Tone' && row.deviceName === 'Overdrive')
  assert.ok(post, 'the POST reached the owner')
  assert.equal(post.track, FIXTURE_TRACK)
  assert.equal(post.value, 42)
  const readBack = await fetch(`${url}/api/document/device-params?path=${encodeURIComponent(FIXTURE_SET_PATH)}&track=${FIXTURE_TRACK}&device=Overdrive`).then(response => response.json())
  const tone = readBack.params.find(row => row.id === 'Tone')
  assert.equal(tone?.value, '42', `the owner's re-read carries the write (got ${tone?.value})`)
  step('owner persisted the write', {detail: `POST deviceName=Overdrive paramId=Tone value=42 (track ${FIXTURE_TRACK}); owner re-read Tone=${tone.value}`})

  // 6 — the captures: the live frame, and the device detail row itself.
  const chain = page.locator('.detail-host[data-detail-side="device"]')
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
