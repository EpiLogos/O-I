/**
 * The fixture-backed Configuration-plane source (dev/story/walk builds
 * only — never a production data path).
 *
 * Documents come from the frozen conformance fixtures
 * (`suite/configuration/cases/` — the same bytes every lane consumes). On
 * top of them sits a small, clearly-labelled SIMULATED WORLD that gives
 * the UI live state to render: native readings, desired state, owner
 * degradations, plan/apply/receipt lifecycles, and two honest-world
 * proofs — an unavailable owner (the `contribution-unavailable` fixture)
 * and an empty registry. Nothing here is product semantics: it exists so
 * the generic projection can be exercised against the frozen vocabulary
 * (#299 §21) before the live KernelOp binding lands at convergence.
 *
 * Simulation facts (all inspectable in this one file):
 *  - native axes per setting, including one owner-side stage in flight
 *    (`ai-kit:resolution:skill-set`, prepared) and one undisclosed subject
 *    (`ai-kit:session:provider-instance` — no axes, so `unknown`);
 *  - one subject-level degradation (`ai-kit:providers` — its secret
 *    resolution renders `blocked`);
 *  - `oi` owner apply fails with `owner_unavailable` (retryable), mirroring
 *    the `changeset-partial-apply` fixture, so partial ChangeSets render
 *    truthfully;
 *  - the active profile is the `profile-development` fixture; a second,
 *    simulated `staging` profile carries an entry for a setting no owner
 *    contributes (`workcell:placement:placement.policy` — the contract's
 *    own §3 example) so the `unsupported` path is first-class;
 *  - `simulateExternalNativeEdit` models an edit made through a native
 *    product CLI (§10): the next reread shows it; O:I never rewrote it.
 */

import type {
  ChangeSetDocument,
  ChangeSetOperation,
  ConfigErrorDocument,
  ConfigResolution,
  ContributionDocument,
  DesiredState,
  PlanDocument,
  ProfileDocument,
  ReceiptDocument,
  ScopeAddress,
  ScopeKind,
  SettingSpec,
  ValueSchema,
} from "./contracts";
import { SINGULAR_SCOPE_KINDS, compactScope } from "./contracts";
import { deriveReconciliation } from "./reconciliation";
import type {
  ChangeRequest,
  ConfigPlaneSource,
  ContributionMount,
  PlanBundle,
  ProfileUsePlan,
} from "./source";
import type {MountComposition, RegistryComposition} from "./composition";

// ---------------------------------------------------------------------------
// fixture documents (lazy: dev/walk chunks only)

interface FixtureProfile { fixture: string; kind: string; profile: ProfileDocument }

// Fully literal paths: Vite must see each dynamic import statically to
// bundle the fixture bytes into this dev/walk-only chunk.
async function loadFixtures(): Promise<{
  contributions: ContributionDocument[];
  development: ProfileDocument;
}> {
  const [aiKit, oi, connector, workcell, profile] = await Promise.all([
    import("../../../../suite/configuration/cases/contribution-ai-kit.json") as Promise<{ contribution: ContributionDocument }>,
    import("../../../../suite/configuration/cases/contribution-oi.json") as Promise<{ contribution: ContributionDocument }>,
    import("../../../../suite/configuration/cases/contribution-connector-fixture.json") as Promise<{ contribution: ContributionDocument }>,
    import("../../../../suite/configuration/cases/contribution-workcell.json") as Promise<{ contribution: ContributionDocument }>,
    import("../../../../suite/configuration/cases/profile-development.json") as Promise<FixtureProfile>,
  ]);
  // Workcell contributes for real now (hosting, gateway, machine) — the
  // old `contribution-unavailable` example left the default world; the
  // console below can still simulate an owner going unavailable, which is
  // where the honest-absence rendering is proven on demand.
  return {
    contributions: [aiKit.contribution, oi.contribution, connector.contribution, workcell.contribution],
    development: profile.profile,
  };
}

// ---------------------------------------------------------------------------
// the simulated world

/** Native axes per setting — the owner's own v2 facts, passed through
 * unmodified (§7: O:I never recomputes them). Absent key = the owner
 * disclosed no axes for the setting → `unknown`. */
