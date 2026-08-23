import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canContemplate,
  freshnessLabel,
  livingSummary,
  relatedLivingState,
} from './living-wiki-model.ts';

function fixture() {
  return {
    version: 'oi.desktop-living-wiki/v1',
    world_ref: 'project:test',
    provider: 'central.filesystem-reconcile/v1',
    cursor: 7,
    changed: [
      {
        source_ref: 'central:source:project:test:README.md',
        cursor: 7,
        kind: 'modified',
        roles: ['purpose'],
        provenance: 'human-authored',
        standing: 'authored-human-position',
        agent_retrieval_allowed: false,
      },
    ],
    impact: {
      direct: {
        changed_sources: ['central:source:project:test:README.md'],
        affected: [
          {
            resource: 'wiki:node:purpose',
            source: 'central:source:project:test:README.md',
            relation: 'wiki-provenance',
            freshness: 'basis-changed',
            basis_revision: 'r1',
            observed_revision: 'r2',
          },
        ],
        automatic_agent_or_model_invocation: false,
      },
      transitive: [
        {
          resource: 'wiki:reading:whole',
          root_source: 'central:source:project:test:README.md',
          relation: 'integrative-basis',
          freshness: 'integration-pending',
        },
      ],
      paths: [
        {
          resource: 'wiki:reading:whole',
          root_source: 'central:source:project:test:README.md',
          freshness: 'integration-pending',
          steps: [
            { from: { kind: 'source', ref: 'central:source:project:test:README.md' }, to: 'wiki:node:purpose', relation: 'wiki-provenance' },
            { from: { kind: 'resource', ref: 'wiki:node:purpose' }, to: 'wiki:reading:whole', relation: 'integrative-basis' },
          ],
        },
      ],
      pending_integration: ['wiki:reading:whole'],
      truncated: false,
      automatic_agent_or_model_invocation: false,
    },
    source_payloads_exposed: false,
    automatic_agent_or_model_invocation: false,
    source_authority_owner: 'central',
    impact_owner: 'ai-kit',
    contemplate_owner: 'ai-kit',
  };
}

test('summary counts exact owner identities across direct and transitive impact', () => {
  assert.deepEqual(livingSummary(fixture()), { changed: 1, affected: 2, pending: 1 });
});

test('selection relation is stable-ref exact rather than filename inference', () => {
  const reading = fixture();
  const source = relatedLivingState(reading, 'central:source:project:test:README.md');
  assert.equal(source.changed.length, 1);
  assert.equal(source.affected.length, 2);
  assert.equal(source.paths.length, 1);

  const filename = relatedLivingState(reading, 'README.md');
  assert.equal(filename.changed.length, 0);
  assert.equal(filename.affected.length, 0);
  assert.equal(filename.paths.length, 0);
});

test('freshness language preserves moved-basis semantics instead of declaring falsehood', () => {
  assert.equal(freshnessLabel('basis-changed'), 'Basis changed');
  assert.equal(freshnessLabel('integration-pending'), 'Pending integration');
  assert.notEqual(freshnessLabel('basis-changed'), 'Invalid');
  assert.notEqual(freshnessLabel('basis-changed'), 'False');
});

test('private change metadata never implies source payload exposure or automatic contemplation', () => {
  const reading = fixture();
  assert.equal(reading.changed[0].agent_retrieval_allowed, false);
  assert.equal(reading.source_payloads_exposed, false);
  assert.equal(reading.automatic_agent_or_model_invocation, false);
  assert.equal(reading.impact.automatic_agent_or_model_invocation, false);
});

test('contemplate action requires an explicit stable selection', () => {
  assert.equal(canContemplate(undefined), false);
  assert.equal(canContemplate(''), false);
  assert.equal(canContemplate('wiki:reading:whole'), true);
});
