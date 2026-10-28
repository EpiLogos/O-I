// O-I #761: the Palace finished (manual §17.7). A private room draws clouded to a visitor and clear to you (Audience Me · Field · Public);
// Method of loci lays the fixed floor of six rooms with four places in each (Arrangement Board · Method of loci); Tempo sets how long
// the walk stays in a room; Return sends the rooms in your order to the route the reading names, Central's receiving, as a proposal
// whose author the owner reads back, and Accept lands it with the owner's receipt.
//
// Channels: FIXTURE, owner-shaped — the palace session over owners standing in for the live ones (the documents of
// atlas-palaces-session.test.mjs; the receiving replies are the shapes `ctrl` answered on a scratch root, 28 Oct 2026: submit, review and
// read of a request Return of kind proposal). SCRIPTED: the floor rendered to static markup. No owner state is written.
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
  if (r) return r
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const session = await import('../src/projections/atlas/palaces/palaceSession.ts')
const model = await import('../src/projections/atlas/palaces/palacesModel.ts')
const {PalaceFloor} = await import('../src/projections/atlas/palaces/PalaceFloor.tsx')
const {palaceWalkBindings} = await import('../src/projections/atlas/palaces/palaceTransport.ts')
const palaceB = await import('../src/techne/devices/palaceBinding.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {resetPalaceCompositions} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts')
const {regionSceneRef, PALACE_ROOMS, PALACE_LOCI_PER_ROOM} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/composition.ts')
const {defaultBoardPoint} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/board.ts')

const EXPR = 'expression:techne-m0.central.abc'
const OVERVIEW = `${EXPR}:scene:overview`, STONE = `${EXPR}:scene:c1`, TOWER = `${EXPR}:scene:c2`, WALK = regionSceneRef(EXPR, 'Walk')
const PROJECTION = {overviewSceneRef: OVERVIEW, constellations: [{sceneRef: STONE}, {sceneRef: TOWER}]}
const BASIS = 'central:source:Control/agents/wiki/wiki.json'
const PERSON = 'central:source:control:root:Control/user/identity'

function documentAt(revision, privateScenes = [TOWER]) {
  return {
    schema: 'oi.expression/v1', expression_ref: EXPR, revision, title: 'Central',
    scenes: [
      {scene_ref: OVERVIEW, revision: 1, title: 'Central', entity_refs: []},
      {scene_ref: STONE, revision: 1, title: 'The Stone', entity_refs: ['e1', 'e2']},
      {scene_ref: TOWER, revision: 1, title: 'The Tower', entity_refs: ['e3']},
      {scene_ref: WALK, revision: 1, title: 'Walk', entity_refs: [], body: {carrier: 'expression_ref', subject_ref: 'expression:walk'}, triggers: []},
    ].map(scene => (privateScenes.includes(scene.scene_ref) ? {...scene, private: true} : scene)),
    entities: {
      e1: {entity_ref: 'e1', revision: 1, title: 'the carving', subject: {subject_ref: 'wiki:node:carving'}},
      e2: {entity_ref: 'e2', revision: 1, title: 'Mercurius', subject: {subject_ref: 'wiki:node:mercurius'}},
      e3: {entity_ref: 'e3', revision: 1, title: 'the tower, 1923', subject: {subject_ref: 'wiki:node:tower'}},
    },
  }
}

/** The owner's Expression-wide reading, naming the register's route for new knowledge as wikiReadingProvider.ts does. */
function readingAt(doc) {
  const reading = structuredClone(provingReading())
  reading.subject = {...reading.subject, subject_ref: EXPR}
  reading.reading_ref = `ql.techne:reading:${EXPR}@${doc.revision}`
  reading.snapshot = {revision: 'r9', basis_ref: BASIS}
  reading.expressions = doc.scenes.map(scene => ({expression_ref: EXPR, revision: String(doc.revision), scene_ref: scene.scene_ref}))
  reading.actions = [{action_ref: 'central.receiving.submit', native_owner: 'central', authority: 'governed-write', summary: 'the route for new knowledge', expected_effects: []}]
  return reading
}