interface SimulatedNative {
  declared?: unknown;
  effective?: unknown;
  active?: unknown;
  staged?: { value: unknown; stage_state: string; stage_ref: string } | null;
  secret_reference?: { ref: string; present: boolean };
}

let nativeState: Record<string, SimulatedNative> = {
  "ai-kit:resolution:model.default": { declared: "sonnet-current", effective: "sonnet-current", active: "sonnet-current" },
  // An owner-side stage in flight → reconciliation `pending` (§7.1).
  "ai-kit:resolution:skill-set": { declared: "default", effective: "default", staged: { value: "central-skills", stage_state: "prepared", stage_ref: "aikit-stage-1" } },
  "ai-kit:session:session.provider": { declared: "herdr", effective: "herdr", active: "herdr" },
  // Deliberately undisclosed → `unknown`, never guessed.
  "ai-kit:session:provider-instance": {},
  "ai-kit:sources:pins": {
    declared: [{ name: "central-skills", url: "~/Central/Control/user/skills", revision: "main" }],
    effective: [{ name: "central-skills", url: "~/Central/Control/user/skills", revision: "main" }],
  },
  // §14: the owner discloses presence + reference only. The material never
  // crosses this plane.
  "ai-kit:providers:credentials.anthropic": { secret_reference: { ref: "aikit:credentials:anthropic-key", present: true } },
  "oi:composition:ground-binding": { declared: "~/Central", effective: "~/Central" },
  "oi:composition:managed-root": { declared: "~/.oi/managed", effective: "~/.oi/managed" },
  "oi:verify:verify.before-run": { declared: true, effective: true, active: true },
  "connector/factory-actuation:authority:authority.mode": { declared: "delegated", effective: "delegated" },
  // Workcell: hosting, gateway, machine — present and satisfied, so the
  // group renders as the quiet, ordinary settings area it should be.
  "workcell:hosting:hosted-vm.profile": { declared: "hosted-vm", effective: "hosted-vm" },
  "workcell:hosting:hosted-vm.endpoint": { declared: "https://placement.omarchy.local:8443", effective: "https://placement.omarchy.local:8443" },
  "workcell:hosting:lifecycle.server": { declared: "http://127.0.0.1:8150", effective: "http://127.0.0.1:8150" },
  "workcell:gateway:gateway.address": { declared: "bolt://oi-omarchy:7687", effective: "bolt://oi-omarchy:7687" },
  "workcell:gateway:gateway.token": { secret_reference: { ref: "workcell:credentials:gateway-token", present: true } },
  "workcell:gateway:gateway.autoconnect": { declared: true, effective: true, active: true },
  "workcell:machine:machine.name": { declared: "workcell-local", effective: "workcell-local" },
  "workcell:machine:machine.role": { declared: "acceptance", effective: "acceptance" },
  "workcell:machine:workcell-home": { declared: "~/.workcell", effective: "~/.workcell" },
  "workcell:machine:sandbox.provider": { declared: "host-process", effective: "host-process" },
};

/** Subject-level degradations (07 §4.7 vocabulary): an owner can be
 * available and still degraded on one subject → `blocked`. */
let subjectDegradations: { subject_ref: string; state: string; reason: string }[] = [
  { subject_ref: "ai-kit:providers", state: "degraded", reason: "provider anthropic unreachable" },
];

/** The O:I desired store — sparse, exactly like a profile (§12). Seeded
 * from the active profile; `applyProfileUse` and held edits mutate it. */
let desiredStore: Map<string, DesiredState & { setting_ref: string; scope: ScopeAddress }>;

function desiredKey(setting_ref: string, scope: ScopeAddress): string {
  return `${setting_ref}|${compactScope(scope)}`;
}

function seedDesiredFromProfile(profile: ProfileDocument): void {
  desiredStore = new Map();
  for (const entry of profile.desired) {
    desiredStore.set(desiredKey(entry.setting_ref, entry.scope), {
      setting_ref: entry.setting_ref,
      scope: entry.scope,
      value: entry.value,
      secret_reference: entry.secret_reference ?? null,
      source_ref: `profile:${profile.profile_ref}`,
      set_at_unix_ms: 0,
    });
  }
}

