/**
 * The document save router (DOCUMENT-SURFACE.md).
 *
 * One relation for persisting an edited payload island through the native
 * owner, whatever the file's standing: ordinary files keep the existing
 * CAS file operation; participating sources (a project's human ground —
 * its vision page, its mockups) route through the owner's own
 * `projectcentral.source.*` Actions with the same expected-revision law.
 * Every unhappy path is a named state; nothing overwrites silently.
 */

import { kernelOp } from "../kernel/bridge";
import type { KernelTransportStatus, NativeFileReading } from "../kernel/types";
import { fileOperation, type FileMutation } from "../files/client";
import { invalidateFile, acquireFileReading, captureFileResourceAccess } from "../files/resources";
import { islandSpan, type DocumentIdentity } from "./identity";

export const DESKTOP_ACTOR = "oi-desktop-user";
export const DESKTOP_ACTOR_KIND = "human";

export type DocumentSaveOutcome =
  | { state: "saved"; revision?: string; sourceRevision?: string; readback: "verified" | "unavailable"; detail?: string }
  | { state: "unchanged" }
  | { state: "stale"; detail: string }
  | { state: "conflict"; detail: string; currentRevision?: string }
  | { state: "refused"; detail: string };

interface DispatchReply {
  error?: string;
  outcome?: { result: string; dispatch?: { state: string; owner_operation?: string; message?: string; detail?: string; data?: unknown } };
}

async function dispatchAction(transport: KernelTransportStatus, action: string, targetRef: string, input: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; message?: string }> {
  const response = await kernelOp(transport, { op: "invoke_action", invocation: { action, target_ref: targetRef, input } }) as DispatchReply;
  if (response.outcome?.result !== "action_dispatched") throw new Error(response.error ?? "the kernel returned no dispatch outcome");
  const dispatch = response.outcome.dispatch;
  if (dispatch?.state === "invoked") return { ok: true, data: dispatch.data };
  return { ok: false, message: dispatch?.message ?? dispatch?.detail ?? `the owner did not invoke ${action}` };
}

/** The authoritative owner reading for a participating source: reconciles
 * the owner's own horizon. Its revision is the CAS basis for the write. */
async function readWorldSource(transport: KernelTransportStatus, project: string | undefined, sourceRef: string): Promise<{ revision: string; content: string }> {
  const result = await dispatchAction(transport, "projectcentral.source.read", sourceRef, { project: project ?? null, source_ref: sourceRef });
  const reading = result.data as { revision?: { revision?: string }; content?: string } | undefined;
  const revision = reading?.revision?.revision;
  if (typeof revision !== "string" || typeof reading?.content !== "string") {
    throw new Error("The owner returned no readable source revision for this document");
  }
  return { revision, content: reading.content };
}

/** Save the frame's current payload island over the saved source.
 *
 * `basisFileRevision` is the revision the open frame was rendered from —
 * a save refuses as `stale` when the owner's file has moved past it. The
 * splice replaces only the island; every other byte of the saved source
 * (the template's) is carried through unchanged. */
