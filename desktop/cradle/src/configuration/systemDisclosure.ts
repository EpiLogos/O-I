/**
 * The rebuilt settings sections' data seam (HARNESS-SETTINGS-RESEARCH
 * 2026-09-22 §2; docs/cradle/06 §2 L2/L4). One read gathers everything the
 * Status / Harnesses / Models / Credentials / Skills panels render:
 *
 *  - the harness face reads (`aikit --json client status`, the model
 *    catalogue, the resident's encounter providers, the desktop-held chat
 *    default) through `createLiveHarnessSource` — the same live source the
 *    unit tests pin against the real wire shapes;
 *  - the AIKit owner's own settings disclosure
 *    (`oi.product-settings-disclosure/v2`, mounted by the kernel's
 *    `system_composition_read` op — the same `aikit system --json`
 *    document) shaped into the masked credential, secret-store, skill and
 *    generation facts the rebuilt sections render.
 *
 * There is no fixture variant: these panels show this machine's truth
 * through the kernel ops, or render their honest absence. Credential state
 * is PRESENCE-ONLY by contract — no shaped row has a field a secret value
 * could occupy.
 */

import type {KernelOp, KernelOutcome} from "../kernel/types";
import {detectTransport, kernelOp} from "../kernel/bridge";
import {createLiveHarnessSource, createUnboundHarnessSource} from "./harnessSource";
import type {HarnessReading} from "./harnessSource";
import type {ProductDisclosureV2} from "../workspace/settings/types";

export type OpCall = (op: KernelOp) => Promise<{outcome: KernelOutcome | null; error?: string}>;

// ---------------------------------------------------------------------------
// shaped rows (pure, tolerant of absent fields — the owner's census varies)

/** One secret provider from `models.providers` — state only, never material. */
export interface SecretProviderRow {
  provider_ref: string;
  tier: string;
  provider_kind: string;
  available: boolean;
  binding_provenance: string | null;
  assurance: string | null;
  supported_credentials: string[];
}

export function shapeSecretProviderRoster(value: unknown): SecretProviderRow[] {
  const providers = (value as {providers?: unknown} | null)?.providers;
  if (!Array.isArray(providers)) return [];
  return providers.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return {
      provider_ref: typeof record.provider_ref === "string" ? record.provider_ref : "",
      tier: typeof record.tier === "string" ? record.tier : "",
      provider_kind: typeof record.provider_kind === "string" ? record.provider_kind : "",
      available: record.available === true,
      binding_provenance: typeof record.binding_provenance === "string" ? record.binding_provenance : null,
      assurance: typeof record.assurance === "string" ? record.assurance : null,
      supported_credentials: Array.isArray(record.supported_credentials)
        ? record.supported_credentials.filter((name): name is string => typeof name === "string")
        : [],
    };
  });
}

/** One credential's inventory row from `models.inventory` — presence and
 * lifecycle facts only. There is no secret-material field to shape. */
export interface CredentialRow {
  credential: string;
  provider: string | null;
  materialisation: string | null;
  provenance: string | null;
  revoked: boolean;
  bound_at_unix_seconds: number | null;
  last_rotated_at_unix_seconds: number | null;
  declared_secret_ref: string | null;
}

export function shapeCredentialInventory(value: unknown): CredentialRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return {
      credential: typeof record.credential === "string" ? record.credential : "",
      provider: typeof record.provider === "string" ? record.provider : null,
      materialisation: typeof record.materialisation === "string" ? record.materialisation : null,
      provenance: typeof record.provenance === "string" ? record.provenance : null,
      revoked: record.revoked === true,
      bound_at_unix_seconds: typeof record.bound_at_unix_seconds === "number" ? record.bound_at_unix_seconds : null,
      last_rotated_at_unix_seconds: typeof record.last_rotated_at_unix_seconds === "number" ? record.last_rotated_at_unix_seconds : null,
      declared_secret_ref: typeof record.declared_secret_ref === "string" ? record.declared_secret_ref : null,
    };
  });
}

/** One credential requirement from `models.credentials` — what a model
 * route needs, and whether the owner resolved it. The route-availability
 * fact the Models section renders honestly. */
export interface CredentialRequirementRow {
  requirement_ref: string;
  credential_ref: string;
  purpose: string | null;
  state: string;
  selected_materialisation: string | null;
  selected_provider_ref: string | null;
}

