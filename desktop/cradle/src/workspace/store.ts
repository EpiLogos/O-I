import {publishArrangement} from "../visuals/observations";
import {preservePresentation,latestRecovery} from "./recovery";
import {commitCheckpoint,lastKnownGood,stageCheckpoint,decodeLayoutProgressive} from "./checkpoints";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { activateSurface, groupsOf, openBinding, redockBinding } from "../surface/engine";
import { decodeLayout } from "../surface/persist";
import { freshLayout, type LayoutState } from "../surface/types";
import {clampTabListWidth,upgradeTabPresentation,isWorkspaceMode,MODE_CURATION,TREE_MODES,WORKSPACE_MODES,type WorkspaceMode} from "../workspace/mode";
import {focusedInstrumentBinding,focusedInstrumentSource,subscribeFocusedInstrumentOpen} from "../instrument/source";
import {setActiveListingWorkspace} from "../files/listingStore";

export type ProjectMode = "chats" | "files" | "wiki";
export interface ProjectNavigation { expanded: boolean; scroll: number; directories?: string[]; mode?: ProjectMode; locationPath?: string }
export interface WorkspaceRecentPlace {
  kind: "file" | "directory";
  label: string;
  path: string;
  project?: string;
  /** Native owner ref when one exists; directory navigation may only have a path + ProjectRef. */
  ref?: string;
  projectRef?: string;
  location?: import("../kernel/types").CentralLocation;
  visitedAt: number;
}
export interface Workspace {
  id: string; name: string;
  /** Owner query restored by a native read; never imported as semantic focus. */
  project?: string;
  /** Factory's "All projects" scope (10-SIDEBARS §3.6): only the Desk honours
   * it; every other surface reads the workspace's project (or Central). */
  allProjects?: boolean;
  centralFiles?: boolean;
  layout: LayoutState; writing: string; writingMode?: boolean;
  /** Presentation keyed by the owner ProjectRef, never a cached authority reading. */
  projectNavigation?: Record<string, ProjectNavigation>;
  /** PER-MODE WORKSPACES. `layout` is always the ACTIVE mode's tree (named by
   * `layout.mode`, absent = base) — so everything that renders a layout keeps
   * rendering exactly one, and only the active mode's surfaces are mounted.
   * Every other mode's tree (panes, tabs, splits, pins, tab presentation,
   * side-region depths) waits here, unmounted, as plain state. A mode with no
   * saved tree opens on its MODE_CURATION default. */
  modeLayouts?: Partial<Record<WorkspaceMode, LayoutState>>;
  /** WORLD CONTEXT — beside the per-mode trees, not inside them: what rides
   * through every mode switch and every reload. */
  context?: WorldContext;
  /** Bounded reference-only recency. Contents and owner readings never live here. */
  recentPlaces?: WorkspaceRecentPlace[];
  /** Named sets (manual §10.2), newest first. The pool (§16.7) makes each one a workspace of its own on mount; nothing new
   * is written here. */
  sets?: NamedSet[];
  /** What this workspace keeps (the pool's columns, manual §16.7): absent, every part. */
  keeps?: WorkspaceKeeps;
  /** The mode that comes forward after a launch (the pool's Opens in): absent, the last mode it stood in. */
  opensIn?: WorkspaceOpensIn;
  /** The context it last kept, when keeping is not on every change (the pool's Keep context): what a launch brings back. */
  kept?: KeptContext;
  /** The widget rail (manual §10.6): one open set for the whole world, so a widget opened in one mode is open in every
   * mode; each widget's pin; the rail's presets and width. Beside the per-mode trees, never inside them. */
  widgets?: WidgetRail;
  /** When the person last stood in this workspace (the retention warm set's
   * recency order — surface/retention.tsx keeps the active workspace plus
   * the most recently visited ones warm). Presentation bookkeeping, never
   * semantic. */
  lastVisitedAt?: number;
}
/** The selected world is independent of the arrangement: entering Epi-Logos
 * selects its world, and examining one of its Expressions in Technè or opening
 * its source in Base is still within Epi-Logos until the person leaves it.
 * `trail` is the route back (manual §10.7): every place you go is a stop, and
 * Back, Forward and the Trail return to the same mode, surface and reading
 * position. Refs and positions only — never content, never an authority reading. */
export type WorldRef = "central" | "epi-logos";
/** One place on the trail. `surfaceRef`, `surfaceKind`, `label` and `position` are what the stop shows: the thing it stood on
 * and its track or point in the reading. `world`, `selection`, `subject` and `reading` are the place it returns to, exactly;
 * a stop made before stops named their whole place carries only the first four, and returns as it did (its thing selected). */
export interface TrailStop {
  mode: WorkspaceMode; surfaceRef?: string; surfaceKind?: string; label: string; position?: string; at?: number;
  world?: WorldRef; selection?: WorldSelection; subject?: WorldContext["subject"]; reading?: WorldContext["reading"];
}
/** THE selection (FOUNDATION F1): one value for the whole window — a Day, a document, a clip, a track, a task, a scene.
 * Every pane that follows the selection reads it here; each move is a trail stop. `ref` is the owner's ref (or the
 * Central-relative path for ground material); `track` names the track a clip sits on. Refs only, never content. */
export interface WorldSelection { mode: WorkspaceMode; kind: string; ref: string; title: string; track?: string }
export interface WorldContext {
  world?: WorldRef;
  subject?: { ref?: string; kind?: string; title: string; project?: string };
  reading?: { ref: string; position?: string };
  selection?: WorldSelection;
  trail?: TrailStop[];
  /** The stop you stand on, once Back, Forward or the Trail has walked the trail (manual §23.5 "the stop you stand on");
   * absent, the newest. A move clears it. */
  trailAt?: number;
}

// ---- the trail (manual §10.7, §23.5) — ported from encounter.ts `encounter` and `returnTo` onto the book's one shape ----

const pick = <T extends object>(value: T | undefined, fields: readonly (keyof T)[]): Partial<T> =>
  Object.fromEntries(fields.flatMap(field => value?.[field] === undefined ? [] : [[field, value[field]]])) as Partial<T>;
/** The parts of a place a stop keeps, by name: refs, titles, positions. Whatever else rides on a value stays off the trail. */
const placeParts = (context: WorldContext) => ({
  world: context.world,
  selection: context.selection && pick(context.selection, ["mode", "kind", "ref", "title", "track"]) as WorldSelection,
  subject: context.subject && pick(context.subject, ["ref", "kind", "title", "project"]) as WorldContext["subject"],
  reading: context.reading && pick(context.reading, ["ref", "position"]) as WorldContext["reading"],
});
/** The stop you stand on: the book's walked place, else the newest. */
export const standingOn = (context: WorldContext): number => context.trailAt ?? (context.trail?.length ?? 0) - 1;
/** The place a move lands on, as a stop, stamped with the move's time: the mode, the world, THE selection, the subject and the
 * reading. It shows THE selection (else the subject, else the reading) and its track or point in the reading. */
export function stopOf(mode: WorkspaceMode, context: WorldContext, at: number): TrailStop {
  const {world, selection, subject, reading} = placeParts(context);
  const shown = selection ? {surfaceRef: selection.ref, surfaceKind: selection.kind} : subject?.ref ? {surfaceRef: subject.ref, ...(subject.kind ? {surfaceKind: subject.kind} : {})}
    : reading ? {surfaceRef: reading.ref} : {};
  const shownPosition = selection?.track ?? reading?.position;
  return {mode, label: selection?.title ?? subject?.title ?? MODE_CURATION[mode].label, ...shown, ...(shownPosition !== undefined ? {position: shownPosition} : {}), at,
    ...(world ? {world} : {}), ...(selection ? {selection} : {}), ...(subject ? {subject} : {}), ...(reading ? {reading} : {})};
}
/** A stop made before stops named their whole place: its thing is the selection it returns to. */
const legacyStop = (stop: TrailStop) => !stop.selection && !stop.subject && !stop.reading && stop.surfaceRef !== undefined;
const legacySelection = (stop: TrailStop): WorldSelection | undefined => stop.surfaceRef && stop.surfaceKind
  ? {mode: stop.mode, kind: stop.surfaceKind, ref: stop.surfaceRef, title: stop.label, ...(stop.position !== undefined ? {track: stop.position} : {})} : undefined;
