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

// [host] The Earth's single letters act only when the Earth's pane has focus (O-I #742).
//
// The ported controller (src/app/controller.ts onKey) turns nine plain letters into its own acts wherever the focus stands — the found app
// was a page with nothing else on it. In the shell a letter pressed over a Flow, the browser or another mode's pane moved the Earth (and a
// concealed Earth, kept mounted in another mode's pane tree, moved too). The port is left as it was; as for ⌘K, a guard listens on the
// window just before the controller is made, in the same lifetime, and stops the letter from reaching the listeners after it — the
// controller's — when the Earth's pane does not have the keys. The frame's keys, made with the App before any Earth, still hear it. Only
// these plain letters are stood down, so no other key, and no chord, changes; and no listener made after an Earth in the shell acts on a
// plain one of these letters at the window (Live's Jankó keyboard plays from its own focused element, which hears first).

/** The ported controller's letters: m its menu, f t l its Field, Theory and Alchemy lenses, a Aion, r the Red Book, d the Dynamics lens,
 * s the sky, g its graph. */
export const EARTH_LETTERS: ReadonlySet<string> = new Set(['m', 'f', 't', 'l', 'a', 'r', 'd', 's', 'g'])

/** The part of an element the guard reads (a real Element satisfies it). */
export interface PaneElementLike {
  readonly tagName?: string
  closest(selector: string): PaneElementLike | null
  getAttribute(name: string): string | null
  contains(other: unknown): boolean
  getClientRects(): {readonly length: number}
}

const onPage = (target: PaneElementLike): boolean => target.tagName === 'BODY' || target.tagName === 'HTML'

/** Whether the Earth's pane has the keys: the pane is drawn (a concealed pane never has them), it is the focused pane of its tree (the
 * Workbench's pane group, `data-focused`), and the press is on what holds the pane — the page, or the region the pane tree stands in,
 * which hand a press to the focused pane — or inside the Earth's pane itself. A press on a control outside the pane is that control's.
 * An Earth in no pane group (the centre panel) is its own pane. Pure. */
export function earthHasKeys(host: PaneElementLike | null, target: unknown): boolean {
  if (!host || host.getClientRects().length === 0) return false
  const group = host.closest('[data-pane="group"]')
  if (group && group.getAttribute('data-focused') !== 'true') return false
  const element = (target ?? null) as PaneElementLike | null
  if (!element || onPage(element) || element.contains(host)) return true
  return (group ?? host).contains(element)
}

/** Whether the Earth stands down for this press: a plain letter of its own while its pane does not have the keys. Pure. */
export function letterStandsDown(event: KeyLike & {target?: unknown}, host: PaneElementLike | null): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  if (!EARTH_LETTERS.has(event.key.toLowerCase())) return false
  return !earthHasKeys(host, event.target)
}

/** Listen before the controller: an Earth letter goes no further while the Earth's pane (`host`, the `.atlas-host` the globe stands in)
 * does not have the keys. */
export function earthLettersOnFocus(listen: (target: EventTarget, type: string, listener: (event: KeyboardEvent) => void) => unknown, host: PaneElementLike | null, target: EventTarget = window): void {
  listen(target, 'keydown', event => { if (letterStandsDown(event, host)) event.stopImmediatePropagation() })
}
