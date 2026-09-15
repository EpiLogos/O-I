/**
 * The frozen reconciliation vocabulary (docs/cradle/
 * 09-CONFIGURATION-PLANE.md §7.1) as pure functions. Derivation is a pure
 * function of (desired state, native reading) — the exact truth table is
 * pinned by `suite/configuration/cases/resolution-cases.json`, and the
 * fixture source's own states exercise every row of it in the UI.
 *
 * Precedence (derived from the frozen cases — each case isolates one
 * precedence fact):
 *   unsupported  identity first: the setting is absent from the owner's
 *                contribution or not addressable at this scope
 *   blocked      the owner cannot reconcile now (unavailable / degraded /
 *                validation failed / authority missing) — beats unknown
 *                (case "unavailable owner is blocked") and beats drift
 *   pending      an owner-side stage or open plan is in flight — beats
 *                drift (case "an owner-side stage in flight is pending")
 *   drifted      desired and the compared native axis both present, differ
 *   satisfied    desired equals the compared axis, or nothing is owed
 *   unknown      desired present but no native axes were disclosed — never
 *                guessed (case "no native axes disclosed is unknown")
 */

import type {
  ChangeSetStatus,
  ConfigResolution,
  DesiredState,
  ReconciliationStatus,
} from "./contracts";

/** The native axis desired is compared against: effective, falling back to
 * declared where effective is absent (§7.1 satisfied/drifted wording). */
export function comparedNativeAxis(resolution: Pick<
  ConfigResolution,
  "native"
>): { value?: unknown } | undefined {
  return resolution.native.effective ?? resolution.native.declared;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // JSON value equality — key order never matters.
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface ReconciliationInput {
  /** The setting exists in the owner's contribution and is addressable at
   * this scope (§7.1 unsupported). */
  settingSupported: boolean;
  /** The owner mount is available enough to reconcile this subject. */
  ownerAvailable: boolean;
  /** Degradation on this subject (blocked reason names which). */
  ownerDegraded?: string | null;
  /** An owner-side stage in flight (stage_state prepared/previewed) or an
   * open plan for this setting. */
  stageInFlight: boolean;
  desired: DesiredState | null;
  nativeEffective: { value?: unknown } | undefined;
  nativeDeclared: { value?: unknown } | undefined;
}

export function deriveReconciliation(input: ReconciliationInput): {
  status: ReconciliationStatus;
  reason: string | null;
} {
  if (!input.settingSupported) {
    return { status: "unsupported", reason: "the setting is not addressable here (absent from the owner's contribution, or outside its allowed scopes)" };
  }
  if (!input.ownerAvailable) {
    return { status: "blocked", reason: "the owner is unavailable on this subject" };
  }
  if (input.ownerDegraded) {
    return { status: "blocked", reason: `the owner is degraded: ${input.ownerDegraded}` };
  }
  if (input.stageInFlight) {
    return { status: "pending", reason: "an owner-side stage or open plan is in flight" };
  }
  if (input.desired == null) {
    return { status: "satisfied", reason: null };
  }
  const compared = input.nativeEffective ?? input.nativeDeclared;
  if (compared === undefined || compared.value === undefined) {
    return { status: "unknown", reason: "no native axes were disclosed for this setting — never guessed" };
  }
  if (valuesEqual(input.desired.value, compared.value)) {
    return { status: "satisfied", reason: null };
  }
  return { status: "drifted", reason: "desired differs from the owner's native effective" };
}

/**
 * The ChangeSet overall status is derived from the per-operation statuses,
 * never asserted (§8):
 *   planned            no operation has passed validation
 *   validated          all operations validated, none applied
 *   applied            all operations applied, verification not yet taken
 *   verified           all applied and the re-read reconciles satisfied
 *   partially_applied  at least one applied/verified AND at least one failed
 *   failed             all operations failed (or the last remaining op failed)
 */
export function deriveChangeSetStatus(
  ops: { status: string }[],
  verified: boolean,
): ChangeSetStatus {
  if (ops.length === 0) return "planned";
  const passedValidation = ops.filter((op) => op.status !== "planned");
  if (passedValidation.length === 0) return "planned";
  const failed = ops.filter((op) => op.status === "failed");
  const appliedOrVerified = ops.filter((op) => op.status === "applied" || op.status === "verified");
  if (failed.length > 0 && appliedOrVerified.length > 0) return "partially_applied";
  if (failed.length === ops.length) return "failed";
  if (appliedOrVerified.length === ops.length) return verified ? "verified" : "applied";
  if (failed.length > 0) return "failed";
  return "validated";
}
