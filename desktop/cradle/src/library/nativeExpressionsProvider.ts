/** One native index reading, retaining collection/profile/edition distinctions.
 * The index describes the native application's retained Expressions; it is not
 * a census of unimported files or a declaration of complete corpus coverage. */
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus} from "../kernel/types";
import type {LibraryProvider} from "./providers";
import type {LibraryItem} from "./scope";

export function nativeExpressionsProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "expressions", label: "Expressions", kinds: ["composition"], scopes: ["local"], modes: ["expressions", "techne", "epi-logos"],
    async list(query, signal) {
      if (query.scope === "shared") return {items: [], coverage: {provider: "expressions", state: "complete"}};
      const reply = await kernelOp(transport, {op: "expression", request: {operation: "index"}});
      if (signal.aborted) return {items: [], coverage: {provider: "expressions", state: "unavailable", reason: "query cancelled"}};
      const data = reply.outcome?.result === "expression" ? reply.outcome.data as Record<string, unknown> : null;
      if (reply.error || data?.schema !== "oi.expression-index/v1" || !Array.isArray(data.expressions)) return {items: [], coverage: {provider: "expressions", state: "unavailable", reason: reply.error ?? "Native Expression index unavailable"}};
      const items: LibraryItem[] = [];
      const errors: string[] = [];
      for (const raw of data.expressions) {
        const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
        if (!row || typeof row.expression_ref !== "string" || !row.expression_ref.startsWith("expression:") || typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.title !== "string" || !Array.isArray(row.collections) || row.collections.some((c: unknown) => typeof c !== "string")) {
          errors.push("Native index contains an invalid Expression row"); continue;
        }
        items.push({kind: "composition", ref: row.expression_ref, expressionRef: row.expression_ref, revision: String(row.revision), title: row.title, owner: "this instance", scope: "local", provider: "expressions", nativeCollections: row.collections, summary: row.collections.length ? `Collections: ${row.collections.join(", ")}` : "Native Expression — not assigned to a collection"});
      }
      return {items, coverage: {provider: "expressions", state: errors.length ? "partial" : "complete", reason: errors.length ? errors.join("; ") : undefined}};
    },
  };
}
