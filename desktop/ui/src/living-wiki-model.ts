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
