import {wikiDisplayName} from "../../../../packages/oi-design-system/expressions-engine/oi/wikiPresentation.mjs";
import {useEffect, useRef, useState, type ReactNode} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {Glyph} from "../workspace/Glyph";
import {scrollWithin} from "../shared/scrollWithin";
import {
  ensureWikiProjection,
  requestWikiSelection,
  rereadWikiProjection,
  setWikiProjectionRegisters,
  useWikiProjectionState,
  wikiDocumentOf,
  wikiProjectionOf,
  wikiReadingOf,
  type RegisterStanding,
} from "./wikiProjectionStore";
import {wikiRegistersFrom, relationCountOf, treeConstellationsOf, projectSpaceRefOf, type ProjectedConstellation, type WikiRegister} from "./wikiExpression";
import {ensureWikiNativeExpression, previewWikiRelationRecovery, applyWikiRelationRecovery, seatWikiConstellation, type WikiRelationRecovery} from "./wikiNativeExpression";
import {authoringForms, newConstruction, readRegister, saveConstruction, type AuthoringForm} from "../knowledge/construction";
import "./techne.css";

/** The wiki tree projects the shared Wiki→Expression state as ONE
 * Central-rooted tree (owner commission 2026-09-25): Central is the root
 * node; its own constellations and one node per Project register hang from
 * it; each Project lists its constellations with their members. A root child
 * space that names a Project register IS that Project's node — never listed
 * twice. Row selection and centre focus remain one act; this navigator owns
 * no second reading or layout. */

interface FocusAsk {
  sceneRef: string;
  entityRef: string | null;
  subjectRef: string | null;
  title?: string;
}

const text = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

/** The Technē Canvas's own "New constellation" (an empty field) asks the
 * navigator for its creation row — one creation path, not a second form. */
export const TECHNE_NEW_CONSTELLATION_EVENT = "oi:techne-new-constellation";

/** A pending ask to open the creation row on one register's node. */
interface CreateAsk { key: string; seq: number }

