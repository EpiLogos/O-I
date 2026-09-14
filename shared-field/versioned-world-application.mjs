export const VERSIONED_WORLD_APPLICATION_SCHEMA = 'oi.versioned-world-application/v1';

const AIKIT_VERSIONED_WORLD_SCHEMA = 'aikit.versioned-world/v1';
const CENTRAL_RECOVERY_PREVIEW_SCHEMA = 'central.source-recovery-preview/v1';
const FACTORY_GIT_DEVELOPMENT_SCHEMA = 'factory.git-development-world/v1';

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sourceRef(source) {
  return source.source_ref ?? source.ref;
}

function dirtyWorkingState(working = {}) {
  return ['staged', 'unstaged', 'untracked', 'conflicted']
    .some((key) => Array.isArray(working[key]) && working[key].length > 0);
}

/**
 * Project an AIKit-owned VersionedProjectWorld into O:I application state.
 *
 * Repository/worktree/branch/commit remain material/history evidence. This
 * function cannot mint or rebind the canonical Project ref supplied by the
 * surrounding O:I World.
 */
export function projectGitMaterial(projectRef, versionedWorld) {
  if (versionedWorld === undefined || versionedWorld === null) {
    return {
      availability: 'not-provided',
      provider: null,
      revision: null,
      dirty: false,
      caller_attribution: 'not-observed',
    };
  }
  record(versionedWorld, 'AIKit VersionedWorld');
  if (versionedWorld.version !== AIKIT_VERSIONED_WORLD_SCHEMA) {
    throw new TypeError(`unsupported AIKit VersionedWorld schema: ${versionedWorld.version}`);
  }
  if (text(versionedWorld.project, 'AIKit VersionedWorld.project') !== projectRef) {
    throw new TypeError('AIKit VersionedWorld ProjectRef does not match the resolved O:I Project');
  }
  const repository = record(versionedWorld.repository, 'AIKit VersionedWorld.repository');
  const provider = record(versionedWorld.provider, 'AIKit VersionedWorld.provider');
  return {
    availability: provider.status ?? 'unknown',
    provider: clone(provider),
    revision: clone(repository.head),
    branch: repository.branch ?? null,
    upstream: clone(repository.upstream ?? null),
    ahead: repository.ahead ?? 0,
    behind: repository.behind ?? 0,
    repository_root: repository.repository_root,
    worktree_root: repository.worktree_root,
    detached: Boolean(repository.detached),
    dirty: dirtyWorkingState(versionedWorld.working),
    working: clone(versionedWorld.working),
    worktrees: clone(versionedWorld.worktrees ?? []),
    // Git author/committer/process evidence is not O:I caller identity.
    caller_attribution: 'unknown-unless-canonically-supplied',
  };
}

/**
 * Turn Central's owner-native recovery preview into one common application
 * interaction packet. O:I makes the conflict/proposal standing visible but never
 * upgrades preview material into mutation authority.
 */
export function sourceRecoveryInteraction(preview) {
  record(preview, 'Central recovery preview');
  if (preview.schema !== CENTRAL_RECOVERY_PREVIEW_SCHEMA) {
    throw new TypeError(`unsupported Central recovery preview schema: ${preview.schema}`);
  }
  const source = record(preview.source, 'Central recovery preview.source');
  const subjectRef = text(sourceRef(source), 'Central recovery preview.source ref');
  const baseRevision = text(preview.expected_content_revision, 'expected_content_revision');
  const currentRevision = text(preview.current_content_revision, 'current_content_revision');
  const historicalRevision = text(preview.historical_revision, 'historical_revision');

  let disposition;
  if (!preview.basis_matches_current) {
    disposition = {
      state: 'basis-conflict',
      operation: 'refuse-blind-apply',
      next: 'reconcile-or-propose',
    };
  } else if (preview.requires_recognition) {
    disposition = {
      state: 'candidate-ready',
      operation: 'propose',
      next: 'central-owner-recognition',
    };
  } else {
    disposition = {
      state: 'candidate-ready',
      operation: 'owner-authority-required',
      next: 'central-owner-mutation-path',
    };
  }

  return {
    subject_ref: subjectRef,
    owner: 'Central',
    world_ref: preview.world_ref,
    base_revision: baseRevision,
    current_revision: currentRevision,
    candidate_revision: historicalRevision,
    basis_matches_current: Boolean(preview.basis_matches_current),
    difference_available: preview.historical_content !== null && preview.historical_content !== undefined,
    mutation_performed: Boolean(preview.mutation_performed),
    requires_recognition: Boolean(preview.requires_recognition),
    disposition,
    owner_reading: clone(preview),
  };
}

