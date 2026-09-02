import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSessionObservatoryReading,
  projectSessionObservatory,
  semanticActivityFromSignals,
} from './session-observatory-model.mjs';

const agentSession = 'agent-session:developer:1';
const connection = {
  binding: { agent_session: agentSession, native_session_id: 'provider-session-77' },
  signals: [
    { sequence: 1, kind: { kind: 'status', text: 'Inspecting repository' }, provenance: ['provider'] },
    { sequence: 2, kind: { kind: 'agent-message-chunk', text: 'Found the seam.' }, provenance: ['provider'] },
    { sequence: 3, kind: { kind: 'completed', stop_reason: 'end_turn' }, provenance: ['provider'] },
    { sequence: 4, kind: { kind: 'provider-extension', message: 'native detail' }, provenance: ['provider'] },
  ],
};
const runtime = {
  agent_sessions: [{ agent_session: agentSession, harness: 'harness:codex', provider: 'provider:acp' }],
  surfaces: [
    { agent_session: agentSession, surface: 'surface:oi:sidecar', state: 'open' },
    { agent_session: agentSession, surface: 'surface:terminal:1', state: 'open' },
  ],
  connections: [{ agent_session: agentSession, connection: 'connection:acp:1', provider: 'provider:acp', protocol: 'acp', state: 'open' }],
};

test('Observatory composes conversation Activity raw Context Actions and runtime over one canonical AgentSession', () => {
  const reading = createSessionObservatoryReading({
    agent_session_ref: agentSession,
    connection,
    runtime,
    context: { version: 'aikit.context-resolution/v2', project_binding: { project: 'project:o-i' } },
    disclosure: { decision: 'allowed', disclosed_resources: ['knowledge:o-i'] },
    actions: [{ action_ref: 'factory.run.inspect', authority: 'native:factory' }],
    provenance: ['AIKit SessionSpace', 'O:I Surface projection'],
  });

  assert.equal(reading.schema, 'oi.session-observatory/v1');
  assert.equal(reading.agent_session_ref, agentSession);
  assert.equal(reading.conversation.provider_binding.native_session_id, 'provider-session-77');
  assert.equal(reading.runtime.session.agent_session, agentSession);
  assert.deepEqual(reading.alternate_surfaces.map((entry) => entry.surface), ['surface:oi:sidecar', 'surface:terminal:1']);
  assert.equal(reading.activity[0].activity_ref, `activity:${agentSession}:connection`);
  assert.equal(reading.activity[0].phase, 'completed');
  assert.equal(reading.activity[0].action_ref, undefined);
  assert.equal(reading.activity[1].trace_ref, `agent-signal:${agentSession}:4`);
  assert.equal(reading.raw.length, 4);
});

test('embedded detached and alternate projections preserve exact Surface and AgentSession identity', () => {
  const reading = createSessionObservatoryReading({ agent_session_ref: agentSession, connection, runtime });
  const embedded = projectSessionObservatory(reading, { mode: 'embedded' });
  const detached = projectSessionObservatory(reading, { mode: 'detached', window_ref: 'window:observatory:1' });
  const alternate = projectSessionObservatory(reading, { mode: 'alternate', provider_surface_ref: 'surface:terminal:1' });

  for (const projection of [embedded, detached, alternate]) {
    assert.equal(projection.surface_ref, 'surface/oi/session-observatory');
    assert.equal(projection.agent_session_ref, agentSession);
  }
  assert.equal(detached.window_ref, 'window:observatory:1');
  assert.equal(alternate.provider_surface_ref, 'surface:terminal:1');
});

test('mismatched provider binding fails rather than trapping Observatory onto another session', () => {
  assert.throws(() => createSessionObservatoryReading({
    agent_session_ref: agentSession,
    connection: { ...connection, binding: { ...connection.binding, agent_session: 'agent-session:other' } },
  }), /must match Observatory AgentSession/);
});

test('known signals coalesce into semantic lifecycle while unknown native signal remains raw-linked generic Activity', () => {
  const activity = semanticActivityFromSignals(agentSession, connection.signals);
  assert.equal(activity.length, 2);
  assert.equal(activity[0].revision, 3);
  assert.equal(activity[0].phase, 'completed');
  assert.equal(activity[0].semantic_summary, 'end_turn');
  assert.equal(activity[1].verb, 'Observed');
  assert.equal(activity[1].phase, 'active');
});
