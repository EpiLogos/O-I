import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { activityEdition, activityReading, expressionActivity, factoryRunActivityState, replayActivity, ACTIVITY_EDITION_SCHEMA } from './activity-liveness.mjs';
import { createSharedStage, closeSharedStage } from './shared-stage.mjs';

const WORLD = 'world:central:project:O-I';
const RUN = 'run:01TESTRUN0000000000000000';
const ACTIVITY = `${WORLD}/${RUN}`;
const FIELD = 'oi:field:test';
const NOW = Date.parse('2026-09-28T12:00:00.000Z');
const microsAt = (ms) => String(BigInt(ms) * 1000n);

const entry = (liveness = 'live') => ({ ref: ACTIVITY, kind: 'activity', world_ref: WORLD, label: 'Factory run', revision: '6', meta: { standing: 'activity', state: 'seeded', run_ref: RUN, liveness, participants: [] } });
const row = (heartbeatMs, extra = {}) => ({ activity_key: `${FIELD}|${ACTIVITY}`, field_ref: FIELD, activity_ref: ACTIVITY, producer_participant_ref: 'participant:owner', producer_identity: 'c200', owner_state: 'running', owner_revision: 7, observed_at_micros: microsAt(NOW - 60_000), heartbeat_at_micros: microsAt(heartbeatMs), ...extra });

test('a shared Expression joins only its exact admitted stage, material revisions and qualified activity', () => {
  const expression = 'expression:continuation', presentation = 'presentation:continuation';
  const contract = createSharedStage({shared_stage_ref:'stage:continuation',field_ref:FIELD,presenter_ref:'participant:owner',subject_ref:expression,expression:{ref:expression,revision:4},presentation:{ref:presentation,revision:6},causal:{kind:'activity',ref:ACTIVITY},provenance:[{kind:'native-act',ref:ACTIVITY,source_system:'factory',revision:'7'}]});
  const stage = {stage_ref:contract.shared_stage_ref,field_ref:FIELD,subject_ref:expression,presenter_ref:contract.presenter_ref,state:contract.state,revision:contract.revision,contract};
  const activity = {...entry(),meta:{...entry().meta,expression_ref:expression}};
  const args = {expression_ref:expression,expression_revision:4,presentation_ref:presentation,presentation_revision:6,world_ref:WORLD,field_ref:FIELD,activity_ref:ACTIVITY,stages:[stage],entries:[activity]};
  const joined = expressionActivity(args);
  assert.equal(joined.state,'bound');assert.equal(joined.entry,activity);
  for (const delta of [{expression_revision:5},{presentation_revision:7},{world_ref:'world:another'},{field_ref:'oi:field:neighbour'},{activity_ref:`${WORLD}/run:OTHER`}]) assert.equal(expressionActivity({...args,...delta}).state,'unavailable');
  for (const key of ['revision','subject_ref','presenter_ref']) assert.equal(expressionActivity({...args,stages:[{...stage,[key]:key==='revision'?2:'other'}]}).state,'unavailable');
  const closed = closeSharedStage(contract,{expected_revision:contract.revision});
  for (const stages of [[],[stage,stage],[{...stage,state:closed.state,revision:closed.revision,contract:closed}]]) assert.equal(expressionActivity({...args,stages}).state,'unavailable');
  // Even a withdrawn activity/stage retains the publication's explicit
  // binding; it cannot silently become an ordinary free-running Expression.
  assert.equal(expressionActivity({...args,stages:[],entries:[]}).state,'unavailable');
  assert.equal(expressionActivity({...args,activity_ref:undefined,stages:[],entries:[]}).state,'unbound');
});

