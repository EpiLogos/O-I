// T-PLACES-ONTO-ATLAS: Places is the atlas, alone (owner, 14 Oct; FOUNDATION §4). The M4′ World / Places instrument opens the Earth
// pane and stands on the rack as one plate in the mockup's six sections (world-shell-mockup.html:1447-1461): Body, Landmass, Climate,
// Sky, Locations, Relations. Its controls are the plate's and the transport's — none is drawn in the pane. Rendered server-side over
// the suite's published standing, with production modules in memory (the loader of techne-devices.test.mjs). Also: Technē's transport
// over the atlas's one time button and the shared window's edges, and how the shared spatial focus turns the Earth.
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

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

globalThis.__CRADLE_WALK__ = false
const door = await import('../src/inhabitants/familyManifest.ts')
const world = await import('../src/inhabitants/worldShellFamilies.ts')
const adoptRows = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
const {InstrumentDeviceDetail} = await import('../src/shell/ModeDetail.tsx')
const chain = await import('../src/inhabitants/ql/devices/TechneDevices.tsx')
const {publishSuiteStanding, resetSuiteStanding, IDLE_STANDING} = await import('../src/projections/atlas/provider/suiteStanding.ts')
const {atlasTimeBindings} = await import('../src/projections/atlas/places/placesTransport.ts')
const host = await import('../src/projections/atlas/places/placesHost.ts')
const {readFile} = await import('node:fs/promises')

door.resetFamilyManifestsForTest()
world.loadWorldShellFamilies()
adoptRows.adoptVerifiedRows()

const transport = {kind: 'unavailable', reason: 'the test carrier is down'}
const html = element => renderToStaticMarkup(element)
const M4 = () => html(createElement(InstrumentDeviceDetail, {transport, instrument: 'techne:m4'}))

const PLACES = [
  {ref: 'wiki:place:tower', name: 'Tower Coast', kind: 'declared', owner: 'wiki', source: 'Central wiki', revision: 'r3', subject_ref: 'wiki:node:stone', relation: 'OCCURRED_AT',
    located: true, precision: 'exact', lat: 47.22, lon: 8.84, reason: null, evidence: 'wiki:source:letters'},
  {ref: 'wiki:place:folio', name: 'Folio Isles', kind: 'declared', owner: 'wiki', source: 'Central wiki', subject_ref: 'wiki:node:liber', relation: 'MYTH_LOCATED_AT',
    located: true, precision: 'approximate', lat: 47.3, lon: 8.6, reason: null},
  {ref: 'wiki:place:nowhere', name: 'Nowhere', kind: 'declared', owner: 'wiki', source: 'Central wiki', subject_ref: 'wiki:node:dream', relation: 'DREAMT_AT',
    located: false, precision: 'region', reason: 'the owner declares a polygon; the Earth draws points'},
]
const standing = {...IDLE_STANDING, phase: 'ready', readAt: '2026-10-15T10:00:00Z', places: PLACES,
  counts: {...IDLE_STANDING.counts, located: 2, places: 3, unlocatedPlaces: 1}}

test('M4′ World / Places opens the atlas, never the stage\'s retired Places lens', () => {
  assert.deepEqual(chain.instrumentDoorOf('techne:m4'), {kind: 'projection.earth'})
  assert.deepEqual(chain.instrumentDoorOf('techne:m0'), {kind: 'projection.earth'})
})

