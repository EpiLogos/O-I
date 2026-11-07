import { schema, table, t, SenderError } from 'spacetimedb/server';

const CONTACT_WINDOW_MICROS = 60_000_000n;
const CONTACT_LIMIT_PER_WINDOW = 3;
const CONTACT_MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const EXCHANGE_MAX_TTL_SECONDS = 24 * 60 * 60;
const EXCHANGE_MAX_USES = 64;
const EXCHANGE_MAX_SCOPE_BYTES = 8 * 1024;
const EXCHANGE_MAX_OUTSTANDING_REQUESTS = 8;
const EXCHANGE_PROTOCOLS = new Set(['a2a', 'mcp', 'http']);
const EXCHANGE_MODES = new Set(['message:send', 'task', 'data']);
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
const PRESENCE_STATES = new Set(['entered', 'away']);
const STAGE_SCHEMA = 'oi.shared-stage/v1';
const STAGE_MAX_EDITS = 64;
const STAGE_MAX_BYTES = 16 * 1024;

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

/* A contribution to something a world shows (O-I #858, SF07) rides these same
 * rows: its ingress row's sourceKind is `world` (no transport or Exchange
 * protocol is), its field is the world it waits in, and admitted it carries the
 * visibility `world` (no SharedField audience is). The SharedField's own acts
 * and views leave such rows alone; the World's acts and views at the end of
 * this module are theirs. */
const WORLD_CONTRIBUTION_SOURCE = 'world';
const WORLD_CONTRIBUTION_VISIBILITY = 'world';

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

/*
 * Live presence and the optional Shared Stage:
 *
 * explicit enter_field by an authorised caller
 *      ↓ PRIVATE presence row (cleared on disconnect / leave / revocation)
 * caller-filtered field_presence View — the live "who is in the field" relation
 *
 * deliberate open_shared_stage by a contributor
 *      ↓ PRIVATE revisioned stage row + explicit follower rows
 * shared_stage View (open stages of visible fields) + my_stage_follow View
 *
 * The stage carries admitted shared presentation state only (refs, revisions,
 * scene/focus, approved authored edits, causal Activity/Action refs). Local
 * Workspace tabs/splits/geometry, camera/read position, private drafts,
 * Search history, Agent transcripts, SessionSpace state, raw Nara/Personal
 * state and renderer buffers have no columns here and no reducer that could
 * write them.
 */
const fieldPresence = table(
  { name: 'field_presence_backing', public: false },
  {
    presenceKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    participantRef: t.string().index('btree'),
    actorIdentity: t.identity().index('btree'),
    state: t.string(),
    enteredAtMicros: t.u64(),
    updatedAtMicros: t.u64(),
  }
);

// Connections are authority-qualified occupancy claims. The visible body is
// one participant per field; a reader with the same credential owns no claim.
// A separate backing table keeps the existing presence row/schema stable.
const fieldPresenceConnection = table(
  { name: 'field_presence_connection_backing', public: false },
  {
    claimKey: t.string().primaryKey(),
    presenceKey: t.string().index('btree'),
    connectionRef: t.string().index('btree'),
    actorIdentity: t.identity(),
  }
);

/*
 * Activity liveness: the owner-side producer's live account of one published
 * activity entry, held only while that producer stays connected.
 *
 * owner-side producer (reads its Factory run read-only) → put_activity_liveness
 *      ↓ PRIVATE row, one per (field, activity entry), bound to the producing
 *        identity AND its connection; heartbeat refreshed every interval
 * caller-filtered activity_liveness View
 *
 * A publication-time `meta.liveness` is a claim; this row is the evidence.
 * clear_activity_liveness (graceful stop) or the producing connection's
 * disconnect removes it, so liveness degrades instead of being synthesised.
 */
const activityLivenessBacking = table(
  { name: 'activity_liveness_backing', public: false },
  {
    activityKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    activityRef: t.string().index('btree'),
    producerParticipantRef: t.string(),
    producerIdentity: t.identity().index('btree'),
    producerConnection: t.string().index('btree'),
    ownerState: t.string(),
    ownerRevision: t.u64(),
    observedAtMicros: t.u64(),
    heartbeatAtMicros: t.u64(),
  }
);

const sharedStageBacking = table(
  { name: 'shared_stage_backing', public: false },
  {
    stageRef: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    revision: t.u64(),
    state: t.string().index('btree'),
    presenterRef: t.string().index('btree'),
    subjectRef: t.string(),
    contractJson: t.string(),
    openedAtMicros: t.u64(),
    updatedAtMicros: t.u64(),
    updatedByParticipantRef: t.string(),
  }
);

/* The explicit follower relation. A row exists while the participant is
 * following; unfollowing removes it and leaves the participant's field
 * authority, presence and local view untouched. Re-follow rebinds to the
 * stage's current revision. */
const stageFollower = table(
  { public: false },
  {
    followKey: t.string().primaryKey(),
    stageRef: t.string().index('btree'),
    fieldRef: t.string().index('btree'),
    followerParticipantRef: t.string().index('btree'),
    actorIdentity: t.identity().index('btree'),
    followedAtRevision: t.u64(),
    followedAtMicros: t.u64(),
  }
);

/*
 * The collective temporal projection (docs/architecture/shared-participation.md, FieldNow and FieldDay):
 *
 * a participant's local NOW/DAY truth (Central, on its own Workcell)
 *      ↓ explicit, audience-scoped, revision-checked put_field_now / put_field_day
 * PRIVATE current FieldNow row (one per field) + immutable revision history
 * PRIVATE current FieldDay rows (one per field interval) + immutable history
 *      ↓
 * caller-filtered field_now / field_day Views
 *
 * These rows carry refs and native revisions only. They are the first
 * material host of the collective live projection, never the owner of local
 * Central time or NOW identity: no column and no contract field can hold a
 * path, session ref, gateway address or token, and the server refuses
 * contracts that try to smuggle one into a string.
 */
const fieldNowBacking = table(
  { name: 'field_now_backing', public: false },
  {
    fieldRef: t.string().primaryKey(),
    revision: t.u64(),
    contractJson: t.string(),
    updatedByParticipantRef: t.string(),
    updatedAtMicros: t.u64(),
  }
);

const fieldNowRevision = table(
  { name: 'field_now_revision', public: false },
  {
    revisionKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    revision: t.u64(),
    contractJson: t.string(),
    writtenByParticipantRef: t.string(),
    writtenAtMicros: t.u64(),
  }
);

const fieldDayBacking = table(
  { name: 'field_day_backing', public: false },
  {
    dayKey: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    intervalStart: t.string(),
    intervalEnd: t.string(),
    revision: t.u64(),
    contractJson: t.string(),
    updatedByParticipantRef: t.string(),
    updatedAtMicros: t.u64(),
  }
);

