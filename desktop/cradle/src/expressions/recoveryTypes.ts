/** Private working copies, never canonical files or publication authority. */
export type RecoveryScope = "expressions" | "techne";
export type RecoveryKind = "draft" | "checkpoint";
export type ExpressionRecoveryRequest =
  | {operation: "read"; scope: RecoveryScope; kind: RecoveryKind; id: string}
  | {operation: "list"; scope: RecoveryScope; kind: RecoveryKind}
  | {operation: "find_checkpoint"; scope: RecoveryScope; expression_ref: string}
  | {operation: "write"; scope: RecoveryScope; kind: RecoveryKind; id: string; expected_revision: number | null; value: unknown}
  | {operation: "remove"; scope: RecoveryScope; kind: RecoveryKind; id: string; expected_revision: number};
export interface RecoveryRecord {
  id: string; scope: RecoveryScope; kind: RecoveryKind; revision: number; value: unknown;
}
export type ExpressionRecoveryResult =
  | {state: "ready"; record: RecoveryRecord | null}
  | {state: "listed"; records: Omit<RecoveryRecord, "value">[]}
  | {state: "written"; record: RecoveryRecord}
  | {state: "removed"; id: string; revision: number}
  | {state: "revision_conflict"; current_revision: number | null};
