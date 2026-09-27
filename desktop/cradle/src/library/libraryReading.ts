/**
 * Host-side adapter for the hosted Technē/Expressions application's
 * "library-read" host request (hostedApp.ts::relayKernelChannel,
 * expressions-app/.../kernelExpressions.ts::readLibraryEntries). This is
 * NOT a new native reader: it composes the EXISTING Library providers
 * (collectionsProvider — Central/ProjectCentral collection manifests;
 * nativeExpressionsProvider — the native Expression index) into one
 * sanitized shape the hosted frame consumes.
 *
 * Sanitization: refs, titles, locations, collection memberships and
 * revisions only — no source bodies, no private payload beyond what
 * LibraryBrowser (this same registry, other consumer) already discloses to
 * a local viewer.
 *
 * Scene lists: neither provider discloses them, so each native Expression's
 * Scenes are read from the Expression owner itself (`inspect`), bounded and
 * four at a time. An unreadable Expression keeps `scenes` undefined; nothing
 * is invented.
 *
 * Privacy boundary (Wayfinder §24: "Private/ineligible payloads ... must be
 * excluded server/owner-side, not merely hidden in CSS"): a provider's own
 * per-item `scope` tag is authoritative here. The shared horizon keeps only
 * entries a provider itself disclosed as "local" (its own nested subset) or
 * "shared" — never widened, never guessed.
 */
import type {KernelTransportStatus} from "../kernel/types";
import type {LibraryItem, LibraryScopeId} from "./scope";
import type {LibraryProvider} from "./providers";
import {collectionsProvider} from "./collectionsProvider";
import {nativeExpressionsProvider} from "./nativeExpressionsProvider";
import {kernelOp} from "../kernel/bridge";

export interface LibraryReadingEntry {
  ref: string; title: string; kind: LibraryItem["kind"]; owner: string; scope: "local" | "shared";
  revision?: string; project?: string; expressionRef?: string;
  scenes?: {scene_ref: string; title: string}[];
  collections?: string[];
  collectionMemberships?: {title: string; group: string; manifest_path: string}[];
}
export interface LibraryReadingCoverage {provider: string; state: string; reason?: string}
export interface LibraryReadingResult {entries: LibraryReadingEntry[]; coverage: LibraryReadingCoverage[]}
export interface LibraryReadingRequest {scope?: "local" | "shared"}

const sanitize = (item: LibraryItem): LibraryReadingEntry => ({
  ref: item.ref, title: item.title, kind: item.kind, owner: item.owner, scope: item.scope,
  revision: item.revision, project: item.project, expressionRef: item.expressionRef,
  collections: item.nativeCollections,
  collectionMemberships: item.collectionMemberships?.map(m => ({title: m.title, group: m.group, manifest_path: m.manifest_path})),
});

const SCENE_READ_LIMIT = 64;
/** The Expression owner's own Scene list: refs and titles only. */
export async function expressionScenes(transport: KernelTransportStatus, expression_ref: string): Promise<{scene_ref: string; title: string}[]> {
  const result = await kernelOp(transport, {op: "expression", request: {operation: "inspect", expression_ref}} as never) as {error?: string; outcome?: {result?: string; data?: {document?: {expression_ref?: string; scenes?: {scene_ref: string; title?: string}[]}}}};
  const document = result.outcome?.result === "expression" ? result.outcome.data?.document : undefined;
  if (!document || document.expression_ref !== expression_ref || !Array.isArray(document.scenes)) throw new Error(result.error ?? "The Expression owner returned no Scenes");
  return document.scenes.map(scene => ({scene_ref: scene.scene_ref, title: typeof scene.title === "string" && scene.title.trim() ? scene.title : "Untitled Scene"}));
}
/** `providers` is injectable (tests exercise this adapter against a
 * controlled in-memory fixture, never the real transport-backed providers —
 * see tests/library-reading.test.mjs). Defaults to the real built-in pair
 * relayKernelChannel actually wants read. */
export async function readLibrary(
  transport: KernelTransportStatus,
  request: LibraryReadingRequest,
  signal?: AbortSignal,
  providers?: LibraryProvider[],
  scenes?: (expressionRef: string) => Promise<{scene_ref: string; title: string}[]>,
): Promise<LibraryReadingResult> {
  const scope: LibraryScopeId = request.scope === "shared" ? "shared" : "local";
  const effectiveSignal = signal ?? new AbortController().signal;
  const list = providers ?? [collectionsProvider(transport), nativeExpressionsProvider(transport)];
  const query = {scope, mode: "techne" as const, text: ""};
  const results = await Promise.all(list.map(provider =>
    provider.list(query, effectiveSignal).catch((cause): {items: LibraryItem[]; coverage: LibraryReadingCoverage} => ({
      items: [], coverage: {provider: provider.id, state: "unavailable", reason: cause instanceof Error ? cause.message : String(cause)},
    })),
  ));
  const seen = new Map<string, LibraryReadingEntry>();
  for (const result of results) for (const item of result.items) {
    // The shared horizon carries only what a provider itself disclosed as
    // reachable there — never every local read relabelled shared.
    if (scope === "shared" && item.scope !== "local" && item.scope !== "shared") continue;
    if (!seen.has(item.ref)) seen.set(item.ref, sanitize(item));
  }
  const entries = [...seen.values()], targets = entries.filter(entry => (entry.expressionRef ?? entry.ref).startsWith("expression:")).slice(0, SCENE_READ_LIMIT);
  const read = scenes ?? ((ref: string) => expressionScenes(transport, ref));
  let next = 0;
  await Promise.all(Array.from({length: Math.min(4, targets.length)}, async () => {
    while (next < targets.length && !effectiveSignal.aborted) {
      const entry = targets[next++];
      try { entry.scenes = await read(entry.expressionRef ?? entry.ref); } catch { /* undisclosed, not empty */ }
    }
  }));
  return {entries, coverage: results.map(result => result.coverage)};
}