const placeKey = (stop: TrailStop) => {
  const selection = legacyStop(stop) ? legacySelection(stop) : stop.selection;
  return JSON.stringify([stop.mode, stop.world ?? null, selection ? [selection.mode, selection.kind, selection.ref, selection.track ?? null] : null,
    stop.subject ? [stop.subject.ref ?? null, stop.subject.kind ?? null] : null, stop.reading ? [stop.reading.ref, stop.reading.position ?? null] : null]);
};
/** A move (encounter.ts `encounter`: the trail grows by one on every transition): the trail grows by the place you go to. Going to
 * the place you stand on is no move. When Back, Forward or the Trail has walked you to an earlier stop, the walk ends here: the
 * stop you stood on is kept again as a return (encounter.ts `returnTo`: a return appends, it does not rewind), then the new place,
 * so Back from it goes where you were and every place you went stays on the trail. */
export function moveOnTrail(context: WorldContext, stop: TrailStop): WorldContext {
  const trail = context.trail ?? [], standingStop = trail[standingOn(context)];
  if (standingStop && placeKey(standingStop) === placeKey(stop)) return context;
  const {trailAt: walked, ...rest} = context;
  return {...rest, trail: [...trail, ...(walked !== undefined && standingStop ? [{...standingStop, at: stop.at}] : []), stop]};
}
/** Selecting (the book's `select`): THE selection, and a move to it; selecting what is selected is no move. */
export function selectOnTrail(context: WorldContext, selection: WorldSelection, at: number): WorldContext {
  const heldSelection = context.selection, moved = {...context, selection: placeParts({selection}).selection};
  if (heldSelection && heldSelection.ref === selection.ref && heldSelection.kind === selection.kind && heldSelection.mode === selection.mode) return moved;
  return moveOnTrail(moved, stopOf(selection.mode, moved, at));
}
/** A point in a reading. When the stop you stand on names that reading, or the thing it is the reading of, the point is where you
 * stand (manual §10.7 "the same point in the reading"): the stop takes it and keeps its time, and no stop is added. Another
 * reading is an occasion change: a move. */
export function readOnTrail(context: WorldContext, mode: WorkspaceMode, reading: {ref: string; position?: string}, at: number): WorldContext {
  const moved = {...context, reading: placeParts({reading}).reading};
  const trail = context.trail ?? [], here = standingOn(context), standingStop = trail[here];
  if (!standingStop || legacyStop(standingStop) || ![standingStop.reading?.ref, standingStop.selection?.ref, standingStop.subject?.ref].includes(reading.ref)) return moveOnTrail(moved, stopOf(mode, moved, at));
  const refined = stopOf(standingStop.mode, {world: standingStop.world, selection: standingStop.selection, subject: standingStop.subject, reading: moved.reading}, standingStop.at ?? at);
  return {...moved, trail: trail.map((stop, index) => index === here ? refined : stop)};
}
/** A walk (Back, Forward, a stop pressed on the Trail): stand on stop `index` — the world, selection, subject and reading it names,
 * restored exactly — adding no stop. The caller stands the book in the stop's mode. A stop made before stops named their whole
 * place returns as it did: its thing selected, the rest as it stands. */
export function walkTrail(context: WorldContext, index: number): WorldContext {
  const trail = context.trail ?? [], stop = trail[index];
  if (!stop) return context;
  const {trailAt: _walked, world: _world, selection: _selection, subject: _subject, reading: _reading, ...rest} = context;
  const returnPlace = legacyStop(stop) ? {...context, selection: legacySelection(stop) ?? context.selection} : {world: stop.world, selection: stop.selection, subject: stop.subject, reading: stop.reading};
  const named = Object.fromEntries(Object.entries({world: returnPlace.world, selection: returnPlace.selection, subject: returnPlace.subject, reading: returnPlace.reading}).filter(([, value]) => value !== undefined));
  return {...rest, ...named, ...(index < trail.length - 1 ? {trailAt: index} : {})};
}
/** The book's bound on the trail (TRAIL_LIMIT): the oldest stops fall away, and the stop you stand on stays the same stop. */
export function boundedContext(context: WorldContext): WorldContext {
  const {trailAt, ...rest} = context, dropped = Math.max((context.trail?.length ?? 0) - TRAIL_LIMIT, 0);
  const shifted = trailAt === undefined ? undefined : trailAt - dropped;
  return {...rest, trail: context.trail?.slice(dropped), ...(shifted !== undefined && shifted >= 0 && shifted < (context.trail?.length ?? 0) - dropped - 1 ? {trailAt: shifted} : {})};
}
/** A named set (manual §10.2): an arrangement of panes, instruments and the frame's parts, kept under a name and
 * returned to from the browser. The layout is the mode's own tree with its application view; refs only. */
export interface NamedSet { id: string; name: string; mode: WorkspaceMode; layout: LayoutState; savedAt: number }
/** The pool (manual §16.7): a workspace keeps a way of working — its panes, the instrument in each, the rail's widgets and the
 * layout each mode opens with — each part On or Off; a launch brings it back in the modes the footer says. */
export type WorkspaceKeepPart = "panes" | "instruments" | "widgets" | "layouts";
export type WorkspaceKeeps = Record<WorkspaceKeepPart, boolean>;
export const KEEPS_ALL: WorkspaceKeeps = { panes: true, instruments: true, widgets: true, layouts: true };
export type WorkspaceOpensIn = "last" | WorkspaceMode;
/** The footer: what a launch restores, and when the workspace you are in keeps your context. */
export interface PoolSettings { onLaunch: "all" | "open" | "nothing"; keepContext: "change" | "leave" | "manual" }
export const POOL_DEFAULTS: PoolSettings = { onLaunch: "all", keepContext: "change" };
/** A workspace's kept context: the active mode's tree, the other modes' trees and the rail, as they stood when kept. */
export interface KeptContext { layout: LayoutState; modeLayouts?: Partial<Record<WorkspaceMode, LayoutState>>; widgets?: WidgetRail; keptAt: number }
const KEEP_PARTS: readonly WorkspaceKeepPart[] = ["panes", "instruments", "widgets", "layouts"];
function decodeKeeps(raw: unknown): WorkspaceKeeps | undefined {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return undefined;
  const keeps = Object.fromEntries(KEEP_PARTS.map(part => [part, o[part] !== false])) as WorkspaceKeeps;
  return KEEP_PARTS.every(part => keeps[part]) ? undefined : keeps;
}
function decodeOpensIn(raw: unknown): WorkspaceOpensIn | undefined {
  return raw === "last" || isWorkspaceMode(raw) ? raw as WorkspaceOpensIn : undefined;
}
export function decodePoolSettings(raw: unknown): PoolSettings | undefined {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return undefined;
  const onLaunch = o.onLaunch === "open" || o.onLaunch === "nothing" ? o.onLaunch : "all";
  const keepContext = o.keepContext === "leave" || o.keepContext === "manual" ? o.keepContext : "change";
  return onLaunch === "all" && keepContext === "change" ? undefined : { onLaunch, keepContext };
}
const SET_LIMIT = 64;
const TRAIL_LIMIT = 24;
const text = (value: unknown, max = 512): string | undefined => typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
const RECENT_PLACE_LIMIT = 24;
const recentPlaceKey = (place: Pick<WorkspaceRecentPlace,"kind"|"path"|"ref"|"location"|"projectRef">) =>
  [place.kind, place.location?.ref ?? place.ref ?? place.projectRef ?? "", place.path].join(":");
function withRecentPlace(workspace: Workspace, place: Omit<WorkspaceRecentPlace,"visitedAt"> & {visitedAt?:number}): Workspace {
  const next: WorkspaceRecentPlace = {...place, visitedAt: place.visitedAt ?? Date.now()};
  const recentPlaces = [next, ...(workspace.recentPlaces ?? []).filter(held => recentPlaceKey(held) !== recentPlaceKey(next))].slice(0, RECENT_PLACE_LIMIT);
  return {...workspace, recentPlaces};
}
function decodeRecentPlaces(raw: unknown): WorkspaceRecentPlace[] | undefined {
  if(!Array.isArray(raw))return undefined;
  const places=raw.flatMap((entry):WorkspaceRecentPlace[]=>{
    const o=entry as Record<string,unknown>|null;
    if(!o||typeof o!=="object"||(o.kind!=="file"&&o.kind!=="directory"))return [];
    const path=text(o.path,4096),label=text(o.label),ref=text(o.ref,4096),project=text(o.project),projectRef=text(o.projectRef,4096);
    const visitedAt=typeof o.visitedAt==="number"&&Number.isFinite(o.visitedAt)&&o.visitedAt>0?o.visitedAt:undefined;
    const rawLocation=o.location as Record<string,unknown>|undefined;
    const location=rawLocation?.schema==="central.path-ref/v1"&&text(rawLocation.ref,4096)&&text(rawLocation.root,4096)&&text(rawLocation.path,4096)
      ? {schema:"central.path-ref/v1" as const,ref:text(rawLocation.ref,4096)!,root:text(rawLocation.root,4096)!,path:text(rawLocation.path,4096)!}
      : undefined;
    return path&&label&&visitedAt?[{kind:o.kind,label,path,ref,project,projectRef,location,visitedAt}]:[];
  }).sort((a,b)=>b.visitedAt-a.visitedAt).slice(0,RECENT_PLACE_LIMIT);
  return places.length?places:undefined;
}
/** A workspace the person stands in has, by that fact, been visited: the
 * retention warm set (surface/retention.tsx) keeps only workspaces with a
 * `lastVisitedAt` stamp, and `activate` stamps on every switch — but the
 * BOOT workspace is active without a switch ever having happened. Without
 * this stamp its trees fall out of the warm set the moment the person
 * first leaves it, and leaving unmounts its live documents — the exact
 * destruction the warm set exists to prevent. Every book constructor
 * passes through this so the invariant "the active workspace was visited"
 * holds from the first render. */