/** Scope-ref examples in the simulated world (the scope-cases fixture's
 * own instances) — prefill hints for the UI, never law. */
const SCOPE_REF_HINTS: Partial<Record<ScopeKind, string>> = {
  project: "epilogos/o-i",
  "session-space": "space-7",
  "connector-relation": "factory-actuation",
};

// ---------------------------------------------------------------------------
// registry helpers

interface World {
  mounts: ContributionMount[];
  profiles: Map<string, ProfileDocument>;
  activeProfile: string | null;
  registryMode: "full" | "empty";
  /** Simulated owner outage, so the honest-absence rendering is provable
   * on demand without a second unavailable fixture owner. */
  workcellAvailable: boolean;
  changesetCounter: number;
  planCounter: number;
  receiptCounter: number;
  /** Receipts of this session's applies, keyed by changeset (§9). */
  receipts: ReceiptDocument[];
}

let world: World | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function pseudoDigest(seed: string): string {
  // A fixture-grade stand-in for the canonical plan digest (§6): stable
  // within a session, clearly not a real sha256.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fixture${hash.toString(16).padStart(8, "0")}`;
}

function findSetting(mounts: ContributionMount[], setting_ref: string): SettingSpec | null {
  for (const mount of mounts) {
    for (const section of mount.document?.sections ?? []) {
      const setting = section.settings.find((row) => row.setting_ref === setting_ref);
      if (setting) return setting;
    }
  }
  return null;
}

function ownerOf(mounts: ContributionMount[], setting_ref: string): ContributionMount | null {
  const owner_ref = setting_ref.split(":")[0];
  return mounts.find((mount) => mount.owner_ref === owner_ref) ?? null;
}

/** The frozen scope rules (§5), as `scope-cases.json` pins them. */
const KNOWN_SCOPE_KINDS: ReadonlySet<string> = new Set([
  "world", "ground", "project", "machine", "workcell", "agency", "agent",
  "session-space", "agent-session", "provider", "connector-relation", "invocation",
]);

function scopeAllowed(setting: SettingSpec, scope: ScopeAddress): boolean {
  if (!KNOWN_SCOPE_KINDS.has(scope.scope_kind)) return false;
  if (!SINGULAR_SCOPE_KINDS.has(scope.scope_kind) && !scope.scope_ref) return false;
  return setting.allowed_scopes.some((allowed) => {
    if (allowed.scope_kind !== scope.scope_kind) return false;
    if (allowed.scope_ref == null) return true;
    return allowed.scope_ref === scope.scope_ref;
  });
}

/** Value-schema hint validation (§2.3). The owner's native validation
 * stays authoritative; this catches what the schema already knows. */
