// lane-5 T15–T17 on the atlas: the palace's free arrangement (T-PALACES-ONTO-ATLAS). Moved from the frame's
// field-studies-journeys/tests/palace-board.test.mjs with its module: the arrangement law is the owner seam's now
// (desktop/cradle/src/techne/m0m5/palace/board.ts) and the palace is drawn as the atlas's floor plan (palaces/PalaceFloor.tsx,
// palaces/palacesModel.ts floorRooms / floorEdges), not the Research Canvas's cards. Rooms arrange freely: a move holds a point, grid
// snap is an authoring aid, a marquee hands its rooms to the plate's room list, and no move touches the palace's document or its plan.
//
// Retired with the frame's board view, each replaced here: 'each region is a sticky card of the research canvas …' → 'the floor
// draws every room …'; 'the board is the Research Canvas …' and 'the board has no drag system of its own and writes no native
// document' → 'the floor writes no native document …'; 'the board draws its colours from tokens only' → 'the floor draws its colours
// from tokens only'; 'the region list stays the walk order beside the board …' and 'T16/T17/T18 wiring …' → 'the floor's path is the
// guided path's own …' and atlas-palaces-plate.test.mjs (the room list on the M5 plate).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
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

const {
  BOARD_GRID, BOARD_SNAP_REACH, boardPositions, boardSelection, boardSelectionLine, defaultBoardPoint, forgetBoardRegion, isBoardPoint,
  moveBoardRegion, snapBoardPoint, validateBoardPositions, boardEdges, boardFocusName, snapToGrid,
} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/board.ts')
const {discoverRegions, planRegions} = await import('../../../../desktop/cradle/src/techne/m0m5/palace/composition.ts')
const model = await import('../src/projections/atlas/palaces/palacesModel.ts')

const source = path => readFileSync(new URL(`../src/projections/atlas/palaces/${path}`, import.meta.url), 'utf8')

test('rooms the board does not hold yet are placed in walk order, on the grid', () => {
  const placed = boardPositions(['A', 'B', 'C', 'D'], {})
  assert.deepEqual(placed.A, defaultBoardPoint(0))
  assert.deepEqual(placed.D, defaultBoardPoint(3))
  for (const name of ['A', 'B', 'C', 'D']) {
    assert.equal(placed[name].x % BOARD_GRID, 0, `${name} x is on the grid`)
    assert.equal(placed[name].y % BOARD_GRID, 0, `${name} y is on the grid`)
  }
  assert.ok(placed.B.x > placed.A.x && placed.B.y === placed.A.y, 'columns run left to right')
  assert.ok(placed.D.x === placed.A.x && placed.D.y > placed.A.y, 'the next row sits below, from the left')
})

test('a held point wins over the walk default; a key the palace does not carry is never placed', () => {
  const placed = boardPositions(['A', 'B'], {A: {x: 37, y: -12}, Ghost: {x: 1, y: 1}})
  assert.deepEqual(placed.A, {x: 37, y: -12})
  assert.equal('Ghost' in placed, false)
  assert.deepEqual(placed.B, defaultBoardPoint(1))
})

test('grid snap is an authoring aid: on, a point within reach lands on the grid; off, it stays exact (the frame\'s own snap)', () => {
  assert.equal(BOARD_GRID, 100)
  assert.equal(BOARD_SNAP_REACH, 25)
  assert.deepEqual(snapBoardPoint({x: 207, y: 318}, true), {x: 200, y: 300})
  assert.deepEqual(snapBoardPoint({x: 160, y: 318}, true), {x: 160, y: 300}, 'an axis outside reach stays where it was dropped')
  assert.deepEqual(snapBoardPoint({x: 207, y: 318}, false), {x: 207, y: 318}, 'snap off is identity')
  assert.equal(isBoardPoint(snapBoardPoint({x: Number.NaN, y: 4}, true)), false, 'a non-finite point is never invented into a position')
  // canvasRepertoire.ts:115 snapToGrid, copied unchanged: each axis independently, within its reach
  assert.deepEqual(snapToGrid({x: 124, y: 76}, 100, 25), {x: 100, y: 100})
  assert.deepEqual(snapToGrid({x: 126, y: 74}, 100, 25), {x: 126, y: 74})
})

