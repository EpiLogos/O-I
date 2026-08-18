import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESENTATION_AUTHORING_SCHEMA,
  applyPresentationAuthoringOperation,
  authoringDisclosure,
  bindingAvailability,
  normalizeContributionField,
} from './presentation-authoring.mjs';

const provenance = [{ kind: 'projected-source', ref: 'project:o-i', source_system: 'EpiLogos/O-I', revision: '78e81de' }];

function presentation() {
  return {
    schema: 'oi.world-presentation/v1',
    presentation_ref: 'presentation:o-i:explore',
    world_ref: 'project:o-i',
    revision: 3,
    title: 'O:I Explore',
    summary: 'The authored shared-field projection.',
    theme: { tokens: { surface: '#fff', foreground: '#111' } },
    regions: [
      {
        region_ref: 'region:opening',
        role: 'opening',
        label: 'Opening',
        bindings: [
          {
            binding_ref: 'binding:opening-copy',
            component_ref: 'oi.presentation.component:text',
            contribution_ref: 'contribution:oi:text',
            surface_ref: 'surface:oi:portable-text',
            projection_ref: 'projection:o-i:explore@3',
            subject_ref: 'project:o-i',
            portable_renderer: 'oi.presentation/text/v1',
            props: { title: 'Explore', text: 'Addressable worlds and work.' },
            fallback: { title: 'Explore', text: 'Addressable worlds and work.' },
            provenance,
          },
        ],
      },
      { region_ref: 'region:body', role: 'primary', label: 'Body', bindings: [] },
    ],
    provenance,
  };
}

const contributions = normalizeContributionField([
  {
    contribution_ref: 'contribution:oi:text',
    component_ref: 'oi.presentation.component:text',
    surface_ref: 'surface:oi:portable-text',
    portable_renderer: 'oi.presentation/text/v1',
    label: 'Text',
    available: true,
    default_props: { title: 'Text', text: 'Write here.' },
    fallback: { title: 'Text', text: 'Portable text unavailable.' },
    provenance,
  },
  {
    contribution_ref: 'contribution:aikit:project-map',
    component_ref: 'component:aikit:project-map',
    surface_ref: 'surface:aikit:project-map:web',
    portable_renderer: 'aikit.presentation/project-map/v1',
    label: 'Project map',
    available: false,
    degraded: true,
    reason: 'provider requirement is not satisfied in this Surface',
    action_refs: ['aikit.project-map.open'],
    default_props: {},
    fallback: { title: 'Project map', text: 'Open through an alternate AIKit Surface.' },
    provenance: [{ kind: 'native-component', ref: 'component:aikit:project-map', source_system: 'EpiLogos/ai-kit', revision: 'main' }],
  },
]);

test('direct authoring mutates existing WorldPresentation regions and bindings without a parallel page model', () => {
  let next = applyPresentationAuthoringOperation(presentation(), {
    type: 'edit-binding-props',
    binding_ref: 'binding:opening-copy',
    patch: { text: 'Explore is an authored encounter.' },
  }, contributions);
  assert.equal(next.regions[0].bindings[0].props.text, 'Explore is an authored encounter.');

  next = applyPresentationAuthoringOperation(next, {
    type: 'insert-contribution',
    region_ref: 'region:body',
    contribution_ref: 'contribution:oi:text',
    binding_ref: 'binding:body-copy',
    props: { title: 'A second movement', text: 'Inserted from the resolved contribution field.' },
  }, contributions);
  assert.equal(next.regions[1].bindings[0].binding_ref, 'binding:body-copy');
  assert.equal(next.regions[1].bindings[0].contribution_ref, 'contribution:oi:text');

  next = applyPresentationAuthoringOperation(next, {
    type: 'move-binding',
    binding_ref: 'binding:body-copy',
    to_region_ref: 'region:opening',
    index: 0,
  }, contributions);
  assert.deepEqual(next.regions[0].bindings.map((binding) => binding.binding_ref), ['binding:body-copy', 'binding:opening-copy']);

  next = applyPresentationAuthoringOperation(next, { type: 'duplicate-binding', binding_ref: 'binding:body-copy' }, contributions);
  assert.equal(next.regions[0].bindings.length, 3);
  assert.notEqual(next.regions[0].bindings[0].binding_ref, next.regions[0].bindings[1].binding_ref);

  next = applyPresentationAuthoringOperation(next, { type: 'remove-binding', binding_ref: 'binding:opening-copy' }, contributions);
  assert.equal(next.regions[0].bindings.some((binding) => binding.binding_ref === 'binding:opening-copy'), false);
});

test('agent disclosure exposes the same selected refs, provenance, source revision, contribution field and authoring operations', () => {
  const disclosure = authoringDisclosure({
    presentation: presentation(),
    projection_ref: 'projection:o-i:explore@3',
    source_ref: 'project:o-i',
    source_revision: '78e81de',
    selected_binding_ref: 'binding:opening-copy',
    contributions,
    mode: 'author',
    dirty: true,
  });
  assert.equal(disclosure.schema, PRESENTATION_AUTHORING_SCHEMA);
  assert.equal(disclosure.selected.binding_ref, 'binding:opening-copy');
  assert.equal(disclosure.selected.component_ref, 'oi.presentation.component:text');
  assert.equal(disclosure.selected.projection_ref, 'projection:o-i:explore@3');
  assert.equal(disclosure.source_revision, '78e81de');
  assert.equal(disclosure.dirty, true);
  assert.ok(disclosure.operations.includes('insert-contribution'));
  assert.equal(disclosure.contributions[1].degraded, true);
  assert.equal(disclosure.contributions[1].action_refs[0], 'aikit.project-map.open');
});

test('unavailable native contribution is visible but cannot be inserted and renderer fallback does not drift identity', () => {
  assert.throws(() => applyPresentationAuthoringOperation(presentation(), {
    type: 'insert-contribution',
    region_ref: 'region:body',
    contribution_ref: 'contribution:aikit:project-map',
  }, contributions), /unavailable/);

  const availability = bindingAvailability(presentation(), contributions, {});
  assert.equal(availability[0].component_ref, 'oi.presentation.component:text');
  assert.equal(availability[0].renderer_available, false);
  assert.equal(availability[0].binding_ref, 'binding:opening-copy');
});

test('web and desktop Surface disclosures can consume one presentation and binding identity without owning it', () => {
  const web = authoringDisclosure({ presentation: presentation(), contributions, selected_binding_ref: 'binding:opening-copy', mode: 'author' });
  const desktop = authoringDisclosure({ presentation: presentation(), contributions, selected_binding_ref: 'binding:opening-copy', mode: 'author' });
  assert.equal(web.presentation_ref, desktop.presentation_ref);
  assert.equal(web.selected.binding_ref, desktop.selected.binding_ref);
  assert.equal(web.selected.component_ref, desktop.selected.component_ref);
  assert.equal(web.selected.surface_ref, desktop.selected.surface_ref);
});
