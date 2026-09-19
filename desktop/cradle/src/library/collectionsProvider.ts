/**
 * Collections provider — the Library's reading of Central-backed collection
 * manifests (the Expressions library refit, manifest gaps D1 + D3). Each
 * project's `ProjectCentral/user/collections/` directory is scanned for
 * `*.manifest.json` envelopes; every manifest is read through the files
 * seam via `readCollection` (src/expressions/collectionReadings.ts — the
 * same owner seam every surface reads through), and each member becomes
 * one Library item whose `sourceLocation` is the member's own disclosed
 * Central location.
 *
 * Nothing here is a catalogue of its own: an absent collections directory
 * is an ordinary project (no items, no coverage noise); a manifest that is
 * present but unreadable is a NAMED absence, verbatim from the reading;
 * per-member failures ride beside the members that did return as partial
 * coverage. The manifest and provenance LAW lives in the application
 * (expressions-app/field-studies-journeys/src/model.ts); this provider only
 * carries what the reading disclosed.
 */
import {listFiles} from "../files/client";
import {readCollection} from "../expressions/collectionReadings";
import type {KernelTransportStatus} from "../kernel/types";
import type {LibraryCoverage, LibraryItem, LibraryQuery} from "./scope";
import type {LibraryProvider} from "./providers";

/** The Central-relative per-project directory where collection manifests
 * live, and the layout the reader expects beneath it (manifests at the
 * top, member files in subdirectories — manifest-relative member paths
 * never cross upward). */
export const COLLECTIONS_DIR = "ProjectCentral/user/collections";

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export function collectionsProvider(transport: KernelTransportStatus): LibraryProvider {
  return {
    id: "collections", label: "Collections", kinds: ["composition"], scopes: ["local"],
    async list(_query: LibraryQuery, signal): Promise<{items: LibraryItem[]; coverage: LibraryCoverage}> {
      let work;
      try {
        work = await listFiles(transport, "Work");
      } catch (cause) {
        return {items: [], coverage: {provider: "collections", state: "unavailable", reason: messageOf(cause)}};
      }
      const items: LibraryItem[] = [];
      const refusals: string[] = [];
      const partials: string[] = [];
      let manifestCount = 0;
      for (const projectEntry of work.entries) {
        if (signal.aborted) return {items: [], coverage: {provider: "collections", state: "unavailable", reason: "query cancelled"}};
        if (projectEntry.kind !== "directory") continue;
        const manifestDir = `Work/${projectEntry.name}/${COLLECTIONS_DIR}`;
        let listing;
        try {
          listing = await listFiles(transport, manifestDir);
        } catch {
          continue; // a project with no collections directory is ordinary, not a failure
        }
        for (const entry of listing.entries) {
          if (entry.kind !== "file" || !entry.name.endsWith(".manifest.json")) continue;
          manifestCount += 1;
          const manifestPath = `${manifestDir}/${entry.name}`;
          const reading = await readCollection(transport, manifestPath);
          if (reading.status === "manifest-absent" || reading.status === "unavailable") {
            refusals.push(reading.message);
            continue;
          }
          const provenance = reading.envelope.provenance;
          const revision = typeof reading.envelope.exported_at === "string" ? reading.envelope.exported_at : undefined;
          for (const member of reading.members) {
            items.push({
              kind: "composition",
              ref: `collection:${manifestPath}#${member.id}`,
              title: member.name,
              summary: `Collection member — ${member.group} (${entry.name})`,
              owner: typeof provenance?.root === "string" && provenance.root ? provenance.root : projectEntry.name,
              scope: "local",
              revision,
              project: projectEntry.name,
              sourceLocation: member.location,
              provider: "collections",
            });
          }
          if (reading.errors.length > 0) {
            partials.push(`${entry.name}: ${reading.errors.length} member(s) unreadable — ${reading.errors[0]?.message ?? ""}`);
          }
        }
      }
      if (refusals.length > 0) {
        return {items, coverage: {provider: "collections", state: "unavailable", reason: refusals.join("; ")}};
      }
      if (partials.length > 0) {
        return {items, coverage: {provider: "collections", state: "partial", reason: partials.join("; ")}};
      }
      return {items, coverage: {provider: "collections", state: "complete"}};
    },
  };
}
