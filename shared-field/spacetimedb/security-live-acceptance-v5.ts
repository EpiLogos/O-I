import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createContribution } from '../social.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 10_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

type Client = { name: string; conn: DbConnection; identity: any; token: string };

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

async function expectSubscriptionDenied(conn: DbConnection, query: string, description: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    conn.subscriptionBuilder()
      .onApplied(() => reject(new Error(`${description} unexpectedly applied`)))
      .onError(() => resolve())
      .subscribe(query);
  });
}

function rows(handle: any): any[] { return [...handle.iter()]; }
function hasExplore(client: Client, semanticRef: string): boolean {
  return rows(client.conn.db.exploreEntry).some(row => row.semanticRef === semanticRef);
}
function hasRelation(client: Client, relationRef: string): boolean {
  return rows(client.conn.db.exploreRelation).some(row => row.relationRef === relationRef);
}
function contributionRow(client: Client, contributionRef: string): any | undefined {
  return rows(client.conn.db.contribution).find(row => row.contributionRef === contributionRef);
}
function receiptFor(client: Client, contributionRef: string): any | undefined {
  return rows(client.conn.db.myContributionReceipt).find(row => row.contributionRef === contributionRef);
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

function makeParticipant(fieldRef: string, suffix: string, kind = 'agent') {
  return createParticipant({
    participant_ref: `participant:phase2:${suffix}:${fieldRef}`,
    field_ref: fieldRef,
    identity: { kind, ref: `${kind}:phase2:${suffix}` },
    presentation: { world_ref: `world:phase2:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `phase2:${suffix}@1` },
  });
}

function contributionContract(input: {
  contributionRef: string;
  fieldRef: string;
  contributorParticipantRef: string;
  targetRef: string;
  targetKind?: string;
  payload?: any;
  source?: any;
}) {
  return createContribution({
    contribution_ref: input.contributionRef,
    field_ref: input.fieldRef,
    contributor_participant_ref: input.contributorParticipantRef,
    created_at: '2026-08-17T09:30:00.000Z',
    mode: 'propose',
    target: { ref: input.targetRef, kind: input.targetKind ?? 'wiki-node' },
    relation: { kind: 'oi.proposes' },
    representation: { kind: 'json', payload: input.payload ?? { title: input.contributionRef } },
    provenance: [{ kind: 'security-fixture', ref: input.contributionRef, source_system: 'o-i', revision: `${input.contributionRef}@1` }],
    ...(input.source ? { source: input.source } : {}),
  });
}

function exploreEntry(ref: string, kind: string, label: string) {
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

function exploreArgs(fieldRef: string, entry: any) {
  return {
    semanticRef: entry.ref,
    fieldRef,
    worldRef: entry.world_ref,
    kind: entry.kind,
    label: entry.label,
    revision: entry.revision ?? '',
    entryJson: JSON.stringify(entry),
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
const privateViews = [
  'SELECT * FROM my_field_authority',
  'SELECT * FROM my_watch',
  'SELECT * FROM my_contact',
  'SELECT * FROM my_contribution_receipt',
];

try {
  assert.equal(new Set(clients.map(client => client.identity.toHexString())).size, clients.length);
  for (const client of clients) await subscribe(client.conn, [...publicQueries, ...privateViews]);

  // 1. Raw quarantine/admission/index/rate state is never subscribable by ordinary callers.
  for (const tableName of [
    'contribution_ingress_backing',
    'contribution_receipt',
    'admitted_contribution_backing',
    'admission_decision',
    'contribution_index_policy',
    'contribution_index_decision',
    'contribution_ingress_rate',
  ]) {
    await expectSubscriptionDenied(stranger.conn, `SELECT * FROM ${tableName}`, `raw private ${tableName}`);
  }

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

  const ownerPublic = makeParticipant(publicField.field_ref, 'owner', 'human');
  const remotePublic = makeParticipant(publicField.field_ref, 'remote');
  const memberPublic = makeParticipant(publicField.field_ref, 'member');
  const recipientPublic = makeParticipant(publicField.field_ref, 'recipient');
  const revokedAdmitter = makeParticipant(publicField.field_ref, 'revoked-admitter');
  const finiteAdmitter = makeParticipant(publicField.field_ref, 'finite-admitter');
  const remotePrivate = makeParticipant(privateField.field_ref, 'remote-private');
  const memberPrivate = makeParticipant(privateField.field_ref, 'member-private');
  const recipientPrivate = makeParticipant(privateField.field_ref, 'recipient-private');
  const rateRemote = makeParticipant(rateField.field_ref, 'rate-remote');
  const byteRemote = makeParticipant(rateField.field_ref, 'byte-remote');
  const foreignParticipant = makeParticipant(foreignField.field_ref, 'foreign');

  for (const value of [
    ownerPublic, remotePublic, memberPublic, recipientPublic, revokedAdmitter, finiteAdmitter,
    remotePrivate, memberPrivate, recipientPrivate, rateRemote, byteRemote,
  ]) await owner.conn.reducers.putParticipant(participantArgs(value));
  await stranger.conn.reducers.putParticipant(participantArgs(foreignParticipant));

  for (const grant of [
    { fieldRef: publicField.field_ref, participantRef: ownerPublic.participant_ref, targetIdentity: owner.identity, role: 'contributor', contactable: true, ttlSeconds: 0 },
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

  await owner.conn.reducers.grantFieldRead({
    fieldRef: privateField.field_ref,
    participantRef: recipientPrivate.participant_ref,
  });

  const anchor = exploreEntry('entry:phase2:anchor', 'wiki-node', 'Phase 2 anchor');
  await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, anchor));
  await waitUntil(() => hasExplore(stranger, anchor.ref), 'Phase2 public anchor');

  const mainRef = 'contribution:phase2:private-indexed';
  const main = contributionContract({
    contributionRef: mainRef,
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    targetRef: anchor.ref,
    targetKind: 'wiki-node',
    payload: { text: 'untrusted candidate material' },
  });

  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'direct-main-1',
    contractJson: JSON.stringify(main),
  });
  const mainReceipt = await waitUntil(() => receiptFor(remoteAgent, mainRef), 'sender-scoped quarantine receipt');
  assert.equal(mainReceipt.state, 'quarantined');

  // 2-4. Quarantine has no public Contribution/Explore/relation/provenance/existence surface.
  assert.equal(rows(stranger.conn.db.myContributionReceipt).length, 0, 'unrelated caller receives zero quarantine receipts');
  assert.equal(contributionRow(stranger, mainRef), undefined, 'quarantined Contribution is not public content');
  assert.equal(hasExplore(stranger, mainRef), false, 'received Contribution creates zero Explore rows');
  assert.equal(JSON.stringify(rows(stranger.conn.db.exploreEntry)).includes(mainRef), false, 'quarantine semantic ref does not leak through Explore');
  await expectRejected(
    () => owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, exploreEntry(mainRef, 'contribution', 'Premature Contribution index'))),
    'owner indexing quarantined Contribution'
  );
  await expectRejected(
    () => owner.conn.reducers.putExploreRelation(relationArgs(publicField.field_ref, 'relation:phase2:premature', anchor.ref, mainRef)),
    'relation to quarantined Contribution'
  );

  // 5-7. Sender policy claims are rejected and cannot self-admit or self-index.
  for (const [name, patch] of [
    ['admitted', { admitted: true }],
    ['visibility', { visibility: 'public' }],
    ['index eligibility', { index_eligible: true }],
  ] as const) {
    await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
      fieldRef: publicField.field_ref,
      contributorParticipantRef: remotePublic.participant_ref,
      transportMessageId: `forbidden-policy-${name}`,
      contractJson: JSON.stringify({ ...main, contribution_ref: `${mainRef}:${name}`, ...patch }),
    }), `sender-selected ${name}`);
  }
  await expectRejected(() => remoteAgent.conn.reducers.admitContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: remotePublic.participant_ref,
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'self admission',
    evidenceJson: '{}',
  }), 'sender self-Admission');

  // 8. Cross-field field/Participant/target claims fail closed.
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'cross-field-contract',
    contractJson: JSON.stringify({ ...main, contribution_ref: 'contribution:phase2:cross-field', field_ref: privateField.field_ref }),
  }), 'forged target field');
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: foreignParticipant.participant_ref,
    transportMessageId: 'forged-participant',
    contractJson: JSON.stringify({ ...main, contribution_ref: 'contribution:phase2:forged-participant', contributor_participant_ref: foreignParticipant.participant_ref }),
  }), 'forged Participant ref');
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

  // 9. Exact transport replay is idempotent and does not multiply pending semantic state.
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'direct-main-1',
    contractJson: JSON.stringify(main),
  });
  await sleep(50);
  assert.equal(rows(remoteAgent.conn.db.myContributionReceipt).filter(row => row.contributionRef === mainRef).length, 1);

  // 10. Same retry identity plus conflicting payload cannot overwrite the original ingress.
  const conflictingMain = contributionContract({
    contributionRef: mainRef,
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    targetRef: anchor.ref,
    payload: { text: 'DIFFERENT PAYLOAD' },
  });
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'direct-main-1',
    contractJson: JSON.stringify(conflictingMain),
  }), 'same transport id with conflicting payload');
  assert.equal(receiptFor(remoteAgent, mainRef)?.payloadFingerprint, mainReceipt.payloadFingerprint);

  // 11. Malformed/oversized payloads are rejected before quarantine.
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'malformed',
    contractJson: '{not-json',
  }), 'malformed Contribution JSON');
  const oversized = { ...main, contribution_ref: 'contribution:phase2:oversized', representation: { kind: 'json', payload: { text: 'x'.repeat(40_000) } } };
  await expectRejected(() => remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'oversized',
    contractJson: JSON.stringify(oversized),
  }), 'oversized Contribution payload');

  // Rate/outstanding and byte budgets are deterministic field+origin bounds.
  for (let n = 0; n < 8; n += 1) {
    const value = contributionContract({
      contributionRef: `contribution:phase2:rate:${n}`,
      fieldRef: rateField.field_ref,
      contributorParticipantRef: rateRemote.participant_ref,
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
    contractJson: JSON.stringify(contributionContract({
      contributionRef: 'contribution:phase2:rate:9',
      fieldRef: rateField.field_ref,
      contributorParticipantRef: rateRemote.participant_ref,
      targetRef: 'external:rate:9',
    })),
  }), 'high-rate/outstanding Contribution ingress');

  for (let n = 0; n < 4; n += 1) {
    const value = contributionContract({
      contributionRef: `contribution:phase2:bytes:${n}`,
      fieldRef: rateField.field_ref,
      contributorParticipantRef: byteRemote.participant_ref,
      targetRef: `external:bytes:${n}`,
      payload: { text: 'b'.repeat(22_000) },
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
    contractJson: JSON.stringify(contributionContract({
      contributionRef: 'contribution:phase2:bytes:4',
      fieldRef: rateField.field_ref,
      contributorParticipantRef: byteRemote.participant_ref,
      targetRef: 'external:bytes:4',
      payload: { text: 'b'.repeat(22_000) },
    })),
  }), 'Contribution byte budget');

  // 12. Ordinary member and contributor are not Admission authorities.
  await expectRejected(() => member.conn.reducers.rejectContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: memberPublic.participant_ref,
    reason: 'unauthorised rejection',
    evidenceJson: '{}',
  }), 'ordinary member Admission decision');
  await expectRejected(() => remoteAgent.conn.reducers.rejectContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: remotePublic.participant_ref,
    reason: 'contributor rejection',
    evidenceJson: '{}',
  }), 'contributor Admission decision');

  // 13. Revoked Admission authority cannot decide.
  const revokedRef = 'contribution:phase2:revoked-admitter';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'revoked-admitter-ingress',
    contractJson: JSON.stringify(contributionContract({
      contributionRef: revokedRef,
      fieldRef: publicField.field_ref,
      contributorParticipantRef: remotePublic.participant_ref,
      targetRef: anchor.ref,
    })),
  });
  const revokedReceipt = await waitUntil(() => receiptFor(remoteAgent, revokedRef), 'revoked-admitter ingress');
  await owner.conn.reducers.revokeParticipantAuthority({
    fieldRef: publicField.field_ref,
    participantRef: revokedAdmitter.participant_ref,
  });
  await expectRejected(() => revokedActor.conn.reducers.admitContribution({
    ingressRef: revokedReceipt.ingressRef,
    admissionParticipantRef: revokedAdmitter.participant_ref,
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'revoked actor attempt',
    evidenceJson: '{}',
  }), 'revoked Admission authority');

  // 14. Finite Admission authority fails on server reducer time after expiry.
  const finiteRef = 'contribution:phase2:finite-admitter';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'finite-admitter-ingress',
    contractJson: JSON.stringify(contributionContract({
      contributionRef: finiteRef,
      fieldRef: publicField.field_ref,
      contributorParticipantRef: remotePublic.participant_ref,
      targetRef: anchor.ref,
    })),
  });
  const finiteReceipt = await waitUntil(() => receiptFor(remoteAgent, finiteRef), 'finite-admitter ingress');
  await sleep(1_150);
  await expectRejected(() => finiteActor.conn.reducers.admitContribution({
    ingressRef: finiteReceipt.ingressRef,
    admissionParticipantRef: finiteAdmitter.participant_ref,
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'expired actor attempt',
    evidenceJson: '{}',
  }), 'expired finite Admission authority');

  // 15-18. Admission != index; explicit index still intersects Phase-1 audience; relations do not leak hidden endpoints.
  await owner.conn.reducers.admitContribution({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'private',
    audienceRefsJson: JSON.stringify([recipientPublic.participant_ref]),
    reason: 'admit as a private contributed difference',
    evidenceJson: JSON.stringify({ schema: 'oi.phase2-evidence/v1', bounded: true }),
  });
  await waitUntil(() => contributionRow(recipient, mainRef), 'admitted private Contribution for named recipient');
  assert.equal(contributionRow(stranger, mainRef), undefined);
  assert.equal(contributionRow(member, mainRef), undefined);
  assert.equal(hasExplore(recipient, mainRef), false, 'Admission alone creates no Explore representation');

  await owner.conn.reducers.setContributionIndexEligibility({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: '',
    eligible: false,
    reason: 'admitted but not yet index eligible',
    evidenceJson: '{}',
  });
  await expectRejected(
    () => owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, exploreEntry(mainRef, 'contribution', 'Index-ineligible Contribution'))),
    'Explore entry while explicitly index-ineligible'
  );
  await expectRejected(() => remoteAgent.conn.reducers.setContributionIndexEligibility({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: remotePublic.participant_ref,
    eligible: true,
    reason: 'sender chooses indexing',
    evidenceJson: '{}',
  }), 'sender-selected index eligibility reducer');

  await owner.conn.reducers.setContributionIndexEligibility({
    ingressRef: mainReceipt.ingressRef,
    admissionParticipantRef: '',
    eligible: true,
    reason: 'receiving field explicitly allows Explore indexing',
    evidenceJson: JSON.stringify({ admission_checked: true }),
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, exploreEntry(mainRef, 'contribution', 'Private indexed Contribution')));
  const hiddenRelationRef = 'relation:phase2:anchor-private-contribution';
  await owner.conn.reducers.putExploreRelation(relationArgs(publicField.field_ref, hiddenRelationRef, anchor.ref, mainRef));
  await waitUntil(() => hasExplore(recipient, mainRef), 'named recipient indexed Contribution');
  await waitUntil(() => hasRelation(recipient, hiddenRelationRef), 'named recipient relation to Contribution');
  assert.equal(hasExplore(member, mainRef), false);
  assert.equal(hasExplore(stranger, mainRef), false);
  assert.equal(hasRelation(member, hiddenRelationRef), false);
  assert.equal(hasRelation(stranger, hiddenRelationRef), false, 'hidden endpoint suppresses relation');

  // 19-20. A2A/transport material enters the same generic quarantine and has no automatic Projection/Action side effect.
  const a2aRef = 'contribution:phase2:a2a-returned-difference';
  const projectionCountBeforeA2a = rows(owner.conn.db.projection).length;
  const watchCountBeforeA2a = rows(owner.conn.db.myWatch).length;
  const contactCountBeforeA2a = rows(owner.conn.db.myContact).length;
  const a2aContract = contributionContract({
    contributionRef: a2aRef,
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    targetRef: anchor.ref,
    payload: { text: 'A2A returned data only' },
    source: {
      transport: 'a2a',
      task_ref: 'a2a:task:phase2',
      message_ref: 'a2a:message:phase2',
      artifact_ref: 'a2a:artifact:phase2',
    },
  });
  await owner.conn.reducers.ingestTransportedContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    sourceKind: 'a2a',
    transportProvider: 'a2a-v1',
    transportMessageId: 'a2a-return-1',
    contractJson: JSON.stringify(a2aContract),
  });
  const a2aReceipt = await waitUntil(() => receiptFor(owner, a2aRef), 'A2A generic quarantine receipt');
  assert.equal(a2aReceipt.state, 'quarantined');
  assert.equal(contributionRow(stranger, a2aRef), undefined);
  assert.equal(hasExplore(stranger, a2aRef), false);
  assert.equal(rows(owner.conn.db.projection).length, projectionCountBeforeA2a, 'A2A ingress creates no Projection');
  assert.equal(rows(owner.conn.db.myWatch).length, watchCountBeforeA2a, 'A2A ingress creates no Watch');
  assert.equal(rows(owner.conn.db.myContact).length, contactCountBeforeA2a, 'A2A ingress creates no Contact/exchange');

  // 21. Reject and withdraw remove/currently suppress all index material.
  const rejectedRef = 'contribution:phase2:rejected';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'rejected-ingress',
    contractJson: JSON.stringify(contributionContract({
      contributionRef: rejectedRef,
      fieldRef: publicField.field_ref,
      contributorParticipantRef: remotePublic.participant_ref,
      targetRef: anchor.ref,
    })),
  });
  const rejectedReceipt = await waitUntil(() => receiptFor(remoteAgent, rejectedRef), 'rejected ingress receipt');
  await owner.conn.reducers.rejectContribution({
    ingressRef: rejectedReceipt.ingressRef,
    admissionParticipantRef: '',
    reason: 'fixture rejection',
    evidenceJson: '{}',
  });
  await waitUntil(() => receiptFor(remoteAgent, rejectedRef)?.state === 'rejected', 'sender rejected status');
  assert.equal(contributionRow(stranger, rejectedRef), undefined);
  assert.equal(hasExplore(stranger, rejectedRef), false);

  const withdrawnRef = 'contribution:phase2:withdrawn-public';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: publicField.field_ref,
    contributorParticipantRef: remotePublic.participant_ref,
    transportMessageId: 'withdrawn-ingress',
    contractJson: JSON.stringify(contributionContract({
      contributionRef: withdrawnRef,
      fieldRef: publicField.field_ref,
      contributorParticipantRef: remotePublic.participant_ref,
      targetRef: anchor.ref,
    })),
  });
  const withdrawnReceipt = await waitUntil(() => receiptFor(remoteAgent, withdrawnRef), 'withdrawn ingress receipt');
  await owner.conn.reducers.admitContribution({
    ingressRef: withdrawnReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'temporary public admission',
    evidenceJson: '{}',
  });
  await owner.conn.reducers.setContributionIndexEligibility({
    ingressRef: withdrawnReceipt.ingressRef,
    admissionParticipantRef: '',
    eligible: true,
    reason: 'temporary index eligibility',
    evidenceJson: '{}',
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(publicField.field_ref, exploreEntry(withdrawnRef, 'contribution', 'Withdrawable Contribution')));
  await waitUntil(() => hasExplore(stranger, withdrawnRef), 'public Contribution before withdrawal');
  await owner.conn.reducers.withdrawContribution({
    ingressRef: withdrawnReceipt.ingressRef,
    admissionParticipantRef: '',
    reason: 'fixture withdrawal',
    evidenceJson: '{}',
  });
  await waitUntil(() => !hasExplore(stranger, withdrawnRef), 'withdrawal removes current Explore entry');
  assert.equal(contributionRow(stranger, withdrawnRef), undefined);

  // 22. Private admitted/index-eligible Contributions remain absent for ordinary members outside the explicit private audience.
  const privateRef = 'contribution:phase2:private-field';
  const privateContract = contributionContract({
    contributionRef: privateRef,
    fieldRef: privateField.field_ref,
    contributorParticipantRef: remotePrivate.participant_ref,
    targetRef: 'external:private-target',
    payload: { secret: 'PRIVATE-CONTRIBUTION-SENTINEL' },
  });
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: privateField.field_ref,
    contributorParticipantRef: remotePrivate.participant_ref,
    transportMessageId: 'private-field-ingress',
    contractJson: JSON.stringify(privateContract),
  });
  const privateReceipt = await waitUntil(() => receiptFor(remoteAgent, privateRef), 'private field ingress');
  await owner.conn.reducers.admitContribution({
    ingressRef: privateReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'private',
    audienceRefsJson: JSON.stringify([recipientPrivate.participant_ref]),
    reason: 'private field private audience',
    evidenceJson: '{}',
  });
  await owner.conn.reducers.setContributionIndexEligibility({
    ingressRef: privateReceipt.ingressRef,
    admissionParticipantRef: '',
    eligible: true,
    reason: 'private index eligible but still audience protected',
    evidenceJson: '{}',
  });
  await owner.conn.reducers.putExploreEntry(exploreArgs(privateField.field_ref, exploreEntry(privateRef, 'contribution', 'Private field Contribution')));
  await waitUntil(() => hasExplore(recipient, privateRef), 'explicit private recipient Contribution');
  assert.equal(hasExplore(member, privateRef), false, 'ordinary private-field member stays outside private audience');
  assert.equal(contributionRow(member, privateRef), undefined);
  assert.equal(JSON.stringify({ contributions: rows(member.conn.db.contribution), entries: rows(member.conn.db.exploreEntry) }).includes('PRIVATE-CONTRIBUTION-SENTINEL'), false);

  // Private SharedField cannot be widened even by an authorised receiving actor.
  const privateWidenRef = 'contribution:phase2:private-widen';
  await remoteAgent.conn.reducers.submitContribution({
    fieldRef: privateField.field_ref,
    contributorParticipantRef: remotePrivate.participant_ref,
    transportMessageId: 'private-widen-ingress',
    contractJson: JSON.stringify(contributionContract({
      contributionRef: privateWidenRef,
      fieldRef: privateField.field_ref,
      contributorParticipantRef: remotePrivate.participant_ref,
      targetRef: 'external:private-widen',
    })),
  });
  const privateWidenReceipt = await waitUntil(() => receiptFor(remoteAgent, privateWidenRef), 'private widen ingress');
  await expectRejected(() => owner.conn.reducers.admitContribution({
    ingressRef: privateWidenReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'public',
    audienceRefsJson: '[]',
    reason: 'attempt to widen private field',
    evidenceJson: '{}',
  }), 'private-field to public Contribution widening');
  await expectRejected(() => owner.conn.reducers.admitContribution({
    ingressRef: privateWidenReceipt.ingressRef,
    admissionParticipantRef: '',
    visibility: 'private',
    audienceRefsJson: JSON.stringify([foreignParticipant.participant_ref]),
    reason: 'cross-field Contribution audience',
    evidenceJson: '{}',
  }), 'cross-field Contribution audience ref');

  // 23. Reconnect/rebuild cannot resurrect rejected/withdrawn/quarantined/hidden material.
  stranger.conn.disconnect();
  reconnectedStranger = await connect('STRANGER_RECONNECTED', stranger.token);
  assert.equal(reconnectedStranger.identity.toHexString(), stranger.identity.toHexString());
  await subscribe(reconnectedStranger.conn, [...publicQueries, ...privateViews]);
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
      conflicting_transport_replay: 'denied_no_overwrite',
      malformed_oversized_rate_byte_outstanding: 'bounded',
      receiving_admission_authority: 'required',
      revoked_admission_authority: 'denied',
      finite_admission_authority_after_expiry: 'denied_by_reducer_time',
      admission_auto_explore: 'zero',
      admitted_index_ineligible_explore: 'zero',
      admitted_index_eligible_caller_visibility: 'phase1_intersection',
      hidden_relation_endpoint: 'zero',
      a2a_returned_difference_auto_promotion: 'zero',
      ingress_admission_execution_side_effect: 'zero_module_action_projection_watch_contact',
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
