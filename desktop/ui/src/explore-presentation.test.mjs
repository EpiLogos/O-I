import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesktopExplorePresentationReading } from './explore-presentation.mjs';
import { authoringDisclosure } from '../../../shared-field/presentation-authoring.mjs';

const provenance = [{ kind: 'projected-source', ref: 'project:o-i', source_system: 'EpiLogos/O-I', revision: 'main' }];
const presentation = {
  schema: 'oi.world-presentation/v1',
  presentation_ref: 'presentation:o-i:explore',
  world_ref: 'project:o-i',
  revision: 4,
  title: 'O:I Explore',
  theme: { tokens: {} },
  regions: [{
    region_ref: 'region:main',
    role: 'primary',
    bindings: [{
      binding_ref: 'binding:project-reading',
      component_ref: 'component:aikit:project-reading',
      contribution_ref: 'contribution:aikit:project-reading',
      surface_ref: 'surface:aikit:project-reading',
      portable_renderer: 'aikit.presentation/project-reading/v1',
      props: { title: 'Project reading' },
      fallback: { title: 'Project reading', text: 'Open through an alternate AIKit Surface.' },
      provenance: [{ kind: 'native-component', ref: 'component:aikit:project-reading', source_system: 'EpiLogos/ai-kit', revision: 'main' }],
    }],
  }],
  provenance,
};
const contributions = [{
  contribution_ref: 'contribution:aikit:project-reading',
  component_ref: 'component:aikit:project-reading',
  surface_ref: 'surface:aikit:project-reading',
  portable_renderer: 'aikit.presentation/project-reading/v1',
  label: 'Project reading',
  available: true,
  degraded: false,
  action_refs: ['aikit.project.open'],
  default_props: {},
  fallback: { title: 'Project reading', text: 'Open through an alternate AIKit Surface.' },
  provenance: [{ kind: 'native-component', ref: 'component:aikit:project-reading', source_system: 'EpiLogos/ai-kit', revision: 'main' }],
}];

test('desktop consumes the same structured authoring meaning as the web/agent application operation', () => {
  const input = {
    presentation,
    projection_ref: 'projection:o-i:explore@4',
    source_ref: 'project:o-i',
    source_revision: 'main',
    selected_binding_ref: 'binding:project-reading',
    contributions,
    mode: 'author',
  };
  const desktop = createDesktopExplorePresentationReading(input);
  const shared = authoringDisclosure(input);
  assert.equal(desktop.availability, 'ready');
  assert.equal(desktop.presentation_ref, shared.presentation_ref);
  assert.equal(desktop.selected.binding_ref, shared.selected.binding_ref);
  assert.equal(desktop.selected.component_ref, shared.selected.component_ref);
  assert.equal(desktop.selected.surface_ref, shared.selected.surface_ref);
  assert.equal(desktop.contributions[0].action_refs[0], 'aikit.project.open');
  assert.equal(desktop.bindings[0].renderer_available, false);
  assert.equal(desktop.bindings[0].binding_ref, 'binding:project-reading');
});

test('desktop reports honest degradation rather than inventing a presentation instance', () => {
  const reading = createDesktopExplorePresentationReading({ contributions });
  assert.equal(reading.availability, 'degraded');
  assert.equal(reading.presentation_ref, null);
  assert.match(reading.reason, /No live WorldPresentation/);
});