const fieldDayRevision = table(
  { name: 'field_day_revision', public: false },
  {
    revisionKey: t.string().primaryKey(),
    dayKey: t.string().index('btree'),
    fieldRef: t.string().index('btree'),
    revision: t.u64(),
    contractJson: t.string(),
    writtenByParticipantRef: t.string(),
    writtenAtMicros: t.u64(),
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


const exchangeRequest = table(
  { name: 'exchange_request', public: false },
  {
    requestRef: t.string().primaryKey(),
    fieldRef: t.string().index('btree'),
    initiatorParticipantRef: t.string().index('btree'),
    initiatorActorIdentity: t.identity().index('btree'),
    counterpartyParticipantRef: t.string().index('btree'),
    purpose: t.string(),
    scopeJson: t.string(),
    protocol: t.string().index('btree'),
    bindingRef: t.string(),
    bindingRevision: t.u32(),
    modesJson: t.string(),
    requestedMaxUses: t.u32(),
    requestedTtlSeconds: t.u32(),
    state: t.string().index('btree'),
    createdAtMicros: t.u64(),
    requestExpiresAtMicros: t.u64(),
    decisionRef: t.string(),
  }
);

const exchangeGrant = table(
  { name: 'exchange_grant', public: false },
  {
    grantRef: t.string().primaryKey(),
    requestRef: t.string().unique(),
    fieldRef: t.string().index('btree'),
    initiatorParticipantRef: t.string().index('btree'),
    initiatorActorIdentity: t.identity().index('btree'),
    counterpartyParticipantRef: t.string().index('btree'),
    purpose: t.string(),
    scopeJson: t.string(),
    protocol: t.string().index('btree'),
    bindingRef: t.string(),
    bindingRevision: t.u32(),
    modesJson: t.string(),
    maxUses: t.u32(),
    usedUses: t.u32(),
    state: t.string().index('btree'),
    grantedAtMicros: t.u64(),
    expiresAtMicros: t.u64(),
    endedAtMicros: t.u64(),
    grantorIdentity: t.identity().index('btree'),
    decisionRef: t.string(),
    provenanceJson: t.string(),
  }
);

const exchangeUse = table(
  { name: 'exchange_use', public: false },
  {
    useKey: t.string().primaryKey(),
    grantRef: t.string().index('btree'),
    operationId: t.string(),
    fieldRef: t.string().index('btree'),
    actorIdentity: t.identity().index('btree'),
    counterpartyParticipantRef: t.string(),
    protocol: t.string(),
    bindingRef: t.string(),
    bindingRevision: t.u32(),
    mode: t.string(),
    purpose: t.string(),
    scopeJson: t.string(),
    usedAtMicros: t.u64(),
    demandFingerprint: t.string(),
  }
);

/*
 * Worlds first (O-I #858). A world stands in the one field on its own, not
 * inside a SharedField: it carries its owner (worldOwner, first creator, never
 * served), its body record (`aikit.world-body/v1`, so every viewer draws the
 * same planet) and whether its owner has linked it into the field. What its
 * owner shows opens a clearing: to the field, to the public, or at one star.
 * Everything else lies under one even cloud — nothing of it is stored here,
 * and nothing a viewer may not see changes any row that viewer is served.
 * A star is a SharedField row of kind `star` someone lit (fieldOwner is its
 * lighter); a world gathered at a star is a relation, asked or gathered.
 * All three are private tables behind caller-filtered views; no existing
 * table changes, so today's rows read as they did.
 */
const worldBacking = table(
  { name: 'world_backing', public: false },
  {
    worldRef: t.string().primaryKey(),
    bodyJson: t.string(),
    linked: t.bool(),
    updatedAtMicros: t.u64(),
  }
);

const worldOwner = table(
  { public: false },
  {
    worldRef: t.string().primaryKey(),
    ownerIdentity: t.identity().index('btree'),
    createdAtMicros: t.u64(),
  }
);

const worldClearingBacking = table(
  { name: 'world_clearing_backing', public: false },
  {
    clearingKey: t.string().primaryKey(),
    worldRef: t.string().index('btree'),
    partRef: t.string(),
    starRef: t.string().index('btree'),
    audience: t.string(),
    shownJson: t.string(),
    shownAtMicros: t.u64(),
  }
);

const worldGatheringBacking = table(
  { name: 'world_gathering_backing', public: false },
  {
    gatheringKey: t.string().primaryKey(),
    starRef: t.string().index('btree'),
    worldRef: t.string().index('btree'),
    state: t.string(),
    askedAtMicros: t.u64(),
    gatheredAtMicros: t.u64(),
  }
);

/* A star's day (O-I #858, SF04): who came to the star, who was let in, who
 * showed something there and who left, in the order they happened. It names
 * that something was shown and of what kind, never what: what is shown at a
 * star is the clearing's, and goes back under cloud with it. */
const starDayBacking = table(
  { name: 'star_day_backing', public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    starRef: t.string().index('btree'),
    worldRef: t.string(),
    what: t.string(),
    kind: t.string(),
    atMicros: t.u64(),
  }
);

/* What was said at a star (O-I #858, SF06): a question, a finding, a
 * correction or a reproduction, said by a world gathered there to something
 * shown at the star or to something said there before. It stays its sayer's,
 * under their world's name, until they unsay it: it enters no one's world,
 * and leaving the star does not take it back. When what it was said to is
 * taken back, the saying stands and names nothing it was said to. A table of
 * its own, so no existing table changes. */
const starSayingBacking = table(
  { name: 'star_saying_backing', public: false },
  {
    sayingRef: t.string().primaryKey(),
    starRef: t.string().index('btree'),
    worldRef: t.string().index('btree'),
    toWorldRef: t.string(),
    toPartRef: t.string(),
    toSayingRef: t.string(),
    what: t.string(),
    words: t.string(),
    saidAtMicros: t.u64(),
  }
);

/* What a world withdrew from the field (O-I #858, SF14): a clearing withdrawn,
 * narrowed from the public to the field, taken back at a star, or the world
 * itself taken out of the field. Whoever read it reads it as withdrawn there,
 * in words, never silently gone: the row names whose world, from what reach
 * (and at which star), of what kind and when — never which part, nor what it
 * showed, which went back under cloud with the clearing. A table of its own,
 * so no existing table changes. */
const worldWithdrawalBacking = table(
  { name: 'world_withdrawal_backing', public: false },
  {
    rowId: t.u64().primaryKey().autoInc(),
    worldRef: t.string().index('btree'),
    starRef: t.string().index('btree'),
    reach: t.string(),
    kind: t.string(),
    withdrawnAtMicros: t.u64(),
  }
);

/* A piece of work shown at a star (O-I #858, SF12): Software Factory's own
 * reading of a Run (`factory.shown-work/v1`: its agents at work, what they
 * made and where it stands, never its prompts, keys, files or machines),
 * shown by the world whose work it is, to the star's lighter and the worlds
 * gathered there. It is live while the Run is open and stands as it was kept
 * once the Run closes. Watching changes nothing: no one but its world writes
 * it. A table of its own, so no existing table changes. */
const starWorkBacking = table(
  { name: 'star_work_backing', public: false },
  {
    workKey: t.string().primaryKey(),
    starRef: t.string().index('btree'),
    worldRef: t.string().index('btree'),
    workRef: t.string(),
    shownJson: t.string(),
    revision: t.u64(),
    standing: t.string(),
    shownAtMicros: t.u64(),
    updatedAtMicros: t.u64(),
  }
);

/* Whether a work shown at a star still answers (O-I #858; manual §17.2: a run
 * of work shown in the field "is live while its source answers"): its world's
 * window, on the connection it showed the work from. Showing a live work, or
 * showing it again, makes it answer on that connection; that connection gone,
 * it answers no more, and the work reads as it was last shown until its window
 * shows it again. A kept work stands as it was kept and needs no answer. Two
 * tables of their own, so no existing table changes: what is served, and the
 * connection it answers on, which is never served. */
const starWorkAnswerBacking = table(
  { name: 'star_work_answer_backing', public: false },
  {
    workKey: t.string().primaryKey(),
    starRef: t.string().index('btree'),
    worldRef: t.string().index('btree'),
    workRef: t.string(),
    answeredAtMicros: t.u64(),
  }
);
const starWorkAnswerConnection = table(
  { name: 'star_work_answer_connection_backing', public: false },
  {
    workKey: t.string().primaryKey(),
    connectionRef: t.string().index('btree'),
    answerIdentity: t.identity().index('btree'),
  }
);

/* Whether a world answers (O-I #858, SF11; manual §2): its owner's window, on
 * the connection it answers from. A window of the owner's says its world
 * answers, and the world answers while any such window's connection stands;
 * the last of them gone (its machine off), the world is away, and reads as its
 * owner last left it, since when. Nothing else of the world moves for it: its
 * clearings stand as they were, and nothing is drawn in their place. Two
 * tables of their own, so no existing table changes: what is served (whose
 * world, whether it answers and since when), and the connections it answers
 * on, which are never served. */
const worldAnswerBacking = table(
  { name: 'world_answer_backing', public: false },
  {
    worldRef: t.string().primaryKey(),
    answering: t.bool(),
    sinceMicros: t.u64(),
  }
);
const worldAnswerConnection = table(
  { name: 'world_answer_connection_backing', public: false },
  {
    claimKey: t.string().primaryKey(),
    worldRef: t.string().index('btree'),
    connectionRef: t.string().index('btree'),
    answerIdentity: t.identity().index('btree'),
  }
);

/* A task offered at a star (O-I #858, SF13): Software Factory's offer of one
 * unit of a programme (`factory.task-offer/v1`) under the grant its offerer
 * set, for another world gathered at the star to take up on its own machine.
 * What comes back (`factory.task-offer-return/v1`) is served to the offerer
 * and the taker alone, and stays the taker's until the offerer accepts it;
 * the offerer revokes the offer at any moment before. A table of its own. */
const starOfferBacking = table(
  { name: 'star_offer_backing', public: false },
  {
    offerRef: t.string().primaryKey(),
    starRef: t.string().index('btree'),
    worldRef: t.string().index('btree'),
    offerJson: t.string(),
    lapsesAtMicros: t.u64(),
    state: t.string(),
    takerWorldRef: t.string(),
    returnJson: t.string(),
    offeredAtMicros: t.u64(),
    movedAtMicros: t.u64(),
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
  fieldPresence,
  fieldPresenceConnection,
  activityLivenessBacking,
  sharedStageBacking,
  stageFollower,
  fieldNowBacking,
  fieldNowRevision,
  fieldDayBacking,
  fieldDayRevision,
  contact,
  contactPolicy,
  contactRate,
  exchangeRequest,
  exchangeGrant,
  exchangeUse,
  worldBacking,
  worldOwner,
  worldClearingBacking,
  worldGatheringBacking,
  starDayBacking,
  starSayingBacking,
  starWorkBacking,
  starOfferBacking,
  starWorkAnswerBacking,
  starWorkAnswerConnection,
  worldWithdrawalBacking,
  worldAnswerBacking,
  worldAnswerConnection,
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

function presenceKey(fieldRef: string, participantRef: string): string {
  return `${fieldRef}|${participantRef}`;
}

function followKey(stageRef: string, followerParticipantRef: string): string {
  return `${stageRef}|${followerParticipantRef}`;
}

/* The server checks the stage contract's shape, currentness and attribution;
 * the client composes it through the oi.shared-stage/v1 owner contract. The
 * stage carries refs/revisions and admitted edits — never source bodies or
 * local application state. */
function requireStageContractShape(
  contract: Record<string, any>,
  stageRef: string,
  fieldRef: string,
  revision: bigint,
  state: string,
  presenterRef: string
): void {
  requireEqual(contract.schema, STAGE_SCHEMA, 'Shared Stage schema');
  requireEqual(contract.shared_stage_ref, stageRef, 'Shared Stage stageRef');
  requireEqual(contract.field_ref, fieldRef, 'Shared Stage fieldRef');
  requireEqual(BigInt(contract.revision), revision, 'Shared Stage revision');
  requireEqual(contract.state, state, 'Shared Stage state');
  requireEqual(contract.presenter_ref, presenterRef, 'Shared Stage presenterRef');
  requireString(String(contract.subject_ref ?? ''), 'Shared Stage subjectRef', 512);
  for (const optionalRef of ['scene_ref', 'focus_ref']) {
    if (contract[optionalRef] !== undefined) requireString(String(contract[optionalRef]), `Shared Stage ${optionalRef}`, 512);
  }
  for (const locusName of ['presentation', 'expression']) {
    const locus = contract[locusName];
    if (locus === undefined) continue;
    if (locus === null || typeof locus !== 'object' || Array.isArray(locus)) fail(`Shared Stage ${locusName} must be an object`);
    requireString(String(locus.ref ?? ''), `Shared Stage ${locusName}.ref`, 512);
    if (locus.revision !== undefined && !Number.isInteger(locus.revision)) fail(`Shared Stage ${locusName}.revision must be an integer`);
  }
  if (contract.causal !== undefined) {
    const causal = contract.causal;
    if (causal === null || typeof causal !== 'object' || Array.isArray(causal)) fail('Shared Stage causal must be an object');
    requireString(String(causal.kind ?? ''), 'Shared Stage causal.kind', 128);
    requireString(String(causal.ref ?? ''), 'Shared Stage causal.ref', 512);
  }
  if (!Array.isArray(contract.edits)) fail('Shared Stage edits must be an array');
  if (contract.edits.length > STAGE_MAX_EDITS) fail(`Shared Stage edits exceed ${STAGE_MAX_EDITS} entries`);
  if (!Array.isArray(contract.provenance) || contract.provenance.length === 0) fail('Shared Stage provenance must be a non-empty array');
}

/* Prior edits are immutable history; advancing may append at most one edit,
 * attributed to the advancing participant at the new revision. */
function requireStageEdits(
  priorEdits: any[],
  nextEdits: any[],
  actorParticipantRef: string,
  nextRevision: bigint,
  appendAllowed: boolean
): void {
  if (JSON.stringify(nextEdits.slice(0, priorEdits.length)) !== JSON.stringify(priorEdits)) {
    fail('Shared Stage edits are immutable history');
  }
  if (nextEdits.length === priorEdits.length) return;
  if (!appendAllowed) fail('Shared Stage edits cannot change unless the stage advances');
  if (nextEdits.length !== priorEdits.length + 1) fail('Shared Stage advances append at most one edit');
  const appended = nextEdits[nextEdits.length - 1];
  if (appended === null || typeof appended !== 'object' || Array.isArray(appended)) fail('Shared Stage edit must be an object');
  requireEqual(appended.participant_ref, actorParticipantRef, 'Shared Stage edit participantRef');
  requireEqual(BigInt(appended.at_revision), nextRevision, 'Shared Stage edit at_revision');
  const change = appended.change;
  if (change === null || typeof change !== 'object' || Array.isArray(change) || Object.keys(change).length === 0) {
    fail('Shared Stage edit change must be a non-empty object');
  }
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

function exchangeUseKey(grantRef: string, operationId: string): string {
  return `exchange-use:${fingerprintString(`${grantRef}\u001f${operationId}`)}`;
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
  // a contribution accepted in a world is read where the world is read, never through a field that happens to carry the world's name
  if (row.visibility === WORLD_CONTRIBUTION_VISIBILITY) return false;
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
      if (!current || !callerCanSeeProjection(ctx, current)) return false;
      const contract = parseStoredJson(current.contractJson, 'Projection contractJson');
      // An entry a World publication carries names that publication's
      // Projection directly: it is served exactly to that Projection's
      // current audience, so a private or narrowed publication narrows every
      // entry it carries. Withdrawal withdraws the representation, not the
      // world's addressability, so it binds whatever the latest state. The
      // binding holds only for the Projection whose subject is the entry's
      // own world.
      if (projectionRef === directProjectionRef && projectionRef !== row.semanticRef && contract.subject?.ref === row.worldRef) return true;
      if (current.state !== 'published') return false;
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

/** Quarantined material visible only to the owner of its receiving field.
 * This is the inspection aperture used before admit/reject; it exposes no
 * other field's ingress and creates no admission or index standing. */
export const owner_pending_contribution = spacetimedb.view(
  { name: 'owner_pending_contribution', public: true },
  t.array(contributionIngressBacking.rowType),
  (ctx) => {
    const pending = [];
    for (const owned of ctx.db.fieldOwner.ownerIdentity.filter(ctx.sender)) {
      for (const ingress of ctx.db.contributionIngressBacking.fieldRef.filter(owned.fieldRef)) {
        if (ingress.state === 'quarantined' && ingress.sourceKind !== WORLD_CONTRIBUTION_SOURCE) pending.push(ingress);
      }
    }
    return pending;
  }
);

/* Live presence: who is actually in the field right now. Rows exist only
 * while a caller is connected and entered; disconnect clears them. */
export const field_presence = spacetimedb.view(
  { name: 'field_presence', public: true },
  t.array(fieldPresence.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const field of visibleFieldRows(ctx)) {
      for (const row of ctx.db.fieldPresence.fieldRef.filter(field.fieldRef)) {
        if (Array.from(ctx.db.fieldPresenceConnection.presenceKey.filter(row.presenceKey)).some((claim: any) => identityStillOwnsParticipant(ctx, row.fieldRef, row.participantRef, claim.actorIdentity))) rows.push(row);
      }
    }
    return rows;
  }
);

/* The live account of each caller-visible activity entry. A row is served
 * only while its activity entry is visible to the caller and its producer is
 * still the field owner or a live contributor+ participant of the field. */
export const activity_liveness = spacetimedb.view(
  { name: 'activity_liveness', public: true },
  t.array(activityLivenessBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const field of visibleFieldRows(ctx)) {
      const owner = ctx.db.fieldOwner.fieldRef.find(field.fieldRef);
      for (const row of ctx.db.activityLivenessBacking.fieldRef.filter(field.fieldRef)) {
        const entry = ctx.db.exploreEntryBacking.semanticRef.find(row.activityRef);
        if (!entry || entry.fieldRef !== row.fieldRef || entry.kind !== 'activity') continue;
        if (!callerCanSeeExploreEntry(ctx, entry)) continue;
        const producerIsOwner = Boolean(owner && owner.ownerIdentity.isEqual(row.producerIdentity));
        if (!producerIsOwner && !activityProducerStillAuthorised(ctx, row)) continue;
        rows.push(row);
      }
    }
    return rows;
  }
);

/* The current open Shared Stage of every caller-visible field. A closed
 * stage leaves this View (its follow relation is gone with it); the stage
 * contract holds admitted shared presentation state only. */
export const shared_stage = spacetimedb.view(
  { name: 'shared_stage', public: true },
  t.array(sharedStageBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const field of visibleFieldRows(ctx)) {
      for (const row of ctx.db.sharedStageBacking.fieldRef.filter(field.fieldRef)) {
        if (row.state === 'open') rows.push(row);
      }
    }
    return rows;
  }
);

/* The caller's own explicit follower relation, and nothing of anyone else's. */
export const my_stage_follow = spacetimedb.view(
  { name: 'my_stage_follow', public: true },
  t.array(stageFollower.rowType),
  (ctx) => Array.from(ctx.db.stageFollower.actorIdentity.filter(ctx.sender))
);

/* ---------- FieldNow / FieldDay: shape, leak refusal, audience ---------- */

const FIELD_NOW_SCHEMA = 'oi.field-now/v1';
const FIELD_DAY_SCHEMA = 'oi.field-day/v1';
const FIELD_TIME_MAX_BYTES = 32 * 1024;
const CHILD_NOW_STATES = new Set(['active', 'waiting', 'blocked', 'quiescent', 'resolved', 'archived']);
const NOW_REF_PATTERN = /^central:now:[a-z][a-z0-9-]*(?::[A-Za-z0-9._-]+)+$/;
const DAY_REF_PATTERN = /^central:day:[a-z][a-z0-9-]*(?::[A-Za-z0-9._-]+)+$/;
const WORKCELL_REF_PATTERN = /^workcell:[a-z0-9][a-z0-9.-]*$/;
const WORLD_REF_PATTERN = /^(?:control:root|project:[A-Za-z0-9._-]+|world:[A-Za-z0-9._:-]+)$/;
/* Mirrors shared-field/field-now.mjs FIELD_TIME_LEAK_PATTERNS: local-only
 * identity beyond refs is refused server-side too, whatever the client did. */
const FIELD_TIME_LEAKS: [string, RegExp][] = [
  ['agent-session-ref', /(^|[^A-Za-z0-9])agent-session[:/]|[a-z0-9-]+:session:[0-9a-f]{8}/],
  ['session-ref', /(?:^|[^A-Za-z0-9])(?:session-space|agent-session|session)[:/][A-Za-z0-9]/],
  ['gateway-address', /\bwss?:\/\/|\b(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}\b/],
  ['gateway-token', /AIKIT_GATEWAY_TOKEN|\bBearer\s+\S{8,}/],
  ['workcell-endpoint', /\b(?:redis|https?|tcp|grpc|postgres(?:ql)?):\/\/(?:localhost|127\.|\[?::1|(?:\d{1,3}\.){3}\d{1,3})/],
  ['local-home-path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ['local-absolute-path', /(?:^|[\s"'(=])(?:~\/|\/(?:Users|home|private|tmp|var|etc|mnt|opt|Volumes)\/)/],
  ['file-url', /\bfile:\/\//],
  ['central-token-path', /\.central\/|native-token|owner-token/],
];

function refuseFieldTimeLeaks(value: unknown, schemaName: string, path = '$'): void {
  if (typeof value === 'string') {
    for (const [name, pattern] of FIELD_TIME_LEAKS) {
      if (pattern.test(value)) fail(`${schemaName} refuses local-only material: ${name} at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => refuseFieldTimeLeaks(entry, schemaName, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) refuseFieldTimeLeaks(entry, schemaName, `${path}.${key}`);
  }
}

function requireExactKeysOf(value: any, allowed: string[], name: string): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name}.${key} is not part of the contract`);
}

function requireRef(value: unknown, pattern: RegExp, name: string): string {
  if (typeof value !== 'string') fail(`${name} must be a string`);
  requireString(value, name, 512);
  if (!pattern.test(value)) fail(`${name} is not a well-formed ref`);
  return value;
}

function requireFieldTimeAudience(ctx: any, fieldRef: string, audience: any, name: string): void {
  requireExactKeysOf(audience, ['visibility', 'refs'], name);
  if (!PROJECTION_VISIBILITIES.has(String(audience.visibility))) fail(`${name}.visibility is unsupported`);
  const refs = audience.refs ?? [];
  if (!Array.isArray(refs) || refs.length > 32) fail(`${name}.refs must be an array of at most 32 refs`);
  for (const ref of refs) {
    if (typeof ref !== 'string') fail(`${name}.refs must be strings`);
    requireParticipantInField(ctx, ref, fieldRef);
  }
  if (audience.visibility === 'private' && refs.length === 0) fail(`${name}: a private audience must name its participant refs`);
}

function requireFieldTimeEnvelope(contractJson: string, schemaName: string, fieldRef: string, revision: bigint): Record<string, any> {
  if (utf8Bytes(contractJson) > FIELD_TIME_MAX_BYTES) fail(`${schemaName} exceeds ${FIELD_TIME_MAX_BYTES} byte limit`);
  const contract = requireJsonObject(contractJson, schemaName, FIELD_TIME_MAX_BYTES);
  enforceJsonBounds(contract, schemaName);
  requireEqual(contract.schema, schemaName, `${schemaName} schema`);
  requireEqual(contract.field_ref, fieldRef, `${schemaName} fieldRef`);
  if (!Number.isSafeInteger(contract.revision) || BigInt(contract.revision) !== revision) {
    fail(`${schemaName} contract must carry revision ${revision}`);
  }
  refuseFieldTimeLeaks(contract, schemaName);
  return contract;
}

function requireFieldNowShape(ctx: any, contract: Record<string, any>): void {
  requireExactKeysOf(contract, ['schema', 'field_ref', 'revision', 'projected_root_now_refs', 'projected_child_now_refs', 'presence_cursor', 'activity_cursor', 'contribution_cursor', 'audience', 'provenance'], 'FieldNow');
  const roots = contract.projected_root_now_refs;
  const children = contract.projected_child_now_refs;
  if (!Array.isArray(roots) || roots.length > 32) fail('FieldNow projected_root_now_refs must be an array of at most 32');
  if (!Array.isArray(children) || children.length > CONTRIBUTION_MAX_COLLECTION) fail(`FieldNow projected_child_now_refs must be an array of at most ${CONTRIBUTION_MAX_COLLECTION}`);
  const seen = new Set<string>();
  const rootWorkcell = new Map<string, string>();
  const workcells = new Set<string>();
  roots.forEach((root: any, index: number) => {
    const name = `FieldNow projected_root_now_refs[${index}]`;
    requireExactKeysOf(root, ['now_ref', 'workcell_ref', 'world_ref', 'revision', 'projected_by'], name);
    const nowRef = requireRef(root.now_ref, NOW_REF_PATTERN, `${name}.now_ref`);
    const workcell = requireRef(root.workcell_ref, WORKCELL_REF_PATTERN, `${name}.workcell_ref`);
    requireRef(root.world_ref, WORLD_REF_PATTERN, `${name}.world_ref`);
    requireString(String(root.revision ?? ''), `${name}.revision`, 512);
    requireString(String(root.projected_by ?? ''), `${name}.projected_by`, 512);
    if (seen.has(nowRef)) fail(`FieldNow projects ${nowRef} more than once`);
    if (workcells.has(workcell)) fail(`FieldNow projects two root NOWs for ${workcell}`);
    seen.add(nowRef);
    workcells.add(workcell);
    rootWorkcell.set(nowRef, workcell);
  });
  children.forEach((child: any, index: number) => {
    const name = `FieldNow projected_child_now_refs[${index}]`;
    requireExactKeysOf(child, ['now_ref', 'parent_now_ref', 'workcell_ref', 'purpose_summary', 'state', 'projected_by'], name);
    const nowRef = requireRef(child.now_ref, NOW_REF_PATTERN, `${name}.now_ref`);
    const parent = requireRef(child.parent_now_ref, NOW_REF_PATTERN, `${name}.parent_now_ref`);
    const workcell = requireRef(child.workcell_ref, WORKCELL_REF_PATTERN, `${name}.workcell_ref`);
    if (child.purpose_summary !== undefined) requireString(String(child.purpose_summary), `${name}.purpose_summary`, 280);
    if (!CHILD_NOW_STATES.has(String(child.state))) fail(`${name}.state is unsupported`);
    requireString(String(child.projected_by ?? ''), `${name}.projected_by`, 512);
    if (nowRef === parent) fail(`${name} cannot be its own parent`);
    if (seen.has(nowRef)) fail(`FieldNow projects ${nowRef} more than once`);
    seen.add(nowRef);
    const parentWorkcell = rootWorkcell.get(parent);
    if (parentWorkcell && parentWorkcell !== workcell) fail(`child NOW ${nowRef} is situated on ${workcell} but its projected root is on ${parentWorkcell}`);
  });
  for (const cursor of ['presence_cursor', 'activity_cursor', 'contribution_cursor']) {
    if (contract[cursor] !== undefined) requireString(String(contract[cursor]), `FieldNow ${cursor}`, 512);
  }
  requireFieldTimeAudience(ctx, contract.field_ref, contract.audience, 'FieldNow audience');
  if (!Array.isArray(contract.provenance) || contract.provenance.length === 0) fail('FieldNow provenance must be a non-empty array');
}

function requireFieldDayShape(ctx: any, contract: Record<string, any>): void {
  requireExactKeysOf(contract, ['schema', 'field_ref', 'revision', 'interval', 'temporal_policy_provenance', 'projected_source_day_refs', 'projected_now_refs', 'cursors', 'audience'], 'FieldDay');
  requireExactKeysOf(contract.interval, ['start', 'end', 'policy'], 'FieldDay interval');
  const start = Date.parse(String(contract.interval.start));
  const end = Date.parse(String(contract.interval.end));
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) fail('FieldDay interval must be two ISO-8601 instants with end after start');
  requireString(String(contract.interval.policy ?? ''), 'FieldDay interval.policy', 128);
  requireExactKeysOf(contract.temporal_policy_provenance, ['source_system', 'ref', 'revision'], 'FieldDay temporal_policy_provenance');
  for (const key of ['source_system', 'ref', 'revision']) requireString(String(contract.temporal_policy_provenance[key] ?? ''), `FieldDay temporal_policy_provenance.${key}`, 512);
  const seen = new Set<string>();
  const dayRefs = contract.projected_source_day_refs;
  const nowRefs = contract.projected_now_refs;
  if (!Array.isArray(dayRefs) || dayRefs.length > CONTRIBUTION_MAX_COLLECTION) fail('FieldDay projected_source_day_refs must be a bounded array');
  if (!Array.isArray(nowRefs) || nowRefs.length > CONTRIBUTION_MAX_COLLECTION) fail('FieldDay projected_now_refs must be a bounded array');
  dayRefs.forEach((entry: any, index: number) => {
    const name = `FieldDay projected_source_day_refs[${index}]`;
    requireExactKeysOf(entry, ['day_ref', 'world_ref', 'workcell_ref', 'projected_by'], name);
    const ref = requireRef(entry.day_ref, DAY_REF_PATTERN, `${name}.day_ref`);
    if (entry.world_ref !== undefined) requireRef(entry.world_ref, WORLD_REF_PATTERN, `${name}.world_ref`);
    if (entry.workcell_ref !== undefined) requireRef(entry.workcell_ref, WORKCELL_REF_PATTERN, `${name}.workcell_ref`);
    requireString(String(entry.projected_by ?? ''), `${name}.projected_by`, 512);
    const identity = sourceDayIdentity(entry);
    if (seen.has(identity)) fail(`FieldDay projects ${identity} more than once`);
    seen.add(identity);
  });
  nowRefs.forEach((entry: any, index: number) => {
    const name = `FieldDay projected_now_refs[${index}]`;
    requireExactKeysOf(entry, ['now_ref', 'projected_by'], name);
    const ref = requireRef(entry.now_ref, NOW_REF_PATTERN, `${name}.now_ref`);
    requireString(String(entry.projected_by ?? ''), `${name}.projected_by`, 512);
    if (seen.has(ref)) fail(`FieldDay projects ${ref} more than once`);
    seen.add(ref);
  });
  requireExactKeysOf(contract.cursors, ['activity_cursor', 'contribution_cursor', 'encounter_cursor'], 'FieldDay cursors');
  for (const [key, cursor] of Object.entries(contract.cursors)) requireString(String(cursor), `FieldDay cursors.${key}`, 512);
  requireFieldTimeAudience(ctx, contract.field_ref, contract.audience, 'FieldDay audience');
}

/* Every attributed entry a step added, withdrew or changed, with each
 * Participant it was attributed to before and after. */
function sourceDayIdentity(entry: any): string {
  return entry.world_ref || entry.workcell_ref
    ? JSON.stringify([entry.world_ref ?? '', entry.workcell_ref ?? '', entry.day_ref])
    : String(entry.day_ref);
}

function attributedDelta(priorEntries: any[], nextEntries: any[], key: string | ((entry: any) => string)): { ref: string; attributed: string[] }[] {
  const identity = typeof key === 'function' ? key : (entry: any) => String(entry[key]);
  const prior = new Map(priorEntries.map((entry: any) => [identity(entry), entry]));
  const next = new Map(nextEntries.map((entry: any) => [identity(entry), entry]));
  const changed: { ref: string; attributed: string[] }[] = [];
  for (const ref of new Set([...prior.keys(), ...next.keys()])) {
    const before = prior.get(ref);
    const after = next.get(ref);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changed.push({ ref, attributed: [before?.projected_by, after?.projected_by].filter((value): value is string => typeof value === 'string') });
  }
  return changed;
}

/*
 * FieldNow/FieldDay projection authority — the rule chosen, and why:
 *
 * The Participant contract (oi.participant/v1) declares no Workcell, so the
 * module cannot bind a caller to "its own" Workcell from registration data.
 * Ownership of a projected entry is therefore carried by attribution: every
 * entry names the Participant that projected it (`projected_by`).
 *
 * - The field owner (actorParticipantRef '') may project, change or withdraw
 *   any entry and the envelope (audience, provenance, FieldDay policy); every
 *   entry it writes must still be attributed to a Participant of the field.
 * - A Participant holding a live `contributor` grant bound to the caller may
 *   add, change or withdraw only CHILD NOW entries (and FieldDay source Day /
 *   NOW entries) attributed to itself — before and after the step — and may
 *   advance cursors. It may not touch root NOW entries, another Participant's
 *   entries, or the envelope.
 * - Root NOW entries are owner-only: a root NOW is a Workcell's persistent
 *   horizon, and with no declared Workcell binding on the Participant nothing
 *   here could prove a contributor speaks for that Workcell. A child NOW is a
 *   bounded undertaking the contributor itself projects and is answerable for.
 * - Observers/contacts/admitters and non-participants project nothing.
 */
function requireFieldTimeProjectionAuthority(
  ctx: any,
  fieldRef: string,
  actorParticipantRef: string,
  rootDelta: { ref: string; attributed: string[] }[],
  entryDeltas: { ref: string; attributed: string[] }[],
  envelopeChanged: boolean,
  schemaName: string
): void {
  if (!ctx.db.sharedFieldBacking.fieldRef.find(fieldRef)) fail(`Unknown SharedField semantic ref: ${fieldRef}`);
  if (actorParticipantRef === '') {
    requireFieldOwner(ctx, fieldRef);
    for (const change of [...rootDelta, ...entryDeltas]) {
      for (const participantRef of change.attributed) requireParticipantInField(ctx, participantRef, fieldRef);
    }
    return;
  }
  requireParticipantInField(ctx, actorParticipantRef, fieldRef);
  requireParticipantAuthority(ctx, fieldRef, actorParticipantRef, ['contributor']);
  if (isFieldOwner(ctx, fieldRef)) {
    for (const change of [...rootDelta, ...entryDeltas]) {
      for (const participantRef of change.attributed) requireParticipantInField(ctx, participantRef, fieldRef);
    }
    return;
  }
  if (envelopeChanged) fail(`Only the field owner may change the ${schemaName} audience, provenance or policy`);
  if (rootDelta.length > 0) fail(`Only the field owner may project or withdraw root NOW refs (${rootDelta.map(change => change.ref).join(', ')})`);
  for (const change of entryDeltas) {
    if (change.attributed.some(participantRef => participantRef !== actorParticipantRef)) {
      fail(`Participant ${actorParticipantRef} may only project or withdraw its own entries; ${change.ref} is attributed to ${change.attributed.join(', ')}`);
    }
  }
}

function callerAdmittedToFieldTime(ctx: any, fieldRef: string, contractJson: string): boolean {
  const field = ctx.db.sharedFieldBacking.fieldRef.find(fieldRef);
  if (!field || !callerCanSeeField(ctx, field)) return false;
  if (isFieldOwner(ctx, fieldRef)) return true;
  const contract = parseStoredJson(contractJson, 'field time contractJson');
  const audience = projectionAudience(contract);
  const callerRefs = callerPersistentParticipantRefs(ctx, fieldRef);
  if (audience.visibility === 'public') return audience.refs.length === 0 || audience.refs.some(ref => callerRefs.has(ref));
  if (audience.visibility === 'restricted') {
    if (callerRefs.size === 0) return false;
    return audience.refs.length === 0 || audience.refs.some(ref => callerRefs.has(ref));
  }
  if (audience.visibility === 'private') return callerRefs.size > 0 && audience.refs.some(ref => callerRefs.has(ref));
  return false;
}

/* The current FieldNow of every caller-visible field whose audience admits
 * the caller — filtered exactly as Projections/Explore entries are. */
export const field_now = spacetimedb.view(
  { name: 'field_now', public: true },
  t.array(fieldNowBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const field of visibleFieldRows(ctx)) {
      const row = ctx.db.fieldNowBacking.fieldRef.find(field.fieldRef);
      if (row && callerAdmittedToFieldTime(ctx, row.fieldRef, row.contractJson)) rows.push(row);
    }
    return rows;
  }
);

export const field_day = spacetimedb.view(
  { name: 'field_day', public: true },
  t.array(fieldDayBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const field of visibleFieldRows(ctx)) {
      for (const row of ctx.db.fieldDayBacking.fieldRef.filter(field.fieldRef)) {
        if (callerAdmittedToFieldTime(ctx, row.fieldRef, row.contractJson)) rows.push(row);
      }
    }
    return rows;
  }
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


function requireLiveParticipantAuthority(ctx: any, fieldRef: string, participantRef: string, roles?: string[]): any {
  const grant = ctx.db.fieldAuthority.authorityKey.find(authorityKey(fieldRef, participantRef));
  if (!grant || grant.revoked) fail(`Participant ${participantRef} has no live field authority`);
  if (grant.expiresAtMicros !== 0n && nowMicros(ctx) >= grant.expiresAtMicros) {
    fail(`Authority for Participant ${participantRef} is expired`);
  }
  if (roles && !roles.includes(grant.role)) fail(`Participant ${participantRef} lacks required role`);
  return grant;
}

function identityStillOwnsParticipant(ctx: any, fieldRef: string, participantRef: string, identity: any): boolean {
  const key = authorityKey(fieldRef, participantRef);
  for (const row of ctx.db.fieldAuthority.actorIdentity.filter(identity)) {
    if (row.authorityKey === key && !row.revoked && (row.expiresAtMicros === 0n || nowMicros(ctx) < row.expiresAtMicros)) return true;
  }
  return false;
}

function callerIsLiveParticipant(ctx: any, fieldRef: string, participantRef: string): boolean {
  const key = authorityKey(fieldRef, participantRef);
  for (const row of ctx.db.fieldAuthority.actorIdentity.filter(ctx.sender)) {
    if (row.authorityKey === key && !row.revoked && (row.expiresAtMicros === 0n || nowMicros(ctx) < row.expiresAtMicros)) return true;
  }
  return false;
}

function validateExchangeScope(scopeJson: string): void {
  if (utf8Bytes(scopeJson) > EXCHANGE_MAX_SCOPE_BYTES) fail(`Exchange scope exceeds ${EXCHANGE_MAX_SCOPE_BYTES} byte limit`);
  const scope = requireJsonObject(scopeJson, 'Exchange scope', EXCHANGE_MAX_SCOPE_BYTES);
  enforceJsonBounds(scope, 'Exchange scope');
}

function validateExchangeModes(modesJson: string): string[] {
  const modes = requireJsonStringArray(modesJson, 'Exchange modes', 8);
  if (modes.length === 0) fail('Exchange modes must contain at least one mode');
  for (const mode of modes) if (!EXCHANGE_MODES.has(mode)) fail(`Unsupported Exchange mode: ${mode}`);
  return modes;
}

function requireExchangeProtocol(protocol: string): void {
  if (!EXCHANGE_PROTOCOLS.has(protocol)) fail(`Unsupported Exchange protocol: ${protocol}`);
}

function requireExchangePolicyClear(ctx: any, fieldRef: string, initiatorRef: string, counterpartyRef: string): void {
  for (const [blocker, blocked] of [[initiatorRef, counterpartyRef], [counterpartyRef, initiatorRef]]) {
    const row = ctx.db.contactPolicy.policyKey.find(contactPolicyKey(fieldRef, blocker, blocked));
    if (row && (row.mode === 'blocked' || row.mode === 'muted')) {
      fail(`Exchange relation is ${row.mode} by ${blocker}`);
    }
  }
}

function endExchangeGrant(ctx: any, grant: any, state: string): void {
  if (grant.state !== 'active') return;
  ctx.db.exchangeGrant.grantRef.update({ ...grant, state, endedAtMicros: nowMicros(ctx) });
}

function terminateExchangeForParticipant(ctx: any, fieldRef: string, participantRef: string, state = 'revoked'): void {
  const seen = new Set<string>();
  for (const row of ctx.db.exchangeGrant.initiatorParticipantRef.filter(participantRef)) {
    if (row.fieldRef === fieldRef && !seen.has(row.grantRef)) { endExchangeGrant(ctx, row, state); seen.add(row.grantRef); }
  }
  for (const row of ctx.db.exchangeGrant.counterpartyParticipantRef.filter(participantRef)) {
    if (row.fieldRef === fieldRef && !seen.has(row.grantRef)) { endExchangeGrant(ctx, row, state); seen.add(row.grantRef); }
  }
}

function terminateExchangeBetween(ctx: any, fieldRef: string, a: string, b: string): void {
  for (const row of ctx.db.exchangeGrant.initiatorParticipantRef.filter(a)) {
    if (row.fieldRef === fieldRef && row.counterpartyParticipantRef === b) endExchangeGrant(ctx, row, 'revoked');
  }
  for (const row of ctx.db.exchangeGrant.initiatorParticipantRef.filter(b)) {
    if (row.fieldRef === fieldRef && row.counterpartyParticipantRef === a) endExchangeGrant(ctx, row, 'revoked');
  }
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
  exchangeGrantRef?: string;
  exchangeOperationId?: string;
}): void {
  requireString(input.transportMessageId, 'Contribution transportMessageId', 256);
  requireString(input.transportProvider, 'Contribution transportProvider', 128);
  requireParticipantInField(ctx, input.contributorParticipantRef, input.fieldRef);
  const validated = validateContributionContract(ctx, input.fieldRef, input.contributorParticipantRef, input.contractJson);
  const contributionRef = String(validated.contract.contribution_ref);
  for (const row of ctx.db.contributionIngressBacking.claimedContributionRef.filter(contributionRef)) {
    if (row.fieldRef !== input.fieldRef || row.sourceKind === WORLD_CONTRIBUTION_SOURCE) fail('Contribution claimed semantic ref is already associated with another SharedField');
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
      ...(input.exchangeGrantRef ? { exchange_grant_ref: input.exchangeGrantRef } : {}),
      ...(input.exchangeOperationId ? { exchange_operation_id: input.exchangeOperationId } : {}),
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

/** A contribution to a world is accepted, refused or taken back in that world (SF07), never through a SharedField's own acts. */
function refuseWorldContributionHere(ingress: any): void {
  if (ingress.sourceKind === WORLD_CONTRIBUTION_SOURCE) fail('A contribution to a world is accepted, refused or taken back in that world');
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
    const existing = ctx.db.exploreRelationBacking.relationRef.find(relationRef);
    if (existing) ctx.db.exploreRelationBacking.rowId.delete(existing.rowId);
  }
  const entry = ctx.db.exploreEntryBacking.semanticRef.find(semanticRef);
  if (entry?.fieldRef === fieldRef) ctx.db.exploreEntryBacking.rowId.delete(entry.rowId);
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
    // A star is lit, renamed and closed by its own acts (light_star,
    // close_star), which keep its lighter's world gathered at it.
    if (args.kind === STAR_KIND || existing?.kind === STAR_KIND) fail('A star is lit, renamed and closed from the World, not put as a field');
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
    terminateExchangeForParticipant(ctx, args.fieldRef, args.participantRef, 'revoked');
    const presence = ctx.db.fieldPresence.presenceKey.find(presenceKey(args.fieldRef, args.participantRef));
    if (presence) ctx.db.fieldPresence.presenceKey.delete(presence.presenceKey);
    for (const claim of ctx.db.fieldPresenceConnection.presenceKey.filter(presenceKey(args.fieldRef, args.participantRef))) {
      ctx.db.fieldPresenceConnection.claimKey.delete(claim.claimKey);
    }
    for (const follow of ctx.db.stageFollower.followerParticipantRef.filter(args.participantRef)) {
      if (follow.fieldRef === args.fieldRef) ctx.db.stageFollower.followKey.delete(follow.followKey);
    }
    ctx.db.fieldAuthority.authorityKey.delete(key);
    withdrawParticipantFieldTime(ctx, args.fieldRef, args.participantRef);
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


export const request_exchange = spacetimedb.reducer(
  {
    requestRef: t.string(),
    fieldRef: t.string(),
    initiatorParticipantRef: t.string(),
    counterpartyParticipantRef: t.string(),
    purpose: t.string(),
    scopeJson: t.string(),
    protocol: t.string(),
    bindingRef: t.string(),
    bindingRevision: t.u32(),
    modesJson: t.string(),
    maxUses: t.u32(),
    ttlSeconds: t.u32(),
  },
  (ctx, args) => {
    requireString(args.requestRef, 'Exchange requestRef', 512);
    requireString(args.purpose, 'Exchange purpose', 500);
    requireString(args.bindingRef, 'Exchange bindingRef', 512);
    if (args.bindingRevision < 1) fail('Exchange bindingRevision must be positive');
    if (args.maxUses < 1 || args.maxUses > EXCHANGE_MAX_USES) fail(`Exchange maxUses must be between 1 and ${EXCHANGE_MAX_USES}`);
    if (args.ttlSeconds < 1 || args.ttlSeconds > EXCHANGE_MAX_TTL_SECONDS) fail(`Exchange ttlSeconds must be between 1 and ${EXCHANGE_MAX_TTL_SECONDS}`);
    requireExchangeProtocol(args.protocol);
    validateExchangeScope(args.scopeJson);
    validateExchangeModes(args.modesJson);
    if (args.initiatorParticipantRef === args.counterpartyParticipantRef) fail('Exchange requires distinct Participants');
    requireParticipantInField(ctx, args.initiatorParticipantRef, args.fieldRef);
    requireParticipantInField(ctx, args.counterpartyParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.initiatorParticipantRef, ['contact', 'contributor']);
    requireExchangePolicyClear(ctx, args.fieldRef, args.initiatorParticipantRef, args.counterpartyParticipantRef);

    const existing = ctx.db.exchangeRequest.requestRef.find(args.requestRef);
    if (existing) {
      const exact = existing.fieldRef === args.fieldRef
        && existing.initiatorParticipantRef === args.initiatorParticipantRef
        && existing.counterpartyParticipantRef === args.counterpartyParticipantRef
        && existing.purpose === args.purpose
        && existing.scopeJson === args.scopeJson
        && existing.protocol === args.protocol
        && existing.bindingRef === args.bindingRef
        && existing.bindingRevision === args.bindingRevision
        && existing.modesJson === args.modesJson
        && existing.requestedMaxUses === args.maxUses
        && existing.requestedTtlSeconds === args.ttlSeconds;
      if (exact) return;
      fail('Exchange request ref conflicts with a different request');
    }

    let outstanding = 0;
    for (const row of ctx.db.exchangeRequest.initiatorParticipantRef.filter(args.initiatorParticipantRef)) {
      if (row.fieldRef === args.fieldRef && row.state === 'pending' && nowMicros(ctx) < row.requestExpiresAtMicros) outstanding += 1;
    }
    if (outstanding >= EXCHANGE_MAX_OUTSTANDING_REQUESTS) fail('Exchange outstanding request limit exceeded');

    const now = nowMicros(ctx);
    ctx.db.exchangeRequest.insert({
      requestRef: args.requestRef,
      fieldRef: args.fieldRef,
      initiatorParticipantRef: args.initiatorParticipantRef,
      initiatorActorIdentity: ctx.sender,
      counterpartyParticipantRef: args.counterpartyParticipantRef,
      purpose: args.purpose,
      scopeJson: args.scopeJson,
      protocol: args.protocol,
      bindingRef: args.bindingRef,
      bindingRevision: args.bindingRevision,
      modesJson: args.modesJson,
      requestedMaxUses: args.maxUses,
      requestedTtlSeconds: args.ttlSeconds,
      state: 'pending',
      createdAtMicros: now,
      requestExpiresAtMicros: now + BigInt(args.ttlSeconds) * 1_000_000n,
      decisionRef: '',
    });
  }
);

export const grant_exchange = spacetimedb.reducer(
  { requestRef: t.string(), grantRef: t.string(), reason: t.string(), evidenceJson: t.string() },
  (ctx, args) => {
    requireString(args.grantRef, 'Exchange grantRef', 512);
    requireString(args.reason, 'Exchange grant reason', 1_000);
    requireJsonObject(args.evidenceJson, 'Exchange grant evidence', 8_192);
    const request = ctx.db.exchangeRequest.requestRef.find(args.requestRef);
    if (!request) fail(`Unknown Exchange request: ${args.requestRef}`);
    requireFieldOwner(ctx, request.fieldRef);
    if (request.state !== 'pending') fail(`Exchange request is already ${request.state}`);
    if (nowMicros(ctx) >= request.requestExpiresAtMicros) fail('Exchange request has expired');
    requireExchangePolicyClear(ctx, request.fieldRef, request.initiatorParticipantRef, request.counterpartyParticipantRef);
    requireParticipantInField(ctx, request.counterpartyParticipantRef, request.fieldRef);
    const initiatorAuthority = requireLiveParticipantAuthority(ctx, request.fieldRef, request.initiatorParticipantRef, ['contact', 'contributor']);
    if (!identityStillOwnsParticipant(ctx, request.fieldRef, request.initiatorParticipantRef, request.initiatorActorIdentity)) {
      fail('Exchange request actor no longer owns the initiating Participant');
    }
    if (ctx.db.exchangeGrant.grantRef.find(args.grantRef)) fail(`Exchange grant ref already exists: ${args.grantRef}`);
    if (ctx.db.exchangeGrant.requestRef.find(args.requestRef)) fail('Exchange request already has a grant');
    const now = nowMicros(ctx);
    const decisionRef = `exchange-decision:${fingerprintString(`${request.requestRef}\u001f${args.grantRef}\u001f${String(now)}`)}`;
    ctx.db.exchangeGrant.insert({
      grantRef: args.grantRef,
      requestRef: request.requestRef,
      fieldRef: request.fieldRef,
      initiatorParticipantRef: request.initiatorParticipantRef,
      initiatorActorIdentity: initiatorAuthority.actorIdentity,
      counterpartyParticipantRef: request.counterpartyParticipantRef,
      purpose: request.purpose,
      scopeJson: request.scopeJson,
      protocol: request.protocol,
      bindingRef: request.bindingRef,
      bindingRevision: request.bindingRevision,
      modesJson: request.modesJson,
      maxUses: request.requestedMaxUses,
      usedUses: 0,
      state: 'active',
      grantedAtMicros: now,
      expiresAtMicros: now + BigInt(request.requestedTtlSeconds) * 1_000_000n,
      endedAtMicros: 0n,
      grantorIdentity: ctx.sender,
      decisionRef,
      provenanceJson: JSON.stringify({ schema: 'oi.exchange-decision/v1', decision_ref: decisionRef, request_ref: request.requestRef, grant_ref: args.grantRef, decided_at_micros: String(now), reason: args.reason, evidence: JSON.parse(args.evidenceJson) }),
    });
    ctx.db.exchangeRequest.requestRef.update({ ...request, state: 'granted', decisionRef });
  }
);

export const consume_exchange = spacetimedb.reducer(
  {
    grantRef: t.string(), operationId: t.string(), fieldRef: t.string(),
    initiatorParticipantRef: t.string(), counterpartyParticipantRef: t.string(),
    protocol: t.string(), bindingRef: t.string(), bindingRevision: t.u32(),
    mode: t.string(), purpose: t.string(), scopeJson: t.string(),
  },
  (ctx, args) => {
    requireString(args.operationId, 'Exchange operationId', 256);
    requireString(args.bindingRef, 'Exchange bindingRef', 512);
    requireString(args.purpose, 'Exchange purpose', 500);
    requireExchangeProtocol(args.protocol);
    validateExchangeScope(args.scopeJson);
    if (!EXCHANGE_MODES.has(args.mode)) fail(`Unsupported Exchange mode: ${args.mode}`);
    const grant = ctx.db.exchangeGrant.grantRef.find(args.grantRef);
    if (!grant) fail(`Unknown Exchange grant: ${args.grantRef}`);
    if (grant.fieldRef !== args.fieldRef) fail('Exchange grant crosses SharedField boundary');
    if (grant.initiatorParticipantRef !== args.initiatorParticipantRef) fail('Exchange initiating Participant does not match grant');
    if (grant.counterpartyParticipantRef !== args.counterpartyParticipantRef) fail('Exchange counterparty does not match grant');
    if (grant.protocol !== args.protocol) fail('Exchange protocol does not match grant');
    if (grant.bindingRef !== args.bindingRef || grant.bindingRevision !== args.bindingRevision) fail('Exchange endpoint/binding lineage does not match grant');
    if (grant.purpose !== args.purpose) fail('Exchange purpose does not match grant');
    if (grant.scopeJson !== args.scopeJson) fail('Exchange scope does not match grant');
    if (!validateExchangeModes(grant.modesJson).includes(args.mode)) fail('Exchange mode is outside grant scope');
    if (grant.state === 'revoked' || grant.state === 'completed') fail(`Exchange grant is ${grant.state}`);
    if (nowMicros(ctx) >= grant.expiresAtMicros) fail('Exchange grant has expired');
    requireExchangePolicyClear(ctx, grant.fieldRef, grant.initiatorParticipantRef, grant.counterpartyParticipantRef);
    requireParticipantAuthority(ctx, grant.fieldRef, grant.initiatorParticipantRef, ['contact', 'contributor']);
    let boundToCaller = false;
    for (const row of ctx.db.exchangeGrant.initiatorActorIdentity.filter(ctx.sender)) {
      if (row.grantRef === grant.grantRef) { boundToCaller = true; break; }
    }
    if (!boundToCaller) fail('Runtime caller is not the actor bound by the Exchange grant');

    const useKey = exchangeUseKey(grant.grantRef, args.operationId);
    const demandFingerprint = fingerprintString(JSON.stringify({
      fieldRef: args.fieldRef, initiator: args.initiatorParticipantRef, counterparty: args.counterpartyParticipantRef,
      protocol: args.protocol, bindingRef: args.bindingRef, bindingRevision: args.bindingRevision,
      mode: args.mode, purpose: args.purpose, scopeJson: args.scopeJson,
    }));
    const existingUse = ctx.db.exchangeUse.useKey.find(useKey);
    if (existingUse) {
      if (existingUse.demandFingerprint !== demandFingerprint) fail('Exchange operation replay key conflicts with a different demand');
      return;
    }
    if (grant.state !== 'active') fail(`Exchange grant is ${grant.state}`);
    if (grant.usedUses >= grant.maxUses) fail('Exchange grant use budget is exhausted');
    const now = nowMicros(ctx);
    ctx.db.exchangeUse.insert({
      useKey, grantRef: grant.grantRef, operationId: args.operationId, fieldRef: grant.fieldRef,
      actorIdentity: ctx.sender, counterpartyParticipantRef: grant.counterpartyParticipantRef,
      protocol: args.protocol, bindingRef: args.bindingRef, bindingRevision: args.bindingRevision,
      mode: args.mode, purpose: args.purpose, scopeJson: args.scopeJson,
      usedAtMicros: now, demandFingerprint,
    });
    const usedUses = grant.usedUses + 1;
    ctx.db.exchangeGrant.grantRef.update({
      ...grant,
      usedUses,
      state: usedUses >= grant.maxUses ? 'exhausted' : 'active',
      endedAtMicros: usedUses >= grant.maxUses ? now : grant.endedAtMicros,
    });
  }
);

export const revoke_exchange = spacetimedb.reducer(
  { grantRef: t.string(), reason: t.string() },
  (ctx, args) => {
    requireString(args.reason, 'Exchange revocation reason', 1_000);
    const grant = ctx.db.exchangeGrant.grantRef.find(args.grantRef);
    if (!grant) fail(`Unknown Exchange grant: ${args.grantRef}`);
    if (!isFieldOwner(ctx, grant.fieldRef)
        && !callerIsLiveParticipant(ctx, grant.fieldRef, grant.initiatorParticipantRef)
        && !callerIsLiveParticipant(ctx, grant.fieldRef, grant.counterpartyParticipantRef)) {
      fail('Caller cannot revoke this Exchange grant');
    }
    if (grant.state === 'revoked') return;
    if (grant.state === 'completed') fail('Completed Exchange grant cannot be revoked');
    ctx.db.exchangeGrant.grantRef.update({ ...grant, state: 'revoked', endedAtMicros: nowMicros(ctx) });
  }
);

export const complete_exchange = spacetimedb.reducer(
  { grantRef: t.string() },
  (ctx, args) => {
    const grant = ctx.db.exchangeGrant.grantRef.find(args.grantRef);
    if (!grant) fail(`Unknown Exchange grant: ${args.grantRef}`);
    if (!isFieldOwner(ctx, grant.fieldRef)
        && !callerIsLiveParticipant(ctx, grant.fieldRef, grant.initiatorParticipantRef)
        && !callerIsLiveParticipant(ctx, grant.fieldRef, grant.counterpartyParticipantRef)) {
      fail('Caller cannot complete this Exchange grant');
    }
    if (grant.state === 'completed') return;
    if (grant.state === 'revoked') fail('Revoked Exchange grant cannot be completed');
    ctx.db.exchangeGrant.grantRef.update({ ...grant, state: 'completed', endedAtMicros: nowMicros(ctx) });
  }
);

export const ingest_authorized_exchange_contribution = spacetimedb.reducer(
  {
    grantRef: t.string(), operationId: t.string(), fieldRef: t.string(),
    contributorParticipantRef: t.string(), sourceKind: t.string(), transportProvider: t.string(),
    transportMessageId: t.string(), contractJson: t.string(),
  },
  (ctx, args) => {
    requireFieldOwner(ctx, args.fieldRef);
    const grant = ctx.db.exchangeGrant.grantRef.find(args.grantRef);
    if (!grant || grant.fieldRef !== args.fieldRef) fail('Returned material does not reference a valid Exchange grant in this SharedField');
    if (grant.counterpartyParticipantRef !== args.contributorParticipantRef) fail('Returned material contributor does not match Exchange counterparty');
    if (grant.protocol !== args.sourceKind) fail('Returned material source kind does not match Exchange protocol');
    const use = ctx.db.exchangeUse.useKey.find(exchangeUseKey(args.grantRef, args.operationId));
    if (!use || use.grantRef !== args.grantRef || use.operationId !== args.operationId) fail('Returned material has no matching consumed Exchange operation');
    if (!CONTRIBUTION_TRANSPORTS.has(args.sourceKind)) fail(`Unsupported mediated Contribution source kind: ${args.sourceKind}`);
    ingressContribution(ctx, {
      fieldRef: args.fieldRef,
      contributorParticipantRef: args.contributorParticipantRef,
      sourceKind: args.sourceKind,
      transportProvider: args.transportProvider,
      transportMessageId: args.transportMessageId,
      contractJson: args.contractJson,
      exchangeGrantRef: args.grantRef,
      exchangeOperationId: args.operationId,
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
    refuseWorldContributionHere(ingress);
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
    ctx.db.contributionIngressBacking.rowId.update({ ...ingress, state: 'admitted' });
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
    refuseWorldContributionHere(ingress);
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
    ctx.db.contributionIngressBacking.rowId.update({ ...ingress, state: 'rejected' });
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
    refuseWorldContributionHere(ingress);
    const submitterWithdrawal = ctx.sender.isEqual(ingress.submitterIdentity);
    if (!submitterWithdrawal) requireAdmissionAuthority(ctx, ingress.fieldRef, args.admissionParticipantRef);
    if (ingress.state !== 'admitted') fail(`Contribution ingress is ${ingress.state}, not admitted`);
    const admitted = ctx.db.admittedContributionBacking.ingressRef.find(ingress.ingressRef);
    if (!admitted) throw new Error(`Missing admitted Contribution for ${ingress.ingressRef}`);
    const now = nowMicros(ctx);
    const withdrawalParticipantRef = submitterWithdrawal ? ingress.contributorParticipantRef : args.admissionParticipantRef;
    const decisionRef = admissionDecisionRef(ingress.ingressRef, 'withdrawn', now, withdrawalParticipantRef);
    ctx.db.admissionDecision.insert({
      decisionRef,
      ingressRef: ingress.ingressRef,
      fieldRef: ingress.fieldRef,
      disposition: 'withdrawn',
      admissionActorIdentity: ctx.sender,
      admissionParticipantRef: withdrawalParticipantRef,
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
    ctx.db.admittedContributionBacking.rowId.delete(admitted.rowId);
    ctx.db.contributionIngressBacking.rowId.update({ ...ingress, state: 'withdrawn' });
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
    refuseWorldContributionHere(ingress);
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
    terminateExchangeBetween(ctx, args.fieldRef, args.blockerParticipantRef, args.blockedParticipantRef);
  }
);

/* ---------- Live presence and the optional Shared Stage ---------- */

export const enter_field = spacetimedb.reducer(
  { fieldRef: t.string(), participantRef: t.string(), state: t.string() },
  (ctx, args) => {
    const state = args.state === '' ? 'entered' : args.state;
    if (!PRESENCE_STATES.has(state)) fail(`Unsupported presence state: ${state}`);
    requireParticipantInField(ctx, args.participantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.participantRef, ['observer', 'contact', 'contributor']);
    const connectionRef = callerConnection(ctx);
    if (!connectionRef) fail('Presence requires an actual connected body');
    const now = nowMicros(ctx);
    const row = {
      presenceKey: presenceKey(args.fieldRef, args.participantRef),
      fieldRef: args.fieldRef,
      participantRef: args.participantRef,
      actorIdentity: ctx.sender,
      state,
      enteredAtMicros: now,
      updatedAtMicros: now,
    };
    const existing = ctx.db.fieldPresence.presenceKey.find(row.presenceKey);
    if (existing) ctx.db.fieldPresence.presenceKey.update({ ...existing, state, actorIdentity: ctx.sender, updatedAtMicros: now });
    else ctx.db.fieldPresence.insert(row);
    const claim = {claimKey: JSON.stringify([row.presenceKey, connectionRef]), presenceKey: row.presenceKey, connectionRef, actorIdentity: ctx.sender};
    if (!ctx.db.fieldPresenceConnection.claimKey.find(claim.claimKey)) ctx.db.fieldPresenceConnection.insert(claim);
  }
);

/* Leaving the field clears live presence and any stage follow, and leaves
 * membership, authority and the participant's local view untouched. */
export const leave_field = spacetimedb.reducer(
  { fieldRef: t.string(), participantRef: t.string() },
  (ctx, args) => {
    requireParticipantAuthority(ctx, args.fieldRef, args.participantRef, ['observer', 'contact', 'contributor']);
    const presence = ctx.db.fieldPresence.presenceKey.find(presenceKey(args.fieldRef, args.participantRef));
    if (presence) ctx.db.fieldPresence.presenceKey.delete(presence.presenceKey);
    for (const claim of ctx.db.fieldPresenceConnection.presenceKey.filter(presenceKey(args.fieldRef, args.participantRef))) {
      ctx.db.fieldPresenceConnection.claimKey.delete(claim.claimKey);
    }
    for (const follow of ctx.db.stageFollower.followerParticipantRef.filter(args.participantRef)) {
      if (follow.fieldRef === args.fieldRef) ctx.db.stageFollower.followKey.delete(follow.followKey);
    }
  }
);

/* Presence is live state: a dropped connection cannot leave a ghost in the
 * field. Stage follows persist so a reconnecting participant restores the
 * current stage without re-following. */
export const client_disconnected = spacetimedb.clientDisconnected((ctx) => {
  for (const claim of ctx.db.fieldPresenceConnection.connectionRef.filter(callerConnection(ctx))) {
    ctx.db.fieldPresenceConnection.claimKey.delete(claim.claimKey);
    if (!Array.from(ctx.db.fieldPresenceConnection.presenceKey.filter(claim.presenceKey)).length) {
      ctx.db.fieldPresence.presenceKey.delete(claim.presenceKey);
    }
  }
  // Activity liveness belongs to the producing connection, not merely the
  // identity: an owner's one-shot reads under the same token must not clear a
  // running producer, and a producer's own dropped connection always does.
  const connection = callerConnection(ctx);
  const held = connection === ''
    ? Array.from(ctx.db.activityLivenessBacking.producerIdentity.filter(ctx.sender))
    : Array.from(ctx.db.activityLivenessBacking.producerConnection.filter(connection));
  for (const row of held) ctx.db.activityLivenessBacking.activityKey.delete(row.activityKey);
  // a work shown at a star answers on the connection that showed it: that connection gone, it answers no more
  const answering = connection === ''
    ? Array.from(ctx.db.starWorkAnswerConnection.answerIdentity.filter(ctx.sender))
    : Array.from(ctx.db.starWorkAnswerConnection.connectionRef.filter(connection));
  for (const row of answering as any[]) unanswerWork(ctx, row.workKey);
  // a world answers while a window of its owner's stands: the last of them gone, it is away from now
  const windows = connection === ''
    ? Array.from(ctx.db.worldAnswerConnection.answerIdentity.filter(ctx.sender))
    : Array.from(ctx.db.worldAnswerConnection.connectionRef.filter(connection));
  for (const claim of windows as any[]) {
    ctx.db.worldAnswerConnection.claimKey.delete(claim.claimKey);
    if (Array.from(ctx.db.worldAnswerConnection.worldRef.filter(claim.worldRef)).length) continue;
    const answer = ctx.db.worldAnswerBacking.worldRef.find(claim.worldRef);
    if (answer?.answering) ctx.db.worldAnswerBacking.worldRef.update({ ...answer, answering: false, sinceMicros: nowMicros(ctx) });
  }
});

/* ---------- Activity liveness (owner-side producer evidence) ---------- */

const ACTIVITY_STATE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;

function activityKey(fieldRef: string, activityRef: string): string {
  return `${fieldRef}|${activityRef}`;
}

function callerConnection(ctx: any): string {
  return ctx.connectionId ? ctx.connectionId.toHexString() : '';
}

function activityProducerStillAuthorised(ctx: any, row: any): boolean {
  if (row.producerParticipantRef === '') return false;
  const key = authorityKey(row.fieldRef, row.producerParticipantRef);
  for (const grant of ctx.db.fieldAuthority.actorIdentity.filter(row.producerIdentity)) {
    if (grant.authorityKey !== key || grant.revoked) continue;
    if (grant.expiresAtMicros !== 0n && nowMicros(ctx) >= grant.expiresAtMicros) continue;
    if (grant.role === 'contributor' || grant.role === 'admitter') return true;
  }
  return false;
}

/* Only the field owner, or a caller bound to a live contributor/admitter
 * participant of that field, may speak for an activity entry that exists in
 * that field and that the caller can see; a non-owner never takes over a row
 * another producer (or the owner) holds; the owner revision it reports never goes backwards, and a
 * changed owner state must arrive with a revision advance. */
export const put_activity_liveness = spacetimedb.reducer(
  { fieldRef: t.string(), activityRef: t.string(), producerParticipantRef: t.string(), ownerState: t.string(), ownerRevision: t.u64() },
  (ctx, args) => {
    requireString(args.fieldRef, 'fieldRef');
    requireString(args.activityRef, 'activityRef');
    if (!ACTIVITY_STATE_PATTERN.test(args.ownerState)) fail(`Unsupported activity owner state: ${args.ownerState}`);
    if (args.ownerRevision < 1n) fail('Activity owner revision must be >= 1');
    if (!ctx.db.sharedFieldBacking.fieldRef.find(args.fieldRef)) fail(`Unknown SharedField ${args.fieldRef}`);
    const owner = isFieldOwner(ctx, args.fieldRef);
    if (owner) {
      if (args.producerParticipantRef !== '') requireParticipantInField(ctx, args.producerParticipantRef, args.fieldRef);
    } else {
      if (args.producerParticipantRef === '') fail(`Caller is not owner of SharedField ${args.fieldRef}; name the producing Participant`);
      requireParticipantInField(ctx, args.producerParticipantRef, args.fieldRef);
      requireParticipantAuthority(ctx, args.fieldRef, args.producerParticipantRef, ['contributor', 'admitter']);
    }
    // A missing entry and an entry the caller cannot see refuse identically,
    // so a put never probes private entry existence.
    const entry = ctx.db.exploreEntryBacking.semanticRef.find(args.activityRef);
    if (!entry || entry.fieldRef !== args.fieldRef || entry.kind !== 'activity' || (!owner && !callerCanSeeExploreEntry(ctx, entry))) {
      fail(`No activity entry ${args.activityRef} in SharedField ${args.fieldRef}`);
    }
    const now = nowMicros(ctx);
    const key = activityKey(args.fieldRef, args.activityRef);
    const existing = ctx.db.activityLivenessBacking.activityKey.find(key);
    if (existing) {
      // A non-owner may only continue its own account: the producing
      // identity, or the same Participant it is bound to (authority checked
      // above). The owner's row and another producer's row are not its to take.
      if (!owner && !ctx.sender.isEqual(existing.producerIdentity)
        && (existing.producerParticipantRef === '' || existing.producerParticipantRef !== args.producerParticipantRef)) {
        fail(`Activity liveness for ${args.activityRef} is held by another producer`);
      }
      if (args.ownerRevision < existing.ownerRevision) {
        fail(`Activity owner revision must not go backwards (${args.ownerRevision} < ${existing.ownerRevision})`);
      }
      if (args.ownerRevision === existing.ownerRevision && args.ownerState !== existing.ownerState) {
        fail('Activity owner state changed without an owner revision advance');
      }
    }
    const changed = !existing || existing.ownerRevision !== args.ownerRevision || existing.ownerState !== args.ownerState;
    const row = {
      activityKey: key,
      fieldRef: args.fieldRef,
      activityRef: args.activityRef,
      producerParticipantRef: args.producerParticipantRef,
      producerIdentity: ctx.sender,
      producerConnection: callerConnection(ctx),
      ownerState: args.ownerState,
      ownerRevision: args.ownerRevision,
      observedAtMicros: changed ? now : existing.observedAtMicros,
      heartbeatAtMicros: now,
    };
    if (existing) ctx.db.activityLivenessBacking.activityKey.update(row);
    else ctx.db.activityLivenessBacking.insert(row);
  }
);

/* A producer's graceful stop. The producing identity or the field owner may
 * clear; clearing an absent row is a no-op so a racing stop stays idempotent. */
export const clear_activity_liveness = spacetimedb.reducer(
  { fieldRef: t.string(), activityRef: t.string() },
  (ctx, args) => {
    const existing = ctx.db.activityLivenessBacking.activityKey.find(activityKey(args.fieldRef, args.activityRef));
    if (!existing) return;
    if (!ctx.sender.isEqual(existing.producerIdentity) && !isFieldOwner(ctx, args.fieldRef)) {
      fail('Only the producing identity or the field owner may clear activity liveness');
    }
    ctx.db.activityLivenessBacking.activityKey.delete(existing.activityKey);
  }
);

export const open_shared_stage = spacetimedb.reducer(
  { fieldRef: t.string(), stageRef: t.string(), presenterParticipantRef: t.string(), subjectRef: t.string(), contractJson: t.string() },
  (ctx, args) => {
    requireString(args.stageRef, 'Shared Stage stageRef');
    requireString(args.subjectRef, 'Shared Stage subjectRef', 512);
    if (utf8Bytes(args.contractJson) > STAGE_MAX_BYTES) fail(`Shared Stage contract exceeds ${STAGE_MAX_BYTES} byte limit`);
    const contract = requireJsonObject(args.contractJson, 'Shared Stage contract', STAGE_MAX_BYTES);
    enforceJsonBounds(contract, 'Shared Stage contract');
    requireEqual(contract.field_ref, args.fieldRef, 'Shared Stage fieldRef');
    requireParticipantInField(ctx, args.presenterParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.presenterParticipantRef, ['contributor']);
    for (const row of ctx.db.sharedStageBacking.fieldRef.filter(args.fieldRef)) {
      if (row.state === 'open') fail(`SharedField ${args.fieldRef} already has an open Shared Stage: ${row.stageRef}`);
    }
    if (ctx.db.sharedStageBacking.stageRef.find(args.stageRef)) fail(`Shared Stage ref already exists: ${args.stageRef}`);
    requireStageContractShape(contract, args.stageRef, args.fieldRef, 1n, 'open', args.presenterParticipantRef);
    requireEqual(contract.subject_ref, args.subjectRef, 'Shared Stage subjectRef');
    requireStageEdits([], contract.edits ?? [], args.presenterParticipantRef, 1n, true);
    const now = nowMicros(ctx);
    ctx.db.sharedStageBacking.insert({
      stageRef: args.stageRef,
      fieldRef: args.fieldRef,
      revision: 1n,
      state: 'open',
      presenterRef: args.presenterParticipantRef,
      subjectRef: args.subjectRef,
      contractJson: args.contractJson,
      openedAtMicros: now,
      updatedAtMicros: now,
      updatedByParticipantRef: args.presenterParticipantRef,
    });
  }
);

/* The revision-checked shared mutation. `expectedRevision` must equal the
 * stage's current revision, so a stale writer is refused instead of silently
 * replacing the shared state (no opaque last-writer wins). The advancing
 * participant becomes the presenter; a change of presenter is explicit. */
export const advance_shared_stage = spacetimedb.reducer(
  { fieldRef: t.string(), stageRef: t.string(), actorParticipantRef: t.string(), expectedRevision: t.u64(), contractJson: t.string() },
  (ctx, args) => {
    const stage = ctx.db.sharedStageBacking.stageRef.find(args.stageRef);
    if (!stage || stage.fieldRef !== args.fieldRef) fail(`Unknown Shared Stage ${args.stageRef} in SharedField ${args.fieldRef}`);
    if (stage.state !== 'open') fail(`Shared Stage ${args.stageRef} is ${stage.state}`);
    requireParticipantInField(ctx, args.actorParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.actorParticipantRef, ['contributor']);
    if (stage.revision !== args.expectedRevision) {
      fail(`Shared Stage moved on: stage is at revision ${stage.revision}, writer expected ${args.expectedRevision}`);
    }
    if (utf8Bytes(args.contractJson) > STAGE_MAX_BYTES) fail(`Shared Stage contract exceeds ${STAGE_MAX_BYTES} byte limit`);
    const contract = requireJsonObject(args.contractJson, 'Shared Stage contract', STAGE_MAX_BYTES);
    enforceJsonBounds(contract, 'Shared Stage contract');
    const nextRevision = stage.revision + 1n;
    requireStageContractShape(contract, args.stageRef, args.fieldRef, nextRevision, 'open', args.actorParticipantRef);
    const prior = parseStoredJson(stage.contractJson, 'Shared Stage contract');
    requireStageEdits(prior.edits ?? [], contract.edits ?? [], args.actorParticipantRef, nextRevision, true);
    if (JSON.stringify(contract.provenance) !== JSON.stringify(prior.provenance)) fail('Shared Stage provenance is immutable');
    ctx.db.sharedStageBacking.stageRef.update({
      ...stage,
      revision: nextRevision,
      presenterRef: args.actorParticipantRef,
      subjectRef: String(contract.subject_ref),
      contractJson: args.contractJson,
      updatedAtMicros: nowMicros(ctx),
      updatedByParticipantRef: args.actorParticipantRef,
    });
  }
);

/* Closing stops the stage: the View drops it, follower relations end, and
 * every participant keeps their own local view and field membership. The
 * current presenter or the field owner may close. */
export const close_shared_stage = spacetimedb.reducer(
  { fieldRef: t.string(), stageRef: t.string(), actorParticipantRef: t.string(), expectedRevision: t.u64(), contractJson: t.string() },
  (ctx, args) => {
    const stage = ctx.db.sharedStageBacking.stageRef.find(args.stageRef);
    if (!stage || stage.fieldRef !== args.fieldRef) fail(`Unknown Shared Stage ${args.stageRef} in SharedField ${args.fieldRef}`);
    if (stage.state !== 'open') fail(`Shared Stage ${args.stageRef} is already ${stage.state}`);
    if (args.actorParticipantRef !== stage.presenterRef) requireFieldOwner(ctx, args.fieldRef);
    requireParticipantInField(ctx, args.actorParticipantRef, args.fieldRef);
    if (stage.revision !== args.expectedRevision) {
      fail(`Shared Stage moved on: stage is at revision ${stage.revision}, closer expected ${args.expectedRevision}`);
    }
    if (utf8Bytes(args.contractJson) > STAGE_MAX_BYTES) fail(`Shared Stage contract exceeds ${STAGE_MAX_BYTES} byte limit`);
    const contract = requireJsonObject(args.contractJson, 'Shared Stage contract', STAGE_MAX_BYTES);
    enforceJsonBounds(contract, 'Shared Stage contract');
    const nextRevision = stage.revision + 1n;
    requireStageContractShape(contract, args.stageRef, args.fieldRef, nextRevision, 'closed', stage.presenterRef);
    const prior = parseStoredJson(stage.contractJson, 'Shared Stage contract');
    requireStageEdits(prior.edits ?? [], contract.edits ?? [], stage.presenterRef, nextRevision, false);
    if (JSON.stringify(contract.provenance) !== JSON.stringify(prior.provenance)) fail('Shared Stage provenance is immutable');
    ctx.db.sharedStageBacking.stageRef.update({
      ...stage,
      revision: nextRevision,
      state: 'closed',
      contractJson: args.contractJson,
      updatedAtMicros: nowMicros(ctx),
      updatedByParticipantRef: args.actorParticipantRef,
    });
    for (const follow of ctx.db.stageFollower.stageRef.filter(args.stageRef)) {
      ctx.db.stageFollower.followKey.delete(follow.followKey);
    }
  }
);

/* Following is an explicit relation the participant establishes for
 * themselves, bound to the stage's current revision. Re-follow reconciles to
 * whatever revision the stage has reached. */
export const follow_shared_stage = spacetimedb.reducer(
  { fieldRef: t.string(), stageRef: t.string(), followerParticipantRef: t.string() },
  (ctx, args) => {
    const stage = ctx.db.sharedStageBacking.stageRef.find(args.stageRef);
    if (!stage || stage.fieldRef !== args.fieldRef) fail(`Unknown Shared Stage ${args.stageRef} in SharedField ${args.fieldRef}`);
    if (stage.state !== 'open') fail(`Shared Stage ${args.stageRef} is ${stage.state}; there is no open stage to follow`);
    requireParticipantInField(ctx, args.followerParticipantRef, args.fieldRef);
    requireParticipantAuthority(ctx, args.fieldRef, args.followerParticipantRef, ['observer', 'contact', 'contributor']);
    const now = nowMicros(ctx);
    const row = {
      followKey: followKey(args.stageRef, args.followerParticipantRef),
      stageRef: args.stageRef,
      fieldRef: args.fieldRef,
      followerParticipantRef: args.followerParticipantRef,
      actorIdentity: ctx.sender,
      followedAtRevision: stage.revision,
      followedAtMicros: now,
    };
    const existing = ctx.db.stageFollower.followKey.find(row.followKey);
    if (existing) ctx.db.stageFollower.followKey.update(row);
    else ctx.db.stageFollower.insert(row);
  }
);

/* Unfollowing removes only the follow relation: presence, field authority,
 * membership and the participant's local view stay exactly as they were. */
export const unfollow_shared_stage = spacetimedb.reducer(
  { fieldRef: t.string(), stageRef: t.string(), followerParticipantRef: t.string() },
  (ctx, args) => {
    requireParticipantAuthority(ctx, args.fieldRef, args.followerParticipantRef, ['observer', 'contact', 'contributor']);
    const key = followKey(args.stageRef, args.followerParticipantRef);
    if (ctx.db.stageFollower.followKey.find(key)) ctx.db.stageFollower.followKey.delete(key);
  }
);

/* ---------- FieldNow / FieldDay reducers ---------- */

function recordFieldNow(ctx: any, fieldRef: string, revision: bigint, contractJson: string, participantRef: string): void {
  const now = nowMicros(ctx);
  const row = { fieldRef, revision, contractJson, updatedByParticipantRef: participantRef, updatedAtMicros: now };
  if (ctx.db.fieldNowBacking.fieldRef.find(fieldRef)) ctx.db.fieldNowBacking.fieldRef.update(row);
  else ctx.db.fieldNowBacking.insert(row);
  ctx.db.fieldNowRevision.insert({ revisionKey: `${fieldRef}@${revision}`, fieldRef, revision, contractJson, writtenByParticipantRef: participantRef, writtenAtMicros: now });
}

function recordFieldDay(ctx: any, dayKey: string, fieldRef: string, interval: any, revision: bigint, contractJson: string, participantRef: string): void {
  const now = nowMicros(ctx);
  const row = { dayKey, fieldRef, intervalStart: String(interval.start), intervalEnd: String(interval.end), revision, contractJson, updatedByParticipantRef: participantRef, updatedAtMicros: now };
  if (ctx.db.fieldDayBacking.dayKey.find(dayKey)) ctx.db.fieldDayBacking.dayKey.update(row);
  else ctx.db.fieldDayBacking.insert(row);
  ctx.db.fieldDayRevision.insert({ revisionKey: `${dayKey}@${revision}`, dayKey, fieldRef, revision, contractJson, writtenByParticipantRef: participantRef, writtenAtMicros: now });
}

/* The revision-checked FieldNow projection. `expectedRevision` must equal the
 * current revision (0 for a field's first FieldNow) and the contract must be
 * exactly the next revision, so a stale projector is refused instead of
 * silently replacing the collective reading. Every revision is kept as
 * immutable history; the current row is what the View serves. */
export const put_field_now = spacetimedb.reducer(
  { fieldRef: t.string(), actorParticipantRef: t.string(), expectedRevision: t.u64(), contractJson: t.string() },
  (ctx, args) => {
    const current = ctx.db.fieldNowBacking.fieldRef.find(args.fieldRef);
    const currentRevision = current ? current.revision : 0n;
    if (currentRevision !== args.expectedRevision) {
      fail(`FieldNow moved on: field is at revision ${currentRevision}, writer expected ${args.expectedRevision}`);
    }
    const nextRevision = currentRevision + 1n;
    const contract = requireFieldTimeEnvelope(args.contractJson, FIELD_NOW_SCHEMA, args.fieldRef, nextRevision);
    requireFieldNowShape(ctx, contract);
    const prior = current ? parseStoredJson(current.contractJson, 'FieldNow contractJson') : null;
    const rootDelta = attributedDelta(prior?.projected_root_now_refs ?? [], contract.projected_root_now_refs, 'now_ref');
    const childDelta = attributedDelta(prior?.projected_child_now_refs ?? [], contract.projected_child_now_refs, 'now_ref');
    const envelopeChanged = !prior
      || JSON.stringify(prior.audience) !== JSON.stringify(contract.audience)
      || JSON.stringify(prior.provenance) !== JSON.stringify(contract.provenance);
    requireFieldTimeProjectionAuthority(ctx, args.fieldRef, args.actorParticipantRef, rootDelta, childDelta, envelopeChanged, FIELD_NOW_SCHEMA);
    recordFieldNow(ctx, args.fieldRef, nextRevision, args.contractJson, args.actorParticipantRef);
  }
);

/* One FieldDay per field interval; its interval and policy are the field's
 * own aggregation relation and never rewrite a participant's local civil Day,
 * which travels only as a projected source Day ref. */
export const put_field_day = spacetimedb.reducer(
  { fieldRef: t.string(), actorParticipantRef: t.string(), expectedRevision: t.u64(), contractJson: t.string() },
  (ctx, args) => {
    const probe = requireJsonObject(args.contractJson, FIELD_DAY_SCHEMA, FIELD_TIME_MAX_BYTES);
    const interval = probe.interval ?? {};
    const dayKey = `${args.fieldRef}|${String(interval.start ?? '')}|${String(interval.end ?? '')}`;
    const current = ctx.db.fieldDayBacking.dayKey.find(dayKey);
    const currentRevision = current ? current.revision : 0n;
    if (currentRevision !== args.expectedRevision) {
      fail(`FieldDay moved on: interval is at revision ${currentRevision}, writer expected ${args.expectedRevision}`);
    }
    const nextRevision = currentRevision + 1n;
    const contract = requireFieldTimeEnvelope(args.contractJson, FIELD_DAY_SCHEMA, args.fieldRef, nextRevision);
    requireFieldDayShape(ctx, contract);
    const prior = current ? parseStoredJson(current.contractJson, 'FieldDay contractJson') : null;
    const entryDelta = [
      ...attributedDelta(prior?.projected_source_day_refs ?? [], contract.projected_source_day_refs, sourceDayIdentity),
      ...attributedDelta(prior?.projected_now_refs ?? [], contract.projected_now_refs, 'now_ref'),
    ];
    const envelopeChanged = !prior
      || JSON.stringify(prior.interval) !== JSON.stringify(contract.interval)
      || JSON.stringify(prior.temporal_policy_provenance) !== JSON.stringify(contract.temporal_policy_provenance)
      || JSON.stringify(prior.audience) !== JSON.stringify(contract.audience);
    requireFieldTimeProjectionAuthority(ctx, args.fieldRef, args.actorParticipantRef, [], entryDelta, envelopeChanged, FIELD_DAY_SCHEMA);
    recordFieldDay(ctx, dayKey, args.fieldRef, contract.interval, nextRevision, args.contractJson, args.actorParticipantRef);
  }
);

/* Revocation removes shared availability without deleting local source: a
 * revoked Participant's projected entries leave the current FieldNow/FieldDay
 * in a server-authored next revision (history keeps what was projected). */
function withdrawParticipantFieldTime(ctx: any, fieldRef: string, participantRef: string): void {
  const keep = (entries: any[]) => entries.filter((entry: any) => entry.projected_by !== participantRef);
  const now = ctx.db.fieldNowBacking.fieldRef.find(fieldRef);
  if (now) {
    const contract = parseStoredJson(now.contractJson, 'FieldNow contractJson');
    const roots = keep(contract.projected_root_now_refs ?? []);
    const children = keep(contract.projected_child_now_refs ?? []);
    if (roots.length !== contract.projected_root_now_refs.length || children.length !== contract.projected_child_now_refs.length) {
      const nextRevision = now.revision + 1n;
      const next = { ...contract, revision: Number(nextRevision), projected_root_now_refs: roots, projected_child_now_refs: children };
      recordFieldNow(ctx, fieldRef, nextRevision, JSON.stringify(next), '');
    }
  }
  for (const day of Array.from(ctx.db.fieldDayBacking.fieldRef.filter(fieldRef)) as any[]) {
    const contract = parseStoredJson(day.contractJson, 'FieldDay contractJson');
    const dayRefs = keep(contract.projected_source_day_refs ?? []);
    const nowRefs = keep(contract.projected_now_refs ?? []);
    if (dayRefs.length !== contract.projected_source_day_refs.length || nowRefs.length !== contract.projected_now_refs.length) {
      const nextRevision = day.revision + 1n;
      const next = { ...contract, revision: Number(nextRevision), projected_source_day_refs: dayRefs, projected_now_refs: nowRefs };
      recordFieldDay(ctx, day.dayKey, fieldRef, contract.interval, nextRevision, JSON.stringify(next), '');
    }
  }
}

/* ---------- Worlds first: a world, its clearings, the stars it gathers at (O-I #858) ---------- */

const STAR_KIND = 'star';
const STAR_REF_PATTERN = /^star:[A-Za-z0-9._:-]{1,200}$/;
const STAR_COMES = new Set(['anyone', 'asked']);
const CLEARING_AUDIENCES = new Set(['public', 'field', 'star']);
const CLEARING_KINDS = new Set(['place', 'palace', 'portal', 'route', 'page', 'project', 'agent', 'skill', 'machine', 'work', 'reading', 'set']);
const PART_REF_PATTERN = /^[^\u0000-\u001f\u007f]{1,512}$/;
const WORLD_BODY_GENERATOR = 'fbm-sphere';
const WORLD_BODY_KEYS = ['body_ref', 'seed', 'generator', 'landmass', 'climate', 'sky', 'landing'];

function inRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** `aikit.world-body/v1`, exactly (the owner's record, ai-kit knowledge_wiki_facts.rs WorldBody; the shell's
 * projections/atlas/src/globe/body.ts parseWorldBody): nothing rides along with it into the field. A newer
 * generator version is stored as given; a shell that cannot draw it says so. */
function requireWorldBody(bodyJson: string): Record<string, any> {
  const body = requireJsonObject(bodyJson, 'The world body', 4096);
  requireExactKeysOf(body, WORLD_BODY_KEYS, 'The world body');
  if (typeof body.body_ref !== 'string' || !body.body_ref.trim() || body.body_ref.length > 256) fail('The world body names no body reference');
  if (!Number.isInteger(body.seed) || body.seed < 0 || body.seed > 0xffffffff) fail('The seed is a whole number from 0 to 4294967295');
  requireExactKeysOf(body.generator, ['id', 'version'], 'The world body generator');
  if (body.generator.id !== WORLD_BODY_GENERATOR || !Number.isInteger(body.generator.version) || body.generator.version < 1 || body.generator.version > 64) {
    fail(`The body is generated by ${WORLD_BODY_GENERATOR}, from version 1`);
  }
  requireExactKeysOf(body.landmass, ['sea_level', 'continents', 'relief', 'coast'], 'The landmass');
  requireExactKeysOf(body.climate, ['warmth', 'moisture', 'ice_caps'], 'The climate');
  requireExactKeysOf(body.sky, ['atmosphere', 'clouds', 'axial_tilt_deg'], 'The sky');
  for (const [what, value] of [['Sea level', body.landmass.sea_level], ['Relief', body.landmass.relief], ['Warmth', body.climate.warmth],
    ['Moisture', body.climate.moisture], ['Ice caps', body.climate.ice_caps], ['Atmosphere', body.sky.atmosphere], ['Clouds', body.sky.clouds]] as [string, unknown][]) {
    if (!inRange(value, 0, 1)) fail(`${what} runs from 0 to 1`);
  }
  if (!inRange(body.landmass.continents, 0.6, 3.6)) fail('Continents runs from 0.6 to 3.6');
  if (!['smooth', 'fjord', 'archipelago'].includes(body.landmass.coast)) fail('The coast is smooth, fjord or archipelago');
  if (!inRange(body.sky.axial_tilt_deg, 0, 45)) fail('The axial tilt runs from 0 to 45 degrees');
  if (body.landing !== undefined && body.landing !== null) {
    requireExactKeysOf(body.landing, ['on_ref', 'lat', 'lon'], 'The landing');
    if (typeof body.landing.on_ref !== 'string' || !body.landing.on_ref || body.landing.on_ref.length > 256 || !inRange(body.landing.lat, -90, 90) || !inRange(body.landing.lon, -180, 180)) {
      fail('The landing names the body it lands on and a latitude and longitude on it');
    }
  }
  refuseFieldTimeLeaks(body, 'The world body');
  return body;
}

/** What a clearing shows: what kind of thing it is, its label, and where it stands on the body when it stands somewhere. */
function requireShown(shownJson: string): Record<string, any> {
  const shown = requireJsonObject(shownJson, 'What a clearing shows', 2048);
  requireExactKeysOf(shown, ['kind', 'label', 'at'], 'What a clearing shows');
  if (!CLEARING_KINDS.has(String(shown.kind))) fail('A clearing shows a place, palace, portal, route, page, project, agent, skill, machine, work, reading or set');
  if (typeof shown.label !== 'string' || !shown.label.trim() || [...shown.label].length > 160) fail('A clearing is named in at most 160 characters');
  if (shown.at !== undefined) {
    requireExactKeysOf(shown.at, ['lat', 'lon'], 'Where a clearing stands');
    if (!inRange(shown.at.lat, -90, 90) || !inRange(shown.at.lon, -180, 180)) fail('A clearing stands at a latitude and longitude on its body');
  }
  refuseFieldTimeLeaks(shown, 'A clearing');
  return shown;
}

function clearingKey(worldRef: string, partRef: string, starRef: string): string {
  return JSON.stringify([worldRef, partRef, starRef]);
}

function gatheringKey(starRef: string, worldRef: string): string {
  return JSON.stringify([starRef, worldRef]);
}

function callerOwnsWorld(ctx: any, worldRef: string): boolean {
  const owner = ctx.db.worldOwner.worldRef.find(worldRef);
  return Boolean(owner && owner.ownerIdentity.isEqual(ctx.sender));
}

function requireOwnWorld(ctx: any, worldRef: string): any {
  const world = ctx.db.worldBacking.worldRef.find(worldRef);
  if (!world || !callerOwnsWorld(ctx, worldRef)) fail('That world is not yours');
  return world;
}

/** The caller stands in the field when a world of theirs is linked into it. */
function callerInField(ctx: any): boolean {
  for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
    if (ctx.db.worldBacking.worldRef.find(owned.worldRef)?.linked) return true;
  }
  return false;
}

function starRow(ctx: any, starRef: string): any {
  const row = ctx.db.sharedFieldBacking.fieldRef.find(starRef);
  return row && row.kind === STAR_KIND ? row : undefined;
}

function requireStar(ctx: any, starRef: string): any {
  const row = starRow(ctx, starRef);
  if (!row) fail('There is no such star');
  return row;
}

function isGathered(ctx: any, starRef: string, worldRef: string): boolean {
  return ctx.db.worldGatheringBacking.gatheringKey.find(gatheringKey(starRef, worldRef))?.state === 'gathered';
}

/** A linked world of the caller's is gathered at the star. */
function callerGatheredAt(ctx: any, starRef: string): boolean {
  for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
    if (ctx.db.worldBacking.worldRef.find(owned.worldRef)?.linked && isGathered(ctx, starRef, owned.worldRef)) return true;
  }
  return false;
}

function callerCanSeeWorld(ctx: any, world: any): boolean {
  return world.linked || callerOwnsWorld(ctx, world.worldRef);
}

/* A clearing is served to its world's owner; otherwise only while its world
 * is linked, and then to the public, to anyone standing in the field, or to
 * the star's lighter and the worlds gathered at that star while the showing
 * world is gathered there too. Nothing else is served: the cloud is the
 * absence of rows, the same over everything. */
function callerCanSeeClearing(ctx: any, clearing: any): boolean {
  const world = ctx.db.worldBacking.worldRef.find(clearing.worldRef);
  if (!world) return false;
  if (callerOwnsWorld(ctx, clearing.worldRef)) return true;
  if (!world.linked) return false;
  if (clearing.audience === 'public') return true;
  if (clearing.audience === 'field') return callerInField(ctx);
  if (clearing.audience !== 'star') return false;
  if (!starRow(ctx, clearing.starRef) || !isGathered(ctx, clearing.starRef, clearing.worldRef)) return false;
  return isFieldOwner(ctx, clearing.starRef) || callerGatheredAt(ctx, clearing.starRef);
}

/* Who has gathered at a star is served to whoever can see the star; a world
 * that only asked waits at its edge, seen by the star's lighter and its own
 * owner alone. */
function callerCanSeeGathering(ctx: any, gathering: any): boolean {
  const world = ctx.db.worldBacking.worldRef.find(gathering.worldRef);
  const star = starRow(ctx, gathering.starRef);
  if (!world || !star) return false;
  if (callerOwnsWorld(ctx, gathering.worldRef)) return true;
  if (!world.linked || !callerCanSeeField(ctx, star)) return false;
  return gathering.state === 'gathered' || isFieldOwner(ctx, gathering.starRef);
}

function visibleWorldRows(ctx: any): any[] {
  const rows = new Map<string, any>();
  for (const row of ctx.db.worldBacking.iter()) if (callerCanSeeWorld(ctx, row)) rows.set(row.worldRef, row);
  return Array.from(rows.values());
}

export const world = spacetimedb.view(
  { name: 'world', public: true },
  t.array(worldBacking.rowType),
  (ctx) => visibleWorldRows(ctx)
);

/** The caller's own worlds, linked or not: which of the worlds it sees are its own. */
export const my_world = spacetimedb.view(
  { name: 'my_world', public: true },
  t.array(worldBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
      const row = ctx.db.worldBacking.worldRef.find(owned.worldRef);
      if (row) rows.push(row);
    }
    return rows;
  }
);

export const world_clearing = spacetimedb.view(
  { name: 'world_clearing', public: true },
  t.array(worldClearingBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const visible of visibleWorldRows(ctx)) {
      for (const row of ctx.db.worldClearingBacking.worldRef.filter(visible.worldRef)) if (callerCanSeeClearing(ctx, row)) rows.push(row);
    }
    return rows;
  }
);

/* A star's day is read by the star's lighter, and by whoever has a linked
 * world gathered at the star; a world that only asked, or has left, reads its
 * own part of it. An asking world is seen at the edge by the lighter and its
 * own owner alone, as its gathering is. */
function callerCanSeeStarDay(ctx: any, entry: any): boolean {
  if (callerOwnsWorld(ctx, entry.worldRef)) return true;
  const world = ctx.db.worldBacking.worldRef.find(entry.worldRef);
  if (!world || !world.linked || !starRow(ctx, entry.starRef)) return false;
  if (isFieldOwner(ctx, entry.starRef)) return true;
  return entry.what !== 'asked' && callerGatheredAt(ctx, entry.starRef);
}

/** The most one star's day keeps: the oldest goes first. */
const STAR_DAY_LIMIT = 512;

function noteStarDay(ctx: any, starRef: string, worldRef: string, what: string, kind = ''): void {
  ctx.db.starDayBacking.insert({ rowId: 0n, starRef, worldRef, what, kind, atMicros: nowMicros(ctx) });
  const day = Array.from(ctx.db.starDayBacking.starRef.filter(starRef)) as any[];
  if (day.length <= STAR_DAY_LIMIT) return;
  day.sort((a, b) => (a.rowId < b.rowId ? -1 : 1));
  for (const old of day.slice(0, day.length - STAR_DAY_LIMIT)) ctx.db.starDayBacking.rowId.delete(old.rowId);
}

export const star_day = spacetimedb.view(
  { name: 'star_day', public: true },
  t.array(starDayBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.starDayBacking.iter()) if (callerCanSeeStarDay(ctx, row)) rows.push(row);
    return rows;
  }
);

export const world_gathering = spacetimedb.view(
  { name: 'world_gathering', public: true },
  t.array(worldGatheringBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const visible of visibleWorldRows(ctx)) {
      for (const row of ctx.db.worldGatheringBacking.worldRef.filter(visible.worldRef)) if (callerCanSeeGathering(ctx, row)) rows.push(row);
    }
    return rows;
  }
);

/* The caller's circle (O-I #858; manual §17.2, Aperture): its own worlds, the
 * stars it lit or a world of its own is gathered at, and the worlds gathered
 * at those stars. The World's narrower apertures (World, Local, Shared) read
 * the clearings and gatherings of the circle alone, so what moves far away
 * sends them nothing; Federated reads the whole field. A world of the
 * caller's that only asked at a star reads its own asking there, not the
 * star's company. The worlds and the stars themselves are read whole either
 * way: what lies past the edge is counted. */
function callerCircleStars(ctx: any): Set<string> {
  const stars = new Set<string>();
  for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
    for (const gathering of ctx.db.worldGatheringBacking.worldRef.filter(owned.worldRef)) if (gathering.state === 'gathered') stars.add(gathering.starRef);
  }
  for (const lit of ctx.db.fieldOwner.ownerIdentity.filter(ctx.sender)) if (starRow(ctx, lit.fieldRef)) stars.add(lit.fieldRef);
  return stars;
}

function inCallerCircle(ctx: any, worldRef: string, stars: Set<string>): boolean {
  if (callerOwnsWorld(ctx, worldRef)) return true;
  for (const gathering of ctx.db.worldGatheringBacking.worldRef.filter(worldRef)) {
    if (gathering.state === 'gathered' && stars.has(gathering.starRef)) return true;
  }
  return false;
}

export const my_circle_clearing = spacetimedb.view(
  { name: 'my_circle_clearing', public: true },
  t.array(worldClearingBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    const stars = callerCircleStars(ctx);
    for (const visible of visibleWorldRows(ctx)) {
      if (!inCallerCircle(ctx, visible.worldRef, stars)) continue;
      for (const row of ctx.db.worldClearingBacking.worldRef.filter(visible.worldRef)) if (callerCanSeeClearing(ctx, row)) rows.push(row);
    }
    return rows;
  }
);

export const my_circle_gathering = spacetimedb.view(
  { name: 'my_circle_gathering', public: true },
  t.array(worldGatheringBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    const stars = callerCircleStars(ctx);
    for (const visible of visibleWorldRows(ctx)) {
      const own = callerOwnsWorld(ctx, visible.worldRef);
      for (const row of ctx.db.worldGatheringBacking.worldRef.filter(visible.worldRef)) {
        if ((own || stars.has(row.starRef)) && callerCanSeeGathering(ctx, row)) rows.push(row);
      }
    }
    return rows;
  }
);

/* What a world withdrew (SF14) is read where what it withdrew was read: by
 * its own owner always; while the world is linked, a clearing withdrawn from
 * the public by anyone, one withdrawn from the field by whoever stands in the
 * field, and one taken back at a star by the star's lighter and the worlds
 * gathered there; and while the world is out of the field, that it left, by
 * whoever read the field's worlds (the world itself was served to them). */
function callerCanSeeWithdrawal(ctx: any, withdrawal: any): boolean {
  const world = ctx.db.worldBacking.worldRef.find(withdrawal.worldRef);
  if (!world) return false;
  if (callerOwnsWorld(ctx, withdrawal.worldRef)) return true;
  if (withdrawal.reach === 'world') return !world.linked;
  if (!world.linked) return false;
  if (withdrawal.reach === 'public') return true;
  if (withdrawal.reach === 'field') return callerInField(ctx);
  if (withdrawal.reach !== 'star' || !starRow(ctx, withdrawal.starRef)) return false;
  return isFieldOwner(ctx, withdrawal.starRef) || callerGatheredAt(ctx, withdrawal.starRef);
}

/** The most one world's withdrawals keep: the oldest goes first. */
const WORLD_WITHDRAWAL_LIMIT = 64;

function noteWithdrawal(ctx: any, worldRef: string, reach: string, starRef: string, kind: string): void {
  ctx.db.worldWithdrawalBacking.insert({ rowId: 0n, worldRef, starRef, reach, kind, withdrawnAtMicros: nowMicros(ctx) });
  const kept = Array.from(ctx.db.worldWithdrawalBacking.worldRef.filter(worldRef)) as any[];
  if (kept.length <= WORLD_WITHDRAWAL_LIMIT) return;
  kept.sort((a, b) => (a.rowId < b.rowId ? -1 : 1));
  for (const old of kept.slice(0, kept.length - WORLD_WITHDRAWAL_LIMIT)) ctx.db.worldWithdrawalBacking.rowId.delete(old.rowId);
}

const shownKind = (clearing: any): string => parseStoredJson(clearing.shownJson, 'Shown').kind ?? '';

export const world_withdrawal = spacetimedb.view(
  { name: 'world_withdrawal', public: true },
  t.array(worldWithdrawalBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.worldWithdrawalBacking.iter()) if (callerCanSeeWithdrawal(ctx, row)) rows.push(row);
    return rows;
  }
);

/** What the worlds of the caller's circle withdrew (the narrower apertures): what is withdrawn far away sends them nothing. */
export const my_circle_withdrawal = spacetimedb.view(
  { name: 'my_circle_withdrawal', public: true },
  t.array(worldWithdrawalBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    const stars = callerCircleStars(ctx);
    for (const row of ctx.db.worldWithdrawalBacking.iter()) if (inCallerCircle(ctx, row.worldRef, stars) && callerCanSeeWithdrawal(ctx, row)) rows.push(row);
    return rows;
  }
);

/* Whether a world answers (SF11) is read wherever the world is: by its owner,
 * and while it is linked by whoever reads the field's worlds. A world not
 * linked answers to its owner alone. */
function worldAnswerRows(ctx: any, keep: (worldRef: string) => boolean): any[] {
  const rows: any[] = [];
  for (const row of ctx.db.worldAnswerBacking.iter()) {
    const world = ctx.db.worldBacking.worldRef.find(row.worldRef);
    if (world && callerCanSeeWorld(ctx, world) && keep(row.worldRef)) rows.push(row);
  }
  return rows;
}

export const world_answer = spacetimedb.view(
  { name: 'world_answer', public: true },
  t.array(worldAnswerBacking.rowType),
  (ctx) => worldAnswerRows(ctx, () => true)
);

/** Whether the worlds of the caller's circle answer (the narrower apertures): a world far away coming and going sends them nothing. */
export const my_circle_world_answer = spacetimedb.view(
  { name: 'my_circle_world_answer', public: true },
  t.array(worldAnswerBacking.rowType),
  (ctx) => {
    const stars = callerCircleStars(ctx);
    return worldAnswerRows(ctx, (worldRef) => inCallerCircle(ctx, worldRef, stars));
  }
);

/* The owner's window says its world answers, on the connection it calls from:
 * the world answers from now while that connection stands. Said again on a
 * connection it answers on already, nothing changes (no viewer's cursor moves
 * for it). Only a world's owner says it, and only from a window that stays:
 * a call without a connection cannot answer later, and is refused. */
export const answer_for_world = spacetimedb.reducer(
  { worldRef: t.string() },
  (ctx, args) => {
    requireOwnWorld(ctx, args.worldRef);
    const connection = callerConnection(ctx);
    if (connection === '') fail('A world answers on the connection of a window that stays open');
    const claimKey = JSON.stringify([args.worldRef, connection]);
    if (!ctx.db.worldAnswerConnection.claimKey.find(claimKey)) {
      if (Array.from(ctx.db.worldAnswerConnection.connectionRef.filter(connection)).length >= 64) fail('This window answers for as many worlds as one person may hold');
      ctx.db.worldAnswerConnection.insert({ claimKey, worldRef: args.worldRef, connectionRef: connection, answerIdentity: ctx.sender });
    }
    const answer = ctx.db.worldAnswerBacking.worldRef.find(args.worldRef);
    if (!answer) ctx.db.worldAnswerBacking.insert({ worldRef: args.worldRef, answering: true, sinceMicros: nowMicros(ctx) });
    else if (!answer.answering) ctx.db.worldAnswerBacking.worldRef.update({ ...answer, answering: true, sinceMicros: nowMicros(ctx) });
  }
);

/* A world is put by its first creator and stays theirs; Link takes it into
 * the field and out again, leaving everything in it as it was. A put that
 * changes nothing writes nothing (no viewer's cursor moves for it). Taken
 * out, those who read the field read that it left (SF14). */
export const put_world = spacetimedb.reducer(
  { worldRef: t.string(), bodyJson: t.string(), linked: t.bool() },
  (ctx, args) => {
    requireRef(args.worldRef, WORLD_REF_PATTERN, 'The world');
    const body = requireWorldBody(args.bodyJson);
    const bodyJson = JSON.stringify(body);
    const existing = ctx.db.worldBacking.worldRef.find(args.worldRef);
    if (existing) {
      if (!callerOwnsWorld(ctx, args.worldRef)) fail('That world belongs to someone else');
      if (existing.bodyJson === bodyJson && existing.linked === args.linked) return;
      ctx.db.worldBacking.worldRef.update({ ...existing, bodyJson, linked: args.linked, updatedAtMicros: nowMicros(ctx) });
      if (existing.linked !== args.linked) {
        // one word of its leaving at a time: linked again, it is back, and the word goes
        for (const left of Array.from(ctx.db.worldWithdrawalBacking.worldRef.filter(args.worldRef)) as any[]) if (left.reach === 'world') ctx.db.worldWithdrawalBacking.rowId.delete(left.rowId);
        if (!args.linked) noteWithdrawal(ctx, args.worldRef, 'world', '', '');
      }
      return;
    }
    if (Array.from(ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)).length >= 64) fail('You hold as many worlds in the field as one person may');
    ctx.db.worldBacking.insert({ worldRef: args.worldRef, bodyJson, linked: args.linked, updatedAtMicros: nowMicros(ctx) });
    ctx.db.worldOwner.insert({ worldRef: args.worldRef, ownerIdentity: ctx.sender, createdAtMicros: nowMicros(ctx) });
  }
);

