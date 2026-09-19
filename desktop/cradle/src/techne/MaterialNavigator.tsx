/**
 * The Technè mode's LEFT body: a filesystem/material navigator over Central's
 * real file route. Directories are listed through the kernel (`files_list` →
 * the owner's `directory_read`); a folder reads only when it is opened. The
 * tree is rooted at the current project's path (from the kernel's world
 * reading) when a project is given, else at Central's root.
 *
 *   Enter / double-click   open the file in the centre (`onOpenFile`)
 *   A · the row's + tool   add the file's location to the active Technè scene
 *   drag a file row        carries `application/x-oi-location` (its
 *                          CentralLocation as JSON) and `text/plain` (its path)
 *   ↑ ↓ Home End ← →       move, fold and unfold
 *
 * Sidebar law: no visible scrollbar, no scroll chaining. A folder's own read
 * refusal (or a file's open refusal) renders inline under that row; a failure
 * of the navigator's root reading also goes to the footer through `onMessage`.
 */
import {useCallback, useEffect, useRef, useState, type KeyboardEvent} from "react";
import {useKernel} from "../kernel/KernelProvider";
import type {CentralLocation, NativeDirectory, NativeFileEntry} from "../kernel/types";
import {listFiles} from "../files/client";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "../expressions/icons";
import {LOCATION_DRAG_TYPE, addToActiveMaterialScene, forgetDirectoryListing, materialRefKey, noteDirectoryListing, useMaterialState} from "./material";
import "./techne.css";

const EXPANDED_KEY = "oi-cradle.techne.navigator.v1";
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

function loadExpanded(root: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(EXPANDED_KEY) ?? "null");
    const held = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[root] : undefined;
    return Array.isArray(held) ? held.filter((path): path is string => typeof path === "string") : [];
  } catch { return []; }
}
function saveExpanded(root: string, expanded: string[]) {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(EXPANDED_KEY) ?? "null");
    window.localStorage.setItem(EXPANDED_KEY, JSON.stringify({...(parsed && typeof parsed === "object" ? parsed : {}), [root]: expanded}));
  } catch { /* per-viewer convenience only */ }
}

interface TreeApi {
  expanded: ReadonlySet<string>;
  toggle(path: string, open?: boolean): void;
  selected: string | undefined;
  select(path: string): void;
  open(entry: NativeFileEntry): Promise<void>;
  add(entry: NativeFileEntry): void;
  inScene: ReadonlySet<string>;
  rowErrors: Record<string, string>;
  refresh: number;
}

export function MaterialNavigator({project, onOpenFile, onMessage}: {project?: string; onOpenFile: (location: CentralLocation) => Promise<void> | void; onMessage: (message: string) => void}) {
  const kernel = useKernel();
  const material = useMaterialState();
  const unavailable = kernel.transport.kind === "unavailable" ? kernel.transport.reason : null;
  // The project's path is the owner's: Central's world reading names it.
  const world = kernel.snapshot.navigator;
  const known = project ? world?.root?.work.projects.find(candidate => candidate.name === project || candidate.path === project) ?? (world?.project?.project.name === project ? world.project.project : undefined) : undefined;
  const rootPath = known?.path ?? "";
  const rootLabel = known ? known.name : "Central";
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(loadExpanded(rootPath)));
  useEffect(() => { setExpanded(new Set(loadExpanded(rootPath))); }, [rootPath]);
  const [selected, setSelected] = useState<string>();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const tree = useRef<HTMLDivElement>(null);
  const message = useRef(onMessage); message.current = onMessage;

  const toggle = useCallback((path: string, open?: boolean) => setExpanded(current => {
    const next = new Set(current);
    if (open ?? !next.has(path)) next.add(path); else next.delete(path);
    saveExpanded(rootPath, [...next]);
    return next;
  }), [rootPath]);
  const clearRowError = (path: string) => setRowErrors(current => { if (!(path in current)) return current; const next = {...current}; delete next[path]; return next; });
  const open = useCallback(async (entry: NativeFileEntry) => {
    clearRowError(entry.location.path);
    try { await onOpenFile(entry.location); }
    catch (cause) { setRowErrors(current => ({...current, [entry.location.path]: text(cause)})); }
  }, [onOpenFile]);
  const add = useCallback((entry: NativeFileEntry) => {
    const result = addToActiveMaterialScene({kind: "file", location: entry.location}, entry.name);
    if (!result) message.current("No Technè surface is open to receive material. Open the Technè surface, then add again.");
  }, []);
  const activeScene = material.active ? material.scenes[material.active] : undefined;
  const inScene = new Set((activeScene?.items ?? []).map(item => materialRefKey(item.ref)));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = Array.from(tree.current?.querySelectorAll<HTMLButtonElement>('button[role="treeitem"]:not(:disabled)') ?? []);
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    rows[event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, at + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
  };

  const api: TreeApi = {expanded, toggle, selected, select: setSelected, open, add, inScene, rowErrors, refresh};
  return <nav className="tn-navigator" aria-label="Material">
    <div className="oi-panel-head tn-nav-head">
      <span className="oi-eyebrow">Material</span>
      <span className="oi-panel-head-title" title={rootPath || "Central's root"}>{rootLabel}</span>
      <span className="oi-panel-head-tools"><button type="button" className="oi-tool" aria-label="Re-read folders" title="Read the open folders again" disabled={!!unavailable} onClick={() => setRefresh(value => value + 1)}><Glyph name={ICON.refresh} size={13}/></button></span>
    </div>
    {project && !known && !unavailable && <p className="oi-note tn-nav-note">Central's world reading does not list project “{project}”; showing Central's root.</p>}
    {unavailable
      ? <p className="oi-empty" role="status">Material is unavailable: {unavailable}</p>
      : <div ref={tree} className="tn-tree oi-scroll-quiet" role="tree" aria-label={`Files under ${rootPath || "Central"}`} onKeyDown={onKeyDown}>
          <Directory path={rootPath} level={1} api={api} root onRootFailure={failure => message.current(`Material could not be listed: ${failure}`)}/>
        </div>}
  </nav>;
}

