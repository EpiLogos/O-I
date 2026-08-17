import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferentExploreApplication } from '../shared-field/referent.mjs';
import { createReferentBrowserReadModel } from './referent-read-model.mjs';

const bytes = Buffer.from('browser aggregate');
const projection = ref => ({
  schema: 'oi.projection/v1', projection_ref: ref, projection_revision: 1, state: 'published',
  subject: { ref: `${ref}:source`, kind: 'artifact' }, source: { system: 'fixture', revision: '1' },
  publisher_participant_ref: `participant:${ref}`, published_at: '2026-08-17T12:00:00.000Z',
  audience: { visibility: 'public', refs: [] },
  representation: { kind: 'application/pdf', payload: { bytes_base64: bytes.toString('base64') } },
  provenance: [{ kind: 'fixture', ref, source_system: 'fixture', revision: '1' }],
});
const entry = ref => ({
  schema: 'oi.explore-entry/v1', ref, kind: 'projection', world_ref: `world:${ref}`, label: 'Common paper',
  aliases: [], provenance: [{ kind: 'fixture', ref, source_system: 'fixture', revision: '1' }], locators: [], projection_ref: ref,
});

test('browser read model exposes the requested COMMON/FORMS/VERSIONS/PROJECTIONS/PROVENANCE/RELATIONS/CONTRIBUTIONS sections', () => {
  const seed = { entries: [entry('projection:a'), entry('projection:b')], projections: [projection('projection:a'), projection('projection:b')] };
  const ref = createReferentExploreApplication(seed).referentFor('projection:a');
  const model = createReferentBrowserReadModel(seed, ref);
  assert.deepEqual(Object.keys(model.sections), ['COMMON', 'FORMS', 'VERSIONS', 'PROJECTIONS', 'PROVENANCE', 'RELATIONS', 'CONTRIBUTIONS']);
  assert.equal(model.summary.holdings, 2);
  assert.equal(model.privacy.hidden_member_count, 'not-computed');
});
