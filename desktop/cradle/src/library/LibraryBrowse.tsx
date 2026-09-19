/**
 * The Library's columnar Web inventory — the BROWSE / LOCATION presentation
 * (owner Wayfinder §8A): the normal Technē Library view, over the SAME
 * collection data the gallery reads, grouped by where things live.
 *
 *   current Project / world first, then Central (the personal world), then
 *   the other disclosed projects; the shared horizon groups the shared
 *   field by the world each entry names, read-only.
 *
 * Each row: [Web / Expression name] [source/location/collection identity]
 * [Scene chips — ONE line]. The chip strip is bounded to the row's available
 * width: excess collapses to a "+N / reveal" control that opens the full
 * scene list in a popover — the row never wraps, and the page never scrolls
 * sideways. Each chip carries its exact SceneRef (data-scene-ref) and
 * enters exactly that Scene through the seams that already exist: a
 * Wiki-derived Web scene asks the ONE projection state (requestWikiSelection)
 * and enters the instrument; a saved/free Expression enters the Expressions
 * workspace through the Library's own open path.
 *
 * Wiki-derived Webs are read from the ONE Wiki→Expression projection state
 * (wikiProjectionStore, the same state the wiki map and Instrument 0 read —
 * no second reading of wiki.json, no copied graph). A register's projection
 * is ensured only when its group is opened, exactly as the wiki map's
 * regions do. Provider items carry only what their owner read disclosed —
 * a row without disclosed scenes renders none and invents none.
 *
 * The zoom strip (Wayfinder §24) makes the widening navigable as
 * disclosure: node/constellation → Project Web → Personal World → O:I Web →
 * admitted worlds. It is navigation only — it moves the Library's scope and
 * group focus, never authority; shared material reads read-only.
 */
import {useEffect, useMemo, useRef, useState} from "react";
import {Glyph, type GlyphName} from "../workspace/Glyph";
import {useKernel} from "../kernel/KernelProvider";
import type {LibraryCoverage, LibraryItem, LibraryScopeId} from "./scope";
import {requestWikiSelection, ensureWikiProjection, setWikiProjectionRegisters, useWikiProjectionState, type RegisterStanding} from "../techne/wikiProjectionStore";
import {wikiRegistersFrom, type WikiRegister} from "../techne/wikiExpression";
import {LibraryCoverageLines} from "./LibraryResults";

const KIND_GLYPH: Record<LibraryItem["kind"], GlyphName> = {
  composition: "field", world: "graph", "projected-object": "material", place: "wiki", page: "file",
};
const shortRevision = (revision: string | undefined) => revision && revision.length > 12 ? `${revision.slice(0, 10)}…` : revision;

interface SceneChip {sceneRef: string; title: string}

/** One group of the inventory: a place in the world, its rows. */
interface BrowseGroup {
  key: string;
  label: string;
  /** "project" = a Project/ProjectCentral web; "central" = the personal
   * world; "shared" = the shared field's own disclosed worlds. */
  kind: "project" | "central" | "shared";
  registerKey?: string;
  /** A Web row read from the ONE projection state (its register's standing). */
  web?: {register: WikiRegister; standing: RegisterStanding};
  items: LibraryItem[];
  readonly?: boolean;
}

/** Enter one exact Scene of a Wiki-derived Web: the ONE state's selection
 * ask (the same act as a wiki-map row click) plus the frame's own
 * cross-mode hop into the instrument. */
function enterWikiScene(registerKey: string, sceneRef: string, title: string | undefined, onEntered: (sceneRef: string) => void) {
  requestWikiSelection({registerKey, sceneRef, entityRef: null, subjectRef: null, title, origin: "external"});
  window.dispatchEvent(new CustomEvent("oi:epi-examine", {detail: {}}));
  onEntered(sceneRef);
}

