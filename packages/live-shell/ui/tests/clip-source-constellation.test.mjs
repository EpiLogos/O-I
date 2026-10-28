// O-I #768, "The clip's source in every mode" (decision #709: "the wiki constellations are what persist … each clip's source is its
// constellation, as a sample is an audio clip's"). Manual §10.3, §16.5, §16.7 and each mode's Clip panel (§17.1, §18.1, §19.1, §20.1,
// §21.1): a clip's Clip panel names its constellation under Constellation with Show in Browser beside it; Show in Browser selects it in
// the one browser and keeps it selected across modes; the browser's preview shows what this mode makes of it; a constellation dropped
// on a track makes this mode's clip of it, whose source reads back from its owner.
// Channels: FIXTURE wiki registers shaped as the Wiki owner gives them (techne/wikiExpression.ts parseWiki over a wiki.json's objects,
// projected by the production projection); SCRIPTED: a kernel behind the bridge's fetch that records every op, the designs and the
// Session grid rendered to static markup. Production modules in memory through the transpiling loader (r2-clip-bindings.test.mjs's).
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

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
  if (u.includes('?raw') || u.includes('.html') || u.endsWith('.svg') || u.endsWith('.png') || u.endsWith('.md')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const noop = () => {}
globalThis.document ??= {getElementById: () => null, createElement: () => ({style: {}, setAttribute: noop, appendChild: noop}), head: {appendChild: noop},
  addEventListener: noop, removeEventListener: noop, querySelector: () => null, documentElement: {style: {}}}
globalThis.window ??= globalThis; globalThis.addEventListener ??= noop; globalThis.removeEventListener ??= noop
globalThis.localStorage ??= {getItem: () => null, setItem: noop}

const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {parseWiki} = await import('../../../../desktop/cradle/src/techne/wikiReading.ts')
const {projectWikiExpression} = await import('../../../../desktop/cradle/src/techne/wikiExpression.ts')
const owners = await import('../src/owners/constellations.ts')
const focus = await import('../src/frame/browser/constellationFocus.ts')
const {MADE_OF} = await import('../src/inhabitants/catalogue/clips/design.ts')
const {loadClip, CLIP_MODES} = await import('../src/inhabitants/catalogue/clips/index.ts')
const {resetViewHolds} = await import('../src/frame/detail/clipBinding.ts')
const central = await import('../src/central/clipBinding.ts')
const expressions = await import('../src/components/expressions/clip/clipBinding.ts')
const techne = await import('../src/techne/clipBinding.ts')
const factory = await import('../src/agent/clipBinding.ts')
const live = await import('../src/live/clipBinding.ts')
const {trackKey} = await import('../src/agent/agentRunModel.ts')

// ---------------------------------------------------------------------------------------------------------------- the owner's wiki

const LIVED = 'wiki:anchor:lived-in'
const OI_SPACE = 'central:wiki:project:O-I'
const OI_ROOT = 'wiki:node:project-root/o-i'
/** O-I's register, shaped as its wiki.json (Work/O-I/ProjectCentral/agents/wiki/wiki.json read 28 Oct: one space anchored on the
 * project's root node), with one frame constellation a person authored (aikit.constellation/v1, as knowledge/construction.ts writes it). */
const OI_WIKI = {objects: [
  {object: 'space', ref: OI_SPACE, title: 'O-I', anchor_ref: OI_ROOT, node_refs: [OI_ROOT, 'wiki:node:o-i/dlw'], child_space_refs: [], revision: 6},
  {object: 'node', ref: OI_ROOT, title: 'O-I', type: 'project-root', revision: 1},
  {object: 'node', ref: 'wiki:node:o-i/dlw', title: 'The DLW', revision: 1, ql: {position: 2}},
  {object: 'frame', ref: 'wiki:frame:lived', revision: 2, constellations: [{anchor_ref: LIVED, members: [{ref: 'wiki:node:o-i/dlw', position: 1}, {ref: OI_ROOT, position: 4}]}],
    'aikit.constellation/v1': {title: 'The lived-in world', inquiry: {question: 'What does a lived-in world hold?'}}},
]}
/** Central's root register: its own space, which discloses O-I's as a child (read in O-I's own register, so listed there only). */
const CENTRAL_WIKI = {objects: [
  {object: 'space', ref: 'central:wiki:root', title: 'Central', anchor_ref: 'wiki:node:central', node_refs: ['wiki:node:central'], child_space_refs: [OI_SPACE], revision: 3},
  {object: 'node', ref: 'wiki:node:central', title: 'Central', revision: 1},
]}
const registerOf = (key, project) => ({key, title: key === 'central' ? 'Central' : key, ...(project ? {project, projectPath: `Work/${project}`} : {})})
function projected(register, objects) {
  const reading = {state: 'ready', register, wiki: parseWiki(JSON.stringify(objects)), wikiBasis: {path: 'wiki.json', revision: 'r1', location: {schema: 'central.path-ref/v1', ref: 'x', root: '/g', path: 'wiki.json'}},
    relations: {state: 'unavailable', focusRef: '', reason: 'not read in this fixture'}}
  return {phase: 'projected', reading, projection: projectWikiExpression(reading)}
}
const STATE = {
  registers: [registerOf('central'), registerOf('O-I', 'O-I'), registerOf('Palace', 'Palace'), registerOf('Workcell', 'Workcell')],
  standings: {central: projected(registerOf('central'), CENTRAL_WIKI), 'O-I': projected(registerOf('O-I', 'O-I'), OI_WIKI),
    Palace: {phase: 'unavailable', reason: 'Central could not disclose the selected Project.'}, Workcell: {phase: 'reading'}},
}
const READING = owners.constellationsOf(STATE)
const ROWS = READING.rows

test('the constellations of your wiki are read from the one projection state: every space and every frame, a child space once, each register\'s standing named', () => {
  assert.deepEqual(ROWS.map(row => [row.ref, row.title, row.kind, row.register]), [
    ['wiki:node:central', 'Central', 'space', 'central'],
    [OI_ROOT, 'O-I', 'space', 'O-I'],
    [LIVED, 'The lived-in world', 'frame', 'O-I'],
  ], 'O-I\'s space, disclosed as a child by Central, is listed once, in its own register')
  const lived = owners.constellationNamed(ROWS, LIVED)
  assert.equal(lived.question, 'What does a lived-in world hold?')
  assert.deepEqual(lived.members.map(member => [member.ref, member.position]), [['wiki:node:o-i/dlw', 1], [OI_ROOT, 4]])
  assert.deepEqual(READING.reading, ['Workcell'])
  assert.deepEqual(READING.unread, [{register: 'Palace', reason: 'Central could not disclose the selected Project.'}])
  assert.equal(owners.constellationNamed(ROWS, 'wiki:anchor:gone'), null)
  assert.equal(owners.constellationOfSubject(ROWS, 'wiki:node:o-i/dlw').ref, LIVED, 'a member belongs to the constellation that gathers it')
  assert.equal(owners.constellationOfSubject(ROWS, OI_ROOT).ref, OI_ROOT, 'a whole is its own constellation first')
})

// ---------------------------------------------------------------------------------------------------------------- the Clip panel

const WHAT = {central: 'page', factory: 'task', expressions: 'scene', techne: 'event', live: 'clip'}
const CLIP_TAB = async mode => (await loadClip(mode)).panel.find(tab => tab.id === 'clip')

test('every mode\'s Clip panel names the clip\'s constellation under Constellation, with Show in Browser beside it', async () => {
  assert.deepEqual([...CLIP_MODES].sort(), Object.keys(WHAT).sort())
  for (const mode of CLIP_MODES) {
    const tab = await CLIP_TAB(mode)
    const design = await loadClip(mode)
    const v = {...design.defaults, [MADE_OF.name]: 'The lived-in world', [MADE_OF.ref]: LIVED}
    const markup = renderToStaticMarkup(createElement('div', null, tab.draw({v, set: noop, size: 'detail', room: {w: 1180, h: 300}})))
    assert.match(markup, /data-i="Constellation\|/, `${mode}: the field is named Constellation`)
    assert.match(markup, /The lived-in world/, `${mode}: it names the constellation`)
    assert.match(markup, /Show in Browser/, `${mode}: Show in Browser stands beside it`)
    // A clip made of none says so, and Show in Browser stands dimmed with why.
    const none = renderToStaticMarkup(createElement('div', null, tab.draw({v: {...design.defaults, [MADE_OF.name]: 'None', [MADE_OF.ref]: undefined}, set: noop, size: 'detail', room: {w: 1180, h: 300}})))
    assert.match(none, new RegExp(`was made of no constellation`), `${mode}: made of none, Show in Browser says why it is dark`)
  }
})

// ---------------------------------------------------------------------------------------------------------------- Show in Browser

test('Show in Browser selects the constellation in the browser\'s Constellations category, through the frame\'s door, and refuses with no browser', async () => {
  focus.resetConstellationFocus()
  resetViewHolds()
  const content = thingPage({constellationRef: LIVED})
  const binding = central.centralClipBinding({ref: 'page:lived', values: central.fileReading(content, 'note').values}, {constellations: ROWS})
  await assert.rejects(binding.write([{key: MADE_OF.show, value: 1}]), /No browser is mounted/)
  const shown = []
  focus.publishBrowserDoor(key => shown.push(key))
  await binding.write([{key: MADE_OF.show, value: 2}])
  assert.deepEqual(shown, [focus.CONSTELLATIONS_CATEGORY], 'the browser comes forward on Constellations')
  assert.equal(focus.constellationFocus().ref, LIVED, 'the constellation stands selected')
  assert.equal(focus.CONSTELLATIONS_CATEGORY, 'constellations:constellations')
  focus.resetConstellationFocus()
})

// ---------------------------------------------------------------------------------------------------------------- each mode's source

/** A Thing page as the page owner keeps it (desktop/cradle/documents/oi-things.html's island, kernel/src/page.rs reads it). */
function thingPage(bindings, title = 'The lived-in world') {
  const island = {profile: 'oi.page/v1', meta: {documentId: 'd1', created: '2026-10-28', title, revision: 1, family: 'things', template: 'oi.template/things', templateVersion: '0.1.0'},
    bindings: {worldRef: OI_SPACE, subjectRef: null, categories: ['C2'], expressionRef: null, sources: [], ...bindings}, appearance: {layout: 'editorial', tone: 'paper'},
    page: {subtitle: '', introduction: '', sections: []}, notes: [], extensions: {}}
  return `<!doctype html><html><body><script type="application/json" id="ql-doc">${JSON.stringify(island)}</script></body></html>`
}

test('Central: a page\'s source is the constellation its island names (bindings.constellationRef), named from the wiki; a page made of none says None', () => {
  resetViewHolds()
  const made = central.centralClipBinding({ref: 'page:lived', values: central.fileReading(thingPage({constellationRef: LIVED}), 'note').values}, {constellations: ROWS})
  assert.equal(made.values[MADE_OF.ref], LIVED)
  assert.equal(made.values[MADE_OF.name], 'The lived-in world')
  assert.equal(made.standing[MADE_OF.show], undefined, 'Show in Browser stands lit')
  const none = central.centralClipBinding({ref: 'page:plain', values: central.fileReading(thingPage({}), 'note').values}, {constellations: ROWS})
  assert.equal(none.values[MADE_OF.name], 'None')
  assert.equal(MADE_OF.ref in none.values, false)
  assert.match(none.standing[MADE_OF.show].disabled, /made of no constellation/)
  const gone = central.centralClipBinding({ref: 'page:gone', values: central.fileReading(thingPage({constellationRef: 'wiki:anchor:gone'}), 'note').values}, {constellations: ROWS})
  assert.equal(gone.values[MADE_OF.name], 'wiki:anchor:gone', 'a source the wiki no longer discloses is named by its ref, never dropped')
})

test('Expressions: a scene\'s source is its body\'s knowledge whole (the Expression owner\'s scene body); another body is made of none', () => {
  assert.deepEqual(expressions.sceneSourceOf({scene_ref: 's', triggers: [], body: {carrier: 'knowledge_whole', subject_ref: LIVED, native_owner: 'ai-kit',
    reading: {ref: LIVED, revision: 'r2', availability: 'available'}, provenance: [], actions: [], presentation: 'preview', capability: {state: 'degrades_to_thing', reason: 'no renderer'}}}),
    {made: 'of', ref: LIVED, by: 'the scene\'s body: a knowledge whole, its subject (the Expression\'s owner)'})
  assert.equal(expressions.sceneSourceOf({scene_ref: 's', triggers: [], body: null}).made, 'none', 'the live engine composition is made of no constellation')
  assert.equal(expressions.sceneSourceOf(null).made, 'unread')
})

test('Technē: an event\'s source is the constellation the wiki gathers its subject in; a World subject in hand is its own', () => {
  resetViewHolds()
  const selected = {ref: null, clip: null, track: null, set: null}
  const subject = techne.techneClipBinding({worldCut: false, world: null, worldSubject: {kind: 'location', ref: OI_ROOT, title: 'O-I'}, selected, constellations: ROWS})
  assert.equal(subject.values[MADE_OF.ref], OI_ROOT); assert.equal(subject.values[MADE_OF.name], 'O-I')
  const member = techne.techneClipBinding({worldCut: false, world: null, worldSubject: {kind: 'place', ref: 'wiki:node:o-i/dlw', title: 'The DLW'}, selected, constellations: ROWS})
  assert.equal(member.values[MADE_OF.name], 'The lived-in world')
  const loose = techne.techneClipBinding({worldCut: false, world: null, worldSubject: {kind: 'place', ref: 'earth:place:delphi', title: 'Delphi'}, selected, constellations: ROWS})
  assert.equal(loose.values[MADE_OF.name], 'None')
  const waiting = techne.techneClipBinding({worldCut: false, world: null, worldSubject: {kind: 'place', ref: 'earth:place:delphi', title: 'Delphi'}, selected, constellations: ROWS, wikiPending: true})
  assert.equal(MADE_OF.name in waiting.values, false, 'while a register is still read, a subject found nowhere yet is unread, never None')
  assert.match(waiting.standing[MADE_OF.show].disabled, /still being read/)
})

test('Technē: an event made of a constellation names the source its Scene\'s body keeps, read from the World\'s walk Expression', async () => {
  resetViewHolds()
  const {madeEventClipId} = await import('../src/timeline/techneTrackAdapter.ts')
  const sceneRef = 'expression:techne-walk-central:scene:event-1'
  const clip = {id: madeEventClipId(sceneRef), trackId: 'techne:made-events', columnId: `techne:row:made:${sceneRef}`, label: 'The lived-in world'}
  const selected = {ref: clip.id, clip, track: {id: 'techne:made-events', name: 'Made of constellations', color: '#888'}, set: null}
  const made = [{sceneRef, title: 'The lived-in world', source: LIVED}]
  const binding = techne.techneClipBinding({worldCut: false, world: null, selected, constellations: ROWS, made})
  assert.equal(binding.values[MADE_OF.ref], LIVED)
  assert.equal(binding.values[MADE_OF.name], 'The lived-in world')
  assert.equal(binding.values['event.kind'], 'made of a constellation')
  assert.equal(binding.standing[MADE_OF.show], undefined, 'Show in Browser stands lit')
  const unread = techne.techneClipBinding({worldCut: false, world: null, selected, constellations: ROWS, made: null})
  assert.equal(MADE_OF.name in unread.values, false, 'with the walk unread the source is unread, never None')
  assert.match(unread.standing[MADE_OF.show].disabled, /walk Expression is not read/)
})

test('Technē: a constellation dropped on a track makes an event of it through the walk\'s owner, its body the wiki\'s reading of the whole', async () => {
  const sent = []
  const session = {make: async (made, body) => { sent.push({made, body}); return {ok: true, note: `made ${made.title}`} }}
  const wholes = {loadRegisters: async () => {}, unreadRegisters: () => [],
    wholeOf: ref => ref === LIVED ? {requested_ref: LIVED, ref: LIVED, native_owner: 'wiki', title: 'The lived-in world', register: 'O-I',
      reading: {ref: LIVED, revision: 'r1', availability: 'available'}, provenance: []} : null}
  const maker = techne.techneEventMaker(session, wholes)
  assert.equal(maker.accepts, owners.CONSTELLATION_DRAG)
  const answer = await maker.run('techne:stream:readings', LIVED)
  assert.equal(answer.ok, true, answer.error)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].made, {ref: LIVED, title: 'The lived-in world'})
  assert.equal(sent[0].body.carrier, 'knowledge_whole')
  assert.equal(sent[0].body.subject_ref, LIVED)
  assert.equal(sent[0].body.native_owner, 'wiki', 'the body is placed from the wiki\'s own reading, not a copy')
  const {techneTracksOf} = await import('../src/frame/tracks/useTechneTracks.ts')
  const set = techneTracksOf({world: {state: 'unavailable', reason: 'no civil read here'}})
  assert.equal(set.actions?.makeClip?.accepts, owners.CONSTELLATION_DRAG, 'Technē\'s set takes a constellation dropped on its tracks')
  assert.match(set.actions.makeClip.op, /walk Expression/, 'and makes its event in the World\'s walk Expression')
  const gone = await maker.run('techne:stream:readings', 'wiki:anchor:gone')
  assert.equal(gone.ok, false)
  assert.match(gone.error, /no constellation the wiki's read registers disclose/)
  assert.equal(sent.length, 1, 'a ref the wiki does not read makes nothing')
})

const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true, spaceRef: 'space:lead', spaceLabel: null,
  depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: false, budget: {used: 2, max: 12}, disclosure: null,
  tasks: [{n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: null}]}

