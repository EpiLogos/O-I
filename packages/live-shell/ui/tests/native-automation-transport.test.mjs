import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// Production modules in memory: .ts/.tsx transpiled, CSS stubbed, and @epilogos/expressions-boundary/<name> resolved to the boundary source.
// The desktop owner sources are imported by absolute URL, as the sibling boundary tests do. No owner, store, server or browser is simulated.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const boundary = new URL('packages/expressions-boundary/src/', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
const BOUNDARY = ${JSON.stringify(boundary)};
export async function resolve(s, c, n) {
  if (s.startsWith('@epilogos/expressions-boundary/')) return n(BOUNDARY + s.slice('@epilogos/expressions-boundary/'.length) + '.ts', c);
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root)
const engine = new URL('desktop/cradle/expressions-app/src/engine/', root)
const [model, edits, parameters, faceModel, faceView, sharedModel] = await Promise.all([
  import(new URL('model.ts', author)),
  import(new URL('nativeAutomationEdits.ts', boundary)),
  import(new URL('parameters.ts', boundary)),
  import('../src/components/nativeSceneFace.automation.ts'),
  import('../src/components/NativeSceneFace.automation.tsx'),
    import(new URL('nativeSharedSettings.ts', boundary)),
])
const {AutomationFacePanel} = faceView
const {applyNativeAutomationChanges} = edits
const {NATIVE_BINDINGS} = parameters
const {groupLeaders, playAllChanges, pauseAllChanges, hasOneShotLeader, automationFrameReason} = faceModel
const {SHAREABLE_FIELD_BINDINGS} = sharedModel

const apply = (journey, changes) => applyNativeAutomationChanges(journey, journey.scenes[0].id, changes)
const add = target => ({kind: 'automation-add', target})
const set = (lane_id, values) => ({kind: 'automation-set', lane_id, values})
const lanesOf = journey => journey.scenes[0].automation
const laneOf = (journey, id) => lanesOf(journey).find(lane => lane.id === id)
const SCENE_REF = 'expression:whole:scene:main'
const keyed = index => 'field.' + SHAREABLE_FIELD_BINDINGS[index].key

/** Leader A (one-shot ramp) with follower B; independent C (LFO). All enabled, as add() creates them. */
function transportJourney() {
  let journey = apply(model.blankJourney(), [add(keyed(0)), add(keyed(1))])
  const [a, b] = lanesOf(journey).map(lane => lane.id)
  journey = apply(journey, [set(a, {type: 'ramp'}), {kind: 'automation-link', lane_id: b, leader_id: a}])
  return apply(journey, [add(keyed(2))])
}
function readingOf(journey, over = {}) {
  return {
    basis: {expression_ref: 'expression:whole', revision: 3, scene_ref: SCENE_REF, authored_revision: 5},
    scene: journey.scenes[0], entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, devices: [],
    selection: {entity_ids: [], step_id: null}, history: {canUndo: false, canRedo: false}, standing: {dirty: false, pending: false, notice: null}, ...over,
  }
}
/** The button whose visible label is `label`: its opening tag, so disabled and aria-pressed can be read. */
function buttonTag(markup, label) {
  const at = markup.indexOf(`>${label}</button>`)
  if (at < 0) return null
  return markup.slice(markup.lastIndexOf('<button', at), at + 1)
}
const renderPanel = reading => renderToStaticMarkup(createElement(AutomationFacePanel, {reading, request: async () => ({ok: true, reading}), disabled: false, apply: async () => ({ok: true, reading})}))

test('Pause all holds only the group leaders at their base, as one document change per leader', () => {
  const journey = transportJourney()
  const lanes = lanesOf(journey)
  const leaders = groupLeaders(lanes).map(lane => lane.id)
  assert.equal(leaders.length, 2, 'A and C lead; B follows A');
  const changes = pauseAllChanges(lanes)
  assert.deepEqual(changes.map(change => change.lane_id), leaders)
  for (const change of changes) assert.deepEqual(change, {kind: 'automation-set', lane_id: change.lane_id, values: {enabled: false}})
  const paused = apply(journey, changes)
  for (const id of leaders) assert.equal(laneOf(paused, id).enabled, false)
  assert.equal(laneOf(paused, lanes[1].id).enabled, true, 'a follower keeps its own enabled flag');
  assert.deepEqual(pauseAllChanges(lanesOf(paused)), [], 'nothing left to hold once every leader is held')
})

test('Play all re-enables only held leaders, and a scene without a ramp has nothing to play', () => {
  const journey = transportJourney()
  const paused = apply(journey, pauseAllChanges(lanesOf(journey)))
  const changes = playAllChanges(lanesOf(paused))
  assert.deepEqual(changes.map(change => change.values), [{enabled: true}, {enabled: true}])
  const played = apply(paused, changes)
  for (const leader of groupLeaders(lanesOf(played))) assert.equal(leader.enabled, true)
  assert.deepEqual(playAllChanges(lanesOf(played)), [], 'enabled leaders need no enabling step')
  assert.equal(hasOneShotLeader(lanesOf(journey)), true)
  const lfoOnly = apply(model.blankJourney(), [add(keyed(0))])
  assert.equal(hasOneShotLeader(lanesOf(lfoOnly)), false, 'an LFO group is not a one-shot')
})

test('the panel renders Play all and Loop off with the reason when no application is mounted', () => {
  const markup = renderPanel(readingOf(transportJourney()))
  assert.match(buttonTag(markup, 'Play all'), /disabled=""/)
  assert.match(buttonTag(markup, 'Loop'), /disabled=""/)
  assert.doesNotMatch(buttonTag(markup, 'Pause all'), /disabled=""/, 'pause is a document change and needs no application')
  assert.match(markup, /title="No Expressions application is mounted\."/)
})

test('the frame reason names the first thing to do before a runtime automation command can reach the application', () => {
  assert.equal(automationFrameReason({run: null, state: null}), 'No Expressions application is mounted.')
  assert.equal(automationFrameReason({run: async () => ({ok: true}), state: null}), 'The Expressions application has not reported its state yet.')
  assert.equal(automationFrameReason({run: async () => ({ok: true}), state: {hostMode: 'expressions', sceneCount: 0}}), 'Open a native Expression to run its automation.')
  assert.equal(automationFrameReason({run: async () => ({ok: true}), state: {hostMode: 'expressions', sceneCount: 1, nativeScene: {expression_ref: 'expression:whole', revision: 3, scene_ref: SCENE_REF}}}), null)
})
