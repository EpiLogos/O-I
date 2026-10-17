import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// Source-level pins for App.tsx (owner ruling, 13 Oct 2026): the lens bar and the
// instrument Device side are not gated on the Technē mode. The App frame is not
// renderable in a test harness, so the gates are pinned on their source lines.
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const lines = app.split('\n')

test('there is no lens bar: every instrument opens from the browser\'s Instruments, in every mode (FOUNDATION F2)', async () => {
  assert.doesNotMatch(app, /TechneLensBar|showsLensBar|data-lens-bar/, 'App draws no lens bar')
  for (const browser of ['components/BrowserPane.tsx', 'components/WorldBrowser.tsx', 'shell/ModeBrowser.tsx', 'agent/AgentShellBrowser.tsx']) {
    assert.match(await readFile(new URL(`../src/${browser}`, import.meta.url), 'utf8'), /<InstrumentsSection \/>/, `${browser} lists the instruments`)
  }
})

test('the focused instrument takes the Device side in every mode but Live, from the one detail host (FOUNDATION F4)', async () => {
  const host = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.match(host, /<InstrumentDeviceDetail transport=\{reading\.transport\} instrument=\{instrument\}/, 'the host presents the focused instrument')
  assert.doesNotMatch(host, /'(live|base|factory|expressions|techne)'/, 'the host names no mode')
  const details = await readFile(new URL('../src/shell/modeDetails.tsx', import.meta.url), 'utf8')
  assert.match(details, /live: \{clip: LiveClip, device: LiveChain, ownsDeviceSide: true, dropHint: /, 'Live keeps its own chain')
})

test('in Central the instrument\'s chain keeps the ground devices leading', async () => {
  const details = await readFile(new URL('../src/shell/modeDetails.tsx', import.meta.url), 'utf8')
  assert.match(details, /base: \{clip: CentralClip, device: CentralChain, devicesLeadInstrument: true, dropHint: /)
  const host = await readFile(new URL('../src/frame/detail/DetailHost.tsx', import.meta.url), 'utf8')
  assert.match(host, /centralDevices=\{!!registration\.devicesLeadInstrument\}/)
})

// The hosted Expressions lens (owner ruling, lock §0.1): the Device side reads the lens the frame reports; the browser's
// Instruments drive it through the retained-instrument event the expressions panel's receiver already handles. Neither
// holds a host handle.
test('the stage pane\'s reported lens reaches the Device side, and a stage lens in the browser drives it through the instrument event', async () => {
  const reads = lines.find(l => l.includes('const hostedLens = workspace.reading?.lens'))
  assert.ok(reads, 'App reads the lens the frame publishes through the workspace reading')
  const device = lines.find(l => l.includes('const focusedInstrument = deviceInstrumentFor('))
  assert.match(device, /hostedLens\)/, 'the Device side passes the hosted lens')
  const section = await readFile(new URL('../src/frame/InstrumentsSection.tsx', import.meta.url), 'utf8')
  // The row's payload carries its lens; the instrument door opens the stage and drives the lens (frame/instrumentDoor.ts).
  const door = await readFile(new URL('../src/frame/instrumentDoor.ts', import.meta.url), 'utf8')
  assert.match(door, /driveStageLens\(lens, reportInstrumentFault\)/, 'the door drives the stage through the frame\'s published driver')
  assert.match(section, /openInstrument\(instrumentPayload\(entry\)\)/, 'a stage lens row opens through the door with its lens')
  assert.match(app, /window\.dispatchEvent\(new CustomEvent\(TECHNE_INSTRUMENT_OPEN, \{detail\}\)\)/, 'the driver dispatches the retained-instrument event')
  assert.match(app, /captureTechneInstrumentOpen\(\{workspaceId: now\.workspaceId/, 'the press is captured from the current native scope, never from a stale copy')
})
