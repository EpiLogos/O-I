import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// The Clip side of a scene as the piano roll (DEVICE-SEMANTICS-LOCK §9.4): production modules
// in memory, the mode-surface loader pattern (.ts/.tsx transpiled, CSS stubbed).
const root = new URL('../../../../', import.meta.url)
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
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {entity} = await import(new URL('desktop/cradle/expressions-app/field-studies-journeys/src/model.ts', root).href)
const {SceneSequenceEditor, sceneSequenceModel, selectStateRequest, openStateRequest} = await import('../src/components/SceneSequenceEditor.tsx')

const html = element => renderToStaticMarkup(element)
const noop = async () => ({ok: true, reading: null})

// Two formation objects and one force, in the native reading's shape. Alpha's first state
// holds 2 with a 0.5 glide; its second holds 4 (an authored override) with no glide.
function alpha() {
  const e = entity('Alpha', 'A', {x: 0, y: 0, z: 0})
  e.id = 'entity-a'
  e.sequence = {enabled: true, clock: 'seconds', hold: 2, transition: .5, steps: [
    {id: 'a1', text: 'A', shape: 'text', hold: 2, transition: .5, transitionOverride: true, position: null},
    {id: 'a2', text: '', shape: 'ring', hold: 4, holdOverride: true, transition: 0, transitionOverride: true, position: null},
  ]}
  return e
}
function beta() {
  const e = entity('Beta', 'B', {x: 1, y: 0, z: 0})
  e.id = 'entity-b'
  e.sequence = {enabled: true, clock: 'seconds', hold: 1, transition: 0, steps: [
    {id: 'b1', text: 'B', shape: 'text', hold: 1, transition: 0, transitionOverride: true, position: null},
  ]}
  return e
}
function force() {
  const e = entity('Attractor', '', {x: 0, y: 1, z: 0})
  e.id = 'entity-p'
  e.kind = 'pin'
  e.sequence = {enabled: false, clock: 'seconds', steps: []}
  return e
}

function readingOf({entities = [alpha(), beta(), force()], automation = [], propertyTracks = [], occurrences, selection, pending = false, duration = 10} = {}) {
  return {
    basis: {expression_ref: 'expression-1', revision: 3, scene_ref: 'scene-ref-1', authored_revision: 1},
    scene: {id: 'scene-1', name: 'Opening', duration, character: '', transition: 1, morph: {dwell: .3},
      entities, text: [], automation, propertyTracks, engine: {}, field: {}, composition: {}, view: {}},
    entityOccurrences: occurrences ?? {'entity-a': 'occ-a', 'entity-b': 'occ-b', 'entity-p': 'occ-p'},
    chosenControls: {}, devices: [],
    selection: selection ?? {entity_ids: [], step_id: null},
    history: {canUndo: false, canRedo: false},
    standing: {dirty: false, pending, notice: null},
  }
}

const lane = automation => ({id: 'lane-1', enabled: automation.enabled ?? true, target: automation.target ?? 'field.params.size',
  type: 'lfo', wave: 'sine', min: 0, max: 1, rate: 1, phase: 0, blend: 'replace', duration: 1, delay: 0, loop: 'loop', firedAt: null})

test('lanes are the objects; one note per state, in the reading order', () => {
  const model = sceneSequenceModel(readingOf())
  assert.deepEqual(model.lanes.map(l => l.name), ['Alpha', 'Beta', 'Attractor'])
  assert.deepEqual(model.lanes.map(l => l.notes.length), [2, 1, 0])
  assert.equal(model.noteCount, 3)
  assert.equal(model.unit, 'seconds')
})

test('a note starts where the previous state ends, its length is the hold, its glide the transition', () => {
  const [first, second] = sceneSequenceModel(readingOf()).lanes[0].notes
  assert.deepEqual([first.start, first.length, first.glide], [0, 2, .5])
  assert.deepEqual([second.start, second.length, second.glide], [2.5, 4, 0])
})

test('note widths are proportional to hold on one scale', () => {
  const out = html(createElement(SceneSequenceEditor, {reading: readingOf(), request: noop}))
  const widths = [...out.matchAll(/class="scene-note(?: is-selected)?"[^>]*?style="left:([\d.]+)%;width:([\d.]+)%"/g)].map(m => [Number(m[1]), Number(m[2])])
  assert.equal(widths.length, 3, 'one bar per state')
  const [[left1, width1], [left2, width2]] = widths
  assert.equal(left1, 0)
  assert.equal(width2 / width1, 2, 'a hold of 4 is drawn twice as wide as a hold of 2')
  assert.equal(left2, 25, 'the second state starts at 2.5 of 10')
})

test('a transition is drawn as a glide tail after its hold, and only where it is not zero', () => {
  const out = html(createElement(SceneSequenceEditor, {reading: readingOf(), request: noop}))
  assert.equal((out.match(/class="scene-glide"/g) ?? []).length, 1, 'one tail: the first state glides, the second does not')
  assert.ok(/class="scene-glide"[^>]*style="left:20%;width:5%"/.test(out), 'the tail starts at the hold end and spans 0.5 of 10')
})

