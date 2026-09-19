/** Human setup/recovery over the existing #299 ConfigPlaneSource.
 * Presentation state only: no profile, capability or evidence store.
 * Drafts/plan are read-only; the explicit apply consent also authorises
 * holding the reviewed desired entries. Native owners still decide writes.
 */
import type {ChangeSetDocument, ConfigResolution, ReceiptDocument, ScopeAddress, SettingSpec} from "./contracts";
import type {ChangeRequest, ConfigPlaneSource, ContributionMount, PlanBundle} from "./source";
import {settingsActionable} from "./composition";

export type SetupStep = "discovery" | "settings" | "review" | "result";
export type SetupBusy = "discovery" | "planning" | "applying" | "readback" | null;
export interface SetupState {
  step: SetupStep;
  busy: SetupBusy;
  registry: Awaited<ReturnType<ConfigPlaneSource["readRegistry"]>> | null;
  requests: ChangeRequest[];
  resolutions: ConfigResolution[];
  bundle: PlanBundle | null;
  authorised: boolean;
  changeset: ChangeSetDocument | null;
  receipts: ReceiptDocument[];
  held: string[];
  previousChangesets: string[];
  /** A lost apply response is NOT a failed operation or permission to retry. */
  outcomeUnknown: boolean;
  readbackComplete: boolean;
  error: string | null;
  warnings: string[];
}

export const requestKey = (pair: {setting_ref: string; scope: ScopeAddress}): string =>
  JSON.stringify([pair.setting_ref, pair.scope.scope_kind, pair.scope.scope_ref]);
const copy = <T>(value: T): T => structuredClone(value);
const singular = new Set(["world", "ground", "machine"]);

export function settingsOf(mounts: ContributionMount[]): Record<string, SettingSpec> {
  return Object.fromEntries(mounts.flatMap(mount => (mount.document?.sections ?? [])
    .flatMap(section => section.settings.map(setting => [setting.setting_ref, setting]))));
}

/** Available is not installed/active; out-of-composition disclosures stay read-only. */
export function editableReason(mount: ContributionMount, setting: SettingSpec): string | null {
  if (!setting.writable || !setting.operations.plan || !setting.operations.apply) return "Read-only here; use the owner's disclosed native operation.";
  if (mount.availability.state !== "available" || !mount.document || mount.document.availability.state !== "available") return "The owner is not currently available for this change.";
  if (!settingsActionable(mount)) return "This owner is outside the effective composition or its standing is unknown.";
  if (mount.document.operations.plan.availability !== "disclosed" || mount.document.operations.apply.availability !== "disclosed") return "The owner has not exposed planning and application here.";
  if (setting.sensitive && setting.value_schema.type !== "secret") return "Sensitive material must be configured through the owner's secure mechanism.";
  return null;
}

/** Local form checks are hints; owner plan/validation remains authoritative. */
export function validateRequest(request: ChangeRequest, setting: SettingSpec): string | null {
  const {scope, value} = request;
  if (!singular.has(scope.scope_kind) && !scope.scope_ref?.trim()) return "Choose or enter the native scope reference.";
  if (!setting.allowed_scopes.some(allowed => allowed.scope_kind === scope.scope_kind && (allowed.scope_ref === null || allowed.scope_ref === scope.scope_ref))) return "This scope is not supported by the owner.";
  if (setting.value_schema.type === "secret") {
    if (value !== undefined || !request.secret_reference?.ref.trim()) return "Choose a credential reference; never enter credential material.";
    return null;
  }
  if (setting.sensitive || request.secret_reference) return "This value cannot enter an ordinary settings draft.";
  const schema = setting.value_schema;
  switch (schema.type) {
    case "boolean": return typeof value === "boolean" ? null : "Choose on or off.";
    case "enum": return schema.options.some(option => option.value === value) ? null : "Choose an owner-disclosed option.";
    case "number":
    case "integer":
      if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) return `Enter a finite ${schema.type}.`;
      if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) return "The number is outside the owner's allowed range.";
      return null;
    case "path":
    case "scalar":
    case "reference":
      if (typeof value !== "string") return "Enter a text value or native reference.";
      if (schema.type === "reference" && !value.trim()) return "Enter or choose a native reference.";
      if ("pattern" in schema && schema.pattern) {
        try { if (!new RegExp(schema.pattern).test(value)) return "The value does not match the owner's required format."; }
        catch { return "The owner's format cannot be validated here; refresh its contribution."; }
      }
      return null;
    case "table": return Array.isArray(value) && value.every(row => row !== null && typeof row === "object" && !Array.isArray(row)) ? null : "Enter structured rows.";
    case "list": return Array.isArray(value) ? null : "Enter a list.";
  }
}

/** No plaintext secret can enter a retained draft, plan request or ordinary log. */
function safeRequest(request: ChangeRequest, specs: Record<string, SettingSpec>): ChangeRequest {
  const setting = specs[request.setting_ref];
  if (!setting) return {setting_ref: request.setting_ref, scope: copy(request.scope)};
  if (setting.sensitive || setting.value_schema.type === "secret") {
    return {setting_ref: request.setting_ref, scope: copy(request.scope),
      secret_reference: setting.value_schema.type === "secret" && request.secret_reference ? {ref: request.secret_reference.ref} : null};
  }
  return {setting_ref: request.setting_ref, scope: copy(request.scope), value: copy(request.value)};
}