export function WikiMapNavigator({project, onOpenWiki, onMessage}: {
  project?: string;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  const kernel = useKernel();
  const store = useWikiProjectionState();
  // The map publishes the registers itself, from the same disclosed census
  // Instrument 0 reads. The store ignores an identical republication.
  useEffect(() => {
    setWikiProjectionRegisters(wikiRegistersFrom((kernel.snapshot.navigator?.root?.work.projects ?? []).map(row => ({name: row.name, path: row.path}))));
  }, [kernel.snapshot.navigator?.root?.work.projects]);
  const central = store.registers.find(register => !register.project);
  const projects = store.registers.filter(register => !!register.project);
  const projectKeys = new Set(projects.map(register => register.project!));
  // The Canvas's "New constellation" opens the creation row on the active
  // Project register (the one Instrument 0 projects), else on Central.
  const [createAsk, setCreateAsk] = useState<CreateAsk | null>(null);
  const registerKeyRef = useRef(store.registerKey);
  registerKeyRef.current = store.registerKey;
  const registersRef = useRef(store.registers);
  registersRef.current = store.registers;
  useEffect(() => {
    const ask = () => {
      const registers = registersRef.current;
      const active = registers.find(register => register.key === registerKeyRef.current && !!register.project);
      const target = active ?? registers.find(register => !register.project);
      if (target) setCreateAsk(current => ({key: target.key, seq: (current?.seq ?? 0) + 1}));
    };
    window.addEventListener(TECHNE_NEW_CONSTELLATION_EVENT, ask);
    return () => window.removeEventListener(TECHNE_NEW_CONSTELLATION_EVENT, ask);
  }, []);
  if (!central) return <div className="wiki-map" aria-label="Wiki map" data-aperture="tree">
    <p className="wiki-map-state" role="status">Reading…</p>
  </div>;
  return <div className="wiki-map" aria-label="Wiki map" data-aperture="tree">
    <RegisterNode register={central} projectKeys={projectKeys} defaultOpen createAsk={createAsk}
      activeRegister={store.registerKey === central.key} onOpenWiki={onOpenWiki} onMessage={onMessage}>
      {projects.map(register => <RegisterNode key={register.key} register={register} projectKeys={projectKeys} createAsk={createAsk}
        defaultOpen={project === register.key} activeRegister={store.registerKey === register.key}
        onOpenWiki={onOpenWiki} onMessage={onMessage}/>)}
    </RegisterNode>
  </div>;
}

/** One register's node: one summary row (title, constellation count, hover
 * tools), its projection's constellations beneath — read once per register
 * through the ONE state, lazily on first expand. `children` are the nested
 * Project nodes (the Central root only). */
function RegisterNode({register, projectKeys, createAsk, defaultOpen, activeRegister, onOpenWiki, onMessage, children}: {
  register: WikiRegister;
  projectKeys: ReadonlySet<string>;
  createAsk: CreateAsk | null;
  defaultOpen: boolean;
  activeRegister: boolean;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
  children?: ReactNode;
}) {
  const kernel = useKernel();
  const store = useWikiProjectionState();
  const standing: RegisterStanding = store.standings[register.key] ?? {phase: "idle"};
  const projection = wikiProjectionOf(standing);
  const document = wikiDocumentOf(standing);
  const [opened, setOpened] = useState(defaultOpen);
  const [creating, setCreating] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [recovery, setRecovery] = useState<WikiRelationRecovery | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState("");
  const currentReading = wikiReadingOf(standing);
  const nativeDocument = "document" in standing ? standing.document : undefined;
  const incompleteConnections = !!nativeDocument && !nativeDocument.provenance.some(row => row.ref.startsWith("wiki:relations:"))
    && (!projection?.document.provenance.some(row => row.ref.startsWith("wiki:relations:")) || Object.keys(projection.document.relations).some(ref => !nativeDocument.relations[ref]));
  const connectionFailure = currentReading?.relations.state === "unavailable" ? currentReading.relations.reason : undefined;
  const lastFailure = useRef<string | null>(null);

  useEffect(() => { if (opened) ensureWikiProjection(register, kernel.transport); }, [opened, register, kernel.transport]);

  // An ask for this node opens it with its creation row; an ask for a
  // Project opens the Central root it hangs from.
  const [focusSeq, setFocusSeq] = useState(0);
  useEffect(() => {
    if (!createAsk) return;
    if (createAsk.key === register.key) { setOpened(true); setCreating(true); setFocusSeq(createAsk.seq); }
    else if (!register.project) setOpened(true);
  }, [createAsk, register.key, register.project]);

  // A register-level failure also rides the footer, once per distinct reason.
  useEffect(() => {
    if (standing.phase !== "unavailable") { lastFailure.current = null; return; }
    if (lastFailure.current !== standing.reason) {
      lastFailure.current = standing.reason;
      onMessage(`${register.title} wiki: ${standing.reason}`);
    }
  }, [standing, register.title, onMessage]);

  const reading = standing.phase === "projected" || standing.phase === "opening" ? standing.reading.wiki : currentReading?.wiki;
  const homeSpace = reading
    ? (reading.spaces.length === 1 ? reading.spaces[0] : reading.spaces.find(space => space.ref.endsWith(":root")) ?? reading.spaces[0])
    : undefined;
  const webRef = homeSpace ? (homeSpace.anchor_ref ?? homeSpace.ref) : undefined;
  const constellations = projection ? treeConstellationsOf(projection.constellations, projectKeys) : [];

  // The selection is the centre's: a row reads as selected when the ONE
  // state's selection is this register's and names this row's position.
  const selection = store.selection;
  const selectionMatches = selection.registerKey === register.key;
  const rowSelected = (row: {sceneRef: string; entityRef: string | null}) =>
    selectionMatches && (row.entityRef ? selection.entityRef === row.entityRef : !selection.entityRef && selection.sceneRef === row.sceneRef);

  const focusRow = (row: FocusAsk) =>
    requestWikiSelection({registerKey: register.key, sceneRef: row.sceneRef, entityRef: row.entityRef, subjectRef: row.subjectRef, title: row.title, origin: "wiki-map"});

  const projectRegister = async () => {
    if (projecting) return;
    setProjecting(true);
    try {
      const prepared = await ensureWikiNativeExpression(kernel.transport, register);
      focusRow({sceneRef: prepared.projection.overviewSceneRef, entityRef: null, subjectRef: null, title: register.title});
    } catch (error) {
      onMessage(`${register.title} wiki: ${text(error)}`);
    } finally { setProjecting(false); }
  };

  // Retry: a composition that stands without its relations reviews what the
  // fresh reading would restore; otherwise the register is simply read again.
  const retry = async () => {
    if (retrying) return;
    setRetrying(true); setRecovery(null); setRecoveryNotice("");
    try {
      if (incompleteConnections) {
        const plan = await previewWikiRelationRecovery(kernel.transport, register);
        setRecovery(plan);
      } else await rereadWikiProjection(register, kernel.transport);
    } catch (error) { setRecoveryNotice(text(error)); }
    finally { setRetrying(false); }
  };
  const restore = async () => {
    if (!recovery || retrying) return;
    setRetrying(true);
    try {
      const restored = await applyWikiRelationRecovery(kernel.transport, recovery);
      setRecovery(null); setRecoveryNotice("");
      requestWikiSelection({registerKey: register.key, sceneRef: restored.selection.scene_ref, entityRef: restored.selection.entity_ref, relationRef: restored.selection.relation_ref ?? undefined, subjectRef: null, origin: "wiki-map"});
    } catch (error) { setRecovery(null); setRecoveryNotice(text(error)); }
    finally { setRetrying(false); }
  };
  const relationState = opened && (standing.phase !== "unavailable") && (incompleteConnections || !!connectionFailure || !!recoveryNotice);

  // Entries the reading holds but no constellation places: page-open rows.
  const elsewhere = elsewhereOf(standing);

  // The selected row scrolls quietly into view (the centre's selection may
  // have come from the stage, the transport or another aperture).
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selectionMatches) return;
    const selected = bodyRef.current?.querySelector(":scope > .wiki-space [aria-selected='true']");
    if (selected) scrollWithin(selected as HTMLElement);
  }, [selectionMatches, selection.entityRef, selection.sceneRef]);

  const count = projection ? constellations.length : undefined;
  return <details className="wiki-region wiki-region-register" open={opened} data-register={register.key} data-register-kind={register.project ? "project" : "central"} data-active-register={activeRegister || undefined}
    onToggle={event => { if (event.target === event.currentTarget) setOpened((event.currentTarget as HTMLDetailsElement).open); }}>
    <summary>
      <span className="wiki-map-name">{register.title}</span>
      {count !== undefined && <span className="wiki-map-count" title={`${count} ${count === 1 ? "constellation" : "constellations"}`}>{count}</span>}
      {activeRegister && <span className="wiki-map-here" title="Instrument 0 projects this register">·</span>}
      <span className="wiki-map-tools">
        {webRef && <button type="button" className="wiki-open-web" aria-label={`Open the ${register.title} web`}
          title={`Open the ${register.title} web`} onClick={event => { event.preventDefault(); onOpenWiki(webRef, homeSpace?.title ?? "Wiki", register.project); }}>
          <Glyph name="arrow" size={11}/>
        </button>}
        {register.project && <button type="button" className="wiki-new-constellation" aria-label={`New constellation in ${register.title}`}
          title={`New constellation in ${register.title}`} aria-expanded={creating}
          onClick={event => { event.preventDefault(); setOpened(true); setCreating(true); }}>
          <Glyph name="plus" size={11}/>
        </button>}
        <button type="button" className="wiki-project-register" aria-label={`Project ${register.title} in Instrument 0`}
          disabled={projecting} title={`Project ${register.title} in Instrument 0`} onClick={event => { event.preventDefault(); void projectRegister(); }}>
          <Glyph name="instrument" size={11}/>
        </button>
      </span>
    </summary>
    {opened && <div ref={bodyRef} className="wiki-region-body">
      {creating && <CreateConstellationRow register={register} focusSeq={focusSeq} onClose={() => setCreating(false)}/>}
      {standing.phase === "reading" && <p className="wiki-map-state" role="status">Reading…</p>}
      {standing.phase === "absent" && <p className="wiki-map-state" role="status">No wiki</p>}
      {standing.phase === "unavailable" && !projection && <p className="wiki-map-state" role="status">
        <span className="wiki-map-state-text" title={standing.reason}>Couldn't read</span>
        <RetryButton busy={retrying} label={`Read ${register.title} again`} onRetry={() => void retry()}/>
      </p>}
      {relationState && <p className="wiki-map-state" role="status" data-state="relations">
        <span className="wiki-map-state-text" title={recoveryNotice || connectionFailure || "This composition opened before its relations could be read"}>
          {recovery ? (recovery.missing.length ? "relations to restore" : "relations complete") : "relations unavailable"}
        </span>
        {recovery && recovery.missing.length > 0
          ? <button type="button" className="wiki-map-state-action" disabled={retrying} onClick={() => void restore()}>restore {recovery.missing.length}</button>
          : <RetryButton busy={retrying} label="Read relations again" onRetry={() => void retry()}/>}
      </p>}
      {projection && constellations.map(constellation => <section key={constellation.sceneRef} className="wiki-space">
        <WholeRow constellation={constellation} relationCount={relationCountOf(document, constellation.sceneRef)}
          selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: null})} onFocus={focusRow}/>
        {constellation.members.length > 0 && <div className="wiki-constellation">
          {constellation.members.map(member => <MemberRow key={member.entityRef} member={member} sceneRef={constellation.sceneRef}
            selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: member.entityRef})} onFocus={focusRow}/>)}
        </div>}
      </section>)}
      {elsewhere.length > 0 && <section className="wiki-space" data-row-kind="elsewhere">
        {elsewhere.map(node => <button key={node.ref} type="button" className="wiki-node-row" data-row-kind="elsewhere"
          title={`${node.title}${node.type ? ` (${node.type})` : ""} — opens as a page`}
          onClick={() => onOpenWiki(node.ref, node.title || "Wiki", register.project)}>
          <span className="wiki-node-title">{node.title}</span>
        </button>)}
      </section>}
      {children}
    </div>}
  </details>;
}

