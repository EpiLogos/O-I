import test from 'node:test';
import assert from 'node:assert/strict';
import { createExploreApplication, createExploreEntry } from './explore.mjs';
import { createExploreSurfaceModel, EXPLORE_SURFACE_SEED_SCHEMA, EXPLORE_DISCOVERY_SCHEMA, SUBJECT_PRESENTATIONS_SCHEMA } from './explore-surface.mjs';
import { createProjection } from './index.mjs';
import { createWorldPresentation, WORLD_PRESENTATION_SCHEMA } from './presentation.mjs';
import { EXPRESSION_PRESENTATION_RENDERER } from './expression-presentation.mjs';

const PROV = [{ kind: 'discovery-fixture', ref: 'fixture:world:harbour', source_system: 'fixture', revision: '1' }];
const now = '2026-09-16T00:00:00.000Z';

const entry = (overrides) => createExploreEntry({
  provenance: PROV,
  ...overrides,
});

/** A Thing (wiki node), a Being (agent presence) and the world that hosts them. */
function subjectEntries(worldRef) {
  return [
    entry({
      ref: worldRef,
      kind: 'central-world',
      world_ref: worldRef,
      label: 'Harbour — a ProjectCentral world',
      aliases: [],
      locators: [{ surface: 'web', locator: `/explore.html?ref=${encodeURIComponent(worldRef)}` }],
      meta: { standing: 'projection' },
    }),
    entry({
      ref: 'wiki:node:harbour:quay',
      kind: 'wiki-node',
      world_ref: worldRef,
      label: 'The Quay wall',
      aliases: ['quay-wall'],
      summary: 'wiki node · thing · revision 2',
      revision: '2',
      locators: [],
      meta: { register: 'work' },
    }),
    entry({
      ref: 'central:pasu:agent:epii',
      kind: 'agent',
      world_ref: worldRef,
      label: 'Epii',
      aliases: [],
      summary: 'agent presence of the harbour world',
      locators: [],
      meta: { register: 'agents' },
    }),
  ];
}

/** The Expression publication carrier: one living body presenting both subjects. */
function expressionCarrier(worldRef, { availability = 'available', state = 'published' } = {}) {
  const expressionRef = 'expression:harbour:quay-light';
  const presentationRef = 'presentation:harbour:quay-light';
  const projectionRef = 'projection:harbour:quay-light';
  const expressionPresentation = {
    schema: 'oi.expression-presentation/v1',
    expression_ref: expressionRef,
    expression_revision: 3,
    live_renderer_ref: 'renderer:oi:expression-stage',
    live_availability: 'available',
    subjects: [
      { ref: 'wiki:node:harbour:quay', revision: '2', availability, sources: [{ ref: 'fixture:source:quay', revision: '2', availability: 'available' }] },
      { ref: 'central:pasu:agent:epii', revision: '1', availability: 'available', sources: [] },
    ],
    representations: [],
  };
  const composition = {
    schema: 'oi.expression-composition/v1',
    expression_ref: expressionRef,
    revision: 3,
    title: 'Quay light',
    scenes: {},
    entities: {
      'entity:quay': {
        entity_ref: 'entity:quay',
        subject: { subject_ref: 'wiki:node:harbour:quay', native_owner: 'central:root', presentation_role: 'thing', sources: [] },
      },
      'entity:epii': {
        entity_ref: 'entity:epii',
        subject: { subject_ref: 'central:pasu:agent:epii', native_owner: 'central:root', presentation_role: 'being', sources: [] },
      },
    },
    relations: {},
    selection: { scene_ref: null, entity_ref: null },
    provenance: [],
    representations: [],
  };
  const presentation = createWorldPresentation({
    presentation_ref: presentationRef,
    world_ref: expressionRef,
    revision: 2,
    title: 'Quay light',
    theme: { tokens: {} },
    regions: [
      {
        region_ref: 'lede',
        role: 'lede',
        bindings: [{
          binding_ref: 'lede',
          component_ref: 'oi.presentation/lede/v1',
          portable_renderer: 'oi.presentation/lede/v1',
          subject_ref: expressionRef,
          props: { title: 'Quay light' },
          fallback: {},
          provenance: PROV,
        }],
      },
      {
        region_ref: 'body',
        role: 'body',
        bindings: [{
          binding_ref: 'expression',
          component_ref: EXPRESSION_PRESENTATION_RENDERER,
          portable_renderer: EXPRESSION_PRESENTATION_RENDERER,
          subject_ref: 'wiki:node:harbour:quay',
          props: { expression: expressionPresentation, composition, title: 'Quay light' },
          fallback: { title: 'Quay light' },
          provenance: PROV,
        }],
      },
    ],
    provenance: PROV,
  });
  const projection = createProjection({
    projection_ref: projectionRef,
    projection_revision: 2,
    state,
    subject: { kind: 'expression', ref: expressionRef },
    source: { system: 'o-i', ref: expressionRef, revision: 'expression-rev-3' },
    publisher_participant_ref: 'participant:harbour:owner',
    published_at: now,
    audience: { visibility: 'public' },
    representation: { kind: WORLD_PRESENTATION_SCHEMA, payload: presentation },
    provenance: PROV,
  });
  const expressionEntry = entry({
    ref: expressionRef,
    kind: 'expression',
    world_ref: worldRef,
    label: 'Quay light',
    aliases: [projectionRef],
    summary: 'a living Expression · 2 subjects',
    revision: '3',
    locators: [{ surface: 'web', locator: `/explore.html?ref=${encodeURIComponent(expressionRef)}` }],
    meta: { projection_ref: projectionRef, standing: 'projection', presentation_ref: presentationRef },
  });
  return { expressionRef, presentationRef, projectionRef, presentation, projection, expressionEntry };
}