test('the focused M4′ stands as one plate in the mockup\'s six sections; the others fold; nothing it holds is dropped', () => {
  resetSuiteStanding()
  const out = M4()
  assert.match(out, /data-instrument="techne:m4"[^>]*data-places-plate="true"/, 'the Places plate stands open')
  const order = ['body', 'landmass', 'climate', 'sky', 'locations', 'relations'].map(id => out.indexOf(`data-section="${id}"`))
  assert.ok(order.every(at => at > 0), 'every section stands')
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in the mockup\'s order')
  assert.match(out, />World \/ Places</)
  assert.match(out, /M4′ · Technē · Earth · root anchor · open on the focused pane · scale —/, 'the head names the body and the scale (no atlas mounted: no scale)')
  for (const id of ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m5']) assert.match(out, new RegExp(`data-instrument="${id}" data-expanded="false"`), `${id} folds`)
  // each device M4′ holds stands in its section: one shown at a time, the others behind their marks (InstrumentPlate SectionDevices)
  const body = out.slice(out.indexOf('data-section="body"'), out.indexOf('data-section="landmass"'))
  assert.match(body, /data-device-shown="atlas-earth:globe-engine"/, 'the globe stands in Body')
  assert.match(body, /role="tab"[^>]*aria-label="Earth ⇄ Graph"/, 'the Earth ⇄ Graph switch stands behind its mark in Body')
  const sky = out.slice(out.indexOf('data-section="sky"'), out.indexOf('data-section="locations"'))
  assert.match(sky, /data-device-shown="quaternal-logic:sky"/, 'the QL sky stands in Sky')
  assert.match(out, /Earth is given — its land is not built\. Place and name locations on it; anchor your body’s locations to it\./, 'the mockup\'s own Earth words')
  assert.match(out, /aria-checked="true" class="sdk-seg__opt sdk-seg__opt--on"[^>]*>Earth</, 'the body is Earth, the one world nobody built')
  assert.match(out, /title="Your own body has no builder in this suite yet: the atlas draws Earth\."[^>]*>Central</, 'Central waits, and says why')
  assert.match(out, /No owner declares a place yet\./, 'no standing read: no place, said')
  assert.match(out, /Choose a subject on the Earth first/, 'Place waits for a subject')
  assert.match(out, /<span class="places-k">Lens<\/span><select class="places-select" disabled=""/, 'the atlas\'s lens chooser stands on the plate, waiting for the Earth')
})

test('Locations and Relations read the owners\' places: precision marks, the mythic named, absences said, the legend by relation', () => {
  publishSuiteStanding(standing)
  try {
    const out = M4()
    assert.match(out, /data-section="locations"[^>]*>.*2 on the Earth · 1 not/s, 'the section counts what the Earth draws and what it cannot')
    assert.match(out, /data-marker="solid"[^>]*><\/span><span class="n">Tower Coast/, 'an exact place is a solid mark')
    assert.match(out, /data-marker="halo"[^>]*><\/span><span class="n">Folio Isles<\/span><span class="places-tag" data-standing="mythic"/, 'approximate is a halo; the mythic is named')
    assert.match(out, /data-located="false"[^>]*title="Nowhere[^"]*the owner declares a polygon; the Earth draws points/, 'the owner\'s reason, verbatim')
    assert.match(out, /title="Tower Coast[^"]*wiki · Central wiki · revision r3 · evidence wiki:source:letters"/, 'provenance on every place (T13)')
    const relations = out.slice(out.indexOf('data-section="relations"'))
    assert.ok(relations.indexOf('OCCURRED_AT') < relations.indexOf('MYTH_LOCATED_AT') && relations.indexOf('MYTH_LOCATED_AT') < relations.indexOf('DREAMT_AT'), 'the legend order')
    assert.match(relations, /disabled=""[^>]*title="OCCURRED_AT: 1 place, 1 on the Earth/, 'no atlas mounted: a relation narrows nothing')
    assert.match(out, /historical \/ current geography[^]*3 places declared/, 'the frames, rung by rung')
    assert.match(out, /Nara \/ current situated body[^]*no owner discloses it here/)
  } finally {
    resetSuiteStanding()
  }
})

