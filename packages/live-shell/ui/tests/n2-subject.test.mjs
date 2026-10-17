// N2: a World subject opens as the Scene that carries it, and the research instruments read that Scene (FOUNDATION §3 N2; manual §8
// "Find a subject and gather what surrounds it"; DEVICE-SEMANTICS-LOCK §0 "Technē instruments already act on Expressions", law 4).
//
// Channels (each claim below is carried by exactly one):
// - REAL OWNER: the Scenes are the owner's own projection (techne/wikiExpression.ts `projectWikiExpression`) over a small ready wiki
//   reading, and the rows are the owner's own reverse query (techne/wikiProjectionStore.ts `projectedSubjectStandings`). The people and
//   nodes in the reading are a fixture's; the shape of the projection and of the rows is the product's.
// - REAL OWNER STORE: the ask lands in the owner's one projection state (`requestWikiSelection`, `consumeWikiSelectionRequest`).
// - SOURCE TEXT: the receiving door in the candidate (panels/expressions.tsx), the owner's hand-off words (knowledge/techneHandoff.ts), and
//   the frame's Scene requirement are read and held to what the module assumes.
// No computer-use pass, no browser, no kernel: whether the frame shows the opened Scene on screen is not covered here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
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

globalThis.window = new EventTarget()

const {resolveSubject, openSubjectScene, sceneChoicesOf, HOSTED_WORDS, UNSTOOD_WORDS} = await import('../src/techne/subject/subjectScenes.ts')
const {openWorldSubject, openChosenScene, liveSubjectSource, TECHNE_EXAMINE_EVENT} = await import('../src/techne/subject/openSubject.ts')
const {projectWikiExpression} = await import('../../../../desktop/cradle/src/techne/wikiExpression.ts')
const {projectedSubjectStandings, wikiProjectionOf, getWikiProjectionState, consumeWikiSelectionRequest} = await import('../../../../desktop/cradle/src/techne/wikiProjectionStore.ts')

// ── the owner's projection over a small wiki: one space (Home: a, b) and one frame constellation (anchor c: a, d) ───────────────────

const NODES = ['a', 'b', 'c', 'd', 'e']
const ref = name => `wiki:node:${name}`
const reading = {
  state: 'ready',
  register: {key: 'central', title: 'Central'},
  wiki: {
    state: 'ready',
    nodes: NODES.map(name => ({ref: ref(name), title: `Node ${name}`, revision: 1})),
    spaces: [{ref: 'wiki:central:root', title: 'Home', node_refs: [ref('a'), ref('b')], revision: 1}],
    constellations: [{anchor_ref: ref('c'), members: [{ref: ref('a')}, {ref: ref('d')}], frame_ref: 'wiki:frame:1', frame_revision: 1, title: 'Gathered'}],
  },
  wikiBasis: {path: 'Control/agents/wiki/wiki.json', revision: '1', location: {ref: 'wiki:file', path: 'Control/agents/wiki/wiki.json'}},
  relations: {state: 'unavailable', focusRef: 'wiki:central:root', reason: 'no relations read in this fixture'},
}
const projection = projectWikiExpression(reading)
const standings = {central: {phase: 'projected', reading, projection}}
const spaceScene = projection.constellations.find(row => row.kind === 'space').sceneRef
const frameScene = projection.constellations.find(row => row.kind === 'frame').sceneRef

/** A source over the owner's real projection and real reverse query; the acts are recorded in the order they happen. */
function source({unread = [], loadFails = null, state = standings} = {}) {
  const acts = []
  return {
    acts,
    get loads() { return acts.filter(act => act === 'load').length },
    async loadRegisters() { acts.push('load'); if (loadFails) throw Error(loadFails) },
    unreadRegisters: () => unread,
    standingsOf: subjectRef => projectedSubjectStandings(state, subjectRef),
    projectionOf: key => wikiProjectionOf(state[key]),
    ask: request => acts.push(['ask', request]),
    present: () => acts.push('present'),
  }
}

test('fixture: the owner projects the register as one Expression whose Scenes are the space, the frame constellation and an overview', () => {
  assert.equal(projection.constellations.length, 2)
  assert.ok(spaceScene && frameScene && spaceScene !== frameScene)
  assert.ok(projection.overviewSceneRef && ![spaceScene, frameScene].includes(projection.overviewSceneRef))
  assert.deepEqual(new Set(projection.document.scenes.map(scene => scene.scene_ref)), new Set([spaceScene, frameScene, projection.overviewSceneRef]))
})

test('a subject that is a member of one constellation resolves to that Scene and its own entity', async () => {
  const found = await resolveSubject({ref: ref('b'), title: 'Node b'}, source())
  assert.equal(found.state, 'standing')
  assert.equal(found.scene.scene_ref, spaceScene)
  assert.equal(found.scene.registerKey, 'central')
  assert.equal(found.scene.expression_ref, projection.document.expression_ref)
  const member = projection.constellations.find(row => row.sceneRef === spaceScene).members.find(row => row.subjectRef === ref('b'))
  assert.equal(found.scene.entity_ref, member.entityRef, 'the entity is the owner\'s occurrence of the subject in that Scene')
  assert.equal(found.scene.whole, false)
  assert.equal(found.scene.overview, false)
  assert.deepEqual(found.others, [])
})

