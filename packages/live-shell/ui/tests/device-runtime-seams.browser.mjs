/**
 * The device runtime's seams (lane R2), walked headless in a browser — what a static render cannot show: a React error boundary,
 * a press on ⤢, a press on Cancel.
 *
 * The stage is the runtime's own places, bundled as the shell bundles them (the agent-shell harness's esbuild options): a chain
 * plate, the pool, the rail, and a pane opened through the instrument door (the stage publishes the opener a pane tree would, and
 * draws the device pane it is asked for).
 *   1. A design whose compact and Full views throw: the place stands the generic plate in, with the reason on its Info line.
 *   2. Central's Day, published as its chain publishes it (CentralDevices.tsx centralPublication) on a stale ground (the real
 *      capture of 16 Oct): the design's head carries the pop-out; ⤢ on the chain, in the pool and on the rail opens the Day's page.
 *   3. The Agent, published with its own Full act: ⤢ in the pool and on the rail opens its thread, not the device pane.
 *   4. Scope with a raised reach: Cancel clears it in the binding's hold.
 * The catalogue's own loader is Vite's import.meta.glob; under esbuild the reference devices (the Day, Scope) load through it with
 * the glob emptied, and the Agent's design is registered from its module.
 *
 * Run: node tests/device-runtime-seams.browser.mjs [--evidence <dir>]
 */
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdirSync} from 'node:fs'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import {bundleOptions, inlineModuleSafe, launchShell, root, writeReceipt} from './support/agentShellHarness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(tmpdir(), 'device-runtime-seams')
mkdirSync(evidence, {recursive: true})

