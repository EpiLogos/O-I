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

// ── leg 3 (T-TIMELINE-WALKS): a stop focuses its occasion, its atlas epoch, or names why it cannot ───────────────
// The walk stop's focus is the one rule the Journey and the Timeline share (journeyWalks.ts walkStopFocus,
// timeline/walkFocus.ts applyWalkStopFocus). The atlas epoch jump is the encounter bridge's write: the atlas's own
// hash (`#/aion/<reading>/epoch/<epoch>`); the shell reads nothing back.

const {walkStopFocus, walkStopOfClip} = await import('../src/timeline/journeyWalks.ts')
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
  const found = walkStopOfClip(sets, aionStop.clipId)
  assert.equal(found.walk, aionWalk, 'a walk clip finds its walk by reference')
  assert.equal(found.stop, aionStop)
  assert.equal(walkStopOfClip(sets, 'no-such-clip'), undefined)
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

// ── leg 4 (T-TIMELINE-WALKS): Technē's live Session is the Journey ───────────────────────────────────────────────
// The Journey's walk rows (JourneyRows, one source) sit above the session cells in the Timeline's own scroll container,
// only where the mode gives them (App threads `journey` for Technē's ground cut). With no walk carried the Session is
// today's plus one named-absence line; with walks, nothing the Session drew is removed.

const {WorldTimelinePresentation} = await import('../src/projections/worldTimelinePresentation.tsx')
const {TimelineProjectionResidence} = await import('../src/projections/timelineResidence.tsx')
const {JourneyRows} = await import('../src/timeline/JourneyRows.tsx')

const opened = []
const door = {openExpression: (ref) => opened.push(ref)}
const sessionOf = (trackSets, journey) => html(createElement(WorldTimelinePresentation, {view: worldOf(trackSets), presentation: 'session', journey}))
const JOURNEY_BLOCK_START = '<div class="wt-group" data-journey-rows='
const RAILS_BLOCK_START = '<div class="wt-group" data-world-walks='

