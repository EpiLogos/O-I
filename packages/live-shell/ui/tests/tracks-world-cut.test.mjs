import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// TICKET K: the shared Session grid and Arrangement ruler regain what the World cut presentation drew before F3 replaced it
// (git 09a573a1d:packages/live-shell/ui/src/projections/worldTimelinePresentation.tsx) and the Expressions Arrangement's window
// (…/components/nativeArrangementModel.ts, nativeArrangementTimeline.tsx): clip standing marks, sections nested and coloured by
// their atmosphere, the cron firings track, the occasion stood in with its admission light, walk rails, and the ruler's zoom,
// pan and snap.
// - SCRIPTED: the pure modules called directly; the views rendered to static markup (react-dom/server) and the stateless views
//   called directly so their handlers can be read off the element tree and run. There is no DOM: how it looks and whether a
//   wheel or a pinch lands are the lead's screen pass.
// - PORTED ASSERTIONS: the window math keeps native-arrangement-model.test.mjs:47-80 and :36-45 (snap, against the mark step);
//   the cron and occasion legs keep timeline-world-cut.browser.mjs:140-163 (a firing lands as a clip; "1 firing landed"; an
//   occasion switch keeps its basis), as pure assertions over a real spine.
// - REAL ADAPTERS where a leg crosses one: Technē's adapter over the atlas fixture corpus and the dynamics route, Central's over
//   the day lane, and the registration (modeTracks.ts) with a World reading published.
// Loader as tracks-views.test.mjs, with the directory index journey-walks.test.mjs resolves (the stop focus loads walkFocus.ts).
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const cssText = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
const marks = await import('../src/frame/tracks/trackMarks.ts')
const S = await import('../src/frame/tracks/trackSections.ts')
const W = await import('../src/frame/tracks/rulerWindow.ts')
const R = await import('../src/frame/tracks/trackRails.ts')
const cut = await import('../src/frame/tracks/worldCutTracks.ts')
const {SessionGridView} = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, ArrangementRulerView, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {MODE_TRACKS} = await import('../src/frame/tracks/modeTracks.ts')
const {createTimeSpine, readStanding} = await import('../src/timeline/timeSpine.ts')
const techne = await import('../src/timeline/techneTrackAdapter.ts')
const {projectAionReading} = await import('../src/projections/atlas/aionTimeline.ts')
const {projectDynamicsRoute} = await import('../src/projections/atlas/walkTimeline.ts')
const {fixtureCorpus} = await import('../src/projections/atlas/provider/fixtureCorpus.ts')
const {projectRunTracks, runClipEventIndex} = await import('../src/timeline/runTrackAdapter.ts')
const {projectDayTracks, dayClipEventIndex} = await import('../src/timeline/dayTrackAdapter.ts')

const SELECT = {select() {}}
const noop = () => {}
const clip = (id, trackId, columnId, label, extra = {}) => ({id, trackId, columnId, label, ...extra})
const grid = (set, over = {}) => renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...over}))
const gridTree = (set, over = {}) => SessionGridView({set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...over})
const FIT = {window: null, onWindow: noop, snap: 'grid', onSnap: noop, marker: null, onMarker: noop, width: 0}
const rulerProps = (set, view = {}, over = {}) => ({set, selection: SELECT, view: {...FIT, ...view}, receipt: null, onPress: noop, onDismiss: noop, ...over})
const ruler = (set, view, over) => renderToStaticMarkup(React.createElement(ArrangementRulerView, rulerProps(set, view, over)))
const rulerTree = (set, view, over) => ArrangementRulerView(rulerProps(set, view, over))
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}
const read = input => readStanding({standing: null, source_ref: null, evidence_refs: [], derivation_ref: null, ...input})
const t0 = Date.UTC(2026, 9, 14, 9, 30)

// ── 1 — standing marks ─────────────────────────────────────────────────────────────────────────

test('a clip\'s standing is the authority\'s class drawn in the cut\'s edge; the word is the owner\'s or the legend\'s; no reading, no mark', () => {
  const drawn = input => { const m = marks.clipStandingMark({standing: read(input)}); return [m.visual, m.cut, m.line, m.stroke, m.word] }
  assert.deepEqual(drawn({source_ref: 'src:1'}), ['sourced', 'fact', 'solid', 'var(--standing-fact)', 'sourced'])
  assert.deepEqual(drawn({standing: 'asserted'}), ['authored', 'claim', 'dashed', 'var(--standing-claim)', 'asserted'])
  assert.deepEqual(drawn({standing: 'inferred from the letters', source_ref: 'src:2'}), ['derived', 'inferred', 'dotted', 'var(--standing-inferred)', 'inferred from the letters'])
  assert.deepEqual(drawn({standing: 'disputed'}), ['disputed', 'disputed', 'dashed', 'var(--standing-disputed)', 'disputed'])
  assert.deepEqual(drawn({standing: 'legend'}), ['mythic', 'mythic', 'dotted', 'var(--standing-mythic)', 'legend'])
  assert.deepEqual(drawn({}), ['unavailable', 'ghost', 'dashed', 'var(--standing-ghost)', 'standing unknown'])
  // The old cut's helpers (worldTimelinePresentation.tsx:106-116), kept.
  const sourced = marks.clipStandingMark({standing: read({source_ref: 'src:1'})})
  const claim = marks.clipStandingMark({standing: read({standing: 'asserted'})})
  assert.equal(marks.clipStandingTag(sourced), '', 'a sourced clip with no stated word carries no tag')
  assert.equal(marks.clipStandingTag(claim), ' · asserted')
  assert.equal(marks.clipAccessibleName('Tower', claim), 'Tower — standing asserted')
  assert.deepEqual(marks.clipStandingAttributes(claim), {'data-standing': 'authored', 'data-standing-stated': 'asserted'})
  assert.equal(marks.clipStandingEdge(claim), '2px dashed var(--standing-claim)')
  assert.match(marks.clipStandingTitle(claim), /^ · standing asserted · standing "asserted" is disclosed with no source/)
  // No reading: nothing at all (the old cut drew an undisclosed mark; the shell draws no mark without a reading).
  assert.equal(marks.clipStandingMark({}), null)
  assert.deepEqual([marks.clipStandingTag(null), marks.clipStandingAttributes(null), marks.clipStandingEdge(null), marks.clipStandingTitle(null), marks.clipAccessibleName('Tower', null)], ['', {}, undefined, '', 'Tower'])
  // Every cut the table names has its stroke in the stylesheet, as a shell token.
  for (const {cut: name} of Object.values(marks.STANDING_CUT)) assert.match(cssText, new RegExp(`--standing-${name}:\\s*var\\(--`), `--standing-${name} names a shell token`)
})