/** Central's reading of one request Return (the shape `ctrl` answered, 28 Oct 2026). */
function receivingReading(request, status, review = null) {
  return {schema: 'central.receiving-reading/v1', return_ref: 'central:return:control:root:abc', revision: `rev-${status}`, included: false,
    source_changed_by_arrival_or_review: false, automatic_agent_or_model_invocation: false,
    record: {schema: 'central.received-contribution/v1', return_ref: 'central:return:control:root:abc', kind: 'request', status,
      author: {principal_ref: PERSON, actor_kind: 'human'}, request: {...request.request}, review}}
}

const ROW = {key: 'central', title: 'Central', project: null, expression_ref: EXPR, revision: 4, held: true, standing: 'open', rooms: []}

function owners(over = {}) {
  const calls = {edits: [], receiving: []}
  let doc = documentAt(4, over.privateScenes)
  let submitted = null
  const bound = {
    inspect: async () => structuredClone(doc),
    readWhole: async () => readingAt(doc),
    list: async () => [{expression_ref: 'expression:walk', title: 'Walk', revision: 2}],
    edit: async request => {
      calls.edits.push(structuredClone(request))
      const marks = request.changes.filter(change => change.change === 'scene_private')
      const now = doc.scenes.filter(scene => scene.private).map(scene => scene.scene_ref)
      const next = marks.reduce((set, change) => (change.private ? [...set, change.scene_ref] : set.filter(ref => ref !== change.scene_ref)), now)
      doc = documentAt(doc.revision + 1, over.ignorePrivacy ? now : next)
      return {state: 'ready', document: structuredClone(doc)}
    },
    receiving: async (project, request) => {
      calls.receiving.push([project, structuredClone(request)])
      if (over.receiving) return over.receiving(project, request)
      if (request.kind === 'ask') { submitted = request; return receivingReading(request, 'pending') }
      if (request.kind === 'review') return receivingReading(submitted, request.disposition, {reviewer_ref: PERSON, disposition: request.disposition, reviewed_at_unix_seconds: 1})
      if (request.kind === 'read') return receivingReading(submitted, calls.receiving.some(([, r]) => r.kind === 'review' && r.disposition === 'rejected') ? 'rejected' : 'accepted',
        {reviewer_ref: PERSON, disposition: calls.receiving.some(([, r]) => r.kind === 'review' && r.disposition === 'rejected') ? 'rejected' : 'accepted', reviewed_at_unix_seconds: 1})
      throw Error(`unexpected ${request.kind}`)
    },
    hold: async () => EXPR,
    projection: () => PROJECTION,
    storage: () => null,
    session: createDisclosureSessionStore(),
    open: {expression: () => 'opened', scene: () => 'opened', subject: () => 'opened', instrument: () => 'opened', source: () => 'opened'},
  }
  session.bindPalaceOwners(bound)
  return {calls}
}

async function enter(over) {
  session.resetPalaceSession()
  resetPalaceCompositions()
  const bound = owners(over)
  await session.enterPalace(ROW)
  await new Promise(resolve => setImmediate(resolve))
  return bound
}
const html = () => renderToStaticMarkup(createElement(PalaceFloor))

// ── A private room ──────────────────────────────────────────────────────────

test('a Scene the owner marks private is a private room; it is under cloud for Field and Public, never for you', () => {
  const rooms = model.roomsOf(documentAt(4), PROJECTION)
  assert.deepEqual(rooms.map(room => [room.name, room.private]), [['Central', false], ['The Stone', false], ['The Tower', true], ['Walk', false]])
  const tower = rooms[2]
  assert.equal(model.underCloud(tower, 'me'), false)
  assert.equal(model.underCloud(tower, 'field'), true)
  assert.equal(model.underCloud(tower, 'public'), true)
  assert.equal(model.underCloud(rooms[1], 'public'), false, 'an open room is clear to every audience')
})

test('a room marked private draws clouded to a visitor and clear to you: its name, its objects and its door stay under cloud', async () => {
  await enter()
  assert.equal(session.inside().audience, 'me', 'the Palace shows itself as you see it')
  const mine = html()
  assert.match(mine, /<text[^>]*>the tower, 1923<\/text>/, 'to you, the private room is clear')
  assert.doesNotMatch(mine, /data-clouded="true"/)
  session.setAudience('field')
  const field = html()
  assert.equal((field.match(/data-clouded="true"/g) ?? []).length, 1, 'one room under cloud')
  assert.match(field, /data-room="[^"]*c2"[^>]*data-clouded="true"/)
  assert.doesNotMatch(field, /the tower, 1923|The Tower/, 'neither its name nor its objects are drawn to a visitor')
  assert.match(field, /<text[^>]*>the carving<\/text>/, 'an open room stays clear')
  session.setAudience('public')
  assert.doesNotMatch(html(), /the tower, 1923/)
  assert.throws(() => session.setAudience('everyone'), /Me, Field or Public/)
})

