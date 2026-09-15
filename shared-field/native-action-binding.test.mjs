import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeBoundAction, parseActionRef, resolveBoundAction } from './native-action-binding.mjs';
import { createWorldPresentation } from './presentation.mjs';
import { validateActivity } from './activity.mjs';

function presentation() {
  return createWorldPresentation({
    schema: 'oi.world-presentation/v1', presentation_ref: 'presentation:t', world_ref: 'world:t', revision: 1, title: 'T', theme: { tokens: {} },
    provenance: [{ kind: 'test', ref: 'fixture', source_system: 'oi-test', revision: '1' }],
    regions: [{ region_ref: 'main', role: 'reading', bindings: [
      { schema: 'oi.presentation-binding/v1', binding_ref: 'return', component_ref: 'oi.presentation/action/v1', subject_ref: 'wiki:node:project-root/o-i', props: { title: 'Return', action_refs: ['central:action:projectcentral.now.return'] }, fallback: { title: 'Return' }, provenance: [{ kind: 'test', ref: 'fixture', source_system: 'oi-test', revision: '1' }] },
      { schema: 'oi.presentation-binding/v1', binding_ref: 'plain', component_ref: 'oi.presentation/prose/v1', props: {}, fallback: { title: 'Plain' }, provenance: [{ kind: 'test', ref: 'fixture', source_system: 'oi-test', revision: '1' }] },
    ] }],
  });
}

test('action refs parse to owner and canonical action id; anything else is refused', () => {
  assert.deepEqual(parseActionRef('central:action:projectcentral.now.return'), { action_ref: 'central:action:projectcentral.now.return', owner: 'central', action: 'projectcentral.now.return' });
  assert.throws(() => parseActionRef('projectcentral.now.return'), /Unsupported action ref/);
  assert.throws(() => parseActionRef('central:action:rm -rf'), /Unsupported action ref/);
});

test('only an Action the binding discloses is bound, and only to a known native owner', () => {
  const bound = resolveBoundAction(presentation(), 'return', 'central:action:projectcentral.now.return');
  assert.equal(bound.bound, true);
  assert.equal(bound.handler.command, 'ctrl');
  assert.equal(bound.subject_ref, 'wiki:node:project-root/o-i');
  const undisclosed = resolveBoundAction(presentation(), 'plain', 'central:action:projectcentral.now.return');
  assert.equal(undisclosed.bound, false);
  assert.match(undisclosed.reason, /does not disclose/);
  const unknownOwner = resolveBoundAction({ ...presentation(), regions: [{ region_ref: 'main', role: 'reading', bindings: [{ schema: 'oi.presentation-binding/v1', binding_ref: 'x', component_ref: 'c', props: { action_refs: ['factory:action:run.start'] }, fallback: {}, provenance: [{ kind: 'test', ref: 'f', source_system: 't' }] }] }] }, 'x', 'factory:action:run.start');
  assert.equal(unknownOwner.bound, false);
  assert.match(unknownOwner.reason, /No native owner handler/);
});

test('invocation goes through the owner command with the canonical id, and the owner envelope becomes attributable Activity', async () => {
  const calls = [];
  const executor = async (command, args) => {
    calls.push({ command, args });
    return { exit_code: 0, stdout: JSON.stringify({ ok: true, status: 'success', action: 'projectcentral.now.return', data: { record: { id: 'note-1', path: 'ProjectCentral/now/agents/note-1.json' } } }), stderr: '' };
  };
  const bound = resolveBoundAction(presentation(), 'return', 'central:action:projectcentral.now.return');
  const result = await invokeBoundAction(bound, { project: 'O-I', kind: 'note' }, { executor, actor_ref: 'participant:central:owner', result_refs_from: (data) => [data.record.path] });
  assert.equal(result.ok, true);
  assert.deepEqual(calls[0], { command: 'ctrl', args: ['--json', 'action', 'run', 'projectcentral.now.return', JSON.stringify({ project: 'O-I', kind: 'note' })] });
  const activity = validateActivity(result.activity);
  assert.equal(activity.action_ref, 'central:action:projectcentral.now.return');
  assert.equal(activity.native_owner, 'central');
  assert.equal(activity.phase, 'completed');
  assert.deepEqual(activity.result_refs, ['ProjectCentral/now/agents/note-1.json']);
  assert.equal(activity.actor_ref, 'participant:central:owner');
});

test('an owner refusal stays a refusal: failed Activity, no retry, no invented result', async () => {
  let calls = 0;
  const executor = async () => { calls += 1; return { exit_code: 1, stdout: JSON.stringify({ ok: false, status: 'refused', error: 'authority token missing' }), stderr: '' }; };
  const bound = resolveBoundAction(presentation(), 'return', 'central:action:projectcentral.now.return');
  const result = await invokeBoundAction(bound, {}, { executor });
  assert.equal(result.ok, false);
  assert.equal(calls, 1);
  assert.equal(result.activity.phase, 'failed');
  assert.equal(result.activity.needs_attention, true);
  assert.match(result.activity.outcome.error, /authority token missing/);
  assert.deepEqual(result.activity.result_refs, []);
  await assert.rejects(() => invokeBoundAction({ bound: false, reason: 'nope' }, {}, { executor }), /not bound/);
  assert.equal(calls, 1);
});