test('the ruler is in scene units, one tick per whole second of a ten-second scene', () => {
  const out = html(createElement(SceneSequenceEditor, {reading: readingOf(), request: noop}))
  assert.equal((out.match(/class="scene-tick"/g) ?? []).length, 11)
})

test('envelopes are listed under the notes, each naming its modulator', () => {
  const reading = readingOf({automation: [lane({})]})
  const model = sceneSequenceModel(reading)
  assert.equal(model.envelopes.length, 1)
  assert.equal(model.envelopes[0].target, 'field.params.size')
  const out = html(createElement(SceneSequenceEditor, {reading, request: noop}))
  assert.ok(out.includes('class="scene-envelope"'), 'the envelope row is drawn')
  assert.ok(out.includes('modulated by'), 'the envelope states what moves it')
})

test('a disabled automation lane is listed as off, with no modulator claimed', () => {
  const model = sceneSequenceModel(readingOf({automation: [lane({enabled: false})]}))
  assert.equal(model.envelopes[0].enabled, false)
  assert.equal(model.envelopes[0].modulatedBy, null)
})

test('recorded takes are listed beside the clip', () => {
  const reading = readingOf({propertyTracks: [{id: 'take-1', bind: 'field.params.size', points: []}]})
  const out = html(createElement(SceneSequenceEditor, {reading, request: noop}))
  assert.ok(out.includes('Take take-1'))
})

test('a scene with no sequence states shows the honest empty state and no notes', () => {
  const reading = readingOf({entities: [force()]})
  const out = html(createElement(SceneSequenceEditor, {reading, request: noop}))
  assert.ok(out.includes('no sequence states to draw'))
  assert.ok(!/class="scene-note(?: is-selected)?"/.test(out), 'no note bars')
})

test('an object with no native occurrence is drawn but its states cannot be addressed', () => {
  const out = html(createElement(SceneSequenceEditor, {reading: readingOf({occurrences: {}}), request: noop}))
  const buttons = [...out.matchAll(/<button type="button" class="scene-note[^"]*"[^>]*>/g)].map(m => m[0])
  assert.equal(buttons.length, 3)
  assert.ok(buttons.every(b => b.includes('disabled')), 'every note disabled')
})

test('a pending owner disables the notes', () => {
  const out = html(createElement(SceneSequenceEditor, {reading: readingOf({pending: true}), request: noop}))
  const buttons = [...out.matchAll(/<button type="button" class="scene-note[^"]*"[^>]*>/g)].map(m => m[0])
  assert.ok(buttons.every(b => b.includes('disabled')))
  assert.ok(out.includes('Owner pending'))
})

test('an unreadable engine timing is named, and the authored hold and transition are drawn instead', () => {
  const broken = alpha()
  broken.sequence.steps[1].id = 'a1'
  const reading = readingOf({entities: [broken]})
  const out = html(createElement(SceneSequenceEditor, {reading, request: noop}))
  assert.ok(out.includes('Engine timing unreadable'), 'the fault is shown, not hidden')
  assert.equal((out.match(/class="scene-note(?: is-selected)?"/g) ?? []).length, 2, 'the states are still drawn')
})

test('a selected state is marked, and the clip offers to open it', () => {
  const reading = readingOf({selection: {entity_ids: ['entity-a'], step_id: 'a2'}})
  const model = sceneSequenceModel(reading)
  assert.equal(model.selected?.stepId, 'a2')
  const out = html(createElement(SceneSequenceEditor, {reading, request: noop}))
  assert.ok(out.includes('scene-note is-selected'))
  assert.ok(out.includes('Open selected state'))
})

test('no reading shows the owner as loading', () => {
  assert.ok(html(createElement(SceneSequenceEditor, {reading: null, request: noop})).includes('Native owner loading'))
})

test('edits go through the existing requests only: select a state, or open its native editor', () => {
  const reading = readingOf()
  assert.deepEqual(selectStateRequest(reading, 'entity-a', 'a1'), {operation: 'select', basis: reading.basis, entity_id: 'entity-a', step_id: 'a1'})
  assert.deepEqual(openStateRequest(reading, 'entity-a', 'a1'), {operation: 'open', basis: reading.basis, entity_id: 'entity-a', step_id: 'a1', editor: 'source'})
})

test('the scene\'s roll is its Clip view\'s Sequence tab (R2: clip:expressions); the retained editor mounts no second roll', async () => {
  const detail = await readFile(new URL('src/components/NativeWorldDetail.tsx', new URL('../', import.meta.url)), 'utf8')
  assert.doesNotMatch(detail, /<SceneSequenceEditor /)
  const design = await readFile(new URL('src/inhabitants/catalogue/clips/expressions.tsx', new URL('../', import.meta.url)), 'utf8')
  assert.match(design, /\{id: 'sequence', label: 'Sequence'/)
})
