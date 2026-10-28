import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The atlas family's face bodies on the 0 instrument (DEVICE-SEMANTICS-LOCK §0.1.3, §8.1; T-EVERY-MODE-INSTRUMENTS).
// Production modules in memory, the pane-instrument.test.mjs loader pattern. The atlas itself needs WebGL and a DOM to
// mount, so the atlas's state is held here by its own classes (TimeModel, createTimeScale) and by a graph surface with
// the same setters the GraphView exposes; the bodies are read through the same handle the pane publishes.
const compiler = new URL('file:///Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/node_modules/typescript/lib/typescript.js', import.meta.url).href
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {TechneInstrumentsDetail} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/shell/ModeDetail.tsx')
const {AtlasFaceBody, ATLAS_FACE_IDS, isAtlasFaceId} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/inhabitants/atlasFaceBodies.tsx')
const actions = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/inhabitants/atlasFaceActions.ts')
const {inhabitantManifest} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/inhabitants/manifest.ts')
const {ATLAS_FAMILY_ID} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/projections/atlas/atlasFamilyManifest.ts')
const {publishAtlasHandle, presentAtlasView} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/projections/atlas/AtlasProjectionPanel.tsx')
const {TimeModel} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/projections/atlas/src/state/timeModel.ts')
const {createTimeScale, formatYear} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/projections/atlas/src/data/time.ts')
const {DEFAULT_FORCES, FORCE_ROWS, forceMultiple} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/projections/atlas/src/graph/forces.ts')
const {DEFAULT_TIE_BASES} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/projections/atlas/src/types/field.ts')

const html = element => renderToStaticMarkup(element)
const transport = {kind: 'unavailable', reason: 'the test carrier is down'}

const expandedOf = (out, faceId) => {
  const match = out.match(new RegExp(`data-face-id="${faceId}"[^>]*data-expanded="(true|false)"`))
  if (!match) throw new Error(`the face ${faceId} is on the rack`)
  return match[1]
}

/** The graph surface with the setters the GraphView exposes (graph/view.ts) and the state GraphTools draws (controls()). */
class FakeGraph {
  constructor() {
    this.state = {
      local: false, depth: 1, dust: true, kinds: {archetype: true, theoretic: true, family: true},
      ties: DEFAULT_TIE_BASES.map(b => b.id), forces: {...DEFAULT_FORCES}, sky: 'off', skyAsOf: '',
    }
    this.calls = []
  }
  controls() {
    return {...this.state, kinds: {...this.state.kinds}, ties: [...this.state.ties], forces: {...this.state.forces}, bases: DEFAULT_TIE_BASES}
  }
  setDepth(d) { this.state.depth = Math.max(1, Math.min(3, d)) }
  setDust(on) { this.state.dust = on }
  setKinds(kinds) { this.state.kinds = {...kinds} }
  setTies(bases) { this.state.ties = [...bases] }
  setForces(forces) { this.state.forces = {...forces} }
  setSkyAnchors(on) { this.calls.push(['sky', on]); this.state.sky = on ? 'on' : 'off' }
  reframe() { this.calls.push(['reframe']) }
}

