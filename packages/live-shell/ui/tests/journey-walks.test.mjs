import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

// T-TIMELINE-WALKS leg 2 — the Journey reads the walks the Timeline reads. Production sources in memory (the
// mode-surface-fidelity loader: .ts/.tsx transpiled, CSS stubbed); the walks come from the leg-1 projections over the
// fixture corpus, so the identity under test is the one the running shell would hold.
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

const {walkReaches} = await import('../src/timeline/worldTrackAdapter.ts')
const {projectAionReading} = await import('../src/projections/atlas/aionTimeline.ts')
const {projectFieldThread, projectRedbookWalk, projectDynamicsRoute} = await import('../src/projections/atlas/walkTimeline.ts')
const {fixtureCorpus} = await import('../src/projections/atlas/provider/fixtureCorpus.ts')
const {buildModel} = await import('../src/projections/atlas/src/data/model.ts')
const {journeyWalksOf, journeyStopCells, journeyStopFocus} = await import('../src/timeline/journeyWalks.ts')
const {ModeCentreFrame} = await import('../src/shell/ModeCentre.tsx')
const {createTimeSpine} = await import('../src/timeline/timeSpine.ts')

const html = (element) => renderToStaticMarkup(element)

const corpus = fixtureCorpus()
const reading = corpus.history.readings[0]
const READING_ID = reading.id
const thread = reading.threads[0]
const model = buildModel(corpus.field)

const aionSet = projectAionReading({history: corpus.history, providerId: 'fixture'})
const fieldSet = projectFieldThread(model, 'family', 'lighthouse')
const redbookSet = projectRedbookWalk(model, {
  generatedAt: 'x', licence: {plates: '', text: '', vaultPathNote: ''}, plates: {vaultRelativeDir: '', urlPrefix: '', served: 'dev-only', note: ''},
  mode: {title: 'Liber Novus', subtitle: '', subject: 'jung', oneLine: ''},
  sections: [{id: 'descent', name: 'Descent', oneLine: ''}],
  stops: [{id: 'eddystone-1698', sectionId: 'descent'}, {id: 'curated-not-in-field', sectionId: 'descent'}],
  genesis: [],
})
const dynamicsSet = projectDynamicsRoute({
  version: 1, title: 'The lens walk', line: '',
  movements: [{id: 'm1', n: 'I', title: 'First', line: '', stops: [
    {id: 's1', figure: 'f', line: '', concept: 'strange-attractor', familyIds: ['lighthouse']},
    {id: 's2', figure: 'f', line: '', name: 'Named stop', familyIds: []},
  ]}],
})
// The sets the World's Timeline would hold: an atlas set beside the field, Red Book and route sets.
const sets = [aionSet, fieldSet, redbookSet, dynamicsSet]

/** A World view the Journey reads: the status, the sets and the clip-to-occasion map the Timeline itself reads. */
function worldOf(trackSets, eventByClipId = new Map()) {
  return {
    source: {status: 'live', error: null, now: null, events: [], sets: trackSets, eventByClipId, admittedRuns: null,
      admittedRunsError: null, readAtUnixMs: null, readCadence: null},
    spine: createTimeSpine(),
    selectOccasion() {},
  }
}

const journey = (trackSets) => html(createElement(ModeCentreFrame, {mode: 'techne', presentation: 'session', world: worldOf(trackSets)}))

// ── one source: the same walk objects the Timeline's sets carry ─────────────────────────────────────────────────

test('the Journey presents the walks the World sets carry: the same objects, in set order', () => {
  const walks = journeyWalksOf(sets)
  const carried = sets.flatMap((set) => set.walks)
  assert.equal(walks.length, carried.length)
  walks.forEach((walk, index) => assert.equal(walk, carried[index], `walk ${index} is the set’s own object, not a copy`))
  assert.deepEqual(walks.map((walk) => walk.id), [`${READING_ID}:all`, `${READING_ID}:${thread.id}`, fieldSet.walks[0].id, 'redbook', 'dynamics-route'],
    'the sets’ own order: the atlas reading’s walks, then the field, the Red Book and the route')
})

test('walk ids are unique across the sets, and each Journey walk reaches what the contract says it reaches', () => {
  const walks = journeyWalksOf(sets)
  assert.equal(new Set(walks.map((walk) => walk.id)).size, walks.length, 'no walk is presented twice')
  for (const walk of walks) {
    const owner = sets.find((set) => set.walks.includes(walk))
    assert.ok(owner, `${walk.id} has its owning set`)
    const reached = walkReaches(owner, walk.id)
    for (const stop of walk.stops) {
      assert.ok(reached.has(stop.id), `${walk.id}: stop ${stop.id} reached`)
      if (stop.clipId !== undefined) assert.ok(reached.has(stop.clipId), `${walk.id}: clip ${stop.clipId} reached`)
    }
  }
})