/* Showing a part of a world opens a clearing for its audience. The world row
 * itself is never touched, so a viewer who cannot see the clearing is sent
 * nothing at all. Narrowed from the public to the field, those outside the
 * field read it as withdrawn from the public (SF14). */
export const open_clearing = spacetimedb.reducer(
  { worldRef: t.string(), partRef: t.string(), starRef: t.string(), audience: t.string(), shownJson: t.string() },
  (ctx, args) => {
    requireOwnWorld(ctx, args.worldRef);
    if (!PART_REF_PATTERN.test(args.partRef)) fail('A clearing names the part of the world it shows');
    if (!CLEARING_AUDIENCES.has(args.audience)) fail('A clearing is shown to the field, to the public, or at a star');
    if (args.audience === 'star') {
      requireStar(ctx, args.starRef);
      if (!isGathered(ctx, args.starRef, args.worldRef)) fail('Your world shows things at a star only while it is gathered there');
    } else if (args.starRef !== '') fail('Only a clearing shown at a star names the star');
    const shown = requireShown(args.shownJson);
    const key = clearingKey(args.worldRef, args.partRef, args.starRef);
    const row = { clearingKey: key, worldRef: args.worldRef, partRef: args.partRef, starRef: args.starRef, audience: args.audience, shownJson: JSON.stringify(shown), shownAtMicros: nowMicros(ctx) };
    const existing = ctx.db.worldClearingBacking.clearingKey.find(key);
    if (existing) {
      if (existing.audience === row.audience && existing.shownJson === row.shownJson) return;
      ctx.db.worldClearingBacking.clearingKey.update(row);
      if (existing.audience === 'public' && row.audience === 'field') noteWithdrawal(ctx, args.worldRef, 'public', '', shownKind(existing));
      return;
    }
    if (Array.from(ctx.db.worldClearingBacking.worldRef.filter(args.worldRef)).length >= 512) fail('This world shows as many clearings as one world may');
    ctx.db.worldClearingBacking.insert(row);
    if (args.audience === 'star') noteStarDay(ctx, args.starRef, args.worldRef, 'showed', shown.kind);
  }
);

