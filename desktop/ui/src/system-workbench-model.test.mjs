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

test('System always composes exactly six owners across seven distinct state axes', () => {
  const model = buildSystemWorkbench();
  assert.equal(model.schema, 'oi.system-workbench/v1');
  assert.deepEqual(model.state_axes, SYSTEM_STATE_AXES);
  assert.deepEqual(model.products.map((product) => product.id), ['central', 'actuation', 'ai-kit', 'factory', 'workcell', 'ql-mef']);
  for (const product of model.products) assert.deepEqual(Object.keys(product.states), SYSTEM_STATE_AXES);
  assert.equal(model.ordinary_operation_blocked, false);
});

test('AIKit effective resolution never becomes an Active/materialised claim', () => {
  const model = buildSystemWorkbench({
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

test('Workcell and QL provider gaps stay truthful and non-blocking', () => {
  const model = buildSystemWorkbench({
    contributions: [
      contribution('workcell', 'workcell.control/read-model', 'pending_native_adapter'),
      contribution('ql-mef', 'ql-mef.provider/read-model', 'pending_native_adapter'),
    ],
  });
  assert.equal(model.condition, 'partial');
  assert.equal(model.ordinary_operation_blocked, false);
  assert.equal(model.products.find((product) => product.id === 'workcell').states.active.status, 'not_disclosed');
  assert.equal(model.products.find((product) => product.id === 'ql-mef').states.observed.status, 'degraded');
});