/** One session's settings as AIKit reads them (aikit.encounter-session-settings/v1, ai-kit encounter_task_settings.rs `reading`), its bound
 * task's `source` the constellation it was made of (ai-kit e78b5986). FIXTURE shaped as the owner's reading, not a capture. */
function settingsOf(source, {revision = 'session-settings/01', task = true} = {}) {
  return {schema: 'aikit.encounter-session-settings/v1', agent_session: 'ses-214', revision, track: {telemetry: true, solo: false, set: []},
    task: task ? {task_ref: 'task:fixtures', name: 'correlate occurrences', colour: null, active: true, register: 'plain', form: 'technical', loop: false,
      loop_until: 'done', loop_cap: null, launch: 'trigger', then: 'next', quantize: 'global', repeat_variable: 'condition', repeat_levels: [], repeat_repeats: 3,
      repeat_stop: 'done', envelope_mode: 'automation', envelope_linked: true, source, effort: [], autonomy: [], set: source ? ['source'] : []} : null,
    previous_task: null, standing: 'The person\'s settings for this session and its bound task.'}
}
const BRIDGE = {kind: 'bridge', url: 'http://kernel.test'}
const seam = settings => ({transport: BRIDGE, project: 'O-I', settings, refused: null})

test('Factory: a task\'s source is the constellation its settings on AIKit name (task.source), named from the wiki; a task made of none says None', () => {
  // REPLACED (O-I #768, part two): the key stood absent naming a missing `task_source` op on AIKit (agent/clipBinding.ts TASK_SOURCE); AIKit's
  // task settings keep the source now (ai-kit a3f43f84, e78b5986), so the binding reads it (agent/clipBinding.ts taskSourceOf).
  resetViewHolds()
  const ref = `${trackKey(track)}#task/1`
  const made = factory.factoryClipBinding({ref, tracks: [track], events: [], settings: seam(settingsOf(LIVED)), constellations: ROWS})
  assert.equal(made.values[MADE_OF.ref], LIVED)
  assert.equal(made.values[MADE_OF.name], 'The lived-in world')
  assert.equal(made.standing[MADE_OF.show], undefined, 'Show in Browser stands lit')
  const none = factory.factoryClipBinding({ref, tracks: [track], events: [], settings: seam(settingsOf(null)), constellations: ROWS})
  assert.equal(none.values[MADE_OF.name], 'None')
  assert.match(none.standing[MADE_OF.show].disabled, /made of no constellation/)
  const unread = factory.factoryClipBinding({ref, tracks: [track], events: [], settings: null, constellations: ROWS})
  assert.equal(MADE_OF.name in unread.values, false, 'unread settings name no source, never None')
  assert.match(unread.standing[MADE_OF.show].disabled, /not read here/)
  const older = settingsOf(null); delete older.task.source
  const unkept = factory.factoryClipBinding({ref, tracks: [track], events: [], settings: seam(older), constellations: ROWS})
  assert.equal(MADE_OF.name in unkept.values, false, 'an AIKit that keeps no source is unread, never None')
  assert.equal(unkept.standing[MADE_OF.show].disabled, factory.SOURCE_UNKEPT)
  const wiring = factory.factoryWiring({sessionRef: 'ses-214', n: 1}, seam(settingsOf(LIVED)))
  assert.match(wiring.reads[MADE_OF.ref], /AIKit/)
  assert.equal(JSON.stringify(wiring).includes('task_source'), false, 'no missing op stands on Factory\'s source')
})