/* Withdrawing a clearing puts it back under cloud everywhere at once; the
 * world keeps what it was. Whoever read it reads it as withdrawn (SF14). */
export const withdraw_clearing = spacetimedb.reducer(
  { worldRef: t.string(), partRef: t.string(), starRef: t.string() },
  (ctx, args) => {
    requireOwnWorld(ctx, args.worldRef);
    const key = clearingKey(args.worldRef, args.partRef, args.starRef);
    const shown = ctx.db.worldClearingBacking.clearingKey.find(key);
    if (!shown) fail('That was not shown');
    ctx.db.worldClearingBacking.clearingKey.delete(key);
    if (shown.audience === 'star' && starRow(ctx, args.starRef)) noteStarDay(ctx, args.starRef, args.worldRef, 'took-back', shownKind(shown));
    if (shown.audience !== 'star' || starRow(ctx, args.starRef)) noteWithdrawal(ctx, args.worldRef, shown.audience, args.starRef, shownKind(shown));
  }
);

function starContract(starRef: string, worldRef: string, name: string, gathers: string, comes: string, parentStarRef: string): string {
  return JSON.stringify({
    schema: 'oi.shared-field/v1',
    field_ref: starRef,
    kind: STAR_KIND,
    visibility: 'public',
    title: name,
    ...(parentStarRef ? { parent_field_ref: parentStarRef } : {}),
    presentation: { gathers, comes, lit_by: worldRef },
    provenance: [{ kind: 'world', ref: worldRef, source_system: 'o-i' }],
  });
}

