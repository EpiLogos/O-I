import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

// The switchboard tripwire (FOUNDATION.md §2, F0). The window has one grammar: modes differ only by what their registrations
// supply, never by a branch in the frame. App.tsx is still the per-mode switchboard the 14 Oct audit found
// (FOUNDATION-AUDIT §A), so this is a ratchet: each count below is the frame as it stands, it may only fall, and a fall
// lowers its ceiling in the same commit. Each foundation item (F1–F9) brings its counts down; the end state is no mode
// branch, one residence per part, and no per-mode body.
//
// The new frame (src/frame/, as the foundation builds it) is held to zero from its first line.

const ui = new URL('..', import.meta.url).pathname
const APP = join(ui, 'src/App.tsx')
const FRAME = join(ui, 'src/frame')

// The ceilings. Lower them as the switchboard is taken apart; never raise them.
const CEILING = {
  modeBranches: 54,
  residences: {browser: 3, dock: 2, detail: 6},
  perModeBodies: 21,
}

const MODE = '(?:live|base|central|factory|expressions|techne|audio)'
/** A comparison against a mode name, either way round, or a per-mode predicate call (isFactoryMode(…)). */
export function modeBranches(source) {
  return (source.match(new RegExp(`[!=]==\\s*'${MODE}'`, 'g')) ?? []).length
    + (source.match(new RegExp(`'${MODE}'\\s*[!=]==`, 'g')) ?? []).length
    + (source.match(/\bis[A-Z]\w*Mode\(/g) ?? []).length
}

/** The residences of each window part: one per part is the end state. */
export function residences(source) {
  const count = part => (source.match(new RegExp(`className="${part}-residence"`, 'g')) ?? []).length
  return {browser: count('browser'), dock: count('dock'), detail: count('detail')}
}

// The per-mode bodies of the window's parts that the foundation replaces with one host each (F2–F8).
const PER_MODE_BODIES = [
  'TransportBar', 'AgentShellTransportBridge', 'AgentShellTransport',
  'BrowserPane', 'WorldBrowser', 'ModeBrowser', 'AgentShellBrowser',
  'ModeContextDock', 'AgentContextDock',
  'DeviceChainPanel', 'NativeWorldDetail', 'CentralClipChooser', 'BaseDevicesDetail', 'TechneInstrumentsDetail',
  'InstrumentDeviceDetail', 'TechneClipDetail', 'FactoryTaskLogDetail', 'AgentShellDeviceDetail',
  'TechneLensBar', 'ModeCentreFrame', 'AgentStatusBarBridge',
]
export function perModeBodies(source) {
  return PER_MODE_BODIES.filter(name => new RegExp(`<${name}[\\s/>]`).test(source)).length
}

function frameFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? frameFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const app = readFileSync(APP, 'utf8')

test('App.tsx gains no mode branch; when one is removed, the ceiling falls with it', () => {
  const count = modeBranches(app)
  assert.ok(count <= CEILING.modeBranches, `App.tsx has ${count} mode branches, over the ceiling of ${CEILING.modeBranches}: a mode differs by its registrations, never by a branch in the frame (FOUNDATION §2)`)
  assert.equal(count, CEILING.modeBranches, `App.tsx has ${count} mode branches: lower CEILING.modeBranches to ${count} in this commit`)
})

test('App.tsx gains no per-mode residence; each part falls toward one', () => {
  const found = residences(app)
  for (const part of Object.keys(CEILING.residences)) {
    assert.ok(found[part] <= CEILING.residences[part], `${part}: ${found[part]} residences, over the ceiling of ${CEILING.residences[part]}`)
    assert.equal(found[part], CEILING.residences[part], `${part}: ${found[part]} residences — lower CEILING.residences.${part} in this commit`)
  }
})

test('App.tsx mounts no new per-mode body of a window part', () => {
  const count = perModeBodies(app)
  assert.ok(count <= CEILING.perModeBodies, `App.tsx mounts ${count} per-mode bodies, over the ceiling of ${CEILING.perModeBodies}`)
  assert.equal(count, CEILING.perModeBodies, `App.tsx mounts ${count} per-mode bodies — lower CEILING.perModeBodies in this commit`)
})

test('the new frame (src/frame/) holds no mode branch, no per-mode residence and no per-mode body', () => {
  for (const file of frameFiles(FRAME)) {
    const source = readFileSync(file, 'utf8')
    assert.equal(modeBranches(source), 0, `${file}: a mode branch in the frame`)
    assert.equal(perModeBodies(source), 0, `${file}: a per-mode body in the frame`)
  }
})

test('the counters see what they claim to see', () => {
  assert.equal(modeBranches(`a === 'factory' || 'techne' !== b || isFactoryMode(m) || x === 'other'`), 3)
  assert.deepEqual(residences(`<div className="detail-residence"/><div className="browser-residence"/>`), {browser: 1, dock: 0, detail: 1})
  assert.equal(perModeBodies(`<TransportBar a/> <ModeBrowser/> <TransportBarX/>`), 2)
})