// REPLACED (O-I #768, part three): "Live: no owner keeps a Live clip's source yet — the key stands absent and Show in Browser names the missing
// operation" (live_clip_source on live-set). The set's owner keeps a clip's source now, in the DLW's record beside the set (live-set
// sources.rs), and reads it with the clip (live_clip_read's `source`): the binding names it from there.
test('Live: a clip\'s source reads back from the set\'s owner with the clip — made of a constellation, of none, or unread with why', () => {
  const address = {path: '/sets/Song.als', track: 0, at: {slot: 1}}
  const whole = {kind: 'midi', name: 'The lived-in world', colourIndex: null, active: true, sig: null, groove: null, scale: false, root: null, mode: null, scaleName: null,
    follow: false, followA: null, followB: null, chance: null, linked: null, multiplier: null, launch: 'trigger', legato: false, quantize: 'global', launchVelocity: 0,
    envelopes: [], notes: []}
  assert.deepEqual(live.liveSourceOf({...whole, source: LIVED}).ref, LIVED)
  const made = live.liveWiring(address, {...whole, source: LIVED}, 'h', null)
  assert.match(made.reads[MADE_OF.ref], /DLW's record beside the set/)
  assert.equal(made.refused[MADE_OF.show], undefined, 'Show in Browser stands lit')
  assert.ok(made.acts[MADE_OF.show])
  const none = live.liveWiring(address, {...whole, source: null}, 'h', null)
  assert.match(none.refused[MADE_OF.show], /made of no constellation/)
  assert.equal(live.liveSourceOf({...whole, source: null}).made, 'none')
  const refused = live.liveSourceOf({...whole, source: null, sourceRefused: 'The set\'s DLW record is not JSON'})
  assert.equal(refused.made, 'unread'); assert.match(refused.why, /not JSON/)
  const older = live.liveSourceOf(whole)
  assert.equal(older.made, 'unread', 'an owner that reports no source is unread, never None')
  assert.match(older.why, /reports no source/)
  assert.ok(live.LIVE_WIRING.absent[MADE_OF.name], 'with no clip read the source is absent, with why')
  assert.equal(JSON.stringify(live.LIVE_WIRING).includes('live_clip_source'), false, 'no missing op stands on Live\'s source')
})

const {readFileSync} = await import('node:fs')
const jankoFixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'))

test('Live: a constellation is transcribed into the keys its members\' coordinates are on the Jankó surface the owner serves', async () => {
  const transcribe = await import('../src/live/constellationClip.ts')
  const {readJankoWindow} = await import('../src/live/janko/jankoLayout.ts')
  // Captured owner windows (ql music janko window --json): the owner's default, and anchored at lens 3.
  const plain = readJankoWindow(jankoFixture('janko-window-v1.json')).window
  const lens = readJankoWindow(jankoFixture('janko-window-lens-3.json')).window
  const c = {ref: 'wiki:anchor:x', title: 'X', kind: 'frame', register: 'O-I', registerTitle: 'O-I', members: [
    {ref: 'a', title: 'A', position: 1, face: null}, {ref: 'b', title: 'B', position: 4, face: 'prime'},
    {ref: 'c', title: 'C', position: null, face: null}, {ref: 'd', title: 'D', position: 1, face: 'direct'}]}
  const made = transcribe.transcribeConstellation(c, plain)
  assert.deepEqual(made.notes.map(note => [note.p % 12, note.at, note.len]), [[2, 0, 4], [9, 0, 4]],
    'each placed member strikes its coordinate\'s key — 1 direct is D (2), 4 prime is A (9) — together, as one chord; a key two members name sounds once')
  assert.ok(made.notes.every(note => note.vel === 100))
  assert.deepEqual(made.struck.map(row => [row.member, row.key]), [['A', 'D'], ['B', 'A'], ['D', 'D']])
  assert.deepEqual(made.left, ['C: the wiki declares no sixfold position for it, so it strikes no key'])
  const anchored = transcribe.transcribeConstellation(c, lens)
  assert.deepEqual(anchored.notes.map(note => note.p % 12), [0, 5], 'the surface anchored at a lens moves every key, and the clip follows it')
  // The browser's preview in Live is that transcription, on the surface the keyboard holds.
  const {publishLiveJankoWindow} = await import('../src/live/janko/jankoLayout.ts')
  const {MODE_CONSTELLATION_PREVIEWS} = await import('../src/shell/constellationPreviews.tsx')
  publishLiveJankoWindow(jankoFixture('janko-window-v1.json'))
  const heard = renderToStaticMarkup(createElement(MODE_CONSTELLATION_PREVIEWS.live, {constellation: owners.constellationNamed(ROWS, LIVED)}))
  publishLiveJankoWindow(null)
  assert.match(heard, /<dt>The DLW<\/dt><dd>D<\/dd><dt>O-I<\/dt><dd>G#<\/dd>/, 'the preview names each member\'s key: 1 is D, 4 is G#')
  const loose = transcribe.transcribeConstellation({...c, members: [c.members[2]]}, plain)
  assert.match(loose.refused, /no member of X declares a sixfold position/i)
  // The wiki's own declaration of a member's face: a frame member's conjugate flag, else the node's ql.face.
  const objects = {objects: [
    {object: 'space', ref: 'central:wiki:p', title: 'P', anchor_ref: 'wiki:node:p', node_refs: ['wiki:node:p', 'wiki:node:q', 'wiki:node:r'], child_space_refs: [], revision: 1},
    {object: 'node', ref: 'wiki:node:p', title: 'P', revision: 1}, {object: 'node', ref: 'wiki:node:q', title: 'Q', revision: 1, ql: {position: 3, face: 'direct'}},
    {object: 'node', ref: 'wiki:node:r', title: 'R', revision: 1, ql: {position: 2}},
    {object: 'frame', ref: 'wiki:frame:f', revision: 1, constellations: [{anchor_ref: 'wiki:anchor:f', members: [{ref: 'wiki:node:q', position: 5, conjugate: true}, {ref: 'wiki:node:r', position: 0}]}]},
    {object: 'frame', ref: 'wiki:frame:g', revision: 1, constellations: [{anchor_ref: 'wiki:anchor:g', members: [{ref: 'wiki:node:q', position: 1}]}]},
  ]}
  const rows = owners.constellationsOf({registers: [registerOf('central')], standings: {central: projected(registerOf('central'), objects)}}).rows
  assert.deepEqual(owners.constellationNamed(rows, 'wiki:anchor:f').members.map(m => [m.title, m.position, m.face]), [['Q', 5, 'prime'], ['R', 0, null]])
  assert.deepEqual(owners.constellationNamed(rows, 'wiki:anchor:g').members.map(m => [m.title, m.position, m.face]), [['Q', 1, null]],
    'a face goes with the position it was declared for: the frame\'s position takes no face from the node\'s own facet')
  assert.deepEqual(owners.constellationNamed(rows, 'wiki:node:p').members.filter(m => m.position !== null).map(m => [m.title, m.position, m.face]), [['Q', 3, 'direct'], ['R', 2, null]])
})

test('Live: a constellation dropped on a part makes Live\'s clip of it through the set\'s owner, and reads its source back', async () => {
  const transcribe = await import('../src/live/constellationClip.ts')
  const {readJankoWindow} = await import('../src/live/janko/jankoLayout.ts')
  const plain = readJankoWindow(jankoFixture('janko-window-v1.json')).window
  const lived = owners.constellationNamed(ROWS, LIVED)
  const calls = []
  let kept = LIVED
  const owner = {
    named: ref => owners.constellationNamed(ROWS, ref),
    window: async () => plain,
    create: async (path, track, made) => { calls.push({path, track, made}); return {at: {slot: 1}} },
    read: async (path, track, at) => { calls.push({read: {path, track, at}}); return {kind: 'midi', name: 'The lived-in world', source: kept} },
  }
  const maker = transcribe.liveClipMaker('/sets/Song.als', owner)
  assert.equal(maker.accepts, owners.CONSTELLATION_DRAG)
  const answer = await maker.run('als:/sets/Song.als#track/2', LIVED)
  assert.equal(answer.ok, true, answer.error)
  assert.match(answer.note, /The lived-in world/)
  const made = calls[0]
  assert.deepEqual([made.path, made.track], ['/sets/Song.als', 2])
  assert.equal(made.made.source, LIVED, 'the source goes to the set\'s owner with the clip')
  assert.equal(made.made.set.name, lived.title)
  assert.deepEqual(made.made.notes, transcribe.transcribeConstellation(lived, plain).notes, 'its notes are the constellation transcribed')
  assert.equal(made.made.length, transcribe.CLIP_BEATS)
  assert.deepEqual(calls[1].read, {path: '/sets/Song.als', track: 2, at: {slot: 1}}, 'and the clip is read back from the owner where it was made')
  kept = 'wiki:node:central'
  const wrong = await maker.run('als:/sets/Song.als#track/2', LIVED)
  assert.equal(wrong.ok, false)
  assert.match(wrong.error, /reads its source as wiki:node:central/)
  const before = calls.length
  assert.match((await maker.run('als:/other.als#track/0', LIVED)).error, /not a part of the open set/)
  assert.match((await maker.run('als:/sets/Song.als#track/2', 'wiki:anchor:gone')).error, /no constellation the wiki's reading holds/)
  const blind = transcribe.liveClipMaker('/sets/Song.als', {...owner, window: async () => { throw Error('ql music janko window is not installed') }})
  assert.match((await blind.run('als:/sets/Song.als#track/2', LIVED)).error, /Jankó surface.*not installed/)
  assert.equal(calls.length, before, 'a refusal makes nothing')
  assert.equal(transcribe.liveClipMaker(null, owner), null, 'no open set: no maker')
  // The request the kernel's owner takes (kernel lib.rs KernelOp::LiveClipCreate).
  const request = transcribe.liveClipCreateRequest('/sets/Song.als', 'sha256:1', 2, {length: 4, set: {name: 'X'}, notes: [], source: LIVED})
  assert.deepEqual(request, {op: 'live_clip_create', path: '/sets/Song.als', expected_revision: 'sha256:1', track: 2, length: 4, set: {name: 'X'}, notes: [], source: LIVED})
})

// ---------------------------------------------------------------------------------------------------------------- the browser

test('the one browser holds Constellations in every mode, and its preview shows what that mode makes of the selected constellation', async () => {
  const {browserSourcesOf} = await import('../src/shell/modeBrowsers.tsx')
  const {SURF_MODES} = await import('../src/shell/modeGrammar.ts')
  const {MODE_CONSTELLATION_PREVIEWS} = await import('../src/shell/constellationPreviews.tsx')
  const lived = owners.constellationNamed(ROWS, LIVED)
  const drawn = {}
  for (const mode of SURF_MODES) {
    const keys = browserSourcesOf(mode).flatMap(source => source.categories.map(category => `${source.id}:${category.id}`))
    assert.ok(keys.includes(focus.CONSTELLATIONS_CATEGORY), `${mode}: the browser holds the constellations`)
    const Preview = MODE_CONSTELLATION_PREVIEWS[mode]
    assert.ok(Preview, `${mode}: the mode registers its preview`)
    drawn[mode] = renderToStaticMarkup(createElement(Preview, {constellation: lived}))
    assert.match(drawn[mode], /The lived-in world/, `${mode}: the preview names the constellation`)
    assert.match(drawn[mode], new RegExp(`data-preview-mode="${mode}"`))
  }
  assert.match(drawn.base, /What does a lived-in world hold\?/, 'Central: the writing about it opens on its question')
  assert.match(drawn.factory, /A task/, 'Factory: the work it would become')
  assert.match(drawn.expressions, /<svg/, 'Expressions: its symbolic form, drawn')
  assert.match(drawn.techne, /Position 1[\s\S]*The DLW/, 'Technē: its reading through the six positions')
  assert.match(drawn.live, /sound/i, 'Live: what it sounds as')
  assert.equal(new Set(Object.values(drawn)).size, SURF_MODES.length, 'each mode draws its own rendering')
})

// ---------------------------------------------------------------------------------------------------------------- the drop

test('a track that makes clips takes a constellation dropped on it: the Session draws its drop, and a mode with no maker draws none', async () => {
  const {SessionGridView} = await import('../src/frame/tracks/SessionGrid.tsx')
  const {CONSTELLATION_DRAG} = owners
  const base = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 't1', name: 'O-I', kind: 'world'}], clips: []}
  const props = {selection: {select: noop}, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop}
  const made = renderToStaticMarkup(createElement(SessionGridView, {...props, set: {...base, actions: {makeClip: {op: 'the page owner', accepts: CONSTELLATION_DRAG, run: noop}}}}))
  assert.match(made, /data-track="t1"[^>]*data-make-clip="open"/)
  const plain = renderToStaticMarkup(createElement(SessionGridView, {...props, set: base}))
  assert.doesNotMatch(plain, /data-make-clip/)
})

