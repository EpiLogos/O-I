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
 *   read      {ref}                     one hosted ref as a Projection reading
 *   publish   {args}                    hosted reducer args (hostedPublicationArgs shape), pushed in order
 *   participant {participant, target_identity, role, contactable}   register a Participant contract and bind an identity
 *   admit     {ingress_ref, reason, evidence, index, entry?, relation?}  admit a quarantined Contribution under the caller's authority
 *   contact   {contact_ref, recipient_participant_ref, decision, response}   respond to a Contact request
 */
import { close, fieldSnapshot, open, publishArgs, readRef, resolveTarget, rows, waitUntil } from './field-lib';

// stdout carries exactly one envelope; the SDK's own console chatter goes to stderr.
for (const level of ['log', 'info', 'warn', 'debug', 'error'] as const) console[level] = (...parts: unknown[]) => { process.stderr.write(`${parts.map(String).join(' ')}\n`); };

type Envelope = { ok: true; data: unknown } | { ok: false; error: { kind: 'unbound' | 'unavailable' | 'refused' | 'malformed'; message: string } };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function emit(envelope: Envelope): never {
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
  process.exit(envelope.ok ? 0 : 1);
}

const raw = (await readStdin()).trim();
let request: any;
try { request = raw ? JSON.parse(raw) : { kind: 'status' }; } catch (error: any) { emit({ ok: false, error: { kind: 'malformed', message: `request is not JSON: ${error.message}` } }); }
if (!request || typeof request !== 'object' || typeof request.kind !== 'string') emit({ ok: false, error: { kind: 'malformed', message: 'request must be an object with a string `kind`' } });

const binding = resolveTarget();
if (request.kind === 'status') {
  emit({ ok: true, data: binding.bound ? { schema: 'oi.shared-field.status/v1', bound: true, target: { name: binding.target.name, uri: binding.target.uri, database: binding.target.database } } : { schema: 'oi.shared-field.status/v1', bound: false, reason: binding.reason } });
}
if (!binding.bound) emit({ ok: false, error: { kind: 'unbound', message: binding.reason } });

const label = typeof request.token_label === 'string' && /^[a-z0-9-]+$/.test(request.token_label) ? request.token_label : 'owner';
let client: Awaited<ReturnType<typeof open>> | undefined;
try {
  client = await open(binding.target, label);
} catch (error: any) {
  emit({ ok: false, error: { kind: 'unavailable', message: `SharedField ${binding.target.database} at ${binding.target.uri} is unavailable: ${error?.message ?? String(error)}` } });
}

try {
  const reducers: any = client!.conn.reducers;
  const db: any = client!.conn.db;
  switch (request.kind) {
    case 'snapshot':
      emit({ ok: true, data: fieldSnapshot(client!) });
    case 'read':
      if (typeof request.ref !== 'string' || !request.ref) emit({ ok: false, error: { kind: 'malformed', message: 'read requires a string `ref`' } });
      emit({ ok: true, data: readRef(client!, request.ref) });
    case 'publish': {
      const args = request.args;
      if (!args || typeof args !== 'object' || !args.putSharedField || !args.putParticipant || !args.putProjection) emit({ ok: false, error: { kind: 'malformed', message: 'publish requires hosted reducer `args` (putSharedField, putParticipant, putProjection, putExploreEntries, putExploreRelations)' } });
      emit({ ok: true, data: await publishArgs(client!, args) });
    }
    case 'participant': {
      const p = request.participant;
      if (!p || typeof p.participant_ref !== 'string' || typeof p.field_ref !== 'string' || typeof request.target_identity !== 'string') emit({ ok: false, error: { kind: 'malformed', message: 'participant requires a Participant contract and the hex `target_identity` it binds' } });
      await reducers.putParticipant({ participantRef: p.participant_ref, fieldRef: p.field_ref, identityKind: p.identity.kind, identityRef: p.identity.ref, sourceSystem: p.provenance.source_system, sourceRevision: p.provenance.source_revision, contractJson: JSON.stringify(p) });
      const { Identity } = await import('spacetimedb');
      await reducers.grantParticipantAuthority({ fieldRef: p.field_ref, participantRef: p.participant_ref, targetIdentity: Identity.fromString(request.target_identity), role: request.role ?? 'contributor', contactable: request.contactable !== false, ttlSeconds: 0 });
      await waitUntil(() => rows(db.participant).some((row: any) => row.participantRef === p.participant_ref), 'the Participant in the caller-visible view');
      emit({ ok: true, data: { schema: 'oi.shared-field.participant-result/v1', participant_ref: p.participant_ref, field_ref: p.field_ref, role: request.role ?? 'contributor', bound_identity: request.target_identity } });
    }
    case 'admit': {
      if (typeof request.ingress_ref !== 'string' || typeof request.reason !== 'string') emit({ ok: false, error: { kind: 'malformed', message: 'admit requires `ingress_ref` and `reason`' } });
      await reducers.admitContribution({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', visibility: request.visibility ?? 'public', audienceRefsJson: JSON.stringify(request.audience_refs ?? []), reason: request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
      if (request.index) await reducers.setContributionIndexEligibility({ ingressRef: request.ingress_ref, admissionParticipantRef: request.admission_participant_ref ?? '', eligible: true, reason: request.index_reason ?? request.reason, evidenceJson: JSON.stringify(request.evidence ?? {}) });
      const admitted = await waitUntil(() => rows(db.contribution).find((row: any) => row.ingressRef === request.ingress_ref || (request.contribution_ref && row.contributionRef === request.contribution_ref)), 'the admitted Contribution in the caller-visible view');
      if (request.entry) await reducers.putExploreEntry(request.entry);
      if (request.relation) await reducers.putExploreRelation(request.relation);
      emit({ ok: true, data: { schema: 'oi.shared-field.admission-result/v1', ingress_ref: request.ingress_ref, contribution_ref: admitted.contributionRef, contributor_participant_ref: admitted.contributorParticipantRef, indexed: Boolean(request.index), contract: JSON.parse(admitted.contractJson) } });
    }
    case 'contact': {
      if (typeof request.contact_ref !== 'string' || typeof request.recipient_participant_ref !== 'string' || typeof request.decision !== 'string') emit({ ok: false, error: { kind: 'malformed', message: 'contact requires `contact_ref`, `recipient_participant_ref`, `decision`' } });
      await reducers.respondContact({ contactRef: request.contact_ref, recipientParticipantRef: request.recipient_participant_ref, decision: request.decision, responseJson: JSON.stringify(request.response ?? { decision: request.decision }) });
      const row = await waitUntil(() => rows(db.myContact).find((candidate: any) => candidate.contactRef === request.contact_ref), 'the Contact in the caller-visible view');
      emit({ ok: true, data: { schema: 'oi.shared-field.contact-result/v1', contact_ref: row.contactRef, decision: request.decision, state: row.state ?? row.decision ?? null } });
    }
    default:
      emit({ ok: false, error: { kind: 'malformed', message: `unknown request kind: ${request.kind}` } });
  }
} catch (error: any) {
  emit({ ok: false, error: { kind: 'refused', message: error?.message ?? String(error) } });
} finally {
  if (client) close(client);
}