function stampActiveVisited(book: WorkspaceBook): WorkspaceBook {
  return { ...book, workspaces: book.workspaces.map(w => w.id === book.active ? { ...w, lastVisitedAt: w.lastVisitedAt ?? Date.now() } : w) };
}
const decodeWorld = (given: unknown): WorldRef | undefined => given === "epi-logos" ? "epi-logos" : given === "central" ? "central" : undefined;
// These readers, and the trail's locals above, take names of their own: the storage conformance scanner
// (tests/conformance/source.mjs) follows identifiers by name across the file, and a declaration under a name its walk already
// visits (`raw`, `o`, `standing`, `place`, `at` …) reroutes the walk from the book's draft key.
function decodeSubject(given: unknown): WorldContext["subject"] {
  const g = given as Record<string, unknown> | undefined;
  return g && typeof g === "object" && text(g.title) ? { ref: text(g.ref), kind: text(g.kind, 64), title: text(g.title)!, project: text(g.project) } : undefined;
}
function decodeReading(given: unknown): WorldContext["reading"] {
  const g = given as Record<string, unknown> | undefined;
  return g && typeof g === "object" && text(g.ref) ? { ref: text(g.ref)!, position: text(g.position) } : undefined;
}
function decodeSelection(given: unknown): WorldSelection | undefined {
  const g = given as Record<string, unknown> | undefined;
  return g && typeof g === "object" && isWorkspaceMode(g.mode) && text(g.kind, 64) && text(g.ref, 4096) && text(g.title)
    ? { mode: g.mode, kind: text(g.kind, 64)!, ref: text(g.ref, 4096)!, title: text(g.title)!, track: text(g.track, 4096) } : undefined;
}
export function decodeWorldContext(raw: unknown): WorldContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const subject = decodeSubject(r.subject);
  const reading = decodeReading(r.reading);
  const stops = Array.isArray(r.trail) ? r.trail.flatMap((stop): TrailStop[] => {
    const o = stop as Record<string, unknown> | null;
    if (!o || typeof o !== "object" || !isWorkspaceMode(o.mode) || !text(o.label)) return [];
    // The place a stop returns to, where it names one: each part decoded as the context's own, a damaged part dropped.
    const stopWorld = decodeWorld(o.world), stopSelection = decodeSelection(o.selection), stopSubject = decodeSubject(o.subject), stopReading = decodeReading(o.reading);
    return [{ mode: o.mode, label: text(o.label)!, surfaceRef: text(o.surfaceRef), surfaceKind: text(o.surfaceKind, 64), position: text(o.position), at: typeof o.at === "number" && Number.isFinite(o.at) ? o.at : undefined,
      ...(stopWorld ? { world: stopWorld } : {}), ...(stopSelection ? { selection: stopSelection } : {}), ...(stopSubject ? { subject: stopSubject } : {}), ...(stopReading ? { reading: stopReading } : {}) }];
  }) : undefined;
  const trail = stops?.slice(-TRAIL_LIMIT);
  const selection = decodeSelection(r.selection);
  // The stop you stand on, kept the same stop through the bound; the newest, or a place off the trail, is none.
  const trailAt = typeof r.trailAt === "number" && Number.isInteger(r.trailAt) && stops && trail ? r.trailAt - (stops.length - trail.length) : undefined;
  const context: WorldContext = { world: decodeWorld(r.world), subject, reading, selection, trail: trail?.length ? trail : undefined,
    ...(trailAt !== undefined && trail && trailAt >= 0 && trailAt < trail.length - 1 ? { trailAt } : {}) };
  return context.world || context.subject || context.reading || context.selection || context.trail ? context : undefined;
}
/** What crosses a mode switch on the layout itself: the side-region widths,
 * the live accompanying session (one canonical conversation), and the
 * panel's remembered plane per mode. Everything else belongs to a mode. */
/** A tree's own mode field: Central's (base) tree names no mode. */
export const layoutModeField = (mode: WorkspaceMode): WorkspaceMode | undefined => mode === "base" ? undefined : mode;
/** The frame parts that stay with the person across modes (side widths, the accompanying session, the panel planes). */
export function sharedAcrossModes(layout: LayoutState): Partial<LayoutState> {
  return { leftWidth: layout.leftWidth, rightWidth: layout.rightWidth, accompanying: layout.accompanying, panelPlanes: layout.panelPlanes, subjectPlanes: layout.subjectPlanes };
}
/** Leave the active mode's tree where it stands and stand on `next`'s: its
 * saved tree, or a fresh one with both side regions open (base keeps the
 * companion collapsed, as a new workspace does). Pure; the store persists. */
export function switchWorkspaceMode(workspace: Workspace, next: WorkspaceMode): Workspace {
  const from: WorkspaceMode = workspace.layout.mode ?? "base";
  if (from === next || !TREE_MODES.includes(next)) return workspace;
  const { [next]: saved, ...rest } = { ...workspace.modeLayouts, [from]: { ...workspace.layout, modeRegions: undefined } };
  const base: LayoutState = saved ?? { ...initialLayout(), rightDepth: next === "base" ? "collapsed" : "panel" };
  const layout: LayoutState = { ...base, ...sharedAcrossModes(workspace.layout), mode: next === "base" ? undefined : next, modeRegions: undefined,
    // System/Settings uses the whole workspace on entry. The previous tree,
    // focus and side-region depths remain exactly where they were saved.
    ...(next === "settings" ? { agencyDepth: "panel", rightDepth: "collapsed", settingsReturnMode: from as Exclude<WorkspaceMode, "settings"> } : {}) };
  const context: WorldContext | undefined = next === "epi-logos" ? { ...workspace.context, world: "epi-logos" } : workspace.context;
  return { ...workspace, layout, modeLayouts: rest, context };
}
/** The widget rail's state in the book (manual §10.6). `pinned` holds, per widget, the ref it stopped following at. */
export interface WidgetRail { open: string[]; pinned?: Record<string, string>; presets?: WidgetPreset[]; width?: number }
export interface WidgetPreset { id: string; name: string; open: string[]; savedAt: number }
const WIDGET_LIMIT = 32;
/** The rail as the book holds it; a world that never touched its rail stands on the shell's defaults. */
const railOf = (workspace: Workspace, defaults: readonly string[] = []): WidgetRail => workspace.widgets ?? { open: [...defaults] };
/** Open a widget, or close it (it stays in the launcher). Closing drops its pin. Pure. */
export function toggleWidget(workspace: Workspace, id: string, defaults: readonly string[] = []): Workspace {
  const rail = railOf(workspace, defaults);
  if (rail.open.includes(id)) {
    const { [id]: _dropped, ...pinned } = rail.pinned ?? {};
    return { ...workspace, widgets: { ...rail, open: rail.open.filter(held => held !== id), pinned } };
  }
  return { ...workspace, widgets: { ...rail, open: [...rail.open, id].slice(-WIDGET_LIMIT) } };
}
/** Pin a widget at the ref it shows now (it stops following the selection), or unpin it (`null`). Pure. */
export function pinWidget(workspace: Workspace, id: string, ref: string | null): Workspace {
  const rail = railOf(workspace);
  const { [id]: _was, ...rest } = rail.pinned ?? {};
  return { ...workspace, widgets: { ...rail, pinned: ref === null ? rest : { ...rest, [id]: ref } } };
}
/** Keep the open widgets as a preset (a same-named preset is replaced), newest first. Pure. */
export function saveWidgetPreset(workspace: Workspace, name: string, id: string = crypto.randomUUID(), savedAt: number = Date.now(), defaults: readonly string[] = []): Workspace {
  const label = name.trim();
  if (!label) return workspace;
  const rail = railOf(workspace, defaults);
  const preset: WidgetPreset = { id, name: label, open: [...rail.open], savedAt };
  return { ...workspace, widgets: { ...rail, presets: [preset, ...(rail.presets ?? []).filter(held => held.name !== label)].slice(0, SET_LIMIT) } };
}
/** Open exactly a preset's widgets. Pure. */
export function applyWidgetPreset(workspace: Workspace, id: string): Workspace {
  const rail = railOf(workspace);
  const preset = rail.presets?.find(held => held.id === id);
  return preset ? { ...workspace, widgets: { ...rail, open: [...preset.open], pinned: {} } } : workspace;
}
/** The rail's width, bounded as the docks were (260–900). Pure. */
export function setWidgetRailWidth(workspace: Workspace, width: number): Workspace {
  return { ...workspace, widgets: { ...railOf(workspace), width: Math.max(260, Math.min(900, Math.round(width))) } };
}
function decodeWidgetRail(raw: unknown): WidgetRail | undefined {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.open)) return undefined;
  const ids = (list: unknown): string[] => Array.isArray(list) ? list.flatMap(id => text(id, 128) ? [text(id, 128)!] : []).slice(0, WIDGET_LIMIT) : [];
  const pinned = o.pinned && typeof o.pinned === "object"
    ? Object.fromEntries(Object.entries(o.pinned as Record<string, unknown>).flatMap(([id, ref]) => text(id, 128) && text(ref, 2048) ? [[id, text(ref, 2048)!]] : []))
    : undefined;
  const presets = Array.isArray(o.presets) ? o.presets.flatMap((entry): WidgetPreset[] => {
    const p = entry as Record<string, unknown> | null;
    return p && typeof p === "object" && text(p.id, 128) && text(p.name, 128) && typeof p.savedAt === "number"
      ? [{ id: text(p.id, 128)!, name: text(p.name, 128)!, open: ids(p.open), savedAt: p.savedAt }] : [];
  }).slice(0, SET_LIMIT) : undefined;
  return { open: ids(o.open), ...(pinned ? { pinned } : {}), ...(presets?.length ? { presets } : {}), ...(typeof o.width === "number" ? { width: Math.max(260, Math.min(900, o.width)) } : {}) };
}
/** Keep the active mode's arrangement under a name (newest first; a same-named set in the same mode is replaced). Pure. */
export function saveNamedSet(workspace: Workspace, name: string, id: string = crypto.randomUUID(), savedAt: number = Date.now()): Workspace {
  const label = name.trim();
  if (!label) return workspace;
  const mode: WorkspaceMode = workspace.layout.mode ?? "base";
  const set: NamedSet = { id, name: label, mode, layout: { ...workspace.layout, detached: undefined, windowBounds: undefined }, savedAt };
  return { ...workspace, sets: [set, ...(workspace.sets ?? []).filter(held => !(held.mode === mode && held.name === label))].slice(0, SET_LIMIT) };
}
/** Return to a named set: stand in its mode, then take its tree and frame — the side widths, the accompanying session
 * and any detached windows stay as they are. Pure. */
