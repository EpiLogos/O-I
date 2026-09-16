import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARED_STAGE_MAX_EDITS,
  SHARED_STAGE_SCHEMA,
  advanceSharedStage,
  closeSharedStage,
  createSharedStage,
  createStageEdit,
  validateSharedStage,
} from './shared-stage.mjs';

function stageFixture(overrides = {}) {
  return {
    shared_stage_ref: 'stage:oi:field:public',
    field_ref: 'oi:field:public',
    presenter_ref: 'participant:public:ariadne',
    subject_ref: 'wiki:node:parasakti-m2',
    presentation: { ref: 'presentation:parasakti-m2', revision: 3 },
    expression: { ref: 'expression:parasakti-m2', revision: 7 },
    scene_ref: 'scene:harmonic-3',
    focus_ref: 'being:parasakti',
    provenance: [{ kind: 'authored', ref: 'participant:public:ariadne', source_system: 'o-i', revision: 'expression:parasakti-m2@7' }],
    ...overrides,
  };
}

function editFixture(overrides = {}) {
  return {
    edit_ref: 'stage-edit:oi:field:public:2:1',
    participant_ref: 'participant:public:ariadne',
    at_revision: 2,
    target: { kind: 'scene', ref: 'scene:harmonic-3' },
    change: { tempo: 0.5 },
    causal: { kind: 'activity', ref: 'activity:central:owner:stage-1' },
    occurred_at: '2026-09-16T12:00:00.000Z',
    ...overrides,
  };
}

test('Shared Stage v1 carries only admitted shared presentation state', () => {
  const stage = createSharedStage(stageFixture());

  assert.equal(stage.schema, SHARED_STAGE_SCHEMA);
  assert.equal(stage.revision, 1);
  assert.equal(stage.state, 'open');
  assert.deepEqual(stage.edits, []);
  assert.equal(stage.subject_ref, 'wiki:node:parasakti-m2');
  assert.deepEqual(stage.expression, { ref: 'expression:parasakti-m2', revision: 7 });
  for (const localDefault of ['tabs', 'splits', 'window', 'camera', 'search_history', 'agent_transcript', 'session_space', 'nara_raw', 'gpu_buffers', 'workspace']) {
    assert.equal(localDefault in stage, false, `local ${localDefault} state must have no place on the shared stage`);
  }
});

test('a stage revision advances one step under an expected-revision check', () => {
  const stage = createSharedStage(stageFixture());
  const edit = createStageEdit(editFixture());

  const next = advanceSharedStage(
    stage,
    { focus_ref: 'thing:m2-resonator', causal: { kind: 'action', ref: 'oi:action:stage-focus' }, edit },
    { expected_revision: stage.revision, presenter_ref: 'participant:public:ariadne' }
  );

  assert.equal(next.revision, 2);
  assert.equal(next.focus_ref, 'thing:m2-resonator');
  assert.equal(next.scene_ref, 'scene:harmonic-3', 'unchanged shared state carries forward');
  assert.deepEqual(next.causal, { kind: 'action', ref: 'oi:action:stage-focus' });
  assert.equal(next.edits.length, 1);
  assert.equal(next.edits[0].edit_ref, 'stage-edit:oi:field:public:2:1');

  assert.throws(
    () => advanceSharedStage(stage, { focus_ref: 'x' }, { expected_revision: 9, presenter_ref: 'participant:public:ariadne' }),
    /advanced from under this writer/
  );
});

test('a presenter handoff is explicit and edits stay attributable to the advancing presenter', () => {
  const stage = createSharedStage(stageFixture());
  const handed = advanceSharedStage(
    stage,
    {},
    { expected_revision: 1, presenter_ref: 'participant:public:orpheus' }
  );
  assert.equal(handed.presenter_ref, 'participant:public:orpheus');

  assert.throws(
    () => advanceSharedStage(stage, { edit: createStageEdit(editFixture({ participant_ref: 'participant:public:orpheus' })) }, { expected_revision: 1, presenter_ref: 'participant:public:ariadne' }),
    /must be the advancing presenter/
  );
  assert.throws(
    () => advanceSharedStage(stage, { edit: createStageEdit(editFixture({ at_revision: 5 })) }, { expected_revision: 1, presenter_ref: 'participant:public:ariadne' }),
    /must be the new stage revision/
  );
});

test('closing an open stage keeps the field relation and stops the stage', () => {
  const stage = createSharedStage(stageFixture());
  const closed = closeSharedStage(stage, { expected_revision: 1 });
  assert.equal(closed.state, 'closed');
  assert.equal(closed.revision, 2);
  assert.equal(closed.field_ref, stage.field_ref, 'the stage never leaves its field');
  assert.throws(() => advanceSharedStage(closed, {}, { expected_revision: 2, presenter_ref: 'participant:public:ariadne' }), /only an open stage can advance/);
  assert.throws(() => closeSharedStage(closed, { expected_revision: 2 }), /only an open stage can close/);
});

test('the stage contract admits no local-by-default state and bounds its edit history', () => {
  assert.throws(() => validateSharedStage({ ...createSharedStage(stageFixture()), camera: { position: [1, 2, 3] } }), /camera.*is not part of/);
  assert.throws(() => validateSharedStage({ ...createSharedStage(stageFixture()), agent_transcript: ['x'] }), /agent_transcript.*is not part of/);

  const edits = Array.from({ length: SHARED_STAGE_MAX_EDITS + 1 }, (_, index) =>
    createStageEdit(editFixture({ edit_ref: `stage-edit:${index}`, at_revision: 2 }))
  );
  assert.throws(() => validateSharedStage({ ...createSharedStage(stageFixture()), edits }), /exceeds 64 entries/);
});

test('a stage edit is presentation state only and never a source write', () => {
  const edit = createStageEdit(editFixture({ target: { kind: 'expression', ref: 'expression:parasakti-m2', revision: 7 } }));
  assert.equal(edit.target.kind, 'expression');
  assert.equal('payload' in edit, false, 'an edit references an admitted locus, it does not carry source bodies');
  assert.throws(() => createStageEdit(editFixture({ target: { kind: 'wiki-truth', ref: 'wiki:node:x' } })), /target\.kind must be one of/);
  assert.throws(() => createStageEdit(editFixture({ change: {} })), /at least one admitted presentation parameter/);
  assert.throws(() => createStageEdit(editFixture({ causal: { kind: 'source-write', ref: 'x' } })), /causal\.kind must be one of/);
});
