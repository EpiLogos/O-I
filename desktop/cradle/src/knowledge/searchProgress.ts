import type {KnowledgeHit} from "../kernel/types";
import type {GraphNode} from "./graph";

export type ResolutionRow = {
  reference: string;
  kind: GraphNode["kind"];
  label: string;
  owner: string;
  provenance: string[];
  actions: string[];
};
export type ResolutionResult = {hits?: KnowledgeHit[]; rows?: ResolutionRow[]; absences?: string[]};
export type SearchSnapshot = {
  hits: KnowledgeHit[];
  rows: ResolutionRow[];
  absences: string[];
  resolutionAbsences: string[];
  pending: ("search" | "resolve")[];
  error?: string;
};
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Transport validation only; native query parsing, relevance and order stay
 * with the owner. Two matching labels never establish identity. */
export function normalizeResolution(value: unknown): Required<ResolutionResult> {
  if (!value || typeof value !== "object") throw new Error("Native resolution returned no object");
  const result = value as ResolutionResult;
  const hits = result.hits ?? [], rows = result.rows ?? [], absences = result.absences ?? [];
  if (!Array.isArray(hits) || !Array.isArray(rows) || !Array.isArray(absences) || absences.some(value => typeof value !== "string")) {
    throw new Error("Native resolution returned invalid result arrays");
  }
  if (hits.some(hit => !hit || typeof hit.resource !== "string" || typeof hit.label !== "string" || !hit.address || typeof hit.address.kind !== "string" || typeof hit.address.value !== "string")) {
    throw new Error("Native resolution returned an invalid hit");
  }
  if (rows.some(row => !row || typeof row.reference !== "string" || typeof row.label !== "string" || !Array.isArray(row.actions) || !Array.isArray(row.provenance))) {
    throw new Error("Native resolution returned an invalid legacy row");
  }
  return {hits, rows, absences};
}

export function hitKey(hit: KnowledgeHit): string {
  return JSON.stringify(["hit", hit.resource, hit.address.kind, hit.address.value, hit.provider]);
}
export function rowKey(row: ResolutionRow): string {
  return JSON.stringify(["row", row.reference, row.kind, row.owner]);
}
export function searchKeys(hits: KnowledgeHit[], rows: ResolutionRow[]): string[] {
  return [...hits.map(hitKey), ...rows.map(rowKey)];
}
export function preserveSearchSelection(key: string | undefined, hits: KnowledgeHit[], rows: ResolutionRow[]): number {
  const index = key === undefined ? -1 : searchKeys(hits, rows).indexOf(key);
  return Math.max(0, index);
}

/** Both owner operations start immediately and publish independently. A slow
 * supplementary provider never disables a result which is already available.
 * Duplicates collapse only for the exact same address/provider disclosure. */
export function progressiveSearch(
  search: () => Promise<unknown>,
  resolve: () => Promise<unknown>,
  publish: (snapshot: SearchSnapshot) => void,
  signal?: AbortSignal,
): void {
  let direct: Required<ResolutionResult> = {hits: [], rows: [], absences: []};
  let supplementary: Required<ResolutionResult> = {hits: [], rows: [], absences: []};
  let error: string | undefined;
  const pending = new Set<"search" | "resolve">(["search", "resolve"]);
  const emit = () => {
    if (signal?.aborted) return;
    const seen = new Set<string>();
    const hits = [...direct.hits, ...supplementary.hits].filter(hit => {
      const key = hitKey(hit);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    publish({hits, rows: supplementary.rows, absences: direct.absences, resolutionAbsences: supplementary.absences, pending: [...pending], error});
  };
  emit();
  for (const [name, read] of [["search", search], ["resolve", resolve]] as const) {
    if (signal?.aborted) return;
    void Promise.resolve().then(() => {
      signal?.throwIfAborted();
      return read();
    }).then(value => {
      const result = normalizeResolution(value);
      if (name === "search") direct = result; else supplementary = result;
    }).catch(cause => {
      if (name === "search") error = message(cause);
      else supplementary = {hits: [], rows: [], absences: [message(cause)]};
    }).finally(() => { pending.delete(name); emit(); });
  }
}
