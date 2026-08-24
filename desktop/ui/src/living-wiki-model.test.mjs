import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canContemplate,
  freshnessLabel,
  livingSummary,
  ownerObservation,
  qlPresentation,
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

function qlFixture() {
  return {
    subject: {
      reference: 'wiki:reading:whole',
      revision: 'r7',
      subject_type: 'integrative-reading',
      frame_ref: 'wiki:frame:whole',
      context_refs: ['wiki:node:purpose', 'wiki:node:implementation'],
    },
    lens: 'mef:lens:L0@1',
    sublens: 'mef:sublens:relation-family@1',
    frame: 'cf5',
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

test('FlowRef selection relates through its native owner SourceRef without identity collapse', () => {
  const reading = fixture();
  const sourceRef = 'central:source:project:test:notes/thread.md';
  reading.changed[0].source_ref = sourceRef;
  reading.impact.direct.changed_sources = [sourceRef];
  reading.impact.direct.affected[0].source = sourceRef;
  reading.impact.transitive[0].root_source = sourceRef;
  reading.impact.paths[0].root_source = sourceRef;

  const related = relatedLivingState(
    reading,
    'central:flow:project:test:thread',
    sourceRef,
  );
  assert.equal(related.changed.length, 1);
  assert.equal(related.affected.length, 2);
  assert.equal(related.paths.length, 1);
  assert.equal(related.pending, true);

  const flowIdentityOnly = relatedLivingState(reading, 'central:flow:project:test:thread');
  assert.equal(flowIdentityOnly.changed.length, 0);
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

test('provider loss retains exact last owner reading without promoting it to current', () => {
  const current = fixture();
  const observed = ownerObservation(null, current);
  assert.equal(observed.freshness, 'current');
  assert.equal(observed.reading.cursor, 7);

  const degraded = ownerObservation(observed.reading, null, 'Central observer unavailable');
  assert.equal(degraded.freshness, 'last-observed');
  assert.equal(degraded.reading, current);
  assert.equal(degraded.reading.cursor, 7);
  assert.equal(degraded.error, 'Central observer unavailable');

  const absent = ownerObservation(null, null, 'No owner reading');
  assert.equal(absent.freshness, 'unavailable');
  assert.equal(absent.reading, null);
});

test('ordinary QL presentation is complete without exposing formal jargon', () => {
  const view = qlPresentation('method:deep-reading', qlFixture(), 'ordinary');
  assert.deepEqual(view, { available: true, depth: 'ordinary' });
  assert.equal(view.lens, undefined);
  assert.equal(view.frame, undefined);
  assert.equal(view.summary, undefined);
});

test('explain QL presentation exposes only owner-supplied contribution and basis identity', () => {
  const view = qlPresentation('method:deep-reading', qlFixture(), 'explain');
  assert.equal(view.summary, 'Formal/refraction method contributes to this situated operation.');
  assert.equal(view.method, 'method:deep-reading');
  assert.equal(view.subject, 'wiki:reading:whole');
  assert.equal(view.lens, 'mef:lens:L0@1');
  assert.equal(view.subjectRevision, undefined);
  assert.equal(view.contextRefs, undefined);
});

test('formal QL presentation preserves exact supplied subject lens frame and context refs', () => {
  const view = qlPresentation('method:deep-reading', qlFixture(), 'formal');
  assert.equal(view.subject, 'wiki:reading:whole');
  assert.equal(view.subjectRevision, 'r7');
  assert.equal(view.subjectType, 'integrative-reading');
  assert.equal(view.frameRef, 'wiki:frame:whole');
  assert.deepEqual(view.contextRefs, ['wiki:node:purpose', 'wiki:node:implementation']);
  assert.equal(view.lens, 'mef:lens:L0@1');
  assert.equal(view.sublens, 'mef:sublens:relation-family@1');
  assert.equal(view.frame, 'cf5');
});

test('no QL or method attachment leaves ordinary Living Knowledge valid', () => {
  assert.deepEqual(qlPresentation(undefined, undefined, 'ordinary'), {
    available: false,
    depth: 'ordinary',
  });
});
