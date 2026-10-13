import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

// Source-level pins for App.tsx (owner ruling, 13 Oct 2026): the lens bar and the
// instrument Device side are not gated on the Technē mode. The App frame is not
// renderable in a test harness, so the gates are pinned on their source lines.
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const lines = app.split('\n')

test('the Technē lens bar is not gated on frameMode === techne', () => {
  const line = lines.find(l => l.includes('<TechneLensBar'))
  assert.ok(line, 'the lens bar is rendered from App')
  assert.doesNotMatch(line, /frameMode === 'techne'/, 'the lens bar gate names the instrument pane, not the mode')
  const attr = lines.find(l => l.includes('data-lens-bar='))
  assert.ok(attr, 'the centre carries the lens-bar marker')
  assert.doesNotMatch(attr, /frameMode === 'techne'/)
})

test('the focused instrument Device side is not gated on the Technē mode', () => {
  const residence = lines.find(l => l.includes('data-instrument-device'))
  assert.ok(residence, 'the instrument residence is in App')
  assert.match(residence, /InstrumentDeviceDetail/, 'the residence presents the focused instrument')
  assert.doesNotMatch(residence, /frameMode === 'techne'/, 'the residence is not gated on the Technē mode')
  assert.doesNotMatch(residence, /'techne'/)
})

test('in Central the instrument residence keeps the ground devices on the chain', () => {
  const residence = lines.find(l => l.includes('data-instrument-device'))
  assert.match(residence, /centralDevices=\{frameMode === 'base'\}/)
})
