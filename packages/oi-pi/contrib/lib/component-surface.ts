// Component/Surface/SessionSpace contribution contract.
//
// `aikit:component-surface-authoring` — the package declares a stable Surface
// contribution, stages it write-free, and classifies live activation state from
// native-owner observations. A visible Surface never implies activation
// authority: activation is owned by the AIKit provider process, and this module
// only ever *observes* provider truth.

import type { SurfaceLifecycleProof, SurfaceLifecycleState } from "./model.ts";

export const SESSION_SPACE_CONTRIBUTION_VERSION = "aikit.session-space-contribution/v1";
export const SESSION_SPACE_VERSION = "aikit.session-space/v1";

export const SURFACE_CONTRIBUTION_ID = "session-space-contribution/oi/observatory-surface";
export const SESSION_SPACE_ID = "session-space/oi/self-dev";
export const PROVIDER_REF = "provider/oi/pi-surface";
export const SURFACE_REFS: readonly string[] = [
  "surface/oi/compact-widget",
  "surface/oi/observatory-overlay",
];
export const PROVENANCE: readonly string[] = [
  "O:I-for-Pi package (oi.package/v1)",
  "aikit:component-surface-authoring",
  "source:EpiLogos/O-I/packages/oi-pi",
];

export interface SurfaceContributionDefinition {
  version: string;
  id: string;
  session_space: string;
  provider: string;
  surface_refs: string[];
  provenance: string[];
}

export interface StagedSurfaceContribution {
  definition: SurfaceContributionDefinition;
  /** The write-free SessionSpace view the staging would produce. */
  preview: {
    version: string;
    id: string;
    lifecycle: "open";
    surfaces: Array<{ surface: string; state: SurfaceLifecycleState }>;
  };
}

/** Declare the stable, provider-sourced identity. Presentation stays separate. */
export function defineSurfaceContribution(): SurfaceContributionDefinition {
  return {
    version: SESSION_SPACE_CONTRIBUTION_VERSION,
    id: SURFACE_CONTRIBUTION_ID,
    session_space: SESSION_SPACE_ID,
    provider: PROVIDER_REF,
    surface_refs: [...SURFACE_REFS],
    provenance: [...PROVENANCE],
  };
}

/** Stage the contribution and inspect the resulting SessionSpace view (write-free). */
export function stageSurfaceContribution(
  definition: SurfaceContributionDefinition = defineSurfaceContribution(),
): StagedSurfaceContribution {
  return {
    definition,
    preview: {
      version: SESSION_SPACE_VERSION,
      id: definition.session_space,
      lifecycle: "open",
      surfaces: definition.surface_refs.map((surface) => ({
        surface,
        state: "declared" as SurfaceLifecycleState,
      })),
    },
  };
}

export interface ActivationObservation {
  activeRefs: readonly string[];
  selectedRefs: readonly string[];
  withheldRefs: readonly string[];
  removedRefs: readonly string[];
  /** The native command that produced this observation. */
  provenance: readonly string[];
}

/**
 * Classify provider truth. The TUI can render a Surface without any authority;
 * `active` is only ever reported when the native owner observed the surface ref
 * in the live active set.
 */
export function classifyActivation(
  observation: ActivationObservation,
  contribution = defineSurfaceContribution(),
): { state: SurfaceLifecycleState; reason: string } {
  const any = (set: readonly string[]) =>
    contribution.surface_refs.some((ref) => set.includes(ref));
  if (any(observation.removedRefs)) {
    return {
      state: "removed",
      reason: "native owner removed the surface ref from the live set",
    };
  }
  if (any(observation.withheldRefs)) {
    return {
      state: "withheld",
      reason: "surface is available but withheld by resolver/provider policy",
    };
  }
  if (any(observation.activeRefs)) {
    return {
      state: "active",
      reason: "provider observed the surface ref in the live active set",
    };
  }
  if (any(observation.selectedRefs)) {
    return {
      state: "selected",
      reason: "surface is selected for projection but not yet observed active",
    };
  }
  return {
    state: "eligible",
    reason: "surface is discovered and staged; activation is not claimed",
  };
}

/** Prove the contribution lifecycle with the observed state and its evidence. */
export function proveLifecycle(
  observation: ActivationObservation,
): SurfaceLifecycleProof[] {
  const contribution = defineSurfaceContribution();
  const { state, reason } = classifyActivation(observation, contribution);
  const authority =
    "activation is owned by the AIKit provider process (`aikit enable`); the Pi TUI never asserts activation authority";

  const proofs: SurfaceLifecycleProof[] = [
    {
      state: "discovered",
      contribution: contribution.id,
      evidence: [...observation.provenance],
      authority,
    },
    {
      state: "staged",
      contribution: contribution.id,
      evidence: ["aikit.session-space-contribution/v1 definition staged write-free"],
      authority,
    },
    {
      state: "previewed",
      contribution: contribution.id,
      evidence: ["aikit.session-space/v1 preview inspected before activation"],
      authority,
    },
  ];

  const observedOrder: SurfaceLifecycleState[] = [
    "eligible",
    "selected",
    "active",
    "withheld",
    "removed",
  ];
  if (observedOrder.includes(state)) {
    proofs.push({
      state,
      contribution: contribution.id,
      evidence: [...observation.provenance],
      authority,
      reason,
    });
  }

  return proofs;
}
