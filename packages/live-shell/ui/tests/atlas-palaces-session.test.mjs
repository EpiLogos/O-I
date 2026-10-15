// T-PALACES-ONTO-ATLAS: the palace you stand in (projections/atlas/palaces/palaceSession.ts), over owners standing in for the live ones
// (palaceOwners.ts binds those). Every act of the frame's retired Palace lens (field-studies-journeys/src/palaceInstrument.tsx at
// fdc302870) is exercised here through the owner it goes to: entering reads the kernel's document, the owner's whole and the presence
// store (T14, T21); the walk rides the transport (T17); a floor drag is presentation (T15); bookmarks and the named start (T24); one Save
// is one CAS-gated edit of the palace's Expression, its readback checked (T20); the Return is a proposal, accepted through the owner's
// invoke_action (T19); an object opens through its owner, or its route says why not (T16). Each owner reply here is the shape the live
// owner returns; no native reply is claimed by these tests.
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
const {palaceWalkBindings} = await import('../src/projections/atlas/palaces/palaceTransport.ts')
const {provingReading} = await import('../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts')
const {createDisclosureSessionStore} = await import('../../../../desktop/cradle/src/techne/session.ts')
const {resetPalaceCompositions} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts')
const {PALACE_PRESENCE_KEY, PALACE_UNPERSISTED_NOTICE} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/presence.ts')
const {planRegions, regionSceneRef, discoverRegions} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/composition.ts')

const EXPR = 'expression:techne-m0.central.abc'
const OVERVIEW = `${EXPR}:scene:overview`, STONE = `${EXPR}:scene:c1`, TOWER = `${EXPR}:scene:c2`, WALK = regionSceneRef(EXPR, 'Walk')
const PROJECTION = {overviewSceneRef: OVERVIEW, constellations: [{sceneRef: STONE}, {sceneRef: TOWER}]}

function documentAt(revision, regions = [{name: 'Walk', member: 'expression:walk'}]) {
  return {
    schema: 'oi.expression/v1', expression_ref: EXPR, revision, title: 'Central',
    scenes: [
      {scene_ref: OVERVIEW, revision: 1, title: 'Central', entity_refs: []},
      {scene_ref: STONE, revision: 1, title: 'The Stone', entity_refs: ['e1', 'e2']},
      {scene_ref: TOWER, revision: 1, title: 'The Tower', entity_refs: ['e3']},
      ...regions.map(region => ({scene_ref: regionSceneRef(EXPR, region.name), revision: 1, title: region.name, entity_refs: [],
        body: region.member ? {carrier: 'expression_ref', subject_ref: region.member} : null,
        triggers: region.member ? [{trigger_ref: `${EXPR}:trigger:region-${region.name}-portal`, occasion: 'activate', target: {kind: 'portal', subject_ref: region.member}}] : []})),
    ],
    entities: {
      e1: {entity_ref: 'e1', revision: 1, title: 'the carving', subject: {subject_ref: 'wiki:node:carving'}},
      e2: {entity_ref: 'e2', revision: 1, title: 'Mercurius', subject: {subject_ref: 'wiki:node:mercurius'}},
      e3: {entity_ref: 'e3', revision: 1, title: 'the tower, 1923', subject: {subject_ref: 'wiki:node:tower'}},
    },
  }
}

/** The owner's Expression-wide reading at a revision: the proving reading, bound to this palace's own Scenes (as wikiReadingProvider.ts
 * wikiExpressionReadingPayload binds the register's Expression). */
function readingAt(doc) {
  const reading = structuredClone(provingReading())
  reading.subject = {...reading.subject, subject_ref: EXPR}
  reading.reading_ref = `ql.techne:reading:${EXPR}@${doc.revision}`
  reading.expressions = doc.scenes.map(scene => ({expression_ref: EXPR, revision: String(doc.revision), scene_ref: scene.scene_ref}))
  return reading
}

function memoryStorage() {
  const map = new Map()
  let writes = 0
  return {map, writes: () => writes, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { writes++; map.set(key, String(value)) }}
}

const ROW = {key: 'central', title: 'Central', project: null, expression_ref: EXPR, revision: 4, held: true, standing: 'open', rooms: []}