function validateValue(schema: ValueSchema, request: ChangeRequest): ConfigErrorDocument | null {
  const fail = (message: string): ConfigErrorDocument => ({
    schema: "oi.config-error/v1",
    error_code: "invalid_value",
    message,
    setting_ref: request.setting_ref,
    retryable: false,
  });
  if (schema.type === "secret") {
    // §14: the JSON key `value` MUST be absent for secret-kind settings in
    // every O:I-owned document.
    if ("value" in request && request.value !== undefined) {
      return fail("a secret-kind setting carries a secret_reference, never a value (redaction law §14)");
    }
    if (!request.secret_reference?.ref) return fail("set a secret reference — the material is mutated owner-natively");
    return null;
  }
  if (request.value === undefined || request.value === null) return fail("a value is required");
  switch (schema.type) {
    case "boolean":
      return typeof request.value === "boolean" ? null : fail("expected a boolean");
    case "number":
    case "integer": {
      if (typeof request.value !== "number" || !Number.isFinite(request.value)) return fail("expected a number");
      if (schema.type === "integer" && !Number.isInteger(request.value)) return fail("expected an integer");
      if (schema.minimum !== undefined && request.value < schema.minimum) return fail(`below the disclosed minimum ${schema.minimum}`);
      if (schema.maximum !== undefined && request.value > schema.maximum) return fail(`above the disclosed maximum ${schema.maximum}`);
      return null;
    }
    case "enum":
      return schema.options.some((option) => option.value === request.value)
        ? null
        : fail(`"${String(request.value)}" is not one of the disclosed options`);
    case "scalar":
    case "path":
      return typeof request.value === "string" && request.value.length > 0 ? null : fail("expected a non-empty string");
    case "reference":
      return typeof request.value === "string" && request.value.length > 0 ? null : fail("expected a reference string in the owner's namespace");
    case "table": {
      if (!Array.isArray(request.value)) return fail("expected a table (array of rows)");
      for (const row of request.value) {
        if (typeof row !== "object" || row === null || Array.isArray(row)) return fail("table rows must be objects");
        for (const column of schema.columns) {
          if (!(column.name in (row as Record<string, unknown>))) return fail(`table rows need a "${column.name}" cell`);
        }
      }
      return null;
    }
    case "list":
      return Array.isArray(request.value) ? null : fail("expected a list");
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// the simulated world's composition (lock §5)

/** The simulated world stands in an explicit selection: Central, AIKit
 * and Workcell present (the doorway connector is unpositioned by nature).
 * Facts a real reading would carry; clearly labelled as simulation beside
 * the data. */
const SIMULATED_COMPOSITION: RegistryComposition = {
  requested_mode: "0/1/2",
  install_mode: null,
  install_mode_basis: "explicit selection",
  present_positions: [0, 2, 4],
  warnings: [],
  error: null,
};

/** The product position of each simulated owner. `oi` and the connector
 * are unpositioned (the doorway and its connector hold no position);
 * Workcell is absent from the simulated selection. */
function simulatedMountComposition(owner_ref: string): MountComposition {
  const POSITIONS: Record<string, number> = {
    central: 0, actuation: 1, "ai-kit": 2,
    "software-factory": 3, workcell: 4, "quaternal-logic": 5,
  };
  const position = POSITIONS[owner_ref];
  if (position === undefined) return { standing: "unpositioned", position: null };
  return {
    standing: SIMULATED_COMPOSITION.present_positions.includes(position as 0|1|2|3|4|5) ? "in_composition" : "absent",
    position,
  };
}

// ---------------------------------------------------------------------------
// source creation

export function createFixtureConfigPlaneSource(): ConfigPlaneSource {
  const init = async (): Promise<World> => {
    if (world) return world;
    const { contributions, development } = await loadFixtures();
    const mounts: ContributionMount[] = contributions.map((document) => ({
      owner_ref: document.owner.owner_ref,
      document: clone(document),
      availability: { ...document.availability },
      error: null,
      composition: simulatedMountComposition(document.owner.owner_ref),
    }));
    // The simulated degradation is injected into the owner's own
    // degradations list so the mount renders it from the contract's
    // vocabulary, not from a desktop invention.
    const aiKit = mounts.find((mount) => mount.owner_ref === "ai-kit");
    if (aiKit?.document) aiKit.document.degradations = [...(aiKit.document.degradations ?? []), ...clone(subjectDegradations)];
    const staging: ProfileDocument = {
      schema: "oi.profile/v1",
      profile_ref: "staging",
      title: "Staging world (simulated)",
      description: "Simulated second profile: carries an entry for a setting no owner currently contributes (workcell contributes through C3E), so the unsupported path stays first-class.",
      created_at_unix_ms: 0,
      revised_at_unix_ms: 0,
      native_profiles: [{ owner_ref: "workcell", native_profile_ref: "placement-default" }],
      desired: [
        { setting_ref: "oi:verify:verify.before-run", scope: { scope_kind: "world", scope_ref: null }, value: false, secret_reference: null },
        { setting_ref: "ai-kit:resolution:model.default", scope: { scope_kind: "project", scope_ref: "epilogos/o-i" }, value: "opus", secret_reference: null },
        { setting_ref: "workcell:placement:placement.policy", scope: { scope_kind: "world", scope_ref: null }, value: "balanced", secret_reference: null },
      ],
      provenance: { authored_by: "agent", notes_ref: null, imported_from_ref: null },
    };
    world = {
      mounts,
      profiles: new Map([[development.profile_ref, clone(development)], [staging.profile_ref, staging]]),
      activeProfile: development.profile_ref,
      registryMode: "full",
      workcellAvailable: true,
      changesetCounter: 0,
      planCounter: 0,
      receiptCounter: 0,
      receipts: [],
    };
    seedDesiredFromProfile(development);
    return world;
  };

  const resolutionFor = (mounts: ContributionMount[], setting_ref: string, scope: ScopeAddress): ConfigResolution => {
    const setting = findSetting(mounts, setting_ref);
    const owner = ownerOf(mounts, setting_ref);
    const native = nativeState[setting_ref];
    const desired = desiredStore.get(desiredKey(setting_ref, scope)) ?? null;
    const supported = setting != null && scopeAllowed(setting, scope);
    const ownerAvailable = owner != null && owner.availability.state === "available" && owner.document?.operations.plan.availability === "disclosed";
    const degraded = subjectDegradations.find((row) => setting_ref.startsWith(row.subject_ref));
    const stageInFlight = native?.staged != null && (native.staged.stage_state === "prepared" || native.staged.stage_state === "previewed");
    // §14: secret-kind values compare as references — the material is
    // never here, so presence + ref is the whole fact on both axes.
    const secret = setting?.value_schema.type === "secret";
    const desiredForCompare = desired
      ? { value: secret ? desired.secret_reference?.ref : desired.value, secret_reference: desired.secret_reference ?? null, source_ref: desired.source_ref ?? null, set_at_unix_ms: desired.set_at_unix_ms }
      : null;
    const reconciliation = deriveReconciliation({
      settingSupported: supported,
      ownerAvailable: ownerAvailable === true,
      ownerDegraded: degraded?.reason ?? null,
      stageInFlight,
      desired: desiredForCompare,
      nativeEffective: native?.effective !== undefined ? { value: native.effective } : secret && native?.secret_reference ? { value: native.secret_reference.ref } : undefined,
      nativeDeclared: native?.declared !== undefined ? { value: native.declared } : secret && native?.secret_reference ? { value: native.secret_reference.ref } : undefined,
    });
    return {
      schema: "oi.config-resolution/v1",
      setting_ref,
      scope,
      desired: desired ? { value: desired.value, secret_reference: desired.secret_reference ?? null, source_ref: desired.source_ref ?? null, set_at_unix_ms: desired.set_at_unix_ms } : null,
      native: {
        declared: native?.declared !== undefined ? { value: native.declared, provenance: { owner_ref: owner?.owner_ref ?? setting_ref.split(":")[0], path: "declared", observed_at_unix_ms: 0 } } : secret && native?.secret_reference ? { value: native.secret_reference.ref, provenance: { owner_ref: owner?.owner_ref ?? "", path: "credential presence", observed_at_unix_ms: 0 } } : undefined,
        effective: native?.effective !== undefined ? { value: native.effective, provenance: { owner_ref: owner?.owner_ref ?? setting_ref.split(":")[0], path: "resolution", observed_at_unix_ms: 0 } } : secret && native?.secret_reference ? { value: native.secret_reference.ref, provenance: { owner_ref: owner?.owner_ref ?? "", path: "credential presence", observed_at_unix_ms: 0 } } : undefined,
        active: native?.active !== undefined ? { value: native.active, provenance: { owner_ref: owner?.owner_ref ?? setting_ref.split(":")[0], path: "session", observed_at_unix_ms: 0 } } : undefined,
        staged: native?.staged ? { value: native.staged.value, stage_state: native.staged.stage_state, stage_ref: native.staged.stage_ref } : null,
      },
      native_reading: { reading_digest: native ? pseudoDigest(setting_ref + JSON.stringify(native)) : null, observed_at_unix_ms: Date.now() },
      reconciliation,
    };
  };

  return {
    kind: "fixture",
    label: "fixture world (suite/configuration/cases + simulated state)",

    scopeRefHint(kind: ScopeKind): string | null {
      return SCOPE_REF_HINTS[kind] ?? null;
    },

    async receipts(changeset_id: string) {
      const current = await init();
      return current.receipts.filter((receipt) => receipt.changeset_id === changeset_id);
    },

    async readRegistry() {
      const current = await init();
      if (current.registryMode === "empty") {
        return { mounts: [], observed_at_unix_ms: Date.now(), composition: clone(SIMULATED_COMPOSITION) };
      }
      const mounts = clone(current.mounts);
      if (!current.workcellAvailable) {
        const workcell = mounts.find((mount) => mount.owner_ref === "workcell");
        if (workcell) workcell.availability = { state: "unavailable", reason: "simulated for development — the deployed build does not answer" };
      }
      return { mounts, observed_at_unix_ms: Date.now(), composition: clone(SIMULATED_COMPOSITION) };
    },

    async readResolutions(pairs) {
      const current = await init();
      return pairs.map((pair) => resolutionFor(current.mounts, pair.setting_ref, pair.scope));
    },

    async holdDesired(request) {
      const current = await init();
      const setting = findSetting(current.mounts, request.setting_ref);
      if (!setting) {
        throw new Error(`unsupported_setting: ${request.setting_ref} is absent from every mounted contribution`);
      }
      if (!scopeAllowed(setting, request.scope)) {
        throw new Error(`unsupported_scope: ${compactScope(request.scope)} is not an allowed scope for ${request.setting_ref}`);
      }
      desiredStore.set(desiredKey(request.setting_ref, request.scope), {
        setting_ref: request.setting_ref,
        scope: request.scope,
        value: request.value,
        secret_reference: request.secret_reference ?? null,
        source_ref: "system:configuration-view",
        set_at_unix_ms: Date.now(),
      });
    },

    async discardDesired(setting_ref, scope) {
      await init();
      desiredStore.delete(desiredKey(setting_ref, scope));
    },

    async plan(requests): Promise<PlanBundle> {
      const current = await init();
      const plans: PlanDocument[] = [];
      const errors: ConfigErrorDocument[] = [];
      for (const request of requests) {
        const setting = findSetting(current.mounts, request.setting_ref);
        if (!setting) {
          errors.push({ schema: "oi.config-error/v1", error_code: "unsupported_setting", message: "absent from every mounted contribution", setting_ref: request.setting_ref, retryable: false });
          continue;
        }
        if (!scopeAllowed(setting, request.scope)) {
          errors.push({ schema: "oi.config-error/v1", error_code: "unsupported_scope", message: `${compactScope(request.scope)} is not among the setting's allowed scopes`, setting_ref: request.setting_ref, scope_kind: request.scope.scope_kind, retryable: false });
          continue;
        }
        const violation = validateValue(setting.value_schema, request);
        if (violation) {
          errors.push(violation);
          continue;
        }
        const owner = ownerOf(current.mounts, request.setting_ref);
        if (owner?.document && owner.document.operations.plan.availability !== "disclosed") {
          errors.push({ schema: "oi.config-error/v1", error_code: "owner_unavailable", message: owner.document.operations.plan.reason ?? "the owner has not disclosed plan", setting_ref: request.setting_ref, retryable: false });
          continue;
        }
        current.planCounter += 1;
        plans.push({
          schema: "oi.config-plan/v1",
          plan_id: `plan-fixture-${current.planCounter}`,
          plan_digest: pseudoDigest(`${request.setting_ref}|${compactScope(request.scope)}|${JSON.stringify(request.value ?? request.secret_reference)}`),
          setting_ref: request.setting_ref,
          scope: request.scope,
          changes: [{
            summary: secretOrValue(setting, request),
            native_ref: setting.native_ref,
            before_ref: null,
            after_ref: setting.native_ref,
          }],
          expected_effect: clone(setting.effect),
          expires_at_unix_ms: Date.now() + 15 * 60 * 1000,
          explain_ref: setting.effect.ref,
          authority: { requires: ["operator"], granted_by: "fixture world" },
        });
      }
      return { plans, errors };
    },

    async apply(plans): Promise<ChangeSetDocument> {
      const current = await init();
      current.changesetCounter += 1;
      const changeset_id = `cs-fixture-${current.changesetCounter}`;
      const requested = plans.map((plan) => {
        const setting = findSetting(current.mounts, plan.setting_ref);
        const secret = setting?.value_schema.type === "secret";
        const desired = desiredStore.get(desiredKey(plan.setting_ref, plan.scope));
        return {
          setting_ref: plan.setting_ref,
          scope: plan.scope,
          value: secret ? undefined : desired?.value,
          secret_reference: secret ? desired?.secret_reference ?? null : null,
        };
      });
      const operations: ChangeSetOperation[] = plans.map((plan, index) => {
        const ownerRef = plan.setting_ref.split(":")[0];
        // §8 truthfulness: the `oi` composition owner's apply fails here,
        // mirroring the changeset-partial-apply fixture — no fake rollback,
        // no faked success.
        const fails = ownerRef === "oi";
        return {
          op_id: `op-${index + 1}`,
          depends_on: [],
          owner_ref: ownerRef,
          setting_ref: plan.setting_ref,
          scope: plan.scope,
          kind: "apply",
          plan_digest: plan.plan_digest,
          status: fails ? "failed" : "verified",
          receipt_ref: fails ? `receipt-fixture-err-${current.receiptCounter + 1}` : `receipt-fixture-${current.receiptCounter + 1}`,
          error: fails ? { code: "owner_unavailable", message: "the composition layer could not publish the setting (fixture partial-apply case)", retryable: true } : null,
        };
      });
      const receipts: ReceiptDocument[] = [];
      for (const operation of operations) {
        current.receiptCounter += 1;
        const setting = findSetting(current.mounts, operation.setting_ref);
        if (operation.status !== "failed") {
          // The owner actually performed the change: the native axes move.
          const secret = setting?.value_schema.type === "secret";
          const desired = desiredStore.get(desiredKey(operation.setting_ref, operation.scope));
          const value = secret ? undefined : desired?.value;
          nativeState[operation.setting_ref] = secret
            ? { secret_reference: { ref: desired?.secret_reference?.ref ?? "", present: true } }
            : { declared: value, effective: value, active: value };
        }
        receipts.push({
          schema: "oi.config-receipt/v1",
          receipt_id: operation.receipt_ref ?? `receipt-fixture-${current.receiptCounter}`,
          owner_ref: operation.owner_ref,
          changeset_id,
          plan_digest: operation.plan_digest,
          setting_ref: operation.setting_ref,
          scope: operation.scope,
          operation: "apply",
          outcome: operation.status === "failed" ? "failed" : "applied",
          applied_at_unix_ms: Date.now(),
          native_ref: setting?.native_ref ?? null,
          expected_effect: clone(setting?.effect ?? { kind: "unknown", summary: null, ref: null }),
          original_receipt_id: null,
          error: operation.error ? { schema: "oi.config-error/v1", error_code: "owner_unavailable", message: operation.error.message, setting_ref: operation.setting_ref, retryable: true } : null,
        });
      }
      current.receipts = receipts;
      // Re-read verification (§9): a fresh pass over the changed settings.
      const reconciliations = operations.map((operation) => ({
        setting_ref: operation.setting_ref,
        status: resolutionFor(current.mounts, operation.setting_ref, operation.scope).reconciliation.status,
      }));
      const anyVerified = operations.some((operation) => operation.status === "verified" || operation.status === "applied");
      const anyFailed = operations.some((operation) => operation.status === "failed");
      const status = anyVerified && anyFailed ? "partially_applied" : anyFailed ? "failed" : "verified";
      return {
        schema: "oi.config-changeset/v1",
        changeset_id,
        created_at_unix_ms: Date.now(),
        profile_ref: current.activeProfile,
        requested,
        operations,
        verification: { reading_digest: pseudoDigest(JSON.stringify(operations)), observed_at_unix_ms: Date.now(), reconciliations },
        status,
      };
    },

    async listProfiles() {
      const current = await init();
      return { active_profile_ref: current.activeProfile, profiles: [...current.profiles.values()].map(clone) };
    },

    async profileUsePlan(profile_ref): Promise<ProfileUsePlan> {
      const current = await init();
      const profile = current.profiles.get(profile_ref);
      if (!profile) throw new Error(`unknown profile: ${profile_ref}`);
      return {
        profile_ref,
        entries: profile.desired.map((entry) => {
          const setting = findSetting(current.mounts, entry.setting_ref);
          const currentDesired = desiredStore.get(desiredKey(entry.setting_ref, entry.scope));
          return {
            setting_ref: entry.setting_ref,
            scope: entry.scope,
            setting,
            target: { value: entry.value, secret_reference: entry.secret_reference ?? null },
            current: currentDesired ? { value: currentDesired.value, secret_reference: currentDesired.secret_reference ?? null } : null,
          };
        }),
        native_profiles: clone(profile.native_profiles),
      };
    },

    async applyProfileUse(profile_ref) {
      const current = await init();
      const profile = current.profiles.get(profile_ref);
      if (!profile) throw new Error(`unknown profile: ${profile_ref}`);
      current.activeProfile = profile_ref;
      seedDesiredFromProfile(profile);
      // Switching passes native-profile REFERENCES to the owner (§13);
      // the owner resolves them natively. The ChangeSet records the
      // switch truthfully; entries the owner already satisfies reconcile
      // satisfied on this reread.
      const operations: ChangeSetOperation[] = profile.native_profiles.map((native, index) => ({
        op_id: `op-${index + 1}`,
        depends_on: [],
        owner_ref: native.owner_ref,
        setting_ref: "",
        scope: { scope_kind: "world", scope_ref: null },
        kind: "apply",
        plan_digest: pseudoDigest(`${profile_ref}|${native.owner_ref}|${native.native_profile_ref}`),
        status: "verified",
        receipt_ref: `receipt-fixture-use-${index + 1}`,
        error: null,
      }));
      return {
        schema: "oi.config-changeset/v1",
        changeset_id: `cs-fixture-use-${(current.changesetCounter += 1)}`,
        created_at_unix_ms: Date.now(),
        profile_ref,
        requested: clone(profile.desired).map((entry) => ({ setting_ref: entry.setting_ref, scope: entry.scope, value: entry.value, secret_reference: entry.secret_reference ?? null })),
        operations,
        verification: {
          reading_digest: pseudoDigest(profile_ref),
          observed_at_unix_ms: Date.now(),
          reconciliations: profile.desired
            .filter((entry) => findSetting(current.mounts, entry.setting_ref))
            .map((entry) => ({ setting_ref: entry.setting_ref, status: resolutionFor(current.mounts, entry.setting_ref, entry.scope).reconciliation.status })),
        },
        status: "verified",
      };
    },

    async saveProfile(profile) {
      const current = await init();
      current.profiles.set(profile.profile_ref, clone(profile));
    },

    async createProfile(profile_ref, title) {
      const current = await init();
      if (current.profiles.has(profile_ref)) throw new Error(`profile already exists: ${profile_ref}`);
      const profile: ProfileDocument = {
        schema: "oi.profile/v1",
        profile_ref,
        title: title ?? profile_ref,
        description: null,
        created_at_unix_ms: 0,
        revised_at_unix_ms: 0,
        native_profiles: [],
        desired: [],
        provenance: { authored_by: "human", notes_ref: null, imported_from_ref: null },
      };
      current.profiles.set(profile_ref, profile);
      return clone(profile);
    },
  };
}

function secretOrValue(setting: SettingSpec, request: ChangeRequest): string {
  if (setting.value_schema.type === "secret") {
    return `point ${setting.native_ref} at ${request.secret_reference?.ref ?? "(reference)"}`;
  }
  return `set ${setting.native_ref} to ${JSON.stringify(request.value)}`;
}

// ---------------------------------------------------------------------------
// dev-only simulation surface (walk + fixture console)

/** Simulate an edit made through a native product CLI (§10): the owner's
 * axes move; O:I's desired state does not. The next reread shows the new
 * relation explicitly. */
export async function simulateExternalNativeEdit(source: ConfigPlaneSource, setting_ref: string, value: unknown): Promise<void> {
  if (source.kind !== "fixture") throw new Error("external-edit simulation is a fixture-world capability");
  nativeState[setting_ref] = { ...(nativeState[setting_ref] ?? {}), declared: value, effective: value, active: value };
}

/** Toggle the registry between the full fixture set and the honest empty
 * World (bootstrap relation: an empty World is the same system, §11). */
export function setRegistryMode(mode: "full" | "empty"): void {
  if (world) world.registryMode = mode;
}

/** Simulate one owner's outage (or its restoration): the mount reads
 * unavailable, its controls go disclosure-only, and the reread shows the
 * honest absence. Development proof of the degraded rendering. */
export function setOwnerAvailability(owner_ref: string, state: "available" | "unavailable"): void {
  if (world && owner_ref === "workcell") world.workcellAvailable = state === "available";
}
