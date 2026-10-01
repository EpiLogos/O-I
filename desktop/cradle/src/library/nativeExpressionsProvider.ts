/** Native live index and durable reusable material, retaining their different
 * identities. Reading a saved file never opens it or restores a private draft. */
import {kernelOp} from "../kernel/bridge";
import {materialList} from "../expression/world";
import type {KernelTransportStatus} from "../kernel/types";
import type {LibraryProvider} from "./providers";
import type {LibraryItem} from "./scope";

export function nativeExpressionsProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "expressions", label: "Expressions", kinds: ["composition"], scopes: ["local"], modes: ["expressions", "techne", "epi-logos"],
    async list(query, signal) {
      if (query.scope === "shared") return {items: [], coverage: {provider: "expressions", state: "complete"}};
      const [indexed, saved] = await Promise.allSettled([
        kernelOp(transport, {op: "expression", request: {operation: "index"}}),
        materialList(transport),
      ]);
      if (signal.aborted) return {items: [], coverage: {provider: "expressions", state: "unavailable", reason: "query cancelled"}};
      const items: LibraryItem[] = [];
      const errors: string[] = [];
      const reply = indexed.status === "fulfilled" ? indexed.value : null;
      const data = reply?.outcome?.result === "expression" ? reply.outcome.data as Record<string, unknown> : null;
      if (indexed.status === "rejected" || reply?.error || data?.schema !== "oi.expression-index/v1" || !Array.isArray(data.expressions)) errors.push(indexed.status === "rejected" ? String(indexed.reason) : reply?.error ?? "Native Expression index unavailable");
      for (const raw of Array.isArray(data?.expressions) ? data.expressions : []) {
        const row = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
        if (!row || typeof row.expression_ref !== "string" || !row.expression_ref.startsWith("expression:") || typeof row.revision !== "number" || !Number.isSafeInteger(row.revision) || row.revision < 1 || typeof row.title !== "string" || !Array.isArray(row.collections) || row.collections.some((c: unknown) => typeof c !== "string")) {
          errors.push("Native index contains an invalid Expression row"); continue;
        }
        // The current owner index carries collection identities, not names.
        // Keep these exact bindings in source depth without inventing titles.
        items.push({kind: "composition", ref: row.expression_ref, expressionRef: row.expression_ref, revision: String(row.revision), title: row.title, owner: "this instance", scope: "local", provider: "expressions", nativeCollections: row.collections, summary: row.collections.length ? `In ${row.collections.length} ${row.collections.length===1?"collection":"collections"}` : "Not assigned to a collection"});
      }
      const material = saved.status === "fulfilled" ? saved.value : null;
      if (saved.status === "rejected" || material?.state !== "materials" || material.schema !== "oi.expression-material-list/v1" || !Array.isArray(material.materials) || !Array.isArray(material.unreadable)) errors.push(saved.status === "rejected" ? String(saved.reason) : "Native saved material reading unavailable");
      else {
        for (const row of material.materials) {
          const location = row.location;
          if (!row.file_ref || !row.revision || !row.expression_ref?.startsWith("expression:") || typeof row.title !== "string" || location?.schema !== "central.path-ref/v1" || location.ref !== row.file_ref || !location.root || !location.path || location.path.startsWith("/") || location.path.split("/").some(part => !part || part === "..")) {
            errors.push("Native saved material contains an invalid file basis"); continue;
          }
          items.push({kind: "composition", ref: row.file_ref, expressionRef: row.expression_ref, revision: row.revision, title: row.title, owner: location.root, scope: "local", provider: "expression-material", sourceLocation: location, summary: "Saved native Expression · opens its exact observed file revision"});
        }
        errors.push(...material.unreadable.map(row => `${row.file_ref ?? row.path ?? "Saved material"}: ${row.error}`));
        if (material.truncated) errors.push("Native saved material discovery reached its owner-defined limit");
      }
      return {items, coverage: {provider: "expressions", state: errors.length ? items.length ? "partial" : "unavailable" : "complete", reason: errors.length ? errors.join("; ") : undefined}};
    },
  };
}