function owners(over = {}) {
  const calls = {edits: [], invoked: [], opened: [], inspected: 0, held: []}
  let doc = documentAt(4)
  const storage = over.storage === undefined ? memoryStorage() : over.storage
  const store = over.session ?? createDisclosureSessionStore()
  const bound = {
    inspect: async ref => { calls.inspected++; if (over.inspect) return over.inspect(ref); assert.equal(ref, EXPR); return structuredClone(doc) },
    readWhole: async basis => { if (over.readWhole) return over.readWhole(basis); assert.equal(basis.revision, doc.revision); return readingAt(doc) },
    list: async () => [{expression_ref: 'expression:walk', title: 'Walk', revision: 2}, {expression_ref: 'expression:gate', title: 'Gate', revision: 1}, {expression_ref: EXPR, title: 'Central', revision: 4}],
    edit: async request => {
      calls.edits.push(structuredClone(request))
      if (over.edit) return over.edit(request)
      doc = documentAt(doc.revision + 1, [{name: 'Walk', member: 'expression:walk'}, {name: 'Gate', member: 'expression:gate'}])
      return {state: 'ready', document: structuredClone(doc)}
    },
    invoke: async request => { calls.invoked.push(structuredClone(request)); return over.invoke ? over.invoke(request) : {state: 'dispatched', dispatch: {state: 'invoked', owner_operation: 'aikit.wiki.stage'}} },
    hold: async key => { calls.held.push(key); return EXPR },
    projection: () => PROJECTION,
    storage: () => storage,
    session: store,
    open: {
      expression: ref => { calls.opened.push(['expression', ref]); return `Opened ${ref} in the stage.` },
      scene: (palace, room) => { calls.opened.push(['scene', palace.key, room.key]); return `Asked the stage to open ${room.name}.` },
      subject: (ref, title) => { calls.opened.push(['subject', ref, title]); return `Asked the subject door for ${title}.` },
      instrument: (instrument, ref) => { calls.opened.push(['instrument', instrument, ref]); return `Asked the shell for the ${instrument} instrument with ${ref}.` },
      source: ref => { calls.opened.push(['source', ref]); return `Asked Graph and source for ${ref}.` },
    },
  }
  session.bindPalaceOwners(bound)
  return {calls, storage, store, document: () => doc}
}

function fresh() {
  session.resetPalaceSession()
  resetPalaceCompositions()
}

test('entering a palace reads its document, its whole and its saved presence; its rooms are its Scenes, in path order (T14)', async () => {
  fresh()
  const {calls} = owners()
  await session.enterPalace(ROW)
  const here = session.inside()
  assert.ok(here, 'the palace stands')
  assert.equal(here.doc.expression_ref, EXPR)
  assert.deepEqual(here.basis, {expression_ref: EXPR, revision: 4, scene_ref: OVERVIEW}, 'the whole is read at the register\'s overview, at the owner\'s revision')
  assert.deepEqual(session.roomsNow(here).map(room => [room.name, room.kind]), [['Central', 'overview'], ['The Stone', 'constellation'], ['The Tower', 'constellation'], ['Walk', 'region']])
  assert.deepEqual(here.regions.map(region => [region.name, region.member?.expression_ref]), [['Walk', 'expression:walk']], 'the hand-made regions are discovered from the document')
  assert.equal(here.reading.reading_ref, `ql.techne:reading:${EXPR}@4`)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(session.inside().eligible.map(entry => entry.expression_ref), ['expression:walk', 'expression:gate'], 'the palace\'s own Expression is not eligible to hold')
  const {steps, focus} = session.walkOf(session.inside())
  assert.equal(focus.ref, steps[0].ref, 'with no saved position the walk lands on the named start')
  assert.ok(steps.some(step => step.ref === STONE), 'the walk passes through the rooms (the reading\'s journey region is the palace\'s Scenes)')
  assert.equal(calls.held.length, 0, 'a palace the kernel holds is not opened again')
})

test('entering at a room stands the walk in it; a room the walk does not hold is named, and the walk lands on the named start', async () => {
  fresh()
  owners()
  await session.enterPalace(ROW, {roomKey: TOWER})
  assert.equal(session.walkOf(session.inside()).focus.ref, TOWER)
  assert.equal(session.focusedRoom(session.inside()), TOWER, 'the floor focuses that room')
  await session.enterPalace(ROW, {roomKey: 'scene:not-here'})
  assert.match(session.inside().line, /Entered at the named start: the walk does not stand in that room\./)
  assert.equal(session.walkOf(session.inside()).index, 0)
})

