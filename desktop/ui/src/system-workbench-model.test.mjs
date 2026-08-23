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

const currentWorld = (presentPositions, cf5 = false) => ({
  schema: 'oi.current-world/v1',
  personal_ground: '/Central',
  current_machine: {
    role: 'current',
    central_source: 'Control/machines/current.json',
    workcell_ref: 'workcell:local',
    health: 'ready',
  },
  positions: [
    ['central', 'Central'],
    ['actuation', 'Actuation'],
    ['ai-kit', 'AIKit'],
    ['software-factory', 'Software Factory'],
    ['workcell', 'Workcell'],
    ['quaternal-logic', 'Quaternal Logic'],
  ].map(([product_id, public_name], position) => ({
    position,
    product_id,
    public_name,
    native_owner: `owner:${product_id}`,
    state: presentPositions.includes(position) ? 'registered' : 'missing',
    present: presentPositions.includes(position),
  })),
  context_frame: {
    reading: cf5 ? 'cf5' : undefined,
    maximal: cf5,
    present_positions: presentPositions,
  },
  warnings: [],
});

test('System always composes exactly six owners across seven distinct state axes', () => {
  const model = buildSystemWorkbench();
  assert.equal(model.schema, 'oi.system-workbench/v1');
  assert.deepEqual(model.state_axes, SYSTEM_STATE_AXES);
  assert.deepEqual(model.products.map((product) => product.id), ['central', 'actuation', 'ai-kit', 'factory', 'workcell', 'ql-mef']);
  for (const product of model.products) assert.deepEqual(Object.keys(product.states), SYSTEM_STATE_AXES);
  assert.equal(model.condition, 'unavailable');
  assert.equal(model.ordinary_operation_blocked, false);
});

test('CurrentWorld is the top-level partial constitution and retains exact positions', () => {
  const model = buildSystemWorkbench({ currentWorld: currentWorld([0, 1, 4]) });
  assert.equal(model.condition, 'partial');
  assert.deepEqual(model.constitution.present_positions, [0, 1, 4]);
  assert.equal(model.constitution.reading, null);
  assert.equal(model.products.find((product) => product.id === 'central').constitution.present, true);
  assert.equal(model.products.find((product) => product.id === 'factory').constitution.present, false);
  assert.equal(model.products.find((product) => product.id === 'workcell').constitution.position, 4);
  assert.equal(model.constitution.current_machine.workcell_ref, 'workcell:local');
});

test('CF5 appears only from an actual maximal CurrentWorld context-frame reading', () => {
  const merelySixRows = buildSystemWorkbench({ currentWorld: currentWorld([0, 1, 2, 3, 4, 5], false) });
  assert.equal(merelySixRows.condition, 'partial');
  assert.equal(merelySixRows.constitution.reading, null);

  const maximal = buildSystemWorkbench({ currentWorld: currentWorld([0, 1, 2, 3, 4, 5], true) });
  assert.equal(maximal.condition, 'cf5');
  assert.equal(maximal.constitution.reading, 'cf5');
  assert.equal(maximal.constitution.maximal, true);
});

test('AIKit effective resolution never becomes an Active/materialised claim', () => {
  const model = buildSystemWorkbench({
    currentWorld: currentWorld([0, 1, 2, 4]),
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
    currentWorld: currentWorld([0]),
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
    currentWorld: currentWorld([0, 1, 2, 3, 4]),
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

test('Workcell and QL provider gaps stay truthful and non-blocking beneath CurrentWorld', () => {
  const model = buildSystemWorkbench({
    currentWorld: currentWorld([0, 1, 2, 3, 4]),
    contributions: [
      contribution('workcell', 'workcell.control/read-model', 'pending_native_adapter'),
      contribution('ql-mef', 'ql-mef.provider/read-model', 'pending_native_adapter'),
    ],
  });
  assert.equal(model.condition, 'partial');
  assert.equal(model.ordinary_operation_blocked, false);
  assert.equal(model.products.find((product) => product.id === 'workcell').constitution.present, true);
  assert.equal(model.products.find((product) => product.id === 'workcell').states.active.status, 'not_disclosed');
  assert.equal(model.products.find((product) => product.id === 'ql-mef').constitution.present, false);
  assert.equal(model.products.find((product) => product.id === 'ql-mef').states.observed.status, 'degraded');
});