export function applyNamedSet(workspace: Workspace, id: string, at: number = Date.now()): Workspace {
  const set = workspace.sets?.find(held => held.id === id);
  if (!set) return workspace;
  const standing = switchWorkspaceMode(workspace, set.mode);
  const layout: LayoutState = { ...set.layout, ...sharedAcrossModes(standing.layout), detached: standing.layout.detached, windowBounds: standing.layout.windowBounds, mode: set.mode === "base" ? undefined : set.mode, appliedSet: `${set.id}@${at}` };
  return { ...standing, layout };
}
function decodeNamedSets(raw: unknown, restore: (layout: LayoutState) => LayoutState): NamedSet[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const sets = raw.flatMap((entry): NamedSet[] => {
    const o = entry as Record<string, unknown> | null;
    if (!o || typeof o !== "object" || !text(o.id, 128) || !text(o.name, 128) || !isWorkspaceMode(o.mode) || typeof o.savedAt !== "number") return [];
    try { return [{ id: text(o.id, 128)!, name: text(o.name, 128)!, mode: o.mode, layout: { ...restore(o.layout as LayoutState), mode: o.mode === "base" ? undefined : o.mode }, savedAt: o.savedAt }]; }
    catch { return []; }
  }).slice(0, SET_LIMIT);
  return sets.length ? sets : undefined;
}
/** Move one already-held Surface to the active mode's canvas. Its binding,
 * native buffer and per-binding view state survive; no second host is minted. */
export function moveWorkspaceSurface(workspace:Workspace,surfaceId:string,into:'tree'|'side'):Workspace {
  const layouts=[workspace.layout,...Object.values(workspace.modeLayouts??{})];
  const owners=layouts.filter(layout=>groupsOf(layout.root).some(group=>group.tabs.includes(surfaceId))||layout.sidePane?.tabs.includes(surfaceId)||layout.detached?.some(row=>row.surfaceId===surfaceId));
  if(owners.length!==1)throw Error('The Surface does not have exactly one retained workspace host.');
  const owner=owners[0],binding=owner.surfaces[surfaceId];
  if(!binding||owner.detached?.some(row=>row.surfaceId===surfaceId))throw Error('Return the actual detached Surface before moving its tab.');
  const stripPane=(pane:import('../surface/types').Pane):import('../surface/types').Pane=>pane.type==='split'?{...pane,children:pane.children.map(stripPane)}:{...pane,tabs:pane.tabs.filter(id=>id!==surfaceId),pinned:pane.pinned.filter(id=>id!==surfaceId),active:pane.active===surfaceId?(pane.tabs.filter(id=>id!==surfaceId)[0]??null):pane.active};
  const strip=(layout:LayoutState):LayoutState=>{
    if(layout!==owner)return layout;
    const surfaces={...layout.surfaces};delete surfaces[surfaceId];
    return {...layout,surfaces,root:layout.root?stripPane(layout.root):null,sidePane:layout.sidePane?stripPane(layout.sidePane) as typeof layout.sidePane:undefined,closedStack:layout.closedStack.filter(id=>id!==surfaceId)};
  };
  let layout=strip(workspace.layout);
  if(into==='tree')layout=openBinding(layout,binding);
  else{
    const pane=layout.sidePane??{type:'group' as const,id:'side-panel',tabs:[],pinned:[],active:null};
    layout={...layout,surfaces:{...layout.surfaces,[binding.id]:binding},sidePane:{...pane,tabs:[...pane.tabs,binding.id],active:binding.id},rightDepth:'panel'};
  }
  return {...workspace,layout,modeLayouts:Object.fromEntries(Object.entries(workspace.modeLayouts??{}).map(([mode,saved])=>[mode,strip(saved)]))};
}
/** An asynchronous view/checkpoint update returns to its originating binding,
 * including a hidden mode. It never changes the selected tree or focus. */
export function updateWorkspaceBinding(workspace: Workspace, surfaceId: string, change: (binding: import("../surface/types").SurfaceBinding) => import("../surface/types").SurfaceBinding): Workspace {
  const layouts = [workspace.layout,...Object.values(workspace.modeLayouts ?? {})];
  const owners = layouts.filter(layout => layout.surfaces[surfaceId]);
  if (!owners.length) return workspace; // Explicitly closed while the request ran.
  if (owners.length !== 1) throw Error("The Surface has more than one stored binding owner");
  const original = owners[0].surfaces[surfaceId], next = change(original);
  if (next.id !== original.id) throw Error("A checkpoint cannot change its Surface identity");
  if (original.ref && !original.pending && next.ref !== original.ref) throw Error("A checkpoint cannot replace its native subject");
  const write = (layout: LayoutState) => layout === owners[0] ? {...layout,surfaces:{...layout.surfaces,[surfaceId]:next}} : layout;
  if (owners[0] === workspace.layout) return {...workspace,layout:write(workspace.layout)};
  return {...workspace,modeLayouts:Object.fromEntries(Object.entries(workspace.modeLayouts ?? {}).map(([mode,layout]) => [mode,write(layout)]))};
}
/** A detached Surface's entry leaves every layout of one workspace (the current layout and each saved mode layout), with its
 * binding. The traversal is `redock`'s, but nothing returns to a centre tab: a device has no kernel surface, so its binding
 * leaves with its entry. Other entries and other workspaces are untouched; no match returns the workspace itself. */
