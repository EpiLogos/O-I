import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRESENTATION_BINDING_SCHEMA,
  WORLD_PRESENTATION_SCHEMA,
  createWorldPresentation,
  presentationBindings,
  resolvePresentationBindings,
  worldThemeCssVariables,
} from './presentation.mjs';

function fixture() {
  return {
    schema: WORLD_PRESENTATION_SCHEMA,
    presentation_ref: 'presentation:human:root',
    world_ref: 'world:human:root',
    revision: 1,
    title: 'Root world',
    summary: 'One authored public projection.',
    theme: {
      name: 'root',
      tokens: {
        surface: '#ffffff',
        foreground: '#111111',
        relation: '#555555',
      },
    },
    regions: [
      {
        region_ref: 'region:opening',
        role: 'opening',
        bindings: [
          {
            binding_ref: 'binding:introduction',
            component_ref: 'component:authoring:introduction',
            contribution_ref: 'contribution:component:introduction',
            surface_ref: 'surface:web:explore',
            projection_ref: 'projection:human:root',
            portable_renderer: 'oi.presentation/text/v1',
            props: { text: 'An authored opening.' },
            fallback: { title: 'Introduction', text: 'An authored opening.' },
            provenance: [
              {
                kind: 'component-contribution',
                ref: 'contribution:component:introduction',
                source_system: 'ai-kit',
                revision: 'component@1',
              },
            ],
          },
        ],
      },
    ],
    provenance: [
      {
        kind: 'world-presentation',
        ref: 'presentation:human:root',
        source_system: 'o-i',
        revision: 'presentation@1',
      },
    ],
  };
}

test('world presentation preserves native component/contribution/surface identity', () => {
  const presentation = createWorldPresentation(fixture());
  assert.equal(presentation.schema, WORLD_PRESENTATION_SCHEMA);
  assert.equal(presentation.regions[0].bindings[0].schema, PRESENTATION_BINDING_SCHEMA);
  assert.equal(presentation.regions[0].bindings[0].component_ref, 'component:authoring:introduction');
  assert.equal(presentation.regions[0].bindings[0].contribution_ref, 'contribution:component:introduction');
  assert.equal(presentation.regions[0].bindings[0].surface_ref, 'surface:web:explore');
  assert.equal(presentation.regions[0].bindings[0].projection_ref, 'projection:human:root');
});

test('presentation bindings flatten regions without changing component identity', () => {
  const bindings = presentationBindings(fixture());
  assert.deepEqual(
    bindings.map(({ region_ref, component_ref, portable_renderer }) => ({ region_ref, component_ref, portable_renderer })),
    [
      {
        region_ref: 'region:opening',
        component_ref: 'component:authoring:introduction',
        portable_renderer: 'oi.presentation/text/v1',
      },
    ],
  );
});

test('renderer availability is local client state rather than presentation authority', () => {
  const resolved = resolvePresentationBindings(fixture(), {
    'oi.presentation/text/v1': () => undefined,
  });
  const binding = resolved.regions[0].bindings[0];
  assert.equal(binding.renderer_key, 'oi.presentation/text/v1');
  assert.equal(binding.renderer_available, true);
  assert.equal(binding.component_ref, 'component:authoring:introduction');

  const unavailable = resolvePresentationBindings(fixture(), {});
  assert.equal(unavailable.regions[0].bindings[0].renderer_available, false);
});

test('worlds may remap semantic presentation tokens but not shared-system meta relation', () => {
  const presentation = createWorldPresentation(fixture());
  assert.deepEqual(worldThemeCssVariables(presentation), {
    '--oi-world-surface': '#ffffff',
    '--oi-world-foreground': '#111111',
    '--oi-world-relation': '#555555',
  });

  const invalid = fixture();
  invalid.theme.tokens['meta-relation'] = '#ff00ff';
  assert.throws(() => createWorldPresentation(invalid), /cannot override shared-system token/);
});

test('presentation manifest cannot smuggle executable module fields into a binding', () => {
  const invalid = fixture();
  invalid.regions[0].bindings[0].module_url = 'https://example.invalid/component.js';
  assert.throws(() => createWorldPresentation(invalid), /unsupported keys: module_url/);
});

test('region and binding refs are unique inside one presentation', () => {
  const duplicateRegion = fixture();
  duplicateRegion.regions.push({ ...duplicateRegion.regions[0], bindings: [] });
  assert.throws(() => createWorldPresentation(duplicateRegion), /Duplicate presentation region ref/);

  const duplicateBinding = fixture();
  duplicateBinding.regions.push({
    region_ref: 'region:second',
    role: 'secondary',
    bindings: [structuredClone(duplicateBinding.regions[0].bindings[0])],
  });
  assert.throws(() => createWorldPresentation(duplicateBinding), /Duplicate presentation binding ref/);
});
