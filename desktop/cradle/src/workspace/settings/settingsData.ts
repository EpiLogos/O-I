/**
 * The Settings page's one data store (docs/cradle/12-SETTINGS.md). Every
 * section, the left navigator's counts, the search index and the change
 * model read the SAME snapshot, so the navigator (mounted in the left frame)
 * and the page (mounted in the centre) never disagree.
 *
 * Sources — the owners' own reads, nothing invented:
 *  - `systemDisclosure.ts`: harness status, model catalogue, encounter
 *    providers, the held chat default, and the AIKit settings disclosure;
 *  - `credential_list` (bindings + whether a pasted key can be saved);
 *  - the configuration plane (`configPlaneSource`): the registry, the
 *    resolutions of every setting the page shows, profiles;
 *  - `system_composition_read` (each product's own descriptor) and
 *    `composition_read` (the suite census).
 *
 * Each part loads alone and fails alone: a failed part is `failed` with the
 * owner's words, never an empty stand-in (S2 is distinct from empty).
 */
import {useSyncExternalStore} from "react";
import {detectTransport, kernelOp} from "../../kernel/bridge";
import type {KernelOp, KernelOutcome} from "../../kernel/types";
import {configPlaneSource} from "../../configuration/sourceHost";
import type {ConfigPlaneSource, ContributionMount} from "../../configuration/source";
import type {ConfigResolution, ProfileDocument, ScopeAddress, SettingSpec} from "../../configuration/contracts";
import {compactScope, SINGULAR_SCOPE_KINDS} from "../../configuration/contracts";
import {systemDisclosureSource} from "../../configuration/systemDisclosure";
import type {SystemDisclosureReading, SystemDisclosureSource} from "../../configuration/systemDisclosure";
import type {CompositionReading, OwnerMount} from "./types";

export type Load<T> = {state: "reading"} | {state: "ok"; value: T; at: number} | {state: "failed"; error: string};

export interface CredentialBinding {
  credential: string;
  provider_ref: string;
  tier: string;
  provenance: string;
  revoked: boolean;
  declared_secret_ref: string | null;
  last_verified_at_unix_seconds: number | null;
  bound_at_unix_seconds: number | null;
  last_rotated_at_unix_seconds: number | null;
}

export interface CredentialState {
  bindings: CredentialBinding[];
  materialEntry: {available: boolean; missing: string | null};
}

export interface VerifyResult {
  verdict: "working" | "refused" | "unreachable";
  at: number;
  http: string | null;
  recorded: boolean;
}

export interface SettingEntry {
  owner: ContributionMount;
  sectionTitle: string;
  setting: SettingSpec;
}

export interface RegistryState {
  mounts: ContributionMount[];
  entries: SettingEntry[];
  index: Record<string, SettingEntry>;
}

export interface SettingsSnapshot {
  suite: Load<SystemDisclosureReading>;
  credentials: Load<CredentialState>;
  registry: Load<RegistryState>;
  /** `setting_ref|compact scope` → the owner resolution. */
  resolutions: Record<string, ConfigResolution>;
  resolutionsState: Load<number>;
  owners: Load<Record<string, OwnerMount>>;
  census: Load<CompositionReading>;
  profiles: Load<{active: string | null; profiles: ProfileDocument[]}>;
  /** A connection staged for new chats, not yet applied (null: none). */
  stagedDefault: string | null;
  /** Verify outcomes this session saw, per credential. */
  verifications: Record<string, VerifyResult>;
  /** Which scopes of `skills.capabilities` the page has asked about. */
  skillScopes: ScopeAddress[];
  /** Further (setting, scope) pairs a section asked to read. */
  extraPairs: {setting_ref: string; scope: ScopeAddress}[];
}

const initial: SettingsSnapshot = {
  suite: {state: "reading"},
  credentials: {state: "reading"},
  registry: {state: "reading"},
  resolutions: {},
  resolutionsState: {state: "reading"},
  owners: {state: "reading"},
  census: {state: "reading"},
  profiles: {state: "reading"},
  stagedDefault: readStagedDefault(),
  verifications: {},
  skillScopes: [{scope_kind: "machine", scope_ref: null}],
  extraPairs: [],
};

let snapshot: SettingsSnapshot = initial;
const listeners = new Set<() => void>();

