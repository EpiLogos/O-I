import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createContribution } from '../social.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 10_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Client = { name: string; conn: DbConnection; identity: any; token: string };

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(name: string, token?: string): Promise<Client> {
  return new Promise<Client>((resolve, reject) => {
    let builder = DbConnection.builder().withUri(URI).withDatabaseName(DATABASE);
    if (token) builder = builder.withToken(token);
    builder
      .onConnect((conn, identity, issuedToken) => resolve({ name, conn, identity, token: issuedToken }))
      .onConnectError((_ctx, error) => reject(error))
      .build();
  });
}

async function subscribe(conn: DbConnection, queries: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => resolve())
      .onError((_ctx, error) => reject(error))
      .subscribe(queries);
  });
}

async function expectRejected(run: () => Promise<unknown>, description: string): Promise<void> {
  let rejected = false;
  try { await run(); } catch { rejected = true; }
  assert.equal(rejected, true, `${description} should reject`);
}

async function expectSubscriptionDenied(conn: DbConnection, tableName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => reject(new Error(`raw private ${tableName} unexpectedly applied`)))
      .onError(() => resolve())
      .subscribe(`SELECT * FROM ${tableName}`);
  });
}

function rows(handle: any): any[] { return [...handle.iter()]; }
function hasExplore(client: Client, ref: string): boolean {
  return rows(client.conn.db.exploreEntry).some(row => row.semanticRef === ref);
}
function hasRelation(client: Client, ref: string): boolean {
  return rows(client.conn.db.exploreRelation).some(row => row.relationRef === ref);
}
function contributionRow(client: Client, ref: string): any | undefined {
  return rows(client.conn.db.contribution).find(row => row.contributionRef === ref);
}
function receiptsFor(client: Client, ref: string): any[] {
  return rows(client.conn.db.myContributionReceipt).filter(row => row.contributionRef === ref);
}
function receiptFor(client: Client, ref: string): any | undefined {
  return receiptsFor(client, ref)[0];
}

function fieldContract(fieldRef: string, visibility: 'public' | 'restricted' | 'private', title: string) {
  return {
    schema: 'oi.shared-field/v1',
    field_ref: fieldRef,
    kind: visibility === 'public' ? 'public' : 'general',
    visibility,
    title,
    provenance: [{ kind: 'shared-field', ref: fieldRef, source_system: 'o-i', revision: `${fieldRef}@1` }],
  };
}

