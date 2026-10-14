import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPH_STANDING_TOKEN, graphEdgeStanding} from '../src/knowledge/graphEmphasis.ts';
import {advanceGraphCaptions, graphCaptionAlpha} from '../src/knowledge/graphRelationPresentation.ts';
import {STANDING_LEGEND} from '../src/techne/m0m5/timeline/standing.ts';

const edge = (fields) => ({relation: 'supports', from_ref: 'a', to_ref: 'b', provenance: {source: 'central:wiki'}, ...fields});

test('an edge with no disclosed standing is unavailable, and read provenance never upgrades it', () => {
  const reading = graphEdgeStanding(edge({}));
  assert.equal(reading.visual, 'unavailable');
  assert.equal(reading.verbatim, null);
  assert.equal(graphEdgeStanding(edge({provenance: {source: 'central:wiki', revision: 'r9'}})).visual, 'unavailable');
});

test('the owner standing string classifies conservatively and rides verbatim', () => {
  assert.equal(graphEdgeStanding(edge({standing: 'disputed attribution'})).visual, 'disputed');
  assert.equal(graphEdgeStanding(edge({standing: 'mythic tradition'})).visual, 'mythic');
  assert.equal(graphEdgeStanding(edge({standing: 'interpretation'})).visual, 'derived');
  const authored = graphEdgeStanding(edge({standing: 'attested by the owner'}));
  assert.equal(authored.visual, 'authored');
  assert.equal(authored.verbatim, 'attested by the owner');
});

test('a cited source on the authored relation makes the edge sourced, and an interpretive standing still wins over it', () => {
  assert.equal(graphEdgeStanding(edge({standing: 'stated', authored_relation: {source_ref: 'central:source:x'}})).visual, 'sourced');
  assert.equal(graphEdgeStanding(edge({standing: 'interpretation', authored_relation: {source_ref: 'central:source:x'}})).visual, 'derived');
});

test('every standing class in the legend has a caption tone token', () => {
  for (const row of STANDING_LEGEND) assert.ok(typeof GRAPH_STANDING_TOKEN[row.visual] === 'string' && GRAPH_STANDING_TOKEN[row.visual].startsWith('--oi-'), row.visual);
  assert.equal(Object.keys(GRAPH_STANDING_TOKEN).length, STANDING_LEGEND.length);
});

test('a relation caption eases in from its emphasis and eases out after it leaves; reduced motion switches at once', () => {
  const eased = 240;
  assert.equal(graphCaptionAlpha({since: 1000}, 1000, eased), 0, 'it begins invisible');
  assert.equal(graphCaptionAlpha({since: 1000}, 1120, eased), .5, 'it is half in at half the motion duration');
  assert.equal(graphCaptionAlpha({since: 1000}, 2000, eased), 1, 'it is fully in and stays there');
  assert.equal(graphCaptionAlpha({since: 1000, leftAt: 2000}, 2000, eased), 1, 'it leaves from full strength');
  assert.equal(graphCaptionAlpha({since: 1000, leftAt: 2000}, 2120, eased), .5, 'it is half out at half the duration');
  assert.equal(graphCaptionAlpha({since: 1000, leftAt: 2000}, 2300, eased), 0, 'it is gone once the fade completes');
  assert.equal(graphCaptionAlpha({since: 1000}, 1000, 0), 1, 'reduced motion shows an emphasised caption at once');
  assert.equal(graphCaptionAlpha({since: 1000, leftAt: 2000}, 2000, 0), 0, 'reduced motion removes a departed caption at once');
  assert.equal(graphCaptionAlpha({since: Number.NaN}, 1000, eased), 0, 'a non-finite time never shows a caption');
});

test('a caption begins on its emphasis frame, eases in, eases out after it leaves, then is dropped', () => {
  const lives = new Map(), eased = 240;
  const at = (live, now) => advanceGraphCaptions(lives, new Set(live), now, eased);
  let frame = at([7], 1000);
  assert.deepEqual(frame.drawn, [], 'the first frame of emphasis is still at zero strength');
  assert.equal(frame.fading, true, 'an emphasised caption schedules the next frame to ease in');
  frame = at([7], 1120);
  assert.deepEqual(frame.drawn, [{index: 7, alpha: .5}], 'a caption draws on the frames after it begins, never deleted before it shows');
  frame = at([7], 1240);
  assert.deepEqual(frame, {drawn: [{index: 7, alpha: 1}], fading: false}, 'a fully emphasised caption stops scheduling frames');
  frame = at([], 2000);
  assert.deepEqual(frame.drawn, [{index: 7, alpha: 1}], 'a departed caption leaves from full strength');
  assert.equal(frame.fading, true);
  frame = at([], 2120);
  assert.deepEqual(frame.drawn, [{index: 7, alpha: .5}], 'and eases out');
  frame = at([], 2300);
  assert.deepEqual(frame, {drawn: [], fading: false}, 'then it is gone and no frame is scheduled');
  assert.equal(lives.size, 0, 'the faded caption is dropped from the lives');
  frame = at([7], 2400);
  assert.equal(frame.fading, true, 're-emphasis begins a fresh caption');
});

test('reduced motion shows an emphasised caption at once and drops a departed one at once', () => {
  const lives = new Map();
  const shown = advanceGraphCaptions(lives, new Set([3]), 1000, 0);
  assert.deepEqual(shown, {drawn: [{index: 3, alpha: 1}], fading: false});
  const gone = advanceGraphCaptions(lives, new Set(), 1016, 0);
  assert.deepEqual(gone, {drawn: [], fading: false});
  assert.equal(lives.size, 0);
});