test('marking a room private is one CAS-gated edit of the palace\'s Expression, read back from the owner; an unsaved region is refused', async () => {
  const {calls} = await enter({privateScenes: []})
  await session.markPrivate(STONE, true)
  assert.equal(calls.edits.length, 1)
  assert.deepEqual(calls.edits[0], {operation: 'edit', expression_ref: EXPR, expected_revision: 4, actor: 'human:techne-palace', changes: [{change: 'scene_private', scene_ref: STONE, private: true}]})
  const here = session.inside()
  assert.equal(here.doc.revision, 5, 'the palace stands at the owner\'s new revision')
  assert.equal(session.roomsNow(here).find(room => room.key === STONE).private, true, 'the owner\'s document reads the room as private')
  assert.match(here.line, /The Stone is private: .*revision 5/)
  await session.markPrivate(STONE, false)
  assert.equal(session.roomsNow(session.inside()).find(room => room.key === STONE).private, false)
  // an owner whose readback does not carry the mark is said, never assumed
  const ignored = await enter({privateScenes: [], ignorePrivacy: true})
  await session.markPrivate(STONE, true)
  assert.equal(ignored.calls.edits.length, 1)
  assert.match(session.inside().line, /does not read The Stone as private/)
  session.addRegion('Unsaved')
  await session.markPrivate(regionSceneRef(EXPR, 'Unsaved'), true)
  assert.match(session.inside().line, /not saved yet/)
  assert.equal(ignored.calls.edits.length, 1, 'nothing is sent for a room the owner does not hold')
})

// ── Method of loci ──────────────────────────────────────────────────────────

test('Method of loci lays the fixed floor: six rooms of four places, three across and two down, the palace\'s rooms in path order', () => {
  const rooms = model.roomsOf(documentAt(4, []), PROJECTION)
  const floor = model.lociFloor(rooms, STONE)
  assert.equal(PALACE_ROOMS.columns * PALACE_ROOMS.rows, 6)
  assert.equal(floor.rooms.length, 6, 'six rooms, always')
  for (const room of floor.rooms) assert.equal(room.places.length, PALACE_LOCI_PER_ROOM, 'four places in each')
  assert.deepEqual(floor.rooms.map(room => [room.x, room.y]), [0, 1, 2, 3, 4, 5].map(i => [defaultBoardPoint(i).x, defaultBoardPoint(i).y]))
  assert.deepEqual(floor.rooms.map(room => room.room?.name ?? null), ['Central', 'The Stone', 'The Tower', 'Walk', null, null], 'the rooms in path order, the rest empty')
  assert.deepEqual(floor.rooms[1].places, ['the carving', 'Mercurius', null, null], 'a room\'s places hold its objects in order')
  assert.deepEqual(floor.rooms[3].places, ['expression:walk', null, null, null], 'a region\'s first place holds its one Expression')
  assert.equal(floor.rooms[1].focused, true)
  assert.equal(floor.beyond, 0)
  const many = Array.from({length: 8}, (_, i) => ({...rooms[1], key: `k${i}`, name: `R${i}`}))
  assert.equal(model.lociFloor(many, null).beyond, 2, 'rooms past the sixth are counted, never squeezed in')
})

test('choosing Method of loci draws the fixed floor in the pane; Board draws the free board again', async () => {
  await enter()
  assert.equal(session.inside().arrangement, 'board')
  session.setArrangement('loci')
  const loci = html()
  assert.equal((loci.match(/data-loci-room=/g) ?? []).length, 6, 'six rooms')
  assert.equal((loci.match(/data-place=/g) ?? []).length, 24, 'four places in each')
  assert.match(loci, /data-arrangement="loci"/)
  assert.match(loci, /<text[^>]*>Mercurius<\/text>/, 'a place draws the object that stands in it')
  session.setAudience('field')
  assert.doesNotMatch(html(), /the tower, 1923/, 'on the fixed floor too, a private room stays under cloud to a visitor')
  session.setArrangement('board')
  assert.doesNotMatch(html(), /data-loci-room=/)
  assert.throws(() => session.setArrangement('spiral'), /Board or Method of loci/)
})