/** A kernel behind the bridge's fetch (FIXTURE, central-person-writes.test.mjs's): files, the source door and the page owner. */
function kernel() {
  const sent = []
  const files = new Map()
  const ok = outcome => ({json: async () => ({ok: true, outcome})})
  const location = path => ({schema: 'central.path-ref/v1', ref: `native:${path}`, root: '/ground', path})
  const TEMPLATE = thingPage({}, '').replace('"documentId":"d1"', '"documentId":null')
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'files_list') {
      const entries = body.path.endsWith('desktop/cradle/documents') ? [{name: 'oi-things.html', kind: 'file', location: location(`${body.path}/oi-things.html`)}]
        : [...files.keys()].filter(path => path.startsWith(`${body.path}/`)).map(path => ({name: path.split('/').pop(), kind: 'file', location: location(path)}))
      return ok({result: 'directory_read', directory: {location: location(body.path), entries}})
    }
    if (body.op === 'file_read') return ok({result: 'file_read', reading: {location: body.location, revision: 'r1', content: TEMPLATE}})
    if (body.op === 'invoke_action' && body.invocation.action === 'projectcentral.source.create') {
      files.set(`Work/O-I/${body.invocation.input.path}`, body.invocation.input.content)
      return ok({result: 'action_dispatched', dispatch: {state: 'invoked', owner_operation: 'projectcentral.source.create', data: {}}})
    }
    if (body.op === 'page' && body.request.operation === 'read') {
      const content = files.get(body.request.location.path)
      if (!content) return {json: async () => ({ok: false, error: 'No such file or directory'})}
      const island = JSON.parse(content.match(/id="ql-doc">([\s\S]*?)<\/script>/)[1])
      return ok({result: 'page_reading', data: {schema: 'oi.page-reading/v1', location: body.request.location, revision: 'r2', form: 'thing', title: island.meta.title, island}})
    }
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, files, fetch}
}
async function withKernel(owner, run) {
  const real = globalThis.fetch
  globalThis.fetch = owner.fetch
  try { return await run() } finally { globalThis.fetch = real }
}

