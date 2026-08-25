import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createProjection, SPARSE_REPRESENTATION_SCHEMA } from '../shared-field/index.mjs';
import { compileEligibleAuthoredRelationProjection } from '../shared-field/presentation-projection.mjs';
import { projectionViewModel } from './projection-renderer.mjs';

const fixture = JSON.parse(await readFile(new URL('../suite/fixtures/authored-wiki-relations-150.json', import.meta.url), 'utf8'));

function projection(visibility = 'public') {
  return createProjection({
    projection_ref: 'projection:flow:public',
    projection_revision: 1,
    subject: { ref: fixture.relations.authored.subject_ref, kind: 'documentation.markdown' },
    source: { system: 'central', revision: 'rev-flow-7' },
    publisher_participant_ref: 'participant:human:author',
    published_at: '2026-08-25T00:00:00Z',
    audience: { visibility },
    representation: {
      kind: SPARSE_REPRESENTATION_SCHEMA,
      payload: {
        schema: SPARSE_REPRESENTATION_SCHEMA,
        title: 'Flow',
        description: 'Projected source representation',
        groups: [],
        meta: [],
      },
    },
    provenance: [{ kind: 'source', ref: fixture.selected_source, source_system: 'central', revision: 'rev-flow-7' }],
  });
}

test('public compiler emits only explicitly eligible authored relation routes', () => {
  const local = projection('public');
  const before = structuredClone(local);
  const compiled = compileEligibleAuthoredRelationProjection(local, fixture.relations.authored_edges, fixture.eligible_public_routes);
  const view = projectionViewModel(compiled);
  const related = view.groups.find((group) => group.label === 'Related');
  assert.ok(related);
  assert.ok(related.items.length >= 1);
  assert.ok(related.items.every((item) => item.ref === 'wiki:concept:living-wiki'));
  assert.ok(related.items.every((item) => item.href === '/explore/living-wiki'));
  assert.equal(JSON.stringify(related).includes(fixture.private_target), false);
  assert.deepEqual(local, before, 'public compilation must not mutate canonical Projection input');
});

test('local authored relation is not automatically public relation', () => {
  const privateProjection = projection('private');
  const compiled = compileEligibleAuthoredRelationProjection(privateProjection, fixture.relations.authored_edges, {
    ...fixture.eligible_public_routes,
    [fixture.private_target]: '/explore/private-should-not-leak',
  });
  assert.deepEqual(compiled, privateProjection);
  assert.equal(JSON.stringify(compiled).includes('/explore/private-should-not-leak'), false);
});

test('compiler ignores non-authored edges even when a public route exists', () => {
  const derived = structuredClone(fixture.relations.authored_edges[0]);
  derived.origin = 'learned';
  derived.to_ref = 'wiki:concept:learned-only';
  const compiled = compileEligibleAuthoredRelationProjection(projection('public'), [derived], {
    'wiki:concept:learned-only': '/explore/learned-only',
  });
  assert.equal(JSON.stringify(compiled).includes('/explore/learned-only'), false);
});

test('public compiler consumes relation objects and contains no source-language parser', async () => {
  const source = await readFile(new URL('../shared-field/presentation-projection.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('parse_authored_wiki_source'), false);
  assert.equal(source.includes('[[‘), false);
  assert.match(source, /origin !== 'authored'/);
  assert.match(source, /eligiblePublicRoutes/);
});
