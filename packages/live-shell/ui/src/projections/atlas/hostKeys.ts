// [host] ⌘K is the shell's search line over the Earth too (DLW §18.4: "⌘K opens the search line over anything"; O-I #820).
//
// The ported controller (src/app/controller.ts onKey, the pinned Archetypal-Earth's own) listens on the window and toggles the
// Earth's field search on ⌘K wherever the focus stands, with no thought of a pane — so once an Earth was mounted the shell's line never
// opened. The port is left as it was; the mount (mount.ts) has this guard listen on the window just before the controller is made, in
// the same lifetime, and stop ⌘K from reaching the listeners after it — the controller's. The frame's keys listen from the App's
// first frame (frame/keys/FrameKeys.tsx), before any Earth, so they still hear it and open the line: stopping a press is not
// cancelling it, and the frame's own turn (which stands down only for a cancelled press) still comes.
//
// The Earth's ⌘K stands down entirely rather than by focus: its field search is reachable two other ways, its own Search button in
// its shell (src/shell/shell.ts `onSearch`) and `/` (controller.ts onKey), and a ⌘K that meant two things by where the focus stood
// would not be the one line the manual names. The press is the frame's exactly when the frame would take it (keyMap.ts intentOfKey,
// suppressed): ⌘⇧K, a ⌘K inside something that takes its own keys (the Earth's own search, open) and every other key reach the Earth.
import {intentOfKey, suppressed, type ElementLike, type KeyLike} from '../../frame/keys/keyMap'

/** Whether the Earth stands down for this press: it is the frame's ⌘K, where the frame takes it. Pure. */
export function standsDown(event: KeyLike & {target?: unknown}): boolean {
  const intent = intentOfKey(event)
  return intent?.id === 'line' && !suppressed(intent, (event.target ?? null) as ElementLike | null)
}

/** Listen first: the frame's ⌘K goes no further than this guard, so the Earth's controller, made after it, never hears it. `listen` is
 * the atlas lifetime's own (src/ui/lifetime.ts), so the guard leaves with the Earth. */
export function shellKeysFirst(listen: (target: EventTarget, type: string, listener: (event: KeyboardEvent) => void) => unknown, target: EventTarget = window): void {
  listen(target, 'keydown', event => { if (standsDown(event)) event.stopImmediatePropagation() })
}
