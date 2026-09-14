import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceActivity,
  attentionFromActivity,
  createActivity,
  genericObservedActivity,
  notificationFromActivity,
  resolveAttention,
} from './activity.mjs';

const base = {
  activity_ref: 'activity:factory:run-1',
  native_owner: 'factory',
  actor_ref: 'agent:developer',
  agency_ref: 'agency:development',
  agent_session_ref: 'agent-session:1',
  subject: { ref: 'run:1', kind: 'factory.run' },
  action_ref: 'factory.run.execute',
  invocation_ref: 'invocation:1',
  verb: 'Building',
  object_ref: 'project:o-i',
  semantic_summary: 'Building O:I candidate.',
  phase: 'active',
  needs_attention: false,
  result_refs: [],
  evidence_refs: [],
  trace_ref: 'trace:factory:1',
  started_at: '2026-08-31T17:00:00Z',
  updated_at: '2026-08-31T17:00:00Z',
  provenance: [{ source_system: 'EpiLogos/agent-system-design', revision: 'aab1c233' }],
};

test('one Activity evolves in place while Result Evidence and Return accumulate', () => {
  const active = createActivity(base);
  const waiting = advanceActivity(active, {
    phase: 'waiting',
    semantic_summary: 'Waiting for a consequential human decision.',
    needs_attention: true,
    updated_at: '2026-08-31T17:01:00Z',
  });
  const completed = advanceActivity(waiting, {
    phase: 'completed',
    semantic_summary: 'Candidate built and returned.',
    needs_attention: false,
    result_refs: ['result:1'],
    evidence_refs: ['evidence:1'],
    return_ref: 'return:1',
    updated_at: '2026-08-31T17:02:00Z',
  });

  assert.equal(active.activity_ref, waiting.activity_ref);
  assert.equal(waiting.activity_ref, completed.activity_ref);
  assert.deepEqual([active.revision, waiting.revision, completed.revision], [1, 2, 3]);
  assert.deepEqual(completed.result_refs, ['result:1']);
  assert.deepEqual(completed.evidence_refs, ['evidence:1']);
  assert.equal(completed.return_ref, 'return:1');
  assert.equal(completed.trace_ref, 'trace:factory:1');
});

test('terminal Activity cannot silently reopen', () => {
  const failed = createActivity({ ...base, phase: 'failed', semantic_summary: 'Build failed.' });
  assert.throws(() => advanceActivity(failed, { phase: 'active' }), /terminal Activity/);
});

test('unknown native event degrades to generic Activity without fabricating Action or Invocation', () => {
  const activity = genericObservedActivity({
    activity_ref: 'activity:provider:1',
    native_owner: 'provider:unknown',
    subject: { ref: 'provider-event:1', kind: 'native-event' },
    phase: 'active',
    trace_ref: 'trace:raw:1',
    started_at: '2026-08-31T17:00:00Z',
    provenance: [{ source_system: 'native-provider', revision: 'unknown' }],
  });

  assert.equal(activity.verb, 'Observed');
  assert.equal(activity.trace_ref, 'trace:raw:1');
  assert.equal(Object.hasOwn(activity, 'action_ref'), false);
  assert.equal(Object.hasOwn(activity, 'invocation_ref'), false);
});

test('Notification is optional projection and Attention requires explicit semantic need', () => {
  const routine = createActivity(base);
  const notification = notificationFromActivity(routine, {
    notification_ref: 'notification:1',
    projected_at: '2026-08-31T17:00:05Z',
    destination: 'desktop',
    deep_link_ref: routine.activity_ref,
  });
  assert.equal(notification.schema, 'oi.notification/v1');
  assert.throws(() => attentionFromActivity(routine, {
    attention_ref: 'attention:1',
    reason: 'guess from prose',
    created_at: '2026-08-31T17:00:05Z',
  }), /does not declare needs_attention/);

  const consequential = advanceActivity(routine, {
    phase: 'waiting',
    needs_attention: true,
    semantic_summary: 'HumanRequest requires Recognition.',
    updated_at: '2026-08-31T17:01:00Z',
  });
  const attention = attentionFromActivity(consequential, {
    attention_ref: 'attention:human-request:1',
    reason: 'Native Factory HumanRequest requires a human decision.',
    created_at: '2026-08-31T17:01:00Z',
    deep_link_ref: 'human-request:1',
  });
  assert.equal(attention.schema, 'oi.attention/v1');
  assert.equal(attention.state, 'open');
  assert.equal(attention.native_owner, 'factory');

  const resolved = resolveAttention(attention, {
    resolved_at: '2026-08-31T17:02:00Z',
    resolution_ref: 'recognition:1',
  });
  assert.equal(resolved.state, 'resolved');
  assert.equal(resolved.resolution_ref, 'recognition:1');
});
