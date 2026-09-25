/**
 * The material depth — the source-backed reference scene and its lens host,
 * preserved unchanged from the previous Instrument-0 body (the value the
 * dual-mode rebuild retains, wayfinder §13 "source/open depth"): Central
 * file locations and knowledge addresses, each read live through its owner,
 * with the item lenses (Reading / Reference / Knowledge, lens.ts) hosted
 * beside or beneath the list. The dual-mode surface summons it as the
 * source/open depth; it is never the gate — the field is the experience
 * with or without it.
 *
 * Adding material: drop `application/x-oi-location` (the material
 * navigator's rows) or type a Central-relative path / paste a knowledge ref,
 * resolved through the owner before anything is added. Files dropped from
 * outside Central carry only names; they resolve only against a directory
 * listing the navigator has actually read, and otherwise get a named refusal
 * — a location is never made up.
 *
 * Keyboard (scene focused): ↑/↓ Home/End select · ⌥↑/⌥↓ reorder · Enter
 * opens the lens · ⌘/Ctrl+Enter opens the file in a centre tab ·
 * Delete/Backspace removes the reference · A adds material.
 */
import {useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent} from "react";
import {scrollWithin} from "../shared/scrollWithin";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import {knowledge} from "../knowledge/client";
import type {KnowledgeAddress, KnowledgeReading} from "../kernel/types";
import {IconTabStrip} from "../workspace/primitives/IconTabStrip";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "../expressions/icons";
import {useDock, useDockEdge} from "../expressions/dock";
import {LOCATION_DRAG_TYPE, addMaterial, listedFilesNamed, materialRefText, moveMaterial, parseCentralLocation, recordMaterialRevision, releaseActiveMaterialScene, removeMaterial, requestOpenFileInCentre, selectMaterial, setActiveMaterialScene, useMaterialScene} from "./material";
import {materialStanding, useMaterialReadings, type MaterialReading} from "./readings";
import {subscribeTechneLenses, techneLenses} from "./lens";

const LENS_KEY = "oi-cradle.techne.lens.v1";
const OUTSIDE_CENTRAL = "Dropped files from outside Central cannot be referenced; add them to Central first";
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
const shortRevision = (revision: string) => revision.length > 12 ? `${revision.slice(0, 10)}…` : revision;

/** Resolve typed text to a reference THROUGH THE OWNER before it is added. */
async function resolveMaterial(transport: ReturnType<typeof useKernel>["transport"], project: string | undefined, input: string): Promise<{ref: import("./material").MaterialRef; name: string; revision?: string}> {
  const clean = input.trim();
  const prefixed = /^(wiki|source|project-map):(.+)$/.exec(clean);
  const address: KnowledgeAddress | null = prefixed ? {kind: prefixed[1] as KnowledgeAddress["kind"], value: prefixed[2].trim()} : clean.startsWith("central:source:") ? {kind: "source", value: clean} : null;
  if (address) {
    const reading = await knowledge<KnowledgeReading>(transport, project, {action: "read", address});
    return {ref: {kind: "knowledge", address, project}, name: reading.resource || address.value, revision: reading.revision};
  }
  const path = clean.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!path) throw new Error("Type a path relative to Central, or a wiki:/source:/project-map: ref");
  const slash = path.lastIndexOf("/"), parent = slash < 0 ? "." : path.slice(0, slash), name = path.slice(slash + 1);
  const directory = await listFiles(transport, parent);
  const entry = directory.entries.find(candidate => candidate.name === name);
  if (!entry) throw new Error(`Central lists no "${name}" in ${parent === "." ? "its root" : parent}`);
  if (entry.kind === "directory") throw new Error(`${path} is a folder. Material is a file or a knowledge ref; open folders in the material navigator.`);
  if (entry.kind !== "file") throw new Error(`${path} is a ${entry.kind}; Central does not follow it`);
  if (!entry.retrieval_allowed) throw new Error(`Central's retrieval policy does not allow reading ${path}`);
  return {ref: {kind: "file", location: entry.location}, name: entry.name};
}

/** The material scene with its lens host — everything here is the previous
 * implementation, unchanged in behaviour. */