export function LibraryBrowse({items, coverage, selectedRef, onSelect, onOpen, scope, onScopeChange}: {
  items: LibraryItem[];
  coverage: LibraryCoverage[];
  selectedRef?: string;
  onSelect: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem, how: "page" | "expression" | "instrument" | "source") => void;
  scope: LibraryScopeId;
  onScopeChange: (scope: LibraryScopeId) => void;
}) {
  const kernel = useKernel();
  const store = useWikiProjectionState();
  const [lastEnteredScene, setLastEnteredScene] = useState<string | undefined>();
  const [focusGroup, setFocusGroup] = useState<string | undefined>();

  // The registers follow the kernel navigator's disclosed projects — the
  // same publication the centre makes (idempotent; every aperture reads the
  // same list).
  const projects = kernel.snapshot.navigator?.root?.work.projects ?? [];
  useEffect(() => {
    setWikiProjectionRegisters(wikiRegistersFrom(projects.map(row => ({name: row.name, path: row.path}))));
  }, [projects]);

  const currentProject = kernel.snapshot.navigator?.project?.project?.name;

  // Groups: the widening from the current project out to the world. Web
  // rows attach to their register's group.
  const groups = useMemo<BrowseGroup[]>(() => {
    const ordered = [...projects].sort((a, b) => (a.name === currentProject ? -1 : b.name === currentProject ? 1 : 0));
    const localGroups: BrowseGroup[] = ordered.map(project => ({
      key: project.name === currentProject ? "project:current" : `project:${project.name}`,
      label: project.name === currentProject ? `${project.name} — Project Web (current)` : `${project.name} — Project Web`,
      kind: "project",
      registerKey: project.name,
      items: items.filter(item => item.project === project.name),
    }));
    const central: BrowseGroup = {
      key: "central",
      label: "Central — Personal World",
      kind: "central",
      registerKey: "central",
      items: items.filter(item => !item.project),
    };
    // The shared horizon: entries the snapshot discloses as this instance's
    // own (item-level scope "local" — providers.ts) nest under the instance,
    // exactly as the gallery nests them; only genuinely shared entries group
    // as remote worlds, read-only.
    const shared: BrowseGroup[] = scope === "shared"
      ? [
          {
            key: "shared:subset",
            label: "Your instance (subset)",
            kind: "central",
            items: items.filter(item => item.scope === "local"),
          },
          ...Object.entries(items.reduce<Record<string, LibraryItem[]>>((acc, item) => {
            if (item.scope !== "shared") return acc;
            const world = item.owner || "the shared field";
            (acc[world] ??= []).push(item);
            return acc;
          }, {})).map(([world, rows]) => ({
            key: `shared:${world}`,
            label: `${world} — remote Project Web`,
            kind: "shared" as const,
            items: rows,
            readonly: true,
          })),
        ]
      : [];
    return scope === "shared" ? shared : [central, ...localGroups];
  }, [items, projects, currentProject, scope]);

  // A group's projection is ensured only while its group is opened — the
  // wiki map's own law; no eager world reads from the Library.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // Default the widening open: the current project and Central.
    setOpenGroups(current => ({...current,
      ...(current["project:current"] === undefined && scope !== "shared" ? {"project:current": true} : {}),
      ...(current["central"] === undefined && scope !== "shared" ? {central: true} : {}),
    }));
  }, [scope]);
  const registerByKey = useMemo(() => new Map(store.registers.map(register => [register.key, register])), [store.registers]);
  useEffect(() => {
    if (scope === "shared") return;
    for (const group of groups) {
      if (!openGroups[group.key] || !group.registerKey) continue;
      const register = registerByKey.get(group.registerKey);
      if (register) ensureWikiProjection(register, kernel.transport);
    }
  }, [groups, openGroups, registerByKey, kernel.transport, scope]);

  const zoomSelection = store.selection;
  const admittedWorlds = scope === "shared" ? new Set(items.map(item => item.owner)).size : 0;

  return <div className="lib-browse" data-browse-view="columnar" data-scope={scope} data-last-entered-scene={lastEnteredScene}>
    {coverage.length > 0 && <div className="lib-coverage"><LibraryCoverageLines coverage={coverage}/></div>}
    <nav className="lib-zoom" aria-label="Zoom — where reading stands" data-zoom-scope={scope}>
      <span className="oi-eyebrow lib-zoom-label">Zoom</span>
      <span className="lib-zoom-position" data-zoom-node={zoomSelection.subjectRef ?? undefined}
        title={zoomSelection.subjectRef ? `The selection stands at ${zoomSelection.subjectRef}` : "No constellation/node stands selected"}>
        {zoomSelection.subjectRef ? "constellation/node" : "—"}
      </span>
      <Glyph name="arrow" size={11}/>
      <button type="button" className="lib-zoom-level" aria-pressed={scope !== "shared" && focusGroup === "project:current"}
        onClick={() => { onScopeChange("here"); setFocusGroup("project:current"); }}
        title="The current Project / ProjectCentral web">Project Web</button>
      <Glyph name="arrow" size={11}/>
      <button type="button" className="lib-zoom-level" aria-pressed={scope === "local"}
        onClick={() => { onScopeChange("local"); setFocusGroup(undefined); }}
        title="The personal Central-rooted world — this instance's own material">Personal World</button>
      <Glyph name="arrow" size={11}/>
      <button type="button" className="lib-zoom-level" aria-pressed={scope === "shared"}
        onClick={() => { onScopeChange("shared"); setFocusGroup(undefined); }}
        title="O:I Web — the shared field over admitted projected worlds">O:I Web</button>
      <Glyph name="arrow" size={11}/>
      <span className="lib-zoom-position" data-zoom-admitted={scope === "shared" ? admittedWorlds : undefined}
        title="Admitted participant worlds — the shared entries the owner snapshot discloses, read-only">
        {scope === "shared" ? `admitted · ${admittedWorlds}` : "admitted"}
      </span>
    </nav>

    {groups.map(group => <BrowseGroupSection key={group.key} group={group}
      open={openGroups[group.key] ?? (group.key === "central" || group.key === "project:current" || scope === "shared")}
      register={group.registerKey ? registerByKey.get(group.registerKey) : undefined}
      selectedRef={selectedRef} focused={focusGroup === group.key}
      onToggle={open => setOpenGroups(current => ({...current, [group.key]: open}))}
      onSelect={onSelect} onOpen={onOpen}
      onEnterScene={sceneRef => setLastEnteredScene(sceneRef)}
      onEnterWikiScene={enterWikiScene}/>)}

    {groups.length === 0 && <p className="oi-empty" role="status">
      {scope === "shared"
        ? "The shared field returns no entries — the coverage lines name the exact state. Nothing is invented to fill it."
        : "No groups stand in this scope yet."}</p>}
  </div>;
}