test('a palace the kernel does not hold is opened by its owner first; a refusal leaves the visitor outside, in the owner\'s words', async () => {
  fresh()
  const {calls} = owners()
  await session.enterPalace({...ROW, held: false, expression_ref: null})
  assert.deepEqual(calls.held, ['central'])
  assert.ok(session.inside())
  fresh()
  owners({inspect: () => { throw Error('The native Expression could not be read') }})
  await session.enterPalace(ROW)
  assert.equal(session.palaceState().phase, 'outside')
  assert.equal(session.palaceState().line, 'Central was not entered: The native Expression could not be read')
})

test('a whole the owner refuses leaves the rooms standing, with the owner\'s reason', async () => {
  fresh()
  owners({readWhole: () => { throw Error('This Scene has no exact Wiki register binding') }})
  await session.enterPalace(ROW)
  const here = session.inside()
  assert.equal(here.reading, null)
  assert.equal(here.readingReason, 'This Scene has no exact Wiki register binding')
  assert.equal(session.roomsNow(here).length, 4, 'the rooms still stand')
  fresh()
  owners({readWhole: async () => ({...readingAt(documentAt(4)), subject: {...provingReading().subject}})})
  await session.enterPalace(ROW)
  assert.match(session.inside().readingReason, /belongs to another native source or revision/, 'a reading for another subject is refused by name')
})

test('the walk rides the one transport: Play walks a locus per dwell and wraps, Stop holds it still, and its position persists (T17)', async t => {
  fresh()
  const {storage} = owners()
  await session.enterPalace(ROW)
  t.mock.timers.enable({apis: ['setInterval']})
  const outside = palaceWalkBindings({phase: 'outside'})
  assert.deepEqual(outside, {}, 'outside a palace the atlas\'s own time serves the transport')
  let bindings = palaceWalkBindings(session.palaceState())
  const steps = session.walkOf(session.inside()).steps
  assert.equal(bindings.signature.readout.value, `1/${steps.length}`)
  assert.equal(bindings.tempo.readout.value, `${session.PALACE_WALK_DWELL_MS / 1000} s`)
  assert.ok(bindings.stop.refused, 'nothing walks yet, so Stop has nothing to stop')
  bindings.play.press()
  assert.equal(session.inside().walking, true)
  t.mock.timers.tick(session.PALACE_WALK_DWELL_MS * 2)
  assert.equal(session.walkOf(session.inside()).index, 2, 'two dwells, two loci')
  bindings = palaceWalkBindings(session.palaceState())
  assert.equal(bindings.play.lit, true)
  bindings.stop.press()
  t.mock.timers.tick(session.PALACE_WALK_DWELL_MS * 3)
  assert.equal(session.walkOf(session.inside()).index, 2, 'Stop holds the walk still')
  session.moveWalk(steps.length + 1)
  assert.equal(session.walkOf(session.inside()).index, 1, 'the walk wraps')
  const saved = Object.values(JSON.parse(storage.map.get(PALACE_PRESENCE_KEY)))[0]
  assert.equal(saved.walk_index, 1, 'the walk position persists through the presence owner')
  t.mock.timers.reset()
})

test('a floor drag is one move, saved once through the presence owner; a key the palace does not hold moves nothing (T15)', async () => {
  fresh()
  const {storage} = owners()
  await session.enterPalace(ROW)
  const before = storage.writes()
  session.moveRooms({[STONE]: {x: 700, y: 300}, [TOWER]: {x: -40, y: 12}})
  assert.equal(storage.writes(), before + 1, 'one gesture, one save')
  assert.deepEqual(session.inside().held, {[STONE]: {x: 700, y: 300}, [TOWER]: {x: -40, y: 12}})
  session.moveRooms({'scene:ghost': {x: 1, y: 1}})
  assert.equal(storage.writes(), before + 1, 'a room the palace does not hold is never placed or saved')
  session.setSnap(true)
  session.moveRooms({[STONE]: {x: 412, y: 88}})
  assert.deepEqual(session.inside().held[STONE], {x: 400, y: 100}, 'snap on: the grid')
  session.selectRooms([TOWER, 'scene:ghost', STONE])
  assert.deepEqual(session.inside().selected, [STONE, TOWER], 'a selection names the rooms it covers, in path order')
  assert.equal(session.inside().line, 'Selected 2 rooms: The Stone, The Tower. The room list shows them.')
})

