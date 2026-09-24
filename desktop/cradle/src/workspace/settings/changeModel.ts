/**
 * The one change path of Settings (docs/cradle/12-SETTINGS.md §2):
 *
 *   stage (config_desired_hold, or the staged new-chat connection)
 *     → review (one sheet; the owner's plans are read, their digests kept)
 *     → apply  (re-plan; any digest or staged value that moved since review
 *               refuses as stale; else config_apply + chat_default_hold)
 *     → read back (the owners' own disclosures re-read; a row is "Applied ✓"
 *               only when the readback equals what was asked for).
 *
 * Nothing is written to an owner before Apply. A row whose readback does not
 * match is "Partly applied" with the reason, never reported as success.
 */
import type {ChangeSetDocument, ConfigResolution, PlanDocument, ScopeAddress} from "../../configuration/contracts";
import {compactScope} from "../../configuration/contracts";
import type {ChangeRequest} from "../../configuration/source";
import {effectiveChatDefault} from "../../configuration/harnessSource";
import {briefValue, effectInWords, onOff} from "./sectionModel";
import {harnessName} from "../../agent/chat/harness";
import {modelDisplayName} from "../../agent/chat/modelPresentation";
import {MODEL_DEFAULT_SETTING, modelDefaults} from "./harnessCapabilities";
import {
  expect, invalidateComposition, invalidateResolutions, loadResolutions, loadSuite, plain, plane, refreshResolution, resolutionKey, settingsSnapshot, stageDefaultConnection, watchPairsQuietly,
  type SettingsSnapshot,
} from "./settingsData";
import type {SettingsPlace} from "./settingsNav";

export const CAPABILITIES_REF = "ai-kit:skills:skills.capabilities";
export const DEFAULT_CONNECTION_KEY = "chat-default";

export interface StagedChange {
  /** One reviewable line. */
  key: string;
  /** The owner request it rides (several skill toggles can share one). */
  requestKey: string;
  kind: "config" | "chat-default";
  title: string;
  scopeLabel: string;
  from: string;
  to: string;
  effectKind: string;
  effect: string;
  rowId: string;
  place: SettingsPlace;
  request?: ChangeRequest;
  capability?: {id: string; enabled: boolean; scope: ScopeAddress};
  provider?: string;
}

export function scopeLabel(scope: ScopeAddress): string {
  switch (scope.scope_kind) {
    case "machine": return "This machine";
    case "project": return scope.scope_ref ? `This project (${scope.scope_ref})` : "This project";
    case "agent-session": return "This session";
    case "world": return "Everywhere";
    case "ground": return "Central";
    case "workcell": return scope.scope_ref ? `Workcell ${scope.scope_ref}` : "Workcell";
    default: return scope.scope_ref ? `${scope.scope_kind} ${scope.scope_ref}` : scope.scope_kind;
  }
}

export function skillRowId(scope: ScopeAddress, id: string): string {
  return `skill:${compactScope(scope)}:${id}`;
}
export function settingRowId(settingRef: string): string {
  return `setting:${settingRef}`;
}
export const DEFAULT_CONNECTION_ROW = "setting:default-connection";

/** The providers' labels, for the connection lines. */
function providerLabel(data: SettingsSnapshot, id: string): string {
  const rows = data.suite.state === "ok" && data.suite.value.harness.providers.state === "ok" ? data.suite.value.harness.providers.rows : [];
  return rows.find((row) => row.id === id)?.label ?? id;
}