test('the Journey renders the stops in the walk’s order, walk by walk, numbered n of N', () => {
  const out = journey(sets)
  const parts = out.split('data-walk="').slice(1)
  const walks = journeyWalksOf(sets)
  assert.equal(parts.length, walks.length, 'one Journey block per walk')
  parts.forEach((part, index) => {
    const walk = walks[index]
    assert.equal(part.slice(0, part.indexOf('"')), walk.id, `block ${index} is ${walk.id}`)
    const stops = [...part.matchAll(/data-stop="(\d+)" data-stop-ref="([^"]+)"/g)]
    const expected = walk.stops.map((stop) => stop.id)
    assert.deepEqual(stops.map((match) => match[2]), expected, `${walk.id}: the stops, in the walk's order`)
    assert.deepEqual(stops.map((match) => Number(match[1])), walk.stops.map((_, i) => i + 1), `${walk.id}: numbered 1..N`)
  })
})

test('a walk block names its kind, whether it is derived on read or curated, and its stop count', () => {
  const out = journey(sets)
  const whole = journeyWalksOf(sets).find((walk) => walk.id === `${READING_ID}:all`)
  assert.ok(out.includes(`data-walk-derived="derived"`), 'the derived walks are marked derived')
  assert.ok(out.includes(`data-walk-derived="curated"`), 'the curated walks are marked curated')
  assert.ok(out.includes(`${whole.stops.length} stops`), 'the whole-reading walk names its stop count')
  assert.ok(out.includes('aion-whole-reading'), 'the walk kind is named')
})

// ── stop cells: only what a stop carries ──────────────────────────────────────────────────────────────────────────

test('journeyStopCells reads place, occasion, artefact, Expression and the attached count from the stop alone', () => {
  assert.deepEqual(journeyStopCells({id: 'a', label: 'Founding', year: -44, place: {label: 'Rome'}, also: ['x', 'y'], sceneRef: 'scene-1'}), {
    place: 'Rome', occasion: '44 BCE', artefact: 'Founding', expression: 'scene-1', also: 2,
  })
  assert.deepEqual(journeyStopCells({id: 'b', label: 'Bare', also: []}), {place: null, occasion: null, artefact: 'Bare', expression: null, also: 0})
  assert.equal(journeyStopCells({id: 'c', label: 'Coords', place: {lat: 1.234, lon: -2}, also: []}).place, '1.23, -2.00',
    'a place with no label falls back to its coordinates')
})

// ── focus: the Timeline's own rule, or a named absence ───────────────────────────────────────────────────────────

test('a stop focuses the occasion the Timeline would focus for its clip; a stop that carries none names why', () => {
  const event = {stream: 'run', kind: 'run', subject_ref: 'session-1', instant_unix_ms: 1, summary: 'a run'}
  const byClip = new Map([['clip-a', event]])
  const focused = journeyStopFocus({id: 'a', label: 'A', clipId: 'clip-a', also: []}, byClip)
  assert.equal(focused.kind, 'occasion')
  assert.equal(focused.event, event, 'the same event object the Timeline selects through')
  const missing = journeyStopFocus({id: 'b', label: 'B', clipId: 'clip-missing', also: []}, byClip)
  assert.equal(missing.kind, 'absent')
  assert.match(missing.reason, /^B /, 'the reason names the stop')
  const bare = journeyStopFocus({id: 'c', label: 'C', also: []}, byClip)
  assert.equal(bare.kind, 'absent')
  assert.match(bare.reason, /no clip/)
  const atlas = aionSet.walks[0].stops[0]
  assert.equal(journeyStopFocus(atlas, new Map()).kind, 'absent', 'an atlas event is not a temporal occasion, so it is named absent')
})

// ── honest absence ───────────────────────────────────────────────────────────────────────────────────────────────

test('with no walk carried, the eight designed slots hold their places and the absence is named', () => {
  assert.deepEqual(journeyWalksOf([]), [])
  assert.deepEqual(journeyWalksOf([{columns: [], tracks: [], clips: []}]), [], 'a set with no walks presents none')
  const out = journey([{columns: [], tracks: [], clips: []}])
  assert.equal((out.match(/data-stop=/g) ?? []).length, 8, 'eight designed slots')
  assert.ok(out.includes('data-walks="0"'))
  assert.ok(out.includes('carries no walks in the World'), 'the absence is named, not left silent')
  assert.ok(!out.includes('data-walk='), 'no walk block is drawn')
})

test('the Journey no longer says it waits for the journey owner', async () => {
  const source = await readFile(new URL('../src/shell/ModeCentre.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /waits for the journey owner/)
})