/** One group: a heading with the group's own state, then its rows — the
 * register's Wiki-derived Web first, then the provider items. */
function BrowseGroupSection({group, open, register, selectedRef, focused, onToggle, onSelect, onOpen, onEnterScene, onEnterWikiScene}: {
  group: BrowseGroup;
  open: boolean;
  register: WikiRegister | undefined;
  selectedRef?: string;
  focused?: boolean;
  onToggle: (open: boolean) => void;
  onSelect: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem, how: "page" | "expression" | "instrument" | "source") => void;
  onEnterScene: (sceneRef: string) => void;
  onEnterWikiScene: (registerKey: string, sceneRef: string, title: string | undefined, onEntered: (sceneRef: string) => void) => void;
}) {
  const standing = useStandingOf(register?.key);
  return <section className={`lib-col-group${focused ? " lib-col-group-focused" : ""}`} data-group-key={group.key} data-group-kind={group.kind}>
    <button type="button" className="oi-eyebrow lib-col-heading" aria-expanded={open} onClick={() => onToggle(!open)}>
      <Glyph name={group.kind === "shared" ? "graph" : group.kind === "central" ? "home" : "wiki"} size={12}/>
      <span>{group.label}</span>
      <span className="oi-state lib-col-count">{group.items.length}</span>
      {group.readonly && <span className="oi-state" data-readonly="true">read-only</span>}
    </button>
    {open && <>
      {group.kind !== "shared" && register && standing && <WebRow register={register} standing={standing}
        onEnterScene={sceneRef => onEnterWikiScene(register.key, sceneRef, undefined, onEnterScene)}/>}
      {group.kind !== "shared" && register && standing?.phase === "reading" && <p className="oi-note lib-col-note" role="status">Reading the register's wiki…</p>}
      {group.kind !== "shared" && register && standing?.phase === "absent" && <p className="oi-note lib-col-note">This register discloses no wiki yet — no Web row stands here, and none is invented.</p>}
      {group.kind !== "shared" && register && standing?.phase === "unavailable" && <p className="oi-refusal lib-col-note" role="status">Wiki reading unavailable: {standing.reason}</p>}
      {group.items.map(item => <ItemRow key={`${item.provider}:${item.ref}`} item={item} selected={item.ref === selectedRef}
        onSelect={onSelect} onOpen={onOpen}/>)}
    </>}
  </section>;
}

function useStandingOf(registerKey: string | undefined): RegisterStanding | undefined {
  const store = useWikiProjectionState();
  return registerKey ? store.standings[registerKey] : undefined;
}

/** The Wiki-derived Web row: the register's projected local whole with its
 * scenes as one bounded line of chips. The reveal popover lives at row
 * level so the strip's own hidden overflow can never clip it. */
function WebRow({register, standing, onEnterScene}: {
  register: WikiRegister;
  standing: RegisterStanding;
  onEnterScene: (sceneRef: string) => void;
}) {
  const projection = "projection" in standing && standing.projection ? standing.projection : undefined;
  const document = standing.phase === "ready" || standing.phase === "drift" ? standing.document : projection?.document;
  const [reveal, setReveal] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reveal) return;
    const close = (event: MouseEvent) => {
      if (!revealRef.current?.contains(event.target as Node)) setReveal(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setReveal(false); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", key); };
  }, [reveal]);
  if (!projection || !document) {
    if (standing.phase === "opening") return <p className="oi-note lib-col-note" role="status">Opening the projection in the kernel…</p>;
    return null;
  }
  const basis = projection.document.provenance[0];
  const scenes: SceneChip[] = document.scenes.map(scene => ({sceneRef: scene.scene_ref, title: scene.title}));
  return <div className="lib-col-row lib-col-web" data-row-kind="web" data-web-register={register.key}
    data-expression-ref={document.expression_ref} data-scene-count={scenes.length}>
    <span className="lib-col-name" title={document.title}>
      <Glyph name="wiki" size={13}/>
      <strong>WEB</strong> · {register.title}
    </span>
    <span className="lib-col-identity" title={basis ? `${basis.ref} @ ${basis.revision}` : undefined}>
      wiki local whole{basis ? <> · <span className="oi-ref">{basis.ref.replace(/^wiki:/, "")}</span> @ {shortRevision(basis.revision)}</> : null}
      {projection.boundRelationCount > 0 ? ` · ${projection.boundRelationCount} typed relations` : ""}
    </span>
    <span className="lib-col-chipcell">
      <SceneChipStrip scenes={scenes} ariaLabel={`${register.title} web scenes`}
        onEnterScene={sceneRef => { onEnterScene(sceneRef); setReveal(false); }}
        reveal={reveal} onToggleReveal={() => setReveal(current => !current)}/>
      {reveal && <span className="lib-scene-reveal-pop" ref={revealRef} role="group" aria-label={`${register.title} web scenes`}>
        {scenes.map(scene =>
          <button key={`r:${scene.sceneRef}`} type="button" className="lib-scene-chip" data-scene-ref={scene.sceneRef}
            onClick={() => { onEnterScene(scene.sceneRef); setReveal(false); }}>
            {scene.title}
          </button>)}
      </span>}
    </span>
  </div>;
}

