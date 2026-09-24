import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPRESSION_COMPOSITION_SCHEMA, EXPRESSION_PUBLICATION_SCHEMA, LIVE_RENDERER_REF,
  filterExpressionComposition, validateExpressionComposition, frozenExpressionHtml, projectExpression,
  hostedExpressionArgs, expressionPublicationPayloads, expressionPublicationLeaks, isProtectedRef,
} from './expression-projection.mjs';
import { resolveExpressionPresentation, expressionPresentationFromBinding } from './expression-presentation.mjs';
import { structuredProjectionReading } from './projection-reading.mjs';
import { worldPresentationFromProjection } from './presentation-projection.mjs';
import { validateProjection } from './index.mjs';

const SENTINELS = ['PRIVATE_SENTINEL_READING', 'PRIVATE_SENTINEL_ACTION', 'PRIVATE_SENTINEL_WITHHELD', 'PRIVATE_SENTINEL_PROTECTED', 'PRIVATE_SENTINEL_SCENE', 'PRIVATE_SENTINEL_ENTITY', 'PRIVATE_SENTINEL_PARAMETER', 'PRIVATE_SENTINEL_LIVE', 'PRIVATE_SENTINEL_PROVENANCE', 'PRIVATE_SENTINEL_STALE'];

/** A native Expression as the application exports it, with private material planted everywhere it can live. */
function document() {
  const ref = 'expression:sf1-walk';
  return {
    schema: 'oi.expression/v1', expression_ref: ref, revision: 4, title: 'A field of glyphs',
    scenes: [
      { scene_ref: `${ref}:scene:open`, revision: 3, title: 'Open field', entity_refs: [`${ref}:entity:sun`, `${ref}:entity:moon`] },
      { scene_ref: `${ref}:scene:hidden`, revision: 1, title: 'PRIVATE_SENTINEL_SCENE working notes', entity_refs: [`${ref}:entity:draft`] },
    ],
    entities: {
      [`${ref}:entity:sun`]: {
        entity_ref: `${ref}:entity:sun`, revision: 2, title: 'Sun',
        subject: {
          subject_ref: 'central:being:frank', native_owner: 'central', presentation_role: 'being',
          sources: [
            { ref: 'central:source:project:O-I:ProjectCentral/user/vision.md', revision: 'r7', availability: 'available' },
            { ref: 'central:path:/home/f/Central:Control/user/journal/PRIVATE_SENTINEL_PROTECTED.md', revision: 'r1', availability: 'available' },
            { ref: 'central:source:project:O-I:PRIVATE_SENTINEL_WITHHELD.md', revision: 'r2', availability: 'withheld' },
            { ref: 'central:source:project:O-I:PRIVATE_SENTINEL_STALE.md', revision: 'r3', availability: 'stale' },
          ],
          readings: [{ ref: 'aikit:reading:PRIVATE_SENTINEL_READING', revision: 'r1', availability: 'available' }],
          actions: [{ action_ref: 'central.PRIVATE_SENTINEL_ACTION', target_ref: 'central:being:frank', authority_requirement: 'owner' }],
        },
        parameters: { glyph: { value: '☉', automation: null }, x: { value: -1.5, automation: null }, y: { value: 0.5, automation: null }, scale: { value: 1.2, automation: { min: 0.8, max: 1.6, rate_hz: 0.2, waveform: 'sine' } }, PRIVATE_SENTINEL_PARAMETER: { value: 'never', automation: null } },
      },
      [`${ref}:entity:moon`]: { entity_ref: `${ref}:entity:moon`, revision: 1, title: 'Moon <script>', subject: null, parameters: { glyph: { value: '☾', automation: null }, x: { value: 1.5, automation: null } } },
      [`${ref}:entity:draft`]: { entity_ref: `${ref}:entity:draft`, revision: 1, title: 'PRIVATE_SENTINEL_ENTITY', subject: { subject_ref: 'central:thing:draft', native_owner: 'central', presentation_role: 'thing', sources: [], readings: [], actions: [] }, parameters: { glyph: { value: 'D', automation: null } } },
    },
    relations: {
      'binding:orbit': { binding_ref: 'binding:orbit', relation: { ref: 'wiki:edge:sun-moon', revision: 'r1', availability: 'available' }, from_entity_ref: `${ref}:entity:sun`, to_entity_ref: `${ref}:entity:moon`, provenance: [{ ref: 'central:path:/home/f/Central:Control/user/PRIVATE_SENTINEL_PROVENANCE.md', revision: 'r1', availability: 'available' }] },
      'binding:gone': { binding_ref: 'binding:gone', relation: { ref: 'wiki:edge:sun-draft', revision: 'r1', availability: 'available' }, from_entity_ref: `${ref}:entity:sun`, to_entity_ref: `${ref}:entity:draft`, provenance: [] },
    },
    selection: { scene_ref: `${ref}:scene:open`, entity_ref: `${ref}:entity:sun` },
    provenance: [{ ref: 'central:source:project:O-I:ProjectCentral/user/vision.md', revision: 'r7', availability: 'available' }, { ref: 'agent-session/PRIVATE_SENTINEL_PROVENANCE', revision: 'r1', availability: 'available' }],
    representations: [
      { kind: 'live', representation: { ref: 'live:PRIVATE_SENTINEL_LIVE', revision: 'r1', availability: 'available' }, provenance: [] },
      { kind: 'image', representation: { ref: 'capture:sf1:3', revision: 'r3', availability: 'available' }, provenance: [{ ref, revision: '3', availability: 'available' }] },
    ],
  };
}