test('entering restores the saved arrangement, walk position and bookmarks; refused storage is told once and the palace still works (T21)', async () => {
  fresh()
  const {storage} = owners()
  await session.enterPalace(ROW)
  session.moveRooms({[STONE]: {x: 700, y: 300}})
  session.moveWalk(3)
  assert.equal(session.bookmarkHere('The carving'), true)
  session.leavePalace()
  resetPalaceCompositions() // a reload: nothing held in memory
  owners({storage})
  await session.enterPalace(ROW)
  const here = session.inside()
  assert.deepEqual(here.held, {[STONE]: {x: 700, y: 300}})
  assert.equal(session.walkOf(here).index, 3)
  assert.deepEqual(here.bookmarks.map(bookmark => bookmark.name), ['The carving'])
  fresh()
  owners({storage: {getItem: () => null, setItem: () => { throw Error('quota') }}})
  await session.enterPalace(ROW)
  session.moveWalk(1)
  assert.equal(session.inside().line, PALACE_UNPERSISTED_NOTICE)
  session.moveWalk(2)
  assert.equal(session.walkOf(session.inside()).index, 2, 'the walk still moves')
})

test('bookmarks: named at the walk\'s focus, jumped in one hop, renamed, deleted — each through the presence owner (T24)', async () => {
  fresh()
  owners()
  await session.enterPalace(ROW)
  session.moveWalk(2)
  const focus = session.walkOf(session.inside()).focus
  assert.equal(session.bookmarkHere('  '), false)
  assert.match(session.inside().line, /Not bookmarked: a bookmark needs a name/)
  assert.equal(session.bookmarkHere('Gate'), true)
  assert.equal(session.bookmarkHere('Again'), false, 'one bookmark per ref')
  session.walkToStart()
  assert.equal(session.walkOf(session.inside()).index, 0, 'Start is the named start')
  const [bookmark] = session.inside().bookmarks
  session.jumpBookmark(bookmark)
  assert.equal(session.walkOf(session.inside()).focus.ref, focus.ref, 'a jump stands the walk at the bookmark in one hop')
  assert.equal(session.renameBookmark(bookmark.ref, 'Night'), true)
  assert.equal(session.inside().bookmarks[0].name, 'Night')
  session.deleteBookmark(session.inside().bookmarks[0])
  assert.deepEqual(session.inside().bookmarks, [])
})

test('Save sends one CAS-gated edit of the plan and checks the readback; replay sends nothing; a conflict keeps the draft (T20)', async () => {
  fresh()
  const {calls} = owners()
  await session.enterPalace(ROW)
  await session.save()
  assert.equal(calls.edits.length, 0)
  assert.equal(session.inside().line, 'Nothing to save — the composition already matches the native document.', 'a replay of the standing composition sends nothing')
  await new Promise(resolve => setImmediate(resolve))
  session.addAsNewRegion('expression:gate', 'Gate')
  const draft = session.inside()
  const expected = planRegions(draft.draftDoc, draft.regions, [])
  assert.deepEqual(session.roomsNow(draft).map(room => [room.name, room.saved]).slice(-2), [['Walk', true], ['Gate', false]], 'the draft stands as an unsaved room')
  await session.save()
  assert.equal(calls.edits.length, 1, 'one edit')
  assert.deepEqual(calls.edits[0], {operation: 'edit', expression_ref: EXPR, expected_revision: 4, actor: 'human:techne-palace', changes: expected})
  const here = session.inside()
  assert.equal(here.doc.revision, 5, 'the palace stands at the owner\'s new revision')
  assert.deepEqual(here.regions.map(region => region.name), ['Walk', 'Gate'])
  assert.match(here.line, /^Composition saved — revision 5; readback confirms the regions and guided order\.$/)
  assert.equal(here.reading.reading_ref, `ql.techne:reading:${EXPR}@5`, 'the whole is read again at the new basis')
  // a conflict: the draft is kept, nothing is claimed saved
  fresh()
  owners({edit: () => ({state: 'revision_conflict', current_revision: 9})})
  await session.enterPalace(ROW)
  session.addRegion('Night')
  await session.save()
  assert.match(session.inside().line, /^Not saved: This Palace changed elsewhere \(now revision 9\)\. Nothing was saved/)
  assert.deepEqual(session.inside().regions.map(region => region.name), ['Walk', 'Night'], 'the draft is retained')
  // a readback the owner returns with another order is said, never adopted
  fresh()
  owners({edit: () => ({state: 'ready', document: documentAt(5, [{name: 'Other', member: null}])})})
  await session.enterPalace(ROW)
  session.addRegion('Night')
  await session.save()
  assert.match(session.inside().line, /regions or guided order differ\. Your draft is retained/)
  assert.equal(session.inside().doc.revision, 4)
})

