import { schema, table, t, SenderError } from 'spacetimedb/server';

const CONTACT_WINDOW_MICROS = 60_000_000n;
const CONTACT_LIMIT_PER_WINDOW = 3;
const CONTACT_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;

const sharedField = table(
  { public: true },
  {
    rowId: t.u64().primaryKey().autoInc(),
    fieldRef: t.string().unique(),
    kind: t.string(),
    visibility: t.string(),
    contractJson: t.string(),
  }
);

const fieldOwner = table(
  { public: false },
  {
    fieldRef: t.string().primaryKey(),
    ownerIdentity: t.identity().index('btree'),
    createdAtMicros: t.u64(),
  }
);

const fieldAuthority = table(
  { public: false },
  {
    authorityKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    participantRef: t.string().index('btree'),
    actorIdentity: t.identity().index('btree'),
    role: t.string(),
    contactable: t.bool(),
    revoked: t.bool(),
    expiresAtMicros: t.u64(),
    grantedAtMicros: t.u64(),
  }
);

const participant = table(
  { public: true },
  {
    rowId: t.u64().primaryKey().autoInc(),
    participantRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    identityKind: t.string(),
    identityRef: t.string().index('btree'),
    sourceSystem: t.string(),
    sourceRevision: t.string(),
    contractJson: t.string(),
  }
);

const projection = table(
  { public: true },
  {
    rowId: t.u64().primaryKey().autoInc(),
    projectionKey: t.string().unique(),
    fieldRef: t.string().index('btree'),
    projectionRef: t.string().index('btree'),
    projectionRevision: t.u32(),
    sourceRevision: t.string(),
    publisherParticipantRef: t.string().index('btree'),
    state: t.string(),
    contractJson: t.string(),
  }
);

const exploreEntry = table(
  { public: true },
  {
    rowId: t.u64().primaryKey().autoInc(),
    semanticRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    worldRef: t.string().index('btree'),
    kind: t.string().index('btree'),
    label: t.string(),
    revision: t.string(),
    entryJson: t.string(),
  }
);

const exploreRelation = table(
  { public: true },
  {
    rowId: t.u64().primaryKey().autoInc(),
    relationRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    fromRef: t.string().index('btree'),
    toRef: t.string().index('btree'),
    relation: t.string().index('btree'),
    origin: t.string(),
    relationJson: t.string(),
  }
);

const watch = table(
  { public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    watchRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    watcherParticipantRef: t.string().index('btree'),
    targetKind: t.string().index('btree'),
    targetRef: t.string().index('btree'),
    state: t.string(),
    contractJson: t.string(),
  }
);

const contact = table(
  { public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    contactRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    initiatorParticipantRef: t.string().index('btree'),
    recipientParticipantRef: t.string().index('btree'),
    state: t.string(),
    purpose: t.string(),
    requestedScopeJson: t.string(),
    createdAtMicros: t.u64(),
    expiresAtMicros: t.u64(),
    responseJson: t.string(),
    provenanceJson: t.string(),
    contractJson: t.string(),
  }
);

const contactPolicy = table(
  { public: false },
  {
    policyKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    blockerParticipantRef: t.string().index('btree'),
    blockedParticipantRef: t.string().index('btree'),
    mode: t.string(),
    updatedAtMicros: t.u64(),
  }
);

const contactRate = table(
  { public: false },
  {
    rateKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    initiatorParticipantRef: t.string().index('btree'),
    windowStartedMicros: t.u64(),
    count: t.u32(),
  }
);

const spacetimedb = schema({
  sharedField,
  fieldOwner,
  fieldAuthority,
  participant,
  projection,
  exploreEntry,
  exploreRelation,
  watch,
  contact,
  contactPolicy,
  contactRate,
});

export default spacetimedb;

/**
 * Private relationship Views deliberately admit only non-expiring grants.
 *
 * SpaceTimeDB 2.8.1 reducer-time expiry is proven below, but its documented one-shot
 * scheduler did not execute reproducibly under the pinned standalone CI runtime. A
 * finite grant therefore never becomes a private-read entitlement: it can exercise
 * reducers until server-time expiry, but Watch/Contact disclosure requires a persistent
 * grant which can be explicitly revoked. This is fail-closed until timed View revocation
 * is proven on the deployed provider.
 */