export class SetupFlowController {
  private listeners = new Set<() => void>();
  private version = 0;
  private specs: Record<string, SettingSpec>;
  private planningBaseline = "";
  private started = false;
  private current: SetupState;

  readonly source: ConfigPlaneSource;
  constructor(source: ConfigPlaneSource, requests: ChangeRequest[], settings: Record<string, SettingSpec>) {
    this.source = source;
    this.specs = settings;
    this.current = {step: "discovery", busy: null, registry: null, requests: requests.map(r => safeRequest(r, settings)), resolutions: [], bundle: null, authorised: false, changeset: null, receipts: [], held: [], previousChangesets: [], outcomeUnknown: false, readbackComplete: false, error: null, warnings: []};
  }
  async start(atReview = false): Promise<void> {
    if (this.started) return;
    this.started = true;
    const generation = this.version + 1;
    await this.discover();
    if (atReview && generation === this.version && this.current.registry && !this.current.error) {
      this.continueToSettings();
      await this.plan();
    }
  }
  getSnapshot = (): SetupState => this.current;
  subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private publish(patch: Partial<SetupState>): void {
    this.current = {...this.current, ...patch};
    for (const listener of this.listeners) listener();
  }
  private invalidate(): void {
    this.version += 1;
    this.publish({bundle: null, authorised: false, readbackComplete: false, error: null});
  }
  /** Cancel/Back invalidate only read operations. An invoked write is not cancellable here. */
  cancel(): boolean {
    if (this.current.busy === "applying" || this.current.busy === "readback") return false;
    this.version += 1;
    this.publish({busy: null, authorised: false});
    return true;
  }
  back(): void {
    if (!this.cancel() || this.current.outcomeUnknown) return;
    this.publish({step: this.current.step === "settings" ? "discovery" : "settings", bundle: null});
  }
  continueToSettings(): void {
    if (!this.current.busy && this.current.registry) this.publish({step: "settings", error: null});
  }
  setRequests(requests: ChangeRequest[]): void {
    if (this.current.busy || this.current.outcomeUnknown || this.current.step === "result") return;
    this.invalidate();
    this.publish({requests: requests.map(request => safeRequest(request, this.specs))});
  }
  authorise(value: boolean): void {
    this.publish({authorised: value && this.canApply()});
  }
  private pairs(): {setting_ref: string; scope: ScopeAddress}[] {
    return this.current.requests.map(({setting_ref, scope}) => ({setting_ref, scope}));
  }
  private baseline(rows: ConfigResolution[]): string {
    // Freshness timestamps/digests are deliberately excluded. The owner's
    // actual desired/native axes, not elapsed time, invalidate this review.
    return JSON.stringify(rows.map(row => [requestKey(row), row.desired?.value, row.desired?.secret_reference, row.native.declared?.value, row.native.effective?.value, row.native.active?.value, row.native.staged?.value, row.native.staged?.stage_state, row.native.staged?.stage_ref])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  }
  async discover(): Promise<void> {
    if (this.current.busy || this.current.outcomeUnknown) return;
    const version = ++this.version;
    this.publish({busy: "discovery", error: null, bundle: null, authorised: false});
    try {
      const registry = await this.source.readRegistry();
      if (version !== this.version) return;
      this.specs = settingsOf(registry.mounts);
      this.publish({registry, requests: this.current.requests.map(request => safeRequest(request, this.specs))});
      const resolutions = await this.source.readResolutions(this.pairs());
      if (version === this.version) this.publish({resolutions});
    } catch {
      if (version === this.version) this.publish({error: "Discovery could not be completed. No settings were changed; retry the native read."});
    } finally {if (version === this.version) this.publish({busy: null});}
  }
  private formError(): string | null {
    if (!this.current.registry || !this.current.requests.length) return "Choose at least one setting to configure.";
    const seen = new Set<string>();
    for (const request of this.current.requests) {
      const setting = this.specs[request.setting_ref];
      const mount = this.current.registry.mounts.find(candidate => candidate.document?.sections.some(section => section.settings.some(spec => spec.setting_ref === request.setting_ref)));
      if (!setting || !mount) return "A selected setting is no longer disclosed. Return to discovery and choose its current owner contribution.";
      if (seen.has(requestKey(request))) return "Each setting and scope may appear only once in a plan.";
      seen.add(requestKey(request));
      const error = editableReason(mount, setting) ?? validateRequest(request, setting);
      if (error) return `${setting.title}: ${error}`;
    }
    return null;
  }
  async plan(): Promise<void> {
    if (this.current.busy || this.current.outcomeUnknown || this.current.step === "result") return;
    const error = this.formError();
    if (error) {this.publish({error}); return;}
    const version = ++this.version;
    const requests = copy(this.current.requests);
    this.publish({step: "review", busy: "planning", bundle: null, authorised: false, error: null, warnings: []});
    try {
      const resolutions = await this.source.readResolutions(this.pairs());
      if (version !== this.version) return;
      this.planningBaseline = this.baseline(resolutions);
      const bundle = await this.source.plan(requests);
      if (version !== this.version) return;
      this.publish({bundle, resolutions});
      if (!this.plansCoverRequests(bundle)) this.publish({error: "The owner did not return a complete, uniquely bound plan. No subset will be applied; edit or retry planning."});
    } catch {
      if (version === this.version) this.publish({error: "Native planning failed. No settings were changed. Retry planning or return to your draft."});
    } finally {if (version === this.version) this.publish({busy: null});}
  }
  private plansCoverRequests(bundle: PlanBundle): boolean {
    if (bundle.errors.length || bundle.plans.length !== this.current.requests.length) return false;
    const keys = new Set(this.current.requests.map(requestKey));
    const digests = new Set<string>();
    return bundle.plans.every(plan => Boolean(plan.plan_digest) && !digests.has(plan.plan_digest) && (digests.add(plan.plan_digest), keys.delete(requestKey(plan)))) && !keys.size;
  }
  canApply(now = Date.now()): boolean {
    const {bundle, busy, step, outcomeUnknown} = this.current;
    return !busy && step === "review" && !outcomeUnknown && !!bundle && this.plansCoverRequests(bundle) &&
      bundle.plans.every(plan => plan.expires_at_unix_ms == null || plan.expires_at_unix_ms > now);
  }
  async apply(): Promise<void> {
    if (!this.current.authorised || !this.canApply()) return;
    const plans = copy(this.current.bundle!.plans);
    this.publish({busy: "applying", authorised: false, error: null, held: [], warnings: []});
    let invokingNative = false;
    try {
      const latest = await this.source.readResolutions(this.pairs());
      if (this.baseline(latest) !== this.planningBaseline) {
        this.publish({resolutions: latest, bundle: null, error: "Native or desired state changed after review. Nothing was applied; make a fresh plan."});
        return;
      }
      if (plans.some(plan => plan.expires_at_unix_ms != null && plan.expires_at_unix_ms <= Date.now())) {
        this.publish({bundle: null, error: "The reviewed plan expired. Nothing was applied; make a fresh plan."});
        return;
      }
      // Authorised intent persistence is explicit. A partial hold is not
      // rolled back and never masquerades as native application.
      for (const request of this.current.requests) {
        await this.source.holdDesired(copy(request));
        this.publish({held: [...this.current.held, requestKey(request)]});
      }
      invokingNative = true;
      const changeset = await this.source.apply(plans);
      this.publish({step: "result", changeset, readbackComplete: false});
    } catch {
      this.publish({step: "result", outcomeUnknown: invokingNative,
        error: invokingNative
          ? "The apply response was lost. Its outcome is unknown, not failed. Inspect native state/history; this flow will not replay uncertain operations."
          : "Preparation did not finish. Some desired entries may have been held, but native apply was not invoked. Re-read before preparing a fresh plan."});
    } finally {
      this.publish({busy: null});
    }
    if (this.current.step === "result") await this.readback();
  }
  async readback(): Promise<void> {
    if (this.current.busy) return;
    this.publish({busy: "readback", readbackComplete: false, warnings: []});
    try {
      const resolutions = await this.source.readResolutions(this.pairs());
      const keys = new Set(resolutions.map(requestKey));
      const complete = this.current.requests.every(request => keys.has(requestKey(request)));
      this.publish({resolutions, readbackComplete: complete,
        warnings: complete ? [] : ["Native readback omitted a requested scope. Readiness remains unknown."]});
    } catch {
      this.publish({warnings: ["Native readback failed. The recorded apply result is retained; retry this read, not the write."]});
    }
    if (this.current.changeset && this.source.receipts) {
      try {this.publish({receipts: await this.source.receipts(this.current.changeset.changeset_id)});}
      catch {this.publish({warnings: [...this.current.warnings, "Receipt history is unavailable. This does not change the native apply result."]});}
    }
    this.publish({busy: null});
  }
  /** Only explicit retryable failures with no successful/uncertain sibling
   * for that exact setting+scope are eligible. Planning never replays them. */
  retryableRequests(): ChangeRequest[] {
    const {changeset, outcomeUnknown, busy, readbackComplete} = this.current;
    if (outcomeUnknown || busy || !readbackComplete) return [];
    if (!changeset) return this.current.requests; // hold/preparation failure, native apply never invoked
    return this.current.requests.filter(request => {
      const operations = changeset.operations.filter(operation => requestKey(operation) === requestKey(request));
      return operations.length > 0 && operations.every(operation => operation.status === "failed" && operation.error?.retryable === true);
    });
  }
  prepareRetry(): void {
    const requests = this.retryableRequests();
    if (!requests.length) return;
    const previousChangesets = this.current.changeset
      ? [...this.current.previousChangesets, this.current.changeset.changeset_id] : this.current.previousChangesets;
    this.invalidate();
    this.publish({step: "settings", requests: copy(requests), previousChangesets, changeset: null, receipts: [], held: [], warnings: []});
  }
}
