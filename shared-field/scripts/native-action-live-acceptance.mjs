#!/usr/bin/env node
/**
 * One real native Action from an authored Explore binding, through its owner.
 *
 *   addressable shared object (the projected WikiNode)
 *     → canonical Action binding on the WorldPresentation (props.action_refs)
 *     → owner authority check (Central's own doorway, `ctrl`)
 *     → native owner operation (projectcentral.now.return writes the project's NOW field)
 *     → Result / Evidence / changed state (the record exists in projectcentral.now.inspect)
 *     → attributable Return (oi.activity/v1 carrying the canonical action_ref)
 *
 * Then the two Return authorities are kept distinct: the recorded note is
 * promoted to the Agent-maintained wiki with `acceptance: agent-return`, and
 * the same promotion toward human-authored ground with agent acceptance is
 * refused by the owner. Negative cases: an Action the binding does not
 * disclose is never invoked; an owner refusal is returned, not retried.
 *
 *   node shared-field/scripts/native-action-live-acceptance.mjs --bundle out/bundle.json --project O-I --central ~/Central [--actor participant:central:owner] [--receipt out/native-action-receipt.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveBoundAction, invokeBoundAction, nativeCommandExecutor } from '../native-action-binding.mjs';
import { worldPresentationFromProjection } from '../presentation-projection.mjs';
import { applyPresentationAuthoringOperation, normalizeContributionField } from '../presentation-authoring.mjs';
import { validateActivity } from '../activity.mjs';
import assert from 'node:assert/strict';

const argv = process.argv.slice(2);
const flag = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; };
const bundle = JSON.parse(readFileSync(flag('--bundle'), 'utf8'));
const project = flag('--project') ?? bundle.readings.find((reading) => reading.register === 'project')?.world_ref?.replace(/^project:/, '');
const central = flag('--central') ?? process.env.CENTRAL_HOME;
const actor = flag('--actor') ?? bundle.participant.participant_ref;
const executor = nativeCommandExecutor({ cwd: central });
const ACTION = 'central:action:projectcentral.now.return';
const PROMOTE = 'central:action:projectcentral.now.promote';

/* 1. Author the binding on the projected page: the contribution field discloses the Action; the binding carries it. */
const presentation = worldPresentationFromProjection(bundle.projection);
const nodeEntry = bundle.entries.find((entry) => entry.kind === 'wiki-node');
const field = normalizeContributionField([{
  contribution_ref: 'contribution:central:now-return', component_ref: 'oi.presentation/action/v1', portable_renderer: 'oi.presentation/action/v1',
  label: 'Return to the project field', action_refs: [ACTION, PROMOTE], default_props: { title: 'Return to the project field', action_refs: [ACTION, PROMOTE] }, fallback: { title: 'Return' },
  provenance: [{ kind: 'aikit-contribution', ref: 'contribution:central:now-return', source_system: 'aikit' }],
}]);
const authored = applyPresentationAuthoringOperation(presentation, { schema: 'oi.presentation-authoring-operation/v1', type: 'insert-contribution', region_ref: 'nodes', contribution_ref: 'contribution:central:now-return', binding_ref: 'action:now-return', props: { subject_ref: nodeEntry.ref } }, field);
const bindingRef = authored.regions.find((region) => region.region_ref === 'nodes').bindings.find((binding) => binding.contribution_ref === 'contribution:central:now-return').binding_ref;

/* 2. Negative: an Action the binding does not disclose is never invoked. */
let spawned = 0;
const counting = async (command, args) => { spawned += 1; return executor(command, args); };
const undisclosed = resolveBoundAction(authored, bindingRef, 'central:action:central.day.lifecycle');
assert.equal(undisclosed.bound, false);
await assert.rejects(() => invokeBoundAction(undisclosed, {}, { executor: counting }), /not bound/);
assert.equal(spawned, 0, 'an undisclosed Action must not reach the owner');

