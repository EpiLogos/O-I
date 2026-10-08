/** Original Windows owner admission (src-tauri/src/windows.rs::window_detach).
 * Compiled hosted identities alone do not grant a detached receiving body. */
const nativeDetachedKinds = new Set(['source', 'knowledge', 'file', 'encounter', 'browser', 'terminal', 'flow'])
export function nativeDetachedBodySupported(kind: string): boolean {
  return nativeDetachedKinds.has(kind)
}
