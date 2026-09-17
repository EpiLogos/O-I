/**
 * The LIVE configuration-plane source (#299 C6 live leg): the production
 * `ConfigPlaneSource`, bound to the kernel's typed configuration
 * operations (`KernelOp::Config*` / `Profile*`, Rust `configuration.rs`).
 *
 * Every operation crosses as one typed `KernelOp` and rides the SAME
 * engine `oi config` / `oi profile` drive — the installed `oi` binary's
 * `KernelSurface` over the C1 owner registry, the C2 profile store, the
 * frozen four-verb owner transport, re-read verification and the
 * O:I-side persistence. Nothing here re-decides product semantics: the
 * shapes are the C0 contract documents themselves, and every refused or
 * degraded state arrives as named data (degraded mounts, per-request plan
 * errors, reconciliation statuses) and is handed to the generic
 * projection unchanged.
 *
 * The one piece of session state kept here is the binding from each
 * owner-minted plan (`plan_digest`) to the request that produced it, so
 * an apply carries the SAME requested values to the engine. That is not
 * a desired store — desired state lives only in the engine.
 */

import type {
  ChangeSetDocument,
  ConfigErrorDocument,
  ConfigResolution,
  PlanDocument,
  ProfileDocument,
  ScopeAddress,
  SettingSpec,
} from "./contracts";
import { compactScope } from "./contracts";
import type {
  ChangeRequest,
  ConfigPlaneSource,
  PlanBundle,
  ProfileUsePlan,
} from "./source";
import type {
  ConfigPairWire,
  ConfigRequestWire,
  KernelOp,
  KernelOpResult,
  KernelOutcome,
  ProfileEditOpWire,
  ProfileUsePlanWire,
} from "../kernel/types";

/** One kernel operation call: outcome or the transport-level refusal. */
export type OpCall = (op: KernelOp) => Promise<{ outcome: KernelOutcome | null; error?: string }>;

