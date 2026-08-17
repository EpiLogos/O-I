import assert from 'node:assert/strict';
import { DbConnection } from './module_bindings/index';
import { createParticipant } from '../index.mjs';
import { createContribution } from '../social.mjs';

const URI = process.env.SPACETIMEDB_URI ?? 'ws://127.0.0.1:3000';
const DATABASE = process.env.SPACETIMEDB_DATABASE ?? 'oi-shared-field-ci';
const TIMEOUT_MS = 10_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    conn.subscriptionBuilder().onApplied(() => resolve()).onError((_ctx, error) => reject(error)).subscribe(queries);
  });
}

async function waitUntil<T>(read: () => T | undefined | false, description: string): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const value = read();
    if (value) return value as T;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${description}`);
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
function participant(fieldRef: string, suffix: string, kind = 'agent') {
  return createParticipant({
    participant_ref: `participant:phase3:${suffix}`,
    field_ref: fieldRef,
    identity: { kind, ref: `${kind}:phase3:${suffix}` },
    presentation: { world_ref: `world:phase3:${suffix}` },
    provenance: { source_system: 'o-i', source_revision: `phase3:${suffix}@1` },
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
function requestArgs(input: {
  requestRef: string; fieldRef: string; initiator: string; counterparty: string;
  protocol?: string; bindingRef?: string; bindingRevision?: number; modes?: string[];
  maxUses?: number; ttlSeconds?: number; purpose?: string; scope?: Record<string, unknown>;
}) {
  return {
    requestRef: input.requestRef,
    fieldRef: input.fieldRef,
    initiatorParticipantRef: input.initiator,
    counterpartyParticipantRef: input.counterparty,
    purpose: input.purpose ?? 'phase3-authorised-exchange',
    scopeJson: JSON.stringify(input.scope ?? { kind: 'message', topic: 'phase3-fixture' }),
    protocol: input.protocol ?? 'a2a',
    bindingRef: input.bindingRef ?? 'a2a-binding:phase3:remote',
    bindingRevision: input.bindingRevision ?? 1,
    modesJson: JSON.stringify(input.modes ?? ['message:send']),
    maxUses: input.maxUses ?? 2,
    ttlSeconds: input.ttlSeconds ?? 300,
  };
}
function useArgs(input: {
  grantRef: string; operationId: string; fieldRef: string; initiator: string; counterparty: string;
  protocol?: string; bindingRef?: string; bindingRevision?: number; mode?: string; purpose?: string;
}) {
  return {
    grantRef: input.grantRef,
    operationId: input.operationId,
    fieldRef: input.fieldRef,
    initiatorParticipantRef: input.initiator,
    counterpartyParticipantRef: input.counterparty,
    protocol: input.protocol ?? 'a2a',
    bindingRef: input.bindingRef ?? 'a2a-binding:phase3:remote',
    bindingRevision: input.bindingRevision ?? 1,
    mode: input.mode ?? 'message:send',
    purpose: input.purpose ?? 'phase3-authorised-exchange',
  };
}

const FIELD = 'oi:field:phase3-exchange';
const FOREIGN_FIELD = 'oi:field:phase3-foreign';
const clients = await Promise.all([
  connect('OWNER'), connect('INITIATOR'), connect('COUNTERPARTY'), connect('MEMBER'),
  connect('STRANGER'), connect('REVOKED_ACTOR'), connect('FINITE_ACTOR'),
]);
const [owner, initiator, counterparty, member, stranger, revokedActor, finiteActor] = clients;
let reconnectedInitiator: Client | undefined;

const field = {
  schema: 'oi.shared-field/v1', field_ref: FIELD, kind: 'public', visibility: 'public', title: 'Phase 3 Exchange Authority',
  provenance: [{ kind: 'security-fixture', ref: FIELD, source_system: 'o-i', revision: `${FIELD}@1` }],
};
const foreignField = {
  schema: 'oi.shared-field/v1', field_ref: FOREIGN_FIELD, kind: 'public', visibility: 'public', title: 'Phase 3 Foreign',
  provenance: [{ kind: 'security-fixture', ref: FOREIGN_FIELD, source_system: 'o-i', revision: `${FOREIGN_FIELD}@1` }],
};

try {
  assert.equal(new Set(clients.map(client => client.identity.toHexString())).size, clients.length);
  for (const client of clients) {
    await subscribe(client.conn, [
      'SELECT * FROM shared_field', 'SELECT * FROM participant', 'SELECT * FROM projection',
      'SELECT * FROM contribution', 'SELECT * FROM explore_entry', 'SELECT * FROM explore_relation',
      'SELECT * FROM my_field_authority', 'SELECT * FROM my_contact', 'SELECT * FROM my_contribution_receipt',
    ]);
  }

  // 1-2. Exchange request/grant/use audit state is private and cannot be enumerated by unrelated callers.
  for (const tableName of ['exchange_request', 'exchange_grant', 'exchange_use']) {
    await expectSubscriptionDenied(stranger.conn, tableName);
  }

  await owner.conn.reducers.putSharedField({ fieldRef: FIELD, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) });
  await stranger.conn.reducers.putSharedField({ fieldRef: FOREIGN_FIELD, kind: foreignField.kind, visibility: foreignField.visibility, contractJson: JSON.stringify(foreignField) });

  const pInitiator = participant(FIELD, 'initiator', 'human');
  const pCounterparty = participant(FIELD, 'counterparty');
  const pMember = participant(FIELD, 'member', 'human');
  const pRevoked = participant(FIELD, 'revoked', 'human');
  const pFinite = participant(FIELD, 'finite', 'human');
  const pForeign = participant(FOREIGN_FIELD, 'foreign');
  for (const value of [pInitiator, pCounterparty, pMember, pRevoked, pFinite]) await owner.conn.reducers.putParticipant(participantArgs(value));
  await stranger.conn.reducers.putParticipant(participantArgs(pForeign));

  for (const grant of [
    { fieldRef: FIELD, participantRef: pInitiator.participant_ref, targetIdentity: initiator.identity, role: 'contributor', contactable: true, ttlSeconds: 0 },
    { fieldRef: FIELD, participantRef: pCounterparty.participant_ref, targetIdentity: counterparty.identity, role: 'contributor', contactable: true, ttlSeconds: 0 },
    { fieldRef: FIELD, participantRef: pMember.participant_ref, targetIdentity: member.identity, role: 'observer', contactable: false, ttlSeconds: 0 },
    { fieldRef: FIELD, participantRef: pRevoked.participant_ref, targetIdentity: revokedActor.identity, role: 'contributor', contactable: true, ttlSeconds: 0 },
    { fieldRef: FIELD, participantRef: pFinite.participant_ref, targetIdentity: finiteActor.identity, role: 'contributor', contactable: true, ttlSeconds: 1 },
  ]) await owner.conn.reducers.grantParticipantAuthority(grant);

  // 3. Published reachability / field participation without a grant cannot be used as Exchange authority.
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({
    grantRef: 'exchange-grant:missing', operationId: 'op:no-grant', fieldRef: FIELD,
    initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref,
  })), 'missing Exchange grant');

  // 4. Accepted Contact remains only Contact, not Exchange.
  await initiator.conn.reducers.requestContact({
    contactRef: 'contact:phase3:accepted', fieldRef: FIELD,
    initiatorParticipantRef: pInitiator.participant_ref, recipientParticipantRef: pCounterparty.participant_ref,
    purpose: 'establish contact only', requestedScopeJson: JSON.stringify({ mode: 'conversation' }), ttlSeconds: 300,
    provenanceJson: JSON.stringify({ kind: 'phase3-fixture', ref: 'contact:phase3:accepted' }),
  });
  await counterparty.conn.reducers.respondContact({
    contactRef: 'contact:phase3:accepted', recipientParticipantRef: pCounterparty.participant_ref,
    decision: 'accepted', responseJson: JSON.stringify({ accepted: true }),
  });
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({
    grantRef: 'exchange-grant:contact-is-not-grant', operationId: 'op:contact', fieldRef: FIELD,
    initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref,
  })), 'accepted Contact without Exchange grant');

  const mainRequest = 'exchange-request:phase3:main';
  const mainGrant = 'exchange-grant:phase3:main';
  await initiator.conn.reducers.requestExchange(requestArgs({
    requestRef: mainRequest, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref,
  }));

  // 5. Requesting actor / ordinary member cannot self-approve a grant.
  await expectRejected(() => initiator.conn.reducers.grantExchange({
    requestRef: mainRequest, grantRef: mainGrant, reason: 'self mint', evidenceJson: JSON.stringify({ attack: true }),
  }), 'self-issued Exchange grant');
  await owner.conn.reducers.grantExchange({
    requestRef: mainRequest, grantRef: mainGrant, reason: 'explicit field-side grant', evidenceJson: JSON.stringify({ reviewed: true }),
  });

  const publicBefore = {
    contribution: rows(owner.conn.db.contribution).length,
    projection: rows(owner.conn.db.projection).length,
    explore: rows(owner.conn.db.exploreEntry).length,
  };

  // 6-12. Grant scope binds actor, field, counterparty, protocol, binding lineage, mode and purpose.
  await expectRejected(() => member.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-actor', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref })), 'wrong runtime actor');
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-field', fieldRef: FOREIGN_FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref })), 'wrong SharedField');
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-counterparty', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pMember.participant_ref })), 'wrong counterparty');
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-protocol', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, protocol: 'mcp' })), 'wrong protocol');
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-binding', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, bindingRef: 'a2a-binding:phase3:attacker' })), 'wrong endpoint binding');
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-revision', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, bindingRevision: 2 })), 'replacement endpoint revision without new authority');
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:wrong-purpose', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, purpose: 'expanded-purpose' })), 'purpose widening');

  // 13-15. Correct use succeeds, exact replay is idempotent, N-use exhaustion is enforced.
  const op1 = useArgs({ grantRef: mainGrant, operationId: 'op:main:1', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref });
  await initiator.conn.reducers.consumeExchange(op1);
  await initiator.conn.reducers.consumeExchange(op1);
  await initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:main:2', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref }));
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:main:3', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref })), 'exhausted grant');

  // Granting and consuming exchange authority alone creates no Contribution / Projection / Explore state.
  assert.deepEqual({
    contribution: rows(owner.conn.db.contribution).length,
    projection: rows(owner.conn.db.projection).length,
    explore: rows(owner.conn.db.exploreEntry).length,
  }, publicBefore);

  // 16. Same request ref with conflicting scope is replay/conflict denied.
  await expectRejected(() => initiator.conn.reducers.requestExchange(requestArgs({
    requestRef: mainRequest, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref,
    purpose: 'conflicting-purpose',
  })), 'conflicting Exchange request replay');

  // 17. Explicit revocation terminates authority.
  const revokeRequest = 'exchange-request:phase3:revoke';
  const revokeGrant = 'exchange-grant:phase3:revoke';
  await initiator.conn.reducers.requestExchange(requestArgs({ requestRef: revokeRequest, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, maxUses: 3 }));
  await owner.conn.reducers.grantExchange({ requestRef: revokeRequest, grantRef: revokeGrant, reason: 'grant then revoke', evidenceJson: '{}' });
  await counterparty.conn.reducers.revokeExchange({ grantRef: revokeGrant, reason: 'counterparty revoked' });
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: revokeGrant, operationId: 'op:revoked', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref })), 'revoked grant');

  // 18. Contact block/mute policy terminates a live grant.
  const policyRequest = 'exchange-request:phase3:policy';
  const policyGrant = 'exchange-grant:phase3:policy';
  await initiator.conn.reducers.requestExchange(requestArgs({ requestRef: policyRequest, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, maxUses: 3 }));
  await owner.conn.reducers.grantExchange({ requestRef: policyRequest, grantRef: policyGrant, reason: 'policy proof', evidenceJson: '{}' });
  await counterparty.conn.reducers.setContactPolicy({ fieldRef: FIELD, blockerParticipantRef: pCounterparty.participant_ref, blockedParticipantRef: pInitiator.participant_ref, mode: 'blocked' });
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({ grantRef: policyGrant, operationId: 'op:blocked', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref })), 'blocked relation');
  await counterparty.conn.reducers.setContactPolicy({ fieldRef: FIELD, blockerParticipantRef: pCounterparty.participant_ref, blockedParticipantRef: pInitiator.participant_ref, mode: 'clear' });

  // 19. Revoking the initiator's participant authority terminates outstanding Exchange authority.
  const participantRequest = 'exchange-request:phase3:participant-revoke';
  const participantGrant = 'exchange-grant:phase3:participant-revoke';
  await revokedActor.conn.reducers.requestExchange(requestArgs({ requestRef: participantRequest, fieldRef: FIELD, initiator: pRevoked.participant_ref, counterparty: pCounterparty.participant_ref }));
  await owner.conn.reducers.grantExchange({ requestRef: participantRequest, grantRef: participantGrant, reason: 'participant revocation proof', evidenceJson: '{}' });
  await owner.conn.reducers.revokeParticipantAuthority({ fieldRef: FIELD, participantRef: pRevoked.participant_ref });
  await expectRejected(() => revokedActor.conn.reducers.consumeExchange(useArgs({ grantRef: participantGrant, operationId: 'op:participant-revoked', fieldRef: FIELD, initiator: pRevoked.participant_ref, counterparty: pCounterparty.participant_ref })), 'revoked participant authority');

  // 20. Server-time expiry of the underlying actor authority fails closed.
  const finiteRequest = 'exchange-request:phase3:finite';
  const finiteGrant = 'exchange-grant:phase3:finite';
  await finiteActor.conn.reducers.requestExchange(requestArgs({ requestRef: finiteRequest, fieldRef: FIELD, initiator: pFinite.participant_ref, counterparty: pCounterparty.participant_ref, ttlSeconds: 300 }));
  await owner.conn.reducers.grantExchange({ requestRef: finiteRequest, grantRef: finiteGrant, reason: 'finite actor proof', evidenceJson: '{}' });
  await sleep(1_150);
  await expectRejected(() => finiteActor.conn.reducers.consumeExchange(useArgs({ grantRef: finiteGrant, operationId: 'op:finite', fieldRef: FIELD, initiator: pFinite.participant_ref, counterparty: pCounterparty.participant_ref })), 'expired participant authority');

  // 21. Protocol-agnostic transfer authority does not become MCP tool invocation authority.
  const mcpRequest = 'exchange-request:phase3:mcp';
  const mcpGrant = 'exchange-grant:phase3:mcp';
  await initiator.conn.reducers.requestExchange(requestArgs({
    requestRef: mcpRequest, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref,
    protocol: 'mcp', bindingRef: 'mcp-binding:phase3:remote', modes: ['data'], maxUses: 1,
  }));
  await owner.conn.reducers.grantExchange({ requestRef: mcpRequest, grantRef: mcpGrant, reason: 'tool-neutral data exchange only', evidenceJson: '{}' });
  await expectRejected(() => initiator.conn.reducers.consumeExchange(useArgs({
    grantRef: mcpGrant, operationId: 'op:mcp-tool-call', fieldRef: FIELD, initiator: pInitiator.participant_ref,
    counterparty: pCounterparty.participant_ref, protocol: 'mcp', bindingRef: 'mcp-binding:phase3:remote', mode: 'tool:call',
  })), 'MCP tool invocation widening');
  await initiator.conn.reducers.consumeExchange(useArgs({
    grantRef: mcpGrant, operationId: 'op:mcp-data', fieldRef: FIELD, initiator: pInitiator.participant_ref,
    counterparty: pCounterparty.participant_ref, protocol: 'mcp', bindingRef: 'mcp-binding:phase3:remote', mode: 'data',
  }));

  // 22-23. An authorised exchange return still enters generic Phase-2 quarantine and exact retry is idempotent.
  const returnRequest = 'exchange-request:phase3:return';
  const returnGrant = 'exchange-grant:phase3:return';
  const returnOperation = 'op:phase3:return';
  await initiator.conn.reducers.requestExchange(requestArgs({ requestRef: returnRequest, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref, maxUses: 1 }));
  await owner.conn.reducers.grantExchange({ requestRef: returnRequest, grantRef: returnGrant, reason: 'authorise returned data', evidenceJson: '{}' });
  await initiator.conn.reducers.consumeExchange(useArgs({ grantRef: returnGrant, operationId: returnOperation, fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref }));

  const returned = createContribution({
    contribution_ref: 'contribution:phase3:authorised-return', field_ref: FIELD,
    contributor_participant_ref: pCounterparty.participant_ref, created_at: '2026-08-17T11:00:00.000Z', mode: 'finding',
    target: { ref: FIELD, kind: 'shared-field' }, relation: { kind: 'returned-difference' },
    representation: { kind: 'json', payload: { untrusted: true, source: 'authorised-exchange' } },
    provenance: [{ kind: 'a2a-exchange', ref: returnOperation, source_system: 'A2A', revision: '1' }],
  });
  const ingressArgs = {
    grantRef: returnGrant, operationId: returnOperation, fieldRef: FIELD,
    contributorParticipantRef: pCounterparty.participant_ref, sourceKind: 'a2a', transportProvider: 'A2A HTTP+JSON v1',
    transportMessageId: 'transport:phase3:return:1', contractJson: JSON.stringify(returned),
  };
  await owner.conn.reducers.ingestAuthorizedExchangeContribution(ingressArgs);
  await owner.conn.reducers.ingestAuthorizedExchangeContribution(ingressArgs);
  const receipt = await waitUntil(() => rows(owner.conn.db.myContributionReceipt).find(row => row.contributionRef === returned.contribution_ref), 'authorised return quarantine receipt');
  assert.equal(receipt.state, 'quarantined');
  assert.equal(rows(owner.conn.db.myContributionReceipt).filter(row => row.contributionRef === returned.contribution_ref).length, 1);
  assert.equal(rows(owner.conn.db.contribution).some(row => row.contributionRef === returned.contribution_ref), false, 'authorised return is not admitted automatically');
  assert.equal(rows(owner.conn.db.exploreEntry).some(row => row.semanticRef === returned.contribution_ref), false, 'authorised return is not indexed automatically');
  await expectRejected(() => owner.conn.reducers.ingestAuthorizedExchangeContribution({ ...ingressArgs, operationId: 'op:unknown' }), 'return without matching consumed exchange use');

  // 24. Reconnect/rebuild does not resurrect exhausted authority or expose an Exchange read surface.
  const initiatorToken = initiator.token;
  initiator.conn.disconnect();
  reconnectedInitiator = await connect('INITIATOR_RECONNECTED', initiatorToken);
  await subscribe(reconnectedInitiator.conn, ['SELECT * FROM shared_field', 'SELECT * FROM my_field_authority']);
  await expectRejected(() => reconnectedInitiator!.conn.reducers.consumeExchange(useArgs({ grantRef: mainGrant, operationId: 'op:after-reconnect', fieldRef: FIELD, initiator: pInitiator.participant_ref, counterparty: pCounterparty.participant_ref })), 'exhausted grant after reconnect');

  console.log(JSON.stringify({
    proof: 'oi-exchange-authority-phase3/v1',
    spacetimedb: '2.8.1',
    database: DATABASE,
    cases: 24,
    private_audit_tables: ['exchange_request', 'exchange_grant', 'exchange_use'],
    contact_is_exchange: false,
    admission_is_exchange: false,
    exchange_is_execution: false,
    a2a_return_state: 'quarantined',
    mcp_tool_invocation_authority: false,
  }, null, 2));
} finally {
  for (const client of clients) {
    try { client.conn.disconnect(); } catch {}
  }
  try { reconnectedInitiator?.conn.disconnect(); } catch {}
}