export function dropWorkspaceDetached(workspace: Workspace, surfaceId: string): Workspace {
  const drop = (layout: LayoutState): LayoutState => {
    if (!layout.detached?.some(entry => entry.surfaceId === surfaceId)) return layout;
    const surfaces = {...layout.surfaces};
    delete surfaces[surfaceId];
    return {...layout, surfaces, detached: layout.detached.filter(entry => entry.surfaceId !== surfaceId)};
  };
  const layout = drop(workspace.layout);
  const modeLayouts = workspace.modeLayouts
    ? Object.fromEntries(Object.entries(workspace.modeLayouts).map(([mode, saved]) => [mode, saved && drop(saved)])) as Workspace["modeLayouts"]
    : undefined;
  const unchanged = layout === workspace.layout && (!workspace.modeLayouts || Object.entries(workspace.modeLayouts).every(([mode, saved]) => modeLayouts?.[mode as keyof typeof modeLayouts] === saved));
  return unchanged ? workspace : {...workspace, layout, ...(modeLayouts ? {modeLayouts} : {})};
}
/** One device window stands for the device across the whole book, so its closing drops the entry from every workspace
 * (see dropWorkspaceDetached). Returns the same array when no workspace held the entry. */
export function dropDetachedAcrossWorkspaces(workspaces: Workspace[], surfaceId: string): Workspace[] {
  const next = workspaces.map(workspace => dropWorkspaceDetached(workspace, surfaceId));
  return next.every((workspace, index) => workspace === workspaces[index]) ? workspaces : next;
}
/**
 * Book versions. v1: one pane tree per workspace (`layout`), with optional
 * presentation fields decoded leniently. v2 (this writer): per-mode trees —
 * `layout` is the active mode's tree, `modeLayouts` holds the others — plus
 * the world `context`. A v1 book upgrades cleanly and losslessly on load: its
 * single tree becomes the tree of the mode it recorded (`layout.mode`, absent
 * = base) and every other mode starts on its default. v2 is a real shape
 * change (a v1 reader would restore only the active mode's tree and drop the
 * rest on its next save), so the version is bumped; a v1-only build meeting a
 * v2 book retains it byte-exact through the recovery path, never overwrites.
 */
export interface WorkspaceBook { version: 2; active: string; workspaces: Workspace[]; pool?: PoolSettings }
const KEY = "oi-cradle.workspaces.v1";
export interface WorkspaceStorageOptions { storageKey?: string; legacyLayoutKey?: string | null }
export function workspaceStorageNamespace(options: WorkspaceStorageOptions = {}) {
  const key = options.storageKey ?? KEY;
  if (!key || key.length > 256) throw Error("Choose a bounded workspace storage namespace");
  const candidate = key !== KEY;
  return {key, legacyKey: options.legacyLayoutKey === undefined ? (candidate ? null : "oi-cradle.layout.v1") : options.legacyLayoutKey,
    journalKey: candidate ? `${key}.stage` : "oi-cradle.book.stage.v1",
    recovery: {pointer: candidate ? `${key}.recovery.latest` : "oi-cradle.recovery.latest", prefix: candidate ? `${key}.recovery.` : "oi-cradle.recovery."},
    draftPrefix: candidate ? `${key}.unplaced-draft:` : "oi-cradle.unplaced-draft.v1:"};
}
function scopeLegacyIds(layout:LayoutState,workspaceId:string,all=false):LayoutState {
  const id=(value:string)=>all||/^s[0-9]+$/.test(value)?`${workspaceId}:${value}`:value;
  const pane=(p:import("../surface/types").Pane):import("../surface/types").Pane=>p.type==="split"?{...p,children:p.children.map(pane)}:{...p,tabs:p.tabs.map(id),pinned:p.pinned.map(id),active:p.active?id(p.active):null};
  return {...layout,windowBounds:Object.fromEntries(Object.entries(layout.windowBounds??{}).map(([key,bounds])=>[id(key),bounds])),root:layout.root?pane(layout.root):null,surfaces:Object.fromEntries(Object.values(layout.surfaces).map(b=>[id(b.id),{...b,id:id(b.id)}])),closedStack:layout.closedStack.map(id),detached:layout.detached?.map(d=>({...d,surfaceId:id(d.surfaceId)}))};
}
/**
 * Writing used to live on the workspace record itself (`writing`), rendered by
 * a canvas that no longer exists. Any record still carrying that text — an old
 * saved arrangement, or one coming back through recovery — has its writing
 * carried into an unsaved-writing surface so it is actually restored and
 * visible, rather than surviving as a field nothing renders.
 */
function carryLegacyWriting(workspace: Workspace, draftPrefix = "oi-cradle.unplaced-draft.v1:"): Workspace {
  const text = typeof workspace.writing === "string" ? workspace.writing : "";
  if (!text.trim()) return workspace;
  const held = Object.values(workspace.layout.surfaces).some(binding => binding.kind === "draft");
  if (held) return workspace;
  const id = `${workspace.id}:carried-writing`;
  try { localStorage.setItem(`${draftPrefix}${id}`, JSON.stringify({ text, at: Date.now() })); }
  catch { return workspace; }
  const binding = { id, kind: "draft", title: "Draft", project: workspace.project };
  const layout = openBinding(workspace.layout, binding);
  return { ...workspace, writing: "", writingMode: false, layout };
}
/**
 * The pin model (workspace/mode.ts) replaced the old strip/list/hidden cycle,
 * and persist.ts's codec knows only the current names — so the store's load
 * path is the one place the older vocabulary is translated: the raw record's
 * presentation is upgraded in place before `decodeLayout` reads it (strip →
 * pinned horizontal, written as the absent default; list → pinned vertical;
 * hidden → unpinned). The same pass restores the two fields the codec does
 * not carry — the vertical list's persisted width and the pin orientation an
 * unpinned pane reveals — from the raw record, clamped.
 */
function decodeWorkspaceLayout(raw: unknown): LayoutState {
  let legacyPresentation: import("../workspace/mode").TabPresentation | undefined;
  let legacyOrientation: "horizontal" | "vertical" | undefined;
  if (raw && typeof raw === "object") {
    const record = raw as {tabPresentation?: unknown; tabPinOrientation?: unknown};
    const upgraded = upgradeTabPresentation(record.tabPresentation);
    if (upgraded === undefined) delete record.tabPresentation;
    else record.tabPresentation = upgraded;
    legacyPresentation = upgraded;
    legacyOrientation = record.tabPinOrientation === "vertical" ? "vertical" : record.tabPinOrientation === "horizontal" ? "horizontal" : undefined;
  }
  const geometry = (raw ?? {}) as {tabListWidth?: unknown};
  const layout = {...decodeLayout(raw), tabListWidth: clampTabListWidth(geometry.tabListWidth)};
  // A legacy workspace carried its pin state at the top level: it becomes
  // every pane's own (the pin is per pane now, owner ruling 2026-09-17).
  if ((legacyPresentation || legacyOrientation) && layout.root) {
    const withPresentation=(pane: import("../surface/types").Pane): import("../surface/types").Pane =>
      pane.type==="split" ? {...pane, children: pane.children.map(withPresentation)} : {...pane, tabPresentation: legacyPresentation, tabPinOrientation: legacyOrientation};
    layout.root = withPresentation(layout.root);
  }
  return layout;
}
const initialLayout = (): LayoutState => ({ ...freshLayout(), agencyDepth: "panel", rightDepth: "collapsed", leftWidth: 240, rightWidth: 320 });
/** One workspace restored from its raw record, or quarantined. The
 * per-workspace quarantine law (owner-approved 2026-09-19): ONE broken
 * record never rejects the whole book — that workspace loads empty, keeps
 * its name, and the note names it (the footer message system discloses it);
 * every healthy workspace restores untouched. BELOW the workspace grain the
 * recovery is progressive (workspace-continuity WF1): a damaged binding or
 * view record is dropped and named while its valid siblings restore — only
 * a record nothing restorable survives empties the workspace and names why. */
