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
 * Held (`field.sh --held`, O-I #858): the native host's one client for its
 * identity, for the life of the window. One request per line in,
 * `{"id":n,"request":{...}}`; its envelope out on one line with the same id;
 * and, unasked, `{"event":"transaction","cursor","changes","more"}` whenever a
 * server transaction changes what this caller can see (the rows it moved, by
 * table and ref, never their content) and `{"event":"status",...}` when the
 * connection's standing changes. The connection, its subscription and its
 * credential are made once (field-lib `holdField`); a lost service is
 * reconnected, no act replayed. `observe` answers at once with the held
 * cursor; `view {lease, scope}` says what is in view (`"whole"`, field refs,
 * or null to let the lease go); each request brings what it reads into view
 * for a glance (field-lib `requestScope`). End of input ends the client.
 *
 * Requests:
 *   status                              target binding only; no network
 *   bind      {target}                  bind this machine's SharedField target (non-secret; no network)
 *   unbind                              clear this machine's binding
 *   identity                            the caller's transport identity only
 *   snapshot                            the caller-visible field
 *   worlds                              the worlds, clearings, stars, gatherings, star days and sayings alone (field-lib `worldReading`)
 *   observe   {observer_ref, ref?}      held only: the field at the held cursor (the transaction); a one-shot run refuses it
 *   receipt   {contribution_ref}         caller's private Contribution receipt
 *   read      {ref}                     one hosted ref as a Projection reading
 *   publish   {args}                    hosted reducer args (hostedPublicationArgs shape), pushed in order
 *   participant {participant, target_identity, role, contactable}   register a Participant contract and bind an identity
 *   contribute  {contribution, transport_message_id} submit one attributable difference to quarantine
 *   admit     {ingress_ref, reason, evidence, index, entry?, relation?}  admit a quarantined Contribution under the caller's authority
 *   reject    {ingress_ref, reason, evidence} reject a quarantined Contribution under the caller's authority
 *   withdraw  {ingress_ref, reason, evidence} withdraw an admitted Contribution under owner/admission authority
 *   contact   {contact_ref, recipient_participant_ref, decision, response}   respond to a Contact request
 *   message   {to_participant_ref, passage: {text, from, path?}}   send a person a passage and where it came from (O-I #820,
 *                                        DLW §18.4): a Contact request the recipient accepts before they read it, from the
 *                                        caller's own Participant in the recipient's field, the passage in its requested scope
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
 *   nara-presences {participant_ref?, field_ref?}   the consented Nara presences the caller sees, each with its consent and whether it was withdrawn
 *   withdraw_nara  {projection_ref, consent_ref, withdrawal_ref, withdrawn_at?}   withdraw a hosted presence: its consent and the projection's next,
 *                                        withdrawn revision (nara-expression-projection.mjs naraWithdrawal), published through publishArgs
 *
 * Worlds first (O-I #858; each answers once the caller's own view shows the act, with the world, clearing or star as the caller reads it):
 *   world-put         {world_ref, body, linked}        put the caller's world: its `aikit.world-body/v1` record and whether it is linked into the field
 *   clearing-open     {world_ref, part_ref, audience, star_ref?, shown}   show a part of the caller's world to the field, the public or one star
 *   clearing-withdraw {world_ref, part_ref, star_ref?}  put it back under cloud everywhere at once
 *   star-light        {star_ref, world_ref, name, gathers, comes, within?}   light a star (or rename it, or change its terms); the world gathers first
 *   star-gather       {star_ref, world_ref}            bring the caller's world to a star: gathered, or asked where the lighter lets each world in
 *   star-admit        {star_ref, world_ref}            the lighter lets an asking world in
 *   star-leave        {star_ref, world_ref}            leave (or, for the lighter, turn a world away): what it showed there is taken back
 *   star-close        {star_ref}                       close a star: every world returns to its own orbit
 *   star-say          {saying_ref, star_ref, world_ref, to, what, words}   say a question, finding, correction or reproduction at a star,
 *                                        `to` {world_ref, part_ref} shown there or {saying_ref} said there; the caller's world is gathered
 *   star-unsay        {saying_ref}                     unsay what the caller's world said at a star; what answered it stands
 */
import { activityLivenessRow, bindingFile, close, fieldDayReading, fieldNowReading, fieldSnapshot, holdField, hostingTargets, open, publishArgs, readRef, resolveTarget, rows, stageReading, stageView, waitUntil, worldReading, type Client } from './field-lib';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname } from 'node:path';
import { createProjection } from '../index.mjs';
import { projectionStorageKey } from '../spacetimedb.mjs';
import {createNaraPresenceConsent,projectNaraExpression,hostedNaraExpressionArgs,validateCanonicalNaraCues,naraPresencesFromRows,naraWithdrawal,NARA_PRESENCE_WITHDRAWAL_SCHEMA} from '../nara-expression-projection.mjs';

// stdout carries exactly one envelope; the SDK's own console chatter goes to stderr.
for (const level of ['log', 'info', 'warn', 'debug', 'error'] as const) console[level] = (...parts: unknown[]) => { process.stderr.write(`${parts.map(String).join(' ')}\n`); };

type Envelope = { ok: true; data: unknown } | { ok: false; error: { kind: 'unbound' | 'unavailable' | 'refused' | 'malformed'; message: string } };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** Write the one envelope a one-shot run answers, and end the run. */
async function send(envelope: Envelope): Promise<never> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write(`${JSON.stringify(envelope)}\n`, error => error ? reject(error) : resolve());
  });
  process.exit(envelope.ok ? 0 : 1);
}