// Lead ruling (lock §7.3): Technē's Session IS the Journey — its rows present the walks there, so the Timeline's
// "Walks · sections" rails group is not drawn twice in that Session; everything else is today's markup.
test('Technē’s live Session presents the walks as rows, above the session cells, in the same scroll container', () => {
  const out = sessionOf(sets, door)
  const start = out.indexOf(JOURNEY_BLOCK_START)
  assert.ok(start > 0, 'the Journey group is drawn')
  assert.equal(out.indexOf(RAILS_BLOCK_START), -1, 'the rails group is not drawn twice in Technē’s Session')
  const block = out.slice(start, out.indexOf('data-column='))
  const walks = journeyWalksOf(sets)
  assert.deepEqual([...block.matchAll(/data-walk="([^"]+)"/g)].map((match) => match[1]), walks.map((walk) => walk.id), 'one row per walk, in the sets’ order')
  assert.deepEqual([...block.matchAll(/data-stop="(\d+)" data-stop-ref="([^"]+)"/g)].map((match) => match[2]),
    walks.flatMap((walk) => walk.stops.map((stop) => stop.id)), 'the stop cells, walk by walk, in the walk’s order')
  assert.ok(out.indexOf('data-column=') > start, 'the session cells stand beneath the walk rows')
})

test('the Journey rows take the rails’ place in Technē’s Session and change nothing else', () => {
  const plain = sessionOf(sets)
  const withRows = sessionOf(sets, door)
  assert.ok(plain.includes(RAILS_BLOCK_START), 'without the Journey door the rails group stands as today')
  assert.equal(withRows.slice(0, withRows.indexOf(JOURNEY_BLOCK_START)), plain.slice(0, plain.indexOf(RAILS_BLOCK_START)), 'everything before is today’s')
  assert.equal(withRows.slice(withRows.indexOf('data-column=')), plain.slice(plain.indexOf('data-column=')), 'the session cells and everything after are today’s')
})

test('with no walk carried, Technē’s Session names the absence once', () => {
  const none = [{columns: [], tracks: [], clips: []}]
  const withJourney = sessionOf(none, door)
  assert.ok(/<div class="wt-absence" role="note" data-journey-absence="0">[^<]*<\/div>/.test(withJourney), 'the absence is named in the Session')
  assert.equal(withJourney.split('data-journey-absence').length - 1, 1, 'exactly one Journey absence line')
  assert.ok(!withJourney.includes(RAILS_BLOCK_START), 'the rails group’s own absence line is not repeated')
  assert.ok(!withJourney.includes('data-journey-rows'), 'no walk rows are drawn')
})

test('the Arrangement never takes the Journey, and JourneyRows draws nothing with no walk', () => {
  const arrangementPlain = html(createElement(WorldTimelinePresentation, {view: worldOf(sets), presentation: 'arrangement'}))
  const arrangementWithDoor = html(createElement(WorldTimelinePresentation, {view: worldOf(sets), presentation: 'arrangement', journey: door}))
  assert.equal(arrangementWithDoor, arrangementPlain, 'the Arrangement is unchanged')
  assert.equal(html(createElement(JourneyRows, {walks: [], eventByClipId: new Map(), selectOccasion() {}, journey: door})), '')
})

test('a stop that carries an Expression names it, and offers its launch only where the shell can open it', () => {
  const walk = journeyWalksOf(sets)[0]
  const carrying = {...walk, stops: walk.stops.map((stop, index) => index === 0 ? {...stop, sceneRef: 'expression:demo#scene:one'} : stop)}
  const set = {columns: [], tracks: [], clips: [], walks: [carrying]}
  const launchable = sessionOf([set], door)
  assert.ok(launchable.includes('journey-stop-expression'), 'the launch is offered where the door is given')
  assert.ok(launchable.includes('▷ Expression'))
  const named = html(createElement(JourneyRows, {walks: [carrying], eventByClipId: new Map(), selectOccasion() {}}))
  assert.ok(!named.includes('journey-stop-expression'), 'no launch without the door')
  assert.ok(named.includes('expression:demo#scene:one'), 'the Expression is still named')
  assert.deepEqual(opened, [], 'rendering opens nothing')
})

test('the residence hands the Journey to the World cut’s Session only: Technē’s Session shows it, Base and the Arrangement do not', () => {
  const residence = (journey, presented) => html(createElement(TimelineProjectionResidence, {set: null, document: null,
    selection: {track: 0, scene: null}, select() {}, colors: [], setColor() {}, session: undefined, arrangement: undefined,
    compactTransport: false, presented, world: worldOf(sets), journey}))
  assert.ok(residence(door, 'session').includes(JOURNEY_BLOCK_START), 'Technē’s live Session presents the rows')
  assert.ok(!residence(undefined, 'session').includes('data-journey-rows'), 'Base’s Session does not')
  // The Session stays mounted behind the Arrangement (hidden): the rows sit only inside that hidden Session presentation.
  const arrangement = residence(door, 'arrangement')
  const sessionTag = arrangement.match(/<div class="inhabitant composition-view"[^>]*data-projection-presentation="session"[^>]*>/)[0]
  assert.ok(sessionTag.includes('hidden=""'), 'the Session presentation is concealed while the Arrangement stands')
  assert.ok(!arrangement.slice(0, arrangement.indexOf(sessionTag)).includes('data-journey-rows'), 'the Arrangement presents no Journey')
})

test('App threads the Journey door to the Session · Arrangement pane only over the World cut, and the residence stays a fragment of direct children', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
  // The pane is the centre in every mode (FOUNDATION F2): the door rides the published pane reading when the mode's tracks are the World cut.
  assert.match(app, /journey: tracks === 'world' \? \{openExpression: workspace\.requestExpression\} : undefined/)
  const residence = await readFile(new URL('../src/projections/timelineResidence.tsx', import.meta.url), 'utf8')
  assert.match(residence, /<Fragment>/, 'the two presentation divs remain direct children of the centre body')
})
