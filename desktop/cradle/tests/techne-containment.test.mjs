// lane-2 T9b — the containment (part) family and its parent → child pairs.
// The authority classifies explicit containment verbs only; the direction is the
// owner's: `A part_of B` makes B the parent, `A contains B` makes A the parent.
// An unrecognised verb stays in the relation field and never becomes containment.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  causalChains,
  containmentPairs,
  projectionForRelation,
  relationEdges,
  relationField,
} from '../src/techne/m0m5/timeline/relations.ts';

const reading = (relations) => ({
  reading_ref: 'reading:containment',
  subject: {subject_ref: 'subject:war', native_owner: 'owner:test'},
  whole: {whole_ref: 'whole:war', relations},
  disclosure: {instruments: []},
});
const rel = (relation, from_ref, to_ref) => ({relation, from_ref, to_ref});

test('every explicit containment verb, in any casing and separator, is the part family', () => {
  for (const verb of ['part_of', 'PART OF', 'part-of', 'partOf', 'contains', 'CONTAIN', 'has_part', 'has part', 'within', 'WITHIN', 'sub_event_of', 'sub-event-of', 'subEventOf'])
    assert.equal(projectionForRelation(verb), 'part', `${verb} is containment`);
});

test('an unrecognised verb never becomes containment: it stays in the relation field only', () => {
  for (const verb of ['includes', 'part', 'belongs_to', 'member_of', 'contained_by', 'surrounds', 'part_of_nothing'])
    assert.equal(projectionForRelation(verb), 'field', `${verb} is not an explicit containment verb`);
});

test('the existing families keep their verbs: containment added no cause, echo or opposition member', () => {
  assert.equal(projectionForRelation('CAUSES'), 'cause');
  assert.equal(projectionForRelation('ECHOES'), 'echo');
  assert.equal(projectionForRelation('INSTANTIATES'), 'echo');
  assert.equal(projectionForRelation('OPPOSES'), 'opposition');
  assert.equal(projectionForRelation('TRANSFORMS_INTO'), 'opposition');
});

test('a child-first verb makes its object the parent: A part_of B and A within B and A sub_event_of B', () => {
  const pairs = containmentPairs(relationEdges(reading([
    rel('part_of', 'battle:1', 'war:1'),
    rel('within', 'event:3', 'battle:1'),
    rel('sub_event_of', 'event:4', 'battle:2'),
  ])));
  assert.deepEqual(pairs, [
    {parent: 'war:1', child: 'battle:1'},
    {parent: 'battle:1', child: 'event:3'},
    {parent: 'battle:2', child: 'event:4'},
  ]);
});

test('a parent-first verb makes its subject the parent: A contains B and A has_part B', () => {
  const pairs = containmentPairs(relationEdges(reading([
    rel('contains', 'war:1', 'battle:1'),
    rel('has_part', 'battle:1', 'event:1'),
  ])));
  assert.deepEqual(pairs, [
    {parent: 'war:1', child: 'battle:1'},
    {parent: 'battle:1', child: 'event:1'},
  ]);
});

test('the same containment stated both ways is one pair, and a self-pair is never containment', () => {
  const pairs = containmentPairs(relationEdges(reading([
    rel('part_of', 'battle:1', 'war:1'),
    rel('contains', 'war:1', 'battle:1'),
    rel('part_of', 'event:9', 'event:9'),
  ])));
  assert.deepEqual(pairs, [{parent: 'war:1', child: 'battle:1'}]);
});

test('causal, echo, opposition and unrecognised relations contribute no containment pair', () => {
  const edges = relationEdges(reading([
    rel('CAUSES', 'a', 'b'),
    rel('ECHOES', 'a', 'c'),
    rel('OPPOSES', 'a', 'd'),
    rel('mystery_link', 'a', 'e'),
  ]));
  assert.deepEqual(containmentPairs(edges), []);
});

test('containment is structure only: an undated containment still pairs, and the cause chains are untouched', () => {
  const field = relationField(reading([
    rel('part_of', 'battle:1', 'war:1'),
    rel('CAUSES', 'battle:1', 'battle:2'),
  ]));
  assert.deepEqual(containmentPairs(field.edges), [{parent: 'war:1', child: 'battle:1'}]);
  assert.deepEqual(causalChains(field).map((chain) => chain.map((edge) => edge.relation)), [['CAUSES']]);
  assert.deepEqual(field.unclassified_relations, [], 'part_of is classified, so it is not reported unclassified');
});

test('the relation field lists the part family by its verbatim type, and reports only the verbs it does not know', () => {
  const field = relationField(reading([
    rel('part_of', 'battle:1', 'war:1'),
    rel('mystery_link', 'battle:1', 'war:1'),
  ]));
  assert.ok(field.families.some((family) => family.relation === 'part_of' && family.edges.length === 1), 'part_of keeps its own family');
  assert.deepEqual(field.unclassified_relations, ['mystery_link']);
});
