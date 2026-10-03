/**
 * The O:I-owned SharedField client entry the desktop kernel calls.
 *
 *   printf '{"kind":"snapshot"}' | OI_SHARED_FIELD_TARGET=frank shared-field/spacetimedb/field.sh
 *
 * One request on stdin, one envelope on stdout (`{ok:true,data}` or
 * `{ok:false,error:{kind,message}}`). The hosting target comes from
 * `hosting.json` through `OI_SHARED_FIELD_TARGET`; the owner transport token
 * stays under `OI_STATE_HOME` and never appears in any envelope. The renderer
 * never reaches this program: the kernel does, on the desktop's own account.
 *
 * Requests:
 *   status                              target binding only; no network
 *   bind      {target}                  bind this machine's SharedField target (non-secret; no network)
 *   unbind                              clear this machine's binding
 *   identity                            the caller's transport identity only
 *   snapshot                            the caller-visible field
 *   identity                            the caller's transport identity only
 *   receipt   {contribution_ref}         caller's private Contribution receipt
 *   read      {ref}                     one hosted ref as a Projection reading
 *   publish   {args}                    hosted reducer args (hostedPublicationArgs shape), pushed in order
 *   participant {participant, target_identity, role, contactable}   register a Participant contract and bind an identity
 *   contribute  {contribution, transport_message_id} submit one attributable difference to quarantine
 *   admit     {ingress_ref, reason, evidence, index, entry?, relation?}  admit a quarantined Contribution under the caller's authority
 *   reject    {ingress_ref, reason, evidence} reject a quarantined Contribution under the caller's authority
 *   withdraw  {ingress_ref, reason, evidence} withdraw an admitted Contribution under owner/admission authority
 *   contact   {contact_ref, recipient_participant_ref, decision, response}   respond to a Contact request
 *   watch     {watch}                   put one oi.watch/v1 contract under the caller's own authority
 *   enter     {field_ref, participant_ref, state?}       announce the caller's live presence in a field
 *   leave     {field_ref, participant_ref}               clear the caller's live presence (and any stage follow)
 *   stage     {field_ref}               the field's open Shared Stage, the caller's follow row, live presence
 *   stage-open    {stage}               open a Shared Stage from an `oi.shared-stage/v1` revision-1 contract
 *   stage-advance {stage, expected_revision}   advance the stage one revision-checked step
 *   stage-close   {stage, expected_revision, actor_participant_ref?}   close the open stage
 *   stage-follow  {field_ref, stage_ref, follower_participant_ref}      follow the open stage now
 *   stage-unfollow {field_ref, stage_ref, follower_participant_ref}     unfollow and keep a local view
 *   field-now     {field_ref}           the field's collective FieldNow (or null) as the caller may read it
 *   field-now-put {field_now, expected_revision, actor_participant_ref?}  project one revision-checked `oi.field-now/v1` step ('' / absent actor = field owner)
 *   field-day     {field_ref}           the field's FieldDay intervals as the caller may read them
 *   field-day-put {field_day, expected_revision?, actor_participant_ref?} project one revision-checked `oi.field-day/v1` step
 *   activity-liveness-put   {field_ref, activity_ref, owner_state, owner_revision, producer_participant_ref?}
 *                                        one liveness beat for a published activity entry; the row is bound to THIS
 *                                        connection, so a one-shot put is cleared again when field.sh exits —
 *                                        a standing producer is scripts/activity-producer.mjs
 *   activity-liveness-clear {field_ref, activity_ref}   clear a liveness row (producer identity or field owner)
 *   grant-read    {field_ref, participant_ref}   owner: admit a persistently-authorised Participant to read a PRIVATE field
 *   revoke-read   {field_ref, participant_ref}   owner: withdraw that read admission
 *   tuple-keys-reconcile {field_ref}   owner: atomically reconcile retained literal tuple keys
 */
import { activityLivenessRow, bindingFile, close, fieldDayReading, fieldNowReading, fieldSnapshot, hostingTargets, open, publishArgs, readRef, resolveTarget, rows, stageReading, stageView, waitUntil, observeField } from './field-lib';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SenderError } from 'spacetimedb';
import { createProjection } from '../index.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';
import {createNaraPresenceConsent,projectNaraExpression,hostedNaraExpressionArgs,validateCanonicalNaraCues} from '../nara-expression-projection.mjs';

// stdout carries exactly one envelope; the SDK's own console chatter goes to stderr.
for (const level of ['log', 'info', 'warn', 'debug', 'error'] as const) console[level] = (...parts: unknown[]) => { process.stderr.write(`${parts.map(String).join(' ')}\n`); };

