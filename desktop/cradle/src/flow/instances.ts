import {listFiles,readFile,fileOperation,type FileMutation} from "../files/client";
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation,KernelTransportStatus} from "../kernel/types";
import {parseInstance,type QlDoc} from "./instance";
export {USER_FLOWS_DIR,listFlowInstances,type FlowInstanceRow} from "./flowsDir";
export interface UserFlowsArea { root: string; baseRef: string; basePath: string }
/** The user area's owner-canonical identity, taken from the owner's own
 * listing (the navigator's root string may be a non-canonical path; the
 * listing's location never lies about the root it serves). */
export async function userFlowsArea(transport: KernelTransportStatus): Promise<UserFlowsArea> {
  const directory = await listFiles(transport, "Control/user");
  return { root: directory.location.root, baseRef: directory.location.ref, basePath: directory.location.path };
}
export interface FlowInstance {
  html: string;
  revision: string;
  location: CentralLocation;
  doc: QlDoc;
}
/** A Flow read through Central's file owner. `fresh` asks the owner again whatever the window holds (readFile's own flag): the read an
 * explicit Re-read makes, never an ordinary open (O-I #820). */
export async function readFlowInstance(transport: KernelTransportStatus, location: CentralLocation, fresh = false): Promise<FlowInstance> {
  const reading = await readFile(transport, location, fresh);
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