function participant(fieldRef: string, suffix: string, kind = 'agent') {
  return createParticipant({
    participant_ref: `participant:phase2:${suffix}:${fieldRef}`,
    field_ref: fieldRef,
    identity: { kind, ref: `${kind}:phase2:${suffix}` },
    presentation: { world_ref: `world:phase2:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `phase2:${suffix}@1` },
  });
}

function participantArgs(value: any) {
  return {
    participantRef: value.participant_ref,
    fieldRef: value.field_ref,
    identityKind: value.identity.kind,
    identityRef: value.identity.ref,
    sourceSystem: value.provenance.source_system,
    sourceRevision: value.provenance.source_revision,
    contractJson: JSON.stringify(value),
  };
}

function contribution(input: {
  ref: string;
  fieldRef: string;
  contributorRef: string;
  targetRef: string;
  targetKind?: string;
  payload?: any;
  source?: any;
}) {
  return createContribution({
    contribution_ref: input.ref,
    field_ref: input.fieldRef,
    contributor_participant_ref: input.contributorRef,
    created_at: '2026-08-17T09:30:00.000Z',
    mode: 'propose',
    target: { ref: input.targetRef, kind: input.targetKind ?? 'wiki-node' },
    relation: { kind: 'oi.proposes' },
    representation: { kind: 'json', payload: input.payload ?? { title: input.ref } },
    provenance: [{ kind: 'security-fixture', ref: input.ref, source_system: 'o-i', revision: `${input.ref}@1` }],
    ...(input.source ? { source: input.source } : {}),
  });
}

function entry(ref: string, label: string, kind = 'contribution') {
  return {
    schema: 'oi.explore-entry/v1',
    ref,
    kind,
    world_ref: 'world:phase2',
    label,
    summary: `${label} phase2 security fixture`,
    provenance: [{ kind: 'security-fixture', ref, source_system: 'o-i', revision: `${ref}@1` }],
  };
}

function entryArgs(fieldRef: string, value: any) {
  return {
    semanticRef: value.ref,
    fieldRef,
    worldRef: value.world_ref,
    kind: value.kind,
    label: value.label,
    revision: value.revision ?? '',
    entryJson: JSON.stringify(value),
  };
}

function relationArgs(fieldRef: string, relationRef: string, fromRef: string, toRef: string) {
  const value = {
    relation_ref: relationRef,
    from: fromRef,
    to: toRef,
    relation: 'oi.references',
    origin: 'phase2-security-fixture',
    provenance: [{ kind: 'security-fixture', ref: relationRef, source_system: 'o-i', revision: `${relationRef}@1` }],
  };
  return {
    relationRef,
    fieldRef,
    fromRef,
    toRef,
    relation: value.relation,
    origin: value.origin,
    relationJson: JSON.stringify(value),
  };
}

const publicField = fieldContract('oi:field:phase2-public', 'public', 'Phase 2 Public');
const privateField = fieldContract('oi:field:phase2-private', 'private', 'Phase 2 Private');
const rateField = fieldContract('oi:field:phase2-rate', 'public', 'Phase 2 Rate');
const foreignField = fieldContract('oi:field:phase2-foreign', 'public', 'Phase 2 Foreign');

const clients = await Promise.all([
  connect('OWNER'),
  connect('MEMBER'),
  connect('EXPLICIT_PRIVATE_RECIPIENT'),
  connect('REVOKED_ACTOR'),
  connect('FINITE_ACTOR'),
  connect('STRANGER'),
  connect('REMOTE_AGENT'),
]);
const [owner, member, recipient, revokedActor, finiteActor, stranger, remoteAgent] = clients;
let reconnectedStranger: Client | undefined;

const publicQueries = [
  'SELECT * FROM shared_field',
  'SELECT * FROM participant',
  'SELECT * FROM projection',
  'SELECT * FROM contribution',
  'SELECT * FROM explore_entry',
  'SELECT * FROM explore_relation',
];
const callerViews = [
  'SELECT * FROM my_field_authority',
  'SELECT * FROM my_watch',
  'SELECT * FROM my_contact',
  'SELECT * FROM my_contribution_receipt',
];

try {
  assert.equal(new Set(clients.map(client => client.identity.toHexString())).size, clients.length);
  for (const client of clients) await subscribe(client.conn, [...publicQueries, ...callerViews]);

  // 1. Quarantine/admission/index/rate backing state is not subscribable.
  for (const tableName of [
    'contribution_ingress_backing',
    'contribution_receipt',
    'admitted_contribution_backing',
    'admission_decision',
    'contribution_index_policy',
    'contribution_index_decision',
    'contribution_ingress_rate',
  ]) await expectSubscriptionDenied(stranger.conn, tableName);

  for (const field of [publicField, privateField, rateField]) {
    await owner.conn.reducers.putSharedField({
      fieldRef: field.field_ref,
      kind: field.kind,
      visibility: field.visibility,
      contractJson: JSON.stringify(field),
    });
  }
  await stranger.conn.reducers.putSharedField({
    fieldRef: foreignField.field_ref,
    kind: foreignField.kind,
    visibility: foreignField.visibility,
    contractJson: JSON.stringify(foreignField),
  });

  const remotePublic = participant(publicField.field_ref, 'remote');
  const memberPublic = participant(publicField.field_ref, 'member');
  const recipientPublic = participant(publicField.field_ref, 'recipient');
  const revokedAdmitter = participant(publicField.field_ref, 'revoked-admitter');
  const finiteAdmitter = participant(publicField.field_ref, 'finite-admitter');
  const remotePrivate = participant(privateField.field_ref, 'remote-private');
  const memberPrivate = participant(privateField.field_ref, 'member-private');
  const recipientPrivate = participant(privateField.field_ref, 'recipient-private');
  const rateRemote = participant(rateField.field_ref, 'rate-remote');
  const byteRemote = participant(rateField.field_ref, 'byte-remote');
  const foreignParticipant = participant(foreignField.field_ref, 'foreign');

  for (const value of [
    remotePublic, memberPublic, recipientPublic, revokedAdmitter, finiteAdmitter,
    remotePrivate, memberPrivate, recipientPrivate, rateRemote, byteRemote,
  ]) await owner.conn.reducers.putParticipant(participantArgs(value));
  await stranger.conn.reducers.putParticipant(participantArgs(foreignParticipant));

  for (const grant of [
    { fieldRef: publicField.field_ref, participantRef: remotePublic.participant_ref, targetIdentity: remoteAgent.identity, role: 'contributor', contactable: true, ttlSeconds: 0 },
    { fieldRef: publicField.field_ref, participantRef: memberPublic.participant_ref, targetIdentity: member.identity, role: 'observer', contactable: false, ttlSeconds: 0 },
    { fieldRef: publicField.field_ref, participantRef: recipientPublic.participant_ref, targetIdentity: recipient.identity, role: 'observer', contactable: false, ttlSeconds: 0 },
    { fieldRef: publicField.field_ref, participantRef: revokedAdmitter.participant_ref, targetIdentity: revokedActor.identity, role: 'admitter', contactable: false, ttlSeconds: 0 },
    { fieldRef: publicField.field_ref, participantRef: finiteAdmitter.participant_ref, targetIdentity: finiteActor.identity, role: 'admitter', contactable: false, ttlSeconds: 1 },
    { fieldRef: privateField.field_ref, participantRef: remotePrivate.participant_ref, targetIdentity: remoteAgent.identity, role: 'contributor', contactable: false, ttlSeconds: 0 },
    { fieldRef: privateField.field_ref, participantRef: memberPrivate.participant_ref, targetIdentity: member.identity, role: 'observer', contactable: false, ttlSeconds: 0 },
    { fieldRef: privateField.field_ref, participantRef: recipientPrivate.participant_ref, targetIdentity: recipient.identity, role: 'observer', contactable: false, ttlSeconds: 0 },
    { fieldRef: rateField.field_ref, participantRef: rateRemote.participant_ref, targetIdentity: remoteAgent.identity, role: 'contributor', contactable: false, ttlSeconds: 0 },
    { fieldRef: rateField.field_ref, participantRef: byteRemote.participant_ref, targetIdentity: remoteAgent.identity, role: 'contributor', contactable: false, ttlSeconds: 0 },
  ]) await owner.conn.reducers.grantParticipantAuthority(grant);

  await owner.conn.reducers.grantFieldRead({ fieldRef: privateField.field_ref, participantRef: recipientPrivate.participant_ref });

  const anchor = entry('entry:phase2:anchor', 'Phase 2 anchor', 'wiki-node');
  await owner.conn.reducers.putExploreEntry(entryArgs(publicField.field_ref, anchor));
  await waitUntil(() => hasExplore(stranger, anchor.ref), 'public anchor');

  const mainRef = 'contribution:phase2:private-indexed';
  const main = contribution({
    ref: mainRef,
    fieldRef: publicField.field_ref,
    contributorRef: remotePublic.participant_ref,
    targetRef: anchor.ref,
    payload: { text: 'untrusted candidate material' },
  });
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'direct-main-1',
    contractJson: JSON.stringify(main),
  });
  const mainReceipt = await waitUntil(() => receiptFor(remoteAgent, mainRef), 'sender quarantine receipt');
  assert.equal(mainReceipt.state, 'quarantined');

  // 2-4. Quarantine is not content, index, relation, provenance, or an existence oracle.
  assert.equal(rows(stranger.conn.db.myContributionReceipt).length, 0);
  assert.equal(contributionRow(stranger, mainRef), undefined);
  assert.equal(hasExplore(stranger, mainRef), false);
  assert.equal(JSON.stringify(rows(stranger.conn.db.exploreEntry)).includes(mainRef), false);
  await expectRejected(
    () => owner.conn.reducers.putExploreEntry(entryArgs(publicField.field_ref, entry(mainRef, 'premature'))),
    'indexing quarantined Contribution'
  );
  await expectRejected(
    () => owner.conn.reducers.putExploreRelation(relationArgs(publicField.field_ref, 'relation:phase2:premature', anchor.ref, mainRef)),
    'relation to quarantined Contribution'
  );

  // 5-7. Sender cannot author receiving policy or decide Admission/index eligibility.
  for (const [name, patch] of [
    ['admitted', { admitted: true }],
    ['visibility', { visibility: 'public' }],
    ['index', { index_eligible: true }],
  ] as const) {
    await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
      fieldRef: publicField.field_ref,
      contributorParticipantRef: remotePublic.participant_ref,
      transportMessageId: `forbidden-${name}`,
      contractJson: JSON.stringify({ ...main, contribution_ref: `${mainRef}:${name}`, ...patch }),
    }), `sender policy ${name}`);
  }
  await expectRejected(() => remoteAgent.conn.reducers.admitContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: remotePublic.participant_ref,
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'self admission',
    evidenceJson: '{}',
  }), 'sender self-Admission');

  // 8. Field/Participant/target/audience boundaries cannot be forged across fields.
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'forged-field',
    contractJson: JSON.stringify({ ...main, contribution_ref: 'contribution:phase2:forged-field', field_ref: privateField.field_ref }),
  }), 'forged receiving field');
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: foreignParticipant.participant_ref,
    transportMessageId: 'forged-participant',
    contractJson: JSON.stringify({ ...main, contribution_ref: 'contribution:phase2:forged-participant', contributor_participant_ref: foreignParticipant.participant_ref }),
  }), 'forged contributor Participant');
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'cross-field-target',
    contractJson: JSON.stringify({
      ...main,
      contribution_ref: 'contribution:phase2:cross-target',
      target: { ref: foreignParticipant.participant_ref, kind: 'participant' },
    }),
  }), 'cross-field target Participant');

  // 9. Exact transport retry is idempotent.
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'direct-main-1',
    contractJson: JSON.stringify(main),
  });
  await sleep(50);
  assert.equal(receiptsFor(remoteAgent, mainRef).length, 1);

  // 10a. Same transport retry key with a different payload is rejected and cannot overwrite.
  const mainConflict = contribution({
    ref: mainRef,
    fieldRef: publicField.field_ref,
    contributorRef: remotePublic.participant_ref,
    targetRef: anchor.ref,
    payload: { text: 'different payload' },
  });
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'direct-main-1',
    contractJson: JSON.stringify(mainConflict),
  }), 'conflicting transport replay');
  assert.equal(receiptFor(remoteAgent, mainRef)?.payloadFingerprint, mainReceipt.payloadFingerprint);

  // 11. Malformed, oversized, high-rate, high-fanout and high-byte ingress is bounded server-side.
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'malformed',
    contractJson: '{not-json',
  }), 'malformed Contribution JSON');
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'oversized',
    contractJson: JSON.stringify({
      ...main,
      contribution_ref: 'contribution:phase2:oversized',
      representation: { kind: 'json', payload: { text: 'x'.repeat(40_000) } },
    }),
  }), 'oversized Contribution');

  for (let n = 0; n < 8; n += 1) {
    const value = contribution({
      ref: `contribution:phase2:rate:${n}`,
      fieldRef: rateField.field_ref,
      contributorRef: rateRemote.participant_ref,
      targetRef: `external:rate:${n}`,
    });
    await remoteAgent.conn.reducers.submitContribution({
      fieldRef: rateField.field_ref,
      contributorParticipantRef: rateRemote.participant_ref,
      transportMessageId: `rate-${n}`,
      contractJson: JSON.stringify(value),
    });
  }
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: rateField.field_ref,
    contributorParticipantRef: rateRemote.participant_ref,
    transportMessageId: 'rate-9',
    contractJson: JSON.stringify(contribution({
      ref: 'contribution:phase2:rate:9',
      fieldRef: rateField.field_ref,
      contributorRef: rateRemote.participant_ref,
      targetRef: 'external:rate:9',
    })),
  }), 'rate/outstanding quarantine bound');

  const bytePayload = { chunks: ['b'.repeat(7_000), 'b'.repeat(7_000), 'b'.repeat(7_000)] };
  for (let n = 0; n < 4; n += 1) {
    const value = contribution({
      ref: `contribution:phase2:bytes:${n}`,
      fieldRef: rateField.field_ref,
      contributorRef: byteRemote.participant_ref,
      targetRef: `external:bytes:${n}`,
      payload: bytePayload,
    });
    await remoteAgent.conn.reducers.submitContribution({
      fieldRef: rateField.field_ref,
      contributorParticipantRef: byteRemote.participant_ref,
      transportMessageId: `bytes-${n}`,
      contractJson: JSON.stringify(value),
    });
  }
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: rateField.field_ref,
    contributorParticipantRef: byteRemote.participant_ref,
    transportMessageId: 'bytes-4',
    contractJson: JSON.stringify(contribution({
      ref: 'contribution:phase2:bytes:4',
      fieldRef: rateField.field_ref,
      contributorRef: byteRemote.participant_ref,
      targetRef: 'external:bytes:4',
      payload: bytePayload,
    })),
  }), 'per-origin byte budget');

  // 12-14. Admission is owner/admitter-only, revocable, and finite on reducer server time.
  await expectRejected(() => member.conn.reducers.rejectContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: memberPublic.participant_ref,
    reason: 'ordinary member attempt',
    evidenceJson: '{}',
  }), 'ordinary member Admission');

  const revokedRef = 'contribution:phase2:revoked';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'revoked-ingress',
    contractJson: JSON.stringify(contribution({ ref: revokedRef, fieldRef: publicField.field_ref, contributorRef: remotePublic.participant_ref, targetRef: anchor.ref })),
  });
  const revokedReceipt = await waitUntil(() => receiptFor(remoteAgent, revokedRef), 'revoked ingress');
  await owner.conn.reducers.revokeParticipantAuthority({ fieldRef: publicField.field_ref, participantRef: revokedAdmitter.participant_ref });
  await expectRejected(() => revokedActor.conn.reducers.admitContribution({
    ingressRef: revokedReceipt.ingressRef,
    admissionParticipantRef: revokedAdmitter.participant_ref,
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'revoked actor',
    evidenceJson: '{}',
  }), 'revoked Admission authority');

  const finiteRef = 'contribution:phase2:finite';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'finite-ingress',
    contractJson: JSON.stringify(contribution({ ref: finiteRef, fieldRef: publicField.field_ref, contributorRef: remotePublic.participant_ref, targetRef: anchor.ref })),
  });
  const finiteReceipt = await waitUntil(() => receiptFor(remoteAgent, finiteRef), 'finite ingress');
  await sleep(1_100);
  await expectRejected(() => finiteActor.conn.reducers.admitContribution({
    ingressRef: finiteReceipt.ingressRef,
    admissionParticipantRef: finiteAdmitter.participant_ref,
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'expired actor',
    evidenceJson: '{}',
  }), 'expired finite Admission authority');

  // 15-18. Admission != indexing; indexing != visibility; hidden endpoint suppresses relation.
  await owner.conn.reducers.admitContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'private',
    audienceRefsJson: JSON.stringify([recipientPublic.participant_ref]),
    reason: 'bounded private admission',
    evidenceJson: JSON.stringify({ bounded: true }),
  });
  await waitUntil(() => contributionRow(recipient, mainRef), 'recipient admitted Contribution');
  assert.equal(contributionRow(member, mainRef), undefined);
  assert.equal(contributionRow(stranger, mainRef), undefined);
  assert.equal(hasExplore(recipient, mainRef), false, 'Admission creates no Explore row');

  await owner.conn.reducers.setContributionIndexEligibility({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: '',
    eligible: false,
    reason: 'explicitly not index eligible',
    evidenceJson: '{}',
  });
  await expectRejected(() => owner.conn.reducers.putExploreEntry(entryArgs(publicField.field_ref, entry(mainRef, 'index-ineligible'))), 'index-ineligible Explore');
  await expectRejected(() => remoteAgent.conn.reducers.setContributionIndexEligibility({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: remotePublic.participant_ref,
    eligible: true,
    reason: 'sender index attempt',
    evidenceJson: '{}',
  }), 'sender index decision');

  await owner.conn.reducers.setContributionIndexEligibility({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: '',
    eligible: true,
    reason: 'receiving policy permits indexing',
    evidenceJson: '{}',
  });
  await owner.conn.reducers.putExploreEntry(entryArgs(publicField.field_ref, entry(mainRef, 'private indexed Contribution')));
  const hiddenRelationRef = 'relation:phase2:hidden-endpoint';
  await owner.conn.reducers.putExploreRelation(relationArgs(publicField.field_ref, hiddenRelationRef, anchor.ref, mainRef));
  await waitUntil(() => hasExplore(recipient, mainRef), 'recipient Explore row');
  await waitUntil(() => hasRelation(recipient, hiddenRelationRef), 'recipient Explore relation');
  assert.equal(hasExplore(member, mainRef), false);
  assert.equal(hasExplore(stranger, mainRef), false);
  assert.equal(hasRelation(member, hiddenRelationRef), false);
  assert.equal(hasRelation(stranger, hiddenRelationRef), false);

  // 10b. Same claimed semantic ref on a genuinely new ingress cannot overwrite the admitted object.
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'same-semantic-new-operation',
    contractJson: JSON.stringify(mainConflict),
  });
  await waitUntil(() => receiptsFor(remoteAgent, mainRef).length === 2, 'second bounded ingress for same semantic ref');
  const secondMainReceipt = receiptsFor(remoteAgent, mainRef).find(row => row.ingressRef !== mainReceipt.ingressRef);
  assert.ok(secondMainReceipt);
  await expectRejected(() => owner.conn.reducers.admitContribution({
    ingressRef: secondMainReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'must not overwrite existing semantic object',
    evidenceJson: '{}',
  }), 'same semantic ref overwrite');
  assert.equal(contributionRow(recipient, mainRef)?.ingressRef, mainReceipt.ingressRef);

  // 19-20. A2A returned material uses generic quarantine and creates no semantic/execution side effect.
  const a2aRef = 'contribution:phase2:a2a-return';
  const projectionCount = rows(owner.conn.db.projection).length;
  const watchCount = rows(owner.conn.db.myWatch).length;
  const contactCount = rows(owner.conn.db.myContact).length;
  await owner.conn.reducers.ingestTransportedContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    sourceKind: 'a2a',
    transportProvider: 'a2a-v1',
    transportMessageId: 'a2a-return-1',
    contractJson: JSON.stringify(contribution({
      ref: a2aRef,
      fieldRef: publicField.field_ref,
      contributorRef: remotePublic.participant_ref,
      targetRef: anchor.ref,
      payload: { task: 'task:phase2', message: 'message:phase2', artifact: 'artifact:phase2' },
      source: { transport: 'a2a', task_ref: 'task:phase2', message_ref: 'message:phase2', artifact_ref: 'artifact:phase2' },
    })),
  });
  const a2aReceipt = await waitUntil(() => receiptFor(owner, a2aRef), 'A2A quarantine receipt');
  assert.equal(a2aReceipt.state, 'quarantined');
  assert.equal(contributionRow(stranger, a2aRef), undefined);
  assert.equal(hasExplore(stranger, a2aRef), false);
  assert.equal(rows(owner.conn.db.projection).length, projectionCount);
  assert.equal(rows(owner.conn.db.myWatch).length, watchCount);
  assert.equal(rows(owner.conn.db.myContact).length, contactCount);

  // 21. Rejection and withdrawal leave no current index material.
  const rejectedRef = 'contribution:phase2:rejected';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'rejected-ingress',
    contractJson: JSON.stringify(contribution({ ref: rejectedRef, fieldRef: publicField.field_ref, contributorRef: remotePublic.participant_ref, targetRef: anchor.ref })),
  });
  const rejectedReceipt = await waitUntil(() => receiptFor(remoteAgent, rejectedRef), 'rejected ingress');
  await owner.conn.reducers.rejectContribution({ ingressRef: rejectedReceipt.ingressRef, admissionParticipantRef: '', reason: 'fixture rejection', evidenceJson: '{}' });
  await waitUntil(() => receiptFor(remoteAgent, rejectedRef)?.state === 'rejected', 'rejected receipt state');
  assert.equal(hasExplore(stranger, rejectedRef), false);

  const withdrawnRef = 'contribution:phase2:withdrawn';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'withdrawn-ingress',
    contractJson: JSON.stringify(contribution({ ref: withdrawnRef, fieldRef: publicField.field_ref, contributorRef: remotePublic.participant_ref, targetRef: anchor.ref })),
  });
  const withdrawnReceipt = await waitUntil(() => receiptFor(remoteAgent, withdrawnRef), 'withdrawn ingress');
  await owner.conn.reducers.admitContribution({ ingressRef: withdrawnReceipt.ingressRef, admissionParticipantRef: '', visibility: 'public', audienceRefsJson: '[]', reason: 'temporary admission', evidenceJson: '{}' });
  await owner.conn.reducers.setContributionIndexEligibility({ ingressRef: withdrawnReceipt.ingressRef, admissionParticipantRef: '', eligible: true, reason: 'temporary index', evidenceJson: '{}' });
  await owner.conn.reducers.putExploreEntry(entryArgs(publicField.field_ref, entry(withdrawnRef, 'withdrawable')));
  await waitUntil(() => hasExplore(stranger, withdrawnRef), 'public indexed Contribution before withdrawal');
  await owner.conn.reducers.withdrawContribution({ ingressRef: withdrawnReceipt.ingressRef, admissionParticipantRef: '', reason: 'fixture withdrawal', evidenceJson: '{}' });
  await waitUntil(() => !hasExplore(stranger, withdrawnRef), 'withdrawal cleanup');
  assert.equal(contributionRow(stranger, withdrawnRef), undefined);

  // 22. Private admitted/index-eligible Contributions stay hidden from ordinary members.
  const privateRef = 'contribution:phase2:private-field';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: privateField.field_ref,
    contributorParticipantRef: remotePrivate.participant_ref,
    transportMessageId: 'private-ingress',
    contractJson: JSON.stringify(contribution({
      ref: privateRef,
      fieldRef: privateField.field_ref,
      contributorRef: remotePrivate.participant_ref,
      targetRef: 'external:private-target',
      payload: { secret: 'PRIVATE-CONTRIBUTION-SENTINEL' },
    })),
  });
  const privateReceipt = await waitUntil(() => receiptFor(remoteAgent, privateRef), 'private ingress');
  await owner.conn.reducers.admitContribution({
    ingressRef: privateReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'private',
    audienceRefsJson: JSON.stringify([recipientPrivate.participant_ref]),
    reason: 'private audience',
    evidenceJson: '{}',
  });
  await owner.conn.reducers.setContributionIndexEligibility({ ingressRef: privateReceipt.ingressRef, admissionParticipantRef: '', eligible: true, reason: 'private index eligibility', evidenceJson: '{}' });
  await owner.conn.reducers.putExploreEntry(entryArgs(privateField.field_ref, entry(privateRef, 'private-field Contribution')));
  await waitUntil(() => hasExplore(recipient, privateRef), 'explicit private recipient Explore row');
  assert.equal(hasExplore(member, privateRef), false);
  assert.equal(contributionRow(member, privateRef), undefined);
  assert.equal(JSON.stringify({ contributions: rows(member.conn.db.contribution), entries: rows(member.conn.db.exploreEntry) }).includes('PRIVATE-CONTRIBUTION-SENTINEL'), false);

  // Receiving policy cannot widen the containing field or import a foreign audience.
  const widenRef = 'contribution:phase2:private-widen';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: privateField.field_ref,
    contributorParticipantRef: remotePrivate.participant_ref,
    transportMessageId: 'private-widen',
    contractJson: JSON.stringify(contribution({ ref: widenRef, fieldRef: privateField.field_ref, contributorRef: remotePrivate.participant_ref, targetRef: 'external:widen' })),
  });
  const widenReceipt = await waitUntil(() => receiptFor(remoteAgent, widenRef), 'private widening ingress');
  await expectRejected(() => owner.conn.reducers.admitContribution({ ingressRef: widenReceipt.ingressRef, admissionParticipantRef: '', visibility: 'public', audienceRefsJson: '[]', reason: 'widen field', evidenceJson: '{}' }), 'private field public widening');
  await expectRejected(() => owner.conn.reducers.admitContribution({ ingressRef: widenReceipt.ingressRef, admissionParticipantRef: '', visibility: 'private', audienceRefsJson: JSON.stringify([foreignParticipant.participant_ref]), reason: 'foreign audience', evidenceJson: '{}' }), 'cross-field Contribution audience');

  // 23. Reconnect with the same caller identity cannot resurrect hidden/rejected/withdrawn state.
  stranger.conn.disconnect();
  reconnectedStranger = await connect('STRANGER_RECONNECTED', stranger.token);
  assert.equal(reconnectedStranger.identity.toHexString(), stranger.identity.toHexString());
  await subscribe(reconnectedStranger.conn, [...publicQueries, ...callerViews]);
  assert.equal(hasExplore(reconnectedStranger, withdrawnRef), false);
  assert.equal(hasExplore(reconnectedStranger, rejectedRef), false);
  assert.equal(hasExplore(reconnectedStranger, mainRef), false);
  assert.equal(contributionRow(reconnectedStranger, rejectedRef), undefined);
  assert.equal(rows(reconnectedStranger.conn.db.myContributionReceipt).length, 0);

  console.log(JSON.stringify({
    proof: 'oi-encounter-security-spacetimedb/v5-phase2-contribution-admission',
    spacetimedb: '2.8.1',
    identities: clients.map(client => ({ name: client.name, identity: client.identity.toHexString() })),
    attacks: {
      raw_quarantine_subscription: 'denied',
      unrelated_quarantine_rows: 'zero',
      received_explore_rows: 'zero',
      quarantine_existence_relation_provenance_leak: 'zero',
      sender_self_admission: 'denied',
      sender_visibility: 'denied',
      sender_index_eligibility: 'denied',
      cross_field_target_audience_participant: 'denied',
      exact_transport_replay: 'idempotent',
      claimed_ref_or_transport_conflict_overwrite: 'denied',
      malformed_oversized_rate_byte_outstanding: 'bounded',
      receiving_admission_authority: 'required',
      revoked_admission_authority: 'denied',
      finite_admission_authority_after_expiry: 'denied_by_reducer_time',
      admission_auto_explore: 'zero',
      admitted_index_ineligible_explore: 'zero',
      admitted_index_eligible_caller_visibility: 'phase1_intersection',
      hidden_relation_endpoint: 'zero',
      a2a_returned_difference_auto_promotion: 'zero',
      ingress_admission_execution_side_effect: 'zero_projection_watch_contact',
      rejection_withdrawal_stale_index: 'removed',
      private_contribution_ordinary_member: 'zero',
      reconnect_rebuild_resurrection: 'zero',
    },
  }, null, 2));
} finally {
  for (const client of clients) {
    try { client.conn.disconnect(); } catch {}
  }
  try { reconnectedStranger?.conn.disconnect(); } catch {}
}
