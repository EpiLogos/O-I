import {preservePresentation,latestRecovery} from "./recovery";
import {commitCheckpoint,lastKnownGood,stageCheckpoint,decodeLayoutProgressive} from "./checkpoints";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { activateSurface, groupsOf, openBinding, redockBinding } from "../surface/engine";
import { decodeLayout } from "../surface/persist";
import { freshLayout, type LayoutState } from "../surface/types";
import {clampTabListWidth,upgradeTabPresentation,isWorkspaceMode,TREE_MODES,WORKSPACE_MODES,type WorkspaceMode} from "../workspace/mode";
import {focusedInstrumentBinding,focusedInstrumentSource,subscribeFocusedInstrumentOpen} from "../instrument/source";
import {setActiveListingWorkspace} from "../files/listingStore";

export type ProjectMode = "chats" | "files" | "wiki";
export interface ProjectNavigation { expanded: boolean; scroll: number; directories?: string[]; mode?: ProjectMode; locationPath?: string }
export interface Workspace {
  id: string; name: string;
  /** Owner query restored by a native read; never imported as semantic focus. */
  project?: string;
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
  /** When the person last stood in this workspace (the retention warm set's
   * recency order — surface/retention.tsx keeps the active workspace plus
   * the most recently visited ones warm). Presentation bookkeeping, never
   * semantic. */
  lastVisitedAt?: number;
}
/** The selected world is independent of the arrangement: entering Epi-Logos
 * selects its world, and examining one of its Expressions in Technè or opening
 * its source in Base is still within Epi-Logos until the person leaves it.
 * `trail` is the route back: each drill-through records where it came from so
 * "return" lands on the same mode, surface and reading position. Refs and
 * positions only — never content, never an authority reading. */
export type WorldRef = "central" | "epi-logos";
export interface TrailStop { mode: WorkspaceMode; surfaceRef?: string; surfaceKind?: string; label: string; position?: string }
export interface WorldContext {
  world?: WorldRef;
  subject?: { ref?: string; kind?: string; title: string; project?: string };
  reading?: { ref: string; position?: string };
  trail?: TrailStop[];
}
const TRAIL_LIMIT = 24;
const text = (value: unknown, max = 512): string | undefined => typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
export function decodeWorldContext(raw: unknown): WorldContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const subjectRaw = r.subject as Record<string, unknown> | undefined;
  const readingRaw = r.reading as Record<string, unknown> | undefined;
  const subject = subjectRaw && typeof subjectRaw === "object" && text(subjectRaw.title) ? { ref: text(subjectRaw.ref), kind: text(subjectRaw.kind, 64), title: text(subjectRaw.title)!, project: text(subjectRaw.project) } : undefined;
  const reading = readingRaw && typeof readingRaw === "object" && text(readingRaw.ref) ? { ref: text(readingRaw.ref)!, position: text(readingRaw.position) } : undefined;
  const trail = Array.isArray(r.trail) ? r.trail.flatMap((stop): TrailStop[] => {
    const o = stop as Record<string, unknown> | null;
    return o && typeof o === "object" && isWorkspaceMode(o.mode) && text(o.label) ? [{ mode: o.mode, label: text(o.label)!, surfaceRef: text(o.surfaceRef), surfaceKind: text(o.surfaceKind, 64), position: text(o.position) }] : [];
  }).slice(-TRAIL_LIMIT) : undefined;
  const context: WorldContext = { world: r.world === "epi-logos" ? "epi-logos" : r.world === "central" ? "central" : undefined, subject, reading, trail: trail?.length ? trail : undefined };
  return context.world || context.subject || context.reading || context.trail ? context : undefined;
}
/** What crosses a mode switch on the layout itself: the side-region widths,
 * the live accompanying session (one canonical conversation), and the
 * panel's remembered plane per mode. Everything else belongs to a mode. */
