/** Private working copies, never canonical files or publication authority. */
export type RecoveryScope = "expressions" | "techne";
/** `draft_quarantine` is the owner's kept drafts, one record per Expression (E19); `stage_configuration` is the Ta-Onta stage's retained configuration. */
export type RecoveryKind = "draft" | "checkpoint" | "draft_quarantine" | "stage_configuration";
/** Selected native recovery address. Presentation mode never changes it. */
export interface RecoveryBinding {
  scope: RecoveryScope;
  checkpoint_id: string;
  expression_ref: string;
}
export type ExpressionRecoveryRequest =
  | {operation: "read"; scope: RecoveryScope; kind: RecoveryKind; id: string}
  | {operation: "list"; scope: RecoveryScope; kind: RecoveryKind}
  | {operation: "find_checkpoint"; scope: RecoveryScope; expression_ref: string}
  | {operation: "write"; scope: RecoveryScope; kind: RecoveryKind; id: string; expected_revision: number | null; value: unknown}
  | {operation: "remove"; scope: RecoveryScope; kind: RecoveryKind; id: string; expected_revision: number}
  /** E19: keep a superseded draft's verbatim native text in the owner's quarantine for its Expression. The owner validates it, stamps the time and the reason, and answers `quarantine_full` (the Expression holds its entry limit), `quarantine_over_size` (a byte bound would be exceeded) or `quarantine_unreadable` (the stored record cannot be read): each is a named reply that keeps nothing, removes nothing and overwrites nothing. */
  | {operation: "keep_draft_quarantine"; scope: RecoveryScope; expression_ref: string; draft_id: string; reason: string; text: string; expected_revision: number | null}
  /** E19: remove one kept draft by its entry identity, only on an explicit request. */
  | {operation: "remove_draft_quarantine"; scope: RecoveryScope; expression_ref: string; entry_id: string; expected_revision: number};
export interface RecoveryRecord {
  id: string; scope: RecoveryScope; kind: RecoveryKind; revision: number; value: unknown;
}
export type ExpressionRecoveryResult =
  | {state: "ready"; record: RecoveryRecord | null}
  | {state: "listed"; records: Omit<RecoveryRecord, "value">[]}
  | {state: "written"; record: RecoveryRecord}
  | {state: "removed"; id: string; revision: number}
  | {state: "revision_conflict"; current_revision: number | null}
  | {state: "quarantine_kept"; kept: boolean; entry_id: string; revision: number}
  | {state: "quarantine_full"; limit: number; kept: number; revision: number | null}
  /** `reason` names the bound: `record_bytes` (one Expression's record), `scope_bytes` (the whole store) or `scope_records`. */
  | {state: "quarantine_over_size"; reason: "record_bytes" | "scope_bytes" | "scope_records"; limit: number; kept: number; revision: number | null}
  /** `detail` is the owner's reason the stored kept drafts cannot be read. Nothing is written over them. */
  | {state: "quarantine_unreadable"; detail: string}
  | {state: "quarantine_entry_removed"; entry_id: string; remaining: number; revision: number};
