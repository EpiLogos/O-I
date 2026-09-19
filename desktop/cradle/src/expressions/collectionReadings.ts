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
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";

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
}
export interface CollectionReadingError {slot: number; id: string; file: string; message: string}
export type CollectionReading =
  | {status: "ready"; manifest_path: string; envelope: CollectionManifestEnvelope; members: CollectionMemberContent[]; errors: CollectionReadingError[]}
  | {status: "manifest-absent"; manifest_path: string; message: string}
  | {status: "unavailable"; manifest_path: string; message: string};

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/** The manifest's membership in manifest order — featured first, then the
 * starters in their listed groups; the same order the application's
 * collectionMembership derives (the law of record sits there). */
function membershipOf(envelope: CollectionManifestEnvelope): Array<{slot: number; entry: CollectionManifestEntry; group: string}> {
  const featured = (envelope.featured ?? []).map((entry) => ({entry, group: typeof entry.group === "string" && entry.group ? entry.group : "Featured"}));
  const starters = (envelope.starters ?? []).map((entry) => ({entry, group: typeof entry.group === "string" && entry.group ? entry.group : "Starters"}));
  return [...featured, ...starters].map((row, slot) => ({slot, ...row}));
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
  const members: CollectionMemberContent[] = [];
  const errors: CollectionReadingError[] = [];
  for (const {slot, entry, group} of membershipOf(envelope)) {
    const id = typeof entry.id === "string" ? entry.id : "";
    const file = typeof entry.file === "string" ? entry.file : "";
    if (!id || !file || file.startsWith("/") || file.split("/").some((segment) => segment === "..")) {
      errors.push({slot, id, file, message: "the manifest entry does not name a readable member file"});
      continue;
    }
    try {
      members.push({slot, id, name: typeof entry.name === "string" && entry.name ? entry.name : id, group, file, content: await readMember(file)});
    } catch (cause) {
      errors.push({slot, id, file, message: messageOf(cause)});
    }
  }
  return {status: "ready", manifest_path: manifestPath, envelope, members, errors};
}

/**
 * Read a collection manifest at a Central-relative path through the files
 * seam: list the manifest's directory (so an absence is named, not
 * guessed), read the manifest at its owner-disclosed location, then read
 * each member through its own disclosed location. Per-member absences and
 * refusals are named errors beside the members that did return.
 */
export async function readCollection(transport: KernelTransportStatus, manifestPath: string): Promise<CollectionReading> {
  const cut = manifestPath.lastIndexOf("/");
  if (cut <= 0) return {status: "unavailable", manifest_path: manifestPath, message: `${manifestPath} is not a Central-relative path with a directory`};
  const dir = manifestPath.slice(0, cut);
  const name = manifestPath.slice(cut + 1);
  let directory;
  try {
    directory = await listFiles(transport, dir);
  } catch (cause) {
    return {status: "unavailable", manifest_path: manifestPath, message: messageOf(cause)};
  }
  const entry = directory.entries.find((candidate) => candidate.name === name && candidate.kind === "file");
  if (!entry) {
    return {status: "manifest-absent", manifest_path: manifestPath, message: `no collection manifest is present at ${manifestPath} — Central lists ${directory.entries.length} entries in ${dir}, none named ${name}`};
  }
  let manifestText: string;
  try {
    manifestText = (await readFile(transport, entry.location)).content;
  } catch (cause) {
    return {status: "unavailable", manifest_path: manifestPath, message: messageOf(cause)};
  }
  const locations = new Map<string, Promise<CentralLocation>>();
  const locationFor = (path: string): Promise<CentralLocation> => {
    const memberCut = path.lastIndexOf("/");
    if (memberCut <= 0) return Promise.reject(new Error(`the member path ${path} has no Central directory`));
    const parent = path.slice(0, memberCut);
    const leaf = path.slice(memberCut + 1);
    let listing = locations.get(parent);
    if (!listing) {
      listing = listFiles(transport, parent).then((listed) => {
        const found = listed.entries.find((candidate) => candidate.name === leaf && candidate.kind === "file");
        if (!found) throw new Error(`the member file is not present at ${path} — Central lists ${listed.entries.length} entries in ${parent}, none named ${leaf}`);
        return found.location;
      });
      locations.set(parent, listing);
    }
    return listing;
  };
  const memberLocations = new Map<string, CentralLocation>();
  const reading = await assembleCollectionReading(manifestPath, manifestText, async (file) => {
    const location = await locationFor(`${dir}/${file}`);
    memberLocations.set(file, location);
    return JSON.parse((await readFile(transport, location)).content);
  });
  if (reading.status === "ready") {
    for (const member of reading.members) {
      const location = memberLocations.get(member.file);
      if (location) member.location = location;
    }
  }
  return reading;
}
