/** Human adoption consumer. Native oi owns discovery, effects and durable recovery.
 * No installer, credential store, authority policy or automatic retry lives here.
 */
export type DesktopChoice = "keep" | "add" | "remove";
export interface AdoptionSelection {
  composition: string; ground?: string | null; desktop: DesktopChoice;
  bundle?: string | null; bundle_sha256?: string | null;
  products: string[]; remove_products: string[];
}
export interface AdoptionChoice {id: string; title: string; description: string; products: string[]; hosted: boolean}
export interface AdoptionProduct {id: string; title: string; purpose: string; present: boolean; registered: boolean; managed: boolean; existing_executable?: string | null; unavailable_reason?: string | null}
export interface AdoptionDiscovery {
  schema: string; basis: string; target: string; bound_ground: string | null;
  suggested_ground: string; selected_ground: string | null;
  ground: {outcome?: string; canonical_path?: string; reason?: string};
  choices: AdoptionChoice[]; products: AdoptionProduct[]; warnings: string[];
  desktop: {state?: string};
}
export interface AdoptionStep {title: string; effects: string[]; operation: {kind: string; [key: string]: unknown}; native_plan?: Record<string, unknown> | null}
export interface AdoptionPlan {
  schema: string; engagement_contract: string; selection: AdoptionSelection;
  discovery: AdoptionDiscovery; steps: AdoptionStep[]; blocked: string[]; notices: string[];
  review_token: string; created_at_unix_ms: number; expires_at_unix_ms: number;
}
export interface AdoptionJournal {
  schema: string; plan: AdoptionPlan;
  records: {state: "pending" | "running" | "applied" | "verified" | "refused" | "unknown"; message?: string | null}[];
}
export type AdoptionRequest = {action: "discover"; ground?: string | null}
  | {action: "plan"; selection: AdoptionSelection}
  | {action: "apply"; plan: AdoptionPlan; approval: string}
  | {action: "status" | "recheck" | "prepare_desktop"};
export interface AdoptionReply {
  schema: string; discovery?: AdoptionDiscovery; plan?: AdoptionPlan;
  journal?: AdoptionJournal | null; disposition?: string;
  bundle?: string; sha256?: string; write_started?: boolean; reason?: string;
  error?: {code: string; message: string};
}
export interface AdoptionNative {request(request: AdoptionRequest): Promise<AdoptionReply>}
export interface AdoptionState {
  selection: AdoptionSelection; discovery?: AdoptionDiscovery; plan?: AdoptionPlan;
  journal?: AdoptionJournal; step: "selection" | "review" | "result";
  busy: null | "reading" | "planning" | "preparing" | "applying";
  disposition?: string; error?: string; unresolved: boolean; initialized: boolean;
}
const defaults = (): AdoptionSelection => ({composition: "0/1/2", desktop: "keep", products: [], remove_products: []});
const unresolved = (reply: AdoptionReply): boolean => reply.disposition === "outcome_unknown" ||
  !!reply.journal?.records.some(record => ["running", "unknown", "applied"].includes(record.state));