function set(patch: Partial<SettingsSnapshot>) {
  snapshot = {...snapshot, ...patch};
  for (const listener of [...listeners]) listener();
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function settingsSnapshot(): SettingsSnapshot {
  return snapshot;
}
export function useSettings(): SettingsSnapshot {
  return useSyncExternalStore(subscribeSettings, settingsSnapshot, settingsSnapshot);
}

// ---------------------------------------------------------------------------
// kernel access

type Call = (op: KernelOp) => Promise<{outcome: KernelOutcome | null; error?: string}>;

function call(): Call | null {
  const transport = detectTransport();
  if (transport.kind === "unavailable") return null;
  return (op) => kernelOp(transport, op);
}

/** One op, one expected result — or the kernel's/owner's own words. */
export async function expect<T = Record<string, unknown>>(op: KernelOp, result: string): Promise<T> {
  const send = call();
  if (!send) throw new Error("The settings need the desktop app's kernel, which isn't reachable here.");
  const sent = await send(op);
  if (sent.error || !sent.outcome) throw new Error(sent.error ?? "The kernel gave no answer.");
  const outcome = sent.outcome as KernelOutcome & {result?: string};
  if (outcome.result !== result) throw new Error(`The kernel answered ${outcome.result ?? "nothing"}, not ${result}.`);
  return outcome as unknown as T;
}

let planeSource: Promise<ConfigPlaneSource> | null = null;
export function plane(): Promise<ConfigPlaneSource> {
  planeSource ??= configPlaneSource();
  return planeSource;
}

let disclosure: Promise<SystemDisclosureSource> | null = null;
function disclosureSource(): Promise<SystemDisclosureSource> {
  disclosure ??= systemDisclosureSource();
  return disclosure;
}

// ---------------------------------------------------------------------------
// shaping

export function shapeBindings(value: unknown): CredentialBinding[] {
  const rows = (value as {bindings?: unknown})?.bindings;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>;
    const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : "");
    const num = (key: string) => (typeof record[key] === "number" ? (record[key] as number) : null);
    return {
      credential: text("credential_ref"),
      provider_ref: text("provider_ref"),
      tier: text("provider_tier"),
      provenance: text("binding_provenance"),
      revoked: record.revoked === true,
      declared_secret_ref: typeof record.declared_secret_ref === "string" ? record.declared_secret_ref : null,
      last_verified_at_unix_seconds: num("last_verified_at_unix_seconds"),
      bound_at_unix_seconds: num("bound_at_unix_seconds"),
      last_rotated_at_unix_seconds: num("last_rotated_at_unix_seconds"),
    };
  });
}

export function resolutionKey(setting_ref: string, scope: ScopeAddress): string {
  return `${setting_ref}|${compactScope(scope)}`;
}

/** The first scope a setting allows (the page's default address for it). */
export function defaultScope(setting: SettingSpec): ScopeAddress {
  const kind = setting.allowed_scopes[0]?.scope_kind ?? "world";
  return {scope_kind: kind, scope_ref: SINGULAR_SCOPE_KINDS.has(kind) ? null : setting.allowed_scopes[0]?.scope_ref ?? null};
}

// ---------------------------------------------------------------------------
// loading

async function part<T>(key: keyof SettingsSnapshot, read: () => Promise<T>): Promise<void> {
  if ((snapshot[key] as Load<T>).state !== "ok") set({[key]: {state: "reading"}} as Partial<SettingsSnapshot>);
  try {
    set({[key]: {state: "ok", value: await read(), at: Date.now()}} as Partial<SettingsSnapshot>);
  } catch (cause) {
    set({[key]: {state: "failed", error: plain(cause)}} as Partial<SettingsSnapshot>);
  }
}

export function plain(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause);
  return text.replace(/^Error:\s*/, "");
}

export async function loadSuite(): Promise<void> {
  await part("suite", async () => {
    const reading = await (await disclosureSource()).read();
    if (reading.kind === "unbound") throw new Error(reading.label);
    return reading;
  });
}

export async function loadCredentials(): Promise<void> {
  await part("credentials", async () => {
    const outcome = await expect<{data: unknown}>({op: "credential_list"}, "credential_reading");
    const data = (outcome.data ?? {}) as {material_entry?: {available?: boolean; missing?: string | null}};
    return {
      bindings: shapeBindings(outcome.data),
      materialEntry: {available: data.material_entry?.available === true, missing: data.material_entry?.missing ?? null},
    };
  });
}

export async function loadRegistry(): Promise<void> {
  await part("registry", async () => {
    const source = await plane();
    if (source.kind === "unbound") throw new Error(source.label);
    const registry = await source.readRegistry();
    const entries: SettingEntry[] = [];
    for (const mount of registry.mounts) {
      for (const section of mount.document?.sections ?? []) {
        for (const setting of section.settings) entries.push({owner: mount, sectionTitle: section.title, setting});
      }
    }
    return {mounts: registry.mounts, entries, index: Object.fromEntries(entries.map((entry) => [entry.setting.setting_ref, entry]))};
  });
  await loadResolutions();
}

