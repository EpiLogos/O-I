/** Explicit selection revalidates membership, disclosure and source identity.
 * This is a consumer of the files seam, not a second source/Expression store. */
import {readCollection, sameCollectionLocation} from "../expressions/collectionReadings";
import type {KernelTransportStatus} from "../kernel/types";
import type {LibraryItem} from "./scope";

export async function resolveCollectionSelection(transport: KernelTransportStatus, item: LibraryItem, signal?: AbortSignal): Promise<LibraryItem> {
  const occurrence = item.collectionMemberships?.[0];
  if (!occurrence) return item;
  if (!item.sourceLocation || item.ref !== item.sourceLocation.ref) throw new Error("Collection selection does not retain its native source identity");
  const reading = await readCollection(transport, occurrence.manifest_path, {
    offset: occurrence.slot, limit: 1, expectedRevision: occurrence.manifest_revision, signal, fresh: true,
  });
  if (reading.status !== "ready") throw new Error(reading.message);
  if (reading.coverage.cancelled) throw new Error("Collection selection cancelled");
  if (!reading.basis || !sameCollectionLocation(reading.basis.location, occurrence.manifest_location)) throw new Error("Collection manifest source identity changed; refresh the Library");
  const member = reading.members[0];
  if (!member) throw new Error(reading.errors[0]?.message ?? "Collection member is no longer available");
  if (member.id !== occurrence.member_id || member.file !== occurrence.file || !member.location || !sameCollectionLocation(member.location, item.sourceLocation)) throw new Error("Collection member source identity changed; refresh the Library");
  if (item.revision !== undefined && item.revision !== member.source_revision) throw new Error("Collection member source revision changed; refresh the Library");
  return {...item, revision: member.source_revision};
}