/* 3. The real Action through the owner's doorway. */
const bound = resolveBoundAction(authored, bindingRef, ACTION);
assert.equal(bound.bound, true);
const RUN = Date.now().toString(36);
const subject = `SharedField live acceptance ${RUN}: ${bundle.projection.projection_ref}@${bundle.projection.projection_revision}`;
const input = {
  project, actor, kind: 'note', status: 'active',
  subject,
  result: `An authored Explore binding on ${nodeEntry.ref} invoked ${ACTION} through Central's own doorway. Projection ${bundle.projection.projection_ref} revision ${bundle.projection.projection_revision} of source ${bundle.source.ref} (${bundle.source.revision}) is live in the shared field; this record is the attributable Return of that operation into the project's NOW field. The Projection is a representation; this note changes no source.`,
  source_refs: [bundle.source.ref],
  evidence_refs: [`${bundle.projection.projection_ref}@${bundle.projection.projection_revision}`],
};
const returned = await invokeBoundAction(bound, input, {
  executor: counting, cwd: central, actor_ref: actor, subject_kind: 'central-world',
  result_refs_from: (data) => [data?.source, data?.handoff?.id ?? data?.record?.id ?? data?.id].filter(Boolean).map(String),
  evidence_refs: input.evidence_refs, provenance: [{ kind: 'projection', ref: bundle.projection.projection_ref, source_system: 'o-i', revision: String(bundle.projection.projection_revision) }],
});
assert.equal(spawned, 1);
if (!returned.ok) {
  console.error(JSON.stringify({ ok: false, stage: 'now.return', envelope: returned.envelope, run: returned.run, activity: returned.activity }, null, 2));
  process.exit(2);
}
const activity = validateActivity(returned.activity);
assert.equal(activity.action_ref, ACTION);
assert.equal(activity.phase, 'completed');

/* 4. Changed state through the owner's own reading. */
const inspect = await executor('ctrl', ['--json', 'action', 'run', 'projectcentral.now.inspect', JSON.stringify({ project })]);
const inspected = JSON.parse(inspect.stdout);
const recordId = returned.envelope.data?.handoff?.id ?? returned.envelope.data?.record?.id ?? returned.envelope.data?.id;
const items = [...(inspected.data?.active_items ?? [])];
const record = items.find((item) => item.id === recordId || item.subject === subject);
assert.ok(record, `the returned record must be visible through projectcentral.now.inspect (looked for ${recordId ?? subject})`);
assert.equal(record.actor, actor, 'the record is attributed to the invoking Participant');

/* 5. Return authorities stay distinct: agent-return to the Agent wiki is accepted; agent acceptance toward human ground is refused. */
const promoteBound = resolveBoundAction(authored, bindingRef, PROMOTE);
assert.equal(promoteBound.bound, true);
const recordSource = returned.envelope.data?.source ?? `ProjectCentral/now/agents/${record.id}.json`;
const wikiReturn = await invokeBoundAction(promoteBound, { project, source: recordSource, target: 'agent-wiki', destination: `${record.id}.json`, acceptance: 'agent-return' }, { executor, cwd: central, actor_ref: actor, result_refs_from: (data) => Object.values(data ?? {}).filter((value) => typeof value === 'string').slice(0, 3) });
assert.equal(wikiReturn.ok, true, `agent-return into the Agent-maintained wiki must be accepted by the owner: ${JSON.stringify(wikiReturn.envelope)}`);
const humanGroundAttempt = await invokeBoundAction(promoteBound, { project, source: recordSource, target: 'human-ground', destination: `${record.id}.md`, acceptance: 'agent-return' }, { executor, cwd: central, actor_ref: actor });
assert.equal(humanGroundAttempt.ok, false, 'an agent cannot accept its own material into human-authored ground');
assert.equal(humanGroundAttempt.activity.phase, 'failed');

const receipt = {
  acceptance: 'oi-native-action-return',
  action_ref: ACTION,
  bound: { binding_ref: bound.binding_ref, region_ref: bound.region_ref, subject_ref: bound.subject_ref, handler: bound.handler },
  owner_envelope: returned.envelope,
  activity,
  changed_state: { record_id: record.id, kind: record.kind, actor: record.actor, subject: record.subject, provenance: record.provenance, now_paths: inspected.data?.paths ?? null },
  wiki_return: { ok: wikiReturn.ok, envelope: wikiReturn.envelope, activity_phase: wikiReturn.activity.phase },
  human_ground_refused: { ok: humanGroundAttempt.ok, outcome: humanGroundAttempt.activity.outcome },
  negative_cases: ['undisclosed Action never reached the owner', 'agent acceptance into human-authored ground refused by owner'],
};
const receiptPath = flag('--receipt');
if (receiptPath) writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
