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
  groupsOf,
  activateSurface,
  activeBindingId,
  closeSurface,
  closeEmptyPane,
  cycleTab,
  focusGroup,
  isPinned,
  jumpToTab,
  layoutSignature,
  moveDirectional,
  moveTab,
  neighbourGroup,
  openSourcesIndex,
  openSurfaceCount,
  reopenClosed,
  restoreLayout,
  resizeSplit,
  shiftDepth,
  splitOff,
  tileSurfaces,
  togglePin,
} from "./engine";
import {clampTabListWidth, type TabPresentation} from "../workspace/mode";
import type {
  ActionArg,
  ActionDisclosure,
  LayoutState,
  Pane,
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
const FRAME_DISCLOSED_KINDS = new Set(["source", "sources", "knowledge", "file", "encounter", "system", "browser", "terminal", "flow", "blank", "factory", "instrument", "explore", "presentation", "expressions", "techne", "epi-logos", "agency"]);

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
    {action_ref:"surface.focus-tab",title:"Focus this tab",enabled:true},
    ...groupsOf(ctx.state.root).filter(g=>!g.tabs.includes(surfaceId)).map((g,i)=>({action_ref:`surface.move-to:${g.id}`,title:`Move to pane ${i+1} · ${ctx.state.surfaces[g.active??g.tabs[0]]?.title??"Empty"}`,enabled:true})),
    {
      action_ref: "surface.close",
      title: pinned ? "Close (pinned — unpin first)" : "Close",
      enabled: !pinned,
    },
    { action_ref: "surface.maximize", title: ctx.state.maximizedGroupId ? "Restore panes" : "Maximize pane", enabled: true },
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
    // Tab presentation is per pane (TabGroupPane): the focused pane's current
    // one is disclosed disabled so the menu also reads as the state. Choosing
    // an entry is a bulk control — every pane moves together.
    ...TAB_PRESENTATION_ACTIONS.map(({presentation, title}) => {
      const focused=groupsOf(ctx.state.root).find(g=>g.id===ctx.state.focusedGroupId);
      const current=focused?.tabPresentation??"pinned-horizontal";
      return {
        action_ref: `frame.tabs:${presentation}`,
        title: current === presentation ? `${title} (current)` : title,
        enabled: current !== presentation,
      };
    }),
  ];
}

const TAB_PRESENTATION_ACTIONS: {presentation: TabPresentation; title: string}[] = [
  {presentation: "pinned-horizontal", title: "Pin tabs horizontally"},
  {presentation: "pinned-vertical", title: "Pin tabs vertically"},
  {presentation: "unpinned", title: "Unpin tabs"},
];

/**
 * Execute a frame action — the one path keyboard, pointer, and context-menu
 * invocations all share (keyboard + pointer parity by construction).
 * Unknown action refs change nothing: no fabricated behaviour.
 */
/** Apply a transform to every group pane in the tree (bulk presentation). */
function mapGroupPanes(state: LayoutState, transform: (group: Extract<Pane,{type:"group"}>) => Extract<Pane,{type:"group"}>): LayoutState {
  const walk=(pane: Pane): Pane =>
    pane.type==="split"
      ? {...pane, children: pane.children.map(walk)}
      : transform(pane);
  return {...state, root: state.root ? walk(state.root) : state.root};
}

/** Apply a transform to one named group pane (per-pane pin/orientation). */
function mapGroupPane(state: LayoutState, groupId: string, transform: (group: Extract<Pane,{type:"group"}>) => Extract<Pane,{type:"group"}>): LayoutState {
  const walk=(pane: Pane): Pane =>
    pane.type==="split"
      ? {...pane, children: pane.children.map(walk)}
      : pane.type==="group"&&pane.id===groupId ? transform(pane) : pane;
  return {...state, root: state.root ? walk(state.root) : state.root};
}