test('the draft composes: one Expression per region, removal explicit, reorder along the path, Revert takes the owner\'s', async () => {
  fresh()
  owners()
  await session.enterPalace(ROW)
  session.addTo('Walk', 'expression:gate', 'Gate')
  assert.match(session.inside().line, /"Walk" already holds one Expression/)
  assert.equal(session.addRegion('Night'), true)
  assert.equal(session.addRegion('Night'), false, 'a repeated name adds nothing')
  session.addTo('Night', 'expression:gate', 'Gate')
  session.moveRegion('Night', -1)
  assert.deepEqual(session.inside().regions.map(region => [region.name, region.member?.expression_ref ?? null]), [['Night', 'expression:gate'], ['Walk', 'expression:walk']])
  session.removeRegion('Walk')
  assert.deepEqual(session.inside().removed, ['Walk'])
  const plan = planRegions(session.inside().draftDoc, session.inside().regions, [...session.inside().removed])
  assert.ok(plan.some(change => change.change === 'scene_remove' && change.scene_ref === WALK), 'only an explicitly removed region is removed')
  session.revert()
  assert.deepEqual(session.inside().regions, discoverRegions(session.inside().doc))
  assert.equal(session.inside().line, 'Cancelled — no mutation.')
})

test('Return: proposing writes nothing; Accept sends the proposal through the owner\'s invoke_action, and an invoked receipt returns to the Earth (T19)', async () => {
  fresh()
  const {calls, storage} = owners()
  await session.enterPalace(ROW)
  const stored = storage.map.get(PALACE_PRESENCE_KEY)
  session.proposeReturn()
  const here = session.inside()
  assert.equal(here.proposal.receipt.routed, true)
  assert.equal(here.proposal.route.action_ref, 'aikit.wiki.stage')
  assert.equal(here.line, 'Return proposed, awaiting human acceptance. Nothing has been written.')
  assert.equal(storage.map.get(PALACE_PRESENCE_KEY), stored, 'a proposal writes nothing')
  await session.acceptReturn()
  assert.equal(calls.invoked.length, 1)
  assert.equal(calls.invoked[0].operation, 'invoke_action')
  assert.deepEqual(calls.invoked[0].reading_request, {expression_ref: EXPR, revision: 4, scene_ref: OVERVIEW, scope: 'expression'}, 'the owner re-reads the reading the proposal came from')
  assert.equal(calls.invoked[0].actor, 'human:techne-palace')
  assert.equal(session.palaceState().phase, 'outside', 'an invoked Return crosses back to the ground: the Earth')
  assert.equal(session.palaceState().line, 'Accepted: aikit.wiki.stage invoked by aikit.wiki.stage. Returning to M0′.')
  // a refusal is said and the visitor stays
  fresh()
  owners({invoke: () => ({state: 'refused', reason: 'stale: the proposal was made from reading reading:old'})})
  await session.enterPalace(ROW)
  session.proposeReturn()
  await session.acceptReturn()
  assert.equal(session.palaceState().phase, 'inside')
  assert.deepEqual(session.inside().acceptance, {line: 'Not accepted: stale: the proposal was made from reading reading:old.', accepted: false})
  session.refuseReturn()
  assert.equal(session.inside().proposal, null)
  assert.equal(session.inside().line, 'Return refused. Nothing was written.')
})

test('Return to ground leaves the palace for the Earth, only when the reading discloses the ground', async () => {
  fresh()
  owners()
  await session.enterPalace(ROW)
  session.returnToGround()
  assert.equal(session.palaceState().phase, 'outside')
  assert.equal(session.palaceState().line, 'Returned from Central to the Earth.')
  fresh()
  owners({readWhole: async () => {
    const reading = readingAt(documentAt(4))
    for (const entry of reading.disclosure.instruments) if (entry.instrument === 'project') Object.assign(entry, {available: false, reason: 'the ground is not disclosed here'})
    return reading
  }})
  await session.enterPalace(ROW)
  session.returnToGround()
  assert.equal(session.palaceState().phase, 'inside')
  assert.match(session.inside().line, /does not disclose the M0′ ground/)
})

