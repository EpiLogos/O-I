/**
 * The Nara↔Epii delegation ledger — one shared reading of the delegation and
 * enrichment receipts the Nara surface records (`session.recordDelegation` /
 * `recordEnrichment`, the ql.nara-epii-delegation/v1 + ql.epii-enrichment/v1
 * contracts). The Nara surface remains the only WRITER (it owns the dialogue
 * context a delegation is derived from); the Technè Epii plane and any other
 * panel read the same receipts here instead of keeping a second truth.
 *
 * Module-level external store, same pattern as the dual-mode cut store:
 * bounded to the most recent entries, listeners notified on change, every
 * read guarded. This is a READING of receipts — not authority, not a second
 * session store, and it never applies an enrichment (retained-not-applied is
 * the contract; applying stays a Nara-surface action over its own context).
 */

export interface DelegationLedgerEntry {
  delegation: Record<string, unknown>;
  delegation_receipt: Record<string, unknown>;
  enrichment: Record<string, unknown> | null;
  enrichment_receipt: Record<string, unknown> | null;
  recorded_at: string;
}

const MAX_ENTRIES = 64;

let entries: DelegationLedgerEntry[] = [];
const listeners = new Set<() => void>();

const emit = () => { for (const listener of [...listeners]) listener(); };

export function subscribeDelegationLedger(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function delegationLedger(): DelegationLedgerEntry[] {
  return entries;
}

const delegationRefOf = (entry: DelegationLedgerEntry): string =>
  typeof entry.delegation?.delegation_ref === "string" ? entry.delegation.delegation_ref : "";

/** Record (or replace — same delegation_ref means the same delegation whose
 * enrichment later arrived) one ledger entry. Called by the Nara surface at
 * the moment it records the receipt through its own session. */
export function putDelegationLedger(entry: DelegationLedgerEntry): void {
  const ref = delegationRefOf(entry);
  const next = entries.filter(existing => delegationRefOf(existing) !== ref);
  next.unshift(entry);
  entries = next.slice(0, MAX_ENTRIES);
  emit();
}