/** A provider item row. Scene chips render only what the owner read
 * disclosed — LibraryItem carries none today, so a page or shared entry
 * renders its honest dash, never invented scenes. */
function ItemRow({item, selected, onSelect, onOpen}: {
  item: LibraryItem;
  selected: boolean;
  onSelect: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem, how: "page" | "expression" | "instrument" | "source") => void;
}) {
  const openHow: "page" | "expression" | "instrument" = item.kind === "composition" ? "expression"
    : item.kind === "projected-object" ? "instrument" : "page";
  const identity = item.sourceLocation
    ? <span className="oi-ref">{item.sourceLocation.path ?? item.sourceLocation.ref}</span>
    : item.project ? <>project {item.project}</> : item.owner;
  return <div className={`lib-col-row${selected ? " lib-col-row-selected" : ""}`} data-row-kind={item.kind} data-item-ref={item.ref}>
    <button type="button" className="lib-col-name" onClick={() => onSelect(item)} title={item.title}>
      <Glyph name={KIND_GLYPH[item.kind]} size={13}/>
      <strong>{item.kind === "composition" ? "EXPRESSION" : item.kind === "projected-object" ? "PROJECTED" : item.kind === "page" ? "PAGE" : item.kind === "world" ? "WORLD" : "EXPRESSION"}</strong> · <span className="lib-col-title">{item.title}</span>
    </button>
    <span className="lib-col-identity">{identity}{item.revision ? <> · rev {shortRevision(item.revision)}</> : null}{item.fixture ? " · fixture" : null}</span>
    <span className="lib-col-open">
      <button type="button" className="oi-action" onClick={() => onOpen(item, openHow)}>Open</button>
      {item.sourceLocation && <button type="button" className="oi-action" onClick={() => onOpen(item, "source")} title="Open the exact source">Source</button>}
    </span>
  </div>;
}