/**
 * Project Factory's developmental Git World without interpreting Git success as
 * Candidate Recognition. Exact A(base), B(current), C(returned) remain distinct.
 */
export function developmentReturnInteraction(projectRef, development, currentProjectRevision) {
  record(development, 'Factory GitDevelopmentWorld');
  if (development.schema !== FACTORY_GIT_DEVELOPMENT_SCHEMA) {
    throw new TypeError(`unsupported Factory Git development schema: ${development.schema}`);
  }
  const base = record(development.base, 'Factory GitDevelopmentWorld.base');
  if (text(base.projectRef ?? base.project_ref, 'Factory base ProjectRef') !== projectRef) {
    throw new TypeError('Factory Git development ProjectRef does not match the resolved O:I Project');
  }
  const originalBase = text(base.baseRevision ?? base.base_revision, 'Factory base revision');
  const current = text(currentProjectRevision, 'current Project revision');
  const returned = development.returned ? record(development.returned, 'Factory returned evidence') : null;
  const resultRevision = returned
    ? text(returned.resultRevision ?? returned.result_revision, 'Factory returned result revision')
    : null;
  const recognition = development.recognition ? record(development.recognition, 'Factory recognition') : null;
  const diverged = originalBase !== current;

  let state = 'developing';
  let next = 'continue-development';
  if (returned && diverged) {
    state = 'returned-diverged';
    next = 'reconcile-before-recognition';
  } else if (returned && !recognition) {
    state = 'returned-awaiting-recognition';
    next = 'factory-recognition';
  } else if (returned && recognition) {
    state = recognition.accepted ? 'recognised' : 'returned-not-accepted';
    next = recognition.accepted ? 'owner-integration-evidence' : 'retain-return-evidence';
  }

  return {
    development_ref: development.developmentRef ?? development.development_ref,
    owner: 'Factory',
    project_ref: projectRef,
    base_revision: originalBase,
    current_revision: current,
    result_revision: resultRevision,
    diverged,
    state,
    next,
    returned: clone(returned),
    recognition: clone(recognition),
  };
}

/**
 * Reconcile two AIKit Git observations after native/external Git use. A changed
 * repository state is observable; actor identity remains unknown unless supplied
 * independently through canonical Agency/caller provenance.
 */
export function reconcileGitObservation(projectRef, previous, current) {
  const before = projectGitMaterial(projectRef, previous);
  const after = projectGitMaterial(projectRef, current);
  const beforeRevision = before.revision?.value ?? before.revision?.revision ?? before.revision ?? null;
  const afterRevision = after.revision?.value ?? after.revision?.revision ?? after.revision ?? null;
  const changed = JSON.stringify({
    revision: beforeRevision,
    branch: before.branch,
    working: before.working,
  }) !== JSON.stringify({
    revision: afterRevision,
    branch: after.branch,
    working: after.working,
  });
  return {
    project_ref: projectRef,
    changed,
    before_revision: beforeRevision,
    current_revision: afterRevision,
    current_dirty: after.dirty,
    caller_attribution: changed ? 'unknown-unless-canonically-supplied' : 'no-change-observed',
    current: after,
  };
}

/**
 * O:I application composition over owner-shaped temporal readings. This is a
 * renderer-neutral read/decision projection, not a history store and not a
 * universal VersionedObject contract.
 */
export function createVersionedWorldApplicationReading({
  project_ref,
  aikit_versioned_world = null,
  central_recovery_previews = [],
  factory_developments = [],
  current_project_revision = null,
}) {
  const projectRef = text(project_ref, 'project_ref');
  if (!Array.isArray(central_recovery_previews)) throw new TypeError('central_recovery_previews must be an array');
  if (!Array.isArray(factory_developments)) throw new TypeError('factory_developments must be an array');

  const git = projectGitMaterial(projectRef, aikit_versioned_world);
  const projectRevision = current_project_revision
    ?? git.revision?.value
    ?? git.revision?.revision
    ?? (typeof git.revision === 'string' ? git.revision : null);

  return Object.freeze({
    schema: VERSIONED_WORLD_APPLICATION_SCHEMA,
    project_ref: projectRef,
    git,
    sources: central_recovery_previews.map(sourceRecoveryInteraction),
    developments: factory_developments.map((development) => {
      if (!projectRevision) {
        throw new TypeError('current_project_revision is required to compose Factory development without an AIKit current revision');
      }
      return developmentReturnInteraction(projectRef, development, projectRevision);
    }),
    invariants: Object.freeze({
      history_store_owned_by_oi: false,
      git_identity_is_project_identity: false,
      preview_is_mutation_authority: false,
      returned_git_difference_is_recognition: false,
      unknown_git_actor_is_inferred_caller: false,
    }),
  });
}
