import {listFiles,readFile,fileOperation,type FileMutation} from "../files/client";
import {kernelOp} from "../kernel/bridge";
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
/** Whether a Flow stands in a project's human ground (a world's folder, T-WORLDS W2): Central keeps it as a participating source,
 * which `central.files.write` refuses ("Protected ground … must use its native authored operation"; Central ctrl/src/file_mutation.rs
 * ordinary_policy), so it is written through the source owner's own CAS, as document/hostSave.ts and kernel/src/page.rs write one. */
export const inProjectGround = (location: Pick<CentralLocation, "path">): boolean => /^Work\/[^/]+\/ProjectCentral\//.test(location.path);
interface SourceDispatch {error?: string; outcome?: {result: string; dispatch?: {state: string; message?: string; detail?: string; data?: unknown}}}
async function sourceAction(transport: KernelTransportStatus, action: string, sourceRef: string, input: Record<string, unknown>): Promise<unknown> {
  const response = await kernelOp(transport, {op: "invoke_action", invocation: {action, target_ref: sourceRef, input}}) as SourceDispatch;
  if (response.outcome?.result !== "action_dispatched") throw new Error(response.error ?? "the kernel returned no dispatch outcome");
  const dispatch = response.outcome.dispatch;
  if (dispatch?.state !== "invoked") throw new Error(`The source owner refused the Flow's write: ${dispatch?.message ?? dispatch?.detail ?? `it did not invoke ${action}`}`);
  return dispatch.data;
}
/** A Flow written on the revision read: Central's file CAS for a Flow in Control/user/flows; for a Flow in a project's human ground,
 * the source owner's CAS on its own revision, the file read again first — a file that moved past `expectedRevision`, or a source that
 * differs from it, is a conflict and nothing is written. Either way the answer is the file mutation's shape. */
export async function writeFlowInstance(transport: KernelTransportStatus, location: CentralLocation, expectedRevision: string, html: string): Promise<InstanceWrite> {
  if (!inProjectGround(location)) return fileOperation<InstanceWrite>(transport, location, { action: "write", expected_revision: expectedRevision, content: html });
  const now = await readFile(transport, location);
  const sourceRef = now.source?.ref;
  if (!sourceRef) return fileOperation<InstanceWrite>(transport, location, { action: "write", expected_revision: expectedRevision, content: html });
  if (now.revision !== expectedRevision) return {outcome: "conflict", current: now};
  if (now.content === html) return {outcome: "unchanged", revision: now.revision};
  const project = now.project?.name ?? null;
  const owner = await sourceAction(transport, "projectcentral.source.read", sourceRef, {project, source_ref: sourceRef}) as {revision?: {revision?: string}; content?: string} | undefined;
  if (typeof owner?.revision?.revision !== "string" || owner.content !== now.content) return {outcome: "conflict", current: now};
  await sourceAction(transport, "projectcentral.source.write", sourceRef, {project, source_ref: sourceRef, expected_revision: owner.revision.revision, content: html,
    actor: "oi-desktop-user", actor_kind: "human"});
  const after = await readFile(transport, location);
  return {outcome: "written", revision: after.revision, ...(after.content === html ? {} : {current: after})};
}