// Mirrors `factory development run <state> <run> --json` (factory.run-reading/v1) field-for-field.
const runReading = () => ({
  contract: 'factory.run-reading/v1',
  provenance: { owner: 'factory', factoryStateRevision: 40, subjectRevision: 7, source: 'canonical Factory Run/RunMap + Factory Build correlations' },
  runRef: RUN, revision: 7, projectRef: 'project:TEST', owningJourneyRefs: ['journey:1'], routineInvocationRefs: [],
  lifecycle: 'running', destination: 'factory-expressions/test',
  runMap: { runRef: RUN, topologyRevision: 7, nodes: {
    destination: { id: 'destination', kind: 'destination', label: 'factory-expressions/test', state: null, semanticRef: null },
    'work-a': { id: 'work-a', kind: 'work', label: 'Conduct one act', state: 'returned', semanticRef: 'workflow-unit:A' },
  }, edges: [{ from: 'destination', to: 'work-a', relation: 'branches_to' }] },
  thoughtAvailable: false, thoughtRefs: [], agencies: [{ runRef: RUN, agencyRef: 'agency:a', agentRef: 'agent/g' }],
  executions: [{ runRef: RUN, executionRef: 'delivery/one', status: 'returned', agencyRef: 'agency:a', agentRef: 'agent/g', agentSessionRef: 'agent-session/s', sessionSpaceRef: 'session-space/s', surfaceRefs: [], workcellBindingRefs: [], nativeTrajectoryRef: '/home/someone/.aikit/state/session.jsonl' }],
  evidence: [], candidates: [], humanRequests: [],
  actions: [{ actionRef: 'action:REQUEST', label: 'Request more evidence', authorityOwner: 'factory', requiredCapabilityRef: 'capability/factory/request-evidence', currentlyApplicable: true }],
});

test('a fresh hosted producer row is live and carries the owner state, not the publication claim', () => {
  const reading = activityReading({ entry: entry('static'), liveness_rows: [row(NOW - 2_000)], now_ms: NOW, field_ref: FIELD });
  assert.equal(reading.liveness, 'live');
  assert.equal(reading.basis, 'hosted-producer');
  assert.equal(reading.owner_state, 'running');
  assert.equal(reading.owner_revision, 7);
  assert.equal(reading.observed_at, new Date(NOW - 60_000).toISOString());
  assert.equal(reading.heartbeat_age_ms, 2_000);
});

test('an old heartbeat degrades to stale', () => {
  const reading = activityReading({ entry: entry(), liveness_rows: [row(NOW - 45_000)], now_ms: NOW, stale_after_ms: 30_000 });
  assert.equal(reading.liveness, 'stale');
  assert.equal(reading.basis, 'hosted-producer');
});

test('a publication claim of live with no producer is disconnected, never live', () => {
  const reading = activityReading({ entry: entry('live'), liveness_rows: [], now_ms: NOW });
  assert.equal(reading.liveness, 'disconnected');
  assert.equal(reading.basis, 'publication');
  assert.equal(reading.owner_state, 'seeded');
  assert.equal(reading.owner_revision, 6);
  assert.equal(reading.observed_at, null);
});

test('a static publication with no producer stays static', () => {
  const reading = activityReading({ entry: entry('static'), now_ms: NOW });
  assert.equal(reading.liveness, 'static');
  assert.equal(reading.basis, 'publication');
});

test('rows for another activity or another field do not count', () => {
  const other = row(NOW, { activity_ref: `${WORLD}/run:OTHER` });
  const elsewhere = row(NOW, { field_ref: 'oi:field:elsewhere' });
  assert.equal(activityReading({ entry: entry(), liveness_rows: [other, elsewhere], now_ms: NOW, field_ref: FIELD }).liveness, 'disconnected');
});

test('activityReading refuses non-activity entries and missing clocks', () => {
  assert.throws(() => activityReading({ entry: { ...entry(), kind: 'node' }, now_ms: NOW }), /activity entry/);
  assert.throws(() => activityReading({ entry: entry() }), /now_ms/);
});

test('an edition freezes the run reading with its source basis and says it has no event list', () => {
  const edition = activityEdition({ entry: entry(), liveness_row: row(NOW), run_reading: runReading(), recorded_at: '2026-09-28T12:00:00.000Z' });
  assert.equal(edition.schema, ACTIVITY_EDITION_SCHEMA);
  assert.equal(edition.owner_state, 'running');
  assert.equal(edition.owner_revision, 7);
  assert.deepEqual(edition.basis, { source: 'factory.run-reading/v1', revision: 7, factory_state_revision: 40, owner: 'factory' });
  assert.equal(edition.events, null);
  assert.match(edition.events_note, /no event list/);
  assert.equal(edition.liveness_at_record.agrees_with_reading, true);
  assert.deepEqual(edition.scene.nodes.map((node) => [node.id, node.state]), [['destination', null], ['work-a', 'returned']]);
  assert.deepEqual(edition.executions, [{ execution_ref: 'delivery/one', status: 'returned', agency_ref: 'agency:a', agent_ref: 'agent/g' }]);
  assert.equal(edition.actions_recorded, false);
  const text = JSON.stringify(edition);
  assert.doesNotMatch(text, /\/home\/someone/, 'local trajectory paths never enter an edition');
  assert.doesNotMatch(text, /action:REQUEST|request-evidence/, 'effect affordances are never recorded');
});

