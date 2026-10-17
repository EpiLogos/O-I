import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

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
const {journeyWalksOf} = await import('../src/timeline/journeyWalks.ts')

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

// The Journey as the shell draws it: Technē's tracks over the walks the World's sets carry — a walk stop is a row, n of N, walk
// after walk, each stop a clip of its walk's track (timeline/techneTrackAdapter.ts, drawn by the shared Session grid; asserted in
// techne-tracks.test.mjs). JourneyRows, the shell's own Journey rendering, and the World cut presentation that hosted it were
// drawn by nothing once the tracks pane became the centre (FOUNDATION F3), and were deleted on 15 Oct (§7).

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

// ── honest absence ───────────────────────────────────────────────────────────────────────────────────────────────

test('with no walk carried, the Journey presents none and invents no stop', () => {
  assert.deepEqual(journeyWalksOf([]), [])
  assert.deepEqual(journeyWalksOf([{columns: [], tracks: [], clips: []}]), [], 'a set with no walks presents none')
})

// ── leg 3 (T-TIMELINE-WALKS): a stop focuses its occasion, its atlas epoch, or names why it cannot ───────────────
// The walk stop's focus is the one rule the Journey and the Timeline share (journeyWalks.ts walkStopFocus,
// timeline/walkFocus.ts applyWalkStopFocus). The atlas epoch jump is the encounter bridge's write: the atlas's own
// hash (`#/aion/<reading>/epoch/<epoch>`); the shell reads nothing back.

const {walkStopFocus} = await import('../src/timeline/journeyWalks.ts')
const {applyWalkStopFocus} = await import('../src/timeline/walkFocus.ts')
const {publishAtlasAionReading, jumpAtlasToLayerStop, atlasAionReading} = await import('../src/projections/atlas/AtlasProjectionPanel.tsx')

const aionWalk = aionSet.walks.find((walk) => walk.id === `${READING_ID}:all`)
const aionStop = aionWalk.stops[0]

test('a walk stop focuses its occasion when its clip is one, its layer’s epoch when it belongs to a reading, else names why not', () => {
  const event = {stream: 'run', kind: 'run', subject_ref: 'session-1', instant_unix_ms: 1, summary: 'a run'}
  assert.deepEqual(walkStopFocus(aionWalk, aionStop, new Map([[aionStop.clipId, event]])), {kind: 'occasion', event},
    'an occasion the Timeline gives the clip wins')
  assert.deepEqual(walkStopFocus(aionWalk, aionStop, new Map()), {kind: 'layer', layerId: READING_ID, stopId: aionStop.id},
    'an atlas stop focuses its layer and its own event')
  const fieldWalk = fieldSet.walks[0]
  const absent = walkStopFocus(fieldWalk, fieldWalk.stops[0], new Map())
  assert.equal(absent.kind, 'absent')
  assert.match(absent.reason, /belongs to no reading/, 'a field stop names that it belongs to no reading')
})

test('the atlas epoch jump writes the atlas’s own hash for the stop’s epoch; with no reading held it is honestly absent', async () => {
  publishAtlasAionReading(null)
  assert.equal(atlasAionReading(), null)
  assert.equal(await jumpAtlasToLayerStop(READING_ID, aionStop.id), null, 'no reading held: no jump')
  const named = await applyWalkStopFocus({kind: 'layer', layerId: READING_ID, stopId: aionStop.id}, () => assert.fail('no occasion here'))
  assert.match(named, /Earth pane/, 'the absence names the Earth pane that loads the reading')

  publishAtlasAionReading({providerId: 'archetypal-earth', history: corpus.history})
  const event = reading.events.find((e) => e.id === aionStop.id)
  const jump = await jumpAtlasToLayerStop(READING_ID, aionStop.id)
  assert.equal(jump.kind, 'atlas-epoch')
  assert.equal(jump.providerId, 'archetypal-earth')
  assert.equal(jump.epochId, event.epochId, 'the stop’s own epoch')
  assert.equal(jump.hash, `#/aion/${READING_ID}/epoch/${event.epochId}`, 'the atlas’s linkable grammar, as aionEpochJump names it')
  assert.equal(await jumpAtlasToLayerStop(READING_ID, 'no-such-event'), null, 'an event the reading does not hold is not jumped to')
  assert.equal(await applyWalkStopFocus({kind: 'layer', layerId: READING_ID, stopId: aionStop.id}, () => {}), null, 'a held epoch stands the focus')
  let selected = null
  const event2 = {stream: 'run', kind: 'run', subject_ref: 's', instant_unix_ms: 2, summary: 'occasion'}
  assert.equal(await applyWalkStopFocus({kind: 'occasion', event: event2}, (e) => { selected = e }), null)
  assert.equal(selected, event2, 'an occasion is selected through the caller’s spine, not the atlas')
  publishAtlasAionReading(null)
})

test('the World reads the atlas Aion reading through the family door: the same set the adapter projects, declared by the atlas manifest', async () => {
  const {projectWorldTracks, isManifestDeclared} = await import('../src/timeline/registerWorldTrackAdapters.ts')
  const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
  loadAgentShellFamilies()
  assert.equal(isManifestDeclared('atlas-aion-timeline'), true, 'the atlas manifest declares the Aion projection')
  const viaDoor = await projectWorldTracks('atlas-aion-timeline', {history: corpus.history, providerId: 'fixture'})
  const direct = projectAionReading({history: corpus.history, providerId: 'fixture'})
  assert.deepEqual(viaDoor, direct, 'one derivation: the family door yields the adapter’s own set')
})

// ── leg 4 (T-TIMELINE-WALKS): Technē's Session is the Journey ─────────────────────────────────────────────────────
// The Journey's rows are Technē's tracks in the one Session grid (techne-tracks.test.mjs: a walk stop is a row, n of N; a row's
// stop launches only where the owners give a launch; with no shell door the Expression is named, not opened). The App hands the
// grid the shell's Expression door with the reading it publishes, only over the World cut.

test('App threads the Journey door to the Session · Arrangement pane only over the World cut', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  // The pane is the centre in every mode (FOUNDATION F2): the door rides the published pane reading when the mode's tracks are the World cut.
  assert.match(app, /journey: tracks === 'world' \? \{openExpression: workspace\.requestExpression\} : undefined/)
})
