import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'

// The switchboard tripwire (FOUNDATION.md §2, F0). The window has one grammar: modes differ only by what their registrations
// supply, never by a branch in the frame. App.tsx is still the per-mode switchboard the 14 Oct audit found
// (FOUNDATION-AUDIT §A), and the R2 review found the same branches outside it (TransportBar, StatusBar, workspace,
// paneInstrument…), so the ratchet covers every source file under src/: each count below is the tree as it stands, it may
// only fall, and a fall lowers its ceiling in the same commit. A file with no ceiling holds none. Each foundation item
// (F1–F9) brings its counts down; the end state is no mode branch outside the registration tables, one residence per part,
// and no per-mode body.
//
// The registration tables are the one place a mode's difference lives, so they may name modes and are not counted. They
// are listed here, explicitly: adding a file to the list is a decision made in this file, in review.
//
// The new frame (src/frame/, as the foundation builds it) is held to zero from its first line.
//
// The counter is deliberately blunt — a comparison against a mode's name, either way round, or a per-mode predicate call —
// so it also sees a few look-alikes that are not modes (a status of 'live', a surface kind of 'expressions', an `isSdkMode`
// validator). They stand in their file's ceiling like any other; a new one is as much a fall of the ratchet as a branch.

const ui = new URL('..', import.meta.url).pathname
const SRC = join(ui, 'src')
const APP = join(SRC, 'App.tsx')
const FRAME = join(SRC, 'frame')

/** The registration tables (paths from the ui root): a mode's difference is data here, read by the frame. */
const TABLES = [
  'src/shell/modeFrames.ts',
  'src/frame/tracks/modeTracks.ts',
  'src/shell/modeDetails.tsx',
  'src/shell/modeBrowsers.tsx',
  'src/shell/modeTransports.tsx',
  'src/shell/modeGrammar.ts',
  'src/shell/modeStatus.ts',
]

/** The designed devices (the owner's documentation lane, 16 Oct: "the high end device component specs … catalogue of pre
 * designed UI"): a design draws one device from the values its binding hands it. Where its material differs by mode, the mode
 * reaches it as one of those values, from the family's registration, so it is not a branch in the frame; and its own words
 * ('live' for a harness that is working) are the device's vocabulary. The frame that hosts designs (frame/devices) stays at zero. */
const DESIGNS = 'src/inhabitants/catalogue/'

// The ceilings. Lower them as the switchboard is taken apart; never raise them.
const CEILING = {
  // Mode comparisons per file under src/, outside the tables. A file not named here holds none.
  files: {
    'src/agent/AgentShellContext.tsx': 1,
    'src/agent/factoryCentre.ts': 2,
    'src/App.tsx': 20,
    'src/components/NativeDevicePool.tsx': 1,
    'src/components/NativeExpressionCollections.tsx': 1,
    'src/components/NativeSceneFace.automation.tsx': 1,
    'src/components/nativeSceneFace.body.ts': 1,
    'src/components/NativeTechneBrowser.tsx': 1,
    'src/components/NativeWorldDetail.tsx': 2,
    'src/components/WorldBrowser.tsx': 2,
    'src/continuity/workspace.tsx': 2,
    'src/inhabitants/sdk/modes.ts': 1,
    'src/inhabitants/sdk/validate.ts': 3,
    'src/native/Foundation.tsx': 1,
    'src/native/techneInstrumentOpen.ts': 2,
    'src/native/Workbench.tsx': 2,
    'src/panels/expressions.tsx': 10,
    'src/projections/atlas/src/sky/live.ts': 2,
    'src/projections/encounterBridge.ts': 1,
    'src/projections/useWorldTemporalReading.ts': 1,
    'src/shell/liveSelection.ts': 1,
    'src/shell/ModeContextDock.tsx': 2,
    'src/shell/ModeDetail.tsx': 3,
    'src/shell/ModeTransportBar.tsx': 4,
    'src/timeline/centralTrackAdapter.ts': 4,
    'src/timeline/techneTrackAdapter.ts': 2,
  },
  residences: {browser: 1, dock: 1, detail: 1},
  perModeBodies: 2,
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
  'TechneClipDetail', 'FactoryTaskLogDetail', 'AgentShellDeviceDetail',
  'TechneLensBar', 'ModeCentreFrame', 'AgentStatusBarBridge',
]
export function perModeBodies(source) {
  return PER_MODE_BODIES.filter(name => new RegExp(`<${name}[\\s/>]`).test(source)).length
}

function sourceFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const rel = path => relative(ui, path)
const isTable = path => TABLES.includes(rel(path)) || rel(path).startsWith(DESIGNS)
const app = readFileSync(APP, 'utf8')
/** Every counted source file under src/ with its mode-branch count. */
const counted = new Map(sourceFiles(SRC).filter(path => !isTable(path)).map(path => [rel(path), modeBranches(readFileSync(path, 'utf8'))]))

test('the registration tables listed here exist', () => {
  for (const table of TABLES) assert.ok(existsSync(join(ui, table)), `${table} is listed as a registration table and is not there: drop it from TABLES`)
})

test('no file under src/ gains a mode branch (App.tsx included)', () => {
  const over = [...counted].filter(([file, count]) => count > (CEILING.files[file] ?? 0))
    .map(([file, count]) => `${file}: ${count} mode branches, over its ceiling of ${CEILING.files[file] ?? 0}`)
  assert.deepEqual(over, [], 'a mode differs by its registrations (shell/mode*.ts, frame/tracks/modeTracks.ts), never by a branch in the frame (FOUNDATION §2)')
})

test('a file that loses a mode branch lowers its ceiling in the same commit', () => {
  const under = [...counted].filter(([file, count]) => count < (CEILING.files[file] ?? 0))
    .map(([file, count]) => `${file}: ${count} mode branches — lower its ceiling from ${CEILING.files[file]} to ${count}`)
  assert.deepEqual(under, [])
  const stale = Object.keys(CEILING.files).filter(file => !counted.has(file))
  assert.deepEqual(stale, [], 'a ceiling names a file that is gone, or is now a registration table: delete the entry')
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
  for (const file of sourceFiles(FRAME).filter(path => !isTable(path))) {
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
