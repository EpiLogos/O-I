/**
 * The frame keyboard map (U0.3b) — keyboard + pointer parity for every
 * surface operation (map §8: "tab/split/tile/move/restore all work via
 * keyboard and pointer"). Every entry executes the same frame action the
 * pointer path invokes (registry.executeFrameAction).
 *
 * ⌘/Ctrl — mod · the map is written with ⌘ for the Mac cradle.
 *
 *   SURFACES
 *     ⌘T                open surface                  (pointer: strip “+”)
 *     ⌘⌥N               open silent test binding      (kind 'test:silent' —
 *                                                       discloses no Actions)
 *     ⌘W                close surface                 (pointer: tab ×,
 *                                                       middle-click, menu)
 *     ⌘⇧T               reopen last closed            (pointer: strip menu)
 *     ⌥⇧← / ⌥⇧→         previous / next tab in group  (pointer: click a tab)
 *     ⌘1 … ⌘9            jump to nth tab in group      (pointer: click)
 *
 *   SPLITS · TILING · MOVEMENT
 *     ⌘D                split right                   (pointer: tab menu)
 *     ⌘⇧D               split down                    (pointer: tab menu)
 *     ⌘⌥T               tile all surfaces             (pointer: strip menu)
 *     ⌥← ⌥→ ⌥↑ ⌥↓        move focus between splits     (pointer: click a pane)
 *     ⌘⌥← → ↑ ↓          move active surface toward
 *                       that split (splits if none)   (pointer: drag a tab)
 *
 *   PIN · RESTORE
 *     ⌥P                pin / unpin active surface    (pointer: tab menu)
 *     ⌘⌥R               restore layout (to the state
 *                       this session loaded)          (pointer: strip menu)
 *
 *   CONTEXT MENU (D15)
 *     Context-Menu / ⇧F10 on a focused tab — open its disclosed Actions
 *     (pointer: right-click a tab or surface content)
 *     ↑ ↓ move · ⏎ invoke · ⏥ close   (pointer: click an item)
 *
 *   AGENCY LAYER DEPTH (D17 — keyboard toggle by design)
 *     ⌥]                deeper  (strip → panel → full)
 *     ⌥[                shallower
 *     ⏥ (Escape)        from the full overlay back to panel
 *
 *   AT REST the frame map still answers ⌘T / ⌘⇧T; everything else needs a
 *   surface and does nothing without one — honest, never fabricated.
 */

import type { ActionArg, Dir } from "./types";

const ARROW_DIR: Record<string, Dir> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

export interface FrameKeyAction {
  ref: string;
  arg?: ActionArg;
}

/**
 * Translate a keydown into the frame action it binds. Returns null when the
 * key is not a frame binding, or when a context menu is open (the menu owns
 * the keyboard then). Order matters: the more specific combos first.
 */
export function frameActionForKey(
  e: KeyboardEvent,
  menuOpen: boolean,
): FrameKeyAction | null {
  if (menuOpen || e.repeat) return null;
  const mod = e.metaKey || e.ctrlKey;
  const alt = e.altKey;
  const shift = e.shiftKey;
  const code = e.code;
  const dir = ARROW_DIR[code];

  // ⌘⌥… — tile, restore, move-surface, silent open
  if (mod && alt) {
    if (code === "KeyT") return { ref: "surface.tile" };
    if (code === "KeyR") return { ref: "surface.restore-layout" };
    if (code === "KeyN") return { ref: "surface.open-silent" };
    if (dir) return { ref: "surface.move", arg: { dir } };
    return null;
  }
  // ⌘⇧… — reopen, split down
  if (mod && shift) {
    if (code === "KeyT") return { ref: "surface.reopen" };
    if (code === "KeyD") return { ref: "surface.split-down" };
    return null;
  }
  // ⌘… — open, close, split right, jump to nth tab
  if (mod) {
    if (code === "KeyT") return { ref: "surface.open" };
    if (code === "KeyW") return { ref: "surface.close" };
    if (code === "KeyD") return { ref: "surface.split-right" };
    const digit = code.match(/^Digit([1-9])$/);
    if (digit) return { ref: "surface.tab-n", arg: { n: Number(digit[1]) } };
    return null;
  }
  // ⌥⇧… — tab cycle
  if (alt && shift) {
    if (code === "ArrowLeft") return { ref: "surface.tab-prev" };
    if (code === "ArrowRight") return { ref: "surface.tab-next" };
    return null;
  }
  // ⌥… — focus between splits, pin, agency depth
  if (alt) {
    if (dir) return { ref: "surface.focus", arg: { dir } };
    if (code === "KeyP") return { ref: "surface.pin" };
    if (code === "BracketRight") return { ref: "frame.depth-inc" };
    if (code === "BracketLeft") return { ref: "frame.depth-dec" };
    return null;
  }
  return null;
}