export function shapeCredentialRequirements(value: unknown): CredentialRequirementRow[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value as Record<string, unknown>).map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return {
      requirement_ref: typeof record.requirement_ref === "string" ? record.requirement_ref : "",
      credential_ref: typeof record.credential_ref === "string" ? record.credential_ref : "",
      purpose: typeof record.purpose === "string" ? record.purpose : null,
      state: typeof record.state === "string" ? record.state : "unknown",
      selected_materialisation: typeof record.selected_materialisation === "string" ? record.selected_materialisation : null,
      selected_provider_ref: typeof record.selected_provider_ref === "string" ? record.selected_provider_ref : null,
    };
  });
}

/** One usable secret store from `security.secret_stores` — the
 * declare-location targets (keychain://, varlock://, pass://, op://). */
export interface SecretStoreRow {
  store: string;
  scheme: string;
  route: string | null;
  availability: string;
}

export function shapeSecretStores(value: unknown): SecretStoreRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    return {
      store: typeof record.store === "string" ? record.store : "",
      scheme: typeof record.scheme === "string" ? record.scheme : "",
      route: typeof record.route === "string" ? record.route : null,
      availability: typeof record.availability === "string" ? record.availability : "unknown",
    };
  });
}

/** One resolved capability from `skills.capabilities`, joined with the
 * active axis (the ids the composition actually carries). */
export interface SkillRow {
  id: string;
  kind: string;
  name: string;
  active: boolean;
}

export function shapeSkillCapabilities(effective: unknown, active: unknown): SkillRow[] {
  if (!Array.isArray(effective)) return [];
  const activeIds = new Set(Array.isArray(active) ? active.filter((id): id is string => typeof id === "string") : []);
  return effective.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const kind = typeof record.kind === "string" ? record.kind : "";
    const name = typeof record.name === "string" ? record.name : "";
    return {id, kind, name, active: activeIds.has(id)};
  });
}

/** The effective generation from `generation.current` — the resolution the
 * suite is serving right now. */
export interface GenerationFacts {
  catalog_revision: string | null;
  resolution_hash: string | null;
  generation: string | null;
}

export function shapeGeneration(value: unknown): GenerationFacts | null {
  const record = (value ?? {}) as Record<string, unknown>;
  if (typeof value !== "object" || value === null) return null;
  return {
    catalog_revision: typeof record.catalog_revision === "string" ? record.catalog_revision : null,
    resolution_hash: typeof record.resolution_hash === "string" ? record.resolution_hash : null,
    generation: record.generation == null ? null : String(record.generation),
  };
}

/** The disclosure facts the rebuilt sections render, all cut from the
 * owner's own mounted descriptor. */
export interface DisclosureFacts {
  version: string | null;
  availability: string;
  availability_reason: string | null;
  observed_at_unix_ms: number | null;
  providers: SecretProviderRow[];
  credentials: CredentialRow[];
  requirements: CredentialRequirementRow[];
  secretStores: SecretStoreRow[];
  skills: SkillRow[];
  generation: GenerationFacts | null;
}

function sectionOf(descriptor: ProductDisclosureV2, id: string) {
  return descriptor.sections.find((section) => section.id === id) ?? null;
}

function axisValue(descriptor: ProductDisclosureV2, sectionId: string, key: string, axis: "declared" | "effective" | "active"): unknown {
  const setting = sectionOf(descriptor, sectionId)?.settings.find((row) => row.key === key);
  return setting?.axes[axis]?.value;
}

export function shapeDisclosureFacts(descriptor: ProductDisclosureV2): DisclosureFacts {
  const capabilitySetting = sectionOf(descriptor, "skills")?.settings.find((row) => row.key === "skills.capabilities");
  const inventoryValue = axisValue(descriptor, "models", "models.inventory", "effective");
  return {
    version: descriptor.owner.owner_version ?? null,
    availability: descriptor.availability.state,
    availability_reason: descriptor.availability.reason ?? null,
    observed_at_unix_ms: descriptor.owner.observed_at_unix_ms ?? descriptor.disclosed_at_unix_ms ?? null,
    providers: shapeSecretProviderRoster(axisValue(descriptor, "models", "models.providers", "effective")),
    credentials: shapeCredentialInventory(inventoryValue),
    requirements: shapeCredentialRequirements(axisValue(descriptor, "models", "models.credentials", "effective")),
    secretStores: shapeSecretStores(axisValue(descriptor, "security", "security.secret_stores", "effective")),
    skills: shapeSkillCapabilities(
      capabilitySetting?.axes.effective?.value,
      capabilitySetting?.axes.active?.value,
    ),
    generation: shapeGeneration(axisValue(descriptor, "generation", "generation.current", "effective")),
  };
}

