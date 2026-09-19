/**
 * Library providers — the registry, and the built-in providers that read
 * the Library's items from EXISTING owner seams only. Nothing here is a
 * catalogue, index or graph service of its own: each provider is a thin,
 * honestly-covered projection of one owner read.
 *
 * Registration is a plain external store (module-level, subscribable) so a
 * provider can register from anywhere — including a later Epi-Logos places
 * provider this module never imports (COMMON-BRIEF: another agent owns
 * src/epilogos; this module only exposes the seam it registers through).
 */
import {useEffect} from "react";
import {kernelOp} from "../kernel/bridge";
import type {KernelTransportStatus, KnowledgeHit} from "../kernel/types";
import {knowledge} from "../knowledge/client";
import {isUnavailable, sharedField, type SharedFieldSnapshot, type SharedFieldUnavailable} from "../knowledge/shared-field";
import {useKernel} from "../kernel/KernelProvider";
import type {WorkspaceMode} from "../workspace/mode";
import type {LibraryItem, LibraryCoverage, LibraryKind, LibraryQuery} from "./scope";

export interface LibraryProvider {
  id: string;
  label: string;
  kinds: LibraryKind[];
  scopes: ("local" | "shared")[];
  modes?: WorkspaceMode[];
  list(query: LibraryQuery, signal: AbortSignal): Promise<{items: LibraryItem[]; coverage: LibraryCoverage}>;
}

let providers: LibraryProvider[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };

/** Register a provider (replacing any earlier one of the same id). Returns
 * the un-registration function; call it on the registrant's own teardown. */
export function registerLibraryProvider(provider: LibraryProvider): () => void {
  providers = [...providers.filter(existing => existing.id !== provider.id), provider];
  emit();
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    providers = providers.filter(existing => existing !== provider);
    emit();
  };
}
export function libraryProviders(): LibraryProvider[] { return providers; }
export function subscribeLibraryProviders(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ---- built-in providers ----------------------------------------------------

/** Compositions: the kernel `expression` op's `list` operation
 * (src/expression/types.ts ExpressionRequest `{operation:"list"}` ->
 * `ExpressionResult.expressions`), the same read useExpressionApplication's
 * FieldMenu list uses. No per-item owner is disclosed by this read, so the
 * item names the instance the read came from, never a fabricated author. */
function expressionsProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "expressions", label: "Expressions", kinds: ["composition"], scopes: ["local"], modes: ["expressions"],
    async list(_query, signal) {
      const reply = await kernelOp(transport, {op: "expression", request: {operation: "list"}});
      if (signal.aborted) return {items: [], coverage: {provider: "expressions", state: "unavailable", reason: "query cancelled"}};
      if (reply.error || reply.outcome?.result !== "expression") {
        return {items: [], coverage: {provider: "expressions", state: "unavailable", reason: reply.error ?? "the expression op returned no listing"}};
      }
      const data = reply.outcome.data as {expressions?: {expression_ref: string; revision: number; title: string; dirty: boolean}[]};
      const items: LibraryItem[] = (data.expressions ?? []).map(entry => ({
        kind: "composition", ref: entry.expression_ref, title: entry.title,
        summary: entry.dirty ? "Unsaved changes" : undefined,
        owner: "this instance", scope: "local", revision: String(entry.revision),
        expressionRef: entry.expression_ref, provider: "expressions",
      }));
      return {items, coverage: {provider: "expressions", state: "complete"}};
    },
  };
}

/** Worlds: ES1/ES4 `expression_world` (src/expression/world.ts) carries one
 * bounded selection plus portals/acts/wholes — `selection_set`,
 * `selection_read`, `portal_*`, `act_*`, `whole_*` — and NO list/read-all of
 * worlds. Per brief: omit worlds from the composition provider and report
 * this honestly as its own always-unavailable provider, rather than
 * silently dropping the kind. */
function expressionWorldsProvider(): LibraryProvider {
  return {
    id: "expression-worlds", label: "Expression worlds", kinds: ["world"], scopes: ["local"], modes: ["expressions"],
    async list() {
      return {
        items: [],
        coverage: {
          provider: "expression-worlds", state: "unavailable",
          reason: "expression_world (src/expression/world.ts) offers selection_read and portal/act/whole operations over one bounded selection, never a list or read-all of worlds",
        },
      };
    },
  };
}