const input = (overrides = {}) => ({
  document: document(),
  selection: { scene_refs: ['expression:sf1-walk:scene:open'], summary: 'Two glyphs in orbit.' },
  publisher: { participant_ref: 'human:desktop-owner', identity_ref: 'human:frank:central:owner', chosen_name: 'Frank' },
  audience: { visibility: 'public' },
  projection_ref: 'projection:desktop:expression:sf1-walk',
  published_at: '2026-09-15T10:00:00.000Z',
  ...overrides,
});

test('filtering keeps the selected scene, the material vocabulary and admitted sources; everything else is an omission', () => {
  const { composition, subjects, omissions } = filterExpressionComposition(document(), { scene_refs: ['expression:sf1-walk:scene:open'] });
  assert.equal(composition.schema, EXPRESSION_COMPOSITION_SCHEMA);
  assert.deepEqual(composition.scenes.map((scene) => scene.scene_ref), ['expression:sf1-walk:scene:open']);
  assert.deepEqual(Object.keys(composition.entities).sort(), ['expression:sf1-walk:entity:moon', 'expression:sf1-walk:entity:sun']);
  const sun = composition.entities['expression:sf1-walk:entity:sun'];
  assert.deepEqual(Object.keys(sun.parameters).sort(), ['glyph', 'scale', 'x', 'y']);
  assert.deepEqual(sun.parameters.scale.automation, { min: 0.8, max: 1.6, rate_hz: 0.2, waveform: 'sine' });
  assert.deepEqual(sun.subject, { subject_ref: 'central:being:frank', native_owner: 'central', presentation_role: 'being', sources: [{ ref: 'central:source:project:O-I:ProjectCentral/user/vision.md', revision: 'r7', availability: 'available' }] });
  assert.equal('readings' in sun.subject, false);
  assert.equal('actions' in sun.subject, false);
  assert.deepEqual(Object.keys(composition.relations), ['binding:orbit']);
  assert.deepEqual(composition.relations['binding:orbit'].provenance, []);
  assert.deepEqual(composition.selection, { scene_ref: 'expression:sf1-walk:scene:open', entity_ref: 'expression:sf1-walk:entity:sun' });
  assert.deepEqual(composition.representations.map((representation) => representation.kind), ['image']);
  assert.deepEqual(composition.provenance.map((reading) => reading.ref), ['central:source:project:O-I:ProjectCentral/user/vision.md']);
  assert.deepEqual(subjects.map((subject) => subject.ref), ['central:being:frank']);
  assert.equal(omissions.readings, 1);
  assert.equal(omissions.actions, 1);
  assert.deepEqual(omissions.scenes.map((scene) => scene.title), ['PRIVATE_SENTINEL_SCENE working notes']);
  assert.deepEqual(omissions.entities.map((entity) => entity.title), ['PRIVATE_SENTINEL_ENTITY']);
  assert.deepEqual(omissions.parameters, [{ entity_ref: 'expression:sf1-walk:entity:sun', parameter: 'PRIVATE_SENTINEL_PARAMETER' }]);
  assert.deepEqual(omissions.representations.map((representation) => representation.kind), ['live']);
  assert.equal(omissions.sources.withheld.length, 1);
  assert.equal(omissions.sources.unavailable.length, 1);
  assert.deepEqual(omissions.sources.protected.map((source) => source.ref), ['central:path:/home/f/Central:Control/user/journal/PRIVATE_SENTINEL_PROTECTED.md']);
  assert.deepEqual(omissions.provenance.map((entry) => entry.ref), ['central:path:/home/f/Central:Control/user/PRIVATE_SENTINEL_PROVENANCE.md', 'agent-session/PRIVATE_SENTINEL_PROVENANCE']);
});