// ── Tempo ───────────────────────────────────────────────────────────────────

test('changing Tempo changes the dwell: › quickens the walk, ‹ slows it, and a walk that walks follows the new dwell', async t => {
  await enter()
  t.mock.timers.enable({apis: ['setInterval']})
  let bindings = palaceWalkBindings(session.palaceState())
  assert.equal(bindings.tempo.readout.value, `${session.PALACE_WALK_DWELL_MS / 1000} s`)
  assert.equal(typeof bindings.tempo.step, 'function', 'Tempo is a stepped control while a palace stands')
  bindings.tempo.step(1)
  const faster = session.inside().dwellMs
  assert.ok(faster < session.PALACE_WALK_DWELL_MS, '› shortens the dwell')
  assert.equal(palaceWalkBindings(session.palaceState()).tempo.readout.value, `${faster / 1000} s`)
  session.startWalking()
  t.mock.timers.tick(faster)
  assert.equal(session.walkOf(session.inside()).index, 1, 'one locus after the new dwell')
  bindings = palaceWalkBindings(session.palaceState())
  bindings.tempo.step(-1)
  bindings = palaceWalkBindings(session.palaceState())
  bindings.tempo.step(-1)
  const slower = session.inside().dwellMs
  assert.ok(slower > session.PALACE_WALK_DWELL_MS, '‹ lengthens it')
  t.mock.timers.tick(faster)
  assert.equal(session.walkOf(session.inside()).index, 1, 'the walking walk now waits the longer dwell')
  t.mock.timers.tick(slower - faster)
  assert.equal(session.walkOf(session.inside()).index, 2)
  for (let i = 0; i < 20; i++) session.stepTempo(-1)
  assert.equal(session.inside().dwellMs, Math.max(...session.PALACE_WALK_DWELLS_MS), 'the dwell stops at its longest')
  session.stopWalking()
  t.mock.timers.reset()
})

// ── Return ──────────────────────────────────────────────────────────────────

test('Propose Return reaches the sources\' owner as a proposal with your name; Accept lands it with a receipt read back from that owner', async () => {
  const {calls} = await enter()
  await session.proposeReturn()
  assert.equal(calls.receiving.length, 1, 'one submission')
  const [project, ask] = calls.receiving[0]
  assert.equal(project, null, 'Central\'s palace returns at the root register')
  assert.equal(ask.kind, 'ask')
  assert.equal(ask.request.kind, 'proposal', 'a proposal the owner accepts or not')
  assert.equal(ask.request.proposed_owner_ref, BASIS, 'to the owner of the sources the reading stands on')
  assert.equal(ask.request.proposal_ref, `ql.techne:reading:${EXPR}@4`)
  assert.match(ask.request.body, /1\. Central \(the overview\)[^\n]*\n2\. The Stone \(a constellation\): the carving; Mercurius\.\n3\. A private room, under cloud: nothing of it is sent\.\n4\. Walk \(a region\): expression:walk\./,
    'the rooms in your order, each with what it holds; a private room sends nothing of itself')
  assert.doesNotMatch(JSON.stringify(ask), /the tower, 1923|wiki:node:tower/, 'nothing of the private room leaves in the Return')
  let here = session.inside()
  assert.deepEqual([here.sent.return_ref, here.sent.author, here.sent.owner, here.sent.status], ['central:return:control:root:abc', PERSON, BASIS, 'pending'])
  assert.match(here.line, new RegExp(`Proposed to ${BASIS} as ${PERSON}`), 'your name, as the owner read it back')
  await session.acceptReturn()
  const review = calls.receiving.find(([, r]) => r.kind === 'review')[1]
  assert.deepEqual(review, {kind: 'review', return_ref: 'central:return:control:root:abc', expected_return_revision: 'rev-pending', disposition: 'accepted', note: 'Accepted in the Palace of Central.'})
  assert.ok(calls.receiving.some(([, r]) => r.kind === 'read' && r.return_ref === 'central:return:control:root:abc'), 'the receipt is read back from the owner')
  assert.equal(session.palaceState().phase, 'outside', 'a Return that goes through opens the ground again')
  assert.match(session.palaceState().line, new RegExp(`Accepted: ${BASIS} keeps central:return:control:root:abc as accepted, by ${PERSON}`))
})