/** Review the actual native choice, not the number of entries in its table. */
function modelDefaultsInWords(data: SettingsSnapshot, value: unknown): string {
  const rows = data.suite.state === "ok" && data.suite.value.harness.providers.state === "ok" ? data.suite.value.harness.providers.rows : [];
  const baseName = (row: typeof rows[number]): string => harnessName(row)
    ?? (row.label !== row.id ? modelDisplayName(row.label) : undefined)
    ?? "Configured harness";
  const names = Object.entries(modelDefaults(value)).map(([id, model]) => {
    const row = rows.find((candidate) => candidate.id === id);
    let name = row ? baseName(row) : "Configured harness";
    if (row) {
      const peers = rows.filter((candidate) => baseName(candidate) === name);
      if (peers.length > 1) {
        const label = row.label !== row.id ? modelDisplayName(row.label) : undefined;
        name = label && label !== name && peers.filter((candidate) => candidate.label === label).length === 1
          ? `${name} · ${label}` : `${name} · connection ${peers.indexOf(row) + 1}`;
      }
    }
    return `${name} · ${modelDisplayName(model.model_name) ?? "Saved model"}`;
  });
  return names.length ? names.sort((a, b) => a.localeCompare(b)).join("; ") : "Harness default";
}

/** The connection a new chat opens with right now (the owner rows' law). */
export function currentConnection(data: SettingsSnapshot): string | null {
  if (data.suite.state !== "ok") return null;
  const providers = data.suite.value.harness.providers.state === "ok" ? data.suite.value.harness.providers.rows : [];
  return effectiveChatDefault(providers, data.suite.value.harness.heldDefault?.value ?? null)?.provider ?? null;
}

function activeIds(resolution: ConfigResolution | undefined): Set<string> {
  const value = resolution?.native.active?.value;
  return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
}

/** Staged = desired intent held here and not yet applied. The engine keeps
 * an APPLIED ChangeSet's request as the setting's desired state too (its
 * `source_ref` names the ChangeSet, `cs-…`); that is history, not a pending
 * change, even while an owner that discloses no declared axis for it keeps
 * the engine reading "drifted". */
export function isStaged(resolution: ConfigResolution): boolean {
  const desired = resolution.desired;
  if (!desired || resolution.reconciliation.status === "satisfied") return false;
  return !(typeof desired.source_ref === "string" && desired.source_ref.startsWith("cs-"));
}

/** Every staged change, as review lines. */
export function stagedChanges(data: SettingsSnapshot): StagedChange[] {
  const changes: StagedChange[] = [];
  const registry = data.registry.state === "ok" ? data.registry.value : null;
  if (data.stagedDefault) {
    const from = currentConnection(data);
    changes.push({
      key: DEFAULT_CONNECTION_KEY, requestKey: DEFAULT_CONNECTION_KEY, kind: "chat-default",
      title: "Default connection for new chats", scopeLabel: "This machine",
      from: from ? providerLabel(data, from) : "the suite's default", to: providerLabel(data, data.stagedDefault),
      effectKind: "new-chats", effect: effectInWords("new-chats"), rowId: DEFAULT_CONNECTION_ROW,
      place: {kind: "section", id: "harnesses"}, provider: data.stagedDefault,
    });
  }
  for (const resolution of Object.values(data.resolutions)) {
    const desired = resolution.desired;
    if (!isStaged(resolution) || !desired) continue;
    const entry = registry?.index[resolution.setting_ref];
    const setting = entry?.setting;
    const secret = setting?.value_schema.type === "secret";
    const request: ChangeRequest = {
      setting_ref: resolution.setting_ref, scope: resolution.scope,
      value: secret ? undefined : desired.value, secret_reference: secret ? desired.secret_reference ?? null : null,
    };
    const requestKey = resolutionKey(resolution.setting_ref, resolution.scope);
    const effectKind = setting?.effect.kind ?? "unknown";
    if (resolution.setting_ref === CAPABILITIES_REF && desired.value && typeof desired.value === "object" && !Array.isArray(desired.value)) {
      const active = activeIds(resolution);
      const names = data.suite.state === "ok" && data.suite.value.disclosure.state === "ok"
        ? Object.fromEntries(data.suite.value.disclosure.rows.skills.map((skill) => [skill.id, skill.name])) : {};
      for (const [id, enabled] of Object.entries(desired.value as Record<string, unknown>)) {
        changes.push({
          key: `${requestKey}#${id}`, requestKey, kind: "config",
          title: `Skill · ${names[id] || id.split("/").pop() || id}`, scopeLabel: scopeLabel(resolution.scope),
          from: onOff(active.has(id)), to: onOff(enabled === true),
          effectKind, effect: effectInWords(effectKind), rowId: skillRowId(resolution.scope, id),
          place: {kind: "section", id: "skills"}, request, capability: {id, enabled: enabled === true, scope: resolution.scope},
        });
      }
      continue;
    }
    changes.push({
      key: requestKey, requestKey, kind: "config",
      title: setting?.title ?? resolution.setting_ref, scopeLabel: scopeLabel(resolution.scope),
      from: secret ? "a stored secret" : resolution.setting_ref === MODEL_DEFAULT_SETTING
        ? modelDefaultsInWords(data, resolution.native.effective?.value ?? resolution.native.declared?.value)
        : briefValue(resolution.native.effective?.value ?? resolution.native.declared?.value),
      to: secret ? "a stored secret" : resolution.setting_ref === MODEL_DEFAULT_SETTING ? modelDefaultsInWords(data, desired.value) : briefValue(desired.value),
      effectKind, effect: effectInWords(effectKind), rowId: settingRowId(resolution.setting_ref),
      place: resolution.setting_ref === MODEL_DEFAULT_SETTING ? {kind: "section", id: "harnesses"} : {kind: "product", id: entry?.owner.owner_ref ?? "oi"}, request,
    });
  }
  return changes;
}