test('Central: a constellation dropped on a world\'s track makes a Thing page of it in that world, whose source reads back from the page owner', async () => {
  const {makePageOf} = await import('../src/central/madeOfConstellation.ts')
  const owner = kernel()
  const world = {ref: OI_SPACE, name: 'O-I', kind: 'project', folder: 'Work/O-I/ProjectCentral/user', project: 'O-I'}
  const receipt = await withKernel(owner, () => makePageOf({kind: 'bridge', url: 'http://kernel.test'}, world, {ref: LIVED, title: 'The lived-in world'}))
  assert.equal(receipt.ok, true, receipt.error)
  assert.match(receipt.note, /The lived-in world/)
  const created = owner.sent.find(body => body.op === 'invoke_action')
  assert.equal(created.invocation.input.project, 'O-I')
  const island = JSON.parse(created.invocation.input.content.match(/id="ql-doc">([\s\S]*?)<\/script>/)[1])
  assert.equal(island.bindings.constellationRef, LIVED, 'the page is made of the constellation from its first write')
  assert.equal(island.bindings.worldRef, OI_SPACE)
  assert.equal(island.meta.title, 'The lived-in world')
  assert.ok(owner.sent.some(body => body.op === 'page' && body.request.operation === 'read'), 'the source is read back from the page owner')
})