function privateReadCallerGrants(ctx: any): any[] {
  return Array.from(ctx.db.fieldAuthority.actorIdentity.filter(ctx.sender)).filter(
    (grant: any) => !grant.revoked && grant.expiresAtMicros === 0n
  );
}

export const my_field_authority = spacetimedb.view(
  { name: 'my_field_authority', public: true },
  t.array(fieldAuthority.rowType),
  (ctx) => privateReadCallerGrants(ctx)
);

export const my_watch = spacetimedb.view(
  { name: 'my_watch', public: true },
  t.array(watch.rowType),
  (ctx) => {
    const rows = new Map<string, any>();
    for (const grant of privateReadCallerGrants(ctx)) {
      for (const row of ctx.db.watch.watcherParticipantRef.filter(grant.participantRef)) {
        if (row.fieldRef === grant.fieldRef) rows.set(String(row.rowId), row);
      }
    }
    return Array.from(rows.values());
  }
);

export const my_contact = spacetimedb.view(
  { name: 'my_contact', public: true },
  t.array(contact.rowType),
  (ctx) => {
    const rows = new Map<string, any>();
    for (const grant of privateReadCallerGrants(ctx)) {
      for (const row of ctx.db.contact.initiatorParticipantRef.filter(grant.participantRef)) {
        if (row.fieldRef === grant.fieldRef) rows.set(String(row.rowId), row);
      }
      for (const row of ctx.db.contact.recipientParticipantRef.filter(grant.participantRef)) {
        if (row.fieldRef === grant.fieldRef) rows.set(String(row.rowId), row);
      }
    }
    return Array.from(rows.values());
  }
);

function fail(message: string): never {
  throw new SenderError(message);
}

function requireString(value: string, name: string, max = 512): void {
  if (value.trim() === '') fail(`${name} must be non-empty`);
  if (value.length > max) fail(`${name} must be at most ${max} characters`);
}

