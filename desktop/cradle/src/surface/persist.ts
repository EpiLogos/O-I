/**
 * Layout persistence (U0.3b): layout state is plain serialisable app state,
 * saved to localStorage on every change and restored on load. A corrupt or
 * foreign payload degrades honestly to austere rest — never a guess (law 7).
 */

import { contains, groupsOf } from "./engine";
import {
  AGENCY_DEPTHS,
  freshLayout,
  type AgencyDepth,
  type LayoutState,
  type Pane,
  type SurfaceBinding,
  type SurfaceId,
  type TabGroupPane,
} from "./types";

const KEY = "oi-cradle.layout.v1";

function validBinding(raw: unknown): SurfaceBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.kind !== "string" || typeof o.title !== "string")
    return null;
  if (o.ref !== undefined && typeof o.ref !== "string") return null;
  if (o.project !== undefined && typeof o.project !== "string") return null;
  return { project: o.project as string | undefined, id: o.id, kind: o.kind, ref: o.ref as string | undefined, title: o.title };
}

function validPane(raw: unknown, surfaces: Record<SurfaceId, SurfaceBinding>): Pane | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type === "group") {
    if (typeof o.id !== "string" || !Array.isArray(o.tabs) || !Array.isArray(o.pinned))
      return null;
    const tabs = o.tabs.filter((t): t is SurfaceId => typeof t === "string" && !!surfaces[t]);
    if (tabs.length !== o.tabs.length) return null;
    const pinned = o.pinned.filter(
      (p): p is SurfaceId => typeof p === "string" && tabs.includes(p),
    );
    const active =
      typeof o.active === "string" && tabs.includes(o.active) ? o.active : null;
    const g: TabGroupPane = { type: "group", id: o.id, tabs, pinned, active };
    return g;
  }
  if (o.type === "split" && (o.dir === "h" || o.dir === "v") && Array.isArray(o.children)) {
    const children = o.children
      .map((c) => validPane(c, surfaces))
      .filter((c): c is Pane => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0]; // normalise degraded splits
    if (typeof o.id !== "string") return null;
    return { type: "split", id: o.id, dir: o.dir, children };
  }
  return null;
}

export function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshLayout();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const surfaces: Record<SurfaceId, SurfaceBinding> = {};
    if (parsed.surfaces && typeof parsed.surfaces === "object") {
      for (const value of Object.values(parsed.surfaces)) {
        const b = validBinding(value);
        if (b) surfaces[b.id] = b;
      }
    }
    const root = validPane(parsed.root, surfaces);
    const closedStack = Array.isArray(parsed.closedStack)
      ? (parsed.closedStack as unknown[]).filter(
          (id): id is SurfaceId =>
            typeof id === "string" && !!surfaces[id] && !(root && contains(root, id)),
        )
      : [];
    const depth = AGENCY_DEPTHS.includes(parsed.agencyDepth as AgencyDepth)
      ? (parsed.agencyDepth as AgencyDepth)
      : "strip";
    if (!root) {
      // Austere rest: no chrome, depth clamped, nothing carried visually.
      return { ...freshLayout(), surfaces, closedStack };
    }
    let focusedGroupId =
      typeof parsed.focusedGroupId === "string" && contains(root, parsed.focusedGroupId)
        ? parsed.focusedGroupId
        : groupsOf(root)[0].id;
    if (!groupsOf(root).some((g) => g.id === focusedGroupId))
      focusedGroupId = groupsOf(root)[0].id;
    const state: LayoutState = {
      root,
      surfaces,
      closedStack,
      focusedGroupId,
      agencyDepth: depth,
    };
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