export function MaterialDepth({sceneId, project, onNotice}: {sceneId: string; project?: string; onNotice?(message: string | null): void}) {
  const {transport} = useKernel();
  const scene = useMaterialScene(sceneId);
  const {readings, reread} = useMaterialReadings(sceneId, scene.items, project);
  const lenses = useSyncExternalStore(subscribeTechneLenses, techneLenses, techneLenses);
  const uid = useId();
  const region = useRef<HTMLDivElement>(null), list = useRef<HTMLUListElement>(null), lensRegion = useRef<HTMLDivElement>(null), addButton = useRef<HTMLButtonElement>(null);
  const selected = scene.items.find(item => item.id === scene.selectedId);
  const [notice, setNotice] = useState<string | null>(null);
  const showNotice = onNotice ?? setNotice;

  // This body receives the navigator's "Add to instrument" while it stands.
  useEffect(() => { setActiveMaterialScene(sceneId); return () => releaseActiveMaterialScene(sceneId); }, [sceneId]);

  // ---- lens host ----------------------------------------------------------
  const edge = useDockEdge(region, 640);
  const sideLens = useDock(LENS_KEY, {open: true, size: 360}, {min: 240, max: 720}, "right");
  const bottomLens = useDock(`${LENS_KEY}:bottom`, {open: true, size: 260}, {min: 140, max: 560}, "bottom");
  const dock = edge === "right" ? sideLens : bottomLens;
  const [lensId, setLensId] = useState<string>();
  const accepted = useMemo(() => selected ? lenses.filter(lens => lens.accepts(selected)) : [], [lenses, selected]);
  const lens = accepted.find(candidate => candidate.id === lensId) ?? accepted[0];
  const openLens = useCallback(() => { dock.setOpen(true); requestAnimationFrame(() => lensRegion.current?.focus({preventScroll: true})); }, [dock]);

  // ---- add material -------------------------------------------------------
  const [adding, setAdding] = useState(false), [draft, setDraft] = useState(""), [resolving, setResolving] = useState(false), [addError, setAddError] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openAdd = useCallback(() => { returnFocus.current = (document.activeElement as HTMLElement | null) ?? null; setAddError(null); setAdding(true); }, []);
  const closeAdd = useCallback((focus = true) => {
    setAdding(false); setResolving(false);
    if (focus) requestAnimationFrame(() => { const target = returnFocus.current; (target && target.isConnected && region.current?.contains(target) ? target : list.current ?? addButton.current)?.focus(); });
  }, []);
  const submitAdd = async () => {
    if (!draft.trim() || resolving) return;
    setResolving(true); setAddError(null);
    try {
      const resolved = await resolveMaterial(transport, project, draft);
      const result = addMaterial(sceneId, resolved.ref, resolved.name, resolved.revision);
      showNotice(result.added ? null : `${resolved.name} is already in this scene; it is selected.`);
      setDraft(""); returnFocus.current = list.current; closeAdd();
    } catch (cause) { setAddError(text(cause)); setResolving(false); }
  };

  // ---- drag and drop ------------------------------------------------------
  const [dropping, setDropping] = useState(false);
  const accepts = (event: DragEvent) => event.dataTransfer.types.includes(LOCATION_DRAG_TYPE) || event.dataTransfer.types.includes("Files");
  const onDragOver = (event: DragEvent) => { if (!accepts(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = "link"; if (!dropping) setDropping(true); };
  const onDragLeave = (event: DragEvent) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropping(false); };
  const onDrop = (event: DragEvent) => {
    if (!accepts(event)) return;
    event.preventDefault(); setDropping(false);
    const carried = event.dataTransfer.getData(LOCATION_DRAG_TYPE);
    if (carried) {
      let location = null;
      try { location = parseCentralLocation(JSON.parse(carried)); } catch { location = null; }
      if (!location) { showNotice("The dropped item does not carry a Central location."); return; }
      const result = addMaterial(sceneId, {kind: "file", location}, location.path.split("/").pop() || location.path);
      showNotice(result.added ? null : "That file is already in this scene; it is selected.");
      list.current?.focus();
      return;
    }
    // Files from the OS carry names only. A name resolves only against a
    // directory listing Central has actually disclosed to the navigator.
    const refused: string[] = [];
    for (const file of Array.from(event.dataTransfer.files)) {
      const matches = listedFilesNamed(file.name);
      if (matches.length === 1) addMaterial(sceneId, {kind: "file", location: matches[0]}, file.name);
      else refused.push(file.name);
    }
    showNotice(refused.length ? `${OUTSIDE_CENTRAL} (${refused.join(", ")}).` : null);
    list.current?.focus();
  };

  // ---- keyboard -----------------------------------------------------------
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = scene.items, at = items.findIndex(item => item.id === scene.selectedId);
    const to = (index: number) => { event.preventDefault(); const next = items[Math.min(items.length - 1, Math.max(0, index))]; if (next) selectMaterial(sceneId, next.id); };
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const delta = event.key === "ArrowDown" ? 1 : -1;
      if (event.altKey && selected) { event.preventDefault(); moveMaterial(sceneId, selected.id, delta); }
      else to(at < 0 ? (delta > 0 ? 0 : items.length - 1) : at + delta);
    } else if (event.key === "Home") to(0);
    else if (event.key === "End") to(items.length - 1);
    else if (event.key === "Enter" && selected) {
      event.preventDefault();
      if (event.metaKey || event.ctrlKey) { if (selected.ref.kind === "file") requestOpenFileInCentre(selected.ref.location); else showNotice("Only a Central file opens in a centre tab; this item is a knowledge ref."); }
      else openLens();
    } else if ((event.key === "Delete" || event.key === "Backspace") && selected) { event.preventDefault(); removeMaterial(sceneId, selected.id); }
    else if ((event.key === "a" || event.key === "A") && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); openAdd(); }
  };
  const onRegionKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === "a" || event.key === "A")) { event.preventDefault(); event.stopPropagation(); openAdd(); }
  };
  useEffect(() => { if (scene.selectedId) scrollWithin(window.document.getElementById(`${uid}i-${scene.selectedId}`)); }, [scene.selectedId, uid]);

  const selectedReading: MaterialReading = selected ? readings[selected.id] ?? {state: "reading"} : {state: "reading"};
  const selectedStanding = selected ? materialStanding(selected, selectedReading) : undefined;
  const lensId_ = `${uid}lens`;

  return <div ref={region} className="tn-scene-region" data-dock-edge={edge} data-lens={dock.state.open ? "open" : "closed"} onKeyDown={onRegionKey} onFocusCapture={() => setActiveMaterialScene(sceneId)}>
    <div className="tn-scene" data-drop={dropping || undefined} onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="tn-scene-bar">
        <div className="tn-add">
          <button ref={addButton} type="button" className="oi-action" aria-haspopup="dialog" aria-expanded={adding} onClick={() => adding ? closeAdd() : openAdd()}><Glyph name={ICON.add} size={12}/>Add material<kbd className="oi-kbd">A</kbd></button>
          {adding && <AddPopover draft={draft} onDraft={setDraft} resolving={resolving} error={addError} onSubmit={() => void submitAdd()} onClose={() => closeAdd()}/>}
        </div>
        <span className="oi-state">{scene.items.length} {scene.items.length === 1 ? "reference" : "references"}</span>
        <span className="tn-scene-bar-tools">
          {selected && selectedStanding === "stale" && selectedReading.state === "available" && selectedReading.revision !== undefined && <button type="button" className="oi-action" onClick={() => recordMaterialRevision(sceneId, selected.id, selectedReading.revision!, true)}>Accept current revision</button>}
          {selected && selected.ref.kind === "file" && <button type="button" className="oi-tool" aria-label="Open in a centre tab" title="Open in a centre tab (⌘/Ctrl+Enter)" onClick={() => selected.ref.kind === "file" && requestOpenFileInCentre(selected.ref.location)}><Glyph name={ICON.open} size={13}/></button>}
          {selected && <button type="button" className="oi-tool" aria-label="Remove reference" title="Remove this reference from the scene (Delete). The material itself is untouched." onClick={() => { removeMaterial(sceneId, selected.id); list.current?.focus(); }}><Glyph name={ICON.remove} size={13}/></button>}
          <button type="button" className="oi-tool" aria-label="Re-read material" title="Read every item again through its owner" disabled={!scene.items.length} onClick={reread}><Glyph name={ICON.refresh} size={13}/></button>
          <button type="button" className="oi-tool" aria-label="Lens host" title={dock.state.open ? "Close the lens host" : "Open the lens host"} aria-pressed={dock.state.open} aria-controls={lensId_} onClick={dock.toggle}><Glyph name={ICON.lens} size={13}/></button>
        </span>
      </div>
      {notice && <p className="oi-refusal tn-notice" role="status">{notice}<button type="button" className="oi-tool" aria-label="Dismiss" onClick={() => setNotice(null)}><Glyph name={ICON.close} size={12}/></button></p>}
      <ul ref={list} className="tn-items oi-scroll" role="listbox" tabIndex={0} aria-label="Material scene" aria-activedescendant={scene.selectedId ? `${uid}i-${scene.selectedId}` : undefined} onKeyDown={onListKey} onFocus={() => { if (!scene.selectedId && scene.items[0]) selectMaterial(sceneId, scene.items[0].id); }}>
        {scene.items.length === 0 && <li role="presentation" className="oi-empty tn-empty">
          <span>No material in this scene yet.</span>
          <span>Drag files here from the material navigator, or add a Central-relative path or a knowledge ref. A scene holds references only — never copies.</span>
        </li>}
        {scene.items.map(item => <MaterialRow key={item.id} id={`${uid}i-${item.id}`} item={item} reading={readings[item.id]} selected={item.id === scene.selectedId}
          onSelect={() => { selectMaterial(sceneId, item.id); list.current?.focus(); }} onOpen={() => { selectMaterial(sceneId, item.id); openLens(); }}/>)}
      </ul>
      {dropping && <div className="tn-drop" aria-hidden="true"><span>Drop to add a reference</span></div>}
    </div>
    {dock.state.open && <>
      <div className="oi-resize-handle" aria-label="Resize lens host" {...dock.handle}/>
      <aside id={lensId_} className="tn-lens" aria-label="Lens host" style={edge === "right" ? {inlineSize: dock.state.size} : {blockSize: dock.state.size}}>
        <div className="oi-panel-head">
          <span className="oi-panel-head-title">{selected ? selected.name : "Lens"}</span>
          <span className="oi-panel-head-tools">
            {accepted.length > 0 && <IconTabStrip aria-label="Lens" current={lens?.id} onSelect={setLensId} items={accepted.map(candidate=>({id:candidate.id,label:candidate.label,icon:candidate.id.includes("knowledge")?"wiki":candidate.id.includes("reference")?"link":"file"}))}/>}
            <button type="button" className="oi-tool" aria-label="Close lens host" onClick={() => dock.setOpen(false)}><Glyph name={ICON.close} size={13}/></button>
          </span>
        </div>
        <div ref={lensRegion} className="tn-lens-body oi-scroll" role="region" aria-label={lens && selected ? `${lens.label} lens over ${selected.name}` : "Lens"} tabIndex={-1} data-lens-id={lens?.id}>
          {selected && lens ? <lens.Body key={`${lens.id}:${selected.id}`} item={selected} reading={selectedReading}/>
            : selected ? <p className="oi-note" role="status">No registered lens accepts this item.</p>
            : <p className="oi-note" role="status">Select material to read it through a lens.</p>}
        </div>
      </aside>
    </>}
  </div>;
}

