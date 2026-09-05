/**
 * The Action registry (U0.3b) — D15's grammar made tangible.
 *
 * "The context menu is the canonical-Actions disclosure UI — right-click a
 * ref, see the Actions its owner discloses, invoke crosses the authority
 * seam" (law 12). A menu shows exactly what is disclosed for the object:
 * nothing more, nothing fabricated. Today the single honest built-in source
 * is the frame itself — 'surface.close', 'surface.split-right' &c. ARE real
 * frame operations S owns (D16). Owners populate their own sources when
 * their surfaces mount (U0.4+); a binding of a kind with no disclosed
 * Actions (e.g. 'test:silent') gets an empty menu — proof of the law.
 */

import {
  activateSurface,
  activeBindingId,
  closeSurface,
  cycleTab,
  focusGroup,
  isPinned,
  jumpToTab,
  layoutSignature,
  makeTestBinding,
  moveDirectional,
  moveTab,
  neighbourGroup,
  openBinding,
  openSourcesIndex,
  openSurfaceCount,
  reopenClosed,
  restoreLayout,
  shiftDepth,
  splitOff,
  tileSurfaces,
  togglePin,
} from "./engine";
import type {
  ActionArg,
  ActionDisclosure,
  LayoutState,
  RestorePoint,
  SurfaceId,
} from "./types";

export interface MenuContext {
  state: LayoutState;
  snapshot: RestorePoint;
}

/**
 * Kinds the frame honestly discloses its own operations for. Owner kinds
 * join when their surfaces mount — until then their menus are empty, never
 * invented. 'source' and 'sources' (U0.4) are real frame-managed kinds;
 * the frame's own operations (close/split/pin) apply to them. The owner's
 * own canonical Actions arrive with the owner-seam units — none are
 * fabricated here (law 4).
 */
const FRAME_DISCLOSED_KINDS = new Set(["test", "source", "sources"]);

/** Actions disclosed for one binding (its tab / its content right-click). */
export function bindingDisclosures(
  ctx: MenuContext,
  surfaceId: SurfaceId,
): ActionDisclosure[] {
  const binding = ctx.state.surfaces[surfaceId];
  if (!binding) return [];
  if (!FRAME_DISCLOSED_KINDS.has(binding.kind)) return [];
  const pinned = isPinned(ctx.state, surfaceId);
  return [
    {
      action_ref: "surface.close",
      title: pinned ? "Close (pinned — unpin first)" : "Close",
      enabled: !pinned,
    },
    { action_ref: "surface.split-right", title: "Split right", enabled: true },
    { action_ref: "surface.split-down", title: "Split down", enabled: true },
    {
      action_ref: pinned ? "surface.unpin" : "surface.pin",
      title: pinned ? "Unpin" : "Pin",
      enabled: true,
    },
  ];
}

/** Frame-level actions disclosed on the strip / pane chrome. */
export function frameDisclosures(ctx: MenuContext): ActionDisclosure[] {
  const open = openSurfaceCount(ctx.state);
  return [
    { action_ref: "surface.tile", title: "Tile all surfaces", enabled: open >= 2 },
    {
      action_ref: "surface.restore-layout",
      title: "Restore layout",
      enabled: layoutSignature(ctx.state) !== layoutSignature(ctx.snapshot),
    },
    {
      action_ref: "surface.reopen",
      title: "Reopen last closed",
      enabled: ctx.state.closedStack.length > 0,
    },
  ];
}

/**
 * Execute a frame action — the one path keyboard, pointer, and context-menu
 * invocations all share (keyboard + pointer parity by construction).
 * Unknown action refs change nothing: no fabricated behaviour.
 */
export function executeFrameAction(
  state: LayoutState,
  ref: string,
  arg?: ActionArg,
  snapshot?: RestorePoint,
): LayoutState {
  const active = () => arg?.surfaceId ?? activeBindingId(state) ?? "";
  switch (ref) {
    case "surface.open":
      return openBinding(state, makeTestBinding(state, "test"));
    case "surface.open-silent":
      return openBinding(state, makeTestBinding(state, "test:silent"));
    case "surface.open-sources":
      return openSourcesIndex(state);
    case "surface.close":
      return closeSurface(state, active());
    case "surface.reopen":
      return reopenClosed(state);
    case "surface.split-right":
      return active() ? splitOff(state, active(), "h", true) : state;
    case "surface.split-down":
      return active() ? splitOff(state, active(), "v", true) : state;
    case "surface.tile":
      return tileSurfaces(state);
    case "surface.move":
      return arg?.dir ? moveDirectional(state, arg.dir) : state;
    case "surface.focus":
      if (!arg?.dir) return state;
      {
        const nb = neighbourGroup(state, arg.dir);
        return nb ? focusGroup(state, nb) : state;
      }
    case "surface.activate":
      return arg?.surfaceId ? activateSurface(state, arg.surfaceId) : state;
    case "surface.focus-group":
      return arg?.groupId ? focusGroup(state, arg.groupId) : state;
    case "surface.drop":
      return arg?.surfaceId && arg?.groupId
        ? moveTab(state, arg.surfaceId, arg.groupId, arg.beforeId ?? null)
        : state;
    case "surface.tab-prev":
      return cycleTab(state, -1);
    case "surface.tab-next":
      return cycleTab(state, 1);
    case "surface.tab-n":
      return arg?.n ? jumpToTab(state, arg.n) : state;
    case "surface.pin":
    case "surface.unpin":
      return active() ? togglePin(state, active()) : state;
    case "surface.restore-layout":
      return snapshot ? restoreLayout(state, snapshot) : state;
    case "frame.depth-dec":
      return shiftDepth(state, -1);
    case "frame.depth-inc":
      return shiftDepth(state, +1);
    default:
      return state;
  }
}
