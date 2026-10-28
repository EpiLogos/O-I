import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The atlas's exposed parameters, made true (lane dlw/build, the adopt-the-kit wiring moment). Each atlas-earth row names a
// shell.setAtlas* writer; each writer is registered in the shell's setter bridge and drives the SAME atlas face action the
// face body calls, on the one mounted atlas. The declared domains are read live from FORCE_ROWS, the TimeModel, the
// GraphView's controls() and its own setDepth clamp. Production modules in memory, the atlas-face-bodies.test.mjs loader.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const out = ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  return {format: 'module', shortCircuit: true, source: out.split('import.meta.env').join('({BASE_URL: "/"})')};
}`)}`, import.meta.url)

const door = await import('../src/inhabitants/familyManifest.ts')
const five = await import('../src/inhabitants/loadAgentShellFamilies.ts')
const p0 = await import('../src/inhabitants/agentNativeP0.ts')
const sdkDefine = await import('../src/inhabitants/sdk/define.ts')
const sdkValidate = await import('../src/inhabitants/sdk/validate.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const sdkSetters = await import('../src/inhabitants/sdk/shellSetters.ts')
const dispatch = await import('../src/agent/agentNativeDispatch.ts')
const bridge = await import('../src/agent/shellSetterBridge.ts')
const faceBodies = await import('../src/inhabitants/atlasFaceBodies.tsx')
const {publishAtlasHandle, presentAtlasView} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')
const {TimeModel} = await import('../src/projections/atlas/src/state/timeModel.ts')
const {createTimeScale, formatYear} = await import('../src/projections/atlas/src/data/time.ts')
const {GraphView} = await import('../src/projections/atlas/src/graph/view.ts')
const {DEFAULT_FORCES, FORCE_ROWS, forceMultiple} = await import('../src/projections/atlas/src/graph/forces.ts')
const {DEFAULT_KINDS} = await import('../src/projections/atlas/src/graph/settings.ts')
const {tieBases} = await import('../src/projections/atlas/src/types/field.ts')

const TRANSPORT = {kind: 'bridge', url: 'http://kernel.test'}
const BINDING = 'cursor'
const CTX = {transport: TRANSPORT, binding: BINDING}

/** Stand the world up the way agent-native-p0.test.mjs does, then register the atlas setters (the transport does this in the app). */
function standWorld() {
  door.resetFamilyManifestsForTest()
  five.loadAgentShellFamilies()
  adoptRows.adoptVerifiedRows()
  p0.loadAgentNativeP0()
  bridge.registerAtlasShellSetters()
}

const atlasRows = () => sdkDefine.sdkParamRows('atlas-earth')
const rowOf = key => {
  const row = atlasRows().find(r => r.key === key)
  assert.ok(row, `the atlas-earth row "${key}" is declared`)
  return row
}

/** The graph's controls as the GraphView itself reports them: its real controls() over its own fields, nothing copied. */
function liveGraphControls(overrides = {}) {
  const view = Object.create(GraphView.prototype)
  Object.assign(view, {
    mode: 'global', depth: 1, dust: true, kinds: {...DEFAULT_KINDS}, ties: tieBases({}).map(b => b.id),
    forces: {...DEFAULT_FORCES}, sky: {status: 'off', asOf: ''}, bases: tieBases({}),
  }, overrides)
  return view.controls()
}

/** The graph surface with the setters the GraphView exposes (as atlas-face-bodies.test.mjs): the state the body draws. */
class FakeGraph {
  constructor() {
    this.state = {
      local: false, depth: 1, dust: true, kinds: {archetype: true, theoretic: true, family: true},
      ties: tieBases({}).map(b => b.id), forces: {...DEFAULT_FORCES}, sky: 'off', skyAsOf: '',
    }
    this.calls = []
  }
  controls() {
    return {...this.state, kinds: {...this.state.kinds}, ties: [...this.state.ties], forces: {...this.state.forces}, bases: tieBases({})}
  }
  setDepth(d) { this.state.depth = Math.max(1, Math.min(3, d)) }
  setDust(on) { this.state.dust = on }
  setKinds(kinds) { this.state.kinds = {...kinds} }
  setTies(bases) { this.state.ties = [...bases] }
  setForces(forces) { this.state.forces = {...forces} }
  setSkyAnchors(on) { this.calls.push(['sky', on]); this.state.sky = on ? 'on' : 'off' }
  reframe() { this.calls.push(['reframe']) }
}

/** The mounted atlas's handle as the pane publishes it (as atlas-face-bodies.test.mjs). */
function atlasHandle({graph = null, time = new TimeModel()} = {}) {
  const engine = {baseKind: '2k', whole: false, setWholeField(on) { this.whole = on }}
  const listeners = new Set()
  const ctl = {
    graphControls: graph,
    globeScope: {scope: null, wholeField: false},
    subscribeFaces(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    touches: 0,
    onUserTime() { this.touches += 1 },
  }
  return {ctl, time, engine, model: {scale: createTimeScale(-1000, 1960)}}
}

/** Run a body with the handle published, and withdraw it (and the view) after, however the body ends. */
async function mounted(handle, body) {
  publishAtlasHandle(handle)
  try {
    return await body()
  } finally {
    publishAtlasHandle(null)
    presentAtlasView('earth')
  }
}

const html = element => renderToStaticMarkup(element)
const drawGraph = faceId => html(createElement(faceBodies.AtlasFaceBody, {faceId}))

/** A valid sample for every atlas-earth row, by key: the value each writer is dispatched with. */
const SAMPLE = {
  depth: 2, centre: 1.5, repel: 1.1, link: 0.9, distance: 1.4, ties: ['jung'], kinds: ['archetype'], occurrences: false,
  'sky-anchors': true, view: 'graph', 'whole-field': true, cursor: 0.25, 'all-time': true, play: true, cumulative: true,
}
/** [T-WORLDS §5 W3] your world's body on the globe, declared with the family's rows: its owner is the world body record, not the atlas
 * (tests/w3-world-body-device.test.mjs and tests/w3b-your-system.test.mjs carry its writes). */
const BODY_KEYS = ['body', 'seed', 'seaLevel', 'continents', 'relief', 'warmth', 'moisture', 'iceCaps', 'atmosphere', 'clouds', 'tilt', 'coast']

test('the atlas-earth rows declare the atlas’s own parameters, under the keys the atlas names them by', () => {
  standWorld()
  const expected = [
    ...FORCE_ROWS.map(spec => spec.key),
    'depth', 'ties', 'kinds', 'occurrences', 'sky-anchors', 'view', 'whole-field', 'cursor', 'all-time', 'play', 'cumulative',
    ...BODY_KEYS,
  ].sort()
  assert.deepEqual(atlasRows().map(row => row.key).sort(), expected)
  assert.equal(atlasRows().some(row => row.key === 'occasion-window'), false, 'the clock takes no occasion window')
  for (const retired of ['spread', 'gravity']) {
    assert.equal(atlasRows().some(row => row.key === retired), false, `the stale "${retired}" row is gone`)
  }
})

test('each force row carries the FORCE_ROWS domain, and the GraphView reports the same four forces', () => {
  standWorld()
  const reported = Object.keys(liveGraphControls().forces).sort()
  assert.deepEqual(reported, FORCE_ROWS.map(spec => spec.key).sort(), 'the graph reports exactly the four forces')
  for (const spec of FORCE_ROWS) {
    const row = rowOf(spec.key)
    assert.equal(row.type, 'number')
    assert.equal(row.range.min, spec.min, `${spec.key} min is FORCE_ROWS’`)
    assert.equal(row.range.max, spec.max, `${spec.key} max is FORCE_ROWS’`)
    assert.equal(row.title, spec.label)
    assert.ok(DEFAULT_FORCES[spec.key] >= spec.min && DEFAULT_FORCES[spec.key] <= spec.max, `${spec.key} rests inside its own domain`)
  }
})

test('depth is the GraphView’s own step range: its setDepth clamps to it, and the row carries that clamp', () => {
  standWorld()
  const stepper = Object.create(GraphView.prototype)
  Object.assign(stepper, {depth: 1, lastTargetKey: '', target: null, pushTools() {}, setTarget() {}})
  stepper.setDepth(99)
  const top = stepper.depth
  stepper.setDepth(-5)
  const bottom = stepper.depth
  assert.equal(rowOf('depth').range.min, bottom)
  assert.equal(rowOf('depth').range.max, top)
  assert.equal(liveGraphControls().depth, 1, 'the graph rests at one step')
})

test('ties, kinds, occurrences and sky anchors are the GraphView’s own bases, tiers and toggles', () => {
  standWorld()
  const live = liveGraphControls()
  assert.deepEqual(rowOf('ties').values, live.bases.map(b => b.id), 'the tie bases are the graph’s declared bases')
  assert.deepEqual(rowOf('kinds').values, Object.keys(live.kinds), 'the kinds are the graph’s three tiers')
  assert.equal(typeof live.dust, 'boolean')
  assert.equal(rowOf('occurrences').type, 'boolean')
  assert.equal(rowOf('sky-anchors').type, 'boolean')
  assert.deepEqual(rowOf('view').values, ['earth', 'graph'])
})

test('the time control declares the clock’s own domain and its parameters, read from the TimeModel', () => {
  standWorld()
  const clock = new TimeModel()
  assert.equal(rowOf('cursor').range.min, clock.fromU)
  assert.equal(rowOf('cursor').range.max, clock.toU)
  for (const key of ['all-time', 'play', 'cumulative']) assert.equal(rowOf(key).type, 'boolean', `${key} is a boolean`)
})

test('every atlas-earth writer is registered, and every registered atlas writer is declared by a row', () => {
  standWorld()
  const declared = [...new Set(atlasRows().map(row => row.writePath).filter(path => path?.startsWith('shell.setAtlas')))].sort()
  assert.deepEqual([...bridge.ATLAS_SHELL_SETTERS].sort(), declared, 'the writers the bridge registers are the writers the rows name')
  for (const path of declared) assert.ok(sdkSetters.shellSetter(path), `${path} is registered`)
  // Idempotent: registering again replaces, never doubles or throws.
  bridge.registerAtlasShellSetters()
  assert.equal(sdkSetters.registeredShellSetters().filter(path => path.startsWith('shell.setAtlas')).length, declared.length)
})

test('the writers arm through the family’s own authority: the gate stays green over the atlas rows', () => {
  standWorld()
  const world = sdkValidate.validateAdmittedWorld()
  assert.equal(world.byFamily.size, 0, `gate faults: ${[...world.byFamily].map(([id, faults]) => `${id}: ${faults.join('; ')}`).join(' | ')}`)
  assert.deepEqual(world.cross, [])
})

test('through the row, each writer moves the same graph state the face body reads', async () => {
  standWorld()
  const graph = new FakeGraph()
  graph.state.local = true
  await mounted(atlasHandle({graph}), async () => {
    const depth = await dispatch.fireWritePath(rowOf('depth'), 3, CTX)
    assert.equal(depth.kind, 'fired', depth.reason)
    assert.equal(graph.controls().depth, 3)
    assert.match(drawGraph('graph-tools'), /atlas-face-n">3</, 'the face shows the steps the writer set')

    for (const spec of FORCE_ROWS) {
      const value = Math.round(((spec.min + spec.max) / 2) / spec.step) * spec.step
      const receipt = await dispatch.fireWritePath(rowOf(spec.key), value, CTX)
      assert.equal(receipt.kind, 'fired', `${spec.key}: ${receipt.reason}`)
      assert.equal(graph.controls().forces[spec.key], value, `${spec.key} is the value written`)
      assert.ok(drawGraph('graph-tools').includes(`${forceMultiple(spec.key, value).toFixed(2)}×`), `${spec.key} reads back as the face shows it`)
    }

    const ties = await dispatch.fireWritePath(rowOf('ties'), ['site'], CTX)
    assert.equal(ties.kind, 'fired', ties.reason)
    assert.deepEqual(graph.controls().ties, ['site'])
    assert.match(drawGraph('graph-tools'), /aria-pressed="false"[^>]*>Source</, 'the face shows the relation switched off')

    const kinds = await dispatch.fireWritePath(rowOf('kinds'), ['family'], CTX)
    assert.equal(kinds.kind, 'fired', kinds.reason)
    assert.deepEqual(graph.controls().kinds, {archetype: false, theoretic: false, family: true})
    assert.match(drawGraph('graph-tools'), /aria-pressed="false"[^>]*>Archetypes</)

    const occurrences = await dispatch.fireWritePath(rowOf('occurrences'), false, CTX)
    assert.equal(occurrences.kind, 'fired', occurrences.reason)
    assert.equal(graph.controls().dust, false)
    assert.match(drawGraph('graph-tools'), /aria-pressed="false"[^>]*>Occurrences</)

    const sky = await dispatch.fireWritePath(rowOf('sky-anchors'), true, CTX)
    assert.equal(sky.kind, 'fired', sky.reason)
    assert.equal(graph.controls().sky, 'on')
    assert.deepEqual(graph.calls.at(-1), ['sky', true])
  })
})

test('through the row, the view and the clock move the same atlas state the face bodies read', async () => {
  standWorld()
  const clock = new TimeModel()
  clock.setRange(0, 1)
  const handle = atlasHandle({time: clock})
  await mounted(handle, async () => {
    const view = await dispatch.fireWritePath(rowOf('view'), 'graph', CTX)
    assert.equal(view.kind, 'fired', view.reason)
    assert.match(drawGraph('mode-switch'), /aria-pressed="true"[^>]*>Graph</, 'the mode switch reads the view the writer presented')

    const cursor = await dispatch.fireWritePath(rowOf('cursor'), 0.25, CTX)
    assert.equal(cursor.kind, 'fired', cursor.reason)
    assert.equal(clock.mode, 'cursor')
    assert.equal(clock.cursorU, 0.25)
    assert.match(drawGraph('time-control'), new RegExp(`class="atlas-face-readout"[^>]*>${formatYear(handle.model.scale.fromU(0.25))}<`))
    assert.equal(handle.ctl.touches, 1, 'each user move tells the controller, as the body does')

    const play = await dispatch.fireWritePath(rowOf('play'), true, CTX)
    assert.equal(play.kind, 'fired', play.reason)
    assert.equal(clock.playing, true)
    const paused = await dispatch.fireWritePath(rowOf('play'), false, CTX)
    assert.equal(paused.kind, 'fired', paused.reason)
    assert.equal(clock.playing, false)

    const cumulative = await dispatch.fireWritePath(rowOf('cumulative'), true, CTX)
    assert.equal(cumulative.kind, 'fired', cumulative.reason)
    assert.equal(clock.cumulative, true)

    const all = await dispatch.fireWritePath(rowOf('all-time'), true, CTX)
    assert.equal(all.kind, 'fired', all.reason)
    assert.equal(clock.mode, 'all')
    assert.match(drawGraph('time-control'), />All time</)
  })
})

test('an out-of-range or malformed value is refused by name, and the atlas state does not move', async () => {
  standWorld()
  const cases = [
    ['depth', 0], ['depth', 4], ['depth', 1.5], ['depth', 'two'],
    ['centre', 0.1], ['repel', 9], ['link', 0], ['distance', 9],
    ['ties', ['nope']], ['ties', ['site', 'site']], ['ties', 'site'],
    ['kinds', ['tower']], ['kinds', ['family', 'family']],
    ['occurrences', 'yes'], ['sky-anchors', 1],
    ['view', 'moon'],
    ['cursor', 2], ['cursor', -1],
    ['all-time', false], ['play', 'yes'], ['cumulative', 1],
  ]
  const graph = new FakeGraph()
  graph.state.local = true
  const clock = new TimeModel()
  clock.setRange(0, 1)
  await mounted(atlasHandle({graph, time: clock}), async () => {
    const before = JSON.stringify([graph.state, clock.mode, clock.cursorU, clock.playing, clock.cumulative])
    for (const [key, value] of cases) {
      const row = rowOf(key)
      const receipt = await dispatch.fireWritePath(row, value, CTX)
      assert.equal(receipt.kind, 'refused', `${key} ${JSON.stringify(value)} is refused`)
      assert.ok(receipt.reason.includes(row.writePath), `${key}: the refusal names ${row.writePath}: ${receipt.reason}`)
      assert.equal(JSON.stringify([graph.state, clock.mode, clock.cursorU, clock.playing, clock.cumulative]), before, `${key}: nothing moved`)
    }
  })
})

test('with no atlas mounted, every writer that needs the atlas refuses by name; the view stands, as the face body’s does', async () => {
  standWorld()
  publishAtlasHandle(null)
  const all = atlasRows().filter(row => row.writePath && !BODY_KEYS.includes(row.key))
  for (const row of all) assert.ok(row.key in SAMPLE, `${row.key} has a valid sample`)
  try {
    const view = await dispatch.fireWritePath(rowOf('view'), 'graph', CTX)
    assert.equal(view.kind, 'fired', 'the view is the shell’s mirror, chosen before the Earth mounts')
    assert.match(drawGraph('mode-switch'), /aria-pressed="true"[^>]*>Graph</)
  } finally { presentAtlasView('earth') }
  const rows = all.filter(row => row.key !== 'view')
  for (const row of rows) {
    const receipt = await dispatch.fireWritePath(row, SAMPLE[row.key], CTX)
    assert.equal(receipt.kind, 'refused', `${row.writePath} refuses while unmounted`)
    assert.ok(receipt.reason.includes(row.writePath), `the refusal names ${row.writePath}`)
    assert.match(receipt.reason, /not mounted|has not mounted/)
  }
})

test('with the atlas mounted but its graph unopened, the graph writers refuse by name; the clock still answers', async () => {
  standWorld()
  const clock = new TimeModel()
  clock.setRange(0, 1)
  await mounted(atlasHandle({graph: null, time: clock}), async () => {
    for (const key of ['depth', 'centre', 'ties', 'kinds', 'occurrences', 'sky-anchors']) {
      const receipt = await dispatch.fireWritePath(rowOf(key), SAMPLE[key], CTX)
      assert.equal(receipt.kind, 'refused', `${key} refuses before the graph is opened`)
      assert.match(receipt.reason, /not been opened in this session/)
    }
    const cursor = await dispatch.fireWritePath(rowOf('cursor'), 0.5, CTX)
    assert.equal(cursor.kind, 'fired', cursor.reason)
    assert.equal(clock.cursorU, 0.5)
  })
})

test('the writers drive the atlas face actions the body calls, not copies of them', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../src/agent/shellSetterBridge.ts', import.meta.url), 'utf8')
  assert.match(source, /from '\.\.\/inhabitants\/atlasFaceActions\.ts'/, 'the bridge imports the face actions')
  for (const action of ['stepDepth', 'setForce', 'toggleTie', 'toggleKind', 'toggleOccurrences', 'toggleSky', 'scrubClock', 'allTime', 'playOrPause', 'toggleCumulative']) {
    assert.match(source, new RegExp(`\\b${action}\\(`), `${action} is called by a writer`)
  }
  assert.match(source, /presentAtlasView\(/, 'the view writer presents the view through the atlas mirror the lens bar reads')
})

test('the globe’s whole-field choice: refused by name with no set aside, and through the row it moves the engine the body reads', async () => {
  standWorld()
  const handle = atlasHandle()
  await mounted(handle, async () => {
    const none = await dispatch.fireWritePath(rowOf('whole-field'), true, CTX)
    assert.equal(none.kind, 'refused')
    assert.match(none.reason, /shell\.setAtlasWholeField refuses.*no whole-field choice/)
    assert.equal(handle.engine.whole, false, 'nothing moved')
    handle.ctl.globeScope = {scope: {label: 'the Red Book’s places'}, wholeField: false}
    const bad = await dispatch.fireWritePath(rowOf('whole-field'), 'yes', CTX)
    assert.equal(bad.kind, 'refused')
    const on = await dispatch.fireWritePath(rowOf('whole-field'), true, CTX)
    assert.equal(on.kind, 'fired', on.reason)
    assert.equal(handle.engine.whole, true, 'the same engine call the body makes')
    const off = await dispatch.fireWritePath(rowOf('whole-field'), false, CTX)
    assert.equal(off.kind, 'fired', off.reason)
    assert.match(off.note, /the Red Book’s places/)
    assert.equal(handle.engine.whole, false)
  })
})
