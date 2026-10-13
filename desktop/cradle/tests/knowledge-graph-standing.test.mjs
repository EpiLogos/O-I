import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAPH_STANDING_TOKEN, graphEdgeStanding} from '../src/knowledge/graphEmphasis.ts';
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
