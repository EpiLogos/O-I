import { createHash } from 'node:crypto';
import { createExploreApplication } from './explore.mjs';

export const COMMON_REFERENT_SCHEMA = 'oi.common-referent/v1';
export const REFERENT_BINDING_SCHEMA = 'oi.referent-binding/v1';
export const REFERENT_CANDIDATE_SCHEMA = 'oi.referent-candidate/v1';
export const REFERENT_READING_SCHEMA = 'oi.common-referent-reading/v1';
export const REFERENT_SEARCH_RESULT_SCHEMA = 'oi.common-referent-result/v1';
export const REFERENT_RESOLUTION_SCHEMA = 'oi.referent-resolution/v1';

export const REFERENT_RELATION_KINDS = Object.freeze([
  'same-representation',
  'same-resource',
  'same-referent',
  'version-of',
  'variant-form-of',
  'translation-of',
  'derived-from',
  'claims-same-referent',
  'disputes-same-referent',
]);

export const REFERENT_EVIDENCE_LADDER = Object.freeze({
  strong: Object.freeze([
    'cryptographic-representation-digest',
    'durable-domain-identifier',
    'source-native-lineage',
    'publisher-assertion',
    'structured-provenance-agreement',
  ]),
  weak: Object.freeze([
    'fuzzy-metadata-similarity',
    'semantic-similarity',
  ]),
});

const ACCEPTED_SEMANTIC_RELATIONS = new Set([
  'same-resource',
  'same-referent',
  'version-of',
  'variant-form-of',
  'translation-of',
  'derived-from',
]);
const WEAK_EVIDENCE = new Set(REFERENT_EVIDENCE_LADDER.weak);
const VERSION_RELATIONS = new Set(['version-of', 'variant-form-of', 'translation-of', 'derived-from']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function digestBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function strictBase64(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) return undefined;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return undefined;
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value) return undefined;
  return decoded;
}

/**
 * Return exact representation bytes only when the representation itself carries an
 * unambiguous byte encoding. Arbitrary JSON objects are deliberately not canonicalised:
 * object equality or a caller-supplied digest is not representation identity.
 */
export function representationBytes(representation) {
  if (!isRecord(representation) || !Object.prototype.hasOwnProperty.call(representation, 'payload')) return undefined;
  const payload = representation.payload;
  if (typeof payload === 'string') return Buffer.from(payload, 'utf8');
  if (!isRecord(payload)) return undefined;
  if (typeof payload.bytes_base64 === 'string') return strictBase64(payload.bytes_base64);
  if (typeof payload.text === 'string' && (payload.encoding === undefined || payload.encoding === 'utf-8')) {
    return Buffer.from(payload.text, 'utf8');
  }
  if (Array.isArray(payload.bytes) && payload.bytes.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) {
    return Buffer.from(payload.bytes);
  }
  return undefined;
}

export function representationDigestEvidence(representation) {
  const bytes = representationBytes(representation);
  if (!bytes) return undefined;
  return {
    kind: 'cryptographic-representation-digest',
    strength: 'strong',
    algorithm: 'sha-256',
    value: digestBytes(bytes),
    byte_length: bytes.length,
    automatic_binding_scope: 'same-representation-only',
  };
}

function exactReferentRef(digest) {
  return `oi:referent:exact:${sha256(`oi.common-referent/v1\u0000sha-256\u0000${digest}`)}`;
}

function claimReferentRef(claimRef) {
  return `oi:referent:claim:${sha256(`oi.common-referent/v1\u0000claim\u0000${claimRef}`)}`;
}

function bindingRef(referentRef, subject, relationKind, evidenceKey = '') {
  return `oi:referent-binding:${sha256([
    REFERENT_BINDING_SCHEMA,
    referentRef,
    subject.kind,
    subject.ref,
    subject.revision ?? '',
    relationKind,
    evidenceKey,
  ].join('\u001f'))}`;
}

function visibleSubject(entry) {
  return {
    ref: entry.ref,
    kind: entry.kind,
    ...(entry.revision ? { revision: entry.revision } : {}),
  };
}

function projectionEntry(entryByRef, projection) {
  const direct = entryByRef.get(projection.projection_ref);
  if (direct && (direct.kind === 'projection' || direct.projection_ref === projection.projection_ref)) return direct;
  for (const entry of entryByRef.values()) {
    if (entry.projection_ref === projection.projection_ref) return entry;
  }
  return undefined;
}

