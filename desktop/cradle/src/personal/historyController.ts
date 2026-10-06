/** Personal-history intake flow controller — choose → inspect → review →
 * apply → verify, with rollback and re-import.
 *
 * The same discipline the adoption controller holds for installs, matched to
 * Central's own native law: the plan is reviewed before anything is written,
 * the exact reviewed plan object travels to apply (the native owner
 * re-verifies its content identity and refuses a moved world), and an
 * uncertain result is never retried by the surface — the native journal owns
 * recovery (`central.personal.collection.status`).
 */
import type {
  ActionResult, ApplyOutcome, CollectionInspection, CollectionPlan,
  PersonalAnchor, PersonalHistoryNative, RollbackReport,
} from "./history";

export type HistoryStep = "choose" | "inspected" | "review" | "result";
export type HistoryBusy = null | "reading" | "planning" | "applying";

export interface HistoryState {
  step: HistoryStep;
  busy: HistoryBusy;
  anchor?: PersonalAnchor;
  path: string;
  inspection?: CollectionInspection;
  plan?: CollectionPlan;
  outcome?: ApplyOutcome;
  collections?: NonNullable<PersonalAnchor["collections"]>;
  verify?: Record<string, unknown>;
  error?: string;
}

/** A checked reply: transport and native refusals both name themselves. */
function checked<T>(reply: ActionResult<T>): T {
  if (!reply || typeof reply.ok !== "boolean") throw new Error("the kernel returned no ActionResult envelope");
  if (!reply.ok) throw new Error(reply.error?.message ?? `the native owner refused (${reply.status})`);
  return (reply.data ?? {}) as T;
}

export class PersonalHistoryController {
  private state: HistoryState = {step: "choose", busy: null, path: ""};
  private listeners = new Set<() => void>();
  readonly native: PersonalHistoryNative;
  readonly project?: string;

  constructor(native: PersonalHistoryNative, project?: string) {
    this.native = native;
    this.project = project;
  }

  getSnapshot = (): HistoryState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private set(next: Partial<HistoryState>): void {
    this.state = {...this.state, ...next};
    this.listeners.forEach(listener => listener());
  }

  /** The person/world anchor readback: the personal node opens on facts. */
  async open(): Promise<void> {
    if (this.state.busy) return;
    this.set({busy: "reading", error: undefined});
    try {
      const anchor = checked(await this.native.anchorInspect());
      const list = checked(await this.native.collectionList());
      this.set({anchor: anchor, collections: list.collections, step: "choose"});
    } catch (error) {
      this.set({error: String(error instanceof Error ? error.message : error)});
    } finally {
      this.set({busy: null});
    }
  }

  choose(change: {path?: string}): void {
    if (this.state.busy) return;
    this.set({...change, step: "choose", inspection: undefined, plan: undefined, error: undefined});
  }

  /** Inspect the named collection: members, dispositions, dates. */
  async inspect(): Promise<void> {
    if (this.state.busy || !this.state.path) return;
    this.set({busy: "reading", error: undefined, plan: undefined, outcome: undefined});
    try {
      const inspection = checked(await this.native.collectionInspect(this.state.path));
      this.set({inspection, step: "inspected"});
    } catch (error) {
      this.set({error: String(error instanceof Error ? error.message : error)});
    } finally {
      this.set({busy: null});
    }
  }

  /** The placement plan: read-only, reviewed before anything is written. */
  async plan(request?: Record<string, unknown>): Promise<void> {
    if (this.state.busy || !this.state.inspection) return;
    this.set({busy: "planning", error: undefined});
    try {
      const reply = checked(await this.native.collectionPlan({
        path: this.state.path,
        ...request,
      })) as unknown as CollectionPlan;
      if (!reply || reply.schema !== "central.personal-collection-plan/v1" || !reply.plan_revision) {
        throw new Error("the native owner returned no reviewable placement plan");
      }
      this.set({plan: reply, step: "review"});
    } catch (error) {
      this.set({error: String(error instanceof Error ? error.message : error)});
    } finally {
      this.set({busy: null});
    }
  }

  canApply(): boolean {
    const {plan, busy, step} = this.state;
    return step === "review" && !busy && !!plan && !plan.conflicts.length &&
      plan.entries.some(entry => entry.action !== "none");
  }

  /** The human-accepted act. The exact reviewed plan travels verbatim; the
   * native owner re-verifies its identity and every origin basis itself. */
  async apply(): Promise<void> {
    if (!this.canApply()) return;
    const plan = structuredClone(this.state.plan!);
    this.set({busy: "applying", error: undefined});
    try {
      const data = checked(await this.native.collectionApply(plan)) as unknown as ApplyOutcome;
      // The reviewed plan stays on screen; the receipt answers it.
      this.set({outcome: data, step: "result"});
    } catch (error) {
      // The native owner owns recovery; the surface never retries a write.
      this.set({step: "result", error: `${String(error instanceof Error ? error.message : error)} The native journal owns recovery — read status before acting again.`});
    } finally {
      this.set({busy: null});
    }
  }

  async verify(collectionId: string): Promise<void> {
    if (this.state.busy) return;
    this.set({busy: "reading", error: undefined});
    try {
      const reading = checked(await this.native.collectionVerify(collectionId));
      this.set({verify: reading});
    } catch (error) {
      this.set({error: String(error instanceof Error ? error.message : error)});
    } finally {
      this.set({busy: null});
    }
  }

  async rollback(collectionId: string, importSequence: number, expectedRecordRevision: string): Promise<void> {
    if (this.state.busy) return;
    this.set({busy: "applying", error: undefined});
    try {
      const report = checked(await this.native.collectionRollback({
        collection_id: collectionId,
        import_sequence: importSequence,
        expected_record_revision: expectedRecordRevision,
      })) as unknown as RollbackReport;
      this.set({outcome: {schema: "central.personal-collection-rollback/v1", collection_id: report.collection_id, receipt: {
        sequence: report.import_sequence, applied_at_unix_seconds: 0, adapter: "",
        entries_added: 0, entries_changed: 0, entries_unchanged: 0,
        entries_unchanged_at_origin_absent: 0, accepted_plan_revision: "",
      }, record_ref: "", entries: report.removed_entries.length + report.restored_entries.length,
      refused: report.notes}, step: "result"});
    } catch (error) {
      this.set({error: String(error instanceof Error ? error.message : error)});
    } finally {
      this.set({busy: null});
    }
    // Back to the anchor readback — the collection list now answers with the
    // import undone. Open outside the busy window: open() is itself a read.
    await this.open();
  }

  back(): boolean {
    if (this.state.busy) return false;
    if (this.state.step === "result") this.set({step: "choose", plan: undefined, outcome: undefined, verify: undefined});
    else if (this.state.step === "review") this.set({step: "inspected", plan: undefined});
    else if (this.state.step === "inspected") this.set({step: "choose", inspection: undefined});
    return true;
  }
}