/** The mounted atlas's handle as the pane publishes it: the clock, the scale, the controller's notices, the globe. */
function atlasHandle({graph = null, time = new TimeModel(), scope = null} = {}) {
  const engine = {baseKind: '2k', whole: false, setWholeField(on) { this.whole = on }}
  const listeners = new Set()
  const ctl = {
    graphControls: graph,
    globeScope: {scope, wholeField: engine.whole},
    subscribeFaces(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    touches: 0,
    onUserTime() { this.touches += 1 },
  }
  return {ctl, time, engine, model: {scale: createTimeScale(-1000, 1960)}}
}

const withAtlas = (handle, body) => {
  publishAtlasHandle(handle)
  try {
    return body()
  } finally {
    publishAtlasHandle(null)
    presentAtlasView('earth')
  }
}

test('the 0 instrument is one plate: its sections draw the four atlas faces\' controls, each face a mark on its section, each body its picture in the pool', async () => {
  const out = html(createElement(TechneInstrumentsDetail, {transport, focusInstrument: 'techne:m0'}))
  assert.match(out, /data-instrument="techne:m0" data-expanded="true" data-project-plate="true"/, 'one coherent plate (lane E), not three boxed sub-devices')
  for (const id of ATLAS_FACE_IDS) assert.match(out, new RegExp(`class="plate-held-mark" data-device="atlas-earth:${id}"`), `${id} is held by techne:m0: its mark stands on the section that draws it`)
  assert.doesNotMatch(out, /data-atlas-face=/, 'no face body is boxed inside the plate')
  assert.doesNotMatch(out, /docks when its material is selected/, 'no atlas face shows the empty-slot notice')
  // the pool and a pane still show each face whole, its body its picture (the door publishes the same entries)
  const {techneEntries} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/inhabitants/ql/devices/TechneDevices.tsx')
  const {atlasReading} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/inhabitants/ql/devices/atlasDevices.ts')
  const entries = techneEntries([inhabitantManifest(ATLAS_FAMILY_ID)], {atlas: atlasReading(null, 'earth'), surface: null, torus: null, instrumentReading: null})
  for (const id of ATLAS_FACE_IDS) {
    const entry = entries.find(candidate => candidate.face.id === id)
    assert.match(html(entry.picture('whole')), new RegExp(`data-atlas-face="${id}"`), `${id}: its body is its picture in the pool`)
  }
})

test('the 0 instrument\'s plate reads the mounted atlas and draws the faces\' controls in the device craft, each through the bodies\' own acts', async () => {
  const {ProjectPlate} = await import('/Users/admin/Central/worktrees/env-2/o-i/packages/live-shell/ui/src/inhabitants/ql/devices/ProjectPlate.tsx')
  const graph = new FakeGraph()
  graph.state.local = true
  graph.state.depth = 2
  const out = withAtlas(atlasHandle({graph}), () => html(createElement(ProjectPlate, {held: [], focused: true})))
  const section = id => out.slice(out.indexOf(`data-section="${id}"`), out.indexOf('</section>', out.indexOf(`data-section="${id}"`)))
  assert.match(section('graph'), /role="radiogroup" aria-label="Steps"[\s\S]*?aria-checked="true"[^>]*>2</, 'the steps the graph reaches, lit by its reading')
  for (const label of ['Archetypes', 'Theoretics', 'Families', 'Occurrences']) assert.match(section('graph'), new RegExp(`aria-pressed="true"[^>]*>${label}<`), `${label} lit as the graph draws it`)
  assert.match(section('graph'), /aria-pressed="false"[^>]*>Sky anchors</, 'sky anchors off, as the graph reads')
  for (const row of FORCE_ROWS) assert.match(section('forces'), new RegExp(`aria-valuetext="${forceMultiple(row.key, DEFAULT_FORCES[row.key]).toFixed(2)}×"`), `${row.label}: a dial at the arrangement as drawn`)
  assert.match(section('view'), /data-disabled="true"[^>]*>[\s\S]*?Scope/, 'no set aside on the globe: the scope waits, and says why')
  assert.match(section('time'), /All time/, 'the clock reads all time')
  const unmounted = html(createElement(ProjectPlate, {held: [], focused: true}))
  assert.match(unmounted, /The Earth has not mounted in this session/, 'no atlas: each control waits with the body\'s own words')
  assert.doesNotMatch(unmounted, /aria-valuetext="1\.00×"/, 'no force is drawn as a value nobody holds')
})

test('every atlas face the family declares has a body, and each is collapsible on the rack', () => {
  const manifest = inhabitantManifest(ATLAS_FAMILY_ID)
  assert.ok(manifest, 'the atlas family is admitted')
  const declared = manifest.faces.map(face => face.id).sort()
  assert.deepEqual(declared, [...ATLAS_FACE_IDS].sort())
  for (const id of ATLAS_FACE_IDS) assert.ok(isAtlasFaceId(id))
  for (const face of manifest.faces) {
    assert.ok((face.dock ?? []).includes('expand'), `${face.id} docks and expands`)
  }
})

test('the deep-time face is held by the 0 instrument as well as the Timeline', () => {
  const face = inhabitantManifest(ATLAS_FAMILY_ID).faces.find(f => f.id === 'time-control')
  assert.ok(face.heldBy.includes('techne:m0'), 'the Earth pane’s clock is the 0 instrument’s')
  assert.ok(face.heldBy.includes('techne:m2'), 'the Timeline keeps the face it held')
})

test('with no atlas mounted, each body says so and keeps no state of its own', () => {
  publishAtlasHandle(null)
  assert.match(html(createElement(AtlasFaceBody, {faceId: 'time-control'})), /stands with the Earth pane/)
  assert.match(html(createElement(AtlasFaceBody, {faceId: 'graph-tools'})), /stands with the Earth pane/)
  assert.match(html(createElement(AtlasFaceBody, {faceId: 'globe-engine'})), /stands with the Earth pane/)
  assert.match(html(createElement(AtlasFaceBody, {faceId: 'mode-switch'})), /has not mounted in this session/)
})

test('the mode switch is the atlas view the lens bar reads: a choice made on the face is the view the pane follows', () => {
  presentAtlasView('earth')
  const earth = withAtlas(atlasHandle(), () => html(createElement(AtlasFaceBody, {faceId: 'mode-switch'})))
  assert.match(earth, /aria-pressed="true"[^>]*>Earth</)
  presentAtlasView('graph')
  const graph = withAtlas(atlasHandle(), () => html(createElement(AtlasFaceBody, {faceId: 'mode-switch'})))
  assert.match(graph, /aria-pressed="true"[^>]*>Graph</, 'the face reads the same view the pane was asked for')
  assert.match(graph, /data-view="graph"/)
})

test('the graph body shows the constellation’s own controls, at the atlas’s ranges', () => {
  const unopened = withAtlas(atlasHandle({graph: null}), () => html(createElement(AtlasFaceBody, {faceId: 'graph-tools'})))
  assert.match(unopened, /has not been opened in this session/)
  assert.match(unopened, /Show the graph/)

  const graph = new FakeGraph()
  const out = withAtlas(atlasHandle({graph}), () => html(createElement(AtlasFaceBody, {faceId: 'graph-tools'})))
  assert.match(out, /data-graph="open"/)
  assert.doesNotMatch(out, /Steps/, 'steps belong to a local graph, as in GraphTools')
  for (const label of ['Occurrences', 'Archetypes', 'Theoretics', 'Families', 'Source', 'Inferred', 'Site', 'Sky anchors', 'Reframe graph']) {
    assert.match(out, new RegExp(`>${label}<`), `${label} is drawn`)
  }
  for (const row of FORCE_ROWS) {
    assert.match(out, new RegExp(`aria-label="${row.label}: ${row.tip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${row.label} carries its tip`)
    assert.match(out, new RegExp(`min="${row.min}" max="${row.max}" step="${row.step}"`), `${row.label} keeps its range`)
  }
  assert.match(out, /1\.00×/, 'the forces read as multiples of the arrangement as drawn')

  graph.state.local = true
  graph.state.depth = 2
  const local = withAtlas(atlasHandle({graph}), () => html(createElement(AtlasFaceBody, {faceId: 'graph-tools'})))
  assert.match(local, /aria-label="More steps from the subject"/)
  assert.match(local, /data-local="yes"/)
})

test('graph acts change the state the pane’s GraphTools reads, and only what they name', () => {
  const graph = new FakeGraph()
  actions.stepDepth(graph, 1)
  assert.equal(graph.controls().depth, 2, 'Steps + reaches the pane’s reading')
  actions.stepDepth(graph, 1)
  actions.stepDepth(graph, 1)
  assert.equal(graph.controls().depth, 3, 'the atlas stops at three steps')

  actions.toggleOccurrences(graph)
  assert.equal(graph.controls().dust, false)

  actions.toggleKind(graph, 'family')
  assert.deepEqual(graph.controls().kinds, {archetype: true, theoretic: true, family: false}, 'only the family tier turns off')

  actions.toggleTie(graph, 'inferred')
  assert.deepEqual(graph.controls().ties, DEFAULT_TIE_BASES.map(b => b.id).filter(id => id !== 'inferred'))
  actions.toggleTie(graph, 'inferred')
  assert.ok(graph.controls().ties.includes('inferred'), 'a relation toggled back on is drawn again')

  actions.setForce(graph, 'repel', 1.2)
  assert.equal(graph.controls().forces.repel, 1.2)
  assert.equal(graph.controls().forces.centre, DEFAULT_FORCES.centre, 'the other forces keep their values')
  actions.resetForces(graph)
  assert.deepEqual(graph.controls().forces, DEFAULT_FORCES)

  actions.toggleSky(graph)
  assert.equal(graph.controls().sky, 'on')
  actions.toggleSky(graph)
  assert.equal(graph.controls().sky, 'off')
  assert.deepEqual(graph.calls, [['sky', true], ['sky', false]])
})

test('a change made on the pane side is what the graph body shows next', () => {
  const graph = new FakeGraph()
  graph.setDust(false) // the pane's own GraphTools path
  const out = withAtlas(atlasHandle({graph}), () => html(createElement(AtlasFaceBody, {faceId: 'graph-tools'})))
  assert.match(out, /aria-pressed="false"[^>]*>Occurrences</, 'the body reads the pane’s occurrences state')
})

test('the deep-time body reads the clock the pane’s time control reads, and its readout is that year', () => {
  const time = new TimeModel()
  const handle = atlasHandle({time})
  time.scrub(0.25) // the pane's own scrub path
  const out = withAtlas(handle, () => html(createElement(AtlasFaceBody, {faceId: 'time-control'})))
  assert.match(out, new RegExp(`<p class="atlas-face-readout"[^>]*>${formatYear(handle.model.scale.fromU(0.25))}</p>`))
  assert.match(out, /data-mode="cursor"/)

  const all = withAtlas(atlasHandle({time: new TimeModel()}), () => html(createElement(AtlasFaceBody, {faceId: 'time-control'})))
  assert.match(all, />All time</, 'the resting state reads as all time')
})

test('deep-time acts move the same TimeModel the pane reads, and each user move tells the controller', () => {
  const time = new TimeModel()
  time.setRange(0, 1)
  const handle = atlasHandle({time})
  actions.scrubClock(handle.ctl, time, 0.5)
  assert.equal(time.mode, 'cursor')
  assert.equal(time.cursorU, 0.5, 'the pane’s clock stands where the face put it')
  assert.equal(handle.ctl.touches, 1)

  actions.playOrPause(handle.ctl, time)
  assert.equal(time.playing, true)
  actions.playOrPause(handle.ctl, time)
  assert.equal(time.playing, false)
  assert.equal(handle.ctl.touches, 3)

  actions.toggleCumulative(time)
  assert.equal(time.cumulative, true)

  actions.allTime(handle.ctl, time)
  assert.equal(time.mode, 'all')
  assert.equal(time.cumulative, false, 'all time is the resting state')
  assert.equal(handle.ctl.touches, 4)
})

test('the globe exposes one parameter, the whole-field choice, and it reaches the engine', () => {
  const plain = withAtlas(atlasHandle(), () => html(createElement(AtlasFaceBody, {faceId: 'globe-engine'})))
  assert.match(plain, /No mode’s set is set aside/)
  assert.match(plain, /exposes no other parameter/)
  assert.match(plain, /data-base="2k"/)

  const handle = atlasHandle({scope: {label: 'Archetype · Serpent', own: 4, nearby: 2}})
  const scoped = withAtlas(handle, () => html(createElement(AtlasFaceBody, {faceId: 'globe-engine'})))
  assert.match(scoped, /Archetype · Serpent/)
  assert.match(scoped, /aria-pressed="false"[^>]*>Whole field</)

  actions.setWholeField(handle.engine, true)
  assert.equal(handle.engine.whole, true, 'the engine the shell reads holds the choice')
})

test('the four atlas faces are a closed set, and the forces are the atlas’s own four', () => {
  assert.deepEqual(FORCE_ROWS.map(row => row.key), ['centre', 'repel', 'link', 'distance'])
  assert.equal(forceMultiple('centre', DEFAULT_FORCES.centre), 1)
  assert.deepEqual([...ATLAS_FACE_IDS].sort(), ['globe-engine', 'graph-tools', 'mode-switch', 'time-control'])
  assert.equal(isAtlasFaceId('torus'), false)
})