// ---------------------------------------------------------------------------
// staging verbs

async function hold(request: ChangeRequest): Promise<void> {
  const source = await plane();
  await source.holdDesired(request);
  invalidateResolutions(request.setting_ref, request.scope);
}
async function discard(setting_ref: string, scope: ScopeAddress): Promise<void> {
  const source = await plane();
  await source.discardDesired(setting_ref, scope);
  invalidateResolutions(setting_ref, scope);
}

/** Stage one skill on/off at a scope: the scope's held toggle map gains (or,
 * when it returns to what the owner already has, loses) this capability. */
const skillWrites = new Map<string, Promise<void>>();
export function stageSkill(scope: ScopeAddress, id: string, enabled: boolean): Promise<void> {
  const key = resolutionKey(CAPABILITIES_REF, scope);
  const previous = skillWrites.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => stageSkillOnce(scope, id, enabled));
  skillWrites.set(key, next);
  void next.finally(() => { if (skillWrites.get(key) === next) skillWrites.delete(key); }).catch(() => {});
  return next;
}

async function stageSkillOnce(scope: ScopeAddress, id: string, enabled: boolean): Promise<void> {
  const data = settingsSnapshot();
  const resolution = data.resolutions[resolutionKey(CAPABILITIES_REF, scope)];
  const held = (resolution && isStaged(resolution) && resolution.desired?.value && typeof resolution.desired.value === "object" && !Array.isArray(resolution.desired.value))
    ? {...(resolution.desired.value as Record<string, boolean>)} : {};
  if (activeIds(resolution).has(id) === enabled) delete held[id];
  else held[id] = enabled;
  if (Object.keys(held).length === 0) {
    if (resolution?.desired) await discard(CAPABILITIES_REF, scope);
  } else {
    await hold({setting_ref: CAPABILITIES_REF, scope, value: held, secret_reference: null});
  }
  await refreshResolution(CAPABILITIES_REF, scope);
}

/** Stage any ordinary owner setting (product pages). */
export async function stageSetting(request: ChangeRequest): Promise<void> {
  await hold(request);
  await loadResolutions();
}

/** Undo one staged line. */
export async function undoChange(change: StagedChange): Promise<void> {
  if (change.kind === "chat-default") {
    stageDefaultConnection(null);
    return;
  }
  if (change.capability) {
    const data = settingsSnapshot();
    const resolution = data.resolutions[resolutionKey(CAPABILITIES_REF, change.capability.scope)];
    await stageSkill(change.capability.scope, change.capability.id, activeIds(resolution).has(change.capability.id));
    return;
  }
  if (change.request) await discard(change.request.setting_ref, change.request.scope);
  await loadResolutions();
}

