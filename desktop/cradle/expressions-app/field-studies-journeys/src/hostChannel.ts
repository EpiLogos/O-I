/** The frame's messages with the window that hosts it, addressed both ways (O-I #747 round 896, 1R-surface.10). The frame is served at
 * an origin of its own (item 0.3), so a message it sends names its host's exact origin (hostOrigin.ts), never '*', and a message it
 * reads is its host's only when the hosting window sent it from that origin. Every channel of the frame's pages to their host goes
 * through here (pinned by frame-messages-addressed-896.test.mjs); the editor channel (hostEditor.ts) and the storage carry
 * (storageCarry.ts) address theirs the same way with a window given them. A frame not hosted, or whose host no record names, sends
 * nothing and hears nothing. */
import {hostOrigin} from '../../../../../packages/expressions-boundary/src/hostOrigin';

/** The host's exact origin, or null when this frame is not hosted (or no window is). */
export function hostTarget(target: Window | undefined = globalThis.window): string | null {
  if (!target) return null;
  try {return hostOrigin(target);} catch {return null;}
}

/** Whether a message is the host's: sent by the window that hosts this frame, from the host's exact origin. */
export function fromHost(event: Pick<MessageEvent, 'source' | 'origin'>, target: Window | undefined = globalThis.window): boolean {
  const host = hostTarget(target);
  return host !== null && !!target && event.source === target.parent && event.origin === host;
}

/** Post a message to the host, at its exact origin. False when this frame is not hosted or the post failed: nothing was sent. */
export function postToHost(message: unknown, target: Window | undefined = globalThis.window): boolean {
  const host = hostTarget(target);
  if (host === null || !target) return false;
  try {target.parent.postMessage(message, host); return true;} catch {return false;}
}