function checked(reply: AdoptionReply): AdoptionReply {
  if (!reply || reply.schema !== "oi.setup/v1") throw new Error("The installed O:I does not provide the adoption protocol. Update that native owner; no installation was inferred.");
  if (reply.error) throw new Error(reply.error.message);
  return reply;
}
export class AdoptionController {
  private state: AdoptionState = {selection: defaults(), step: "selection", busy: null, unresolved: false, initialized: false};
  private listeners = new Set<() => void>();
  private starting?: Promise<void>;
  readonly native: AdoptionNative;
  private clock: () => number;
  constructor(native: AdoptionNative, clock: () => number = Date.now) {this.native = native; this.clock = clock;}
  getSnapshot = (): AdoptionState => this.state;
  subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => this.listeners.delete(listener);};
  private set(next: Partial<AdoptionState>): void {this.state = {...this.state, ...next}; this.listeners.forEach(listener => listener());}
  start(): Promise<void> {return this.starting ??= this.refresh();}
  async refresh(): Promise<void> {
    if (this.state.busy) return;
    this.set({busy: "reading", error: undefined, plan: undefined});
    try {
      const status = checked(await this.native.request({action: "status"}));
      const reply = checked(await this.native.request({action: "discover", ground: this.state.selection.ground}));
      if (!reply.discovery) throw new Error("Native World discovery is incomplete.");
      this.set({discovery: reply.discovery, selection: {...this.state.selection, ground: this.state.selection.ground ?? reply.discovery.bound_ground ?? reply.discovery.suggested_ground}, initialized: true});
      if (status.journal) this.acceptResult(status);
      else this.set({step: this.state.unresolved ? "result" : "selection"});
    } catch (error) {this.set({error: String(error)});}
    finally {this.set({busy: null});}
  }
  select(change: Partial<AdoptionSelection>): void {
    if (this.state.busy || this.state.unresolved) return;
    this.set({selection: {...this.state.selection, ...change}, plan: undefined, error: undefined, step: "selection"});
  }
  back(): boolean {
    if (this.state.busy || this.state.unresolved) return false;
    this.set({step: "selection", plan: undefined, error: undefined}); return true;
  }
  canClose(): boolean {return this.state.busy !== "applying";}
  canApply(): boolean {
    const {plan, busy, unresolved: unknown, step} = this.state;
    return step === "review" && !busy && !unknown && !!plan && !plan.blocked.length &&
      this.clock() >= plan.created_at_unix_ms && this.clock() < plan.expires_at_unix_ms;
  }
  async prepareDesktop(): Promise<void> {
    if (this.state.busy || this.state.unresolved) return;
    this.set({busy: "preparing", error: undefined, plan: undefined});
    try {
      const reply = checked(await this.native.request({action: "prepare_desktop"}));
      if (!reply.bundle || !reply.sha256 || !/^[a-f0-9]{64}$/i.test(reply.sha256)) throw new Error("No checksum-qualified native Desktop offer was returned.");
      this.set({selection: {...this.state.selection, bundle: reply.bundle, bundle_sha256: reply.sha256}});
    } catch (error) {this.set({error: String(error)});}
    finally {this.set({busy: null});}
  }
  async plan(): Promise<void> {
    if (this.state.busy || this.state.unresolved) return;
    this.set({busy: "planning", plan: undefined, error: undefined});
    try {
      const reply = checked(await this.native.request({action: "plan", selection: structuredClone(this.state.selection)}));
      if (!reply.plan || reply.plan.schema !== "oi.adoption-plan/v1" || !Array.isArray(reply.plan.steps) || !Array.isArray(reply.plan.blocked) || !reply.plan.review_token || !Number.isFinite(reply.plan.expires_at_unix_ms)) throw new Error("The native owner did not return a complete reviewable plan.");
      this.set({plan: reply.plan, discovery: reply.plan.discovery, step: "review"});
    } catch (error) {this.set({error: String(error)});}
    finally {this.set({busy: null});}
  }
  private acceptResult(reply: AdoptionReply): void {
    const allowed = ["verified", "not_applied", "partially_applied", "outcome_unknown", "hosted_entry"];
    if (!reply.disposition || !allowed.includes(reply.disposition)) throw new Error("Native installation returned no supported disposition. Recheck its journal; do not repeat the write.");
    const journal = reply.journal;
    if (journal && (journal.schema !== "oi.adoption-journal/v1" || journal.plan?.schema !== "oi.adoption-plan/v1" || !Array.isArray(journal.records) || !Array.isArray(journal.plan.steps) || journal.records.length !== journal.plan.steps.length || journal.records.some(record => !["pending", "running", "applied", "verified", "refused", "unknown"].includes(record.state)))) throw new Error("Native recovery journal is incomplete.");
    // A success label, an empty transport reply or a foreign status can never
    // release an uncertain write. Receipt-bearing verification stays native.
    if (["verified", "partially_applied", "outcome_unknown"].includes(reply.disposition) && !journal) throw new Error("Native installation returned no recovery journal.");
    if (reply.disposition === "verified" && journal?.records.some(record => record.state !== "verified")) throw new Error("Native verification is incomplete.");
    if (reply.disposition === "not_applied" && !journal && reply.write_started !== false) throw new Error("Native refusal did not establish that no write started.");
    if (reply.disposition === "hosted_entry" && (journal || this.state.plan?.selection.composition !== "5/0")) throw new Error("A hosted-entry reply cannot clear a local installation.");
    this.set({journal: journal ?? undefined, disposition: reply.disposition, unresolved: unresolved(reply), error: reply.reason, step: "result"});
  }
  async apply(): Promise<void> {
    if (!this.canApply()) return;
    const plan = structuredClone(this.state.plan!);
    // Remounting or a rejected promise cannot release another write.
    this.set({busy: "applying", unresolved: true, error: undefined});
    try {
      const reply = checked(await this.native.request({action: "apply", plan, approval: plan.review_token}));
      if (reply.journal && reply.journal.plan.review_token !== plan.review_token) throw new Error("The reply belongs to a different adoption; inspect native recovery.");
      this.acceptResult(reply);
    } catch (error) {this.set({step: "result", disposition: "outcome_unknown", error: `${String(error)} No write will be retried. Recheck the native journal.`});}
    finally {this.set({busy: null});}
  }
  async recheck(): Promise<void> {
    if (this.state.busy) return;
    this.set({busy: "reading", error: undefined});
    try {
      const reply = checked(await this.native.request({action: "recheck"}));
      const token = this.state.plan?.review_token ?? this.state.journal?.plan.review_token;
      if (token && reply.journal?.plan.review_token !== token) throw new Error("The native journal no longer names this reviewed operation. Inspect native history before another write.");
      this.acceptResult(reply);
    } catch (error) {this.set({error: String(error)});}
    finally {this.set({busy: null});}
  }
}
