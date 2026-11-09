/** The origin of the window that hosts this frame (O-I #747 round 896, item 0.3). The Expressions frame is served from an origin of
 * its own, never the shell's, so the shell's origin is read from the browser's own record of the frame's ancestors
 * (`location.ancestorOrigins`, WebKit and Chromium), else from the referrer the frame was loaded with; a frame no browser names a host
 * for is taken to be served at its host's origin, as before the isolation. Null when the frame is not hosted. Every message the frame
 * reads from its host is checked against this origin, and every message it sends its host goes to this origin alone. */
export function hostOrigin(target: Window = window): string | null {
  if (target.parent === target) return null;
  return knownHostOrigin(target) ?? target.location.origin;
}

/** The host's origin as a browser record names it (its ancestors, else the referrer), or null when none does: the frame then cannot
 * tell where its host is, and an ask that needs the host's answer is not made (storageCarry.ts; round 896, 1R-surface.2). */
export function knownHostOrigin(target: Window = window): string | null {
  if (target.parent === target) return null;
  try {
    const ancestors = (target.location as Location & {ancestorOrigins?: {length: number; [index: number]: string}}).ancestorOrigins;
    const named = ancestors && ancestors.length > 0 ? ancestors[0] : null;
    if (named && named !== 'null') return named;
  } catch {/* no ancestor record */}
  try {
    const referrer = target.document?.referrer;
    if (referrer) {
      // A custom scheme's origin, which the URL standard reads as opaque, is the tuple its webview gives it (protocol.ts frameOrigin).
      const url = new URL(referrer), origin = url.origin !== 'null' ? url.origin : url.host ? `${url.protocol}//${url.host}` : null;
      if (origin) return origin;
    }
  } catch {/* no referrer */}
  return null;
}
