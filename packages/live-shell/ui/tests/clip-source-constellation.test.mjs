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

const T = (h, m) => Date.UTC(2026, 9, 8, h, m)
const track = {sessionRef: 'ses-214', purpose: 'correlate occurrences', agentRef: 'agent:fizz', agentName: 'Fizz', agentAccepted: true, spaceRef: 'space:lead', spaceLabel: null,
  depth: 0, parentRef: null, group: false, memberRefs: [], needle: null, telemetryOn: false, budget: {used: 2, max: 12}, disclosure: null,
  tasks: [{n: 1, title: 'correlate occurrences', state: 'running', startUnixMs: T(13, 41), lastActivityUnixMs: T(14, 24), softStop: false, disclosure: null}]}

test('Factory and Live: no owner keeps a task\'s or a Live clip\'s source yet — the key stands absent and Show in Browser names the missing operation', () => {
  resetViewHolds()
  const task = factory.factoryClipBinding({ref: `${trackKey(track)}#task/1`, tracks: [track], events: []})
  assert.equal(MADE_OF.name in task.values, false)
  assert.match(task.standing[MADE_OF.show].disabled, /missing op: .*task_source.*AIKit/)
  for (const wiring of [factory.factoryWiring({sessionRef: 'ses-214', n: 1}), live.LIVE_WIRING]) {
    assert.ok(wiring.absent[MADE_OF.name], 'the source is absent, with why')
    assert.match(wiring.refused[MADE_OF.show], /missing op/)
  }
  assert.match(live.LIVE_WIRING.refused[MADE_OF.show], /live_clip_source.*live-set/)
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
  assert.deepEqual(Object.keys(MODE_CLIP_MAKERS).sort(), ['expressions', 'factory', 'live', 'techne'], 'Central brings its own maker on its set')
  const own = {op: 'own', accepts: owners.CONSTELLATION_DRAG, run: noop}
  const set = {columns: [], tracks: [], clips: [], actions: {makeClip: own}}
  assert.equal(withClipMaker(set, MODE_CLIP_MAKERS.live), set, 'a set that brings its own maker keeps it')
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
