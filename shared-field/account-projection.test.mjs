import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorldPresentationProjection } from './presentation-projection.mjs';
import { accountModuleKinds, structuredProjectionReading } from './projection-reading.mjs';

function provenance(kind, ref, source_system, revision) {
  return [{ kind, ref, source_system, revision }];
}

function binding({
  binding_ref,
  component_ref,
  renderer,
  props,
  source_system,
  source_ref,
  source_revision,
  subject_ref,
}) {
  return {
    schema: 'oi.presentation-binding/v1',
    binding_ref,
    component_ref,
    ...(renderer ? { portable_renderer: renderer } : {}),
    ...(subject_ref ? { subject_ref } : {}),
    props,
    fallback: {
      title: typeof props.title === 'string' ? props.title : component_ref,
      text: typeof props.text === 'string' ? props.text : 'Structured projected material.',
    },
    provenance: provenance('source-reading', source_ref, source_system, source_revision),
  };
}

function projected({
  projection_ref,
  world_ref,
  subject_kind,
  source_system,
  source_ref,
  source_revision,
  presentation_ref,
  title,
  summary,
  regions,
}) {
  return createWorldPresentationProjection({
    projection: {
      schema: 'oi.projection/v1',
      projection_ref,
      projection_revision: 1,
      state: 'published',
      subject: { ref: world_ref, kind: subject_kind },
      source: { system: source_system, ref: source_ref, revision: source_revision },
      publisher_participant_ref: 'participant:conformance:author',
      published_at: '2026-08-18T03:30:00Z',
      audience: { visibility: 'public' },
      provenance: provenance('ratified-projection', source_ref, source_system, source_revision),
    },
    presentation: {
      schema: 'oi.world-presentation/v1',
      presentation_ref,
      world_ref,
      revision: 1,
      title,
      summary,
      theme: { tokens: {} },
      regions,
      provenance: provenance('authored-reading', source_ref, source_system, source_revision),
    },
  });
}

function personalWorldProjection() {
  return projected({
    projection_ref: 'projection:central:personal-world:1',
    world_ref: 'world:central:person',
    subject_kind: 'central.participant-root',
    source_system: 'central',
    source_ref: 'central:root',
    source_revision: 'central@42',
    presentation_ref: 'presentation:central:personal-world',
    title: 'A selected face of my working world',
    summary: 'A deliberately selected public reading of authored Central material.',
    regions: [
      {
        region_ref: 'orientation',
        role: 'orientation',
        label: 'Where I am',
        bindings: [
          binding({
            binding_ref: 'personal:lede',
            component_ref: 'component:central:user-reading',
            renderer: 'oi.presentation/lede/v1',
            props: {
              title: 'Where I am',
              text: 'Selected authored context from Control/user. The projection does not imply that the whole Control root is public.',
            },
            source_system: 'central',
            source_ref: 'Control/user/public-ground.md',
            source_revision: 'central@42',
          }),
        ],
      },
      {
        region_ref: 'work',
        role: 'selection',
        label: 'What I am making',
        bindings: [
          binding({
            binding_ref: 'personal:projects',
            component_ref: 'component:aikit:project-map',
            renderer: 'oi.presentation/reference-card/v1',
            props: {
              title: 'Selected projects',
              refs: ['project:o-i', 'project:central'],
              text: 'Only projects chosen for this Projection appear here.',
            },
            source_system: 'central',
            source_ref: 'Work',
            source_revision: 'central@42',
            subject_ref: 'project:o-i',
          }),
        ],
      },
      {
        region_ref: 'collaboration',
        role: 'relation',
        label: 'How I work with agents',
        bindings: [
          binding({
            binding_ref: 'personal:agents',
            component_ref: 'component:central:agent-ground',
            renderer: 'oi.presentation/prose/v1',
            props: {
              title: 'How I work with agents',
              text: 'A public subset of durable collaboration ground selected from Control/agents.',
            },
            source_system: 'central',
            source_ref: 'Control/agents/public-collaboration.md',
            source_revision: 'central@42',
          }),
        ],
      },
    ],
  });
}

