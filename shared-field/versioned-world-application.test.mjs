import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVersionedWorldApplicationReading,
  developmentReturnInteraction,
  projectGitMaterial,
  reconcileGitObservation,
  sourceRecoveryInteraction,
  VERSIONED_WORLD_APPLICATION_SCHEMA,
} from './versioned-world-application.mjs';

const projectRef = 'project:oi';

function gitWorld({ head = 'H12', branch = 'main', working = {}, project = projectRef } = {}) {
  return {
    version: 'aikit.versioned-world/v1',
    project,
    provider: {
      provider: 'native-git',
      status: { state: 'available' },
      capabilities: ['inspect', 'reconcile', 'diff', 'history', 'worktrees', 'create-worktree', 'remove-worktree'],
      implementation_version: 'git-fixture',
    },
    repository: {
      repository_root: '/work/oi',
      worktree_root: '/work/oi',
      head,
      branch,
      detached: false,
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
    },
    working: {
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
      ...working,
    },
    worktrees: [],
  };
}

function recoveryPreview({ current = 'H13', expected = 'H12', recognition = true } = {}) {
  return {
    schema: 'central.source-recovery-preview/v1',
    world_ref: 'project:oi',
    source: {
      source_ref: 'source:ground:founding-positions',
      path: 'ProjectCentral/user/FOUNDING-POSITIONS.md',
      provenance: 'human-authored',
      standing: 'authored-human-position',
    },
    current_content_revision: current,
    expected_content_revision: expected,
    historical_revision: 'H11',
    basis_matches_current: current === expected,
    historical_content: current === expected ? { revision: 'H11', content: 'historical' } : null,
    requires_recognition: recognition,
    mutation_performed: false,
    reason: 'owner-native preview fixture',
  };
}

function development({ base = 'H12', result = 'C15', recognition = null } = {}) {
  return {
    schema: 'factory.git-development-world/v1',
    developmentRef: 'development:run-1:candidate-1',
    base: {
      projectRef,
      runRef: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAW',
      candidateRef: 'candidate:1',
      repositoryRef: 'repo:oi',
      baseRevision: base,
      baseWorktreeClean: true,
      sourceBasisRefs: [],
      structuralGroundRefs: [],
    },
    binding: {
      providerRef: 'aikit:provider:native-git',
      worktreeRef: 'worktree:candidate-1',
      repositoryRef: 'repo:oi',
      currentRevision: result,
      branch: 'agent/candidate-1',
      clean: true,
      conflicts: [],
    },
    returned: {
      schema: 'factory.git-return-evidence/v1',
      baseRevision: base,
      resultRevision: result,
      commits: [result],
      changedPaths: ['src/example.rs'],
      verificationEvidenceRefs: ['evidence:test:1'],
      claimRefs: [],
      conflicts: [],
      providerRef: 'aikit:provider:native-git',
    },
    recognition,
  };
}

test('V7: stale Agent basis cannot blind-overwrite newer human Ground', () => {
  const interaction = sourceRecoveryInteraction(recoveryPreview({ current: 'H13', expected: 'H12' }));
  assert.equal(interaction.base_revision, 'H12');
  assert.equal(interaction.current_revision, 'H13');
  assert.equal(interaction.basis_matches_current, false);
  assert.equal(interaction.difference_available, false);
  assert.equal(interaction.mutation_performed, false);
  assert.deepEqual(interaction.disposition, {
    state: 'basis-conflict',
    operation: 'refuse-blind-apply',
    next: 'reconcile-or-propose',
  });
});

test('V7: matching human Ground basis yields proposal/Recognition, not mutation authority', () => {
  const interaction = sourceRecoveryInteraction(recoveryPreview({ current: 'H12', expected: 'H12' }));
  assert.equal(interaction.difference_available, true);
  assert.equal(interaction.requires_recognition, true);
  assert.equal(interaction.mutation_performed, false);
  assert.equal(interaction.disposition.operation, 'propose');
  assert.equal(interaction.disposition.next, 'central-owner-recognition');
});

test('V7: dirty current bytes remain current even when HEAD did not move', () => {
  const reading = projectGitMaterial(projectRef, gitWorld({
    head: 'H13',
    working: { unstaged: ['ProjectCentral/user/FOUNDING-POSITIONS.md'] },
  }));
  assert.equal(reading.revision, 'H13');
  assert.equal(reading.dirty, true);
  assert.deepEqual(reading.working.unstaged, ['ProjectCentral/user/FOUNDING-POSITIONS.md']);
});

test('V7: external/native Git reconciliation updates observed World without inventing caller identity', () => {
  const before = gitWorld({ head: 'H12' });
  const after = gitWorld({ head: 'H13', working: { untracked: ['notes.txt'] } });
  const reconciled = reconcileGitObservation(projectRef, before, after);
  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.before_revision, 'H12');
  assert.equal(reconciled.current_revision, 'H13');
  assert.equal(reconciled.current_dirty, true);
  assert.equal(reconciled.caller_attribution, 'unknown-unless-canonically-supplied');
});

test('V7: Factory A/B/C divergence preserves exact Candidate basis and awaits reconciliation', () => {
  const interaction = developmentReturnInteraction(projectRef, development({ base: 'H12', result: 'C15' }), 'H13');
  assert.equal(interaction.base_revision, 'H12');
  assert.equal(interaction.current_revision, 'H13');
  assert.equal(interaction.result_revision, 'C15');
  assert.equal(interaction.diverged, true);
  assert.equal(interaction.state, 'returned-diverged');
  assert.equal(interaction.next, 'reconcile-before-recognition');
});

test('V8: one renderer-neutral application reading composes owner facts without owning their history', () => {
  const reading = createVersionedWorldApplicationReading({
    project_ref: projectRef,
    aikit_versioned_world: gitWorld({ head: 'H13' }),
    central_recovery_previews: [recoveryPreview({ current: 'H13', expected: 'H12' })],
    factory_developments: [development({ base: 'H12', result: 'C15' })],
  });
  assert.equal(reading.schema, VERSIONED_WORLD_APPLICATION_SCHEMA);
  assert.equal(reading.project_ref, projectRef);
  assert.equal(reading.git.revision, 'H13');
  assert.equal(reading.sources[0].disposition.state, 'basis-conflict');
  assert.equal(reading.developments[0].state, 'returned-diverged');
  assert.deepEqual(reading.invariants, {
    history_store_owned_by_oi: false,
    git_identity_is_project_identity: false,
    preview_is_mutation_authority: false,
    returned_git_difference_is_recognition: false,
    unknown_git_actor_is_inferred_caller: false,
  });
});

test('V8 P1: non-Git World remains first-class with owner revision semantics only', () => {
  const reading = createVersionedWorldApplicationReading({
    project_ref: projectRef,
    central_recovery_previews: [recoveryPreview({ current: 'S9', expected: 'S9', recognition: false })],
  });
  assert.equal(reading.git.availability, 'not-provided');
  assert.equal(reading.git.revision, null);
  assert.equal(reading.sources[0].current_revision, 'S9');
  assert.equal(reading.sources[0].disposition.operation, 'owner-authority-required');
});

test('semantic Project identity rejects mismatched AIKit or Factory material identity', () => {
  assert.throws(
    () => projectGitMaterial(projectRef, gitWorld({ project: 'project:other' })),
    /ProjectRef does not match/,
  );
  const other = development();
  other.base.projectRef = 'project:other';
  assert.throws(
    () => developmentReturnInteraction(projectRef, other, 'H13'),
    /ProjectRef does not match/,
  );
});