function requireJsonObject(value: string, name: string, max = 65_536): Record<string, any> {
  if (value.trim() === '') fail(`${name} must be non-empty JSON`);
  if (value.length > max) fail(`${name} exceeds ${max} character limit`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail(`${name} must contain valid JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`${name} must contain a JSON object`);
  }
  return parsed as Record<string, any>;
}

function requireEqual(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) fail(`${name} does not match semantic contract`);
}

function nowMicros(ctx: any): bigint {
  return ctx.timestamp.microsSinceUnixEpoch;
}

function authorityKey(fieldRef: string, participantRef: string): string {
  return `${fieldRef}|${participantRef}`;
}

function contactPolicyKey(fieldRef: string, blockerParticipantRef: string, blockedParticipantRef: string): string {
  return `${fieldRef}|${blockerParticipantRef}|${blockedParticipantRef}`;
}

function contactRateKey(fieldRef: string, initiatorParticipantRef: string): string {
  return `${fieldRef}|${initiatorParticipantRef}`;
}

function isFieldOwner(ctx: any, fieldRef: string): boolean {
  for (const owned of ctx.db.fieldOwner.ownerIdentity.filter(ctx.sender)) {
    if (owned.fieldRef === fieldRef) return true;
  }
  return false;
}

function requireFieldOwner(ctx: any, fieldRef: string): void {
  if (!isFieldOwner(ctx, fieldRef)) fail(`Caller is not owner of SharedField ${fieldRef}`);
}

function requireParticipantInField(ctx: any, participantRef: string, fieldRef: string): any {
  const participantRow = ctx.db.participant.participantRef.find(participantRef);
  if (!participantRow || participantRow.fieldRef !== fieldRef) {
    fail(`Participant ${participantRef} does not belong to SharedField ${fieldRef}`);
  }
  return participantRow;
}

function requireRole(role: string): void {
  if (!['observer', 'contact', 'contributor'].includes(role)) fail(`Unsupported authority role: ${role}`);
}

function requireWatchState(state: string): void {
  if (!['active', 'paused'].includes(state)) fail(`Unsupported Watch state: ${state}`);
}

function requireContactDecision(decision: string): void {
  if (!['accepted', 'declined', 'redirected', 'narrowed'].includes(decision)) {
    fail(`Unsupported Contact decision: ${decision}`);
  }
}

function requireParticipantAuthority(ctx: any, fieldRef: string, participantRef: string, roles: string[]): any {
  const key = authorityKey(fieldRef, participantRef);
  const grant = ctx.db.fieldAuthority.authorityKey.find(key);
  if (!grant) fail(`No authority grant for Participant ${participantRef}`);

  let callerOwnsGrant = false;
  for (const row of ctx.db.fieldAuthority.actorIdentity.filter(ctx.sender)) {
    if (row.authorityKey === key) {
      callerOwnsGrant = true;
      break;
    }
  }
  if (!callerOwnsGrant) fail(`Caller is not bound to Participant ${participantRef}`);
  if (grant.revoked) fail(`Authority for Participant ${participantRef} is revoked`);
  if (grant.expiresAtMicros !== 0n && nowMicros(ctx) >= grant.expiresAtMicros) {
    fail(`Authority for Participant ${participantRef} is expired`);
  }
  if (!roles.includes(grant.role)) fail(`Participant ${participantRef} lacks required role`);
  return grant;
}

function authorityForContactRecipient(ctx: any, fieldRef: string, participantRef: string): any {
  const grant = ctx.db.fieldAuthority.authorityKey.find(authorityKey(fieldRef, participantRef));
  if (!grant || grant.revoked || !grant.contactable) fail(`Recipient Participant ${participantRef} is not contactable`);
  if (grant.expiresAtMicros !== 0n && nowMicros(ctx) >= grant.expiresAtMicros) {
    fail(`Recipient Participant ${participantRef} is not contactable`);
  }
  return grant;
}

function contactContract(row: any): string {
  const requestedScope = requireJsonObject(row.requestedScopeJson, 'Contact requested scope', 4_096);
  const provenance = requireJsonObject(row.provenanceJson, 'Contact provenance', 4_096);
  const response = row.responseJson === '' ? undefined : requireJsonObject(row.responseJson, 'Contact response', 4_096);
  return JSON.stringify({
    schema: 'oi.contact/v1',
    contact_ref: row.contactRef,
    field_ref: row.fieldRef,
    initiator_participant_ref: row.initiatorParticipantRef,
    recipient_participant_ref: row.recipientParticipantRef,
    state: row.state,
    purpose: row.purpose,
    requested_scope: requestedScope,
    timing: {
      created_micros: String(row.createdAtMicros),
      expires_micros: String(row.expiresAtMicros),
    },
    ...(response === undefined ? {} : { response }),
    provenance,
  });
}

function enforceContactRate(ctx: any, fieldRef: string, initiatorParticipantRef: string): void {
  const now = nowMicros(ctx);
  const key = contactRateKey(fieldRef, initiatorParticipantRef);
  const current = ctx.db.contactRate.rateKey.find(key);
  if (!current || now - current.windowStartedMicros >= CONTACT_WINDOW_MICROS) {
    const next = {
      rateKey: key,
      fieldRef,
      initiatorParticipantRef,
      windowStartedMicros: now,
      count: 1,
    };
    if (current) ctx.db.contactRate.rateKey.update(next);
    else ctx.db.contactRate.insert(next);
    return;
  }
  if (current.count >= CONTACT_LIMIT_PER_WINDOW) {
    fail(`Contact rate limit exceeded for ${initiatorParticipantRef} in ${fieldRef}`);
  }
  ctx.db.contactRate.rateKey.update({ ...current, count: current.count + 1 });
}

export const put_shared_field = spacetimedb.reducer(
  { fieldRef: t.string(), kind: t.string(), visibility: t.string(), contractJson: t.string() },
  (ctx, args) => {
    requireString(args.fieldRef, 'SharedField fieldRef');
    if (args.visibility !== 'public') fail('This hosted SharedField table is the public-field floor; private visibility requires caller-scoped content Views');
    const contract = requireJsonObject(args.contractJson, 'SharedField contract');
    requireEqual(contract.field_ref, args.fieldRef, 'SharedField fieldRef');
    requireEqual(contract.kind, args.kind, 'SharedField kind');
    requireEqual(contract.visibility, args.visibility, 'SharedField visibility');
    const existing = ctx.db.sharedField.fieldRef.find(args.fieldRef);
    if (existing) {
      requireFieldOwner(ctx, args.fieldRef);
      ctx.db.sharedField.rowId.update({ ...existing, ...args });
      return;
    }
    ctx.db.sharedField.insert({ rowId: 0n, ...args });
    ctx.db.fieldOwner.insert({
      fieldRef: args.fieldRef,
      ownerIdentity: ctx.sender,
      createdAtMicros: nowMicros(ctx),
    });
  }
);

export const put_participant = spacetimedb.reducer(
  {
    participantRef: t.string(),
    fieldRef: t.string(),
    identityKind: t.string(),
    identityRef: t.string(),
    sourceSystem: t.string(),
    sourceRevision: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    const contract = requireJsonObject(args.contractJson, 'Participant contract');
    requireEqual(contract.participant_ref, args.participantRef, 'Participant participantRef');
    requireEqual(contract.field_ref, args.fieldRef, 'Participant fieldRef');
    requireEqual(contract.identity?.kind, args.identityKind, 'Participant identityKind');
    requireEqual(contract.identity?.ref, args.identityRef, 'Participant identityRef');
    requireEqual(contract.provenance?.source_system, args.sourceSystem, 'Participant sourceSystem');
    requireEqual(contract.provenance?.source_revision, args.sourceRevision, 'Participant sourceRevision');
    if (!ctx.db.sharedField.fieldRef.find(args.fieldRef)) fail(`Unknown SharedField semantic ref: ${args.fieldRef}`);
    requireFieldOwner(ctx, args.fieldRef);
    const existing = ctx.db.participant.participantRef.find(args.participantRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef) fail('Participant cannot move between SharedFields by update');
      ctx.db.participant.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.participant.insert({ rowId: 0n, ...args });
    }
  }
);

export const grant_participant_authority = spacetimedb.reducer(
  {
    fieldRef: t.string(),
    participantRef: t.string(),
    targetIdentity: t.identity(),
    role: t.string(),
    contactable: t.bool(),
    ttlSeconds: t.u32(),
  },
  (ctx, args) => {
    requireFieldOwner(ctx, args.fieldRef);
    requireParticipantInField(ctx, args.participantRef, args.fieldRef);
    requireRole(args.role);
    const now = nowMicros(ctx);
    const row = {
      authorityKey: authorityKey(args.fieldRef, args.participantRef),
      fieldRef: args.fieldRef,
      participantRef: args.participantRef,
      actorIdentity: args.targetIdentity,
      role: args.role,
      contactable: args.contactable,
      revoked: false,
      expiresAtMicros: args.ttlSeconds === 0 ? 0n : now + BigInt(args.ttlSeconds) * 1_000_000n,
      grantedAtMicros: now,
    };
    const existing = ctx.db.fieldAuthority.authorityKey.find(row.authorityKey);
    if (existing) ctx.db.fieldAuthority.authorityKey.update(row);
    else ctx.db.fieldAuthority.insert(row);
  }
);

export const revoke_participant_authority = spacetimedb.reducer(
  { fieldRef: t.string(), participantRef: t.string() },
  (ctx, args) => {
    requireFieldOwner(ctx, args.fieldRef);
    const key = authorityKey(args.fieldRef, args.participantRef);
    const existing = ctx.db.fieldAuthority.authorityKey.find(key);
    if (!existing) fail(`No authority grant for Participant ${args.participantRef}`);
    ctx.db.fieldAuthority.authorityKey.delete(key);
  }
);

export const put_projection = spacetimedb.reducer(
  {
    projectionKey: t.string(),
    fieldRef: t.string(),
    projectionRef: t.string(),
    projectionRevision: t.u32(),
    sourceRevision: t.string(),
    publisherParticipantRef: t.string(),
    state: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    const contract = requireJsonObject(args.contractJson, 'Projection contract');
    requireEqual(contract.projection_ref, args.projectionRef, 'Projection projectionRef');
    requireEqual(contract.projection_revision, args.projectionRevision, 'Projection projectionRevision');
    requireEqual(contract.source?.revision, args.sourceRevision, 'Projection sourceRevision');
    requireEqual(contract.publisher_participant_ref, args.publisherParticipantRef, 'Projection publisherParticipantRef');
    requireEqual(contract.state, args.state, 'Projection state');
    if (contract.audience?.visibility !== 'public') {
      fail('This hosted Projection table is the public-field floor; private audience requires caller-scoped content Views');
    }
    requireParticipantInField(ctx, args.publisherParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.publisherParticipantRef, ['contributor']);
    const expectedKey = `${args.projectionRef}@${args.projectionRevision}`;
    if (args.projectionKey !== expectedKey) fail(`Projection key must be ${expectedKey}`);

    const existing = ctx.db.projection.projectionKey.find(args.projectionKey);
    if (existing) {
      const exact = existing.fieldRef === args.fieldRef
        && existing.projectionRef === args.projectionRef
        && existing.projectionRevision === args.projectionRevision
        && existing.sourceRevision === args.sourceRevision
        && existing.publisherParticipantRef === args.publisherParticipantRef
        && existing.state === args.state
        && existing.contractJson === args.contractJson;
      if (!exact) fail(`Projection revision ${args.projectionKey} is immutable once written`);
      return;
    }

    let latest: any | undefined;
    for (const row of ctx.db.projection.projectionRef.filter(args.projectionRef)) {
      if (!latest || row.projectionRevision > latest.projectionRevision) latest = row;
    }
    if (!latest && args.projectionRevision !== 1) fail('First Projection revision must be 1');
    if (latest) {
      if (latest.fieldRef !== args.fieldRef) fail('Projection cannot move between SharedFields');
      if (args.projectionRevision !== latest.projectionRevision + 1) fail('Projection revisions must advance one step at a time');
      if (args.publisherParticipantRef !== latest.publisherParticipantRef && !isFieldOwner(ctx, args.fieldRef)) {
        fail('Only the current publisher or field owner may hand a Projection to a new publisher');
      }
    }
    ctx.db.projection.insert({ rowId: 0n, ...args });
  }
);

export const put_explore_entry = spacetimedb.reducer(
  {
    semanticRef: t.string(),
    fieldRef: t.string(),
    worldRef: t.string(),
    kind: t.string(),
    label: t.string(),
    revision: t.string(),
    entryJson: t.string(),
  },
  (ctx, args) => {
    const entry = requireJsonObject(args.entryJson, 'Explore entry');
    requireEqual(entry.ref, args.semanticRef, 'Explore semanticRef');
    requireEqual(entry.world_ref, args.worldRef, 'Explore worldRef');
    requireEqual(entry.kind, args.kind, 'Explore kind');
    requireEqual(entry.label, args.label, 'Explore label');
    requireEqual(entry.revision ?? '', args.revision, 'Explore revision');
    requireFieldOwner(ctx, args.fieldRef);
    const existing = ctx.db.exploreEntry.semanticRef.find(args.semanticRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef) fail('Explore entry cannot move between SharedFields');
      ctx.db.exploreEntry.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.exploreEntry.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_explore_relation = spacetimedb.reducer(
  {
    relationRef: t.string(),
    fieldRef: t.string(),
    fromRef: t.string(),
    toRef: t.string(),
    relation: t.string(),
    origin: t.string(),
    relationJson: t.string(),
  },
  (ctx, args) => {
    const relation = requireJsonObject(args.relationJson, 'Explore relation', 16_384);
    requireEqual(relation.from, args.fromRef, 'Explore relation fromRef');
    requireEqual(relation.to, args.toRef, 'Explore relation toRef');
    requireEqual(relation.relation, args.relation, 'Explore relation type');
    requireEqual(relation.origin, args.origin, 'Explore relation origin');
    requireFieldOwner(ctx, args.fieldRef);
    const from = ctx.db.exploreEntry.semanticRef.find(args.fromRef);
    const to = ctx.db.exploreEntry.semanticRef.find(args.toRef);
    if (!from) fail(`Unknown Explore source semantic ref: ${args.fromRef}`);
    if (!to) fail(`Unknown Explore target semantic ref: ${args.toRef}`);
    if (from.fieldRef !== args.fieldRef || to.fieldRef !== args.fieldRef) {
      fail('Explore relations cannot cross a SharedField authority boundary implicitly');
    }
    const existing = ctx.db.exploreRelation.relationRef.find(args.relationRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef) fail('Explore relation cannot move between SharedFields');
      ctx.db.exploreRelation.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.exploreRelation.insert({ rowId: 0n, ...args });
    }
  }
);

export const put_watch = spacetimedb.reducer(
  {
    watchRef: t.string(),
    fieldRef: t.string(),
    watcherParticipantRef: t.string(),
    targetKind: t.string(),
    targetRef: t.string(),
    state: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    const contract = requireJsonObject(args.contractJson, 'Watch contract', 16_384);
    requireEqual(contract.watch_ref, args.watchRef, 'Watch watchRef');
    requireEqual(contract.field_ref, args.fieldRef, 'Watch fieldRef');
    requireEqual(contract.watcher_participant_ref, args.watcherParticipantRef, 'Watch watcherParticipantRef');
    requireEqual(contract.target?.kind, args.targetKind, 'Watch targetKind');
    requireEqual(contract.target?.ref, args.targetRef, 'Watch targetRef');
    requireEqual(contract.state, args.state, 'Watch state');
    requireWatchState(args.state);
    requireParticipantInField(ctx, args.watcherParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.watcherParticipantRef, ['observer', 'contact', 'contributor']);
    const target = ctx.db.exploreEntry.semanticRef.find(args.targetRef);
    if (!target || target.fieldRef !== args.fieldRef) fail(`Unknown Watch target in SharedField ${args.fieldRef}: ${args.targetRef}`);
    const existing = ctx.db.watch.watchRef.find(args.watchRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef
        || existing.watcherParticipantRef !== args.watcherParticipantRef
        || existing.targetKind !== args.targetKind
        || existing.targetRef !== args.targetRef) {
        fail('Watch identity/target is immutable; create a new Watch for a different relation');
      }
      ctx.db.watch.rowId.update({ ...existing, state: args.state, contractJson: args.contractJson });
    } else {
      ctx.db.watch.insert({ rowId: 0n, ...args });
    }
  }
);

export const request_contact = spacetimedb.reducer(
  {
    contactRef: t.string(),
    fieldRef: t.string(),
    initiatorParticipantRef: t.string(),
    recipientParticipantRef: t.string(),
    purpose: t.string(),
    requestedScopeJson: t.string(),
    ttlSeconds: t.u32(),
    provenanceJson: t.string(),
  },
  (ctx, args) => {
    requireString(args.contactRef, 'Contact contactRef');
    requireString(args.purpose, 'Contact purpose', 500);
    requireJsonObject(args.requestedScopeJson, 'Contact requested scope', 4_096);
    requireJsonObject(args.provenanceJson, 'Contact provenance', 4_096);
    if (args.initiatorParticipantRef === args.recipientParticipantRef) fail('Contact requires distinct Participants');
    if (args.ttlSeconds === 0 || args.ttlSeconds > CONTACT_MAX_TTL_SECONDS) {
      fail(`Contact ttlSeconds must be between 1 and ${CONTACT_MAX_TTL_SECONDS}`);
    }
    requireParticipantInField(ctx, args.initiatorParticipantRef, args.fieldRef);
    requireParticipantInField(ctx, args.recipientParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.initiatorParticipantRef, ['contact', 'contributor']);
    authorityForContactRecipient(ctx, args.fieldRef, args.recipientParticipantRef);

    const policy = ctx.db.contactPolicy.policyKey.find(
      contactPolicyKey(args.fieldRef, args.recipientParticipantRef, args.initiatorParticipantRef)
    );
    if (policy && (policy.mode === 'muted' || policy.mode === 'blocked')) {
      fail(`Contact origin is ${policy.mode} by recipient`);
    }

    const now = nowMicros(ctx);
    for (const row of ctx.db.contact.initiatorParticipantRef.filter(args.initiatorParticipantRef)) {
      if (row.fieldRef === args.fieldRef
        && row.recipientParticipantRef === args.recipientParticipantRef
        && row.state === 'pending'
        && now < row.expiresAtMicros) {
        fail('An active Contact request already exists for this Participant pair');
      }
    }
    if (ctx.db.contact.contactRef.find(args.contactRef)) fail(`Contact ref already exists: ${args.contactRef}`);
    enforceContactRate(ctx, args.fieldRef, args.initiatorParticipantRef);

    const row: any = {
      rowId: 0n,
      contactRef: args.contactRef,
      fieldRef: args.fieldRef,
      initiatorParticipantRef: args.initiatorParticipantRef,
      recipientParticipantRef: args.recipientParticipantRef,
      state: 'pending',
      purpose: args.purpose,
      requestedScopeJson: args.requestedScopeJson,
      createdAtMicros: now,
      expiresAtMicros: now + BigInt(args.ttlSeconds) * 1_000_000n,
      responseJson: '',
      provenanceJson: args.provenanceJson,
      contractJson: '',
    };
    row.contractJson = contactContract(row);
    ctx.db.contact.insert(row);
  }
);

export const respond_contact = spacetimedb.reducer(
  {
    contactRef: t.string(),
    recipientParticipantRef: t.string(),
    decision: t.string(),
    responseJson: t.string(),
  },
  (ctx, args) => {
    requireContactDecision(args.decision);
    requireJsonObject(args.responseJson, 'Contact response', 4_096);
    const existing = ctx.db.contact.contactRef.find(args.contactRef);
    if (!existing) fail(`Unknown Contact ref: ${args.contactRef}`);
    if (existing.recipientParticipantRef !== args.recipientParticipantRef) fail('Contact recipient does not match request');
    requireParticipantAuthority(ctx, existing.fieldRef, args.recipientParticipantRef, ['observer', 'contact', 'contributor']);
    if (nowMicros(ctx) >= existing.expiresAtMicros) fail('Contact request has expired');
    if (existing.state !== 'pending') fail(`Contact request is already ${existing.state}`);
    const next: any = { ...existing, state: args.decision, responseJson: args.responseJson };
    next.contractJson = contactContract(next);
    ctx.db.contact.rowId.update(next);
  }
);

export const set_contact_policy = spacetimedb.reducer(
  {
    fieldRef: t.string(),
    blockerParticipantRef: t.string(),
    blockedParticipantRef: t.string(),
    mode: t.string(),
  },
  (ctx, args) => {
    if (!['muted', 'blocked', 'clear'].includes(args.mode)) fail(`Unsupported Contact policy mode: ${args.mode}`);
    if (args.blockerParticipantRef === args.blockedParticipantRef) fail('Contact policy requires distinct Participants');
    requireParticipantInField(ctx, args.blockerParticipantRef, args.fieldRef);
    requireParticipantInField(ctx, args.blockedParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.blockerParticipantRef, ['observer', 'contact', 'contributor']);
    const key = contactPolicyKey(args.fieldRef, args.blockerParticipantRef, args.blockedParticipantRef);
    const existing = ctx.db.contactPolicy.policyKey.find(key);
    if (args.mode === 'clear') {
      if (existing) ctx.db.contactPolicy.policyKey.delete(key);
      return;
    }
    const row = {
      policyKey: key,
      fieldRef: args.fieldRef,
      blockerParticipantRef: args.blockerParticipantRef,
      blockedParticipantRef: args.blockedParticipantRef,
      mode: args.mode,
      updatedAtMicros: nowMicros(ctx),
    };
    if (existing) ctx.db.contactPolicy.policyKey.update(row);
    else ctx.db.contactPolicy.insert(row);
  }
);
