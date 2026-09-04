import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemWorkbench, SYSTEM_STATE_AXES } from './system-workbench-model.mjs';

const contribution = (native_owner, contribution_ref, availability = 'ready', actions = [], read_model_ref = undefined) => ({
  contribution: {
    contribution_ref,
    native_owner,
    availability,
    regions: ['canvas'],
    accepted_selection_kinds: [],
    actions,
    read_model_ref,
    provenance: { source: `${native_owner}:source`, revision: `${native_owner}-rev` },
  },
});

// `oi.composition-reading/v1` as the kernel composes it (K2): presence as
// observed, capability descriptors beside it, fixture served as degraded.
const composition = (constituents, condition = 'partial') => ({
  schema: 'oi.composition-reading/v1',
  condition,
  constituents,
  warnings: ['composition warning, verbatim'],
});

const constituent = (native_owner, state, provider_class, capabilities = [], detail = null) => ({
  native_owner,
  state,
  provider_class,
  capabilities,
  detail,
});

test('System always composes exactly six owners across seven distinct state axes', () => {
  const model = buildSystemWorkbench();
  assert.equal(model.schema, 'oi.system-workbench/v1');
  assert.deepEqual(model.state_axes, SYSTEM_STATE_AXES);
  assert.deepEqual(model.products.map((product) => product.id), ['central', 'actuation', 'ai-kit', 'factory', 'workcell', 'ql-mef']);
  for (const product of model.products) assert.deepEqual(Object.keys(product.states), SYSTEM_STATE_AXES);
  assert.equal(model.ordinary_operation_blocked, false);
});

test('without a composition reading, presence is undisclosed — never assumed absent, never a static table', () => {
  const model = buildSystemWorkbench();
  assert.equal(model.condition, 'unavailable', 'no reading, no condition of its own');
  assert.equal(model.composition.schema, null);
  for (const product of model.products) {
    assert.equal(product.presence.state, 'not_disclosed');
    assert.equal(product.presence.observed, false);
  }
  assert.match(model.products[0].presence.detail, /presence is unknown, not absent/i);
});

test('presence is the live composition reading: present, degraded, absent as observed (02 §11 Retire)', () => {
  const model = buildSystemWorkbench({
    composition: composition([
      constituent('central', 'present', 'live_provider', ['central.author.ground']),
      constituent('ai-kit', 'degraded', 'fixture', ['aikit.context.resolve'], 'fixture fallback for aikit — no live recognition observed this owner'),
      constituent('factory', 'absent', 'unobserved'),
    ]),
  });
  assert.equal(model.condition, 'partial', 'the condition is the reading’s own, verbatim');
  assert.deepEqual(model.composition.counts, { present: 1, degraded: 1, absent: 1 });
  assert.deepEqual(model.composition.undisclosed, ['Actuation', 'Workcell', 'Quaternal Logic'], 'owners the reading does not name are disclosed as such');
  assert.equal(model.products.find((product) => product.id === 'central').presence.state_word, 'present');
  assert.equal(model.products.find((product) => product.id === 'ai-kit').presence.state_word, 'degraded');
  assert.equal(model.products.find((product) => product.id === 'ai-kit').presence.provider_class, 'fixture', 'the provider class is disclosed beside the presence');
  assert.equal(model.products.find((product) => product.id === 'factory').presence.state_word, 'absent');
  assert.deepEqual(model.warnings, ['composition warning, verbatim'], 'the reading’s warnings are carried verbatim');
});

test('capability descriptors never become presence (K2 fix, S3 residual)', () => {
  const model = buildSystemWorkbench({
    composition: composition([
      // a full descriptor inventory on an owner the reading observed as absent
      constituent('ai-kit', 'absent', 'unobserved', ['aikit.context.resolve', 'aikit.session.read', 'aikit.action.dispatch']),
      // and on a fixture-served owner
      constituent('workcell', 'degraded', 'fixture', ['workcell.offer.bind']),
    ]),
  });
  const aikit = model.products.find((product) => product.id === 'ai-kit');
  assert.equal(aikit.presence.state_word, 'absent', 'descriptors do not promote an absent owner to present');
  assert.deepEqual(aikit.presence.capabilities, ['aikit.context.resolve', 'aikit.session.read', 'aikit.action.dispatch'], 'descriptors are carried, as descriptors');
  const workcell = model.products.find((product) => product.id === 'workcell');
  assert.equal(workcell.presence.state_word, 'degraded', 'fixture presence is degraded, exactly as the reading said');
});