function restoreWorkspace(w: Workspace, draftPrefix?: string): {workspace: Workspace; notes: string[]} {
  const notes: string[] = [];
  try {
    if (typeof w.id !== "string" || typeof w.name !== "string" || typeof w.writing !== "string" || (w.project !== undefined && typeof w.project !== "string")) throw new Error("Invalid workspace record");
    const restore=(raw:LayoutState):LayoutState=>{
      if(!raw || typeof raw!=="object" || !raw.surfaces)throw new Error("Invalid workspace record");
      const progressive=decodeLayoutProgressive(raw,w.id);
      notes.push(...progressive.notes);
      if(!progressive.layout)throw new Error(progressive.notes.join(" ")||"No saved surface bindings could be restored");
      // The store's own presentation upgrades (legacy pin vocabulary, width
      // clamp) stay store-owned: progressive decode sanitized the raw
      // record, this pass reads it exactly as a healthy record is read.
      return scopeLegacyIds(decodeWorkspaceLayout(progressive.sanitized),w.id);
    };
    const layout=restore(w.layout);
    // A mode's waiting tree restores under the same law as the active one;
    // the active mode never also appears among the waiting trees.
    const activeMode:WorkspaceMode=layout.mode??"base";
    const modeLayouts=Object.fromEntries(WORKSPACE_MODES.filter(mode=>mode!==activeMode&&w.modeLayouts?.[mode]).map(mode=>[mode,{...restore(w.modeLayouts![mode]!),mode:mode==="base"?undefined:mode}])) as Workspace["modeLayouts"];
    const projectNavigation = Object.fromEntries(Object.entries(w.projectNavigation ?? {}).map(([ref, state]) => {
      if (!state || typeof state.expanded !== "boolean" || !Number.isFinite(state.scroll) || state.scroll < 0) throw new Error("Invalid project navigation state");
      if(state.directories !== undefined && (!Array.isArray(state.directories) || state.directories.some(path=>typeof path!=="string"))) throw new Error("Invalid directory expansion state");
      if (state.mode !== undefined && !["chats", "files", "wiki"].includes(state.mode)) throw new Error("Invalid project mode");
      return [ref, { expanded: state.expanded, scroll: state.scroll, directories: state.directories, mode: state.mode ?? "files", locationPath: state.locationPath }];
    }));
    // A named set that no longer restores is dropped on its own, never the workspace with it.
    const sets = decodeNamedSets(w.sets, raw => { const before = notes.length; try { return restore(raw); } finally { notes.length = before; } });
    // A kept context restores under the same law as the live trees; one that no longer restores is dropped on its own.
    const kept = ((): KeptContext | undefined => {
      const raw = w.kept as KeptContext | undefined;
      if (!raw || typeof raw !== "object" || typeof raw.keptAt !== "number") return undefined;
      const before = notes.length;
      try {
        const keptLayout = restore(raw.layout);
        const keptMode: WorkspaceMode = keptLayout.mode ?? "base";
        const keptModes = Object.fromEntries(WORKSPACE_MODES.filter(mode => mode !== keptMode && raw.modeLayouts?.[mode]).map(mode => [mode, { ...restore(raw.modeLayouts![mode]!), mode: mode === "base" ? undefined : mode }]));
        return { layout: keptLayout, ...(Object.keys(keptModes).length ? { modeLayouts: keptModes } : {}), ...(decodeWidgetRail(raw.widgets) ? { widgets: decodeWidgetRail(raw.widgets) } : {}), keptAt: raw.keptAt };
      } catch { notes.length = before; return undefined; }
    })();
    const keeps = decodeKeeps(w.keeps), opensIn = decodeOpensIn(w.opensIn);
    return {workspace: carryLegacyWriting({ projectNavigation, centralFiles: w.centralFiles === true, id: w.id, name: w.name, project: w.project, writing: w.writing, writingMode: false, layout, modeLayouts, context: decodeWorldContext(w.context), recentPlaces: decodeRecentPlaces(w.recentPlaces), sets, widgets: decodeWidgetRail(w.widgets), lastVisitedAt: typeof w.lastVisitedAt === "number" ? w.lastVisitedAt : undefined, ...(keeps ? { keeps } : {}), ...(opensIn ? { opensIn } : {}), ...(kept ? { kept } : {}) }, draftPrefix), notes};
  } catch (error) {
    // The record still names itself when its name is readable; its
    // identifier survives only when it is a string no healthy workspace
    // holds (a quarantined record never shadows a restored one).
    const name = typeof w?.name === "string" && w.name.trim() ? w.name.trim() : "Recovered workspace";
    const id = typeof w?.id === "string" && w.id ? w.id : crypto.randomUUID();
    return {workspace: { id, name, writing: "", layout: initialLayout() }, notes: [`Workspace "${name}" could not be restored and was left empty: ${error instanceof Error ? error.message : String(error)}`]};
  }
}
interface LoadedBook { book: WorkspaceBook; quarantine: string[] }
/** The parsed book restored record by record (the per-workspace quarantine
 * law plus the progressive notes beneath it). */
