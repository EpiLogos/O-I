/** Native-backed membership edits. No source copying, new collection store or
 * renderer authority: Expression CAS and Central file CAS remain the owners. */
import {kernelOp} from "../kernel/bridge";
import {fileOperation, readFile, type FileMutation} from "../files/client";
import {readCollection, sameCollectionLocation} from "../expressions/collectionReadings";
import type {ExpressionRequest, ExpressionResult} from "../expression/types";
import type {KernelTransportStatus} from "../kernel/types";
import type {CollectionMembership} from "./scope";

const ACTOR = "human:expression-editor";
async function expression(transport: KernelTransportStatus, request: ExpressionRequest): Promise<ExpressionResult> {
  const reply = await kernelOp(transport, {op: "expression", request});
  if (reply.error || reply.outcome?.result !== "expression") throw new Error(reply.error ?? "Native Expression operation unavailable");
  return reply.outcome.data;
}

export async function setNativeCollections(transport: KernelTransportStatus, ref: string, expectedRevision: number, collections: string[]): Promise<ExpressionResult> {
  if (!ref.startsWith("expression:") || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error("An exact native Expression ref and revision are required");
  const result = await expression(transport, {operation: "edit", expression_ref: ref, expected_revision: expectedRevision, actor: ACTOR, changes: [{change: "collections_set", collections}]});
  if (result.state !== "ready" || result.document?.expression_ref !== ref) throw new Error(`Collection edit ${result.state ?? "returned no document"}; refresh before retrying`);
  return result;
}

/** Save is a separate deliberate act. A live edit is never labelled saved.
 * Never manufacture a location for an Expression without a native file binding. */
export async function saveNativeCollectionMember(transport: KernelTransportStatus, ref: string, expectedRevision: number): Promise<ExpressionResult> {
  const reading = await expression(transport, {operation: "inspect", expression_ref: ref});
  if (reading.state !== "ready" || reading.document?.expression_ref !== ref || reading.document.revision !== expectedRevision) throw new Error("Expression revision changed; refresh before saving");
  if (!reading.file) throw new Error("This Expression has no native file binding; choose its source in the Expression editor before saving");
  const saved = await expression(transport, {operation: "save", expression_ref: ref, expected_revision: expectedRevision, location: reading.file.location, expected_file_revision: reading.file.revision, actor: ACTOR, actor_kind: "human"});
  if (saved.state !== "saved") throw new Error(`Expression ${saved.state ?? "save unavailable"}; live edits are retained, source save was not confirmed`);
  try {
    const verified = await expression(transport, {operation: "inspect", expression_ref: ref});
    if (verified.dirty !== false || verified.document?.revision !== expectedRevision || verified.file?.revision !== saved.file?.revision) throw new Error("subsequent readback changed");
    return verified;
  } catch (cause) {
    throw new Error(`Source saved at ${saved.file?.revision ?? "the returned revision"}, but readback was not confirmed: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

export type ManifestMembershipChange =
  | {kind: "rename"; title: string}
  | {kind: "move"; direction: "earlier" | "later"}
  | {kind: "remove"};
export interface ManifestMembershipResult {state: "saved" | "unchanged" | "saved_unverified"; revision: string; message?: string}

/** Edit a reference in an existing authored manifest. Removing a membership
 * never deletes the member source. Unknown provenance/fields survive intact. */
export async function editManifestMembership(transport: KernelTransportStatus, membership: CollectionMembership, change: ManifestMembershipChange): Promise<ManifestMembershipResult> {
  const reading = await readCollection(transport, membership.manifest_path, {readContents: false, fresh: true, expectedRevision: membership.manifest_revision});
  if (reading.status !== "ready") throw new Error(reading.message);
  if (!reading.basis || !sameCollectionLocation(reading.basis.location, membership.manifest_location)) throw new Error("Manifest source identity changed; refresh before editing");
  const envelope = structuredClone(reading.envelope);
  const featured = envelope.featured ?? [];
  const group = membership.slot < featured.length ? featured : envelope.starters ?? [];
  const index = membership.slot < featured.length ? membership.slot : membership.slot - featured.length;
  const entry = group[index];
  if (!entry || entry.id !== membership.member_id || entry.file !== membership.file) throw new Error("Manifest membership changed; refresh before editing");
  if (change.kind === "rename") {
    if (!change.title.trim() || change.title.length > 300) throw new Error("Collection label must contain 1–300 characters");
    entry.name = change.title;
  } else if (change.kind === "remove") group.splice(index, 1);
  else {
    const destination = index + (change.direction === "earlier" ? -1 : 1);
    if (destination < 0 || destination >= group.length) return {state: "unchanged", revision: membership.manifest_revision};
    [group[index], group[destination]] = [group[destination], group[index]];
  }
  const content = JSON.stringify(envelope, null, 2) + "\n";
  const result = await fileOperation<FileMutation>(transport, membership.manifest_location, {action: "write", expected_revision: membership.manifest_revision, content});
  if ((result.outcome !== "written" && result.outcome !== "unchanged") || !result.revision) throw new Error(`Manifest ${result.outcome ?? "write refused"}; refresh before retrying`);
  // Report an already-completed write truthfully even when later readback is
  // refused or another writer changes the source immediately afterwards.
  try {
    const current = await readFile(transport, membership.manifest_location);
    if (!sameCollectionLocation(current.location, membership.manifest_location) || current.revision !== result.revision || current.content !== content) throw new Error("source changed after the write");
  } catch (cause) {
    return {state: "saved_unverified", revision: result.revision, message: `Saved at ${result.revision}; readback not confirmed: ${cause instanceof Error ? cause.message : String(cause)}`};
  }
  return {state: "saved", revision: result.revision};
}