const contents = `
import {useSyncExternalStore, type ReactNode} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import './styles.css'
import {loadWorldShellFamilies} from './inhabitants/worldShellFamilies'
import {inhabitantManifest} from './inhabitants/manifest'
import {centralDeviceEntries, centralPublication} from './central/devices/CentralDevices'
import {dayDesignBinding, dayFactsOf, dayValuesOf} from './central/devices/dayBinding'
import {DeviceView, PlacedDevice} from './frame/devices/DeviceView'
import {DevicePool} from './frame/devices/DevicePool'
import {DEVICE_PANE_KIND, DeviceFullPane} from './frame/devices/devicePane'
import {publishDevice, selectDevice} from './frame/devices/deviceDoor'
import {registerDesignedDevice} from './frame/devices/designs'
import {HostedDevice} from './frame/devices/deviceHost'
import {WidgetRail} from './frame/widgets/WidgetRail'
import {openInstrument, publishInstrumentOpener} from './frame/instrumentDoor'
import {agentChainDevices, INITIAL_READING} from './agent/devices/agentChainDevices'
import {SLOT_DESIGN_FACE, agentBinding, chainHolds, scopeBinding, subscribeHolds, updateHolds} from './agent/devices/designBindings'
import {design as agentDesign} from './inhabitants/catalogue/panels/actuation__harness-model'
import {scope as scopeDesign} from './inhabitants/catalogue/panels/scope'

loadWorldShellFamilies()
const UNAVAILABLE = {kind: 'unavailable', reason: 'the walk has no kernel'} as const
const seen = (window as any).__seen = {opened: [] as string[], panes: [] as string[]}

// ---- 1. a design that throws
const probe = {id: 'walk:probe', family: 'walk', face: {id: 'probe', title: 'Probe', icon: 'form', liveSemantic: 'device-audio-fx'} as any,
  rows: [{family: 'walk', deviceInstance: 'probe', key: 'size', type: 'number', title: 'Size', range: {min: 0, max: 9}, writePath: 'kernel:x', compact: true}] as any,
  values: {size: 3}}
const fails = (view: string) => () => { throw new Error('probe ' + view + ' throws') }
registerDesignedDevice({id: 'walk:probe', title: 'Probe', kind: 'effect', defaults: {}, folded: () => 'f', compact: fails('compact') as any, whole: () => 'w',
  full: fails('full') as any, widget: () => 't'})
publishDevice('walk:probe', {device: probe as any, binding: {id: 'walk:probe', values: {size: 3}}})

// ---- 2. the Day, as its chain publishes it, on the stale ground of 16 Oct (REAL CAPTURE)
const TIME = {civil_date: '2026-10-16', local_time: '2026-10-16T01:18:42+01:00', observed_at_unix_seconds: 1792109922,
  policy: {automatic_day_rollover: true, day_boundary_minutes: 0, schema: 'central.civil-time-policy/v1', scope_ref: 'control:root', timezone: 'Europe/London'},
  revision: 'central.content-fnv1a64/v1:741:69da4a44ad65b27f', schema: 'central.civil-time-reading/v1', source_ref: 'central:source:control:root:Control/user/civil-time-policy.json',
  source_revision: 'central.content-fnv1a64/v1:172:45c4df00122ed21d'}
const DAY_13 = {content: '', day_ref: 'central:day:control:root:2026-10-13', document: null, document_state: 'uninitialised', schema: 'central.day-reading/v1',
  revision: {byte_len: 0, revision: 'central.content-fnv1a64/v1:0:cbf29ce484222325'},
  source: {path: 'Control/user/day/2026-10-13/day.md', ref: 'central:source:control:root:Control/user/day/2026-10-13/day.md'},
  temporal: {civil_date: '2026-10-13', day_ref: 'central:day:control:root:2026-10-13', lifecycle: 'open', timezone: 'Europe/London'},
  today: {civil_date: '2026-10-13', day_ref: 'central:day:control:root:2026-10-13', updated_at_unix_seconds: 1791846014}}
const leg = (action: string) => ({state: 'unavailable', action, error: {message: 'not read in this walk'}})
const STALE = {schema: 'oi.central-ground/v1', project: null, time: {state: 'ready', action: 'central.time.policy', data: TIME},
  day: {state: 'stale', action: 'central.day.read', data: DAY_13, error: {message: 'The native today pointer belongs to an earlier civil Day; its writing is retained'}},
  now: leg('central.now.list'), sources: leg('projectcentral.change.horizon'), placement: leg('central.work.policy')}
const facts = dayFactsOf({ground: STALE as any, groundError: null, selected: null})
const central = inhabitantManifest('central')!
const windows = {popOut() { seen.opened.push('pop-out') }, redock() {}, poppedOut: () => false} as any
const day = centralDeviceEntries({transport: UNAVAILABLE, faces: central.faces, manifest: central, reads: {day: {standing: facts.standing, face: null, revision: null}} as any,
  day: facts.aperture, conversation: null, flow: null, impact: null, deviceWindows: windows, dayStanding: facts.standing}).find(entry => entry.id === 'central:day-die')!
const dayBinding = dayDesignBinding(day.id, facts, dayValuesOf(facts, null), {turn: async () => {}, openToday: async () => {}})
publishDevice(day.id, centralPublication(day, dayBinding))

// ---- 3. the Agent, with its own Full act
registerDesignedDevice(agentDesign)
const fired = (row: any) => ({kind: 'fired', channel: 'shell', writePath: row.writePath, note: 'ok'}) as any
const agent = agentChainDevices({sessionRef: 's', reading: INITIAL_READING, accepted: {}} as any, async row => fired(row), SLOT_DESIGN_FACE).find(entry => entry.slot.id === 'agent')!
const agentWired = agentBinding(agent.device.id, {sessionRef: 's', track: {agentRef: 'agent:kite', agentName: 'Kite', needle: null, budget: {used: null, max: null}}, nowUnixMs: Date.now(),
  reading: INITIAL_READING, accepted: {}, harness: {binding: 'cursor', resolved: false}, holds: chainHolds()} as any, {}, async row => fired(row), () => true)
publishDevice(agent.device.id, {device: agent.device, binding: agentWired, full: {open: () => { seen.opened.push('thread') }}})

// ---- the pane tree: the opener a mounted pane tree publishes, drawing the device pane it is asked for
let pane: Root | null = null
publishInstrumentOpener((kind, _at, subject) => {
  seen.panes.push(kind + ' ' + (subject?.ref ?? ''))
  pane ??= createRoot(document.getElementById('pane')!)
  pane.render(kind === DEVICE_PANE_KIND ? <DeviceFullPane key={subject?.ref + ':' + seen.panes.length} id={subject?.ref} /> : <p>{kind}</p>)
})

function Scope() {
  const holds = useSyncExternalStore(subscribeHolds, chainHolds, chainHolds)
  return <HostedDevice designed={scopeDesign} binding={scopeBinding('factory:world', holds, undefined, async row => fired(row))} view="whole" nav={{}} className="device device--whole" title="Scope" />
}
updateHolds(was => ({...was, reachPending: 2}))
;(window as any).__holds = chainHolds
;(window as any).__select = (id: string) => selectDevice(id)

const book = {rail: {open: ['device:' + day.id, 'device:' + agent.device.id]}, toggle() {}, pin() {}, savePreset() {}, applyPreset() {}, widen() {}}
const Box = ({id, children, w = 460, h = 220}: {id: string; children: ReactNode; w?: number; h?: number}) =>
  <section id={id} style={{position: 'relative', width: w, height: h, margin: 8, border: '1px solid var(--line)'}}>{children}</section>
createRoot(document.getElementById('root')!).render(<div style={{display: 'flex', flexWrap: 'wrap', background: 'var(--bg-0)'}}>
  <Box id="probe-chain"><DeviceView device={probe as any} size="compact" /></Box>
  <Box id="probe-full"><PlacedDevice device={probe as any} view="full" /></Box>
  <Box id="chain" w={520}><DeviceView device={day.device} size="compact" picture={day.picture('compact')} marks={day.marks} binding={dayBinding} actions={[
    {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(day.id)},
    {icon: 'pane', label: 'Open ' + day.device.face.title + ' full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: day.id, title: day.device.face.title})},
  ]} /></Box>
  <Box id="pool" w={420} h={360}><DevicePool /></Box>
  <Box id="rail" w={320} h={520}><WidgetRail widgets={[]} book={book} selectionRef={null} /></Box>
  <Box id="scope" w={420} h={360}><Scope /></Box>
  <Box id="pane" w={600} h={360}>{null}</Box>
</div>)
;(window as any).__ready = true
`