function MaterialRow({id, item, reading, selected, onSelect, onOpen}: {id: string; item: import("./material").MaterialItem; reading: MaterialReading | undefined; selected: boolean; onSelect(): void; onOpen(): void}) {
  const standing = materialStanding(item, reading);
  const revision = reading?.state === "available" ? reading.revision : undefined;
  return <li id={id} role="option" aria-selected={selected} className="oi-row tn-item" data-material-kind={item.ref.kind} data-standing={standing} onClick={onSelect} onDoubleClick={onOpen}>
    <Glyph name={item.ref.kind === "file" ? ICON.file : ICON.wiki} size={14}/>
    <span className="tn-item-text">
      <span className="oi-row-title">{item.name}</span>
      <span className="oi-ref tn-item-ref">{materialRefText(item.ref)}</span>
      {reading?.state === "unavailable" && <span className="tn-item-refusal">{reading.error}</span>}
    </span>
    {standing === "reading" && <span className="oi-state">reading…</span>}
    {standing === "available" && <span className="oi-chip" data-mono="true" title={revision ? `Available at revision ${revision}` : "Available; the owner disclosed no revision"}>{revision ? shortRevision(revision) : "available"}</span>}
    {standing === "stale" && <span className="oi-chip" data-state="stale" title={`Changed since added: was ${item.addedRevision}, now ${revision}`}>changed since added</span>}
    {standing === "unavailable" && <span className="oi-state" data-attention="true">unavailable</span>}
  </li>;
}