test('the grid and the ruler draw the mark on a clip that has a standing and none on one that has not', () => {
  const claim = read({standing: 'asserted'})
  const set = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 't', name: 'T', kind: 'k'}, {id: 'u', name: 'U', kind: 'k'}],
    clips: [clip('a', 't', 'r1', 'Alpha', {standing: claim, at: {start: 0, end: 50}}), clip('b', 'u', 'r1', 'Beta', {at: {start: 50, end: 100}})], ruler: {unit: 'u'}}
  const session = grid(set)
  assert.match(session, /data-clip="a"[^>]*title="Alpha · State not disclosed · standing asserted · standing &quot;asserted&quot;[^"]*" data-standing="authored" data-standing-stated="asserted" style="border-left:2px dashed var\(--standing-claim\)"/)
  assert.match(session, /<span class="cs-label">Alpha · asserted<\/span>/, 'the stated word is tagged on the label')
  assert.match(session, /data-clip="b" data-clip-status="undisclosed" title="Beta · State not disclosed"><button/, 'no standing: no mark, no tag, no attribute')
  const arrangement = ruler(set)
  assert.match(arrangement, /data-clip="a"[^>]*style="left:0%;width:max\(6px, 50%\);border-left:2px dashed var\(--standing-claim\)"[^>]*data-standing="authored"[^>]*aria-label="Alpha — standing asserted"[^>]*>Alpha · asserted<\/button>/)
  assert.match(arrangement, /data-clip="b" data-clip-status="undisclosed" class="tl-clip" style="left:50%;width:max\(6px, 50%\)" title="Beta · 50 – 100">Beta<\/button>/, 'the plain clip is unchanged')
})

// ── 2 — sections ───────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {id: 'age', name: 'Age', span: {start: 0, end: 100}, layerId: 'L', atmosphere: '#aa5500'},
  {id: 'era', name: 'Era', span: {start: 10, end: 40}, layerId: 'L', parentId: 'age', atmosphere: '#3366cc'},
  {id: 'late', name: 'Late', span: {start: 40, end: 100}, layerId: 'L', parentId: 'age'},
  {id: 'other', name: 'Other', span: {start: 0, end: 100}},
]
const sectioned = () => ({
  columns: ['r1', 'r2', 'r3', 'r4', 'r5'].map((id, i) => ({id, name: String(i + 1)})),
  tracks: [{id: 't', name: 'Reading', kind: 'k', layerId: 'L'}, {id: 'u', name: 'Loose', kind: 'k'}],
  clips: [clip('c1', 't', 'r1', 'one', {at: {start: 5}}), clip('c2', 't', 'r2', 'two', {at: {start: 20}}), clip('c3', 't', 'r3', 'three', {at: {start: 30}}),
    clip('c4', 't', 'r4', 'four', {at: {start: 50}}), clip('c5', 'u', 'r5', 'five', {at: {start: 100}})],
  layers: [{id: 'L', name: 'Reading one'}],
  sections: SECTIONS,
  ruler: {unit: 'years', label: at => `y${at}`},
})

test('sections nest by their parents, in the old order, one lane per layer named by its layer (worldTimelinePresentation.tsx:398-420)', () => {
  const byId = new Map(SECTIONS.map(s => [s.id, s]))
  assert.deepEqual(SECTIONS.map(s => S.sectionDepth(s, byId)), [0, 1, 1, 0])
  const loop = [{id: 'a', name: 'a', span: {start: 0, end: 1}, parentId: 'b'}, {id: 'b', name: 'b', span: {start: 0, end: 1}, parentId: 'a'}]
  assert.equal(S.sectionDepth(loop[0], new Map(loop.map(s => [s.id, s]))), 1, 'a cycle in the parent links is walked once')
  assert.deepEqual(S.orderedSections(SECTIONS).map(item => item.section.id), ['age', 'other', 'era', 'late'], 'by start, the wider first, the shallower first')
  const lanes = S.sectionLanes(sectioned())
  assert.deepEqual(lanes.map(lane => [lane.layerId, lane.name, lane.items.map(item => item.section.id), lane.levels]), [['L', 'Reading one', ['age', 'era', 'late'], 2], [undefined, 'Sections', ['other'], 1]])
  assert.deepEqual(S.sectionLanes({}), [])
  // A point stands in the sections of its layer that hold it, outermost first; spans are half-open.
  const chain = (at, layer) => S.sectionChain(SECTIONS, at, layer).map(s => s.id)
  assert.deepEqual([chain(20, 'L'), chain(40, 'L'), chain(100, 'L'), chain(20, undefined), chain(20, 'M')], [['age', 'era'], ['age', 'late'], [], ['other'], []])
  assert.equal(S.narrowestSectionOf(sectioned(), {at: {start: 20}}, {layerId: 'L'}).id, 'era', 'the narrowest colours what is inside it')
  assert.equal(S.narrowestSectionOf(sectioned(), {}, {layerId: 'L'}), undefined, 'no place, no section')
})

test('the Session nests its rows under the sections they stand in; a folded section hides its rows and keeps its head', () => {
  const layout = S.sessionRowLayout(sectioned())
  const shape = items => items.map(item => item.kind === 'head' ? `${'>'.repeat(item.depth + 1)}${item.section.id}:${item.rows}` : item.column.id)
  assert.deepEqual(shape(layout), ['>age:4', 'r1', '>>era:2', 'r2', 'r3', '>>late:1', 'r4', 'r5'])
  assert.deepEqual(layout.filter(item => item.kind === 'row').map(item => item.chain.map(s => s.id).join('/')), ['age', 'age/era', 'age/era', 'age/late', ''])
  assert.deepEqual(shape(S.shownRowLayout(layout, {[S.sectionFoldKey('era')]: true})), ['>age:4', 'r1', '>>era:2', '>>late:1', 'r4', 'r5'])
  assert.deepEqual(shape(S.shownRowLayout(layout, {[S.sectionFoldKey('age')]: true})), ['>age:4', 'r5'])
  // A row that leaves a section and comes back gets a second head; the rows keep the set's order.
  const back = {...sectioned(), clips: [clip('c1', 't', 'r1', 'one', {at: {start: 20}}), clip('c2', 't', 'r2', 'two', {at: {start: 50}}), clip('c3', 't', 'r3', 'three', {at: {start: 30}})]}
  assert.deepEqual(shape(S.sessionRowLayout(back)), ['>age:3', '>>era:1', 'r1', '>>late:1', 'r2', '>>era:1', 'r3', 'r4', 'r5'])
  // No sections: the rows as they come, nothing added.
  const plain = {...sectioned(), sections: undefined}
  assert.deepEqual(shape(S.sessionRowLayout(plain)), ['r1', 'r2', 'r3', 'r4', 'r5'])
})