test('the plate draws nothing in the pane: the atlas host stands its own chrome down where the shell gives it a home', async () => {
  const css = await readFile(new URL('../src/projections/atlas/atlasHost.css', import.meta.url), 'utf8')
  assert.match(css, /\.atlas-host \.sh-head,\s*\.atlas-host \.shell-menu,\s*\.atlas-host \.sm-scrim,\s*\.atlas-host \.sh-chips,\s*\.atlas-host \.time,\s*\.atlas-host \.mode-switch,\s*\.atlas-host \.sh-corner\s*\{\s*display: none;/,
    'the lens chooser, its menu and chips, the time strip, the Earth ⇄ Graph pill and the corner stand down in the pane')
  const host = await readFile(new URL('../src/projections/atlas/AtlasProjectionPanel.tsx', import.meta.url), 'utf8')
  assert.match(host, /landing\.setLandingStore\(null\)/, 'the found app\'s onboarding never stands over the shell\'s world (unbound counts as seen)')
  assert.doesNotMatch(host, /flex-direction:column|function (sunLine|standingLine|statusColumn)\b/, 'no status column is drawn over the globe: its words are the globe\'s Info view hover')
  const plate = await readFile(new URL('../src/projections/atlas/places/PlacesPlate.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(plate, /createPortal|atlas-host|position:\s*fixed/, 'the plate renders on the rack, never into the pane')
  const placesHost = await readFile(new URL('../src/projections/atlas/places/placesHost.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(placesHost, /createElement\(|appendChild|\.append\(/, 'the host binding adds no element to the pane')
})

test('Technē\'s transport presses the atlas\'s one time button and reads the shared window\'s edges (T14–T16)', () => {
  const unmounted = atlasTimeBindings({mounted: false, walk: null, clockPlaying: false, press() {}, pause() {}}, null)
  assert.match(unmounted.play.refused, /The Earth is not open/)
  assert.equal(unmounted['punch-in'].readout.value, '—')
  assert.match(unmounted['punch-in'].readout.title, /no window stands/)
  let pressed = 0
  const clock = atlasTimeBindings({mounted: true, walk: null, clockPlaying: false, press: () => pressed++, pause() {}}, {from: '1900-01-01T00:00:00Z', to: '1961-06-06T00:00:00Z'})
  assert.equal(clock.play.lit, false)
  assert.match(clock.play.title, /no walk stands, so the Earth's clock plays through the window/)
  clock.play.press()
  assert.equal(pressed, 1)
  assert.match(clock.stop.refused, /Nothing plays/)
  assert.deepEqual([clock['punch-in'].readout.value, clock['punch-out'].readout.value], ['1900', '1961'], 'the window\'s two edges')
  const walking = atlasTimeBindings({mounted: true, walk: {playing: true}, clockPlaying: false, press() {}, pause() {}}, {from: null, to: '-000500-01-01T00:00:00Z'})
  assert.equal(walking.play.lit, true, 'a walk that plays holds the button')
  assert.match(walking.play.title, /pause the thread's walk/)
  assert.ok(walking.stop.press, 'a playing walk can be stopped')
  assert.deepEqual([walking['punch-in'].readout.value, walking['punch-out'].readout.value], ['open', '-500'])
})

test('the shared spatial focus turns the Earth: the subject where the Earth draws it there, else a flight at the atlas\'s framing (T24, lane-2 T21)', () => {
  const occ = [{id: 'o-stone', subject_ref: 'wiki:node:stone', lat: 47.22, lon: 8.84, geoPrecision: 'place'}, {id: 'o-liber', subject_ref: 'wiki:node:liber', lat: 50, lon: 9, geoPrecision: 'region'}]
  assert.deepEqual(host.turnToPlace(PLACES[0], occ), {kind: 'select', occId: 'o-stone'})
  assert.deepEqual(host.turnToPlace(PLACES[1], occ), {kind: 'fly', lat: 47.3, lon: 8.6, dist: 2.6}, 'not drawn at that point: a flight, framed for its precision')
  assert.equal(host.turnToPlace(PLACES[2], occ), null, 'an unlocated place turns nothing')
  assert.equal(host.turnToPlace(undefined, occ), null, 'a ref the world does not hold turns nothing, and is no error')
  assert.equal(host.framingDistance('exact'), 2.25)
})
