import { schema, table, t, SenderError } from 'spacetimedb/server';

const CONTACT_WINDOW_MICROS = 60_000_000n;
const CONTACT_LIMIT_PER_WINDOW = 3;
const CONTACT_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const CONTRIBUTION_WINDOW_MICROS = 60_000_000n;
const CONTRIBUTION_LIMIT_PER_WINDOW = 8;
const CONTRIBUTION_BYTES_PER_WINDOW = 96 * 1024;
const CONTRIBUTION_MAX_OUTSTANDING = 8;
const CONTRIBUTION_MAX_BYTES = 32 * 1024;
const CONTRIBUTION_MAX_PROVENANCE = 16;
const CONTRIBUTION_MAX_COLLECTION = 64;
const CONTRIBUTION_MAX_DEPTH = 8;
const CONTRIBUTION_VISIBILITIES = new Set(['public', 'restricted', 'private']);
const CONTRIBUTION_TRANSPORTS = new Set(['a2a', 'mcp', 'http', 'local-import']);
const HOSTED_VISIBILITIES = new Set(['public', 'restricted', 'private']);
const PROJECTION_VISIBILITIES = new Set(['public', 'restricted', 'private']);

/*
 * Phase 1 privacy shape:
 *
 * PRIVATE canonical backing tables
 *        ↓
 * caller/field/audience visibility resolver
 *        ↓
 * public caller-filtered Views using the historical public table names
 *
 * The old public SQL/client names are deliberately retained as Views so downstream
 * readers keep their legal read-model contract while raw canonical state becomes
 * unsubscribable.
 */