test('a subject in two constellations opens in the first in the owner\'s order and keeps the other; nothing is dropped', async () => {
  const rows = projectedSubjectStandings(standings, ref('a'))
  const found = await resolveSubject({ref: ref('a')}, source())
  assert.equal(found.state, 'standing')
  const scenes = [found.scene, ...found.others].map(scene => scene.scene_ref)
  assert.deepEqual(new Set(scenes), new Set(rows.map(row => row.scene_ref)), 'every Scene the owner\'s reverse query returned is either chosen or kept')
  assert.ok(scenes.includes(spaceScene) && scenes.includes(frameScene))
  assert.equal(found.scene.scene_ref, rows.find(row => [spaceScene, frameScene].includes(row.scene_ref)).scene_ref, 'the first member Scene in the owner\'s order')
})

test('a constellation\'s own subject opens that constellation whole, not the overview that also stands it', async () => {
  const frameRows = projectedSubjectStandings(standings, ref('c'))
  assert.ok(frameRows.some(row => row.scene_ref === projection.overviewSceneRef), 'the owner\'s overview stands the whole too (fixture check)')
  const found = await resolveSubject({ref: ref('c')}, source())
  assert.equal(found.state, 'standing')
  assert.equal(found.scene.scene_ref, frameScene)
  assert.equal(found.scene.entity_ref, null, 'the Scene itself is the subject')
  assert.equal(found.scene.whole, true)
  assert.ok(found.others.every(scene => scene.scene_ref !== frameScene), 'the overview is kept as a further Scene, ranked last')
  const space = await resolveSubject({ref: 'wiki:central:root'}, source())
  assert.equal(space.state, 'standing')
  assert.equal(space.scene.scene_ref, spaceScene)
  assert.equal(space.scene.whole, true)
})

test('a subject only the overview stands is opened there and said to be the overview', () => {
  const wholeRow = projectedSubjectStandings(standings, ref('c')).filter(row => row.scene_ref === projection.overviewSceneRef)
  const choices = sceneChoicesOf(ref('c'), wholeRow, key => wikiProjectionOf(standings[key]))
  assert.equal(choices.length, 1)
  assert.equal(choices[0].overview, true)
  assert.equal(choices[0].whole, false)
})

test('a subject no standing carries is a named absence in the owner\'s words, and the search is said to be partial when a register was unread', async () => {
  const none = await resolveSubject({ref: 'wiki:node:nowhere'}, source())
  assert.deepEqual(none, {state: 'absent', why: 'unstood', reason: UNSTOOD_WORDS})
  const partial = await resolveSubject({ref: ref('e')}, source({unread: [{key: 'O-I', reason: 'no wiki file'}]}))
  assert.equal(partial.state, 'absent')
  assert.equal(partial.why, 'unstood')
  assert.ok(partial.reason.startsWith(UNSTOOD_WORDS))
  assert.match(partial.reason, /O-I could not be read \(no wiki file\)/)
})

test('the absences that need no owner read ask the owner nothing', async () => {
  const hosted = source()
  assert.deepEqual(await resolveSubject({ref: 'world:alpha/node', native_owner: 'shared-field'}, hosted), {state: 'absent', why: 'hosted', reason: HOSTED_WORDS})
  const blank = source()
  const named = await resolveSubject({ref: '   '}, blank)
  assert.equal(named.state, 'absent')
  assert.equal(named.why, 'no-ref')
  assert.deepEqual([hosted.loads, blank.loads], [0, 0], 'no register is loaded for a subject that cannot stand in one')
  const wiki = source()
  assert.equal((await resolveSubject({ref: ref('b'), native_owner: 'wiki'}, wiki)).state, 'standing', 'a wiki-owned subject is not hosted')
})

test('a register load that fails is named, with its cause, and nothing is asked', async () => {
  const failing = source({loadFails: 'the owner refused the World'})
  const found = await resolveSubject({ref: ref('b')}, failing)
  assert.equal(found.state, 'absent')
  assert.equal(found.why, 'not-loaded')
  assert.match(found.reason, /not read: the owner refused the World/)
  const opened = await openWorldSubject({ref: ref('b')}, failing)
  assert.equal(opened.state, 'absent')
  assert.ok(failing.acts.every(act => act === 'load'))
})

test('opening posts the owner\'s selection ask, then presents Technē, in that order', async () => {
  const held = source()
  const opened = await openWorldSubject({ref: ref('b'), title: 'The b node'}, held)
  assert.equal(opened.state, 'asked')
  assert.equal(opened.scene.scene_ref, spaceScene)
  const [load, ask, present] = held.acts
  assert.equal(load, 'load')
  assert.equal(ask[0], 'ask')
  assert.equal(present, 'present')
  assert.equal(held.acts.length, 3)
  assert.deepEqual(ask[1], {
    registerKey: 'central', sceneRef: spaceScene, entityRef: opened.scene.entity_ref, subjectRef: ref('b'), title: 'The b node', origin: 'external',
  })
})