function AddPopover({draft, onDraft, resolving, error, onSubmit, onClose}: {draft: string; onDraft(value: string): void; resolving: boolean; error: string | null; onSubmit(): void; onClose(): void}) {
  const input = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => { const host = root.current?.parentElement; if (host && !host.contains(event.target as Node)) onClose(); };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [onClose]);
  return <div ref={root} className="oi-menu tn-add-popover" role="dialog" aria-label="Add material" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>
      <input ref={input} className="oi-input" aria-label="Material path or ref" placeholder="Work/Project/notes.md  ·  wiki:…  ·  source:…" value={draft} spellCheck={false} autoCorrect="off" autoCapitalize="off" aria-invalid={error ? true : undefined} onChange={event => onDraft(event.target.value)}/>
      <button type="submit" className="oi-action oi-action-primary" disabled={!draft.trim() || resolving} data-busy={resolving || undefined}>{resolving ? "Resolving…" : "Add"}</button>
    </form>
    <p className="oi-note">A path relative to Central, or a ref (<span className="oi-ref">wiki:</span> <span className="oi-ref">source:</span> <span className="oi-ref">project-map:</span>). It is resolved through its owner before it is added.</p>
    {error && <p className="oi-refusal" role="alert">{error}</p>}
  </div>;
}
