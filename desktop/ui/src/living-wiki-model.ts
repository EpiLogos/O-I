export type LivingChangedSource = {
  source_ref: string;
  cursor: number;
  kind: string;
  roles: string[];
  provenance: string;
  standing: string;
  agent_retrieval_allowed: boolean;
};

export type LivingAffectedResource = {
  resource: string;
  source: string;
  relation: string;
  freshness: string;
  basis_revision?: string;
  observed_revision?: string;
};

export type LivingTransitiveAffected = {
  resource: string;
  root_source: string;
  relation: string;
  freshness: string;
};

export type LivingImpactStep = {
  from: unknown;
  to: string;
  relation: string;
};

export type LivingImpactPath = {
  resource: string;
  root_source: string;
  freshness: string;
  steps: LivingImpactStep[];
};

export type LivingWikiDesktopReading = {
  version: string;
  world_ref: string;
  provider: string;
  cursor: number;
  changed: LivingChangedSource[];
  impact: {
    direct: {
      changed_sources: string[];
      affected: LivingAffectedResource[];
      automatic_agent_or_model_invocation: boolean;
    };
    transitive: LivingTransitiveAffected[];
    paths: LivingImpactPath[];
    pending_integration: string[];
    truncated: boolean;
    automatic_agent_or_model_invocation: boolean;
  };
  source_payloads_exposed: boolean;
  automatic_agent_or_model_invocation: boolean;
  source_authority_owner: string;
  impact_owner: string;
  contemplate_owner: string;
};

export type LivingSummary = {
  changed: number;
  affected: number;
  pending: number;
};

export type LivingPresentationDepth = 'ordinary' | 'explain' | 'formal';

export type LivingQlSubject = {
  reference: string;
  revision?: string;
  subject_type?: string;
  frame_ref?: string;
  context_refs?: string[];
};

export type LivingQlRefraction = {
  subject: LivingQlSubject;
  lens: string;
  sublens?: string;
  frame?: string;
};

export type LivingQlPresentation = {
  available: boolean;
  depth: LivingPresentationDepth;
  summary?: string;
  method?: string;
  subject?: string;
  subjectRevision?: string;
  subjectType?: string;
  frameRef?: string;
  contextRefs?: string[];
  lens?: string;
  sublens?: string;
  frame?: string;
};

export type LivingOwnerObservation<T> = {
  reading: T | null;
  freshness: 'current' | 'last-observed' | 'unavailable';
  error?: string;
};

export type LivingIntegrativeReading = {
  reading: {
    ref: string;
    revision: number;
    frame_ref: string;
    reading_type: string;
    artifact_ref?: string;
    derived_by_ref?: string;
    provenance?: Array<{
      source_ref: string;
      source_revision?: string | number | Record<string, unknown>;
      producer_ref?: string;
      generation_ref?: string;
    }>;
    [key: string]: unknown;
  };
  basis: Array<{
    resource: string;
    source?: string;
    source_revision?: string;
    roles?: string[];
  }>;
  relations: Array<{ from: string; to: string; relation: string }>;
  return_paths: Array<{ from_basis: string; through?: string[]; to_whole: string }>;
  freshness: string;
};

export function livingSummary(reading: LivingWikiDesktopReading): LivingSummary {
  const affected = new Set<string>();
  for (const entry of reading.impact.direct.affected) affected.add(entry.resource);
  for (const entry of reading.impact.transitive) affected.add(entry.resource);
  return {
    changed: reading.changed.length,
    affected: affected.size,
    pending: new Set(reading.impact.pending_integration).size,
  };
}

export function relatedLivingState(reading: LivingWikiDesktopReading, resourceRef?: string) {
  if (!resourceRef) return { changed: [], affected: [], paths: [], pending: false };
  const changed = reading.changed.filter((entry) => entry.source_ref === resourceRef);
  const affected = [
    ...reading.impact.direct.affected.filter(
      (entry) => entry.resource === resourceRef || entry.source === resourceRef,
    ),
    ...reading.impact.transitive.filter(
      (entry) => entry.resource === resourceRef || entry.root_source === resourceRef,
    ),
  ];
  const paths = reading.impact.paths.filter(
    (entry) => entry.resource === resourceRef || entry.root_source === resourceRef,
  );
  return {
    changed,
    affected,
    paths,
    pending: reading.impact.pending_integration.includes(resourceRef),
  };
}

export function freshnessLabel(value: string): string {
  switch (value) {
    case 'basis-changed': return 'Basis changed';
    case 'integration-pending': return 'Pending integration';
    case 'basis-unavailable': return 'Basis unavailable';
    case 'fresh': return 'Current';
    default: return value;
  }
}

export function canContemplate(resourceRef?: string): boolean {
  return typeof resourceRef === 'string' && resourceRef.trim().length > 0;
}

/// Keep the last owner-produced reading when a refresh becomes unavailable. This
/// is presentation continuity only: the retained value is explicitly labelled
/// last-observed and is never promoted to current semantic truth.
export function ownerObservation<T>(
  previous: T | null,
  next: T | null,
  error?: string,
): LivingOwnerObservation<T> {
  if (next !== null) return { reading: next, freshness: 'current' };
  if (previous !== null) {
    return { reading: previous, freshness: 'last-observed', error: error || 'owner refresh unavailable' };
  }
  return { reading: null, freshness: 'unavailable', error: error || 'owner reading unavailable' };
}

/// Presentation-only view over an AIKit-owned optional QL request. Ordinary depth
/// deliberately emits no QL terminology. Explain/formal only reveal facts already
/// carried by the owner request; O:I computes no operator, lens or Context Frame.
export function qlPresentation(
  method: string | undefined,
  ql: LivingQlRefraction | undefined,
  depth: LivingPresentationDepth,
): LivingQlPresentation {
  if (!ql && !method) return { available: false, depth };
  if (depth === 'ordinary') return { available: true, depth };

  const summary = ql
    ? 'Formal/refraction method contributes to this situated operation.'
    : 'An explicit project method contributes to this situated operation.';
  if (depth === 'explain') {
    return {
      available: true,
      depth,
      summary,
      method,
      subject: ql?.subject.reference,
      lens: ql?.lens,
    };
  }

  return {
    available: true,
    depth,
    summary,
    method,
    subject: ql?.subject.reference,
    subjectRevision: ql?.subject.revision,
    subjectType: ql?.subject.subject_type,
    frameRef: ql?.subject.frame_ref,
    contextRefs: ql?.subject.context_refs ?? [],
    lens: ql?.lens,
    sublens: ql?.sublens,
    frame: ql?.frame,
  };
}