test('an object opens through its owner: a region its one Expression, a room its Scene, a subject the subject door, an entry its instrument; what its route refuses is named (T16)', async () => {
  fresh()
  const {calls} = owners()
  await session.enterPalace(ROW)
  await new Promise(resolve => setImmediate(resolve))
  session.openRoom(WALK)
  assert.deepEqual(calls.opened.at(-1), ['expression', 'expression:walk'], 'a region opens its one contained Expression')
  assert.equal(session.inside().line, 'Opened expression:walk in the stage. Its trail step was not recorded: No shared session stands, so the Palace trail step was not recorded', 'the trail step is honest about the session')
  session.openRoom(STONE)
  assert.deepEqual(calls.opened.at(-1), ['scene', 'central', STONE], 'a constellation room opens its own Scene')
  session.openMember({subject_ref: 'wiki:node:carving', title: 'the carving'})
  assert.deepEqual(calls.opened.at(-1), ['subject', 'wiki:node:carving', 'the carving'])
  session.openEntry({kind: 'canvas', ref: 'ql.techne:constellation:x', label: 'constellation', open_instrument: 'canvas'})
  assert.deepEqual(calls.opened.at(-1), ['instrument', 'canvas', 'ql.techne:constellation:x'])
  session.openEntry({kind: 'sources', ref: 'central:source:x', label: 'source', open_instrument: null})
  assert.deepEqual(calls.opened.at(-1), ['source', 'central:source:x'])
  session.openEntry({kind: 'journey', ref: TOWER, label: 'scene', open_instrument: 'journey'})
  assert.deepEqual(calls.opened.at(-1), ['scene', 'central', TOWER], 'a journey entry that is one of this palace\'s rooms opens the room')
  const count = calls.opened.length
  session.openEntry({kind: 'agency', ref: 'agent:x', label: 'agent', open_instrument: null})
  assert.match(session.inside().line, /^Refused: agent has no instrument surface — its depth stays in the palace\.$/)
  session.openObject('expressions', EXPR)
  assert.match(session.inside().line, /^Refused: Central is the palace you stand in/)
  session.addRegion('Empty')
  session.openRoom(regionSceneRef(EXPR, 'Empty'))
  assert.match(session.inside().line, /^Refused: Empty holds no Expression to open yet\.$/)
  assert.equal(calls.opened.length, count, 'nothing is opened on the palace\'s behalf that its route refuses')
})

test('a trail step is recorded when the shared session stands on the palace\'s own Expression reading', async () => {
  fresh()
  const store = createDisclosureSessionStore()
  // the session opened on this palace's whole, on the Expression instrument, by the owner's own alignment (m0m5/reading.ts ensureSession)
  const {ensureSession} = await import('../../../../desktop/cradle/src/techne/m0m5/reading.ts')
  ensureSession(readingAt(documentAt(4)), 'expressions', store)
  owners({session: store})
  await session.enterPalace(ROW)
  const before = store.get().navigation.length
  session.openRoom(WALK)
  assert.equal(store.get().navigation.length, before + 1, 'one endpoint hop')
  assert.deepEqual(store.get().navigation.at(-1), {kind: 'traversal', instrument: 'expressions', step: 'endpoint', ref: 'expression:walk',
    subject_ref: EXPR, selection_ref: store.get().selection.selection_ref})
  assert.equal(session.inside().line, 'Opened expression:walk in the stage. Its trail step is recorded on the session.')
})

test('leaving ends the walk and stands outside; releasing the owners (the Earth closing) leaves the palace too', async t => {
  fresh()
  owners()
  await session.enterPalace(ROW)
  t.mock.timers.enable({apis: ['setInterval']})
  session.startWalking()
  session.leavePalace('Left the palace for the Earth.')
  t.mock.timers.tick(session.PALACE_WALK_DWELL_MS * 2)
  assert.deepEqual(session.palaceState(), {phase: 'outside', line: 'Left the palace for the Earth.'})
  owners()
  await session.enterPalace(ROW)
  session.bindPalaceOwners(null)
  assert.equal(session.palaceState().phase, 'outside')
  assert.equal(session.palaceState().line, 'The Earth closed, so the palace was left.')
  t.mock.timers.reset()
})
