/** Historical unscoped reader retained for consumer compatibility.
 * Personal delegation/result content must NOT be broadcast to a generic
 * Technè panel or diagnostics. NaraRuntime retains its own private inquiry
 * reading for the selected encounter. Explicit cross-plane sharing needs an
 * owner-admitted scoped reading; knowing a ref is not a disclosure grant.
 */
export interface DelegationLedgerEntry {
  delegation:Record<string,unknown>;
  delegation_receipt:Record<string,unknown>;
  enrichment:Record<string,unknown>|null;
  enrichment_receipt:Record<string,unknown>|null;
  recorded_at:string;
}
const EMPTY:DelegationLedgerEntry[]=[];
Object.freeze(EMPTY);
export function delegationLedger():DelegationLedgerEntry[]{return EMPTY;}
export function subscribeDelegationLedger(_listener:()=>void):()=>void{return()=>{};}
export function putDelegationLedger(_entry:DelegationLedgerEntry):never {
  throw new Error("Unscoped personal delegation publication is forbidden; retain the result in its own Nara encounter");
}