/** Discard everything staged. */
export async function discardAll(changes: StagedChange[]): Promise<void> {
  const seen = new Set<string>();
  for (const change of changes) {
    if (seen.has(change.requestKey)) continue;
    seen.add(change.requestKey);
    if (change.kind === "chat-default") stageDefaultConnection(null);
    else if (change.request) await discard(change.request.setting_ref, change.request.scope);
  }
  await loadResolutions();
}

// ---------------------------------------------------------------------------
// review → apply → read back

export interface ReviewedPlan {
  /** requestKey → the owner's plan digest at review time. */
  digests: Record<string, string>;
  /** requestKey → the owner's refusal, when it would not plan the change. */
  refusals: Record<string, string>;
  /** requestKey → the staged value at review time (compact form). */
  staged: Record<string, string>;
  changes: StagedChange[];
}

export type RowResult = {state: "applied"} | {state: "partial"; reason: string} | {state: "refused"; reason: string};

export interface ApplyResult {
  kind: "applied";
  rows: Record<string, RowResult>;
  appliedCount: number;
  total: number;
  readAt: number;
}

export type ApplyOutcome = ApplyResult | {kind: "stale"} | {kind: "failed"; error: string};

function uniqueRequests(changes: StagedChange[]): [string, ChangeRequest][] {
  const requests = new Map<string, ChangeRequest>();
  for (const change of changes) if (change.request && !requests.has(change.requestKey)) requests.set(change.requestKey, change.request);
  return [...requests.entries()];
}

function stagedValue(change: StagedChange): string {
  return change.kind === "chat-default" ? change.provider ?? "" : JSON.stringify(change.request?.value ?? change.request?.secret_reference ?? null);
}

async function planAll(changes: StagedChange[]): Promise<{digests: Record<string, string>; refusals: Record<string, string>}> {
  const requests = uniqueRequests(changes);
  const digests: Record<string, string> = {};
  const refusals: Record<string, string> = {};
  if (requests.length === 0) return {digests, refusals};
  const bundle = await (await plane()).plan(requests.map(([, request]) => request));
  for (const [key, request] of requests) {
    const plan = bundle.plans.find((candidate: PlanDocument) => candidate.setting_ref === request.setting_ref && compactScope(candidate.scope) === compactScope(request.scope));
    if (plan) digests[key] = plan.plan_digest;
  }
  for (const error of bundle.errors) {
    const match = requests.find(([, request]) => request.setting_ref === error.setting_ref);
    if (match) refusals[match[0]] = error.message;
  }
  for (const [key] of requests) if (!digests[key] && !refusals[key]) refusals[key] = "The owner returned no plan for this change.";
  return {digests, refusals};
}

/** Open the review: read what is staged NOW, and let the owners plan every
 * staged change (nothing moves). An empty result is a plan read and empty. */
export async function review(): Promise<ReviewedPlan> {
  await loadResolutions();
  const changes = stagedChanges(settingsSnapshot());
  const {digests, refusals} = await planAll(changes);
  return {digests, refusals, changes, staged: Object.fromEntries(changes.map((change) => [change.key, stagedValue(change)]))};
}

