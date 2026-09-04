import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorldRecognitionModel, WORLD_RECOGNITION_SCHEMA } from './world-recognition-model.mjs';

const account = {
  schema: WORLD_RECOGNITION_SCHEMA,
  target: '/Users/admin/Central',
  sources: [],
  providers: [
    { provider_ref: 'oi:builtin/native-tool-observation', package_ref: 'oi:core', status: 'observed', detail: '6 installed native tools observed' },
    { provider_ref: 'oi:builtin/owner-participation-reconciliation', package_ref: 'oi:core', status: 'observed', detail: '6 native-owner participations reconciled' },
    { provider_ref: 'oi:builtin/owner-capacity-reconciliation', package_ref: 'oi:core', status: 'observed', detail: '3 native-owner capacities disclosed' },
  ],
  observations: [
    {
      observation_ref: 'observation:claude:local',
      native_system: { system_ref: 'native:claude:local', kind: 'harness', name: 'claude', version: '2.1.238 (Claude Code)', locator: '/Users/admin/.local/bin/claude' },
      support: 'observed',
      faculties: [],
      relations: [],
      facts: { degraded: false },
      owner_bindings: [
        { owner: 'AIKit', contract: 'aikit.client-adapter/v1', state: 'installed', provenance: ['aikit client status'] },
      ],
      evidence: [],
    },
    {
      observation_ref: 'observation:cmux:local',
      native_system: { system_ref: 'native:cmux:local', kind: 'working-environment', name: 'cmux', version: '0.64.22', locator: '/usr/local/bin/cmux' },
      support: 'observed',
      faculties: [],
      relations: [],
      facts: { degraded: false, daemon_running: false, build: '102' },
      owner_bindings: [
        { owner: 'AIKit', contract: 'aikit.working-environment-provider/v1', state: 'installed-not-running', provenance: ['aikit mux detect'] },
      ],
      evidence: [],
    },
    {
      observation_ref: 'observation:ollama:local',
      native_system: { system_ref: 'native:ollama:local', kind: 'model-provider', name: 'ollama', version: 'ollama version is 0.12.6', locator: '/usr/local/bin/ollama' },
      support: 'observed',
      faculties: [],
      relations: [],
      facts: { degraded: false },
      owner_bindings: [],
      evidence: [],
    },
  ],
  owner_participations: [
    { owner: 'AIKit', native_system: { system_ref: 'native:tmux:local', kind: 'working-environment', name: 'tmux' }, contract: 'aikit.working-environment-provider/v1', state: 'server-running', readiness: {}, provenance: [] },
    { owner: 'AIKit', native_system: { system_ref: 'native:claude:local', kind: 'harness', name: 'claude' }, contract: 'aikit.client-adapter/v1', state: 'installed', readiness: {}, provenance: [] },
  ],
  owner_contracts: [
    { owner: 'Actuation', contract: 'actuation.model-bearing/v1', field: 'model-bearing', provenance: [] },
    { owner: 'Actuation', contract: 'actuation.agency/v1', field: 'agency', provenance: [] },
  ],
  owner_capacities: [
    { owner: 'Workcell', capacity_ref: 'provider:collapsed-local-workspace', ports: ['workspace'], state: 'healthy', facts: { health: ['healthy'], offers_count: 1 }, provenance: [] },
    { owner: 'Workcell', capacity_ref: 'provider:collapsed-local-execution', ports: ['execution'], state: 'degraded', facts: { health: ['healthy', 'degraded'], offers_count: 1 }, provenance: [] },
  ],
  extension_requests: [
    { request_ref: 'extension:ollama:Actuation', native_system_ref: 'native:ollama:local', owner: 'Actuation', reason: 'model-provider present with no installed owner participation', sdk: 'actuation.model-bearing/v1', authoring_skill: 'x', conformance: 'x', package_target: 'oi.package/v1' },
  ],
  provider_errors: [],
};

test('rejects a non-World account', () => {
  assert.equal(buildWorldRecognitionModel(null), null);
  assert.equal(buildWorldRecognitionModel({ schema: 'oi.current-world/v1' }), null);
});

test('summarises systems, bindings, capacities and extension gaps', () => {
  const model = buildWorldRecognitionModel(account);
  assert.equal(model.target, '/Users/admin/Central');
  assert.equal(model.summary.systems, 3);
  assert.equal(model.summary.degraded, 0);
  assert.equal(model.summary.bound, 2);
  assert.equal(model.summary.unbound, 1);
  assert.equal(model.summary.owners_participating, 1);
  assert.equal(model.summary.capacities, 2);
  assert.equal(model.summary.extension_gaps, 1);
});

test('distinguishes bound from unbound and carries degraded facts honestly', () => {
  const model = buildWorldRecognitionModel(account);
  const claude = model.observations.find((observation) => observation.name === 'claude');
  const cmux = model.observations.find((observation) => observation.name === 'cmux');
  const ollama = model.observations.find((observation) => observation.name === 'ollama');

  assert.equal(claude.owners, 'AIKit');
  assert.equal(claude.owner_bindings[0].contract, 'aikit.client-adapter/v1');
  assert.equal(claude.degraded, false);

  assert.equal(cmux.owners, 'AIKit');
  assert.equal(cmux.owner_bindings[0].state, 'installed-not-running');
  // daemon_running is disclosed as a fact, not a degraded flag.
  assert.equal(cmux.degraded, false);
  assert.deepEqual(cmux.facts, [
    { key: 'daemon_running', value: false },
    { key: 'build', value: '102' },
  ]);

  assert.equal(ollama.owners, null);
  assert.equal(ollama.owner_bindings.length, 0);
});

test('maps owner contracts and capacities to their owners', () => {
  const model = buildWorldRecognitionModel(account);
  assert.equal(model.contracts[0].owner, 'Actuation');
  assert.equal(model.contracts[0].contract, 'actuation.model-bearing/v1');
  assert.equal(model.capacities[0].owner, 'Workcell');
  assert.equal(model.capacities[0].state, 'healthy');
  assert.deepEqual(model.capacities[1].health, ['healthy', 'degraded']);
});

test('routes extension frontier by native ownership', () => {
  const model = buildWorldRecognitionModel(account);
  assert.equal(model.frontier.length, 1);
  assert.equal(model.frontier[0].native_system_ref, 'native:ollama:local');
  assert.equal(model.frontier[0].owner, 'Actuation');
  assert.equal(model.frontier[0].sdk, 'actuation.model-bearing/v1');
});