const sharedFieldBacking = table(
  { name: 'shared_field_backing', public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    fieldRef: t.string().unique(),
    kind: t.string(),
    visibility: t.string().index('btree'),
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

/*
 * Explicit private-field read admission. This is audience state, not mutation
 * authority: a participant must also retain a live persistent fieldAuthority grant
 * bound to the same runtime caller for this row to confer read eligibility.
 */
const fieldReadGrant = table(
  { public: false },
  {
    audienceKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    participantRef: t.string().index('btree'),
    actorIdentity: t.identity().index('btree'),
    grantedAtMicros: t.u64(),
  }
);

const participantBacking = table(
  { name: 'participant_backing', public: false },
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

const projectionBacking = table(
  { name: 'projection_backing', public: false },
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

/*
 * Phase 2 Contribution shape:
 *
 * untrusted ingress
 *      ↓
 * PRIVATE immutable-ish ingress evidence / quarantine
 *      ↓ explicit receiving-side Admission
 * PRIVATE current admitted Contribution
 *      ↓ separate receiving-side index eligibility
 * caller-filtered Contribution / Explore Views
 *
 * Transport/source identifiers remain claims. ingressRef, timestamps, caller identity,
 * lifecycle, Admission and index decisions are produced/enforced by this module.
 */
const contributionIngressBacking = table(
  { name: 'contribution_ingress_backing', public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    ingressRef: t.string().unique(),
    ingressKey: t.string().unique(),
    fieldRef: t.string().index('btree'),
    claimedContributionRef: t.string().index('btree'),
    contributorParticipantRef: t.string().index('btree'),
    submitterIdentity: t.identity().index('btree'),
    sourceKind: t.string().index('btree'),
    transportProvider: t.string(),
    transportMessageId: t.string(),
    payloadFingerprint: t.string(),
    payloadBytes: t.u64(),
    receivedAtMicros: t.u64(),
    state: t.string().index('btree'),
    contractJson: t.string(),
    serverProvenanceJson: t.string(),
  }
);

const contributionReceipt = table(
  { name: 'contribution_receipt', public: false },
  {
    ingressRef: t.string().primaryKey(),
    submitterIdentity: t.identity().index('btree'),
    fieldRef: t.string().index('btree'),
    contributionRef: t.string(),
    state: t.string(),
    receivedAtMicros: t.u64(),
    payloadFingerprint: t.string(),
  }
);

const admittedContributionBacking = table(
  { name: 'admitted_contribution_backing', public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    ingressRef: t.string().unique(),
    contributionRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    contributorParticipantRef: t.string().index('btree'),
    visibility: t.string().index('btree'),
    audienceRefsJson: t.string(),
    admissionDecisionRef: t.string(),
    admittedAtMicros: t.u64(),
    contractJson: t.string(),
  }
);

const admissionDecision = table(
  { name: 'admission_decision', public: false },
  {
    decisionRef: t.string().primaryKey(),
    ingressRef: t.string().index('btree'),
    fieldRef: t.string().index('btree'),
    disposition: t.string().index('btree'),
    admissionActorIdentity: t.identity().index('btree'),
    admissionParticipantRef: t.string(),
    decidedAtMicros: t.u64(),
    reason: t.string(),
    evidenceJson: t.string(),
    serverProvenanceJson: t.string(),
  }
);

const contributionIndexPolicy = table(
  { name: 'contribution_index_policy', public: false },
  {
    ingressRef: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    eligible: t.bool(),
    decisionRef: t.string(),
    decidedAtMicros: t.u64(),
  }
);

const contributionIndexDecision = table(
  { name: 'contribution_index_decision', public: false },
  {
    decisionRef: t.string().primaryKey(),
    ingressRef: t.string().index('btree'),
    fieldRef: t.string().index('btree'),
    eligible: t.bool(),
    decisionActorIdentity: t.identity().index('btree'),
    decisionParticipantRef: t.string(),
    decidedAtMicros: t.u64(),
    reason: t.string(),
    evidenceJson: t.string(),
  }
);

const contributionIngressRate = table(
  { name: 'contribution_ingress_rate', public: false },
  {
    rateKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    originRef: t.string().index('btree'),
    windowStartedMicros: t.u64(),
    count: t.u32(),
    bytes: t.u64(),
  }
);

const exploreEntryBacking = table(
  { name: 'explore_entry_backing', public: false },
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

const exploreRelationBacking = table(
  { name: 'explore_relation_backing', public: false },
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
  sharedFieldBacking,
  fieldOwner,
  fieldAuthority,
  fieldReadGrant,
  participantBacking,
  projectionBacking,
  contributionIngressBacking,
  contributionReceipt,
  admittedContributionBacking,
  admissionDecision,
  contributionIndexPolicy,
  contributionIndexDecision,
  contributionIngressRate,
  exploreEntryBacking,
  exploreRelationBacking,
  watch,
  contact,
  contactPolicy,
  contactRate,
});

export default spacetimedb;

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

function parseStoredJson(value: string, name: string): Record<string, any> {
  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${name} is not an object`);
    }
    return parsed as Record<string, any>;
  } catch (error: any) {
    throw new Error(`${name} contains invalid canonical JSON: ${error?.message ?? String(error)}`);
  }
}

function requireEqual(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) fail(`${name} does not match semantic contract`);
}

function nowMicros(ctx: any): bigint {
  return ctx.timestamp.microsSinceUnixEpoch;
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

/* Deterministic server-side replay/content fingerprint; not represented as a trust or crypto proof. */
function fingerprintString(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul((b + code) >>> 0, 0x85ebca6b) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

function enforceJsonBounds(value: unknown, name: string, depth = 0): void {
  if (depth > CONTRIBUTION_MAX_DEPTH) fail(`${name} exceeds maximum nesting depth ${CONTRIBUTION_MAX_DEPTH}`);
  if (typeof value === 'string') {
    if (utf8Bytes(value) > 8_192) fail(`${name} contains a string exceeding 8192 bytes`);
    return;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return;
  if (Array.isArray(value)) {
    if (value.length > CONTRIBUTION_MAX_COLLECTION) {
      fail(`${name} array exceeds ${CONTRIBUTION_MAX_COLLECTION} entries`);
    }
    value.forEach((entry, index) => enforceJsonBounds(entry, `${name}[${index}]`, depth + 1));
    return;
  }
  if (typeof value !== 'object') fail(`${name} contains an unsupported JSON value`);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > CONTRIBUTION_MAX_COLLECTION) {
    fail(`${name} object exceeds ${CONTRIBUTION_MAX_COLLECTION} properties`);
  }
  for (const [key, entry] of entries) {
    if (utf8Bytes(key) > 128) fail(`${name} contains a property name exceeding 128 bytes`);
    enforceJsonBounds(entry, `${name}.${key}`, depth + 1);
  }
}

function requireJsonStringArray(value: string, name: string, maxItems = 32): string[] {
  if (utf8Bytes(value) > 4_096) fail(`${name} exceeds 4096 byte limit`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail(`${name} must contain valid JSON`);
  }
  if (!Array.isArray(parsed)) fail(`${name} must contain a JSON array`);
  if (parsed.length > maxItems) fail(`${name} exceeds ${maxItems} entries`);
  const seen = new Set<string>();
  return parsed.map((entry, index) => {
    if (typeof entry !== 'string') fail(`${name}[${index}] must be a string`);
    requireString(entry, `${name}[${index}]`, 512);
    if (seen.has(entry)) fail(`${name} contains duplicate ref: ${entry}`);
    seen.add(entry);
    return entry;
  });
}

function authorityKey(fieldRef: string, participantRef: string): string {
  return `${fieldRef}|${participantRef}`;
}

function audienceKey(fieldRef: string, participantRef: string): string {
  return `${fieldRef}|${participantRef}`;
}

function contactPolicyKey(fieldRef: string, blockerParticipantRef: string, blockedParticipantRef: string): string {
  return `${fieldRef}|${blockerParticipantRef}|${blockedParticipantRef}`;
}

function contactRateKey(fieldRef: string, initiatorParticipantRef: string): string {
  return `${fieldRef}|${initiatorParticipantRef}`;
}

function contributionRateKey(fieldRef: string, originRef: string): string {
  return fingerprintString(`${fieldRef}\u001f${originRef}`);
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
  const participantRow = ctx.db.participantBacking.participantRef.find(participantRef);
  if (!participantRow || participantRow.fieldRef !== fieldRef) {
    fail(`Participant ${participantRef} does not belong to SharedField ${fieldRef}`);
  }
  return participantRow;
}

function requireRole(role: string): void {
  if (!['observer', 'contact', 'contributor', 'admitter'].includes(role)) fail(`Unsupported authority role: ${role}`);
}

function requireWatchState(state: string): void {
  if (!['active', 'paused'].includes(state)) fail(`Unsupported Watch state: ${state}`);
}

function requireContactDecision(decision: string): void {
  if (!['accepted', 'declined', 'redirected', 'narrowed'].includes(decision)) {
    fail(`Unsupported Contact decision: ${decision}`);
  }
}

function privateReadCallerGrants(ctx: any): any[] {
  return Array.from(ctx.db.fieldAuthority.actorIdentity.filter(ctx.sender)).filter(
    (grant: any) => !grant.revoked && grant.expiresAtMicros === 0n
  );
}

function callerPersistentParticipantRefs(ctx: any, fieldRef: string): Set<string> {
  const refs = new Set<string>();
  for (const grant of privateReadCallerGrants(ctx)) {
    if (grant.fieldRef === fieldRef) refs.add(grant.participantRef);
  }
  return refs;
}

function callerOwnsPersistentParticipantGrant(ctx: any, fieldRef: string, participantRef: string): boolean {
  for (const grant of privateReadCallerGrants(ctx)) {
    if (grant.fieldRef === fieldRef && grant.participantRef === participantRef) return true;
  }
  return false;
}

function callerHasExplicitFieldRead(ctx: any, fieldRef: string): boolean {
  for (const readGrant of ctx.db.fieldReadGrant.actorIdentity.filter(ctx.sender)) {
    if (readGrant.fieldRef !== fieldRef) continue;
    if (callerOwnsPersistentParticipantGrant(ctx, fieldRef, readGrant.participantRef)) return true;
  }
  return false;
}

function callerCanSeeField(ctx: any, fieldRow: any): boolean {
  if (fieldRow.visibility === 'public') return true;
  if (isFieldOwner(ctx, fieldRow.fieldRef)) return true;
  if (fieldRow.visibility === 'restricted') {
    return callerPersistentParticipantRefs(ctx, fieldRow.fieldRef).size > 0;
  }
  if (fieldRow.visibility === 'private') {
    return callerHasExplicitFieldRead(ctx, fieldRow.fieldRef);
  }
  return false;
}

function visibleFieldRows(ctx: any): any[] {
  const rows = new Map<string, any>();
  for (const row of ctx.db.sharedFieldBacking.visibility.filter('public')) rows.set(row.fieldRef, row);
  for (const owned of ctx.db.fieldOwner.ownerIdentity.filter(ctx.sender)) {
    const row = ctx.db.sharedFieldBacking.fieldRef.find(owned.fieldRef);
    if (row) rows.set(row.fieldRef, row);
  }
  for (const grant of privateReadCallerGrants(ctx)) {
    const row = ctx.db.sharedFieldBacking.fieldRef.find(grant.fieldRef);
    if (row?.visibility === 'restricted') rows.set(row.fieldRef, row);
  }
  for (const readGrant of ctx.db.fieldReadGrant.actorIdentity.filter(ctx.sender)) {
    const row = ctx.db.sharedFieldBacking.fieldRef.find(readGrant.fieldRef);
    if (row?.visibility === 'private' && callerOwnsPersistentParticipantGrant(ctx, readGrant.fieldRef, readGrant.participantRef)) {
      rows.set(row.fieldRef, row);
    }
  }
  return Array.from(rows.values());
}

function latestProjectionRowsForField(ctx: any, fieldRef: string): any[] {
  const latest = new Map<string, any>();
  for (const row of ctx.db.projectionBacking.fieldRef.filter(fieldRef)) {
    const prior = latest.get(row.projectionRef);
    if (!prior || row.projectionRevision > prior.projectionRevision) latest.set(row.projectionRef, row);
  }
  return Array.from(latest.values());
}

function projectionAudience(contract: Record<string, any>): { visibility: string; refs: string[] } {
  const audience = contract.audience;
  if (audience === null || typeof audience !== 'object' || Array.isArray(audience)) {
    throw new Error('Projection audience missing from canonical contract');
  }
  const visibility = String(audience.visibility ?? '');
  const refs = audience.refs === undefined ? [] : audience.refs;
  if (!Array.isArray(refs)) throw new Error('Projection audience refs are not an array');
  return { visibility, refs: refs.map((ref: unknown) => String(ref)) };
}

function callerCanSeeProjection(ctx: any, row: any): boolean {
  const field = ctx.db.sharedFieldBacking.fieldRef.find(row.fieldRef);
  if (!field || !callerCanSeeField(ctx, field)) return false;
  if (isFieldOwner(ctx, row.fieldRef)) return true;

  const contract = parseStoredJson(row.contractJson, 'Projection contractJson');
  const audience = projectionAudience(contract);
  const callerRefs = callerPersistentParticipantRefs(ctx, row.fieldRef);

  if (audience.visibility === 'public') {
    if (audience.refs.length === 0) return true;
    return audience.refs.some(ref => callerRefs.has(ref));
  }
  if (audience.visibility === 'restricted') {
    if (callerRefs.size === 0) return false;
    if (audience.refs.length === 0) return true;
    return audience.refs.some(ref => callerRefs.has(ref));
  }
  if (audience.visibility === 'private') {
    if (callerRefs.size === 0 || audience.refs.length === 0) return false;
    return audience.refs.some(ref => callerRefs.has(ref));
  }
  return false;
}

function visibleProjectionRows(ctx: any): any[] {
  const rows: any[] = [];
  for (const field of visibleFieldRows(ctx)) {
    for (const row of latestProjectionRowsForField(ctx, field.fieldRef)) {
      if (callerCanSeeProjection(ctx, row)) rows.push(row);
    }
  }
  return rows;
}

function contributionAudience(row: any): { visibility: string; refs: string[] } {
  const refs = requireJsonStringArray(row.audienceRefsJson, 'stored Contribution audience', 32);
  return { visibility: row.visibility, refs };
}

function callerCanSeeAdmittedContribution(ctx: any, row: any): boolean {
  const field = ctx.db.sharedFieldBacking.fieldRef.find(row.fieldRef);
  if (!field || !callerCanSeeField(ctx, field)) return false;
  if (isFieldOwner(ctx, row.fieldRef)) return true;
  const audience = contributionAudience(row);
  const callerRefs = callerPersistentParticipantRefs(ctx, row.fieldRef);
  if (audience.visibility === 'public') {
    if (audience.refs.length === 0) return true;
    return audience.refs.some(ref => callerRefs.has(ref));
  }
  if (audience.visibility === 'restricted') {
    if (callerRefs.size === 0) return false;
    if (audience.refs.length === 0) return true;
    return audience.refs.some(ref => callerRefs.has(ref));
  }
  if (audience.visibility === 'private') {
    if (callerRefs.size === 0 || audience.refs.length === 0) return false;
    return audience.refs.some(ref => callerRefs.has(ref));
  }
  return false;
}

function visibleContributionRows(ctx: any): any[] {
  const rows: any[] = [];
  for (const field of visibleFieldRows(ctx)) {
    for (const row of ctx.db.admittedContributionBacking.fieldRef.filter(field.fieldRef)) {
      if (callerCanSeeAdmittedContribution(ctx, row)) rows.push(row);
    }
  }
  return rows;
}

function contributionIsIndexEligible(ctx: any, row: any): boolean {
  const policy = ctx.db.contributionIndexPolicy.ingressRef.find(row.ingressRef);
  return Boolean(policy?.eligible);
}

function contributionClaimsForRef(ctx: any, semanticRef: string): any[] {
  return Array.from(ctx.db.contributionIngressBacking.claimedContributionRef.filter(semanticRef));
}

function projectionLineagesReferencingExploreEntry(ctx: any, row: any): Set<string> {
  const refs = new Set<string>();
  for (const projectionRow of ctx.db.projectionBacking.fieldRef.filter(row.fieldRef)) {
    const contract = parseStoredJson(projectionRow.contractJson, 'Projection contractJson');
    if (contract.projection_ref === row.semanticRef || contract.representation?.ref === row.semanticRef) {
      refs.add(projectionRow.projectionRef);
    }
  }
  return refs;
}

function callerCanSeeExploreEntry(ctx: any, row: any): boolean {
  const field = ctx.db.sharedFieldBacking.fieldRef.find(row.fieldRef);
  if (!field || !callerCanSeeField(ctx, field)) return false;

  const admittedContribution = ctx.db.admittedContributionBacking.contributionRef.find(row.semanticRef);
  if (admittedContribution) {
    if (admittedContribution.fieldRef !== row.fieldRef) return false;
    if (!contributionIsIndexEligible(ctx, admittedContribution)) return false;
    if (!callerCanSeeAdmittedContribution(ctx, admittedContribution)) return false;
  } else if (contributionClaimsForRef(ctx, row.semanticRef).some(claim => claim.fieldRef === row.fieldRef)) {
    return false;
  }

  const entry = parseStoredJson(row.entryJson, 'Explore entryJson');
  const directProjectionRef = typeof entry.projection_ref === 'string' ? entry.projection_ref : undefined;
  const lineages = projectionLineagesReferencingExploreEntry(ctx, row);
  if (directProjectionRef) lineages.add(directProjectionRef);

  if (row.kind === 'projection' && lineages.size === 0) lineages.add(row.semanticRef);

  if (lineages.size > 0) {
    const latest = latestProjectionRowsForField(ctx, row.fieldRef);
    return Array.from(lineages).some(projectionRef => {
      const current = latest.find(projectionRow => projectionRow.projectionRef === projectionRef);
      if (!current || current.state !== 'published' || !callerCanSeeProjection(ctx, current)) return false;
      const contract = parseStoredJson(current.contractJson, 'Projection contractJson');
      return contract.projection_ref === row.semanticRef || contract.representation?.ref === row.semanticRef;
    });
  }

  const participantRef = entry.meta?.participant_ref;
  if (typeof participantRef === 'string') {
    const participant = ctx.db.participantBacking.participantRef.find(participantRef);
    if (!participant || participant.fieldRef !== row.fieldRef) return false;
  }

  return true;
}

function visibleExploreEntryRows(ctx: any): any[] {
  const rows: any[] = [];
  for (const field of visibleFieldRows(ctx)) {
    for (const row of ctx.db.exploreEntryBacking.fieldRef.filter(field.fieldRef)) {
      if (callerCanSeeExploreEntry(ctx, row)) rows.push(row);
    }
  }
  return rows;
}

function visibleExploreRelationRows(ctx: any): any[] {
  const visibleRefs = new Set(visibleExploreEntryRows(ctx).map(row => row.semanticRef));
  const rows: any[] = [];
  for (const field of visibleFieldRows(ctx)) {
    for (const row of ctx.db.exploreRelationBacking.fieldRef.filter(field.fieldRef)) {
      if (visibleRefs.has(row.fromRef) && visibleRefs.has(row.toRef)) rows.push(row);
    }
  }
  return rows;
}

/* Caller-filtered public content Views. */
export const shared_field = spacetimedb.view(
  { name: 'shared_field', public: true },
  t.array(sharedFieldBacking.rowType),
  (ctx) => visibleFieldRows(ctx)
);

export const participant = spacetimedb.view(
  { name: 'participant', public: true },
  t.array(participantBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const field of visibleFieldRows(ctx)) {
      for (const row of ctx.db.participantBacking.fieldRef.filter(field.fieldRef)) rows.push(row);
    }
    return rows;
  }
);

export const projection = spacetimedb.view(
  { name: 'projection', public: true },
  t.array(projectionBacking.rowType),
  (ctx) => visibleProjectionRows(ctx)
);

export const contribution = spacetimedb.view(
  { name: 'contribution', public: true },
  t.array(admittedContributionBacking.rowType),
  (ctx) => visibleContributionRows(ctx)
);

export const explore_entry = spacetimedb.view(
  { name: 'explore_entry', public: true },
  t.array(exploreEntryBacking.rowType),
  (ctx) => visibleExploreEntryRows(ctx)
);

export const explore_relation = spacetimedb.view(
  { name: 'explore_relation', public: true },
  t.array(exploreRelationBacking.rowType),
  (ctx) => visibleExploreRelationRows(ctx)
);

/**
 * Protected relationship Views deliberately admit only non-expiring grants.
 * Finite grants remain reducer-only until provider-timed read expiry is proven.
 */
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

export const my_contribution_receipt = spacetimedb.view(
  { name: 'my_contribution_receipt', public: true },
  t.array(contributionReceipt.rowType),
  (ctx) => Array.from(ctx.db.contributionReceipt.submitterIdentity.filter(ctx.sender))
);

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

function requireAdmissionAuthority(ctx: any, fieldRef: string, admissionParticipantRef: string): void {
  if (admissionParticipantRef === '') {
    requireFieldOwner(ctx, fieldRef);
    return;
  }
  requireParticipantInField(ctx, admissionParticipantRef, fieldRef);
  requireParticipantAuthority(ctx, fieldRef, admissionParticipantRef, ['admitter']);
}

function requirePersistentParticipantAuthority(ctx: any, fieldRef: string, participantRef: string): any {
  const grant = ctx.db.fieldAuthority.authorityKey.find(authorityKey(fieldRef, participantRef));
  if (!grant || grant.revoked || grant.expiresAtMicros !== 0n) {
    fail(`Participant ${participantRef} requires persistent authority for protected read audience`);
  }
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

function validateHostedFieldVisibility(visibility: string): void {
  if (visibility === 'unlisted') {
    fail('Hosted unlisted is rejected: current broad subscription Views do not provide direct-only resolvability without enumeration');
  }
  if (!HOSTED_VISIBILITIES.has(visibility)) fail(`Unsupported hosted SharedField visibility: ${visibility}`);
}

function validateProjectionAudience(ctx: any, fieldRef: string, contract: Record<string, any>): void {
  const audience = contract.audience;
  if (audience === null || typeof audience !== 'object' || Array.isArray(audience)) {
    fail('Projection audience must be an object');
  }
  const visibility = audience.visibility;
  if (visibility === 'unlisted') {
    fail('Hosted unlisted Projection is rejected until direct-only resolution can be enforced provider-side');
  }
  if (!PROJECTION_VISIBILITIES.has(visibility)) fail(`Unsupported Projection audience visibility: ${visibility}`);
  const refs = audience.refs ?? [];
  if (!Array.isArray(refs)) fail('Projection audience.refs must be an array');
  const seen = new Set<string>();
  for (const rawRef of refs) {
    if (typeof rawRef !== 'string' || rawRef.trim() === '') fail('Projection audience.refs entries must be non-empty Participant refs');
    if (seen.has(rawRef)) fail(`Duplicate Projection audience ref: ${rawRef}`);
    seen.add(rawRef);
    requireParticipantInField(ctx, rawRef, fieldRef);
  }
}

function validateContributionVisibility(ctx: any, fieldRef: string, visibility: string, audienceRefsJson: string): string[] {
  if (visibility === 'unlisted') fail('Hosted unlisted Contribution is rejected until direct-only resolution is proven provider-side');
  if (!CONTRIBUTION_VISIBILITIES.has(visibility)) fail(`Unsupported Contribution visibility: ${visibility}`);
  const field = ctx.db.sharedFieldBacking.fieldRef.find(fieldRef);
  if (!field) fail(`Unknown SharedField semantic ref: ${fieldRef}`);
  if (field.visibility === 'restricted' && visibility === 'public') {
    fail('Contribution visibility cannot widen a restricted SharedField to public');
  }
  if (field.visibility === 'private' && visibility !== 'private') {
    fail('Contribution visibility cannot widen a private SharedField');
  }
  const refs = requireJsonStringArray(audienceRefsJson, 'Contribution audience refs', 32);
  for (const ref of refs) requireParticipantInField(ctx, ref, fieldRef);
  if (visibility === 'private' && refs.length === 0) fail('Private Contribution requires an explicit audience');
  return refs;
}

function validateKnownTargetField(ctx: any, fieldRef: string, target: Record<string, any>): void {
  const kind = String(target.kind ?? '');
  const ref = String(target.ref ?? '');
  if (kind === 'oi.participant' || kind === 'participant') {
    requireParticipantInField(ctx, ref, fieldRef);
    return;
  }
  if (kind === 'oi.shared-field' || kind === 'shared-field') {
    if (ref !== fieldRef) fail('Contribution target SharedField must equal receiving field');
    return;
  }
  if (kind === 'oi.projection' || kind === 'projection') {
    for (const row of ctx.db.projectionBacking.projectionRef.filter(ref)) {
      if (row.fieldRef !== fieldRef) fail('Contribution target Projection crosses a SharedField boundary');
      return;
    }
  }
  if (kind === 'oi.contribution' || kind === 'contribution') {
    for (const row of ctx.db.contributionIngressBacking.claimedContributionRef.filter(ref)) {
      if (row.fieldRef !== fieldRef) fail('Contribution target Contribution crosses a SharedField boundary');
      return;
    }
  }
}

function validateContributionContract(ctx: any, fieldRef: string, contributorParticipantRef: string, contractJson: string): { contract: Record<string, any>; payloadBytes: number; fingerprint: string } {
  const payloadBytes = utf8Bytes(contractJson);
  if (payloadBytes > CONTRIBUTION_MAX_BYTES) fail(`Contribution payload exceeds ${CONTRIBUTION_MAX_BYTES} byte limit`);
  const contract = requireJsonObject(contractJson, 'Contribution contract', CONTRIBUTION_MAX_BYTES);
  enforceJsonBounds(contract, 'Contribution contract');
  requireEqual(contract.schema, 'oi.contribution/v1', 'Contribution schema');
  requireEqual(contract.field_ref, fieldRef, 'Contribution fieldRef');
  requireEqual(contract.contributor_participant_ref, contributorParticipantRef, 'Contribution contributorParticipantRef');
  requireString(String(contract.contribution_ref ?? ''), 'Contribution contributionRef', 512);
  requireString(String(contract.created_at ?? ''), 'Contribution createdAt', 64);
  requireString(String(contract.mode ?? ''), 'Contribution mode', 64);
  const target = contract.target;
  if (target === null || typeof target !== 'object' || Array.isArray(target)) fail('Contribution target must be an object');
  requireString(String(target.ref ?? ''), 'Contribution target.ref', 512);
  requireString(String(target.kind ?? ''), 'Contribution target.kind', 128);
  validateKnownTargetField(ctx, fieldRef, target as Record<string, any>);
  const relation = contract.relation;
  if (relation === null || typeof relation !== 'object' || Array.isArray(relation)) fail('Contribution relation must be an object');
  requireString(String(relation.kind ?? ''), 'Contribution relation.kind', 128);
  const representation = contract.representation;
  if (representation === null || typeof representation !== 'object' || Array.isArray(representation)) fail('Contribution representation must be an object');
  requireString(String(representation.kind ?? ''), 'Contribution representation.kind', 128);
  if (!(typeof representation.ref === 'string' && representation.ref.trim() !== '')
      && !Object.prototype.hasOwnProperty.call(representation, 'payload')) {
    fail('Contribution representation requires ref or payload');
  }
  if (representation.ref !== undefined) requireString(String(representation.ref), 'Contribution representation.ref', 512);
  if (!Array.isArray(contract.provenance) || contract.provenance.length === 0) {
    fail('Contribution provenance must be a non-empty array');
  }
  if (contract.provenance.length > CONTRIBUTION_MAX_PROVENANCE) {
    fail(`Contribution provenance exceeds ${CONTRIBUTION_MAX_PROVENANCE} entries`);
  }
  contract.provenance.forEach((entry: any, index: number) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) fail(`Contribution provenance[${index}] must be an object`);
    requireString(String(entry.kind ?? ''), `Contribution provenance[${index}].kind`, 128);
    requireString(String(entry.ref ?? ''), `Contribution provenance[${index}].ref`, 512);
    requireString(String(entry.source_system ?? ''), `Contribution provenance[${index}].source_system`, 256);
    if (entry.revision !== undefined) requireString(String(entry.revision), `Contribution provenance[${index}].revision`, 256);
  });
  for (const forbidden of ['admitted', 'admission', 'index_eligible', 'indexEligible', 'visibility', 'audience', 'state']) {
    if (Object.prototype.hasOwnProperty.call(contract, forbidden)) {
      fail(`Contribution sender cannot supply receiving policy field: ${forbidden}`);
    }
  }
  return { contract, payloadBytes, fingerprint: fingerprintString(contractJson) };
}

function enforceContributionRate(ctx: any, fieldRef: string, originRef: string, payloadBytes: number): void {
  const now = nowMicros(ctx);
  const key = contributionRateKey(fieldRef, originRef);
  const current = ctx.db.contributionIngressRate.rateKey.find(key);
  if (!current || now - current.windowStartedMicros >= CONTRIBUTION_WINDOW_MICROS) {
    const next = {
      rateKey: key,
      fieldRef,
      originRef,
      windowStartedMicros: now,
      count: 1,
      bytes: BigInt(payloadBytes),
    };
    if (current) ctx.db.contributionIngressRate.rateKey.update(next);
    else ctx.db.contributionIngressRate.insert(next);
    return;
  }
  if (current.count >= CONTRIBUTION_LIMIT_PER_WINDOW) fail(`Contribution rate limit exceeded for ${originRef} in ${fieldRef}`);
  if (current.bytes + BigInt(payloadBytes) > BigInt(CONTRIBUTION_BYTES_PER_WINDOW)) {
    fail(`Contribution byte budget exceeded for ${originRef} in ${fieldRef}`);
  }
  ctx.db.contributionIngressRate.rateKey.update({
    ...current,
    count: current.count + 1,
    bytes: current.bytes + BigInt(payloadBytes),
  });
}

function enforceContributionOutstanding(ctx: any, fieldRef: string, contributorParticipantRef: string): void {
  let count = 0;
  for (const row of ctx.db.contributionIngressBacking.contributorParticipantRef.filter(contributorParticipantRef)) {
    if (row.fieldRef === fieldRef && row.state === 'quarantined') count += 1;
  }
  if (count >= CONTRIBUTION_MAX_OUTSTANDING) {
    fail(`Contribution quarantine limit exceeded for ${contributorParticipantRef} in ${fieldRef}`);
  }
}

function ingressContribution(ctx: any, input: {
  fieldRef: string;
  contributorParticipantRef: string;
  sourceKind: string;
  transportProvider: string;
  transportMessageId: string;
  contractJson: string;
}): void {
  requireString(input.transportMessageId, 'Contribution transportMessageId', 256);
  requireString(input.transportProvider, 'Contribution transportProvider', 128);
  requireParticipantInField(ctx, input.contributorParticipantRef, input.fieldRef);
  const validated = validateContributionContract(ctx, input.fieldRef, input.contributorParticipantRef, input.contractJson);
  const contributionRef = String(validated.contract.contribution_ref);
  for (const row of ctx.db.contributionIngressBacking.claimedContributionRef.filter(contributionRef)) {
    if (row.fieldRef !== input.fieldRef) fail('Contribution claimed semantic ref is already associated with another SharedField');
  }
  const ingressKey = fingerprintString(`${input.fieldRef}\u001f${input.contributorParticipantRef}\u001f${input.sourceKind}\u001f${input.transportProvider}\u001f${input.transportMessageId}`);
  const existing = ctx.db.contributionIngressBacking.ingressKey.find(ingressKey);
  if (existing) {
    if (existing.payloadFingerprint === validated.fingerprint && existing.contractJson === input.contractJson) return;
    fail('Contribution transport replay key conflicts with a different payload');
  }
  enforceContributionOutstanding(ctx, input.fieldRef, input.contributorParticipantRef);
  enforceContributionRate(ctx, input.fieldRef, input.contributorParticipantRef, validated.payloadBytes);
  const now = nowMicros(ctx);
  const ingressRef = `ingress:${fingerprintString(`${ingressKey}\u001f${validated.fingerprint}`)}`;
  if (ctx.db.contributionIngressBacking.ingressRef.find(ingressRef)) fail('Contribution server ingress fingerprint collision; retry with a new transport operation');
  const serverProvenanceJson = JSON.stringify({
    schema: 'oi.ingress-provenance/v1',
    observed: {
      source_kind: input.sourceKind,
      transport_provider: input.transportProvider,
      transport_message_id: input.transportMessageId,
      target_field_ref: input.fieldRef,
      contributor_participant_ref: input.contributorParticipantRef,
      received_at_micros: String(now),
    },
    claims: {
      contribution_ref: contributionRef,
      payload_fingerprint: validated.fingerprint,
    },
  });
  ctx.db.contributionIngressBacking.insert({
    rowId: 0n,
    ingressRef,
    ingressKey,
    fieldRef: input.fieldRef,
    claimedContributionRef: contributionRef,
    contributorParticipantRef: input.contributorParticipantRef,
    submitterIdentity: ctx.sender,
    sourceKind: input.sourceKind,
    transportProvider: input.transportProvider,
    transportMessageId: input.transportMessageId,
    payloadFingerprint: validated.fingerprint,
    payloadBytes: BigInt(validated.payloadBytes),
    receivedAtMicros: now,
    state: 'quarantined',
    contractJson: input.contractJson,
    serverProvenanceJson,
  });
  ctx.db.contributionReceipt.insert({
    ingressRef,
    submitterIdentity: ctx.sender,
    fieldRef: input.fieldRef,
    contributionRef,
    state: 'quarantined',
    receivedAtMicros: now,
    payloadFingerprint: validated.fingerprint,
  });
}

function updateContributionReceiptState(ctx: any, ingress: any, state: string): void {
  const receipt = ctx.db.contributionReceipt.ingressRef.find(ingress.ingressRef);
  if (!receipt) throw new Error(`Missing Contribution receipt for ${ingress.ingressRef}`);
  ctx.db.contributionReceipt.ingressRef.update({ ...receipt, state });
}

function admissionDecisionRef(ingressRef: string, disposition: string, at: bigint, participantRef: string): string {
  return `admission:${fingerprintString(`${ingressRef}\u001f${disposition}\u001f${String(at)}\u001f${participantRef}`)}`;
}

function indexDecisionRef(ingressRef: string, eligible: boolean, at: bigint, participantRef: string): string {
  return `index:${fingerprintString(`${ingressRef}\u001f${eligible ? 'eligible' : 'ineligible'}\u001f${String(at)}\u001f${participantRef}`)}`;
}

function cleanupExploreForSemanticRef(ctx: any, fieldRef: string, semanticRef: string): void {
  const relationRefs = new Set<string>();
  for (const row of ctx.db.exploreRelationBacking.fromRef.filter(semanticRef)) {
    if (row.fieldRef === fieldRef) relationRefs.add(row.relationRef);
  }
  for (const row of ctx.db.exploreRelationBacking.toRef.filter(semanticRef)) {
    if (row.fieldRef === fieldRef) relationRefs.add(row.relationRef);
  }
  for (const relationRef of relationRefs) {
    if (ctx.db.exploreRelationBacking.relationRef.find(relationRef)) {
      ctx.db.exploreRelationBacking.relationRef.delete(relationRef);
    }
  }
  const entry = ctx.db.exploreEntryBacking.semanticRef.find(semanticRef);
  if (entry?.fieldRef === fieldRef) ctx.db.exploreEntryBacking.semanticRef.delete(semanticRef);
}

function requireContributionExploreEligible(ctx: any, fieldRef: string, semanticRef: string): void {
  const claims = contributionClaimsForRef(ctx, semanticRef);
  if (claims.length === 0) return;
  if (claims.some(row => row.fieldRef !== fieldRef)) fail('Explore semantic ref collides with a Contribution from another SharedField');
  const admitted = ctx.db.admittedContributionBacking.contributionRef.find(semanticRef);
  if (!admitted || admitted.fieldRef !== fieldRef) fail('Contribution must be explicitly admitted before Explore indexing');
  if (!contributionIsIndexEligible(ctx, admitted)) fail('Contribution is not index-eligible');
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
    validateHostedFieldVisibility(args.visibility);
    const contract = requireJsonObject(args.contractJson, 'SharedField contract');
    requireEqual(contract.field_ref, args.fieldRef, 'SharedField fieldRef');
    requireEqual(contract.kind, args.kind, 'SharedField kind');
    requireEqual(contract.visibility, args.visibility, 'SharedField visibility');
    const existing = ctx.db.sharedFieldBacking.fieldRef.find(args.fieldRef);
    if (existing) {
      requireFieldOwner(ctx, args.fieldRef);
      ctx.db.sharedFieldBacking.rowId.update({ ...existing, ...args });
      return;
    }
    ctx.db.sharedFieldBacking.insert({ rowId: 0n, ...args });
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
    if (!ctx.db.sharedFieldBacking.fieldRef.find(args.fieldRef)) fail(`Unknown SharedField semantic ref: ${args.fieldRef}`);
    requireFieldOwner(ctx, args.fieldRef);
    const existing = ctx.db.participantBacking.participantRef.find(args.participantRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef) fail('Participant cannot move between SharedFields by update');
      ctx.db.participantBacking.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.participantBacking.insert({ rowId: 0n, ...args });
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
    const readKey = audienceKey(args.fieldRef, args.participantRef);
    if (ctx.db.fieldReadGrant.audienceKey.find(readKey)) ctx.db.fieldReadGrant.audienceKey.delete(readKey);
  }
);

export const grant_field_read = spacetimedb.reducer(
  { fieldRef: t.string(), participantRef: t.string() },
  (ctx, args) => {
    requireFieldOwner(ctx, args.fieldRef);
    requireParticipantInField(ctx, args.participantRef, args.fieldRef);
    const authority = requirePersistentParticipantAuthority(ctx, args.fieldRef, args.participantRef);
    const row = {
      audienceKey: audienceKey(args.fieldRef, args.participantRef),
      fieldRef: args.fieldRef,
      participantRef: args.participantRef,
      actorIdentity: authority.actorIdentity,
      grantedAtMicros: nowMicros(ctx),
    };
    const existing = ctx.db.fieldReadGrant.audienceKey.find(row.audienceKey);
    if (existing) ctx.db.fieldReadGrant.audienceKey.update(row);
    else ctx.db.fieldReadGrant.insert(row);
  }
);

export const revoke_field_read = spacetimedb.reducer(
  { fieldRef: t.string(), participantRef: t.string() },
  (ctx, args) => {
    requireFieldOwner(ctx, args.fieldRef);
    const key = audienceKey(args.fieldRef, args.participantRef);
    if (ctx.db.fieldReadGrant.audienceKey.find(key)) ctx.db.fieldReadGrant.audienceKey.delete(key);
  }
);

export const submit_contribution = spacetimedb.reducer(
  {
    fieldRef: t.string(),
    contributorParticipantRef: t.string(),
    transportMessageId: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    requireParticipantAuthority(ctx, args.fieldRef, args.contributorParticipantRef, ['contributor']);
    ingressContribution(ctx, {
      fieldRef: args.fieldRef,
      contributorParticipantRef: args.contributorParticipantRef,
      sourceKind: 'direct',
      transportProvider: 'spacetimedb',
      transportMessageId: args.transportMessageId,
      contractJson: args.contractJson,
    });
  }
);

export const ingest_transported_contribution = spacetimedb.reducer(
  {
    fieldRef: t.string(),
    contributorParticipantRef: t.string(),
    sourceKind: t.string(),
    transportProvider: t.string(),
    transportMessageId: t.string(),
    contractJson: t.string(),
  },
  (ctx, args) => {
    requireFieldOwner(ctx, args.fieldRef);
    if (!CONTRIBUTION_TRANSPORTS.has(args.sourceKind)) fail(`Unsupported mediated Contribution source kind: ${args.sourceKind}`);
    ingressContribution(ctx, {
      fieldRef: args.fieldRef,
      contributorParticipantRef: args.contributorParticipantRef,
      sourceKind: args.sourceKind,
      transportProvider: args.transportProvider,
      transportMessageId: args.transportMessageId,
      contractJson: args.contractJson,
    });
  }
);

export const admit_contribution = spacetimedb.reducer(
  {
    ingressRef: t.string(),
    admissionParticipantRef: t.string(),
    visibility: t.string(),
    audienceRefsJson: t.string(),
    reason: t.string(),
    evidenceJson: t.string(),
  },
  (ctx, args) => {
    requireString(args.reason, 'Admission reason', 1_000);
    requireJsonObject(args.evidenceJson, 'Admission evidence', 8_192);
    const ingress = ctx.db.contributionIngressBacking.ingressRef.find(args.ingressRef);
    if (!ingress) fail(`Unknown Contribution ingress: ${args.ingressRef}`);
    requireAdmissionAuthority(ctx, ingress.fieldRef, args.admissionParticipantRef);
    if (ingress.state !== 'quarantined') fail(`Contribution ingress is ${ingress.state}, not quarantined`);
    validateContributionVisibility(ctx, ingress.fieldRef, args.visibility, args.audienceRefsJson);
    const existingSemantic = ctx.db.admittedContributionBacking.contributionRef.find(ingress.claimedContributionRef);
    if (existingSemantic && existingSemantic.ingressRef !== ingress.ingressRef) {
      fail('Another ingress event is already admitted under this Contribution semantic ref');
    }
    const now = nowMicros(ctx);
    const decisionRef = admissionDecisionRef(ingress.ingressRef, 'admitted', now, args.admissionParticipantRef);
    const serverProvenanceJson = JSON.stringify({
      schema: 'oi.admission-provenance/v1',
      ingress_ref: ingress.ingressRef,
      target_field_ref: ingress.fieldRef,
      decided_at_micros: String(now),
      source_kind: ingress.sourceKind,
      payload_fingerprint: ingress.payloadFingerprint,
    });
    ctx.db.admissionDecision.insert({
      decisionRef,
      ingressRef: ingress.ingressRef,
      fieldRef: ingress.fieldRef,
      disposition: 'admitted',
      admissionActorIdentity: ctx.sender,
      admissionParticipantRef: args.admissionParticipantRef,
      decidedAtMicros: now,
      reason: args.reason,
      evidenceJson: args.evidenceJson,
      serverProvenanceJson,
    });
    ctx.db.admittedContributionBacking.insert({
      rowId: 0n,
      ingressRef: ingress.ingressRef,
      contributionRef: ingress.claimedContributionRef,
      fieldRef: ingress.fieldRef,
      contributorParticipantRef: ingress.contributorParticipantRef,
      visibility: args.visibility,
      audienceRefsJson: args.audienceRefsJson,
      admissionDecisionRef: decisionRef,
      admittedAtMicros: now,
      contractJson: ingress.contractJson,
    });
    ctx.db.contributionIngressBacking.ingressRef.update({ ...ingress, state: 'admitted' });
    updateContributionReceiptState(ctx, ingress, 'admitted');
    /* Admission deliberately creates no index policy, Explore row, Projection or Action. */
  }
);

export const reject_contribution = spacetimedb.reducer(
  {
    ingressRef: t.string(),
    admissionParticipantRef: t.string(),
    reason: t.string(),
    evidenceJson: t.string(),
  },
  (ctx, args) => {
    requireString(args.reason, 'Rejection reason', 1_000);
    requireJsonObject(args.evidenceJson, 'Rejection evidence', 8_192);
    const ingress = ctx.db.contributionIngressBacking.ingressRef.find(args.ingressRef);
    if (!ingress) fail(`Unknown Contribution ingress: ${args.ingressRef}`);
    requireAdmissionAuthority(ctx, ingress.fieldRef, args.admissionParticipantRef);
    if (ingress.state !== 'quarantined') fail(`Contribution ingress is ${ingress.state}, not quarantined`);
    const now = nowMicros(ctx);
    const decisionRef = admissionDecisionRef(ingress.ingressRef, 'rejected', now, args.admissionParticipantRef);
    ctx.db.admissionDecision.insert({
      decisionRef,
      ingressRef: ingress.ingressRef,
      fieldRef: ingress.fieldRef,
      disposition: 'rejected',
      admissionActorIdentity: ctx.sender,
      admissionParticipantRef: args.admissionParticipantRef,
      decidedAtMicros: now,
      reason: args.reason,
      evidenceJson: args.evidenceJson,
      serverProvenanceJson: JSON.stringify({
        schema: 'oi.admission-provenance/v1',
        ingress_ref: ingress.ingressRef,
        target_field_ref: ingress.fieldRef,
        decided_at_micros: String(now),
        payload_fingerprint: ingress.payloadFingerprint,
      }),
    });
    ctx.db.contributionIngressBacking.ingressRef.update({ ...ingress, state: 'rejected' });
    updateContributionReceiptState(ctx, ingress, 'rejected');
    cleanupExploreForSemanticRef(ctx, ingress.fieldRef, ingress.claimedContributionRef);
  }
);

export const withdraw_contribution = spacetimedb.reducer(
  {
    ingressRef: t.string(),
    admissionParticipantRef: t.string(),
    reason: t.string(),
    evidenceJson: t.string(),
  },
  (ctx, args) => {
    requireString(args.reason, 'Withdrawal reason', 1_000);
    requireJsonObject(args.evidenceJson, 'Withdrawal evidence', 8_192);
    const ingress = ctx.db.contributionIngressBacking.ingressRef.find(args.ingressRef);
    if (!ingress) fail(`Unknown Contribution ingress: ${args.ingressRef}`);
    requireAdmissionAuthority(ctx, ingress.fieldRef, args.admissionParticipantRef);
    if (ingress.state !== 'admitted') fail(`Contribution ingress is ${ingress.state}, not admitted`);
    const admitted = ctx.db.admittedContributionBacking.ingressRef.find(ingress.ingressRef);
    if (!admitted) throw new Error(`Missing admitted Contribution for ${ingress.ingressRef}`);
    const now = nowMicros(ctx);
    const decisionRef = admissionDecisionRef(ingress.ingressRef, 'withdrawn', now, args.admissionParticipantRef);
    ctx.db.admissionDecision.insert({
      decisionRef,
      ingressRef: ingress.ingressRef,
      fieldRef: ingress.fieldRef,
      disposition: 'withdrawn',
      admissionActorIdentity: ctx.sender,
      admissionParticipantRef: args.admissionParticipantRef,
      decidedAtMicros: now,
      reason: args.reason,
      evidenceJson: args.evidenceJson,
      serverProvenanceJson: JSON.stringify({
        schema: 'oi.admission-provenance/v1',
        ingress_ref: ingress.ingressRef,
        target_field_ref: ingress.fieldRef,
        decided_at_micros: String(now),
        payload_fingerprint: ingress.payloadFingerprint,
      }),
    });
    cleanupExploreForSemanticRef(ctx, ingress.fieldRef, admitted.contributionRef);
    if (ctx.db.contributionIndexPolicy.ingressRef.find(ingress.ingressRef)) {
      ctx.db.contributionIndexPolicy.ingressRef.delete(ingress.ingressRef);
    }
    ctx.db.admittedContributionBacking.ingressRef.delete(ingress.ingressRef);
    ctx.db.contributionIngressBacking.ingressRef.update({ ...ingress, state: 'withdrawn' });
    updateContributionReceiptState(ctx, ingress, 'withdrawn');
  }
);

export const set_contribution_index_eligibility = spacetimedb.reducer(
  {
    ingressRef: t.string(),
    admissionParticipantRef: t.string(),
    eligible: t.bool(),
    reason: t.string(),
    evidenceJson: t.string(),
  },
  (ctx, args) => {
    requireString(args.reason, 'Index decision reason', 1_000);
    requireJsonObject(args.evidenceJson, 'Index decision evidence', 8_192);
    const ingress = ctx.db.contributionIngressBacking.ingressRef.find(args.ingressRef);
    if (!ingress) fail(`Unknown Contribution ingress: ${args.ingressRef}`);
    requireAdmissionAuthority(ctx, ingress.fieldRef, args.admissionParticipantRef);
    if (ingress.state !== 'admitted') fail('Only an admitted Contribution can receive index eligibility');
    const admitted = ctx.db.admittedContributionBacking.ingressRef.find(ingress.ingressRef);
    if (!admitted) throw new Error(`Missing admitted Contribution for ${ingress.ingressRef}`);
    const now = nowMicros(ctx);
    const decisionRef = indexDecisionRef(ingress.ingressRef, args.eligible, now, args.admissionParticipantRef);
    ctx.db.contributionIndexDecision.insert({
      decisionRef,
      ingressRef: ingress.ingressRef,
      fieldRef: ingress.fieldRef,
      eligible: args.eligible,
      decisionActorIdentity: ctx.sender,
      decisionParticipantRef: args.admissionParticipantRef,
      decidedAtMicros: now,
      reason: args.reason,
      evidenceJson: args.evidenceJson,
    });
    const current = ctx.db.contributionIndexPolicy.ingressRef.find(ingress.ingressRef);
    const policy = {
      ingressRef: ingress.ingressRef,
      fieldRef: ingress.fieldRef,
      eligible: args.eligible,
      decisionRef,
      decidedAtMicros: now,
    };
    if (current) ctx.db.contributionIndexPolicy.ingressRef.update(policy);
    else ctx.db.contributionIndexPolicy.insert(policy);
    if (!args.eligible) cleanupExploreForSemanticRef(ctx, ingress.fieldRef, admitted.contributionRef);
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
    if (!['published', 'withdrawn'].includes(args.state)) fail(`Unsupported Projection state: ${args.state}`);
    validateProjectionAudience(ctx, args.fieldRef, contract);
    requireParticipantInField(ctx, args.publisherParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.publisherParticipantRef, ['contributor']);
    const expectedKey = `${args.projectionRef}@${args.projectionRevision}`;
    if (args.projectionKey !== expectedKey) fail(`Projection key must be ${expectedKey}`);

    const existing = ctx.db.projectionBacking.projectionKey.find(args.projectionKey);
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
    for (const row of ctx.db.projectionBacking.projectionRef.filter(args.projectionRef)) {
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
    ctx.db.projectionBacking.insert({ rowId: 0n, ...args });
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
    requireContributionExploreEligible(ctx, args.fieldRef, args.semanticRef);
    const existing = ctx.db.exploreEntryBacking.semanticRef.find(args.semanticRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef) fail('Explore entry cannot move between SharedFields');
      ctx.db.exploreEntryBacking.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.exploreEntryBacking.insert({ rowId: 0n, ...args });
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
    const from = ctx.db.exploreEntryBacking.semanticRef.find(args.fromRef);
    const to = ctx.db.exploreEntryBacking.semanticRef.find(args.toRef);
    if (!from) fail(`Unknown Explore source semantic ref: ${args.fromRef}`);
    if (!to) fail(`Unknown Explore target semantic ref: ${args.toRef}`);
    if (from.fieldRef !== args.fieldRef || to.fieldRef !== args.fieldRef) {
      fail('Explore relations cannot cross a SharedField authority boundary implicitly');
    }
    const existing = ctx.db.exploreRelationBacking.relationRef.find(args.relationRef);
    if (existing) {
      if (existing.fieldRef !== args.fieldRef) fail('Explore relation cannot move between SharedFields');
      ctx.db.exploreRelationBacking.rowId.update({ ...existing, ...args });
    } else {
      ctx.db.exploreRelationBacking.insert({ rowId: 0n, ...args });
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
    const target = ctx.db.exploreEntryBacking.semanticRef.find(args.targetRef);
    if (!target || target.fieldRef !== args.fieldRef || !callerCanSeeExploreEntry(ctx, target)) {
      fail(`Unknown or unavailable Watch target in SharedField ${args.fieldRef}: ${args.targetRef}`);
    }
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