test('the grid draws each head across every track in its atmosphere, its name and fold in the stops, a rail per section on its rows', () => {
  const set = sectioned()
  const markup = grid(set)
  assert.equal((markup.match(/class="cs sect-band"/g) ?? []).length, 3 * 2, 'a band per head in every track')
  assert.match(markup, /class="cs sect-band" role="presentation" aria-hidden="true" data-section-head="era" style="--atm:#3366cc"/)
  assert.match(markup, /class="cs sect-band" role="presentation" aria-hidden="true" data-section-head="late"><\/div>/, 'no atmosphere disclosed: no colour of its own')
  assert.match(markup, /data-section-head="era" style="--atm:#3366cc"><span class="cs-label">Era<\/span><\/div>/, 'the first track\'s band names the section, so the head reads from the left')
  assert.equal((markup.match(/data-section-head="era"[^>]*><span class="cs-label">/g) ?? []).length, 1, 'only the first track\'s band carries the name')
  assert.match(markup, /class="cs sect-head" role="gridcell" data-section="era" data-depth="1" style="--rails:2;--atm:#3366cc" title="Era · 2 stops stand in it · y10 – y40">/)
  const rails = id => [...(new RegExp(`data-section-rails="\\d"><span class="rails" aria-hidden="true">((?:<i style="[^"]*"></i>)+)</span><button type="button" class="stop-launch"[^>]*>▸</button><span class="cs-label">${id}<`).exec(markup)?.[1] ?? '').matchAll(/background:([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(rails('2'), ['#aa5500', '#3366cc'], 'a row under Era: the Age rail, then the Era rail')
  assert.deepEqual(rails('4'), ['#aa5500', 'var(--line-strong)'], 'a section with no atmosphere draws its rail in the strong line')
  // The row carries its id for the object menu (manual §10.9; frame/menu/TracksMenu.tsx), and is otherwise as it was.
  assert.match(markup, /<div class="cs" role="gridcell" data-row="[^"]+"><button type="button" class="stop-launch" disabled="" title="No row launch: the owner discloses none">▸<\/button><span class="cs-label">5<\/span>/, 'a row in no section is as it was')
  const folds = []
  find(gridTree(set, {onFold: id => folds.push(id)}), n => n.props['aria-label'] === 'Fold Era')[0].props.onClick()
  assert.deepEqual(folds, ['section:era'], 'a section folds through the grid\'s own fold record, under its own keys')
  const folded = grid(set, {folded: {'section:era': true}})
  assert.match(folded, /aria-label="Unfold Era"/)
  assert.doesNotMatch(folded, /data-clip="c2"|data-clip="c3"/, 'its rows are folded away')
  assert.match(folded, /data-clip="c4"/)
})

test('the ruler draws a lane of nested sections per layer in their atmosphere; a clip inside one carries the narrowest one\'s', () => {
  const markup = ruler(sectioned())
  assert.match(markup, /class="tl-lane tl-sections" data-section-layer="L" style="--levels:2"><span class="tl-head tl-sections-head" title="Reading one · sections · nested"><span class="tl-lane-name">Reading one<\/span><small>sections<\/small><\/span>/)
  assert.match(markup, /class="tl-sect" data-section="era" data-depth="1" style="left:10%;width:30%;--depth:1;--atm:#3366cc" title="Era · y10 – y40 · press to fit the window to it">Era<\/button>/)
  assert.match(markup, /class="tl-sect" data-section="late" data-depth="1" style="left:40%;width:60%;--depth:1"/)
  assert.match(markup, /class="tl-lane tl-sections" style="--levels:1"><span class="tl-head tl-sections-head" title="Sections · sections · nested">/, 'sections of no layer share a lane')
  assert.match(markup, /data-clip="c2"[^>]*style="left:20%;width:max\(6px, 0%\);--atm:#3366cc"[^>]*title="two · y20 · in Era"[^>]*data-section="era"/)
  assert.match(markup, /data-clip="c4"[^>]*title="four · y50 · in Late"[^>]*data-section="late"/)
  assert.match(cssText, /\.tl-clip\[data-section\]::before\s*\{[^}]*var\(--atm, transparent\)/, 'a clip in a section with no atmosphere takes no colour')
  // Pressing a section fits the window to it: the pane's view, nothing written.
  const windows = []
  find(rulerTree(sectioned(), {onWindow: next => windows.push(next)}), n => n.props['data-section'] === 'era' && n.props.className === 'tl-sect')[0].props.onClick()
  assert.deepEqual(windows, [{start: 10, end: 40}])
  // Zoomed past a section's start, it is drawn from the window's edge with its name in view and no edge of its own there.
  assert.match(ruler(sectioned(), {window: {start: 20, end: 70}}), /class="tl-sect" data-section="era" data-depth="1" data-before="true" style="left:0%;width:40%;--depth:1;--atm:#3366cc"/)
})

test('Technē carries the epochs onto the ruler as years and the dynamics route\'s movements over its stops, never as years', () => {
  const corpus = fixtureCorpus()
  const aion = projectAionReading({history: corpus.history, providerId: 'fixture'})
  const route = projectDynamicsRoute({version: 1, title: 'The lens walk', line: '', movements: [
    {id: 'm1', n: 'I', title: 'First', line: '', stops: [{id: 's1', figure: 'f', line: '', concept: 'strange-attractor', familyIds: []}, {id: 's2', figure: 'f', line: '', name: 'Named', familyIds: []}]},
    {id: 'm2', n: 'II', title: 'Second', line: '', stops: [{id: 's3', figure: 'f', line: '', name: 'Third', familyIds: []}]},
  ]})
  const project = sets => techne.projectTechneTracks({world: {state: 'live', sets, eventByClipId: new Map(), todayYear: 2026}})
  const alone = project([route])
  assert.equal(alone.ruler.unit, 'no-time slots', 'the movements are not years: no deep-time segment is made up for them')
  assert.deepEqual(alone.sections.map(s => [s.id, s.span.start, s.span.end]), [['m1', 0, 20], ['m2', 20, 30]], 'each movement spans its stops\' slots')
  assert.ok(alone.sections.every(s => alone.ruler.label(s.span.start).startsWith('no time')))
  const both = project([aion, route])
  const epochs = both.sections.filter(s => s.layerId !== undefined)
  assert.equal(epochs.length, aion.sections.length, 'the epochs ride along')
  for (const epoch of epochs) assert.equal(both.ruler.label(epoch.span.start), String(aion.sections.find(s => s.id === epoch.id).span.start), `${epoch.id} starts at its year`)
  assert.ok(both.sections.filter(s => s.layerId === undefined).every(s => both.ruler.label(s.span.start).startsWith('no time')), 'the movements stay in the no-time slots')
  // The grid nests the route's stop rows under their movements, through the one layout.
  const layout = S.sessionRowLayout(both).filter(item => item.kind === 'head' && (item.section.id === 'm1' || item.section.id === 'm2'))
  assert.deepEqual(layout.map(item => [item.section.id, item.rows]), [['m1', 2], ['m2', 1]])
  // Every atmosphere an epoch discloses is the one its band draws.
  const markup = ruler(both)
  for (const epoch of epochs.filter(s => s.atmosphere)) assert.match(markup, new RegExp(`data-section="${epoch.id}"[^>]*--atm:${epoch.atmosphere}`))
})

// ── 3 — the cron firings ───────────────────────────────────────────────────────────────────────

const cadence = {id: 'central-temporal-read', everyMs: 90_000, label: 'civil-field read', declaredBy: 'test'}
const firedSpine = (times = [t0]) => {
  const spine = createTimeSpine()
  spine.declareCadence(cadence)
  spine.armCadence(cadence.id, true)
  for (const atUnixMs of times) spine.fireCadence(cadence.id, {atUnixMs, label: 'civil-field read', disclosure: 'the Timeline projection read the civil field'})
  return spine
}

test('every real firing of the spine lands as a clip on the cron track, its cadence and count in the track\'s words (worldTimelinePresentation.tsx:137-141, :486-489)', () => {
  const spine = firedSpine()
  const cron = cut.cronSet(spine, cadence)
  assert.deepEqual(cron.columns, [{id: 'cron', name: 'firings'}])
  assert.deepEqual(cron.tracks.map(t => [t.id, t.name, t.readOnly]), [['cron', 'cron · firings', true]])
  // timeline-world-cut.browser.mjs:142-144: the read cadence firing landed as a cron clip; the chip says "1 firing landed".
  assert.equal(cron.clips.length, 1)
  assert.match(cron.tracks[0].kind, /1 firing landed/)
  assert.equal(cron.tracks[0].kind, 'cron · civil-field read · every 90s · 1 firing landed')
  assert.equal(cron.clips[0].standing.visual, 'sourced', 'a firing is the spine\'s own execution record')
  assert.equal(cron.clips[0].at, undefined, 'a ruler that places no instant leaves the firing to the Session')
  assert.equal(cut.cronKindText(null, 2), 'cron · no cadence · 2 firings landed')
  // A ruler that places civil instants stands each firing where it happened.
  const twice = firedSpine([t0, t0 + 90_000])
  const placed = cut.cronSet(twice, cadence, {unit: 'minutes', instant: ms => (ms - t0) / 60_000 + 10})
  assert.deepEqual(placed.clips.map(c => c.at), [{start: 10}, {start: 11.5}])
  assert.equal(cut.cronSet(twice, cadence, {unit: 'minutes', instant: () => undefined}).clips[0].at, undefined, 'a day the ruler does not cover: no place')
  assert.equal(cut.cronSet(createTimeSpine(), cadence).clips.length, 0, 'nothing fired, nothing drawn: no synthetic history')
})

test('the cron track stands after the mode\'s own tracks and takes none of the mode\'s actions', () => {
  const calls = []
  const op = name => ({op: `owner:${name}`, run: id => calls.push([name, id])})
  const owned = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 't', name: 'T', kind: 'k'}], clips: [clip('c', 't', 'r1', 'C')],
    actions: {launch: op('launch'), stopTrack: op('stop'), retry: op('retry'), launchStop: op('row')}}
  const merged = cut.withCron(owned, cut.cronSet(firedSpine(), cadence))
  assert.deepEqual(merged.tracks.map(t => t.id), ['t', 'cron'])
  assert.deepEqual(merged.columns.map(c => c.id), ['r1', 'cron'])
  assert.equal(cut.withCron(merged, cut.cronSet(firedSpine(), cadence)), merged, 'a set already holding the cron track keeps its own')
  const markup = grid(merged)
  assert.match(markup, /aria-label="Launch C"(?! disabled)/, 'the mode\'s own clip launches')
  assert.match(markup, /aria-label="Launch civil-field read · central-temporal-read" disabled="" title="No launch: this track is read, not launched"/)
  assert.match(markup, /aria-label="Stop cron · firings" disabled="" title="No stop: this track is read, not stopped"/)
  assert.doesNotMatch(markup, /Retry cron/, 'no retry on the spine\'s record')
  assert.match(markup, /aria-label="Retry T"/)
  assert.match(markup, /class="stop-launch" disabled="" title="No row launch: every clip in this row is read, not launched">▸<\/button><span class="cs-label">firings</)
  assert.match(markup, /class="stop-launch" title="Launch the row: every clip in it \(owner:row\)">▸<\/button><span class="cs-label">1</)
  assert.deepEqual(calls, [], 'drawing calls no owner')
})

// The World reading the shell publishes, over a real spine and Central's day lane.
const dayEvent = (subject, instant, summary) => ({stream: 'central-now', kind: 'event', subject_ref: subject, instant_unix_ms: instant, summary,
  day_ref: `central:day:control:root:${new Date(instant).toISOString().slice(0, 10)}`, stream_position: `${subject}@${instant}`, evidence_refs: [`fixture:${subject}`]})
const worldView = (spine, events = []) => {
  const daySet = projectDayTracks(events)
  return {
    source: {status: 'live', error: null, now: {instantUnixMs: t0, dayRef: null, source: 'fixture'}, events, absences: [], sets: [daySet],
      eventByClipId: new Map(dayClipEventIndex(events)), admittedRuns: null, admittedRunsError: null, readAtUnixMs: t0, readCadence: cadence},
    spine,
    selectOccasion: event => spine.selectOccasion(event, t0),
  }
}
const registered = (mode, reading) => {
  const out = {}
  const Probe = () => { out.value = MODE_TRACKS[mode](reading); return null }
  renderToStaticMarkup(React.createElement(Probe))
  return out.value
}

test('the World cut modes take the cron track through their registration; with no World reading published nothing is added', () => {
  const spine = firedSpine()
  const view = worldView(spine)
  const central = registered('base', {set: null, document: null, world: view})
  // T-WORLDS W2: your world stands always, then the Day as the Main track; the cron track still joins after it.
  assert.deepEqual(central.tracks.map(t => t.id), ['central:world:central:wiki:root', 'central:day', 'cron'])
  assert.equal(central.tracks.at(-1).kind, 'cron · civil-field read · every 90s · 1 firing landed')
  const technē = registered('techne', {set: null, document: null, world: view})
  assert.equal(technē.tracks.length, 7)
  assert.equal(technē.tracks.at(-1).id, 'cron')
  assert.match(registered('factory', {set: null, document: null, world: view}).waiting, /agent sessions/, 'a mode still waiting on its owner stays waiting')
  assert.deepEqual(registered('base', {set: null, document: null}).tracks.map(t => t.id).includes('cron'), false, 'no World reading: the mode\'s set as it was')
  assert.equal(registered('live', {set: null, document: null, world: view}), null, 'Live\'s tracks are not the World cut')
})

// ── 4 — the occasion stood in ──────────────────────────────────────────────────────────────────

test('the occasion stood in stands where its clip stands, its basis as first read, its admission a separate light', () => {
  const spine = createTimeSpine()
  const A = dayEvent('central:now:a', t0, 'first summary'), B = dayEvent('central:now:b', t0 + 3_600_000, 'second')
  const set = {columns: [{id: 'r', name: 'r'}], tracks: [{id: 't', name: 'T', kind: 'k'}, {id: 'u', name: 'U', kind: 'k'}],
    clips: [clip('clipA', 't', 'r', 'a', {at: {start: 30}}), clip('clipB', 'u', 'r', 'b', {at: {start: 100}})], ruler: {unit: 'u'}}
  const byClip = new Map([['clipA', A], ['clipB', B]])
  assert.equal(cut.occasionOn(set, spine.occasion(), byClip), undefined, 'none stood in: no mark')
  spine.selectOccasion(A, t0)
  assert.deepEqual(cut.occasionOn(set, spine.occasion(), byClip), {ref: 'central:now:a', label: 'first summary', year: 2026, clipId: 'clipA', at: 30, admission: null})
  // timeline-world-cut.browser.mjs:153-163: switching occasions and back keeps the first basis.
  spine.selectOccasion(B, t0 + 1)
  assert.equal(cut.occasionOn(set, spine.occasion(), byClip).label, 'second')
  spine.selectOccasion({...A, summary: 'rewritten by a later read'}, t0 + 2)
  assert.equal(cut.occasionOn(set, spine.occasion(), byClip).label, 'first summary', 'reopening keeps the snapshot basis')
  assert.deepEqual(cut.occasionLight({admission: null}), {state: 'unqualified', title: 'Current admission not yet qualified against a fresh reading'})
  spine.qualifyOccasions([A], t0 + 3, 'qualified against this refresh')
  const admitted = cut.occasionOn(set, spine.occasion(), byClip)
  assert.deepEqual(admitted.admission, {admitted: true, disclosure: 'qualified against this refresh'})
  assert.deepEqual(cut.occasionLight(admitted), {state: 'admitted', title: 'Current admission: admitted — qualified against this refresh'})
  spine.qualifyOccasions([B], t0 + 4, 'qualified again')
  assert.equal(cut.occasionLight(cut.occasionOn(set, spine.occasion(), byClip)).state, 'refused')
  const elsewhere = cut.occasionOn({clips: []}, spine.occasion(), byClip)
  assert.deepEqual([elsewhere.clipId, elsewhere.at], [undefined, undefined], 'no clip here stands it: no place')
})

test('the ruler marks the occasion with a line through the lanes and a readout whose light is lit only by a reported admission', () => {
  const base = {columns: [{id: 'r', name: 'r'}], tracks: [{id: 't', name: 'T', kind: 'k'}, {id: 'u', name: 'U', kind: 'k'}],
    clips: [clip('clipA', 't', 'r', 'a', {at: {start: 30}}), clip('clipB', 'u', 'r', 'b', {at: {start: 100}})], ruler: {unit: 'u'}}
  const occasion = {ref: 'central:now:a', label: 'first summary', year: 2026, clipId: 'clipA', at: 30, admission: {admitted: true, disclosure: 'fresh'}}
  const markup = ruler({...base, occasion})
  assert.equal((markup.match(/class="tl-occ" style="left:30%"/g) ?? []).length, 2, 'a line through every lane')
  assert.match(markup, /class="tl-occ-mark" data-occasion="central:now:a" style="left:30%" title="Occasion · first summary · 2026 · Current admission: admitted — fresh">occasion · first summary<i class="tl-light" data-admission="admitted"/)
  assert.match(ruler({...base, occasion: {...occasion, admission: null}}), /data-admission="unqualified"/)
  assert.match(ruler({...base, occasion: {...occasion, admission: {admitted: false, disclosure: 'gone'}}}), /data-admission="refused"/)
  const off = ruler({...base, occasion: {...occasion, at: undefined, clipId: undefined}})
  assert.match(off, /class="tl-occ-mark off" data-occasion="central:now:a" title="Occasion · first summary · 2026 · no clip of this work stands it on the ruler/)
  assert.doesNotMatch(off, /class="tl-occ"/)
  assert.doesNotMatch(ruler(base), /tl-occ/, 'none stood in: nothing drawn')
  // At the ruler's last point (the newest clip), the line is held inside the edge and the readout reads back from it.
  const last = ruler({...base, occasion: {...occasion, clipId: 'clipB', at: 100}})
  assert.match(last, /class="tl-occ" style="left:calc\(100% - 2px\)"/)
  assert.match(last, /class="tl-occ-mark back" data-occasion="central:now:a" style="right:calc\(100% - 100%\)"/)
  assert.match(last, /data-clip="clipB"[^>]*style="right:calc\(100% - 100%\);width:max\(6px, 0%\)"/, 'a point at the end reaches back from it instead of past the edge')
  for (const rule of ['admitted"\\]\\s*\\{[^}]*var\\(--green\\)', 'refused"\\]\\s*\\{[^}]*var\\(--rec\\)', 'unqualified"\\]\\s*\\{[^}]*transparent']) assert.match(cssText, new RegExp(`\\.tl-light\\[data-admission="${rule}`))
})

test('the registration reads the occasion off the spine for the mode\'s set', () => {
  const spine = firedSpine()
  const entry = dayEvent('central:now:entry', t0 - 3_600_000, 'an entry')
  const view = worldView(spine, [entry])
  spine.selectOccasion(entry, t0)
  const central = registered('base', {set: null, document: null, world: view})
  assert.equal(central.occasion.ref, 'central:now:entry')
  assert.equal(central.occasion.clipId, [...dayClipEventIndex([entry]).keys()][0], 'it stands on the Day track\'s entry')
  assert.equal(typeof central.occasion.at, 'number')
  spine.returnToNow()
  assert.equal(registered('base', {set: null, document: null, world: view}).occasion, undefined, 'Back to Now: no occasion stood in')
})

// ── 5 — walk rails ─────────────────────────────────────────────────────────────────────────────

const walked = (extra = {}) => ({
  columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}, {id: 'r3', name: '3'}],
  tracks: [{id: 'w', name: 'Walk lane', kind: 'k', color: '#123456'}, {id: 'x', name: 'Other', kind: 'k'}],
  clips: [clip('s1', 'w', 'r1', 'One', {at: {start: 80}}), clip('s2', 'w', 'r2', 'Two', {at: {start: 20}}), clip('s3', 'w', 'r3', 'Three', {at: {start: 100}})],
  walks: [
    {id: 'walk', name: 'A walk', kind: 'redbook', derived: false, stops: [
      {id: 'p1', label: 'One', clipId: 's1', year: 1913, place: {label: 'Küsnacht'}, also: ['o1', 'o2']},
      {id: 'p2', label: 'Two', clipId: 's2', also: []},
      {id: 'p3', label: 'Gone', clipId: 'missing', also: []},
      {id: 'p4', label: 'Three', clipId: 's3', also: []}]},
    {id: 'nowhere', name: 'Nowhere', kind: 'field-thread', derived: true, stops: [{id: 'q', label: 'Q', also: []}]},
  ],
  ruler: {unit: 'u'},
  ...extra,
})

