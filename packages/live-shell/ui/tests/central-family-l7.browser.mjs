/**
 * Central family L7 — the day-recovery walk + detail-craft acceptance.
 * SCRIPTED browser capture (computer use is blocked machine-wide; this
 * driver is playwright, channel-labelled).
 *
 * The walk (ticket L7; WORLD-SHELL-DESIGN §12, §15, §17 vertical 2): driven
 * against the LIVE kernel walk-bridge when it answers (read-only ops only),
 * with the machine-level declared reads served by the harness middleware:
 *
 *   1. the hygiene device reads the ground — the kernel's workcell/git ops
 *      and the machine instrument; refusals stand verbatim; the tenders are
 *      declared controls, fired by nobody;
 *   2. selecting a FOLDER opens Central detail craft (directory identity,
 *      basis) and the impact device reads its neighbourhood;
 *   3. selecting a NOTE opens Central detail craft (CAS identity);
 *   4. selecting DAY 2026-10-08 walks its recovery end-to-end read-only:
 *      day record read (CAS revision) → returns at close → carry-forward —
 *      the day document device (day die) docks beside it through the rack;
 *   5. the civil field read stands on the kernel temporal read; the day/now
 *      operations render as DECLARED temporal controls.
 *
 * Acceptance held open (honesty boundaries): the ticket's computer-use leg
 * is NOT claimed — the day-recovery acceptance walked here is the scripted
 * proof, held, with the computer-use leg staying OPEN on the ticket.
 *
 * Run: node tests/central-family-l7.browser.mjs --evidence <dir> [--kernel http://127.0.0.1:4179/op]
 * Without --kernel the walk runs against the unavailable transport and
 * asserts the honest unread states only.
 */
import assert from 'node:assert/strict'
import {mkdirSync, writeFileSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createServer} from 'vite'
import {launchShell} from './support/agentShellHarness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(here, 'artifacts', 'central-family-l7')
const kernelUrl = args.includes('--kernel') ? args[args.indexOf('--kernel') + 1] : 'http://127.0.0.1:4179/op'
mkdirSync(join(evidence, 'captures'), {recursive: true})

const devRoot = join(here, '..', 'src', 'inhabitants', 'dev-central-l7')
const server = await createServer({
  root: devRoot,
  logLevel: 'error',
  server: {port: 5204, strictPort: true, host: '127.0.0.1'},
})
await server.listen()
const url = 'http://127.0.0.1:5204/?kernel=' + encodeURIComponent(kernelUrl)

const results = {
  schema: 'oi.central-family-l7-walk/v1',
  recorded_at: new Date().toISOString(),
  channel: 'scripted-playwright (computer use blocked machine-wide — the computer-use leg stays OPEN on ticket L7, held not waived)',
  kernel_channel: kernelUrl,
  mutation_standing: 'read-only: every op issued is a read; the NOW field, the register and git state were never written',
  steps: [],
  browserErrors: [],
  pageErrors: [],
}
const step = (name, detail) => {
  results.steps.push({name, ...detail})
  console.log(`+ ${name}${detail.detail ? ` — ${detail.detail}` : ''}`)
}

const {browser, page, browserErrors, pageErrors} = await launchShell({width: 1920, height: 1200})

