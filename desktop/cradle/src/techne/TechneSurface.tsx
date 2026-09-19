/**
 * The Technè centre surface (surface kind "techne") — the instruments
 * arrangement (O-I #375, Technè section): a top bar of instrument tabs in
 * the app's shared tab grammar, one per instrument of the selected subject's
 * disclosed constellation, M0′–M5′, with Instrument #0 — Project/Wiki/Graph,
 * the source-backed ground — as the arrangement's MAIN FIRST VIEW.
 *
 * The tab bar follows the pane system's own grammar (workspace/mode.ts
 * TabPresentation): pinned horizontal, pinned vertical (resizable list), or
 * unpinned behind a hover-reveal edge — the same controls, the same laws,
 * the same reveal behaviour as every other tab in the application. Switching
 * tabs is presentation state on the arrangement (instrumentRail.ts): it
 * never closes surfaces, never starts a session, and each tab's own state
 * (the material scene, the lens host) survives leaving and returning.
 *
 * Tab availability and degradation follow the selected subject's disclosed
 * TechneReading (techneReading.ts, ql.techne/v1) with stated reasons — never
 * a static six. Where the reading is not reachable at runtime the tabs stand
 * on the static constellation with the truthful state line ("no subject
 * selected", "QL reading unavailable: <reason>"); no instrument is ever
 * simulated as live.
 *
 * Instrument 0 is a scene of REFERENCES (`./material`): Central file
 * locations and knowledge addresses, each read live through its owner
 * (`./readings`) and shown with an honest state. Selecting an item mounts a
 * LENS over it in the lens host (`./lens`, `./lenses`). M1′–M5′ host what
 * exists in this tree — registered focused-instrument sources (opened in
 * their own surfaces through the existing `requestFocusedInstrumentOpen`
 * seam) — and otherwise show their truthful state with the disclosure
 * reason: a host slot, not a fake.
 *
 * Adding material: drop `application/x-oi-location` (the material
 * navigator's rows) or type a Central-relative path / paste a knowledge ref,
 * resolved through the owner before anything is added. Files dropped from
 * outside Central carry only names; they resolve only against a directory
 * listing the navigator has actually read, and otherwise get a named refusal
 * — a location is never made up.
 *
 * Keyboard (Instrument 0's scene focused): ↑/↓ Home/End select · ⌥↑/⌥↓
 * reorder · Enter opens the lens · ⌘/Ctrl+Enter opens the file in a centre
 * tab · Delete/Backspace removes the reference · A (scene focused) or
 * ⌘/Ctrl+Shift+A (anywhere in the surface) adds material · Escape closes the
 * add popover and returns focus. In the tab bar: ←/→ Home/End walk the tabs.
 */
import {useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type KeyboardEvent} from "react";
import {scrollWithin} from "../shared/scrollWithin";
import type {SurfaceBinding} from "../surface/types";
import type {KnowledgeAddress, KnowledgeReading} from "../kernel/types";
import {useKernel} from "../kernel/KernelProvider";
import {listFiles} from "../files/client";
import {knowledge} from "../knowledge/client";
import {requestFocusedInstrumentOpen} from "../instrument/source";
import {useFocusedInstrumentReadings} from "../instrument/useFocusedInstrumentReadings";
import {Glyph} from "../workspace/Glyph";
import {ICON} from "../expressions/icons";
import {useDock, useDockEdge} from "../expressions/dock";
import {LOCATION_DRAG_TYPE, addMaterial, listedFilesNamed, materialRefText, moveMaterial, parseCentralLocation, recordMaterialRevision, releaseActiveMaterialScene, removeMaterial, requestOpenFileInCentre, selectMaterial, setActiveMaterialScene, useMaterialScene, type MaterialItem, type MaterialRef} from "./material";
import {materialStanding, useMaterialReadings, type MaterialReading} from "./readings";
import {subscribeTechneLenses, techneLenses} from "./lens";
import {registerBuiltInLenses} from "./lenses";
import {DEEP_INSTRUMENTS, GROUND_INSTRUMENT, deepInstrument, type DeepInstrument} from "./instruments";
import {selectInstrument, toggleRailOrientation, toggleRailPin, setRailListWidth, useInstrumentRail} from "./instrumentRail";
import {instrumentStanding, useTechneDisclosure, type TechneDisclosureState} from "./techneReading";
import {WikiWebBody} from "./WikiWebBody";
import {TAB_LIST_WIDTH_MAX, TAB_LIST_WIDTH_MIN} from "../workspace/mode";
import "./techne.css";

