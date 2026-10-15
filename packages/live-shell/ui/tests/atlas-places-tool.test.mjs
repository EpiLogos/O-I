// T-PLACES-ONTO-ATLAS: the Place tool of the M4′ World / Places plate (projections/atlas/places/placeTool.ts) — lane-4 T17 click to
// create, T18 the owner's basis law, T19 refine with honest precision, re-homed from the frame's Places map onto the atlas. The atlas
// never writes a coordinate: it offers a draft to the subject's time-and-place editor (the owner call the frame's route reached,
// WikiFactsEditor.tsx offerConstellationRoute) and shows the owner's answer in its own words. The owner here is a recording stand-in.
import test, {beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) return r
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText};
}`)}`, import.meta.url)

const tool = await import('../src/projections/atlas/places/placeTool.ts')
const authoring = await import('../../../../desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring.ts')

let calls
const owner = () => ({
  offer: (ref, draft) => calls.push(['offer', ref, draft]),
  open: subject => calls.push(['open', subject.ref]),
  reread: ref => calls.push(['reread', ref]),
})
const SUBJECT = {ref: 'wiki:node:bollingen-stone', title: 'The stone carved'}

beforeEach(() => {
  calls = []
  tool.resetPlaceTool()
})

test('unbound, or with no subject chosen, the tool does not arm and says why', () => {
  tool.armPlaceTool(SUBJECT)
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: tool.NO_OWNER, tone: 'refused'})
  tool.bindPlaceOwner(owner())
  tool.armPlaceTool(null)
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: tool.NO_SUBJECT, tone: 'refused'})
  assert.deepEqual(calls, [])
})

test('a click offers an approximate draft, rounded, to the subject\'s editor — never a write (T17)', () => {
  tool.bindPlaceOwner(owner())
  tool.armPlaceTool(SUBJECT)
  assert.equal(tool.placeToolState().phase, 'armed')
  tool.placeAt({lat: 47.2123456789, lon: 8.8476543})
  assert.deepEqual(calls, [['offer', SUBJECT.ref, {lat: 47.21235, lon: 8.84765, precision: 'approximate'}]], 'the draft the frame map offered, through the same contract')
  const state = tool.placeToolState()
  assert.equal(state.phase, 'offered')
  assert.ok(authoring.validatePlaceDraft(state.draft).ok, 'the draft crosses the owner\'s own validation')
  assert.match(state.notice, /as an approximate point, opened as a draft\. Choose a source basis/, 'the frame\'s own route notice')
  assert.match(state.notice, /Edit time and place/)
  assert.equal(tool.draftLine(state.draft), 'approximate point at 47.21235, 8.84765')
})

test('off the globe nothing is drafted, and the tool says so', () => {
  tool.bindPlaceOwner(owner())
  tool.armPlaceTool(SUBJECT)
  tool.placeAt(null)
  assert.equal(tool.placeToolState().phase, 'idle')
  assert.match(tool.placeToolState().notice, /off the globe/)
  assert.deepEqual(calls, [])
})

test('a move keeps the place\'s own precision, cites its evidence, and is refused by name without one (T18, T19)', () => {
  tool.bindPlaceOwner(owner())
  const moving = {place_ref: 'wiki:place:tower', name: 'Tower', lat: 47.2, lon: 8.8, precision: 'region', evidence: 'wiki:source:letters'}
  tool.armPlaceTool({...SUBJECT, moving})
  tool.placeAt({lat: 47.25, lon: 8.85})
  assert.deepEqual(calls[0], ['offer', SUBJECT.ref, {lat: 47.25, lon: 8.85, precision: 'region', from: {lat: 47.2, lon: 8.8}, place_ref: 'wiki:place:tower'}])
  assert.match(tool.placeToolState().notice, /basis wiki:source:letters/)
  calls = []
  tool.armPlaceTool({...SUBJECT, moving: {...moving, evidence: undefined}})
  tool.placeAt({lat: 47.3, lon: 8.9})
  assert.deepEqual(calls, [], 'nothing is offered without a basis')
  assert.equal(tool.placeToolState().notice, 'This place discloses no source basis, so a move has nothing to cite. Edit place/time requires one.')
  tool.armPlaceTool({...SUBJECT, moving: {...moving, precision: 'exact'}})
  tool.placeAt({lat: 47.3, lon: 8.9})
  assert.match(tool.placeToolState().notice, /Exact positions do not drag/, 'an exact fix is never moved by a click')
})

test('the owner\'s answer: a refusal in its own words; a save reads the world again; another subject\'s answer is not ours', () => {
  tool.bindPlaceOwner(owner())
  tool.armPlaceTool(SUBJECT)
  tool.placeAt({lat: 1, lon: 2})
  tool.placeAnswered({target: {frame_ref: 'wiki:node:other'}, kind: 'saved'})
  assert.equal(tool.placeToolState().phase, 'offered', 'an answer for another subject leaves the offer standing')
  tool.placeAnswered({target: {frame_ref: SUBJECT.ref}, kind: 'refused', reason: 'Choose one unique disclosed source basis for this place.'})
  assert.deepEqual(tool.placeToolState(), {phase: 'idle', notice: 'Choose one unique disclosed source basis for this place.', tone: 'refused'})
  calls = []
  tool.armPlaceTool(SUBJECT)
  tool.placeAt({lat: 1, lon: 2})
  tool.openOfferedEditor()
  tool.placeAnswered({target: {frame_ref: SUBJECT.ref}, kind: 'saved'})
  assert.deepEqual(calls.slice(1), [['open', SUBJECT.ref], ['reread', SUBJECT.ref]])
  assert.equal(tool.placeToolState().tone, 'saved')
  assert.match(tool.placeToolState().notice, /^Saved in the constellation/)
  tool.notePlaceTool('The Earth draws it when it is next read.')
  assert.match(tool.placeToolState().notice, /^Saved in the constellation\..* The Earth draws it when it is next read\.$/)
})
