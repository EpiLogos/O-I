// lane-5 T15: the Palace board. Regions arrange freely over the Research Canvas: a move holds a point, grid snap is an
// authoring aid, a marquee hands its names to the region list, and no move touches the Palace document or its plan.
// The pure board runs from the build (npm run build:journeys first); the native document proof reads the composition
// floor through the production-source loader, and the wiring proofs read the source text, as snap-model.test.mjs does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
import {
  BOARD_GRID, BOARD_SNAP_REACH, BOARD_REGION_SIZE, boardPositions, boardNodes, boardSelection, boardSelectionLine,
  defaultBoardPoint, forgetBoardRegion, isBoardPoint, moveBoardRegion, snapBoardPoint, validateBoardPositions,
} from '../build/palaceBoard.js';

register('../../../../../packages/expressions-boundary/tests/editor-source-loader.mjs', import.meta.url);
const {discoverRegions, planRegions} = await import('../../../src/techne/m0m5/palace/composition.ts');

const here = fileURLToPath(new URL('.', import.meta.url));
const source = (name) => readFileSync(join(here, '../src', name), 'utf8');

test('regions the board does not hold yet are placed in walk order, on the grid', () => {
  const placed = boardPositions(['A', 'B', 'C', 'D'], {});
  assert.deepEqual(placed.A, defaultBoardPoint(0));
  assert.deepEqual(placed.D, defaultBoardPoint(3));
  for (const name of ['A', 'B', 'C', 'D']) {
    assert.equal(placed[name].x % BOARD_GRID, 0, `${name} x is on the grid`);
    assert.equal(placed[name].y % BOARD_GRID, 0, `${name} y is on the grid`);
  }
  assert.ok(placed.B.x > placed.A.x && placed.B.y === placed.A.y, 'columns run left to right');
  assert.ok(placed.D.x === placed.A.x && placed.D.y > placed.A.y, 'the next row sits below, from the left');
});

test('a held point wins over the walk default; a name the Palace does not carry is never placed', () => {
  const placed = boardPositions(['A', 'B'], {A: {x: 37, y: -12}, Ghost: {x: 1, y: 1}});
  assert.deepEqual(placed.A, {x: 37, y: -12});
  assert.equal('Ghost' in placed, false);
  assert.deepEqual(placed.B, defaultBoardPoint(1));
});

test('grid snap is an authoring aid: on, a point within reach lands on the grid; off, it stays exact', () => {
  // The Research Canvas grid: CANVAS_UNITS/4 with reach CANVAS_UNITS/16 (researchInstrumentsData.ts pins CANVAS_UNITS=400).
  assert.equal(BOARD_GRID, 100);
  assert.equal(BOARD_SNAP_REACH, 25);
  assert.deepEqual(snapBoardPoint({x: 207, y: 318}, true), {x: 200, y: 300});
  assert.deepEqual(snapBoardPoint({x: 160, y: 318}, true), {x: 160, y: 300}, 'an axis outside reach stays where it was dropped');
  assert.deepEqual(snapBoardPoint({x: 207, y: 318}, false), {x: 207, y: 318}, 'snap off is identity');
  const garbage = snapBoardPoint({x: Number.NaN, y: 4}, true);
  assert.equal(isBoardPoint(garbage), false, 'a non-finite point is never invented into a position');
});

test('a move holds exactly one named region; an unknown name or a non-finite point changes nothing', () => {
  const names = ['A', 'B', 'C'];
  const held = {A: {x: 100, y: 100}};
  const moved = moveBoardRegion(held, names, 'C', {x: 900, y: 40});
  assert.deepEqual(moved, {A: {x: 100, y: 100}, C: {x: 900, y: 40}});
  assert.equal(held.C, undefined, 'the input record is never mutated');
  assert.equal(moveBoardRegion(held, names, 'Ghost', {x: 1, y: 1}), held);
  assert.equal(moveBoardRegion(held, names, 'B', {x: Number.POSITIVE_INFINITY, y: 1}), held);
});

test('removing a region leaves no held point behind', () => {
  const held = {A: {x: 1, y: 2}, B: {x: 3, y: 4}};
  assert.deepEqual(forgetBoardRegion(held, 'A'), {B: {x: 3, y: 4}});
  assert.equal(forgetBoardRegion(held, 'Z'), held);
});

test('a marquee selection names the regions it covers in walk order, dropping ids the Palace does not carry', () => {
  assert.deepEqual(boardSelection(['A', 'B', 'C'], ['C', 'Ghost', 'A']), ['A', 'C']);
  assert.deepEqual(boardSelection(['A', 'B'], []), []);
  assert.equal(boardSelectionLine([]), 'No regions selected on the board.');
  assert.equal(boardSelectionLine(['A']), 'Selected 1 region: A. The region list shows it.');
  assert.equal(boardSelectionLine(['A', 'B']), 'Selected 2 regions: A, B. The region list shows them.');
});

test('a stored arrangement is accepted only when every held point is finite; unknown names drop, never repair', () => {
  const names = ['A', 'B'];
  assert.deepEqual(validateBoardPositions({A: {x: 5, y: 6}, Gone: {x: 1, y: 1}}, names), {A: {x: 5, y: 6}});
  assert.equal(validateBoardPositions({A: {x: 5, y: '6'}}, names), null);
  assert.equal(validateBoardPositions({A: {x: Number.NaN, y: 1}}, names), null);
  assert.equal(validateBoardPositions(['not', 'a', 'record'], names), null);
  assert.equal(validateBoardPositions(null, names), null);
  assert.deepEqual(validateBoardPositions({}, names), {});
});