function latestVisibleProjections(projections) {
  const latest = new Map();
  for (const projection of projections ?? []) {
    if (!isRecord(projection) || typeof projection.projection_ref !== 'string') continue;
    const prior = latest.get(projection.projection_ref);
    if (!prior || Number(projection.projection_revision ?? 0) > Number(prior.projection_revision ?? 0)) {
      latest.set(projection.projection_ref, projection);
    }
  }
  return [...latest.values()].filter(projection => projection.state === 'published');
}

function contributionRelationWith(contribution) {
  const withRef = contribution?.relation?.with;
  if (!isRecord(withRef) || typeof withRef.ref !== 'string' || typeof withRef.kind !== 'string') return undefined;
  return { ref: withRef.ref, kind: withRef.kind, ...(withRef.revision ? { revision: withRef.revision } : {}) };
}

function compactContribution(contribution) {
  return {
    contribution_ref: contribution.contribution_ref,
    contributor_participant_ref: contribution.contributor_participant_ref,
    created_at: contribution.created_at,
    mode: contribution.mode,
    target: clone(contribution.target),
    relation: clone(contribution.relation),
    provenance: clone(contribution.provenance),
  };
}

function reconciliationCandidates(contributions, indexedEntryRefs, visibleEntryRefs, mediatorParticipantRefs) {
  const eligible = new Map();
  for (const contribution of contributions ?? []) {
    if (!isRecord(contribution) || typeof contribution.contribution_ref !== 'string') continue;
    if (!indexedEntryRefs.has(contribution.contribution_ref)) continue;
    eligible.set(contribution.contribution_ref, contribution);
  }

  const disputes = new Map();
  const decisions = new Map();
  for (const contribution of eligible.values()) {
    const relationKind = contribution?.relation?.kind;
    const claimRef = contribution?.target?.ref;
    if (relationKind === 'disputes-same-referent' && typeof claimRef === 'string') {
      if (!disputes.has(claimRef)) disputes.set(claimRef, []);
      disputes.get(claimRef).push(contribution);
    }
    if (relationKind === 'accepts-same-referent' && typeof claimRef === 'string') {
      if (!decisions.has(claimRef)) decisions.set(claimRef, []);
      decisions.get(claimRef).push(contribution);
    }
  }

  const candidates = [];
  for (const claim of eligible.values()) {
    if (claim?.relation?.kind !== 'claims-same-referent') continue;
    const other = contributionRelationWith(claim);
    const relationKind = claim?.relation?.relation_kind ?? 'same-referent';
    if (!other || !ACCEPTED_SEMANTIC_RELATIONS.has(relationKind)) continue;
    if (!visibleEntryRefs.has(claim.target?.ref) || !visibleEntryRefs.has(other.ref)) continue;

    const claimDisputes = disputes.get(claim.contribution_ref) ?? [];
    const claimDecisions = decisions.get(claim.contribution_ref) ?? [];
    const authorisedDecisions = claimDecisions.filter(decision => mediatorParticipantRefs.has(decision.contributor_participant_ref));
    const acceptedDecision = claimDisputes.length === 0 ? authorisedDecisions[0] : undefined;
    const referentRef = acceptedDecision
      ? acceptedDecision.relation?.referent_ref ?? claimReferentRef(claim.contribution_ref)
      : undefined;
    if (referentRef !== undefined && !String(referentRef).startsWith('oi:referent:')) {
      throw new TypeError('accepted referent_ref must use the oi:referent: namespace');
    }
    candidates.push({
      schema: REFERENT_CANDIDATE_SCHEMA,
      claim_ref: claim.contribution_ref,
      subjects: [clone(claim.target), clone(other)],
      relation_kind: relationKind,
      state: claimDisputes.length > 0 ? 'disputed' : acceptedDecision ? 'accepted' : 'proposed',
      asserted_by: {
        participant_ref: claim.contributor_participant_ref,
        contribution_ref: claim.contribution_ref,
      },
      evidence: [
        { kind: 'attributable-source-assertion', strength: 'strong', contribution_ref: claim.contribution_ref },
        ...(acceptedDecision ? [{ kind: 'receiving-side-reconciliation-decision', strength: 'strong', contribution_ref: acceptedDecision.contribution_ref }] : []),
        ...claimDisputes.map(dispute => ({ kind: 'attributable-dispute', strength: 'strong', contribution_ref: dispute.contribution_ref })),
      ],
      ...(claimDecisions.length > authorisedDecisions.length ? {
        unauthorised_decision_refs: claimDecisions.filter(decision => !mediatorParticipantRefs.has(decision.contributor_participant_ref)).map(decision => decision.contribution_ref),
      } : {}),
      ...(acceptedDecision ? {
        decision_ref: acceptedDecision.contribution_ref,
        referent_ref: referentRef,
        decided_by: acceptedDecision.contributor_participant_ref,
      } : {}),
    });
  }
  return { eligible, candidates };
}

