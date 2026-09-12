// The joined-specimen Actuation witness. Every product operation is a served
// `actuation` executable process; Node is only this specimen's harness runtime
// (there are no in-process Actuation modules to import since the R7 cutover).
// Deterministic fixture; no live-model, human Recognition or deployment claim.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

const [owner, inputPath, outputPath] = process.argv.slice(2);
assert.ok(owner && inputPath && outputPath);
// The conformance gate builds the pinned owner cut before the probe runs
// (`cargo build --package actuation-cli --bin actuation`); ACTUATION_BIN may
// override for direct runs.
const bin = process.env.ACTUATION_BIN ?? join(owner, 'target', 'debug', 'actuation');
assert.ok(existsSync(bin), `served actuation executable not found at ${bin}; build the owner descriptor first`);

const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const s = input.specimen;
assert.equal(s.standing, 'deterministic-fixture-not-human-acceptance');

// One served process per operation: the JSON body travels on stdin via the
// `-` input marker; a refusal is a non-zero exit with a stated reason.
const served = (argv, body) => {
  const run = spawnSync(bin, [...argv, '-', '--json'],
    body === undefined ? {} : { input: JSON.stringify(body), encoding: 'utf8' });
  assert.equal(run.status, 0, `actuation ${argv.join(' ')} refused: ${run.stderr}`);
  return JSON.parse(run.stdout);
};
const refusal = (argv, body) => {
  const run = spawnSync(bin, [...argv, '-', '--json'], { input: JSON.stringify(body), encoding: 'utf8' });
  assert.notEqual(run.status, 0, `actuation ${argv.join(' ')} should have refused`);
  assert.ok(run.stderr.trim().length > 0, 'a refusal must state its reason');
  return run;
};

const version = spawnSync(bin, ['--version'], { encoding: 'utf8' });
assert.equal(version.status, 0, version.stderr);
const versionLine = version.stdout.trim();
assert.match(versionLine, /^actuation \d+\.\d+\.\d+$/, 'the served binary must disclose its product version');
const disclosure = served(['system']);
assert.equal(disclosure.product_id, 'actuation');

// The agency/actualisation wire contracts are v1 and unchanged by the
// implementation-language migration; the served binary is the validator now.
const SCHEMA = 'actuation.agency/v1';
const governing = {
  schema: SCHEMA, binding_ref: 'world-binding:fixture:governing', agent_ref: 'agent:fixture:governing',
  agency_ref: 'agency:fixture:governing', world_ref: input.centralSource.world_ref,
  scope_ref: 'scope:fixture:project', bounds_refs: ['bound:fixture:worktree'],
  authority_refs: ['authority:fixture:metagency', 'authority:fixture:implementation'],
  return_relation_ref: 'return-relation:fixture:governing',
};
const binding = {
  schema: SCHEMA, binding_ref: 'world-binding:fixture:developer', agent_ref: s.agentRef,
  agency_ref: s.agencyRef, world_ref: input.centralSource.world_ref, scope_ref: 'scope:fixture:worktree',
  determining_agency_ref: governing.agency_ref, bounds_refs: ['bound:fixture:worktree'],
  authority_refs: ['authority:fixture:implementation'], return_relation_ref: 'return-relation:fixture:developer',
  continuity_ref: 'continuity:fixture:developer',
};
const request = {
  schema: 'actuation.agency-actualisation/v1', request_ref: 'actualisation-request:fixture',
  requester_ref: 'caller:fixture:conformance',
  governing_binding: governing,
  metagency_grant: {schema: SCHEMA, grant_ref: 'grant:fixture:development', agency_ref: governing.agency_ref,
    world_binding_ref: governing.binding_ref, authority_ref: 'authority:fixture:metagency',
    bounds_refs: ['bound:fixture:worktree'], operations: ['determine-agency', 'actualise-agency']},
  determination: {schema: SCHEMA, determination_ref: 'determination:fixture:developer', kind: 'delegation',
    determining_agency_ref: governing.agency_ref, differentiated_agency_ref: s.agencyRef, world_binding_ref: binding.binding_ref,
    bounds_refs: binding.bounds_refs, authority_refs: binding.authority_refs,
    delegated_autonomy: {allowed_action_refs: ['action:fixture:implementation'], denied_action_refs: ['action:source-mutation'], may_determine_within_bounds: false},
    return_policy: {mode: 'required', return_relation_ref: binding.return_relation_ref}},
  differentiated_binding: binding,
  agent_identity: {standing: 'existing', evidence_refs: ['fixture:specimen:agentRef']},
  provenance: {source_refs: [input.centralSource.source.ref], context_refs: [input.resolutionRef]},
};
const agency = served(['agency', 'actualise'], request);
assert.equal(agency.agent_identity.agent_ref, s.agentRef);
assert.equal(agency.differentiated_binding.agency_ref, s.agencyRef);
assert.equal(agency.differentiated_binding.world_ref, input.centralSource.world_ref);
// Downward authority requires upward reality: without the metagency grant the
// served product refuses the actualisation instead of minting an agency.
const noGrant = structuredClone(request); delete noGrant.metagency_grant;
refusal(['agency', 'actualise'], noGrant);