/** Apply exactly what was reviewed — or refuse as stale. */
export async function applyReviewed(reviewed: ReviewedPlan): Promise<ApplyOutcome> {
  try {
    // 1 · what is staged now must be what was reviewed.
    await loadResolutions();
    const now = stagedChanges(settingsSnapshot());
    const nowKeys = new Map(now.map((change) => [change.key, stagedValue(change)]));
    const same = nowKeys.size === reviewed.changes.length && reviewed.changes.every((change) => nowKeys.get(change.key) === reviewed.staged[change.key]);
    if (!same) return {kind: "stale"};
    // 2 · the owners must still plan it identically.
    const replanned = await planAll(reviewed.changes);
    for (const [key, digest] of Object.entries(reviewed.digests)) {
      if (replanned.digests[key] !== digest) return {kind: "stale"};
    }
    // 3 · apply.
    const applicable = uniqueRequests(reviewed.changes).filter(([key]) => !reviewed.refusals[key]);
    let changeset: ChangeSetDocument | null = null;
    let applyError: string | null = null;
    if (applicable.length > 0) {
      const source = await plane();
      const bundle = await source.plan(applicable.map(([, request]) => request));
      try {
        changeset = await source.apply(bundle.plans);
      } catch (cause) {
        applyError = plain(cause);
      }
    }
    const connection = reviewed.changes.find((change) => change.kind === "chat-default");
    let connectionError: string | null = null;
    if (connection?.provider) {
      try {
        await expect({op: "chat_default_hold", provider: connection.provider}, "chat_default_held");
      } catch (cause) {
        connectionError = plain(cause);
      }
    }
    // 4 · read back from the owners (every applied pair is read, staged or not).
    watchPairsQuietly(uniqueRequests(reviewed.changes).map(([, request]) => ({setting_ref: request.setting_ref, scope: request.scope})));
    invalidateComposition();
    invalidateResolutions();
    // Model defaults render and confirm from native resolutions. Other settings
    // can change suite facts (including skill activation), and new-chat defaults
    // need heldDefault. Avoid that full disclosure only for model-default Apply.
    const needsSuite = reviewed.changes.some((change) => change.kind === "chat-default" || change.request?.setting_ref !== MODEL_DEFAULT_SETTING);
    await Promise.all([loadResolutions(), ...(needsSuite ? [loadSuite()] : [])]);
    const after = settingsSnapshot();
    const rows: Record<string, RowResult> = {};
    for (const change of reviewed.changes) {
      rows[change.key] = readBack(change, reviewed, after, changeset, applyError, connectionError);
    }
    // 5 · release what the owners confirmed.
    const confirmed = new Set(uniqueRequests(reviewed.changes).map(([key]) => key));
    for (const change of reviewed.changes) if (rows[change.key].state !== "applied") confirmed.delete(change.requestKey);
    for (const [key, request] of uniqueRequests(reviewed.changes)) {
      if (confirmed.has(key)) await (await plane()).discardDesired(request.setting_ref, request.scope).catch(() => undefined);
    }
    if (connection && rows[connection.key].state === "applied") stageDefaultConnection(null);
    await loadResolutions();
    const appliedCount = Object.values(rows).filter((row) => row.state === "applied").length;
    return {kind: "applied", rows, appliedCount, total: reviewed.changes.length, readAt: Date.now()};
  } catch (cause) {
    return {kind: "failed", error: plain(cause)};
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function readBack(change: StagedChange, reviewed: ReviewedPlan, after: SettingsSnapshot, changeset: ChangeSetDocument | null, applyError: string | null, connectionError: string | null): RowResult {
  if (change.kind === "chat-default") {
    if (connectionError) return {state: "refused", reason: connectionError};
    const held = after.suite.state === "ok" ? after.suite.value.harness.heldDefault?.value : undefined;
    return held === change.provider ? {state: "applied"} : {state: "partial", reason: "The new connection didn't read back as held."};
  }
  const refusal = reviewed.refusals[change.requestKey];
  if (refusal) return {state: "refused", reason: refusal};
  if (applyError) return {state: "refused", reason: applyError};
  const request = change.request!;
  const operation = changeset?.operations.find((op) => op.setting_ref === request.setting_ref && compactScope(op.scope) === compactScope(request.scope));
  if (!operation) return {state: "refused", reason: "The owner recorded no operation for this change."};
  if (operation.status === "failed") return {state: "refused", reason: operation.error?.message ?? "The owner reported the change failed."};
  const resolution = after.resolutions[change.requestKey];
  if (change.capability) {
    const active = activeIds(resolution);
    return active.has(change.capability.id) === change.capability.enabled
      ? {state: "applied"}
      : {state: "partial", reason: `AIKit still reports it ${onOff(active.has(change.capability.id))} — another scope decides for this skill.`};
  }
  const native = resolution?.native.effective?.value ?? resolution?.native.declared?.value;
  if (resolution?.reconciliation.status === "satisfied" || (native !== undefined && sameValue(native, request.value))) return {state: "applied"};
  return {state: "partial", reason: resolution?.reconciliation.reason ?? "The owner doesn't report this setting back yet, so the change can't be confirmed."};
}