test('each region is a sticky card of the research canvas: its size, a palette token fill, its member in its title', () => {
  const nodes = boardNodes(
    [{name: 'Walk', member: null}, {name: 'Gate', member: {title: 'Gateway', expression_ref: 'expression:gate'}}],
    {Walk: {x: 100, y: 100}, Gate: {x: 400, y: 100}},
    ['Gate'],
  );
  assert.equal(nodes[0].type, 'sticky');
  assert.deepEqual(nodes[0].size, BOARD_REGION_SIZE);
  assert.equal(nodes[0].bgColour, 'var(--canvas-object-stone)');
  assert.match(nodes[0].bgColour, /^var\(--canvas-object-[a-z]+\)$/);
  assert.equal(nodes[0].title, 'Walk');
  assert.equal(nodes[1].title, 'Gate · Gateway');
  assert.deepEqual([nodes[0].selected, nodes[1].selected], [false, true]);
  assert.deepEqual(nodes[1].position, {x: 400, y: 100});
});

test('moving regions on the board leaves the Palace document and its region plan byte-identical', () => {
  // A kernel-shaped Palace document: two region Scenes with one contained Expression, one without.
  const doc = {
    expression_ref: 'expression:palace-board',
    revision: 4,
    scenes: [
      {
        scene_ref: 'expression:palace-board:scene:region-Walk', title: 'Walk',
        body: {carrier: 'expression_ref', subject_ref: 'expression:walk'},
        triggers: [{trigger_ref: 'expression:palace-board:trigger:region-Walk-portal', target: {kind: 'portal', subject_ref: 'expression:walk'}}],
      },
      {scene_ref: 'expression:palace-board:scene:region-Gate', title: 'Gate', body: null},
      {scene_ref: 'expression:palace-board:scene:region-Night', title: 'Night', body: null},
    ],
  };
  const regions = discoverRegions(doc);
  const names = regions.map((region) => region.name);
  const before = JSON.stringify(doc);
  const planBefore = planRegions(doc, regions, []);

  // The move-only interaction: three drags (one snapped), a marquee over two, and the board's own redraw.
  let held = {};
  held = moveBoardRegion(held, names, 'Walk', {x: 700, y: 300});
  held = moveBoardRegion(held, names, 'Gate', snapBoardPoint({x: 412, y: 88}, true));
  held = moveBoardRegion(held, names, 'Night', {x: -120, y: 640});
  const selected = boardSelection(names, ['Walk', 'Night']);
  boardNodes(regions.map((region) => ({name: region.name, member: region.member})), boardPositions(names, held), selected);

  assert.equal(JSON.stringify(doc), before, 'the Palace document is byte-identical after a move-only interaction');
  assert.equal(planBefore, null, 'the unchanged regions plan no change before the moves');
  assert.equal(planRegions(doc, regions, []), null, 'and still plan no change after them: nothing is saved by a move');
  assert.deepEqual(discoverRegions(doc).map((region) => region.name), names, 'the walk order of the Scenes is untouched');
});

test('the board is the Research Canvas: its CanvasView, gesture transaction, previews and the frame grid snap', () => {
  const view = source('palaceBoardView.tsx');
  for (const token of ['CanvasView', 'createGestureTransaction', 'withGesturePreviews', 'snapBoardPoint', 'selectionOnDrag', 'onMoveNodeEnd', 'onMoveNodePreview']) {
    assert.ok(view.includes(token), `the view uses ${token}`);
  }
  assert.match(view, /from '\.\.\/\.\.\/vendor\/research-canvas\/components'/);
  assert.match(view, /from '\.\/canvasGesture\.js'/);
  assert.match(source('palaceBoard.ts'), /import \{snapToGrid\} from '\.\/canvasRepertoire\.js';/);
  assert.match(source('palaceBoard.ts'), /import \{CANVAS_TOOL_SPEC, paletteToken/);
});

test('the board has no drag system of its own and writes no native document', () => {
  for (const file of ['palaceBoardView.tsx', 'palaceBoard.ts']) {
    const text = source(file);
    assert.doesNotMatch(text, /addEventListener\(\s*['"]pointer/, `${file} adds no pointer listener`);
    assert.doesNotMatch(text, /composeExpression|planRegions|scene_body_set|scene_create|scene_remove|nativeExpressionRequest|expression\.edit/, `${file} writes no document`);
  }
  assert.match(source('researchInstrumentsData.ts'), /export const CANVAS_UNITS=400;/, 'the grid constants trace to the research canvas unit');
});

test('the board draws its colours from tokens only', () => {
  const css = source('palaceInstrument.css').split('/* lane-5 T15')[1];
  assert.ok(css, 'the T15 block is present');
  const colour = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
  assert.doesNotMatch(css, colour);
  assert.doesNotMatch(source('palaceBoardView.tsx'), colour);
  assert.doesNotMatch(source('palaceBoard.ts'), colour);
});

test('the region list stays the walk order beside the board; removing a region forgets its point', () => {
  const panel = source('palaceInstrument.tsx');
  assert.match(panel, /<PalaceBoardView /);
  assert.match(panel, /Guided path · walk order/);
  assert.match(panel, /\{regions\.map\(\(region,index\)=>/, 'the list still maps every region in walk order');
  assert.match(panel, /aria-label=\{`Move \$\{region\.name\} earlier in the guided path`\}/, 'the walk controls stay');
  assert.match(panel, /setBoard\(forgetBoardRegion\(heldRef\.current,name\)\)/);
  assert.match(panel, /planRegions\(draftDoc,proposed,\[\.\.\.removed\]\)/, 'the save path is untouched');
});