test('a protected ref travels only when the selection admits that exact ref; disclose_sources none withholds all', () => {
  const admitted = filterExpressionComposition(document(), { scene_refs: ['expression:sf1-walk:scene:open'], include_source_refs: ['central:path:/home/f/Central:Control/user/journal/PRIVATE_SENTINEL_PROTECTED.md'] });
  assert.deepEqual(admitted.composition.entities['expression:sf1-walk:entity:sun'].subject.sources.map((source) => source.ref), ['central:source:project:O-I:ProjectCentral/user/vision.md', 'central:path:/home/f/Central:Control/user/journal/PRIVATE_SENTINEL_PROTECTED.md']);
  assert.deepEqual(admitted.omissions.sources.protected, []);
  const none = filterExpressionComposition(document(), { scene_refs: ['expression:sf1-walk:scene:open'], disclose_sources: 'none' });
  assert.deepEqual(none.composition.entities['expression:sf1-walk:entity:sun'].subject.sources, []);
  // the already-withheld source plus the two available ones now undisclosed
  assert.equal(none.omissions.sources.withheld.length, 3);
  assert.equal(isProtectedRef('central:source:control:root:Control/user/identity'), true);
  assert.equal(isProtectedRef('central:source:project:O-I:ProjectCentral/user/vision.md'), false);
});

test('the publication carries no planted sentinel in any outward payload, while the omissions name them for the publisher', () => {
  const bundle = projectExpression(input());
  assert.equal(bundle.schema, EXPRESSION_PUBLICATION_SCHEMA);
  assert.deepEqual(expressionPublicationLeaks(bundle, SENTINELS), []);
  const omissionsText = JSON.stringify(bundle.omissions);
  for (const sentinel of ['PRIVATE_SENTINEL_WITHHELD', 'PRIVATE_SENTINEL_PROTECTED', 'PRIVATE_SENTINEL_SCENE', 'PRIVATE_SENTINEL_ENTITY', 'PRIVATE_SENTINEL_PARAMETER', 'PRIVATE_SENTINEL_LIVE', 'PRIVATE_SENTINEL_PROVENANCE', 'PRIVATE_SENTINEL_STALE']) assert.ok(omissionsText.includes(sentinel), `omissions name ${sentinel}`);
  const payloads = expressionPublicationPayloads(bundle);
  assert.ok(payloads.fallback_html.includes('&lt;script&gt;'), 'entity titles are escaped in the frozen HTML');
  assert.ok(!payloads.fallback_html.includes('<script>'), 'no script element in the frozen HTML');
  assert.equal(bundle.omissions.readings, 1);
});