test('a mode whose owner cannot make its clip of a constellation yet takes the drop and refuses it in the owner\'s words', async () => {
  const {CLIP_MAKERS_REFUSED, MODE_CLIP_MAKERS, withClipMaker} = await import('../src/frame/tracks/clipMakers.ts')
  for (const [mode, maker] of Object.entries(MODE_CLIP_MAKERS)) {
    assert.equal(maker.accepts, owners.CONSTELLATION_DRAG, `${mode}: its tracks take a constellation`)
    const answer = await maker.run('t1', LIVED)
    assert.equal(answer.ok, false, mode)
    assert.equal(answer.error, CLIP_MAKERS_REFUSED[mode])
    assert.match(answer.error, /missing op/, `${mode}: the refusal names the missing operation`)
  }
  // REPLACED (O-I #768, part two): Factory and Expressions refused the drop naming AIKit's task_create and the knowledge_whole resolver; their
  // sets bring their own makers now (agent/clipBinding.ts taskMaker on useFactoryTracks.ts; components/expressions/clip/clipBinding.ts
  // sceneMaker on modeTracks.ts expressionsTracks), as Central's does.
  // REPLACED (O-I #768, part three): Technē refused naming event_create on the temporal events projection; its set brings its own maker now
  // (techne/clipBinding.ts techneEventMaker on useTechneTracks.ts), which keeps the event in the World's walk Expression.
  // REPLACED (O-I #768, part three): Live refused naming live_clip_create on live-set; its set brings its own maker now
  // (live/constellationClip.ts liveClipMaker on modeTracks.ts liveTracks), so no mode refuses.
  assert.deepEqual(Object.keys(MODE_CLIP_MAKERS).sort(), [], 'every mode brings its own maker on its set')
  const {liveTracks} = await import('../src/frame/tracks/modeTracks.ts')
  const liveSet = liveTracks({path: '/sets/Song.als', tempo_bpm: 120, scene_count: 2, tracks: [{name: 'Keys', kind: 'midi', devices: []}]}, null)
  assert.equal(liveSet.actions?.makeClip?.accepts, owners.CONSTELLATION_DRAG, 'Live\'s set takes a constellation dropped on a part')
  assert.match(liveSet.actions.makeClip.op, /live_clip_create/)
  const own = {op: 'own', accepts: owners.CONSTELLATION_DRAG, run: noop}
  const set = {columns: [], tracks: [], clips: [], actions: {makeClip: own}}
  assert.equal(withClipMaker(set, MODE_CLIP_MAKERS.live), set, 'a set that brings its own maker keeps it')
})

/** AIKit's session settings behind the bridge's fetch (FIXTURE): one session's reading, written against its revision (the owner's CAS) and
 * read back; a write answers the owner's refusal when the revision moved. */
function settingsKernel(reading) {
  const sent = []
  let held = reading
  const answer = data => ({json: async () => ({ok: true, outcome: {result: 'encounter_session_settings_reading', data}})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op !== 'encounter_session_settings') return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
    if (!body.request) return answer(held)
    if (body.expected_revision !== held.revision) return {json: async () => ({ok: false, error: 'Session settings revision conflict; read the current settings and write again'})}
    const source = body.request.task.set.source
    held = settingsOf(source, {revision: 'session-settings/02'})
    return answer(held)
  }
  return {sent, fetch}
}

