/** The exact origin of the frame's address (O-I #747 round 896, item 0.3): the origin its messages carry and every post to it names.
 * The native frame is served by a custom protocol of the host's (`oi-material://…`, native_shell.rs `expressions_entry`), which the URL
 * standard parses as an opaque origin, while the webview serving it (a scheme it handles) gives its documents the tuple origin
 * `scheme://host[:port]`: that tuple is this origin. Null for an address with no host. The shell's relays and the boundary read it here
 * (1R-authority.3: the cradle's relays post to it and read only its messages). */
export function frameOrigin(src: string, base?: string): string | null {
  let url: URL;
  try {url = new URL(src, base);} catch {return null;}
  if (url.origin !== 'null') return url.origin;
  return url.host ? `${url.protocol}//${url.host}` : null;
}

/** The exact origin of the document a frame was given (its `src`, read against the shell's own address), or null with none. */
export function frameAddressOrigin(frame: {readonly src?: unknown}): string | null {
  return typeof frame.src === 'string' && frame.src ? frameOrigin(frame.src, globalThis.location?.href) : null;
}