export async function saveDocumentPayload(
  transport: KernelTransportStatus,
  args: {
    location: NonNullable<NativeFileReading["location"]>;
    project?: string;
    identity: DocumentIdentity;
    basisFileRevision: string;
    frameIslandText: string;
    isCurrent?: () => boolean;
  },
): Promise<{ outcome: DocumentSaveOutcome; reading?: NativeFileReading }> {
  const { location, project, identity, basisFileRevision, frameIslandText } = args;
  const access=captureFileResourceAccess(transport);
  const current=()=>{if(!access.current()||args.isCurrent?.()===false)throw Error("The document's originating subject or native access epoch has retired");};
  const ownerIO=async<T,>(run:()=>Promise<T>):Promise<T>=>{current();const result=await run();current();return result;};
  current();
  if (identity.payload !== "ql-doc") {
    return { outcome: { state: "refused", detail: "This document keeps no savable payload island; author it in source." } };
  }
  // Revalidation first, exactly like the file editor's read: drop the
  // broker's resident entry so this goes to the owner, not the cache.
  invalidateFile(location);
  const saved = await ownerIO(()=>acquireFileReading(transport, location));
  if (saved.revision !== basisFileRevision) {
    return { outcome: { state: "stale", detail: "The document changed behind this page. Reload to see it; nothing was overwritten." }, reading: saved };
  }
  const span = islandSpan(saved.content, "ql-doc");
  if (!span) {
    return { outcome: { state: "refused", detail: "The saved source no longer carries this document's payload island." }, reading: saved };
  }
  if (span.text === frameIslandText) {
    return { outcome: { state: "unchanged" }, reading: saved };
  }
  const content = saved.content.slice(0, span.start) + frameIslandText + saved.content.slice(span.end);

  const sourceRef = saved.source?.ref;
  if (sourceRef) {
    // Participating source: the owner's own CAS write. Its own read is the
    // authority for the revision basis; a divergence from the file we just
    // read is a conflict, never a guess about which one is true.
    const owner = await ownerIO(()=>readWorldSource(transport, project ?? saved.project?.name ?? undefined, sourceRef));
    if (owner.content !== saved.content) {
      return { outcome: { state: "conflict", detail: "The owner's source differs from the open file. Reload and review before saving.", currentRevision: owner.revision }, reading: saved };
    }
    const written = await ownerIO(()=>dispatchAction(transport, "projectcentral.source.write", sourceRef, {
      project: project ?? saved.project?.name ?? null,
      source_ref: sourceRef,
      expected_revision: owner.revision,
      content,
      actor: DESKTOP_ACTOR,
      actor_kind: DESKTOP_ACTOR_KIND,
    }));
    if (!written.ok) {
      return { outcome: { state: "refused", detail: `The owner refused this save: ${written.message}` }, reading: saved };
    }
    const receipt = written.data as { revision?: { revision?: string }; changed?: boolean } | undefined;
    invalidateFile(location);
    const reread = await ownerIO(()=>acquireFileReading(transport, location)).catch(() => {current();return undefined;});
    const matching = reread?.content === content ? reread : undefined;
    return {
      outcome: { state: "saved", revision: matching?.revision, sourceRevision: receipt?.revision?.revision, readback:matching?"verified":"unavailable", detail:matching?undefined:reread?"The native owner saved the payload and then advanced again. The page remains on its original basis for review; the latest reading is available in source.":"The native owner saved the payload. Its updated file reading is unavailable; the page and its edits have been retained." },
      reading: matching,
    };
  }

  if (saved.operations?.write && !saved.operations.write.available) {
    return { outcome: { state: "refused", detail: `Central holds this document read-only: ${saved.operations.write.reason ?? "no write authority"}` }, reading: saved };
  }
  const result = await ownerIO(()=>fileOperation<FileMutation>(transport, location, { action: "write", expected_revision: saved.revision, content }));
  if (result.outcome === "conflict") {
    return { outcome: { state: "conflict", detail: "The document changed while this page was open. Reload to review; your page edits are still here.", currentRevision: result.current?.revision }, reading: result.current };
  }
  if (result.outcome === "unchanged") {
    return { outcome: { state: "unchanged" }, reading: saved };
  }
  invalidateFile(location);
  const reread = await ownerIO(()=>acquireFileReading(transport, location)).catch(() => {current();return undefined;});
  const matching = reread?.content === content ? reread : undefined;
  return { outcome: { state: "saved", revision: result.revision ?? matching?.revision, readback:matching?"verified":"unavailable", detail:matching?undefined:reread?"The native owner saved the payload and then advanced again. The page remains on its original basis for review; the latest reading is available in source.":"The native owner saved the payload. Its updated file reading is unavailable; the page and its edits have been retained." }, reading: matching };
}