// Material relocation: an actual served process runs in each workcell-prepared
// workspace, and the implemented artifact survives the move byte-exactly.
const processes = input.worktrees.map((cwd, index) => {
  const body = spawnSync(bin, ['harness', 'detect', '--json'], { cwd, encoding: 'utf8' });
  assert.equal(body.status, 0, body.stderr);
  assert.equal(readFileSync(resolve(cwd, 'implementation.txt'), 'utf8'), 'preserved\n');
  const workspace = input.material[index].binding_graph.bindings.find(b => b.logical_ref.startsWith('workspace:'));
  assert.ok(workspace?.material_ref && workspace?.provider_ref && workspace?.binding_ref);
  return {pid: body.pid, stdout: body.stdout, status: body.status, binding: workspace};
});

// Realised receipts and their continuity delta are computed here in the
// witness; the served `realised` read validates each receipt's wire form.
const realised = processes.map((result, i) => ({
  schema: 'actuation.realised/v1', realised_ref: `realised:fixture:${i}`, actuation_ref: s.actuationRef,
  agent_ref: s.agentRef, agency_ref: s.agencyRef, world_binding_ref: binding.binding_ref,
  loop: {recurrence: 'turn-based', acting: true},
  body: {harness_ref: 'harness:served-native-executable', session_ref: `native-session:fixture:${i}`,
    process_ref: `process:fixture:${result.pid}`, material_binding_ref: result.binding.binding_ref},
  observation: {state: 'partial', evidence_refs: ['evidence:fixture:implementation-check']},
}));
for (const receipt of realised) served(['realised'], receipt);
const continuity = {
  same_agent: realised[0].agent_ref === realised[1].agent_ref,
  same_agency: realised[0].agency_ref === realised[1].agency_ref,
  same_world_binding: realised[0].world_binding_ref === realised[1].world_binding_ref,
  same_actuation: realised[0].actuation_ref === realised[1].actuation_ref,
  material_binding_changed: realised[0].body.material_binding_ref !== realised[1].body.material_binding_ref,
};
for (const key of ['same_agent', 'same_agency', 'same_world_binding', 'same_actuation', 'material_binding_changed']) {
  assert.equal(continuity[key], true, key);
}

// Durable stream: open, record a declared harness boundary, replay and close
// through separate served processes against one temporary store — actual
// filesystem persistence, not an in-process object.
const store = mkdtempSync(join(tmpdir(), 'actuation-witness-store-'));
const opening = {
  stream_ref: 'stream:fixture:implementation', actuation_ref: s.actuationRef,
  agency_ref: s.agencyRef, agent_session_ref: s.agentSessionRef,
  world_binding_ref: binding.binding_ref,
  provenance: ['source:fixture:development-field'],
  started_at: '2026-01-01T00:00:00Z',
};
const stream = served(['stream', 'open', '--store', store], opening);
assert.equal(stream.lifecycle.state, 'open');
const traceRef = `trace:fixture:${createHash('sha256').update(JSON.stringify(processes)).digest('hex')}`;
const receipt = served(['stream', 'record', '--store', store], {
  stream_ref: opening.stream_ref,
  harness: 'claude-code', native_event: 'SessionStart',
  event_ref: 'event:fixture:implementation',
  observed_at: '2026-01-01T00:00:01Z',
  native_trace_ref: traceRef,
});
assert.equal(receipt.event.sequence, 1);
const replay = served(['stream', 'replay', '--store', store, opening.stream_ref]);
assert.equal(replay.events.length, 1);
assert.equal(replay.events[0].event_ref, 'event:fixture:implementation');
// Observation never manufactures identity: a recorded harness boundary keeps
// its declared metadata and no fabricated actor.
assert.equal(replay.events[0].actor, undefined);
const closed = served(['stream', 'close', '--store', store, opening.stream_ref,
  '--state', 'closed', '--ended-at', '2026-01-01T00:00:02Z']);
assert.equal(closed.lifecycle.state, 'closed');
const afterClose = served(['stream', 'replay', '--store', store, opening.stream_ref]);
assert.deepEqual(afterClose.events, replay.events);