/* Light a star where a shared interest should gather: its name, what it
 * gathers and who may come. The lighter's world is the first gathered at it,
 * and the star stays in the lighter's hands: lit again by them, it is renamed
 * or its terms are changed. A star may stand inside another. */
export const light_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string(), name: t.string(), gathers: t.string(), comes: t.string(), parentStarRef: t.string() },
  (ctx, args) => {
    if (!STAR_REF_PATTERN.test(args.starRef)) fail('A star is named star:<name>');
    const world = requireOwnWorld(ctx, args.worldRef);
    if (!world.linked) fail('Link your world into the field before you light a star');
    if (!args.name.trim() || [...args.name].length > 120) fail('A star is named in at most 120 characters');
    if (!args.gathers.trim() || [...args.gathers].length > 280) fail('Say what the star gathers in at most 280 characters');
    if (!STAR_COMES.has(args.comes)) fail('A star lets anyone come, or asks you to let each world in');
    if (args.parentStarRef !== '') {
      if (args.parentStarRef === args.starRef) fail('A star cannot stand inside itself');
      requireStar(ctx, args.parentStarRef);
    }
    refuseFieldTimeLeaks([args.name, args.gathers], 'A star');
    const contractJson = starContract(args.starRef, args.worldRef, args.name, args.gathers, args.comes, args.parentStarRef);
    const existing = ctx.db.sharedFieldBacking.fieldRef.find(args.starRef);
    if (existing) {
      if (existing.kind !== STAR_KIND || !isFieldOwner(ctx, args.starRef)) fail('That star is someone else’s');
      if (existing.contractJson !== contractJson) ctx.db.sharedFieldBacking.rowId.update({ ...existing, contractJson });
    } else {
      ctx.db.sharedFieldBacking.insert({ rowId: 0n, fieldRef: args.starRef, kind: STAR_KIND, visibility: 'public', contractJson });
      ctx.db.fieldOwner.insert({ fieldRef: args.starRef, ownerIdentity: ctx.sender, createdAtMicros: nowMicros(ctx) });
      noteStarDay(ctx, args.starRef, args.worldRef, 'lit');
    }
    const key = gatheringKey(args.starRef, args.worldRef);
    const gathered = ctx.db.worldGatheringBacking.gatheringKey.find(key);
    const now = nowMicros(ctx);
    if (!gathered) ctx.db.worldGatheringBacking.insert({ gatheringKey: key, starRef: args.starRef, worldRef: args.worldRef, state: 'gathered', askedAtMicros: now, gatheredAtMicros: now });
    else if (gathered.state !== 'gathered') ctx.db.worldGatheringBacking.gatheringKey.update({ ...gathered, state: 'gathered', gatheredAtMicros: now });
  }
);