export function createSimilarityCandidate(input) {
  requireRecord(input, 'referent candidate');
  const left = requireRecord(input.left, 'referent candidate.left');
  const right = requireRecord(input.right, 'referent candidate.right');
  requireString(left.ref, 'referent candidate.left.ref');
  requireString(right.ref, 'referent candidate.right.ref');
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) throw new TypeError('referent candidate.evidence must be non-empty');
  const evidence = input.evidence.map((item, index) => {
    const value = requireRecord(item, `referent candidate.evidence[${index}]`);
    const kind = requireString(value.kind, `referent candidate.evidence[${index}].kind`);
    if (!WEAK_EVIDENCE.has(kind)) throw new TypeError('similarity candidates accept weak evidence only');
    return { ...clone(value), strength: 'weak' };
  });
  return {
    schema: REFERENT_CANDIDATE_SCHEMA,
    candidate_ref: `oi:referent-candidate:${sha256(JSON.stringify([left, right, evidence]))}`,
    subjects: [clone(left), clone(right)],
    relation_kind: 'claims-same-referent',
    state: 'proposed',
    automatic_binding_eligible: false,
    evidence,
  };
}

function dedupeObjects(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function comparePreferred(preference, left, right) {
  if (!preference) return 0;
  const score = candidate => {
    let value = 0;
    if (preference.projection_ref && candidate.projection_ref === preference.projection_ref) value += 256;
    if (preference.publisher_participant_ref && candidate.publisher_participant_ref === preference.publisher_participant_ref) value += 128;
    if (preference.source_system && candidate.source?.system === preference.source_system) value += 64;
    if (preference.revision && (candidate.source?.revision === preference.revision || String(candidate.projection_revision) === String(preference.revision))) value += 32;
    if (preference.form && candidate.representation?.kind === preference.form) value += 16;
    if (preference.world_ref && candidate.world_ref === preference.world_ref) value += 8;
    if (preference.language && candidate.language === preference.language) value += 4;
    if (preference.representation_digest && candidate.representation_digest === preference.representation_digest) value += 2;
    if (preference.prefer_local === true && candidate.local === true) value += 1;
    return value;
  };
  return score(right) - score(left);
}

export function applyReferentPreference(reading, preference) {
  requireRecord(reading, 'referent reading');
  requireRecord(preference, 'referent preference');
  const copy = clone(reading);
  copy.projections = [...copy.projections].sort((left, right) => comparePreferred(preference, left, right)
    || String(left.projection_ref).localeCompare(String(right.projection_ref)));
  copy.forms = [...copy.forms].sort((left, right) => comparePreferred(preference, left, right)
    || String(left.ref).localeCompare(String(right.ref)));
  copy.curation = {
    mode: 'personal-read-order',
    preference: clone(preference),
    non_implications: ['trust', 'authority', 'semantic-truth', 'ownership-transfer'],
  };
  return copy;
}

export function createReferentResolutionRequest(input) {
  requireRecord(input, 'referent resolution request');
  const referentRef = requireString(input.referent_ref, 'referent resolution request.referent_ref');
  if (!referentRef.startsWith('oi:referent:')) throw new TypeError('referent_ref must use the oi:referent: namespace');
  return {
    schema: REFERENT_RESOLUTION_SCHEMA,
    referent_ref: referentRef,
    constraints: clone(input.constraints ?? {}),
    load: input.load === true ? 'selected-only' : 'none',
  };
}

/**
 * Build a reconciliation/read layer from an already caller-filtered, index-eligible
 * Explore horizon. This is deliberate: the function has no global digest lookup and
 * cannot see private/quarantined/unindexed state that the hosting layer withheld.
 */
export function createReferentExploreApplication(seed = {}) {
  const entries = (seed.entries ?? []).map(clone);
  const relations = (seed.relations ?? []).map(clone);
  const projections = latestVisibleProjections(seed.projections ?? []);
  const contributions = (seed.contributions ?? []).map(clone);
  const weakCandidates = (seed.candidates ?? []).map(candidate => clone(candidate));
  const mediatorParticipantRefs = new Set(seed.mediation_participant_refs ?? []);
  const explore = createExploreApplication({ entries, relations });
  const entryByRef = new Map(entries.map(entry => [entry.ref, entry]));
  const indexedEntryRefs = new Set(entryByRef.keys());
  const visibleEntryRefs = new Set(entryByRef.keys());

  // A Projection is eligible for reconciliation only if the caller can currently see
  // both its canonical Projection row and an Explore entry representing it.
  const indexedProjections = projections
    .map(projection => ({ projection, entry: projectionEntry(entryByRef, projection) }))
    .filter(item => item.entry !== undefined);

  const subjectToReferent = new Map();
  const digestByProjection = new Map();
  const bindings = [];
  const exactClusters = new Map();

  for (const { projection, entry } of indexedProjections) {
    const evidence = representationDigestEvidence(projection.representation);
    if (!evidence) continue;
    const referentRef = exactReferentRef(evidence.value);
    const subject = visibleSubject(entry);
    if (!exactClusters.has(referentRef)) exactClusters.set(referentRef, new Set());
    exactClusters.get(referentRef).add(subject.ref);
    subjectToReferent.set(subject.ref, referentRef);
    digestByProjection.set(projection.projection_ref, evidence.value);
    bindings.push({
      schema: REFERENT_BINDING_SCHEMA,
      binding_ref: bindingRef(referentRef, subject, 'same-representation', evidence.value),
      referent_ref: referentRef,
      subject,
      relation_kind: 'same-representation',
      evidence: [evidence],
      asserted_by: { kind: 'service', ref: 'o-i:common-referent-reconciler' },
      mediation: {
        kind: 'automatic-exact-representation',
        gate: 'caller-visible+explore-indexed',
        semantic_scope: 'representation-equality-only',
      },
      state: 'accepted',
      created_at: projection.published_at,
    });
  }

  const { eligible: eligibleContributions, candidates: attributableCandidates } = reconciliationCandidates(
    contributions,
    indexedEntryRefs,
    visibleEntryRefs,
    mediatorParticipantRefs,
  );
  const candidates = [...attributableCandidates, ...weakCandidates];
  const alias = new Map();
  const resolveAlias = ref => {
    let cursor = ref;
    const seen = new Set();
    while (alias.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      cursor = alias.get(cursor);
    }
    return cursor;
  };
  const remap = (from, to) => {
    if (!from || from === to) return;
    const resolvedFrom = resolveAlias(from);
    const resolvedTo = resolveAlias(to);
    if (resolvedFrom !== resolvedTo) alias.set(resolvedFrom, resolvedTo);
  };

  for (const candidate of attributableCandidates.filter(item => item.state === 'accepted')) {
    const chosenRef = candidate.referent_ref;
    for (const subject of candidate.subjects) {
      const current = subjectToReferent.get(subject.ref);
      if (current) remap(current, chosenRef);
    }
    for (const subject of candidate.subjects) subjectToReferent.set(subject.ref, chosenRef);

    const claim = eligibleContributions.get(candidate.claim_ref);
    const decision = eligibleContributions.get(candidate.decision_ref);
    for (const subject of candidate.subjects) {
      const entry = entryByRef.get(subject.ref);
      const normalizedSubject = entry ? visibleSubject(entry) : clone(subject);
      bindings.push({
        schema: REFERENT_BINDING_SCHEMA,
        binding_ref: bindingRef(chosenRef, normalizedSubject, candidate.relation_kind, `${candidate.claim_ref}|${candidate.decision_ref}`),
        referent_ref: chosenRef,
        subject: normalizedSubject,
        relation_kind: candidate.relation_kind,
        evidence: clone(candidate.evidence),
        asserted_by: {
          kind: 'participant',
          participant_ref: claim.contributor_participant_ref,
          contribution_ref: claim.contribution_ref,
        },
        mediation: {
          kind: 'explicit-attributable-reconciliation',
          decision_contribution_ref: decision.contribution_ref,
          decided_by_participant_ref: decision.contributor_participant_ref,
          gate: 'admitted+caller-visible+explore-indexed',
        },
        state: 'accepted',
        created_at: decision.created_at,
      });
    }
  }

  for (const [subjectRef, referentRef] of [...subjectToReferent]) {
    subjectToReferent.set(subjectRef, resolveAlias(referentRef));
  }
  for (const binding of bindings) binding.referent_ref = resolveAlias(binding.referent_ref);

  const visibleReferentRefs = new Set(subjectToReferent.values());
  const referentBindings = referentRef => bindings.filter(binding => binding.referent_ref === referentRef);
  const memberRefs = referentRef => [...subjectToReferent.entries()]
    .filter(([, candidateRef]) => candidateRef === referentRef)
    .map(([subjectRef]) => subjectRef);

  function aggregate(referentRef, options = {}) {
    requireString(referentRef, 'referent ref');
    if (!visibleReferentRefs.has(referentRef)) return undefined;
    const members = memberRefs(referentRef);
    const memberSet = new Set(members);
    const memberEntries = members.map(ref => entryByRef.get(ref)).filter(Boolean);
    const memberProjections = indexedProjections
      .filter(({ entry }) => memberSet.has(entry.ref))
      .map(({ projection, entry }) => ({ projection, entry }));
    const candidateRows = candidates.filter(candidate => candidate.subjects?.some(subject => memberSet.has(subject.ref)));
    const identityContributionRefs = new Set(candidateRows.flatMap(candidate => [candidate.claim_ref, candidate.decision_ref].filter(Boolean)));
    const identityContributions = [...identityContributionRefs]
      .map(ref => eligibleContributions.get(ref))
      .filter(Boolean)
      .map(compactContribution);
    const memberRelations = relations.filter(relation => memberSet.has(relation.from) || memberSet.has(relation.to));

    const projectionRows = memberProjections.map(({ projection, entry }) => ({
      projection_ref: projection.projection_ref,
      projection_revision: projection.projection_revision,
      subject: clone(projection.subject),
      source: clone(projection.source),
      publisher_participant_ref: projection.publisher_participant_ref,
      representation: {
        kind: projection.representation?.kind,
        ...(projection.representation?.ref ? { ref: projection.representation.ref } : {}),
        payload_available: Object.prototype.hasOwnProperty.call(projection.representation ?? {}, 'payload'),
      },
      audience: clone(projection.audience),
      provenance: clone(projection.provenance),
      world_ref: entry.world_ref,
      language: entry.meta?.language,
      local: entry.meta?.holding === 'local',
      ...(digestByProjection.has(projection.projection_ref) ? { representation_digest: digestByProjection.get(projection.projection_ref) } : {}),
    }));

    const forms = memberEntries.map(entry => {
      const projection = projectionRows.find(row => row.projection_ref === (entry.projection_ref ?? entry.ref));
      return {
        ref: entry.ref,
        kind: entry.kind,
        label: entry.label,
        world_ref: entry.world_ref,
        ...(entry.revision ? { revision: entry.revision } : {}),
        ...(projection ? {
          projection_ref: projection.projection_ref,
          publisher_participant_ref: projection.publisher_participant_ref,
          source: clone(projection.source),
          representation: clone(projection.representation),
          representation_digest: projection.representation_digest,
          language: projection.language,
          local: projection.local,
        } : {}),
      };
    });

    const representative = [...memberEntries]
      .sort((left, right) => left.label.localeCompare(right.label) || left.ref.localeCompare(right.ref))[0];
    const provenance = dedupeObjects([
      ...memberEntries.flatMap(entry => entry.provenance ?? []),
      ...memberProjections.flatMap(({ projection }) => projection.provenance ?? []),
      ...identityContributions.flatMap(contribution => contribution.provenance ?? []),
    ]);
    const reconciliationRelations = candidateRows.map(candidate => ({
      origin: 'referent-reconciliation',
      relation: candidate.relation_kind,
      state: candidate.state,
      subjects: clone(candidate.subjects),
      claim_ref: candidate.claim_ref,
      ...(candidate.decision_ref ? { decision_ref: candidate.decision_ref } : {}),
      evidence: clone(candidate.evidence),
    }));
    const allRelations = [...memberRelations.map(clone), ...reconciliationRelations];
    const reading = {
      schema: REFERENT_READING_SCHEMA,
      common: {
        schema: COMMON_REFERENT_SCHEMA,
        referent_ref: referentRef,
        display_heading: representative?.label ?? referentRef,
        representative_ref: representative?.ref,
        display_mediation: 'caller-visible deterministic presentation; not canonical truth',
      },
      forms,
      versions: reconciliationRelations.filter(relation => VERSION_RELATIONS.has(relation.relation)),
      projections: projectionRows,
      provenance,
      relations: allRelations,
      contributions: identityContributions,
      bindings: referentBindings(referentRef).map(clone),
      identity_candidates: candidateRows.map(clone),
      counts: {
        visible_forms: forms.length,
        visible_projected_holdings: projectionRows.length,
        visible_worlds: new Set(memberEntries.map(entry => entry.world_ref)).size,
        visible_representation_forms: new Set(projectionRows.map(row => row.representation.kind).filter(Boolean)).size,
      },
      privacy: {
        basis: 'caller-filtered-input-only',
        hidden_member_count: 'not-computed',
        digest_lookup: 'not-exposed',
      },
      actions: {
        watch_referent: {
          semantics: 'Watch availability/change for this common referent; Watch does not imply trust.',
          target: { kind: 'object', ref: referentRef },
          hosted_persistence: 'adapter-required',
        },
        watch_projection: projectionRows.map(row => ({ kind: 'object', ref: row.projection_ref })),
        prefer: ['publisher/source', 'revision', 'exact-representation', 'local-holding', 'language/form'],
      },
    };
    return options.preference ? applyReferentPreference(reading, options.preference) : reading;
  }

  function search(query = '', options = {}) {
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 20;
    const all = explore.search(query, { ...options, limit: Math.max(1, entries.length) });
    const grouped = new Map();
    const ordinary = [];
    for (const result of all) {
      const referentRef = subjectToReferent.get(result.ref);
      if (!referentRef) {
        ordinary.push(result);
        continue;
      }
      const prior = grouped.get(referentRef);
      if (!prior || result.score > prior.score
          || (result.score === prior.score && result.label.localeCompare(prior.label) < 0)) {
        grouped.set(referentRef, result);
      }
    }
    const commonResults = [...grouped.entries()].map(([referentRef, representative]) => {
      const reading = aggregate(referentRef);
      return {
        schema: REFERENT_SEARCH_RESULT_SCHEMA,
        ref: referentRef,
        kind: 'common-referent',
        label: representative.label,
        summary: representative.summary,
        score: representative.score,
        representative_ref: representative.ref,
        counts: clone(reading.counts),
        ranking: {
          basis: 'best-visible-member-text-score',
          duplicate_count_boost: false,
          holder_count_authority: false,
        },
      };
    });
    return [...commonResults, ...ordinary]
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label) || left.ref.localeCompare(right.ref))
      .slice(0, limit);
  }

  function open(ref, options = {}) {
    requireString(ref, 'ref');
    if (ref.startsWith('oi:referent:')) return aggregate(ref, options);
    return explore.open(ref, options);
  }

  function explain(ref) {
    requireString(ref, 'ref');
    if (!ref.startsWith('oi:referent:')) return explore.explain(ref);
    const reading = aggregate(ref);
    if (!reading) return undefined;
    return {
      ref,
      kind: 'common-referent',
      ownership: 'derived mediation/read model; does not own member objects',
      identity: 'stable referential pole over caller-visible attributable bindings',
      bindings: clone(reading.bindings),
      privacy: clone(reading.privacy),
    };
  }

  function resolveConcreteSource(request) {
    const valid = createReferentResolutionRequest(request);
    const reading = aggregate(valid.referent_ref, { preference: valid.constraints });
    if (!reading) return undefined;
    const selected = reading.projections[0] ?? reading.forms[0];
    return {
      schema: REFERENT_RESOLUTION_SCHEMA,
      referent_ref: valid.referent_ref,
      selected: selected ? clone(selected) : undefined,
      alternatives: reading.projections.slice(1).map(clone),
      load: valid.load,
      rule: 'select one eligible concrete form; do not load every duplicate automatically',
      non_identity: ['WikiNode', 'Source', 'KnowledgeRoute', 'Projection'],
    };
  }

  return Object.freeze({
    search,
    open,
    explain,
    aggregate,
    resolveConcreteSource,
    referentFor: ref => subjectToReferent.get(ref),
    bindings: () => bindings.map(clone),
    candidates: () => candidates.map(clone),
  });
}