function discoverySeed(worldRef = 'world:harbour', { state, availability } = {}) {
  const subjects = subjectEntries(worldRef);
  const carrier = expressionCarrier(worldRef, { state, availability });
  const fieldRef = 'oi:field:harbour';
  return {
    subjects,
    carrier,
    fieldRef,
    seed: {
      schema: EXPLORE_SURFACE_SEED_SCHEMA,
      entries: [...subjects, carrier.expressionEntry],
      relations: [
        {
          relation_ref: `${worldRef}#oi.world/wiki-node#wiki:node:harbour:quay`,
          from: worldRef,
          to: 'wiki:node:harbour:quay',
          relation: 'oi.world/wiki-node',
          origin: 'projection',
          provenance: PROV,
        },
      ],
      presentations: [],
      presentation_projections: [carrier.projection],
      entry_fields: {
        [worldRef]: fieldRef,
        'wiki:node:harbour:quay': fieldRef,
        'central:pasu:agent:epii': fieldRef,
        [carrier.expressionRef]: fieldRef,
      },
      relation_fields: {},
      fields: [{ field_ref: fieldRef, kind: 'explore', visibility: 'public', title: 'Harbour field' }],
    },
  };
}

test('search resolves a native subject and reveals its eligible presentation forms, categories distinct', () => {
  const { seed, carrier } = discoverySeed();
  const model = createExploreSurfaceModel(seed);

  const hits = model.search('quay', { limit: 8 });
  const thing = hits.find((hit) => hit.ref === 'wiki:node:harbour:quay');
  assert.ok(thing, 'the native Thing is found');
  assert.deepEqual(thing.presentations.roles, [{
    role: 'thing',
    presentation_ref: carrier.presentationRef,
  }]);
  assert.deepEqual(thing.presentations.expressions, [carrier.expressionRef]);
  assert.deepEqual(thing.presentations.world_presentations, [carrier.presentationRef]);
  assert.deepEqual(thing.presentations.projections, [`${carrier.projectionRef}@2`]);
  assert.deepEqual(thing.presentations.field_occurrences, ['oi:field:harbour']);
  // The presenting Expression itself is a distinct result, never merged into the subject.
  assert.ok(hits.some((hit) => hit.ref === carrier.expressionRef), 'the Expression is its own addressable result');
});

test('open returns the bounded local whole plus the distinct presentation reading', () => {
  const { seed, carrier } = discoverySeed();
  const model = createExploreSurfaceModel(seed);

  const opened = model.open('wiki:node:harbour:quay', { depth: 1, budget: 8 });
  assert.equal(opened.resource.ref, 'wiki:node:harbour:quay');
  assert.equal(opened.relations.truncated, false);
  assert.ok(opened.relations.nodes.some((node) => node.ref === 'world:harbour'));
  assert.equal(opened.field_refs[0], 'oi:field:harbour');
  assert.equal(opened.presentations.schema, SUBJECT_PRESENTATIONS_SCHEMA);
  assert.equal(opened.presentations.subject_ref, 'wiki:node:harbour:quay');
  assert.equal(opened.presentations.roles[0].role, 'thing');
  assert.equal(opened.presentations.projections[0].projection_ref, carrier.projectionRef);
  // Opening the Expression resolves its WorldPresentation and Projection revision.
  const expression = model.open(carrier.expressionRef);
  assert.equal(expression.world_presentation.presentation_ref, carrier.presentationRef);
  assert.equal(expression.world_presentation_projection.projection_revision, 2);
  // Source/provenance inspection rides the same ref.
  assert.equal(model.sources('wiki:node:harbour:quay').revision, '2');
  assert.equal(model.explain(carrier.expressionRef).projection_ref, carrier.projectionRef);
});

