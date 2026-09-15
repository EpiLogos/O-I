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
 */
import { close, fieldSnapshot, open, publishArgs, readRef, resolveTarget, rows, waitUntil } from './field-lib';
import { createProjection } from '../index.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';

// stdout carries exactly one envelope; the SDK's own console chatter goes to stderr.
for (const level of ['log', 'info', 'warn', 'debug', 'error'] as const) console[level] = (...parts: unknown[]) => { process.stderr.write(`${parts.map(String).join(' ')}\n`); };
const { close, fieldSnapshot, open, publishArgs, readRef, resolveTarget, rows, waitUntil } = await import('./field-lib');

type Envelope = { ok: true; data: unknown } | { ok: false; error: { kind: 'unbound' | 'unavailable' | 'refused' | 'malformed'; message: string } };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function emit(envelope: Envelope): Promise<never> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(envelope)}\n`, error => error ? reject(error) : resolve());
  });
  process.exit(envelope.ok ? 0 : 1);
}

const raw = (await readStdin()).trim();
let request: any;
try { request = raw ? JSON.parse(raw) : { kind: 'status' }; } catch (error: any) { await emit({ ok: false, error: { kind: 'malformed', message: `request is not JSON: ${error.message}` } }); }
if (!request || typeof request !== 'object' || typeof request.kind !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'request must be an object with a string `kind`' } });

const binding = resolveTarget();
if (request.kind === 'status') {
  await emit({ ok: true, data: binding.bound ? { schema: 'oi.shared-field.status/v1', bound: true, target: { name: binding.target.name, uri: binding.target.uri, database: binding.target.database } } : { schema: 'oi.shared-field.status/v1', bound: false, reason: binding.reason } });
}
const target = binding.bound ? binding.target : await emit({ ok: false, error: { kind: 'unbound', message: binding.reason } });

const configuredLabel = process.env.OI_SHARED_FIELD_TOKEN_LABEL;
const label = typeof request.token_label === 'string' && /^[a-z0-9-]+$/.test(request.token_label)
  ? request.token_label
  : configuredLabel && /^[a-z0-9-]+$/.test(configuredLabel) ? configuredLabel : 'owner';
let client: Awaited<ReturnType<typeof open>> | undefined;
try {
  client = await open(target, label);
} catch (error: any) {
  await emit({ ok: false, error: { kind: 'unavailable', message: `SharedField ${target.database} at ${target.uri} is unavailable: ${error?.message ?? String(error)}` } });
}

try {
  const reducers: any = client!.conn.reducers;
  const db: any = client!.conn.db;
  switch (request.kind) {
    case 'identity':
      await emit({ ok: true, data: { schema: 'oi.shared-field.identity/v1', transport_identity: client!.identityHex } });
    case 'receipt': {
      if (typeof request.contribution_ref !== 'string' || !request.contribution_ref) await emit({ ok: false, error: { kind: 'malformed', message: 'receipt requires a contribution_ref' } });
      const receipt = rows(db.myContributionReceipt).find((row: any) => row.contributionRef === request.contribution_ref);
      if (!receipt) await emit({ ok: false, error: { kind: 'refused', message: `no caller-visible receipt for ${request.contribution_ref}` } });
      await emit({ ok: true, data: { schema: 'oi.shared-field.contribution-result/v1', contribution_ref: receipt.contributionRef, ingress_ref: receipt.ingressRef, field_ref: receipt.fieldRef, state: receipt.state } });
    }
    case 'snapshot':
      await emit({ ok: true, data: fieldSnapshot(client!) });
    case 'read':
      if (typeof request.ref !== 'string' || !request.ref) await emit({ ok: false, error: { kind: 'malformed', message: 'read requires a string `ref`' } });
      await emit({ ok: true, data: readRef(client!, request.ref) });
    case 'publish': {
      const args = request.args;
      if (!args || typeof args !== 'object' || !args.putSharedField || !args.putParticipant || !args.putProjection) await emit({ ok: false, error: { kind: 'malformed', message: 'publish requires hosted reducer `args` (putSharedField, putParticipant, putProjection, putExploreEntries, putExploreRelations)' } });
      await emit({ ok: true, data: await publishArgs(client!, args) });
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
      await reducers.admitContribution({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', visibility: request.visibility ?? 'public', audienceRefsJson: JSON.stringify(request.audience_refs ?? []), reason: request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
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
    default:
      await emit({ ok: false, error: { kind: 'malformed', message: `unknown request kind: ${request.kind}` } });
  }
} catch (error: any) {
  await emit({ ok: false, error: { kind: 'refused', message: error?.message ?? String(error) } });
} finally {
  if (client) close(client);
}
