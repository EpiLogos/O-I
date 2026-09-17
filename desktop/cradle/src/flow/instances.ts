import {listFiles,readFile,fileOperation,type FileMutation} from "../files/client";
import type {CentralLocation,KernelTransportStatus,NativeDirectory} from "../kernel/types";
import {parseInstance,type QlDoc} from "./instance";
/** The ratified flow carrier's owner routes: instances are ordinary files in
 * `Control/user/flows/` — listed through `central.files.list`, read through
 * `central.files.read`, created and saved through `central.files.write`
 * (absent file + empty expected revision = create; otherwise a
 * revision-checked CAS write whose conflict returns the owner's current
 * bytes). The desktop never invents a flow identity: it comes from the
 * document itself. */
export const USER_FLOWS_DIR = "Control/user/flows";
export interface FlowInstanceRow { name: string; location: CentralLocation; byte_len: number }
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
export async function readFlowInstance(transport: KernelTransportStatus, location: CentralLocation): Promise<FlowInstance> {
  const reading = await readFile(transport, location);
  return { html: reading.content, revision: reading.revision, location, doc: parseInstance(reading.content) };
}
export type InstanceWrite = FileMutation;
export async function writeFlowInstance(transport: KernelTransportStatus, location: CentralLocation, expectedRevision: string, html: string): Promise<InstanceWrite> {
  return fileOperation<InstanceWrite>(transport, location, { action: "write", expected_revision: expectedRevision, content: html });
}
