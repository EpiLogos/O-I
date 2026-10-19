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
  assert.match(out, /<header class="dp-head dp-head--plate" data-i="World \/ Places\|M4′ · Technē · Earth · root anchor · open on the focused pane">/, 'the kit\'s head; who owns it is the status bar\'s words')
  // lane BT: the Earth's own well stands first (DEVICE-UI §7), and says which reading is missing — no atlas mounted, no likely planet
  assert.match(out, /data-section="display"[^>]*><div class="dp-display"[^>]*><svg[^>]*><text[^>]*>the Earth<\/text><text[^>]*>not mounted<\/text><\/svg><\/div>/, 'the well names the missing Earth')
  assert.ok(out.indexOf('data-section="display"') < out.indexOf('data-section="body"'), 'the well at the plate\'s left')
  assert.doesNotMatch(out, /inst-head-reading/, 'no reading in the head: the scale is the well\'s corner')
  for (const id of ['techne:m0', 'techne:m1', 'techne:m2', 'techne:m3', 'techne:m5']) assert.match(out, new RegExp(`data-instrument="${id}" data-expanded="false"`), `${id} folds`)
  // each device M4′ holds stands as its mark on the section that draws its controls: every setting in the pool, full size in a pane
  const body = out.slice(out.indexOf('data-section="body"'), out.indexOf('data-section="landmass"'))
  assert.match(body, /class="plate-held-mark" data-device="atlas-earth:globe-engine"/, 'the globe stands in Body')
  assert.match(body, /class="plate-held-mark" data-device="atlas-earth:mode-switch"/, 'the Earth ⇄ Graph switch stands in Body')
  const sky = out.slice(out.indexOf('data-section="sky"'), out.indexOf('data-section="locations"'))
  assert.match(sky, /class="plate-held-mark" data-device="quaternal-logic:sky"/, 'the QL sky stands in Sky')
  // the planet builder in the device craft (the mockup's knobs, :1385-1397): on Earth each waits with the mockup's own words, never a value
  for (const [section, dials] of [['landmass', ['Sea level', 'Continents', 'Relief']], ['climate', ['Warmth', 'Moisture', 'Ice caps']], ['sky', ['Atmosphere', 'Clouds', 'Axial tilt']]]) {
    const at = out.slice(out.indexOf(`data-section="${section}"`), out.indexOf('</section>', out.indexOf(`data-section="${section}"`)))
    for (const dial of dials) assert.match(at, new RegExp(`data-waiting="true" data-i="${dial}\\|[^"]+"><span class="dp-label">${dial}</span><svg class="dp-dial"`), `${dial} is a dial with no reading`)
    assert.doesNotMatch(at, /dp-dial-value|dp-dial-needle/, `${section}: no value drawn that no owner holds`)
  }
  assert.match(out, /Earth is given — its land is not built\. Place and name locations on it; anchor your body’s locations to it\./, 'the mockup\'s own Earth words')
  assert.match(out, /aria-label="Coast"[^>]*>(<button[^>]*aria-checked="false"[^>]*disabled=""[^>]*>[a-z]+<\/button>){3}/, 'Coast is a switch with nothing lit')
  assert.match(body, /role="radio" aria-checked="true"[^>]*>Earth</, 'the body is Earth, the one world nobody built')
  // [T-WORLDS §5 W3 phase B] the body store answers: your world is a choice of its own (its knobs read its owner's record), another
  // world's body is its owner's and waits, saying so
  assert.match(body, /role="radio" aria-checked="false"[^>]*>Your world</, 'your world stands to be chosen')
  assert.match(body, /data-i="Another world\|No other world’s body is read in this session[^"]*" disabled="">Another world</, 'another world waits, and says why')
  assert.doesNotMatch(out, /has no builder in this suite/, 'the stale words are gone')
  assert.match(out, /data-i="[^"]*\|No owner declares a place yet\."[^>]*><span class="dp-lamp" data-light="unknown"><\/span><span class="dp-label">none<\/span>/, 'no standing read: no place, a light and a word; the sentence is the status bar\'s')
  assert.match(out, /Choose a subject on the Earth first/, 'Place waits for a subject')
  assert.match(out, /<select class="dp-chooser" aria-label="Lens"[^>]*disabled=""/, 'the atlas\'s lens chooser stands on the plate, waiting for the Earth')
  assert.doesNotMatch(out, /overflow: ?(auto|scroll)|places-list/, 'no list scrolls inside the plate')
  // r19: your system's worlds stand in a section of their own after Locations (under the place list they stood below the band's fold)
  assert.ok(out.indexOf('data-section="worlds"') > out.indexOf('data-section="locations"'), 'Worlds stands after Locations')
  assert.match(out.slice(out.indexOf('data-section="worlds"')), /Your system is read while the Earth stands\./, 'with no system read, it says so')
})

