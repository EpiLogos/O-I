import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorldPresentationProjection } from './presentation-projection.mjs';
import { projectedAuthoredRelationRoutes } from './projection-reading.mjs';

function publicProjection() {
  return createWorldPresentationProjection({
    projection: { schema: 'oi.projection/v1', projection_ref: 'projection:relations', projection_revision: 1, state: 'published', subject: { ref: 'project:public', kind: 'project' }, source: { system: 'filesystem', ref: 'Work/public', revision: 'tree@1' }, publisher_participant_ref: 'participant:test', published_at: '2026-08-25T00:00:00Z', audience: { visibility: 'public' }, provenance: [{ kind: 'closure-fixture', ref: 'fixture:authored-relations', source_system: 'oi-test', revision: 'fixture@1' }] },
    presentation: { schema: 'oi.world-presentation/v1', presentation_ref: 'presentation:relations', world_ref: 'project:public', revision: 1, title: 'Public', theme: { tokens: {} }, provenance: [{ kind: 'closure-fixture', ref: 'fixture:authored-relations', source_system: 'oi-test', revision: 'fixture@1' }], regions: [{ region_ref: 'wiki', role: 'relation', bindings: [
      { schema: 'oi.presentation-binding/v1', binding_ref: 'source', component_ref: 'component:source', subject_ref: 'source:public', props: {}, fallback: { title: 'Source', text: 'Source' }, provenance: [{ kind: 'closure-fixture', ref: 'fixture:authored-relations', source_system: 'oi-test', revision: 'fixture@1' }] },
      { schema: 'oi.presentation-binding/v1', binding_ref: 'target', component_ref: 'component:target', subject_ref: 'wiki:public', props: {}, fallback: { title: 'Target', text: 'Target' }, provenance: [{ kind: 'closure-fixture', ref: 'fixture:authored-relations', source_system: 'oi-test', revision: 'fixture@1' }] },
    ] }] },
  });
}

const localRelations = { subject_ref: 'source:public', resolved: { edges: [
  { from: 'source:public', to: 'wiki:public', relation: 'references', origin: { authority: 'authored' } },
  { from: 'source:public', to: 'wiki:private', relation: 'references', origin: { authority: 'authored' } },
] }, pending: [{ evidence: { raw_target: 'Unpublished Future' } }], authored_edges: [
  { ref: 'edge:public', from_ref: 'source:public', to_ref: 'wiki:public', relation: 'references', provenance: [{ source_ref: 'source:public', source_revision: 'rev-1' }] },
  { ref: 'edge:private', from_ref: 'source:public', to_ref: 'wiki:private', relation: 'references', provenance: [{ source_ref: 'source:public', source_revision: 'rev-1' }] },
] };

test('public authored routes include only explicitly projected endpoints and preserve local input', () => {
  const before = JSON.stringify(localRelations);
  const routes = projectedAuthoredRelationRoutes(publicProjection(), localRelations, { 'source:public': '/p/source', 'wiki:public': '/p/target', 'wiki:private': '/private/secret' });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].edge_ref, 'edge:public');
  assert.equal(routes[0].to_route, '/p/target');
  assert.ok(!JSON.stringify(routes).includes('wiki:private'));
  assert.ok(!JSON.stringify(routes).includes('Unpublished Future'));
  assert.equal(JSON.stringify(localRelations), before);
});

test('non-public Projection emits no authored public routes', () => {
  const projection = publicProjection();
  projection.audience.visibility = 'private';
  assert.deepEqual(projectedAuthoredRelationRoutes(projection, localRelations, { 'source:public': '/p/source', 'wiki:public': '/p/target' }), []);
});