/** Projected objects: the same hosted-field read Explore uses —
 * `sharedField<Snapshot>(transport,{kind:"snapshot"})`
 * (src/explore/ExploreSurface.tsx:81, src/knowledge/shared-field.ts:54-58).
 * Scope "shared": the shared wiki web. Items the snapshot discloses as this
 * caller's OWN field (via `my_authority`, the caller's own authority rows —
 * never guessed) are tagged item-level `scope:"local"`, so LibraryResults
 * can nest them under "Your instance (subset)" instead of presenting two
 * unrelated lists. At scope "local"/"here" only those nested-local entries
 * are returned — "the local field" the concept names. */
function sharedFieldProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "shared-field", label: "Shared field", kinds: ["projected-object"], scopes: ["shared"],
    async list(query, signal) {
      let snapshot: SharedFieldSnapshot | SharedFieldUnavailable;
      try {
        snapshot = await sharedField<SharedFieldSnapshot | SharedFieldUnavailable>(transport, {kind: "snapshot"});
      } catch (cause) {
        return {items: [], coverage: {provider: "shared-field", state: "unavailable", reason: cause instanceof Error ? cause.message : String(cause)}};
      }
      if (signal.aborted) return {items: [], coverage: {provider: "shared-field", state: "unavailable", reason: "query cancelled"}};
      if (isUnavailable(snapshot)) return {items: [], coverage: {provider: "shared-field", state: "unavailable", reason: snapshot.detail}};
      const myFieldRefs = new Set(snapshot.my_authority.filter(authority => !authority.revoked).map(authority => authority.field_ref));
      const localOnly = query.scope !== "shared";
      const items: LibraryItem[] = snapshot.entries
        .map((entry): LibraryItem => {
          const fieldRef = snapshot.entry_fields[entry.ref];
          const isLocal = !!fieldRef && myFieldRefs.has(fieldRef);
          return {
            kind: "projected-object", ref: entry.ref, title: entry.label, summary: entry.summary,
            owner: entry.world_ref || "shared field", scope: isLocal ? "local" : "shared",
            revision: entry.revision, provider: "shared-field",
          };
        })
        .filter(item => !localOnly || item.scope === "local");
      const coverage: LibraryCoverage = snapshot.relation_errors?.length
        ? {provider: "shared-field", state: "partial", reason: `${snapshot.relation_errors.length} shared relation(s) unavailable — their source record or endpoint could not be validated`}
        : {provider: "shared-field", state: "complete"};
      return {items, coverage};
    },
  };
}

/** Pages: the wiki/knowledge search SearchOverlay uses —
 * `knowledge<{hits,absences}>(transport, project, {action:"search",query})`
 * (src/knowledge/SearchOverlay.tsx:101, src/knowledge/client.ts:4-8). Scope
 * local; `hit.provider`/`hit.authority` are the read's own disclosed
 * provenance, used as `owner` rather than an invented author. */
function wikiProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "wiki", label: "Wiki", kinds: ["page"], scopes: ["local"],
    async list(query, signal) {
      try {
        const data = await knowledge<{hits: KnowledgeHit[]; absences: string[]}>(transport, undefined, {action: "search", query: query.text});
        if (signal.aborted) return {items: [], coverage: {provider: "wiki", state: "unavailable", reason: "query cancelled"}};
        const items: LibraryItem[] = data.hits.map(hit => ({
          kind: "page", ref: hit.resource, title: hit.label, summary: hit.snippet,
          owner: hit.provider, scope: "local", provider: "wiki", address: hit.address,
        }));
        const coverage: LibraryCoverage = data.absences.length
          ? {provider: "wiki", state: "partial", reason: `${data.absences.length} referenced resource(s) absent: ${data.absences.join(", ")}`}
          : {provider: "wiki", state: "complete"};
        return {items, coverage};
      } catch (cause) {
        return {items: [], coverage: {provider: "wiki", state: "unavailable", reason: cause instanceof Error ? cause.message : String(cause)}};
      }
    },
  };
}

/** Registers the real built-in providers for the caller's lifetime. Epi-Logos
 * places are deliberately NOT built in here — that registry entry arrives
 * from wherever src/epilogos lands, through `registerLibraryProvider`. */
export function useBuiltInLibraryProviders(): void {
  const {transport} = useKernel();
  useEffect(() => {
    const unregister = [
      registerLibraryProvider(expressionsProvider(transport)),
      registerLibraryProvider(expressionWorldsProvider()),
      registerLibraryProvider(sharedFieldProvider(transport)),
      registerLibraryProvider(wikiProvider(transport)),
    ];
    return () => { for (const off of unregister) off(); };
  }, [transport]);
}