/** Every registered setting at its default scope, plus the skill scopes the
 * page is showing. One engine read. */
export async function loadResolutions(): Promise<void> {
  const registry = snapshot.registry;
  if (registry.state !== "ok") return;
  const pairs = new Map<string, {setting_ref: string; scope: ScopeAddress}>();
  for (const entry of registry.value.entries) {
    const scope = defaultScope(entry.setting);
    if (!SINGULAR_SCOPE_KINDS.has(scope.scope_kind) && !scope.scope_ref) continue;
    pairs.set(resolutionKey(entry.setting.setting_ref, scope), {setting_ref: entry.setting.setting_ref, scope});
  }
  for (const pair of snapshot.extraPairs) {
    if (registry.value.index[pair.setting_ref]) pairs.set(resolutionKey(pair.setting_ref, pair.scope), pair);
  }
  for (const scope of snapshot.skillScopes) {
    const ref = "ai-kit:skills:skills.capabilities";
    if (registry.value.index[ref]) pairs.set(resolutionKey(ref, scope), {setting_ref: ref, scope});
  }
  try {
    const source = await plane();
    const results = await source.readResolutions([...pairs.values()]);
    const keyed: Record<string, ConfigResolution> = {};
    for (const resolution of results) keyed[resolutionKey(resolution.setting_ref, resolution.scope)] = resolution;
    set({resolutions: keyed, resolutionsState: {state: "ok", value: results.length, at: Date.now()}});
  } catch (cause) {
    set({resolutionsState: {state: "failed", error: plain(cause)}});
  }
}

export async function loadOwners(): Promise<void> {
  await part("owners", async () => {
    const outcome = await expect<{reading: {owners: OwnerMount[]}}>({op: "system_composition_read"}, "system_composition_reading");
    return Object.fromEntries(outcome.reading.owners.map((mount) => [mount.product_id, mount]));
  });
}

export async function loadCensus(): Promise<void> {
  await part("census", async () => {
    const outcome = await expect<{reading: CompositionReading}>({op: "composition_read", owners: false}, "composition_reading");
    return outcome.reading;
  });
}

export async function loadProfiles(): Promise<void> {
  await part("profiles", async () => {
    const source = await plane();
    if (source.kind === "unbound") throw new Error(source.label);
    const listing = await source.listProfiles();
    return {active: listing.active_profile_ref, profiles: listing.profiles};
  });
}

let started = false;
/** Read everything once (the page and the navigator both call this). */
export function ensureSettingsLoaded(): void {
  if (started) return;
  started = true;
  void refreshAll();
}

export async function refreshAll(): Promise<void> {
  await Promise.all([loadSuite(), loadCredentials(), loadRegistry(), loadOwners(), loadCensus(), loadProfiles()]);
}

/** Ask for one more `skills.capabilities` scope (the Skills scope switch). */
export async function watchSkillScope(scope: ScopeAddress): Promise<void> {
  if (!snapshot.skillScopes.some((known) => compactScope(known) === compactScope(scope))) {
    set({skillScopes: [...snapshot.skillScopes, scope]});
  }
  await loadResolutions();
}

/** Ask for one more (setting, scope) pair (e.g. a project-scoped trust row). */
export async function watchPair(setting_ref: string, scope: ScopeAddress): Promise<void> {
  const key = resolutionKey(setting_ref, scope);
  if (snapshot.extraPairs.some((pair) => resolutionKey(pair.setting_ref, pair.scope) === key)) return;
  set({extraPairs: [...snapshot.extraPairs, {setting_ref, scope}]});
  await loadResolutions();
}

// ---------------------------------------------------------------------------
// the staged connection for new chats (kept until applied or discarded)

const STAGED_DEFAULT_KEY = "oi-settings.staged-connection.v1";

function readStagedDefault(): string | null {
  try {
    const value = window.sessionStorage.getItem(STAGED_DEFAULT_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function stageDefaultConnection(provider: string | null): void {
  try {
    if (provider) window.sessionStorage.setItem(STAGED_DEFAULT_KEY, provider);
    else window.sessionStorage.removeItem(STAGED_DEFAULT_KEY);
  } catch { /* presentation state only */ }
  set({stagedDefault: provider});
}

export function recordVerification(credential: string, result: VerifyResult): void {
  set({verifications: {...snapshot.verifications, [credential]: result}});
}
