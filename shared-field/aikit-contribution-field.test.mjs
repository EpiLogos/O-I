import assert from 'node:assert/strict';
import test from 'node:test';
import { contributionFieldFromCompositionBody, validateCompositionBody } from './aikit-contribution-field.mjs';
import { authoringDisclosure, applyPresentationAuthoringOperation } from './presentation-authoring.mjs';
import { createWorldPresentation } from './presentation.mjs';

/*
 * This body follows the serde shape of `CompositionBody` in
 * ai-kit/crates/aikit-core/src/composition.rs (kebab-case enums, ADR 0004).
 * AIKit resolves it; O:I only consumes it. No CLI currently emits it (ai-kit
 * issue pinned in shared-field/WORLD-PUBLICATION.md), so the fixture is the
 * accepted contract shape rather than a captured live emission.
 */
function body() {
  return {
    version: 'aikit.composition-body/v1',
    component_bindings: [],
    contract_bindings: [],
    contributions: [
      { id: 'contribution:wiki-excerpt', component: 'component:central-wiki', kind: 'read-model', target_contract: 'oi.presentation/wiki-excerpt/v1', exposed_ref: 'reading:wiki-excerpt', exposed_kind: 'reading', surface: 'surface:web', activation_scope: { kind: 'project' }, lifetime_owner: { kind: 'generation' }, activation_mode: 'live-mounted', retraction_mode: 'live', provenance: ['aikit.projectcentral-authored-wiki/v1'] },
      { id: 'contribution:now-return', component: 'component:central-now', kind: 'action-projection', target_contract: 'oi.presentation/action/v1', exposed_ref: 'central:action:projectcentral.now.return', exposed_kind: 'action', surface: 'surface:web', activation_scope: { kind: 'project' }, lifetime_owner: { kind: 'generation' }, activation_mode: 'live-mounted', retraction_mode: 'live', provenance: [] },
      { id: 'contribution:factory-run', component: 'component:factory', kind: 'read-model', target_contract: 'oi.presentation/run-history/v1', exposed_ref: 'reading:factory-runs', exposed_kind: 'reading', surface: 'surface:web', activation_scope: { kind: 'project' }, lifetime_owner: { kind: 'generation' }, activation_mode: 'live-mounted', retraction_mode: 'live', provenance: [] },
      { id: 'contribution:tui-only', component: 'component:tui', kind: 'ui-node', surface: 'surface:tui', activation_scope: { kind: 'agent-session' }, lifetime_owner: { kind: 'agent-session' }, activation_mode: 'live-mounted', retraction_mode: 'live', provenance: [] },
      { id: 'contribution:unprojected', component: 'component:hidden', kind: 'service', activation_scope: { kind: 'host' }, lifetime_owner: { kind: 'external' }, activation_mode: 'generated', retraction_mode: 'unsupported', provenance: [] },
      { id: 'contribution:later', component: 'component:later', kind: 'ui-node', surface: 'surface:web', activation_scope: { kind: 'project' }, lifetime_owner: { kind: 'generation' }, activation_mode: 'next-session', retraction_mode: 'next-session', provenance: [] },
    ],
    surfaces: [
      { resource: 'surface:web', kind: 'web', owner_component: 'component:site' },
      { resource: 'surface:tui', kind: 'tui', owner_component: 'component:tui' },
    ],
    projections: [
      { canonical_ref: 'reading:wiki-excerpt', canonical_kind: 'reading', contribution: 'contribution:wiki-excerpt', component: 'component:central-wiki', surface: 'surface:web' },
      { canonical_ref: 'central:action:projectcentral.now.return', canonical_kind: 'action', contribution: 'contribution:now-return', component: 'component:central-now', surface: 'surface:web' },
      { canonical_ref: 'reading:factory-runs', canonical_kind: 'reading', contribution: 'contribution:factory-run', component: 'component:factory', surface: 'surface:web' },
      { canonical_ref: 'ui:tui', canonical_kind: 'reading', contribution: 'contribution:tui-only', component: 'component:tui', surface: 'surface:tui' },
      { canonical_ref: 'ui:later', canonical_kind: 'reading', contribution: 'contribution:later', component: 'component:later', surface: 'surface:web' },
    ],
    absences: [
      { component: 'component:factory', requirement: 'contract:factory-runs', required: true, reason: 'Factory is not installed on this host.' },
    ],
    state: 'resolved',
    generation: 'gen-7',
    fingerprint: 'sha256:body-fixture-1',
  };
}

test('only Surface-projected AIKit contributions become bindable, with absences degrading rather than vanishing', () => {
  const field = contributionFieldFromCompositionBody(body(), { surface_kinds: ['web'] });
  const refs = field.map((item) => item.contribution_ref);
  assert.deepEqual(refs, ['contribution:wiki-excerpt', 'contribution:now-return', 'contribution:factory-run', 'contribution:later']);
  const factory = field.find((item) => item.contribution_ref === 'contribution:factory-run');
  assert.equal(factory.available, false);
  assert.match(factory.reason, /not installed/);
  const later = field.find((item) => item.contribution_ref === 'contribution:later');
  assert.equal(later.available, false);
  const excerpt = field.find((item) => item.contribution_ref === 'contribution:wiki-excerpt');
  assert.equal(excerpt.portable_renderer, 'oi.presentation/wiki-excerpt/v1');
  assert.equal(excerpt.surface_ref, 'surface:web');
  assert.ok(excerpt.provenance.some((entry) => entry.kind === 'aikit-composition-body' && entry.ref === 'sha256:body-fixture-1'));
});

test('an action projection keeps its canonical Action ref and gains no handler', () => {
  const field = contributionFieldFromCompositionBody(body());
  const action = field.find((item) => item.contribution_ref === 'contribution:now-return');
  assert.deepEqual(action.action_refs, ['central:action:projectcentral.now.return']);
  assert.ok(!('handler' in action));
  const presentation = createWorldPresentation({ schema: 'oi.world-presentation/v1', presentation_ref: 'presentation:t', world_ref: 'world:t', revision: 1, title: 'T', theme: { tokens: {} }, regions: [{ region_ref: 'main', role: 'reading', bindings: [] }], provenance: [{ kind: 'test', ref: 'fixture', source_system: 'oi-test', revision: '1' }] });
  const inserted = applyPresentationAuthoringOperation(presentation, { schema: 'oi.presentation-authoring-operation/v1', type: 'insert-contribution', region_ref: 'main', index: 0, contribution_ref: 'contribution:now-return', props: {} }, field);
  const disclosure = authoringDisclosure({ presentation: inserted, contributions: field, selected_binding_ref: inserted.regions[0].bindings[0].binding_ref });
  assert.deepEqual(disclosure.selected.action_refs, ['central:action:projectcentral.now.return']);
});

test('the adapter refuses bodies that are not the accepted AIKit contract', () => {
  assert.throws(() => validateCompositionBody({ version: 'aikit.composition-body/v0', contributions: [], surfaces: [], projections: [], absences: [], fingerprint: 'x' }), /Unsupported AIKit composition body version/);
  assert.throws(() => contributionFieldFromCompositionBody({ ...body(), contributions: [{ component: 'c' }] }), /contribution\.id/);
});