test('a constellation opened whole asks for the Canvas, as the owner\'s hand-off does; a member asks for no lens', async () => {
  const whole = source()
  await openWorldSubject({ref: ref('c')}, whole)
  const ask = whole.acts.find(act => Array.isArray(act))[1]
  assert.equal(ask.lens, 'canvas')
  assert.equal(ask.entityRef, null)
  assert.equal(ask.sceneRef, frameScene)
  assert.equal(ask.title, 'Gathered', 'no title given: the Scene\'s own title')
  const member = source()
  await openWorldSubject({ref: ref('d')}, member)
  assert.equal('lens' in member.acts.find(act => Array.isArray(act))[1], false)
})

test('a Scene chosen from the others is opened by the same two acts', async () => {
  const held = source()
  const opened = await openWorldSubject({ref: ref('a'), title: 'Node a'}, held)
  assert.equal(opened.state, 'asked')
  assert.ok(opened.others.length >= 1)
  const other = opened.others[0]
  const before = held.acts.length
  openChosenScene(other, 'Node a', held)
  assert.equal(held.acts.length, before + 2)
  assert.equal(held.acts.at(-2)[1].sceneRef, other.scene_ref)
  assert.equal(held.acts.at(-1), 'present')
  openSubjectScene(other, undefined, held)
  assert.equal(held.acts.at(-2)[1].title, other.scene_title)
})

test('the live source posts into the owner\'s one projection state and enters Technē through the owner\'s window event', () => {
  const heard = []
  window.addEventListener(TECHNE_EXAMINE_EVENT, event => heard.push(event.type))
  const before = getWikiProjectionState().request?.seq ?? 0
  liveSubjectSource.ask({registerKey: 'central', sceneRef: spaceScene, entityRef: null, subjectRef: ref('b'), title: 'Node b', origin: 'external'})
  const request = consumeWikiSelectionRequest()
  assert.equal(request.sceneRef, spaceScene)
  assert.equal(request.origin, 'external')
  assert.equal(request.seq, before + 1)
  assert.equal(getWikiProjectionState().request, null, 'the navigator consumes it once')
  liveSubjectSource.present()
  assert.deepEqual(heard, ['oi:epi-examine'])
  assert.equal(liveSubjectSource.projectionOf('no-such-register'), undefined)
})

// ── the decision's anchors, in source ──────────────────────────────────────────────────────────────────────────────────────────────

const text = async path => readFile(new URL(path, import.meta.url), 'utf8')

test('the candidate answers the hop and consumes the ask; the owner\'s hand-off dispatches the same event and says the same words', async () => {
  const panel = await text('../src/panels/expressions.tsx')
  assert.match(panel, /connectSelectionRequests\(\)/)
  assert.match(panel, /addEventListener\('oi:epi-examine', examine\)/)
  assert.match(panel, /const examine = \(\) => \{if \(live\) workspace\.setMode\('techne'\)\}/)
  const handoff = await text('../../../../desktop/cradle/src/knowledge/techneHandoff.ts')
  assert.ok(handoff.includes(`"${TECHNE_EXAMINE_EVENT}"`))
  assert.ok(handoff.includes(HOSTED_WORDS), 'the hosted absence is the owner\'s sentence')
  assert.ok(handoff.includes(UNSTOOD_WORDS), 'the unstood absence is the owner\'s sentence')
})

test('the decision stands where it is held: the frame\'s instruments need a Scene, the subject provider is registered nowhere, and the boundary keys shared time to the Scene', async () => {
  const frame = await text('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstruments.tsx')
  assert.ok(frame.includes('Open a native Scene to read its dates and places'), 'the frame still reads dates and places from a native Scene (N2 decided this is the shape)')
  const scope = await text('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchInstrumentsData.ts')
  assert.ok(scope.includes('A host-wide reading cannot lend dates or places to unrelated construction.'))
  const time = await text('../../../expressions-boundary/src/timeWindow.ts')
  assert.match(time, /!sameBasis\(context\.state\?\.nativeScene, native\)/)
  const provider = await text('../../../../desktop/cradle/src/techne/wikiReadingProvider.ts')
  assert.match(provider, /Hosted instruments use readWikiSceneTechne/)
  const roots = ['../../../../desktop/cradle/src', '../src', '../../../../desktop/cradle/expressions-app/field-studies-journeys/src']
  const sources = []
  const walk = async dir => {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
      if (entry.isDirectory()) { if (entry.name !== 'node_modules') await walk(path) } else if (/\.(ts|tsx)$/.test(entry.name)) sources.push(path)
    }
  }
  for (const root of roots) await walk(new URL(root + '/', import.meta.url))
  assert.ok(sources.length > 500, 'the walk reached the sources')
  const registered = []
  for (const path of sources) {
    if (path.pathname.endsWith('/techne/techneReading.ts')) continue
    if ((await readFile(path, 'utf8')).includes('registerTechneReadingProvider(')) registered.push(path.pathname)
  }
  assert.deepEqual(registered, [], 'no product source registers the subject-addressed Technē reading provider')
})