test('the owner\'s refusal is said and nothing changes; Refuse rejects a waiting proposal at the owner; a reading that names another route sends nothing', async () => {
  const refused = await enter({receiving: () => { throw Error('native credential is expired or lacks this exact scope/action') }})
  await session.proposeReturn()
  assert.equal(session.inside().sent, null)
  assert.deepEqual(session.inside().acceptance, {line: 'Not sent: native credential is expired or lacks this exact scope/action.', accepted: false})
  assert.equal(refused.calls.edits.length, 0)
  const {calls} = await enter()
  await session.proposeReturn()
  await session.refuseReturn()
  assert.equal(calls.receiving.find(([, r]) => r.kind === 'review')[1].disposition, 'rejected')
  assert.equal(session.palaceState().phase, 'inside', 'a refused Return stays in the palace')
  assert.match(session.inside().acceptance.line, /^Refused: .* keeps central:return:control:root:abc as rejected/)
  // a reading whose governed route is not Central's receiving: the Palace carries no Return there, and says so
  session.resetPalaceSession()
  resetPalaceCompositions()
  const other = owners()
  await session.enterPalace(ROW)
  await new Promise(resolve => setImmediate(resolve))
  const here = session.inside()
  here.reading.actions = [{action_ref: 'aikit.wiki.stage', native_owner: 'aikit/wiki', authority: 'governed-write', expected_effects: []}]
  await session.proposeReturn()
  assert.equal(other.calls.receiving.length, 0, 'nothing is sent')
  assert.match(session.inside().line, /Return not routed: .*central\.receiving\.submit.*Nothing was sent/)
})

// ── The Palace device ──────────────────────────────────────────────────────

test('the Palace device takes Floor and Audience from the session, and its rooms say which are private', async () => {
  await enter()
  let values = palaceB.palaceValues(session.palaceState())
  assert.deepEqual([values.floor, values.audience], ['board', 'me'])
  assert.deepEqual(JSON.parse(values.rooms).map(room => room.private ?? false), [false, false, true, false])
  await palaceB.palaceBinding(session.palaceState()).write([{key: 'floor', value: 'loci'}, {key: 'audience', value: 'public'}])
  values = palaceB.palaceValues(session.palaceState())
  assert.deepEqual([values.floor, values.audience], ['loci', 'public'])
  const standing = palaceB.palaceBinding(session.palaceState()).standing
  assert.equal(standing.floor, undefined, 'Floor stands enabled')
  assert.equal(standing.audience, undefined, 'Audience stands enabled')
  await assert.rejects(() => palaceB.palaceBinding(session.palaceState()).write([{key: 'x1', value: 500}]), /fixed floor/)
})

// The compact Palace (manual §17.7 Compact: "four macros — Path, Guide, Audience, Return"): its Audience is the session's now, and its Return
// says what Propose does. SCRIPTED (source): the compact renders only inside a holder's rack.
test('the compact Palace\'s Audience macro is the session\'s, and its Return says it sends a proposal with your name', async () => {
  const {readFile} = await import('node:fs/promises')
  const compact = await readFile(new URL('../src/inhabitants/ql/devices/techneCompacts.tsx', import.meta.url), 'utf8')
  const palace = compact.slice(compact.indexOf('function PalaceCompact'), compact.indexOf('const COMPACTS'))
  assert.doesNotMatch(palace, /waitingChooser\('Audience'/, 'Audience no longer waits on an owner')
  assert.match(palace, /label="Audience"[\s\S]*onChange=\{here \? next => setAudience\(next as PalaceAudience\) : undefined\}/)
  assert.match(palace, /label="Return" does="Send the rooms, in your order, to the route the reading names, as a proposal with your name\. No source is written\."/)
  assert.match(palace, /onPress=\{here \? \(\) => void proposeReturn\(\) : undefined\}/)
})
