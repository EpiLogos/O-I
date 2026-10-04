import {listFiles,readFile,fileOperation,type FileMutation} from "../files/client";
import type {CentralLocation,KernelTransportStatus,NativeDirectory,NativeFileReading} from "../kernel/types";
import {parseInstance,type QlDoc} from "./instance";
import type {SurfaceBinding} from "../surface/types";
/** The ratified flow carrier's owner routes: instances are ordinary files in
 * `Control/user/flows/` — listed through `central.files.list`, read through
 * `central.files.read`, created and saved through `central.files.write`
 * (absent file + empty expected revision = create; otherwise a
 * revision-checked CAS write whose conflict returns the owner's current
 * bytes). The desktop never invents a flow identity: it comes from the
 * document itself. */
export const USER_FLOWS_DIR = "Control/user/flows";
export interface FlowInstanceOpen { name: string; location: CentralLocation; expectedDocumentId?: string }
export interface FlowInstanceRow extends FlowInstanceOpen { byte_len: number }
/** An exact Run link may not silently open a different document at its path.
 * Check the same actual file read which registers the native surface open. */
export class FlowDocumentIdentityError extends Error {
  constructor() {
    super("A different Flow now occupies this Run's retained location. Read the Run Flow basis again.");
    this.name = "FlowDocumentIdentityError";
  }
}
function assertDocumentIdentity(doc: QlDoc, expectedDocumentId?: string): void {
  if (expectedDocumentId !== undefined && doc?.meta?.documentId !== expectedDocumentId)
    throw new FlowDocumentIdentityError();
}
export function assertFlowInstanceIdentity(reading: NativeFileReading, expectedDocumentId?: string): void {
  if (expectedDocumentId !== undefined) assertDocumentIdentity(parseInstance(reading.content), expectedDocumentId);
}
/** A retained surface and its draft belong to the same opening contract.
 * A Run link cannot borrow a navigator surface, or a different document's
 * concealed surface, merely because their file paths currently coincide. */
export function matchesFlowInstanceOpen(binding: Pick<SurfaceBinding, "kind" | "location" | "flow">, row: FlowInstanceOpen): boolean {
  return binding.kind === "flow" && binding.location?.ref === row.location.ref &&
    binding.flow?.expectedDocumentId === row.expectedDocumentId;
}
export interface UserFlowsArea { root: string; baseRef: string; basePath: string }
/** The user area's owner-canonical identity, taken from the owner's own
 * listing (the navigator's root string may be a non-canonical path; the
 * listing's location never lies about the root it serves). */
export async function userFlowsArea(transport: KernelTransportStatus): Promise<UserFlowsArea> {
  const directory = await listFiles(transport, "Control/user");
  return { root: directory.location.root, baseRef: directory.location.ref, basePath: directory.location.path };
}
export async function listFlowInstances(transport: KernelTransportStatus): Promise<FlowInstanceRow[]> {
  let directory: NativeDirectory;
  try {
    directory = await listFiles(transport, USER_FLOWS_DIR);
  } catch (reason) {
    // The owner refuses a listing of a directory that does not exist: that
    // is exactly what "nothing remembered/written yet" looks like.
    if (/No such file or directory/i.test(String(reason))) return [];
    throw reason;
  }
  return directory.entries
    .filter(e => e.kind === "file" && /\.html$/i.test(e.name))
    .map(e => ({ name: e.name, location: e.location, byte_len: e.byte_len }));
}
export interface FlowInstance {
  html: string;
  revision: string;
  location: CentralLocation;
  doc: QlDoc;
}
/** The actual initial and subsequent surface reads share this boundary.
 * Same-document changes remain readable; a path replacement cannot become
 * this Run's bound Flow, even after the frame's earlier opening read. */
export function flowInstanceFromReading(reading: NativeFileReading, location: CentralLocation, expectedDocumentId?: string): FlowInstance {
  const doc = parseInstance(reading.content);
  assertDocumentIdentity(doc, expectedDocumentId);
  return { html: reading.content, revision: reading.revision, location, doc };
}
export async function readFlowInstance(transport: KernelTransportStatus, location: CentralLocation, expectedDocumentId?: string): Promise<FlowInstance> {
  return flowInstanceFromReading(await readFile(transport, location), location, expectedDocumentId);
}
export type InstanceWrite = FileMutation;
export async function writeFlowInstance(transport: KernelTransportStatus, location: CentralLocation, expectedRevision: string, html: string): Promise<InstanceWrite> {
  return fileOperation<InstanceWrite>(transport, location, { action: "write", expected_revision: expectedRevision, content: html });
}