test('projection, presentation and Expression revisions stay distinct and exact; the agent reading names the same subject', () => {
  const bundle = projectExpression(input({ projection_revision: 2 }));
  const projection = validateProjection(bundle.projection);
  assert.equal(projection.projection_ref, 'projection:desktop:expression:sf1-walk');
  assert.equal(projection.projection_revision, 2);
  assert.deepEqual(projection.subject, { kind: 'expression', ref: 'expression:sf1-walk' });
  assert.deepEqual(projection.source, { system: 'o-i', ref: 'expression:sf1-walk', revision: '4' });
  assert.deepEqual(projection.audience, { visibility: 'public' });
  const presentation = worldPresentationFromProjection(projection);
  assert.equal(presentation.world_ref, 'expression:sf1-walk');
  assert.equal(presentation.revision, 2);
  const reading = structuredProjectionReading(projection);
  const body = reading.modules.find((module) => module.renderer === 'oi.presentation/expression/v1');
  assert.ok(body, 'the structured reading exposes the Expression body module');
  assert.equal(body.subject_ref, 'central:being:frank');
  assert.equal(body.props.expression.expression_ref, 'expression:sf1-walk');
  assert.equal(body.props.expression.expression_revision, 4);
  assert.equal(body.props.composition.schema, EXPRESSION_COMPOSITION_SCHEMA);
  assert.equal(bundle.entry.ref, 'expression:sf1-walk');
  assert.equal(bundle.entry.kind, 'expression');
  assert.deepEqual(bundle.entry.aliases, ['projection:desktop:expression:sf1-walk']);
  assert.equal(bundle.entry.meta.projection_ref, 'projection:desktop:expression:sf1-walk');
  assert.equal(bundle.entry.meta.expression_revision, 4);
});

test('the receiving client resolves live when it admits the named renderer and falls back to the frozen HTML otherwise', () => {
  const bundle = projectExpression(input());
  const binding = bundle.presentation.regions.find((region) => region.region_ref === 'body').bindings[0];
  const expression = expressionPresentationFromBinding(binding);
  assert.equal(expression.live_renderer_ref, LIVE_RENDERER_REF);
  const live = resolveExpressionPresentation(binding, { renderer_ref: LIVE_RENDERER_REF, available: true });
  assert.equal(live.state, 'live');
  const fallback = resolveExpressionPresentation(binding, {});
  assert.equal(fallback.state, 'fallback');
  assert.equal(fallback.fallback.kind, 'html');
  assert.ok(fallback.fallback.html.includes('data-expression-ref="expression:sf1-walk"'));
  assert.ok(fallback.fallback.html.includes('data-expression-revision="4"'));
  const composition = validateExpressionComposition(binding.props.composition);
  assert.equal(composition.expression_ref, 'expression:sf1-walk');
  const withImage = projectExpression(input({ fallback: { image: { href: 'data:image/png;base64,iVBORw0KGgo=' } } }));
  assert.deepEqual(withImage.live.fallback_kinds, ['html', 'image']);
});

test('a publisher named only by identity gets a field-scoped participant; the identity stays the human', () => {
  const bundle = projectExpression(input({ publisher: { identity_ref: 'human:frank:central:owner' } }));
  assert.equal(bundle.participant.participant_ref, `participant:${bundle.field_ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:human-frank-central-owner`);
  assert.equal(bundle.participant.identity.ref, 'human:frank:central:owner');
  assert.equal(bundle.projection.publisher_participant_ref, bundle.participant.participant_ref);
  assert.equal(bundle.participant.field_ref, bundle.field_ref);
});