test('a Being subject reveals its being role through the same refs', () => {
  const { seed, carrier } = discoverySeed();
  const model = createExploreSurfaceModel(seed);
  const reveal = model.presentationsFor('central:pasu:agent:epii');
  assert.equal(reveal.roles[0].role, 'being');
  assert.equal(reveal.roles[0].expression_ref, carrier.expressionRef);
  assert.ok(reveal.expressions.some((row) => row.expression_ref === carrier.expressionRef));
});

test('an unadmitted subject is not eligible: withheld availability claims no role', () => {
  const { seed } = discoverySeed('world:harbour', { availability: 'withheld' });
  const model = createExploreSurfaceModel(seed);
  const reveal = model.presentationsFor('wiki:node:harbour:quay');
  assert.deepEqual(reveal.roles, []);
  // The composition still discloses the presentation facts, honestly.
  assert.ok(reveal.expressions.some((row) => row.expression_ref === 'expression:harbour:quay-light'));
});

test('aliases resolve to the canonical ref and never become a second identity', () => {
  const { seed, carrier } = discoverySeed();
  const model = createExploreSurfaceModel(seed);
  const byAlias = model.open('projection:harbour:quay-light');
  assert.equal(byAlias.resource.ref, carrier.expressionRef);
  const hits = model.search('projection:harbour:quay-light');
  assert.equal(hits[0].ref, carrier.expressionRef);
});

test('typed relation adjacency stays bounded and typed; presentations stay a distinct category', () => {
  const { seed } = discoverySeed();
  const model = createExploreSurfaceModel(seed);
  const whole = model.relations('world:harbour', { depth: 2, budget: 4 });
  assert.ok(whole.edges.some((edge) => edge.relation === 'oi.world/wiki-node' && edge.to === 'wiki:node:harbour:quay'));
  // The local whole is the admitted relation state only — the presentation
  // join never leaks in as a synthetic edge.
  assert.deepEqual(whole.nodes.map((node) => node.ref).sort(), ['wiki:node:harbour:quay', 'world:harbour']);
  assert.equal(whole.edges.length, 1);
});

test('the discovery export is ref-faithful: another World resolves the same semantic refs', () => {
  const { seed, carrier } = discoverySeed();
  const model = createExploreSurfaceModel(seed);
  const exported = model.discoverySeed();

  assert.equal(exported.schema, EXPLORE_DISCOVERY_SCHEMA);
  const exportedRefs = exported.entries.map((row) => row.ref).sort();
  assert.deepEqual(exportedRefs, ['central:pasu:agent:epii', carrier.expressionRef, 'wiki:node:harbour:quay', 'world:harbour']);
  const quay = exported.presentations.find((row) => row.subjects.some((subject) => subject.ref === 'wiki:node:harbour:quay'));
  assert.ok(quay, 'the export carries the structured presentation join');
  assert.equal(quay.projection_ref, carrier.projectionRef);
  assert.deepEqual(quay.subjects.find((subject) => subject.ref === 'wiki:node:harbour:quay').role, 'thing');
  assert.equal(exported.membership.entry_fields['wiki:node:harbour:quay'], 'oi:field:harbour');
  assert.deepEqual(exported.fields, [{ field_ref: 'oi:field:harbour', kind: 'explore', visibility: 'public', title: 'Harbour field' }]);

  // A second World consumes the exported refs as ordinary index state and
  // addresses the identical semantic refs — no re-minting, no transport IDs.
  const secondWorld = createExploreApplication({
    entries: exported.entries,
    relations: exported.relations,
    membership: exported.membership,
  });
  assert.equal(secondWorld.resolve(carrier.expressionRef).label, 'Quay light');
  assert.equal(secondWorld.fieldsFor('wiki:node:harbour:quay')[0], 'oi:field:harbour');
  assert.ok(secondWorld.localWhole('wiki:node:harbour:quay', { depth: 1, budget: 8 }).edges.length >= 1);
});

test('a withdrawn Projection is not an eligible shared occurrence; hosting and local facts stay honest', () => {
  const { seed, carrier } = discoverySeed('world:harbour', { state: 'withdrawn' });
  const model = createExploreSurfaceModel(seed);
  const reveal = model.presentationsFor('wiki:node:harbour:quay');
  assert.deepEqual(reveal.projections, [], 'a withdrawn Projection is not an eligible occurrence');
  assert.deepEqual(reveal.field_occurrences, [{ field_ref: 'oi:field:harbour', via: 'entry' }]);
  assert.ok(reveal.roles.length >= 1, 'local role facts stay readable');
  assert.ok(reveal.world_presentations.includes(carrier.presentationRef));
});