/**
 * The one-line scene chip strip. All chips are measured in a hidden
 * measuring row (real DOM widths), the strip renders only the bounded
 * visible prefix plus a "+N / reveal" control — the row never wraps and
 * nothing overflows the page. The reveal popover itself is the row's
 * (see WebRow).
 */
function SceneChipStrip({scenes, ariaLabel, onEnterScene, reveal, onToggleReveal}: {
  scenes: SceneChip[];
  ariaLabel: string;
  onEnterScene: (sceneRef: string) => void;
  reveal: boolean;
  onToggleReveal: () => void;
}) {
  const stripRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(scenes.length);

  useEffect(() => {
    const strip = stripRef.current, measure = measureRef.current;
    if (!strip || !measure) return;
    const chipNodes = Array.from(measure.querySelectorAll<HTMLElement>(".lib-scene-chip"));
    const bound = () => {
      const available = strip.clientWidth;
      if (available <= 0) return;
      const gap = 6, revealReserve = 40;
      let used = 0, count = 0;
      for (const node of chipNodes) {
        const width = node.offsetWidth + gap;
        // The reserve applies only once one chip stands: the strip always
        // shows at least the first scene that fits the row at all.
        const reserve = count > 0 && chipNodes.length - count - 1 > 0 ? revealReserve : 0;
        if (used + width > available - reserve) break;
        used += width;
        count++;
      }
      setVisible(count);
    };
    bound();
    const observer = new ResizeObserver(bound);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [scenes]);

  const overflow = Math.max(0, scenes.length - visible);

  return <span className="lib-scene-strip" ref={stripRef} data-scene-total={scenes.length} data-scene-visible={Math.min(visible, scenes.length)} data-scene-overflow={overflow}
    aria-label={ariaLabel}>
    {/* The hidden measuring row carries every chip at its real width. */}
    <span className="lib-scene-measure" aria-hidden ref={measureRef}>
      {scenes.map(scene => <span key={`m:${scene.sceneRef}`} className="lib-scene-chip">{scene.title}</span>)}
    </span>
    {scenes.slice(0, visible).map(scene =>
      <button key={scene.sceneRef} type="button" className="lib-scene-chip" data-scene-ref={scene.sceneRef}
        title={`Enter ${scene.title}`} onClick={() => onEnterScene(scene.sceneRef)}>
        {scene.title}
      </button>)}
    {overflow > 0 && <button type="button" className="lib-scene-reveal" aria-expanded={reveal}
      data-scene-overflow-count={overflow}
      title={`${overflow} more scene${overflow === 1 ? "" : "s"} — reveal the full list`}
      onClick={onToggleReveal}>+{overflow}</button>}
  </span>;
}