/* Bring a world to a star: it gathers at once where the star lets anyone
 * come, and otherwise waits at its edge with its request. */
export const gather_at_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string() },
  (ctx, args) => {
    const world = requireOwnWorld(ctx, args.worldRef);
    if (!world.linked) fail('Link your world into the field before you gather at a star');
    const star = requireStar(ctx, args.starRef);
    const key = gatheringKey(args.starRef, args.worldRef);
    if (ctx.db.worldGatheringBacking.gatheringKey.find(key)) return;
    const comes = parseStoredJson(star.contractJson, 'Star contract').presentation?.comes;
    const now = nowMicros(ctx);
    const open = comes === 'anyone' || isFieldOwner(ctx, args.starRef);
    ctx.db.worldGatheringBacking.insert({ gatheringKey: key, starRef: args.starRef, worldRef: args.worldRef, state: open ? 'gathered' : 'asked', askedAtMicros: now, gatheredAtMicros: open ? now : 0n });
    noteStarDay(ctx, args.starRef, args.worldRef, open ? 'came' : 'asked');
  }
);

/* The star's lighter lets a waiting world in. It reaches no further into the
 * lighter's world than what is shown at the star. */
export const admit_to_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string() },
  (ctx, args) => {
    requireStar(ctx, args.starRef);
    if (!isFieldOwner(ctx, args.starRef)) fail('Only the one who lit a star lets worlds in');
    const key = gatheringKey(args.starRef, args.worldRef);
    const asked = ctx.db.worldGatheringBacking.gatheringKey.find(key);
    if (!asked) fail('That world has not asked to gather here');
    if (asked.state === 'gathered') return;
    ctx.db.worldGatheringBacking.gatheringKey.update({ ...asked, state: 'gathered', gatheredAtMicros: nowMicros(ctx) });
    noteStarDay(ctx, args.starRef, args.worldRef, 'let-in');
  }
);

function takeBackFromStar(ctx: any, starRef: string, worldRef: string): void {
  for (const clearing of Array.from(ctx.db.worldClearingBacking.worldRef.filter(worldRef)) as any[]) {
    if (clearing.starRef !== starRef) continue;
    ctx.db.worldClearingBacking.clearingKey.delete(clearing.clearingKey);
    noteWithdrawal(ctx, worldRef, 'star', starRef, shownKind(clearing));
  }
  // the work it showed there, and the tasks it offered there and nobody has brought back
  for (const work of Array.from(ctx.db.starWorkBacking.worldRef.filter(worldRef)) as any[]) {
    if (work.starRef === starRef) { ctx.db.starWorkBacking.workKey.delete(work.workKey); unanswerWork(ctx, work.workKey); }
  }
  for (const offer of Array.from(ctx.db.starOfferBacking.worldRef.filter(worldRef)) as any[]) {
    if (offer.starRef === starRef && (offer.state === 'open' || offer.state === 'taken')) {
      ctx.db.starOfferBacking.offerRef.update({ ...offer, state: 'revoked', movedAtMicros: nowMicros(ctx) });
    }
  }
}

/* Leave a star: the world turns on in its own orbit and takes back what it
 * showed there. The star's lighter may also turn a world away. */
export const leave_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string() },
  (ctx, args) => {
    const own = callerOwnsWorld(ctx, args.worldRef);
    if (!own && !isFieldOwner(ctx, args.starRef)) fail('That world is not yours to take away from this star');
    const key = gatheringKey(args.starRef, args.worldRef);
    if (!ctx.db.worldGatheringBacking.gatheringKey.find(key)) fail('That world is not at this star');
    ctx.db.worldGatheringBacking.gatheringKey.delete(key);
    takeBackFromStar(ctx, args.starRef, args.worldRef);
    noteStarDay(ctx, args.starRef, args.worldRef, own ? 'left' : 'turned-away');
  }
);

/* Closing a star returns every world to its own orbit and takes nothing out
 * of anyone's world: what was shown there goes back under cloud. A star with
 * a star inside it is closed from the inside out. */
export const close_star = spacetimedb.reducer(
  { starRef: t.string() },
  (ctx, args) => {
    const star = requireStar(ctx, args.starRef);
    if (!isFieldOwner(ctx, args.starRef)) fail('Only the one who lit a star closes it');
    for (const row of ctx.db.sharedFieldBacking.iter()) {
      if (row.kind === STAR_KIND && parseStoredJson(row.contractJson, 'Star contract').parent_field_ref === args.starRef) fail('Close the stars inside this one first');
    }
    for (const gathering of Array.from(ctx.db.worldGatheringBacking.starRef.filter(args.starRef)) as any[]) {
      ctx.db.worldGatheringBacking.gatheringKey.delete(gathering.gatheringKey);
    }
    for (const clearing of Array.from(ctx.db.worldClearingBacking.starRef.filter(args.starRef)) as any[]) {
      ctx.db.worldClearingBacking.clearingKey.delete(clearing.clearingKey);
    }
    // the star's day closes with it, and what was said there
    for (const entry of Array.from(ctx.db.starDayBacking.starRef.filter(args.starRef)) as any[]) ctx.db.starDayBacking.rowId.delete(entry.rowId);
    for (const saying of Array.from(ctx.db.starSayingBacking.starRef.filter(args.starRef)) as any[]) ctx.db.starSayingBacking.sayingRef.delete(saying.sayingRef);
    // and what was taken back there: nobody reads at a closed star
    for (const taken of Array.from(ctx.db.worldWithdrawalBacking.starRef.filter(args.starRef)) as any[]) ctx.db.worldWithdrawalBacking.rowId.delete(taken.rowId);
    // the work shown there and the tasks offered there go with it
    for (const work of Array.from(ctx.db.starWorkBacking.starRef.filter(args.starRef)) as any[]) { ctx.db.starWorkBacking.workKey.delete(work.workKey); unanswerWork(ctx, work.workKey); }
    for (const offer of Array.from(ctx.db.starOfferBacking.starRef.filter(args.starRef)) as any[]) ctx.db.starOfferBacking.offerRef.delete(offer.offerRef);
    ctx.db.sharedFieldBacking.rowId.delete(star.rowId);
    ctx.db.fieldOwner.fieldRef.delete(args.starRef);
  }
);

/* ---------- what was said to what at a star (O-I #858, SF06) ---------- */

const SAYING_REF_PATTERN = /^saying:[A-Za-z0-9._:-]{1,200}$/;
const SAYING_KINDS = new Set(['question', 'finding', 'correction', 'reproduction']);
/** The most one star holds of what was said there: past it, something must be unsaid first (nobody's words are dropped for another's). */
const STAR_SAYING_LIMIT = 1024;

/* What was said at a star is read where its day is read: by its sayer, and,
 * while the sayer's world is linked, by the star's lighter and whoever has a
 * linked world gathered there. A world that only asked reads none of it. */