registerBuiltInLenses();

const LENS_KEY = "oi-cradle.techne.lens.v1";
const OUTSIDE_CENTRAL = "Dropped files from outside Central cannot be referenced; add them to Central first";
const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
const shortRevision = (revision: string) => revision.length > 12 ? `${revision.slice(0, 10)}…` : revision;

/** Resolve typed text to a reference THROUGH THE OWNER before it is added. */
async function resolveMaterial(transport: ReturnType<typeof useKernel>["transport"], project: string | undefined, input: string): Promise<{ref: MaterialRef; name: string; revision?: string}> {
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

/** The one-line disclosure state for the tab bar's right side. */
function disclosureLine(disclosure: TechneDisclosureState): string {
  switch (disclosure.standing) {
    case "no-subject": return "no subject selected";
    case "reading": return "reading disclosure…";
    case "read": return `disclosure available${disclosure.reading.revision ? ` · ${shortRevision(disclosure.reading.revision)}` : ""}`;
    case "unavailable": return `QL reading unavailable: ${disclosure.reason}`;
  }
}

export function TechneSurface({binding, subject}: {binding: SurfaceBinding; subject?: {ref?: string; kind?: string; title: string; project?: string}}) {
  const sceneId = binding.id;
  const uid = useId();
  const rail = useInstrumentRail();
  // The reading is requested for the arrangement's selected subject — the
  // workspace world-context subject the frame now passes through the
  // Workbench (the same one the panel planes receive). Without one the
  // arrangement honestly stands on "no subject selected"; the provider
  // registry (techneReading.ts) is the QL-side join.
  const disclosure = useTechneDisclosure(subject);
  const instruments = useFocusedInstrumentReadings();
  const active = deepInstrument(rail.active) ?? GROUND_INSTRUMENT;
  const surface = useRef<HTMLElement>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // The rail's tab presentation — the shared grammar's own derivation
  // (Workbench.tsx): the two pinned geometries, and an unpinned rail that
  // reveals in the geometry it was last pinned in.
  const presentation = rail.presentation, orientation = rail.orientation;
  const unpinned = presentation === "unpinned";
  const verticalTabs = presentation === "pinned-vertical" || (unpinned && orientation === "vertical");
  const presentationTitle = {unpinned: "unpinned — tabs hide until you reveal them", "pinned-horizontal": "pinned horizontally", "pinned-vertical": "pinned vertically"} as const;
  const panelId = `${uid}panel`;

  // ---- tab bar keyboard: the pane strip's own roving grammar --------------
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const move = (to: number) => { event.preventDefault(); const next = DEEP_INSTRUMENTS[Math.min(DEEP_INSTRUMENTS.length - 1, Math.max(0, to))]; if (next) { selectInstrument(next.instrument); requestAnimationFrame(() => surface.current?.querySelector<HTMLButtonElement>(`[data-instrument="${next.instrument}"][role="tab"]`)?.focus()); } };
    if (event.key === (verticalTabs ? "ArrowUp" : "ArrowLeft")) move(index - 1);
    else if (event.key === (verticalTabs ? "ArrowDown" : "ArrowRight")) move(index + 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(DEEP_INSTRUMENTS.length - 1);
  };

  return <section ref={surface} className="tn-surface" aria-label="Technè" data-surface-id={binding.id} data-instrument={active.instrument}
      data-tab-presentation={presentation} data-tab-orientation={unpinned ? orientation : undefined}
      style={verticalTabs && rail.listWidth !== undefined ? {"--tn-tab-list-width": `${rail.listWidth}px`} as import("react").CSSProperties : undefined}>
    {/* The one hiding law, as in a pane: an unpinned rail folds its tabs to
      * a slim reveal edge that opens in flow on approach or focus-within. */}
    {unpinned && <div className="tab-reveal-zone" aria-hidden="true" data-orientation={orientation}/>}
    <header className="tab-strip tn-tabbar">
      <div className="tab-scroll" role="tablist" aria-label="Technè instruments" aria-orientation={verticalTabs ? "vertical" : "horizontal"}>
        {DEEP_INSTRUMENTS.map((tab, index) => {
          const standing = instrumentStanding(disclosure, tab.instrument);
          const isActive = tab.instrument === active.instrument;
          const reason = standing.reason ?? standing.degraded[0];
          return <div className="tab-entry" key={tab.instrument} role="presentation">
            <button type="button" role="tab" id={`${uid}tab-${tab.instrument}`} aria-controls={panelId} aria-selected={isActive} tabIndex={isActive ? 0 : -1}
              className={`tab${isActive ? " active" : ""}`} data-instrument={tab.instrument}
              data-available={disclosure.standing === "read" ? standing.available || undefined : undefined}
              data-disclosed={disclosure.standing === "read" ? standing.disclosed || undefined : undefined}
              title={`M${tab.mPrime}′ ${tab.label} — ${tab.office}${reason ? ` · ${reason}` : disclosure.standing === "read" ? " · disclosed available" : ""}`}
              onClick={() => selectInstrument(tab.instrument)}
              onKeyDown={event => onTabKey(event, index)}>
              <Glyph name={tab.glyph} size={12}/>
              <span className="tab-title">{tab.label}</span>
              {disclosure.standing === "read" && !standing.available && <span className="tn-tab-unavailable" aria-hidden="true" title={reason}>·</span>}
            </button>
          </div>;
        })}
      </div>
      <div className="pane-tools">
        <span className="oi-state tn-tabbar-note" data-disclosure={disclosure.standing}
          title={disclosure.standing === "read" ? `Disclosed by ${disclosure.reading.subject.nativeOwner}${disclosure.reading.revision ? ` at revision ${disclosure.reading.revision}` : ""}` : disclosureLine(disclosure)}>
          {disclosureLine(disclosure)}
        </span>
        {/* The pane tools' own controls and semantics (Workbench.tsx,
          * surface/registry.ts): orientation is one control, pinning the other. */}
        <button type="button" className="pane-tool-menu pane-tool-orient"
          aria-label={verticalTabs ? "Show tabs horizontally" : "Show tabs vertically"}
          title={verticalTabs ? "Tabs are vertical — show horizontally" : "Tabs are horizontal — show vertically"}
          onClick={toggleRailOrientation}>
          <Glyph name={verticalTabs ? "rows" : "columns"} size={13}/>
        </button>
        <button type="button" className="pane-tool-menu pane-tool-pin"
          aria-label={unpinned ? "Pin tabs" : "Unpin tabs"}
          title={`Tabs are ${presentationTitle[presentation]} — ${unpinned ? "Pin tabs" : "Unpin tabs"}`}
          data-pin-target={unpinned ? `pinned-${orientation}` : "unpinned"}
          data-tab-presentation={presentation}
          onClick={toggleRailPin}>
          <Glyph name="pin" size={13}/>
        </button>
      </div>
    </header>
    {/* The pinned-vertical list's width: the pane resizer's own grammar —
      * drag or arrow-key resizable, persisted through the shared bounds. */}
    {presentation === "pinned-vertical" && (
      <div className="tab-list-resizer" role="separator" aria-label="Instrument tab list width" aria-orientation="vertical" tabIndex={0}
        aria-valuemin={TAB_LIST_WIDTH_MIN} aria-valuemax={TAB_LIST_WIDTH_MAX} aria-valuenow={rail.listWidth}
        title="Drag to resize the tab list; arrow keys adjust; Home/End to the bounds"
        onPointerDown={e => { e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const left = e.currentTarget.parentElement!.getBoundingClientRect().left;
          setRailListWidth(Math.round(e.clientX - left));
        }}
        onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onKeyDown={e => {
          if (e.altKey || e.metaKey || e.ctrlKey) return;
          const width = rail.listWidth ?? Math.round(e.currentTarget.parentElement?.querySelector<HTMLElement>(".tab-strip")?.getBoundingClientRect().width ?? 208);
          const step = e.shiftKey ? 32 : 16;
          if (e.key === "ArrowLeft") { e.preventDefault(); setRailListWidth(width - step); }
          else if (e.key === "ArrowRight") { e.preventDefault(); setRailListWidth(width + step); }
          else if (e.key === "Home") { e.preventDefault(); setRailListWidth(TAB_LIST_WIDTH_MIN); }
          else if (e.key === "End") { e.preventDefault(); setRailListWidth(TAB_LIST_WIDTH_MAX); }
        }}/>
    )}
    <div className="tn-body" role="tabpanel" id={panelId} aria-labelledby={`${uid}tab-${active.instrument}`}>
      {notice && <p className="oi-refusal tn-notice" role="status">{notice}<button type="button" className="oi-tool" aria-label="Dismiss" onClick={() => setNotice(null)}><Glyph name={ICON.close} size={12}/></button></p>}
      {active.instrument === "project"
        ? <Instrument0Body sceneId={sceneId} project={binding.project}/>
        : <InstrumentSlotBody tab={active} disclosure={disclosure} readings={instruments} onNotice={setNotice}/>}
    </div>
  </section>;
}

/** Instrument 0's body (owner direction 2026-09-19): the arrangement opens
 * onto the wiki web — Central and its projects as their wikis disclose
 * them — with no material required to be in the experience. The material
 * scene and its lens host stay mounted as the summoned depth beside the
 * web: the navigator's "Add to instrument" still lands here, and the depth
 * surfaces itself whenever material is present. */
function Instrument0Body({sceneId, project}: {sceneId: string; project?: string}) {
  const scene = useMaterialScene(sceneId);
  const holding = scene.items.length > 0;
  const [open, setOpen] = useState(holding);
  useEffect(() => { if (holding) setOpen(true); }, [holding]);
  return <div className="tn-m0" data-material={holding ? (open ? "open" : "held") : "none"}>
    <WikiWebBody/>
    {(holding || open) && <aside className="tn-m0-material" aria-label="Material scene" data-open={open}>
      <header className="tn-m0-material-head">
        <span className="oi-eyebrow">Material scene</span>
        <button type="button" className="oi-tool" aria-label={open ? "Fold the material scene away" : "Open the material scene"} onClick={() => setOpen(value => !value)}>{open ? "–" : "+"}</button>
      </header>
      {open && <MaterialSceneBody sceneId={sceneId} project={project}/>}
    </aside>}
  </div>;
}

/** Instrument 0's material depth: the source-backed material scene with its
 * lens host. Everything here is the existing implementation, unchanged in
 * behaviour — the depth only decides when it stands in front. */
function MaterialSceneBody({sceneId, project}: {sceneId: string; project?: string}) {
  const {transport} = useKernel();
  const scene = useMaterialScene(sceneId);
  const {readings, reread} = useMaterialReadings(sceneId, scene.items, project);
  const lenses = useSyncExternalStore(subscribeTechneLenses, techneLenses, techneLenses);
  const uid = useId();
  const region = useRef<HTMLDivElement>(null), list = useRef<HTMLUListElement>(null), lensRegion = useRef<HTMLDivElement>(null), addButton = useRef<HTMLButtonElement>(null);
  const selected = scene.items.find(item => item.id === scene.selectedId);

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
  const [notice, setNotice] = useState<string | null>(null);
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
      setNotice(result.added ? null : `${resolved.name} is already in this scene; it is selected.`);
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
      if (!location) { setNotice("The dropped item does not carry a Central location."); return; }
      const result = addMaterial(sceneId, {kind: "file", location}, location.path.split("/").pop() || location.path);
      setNotice(result.added ? null : "That file is already in this scene; it is selected.");
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
    setNotice(refused.length ? `${OUTSIDE_CENTRAL} (${refused.join(", ")}).` : null);
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
      if (event.metaKey || event.ctrlKey) { if (selected.ref.kind === "file") requestOpenFileInCentre(selected.ref.location); else setNotice("Only a Central file opens in a centre tab; this item is a knowledge ref."); }
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
            {accepted.length > 0 && <div className="oi-segment" role="group" aria-label="Lens">{accepted.map(candidate => <button key={candidate.id} type="button" aria-pressed={candidate.id === lens?.id} onClick={() => setLensId(candidate.id)}>{candidate.label}</button>)}</div>}
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

/** An M1′–M5′ instrument's body: its disclosed standing with stated reasons,
 * the focused-instrument implementations this tree actually has for its M′
 * office (opened in their own surfaces through the existing seam), and — where
 * neither exists — a named host slot. Nothing here simulates an instrument. */
function InstrumentSlotBody({tab, disclosure, readings, onNotice}: {tab: DeepInstrument; disclosure: TechneDisclosureState; readings: ReturnType<typeof useFocusedInstrumentReadings>; onNotice(message: string): void}) {
  const standing = instrumentStanding(disclosure, tab.instrument);
  // Registered focused-instrument sources whose disclosed focus is this tab's
  // M′ office — the implementations that exist in this tree.
  const mounted = readings.filter(reading => reading.state === "read" && reading.snapshot && reading.snapshot.focus.focus === `m${tab.mPrime}`);
  return <div className="tn-slot oi-scroll" data-instrument={tab.instrument} role="region" aria-label={tab.label}>
    <header className="tn-slot-head">
      <span className="oi-eyebrow">M{tab.mPrime}′ · {tab.office}</span>
      <strong>{tab.label}</strong>
    </header>
    <div className="tn-slot-state" data-disclosure={disclosure.standing} data-available={disclosure.standing === "read" ? standing.available || undefined : undefined}>
      {disclosure.standing === "no-subject" && <p className="oi-note" role="status">No subject selected — instruments stand on the static constellation until a subject is selected.</p>}
      {disclosure.standing === "reading" && <p className="oi-note" role="status">Reading the subject's ql.techne/v1 disclosure…</p>}
      {disclosure.standing === "unavailable" && <p className="oi-refusal" role="status">QL reading unavailable: {disclosure.reason}</p>}
      {disclosure.standing === "read" && !standing.disclosed && <p className="oi-note" role="status">The subject's reading does not list this instrument in its disclosure.</p>}
      {disclosure.standing === "read" && standing.disclosed && !standing.available && <p className="oi-refusal" role="status">The subject's reading discloses this instrument unavailable — {standing.reason}</p>}
      {disclosure.standing === "read" && standing.disclosed && standing.available && <p className="oi-note" role="status">The subject's reading discloses this instrument available.</p>}
      {standing.degraded.map(reason => <p className="oi-note" data-degraded="true" key={reason}>Degraded — {reason}</p>)}
    </div>
    <section className="tn-slot-section" aria-label="Mounted instruments">
      <span className="oi-eyebrow">In this tree</span>
      {mounted.length === 0 && <p className="oi-note">No {tab.label} implementation is mounted in this tree — a host slot, not a simulated instrument. It arrives with the Technè instrument lanes.</p>}
      {mounted.map(reading => <div key={reading.ref} className="tn-slot-instrument">
        <span className="oi-row-title">{reading.title}</span>
        <span className="oi-ref">{reading.ref}</span>
        <button type="button" className="oi-action" title={`Open ${reading.title} in its own surface (${reading.ref})`} onClick={() => { try { requestFocusedInstrumentOpen(reading.ref, reading.title); } catch (cause) { onNotice(text(cause)); } }}><Glyph name={ICON.instrument} size={12}/>Open</button>
      </div>)}
    </section>
  </div>;
}

function MaterialRow({id, item, reading, selected, onSelect, onOpen}: {id: string; item: MaterialItem; reading: MaterialReading | undefined; selected: boolean; onSelect(): void; onOpen(): void}) {
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