/** A request's answer ends it: `emit` throws its envelope back to `answer`,
 * which returns it, so one law answers a one-shot run and a held client. */
class Reply { constructor(readonly envelope: Envelope) {} }
async function emit(envelope: Envelope): Promise<never> { throw new Reply(envelope); }

/** The machine's own binding, answered without the network in either mode;
 * null for every request that needs the field. */
function bindingAnswer(request: any): Envelope | null {
  if (request.kind === 'bind') {
    const targets = hostingTargets();
    if (typeof request.target !== 'string' || !targets[request.target]) return { ok: false, error: { kind: 'malformed', message: `bind requires a \`target\` named in hosting.json (${Object.keys(targets).join(', ')})` } };
    const file = bindingFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ schema: 'oi.shared-field-binding/v1', target: request.target, bound_at: new Date().toISOString() }, null, 2)}\n`);
  }
  if (request.kind === 'unbind') {
    rmSync(bindingFile(), { force: true });
  }
  if (request.kind !== 'status' && request.kind !== 'bind' && request.kind !== 'unbind') return null;
  const binding = resolveTarget();
  return { ok: true, data: binding.bound ? { schema: 'oi.shared-field.status/v1', bound: true, binding_source: binding.source, binding_file: bindingFile(), target: { name: binding.target.name, uri: binding.target.uri, database: binding.target.database } } : { schema: 'oi.shared-field.status/v1', bound: false, binding_file: bindingFile(), reason: binding.reason } };
}

/** The one identity a client stands as: the configured label, else the owner's. */
function configuredLabel(): string {
  const configured = process.env.OI_SHARED_FIELD_TOKEN_LABEL;
  return configured && /^[a-z0-9-]+$/.test(configured) ? configured : 'owner';
}

/** Observation is the held client's: its cursor is the transaction, and a one-shot run takes none. */
const OBSERVE_IS_HELD = 'observe is the held client\'s (field.sh --held): its cursor is the transaction, and a one-shot run sees none; read `snapshot` instead';

/** One run, one request: the doorway acceptance scripts and the CLI use. */
async function once(): Promise<never> {
  const raw = (await readStdin()).trim();
  let request: any;
  try { request = raw ? JSON.parse(raw) : { kind: 'status' }; } catch (error: any) { await send({ ok: false, error: { kind: 'malformed', message: `request is not JSON: ${error.message}` } }); }
  if (!request || typeof request !== 'object' || typeof request.kind !== 'string') await send({ ok: false, error: { kind: 'malformed', message: 'request must be an object with a string `kind`' } });
  const bound = bindingAnswer(request);
  if (bound) await send(bound);
  if (request.kind === 'observe') await send({ ok: false, error: { kind: 'refused', message: OBSERVE_IS_HELD } });
  const binding = resolveTarget();
  const target = binding.bound ? binding.target : await send({ ok: false, error: { kind: 'unbound', message: binding.reason } });
  const label = typeof request.token_label === 'string' && /^[a-z0-9-]+$/.test(request.token_label) ? request.token_label : configuredLabel();
  let client: Client | undefined;
  try {
    client = await open(target, label);
  } catch (error: any) {
    await send({ ok: false, error: { kind: 'unavailable', message: `SharedField ${target.database} at ${target.uri} is unavailable: ${error?.message ?? String(error)}` } });
  }
  const envelope = await answer(client!, request);
  close(client!);
  return send(envelope);
}

/** The native host's one client for its identity: requests by line, answers
 * and the field's own transactions by line, until the host lets go. */
async function held(): Promise<never> {
  const write = (line: Record<string, unknown>) => { process.stdout.write(`${JSON.stringify(line)}\n`); };
  const hold = holdField({ label: configuredLabel(), answer, emit: write });
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const inflight = new Set<Promise<void>>();
  input.on('line', (line) => { const answering = (async () => {
    let message: any;
    try { message = JSON.parse(line); } catch { process.stderr.write('SharedField held client: a line that is not JSON was ignored\n'); return; }
    if (!message || !Number.isSafeInteger(message.id)) { process.stderr.write('SharedField held client: a request without an id was ignored\n'); return; }
    const request = message.request;
    let envelope: Envelope;
    try {
      const bound = request && typeof request === 'object' && typeof request.kind === 'string' ? bindingAnswer(request) : null;
      if (bound?.ok && request.kind !== 'status') await hold.rebind();
      envelope = bound ? (bound.ok ? { ok: true, data: { ...(bound.data as object), held: hold.reading() } } : bound) : await hold.request(request);
    } catch (error: any) {
      envelope = { ok: false, error: { kind: 'refused', message: error?.message ?? String(error) } };
    }
    write({ id: message.id, ...envelope });
  })(); inflight.add(answering); void answering.finally(() => inflight.delete(answering)); });
  await new Promise<void>((resolve) => input.once('close', () => resolve()));
  // The host let go: answer what it asked, let the field go, and drain every
  // answer before the process ends (a pipe is written asynchronously here).
  while (inflight.size) await Promise.allSettled([...inflight]);
  hold.close();
  await new Promise<void>((resolve) => process.stdout.write('', () => resolve()));
  process.exit(0);
}

/** One request against an open client, in the owner's words. */
async function answer(client: Client, request: any): Promise<Envelope> {
try {
  const reducers: any = client!.conn.reducers;
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
      const publication=request.kind==='publish_nara'?await publishArgs(client!,hostedNaraExpressionArgs(bundle)):null;
      await emit({ok:true,data:{schema:'oi.nara-presence/v1',bundle,publication,private_state_exported:false}});
    }
    // The consented presences as the caller sees them, and their withdrawal (SharedField owns the consent lifecycle: kernel nara_presence.rs).
    case 'nara-presences': {
      await emit({ ok: true, data: naraPresencesFromRows({ projections: rows(db.projection), participants: rows(db.participant) },
        { participant_ref: typeof request.participant_ref === 'string' ? request.participant_ref : undefined, field_ref: typeof request.field_ref === 'string' ? request.field_ref : undefined }) });
    }
    case 'withdraw_nara': {
      const withdrawal = naraWithdrawal({ projections: rows(db.projection), participants: rows(db.participant), sharedFields: rows(db.sharedField) }, request);
      const publication = await publishArgs(client!, withdrawal.args);
      await emit({ ok: true, data: { schema: NARA_PRESENCE_WITHDRAWAL_SCHEMA, consent: withdrawal.consent, projection_ref: withdrawal.projection.projection_ref,
        projection_revision: withdrawal.projection.projection_revision, publication, private_state_exported: false } });
    }
    case 'identity':
      await emit({ ok: true, data: { schema: 'oi.shared-field.identity/v1', transport_identity: client!.identityHex } });
    case 'receipt': {
      if (typeof request.contribution_ref !== 'string' || !request.contribution_ref) await emit({ ok: false, error: { kind: 'malformed', message: 'receipt requires a contribution_ref' } });
      const receipt = rows(db.myContributionReceipt).find((row: any) => row.contributionRef === request.contribution_ref);
      if (!receipt) await emit({ ok: false, error: { kind: 'refused', message: `no caller-visible receipt for ${request.contribution_ref}` } });
      await emit({ ok: true, data: { schema: 'oi.shared-field.contribution-result/v1', contribution_ref: receipt.contributionRef, ingress_ref: receipt.ingressRef, field_ref: receipt.fieldRef, state: receipt.state } });
    }
    case 'observe':
      await emit({ ok: false, error: { kind: 'refused', message: OBSERVE_IS_HELD } });
    case 'snapshot':
      await emit({ ok: true, data: fieldSnapshot(client!) });
    case 'worlds':
      await emit({ ok: true, data: { schema: 'oi.shared-field.worlds/v1', ...worldReading(client!) } });
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
    case 'message': {
      // A passage sent to a person (DLW §18.4 What a tag sends: "a message that carries the passage and where it came from. A person in
      // another world gets a request, which waits until they accept it"): the hosted Contact request, the passage in its requested scope.
      const passage = request.passage;
      if (typeof request.to_participant_ref !== 'string' || !request.to_participant_ref || !passage || typeof passage.text !== 'string' || !passage.text.trim() || typeof passage.from !== 'string' || !passage.from.trim()
        || (passage.path !== undefined && passage.path !== null && typeof passage.path !== 'string')) {
        await emit({ ok: false, error: { kind: 'malformed', message: 'message requires `to_participant_ref` and a `passage` {text, from, path?}' } });
      }
      const to = rows(db.participant).find((row: any) => row.participantRef === request.to_participant_ref);
      if (!to) await emit({ ok: false, error: { kind: 'refused', message: `${request.to_participant_ref} is no Participant of a field you can see: nothing was sent.` } });
      const mine = rows(db.myFieldAuthority).find((row: any) => row.fieldRef === to.fieldRef && !row.revoked && ['contact', 'contributor'].includes(row.role) && row.participantRef !== to.participantRef);
      if (!mine) await emit({ ok: false, error: { kind: 'refused', message: `You stand in ${to.fieldRef} as no Participant that may contact another: nothing was sent.` } });
      const message = { schema: 'oi.message/v1', passage: passage.text, from: passage.from.trim(), ...(passage.path ? { path: passage.path } : {}) };
      const requestedScopeJson = JSON.stringify({ kind: 'message', message });
      if (requestedScopeJson.length > 4_096) await emit({ ok: false, error: { kind: 'refused', message: `A message carries at most 4096 characters with where it came from; this one is ${requestedScopeJson.length}: nothing was sent. Send a shorter passage.` } });
      const { randomUUID } = await import('node:crypto');
      const contactRef = `contact:message:${randomUUID()}`;
      await reducers.requestContact({ contactRef, fieldRef: to.fieldRef, initiatorParticipantRef: mine.participantRef, recipientParticipantRef: to.participantRef,
        purpose: `A passage from ${message.from}`.slice(0, 500), requestedScopeJson, ttlSeconds: Number.isInteger(request.ttl_seconds) && request.ttl_seconds > 0 ? Math.min(request.ttl_seconds, 604_800) : 604_800,
        provenanceJson: JSON.stringify({ system: 'oi-desktop', act: 'a passage sent from the search line', ...(passage.path ? { source_path: passage.path } : {}) }) });
      const row = await waitUntil(() => rows(db.myContact).find((candidate: any) => candidate.contactRef === contactRef), 'the message request in the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.message-result/v1', contact_ref: row.contactRef, field_ref: row.fieldRef, from_participant_ref: row.initiatorParticipantRef,
        to_participant_ref: row.recipientParticipantRef, state: row.state, characters: [...passage.text].length, expires_at_micros: String(row.expiresAtMicros) } });
    }
    case 'enter': {
      if (typeof request.field_ref !== 'string' || typeof request.participant_ref !== 'string') await emit({ ok: false, error: { kind: 'malformed', message: 'enter requires `field_ref` and `participant_ref`' } });
      await reducers.enterField({ fieldRef: request.field_ref, participantRef: request.participant_ref, state: request.state ?? 'entered' });
      const row = await waitUntil(() => rows(db.fieldPresence).find((candidate: any) => candidate.fieldRef === request.field_ref && candidate.participantRef === request.participant_ref), 'the caller presence in the caller-visible view');
      // The presence lives as long as the connection that entered it: a held
      // client's for the window's life (the native host), a one-shot run's until it ends.
      await emit({ ok: true, data: { schema: 'oi.shared-field.presence-result/v1', field_ref: row.fieldRef, participant_ref: row.participantRef, state: row.state } });
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
      const row = await waitUntil(() => rows(db.activityLiveness).find((candidate: any) => candidate.fieldRef === request.field_ref && candidate.activityRef === request.activity_ref && Number(candidate.ownerRevision) === request.owner_revision), 'the activity liveness row in the caller-visible view');
      await emit({ ok: true, data: { schema: 'oi.shared-field.activity-liveness-result/v1', ...activityLivenessRow(row), connection_scoped: true } });
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
    case 'world-put':
    case 'clearing-open':
    case 'clearing-withdraw':
    case 'star-light':
    case 'star-gather':
    case 'star-admit':
    case 'star-leave':
    case 'star-close':
    case 'star-say':
    case 'star-unsay': {
      await emit(await worldAct(client!, request));
    }
    default:
      await emit({ ok: false, error: { kind: 'malformed', message: `unknown request kind: ${request.kind}` } });
  }
} catch (error: any) {
  if (error instanceof Reply) return error.envelope;
  return { ok: false, error: { kind: 'refused', message: error?.message ?? String(error) } };
}
return { ok: false, error: { kind: 'refused', message: `request ${request.kind} returned no answer` } };
}

/** One act on the worlds in the field (O-I #858): the reducer, then the caller's own view of what it did. */
async function worldAct(client: Client, request: any): Promise<Envelope> {
  if (client.worlds.state !== 'held') return { ok: false, error: { kind: 'unavailable', message: client.worlds.detail } };
  const reducers: any = client.conn.reducers;
  const text = (value: unknown) => typeof value === 'string' && value.length > 0;
  const malformed = (message: string): Envelope => ({ ok: false, error: { kind: 'malformed', message } });
  const read = () => worldReading(client);
  const clearingOf = (worldRef: string, partRef: string, starRef: string) => read().clearings.find((c: any) => c.world_ref === worldRef && c.part_ref === partRef && (c.star_ref ?? '') === starRef);
  const gatheringOf = (starRef: string, worldRef: string) => read().gatherings.find((g: any) => g.star_ref === starRef && g.world_ref === worldRef);
  const starOf = (starRef: string) => read().stars.find((star: any) => star.star_ref === starRef);
  const sayingOf = (sayingRef: string) => read().star_sayings.find((saying: any) => saying.saying_ref === sayingRef);
  const starRef = text(request.star_ref) ? request.star_ref : '';
  switch (request.kind) {
    case 'world-put': {
      if (!text(request.world_ref) || !request.body || typeof request.body !== 'object' || typeof request.linked !== 'boolean') return malformed('world-put requires `world_ref`, the `body` record and `linked`');
      const bodyJson = JSON.stringify(request.body);
      await reducers.putWorld({ worldRef: request.world_ref, bodyJson, linked: request.linked });
      const world = await waitUntil(() => read().worlds.find((w: any) => w.world_ref === request.world_ref && w.linked === request.linked && JSON.stringify(w.body) === JSON.stringify(JSON.parse(bodyJson))), 'the world in the caller\'s own view');
      return { ok: true, data: { schema: 'oi.shared-field.world-result/v1', world } };
    }
    case 'clearing-open': {
      if (!text(request.world_ref) || !text(request.part_ref) || !text(request.audience) || !request.shown || typeof request.shown !== 'object') return malformed('clearing-open requires `world_ref`, `part_ref`, `audience` and what it `shown`s');
      const shownJson = JSON.stringify(request.shown);
      await reducers.openClearing({ worldRef: request.world_ref, partRef: request.part_ref, starRef, audience: request.audience, shownJson });
      const clearing = await waitUntil(() => { const c = clearingOf(request.world_ref, request.part_ref, starRef); return c && c.audience === request.audience && JSON.stringify(c.shown) === JSON.stringify(JSON.parse(shownJson)) && c; }, 'the clearing in the caller\'s own view');
      return { ok: true, data: { schema: 'oi.shared-field.clearing-result/v1', clearing, state: 'open' } };
    }
    case 'clearing-withdraw': {
      if (!text(request.world_ref) || !text(request.part_ref)) return malformed('clearing-withdraw requires `world_ref` and `part_ref`');
      await reducers.withdrawClearing({ worldRef: request.world_ref, partRef: request.part_ref, starRef });
      await waitUntil(() => !clearingOf(request.world_ref, request.part_ref, starRef), 'the clearing to go back under cloud');
      return { ok: true, data: { schema: 'oi.shared-field.clearing-result/v1', world_ref: request.world_ref, part_ref: request.part_ref, star_ref: starRef || null, state: 'withdrawn' } };
    }
    case 'star-light': {
      if (!text(request.star_ref) || !text(request.world_ref) || !text(request.name) || !text(request.gathers) || !text(request.comes)) return malformed('star-light requires `star_ref`, `world_ref`, `name`, `gathers` and `comes`');
      await reducers.lightStar({ starRef: request.star_ref, worldRef: request.world_ref, name: request.name, gathers: request.gathers, comes: request.comes, parentStarRef: text(request.within) ? request.within : '' });
      const star = await waitUntil(() => { const s = starOf(request.star_ref); return s && s.name === request.name && s.gathers === request.gathers && s.comes === request.comes && gatheringOf(request.star_ref, request.world_ref)?.state === 'gathered' && s; }, 'the star in the caller\'s own view');
      return { ok: true, data: { schema: 'oi.shared-field.star-result/v1', star, gathered: read().gatherings.filter((g: any) => g.star_ref === request.star_ref && g.state === 'gathered'), state: 'lit' } };
    }
    case 'star-gather':
    case 'star-admit': {
      if (!text(request.star_ref) || !text(request.world_ref)) return malformed(`${request.kind} requires \`star_ref\` and \`world_ref\``);
      if (request.kind === 'star-gather') await reducers.gatherAtStar({ starRef: request.star_ref, worldRef: request.world_ref });
      else await reducers.admitToStar({ starRef: request.star_ref, worldRef: request.world_ref });
      const gathering = await waitUntil(() => { const g = gatheringOf(request.star_ref, request.world_ref); return g && (request.kind === 'star-gather' || g.state === 'gathered') && g; }, 'the gathering in the caller\'s own view');
      return { ok: true, data: { schema: 'oi.shared-field.gathering-result/v1', ...gathering } };
    }
    case 'star-leave': {
      if (!text(request.star_ref) || !text(request.world_ref)) return malformed('star-leave requires `star_ref` and `world_ref`');
      await reducers.leaveStar({ starRef: request.star_ref, worldRef: request.world_ref });
      await waitUntil(() => !gatheringOf(request.star_ref, request.world_ref), 'the world to leave the star');
      return { ok: true, data: { schema: 'oi.shared-field.gathering-result/v1', star_ref: request.star_ref, world_ref: request.world_ref, state: 'left' } };
    }
    case 'star-close': {
      if (!text(request.star_ref)) return malformed('star-close requires `star_ref`');
      await reducers.closeStar({ starRef: request.star_ref });
      await waitUntil(() => !starOf(request.star_ref), 'the star to close');
      return { ok: true, data: { schema: 'oi.shared-field.star-result/v1', star_ref: request.star_ref, state: 'closed' } };
    }
    case 'star-say': {
      if (client.sayings.state !== 'held') return { ok: false, error: { kind: 'unavailable', message: client.sayings.detail } };
      const to = request.to && typeof request.to === 'object' ? request.to : null;
      const toShown = to && text(to.world_ref) && text(to.part_ref) && to.saying_ref === undefined, toSaid = to && text(to.saying_ref) && to.world_ref === undefined && to.part_ref === undefined;
      if (!text(request.saying_ref) || !text(request.star_ref) || !text(request.world_ref) || !text(request.what) || typeof request.words !== 'string' || !(toShown || toSaid)) {
        return malformed('star-say requires `saying_ref`, `star_ref`, `world_ref`, `what`, `words` and `to`: {world_ref, part_ref} or {saying_ref}');
      }
      await reducers.sayAtStar({ sayingRef: request.saying_ref, starRef: request.star_ref, worldRef: request.world_ref, toWorldRef: toShown ? to.world_ref : '', toPartRef: toShown ? to.part_ref : '',
        toSayingRef: toSaid ? to.saying_ref : '', what: request.what, words: request.words });
      const saying = await waitUntil(() => sayingOf(request.saying_ref), 'the saying in the caller\'s own view');
      return { ok: true, data: { schema: 'oi.shared-field.saying-result/v1', saying, state: 'said' } };
    }
    case 'star-unsay': {
      if (client.sayings.state !== 'held') return { ok: false, error: { kind: 'unavailable', message: client.sayings.detail } };
      if (!text(request.saying_ref)) return malformed('star-unsay requires `saying_ref`');
      await reducers.unsayAtStar({ sayingRef: request.saying_ref });
      await waitUntil(() => !sayingOf(request.saying_ref), 'the saying to be unsaid');
      return { ok: true, data: { schema: 'oi.shared-field.saying-result/v1', saying_ref: request.saying_ref, state: 'unsaid' } };
    }
  }
  return malformed(`unknown world act: ${request.kind}`);
}

if (process.argv.includes('--held')) await held();
else await once();
