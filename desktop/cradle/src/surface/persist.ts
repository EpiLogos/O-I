/**
 * Layout persistence (U0.3b): layout state is plain serialisable app state,
 * saved to localStorage on every change and restored on load. A corrupt or
 * foreign payload degrades honestly to austere rest — never a guess (law 7).
 *
 * What a serialised binding or pane may be restored as is decided by the
 * pure codec in `layout-codec.mjs` (unit-tested outside a browser); this
 * module is the typed, storage-bound wrapper.
 */

// @ts-ignore -- language-neutral layout codec, unit-tested in tests/workspace-continuity.test.mjs.
import { validBinding, validPane } from "./layout-codec.mjs";
import { contains, groupsOf } from "./engine";
import { isTabPresentation, isWorkspaceMode, WORKSPACE_MODES } from "../workspace/mode";
import {
  AGENCY_DEPTHS,
  freshLayout,
  type AgencyDepth,
  type LayoutState,
  type Pane,
  type SurfaceBinding,
  type SurfaceId,
} from "./types";

const KEY = "oi-cradle.layout.v1";

const asBinding = (raw: unknown): SurfaceBinding | null => (validBinding as (raw: unknown) => SurfaceBinding | null)(raw);
const asPane = (raw: unknown, surfaces: Record<SurfaceId, SurfaceBinding>): Pane | null => (validPane as (raw: unknown, surfaces: Record<SurfaceId, SurfaceBinding>) => Pane | null)(raw, surfaces);

export function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshLayout();
    return decodeLayout(JSON.parse(raw));
  } catch { return freshLayout(); }
}