// The shell's bundle (the harness's options), with the catalogue's Vite glob emptied: its reference devices still load through it.
const esbuild = createRequire(join(root, 'desktop/cradle/package.json'))('esbuild')
const options = bundleOptions()
const glob = {name: 'catalogue-glob', setup(build) {
  build.onLoad({filter: /inhabitants\/catalogue\/panels\/index\.ts$/}, async args => ({
    contents: (await readFile(args.path, 'utf8')).replace(/import\.meta\.glob<[^>]*>\('[^']*'\)/, '({} as Record<string, () => Promise<{design: DesignedDevice}>>)'),
    loader: 'ts', resolveDir: dirname(args.path),
  }))
}}
const bundle = await esbuild.build({...options, plugins: [...options.plugins, glob], stdin: {contents, resolveDir: join(here, '..', 'src'), sourcefile: 'device-runtime-seams-entry.tsx', loader: 'tsx'},
  outfile: 'device-runtime-seams.browser.mjs'})
const js = bundle.outputFiles.find(file => file.path.endsWith('.mjs')).text
const css = bundle.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n')

const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script type="module">${inlineModuleSafe(js)}</script></body></html>`)
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}`

const observations = []
const faults = []
const check = async (label, run) => {
  try { observations.push(`${label}: ${await run()}`) } catch (error) { faults.push({label, error: error instanceof Error ? error.message : String(error)}) }
}

const {browser, page, pageErrors} = await launchShell({width: 1500, height: 1300})
try {
  await page.goto(url, {waitUntil: 'domcontentloaded'})
  await page.waitForFunction(() => window.__ready === true, undefined, {timeout: 20000})

  await check('a design whose compact throws', async () => {
    const plate = page.locator('#probe-chain [data-device="walk:probe"]')
    const fault = await plate.getAttribute('data-device-fault')
    assert.match(fault ?? '', /Its own compact view did not draw: probe compact throws\. The generic plate stands in\./)
    assert.equal(await plate.locator('section.dp[data-view="compact"]').count(), 1, 'the generic plate stands in')
    assert.match(await plate.locator('header.dp-head').getAttribute('data-i'), /did not draw: probe compact throws/, 'the head says why on the Info line')
    return `the generic plate, data-device-fault="${fault}"`
  })
  await check('a design whose Full throws', async () => {
    const plate = page.locator('#probe-full [data-device="walk:probe"]')
    assert.match(await plate.getAttribute('data-device-fault') ?? '', /Its own full view did not draw: probe full throws/)
    const full = await plate.locator('.dv-full').getAttribute('data-i')
    assert.match(full, /^Probe\|Its own full view did not draw: probe full throws\. The generic plate stands in\./)
    return `the generic Full, data-i="${full}"`
  })

  await page.waitForSelector('#chain [data-device-design="central:day-die"]', {timeout: 10000})
  await check('the Day\'s designed head carries its pop-out', async () => {
    const marks = page.locator('#chain [data-device-design="central:day-die"] header.dp-head .dp-head-x')
    const popOut = marks.locator('[data-action="pop-out"]')
    assert.equal(await popOut.count(), 1)
    // No Day document stands on the stale ground, so the face's own rule disables it, with its reason (detachedKinds.ts).
    assert.equal(await popOut.isDisabled(), true)
    assert.match(await popOut.getAttribute('data-i'), /^Pop out\|day-die needs its Day in the aperture/)
    return `${(await marks.innerHTML()).match(/aria-label="[^"]*"/g).join(' ')}; the pop-out says: ${await popOut.getAttribute('data-i')}`
  })
  const dayPage = async (label, press) => {
    await page.evaluate(() => { window.__seen.panes.length = 0 })
    await press()
    await page.waitForSelector('#pane [data-device="central:day-die"][data-device-size="full"] [data-central-absence]', {timeout: 5000})
    const panes = await page.evaluate(() => window.__seen.panes)
    assert.deepEqual(panes, ['projection.device central:day-die'], `${label}: the device pane, for the Day`)
    const text = await page.locator('#pane').innerText()
    assert.match(text, /earlier civil Day/, `${label}: the Day's page in the owner's words`)
    assert.equal(await page.locator('#pane iframe').count(), 0, 'never the design\'s template')
    return `opened ${panes[0]}: "${text.replace(/\s+/g, ' ').slice(0, 90)}…"`
  }
  await check('the Day\'s ⤢ on the chain', () => dayPage('chain', () => page.locator('#chain header.dp-head button[aria-label="Open Day full in a pane"]').click()))
  await page.evaluate(() => window.__select('central:day-die'))
  await page.waitForSelector('#pool [data-device="central:day-die"][data-device-design="central:day-die"]')
  await check('the Day\'s ⤢ in the pool', () => dayPage('pool', () => page.locator('#pool header.dp-head button[aria-label="Open Day full in a pane"]').click()))
  await check('the Day\'s ⤢ on the rail', () => dayPage('rail', () => page.locator('#rail [data-widget="device:central:day-die"] .dp-tile-head button[aria-label^="Open Day"]').click()))
  await page.screenshot({path: join(evidence, 'day-pane.png'), fullPage: true})

  const thread = async (label, press) => {
    await page.evaluate(() => { window.__seen.panes.length = 0; window.__seen.opened.length = 0 })
    await press()
    const seen = await page.evaluate(() => window.__seen)
    assert.deepEqual(seen.opened, ['thread'], `${label}: the Agent's own act`)
    assert.deepEqual(seen.panes, [], `${label}: no device pane opened in its place`)
    return 'opened its thread (the device\'s own Full act), no device pane'
  }
  await page.evaluate(() => window.__select('factory:agent'))
  await page.waitForSelector('#pool [data-device="factory:agent"][data-device-design="actuation:harness-model"]')
  await check('the Agent\'s ⤢ in the pool', () => thread('pool', () => page.locator('#pool header.dp-head button[aria-label="Open Agent full in a pane"]').click()))
  await check('the Agent\'s ⤢ on the rail', () => thread('rail', () => page.locator('#rail [data-widget="device:factory:agent"] .dp-tile-head button[aria-label^="Open Agent"]').click()))

  await check('Cancel on Scope\'s raised reach', async () => {
    assert.equal(await page.evaluate(() => window.__holds().reachPending), 2)
    const cancel = page.locator('#scope button.dp-action', {hasText: 'Cancel'})
    assert.equal(await cancel.count(), 1, 'the raised reach asks: Confirm and Cancel stand')
    assert.equal(await page.locator('#scope button.dp-action', {hasText: 'Confirm'}).isDisabled(), true, 'Confirm stands disabled: no owner carries the reach')
    await cancel.click()
    await page.waitForFunction(() => window.__holds().reachPending === undefined, undefined, {timeout: 3000})
    assert.equal(await page.locator('#scope button.dp-action', {hasText: 'Cancel'}).count(), 0, 'the ask is gone from the plate')
    return 'the hold cleared (reachPending undefined); Confirm and Cancel are gone'
  })
  await page.screenshot({path: join(evidence, 'stage.png'), fullPage: true})
  const uncaught = pageErrors.filter(error => !/probe (compact|full) throws/.test(error))
  await check('no uncaught page error', async () => { assert.deepEqual(uncaught, []); return 'none' })
} finally {
  await browser.close()
  server.closeAllConnections?.()
  await new Promise(done => server.close(done))
}

await writeReceipt(join(evidence, 'receipt.json'), {schema: 'oi.device-runtime-seams/v1', lane: 'R2', at: new Date().toISOString(), observations, faults, captures: ['day-pane.png', 'stage.png']})
for (const line of observations) console.log(`ok — ${line}`)
for (const fault of faults) console.error(`FAULT — ${fault.label}: ${fault.error}`)
console.log(`[device-runtime-seams] observations: ${observations.length}, faults: ${faults.length}`)
process.exit(faults.length ? 1 : 0)
