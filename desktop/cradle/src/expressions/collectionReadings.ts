/**
 * Collection readings — the cradle-side bridge for Central-backed
 * collection manifests (the Expressions library refit, manifest gaps
 * D1 + D3). Given a Central-relative manifest path, this module resolves
 * and reads the manifest and its members through the files seam
 * (`listFiles`/`readFile` — the same owner seam every surface reads
 * through) and returns one honest reading: the envelope, the members in
 * manifest order, and every failure NAMED. An absent manifest is a named
 * absence; a refused read carries the owner's refusal verbatim. Nothing
 * is flattened into loose expressions and nothing is dropped silently.
 *
 * THE DATA PATH IS A PURE FUNCTION OF FILE CONTENT: `assembleCollectionReading`
 * takes the manifest text plus an injected member reader, so the generic
 * host→frame `central-read` relay (Landing lane M) and this module's direct
 * files-seam call feed it identically — the final wiring choice belongs to
 * the parent thread. The manifest and provenance LAW lives in the
 * application itself (expressions-app/field-studies-journeys/src/model.ts —
 * validateCollectionManifest / collectionMembership); the structural shapes
 * below are its transport mirror (the app source cannot be imported into
 * the cradle bundle — its engine tree is typed under a different lib — so
 * the mirror is kept honest by walk/collection-manifest-probe.mjs, which
 * reads the SAME real manifest through both laws).
 */
import {listFiles, readFile} from "../files/client";
import type {CentralLocation, KernelTransportStatus, NativeDirectory, NativeFileReading} from "../kernel/types";

export const COLLECTION_MANIFEST_SCHEMA = "oi.legacy-collections/v1";
export const COLLECTION_PROVENANCE_SCHEMA = "oi.collection-provenance/v1";

/** Transport mirrors of the application's manifest law (model.ts). */
export interface CollectionProvenance {
  schema?: string; register?: string; root?: string; paths?: string[];
  ground?: string; exported_at?: string;
  generator?: {name?: string; revision?: string; [key: string]: unknown};
  [key: string]: unknown;
}
export interface CollectionManifestEntry {id?: unknown; name?: unknown; file?: unknown; group?: unknown}
export interface CollectionManifestEnvelope {
  schema: string; exported_at?: string; source?: string;
  provenance?: CollectionProvenance;
  featured?: CollectionManifestEntry[];
  starters?: CollectionManifestEntry[];
  [key: string]: unknown;
}
/** One member handed to the application in manifest order — the content is
 * the parsed journey document; the application validates it under its own
 * journey law at import (D3). `location` is the member's own disclosed
 * Central location when the reading came through the files seam (absent on
 * the pure core, which sees contents only). */
export interface CollectionMemberContent {
  slot: number; id: string; name: string; group: string; file: string;
  content: unknown;
  location?: CentralLocation;
  source_revision?: string;
  /** Discovery resolves the source address without reading its body. */
  content_state?: "loaded" | "deferred";
}
export interface CollectionReadingError {slot: number; id: string; file: string; message: string}
export interface CollectionReadOptions {
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
  readContents?: boolean;
  /** Refuse mixing pages from different manifest revisions. */
  expectedRevision?: string;
  fresh?: boolean;
}
export interface CollectionReadCoverage {
  total: number; offset: number; attempted: number; failed: number;
  next_offset: number | null; complete: boolean; cancelled: boolean;
  content: "read" | "deferred";
}
export const COLLECTION_PAGE_SIZE = 64;
export type CollectionReading =
  | {status: "ready"; manifest_path: string; envelope: CollectionManifestEnvelope; members: CollectionMemberContent[]; errors: CollectionReadingError[]; coverage: CollectionReadCoverage; basis?: {location: CentralLocation; revision: string}}
  | {status: "manifest-absent"; manifest_path: string; message: string}
  | {status: "unavailable"; manifest_path: string; message: string};

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** The manifest's membership in manifest order — featured first, then the
 * starters in their listed groups; the same order the application's
 * collectionMembership derives (the law of record sits there). */