export function decodeLayout(value: unknown): LayoutState {
  try {
    const parsed = value as Record<string, unknown>;
    const surfaces: Record<SurfaceId, SurfaceBinding> = {};
    if (parsed.surfaces && typeof parsed.surfaces === "object") {
      for (const value of Object.values(parsed.surfaces)) {
        const b = asBinding(value);
        if (b) surfaces[b.id] = b;
      }
    }
    const root = asPane(parsed.root, surfaces);
    // The sidebar's own pane canvas (the Context plane hosts it) restores
    // under the same pane law as the root tree — and it is a group by
    // construction: an invalid record or a split is no canvas, never a guess.
    const sidePanePane = asPane(parsed.sidePane, surfaces);
    const sidePane = sidePanePane?.type === "group" ? sidePanePane : undefined;
    const closedStack = Array.isArray(parsed.closedStack)
      ? (parsed.closedStack as unknown[]).filter(
          (id): id is SurfaceId =>
            typeof id === "string" && !!surfaces[id] && !(root && contains(root, id)),
        )
      : [];
    const depth = AGENCY_DEPTHS.includes(parsed.agencyDepth as AgencyDepth)
      ? (parsed.agencyDepth as AgencyDepth)
      : "strip";
    const subjectPlanes=Object.fromEntries(Object.entries(parsed.subjectPlanes??{}).filter(([,plane])=>plane==="context"||plane==="history"||plane==="system")) as LayoutState["subjectPlanes"];
    // Decode leniently (map §2 law 7): a foreign or partial payload drops the
    // accompanying binding rather than guessing at it — the agent layer then
    // shows its honest "no accompanying agent" choice.
    const accompanyingRaw = parsed.accompanying as Record<string, unknown> | undefined;
    const accompanying: LayoutState["accompanying"] = accompanyingRaw && typeof accompanyingRaw === "object"
      && typeof accompanyingRaw.ref === "string" && typeof accompanyingRaw.project === "string" && typeof accompanyingRaw.space === "string"
      ? { ref: accompanyingRaw.ref, project: accompanyingRaw.project, space: accompanyingRaw.space }
      : undefined;
    // Mode, tab presentation and the panel's remembered planes are additive,
    // optional presentation fields: a payload without them (every arrangement
    // saved before they existed) restores as base mode with a tab strip, and
    // a value that is not one of the known names is dropped, never guessed.
    const mode = isWorkspaceMode(parsed.mode) && parsed.mode !== "base" ? parsed.mode : undefined;
    const tabPresentation = isTabPresentation(parsed.tabPresentation) && parsed.tabPresentation !== "strip" ? parsed.tabPresentation : undefined;
    const panelPlanesRaw = parsed.panelPlanes && typeof parsed.panelPlanes === "object" ? parsed.panelPlanes as Record<string, unknown> : {};
    const panelPlaneEntries = WORKSPACE_MODES.filter(name => typeof panelPlanesRaw[name] === "string" && (panelPlanesRaw[name] as string).length <= 64).map(name => [name, panelPlanesRaw[name] as string]);
    const panelPlanes = panelPlaneEntries.length ? Object.fromEntries(panelPlaneEntries) as LayoutState["panelPlanes"] : undefined;
    const modeRegionsRaw = parsed.modeRegions && typeof parsed.modeRegions === "object" ? parsed.modeRegions as Record<string, {left?: unknown; right?: unknown} | undefined> : {};
    const modeRegionEntries = WORKSPACE_MODES.filter(name => AGENCY_DEPTHS.includes(modeRegionsRaw[name]?.left as AgencyDepth) && AGENCY_DEPTHS.includes(modeRegionsRaw[name]?.right as AgencyDepth)).map(name => [name, {left: modeRegionsRaw[name]!.left as AgencyDepth, right: modeRegionsRaw[name]!.right as AgencyDepth}]);
    const modeRegions = modeRegionEntries.length ? Object.fromEntries(modeRegionEntries) as LayoutState["modeRegions"] : undefined;
    const windowBounds = Object.fromEntries(Object.entries(parsed.windowBounds && typeof parsed.windowBounds === "object" ? parsed.windowBounds : {}).filter(([id,b]) => !!surfaces[id] && b && [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width>=400 && b.height>=300));
    const detached = Array.isArray(parsed.detached) ? parsed.detached.filter((d): d is NonNullable<LayoutState["detached"]>[number] => !!d && typeof d === "object" && typeof d.surfaceId === "string" && !!surfaces[d.surfaceId] && typeof d.groupId === "string" && Number.isInteger(d.index) && d.index >= 0 && typeof d.pinned === "boolean") : [];
    if (!root) {
      // Austere rest: no chrome, depth clamped, nothing carried visually.
      return { ...freshLayout(), mode, epiLogos: parsed.epiLogos === true ? true : undefined, panelPlanes, modeRegions, accompanying, detached, sidePane, subjectPlanes, windowBounds, surfaces, closedStack, agencyDepth: depth, rightDepth: AGENCY_DEPTHS.includes(parsed.rightDepth as AgencyDepth) ? parsed.rightDepth as AgencyDepth : "strip", leftWidth: typeof parsed.leftWidth === "number" ? Math.max(200, Math.min(600, parsed.leftWidth)) : 260, rightWidth: typeof parsed.rightWidth === "number" ? Math.max(240, Math.min(720, parsed.rightWidth)) : 320 };
    }
    let focusedGroupId =
      typeof parsed.focusedGroupId === "string" && contains(root, parsed.focusedGroupId)
        ? parsed.focusedGroupId
        : groupsOf(root)[0].id;
    if (!groupsOf(root).some((g) => g.id === focusedGroupId))
      focusedGroupId = groupsOf(root)[0].id;
    const state: LayoutState = {
      mode, epiLogos: parsed.epiLogos === true ? true : undefined, panelPlanes, modeRegions,
      accompanying,
      sidePane,
      subjectPlanes,windowBounds,
      detached,
      maximizedGroupId: typeof parsed.maximizedGroupId === "string" && groupsOf(root).some(g => g.id === parsed.maximizedGroupId) ? parsed.maximizedGroupId : undefined,
      root,
      surfaces,
      closedStack,
      focusedGroupId,
      agencyDepth: depth,
      rightDepth: AGENCY_DEPTHS.includes(parsed.rightDepth as AgencyDepth) ? parsed.rightDepth as AgencyDepth : "strip",
      leftWidth: typeof parsed.leftWidth === "number" ? Math.max(200, Math.min(600, parsed.leftWidth)) : 260,
      rightWidth: typeof parsed.rightWidth === "number" ? Math.max(240, Math.min(720, parsed.rightWidth)) : 320,
    };
    // A legacy workspace carried its pin state at the top level: it becomes
    // every pane's own (the pin is per pane now, owner ruling 2026-09-17).
    if (tabPresentation !== undefined && state.root) {
      const withPresentation=(pane: import("./types").Pane): import("./types").Pane =>
        pane.type==="split" ? {...pane, children: pane.children.map(withPresentation)} : {...pane, tabPresentation};
      state.root = withPresentation(state.root);
    }
    return state;
  } catch {
    return freshLayout();
  }
}

export function saveLayout(state: LayoutState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode &c.) — the frame still works,
    // it simply will not restore. Honest degradation, never an error.
  }
}