function restoreBook(parsed: {version?: unknown; active?: unknown; workspaces?: unknown}, draftPrefix?: string): LoadedBook {
  if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.workspaces)) throw new Error("Unrecognized workspace format");
  const restored = (parsed.workspaces as Workspace[]).map(w => restoreWorkspace(w,draftPrefix));
  const quarantine = restored.flatMap(result => result.notes);
  // Identifier uniqueness is repaired, never fatal: a colliding record
  // (quarantined or duplicated) mints its own id so no workspace shadows
  // another — the book still opens with everything it could restore.
  const taken = new Set<string>();
  const workspaces = restored.map(result => {
    if (!taken.has(result.workspace.id)) { taken.add(result.workspace.id); return result.workspace; }
    const renamed = { ...result.workspace, id: crypto.randomUUID() };
    const firstNote = result.notes[0];
    if (firstNote !== undefined) quarantine[quarantine.indexOf(firstNote)] = `${firstNote} Its saved identifier collided with another workspace; it was given its own.`;
    else quarantine.push(`Two workspaces shared the identifier of "${result.workspace.name}"; the second was given its own.`);
    taken.add(renamed.id);
    return renamed;
  });
  // The active selection survives when its workspace restored; otherwise
  // the first restored workspace stands in — the book still opens. The
  // active workspace is where the person IS: its visit stamp is refreshed
  // on every load, so the retention warm set always includes it even before
  // its first in-session activation.
  if (!workspaces.length) throw new Error("Invalid workspace selection");
  const active = workspaces.some((w: Workspace) => w.id === parsed.active) ? parsed.active as string : workspaces[0].id;
  const pool = decodePoolSettings((parsed as {pool?: unknown}).pool);
  return { book: { version: 2, active, workspaces: workspaces.map(w => w.id === active ? { ...w, lastVisitedAt: Date.now() } : w), ...(pool ? { pool } : {}) }, quarantine };
}
export function loadWorkspaceBook(options: WorkspaceStorageOptions = {}): LoadedBook {
  const {key: KEY, legacyKey, journalKey, draftPrefix} = workspaceStorageNamespace(options);
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return restoreBook(JSON.parse(raw),draftPrefix);
    } catch (error) {
      // A truncated or otherwise unreadable book never discards the last
      // committed copy (WF1): the staged journal's previous slot opens,
      // naming the substitution; only when no journal copy exists does the
      // original error stand and the protected recovery path take over.
      const good = lastKnownGood(KEY,journalKey);
      if (good) {
        try {
          const outcome = restoreBook(JSON.parse(good),draftPrefix);
          outcome.quarantine = [`The saved workspace record could not be read (${error instanceof Error ? error.message : String(error)}); the last committed copy was opened instead.`, ...outcome.quarantine];
          return outcome;
        } catch { /* the journal copy is no better — the original error stands */ }
      }
      throw error;
    }
  }
  const legacyRaw=legacyKey ? localStorage.getItem(legacyKey) : null;
  let legacy=initialLayout();
  if(legacyRaw){
    const parsed=JSON.parse(legacyRaw);legacy=decodeWorkspaceLayout(parsed);
    if(!parsed || typeof parsed!=="object" || !parsed.surfaces || Object.keys(parsed.surfaces).length!==Object.keys(legacy.surfaces).length || (parsed.root&&!legacy.root))throw new Error("Legacy arrangement could not be restored");
  }
  return { book: stampActiveVisited({ version: 2, active: "root", workspaces: [{ id: "root", name: "Central", writing: "", layout: { ...initialLayout(), ...(legacy.root ? scopeLegacyIds(legacy,"root") : {}) } }] }), quarantine: [] };
}
export function useWorkspaces(options: WorkspaceStorageOptions = {}) {
  const namespace = useRef(workspaceStorageNamespace(options)).current;
  const requested = workspaceStorageNamespace(options);
  if (requested.key !== namespace.key || requested.legacyKey !== namespace.legacyKey) throw Error("A mounted workspace cannot change its persistence namespace");
  const {key: KEY, legacyKey, journalKey, recovery: recoveryNamespace, draftPrefix} = namespace;
  const load = () => loadWorkspaceBook(options);
  const preserve = (key: string, reason: string) => preservePresentation(key,reason,recoveryNamespace);
  const latest = () => latestRecovery(recoveryNamespace);
  // Save-path errors and per-workspace quarantine notes are separate
  // lifecycles that surface through the ONE footer message system: a
  // successful save clears only its own error; the quarantine note stands
  // until dismissed or a reload re-evaluates the book.
  const [saveError, setSaveError] = useState<string | null>(null);
  /** A standing answer to an explicit request (Recover arrangement with no
   * record): unlike saveError, the next successful save never clears it. */
  const [notice, setNotice] = useState<string | null>(null);
  const [quarantine, setQuarantine] = useState<string | null>(null);
  const [recovery,setRecovery]=useState<{reason:string;key?:string}|null>(null);
  const [book, setBook] = useState<WorkspaceBook>(() => {
    // A load failure never swaps the person into a recovery workspace (owner
    // ruling 2026-09-19): the last good book stands, the reason rides the
    // footer message system, and one click — the message or dismissing it —
    // reloads the workspace automatically. The original bytes stay protected
    // for the retry. A per-workspace quarantine (same ruling) is the milder
    // law: the book OPENS with the broken workspace emptied and named, its
    // original bytes preserved through the same recovery system without
    // entering the recovery presentation.
    try {
      const outcome = load();
      if (outcome.quarantine.length) {
        try { preserve(KEY, outcome.quarantine.join(" ")); } catch { /* the note still names what happened */ }
        setQuarantine(outcome.quarantine.join(" "));
      }
      return outcome.book;
    } catch(error) { try{const record=preserve(localStorage.getItem(KEY)?KEY:(legacyKey ?? KEY),String(error));setRecovery({reason:String(error),key:record.key});}catch{setRecovery({reason:"Recovery data could not be copied. Original workspace storage is protected."});} return stampActiveVisited({ version: 2, active: "root", workspaces: [{ id: "root", name: "Central", writing: "", layout: initialLayout() }] }); }
  });
  useEffect(() => { publishArrangement(book); }, [book]);
  const current = book.workspaces.find(w => w.id === book.active)!;
  // The file tree's listing cache keys on the workspace: switching releases.
  useEffect(() => { setActiveListingWorkspace(current.id); }, [current.id]);
  const held = useRef(book); held.current = book;
  // Durable persistence (workspace-continuity WF1): every change STAGES the
  // serialized candidate, writes it, and COMMITs it into the journal's
  // last-known-good slot — an interrupted write always leaves the previous
  // good copy readable, and a fallback never overwrites the only copy.
  // Writes coalesce off the hot paths (a split drag emits a book change per
  // pointermove): one trailing write 250 ms after the first change of a
  // burst, flushed on page lifecycle (pagehide / hidden) so a close never
  // relies on the timer alone. The newest book always wins — the flush
  // writes what is held now, not what scheduled it.
  const WRITE_INTERVAL_MS = 250;
  const dirty = useRef(false);
  const writeTimer = useRef<number | undefined>(undefined);
  const recoveryRef = useRef(recovery); recoveryRef.current = recovery;
  const flushNow = (): boolean => {
    if (writeTimer.current !== undefined) { window.clearTimeout(writeTimer.current); writeTimer.current = undefined; }
    if (!dirty.current) return true;
    const pending = held.current;
    // A corrupt store is retained for recovery, never overwritten by fallback.
    if (pending.active === "recovery" || (recoveryRef.current && !recoveryRef.current.key)) { setSaveError("Saved workspaces could not be restored. The original data has been retained."); return false; }
    try {
      const raw = JSON.stringify(pending);
      stageCheckpoint(KEY, raw,journalKey);
      localStorage.setItem(KEY, raw);
      commitCheckpoint(KEY,journalKey);
      dirty.current = false;
      setSaveError(null);
      return true;
    }
    catch { setSaveError("Workspace changes could not be saved on this device."); return false; }
  };
  useEffect(() => {
    dirty.current = true;
    if (writeTimer.current === undefined) writeTimer.current = window.setTimeout(flushNow, WRITE_INTERVAL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, recovery]);
  useEffect(() => {
    const onPageHide = () => flushNow();
    const onVisibility = () => { if (document.visibilityState === "hidden") flushNow(); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (writeTimer.current !== undefined) {
        window.clearTimeout(writeTimer.current);
        // Effect replay cancels the first scheduled flush. Clear its handle as
        // well, so the next setup/book change can schedule the retained dirty
        // candidate. A cancelled timer must never masquerade as pending work.
        writeTimer.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (change: (w: Workspace) => Workspace) => setBook(b => ({ ...b, workspaces: b.workspaces.map(w => w.id === b.active ? change(w) : w) }));
  const setLayout = (change: SetStateAction<LayoutState>) => update(w => ({ ...w, layout: typeof change === "function" ? change(w.layout) : change }));
  useEffect(()=>subscribeFocusedInstrumentOpen(request=>{
    const source=focusedInstrumentSource(request.sourceRef);if(!source)return;
    const binding=focusedInstrumentBinding(request);
    setLayout(state=>{
      const existing=Object.values(state.surfaces).find(surface=>surface.kind==="instrument"&&surface.ref===request.sourceRef);
      const opened=existing
        ? groupsOf(state.root).some(group=>group.tabs.includes(existing.id))
          ? activateSurface(state,existing.id)
          : openBinding({...state,closedStack:state.closedStack.filter(id=>id!==existing.id)},existing)
        : openBinding(state,binding);
      // K9 composes the shell's existing navigator/centre/AgentLayer. The
      // accompanying ref is accepted only from the registered owner source.
      return {...opened,agencyDepth:"panel",rightDepth:"panel",accompanying:source.accompanying??opened.accompanying};
    });
  // setLayout is a presentation setter over the current workspace; this
  // subscription intentionally lives for the lifetime of this hook instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[]);
  const setWritingMode = (writingMode: boolean) => update(w => ({ ...w, writingMode }));
  const setWriting = (writing: string) => update(w => ({ ...w, writing }));
  const activate = (id: string) => setBook(b => b.workspaces.some(w => w.id === id) ? { ...b, active: id, workspaces: b.workspaces.map(w => w.id === id ? { ...w, lastVisitedAt: Date.now() } : w) } : b);
  const create = (name: string) => {
    if (!name.trim() || (recovery && !recovery.key)) return;
    setBook(b => { const w: Workspace = { id: crypto.randomUUID(), name: name.trim(), writing: "", layout: initialLayout() }; return { ...b, active: w.id, workspaces: [...b.workspaces, w] }; });
  };
  const rename = (name: string) => { if (name.trim()) update(w => ({ ...w, name: name.trim() })); };
  const setCentralFiles = (centralFiles:boolean) => update(w=>({...w,centralFiles}));
  const browse = (project?: string) => update(w => ({ ...w, project, allProjects: undefined }));
  /** The one scope's writer (scope.ts): Central, a project, or Factory's All projects. */
  const browseAll = () => update(w => ({ ...w, allProjects: true }));
  const switchMode = (next: WorkspaceMode) => update(w => switchWorkspaceMode(w, next));
  /** The whole book's one change (the pool's launch, keep and its footer, the shell's own pure functions). A recovery book
   * that holds nobody's data is never changed. */
  const changeBook = (change: (book: WorkspaceBook) => WorkspaceBook) => { if (recovery && !recovery.key) return; setBook(b => change(b)); };
  const saveSet = (name: string) => update(w => saveNamedSet(w, name));
  const applySet = (id: string) => update(w => applyNamedSet(w, id));
  const removeSet = (id: string) => update(w => ({ ...w, sets: w.sets?.filter(held => held.id !== id) }));
  const toggleWidgetOpen = (id: string, defaults: readonly string[] = []) => update(w => toggleWidget(w, id, defaults));
  const pinWidgetAt = (id: string, ref: string | null) => update(w => pinWidget(w, id, ref));
  const saveWidgets = (name: string, defaults: readonly string[] = []) => update(w => saveWidgetPreset(w, name, undefined, undefined, defaults));
  const applyWidgets = (id: string) => update(w => applyWidgetPreset(w, id));
  const widenWidgets = (width: number) => update(w => setWidgetRailWidth(w, width));
  /** Move THE selection (WorldContext.selection) and record the move on the trail — the one writer every mode uses. */
  const select = (selection: WorldSelection | null) => setContext(context => selection ? selectOnTrail(context, selection, Date.now()) : { ...context, selection: undefined });
  const moveSurface=(surfaceId:string,into:"tree"|"side")=>update(w=>moveWorkspaceSurface(w,surfaceId,into));
  /** The world-context layer's one writer. `trail` pushes are bounded, and the stop you stand on stays the same stop. */
  const setContext = (change: (context: WorldContext) => WorldContext) => update(w => ({ ...w, context: boundedContext(change(w.context ?? {})) }));
  /** Presentation writes name the workspace they were made in: a disclosure
   * or scroll that resolves after an owner round trip must land in that
   * workspace even when the active one has moved on. Defaults to the active
   * workspace only for callers that have no such origin. */
  const rememberPlace = (place: Omit<WorkspaceRecentPlace,"visitedAt"> & {visitedAt?:number}, workspaceId?: string) => setBook(b => ({
    ...b, workspaces: b.workspaces.map(w => w.id === (workspaceId ?? b.active) ? withRecentPlace(w,place) : w)
  }));
  const setProjectNavigation = (projectRef: string, change: Partial<ProjectNavigation>, workspaceId?: string) => setBook(b => ({
    ...b, workspaces: b.workspaces.map(w => {
      if(w.id !== (workspaceId ?? b.active))return w;
      const next={...w,projectNavigation:{...w.projectNavigation,[projectRef]:{expanded:true,scroll:0,...w.projectNavigation?.[projectRef],...change}}};
      if(typeof change.locationPath!=="string"||!change.locationPath)return next;
      const path=change.locationPath,label=path.split("/").filter(Boolean).slice(-1)[0]??path;
      return withRecentPlace(next,{kind:"directory",label,path,project:w.project,projectRef});
    })
  }));
  const windowBounds = (workspaceId:string,surfaceId:string,bounds:import("../surface/types").NativeWindowBounds) => setBook(b=>({...b,workspaces:b.workspaces.map(w=>{
    if(w.id!==workspaceId)return w;
    const write=(layout:import("../surface/types").LayoutState)=>layout.surfaces[surfaceId]&&layout.detached?.some(entry=>entry.surfaceId===surfaceId)?{...layout,windowBounds:{...layout.windowBounds,[surfaceId]:bounds}}:layout;
    const layout=write(w.layout),modeLayouts=w.modeLayouts?Object.fromEntries(Object.entries(w.modeLayouts).map(([mode,saved])=>[mode,write(saved)])) as Workspace['modeLayouts']:undefined;
    return layout===w.layout&&(!w.modeLayouts||Object.entries(w.modeLayouts).every(([mode,saved])=>modeLayouts?.[mode as keyof typeof modeLayouts]===saved))?w:{...w,layout,...(modeLayouts?{modeLayouts}:{})};
  })}));
  const replaceSurface=(workspaceId:string,binding:import("../surface/types").SurfaceBinding)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>w.id===workspaceId?updateWorkspaceBinding(w,binding.id,()=>binding):w)}));
  const surfaceView=(workspaceId:string,id:string,view:NonNullable<import("../surface/types").SurfaceBinding["view"]>)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>w.id===workspaceId?updateWorkspaceBinding(w,id,binding=>({...binding,view})):w)}));
  /** The hosted engine's checkpoint (surface/types.ts `engine`), named by
   * workspace like every presentation write. The binding may stand in the
   * active mode's tree or in a waiting tree's `modeLayouts` (a hidden
   * stage's centre) — the writer finds it wherever it lives; exactly one
   * layout per workspace carries the binding. */
  const surfaceEngine=(workspaceId:string,id:string,engine:NonNullable<import("../surface/types").SurfaceBinding["engine"]>)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>{
    if(w.id!==workspaceId)return w;
    const write=(layout:import("../surface/types").LayoutState):import("../surface/types").LayoutState=>layout.surfaces[id]?{...layout,surfaces:{...layout.surfaces,[id]:{...layout.surfaces[id],engine}}}:layout;
    const active=write(w.layout);
    if(active!==w.layout)return {...w,layout:active};
    if(!w.modeLayouts||!Object.values(w.modeLayouts).some(layout=>layout.surfaces[id]))return w;
    const modeLayouts=Object.fromEntries(Object.entries(w.modeLayouts).map(([mode,layout])=>[mode,write(layout)])) as Workspace["modeLayouts"];
    return {...w,modeLayouts};
  })}));
  const redock = (workspaceId:string,surfaceId:string) => setBook(b=>({...b,workspaces:b.workspaces.map(w=>{
    if(w.id!==workspaceId)return w;
    const write=(layout:import("../surface/types").LayoutState)=>layout.detached?.some(entry=>entry.surfaceId===surfaceId)?redockBinding(layout,surfaceId):layout;
    const layout=write(w.layout),modeLayouts=w.modeLayouts?Object.fromEntries(Object.entries(w.modeLayouts).map(([mode,saved])=>[mode,write(saved)])) as Workspace['modeLayouts']:undefined;
    return layout===w.layout&&(!w.modeLayouts||Object.entries(w.modeLayouts).every(([mode,saved])=>modeLayouts?.[mode as keyof typeof modeLayouts]===saved))?w:{...w,layout,...(modeLayouts?{modeLayouts}:{})};
  })}));
  /** A device window closed, wherever it was popped out from: its entry leaves every workspace of the book (see
   * dropDetachedAcrossWorkspaces). A device never returns as a centre tab. No change keeps the same book. */
  const dropDetachedEverywhere = (surfaceId: string) => setBook(b => {
    const workspaces = dropDetachedAcrossWorkspaces(b.workspaces, surfaceId);
    return workspaces === b.workspaces ? b : {...b, workspaces};
  });
  /** One click, one reload (owner ruling 2026-09-19): retry the load from
   * the protected storage; success clears the standing message, failure
   * re-reports through the same footer path. Pending coalesced state is
   * flushed FIRST — the retry must read what was actually done, not what
   * had been written when the timer last fired. */
  const reload=()=>{if(!flushNow())return;try{const outcome=load();setBook(outcome.book);setRecovery(null);setSaveError(null);if(outcome.quarantine.length){try{preserve(KEY,outcome.quarantine.join(" "));}catch{}setQuarantine(outcome.quarantine.join(" "));}else setQuarantine(null);}catch(error){try{const record=preserve(localStorage.getItem(KEY)?KEY:(legacyKey ?? KEY),String(error));setRecovery({reason:String(error),key:record.key});}catch{setRecovery({reason:"Recovery data could not be copied. Original workspace storage is protected."});}}};
  const startFresh=()=>{if(recovery&&!recovery.key)return;setBook(stampActiveVisited({version:2,active:"root",workspaces:[{id:"root",name:"Central",writing:"",layout:initialLayout()}]}));setRecovery(null);};
  const recoverAvailable=()=>{
    const saved=latest();if(!saved)return;
    try {
      const raw=JSON.parse(saved.raw);const candidates=Array.isArray(raw.workspaces)?raw.workspaces:saved.sourceKey===legacyKey?[{name:"Recovered arrangement",layout:raw}]:[];
      const restored:Workspace[]=candidates.filter((w:unknown)=>w&&typeof w==="object").map((w:Workspace,index:number)=>{
        const id=crypto.randomUUID();
        const projectNavigation=Object.fromEntries(Object.entries(w.projectNavigation??{}).filter(([,state])=>state&&typeof state.expanded==="boolean"&&Number.isFinite(state.scroll)&&state.scroll>=0).map(([ref,state])=>[ref,{expanded:state.expanded,scroll:state.scroll,mode:state.mode&&["chats","files","wiki"].includes(state.mode)?state.mode:"chats",directories:Array.isArray(state.directories)?state.directories.filter(path=>typeof path==="string"):undefined,locationPath:typeof state.locationPath==="string"?state.locationPath:undefined}]));
        return carryLegacyWriting({id,name:typeof w.name==="string"?w.name:`Recovered ${index+1}`,project:typeof w.project==="string"?w.project:undefined,centralFiles:w.centralFiles===true,projectNavigation,recentPlaces:decodeRecentPlaces(w.recentPlaces),writing:typeof w.writing==="string"?w.writing:"",writingMode:false,layout:scopeLegacyIds(decodeWorkspaceLayout(w.layout),id,true)},draftPrefix);
      });
      if(!restored.length){setSaveError("No complete workspace records could be recovered. The original bytes remain retained.");return;}
      setBook(book=>stampActiveVisited({version:2,active:restored[0].id,workspaces:[...book.workspaces.filter(workspace=>workspace.id!=="recovery"||!!workspace.writing),...restored]}));setRecovery(null);
    }catch{setSaveError("The retained data is not readable as workspace records. It remains preserved for recovery.");}
  };
  const showRecovery=()=>{const saved=latest();if(saved)setRecovery({reason:saved.reason,key:saved.key});else setNotice("There is no retained workspace recovery record on this device.");};
  const error=[quarantine,saveError,notice].filter(Boolean).join(" ")||null;
  return { flushCheckpoint: flushNow, storageNamespace: namespace, book, changeBook, switchMode, saveSet, applySet, removeSet, toggleWidgetOpen, pinWidgetAt, saveWidgets, applyWidgets, widenWidgets, select, moveSurface, setContext, replaceSurface, surfaceView, surfaceEngine, showRecovery,recovery,reload,startFresh,recoverAvailable, setCentralFiles, rememberPlace, setProjectNavigation, browseAll, windowBounds, redock, dropDetachedEverywhere, current, setWritingMode, workspaces: book.workspaces, setLayout, setWriting, activate, browse, create, rename, error, dismissError: () => { setQuarantine(null); setSaveError(null); setNotice(null); } };
}