function RetryButton({busy, label, onRetry}: {busy: boolean; label: string; onRetry(): void}) {
  return <button type="button" className="wiki-map-retry" aria-label={label} title={label} disabled={busy} onClick={onRetry}>
    <Glyph name="refresh" size={11}/>
  </button>;
}

/** The per-Project "+": a compact inline row — title, question, frame —
 * that creates a fresh constellation in this Project's own wiki through the
 * native `aikit.constellation.apply`, re-reads the register, seats the new
 * constellation in the register's composition and opens it in the Technē
 * field on the Canvas lens. Failures stay here, in the row, as they are. */
function CreateConstellationRow({register, focusSeq, onClose}: {register: WikiRegister; focusSeq: number; onClose(): void}) {
  const kernel = useKernel();
  const titleField = useRef<HTMLInputElement | null>(null);
  // Brought into view with its Title focused on open and on every new ask.
  useEffect(() => {
    const field = titleField.current;
    if (!field) return;
    scrollWithin(field.closest("form"), "nearest");
    if (!field.disabled) field.focus({preventScroll: true});
  }, [focusSeq]);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [formId, setFormId] = useState("");
  const [forms, setForms] = useState<AuthoringForm[]>([]);
  const [formsFailure, setFormsFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    void authoringForms(kernel.transport, register.project).then(
      value => { if (alive.current) setForms(value); },
      cause => { if (alive.current) setFormsFailure(text(cause)); });
  }, [kernel.transport, register.project]);

  const create = async () => {
    if (busy || saved) return;
    setBusy(true); setError("");
    let stage: "save" | "open" = "save";
    try {
      const basis = await readRegister(kernel.transport, register.project);
      const space = projectSpaceRefOf(basis.spaces, register.project);
      if (!space) throw new Error(`${register.title}'s wiki has no space to hold a constellation.`);
      const request = newConstruction(title, question, space, forms.find(form => form.id === formId));
      const result = await saveConstruction(kernel.transport, register.project, basis, request, [], kernel.apply);
      stage = "open";
      if (alive.current) setSaved(true);
      const anchor = result.reading.frame.constellations[0]?.anchor_ref;
      const projection = await rereadWikiProjection(register, kernel.transport);
      const constellation = projection.constellations.find(row => row.kind === "frame" && row.wholeRef === anchor);
      if (!constellation) throw new Error("the fresh Wiki reading does not yet carry it");
      await seatWikiConstellation(kernel.transport, register, constellation.sceneRef);
      requestWikiSelection({registerKey: register.key, sceneRef: constellation.sceneRef, entityRef: null, subjectRef: constellation.wholeRef, title: constellation.title, origin: "wiki-map", lens: "canvas"});
      if (alive.current) onClose();
    } catch (cause) {
      if (alive.current) setError(stage === "save" ? text(cause) : `Created in ${register.title}; opening it failed: ${text(cause)}`);
    } finally { if (alive.current) setBusy(false); }
  };

  return <form className="wiki-create" aria-label={`New constellation in ${register.title}`}
    onSubmit={event => { event.preventDefault(); void create(); }}
    onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); } }}>
    <input ref={titleField} className="oi-input" aria-label="Constellation title" placeholder="Title" value={title}
      disabled={busy || saved} onChange={event => setTitle(event.target.value)}/>
    <input className="oi-input" aria-label="Constellation question" placeholder="Question" value={question}
      disabled={busy || saved} onChange={event => setQuestion(event.target.value)}/>
    <select className="oi-input" aria-label="Constellation frame" value={formId} disabled={busy || saved}
      title={formsFailure ? `QL authoring forms unavailable: ${formsFailure}` : undefined}
      onChange={event => setFormId(event.target.value)}>
      <option value="">Open arrangement · no QL required</option>
      {forms.map(form => <option key={form.id} value={form.id}>{form.label}</option>)}
    </select>
    {error && <p className="wiki-create-error" role="alert">{error}</p>}
    <div className="wiki-create-actions">
      {!saved && <button type="submit" className="oi-action" disabled={busy || !title.trim() || !question.trim()}>{busy ? "Creating…" : "Create constellation"}</button>}
      <button type="button" className="oi-action" disabled={busy} onClick={onClose}>{saved ? "Close" : "Cancel"}</button>
    </div>
  </form>;
}