type Envelope = { ok: true; data: unknown } | { ok: false; error: { kind: 'unbound' | 'unavailable' | 'refused' | 'malformed' | 'outcome_unknown'; message: string; operation?: string; completion_observation?: {completed_reducers: number; pending_reducers: number; receipt_lost: boolean; last_reducer?: string} } };

/** Called only after the generated SDK reducer resolves successfully. That
 * completion grants no read rights: material comes from one actual current
 * authorized row, while a withheld/ambiguous read returns completion alone. */
function observeCompletedReducer<T>(reducer: 'enter_field' | 'put_activity_liveness', target: Record<string, string>, lookup: () => T[], material: (row: T) => unknown): unknown {
  let observation: {state: 'unavailable'; basis: string; detail?: string};
  try {
    const matching = lookup();
    if (matching.length === 1) return material(matching[0]);
    observation = {state: 'unavailable', basis: matching.length ? 'ambiguous-authorized-rows' : 'no-matching-authorized-row'};
  } catch (cause) {
    observation = {state: 'unavailable', basis: 'authorized-read-failed', detail: String(cause instanceof Error ? cause.message : cause)};
  }
  return {schema: 'oi.shared-field.reducer-completion/v1', completion: {state: 'completed', reducer, basis: 'sdk-reducer-success'}, target, observation, connection_scoped: true};
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += (chunk as Buffer).byteLength;
    if (bytes > 16 * 1024 * 1024) await emit({ok: false, error: {
      kind: 'malformed', message: 'SharedField input exceeds the 16 MiB native request budget',
    }});
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function emit(envelope: Envelope): Promise<never> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(envelope)}\n`, error => error ? reject(error) : resolve());
  });
  process.exit(envelope.ok ? 0 : 1);
}

/** Native host lease: keep the entered connection itself alive. Losing the
 * host, transport or explicit lease ends presence; no effect is replayed. */
async function holdPresence(data: unknown): Promise<never> {
  await new Promise<void>((resolve, reject) => process.stdout.write(`${JSON.stringify({ok: true, data})}\n`, (error) => error ? reject(error) : resolve()));
  const parent = process.ppid;
  const end = () => { if (client) close(client); process.exit(0); };
  process.once('SIGTERM', end); process.once('SIGINT', end);
  client!.lifecycle.subscribe((event: any) => { if (event.transport.state === 'offline') end(); });
  setInterval(() => { if (process.ppid !== parent) end(); }, 1000);
  return await new Promise<never>(() => {});
}

const raw = (await readStdin()).trim();
let request: any;
try { request = raw ? JSON.parse(raw) : { kind: 'status' }; } catch (error: any) { await emit({ ok: false, error: { kind: 'malformed', message: `request is not JSON: ${error.message}` } }); }
if (!request || typeof request !== 'object' || typeof request.kind !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'request must be an object with a string `kind`' } });

if (request.kind === 'bind') {
  const targets = hostingTargets();
  if (typeof request.target !== 'string' || !targets[request.target]) await emit({ ok: false, error: { kind: 'malformed', message: `bind requires a \`target\` named in hosting.json (${Object.keys(targets).join(', ')})` } });
  const file = bindingFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ schema: 'oi.shared-field-binding/v1', target: request.target, bound_at: new Date().toISOString() }, null, 2)}\n`);
}
if (request.kind === 'unbind') {
  rmSync(bindingFile(), { force: true });
}
const binding = resolveTarget();
if (request.kind === 'status' || request.kind === 'bind' || request.kind === 'unbind') {
  await emit({ ok: true, data: binding.bound ? { schema: 'oi.shared-field.status/v1', bound: true, binding_source: binding.source, binding_file: bindingFile(), target: { name: binding.target.name, uri: binding.target.uri, database: binding.target.database } } : { schema: 'oi.shared-field.status/v1', bound: false, binding_file: bindingFile(), reason: binding.reason } });
}
const target = binding.bound ? binding.target : await emit({ ok: false, error: { kind: 'unbound', message: binding.reason } });

const configuredLabel = process.env.OI_SHARED_FIELD_TOKEN_LABEL;
const label = typeof request.token_label === 'string' && /^[a-z0-9-]+$/.test(request.token_label)
  ? request.token_label
  : configuredLabel && /^[a-z0-9-]+$/.test(configuredLabel) ? configuredLabel : 'owner';
let client: Awaited<ReturnType<typeof open>> | undefined;
// One request's actual SDK completions, held only until its envelope is sent.
// A successful earlier reducer makes a later failure a partial operation; a
// lost reducer receipt does not establish rollback. No retry is performed.
const completionObservation = {completed_reducers: 0, pending_reducers: 0, receipt_lost: false, last_reducer: undefined as string | undefined};
function observedReducers<T extends object>(native: T): T {
  const methods = new Map<PropertyKey, unknown>();
  return new Proxy(native, {
    get(target, key, receiver) {
      const method = Reflect.get(target, key, receiver);
      if (typeof method !== 'function') return method;
      if (!methods.has(key)) methods.set(key, async (...args: unknown[]) => {
        completionObservation.pending_reducers += 1;
        completionObservation.last_reducer = String(key);
        try {
          const result = await Reflect.apply(method, target, args);
          completionObservation.completed_reducers += 1;
          return result;
        } catch (error) {
          // SDK2.8.1 SenderError is an actual graceful reducer rejection.
          // Internal/transport/unknown failures may have lost the receipt.
          if (!(error instanceof SenderError)) completionObservation.receipt_lost = true;
          throw error;
        } finally {
          completionObservation.pending_reducers -= 1;
        }
      });
      return methods.get(key);
    },
  });
}

try {
  client = await open(target, label);
} catch (error: any) {
  await emit({ ok: false, error: { kind: 'unavailable', message: `SharedField ${target.database} at ${target.uri} is unavailable: ${error?.message ?? String(error)}` } });
}

try {
  const reducers: any = observedReducers(client!.conn.reducers);
  const db: any = client!.conn.db;
  switch (request.kind) {
    // Reserved host seam: the native kernel supplies a freshly validated safe
    // document. Its generic SharedField operation refuses these request kinds.
    case 'preview_nara':
    case 'publish_nara': {
      validateCanonicalNaraCues(request.input?.document);
      const consent=createNaraPresenceConsent(request.input?.consent);
      if(Date.parse(consent.granted_at)!==request.consent_granted_at_unix_ms)throw new Error('Presence consent timestamps disagree');
      if(Date.parse(consent.granted_at)>Date.now())throw new Error('Presence consent is not yet granted');
      if(request.input?.audience?.visibility!=='restricted')throw new Error('Native Nara presence requires a restricted audience');
      const bundle=projectNaraExpression({...request.input,consent,published_at:consent.granted_at});
      if(request.kind==='publish_nara') {
        const history=rows(db.projection).filter((row:any)=>row.projectionRef===bundle.projection.projection_ref)
          .sort((a:any,b:any)=>Number(b.projectionRevision)-Number(a.projectionRevision));
        const prior=history[0];
        const entry=rows(db.exploreEntry).find((row:any)=>row.semanticRef===bundle.entry.ref);
        if(entry&&entry.fieldRef!==bundle.field_ref)throw new Error('This Expression already belongs to another SharedField; use its existing field or explicitly fork it before publishing');
        if(prior&&(prior.state!=='withdrawn'||Number(prior.projectionRevision)+1!==bundle.projection.projection_revision))
          throw new Error('Native Nara presence already has a hosted revision; recover it and withdraw before a new consented entry');
        if(!prior&&bundle.projection.projection_revision!==1)throw new Error('First native Nara presence revision must be 1');
        if(prior){
          const withdrawn=JSON.parse(prior.contractJson);
          const previousGrants=history.flatMap((row:any)=>JSON.parse(row.contractJson).relation_hints??[])
            .filter((hint:any)=>hint.kind==='consented-presence').map((hint:any)=>hint.consent_ref);
          if(previousGrants.includes(consent.consent_ref)||!(Date.parse(consent.granted_at)>Date.parse(withdrawn.published_at)))
            throw new Error('Re-entry requires a fresh consent reference granted after the hosted withdrawal');
        }
      }
      const publication=request.kind==='publish_nara'?await publishArgs(client!,hostedNaraExpressionArgs(bundle),reducers):null;
      await emit({ok:true,data:{schema:'oi.nara-presence/v1',bundle,publication,private_state_exported:false}});
    }
    case 'identity':
      await emit({ ok: true, data: { schema: 'oi.shared-field.identity/v1', transport_identity: client!.identityHex } });
    case 'tuple-keys-reconcile': {
      if (typeof request.field_ref !== 'string' || !request.field_ref.trim()) {
        await emit({ ok: false, error: { kind: 'malformed', message: 'tuple-keys-reconcile requires the exact owning field_ref' } });
      }
      if (typeof reducers.reconcileFieldTupleKeys !== 'function') {
        await emit({ ok: false, error: { kind: 'unavailable', message: 'The selected SharedField binding does not expose reconcile_field_tuple_keys; qualify the paired module and regenerated bindings before cutover' } });
      }
      // The native owner reducer validates this actual caller, preflights the
      // retained literal tuples and commits one atomic structural migration.
      // Completion is not a fabricated material snapshot or migration count.
      await reducers.reconcileFieldTupleKeys({ fieldRef: request.field_ref });
      await emit({ ok: true, data: {
        schema: 'oi.shared-field.reducer-completion/v1',
        completion: { state: 'completed', reducer: 'reconcile_field_tuple_keys', basis: 'sdk-reducer-success' },
        target: { field_ref: request.field_ref },
        observation: { state: 'not-requested', basis: 'structural-owner-operation' },
        connection_scoped: false,
      } });
    }
    case 'receipt': {
      if (typeof request.contribution_ref !== 'string' || !request.contribution_ref) await emit({ ok: false, error: { kind: 'malformed', message: 'receipt requires a contribution_ref' } });
      const receipt = rows(db.myContributionReceipt).find((row: any) => row.contributionRef === request.contribution_ref);
      if (!receipt) await emit({ ok: false, error: { kind: 'refused', message: `no caller-visible receipt for ${request.contribution_ref}` } });
      await emit({ ok: true, data: { schema: 'oi.shared-field.contribution-result/v1', contribution_ref: receipt.contributionRef, ingress_ref: receipt.ingressRef, field_ref: receipt.fieldRef, state: receipt.state } });
    }
    case 'observe':
      await emit({ok: true, data: await observeField(client!, request.cursor, request.ref)});
      break;
    case 'snapshot':
      await emit({ ok: true, data: fieldSnapshot(client!) });
    case 'read':
      if (typeof request.ref !== 'string' || !request.ref) await emit({ ok: false, error: { kind: 'malformed', message: 'read requires a string `ref`' } });
      await emit({ ok: true, data: readRef(client!, request.ref) });
    case 'publish': {
      const args = request.args;
      if (!args || typeof args !== 'object' || !args.putSharedField || !args.putParticipant || !args.putProjection) await emit({ ok: false, error: { kind: 'malformed', message: 'publish requires hosted reducer `args` (putSharedField, putParticipant, putProjection, putExploreEntries, putExploreRelations)' } });
      await emit({ ok: true, data: await publishArgs(client!, args, reducers) });
    }
    case 'projection': {
      const projection = createProjection(request.projection);
      if (typeof request.field_ref !== 'string' || !request.field_ref) await emit({ ok: false, error: { kind: 'malformed', message: 'projection requires the owning `field_ref`' } });
      await reducers.putProjection({ projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision), fieldRef: request.field_ref, projectionRef: projection.projection_ref, projectionRevision: projection.projection_revision, sourceRevision: projection.source.revision, publisherParticipantRef: projection.publisher_participant_ref, state: projection.state, contractJson: JSON.stringify(projection) });
      await waitUntil(() => rows(db.projection).some((row: any) => row.projectionRef === projection.projection_ref && row.projectionRevision === projection.projection_revision), `Projection ${projection.projection_ref}@${projection.projection_revision}`);
      await emit({ ok: true, data: { schema: 'oi.shared-field.projection-result/v1', field_ref: request.field_ref, projection_ref: projection.projection_ref, projection_revision: projection.projection_revision, state: projection.state } });
    }
    case 'participant': {
      const p = request.participant;
      if (!p || typeof p.participant_ref !== 'string' || typeof p.field_ref !== 'string' || typeof request.target_identity !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'participant requires a Participant contract and the hex `target_identity` it binds' } });
      await reducers.putParticipant({ participantRef: p.participant_ref, fieldRef: p.field_ref, identityKind: p.identity.kind, identityRef: p.identity.ref, sourceSystem: p.provenance.source_system, sourceRevision: p.provenance.source_revision, contractJson: JSON.stringify(p) });
      const { Identity } = await import('spacetimedb');
      await reducers.grantParticipantAuthority({ fieldRef: p.field_ref, participantRef: p.participant_ref, targetIdentity: Identity.fromString(request.target_identity), role: request.role ?? 'contributor', contactable: request.contactable !== false, ttlSeconds: 0 });
      await waitUntil(() => rows(db.participant).some((row: any) => row.participantRef === p.participant_ref), 'the Participant in the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.participant-result/v1', participant_ref: p.participant_ref, field_ref: p.field_ref, role: request.role ?? 'contributor', bound_identity: request.target_identity } });
    }
    case 'contribute': {
      const { validateContribution } = await import('../social.mjs');
      const contribution = validateContribution(request.contribution);
      if (typeof request.transport_message_id !== 'string' || !request.transport_message_id) await emit({ ok: false, error: { kind: 'malformed', message: 'contribute requires `transport_message_id`' } });
      await reducers.submitContribution({ fieldRef: contribution.field_ref, contributorParticipantRef: contribution.contributor_participant_ref, transportMessageId: request.transport_message_id, contractJson: JSON.stringify(contribution) });
      const receipt = await waitUntil(() => rows(db.myContributionReceipt).find((row: any) => row.contributionRef === contribution.contribution_ref), `receipt for Contribution ${contribution.contribution_ref}`);
      await emit({ ok: true, data: { schema: 'oi.shared-field.contribution-result/v1', contribution_ref: receipt.contributionRef, ingress_ref: receipt.ingressRef, field_ref: receipt.fieldRef, state: receipt.state } });
    }
    case 'admit': {
      if (typeof request.ingress_ref !== 'string' || typeof request.reason !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'admit requires `ingress_ref` and `reason`' } });
      await reducers.admitContribution({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', visibility: request.visibility ?? rows(db.sharedField).find((row: any) => row.fieldRef === request.field_ref)?.visibility ?? 'private', audienceRefsJson: JSON.stringify(request.audience_refs ?? []), reason: request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
      if (request.index) await reducers.setContributionIndexEligibility({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', eligible: true, reason: request.index_reason ?? request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
      const admitted = await waitUntil(() => rows(db.contribution).find((row: any) => row.ingressRef === request.ingress_ref || (request.contribution_ref && row.contributionRef === request.contribution_ref)), 'the admitted Contribution in the caller-visible view');
      if (request.entry) await reducers.putExploreEntry(request.entry);
      if (request.relation) await reducers.putExploreRelation(request.relation);
      await emit({ ok: true, data: { schema: 'oi.shared-field.admission-result/v1', ingress_ref: request.ingress_ref, contribution_ref: admitted.contributionRef, contributor_participant_ref: admitted.contributorParticipantRef, indexed: Boolean(request.index), contract: JSON.parse(admitted.contractJson) } });
    }
    case 'reject': {
      if (typeof request.ingress_ref !== 'string' || typeof request.reason !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'reject requires `ingress_ref` and `reason`' } });
      await reducers.rejectContribution({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', reason: request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
      await emit({ ok: true, data: { schema: 'oi.shared-field.contribution-result/v1', contribution_ref: request.contribution_ref ?? null, ingress_ref: request.ingress_ref, field_ref: request.field_ref ?? null, state: 'rejected' } });
    }
    case 'withdraw': {
      if (typeof request.ingress_ref !== 'string' || typeof request.reason !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'withdraw requires `ingress_ref` and `reason`' } });
      await reducers.withdrawContribution({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', reason: request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
      // The reducer's successful completion is the admission owner's native
      // receipt. `my_contribution_receipt` is deliberately submitter-only, so
      // an owner withdrawing another participant's ingress cannot read it.
      await emit({ ok: true, data: { schema: 'oi.shared-field.contribution-result/v1', contribution_ref: request.contribution_ref ?? null, ingress_ref: request.ingress_ref, field_ref: request.field_ref ?? null, state: 'withdrawn' } });
    }
    case 'watch': {
      const w = request.watch;
      if (!w || typeof w.watch_ref !== 'string' || typeof w.field_ref !== 'string' || typeof w.watcher_participant_ref !== 'string' || !w.target || typeof w.target.ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'watch requires an oi.watch/v1 contract (watch_ref, field_ref, watcher_participant_ref, target, state)' } });
      const { validateWatch } = await import('../watch.mjs');
      const watch = validateWatch(w);
      await reducers.putWatch({ watchRef: watch.watch_ref, fieldRef: watch.field_ref, watcherParticipantRef: watch.watcher_participant_ref, targetKind: watch.target.kind, targetRef: watch.target.ref, state: watch.state, contractJson: JSON.stringify(watch) });
      const row = await waitUntil(() => rows(db.myWatch).find((candidate: any) => candidate.watchRef === watch.watch_ref && candidate.state === watch.state), 'the Watch in the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.watch-result/v1', watch_ref: row.watchRef, field_ref: row.fieldRef, target: { kind: row.targetKind, ref: row.targetRef }, state: row.state, watcher_participant_ref: row.watcherParticipantRef } });
    }
    case 'contact': {
      if (typeof request.contact_ref !== 'string' || typeof request.recipient_participant_ref !== 'string' || typeof request.decision !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'contact requires `contact_ref`, `recipient_participant_ref`, `decision`' } });
      await reducers.respondContact({ contactRef: request.contact_ref, recipientParticipantRef: request.recipient_participant_ref, decision: request.decision, responseJson: JSON.stringify(request.response ?? { decision: request.decision }) });
      const row = await waitUntil(() => rows(db.myContact).find((candidate: any) => candidate.contactRef === request.contact_ref), 'the Contact in the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.contact-result/v1', contact_ref: row.contactRef, decision: request.decision, state: row.state ?? row.decision ?? null } });
    }
    case 'enter': {
      if (typeof request.field_ref !== 'string' || typeof request.participant_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'enter requires `field_ref` and `participant_ref`' } });
      await reducers.enterField({ fieldRef: request.field_ref, participantRef: request.participant_ref, state: request.state ?? 'entered' });
      const data = observeCompletedReducer('enter_field', {field_ref: request.field_ref, participant_ref: request.participant_ref},
        () => rows(db.fieldPresence).filter((candidate: any) => candidate.fieldRef === request.field_ref && candidate.participantRef === request.participant_ref),
        (row: any) => ({schema: 'oi.shared-field.presence-result/v1', field_ref: row.fieldRef, participant_ref: row.participantRef, state: row.state}));
      if (request.hold_presence === true) await holdPresence(data);
      await emit({ ok: true, data });
    }
    case 'leave': {
      if (typeof request.field_ref !== 'string' || typeof request.participant_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'leave requires `field_ref` and `participant_ref`' } });
      await reducers.leaveField({ fieldRef: request.field_ref, participantRef: request.participant_ref });
      await waitUntil(() => !rows(db.fieldPresence).some((candidate: any) => candidate.fieldRef === request.field_ref && candidate.participantRef === request.participant_ref), 'presence to clear');
      await emit({ ok: true, data: { schema: 'oi.shared-field.presence-result/v1', field_ref: request.field_ref, participant_ref: request.participant_ref, state: 'left' } });
    }
    case 'stage': {
      if (typeof request.field_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'stage requires `field_ref`' } });
      await emit({ ok: true, data: stageView(client!, request.field_ref) });
    }
    case 'stage-open': {
      const { validateSharedStage } = await import('../shared-stage.mjs');
      const stage = validateSharedStage(request.stage);
      if (stage.state !== 'open' || stage.revision !== 1) await emit({ ok: false, error: { kind: 'malformed', message: 'stage-open requires an `oi.shared-stage/v1` opening contract (revision 1, state open)' } });
      await reducers.openSharedStage({ fieldRef: stage.field_ref, stageRef: stage.shared_stage_ref, presenterParticipantRef: stage.presenter_ref, subjectRef: stage.subject_ref, contractJson: JSON.stringify(stage) });
      const row = await waitUntil(() => rows(db.sharedStage).find((candidate: any) => candidate.stageRef === stage.shared_stage_ref), 'the open Shared Stage in the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.stage-result/v1', ...stageReading(row) } });
    }
    case 'stage-advance': {
      const { validateSharedStage } = await import('../shared-stage.mjs');
      const stage = validateSharedStage(request.stage);
      if (!Number.isInteger(request.expected_revision)) await emit({ ok: false, error: { kind: 'malformed', message: 'stage-advance requires the integer `expected_revision` the writer read' } });
      if (stage.state !== 'open' || stage.revision !== request.expected_revision + 1) await emit({ ok: false, error: { kind: 'malformed', message: `stage-advance contract must be revision ${request.expected_revision + 1}` } });
      await reducers.advanceSharedStage({ fieldRef: stage.field_ref, stageRef: stage.shared_stage_ref, actorParticipantRef: stage.presenter_ref, expectedRevision: BigInt(request.expected_revision), contractJson: JSON.stringify(stage) });
      const row = await waitUntil(() => rows(db.sharedStage).find((candidate: any) => candidate.stageRef === stage.shared_stage_ref && Number(candidate.revision) === stage.revision), `Shared Stage ${stage.shared_stage_ref} at revision ${stage.revision}`);
      await emit({ ok: true, data: { schema: 'oi.shared-field.stage-result/v1', ...stageReading(row) } });
    }
    case 'stage-close': {
      const { validateSharedStage } = await import('../shared-stage.mjs');
      const stage = validateSharedStage(request.stage);
      if (!Number.isInteger(request.expected_revision)) await emit({ ok: false, error: { kind: 'malformed', message: 'stage-close requires the integer `expected_revision` the closer read' } });
      if (stage.state !== 'closed' || stage.revision !== request.expected_revision + 1) await emit({ ok: false, error: { kind: 'malformed', message: `stage-close contract must be the closed revision ${request.expected_revision + 1}` } });
      await reducers.closeSharedStage({ fieldRef: stage.field_ref, stageRef: stage.shared_stage_ref, actorParticipantRef: request.actor_participant_ref ?? stage.presenter_ref, expectedRevision: BigInt(request.expected_revision), contractJson: JSON.stringify(stage) });
      await waitUntil(() => !rows(db.sharedStage).some((candidate: any) => candidate.stageRef === stage.shared_stage_ref), 'the closed stage to leave the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.stage-result/v1', stage_ref: stage.shared_stage_ref, field_ref: stage.field_ref, revision: stage.revision, state: 'closed', presenter_ref: stage.presenter_ref, subject_ref: stage.subject_ref, contract: stage } });
    }
    case 'stage-follow': {
      if (typeof request.field_ref !== 'string' || typeof request.stage_ref !== 'string' || typeof request.follower_participant_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'stage-follow requires `field_ref`, `stage_ref`, `follower_participant_ref`' } });
      await reducers.followSharedStage({ fieldRef: request.field_ref, stageRef: request.stage_ref, followerParticipantRef: request.follower_participant_ref });
      const row = await waitUntil(() => rows(db.myStageFollow).find((candidate: any) => candidate.stageRef === request.stage_ref && candidate.followerParticipantRef === request.follower_participant_ref), 'the caller follow row');
      await emit({ ok: true, data: { schema: 'oi.shared-field.stage-follow-result/v1', stage_ref: row.stageRef, field_ref: row.fieldRef, follower_participant_ref: row.followerParticipantRef, followed_at_revision: Number(row.followedAtRevision), following: true } });
    }
    case 'stage-unfollow': {
      if (typeof request.field_ref !== 'string' || typeof request.stage_ref !== 'string' || typeof request.follower_participant_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'stage-unfollow requires `field_ref`, `stage_ref`, `follower_participant_ref`' } });
      await reducers.unfollowSharedStage({ fieldRef: request.field_ref, stageRef: request.stage_ref, followerParticipantRef: request.follower_participant_ref });
      await waitUntil(() => !rows(db.myStageFollow).some((candidate: any) => candidate.stageRef === request.stage_ref && candidate.followerParticipantRef === request.follower_participant_ref), 'the follow row to clear');
      await emit({ ok: true, data: { schema: 'oi.shared-field.stage-follow-result/v1', stage_ref: request.stage_ref, field_ref: request.field_ref, follower_participant_ref: request.follower_participant_ref, followed_at_revision: null, following: false } });
    }
    case 'field-now': {
      if (typeof request.field_ref !== 'string' || !request.field_ref) await emit({ ok: false, error: { kind: 'malformed', message: 'field-now requires `field_ref`' } });
      const row = rows(db.fieldNow).find((candidate: any) => candidate.fieldRef === request.field_ref);
      await emit({ ok: true, data: row ? fieldNowReading(row) : { schema: 'oi.shared-field.field-now-reading/v1', field_ref: request.field_ref, revision: 0, contract: null } });
    }
    case 'field-now-put': {
      const { validateFieldNow } = await import('../field-now.mjs');
      const fieldNow = validateFieldNow(request.field_now);
      if (!Number.isInteger(request.expected_revision)) await emit({ ok: false, error: { kind: 'malformed', message: 'field-now-put requires the integer `expected_revision` the projector read (0 for a first FieldNow)' } });
      if (fieldNow.revision !== request.expected_revision + 1) await emit({ ok: false, error: { kind: 'malformed', message: `field-now-put contract must be revision ${request.expected_revision + 1}` } });
      await reducers.putFieldNow({ fieldRef: fieldNow.field_ref, actorParticipantRef: request.actor_participant_ref ?? '', expectedRevision: BigInt(request.expected_revision), contractJson: JSON.stringify(fieldNow) });
      const row = await waitUntil(() => rows(db.fieldNow).find((candidate: any) => candidate.fieldRef === fieldNow.field_ref && Number(candidate.revision) >= fieldNow.revision), `FieldNow ${fieldNow.field_ref} at revision ${fieldNow.revision}`);
      await emit({ ok: true, data: { ...fieldNowReading(row), schema: 'oi.shared-field.field-now-result/v1' } });
    }
    case 'field-day': {
      if (typeof request.field_ref !== 'string' || !request.field_ref) await emit({ ok: false, error: { kind: 'malformed', message: 'field-day requires `field_ref`' } });
      await emit({ ok: true, data: { schema: 'oi.shared-field.field-day-list/v1', field_ref: request.field_ref, days: rows(db.fieldDay).filter((candidate: any) => candidate.fieldRef === request.field_ref).map(fieldDayReading) } });
    }
    case 'field-day-put': {
      const { validateFieldDay, fieldDayKey } = await import('../field-now.mjs');
      const fieldDay = validateFieldDay(request.field_day);
      const expected = request.expected_revision ?? fieldDay.revision - 1;
      if (!Number.isInteger(expected) || fieldDay.revision !== expected + 1) await emit({ ok: false, error: { kind: 'malformed', message: 'field-day-put contract must be exactly expected_revision + 1' } });
      await reducers.putFieldDay({ fieldRef: fieldDay.field_ref, actorParticipantRef: request.actor_participant_ref ?? '', expectedRevision: BigInt(expected), contractJson: JSON.stringify(fieldDay) });
      const key = fieldDayKey(fieldDay);
      const row = await waitUntil(() => rows(db.fieldDay).find((candidate: any) => candidate.dayKey === key && Number(candidate.revision) >= fieldDay.revision), `FieldDay ${key} at revision ${fieldDay.revision}`);
      await emit({ ok: true, data: { ...fieldDayReading(row), schema: 'oi.shared-field.field-day-result/v1' } });
    }
    case 'activity-liveness-put': {
      if (typeof request.field_ref !== 'string' || typeof request.activity_ref !== 'string' || typeof request.owner_state !== 'string' || !Number.isSafeInteger(request.owner_revision)) await emit({ ok: false, error: { kind: 'malformed', message: 'activity-liveness-put requires `field_ref`, `activity_ref`, `owner_state` and integer `owner_revision`' } });
      await reducers.putActivityLiveness({ fieldRef: request.field_ref, activityRef: request.activity_ref, producerParticipantRef: request.producer_participant_ref ?? '', ownerState: request.owner_state, ownerRevision: BigInt(request.owner_revision) });
      const data = observeCompletedReducer('put_activity_liveness', {field_ref: request.field_ref, activity_ref: request.activity_ref},
        () => rows(db.activityLiveness).filter((candidate: any) => candidate.fieldRef === request.field_ref && candidate.activityRef === request.activity_ref && Number(candidate.ownerRevision) === request.owner_revision),
        (row: any) => ({schema: 'oi.shared-field.activity-liveness-result/v1', ...activityLivenessRow(row), connection_scoped: true}));
      await emit({ ok: true, data });
    }
    case 'activity-liveness-clear': {
      if (typeof request.field_ref !== 'string' || typeof request.activity_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'activity-liveness-clear requires `field_ref` and `activity_ref`' } });
      await reducers.clearActivityLiveness({ fieldRef: request.field_ref, activityRef: request.activity_ref });
      await waitUntil(() => !rows(db.activityLiveness).some((candidate: any) => candidate.fieldRef === request.field_ref && candidate.activityRef === request.activity_ref), 'the activity liveness row to clear');
      await emit({ ok: true, data: { schema: 'oi.shared-field.activity-liveness-result/v1', field_ref: request.field_ref, activity_ref: request.activity_ref, cleared: true } });
    }
    case 'grant-read':
    case 'revoke-read': {
      if (typeof request.field_ref !== 'string' || typeof request.participant_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: `${request.kind} requires \`field_ref\` and \`participant_ref\`` } });
      // The read-audience table is deliberately unsubscribable (no View), so
      // the owner reducer's successful completion is the native receipt —
      // as with `withdraw`. The grantee's own views are what change.
      if (request.kind === 'grant-read') await reducers.grantFieldRead({ fieldRef: request.field_ref, participantRef: request.participant_ref });
      else await reducers.revokeFieldRead({ fieldRef: request.field_ref, participantRef: request.participant_ref });
      await emit({ ok: true, data: { schema: 'oi.shared-field.read-grant-result/v1', field_ref: request.field_ref, participant_ref: request.participant_ref, state: request.kind === 'grant-read' ? 'granted' : 'revoked' } });
    }
    default:
      await emit({ ok: false, error: { kind: 'malformed', message: `unknown request kind: ${request.kind}` } });
  }
} catch (error: any) {
  const outcomeUnknown = completionObservation.completed_reducers > 0 || completionObservation.pending_reducers > 0 || completionObservation.receipt_lost;
  await emit({ ok: false, error: {
    kind: outcomeUnknown ? 'outcome_unknown' : 'refused',
    message: error?.message ?? String(error),
    operation: request.kind,
    completion_observation: {...completionObservation},
  } });
} finally {
  if (client) close(client);
}