// Activity is assembled in the witness from the closed stream's actual facts,
// then validated by the served read model in both directions.
const activity = {
  schema: 'actuation.activity/v1', activity_ref: s.activityRef,
  actor: {agent_ref: s.agentRef, agency_ref: s.agencyRef},
  agent_session_ref: s.agentSessionRef,
  plan_ref: input.field.targets.planRef, journey_ref: input.field.journeyRef, run_ref: input.field.runRef,
  subject_ref: s.fieldRef, native_owner: 'actuation',
  action_ref: 'action:fixture:implementation', invocation_ref: 'invocation:fixture:implementation',
  actuation_ref: s.actuationRef, result_ref: 'result:fixture:implementation',
  evidence_refs: ['evidence:fixture:implementation-check'], return_ref: s.returnRef,
  verb: 'verified', object: 'deterministic fixture implementation',
  summary: 'A served native Actuation binary observed the same implementation across two workcell-prepared material roots.',
  phase: 'completed', outcome: 'succeeded', salience: 'normal', needs_attention: false,
  trace: {stream_ref: opening.stream_ref, event_refs: [receipt.event.event_ref],
    native_trace_refs: [traceRef], from_sequence: receipt.event.sequence, through_sequence: receipt.event.sequence},
  started_at: opening.started_at, updated_at: '2026-01-01T00:00:01Z', completed_at: '2026-01-01T00:00:02Z',
};
assert.deepEqual(served(['activity'], activity), activity);
assert.equal(activity.run_ref, s.runRef);
assert.notEqual(activity.run_ref, activity.agent_session_ref);
assert.notEqual(activity.run_ref, activity.actuation_ref);

// Returned difference precedes synthesis: the Return is attributable to the
// governing relation, recognition stays pending and the World is not mutated
// by return admission. The served `agency` read is the validator.
const returned = {
  schema: SCHEMA, return_ref: s.returnRef, determination_ref: request.determination.determination_ref,
  from_agency_ref: s.agencyRef, to_agency_ref: governing.agency_ref, difference_refs: ['difference:fixture:implementation'],
  artifact_refs: ['artifact:fixture:implementation'], evidence_refs: ['evidence:fixture:implementation-check'],
  provenance: {agency_lineage_refs: [governing.agency_ref, s.agencyRef], agent_refs: [s.agentRef],
    world_binding_refs: [binding.binding_ref], authority_refs: binding.authority_refs, bounds_refs: binding.bounds_refs,
    activity_refs: [activity.activity_ref], actuation_refs: [s.actuationRef], result_refs: ['result:fixture:implementation'],
    agent_session_refs: [s.agentSessionRef], action_refs: ['action:fixture:implementation'], invocation_refs: ['invocation:fixture:implementation'],
    plan_refs: [activity.plan_ref], journey_refs: [activity.journey_ref], run_refs: [activity.run_ref],
    provider_refs: processes.map(p => p.binding.provider_ref), harness_refs: ['harness:served-native-executable'],
    material_refs: processes.map(p => p.binding.material_ref),
    external_source_refs: [input.centralSource.source.ref, input.centralSource.revision.revision, input.resolutionRef]},
  received: true, recognition_state: 'pending', world_mutation_state: 'not-applied',
};
const read = served(['agency'], {binding: governing, returns: [returned]});
assert.deepEqual(read.returns.records[0], returned);
assert.equal(returned.recognition_state, 'pending');
assert.equal(returned.world_mutation_state, 'not-applied');

// Direct agency remains valid with zero Factory ancestry: no plan, journey or
// run ref may be inferred when none was supplied.
const direct = {
  schema: 'actuation.activity/v1', activity_ref: 'activity:fixture:direct',
  actor: {agent_ref: s.agentRef, agency_ref: s.agencyRef},
  agent_session_ref: s.agentSessionRef,
  subject_ref: 'subject:fixture:direct', native_owner: 'actuation',
  actuation_ref: s.actuationRef,
  verb: 'observed', object: 'direct fixture',
  summary: 'Direct agency remains valid without Factory ancestry.',
  phase: 'completed', outcome: 'succeeded', salience: 'normal', needs_attention: false,
  trace: {stream_ref: opening.stream_ref, event_refs: [receipt.event.event_ref],
    native_trace_refs: [traceRef], from_sequence: receipt.event.sequence, through_sequence: receipt.event.sequence},
  started_at: opening.started_at, updated_at: '2026-01-01T00:00:01Z', completed_at: '2026-01-01T00:00:02Z',
};
assert.deepEqual(served(['activity'], direct), direct);
assert.equal(direct.run_ref, undefined);
assert.equal(direct.journey_ref, undefined);
assert.equal(direct.plan_ref, undefined);

const output = {schema: 'oi.development-field-actuation-witness/v1', standing: s.standing,
  served: {executable: bin, version: versionLine}, agency, activity, returned,
  stream: closed, replay, realised, continuity, processes, direct_without_factory: direct};
// JSON has no undefined value. Compare the native wire form, not optional
// JavaScript host-object properties that are intentionally omitted on the wire.
const encoded = JSON.stringify(output);
const decoded = JSON.parse(encoded);
assert.equal(JSON.stringify(decoded), encoded);
assert.deepEqual(served(['activity'], decoded.activity), activity);
assert.deepEqual(served(['agency'], {binding: governing, returns: [decoded.returned]}).returns.records[0], returned);
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log('Served native Actuation fixture Agency/Activity/Return and material relocation verified; no live-model or human acceptance claim.');