test('an edition refuses a reading of a different run or contract', () => {
  assert.throws(() => activityEdition({ entry: entry(), run_reading: { ...runReading(), runRef: 'run:OTHER' }, recorded_at: '2026-09-28T12:00:00Z' }), /publishes run/);
  assert.throws(() => activityEdition({ entry: entry(), run_reading: { ...runReading(), contract: 'x' }, recorded_at: '2026-09-28T12:00:00Z' }), /Unsupported/);
});

test('replay yields the recorded sequence as render steps and never calls an effect runner', () => {
  const edition = activityEdition({ entry: entry(), run_reading: runReading(), recorded_at: '2026-09-28T12:00:00.000Z' });
  let effectCalls = 0;
  const effects = new Proxy(() => { effectCalls += 1; }, { get: () => { effectCalls += 1; return () => { effectCalls += 1; }; }, apply: () => { effectCalls += 1; } });
  const replay = replayActivity(edition, { effects, runTool: effects, invoke: effects });
  assert.equal(effectCalls, 0, 'replay touched the injected effect runner');
  assert.equal(replay.mode, 'replay');
  assert.equal(replay.live, false);
  assert.equal(replay.ordering, 'reading-order');
  assert.deepEqual(replay.steps.map((step) => step.kind), ['lifecycle', 'scene-node', 'scene-node', 'scene-edge', 'execution']);
  assert.ok(replay.steps.every((step) => step.effect === 'none'));
  assert.deepEqual(replay.basis, edition.basis);
  assert.ok(Object.isFrozen(replay.steps));
  // Replaying twice is the same frozen reading; nothing accumulates.
  assert.deepEqual(replayActivity(edition), replay);
});

test('replay refuses anything that is not an activity edition', () => {
  assert.throws(() => replayActivity({ schema: 'oi.activity/v1' }), /Unsupported activity edition/);
});

// Exact native owner captures already retained for consumer regressions.
// Verify their durable hashes before reading them; a missing capture fails.
const nativeFixtureRoot = new URL('../desktop/cradle/tests/fixtures/factory-native-owner-projections/', import.meta.url);
const nativeFixtureManifest = JSON.parse(readFileSync(new URL('manifest.json', nativeFixtureRoot), 'utf8'));
function nativeRun(name) {
  const basis = nativeFixtureManifest.fixtures[name];
  assert.ok(basis, `missing native capture declaration: ${name}`);
  const bytes = readFileSync(new URL(basis.file, nativeFixtureRoot));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), basis.sha256, `changed native capture: ${name}`);
  return JSON.parse(bytes);
}
function nativeEntry(run) {
  return { ref: `${WORLD}/${run.runRef}`, kind: 'activity', world_ref: WORLD, meta: { run_ref: run.runRef } };
}

test('native owner captures retain whole-work facts independently of lifecycle and closure', () => {
  assert.equal(nativeFixtureManifest.sourceNative, true);
  for (const name of Object.keys(nativeFixtureManifest.fixtures)) {
    const run = nativeRun(name), bytesBefore = JSON.stringify(run), native = run.nativeAttempts;
    const owner = factoryRunActivityState(run, run.runRef);
    const edition = activityEdition({ entry: nativeEntry(run), run_reading: run, recorded_at: '2026-10-05T04:03:00Z' });
    assert.equal(owner.owner_state, native.wholeRunState, name);
    assert.equal(owner.owner_revision, native.revision, name);
    assert.equal(edition.owner_state, native.wholeRunState, name);
    assert.equal(edition.owner_revision, run.provenance.factoryStateRevision, name);
    assert.equal(edition.lifecycle, run.lifecycle, name);
    assert.equal(edition.run_revision, run.revision, name);
    assert.equal(edition.native_attempts.completion_verified, native.completionVerified, name);
    assert.equal(edition.native_attempts.source_current, native.sourceCurrent, name);
    assert.deepEqual(edition.native_attempts.required_units, native.requiredUnits, name);
    assert.deepEqual(edition.native_attempts.current_returned_units, native.currentReturnedUnits, name);
    assert.equal(edition.native_attempts.workflow_source_digest, native.workflowSourceDigest, name);
    const replay = replayActivity(edition);
    assert.equal(replay.steps[0].owner_state, run.lifecycle, name);
    assert.equal(replay.steps[0].owner_revision, run.revision, name);
    assert.equal(replay.steps[1].kind, 'native-attempts', name);
    assert.equal(replay.steps[1].whole_run_state, native.wholeRunState, name);
    assert.equal(replay.steps[1].completion_verified, native.completionVerified, name);
    assert.ok(replay.steps.every(step => step.effect === 'none'), name);
    assert.equal(JSON.stringify(run), bytesBefore, 'pure projection changed native input');
  }
  const aborted = nativeRun('native-aborted-archived');
  assert.equal(aborted.lifecycle, 'archived');
  assert.equal(aborted.nativeAttempts.wholeRunState, 'complete');
  assert.equal(aborted.nativeAttempts.completionVerified, false);
  const passed = nativeRun('native-current-retry-passed');
  assert.equal(passed.nativeAttempts.wholeRunState, 'complete');
  assert.equal(passed.nativeAttempts.completionVerified, false);
});