test('a move holds exactly one named room; an unknown key or a non-finite point changes nothing', () => {
  const names = ['A', 'B', 'C']
  const held = {A: {x: 100, y: 100}}
  const moved = moveBoardRegion(held, names, 'C', {x: 900, y: 40})
  assert.deepEqual(moved, {A: {x: 100, y: 100}, C: {x: 900, y: 40}})
  assert.equal(held.C, undefined, 'the input record is never mutated')
  assert.equal(moveBoardRegion(held, names, 'Ghost', {x: 1, y: 1}), held)
  assert.equal(moveBoardRegion(held, names, 'B', {x: Number.POSITIVE_INFINITY, y: 1}), held)
})

test('removing a room leaves no held point behind', () => {
  const held = {A: {x: 1, y: 2}, B: {x: 3, y: 4}}
  assert.deepEqual(forgetBoardRegion(held, 'A'), {B: {x: 3, y: 4}})
  assert.equal(forgetBoardRegion(held, 'Z'), held)
})

test('a marquee selection names the rooms it covers in walk order, dropping keys the palace does not carry', () => {
  assert.deepEqual(boardSelection(['A', 'B', 'C'], ['C', 'Ghost', 'A']), ['A', 'C'])
  assert.deepEqual(boardSelection(['A', 'B'], []), [])
  assert.equal(boardSelectionLine([]), 'No rooms selected on the board.')
  assert.equal(boardSelectionLine(['A']), 'Selected 1 room: A. The room list shows it.')
  assert.equal(boardSelectionLine(['A', 'B']), 'Selected 2 rooms: A, B. The room list shows them.')
})

test('a stored arrangement is accepted only when every held point is finite; unknown keys drop, never repair', () => {
  const names = ['A', 'B']
  assert.deepEqual(validateBoardPositions({A: {x: 5, y: 6}, Gone: {x: 1, y: 1}}, names), {A: {x: 5, y: 6}})
  assert.equal(validateBoardPositions({A: {x: 5, y: '6'}}, names), null)
  assert.equal(validateBoardPositions({A: {x: Number.NaN, y: 1}}, names), null)
  assert.equal(validateBoardPositions(['not', 'a', 'record'], names), null)
  assert.equal(validateBoardPositions(null, names), null)
  assert.deepEqual(validateBoardPositions({}, names), {})
})

// A kernel-shaped palace document: the register's overview, one constellation, two hand-made regions (one holding an Expression).
const DOC = {
  expression_ref: 'expression:palace-board', revision: 4,
  scenes: [
    {scene_ref: 'expression:palace-board:scene:overview', title: 'Overview', entity_refs: []},
    {scene_ref: 'expression:palace-board:scene:c1', title: 'The Stone', entity_refs: ['e1', 'e2']},
    {scene_ref: 'expression:palace-board:scene:region-Walk', title: 'Walk', entity_refs: [], body: {carrier: 'expression_ref', subject_ref: 'expression:walk'},
      triggers: [{trigger_ref: 'expression:palace-board:trigger:region-Walk-portal', target: {kind: 'portal', subject_ref: 'expression:walk'}}]},
    {scene_ref: 'expression:palace-board:scene:region-Gate', title: 'Gate', entity_refs: [], body: null},
  ],
  entities: {
    e1: {entity_ref: 'e1', title: 'the carving', subject: {subject_ref: 'wiki:node:carving'}},
    e2: {entity_ref: 'e2', title: '', subject: {subject_ref: 'wiki:node:mercurius'}},
  },
}
const PROJECTION = {overviewSceneRef: 'expression:palace-board:scene:overview', constellations: [{sceneRef: 'expression:palace-board:scene:c1'}]}