/** The whole row: entering the constellation scene — the transport's own
 * scene act, from the map's side of the one state. Member and relation
 * counts are the native reading's own numbers, never a placeholder. */
function WholeRow({constellation, relationCount, selected, onFocus}: {
  constellation: ProjectedConstellation;
  relationCount: number;
  selected: boolean;
  onFocus(row: FocusAsk): void;
}) {
  const memberCount = constellation.members.length;
  return <button type="button" className="wiki-node-row wiki-node-whole" data-row-kind="whole" data-whole-kind={constellation.kind}
    data-scene-ref={constellation.sceneRef} data-subject-ref={constellation.wholeRef}
    aria-selected={selected}
    title={constellation.title}
    onClick={() => onFocus({sceneRef: constellation.sceneRef, entityRef: null, subjectRef: constellation.wholeRef, title: constellation.title})}>
    <span className="wiki-node-title">{constellation.title}</span>
    {relationCount > 0 && <span className="wiki-node-edges" title={`${relationCount} ${relationCount === 1 ? "relation" : "relations"}`}>⌇{relationCount}</span>}
    <span className="wiki-node-count" title={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}>{memberCount}</span>
  </button>;
}

function MemberRow({member, sceneRef, selected, onFocus}: {
  member: {entityRef: string; subjectRef: string; title: string; position: number | null};
  sceneRef: string;
  selected: boolean;
  onFocus(row: FocusAsk): void;
}) {
  return <button type="button" className="wiki-node-row" data-row-kind="member"
    data-scene-ref={sceneRef} data-entity-ref={member.entityRef} data-subject-ref={member.subjectRef}
    aria-selected={selected}
    title={member.position !== null ? `${member.title} — position ${member.position}` : member.title}
    onClick={() => onFocus({sceneRef, entityRef: member.entityRef, subjectRef: member.subjectRef, title: member.title})}>
    <span className="wiki-node-title">{member.title}</span>
  </button>;
}

/** Nodes the reading holds that no constellation places: page-open rows —
 * never silent, never invented membership. */
function elsewhereOf(standing: RegisterStanding): {ref: string; title: string; type?: string}[] {
  const wiki = wikiReadingOf(standing)?.wiki ?? (standing.phase === "projected" || standing.phase === "opening" ? standing.reading.wiki : undefined);
  if (!wiki) return [];
  const placed = new Set<string>();
  for (const space of wiki.spaces) for (const ref of space.node_refs ?? []) placed.add(ref);
  for (const frame of wiki.constellations) {
    if (frame.anchor_ref) placed.add(frame.anchor_ref);
    for (const member of frame.members ?? []) if (member.ref) placed.add(member.ref);
  }
  return wiki.nodes.filter(node => !placed.has(node.ref)).map(node => ({ref: node.ref, title: wikiDisplayName(node.title, node.ref), type: node.type}));
}