test('a walk is a rail through its stops in walk order, under the lane that holds them; a stop with no place is counted (worldTimelinePresentation.tsx:433-447)', () => {
  const set = walked()
  const rails = R.walkRails(set, placeClips(set).placed)
  assert.deepEqual(rails.map(r => [r.walk.id, r.trackId, r.placed, r.stops.map(s => s.at)]), [['walk', 'w', 3, [80, 20, undefined, 100]], ['nowhere', undefined, 0, [undefined]]])
  assert.deepEqual(R.railSegments(rails[0]), [{from: 20, to: 80}, {from: 20, to: 100}], 'the rail turns back where the walk does')
  assert.equal(R.railStopTitle(set.walks[0].stops[0]), 'One · 1913 · Küsnacht · 2 attached')
  assert.equal(R.railKindText(set.walks[0]), 'redbook · curated · 4 stops')
  assert.equal(R.railKindText(set.walks[1]), 'field-thread · derived on read · 1 stop')
  const markup = ruler(set)
  const at = needle => markup.indexOf(needle)
  assert.ok(at('data-track="w"') < at('data-walk-row="walk"') && at('data-walk-row="walk"') < at('data-track="x"'), 'the rail stands under its lane')
  assert.ok(at('data-walk-row="nowhere"') > at('data-track="x"'), 'a rail with no placed stop stands after the tracks')
  assert.match(markup, /class="tl-lane tl-rail" data-walk-row="walk" data-walk-kind="redbook" data-walk-derived="curated" style="--tc:#123456"><span class="tl-head tl-rail-head" title="A walk · redbook · curated · 4 stops · 1 of 4 stops have no place on this ruler"><span class="tl-lane-name">A walk<\/span><small>3\/4 placed<\/small>/)
  assert.deepEqual([...markup.matchAll(/class="tl-stop" data-walk-stop="(\d)" data-stop-ref="([^"]+)" style="left:([\d.]+)%"/g)].map(m => [m[1], m[2], m[3]]), [['1', 'p1', '80'], ['2', 'p2', '20'], ['4', 'p4', '100']])
  assert.match(markup, /title="1\/4 · One · 1913 · Küsnacht · 2 attached · no stop focus: the owner gives none">1<\/span>/, 'no focus from the owner: the stops are read, not pressed')
  assert.match(markup, /<small>0\/1 placed<\/small>/)
})

test('pressing a rail\'s stop stands it through the set\'s stop focus; the focus refuses what the walk does not hold', async () => {
  const stood = []
  const stand = async (walk, stop) => { stood.push(`${walk.id}:${stop.id}`); return stop.id === 'p2' ? 'The atlas holds no epoch for this stop.' : null }
  const focus = cut.focusStopAction(walked().walks, stand)
  assert.equal(focus.op, cut.FOCUS_STOP_OP)
  assert.deepEqual(await focus.run('walk', 0), {ok: true, note: 'Stood One.'})
  assert.deepEqual(await focus.run('walk', 1), {ok: false, error: 'The atlas holds no epoch for this stop.'})
  assert.deepEqual(await focus.run('walk', 9), {ok: false, error: 'Stop 10 of "walk" is not a stop of this work.'})
  assert.deepEqual(await cut.focusStopAction(walked().walks, async () => { throw new Error('owner down') }).run('walk', 0), {ok: false, error: 'owner down'})
  assert.deepEqual(stood, ['walk:p1', 'walk:p2'], 'an unknown stop calls no owner')
  // The view: a placed stop is a button that presses the focus, its answer marked where it was pressed.
  const set = walked({actions: {focusStop: focus}})
  const presses = []
  const tree = rulerTree(set, {}, {onPress: (key, what, run) => presses.push({key, what, run})})
  find(tree, n => n.props['data-walk-stop'] === 2 && n.type === 'button')[0].props.onClick()
  assert.deepEqual(presses.map(p => [p.key, p.what]), [['stop:walk:1', 'Stand Two']])
  assert.deepEqual(await presses[0].run(), {ok: false, error: 'The atlas holds no epoch for this stop.'})
  assert.match(ruler(set, {}, {receipt: {key: 'stop:walk:0', what: 'Stand One', ok: true, text: 'Stood One.'}}), /data-walk-stop="1" data-stop-ref="p1" data-receipt="ok"/)
  // The World cut adds the focus where the owner gives none, and keeps an owner's own.
  const spine = createTimeSpine()
  const added = cut.worldCutSet(walked(), spine, {eventByClipId: new Map()}, stand)
  assert.equal(added.actions.focusStop.op, cut.FOCUS_STOP_OP)
  const own = {op: 'owner:focus', run() {}}
  assert.equal(cut.worldCutSet(walked({actions: {focusStop: own}}), spine, {eventByClipId: new Map()}, stand).actions.focusStop, own)
  assert.equal(cut.worldCutSet({...walked(), walks: undefined}, spine, {eventByClipId: new Map()}, stand).actions, undefined, 'no walk, no focus')
})

test('through the registration, a stop stands its occasion on the spine by the one rule (walkStopFocus → applyWalkStopFocus)', async () => {
  const spine = firedSpine()
  const entry = dayEvent('central:now:entry', t0 - 3_600_000, 'an entry')
  const central = registered('base', {set: null, document: null, world: worldView(spine, [entry])})
  const days = central.walks.find(walk => walk.id === 'central:today')
  assert.ok(days, 'today is a walk: its entries are its stops (T-WORLDS W2)')
  assert.equal(spine.occasion(), null)
  assert.deepEqual(await central.actions.focusStop.run('central:today', 0), {ok: true, note: `Stood ${days.stops[0].label}.`})
  assert.equal(spine.occasion().basis.ref, 'central:now:entry', 'the day\'s face is an entry: its occasion stands on the spine')
})

// ── 6 — the window: zoom, pan, snap ────────────────────────────────────────────────────────────

const B10 = {start: 0, end: 10, minSpan: .05}

test('the window keeps the old model\'s rules: clamp, zoom about an anchor, pan, reveal (native-arrangement-model.test.mjs:47-80)', () => {
  assert.deepEqual(W.rangeBounds(10), {start: 0, end: 10, minSpan: 10 / 256}, 'a 256th of the extent, with no unit floor')
  assert.equal(W.rangeBounds(0).end, 1)
  assert.equal(W.rangeBounds(Number.NaN).end, 1)
  assert.deepEqual(W.clampRange({start: -3, end: 2}, B10), {start: 0, end: 5})
  assert.deepEqual(W.clampRange({start: 8, end: 20}, B10), {start: 0, end: 10})
  assert.deepEqual(W.clampRange({start: 9, end: 9.01}, B10), {start: 9, end: 9.05})
  assert.deepEqual(W.zoomAround({start: 0, end: 10}, 5, 2, B10), {start: 2.5, end: 7.5})
  assert.deepEqual(W.zoomAround({start: 2, end: 7}, 2, 2, B10), {start: 2, end: 4.5})
  assert.deepEqual(W.zoomAround({start: 0, end: 10}, 0, 1000, B10), {start: 0, end: .05})
  assert.deepEqual(W.zoomAround({start: 0, end: 10}, 5, .5, B10), {start: 0, end: 10})
  assert.deepEqual(W.zoomAround({start: 0, end: 5}, 20, 2, B10), {start: 7.5, end: 10})
  assert.deepEqual(W.zoomAround({start: 0, end: 5}, 2, Number.NaN, B10), {start: 0, end: 5})
  assert.deepEqual(W.panBy({start: 0, end: 5}, 2, B10), {start: 2, end: 7})
  assert.deepEqual(W.panBy({start: 0, end: 5}, -3, B10), {start: 0, end: 5})
  assert.deepEqual(W.panBy({start: 5, end: 10}, 10, B10), {start: 5, end: 10})
  assert.deepEqual(W.revealRange({start: 0, end: 5}, 6, 7, B10), {start: 2, end: 7})
  assert.deepEqual(W.revealRange({start: 2, end: 7}, .5, 1, B10), {start: .5, end: 5.5})
  assert.deepEqual(W.revealRange({start: 0, end: 5}, 1, 2, B10), {start: 0, end: 5})
  assert.equal(W.percentOf(2.5, {start: 0, end: 10}), 25)
  assert.equal(W.wheelZoomFactor(-240), 2)
  assert.equal(W.wheelZoomFactor(240), .5)
})

test('snap keeps the old modes against the mark step: grid a twentieth, coarse a half, free three decimals (native-arrangement-model.test.mjs:36-45)', () => {
  const B = {start: 0, end: 3600}
  assert.equal(W.snapAt(1.2345, 'grid', 1, B), 1.25)
  assert.equal(W.snapAt(1.3, 'coarse', 1, B), 1.5)
  assert.equal(W.snapAt(1.23456, 'free', 1, B), 1.235)
  assert.equal(W.snapAt(-4, 'grid', 1, B), 0)
  assert.equal(W.snapAt(9999, 'free', 1, B), 3600)
  assert.equal(W.snapAt(37, 'coarse', 10, B), 35, 'against a ten-unit mark, coarse is five')
  assert.deepEqual(['grid', 'coarse', 'free'].map(mode => W.snapOfPress(mode, {})), ['grid', 'coarse', 'free'])
  assert.equal(W.snapOfPress('grid', {shiftKey: true}), 'free', 'Shift frees one press')
  assert.equal(W.snapOfPress('grid', {altKey: true}), 'coarse', 'Alt coarsens it')
  assert.deepEqual(['grid', 'coarse', 'free'].map(W.nextSnap), ['coarse', 'free', 'grid'])
})

test('the marks are the ruler\'s eighths at fit, halved per doubling of zoom, fixed to the material as it pans, never closer than 64px', () => {
  const bounds = W.rangeBounds(100)
  const ats = marks => marks.map(mark => mark.at)
  const fit = W.windowMarks(W.fitRange(bounds), bounds)
  assert.deepEqual(ats(fit), [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100], 'the nine marks the shared ruler always drew')
  assert.deepEqual(fit.map(mark => mark.end), [false, false, false, false, false, false, false, false, true])
  assert.deepEqual(ats(W.windowMarks({start: 25, end: 50}, bounds)), [25, 28.125, 31.25, 34.375, 37.5, 40.625, 43.75, 46.875, 50])
  assert.deepEqual(ats(W.windowMarks({start: 30, end: 55}, bounds)), [31.25, 34.375, 37.5, 40.625, 43.75, 46.875, 50, 53.125], 'panning moves the window, not the marks')
  assert.deepEqual(ats(W.windowMarks(W.fitRange(bounds), bounds, 400)), [0, 25, 50, 75, 100], 'thinned to the 64px floor')
  assert.equal(W.markStep({start: 25, end: 50}, bounds, 400), 6.25)
  assert.deepEqual(W.windowMarks({start: 0, end: 0}, bounds), [])
})

test('the focused ruler\'s keys move the window (nativeArrangementTimeline.tsx:217-226)', () => {
  const r = {start: 0, end: 5}
  assert.deepEqual(W.windowOfKey('ArrowRight', r, B10), {start: .5, end: 5.5})
  assert.deepEqual(W.windowOfKey('ArrowLeft', {start: 2, end: 7}, B10), {start: 1.5, end: 6.5})
  assert.deepEqual(W.windowOfKey('ArrowUp', {start: 0, end: 10}, B10), {start: 2.5, end: 7.5})
  assert.deepEqual(W.windowOfKey('+', {start: 0, end: 10}, B10, 0), {start: 0, end: 5}, 'zoom holds the anchor still')
  assert.deepEqual(W.windowOfKey('-', {start: 2.5, end: 7.5}, B10), {start: 0, end: 10})
  assert.deepEqual(W.windowOfKey('End', r, B10), {start: 5, end: 10})
  assert.deepEqual(W.windowOfKey('Home', {start: 5, end: 10}, B10), {start: 0, end: 5})
  assert.equal(W.windowOfKey('x', r, B10), null)
})

const zoomable = () => ({columns: [{id: 'r1', name: '1'}], tracks: [{id: 'a', name: 'Alpha', kind: 'k'}],
  clips: [clip('a1', 'a', 'r1', 'early', {at: {start: 40, end: 60}}), clip('a2', 'a', 'r1', 'late', {at: {start: 100}})], ruler: {unit: 'seconds', label: at => `t${at}`}})

test('the ruler lays its lanes through the window, its tools and slider saying where the window stands', () => {
  const fit = renderToStaticMarkup(React.createElement(ArrangementRuler, {set: zoomable(), selection: SELECT}))
  assert.match(fit, /aria-label="Zoom out" title="[^"]*" disabled=""/, 'at fit there is nothing to zoom out to')
  assert.match(fit, /aria-label="Fit the whole ruler" title="Fit the whole ruler" disabled=""/)
  assert.match(fit, /class="tl-snap" data-snap="grid" aria-label="Snap: grid"/)
  assert.match(fit, /role="slider" tabindex="0" aria-label="Visible window of the ruler, in seconds" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0" aria-valuetext="t0 to t100"/)
  assert.match(fit, /data-clip="a1"[^>]*style="left:40%;width:max\(6px, 20%\)"/)
  const zoomed = ruler(zoomable(), {window: {start: 25, end: 50}})
  assert.match(zoomed, /data-tracks-view="arrangement" data-window="zoomed"/)
  assert.match(zoomed, /data-clip="a1"[^>]*style="left:60%;width:max\(6px, 80%\)"/, 'a clip is laid through the window, not squeezed into it')
  assert.match(zoomed, /aria-valuemin="0" aria-valuemax="75" aria-valuenow="25" aria-valuetext="t25 to t50"/)
  assert.match(zoomed, /<span class="end" style="left:100%">t50<\/span>/)
  assert.match(zoomed, /aria-label="Fit the whole ruler" title="Fit the whole ruler">Fit/)
  // The insert marker: a line in the lanes and its point on the ruler, the pane's own.
  const marked = ruler(zoomable(), {window: {start: 25, end: 50}, marker: 30})
  assert.match(marked, /class="tl-marker" style="left:20%"/)
  assert.match(marked, /class="tl-marker-mark" style="left:20%" title="Insert marker at t30 · the pane&#x27;s own, snapped grid; it writes no time to any owner">t30<\/span>/)
  assert.doesNotMatch(ruler(zoomable(), {window: {start: 25, end: 50}, marker: 90}), /tl-marker/, 'a marker outside the window is not drawn')
})

test('a drag on the ruler pans the window; a press sets the snapped marker; the keys zoom about it — and no owner is touched', () => {
  const touched = []
  const owner = name => ({op: name, run: () => touched.push(name)})
  const set = {...zoomable(), actions: {launch: owner('launch'), launchStop: owner('row'), stopTrack: owner('stop'), retry: owner('retry'), focusStop: owner('focus')}}
  const box = {getBoundingClientRect: () => ({left: 0, width: 400}), setPointerCapture() {}}
  const run = (view, steps) => {
    const out = {windows: [], markers: []}
    const gesture = {current: null}
    const tree = rulerTree(set, {window: {start: 25, end: 50}, width: 400, marksRef: {current: box}, gesture,
      onWindow: next => out.windows.push(next), onMarker: next => out.markers.push(next), ...view})
    const slider = find(tree, n => n.props.role === 'slider')[0].props
    steps(slider)
    return out
  }
  const pan = run({}, s => {
    s.onPointerDown({button: 0, pointerId: 1, clientX: 100, currentTarget: box})
    s.onPointerMove({pointerId: 1, clientX: 102})
    s.onPointerMove({pointerId: 1, clientX: 180})
    s.onPointerUp({pointerId: 1, clientX: 180})
  })
  assert.deepEqual(pan.windows, [{start: 20, end: 45}], 'a 3px wobble is a press; 80px at 16px a unit pans five units back')
  assert.deepEqual(pan.markers, [], 'a pan sets no marker')
  const press = (extra = {}) => run({}, s => {
    s.onPointerDown({button: 0, pointerId: 2, clientX: 110, currentTarget: box})
    s.onPointerUp({pointerId: 2, clientX: 110, ...extra})
  }).markers
  // 110px of 400 into 25–50 is 31.875; the mark step there is 6.25: grid snaps to 0.3125, coarse to 3.125.
  assert.deepEqual(press(), [31.875])
  assert.deepEqual(press({altKey: true}), [31.25])
  assert.deepEqual(run({snap: 'coarse'}, s => { s.onPointerDown({button: 0, pointerId: 3, clientX: 110, currentTarget: box}); s.onPointerUp({pointerId: 3, clientX: 110, shiftKey: true}) }).markers, [31.875], 'Shift frees it')
  const keyed = run({marker: 30}, s => { s.onKeyDown({key: 'ArrowUp', preventDefault() {}}); s.onKeyDown({key: 'q', preventDefault() {}}) })
  assert.deepEqual(keyed.windows, [{start: 27.5, end: 40}], 'keyboard zoom holds the marker still')
  assert.deepEqual(run({marker: 30}, s => s.onKeyDown({key: 'Escape', preventDefault() {}})).markers, [null], 'Escape lifts the marker')
  assert.deepEqual(touched, [], 'the window, the snap and the marker write nothing to any owner')
})

// ── 7 — the laws ───────────────────────────────────────────────────────────────────────────────

test('the new modules name no mode, take no raw colour, and the window imports no owner of time', async () => {
  for (const file of ['trackMarks.ts', 'trackSections.ts', 'trackRails.ts', 'rulerWindow.ts', 'worldCutTracks.ts', 'useWorldCut.ts', 'SessionGrid.tsx', 'ArrangementRuler.tsx']) {
    const source = (await readFile(new URL(`../src/frame/tracks/${file}`, import.meta.url), 'utf8')).replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(source, /'(live|base|central|factory|expressions|techne|audio)'/, `${file} names no mode`)
    assert.doesNotMatch(source, /#[0-9a-fA-F]{6}\b|rgba?\(/, `${file} takes no raw colour`)
  }
  for (const file of ['rulerWindow.ts', 'ArrangementRuler.tsx']) {
    const source = await readFile(new URL(`../src/frame/tracks/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /timeSpine|setTransport|selectOccasion|fireCadence|qualifyOccasions/, `${file} holds no spine and writes no time`)
  }
  const bare = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(bare, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/)
})
