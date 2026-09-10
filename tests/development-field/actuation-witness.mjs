// Native Actuation witness for one explicit deterministic fixture; not live-model P.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [owner, inputPath, outputPath] = process.argv.slice(2);
assert.ok(owner && inputPath && outputPath, 'owner, input and output paths are required');
const load = relative => import(pathToFileURL(resolve(owner, relative)).href);
const { executeCommand } = await load('cli/actuation.mjs');
const { AGENCY_CONTRACT_VERSION, validateReturn } = await load('contracts/agency.mjs');
const { AGENCY_ACTUALISATION_VERSION } = await load('contracts/agency-actualisation.mjs');
const { ACTUATION_STREAM_VERSION, appendActuationStreamEvent, closeActuationStream } = await load('contracts/actuation-stream.mjs');
const { activityFromActuationStream } = await load('contracts/activity.mjs');
const { REALISED_ACTUATION_VERSION, continuityDelta } = await load('contracts/realised-actuation.mjs');
const { requestCorrelationReadModel } = await load('contracts/request-correlation.mjs');
const input = JSON.parse(readFileSync(inputPath, 'utf8'));
const s = input.specimen;
assert.equal(s.standing, 'deterministic-fixture-not-human-acceptance');
const SCHEMA = AGENCY_CONTRACT_VERSION;
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
  schema: AGENCY_ACTUALISATION_VERSION, request_ref: 'actualisation-request:fixture', requester_ref: 'caller:fixture:conformance',
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
const call = (argv, body) => {
  const result = executeCommand([...argv, '-', '--json'], {stdin: JSON.stringify(body)});
  assert.equal(result.code, 0);
  return JSON.parse(result.stdout);
};
const agency = call(['agency', 'actualise'], request);
assert.equal(agency.agent_identity.agent_ref, s.agentRef);
assert.equal(agency.differentiated_binding.agency_ref, s.agencyRef);
assert.equal(agency.differentiated_binding.world_ref, input.centralSource.world_ref);
const noGrant = structuredClone(request); delete noGrant.metagency_grant;
assert.throws(() => call(['agency', 'actualise'], noGrant));