test('Factory: a constellation dropped on a session\'s track makes the session\'s task of it — AIKit keeps it as the task\'s source and reads it back', async () => {
  const aikit = settingsKernel(settingsOf(null))
  const session = {sessionRef: 'ses-214', label: 'Fizz'}
  const receipt = await withKernel(aikit, () => factory.makeTaskOf(BRIDGE, session, {ref: LIVED, title: 'The lived-in world'}))
  assert.equal(receipt.ok, true, receipt.error)
  assert.match(receipt.note, /The lived-in world/)
  const writes = aikit.sent.filter(body => body.request)
  assert.deepEqual(writes.map(body => [body.request, body.expected_revision]), [[{task: {task_ref: 'task:fixtures', set: {source: LIVED}}}, 'session-settings/01']],
    'one write: the bound task\'s source, against the revision read')
  assert.ok(aikit.sent.indexOf(writes[0]) < aikit.sent.length - 1 && !aikit.sent.at(-1).request, 'the source is read back from AIKit after the write')
  // REPLACED (O-I #768, a fresh task): a session that held no task was refused outright; it is given a new task now (the next test). This
  // one names no agent and has no other session to take a task's basis from, so it is still refused in words and nothing is written.
  const idle = settingsKernel(settingsOf(null, {task: false}))
  const untasked = await withKernel(idle, () => factory.makeTaskOf(BRIDGE, session, {ref: LIVED, title: 'The lived-in world'}))
  assert.equal(untasked.ok, false)
  assert.match(untasked.error, /Fizz holds no task/)
  assert.equal(idle.sent.some(body => body.request), false, 'a session with no task is written nothing')
  // The maker the Factory set carries: a session's track takes the drop; anything else, or a ref the wiki does not hold, is refused in words.
  const maker = factory.taskMaker(BRIDGE, [track], ref => owners.constellationNamed(ROWS, ref))
  assert.equal(maker.accepts, owners.CONSTELLATION_DRAG)
  assert.match((await maker.run('elsewhere', LIVED)).error, /session's track/)
  assert.match((await maker.run(trackKey(track), 'wiki:anchor:gone')).error, /no constellation the wiki/)
  const dropped = await withKernel(settingsKernel(settingsOf(null)), () => maker.run(trackKey(track), LIVED))
  assert.equal(dropped.ok, true, dropped.error)
  // The Factory set the pane draws carries it (useFactoryTracks.ts factoryTrackSet): its tracks take the drop.
  const {factoryTrackSet} = await import('../src/frame/tracks/useFactoryTracks.ts')
  const drawn = factoryTrackSet({columns: [], tracks: [{id: trackKey(track), name: 'Fizz'}], clips: []}, null, null, BRIDGE, [track])
  assert.equal(drawn.actions.makeClip.accepts, owners.CONSTELLATION_DRAG)
  assert.match(drawn.actions.makeClip.op, /AIKit encounter-session-settings/)
})

/** A session's prepared task as AIKit records it (aikit.encounter-task/v1, ai-kit encounter_task.rs TaskRecord): the request it was made with
 * — its Central placement, the protocol child that works it, its working directory, its Workcell boundary and its authority — and its
 * preparation complete (`ready`). FIXTURE shaped as the owner's record. */
const PREPARED = {schema: 'aikit.encounter-task/v1', revision: 'task-binding/01JBASIS', ready: true, agency_revision: 'rev/1',
  request: {central: {ctrl_bin: '/opt/oi/bin/ctrl', central_root: '/world', project: 'O-I', task_ref: 'task:fixtures', purpose: 'correlate occurrences',
    participant_refs: ['agent:fizz'], source_refs: ['source/plan'], workcell_ref: 'workcell:env-2'},
  provider: {id: 'task-child', label: 'Task child', protocol: 'acp', argv: ['python3', '-u', 'provider.py']},
  cwd: '/world/Work/O-I/lane', selected_directories: ['/world/Work/O-I/lane'], additional_protected_directories: ['/world/Work/O-I/lane/.git'],
  workcell_boundary_bin: '/opt/oi/bin/workcell-write-boundary', prepared_run_scope: {run_slug: 'a-run', expected_demand_digest: 'sha256:x'},
  authority_ref: 'authority:owner', material_host: null}}

/** AIKit behind the bridge for a Factory of several sessions (FIXTURE): each session's settings, read one at a time or as a list; each
 * one's task record; and its task creation (`encounter_task_configure`), which binds the new task to the session, its source the request's —
 * so the session's settings then read it — or refuses in AIKit's words. */
function factoryKernel({tasks = {'ses-214': PREPARED}, refuse = null} = {}) {
  const sent = []
  const held = new Map(Object.keys({'ses-214': 1, 'ses-215': 1}).map(session => [session, {...settingsOf(null, {task: Boolean(tasks[session])}), agent_session: session}]))
  const records = new Map(Object.entries(tasks))
  const ok = (result, data) => ({json: async () => ({ok: true, outcome: {result, data}})})
  const fetch = async (_url, init) => {
    const body = JSON.parse(init.body)
    sent.push(body)
    if (body.op === 'encounter_session_settings' && !body.request) return ok('encounter_session_settings_reading', held.get(body.agent_session))
    if (body.op === 'encounter_session_settings_list') return ok('encounter_session_settings_list_reading',
      {schema: 'aikit.encounter-session-settings-list/v1', readings: body.agent_sessions.map(session => held.get(session) ?? {agent_session: session, refused: 'not attached'})})
    if (body.op === 'encounter_task_read') return ok('encounter_task_reading', records.get(body.agent_session) ?? null)
    if (body.op === 'encounter_task_configure') {
      if (refuse) return {json: async () => ({ok: false, error: refuse})}
      const record = {schema: 'aikit.encounter-task/v1', revision: 'task-binding/01JNEW', ready: true, request: body.request}
      records.set(body.agent_session, record)
      const reading = settingsOf(body.request.source ?? null, {revision: 'session-settings/02'})
      held.set(body.agent_session, {...reading, agent_session: body.agent_session,
        task: {...reading.task, task_ref: body.request.central.task_ref, name: body.request.central.purpose, set: []}})
      return ok('encounter_task_reading', record)
    }
    return {json: async () => ({ok: false, error: `the fixture kernel answers no ${body.op}`})}
  }
  return {sent, fetch}
}

test('Factory: a constellation dropped on a session that holds no task makes a new task of it through AIKit\'s task creation, its source read back from AIKit', async () => {
  const idle = {...track, sessionRef: 'ses-215', agentRef: 'agent:buzz', agentName: 'Buzz', tasks: []}
  const maker = factory.taskMaker(BRIDGE, [track, idle], ref => owners.constellationNamed(ROWS, ref))
  assert.match(maker.op, /encounter-task-configure/, 'the maker names AIKit\'s task creation beside the settings write')
  const aikit = factoryKernel()
  const made = await withKernel(aikit, () => maker.run(trackKey(idle), LIVED))
  assert.equal(made.ok, true, made.error)
  assert.match(made.note, /The lived-in world/)
  const configured = aikit.sent.filter(body => body.op === 'encounter_task_configure')
  assert.equal(configured.length, 1, 'one task is made')
  const [{agent_session, project, request, expected_revision}] = configured
  assert.equal(agent_session, 'ses-215')
  assert.equal(project, 'O-I')
  assert.equal(expected_revision, undefined, 'a session that holds no task has no task revision to write against')
  // The new task takes the project's prepared basis from the task a session of the project holds — its Central, protocol child, working
  // directory, Workcell boundary and authority, each the owner's — and is its own: its ref, its purpose the constellation's name, its agent
  // the session's, its source the constellation. Nothing of the other task's own run, NOW relations or sources travels.
  assert.match(request.central.task_ref, /^task:the-lived-in-world-[0-9a-z]+$/)
  assert.deepEqual(request, {
    central: {ctrl_bin: '/opt/oi/bin/ctrl', central_root: '/world', project: 'O-I', task_ref: request.central.task_ref, purpose: 'The lived-in world',
      participant_refs: ['agent:buzz'], source_refs: []},
    provider: PREPARED.request.provider, cwd: '/world/Work/O-I/lane', selected_directories: ['/world/Work/O-I/lane'],
    additional_protected_directories: ['/world/Work/O-I/lane/.git'], workcell_boundary_bin: '/opt/oi/bin/workcell-write-boundary',
    authority_ref: 'authority:owner', source: LIVED})
  const at = aikit.sent.indexOf(configured[0])
  assert.ok(aikit.sent.slice(at + 1).some(body => body.op === 'encounter_session_settings' && body.agent_session === 'ses-215' && !body.request),
    'the task\'s source is read back from AIKit after it is made')
  // On AIKit's own record (REAL: the kernel's owner-route fixture, a drop through the real kernel, AIKit, Central and Workcell boundary): the
  // request made from a real prepared task is the one AIKit took and made a task of, but for the moment in the new task's ref.
  const real = JSON.parse(await readFile(new URL('../../../../desktop/cradle/kernel/tests/fixtures/owner-routes/aikit-task-configure-2026-10-28.json', import.meta.url), 'utf8'))
  const onReal = factoryKernel({tasks: {'ses-214': real.basis}})
  const realMaker = factory.taskMaker(BRIDGE, [track, {...idle, agentRef: real.request.request.central.participant_refs[0]}], ref => owners.constellationNamed(ROWS, ref))
  assert.equal((await withKernel(onReal, () => realMaker.run(trackKey(idle), LIVED))).ok, true)
  const sentToReal = onReal.sent.find(body => body.op === 'encounter_task_configure').request
  assert.deepEqual(sentToReal, {...real.request.request, central: {...real.request.request.central, task_ref: sentToReal.central.task_ref}})
  assert.equal(real.answer.ready, true, 'AIKit prepared the task it was asked to make')
  assert.equal(real.settings_after.task.source, LIVED, 'and its settings read the constellation back as the task\'s source')
  // Refusals, each in words: AIKit's own; no session of the project holds a prepared task; a session's task still preparing is no basis;
  // a session that names no agent.
  const refused = await withKernel(factoryKernel({refuse: 'Current Agency does not authorise this task, authority or participant'}),
    () => maker.run(trackKey(idle), LIVED))
  assert.equal(refused.ok, false)
  assert.match(refused.error, /Current Agency does not authorise this task, authority or participant/)
  const bare = factoryKernel({tasks: {}})
  const none = await withKernel(bare, () => maker.run(trackKey(idle), LIVED))
  assert.equal(none.ok, false)
  assert.match(none.error, /Buzz holds no task/)
  assert.match(none.error, /encounter-task-configure/)
  assert.equal(bare.sent.some(body => body.op === 'encounter_task_configure'), false, 'without a basis nothing is asked to make a task')
  const pending = await withKernel(factoryKernel({tasks: {'ses-214': {...PREPARED, ready: false}}}), () => maker.run(trackKey(idle), LIVED))
  assert.equal(pending.ok, false, 'a task still preparing gives no basis')
  const nameless = factory.taskMaker(BRIDGE, [track, {...idle, agentRef: null}], ref => owners.constellationNamed(ROWS, ref))
  const anonymous = await withKernel(factoryKernel(), () => nameless.run(trackKey(idle), LIVED))
  assert.equal(anonymous.ok, false)
  assert.match(anonymous.error, /names no agent/)
})

/** The open Expression's owner behind the composition's actions (FIXTURE, the request door createNativeContentActions answers through):
 * an added scene stands presented, its body set on the basis the add answered, and the owner's read discloses that body. */
function expressionOwner({refuseBody = null, stay = false} = {}) {
  const requests = []
  const EXPR = 'expression:open'
  // Each scene as the owner's inventory lists it (expressions-boundary scenes.ts): its title, its pacing and whether it holds material.
  const row = (scene_ref, title) => ({scene_ref, title, native_title: title, snapshot: {duration: 8}, working: {duration: 8}, material: {available: true}})
  let scenes = [row(`${EXPR}:scene:main`, 'Main')], presented = scenes[0], revision = 4, body = null
  const reading = () => ({basis: {expression_ref: EXPR, revision, scene_ref: presented.scene_ref, authored_revision: 0},
    nativeScene: {scene_ref: presented.scene_ref, body: presented.body ?? null, triggers: []},
    nativeSelection: {scene_ref: presented.scene_ref}, scenes: {basis: {expression_ref: EXPR, revision}, scenes, loop: false, timing: {saved: {available: true}}},
    playback: {scene_ref: presented.scene_ref, intent_epoch: revision}, scene: {id: presented.scene_ref, name: presented.title, entities: [], morph: {dwell: 0.5}},
    entityOccurrences: {}, selection: {entity_ids: [], step_id: null}, history: {}, standing: {busy: false, pending: false, notice: null}})
  const request = async sent => {
    requests.push(sent)
    if (sent.operation === 'read') return {ok: true, reading: reading()}
    if (sent.operation === 'scene-edit' && sent.intent.operation === 'add') {
      const added = row(`${EXPR}:scene:${scenes.length + 1}`, sent.intent.title)
      scenes = [...scenes, added]; if (!stay) presented = added; revision++
      return {ok: true, reading: reading()}
    }
    if (sent.operation === 'scene-edit' && sent.intent.operation === 'remove') {
      scenes = scenes.filter(row => row.scene_ref !== sent.intent.scene_ref); presented = scenes[0]; revision++
      return {ok: true, reading: reading()}
    }
    if (sent.operation === 'scene-material') {
      if (refuseBody) return {ok: false, error: refuseBody}
      if (sent.basis.scene_ref !== presented.scene_ref || sent.basis.revision !== revision) return {ok: false, error: 'The captured native Expression revision changed; nothing was written'}
      body = {carrier: sent.intent.body.carrier, subject_ref: sent.intent.body.subject_ref, native_owner: 'wiki', presentation: 'preview'}
      presented.body = body; revision++
      return {ok: true, reading: reading()}
    }
    return {ok: false, error: `the fixture owner answers no ${sent.operation}`}
  }
  return {requests, request, reading, scenes: () => scenes}
}

test('Expressions: a constellation dropped on a track adds a scene whose body is the constellation, through the Expression owner\'s scene write, read back', async () => {
  const {createNativeContentActions, readNativeExpressionsContent} = await import('../src/shell/nativeContent.ts')
  const owner = expressionOwner()
  const actions = createNativeContentActions(readNativeExpressionsContent(owner.reading()), {request: owner.request})
  const receipt = await expressions.makeSceneOf(actions, {ref: LIVED, title: 'The lived-in world'})
  assert.equal(receipt.ok, true, receipt.error)
  assert.match(receipt.note, /The lived-in world/)
  assert.deepEqual(owner.requests.map(row => row.operation === 'scene-edit' ? `scene-edit ${row.intent.operation}` : row.operation),
    ['scene-edit add', 'scene-material', 'read'], 'the owner\'s scene write, then the body on the scene it added, then its read')
  assert.equal(owner.requests[0].intent.title, 'The lived-in world', 'the scene takes the constellation\'s name')
  const material = owner.requests[1]
  assert.deepEqual(material.intent, {family: 'body', body: {operation: 'set', carrier: 'knowledge_whole', subject_ref: LIVED}})
  assert.equal(material.basis.scene_ref, 'expression:open:scene:2', 'the body is set on the scene the add made, at the revision it answered')
  assert.equal(expressions.sceneSourceOf(owner.reading().nativeScene).ref, LIVED, 'the scene\'s source reads back from the Expression\'s owner')
  // A body the owner refuses leaves nothing half-made: the scene the drop added is removed, and the receipt says why.
  const refusing = expressionOwner({refuseBody: 'The wiki reading of wiki:anchor:lived-in is not loaded'})
  const failed = await expressions.makeSceneOf(createNativeContentActions(readNativeExpressionsContent(refusing.reading()), {request: refusing.request}),
    {ref: LIVED, title: 'The lived-in world'})
  assert.equal(failed.ok, false)
  assert.match(failed.error, /not loaded[\s\S]*removed/)
  assert.deepEqual(refusing.scenes().map(row => row.scene_ref), ['expression:open:scene:main'])
  // An owner that keeps the old scene presented after the add gets no body set on that scene.
  const staying = expressionOwner({stay: true})
  const kept = await expressions.makeSceneOf(createNativeContentActions(readNativeExpressionsContent(staying.reading()), {request: staying.request}),
    {ref: LIVED, title: 'The lived-in world'})
  assert.match(kept.error, /presents the scene it had/)
  assert.equal(staying.requests.some(row => row.operation === 'scene-material'), false, 'the scene the gesture began from is never given the body')
  // The maker the Expressions set carries: an open composition takes the drop; with none open, or a ref the wiki does not hold, it refuses.
  const source = {owner: 'expressions', content: null, actions, isPresented: () => true}
  const maker = expressions.sceneMaker(source, ref => owners.constellationNamed(ROWS, ref))
  assert.equal(maker.accepts, owners.CONSTELLATION_DRAG)
  assert.match((await maker.run('expression:open', 'wiki:anchor:gone')).error, /no constellation the wiki/)
  assert.match((await expressions.sceneMaker(undefined).run('expression:open', LIVED)).error, /No Expression is open/)
  // The Expressions set the pane draws carries it (modeTracks.ts expressionsTracks): the open Expression's tracks take the drop.
  const {expressionsTracks} = await import('../src/frame/tracks/modeTracks.ts')
  const content = readNativeExpressionsContent(expressionOwner().reading())
  const drawn = expressionsTracks({set: null, document: null, native: content, session: {...source, content}})
  assert.equal(drawn.actions.makeClip.accepts, owners.CONSTELLATION_DRAG)
  assert.match(drawn.actions.makeClip.op, /scene write/)
})

test('the frame\'s knowledge whole is the wiki\'s own reading of the constellation\'s whole, from the one projection, or a refusal in words', async () => {
  const {knowledgeWholeOf, answerKnowledgeWhole} = await import('../src/native/wikiSubjectStanding.ts')
  const whole = knowledgeWholeOf(STATE, LIVED)
  assert.equal(whole.requested_ref, LIVED)
  assert.equal(whole.ref, LIVED)
  assert.equal(whole.native_owner, 'wiki')
  assert.equal(whole.title, 'The lived-in world')
  assert.equal(whole.register, 'O-I')
  assert.deepEqual(whole.reading, {ref: LIVED, revision: 'r1', availability: 'available'})
  assert.ok(whole.provenance.some(row => row.ref === 'wiki:wiki.json' && row.revision === 'r1'), 'its provenance names the wiki it was read from')
  assert.equal(knowledgeWholeOf(STATE, OI_ROOT).title, 'O-I', 'a space is a constellation too')
  assert.equal(knowledgeWholeOf(STATE, 'wiki:anchor:gone'), null)
  const loaded = {loadRegisters: async () => {}, wholeOf: ref => knowledgeWholeOf(STATE, ref), unreadRegisters: () => []}
  assert.deepEqual(await answerKnowledgeWhole({ref: LIVED}, loaded), whole)
  await assert.rejects(answerKnowledgeWhole({ref: 'wiki:anchor:gone'}, loaded), /no constellation the wiki/)
  await assert.rejects(answerKnowledgeWhole({ref: LIVED}, {...loaded, loadRegisters: async () => { throw new Error('no World') }}), /not loaded[\s\S]*no World/)
})

test('the clip\'s menu carries Show in Browser (manual §10.9): it runs through the clip\'s Clip view, and a clip made of none says why it is dark', async () => {
  const acts = await import('../src/frame/menu/objectActions.ts')
  resetViewHolds()
  const set = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 't1', name: 'O-I', kind: 'world'}], clips: [{id: 'page:lived', trackId: 't1', columnId: 'r1', label: 'The lived-in world'}], actions: {owner: 'Central'}}
  const written = []
  const context = binding => ({view: 'session', binding, press: (_key, _what, run) => run(), rename: noop, writeClip: async (id, key, value) => { written.push([id, key]); return {ok: true} }})
  const made = central.centralClipBinding({ref: 'page:lived', values: central.fileReading(thingPage({constellationRef: LIVED}), 'note').values}, {constellations: ROWS})
  const item = acts.objectMenu({kind: 'clip', id: 'page:lived', trackId: 't1', name: 'The lived-in world'}, set, context(made)).find(entry => entry.id === 'show-in-browser')
  assert.ok(item, 'the clip\'s menu lists Show in Browser')
  assert.equal(item.disabled, undefined)
  await item.onSelect()
  assert.deepEqual(written, [['page:lived', MADE_OF.show]], 'it is the Clip panel\'s own Show in Browser, through the clip\'s binding')
  const plain = central.centralClipBinding({ref: 'page:lived', values: central.fileReading(thingPage({}), 'note').values}, {constellations: ROWS})
  const dark = acts.objectMenu({kind: 'clip', id: 'page:lived', trackId: 't1', name: 'x'}, set, context(plain)).find(entry => entry.id === 'show-in-browser')
  assert.equal(dark.disabled, true); assert.match(dark.why, /made of no constellation/)
})
