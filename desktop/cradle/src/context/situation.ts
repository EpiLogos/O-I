import type {KernelSnapshotState} from "../kernel/types";
import type {ActionDisclosure, LayoutState, RestorePoint, SurfaceBinding} from "../surface/types";
import {groupsOf} from "../surface/engine";
import {bindingDisclosures, frameDisclosures} from "../surface/registry";
import type {Workspace, WorkspaceRecentPlace} from "../workspace/store";
import type {WorkspaceMode} from "../workspace/mode";

export type SituationPresence = "focused" | "presented" | "resident" | "detached" | "recent";

export interface SituationSurface {
  id: string;
  kind: string;
  title: string;
  ref?: string;
  project?: string;
  mode: WorkspaceMode;
  presence: Exclude<SituationPresence, "recent">;
}

export interface SituationPlace {
  key: string;
  kind: "file" | "directory" | "knowledge";
  title: string;
  path?: string;
  ref?: string;
  project?: string;
  projectRef?: string;
  mode?: WorkspaceMode;
  presence: SituationPresence;
  location?: import("../kernel/types").CentralLocation;
}

export interface SituationFrame {
  schema: "oi.cradle.situation/v1";
  workspace: {
    id: string;
    name: string;
    mode: WorkspaceMode;
    project?: string;
    world?: "central" | "epi-logos";
  };
  subject?: { ref?: string; kind?: string; title: string; project?: string };
  reading?: { ref: string; position?: string };
  focus?: SituationSurface;
  currentPlace?: SituationPlace;
  surfaces: SituationSurface[];
  places: SituationPlace[];
  accompanying?: LayoutState["accompanying"];
  nativeFocus: KernelSnapshotState["focus"];
  capabilities: {
    /** Cradle-owned presentation Actions only. Semantic/native owner Actions
     * stay with their owner disclosures and are never fabricated here. */
    presentation: ActionDisclosure[];
  };
}

const modeOf = (layout: LayoutState): WorkspaceMode => layout.mode ?? "base";
const placeKey = (kind: SituationPlace["kind"], identity: string) => kind + ":" + identity;
const dedupeActions = (actions: ActionDisclosure[]): ActionDisclosure[] => {
  const seen = new Set<string>();
  return actions.filter(action => !seen.has(action.action_ref) && !!seen.add(action.action_ref));
};

function bindingPlace(binding: SurfaceBinding, snapshot: KernelSnapshotState, mode: WorkspaceMode, presence: SituationSurface["presence"]): SituationPlace | undefined {
  const location = binding.location;
  if (location) return {
    key: placeKey("file", location.ref),
    kind: "file",
    title: binding.title,
    path: location.path,
    ref: binding.ref ?? location.ref,
    project: binding.project,
    mode,
    presence,
    location,
  };
  if (binding.flow?.path) return {
    key: placeKey("file", binding.ref ?? binding.flow.path),
    kind: "file",
    title: binding.title,
    path: binding.flow.path,
    ref: binding.ref,
    project: binding.project,
    mode,
    presence,
  };
  if (binding.kind === "source" && binding.ref) {
    const buffer = snapshot.buffers[binding.ref];
    if (buffer?.path) return {
      key: placeKey("file", binding.ref),
      kind: "file",
      title: binding.title,
      path: buffer.path,
      ref: binding.ref,
      project: binding.project ?? buffer.project,
      mode,
      presence,
    };
  }
  if (binding.terminal?.cwd) return {
    key: placeKey("directory", binding.terminal.cwd),
    kind: "directory",
    title: binding.title,
    path: binding.terminal.cwd,
    project: binding.project,
    mode,
    presence,
  };
  if (binding.address) return {
    key: placeKey("knowledge", binding.ref ?? binding.address.value),
    kind: "knowledge",
    title: binding.title,
    ref: binding.ref ?? binding.address.value,
    project: binding.project,
    mode,
    presence,
  };
  return undefined;
}

function recentPlace(place: WorkspaceRecentPlace): SituationPlace {
  return {
    key: place.kind === "directory" && place.projectRef ? placeKey("directory", place.projectRef + ":" + place.path) : placeKey(place.kind, place.location?.ref ?? place.ref ?? place.path),
    kind: place.kind,
    title: place.label,
    path: place.path,
    ref: place.ref,
    project: place.project,
    projectRef: place.projectRef,
    presence: "recent",
    location: place.location,
  };
}