// ---------------------------------------------------------------------------
// the source

/** One section that could not be read carries the refusal; the others
 * still render. Nothing is faked empty (06 §2 L3). */
export type DisclosureSection<T> = {state: "ok"; rows: T} | {state: "absent"; reason: string};

export interface SystemDisclosureReading {
  kind: "live" | "unbound";
  label: string;
  observed_at_unix_ms: number;
  harness: HarnessReading;
  /** The AIKit owner disclosure, or its named absence. */
  disclosure: DisclosureSection<DisclosureFacts>;
}

export interface SystemDisclosureSource {
  readonly kind: "live" | "unbound";
  readonly label: string;
  read(): Promise<SystemDisclosureReading>;
  /** The harness-face writes (the held default provider) keep their seam. */
  holdDefault(provider: string): Promise<void>;
  discardDefault(): Promise<void>;
}

function unwrapMounted(call: OpCall) {
  return async () => {
    const sent = await call({op: "system_composition_read"});
    if (sent.error || sent.outcome == null) throw new Error(sent.error ?? "the system composition could not be served by the kernel");
    const outcome = sent.outcome as KernelOutcome & {result?: string};
    if (outcome.result !== "system_composition_reading") throw new Error(`the system composition answered \`${outcome.result ?? "unknown"}\`, not \`system_composition_reading\``);
    const reading = (outcome as unknown as {reading: {owners: {product_id: string; descriptor: ProductDisclosureV2 | null; error: string | null; reason: string | null}[]}}).reading;
    const mount = reading.owners.find((owner) => owner.product_id === "ai-kit");
    if (!mount) throw new Error("the AIKit position is not part of this world's composition reading");
    if (!mount.descriptor) throw new Error(mount.error ?? mount.reason ?? "the AIKit disclosure did not mount");
    return mount.descriptor;
  };
}

export function createLiveSystemDisclosure(call: OpCall): SystemDisclosureSource {
  const harness = createLiveHarnessSource(call);
  const mountedDescriptor = unwrapMounted(call);
  return {
    kind: "live",
    label: "live — read through the installed suite (aikit system disclosure, client status, model catalogue)",
    async read() {
      const [harnessReading, disclosure] = await Promise.all([
        harness.read(),
        (async () => {
          try {
            return {state: "ok" as const, rows: shapeDisclosureFacts(await mountedDescriptor())};
          } catch (cause) {
            return {state: "absent" as const, reason: String(cause)};
          }
        })(),
      ]);
      return {
        kind: "live",
        label: "live — read through the installed suite (aikit system disclosure, client status, model catalogue)",
        observed_at_unix_ms: Date.now(),
        harness: harnessReading,
        disclosure,
      };
    },
    async holdDefault(provider) {
      await harness.holdDefault(provider);
    },
    async discardDefault() {
      await harness.discardDefault();
    },
  };
}

export function createUnboundSystemDisclosure(reason: string): SystemDisclosureSource {
  const harness = createUnboundHarnessSource(reason);
  return {
    kind: "unbound",
    label: reason,
    read: async () => ({
      kind: "unbound" as const,
      label: reason,
      observed_at_unix_ms: 0,
      harness: await harness.read(),
      disclosure: {state: "absent" as const, reason},
    }),
    holdDefault: async () => harness.holdDefault(""),
    discardDefault: async () => harness.discardDefault(),
  };
}

/** The binding: the kernel ops in every build — walk bundles included, the
 * same way the System census reads. No fixture variant exists for these
 * panels: they render the machine's truth or its honest absence. */
export function systemDisclosureSource(): Promise<SystemDisclosureSource> {
  const transport = detectTransport();
  if (transport.kind === "unavailable") {
    return Promise.resolve(createUnboundSystemDisclosure(
      `no kernel transport is reachable (${transport.reason}); these panels need the Tauri host or a walk bridge`,
    ));
  }
  return Promise.resolve(createLiveSystemDisclosure((op) => kernelOp(transport, op)));
}