test('moving rooms on the floor leaves the palace document and its region plan byte-identical', () => {
  const regions = discoverRegions(DOC)
  const rooms = model.roomsOf(DOC, PROJECTION)
  const keys = rooms.map(room => room.key)
  const before = JSON.stringify(DOC)
  const planBefore = planRegions(DOC, regions, [])
  // The move-only interaction: three drags (one snapped), a marquee over two, and the floor's own redraw.
  let held = {}
  held = moveBoardRegion(held, keys, keys[2], {x: 700, y: 300})
  held = moveBoardRegion(held, keys, keys[3], snapBoardPoint({x: 412, y: 88}, true))
  held = moveBoardRegion(held, keys, keys[1], {x: -120, y: 640})
  const selected = boardSelection(keys, [keys[2], keys[1]])
  model.floorRooms(rooms, held, null, selected)
  assert.equal(JSON.stringify(DOC), before, 'the palace document is byte-identical after a move-only interaction')
  assert.equal(planBefore, null, 'the unchanged regions plan no change before the moves')
  assert.equal(planRegions(DOC, regions, []), null, 'and still plan no change after them: nothing is saved by a move')
  assert.deepEqual(discoverRegions(DOC).map(region => region.name), ['Walk', 'Gate'], 'the walk order of the Scenes is untouched')
})

test('the floor draws every room at its held point or its walk default, with the walk\'s focus and the selection', () => {
  const rooms = model.roomsOf(DOC, PROJECTION)
  assert.deepEqual(rooms.map(room => [room.name, room.kind]), [['Overview', 'overview'], ['The Stone', 'constellation'], ['Walk', 'region'], ['Gate', 'region']])
  assert.deepEqual(rooms[1].members.map(member => [member.subject_ref, member.title]), [['wiki:node:carving', 'the carving'], ['wiki:node:mercurius', 'wiki:node:mercurius']],
    'a room holds its Scene\'s subjects verbatim, a missing title read as its ref')
  assert.deepEqual(rooms[2].holds, {expression_ref: 'expression:walk', title: 'expression:walk'}, 'a region holds its one contained Expression, from its own body')
  assert.equal(rooms[3].holds, null)
  const floor = model.floorRooms(rooms, {[rooms[1].key]: {x: 37, y: 12}}, rooms[2].key, [rooms[3].key])
  assert.deepEqual([floor[1].x, floor[1].y], [37, 12], 'a held point stands')
  assert.deepEqual([floor[0].x, floor[0].y], [defaultBoardPoint(0).x, defaultBoardPoint(0).y], 'an unheld room stands at its walk default')
  assert.deepEqual(floor.map(room => room.focused), [false, false, true, false], 'one focus, one room')
  assert.deepEqual(floor.map(room => room.selected), [false, false, false, true])
  const bounds = model.floorBounds(floor)
  for (const room of floor) assert.ok(room.x >= bounds.x && room.y >= bounds.y && room.x + model.ROOM_SIZE.width <= bounds.x + bounds.width, 'the plan holds every room')
})

test('the floor\'s path is the guided path\'s own: a region named in the saved path with no member is broken, an unsaved one a gap, a self reference named', () => {
  const rooms = model.roomsOf(DOC, PROJECTION)
  const lines = model.floorEdges(rooms, DOC.expression_ref, new Set(['expression:walk']))
  assert.deepEqual(lines.map(line => [line.source, line.target, line.kind]), [
    [rooms[0].key, rooms[1].key, 'path'], [rooms[1].key, rooms[2].key, 'path'], [rooms[2].key, rooms[3].key, 'broken'],
  ])
  assert.equal(lines[2].label, 'broken', 'a broken line names itself on the floor')
  assert.equal(lines[0].label, '', 'a plain path line is unlabelled')
  const drafted = model.composedRooms(rooms, DOC.expression_ref, [...discoverRegions(DOC), {name: 'New', scene_ref: null, member: null}, {name: 'Self', scene_ref: null, member: {expression_ref: DOC.expression_ref, title: 'self'}}])
  const draftLines = model.floorEdges(drafted, DOC.expression_ref, null)
  assert.deepEqual(draftLines.slice(-2).map(line => line.kind), ['gap', 'self'], 'an unsaved empty region is a gap; this palace\'s own Expression is a self reference')
  assert.equal(drafted.at(-2).saved, false)
  // a reorder of the regions re-derives the lines, never re-authored
  const reordered = model.composedRooms(rooms, DOC.expression_ref, [...discoverRegions(DOC)].reverse())
  assert.deepEqual(model.floorEdges(reordered, DOC.expression_ref, null).map(line => line.target), [rooms[1].key, rooms[3].key, rooms[2].key])
})

