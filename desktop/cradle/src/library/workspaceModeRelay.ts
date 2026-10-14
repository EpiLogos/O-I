/** The standalone Library page's workspace-mode request, read at the host (LibraryHost) and at the shell (CradleFrame).
 *
 * The request is `mode` alone, as it has always been. An adopted Library entry also names the kernel Expression it is bound to
 * (`ref`, the `expression:` prefix) and the saved entry it means (`id`, for the browser draft). Both are additive: a request
 * without them relays exactly as before. A malformed value is dropped, never coerced. */

export interface RelayedWorkspaceMode {mode: 'expressions'; ref?: string; id?: string}

const REF_MAX = 512;
const ID_MAX = 256;

/** A kernel Expression ref as the Library reads it (the `expression:` prefix, within the length bound), or undefined. */
export function kernelRefOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.startsWith('expression:') && value.length <= REF_MAX ? value : undefined;
}

function entryIdOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_MAX ? value : undefined;
}

export interface WorkspaceModeDetail {mode: 'expressions' | 'techne'; ref?: string; id?: string}

/** What a shell reads from the `oi:host-workspace-mode` event detail. A ref is read only for the Expressions mode; a malformed
 * field is dropped and an unreadable mode reads as null. */
export function workspaceModeDetail(detail: unknown): WorkspaceModeDetail | null {
  if (!detail || typeof detail !== 'object') return null;
  const {mode, ref, id} = detail as {mode?: unknown; ref?: unknown; id?: unknown};
  if (mode !== 'expressions' && mode !== 'techne') return null;
  const out: WorkspaceModeDetail = {mode};
  const kernel = mode === 'expressions' ? kernelRefOf(ref) : undefined, entry = entryIdOf(id);
  if (kernel !== undefined) out.ref = kernel;
  if (entry !== undefined) out.id = entry;
  return out;
}

/** The detail the host relays on `oi:host-workspace-mode`, or null when the message is not an Expressions workspace-mode request. */
export function relayedWorkspaceMode(data: {request?: unknown; mode?: unknown; ref?: unknown; id?: unknown}): RelayedWorkspaceMode | null {
  if (data.request !== 'workspace-mode' || data.mode !== 'expressions') return null;
  const detail: RelayedWorkspaceMode = {mode: 'expressions'};
  const ref = kernelRefOf(data.ref), id = entryIdOf(data.id);
  if (ref !== undefined) detail.ref = ref;
  if (id !== undefined) detail.id = id;
  return detail;
}