function membershipOf(envelope: CollectionManifestEnvelope): Array<{slot: number; entry: CollectionManifestEntry; group: string}> {
  const rows: Array<{slot: number; entry: CollectionManifestEntry; group: string}> = [];
  const ids = new Set<string>();
  for (const key of ["featured", "starters"] as const) {
    const entries = envelope[key] ?? [];
    if (!Array.isArray(entries)) throw new Error(`Manifest ${key} must be a list of member entries.`);
    for (const entry of entries) {
      const slot = rows.length;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Manifest ${key} entry at slot ${slot} is not an object.`);
      if (typeof entry.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(entry.id)) throw new Error(`Manifest ${key} entry at slot ${slot} has an invalid id.`);
      if (ids.has(entry.id)) throw new Error(`Manifest names "${entry.id}" more than once; membership would be ambiguous.`);
      ids.add(entry.id);
      if (!safeRelativePath(entry.file)) throw new Error(`Manifest entry ${entry.id} names an unsafe member path.`);
      if (entry.name !== undefined && (typeof entry.name !== "string" || entry.name.length > 300)) throw new Error(`Manifest entry ${entry.id} has an invalid name.`);
      if (entry.group !== undefined && (typeof entry.group !== "string" || entry.group.length > 120)) throw new Error(`Manifest entry ${entry.id} has an invalid group.`);
      rows.push({slot, entry, group: typeof entry.group === "string" ? entry.group : key === "featured" ? "Featured" : "Starters"});
    }
  }
  return rows;
}

/** Files-seam addresses are relative paths, not URLs or absolute OS paths. */
export function safeRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !value.startsWith("/")
    && !/[\\\u0000-\u001f\u007f]/.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value)
    && !value.split("/").some(segment => segment === ".." || segment === "");
}

function inspectEnvelope(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error("Document nesting is too deep.");
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite value.");
  if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe document key.");
    inspectEnvelope(child, depth + 1);
  }
}

/** Envelope law mirrors model.validateCollectionManifest. Unknown additive
 * provenance remains verbatim; it is not promoted to known provenance. */
function validateMetadata(envelope: CollectionManifestEnvelope): void {
  const string = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
  if (envelope.exported_at !== undefined && !string(envelope.exported_at, 60)) throw new Error("Manifest exported_at is invalid.");
  if (envelope.source !== undefined && !string(envelope.source, 2000)) throw new Error("Manifest source is invalid.");
  if (envelope.retained_non_legacy !== undefined) {
    const retained = envelope.retained_non_legacy;
    if (!Array.isArray(retained) || retained.some(row => !row || typeof row !== "object" || typeof row.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(row.id) || !string(row.reason, 500))) throw new Error("Manifest retained_non_legacy is invalid.");
  }
  const p = envelope.provenance;
  if (p !== undefined && (!p || typeof p !== "object" || Array.isArray(p))) throw new Error("Collection provenance must be an object envelope.");
  if (p?.schema === COLLECTION_PROVENANCE_SCHEMA) {
    for (const key of ["register", "root", "ground", "exported_at"] as const) if (typeof p[key] !== "string" || !p[key]) throw new Error(`Provenance envelope is missing its ${key}.`);
    if (!Array.isArray(p.paths) || !p.paths.length || p.paths.some(path => typeof path !== "string")) throw new Error("Provenance envelope is missing its paths.");
    if (!p.generator || typeof p.generator !== "object" || typeof p.generator.name !== "string" || !p.generator.name || typeof p.generator.revision !== "string" || !p.generator.revision) throw new Error("Provenance envelope is missing its generator and revision.");
  }
}

export function sameCollectionLocation(a: CentralLocation, b: CentralLocation): boolean {
  return a.schema === b.schema && a.ref === b.ref && a.root === b.root && a.path === b.path;
}

/**
 * PURE CORE — a collection reading as a function of file contents alone.
 * `manifestText` is the manifest document exactly as it was read;
 * `readMember` resolves one manifest-relative member path to the parsed
 * member document and may throw (its message is carried verbatim, named
 * with the member's slot, id and file). Feed this from the host relay or
 * from the files seam — the reading is the same.
 */
export async function assembleCollectionReading(
  manifestPath: string,
  manifestText: string,
  readMember: (manifestRelativeFile: string) => Promise<unknown>,
  options: CollectionReadOptions = {},
): Promise<CollectionReading> {
  let document: unknown;
  try {
    document = JSON.parse(manifestText);
  } catch (cause) {
    return {status: "unavailable", manifest_path: manifestPath, message: `the collection manifest at ${manifestPath} is not valid JSON: ${messageOf(cause)}`};
  }
  if (!document || typeof document !== "object" || Array.isArray(document) || (document as {schema?: unknown}).schema !== COLLECTION_MANIFEST_SCHEMA) {
    const declared = document && typeof document === "object" ? (document as {schema?: unknown}).schema : typeof document;
    return {status: "unavailable", manifest_path: manifestPath, message: `the document at ${manifestPath} is not a collection manifest (${COLLECTION_MANIFEST_SCHEMA}); it declares ${String(declared)}`};
  }
  const envelope = document as CollectionManifestEnvelope;
  let rows: ReturnType<typeof membershipOf>;
  const offset = options.offset ?? 0;
  // Discovery is allowed to enumerate membership without hydrating any member document.
  const limit = options.limit ?? (options.readContents === false ? Number.MAX_SAFE_INTEGER : COLLECTION_PAGE_SIZE);
  try {
    inspectEnvelope(envelope);
    validateMetadata(envelope);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1) throw new Error("Collection offset must be a non-negative integer and limit a positive integer.");
    rows = membershipOf(envelope);
    if (offset > rows.length) throw new Error(`Collection offset ${offset} exceeds membership ${rows.length}.`);
  } catch (cause) {
    return {status: "unavailable", manifest_path: manifestPath, message: messageOf(cause)};
  }
  const page = rows.slice(offset, offset + Math.min(limit, rows.length - offset));
  const members: CollectionMemberContent[] = [];
  const errors: CollectionReadingError[] = [];
  let attempted = 0;
  // Finite concurrent native reads; results remain in authored slot order.
  for (let start = 0; start < page.length && !options.signal?.aborted; start += 4) {
    const batch = await Promise.all(page.slice(start, start + 4).map(async ({slot, entry, group}) => {
      const id = entry.id as string, file = entry.file as string;
      try {
        const content = await readMember(file);
        if (options.readContents !== false && (!content || typeof content !== "object" || (content as {id?: unknown}).id !== id)) {
          throw new Error(`the file carries expression "${String((content as {id?: unknown} | null)?.id)}" where the manifest names "${id}"`);
        }
        return {member: {slot, id, name: typeof entry.name === "string" && entry.name ? entry.name : id, group, file, content, content_state: options.readContents === false ? "deferred" as const : "loaded" as const}};
      } catch (cause) {
        return {error: {slot, id, file, message: messageOf(cause)}};
      }
    }));
    attempted += batch.length;
    for (const result of batch) {
      if (result.member) members.push(result.member);
      if (result.error) errors.push(result.error);
    }
  }
  const next = offset + attempted;
  const cancelled = options.signal?.aborted === true;
  return {status: "ready", manifest_path: manifestPath, envelope, members, errors, coverage: {
    total: rows.length, offset, attempted, failed: errors.length,
    next_offset: next < rows.length ? next : null,
    complete: offset === 0 && next === rows.length && errors.length === 0 && !cancelled,
    cancelled, content: options.readContents === false ? "deferred" : "read",
  }};
}

/**
 * Read a collection manifest at a Central-relative path through the files
 * seam: list the manifest's directory (so an absence is named, not
 * guessed), read the manifest at its owner-disclosed location, then read
 * each member through its own disclosed location. Per-member absences and
 * refusals are named errors beside the members that did return.
 */
export async function readCollection(transport: KernelTransportStatus, manifestPath: string, options: CollectionReadOptions = {}): Promise<CollectionReading> {
  const unavailable = (message: string): CollectionReading => ({status: "unavailable", manifest_path: manifestPath, message});
  const checkCancelled = () => { if (options.signal?.aborted) throw new Error("collection read cancelled"); };
  const cut = manifestPath.lastIndexOf("/");
  if (!safeRelativePath(manifestPath) || cut <= 0) return unavailable(`${manifestPath} is not a Central-relative path with a directory`);
  const dir = manifestPath.slice(0, cut), name = manifestPath.slice(cut + 1);
  // Cache directory readings for this operation, NEVER one leaf's location
  // under its parent. Worlds, refreshes and revocations share no local cache.
  const directories = new Map<string, Promise<NativeDirectory>>();
  const directoryFor = (path: string): Promise<NativeDirectory> => {
    checkCancelled();
    let pending = directories.get(path);
    if (!pending) { pending = listFiles(transport, path, options.fresh === true); directories.set(path, pending); }
    return pending;
  };
  let directory: NativeDirectory;
  try { directory = await directoryFor(dir); checkCancelled(); }
  catch (cause) { return unavailable(messageOf(cause)); }
  const entry = directory.entries.find(candidate => candidate.name === name && candidate.kind === "file");
  if (!entry) return {status: "manifest-absent", manifest_path: manifestPath, message: `no collection manifest is present at ${manifestPath} — Central lists ${directory.entries.length} entries in ${dir}, none named ${name}`};
  if (entry.retrieval_allowed === false) return unavailable(`Central withholds retrieval of ${manifestPath}`);
  let manifest: NativeFileReading;
  try {
    manifest = await readFile(transport, entry.location); checkCancelled();
    if (!sameCollectionLocation(manifest.location, entry.location)) throw new Error(`Central returned a different source identity for ${manifestPath}`);
  } catch (cause) { return unavailable(messageOf(cause)); }
  if (options.expectedRevision !== undefined && options.expectedRevision !== manifest.revision) {
    return unavailable(`collection manifest changed: expected ${options.expectedRevision}, received ${manifest.revision}; restart the bounded reading`);
  }
  const sources = new Map<string, {location: CentralLocation; revision?: string}>();
  const reading = await assembleCollectionReading(manifestPath, manifest.content, async file => {
    checkCancelled();
    const path = `${dir}/${file}`;
    const memberCut = path.lastIndexOf("/");
    const parent = path.slice(0, memberCut), leaf = path.slice(memberCut + 1);
    const listed = await directoryFor(parent); checkCancelled();
    const found = listed.entries.find(candidate => candidate.name === leaf && candidate.kind === "file");
    if (!found) throw new Error(`the member file is not present at ${path} — Central lists ${listed.entries.length} entries in ${parent}, none named ${leaf}`);
    if (found.retrieval_allowed === false) throw new Error(`Central withholds retrieval of ${path}`);
    if (options.readContents === false) { sources.set(file, {location: found.location}); return undefined; }
    const body = await readFile(transport, found.location); checkCancelled();
    if (!sameCollectionLocation(body.location, found.location)) throw new Error(`Central returned a different source identity for ${path}`);
    sources.set(file, {location: body.location, revision: body.revision});
    return JSON.parse(body.content);
  }, options);
  if (reading.status === "ready") {
    reading.basis = {location: manifest.location, revision: manifest.revision};
    for (const member of reading.members) {
      const source = sources.get(member.file);
      if (source) { member.location = source.location; member.source_revision = source.revision; }
    }
  }
  return reading;
}