export function executeFrameAction(state: LayoutState, ref: string, arg?: ActionArg, snapshot?: RestorePoint): LayoutState {
  if(ref.startsWith("frame.tabs:")) {
    const presentation=ref.slice("frame.tabs:".length);
    if(presentation!=="pinned-horizontal"&&presentation!=="pinned-vertical"&&presentation!=="unpinned")return state;
    // Pinned horizontal is the absent default. Pinning records the geometry
    // (tabPinOrientation) an unpinned pane later reveals; unpinning keeps it.
    // A presentation change ends the strip's own focus mark. The footer
    // entries are a bulk control: every pane moves together.
    const orientation=presentation==="pinned-horizontal"?"horizontal":presentation==="pinned-vertical"?"vertical":undefined;
    return {...mapGroupPanes(state,(group)=>({...group,
      tabPresentation:presentation==="pinned-horizontal"?undefined:presentation,
      tabPinOrientation:orientation??group.tabPinOrientation})),
      focusedTabId:undefined};
  }
  // The pin only pins or unpins the current orientation; orientation is its
  // own control (frame.tabs-orient). Owner ruling 2026-09-17: one control,
  // one meaning, PER PANE.
  if(ref==="frame.tabs-pin") {
    const groupId=arg?.groupId??state.focusedGroupId;
    return groupId?mapGroupPane(state,groupId,(group)=>{
      const unpinned=(group.tabPresentation??"pinned-horizontal")==="unpinned";
      const orientation=group.tabPinOrientation??"horizontal";
      return unpinned
        ? {...group,tabPresentation:orientation==="vertical"?"pinned-vertical":undefined,tabPinOrientation:orientation}
        : {...group,tabPresentation:"unpinned"};
    }):state;
  }
  if(ref==="frame.tabs-orient") {
    const groupId=arg?.groupId??state.focusedGroupId;
    return groupId?mapGroupPane(state,groupId,(group)=>{
      const next=(group.tabPinOrientation??"horizontal")==="horizontal"?"vertical":"horizontal";
      const unpinned=(group.tabPresentation??"pinned-horizontal")==="unpinned";
      return unpinned?{...group,tabPinOrientation:next}:{...group,tabPresentation:next==="vertical"?"pinned-vertical":undefined,tabPinOrientation:next};
    }):state;
  }
  if(ref==="frame.tabs-width") {
    const width=clampTabListWidth(arg?.n);
    return width===undefined?state:{...state,tabListWidth:width};
  }
  // Focusing a tab no longer folds the bar: the unpinned reveal law (cradle.css)
  // is the one hiding law, so this is plain activation.
  if(ref==="surface.focus-tab") {const id=arg?.surfaceId??activeBindingId(state);return id?activateSurface(state,id):state;}
  if(ref.startsWith("surface.move-to:")&&arg?.surfaceId)return moveTab(state,arg.surfaceId,ref.slice("surface.move-to:".length));
  if (ref === "surface.maximize") {
    const group = arg?.surfaceId ? groupsOf(state.root).find(g => g.tabs.includes(arg.surfaceId!)) : groupsOf(state.root).find(g => g.id === state.focusedGroupId);
    return group ? { ...state, focusedGroupId: group.id, maximizedGroupId: state.maximizedGroupId === group.id ? undefined : group.id } : state;
  }
  const next = executeBaseAction(state, ref, arg, snapshot);
  if (!next.maximizedGroupId) return next;
  const group = groupsOf(next.root).find(g => g.id === next.focusedGroupId);
  return { ...next, maximizedGroupId: group?.id };
}

function executeBaseAction(
  state: LayoutState,
  ref: string,
  arg?: ActionArg,
  snapshot?: RestorePoint,
): LayoutState {
  const active = () => arg?.surfaceId ?? activeBindingId(state) ?? "";
  switch (ref) {
    case "surface.resize-split": return arg?.splitId && arg.weights ? resizeSplit(state, arg.splitId, arg.weights) : state;

    case "surface.open-sources":
      return openSourcesIndex(state);
    case "surface.close-empty-pane":
      return closeEmptyPane(state, arg?.groupId ?? state.focusedGroupId);
    case "surface.close":
      return active() ? closeSurface(state, active()) : closeEmptyPane(state, state.focusedGroupId);
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