test('AIKit effective resolution never becomes an Active/materialised claim', () => {
  const model = buildSystemWorkbench({
    composition: composition([constituent('ai-kit', 'present', 'live_provider')]),
    aikitContext: {
      version: 'aikit.context-resolution/v2',
      profiles: ['profile/default'],
      capabilities: [{ resource: { descriptor: { id: 'capability/git', kind: 'capability' } }, availability: 'available' }],
      actions: [{ resource: { descriptor: { id: 'action/explain', kind: 'action' } }, availability: 'available' }],
      context_sources: [], model_candidates: [], harness_candidates: [], execution_offers: [],
    },
  });
  const aikit = model.products.find((product) => product.id === 'ai-kit');
  assert.equal(aikit.states.effective.status, 'available');
  assert.equal(aikit.states.active.status, 'not_disclosed');
  assert.match(aikit.states.active.summary, /does not prove material activation/i);
  assert.equal(aikit.actions[0].action_ref, 'action/explain');
  assert.equal('authorised' in aikit.actions[0], false);
});

test('Central Action discovery exposes native ownership without manufacturing staged source mutation', () => {
  const model = buildSystemWorkbench({
    composition: composition([constituent('central', 'present', 'live_provider')]),
    contributions: [contribution('central', 'central.surface/personal', 'ready', [
      { action_ref: 'control.propose-change', native_owner: 'central', availability: 'available' },
      { action_ref: 'control.apply-proposal', native_owner: 'central', availability: 'available' },
    ])],
  });
  const central = model.products.find((product) => product.id === 'central');
  assert.equal(central.states.authored.status, 'not_disclosed');
  assert.equal(central.states.staged.status, 'none');
  assert.equal(central.actions[0].authority, 'native:central');
  assert.match(central.states.authored.summary, /does not copy authored Ground/i);
});

test('Factory read model reports observed execution status but does not invent a staged preview', () => {
  const model = buildSystemWorkbench({
    composition: composition([constituent('factory', 'present', 'live_provider')]),
    factoryBuild: {
      revision: 12,
      provenance: { source: 'factory', factoryStateRevision: 9, runRevision: 5, runMapRevision: 4 },
      view: {
        project: { projectRef: 'project/one', label: 'One' },
        run: { runRef: 'run/one', runMapRef: 'run-map/one', label: 'Run one' },
        frontier: { subjectRef: 'subject/one', mode: 'development', title: 'Build', summary: 'working' },
        candidates: [], humanRequests: [],
        executions: [{ executionRef: 'execution/one', status: 'running' }],
        actions: [{ actionRef: 'factory.action.pause', requiredCapabilityRef: 'capability/pause' }],
      },
    },
  });
  const factory = model.products.find((product) => product.id === 'factory');
  assert.equal(factory.states.active.status, 'available');
  assert.match(factory.states.active.summary, /running/);
  assert.equal(factory.states.staged.status, 'none');
  assert.equal(factory.actions[0].native_owner, 'factory');
});

test('provider gaps stay truthful and non-blocking beneath the composition', () => {
  const model = buildSystemWorkbench({
    composition: composition([
      constituent('workcell', 'degraded', 'fixture'),
      constituent('ql-mef', 'absent', 'unobserved'),
    ]),
    contributions: [
      contribution('workcell', 'workcell.control/read-model', 'pending_native_adapter'),
      contribution('ql-mef', 'ql-mef.provider/read-model', 'pending_native_adapter'),
    ],
  });
  assert.equal(model.condition, 'partial');
  assert.equal(model.ordinary_operation_blocked, false);
  assert.equal(model.products.find((product) => product.id === 'workcell').presence.state_word, 'degraded');
  assert.equal(model.products.find((product) => product.id === 'workcell').states.active.status, 'not_disclosed');
  assert.equal(model.products.find((product) => product.id === 'ql-mef').presence.state_word, 'absent');
  assert.equal(model.products.find((product) => product.id === 'ql-mef').states.observed.status, 'degraded');
});

test('the static constitution table is retired, not disguised', () => {
  const model = buildSystemWorkbench({ composition: composition([constituent('central', 'present', 'live_provider')]) });
  assert.equal('constitution' in model, false, 'no constitution block');
  assert.equal('positions' in model.composition, false, 'no CF5 positions');
  for (const product of model.products) {
    assert.equal('constitution' in product, false);
    assert.equal('position' in product.presence, false, 'presence is not a positional matrix');
  }
  assert.equal(model.invariants.some((invariant) => /capability descriptors are never presence/.test(invariant)), true);
});