function oiProjectProjection() {
  return projected({
    projection_ref: 'projection:project:o-i:1',
    world_ref: 'project:o-i',
    subject_kind: 'project',
    source_system: 'git',
    source_ref: 'EpiLogos/O-I',
    source_revision: 'f54750239fa184ddeb5c33f0b9bf2fcc40076682',
    presentation_ref: 'presentation:project:o-i',
    title: 'O:I — projected worlds in a shared field',
    summary: 'A project account that keeps authored position, design, architecture and current implementation evidence distinct.',
    regions: [
      {
        region_ref: 'why',
        role: 'ground',
        label: 'Why this exists',
        bindings: [
          binding({
            binding_ref: 'oi:position',
            component_ref: 'component:aikit:product-understanding',
            renderer: 'oi.presentation/distinction/v1',
            props: {
              title: 'Projection is presence, not ownership transfer',
              text: 'A projected world remains grounded in its native source while selected aspects become present in O:I.',
              standing: 'authored-position',
            },
            source_system: 'git',
            source_ref: 'docs/positions/FOUNDING-POSITIONS.md',
            source_revision: 'founding-position@current',
          }),
        ],
      },
      {
        region_ref: 'design',
        role: 'design',
        label: 'Experience and design',
        bindings: [
          binding({
            binding_ref: 'oi:diagram',
            component_ref: 'component:aikit:diagram-authoring',
            renderer: 'oi.presentation/diagram/v1',
            props: {
              title: 'Search → open → local whole → projected account',
              description: 'Experience relation used by Explore without replacing native relation state.',
              relations: ['SEARCH -> OPEN', 'OPEN -> local whole', 'local whole -> WorldPresentation'],
              standing: 'design-commitment',
            },
            source_system: 'git',
            source_ref: 'shared-field/WORLD-PRESENTATION.md',
            source_revision: 'f5475023',
          }),
        ],
      },
      {
        region_ref: 'system',
        role: 'architecture',
        label: 'Current system',
        bindings: [
          binding({
            binding_ref: 'oi:architecture',
            component_ref: 'component:aikit:code-schema',
            renderer: 'oi.presentation/code-schema/v1',
            props: {
              title: 'WorldPresentation contract',
              language: 'text',
              code: 'Projection -> WorldPresentation -> ComponentRef / SurfaceRef -> accepted local renderer',
              standing: 'architecture-contract',
            },
            source_system: 'git',
            source_ref: 'shared-field/presentation.mjs',
            source_revision: 'f5475023',
          }),
          binding({
            binding_ref: 'oi:evidence',
            component_ref: 'component:aikit:verification',
            renderer: 'oi.presentation/claim-evidence/v1',
            props: {
              title: 'Current implementation evidence',
              claim: 'WorldPresentation is a Projection representation and refinement preserves canonical source revision.',
              evidence: ['shared-field/presentation.test.mjs', 'shared-field/presentation-projection.test.mjs'],
              standing: 'implementation-evidence',
            },
            source_system: 'git',
            source_ref: 'shared-field/presentation-projection.test.mjs',
            source_revision: 'f5475023',
          }),
        ],
      },
    ],
  });
}