test('hosted arguments follow the field client publish shape and carry the audience', () => {
  const bundle = projectExpression(input({ audience: { visibility: 'restricted', refs: ['participant:world-b'] } }));
  const args = hostedExpressionArgs(bundle);
  assert.equal(args.putSharedField.visibility, 'restricted');
  assert.equal(args.putProjection.projectionKey, 'projection:desktop:expression:sf1-walk@1');
  assert.equal(args.putProjection.sourceRevision, '4');
  assert.equal(args.putExploreEntries[0].semanticRef, 'expression:sf1-walk');
  assert.equal(args.putExploreEntries[0].kind, 'expression');
  assert.deepEqual(JSON.parse(args.putProjection.contractJson).audience, { visibility: 'restricted', refs: ['participant:world-b'] });
  assert.deepEqual(args.putExploreRelations, []);
});

test('refusals: a restricted audience without refs, an unknown scene, a foreign composition and a renderer-local representation', () => {
  assert.throws(() => projectExpression(input({ audience: { visibility: 'restricted' } })), /names its participants explicitly/);
  assert.throws(() => projectExpression(input({ selection: { scene_refs: ['expression:sf1-walk:scene:nope'] } })), /does not hold/);
  assert.throws(() => validateExpressionComposition({ ...projectExpression(input()).composition, entities: { 'expression:sf1-walk:entity:x': { entity_ref: 'expression:sf1-walk:entity:x', revision: 1, title: 'x', subject: null, parameters: { particle_buffer: { value: 1, automation: null } } } }, scenes: [{ scene_ref: 'expression:sf1-walk:scene:open', revision: 1, title: 'x', entity_refs: ['expression:sf1-walk:entity:x'] }] }), /outside the material vocabulary/);
  assert.throws(() => validateExpressionComposition({ ...projectExpression(input()).composition, representations: [{ kind: 'live', representation: { ref: 'x', revision: 'r', availability: 'available' }, provenance: [] }] }), /not portable/);
  assert.throws(() => frozenExpressionHtml({ schema: 'oi.expression/v1' }), /Unsupported Expression composition schema/);
});

/*
 * Technè through the World: an Expression authored for an occupied Position
 * and composed from a constellation relates to both — when the field it is
 * published into already hosts them as World entries (published through the
 * World bundle, central-wiki-projection.mjs). Entries mirror that bundle's
 * `world-position` and `constellation` entries as the field client's
 * snapshot reads them, with each entry's hosting field attached.
 */
const WORLD_FIELD = 'oi:field:central:project:O-I';
const POSITION = 'central:position:project:O-I:anima-4';
const CONSTELLATION = 'wiki:frame:inquiry-o-i';
const hostedEntries = (field = WORLD_FIELD) => [
  { ref: `world:central:project:O-I/${POSITION}`, kind: 'world-position', world_ref: 'world:central:project:O-I', label: 'Anima 4', aliases: [POSITION, '@anima-4'], meta: { local_ref: POSITION }, field_ref: field },
  { ref: `world:central:project:O-I/${CONSTELLATION}`, kind: 'constellation', world_ref: 'world:central:project:O-I', label: 'What grounds O-I?', aliases: [CONSTELLATION], meta: { local_ref: CONSTELLATION }, field_ref: field },
  { ref: 'world:central:project:O-I/wiki:node:project-root/o-i', kind: 'wiki-node', world_ref: 'world:central:project:O-I', label: 'O-I', aliases: ['wiki:node:project-root/o-i'], meta: { local_ref: 'wiki:node:project-root/o-i' }, field_ref: field },
];
const worldField = { schema: 'oi.shared-field/v1', field_ref: WORLD_FIELD, kind: 'explore', visibility: 'public', title: 'O-I — a ProjectCentral world', provenance: [{ kind: 'human-publication', ref: 'participant:central:owner', source_system: 'central', revision: 'oi.world-sources/v1:0123456789abcdef' }] };

