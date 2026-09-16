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
  // `draft` is unplaced writing: it deliberately carries no owner ref, and it
  // must survive a relaunch — the writing lives beside it under the same
  // surface id, and dropping the binding would orphan it. `instrument` is a
  // presentation binding to an externally owned QL source; the source itself
  // is never serialised into desktop state.
  if (o.kind !== "source" && o.kind !== "sources" && o.kind !== "knowledge" && o.kind !== "file" && o.kind !== "encounter" && o.kind !== "system" && o.kind !== "browser" && o.kind !== "terminal" && o.kind !== "flow" && o.kind !== "draft" && o.kind !== "blank" && o.kind !== "instrument" && o.kind !== "explore" && o.kind !== "presentation" && o.kind !== "techne") return null;
  if (o.ref !== undefined && typeof o.ref !== "string") return null;
  if (o.kind === "instrument" && (typeof o.ref !== "string" || !o.ref.trim())) return null;
  if (o.project !== undefined && typeof o.project !== "string") return null;
  const address = o.address as SurfaceBinding["address"];
  if (o.kind === "knowledge" && (!address || !["wiki","source","project-map"].includes(address.kind) || typeof address.value !== "string" || address.value !== o.ref)) return null;
  const location = o.location as SurfaceBinding["location"];
  if(o.kind === "file" && (!location || location.schema !== "central.path-ref/v1" || typeof location.ref !== "string" || location.ref !== o.ref || typeof location.root !== "string" || typeof location.path !== "string")) return null;
  const encounter=o.encounter as SurfaceBinding["encounter"];
  if(o.kind==="encounter" && (!encounter || typeof encounter.space!=="string" || typeof o.ref!=="string" || !o.ref.startsWith("agent-session/") || typeof o.project!=="string"))return null;
  const flow=o.flow as SurfaceBinding["flow"];
  // A flow instance is a user-section document: its identity is the file's
  // path-ref (the binding's ref) plus the in-document id — no project
  // register is involved, and the location must round-trip for the surface
  // to read the file back.
  if(o.kind==="flow" && (!flow || typeof flow.flowRef!=="string" || !flow.flowRef || typeof flow.path!=="string" || !flow.path || typeof o.ref!=="string" || !o.ref || !o.ref.startsWith("central:path:")))return null;
  if(o.kind==="flow" && (!location || location.schema!=="central.path-ref/v1" || typeof location.ref!=="string" || location.ref!==o.ref || typeof location.root!=="string" || typeof location.path!=="string"))return null;
  // SF1: a pinned projected subject must name its hosted ref and its world;
  // the optional exact refs/revisions ride along only when well-typed.
  const presentationRaw=o.presentation as Record<string,unknown>|undefined;
  if(o.kind==="presentation" && (typeof o.ref!=="string" || !o.ref.trim() || !presentationRaw || typeof presentationRaw!=="object" || typeof presentationRaw.world_ref!=="string"))return null;
  const presentation=o.kind==="presentation"&&presentationRaw?{world_ref:presentationRaw.world_ref as string,...(typeof presentationRaw.field_ref==="string"?{field_ref:presentationRaw.field_ref}:{}),...(typeof presentationRaw.projection_ref==="string"?{projection_ref:presentationRaw.projection_ref}:{}),...(Number.isInteger(presentationRaw.projection_revision)?{projection_revision:presentationRaw.projection_revision as number}:{}),...(typeof presentationRaw.presentation_ref==="string"?{presentation_ref:presentationRaw.presentation_ref}:{}),...(Number.isInteger(presentationRaw.presentation_revision)?{presentation_revision:presentationRaw.presentation_revision as number}:{}),...(typeof presentationRaw.expression_ref==="string"?{expression_ref:presentationRaw.expression_ref}:{}),...(Number.isInteger(presentationRaw.expression_revision)?{expression_revision:presentationRaw.expression_revision as number}:{})}:undefined;
  // L5 Technē (T0): a techne binding names its instrument, subject and
  // selection; the payload's subject must be the binding's ref (the kernel
  // focus subject). A payload missing any part discloses nothing and is
  // dropped rather than guessed at.
  const techneRaw=o.techne as Record<string,unknown>|undefined;
  if(o.kind==="techne" && (!techneRaw || typeof techneRaw!=="object" || typeof techneRaw.instrument!=="string" || typeof techneRaw.subjectRef!=="string" || techneRaw.subjectRef!==o.ref || typeof techneRaw.selectionRef!=="string" || !techneRaw.selectionRef.trim()))return null;
  const techne=o.kind==="techne"&&techneRaw?{instrument:techneRaw.instrument as import("../techne/contract").TechneInstrument,subjectRef:techneRaw.subjectRef as string,selectionRef:techneRaw.selectionRef as string}:undefined;
  const view=o.view as SurfaceBinding["view"];
  const encounterPlane=view?.encounterPlane;
  return { presentation, techne, terminal:o.kind==="terminal"?{cwd:typeof (o.terminal as {cwd?:unknown})?.cwd==="string"?(o.terminal as {cwd:string}).cwd:undefined}:undefined, flow:o.kind==="flow"?flow:undefined, browser:o.kind==="browser"?{url:typeof (o.browser as {url?:unknown})?.url==="string"?(o.browser as {url:string}).url:""}:undefined, view:encounterPlane&&["Conversation","Activity","Context","Inspect"].includes(encounterPlane)?{encounterPlane}:undefined, encounter, location, address, project: o.project as string | undefined, id: o.id, kind: o.kind, ref: o.ref as string | undefined, title: o.title };
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
    const g: TabGroupPane = { type: "group", id: o.id, tabs, pinned, active, emptySlot: o.emptySlot === true && tabs.length === 0 ? true : undefined };
    return g;
  }
  if (o.type === "split" && (o.dir === "h" || o.dir === "v") && Array.isArray(o.children)) {
    const children = o.children
      .map((c) => validPane(c, surfaces))
      .filter((c): c is Pane => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0]; // normalise degraded splits
    if (typeof o.id !== "string") return null;
    return { type: "split", id: o.id, dir: o.dir, children, weights: Array.isArray(o.weights) && o.weights.length === children.length && o.weights.every(v => typeof v === "number" && Number.isFinite(v) && v > 0) ? o.weights as number[] : undefined };
  }
  return null;
}

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
    const subjectPlanes=Object.fromEntries(Object.entries(parsed.subjectPlanes??{}).filter(([,plane])=>plane==="context"||plane==="history"||plane==="system")) as LayoutState["subjectPlanes"];
    // Decode leniently (map §2 law 7): a foreign or partial payload drops the
    // accompanying binding rather than guessing at it — the agent layer then
    // shows its honest "no accompanying agent" choice.
    const accompanyingRaw = parsed.accompanying as Record<string, unknown> | undefined;
    const accompanying: LayoutState["accompanying"] = accompanyingRaw && typeof accompanyingRaw === "object"
      && typeof accompanyingRaw.ref === "string" && typeof accompanyingRaw.project === "string" && typeof accompanyingRaw.space === "string"
      ? { ref: accompanyingRaw.ref, project: accompanyingRaw.project, space: accompanyingRaw.space }
      : undefined;
    const windowBounds = Object.fromEntries(Object.entries(parsed.windowBounds && typeof parsed.windowBounds === "object" ? parsed.windowBounds : {}).filter(([id,b]) => !!surfaces[id] && b && [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width>=400 && b.height>=300));
    const detached = Array.isArray(parsed.detached) ? parsed.detached.filter((d): d is NonNullable<LayoutState["detached"]>[number] => !!d && typeof d === "object" && typeof d.surfaceId === "string" && !!surfaces[d.surfaceId] && typeof d.groupId === "string" && Number.isInteger(d.index) && d.index >= 0 && typeof d.pinned === "boolean") : [];
    if (!root) {
      // Austere rest: no chrome, depth clamped, nothing carried visually.
      return { ...freshLayout(), accompanying, detached, subjectPlanes, windowBounds, surfaces, closedStack, agencyDepth: depth, rightDepth: AGENCY_DEPTHS.includes(parsed.rightDepth as AgencyDepth) ? parsed.rightDepth as AgencyDepth : "strip", leftWidth: typeof parsed.leftWidth === "number" ? Math.max(200, Math.min(600, parsed.leftWidth)) : 260, rightWidth: typeof parsed.rightWidth === "number" ? Math.max(240, Math.min(720, parsed.rightWidth)) : 320 };
    }
    let focusedGroupId =
      typeof parsed.focusedGroupId === "string" && contains(root, parsed.focusedGroupId)
        ? parsed.focusedGroupId
        : groupsOf(root)[0].id;
    if (!groupsOf(root).some((g) => g.id === focusedGroupId))
      focusedGroupId = groupsOf(root)[0].id;
    const state: LayoutState = {
      accompanying,
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