function ordinaryProjectProjection() {
  return projected({
    projection_ref: 'projection:project:field-notes:1',
    world_ref: 'project:field-notes',
    subject_kind: 'project',
    source_system: 'filesystem',
    source_ref: 'Work/field-notes',
    source_revision: 'tree@17',
    presentation_ref: 'presentation:project:field-notes',
    title: 'Field Notes',
    summary: 'A small project for collecting observations during coastal walks.',
    regions: [
      {
        region_ref: 'purpose',
        role: 'ground',
        label: 'Why I keep these notes',
        bindings: [
          binding({
            binding_ref: 'field:why',
            component_ref: 'component:portable:prose',
            renderer: 'oi.presentation/prose/v1',
            props: {
              title: 'Why I keep these notes',
              text: 'The project keeps observations, photographs and later identifications together without requiring a specialised knowledge system.',
            },
            source_system: 'filesystem',
            source_ref: 'Work/field-notes/README.md',
            source_revision: 'tree@17',
          }),
        ],
      },
      {
        region_ref: 'practice',
        role: 'operation',
        label: 'From a walk to a useful record',
        bindings: [
          binding({
            binding_ref: 'field:timeline',
            component_ref: 'component:portable:timeline',
            renderer: 'oi.presentation/timeline/v1',
            props: {
              title: 'From a walk to a useful record',
              items: [
                { label: 'Capture', text: 'Write the observation and attach the photograph.' },
                { label: 'Identify', text: 'Add a species or place identification when confidence is sufficient.' },
                { label: 'Return', text: 'Use later walks to correct or deepen earlier notes.' },
              ],
            },
            source_system: 'filesystem',
            source_ref: 'Work/field-notes/notes',
            source_revision: 'tree@17',
          }),
        ],
      },
      {
        region_ref: 'examples',
        role: 'evidence',
        label: 'Recent observations',
        bindings: [
          binding({
            binding_ref: 'field:recent',
            component_ref: 'component:portable:reference-card',
            renderer: 'oi.presentation/reference-card/v1',
            props: {
              title: 'Recent observations',
              refs: ['note:rock-pool-17', 'note:tern-08'],
            },
            source_system: 'filesystem',
            source_ref: 'Work/field-notes/notes',
            source_revision: 'tree@17',
          }),
        ],
      },
    ],
  });
}

test('portable account modules are a rendering grammar, not a required Account ontology', () => {
  const kinds = accountModuleKinds();
  assert.ok(kinds.includes('prose'));
  assert.ok(kinds.includes('diagram'));
  assert.ok(kinds.includes('claim-evidence'));
  assert.equal(new Set(kinds).size, kinds.length);
});

test('Central personal world projects only explicitly selected authored material', () => {
  const reading = structuredProjectionReading(personalWorldProjection());
  assert.equal(reading.source.system, 'central');
  assert.equal(reading.source.revision, 'central@42');
  assert.equal(reading.subject.kind, 'central.participant-root');
  assert.deepEqual(
    reading.modules.map((module) => module.provenance[0].ref),
    ['Control/user/public-ground.md', 'Work', 'Control/agents/public-collaboration.md'],
  );
  assert.ok(!JSON.stringify(reading).includes('Control/machines/private'));
  assert.ok(reading.modules.every((module) => module.account_module));
});

test('deep project account keeps authored intent, design, architecture and implementation evidence distinguishable', () => {
  const reading = structuredProjectionReading(oiProjectProjection());
  assert.equal(reading.subject.ref, 'project:o-i');
  assert.deepEqual(
    reading.modules.map((module) => module.props.standing),
    ['authored-position', 'design-commitment', 'architecture-contract', 'implementation-evidence'],
  );
  assert.equal(reading.projection_ref, 'projection:project:o-i:1');
  assert.equal(reading.projection_revision, 1);
});

test('ordinary project uses natural headings and has no QL dependency', () => {
  const reading = structuredProjectionReading(ordinaryProjectProjection());
  const visibleTitles = reading.modules.map((module) => module.props.title);
  assert.deepEqual(visibleTitles, [
    'Why I keep these notes',
    'From a walk to a useful record',
    'Recent observations',
  ]);
  assert.ok(!JSON.stringify(reading).toLowerCase().includes('ql'));
  assert.ok(!JSON.stringify(reading).includes('#0'));
  assert.equal(reading.source.system, 'filesystem');
});

test('agent reading preserves the same Projection identity human surfaces render', () => {
  for (const value of [personalWorldProjection(), oiProjectProjection(), ordinaryProjectProjection()]) {
    const reading = structuredProjectionReading(value);
    assert.equal(reading.projection_ref, value.projection_ref);
    assert.equal(reading.projection_revision, value.projection_revision);
    assert.equal(reading.presentation_ref, value.representation.payload.presentation_ref);
    assert.equal(reading.presentation_revision, value.representation.payload.revision);
  }
});