function callerCanSeeSaying(ctx: any, saying: any): boolean {
  if (callerOwnsWorld(ctx, saying.worldRef)) return true;
  const world = ctx.db.worldBacking.worldRef.find(saying.worldRef);
  if (!world || !world.linked || !starRow(ctx, saying.starRef)) return false;
  return isFieldOwner(ctx, saying.starRef) || callerGatheredAt(ctx, saying.starRef);
}

/** A saying as the caller is served it: what it was said to is named only while the caller can see it. Taken back, it lies under the
 * cloud with everything else, and the saying names nothing there. */
function sayingAsSeen(ctx: any, saying: any): any {
  if (saying.toPartRef === '') return saying;
  const shown = ctx.db.worldClearingBacking.clearingKey.find(clearingKey(saying.toWorldRef, saying.toPartRef, saying.starRef));
  return shown && callerCanSeeClearing(ctx, shown) ? saying : { ...saying, toPartRef: '' };
}

export const star_saying = spacetimedb.view(
  { name: 'star_saying', public: true },
  t.array(starSayingBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.starSayingBacking.iter()) if (callerCanSeeSaying(ctx, row)) rows.push(sayingAsSeen(ctx, row));
    return rows;
  }
);

/* Say something at a star: a question, a finding, a correction or a
 * reproduction, to one thing shown at the star or to one thing said there.
 * Only a world gathered at the star says anything there, and it says it to
 * what it can see. The star's day records that it was said and of what
 * kind, never the words. Said again exactly, it changes nothing. */
export const say_at_star = spacetimedb.reducer(
  { sayingRef: t.string(), starRef: t.string(), worldRef: t.string(), toWorldRef: t.string(), toPartRef: t.string(), toSayingRef: t.string(), what: t.string(), words: t.string() },
  (ctx, args) => {
    if (!SAYING_REF_PATTERN.test(args.sayingRef)) fail('A saying is named saying:<name>');
    requireStar(ctx, args.starRef);
    const world = requireOwnWorld(ctx, args.worldRef);
    if (!world.linked) fail('Link your world into the field before you say anything at a star');
    if (!isGathered(ctx, args.starRef, args.worldRef)) fail('Your world says things at a star only while it is gathered there');
    if (!SAYING_KINDS.has(args.what)) fail('Say a question, a finding, a correction or a reproduction');
    const words = args.words.trim();
    if (!words) fail('Say something first');
    if ([...words].length > 1000) fail('Say it in at most 1000 characters');
    refuseFieldTimeLeaks([words], 'What is said');
    const toShown = args.toWorldRef !== '' || args.toPartRef !== '';
    if (toShown === (args.toSayingRef !== '')) fail('Say it to one thing: something shown at this star, or something said here');
    if (toShown) {
      const shown = ctx.db.worldClearingBacking.clearingKey.find(clearingKey(args.toWorldRef, args.toPartRef, args.starRef));
      if (!shown || !callerCanSeeClearing(ctx, shown)) fail('That is not shown at this star');
    } else {
      const said = ctx.db.starSayingBacking.sayingRef.find(args.toSayingRef);
      if (!said || said.starRef !== args.starRef || !callerCanSeeSaying(ctx, said)) fail('That was not said at this star');
    }
    const row = { sayingRef: args.sayingRef, starRef: args.starRef, worldRef: args.worldRef, toWorldRef: args.toWorldRef, toPartRef: args.toPartRef, toSayingRef: args.toSayingRef,
      what: args.what, words, saidAtMicros: nowMicros(ctx) };
    const existing = ctx.db.starSayingBacking.sayingRef.find(args.sayingRef);
    if (existing) {
      const same = (['starRef', 'worldRef', 'toWorldRef', 'toPartRef', 'toSayingRef', 'what', 'words'] as const).every((key) => existing[key] === row[key]);
      if (same) return;
      fail('Something else was said under that name');
    }
    if (Array.from(ctx.db.starSayingBacking.starRef.filter(args.starRef)).length >= STAR_SAYING_LIMIT) fail('This star holds as much as one star may: something said here must be unsaid first');
    ctx.db.starSayingBacking.insert(row);
    noteStarDay(ctx, args.starRef, args.worldRef, 'said', args.what);
  }
);

/* Unsay something said at a star: only its sayer does, at the star or after
 * leaving it. What answered it stands, under something now unsaid. */
export const unsay_at_star = spacetimedb.reducer(
  { sayingRef: t.string() },
  (ctx, args) => {
    const said = ctx.db.starSayingBacking.sayingRef.find(args.sayingRef);
    if (!said) fail('That was not said, or is unsaid already');
    if (!callerOwnsWorld(ctx, said.worldRef)) fail('Only the one who said it unsays it');
    ctx.db.starSayingBacking.sayingRef.delete(args.sayingRef);
    if (starRow(ctx, said.starRef)) noteStarDay(ctx, said.starRef, said.worldRef, 'unsaid', said.what);
  }
);

/* ---------- a piece of work shown at a star, a task offered there (O-I #858, SF12, SF13) ---------- */

const SHOWN_WORK_SCHEMA = 'factory.shown-work/v1';
const TASK_OFFER_SCHEMA = 'factory.task-offer/v1';
const TASK_OFFER_RETURN_SCHEMA = 'factory.task-offer-return/v1';
const WORK_REF_PATTERN = /^run:[A-Za-z0-9._:-]{1,200}$/;
const OFFER_REF_PATTERN = /^offer:[A-Za-z0-9._:-]{1,200}$/;
const SCHEME_REF_PATTERN = /^[A-Za-z][A-Za-z0-9+._-]*:\S{1,500}$/;
const TASK_WORDS = new Set(['waits', 'runs', 'stalls', 'returned', 'done', 'failed', 'stopped', 'idle']);
/** The longest a grant stands: thirty days, as Factory sets it. */
const GRANT_MAX_MICROS = 30n * 24n * 3600n * 1_000_000n;
/** How far ahead of the field's clock an offer may be dated: ten minutes, for two
 * machines' clocks apart. The offer's date is its offerer's; any later and the
 * thirty days counted from it would let a grant stand past thirty days from the
 * field's now. */
const OFFER_CLOCK_SKEW_MICROS = 10n * 60n * 1_000_000n;
/** The most one world shows or offers at one star. */
const STAR_WORK_LIMIT = 64;

function boundedText(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max) fail(`${name} is text of at most ${max} characters`);
  return value;
}

/** `factory.shown-work/v1`, exactly as Factory answers it: nothing rides along with it into the field. */
function requireShownWork(shownJson: string, workRef: string): Record<string, any> {
  const shown = requireJsonObject(shownJson, 'A shown work', 16_384);
  requireExactKeysOf(shown, ['schema', 'owner', 'work_ref', 'revision', 'name', 'standing', 'lifecycle', 'agents', 'made', 'tasks', 'withheld'], 'A shown work');
  if (shown.schema !== SHOWN_WORK_SCHEMA || shown.owner !== 'factory') fail(`A shown work is Software Factory's ${SHOWN_WORK_SCHEMA}`);
  if (shown.work_ref !== workRef) fail('A shown work names the work it shows');
  if (!Number.isInteger(shown.revision) || shown.revision < 0) fail('A shown work names the revision it was read at');
  boundedText(shown.name, 'A shown work’s name', 200);
  if (shown.standing !== 'live' && shown.standing !== 'kept') fail('A shown work is live or kept');
  if (typeof shown.lifecycle !== 'string' || !/^[a-z_]{1,32}$/.test(shown.lifecycle)) fail('A shown work says where its Run stands');
  if (!Array.isArray(shown.agents) || shown.agents.length > 64) fail('A shown work shows at most 64 agents');
  for (const agent of shown.agents) {
    requireExactKeysOf(agent, ['agent', 'at'], 'An agent at work');
    boundedText(agent.agent, 'An agent', 201);
    if (!TASK_WORDS.has(agent.at)) fail('An agent waits, runs, stalls, has returned, is done, failed, stopped or idle');
  }
  if (!Array.isArray(shown.made) || shown.made.length > 128) fail('A shown work shows at most 128 things made');
  for (const made of shown.made) {
    requireExactKeysOf(made, ['label', 'standing'], 'Something made');
    boundedText(made.label, 'Something made', 201);
    if (typeof made.standing !== 'string' || !/^[a-z_-]{1,32}$/.test(made.standing)) fail('Something made says how it stands');
  }
  requireExactKeysOf(shown.tasks, [...TASK_WORDS], 'The tasks');
  for (const count of Object.values(shown.tasks)) if (!Number.isInteger(count) || (count as number) < 0) fail('The tasks are counted');
  if (!Number.isInteger(shown.withheld) || shown.withheld < 0) fail('A shown work counts what it withheld');
  refuseFieldTimeLeaks(shown, 'A shown work');
  return shown;
}

function workKey(starRef: string, worldRef: string, workRef: string): string {
  return JSON.stringify([starRef, worldRef, workRef]);
}

/* A work shown at a star is served where a clearing shown there is: to its
 * world's owner, and while that world is linked and gathered at the star, to
 * the star's lighter and the worlds gathered there. */
function callerCanSeeStarWork(ctx: any, work: any): boolean {
  if (callerOwnsWorld(ctx, work.worldRef)) return true;
  const world = ctx.db.worldBacking.worldRef.find(work.worldRef);
  if (!world || !world.linked || !starRow(ctx, work.starRef) || !isGathered(ctx, work.starRef, work.worldRef)) return false;
  return isFieldOwner(ctx, work.starRef) || callerGatheredAt(ctx, work.starRef);
}

export const star_work = spacetimedb.view(
  { name: 'star_work', public: true },
  t.array(starWorkBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.starWorkBacking.iter()) if (callerCanSeeStarWork(ctx, row)) rows.push(row);
    return rows;
  }
);

/* Which shown works still answer, served exactly where the work is: never the
 * connection or identity it answers on. */
export const star_work_answer = spacetimedb.view(
  { name: 'star_work_answer', public: true },
  t.array(starWorkAnswerBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.starWorkAnswerBacking.iter()) {
      const work = ctx.db.starWorkBacking.workKey.find(row.workKey);
      if (work && callerCanSeeStarWork(ctx, work)) rows.push(row);
    }
    return rows;
  }
);

/* The work answers on the caller's connection while it is live; kept, or shown
 * from no connection (a one-shot call that cannot answer later), it answers on
 * none. Answering already on this connection, nothing changes. */
function answerWork(ctx: any, key: string, starRef: string, worldRef: string, workRef: string, standing: string): void {
  const connection = callerConnection(ctx);
  const bound = ctx.db.starWorkAnswerConnection.workKey.find(key);
  if (standing === 'live' && connection !== '' && bound && bound.connectionRef === connection) return;
  unanswerWork(ctx, key);
  if (standing !== 'live' || connection === '') return;
  ctx.db.starWorkAnswerBacking.insert({ workKey: key, starRef, worldRef, workRef, answeredAtMicros: nowMicros(ctx) });
  ctx.db.starWorkAnswerConnection.insert({ workKey: key, connectionRef: connection, answerIdentity: ctx.sender });
}

function unanswerWork(ctx: any, key: string): void {
  ctx.db.starWorkAnswerBacking.workKey.delete(key);
  ctx.db.starWorkAnswerConnection.workKey.delete(key);
}

/* Show a piece of work at a star, or show it again as it moved: only its
 * world does, while gathered there, and only forward — a reading older than
 * the one shown is refused, and once its Run has closed it stands as it was
 * kept. Shown again exactly, it changes nothing; while it is live it answers
 * on the connection that showed it (star_work_answer). */
export const show_work_at_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string(), workRef: t.string(), shownJson: t.string() },
  (ctx, args) => {
    requireStar(ctx, args.starRef);
    const world = requireOwnWorld(ctx, args.worldRef);
    if (!world.linked) fail('Link your world into the field before you show work at a star');
    if (!isGathered(ctx, args.starRef, args.worldRef)) fail('Your world shows work at a star only while it is gathered there');
    requireRef(args.workRef, WORK_REF_PATTERN, 'The work');
    const shown = requireShownWork(args.shownJson, args.workRef);
    const shownJson = JSON.stringify(shown);
    const key = workKey(args.starRef, args.worldRef, args.workRef);
    const now = nowMicros(ctx);
    const existing = ctx.db.starWorkBacking.workKey.find(key);
    if (existing) {
      // shown again exactly, the work changes nothing; it answers again on this connection while it is live
      if (existing.shownJson === shownJson) { answerWork(ctx, key, args.starRef, args.worldRef, args.workRef, existing.standing); return; }
      if (existing.standing === 'kept') fail('This work was kept when it closed; it stands as it was');
      if (BigInt(shown.revision) < existing.revision) fail('A newer reading of this work is shown already');
      ctx.db.starWorkBacking.workKey.update({ ...existing, shownJson, revision: BigInt(shown.revision), standing: shown.standing, updatedAtMicros: now });
      answerWork(ctx, key, args.starRef, args.worldRef, args.workRef, shown.standing);
      return;
    }
    if (Array.from(ctx.db.starWorkBacking.worldRef.filter(args.worldRef)).filter((row: any) => row.starRef === args.starRef).length >= STAR_WORK_LIMIT) fail('Your world shows as much work at this star as one world may');
    ctx.db.starWorkBacking.insert({ workKey: key, starRef: args.starRef, worldRef: args.worldRef, workRef: args.workRef, shownJson, revision: BigInt(shown.revision), standing: shown.standing, shownAtMicros: now, updatedAtMicros: now });
    answerWork(ctx, key, args.starRef, args.worldRef, args.workRef, shown.standing);
    noteStarDay(ctx, args.starRef, args.worldRef, 'showed', 'work');
  }
);

/* Take a shown work back: it goes under cloud everywhere at once. */
export const unshow_work_at_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string(), workRef: t.string() },
  (ctx, args) => {
    requireOwnWorld(ctx, args.worldRef);
    const key = workKey(args.starRef, args.worldRef, args.workRef);
    if (!ctx.db.starWorkBacking.workKey.find(key)) fail('That work is not shown at this star');
    ctx.db.starWorkBacking.workKey.delete(key);
    unanswerWork(ctx, key);
    if (starRow(ctx, args.starRef)) noteStarDay(ctx, args.starRef, args.worldRef, 'took-back', 'work');
  }
);

function refsOf(value: unknown, name: string, atLeastOne: boolean): string[] {
  if (!Array.isArray(value) || value.length > 32 || (atLeastOne && value.length === 0)) fail(`${name} names ${atLeastOne ? 1 : 0} to 32 refs`);
  for (const ref of value) if (typeof ref !== 'string' || !SCHEME_REF_PATTERN.test(ref)) fail(`${name} names refs`);
  return value as string[];
}

/** What a grant lets be touched: the ref itself and what lies under it. */
function grantCovers(granted: string[], subject: string): boolean {
  return granted.some((grant) => subject === grant || subject.startsWith(`${grant}/`));
}

/** `factory.task-offer/v1`, exactly as Factory answers it, at this star, dated
 * no later than the field's clock allows: its grant then lapses within thirty
 * days of the field's now. */
function requireTaskOffer(offerJson: string, starRef: string, fieldNowMicros: bigint): Record<string, any> {
  const offer = requireJsonObject(offerJson, 'An offer', 8192);
  requireExactKeysOf(offer, ['schema', 'offer_ref', 'star_ref', 'programme', 'task', 'grant', 'offered_at', 'automatic_agent_or_model_invocation'], 'An offer');
  if (offer.schema !== TASK_OFFER_SCHEMA) fail(`An offer is Software Factory's ${TASK_OFFER_SCHEMA}`);
  requireRef(offer.offer_ref, OFFER_REF_PATTERN, 'The offer');
  if (offer.star_ref !== starRef) fail('An offer is made at the star it names');
  requireExactKeysOf(offer.programme, ['run_ref', 'workflow_unit_ref'], 'The programme');
  requireRef(offer.programme.run_ref, WORK_REF_PATTERN, 'The programme');
  requireRef(offer.programme.workflow_unit_ref, SCHEME_REF_PATTERN, 'The task');
  requireExactKeysOf(offer.task, ['key', 'asks', 'returns'], 'The task');
  boundedText(offer.task.key, 'The task’s key', 200);
  boundedText(offer.task.asks, 'What the task asks', 2000);
  boundedText(offer.task.returns, 'What the task returns', 200);
  requireExactKeysOf(offer.grant, ['reads', 'touches', 'lapses_at'], 'The grant');
  refsOf(offer.grant.reads, 'What the grant lets the task read', true);
  refsOf(offer.grant.touches, 'What the grant lets the task touch', false);
  if (!Number.isInteger(offer.grant.lapses_at) || !Number.isInteger(offer.offered_at) || offer.grant.lapses_at <= offer.offered_at) fail('A grant lapses after it is set');
  if (BigInt(offer.grant.lapses_at - offer.offered_at) * 1000n > GRANT_MAX_MICROS) fail('A grant lapses within thirty days of it');
  if (BigInt(offer.offered_at) * 1000n > fieldNowMicros + OFFER_CLOCK_SKEW_MICROS) fail("An offer is dated no later than ten minutes ahead of the field's clock");
  if (offer.automatic_agent_or_model_invocation !== false) fail('An offer runs nothing by itself');
  refuseFieldTimeLeaks(offer, 'An offer');
  return offer;
}

/** `factory.task-offer-return/v1`, exactly as the taker's Factory answers it, by the world that took the offer, within its grant. */
function requireTaskReturn(returnJson: string, offer: Record<string, any>, takerWorldRef: string): Record<string, any> {
  const back = requireJsonObject(returnJson, 'What came back', 8192);
  requireExactKeysOf(back, ['schema', 'offer_ref', 'star_ref', 'by', 'made', 'returned_at', 'automatic_agent_or_model_invocation'], 'What came back');
  if (back.schema !== TASK_OFFER_RETURN_SCHEMA) fail(`What comes back is Software Factory's ${TASK_OFFER_RETURN_SCHEMA}`);
  if (back.offer_ref !== offer.offer_ref || back.star_ref !== offer.star_ref) fail('What came back answers another offer');
  requireExactKeysOf(back.by, ['world_ref', 'name'], 'Who made it');
  if (back.by.world_ref !== takerWorldRef) fail('What comes back comes under the name of the world that took the task');
  boundedText(back.by.name, 'Who made it', 200);
  requireExactKeysOf(back.made, ['label', 'summary', 'refs'], 'What was made');
  boundedText(back.made.label, 'What was made', 200);
  boundedText(back.made.summary, 'What was made', 2000);
  for (const ref of refsOf(back.made.refs, 'What was made', false)) {
    if (!grantCovers(offer.grant.touches, ref)) fail(`What came back touches ${ref}, which the grant does not let the task touch`);
  }
  if (!Number.isInteger(back.returned_at) || back.returned_at > offer.grant.lapses_at) fail('It came back after the grant lapsed');
  if (back.automatic_agent_or_model_invocation !== false) fail('What comes back runs nothing by itself');
  refuseFieldTimeLeaks(back, 'What came back');
  return back;
}

function lapsed(ctx: any, offer: any): boolean {
  return nowMicros(ctx) >= offer.lapsesAtMicros;
}

/* An offer is served to its offerer; while the offerer's world is linked and
 * gathered at the star, to the star's lighter and the worlds gathered there
 * while it stands open; once taken, to the world that took it. What came back
 * is served to the offerer and the taker alone: to anyone else the row names
 * nothing that came back. */
function callerCanSeeOffer(ctx: any, offer: any): boolean {
  if (callerOwnsWorld(ctx, offer.worldRef)) return true;
  if (offer.takerWorldRef !== '' && callerOwnsWorld(ctx, offer.takerWorldRef)) return true;
  if (offer.state !== 'open') return false;
  const world = ctx.db.worldBacking.worldRef.find(offer.worldRef);
  if (!world || !world.linked || !starRow(ctx, offer.starRef) || !isGathered(ctx, offer.starRef, offer.worldRef)) return false;
  return isFieldOwner(ctx, offer.starRef) || callerGatheredAt(ctx, offer.starRef);
}

function offerAsSeen(ctx: any, offer: any): any {
  if (offer.returnJson === '' || callerOwnsWorld(ctx, offer.worldRef) || callerOwnsWorld(ctx, offer.takerWorldRef)) return offer;
  return { ...offer, returnJson: '' };
}

export const star_offer = spacetimedb.view(
  { name: 'star_offer', public: true },
  t.array(starOfferBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.starOfferBacking.iter()) if (callerCanSeeOffer(ctx, row)) rows.push(offerAsSeen(ctx, row));
    return rows;
  }
);

/* Offer a task at a star: Factory's offer of one unit of a programme, under
 * its grant, by a world gathered there. Offered again exactly, it changes
 * nothing; an offer is never changed once made. */