export function createLiveConfigPlaneSource(call: OpCall): ConfigPlaneSource {
  // plan_digest → the request that produced it (this session's plans).
  const plannedRequests = new Map<string, ChangeRequest>();
  let settings: Promise<Record<string, SettingSpec>> | null = null;

  function unwrap<T extends KernelOpResult>(sent: { outcome: KernelOutcome | null; error?: string }, expected: T["result"], what: string): T {
    if (sent.error || sent.outcome == null) {
      throw new Error(sent.error ?? `${what} could not be served by the kernel`);
    }
    const outcome = sent.outcome as KernelOutcome & { result?: string };
    if (outcome.result !== expected) {
      throw new Error(`${what} answered \`${outcome.result ?? "unknown"}\`, not \`${expected}\``);
    }
    return outcome as T;
  }

  const readRegistryImpl = async () => {
    const outcome = unwrap<any>(await call({ op: "config_registry_read" }), "config_registry_reading", "the configuration registry");
    return outcome.reading as { mounts: any[]; observed_at_unix_ms: number; composition?: any };
  };

  const loadSettings = (): Promise<Record<string, SettingSpec>> => {
    if (!settings) {
      settings = readRegistryImpl().then((registry) => {
        const index: Record<string, SettingSpec> = {};
        for (const mount of registry.mounts) {
          for (const section of mount.document?.sections ?? []) {
            for (const setting of section.settings) index[setting.setting_ref] = setting;
          }
        }
        return index;
      });
    }
    return settings;
  };

  const toWireRequest = (request: ChangeRequest): ConfigRequestWire => ({
    setting_ref: request.setting_ref,
    scope: { scope_kind: request.scope.scope_kind, scope_ref: request.scope.scope_ref },
    value: request.value,
    secret_reference: request.secret_reference ?? null,
  });

  return {
    kind: "live",
    label: "live — read and driven through the oi configuration engine",

    async readRegistry() {
      const registry = await readRegistryImpl();
      return {
        mounts: registry.mounts,
        observed_at_unix_ms: registry.observed_at_unix_ms,
        composition: registry.composition ?? null,
      };
    },

    async readResolutions(pairs: { setting_ref: string; scope: ScopeAddress }[]) {
      const wire: ConfigPairWire[] = pairs.map((pair) => ({
        setting_ref: pair.setting_ref,
        scope: { scope_kind: pair.scope.scope_kind, scope_ref: pair.scope.scope_ref },
      }));
      const outcome = unwrap<any>(await call({ op: "config_resolutions_read", pairs: wire }), "config_resolutions", "the resolution reading");
      return outcome.resolutions as ConfigResolution[];
    },

    async holdDesired(request: ChangeRequest) {
      unwrap(await call({ op: "config_desired_hold", request: toWireRequest(request) }), "config_desired_held", "holding desired");
    },

    async discardDesired(setting_ref: string, scope: ScopeAddress) {
      unwrap(
        await call({ op: "config_desired_discard", setting_ref, scope: { scope_kind: scope.scope_kind, scope_ref: scope.scope_ref } }),
        "config_desired_discarded",
        "discarding desired",
      );
    },

    async plan(requests: ChangeRequest[]): Promise<PlanBundle> {
      const outcome = unwrap<any>(
        await call({ op: "config_plan", requests: requests.map(toWireRequest) }),
        "config_planned",
        "planning",
      );
      const plans = outcome.plans as PlanDocument[];
      for (const plan of plans) {
        const request = requests.find(
          (candidate) => candidate.setting_ref === plan.setting_ref && compactScope(candidate.scope) === compactScope(plan.scope),
        );
        if (request && plan.plan_digest) plannedRequests.set(plan.plan_digest, request);
      }
      return { plans, errors: outcome.errors as ConfigErrorDocument[] };
    },

    async apply(plans: PlanDocument[]): Promise<ChangeSetDocument> {
      const requests: ChangeRequest[] = [];
      for (const plan of plans) {
        const request = plan.plan_digest ? plannedRequests.get(plan.plan_digest) : undefined;
        if (!request) {
          throw new Error(
            `no request is bound to plan ${plan.plan_id} (${plan.setting_ref}) in this session; plan the change again before applying`,
          );
        }
        requests.push(request);
      }
      if (requests.length === 0) throw new Error("an apply carries at least one planned change");
      const outcome = unwrap<any>(
        await call({ op: "config_apply", requests: requests.map(toWireRequest) }),
        "config_applied",
        "applying",
      );
      return outcome.changeset as ChangeSetDocument;
    },

    async listProfiles() {
      const outcome = unwrap<any>(await call({ op: "profile_list" }), "profile_listing", "the profile store");
      return { active_profile_ref: outcome.active_profile_ref, profiles: outcome.profiles as ProfileDocument[] };
    },

    async profileUsePlan(profile_ref: string): Promise<ProfileUsePlan> {
      const outcome = unwrap<any>(await call({ op: "profile_use_plan", profile_ref }), "profile_use_planning", "the profile use plan");
      const plan = outcome.plan as ProfileUsePlanWire;
      const index = await loadSettings();
      return {
        profile_ref: plan.profile_ref,
        entries: plan.entries.map((entry) => ({
          setting_ref: entry.setting_ref,
          scope: {
            scope_kind: entry.scope.scope_kind as ScopeAddress["scope_kind"],
            scope_ref: entry.scope.scope_ref ?? null,
          },
          setting: index[entry.setting_ref] ?? null,
          target: entry.target ?? null,
          current: entry.current ?? null,
        })),
        native_profiles: plan.native_profiles,
      };
    },

    async applyProfileUse(profile_ref: string) {
      // The engine's `use` records only the explicit active mark (09 §12):
      // no native state moved, so no ChangeSet exists to report.
      unwrap(await call({ op: "profile_use_apply", profile_ref }), "profile_used", "activating the profile");
      return null;
    },

    async saveProfile(profile: ProfileDocument) {
      // The engine's own edit verb (09 §12, additive): the stored document
      // is read first, the explicit operation set is derived from the
      // difference, and the engine judges every operation through its own
      // laws. Nothing is applied to any owner — an edit only rewrites the
      // sparse desired document in the profile store.
      const stored = unwrap<any>(
        await call({ op: "profile_read", profile_ref: profile.profile_ref }),
        "profile_reading",
        "the stored profile",
      ).profile as ProfileDocument;
      const operations = profileEditOps(stored, profile);
      if (operations.length === 0) return;
      unwrap(
        await call({ op: "profile_edit", profile_ref: profile.profile_ref, operations }),
        "profile_edited",
        "saving the profile",
      );
    },

    async createProfile(profile_ref: string, title?: string) {
      const outcome = unwrap<any>(
        await call(title ? { op: "profile_create", profile_ref, title } : { op: "profile_create", profile_ref }),
        "profile_created",
        "creating the profile",
      );
      return outcome.profile as ProfileDocument;
    },

    async receipts(changeset_id: string) {
      // The recorded receipt references (09 §9): a listing of recorded refs
      // only, filtered to the addressed changeset. A changeset with no
      // recorded receipts reads as empty — named absence, never invented
      // content; the owner's own history stays the record of record.
      const outcome = unwrap<any>(await call({ op: "config_receipts" }), "config_receipts", "the receipt history");
      const receipts = (outcome.document?.receipts ?? []) as import("./contracts").ReceiptDocument[];
      return receipts.filter((receipt) => receipt.changeset_id === changeset_id);
    },
  };
}

/** Derive the explicit edit operation set that turns `stored` into `next`
 * (09 §12: the engine edits through a reviewable op set, never a blind
 * overwrite). Entries are identified by (setting_ref, scope). */
export function profileEditOps(stored: ProfileDocument, next: ProfileDocument): ProfileEditOpWire[] {
  const operations: ProfileEditOpWire[] = [];
  if ((stored.title ?? null) !== (next.title ?? null)) {
    operations.push({ action: "set_title", title: next.title ?? null });
  }
  if ((stored.description ?? null) !== (next.description ?? null)) {
    operations.push({ action: "set_description", description: next.description ?? null });
  }
  const key = (entry: { setting_ref: string; scope: ScopeAddress }) =>
    `${entry.setting_ref}@${compactScope(entry.scope)}`;
  const storedEntries = new Map(stored.desired.map((entry) => [key(entry), entry]));
  for (const entry of next.desired) {
    const current = storedEntries.get(key(entry));
    const changed =
      !current ||
      JSON.stringify(current.value ?? null) !== JSON.stringify(entry.value ?? null) ||
      (current.secret_reference?.ref ?? null) !== (entry.secret_reference?.ref ?? null);
    if (changed) {
      operations.push({
        action: "set",
        setting_ref: entry.setting_ref,
        scope: { scope_kind: entry.scope.scope_kind, scope_ref: entry.scope.scope_ref ?? null },
        value: entry.value,
        secret_reference: entry.secret_reference ? { ref: entry.secret_reference.ref } : null,
      });
    }
    storedEntries.delete(key(entry));
  }
  for (const entry of storedEntries.values()) {
    operations.push({
      action: "remove",
      setting_ref: entry.setting_ref,
      scope: { scope_kind: entry.scope.scope_kind, scope_ref: entry.scope.scope_ref ?? null },
    });
  }
  return operations;
}
