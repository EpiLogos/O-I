// First-class capability census.
//
// The census ladder (eligible → selected → loaded → granted → invoked →
// realised) is generated from live AIKit/native owner registries at run/test
// time, never pasted into a static file. Each entry carries the native ref that
// produced it (registry path, capsule id, or event id).

import type { CapabilityCensus, CensusEntry, CensusStage } from "./model.ts";

export interface TreeRow {
  path: string;
  summary: string;
  depth?: number;
  expandable?: boolean;
  expanded?: boolean;
}

export interface ActiveCapability {
  id: string;
  kind?: string;
  name?: string;
  exports?: string[];
}

export interface RecentEvent {
  event_id?: string;
  action?: string;
  outcome?: string;
  capability?: string | null;
  session?: string | null;
  session_name?: string | null;
  state?: string | null;
  at?: string;
  mux?: string | null;
}

export interface CensusInputs {
  treeRows: TreeRow[];
  active: ActiveCapability[];
  catalogued: number;
  events: RecentEvent[];
}

export const CENSUS_STAGES: readonly CensusStage[] = [
  "eligible",
  "selected",
  "loaded",
  "granted",
  "invoked",
  "realised",
];

export function buildCensus(inputs: CensusInputs): CapabilityCensus {
  const stages: Record<CensusStage, CensusEntry[]> = {
    eligible: [],
    selected: [],
    loaded: [],
    granted: [],
    invoked: [],
    realised: [],
  };

  // eligible: catalogue/registry rows from `aikit tree --all`.
  for (const row of inputs.treeRows) {
    if (row.path.startsWith("registries/")) {
      stages.eligible.push({
        ref: row.path,
        stage: "eligible",
        label: row.summary,
      });
    }
  }

  // selected: skill-set members that the resolver projected (not withheld).
  for (const row of inputs.treeRows) {
    if (row.path.startsWith("sets/") && /projected/.test(row.summary)) {
      stages.selected.push({
        ref: row.path,
        stage: "selected",
        label: row.summary,
      });
    }
  }

  // loaded: the resolver's live active set.
  for (const capability of inputs.active) {
    stages.loaded.push({
      ref: capability.id,
      stage: "loaded",
      label: capability.name ?? capability.id,
      evidenceRef: capability.id,
    });
  }

  // granted / invoked / realised: event-backed, from the live activity ledger.
  for (const event of inputs.events) {
    const ref = event.event_id ?? `event/${event.action ?? "unknown"}`;
    const label =
      event.capability ?? event.session_name ?? event.session ?? event.action ?? "event";
    if (event.action === "trust-review" && event.outcome === "success") {
      stages.granted.push({
        ref,
        stage: "granted",
        label,
        evidenceRef: event.event_id,
      });
    }
    if (
      (event.action === "run" || event.action === "hook-dispatch") &&
      event.capability != null
    ) {
      stages.invoked.push({
        ref,
        stage: "invoked",
        label,
        evidenceRef: event.event_id,
      });
    }
    if (event.outcome === "success") {
      stages.realised.push({
        ref,
        stage: "realised",
        label,
        evidenceRef: event.event_id,
      });
    }
  }

  const counts = Object.fromEntries(
    CENSUS_STAGES.map((stage) => [stage, stages[stage].length]),
  ) as Record<CensusStage, number>;

  return {
    stages,
    counts,
    totalEligible: inputs.catalogued,
    provenance: [
      "aikit tree --all --json (registries/sets)",
      "aikit status --json (active)",
      "aikit stats --json (catalogued)",
      "aikit recent --json (granted/invoked/realised)",
    ],
  };
}

/** Render the census ladder as compact human lines (per acceptance: explainable). */
export function censusLines(census: CapabilityCensus): string[] {
  const lines: string[] = [];
  for (const stage of CENSUS_STAGES) {
    const entries = census.stages[stage];
    if (entries.length === 0) {
      lines.push(`${stage}: 0`);
      continue;
    }
    lines.push(`${stage}: ${entries.length}`);
    for (const entry of entries.slice(0, 6)) {
      lines.push(`  - ${entry.ref}`);
    }
    if (entries.length > 6) {
      lines.push(`  … ${entries.length - 6} more`);
    }
  }
  lines.push(`totalEligible(catalogued): ${census.totalEligible}`);
  return lines;
}
