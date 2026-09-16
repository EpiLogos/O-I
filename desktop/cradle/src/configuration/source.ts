/**
 * The Configuration-plane data seam for the Desktop (#299 §11, C6 lane).
 *
 * The Desktop renders the frozen C0 contracts (docs/cradle/
 * 09-CONFIGURATION-PLANE.md) through THIS interface and nothing else: the
 * views are a generic projection, so a new product setting needs no new
 * React code. Two implementations exist:
 *
 *  - `fixtureSource.ts` — the fixture-backed store built from
 *    `suite/configuration/cases/` plus a small simulated world (clearly
 *    labelled on screen). It drives the UI in dev/story/walk builds
 *    (`__CRADLE_WALK__`), which is where the configuration walk scenario
 *    proves the §21 acceptance.
 *  - `liveSource.ts` — the LIVE binding: the typed configuration
 *    `KernelOp`s of `desktop/cradle/kernel/src/configuration.rs`, routed
 *    through the installed `oi` executable to the SAME engine the
 *    `oi config` / `oi profile` commands drive (the C1 kernel registry,
 *    the C2 profile store, the frozen four-verb transport, re-read
 *    verification, and the O:I-side persistence). Production builds bind
 *    it in `sourceHost.ts`; where no kernel transport is reachable the
 *    plane renders its honest absence through
 *    `createUnboundConfigPlaneSource` instead.
 *
 * THE RECOMMENDED LIVE BINDING — typed `KernelOp` variants on the existing
 * seam (`src/kernel/types.ts` + the Rust mirror in `desktop/cradle/kernel`),
 * following the same additive pattern every other owner read uses
 * (`WorkcellStatusRead`, `SystemCompositionRead`):
 *
 *   config_registry_read      → runs the Wave-5 one-call convention per
 *                               mount position: `<ns> config-contribution
 *                               --json` (bare document on stdout, §4);
 *                               mounts resolve through the same owner
 *                               registry `system_composition.rs` already
 *                               discovers. A failed/non-conforming read is
 *                               a named degradation on the mount, never an
 *                               invented contribution.
 *   config_resolutions_read   → `oi.config-resolution/v1` per
 *                               (setting_ref, scope): desired from the O:I
 *                               desired store (C2), native axes passed
 *                               through unmodified from the owner's
 *                               `system --json` v2 reading (§7: O:I never
 *                               recomputes them).
 *   config_desired_hold       → holds a desired entry (the C2 desired
 *                               store / active profile), or discards it.
 *   config_plan               → routes each request through the owner's
 *                               `<ns> config plan --json --setting …`
 *                               transport (§6); owner-minted
 *                               `oi.config-plan/v1` documents come back
 *                               verbatim; failures as `oi.config-error/v1`.
 *   config_apply              → applies the plans under one client-minted
 *                               ChangeSet (`cs-` + unique suffix, §8) via
 *                               `<ns> config apply --json`; per-operation
 *                               statuses and receipts recorded per op; then
 *                               re-read verification (§9).
 *   profile_list / profile_read / profile_use_plan / profile_use_apply
 *                             → `oi profile …` operations over
 *                               `oi.profile/v1` documents (§12); `use`
 *                               MUST surface the inspectable plan BEFORE any
 *                               state moves.
 *
 * The live source is created by `createLiveConfigPlaneSource(transport)`
 * in `liveSource.ts` and bound for production by `sourceHost.ts`.
 */

import type {
  ChangeSetDocument,
  ConfigErrorDocument,
  ConfigResolution,
  ContributionDocument,
  PlanDocument,
  ProfileDocument,
  ScopeAddress,
  ScopeKind,
  SettingSpec,
} from "./contracts";
import type {MountComposition, RegistryComposition} from "./composition";

// ---------------------------------------------------------------------------
// registry

/** One owner position of the configuration registry: the contribution
 * document itself is the registration content (§4) — there is no second
 * descriptor format. A mount that failed reads as a named degradation.
 * `composition` is the owner's standing against the effective composition
 * (CONTEXT-FRAME-COMPOSITION-LOCK §5) — a different axis from
 * availability, read from the current-world facts, never re-decided here. */
export interface ContributionMount {
  owner_ref: string;
  document: ContributionDocument | null;
  availability: { state: "available" | "degraded" | "unavailable" | "unknown"; reason: string | null };
  /** The transport-level failure, when the read itself failed (§4: a failed
   * or non-conforming read is a named degradation, never an invention). */
  error: string | null;
  /** The world fact (lock §5). Absent on readings from kernels that
   * predate the disclosure: the views then render the honest `unknown`. */
  composition?: MountComposition | null;
}

// ---------------------------------------------------------------------------
// requests

/** One desired change request as it crosses to plan/apply (the ChangeSet
 * `requested` entry shape, §8). A secret-kind setting carries
 * `secret_reference` and NEVER `value` (§14). */