test('T16: an edge naming a room the floor does not hold is dropped, never drawn; a self reference keeps its word', () => {
  const lines = boardEdges([
    {from: 'Walk', to: 'Gate', kind: 'path', reason: 'Gate stands on the guided path'},
    {from: 'Gate', to: 'Night', kind: 'broken', reason: 'Night names a missing Expression'},
    {from: 'Night', to: 'Ghost', kind: 'gap', reason: 'Ghost holds no Expression yet'},
  ], ['Walk', 'Gate', 'Night'])
  assert.deepEqual(lines.map(line => [line.source, line.target, line.kind]), [['Walk', 'Gate', 'path'], ['Gate', 'Night', 'broken']], 'the line to Ghost is dropped')
  assert.equal(new Set(lines.map(line => line.id)).size, lines.length, 'every line has its own id')
  const [self] = boardEdges([{from: 'A', to: 'B', kind: 'self', reason: 'B contains this Palace own Expression'}], ['A', 'B'])
  assert.equal(self.label, 'self')
  assert.match(self.reason, /own Expression/)
})

test('T17: the walk\'s focus stands in the room that holds the focused ref; a ref no room holds focuses none', () => {
  const rooms = [{name: 'Walk', refs: ['oi.expression:walk', 'scene:walk']}, {name: 'Gate', refs: []}, {name: 'Night', refs: ['oi.expression:night']}]
  assert.equal(boardFocusName(rooms, 'oi.expression:night'), 'Night')
  assert.equal(boardFocusName(rooms, 'oi.scene:elsewhere'), null, 'a ref that is in no room focuses no room')
  assert.equal(boardFocusName(rooms, null), null)
  const palaceRooms = model.roomsOf(DOC, PROJECTION)
  assert.equal(model.roomOfStep(palaceRooms, palaceRooms[1].key), palaceRooms[1].key, 'a journey step is the room\'s own Scene')
  assert.equal(model.roomOfStep(palaceRooms, 'wiki:node:carving'), palaceRooms[1].key, 'or a subject the room holds')
  assert.equal(model.roomOfStep(palaceRooms, DOC.expression_ref), null, 'the whole itself stands in no room')
})

test('the floor writes no native document, adds no control, and its moves are the presence owner\'s', () => {
  const floor = source('PalaceFloor.tsx')
  assert.doesNotMatch(floor, /planRegions|scene_body_set|scene_create|scene_remove|kernelOp|\.edit\(|invoke_action/, 'the floor writes no document')
  assert.doesNotMatch(floor, /<button\b|<input\b|<select\b/, 'the floor draws no control: the palace\'s controls are the M5 plate\'s and the transport\'s')
  assert.match(floor, /moveRooms\(\{\[done\.key\]: done\.at\}\)/, 'one drag is one move, on its release')
  assert.match(floor, /onDoubleClick=\{\(\) => openRoom\(room\.key\)\}/, 'a double-click opens the room')
  assert.match(floor, /floorEdges\(rooms, inside\.doc\.expression_ref, liveRefs\(inside\)\)/, 'the lines derive from the guided path, not a second set')
  assert.match(source('palaceSession.ts'), /export function moveRooms[\s\S]*?persist\(\{\.\.\.palaceComposition\(here\.reading\), board: next\}, here\.reading\)/, 'a move saves through the presence owner only')
})

test('the floor draws its colours from tokens only', () => {
  const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(/
  for (const file of ['palaces.css', 'PalaceFloor.tsx', 'palacesModel.ts', 'PalacePlate.tsx']) assert.doesNotMatch(source(file), colour, `${file} names no colour of its own`)
})
