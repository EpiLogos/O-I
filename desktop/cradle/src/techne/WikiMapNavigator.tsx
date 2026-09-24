import {useEffect, useRef, useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {Glyph} from "../workspace/Glyph";
import {scrollWithin} from "../shared/scrollWithin";
import {
  ensureWikiProjection,
  requestWikiSelection,
  setWikiProjectionRegisters,
  useWikiProjectionState,
  wikiProjectionOf,
  wikiStandingSubtitle,
  type RegisterStanding,
} from "./wikiProjectionStore";
import {wikiRegistersFrom, type ProjectedConstellation} from "./wikiExpression";
import {ensureWikiNativeExpression} from "./wikiNativeExpression";
import "./techne.css";

/** The wiki tree projects the shared Wiki→Expression state. Row selection
 * and centre focus remain one act; this navigator owns no second reading or
 * layout. The frame owns scrolling. Registers expose their actual state and
 * keep the existing project/open actions. */

interface FocusAsk {
  sceneRef: string;
  entityRef: string | null;
  subjectRef: string | null;
  title?: string;
}

export function WikiMapNavigator({project, onOpenWiki, onMessage}: {
  project?: string;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  const kernel = useKernel();
  const store = useWikiProjectionState();
  // The map publishes the registers itself, from the same disclosed census
  // Instrument 0 reads: Technè's centre no longer seats the M0′ lens by
  // default (#420), and the map must not wait on a centre body to learn
  // which wikis exist. The store ignores an identical republication.
  useEffect(() => {
    setWikiProjectionRegisters(wikiRegistersFrom((kernel.snapshot.navigator?.root?.work.projects ?? []).map(row => ({name: row.name, path: row.path}))));
  }, [kernel.snapshot.navigator?.root?.work.projects]);
  return <div className="wiki-map" aria-label="Wiki map" data-aperture="tree">
    {store.registers.map(register => <WikiRegion key={register.key} register={register}
      defaultOpen={project ? register.key === project : register.key === "central"}
      activeRegister={store.registerKey === register.key}
      onOpenWiki={onOpenWiki} onMessage={onMessage}/>)}
    {store.registers.length === 0 && <p className="wiki-map-note" role="status">Reading the world's registers…</p>}
  </div>;
}

/** One register's region: head with a state subtitle, the projection's own
 * entries beneath — read once per register through the ONE state. */
function WikiRegion({register, defaultOpen, activeRegister, onOpenWiki, onMessage}: {
  register: {key: string; title: string; project?: string; projectPath?: string};
  defaultOpen: boolean;
  activeRegister: boolean;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  const kernel = useKernel();
  const store = useWikiProjectionState();
  const standing: RegisterStanding = store.standings[register.key] ?? {phase: "idle"};
  const projection = wikiProjectionOf(standing);
  const [opened, setOpened] = useState(defaultOpen);
  const [projecting, setProjecting] = useState(false);
  const lastFailure = useRef<string | null>(null);

  useEffect(() => { if (opened) ensureWikiProjection(register, kernel.transport); }, [opened, register, kernel.transport]);

  // A region-level failure also rides the footer, once per distinct reason.
  useEffect(() => {
    if (standing.phase !== "unavailable") { lastFailure.current = null; return; }
    if (lastFailure.current !== standing.reason) {
      lastFailure.current = standing.reason;
      onMessage(`${register.title} wiki map: ${standing.reason}`);
    }
  }, [standing, register.title, onMessage]);

  const subtitle = wikiStandingSubtitle(standing);
  const reading = standing.phase === "projected" || standing.phase === "opening" ? standing.reading.wiki : undefined;
  const homeSpace = reading
    ? (reading.spaces.length === 1 ? reading.spaces[0] : reading.spaces.find(space => space.ref.endsWith(":root")))
    : undefined;
  const webRef = homeSpace ? (homeSpace.anchor_ref ?? homeSpace.ref) : undefined;

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
      onMessage(`${register.title} wiki map: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setProjecting(false); }
  };

  // Entries the reading holds but the projection does not place: page-open
  // rows, named — never invented projection membership.
  const elsewhere = elsewhereOf(standing);

  // The selected row scrolls quietly into view (the centre's selection may
  // have come from the stage, the transport or another aperture).
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selectionMatches) return;
    const selected = bodyRef.current?.querySelector("[aria-selected='true']");
    if (selected) scrollWithin(selected as HTMLElement);
  }, [selectionMatches, selection.entityRef, selection.sceneRef]);

  return <details className="wiki-region wiki-region-register" open={opened} data-register={register.key} data-active-register={activeRegister || undefined}
    onToggle={event => { setOpened((event.target as HTMLDetailsElement).open); }}>
    <summary>
      <Glyph name="wiki" size={12}/>
      <span className="wiki-map-name">{register.title}</span>
      <span className="wiki-map-count">{subtitle}</span>
      {activeRegister && <span className="wiki-map-here" title="This is the register Instrument 0 projects">·</span>}
      {webRef && <button className="wiki-open-web" aria-label={`Open the ${register.title} web`}
        title={`Open the ${register.title} web`} onClick={event => { event.preventDefault(); onOpenWiki(webRef, homeSpace?.title ?? "Wiki", register.project); }}>
        <Glyph name="arrow" size={11}/>
      </button>}
      <button className="wiki-project-register" aria-label={`Project ${register.title} in Instrument 0`}
        disabled={projecting} title={`Project ${register.title} in Instrument 0`} onClick={event => { event.preventDefault(); void projectRegister(); }}>
        <Glyph name="instrument" size={11}/>
      </button>
    </summary>
    {standing.phase === "unavailable" && <p className="wiki-map-note" role="status">{standing.reason}</p>}
    {opened && projection && <div ref={bodyRef} className="wiki-region-body">
      {(projection.constellations ?? []).map(constellation => <section key={constellation.sceneRef} className="wiki-space">
        <WholeRow constellation={constellation} selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: null})} onFocus={focusRow}/>
        <div className="wiki-constellation">
          {constellation.members.map(member => <MemberRow key={member.entityRef} member={member} sceneRef={constellation.sceneRef}
            selected={rowSelected({sceneRef: constellation.sceneRef, entityRef: member.entityRef})} onFocus={focusRow}/>)}
          {constellation.members.length === 0 && <p className="wiki-map-note">No members in this scene yet.</p>}
        </div>
      </section>)}
      {elsewhere.length > 0 && <>
        <header className="wiki-space-head"><span className="wiki-space-name">not projected</span></header>
        {elsewhere.map(node => <button key={node.ref} className="wiki-node-row" data-row-kind="elsewhere"
          title={`${node.title}${node.type ? ` (${node.type})` : ""} — in the wiki reading, with no scene membership; opens as a page`}
          onClick={() => onOpenWiki(node.ref, node.title || "Wiki", register.project)}>
          <span className="wiki-node-title">{node.title}</span>
          {node.type && <span className="wiki-node-type">{node.type}</span>}
        </button>)}
      </>}
    </div>}
  </details>;
}

/** The whole row: entering the constellation scene — the transport's own
 * scene act, from the map's side of the one state. */
function WholeRow({constellation, selected, onFocus}: {
  constellation: ProjectedConstellation;
  selected: boolean;
  onFocus(row: FocusAsk): void;
}) {
  return <button className="wiki-node-row wiki-node-whole" data-row-kind="whole"
    data-scene-ref={constellation.sceneRef} data-subject-ref={constellation.wholeRef}
    aria-selected={selected}
    title={`Enter ${constellation.title} — ${constellation.scheme === "ql-constellation" ? "QL constellation layout, warranted by the wiki's own positions" : "radial presentation, no warrant claimed"}`}
    onClick={() => onFocus({sceneRef: constellation.sceneRef, entityRef: null, subjectRef: constellation.wholeRef, title: constellation.title})}>
    <span className="wiki-node-title">{constellation.title}</span>
    <span className="wiki-node-type">{constellation.scheme === "ql-constellation" ? "warranted shape" : "radial"}</span>
  </button>;
}

function MemberRow({member, sceneRef, selected, onFocus}: {
  member: {entityRef: string; subjectRef: string; title: string; position: number | null};
  sceneRef: string;
  selected: boolean;
  onFocus(row: FocusAsk): void;
}) {
  return <button className="wiki-node-row" data-row-kind="member"
    data-scene-ref={sceneRef} data-entity-ref={member.entityRef} data-subject-ref={member.subjectRef}
    aria-selected={selected}
    title={member.position !== null ? `${member.title} — declared position ${member.position}` : member.title}
    onClick={() => onFocus({sceneRef, entityRef: member.entityRef, subjectRef: member.subjectRef, title: member.title})}>
    <span className="wiki-node-title">{member.title}</span>
    {member.position !== null && <span className="wiki-node-type">{`p${member.position}`}</span>}
  </button>;
}

/** Nodes the reading holds that no constellation places: page-open rows,
 * disclosed as "not projected" — never silent, never invented membership. */
function elsewhereOf(standing: RegisterStanding): {ref: string; title: string; type?: string}[] {
  if (standing.phase !== "projected" && standing.phase !== "opening") return [];
  const wiki = standing.reading.wiki;
  const placed = new Set<string>();
  for (const space of wiki.spaces) for (const ref of space.node_refs ?? []) placed.add(ref);
  for (const frame of wiki.constellations) for (const member of frame.members ?? []) if (member.ref) placed.add(member.ref);
  return wiki.nodes.filter(node => !placed.has(node.ref)).map(node => ({ref: node.ref, title: node.title ?? node.ref, type: node.type}));
}