export interface ChangeRequest {
  setting_ref: string;
  scope: ScopeAddress;
  value?: unknown;
  secret_reference?: { ref: string } | null;
}

/** What one plan round returns: owner-minted plans plus the structured
 * errors for the requests that could not be planned (§5: unsupported scope
 * is an explicit error, never a fallback). */
export interface PlanBundle {
  plans: PlanDocument[];
  errors: ConfigErrorDocument[];
}

/** The inspectable profile-use plan: what would move BEFORE anything
 * moves (§12: import/use is never a hidden apply). */
export interface ProfileUsePlan {
  profile_ref: string;
  /** Entries the target profile would hold, with what is currently held. */
  entries: {
    setting_ref: string;
    scope: ScopeAddress;
    setting: SettingSpec | null;
    target: { value?: unknown; secret_reference?: { ref: string } | null } | null;
    current: { value?: unknown; secret_reference?: { ref: string } | null } | null;
  }[];
  native_profiles: { owner_ref: string; native_profile_ref: string }[];
}

// ---------------------------------------------------------------------------

/** The one data seam the Configuration and Profiles views render. Every
 * method is async and may reject with a plain Error only for
 * transport-level failure; contract-level refusals come back as structured
 * documents (errors inside PlanBundle, statuses inside resolutions). */
export interface ConfigPlaneSource {
  /** "fixture" renders the labelled simulation; "live" is the kernel-bound
   * source; "unbound" reports the honest absence. */
  readonly kind: "fixture" | "live" | "unbound";
  /** Human-readable provenance line rendered beside the data (e.g. the
   * fixture registry name, or the kernel binding). */
  readonly label: string;

  /** The mounted owners beside the world composition they stand in
   * (lock §5): requested/effective mode, present positions, the reading's
   * own warnings — and, behind `composition.error`, the honest refusal to
   * invent standings. */
  readRegistry(): Promise<{ mounts: ContributionMount[]; observed_at_unix_ms: number; composition: RegistryComposition | null }>;

  /** One resolution per (setting_ref, scope). Absent from the returned
   * array = the caller did not ask for it; a resolution for an unsupported
   * pairing comes back WITH status unsupported/unknown, never omitted. */
  readResolutions(pairs: { setting_ref: string; scope: ScopeAddress }[]): Promise<ConfigResolution[]>;

  /** Hold (or replace) one desired entry in the O:I desired store. */
  holdDesired(request: ChangeRequest): Promise<void>;
  /** Remove one desired entry — an explicit operation, never implicit. */
  discardDesired(setting_ref: string, scope: ScopeAddress): Promise<void>;

  /** Owner-native planning (§6). Never mutates anything. */
  plan(requests: ChangeRequest[]): Promise<PlanBundle>;
  /** Apply the plans under one client-minted ChangeSet; the returned
   * document carries per-operation truth and re-read verification (§8, §9). */
  apply(plans: PlanDocument[]): Promise<ChangeSetDocument>;

  listProfiles(): Promise<{ active_profile_ref: string | null; profiles: ProfileDocument[] }>;
  profileUsePlan(profile_ref: string): Promise<ProfileUsePlan>;
  /** Make the profile active — only ever AFTER its use plan was rendered
   * and accepted (§12). */
  applyProfileUse(profile_ref: string): Promise<ChangeSetDocument | null>;

  /** Edit a profile's sparse overrides in place (§12: profiles are O:I
   * composition state; editing intent is not an owner apply). */
  saveProfile(profile: ProfileDocument): Promise<void>;
  createProfile(profile_ref: string, title?: string): Promise<ProfileDocument>;

  /** Prefill hint for a scope-kind's ref input in the current World (e.g.
   * the open project). Presentational only — never law; the live source
   * may omit it. */
  scopeRefHint?(kind: ScopeKind): string | null;

  /** The receipts of one ChangeSet (§9). Optional: the live binding
   * exposes owner receipt history; the fixture source keeps this
   * session's applies. */
  receipts?(changeset_id: string): Promise<import("./contracts").ReceiptDocument[]>;
}

/** The unbound source: what a production build renders until the
 * integrator's live binding lands. Everything reports honestly; nothing is
 * fabricated. */
export function createUnboundConfigPlaneSource(reason: string): ConfigPlaneSource {
  return {
    kind: "unbound",
    label: "not bound in this build",
    readRegistry: async () => ({ mounts: [], observed_at_unix_ms: 0, composition: null }),
    readResolutions: async () => [],
    holdDesired: async () => unbound(reason),
    discardDesired: async () => unbound(reason),
    plan: async () => unbound(reason),
    apply: async () => unbound(reason),
    listProfiles: async () => ({ active_profile_ref: null, profiles: [] }),
    profileUsePlan: async () => unbound(reason),
    applyProfileUse: async () => unbound(reason),
    saveProfile: async () => unbound(reason),
    createProfile: async () => unbound(reason),
  };
}

function unbound(reason: string): never {
  throw new Error(reason);
}