try {
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000})
  await page.waitForSelector('[data-devices-mount] [data-central-device]', {timeout: 30000})
  const manifest = await page.locator('[data-manifest-faults]').getAttribute('data-manifest-faults')
  assert.equal(manifest, '0', 'the composed central manifest validates')
  step('harness boots, central manifest valid', {detail: await page.locator('.l7-faults').textContent()})

  // ── 1. the hygiene device reads the ground ──
  const hygiene = page.locator('[data-central-device="ground-hygiene"]')
  await hygiene.locator('[data-action="read-census"]').click()
  await page.waitForFunction(() => document.querySelector('[data-central-device="ground-hygiene"]')?.getAttribute('data-census') === 'read', undefined, {timeout: 120000})
  const refusedSources = await hygiene.locator('[data-hygiene-sources] [data-refused="true"] [data-refusal-text]').allTextContents()
  const answeredSources = await hygiene.locator('[data-hygiene-sources] [data-refused="false"] .inhabitant-reading-op').allTextContents()
  const findings = await hygiene.locator('[data-hygiene-findings] [data-finding-kind]').evaluateAll(nodes =>
    nodes.map(node => ({kind: node.dataset.findingKind, text: node.textContent?.trim().slice(0, 120)})))
  const tenders = await hygiene.locator('[data-hygiene-tenders] [data-tender]').evaluateAll(nodes =>
    nodes.map(node => ({id: node.dataset.tender, disabled: node.disabled})))
  assert.ok(tenders.length >= 3, 'the tenders render declared')
  assert.ok(tenders.every(tender => tender.disabled), 'no tender is fireable from the device')
  step('hygiene: census read', {
    boundary_ops_answered: answeredSources,
    boundary_ops_refused: refusedSources,
    findings_count: findings.length,
    findings: findings.slice(0, 12),
    tenders_declared: tenders,
  })
  await page.screenshot({path: join(evidence, 'captures', '01-hygiene-readings.png'), fullPage: false})

  // ── 2. the folder subject opens Central detail craft ──
  await page.locator('[data-subject-key="folder"]').click()
  await page.waitForSelector('[data-central-detail][data-subject-selected="true"][data-subject-kind="folder"]', {timeout: 60000})
  await page.waitForSelector('[data-central-detail] [data-craft-row="basis"]', {timeout: 60000})
  const folderCraft = await page.locator('[data-central-detail] [data-detail-craft]').textContent()
  assert.match(folderCraft ?? '', /basis/, 'the folder craft names its basis')
  const impact = page.locator('[data-central-device="impact"]')
  // Bind the wait to THIS subject: the standing may legitimately still read
  // 'read' from the previous subject for one frame (the walk opens on the
  // day, whose reading is the slowest).
  await page.waitForFunction(() =>
    document.querySelector('[data-central-device="impact"]')?.getAttribute('data-impact-read-subject') === 'Work/O-I/.wayfinder/maps',
  undefined, {timeout: 120000})
  const impactLegs = await impact.locator('[data-impact-legs] [data-impact-leg]').evaluateAll(nodes =>
    nodes.map(node => ({leg: node.dataset.impactLeg, refused: node.dataset.refused, text: node.textContent?.trim().slice(0, 140)})))
  const impactNodes = await impact.locator('[data-impact-node]').count()
  const impactSessions = await impact.locator('[data-impact-session]').count()
  // Page-side probe: the same graph op the device ran, fetched directly —
  // separates the transport from the projection in the walk's evidence.
  const graphProbe = await page.evaluate(async kernelBase => {
    const response = await fetch(`${kernelBase}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: 'graph', query: 'Work/O-I/.wayfinder/maps', options: {input: 'all'}})})
    const body = await response.json()
    const reading = body?.outcome?.reading
    const edges = reading?.edges ?? []
    return {
      ok: body.ok,
      schema: reading?.schema ?? null,
      edge_count: edges.length,
      wayfinder_maps_citations: edges.filter(edge => JSON.stringify(edge).includes('Work/O-I/.wayfinder/maps')).length,
    }
  }, kernelUrl.replace(/\/op\/?$/, ''))
  step('folder: detail craft + impact reading', {
    graph_probe: graphProbe,
    subject: await page.locator('[data-central-detail]').getAttribute('data-subject-path'),
    impact_legs: impactLegs,
    neighbourhood_nodes: impactNodes,
    sessions_touching: impactSessions,
  })
  await page.screenshot({path: join(evidence, 'captures', '02-folder-detail.png'), fullPage: false})

  // ── 3. the note subject opens Central detail craft ──
  await page.locator('[data-subject-key="note"]').click()
  // The note's CAS row: the folder's listing basis has no CAS short form,
  // so the wait must be on the note's own craft row, not the standing (which
  // legitimately still reads from the previous subject for one frame).
  await page.waitForFunction(() => {
    const detail = document.querySelector('[data-central-detail][data-subject-kind="note"]')
    const cas = detail?.querySelector('[data-craft-row="cas-identity"] .inhabitant-reading-standing')?.textContent ?? ''
    return cas.includes(':') && !cas.includes('directory listing')
  }, undefined, {timeout: 60000})
  const noteCas = await page.locator('[data-central-detail] [data-craft-row="cas-identity"] .inhabitant-reading-standing').textContent()
  assert.match(noteCas ?? '', /:/, 'the note craft carries a CAS short form')
  const noteBoundary = await page.locator('[data-central-detail] [data-craft-row="read-via"] .inhabitant-reading-standing').textContent()
  step('note: detail craft with CAS identity', {
    subject: await page.locator('[data-central-detail]').getAttribute('data-subject-path'),
    cas_short: noteCas?.trim(),
    read_via: noteBoundary?.trim(),
  })
  await page.screenshot({path: join(evidence, 'captures', '03-note-detail.png'), fullPage: false})

  // ── 4. THE WALK: day 2026-10-08 recovery, end-to-end, read-only ──
  await page.locator('[data-subject-key="day"]').click()
  const daynow = page.locator('[data-central-device="day-now"]')
  await page.waitForSelector('[data-daynow-standing="read"]', {timeout: 120000})
  // The civil row must be the DAY's own read (the selection left and
  // returned to the day during the walk; the device re-reads the civil
  // field on every selection change, so the strip must show the day window,
  // not the previous subject's).
  await page.waitForFunction(() => (document.querySelector('[data-civil-policy]')?.textContent ?? '').includes('between 2026-10-08'), undefined, {timeout: 120000})
  // The walk body must name the selected day, not a previous one.
  await page.waitForFunction(() => document.querySelector('[data-day-walk]')?.getAttribute('data-walk-day') === '2026-10-08', undefined, {timeout: 120000})
  const civilPolicy = await daynow.locator('[data-civil-policy]').textContent().catch(() => null)
  const civilRefusal = await daynow.locator('[data-civil-field] [data-refusal-text]').textContent().catch(() => null)
  // The walk body: basis + steps + returns.
  await page.waitForSelector('[data-day-walk][data-walk-day="2026-10-08"] [data-walk-content]', {timeout: 120000})
  const walkBasis = await daynow.locator('[data-walk-basis]').textContent()
  const walkSteps = await daynow.locator('[data-walk-steps] [data-walk-step]').evaluateAll(nodes =>
    nodes.map(node => ({step: node.dataset.walkStep, text: node.textContent?.trim().slice(0, 140)})))
  const walkReturns = await daynow.locator('[data-walk-returns] [data-walk-return]').evaluateAll(nodes =>
    nodes.map(node => ({status: node.dataset.returnStatus, text: node.textContent?.trim().slice(0, 110)})))
  const returnsNote = await daynow.locator('[data-day-walk] p.inhabitant-device-note').nth(1).textContent().catch(() => '')
  const declaredControls = await daynow.locator('[data-civil-controls] [data-civil-control]').evaluateAll(nodes =>
    nodes.map(node => ({id: node.dataset.civilControl, admission: node.dataset.admission, text: node.textContent?.trim().slice(0, 120)})))
  assert.ok((walkBasis ?? '').includes('2026-10-08'), 'the walk names the day')
  assert.ok(walkSteps.length >= 1, 'the walk carries its read steps')
  assert.ok(declaredControls.length === 3 && declaredControls.every(control => control.admission === 'declared'), 'the three civil controls are declared')
  step('walk: day 2026-10-08 recovery end-to-end (read-only)', {
    day: '2026-10-08',
    civil_field: civilRefusal ? {refused: civilRefusal} : {policy: civilPolicy},
    basis: walkBasis?.trim(),
    steps: walkSteps,
    returns_seen: walkReturns,
    returns_note: returnsNote?.trim(),
    declared_controls: declaredControls,
  })
  await daynow.screenshot({path: join(evidence, 'captures', '04-day-walk.png')}).catch(async () => {
    await page.screenshot({path: join(evidence, 'captures', '04-day-walk.png')})
  })
  await page.screenshot({path: join(evidence, 'captures', '05-day-detail-craft.png'), fullPage: false})

  // The declared controls' buttons are disabled — nothing fires from a device.
  const controlButtons = await daynow.locator('[data-daynow-controls] [data-tender]').evaluateAll(nodes =>
    nodes.map(node => ({id: node.dataset.tender, disabled: node.disabled})))
  assert.ok(controlButtons.length === 3 && controlButtons.every(control => control.disabled), 'the civil controls render declared, unfireable')
  step('civil controls: declared, unfireable', {controls: controlButtons})

  results.ok = true
} catch (error) {
  results.ok = false
  results.fault = String(error?.stack ?? error)
  console.error('WALK FAULT:', error)
  await page.screenshot({path: join(evidence, 'captures', '99-walk-fault.png'), fullPage: true}).catch(() => {})
} finally {
  results.browserErrors = browserErrors ?? []
  results.pageErrors = pageErrors ?? []
  writeFileSync(join(evidence, 'walk-record.json'), JSON.stringify(results, null, 2))
  await browser.close().catch(() => {})
  await server.close().catch(() => {})
  process.exit(results.ok ? 0 : 1)
}