function Directory({path, level, api, root, onRootFailure}: {path: string; level: number; api: TreeApi; root?: boolean; onRootFailure?: (failure: string) => void}) {
  const {transport} = useKernel();
  const [reading, setReading] = useState<NativeDirectory>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const failed = useRef(onRootFailure); failed.current = onRootFailure;
  useEffect(() => {
    let live = true;
    setPending(true); setError(undefined);
    void listFiles(transport, path).then(
      value => { if (!live) return; setReading(value); noteDirectoryListing(path, value.entries); },
      cause => { if (!live) return; const failure = text(cause); setError(failure); failed.current?.(failure); },
    ).finally(() => { if (live) setPending(false); });
    return () => { live = false; };
  }, [transport, path, api.refresh]);
  useEffect(() => () => forgetDirectoryListing(path), [path]);
  const indent = {"--tn-depth": level - 1} as React.CSSProperties;
  if (error) return <p className="oi-refusal tn-nav-inline" style={indent} role="alert">{error}</p>;
  if (!reading) return <p className="oi-note tn-nav-inline" style={indent} role="status">Reading {root ? "material" : "folder"}…</p>;
  return <ul className="tn-dir" role="group" aria-busy={pending || undefined}>
    {reading.entries.length === 0 && <li role="none"><p className="oi-note tn-nav-inline" style={indent}>No files</p></li>}
    {reading.entries.map(entry => <Entry key={entry.location.ref} entry={entry} level={level} api={api}/>)}
  </ul>;
}

function Entry({entry, level, api}: {entry: NativeFileEntry; level: number; api: TreeApi}) {
  const folder = entry.kind === "directory", file = entry.kind === "file";
  const path = entry.location.path, open = folder && api.expanded.has(path);
  const usable = entry.retrieval_allowed && (folder || file);
  const inScene = file && api.inScene.has(`file:${entry.location.ref}`);
  const failure = api.rowErrors[path];
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (folder && (event.key === "ArrowRight" || event.key === "ArrowLeft")) { event.preventDefault(); event.stopPropagation(); api.toggle(path, event.key === "ArrowRight"); }
    else if (file && event.key === "Enter") { event.preventDefault(); void api.open(entry); }
    else if (file && (event.key === "a" || event.key === "A") && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); api.add(entry); }
  };
  return <li role="none">
    <div className="tn-nav-line">
      <button type="button" role="treeitem" className="oi-row tn-nav-row" aria-level={level} aria-expanded={folder ? open : undefined} aria-selected={api.selected === path} disabled={!usable}
        data-file-path={path} data-kind={entry.kind} style={{"--tn-depth": level - 1} as React.CSSProperties}
        title={usable ? path : entry.kind === "symlink" ? "Symbolic link — not followed" : "Unavailable through Central's retrieval policy"}
        draggable={file && usable}
        onDragStart={event => { event.dataTransfer.setData(LOCATION_DRAG_TYPE, JSON.stringify(entry.location)); event.dataTransfer.setData("text/plain", path); event.dataTransfer.effectAllowed = "copyLink"; }}
        onClick={() => { api.select(path); if (folder) api.toggle(path); }}
        onDoubleClick={() => { if (file) void api.open(entry); }}
        onKeyDown={onKeyDown}>
        <span className="tn-twist" data-leaf={!folder || undefined} aria-hidden="true"/>
        <Glyph name={folder ? ICON.folder : ICON.file} size={13}/>
        <span className="oi-row-title">{entry.name}</span>
        {inScene && <span className="oi-state">in scene</span>}
      </button>
      {file && usable && <button type="button" className="oi-tool tn-nav-add" aria-label={`Add ${entry.name} to instrument`} title="Add to instrument (A)" onClick={() => api.add(entry)}><Glyph name={ICON.add} size={12}/></button>}
    </div>
    {failure && <p className="oi-refusal tn-nav-inline" style={{"--tn-depth": level} as React.CSSProperties} role="alert">{failure}</p>}
    {open && <Directory path={path} level={level + 1} api={api}/>}
  </li>;
}