export const offer_at_star = spacetimedb.reducer(
  { starRef: t.string(), worldRef: t.string(), offerJson: t.string() },
  (ctx, args) => {
    requireStar(ctx, args.starRef);
    const world = requireOwnWorld(ctx, args.worldRef);
    if (!world.linked) fail('Link your world into the field before you offer a task at a star');
    if (!isGathered(ctx, args.starRef, args.worldRef)) fail('Your world offers tasks at a star only while it is gathered there');
    const offer = requireTaskOffer(args.offerJson, args.starRef, nowMicros(ctx));
    const offerJson = JSON.stringify(offer);
    const lapsesAtMicros = BigInt(offer.grant.lapses_at) * 1000n;
    if (lapsesAtMicros <= nowMicros(ctx)) fail('The grant has lapsed already');
    const existing = ctx.db.starOfferBacking.offerRef.find(offer.offer_ref);
    if (existing) {
      if (existing.offerJson === offerJson && existing.worldRef === args.worldRef) return;
      fail('Another offer stands under that name');
    }
    if (Array.from(ctx.db.starOfferBacking.worldRef.filter(args.worldRef)).filter((row: any) => row.starRef === args.starRef && row.state === 'open').length >= STAR_WORK_LIMIT) {
      fail('Your world offers as many tasks at this star as one world may');
    }
    const now = nowMicros(ctx);
    ctx.db.starOfferBacking.insert({ offerRef: offer.offer_ref, starRef: args.starRef, worldRef: args.worldRef, offerJson, lapsesAtMicros, state: 'open', takerWorldRef: '', returnJson: '', offeredAtMicros: now, movedAtMicros: now });
    noteStarDay(ctx, args.starRef, args.worldRef, 'offered', 'task');
  }
);

function requireOffer(ctx: any, offerRef: string): any {
  const offer = ctx.db.starOfferBacking.offerRef.find(offerRef);
  if (!offer || !callerCanSeeOffer(ctx, offer)) fail('There is no such offer');
  return offer;
}

/* The offerer revokes the offer and its grant, at any moment before what came
 * back is accepted. */
export const revoke_offer = spacetimedb.reducer(
  { offerRef: t.string() },
  (ctx, args) => {
    const offer = requireOffer(ctx, args.offerRef);
    if (!callerOwnsWorld(ctx, offer.worldRef)) fail('Only the one who offered a task revokes it');
    if (offer.state === 'revoked') return;
    if (offer.state === 'accepted') fail('What came back was accepted already');
    ctx.db.starOfferBacking.offerRef.update({ ...offer, state: 'revoked', movedAtMicros: nowMicros(ctx) });
    if (starRow(ctx, offer.starRef)) noteStarDay(ctx, offer.starRef, offer.worldRef, 'revoked', 'task');
  }
);

/* Another world gathered at the star takes the task up, before its grant
 * lapses; one world takes it. */
export const take_offer = spacetimedb.reducer(
  { offerRef: t.string(), worldRef: t.string() },
  (ctx, args) => {
    const offer = requireOffer(ctx, args.offerRef);
    const world = requireOwnWorld(ctx, args.worldRef);
    if (args.worldRef === offer.worldRef) fail('A task is offered to other worlds than the one that offered it');
    if (offer.state === 'taken' && offer.takerWorldRef === args.worldRef) return;
    if (offer.state !== 'open') fail(offer.state === 'revoked' ? 'The offer was revoked' : 'Another world took this task up');
    if (!world.linked || !isGathered(ctx, offer.starRef, args.worldRef)) fail('Your world takes up a task at a star only while it is gathered there');
    if (lapsed(ctx, offer)) fail('The offer’s grant has lapsed');
    ctx.db.starOfferBacking.offerRef.update({ ...offer, state: 'taken', takerWorldRef: args.worldRef, movedAtMicros: nowMicros(ctx) });
    noteStarDay(ctx, offer.starRef, args.worldRef, 'took', 'task');
  }
);

/* The world that took the task brings back what it made, under its own name,
 * within the grant and before it lapses. */
export const return_offer = spacetimedb.reducer(
  { offerRef: t.string(), returnJson: t.string() },
  (ctx, args) => {
    const offer = requireOffer(ctx, args.offerRef);
    if (offer.takerWorldRef === '' || !callerOwnsWorld(ctx, offer.takerWorldRef)) fail('Only the world that took the task brings back what it made');
    const back = requireTaskReturn(args.returnJson, parseStoredJson(offer.offerJson, 'Offer'), offer.takerWorldRef);
    const returnJson = JSON.stringify(back);
    if (offer.state === 'returned' && offer.returnJson === returnJson) return;
    if (offer.state === 'revoked') fail('The offer was revoked; nothing goes back');
    if (offer.state !== 'taken') fail('What the task made has gone back already');
    if (lapsed(ctx, offer)) fail('The grant has lapsed; nothing goes back');
    ctx.db.starOfferBacking.offerRef.update({ ...offer, state: 'returned', returnJson, movedAtMicros: nowMicros(ctx) });
    if (starRow(ctx, offer.starRef)) noteStarDay(ctx, offer.starRef, offer.takerWorldRef, 'brought-back', 'task');
  }
);

/* The offerer accepts what came back: it enters the offerer's programme
 * through its own Factory, under its maker's name. */
export const accept_offer_return = spacetimedb.reducer(
  { offerRef: t.string() },
  (ctx, args) => {
    const offer = requireOffer(ctx, args.offerRef);
    if (!callerOwnsWorld(ctx, offer.worldRef)) fail('Only the one who offered a task accepts what came back');
    if (offer.state === 'accepted') return;
    if (offer.state !== 'returned') fail(offer.state === 'revoked' ? 'The offer was revoked' : 'Nothing has come back to accept');
    ctx.db.starOfferBacking.offerRef.update({ ...offer, state: 'accepted', movedAtMicros: nowMicros(ctx) });
  }
);

/* ---------- a contribution to what another world shows (O-I #858, SF07) ----------
 *
 * A question, a finding, a correction or a reproduction, contributed by a world
 * in the field to something another world shows — a place, a page, any part in
 * a clearing it may see, in the field, to the public or at a star — or to a
 * contribution there, to any depth. It rides the module's own Contribution rows,
 * never a second store: it enters quarantined, its field the world it waits in
 * (the world that shows its target, or the one its thread stands in), and waits
 * there for that world's owner, its contributor's until then. Accepted, it is
 * admitted into that world and stands on its target under its contributor's
 * world, as what it is, for whoever may read the target; refused, the refusal
 * and its words reach the contributor alone. Its contributor takes it back at
 * any time. No one is served the identity another sent or decided under. */
const WORLD_CONTRIBUTION_SCHEMA = 'oi.world-contribution/v1';
const WORLD_CONTRIBUTION_REF_PATTERN = /^contribution:[A-Za-z0-9._:-]{1,200}$/;
/** How far up a thread a reading looks for what a contribution stands on: far past any thread people write, short of a runaway walk. */
const WORLD_CONTRIBUTION_DEPTH = 256;

/** The ingress row of a contribution to a world, by its name, or undefined. */
function worldContributionRow(ctx: any, contributionRef: string): any {
  for (const row of ctx.db.contributionIngressBacking.claimedContributionRef.filter(contributionRef)) {
    if (row.sourceKind === WORLD_CONTRIBUTION_SOURCE) return row;
  }
  return undefined;
}

const worldContributionContract = (row: any): Record<string, any> => parseStoredJson(row.contractJson, 'World contribution');

/* A contribution is read by the owner of the world it waits in and by its
 * contributor, in any state until it is taken back; once accepted, also by
 * whoever may read what it stands on — the clearing it was contributed to, or
 * the contribution above it, up the thread. */
function callerCanSeeWorldContribution(ctx: any, row: any, depth = 0): boolean {
  if (row.sourceKind !== WORLD_CONTRIBUTION_SOURCE || row.state === 'withdrawn') return false;
  if (callerOwnsWorld(ctx, row.fieldRef) || callerOwnsWorld(ctx, row.contributorParticipantRef)) return true;
  if (row.state !== 'admitted' || depth >= WORLD_CONTRIBUTION_DEPTH) return false;
  const to = worldContributionContract(row).to ?? {};
  if (typeof to.contribution_ref === 'string') {
    const above = worldContributionRow(ctx, to.contribution_ref);
    return Boolean(above && callerCanSeeWorldContribution(ctx, above, depth + 1));
  }
  const shown = ctx.db.worldClearingBacking.clearingKey.find(clearingKey(String(to.world_ref), String(to.part_ref), String(to.star_ref ?? '')));
  return Boolean(shown && callerCanSeeClearing(ctx, shown));
}

/** A contribution as the caller is served it: the part it was contributed to is named only while the caller may see it there. Taken
 * back under cloud, the part lies there with everything else, and the contribution names only whose world it was. */
function worldContributionAsSeen(ctx: any, row: any): any {
  const contract = worldContributionContract(row);
  const to = contract.to ?? {};
  if (typeof to.part_ref !== 'string' || to.part_ref === '') return row;
  const shown = ctx.db.worldClearingBacking.clearingKey.find(clearingKey(String(to.world_ref), to.part_ref, String(to.star_ref ?? '')));
  if (shown && callerCanSeeClearing(ctx, shown)) return row;
  return { ...row, contractJson: JSON.stringify({ ...contract, to: { ...to, part_ref: '' } }) };
}

/** The contributions that stand accepted in a world, as the caller may read them. */
export const world_contribution = spacetimedb.view(
  { name: 'world_contribution', public: true },
  t.array(admittedContributionBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const row of ctx.db.admittedContributionBacking.visibility.filter(WORLD_CONTRIBUTION_VISIBILITY)) {
      const ingress = ctx.db.contributionIngressBacking.ingressRef.find(row.ingressRef);
      if (ingress && callerCanSeeWorldContribution(ctx, ingress)) rows.push(worldContributionAsSeen(ctx, row));
    }
    return rows;
  }
);

/** The contributions that stand accepted in the worlds of the caller's circle (the narrower apertures; DLW build ruling 2026-11-06): a
 * subset of world_contribution, each re-checked for the caller as it is there, so what is contributed and accepted outside the circle
 * sends them nothing. The caller's own and what waits for it are read at every aperture (my_world_contribution, world_contribution_waiting). */
export const my_circle_contribution = spacetimedb.view(
  { name: 'my_circle_contribution', public: true },
  t.array(admittedContributionBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    const stars = callerCircleStars(ctx);
    for (const row of ctx.db.admittedContributionBacking.visibility.filter(WORLD_CONTRIBUTION_VISIBILITY)) {
      if (!inCallerCircle(ctx, row.fieldRef, stars)) continue;
      const ingress = ctx.db.contributionIngressBacking.ingressRef.find(row.ingressRef);
      if (ingress && callerCanSeeWorldContribution(ctx, ingress)) rows.push(worldContributionAsSeen(ctx, row));
    }
    return rows;
  }
);

/** The caller's own contributions to other worlds, waiting, accepted or refused (never another's identity: the caller's own stands in). */
export const my_world_contribution = spacetimedb.view(
  { name: 'my_world_contribution', public: true },
  t.array(contributionIngressBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
      for (const row of ctx.db.contributionIngressBacking.contributorParticipantRef.filter(owned.worldRef)) {
        if (row.sourceKind === WORLD_CONTRIBUTION_SOURCE && row.state !== 'withdrawn') rows.push({ ...worldContributionAsSeen(ctx, row), submitterIdentity: ctx.sender });
      }
    }
    return rows;
  }
);

/** What waits for the caller in its own worlds: each contribution named by its contributor's world, never by the identity it was sent under. */
export const world_contribution_waiting = spacetimedb.view(
  { name: 'world_contribution_waiting', public: true },
  t.array(contributionIngressBacking.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
      for (const row of ctx.db.contributionIngressBacking.fieldRef.filter(owned.worldRef)) {
        if (row.sourceKind === WORLD_CONTRIBUTION_SOURCE && row.state === 'quarantined') rows.push({ ...row, submitterIdentity: ctx.sender });
      }
    }
    return rows;
  }
);

/** How each of the caller's contributions was answered — accepted or refused, in the owner's words — for the caller alone. */
export const my_world_contribution_answer = spacetimedb.view(
  { name: 'my_world_contribution_answer', public: true },
  t.array(admissionDecision.rowType),
  (ctx) => {
    const rows: any[] = [];
    for (const owned of ctx.db.worldOwner.ownerIdentity.filter(ctx.sender)) {
      for (const row of ctx.db.contributionIngressBacking.contributorParticipantRef.filter(owned.worldRef)) {
        if (row.sourceKind !== WORLD_CONTRIBUTION_SOURCE || row.state === 'withdrawn') continue;
        for (const decision of ctx.db.admissionDecision.ingressRef.filter(row.ingressRef)) rows.push({ ...decision, admissionActorIdentity: ctx.sender });
      }
    }
    return rows;
  }
);

function worldContributionWords(value: string, required: boolean): string {
  const words = value.trim();
  if (required && !words) fail('Say something first');
  if ([...words].length > 1000) fail('Say it in at most 1000 characters');
  refuseFieldTimeLeaks([words], 'What is said');
  return words;
}

/* Contribute to something another world shows, or to a contribution there.
 * Only a world linked into the field contributes, under its own name, to what
 * it can read; never to its own world. It waits, quarantined, for the owner of
 * the world it is aimed into. Contributed again exactly, it changes nothing. */
export const contribute_to_world = spacetimedb.reducer(
  { contributionRef: t.string(), worldRef: t.string(), toWorldRef: t.string(), toPartRef: t.string(), toStarRef: t.string(), toContributionRef: t.string(), what: t.string(), words: t.string() },
  (ctx, args) => {
    if (!WORLD_CONTRIBUTION_REF_PATTERN.test(args.contributionRef)) fail('A contribution is named contribution:<name>');
    const world = requireOwnWorld(ctx, args.worldRef);
    if (!world.linked) fail('Link your world into the field before you contribute to another');
    if (!SAYING_KINDS.has(args.what)) fail('Contribute a question, a finding, a correction or a reproduction');
    const words = worldContributionWords(args.words, true);
    const toShown = args.toWorldRef !== '' || args.toPartRef !== '';
    if (toShown === (args.toContributionRef !== '')) fail('Contribute to one thing: something a world shows, or a contribution there');
    let into: string;
    let to: Record<string, string>;
    if (toShown) {
      const shown = ctx.db.worldClearingBacking.clearingKey.find(clearingKey(args.toWorldRef, args.toPartRef, args.toStarRef));
      if (!shown || !callerCanSeeClearing(ctx, shown)) fail('That is not shown to you');
      into = args.toWorldRef;
      to = { world_ref: args.toWorldRef, part_ref: args.toPartRef, star_ref: args.toStarRef };
    } else {
      if (args.toStarRef !== '') fail('A contribution to a contribution names no star');
      const above = worldContributionRow(ctx, args.toContributionRef);
      if (!above || !callerCanSeeWorldContribution(ctx, above)) fail('There is no such contribution you can read');
      into = above.fieldRef;
      to = { contribution_ref: args.toContributionRef };
    }
    if (callerOwnsWorld(ctx, into)) fail('That stands in your own world: what you add there is yours already, not a contribution');
    const contractJson = JSON.stringify({ schema: WORLD_CONTRIBUTION_SCHEMA, contribution_ref: args.contributionRef, world_ref: into, from_world_ref: args.worldRef, to, what: args.what, words });
    const claims = contributionClaimsForRef(ctx, args.contributionRef);
    if (claims.length > 0) {
      if (claims.length === 1 && claims[0].sourceKind === WORLD_CONTRIBUTION_SOURCE && claims[0].state !== 'withdrawn' && claims[0].contractJson === contractJson) return;
      fail('Something was contributed under that name before: give this one a name of its own');
    }
    const payloadBytes = utf8Bytes(contractJson);
    enforceContributionOutstanding(ctx, into, args.worldRef);
    enforceContributionRate(ctx, into, args.worldRef, payloadBytes);
    const fingerprint = fingerprintString(contractJson);
    const now = nowMicros(ctx);
    const ingressKey = fingerprintString(`${into}\u001f${args.worldRef}\u001f${WORLD_CONTRIBUTION_SOURCE}\u001f${args.contributionRef}`);
    const ingressRef = `ingress:${fingerprintString(`${ingressKey}\u001f${fingerprint}`)}`;
    if (ctx.db.contributionIngressBacking.ingressKey.find(ingressKey) || ctx.db.contributionIngressBacking.ingressRef.find(ingressRef)) fail('That contribution collides with another; give it a name of its own');
    ctx.db.contributionIngressBacking.insert({
      rowId: 0n,
      ingressRef,
      ingressKey,
      fieldRef: into,
      claimedContributionRef: args.contributionRef,
      contributorParticipantRef: args.worldRef,
      submitterIdentity: ctx.sender,
      sourceKind: WORLD_CONTRIBUTION_SOURCE,
      transportProvider: WORLD_CONTRIBUTION_SOURCE,
      transportMessageId: args.contributionRef,
      payloadFingerprint: fingerprint,
      payloadBytes: BigInt(payloadBytes),
      receivedAtMicros: now,
      state: 'quarantined',
      contractJson,
      serverProvenanceJson: JSON.stringify({
        schema: 'oi.ingress-provenance/v1',
        observed: { source_kind: WORLD_CONTRIBUTION_SOURCE, target_world_ref: into, contributor_world_ref: args.worldRef, received_at_micros: String(now) },
        claims: { contribution_ref: args.contributionRef, payload_fingerprint: fingerprint },
      }),
    });
    ctx.db.contributionReceipt.insert({
      ingressRef,
      submitterIdentity: ctx.sender,
      fieldRef: into,
      contributionRef: args.contributionRef,
      state: 'quarantined',
      receivedAtMicros: now,
      payloadFingerprint: fingerprint,
    });
  }
);

/** A contribution waiting in one of the caller's worlds, for its owner to answer. */
function requireWaitingForCaller(ctx: any, contributionRef: string): any {
  const row = worldContributionRow(ctx, contributionRef);
  if (!row || !callerCanSeeWorldContribution(ctx, row)) fail('There is no such contribution');
  if (!callerOwnsWorld(ctx, row.fieldRef)) fail('Only the owner of the world it was contributed to answers it');
  return row;
}

function answerWorldContribution(ctx: any, row: any, disposition: 'admitted' | 'rejected', words: string): string {
  const now = nowMicros(ctx);
  const decisionRef = admissionDecisionRef(row.ingressRef, disposition, now, row.fieldRef);
  ctx.db.admissionDecision.insert({
    decisionRef,
    ingressRef: row.ingressRef,
    fieldRef: row.fieldRef,
    disposition,
    admissionActorIdentity: ctx.sender,
    admissionParticipantRef: row.fieldRef,
    decidedAtMicros: now,
    reason: words,
    evidenceJson: '{}',
    serverProvenanceJson: JSON.stringify({ schema: 'oi.admission-provenance/v1', ingress_ref: row.ingressRef, target_field_ref: row.fieldRef, decided_at_micros: String(now), payload_fingerprint: row.payloadFingerprint }),
  });
  ctx.db.contributionIngressBacking.rowId.update({ ...row, state: disposition });
  updateContributionReceiptState(ctx, row, disposition);
  return decisionRef;
}

/* Accept a contribution into the caller's world: it stands on its target
 * under its contributor's name for whoever may read the target. The words,
 * if any, reach the contributor alone. Accepted again, it changes nothing. */
export const accept_contribution_in_world = spacetimedb.reducer(
  { contributionRef: t.string(), words: t.string() },
  (ctx, args) => {
    const row = requireWaitingForCaller(ctx, args.contributionRef);
    const words = worldContributionWords(args.words, false);
    if (row.state === 'admitted') return;
    if (row.state !== 'quarantined') fail('It was refused: it waits no more');
    const decisionRef = answerWorldContribution(ctx, row, 'admitted', words);
    ctx.db.admittedContributionBacking.insert({
      rowId: 0n,
      ingressRef: row.ingressRef,
      contributionRef: row.claimedContributionRef,
      fieldRef: row.fieldRef,
      contributorParticipantRef: row.contributorParticipantRef,
      visibility: WORLD_CONTRIBUTION_VISIBILITY,
      audienceRefsJson: '[]',
      admissionDecisionRef: decisionRef,
      admittedAtMicros: nowMicros(ctx),
      contractJson: row.contractJson,
    });
  }
);

/* Refuse a contribution waiting in the caller's world, in words: the refusal
 * reaches its contributor alone, and it enters no one's world. */
export const refuse_contribution_in_world = spacetimedb.reducer(
  { contributionRef: t.string(), words: t.string() },
  (ctx, args) => {
    const row = requireWaitingForCaller(ctx, args.contributionRef);
    if (!args.words.trim()) fail('Say why, in your own words');
    const words = worldContributionWords(args.words, true);
    if (row.state === 'admitted') fail('It is accepted: it stands in your world');
    if (row.state !== 'quarantined') fail('It was refused already');
    answerWorldContribution(ctx, row, 'rejected', words);
  }
);

/* Take back a contribution the caller made, waiting, accepted or refused: it
 * stands nowhere after, for anyone. What was contributed under it stands, under
 * something now taken back. */
export const take_back_contribution = spacetimedb.reducer(
  { contributionRef: t.string() },
  (ctx, args) => {
    const row = worldContributionRow(ctx, args.contributionRef);
    if (!row || !callerCanSeeWorldContribution(ctx, row)) fail('There is no such contribution, or it is taken back already');
    if (!callerOwnsWorld(ctx, row.contributorParticipantRef)) fail('Only the one who contributed it takes it back');
    const admitted = ctx.db.admittedContributionBacking.ingressRef.find(row.ingressRef);
    if (admitted) ctx.db.admittedContributionBacking.rowId.delete(admitted.rowId);
    ctx.db.contributionIngressBacking.rowId.update({ ...row, state: 'withdrawn' });
    updateContributionReceiptState(ctx, row, 'withdrawn');
  }
);