function sharedAcrossModes(layout: LayoutState): Partial<LayoutState> {
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
  const layout: LayoutState = { ...base, ...sharedAcrossModes(workspace.layout), mode: next === "base" ? undefined : next, modeRegions: undefined };
  const context: WorldContext | undefined = next === "epi-logos" ? { ...workspace.context, world: "epi-logos" } : workspace.context;
  return { ...workspace, layout, modeLayouts: rest, context };
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
interface WorkspaceBook { version: 2; active: string; workspaces: Workspace[] }
const KEY = "oi-cradle.workspaces.v1";
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
function carryLegacyWriting(workspace: Workspace): Workspace {
  const text = typeof workspace.writing === "string" ? workspace.writing : "";
  if (!text.trim()) return workspace;
  const held = Object.values(workspace.layout.surfaces).some(binding => binding.kind === "draft");
  if (held) return workspace;
  const id = `${workspace.id}:carried-writing`;
  try { localStorage.setItem(`oi-cradle.unplaced-draft.v1:${id}`, JSON.stringify({ text, at: Date.now() })); }
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
function restoreWorkspace(w: Workspace): {workspace: Workspace; notes: string[]} {
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
    return {workspace: carryLegacyWriting({ projectNavigation, centralFiles: w.centralFiles === true, id: w.id, name: w.name, project: w.project, writing: w.writing, writingMode: false, layout, modeLayouts, context: decodeWorldContext(w.context), lastVisitedAt: typeof w.lastVisitedAt === "number" ? w.lastVisitedAt : undefined }), notes};
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
function restoreBook(parsed: {version?: unknown; active?: unknown; workspaces?: unknown}): LoadedBook {
  if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.workspaces)) throw new Error("Unrecognized workspace format");
  const restored = (parsed.workspaces as Workspace[]).map(restoreWorkspace);
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
  return { book: { version: 2, active, workspaces: workspaces.map(w => w.id === active ? { ...w, lastVisitedAt: Date.now() } : w) }, quarantine };
}
function load(): LoadedBook {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return restoreBook(JSON.parse(raw));
    } catch (error) {
      // A truncated or otherwise unreadable book never discards the last
      // committed copy (WF1): the staged journal's previous slot opens,
      // naming the substitution; only when no journal copy exists does the
      // original error stand and the protected recovery path take over.
      const good = lastKnownGood(KEY);
      if (good) {
        try {
          const outcome = restoreBook(JSON.parse(good));
          outcome.quarantine = [`The saved workspace record could not be read (${error instanceof Error ? error.message : String(error)}); the last committed copy was opened instead.`, ...outcome.quarantine];
          return outcome;
        } catch { /* the journal copy is no better — the original error stands */ }
      }
      throw error;
    }
  }
  const legacyRaw=localStorage.getItem("oi-cradle.layout.v1");
  let legacy=initialLayout();
  if(legacyRaw){
    const parsed=JSON.parse(legacyRaw);legacy=decodeWorkspaceLayout(parsed);
    if(!parsed || typeof parsed!=="object" || !parsed.surfaces || Object.keys(parsed.surfaces).length!==Object.keys(legacy.surfaces).length || (parsed.root&&!legacy.root))throw new Error("Legacy arrangement could not be restored");
  }
  return { book: { version: 2, active: "root", workspaces: [{ id: "root", name: "Central", writing: "", layout: { ...initialLayout(), ...(legacy.root ? scopeLegacyIds(legacy,"root") : {}) } }] }, quarantine: [] };
}
export function useWorkspaces() {
  // Save-path errors and per-workspace quarantine notes are separate
  // lifecycles that surface through the ONE footer message system: a
  // successful save clears only its own error; the quarantine note stands
  // until dismissed or a reload re-evaluates the book.
  const [saveError, setSaveError] = useState<string | null>(null);
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
        try { preservePresentation(KEY, outcome.quarantine.join(" ")); } catch { /* the note still names what happened */ }
        setQuarantine(outcome.quarantine.join(" "));
      }
      return outcome.book;
    } catch(error) { try{const record=preservePresentation(localStorage.getItem(KEY)?KEY:"oi-cradle.layout.v1",String(error));setRecovery({reason:String(error),key:record.key});}catch{setRecovery({reason:"Recovery data could not be copied. Original workspace storage is protected."});} return { version: 2, active: "root", workspaces: [{ id: "root", name: "Central", writing: "", layout: initialLayout() }] }; }
  });
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
  const flushNow = () => {
    if (writeTimer.current !== undefined) { window.clearTimeout(writeTimer.current); writeTimer.current = undefined; }
    if (!dirty.current) return;
    dirty.current = false;
    const pending = held.current;
    // A corrupt store is retained for recovery, never overwritten by fallback.
    if (pending.active === "recovery" || (recoveryRef.current && !recoveryRef.current.key)) { setSaveError("Saved workspaces could not be restored. The original data has been retained."); return; }
    try {
      const raw = JSON.stringify(pending);
      stageCheckpoint(KEY, raw);
      localStorage.setItem(KEY, raw);
      commitCheckpoint(KEY);
      setSaveError(null);
    }
    catch { setSaveError("Workspace changes could not be saved on this device."); }
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
      if (writeTimer.current !== undefined) window.clearTimeout(writeTimer.current);
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
  const browse = (project?: string) => update(w => ({ ...w, project }));
  const switchMode = (next: WorkspaceMode) => update(w => switchWorkspaceMode(w, next));
  /** The world-context layer's one writer. `trail` pushes are bounded. */
  const setContext = (change: (context: WorldContext) => WorldContext) => update(w => { const next = change(w.context ?? {}); return { ...w, context: { ...next, trail: next.trail?.slice(-TRAIL_LIMIT) } }; });
  /** Presentation writes name the workspace they were made in: a disclosure
   * or scroll that resolves after an owner round trip must land in that
   * workspace even when the active one has moved on. Defaults to the active
   * workspace only for callers that have no such origin. */
  const setProjectNavigation = (projectRef: string, change: Partial<ProjectNavigation>, workspaceId?: string) => setBook(b => ({
    ...b, workspaces: b.workspaces.map(w => w.id === (workspaceId ?? b.active) ? {
      ...w, projectNavigation: { ...w.projectNavigation, [projectRef]: { expanded: true, scroll: 0, ...w.projectNavigation?.[projectRef], ...change } }
    } : w)
  }));
  const windowBounds = (workspaceId:string,surfaceId:string,bounds:import("../surface/types").NativeWindowBounds) => setBook(b=>({...b,workspaces:b.workspaces.map(w=>w.id===workspaceId&&w.layout.surfaces[surfaceId]?{...w,layout:{...w.layout,windowBounds:{...w.layout.windowBounds,[surfaceId]:bounds}}}:w)}));
  const replaceSurface=(workspaceId:string,binding:import("../surface/types").SurfaceBinding)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>w.id===workspaceId&&w.layout.surfaces[binding.id]?{...w,layout:{...w.layout,surfaces:{...w.layout.surfaces,[binding.id]:binding}}}:w)}));
  const surfaceView=(workspaceId:string,id:string,view:NonNullable<import("../surface/types").SurfaceBinding["view"]>)=>setBook(book=>({...book,workspaces:book.workspaces.map(w=>w.id===workspaceId&&w.layout.surfaces[id]?{...w,layout:{...w.layout,surfaces:{...w.layout.surfaces,[id]:{...w.layout.surfaces[id],view}}}}:w)}));
  const redock = (workspaceId:string,surfaceId:string) => setBook(b=>({...b,workspaces:b.workspaces.map(w=>w.id===workspaceId?{...w,layout:redockBinding(w.layout,surfaceId)}:w)}));
  /** One click, one reload (owner ruling 2026-09-19): retry the load from
   * the protected storage; success clears the standing message, failure
   * re-reports through the same footer path. Pending coalesced state is
   * flushed FIRST — the retry must read what was actually done, not what
   * had been written when the timer last fired. */
  const reload=()=>{flushNow();try{const outcome=load();setBook(outcome.book);setRecovery(null);setSaveError(null);if(outcome.quarantine.length){try{preservePresentation(KEY,outcome.quarantine.join(" "));}catch{}setQuarantine(outcome.quarantine.join(" "));}else setQuarantine(null);}catch(error){try{const record=preservePresentation(localStorage.getItem(KEY)?KEY:"oi-cradle.layout.v1",String(error));setRecovery({reason:String(error),key:record.key});}catch{setRecovery({reason:"Recovery data could not be copied. Original workspace storage is protected."});}}};
  const startFresh=()=>{if(recovery&&!recovery.key)return;setBook({version:2,active:"root",workspaces:[{id:"root",name:"Central",writing:"",layout:initialLayout()}]});setRecovery(null);};
  const recoverAvailable=()=>{
    const saved=latestRecovery();if(!saved)return;
    try {
      const raw=JSON.parse(saved.raw);const candidates=Array.isArray(raw.workspaces)?raw.workspaces:saved.sourceKey==="oi-cradle.layout.v1"?[{name:"Recovered arrangement",layout:raw}]:[];
      const restored:Workspace[]=candidates.filter((w:unknown)=>w&&typeof w==="object").map((w:Workspace,index:number)=>{
        const id=crypto.randomUUID();
        const projectNavigation=Object.fromEntries(Object.entries(w.projectNavigation??{}).filter(([,state])=>state&&typeof state.expanded==="boolean"&&Number.isFinite(state.scroll)&&state.scroll>=0).map(([ref,state])=>[ref,{expanded:state.expanded,scroll:state.scroll,mode:state.mode&&["chats","files","wiki"].includes(state.mode)?state.mode:"chats",directories:Array.isArray(state.directories)?state.directories.filter(path=>typeof path==="string"):undefined,locationPath:typeof state.locationPath==="string"?state.locationPath:undefined}]));
        return carryLegacyWriting({id,name:typeof w.name==="string"?w.name:`Recovered ${index+1}`,project:typeof w.project==="string"?w.project:undefined,centralFiles:w.centralFiles===true,projectNavigation,writing:typeof w.writing==="string"?w.writing:"",writingMode:false,layout:scopeLegacyIds(decodeWorkspaceLayout(w.layout),id,true)});
      });
      if(!restored.length){setSaveError("No complete workspace records could be recovered. The original bytes remain retained.");return;}
      setBook(book=>({version:2,active:restored[0].id,workspaces:[...book.workspaces.filter(workspace=>workspace.id!=="recovery"||!!workspace.writing),...restored]}));setRecovery(null);
    }catch{setSaveError("The retained data is not readable as workspace records. It remains preserved for recovery.");}
  };
  const showRecovery=()=>{const saved=latestRecovery();if(saved)setRecovery({reason:saved.reason,key:saved.key});else setSaveError("There is no retained workspace recovery record on this device.");};
  const error=[quarantine,saveError].filter(Boolean).join(" ")||null;
  return { switchMode, setContext, replaceSurface, surfaceView, showRecovery,recovery,reload,startFresh,recoverAvailable, setCentralFiles, setProjectNavigation, windowBounds, redock, current, setWritingMode, workspaces: book.workspaces, setLayout, setWriting, activate, browse, create, rename, error, dismissError: () => { setQuarantine(null); setSaveError(null); } };
}