test('Locations and Relations read the owners\' places: precision marks, the mythic named, absences said, the legend by relation', () => {
  publishSuiteStanding(standing)
  try {
    const out = M4()
    assert.match(out, /data-section="locations"[^>]*>.*2 placed · 1/s, 'the section counts what the Earth draws and what it cannot')
    // lane BT (DEVICE-UI §1 "A sentence never appears in a panel"): what the owners returned stands as a light and readouts
    const locations = out.slice(out.indexOf('data-section="locations"'), out.indexOf('data-section="relations"'))
    assert.match(locations, /class="plate-keys places-returned" data-places-standing="ready" data-owners="[a-z]+" data-i="What the owners returned\|[^"]+"/, 'the owners\' sentence is the status bar\'s')
    for (const label of ['subjects', 'placed', 'unplaced']) assert.match(locations, new RegExp(`<span class="dp-label">${label}</span>`), `${label}: a readout`)
    assert.match(locations, /data-owners="(read|partial)"[^>]*><span class="dp-lamp" data-light="lit"/, 'the owners\' answer as a light')
    assert.doesNotMatch(locations, /<p class="plate-line"|>[^<]*read from their owners/, 'no sentence drawn in Locations: the owners\' words are only an attribute the status bar reads')
    assert.match(out, /data-marker="solid"[^>]*><\/span><span class="dp-row-name">Tower Coast/, 'an exact place is a solid mark')
    assert.match(out, /data-marker="halo"[^>]*><\/span><span class="dp-row-name">Folio Isles<\/span><span class="places-tag" data-standing="mythic"/, 'approximate is a halo; the mythic is named')
    assert.match(out, /data-row="wiki:place:nowhere" data-dim="true" data-i="Nowhere\|[^"]*the owner declares a polygon; the Earth draws points/, 'the owner\'s reason, verbatim')
    assert.match(out, /data-i="Tower Coast\|[^"]*wiki · Central wiki · revision r3 · evidence wiki:source:letters"/, 'provenance on every place (T13)')
    const relations = out.slice(out.indexOf('data-section="relations"'))
    assert.ok(relations.indexOf('OCCURRED_AT') < relations.indexOf('MYTH_LOCATED_AT') && relations.indexOf('MYTH_LOCATED_AT') < relations.indexOf('DREAMT_AT'), 'the legend order')
    assert.match(relations, /data-i="OCCURRED_AT\|OCCURRED_AT: 1 place, 1 on the Earth[^"]*"><button type="button" class="plate-row-press" disabled=""/, 'no atlas mounted: a relation narrows nothing')
    assert.match(out, /historical \/ current geography: 3 places declared/, 'the frames, rung by rung')
    assert.match(out, /Nara \/ current situated body: no owner discloses it here/)
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

test('the atlas header stands down in the pane, and what it held stands on the plate under Lens (seen in the pane, 15 Oct)', async () => {
  const css = await readFile(new URL('../src/projections/atlas/atlasHost.css', import.meta.url), 'utf8')
  assert.match(css, /\.atlas-host \.shell,\s*\.atlas-host \.sh-head,/, 'the whole header goes: its line, its scope and the lens\'s Options "≡" with it')
  const shell = await readFile(new URL('../src/projections/atlas/src/shell/shell.ts', import.meta.url), 'utf8')
  assert.match(shell, /headerReading\(\): ShellHeaderReading/, 'the atlas\'s own header is read, never copied')
  assert.match(shell, /press: \(\) => row\.click\(\)/, 'a plate press is the header\'s own Options row pressed')
  const {LensReadings} = await import('../src/projections/atlas/places/PlacesPlate.tsx')
  const pressed = []
  const reading = {context: 'Theory', heading: '', scope: {text: '12 in the Red Book', toggle: {label: 'Show the whole field', press: () => pressed.push('whole')}},
    options: [{title: 'Open Theory', description: '', pressed: false, disabled: false, press: () => pressed.push('open')},
      {title: 'Jung\'s theory', description: 'The theory sheet', pressed: true, disabled: false, press: () => pressed.push('jung')},
      {title: 'Dynamics', description: '', pressed: null, disabled: true, press: () => pressed.push('dynamics')}]}
  const out = html(createElement(LensReadings, {handle: {ctl: {shell: {headerReading: () => reading}}}}))
  assert.match(out, /<p class="plate-line" role="status" data-i="Theory" title="Theory">Theory<\/p>/, 'the lens\'s line')
  assert.match(out, /title="12 in the Red Book">12 in the Red Book<button type="button">Show the whole field<\/button>/, 'the scope and its toggle')
  assert.match(out, /aria-pressed="false"[^>]*>Open Theory<\/button>/, 'a row the lens reads off stands dark')
  assert.match(out, /data-i="Jung(’|&#x27;)s theory\|The theory sheet"><button type="button" class="dp-toggle" data-tone="accent" aria-pressed="true">Jung(’|&#x27;)s theory<\/button>/, 'a pressed row is lit, its description its status words')
  assert.match(out, /class="dp-action" disabled="">Dynamics<\/button>/, 'a disabled row stays disabled')
  assert.equal(html(createElement(LensReadings, {handle: null})), '', 'no Earth mounted: nothing to stand')
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