export function buildSituationFrame({workspace, snapshot, restorePoint}: {
  workspace: Workspace;
  snapshot: KernelSnapshotState;
  restorePoint?: RestorePoint;
}): SituationFrame {
  const activeMode = modeOf(workspace.layout);
  const layouts: {mode: WorkspaceMode; layout: LayoutState; active: boolean}[] = [
    {mode: activeMode, layout: workspace.layout, active: true},
    ...Object.entries(workspace.modeLayouts ?? {}).flatMap(([mode, layout]) =>
      layout && mode !== activeMode ? [{mode: mode as WorkspaceMode, layout, active: false}] : []),
  ];

  const surfaces: SituationSurface[] = [];
  const surfaceBindings = new Map<string, SurfaceBinding>();
  for (const entry of layouts) {
    for (const group of groupsOf(entry.layout.root)) {
      for (const id of group.tabs) {
        const binding = entry.layout.surfaces[id];
        if (!binding) continue;
        const focused = entry.active && group.id === entry.layout.focusedGroupId && group.active === id;
        const presented = entry.active && group.active === id;
        surfaces.push({
          id,
          kind: binding.kind,
          title: binding.title,
          ref: binding.ref,
          project: binding.project,
          mode: entry.mode,
          presence: focused ? "focused" : presented ? "presented" : "resident",
        });
        surfaceBindings.set(id, binding);
      }
    }
    if (entry.active && entry.layout.sidePane) {
      const pane = entry.layout.sidePane;
      for (const id of pane.tabs) {
        const binding = entry.layout.surfaces[id];
        if (!binding || surfaces.some(surface => surface.id === id)) continue;
        surfaces.push({
          id,
          kind: binding.kind,
          title: binding.title,
          ref: binding.ref,
          project: binding.project,
          mode: entry.mode,
          presence: pane.active === id ? "presented" : "resident",
        });
        surfaceBindings.set(id, binding);
      }
    }
    for (const detached of entry.layout.detached ?? []) {
      const binding = entry.layout.surfaces[detached.surfaceId];
      if (!binding || surfaces.some(surface => surface.id === detached.surfaceId)) continue;
      surfaces.push({
        id: binding.id,
        kind: binding.kind,
        title: binding.title,
        ref: binding.ref,
        project: binding.project,
        mode: entry.mode,
        presence: "detached",
      });
      surfaceBindings.set(binding.id, binding);
    }
  }

  const focus = surfaces.find(surface => surface.presence === "focused");
  const presentPlaces = surfaces.flatMap(surface => {
    const binding = surfaceBindings.get(surface.id);
    const place = binding && bindingPlace(binding, snapshot, surface.mode, surface.presence);
    return place ? [place] : [];
  });

  const navigationPlaces: SituationPlace[] = Object.entries(workspace.projectNavigation ?? {}).flatMap(([projectRef, navigation]) => {
    if (!navigation.locationPath) return [];
    return [{
      key: placeKey("directory", projectRef + ":" + navigation.locationPath),
      kind: "directory" as const,
      title: navigation.locationPath.split("/").filter(Boolean).slice(-1)[0] ?? navigation.locationPath,
      path: navigation.locationPath,
      project: workspace.project,
      projectRef,
      mode: activeMode,
      presence: "presented" as const,
    }];
  });

  const merged = new Map<string, SituationPlace>();
  for (const place of [...presentPlaces, ...navigationPlaces, ...(workspace.recentPlaces ?? []).map(recentPlace)]) {
    if (!merged.has(place.key)) merged.set(place.key, place);
  }
  const places = [...merged.values()];
  const focusedPlace = focus ? presentPlaces.find(place => place.mode === focus.mode && !!place.ref && place.ref === focus.ref)
    ?? presentPlaces.find(place => place.title === focus.title && place.mode === focus.mode) : undefined;
  const recentMatch = focusedPlace && !focusedPlace.location
    ? (workspace.recentPlaces ?? []).find(place => place.location && (place.path === focusedPlace.path || place.ref === focusedPlace.ref))
    : undefined;
  const currentPlace = focusedPlace
    ? {...focusedPlace, ...(recentMatch?.location ? {location: recentMatch.location} : {})}
    : navigationPlaces[0] ?? places.find(place => place.presence === "recent");

  const menu = {state: workspace.layout, snapshot: restorePoint ?? {
    root: workspace.layout.root,
    surfaces: workspace.layout.surfaces,
    closedStack: workspace.layout.closedStack,
    focusedGroupId: workspace.layout.focusedGroupId,
  }};
  const presentation = dedupeActions([
    ...frameDisclosures(menu),
    ...(focus ? bindingDisclosures(menu, focus.id) : []),
  ]);

  return {
    schema: "oi.cradle.situation/v1",
    workspace: {
      id: workspace.id,
      name: workspace.name,
      mode: activeMode,
      project: workspace.project,
      world: workspace.context?.world,
    },
    subject: workspace.context?.subject,
    reading: workspace.context?.reading,
    focus,
    currentPlace,
    surfaces,
    places,
    accompanying: workspace.layout.accompanying,
    nativeFocus: snapshot.focus,
    capabilities: {presentation},
  };
}