test('an Expression authored for a hosted Position from a hosted constellation relates to both, in that field', () => {
  const bundle = projectExpression(input({ field_ref: WORLD_FIELD, world_ref: 'world:central:project:O-I', field: worldField, authoring: { position_ref: POSITION, constellation_ref: CONSTELLATION }, field_entries: hostedEntries() }));
  assert.deepEqual(bundle.relations.map((relation) => [relation.from, relation.relation, relation.to, relation.origin]), [
    ['expression:sf1-walk', 'oi.world/authored-by', `world:central:project:O-I/${POSITION}`, 'projection'],
    ['expression:sf1-walk', 'oi.world/expresses', `world:central:project:O-I/${CONSTELLATION}`, 'projection'],
  ]);
  assert.deepEqual(bundle.relations[0].provenance, [{ kind: 'authoring-position', ref: POSITION, source_system: 'central', revision: '4' }]);
  assert.deepEqual(bundle.omissions.world_relations, []);
  const args = hostedExpressionArgs(bundle);
  assert.deepEqual(args.putExploreRelations.map((relation) => [relation.fromRef, relation.relation, relation.toRef, relation.fieldRef]), [
    ['expression:sf1-walk', 'oi.world/authored-by', `world:central:project:O-I/${POSITION}`, WORLD_FIELD],
    ['expression:sf1-walk', 'oi.world/expresses', `world:central:project:O-I/${CONSTELLATION}`, WORLD_FIELD],
  ]);
  for (const relation of args.putExploreRelations) assert.equal(JSON.parse(relation.relationJson).relation_ref, relation.relationRef);
  // The World's field contract is carried unchanged — the Expression never retitles it.
  assert.equal(args.putSharedField.contractJson, JSON.stringify(worldField));
  assert.equal(bundle.entry.world_ref, 'world:central:project:O-I');
  assert.deepEqual(expressionPublicationLeaks(bundle, SENTINELS), []);
});

test('no World relation without a hosted entry in the same field; the refs stay local and the reasons are named', () => {
  const unhosted = projectExpression(input({ authoring: { position_ref: POSITION, constellation_ref: CONSTELLATION }, field_entries: [] }));
  assert.deepEqual(unhosted.relations, []);
  assert.deepEqual(hostedExpressionArgs(unhosted).putExploreRelations, []);
  assert.deepEqual(unhosted.omissions.world_relations.map((omission) => [omission.relation, omission.reason]), [
    ['oi.world/authored-by', 'not hosted in the SharedField'],
    ['oi.world/expresses', 'not hosted in the SharedField'],
  ]);
  assert.deepEqual(expressionPublicationLeaks(unhosted, [POSITION, CONSTELLATION]), [], 'an unrelated authoring ref never travels');

  const elsewhere = projectExpression(input({ authoring: { position_ref: POSITION }, field_entries: hostedEntries('oi:field:someone-else') }));
  assert.deepEqual(elsewhere.relations, []);
  assert.match(elsewhere.omissions.world_relations[0].reason, /another SharedField/);

  const twice = projectExpression(input({ field_ref: WORLD_FIELD, authoring: { constellation_ref: CONSTELLATION }, field_entries: [...hostedEntries(), { ...hostedEntries()[1], ref: 'world:other/wiki:frame:inquiry-o-i' }] }));
  assert.deepEqual(twice.relations, []);
  assert.match(twice.omissions.world_relations[0].reason, /more than once/);

  // A Position named by a wiki node's ref is not a Position: kinds must match.
  const wrongKind = projectExpression(input({ field_ref: WORLD_FIELD, authoring: { position_ref: 'wiki:node:project-root/o-i' }, field_entries: hostedEntries() }));
  assert.deepEqual(wrongKind.relations, []);

  // No authoring at all is the ordinary Share: nothing changes.
  const plain = projectExpression(input());
  assert.deepEqual(plain.relations, []);
  assert.deepEqual(plain.omissions.world_relations, []);
  assert.throws(() => projectExpression(input({ field_ref: WORLD_FIELD, field: { ...worldField, field_ref: 'oi:field:other' } })), /hosted contract of field_ref/);
});