// Observe an actual deterministic child process in each prepared worktree. The
// provider body changes; semantic Agent, Agency, WorldBinding and actuation do not.
const processes = input.worktrees.map((cwd, index) => {
  const result = spawnSync(process.execPath, ['-e', "process.stdout.write(require('node:fs').readFileSync('implementation.txt','utf8'))"], {cwd, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'preserved\n');
  const workspace = input.material[index].binding_graph.bindings.find(b => b.logical_ref.startsWith('workspace:'));
  assert.ok(workspace?.material_ref && workspace?.provider_ref && workspace?.binding_ref);
  return {pid: result.pid, stdout: result.stdout, status: result.status, binding: workspace};
});
const realised = processes.map((result, i) => ({
  schema: REALISED_ACTUATION_VERSION, realised_ref: `realised:fixture:${i}`, actuation_ref: s.actuationRef,
  agent_ref: s.agentRef, agency_ref: s.agencyRef, world_binding_ref: binding.binding_ref,
  loop: {recurrence: 'turn-based', acting: true},
  body: {harness_ref: 'harness:deterministic-node-fixture', session_ref: `native-session:fixture:${i}`,
    process_ref: `process:fixture:${result.pid}`, material_binding_ref: result.binding.binding_ref},
  observation: {state: 'partial', evidence_refs: ['evidence:fixture:implementation-check']},
}));
const continuity = continuityDelta(realised[0], realised[1]);
for (const key of ['same_agent', 'same_agency', 'same_world_binding', 'same_actuation', 'material_binding_changed']) assert.equal(continuity[key], true, key);
let stream = {
  schema: ACTUATION_STREAM_VERSION, stream_ref: 'stream:fixture:implementation', actuation_ref: s.actuationRef,
  agency_ref: s.agencyRef, agent_session_ref: s.agentSessionRef, world_binding_ref: binding.binding_ref,
  lifecycle: {state: 'open', started_at: '2026-01-01T00:00:00Z'}, cursor: {last_sequence: 0, next_sequence: 1}, events: [],
};
const traceRef = `trace:fixture:${createHash('sha256').update(JSON.stringify(processes)).digest('hex')}`;
stream = appendActuationStreamEvent(stream, {event_ref: 'event:fixture:implementation', sequence: 1, kind: 'tool-result',
  observed_at: '2026-01-01T00:00:01Z', actor: {agent_ref: s.agentRef, agency_ref: s.agencyRef},
  native_trace_ref: traceRef, resource_refs: ['result:fixture:implementation']});
stream = closeActuationStream(stream, {state: 'closed', endedAt: '2026-01-01T00:00:02Z'});
const activity = activityFromActuationStream(stream, {
  activityRef: s.activityRef, subjectRef: s.fieldRef, nativeOwner: 'actuation', verb: 'verified', object: 'deterministic fixture implementation',
  summary: 'A fixture Agency observed the same implementation across two actual temporary local Workcell roots.',
  actionRef: 'action:fixture:implementation', invocationRef: 'invocation:fixture:implementation', planRef: input.field.targets.planRef,
  journeyRef: input.field.journeyRef, runRef: input.field.runRef, resultRef: 'result:fixture:implementation',
  evidenceRefs: ['evidence:fixture:implementation-check'], returnRef: s.returnRef,
});
assert.deepEqual(call(['activity'], activity), activity);
assert.equal(activity.run_ref, s.runRef);
assert.notEqual(activity.run_ref, activity.agent_session_ref);
assert.notEqual(activity.run_ref, activity.actuation_ref);
const returned = validateReturn({
  schema: SCHEMA, return_ref: s.returnRef, determination_ref: request.determination.determination_ref,
  from_agency_ref: s.agencyRef, to_agency_ref: governing.agency_ref, difference_refs: ['difference:fixture:implementation'],
  artifact_refs: ['artifact:fixture:implementation'], evidence_refs: ['evidence:fixture:implementation-check'],
  provenance: {agency_lineage_refs: [governing.agency_ref, s.agencyRef], agent_refs: [s.agentRef],
    world_binding_refs: [binding.binding_ref], authority_refs: binding.authority_refs, bounds_refs: binding.bounds_refs,
    activity_refs: [activity.activity_ref], actuation_refs: [s.actuationRef], result_refs: ['result:fixture:implementation'],
    agent_session_refs: [s.agentSessionRef], action_refs: ['action:fixture:implementation'], invocation_refs: ['invocation:fixture:implementation'],
    plan_refs: [activity.plan_ref], journey_refs: [activity.journey_ref], run_refs: [activity.run_ref],
    provider_refs: processes.map(p => p.binding.provider_ref), harness_refs: ['harness:deterministic-node-fixture'],
    material_refs: processes.map(p => p.binding.material_ref), external_source_refs: [input.centralSource.source.ref, input.centralSource.revision.revision, input.resolutionRef]},
  received: true, recognition_state: 'pending', world_mutation_state: 'not-applied',
});
const read = call(['agency'], {binding: governing, returns: [returned]});
assert.deepEqual(read.returns.records[0], returned);
assert.equal(returned.recognition_state, 'pending');
assert.equal(returned.world_mutation_state, 'not-applied');
const direct = activityFromActuationStream(stream, {activityRef: 'activity:fixture:direct', subjectRef: 'subject:fixture:direct',
  nativeOwner: 'actuation', verb: 'observed', object: 'direct fixture', summary: 'Direct agency remains valid without Factory ancestry.', resultRef: 'result:fixture:direct'});
assert.equal(direct.run_ref, undefined); assert.equal(direct.journey_ref, undefined); assert.equal(direct.plan_ref, undefined);
const unknown = requestCorrelationReadModel('request:fixture:not-observed', {authority_decisions: [], activities: [], streams: []});
assert.equal(unknown.state, 'unknown-identity'); assert.equal(unknown.authority.resolution, 'none');
const output = {schema: 'oi.development-field-actuation-witness/v1', standing: s.standing, agency, activity, returned,
  stream, realised, continuity, processes, unknown_request: unknown, direct_without_factory: direct};
assert.deepEqual(JSON.parse(JSON.stringify(output)), output);
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.log('Native Actuation fixture Agency/Activity/Return and material relocation verified; no live-model or human acceptance claim.');
