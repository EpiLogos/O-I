/**
 * Layout persistence (U0.3b): layout state is plain serialisable app state,
 * saved to localStorage on every change and restored on load. A corrupt or
 * foreign payload degrades honestly to austere rest — never a guess (law 7).
 */

import {paneById} from "./composition";
import {developmentFieldSnapshotError, exactDevelopmentFieldSnapshot} from "./development-field-snapshot";
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

/** Match the owner grammar needed here without turning the desktop into a ref owner. */
function validOwnerRef(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && value.startsWith(prefix)
    && new RegExp(`^${prefix}[A-Za-z0-9][A-Za-z0-9._:-]*$`).test(value);
}

function validBinding(raw: unknown): SurfaceBinding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.kind !== "string" || typeof o.title !== "string")
    return null;
  // `draft` is unplaced writing: it deliberately carries no owner ref, and it
  // must survive a relaunch — the writing lives beside it under the same
  // surface id, and dropping the binding would orphan it.
  if (o.kind !== "source" && o.kind !== "sources" && o.kind !== "knowledge" && o.kind !== "file" && o.kind !== "encounter" && o.kind !== "system" && o.kind !== "browser" && o.kind !== "terminal" && o.kind !== "flow" && o.kind !== "draft" && o.kind !== "blank" && o.kind !== "factory" && o.kind !== "agents" && o.kind !== "observatory" && o.kind !== "instrument" && o.kind !== "project-now" && o.kind !== "factory-handoff" && o.kind !== "factory-material" && o.kind !== "development-field") return null;
  if (o.ref !== undefined && typeof o.ref !== "string") return null;
  if((o.kind==="factory-handoff"||o.kind==="factory-material")&&(typeof o.ref!=="string"||!o.ref.trim()||typeof o.project!=="string"))return null;
  if (o.kind === "project-now" && (typeof o.ref!=="string"||typeof o.project!=="string"))return null;
  if (o.kind === "instrument" && (typeof o.ref !== "string" || !o.ref.trim())) return null;
  if (o.project !== undefined && typeof o.project !== "string") return null;
  const address = o.address as SurfaceBinding["address"];
  if (o.kind === "knowledge" && (!address || !["wiki","source","project-map"].includes(address.kind) || typeof address.value !== "string" || address.value !== o.ref)) return null;
  const location = o.location as SurfaceBinding["location"];
  if(o.kind === "file" && (!location || location.schema !== "central.path-ref/v1" || typeof location.ref !== "string" || location.ref !== o.ref || typeof location.root !== "string" || typeof location.path !== "string")) return null;
  const encounter=o.encounter as SurfaceBinding["encounter"];
  if((o.kind==="encounter"||o.kind==="observatory") && (!encounter || typeof encounter.space!=="string" || typeof o.ref!=="string" || !o.ref.startsWith("agent-session/") || typeof o.project!=="string"))return null;
  const flow=o.flow as SurfaceBinding["flow"];
  // A flow instance is a user-section document: its identity is the file's
  // path-ref (the binding's ref) plus the in-document id — no project
  // register is involved, and the location must round-trip for the surface
  // to read the file back.
  if(o.kind==="flow" && (!flow || typeof flow.flowRef!=="string" || !flow.flowRef || typeof flow.path!=="string" || !flow.path || typeof o.ref!=="string" || !o.ref || !o.ref.startsWith("central:path:")))return null;
  if(o.kind==="flow" && (!location || location.schema!=="central.path-ref/v1" || typeof location.ref!=="string" || location.ref!==o.ref || typeof location.root!=="string" || typeof location.path!=="string"))return null;
  const terminalRaw = o.terminal as {cwd?: unknown; attachment?: unknown} | undefined;
  const attachmentRaw = terminalRaw?.attachment as Record<string, unknown> | undefined;
  const attachment = attachmentRaw
    && attachmentRaw.kind === "aikit-session-space-working-surface"
    && validOwnerRef(attachmentRaw.space, "session-space/")
    && validOwnerRef(attachmentRaw.binding, "working-surface/")
    && typeof attachmentRaw.serviceCwd === "string"
    && attachmentRaw.serviceCwd.startsWith("/")
    ? { kind: "aikit-session-space-working-surface" as const, space: attachmentRaw.space, binding: attachmentRaw.binding, serviceCwd: attachmentRaw.serviceCwd }
    : undefined;
  if (o.kind === "terminal" && attachmentRaw !== undefined && !attachment) return null;
  const view=o.view as SurfaceBinding["view"];
  const rawDevelopmentField = o.kind === "development-field" && view?.developmentField && typeof view.developmentField === "object"
    ? view.developmentField as Record<string, unknown>
    : undefined;
  const developmentField = rawDevelopmentField && typeof rawDevelopmentField.cwd === "string" && rawDevelopmentField.cwd.startsWith("/")
    ? {cwd: rawDevelopmentField.cwd, baseRevision: typeof rawDevelopmentField.baseRevision === "string" ? rawDevelopmentField.baseRevision : undefined}
    : undefined;
  if(o.kind === "development-field" && (!developmentField || typeof o.project !== "string")) return null;
  const developmentIdentity = developmentField ? {project: o.project as string, cwd: developmentField.cwd, requestedBase: developmentField.baseRevision ?? "HEAD"} : undefined;
  const developmentSnapshot = developmentIdentity && rawDevelopmentField?.snapshot !== undefined
    ? exactDevelopmentFieldSnapshot(rawDevelopmentField.snapshot, developmentIdentity)
    : undefined;
  const suppliedSnapshotError = typeof rawDevelopmentField?.snapshotUnavailable === "string" && rawDevelopmentField.snapshotUnavailable.trim()
    ? rawDevelopmentField.snapshotUnavailable
    : undefined;
  // Keep the binding even when the retained response cannot be trusted. A
  // marker blocks an automatic current-checkout read, so reload never presents
  // a different dirty patch as the one the person reviewed.
  const snapshotUnavailable = developmentIdentity && rawDevelopmentField?.snapshot !== undefined && !developmentSnapshot
    ? `The retained native Git reading cannot be restored: ${developmentFieldSnapshotError(rawDevelopmentField.snapshot, developmentIdentity) ?? "invalid owner response"}. Refresh explicitly to read the current worktree.`
    : suppliedSnapshotError;
  const retainedDevelopmentField = developmentField && {...developmentField, ...(developmentSnapshot ? {snapshot: developmentSnapshot} : {}), ...(snapshotUnavailable ? {snapshotUnavailable} : {})};
  const encounterPlane=view?.encounterPlane;
  const encounterReturnSurfaceId=o.kind==="encounter"&&typeof view?.encounterReturnSurfaceId==="string"?view.encounterReturnSurfaceId:undefined;
  const rawFactory=view?.factory;
  const factory=(o.kind==="factory"||o.kind==="factory-handoff"||o.kind==="factory-material") && rawFactory && typeof rawFactory.statePath==="string"
    && rawFactory.statePath.trim() ? {statePath:rawFactory.statePath,
      centralProjectRef:typeof rawFactory.centralProjectRef==="string"?rawFactory.centralProjectRef:undefined,
      projectRef:typeof rawFactory.projectRef==="string"?rawFactory.projectRef:undefined,
      runRef:typeof rawFactory.runRef==="string"?rawFactory.runRef:undefined,
      telemetryRef:typeof rawFactory.telemetryRef==="string"?rawFactory.telemetryRef:undefined,
      expectedRevision:typeof rawFactory.expectedRevision==="number"&&Number.isSafeInteger(rawFactory.expectedRevision)&&rawFactory.expectedRevision>=0?rawFactory.expectedRevision:undefined}:undefined;
  if(o.kind==="factory-handoff"&&(!factory||factory.runRef!==o.ref))return null;
  if(o.kind==="factory-material"&&(!factory||!factory.runRef?.trim()||(rawFactory?.expectedRevision!==undefined&&factory.expectedRevision===undefined)))return null;
  return { terminal:o.kind==="terminal"?{cwd:typeof terminalRaw?.cwd==="string"?terminalRaw.cwd:undefined,attachment}:undefined, flow:o.kind==="flow"?flow:undefined, browser:o.kind==="browser"?{url:typeof (o.browser as {url?:unknown})?.url==="string"?(o.browser as {url:string}).url:""}:undefined, view:retainedDevelopmentField?{developmentField:retainedDevelopmentField}:factory ? {factory} : (encounterReturnSurfaceId||encounterPlane&&["Conversation","Activity","Context","Inspect"].includes(encounterPlane))?{encounterPlane,encounterReturnSurfaceId}:undefined, encounter, location, address, project: o.project as string | undefined, id: o.id, kind: o.kind, ref: o.ref as string | undefined, title: o.title };
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
    if (children.length === 1 && o.regionHost !== true) return children[0]; // normalise degraded splits
    if (typeof o.id !== "string") return null;
    return { type: "split", id: o.id, dir: o.dir, children, regionHost:o.regionHost===true?true:undefined, weights: Array.isArray(o.weights) && o.weights.length === children.length && o.weights.every(v => typeof v === "number" && Number.isFinite(v) && v > 0) ? o.weights as number[] : undefined };
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
    const visibleIds = groupsOf(root).flatMap(group => group.tabs);
    if (new Set(visibleIds).size !== visibleIds.length) throw new Error("Duplicate open surface identity");
    const visible = new Set(visibleIds);
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
    const groupIds = new Set(groupsOf(root).map(group => group.id));
    const detached: NonNullable<LayoutState["detached"]> = [];
    const detachedIds = new Set<SurfaceId>();
    for (const raw of Array.isArray(parsed.detached) ? parsed.detached : []) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      if (typeof entry.surfaceId !== "string" || !surfaces[entry.surfaceId] || visible.has(entry.surfaceId) || detachedIds.has(entry.surfaceId)
        || typeof entry.groupId !== "string" || !groupIds.has(entry.groupId)
        || !Number.isInteger(entry.index) || (entry.index as number) < 0 || typeof entry.pinned !== "boolean") continue;
      detached.push({surfaceId: entry.surfaceId, groupId: entry.groupId, index: entry.index as number, pinned: entry.pinned});
      detachedIds.add(entry.surfaceId);
    }
    const closedSeen = new Set<SurfaceId>();
    const closedStack = (Array.isArray(parsed.closedStack) ? parsed.closedStack : []).filter((id): id is SurfaceId =>
      typeof id === "string" && !!surfaces[id] && !visible.has(id) && !detachedIds.has(id) && !closedSeen.has(id) && (closedSeen.add(id), true),
    );
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
    const raw=parsed.composition as Record<string,unknown>|undefined;
    if(raw && typeof raw.bindingId==="string" && surfaces[raw.bindingId] && typeof raw.returnPaneId==="string" && paneById(root,raw.returnPaneId)?.type==="split" && raw.ordinary && typeof raw.ordinary==="object") {
      const saved=raw.ordinary as Record<string,unknown>;
      const prior=decodeLayout({...saved,surfaces,composition:undefined});
      state.composition={bindingId:raw.bindingId,returnPaneId:raw.returnPaneId,collectionRef:typeof raw.collectionRef==="string"?raw.collectionRef:undefined,ordinary:{root:prior.root,focusedGroupId:prior.focusedGroupId,maximizedGroupId:prior.maximizedGroupId,rightDepth:prior.rightDepth,leftWidth:prior.leftWidth,rightWidth:prior.rightWidth,agencyDepth:prior.agencyDepth}};
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