test('same Run revision retains actual owner revision advances and refuses mixed native bases', () => {
  const earlier = nativeRun('native-current-retry-unknown'), later = nativeRun('native-current-retry-failed');
  assert.equal(earlier.runRef, later.runRef);
  assert.equal(earlier.revision, later.revision);
  const first = factoryRunActivityState(earlier), second = factoryRunActivityState(later);
  assert.ok(second.owner_revision > first.owner_revision, 'owner advance was reduced to unchanged Run revision');
  assert.equal(first.native_attempts.run_revision, second.native_attempts.run_revision);
  assert.throws(() => factoryRunActivityState({ ...later, nativeAttempts: earlier.nativeAttempts }), /provenance revisions disagree/);
  assert.throws(() => factoryRunActivityState(later, earlier.runRef + '-another'), /factory answered/);
  const edition = activityEdition({ entry: nativeEntry(later), run_reading: later, recorded_at: '2026-10-05T04:03:00Z', liveness_row: { owner_state: later.lifecycle, owner_revision: later.revision, heartbeat_at_micros: '1' } });
  assert.equal(edition.liveness_at_record.agrees_with_reading, false, 'lifecycle row concealed stale owner revision');
});

test('native edition replay preserves counts and never certifies or re-executes a historical result', () => {
  const run = nativeRun('native-current-retry-failed');
  const edition = activityEdition({ entry: nativeEntry(run), run_reading: run, recorded_at: '2026-10-05T04:03:00Z' });
  const editionBefore = JSON.stringify(edition);
  const replay = replayActivity(edition);
  assert.equal(replay.live, false);
  assert.equal(replay.steps[1].current_returned_unit_count, 0);
  assert.equal(replay.steps[1].required_unit_count, run.nativeAttempts.requiredUnits.length);
  assert.equal(replay.steps[1].completion_verified, false);
  replay.steps[1].required_units.push('workflow-unit:REPLAY-LOCAL');
  assert.equal(JSON.stringify(edition), editionBefore, 'replay retained mutable native unit arrays');
  assert.deepEqual(replayActivity(edition).steps[1].required_units, run.nativeAttempts.requiredUnits);
});

test('a native transport with another source or topology refuses instead of publishing a partial edition', () => {
  const run = nativeRun('native-current-retry-failed');
  for (const delta of [
    { runRef: run.runRef + '-other' },
    { runRevision: run.revision + 1 },
    { lifecycle: 'finished' },
    { topologyRevision: run.runMap.topologyRevision + 1 },
    { workflowSourceRef: '/home/private/source' },
    { workflowSourceDigest: '' },
    { currentReturnedUnits: [...run.nativeAttempts.requiredUnits, 'workflow-unit:ANOTHER'] },
  ]) {
    assert.throws(() => activityEdition({ entry: nativeEntry(run), run_reading: { ...run, nativeAttempts: { ...run.nativeAttempts, ...delta } }, recorded_at: '2026-10-05T04:03:00Z' }), TypeError);
  }
  const edition = activityEdition({ entry: nativeEntry(run), run_reading: run, recorded_at: '2026-10-05T04:03:00Z' });
  // Published replay data cannot replace the replay's effect/sequence markers.
  const altered = { ...edition, native_attempts: { ...edition.native_attempts, effect: 'invoke', index: 999, kind: 'tool' } };
  const replay = replayActivity(altered);
  assert.equal(replay.steps[1].kind, 'native-attempts');
  assert.equal(replay.steps[1].index, 1);
  assert.ok(replay.steps.every(step => step.effect === 'none'));
});
