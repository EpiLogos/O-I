import test from 'node:test';
import assert from 'node:assert/strict';
import {isUnresolvedGraphNode, projectUnresolvedGraph, unresolvedAssociationsAllowed, unresolvedGraphAssociations} from '../src/knowledge/graphNavigation.ts';
import {defaultGraphFilters, filterGraph} from '../src/knowledge/filters.ts';

const provenance = {source: 'central:wiki', revision: 'r1'};
const subject = (ref) => ({ref, kind: 'wiki-node', label: ref, native_owner: 'central', provenance, actions: [], address: {kind: 'wiki', value: ref}});
const reading = () => ({
  schema: 'oi.cradle.graph-reading/v1',
  nodes: [subject('central:node:a'), subject('central:node:b')],
  edges: [{relation: 'wiki-link', from_ref: 'central:node:a', to_ref: 'central:node:b', provenance}],
  inputs: {}, counts: {},
  unresolved_links: [
    {key: 'Missing Page', sources: {'central:node:a': 2}, provenance},
    {key: 'Missing Page', sources: {'central:node:b': 1, 'central:node:absent': 1}, provenance},
    {key: 'Other', sources: {'central:node:b': 1}, provenance},
  ],
});

test('unresolved keys collapse to one quiet ghost each, labelled with the key and inventing no subject', () => {
  const source = reading(), before = structuredClone(source);
  const projected = projectUnresolvedGraph(source);
  const ghosts = projected.nodes.filter(isUnresolvedGraphNode);
  assert.equal(ghosts.length, 2, 'two distinct keys make two ghosts');
  const missing = ghosts.find(node => node.label === 'Missing Page');
  assert.ok(missing);
  assert.equal(missing.kind, 'unresolved-link');
  assert.equal(missing.native_owner, 'graph-presentation');
  assert.equal(missing.address, undefined, 'a ghost never carries a native address');
  assert.equal(missing.subject_ref, undefined, 'a ghost never carries a subject');
  assert.deepEqual(missing.actions, [], 'a ghost offers no native action');
  assert.deepEqual(missing.unresolved.sources, {'central:node:a': 2, 'central:node:b': 1, 'central:node:absent': 1});
  assert.deepEqual(source, before, 'the owner reading is never mutated');
  assert.equal(projected.edges.length, source.edges.length, 'ghosts add no native edges');
});

test('repeated disclosures of one source keep the maximum occurrence count, never a sum', () => {
  const source = reading();
  source.unresolved_links = [{key: 'Dup', sources: {'central:node:a': 2}, provenance}, {key: 'Dup', sources: {'central:node:a': 2}, provenance}];
  const [ghost] = projectUnresolvedGraph(source).nodes.filter(isUnresolvedGraphNode);
  assert.deepEqual(ghost.unresolved.sources, {'central:node:a': 2});
});

test('a ghost ref never collides with a native ref', () => {
  const source = reading();
  source.nodes.push(subject(`view:unresolved-link:${encodeURIComponent('Missing Page')}`));
  const ghost = projectUnresolvedGraph(source).nodes.find(isUnresolvedGraphNode);
  assert.notEqual(ghost.ref, `view:unresolved-link:${encodeURIComponent('Missing Page')}`);
});

test('associations attach only to sources the reading admits and never fabricate an endpoint', () => {
  const projected = projectUnresolvedGraph(reading());
  const associations = unresolvedGraphAssociations(projected.nodes);
  assert.deepEqual(associations.map(link => [link.source, link.occurrences]).sort(), [['central:node:a', 2], ['central:node:b', 1], ['central:node:b', 1]].sort());
  assert.ok(!associations.some(link => link.source === 'central:node:absent'));
});

test('the unresolved toggle gates associations and hides ghosts from the filtered graph', () => {
  const shown = defaultGraphFilters();
  assert.equal(unresolvedAssociationsAllowed(shown), true);
  assert.equal(unresolvedAssociationsAllowed({...shown, unresolved: false}), false);
  assert.equal(unresolvedAssociationsAllowed({...shown, relations: ['supports']}), false);
  assert.equal(unresolvedAssociationsAllowed({...shown, families: ['hosted']}), false);
  const projected = projectUnresolvedGraph(reading());
  assert.equal(filterGraph(projected, shown).nodes.filter(isUnresolvedGraphNode).length, 2);
  assert.equal(filterGraph(projected, {...shown, unresolved: false}).nodes.filter(isUnresolvedGraphNode).length, 0);
});
